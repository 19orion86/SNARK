import { EventEmitter } from "node:events"
import type { RealtimeEvent } from "@/lib/realtime/types"

export type { RealtimeEvent } from "@/lib/realtime/types"

export interface RealtimeBus {
  publish(event: RealtimeEvent): void
  subscribe(handler: (event: RealtimeEvent) => void): () => void
}

const CHANNEL = "snark:realtime"

class InProcessRealtimeBus implements RealtimeBus {
  private readonly emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(500)
  }

  publish(event: RealtimeEvent): void {
    this.emitter.emit("event", event)
  }

  subscribe(handler: (event: RealtimeEvent) => void): () => void {
    this.emitter.on("event", handler)
    return () => {
      this.emitter.off("event", handler)
    }
  }
}

/**
 * Redis Pub/Sub поверх локального EventEmitter.
 * Local emit — для текущего процесса; publish в Redis — для остальных инстансов.
 */
class RedisRealtimeBus implements RealtimeBus {
  private readonly local = new InProcessRealtimeBus()
  private readonly pub: import("ioredis").default
  private readonly sub: import("ioredis").default
  private started = false

  constructor(redisUrl: string) {
    // Dynamic require keeps ioredis out of edge/client bundles when REDIS_URL is unset.
    const Redis = require("ioredis") as typeof import("ioredis").default
    this.pub = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true })
    this.sub = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true })
    void this.start()
  }

  private async start(): Promise<void> {
    if (this.started) return
    this.started = true
    try {
      await this.pub.connect()
      await this.sub.connect()
      await this.sub.subscribe(CHANNEL)
      this.sub.on("message", (_channel: string, raw: string) => {
        try {
          const event = JSON.parse(raw) as RealtimeEvent & { __origin?: string }
          if (event.__origin === process.pid.toString()) return
          const { __origin: _, ...clean } = event as RealtimeEvent & { __origin?: string }
          this.local.publish(clean as RealtimeEvent)
        } catch {
          // ignore malformed payloads
        }
      })
    } catch (error) {
      console.error("[realtime] Redis bus failed, falling back to in-process only", error)
    }
  }

  publish(event: RealtimeEvent): void {
    this.local.publish(event)
    const payload = JSON.stringify({ ...event, __origin: process.pid.toString() })
    void this.pub.publish(CHANNEL, payload).catch(() => {})
  }

  subscribe(handler: (event: RealtimeEvent) => void): () => void {
    return this.local.subscribe(handler)
  }
}

const globalForRealtime = globalThis as unknown as { __snarkRealtimeBus?: RealtimeBus }

export function getRealtimeBus(): RealtimeBus {
  if (!globalForRealtime.__snarkRealtimeBus) {
    const redisUrl = process.env.REDIS_URL?.trim()
    globalForRealtime.__snarkRealtimeBus = redisUrl
      ? new RedisRealtimeBus(redisUrl)
      : new InProcessRealtimeBus()
  }
  return globalForRealtime.__snarkRealtimeBus
}

export function eventVisibleToUser(event: RealtimeEvent, userId: string): boolean {
  if (event.type === "notification.new") {
    return event.userId === userId
  }
  return event.memberIds.includes(userId)
}

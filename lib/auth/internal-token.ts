import "server-only"
import { timingSafeEqual } from "node:crypto"

export class InternalAuthError extends Error {
  status = 401
  code = "UNAUTHORIZED"

  constructor(message = "Неверный внутренний токен") {
    super(message)
    this.name = "InternalAuthError"
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Shared-secret для сервиса протоколов ↔ портал. */
export function assertInternalToken(request: Request): void {
  const expected = process.env.INTERNAL_TOKEN?.trim()
  if (!expected) {
    throw new InternalAuthError("INTERNAL_TOKEN не настроен на портале")
  }
  const provided = request.headers.get("x-internal-token")?.trim()
  if (!provided || !safeEqual(provided, expected)) {
    throw new InternalAuthError()
  }
}

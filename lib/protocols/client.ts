import "server-only"

const DEFAULT_BASE = "http://localhost:8000"

function getProtocolsApiBase(): string {
  return process.env.PROTOCOLS_API_URL?.replace(/\/$/, "") ?? DEFAULT_BASE
}

export function getProtocolsApiUrl(path: string): string {
  const base = getProtocolsApiBase()
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}

export async function proxyProtocolsRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = getProtocolsApiUrl(path)
  return fetch(url, {
    ...init,
    cache: "no-store",
  })
}

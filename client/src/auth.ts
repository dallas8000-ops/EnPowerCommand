const KEY = 'enpower_token'
const META_KEY = 'enpower_meta'

export type AuthMeta = {
  tenant_name?: string
  role?: string
  plan?: string
  userId?: string
}

export function getUserId(): string | null {
  try {
    const token = getToken()
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1])) as { sub?: string }
    return payload.sub ?? null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return localStorage.getItem(KEY)
}

export function setToken(token: string, meta?: AuthMeta): void {
  localStorage.setItem(KEY, token)
  if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function getAuthMeta(): AuthMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as AuthMeta) : {}
  } catch {
    return {}
  }
}

export function clearToken(): void {
  localStorage.removeItem(KEY)
  localStorage.removeItem(META_KEY)
}

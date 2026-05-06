/** Production API origin without trailing slash. Empty uses relative URLs (Vite proxy in dev, same host if combined later). */
export function getApiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : ''
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getApiOrigin()
  return base ? `${base}${p}` : p
}

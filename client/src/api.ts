import { apiUrl } from './apiBase'

const jsonHeaders = { 'Content-Type': 'application/json' }

async function parseJson(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

export type Lead = {
  id: string
  company: string
  contact_name: string | null
  role: string | null
  url: string | null
  notes: string | null
  stage: string
  next_action_at: string | null
  created_at: string
  updated_at: string
}

export type Health = {
  ok: boolean
  service: string
  db: boolean
  ai: boolean
}

export async function getHealth(): Promise<Health> {
  const res = await fetch(apiUrl('/api/health'))
  return parseJson(res) as Promise<Health>
}

export async function listLeads(): Promise<{
  leads: Lead[]
  error?: string
  hint?: string
}> {
  const res = await fetch(apiUrl('/api/leads'))
  const data = (await parseJson(res)) as {
    leads?: Lead[]
    error?: string
    hint?: string
  }
  if (!res.ok) {
    return {
      leads: [],
      error: typeof data.error === 'string' ? data.error : 'Could not load leads',
      hint: typeof data.hint === 'string' ? data.hint : undefined,
    }
  }
  return { leads: data.leads ?? [] }
}

export async function getLead(id: string): Promise<{ lead?: Lead; error?: string }> {
  const res = await fetch(apiUrl(`/api/leads/${id}`))
  const data = await parseJson(res)
  if (!res.ok) return data
  return data as { lead: Lead }
}

export async function createLead(body: Partial<Lead> & { company: string }) {
  const res = await fetch(apiUrl('/api/leads'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  return parseJson(res) as Promise<{ lead?: Lead; error?: unknown }>
}

export async function patchLead(id: string, body: Partial<Lead>) {
  const res = await fetch(apiUrl(`/api/leads/${id}`), {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  return parseJson(res) as Promise<{ lead?: Lead; error?: unknown }>
}

export type OutreachResult = {
  subject_lines: string[]
  drafts: { label: string; body: string }[]
  disclaimer?: string
  model?: string
  error?: string
  fallback?: OutreachResult
}

export async function createLeadFromPosting(body: {
  raw_posting: string
  resume_context?: string
  company_hint?: string
  url?: string
}): Promise<{
  lead?: Lead
  used_ai?: boolean
  error?: unknown
  status: number
}> {
  const res = await fetch(apiUrl('/api/leads/from-posting'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  const data = await parseJson(res)
  return { ...(data as object), status: res.status } as {
    lead?: Lead
    used_ai?: boolean
    error?: unknown
    status: number
  }
}

export async function generateOutreach(body: {
  lead_id?: string
  company?: string
  contact_name?: string | null
  role?: string | null
  url?: string | null
  notes?: string | null
  resume_context?: string | null
}): Promise<OutreachResult & { status: number }> {
  const res = await fetch(apiUrl('/api/outreach'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  const data = (await parseJson(res)) as OutreachResult & {
    fallback?: OutreachResult
  }
  if (!res.ok && data.fallback) {
    return { ...data.fallback, disclaimer: 'AI unavailable — showing templates.', status: 200 }
  }
  return { ...data, status: res.ok ? 200 : res.status }
}

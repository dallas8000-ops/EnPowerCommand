import { apiUrl } from './apiBase'
import { clearToken, getToken } from './auth'

const jsonHeaders = { 'Content-Type': 'application/json' }

async function parseJson(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

/** Authenticated API calls; redirects to /login on 401. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (
    init.body &&
    typeof init.body === 'string' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }
  const t = getToken()
  if (t) headers.set('Authorization', `Bearer ${t}`)
  const res = await fetch(apiUrl(path), { ...init, headers })
  if (res.status === 401) {
    clearToken()
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign(`${window.location.origin}/login`)
    }
  }
  return res
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
  last_contact_at: string | null
  created_at: string
  updated_at: string
}

export type Health = {
  ok: boolean
  service: string
  db: boolean
  ai: boolean
  stripe?: boolean
  auth_required?: boolean
}

export type ConversionBucket = {
  label: string
  applied_count: number
  interview_count: number
  conversion_rate: number
}

export type WeeklyAnalytics = {
  window_days: number
  summary: {
    applied_count: number
    interview_count: number
    conversion_rate: number
  }
  by_role: ConversionBucket[]
  by_source: ConversionBucket[]
}

export async function getHealth(): Promise<Health> {
  const res = await fetch(apiUrl('/api/health'))
  return parseJson(res) as Promise<Health>
}

export async function getWeeklyAnalytics(): Promise<WeeklyAnalytics> {
  const res = await apiFetch('/api/analytics/weekly')
  const data = await parseJson(res)
  return data as WeeklyAnalytics
}

export async function login(
  email: string,
  password: string
): Promise<{ token?: string; tenant_name?: string; role?: string; error?: string }> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  })
  const data = (await parseJson(res)) as { token?: string; tenant_name?: string; role?: string; error?: string }
  if (res.ok && data.token) return { token: data.token, tenant_name: data.tenant_name, role: data.role }
  return {
    error:
      typeof data.error === 'string'
        ? data.error
        : res.status === 400
          ? (data as { hint?: string }).hint ?? 'Login not available'
          : 'Login failed',
  }
}

export async function register(body: {
  agency_name: string
  email: string
  password: string
}): Promise<{ token?: string; tenant_name?: string; role?: string; plan?: string; error?: string }> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  const data = (await parseJson(res)) as { token?: string; tenant_name?: string; role?: string; plan?: string; error?: string }
  if (res.ok && data.token) return data
  return { error: typeof data.error === 'string' ? data.error : 'Registration failed' }
}

export async function getProfile(): Promise<{
  resume_text: string
  updated_at: string | null
}> {
  const res = await apiFetch('/api/profile')
  return parseJson(res) as Promise<{ resume_text: string; updated_at: string | null }>
}

export async function patchProfile(resume_text: string): Promise<void> {
  const res = await apiFetch('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify({ resume_text }),
  })
  if (!res.ok) throw new Error('Could not save profile')
}

/** Resume for AI: server profile first, then browser fallback. */
export async function getResumeContext(): Promise<string> {
  try {
    const p = await getProfile()
    if (p.resume_text?.trim()) return p.resume_text.trim()
  } catch {
    /* offline or 503 */
  }
  try {
    const { loadProfile } = await import('./profile')
    return loadProfile().resumeText.trim()
  } catch {
    return ''
  }
}

export async function listLeads(): Promise<{
  leads: Lead[]
  error?: string
  hint?: string
}> {
  const res = await apiFetch('/api/leads')
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
  const res = await apiFetch(`/api/leads/${id}`)
  const data = await parseJson(res)
  if (!res.ok) return data
  return data as { lead: Lead }
}

function describeSaveFailure(status: number, data: Record<string, unknown>): string {
  const hint = typeof data.hint === 'string' ? data.hint : ''
  const err = data.error
  if (typeof err === 'string') return hint ? `${err} — ${hint}` : err
  if (status === 0 || status >= 500)
    return hint || 'Server error — check API logs and DATABASE_URL.'
  if (status === 503)
    return hint || 'Database not configured — set DATABASE_URL and run db:init on the API.'
  if (status === 401) return 'Session expired — sign in again.'
  return hint || `Could not save (${status}).`
}

export async function createLead(body: Partial<Lead> & { company: string }): Promise<{
  lead?: Lead
  status: number
  message?: string
}> {
  try {
    const res = await apiFetch('/api/leads', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = (await parseJson(res)) as Record<string, unknown>
    const lead = data.lead as Lead | undefined
    if (res.ok && lead?.id) return { lead, status: res.status }
    return {
      status: res.status,
      message: describeSaveFailure(res.status, data),
    }
  } catch {
    return {
      status: 0,
      message:
        'Cannot reach API — run `npm run dev` from repo root (or `npm run dev:server`) with Postgres / DATABASE_URL.',
    }
  }
}

export async function patchLead(id: string, body: Partial<Lead>) {
  const res = await apiFetch(`/api/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return parseJson(res) as Promise<{ lead?: Lead; error?: unknown }>
}

export type LeadActivity = {
  id: string
  kind: string
  note: string | null
  created_at: string
}

export async function listActivities(
  leadId: string
): Promise<{ activities: LeadActivity[] }> {
  const res = await apiFetch(`/api/leads/${leadId}/activities`)
  return parseJson(res) as Promise<{ activities: LeadActivity[] }>
}

export async function postActivity(
  leadId: string,
  body: { kind: string; note?: string | null }
): Promise<{ activity?: LeadActivity }> {
  const res = await apiFetch(`/api/leads/${leadId}/activities`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return parseJson(res) as Promise<{ activity?: LeadActivity }>
}

export async function downloadLeadsCsv(): Promise<void> {
  const res = await apiFetch('/api/export/leads.csv')
  if (!res.ok) return
  const blob = await res.blob()
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = 'enpower-leads.csv'
  a.click()
  URL.revokeObjectURL(u)
}

export async function downloadActivitiesCsv(): Promise<void> {
  const res = await apiFetch('/api/export/activities.csv')
  if (!res.ok) return
  const blob = await res.blob()
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = 'enpower-activity-log.csv'
  a.click()
  URL.revokeObjectURL(u)
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
  const res = await apiFetch('/api/leads/from-posting', {
    method: 'POST',
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
  const res = await apiFetch('/api/outreach', {
    method: 'POST',
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

// --- Recruiter: Candidates ---

export type Candidate = {
  id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  location: string | null
  resume_url: string | null
  skills: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
}

export async function listCandidates(): Promise<{ candidates: Candidate[] }> {
  const res = await apiFetch('/api/candidates')
  return parseJson(res) as Promise<{ candidates: Candidate[] }>
}

export async function getCandidate(id: string): Promise<{ candidate?: Candidate; error?: string }> {
  const res = await apiFetch(`/api/candidates/${id}`)
  return parseJson(res) as Promise<{ candidate?: Candidate; error?: string }>
}

export async function createCandidate(body: Partial<Candidate> & { name: string }): Promise<{ candidate?: Candidate; error?: string }> {
  const res = await apiFetch('/api/candidates', { method: 'POST', body: JSON.stringify(body) })
  return parseJson(res) as Promise<{ candidate?: Candidate; error?: string }>
}

export async function patchCandidate(id: string, body: Partial<Candidate>): Promise<{ candidate?: Candidate; error?: string }> {
  const res = await apiFetch(`/api/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  return parseJson(res) as Promise<{ candidate?: Candidate; error?: string }>
}

export async function deleteCandidate(id: string): Promise<void> {
  await apiFetch(`/api/candidates/${id}`, { method: 'DELETE' })
}

export async function listCandidateActivities(candidateId: string): Promise<{ activities: LeadActivity[] }> {
  const res = await apiFetch(`/api/candidates/${candidateId}/activities`)
  return parseJson(res) as Promise<{ activities: LeadActivity[] }>
}

export async function postCandidateActivity(candidateId: string, body: { kind: string; note?: string | null }): Promise<{ activity?: LeadActivity }> {
  const res = await apiFetch(`/api/candidates/${candidateId}/activities`, { method: 'POST', body: JSON.stringify(body) })
  return parseJson(res) as Promise<{ activity?: LeadActivity }>
}

// --- Recruiter: Job Orders ---

export type JobOrder = {
  id: string
  client_company: string
  title: string
  location: string | null
  remote: boolean
  salary_range: string | null
  description: string | null
  status: string
  opened_at: string
  created_at: string
  updated_at: string
}

export async function listJobOrders(): Promise<{ job_orders: JobOrder[] }> {
  const res = await apiFetch('/api/job-orders')
  return parseJson(res) as Promise<{ job_orders: JobOrder[] }>
}

export async function getJobOrder(id: string): Promise<{ job_order?: JobOrder; error?: string }> {
  const res = await apiFetch(`/api/job-orders/${id}`)
  return parseJson(res) as Promise<{ job_order?: JobOrder; error?: string }>
}

export async function createJobOrder(body: Partial<JobOrder> & { client_company: string; title: string }): Promise<{ job_order?: JobOrder; error?: string }> {
  const res = await apiFetch('/api/job-orders', { method: 'POST', body: JSON.stringify(body) })
  return parseJson(res) as Promise<{ job_order?: JobOrder; error?: string }>
}

export async function patchJobOrder(id: string, body: Partial<JobOrder>): Promise<{ job_order?: JobOrder; error?: string }> {
  const res = await apiFetch(`/api/job-orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  return parseJson(res) as Promise<{ job_order?: JobOrder; error?: string }>
}

export async function deleteJobOrder(id: string): Promise<void> {
  await apiFetch(`/api/job-orders/${id}`, { method: 'DELETE' })
}

// --- Recruiter: Pipeline ---

export type Placement = {
  id: string
  stage: string
  notes: string | null
  created_at: string
  updated_at: string
  candidate: { id: string; name: string; title: string | null; email: string | null; skills: string | null }
  job_order: { id: string; client_company: string; title: string; status: string }
}

export async function getPipeline(): Promise<{ placements: Placement[]; stages: string[] }> {
  const res = await apiFetch('/api/pipeline')
  return parseJson(res) as Promise<{ placements: Placement[]; stages: string[] }>
}

export async function addToPipeline(body: { candidate_id: string; job_order_id: string; stage?: string; notes?: string }): Promise<{ placement?: Placement; error?: string }> {
  const res = await apiFetch('/api/pipeline', { method: 'POST', body: JSON.stringify(body) })
  return parseJson(res) as Promise<{ placement?: Placement; error?: string }>
}

export async function patchPlacement(id: string, body: { stage?: string; notes?: string }): Promise<{ placement?: Placement; error?: string }> {
  const res = await apiFetch(`/api/pipeline/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  return parseJson(res) as Promise<{ placement?: Placement; error?: string }>
}

export async function removePlacement(id: string): Promise<void> {
  await apiFetch(`/api/pipeline/${id}`, { method: 'DELETE' })
}

// --- Billing ---

export type BillingStatus = {
  plan: string
  trial_ends_at: string
  stripe_enabled: boolean
  has_subscription: boolean
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await apiFetch('/api/billing/status')
  return parseJson(res) as Promise<BillingStatus>
}

export async function createCheckoutSession(): Promise<{ checkout_url?: string; error?: string }> {
  const res = await apiFetch('/api/billing/checkout', { method: 'POST' })
  return parseJson(res) as Promise<{ checkout_url?: string; error?: string }>
}

export async function createBillingPortal(): Promise<{ portal_url?: string; error?: string }> {
  const res = await apiFetch('/api/billing/portal', { method: 'POST' })
  return parseJson(res) as Promise<{ portal_url?: string; error?: string }>
}

export async function refreshToken(): Promise<{ token?: string }> {
  const res = await apiFetch('/api/billing/refresh-token', { method: 'POST' })
  return parseJson(res) as Promise<{ token?: string }>
}

export type PublicJob = {
  id: string
  client_company: string
  title: string
  location: string | null
  remote: boolean
  salary_range: string | null
  description: string | null
  opened_at: string
}

export async function getPublicJobs(): Promise<{ jobs: PublicJob[] }> {
  const res = await fetch(apiUrl('/api/public/jobs'))
  return parseJson(res) as Promise<{ jobs: PublicJob[] }>
}

export async function submitPublicJob(data: {
  client_company: string
  title: string
  location?: string
  remote?: boolean
  salary_range?: string
  description?: string
  client_contact_name: string
  client_contact_email: string
  client_notes?: string
}): Promise<{ job: { id: string }; message: string }> {
  const res = await fetch(apiUrl('/api/public/jobs/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const j = await res.json() as { error?: string }
    throw new Error(j.error ?? 'Submission failed')
  }
  return res.json() as Promise<{ job: { id: string }; message: string }>
}

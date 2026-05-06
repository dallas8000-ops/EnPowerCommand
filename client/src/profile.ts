const KEY = 'enpower_profile_v1'

export type Profile = {
  /** Full resume or condensed CV — used when importing leads and generating outreach. */
  resumeText: string
  updatedAt: string
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { resumeText: '', updatedAt: '' }
    const p = JSON.parse(raw) as Profile
    return {
      resumeText: typeof p.resumeText === 'string' ? p.resumeText : '',
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
    }
  } catch {
    return { resumeText: '', updatedAt: '' }
  }
}

export function saveProfile(partial: Pick<Profile, 'resumeText'>): Profile {
  const p: Profile = {
    resumeText: partial.resumeText,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    throw new Error('localStorage_set_failed')
  }
  return p
}

export function hasResumeText(): boolean {
  return loadProfile().resumeText.trim().length > 0
}

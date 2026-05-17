import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'

type Post = { id: string; title: string; slug: string; excerpt: string | null; content: string; published: boolean; published_at: string | null; created_at: string; updated_at: string }
type AboutData = { bio: string | null; specialties: string | null; headshot_url: string | null; tagline: string | null; linkedin_url: string | null; website_url: string | null; agency_name: string }

async function getPosts(): Promise<{ posts: Post[] }> {
  const r = await apiFetch('/api/blog-posts'); return r.json() as Promise<{ posts: Post[] }>
}
async function createPost(d: { title: string; excerpt: string; content: string; published: boolean }): Promise<{ post: Post }> {
  const r = await apiFetch('/api/blog-posts', { method: 'POST', body: JSON.stringify(d) }); return r.json() as Promise<{ post: Post }>
}
async function savePost(id: string, d: Partial<{ title: string; excerpt: string; content: string; published: boolean }>): Promise<{ post: Post }> {
  const r = await apiFetch(`/api/blog-posts/${id}`, { method: 'PATCH', body: JSON.stringify(d) }); return r.json() as Promise<{ post: Post }>
}
async function removePost(id: string): Promise<void> { await apiFetch(`/api/blog-posts/${id}`, { method: 'DELETE' }) }
async function getAbout(): Promise<{ about: AboutData }> {
  const r = await apiFetch('/api/profile/about'); return r.json() as Promise<{ about: AboutData }>
}
async function saveAbout(d: Partial<AboutData>): Promise<void> { await apiFetch('/api/profile/about', { method: 'PATCH', body: JSON.stringify(d) }) }

const EMPTY_FORM = { title: '', excerpt: '', content: '', published: false }

export function BlogEditorPage() {
  const [tab, setTab] = useState<'posts' | 'about'>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Post | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [about, setAbout] = useState<Partial<AboutData>>({})
  const [aboutBusy, setAboutBusy] = useState(false)
  const [aboutMsg, setAboutMsg] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getPosts(), getAbout()])
      .then(([p, a]) => { setPosts(p.posts); setAbout(a.about ?? {}) })
      .finally(() => setLoading(false))
  }, [])

  function startEdit(p: Post) { setEditing(p); setShowNew(false); setForm({ title: p.title, excerpt: p.excerpt ?? '', content: p.content, published: p.published }) }
  function startNew() { setEditing(null); setShowNew(true); setForm(EMPTY_FORM) }

  async function onSave() {
    if (!form.title || !form.content) return
    setBusy(true); setMsg(null)
    try {
      if (editing) {
        const r = await savePost(editing.id, form)
        setPosts((prev) => prev.map((p) => p.id === editing.id ? r.post : p))
        setEditing(null)
      } else {
        const r = await createPost(form)
        setPosts((prev) => [r.post, ...prev])
        setShowNew(false)
      }
      setForm(EMPTY_FORM); setMsg('Saved.')
    } catch { setMsg('Failed to save.') }
    finally { setBusy(false) }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this post?')) return
    await removePost(id)
    setPosts((prev) => prev.filter((p) => p.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  async function onSaveAbout() {
    setAboutBusy(true); setAboutMsg(null)
    try { await saveAbout(about); setAboutMsg('Saved.') }
    catch { setAboutMsg('Failed to save.') }
    finally { setAboutBusy(false) }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-header">
        <div>
          <p className="eyebrow">Public presence</p>
          <h1>Blog &amp; About</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="/about" target="_blank" rel="noreferrer" className="btn ghost" style={{ textDecoration: 'none', fontSize: '0.82rem' }}>Preview About →</a>
          <a href="/blog" target="_blank" rel="noreferrer" className="btn ghost" style={{ textDecoration: 'none', fontSize: '0.82rem' }}>Preview Blog →</a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
        <button className={`btn ${tab === 'posts' ? 'primary' : 'ghost'} small`} onClick={() => setTab('posts')}>Blog posts</button>
        <button className={`btn ${tab === 'about' ? 'primary' : 'ghost'} small`} onClick={() => setTab('about')}>About me</button>
      </div>

      {tab === 'about' && (
        <div className="form-card">
          <h2 style={{ marginBottom: '1rem' }}>Your public profile</h2>
          <p className="muted small" style={{ marginBottom: '1rem' }}>
            This appears on your public <Link to="/about">About page</Link>. Potential clients see this when they look you up.
          </p>
          <div className="grid-form">
            <label className="full">
              Tagline / headline
              <input value={about.tagline ?? ''} onChange={(e) => setAbout((a) => ({ ...a, tagline: e.target.value }))} placeholder="e.g. Senior Technical Recruiter · 10 years placing top engineers" />
            </label>
            <label className="full">
              Bio
              <textarea rows={7} value={about.bio ?? ''} onChange={(e) => setAbout((a) => ({ ...a, bio: e.target.value }))} placeholder="Tell clients who you are, your background, your approach, and why they should work with you…" />
            </label>
            <label className="full">
              Specialties (comma-separated)
              <input value={about.specialties ?? ''} onChange={(e) => setAbout((a) => ({ ...a, specialties: e.target.value }))} placeholder="Software Engineering, Finance, Healthcare, Executive Search…" />
            </label>
            <label>
              Headshot URL
              <input value={about.headshot_url ?? ''} onChange={(e) => setAbout((a) => ({ ...a, headshot_url: e.target.value }))} placeholder="https://…" />
            </label>
            <label>
              LinkedIn URL
              <input value={about.linkedin_url ?? ''} onChange={(e) => setAbout((a) => ({ ...a, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/yourname" />
            </label>
            <label>
              Website URL
              <input value={about.website_url ?? ''} onChange={(e) => setAbout((a) => ({ ...a, website_url: e.target.value }))} placeholder="https://yoursite.com" />
            </label>
          </div>
          {about.headshot_url && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src={about.headshot_url} alt="Preview" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
              <p className="muted small">Photo preview</p>
            </div>
          )}
          {aboutMsg && <p className="muted small" style={{ marginTop: '0.5rem', color: aboutMsg === 'Saved.' ? '#22c55e' : '#f87171' }}>{aboutMsg}</p>}
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn primary" onClick={onSaveAbout} disabled={aboutBusy}>{aboutBusy ? 'Saving…' : 'Save profile'}</button>
          </div>
        </div>
      )}

      {tab === 'posts' && (
        <>
          {(showNew || editing) && (
            <div className="form-card" style={{ marginBottom: '1.5rem' }}>
              <h2>{editing ? 'Edit post' : 'New post'}</h2>
              <div className="grid-form">
                <label className="full">
                  Title
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. How to hire a great software engineer in 2025" />
                </label>
                <label className="full">
                  Excerpt (shown in listing)
                  <input value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} placeholder="One-sentence summary…" />
                </label>
                <label className="full">
                  Content
                  <textarea rows={14} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Write your article here. Plain text, paragraphs, tips, insights…" />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} />
                  Publish now (visible to public)
                </label>
              </div>
              {msg && <p className="muted small" style={{ marginTop: '0.5rem', color: msg === 'Saved.' ? '#22c55e' : '#f87171' }}>{msg}</p>}
              <div className="actions" style={{ marginTop: '0.75rem' }}>
                <button className="btn primary" onClick={onSave} disabled={busy || !form.title || !form.content}>
                  {busy ? 'Saving…' : 'Save post'}
                </button>
                <button className="btn ghost" onClick={() => { setEditing(null); setShowNew(false) }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn primary" onClick={startNew}>+ New post</button>
          </div>

          {posts.length === 0 && !showNew && (
            <p className="muted">No posts yet. Click "New post" to write your first article.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {posts.map((p) => (
              <div key={p.id} className="form-card" style={{ padding: '0.8rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600 }}>{p.title}</p>
                    {p.excerpt && <p className="muted small">{p.excerpt}</p>}
                    <p className="muted small" style={{ marginTop: '0.2rem' }}>
                      {new Date(p.created_at).toLocaleDateString()} ·{' '}
                      <span style={{ color: p.published ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                        {p.published ? 'Published' : 'Draft'}
                      </span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                    <button className="btn ghost small" onClick={() => startEdit(p)}>Edit</button>
                    {!p.published && (
                      <button className="btn ghost small" onClick={async () => { const r = await savePost(p.id, { published: true }); setPosts((prev) => prev.map((x) => x.id === p.id ? r.post : x)) }}>Publish</button>
                    )}
                    <button className="btn ghost small" style={{ color: '#f87171' }} onClick={() => onDelete(p.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

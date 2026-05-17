import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

type PostSummary = { id: string; title: string; slug: string; excerpt: string | null; published_at: string | null; created_at: string }
type PostFull = PostSummary & { content: string }

function BlogList() {
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/public/blog')
      .then((r) => r.json())
      .then((d: { posts: PostSummary[] }) => setPosts(d.posts ?? []))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <p className="eyebrow">Insights</p>
      <h1>Blog</h1>
      <p className="muted" style={{ marginBottom: '1.75rem' }}>Thoughts on recruiting, hiring, and the talent market.</p>

      {loading && <p className="muted">Loading…</p>}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__icon">✍️</p>
          <p className="empty-state__title">No posts yet</p>
          <p className="empty-state__desc">Check back soon for articles and insights.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {posts.map((p) => (
          <article key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
            <Link to={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
              <h2 style={{ marginBottom: '0.35rem', color: 'var(--text)', fontSize: '1.25rem', fontWeight: 700 }}>{p.title}</h2>
            </Link>
            <p className="muted small" style={{ marginBottom: '0.6rem' }}>
              {new Date(p.published_at ?? p.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {p.excerpt && <p style={{ lineHeight: 1.7, color: 'var(--text-muted)' }}>{p.excerpt}</p>}
            <Link to={`/blog/${p.slug}`} style={{ display: 'inline-block', marginTop: '0.6rem', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Read more →
            </Link>
          </article>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
        <Link to="/about" className="btn ghost" style={{ textDecoration: 'none' }}>About me</Link>
        <Link to="/jobs" className="btn ghost" style={{ textDecoration: 'none' }}>Open jobs</Link>
      </div>
    </div>
  )
}

function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<PostFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/public/blog/${slug}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then((d: { post: PostFull } | null) => { if (d) setPost(d.post) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="page" style={{ maxWidth: 720 }}><p className="muted">Loading…</p></div>
  if (notFound || !post) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <p className="muted">Post not found. <Link to="/blog">Back to blog</Link></p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <Link to="/blog" className="muted small" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>← Back to blog</Link>
      <article>
        <h1 style={{ marginBottom: '0.4rem', lineHeight: 1.3 }}>{post.title}</h1>
        <p className="muted small" style={{ marginBottom: '1.5rem' }}>
          Published {new Date(post.published_at ?? post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        {post.excerpt && (
          <p style={{ fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1.5rem', borderLeft: '3px solid var(--accent)', paddingLeft: '1rem' }}>
            {post.excerpt}
          </p>
        )}
        <div style={{ lineHeight: 1.85, fontSize: '1rem', whiteSpace: 'pre-wrap' }}>{post.content}</div>
      </article>

      <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
        <Link to="/blog" className="btn ghost" style={{ textDecoration: 'none' }}>← More posts</Link>
        <Link to="/about" className="btn ghost" style={{ textDecoration: 'none' }}>About me</Link>
        <Link to="/jobs" className="btn primary" style={{ textDecoration: 'none' }}>Open jobs</Link>
      </div>
    </div>
  )
}

export function PublicBlogPage() { return <BlogList /> }
export function PublicBlogPostPage() { return <BlogPost /> }

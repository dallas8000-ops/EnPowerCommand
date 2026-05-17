import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

function slugify(s: string): string {
  return s.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const postSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  published: z.boolean().optional(),
});

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function registerBlogRoutes(app: Express): void {
  app.get("/api/public/about", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const tenantId = process.env.PUBLIC_TENANT_ID ?? null;
    if (!tenantId) { res.status(404).json({ error: "Not configured" }); return; }

    const r = await pool.query(
      `SELECT t.name AS agency_name, t.id AS tenant_id,
              p.contact_email, p.contact_phone, p.website_url,
              p.bio, p.specialties, p.headshot_url, p.tagline, p.linkedin_url
       FROM tenants t
       LEFT JOIN tenant_profiles p ON p.tenant_id = t.id
       WHERE t.id = $1`,
      [tenantId]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ about: r.rows[0] });
  });

  app.get("/api/public/blog", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const tenantId = process.env.PUBLIC_TENANT_ID ?? null;
    if (!tenantId) { res.json({ posts: [] }); return; }

    const r = await pool.query(
      `SELECT id, title, slug, excerpt, published_at, created_at
       FROM blog_posts WHERE tenant_id = $1 AND published = true
       ORDER BY published_at DESC NULLS LAST`,
      [tenantId]
    );
    res.json({ posts: r.rows });
  });

  app.get("/api/public/blog/:slug", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const tenantId = process.env.PUBLIC_TENANT_ID ?? null;
    const r = await pool.query(
      `SELECT id, title, slug, excerpt, content, published_at, created_at
       FROM blog_posts WHERE slug = $1 AND published = true ${tenantId ? "AND tenant_id = $2" : ""}`,
      tenantId ? [req.params.slug, tenantId] : [req.params.slug]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ post: r.rows[0] });
  });

  app.get("/api/blog-posts", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT id, title, slug, excerpt, published, published_at, created_at, updated_at
       FROM blog_posts WHERE tenant_id IS NOT DISTINCT FROM $1
       ORDER BY created_at DESC`,
      [req.tenantId ?? null]
    );
    res.json({ posts: r.rows });
  });

  app.post("/api/blog-posts", async (req: Request, res: Response) => {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const b = parsed.data;
    const slug = slugify(b.title);
    const publishedAt = b.published ? new Date().toISOString() : null;
    const r = await pool.query(
      `INSERT INTO blog_posts (tenant_id, title, slug, excerpt, content, published, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, title, slug, excerpt, content, published, published_at, created_at, updated_at`,
      [req.tenantId ?? null, b.title, slug, b.excerpt ?? null, b.content, b.published ?? false, publishedAt]
    );
    res.status(201).json({ post: r.rows[0] });
  });

  app.patch("/api/blog-posts/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const existing = await pool.query(
      `SELECT id, published FROM blog_posts WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
      [req.params.id, req.tenantId ?? null]
    );
    if (existing.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    const cur = existing.rows[0] as { id: string; published: boolean };
    const b = req.body as { title?: string; excerpt?: string; content?: string; published?: boolean };
    const nowPublishing = b.published === true && !cur.published;
    const publishedAt = nowPublishing ? new Date().toISOString() : undefined;

    const r = await pool.query(
      `UPDATE blog_posts SET
         title = COALESCE($1, title),
         excerpt = COALESCE($2, excerpt),
         content = COALESCE($3, content),
         published = COALESCE($4, published),
         published_at = COALESCE($5, published_at),
         updated_at = now()
       WHERE id = $6 RETURNING id, title, slug, excerpt, content, published, published_at, updated_at`,
      [b.title ?? null, b.excerpt ?? null, b.content ?? null, b.published ?? null, publishedAt ?? null, req.params.id]
    );
    res.json({ post: r.rows[0] });
  });

  app.delete("/api/blog-posts/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    await pool.query(
      `DELETE FROM blog_posts WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
      [req.params.id, req.tenantId ?? null]
    );
    res.json({ ok: true });
  });

  app.patch("/api/profile/about", async (req: Request, res: Response) => {
    const { bio, specialties, headshot_url, tagline, linkedin_url, website_url } = req.body as {
      bio?: string; specialties?: string; headshot_url?: string; tagline?: string; linkedin_url?: string; website_url?: string;
    };
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const tid = req.tenantId ?? null;
    await pool.query(
      `INSERT INTO tenant_profiles (tenant_id, bio, specialties, headshot_url, tagline, linkedin_url, website_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id) DO UPDATE SET
         bio = COALESCE(EXCLUDED.bio, tenant_profiles.bio),
         specialties = COALESCE(EXCLUDED.specialties, tenant_profiles.specialties),
         headshot_url = COALESCE(EXCLUDED.headshot_url, tenant_profiles.headshot_url),
         tagline = COALESCE(EXCLUDED.tagline, tenant_profiles.tagline),
         linkedin_url = COALESCE(EXCLUDED.linkedin_url, tenant_profiles.linkedin_url),
         website_url = COALESCE(EXCLUDED.website_url, tenant_profiles.website_url)`,
      [tid, bio ?? null, specialties ?? null, headshot_url ?? null, tagline ?? null, linkedin_url ?? null, website_url ?? null]
    );
    res.json({ ok: true });
  });

  app.get("/api/profile/about", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT p.bio, p.specialties, p.headshot_url, p.tagline, p.linkedin_url, p.website_url, t.name AS agency_name
       FROM tenants t LEFT JOIN tenant_profiles p ON p.tenant_id = t.id
       WHERE t.id IS NOT DISTINCT FROM $1`,
      [req.tenantId ?? null]
    );
    res.json({ about: r.rows[0] ?? {} });
  });
}

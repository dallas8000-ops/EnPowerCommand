import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { getPool } from "../db.js";

function hashPassword(pass: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pass, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(pass: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = scryptSync(pass, salt, 64);
    return timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch { return false; }
}

function signClientToken(payload: { clientId: string; tenantId: string; email: string; company: string | null }): string {
  const secret = process.env.AUTH_SECRET ?? "dev-secret";
  return jwt.sign({ sub: payload.clientId, tenantId: payload.tenantId, email: payload.email, company: payload.company, role: "client" }, secret, { expiresIn: "30d" });
}

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.string().optional(),
  tenant_id: z.string().uuid(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export function registerClientPortalRoutes(app: Express): void {
  app.post("/api/client/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const b = parsed.data;

    const tenantCheck = await pool.query(`SELECT id FROM tenants WHERE id = $1`, [b.tenant_id]);
    if (tenantCheck.rowCount === 0) { res.status(400).json({ error: "Invalid tenant" }); return; }

    const dup = await pool.query(`SELECT id FROM client_contacts WHERE email = $1`, [b.email]);
    if ((dup.rowCount ?? 0) > 0) { res.status(409).json({ error: "Email already registered" }); return; }

    const hash = hashPassword(b.password);
    const r = await pool.query(
      `INSERT INTO client_contacts (tenant_id, name, email, password_hash, company) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, company`,
      [b.tenant_id, b.name, b.email, hash, b.company ?? null]
    );
    const contact = r.rows[0] as { id: string; name: string; email: string; company: string | null };
    const token = signClientToken({ clientId: contact.id, tenantId: b.tenant_id, email: contact.email, company: contact.company });
    res.status(201).json({ token, name: contact.name, email: contact.email });
  });

  app.post("/api/client/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const r = await pool.query(
      `SELECT id, tenant_id, name, email, company, password_hash FROM client_contacts WHERE email = $1`,
      [parsed.data.email]
    );
    if (r.rowCount === 0) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const c = r.rows[0] as { id: string; tenant_id: string; name: string; email: string; company: string | null; password_hash: string };
    if (!verifyPassword(parsed.data.password, c.password_hash)) { res.status(401).json({ error: "Invalid credentials" }); return; }

    await pool.query(`UPDATE client_contacts SET last_login_at = now() WHERE id = $1`, [c.id]);
    const token = signClientToken({ clientId: c.id, tenantId: c.tenant_id, email: c.email, company: c.company });
    res.json({ token, name: c.name, email: c.email, company: c.company });
  });

  app.get("/api/client/jobs", async (req: Request, res: Response) => {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    let payload: { tenantId: string; role: string };
    try {
      payload = jwt.verify(token, process.env.AUTH_SECRET ?? "dev-secret") as typeof payload;
    } catch { res.status(401).json({ error: "Invalid token" }); return; }
    if (payload.role !== 'client') { res.status(403).json({ error: "Forbidden" }); return; }

    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const r = await pool.query(
      `SELECT j.id, j.title, j.client_company, j.location, j.remote, j.salary_range, j.status, j.opened_at,
              COUNT(a.id) AS application_count,
              COUNT(p.id) AS candidate_count
       FROM job_orders j
       LEFT JOIN applications a ON a.job_order_id = j.id
       LEFT JOIN placements p ON p.job_order_id = j.id
       WHERE j.tenant_id = $1
       GROUP BY j.id
       ORDER BY j.opened_at DESC`,
      [payload.tenantId]
    );
    res.json({ jobs: r.rows });
  });

  app.get("/api/client/jobs/:id/candidates", async (req: Request, res: Response) => {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    let payload: { tenantId: string; role: string };
    try {
      payload = jwt.verify(token, process.env.AUTH_SECRET ?? "dev-secret") as typeof payload;
    } catch { res.status(401).json({ error: "Invalid token" }); return; }
    if (payload.role !== 'client') { res.status(403).json({ error: "Forbidden" }); return; }

    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const jobCheck = await pool.query(`SELECT id FROM job_orders WHERE id = $1 AND tenant_id = $2`, [req.params.id, payload.tenantId]);
    if (jobCheck.rowCount === 0) { res.status(404).json({ error: "Job not found" }); return; }

    const r = await pool.query(
      `SELECT c.id, c.name, c.title, c.location, c.skills, p.stage, p.notes, p.created_at AS submitted_at
       FROM placements p
       JOIN candidates c ON c.id = p.candidate_id
       WHERE p.job_order_id = $1
       ORDER BY p.created_at DESC`,
      [req.params.id]
    );
    res.json({ candidates: r.rows });
  });

  app.get("/api/email-templates", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT id, name, subject, body, updated_at FROM email_templates WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY name`,
      [req.tenantId ?? null]
    );
    res.json({ templates: r.rows });
  });

  app.post("/api/email-templates", async (req: Request, res: Response) => {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `INSERT INTO email_templates (tenant_id, name, subject, body) VALUES ($1,$2,$3,$4) RETURNING id, name, subject, body`,
      [req.tenantId ?? null, parsed.data.name, parsed.data.subject, parsed.data.body]
    );
    res.status(201).json({ template: r.rows[0] });
  });

  app.patch("/api/email-templates/:id", async (req: Request, res: Response) => {
    const { name, subject, body } = req.body as { name?: string; subject?: string; body?: string };
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `UPDATE email_templates SET name = COALESCE($1, name), subject = COALESCE($2, subject), body = COALESCE($3, body), updated_at = now()
       WHERE id = $4 AND tenant_id IS NOT DISTINCT FROM $5 RETURNING id, name, subject, body`,
      [name ?? null, subject ?? null, body ?? null, req.params.id, req.tenantId ?? null]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ template: r.rows[0] });
  });

  app.delete("/api/email-templates/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    await pool.query(`DELETE FROM email_templates WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`, [req.params.id, req.tenantId ?? null]);
    res.json({ ok: true });
  });

  app.get("/api/webhooks", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(`SELECT id, url, events, active, created_at FROM webhook_endpoints WHERE tenant_id IS NOT DISTINCT FROM $1`, [req.tenantId ?? null]);
    res.json({ webhooks: r.rows });
  });

  app.post("/api/webhooks", async (req: Request, res: Response) => {
    const { url, events } = req.body as { url?: string; events?: string[] };
    if (!url) { res.status(400).json({ error: "url required" }); return; }
    const secret = randomBytes(24).toString("hex");
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `INSERT INTO webhook_endpoints (tenant_id, url, events, secret) VALUES ($1,$2,$3,$4) RETURNING id, url, events, secret, active`,
      [req.tenantId ?? null, url, events ?? [], secret]
    );
    res.status(201).json({ webhook: r.rows[0] });
  });

  app.delete("/api/webhooks/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    await pool.query(`DELETE FROM webhook_endpoints WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`, [req.params.id, req.tenantId ?? null]);
    res.json({ ok: true });
  });
}

export async function fireWebhook(tenantId: string, event: string, payload: unknown): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const r = await pool.query(
    `SELECT url, secret FROM webhook_endpoints WHERE tenant_id = $1 AND active = true AND $2 = ANY(events)`,
    [tenantId, event]
  );
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const row of r.rows as { url: string; secret: string }[]) {
    const sig = createHmac("sha256", row.secret).update(body).digest("hex");
    fetch(row.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-RecruitCommand-Signature": sig },
      body,
    }).catch((e: unknown) => console.error("Webhook delivery failed:", e));
  }
}

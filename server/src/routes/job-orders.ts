import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const jobOrderBody = z.object({
  client_company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional().nullable(),
  remote: z.boolean().optional(),
  salary_range: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["open", "filled", "canceled", "on_hold", "pending"]).optional(),
});

const jobOrderPatch = jobOrderBody.partial();

export function registerJobOrderRoutes(app: Express): void {
  app.get("/api/job-orders", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT id, client_company, title, location, remote, salary_range, description, status,
              source, client_contact_name, client_contact_email, client_notes,
              opened_at, created_at, updated_at
       FROM job_orders WHERE tenant_id = $1 ORDER BY updated_at DESC`,
      [req.tenantId]
    );
    res.json({ job_orders: r.rows });
  });

  app.get("/api/job-orders/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT id, client_company, title, location, remote, salary_range, description, status, opened_at, created_at, updated_at
       FROM job_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ job_order: r.rows[0] });
  });

  app.post("/api/job-orders", async (req: Request, res: Response) => {
    const parsed = jobOrderBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;
    const r = await pool.query(
      `INSERT INTO job_orders (tenant_id, client_company, title, location, remote, salary_range, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'open'))
       RETURNING id, client_company, title, location, remote, salary_range, description, status, opened_at, created_at, updated_at`,
      [
        req.tenantId,
        b.client_company,
        b.title,
        b.location ?? null,
        b.remote ?? false,
        b.salary_range ?? null,
        b.description ?? null,
        b.status ?? null,
      ]
    );
    res.status(201).json({ job_order: r.rows[0] });
  });

  app.patch("/api/job-orders/:id", async (req: Request, res: Response) => {
    const parsed = jobOrderPatch.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;
    const allowed = new Set(["client_company", "title", "location", "remote", "salary_range", "description", "status"]);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of Object.keys(b) as (keyof typeof b)[]) {
      if (!allowed.has(key)) continue;
      const v = b[key];
      if (v !== undefined) { fields.push(`${key} = $${i++}`); values.push(v); }
    }
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    fields.push(`updated_at = now()`);
    values.push(req.params.id, req.tenantId);
    const r = await pool.query(
      `UPDATE job_orders SET ${fields.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}
       RETURNING id, client_company, title, location, remote, salary_range, description, status, opened_at, created_at, updated_at`,
      values
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ job_order: r.rows[0] });
  });

  app.delete("/api/job-orders/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `DELETE FROM job_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });
}

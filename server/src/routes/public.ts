import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

function getPublicTenantId(): string | null {
  return process.env.PUBLIC_TENANT_ID ?? null;
}

const submitSchema = z.object({
  client_company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salary_range: z.string().optional(),
  description: z.string().optional(),
  client_contact_name: z.string().min(1),
  client_contact_email: z.string().email(),
  client_notes: z.string().optional(),
});

export function registerPublicRoutes(app: Express): void {
  app.get("/api/public/jobs", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const tenantId = getPublicTenantId();
    const r = tenantId
      ? await pool.query(
          `SELECT id, client_company, title, location, remote, salary_range, description, opened_at
           FROM job_orders
           WHERE tenant_id = $1 AND status = 'open'
           ORDER BY opened_at DESC`,
          [tenantId]
        )
      : await pool.query(
          `SELECT id, client_company, title, location, remote, salary_range, description, opened_at
           FROM job_orders
           WHERE status = 'open'
           ORDER BY opened_at DESC`
        );

    res.json({ jobs: r.rows });
  });

  app.post("/api/public/jobs/submit", async (req: Request, res: Response) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const tenantId = getPublicTenantId();
    if (!tenantId) {
      res.status(503).json({ error: "Public job board not configured", hint: "Set PUBLIC_TENANT_ID on the server." });
      return;
    }

    const b = parsed.data;
    const r = await pool.query(
      `INSERT INTO job_orders
         (tenant_id, client_company, title, location, remote, salary_range,
          description, source, client_contact_name, client_contact_email,
          client_notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'client',$8,$9,$10,'pending')
       RETURNING id, client_company, title, status`,
      [
        tenantId, b.client_company, b.title,
        b.location ?? null, b.remote ?? false,
        b.salary_range ?? null, b.description ?? null,
        b.client_contact_name, b.client_contact_email,
        b.client_notes ?? null,
      ]
    );

    res.status(201).json({ job: r.rows[0], message: "Submission received. We will be in touch shortly." });
  });

  app.get("/api/public/jobs/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const r = await pool.query(
      `SELECT id, client_company, title, location, remote, salary_range, description, opened_at
       FROM job_orders WHERE id = $1 AND status = 'open'`,
      [req.params.id]
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({ job: r.rows[0] });
  });
}

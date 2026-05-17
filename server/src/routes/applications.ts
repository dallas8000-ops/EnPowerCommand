import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const applySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  resume_text: z.string().optional(),
  cover_letter: z.string().optional(),
});

export function registerApplicationRoutes(app: Express): void {
  app.post("/api/public/jobs/:id/apply", async (req: Request, res: Response) => {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const jobRes = await pool.query(
      `SELECT id, tenant_id, title, client_company FROM job_orders WHERE id = $1 AND status = 'open'`,
      [req.params.id]
    );
    if (jobRes.rowCount === 0) { res.status(404).json({ error: "Job not found or closed" }); return; }
    const job = jobRes.rows[0] as { id: string; tenant_id: string; title: string; client_company: string };

    const b = parsed.data;

    const dupCheck = await pool.query(
      `SELECT id FROM applications WHERE job_order_id = $1 AND email = $2`,
      [job.id, b.email]
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      res.status(409).json({ error: "You have already applied for this position." });
      return;
    }

    let candidateId: string | null = null;
    const existingCand = await pool.query(
      `SELECT id FROM candidates WHERE tenant_id = $1 AND email = $2`,
      [job.tenant_id, b.email]
    );
    if ((existingCand.rowCount ?? 0) > 0) {
      candidateId = (existingCand.rows[0] as { id: string }).id;
    } else {
      const newCand = await pool.query(
        `INSERT INTO candidates (tenant_id, name, email, phone, location, notes, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', 'application') RETURNING id`,
        [job.tenant_id, b.name, b.email, b.phone ?? null, b.location ?? null, b.resume_text ?? null]
      );
      candidateId = (newCand.rows[0] as { id: string }).id;
    }

    const appRes = await pool.query(
      `INSERT INTO applications (tenant_id, job_order_id, candidate_id, name, email, phone, location, resume_text, cover_letter)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [job.tenant_id, job.id, candidateId, b.name, b.email, b.phone ?? null, b.location ?? null, b.resume_text ?? null, b.cover_letter ?? null]
    );

    if (candidateId) {
      await pool.query(
        `INSERT INTO candidate_activities (candidate_id, tenant_id, kind, note)
         VALUES ($1, $2, 'applied', $3)`,
        [candidateId, job.tenant_id, `Applied for ${job.title} at ${job.client_company}`]
      );
    }

    res.status(201).json({ ok: true, application_id: (appRes.rows[0] as { id: string }).id });
  });

  app.get("/api/applications", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const tid = req.tenantId ?? null;
    const jobId = req.query.job_id as string | undefined;

    const r = await pool.query(
      `SELECT a.id, a.name, a.email, a.phone, a.location, a.resume_text, a.cover_letter, a.status, a.created_at,
              a.candidate_id, a.job_order_id,
              j.title AS job_title, j.client_company
       FROM applications a
       JOIN job_orders j ON j.id = a.job_order_id
       WHERE a.tenant_id IS NOT DISTINCT FROM $1 ${jobId ? 'AND a.job_order_id = $2' : ''}
       ORDER BY a.created_at DESC LIMIT 200`,
      jobId ? [tid, jobId] : [tid]
    );
    res.json({ applications: r.rows });
  });

  app.patch("/api/applications/:id", async (req: Request, res: Response) => {
    const { status } = req.body as { status?: string };
    if (!status) { res.status(400).json({ error: "status required" }); return; }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `UPDATE applications SET status = $1 WHERE id = $2 AND tenant_id IS NOT DISTINCT FROM $3 RETURNING id, status`,
      [status, req.params.id, req.tenantId ?? null]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ application: r.rows[0] });
  });
}

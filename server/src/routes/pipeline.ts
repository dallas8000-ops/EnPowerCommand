import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const STAGES = ["sourced", "screening", "submitted", "interview", "offer", "placed", "rejected"] as const;

const placementBody = z.object({
  candidate_id: z.string().uuid(),
  job_order_id: z.string().uuid(),
  stage: z.enum(STAGES).optional(),
  notes: z.string().optional().nullable(),
});

const placementPatch = z.object({
  stage: z.enum(STAGES).optional(),
  notes: z.string().optional().nullable(),
});

export function registerPipelineRoutes(app: Express): void {
  app.get("/api/pipeline", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });

    const r = await pool.query(
      `SELECT p.id, p.stage, p.notes, p.created_at, p.updated_at,
              c.id AS candidate_id, c.name AS candidate_name, c.title AS candidate_title,
              c.email AS candidate_email, c.skills AS candidate_skills,
              j.id AS job_order_id, j.client_company, j.title AS job_title, j.status AS job_status
       FROM placements p
       JOIN candidates c ON c.id = p.candidate_id
       JOIN job_orders j ON j.id = p.job_order_id
       WHERE p.tenant_id = $1
       ORDER BY p.updated_at DESC`,
      [req.tenantId]
    );

    const placements = r.rows.map((row) => ({
      id: row.id,
      stage: row.stage,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      candidate: {
        id: row.candidate_id,
        name: row.candidate_name,
        title: row.candidate_title,
        email: row.candidate_email,
        skills: row.candidate_skills,
      },
      job_order: {
        id: row.job_order_id,
        client_company: row.client_company,
        title: row.job_title,
        status: row.job_status,
      },
    }));

    res.json({ placements, stages: STAGES });
  });

  app.get("/api/pipeline/by-job/:jobOrderId", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT p.id, p.stage, p.notes, p.updated_at,
              c.id AS candidate_id, c.name AS candidate_name, c.title AS candidate_title,
              c.email AS candidate_email, c.skills AS candidate_skills
       FROM placements p
       JOIN candidates c ON c.id = p.candidate_id
       WHERE p.job_order_id = $1 AND p.tenant_id = $2
       ORDER BY p.updated_at DESC`,
      [req.params.jobOrderId, req.tenantId]
    );
    res.json({ placements: r.rows });
  });

  app.post("/api/pipeline", async (req: Request, res: Response) => {
    const parsed = placementBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;

    const candCheck = await pool.query(`SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2`, [b.candidate_id, req.tenantId]);
    if (candCheck.rowCount === 0) return res.status(404).json({ error: "Candidate not found" });

    const jobCheck = await pool.query(`SELECT id FROM job_orders WHERE id = $1 AND tenant_id = $2`, [b.job_order_id, req.tenantId]);
    if (jobCheck.rowCount === 0) return res.status(404).json({ error: "Job order not found" });

    const r = await pool.query(
      `INSERT INTO placements (tenant_id, candidate_id, job_order_id, stage, notes)
       VALUES ($1, $2, $3, COALESCE($4, 'sourced'), $5)
       ON CONFLICT (candidate_id, job_order_id) DO UPDATE SET stage = EXCLUDED.stage, notes = EXCLUDED.notes, updated_at = now()
       RETURNING id, candidate_id, job_order_id, stage, notes, created_at, updated_at`,
      [req.tenantId, b.candidate_id, b.job_order_id, b.stage ?? null, b.notes ?? null]
    );
    res.status(201).json({ placement: r.rows[0] });
  });

  app.patch("/api/pipeline/:id", async (req: Request, res: Response) => {
    const parsed = placementPatch.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (b.stage !== undefined) { fields.push(`stage = $${i++}`); values.push(b.stage); }
    if (b.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(b.notes); }
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    fields.push(`updated_at = now()`);
    values.push(req.params.id, req.tenantId);
    const r = await pool.query(
      `UPDATE placements SET ${fields.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}
       RETURNING id, candidate_id, job_order_id, stage, notes, created_at, updated_at`,
      values
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ placement: r.rows[0] });
  });

  app.delete("/api/pipeline/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `DELETE FROM placements WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });
}

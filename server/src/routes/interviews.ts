import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const createBody = z.object({
  candidate_id: z.string().uuid(),
  job_order_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const patchBody = z.object({
  scheduled_at: z.string().datetime().optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["scheduled", "completed", "canceled", "no_show"]).optional(),
});

export function registerInterviewRoutes(app: Express): void {
  app.get("/api/interviews", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const tid = req.tenantId ?? null;
    const upcoming = req.query.upcoming === "true";

    const where = upcoming
      ? `WHERE i.tenant_id IS NOT DISTINCT FROM $1 AND i.scheduled_at >= now() AND i.status = 'scheduled'`
      : `WHERE i.tenant_id IS NOT DISTINCT FROM $1`;

    const r = await pool.query(
      `SELECT i.id, i.scheduled_at, i.duration_minutes, i.location, i.notes, i.status,
              i.candidate_id, c.name AS candidate_name, c.email AS candidate_email,
              i.job_order_id, j.title AS job_title, j.client_company
       FROM interviews i
       JOIN candidates c ON c.id = i.candidate_id
       JOIN job_orders j ON j.id = i.job_order_id
       ${where}
       ORDER BY i.scheduled_at ASC
       LIMIT 100`,
      [tid]
    );
    res.json({ interviews: r.rows });
  });

  app.post("/api/interviews", async (req: Request, res: Response) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const { candidate_id, job_order_id, scheduled_at, duration_minutes, location, notes } = parsed.data;
    const tid = req.tenantId ?? null;

    const r = await pool.query(
      `INSERT INTO interviews (tenant_id, candidate_id, job_order_id, scheduled_at, duration_minutes, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, scheduled_at, duration_minutes, location, notes, status, candidate_id, job_order_id, created_at`,
      [tid, candidate_id, job_order_id, scheduled_at, duration_minutes, location ?? null, notes ?? null]
    );
    res.status(201).json({ interview: r.rows[0] });
  });

  app.patch("/api/interviews/:id", async (req: Request, res: Response) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const d = parsed.data;
    const tid = req.tenantId ?? null;

    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (d.scheduled_at !== undefined) { fields.push(`scheduled_at = $${i++}`); vals.push(d.scheduled_at); }
    if (d.duration_minutes !== undefined) { fields.push(`duration_minutes = $${i++}`); vals.push(d.duration_minutes); }
    if (d.location !== undefined) { fields.push(`location = $${i++}`); vals.push(d.location); }
    if (d.notes !== undefined) { fields.push(`notes = $${i++}`); vals.push(d.notes); }
    if (d.status !== undefined) { fields.push(`status = $${i++}`); vals.push(d.status); }
    if (fields.length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
    fields.push(`updated_at = now()`);
    vals.push(req.params.id, tid);

    const r = await pool.query(
      `UPDATE interviews SET ${fields.join(", ")} WHERE id = $${i++} AND tenant_id IS NOT DISTINCT FROM $${i} RETURNING *`,
      vals
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Interview not found" }); return; }
    res.json({ interview: r.rows[0] });
  });

  app.delete("/api/interviews/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    await pool.query(
      `DELETE FROM interviews WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
      [req.params.id, req.tenantId ?? null]
    );
    res.json({ ok: true });
  });
}

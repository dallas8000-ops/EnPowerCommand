import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const candidateBody = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  resume_url: z.string().optional().nullable(),
  skills: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["active", "placed", "inactive"]).optional(),
});

const candidatePatch = candidateBody.partial();

export function registerCandidateRoutes(app: Express): void {
  app.get("/api/candidates", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT id, name, email, phone, title, location, resume_url, skills, notes, status, created_at, updated_at
       FROM candidates WHERE tenant_id = $1 ORDER BY updated_at DESC`,
      [req.tenantId]
    );
    res.json({ candidates: r.rows });
  });

  app.get("/api/candidates/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT id, name, email, phone, title, location, resume_url, skills, notes, status, created_at, updated_at
       FROM candidates WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ candidate: r.rows[0] });
  });

  app.post("/api/candidates", async (req: Request, res: Response) => {
    const parsed = candidateBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;
    const r = await pool.query(
      `INSERT INTO candidates (tenant_id, name, email, phone, title, location, resume_url, skills, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'active'))
       RETURNING id, name, email, phone, title, location, resume_url, skills, notes, status, created_at, updated_at`,
      [
        req.tenantId,
        b.name,
        b.email ?? null,
        b.phone ?? null,
        b.title ?? null,
        b.location ?? null,
        b.resume_url ?? null,
        b.skills ?? null,
        b.notes ?? null,
        b.status ?? null,
      ]
    );
    res.status(201).json({ candidate: r.rows[0] });
  });

  app.patch("/api/candidates/:id", async (req: Request, res: Response) => {
    const parsed = candidatePatch.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;
    const allowed = new Set(["name", "email", "phone", "title", "location", "resume_url", "skills", "notes", "status"]);
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
      `UPDATE candidates SET ${fields.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}
       RETURNING id, name, email, phone, title, location, resume_url, skills, notes, status, created_at, updated_at`,
      values
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ candidate: r.rows[0] });
  });

  app.delete("/api/candidates/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `DELETE FROM candidates WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });

  app.get("/api/candidates/:id/activities", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT id, kind, note, created_at FROM candidate_activities
       WHERE candidate_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [req.params.id, req.tenantId]
    );
    res.json({ activities: r.rows });
  });

  app.post("/api/candidates/:id/activities", async (req: Request, res: Response) => {
    const body = z.object({ kind: z.string().min(1), note: z.string().optional().nullable() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const check = await pool.query(`SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tenantId]);
    if (check.rowCount === 0) return res.status(404).json({ error: "Candidate not found" });
    const r = await pool.query(
      `INSERT INTO candidate_activities (tenant_id, candidate_id, kind, note)
       VALUES ($1, $2, $3, $4) RETURNING id, kind, note, created_at`,
      [req.tenantId, req.params.id, body.data.kind, body.data.note ?? null]
    );
    res.status(201).json({ activity: r.rows[0] });
  });
}

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const leadBody = z.object({
  company: z.string().min(1),
  contact_name: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  stage: z.string().optional(),
  next_action_at: z.string().datetime().optional().nullable(),
  last_contact_at: z.string().datetime().optional().nullable(),
});

const leadPatch = leadBody.partial();

export function registerLeadRoutes(app: Express): void {
  app.get("/api/leads", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({
        error: "Database not configured",
        hint: "Set DATABASE_URL and run npm run db:init --prefix server",
      });
    }
    const r = await pool.query(
      `SELECT id, company, contact_name, role, url, notes, stage, next_action_at, last_contact_at, created_at, updated_at
       FROM leads ORDER BY updated_at DESC`
    );
    res.json({ leads: r.rows });
  });

  app.get("/api/leads/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT id, company, contact_name, role, url, notes, stage, next_action_at, last_contact_at, created_at, updated_at
       FROM leads WHERE id = $1`,
      [req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ lead: r.rows[0] });
  });

  app.post("/api/leads", async (req: Request, res: Response) => {
    const parsed = leadBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;
    const r = await pool.query(
      `INSERT INTO leads (company, contact_name, role, url, notes, stage, next_action_at, last_contact_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'new'), $7, $8)
       RETURNING id, company, contact_name, role, url, notes, stage, next_action_at, last_contact_at, created_at, updated_at`,
      [
        b.company,
        b.contact_name ?? null,
        b.role ?? null,
        b.url ?? null,
        b.notes ?? null,
        b.stage ?? null,
        b.next_action_at ?? null,
        b.last_contact_at ?? null,
      ]
    );
    res.status(201).json({ lead: r.rows[0] });
  });

  app.patch("/api/leads/:id", async (req: Request, res: Response) => {
    const parsed = leadPatch.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const b = parsed.data;
    const allowed = new Set([
      "company",
      "contact_name",
      "role",
      "url",
      "notes",
      "stage",
      "next_action_at",
      "last_contact_at",
    ]);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of Object.keys(b) as (keyof typeof b)[]) {
      if (!allowed.has(key)) continue;
      const v = b[key];
      if (v !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(v);
      }
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    fields.push(`updated_at = now()`);
    values.push(req.params.id);
    const r = await pool.query(
      `UPDATE leads SET ${fields.join(", ")} WHERE id = $${i} RETURNING id, company, contact_name, role, url, notes, stage, next_action_at, last_contact_at, created_at, updated_at`,
      values
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ lead: r.rows[0] });
  });
}

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const activityKinds = z.enum([
  "note",
  "contacted",
  "applied",
  "interview",
  "follow_up",
  "other",
]);

const postBody = z.object({
  kind: activityKinds,
  note: z.string().optional().nullable(),
});

const touchKinds = new Set(["contacted", "applied", "interview", "follow_up"]);

export function registerActivityRoutes(app: Express): void {
  app.get("/api/leads/:id/activities", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });
    const r = await pool.query(
      `SELECT id, kind, note, created_at FROM lead_activities
       WHERE lead_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ activities: r.rows });
  });

  app.post("/api/leads/:id/activities", async (req: Request, res: Response) => {
    const parsed = postBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database not configured" });

    const leadCheck = await pool.query(`SELECT id FROM leads WHERE id = $1`, [
      req.params.id,
    ]);
    if (leadCheck.rowCount === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const ins = await pool.query(
      `INSERT INTO lead_activities (lead_id, kind, note)
       VALUES ($1, $2, $3)
       RETURNING id, kind, note, created_at`,
      [req.params.id, parsed.data.kind, parsed.data.note ?? null]
    );

    if (touchKinds.has(parsed.data.kind)) {
      await pool.query(
        `UPDATE leads SET last_contact_at = now(), updated_at = now() WHERE id = $1`,
        [req.params.id]
      );
    }

    res.status(201).json({ activity: ins.rows[0] });
  });
}

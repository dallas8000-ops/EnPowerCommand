import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

const patchBody = z.object({
  resume_text: z.string(),
});

export function registerProfileRoutes(app: Express): void {
  app.get("/api/profile", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const r = await pool.query(
      `SELECT resume_text, updated_at FROM user_profile WHERE id = 1`
    );
    if (r.rowCount === 0) {
      return res.json({ resume_text: "", updated_at: null });
    }
    const row = r.rows[0] as { resume_text: string; updated_at: Date };
    res.json({
      resume_text: row.resume_text,
      updated_at: row.updated_at?.toISOString?.() ?? null,
    });
  });

  app.patch("/api/profile", async (req: Request, res: Response) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const r = await pool.query(
      `UPDATE user_profile SET resume_text = $1, updated_at = now() WHERE id = 1
       RETURNING resume_text, updated_at`,
      [parsed.data.resume_text]
    );
    const row = r.rows[0] as { resume_text: string; updated_at: Date };
    res.json({
      resume_text: row.resume_text,
      updated_at: row.updated_at.toISOString(),
    });
  });
}

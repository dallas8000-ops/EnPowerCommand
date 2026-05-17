import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0] as object);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))].join("\n");
}

export function registerExportRoutes(app: Express): void {
  app.get("/api/exports/candidates.csv", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).send("Database not configured"); return; }
    const r = await pool.query(
      `SELECT name, email, phone, title, location, skills, status, source, created_at FROM candidates WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY created_at DESC`,
      [req.tenantId ?? null]
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="candidates-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(toCsv(r.rows));
  });

  app.get("/api/exports/placements.csv", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).send("Database not configured"); return; }
    const r = await pool.query(
      `SELECT c.name AS candidate_name, c.email, j.title AS job_title, j.client_company,
              p.stage, p.fee, p.placed_at, p.notes, p.created_at
       FROM placements p
       JOIN candidates c ON c.id = p.candidate_id
       JOIN job_orders j ON j.id = p.job_order_id
       WHERE p.tenant_id IS NOT DISTINCT FROM $1
       ORDER BY p.created_at DESC`,
      [req.tenantId ?? null]
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="placements-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(toCsv(r.rows));
  });

  app.get("/api/exports/job-orders.csv", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).send("Database not configured"); return; }
    const r = await pool.query(
      `SELECT client_company, title, location, remote, salary_range, status, opened_at, created_at FROM job_orders WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY created_at DESC`,
      [req.tenantId ?? null]
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="job-orders-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(toCsv(r.rows));
  });

  app.get("/api/exports/applications.csv", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).send("Database not configured"); return; }
    const r = await pool.query(
      `SELECT a.name, a.email, a.phone, a.location, a.status, j.title AS job_title, j.client_company, a.created_at
       FROM applications a JOIN job_orders j ON j.id = a.job_order_id
       WHERE a.tenant_id IS NOT DISTINCT FROM $1 ORDER BY a.created_at DESC`,
      [req.tenantId ?? null]
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="applications-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(toCsv(r.rows));
  });

  app.get("/api/public/candidates/:shareId", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT c.id, c.name, c.title, c.location, c.skills, c.notes
       FROM candidates c WHERE c.id = $1 AND c.share_public = true`,
      [req.params.shareId]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Profile not found or not public" }); return; }
    res.json({ candidate: r.rows[0] });
  });

  app.patch("/api/candidates/:id/share", async (req: Request, res: Response) => {
    const { share_public } = req.body as { share_public?: boolean };
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `UPDATE candidates SET share_public = $1 WHERE id = $2 AND tenant_id IS NOT DISTINCT FROM $3 RETURNING id, share_public`,
      [share_public ?? false, req.params.id, req.tenantId ?? null]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ candidate: r.rows[0] });
  });
}

import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";

function csvEscape(s: string | null | undefined): string {
  const v = String(s ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

export function registerExportRoutes(app: Express): void {
  app.get("/api/export/leads.csv", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: "Database not configured" });
    }

    const r = await pool.query(
      `SELECT id, company, contact_name, role, url, notes, stage,
              next_action_at, last_contact_at, created_at, updated_at
       FROM leads ORDER BY updated_at DESC`
    );

    const headers = [
      "id",
      "company",
      "contact_name",
      "role",
      "url",
      "stage",
      "next_action_at",
      "last_contact_at",
      "created_at",
      "updated_at",
      "notes",
    ];

    const lines = [headers.join(",")];
    for (const row of r.rows as Record<string, unknown>[]) {
      lines.push(
        [
          csvEscape(String(row.id)),
          csvEscape(row.company as string),
          csvEscape(row.contact_name as string | null),
          csvEscape(row.role as string | null),
          csvEscape(row.url as string | null),
          csvEscape(row.stage as string),
          csvEscape(
            row.next_action_at
              ? new Date(row.next_action_at as string).toISOString()
              : ""
          ),
          csvEscape(
            row.last_contact_at
              ? new Date(row.last_contact_at as string).toISOString()
              : ""
          ),
          csvEscape(new Date(row.created_at as string).toISOString()),
          csvEscape(new Date(row.updated_at as string).toISOString()),
          csvEscape(row.notes as string | null),
        ].join(",")
      );
    }

    const body = lines.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="enpower-leads.csv"'
    );
    res.send(body);
  });

  app.get("/api/export/activities.csv", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: "Database not configured" });
    }

    const r = await pool.query(
      `SELECT a.id, a.lead_id, l.company, a.kind, a.note, a.created_at
       FROM lead_activities a
       JOIN leads l ON l.id = a.lead_id
       ORDER BY a.created_at DESC`
    );

    const headers = ["activity_id", "lead_id", "company", "kind", "note", "created_at"];
    const lines = [headers.join(",")];
    for (const row of r.rows as Record<string, unknown>[]) {
      lines.push(
        [
          csvEscape(String(row.id)),
          csvEscape(String(row.lead_id)),
          csvEscape(row.company as string),
          csvEscape(row.kind as string),
          csvEscape(row.note as string | null),
          csvEscape(new Date(row.created_at as string).toISOString()),
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="enpower-activity-log.csv"'
    );
    res.send(lines.join("\r\n"));
  });
}

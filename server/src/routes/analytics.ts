import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";

type ConversionRow = {
  bucket: string;
  label: string;
  applied_count: string | number;
  interview_count: string | number;
};

export function registerAnalyticsRoutes(app: Express): void {
  app.get("/api/analytics/weekly", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({
        error: "Database not configured",
        hint: "Set DATABASE_URL and run npm run db:init --prefix server",
      });
    }

    const summaryQuery = await pool.query<{
      applied_count: string | number;
      interview_count: string | number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE kind = 'applied') AS applied_count,
         COUNT(*) FILTER (WHERE kind = 'interview') AS interview_count
       FROM lead_activities
       WHERE created_at >= now() - interval '7 days'
         AND tenant_id IS NOT DISTINCT FROM $1`,
      [req.tenantId ?? null]
    );

    const tenantId = req.tenantId ?? null;
    const roleQuery = await pool.query<ConversionRow>(
      `SELECT
         'role' AS bucket,
         COALESCE(NULLIF(BTRIM(l.role), ''), '(unspecified role)') AS label,
         COUNT(*) FILTER (WHERE la.kind = 'applied') AS applied_count,
         COUNT(*) FILTER (WHERE la.kind = 'interview') AS interview_count
       FROM lead_activities la
       JOIN leads l ON l.id = la.lead_id
       WHERE la.created_at >= now() - interval '7 days'
         AND la.kind IN ('applied', 'interview')
         AND la.tenant_id IS NOT DISTINCT FROM $1
       GROUP BY label
       ORDER BY interview_count DESC, applied_count DESC, label ASC`,
      [tenantId]
    );

    const sourceQuery = await pool.query<ConversionRow>(
      `SELECT
         'source' AS bucket,
         COALESCE(
           NULLIF(
             REGEXP_REPLACE(
               SPLIT_PART(SPLIT_PART(LOWER(COALESCE(l.url, '')), '://', 2), '/', 1),
               '^www[.]',
               ''
             ),
             ''
           ),
           '(unknown source)'
         ) AS label,
         COUNT(*) FILTER (WHERE la.kind = 'applied') AS applied_count,
         COUNT(*) FILTER (WHERE la.kind = 'interview') AS interview_count
       FROM lead_activities la
       JOIN leads l ON l.id = la.lead_id
       WHERE la.created_at >= now() - interval '7 days'
         AND la.kind IN ('applied', 'interview')
         AND la.tenant_id IS NOT DISTINCT FROM $1
       GROUP BY label
       ORDER BY interview_count DESC, applied_count DESC, label ASC`,
      [tenantId]
    );

    const totalApplied = Number(summaryQuery.rows[0]?.applied_count ?? 0);
    const totalInterview = Number(summaryQuery.rows[0]?.interview_count ?? 0);
    const conversionRate = totalApplied > 0 ? totalInterview / totalApplied : 0;

    const mapRows = (rows: ConversionRow[]) =>
      rows.map((r) => {
        const applied = Number(r.applied_count ?? 0);
        const interview = Number(r.interview_count ?? 0);
        return {
          label: r.label,
          applied_count: applied,
          interview_count: interview,
          conversion_rate: applied > 0 ? interview / applied : 0,
        };
      });

    res.json({
      window_days: 7,
      summary: {
        applied_count: totalApplied,
        interview_count: totalInterview,
        conversion_rate: conversionRate,
      },
      by_role: mapRows(roleQuery.rows),
      by_source: mapRows(sourceQuery.rows),
    });
  });
}

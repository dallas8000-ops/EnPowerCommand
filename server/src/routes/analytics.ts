import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";

type ConversionRow = {
  bucket: string;
  label: string;
  applied_count: string | number;
  interview_count: string | number;
};

export function registerAnalyticsRoutes(app: Express): void {
  app.get("/api/analytics/dashboard", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const tid = req.tenantId ?? null;

    const [stageRes, velocityRes, fillRes, recentRes] = await Promise.all([
      pool.query<{ stage: string; cnt: string }>(
        `SELECT stage, COUNT(*) AS cnt FROM pipeline_placements
         WHERE tenant_id IS NOT DISTINCT FROM $1 GROUP BY stage`, [tid]
      ),
      pool.query<{ stage: string; avg_days: string }>(
        `SELECT
           p2.stage,
           ROUND(AVG(EXTRACT(EPOCH FROM (p2.updated_at - p1.updated_at)) / 86400), 1) AS avg_days
         FROM pipeline_placements p1
         JOIN pipeline_placements p2
           ON p1.candidate_id = p2.candidate_id
           AND p1.job_order_id = p2.job_order_id
           AND p2.tenant_id IS NOT DISTINCT FROM $1
         WHERE p1.tenant_id IS NOT DISTINCT FROM $1
           AND p1.stage != p2.stage
         GROUP BY p2.stage
         ORDER BY p2.stage`, [tid]
      ),
      pool.query<{ total: string; filled: string; fill_rate: string }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'filled') AS filled,
           ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'filled') / NULLIF(COUNT(*), 0), 1) AS fill_rate
         FROM job_orders WHERE tenant_id IS NOT DISTINCT FROM $1`, [tid]
      ),
      pool.query<{ kind: string; note: string; created_at: string; candidate_name: string }>(
        `SELECT ca.kind, ca.note, ca.created_at, c.name AS candidate_name
         FROM candidate_activities ca
         JOIN candidates c ON c.id = ca.candidate_id
         WHERE ca.tenant_id IS NOT DISTINCT FROM $1
         ORDER BY ca.created_at DESC LIMIT 8`, [tid]
      ),
    ]);

    const stageMap = new Map(stageRes.rows.map((r) => [r.stage, Number(r.cnt)]));
    const velocityMap = new Map(velocityRes.rows.map((r) => [r.stage, Number(r.avg_days)]));
    const STAGES = ["sourced","screening","submitted","interview","offer","placed","rejected"];
    const stages = STAGES.map((s) => ({
      stage: s,
      count: stageMap.get(s) ?? 0,
      avg_days: velocityMap.get(s) ?? null,
    }));
    const fill = fillRes.rows[0];

    res.json({
      stages,
      fill_rate: Number(fill?.fill_rate ?? 0),
      jobs_total: Number(fill?.total ?? 0),
      jobs_filled: Number(fill?.filled ?? 0),
      recent_activity: recentRes.rows,
    });
  });

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

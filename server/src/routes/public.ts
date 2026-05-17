import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";

async function notifyNewSubmission(job: { client_company: string; title: string; client_contact_name: string; client_contact_email: string }) {
  const to = process.env.NOTIFY_EMAIL;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!to || !apiKey) return;
  try {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: to },
        subject: `New job submission: ${job.title} @ ${job.client_company}`,
        content: [{ type: "text/plain", value:
          `New client submission received:\n\nRole: ${job.title}\nCompany: ${job.client_company}\nContact: ${job.client_contact_name} <${job.client_contact_email}>\n\nLog in to review and approve.` }],
      }),
    });
  } catch (e) {
    console.error("Email notification failed:", e);
  }
}

function getPublicTenantId(): string | null {
  return process.env.PUBLIC_TENANT_ID ?? null;
}

const submitSchema = z.object({
  client_company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salary_range: z.string().optional(),
  description: z.string().optional(),
  client_contact_name: z.string().min(1),
  client_contact_email: z.string().email(),
  client_notes: z.string().optional(),
});

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function registerPublicRoutes(app: Express): void {
  app.get("/feed/jobs.xml", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).send('Database not configured'); return; }
    const tenantId = getPublicTenantId();
    const r = tenantId
      ? await pool.query(
          `SELECT j.id, j.client_company, j.title, j.location, j.remote, j.salary_range, j.description, j.opened_at,
                  t.name AS agency_name
           FROM job_orders j JOIN tenants t ON t.id = j.tenant_id
           WHERE j.tenant_id = $1 AND j.status = 'open' ORDER BY j.opened_at DESC`, [tenantId])
      : await pool.query(
          `SELECT j.id, j.client_company, j.title, j.location, j.remote, j.salary_range, j.description, j.opened_at,
                  t.name AS agency_name
           FROM job_orders j JOIN tenants t ON t.id = j.tenant_id
           WHERE j.status = 'open' ORDER BY j.opened_at DESC`);

    const appUrl = process.env.APP_URL ?? 'https://enpower-command-web.onrender.com';
    const jobs = r.rows as { id: string; client_company: string; title: string; location: string | null; remote: boolean; salary_range: string | null; description: string | null; opened_at: string; agency_name: string }[];
    const agencyName = jobs[0]?.agency_name ?? 'RecruitCommand';

    const items = jobs.map((j) => {
      const loc = j.location ?? (j.remote ? 'Remote' : '');
      const [city = '', state = ''] = loc.split(',').map((s) => s.trim());
      return [
        '  <job>',
        `    <title><![CDATA[${j.title}]]></title>`,
        `    <date><![CDATA[${new Date(j.opened_at).toUTCString()}]]></date>`,
        `    <referencenumber><![CDATA[${j.id}]]></referencenumber>`,
        `    <url><![CDATA[${appUrl}/jobs/${j.id}]]></url>`,
        `    <company><![CDATA[${j.client_company}]]></company>`,
        `    <city><![CDATA[${city}]]></city>`,
        `    <state><![CDATA[${state}]]></state>`,
        `    <country><![CDATA[US]]></country>`,
        j.remote ? '    <remotetype><![CDATA[Fully remote]]></remotetype>' : '',
        j.salary_range ? `    <salary><![CDATA[${j.salary_range}]]></salary>` : '',
        `    <description><![CDATA[${j.description ?? j.title + ' at ' + j.client_company}]]></description>`,
        '  </job>',
      ].filter(Boolean).join('\n');
    }).join('\n');

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<source>',
      `  <publisher>${escapeXml(agencyName)}</publisher>`,
      `  <publisherurl>${appUrl}</publisherurl>`,
      `  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      items,
      '</source>',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  });

  app.get("/api/public/jobs", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const tenantId = getPublicTenantId();
    const r = tenantId
      ? await pool.query(
          `SELECT id, client_company, title, location, remote, salary_range, description, opened_at
           FROM job_orders
           WHERE tenant_id = $1 AND status = 'open'
           ORDER BY opened_at DESC`,
          [tenantId]
        )
      : await pool.query(
          `SELECT id, client_company, title, location, remote, salary_range, description, opened_at
           FROM job_orders
           WHERE status = 'open'
           ORDER BY opened_at DESC`
        );

    res.json({ jobs: r.rows });
  });

  app.get("/api/public/jobs/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT id, client_company, title, location, remote, salary_range, description, opened_at
       FROM job_orders WHERE id = $1 AND status = 'open'`,
      [req.params.id]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Job not found" }); return; }
    res.json({ job: r.rows[0] });
  });

  app.post("/api/public/jobs/submit", async (req: Request, res: Response) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const tenantId = getPublicTenantId();
    if (!tenantId) {
      res.status(503).json({ error: "Public job board not configured", hint: "Set PUBLIC_TENANT_ID on the server." });
      return;
    }

    const b = parsed.data;
    const r = await pool.query(
      `INSERT INTO job_orders
         (tenant_id, client_company, title, location, remote, salary_range,
          description, source, client_contact_name, client_contact_email,
          client_notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'client',$8,$9,$10,'pending')
       RETURNING id, client_company, title, status`,
      [
        tenantId, b.client_company, b.title,
        b.location ?? null, b.remote ?? false,
        b.salary_range ?? null, b.description ?? null,
        b.client_contact_name, b.client_contact_email,
        b.client_notes ?? null,
      ]
    );

    void notifyNewSubmission({
      client_company: b.client_company,
      title: b.title,
      client_contact_name: b.client_contact_name,
      client_contact_email: b.client_contact_email,
    });
    res.status(201).json({ job: r.rows[0], message: "Submission received. We will be in touch shortly." });
  });

  app.get("/api/public/jobs/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const r = await pool.query(
      `SELECT id, client_company, title, location, remote, salary_range, description, opened_at
       FROM job_orders WHERE id = $1 AND status = 'open'`,
      [req.params.id]
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({ job: r.rows[0] });
  });
}

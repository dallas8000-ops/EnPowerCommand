import { createDecipheriv } from "node:crypto";
import type { Express, Request, Response } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getPool } from "../db.js";
import { generateIcs } from "../utils/ics.js";

function decryptSmtp(encrypted: string): string {
  const secret = (process.env.AUTH_SECRET ?? "default-secret-key-32chars!!!!!!").padEnd(32, "!").slice(0, 32);
  const key = Buffer.from(secret, "utf8");
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

const inviteBody = z.object({
  send_to_candidate: z.boolean().default(true),
  extra_email: z.string().email().optional(),
});

export function registerCalendarRoutes(app: Express): void {
  app.get("/api/interviews/:id/ics", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const r = await pool.query(
      `SELECT i.id, i.scheduled_at, i.duration_minutes, i.location, i.notes, i.status,
              c.name AS candidate_name, c.email AS candidate_email,
              j.title AS job_title, j.client_company,
              t.name AS tenant_name
       FROM interviews i
       JOIN candidates c ON c.id = i.candidate_id
       JOIN job_orders j ON j.id = i.job_order_id
       JOIN tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 AND i.tenant_id IS NOT DISTINCT FROM $2`,
      [req.params.id, req.tenantId ?? null]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Interview not found" }); return; }

    const row = r.rows[0] as {
      id: string; scheduled_at: string; duration_minutes: number; location: string | null;
      notes: string | null; candidate_name: string; candidate_email: string | null;
      job_title: string; client_company: string; tenant_name: string;
    };

    const smtpRes = await pool.query(`SELECT user_email, from_name FROM smtp_configs WHERE tenant_id = $1`, [req.tenantId ?? null]);
    const organizerEmail = smtpRes.rows[0]?.user_email ?? "noreply@recruitcommand.app";
    const organizerName = smtpRes.rows[0]?.from_name ?? row.tenant_name;

    const ics = generateIcs({
      uid: row.id,
      title: `${row.candidate_name} — ${row.job_title} @ ${row.client_company}`,
      description: [
        `Candidate: ${row.candidate_name}`,
        `Role: ${row.job_title} at ${row.client_company}`,
        row.notes ? `Notes: ${row.notes}` : '',
      ].filter(Boolean).join('\n'),
      location: row.location ?? '',
      start: new Date(row.scheduled_at),
      durationMinutes: row.duration_minutes,
      organizerEmail,
      organizerName,
      attendeeEmail: row.candidate_email ?? undefined,
      attendeeName: row.candidate_name,
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="interview-${row.id.slice(0, 8)}.ics"`);
    res.send(ics);
  });

  app.post("/api/interviews/:id/invite", async (req: Request, res: Response) => {
    const parsed = inviteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const tid = req.tenantId ?? null;

    const [interviewRes, smtpRes] = await Promise.all([
      pool.query(
        `SELECT i.id, i.scheduled_at, i.duration_minutes, i.location, i.notes,
                c.name AS candidate_name, c.email AS candidate_email,
                j.title AS job_title, j.client_company, t.name AS tenant_name
         FROM interviews i
         JOIN candidates c ON c.id = i.candidate_id
         JOIN job_orders j ON j.id = i.job_order_id
         JOIN tenants t ON t.id = i.tenant_id
         WHERE i.id = $1 AND i.tenant_id IS NOT DISTINCT FROM $2`,
        [req.params.id, tid]
      ),
      pool.query(`SELECT * FROM smtp_configs WHERE tenant_id = $1`, [tid]),
    ]);

    if (interviewRes.rowCount === 0) { res.status(404).json({ error: "Interview not found" }); return; }
    if (smtpRes.rowCount === 0) { res.status(400).json({ error: "SMTP not configured. Set it up in Profile → Email settings." }); return; }

    const row = interviewRes.rows[0] as {
      id: string; scheduled_at: string; duration_minutes: number; location: string | null;
      notes: string | null; candidate_name: string; candidate_email: string | null;
      job_title: string; client_company: string; tenant_name: string;
    };
    const smtp = smtpRes.rows[0] as { host: string; port: number; secure: boolean; user_email: string; encrypted_password: string; from_name: string | null };

    const { send_to_candidate, extra_email } = parsed.data;
    const recipients: string[] = [];
    if (send_to_candidate && row.candidate_email) recipients.push(row.candidate_email);
    if (extra_email) recipients.push(extra_email);
    if (recipients.length === 0) { res.status(400).json({ error: "No recipients — candidate has no email and no extra email given." }); return; }

    const ics = generateIcs({
      uid: row.id,
      title: `${row.candidate_name} — ${row.job_title} @ ${row.client_company}`,
      description: [
        `Candidate: ${row.candidate_name}`,
        `Role: ${row.job_title} at ${row.client_company}`,
        row.notes ? `Notes: ${row.notes}` : '',
      ].filter(Boolean).join('\n'),
      location: row.location ?? '',
      start: new Date(row.scheduled_at),
      durationMinutes: row.duration_minutes,
      organizerEmail: smtp.user_email,
      organizerName: smtp.from_name ?? row.tenant_name,
      attendeeEmail: row.candidate_email ?? undefined,
      attendeeName: row.candidate_name,
    });

    try {
      const pass = decryptSmtp(smtp.encrypted_password);
      const transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user_email, pass } });
      const dateStr = new Date(row.scheduled_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
      const subject = `Interview: ${row.candidate_name} — ${row.job_title} @ ${row.client_company}`;
      const text = `Interview Details\n\nCandidate: ${row.candidate_name}\nRole: ${row.job_title} at ${row.client_company}\nWhen: ${dateStr}\nDuration: ${row.duration_minutes} minutes${row.location ? `\nLocation: ${row.location}` : ''}${row.notes ? `\nNotes: ${row.notes}` : ''}\n\nA calendar invite is attached. Click to add it to your calendar.`;

      await transport.sendMail({
        from: smtp.from_name ? `"${smtp.from_name}" <${smtp.user_email}>` : smtp.user_email,
        to: recipients.join(', '),
        subject,
        text,
        icalEvent: { method: 'REQUEST', content: ics },
        attachments: [{ filename: 'interview.ics', content: ics, contentType: 'text/calendar' }],
      });
      res.json({ ok: true, sent_to: recipients });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

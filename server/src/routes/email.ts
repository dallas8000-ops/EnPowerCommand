import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getPool } from "../db.js";

function getEncKey(): Buffer {
  const secret = (process.env.AUTH_SECRET ?? "default-secret-key-32chars!!!!!!").padEnd(32, "!").slice(0, 32);
  return Buffer.from(secret, "utf8");
}

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getEncKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(stored: string): string {
  const [ivHex, encHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", getEncKey(), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

const smtpBody = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user_email: z.string().email(),
  password: z.string().min(1),
  from_name: z.string().optional(),
});

const sendBody = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  candidate_id: z.string().uuid().optional(),
  job_order_id: z.string().uuid().optional(),
});

export function registerEmailRoutes(app: Express): void {
  app.get("/api/email/smtp", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT host, port, secure, user_email, from_name FROM smtp_configs WHERE tenant_id = $1`,
      [req.tenantId ?? null]
    );
    if (r.rowCount === 0) { res.json({ config: null }); return; }
    res.json({ config: r.rows[0] });
  });

  app.put("/api/email/smtp", async (req: Request, res: Response) => {
    const parsed = smtpBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const { host, port, secure, user_email, password, from_name } = parsed.data;
    const encrypted = encrypt(password);
    await pool.query(
      `INSERT INTO smtp_configs (tenant_id, host, port, secure, user_email, encrypted_password, from_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id) DO UPDATE
         SET host=$2, port=$3, secure=$4, user_email=$5, encrypted_password=$6, from_name=$7, updated_at=now()`,
      [req.tenantId ?? null, host, port, secure, user_email, encrypted, from_name ?? null]
    );
    res.json({ ok: true });
  });

  app.post("/api/email/test", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT * FROM smtp_configs WHERE tenant_id = $1`, [req.tenantId ?? null]
    );
    if (r.rowCount === 0) { res.status(400).json({ error: "SMTP not configured" }); return; }
    const cfg = r.rows[0] as { host: string; port: number; secure: boolean; user_email: string; encrypted_password: string; from_name: string | null };
    try {
      const pass = decrypt(cfg.encrypted_password);
      const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user_email, pass } });
      await transport.verify();
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  app.post("/api/email/send", async (req: Request, res: Response) => {
    const parsed = sendBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const tid = req.tenantId ?? null;

    const cfgRes = await pool.query(`SELECT * FROM smtp_configs WHERE tenant_id = $1`, [tid]);
    if (cfgRes.rowCount === 0) { res.status(400).json({ error: "SMTP not configured. Set it up in Settings → Email." }); return; }
    const cfg = cfgRes.rows[0] as { host: string; port: number; secure: boolean; user_email: string; encrypted_password: string; from_name: string | null };

    const { to, subject, body, candidate_id, job_order_id } = parsed.data;
    let status = "sent";
    try {
      const pass = decrypt(cfg.encrypted_password);
      const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user_email, pass } });
      await transport.sendMail({
        from: cfg.from_name ? `"${cfg.from_name}" <${cfg.user_email}>` : cfg.user_email,
        to,
        subject,
        text: body,
      });
    } catch (err) {
      status = "failed";
      console.error("Email send failed:", err);
    }

    const logRes = await pool.query(
      `INSERT INTO email_logs (tenant_id, candidate_id, job_order_id, sent_by, to_email, subject, body, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at, status`,
      [tid, candidate_id ?? null, job_order_id ?? null, req.userId ?? null, to, subject, body, status]
    );

    if (status === "failed") {
      res.status(500).json({ error: "Email failed to send but was logged.", log: logRes.rows[0] });
      return;
    }
    res.status(201).json({ ok: true, log: logRes.rows[0] });
  });

  app.get("/api/candidates/:id/emails", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT el.id, el.direction, el.to_email, el.subject, el.body, el.status, el.created_at,
              tu.email AS sent_by_email
       FROM email_logs el
       LEFT JOIN tenant_users tu ON tu.id = el.sent_by
       WHERE el.tenant_id = $1 AND el.candidate_id = $2
       ORDER BY el.created_at DESC`,
      [req.tenantId ?? null, req.params.id]
    );
    res.json({ emails: r.rows });
  });
}

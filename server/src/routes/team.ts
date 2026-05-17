import { randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { hashPassword, signTenantToken } from "./auth.js";

const inviteBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "recruiter", "viewer"]).default("recruiter"),
});

const acceptBody = z.object({
  token: z.string(),
  name: z.string().min(1),
  password: z.string().min(8),
});

async function sendInviteEmail(to: string, inviteUrl: string, tenantName: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.NOTIFY_EMAIL;
  if (!apiKey || !from) return;
  try {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject: `You've been invited to join ${tenantName} on RecruitCommand`,
        content: [{ type: "text/plain", value:
          `You've been invited to join ${tenantName} on RecruitCommand.\n\nClick the link below to set up your account:\n${inviteUrl}\n\nThis link expires in 7 days.` }],
      }),
    });
  } catch (e) {
    console.error("Invite email failed:", e);
  }
}

export function registerTeamRoutes(app: Express): void {
  app.get("/api/team", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const tid = req.tenantId ?? null;

    const [membersRes, invitesRes] = await Promise.all([
      pool.query(
        `SELECT id, email, role, created_at FROM tenant_users WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY created_at ASC`,
        [tid]
      ),
      pool.query(
        `SELECT id, email, role, expires_at, accepted_at, created_at FROM team_invites
         WHERE tenant_id IS NOT DISTINCT FROM $1 AND accepted_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC`,
        [tid]
      ),
    ]);

    res.json({ members: membersRes.rows, pending_invites: invitesRes.rows });
  });

  app.post("/api/team/invite", async (req: Request, res: Response) => {
    const parsed = inviteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const { email, role } = parsed.data;
    const tid = req.tenantId ?? null;
    const userId = req.userId ?? null;

    const existing = await pool.query(
      `SELECT id FROM tenant_users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if ((existing.rowCount ?? 0) > 0) {
      res.status(409).json({ error: "A user with this email already exists." });
      return;
    }

    const token = randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO team_invites (tenant_id, email, role, token, invited_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token) DO NOTHING`,
      [tid, email.toLowerCase(), role, token, userId]
    );

    const tenantRes = await pool.query(`SELECT name FROM tenants WHERE id = $1`, [tid]);
    const tenantName = tenantRes.rows[0]?.name ?? "your team";
    const appUrl = process.env.APP_URL ?? "https://enpower-command-web.onrender.com";
    const inviteUrl = `${appUrl}/invite/${token}`;

    await sendInviteEmail(email, inviteUrl, tenantName);

    res.status(201).json({ ok: true, invite_url: inviteUrl });
  });

  app.delete("/api/team/invites/:id", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    await pool.query(
      `DELETE FROM team_invites WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
      [req.params.id, req.tenantId ?? null]
    );
    res.json({ ok: true });
  });

  app.patch("/api/team/:userId", async (req: Request, res: Response) => {
    const role = z.enum(["admin", "recruiter", "viewer"]).safeParse(req.body.role);
    if (!role.success) { res.status(400).json({ error: "Invalid role" }); return; }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    if (req.params.userId === req.userId) {
      res.status(400).json({ error: "Cannot change your own role" }); return;
    }
    const r = await pool.query(
      `UPDATE tenant_users SET role = $1 WHERE id = $2 AND tenant_id IS NOT DISTINCT FROM $3 RETURNING id, email, role`,
      [role.data, req.params.userId, req.tenantId ?? null]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ member: r.rows[0] });
  });

  app.delete("/api/team/:userId", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    if (req.params.userId === req.userId) {
      res.status(400).json({ error: "Cannot remove yourself" }); return;
    }
    await pool.query(
      `DELETE FROM tenant_users WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
      [req.params.userId, req.tenantId ?? null]
    );
    res.json({ ok: true });
  });

  app.get("/api/auth/invite/:token", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT i.id, i.email, i.role, i.expires_at, t.name AS tenant_name
       FROM team_invites i JOIN tenants t ON t.id = i.tenant_id
       WHERE i.token = $1 AND i.accepted_at IS NULL AND i.expires_at > now()`,
      [req.params.token]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: "Invite not found or expired" }); return; }
    res.json(r.rows[0]);
  });

  app.post("/api/auth/accept-invite", async (req: Request, res: Response) => {
    const parsed = acceptBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const { token, name, password } = parsed.data;

    const inviteRes = await pool.query(
      `SELECT i.*, t.subscription_status, t.trial_ends_at
       FROM team_invites i JOIN tenants t ON t.id = i.tenant_id
       WHERE i.token = $1 AND i.accepted_at IS NULL AND i.expires_at > now()`,
      [token]
    );
    if (inviteRes.rowCount === 0) {
      res.status(404).json({ error: "Invite not found or expired" }); return;
    }
    const invite = inviteRes.rows[0] as {
      id: string; tenant_id: string; email: string; role: string;
      subscription_status: string; trial_ends_at: Date;
    };

    const existing = await pool.query(`SELECT id FROM tenant_users WHERE email = $1`, [invite.email]);
    if ((existing.rowCount ?? 0) > 0) {
      res.status(409).json({ error: "An account with this email already exists." }); return;
    }

    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userRes = await client.query(
        `INSERT INTO tenant_users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [invite.tenant_id, invite.email, passwordHash, invite.role]
      );
      const userId = userRes.rows[0].id as string;
      await client.query(`UPDATE team_invites SET accepted_at = now() WHERE id = $1`, [invite.id]);
      await client.query("COMMIT");

      const jwtToken = signTenantToken({
        userId,
        tenantId: invite.tenant_id,
        role: invite.role,
        email: invite.email,
        plan: invite.subscription_status,
        trialEnds: invite.trial_ends_at,
      });
      res.status(201).json({ token: jwtToken, name, role: invite.role });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to accept invite." });
    } finally {
      client.release();
    }
  });
}

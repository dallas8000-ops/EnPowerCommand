import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { hashPassword, signTenantToken } from "./auth.js";

const registerBody = z.object({
  agency_name: z.string().min(1, "Agency name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function registerRegisterRoutes(app: Express): void {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { agency_name, email, password } = parsed.data;
    const lowerEmail = email.toLowerCase();

    const existing = await pool.query(
      `SELECT id FROM tenant_users WHERE email = $1`,
      [lowerEmail]
    );
    if ((existing.rowCount ?? 0) > 0) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await hashPassword(password);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const tenantResult = await client.query(
        `INSERT INTO tenants (name) VALUES ($1) RETURNING id, subscription_status, trial_ends_at`,
        [agency_name]
      );
      const tenant = tenantResult.rows[0] as {
        id: string;
        subscription_status: string;
        trial_ends_at: Date;
      };

      await client.query(
        `INSERT INTO tenant_profiles (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [tenant.id]
      );

      const userResult = await client.query(
        `INSERT INTO tenant_users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin') RETURNING id`,
        [tenant.id, lowerEmail, passwordHash]
      );
      const userId = userResult.rows[0].id as string;

      await client.query("COMMIT");

      const secret = process.env.AUTH_SECRET;
      if (!secret || secret.length < 16) {
        res.status(201).json({
          message: "Account created. Set AUTH_SECRET on the server to enable login.",
          tenant_id: tenant.id,
        });
        return;
      }

      const token = signTenantToken({
        userId,
        tenantId: tenant.id,
        role: "admin",
        email: lowerEmail,
        plan: tenant.subscription_status,
        trialEnds: tenant.trial_ends_at,
      });

      res.status(201).json({
        token,
        tenant_name: agency_name,
        role: "admin",
        plan: tenant.subscription_status,
        trial_ends_at: tenant.trial_ends_at,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Registration failed. Please try again." });
    } finally {
      client.release();
    }
  });
}

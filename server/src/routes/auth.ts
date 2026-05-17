import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { getPool } from "../db.js";
import { authConfigured } from "../middleware/auth.js";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(":");
    const expected = Buffer.from(hash, "hex");
    const actual = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function signTenantToken(payload: {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  plan: string;
  trialEnds: Date;
}): string {
  return jwt.sign(
    {
      sub: payload.userId,
      tenant_id: payload.tenantId,
      role: payload.role,
      email: payload.email,
      plan: payload.plan,
      trial_ends: Math.floor(payload.trialEnds.getTime() / 1000),
    },
    process.env.AUTH_SECRET!,
    { expiresIn: "30d" }
  );
}

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    if (process.env.SKIP_AUTH === "true") {
      res.status(400).json({
        error: "Login disabled",
        hint: "SKIP_AUTH=true — API routes are open without a token.",
      });
      return;
    }

    if (!authConfigured()) {
      res.status(503).json({
        error: "Auth not configured",
        hint: "Set AUTH_SECRET (16+ chars) in server/.env.",
      });
      return;
    }

    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { email, password } = parsed.data;
    const r = await pool.query(
      `SELECT tu.id, tu.password_hash, tu.role, tu.tenant_id,
              t.subscription_status, t.trial_ends_at, t.name AS tenant_name
       FROM tenant_users tu
       JOIN tenants t ON t.id = tu.tenant_id
       WHERE tu.email = $1`,
      [email.toLowerCase()]
    );

    if (r.rowCount === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = r.rows[0] as {
      id: string;
      password_hash: string;
      role: string;
      tenant_id: string;
      subscription_status: string;
      trial_ends_at: Date;
      tenant_name: string;
    };

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signTenantToken({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email,
      plan: user.subscription_status,
      trialEnds: user.trial_ends_at,
    });

    res.json({ token, tenant_name: user.tenant_name, role: user.role });
  });
}

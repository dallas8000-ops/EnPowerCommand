import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function authConfigured(): boolean {
  if (process.env.SKIP_AUTH === "true") return false;
  const secret = process.env.AUTH_SECRET?.trim();
  return Boolean(secret && secret.length >= 16);
}

export type JwtPayload = {
  sub: string;
  tenant_id: string;
  role: string;
  email: string;
  plan: string;
  trial_ends: number;
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.SKIP_AUTH === "true") {
    req.tenantId = "00000000-0000-0000-0000-000000000000";
    req.userId = "00000000-0000-0000-0000-000000000001";
    req.userRole = "admin";
    req.userEmail = "dev@localhost";
    req.tenantPlan = "active";
    next();
    return;
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    res.status(503).json({
      error: "Auth not configured",
      hint: "Set AUTH_SECRET (16+ chars) in server/.env, or SKIP_AUTH=true for local dev.",
    });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), secret) as JwtPayload;
    req.tenantId = payload.tenant_id;
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.userEmail = payload.email;
    req.tenantPlan = payload.plan;
    req.trialEnds = payload.trial_ends;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireSubscription(req: Request, res: Response, next: NextFunction): void {
  if (process.env.SKIP_AUTH === "true") { next(); return; }
  const plan = req.tenantPlan ?? "canceled";
  if (plan === "active") { next(); return; }
  if (plan === "trialing") {
    const trialEnds = req.trialEnds ?? 0;
    if (Date.now() / 1000 < trialEnds) { next(); return; }
    res.status(402).json({ error: "Trial expired. Please upgrade to continue.", upgrade_url: "/billing" });
    return;
  }
  res.status(402).json({ error: "Subscription inactive. Please upgrade.", upgrade_url: "/billing" });
}

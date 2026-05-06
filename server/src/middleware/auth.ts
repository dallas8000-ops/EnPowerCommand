import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function authConfigured(): boolean {
  if (process.env.SKIP_AUTH === "true") return false;
  const secret = process.env.AUTH_SECRET?.trim();
  const pass = process.env.ADMIN_PASSWORD?.trim();
  return Boolean(secret && secret.length >= 16 && pass && pass.length >= 8);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.SKIP_AUTH === "true") {
    next();
    return;
  }

  const secret = process.env.AUTH_SECRET;
  if (!authConfigured()) {
    res.status(503).json({
      error: "Auth not configured",
      hint: "Set AUTH_SECRET (16+ chars) and ADMIN_PASSWORD (8+ chars), or SKIP_AUTH=true for local dev only.",
    });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    jwt.verify(header.slice(7), secret!);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

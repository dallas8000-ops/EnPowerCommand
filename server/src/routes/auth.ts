import { createHash, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { authConfigured } from "../middleware/auth.js";

function verifyPassword(input: string, expected: string): boolean {
  try {
    const a = createHash("sha256").update(input, "utf8").digest();
    const b = createHash("sha256").update(expected, "utf8").digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const loginBody = z.object({
  password: z.string().min(1),
});

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", (req: Request, res: Response) => {
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
        hint: "Set AUTH_SECRET and ADMIN_PASSWORD on the server.",
      });
      return;
    }

    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const expected = process.env.ADMIN_PASSWORD!;
    if (!verifyPassword(parsed.data.password, expected)) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }

    const token = jwt.sign({ sub: "admin" }, process.env.AUTH_SECRET!, {
      expiresIn: "30d",
    });
    res.json({ token });
  });
}

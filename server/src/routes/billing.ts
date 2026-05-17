import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { signTenantToken } from "./auth.js";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, { maxNetworkRetries: 0, timeout: 15000 });
}

export function registerBillingRoutes(app: Express): void {
  app.get("/api/billing/status", requireAuth, async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const r = await pool.query(
      `SELECT subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id
       FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const t = r.rows[0] as {
      subscription_status: string;
      trial_ends_at: Date;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    };

    const stripe = getStripe();
    res.json({
      plan: t.subscription_status,
      trial_ends_at: t.trial_ends_at,
      stripe_enabled: Boolean(stripe),
      has_subscription: Boolean(t.stripe_subscription_id),
    });
  });

  app.post("/api/billing/checkout", requireAuth, async (req: Request, res: Response) => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({
        error: "Stripe not configured",
        hint: "Set STRIPE_SECRET_KEY on the server.",
      });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const priceId = process.env.STRIPE_PRICE_ID?.trim();
    if (!priceId) {
      res.status(503).json({
        error: "Stripe price not configured",
        hint: "Set STRIPE_PRICE_ID on the server.",
      });
      return;
    }

    const origin = req.headers.origin ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { tenant_id: req.tenantId!, user_id: req.userId! },
        customer_email: req.userEmail,
        success_url: `${origin}/billing?session_id={CHECKOUT_SESSION_ID}&upgraded=1`,
        cancel_url: `${origin}/billing?canceled=1`,
      });
      res.json({ checkout_url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe error";
      console.error("Checkout error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/billing/portal", requireAuth, async (req: Request, res: Response) => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const r = await pool.query(
      `SELECT stripe_customer_id FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    const customerId = r.rows[0]?.stripe_customer_id as string | null;
    if (!customerId) {
      res.status(400).json({ error: "No billing account found. Please subscribe first." });
      return;
    }

    const origin = req.headers.origin ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });

    res.json({ portal_url: session.url });
  });

  app.post(
    "/api/billing/webhook",
    express_raw_body_middleware,
    async (req: Request, res: Response) => {
      const stripe = getStripe();
      if (!stripe) {
        res.status(503).json({ error: "Stripe not configured" });
        return;
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!webhookSecret) {
        res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET not set" });
        return;
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers["stripe-signature"] as string,
          webhookSecret
        );
      } catch {
        res.status(400).json({ error: "Webhook signature verification failed" });
        return;
      }

      const pool = getPool();
      if (!pool) {
        res.status(503).json({ error: "Database not configured" });
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (tenantId) {
          await pool.query(
            `UPDATE tenants SET subscription_status = 'active',
             stripe_customer_id = COALESCE($2, stripe_customer_id),
             stripe_subscription_id = COALESCE($3, stripe_subscription_id)
             WHERE id = $1`,
            [tenantId, customerId ?? null, subscriptionId ?? null]
          );
        }
      }

      if (event.type === "customer.subscription.updated") {
        const sub = event.data.object as Stripe.Subscription;
        let status = "canceled";
        if (sub.status === "active") status = "active";
        else if (sub.status === "trialing") status = "trialing";
        else if (sub.status === "past_due") status = "past_due";
        await pool.query(
          `UPDATE tenants SET subscription_status = $2 WHERE stripe_subscription_id = $1`,
          [sub.id, status]
        );
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object as Stripe.Subscription;
        await pool.query(
          `UPDATE tenants SET subscription_status = 'canceled' WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
      }

      res.json({ received: true });
    }
  );

  app.post("/api/billing/refresh-token", requireAuth, async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const r = await pool.query(
      `SELECT tu.id, tu.role, tu.email, t.subscription_status, t.trial_ends_at
       FROM tenant_users tu JOIN tenants t ON t.id = tu.tenant_id
       WHERE tu.id = $1`,
      [req.userId]
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const u = r.rows[0] as {
      id: string;
      role: string;
      email: string;
      subscription_status: string;
      trial_ends_at: Date;
    };

    const token = signTenantToken({
      userId: u.id,
      tenantId: req.tenantId!,
      role: u.role,
      email: u.email,
      plan: u.subscription_status,
      trialEnds: u.trial_ends_at,
    });

    res.json({ token });
  });
}

function express_raw_body_middleware(req: Request, _res: Response, next: () => void) {
  if (req.headers["stripe-signature"]) {
    let data = "";
    req.setEncoding("latin1");
    req.on("data", (chunk: string) => { data += chunk; });
    req.on("end", () => {
      req.body = Buffer.from(data, "latin1");
      next();
    });
  } else {
    next();
  }
}

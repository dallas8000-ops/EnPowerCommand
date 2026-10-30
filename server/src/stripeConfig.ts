import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const MANIFEST_PATH = join(REPO_ROOT, ".stripe-installer", "stripe-manifest.json");
const DEPLOY_MANIFEST_PATH = join(REPO_ROOT, ".stripe-installer", "deploy-manifest.json");
const STRIPE_CONFIG_PATH = join(REPO_ROOT, "stripe.config.json");

export type StripePriceManifest = {
  id: string;
  tier: string;
  amount: number;
  currency: string;
  interval: string;
  trialDays: number;
  features: string[];
};

export type StripeConfigTier = {
  name: string;
  amount: number;
  currency?: string;
  interval?: string;
  trialDays?: number;
  features?: string[];
};

export type StripeConfigFile = {
  appUrl?: string;
  webhookUrl?: string;
  tiers?: StripeConfigTier[];
};

export type StripeManifest = {
  appUrl: string;
  prices: StripePriceManifest[];
  webhookEndpoint?: { id: string; url: string };
};

export type DeployManifest = {
  platform: string;
  productionUrl: string;
  postgresProvider?: string | null;
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function loadStripeConfigFile(): StripeConfigFile | null {
  return readJson<StripeConfigFile>(STRIPE_CONFIG_PATH);
}

export function loadStripeManifest(): StripeManifest | null {
  return readJson<StripeManifest>(MANIFEST_PATH);
}

export function loadDeployManifest(): DeployManifest | null {
  return readJson<DeployManifest>(DEPLOY_MANIFEST_PATH);
}

export function getAppUrl(): string {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const stripeConfig = loadStripeConfigFile();
  if (stripeConfig?.appUrl) return stripeConfig.appUrl.replace(/\/$/, "");
  const manifest = loadStripeManifest();
  if (manifest?.appUrl) return manifest.appUrl.replace(/\/$/, "");
  const deploy = loadDeployManifest();
  if (deploy?.productionUrl) return deploy.productionUrl.replace(/\/$/, "");
  const cors = process.env.CORS_ORIGIN?.split(",")[0]?.trim();
  return cors?.replace(/\/$/, "") ?? "http://localhost:5173";
}

export function getWebhookUrl(): string {
  const stripeConfig = loadStripeConfigFile();
  if (stripeConfig?.webhookUrl) return stripeConfig.webhookUrl.replace(/\/$/, "");
  const fromManifest = loadStripeManifest()?.webhookEndpoint?.url;
  if (fromManifest?.includes("/api/billing/webhook")) {
    return fromManifest.replace(/\/$/, "");
  }
  return `${getAppUrl()}/api/billing/webhook`;
}

export function getDefaultPriceId(): string | undefined {
  const fromEnv = process.env.STRIPE_PRICE_ID?.trim();
  if (fromEnv) return fromEnv;
  const prices = loadStripeManifest()?.prices ?? [];
  const pro = prices.find((p) => p.tier === "Pro");
  return pro?.id ?? prices[0]?.id;
}

export function listPlans(): StripePriceManifest[] {
  const manifestPrices = loadStripeManifest()?.prices ?? [];
  if (manifestPrices.length > 0) return manifestPrices;
  const tiers = loadStripeConfigFile()?.tiers ?? [];
  return tiers.map((t) => ({
    id: t.name.toLowerCase(),
    tier: t.name,
    amount: t.amount,
    currency: t.currency ?? "usd",
    interval: t.interval ?? "month",
    trialDays: t.trialDays ?? 0,
    features: t.features ?? [],
  }));
}

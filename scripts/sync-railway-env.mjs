#!/usr/bin/env node
/**
 * Preview Railway env vars from Deployment-Stripe-center output files.
 * Primary setup: Deployment-Stripe-center UI or CLI (see docs/STRIPE-SETUP.md).
 *
 * Usage: node scripts/sync-railway-env.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const stripePath = join(root, '.stripe-installer', 'stripe-manifest.json')
const deployPath = join(root, '.stripe-installer', 'deploy-manifest.json')
const stripeConfigPath = join(root, 'stripe.config.json')

function load(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

const stripe = load(stripePath)
const deploy = load(deployPath)
const stripeConfig = load(stripeConfigPath)

const appUrl = (
  stripeConfig?.appUrl ??
  stripe?.appUrl ??
  deploy?.productionUrl ??
  'https://enpowercommand-production.up.railway.app'
).replace(/\/$/, '')
const proPrice = stripe?.prices?.find((p) => p.tier === 'Pro') ?? stripe?.prices?.[0]
const webhookUrl = stripeConfig?.webhookUrl ?? `${appUrl}/api/billing/webhook`

console.log('# Deployment-Stripe-center is the source of truth.')
console.log('# Open: https://stripe-installer-production.up.railway.app/login')
console.log('# Project: enpowercommand → Run full setup → Deploy → env push')
console.log('')
console.log('# Preview only — paste into Railway → API service → Variables:')
console.log(`NODE_ENV=production`)
console.log(`APP_URL=${appUrl}`)
console.log(`CORS_ORIGIN=${appUrl}`)
console.log(`STRIPE_PRICE_ID=${proPrice?.id ?? '<run Stripe setup in Deployment-Stripe-center>'}`)
console.log(`# STRIPE_SECRET_KEY=sk_live_...  (from vault)`)
console.log(`# STRIPE_WEBHOOK_SECRET=whsec_...  (from vault)`)
console.log(`# AUTH_SECRET=<random-32-chars>`)
console.log(`# DATABASE_URL=<link Railway Postgres>`)
console.log('')
console.log('# Stripe webhook:')
console.log(webhookUrl)
if (stripe?.webhookEndpoint?.id) {
  console.log(`# Webhook id: ${stripe.webhookEndpoint.id}`)
}
console.log('')
console.log('# Price IDs from last provision:')
for (const p of stripe?.prices ?? []) {
  console.log(`#   ${p.tier}: ${p.id} ($${(p.amount / 100).toFixed(2)}/${p.interval})`)
}

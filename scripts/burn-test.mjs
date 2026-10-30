/**
 * Quick API burn test — measures latency and status for key endpoints.
 * Usage: node scripts/burn-test.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://localhost:3002'

const publicPaths = [
  '/api/health',
  '/api/public/jobs',
  '/api/public/about',
]

const authedPaths = [
  '/api/analytics/dashboard',
  '/api/candidates',
  '/api/job-orders',
  '/api/pipeline',
  '/api/leads',
]

async function hit(path) {
  const url = `${base}${path}`
  const start = performance.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const ms = Math.round(performance.now() - start)
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    const ok = res.ok
    const preview = body.slice(0, 80).replace(/\s+/g, ' ')
    return { path, status: res.status, ms, ok, preview }
  } catch (err) {
    const ms = Math.round(performance.now() - start)
    return { path, status: 0, ms, ok: false, preview: String(err?.message ?? err) }
  }
}

async function main() {
  console.log(`Burn test → ${base}\n`)

  console.log('Public endpoints:')
  for (const path of publicPaths) {
    const r = await hit(path)
    const flag = r.ok ? 'OK' : 'FAIL'
    console.log(`  [${flag}] ${r.status} ${r.ms}ms  ${path}`)
    if (!r.ok) console.log(`        ${r.preview}`)
  }

  console.log('\nAuthed endpoints (expect 401 without token):')
  for (const path of authedPaths) {
    const r = await hit(path)
    const expected = r.status === 401 ? 'OK' : r.ok ? 'OK' : 'FAIL'
    console.log(`  [${expected}] ${r.status} ${r.ms}ms  ${path}`)
    if (expected === 'FAIL') console.log(`        ${r.preview}`)
  }

  console.log('\nParallel dashboard load (simulates old Home page):')
  const parallel = await Promise.all([
    hit('/api/health'),
    hit('/api/candidates'),
    hit('/api/job-orders'),
    hit('/api/analytics/dashboard'),
  ])
  const total = parallel.reduce((s, r) => s + r.ms, 0)
  const max = Math.max(...parallel.map((r) => r.ms))
  for (const r of parallel) {
    console.log(`  ${r.status} ${r.ms}ms  ${r.path}`)
  }
  console.log(`  Total wall time: ${max}ms (parallel) · Sum: ${total}ms`)

  console.log('\nOptimized dashboard load (new Home page):')
  const optimized = await Promise.all([
    hit('/api/health'),
    hit('/api/analytics/dashboard'),
  ])
  const optMax = Math.max(...optimized.map((r) => r.ms))
  for (const r of optimized) {
    console.log(`  ${r.status} ${r.ms}ms  ${r.path}`)
  }
  console.log(`  Total wall time: ${optMax}ms (parallel)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

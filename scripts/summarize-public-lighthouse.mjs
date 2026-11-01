import fs from 'node:fs'

const pages = ['home', 'pricing', 'search', 'sell']
const lines = [
  '## CarMazium simulated mobile Lighthouse baseline (390 × 844)',
  '',
  '| Page | Performance | LCP | CLS | TBT | FCP | Transfer | Hero video requests | Vehicle photos > 1 MiB |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
]
let completed = 0
for (const page of pages) {
  const file = `lighthouse-reports/${page}.json`
  if (!fs.existsSync(file)) {
    lines.push(`| ${page} | Not measured | — | — | — | — | — | — | — |`)
    continue
  }
  const report = JSON.parse(fs.readFileSync(file, 'utf8'))
  const score = report.categories?.performance?.score
  const metric = id => report.audits?.[id]?.displayValue ?? '—'
  const totalBytes = report.audits?.['total-byte-weight']?.numericValue
  const videoRequests = (report.audits?.['network-requests']?.details?.items ?? [])
    .filter(request => /\/assets\/videos\/hero-cinematic(?:-light)?\.mp4(?:\?|$)/.test(request.url ?? '')).length
  // Report large originals without enabling paid Vercel/Supabase image transforms.
  const oversizedVehiclePhotos = (report.audits?.['network-requests']?.details?.items ?? [])
    .filter(request => /\.supabase\.co\/storage\/v1\/object\/public\/listings\//.test(request.url ?? '')
      && (request.transferSize ?? 0) >= 1024 * 1024).length
  const transfer = Number.isFinite(totalBytes) ? (totalBytes / 1024 / 1024).toFixed(2) + ' MiB' : '—'
  lines.push(`| ${page} | ${score == null ? '—' : Math.round(score * 100)} | ${metric('largest-contentful-paint')} | ${metric('cumulative-layout-shift')} | ${metric('total-blocking-time')} | ${metric('first-contentful-paint')} | ${transfer} | ${videoRequests} | ${oversizedVehiclePhotos} |`)
  completed++
}
lines.push('', 'These are **synthetic lab measurements**, not real-user Core Web Vitals; in particular, Lighthouse does not establish field INP. Results vary by runner and network, and should be repeated after changes.')
const summary = lines.join('\n') + '\n'
console.log(summary)
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
if (completed === 0) process.exitCode = 1

# Speed Audit — Elpis Property — 2026-11-10

Status: **baseline complete, no code changed.** Implementation waits for approval.

Measurement location: Cloudflare edge **AMS** (`cf-ray …-AMS`), D1 primary **WEUR**.
That is ~10 ms from the database, so server numbers are best-case. Lagos users are
~100 ms from WEUR; the same query count costs 8–10× more in wall time.

---

## 1. Executive summary

| Rank | Win | Metric | Measured / predicted gain | Confidence | Effort | Risk |
|---|---|---|---|---|---|---|
| 1 | Stop replaying the intro on internal navigation | navigation → usable page | **−1.26 s per internal click** (1.83 s → 0.57 s) | high | S | **UI change, needs approval** |
| 2 | Serve a responsive, self-hosted hero | mobile LCP | **−0.35…−0.70 s** (2.38 s → ~1.7–2.0 s) | high | M | low |
| 3 | Batch the dashboard/analytics D1 reads | API p50 | **−300…−420 ms** at AMS; **−2.0…−3.5 s** from Lagos | high | M | medium |
| 4 | Make date filters sargable | DB time at scale | **−160…−640 ms** on 100k+ payments | medium | S | low |
| 5 | Trim font payload / preload display face | mobile LCP/FCP | **−0.2…−0.35 s** | medium | M | low |
| 6 | Brotli instead of gzip | transfer | **−20…−40 ms** mobile | high | S | low |
| 7 | Cache session + permissions (KV, 30 s) | every API call | **−12…−36 ms** AMS; **−90…−270 ms** Lagos | medium | S | medium |

The backend is **query-count bound, not SQL bound**: app time fits
`app_ms ≈ 0.6 + 12.17 × sequential D1 queries` with **R² = 0.99**.

---

## 2. Platform map

```
Stack:    Cloudflare Worker (vanilla ES modules, no framework/bundler) + D1 (SQLite),
          R2, KV, Queues, Durable Object ChatRoom, Workers Static Assets.
          Node 22 tooling; 178 tests across 6 suites.
Pages:    43 root HTML pages, server-agnostic static shells + assets/js/*.js.
          Heaviest: finance-dashboard (56 KB), index (36 KB), client-dashboard (32 KB).
APIs:     ~96 exact /api routes + parameterised handlers. Hottest: /api/dashboard,
          /api/analytics/performance, /api/finance/overview, /api/client/dashboard,
          /api/clients, /api/leads, /api/commissions.
DB:       79 tables, 164 indexes. Staging data is tiny (1 client, 2 properties,
          2 payments, 3 leads) — all latency here is round-trip/query-count, not data.
Assets:   116 KB CSS raw (22 KB gzip), 464 KB JS raw (26 KB in first viewport),
          232 KB fonts, 7 woff2. No bundler, no minifier.
Hosting:  one Worker on the apex Custom Domain; www routed + 301 since 2026-11-10.
          HTML max-age=60 SWR 300; /assets/* max-age=3600 SWR 86400; gzip, no brotli.
3rd-party: images.unsplash.com (hero + galleries), Cloudflare Web Analytics beacon
          (auto-injected), wa.me links (click only). No analytics/ad SDKs in the repo.
Background: daily cron 06:00 (reminders, SMS schedules, ALATPay reconciliation,
          commission retry/backfill, test-account expiry, retention cleanup);
          queue consumer for notification/SMS delivery. No request-path queueing.
Uploads:  property images/documents uploaded through the Worker to private R2;
          published images served through the Worker; no resize/transcode pipeline.
Auth:     ELPIS_session cookie → sessions table → 1 D1 read on every request.
Observe:  Workers Logs on, Server-Timing on every response, no RUM/APM/Sentry.
          No performance budgets in CI.
```

---

## 3. Baseline

### 3.1 Core Web Vitals (lab, fresh context)

Mobile = 390×844, Slow 4G (1.6 Mbps / 750 kbps, 150 ms RTT), 4× CPU throttle.

| Page | TTFB | FCP | LCP | CLS | Weight |
|---|---:|---:|---:|---:|---:|
| `/` | 429–484 ms | 1.65–1.82 s | **2.26–2.38 s** | 0–0.13 | 566 KB / 20 req |
| `/login` | 224 ms | 404 ms | 404 ms | 0.005 | 92 KB / 15 req |
| `/dashboard` (staff) | 660 ms | 1.88 s | **1.88–2.00 s** | 0–0.96 (one run) | 183 KB / 21 req |
| `/client-dashboard` | 448 ms | 1.67 s | **1.67 s** | 0.168 | 183 KB / 22 req |
| `/finance-dashboard` | 230 ms | 636 ms | 636 ms | 0 | 110 KB / 22 req |

Desktop (1440×900, no throttle): `/` LCP 1.24 s / CLS 0.077; `/dashboard` LCP 0.94 s;
`/client-dashboard` LCP 0.95 s.

CLS is unstable across runs (0–0.96). The 0.96 run came from a cold font swap on the
dashboard shell; with warm fonts CLS is 0–0.08. Treat it as a font-metrics issue, not a
layout rewrite.

### 3.2 Page TTFB (30 samples each, TLS excluded)

| Page | p50 | p95 | p99 |
|---|---:|---:|---:|
| `/` | 208 ms | 235 ms | 263 ms |
| `/login` | 219 ms | 272 ms | 302 ms |
| `/client-login` | 207 ms | 243 ms | 267 ms |
| `/properties` | 215 ms | 234 ms | 253 ms |
| `/dashboard` | 215 ms | 271 ms | 332 ms |

TTFB here is our distance to AMS. User-side TTFB from Lagos/London is lower; the
server-side cost is the D1 work, below.

### 3.3 API latency (40 samples, Server-Timing `app;dur`, ms)

| Endpoint | p50 | p95 | p99 | Wall TTFB p50 |
|---|---:|---:|---:|---:|
| `/api/dashboard` | **433** | **474** | **528** | 737 ms |
| `/api/analytics/performance` | **347** | **423** | **499** | 619 ms |
| `/api/finance/overview` | 102 | 146 | 156 | 321 ms |
| `/api/client/dashboard` | 111 | 134 | 183 | 335 ms |
| `/api/client/payments` | 54 | 61 | 63 | 255 ms |
| `/api/leads` | 44 | 53 | 54 | 248 ms |
| `/api/commissions` | 43 | 56 | 65 | 244 ms |
| `/api/installments` | 42 | 55 | 78 | 246 ms |
| `/api/staff` | 36 | 44 | 59 | 237 ms |
| `/api/clients` | 29 | 34 | 48 | 225 ms |
| `/api/site-config` | 23 | 30 | 37 | 223 ms |
| `/api/me` | 22 | 26 | 32 | 224 ms |
| `/api/health` (no DB) | 0 | 0 | 0 | 203 ms |

Method note: probe accounts were created for the run and deleted afterwards; the demo
accounts were deactivated separately as requested.

### 3.4 Database

Sequential round trips per request (static count of `env.DB.prepare` on the executed path):

| Path | D1 round trips |
|---|---:|
| `/api/dashboard` | ~30–38 |
| `/api/analytics/performance` | ~29 |
| `/api/client/dashboard` | ~12 |
| `/api/finance/overview` | 9 |
| `/api/clients` | 2 |
| `/api/commissions` | 3 |

Regression across 9 endpoints: `app_ms = 0.6 + 12.17 × queries`, **R² = 0.99**.
Every extra `await env.DB.prepare(...)` costs one edge→D1 round trip.

Query hygiene (whole Worker):

- `date(column)` predicates: **31** — non-sargable, defeats `verified_at`/`created_at` indexes.
- `SELECT *`: **66**.
- Leading-wildcard `LIKE '%…%'`: **31** (client search does a filtered scan; fine at 1 row, not at 50k).
- `OFFSET` pagination: **14** (deep pages get slower, not the current bottleneck).
- Indexes are otherwise good: 164 indexes; clients, payments, leads and commissions have
  composite indexes from Phase 8 (`idx_clients_active_created`, `idx_payments_revenue_date`,
  `idx_commissions…`). No missing index shows up in the current plans.

### 3.5 Assets

| Item | Size |
|---|---:|
| Home hero (CSS background, Unsplash 2400w q90 AVIF) | **433 KB** |
| Same image at 1200w q75 / 800w q70 | 107 KB / 52 KB |
| Home second image (1200w) | 86 KB |
| CSS (gzip) | 22 KB |
| Fonts in first viewport (DM Sans 61 + Cormorant 39 + 37) | 137 KB |
| JS first viewport | 26 KB |

Other pages request 3–4 woff2 files even when only DM Sans is used (dashboard 85 KB fonts).

### 3.6 Navigation (the intro)

Measured click on `/login` → `/signup`:

```
page load              565 ms
intro overlay removed 1829 ms   → +1.26 s before the page is usable
```

`assets/js/motion.js` returns `"short"` for internal navigation (`NAV_MARKER`), which is
1.2 s of overlay on **every** internal link. Direct loads play the 3.8 s `QUICK` intro.

---

## 4. Ranked bottlenecks

Sorted by measured user impact, then effort/risk. Predicted savings are ranges, not sums —
several fixes move the same metric.

### B1 — Intro overlay replays on every internal navigation
- **Evidence**: click → overlay gone 1.83 s while load is 0.57 s. `motion.js` maps internal
  navigation to the `SHORT` 1.2 s animation; direct loads use `QUICK` 3.8 s.
- **Fix**: skip the overlay for internal navigation (or show once per session and honour
  `prefers-reduced-motion`). Config-only change in `intro-config.js` / `motion.js`.
- **Predicted**: **−1.1…−1.3 s per internal navigation** (high).
- **Effort** S. **Risk**: UI/UX change — explicitly outside the "no UI change" contract,
  so it needs your approval.

### B2 — Hero image is a 433 KB third-party CSS background
- **Evidence**: `styles.css` sets `.hero-media` to Unsplash `w=2400&q=90`; 433 KB AVIF on
  mobile. Blocking the image drops mobile LCP 2.38 s → 1.77 s. The same image is 107 KB at
  1200w/75 and 52 KB at 800w/70.
- **Fix**: responsive `image-set()`/`<picture>` with 800/1200/1600 widths, self-host the
  chosen original, keep the same crop and position. No visual change.
- **Predicted**: **−0.35…−0.70 s LCP mobile** (high); −0.1…−0.3 s desktop.
- **Effort** M. **Risk** low (visual regression is the only risk; screenshot diff).

### B3 — Dashboard and analytics run 30+ sequential D1 queries
- **Evidence**: 433 ms p50 / 528 ms p99 dashboard; 347 ms analytics; regression R² = 0.99 at
  12.17 ms per sequential query. `buildAnalytics` alone has 29 `prepare` calls; the dashboard
  executes ~30–38. From Lagos each round trip is ~80–120 ms, so the same path is ~2.5–4 s.
- **Fix**: `env.DB.batch([...])` for independent reads (analytics aggregates/trends, dashboard
  secondary panels), and compute period + trend buckets in fewer grouped queries. Response
  JSON stays byte-identical.
- **Predicted**: **−300…−420 ms p50 at AMS** (high); **−2.0…−3.5 s from Lagos** (medium).
- **Effort** M. **Risk** medium (ordering/conditional queries), mitigated by flags + contract
  tests.

### B4 — 31 `date(column)` predicates defeat indexes
- **Evidence**: e.g. `date(p.verified_at) BETWEEN date(?) AND date(?)` in every analytics
  period/trend query. SQLite cannot use `idx_payments_verified` when the column is wrapped.
  Plans at today's row counts still pick `idx_payments_status`, so the cost is invisible
  until data grows.
- **Fix**: `p.verified_at >= ? AND p.verified_at < date(?, '+1 day')` (same UTC semantics),
  with boundary tests at midnight and month ends.
- **Predicted**: ~0 ms today; **−160…−640 ms** across the 8 analytics date queries at 100k
  payments (medium — needs production-scale data).
- **Effort** S. **Risk** low (date-boundary tests).

### B5 — Fonts: 137 KB in the hero viewport, 3 faces loaded
- **Evidence**: home transfers DM Sans 61 KB + Cormorant 39 KB + 37 KB; dashboard loads 85 KB
  of fonts for one family. FCP 1.65–1.82 s on 4G; with the hero image blocked, LCP falls to
  1.77 s — i.e. text is still late.
- **Fix**: preload the display face used by the H1 (Cormorant normal), drop unused weights,
  and add `size-adjust`/fallback metrics to kill the intermittent CLS. Visual output unchanged.
- **Predicted**: **−0.2…−0.35 s LCP/FCP mobile** (medium); CLS 0.96 outlier removed.
- **Effort** M. **Risk** low (screenshot/A-B diff).

### B6 — gzip only, no Brotli
- **Evidence**: `content-encoding: gzip` on HTML/CSS; 22 KB CSS, 33 KB home HTML.
- **Fix**: let Cloudflare serve Brotli (it does when the client advertises it; verify rules)
  or pre-compress static assets.
- **Predicted**: **−20…−40 ms** mobile first load (high, small).
- **Effort** S. **Risk** low.

### B7 — Session/permission lookups on every request
- **Evidence**: every endpoint starts with `getSessionUser` (1 query) and, for some roles,
  `resolvePhase6Scope` adds 2–3. `/api/me` is 22 ms p50 for one query.
- **Fix**: KV cache of session→user and role→permissions with a 30 s TTL, invalidated on
  logout, permission change and deactivation.
- **Predicted**: **−12…−36 ms** AMS; **−90…−270 ms** Lagos (medium).
- **Effort** S. **Risk** medium (stale permissions) — flag + explicit invalidation + tests.

### B8 — Client search does a filtered table scan
- **Evidence**: `full_name LIKE '%q%' OR client_reference LIKE '%q%' OR phone LIKE '%q%'`;
  plan uses `idx_clients_active_created` for the sort, then filters every row.
- **Fix**: FTS5 virtual table for name/reference/phone, or trigram index.
- **Predicted**: ~0 today; **−100…−400 ms** at 50k clients (medium, needs data).
- **Effort** L. **Risk** medium. Not worth doing before data grows.

### Considered and rejected
- Bypassing the Worker for static assets: Worker overhead is 4–7 ms (`Server-Timing app;dur`),
  so the gain is negligible versus the security-header risk.
- Shared caching of dashboard/API responses: private financial data; a wrong cache is a bug.
- Framework/bundler rewrite: JS is 26 KB in the first viewport; no measured benefit.
- Replacing D1: not justified — the cost is round trips, not SQL.

---

## 5. Implementation plan (after approval)

Safe wins, all behind env flags defaulting to off, one-line rollback in `wrangler.toml`:

| Flag | Change | Rollback |
|---|---|---|
| `PERF_BATCH_QUERIES` | batch independent D1 reads in analytics/dashboard/finance | set to `"0"` / redeploy |
| `PERF_SARGABLE_DATES` | date-range predicates without `date()` wrapping | set to `"0"` |
| `PERF_SESSION_CACHE` | KV session/permission cache (30 s TTL + invalidation) | set to `"0"` |
| `PERF_RESPONSIVE_HERO` | responsive self-hosted hero, same crop | revert asset/CSS |
| `PERF_FONT_TRIM` | preload display face, drop unused weights | revert CSS |

Process:
1. Snapshot contract tests for every touched endpoint (JSON keys, types, status, pagination).
2. Capture the same benchmark tables before/after (40 samples per endpoint, mobile 4G CWV).
3. Ship with the flag off, verify parity, enable per flag, watch error rate + p95.
4. Keep API response shapes byte-identical and the UI pixel-identical.

Needs your explicit sign-off because it changes UX: **B1 intro navigation** (1.26 s/click).

---

## 6. Method & caveats

- API numbers: 40 warm samples per endpoint, `Server-Timing app;dur` + wall TTFB.
- Page numbers: Chromium lab runs (fresh context), Slow 4G + 4× CPU; CLS sampled 5×.
- Server location: AMS edge → WEUR D1. Lagos projections are an RTT model (medium confidence),
  not field data. There is no RUM in the product yet; adding one is the first monitoring win.
- Staging data is too small to expose SQL cost. Items B4/B8 are plan-level findings and are
  marked scale-dependent rather than given a fake current-ms number.

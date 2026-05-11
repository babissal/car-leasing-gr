# Stack Research — Greek Car Leasing Aggregator

## Recommendation Summary

**Backend:** Node.js + Express (or FastAPI if Python preferred)
**Scraping:** Playwright (headless Chromium)
**Frontend:** React + Vite (or plain HTML/JS for v1 simplicity)
**Storage:** In-memory (no DB for v1) — scraped results held in memory per session
**Data format:** JSON normalization layer

---

## Scraping Layer

### Playwright — RECOMMENDED ✅
- **Version:** ^1.45 (2025)
- **Why:** Best-in-class for JS-heavy sites. Waits for network idle, handles SPAs, has auto-waiting built in. All 5 target sites likely render via React/Vue — Playwright handles this natively.
- **Language:** Available in Node.js (primary) and Python
- **Key features:** `page.waitForSelector()`, `page.waitForLoadState('networkidle')`, stealth mode via `playwright-extra` + `puppeteer-extra-plugin-stealth`

### Puppeteer — Alternative
- Similar capability to Playwright but Playwright has better multi-browser support and is more actively maintained
- NOT recommended over Playwright in 2025

### Cheerio + Axios — NOT recommended for these sites
- Works only for static HTML sites
- Greek leasing sites (instacar, spotawheel) are SPAs — Cheerio will get empty divs

### Selenium — NOT recommended
- Heavier, slower, more complex setup. Playwright superseded it for modern scraping.

---

## Backend

### Node.js + Express — RECOMMENDED ✅
- **Why:** Same language as Playwright (no context switch), fast to set up, easy WebSocket support for streaming scrape progress
- **Version:** Node 20 LTS + Express 4.x
- **Alternative:** Fastify (slightly faster, but Express is more familiar)

### Python + FastAPI — Alternative
- Good if Python is preferred. Playwright has a Python SDK.
- Slightly more overhead to wire up async scraping
- **Use if:** You prefer Python

---

## Frontend

### React + Vite — RECOMMENDED for public product ✅
- **Why:** Component model is ideal for filterable tables, good ecosystem for data grids
- **Version:** React 18 + Vite 5
- **UI library:** shadcn/ui (Tailwind-based, no extra bundle cost) or plain Tailwind

### Plain HTML/CSS/JS — RECOMMENDED for v1 local tool ✅
- **Why:** Zero build tooling, faster to start, sufficient for a personal localhost tool
- Upgrade to React when going public
- Use a CDN-loaded library like Alpine.js for reactivity if needed

### Vue 3 — Alternative
- Similar to React. Fine choice if Vue is preferred.

---

## Data Storage

### In-Memory (JSON) — RECOMMENDED for v1 ✅
- Scraped results stored as a JavaScript object/array in the backend process
- Sufficient for local use: scrape on demand, serve to UI, discard on next scrape
- Zero setup — no database needed

### SQLite — Recommended when going public
- Lightweight file-based DB, no server needed
- Add when price history or user preferences are needed
- **Library:** `better-sqlite3` (Node) or `sqlite3` (Python)

### PostgreSQL / MongoDB — NOT needed for v1
- Overkill for a local personal tool

---

## Anti-Bot Handling

```
playwright-extra + puppeteer-extra-plugin-stealth
```

- Patches Playwright to pass common bot detection tests
- Randomize user agents, viewport sizes, mouse movements
- Add delays between requests (500ms–2s jitter)
- Respect `robots.txt` — check each site before scraping

---

## Recommended v1 Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Scraping | Playwright + stealth plugin | JS-heavy sites, anti-bot |
| Backend | Node.js + Express | Same language as scraper |
| Frontend | Plain HTML + Alpine.js | Simple, no build step |
| Storage | In-memory JSON | No DB needed |
| Package manager | npm or pnpm | Standard |
| Runtime | Node 20 LTS | Current LTS |

---

## Confidence Levels

| Decision | Confidence | Notes |
|----------|------------|-------|
| Playwright for scraping | HIGH | Industry standard for JS-heavy sites in 2025 |
| Node.js backend | HIGH | Best fit with Playwright |
| In-memory storage | HIGH | Correct for v1 scope |
| Plain HTML for v1 UI | MEDIUM | Pragmatic, upgrade path clear |
| React for public v2 | HIGH | Standard choice for filterable UI |

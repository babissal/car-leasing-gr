<!-- GSD:project-start source:PROJECT.md -->
## Project

**Greek Car Leasing Aggregator**

A web application that scrapes Greek car leasing company websites on demand and presents their offers in a unified, filterable interface. The goal is to eliminate the tedious process of visiting each leasing site individually and manually comparing offers — instead, one search shows you the best deals across all companies side by side.

**Core Value:** **Cross-company comparison in one place.** The aggregator is only useful if it covers all target companies simultaneously — partial coverage defeats the purpose.

### Constraints

- **Local deployment for now** — runs on localhost, no hosting needed initially
- **On-demand scraping** — user triggers refresh manually, no scheduled jobs in v1
- **Latest data only** — no price history tracking in v1
- **Greek market** — Greek leasing companies, Greek-language sites expected
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommendation Summary
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
## Backend
### Node.js + Express — RECOMMENDED ✅
- **Why:** Same language as Playwright (no context switch), fast to set up, easy WebSocket support for streaming scrape progress
- **Version:** Node 20 LTS + Express 4.x
- **Alternative:** Fastify (slightly faster, but Express is more familiar)
### Python + FastAPI — Alternative
- Good if Python is preferred. Playwright has a Python SDK.
- Slightly more overhead to wire up async scraping
- **Use if:** You prefer Python
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
## Anti-Bot Handling
- Patches Playwright to pass common bot detection tests
- Randomize user agents, viewport sizes, mouse movements
- Add delays between requests (500ms–2s jitter)
- Respect `robots.txt` — check each site before scraping
## Recommended v1 Tech Stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Scraping | Playwright + stealth plugin | JS-heavy sites, anti-bot |
| Backend | Node.js + Express | Same language as scraper |
| Frontend | Plain HTML + Alpine.js | Simple, no build step |
| Storage | In-memory JSON | No DB needed |
| Package manager | npm or pnpm | Standard |
| Runtime | Node 20 LTS | Current LTS |
## Confidence Levels
| Decision | Confidence | Notes |
|----------|------------|-------|
| Playwright for scraping | HIGH | Industry standard for JS-heavy sites in 2025 |
| Node.js backend | HIGH | Best fit with Playwright |
| In-memory storage | HIGH | Correct for v1 scope |
| Plain HTML for v1 UI | MEDIUM | Pragmatic, upgrade path clear |
| React for public v2 | HIGH | Standard choice for filterable UI |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

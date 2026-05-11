# Research Summary — Greek Car Leasing Aggregator

## Stack

**Scraping:** Playwright + `playwright-extra` stealth plugin (handles JS-heavy SPAs, anti-bot)
**Backend:** Node.js + Express
**Frontend:** Plain HTML + Alpine.js for v1 (React for public v2)
**Storage:** In-memory JSON (no DB in v1)

The target sites (Spotawheel, Instacar, Ayvens, etc.) are modern JS-rendered apps — Axios/Cheerio will not work. Playwright is the correct choice.

## Table Stakes (must ship v1)

- Filter by car type, fuel type, duration, 0 advance payment
- Monthly price as primary metric (with VAT)
- km/year and services (insurance/maintenance/tyres) displayed per offer
- Sort by price
- Source attribution + click-through link to original offer
- On-demand scrape trigger with per-source progress feedback
- Scrape freshness timestamp

## Architecture

Five scraper adapters behind a common interface → normalization layer → in-memory store → Express API → filter/sort UI.

Each adapter is an independent module. A failing adapter must not block others (`Promise.allSettled`). The `CommonOffer` schema is the central contract — define it first.

## Watch Out For

1. **Schema normalization** — sites show prices ex-VAT vs incl-VAT, services bundled differently, fuel type in Greek text. Normalize to English enums + VAT-included prices. Default services to `false` if not explicit.
2. **Anti-bot detection** — use stealth plugin from day one, add jitter delays, randomize user agents. Ayvens.com (corporate) likely has stronger protection.
3. **Silent scraper failures** — if an adapter returns 0 results, treat it as an error, not empty. Always assert minimum result count.
4. **Duration/payment variants** — pass the user's selected duration and advance payment as scrape parameters to avoid showing 12 variants of the same car.
5. **Scrape duration UX** — 30–90 seconds is normal for 5 sites. Use SSE/streaming to show per-source progress. Don't make the user stare at a blank screen.
6. **Local→public transition** — don't couple scraping to the HTTP request lifecycle. Use async jobs + polling/SSE so a scrape queue can be dropped in later without rewriting the API.

## Greek Market Notes

- Full-service operational leasing is standard — insurance/maintenance/tyres often bundled
- 24/36 months are the common durations
- Sites mix VAT-included and ex-VAT prices — always normalize to incl-VAT (24%)
- Greek fuel type labels need mapping: "Βενζίνη" → Petrol, "Ηλεκτρικό" → Electric, etc.

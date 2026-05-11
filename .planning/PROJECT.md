# Greek Car Leasing Aggregator

## What This Is

A web application that scrapes Greek car leasing company websites on demand and presents their offers in a unified, filterable interface. The goal is to eliminate the tedious process of visiting each leasing site individually and manually comparing offers — instead, one search shows you the best deals across all companies side by side.

## Core Value

**Cross-company comparison in one place.** The aggregator is only useful if it covers all target companies simultaneously — partial coverage defeats the purpose.

## Problem

Finding the best car lease in Greece requires visiting 5+ company websites, each with different UX, different ways of presenting pricing, and different filter options. There's no single place to answer: "What's the cheapest plug-in hybrid SUV I can lease right now for 24 months with 0 down payment?"

## Who It's For

- **Now:** Personal use — the builder's own leasing decision
- **Later:** Public product for Greek car buyers facing the same problem

## Target Data Sources

| Company | URL |
|---------|-----|
| Spotawheel | spotawheel.gr |
| Instacar | instacar.gr |
| Executive Lease | executivelease.gr |
| Ayvens | ayvens.com |
| Easy Rental | easyrental.gr |

Additional sources may be added if their data is accessible.

## Key Filters & Data Points

### Filters
- **Car type** — SUV, hatchback, sedan, estate, etc.
- **Fuel type** — petrol, diesel, plug-in hybrid, electric, hybrid
- **Lease duration** — 12 / 24 / 36 / 48 months (fixed selection)
- **Down payment** — 0 advance payment (primary use case)
- **Included km/year** — mileage cap comparison
- **Included services** — insurance, maintenance, tyres
- **Car brand / model** — filter to specific makes or models
- **CO2 / emissions** — for tax planning or environmental preference

### Key Metric
**Monthly price** with a specific duration and 0 advance payment — this is the primary sort/compare axis.

## What "Done" Looks Like

1. Open the web app locally
2. Select filters (e.g. SUV, Plug-in Hybrid, 24 months, 0 down)
3. Click "Refresh" to trigger live scraping
4. See a sorted table of matching offers from all 5 companies
5. Identify the best deal with all relevant details visible

## Constraints

- **Local deployment for now** — runs on localhost, no hosting needed initially
- **On-demand scraping** — user triggers refresh manually, no scheduled jobs in v1
- **Latest data only** — no price history tracking in v1
- **Greek market** — Greek leasing companies, Greek-language sites expected

## Technical Notes

- Sites likely use dynamic JS rendering — scraping may require headless browser (Playwright/Puppeteer)
- Each site will need a dedicated scraper adapter since they have different structures
- Data should be normalized into a common schema before display
- Scraping is legally grey — rate limit requests, respect robots.txt

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scrape Spotawheel.gr offers
- [ ] Scrape Instacar.gr offers
- [ ] Scrape Executivelease.gr offers
- [ ] Scrape Ayvens.com offers
- [ ] Scrape Easyrental.gr offers
- [ ] Normalize all scraped data into a common schema
- [ ] Filter by car type
- [ ] Filter by fuel type
- [ ] Filter by lease duration
- [ ] Filter by advance payment (0 down)
- [ ] Filter by km/year
- [ ] Filter by included services
- [ ] Filter by car brand/model
- [ ] Show CO2/emissions data
- [ ] On-demand scrape trigger from UI
- [ ] Sortable results table (sort by monthly price)
- [ ] Web UI running locally

### Out of Scope

- Price history tracking — not needed in v1
- Scheduled/automated scraping — on-demand only
- Cloud hosting / public deployment — later milestone
- User accounts / authentication — later milestone
- Email alerts / notifications — later milestone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| On-demand scraping only | Simplicity for v1, no scheduler infrastructure needed | — Pending |
| Local deployment first | Get the tool working for personal use before productizing | — Pending |
| All 5 companies in v1 | Tool is only useful with cross-company comparison | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-11 after initialization*

# Phase 1: Foundation & First Working Scraper - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete end-to-end pipeline for one scraper: define the CommonOffer schema, set up the Node.js + Express backend, create Playwright scraper infrastructure, implement the Instacar.gr adapter, store results in-memory, and serve a basic HTML UI where the user selects duration, triggers a scrape, and sees results in a sortable table.

**In scope:** CommonOffer schema, base Playwright setup, Instacar.gr scraper only, duration selection as scrape parameter, basic HTML results table, sort by price, source attribution + link, scrape timestamp.

**Out of scope:** Other scrapers (Phase 2), real-time SSE progress (Phase 3), all filter dimensions beyond duration (Phase 4), anti-bot hardening (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Scraper Navigation Strategy

- **D-01:** Use Playwright UI clicks to apply filters on Instacar.gr — navigate to the listing page, interact with filter dropdowns/buttons via Playwright, then wait for filtered results to load before scraping.
- **D-02:** Handle pagination dynamically — write scraper logic that detects whether the results page uses infinite scroll (scroll-to-load) or traditional pagination (Next page button) and handles both.
- **D-03:** Use a mixed data sourcing strategy — scrape price, km/year, car type, fuel type, brand, model from the listing cards; navigate into each offer's detail page to get CO2 and services (insurance/maintenance/tyres) which only appear there.
- **D-04:** Load detection: wait for a listing card element to appear (`waitForSelector`) after applying filters. Use `networkidle` as a fallback if the primary selector approach is unreliable. This avoids brittle fixed delays.

### Schema Design

- **D-05:** Define `CommonOffer` as the first artifact before any scraper code — every field must be agreed before Instacar adapter is written. Key fields: source, sourceUrl, brand, model, carType, fuelType, monthlyPrice (EUR incl. VAT), advancePayment, durationMonths, kmPerYear, servicesIncluded {insurance, maintenance, tyres}, co2gKm (nullable), scrapedAt.
- **D-06:** All prices normalized to EUR including 24% Greek VAT. Scraper must detect whether source price is VAT-inclusive or exclusive and convert accordingly.
- **D-07:** Fuel type stored as English enum: Petrol | Diesel | Hybrid | PHEV | Electric. Greek labels on the site mapped to these enums in the normalization layer.

### Project Structure

- **D-08 (Claude's discretion):** Single Node.js project at root — Express serves both the API and static HTML files from a `/public` directory. No separate frontend build step in Phase 1. Plain HTML + minimal JS (Alpine.js for reactivity or vanilla JS).

### Missing Data Handling

- **D-09 (Claude's discretion):** Fields not found during scraping default to `null` (not omitted). CO2 shown as "N/A" in UI, services default to `false` if not explicitly found. Offers with null `monthlyPrice` are dropped (price is required).

### Claude's Discretion

- **Load detection:** `waitForSelector` with `networkidle` fallback (D-04)
- **Project layout:** Single package, Express serves static files (D-08)
- **Missing data:** null fields, drop if monthlyPrice missing (D-09)
- **TypeScript vs JS:** Plain JavaScript for v1 simplicity — no compilation step
- **Advance payment for Phase 1:** Pass `0` as the advance payment parameter (matching the user's primary use case); user selects only duration in the Phase 1 UI

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — project vision, target companies, core value statement
- `.planning/REQUIREMENTS.md` — full v1 requirements with REQ-IDs (DATA-01–08, SCR-02, ORCH-02, ORCH-03, FILT-03, UI-01–04)

### Phase Scope
- `.planning/ROADMAP.md` Phase 1 section — success criteria (5 items to verify)

### Research Findings
- `.planning/research/STACK.md` — technology choices and rationale (Playwright, Express, plain HTML)
- `.planning/research/ARCHITECTURE.md` — component breakdown, CommonOffer schema, data flow, build order
- `.planning/research/PITFALLS.md` — critical pitfalls: schema normalization (Pitfall 3), VAT handling, silent scraper failures (Pitfall 1), duration/payment variants (Pitfall 5)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing code.

### Established Patterns
- None yet — Phase 1 establishes all foundational patterns that later phases will follow.

### Integration Points
- CommonOffer schema defined in Phase 1 becomes the contract for all Phase 2–5 adapters. Schema changes after Phase 2 starts would require updating all adapters.

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants Playwright UI interaction (not URL params) for Instacar.gr — this implies the scraper must understand the site's filter UI, not just construct URLs.
- User acknowledged CO2/services require detail page visits — this means the scraper must open each offer's page individually, which makes scraping slower. The planner should note this and add an appropriate per-offer timeout.
- Pagination strategy should be dynamic: detect at runtime whether results scroll or paginate.

</specifics>

<deferred>
## Deferred Ideas

- Project structure discussion (TypeScript, monorepo, separate frontend) — user didn't select this area; Claude chose pragmatic defaults. Can revisit if needed.
- UI styling beyond a functional table — Phase 4/5 concern.
- Anti-bot measures (stealth plugin, proxy) — Phase 5.
- Additional scrapers — Phase 2.
- SSE progress streaming — Phase 3.
- All filters beyond duration — Phase 4.

</deferred>

---

*Phase: 1-Foundation & First Working Scraper*
*Context gathered: 2026-05-11*

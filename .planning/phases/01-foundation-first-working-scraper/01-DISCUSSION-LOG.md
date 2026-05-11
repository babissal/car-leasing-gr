# Phase 1: Foundation & First Working Scraper - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 1-Foundation & First Working Scraper
**Areas discussed:** Scraper navigation

---

## Scraper Navigation

### Q1: How should the Instacar.gr scraper find offers?

| Option | Description | Selected |
|--------|-------------|----------|
| URL parameters | Build URL with filter params, navigate directly | |
| Playwright UI clicks | Navigate to site and interact with filter UI via Playwright | ✓ |
| Scrape all, filter client-side | Scrape all offers, filter in our app | |
| Let me check first | Check site structure before deciding | |

**User's choice:** Playwright UI clicks
**Notes:** User wants the scraper to interact with the site's filter interface, not construct URLs.

---

### Q2: How should the scraper collect all offers after filtering?

| Option | Description | Selected |
|--------|-------------|----------|
| Scroll to load more | Infinite scroll — scraper scrolls until no new offers appear | |
| Click through pages | Paginated — scraper clicks Next until exhausted | |
| All visible at once | All results render on a single page | |
| Not sure — handle both | Detect pagination vs infinite scroll dynamically | ✓ |

**User's choice:** Not sure — handle both
**Notes:** Scraper should detect at runtime whether pagination is scroll-based or button-based.

---

### Q3: Where does each offer's detail data come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Listing page only | All key data visible on listing cards | |
| Must open each offer | All data on detail page | |
| Mix — depends on field | Price/km on listing; CO2/services on detail page | ✓ |

**User's choice:** Mix — depends on field
**Notes:** Price, km/year, car type, fuel type scraped from listing cards. CO2 and services (insurance/maintenance/tyres) require navigating into each offer's detail page.

---

### Q4: How should the scraper detect when results are ready?

| Option | Description | Selected |
|--------|-------------|----------|
| Wait for network idle | `page.waitForLoadState('networkidle')` — reliable but slow | |
| Wait for a specific element | `waitForSelector` — faster, breaks if selector changes | |
| Fixed delay + element check | Short delay then check results element | |
| (User response) | "I am not sure" | |

**User's choice:** Deferred to Claude
**Notes:** User was unsure. Claude decided: `waitForSelector` for a listing card element, with `networkidle` as fallback.

---

## Claude's Discretion

- **Load detection:** `waitForSelector` + `networkidle` fallback
- **Project structure:** Single Node.js package, Express serves static HTML from `/public`
- **TypeScript:** Plain JavaScript (no compilation step in v1)
- **Missing data:** null fields, drop offer if `monthlyPrice` is null
- **Advance payment for Phase 1 UI:** Fixed at 0 (user's primary use case); only duration selectable

## Deferred Ideas

- Project structure discussion (TypeScript, separate frontend) — user didn't select this area
- Other scraper sites — Phase 2
- SSE progress streaming — Phase 3
- All filter dimensions — Phase 4
- Anti-bot hardening — Phase 5

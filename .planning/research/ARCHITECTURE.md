# Architecture Research — Greek Car Leasing Aggregator

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (UI)                        │
│  Filters panel ──► Results table ──► "Refresh" button   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (REST or SSE)
┌────────────────────────▼────────────────────────────────┐
│                   Express API Server                    │
│  POST /scrape ──► Scraper Orchestrator                  │
│  GET  /offers ──► Return cached results                 │
└──────┬───────────────────────────────────────────────── ┘
       │ Spawns parallel scraper adapters
┌──────▼──────────────────────────────────────────────────┐
│                 Scraper Adapters (1 per site)           │
│  SpotawheelScraper  InstacarScraper  AyvensScraper      │
│  ExecutiveLeaseScraper  EasyRentalScraper               │
└──────┬──────────────────────────────────────────────────┘
       │ Each adapter returns raw structured data
┌──────▼──────────────────────────────────────────────────┐
│               Normalization Layer                       │
│  Maps each site's schema → CommonOffer schema           │
└──────┬──────────────────────────────────────────────────┘
       │ Normalized offers array
┌──────▼──────────────────────────────────────────────────┐
│                  In-Memory Store                        │
│  { offers: CommonOffer[], scrapedAt: Date }             │
└─────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Express API Server
**Responsibilities:**
- Serve the frontend static files
- Expose `/api/scrape` (POST) — triggers scraping all adapters in parallel
- Expose `/api/offers` (GET) — returns current in-memory results
- Optional: Server-Sent Events (SSE) on `/api/scrape/progress` for real-time progress

**Interfaces:**
- In: HTTP requests from browser
- Out: JSON responses, static HTML/JS files

---

### 2. Scraper Orchestrator
**Responsibilities:**
- Run all scraper adapters in parallel (`Promise.all`)
- Collect results and errors from each
- Pass results through normalization layer
- Write to in-memory store

**Pattern:**
```js
const results = await Promise.allSettled([
  SpotawheelScraper.scrape(),
  InstacarScraper.scrape(),
  AyvensScraper.scrape(),
  ExecutiveLeaseScraper.scrape(),
  EasyRentalScraper.scrape(),
])
// Handle fulfilled/rejected per adapter
```

**Key behavior:** One failing adapter must NOT block the others.

---

### 3. Scraper Adapters (Plugin Pattern)

Each adapter implements the same interface:

```typescript
interface ScraperAdapter {
  source: string;          // "Spotawheel" | "Instacar" | etc.
  url: string;             // entry URL for scraping
  scrape(): Promise<RawOffer[]>;
}
```

**Directory structure:**
```
scrapers/
  base.js              ← shared Playwright setup
  spotawheel.js
  instacar.js
  ayvens.js
  executivelease.js
  easyrental.js
```

**Adding a new scraper:** Create a new file implementing the interface. Register in the orchestrator array. Zero changes to other components.

---

### 4. Normalization Layer

Maps each site's raw scrape output → `CommonOffer` schema:

```typescript
interface CommonOffer {
  source: string;           // "Spotawheel"
  sourceUrl: string;        // direct link to offer
  brand: string;            // "Toyota"
  model: string;            // "RAV4"
  carType: string;          // "SUV"
  fuelType: string;         // "PHEV" | "Electric" | "Petrol" | "Diesel" | "Hybrid"
  monthlyPrice: number;     // in EUR, including VAT
  advancePayment: number;   // 0 for zero-down
  durationMonths: number;   // 12 | 24 | 36 | 48
  kmPerYear: number;        // 15000 | 20000 | 30000
  servicesIncluded: {
    insurance: boolean;
    maintenance: boolean;
    tyres: boolean;
  };
  co2gKm: number | null;    // null if not available
  scrapedAt: Date;
}
```

Each adapter returns `RawOffer[]`. Normalization maps field names, parses strings to numbers, standardizes fuel type labels (Greek → English), etc.

---

### 5. In-Memory Store

Simple module-level variable:

```js
let store = { offers: [], scrapedAt: null, errors: [] };
```

Reset on each scrape. No persistence. Sufficient for local use.

---

## Data Flow (One User Interaction)

1. User sets filters and clicks "Refresh" in the browser
2. Browser sends `POST /api/scrape`
3. Server spawns Orchestrator
4. Orchestrator runs 5 adapters in parallel via Playwright
5. Each adapter navigates site, extracts raw offers, returns array
6. Normalization maps each raw offer → CommonOffer
7. Normalized offers written to in-memory store
8. Server responds with offers (or: SSE streams progress)
9. Browser receives results and filters/sorts client-side

---

## Build Order (Dependencies)

1. **CommonOffer schema** — defines the contract, everything else depends on it
2. **Base scraper** — shared Playwright setup (browser launch, stealth, etc.)
3. **One adapter** (Instacar or Spotawheel — pick the simpler one first)
4. **Normalization for that adapter** — verify schema works end to end
5. **API server** with in-memory store
6. **UI** — wire up to the API
7. **Remaining 4 adapters** — add one by one
8. **Polish** — error handling, loading states, filter UX

---

## Extensibility Notes

- **New site:** Add one file in `scrapers/`, register in orchestrator — zero other changes
- **New filter:** Add field to `CommonOffer`, update normalization, add UI filter — clean separation
- **Future DB:** Replace in-memory store module with SQLite adapter — one file change
- **Future scheduling:** Wrap orchestrator call with a cron job — API layer unchanged

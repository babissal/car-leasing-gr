# Walking Skeleton — Phase 1: Foundation & First Working Scraper

## What the Skeleton Proves

The thinnest end-to-end slice: user visits `localhost:3000`, selects a lease duration, clicks "Scrape", and sees real Instacar.gr offers in a table. Every layer of the stack is exercised by real data.

## Skeleton Components

| Layer | What it is | Proof of life |
|-------|------------|---------------|
| Server | `server.js` — Express on port 3000 | `GET /` returns 200 |
| Static UI | `public/index.html` — duration dropdown + Scrape button + results table | Page renders in browser |
| API | `POST /api/scrape` — triggers Instacar scrape | Returns JSON array of offers |
| Scraper | `scrapers/instacar.js` — Playwright, real site | ≥1 offer returned with real price |
| Schema | `lib/schema.js` + `lib/normalize.js` | All offers conform to CommonOffer shape |

## End-to-End Flow

```
Browser → GET localhost:3000 → index.html
User → selects 24 months → clicks "Scrape"
Browser → POST /api/scrape { duration: 24, advancePayment: 0 }
Express → instacar.js scraper → Playwright opens instacar.gr
Playwright → applies filters → collects listing cards → opens detail pages
normalize.js → maps to CommonOffer (VAT, fuel enum, services)
Express → returns CommonOffer[]
Browser → renders table sorted by monthlyPrice
```

## Project Structure

```
D:\CarLeasing\
  package.json          ← Node 20 LTS, Express, Playwright
  server.js             ← Express app, serves /public, exposes /api/scrape
  scrapers/
    base.js             ← shared Playwright browser launch + stealth config
    instacar.js         ← Instacar.gr adapter (Playwright UI clicks)
  lib/
    schema.js           ← CommonOffer type definition (JSDoc)
    normalize.js        ← instacar raw → CommonOffer normalization
  public/
    index.html          ← duration selector + scrape button + results table
    app.js              ← client-side fetch + table render + sort
```

## Validation

Skeleton is proved when:
1. `node server.js` starts without error
2. Browser at `localhost:3000` shows the UI
3. Clicking "Scrape" (24 months, 0 down) returns ≥1 real offer from Instacar.gr
4. Each offer has: brand, model, monthlyPrice (number, EUR), durationMonths, kmPerYear, source="Instacar", sourceUrl
5. Table sorts by monthlyPrice when column header is clicked

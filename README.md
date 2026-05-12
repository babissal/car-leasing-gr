# Car Leasing Aggregator — Greece

Scrapes Greek car leasing websites on demand and presents all offers in a unified, filterable table so you can compare prices across companies without visiting each site individually.

## Covered sources

| Company | URL |
|---------|-----|
| Instacar | instacar.gr |
| Spotawheel | spotawheel.gr |
| ExecutiveLease | executivelease.gr |
| Ayvens | ayvens.com/el-gr |
| EasyRental | easyrental.gr |

## Features

- **On-demand scraping** — click once to fetch fresh data from all five sources simultaneously
- **Progressive results** — each source's offers appear in the table as soon as it finishes, no waiting for all five
- **Filterable table** — filter by duration, fuel type, km/year, advance payment, services (insurance / maintenance / tyres), brand/model, company, and body type (SUV)
- **Accurate pricing** — 0-advance monthly price, VAT-inclusive where applicable

## Requirements

- Node.js 20+
- [Playwright browsers](https://playwright.dev/docs/browsers)

## Setup

```bash
npm install
npx playwright install chromium
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) and click **Scrape All Sites**.

## Stack

- **Scraping**: Playwright (headless Chromium)
- **Backend**: Node.js + Express
- **Frontend**: Plain HTML/CSS/JS with SSE for real-time progress
- **Storage**: In-memory (no database)

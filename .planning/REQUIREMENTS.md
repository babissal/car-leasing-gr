# Requirements — Greek Car Leasing Aggregator (v1)

## v1 Requirements

### Scrapers

- [ ] **SCR-01**: System can scrape current offers from Spotawheel.gr
- [ ] **SCR-02**: System can scrape current offers from Instacar.gr
- [ ] **SCR-03**: System can scrape current offers from Executivelease.gr
- [ ] **SCR-04**: System can scrape current offers from Ayvens.com
- [ ] **SCR-05**: System can scrape current offers from Easyrental.gr

### Data & Normalization

- [ ] **DATA-01**: A common offer schema (CommonOffer) is defined as the contract between all scrapers and the UI
- [ ] **DATA-02**: All monthly prices are normalized to EUR including 24% Greek VAT
- [ ] **DATA-03**: Fuel type labels are normalized from Greek text to English enums (Petrol / Diesel / Hybrid / PHEV / Electric)
- [ ] **DATA-04**: Services per offer are parsed as boolean flags (insurance: true/false, maintenance: true/false, tyres: true/false)
- [ ] **DATA-05**: Each offer stores included km/year
- [ ] **DATA-06**: Each offer stores CO2 g/km (nullable — shown as "N/A" when not available)
- [ ] **DATA-07**: Each offer stores source company name and a direct link to the original offer page
- [ ] **DATA-08**: Each scrape session stores a timestamp of when data was retrieved

### Scrape Orchestration

- [ ] **ORCH-01**: All scrapers run in parallel — one failing adapter does not block results from others
- [ ] **ORCH-02**: Selected lease duration and advance payment amount are passed as parameters to scrapers before scraping begins, so only matching variants are retrieved
- [ ] **ORCH-03**: An adapter returning 0 results is treated as an error, not as a valid empty response
- [ ] **ORCH-04**: Per-source scrape progress is streamed to the UI in real time (e.g. "Scraping Instacar... ✓")

### Filters

- [ ] **FILT-01**: User can filter results by car type (SUV / Hatchback / Sedan / Estate / MPV / Coupe)
- [ ] **FILT-02**: User can filter results by fuel type (Petrol / Diesel / Hybrid / PHEV / Electric)
- [ ] **FILT-03**: User can select lease duration (12 / 24 / 36 / 48 months) — this is applied at scrape time
- [ ] **FILT-04**: User can toggle "0 advance payment only" to exclude offers with a down payment
- [ ] **FILT-05**: User can filter by minimum included km/year (e.g. "at least 15,000 km/year")
- [ ] **FILT-06**: User can filter by required services (show only offers that include: insurance / maintenance / tyres)
- [ ] **FILT-07**: User can filter results by car brand and/or model name (text search or dropdown)

### UI & Experience

- [ ] **UI-01**: User can trigger a full scrape of all companies from the UI with a single button
- [ ] **UI-02**: UI shows per-source progress in real time while scraping is in progress
- [ ] **UI-03**: User can sort the results table by monthly price (ascending / descending)
- [ ] **UI-04**: Each result row displays: brand, model, car type, fuel type, monthly price (€/mo), lease duration, km/year, services included (icons or checkboxes), CO2 g/km, source company, and a link to the original offer
- [ ] **UI-05**: UI shows when data was last scraped (e.g. "Last updated: 14:32 today")
- [ ] **UI-06**: UI shows total result count matching current filters (e.g. "Showing 23 of 47 offers")
- [ ] **UI-07**: CO2 is shown as "N/A" when the data is not available from the source

---

## v2 Requirements (Deferred)

These are expected features that are intentionally deferred post-v1:

- Side-by-side offer comparison (select 2–3 offers to compare detail)
- "Best value" composite scoring (price + km + services)
- Price per effective km calculation
- Saved searches / filter presets
- Price history tracking
- Cloud hosting / public access
- User accounts and authentication
- Email alerts when a specific offer type drops in price
- Mobile-optimized layout

---

## Out of Scope

| Exclusion | Reason |
|-----------|--------|
| Scheduled/automated scraping | Not needed for on-demand personal use |
| Price history storage | Adds complexity, not needed for point-in-time comparison |
| Car reviews / editorial content | This is a price aggregator, not a car review site |
| Finance calculator | Leasing IS the finance product — no calculator needed |
| Map / dealer locator | Not relevant for operational leasing |
| Request-a-quote forms | Would require company integrations — out of scope |

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08 | TBD |
| SCR-01, SCR-02, ORCH-01, ORCH-02, ORCH-03, ORCH-04 | TBD |
| SCR-03, SCR-04, SCR-05 | TBD |
| FILT-01, FILT-02, FILT-03, FILT-04, FILT-05, FILT-06, FILT-07 | TBD |
| UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07 | TBD |

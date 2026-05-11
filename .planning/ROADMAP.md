# Roadmap — Greek Car Leasing Aggregator

**5 phases** | **27 requirements mapped** | All v1 requirements covered ✓
**Project mode:** Vertical MVP — each phase delivers a usable end-to-end slice

---

### Phase 1: Foundation & First Working Scraper

**Goal:** End-to-end pipeline — scrape one site, normalize data, display results in a table with duration selection
**Mode:** mvp

**Requirements:**
- DATA-01: Define CommonOffer schema
- DATA-02: Price normalization (EUR incl. 24% VAT)
- DATA-03: Fuel type normalization (Greek → English enum)
- DATA-04: Services parsing (insurance/maintenance/tyres booleans)
- DATA-05: km/year per offer
- DATA-06: CO2 g/km per offer (nullable)
- DATA-07: Source attribution + direct link
- DATA-08: Scrape session timestamp
- SCR-02: Instacar.gr scraper
- ORCH-02: Duration + advance payment as scrape parameters
- ORCH-03: 0 results from adapter = error
- FILT-03: Lease duration selection (12 / 24 / 36 / 48 months)
- UI-01: Scrape trigger button
- UI-03: Sort results by monthly price
- UI-04: Full offer detail display per row

**Success Criteria:**
1. User can select a lease duration (e.g. 24 months), click "Scrape", and see Instacar.gr offers appear in a table
2. Each row shows: brand, model, fuel type, monthly price (€/mo, VAT included), km/year, services (✓/✗), CO2, and a clickable source link
3. Selecting a duration of 0 months that returns no results triggers an error message (not silent empty table)
4. Results table can be sorted by monthly price ascending and descending
5. Scraping a valid duration returns at least 1 offer (smoke test)

---

### Phase 2: Full Scraper Coverage

**Goal:** All 5 companies scraped in parallel — cross-company comparison is live
**Mode:** mvp

**Requirements:**
- SCR-01: Spotawheel.gr scraper
- SCR-03: Executivelease.gr scraper
- SCR-04: Ayvens.com scraper
- SCR-05: Easyrental.gr scraper
- ORCH-01: All scrapers run in parallel (Promise.allSettled — one failure doesn't block others)

**Success Criteria:**
1. Clicking "Scrape" retrieves offers from all 5 companies in one operation
2. If one company's scraper fails, results from the other 4 still appear (no total failure)
3. Each offer row clearly shows which company it came from (source attribution)
4. User can see a Toyota RAV4 PHEV from Instacar and compare it to the same model from Spotawheel in the same table
5. Parallel scraping completes for all 5 sites (or timeouts gracefully per adapter)

---

### Phase 3: Real-time Scrape Progress

**Goal:** User can watch each source complete in real time — no more staring at a blank screen for 60 seconds
**Mode:** mvp

**Requirements:**
- ORCH-04: Per-source progress streamed to UI (SSE)
- UI-02: Per-source progress indicator in UI
- UI-05: Scrape freshness timestamp
- UI-06: Result count matching filters
- UI-07: CO2 shown as "N/A" when unavailable

**Plans:**

**Wave 1**
- `03-01` SSE Streaming Endpoint — `server.js` — ORCH-04

**Wave 2** *(blocked on Wave 1 completion)*
- `03-02` Frontend EventSource Consumer — `public/app.js`, `public/index.html` — UI-02, UI-05, UI-06, UI-07

**Cross-cutting constraints:**
- Every `res.write()` in the SSE handler must be guarded by `!aborted && !res.writableEnded`
- `es.close()` must be the first statement in the done event listener (prevents auto-reconnect loop)

**Success Criteria:**
1. While scraping, UI shows per-source status: "Scraping Instacar... ✓ (18 offers)" updating as each completes
2. After scraping, UI shows "Last updated: 14:32" (or similar freshness indicator)
3. UI shows "Showing X offers" count that updates when filters are applied
4. Offers where CO2 data is unavailable show "N/A" (not null/undefined/blank)
5. SSE connection closes cleanly when all scrapers finish

---

### Phase 4: Filters

**Goal:** User can find their exact deal — filter by every relevant dimension
**Mode:** mvp

**Requirements:**
- FILT-01: Filter by car type (SUV / Hatchback / Sedan / Estate / MPV / Coupe)
- FILT-02: Filter by fuel type (Petrol / Diesel / Hybrid / PHEV / Electric)
- FILT-04: Toggle "0 advance payment only"
- FILT-05: Filter by minimum km/year included
- FILT-06: Filter by required services (insurance / maintenance / tyres)
- FILT-07: Filter by car brand and/or model name

**Success Criteria:**
1. User can filter to "SUV + PHEV" and see only plug-in hybrid SUVs across all 5 companies
2. The "0 advance payment" toggle hides offers that require a down payment
3. Setting a minimum km/year of 20,000 hides offers with lower mileage limits
4. Selecting "insurance required" hides offers where insurance is not included
5. Typing "Toyota" in brand filter shows only Toyota offers; typing "RAV4" further narrows to that model
6. All filters can be combined (e.g. SUV + PHEV + 0 down + insurance included + 20k km)

---

### Phase 5: Reliability & Polish

**Goal:** The scraper handles real-world conditions reliably — anti-bot detection, timeouts, error feedback, and clean UX
**Mode:** mvp

**Requirements (reliability hardening — not new REQ-IDs, quality improvements to all above):**
- Stealth plugin configured for all adapters
- Per-adapter timeout (30s max) — hung scraper doesn't freeze the app
- Retry logic (1 retry on timeout before marking as failed)
- Clear error messages when a source fails (not silent empty)
- UI polish: loading states, empty states, error states
- Offer link validation hint ("verify offer is still available before contacting")

**Success Criteria:**
1. A Cloudflare-protected page returns a clear "blocked" error message, not a crash
2. An adapter that times out after 30s is marked as failed; other results still appear
3. Scraping Ayvens.com (largest, most corporate site) succeeds at least 80% of attempts
4. The app never shows an unhandled error to the user — every failure has a user-friendly message
5. The UI looks clean and functional on a standard 1920×1080 desktop screen

---

## Requirements Traceability

| REQ-ID | Phase |
|--------|-------|
| DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08 | Phase 1 |
| SCR-02, ORCH-02, ORCH-03, FILT-03, UI-01, UI-03, UI-04 | Phase 1 |
| SCR-01, SCR-03, SCR-04, SCR-05, ORCH-01 | Phase 2 |
| ORCH-04, UI-02, UI-05, UI-06, UI-07 | Phase 3 |
| FILT-01, FILT-02, FILT-04, FILT-05, FILT-06, FILT-07 | Phase 4 |
| Reliability + Polish | Phase 5 |

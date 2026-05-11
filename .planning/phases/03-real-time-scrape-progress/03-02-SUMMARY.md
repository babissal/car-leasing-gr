---
plan: "03-02"
phase: 3
title: "Frontend EventSource Consumer"
status: complete
completed: "2026-05-11"
---

# 03-02 Summary: Frontend EventSource Consumer

## What Was Built

Replaced the fetch-based scrape trigger with an SSE EventSource consumer. Added per-source
progress indicators that update live as each scraper completes. Added freshness timestamp
and offer count to #meta. CO2 "N/A" rendering was already present — verified unchanged.

## Key Implementation Details

- index.html: `<div id="progress-list">` inserted between #meta and #results table; CSS added for .src-running/.src-done/.src-error
- app.js: `progressEl` DOM variable, `totalCount` variable, `setSourceStatus()` helper, `updateMeta()` helper added
- app.js: click handler replaced — non-async, opens EventSource to /api/scrape-stream, shows all 5 sources as "running" immediately, updates per progress event, closes on done event (es.close() is first statement in done handler to prevent auto-reconnect)
- renderOffers(), sort handler, CO2 "N/A" rendering: all unchanged
- POST /api/scrape fallback: preserved on server side (not called by UI anymore but still functional)

## Files Modified

- `public/index.html` — added #progress-list div and CSS rules
- `public/app.js` — added helper functions and replaced click handler

## Manual Verification Checklist

Before marking phase complete, verify manually:
1. Click Scrape → all 5 sources immediately show "Scraping…" (before any results)
2. Sources flip to "✓ N offers" or "✗ Error" one at a time (proves streaming, not batch)
3. After completion: #meta shows "Last updated: HH:MM · N offers total"
4. CO2 column shows "N/A" for Spotawheel/ExecutiveLease/EasyRental rows
5. Price sort still works (ascending/descending)
6. No JS console errors
7. Node terminal shows no unhandled errors
8. Reload and scrape again works correctly

## Self-Check

- [x] index.html contains `id="progress-list"`, `.src-running`, `.src-done`, `.src-error`
- [x] app.js contains `const progressEl`, `function setSourceStatus(`, `function updateMeta(`
- [x] app.js contains `new EventSource(`, `es.addEventListener('done'`
- [x] `es.close()` is first statement in done handler
- [x] `fetch('/api/scrape'` removed from app.js
- [x] `renderOffers()` unchanged
- [x] `offer.co2gKm != null ? offer.co2gKm + ' g/km' : 'N/A'` unchanged
- [x] Sort handler unchanged

## Self-Check: PASSED

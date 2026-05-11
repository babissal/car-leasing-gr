# Phase 3 — Pattern Map

## server.js

### Role
Express server that currently handles scraping via `POST /api/scrape` (batch mode, all-or-nothing). Phase 3 adds a new `GET /api/scrape-stream` route that uses Server-Sent Events (SSE) to emit progress updates in real-time as each scraper completes, then emits a final `done` event with all offers. The POST endpoint remains unchanged for backward compatibility and as a dev tool.

### Existing patterns to follow

**SCRAPERS array structure (line 19–25):**
```javascript
const SCRAPERS = [
  { name: 'Instacar', fn: scrapeInstacar },
  { name: 'Spotawheel', fn: scrapeSpotawheel },
  { name: 'ExecutiveLease', fn: scrapeExecutivelease },
  { name: 'Ayvens', fn: scrapeAyvens },
  { name: 'EasyRental', fn: scrapeEasyrental },
]
```

**store variable (line 15):**
```javascript
let store = { offers: [], scrapedAt: null, errors: [] }
```

**VALID_DURATIONS constant (line 17):**
```javascript
const VALID_DURATIONS = [12, 24, 36, 48]
```

**Existing POST /api/scrape handler (lines 27–75) — shows the pattern of:**
- Extract and validate `duration` and `advancePayment` from request
- Check duration against VALID_DURATIONS
- Call `Promise.allSettled(SCRAPERS.map(...))`
- Filter results with `validateOffer()` — imported at line 8: `const { validateOffer } = require('./lib/schema')`
- Store in `store` with pattern: `store = { offers: allOffers, scrapedAt: new Date().toISOString(), errors }`
- Return JSON response

**Imports already present (lines 1–8):**
- All five scrapers are imported with `const { scrape: scrape<Name> } = require(...)`
- `validateOffer` from `'./lib/schema'` is used to filter offers
- No new imports needed for SSE — all built into Node/Express

### Insertion point for new route
Add the new `GET /api/scrape-stream` handler **after line 75** (after the POST /api/scrape closes) and **before line 77** (before the GET /api/offers route). This keeps scrape-related endpoints together.

**Structural context:**
- Line 75: `})` closes POST /api/scrape
- Line 77: `app.get('/api/offers', ...)` starts
- **Insert GET /api/scrape-stream between these two lines**

---

## public/app.js

### Role
Frontend that currently triggers scraping via a single `fetch('/api/scrape')` POST call that awaits all results (lines 12–60). Phase 3 replaces this with an `EventSource` consumer that:
1. Immediately shows all 5 sources as "running"
2. Listens for `progress` events and updates each source's status line in real-time
3. Listens for a final `done` event, populates the results table, updates metadata
4. Auto-closes the EventSource to prevent unwanted reconnect

The `renderOffers()` function (lines 68–95) and the sort handler (lines 62–66) are unchanged.

### Current scrape trigger (to replace)

Lines 12–60 show the entire click handler. The core fetch block is lines 21–34:
```javascript
scrapeBtn.addEventListener('click', async () => {
  const duration = parseInt(durationSelect.value, 10)
  scrapeBtn.disabled = true
  scrapeBtn.textContent = 'Scraping all sites…'
  statusEl.textContent = ''
  statusEl.style.color = '#c00'
  tbody.innerHTML = ''
  metaEl.textContent = 'Running scrapers in parallel — this may take 60–120 seconds…'

  try {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration, advancePayment: 0 })
    })

    const data = await response.json()

    if (!response.ok) {
      statusEl.textContent = 'Error: ' + (data.error || response.statusText)
      metaEl.textContent = ''
      return
    }

    if (data.errors && data.errors.length > 0) {
      statusEl.style.color = '#c60'
      statusEl.textContent = 'Partial errors: ' + data.errors.join(' | ')
    } else {
      statusEl.textContent = ''
    }

    lastOffers = data.offers || []
    sortState.dir = 'asc'
    sortPriceTh.textContent = 'Monthly (€) ↑'
    renderOffers(lastOffers)

    if (data.scrapedAt) {
      const time = new Date(data.scrapedAt).toLocaleTimeString('el-GR')
      const sources = [...new Set(lastOffers.map(o => o.source))].join(', ')
      metaEl.textContent = `${data.count ?? lastOffers.length} offers from: ${sources || '—'} · ${time}`
    }
  } catch (err) {
    statusEl.textContent = 'Network error — is the server running?'
    metaEl.textContent = ''
  } finally {
    scrapeBtn.disabled = false
    scrapeBtn.textContent = 'Scrape All Sites'
  }
})
```

**This entire block (lines 21–59) is replaced by EventSource code.** The button setup (lines 14–19) and finally block concept (lines 56–59) are preserved, but the fetch and processing logic changes entirely.

### DOM variables already declared

```javascript
const scrapeBtn = document.getElementById('scrape-btn')        // line 2
const durationSelect = document.getElementById('duration')    // line 3
const statusEl = document.getElementById('status')            // line 4
const metaEl = document.getElementById('meta')                // line 5
const tbody = document.getElementById('results-body')         // line 6
const sortPriceTh = document.getElementById('sort-price')     // line 7
```

All these elements are already in index.html (verified). Phase 3 needs to add:
```javascript
const progressEl = document.getElementById('progress-list')   // NEW — will be added to index.html
```

### renderOffers() signature

**Function signature (line 68):**
```javascript
function renderOffers(offers) {
```

**What it does:**
- Accepts an array of offer objects
- Sorts them according to current `sortState.dir` (asc or desc)
- Clears `tbody.innerHTML`
- For each offer, creates a `<tr>` with 12 `<td>` cells:
  1. Index (i + 1)
  2. Brand
  3. Model
  4. Fuel type
  5. Monthly price (formatted with locale)
  6. Duration (with Greek suffix "μήνες")
  7. km/year
  8. Insurance (✓ or ✗)
  9. Maintenance (✓ or ✗)
  10. Tyres (✓ or ✗)
  11. CO2 (g/km or "N/A")
  12. Source (as link or text)
- Appends each `<tr>` to `tbody`

**Return value:** None (void)

**Usage in Phase 3:** Will be called once on the `done` event with the full `data.offers` array from the final SSE event.

### CO2 rendering (already handles N/A)

**Line 90:**
```javascript
`<td>${offer.co2gKm != null ? offer.co2gKm + ' g/km' : 'N/A'}</td>`,
```

This already correctly handles `null` and `undefined` values. The `!= null` check catches both. **No change needed.** Verification note: Spotawheel, ExecutiveLease, and EasyRental set `co2gKm: null`, so their rows will display "N/A".

### Insertion points

**1. Helper function `setSourceStatus()` — insert after line 10 (after `const sortState` declaration):**

This helper updates the DOM for each source's progress line. Called with:
- `setSourceStatus(name, 'running')` — before any scraper starts
- `setSourceStatus(name, 'done', count)` — scraper succeeded
- `setSourceStatus(name, 'error', 0, errorMessage)` — scraper failed

**2. New variable declaration `let totalCount = 0` — insert after line 10:**

Tracks total offer count from the `done` event (used in `updateMeta()`).

**3. New function `updateMeta()` — insert after `renderOffers()` (after line 95):**

Replaces the inline meta-update logic. Accepts the `done` event data and formats:
```
Last updated: 14:32 · 172 offers total
```

**4. New EventSource listener block — insert in place of lines 21–59 (the entire try/catch/finally body of the click handler):**

This replaces the `fetch()` call with:
- Reset UI (button disabled, clear table, clear progress list)
- Show all 5 sources as "running" via `setSourceStatus(name, 'running')`
- Create `new EventSource('/api/scrape-stream?duration=${duration}&advancePayment=0')`
- Attach listeners for `progress` and `done` events
- Attach `onerror` handler
- Finally block remains the same (re-enable button)

---

## public/index.html

### Existing structure relevant to Phase 3

```html
<div class="filter-bar">
  <label for="duration">Διάρκεια:</label>
  <select id="duration">
    <option value="12">12 μήνες</option>
    <option value="24" selected>24 μήνες</option>
    <option value="36">36 μήνες</option>
    <option value="48">48 μήνες</option>
  </select>
  <button id="scrape-btn">Scrape All Sites</button>
</div>

<div id="status"></div>                    <!-- Error messages go here -->
<div id="meta"></div>                      <!-- "Last updated: ... · N offers total" -->

<table id="results">
  <thead>
    <tr>
      <th>#</th>
      <th>Brand</th>
      <th>Model</th>
      <th>Fuel</th>
      <th id="sort-price">Monthly (€)</th>
      <th>Duration</th>
      <th>km/yr</th>
      <th>Insurance</th>
      <th>Maintenance</th>
      <th>Tyres</th>
      <th>CO2</th>
      <th>Source</th>
    </tr>
  </thead>
  <tbody id="results-body"></tbody>
</table>
```

**Key IDs used by app.js:**
- `#duration` — duration dropdown
- `#scrape-btn` — button to trigger scrape
- `#status` — error/warning messages
- `#meta` — metadata line (updated count, time)
- `#sort-price` — price column header (clickable, shows sort direction)
- `#results-body` — table body where rows are inserted

### Where to add progress-list div

**Insert after line 36** (after `<div id="meta"></div>`), before line 38 (before `<table>`):

```html
<div id="progress-list"></div>
```

**Rationale:** Visually, the progress list should appear between the metadata and the results table. This way:
1. Status and errors appear at top
2. Metadata shows time and count at top
3. **Progress list shows per-source status** (spinning, done, error)
4. Results table appears below

### Existing CSS style guide

**Current styles (lines 7–19):**
- Body: `font-family: sans-serif;` (system fonts), `max-width: 1400px;`
- Section divs: `margin-bottom: 8px;` (consistent spacing)
- Text color for secondary info: `color: #555;` (gray)
- Secondary text size: `font-size: 0.9em;`
- Error text: `color: #c00;` (red)
- Warning text: `color: #c60;` (orange-red)
- Status div: `min-height: 1.2em;` (prevents layout shift)
- Table: `font-size: 0.9em;`
- Table cells: `border: 1px solid #ddd;` `padding: 6px 10px;`
- Buttons/inputs: `padding: 8px 16px;` (button), `padding: 6px;` (select)

**New CSS for progress-list (to add after line 19, before the closing style tag):**

```css
#progress-list {
  font-size: 0.85em;
  color: #555;
  margin-bottom: 8px;
  min-height: 1.5em;
}

#progress-list span {
  margin-right: 16px;
}

.src-running {
  color: #888;
}

.src-done {
  color: #060;
}

.src-error {
  color: #c00;
}
```

**Style rationale:**
- `font-size: 0.85em;` — slightly smaller than main text, visual hierarchy
- `color: #555;` — same gray as `#meta` to keep secondary info unified
- `margin-bottom: 8px;` — matches spacing of other section divs
- `min-height: 1.5em;` — prevents layout jank when list appears/updates
- `.src-running` — muted gray (#888) for pending sources
- `.src-done` — dark green (#060) for success
- `.src-error` — red (#c00) for failures (matches status error color)
- `margin-right: 16px;` on spans — separates sources horizontally

---

## PATTERN MAPPING COMPLETE

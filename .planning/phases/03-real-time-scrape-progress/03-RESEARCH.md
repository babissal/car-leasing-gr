# Phase 3 Research — Real-time Scrape Progress

## Summary

Phase 3 adds Server-Sent Events (SSE) streaming to replace the current all-or-nothing POST approach.
A new GET endpoint `/api/scrape-stream` will fire all scrapers in parallel, emit one JSON event per
scraper as it completes, and emit a final `done` event with the full offers array. The plain HTML UI
replaces its `fetch + await` block with an `EventSource` consumer that renders a per-source progress
list, then populates the results table when the final event arrives. Three small UI additions
(freshness timestamp, offer count, CO2 "N/A") are already partially implemented and just need wiring.

---

## SSE Implementation Pattern

### Required HTTP headers

```js
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection', 'keep-alive')
res.setHeader('X-Accel-Buffering', 'no')   // prevents nginx proxy from buffering
res.flushHeaders()                           // send headers immediately — critical
```

`res.flushHeaders()` is mandatory. Without it Express may buffer until the first `write()`, and the
client won't see any events until the buffer is flushed.

### Writing events

The SSE wire format uses `data:` lines terminated by a double newline:

```js
function sendEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
}
```

Named events (`event: progress`, `event: done`, `event: error`) let the client attach separate
listeners via `es.addEventListener('progress', ...)` instead of a single `onmessage` handler.
This is cleaner than a discriminator field in the payload but either approach works.

### Closing the connection

```js
res.end()   // signals EOF; EventSource sees readyState=CLOSED, onmessage stops firing
```

Call `res.end()` after the final event. Do NOT call it before — even with `res.write()` queued,
calling `end()` too early can truncate buffered events.

### Express default timeout

Express/Node's underlying `http.Server` has a default `keepAliveTimeout` of 5 s and a
`headersTimeout` of 60 s. Scraping can take 60–120 s, so the response socket timeout must be
disabled or extended on the SSE response object specifically:

```js
req.socket.setTimeout(0)    // disable socket-level timeout for this connection
// or extend the server globally at startup:
server.setTimeout(300000)   // 5 minutes
```

The cleanest approach: call `req.socket.setTimeout(0)` inside the `/api/scrape-stream` handler
immediately after `res.flushHeaders()`. This only affects that one connection, not global config.

### Client disconnect handling

```js
req.on('close', () => {
  aborted = true
  // set a flag that each scraper promise checks, or call browser.close() if you have a ref
})
```

When the browser tab closes or the user navigates away, Node fires `req.on('close', ...)`.
At that point `res.writableEnded` becomes `true`, so any subsequent `res.write()` throws.
Guard every write with:

```js
if (!res.writableEnded) res.write(`event: progress\ndata: ...\n\n`)
```

Playwright browsers are not automatically killed when the request closes. See Risks section.

---

## Streaming Scrape Pattern

### Current pattern (batch)

```js
const results = await Promise.allSettled(SCRAPERS.map(({ name, fn }) => fn(params).then(...)))
// process results after all settle
```

### New pattern (emit as each resolves)

The trick is to attach `.then()` to each individual scraper promise **before** passing to
`Promise.allSettled`. That callback fires as soon as that one scraper resolves, while the others
are still running. `Promise.allSettled` on the outer array still waits for all of them.

```js
app.get('/api/scrape-stream', async (req, res) => {
  // --- headers ---
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  req.socket.setTimeout(0)

  const { duration = 36, advancePayment = 0 } = req.query
  const dur = parseInt(duration, 10)
  // ... validate dur ...

  const params = { duration: dur, advancePayment: parseInt(advancePayment, 10) || 0 }

  let aborted = false
  req.on('close', () => { aborted = true })

  const allOffers = []
  const errors = []

  // Wrap each scraper so it emits a progress event on completion
  const scraperPromises = SCRAPERS.map(({ name, fn }) =>
    fn(params)
      .then(offers => {
        const valid = offers.filter(o => validateOffer(o).valid)
        allOffers.push(...valid)
        if (!aborted && !res.writableEnded) {
          res.write(`event: progress\ndata: ${JSON.stringify({
            source: name, status: 'done', count: valid.length, error: null
          })}\n\n`)
        }
        return { name, offers: valid }
      })
      .catch(err => {
        errors.push(`${name}: ${err.message || 'Unknown error'}`)
        if (!aborted && !res.writableEnded) {
          res.write(`event: progress\ndata: ${JSON.stringify({
            source: name, status: 'error', count: 0, error: err.message || 'Failed'
          })}\n\n`)
        }
        return { name, offers: [] }
      })
  )

  // Emit a "running" event for each scraper before they start
  // (send these synchronously before awaiting, so UI shows all sources immediately)
  for (const { name } of SCRAPERS) {
    if (!res.writableEnded) {
      res.write(`event: progress\ndata: ${JSON.stringify({
        source: name, status: 'running', count: 0, error: null
      })}\n\n`)
    }
  }

  await Promise.allSettled(scraperPromises)

  allOffers.sort((a, b) => a.monthlyPrice - b.monthlyPrice)
  store = { offers: allOffers, scrapedAt: new Date().toISOString(), errors }

  if (!aborted && !res.writableEnded) {
    res.write(`event: done\ndata: ${JSON.stringify({
      offers: store.offers,
      scrapedAt: store.scrapedAt,
      errors: store.errors,
      count: store.offers.length,
    })}\n\n`)
    res.end()
  }
})
```

Key insight: `allOffers.push(...valid)` inside `.then()` is safe because JavaScript is
single-threaded — no mutex needed. The array is populated concurrently from the perspective of
Playwright (multiple browser contexts run in parallel), but the push callbacks execute serially in
the Node event loop.

---

## Client-Side EventSource Pattern

### Why GET with query params is the right choice

SSE (`EventSource`) is a native browser API that only supports GET. The three options:

| Option | Complexity | Reliability |
|--------|-----------|-------------|
| GET with query params | Simplest | Best — native browser support |
| Two-step (POST then SSE) | Medium — race condition risk | Unnecessary complication |
| fetch + ReadableStream | Medium — manual chunked parsing | Works but verbose, no auto-reconnect |

**Decision: GET with query params.** Duration and advancePayment are non-sensitive configuration
values — there is no security reason to hide them in POST body. This is the standard SSE pattern.

### Implementation in app.js

```js
scrapeBtn.addEventListener('click', () => {
  const duration = parseInt(durationSelect.value, 10)

  // Reset UI
  scrapeBtn.disabled = true
  scrapeBtn.textContent = 'Scraping…'
  tbody.innerHTML = ''
  statusEl.textContent = ''
  progressEl.innerHTML = ''  // new element for per-source status

  // Show all 5 sources as "pending" immediately
  const sources = ['Instacar', 'Spotawheel', 'ExecutiveLease', 'Ayvens', 'EasyRental']
  sources.forEach(name => setSourceStatus(name, 'running'))

  const es = new EventSource(`/api/scrape-stream?duration=${duration}&advancePayment=0`)

  es.addEventListener('progress', (e) => {
    const { source, status, count, error } = JSON.parse(e.data)
    setSourceStatus(source, status, count, error)
  })

  es.addEventListener('done', (e) => {
    const data = JSON.parse(e.data)
    es.close()  // important — close before processing to avoid reopening

    lastOffers = data.offers || []
    renderOffers(lastOffers)
    updateMeta(data)

    scrapeBtn.disabled = false
    scrapeBtn.textContent = 'Scrape All Sites'
  })

  es.onerror = (e) => {
    // EventSource auto-reconnects on error by default — prevent that
    es.close()
    statusEl.textContent = 'Connection error — scrape may have failed'
    scrapeBtn.disabled = false
    scrapeBtn.textContent = 'Scrape All Sites'
  }
})
```

### Important: `es.close()` on completion

`EventSource` auto-reconnects when the server closes the connection (this is its design for
live feeds). In our case the server closes after `done`, which would trigger an unwanted
reconnect and a second scrape. Call `es.close()` in the `done` handler before the connection
end is detected by the browser.

### Auto-reconnect behavior

If the SSE connection drops mid-scrape (network blip), `EventSource` will automatically try to
reconnect. Because the scrape is stateless and tracked in `store`, a reconnect would start a new
scrape. This is acceptable behavior for v1. Phase 5 can add a session token to prevent duplicate
scrapes.

---

## Event Format

### Progress event (one per scraper, fires as each completes)

```json
{
  "source": "Instacar",
  "status": "running" | "done" | "error",
  "count": 22,
  "error": null
}
```

- `status: "running"` — sent synchronously before any scraper starts, signals the source is queued
- `status: "done"` — scraper succeeded, `count` = valid offers found
- `status: "error"` — scraper failed, `error` = error message string, `count` = 0

### Done event (one, fires after all scrapers finish)

```json
{
  "offers": [ /* full CommonOffer array, sorted by monthlyPrice asc */ ],
  "scrapedAt": "2026-05-11T14:32:00.000Z",
  "errors": ["Ayvens: DNS timeout"],
  "count": 172
}
```

The `done` event carries all offers, mirroring what `/api/scrape` currently returns. The client
replaces the table in one operation when `done` fires.

### SSE wire format example

```
event: progress
data: {"source":"Instacar","status":"running","count":0,"error":null}

event: progress
data: {"source":"Instacar","status":"done","count":22,"error":null}

event: done
data: {"offers":[...],"scrapedAt":"2026-05-11T14:32:00.000Z","errors":[],"count":172}

```

(Each event block ends with a blank line — two `\n` characters after `data:`)

---

## Backward Compatibility Decision

**Keep `/api/scrape` (non-streaming) as a fallback. Do not remove it.**

Reasons:
1. `/api/offers` GET endpoint relies on `store` being populated, which both endpoints update.
2. The existing endpoint is a useful smoke test target — curl-able without SSE plumbing.
3. Cost of keeping it is zero — it's 30 lines.
4. Phase 4 (filters) and Phase 5 will call `store` regardless of how it was populated.

The UI in `app.js` will be refactored to use SSE exclusively (the old `fetch('/api/scrape')` block
is removed), but the server-side `/api/scrape` route stays intact. In practice the user will
always go through the UI, so the POST route becomes a dev-only tool.

`store` is updated identically by both endpoints:
```js
store = { offers: allOffers, scrapedAt: new Date().toISOString(), errors }
```

No change needed to `store` structure.

---

## Minor UI Changes

### CO2 "N/A" (UI-07)

**Current state:** Already handled correctly in `app.js` line 90:
```js
`<td>${offer.co2gKm != null ? offer.co2gKm + ' g/km' : 'N/A'}</td>`
```
`!= null` catches both `null` and `undefined`. No change needed — this requirement is already met.
Verification: confirm that Spotawheel, ExecutiveLease, and EasyRental offers render "N/A" in CO2
column (they all set `co2gKm: null` per STATE.md).

### Freshness timestamp (UI-05)

**Current state:** `metaEl` already shows time as part of a combined string (app.js line 49–51).
The format is `toLocaleTimeString('el-GR')` which gives `HH:MM:SS`. For Phase 3, simplify to:

```js
function updateMeta(data) {
  const time = data.scrapedAt
    ? new Date(data.scrapedAt).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
    : '—'
  // e.g. "14:32"
  metaEl.textContent = `Last updated: ${time} · ${data.count} offers total`
}
```

Display location: `#meta` div, already present in `index.html`. No new HTML element needed.

### Result count (UI-06)

**Phase 3 scope:** Show total offer count, not filter-aware count (filters come in Phase 4).
Display as part of `#meta`: `"Last updated: 14:32 · 172 offers total"`.

When Phase 4 adds filters, this line changes to `"Showing 23 of 172 offers"`. For Phase 3,
maintaining a `totalCount` variable (set from `done` event) and a `displayedCount` (set
from `renderOffers`) is the cleanest prep:

```js
let totalCount = 0     // set from done event
// in renderOffers():
//   update a "Showing X of Y" display using sorted.length vs totalCount
```

For Phase 3, `sorted.length === totalCount` always (no filters), so the display is just `X offers`.

### Per-source progress indicator (UI-02)

Add a new `<div id="progress-list">` below the filter bar in `index.html`. Each source gets a
line like `"Instacar: Scraping… "` → `"Instacar: ✓ 22 offers"` → `"Instacar: ✗ Error: ..."`.

CSS for progress list — minimal, fits existing style:
```css
#progress-list { font-size: 0.85em; color: #555; margin-bottom: 8px; min-height: 1.5em; }
#progress-list span { margin-right: 16px; }
.src-running { color: #888; }
.src-done    { color: #060; }
.src-error   { color: #c00; }
```

The `setSourceStatus(name, status, count, error)` helper in `app.js` updates the DOM element
for each source in place.

---

## Risks & Landmines

### 1. Express socket timeout closes SSE connection early

**Risk:** Node's socket may have a 60 s keepalive timeout. Scraping takes 60–120 s. If the socket
closes mid-scrape, the client sees `onerror` and `EventSource` tries to reconnect, starting a
fresh (duplicate) scrape.

**Fix:** `req.socket.setTimeout(0)` immediately after `res.flushHeaders()`. This disables the
timeout for that specific socket only.

**Alternative:** At server startup:
```js
const server = app.listen(3000, ...)
server.setTimeout(300000)          // 5 min global timeout
server.keepAliveTimeout = 300000
```

Both approaches work. Socket-level is more surgical and doesn't affect other endpoints.

### 2. Playwright browsers not cleaned up on client disconnect

**Risk:** If the user navigates away (fires `req.on('close')`), the 5 Playwright browser contexts
continue running until they finish or until Node exits. This wastes memory and CPU, and in worst
case leaves zombie browser processes.

**Current state:** Phase 2 scrapers don't expose a cancel mechanism — each `scrape()` function
launches a browser, does its work, closes the browser, and returns. There is no `AbortController`
or external cancellation hook.

**Phase 3 mitigation (pragmatic):** Set `aborted = true` on close and guard all `res.write()`
calls with `if (!aborted && !res.writableEnded)`. The scrapers will still run to completion,
but no events are written. This is acceptable for v1 on localhost where only one user is ever
scraping at a time.

**Phase 5 improvement:** Pass an `AbortSignal` to each scraper and call `browser.close()` in the
abort handler. Not in scope for Phase 3.

### 3. Concurrent scrape requests

**Risk:** User double-clicks "Scrape" → two SSE connections open → two full Playwright sessions
run simultaneously → 10 browser contexts, ~2× memory.

**Fix (Phase 3):** Disable the button immediately in the click handler (`scrapeBtn.disabled = true`)
and only re-enable it in the `done` or `onerror` handler. This prevents the second click without
any server-side locking.

**Server-side guard (optional):** Add `let scrapeInProgress = false` in server.js. If true, return
a 409 Conflict with `data: {"error":"scrape already in progress"}`. Low priority for v1 localhost.

### 4. EventSource auto-reconnect after server sends `res.end()`

**Risk:** After the `done` event, `res.end()` closes the HTTP connection. The browser's
`EventSource` interprets this as a dropped connection and auto-reconnects after 3 s (default
`retry` interval). This triggers a second scrape silently.

**Fix:** Call `es.close()` in the `done` event handler in `app.js` before the browser has a
chance to detect the connection close. This is synchronous — the `done` listener fires, `es.close()`
runs, and the auto-reconnect is cancelled before it can trigger.

**Optional server hint:**
```js
res.write(`retry: 86400000\n\n`)   // tell browser to wait 24h before reconnect
```
Send this as the first event. Belts and suspenders.

### 5. JSON parse errors in SSE data

**Risk:** If an offer object contains a circular reference or a non-serializable value,
`JSON.stringify(payload)` throws, which crashes the SSE handler mid-stream.

**Fix:** Wrap the final `done` event write in a try/catch. For progress events, `validateOffer`
already filters invalid offers, so only clean data enters `allOffers`.

### 6. Large payload in `done` event

**Risk:** The `done` event sends all offers as one JSON blob. With 172 offers, this is
approximately 80–150 KB. SSE streams deliver this as a single write to the browser — no chunking
concern because HTTP/1.1 already handles transfer encoding. Not a real risk at this scale.

---

## Validation Architecture

These assertions can be verified programmatically (curl + Node scripts) or manually.

### Automated checks (curl-based)

1. `GET /api/scrape-stream?duration=36` returns `Content-Type: text/event-stream` header
   ```sh
   curl -I "http://localhost:3000/api/scrape-stream?duration=36"
   # → Content-Type: text/event-stream
   ```

2. `GET /api/scrape-stream?duration=36` returns `Cache-Control: no-cache` header

3. First line of body starts with `event: progress`

4. Each `data:` line is parseable as JSON:
   ```sh
   curl -N "http://localhost:3000/api/scrape-stream?duration=36" | grep "^data:" | \
     while IFS= read -r line; do echo "${line#data: }" | node -e "process.stdin.resume(); process.stdin.on('data', d => JSON.parse(d))"; done
   ```

5. `done` event JSON contains `offers` array, `scrapedAt` ISO string, `count` integer

6. `done` event `count` equals `offers.length`

7. Invalid duration returns an error event (not a 200 with bad data):
   ```sh
   curl "http://localhost:3000/api/scrape-stream?duration=99"
   # → event: error / data: {"error":"Invalid duration..."}
   ```

8. After scrape completes, `GET /api/offers` returns non-empty `offers` array (store was updated)

### Manual UI checks

1. Click "Scrape" — all 5 source names appear with spinning/pending indicator before any results
2. Each source flips to "✓ N offers" or "✗ Error" as it finishes (live, not all at once)
3. Table populates after `done` event (not incrementally — full table appears once)
4. `#meta` shows "Last updated: HH:MM" with correct time
5. CO2 column shows "N/A" for Spotawheel, ExecutiveLease, and EasyRental rows
6. Closing the browser tab mid-scrape does not crash the Node server (check terminal)
7. After page reload, clicking "Scrape" again works correctly

### Regression checks (Phase 1/2 features still work)

1. Sort by price ascending/descending still works after SSE migration
2. Source attribution links still open in new tab
3. `/api/scrape` POST still returns valid JSON (backward compat endpoint)

---

## Files to Change

| File | Change |
|------|--------|
| `server.js` | Add `GET /api/scrape-stream` handler with SSE + streaming Promise pattern |
| `public/app.js` | Replace `fetch('/api/scrape')` block with `EventSource` consumer; add `setSourceStatus()` helper; update `updateMeta()` to use new format |
| `public/index.html` | Add `<div id="progress-list">` element; add CSS for per-source status indicators |

No new files needed. No package.json changes (SSE is built into Node/Express — no library required).
The `store` structure is unchanged. The `validateOffer` import in server.js is reused as-is.

---

## RESEARCH COMPLETE

# Pitfalls Research — Greek Car Leasing Aggregator

---

## Pitfall 1: Sites Change Structure Without Warning

**What happens:** A leasing site updates its frontend, breaking your CSS selectors overnight. You wake up to empty results with no error message.

**Warning signs:**
- Scraper returns 0 offers suddenly
- Fields like `monthlyPrice` are null for a specific source
- Error logs show "element not found" for a previously working selector

**Prevention:**
- Add assertion checks: if `scraper.scrape()` returns 0 results, throw an error (don't silently return empty)
- Log the number of offers per adapter after each scrape
- Use robust selectors (ARIA labels, data-testid) over fragile nth-child CSS paths
- Store one raw HTML snapshot per adapter per scrape — useful for debugging breakage

**Phase:** Address in scraper implementation (Phase 2-3)

---

## Pitfall 2: Anti-Bot Detection

**What happens:** Cloudflare, DataDome, or custom WAF blocks Playwright. You get a 403, a CAPTCHA page, or empty content that looks like a real page.

**Warning signs:**
- Page content is a Cloudflare challenge page
- `page.content()` returns HTML with no car data
- Requests return 403 or redirect to a bot challenge

**Prevention:**
- Use `playwright-extra` + `puppeteer-extra-plugin-stealth` from day one
- Randomize: user agents, viewport sizes (1280-1920 width), language headers (`Accept-Language: el-GR,el`)
- Add realistic delays: 500ms–2000ms between page actions (not uniform)
- Avoid scraping at exactly regular intervals (human behavior is irregular)
- Check `robots.txt` for each site before scraping — respect disallow rules
- As a last resort: use residential proxies (BrightData, Oxylabs) for persistent blocking

**Known risks:**
- Ayvens.com (formerly ALD) is a large corporate site — may have more aggressive bot detection
- Spotawheel.gr and Instacar.gr are Greek startups — likely lighter protection

**Phase:** Address in base scraper setup (Phase 2)

---

## Pitfall 3: Inconsistent Data Schemas Across Sites

**What happens:** Each site presents pricing differently — one shows weekly price, another shows monthly ex-VAT, another bundles services differently. Your normalization layer maps them incorrectly.

**Warning signs:**
- Prices from different sources are incomparable (e.g., one source shows €180/mo, another €300/mo for same car — but the €300 includes insurance)
- `servicesIncluded.insurance` is `true` for all Instacar results regardless of offer

**Prevention:**
- Define `CommonOffer` schema FIRST, before writing any scraper
- For each adapter, document what the raw data looks like before normalizing (add comments)
- Handle Greek text normalization: "Βενζίνη" → "Petrol", "Υβριδικό" → "Hybrid", etc.
- VAT: normalize ALL prices to include 24% VAT — Greek leasing sites mix VAT-included and ex-VAT
- Services: default to `false` if not explicitly mentioned (safer than defaulting to `true`)
- Write one test per adapter normalization with hardcoded raw fixture data

**Phase:** Critical in Phase 1 (schema design) and Phase 2 (scraper implementation)

---

## Pitfall 4: Slow Parallel Scraping Blocks the UI

**What happens:** Scraping 5 sites with Playwright takes 30–90 seconds. The user clicks "Refresh" and nothing happens for a minute. Feels broken.

**Warning signs:**
- User repeatedly clicks Refresh thinking it's stuck
- Browser tab shows loading spinner with no feedback

**Prevention:**
- Use Server-Sent Events (SSE) or WebSocket to stream progress: "Scraping Instacar... ✓ (23 offers)"
- Show a per-source progress indicator in the UI
- Start displaying results from completed sources immediately (don't wait for all 5)
- Set a per-adapter timeout (e.g., 30 seconds) — don't let one stuck adapter block results from others

**Phase:** Address in API + UI (Phase 3–4)

---

## Pitfall 5: Duration/Payment Combinations Explosion

**What happens:** A car may be available in 4 durations × 3 advance payment levels = 12 variants. If you scrape all variants, the results table shows 12 rows for the same car from the same company, which is confusing.

**Warning signs:**
- Same car model appears 12 times from the same source
- Users can't distinguish between identical cars with different terms

**Prevention:**
- Decide upfront: store ALL variants (user filters to their combination) OR scrape only selected combination
- Recommended: scrape the specific combination the user selected before clicking Refresh (pass duration + advance payment as scrape parameters)
- This keeps results clean: one row per car per source

**Phase:** Address in schema design and scraper orchestration (Phase 1–2)

---

## Pitfall 6: Greek Text Encoding and Normalization

**What happens:** Greek characters in scraped content cause encoding issues, comparison failures, or display bugs.

**Warning signs:**
- Car model names show "?" or garbled characters
- Filter "Ηλεκτρικό" doesn't match scraped "ΗΛΕΚΤΡΙΚΟ"
- Sorting breaks on Greek strings

**Prevention:**
- Ensure Playwright uses UTF-8 throughout
- Normalize Greek fuel type labels to English enums in the normalization layer
- Use `String.normalize('NFC')` for display strings
- Store canonical enum values (not raw Greek text) in `CommonOffer`

**Phase:** Address in normalization layer (Phase 2)

---

## Pitfall 7: Local→Public Transition Complexity

**What happens:** The local tool works great for personal use. When you try to make it public, you realize: concurrent users trigger simultaneous scrapes, the server crashes, and sites block your IP.

**Warning signs:**
- Multiple simultaneous scrape requests
- Single IP gets banned after first day of public use
- No rate limiting, no queuing, no error recovery

**Prevention for v1 (local use):**
- Don't worry about concurrency — it's just you
- No need to solve this now

**Prevention for v2 (public product):**
- Implement a scrape queue (only one scrape at a time, others wait or get cached results)
- Add result caching with TTL (e.g., 1-hour cache — if data was scraped <1hr ago, serve cached)
- Consider proxy rotation for production
- Rate limit the `/api/scrape` endpoint
- Plan for this in the architecture now (don't design yourself into a corner)

**Phase:** Not for v1. Design architecture to allow adding queuing later (don't couple scraping to HTTP request lifecycle permanently)

---

## Pitfall 8: Offer Links Break or Redirect

**What happens:** The `sourceUrl` you captured during scraping is a session-specific URL that expires, or links to a car that's no longer available when the user clicks it.

**Warning signs:**
- Users click through to find "Offer not available" pages
- Links include session tokens or cart IDs

**Prevention:**
- Prefer stable canonical product URLs over session URLs
- Add a "(verify before contacting)" note near source links in the UI
- This is a UX expectation issue as much as a technical one

**Phase:** Address in UI and normalization (Phase 3–4)

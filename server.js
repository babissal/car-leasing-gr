const express = require('express')
const path = require('path')
const { scrape: scrapeInstacar } = require('./scrapers/instacar')
const { scrape: scrapeSpotawheel } = require('./scrapers/spotawheel')
const { scrape: scrapeExecutivelease } = require('./scrapers/executivelease')
const { scrape: scrapeAyvens } = require('./scrapers/ayvens')
const { scrape: scrapeEasyrental } = require('./scrapers/easyrental')
const { validateOffer } = require('./lib/schema')

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

let store = { offers: [], scrapedAt: null, errors: [] }

const VALID_DURATIONS = [12, 24, 36, 48]

function withTimeout(promise, ms, name) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${name} timed out after ${ms / 1000}s`)),
      ms
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

async function withRetry(fn, maxRetries = 1, delayMs = 2000) {
  let lastErr
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries) {
        console.warn(`Retry ${attempt + 1}/${maxRetries}: ${(err.message || '').slice(0, 80)}`)
        await new Promise(r => setTimeout(r, delayMs))
      }
    }
  }
  throw lastErr
}

function categorizeError(err) {
  const msg = (err && err.message || '').toLowerCase()
  if (msg.includes('err_name_not_resolved') || msg.includes('err_name_resolution_failed')) {
    return 'Site unreachable — DNS failure'
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return 'Timed out — site too slow (5 min limit)'
  }
  if (msg.includes('err_aborted') || msg.includes('err_connection_reset')) {
    return 'Connection blocked or interrupted — try again'
  }
  if (msg.includes('no listing') || msg.includes('0 results') || msg.includes('no offers')) {
    return 'No offers found — site layout may have changed'
  }
  return `Failed: ${(err && err.message || 'Unknown error').slice(0, 80)}`
}

const SCRAPERS = [
  { name: 'Instacar', fn: scrapeInstacar },
  { name: 'Spotawheel', fn: scrapeSpotawheel },
  { name: 'ExecutiveLease', fn: scrapeExecutivelease },
  { name: 'Ayvens', fn: scrapeAyvens },
  { name: 'EasyRental', fn: scrapeEasyrental },
]

app.post('/api/scrape', async (req, res) => {
  const results = await Promise.allSettled(
    SCRAPERS.map(({ name, fn }) =>
      withTimeout(fn(), 300000, name)
        .then(offers => ({ name, offers }))
    )
  )

  const allOffers = []
  const errors = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const scraperName = SCRAPERS[i].name
    if (result.status === 'fulfilled') {
      const { offers } = result.value
      const valid = offers.filter(o => {
        const { valid, errors: errs } = validateOffer(o)
        if (!valid) console.warn(`[${scraperName}] Invalid offer:`, errs, o)
        return valid
      })
      console.log(`[${scraperName}] ${valid.length} valid offers`)
      allOffers.push(...valid)
    } else {
      console.error(`[${scraperName}] Failed:`, result.reason?.message)
      errors.push(`${scraperName}: ${categorizeError(result.reason || new Error('Unknown error'))}`)
    }
  }

  // Sort by monthly price ascending
  allOffers.sort((a, b) => a.monthlyPrice - b.monthlyPrice)

  store = { offers: allOffers, scrapedAt: new Date().toISOString(), errors }
  return res.json({
    offers: store.offers,
    scrapedAt: store.scrapedAt,
    errors: store.errors,
    count: store.offers.length,
  })
})

app.get('/api/scrape-stream', async (req, res) => {
  // Step 1: Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  // Step 2: Flush headers immediately
  res.flushHeaders()

  // Step 3: Disable socket timeout for long-running scrapes
  req.socket.setTimeout(0)

  // Step 4: Track abort state
  let aborted = false
  req.on('close', () => { aborted = true })

  // Step 8: Declare accumulators
  const allOffers = []
  const errors = []

  // Step 9: Write initial "running" events for all scrapers synchronously
  for (const { name } of SCRAPERS) {
    if (!res.writableEnded) {
      res.write(`event: progress\ndata: ${JSON.stringify({ source: name, status: 'running', count: 0, error: null })}\n\n`)
    }
  }

  // Step 10: Build scraper promises — each emits a progress event as it resolves
  const scraperPromises = SCRAPERS.map(({ name, fn }) =>
    withTimeout(fn(), 300000, name)
      .then(offers => {
        const valid = offers.filter(o => validateOffer(o).valid)
        allOffers.push(...valid)
        if (!aborted && !res.writableEnded) {
          res.write(`event: progress\ndata: ${JSON.stringify({ source: name, status: 'done', count: valid.length, error: null, offers: valid })}\n\n`)
        }
      })
      .catch(err => {
        console.error(`[${name}] Failed:`, err?.message || err)
        const userMsg = categorizeError(err)
        errors.push(`${name}: ${userMsg}`)
        if (!aborted && !res.writableEnded) {
          res.write(`event: progress\ndata: ${JSON.stringify({ source: name, status: 'error', count: 0, error: userMsg })}\n\n`)
        }
      })
  )

  // Step 11: Wait for all scrapers to finish
  await Promise.allSettled(scraperPromises)

  // Step 12: Sort ascending by monthly price
  allOffers.sort((a, b) => a.monthlyPrice - b.monthlyPrice)

  // Step 13: Update store
  store = { offers: allOffers, scrapedAt: new Date().toISOString(), errors }

  // Step 14: Emit done event
  if (!aborted && !res.writableEnded) {
    res.write(`event: done\ndata: ${JSON.stringify({ offers: store.offers, scrapedAt: store.scrapedAt, errors: store.errors, count: store.offers.length })}\n\n`)
  }

  // Step 15: End the response unconditionally
  res.end()
})

app.get('/api/offers', (req, res) => {
  res.json({ offers: store.offers, scrapedAt: store.scrapedAt, errors: store.errors, count: store.offers.length })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(3000, () => console.log('Server running at http://localhost:3000'))

module.exports = app

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

const SCRAPERS = [
  { name: 'Instacar', fn: scrapeInstacar },
  { name: 'Spotawheel', fn: scrapeSpotawheel },
  { name: 'ExecutiveLease', fn: scrapeExecutivelease },
  { name: 'Ayvens', fn: scrapeAyvens },
  { name: 'EasyRental', fn: scrapeEasyrental },
]

app.post('/api/scrape', async (req, res) => {
  const { duration, advancePayment = 0 } = req.body
  const dur = parseInt(duration, 10)
  const adv = parseInt(advancePayment, 10) || 0

  if (!VALID_DURATIONS.includes(dur)) {
    return res.status(400).json({ error: 'Invalid duration. Must be 12, 24, 36, or 48.' })
  }

  const params = { duration: dur, advancePayment: adv }

  const results = await Promise.allSettled(
    SCRAPERS.map(({ name, fn }) =>
      fn(params).then(offers => ({ name, offers }))
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
      errors.push(`${scraperName}: ${result.reason?.message || 'Unknown error'}`)
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

  // Step 4: Parse query params
  const dur = parseInt(req.query.duration, 10)
  const adv = parseInt(req.query.advancePayment, 10) || 0

  // Step 5: Validate duration
  if (!VALID_DURATIONS.includes(dur)) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Invalid duration. Must be 12, 24, 36, or 48.' })}\n\n`)
    res.end()
    return
  }

  // Step 6: Build params
  const params = { duration: dur, advancePayment: adv }

  // Step 7: Track abort state
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
    fn(params)
      .then(offers => {
        const valid = offers.filter(o => validateOffer(o).valid)
        allOffers.push(...valid)
        if (!aborted && !res.writableEnded) {
          res.write(`event: progress\ndata: ${JSON.stringify({ source: name, status: 'done', count: valid.length, error: null })}\n\n`)
        }
      })
      .catch(err => {
        errors.push(`${name}: ${err.message || 'Unknown error'}`)
        if (!aborted && !res.writableEnded) {
          res.write(`event: progress\ndata: ${JSON.stringify({ source: name, status: 'error', count: 0, error: err.message || 'Failed' })}\n\n`)
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

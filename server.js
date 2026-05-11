const express = require('express')
const path = require('path')
const { scrape: scrapeInstacar } = require('./scrapers/instacar')
const { validateOffer } = require('./lib/schema')

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

let store = { offers: [], scrapedAt: null, errors: [] }

const VALID_DURATIONS = [12, 24, 36, 48]

app.post('/api/scrape', async (req, res) => {
  const { duration, advancePayment = 0 } = req.body
  const dur = parseInt(duration, 10)

  if (!VALID_DURATIONS.includes(dur)) {
    return res.status(400).json({ error: 'Invalid duration. Must be 12, 24, 36, or 48.' })
  }

  try {
    const offers = await scrapeInstacar({ duration: dur, advancePayment: parseInt(advancePayment, 10) || 0 })
    store = { offers, scrapedAt: new Date().toISOString(), errors: [] }
    return res.json({ offers: store.offers, scrapedAt: store.scrapedAt, errors: store.errors, count: store.offers.length })
  } catch (err) {
    console.error('[/api/scrape] Error:', err)
    store.errors = [err.message]
    return res.status(500).json({ error: err.message, offers: [], scrapedAt: new Date().toISOString() })
  }
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

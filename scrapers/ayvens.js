const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType, parseCO2 } = require('../lib/normalize')

const SOURCE = 'Ayvens'
const LISTING_URL = 'https://www.ayvens.com/el-gr/prosfores-leasing/'

async function scrapeDetailWithRetry(page, url, scrapedAt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await scrapeDetail(page, url, scrapedAt)
    } catch (err) {
      if (attempt === retries) throw err
      console.warn(`[ayvens] Retry ${attempt + 1} for ${url}: ${err.message.slice(0, 60)}`)
      await addJitter(2000, 3000)
    }
  }
}

async function scrapeDetail(page, url, scrapedAt) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 })
  await addJitter(800, 1500)

  const text = await page.evaluate(() => document.body.innerText)

  // Duration: "48 μήνες"
  const durMatch = text.match(/Διάρκεια μίσθωσης\s*\n?\s*(\d+)\s*μήνες/i)
  const durationMonths = durMatch ? parseInt(durMatch[1]) : null

  // Monthly price: first span.localized-price
  const prices = await page.$$eval('span.localized-price', els =>
    els.map(el => el.textContent.trim())
  ).catch(() => [])

  if (prices.length === 0) return null

  const monthlyPrice = normalizePrice(prices[0], false) // ex-VAT
  if (!monthlyPrice) return null

  // Advance payment: second localized-price (after "Προκαταβολή")
  const advanceRaw = prices.length >= 2 ? prices[1] : '0'
  const advancePayment = normalizePrice(advanceRaw, false) || 0

  // km per year: "20.000 χλμ / έτος"
  const kmMatch = text.match(/([\d.,]+)\s*χλμ\s*\/\s*έτος/i)
  const kmPerYear = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : null

  // Brand/model: from heading "Opel Corsa Edition Plus..."
  // Breadcrumb: Home > Προσφορές leasing > Opel > Corsa
  const brandMatch = text.match(/Προσφορές leasing\s*\n\s*([^\n]+)\s*\n\s*([^\n]+)/)
  let brand = '', model = ''
  if (brandMatch) {
    brand = brandMatch[1].trim()
    model = brandMatch[2].trim()
  } else {
    // Fallback: parse from heading "Brand Model Variant"
    const heading = text.match(/(?:Home|Αρχική)[^\n]*\n[^\n]*\n([^\n]+)\n([^\n]+)/i)
    if (heading) {
      const parts = heading[1].trim().split(' ')
      brand = parts[0]
      model = parts[1] || ''
    }
  }

  // Fuel type: after "Καύσιμο" label
  const fuelMatch = text.match(/Καύσιμο\s*\n\s*([^\n]+)/i)
  const fuelType = normalizeFuelType(fuelMatch ? fuelMatch[1] : '')

  // CO2
  const co2Match = text.match(/Εκπομπές CO2\s*\n?\s*(\d+)\s*g\/km/i)
  const co2gKm = co2Match ? parseCO2(co2Match[1]) : null

  // Services: standard Ayvens full-service
  const servicesIncluded = {
    insurance: text.includes('Ασφαλιστική') || text.includes('ασφαλιστική'),
    maintenance: text.includes('Συντήρηση') || text.includes('συντήρηση'),
    tyres: text.includes('Ελαστικά') || text.includes('ελαστικά'),
  }

  return createOffer({
    source: SOURCE,
    sourceUrl: url,
    brand,
    model,
    carType: 'Passenger',
    fuelType,
    monthlyPrice,
    advancePayment,
    durationMonths,
    kmPerYear,
    servicesIncluded,
    co2gKm,
    scrapedAt,
  })
}

async function scrape({ duration, advancePayment = 0 }) {
  const { browser, page } = await launchBrowser()
  try {
    await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await addJitter(1500, 2500)

    try {
      const btn = await page.$('button:has-text("Αποδοχή"), button:has-text("Accept")')
      if (btn) { await btn.click(); await page.waitForTimeout(600) }
    } catch {}

    // Collect individual offer URLs
    const offerUrls = await page.$$eval('a[href*="/prosfora/"]', els =>
      [...new Set(els.map(e => e.href))]
    )

    const scrapedAt = new Date().toISOString()
    const offers = []

    for (const url of offerUrls) {
      try {
        const offer = await scrapeDetailWithRetry(page, url, scrapedAt)
        if (!offer) continue
        // Filter by requested duration (each Ayvens offer has a fixed duration)
        if (offer.durationMonths === duration) {
          offers.push(offer)
        }
      } catch (err) {
        console.warn('[ayvens] Error on offer', url, ':', err.message)
      }
      await addJitter(500, 1000)
    }

    return offers
  } finally {
    await closeBrowser(browser)
  }
}

module.exports = { scrape }

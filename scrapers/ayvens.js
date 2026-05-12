const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType, parseCO2, parseBodyType } = require('../lib/normalize')

const SOURCE = 'Ayvens'
const LISTING_URL = 'https://www.ayvens.com/el-gr/prosfores-leasing/'

async function scrapeDetailWithRetry(page, url, scrapedAt, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await scrapeDetail(page, url, scrapedAt)
    } catch (err) {
      if (attempt === retries) throw err
      console.warn(`[ayvens] Retry ${attempt + 1} for ${url}: ${err.message.slice(0, 60)}`)
      await addJitter(1500, 2000)
    }
  }
}

async function scrapeDetail(page, url, scrapedAt) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
  // Wait specifically for the price element rather than full networkidle
  await page.waitForSelector('span.localized-price', { timeout: 10000 }).catch(() => {})
  await addJitter(500, 800)

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

  const bodyType = parseBodyType(text)

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
    bodyType,
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

async function scrape() {
  const { browser, page } = await launchBrowser()
  try {
    await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait for offer links to appear before interacting
    await page.waitForSelector('a[href*="/prosfora/"]', { timeout: 15000 }).catch(() => {})
    await addJitter(1500, 2000)

    try {
      const btn = await page.$('button:has-text("Αποδοχή"), button:has-text("Accept")')
      if (btn) { await btn.click(); await page.waitForTimeout(800) }
    } catch {}

    // Scroll + click "load more" to surface all lazy-loaded offer cards
    let prevCount = 0
    let noNewIter = 0
    for (let iter = 0; iter < 10; iter++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1500)

      // Try clicking any "load more" / "περισσότερα" style buttons
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('button, a')) {
          const t = (el.textContent || '').trim().toLowerCase()
          if (t.includes('περισσότερ') || t.includes('load more') || t.includes('show more') || t.includes('δείτε όλα')) {
            el.click()
            return
          }
        }
      }).catch(() => {})

      const count = await page.$$eval('a[href*="/prosfora/"]', els => new Set(els.map(e => e.href)).size)
      console.log(`[Ayvens] Scroll iter ${iter + 1}: ${count} offer URLs found`)
      if (count === prevCount) {
        noNewIter++
        if (noNewIter >= 3) break
      } else {
        noNewIter = 0
        prevCount = count
      }
    }

    const offerUrls = await page.$$eval('a[href*="/prosfora/"]', els =>
      [...new Set(els.map(e => e.href))]
    )
    console.log(`[Ayvens] Found ${offerUrls.length} offer URLs`)

    const scrapedAt = new Date().toISOString()
    const offers = []
    let consecutiveFailures = 0

    for (const url of offerUrls) {
      if (consecutiveFailures >= 5) {
        console.warn('[ayvens] 5 consecutive failures — stopping detail scrape early')
        break
      }
      try {
        const offer = await scrapeDetailWithRetry(page, url, scrapedAt)
        if (!offer) { consecutiveFailures++; continue }
        consecutiveFailures = 0
        offers.push(offer)
      } catch (err) {
        consecutiveFailures++
        console.warn('[ayvens] Error on offer', url, ':', err.message)
      }
    }

    return offers
  } finally {
    await closeBrowser(browser)
  }
}

module.exports = { scrape }

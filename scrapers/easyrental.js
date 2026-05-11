const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType } = require('../lib/normalize')

const SOURCE = 'EasyRental'
const BASE_URL = 'https://www.easyrental.gr/leasing/prosfores-kainouria/'
const DURATION_MONTHS = 48
const KM_PER_YEAR = 20000

const SKIP_PHRASES = new Set([
  'Leasing καινούρια', 'Leasing μεταχειρισμένα', 'Easy Deal', 'Easy Flex',
  'Ετοιμοπαράδοτο', 'Αναμένεται', 'ΠΡΟΒΟΛΗ ΠΡΟΣΦΟΡΑΣ', 'New', 'Used', 'Leasing',
])

function parseCard(cardText) {
  const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean)
  const cleaned = lines.filter(l => !SKIP_PHRASES.has(l) && !/^Leasing\b/.test(l))
  if (cleaned.length < 3) return null

  const brandModelLine = cleaned[0]
  const fuelLine = cleaned.find(l => /βενζίν|diesel|hybrid|ηλεκτρ/i.test(l)) || ''
  const priceLine = cleaned.find(l => /^\d+€$/.test(l))

  if (!priceLine) return null

  const priceNum = parseInt(priceLine.replace('€', ''), 10)
  if (!priceNum) return null

  const parts = brandModelLine.split(' ')
  const brand = parts[0] || 'Unknown'
  const model = parts.slice(1).join(' ') || ''
  const fuelType = normalizeFuelType(fuelLine)

  return { brand, model, fuelType, priceNum }
}

function extractCardsFromPage(page) {
  return page.evaluate(() => {
    const containers = document.querySelectorAll('.listing_main_container')
    const results = []
    containers.forEach(el => {
      const link = el.querySelector('a[href*="/leasing/prosfores-kainouria/"]')
      results.push({ url: link ? link.href : null, text: el.innerText })
    })
    return results
  })
}

async function scrape({ duration, advancePayment = 0 }) {
  // EasyRental only has 48-month offers
  if (duration !== DURATION_MONTHS) return []

  const { browser, page } = await launchBrowser()
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await addJitter(1000, 1500)

    // Accept cookies
    try {
      const btn = await page.$('button:has-text("Αποδοχή"), button:has-text("Αποδοχή όλων"), button:has-text("Accept")')
      if (btn) { await btn.click(); await page.waitForTimeout(800) }
    } catch {}

    // Get total page count from JetSmartFilters pagination
    const pageCount = await page.evaluate(() => {
      const nums = [...document.querySelectorAll('.jet-filters-pagination__item')]
        .map(el => parseInt(el.textContent.trim()))
        .filter(n => !isNaN(n) && n > 0)
      return nums.length > 0 ? Math.max(...nums) : 1
    })

    const scrapedAt = new Date().toISOString()
    const allOffers = []
    const seenUrls = new Set()

    // Scrape page 1 (already loaded)
    const page1Cards = await extractCardsFromPage(page)
    for (const { url, text } of page1Cards) {
      if (url && seenUrls.has(url)) continue
      if (url) seenUrls.add(url)
      const parsed = parseCard(text)
      if (!parsed) continue
      const monthlyPrice = normalizePrice(parsed.priceNum, false)
      if (!monthlyPrice) continue
      allOffers.push(createOffer({
        source: SOURCE, sourceUrl: url || BASE_URL, brand: parsed.brand, model: parsed.model,
        carType: 'Passenger', fuelType: parsed.fuelType, monthlyPrice, advancePayment: 0,
        durationMonths: DURATION_MONTHS, kmPerYear: KM_PER_YEAR,
        servicesIncluded: { insurance: true, maintenance: true, tyres: true },
        co2gKm: null, scrapedAt,
      }))
    }

    // Click through remaining pages via JetSmartFilters pagination links
    for (let p = 2; p <= pageCount; p++) {
      try {
        await addJitter(800, 1200)
        // Click page number link
        const clicked = await page.evaluate((targetPage) => {
          const links = [...document.querySelectorAll('.jet-filters-pagination__link')]
          const link = links.find(el => el.textContent.trim() === String(targetPage))
          if (link) { link.click(); return true }
          return false
        }, p)

        if (!clicked) { console.warn(`[easyrental] Could not click page ${p}`); break }

        // Wait for new cards to load
        await page.waitForLoadState('networkidle').catch(() => {})
        await addJitter(800, 1200)

        const pageCards = await extractCardsFromPage(page)
        for (const { url, text } of pageCards) {
          if (url && seenUrls.has(url)) continue
          if (url) seenUrls.add(url)
          const parsed = parseCard(text)
          if (!parsed) continue
          const monthlyPrice = normalizePrice(parsed.priceNum, false)
          if (!monthlyPrice) continue
          allOffers.push(createOffer({
            source: SOURCE, sourceUrl: url || BASE_URL, brand: parsed.brand, model: parsed.model,
            carType: 'Passenger', fuelType: parsed.fuelType, monthlyPrice, advancePayment: 0,
            durationMonths: DURATION_MONTHS, kmPerYear: KM_PER_YEAR,
            servicesIncluded: { insurance: true, maintenance: true, tyres: true },
            co2gKm: null, scrapedAt,
          }))
        }
      } catch (err) {
        console.warn(`[easyrental] Error on page ${p}:`, err.message)
      }
    }

    return allOffers
  } finally {
    await closeBrowser(browser)
  }
}

module.exports = { scrape }

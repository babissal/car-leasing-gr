const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType } = require('../lib/normalize')

const SOURCE = 'ExecutiveLease'
const LISTING_URL = 'https://executivelease.gr/leasing-offers/prosfores/oles'

// Map requested duration to nearest available on ExecutiveLease (36/48/60)
function mapDuration(requested) {
  if (requested <= 36) return 36
  return 48
}

function parseListingText(text) {
  const offers = []
  const blocks = text.split('Δείτε την προσφορά')

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

    // Find price line "€NNN.NN +ΦΠΑ"
    let priceIdx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^€\s*[\d.,]+\s*\+ΦΠΑ/.test(lines[i])) {
        priceIdx = i
        break
      }
    }
    if (priceIdx < 3) continue

    const priceMatch = lines[priceIdx].match(/([\d.,]+)/)
    if (!priceMatch) continue

    // Position-based: price at idx, spec at idx-1, model at idx-2, brand at idx-3
    const specLine = lines[priceIdx - 1] || ''
    const modelLine = lines[priceIdx - 2] || ''
    const brandLine = lines[priceIdx - 3] || ''

    // Validate: spec has | separator, brand/model are ALL CAPS Latin
    if (!specLine.includes('|')) continue
    if (!/^[A-Z0-9\s\-.,&+/()]+$/.test(modelLine)) continue
    if (!/^[A-Z\s\-&]+$/.test(brandLine) || brandLine.length < 2) continue

    const fuelPart = specLine.split('|')[0].trim()
    const fuelType = normalizeFuelType(fuelPart)
    const monthlyPrice = normalizePrice(priceMatch[1], false) // ex-VAT

    if (!monthlyPrice) continue

    // Title-case the ALL CAPS strings
    const toTitle = s => s.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')

    offers.push({
      brand: toTitle(brandLine),
      model: toTitle(modelLine),
      fuelType,
      monthlyPrice,
    })
  }

  return offers
}

async function scrape({ duration, advancePayment = 0 }) {
  const mappedDuration = mapDuration(duration)
  const { browser, page } = await launchBrowser()

  try {
    await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await addJitter(1500, 2000)

    // Click the duration filter checkbox
    try {
      const clicked = await page.evaluate((dur) => {
        const labels = [...document.querySelectorAll('label, span, div, a, button')]
        for (const el of labels) {
          if (el.textContent.trim() === String(dur) && el.offsetParent) {
            el.click()
            return true
          }
        }
        return false
      }, mappedDuration)

      if (clicked) {
        await page.waitForLoadState('networkidle').catch(() => {})
        await addJitter(1000, 1500)
      }
    } catch {}

    const scrapedAt = new Date().toISOString()
    const allParsed = []
    const seenModels = new Set()

    // Scrape current page and handle pagination
    const totalPages = await page.evaluate(() => {
      const text = document.body.innerText
      const match = text.match(/ΣΕΛΙΔΕΣ ΑΠΟΤΕΛΕΣΜΑΤΩΝ\s+(\d+)/)
      return match ? parseInt(match[1]) : 1
    })

    for (let p = 1; p <= Math.min(totalPages, 10); p++) {
      if (p > 1) {
        // Click page number
        const clicked = await page.evaluate((pageNum) => {
          const els = [...document.querySelectorAll('a, button, span')]
            .filter(el => el.textContent.trim() === String(pageNum) && el.offsetParent)
          // Prefer the one that looks like a pagination link (not content)
          for (const el of els) {
            if (el.tagName === 'A' || el.className.includes('pag') || el.closest('[class*="pag"]')) {
              el.click()
              return true
            }
          }
          if (els.length > 0) { els[els.length - 1].click(); return true }
          return false
        }, p)

        if (!clicked) break
        await page.waitForLoadState('networkidle').catch(() => {})
        await addJitter(800, 1200)
      }

      const pageText = await page.evaluate(() => {
        const main = document.querySelector('main, #main-content, .view-content, .field--type-entity-reference')
        return (main || document.body).innerText
      })

      const parsed = parseListingText(pageText)
      for (const item of parsed) {
        const key = item.brand + '|' + item.model
        if (!seenModels.has(key)) {
          seenModels.add(key)
          allParsed.push(item)
        }
      }
    }

    return allParsed.map(({ brand, model, fuelType, monthlyPrice }) =>
      createOffer({
        source: SOURCE,
        sourceUrl: LISTING_URL,
        brand,
        model,
        carType: 'Passenger',
        fuelType,
        monthlyPrice,
        advancePayment: 0,
        durationMonths: mappedDuration,
        kmPerYear: null,
        servicesIncluded: { insurance: true, maintenance: true, tyres: true },
        co2gKm: null,
        scrapedAt,
      })
    )
  } finally {
    await closeBrowser(browser)
  }
}

module.exports = { scrape }

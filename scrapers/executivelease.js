const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType } = require('../lib/normalize')

const SOURCE = 'ExecutiveLease'
const LISTING_URL = 'https://executivelease.gr/leasing-offers/prosfores/oles'

function parseListingText(text) {
  const offers = []
  const blocks = text.split('Δείτε την προσφορά')

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

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

    const specLine = lines[priceIdx - 1] || ''
    const modelLine = lines[priceIdx - 2] || ''
    const brandLine = lines[priceIdx - 3] || ''

    if (!specLine.includes('|')) continue
    if (!/^[A-Z0-9\s\-.,&+/()]+$/.test(modelLine)) continue
    if (!/^[A-Z\s\-&]+$/.test(brandLine) || brandLine.length < 2) continue

    const fuelType = normalizeFuelType(specLine.split('|')[0] || '')
    const monthlyPrice = normalizePrice(priceMatch[1], false)

    if (!monthlyPrice) continue

    // Extract duration: look specifically for "NN μήν" pattern (2+ digit number)
    const durMatch2 = specLine.match(/(\d{2,})\s*μήν/i)
    const specDuration = durMatch2 ? parseInt(durMatch2[1]) : null

    // Extract km: look for number followed by χλμ or km
    const kmMatch2 = specLine.match(/([\d.]+)\s*(?:χλμ|km)/i)
    const specKm = kmMatch2 ? parseInt(kmMatch2[1].replace(/\./g, '')) : null

    const toTitle = s => s.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')

    offers.push({
      brand: toTitle(brandLine),
      model: toTitle(modelLine),
      fuelType,
      monthlyPrice,
      durationMonths: specDuration,
      kmPerYear: specKm,
    })
  }

  return offers
}

async function scrape() {
  const { browser, page } = await launchBrowser()

  try {
    await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await addJitter(1500, 2000)

    const scrapedAt = new Date().toISOString()
    const seenOffers = new Set()
    const allOffers = []

    const totalPages = await page.evaluate(() => {
      const text = document.body.innerText
      const match = text.match(/ΣΕΛΙΔΕΣ ΑΠΟΤΕΛΕΣΜΑΤΩΝ\s+(\d+)/)
      return match ? parseInt(match[1]) : 1
    })

    console.log(`[ExecutiveLease] ${totalPages} pages`)

    for (let p = 1; p <= Math.min(totalPages, 15); p++) {
      if (p > 1) {
        const clicked = await page.evaluate((pageNum) => {
          const els = [...document.querySelectorAll('a, button, span')]
            .filter(el => el.textContent.trim() === String(pageNum) && el.offsetParent)
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
        await page.waitForTimeout(2500)
      }

      const pageText = await page.evaluate(() => {
        const main = document.querySelector('main, #main-content, .view-content, .field--type-entity-reference')
        return (main || document.body).innerText
      }).catch(() => '')

      if (!pageText) { console.warn(`[executivelease] Empty page text on page ${p}, skipping`); continue }
      const items = parseListingText(pageText)
      console.log(`[ExecutiveLease] Page ${p}: ${items.length} items parsed`)

      for (const { brand, model, fuelType, monthlyPrice, durationMonths, kmPerYear } of items) {
        const key = `${brand}|${model}|${durationMonths}|${kmPerYear}|${monthlyPrice}`
        if (seenOffers.has(key)) continue
        seenOffers.add(key)
        allOffers.push(createOffer({
          source: SOURCE,
          sourceUrl: LISTING_URL,
          brand,
          model,
          bodyType: null,
          carType: 'Passenger',
          fuelType,
          monthlyPrice,
          advancePayment: 0,
          durationMonths: durationMonths || 36,
          kmPerYear: kmPerYear || null,
          servicesIncluded: { insurance: true, maintenance: true, tyres: true },
          co2gKm: null,
          scrapedAt,
        }))
      }
    }

    return allOffers
  } finally {
    await closeBrowser(browser)
  }
}

module.exports = { scrape }

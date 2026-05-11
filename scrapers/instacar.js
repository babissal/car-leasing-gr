// Instacar.gr Playwright adapter
// Selectors verified 2026-05-11:
//   listing card = 'a.vehicle-card'
//   brand+model  = 'h2 span:first-child' (e.g. "VOLKSWAGEN T-CROSS")
//   variant/trim = 'h2 span:nth-child(2)' (e.g. "MORE TSI")
//   fuel type    = last bullet-separated text in the card attributes div
//   price        = detail page "Σύνολο" after clicking price-calculator duration button
//   CO2          = text after "Εκπομπές CO2" in characteristics section
//   maintenance  = "Δωρεάν service" in services list

const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer, validateOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType, parseServices, parseCO2 } = require('../lib/normalize')

const INSTACAR_URL = 'https://www.instacar.gr/leasing/metaxeirismena'
const SOURCE_NAME = 'Instacar'

async function scrape({ duration, advancePayment = 0 }) {
  const { browser, context, page } = await launchBrowser()

  try {
    console.log(`[Instacar] Navigating to ${INSTACAR_URL}`)
    await page.goto(INSTACAR_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await addJitter(1500, 2500)

    // Accept cookie consent
    try {
      const cookieBtn = await page.$('button:has-text("Αποδοχή")')
      if (cookieBtn) { await cookieBtn.click(); await page.waitForTimeout(600) }
    } catch { /* no cookie banner */ }

    // Collect cards (scroll to load more)
    console.log('[Instacar] Collecting listing cards...')
    const rawListings = await collectCards(page)
    console.log(`[Instacar] Found ${rawListings.length} cards`)

    if (rawListings.length === 0) {
      const html = await page.content()
      console.error('[Instacar] Page snippet:', html.slice(0, 1000))
      throw new Error('Instacar: no listing cards found on page')
    }

    // Visit each detail page (cap at 30 to keep run time reasonable)
    const capped = rawListings.slice(0, 30)
    const offers = []

    for (const listing of capped) {
      try {
        console.log(`[Instacar] Detail: ${listing.sourceUrl}`)
        const detail = await fetchDetailPage(page, listing.sourceUrl, duration)
        if (!detail) {
          console.log(`[Instacar] Skipping — duration ${duration}m not available for ${listing.brand} ${listing.model}`)
          continue
        }

        const monthlyPrice = normalizePrice(detail.priceExVat, false) // ex-VAT → incl. 24% VAT
        const fuelType = normalizeFuelType(listing.fuelType)
        const servicesIncluded = parseServices(detail.servicesText)
        const co2gKm = parseCO2(detail.co2Text)

        const offer = createOffer({
          source: SOURCE_NAME,
          sourceUrl: listing.sourceUrl,
          brand: listing.brand,
          model: listing.model,
          carType: null,
          fuelType,
          monthlyPrice,
          advancePayment,
          durationMonths: duration,
          kmPerYear: null,
          servicesIncluded,
          co2gKm,
          scrapedAt: new Date().toISOString()
        })

        const validation = validateOffer(offer)
        if (validation.valid) {
          offers.push(offer)
          console.log(`[Instacar] Added: ${offer.brand} ${offer.model} @ €${offer.monthlyPrice}/mo`)
        } else {
          console.warn('[Instacar] Dropped invalid offer:', validation.errors, listing)
        }
      } catch (err) {
        console.warn(`[Instacar] Error on ${listing.sourceUrl}: ${err.message}`)
      }
      await addJitter(300, 700)
    }

    console.log(`[Instacar] Returning ${offers.length} valid offers`)
    return offers
  } finally {
    await closeBrowser(browser)
  }
}

async function collectCards(page) {
  const seen = new Set()
  const listings = []
  let prevCount = 0
  let noNewIter = 0

  for (let iter = 0; iter < 8; iter++) {
    const cards = await page.$$('a.vehicle-card')

    for (const card of cards) {
      const data = await card.evaluate(el => {
        const h2Spans = el.querySelectorAll('h2 span')
        const titleText = h2Spans[0] ? h2Spans[0].textContent.trim() : ''
        const variantText = h2Spans[1] ? h2Spans[1].textContent.trim() : ''

        // Split "VOLKSWAGEN T-CROSS" → brand="VOLKSWAGEN", model="T-CROSS VARIANT"
        const parts = titleText.split(/\s+/)
        const brand = parts[0] || null
        const modelBase = parts.slice(1).join(' ')
        const model = variantText ? `${modelBase} ${variantText}`.trim() : modelBase

        // Fuel type: last span in the attributes row (gap-x-1 flex container)
        // Structure: [5 Άτομα] • [Χειροκίνητο] • [Βενζίνη]
        let fuelType = null
        const attrDiv = el.querySelector('[class*="gap-x-1"]')
        if (attrDiv) {
          const attrSpans = [...attrDiv.querySelectorAll('span')]
          const attrTexts = attrSpans.map(s => s.textContent.trim()).filter(t => t && t !== '•')
          fuelType = attrTexts[attrTexts.length - 1] || null
        }

        const href = el.getAttribute('href') || ''
        const sourceUrl = href.startsWith('http') ? href : `https://www.instacar.gr${href}`

        return { brand, model, fuelType, sourceUrl }
      }).catch(() => null)

      if (data && data.sourceUrl && !seen.has(data.sourceUrl)) {
        seen.add(data.sourceUrl)
        listings.push(data)
      }
    }

    if (listings.length === prevCount) {
      noNewIter++
      if (noNewIter >= 2) break
    } else {
      noNewIter = 0
      prevCount = listings.length
    }

    // Scroll to bottom to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)
  }

  return listings
}

async function fetchDetailPage(page, url, duration) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)

  // Accept cookies if present (first detail page after listing)
  try {
    const btn = await page.$('button:has-text("Αποδοχή")')
    if (btn) { await btn.click(); await page.waitForTimeout(500) }
  } catch {}

  // Find and click the price-calculator duration button (second set — class includes leading-[1.375rem])
  // These are the small buttons that change the price in the pricing widget
  const durationText = `${duration}Μήνες`
  const clicked = await page.evaluate((target) => {
    const buttons = [...document.querySelectorAll('button')]
    // Filter to buttons that contain the duration text and have the smaller styling
    const durationBtns = buttons.filter(b => {
      const text = b.textContent.trim()
      return text.startsWith(target.replace('Μήνες', '')) && text.includes('Μήν')
        && b.className.includes('leading-[1.375rem]')
    })
    if (durationBtns.length === 0) return false
    durationBtns[durationBtns.length - 1].click()
    return true
  }, durationText)

  if (!clicked) {
    // Duration option not available for this car
    return null
  }

  await page.waitForTimeout(1500)

  // Extract monthly price from the pricing calculator:
  // instastart total / N months = monthly price
  // (for campaign cars, use the LARGEST amount shown = regular instastart)
  const priceExVat = await page.evaluate(() => {
    const text = document.body.innerText
    const instIdx = text.indexOf('instastart')
    if (instIdx < 0) return null

    const section = text.slice(instIdx, instIdx + 400)

    // Number of months in instastart (e.g. "2 μισθώματα" → 2)
    const nMatch = section.match(/(\d+)\s*μισθώματα/)
    const n = nMatch ? parseInt(nMatch[1]) : null
    if (!n) return null

    // Find all € amounts in this section BEFORE "Σύνολο"
    const synIdx = section.indexOf('Σύνολο')
    const beforeSyn = synIdx > 0 ? section.slice(0, synIdx) : section
    const amtMatches = [...beforeSyn.matchAll(/(\d[\d\.,]+)€/g)]
    const amounts = amtMatches.map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')))
    if (amounts.length === 0) return null

    // Use largest amount = regular (non-discounted) instastart
    const instastart = Math.max(...amounts)
    const monthly = instastart / n
    return String(monthly)
  })

  // CO2 from characteristics section
  const co2Text = await page.evaluate(() => {
    const bodyText = document.body.innerText
    const match = bodyText.match(/Εκπομπές CO2\s*[\n\r]*(\d+)/)
    return match ? match[1] : null
  })

  // Services text
  const servicesText = await page.evaluate(() => {
    // Look for the services/benefits list in the subscription section
    const items = [...document.querySelectorAll('li span, li')]
    return items.map(el => el.textContent.trim()).join(' ')
  })

  return { priceExVat, co2Text, servicesText }
}

module.exports = { scrape }

const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer, validateOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType, parseServices, parseCO2, parseBodyType } = require('../lib/normalize')

const INSTACAR_URL = 'https://www.instacar.gr/leasing/metaxeirismena'
const SOURCE_NAME = 'Instacar'
const SUPPORTED_DURATIONS = [12, 24, 36]

async function scrape() {
  const { browser, context, page } = await launchBrowser()

  try {
    console.log(`[Instacar] Navigating to ${INSTACAR_URL}`)
    await page.goto(INSTACAR_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForSelector('a.vehicle-card', { timeout: 12000 }).catch(() => {})
    await addJitter(1000, 1500)

    try {
      const cookieBtn = await page.$('button:has-text("Αποδοχή")')
      if (cookieBtn) { await cookieBtn.click(); await page.waitForTimeout(600) }
    } catch { /* no cookie banner */ }

    console.log('[Instacar] Collecting listing cards...')
    const rawListings = await collectCards(page)
    console.log(`[Instacar] Found ${rawListings.length} cards`)

    if (rawListings.length === 0) {
      const html = await page.content()
      console.error('[Instacar] Page snippet:', html.slice(0, 1000))
      throw new Error('Instacar: no listing cards found on page')
    }

    const capped = rawListings.slice(0, 15)
    const offers = []

    for (const listing of capped) {
      try {
        console.log(`[Instacar] Detail: ${listing.sourceUrl}`)
        const detail = await fetchDetailPage(page, listing.sourceUrl)
        if (!detail || detail.durationResults.length === 0) {
          console.log(`[Instacar] No durations available for ${listing.brand} ${listing.model}`)
          continue
        }

        const fuelType = normalizeFuelType(listing.fuelType)
        const servicesIncluded = parseServices(detail.servicesText)
        const co2gKm = parseCO2(detail.co2Text)
        const scrapedAt = new Date().toISOString()

        for (const { duration, priceExVat } of detail.durationResults) {
          const monthlyPrice = normalizePrice(priceExVat, false)
          if (!monthlyPrice) continue

          const offer = createOffer({
            source: SOURCE_NAME,
            sourceUrl: listing.sourceUrl,
            brand: listing.brand,
            model: listing.model,
            bodyType: detail.bodyType,
            carType: null,
            fuelType,
            monthlyPrice,
            advancePayment: 0,
            durationMonths: duration,
            kmPerYear: null,
            servicesIncluded,
            co2gKm,
            scrapedAt
          })

          const validation = validateOffer(offer)
          if (validation.valid) {
            offers.push(offer)
            console.log(`[Instacar] Added: ${offer.brand} ${offer.model} ${duration}m @ €${offer.monthlyPrice}/mo`)
          } else {
            console.warn('[Instacar] Dropped invalid offer:', validation.errors, listing)
          }
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

        const parts = titleText.split(/\s+/)
        const brand = parts[0] || null
        const modelBase = parts.slice(1).join(' ')
        const model = variantText ? `${modelBase} ${variantText}`.trim() : modelBase

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

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)
  }

  return listings
}

async function fetchDetailPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
  // Wait for instastart section to be JS-rendered (don't wait for full load)
  await page.waitForFunction(() => document.body.innerText.includes('instastart'), { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)

  try {
    const btn = await page.$('button:has-text("Αποδοχή")')
    if (btn) { await btn.click(); await page.waitForTimeout(500) }
  } catch {}

  const durationResults = []

  for (const duration of SUPPORTED_DURATIONS) {
    const durationText = `${duration}Μήνες`
    const clicked = await page.evaluate((target) => {
      const buttons = [...document.querySelectorAll('button')]
      const durationBtns = buttons.filter(b => {
        const text = b.textContent.trim()
        return text.startsWith(target.replace('Μήνες', '')) && text.includes('Μήν')
          && b.className.includes('leading-[1.375rem]')
      })
      if (durationBtns.length === 0) return false
      durationBtns[durationBtns.length - 1].click()
      return true
    }, durationText)

    if (!clicked) continue
    await page.waitForTimeout(700)

    // Select 0 instastart so we get the no-advance-payment monthly price
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')]
      const zeroBtn = buttons.find(b =>
        b.textContent.trim() === '0' && b.className.includes('leading-[1.375rem]') && b.offsetParent
      )
      if (zeroBtn) zeroBtn.click()
    })
    await page.waitForTimeout(500)

    const priceExVat = await page.evaluate((dur) => {
      const text = document.body.innerText
      const instIdx = text.indexOf('instastart')
      if (instIdx < 0) return null

      const section = text.slice(instIdx, instIdx + 600)
      const synIdx = section.indexOf('Σύνολο')
      if (synIdx < 0) return null

      // With 0 instastart selected, Σύνολο = total of all monthly payments
      // monthly price = Σύνολο / duration_months
      const afterSyn = section.slice(synIdx + 'Σύνολο'.length)
      const totalMatch = afterSyn.match(/(\d[\d.,]+)/)
      if (totalMatch) {
        const total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'))
        if (total > 0 && !isNaN(total)) return String(total / dur)
      }

      // Fallback: instastart_amount / N_months (used when 0-instastart button wasn't clickable)
      const nMatch = section.match(/(\d+)\s*μισθώματα/)
      const n = nMatch ? parseInt(nMatch[1]) : null
      if (!n) return null
      const beforeSyn = section.slice(0, synIdx)
      const amtMatches = [...beforeSyn.matchAll(/(\d[\d\.,]+)€/g)]
      const amounts = amtMatches.map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')))
      if (amounts.length === 0) return null
      return String(Math.max(...amounts) / n)
    }, duration)

    if (priceExVat) durationResults.push({ duration, priceExVat })
  }

  const pageText = await page.evaluate(() => document.body.innerText)

  const co2Text = await page.evaluate(() => {
    const bodyText = document.body.innerText
    const match = bodyText.match(/Εκπομπές CO2\s*[\n\r]*(\d+)/)
    return match ? match[1] : null
  })

  const servicesText = await page.evaluate(() => {
    const items = [...document.querySelectorAll('li span, li')]
    return items.map(el => el.textContent.trim()).join(' ')
  })

  const bodyType = parseBodyType(pageText)

  return { durationResults, co2Text, servicesText, bodyType }
}

module.exports = { scrape }

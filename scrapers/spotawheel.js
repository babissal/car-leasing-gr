const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType, parseServices } = require('../lib/normalize')

const SOURCE = 'Spotawheel'
const LISTING_URL = 'https://www.spotawheel.gr/subscribe'

async function scrape({ duration, advancePayment = 0 }) {
  if (![24, 36, 48].includes(duration)) return [] // Spotawheel has no 12-month plan

  const { browser, page } = await launchBrowser()
  try {
    await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await addJitter(1500, 2500)

    try {
      const btn = await page.$('button:has-text("Αποδοχή"), button:has-text("Accept")')
      if (btn) { await btn.click(); await page.waitForTimeout(600) }
    } catch {}

    // Collect card URLs + fuel type from listing
    const cardDataList = await page.$$eval('a[data-ref="carCard"]', els =>
      els.map(el => {
        const parent = el.closest('[class]') || el.parentElement
        return {
          url: el.href,
          text: parent ? parent.innerText.slice(0, 300) : el.innerText
        }
      })
    )

    const scrapedAt = new Date().toISOString()
    const offers = []

    for (const { url, text: cardText } of cardDataList) {
      try {
        const fuelType = normalizeFuelType(
          cardText.match(/βενζίν|ηλεκτρικ|diesel|hybrid|plug.?in/i)?.[0] || ''
        )

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        await addJitter(1000, 1500)

        const pageText = await page.evaluate(() => document.body.innerText)

        // Check current duration from "Διάρκεια: N Μήνες"
        const curDurMatch = pageText.match(/Διάρκεια:\s*(\d+)\s*Μήνες/i)
        const currentDur = curDurMatch ? parseInt(curDurMatch[1]) : 48

        if (currentDur !== duration) {
          // Click the duration tab element whose text is just the number
          const clicked = await page.evaluate((dur) => {
            for (const el of document.querySelectorAll('*')) {
              const t = el.textContent.trim()
              if (t === String(dur) && el.children.length === 0 && el.offsetParent) {
                const parent = el.parentElement
                if (parent && parent.textContent.includes('Μήνες')) {
                  el.click()
                  return true
                }
              }
            }
            return false
          }, duration)

          if (clicked) await page.waitForTimeout(1200)
        }

        // Always select 0% advance payment
        await page.evaluate(() => {
          for (const el of document.querySelectorAll('*')) {
            if (el.textContent.trim() === '0%' && el.children.length === 0 && el.offsetParent) {
              el.click()
              return
            }
          }
        })
        await page.waitForTimeout(600)

        const updatedText = await page.evaluate(() => document.body.innerText)

        // Extract price from line just before "Χωρίς ΦΠΑ"
        const priceMatch = updatedText.match(/(\d[\d.,]*)\s*€\s*\n\s*Χωρίς ΦΠΑ/i)
        if (!priceMatch) { console.warn('[spotawheel] No price for', url); continue }

        const monthlyPrice = normalizePrice(priceMatch[1], false)
        if (!monthlyPrice) continue

        // Brand/model: text after "Πίσω" header
        const carMatch = updatedText.match(/Πίσω\s*\n\s*([^\n]+)\n\s*([^\n]+)/)
        let brand = 'Unknown', model = '', variant = ''
        if (carMatch) {
          const [rawBrand, ...rawModel] = carMatch[1].trim().split(' ')
          brand = rawBrand
          model = rawModel.join(' ')
          variant = carMatch[2].trim()
        }

        // km per year
        const kmMatch = updatedText.match(/(\d[\d.,]*)\s*χλμ\s*ετησίως/i)
        const kmPerYear = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : 20000

        // Services from FAQ section text
        const services = parseServices(updatedText)
        if (updatedText.includes('ΑΣΦΑΛΙΣΗ')) services.insurance = true
        if (updatedText.includes('ΣΥΝΤΗΡΗΣΗ')) services.maintenance = true

        offers.push(createOffer({
          source: SOURCE,
          sourceUrl: url,
          brand,
          model,
          carType: updatedText.includes('ΚΑΙΝΟΥΡΓΙΟ') ? 'Passenger' : 'Passenger',
          fuelType,
          monthlyPrice,
          advancePayment: 0,
          durationMonths: duration,
          kmPerYear,
          servicesIncluded: services,
          co2gKm: null,
          scrapedAt,
        }))
      } catch (err) {
        console.warn('[spotawheel] Error on card', url, ':', err.message)
      }

      await addJitter(500, 1000)
    }

    return offers
  } finally {
    await closeBrowser(browser)
  }
}

module.exports = { scrape }

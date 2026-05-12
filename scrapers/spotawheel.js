const { launchBrowser, closeBrowser, addJitter } = require('./base')
const { createOffer } = require('../lib/schema')
const { normalizePrice, normalizeFuelType, parseServices, parseBodyType } = require('../lib/normalize')

const SOURCE = 'Spotawheel'
const LISTING_URL = 'https://www.spotawheel.gr/subscribe'
const SUPPORTED_DURATIONS = [24, 36, 48]

async function scrape() {
  const { browser, page } = await launchBrowser()
  try {
    await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await addJitter(1500, 2500)

    try {
      const btn = await page.$('button:has-text("Αποδοχή"), button:has-text("Accept")')
      if (btn) { await btn.click(); await page.waitForTimeout(600) }
    } catch {}

    // Scroll to load all lazy-loaded cards before collecting
    let prevCount = 0
    let noNewIter = 0
    for (let iter = 0; iter < 10; iter++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1500)
      const count = await page.$$eval('a[data-ref="carCard"]', els => els.length)
      if (count === prevCount) {
        noNewIter++
        if (noNewIter >= 2) break
      } else {
        noNewIter = 0
        prevCount = count
      }
    }

    const cardDataList = await page.$$eval('a[data-ref="carCard"]', els =>
      els.map(el => {
        const parent = el.closest('[class]') || el.parentElement
        return {
          url: el.href,
          text: parent ? parent.innerText.slice(0, 300) : el.innerText
        }
      })
    )
    console.log(`[Spotawheel] Found ${cardDataList.length} cards`)

    const scrapedAt = new Date().toISOString()
    const offers = []

    for (const { url, text: cardText } of cardDataList) {
      try {
        const fuelType = normalizeFuelType(
          cardText.match(/βενζίν|ηλεκτρικ|diesel|hybrid|plug.?in/i)?.[0] || ''
        )

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        await addJitter(1000, 1500)

        // Extract car identity and services once — they don't vary by duration
        const initialText = await page.evaluate(() => document.body.innerText)

        const bodyType = parseBodyType(initialText)

        const services = parseServices(initialText)
        if (initialText.includes('ΑΣΦΑΛΙΣΗ')) services.insurance = true
        if (initialText.includes('ΣΥΝΤΗΡΗΣΗ')) services.maintenance = true

        let brand = 'Unknown', model = ''
        const carMatch = initialText.match(/Πίσω\s*\n\s*([^\n]+)\n\s*([^\n]+)/)
        if (carMatch) {
          const [rawBrand, ...rawModel] = carMatch[1].trim().split(' ')
          brand = rawBrand
          model = rawModel.join(' ')
        }

        for (const duration of SUPPORTED_DURATIONS) {
          try {
            // Read current duration from page before deciding whether to click
            const currentText = await page.evaluate(() => document.body.innerText)
            const curDurMatch = currentText.match(/Διάρκεια:\s*(\d+)\s*Μήνες/i)
            const currentDur = curDurMatch ? parseInt(curDurMatch[1]) : -1

            if (currentDur !== duration) {
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

              if (!clicked) continue // tab doesn't exist for this car
              await page.waitForTimeout(1200)
            }

            // Select 0% advance payment
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

            const priceMatch = updatedText.match(/(\d[\d.,]*)\s*€\s*\n\s*Χωρίς ΦΠΑ/i)
            if (!priceMatch) continue

            const monthlyPrice = normalizePrice(priceMatch[1], false)
            if (!monthlyPrice) continue

            const kmMatch = updatedText.match(/(\d[\d.,]*)\s*χλμ\s*ετησίως/i)
            const kmPerYear = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : 20000

            offers.push(createOffer({
              source: SOURCE,
              sourceUrl: url,
              brand,
              model,
              bodyType,
              carType: 'Passenger',
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
            console.warn(`[spotawheel] Error on duration ${duration} for ${url}: ${err.message}`)
          }
        }
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

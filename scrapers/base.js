const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
chromium.use(StealthPlugin())

async function launchBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'el-GR',
    extraHTTPHeaders: { 'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8' }
  })
  context.setDefaultTimeout(30000)
  const page = await context.newPage()
  return { browser, context, page }
}

async function closeBrowser(browser) {
  await browser.close()
}

async function waitForResults(page, selector, options = {}) {
  const timeout = options.timeout || 15000
  try {
    await page.waitForSelector(selector, { timeout })
    return true
  } catch {
    try {
      await page.waitForLoadState('networkidle', { timeout })
      return true
    } catch {
      return false
    }
  }
}

function addJitter(minMs = 500, maxMs = 2000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (maxMs - minMs) + minMs))
}

module.exports = { launchBrowser, closeBrowser, waitForResults, addJitter }

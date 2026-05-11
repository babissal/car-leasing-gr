document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrape-btn')
  const durationSelect = document.getElementById('duration')
  const statusEl = document.getElementById('status')
  const metaEl = document.getElementById('meta')
  const tbody = document.getElementById('results-body')
  const sortPriceTh = document.getElementById('sort-price')

  let lastOffers = []
  const sortState = { column: 'monthlyPrice', dir: 'asc' }

  scrapeBtn.addEventListener('click', async () => {
    const duration = parseInt(durationSelect.value, 10)
    scrapeBtn.disabled = true
    scrapeBtn.textContent = 'Scraping all sites…'
    statusEl.textContent = ''
    statusEl.style.color = '#c00'
    tbody.innerHTML = ''
    metaEl.textContent = 'Running scrapers in parallel — this may take 60–120 seconds…'

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, advancePayment: 0 })
      })

      const data = await response.json()

      if (!response.ok) {
        statusEl.textContent = 'Error: ' + (data.error || response.statusText)
        metaEl.textContent = ''
        return
      }

      if (data.errors && data.errors.length > 0) {
        statusEl.style.color = '#c60'
        statusEl.textContent = 'Partial errors: ' + data.errors.join(' | ')
      } else {
        statusEl.textContent = ''
      }

      lastOffers = data.offers || []
      sortState.dir = 'asc'
      sortPriceTh.textContent = 'Monthly (€) ↑'
      renderOffers(lastOffers)

      if (data.scrapedAt) {
        const time = new Date(data.scrapedAt).toLocaleTimeString('el-GR')
        const sources = [...new Set(lastOffers.map(o => o.source))].join(', ')
        metaEl.textContent = `${data.count ?? lastOffers.length} offers from: ${sources || '—'} · ${time}`
      }
    } catch (err) {
      statusEl.textContent = 'Network error — is the server running?'
      metaEl.textContent = ''
    } finally {
      scrapeBtn.disabled = false
      scrapeBtn.textContent = 'Scrape All Sites'
    }
  })

  sortPriceTh.addEventListener('click', () => {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
    sortPriceTh.textContent = 'Monthly (€) ' + (sortState.dir === 'asc' ? '↑' : '↓')
    renderOffers(lastOffers)
  })

  function renderOffers(offers) {
    const sorted = [...offers].sort((a, b) =>
      sortState.dir === 'asc' ? a.monthlyPrice - b.monthlyPrice : b.monthlyPrice - a.monthlyPrice
    )

    tbody.innerHTML = ''
    sorted.forEach((offer, i) => {
      const tr = document.createElement('tr')
      const sourceLabel = offer.sourceUrl
        ? `<a href="${offer.sourceUrl}" target="_blank" rel="noopener">${offer.source} ↗</a>`
        : (offer.source || '—')
      tr.innerHTML = [
        `<td>${i + 1}</td>`,
        `<td>${offer.brand || '—'}</td>`,
        `<td>${offer.model || '—'}</td>`,
        `<td>${offer.fuelType || '—'}</td>`,
        `<td>€${(offer.monthlyPrice || 0).toLocaleString('el-GR', { minimumFractionDigits: 0 })}</td>`,
        `<td>${(offer.durationMonths || '—') + ' μήνες'}</td>`,
        `<td>${offer.kmPerYear ? offer.kmPerYear.toLocaleString('el-GR') : '—'}</td>`,
        `<td>${offer.servicesIncluded?.insurance ? '✓' : '✗'}</td>`,
        `<td>${offer.servicesIncluded?.maintenance ? '✓' : '✗'}</td>`,
        `<td>${offer.servicesIncluded?.tyres ? '✓' : '✗'}</td>`,
        `<td>${offer.co2gKm != null ? offer.co2gKm + ' g/km' : 'N/A'}</td>`,
        `<td>${sourceLabel}</td>`,
      ].join('')
      tbody.appendChild(tr)
    })
  }
})

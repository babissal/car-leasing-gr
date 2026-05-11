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
    scrapeBtn.textContent = 'Scraping...'
    statusEl.textContent = ''
    tbody.innerHTML = ''
    metaEl.textContent = ''

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, advancePayment: 0 })
      })

      const data = await response.json()

      if (!response.ok) {
        statusEl.textContent = 'Error: ' + (data.error || response.statusText)
        return
      }

      if (data.errors && data.errors.length > 0) {
        statusEl.textContent = 'Warning: ' + data.errors.join(', ')
      }

      lastOffers = data.offers || []
      sortState.dir = 'asc'
      sortPriceTh.textContent = 'Monthly (€) ↑'
      renderOffers(lastOffers)

      if (data.scrapedAt) {
        const time = new Date(data.scrapedAt).toLocaleTimeString('el-GR')
        metaEl.textContent = `Showing ${data.count ?? lastOffers.length} offers · Last scraped: ${time}`
      }
    } catch (err) {
      statusEl.textContent = 'Network error — is the server running?'
    } finally {
      scrapeBtn.disabled = false
      scrapeBtn.textContent = 'Scrape Instacar.gr'
    }
  })

  sortPriceTh.addEventListener('click', () => {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
    sortPriceTh.textContent = 'Monthly (€) ' + (sortState.dir === 'asc' ? '↑' : '↓')
    renderOffers(lastOffers)
  })

  function renderOffers(offers) {
    const sorted = [...offers].sort((a, b) => {
      return sortState.dir === 'asc'
        ? a.monthlyPrice - b.monthlyPrice
        : b.monthlyPrice - a.monthlyPrice
    })

    tbody.innerHTML = ''
    sorted.forEach((offer, i) => {
      const tr = document.createElement('tr')
      tr.innerHTML = [
        i + 1,
        offer.brand || '—',
        offer.model || '—',
        offer.fuelType || '—',
        '€' + (offer.monthlyPrice || 0).toLocaleString('el-GR', { minimumFractionDigits: 0 }),
        (offer.durationMonths || '—') + ' μήνες',
        offer.kmPerYear ? offer.kmPerYear.toLocaleString('el-GR') : '—',
        offer.servicesIncluded && offer.servicesIncluded.insurance ? '✓' : '✗',
        offer.servicesIncluded && offer.servicesIncluded.maintenance ? '✓' : '✗',
        offer.servicesIncluded && offer.servicesIncluded.tyres ? '✓' : '✗',
        offer.co2gKm !== null && offer.co2gKm !== undefined ? offer.co2gKm + ' g/km' : 'N/A',
        offer.sourceUrl
          ? `<a href="${offer.sourceUrl}" target="_blank" rel="noopener">Instacar ↗</a>`
          : '—'
      ].map((cell, idx) => idx === 11 ? `<td>${cell}</td>` : `<td>${cell}</td>`).join('')
      tbody.appendChild(tr)
    })
  }
})

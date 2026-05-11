document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrape-btn')
  const durationSelect = document.getElementById('duration')
  const statusEl = document.getElementById('status')
  const metaEl = document.getElementById('meta')
  const tbody = document.getElementById('results-body')
  const sortPriceTh = document.getElementById('sort-price')
  const progressEl = document.getElementById('progress-list')

  let lastOffers = []
  const sortState = { column: 'monthlyPrice', dir: 'asc' }
  let totalCount = 0

  scrapeBtn.addEventListener('click', () => {
    const duration = parseInt(durationSelect.value, 10)

    scrapeBtn.disabled = true
    scrapeBtn.textContent = 'Scraping…'
    statusEl.textContent = ''
    statusEl.style.color = '#c00'
    tbody.innerHTML = ''
    metaEl.textContent = ''
    progressEl.innerHTML = ''

    ;['Instacar', 'Spotawheel', 'ExecutiveLease', 'Ayvens', 'EasyRental'].forEach(name => {
      setSourceStatus(name, 'running')
    })

    const es = new EventSource(`/api/scrape-stream?duration=${duration}&advancePayment=0`)

    es.addEventListener('progress', (e) => {
      const { source, status, count, error } = JSON.parse(e.data)
      setSourceStatus(source, status, count, error)
    })

    es.addEventListener('done', (e) => {
      es.close()
      const data = JSON.parse(e.data)
      totalCount = data.count || 0
      lastOffers = data.offers || []
      sortState.dir = 'asc'
      sortPriceTh.textContent = 'Monthly (€) ↑'
      renderOffers(lastOffers)
      updateMeta(data)
      if (data.errors && data.errors.length > 0) {
        statusEl.style.color = '#c60'
        statusEl.textContent = 'Partial errors: ' + data.errors.join(' | ')
      } else {
        statusEl.textContent = ''
      }
      scrapeBtn.disabled = false
      scrapeBtn.textContent = 'Scrape All Sites'
    })

    es.onerror = () => {
      es.close()
      statusEl.textContent = 'Connection error — scrape may have failed'
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

  function setSourceStatus(name, status, count, error) {
    let span = progressEl.querySelector(`[data-source="${name}"]`)
    if (!span) {
      span = document.createElement('span')
      span.dataset.source = name
      progressEl.appendChild(span)
    }
    span.classList.remove('src-running', 'src-done', 'src-error')
    span.classList.add(`src-${status}`)
    if (status === 'running') span.textContent = `${name}: Scraping…`
    else if (status === 'done') span.textContent = `${name}: ✓ ${count} offers`
    else if (status === 'error') span.textContent = `${name}: ✗ ${error || 'Failed'}`
    else span.textContent = `${name}: ${status}`
  }

  function updateMeta(data) {
    const time = data.scrapedAt
      ? new Date(data.scrapedAt).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
      : '—'
    metaEl.textContent = `Last updated: ${time} · ${data.count} offers total`
  }
})

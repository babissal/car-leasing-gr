document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrape-btn')
  const durationSelect = document.getElementById('duration')
  const statusEl = document.getElementById('status')
  const metaEl = document.getElementById('meta')
  const tbody = document.getElementById('results-body')
  const sortPriceTh = document.getElementById('sort-price')
  const progressEl = document.getElementById('progress-list')

  const carTypeSelect    = document.getElementById('filter-car-type')
  const fuelCheckboxes   = document.querySelectorAll('#filter-fuel input[type=checkbox]')
  const zeroAdvanceCheck = document.getElementById('filter-zero-advance')
  const kmSelect         = document.getElementById('filter-km')
  const insuranceCheck   = document.getElementById('filter-insurance')
  const maintenanceCheck = document.getElementById('filter-maintenance')
  const tyresCheck       = document.getElementById('filter-tyres')
  const brandModelInput  = document.getElementById('filter-brand-model')
  const maxAdvanceInput  = document.getElementById('filter-max-advance')
  const suvCheck           = document.getElementById('filter-suv')
  const companyCheckboxes  = document.querySelectorAll('#filter-company input[type=checkbox]')

  let lastOffers = []
  const sortState = { column: 'monthlyPrice', dir: 'asc' }
  let totalCount = 0
  let lastScrapedAt = null

  renderTablePlaceholder("Click 'Scrape All Sites' to load offers.")

  scrapeBtn.addEventListener('click', () => {
    scrapeBtn.disabled = true
    scrapeBtn.textContent = 'Scraping…'
    statusEl.textContent = ''
    statusEl.classList.remove('status-partial', 'status-fatal')
    renderTablePlaceholder('Scraping in progress…')
    metaEl.textContent = ''
    progressEl.innerHTML = ''

    ;['Instacar', 'Spotawheel', 'ExecutiveLease', 'Ayvens', 'EasyRental'].forEach(name => {
      setSourceStatus(name, 'running')
    })

    const es = new EventSource('/api/scrape-stream')

    es.addEventListener('progress', (e) => {
      const { source, status, count, error, offers: sourceOffers } = JSON.parse(e.data)
      setSourceStatus(source, status, count, error)
      if (status === 'done' && sourceOffers) {
        lastOffers = [...lastOffers, ...sourceOffers]
        totalCount = lastOffers.length
        applyFilters()
      }
    })

    es.addEventListener('done', (e) => {
      es.close()
      const data = JSON.parse(e.data)
      totalCount = data.count || 0
      lastOffers = data.offers || []
      lastScrapedAt = data.scrapedAt || null
      sortState.dir = 'asc'
      sortPriceTh.textContent = 'Monthly (€) ↑'
      rebuildCarTypeOptions()
      applyFilters()
      statusEl.classList.remove('status-partial', 'status-fatal')
      if (data.errors && data.errors.length > 0) {
        statusEl.classList.add('status-partial')
        statusEl.textContent = 'Partial errors: ' + data.errors.join(' | ')
      } else {
        statusEl.textContent = ''
      }
      scrapeBtn.disabled = false
      scrapeBtn.textContent = 'Scrape All Sites'
    })

    es.onerror = () => {
      es.close()
      statusEl.classList.remove('status-partial')
      statusEl.classList.add('status-fatal')
      statusEl.textContent = 'Connection error — scrape may have failed'
      scrapeBtn.disabled = false
      scrapeBtn.textContent = 'Scrape All Sites'
      renderOffers([])
    }
  })

  fetch('/api/offers')
    .then(r => r.json())
    .then(data => {
      if (data.offers && data.offers.length > 0) {
        lastOffers = data.offers
        totalCount = data.offers.length
        lastScrapedAt = data.scrapedAt || null
        rebuildCarTypeOptions()
        applyFilters()
        if (data.errors && data.errors.length > 0) {
          statusEl.classList.remove('status-fatal')
          statusEl.classList.add('status-partial')
          statusEl.textContent = 'Partial errors: ' + data.errors.join(' | ')
        }
      }
    })
    .catch(() => {})

  sortPriceTh.addEventListener('click', () => {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
    sortPriceTh.textContent = 'Monthly (€) ' + (sortState.dir === 'asc' ? '↑' : '↓')
    applyFilters()
  })

  function renderTablePlaceholder(message) {
    tbody.innerHTML = ''
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = 13
    td.className = 'table-placeholder'
    td.textContent = message
    tr.appendChild(td)
    tbody.appendChild(tr)
  }

  function renderOffers(offers) {
    if (offers.length === 0) {
      let message
      if (scrapeBtn.disabled) {
        message = 'Scraping in progress…'
      } else if (lastOffers.length === 0) {
        message = "Click 'Scrape All Sites' to load offers."
      } else {
        message = 'No offers match current filters.'
      }
      renderTablePlaceholder(message)
      return
    }
    const sorted = [...offers].sort((a, b) =>
      sortState.dir === 'asc' ? a.monthlyPrice - b.monthlyPrice : b.monthlyPrice - a.monthlyPrice
    )

    tbody.innerHTML = ''
    sorted.forEach((offer, i) => {
      const tr = document.createElement('tr')
      const sourceLabel = offer.sourceUrl
        ? `<a href="${offer.sourceUrl}" target="_blank" rel="noopener" title="Verify this offer is still available before contacting">${offer.source} ↗</a>`
        : (offer.source || '—')
      tr.innerHTML = [
        `<td>${i + 1}</td>`,
        `<td>${offer.brand || '—'}</td>`,
        `<td>${offer.model || '—'}</td>`,
        `<td>${offer.fuelType || '—'}</td>`,
        `<td>€${(offer.monthlyPrice || 0).toLocaleString('el-GR', { minimumFractionDigits: 0 })}</td>`,
        `<td>${offer.advancePayment ? '€' + offer.advancePayment.toLocaleString('el-GR', { minimumFractionDigits: 0 }) : '—'}</td>`,
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

  function rebuildCarTypeOptions() {
    const types = [...new Set(lastOffers.map(o => o.carType).filter(Boolean))].sort()
    const selected = [...carTypeSelect.selectedOptions].map(o => o.value)
    carTypeSelect.innerHTML = ''
    types.forEach(t => {
      const opt = document.createElement('option')
      opt.value = t
      opt.textContent = t
      if (selected.includes(t)) opt.selected = true
      carTypeSelect.appendChild(opt)
    })
  }

  function applyFilters() {
    let filtered = [...lastOffers]

    // Company filter
    const activeCompanies = [...companyCheckboxes].filter(cb => cb.checked).map(cb => cb.value)
    if (activeCompanies.length > 0) {
      filtered = filtered.filter(o => activeCompanies.includes(o.source))
    }

    // Duration (client-side — scrape returns all durations)
    const durationFilter = parseInt(durationSelect.value, 10) || 0
    if (durationFilter > 0) {
      filtered = filtered.filter(o => o.durationMonths === durationFilter)
    }

    // FILT-01 — Car type
    const activeTypes = [...carTypeSelect.selectedOptions].map(o => o.value)
    if (activeTypes.length > 0) {
      filtered = filtered.filter(o => o.carType && activeTypes.includes(o.carType))
    }

    // FILT-02 — Fuel type
    const activeFuels = [...fuelCheckboxes].filter(cb => cb.checked).map(cb => cb.value)
    if (activeFuels.length > 0) {
      filtered = filtered.filter(o => activeFuels.includes(o.fuelType))
    }

    // FILT-04 — Advance payment
    if (zeroAdvanceCheck.checked) {
      filtered = filtered.filter(o => (o.advancePayment ?? 0) === 0)
    }
    const maxAdvance = maxAdvanceInput.value !== '' ? parseFloat(maxAdvanceInput.value) : null
    if (maxAdvance !== null) {
      filtered = filtered.filter(o => (o.advancePayment ?? 0) <= maxAdvance)
    }

    // FILT-05 — km/year
    const minKm = parseInt(kmSelect.value, 10) || 0
    if (minKm > 0) {
      filtered = filtered.filter(o => o.kmPerYear != null && o.kmPerYear >= minKm)
    }

    // FILT-06 — Services (each is independent AND)
    if (insuranceCheck.checked) {
      filtered = filtered.filter(o => o.servicesIncluded?.insurance === true)
    }
    if (maintenanceCheck.checked) {
      filtered = filtered.filter(o => o.servicesIncluded?.maintenance === true)
    }
    if (tyresCheck.checked) {
      filtered = filtered.filter(o => o.servicesIncluded?.tyres === true)
    }

    // FILT-07 — Brand/model
    const q = brandModelInput.value.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(o => (o.brand || '').toLowerCase().includes(q) || (o.model || '').toLowerCase().includes(q))
    }

    // Body type — SUV/Crossover
    if (suvCheck.checked) {
      filtered = filtered.filter(o => o.bodyType === 'SUV')
    }

    renderOffers(filtered)

    if (lastScrapedAt !== null || totalCount > 0) {
      updateMeta({ scrapedAt: lastScrapedAt, filteredCount: filtered.length, totalCount })
    }
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

  function updateMeta({ scrapedAt, filteredCount, totalCount }) {
    const time = scrapedAt
      ? new Date(scrapedAt).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
      : '—'
    metaEl.textContent = `Last updated: ${time} · Showing ${filteredCount} of ${totalCount} offers`
  }

  companyCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters))
  durationSelect.addEventListener('change', applyFilters)
  carTypeSelect.addEventListener('change', applyFilters)
  fuelCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters))
  zeroAdvanceCheck.addEventListener('change', applyFilters)
  kmSelect.addEventListener('change', applyFilters)
  insuranceCheck.addEventListener('change', applyFilters)
  maintenanceCheck.addEventListener('change', applyFilters)
  tyresCheck.addEventListener('change', applyFilters)
  brandModelInput.addEventListener('input', applyFilters)
  maxAdvanceInput.addEventListener('input', applyFilters)
  suvCheck.addEventListener('change', applyFilters)
})

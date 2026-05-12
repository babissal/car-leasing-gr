function normalizePrice(rawPrice, vatIncluded = true) {
  if (rawPrice === null || rawPrice === undefined) return null
  if (typeof rawPrice === 'number') {
    if (isNaN(rawPrice)) return null
    const price = vatIncluded ? rawPrice : rawPrice * 1.24
    return Math.round(price * 100) / 100
  }
  const str = String(rawPrice).trim()
  // Handle Greek thousand separator: 1.250,00 → 1250.00
  const cleaned = str
    .replace(/[€\s]/g, '')
    .replace(/\.(\d{3})/g, '$1')   // remove thousands dots
    .replace(',', '.')             // decimal comma → dot
  const num = parseFloat(cleaned)
  if (isNaN(num)) return null
  const price = vatIncluded ? num : num * 1.24
  return Math.round(price * 100) / 100
}

function normalizeFuelType(rawLabel) {
  if (!rawLabel) return 'Unknown'
  const label = String(rawLabel).normalize('NFC').toLowerCase().trim()
  if (/βενζίν|petrol|gasoline|benzine/.test(label)) return 'Petrol'
  if (/πετρέλαι|diesel|gasoil/.test(label)) return 'Diesel'
  // PHEV must be checked before Hybrid (more specific)
  if (/plug.?in|phev|υβριδικό plug/.test(label)) return 'PHEV'
  if (/υβριδικ|hybrid|mild hybrid|full hybrid/.test(label)) return 'Hybrid'
  if (/ηλεκτρικ|electric|bev\b|\bev\b/.test(label)) return 'Electric'
  return 'Unknown'
}

function parseServices(rawText) {
  const result = { insurance: false, maintenance: false, tyres: false }
  if (!rawText) return result
  const text = (Array.isArray(rawText) ? rawText.join(' ') : String(rawText))
    .normalize('NFC')
    .toLowerCase()
  if (/ασφάλει|insurance|ασφ\./.test(text)) result.insurance = true
  if (/συντήρηση|maintenance|service/.test(text)) result.maintenance = true
  if (/ελαστικ|tyres|tires|gume/.test(text)) result.tyres = true
  return result
}

function parseCO2(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null
  if (typeof rawValue === 'number') return isNaN(rawValue) ? null : rawValue
  const match = String(rawValue).match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  const num = parseFloat(match[1].replace(',', '.'))
  return isNaN(num) ? null : num
}

function parseBodyType(text) {
  if (!text) return null
  const t = String(text).toLowerCase()
  if (/\bsuv\b|\bcrossover\b|\bsport utility\b/.test(t)) return 'SUV'
  if (/\bhatchback\b|\bπεντάθυρο\b|\bτρίθυρο\b|\b5θυρο\b|\b3θυρο\b/.test(t)) return 'Hatchback'
  if (/\bsedan\b|\bσεντάν\b|\bnotchback\b/.test(t)) return 'Sedan'
  if (/\bstation wagon\b|\bestate\b|\bcombi\b/.test(t)) return 'Estate'
  if (/\bmpv\b|\bminivan\b/.test(t)) return 'MPV'
  if (/\bcabriolet\b|\bcabrio\b|\bconvertible\b/.test(t)) return 'Cabriolet'
  if (/\bcoupe\b|\bcoupé\b/.test(t)) return 'Coupe'
  if (/\bpickup\b/.test(t)) return 'Pickup'
  return null
}

module.exports = { normalizePrice, normalizeFuelType, parseServices, parseCO2, parseBodyType }

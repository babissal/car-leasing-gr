const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'PHEV', 'Electric', 'Unknown']

function createOffer(fields) {
  return {
    source: fields.source,
    sourceUrl: fields.sourceUrl,
    brand: fields.brand || null,
    model: fields.model || null,
    bodyType: fields.bodyType || null,
    carType: fields.carType || null,
    fuelType: fields.fuelType || 'Unknown',
    monthlyPrice: fields.monthlyPrice,
    advancePayment: fields.advancePayment ?? 0,
    durationMonths: fields.durationMonths,
    kmPerYear: fields.kmPerYear ?? null,
    servicesIncluded: {
      insurance: fields.servicesIncluded?.insurance ?? false,
      maintenance: fields.servicesIncluded?.maintenance ?? false,
      tyres: fields.servicesIncluded?.tyres ?? false
    },
    co2gKm: fields.co2gKm ?? null,
    scrapedAt: fields.scrapedAt
  }
}

function validateOffer(offer) {
  const errors = []
  if (typeof offer.monthlyPrice !== 'number' || offer.monthlyPrice <= 0 || isNaN(offer.monthlyPrice)) {
    errors.push('monthlyPrice must be a positive number')
  }
  if (!offer.source || typeof offer.source !== 'string') {
    errors.push('source must be a non-empty string')
  }
  if (!FUEL_TYPES.includes(offer.fuelType)) {
    errors.push(`fuelType must be one of: ${FUEL_TYPES.join(', ')}`)
  }
  return { valid: errors.length === 0, errors }
}

module.exports = { createOffer, validateOffer, FUEL_TYPES }

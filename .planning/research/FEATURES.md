# Features Research — Greek Car Leasing Aggregator

## Reference Products Analyzed
- leasingmarkt.de (Germany's largest leasing comparison)
- carwow.co.uk (UK car deals aggregator)
- leasing.com (European leasing comparison)
- mobilize-financial-services.com (manufacturer leasing)

---

## Table Stakes (Must-Have for v1)

These are features users expect from any car comparison tool. Without them, the tool feels broken.

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Filter by car category** | SUV, hatchback, sedan, estate, MPV, coupe | Low |
| **Filter by fuel type** | Petrol, Diesel, Hybrid, PHEV, Electric | Low |
| **Filter by lease duration** | 12 / 24 / 36 / 48 months | Low |
| **Monthly price as primary metric** | Always show €/month prominently | Low |
| **0 down payment filter** | Show only offers with no advance payment | Low |
| **Sort by price** | Ascending/descending monthly price | Low |
| **Source attribution** | Always show which company the offer comes from | Low |
| **Link to original offer** | Click-through to the source website | Low |
| **Offer freshness indicator** | Show when data was last scraped | Low |
| **Results count** | "Showing 23 results" feedback | Low |

## Differentiators (Competitive Advantages)

Features that make this better than visiting each site individually.

| Feature | Description | Complexity | v1? |
|---------|-------------|------------|-----|
| **km/year comparison** | Show included mileage per offer | Low | YES |
| **Services breakdown** | Insurance ✓, Maintenance ✓, Tyres ✓ per offer | Medium | YES |
| **CO2 / emissions display** | Show g/km CO2 for each car | Low | YES |
| **"Best value" scoring** | Composite score: price + km + services | High | No — v2 |
| **Side-by-side compare** | Select 2-3 offers and compare details | Medium | No — v2 |
| **Price per km** | Calculate effective cost including mileage | Low | No — v2 |
| **Offer alerts** | Notify when a price drops | High | No — v2 |
| **Saved searches** | Remember your filter combinations | Medium | No — v2 |

## Anti-Features (Deliberately Excluded in v1)

Things popular comparison sites have that we should NOT build yet.

| Feature | Why Skip |
|---------|----------|
| User accounts / login | Overkill for local personal tool |
| Price history charts | Out of scope (no history storage in v1) |
| "Request a quote" forms | Would require company integrations |
| Car reviews / editorial content | Out of scope — this is a price aggregator |
| Map/dealer locator | Not relevant for leasing |
| Finance calculator | Leasing IS the finance product — no need |
| Email newsletters | Public product feature only |
| Mobile app | Web-first is sufficient |

---

## Greek Market Specifics

Key observations about Greek leasing vs other markets:

1. **Operational leasing dominates** — Full-service leases (insurance + maintenance + tyres included) are standard in Greece, especially for business use. Many offers bundle services.

2. **Duration norms** — 24 and 36 months are most common in Greece. 12-month options are rare and expensive. 48-month is available but less common.

3. **VAT consideration** — Business customers can claim back VAT (24%). Some sites show prices with/without VAT. Aggregator should normalize to include-VAT for personal use comparison.

4. **Advance payment** — Called "προκαταβολή" (prokatavolí). Many Greek offers default to showing prices WITH advance payment. 0-advance filter is essential for accurate comparison.

5. **km/year** — Typically 15,000, 20,000, or 30,000 km/year. Exceeding incurs per-km charges.

---

## Feature Priority for v1

**Must ship:**
- All filters (type, fuel, duration, 0-down, brand)
- km/year and services display per offer
- Sort by price
- Source link + attribution
- On-demand scrape trigger
- Scrape freshness timestamp

**Ship in v2:**
- Side-by-side comparison
- Best value scoring
- Price per km calculation
- Saved searches

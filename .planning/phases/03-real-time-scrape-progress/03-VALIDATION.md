---
phase: 3
slug: real-time-scrape-progress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | curl + manual browser (no test framework in project) |
| **Config file** | none |
| **Quick run command** | `curl -I http://localhost:3000/api/scrape-stream?duration=36` |
| **Full suite command** | `curl -N "http://localhost:3000/api/scrape-stream?duration=36"` |
| **Estimated runtime** | ~90 seconds (full scrape) |

---

## Sampling Rate

- **After every task commit:** Run `curl -I http://localhost:3000/api/scrape-stream?duration=36` (header check — fast)
- **After every plan wave:** Run full scrape via browser and verify progress list updates live
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds (scrape duration bound)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Automated Command | File Exists | Status |
|---------|------|------|-------------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ORCH-04 | `curl -I localhost:3000/api/scrape-stream?duration=36 \| grep "text/event-stream"` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | ORCH-04 | `curl -N localhost:3000/api/scrape-stream?duration=36 \| head -2` → starts with `event: progress` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | UI-02 | Manual: browser shows per-source status updating live | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | UI-05 | Manual: `#meta` shows "Last updated: HH:MM" after scrape | ✅ | ⬜ pending |
| 03-02-03 | 02 | 2 | UI-06 | Manual: `#meta` shows "X offers total" count after scrape | ✅ | ⬜ pending |
| 03-02-04 | 02 | 2 | UI-07 | Manual: CO2 column shows "N/A" for Spotawheel/ExecutiveLease/EasyRental rows | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test framework setup needed — this project uses plain Node.js/Express and validates via curl and browser.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-source status updates live as each scraper finishes | UI-02 | Browser DOM observation required | Click Scrape, watch #progress-list update source by source |
| SSE connection closes cleanly (no auto-reconnect) | ORCH-04 | Requires browser DevTools Network tab | Open DevTools → Network → filter SSE → confirm connection closes after 'done' event |
| Server does not crash when browser tab closed mid-scrape | ORCH-04 | Requires timing mid-scrape | Start scrape, close tab after 10s, verify Node terminal shows no unhandled error |
| `es.close()` prevents double scrape on completion | ORCH-04 | Browser-observable only | Verify DevTools Network shows exactly 1 SSE request per button click |
| Freshness timestamp uses correct 24h format | UI-05 | Visual check | After scrape at 14:32, meta reads "Last updated: 14:32" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

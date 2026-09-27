# TubeLens — Manual Test Matrix (T9)

Run on a **fresh Chrome profile** with `dist/` loaded via `chrome://extensions` → Developer mode → Load unpacked. Get a free API key first (options page → Test key).

Mark each `[ ]` as pass/fail with the date. The branch merges only at 100% green.

## Setup
- [ ] **S0.** `npm run check` green (typecheck + eslint + vitest) and `npm run build` produces `dist/`.
- [ ] **S1.** Fresh profile, load unpacked `dist/`. No console errors on install.

## Channel detection (T3)
- [ ] **M1.** Open `youtube.com/@mkbhd` → panel appears, shows skeleton rows, then results.
- [ ] **M2.** Navigate `@mkbhd` → `/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw` → `/c/` and `/user/` channel URLs via in-page clicks (no full reload) → panel updates each time, no duplicates.
- [ ] **M3.** Open a `/watch?v=…` page and a `/results` page → panel unmounts (no pill, no card).
- [ ] **M4.** Refresh a channel page (full reload) → panel reappears and reuses cache (footer says "Served from cache (0 quota used)").

## Key & quota UX (T2/T5)
- [ ] **M5.** No key set → panel shows "Set API key" → button opens options page in a new tab.
- [ ] **M6.** Paste a malformed key → inline red error, **no** "Testing…" network call (DevTools → no googleapis request).
- [ ] **M7.** Test a valid key → green ✓. Edit one character → badge resets to idle immediately.
- [ ] **M8.** Exhaust quota (temporarily set a tiny budget? or burn via repeated refreshes on new channels) → visiting a channel **with** stale cache shows the yellow "Quota exhausted — showing last results from {date}" banner; a channel with **no** cache shows the quota error state.

## Refresh & cache (T6)
- [ ] **M9.** On a results card, press ↻ → footer changes to "Fresh lookup", quota counter increases by ~500 (options page quota section).

## Panel UX (T8)
- [ ] **M10.** Press Esc on a channel page → panel collapses to the pill; reload → stays collapsed (preference persisted). Click pill → expands.
- [ ] **M11.** At 1280×800 the card never covers the video player or channel nav; no layout shift when results load (skeleton → rows).

## Degradation (T4)
- [ ] **M12.** Find a channel whose recent uploads include a deleted/private video (or simulate by blocking one relatedToVideoId call in DevTools) → results still appear with footer "based on X of Y seed videos (some unavailable)".

## Sign-off
- [ ] All boxes green. Record failures as GitHub issues before merging.

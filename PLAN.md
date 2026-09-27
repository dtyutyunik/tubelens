# TubeLens — build plan

**What:** a free, self-built Chrome extension (MV3) that shows a "similar channels" panel
on any YouTube channel page, filtered to small/undiscovered channels with view counts —
a $0 alternative to SimilarTube's paid auto-panel.

**Why this approach:** YouTube's official API has no "similar channels" endpoint, so
similarity comes from YouTube's own recommendation graph: take the channel's recent
videos, ask the API what's related to each (`search.list` + `relatedToVideoId`), and
aggregate the neighboring channels. No AI model needed for the core; optional
embedding rerank later.

**Status:** scaffold complete and verified — `npm run typecheck`, `npm test` (7 passing),
`npm run build` → loadable `dist/`. Remaining work is tickets T2–T10 below
(T1 is done by the scaffold).

---

## 1. Tech

| Layer | Choice | Why |
|---|---|---|
| Manifest | MV3 | Only thing the Chrome Web Store accepts now |
| Language | TypeScript (strict) | Catches the API-shape bugs that dominate this kind of work |
| UI | React 18 in Shadow DOM | Style isolation from YouTube's CSS; familiar |
| Build | esbuild | Sub-second builds, zero config ceremony |
| Tests | vitest | Fast; pure logic (ranking, quota) is unit-testable |
| Data | YouTube Data API v3, user's own key | Free 10k units/day; no backend, no server bill, no shared-quota problem |
| Persistence | `chrome.storage.local` | Key + cache + quota; never synced, never logged |

**Deliberate non-choices:** no backend (kills the #1 scaling cost — quota pooling),
no AI model in MVP (the graph *is* the similarity signal), no `youtubei.js`/scraping
(ToS gray area + breaks silently on frontend changes).

## 2. Architecture

```
Channel page (SPA)
  └─ content/content.ts  — detects /@h, /channel/UC…, /c/…, /user/… via yt-navigate-finish
                           extracts channelId from meta[itemprop="channelId"]
      └─ panel.tsx        — Shadow-DOM React panel (loading / needs-key / quota / error / results)
              │  chrome.runtime.sendMessage({type:'TUBELENS_GET_SIMILAR'})
              ▼
  background/service-worker.ts — owns ALL API traffic + key
      ├─ lib/youtube-api.ts  — typed wrappers: channels.list, playlistItems.list,
      │                         search.list(relatedToVideoId), batched channel stats
      ├─ lib/quota.ts        — daily budget (10k, midnight PT reset), per-lookup estimate,
      │                         safety margin; pure helpers unit-tested
      ├─ lib/cache.ts        — 7-day TTL + LRU(200); revisits cost 0 units
      ├─ lib/similarity.ts   — rankChannels(): appearances across seed videos,
      │                         exclude seed, maxSubs filter, sort, slice (pure, tested)
      └─ lib/settings.ts     — apiKey, maxSubs, maxResults (storage.local only)
  options/options.tsx — key setup guide + test-key + filters + quota dashboard
```

**Per-lookup data flow (fresh, ~504 units):**

1. `channels.list` → uploads playlist id (1)
2. `playlistItems.list` → 5 most recent video ids (1)
3. 5× `search.list(relatedToVideoId, type=video, maxResults=25)` → neighbor channel ids (500)
4. `channels.list` batched (50/batch) → snippet + statistics (1–2)
5. Rank → cache → render. Revisits within 7 days: 0 units.

## 3. MVP scope

**In:** auto-panel on channel pages; similar channels with avatar/name/subs/total views;
overlap badge (appeared in X of 5 related lists); max-subs "undiscoverable" filter;
quota guard with friendly exhausted state; 7-day cache; options page with key setup +
test button; collapsible panel.

**Out (v2+):** embedding-based semantic rerank, outlier badges, CSV export, "why similar"
explanations, Firefox port, Chrome Web Store listing + monetization.

**Kill/continue gate (Day 14 after dogfooding):** panel produces ≥1 genuinely new-to-you
small channel per 5 channel visits. If the graph neighbors are all mega-channels,
the feature fails its premise — revisit the candidate-generation strategy before
investing in v2.

## 4. Tickets

### T1 — Scaffold & build pipeline ✅ DONE
Scaffold exists, builds, typechecks, tests pass.
*AC:* `npm run build` → `dist/` loads unpacked with no console errors; `npm run typecheck`
and `npm test` green. *(Verified 2026-09-26.)*

### T2 — Options page: API key onboarding
Wire `TUBELENS_TEST_KEY` (done in SW), polish the setup guide with screenshots,
add inline validation states (empty / testing / valid / invalid).
*AC:* fresh profile → options → paste bad key → test shows specific error; good key →
success; key persists across restarts; key never appears in console/logs.

### T3 — Channel detection hardening (SPA)
Cover `/@handle`, `/channel/UC…`, `/c/custom`, `/user/legacy`, trailing slashes,
and non-English locales; add `ytInitialData` fallback if the meta tag ever disappears.
*AC:* matrix in §6 all green; navigating home→channel→channel→video mounts, refreshes,
and unmounts correctly with zero full-page reloads.

### T4 — API client edge cases
Handle `search.list` returning < 25 items, channels with comments disabled (irrelevant),
deleted/private videos in uploads, `relatedToVideoId` occasionally returning empty.
*AC:* no unhandled rejections on a 10-channel torture sample (dead channel, brand-new
channel with 1 video, mega-channel, non-English channel).

### T5 — Quota UX
Surface live usage in the panel footer ("312 / 10,000 units today"); pre-check before
each lookup; when exhausted, still serve stale cache with an "expired" label instead
of a dead error.
*AC:* with quota artificially capped (temporarily lower SAFETY check), panel shows
exhausted state + cached results; usage counter increments by the exact estimated cost.

### T6 — Cache tuning
Confirm 7-day TTL is the right tradeoff; add per-channel "refresh" button to force a
fresh lookup (spends quota deliberately).
*AC:* revisit within TTL = 0 new units (verified via quota dashboard); refresh button
spends ~504 and updates the list.

### T7 — Ranking quality pass
Dogfood on 20 channels across niches; tune `SEED_VIDEOS` (5) and `RELATED_PER_VIDEO`
(25) against quota cost; decide whether to weight by subscriber ratio (small-channel
boost) in `rankChannels`.
*AC:* ≥60% of top-5 results feel "same neighborhood" on blind review; documented
parameter choices in code comments.

### T8 — Panel UX polish
Empty states, skeleton loading, keyboard-dismiss (Esc), remember collapsed state per
session, don't overlap YouTube's own UI on narrow windows.
*AC:* panel never covers video player controls at 1280px width; Esc collapses;
no layout shift on YouTube's page.

### T9 — Test pass & release checklist
Run full §6 matrix; package `dist/` zip; write the privacy policy (required even for
unlisted CWS publishing: what data, where it goes — answer: key stays local, queries
go to googleapis.com).
*AC:* matrix 100% green; zip installs clean on a fresh Chrome profile.

### T10 — Publish (optional)
Chrome Web Store listing, screenshots, decide unlisted vs public; consider the
own-key freemium model (free like Niche Finder; paid tier only if a backend ever exists).
*AC:* listing live; install → options → key → working panel in < 5 minutes.

## 5. Timeline (at 5–10 hrs/week)

| Week | Work | Hours |
|---|---|---|
| 1 | T2, T3, T4 — onboarding, detection, edge cases | 6–8 |
| 2 | T5, T6, T8 — quota UX, cache, polish | 5–7 |
| 3 | T7 — dogfood + ranking tuning | 4–6 |
| 4 | T9 — full test pass, packaging, privacy policy | 3–5 |

MVP total ≈ **18–26 hours**. T10 is a separate, optional half-day.

## 6. Test plan

**Unit (vitest, in-repo):**
- `similarity.test.ts` ✅ — appearance counting, seed exclusion, intra-list dedupe,
  maxSubs filter, maxResults cap, missing-stats skip (7 tests, passing)
- `quota.test.ts` ✅ — estimate math, safety-margin boundary, PT date key
- TODO: `cache.test.ts` — needs a `chrome.storage.local` mock; TTL expiry, LRU eviction

**Manual matrix (T9):**

| # | Scenario | Expected |
|---|---|---|
| M1 | Open `/@mkbhd` | Panel appears, loading → results with subs/views |
| M2 | Open `/channel/UC…` form | Same as M1 |
| M3 | Navigate channel → channel (SPA, no reload) | Panel refreshes to new channel |
| M4 | Navigate channel → watch page | Panel unmounts |
| M5 | No API key set | "Set API key" state → button opens options |
| M6 | Invalid key | Specific "key is invalid" message, not a generic error |
| M7 | Quota exhausted | Friendly message + stale cache served with label |
| M8 | Revisit channel within 7 days | Instant results, quota counter unchanged |
| M9 | Channel with 0 public videos | Clean empty state, no crash |
| M10 | Narrow window (1280px) | Panel doesn't cover player controls; Esc collapses |
| M11 | Fresh Chrome profile, zip install | Key → working panel in < 5 min |

## 7. Other considerations

- **YouTube API ToS:** don't store API data > ~30 days (we use 7); show the key belongs
  to the user; no sublicensing of data. If ever published, the CWS privacy policy must
  say the key stays in local browser storage and queries go to googleapis.com.
- **MV3 service-worker lifetime:** lookups are sequential and complete in seconds, well
  under SW termination risk; the 150 ms pacing between searches also avoids 429s.
- **The real scaling cost is quota, not AI:** 10k units/day/project. Personal use ≈ 19
  fresh lookups/day — plenty. Multi-user would need per-user keys (the Niche Finder model).
- **Ranking quality risk:** `relatedToVideoId` quality varies by niche; the Day-14
  dogfood gate (§3) decides whether the graph approach survives or needs the embedding
  rerank (v2: one-time ~$0.06 per 10k channels embedded, then free cosine math).
- **YouTube frontend drift:** channel-ID extraction depends on `meta[itemprop="channelId"]`;
  T3 adds the `ytInitialData` fallback. If YouTube removes both, detection breaks loudly
  (panel shows error, not silence) — monitor via the error state.
- **Monetization (if published):** the honest model is Niche Finder's — free with
  user's own key; there is no server cost to cover, so no paywall is needed for the
  core. A paid tier only makes sense if v2 adds a backend (managed quota, embeddings).
- **Security:** key in `storage.local` (not `sync`); never logged; all API calls from
  the service worker, never from page-accessible contexts.

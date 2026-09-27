# TubeLens — Similar Channel Finder

A free Chrome extension (MV3) that shows a **similar channels** panel on any YouTube
channel page — filtered to small, undiscovered channels with their view counts.
A $0, self-built alternative to SimilarTube's paid auto-panel.

Similarity comes from YouTube's own recommendation graph, not an AI model:
the extension takes the channel's recent videos, asks the YouTube Data API what's
related to each one (`search.list` + `relatedToVideoId`), and ranks the neighboring
channels by overlap. Your own free API key covers it (10,000 units/day).

## Quick start

```bash
npm install
npm run build        # -> dist/
```

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`.
2. Open the extension's **Options** page and add a YouTube Data API v3 key:
   - [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com):
     create a project → enable **YouTube Data API v3** → Credentials → Create API key
     (restrict it to YouTube Data API v3).
   - Paste it in options → **Test key** (costs 1 quota unit).
3. Visit any YouTube channel page (`/@handle`, `/channel/…`, `/c/…`, `/user/…`).
   The 🔭 panel appears bottom-right with similar small channels.

## Scripts

| Command | What |
|---|---|
| `npm run build` | Bundle to `dist/` (esbuild) |
| `npm run dev` | Watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest unit tests |

## How a lookup works (~504 quota units fresh, 0 cached)

1. `channels.list` → channel's uploads playlist (1 unit)
2. `playlistItems.list` → 5 most recent video IDs (1 unit)
3. 5 × `search.list(relatedToVideoId)` → neighboring channels (100 units each)
4. `channels.list` batched → stats for unique neighbors (1–2 units)
5. Rank by cross-video overlap → filter to `maxSubs` → cache 7 days → render

Revisiting a channel within 7 days costs **zero** units.

## Project layout

```
src/
  manifest.json
  background/service-worker.ts  # owns all API traffic, quota, cache
  content/
    content.ts                  # SPA channel detection + Shadow-DOM mount
    panel.tsx                   # React panel UI
  options/
    options.html / options.tsx  # key setup, filters, quota dashboard
  lib/
    youtube-api.ts              # typed Data API v3 client + error mapping
    quota.ts                    # 10k/day budget, midnight-PT reset, estimates
    cache.ts                    # 7-day TTL, LRU(200)
    similarity.ts               # rankChannels() — pure, unit-tested
    settings.ts / types.ts
```

## Docs

- [`PLAN.md`](PLAN.md) — full build plan: architecture, tickets T1–T10 with acceptance
  criteria, timeline, test matrix, risks, and v2/v3 roadmap.

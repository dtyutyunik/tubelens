# TubeLens — T7 Dogfood Protocol

**Goal:** answer one question with data — does the recommendation-graph approach surface *genuinely new small channels*, or mostly large/irrelevant ones? This is the Day-14 gate from PLAN.md: continue only if TubeLens finds ≥1 genuinely new small channel per 5 channel visits.

**You run this** — it needs your browser, your API key, and your judgment of "same neighborhood". Budget ~19 fresh lookups/day inside the free quota (each ≈500 units; cached revisits are free).

## Method

1. Load `dist/` unpacked, set your API key, keep defaults (max subs 50k, 12 results).
2. Visit 20 channels across at least 4 niches (e.g. tech reviews, cooking, woodworking, indie games, history essays). Mix big (>1M), mid (100k–1M), and small (<100k) seed channels.
3. For each visit, record one row:

| # | Seed channel (subs) | New small channels in top 5* | Top-5 "same neighborhood"? (y/n each) | Notes |
|---|---|---|---|---|
| 1 | | | | |

\* "New small channel" = under the subscriber filter **and not in your subscriptions** (crosscheck against SubShelf / youtube.com/feed/channels). Not-subscribed is the objective novelty test — a channel you're already subbed to isn't a discovery no matter how small it is. "Never heard of it" is a bonus, not the criterion.

## Tuning knobs (change one at a time, in options or `service-worker.ts`)

- `SEED_VIDEOS` (5): more seeds = broader neighborhood, more quota.
- `RELATED_PER_VIDEO` (25): more neighbors per seed = more candidates, more quota.
- `maxSubs` filter: the "undiscoverable" lever — lower it if results skew large.
- Future: small-channel boost weight in `rankChannels` (e.g. +0.2 score per order of magnitude under 10k subs).

## Kill / continue

- **Continue** if ≥4 of the 20 visits surface ≥1 new small channel (the 1-per-5 gate), and a blind read of the top-5 lists feels "same neighborhood" ≥60% of the time.
- **Revisit candidate generation** if results are mostly large or irrelevant channels — the graph may need a second hop (related-of-related) or the subscriber filter needs to move earlier in the pipeline (pre-stats, to save quota).
- Log findings as a comment on the T7 tracking issue before tuning parameters.

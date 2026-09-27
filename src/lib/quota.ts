/**
 * Quota manager for the YouTube Data API v3 free tier.
 *
 * Pricing model: there is none — it's quota, not money. 10,000 units/day per
 * GCP project, resetting at midnight Pacific Time. The expensive call is
 * search.list at 100 units; everything else in our pipeline costs 1 unit.
 *
 * Pure helpers (no chrome.*) live here so they are unit-testable; the
 * storage-backed wrappers sit below.
 */

export const DAILY_BUDGET = 10_000;
/** Headroom so one lookup never strands the user at exactly 0. */
export const SAFETY_MARGIN = 500;

/** Quota cost per API call type (documented YouTube Data API v3 costs). */
export const COST = {
  search: 100, // search.list
  list: 1, // channels.list, playlistItems.list, videos.list
} as const;

/** YYYY-MM-DD in America/Los_Angeles — matches YouTube's quota reset. */
export function pacificDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Estimated units for one fresh similar-channels lookup.
 * 2 list calls (uploads playlist + recent videos) + N searches + ~2 list
 * calls for batched channel stats.
 */
export function estimateLookupCost(seedVideos: number): number {
  return 2 * COST.list + seedVideos * COST.search + 2 * COST.list;
}

/** Pure: can we afford `cost` given `used` today? */
export function canSpendPure(used: number, cost: number): boolean {
  return used + cost <= DAILY_BUDGET - SAFETY_MARGIN;
}

// --- storage-backed wrappers (service worker only) ---

const USAGE_KEY = 'tubelens:quota';

interface UsageRecord {
  date: string;
  used: number;
}

export async function getUsage(): Promise<UsageRecord> {
  const stored = await chrome.storage.local.get(USAGE_KEY);
  const rec = stored[USAGE_KEY] as UsageRecord | undefined;
  const today = pacificDateKey();
  if (!rec || rec.date !== today) return { date: today, used: 0 };
  return rec;
}

export async function canSpend(cost: number): Promise<boolean> {
  const { used } = await getUsage();
  return canSpendPure(used, cost);
}

export async function recordSpend(cost: number): Promise<UsageRecord> {
  const { date, used } = await getUsage();
  const next = { date, used: used + cost };
  await chrome.storage.local.set({ [USAGE_KEY]: next });
  return next;
}

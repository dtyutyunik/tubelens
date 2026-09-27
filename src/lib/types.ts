/** Shared domain types for TubeLens. */

export interface ChannelStats {
  channelId: string;
  title: string;
  thumbnail: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

export interface SimilarChannel extends ChannelStats {
  /** In how many of the seed videos' related lists this channel appeared. */
  appearances: number;
  /** How many seed videos were used for this lookup. */
  seeds: number;
}

export interface Settings {
  apiKey: string;
  /** Hide channels above this subscriber count (the "undiscoverable" filter). */
  maxSubs: number;
  maxResults: number;
  autoRun: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  maxSubs: 50_000,
  maxResults: 12,
  autoRun: true,
};

export type LookupError =
  | { error: 'NO_API_KEY'; message?: string }
  | { error: 'QUOTA_EXHAUSTED'; message?: string }
  | { error: 'API_ERROR'; message?: string };

export interface LookupSuccess {
  channels: SimilarChannel[];
  cached: boolean;
  quota: { used: number; budget: number };
  /** Present when some seed videos failed but the rest still produced results. */
  degraded?: { seedsUsed: number; seedsFailed: number };
  /** T5: true when these results are past the TTL, shown only because quota ran out. */
  stale?: boolean;
  /** Unix ms of when the results were fetched; shown for stale results. */
  fetchedAt?: number;
}

export type LookupResult = LookupSuccess | LookupError;

export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n);
}

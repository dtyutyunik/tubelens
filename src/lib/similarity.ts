/**
 * Ranking: aggregate related-video neighbor channels across the seed videos.
 * Pure function — fully unit-testable.
 */
import { ChannelStats, SimilarChannel } from './types';

export interface RankOptions {
  maxSubs: number;
  maxResults: number;
}

export function rankChannels(
  seedChannelId: string,
  relatedLists: string[][],
  stats: Map<string, ChannelStats>,
  opts: RankOptions,
): SimilarChannel[] {
  const seeds = relatedLists.length;
  const appearances = new Map<string, number>();
  for (const list of relatedLists) {
    for (const id of new Set(list)) {
      if (id === seedChannelId) continue;
      appearances.set(id, (appearances.get(id) ?? 0) + 1);
    }
  }

  const ranked: SimilarChannel[] = [];
  for (const [channelId, count] of appearances) {
    const s = stats.get(channelId);
    if (!s) continue; // stats fetch missed it — skip rather than show blanks
    if (s.subscriberCount > opts.maxSubs) continue; // the "undiscoverable" filter
    ranked.push({ ...s, appearances: count, seeds });
  }

  ranked.sort((a, b) => b.appearances - a.appearances || b.viewCount - a.viewCount);
  return ranked.slice(0, opts.maxResults);
}

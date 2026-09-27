import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCachedSimilar,
  setCachedSimilar,
  deleteCachedSimilar,
  getCachedEntry,
  TTL_MS,
} from './cache';
import { SimilarChannel } from './types';

const store = (globalThis as unknown as { __chromeStore: Map<string, unknown> }).__chromeStore;

function channels(n: number): SimilarChannel[] {
  return Array.from({ length: n }, (_, i) => ({
    channelId: `UC${i}`,
    title: `Channel ${i}`,
    thumbnail: '',
    subscriberCount: 100 + i,
    viewCount: 1000 + i,
    videoCount: 5,
    appearances: 2,
    seeds: 5,
  }));
}

beforeEach(() => store.clear());

describe('cache', () => {
  it('returns fresh entries with zero quota cost semantics', async () => {
    await setCachedSimilar('UC1', channels(3));
    expect(await getCachedSimilar('UC1')).toHaveLength(3);
  });

  it('returns null for missing keys', async () => {
    expect(await getCachedSimilar('NOPE')).toBeNull();
    expect(await getCachedEntry('NOPE')).toBeNull();
  });

  it('treats entries older than the TTL as expired', async () => {
    await setCachedSimilar('UC1', channels(2));
    // Backdate the entry past the TTL via the raw store.
    const key = 'tubelens:similar:UC1';
    const entry = store.get(key) as { fetchedAt: number; channels: SimilarChannel[] };
    store.set(key, { ...entry, fetchedAt: Date.now() - TTL_MS - 1000 });

    expect(await getCachedSimilar('UC1')).toBeNull(); // fresh getter: expired
    const stale = await getCachedEntry('UC1'); // stale getter: still available (T5 fallback)
    expect(stale?.channels).toHaveLength(2);
    expect(stale?.fetchedAt).toBeLessThan(Date.now() - TTL_MS);
  });

  it('TTL is 7 days', () => {
    expect(TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('deleteCachedSimilar forces the next lookup to go to the network (T6)', async () => {
    await setCachedSimilar('UC1', channels(2));
    await deleteCachedSimilar('UC1');
    expect(await getCachedSimilar('UC1')).toBeNull();
    expect(await getCachedEntry('UC1')).toBeNull();
  });

  it('getCachedEntry exposes fetchedAt for stale labeling', async () => {
    const before = Date.now();
    await setCachedSimilar('UC1', channels(1));
    const entry = await getCachedEntry('UC1');
    expect(entry?.fetchedAt).toBeGreaterThanOrEqual(before);
  });
});

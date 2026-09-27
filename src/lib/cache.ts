/**
 * Result cache. YouTube API ToS discourages long-term storage of API data,
 * so we keep a short TTL (7 days) with an LRU cap. Revisits inside the TTL
 * cost zero quota units.
 */
import { SimilarChannel } from './types';

const PREFIX = 'tubelens:similar:';
const INDEX_KEY = 'tubelens:cache-index';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

interface CacheEntry {
  fetchedAt: number;
  channels: SimilarChannel[];
}

function keyFor(channelId: string): string {
  return `${PREFIX}${channelId}`;
}

async function getIndex(): Promise<string[]> {
  const stored = await chrome.storage.local.get(INDEX_KEY);
  return (stored[INDEX_KEY] as string[] | undefined) ?? [];
}

async function touchIndex(key: string): Promise<void> {
  const index = (await getIndex()).filter((k) => k !== key);
  index.unshift(key);
  // Evict oldest beyond cap
  const evicted = index.splice(MAX_ENTRIES);
  if (evicted.length > 0) await chrome.storage.local.remove(evicted);
  await chrome.storage.local.set({ [INDEX_KEY]: index });
}

export async function getCachedSimilar(channelId: string): Promise<SimilarChannel[] | null> {
  const key = keyFor(channelId);
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key] as CacheEntry | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }
  await touchIndex(key);
  return entry.channels;
}

export async function setCachedSimilar(channelId: string, channels: SimilarChannel[]): Promise<void> {
  const key = keyFor(channelId);
  const entry: CacheEntry = { fetchedAt: Date.now(), channels };
  await chrome.storage.local.set({ [key]: entry });
  await touchIndex(key);
}

/**
 * Service worker: owns all YouTube API traffic, quota accounting, and cache.
 * The content script never touches the API key.
 *
 * Orchestration lives in lib/pipeline.ts (injected client → unit-testable);
 * this file adapts the real youtube-api.ts functions and owns the chrome.*
 * side: settings, quota, cache, message routing.
 */
import {
  getUploadsPlaylistId,
  getRecentVideoIds,
  getRelatedChannelIds,
  getChannelStats,
  testApiKey,
  YouTubeApiError,
  COST,
} from '../lib/youtube-api';
import { getSettings, saveSettings } from '../lib/settings';
import { getUsage, canSpend, recordSpend, estimateLookupCost, DAILY_BUDGET } from '../lib/quota';
import { getCachedSimilar, setCachedSimilar, deleteCachedSimilar, getCachedEntry } from '../lib/cache';
import {
  buildSimilarChannels,
  PipelineApi,
  NoVideosError,
  NoRelatedDataError,
} from '../lib/pipeline';
import { LookupResult } from '../lib/types';

const SEED_VIDEOS = 5;
const RELATED_PER_VIDEO = 25;
const BETWEEN_CALLS_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handleGetSimilar(channelId: string, forceRefresh = false): Promise<LookupResult> {
  const settings = await getSettings();
  if (!settings.apiKey) {
    return { error: 'NO_API_KEY', message: 'Set your YouTube API key on the options page.' };
  }

  // T6: manual refresh skips the fresh-cache hit below. The cache is only
  // deleted AFTER the quota pre-check passes — deleting first would destroy
  // good cached results and leave the user with an error screen.
  if (!forceRefresh) {
    const cached = await getCachedSimilar(channelId);
    if (cached) {
      const usage = await getUsage();
      const entry = await getCachedEntry(channelId);
      return {
        channels: cached,
        cached: true,
        quota: { used: usage.used, budget: DAILY_BUDGET },
        fetchedAt: entry?.fetchedAt,
      };
    }
  }

  const estimate = estimateLookupCost(SEED_VIDEOS);
  if (!(await canSpend(estimate))) {
    // T5: quota exhausted — serve stale results (labeled) instead of a dead end.
    // The cache is intact here because force-refresh deletion happens below.
    const stale = await getCachedEntry(channelId);
    const usage = await getUsage();
    if (stale) {
      return {
        channels: stale.channels,
        cached: true,
        stale: true,
        fetchedAt: stale.fetchedAt,
        quota: { used: usage.used, budget: DAILY_BUDGET },
      };
    }
    return {
      error: 'QUOTA_EXHAUSTED',
      message: `Estimated ${estimate} units needed, only ${DAILY_BUDGET - usage.used} left today. Quota resets at midnight Pacific.`,
    };
  }

  // Quota confirmed — now it's safe to drop the cache for a forced refresh.
  if (forceRefresh) await deleteCachedSimilar(channelId);

  // Adapt real API calls to the pipeline interface. Spend is accumulated per
  // call (in `finally`, so failed calls count too — YouTube charges quota
  // even for error responses) and recorded even when the lookup fails below.
  let spent = 0;
  const api: PipelineApi = {
    getUploadsPlaylistId: async (cid) => {
      try {
        return await getUploadsPlaylistId(settings.apiKey, cid);
      } finally {
        spent += COST.list;
      }
    },
    getRecentVideoIds: async (pid, n) => {
      try {
        return await getRecentVideoIds(settings.apiKey, pid, n);
      } finally {
        spent += COST.list;
      }
    },
    getRelatedChannelIds: async (vid, n) => {
      try {
        return await getRelatedChannelIds(settings.apiKey, vid, n);
      } finally {
        spent += COST.search;
        await sleep(BETWEEN_CALLS_MS); // pace search calls to avoid 429s
      }
    },
    getChannelStats: async (ids) => {
      try {
        return await getChannelStats(settings.apiKey, ids);
      } finally {
        spent += Math.max(1, Math.ceil(ids.length / 50)) * COST.list;
      }
    },
  };

  try {
    const { channels, seedsUsed, seedsFailed } = await buildSimilarChannels(api, channelId, {
      seedVideos: SEED_VIDEOS,
      relatedPerVideo: RELATED_PER_VIDEO,
      maxSubs: settings.maxSubs,
      maxResults: settings.maxResults,
    });

    await recordSpend(spent);
    await setCachedSimilar(channelId, channels);

    const usage = await getUsage();
    return {
      channels,
      cached: false,
      quota: { used: usage.used, budget: DAILY_BUDGET },
      degraded: seedsFailed > 0 ? { seedsUsed, seedsFailed } : undefined,
    };
  } catch (e) {
    // Partial spend still counts — the searches already ran.
    await recordSpend(spent);
    if (e instanceof NoVideosError || e instanceof NoRelatedDataError) {
      return { error: 'API_ERROR', message: e.message };
    }
    if (e instanceof YouTubeApiError) {
      if (e.code === 'QUOTA_EXCEEDED') {
        return { error: 'QUOTA_EXHAUSTED', message: e.message };
      }
      if (e.code === 'INVALID_KEY') {
        return { error: 'NO_API_KEY', message: e.message };
      }
      return { error: 'API_ERROR', message: e.message };
    }
    return { error: 'API_ERROR', message: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case 'TUBELENS_GET_SIMILAR':
        return handleGetSimilar(msg.channelId, msg.forceRefresh === true);
      case 'TUBELENS_GET_SETTINGS':
        return { settings: await getSettings() };
      case 'TUBELENS_SAVE_SETTINGS':
        return { settings: await saveSettings(msg.patch) };
      case 'TUBELENS_TEST_KEY':
        try {
          await testApiKey(msg.apiKey);
          return { ok: true };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      case 'TUBELENS_GET_QUOTA': {
        const usage = await getUsage();
        return { used: usage.used, budget: DAILY_BUDGET, date: usage.date };
      }
      default:
        return { error: 'UNKNOWN_MESSAGE' };
    }
  })().then(sendResponse);
  return true; // keep the message channel open for the async response
});

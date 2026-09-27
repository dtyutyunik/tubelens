/**
 * Service worker: owns all YouTube API traffic, quota accounting, and cache.
 * The content script never touches the API key.
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
import { getCachedSimilar, setCachedSimilar } from '../lib/cache';
import { rankChannels } from '../lib/similarity';
import { LookupResult } from '../lib/types';

const SEED_VIDEOS = 5;
const RELATED_PER_VIDEO = 25;
const BETWEEN_CALLS_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handleGetSimilar(channelId: string): Promise<LookupResult> {
  const settings = await getSettings();
  if (!settings.apiKey) {
    return { error: 'NO_API_KEY', message: 'Set your YouTube API key on the options page.' };
  }

  const cached = await getCachedSimilar(channelId);
  if (cached) {
    const usage = await getUsage();
    return { channels: cached, cached: true, quota: { used: usage.used, budget: DAILY_BUDGET } };
  }

  const estimate = estimateLookupCost(SEED_VIDEOS);
  if (!(await canSpend(estimate))) {
    const usage = await getUsage();
    return {
      error: 'QUOTA_EXHAUSTED',
      message: `Estimated ${estimate} units needed, only ${DAILY_BUDGET - usage.used} left today. Quota resets at midnight Pacific.`,
    };
  }

  try {
    let spent = 0;
    const playlistId = await getUploadsPlaylistId(settings.apiKey, channelId);
    spent += COST.list;

    const videoIds = await getRecentVideoIds(settings.apiKey, playlistId, SEED_VIDEOS);
    spent += COST.list;
    if (videoIds.length === 0) {
      return { error: 'API_ERROR', message: 'This channel has no public videos to seed from.' };
    }

    const relatedLists: string[][] = [];
    for (const vid of videoIds) {
      relatedLists.push(await getRelatedChannelIds(settings.apiKey, vid, RELATED_PER_VIDEO));
      spent += COST.search;
      await sleep(BETWEEN_CALLS_MS);
    }

    const unique = [...new Set(relatedLists.flat())].filter((id) => id !== channelId);
    const stats = await getChannelStats(settings.apiKey, unique);
    spent += Math.max(1, Math.ceil(unique.length / 50)) * COST.list;

    await recordSpend(spent);

    const channels = rankChannels(channelId, relatedLists, stats, {
      maxSubs: settings.maxSubs,
      maxResults: settings.maxResults,
    });
    await setCachedSimilar(channelId, channels);

    const usage = await getUsage();
    return { channels, cached: false, quota: { used: usage.used, budget: DAILY_BUDGET } };
  } catch (e) {
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
        return handleGetSimilar(msg.channelId);
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

/**
 * Thin typed client for the YouTube Data API v3 endpoints TubeLens needs.
 * All calls run in the service worker (keeps the key out of page context).
 */
import { ChannelStats } from './types';
import { COST } from './quota';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

export type ApiErrorCode = 'INVALID_KEY' | 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'NETWORK' | 'UNKNOWN';

export class YouTubeApiError extends Error {
  code: ApiErrorCode;
  status: number;
  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function apiGet<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    throw new YouTubeApiError('NETWORK', 0, `Network error calling ${path}: ${String(e)}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    const message: string = body?.error?.message ?? `YouTube API error ${res.status}`;
    if (res.status === 400 || res.status === 401 || reason === 'keyInvalid') {
      throw new YouTubeApiError('INVALID_KEY', res.status, 'API key is invalid. Check it on the options page.');
    }
    if (res.status === 403 && reason === 'quotaExceeded') {
      throw new YouTubeApiError('QUOTA_EXCEEDED', 403, 'Daily YouTube API quota exceeded. Resets at midnight Pacific.');
    }
    if (res.status === 403) {
      throw new YouTubeApiError('INVALID_KEY', 403, `Access forbidden: ${message}`);
    }
    if (res.status === 429) {
      throw new YouTubeApiError('RATE_LIMITED', 429, 'Rate limited — try again in a minute.');
    }
    throw new YouTubeApiError('UNKNOWN', res.status, message);
  }
  return (await res.json()) as T;
}

interface ChannelsListResponse {
  items?: Array<{
    id: string;
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
    snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  }>;
}

interface PlaylistItemsResponse {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
}

interface SearchListResponse {
  items?: Array<{ id?: { videoId?: string }; snippet?: { channelId?: string } }>;
}

/** Step 1: resolve a channel's uploads playlist (1 unit). */
export async function getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string> {
  const data = await apiGet<ChannelsListResponse>('/channels', {
    part: 'contentDetails',
    id: channelId,
  }, apiKey);
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new YouTubeApiError('UNKNOWN', 200, 'Could not find uploads playlist for channel.');
  return uploads;
}

/** Step 2: most recent video IDs (1 unit). */
export async function getRecentVideoIds(apiKey: string, playlistId: string, n: number): Promise<string[]> {
  const data = await apiGet<PlaylistItemsResponse>('/playlistItems', {
    part: 'contentDetails',
    playlistId,
    maxResults: String(n),
  }, apiKey);
  return (data.items ?? [])
    .map((i) => i.contentDetails?.videoId)
    .filter((v): v is string => !!v);
}

/** Step 3: channels appearing in a video's related list (100 units). */
export async function getRelatedChannelIds(
  apiKey: string,
  videoId: string,
  maxResults: number,
): Promise<string[]> {
  const data = await apiGet<SearchListResponse>('/search', {
    part: 'snippet',
    relatedToVideoId: videoId,
    type: 'video',
    maxResults: String(maxResults),
  }, apiKey);
  return (data.items ?? [])
    .map((i) => i.snippet?.channelId)
    .filter((c): c is string => !!c);
}

/** Step 4: stats for up to 50 channels per call (1 unit each). */
export async function getChannelStats(apiKey: string, channelIds: string[]): Promise<Map<string, ChannelStats>> {
  const out = new Map<string, ChannelStats>();
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await apiGet<ChannelsListResponse>('/channels', {
      part: 'snippet,statistics',
      id: batch.join(','),
    }, apiKey);
    for (const item of data.items ?? []) {
      out.set(item.id, {
        channelId: item.id,
        title: item.snippet?.title ?? item.id,
        thumbnail: item.snippet?.thumbnails?.default?.url ?? '',
        subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        videoCount: Number(item.statistics?.videoCount ?? 0),
      });
    }
  }
  return out;
}

/** 1-unit key validation call for the options page. */
export async function testApiKey(apiKey: string): Promise<boolean> {
  // A well-known channel ID; costs 1 unit and proves the key works.
  await apiGet<ChannelsListResponse>('/channels', { part: 'id', id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' }, apiKey);
  return true;
}

export { COST };

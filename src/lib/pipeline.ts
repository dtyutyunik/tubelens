/**
 * Similar-channels lookup pipeline, decoupled from chrome.* and fetch.
 *
 * The pipeline takes an injected `PipelineApi` so the orchestration logic —
 * especially per-seed degradation — is unit-testable with a fake client.
 * The service worker adapts the real youtube-api.ts functions into this
 * interface (adding the inter-call pacing there).
 */
import { ChannelStats, SimilarChannel } from './types';
import { rankChannels } from './similarity';

export interface PipelineApi {
  getUploadsPlaylistId(channelId: string): Promise<string>;
  getRecentVideoIds(playlistId: string, n: number): Promise<string[]>;
  /** Neighboring channel IDs from one video's related list. May throw per-seed. */
  getRelatedChannelIds(videoId: string, maxResults: number): Promise<string[]>;
  getChannelStats(channelIds: string[]): Promise<Map<string, ChannelStats>>;
}

export interface PipelineOpts {
  seedVideos: number;
  relatedPerVideo: number;
  maxSubs: number;
  maxResults: number;
}

export interface PipelineResult {
  channels: SimilarChannel[];
  /** Seeds that produced usable related data. */
  seedsUsed: number;
  /** Seeds skipped because their related lookup failed (deleted/private video, 404…). */
  seedsFailed: number;
}

export class NoVideosError extends Error {
  constructor() {
    super('This channel has no public videos to seed from.');
    this.name = 'NoVideosError';
  }
}

export class NoRelatedDataError extends Error {
  failedSeeds: number;
  constructor(failedSeeds: number) {
    super(
      `Could not load related videos for any seed video (${failedSeeds} failed). ` +
        'They may be private, deleted, or region-restricted.',
    );
    this.name = 'NoRelatedDataError';
    this.failedSeeds = failedSeeds;
  }
}

/**
 * Run the lookup. One bad seed (deleted/private video → relatedToVideoId 404)
 * degrades gracefully instead of killing the whole lookup — the remaining
 * seeds still produce a ranked list.
 */
export async function buildSimilarChannels(
  api: PipelineApi,
  channelId: string,
  opts: PipelineOpts,
): Promise<PipelineResult> {
  const playlistId = await api.getUploadsPlaylistId(channelId);
  const videoIds = await api.getRecentVideoIds(playlistId, opts.seedVideos);
  if (videoIds.length === 0) throw new NoVideosError();

  const relatedLists: string[][] = [];
  let seedsFailed = 0;
  for (const vid of videoIds) {
    try {
      relatedLists.push(await api.getRelatedChannelIds(vid, opts.relatedPerVideo));
    } catch {
      seedsFailed += 1; // degrade: one dead seed must not kill the lookup
    }
  }

  const usable = relatedLists.filter((l) => l.length > 0);
  if (usable.length === 0) throw new NoRelatedDataError(seedsFailed);

  const unique = [...new Set(usable.flat())].filter((id) => id !== channelId);
  const stats = await api.getChannelStats(unique);
  const channels = rankChannels(channelId, usable, stats, {
    maxSubs: opts.maxSubs,
    maxResults: opts.maxResults,
  });

  return { channels, seedsUsed: usable.length, seedsFailed };
}

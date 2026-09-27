import { describe, it, expect, vi } from 'vitest';
import {
  buildSimilarChannels,
  NoVideosError,
  NoRelatedDataError,
  PipelineApi,
} from './pipeline';
import { ChannelStats } from './types';

function stats(id: string): ChannelStats {
  return { channelId: id, title: id, thumbnail: '', subscriberCount: 100, viewCount: 1000, videoCount: 5 };
}

function fakeApi(overrides: Partial<PipelineApi> = {}): PipelineApi {
  return {
    getUploadsPlaylistId: vi.fn(async () => 'PL123'),
    getRecentVideoIds: vi.fn(async () => ['v1', 'v2', 'v3']),
    getRelatedChannelIds: vi.fn(async (vid: string) => [`ch-${vid}-a`, `ch-${vid}-b`]),
    getChannelStats: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, stats(id)]))),
    ...overrides,
  };
}

const OPTS = { seedVideos: 3, relatedPerVideo: 25, maxSubs: 50_000, maxResults: 12 };

describe('buildSimilarChannels', () => {
  it('aggregates neighbors across seeds and ranks them', async () => {
    const api = fakeApi();
    const res = await buildSimilarChannels(api, 'SEED', OPTS);
    expect(res.seedsUsed).toBe(3);
    expect(res.seedsFailed).toBe(0);
    expect(res.channels.length).toBeGreaterThan(0);
    expect(res.channels.every((c) => c.channelId !== 'SEED')).toBe(true);
  });

  it('degrades gracefully when one seed video is deleted/private', async () => {
    const api = fakeApi({
      getRelatedChannelIds: vi.fn(async (vid: string) => {
        if (vid === 'v2') throw new Error('404: video not found');
        return [`ch-${vid}-a`];
      }),
    });
    const res = await buildSimilarChannels(api, 'SEED', OPTS);
    expect(res.seedsUsed).toBe(2);
    expect(res.seedsFailed).toBe(1);
    // Remaining seeds still produce results
    expect(res.channels.length).toBeGreaterThan(0);
  });

  it('throws NoRelatedDataError when every seed fails', async () => {
    const api = fakeApi({
      getRelatedChannelIds: vi.fn(async () => {
        throw new Error('404');
      }),
    });
    await expect(buildSimilarChannels(api, 'SEED', OPTS)).rejects.toBeInstanceOf(NoRelatedDataError);
  });

  it('throws NoVideosError for channels with no public videos', async () => {
    const api = fakeApi({ getRecentVideoIds: vi.fn(async () => []) });
    await expect(buildSimilarChannels(api, 'SEED', OPTS)).rejects.toBeInstanceOf(NoVideosError);
  });

  it('a seed returning an empty list does not count as used', async () => {
    const api = fakeApi({
      getRecentVideoIds: vi.fn(async () => ['v1']),
      getRelatedChannelIds: vi.fn(async () => []),
    });
    await expect(buildSimilarChannels(api, 'SEED', OPTS)).rejects.toBeInstanceOf(NoRelatedDataError);
  });
});

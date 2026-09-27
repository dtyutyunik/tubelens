import { describe, it, expect } from 'vitest';
import { rankChannels } from './similarity';
import { ChannelStats } from './types';

function stats(id: string, subs: number, views: number): ChannelStats {
  return { channelId: id, title: id, thumbnail: '', subscriberCount: subs, viewCount: views, videoCount: 10 };
}

describe('rankChannels', () => {
  it('counts appearances across seed videos and sorts by them first', () => {
    const lists = [
      ['A', 'B', 'C'],
      ['A', 'B'],
      ['A'],
    ];
    const map = new Map([
      ['A', stats('A', 100, 1_000)],
      ['B', stats('B', 100, 50_000)],
      ['C', stats('C', 100, 999_999)],
    ]);
    const out = rankChannels('SEED', lists, map, { maxSubs: 1_000_000, maxResults: 10 });
    expect(out.map((c) => c.channelId)).toEqual(['A', 'B', 'C']);
    expect(out[0].appearances).toBe(3);
    expect(out[0].seeds).toBe(3);
  });

  it('excludes the seed channel and dedupes within one seed video', () => {
    const lists = [['SEED', 'A', 'A', 'B']];
    const map = new Map([['A', stats('A', 100, 1)], ['B', stats('B', 100, 1)]]);
    const out = rankChannels('SEED', lists, map, { maxSubs: 1_000_000, maxResults: 10 });
    expect(out.map((c) => c.channelId)).toEqual(['A', 'B']);
    expect(out[0].appearances).toBe(1); // deduped, not 2
  });

  it('applies the maxSubs undiscoverable filter and maxResults cap', () => {
    const lists = [['BIG', 'SMALL1', 'SMALL2']];
    const map = new Map([
      ['BIG', stats('BIG', 5_000_000, 1)],
      ['SMALL1', stats('SMALL1', 1_000, 1)],
      ['SMALL2', stats('SMALL2', 2_000, 1)],
    ]);
    const out = rankChannels('SEED', lists, map, { maxSubs: 50_000, maxResults: 1 });
    expect(out.map((c) => c.channelId)).toEqual(['SMALL1']);
  });

  it('skips channels missing from the stats map', () => {
    const lists = [['GHOST', 'REAL']];
    const map = new Map([['REAL', stats('REAL', 100, 1)]]);
    const out = rankChannels('SEED', lists, map, { maxSubs: 1_000_000, maxResults: 10 });
    expect(out.map((c) => c.channelId)).toEqual(['REAL']);
  });
});

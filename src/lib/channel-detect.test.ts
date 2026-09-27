import { describe, it, expect } from 'vitest';
import {
  isChannelPath,
  channelIdFromMeta,
  channelIdFromCanonical,
  channelIdFromPath,
  resolveChannelId,
} from './channel-detect';

describe('isChannelPath', () => {
  it.each([
    '/@mkbhd',
    '/@mkbhd/',
    '/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
    '/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/',
    '/c/SomeCustom',
    '/user/LegacyUser',
  ])('matches channel page %s', (p) => {
    expect(isChannelPath(p)).toBe(true);
  });

  it.each([
    '/',
    '/watch?v=dQw4w9WgXcQ',
    '/results?search_query=cats',
    '/feed/subscriptions',
    '/@mkbhd/videos', // sub-tabs: out of MVP scope (see PR notes)
    '/playlist?list=PL123',
    '/shorts/abc123',
  ])('rejects non-channel page %s', (p) => {
    expect(isChannelPath(p)).toBe(false);
  });
});

describe('resolveChannelId fallback chain', () => {
  const UC = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
  const canon = `https://www.youtube.com/channel/${UC}`;

  it('prefers the meta tag', () => {
    expect(resolveChannelId(UC, canon, '/@handle')).toBe(UC);
  });

  it('falls back to the canonical link when meta is missing', () => {
    expect(resolveChannelId(null, canon, '/@handle')).toBe(UC);
    expect(resolveChannelId('', canon, '/@handle')).toBe(UC);
  });

  it('falls back to /channel/ URLs when both are missing', () => {
    expect(resolveChannelId(null, null, `/channel/${UC}`)).toBe(UC);
  });

  it('returns null when nothing yields an ID', () => {
    expect(resolveChannelId(null, null, '/@handle')).toBeNull();
  });

  it('ignores non-channel canonical hrefs', () => {
    expect(channelIdFromCanonical('https://www.youtube.com/watch?v=abc')).toBeNull();
    expect(channelIdFromCanonical(null)).toBeNull();
  });

  it('trims whitespace from meta content', () => {
    expect(channelIdFromMeta(`  ${UC} `)).toBe(UC);
    expect(channelIdFromMeta('   ')).toBeNull();
  });

  it('extracts ID from /channel/ paths only', () => {
    expect(channelIdFromPath(`/channel/${UC}`)).toBe(UC);
    expect(channelIdFromPath('/@handle')).toBeNull();
  });
});

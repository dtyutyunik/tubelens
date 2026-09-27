/**
 * Content script: watches YouTube's SPA navigation, detects channel pages,
 * extracts the channel ID, and mounts the Shadow-DOM panel.
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SimilarPanel, PanelState } from './panel';
import { LookupResult } from '../lib/types';

const ROOT_ID = 'tubelens-root';

// Matches /@handle, /channel/UC..., /c/custom, /user/legacy (with optional trailing slash)
const CHANNEL_RE = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/;

let root: Root | null = null;
let currentChannelId: string | null = null;

function isChannelPage(): boolean {
  return CHANNEL_RE.test(window.location.pathname);
}

/** Most reliable channel-ID source on a channel page. */
function getChannelId(): string | null {
  const meta = document.querySelector<HTMLMetaElement>('meta[itemprop="channelId"]');
  if (meta?.content) return meta.content;
  // Fallback: /channel/UC... URLs carry it directly
  const m = window.location.pathname.match(/^\/channel\/([^/]+)/);
  return m ? m[1] : null;
}

function ensureRoot(): Root {
  let host = document.getElementById(ROOT_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = ROOT_ID;
    document.documentElement.appendChild(host);
    root = createRoot(host.attachShadow({ mode: 'open' }));
  }
  return root!;
}

function render(state: PanelState): void {
  ensureRoot().render(React.createElement(SimilarPanel, { state }));
}

function unmount(): void {
  document.getElementById(ROOT_ID)?.remove();
  root = null;
  currentChannelId = null;
}

async function refresh(): Promise<void> {
  if (!isChannelPage()) {
    unmount();
    return;
  }
  const channelId = getChannelId();
  if (!channelId) {
    unmount();
    return;
  }
  if (channelId === currentChannelId) return; // already showing for this channel
  currentChannelId = channelId;

  render({ kind: 'loading' });
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'TUBELENS_GET_SIMILAR',
      channelId,
    })) as LookupResult;
    if ('error' in res) {
      if (res.error === 'NO_API_KEY') render({ kind: 'needs-key', message: res.message });
      else if (res.error === 'QUOTA_EXHAUSTED') render({ kind: 'quota', message: res.message });
      else render({ kind: 'error', message: res.message });
    } else {
      render({ kind: 'results', channels: res.channels, cached: res.cached, quota: res.quota });
    }
  } catch (e) {
    render({ kind: 'error', message: `Extension error: ${String(e)}` });
  }
}

// YouTube is an SPA: listen for its internal navigation event, plus boot once.
document.addEventListener('yt-navigate-finish', () => {
  currentChannelId = null; // force re-evaluation on every navigation
  void refresh();
});
void refresh();

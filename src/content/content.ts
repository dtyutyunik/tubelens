/**
 * Content script: watches YouTube's SPA navigation, detects channel pages,
 * extracts the channel ID (meta → canonical → /channel/ URL fallback chain),
 * and mounts the Shadow-DOM panel.
 *
 * No React hooks here by design — this is vanilla TS; React is only used to
 * render the panel into the shadow root.
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SimilarPanel, PanelState } from './panel';
import { isChannelPath, resolveChannelId } from '../lib/channel-detect';
import { LookupResult } from '../lib/types';

const ROOT_ID = 'tubelens-root';

let root: Root | null = null;
let currentChannelId: string | null = null;

/** DOM read, kept separate from the pure resolveChannelId() for testability. */
function readChannelId(): string | null {
  const meta = document.querySelector<HTMLMetaElement>('meta[itemprop="channelId"]');
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  return resolveChannelId(meta?.content, canonical?.href, window.location.pathname);
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

async function refresh(force = false): Promise<void> {
  if (!isChannelPath(window.location.pathname)) {
    unmount();
    return;
  }
  const channelId = readChannelId();
  if (!channelId) {
    unmount();
    return;
  }
  if (channelId === currentChannelId && !force) return; // already showing for this channel
  currentChannelId = channelId;

  render({ kind: 'loading' });
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'TUBELENS_GET_SIMILAR',
      channelId,
      forceRefresh: force,
    })) as LookupResult;
    if ('error' in res) {
      if (res.error === 'NO_API_KEY') render({ kind: 'needs-key', message: res.message });
      else if (res.error === 'QUOTA_EXHAUSTED') render({ kind: 'quota', message: res.message });
      else render({ kind: 'error', message: res.message });
    } else {
      render({
        kind: 'results',
        channels: res.channels,
        cached: res.cached,
        quota: res.quota,
        degraded: res.degraded,
        stale: res.stale,
        fetchedAt: res.fetchedAt,
        onRefresh: () => void refresh(true),
      });
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

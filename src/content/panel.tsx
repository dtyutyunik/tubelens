import React, { useEffect, useState } from 'react';
import { SimilarChannel, formatCompact } from '../lib/types';

export type PanelState =
  | { kind: 'loading' }
  | { kind: 'needs-key'; message?: string }
  | { kind: 'quota'; message?: string }
  | { kind: 'error'; message?: string }
  | {
      kind: 'results';
      channels: SimilarChannel[];
      cached?: boolean;
      quota?: { used: number; budget: number };
      degraded?: { seedsUsed: number; seedsFailed: number };
      stale?: boolean;
      fetchedAt?: number;
      onRefresh?: () => void;
    };

const COLLAPSED_KEY = 'tubelens:panel-collapsed';

const CSS = `
.tl-wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
  font-family: Roboto, Arial, sans-serif; font-size: 13px; color: #0f0f0f; }
.tl-pill { background: #0f0f0f; color: #fff; border: none; border-radius: 24px;
  padding: 10px 16px; cursor: pointer; font-size: 13px; font-weight: 500;
  box-shadow: 0 4px 14px rgba(0,0,0,.35); }
.tl-pill:hover { background: #272727; }
.tl-card { width: 340px; max-height: 70vh; overflow-y: auto; background: #fff;
  border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.35); padding: 12px; }
.tl-head { display: flex; justify-content: space-between; align-items: center;
  font-weight: 600; margin-bottom: 8px; }
.tl-headbtns { display: flex; gap: 4px; }
.tl-iconbtn { background: none; border: none; cursor: pointer; font-size: 15px;
  color: #606060; border-radius: 50%; width: 28px; height: 28px; line-height: 1; }
.tl-iconbtn:hover { background: #f2f2f2; }
.tl-row { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid #eee;
  text-decoration: none; color: inherit; }
.tl-row:first-of-type { border-top: none; }
.tl-row img { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
.tl-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.tl-meta { color: #606060; font-size: 12px; }
.tl-badge { display: inline-block; background: #e8f0fe; color: #1a73e8; border-radius: 8px;
  padding: 1px 6px; font-size: 11px; margin-left: 6px; }
.tl-state { padding: 16px 8px; color: #606060; text-align: center; }
.tl-btn { background: #1a73e8; color: #fff; border: none; border-radius: 18px;
  padding: 8px 16px; cursor: pointer; margin-top: 8px; font-size: 13px; }
.tl-foot { color: #909090; font-size: 11px; margin-top: 8px; text-align: center; }
.tl-stale { background: #fef7e0; color: #7a5c00; border-radius: 8px; padding: 6px 8px;
  font-size: 11px; margin-bottom: 8px; text-align: center; }
/* Skeleton loading rows */
.tl-skel { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid #eee; }
.tl-skel:first-of-type { border-top: none; }
.tl-av { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
.tl-lines { flex: 1; }
.tl-l { height: 10px; border-radius: 5px; margin: 7px 0; }
.tl-shimmer { background: linear-gradient(90deg, #eeeeee 25%, #f7f7f7 50%, #eeeeee 75%);
  background-size: 200% 100%; animation: tl-sh 1.2s infinite; }
@keyframes tl-sh { to { background-position: -200% 0; } }
`;

function openOptions() {
  window.open(chrome.runtime.getURL('options/options.html'), '_blank');
}

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="tl-skel" key={i}>
          <div className="tl-av tl-shimmer" />
          <div className="tl-lines">
            <div className="tl-l tl-shimmer" style={{ width: '70%' }} />
            <div className="tl-l tl-shimmer" style={{ width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Hooks used here:
 * - useState(open): collapsed vs expanded. Persists across channel navigations
 *   because the component instance survives re-renders from content.ts.
 * - useEffect #1 (mount): restores the collapsed preference from storage.
 * - useEffect #2 (mount): Esc collapses the panel. Guarded so typing in
 *   YouTube's search box / comments never triggers it.
 */
export function SimilarPanel({ state }: { state: PanelState }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(COLLAPSED_KEY).then((r) => {
      if (r[COLLAPSED_KEY] === true) setOpen(false);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const setCollapsed = (collapsed: boolean) => {
    setOpen(!collapsed);
    void chrome.storage.local.set({ [COLLAPSED_KEY]: collapsed });
  };

  if (!open) {
    return (
      <div className="tl-wrap">
        <style>{CSS}</style>
        <button className="tl-pill" onClick={() => setCollapsed(false)}>
          🔭 Similar channels
        </button>
      </div>
    );
  }

  const count = state.kind === 'results' ? state.channels.length : 0;
  const staleDate =
    state.kind === 'results' && state.stale && state.fetchedAt
      ? new Date(state.fetchedAt).toLocaleDateString()
      : null;

  return (
    <div className="tl-wrap">
      <style>{CSS}</style>
      <div className="tl-card">
        <div className="tl-head">
          <span>🔭 Similar channels{state.kind === 'results' ? ` (${count})` : ''}</span>
          <div className="tl-headbtns">
            {state.kind === 'results' && state.onRefresh && (
              <button
                className="tl-iconbtn"
                onClick={state.onRefresh}
                title="Force a fresh lookup (spends quota)"
                aria-label="Refresh"
              >
                ↻
              </button>
            )}
            <button className="tl-iconbtn" onClick={() => setCollapsed(true)} aria-label="Collapse">
              –
            </button>
          </div>
        </div>

        {state.kind === 'loading' && <SkeletonRows />}

        {state.kind === 'needs-key' && (
          <div className="tl-state">
            {state.message ?? 'No API key set.'}
            <br />
            <button className="tl-btn" onClick={openOptions}>Set API key</button>
          </div>
        )}

        {state.kind === 'quota' && (
          <div className="tl-state">
            {state.message ?? 'Daily API quota exhausted.'}
            <br />
            Resets at midnight Pacific.
          </div>
        )}

        {state.kind === 'error' && <div className="tl-state">{state.message ?? 'Something went wrong.'}</div>}

        {state.kind === 'results' && state.stale && (
          <div className="tl-stale">
            Quota exhausted — showing last results{staleDate ? ` from ${staleDate}` : ''}. They may be outdated.
          </div>
        )}

        {state.kind === 'results' && state.channels.length === 0 && (
          <div className="tl-state">No similar small channels found. Try raising the subscriber filter in options.</div>
        )}

        {state.kind === 'results' &&
          state.channels.map((c) => (
            <a
              key={c.channelId}
              className="tl-row"
              href={`https://www.youtube.com/channel/${c.channelId}`}
              target="_blank"
              rel="noreferrer"
            >
              {c.thumbnail && <img src={c.thumbnail} alt="" />}
              <div>
                <div className="tl-name">
                  {c.title}
                  <span className="tl-badge">{c.appearances}/{c.seeds}</span>
                </div>
                <div className="tl-meta">
                  {formatCompact(c.subscriberCount)} subs · {formatCompact(c.viewCount)} views
                </div>
              </div>
            </a>
          ))}

        {state.kind === 'results' && state.quota && (
          <div className="tl-foot">
            {state.stale
              ? 'Stale cache (0 quota used)'
              : state.cached
                ? 'Served from cache (0 quota used)'
                : 'Fresh lookup'}
            {state.degraded
              ? ` · based on ${state.degraded.seedsUsed} of ${state.degraded.seedsUsed + state.degraded.seedsFailed} seed videos (some unavailable)`
              : ' · badge = related-video overlap'}
            <br />
            Quota today: {formatCompact(state.quota.used)}/{formatCompact(state.quota.budget)} · resets midnight PT
          </div>
        )}
      </div>
    </div>
  );
}

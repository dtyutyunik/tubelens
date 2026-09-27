import React, { useState } from 'react';
import { SimilarChannel, formatCompact } from '../lib/types';

export type PanelState =
  | { kind: 'loading' }
  | { kind: 'needs-key'; message?: string }
  | { kind: 'quota'; message?: string }
  | { kind: 'error'; message?: string }
  | { kind: 'results'; channels: SimilarChannel[]; cached?: boolean; quota?: { used: number; budget: number } };

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
.tl-close { background: none; border: none; cursor: pointer; font-size: 16px; }
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
`;

function openOptions() {
  window.open(chrome.runtime.getURL('options/options.html'), '_blank');
}

export function SimilarPanel({ state }: { state: PanelState }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="tl-wrap">
        <style>{CSS}</style>
        <button className="tl-pill" onClick={() => setOpen(true)}>
          🔭 Similar channels
        </button>
      </div>
    );
  }

  const count = state.kind === 'results' ? state.channels.length : 0;

  return (
    <div className="tl-wrap">
      <style>{CSS}</style>
      <div className="tl-card">
        <div className="tl-head">
          <span>🔭 Similar channels{state.kind === 'results' ? ` (${count})` : ''}</span>
          <button className="tl-close" onClick={() => setOpen(false)} aria-label="Collapse">
            –
          </button>
        </div>

        {state.kind === 'loading' && <div className="tl-state">Scanning the neighborhood…</div>}

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

        {state.kind === 'results' && (
          <div className="tl-foot">
            {state.cached ? 'Served from cache (0 quota used)' : 'Fresh lookup'} · badge = related-video overlap
          </div>
        )}
      </div>
    </div>
  );
}

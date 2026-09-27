import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, DEFAULT_SETTINGS, formatCompact } from '../lib/types';

async function send<T>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

/**
 * Hooks used in this file (and why):
 * - useState ×5: settings form, keyState (idle|testing|valid|invalid), testMsg,
 *   quota dashboard, saved indicator. Each is independent local UI state.
 * - useEffect #1 (mount): loads settings + quota once — the only place we talk
 *   to the service worker on load.
 * - useEffect #2 (on settings.apiKey): resets validation state whenever the key
 *   changes, so a stale "valid" badge can't survive an edit.
 */
type KeyState = 'idle' | 'testing' | 'valid' | 'invalid';

/** Google API keys are 39 chars starting with "AIza" — pre-check before spending quota. */
function looksLikeApiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(key);
}

function OptionsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [keyState, setKeyState] = useState<KeyState>('idle');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ used: number; budget: number; date: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void send<{ settings: Settings }>({ type: 'TUBELENS_GET_SETTINGS' }).then((r) => {
      setSettings(r.settings);
      if (r.settings.apiKey) setKeyState('idle'); // unknown until tested
    });
    void send<{ used: number; budget: number; date: string }>({ type: 'TUBELENS_GET_QUOTA' }).then(setQuota);
  }, []);

  // Any edit invalidates the previous test result.
  useEffect(() => {
    setKeyState('idle');
    setTestMsg(null);
  }, [settings.apiKey]);

  const save = async () => {
    const r = await send<{ settings: Settings }>({ type: 'TUBELENS_SAVE_SETTINGS', patch: settings });
    setSettings(r.settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testKey = async () => {
    if (!looksLikeApiKey(settings.apiKey)) {
      setKeyState('invalid');
      setTestMsg('That does not look like a YouTube API key (should start with "AIza", 39 characters). No quota spent.');
      return;
    }
    setKeyState('testing');
    setTestMsg(null);
    const r = await send<{ ok: boolean; message?: string }>({ type: 'TUBELENS_TEST_KEY', apiKey: settings.apiKey });
    if (r.ok) {
      setKeyState('valid');
      setTestMsg('Key works (1 quota unit used).');
    } else {
      setKeyState('invalid');
      setTestMsg(r.message ?? 'Key failed.');
    }
  };

  const keyBorder = keyState === 'valid' ? '2px solid #137333' : keyState === 'invalid' ? '2px solid #b3261e' : undefined;

  return (
    <div>
      <h1>🔭 TubeLens options</h1>

      <h2>1. YouTube Data API key (free)</h2>
      <ol className="setup">
        <li>
          Open the{' '}
          <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
            Google Cloud Console
          </a>{' '}
          → create a project → enable the <b>YouTube Data API v3</b>.
        </li>
        <li>
          <b>Credentials → Create Credentials → API key</b>, then restrict the key to "YouTube Data API v3"
          (prevents surprise usage elsewhere).
        </li>
        <li>Paste it below and hit <b>Test key</b>. Free quota: 10,000 units/day, resets midnight Pacific.</li>
      </ol>
      <label htmlFor="key">API key</label>
      <input
        id="key"
        type="password"
        style={{ border: keyBorder }}
        value={settings.apiKey}
        onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
        placeholder="AIza..."
        autoComplete="off"
        spellCheck={false}
      />
      <div className="row">
        <button onClick={testKey} disabled={keyState === 'testing' || settings.apiKey.length === 0}>
          {keyState === 'testing' ? 'Testing…' : 'Test key'}
        </button>
        {keyState === 'valid' && <span className="ok"> ✓ Valid</span>}
        {testMsg && <span className={keyState === 'valid' ? 'ok' : keyState === 'invalid' ? 'err' : ''}>{testMsg}</span>}
      </div>
      <p className="hint">Format is checked locally first — a malformed key never costs you quota.</p>

      <h2>2. Discovery filters</h2>
      <label htmlFor="maxsubs">Hide channels with more than this many subscribers</label>
      <input
        id="maxsubs"
        type="number"
        min={100}
        step={1000}
        value={settings.maxSubs}
        onChange={(e) => setSettings({ ...settings, maxSubs: Number(e.target.value) || DEFAULT_SETTINGS.maxSubs })}
      />
      <div className="hint">This is the "undiscoverable" filter — only small channels show up.</div>

      <label htmlFor="maxresults">Max channels in the panel</label>
      <input
        id="maxresults"
        type="number"
        min={3}
        max={30}
        value={settings.maxResults}
        onChange={(e) => setSettings({ ...settings, maxResults: Number(e.target.value) || DEFAULT_SETTINGS.maxResults })}
      />

      <div className="row">
        <button onClick={save}>Save</button>
        {saved && <span className="ok">Saved.</span>}
      </div>

      <h2>3. Quota usage</h2>
      {quota ? (
        <p>
          Today ({quota.date}): <b>{formatCompact(quota.used)}</b> / {formatCompact(quota.budget)} units used.
          <span className="hint"> A fresh channel lookup costs ~500 units; cached revisits cost 0.</span>
        </p>
      ) : (
        <p className="hint">Loading…</p>
      )}
      <p className="hint">
        Your key is stored only in this browser (chrome.storage.local). It is never synced or sent anywhere except
        googleapis.com.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<OptionsApp />);

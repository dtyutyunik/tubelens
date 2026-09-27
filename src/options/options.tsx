import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, DEFAULT_SETTINGS, formatCompact } from '../lib/types';

async function send<T>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

function OptionsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [quota, setQuota] = useState<{ used: number; budget: number; date: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void send<{ settings: Settings }>({ type: 'TUBELENS_GET_SETTINGS' }).then((r) => setSettings(r.settings));
    void send<{ used: number; budget: number; date: string }>({ type: 'TUBELENS_GET_QUOTA' }).then(setQuota);
  }, []);

  const save = async () => {
    const r = await send<{ settings: Settings }>({ type: 'TUBELENS_SAVE_SETTINGS', patch: settings });
    setSettings(r.settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testKey = async () => {
    setTestMsg(null);
    const r = await send<{ ok: boolean; message?: string }>({ type: 'TUBELENS_TEST_KEY', apiKey: settings.apiKey });
    setTestMsg(r.ok ? { ok: true, text: 'Key works (1 quota unit used).' } : { ok: false, text: r.message ?? 'Key failed.' });
  };

  return (
    <div>
      <h1>🔭 TubeLens options</h1>

      <h2>1. YouTube Data API key (free)</h2>
      <ol className="setup">
        <li>
          Go to <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">Google Cloud Console</a>,
          create a project, and enable the <b>YouTube Data API v3</b>.
        </li>
        <li>Credentials → Create Credentials → API key. Restrict it to "YouTube Data API v3".</li>
        <li>Paste it below. Free quota: 10,000 units/day, resets midnight Pacific.</li>
      </ol>
      <label htmlFor="key">API key</label>
      <input
        id="key"
        type="password"
        value={settings.apiKey}
        onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
        placeholder="AIza..."
        autoComplete="off"
      />
      <div className="row">
        <button onClick={testKey}>Test key</button>
        {testMsg && <span className={testMsg.ok ? 'ok' : 'err'}>{testMsg.text}</span>}
      </div>

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

// Vitest setup: minimal in-memory chrome.storage.local mock so chrome-dependent
// lib modules (cache) are unit-testable. Exposes the raw Map for test surgery
// (e.g. backdating fetchedAt) via (globalThis as any).__chromeStore.
const store = new Map<string, unknown>();

function pick(keys: string | string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const list = keys === undefined ? [...store.keys()] : Array.isArray(keys) ? keys : [keys];
  for (const k of list) if (store.has(k)) out[k] = store.get(k);
  return out;
}

(globalThis as unknown as { __chromeStore: Map<string, unknown> }).__chromeStore = store;

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (keys?: string | string[]) => pick(keys),
      set: async (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) store.set(k, v);
      },
      remove: async (keys: string | string[]) => {
        for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
      },
      clear: async () => store.clear(),
    },
  },
  runtime: {},
};

// A source that never answers no longer holds the Home: the rows that loaded are shown inside the budget.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
let clock = 0;
let fetched = [];
globalThis.kino = {
  lang: "es",
  config: { get: () => undefined },
  storage: { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => { store.set(k, v); }, remove: (k) => { store.delete(k); }, keys: () => [...store.keys()] },
  fetch: (url) => {
    fetched.push(url);
    if (url.includes("AnimeAV1")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ metas: [{ id: "tv-1", name: "Uno" }] }) });
    return new Promise(() => {}); // never answers
  },
  sleep: async (ms) => { clock += ms; await new Promise((r) => setImmediate(r)); },
  log() {}, error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
};
const realNow = Date.now;
const plugin = await import("../src/plugin.js");

test("the plugin asks Kino to drop the requests a call leaves running", () => {
  assert.equal(globalThis.__kinoDropPendingFetches, true);
});

test("home shows the source that answered and leaves off the ones that never do", async () => {
  clock = 0;
  Date.now = () => 1e12 + clock;
  try {
    const rows = await plugin.home();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "onair-animeav1");
    assert.ok(clock <= 12000, "it gave up at the budget, clock " + clock);
  } finally { Date.now = realNow; }
});

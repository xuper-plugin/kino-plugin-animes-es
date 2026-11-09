// src/browse/model.js
var TAB_IDS = ["inicio", "generos"];
var MAX_SLIDES = 6;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  const poster = item.poster || item.logo;
  if (poster && HTTPS.test(poster)) out.poster = poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.adult === true) out.adult = true;
  return out;
}
function slidesOf(rows) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items) {
      if (out.length >= MAX_SLIDES) return out;
      if (item.adult === true || seen.has(item.id) || !item.backdrop || !HTTPS.test(item.backdrop)) continue;
      const text = typeof item.overview === "string" ? item.overview.trim() : "";
      if (text === "") continue;
      seen.add(item.id);
      out.push({
        id: item.id,
        ref: item.ref,
        kind: item.kind,
        title: item.title,
        image: item.backdrop,
        text: text.length <= MAX_SLIDE_TEXT ? text : `${text.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`
      });
    }
  }
  return out;
}
function railsOf(rows) {
  return rows.filter((r) => r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.ref ? { ref: r.ref } : {},
    items: r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf)
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), rails };
}
var seriesIdOf = (id) => String(id || "").split(":").slice(0, 2).join(":");
function playedKey(ref) {
  const r = String(ref || "");
  const e = /^e:[^:]+:(.+)$/.exec(r);
  if (e) return seriesIdOf(e[1]);
  const m = /^m:(.+)$/.exec(r);
  return m ? seriesIdOf(m[1]) : "";
}
var cardKey = (card) => playedKey(/^i:[^:]+:(.+)$/.test(card.ref) ? "e:" + card.ref.slice(2) : card.ref);
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) for (const rail2 of data.rails) for (const card of rail2.items) if (!byKey.has(cardKey(card))) byKey.set(cardKey(card), card);
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const card = byKey.get(key);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/browse/words.js
var WORDS = {
  tabHome: ["Inicio", "Home"],
  tabGenres: ["G\xE9neros", "Genres"],
  brWatch: ["Ver", "Watch"],
  brInfo: ["M\xE1s informaci\xF3n", "More info"],
  brRecent: ["Continuar viendo", "Continue watching"],
  brSearch: ["Buscar", "Search"],
  brSearchHint: ["Buscar en AnimES", "Search AnimES"],
  brSearchTitle: ["Buscar", "Search"],
  brSearchedBefore: ["Buscado recientemente", "Recently searched"],
  brNoResults: ["No encontramos nada con esas palabras.", "Nothing matched those words."],
  brSearchFailed: ["No se pudo buscar. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "The search failed. Check your connection and try again."],
  brFailed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  brRetry: ["Reintentar", "Retry"],
  brEmpty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  brBack: ["Atr\xE1s", "Back"],
  brClose: ["Cerrar", "Close"],
  brSettings: ["Configuraci\xF3n", "Settings"]
};
var both = (key) => ({ es: WORDS[key][0], en: WORDS[key][1] });
var KEYS = Object.keys(WORDS);

// src/browse/logo.js
var LOGO_ASPECT = "3.33:1";
var LOGO_DATA = "data:image/png;base64,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";

// src/browse/view.js
var TAB_KEYS = { inicio: "tabHome", generos: "tabGenres" };
var POLL_MS = 1500;
var SEARCH_CAP = 60;
var twin = (key, field = "text", vars) => {
  const w = both(key, vars);
  return { [field]: w.es, [field + "En"]: w.en };
};
var logo = () => ({
  type: "Image",
  key: "logo",
  url: LOGO_DATA,
  aspect: LOGO_ASPECT,
  fit: "contain",
  h: 40,
  alt: "AnimES",
  altEn: "AnimES",
  fallback: { type: "Text", text: "AnimES", textEn: "AnimES", style: "h4" }
});
var tabBar = (active) => ({ type: "TabBar", key: "tabs", divider: false, value: active, onChanged: "tab", tabs: TAB_IDS.map((id) => ({ value: id, ...twin(TAB_KEYS[id], "label") })) });
var railSkeleton = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var gridSkeleton = () => ({
  type: "Column",
  key: "gridSkeleton",
  gap: 12,
  children: [
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["compact"], key: `gc${r}`, children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `gc${r}-${i}`, flex: 1 })) })),
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["medium", "expanded"], key: `gw${r}`, children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `gw${r}-${i}`, flex: 1 })) }))
  ]
});
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var slideNode = (s) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  buttons: [
    {
      type: "ElevatedButton",
      key: "watch-" + s.id,
      ...twin("brWatch", "labelText"),
      icon: "play",
      onPressed: { go: { play: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } }
    },
    {
      type: "TextButton",
      key: "info-" + s.id,
      ...twin("brInfo", "labelText"),
      onPressed: { go: { title: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } }
    }
  ]
});
var hero = (slides) => slides.length === 1 ? slideNode(slides[0]) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map(slideNode)
};
var rail = (r, key, titleOverride, size = "medium") => ({
  type: "titleRail",
  key,
  ...titleOverride || { title: r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  size
});
function browseView({ tab, data, recent, pending, failed, device = "phone" }) {
  const tv = device === "tv";
  const gear = { type: "IconButton", key: "settingsButton", icon: "settings", ...twin("brSettings", "labelText"), ...twin("brSettings", "tooltip"), onPressed: { event: "go", arg: "settings" } };
  const active = TAB_IDS.includes(tab) ? tab : TAB_IDS[0];
  const body = [];
  if (data) {
    if (data.slides.length > 0) body.push(hero(data.slides));
    else if (pending) body.push(heroSkeleton());
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("brRecent", "title"), tv ? "small" : "medium"));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, tv ? "small" : "medium"));
    if (data.rails.length === 0) body.push({ type: "Text", ...twin("brEmpty", "text"), color: "muted" });
  } else if (failed) {
    body.push({
      type: "MaterialBanner",
      key: "loadFailed",
      role: "error",
      ...twin("brFailed"),
      action: { ...twin("brRetry", "label"), onTap: "retry" }
    });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      // One bar instead of two (Kino 0.9.81+; an older Kino draws its own bar above and this one under it): the close button where
      // Kino's was and the plugin's logo where its name was (its name when the logo cannot be drawn), with no line under it.
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "close", icon: "close", ...twin("brClose", "labelText"), ...twin("brClose", "tooltip"), onPressed: { go: { close: true } } },
      // On a TV the search is a button of the bar (a floating one is hard to reach with a remote); elsewhere it floats.
      actions: tv ? [{ type: "IconButton", key: "searchButton", icon: "search", ...twin("brSearch", "labelText"), ...twin("brSearch", "tooltip"), onPressed: "openSearch" }, gear] : [gear],
      title: tv ? { type: "Row", key: "titleRow", gap: 24, crossAxisAlignment: "center", children: [logo(), tabBar(active)] } : logo()
    },
    ...tv ? {} : { floatingActionButton: { type: "FloatingActionButton", key: "searchFab", icon: "search", ...twin("brSearch", "tooltip"), onPressed: "openSearch" } },
    // The tabs stay pinned under the bar; only the rows scroll.
    body: { type: "Column", key: "page", children: [
      // The tabs line up with the bar's buttons and the cards below (a wide window and the TV pad their content by 24).
      ...tv ? [] : [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(active)] }],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function settingsView() {
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin("brBack", "labelText"), ...twin("brBack", "tooltip"), onPressed: "back" },
      title: logo()
    },
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [{ type: "settings", key: "form" }] }] }
  };
}
function searchView({ query, status, items, history = [], device = "phone" }) {
  const tv = device === "tv";
  const searchForm = () => ({
    type: "Form",
    key: "searchForm",
    onSubmitted: "search",
    gap: 8,
    children: tv ? [{ type: "Row", key: "searchRow", gap: 16, crossAxisAlignment: "center", children: [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin("brSearchHint", "labelText"), maxLength: 100, autofocus: true, weight: 1 },
      { type: "ElevatedButton", key: "searchGo", ...twin("brSearch", "labelText"), icon: "search", submit: true }
    ] }] : [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin("brSearchHint", "labelText"), maxLength: 100, autofocus: true },
      { type: "ElevatedButton", key: "searchGo", ...twin("brSearch", "labelText"), icon: "search", submit: true }
    ]
  });
  const body = tv ? [] : [searchForm()];
  if (status === "fail") {
    body.push({ type: "MaterialBanner", key: "searchFailed", role: "error", ...twin("brSearchFailed"), action: { ...twin("brRetry", "label"), onTap: "sretry" } });
  } else if (status === "done" && items) {
    if (items.length === 0) body.push({ type: "Text", ...twin("brNoResults", "text"), color: "muted" });
    else body.push({ type: "titleGrid", key: "results", columns: { compact: 3, expanded: 6 }, items: items.slice(0, SEARCH_CAP) });
  } else if (status !== "idle") {
    body.push(gridSkeleton());
  } else if (history.length > 0) {
    body.push({ type: "Text", ...twin("brSearchedBefore", "text"), style: "h4" });
    body.push({ type: "titleGrid", key: "history", columns: { compact: 3, expanded: 6 }, items: history.slice(0, SEARCH_CAP) });
  }
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin("brBack", "labelText"), ...twin("brBack", "tooltip"), onPressed: "back" },
      ...tv ? { title: searchForm() } : twin("brSearchTitle", "title")
    },
    body: { type: "SingleChildScrollView", key: "search-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...status === "loading" ? { every: { ms: 1e3, event: "stick" } } : {}
  };
}

// src/browse/metaCache.js
var KEY = "meta2";
var MAX = 260;
var CALL_MS = 8e3;
var CONCURRENCY = 3;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, clock = { now: () => Date.now() } }) {
  const usable = () => {
    try {
      return typeof kino2.meta === "function" && kino2.meta.byTitle === true;
    } catch (_) {
      return false;
    }
  };
  let book = null;
  function read() {
    if (book) return book;
    try {
      const o = JSON.parse(kino2.storage.get(KEY) || "null");
      book = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      book = {};
    }
    return book;
  }
  function write() {
    try {
      const ids = Object.keys(book);
      if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete book[id];
      kino2.storage.set(KEY, JSON.stringify(book));
    } catch (_) {
    }
  }
  function known(id) {
    const e = read()[id];
    if (!e) return {};
    return {
      ...e.t > 0 ? { tmdb: e.t } : {},
      ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {},
      ...e.b && HTTPS2.test(e.b) && e.o ? { backdrop: e.b, overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const withId = k.tmdb && !(c.ids && c.ids.tmdb) ? { ...c, ids: { ...c.ids || {}, tmdb: k.tmdb } } : c;
      return k.backdrop && !withId.backdrop ? { ...withId, backdrop: k.backdrop } : withId;
    });
  }
  async function fill(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let asked2 = 0;
    let stop = false;
    const todo = cards.filter((c) => c && typeof c.id === "string" && !Object.hasOwn(b, c.id) && !(c.ids && c.ids.tmdb && c.noLogo));
    let next = 0;
    const worker = async () => {
      while (!stop && next < todo.length) {
        if (clock.now() + CALL_MS > end) return;
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: c.kind === "series" ? "series" : "movie", title: c.title, ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: a && typeof a.logo === "string" ? a.logo : "",
            b: a && typeof a.backdrop === "string" ? a.backdrop : "",
            o: a && typeof a.overview === "string" ? a.overview.slice(0, 160) : ""
          };
          asked2++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (asked2 > 0) write();
    return asked2;
  }
  return { known, asked, dress, fill, usable };
}

// src/browse/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 12 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var HIST_KEY = "searchHist1";
var HIST_MAX = 24;
var MAX_META_TICKS = 30;
function metaAsk(c) {
  const title = String(c.title).replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+/g, " ").trim() || String(c.title);
  const y = /\((19|20)\d{2}\)/.exec(String(c.title));
  return { id: c.id, title, kind: c.kind, ...y ? { year: parseInt(y[0].slice(1, 5), 10) } : {} };
}
var MAX_LOAD_TRIES = 3;
function makeBrowse({ kino: kino2, loadTab, searchTitles }) {
  const meta = makeMetaCache({ kino: kino2 });
  const slidesFrom = (rails) => {
    const out = [];
    for (const r of rails) for (const c of r.items) {
      if (out.length >= 5) return out;
      const k = meta.known(c.id);
      if (!k.backdrop || c.adult === true || out.some((s) => s.id === c.id)) continue;
      out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: k.overview, ...k.logo ? { logo: k.logo } : {} });
    }
    return out;
  };
  const uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
  const enrich = (data) => data ? {
    slides: data.slides.length > 0 ? data.slides.map((s) => {
      const k = meta.known(s.id);
      return k.logo ? { ...s, logo: k.logo } : s;
    }) : slidesFrom(data.rails),
    rails: data.rails.map((r) => ({ ...r, items: uniform(meta.dress(r.items)) }))
  } : data;
  const metaTries = /* @__PURE__ */ new Map();
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[animes]", ...a);
    } catch (_) {
    }
  };
  const get = (k) => {
    try {
      return kino2.storage.get(k);
    } catch (_) {
      return null;
    }
  };
  const set = (k, v, opts) => {
    try {
      kino2.storage.set(k, v, opts);
    } catch (_) {
    }
  };
  function readSnap(tab) {
    try {
      const o = JSON.parse(get(SNAP_PREFIX + tab) || "null");
      return o && Date.now() - o.at < SNAP_TTL_MS && o.data && Array.isArray(o.data.rails) ? o.data : null;
    } catch (_) {
      return null;
    }
  }
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim2 = { slides: data.slides, rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text = JSON.stringify({ at: Date.now(), data: slim2 });
      if (text.length <= SNAP_MAX) {
        set(SNAP_PREFIX + tab, text, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  const remember = (tab) => set(TAB_KEY, tab);
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab);
    if (snap) {
      memo.set(tab, { data: snap, whole: false });
      return snap;
    }
    return null;
  }
  const readKeys = () => {
    try {
      const a = JSON.parse(get(RECENT_KEY) || "[]");
      return Array.isArray(a) ? a.filter((k) => typeof k === "string") : [];
    } catch (_) {
      return [];
    }
  };
  function notePlayed(ref) {
    try {
      const key = playedKey(ref);
      if (key === "") return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const slim = (c) => ({ id: c.id, ref: c.ref, title: c.title, kind: c.kind, ...c.poster ? { poster: c.poster } : {} });
  function readHistory() {
    try {
      const a = JSON.parse(get(HIST_KEY) || "[]");
      return Array.isArray(a) ? a.filter((c) => c && typeof c.id === "string" && typeof c.ref === "string" && typeof c.title === "string").slice(0, HIST_MAX) : [];
    } catch (_) {
      return [];
    }
  }
  function rememberFound(cards) {
    try {
      const fresh = cards.filter((c) => c.adult !== true).slice(0, 12).map(slim);
      const ids = new Set(fresh.map((c) => c.id));
      set(HIST_KEY, JSON.stringify([...fresh, ...readHistory().filter((c) => !ids.has(c.id))].slice(0, HIST_MAX)));
    } catch (_) {
    }
  }
  let found = null;
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab, device) {
    const order = [tab, ...TAB_IDS.filter((t2) => t2 !== tab)];
    return order.filter((t2, i) => (i === 0 || device !== "tv") && !(memo.get(t2) && memo.get(t2).whole));
  }
  function view(ctx) {
    const st = ctx.state && typeof ctx.state === "object" ? ctx.state : {};
    if (ctx.route && ctx.route.name === "settings") return settingsView();
    if (ctx.route && ctx.route.name === "search") {
      const query = typeof st.sq === "string" ? st.sq : "";
      const items = found && found.q === query ? found.items : null;
      const status = query === "" ? "idle" : st.sstate === "fail" ? "fail" : items ? "done" : "loading";
      return searchView({ query, status, items, history: query === "" ? readHistory() : [], device: ctx.device });
    }
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(ctx.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    return browseView({ tab, data, recent: uniform(meta.dress(recentOf(readKeys(), loaded))), pending, failed: !!(st.failed && st.failed[tab]), device: ctx.device });
  }
  async function load(tab) {
    const page = await loadTab(tab);
    const data = tabOf(page);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const loadTries = /* @__PURE__ */ new Map();
  function failLoad(tab, rest, failed) {
    const n = (loadTries.get(tab) || 0) + 1;
    loadTries.set(tab, n);
    if (n < MAX_LOAD_TRIES) rest.push(tab);
    else {
      failed[tab] = true;
      loadTries.delete(tab);
    }
  }
  const events = {
    open({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab, device), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      remember(tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state, device }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      return { state: { failed: null, pending: [tab, ...needed(tab, device).filter((t2) => t2 !== tab)] } };
    },
    async tick({ state }) {
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tabId = next.slice(5);
        const m = memo.get(tabId);
        if (!m) return { state: { pending: rest } };
        const cards = [...m.data.slides, ...m.data.rails.flatMap((r) => r.items.slice(0, 6)), ...m.data.rails.flatMap((r) => r.items.slice(6))];
        const asked = await meta.fill(cards.map(metaAsk), 12e3);
        const made = slidesFrom(m.data.rails);
        if (made.length > m.data.slides.length) {
          m.data = { ...m.data, slides: made.map(({ logo: logo2, ...rest2 }) => rest2) };
          writeSnap(tabId, m.data);
        }
        const tries = (metaTries.get(tabId) || 0) + 1;
        metaTries.set(tabId, tries);
        if (asked > 0 && tries < MAX_META_TICKS && cards.some((c) => !meta.asked(c.id))) return { state: { pending: [next, ...rest] } };
        return { state: { pending: rest } };
      }
      try {
        const ok = await load(next);
        if (!ok) failLoad(next, rest, failed);
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("browse tab", e && e.code || "error");
        failLoad(next, rest, failed);
      }
      return { state: { pending: rest, failed } };
    },
    // The floating button: straight to the search page, empty and ready for the words.
    openSearch() {
      return { route: { push: "search" }, state: { sq: "", sstate: null } };
    },
    search({ value, route }) {
      const q = value && typeof value.q === "string" ? value.q.trim().slice(0, 100) : "";
      if (q === "") return null;
      const state = { sq: q, sstate: "loading" };
      return route && route.name === "search" ? { state } : { route: { push: "search" }, state };
    },
    // The search page's timer: one search per press, then no timer.
    async stick({ state }) {
      const q = typeof state.sq === "string" ? state.sq : "";
      if (q === "" || state.sstate !== "loading") return null;
      try {
        const out = await searchTitles(q);
        found = { q, items: (Array.isArray(out) ? out : []).slice(0, 60).map(cardOf) };
        rememberFound(found.items);
        return { state: { sstate: "done" } };
      } catch (e) {
        log("browse search", e && e.code || "error");
        return { state: { sstate: "fail" } };
      }
    },
    sretry({ state }) {
      return typeof state.sq === "string" && state.sq !== "" ? { state: { sstate: "loading" } } : null;
    },
    // The gear: the plugin's settings are a page of their own, one Back away.
    go({ arg }) {
      return arg === "settings" ? { route: { push: "settings" }, state: { fromBrowse: true } } : null;
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { sq: null, sstate: null } };
    }
  };
  async function event(ev) {
    const handler = Object.hasOwn(events, ev.name) ? events[ev.name] : null;
    return handler ? await handler({ ...ev, state: ev.state || {} }) ?? null : null;
  }
  return { view, event, notePlayed };
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
var BASE = "https://pigamer37.alwaysdata.net/onAirCatalogs=animeav1%2Chenaojara%2Ctioanime%2Cjkanime";
var GENRE_PAGE = 20;
var LIST_TIMEOUT_MS = 8e3;
var RESOLVE_TIMEOUT_MS = 8e3;
var ADDON_FAST_MS = 2500;
var TWIN_FRESH_MS = 7 * 24 * 60 * 60 * 1e3;
var HLS_HEALTH_KEY = "hlsHealth";
var HLS_HEALTH_OK_MS = 10 * 60 * 1e3;
var HLS_HEALTH_BAD_MS = 3 * 60 * 1e3;
var TEXTS = {
  es: {
    unavailable: "El servicio de anime no responde ahora. Intenta de nuevo en un rato.",
    noStreams: "Este episodio no tiene video disponible por ahora. Prueba otro o vuelve m\xE1s tarde.",
    noSources: "Activa al menos una fuente de anime.",
    rowOnAir: "{name} \u2014 En emisi\xF3n",
    sectionHero: "Anime en emisi\xF3n ahora.",
    copyFailed: "Esta copia no se pudo abrir ahora. Prueba otro servidor del men\xFA.",
    sub: "Subtitulado",
    dub: "Doblado",
    cacheStatus: "Cach\xE9: {n} entradas, {kb} KB",
    cacheCleared: "Listo: se vaci\xF3 la cach\xE9",
    healthOk: "ok",
    healthFail: "falla",
    healthNone: "sin datos",
    healthOff: "apagada",
    probeDone: "Listo: {ok} de {n} fuentes responden",
    genre_accion: "Acci\xF3n",
    genre_aventura: "Aventura",
    genre_comedia: "Comedia",
    genre_drama: "Drama",
    genre_fantasia: "Fantas\xEDa",
    genre_romance: "Romance",
    genre_ciencia_ficcion: "Ciencia ficci\xF3n",
    genre_misterio: "Misterio",
    genre_terror: "Terror",
    genre_mecha: "Mecha",
    genre_magia: "Magia",
    genre_shounen: "Shounen",
    genre_shoujo: "Shoujo",
    genre_seinen: "Seinen",
    genre_josei: "Josei",
    genre_sobrenatural: "Sobrenatural",
    genre_deportes: "Deportes",
    genre_historico: "Hist\xF3rico",
    genre_psicologico: "Psicol\xF3gico",
    genre_isekai: "Isekai"
  },
  en: {
    unavailable: "The anime service isn't responding right now. Try again in a while.",
    noStreams: "This episode has no video available right now. Try another or come back later.",
    noSources: "Turn on at least one anime source.",
    rowOnAir: "{name} \u2014 On Air",
    sectionHero: "Anime airing now.",
    copyFailed: "This copy could not be opened right now. Try another server from the menu.",
    sub: "Subtitled",
    dub: "Dubbed",
    cacheStatus: "Cache: {n} entries, {kb} KB",
    cacheCleared: "Done: the cache is empty",
    healthOk: "ok",
    healthFail: "failing",
    healthNone: "no data",
    healthOff: "off",
    probeDone: "Done: {ok} of {n} sources answer",
    genre_accion: "Action",
    genre_aventura: "Adventure",
    genre_comedia: "Comedy",
    genre_drama: "Drama",
    genre_fantasia: "Fantasy",
    genre_romance: "Romance",
    genre_ciencia_ficcion: "Sci-Fi",
    genre_misterio: "Mystery",
    genre_terror: "Horror",
    genre_mecha: "Mecha",
    genre_magia: "Magic",
    genre_shounen: "Shounen",
    genre_shoujo: "Shoujo",
    genre_seinen: "Seinen",
    genre_josei: "Josei",
    genre_sobrenatural: "Supernatural",
    genre_deportes: "Sports",
    genre_historico: "Historical",
    genre_psicologico: "Psychological",
    genre_isekai: "Isekai"
  }
};
function t(key, vars) {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  const template = TEXTS[lang][key] || TEXTS.es[key] || key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] != null ? vars[k] : "")) : template;
}
var CACHE_PREFIX = "c2:";
var HARD_TTL_MS = 24 * 60 * 60 * 1e3;
var ENTRY_MAX_CHARS = 48 * 1024;
var FRESH_ON_AIR_MS = 15 * 60 * 1e3;
var FRESH_META_MS = 60 * 60 * 1e3;
var FRESH_GENRE_MS = 30 * 60 * 1e3;
var FRESH_ART_MS = 12 * 60 * 60 * 1e3;
function cacheKeys() {
  return kino.storage.keys().filter((k) => k.startsWith(CACHE_PREFIX));
}
function cacheRead(key) {
  const raw = kino.storage.get(CACHE_PREFIX + key);
  if (!raw) return null;
  try {
    const e = JSON.parse(raw);
    return e && typeof e.at === "number" ? e : null;
  } catch {
    kino.storage.remove(CACHE_PREFIX + key);
    return null;
  }
}
function evictOldest() {
  let victim = null;
  let oldest = Infinity;
  for (const k of cacheKeys()) {
    let at = 0;
    try {
      at = JSON.parse(kino.storage.get(k) || "{}").at || 0;
    } catch {
    }
    if (at < oldest) {
      oldest = at;
      victim = k;
    }
  }
  if (!victim) return false;
  kino.storage.remove(victim);
  return true;
}
function cacheWrite(key, v) {
  const raw = JSON.stringify({ at: Date.now(), v });
  if (raw.length > ENTRY_MAX_CHARS) return;
  for (let tries = 0; tries < 20; tries++) {
    try {
      kino.storage.set(CACHE_PREFIX + key, raw, { ttlMs: HARD_TTL_MS });
      return;
    } catch (e) {
      if (!e || e.code !== "too_large" || !evictOldest()) return;
    }
  }
}
async function cached(key, freshMs, load) {
  const hit = cacheRead(key);
  if (hit && Date.now() - hit.at < freshMs) return hit.v;
  try {
    const v = await load();
    cacheWrite(key, v);
    return v;
  } catch (e) {
    if (hit) {
      kino.log("serving stale " + key + ": " + (e && e.message));
      return hit.v;
    }
    throw e;
  }
}
async function getJson(url, timeoutMs) {
  const r = await kino.fetch(url, { timeoutMs: timeoutMs || 15e3 });
  if (!r.ok) throw kino.error("unavailable", "AnimES backend answered " + r.status, { userMessage: t("unavailable") });
  try {
    return await r.json();
  } catch {
    throw kino.error("unavailable", "AnimES backend answered something that is not JSON", { userMessage: t("unavailable") });
  }
}
var enc = encodeURIComponent;
function onAirUrl(src) {
  return `${BASE}/catalog/${enc(src.type)}/${enc(src.id + "|onair")}.json`;
}
function searchUrl(src, query, genre) {
  return `${BASE}/catalog/${enc(src.type)}/${enc(src.id)}/${enc("search=" + query + (genre ? "&genre=" + genre : ""))}.json`;
}
function genreUrl(src, genre, skip) {
  const extras = "genre=" + genre + (skip > 0 ? "&skip=" + skip : "");
  return `${BASE}/catalog/Anime/${enc(src.id + "|genres")}/${enc(extras)}.json`;
}
function metaUrl(type, stremioId) {
  return `${BASE}/meta/${enc(type)}/${enc(stremioId)}.json`;
}
function streamUrl(type, videoId) {
  return `${BASE}/stream/${enc(type)}/${enc(videoId)}.json`;
}
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}
var HEALTH_KEY = "health";
var DOWN_AFTER = 3;
function readHealth() {
  try {
    const h = JSON.parse(kino.storage.get(HEALTH_KEY) || "{}");
    return h && typeof h === "object" && !Array.isArray(h) ? h : {};
  } catch {
    return {};
  }
}
function recordHealth(id, ok) {
  try {
    const h = readHealth();
    const fails = ok ? 0 : (h[id] && Number.isFinite(h[id].fails) ? h[id].fails : 0) + 1;
    h[id] = { ok, fails, at: Date.now() };
    kino.storage.set(HEALTH_KEY, JSON.stringify(h));
    if (fails === DOWN_AFTER) kino.log.report("animes:source_down", id);
  } catch {
  }
}
var SOURCES = [
  { id: "animeav1", label: "AnimeAV1", type: "AnimeAV1" },
  { id: "henaojara", label: "Henaojara", type: "Henaojara" },
  { id: "tioanime", label: "TioAnime", type: "TioAnime" },
  { id: "jkanime", label: "JKAnime", type: "JKAnime" }
];
var GENRES = [
  "accion",
  "aventura",
  "comedia",
  "drama",
  "fantasia",
  "romance",
  "ciencia-ficcion",
  "misterio",
  "terror",
  "mecha",
  "magia",
  "shounen",
  "shoujo",
  "seinen",
  "josei",
  "sobrenatural",
  "deportes",
  "historico",
  "psicologico"
];
function enabledSources() {
  return SOURCES.filter((s) => kino.config.get("src_" + s.id) !== false);
}
function sourceById(id) {
  return SOURCES.find((s) => s.id === id) || null;
}
var MAX_ID = 128;
function kinoId(stremioId) {
  const clean = String(stremioId || "").replace(/:/g, "~").replace(/[^A-Za-z0-9._~-]/g, "-") || "unknown";
  if (clean.length <= MAX_ID) return clean;
  return clean.slice(0, MAX_ID - 9) + "-" + kino.crypto.hash("sha1", String(stremioId)).slice(0, 8);
}
var FILM_SLUG = /(^|[-:])(movie|pelicula|film|gekijouban)(-|$)/;
function kindOf(id) {
  return FILM_SLUG.test(String(id || "").toLowerCase()) ? "movie" : "series";
}
function itemRef(id) {
  return kindOf(id) === "movie" ? "m:" + id : "i:series:" + id;
}
function movieIdOf(ref) {
  const s = String(ref || "");
  return s.startsWith("m:") && s.length > 2 ? s.slice(2) : null;
}
function parseRef(prefix, ref) {
  const s = String(ref || "");
  if (!s.startsWith(prefix)) return null;
  const rest = s.slice(prefix.length);
  const cut = rest.indexOf(":");
  if (cut <= 0 || cut === rest.length - 1) return null;
  return { type: rest.slice(0, cut), id: rest.slice(cut + 1) };
}
function toItem(m) {
  const item = { id: kinoId(m.id), ref: itemRef(m.id), title: String(m.name || "").slice(0, 200), kind: kindOf(m.id) };
  if (m.poster) item.poster = String(m.poster);
  if (m.description) item.overview = String(m.description).slice(0, 300);
  if (Array.isArray(m.genres) && m.genres.length) item.genres = m.genres.slice(0, 5).map((g) => String(g).slice(0, 30));
  return item;
}
function itemsOf(body) {
  return body && Array.isArray(body.metas) ? body.metas.filter((m) => m && m.id && m.name).map(toItem) : [];
}
async function searchAll(sources, text, genre) {
  const lists = await mapLimit(sources, 6, async (src) => {
    try {
      const items = itemsOf(await getJson(searchUrl(src, text, genre), LIST_TIMEOUT_MS));
      recordHealth(src.id, true);
      return items;
    } catch (e) {
      recordHealth(src.id, false);
      kino.log("search " + src.id + " failed: " + (e && e.message));
      return [];
    }
  });
  const merged = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) merged.push(l[i]);
  const seen = /* @__PURE__ */ new Set();
  return merged.filter((it) => seen.has(it.id) ? false : (seen.add(it.id), true));
}
async function search(query) {
  const scope = query.within ? /^g:([a-z0-9]+):([a-z0-9-]+)$/.exec(String(query.within)) : null;
  if (query.within && (!scope || !sourceById(scope[1]))) return null;
  const sources = scope ? [sourceById(scope[1])] : enabledSources();
  const genre = scope ? scope[2] : void 0;
  const q = kino.rank.shortQuery(String(query.q || "").trim());
  if (!sources.length || !q) return [];
  const titles = [query.q, query.originalTitle].concat(Array.isArray(query.altTitles) ? query.altTitles : []).filter((x) => typeof x === "string" && x.trim());
  let found = await searchAll(sources, q, genre);
  if (!found.length) {
    const other = titles.map((x) => kino.rank.shortQuery(x.trim())).find((x) => x && x.toLowerCase() !== q.toLowerCase());
    if (other) found = await searchAll(sources, other, genre);
  }
  return kino.rank.sortBySimilarity(found, titles);
}
async function onAirItems(src) {
  return cached("onair:" + src.id, FRESH_ON_AIR_MS, async () => {
    try {
      const items = itemsOf(await getJson(onAirUrl(src), LIST_TIMEOUT_MS));
      recordHealth(src.id, true);
      return items;
    } catch (e) {
      recordHealth(src.id, false);
      throw e;
    }
  });
}
async function onAirRow(src) {
  try {
    const items = await onAirItems(src);
    return items.length ? { id: "onair-" + src.id, title: t("rowOnAir", { name: src.label }), items, genre: "anime" } : null;
  } catch (e) {
    kino.log("on air " + src.id + " failed: " + (e && e.message));
    return null;
  }
}
var ROWS_BUDGET_MS = 11e3;
async function onAirRows() {
  const sources = enabledSources();
  const out = new Array(sources.length).fill(null);
  const end = Date.now() + ROWS_BUDGET_MS;
  let done = false;
  let next = 0;
  async function worker() {
    while (next < sources.length && Date.now() < end) {
      const i = next++;
      out[i] = await onAirRow(sources[i]);
    }
  }
  const all = Promise.all(Array.from({ length: Math.min(4, sources.length) }, worker)).then(() => {
    done = true;
  });
  while (!done && Date.now() < end) await Promise.race([all, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
  return out.filter(Boolean);
}
async function home() {
  if (kino.config.get("homeRows") === false) return [];
  return onAirRows();
}
async function browse(ref, cursor) {
  const skip = Math.max(0, parseInt(cursor || "0", 10) || 0);
  const m = /^g:([a-z0-9]+):([a-z0-9-]+)$/.exec(String(ref || ""));
  const src = m && sourceById(m[1]);
  if (!m || !src) throw kino.error("not_found", "unknown browse ref: " + String(ref).slice(0, 60));
  const load = async () => itemsOf(await getJson(genreUrl(src, m[2], skip), 15e3));
  const items = skip === 0 ? await cached(`genre:${src.id}:${m[2]}`, FRESH_GENRE_MS, load) : await load();
  return items.length >= GENRE_PAGE ? { items, next: String(skip + GENRE_PAGE) } : { items };
}
async function section({ tab }) {
  const sources = enabledSources();
  if (!sources.length) return { tabs: [], tab: "", rows: [] };
  const tabs = sources.map((s) => ({ id: s.id, label: s.label }));
  const chosen = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  const row = await onAirRow(sourceById(chosen));
  const rows = row ? [row] : [];
  const answer = { tabs, tab: chosen, rows };
  if (row) {
    const pick = row.items[Math.floor(Date.now() / 864e5) % row.items.length];
    answer.hero = { title: pick.title, text: t("sectionHero") };
    if (pick.poster) answer.hero.image = pick.poster;
  }
  return answer;
}
var SCREEN_GENRES = 8;
async function tabPage(tab) {
  if (tab !== "generos") return { rows: await onAirRows() };
  const src = enabledSources()[0];
  if (!src) return { rows: [] };
  const rows = await mapLimit(GENRES.slice(0, SCREEN_GENRES), 4, async (genre) => {
    try {
      const { items } = await browse(`g:${src.id}:${genre}`, "0");
      return items.length ? { id: "genre-" + genre, title: t("genre_" + genre.replace(/-/g, "_")), ref: `g:${src.id}:${genre}`, items } : null;
    } catch (e) {
      kino.log("genre row " + genre + " failed: " + (e && e.message));
      return null;
    }
  });
  return { rows: rows.filter(Boolean) };
}
var browseInstance = null;
var browseScreen = () => browseInstance ?? (browseInstance = makeBrowse({
  kino,
  loadTab: (tab) => tabPage(tab),
  searchTitles: (q) => search({ q })
}));
async function screen(ctx) {
  await null;
  return browseScreen().view(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return browseScreen().event(ev && typeof ev === "object" ? ev : {});
}
async function categories() {
  const src = enabledSources()[0];
  if (!src) return [];
  const tiles = await mapLimit(GENRES, 6, async (genre) => {
    let art = "";
    try {
      art = await cached(`art:${src.id}:${genre}`, FRESH_ART_MS, async () => {
        const first = itemsOf(await getJson(genreUrl(src, genre, 0), LIST_TIMEOUT_MS))[0];
        return first && first.poster ? first.poster : "";
      });
    } catch (e) {
      kino.log("genre " + genre + " art failed: " + (e && e.message));
    }
    const tile = { id: genre, title: t("genre_" + genre.replace(/-/g, "_")), ref: `g:${src.id}:${genre}` };
    if (art) tile.art = art;
    return tile;
  });
  return tiles;
}
async function metaOf(type, id) {
  return cached(`meta:${type}:${id}`, FRESH_META_MS, async () => {
    const meta = (await getJson(metaUrl(type, id))).meta;
    if (!meta) throw kino.error("not_found", "the backend has no title " + String(id).slice(0, 80));
    const year = /^(\d{4})/.exec(String(meta.releaseInfo || meta.released || ""));
    return {
      title: String(meta.name || ""),
      poster: meta.poster || "",
      backdrop: meta.background || "",
      overview: String(meta.description || "").slice(0, 2e3),
      genres: Array.isArray(meta.genres) ? meta.genres.slice(0, 5).map((g) => String(g).slice(0, 30)) : [],
      year: year ? year[1] : "",
      // [season, number, video id, thumbnail, air date]
      videos: (Array.isArray(meta.videos) ? meta.videos : []).filter((v) => v && v.id && v.available !== false).map((v) => [
        Math.max(1, parseInt(v.season, 10) || 1),
        Math.max(1, parseInt(v.number || v.episode, 10) || 1),
        String(v.id),
        v.thumbnail || "",
        String(v.released || "").slice(0, 10)
      ])
    };
  });
}
function seriesInfo(meta) {
  const info = {};
  if (meta.title) info.title = meta.title;
  if (meta.poster) info.poster = meta.poster;
  if (meta.backdrop) info.backdrop = meta.backdrop;
  if (meta.overview) info.overview = meta.overview;
  if (meta.genres.length) info.genres = meta.genres;
  if (meta.year) info.year = meta.year;
  return info;
}
async function episodes(ref) {
  const r = parseRef("i:", ref);
  if (!r) throw kino.error("not_found", "not an item ref: " + String(ref).slice(0, 80));
  const meta = await metaOf(r.type, r.id);
  if (!meta.videos.length) throw kino.error("not_found", "no episodes for " + r.id.slice(0, 80), { userMessage: t("noStreams") });
  const list = meta.videos.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const seen = /* @__PURE__ */ new Set();
  const eps = [];
  for (const [season, number, id, still, date] of list) {
    const key = season + ":" + number;
    if (seen.has(key)) continue;
    seen.add(key);
    const ep = { season, number, ref: "e:" + r.type + ":" + id };
    if (still) ep.still = still;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) ep.airDate = date;
    eps.push(ep);
  }
  return { series: seriesInfo(meta), episodes: eps };
}
async function details(ref) {
  const movie = movieIdOf(ref);
  const r = movie ? { type: "movie", id: movie } : parseRef("i:", ref);
  if (!r) return null;
  return seriesInfo(await metaOf(r.type, r.id));
}
function serverOf(name) {
  const lines = String(name || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines[1] || lines[0] || "").replace(/[^\p{L}\p{N} ._+-]/gu, "").trim().slice(0, 24);
}
function isDub(s) {
  return /dub/i.test(String(s.name || "") + " " + String(s.description || ""));
}
function mimeOf(url) {
  const path = String(url).split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".m3u8")) return "application/x-mpegURL";
  if (path.endsWith(".mp4")) return "video/mp4";
  return void 0;
}
function headersOf(stream) {
  const req = stream.behaviorHints && stream.behaviorHints.proxyHeaders && stream.behaviorHints.proxyHeaders.request;
  return req && typeof req.Referer === "string" && req.Referer ? { Referer: req.Referer } : void 0;
}
function toStream(s) {
  const dub = isDub(s);
  const out = { url: s.url };
  const server = serverOf(s.name);
  out.label = (server ? server + " \xB7 " : "") + t(dub ? "dub" : "sub");
  const headers = headersOf(s);
  if (headers) out.headers = headers;
  const mime = mimeOf(s.url);
  if (mime) out.mime = mime;
  return { dub, stream: out };
}
var SITE = "https://animeav1.com";
var HLS_PLAYER = /^https:\/\/player\.zilla-networks\.com\/play\/([a-f0-9]{16,64})$/;
async function siteCopies(slug, number) {
  const none = { hls: [], voe: [] };
  if (kino.config.get("hls") === false) return none;
  try {
    const r = await kino.fetch(`${SITE}/media/${enc(slug)}/${number}`, { timeoutMs: LIST_TIMEOUT_MS });
    if (!r.ok) return none;
    const block = /embeds\s*:\s*\{([\s\S]*?)\}\s*,\s*downloads/.exec(r.text());
    if (!block) return none;
    const out = { hls: [], voe: [] };
    for (const lang of ["SUB", "DUB"]) {
      const list = new RegExp(lang + "\\s*:\\s*\\[([^\\]]*)\\]").exec(block[1]);
      if (!list) continue;
      const hls = /server\s*:\s*"HLS"\s*,\s*url\s*:\s*"([^"]+)"/.exec(list[1]);
      const id = hls && HLS_PLAYER.exec(hls[1]);
      if (id) out.hls.push({ dub: lang === "DUB", id: id[1] });
      const voe = /server\s*:\s*"Voe"\s*,\s*url\s*:\s*"([^"]+)"/.exec(list[1]);
      if (voe && VOE_EMBED.test(voe[1])) out.voe.push({ dub: lang === "DUB", url: voe[1] });
    }
    return out;
  } catch (e) {
    kino.log("site lookup failed: " + (e && e.message));
    return none;
  }
}
async function tioanimeVoe(slug, number) {
  if (kino.config.get("voe") === false) return [];
  try {
    const r = await kino.fetch(`https://tioanime.com/ver/${enc(slug)}-${number}`, { timeoutMs: LIST_TIMEOUT_MS });
    if (!r.ok) return [];
    const m = /var\s+videos\s*=\s*(\[[\s\S]*?\])\s*;/.exec(r.text());
    const list = m ? JSON.parse(m[1]) : [];
    const voe = list.find((v) => Array.isArray(v) && String(v[0]).toLowerCase() === "voe" && VOE_EMBED.test(String(v[1])));
    return voe ? [{ dub: null, url: String(voe[1]) }] : [];
  } catch (e) {
    kino.log("tioanime lookup failed: " + (e && e.message));
    return [];
  }
}
var VOE_EMBED = /^https:\/\/[a-z0-9.-]+\/e\/[A-Za-z0-9]{6,40}$/;
var VOE_JUNK = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
function voeDecode(ct, markers) {
  let t2 = String(ct).replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
  });
  for (const j of markers && markers.length ? markers : VOE_JUNK) t2 = t2.split(j).join("");
  const shifted = atob(t2);
  let u = "";
  for (let i = shifted.length - 1; i >= 0; i--) u += String.fromCharCode(shifted.charCodeAt(i) - 3);
  const bin = atob(u);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function voeMarkers(pageUrl, src) {
  try {
    const r = await kino.fetch(new URL(src, pageUrl).href, { timeoutMs: 4e3 });
    if (!r.ok) return null;
    const arr = /(\[(?:'\W{2}'[,\]]){1,9})/.exec(r.text());
    if (!arr) return null;
    const list = [];
    const re = /'(\W{2})'/g;
    let m;
    while (m = re.exec(arr[1])) list.push(m[1]);
    return list.length ? list : null;
  } catch {
    return null;
  }
}
function voePick(data) {
  const list = ["source", "file", "direct_access_url"].map((k) => data && data[k]).filter((v) => typeof v === "string" && /^https:\/\//.test(v));
  return list.find((u) => /\.m3u8(\?|$)/.test(u)) || list.find((u) => /\.mp4(\?|$)/.test(u)) || list[0] || "";
}
async function voeStream(embedUrl) {
  if (!VOE_EMBED.test(String(embedUrl))) throw kino.error("not_found", "not a Voe embed: " + String(embedUrl).slice(0, 80));
  let url = embedUrl;
  let source = "";
  for (let hop = 0; hop < 4 && !source; hop++) {
    const r = await kino.fetch(url, { timeoutMs: RESOLVE_TIMEOUT_MS });
    if (!r.ok) break;
    const html = r.text();
    const json = /<script[^>]*type="application\/json"[^>]*>\s*(\[[\s\S]*?\])\s*<\/script>(?:\s*<script[^>]+src="([^"]+)")?/.exec(html);
    if (json) {
      try {
        const markers = json[2] ? await voeMarkers(url, json[2]) : null;
        source = voePick(voeDecode(JSON.parse(json[1])[0], markers));
      } catch (e) {
        kino.log("voe decode failed: " + (e && e.message));
      }
      if (source) break;
    }
    const old = /sources\s*=\s*\{[\s\S]*?['"]hls['"]\s*:\s*(['"])([^'"]+)\1/.exec(html);
    if (old) {
      try {
        const d = /^https:\/\//.test(old[2]) ? old[2] : atob(old[2]);
        if (/^https:\/\//.test(d)) source = d;
      } catch {
      }
      if (source) break;
    }
    const plain = /['"]hls['"]\s*:\s*['"](https:\/\/[^'"]+)['"]/.exec(html);
    if (plain) {
      source = plain[1];
      break;
    }
    const next = /(?:window\.)?location(?:\.href)?\s*=\s*['"](https?:\/\/[^'"]+)['"]/.exec(html);
    if (!next) break;
    url = next[1];
  }
  if (!source) {
    kino.log.report("voe_failed", "no_source");
    throw kino.error("unavailable", "Voe gave no playlist", { userMessage: t("copyFailed") });
  }
  return { url: source, mime: /\.mp4(\?|$)/.test(source) ? "video/mp4" : "application/x-mpegURL", expiresInSeconds: 3600 };
}
async function voeAlive(url) {
  try {
    return await cached("voe:" + String(url).split("/").pop(), 60 * 60 * 1e3, async () => {
      const r = await kino.fetch(url, { timeoutMs: 3e3 });
      return r.status !== 404 && r.status !== 410;
    });
  } catch {
    return true;
  }
}
function voeEntry(c) {
  const lang = c.dub === null ? "" : " \xB7 " + t(c.dub ? "dub" : "sub");
  return { label: ("Voe" + lang).slice(0, 40), ref: "v:" + c.url };
}
function hlsStream(c) {
  return {
    url: `https://player.zilla-networks.com/m3u8/${c.id}`,
    label: ("HLS \xB7 AnimeAV1 \xB7 " + t(c.dub ? "dub" : "sub")).slice(0, 40),
    mime: "application/x-mpegURL",
    headers: { "Sec-Fetch-Site": "same-origin" }
  };
}
async function hlsHealthy(id) {
  let known = null;
  try {
    known = JSON.parse(kino.storage.get(HLS_HEALTH_KEY) || "null");
  } catch {
    known = null;
  }
  if (known && typeof known.at === "number" && Date.now() - known.at < (known.ok ? HLS_HEALTH_OK_MS : HLS_HEALTH_BAD_MS)) return !!known.ok;
  let ok = true;
  let status = 0;
  try {
    const pl = await kino.fetch(`https://player.zilla-networks.com/m3u8/${id}`, { timeoutMs: 4e3 });
    status = pl.status;
    if (pl.ok) {
      const seg = /https:\/\/player\.zilla-networks\.com\/segs\/[^\s"']+/.exec(pl.text());
      if (seg) {
        const r = await kino.fetch(seg[0], { headers: { "Sec-Fetch-Site": "same-origin", Range: "bytes=0-1023" }, timeoutMs: 4e3 });
        status = r.status;
        ok = r.status === 200 || r.status === 206 || r.status !== 401 && r.status !== 403;
      }
    } else {
      ok = pl.status !== 401 && pl.status !== 403;
    }
  } catch {
    return true;
  }
  try {
    kino.storage.set(HLS_HEALTH_KEY, JSON.stringify({ at: Date.now(), ok }), { ttlMs: HLS_HEALTH_OK_MS });
  } catch {
  }
  if (!ok) kino.log.report("hls_blocked", String(status));
  return ok;
}
function normTitle(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}
async function twinSlug(type, seriesId, slug) {
  try {
    return await cached("twin:" + slug, TWIN_FRESH_MS, async () => {
      const meta = await metaOf(type, seriesId);
      const want = normTitle(meta.title);
      if (!want) return "";
      const body = await getJson(searchUrl(SOURCES[0], meta.title), LIST_TIMEOUT_MS);
      const hit = (body && Array.isArray(body.metas) ? body.metas : []).find((m) => m && /^animeav1:/.test(String(m.id)) && normTitle(m.name) === want);
      return hit ? String(hit.id).slice("animeav1:".length) : "";
    });
  } catch (e) {
    kino.log("twin lookup failed: " + (e && e.message));
    return "";
  }
}
function animeav1Episode(videoId) {
  const m = /^(?:animeav1|henaojara|tioanime|jkanime):(.+):(\d{1,5})$/.exec(String(videoId || ""));
  return m ? { slug: m[1], number: m[2] } : null;
}
function tellApart(list) {
  const groups = /* @__PURE__ */ new Map();
  for (const x of list) {
    if (!groups.has(x.stream.label)) groups.set(x.stream.label, []);
    groups.get(x.stream.label).push(x);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const nodes = group.map((x) => (String(x.stream.url).split("/")[2] || "").split(":")[0].split(".")[0]);
    const distinct = new Set(nodes).size === group.length && nodes.every(Boolean);
    group.forEach((x, i) => {
      const tag = distinct ? nodes[i] : "#" + (i + 1);
      const label = x.stream.label;
      x.stream.label = (label.includes(" \xB7 ") ? label.replace(" \xB7 ", ` ${tag} \xB7 `) : `${tag} \xB7 ${label}`).slice(0, 40);
    });
  }
}
async function streamsOf(type, videoId, timeoutMs = RESOLVE_TIMEOUT_MS, attempts = 2) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const body = await getJson(streamUrl(type, videoId), timeoutMs);
    const list = Array.isArray(body.streams) ? body.streams.filter((s) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url)) : [];
    if (list.length) return list;
    if (attempt < attempts - 1) await kino.sleep(800);
  }
  return [];
}
async function resolveRef(ref) {
  const voe = /^v:(https:\/\/.+)$/.exec(String(ref || ""));
  if (voe) return voeStream(voe[1]);
  const movie = movieIdOf(ref);
  const r = movie ? { type: "movie", id: movie + ":1" } : parseRef("e:", ref);
  if (!r) throw kino.error("not_found", "not a playable ref: " + String(ref).slice(0, 80));
  const ep = animeav1Episode(r.id);
  let addonError = null;
  const askAddon = (ms, tries) => streamsOf(r.type, r.id, ms, tries).then((l) => (addonError = null, l), (e) => (addonError = e, []));
  const addonFirst = askAddon(ep ? ADDON_FAST_MS : RESOLVE_TIMEOUT_MS, ep ? 1 : 2);
  const tioVoe = ep && /^tioanime:/.test(r.id) ? tioanimeVoe(ep.slug, ep.number) : Promise.resolve([]);
  let site = ep ? await siteCopies(ep.slug, ep.number) : { hls: [], voe: [] };
  if (ep && !site.hls.length && !/^animeav1:/.test(r.id)) {
    const twin2 = await twinSlug(r.type, r.id.replace(/:\d+$/, ""), ep.slug);
    if (twin2 && twin2 !== ep.slug) site = await siteCopies(twin2, ep.number);
  }
  let copies = site.hls;
  if (copies.length && !await hlsHealthy(copies[0].id)) copies = [];
  const voeWanted = kino.config.get("voe") === false ? [] : site.voe.length ? site.voe : await tioVoe;
  const voeLive = await Promise.all(voeWanted.map((c) => voeAlive(c.url)));
  const voeCopies = voeWanted.filter((_, i) => voeLive[i]);
  let raw = await addonFirst;
  if (ep && !raw.length && !copies.length) raw = await askAddon(RESOLVE_TIMEOUT_MS, 1);
  const wantDubFirst = kino.config.get("audio") === "dub";
  const hlsOrdered = copies.slice().sort((a, b) => (a.dub === wantDubFirst ? -1 : 0) - (b.dub === wantDubFirst ? -1 : 0));
  if (!raw.length) {
    if (hlsOrdered.length) {
      const lazy = voeCopies.map(voeEntry);
      return { ...hlsStream(hlsOrdered[0]), expiresInSeconds: 1800, alternatives: hlsOrdered.slice(1).map(hlsStream).concat(lazy) };
    }
    if (voeCopies.length) {
      try {
        return await voeStream(voeCopies[0].url);
      } catch (e) {
        kino.log("voe as the only copy failed: " + (e && e.message));
      }
    }
    throw addonError || kino.error("not_found", "no streams for " + r.id.slice(0, 80), { userMessage: t("noStreams") });
  }
  const seen = /* @__PURE__ */ new Set();
  const all = raw.map(toStream).filter((x) => seen.has(x.stream.url) ? false : (seen.add(x.stream.url), true));
  tellApart(all);
  const wantDub = kino.config.get("audio") === "dub";
  const hls = hlsOrdered.map((c) => ({ dub: c.dub, stream: hlsStream(c) }));
  const pool = [
    ...hls.filter((x) => x.dub === wantDub),
    ...all.filter((x) => x.dub === wantDub),
    ...hls.filter((x) => x.dub !== wantDub),
    ...all.filter((x) => x.dub !== wantDub)
  ];
  if (pool[0].dub !== wantDub) kino.log.report("audio_fallback", wantDub ? "dub" : "sub");
  const [first, ...rest] = pool;
  const main = { ...first.stream, expiresInSeconds: 1800 };
  const hlsSet = new Set(hls);
  const ahead = rest.filter((x) => hlsSet.has(x));
  const behind = rest.filter((x) => !hlsSet.has(x));
  const alternatives = [...ahead.map((x) => x.stream), ...voeCopies.map(voeEntry), ...behind.map((x) => x.stream)].slice(0, 12);
  if (alternatives.length) main.alternatives = alternatives;
  return main;
}
async function resolve(ref) {
  const out = await resolveRef(ref);
  try {
    browseScreen().notePlayed(ref);
  } catch {
  }
  return out;
}
async function settingsStatus() {
  const keys = cacheKeys();
  let chars = 0;
  for (const k of keys) chars += k.length + (kino.storage.get(k) || "").length;
  const health = readHealth();
  const line = SOURCES.map((s) => {
    const h = health[s.id];
    const state = kino.config.get("src_" + s.id) === false ? "healthOff" : !h ? "healthNone" : h.ok ? "healthOk" : "healthFail";
    return `${s.label} ${t(state)}`;
  }).join(" \xB7 ");
  return { cache: t("cacheStatus", { n: keys.length, kb: Math.ceil(chars / 1024) }), health: line.slice(0, 200) };
}
async function action(key) {
  if (key === "clearCache") {
    for (const k of cacheKeys()) kino.storage.remove(k);
    return { message: t("cacheCleared") };
  }
  if (key === "probe") {
    const sources = enabledSources();
    const results = await mapLimit(sources, 4, async (src) => {
      try {
        await getJson(onAirUrl(src), LIST_TIMEOUT_MS);
        recordHealth(src.id, true);
        return true;
      } catch {
        recordHealth(src.id, false);
        return false;
      }
    });
    return { message: t("probeDone", { ok: results.filter(Boolean).length, n: sources.length }) };
  }
  throw kino.error("not_found", "unknown action " + String(key).slice(0, 40));
}
async function validateSettings(values) {
  const on = SOURCES.some((s) => !values || values["src_" + s.id] !== false);
  return on ? null : { src_animeav1: t("noSources") };
}
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  resolve,
  screen,
  screenEvent,
  search,
  section,
  settingsStatus,
  validateSettings
};

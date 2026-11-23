// src/std/model.js
var MAX_SLIDES = 5;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  if (item.poster && HTTPS.test(item.poster)) out.poster = item.poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.badges) out.badges = item.badges;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.lang) out.lang = item.lang;
  if (item.adult === true) out.adult = true;
  return out;
}
var slidesOf = (rows) => pickSlides(rows, (item) => item.backdrop);
var posterSlidesOf = (rows) => pickSlides(rows, (item) => item.poster);
function slideText(overview, item = {}) {
  const text = typeof overview === "string" ? overview.trim() : "";
  if (text === "") return [item.year, item.rating ? "\u2605 " + item.rating : null].filter(Boolean).join(" \xB7 ");
  return text.length <= MAX_SLIDE_TEXT ? text : `${text.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`;
}
function pickSlides(rows, pictureOf) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items || []) {
      if (out.length >= MAX_SLIDES) return out;
      const image = pictureOf(item);
      if (item.adult === true || seen.has(item.id) || !image || !HTTPS.test(image)) continue;
      seen.add(item.id);
      out.push({ id: item.id, ref: item.ref, kind: item.kind, title: item.title, image, text: slideText(item.overview, item) });
    }
  }
  return out;
}
var uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
function railsOf(rows) {
  return rows.filter((r) => !r.hidden && r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.titleEn ? { titleEn: r.titleEn } : {},
    ...r.ref ? { ref: r.ref } : {},
    items: uniform(r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf))
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), posterSlides: posterSlidesOf(rows), rails };
}
function playedKey(ref) {
  const m = /^(?:m|s|e):(\d{1,10})(?::|$)/.exec(String(ref || ""));
  return m ? `t:${m[1]}` : String(ref || "");
}
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) {
    for (const rail2 of data.rails) {
      for (const card of rail2.items) {
        const ks = [card.ref];
        if (card.ids && card.ids.tmdb) ks.push(`t:${card.ids.tmdb}`);
        for (const k of ks) if (!byKey.has(k)) byKey.set(k, card);
      }
    }
  }
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

// src/std/strings.js
var WORDS = {
  watch: ["Ver", "Watch"],
  info: ["M\xE1s informaci\xF3n", "More info"],
  recent: ["Continuar viendo", "Continue watching"],
  search: ["Buscar", "Search"],
  searchHint: ["Buscar en {name}", "Search {name}"],
  failed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  retry: ["Reintentar", "Retry"],
  empty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  back: ["Atr\xE1s", "Back"],
  close: ["Cerrar", "Close"],
  settings: ["Ajustes", "Settings"],
  supportTv: ["Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", "If you like my work, scan it and support me"],
  support: ["Si te gusta mi trabajo, ap\xF3yame", "If you like my work, support me"],
  gateTitle: ["Necesitas el motor de reproducci\xF3n", "You need the playback engine"],
  gateText: [
    "{name} reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.",
    "{name} plays through Kino Resolver (free). Install it once and it works here and in other site plugins."
  ],
  gateInstall: ["Instalar Kino Resolver", "Install Kino Resolver"]
};
var fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? String(vars[k]) : m);
function twin(key, field = "text", vars) {
  const [es, en] = WORDS[key];
  const pick = (i) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, Array.isArray(v) ? v[i] : v]));
  return { [field]: fill(es, pick(0)), [field + "En"]: fill(en, pick(1)) };
}
var STRING_KEYS = Object.keys(WORDS);

// src/std/view.js
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var POLL_MS = 1500;
function brand(cfg) {
  return {
    type: "Row",
    key: "brand",
    gap: 12,
    crossAxisAlignment: "center",
    children: [
      ...cfg.logo ? [{ type: "Image", key: "logo", url: cfg.logo, aspect: cfg.logoAspect || "1:1", fit: "contain", h: 32, alt: cfg.name, altEn: cfg.nameEn || cfg.name }] : [],
      { type: "Text", key: "name", style: "h4", text: cfg.name, textEn: cfg.nameEn || cfg.name }
    ]
  };
}
var tabBar = (tabs, active) => ({
  type: "TabBar",
  key: "tabs",
  divider: false,
  value: active,
  onChanged: "tab",
  tabs: tabs.map((t2) => ({ value: t2.id, label: t2.label, labelEn: t2.labelEn || t2.label }))
});
var iconButton = (key, icon, word, onPressed) => ({ type: "IconButton", key, icon, ...twin(word, "labelText"), ...twin(word, "tooltip"), onPressed });
var searchOpenOps = (tabsInBar) => [
  { hide: "brand" },
  { hide: "searchButton" },
  { hide: "settingsButton" },
  ...tabsInBar ? [{ hide: "tabs" }] : [],
  { show: "closeSearch" },
  { show: "q" },
  { focus: "q" }
];
var searchClosedOps = (tabsInBar) => [
  { hide: "closeSearch" },
  { hide: "q" },
  { clear: "q" },
  { show: "brand" },
  { show: "searchButton" },
  { show: "settingsButton" },
  ...tabsInBar ? [{ show: "tabs" }] : []
];
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", key: "donate", value: SUPPORT_URL, size: "large", ...twin("supportTv", "labelText") };
  return { type: "ElevatedButton", key: "donate", icon: "heart", ...twin("support", "labelText"), onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
var bar = ({ leading, title, actions = [] }) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading, title, actions });
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
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var titleOf = (s) => ({ ref: s.ref, kind: s.kind, id: s.id, title: s.title });
var withHeaders = (headers) => headers ? { headers } : {};
var slideNode = (s, headers) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  ...withHeaders(headers),
  buttons: [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("watch", "labelText"), icon: "play", onPressed: { go: { play: titleOf(s) } } },
    { type: "TextButton", key: "info-" + s.id, ...twin("info", "labelText"), onPressed: { go: { title: titleOf(s) } } }
  ]
});
var hero = (slides, headers) => slides.length === 1 ? slideNode(slides[0], headers) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map((s) => slideNode(s, headers))
};
var rail = (r, key, words, headers) => ({
  type: "titleRail",
  key,
  ...words || { title: r.title, titleEn: r.titleEn || r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  ...withHeaders(headers)
});
function browseView(cfg, { tab, data, recent, pending, failed, searching = false, device = "phone" }) {
  const tv = device === "tv";
  const tabs = cfg.tabs;
  const active = tabs.some((t2) => t2.id === tab) ? tab : tabs[0].id;
  const withTabs = tabs.length > 1;
  const body = [];
  if (data) {
    const h = cfg.imageHeaders;
    if (data.slides.length > 0) body.push(hero(data.slides, h));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("recent", "title"), h));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, h));
    if (data.rails.length === 0) body.push({ type: "Text", key: "empty", ...twin("empty"), color: "muted" });
  } else if (failed) {
    body.push({ type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("failed"), action: { ...twin("retry", "label"), onTap: "retry" } });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  const isBanner = (n) => !!n && (n.type === "heroCard" || n.key === "heroSkeleton" || n.type === "PageView" && String(n.key).startsWith("hero"));
  const banner = body.length > 0 && isBanner(body[0]) ? body.shift() : null;
  const tabsInBar = tv && withTabs;
  const appBar = bar({
    leading: iconButton("close", "close", "close", { go: { close: true } }),
    title: { type: "Row", key: "titleRow", gap: tabsInBar ? 24 : 8, crossAxisAlignment: "center", children: [
      { ...iconButton("closeSearch", "arrow_back", "back", { ui: searchClosedOps(tabsInBar), event: "searchClosed" }), hidden: true },
      brand(cfg),
      ...tabsInBar ? [tabBar(tabs, active)] : [],
      {
        type: "TextField",
        key: "q",
        hidden: true,
        flex: 1,
        kind: "search",
        maxLength: 200,
        ...twin("searchHint", "hintText", { name: [cfg.name, cfg.nameEn || cfg.name] }),
        onSubmitted: "search",
        trailingIcon: "search",
        ...twin("search", "trailingLabel"),
        onTrailingTap: "search"
      }
    ] },
    actions: [
      iconButton("searchButton", "search", "search", { ui: searchOpenOps(tabsInBar), event: "searchOpened" }),
      iconButton("settingsButton", "settings", "settings", "openSettings")
    ]
  });
  return {
    type: "Scaffold",
    ...searching ? { onBack: { ui: searchClosedOps(tabsInBar), event: "searchClosed" } } : {},
    appBar,
    body: { type: "Column", key: "page", children: [
      ...withTabs && !tv ? [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(tabs, active)] }] : [],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [...banner ? [banner] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function settingsView(cfg, device = "phone") {
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: brand(cfg) }),
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [
      ...cfg.hasSettings ? [{ type: "settings", key: "form" }, { type: "Divider", key: "supportDivider" }] : [],
      supportNode(device)
    ] }] }
  };
}
function gateView(cfg, device = "phone") {
  const name = [cfg.name, cfg.nameEn || cfg.name];
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("close", "close", "close", { go: { close: true } }), title: brand(cfg) }),
    body: { type: "Column", key: "gate", mainAxisAlignment: "center", crossAxisAlignment: "center", padding: 24, gap: 16, children: [
      { type: "Text", key: "gateTitle", style: "h3", ...twin("gateTitle") },
      { type: "Text", key: "gateText", style: "p", ...twin("gateText", "text", { name }) },
      { type: "ElevatedButton", key: "installResolver", ...twin("gateInstall", "labelText"), onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
      supportNode(device)
    ] }
  };
}

// src/std/metaCache.js
var KEY = "meta3";
var MAX = 160;
var CONCURRENCY = 3;
var OVERVIEW_MAX = 160;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, titleOf: titleOf2 = (c) => c.title, typeOf = (c) => c.kind === "series" ? "series" : "movie", tmdbPictures = false, clock = { now: () => Date.now() } }) {
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
      ...e.p && HTTPS2.test(e.p) ? { poster: e.p } : {},
      ...e.b && HTTPS2.test(e.b) ? { backdrop: e.b } : {},
      ...typeof e.o === "string" && e.o ? { overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const poster = tmdbPictures && k.poster ? k.poster : null;
      if (!k.tmdb && !poster) return c;
      return { ...c, ...k.tmdb && !(c.ids && c.ids.tmdb) ? { ids: { ...c.ids || {}, tmdb: k.tmdb } } : {}, ...poster ? { poster } : {} };
    });
  }
  async function fill2(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let count = 0;
    let stop = false;
    const seen = /* @__PURE__ */ new Set();
    const todo = cards.filter((c) => {
      if (!c || typeof c.id !== "string" || seen.has(c.id) || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) return false;
      seen.add(c.id);
      return true;
    });
    let next = 0;
    const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
    const worker = async () => {
      while (!stop && next < todo.length && clock.now() < end) {
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: typeOf(c), title: titleOf2(c), ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: str(a && a.logo, 2048),
            p: str(a && a.poster, 2048),
            b: str(a && a.backdrop, 2048),
            o: str(a && a.overview, OVERVIEW_MAX)
          };
          count++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (count > 0) write();
    return count;
  }
  return { known, asked, dress, fill: fill2, usable, tmdbPictures };
}

// src/std/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 7 * 24 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var SNAPS_TOTAL = 96 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var Q_MAX = 200;
var META_TICK_MS = 3e3;
var META_TICK_CARDS = 24;
var INFLIGHT_KEY = "std:inflight";
var INFLIGHT_STALE_MS = 18e3;
var MAX_META_TICKS = 10;
var DEFAULT_TABS = [{ id: "inicio", label: "Inicio", labelEn: "Home" }];
function makeStandardScreen({ kino: kino2, name, nameEn, logo = null, logoAspect = "1:1", needsResolver, hasSettings, tabs, loadTab, homeKey = null, titleOf: titleOf2, typeOf, tmdbPictures = false, imageHeaders = null }) {
  const cfg = { name, nameEn, logo, logoAspect, imageHeaders, hasSettings: !!hasSettings, tabs: Array.isArray(tabs) && tabs.length > 0 ? tabs : DEFAULT_TABS };
  const TAB_IDS = cfg.tabs.map((t2) => t2.id);
  const meta = makeMetaCache({ kino: kino2, titleOf: titleOf2, typeOf, tmdbPictures });
  function slidesFromMeta(rails) {
    const out = [];
    for (const r of rails) {
      for (const c of r.items) {
        if (out.length >= MAX_SLIDES) return out;
        const k = meta.known(c.id);
        if (!k.backdrop || c.adult === true || out.some((x) => x.id === c.id)) continue;
        out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: slideText(k.overview, c), ...k.logo ? { logo: k.logo } : {} });
      }
    }
    return out;
  }
  const enrich = (data) => {
    if (!data) return data;
    const own = data.slides.map((s) => {
      const k = meta.known(s.id);
      const image = tmdbPictures && k.backdrop ? k.backdrop : null;
      return k.logo || image ? { ...s, ...k.logo ? { logo: k.logo } : {}, ...image ? { image } : {} } : s;
    });
    const learned = own.length > 0 ? [] : slidesFromMeta(data.rails);
    return {
      // The site's own backdrops, else TMDB's, else the posters: every plugin has a hero.
      slides: own.length > 0 ? own : learned.length > 0 ? learned : data.posterSlides || [],
      rails: data.rails.map((r) => ({ ...r, items: meta.dress(r.items) }))
    };
  };
  const metaTicks = /* @__PURE__ */ new Map();
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[std]", ...a);
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
  const snapMax = Math.min(SNAP_MAX, Math.floor(SNAPS_TOTAL / TAB_IDS.length));
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim = { slides: data.slides, posterSlides: data.posterSlides || [], rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text = JSON.stringify({ at: Date.now(), data: slim });
      if (text.length <= snapMax) {
        set(SNAP_PREFIX + tab, text, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  function homeSeed(tab) {
    if (!homeKey || tab !== TAB_IDS[0]) return null;
    try {
      const o = JSON.parse(get(homeKey) || "null");
      return o && Array.isArray(o.rows) && o.rows.length ? tabOf({ rows: o.rows }) : null;
    } catch (_) {
      return null;
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab) || homeSeed(tab);
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
      if (key === "" || key.startsWith("x|")) return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab) {
    return memo.get(tab) && memo.get(tab).whole ? [] : [tab];
  }
  function screen2(ctx) {
    const c = ctx || {};
    const device = c.device || "phone";
    if (needsResolver && !(c.installed && c.installed[RESOLVER_REPO])) return gateView(cfg, device);
    if (c.route && c.route.name === "settings") return settingsView(cfg, device);
    const st = c.state && typeof c.state === "object" ? c.state : {};
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(c.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    const searching = st.searching === true;
    return browseView(cfg, { tab, data, recent: meta.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), searching, device });
  }
  function cutShort() {
    try {
      const o = JSON.parse(get(INFLIGHT_KEY) || "null");
      if (!o || typeof o.tab !== "string") return null;
      if (Date.now() - Number(o.at) < INFLIGHT_STALE_MS) return null;
      kino2.storage.remove(INFLIGHT_KEY);
      return o.tab;
    } catch (_) {
      return null;
    }
  }
  async function load(tab) {
    set(INFLIGHT_KEY, JSON.stringify({ tab, at: Date.now() }));
    let page;
    try {
      page = await loadTab(tab);
    } finally {
      try {
        kino2.storage.remove(INFLIGHT_KEY);
      } catch (_) {
      }
    }
    const data = tabOf(page);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const events = {
    open({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      set(TAB_KEY, tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      return { state: { failed: null, pending: [tab] } };
    },
    async tick({ state }) {
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tab = next.slice(5);
        const m = memo.get(tab);
        if (!m) return { state: { pending: rest } };
        const ask = (x) => ({ id: x.id, title: x.title, kind: x.kind, ...x.year !== void 0 ? { year: x.year } : {} });
        const noOwnSlides = m.data.slides.length === 0;
        const cards = [...m.data.slides.map(ask), ...m.data.rails.flatMap((r) => r.items.slice(0, noOwnSlides ? MAX_SLIDES * 3 : 6).map(ask))].filter((c) => !meta.asked(c.id)).slice(0, META_TICK_CARDS);
        const count = await meta.fill(cards, META_TICK_MS);
        const ticks = (metaTicks.get(tab) || 0) + 1;
        metaTicks.set(tab, ticks);
        const again = noOwnSlides && count > 0 && ticks < MAX_META_TICKS && slidesFromMeta(m.data.rails).length < MAX_SLIDES && cards.some((c) => !meta.asked(c.id));
        return { state: { pending: again ? [next, ...rest] : rest } };
      }
      if (cutShort() === next) {
        log("tab", next, "cut short by Kino last time");
        failed[next] = true;
        return { state: { pending: rest, failed } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The words go to Kino's own search, with this plugin as the source; the bar is put back as it was, locally.
    // The search button's own event (after its local ops): while searching, the tree declares onBack, so Back closes the box.
    searchOpened() {
      return { state: { searching: true } };
    },
    // The box was closed (its arrow, or Back through onBack, already ran the local ops): the flag and the ops go, so the next
    // tree declares no onBack and draws the bar's defaults.
    searchClosed() {
      return { state: { searching: false, ui: null } };
    },
    search({ value, state, device }) {
      const typed = value && typeof value === "object" ? value.q : value;
      const raw = typed != null && String(typed).trim() !== "" ? typed : state.inputs && state.inputs.q;
      const q = String(raw == null ? "" : raw).trim().slice(0, Q_MAX);
      if (!q) return null;
      return { go: { search: { q } }, ui: searchClosedOps(device === "tv" && TAB_IDS.length > 1), state: { searching: false, ui: null } };
    },
    openSettings() {
      return { route: { push: "settings" }, state: { fromBrowse: true } };
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { fromBrowse: false } };
    }
  };
  async function screenEvent2(ev) {
    const e = ev || {};
    const name2 = e.name != null ? e.name : e.event;
    const handler = typeof name2 === "string" && Object.hasOwn(events, name2) ? events[name2] : null;
    return handler ? await handler({ ...e, state: e.state || {} }) ?? null : null;
  }
  return { screen: screen2, screenEvent: screenEvent2, notePlayed };
}

// src/logo.js
var LOGO = "data:image/png;base64,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";
var LOGO_ASPECT = "1:1";

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
var BASE = "https://pigamer37.alwaysdata.net/onAirCatalogs=animeav1%2Chenaojara%2Ctioanime%2Clatanime";
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
  { id: "latanime", label: "Latanime", type: "Latanime" }
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
    const items = (await onAirItems(src)).slice(0, 60);
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
var std = null;
var standard = () => std ?? (std = makeStandardScreen({
  kino,
  name: "AnimES",
  logo: LOGO,
  logoAspect: LOGO_ASPECT,
  needsResolver: false,
  hasSettings: true,
  tabs: [
    { id: "inicio", label: "Inicio", labelEn: "Home" },
    { id: "generos", label: "G\xE9neros", labelEn: "Genres" }
  ],
  loadTab: (tab) => tabPage(tab),
  // TMDB is asked for the name without "(2023)", "(Season 1)" and the like.
  titleOf: (c) => String(c.title).replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+/g, " ").trim() || String(c.title)
}));
async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
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
async function viaResolver(embedUrl) {
  let res = null;
  try {
    res = await kino.plugins.call("resolver", "resolve", { url: embedUrl });
  } catch {
  }
  const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
  if (!s) {
    kino.log.report("voe_failed", "no_source");
    throw kino.error("unavailable", "Voe gave no playlist", { userMessage: t("copyFailed") });
  }
  const headers = {};
  if (s.referer) headers.Referer = s.referer;
  if (Array.isArray(s.headers)) {
    for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value);
  }
  const out = { url: s.url, mime: /\.mp4(\?|$)/.test(s.url) ? "video/mp4" : "application/x-mpegURL", expiresInSeconds: 3600 };
  if (Object.keys(headers).length) out.headers = headers;
  return out;
}
async function voeStream(embedUrl) {
  if (!VOE_EMBED.test(String(embedUrl))) throw kino.error("not_found", "not a Voe embed: " + String(embedUrl).slice(0, 80));
  return viaResolver(embedUrl);
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
  const m = /^(?:animeav1|henaojara|tioanime|latanime|jkanime):(.+):(\d{1,5})$/.exec(String(videoId || ""));
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
    standard().notePlayed(ref);
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

// @ts-check
/// <reference path="./kino.d.ts" />
// Kino plugin: AnimES -- anime in Spanish from AnimeAV1, Henaojara, TioAnime and JKAnime.
// Talks to one backend (pigamer37.alwaysdata.net, the AnimES Stremio addon); what it returns is mapped to Kino's items,
// episodes and streams. Read it top to bottom:
//   1. constants   2. texts   3. cache   4. addon client   5. sources and ids   6. items   7. search
//   8. home and browse   9. section and categories   10. episodes and details   11. resolve   12. settings
// Declared host: pigamer37.alwaysdata.net (kino.fetch). The video itself is on other servers (vidcache.net, mp4upload.com...):
// that is the manifest's `streamHosts: "any"`, which the person approves at install.

const BASE = "https://pigamer37.alwaysdata.net/onAirCatalogs=animeav1%2Chenaojara%2Ctioanime%2Cjkanime";
const GENRE_PAGE = 20;
// A source that answers slower than this is left out of the answer, never holding the others back.
const LIST_TIMEOUT_MS = 8000;
// resolve has 20 s in all: two tries of 8 s and a short pause.
const RESOLVE_TIMEOUT_MS = 8000;
// With the site's own HLS copy in hand the addon only adds alternatives, so its first try gets this long and no more
// (the host waits for every request in flight, so a request left behind would still hold the answer back).
const ADDON_FAST_MS = 2500;
// A source's title that has no AnimeAV1 page under its own slug is looked up by name once, then remembered.
const TWIN_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
// The HLS copy hangs on a Cloudflare rule outside our control: one probe of its first segment, remembered for a while.
const HLS_HEALTH_KEY = "hlsHealth";
const HLS_HEALTH_OK_MS = 10 * 60 * 1000;
const HLS_HEALTH_BAD_MS = 3 * 60 * 1000;

// ---- 1. texts -------------------------------------------------------------------------------------------------

// Every text the person reads, in Spanish and English: Kino does not translate a plugin's texts. kino.lang is the person's
// language ("es-CO"); anything that is not Spanish reads English.
const TEXTS = {
  es: {
    unavailable: "El servicio de anime no responde ahora. Intenta de nuevo en un rato.",
    noStreams: "Este episodio no tiene video disponible por ahora. Prueba otro o vuelve más tarde.",
    noSources: "Activa al menos una fuente de anime.",
    rowOnAir: "{name} — En emisión",
    sectionHero: "Anime en emisión ahora.",
    copyFailed: "Esta copia no se pudo abrir ahora. Prueba otro servidor del menú.",
    sub: "Subtitulado", dub: "Doblado",
    cacheStatus: "Caché: {n} entradas, {kb} KB", cacheCleared: "Listo: se vació la caché",
    healthOk: "ok", healthFail: "falla", healthNone: "sin datos", healthOff: "apagada",
    probeDone: "Listo: {ok} de {n} fuentes responden",
    genre_accion: "Acción", genre_aventura: "Aventura", genre_comedia: "Comedia", genre_drama: "Drama",
    genre_fantasia: "Fantasía", genre_romance: "Romance", genre_ciencia_ficcion: "Ciencia ficción",
    genre_misterio: "Misterio", genre_terror: "Terror", genre_mecha: "Mecha", genre_magia: "Magia",
    genre_shounen: "Shounen", genre_shoujo: "Shoujo", genre_seinen: "Seinen", genre_josei: "Josei",
    genre_sobrenatural: "Sobrenatural", genre_deportes: "Deportes", genre_historico: "Histórico",
    genre_psicologico: "Psicológico", genre_isekai: "Isekai",
  },
  en: {
    unavailable: "The anime service isn't responding right now. Try again in a while.",
    noStreams: "This episode has no video available right now. Try another or come back later.",
    noSources: "Turn on at least one anime source.",
    rowOnAir: "{name} — On Air",
    sectionHero: "Anime airing now.",
    copyFailed: "This copy could not be opened right now. Try another server from the menu.",
    sub: "Subtitled", dub: "Dubbed",
    cacheStatus: "Cache: {n} entries, {kb} KB", cacheCleared: "Done: the cache is empty",
    healthOk: "ok", healthFail: "failing", healthNone: "no data", healthOff: "off",
    probeDone: "Done: {ok} of {n} sources answer",
    genre_accion: "Action", genre_aventura: "Adventure", genre_comedia: "Comedy", genre_drama: "Drama",
    genre_fantasia: "Fantasy", genre_romance: "Romance", genre_ciencia_ficcion: "Sci-Fi",
    genre_misterio: "Mystery", genre_terror: "Horror", genre_mecha: "Mecha", genre_magia: "Magic",
    genre_shounen: "Shounen", genre_shoujo: "Shoujo", genre_seinen: "Seinen", genre_josei: "Josei",
    genre_sobrenatural: "Supernatural", genre_deportes: "Sports", genre_historico: "Historical",
    genre_psicologico: "Psychological", genre_isekai: "Isekai",
  },
};

function t(key, vars) {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  const template = TEXTS[lang][key] || TEXTS.es[key] || key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] != null ? vars[k] : "")) : template;
}

// ---- 2. cache -------------------------------------------------------------------------------------------------

// kino.storage keeps 256 KB in all. Every entry is `{ at, v }` and lives HARD_TTL_MS; it is "fresh" for the window the
// caller gives. A fresh entry answers without the network; an expired-but-kept one is the fallback when the backend fails
// (a list that is a little old beats an empty screen). Versioned: a release that changes what is cached bumps it.
const CACHE_PREFIX = "c2:";
const HARD_TTL_MS = 24 * 60 * 60 * 1000;
const ENTRY_MAX_CHARS = 48 * 1024;
const FRESH_ON_AIR_MS = 15 * 60 * 1000;
const FRESH_META_MS = 60 * 60 * 1000;
const FRESH_GENRE_MS = 30 * 60 * 1000;
const FRESH_ART_MS = 12 * 60 * 60 * 1000;

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
      // unreadable: the first to go
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

// A cache never fails the call it serves: whatever storage refuses is simply not cached.
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

// The value for `key`: fresh from the cache, else from `load()` (and cached), else (load failed) the stale copy.
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

// ---- 3. addon client ------------------------------------------------------------------------------------------

async function getJson(url, timeoutMs) {
  const r = await kino.fetch(url, { timeoutMs: timeoutMs || 15000 });
  if (!r.ok) throw kino.error("unavailable", "AnimES backend answered " + r.status, { userMessage: t("unavailable") });
  try {
    return await r.json();
  } catch {
    throw kino.error("unavailable", "AnimES backend answered something that is not JSON", { userMessage: t("unavailable") });
  }
}

const enc = encodeURIComponent;

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

// Kino allows 6 fetches in flight per plugin: never start more than `limit` at once.
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

// ---- 3b. source health ----------------------------------------------------------------------------------------

// kino.storage key `health` keeps { <sourceId>: { ok, fails, at } } (fails = failed runs in a row). A source that fails
// three runs in a row is reported once (the third failure only) to the author's board; an ok run resets the count.
const HEALTH_KEY = "health";
const DOWN_AFTER = 3;

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
    // a full storage: the next run records again
  }
}

// ---- 4. sources and ids ---------------------------------------------------------------------------------------

// `type` is the catalog type the addon's manifest gives each source.
const SOURCES = [
  { id: "animeav1", label: "AnimeAV1", type: "AnimeAV1" },
  { id: "henaojara", label: "Henaojara", type: "Henaojara" },
  { id: "tioanime", label: "TioAnime", type: "TioAnime" },
  { id: "jkanime", label: "JKAnime", type: "JKAnime" },
];

// Genres every source has (the addon's manifest lists them per source; these are the common ones).
const GENRES = [
  "accion", "aventura", "comedia", "drama", "fantasia", "romance", "ciencia-ficcion", "misterio", "terror", "mecha",
  "magia", "shounen", "shoujo", "seinen", "josei", "sobrenatural", "deportes", "historico", "psicologico",
];

function enabledSources() {
  return SOURCES.filter((s) => kino.config.get("src_" + s.id) !== false);
}

function sourceById(id) {
  return SOURCES.find((s) => s.id === id) || null;
}

const MAX_ID = 128;

// A Kino item id (^[A-Za-z0-9._~-]{1,128}$, stable: the library keys the title by it) from the addon's "source:slug".
// A long slug is cut and ends in a hash of the whole, so two long titles that share a start never share an id.
function kinoId(stremioId) {
  const clean = String(stremioId || "").replace(/:/g, "~").replace(/[^A-Za-z0-9._~-]/g, "-") || "unknown";
  if (clean.length <= MAX_ID) return clean;
  return clean.slice(0, MAX_ID - 9) + "-" + kino.crypto.hash("sha1", String(stremioId)).slice(0, 8);
}

// ---- 5. items -------------------------------------------------------------------------------------------------

// The addon's own `type` is not trusted: measured, TioAnime lists its airing SERIES as "movie" (their meta holds the
// episodes), and a film can come as "series". A title is a film to Kino only when its slug says so ("...-movie-3",
// "...-the-movie", "pelicula", "film"); anything else is a series, and a film without those words is a series of one
// episode, which plays the same.
const FILM_SLUG = /(^|[-:])(movie|pelicula|film|gekijouban)(-|$)/;

function kindOf(id) {
  return FILM_SLUG.test(String(id || "").toLowerCase()) ? "movie" : "series";
}

// A series item's ref is "i:<type>:<addon id>" (it goes to episodes); a film item's is "m:<addon id>" (Kino sends a movie's
// ref straight to resolve and to details, never to episodes); an episode's is "e:<type>:<addon video id>". The addon's ids
// hold ":" themselves, so the type is the one field cut off the front and the rest is the id as it is.
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

// Short on purpose: cards show a line or two, and the cache has 256 KB for every list.
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

// ---- 6. search ------------------------------------------------------------------------------------------------

// Every enabled source at once; one that fails or is slow is left out. Interleaved so each source shows up at the top,
// de-duplicated, then ORDERED (never filtered) by how much each title resembles what was typed: the sources know titles in
// romaji, so a Spanish or English query can legitimately share no word with a right answer.
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
  const seen = new Set();
  return merged.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
}

// scopedSearch: from a genre's "Ver más" page the person searches inside that genre, in that source (the backend's search
// takes a genre). Any other page is not ours to search: null, and Kino filters the page's loaded titles itself.
export async function search(query) {
  const scope = query.within ? /^g:([a-z0-9]+):([a-z0-9-]+)$/.exec(String(query.within)) : null;
  if (query.within && (!scope || !sourceById(scope[1]))) return null;
  const sources = scope ? [sourceById(scope[1])] : enabledSources();
  const genre = scope ? scope[2] : undefined;
  const q = kino.rank.shortQuery(String(query.q || "").trim());
  if (!sources.length || !q) return [];
  const titles = [query.q, query.originalTitle].concat(Array.isArray(query.altTitles) ? query.altTitles : []).filter((x) => typeof x === "string" && x.trim());
  let found = await searchAll(sources, q, genre);
  // The typed (or TMDB's) title may be one these sources do not use: one more round with the first other title.
  if (!found.length) {
    const other = titles.map((x) => kino.rank.shortQuery(x.trim())).find((x) => x && x.toLowerCase() !== q.toLowerCase());
    if (other) found = await searchAll(sources, other, genre);
  }
  return kino.rank.sortBySimilarity(found, titles);
}

// ---- 7. home and browse ---------------------------------------------------------------------------------------

// One source's airing list: cached, and a row nobody could fetch is null, never taking the other rows with it.
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

export async function home() {
  if (kino.config.get("homeRows") === false) return [];
  return (await mapLimit(enabledSources(), 4, onAirRow)).filter(Boolean);
}

// A genre's page. The first page is cached; later ones are asked for as the person scrolls.
export async function browse(ref, cursor) {
  const skip = Math.max(0, parseInt(cursor || "0", 10) || 0);
  const m = /^g:([a-z0-9]+):([a-z0-9-]+)$/.exec(String(ref || ""));
  const src = m && sourceById(m[1]);
  if (!m || !src) throw kino.error("not_found", "unknown browse ref: " + String(ref).slice(0, 60));
  const load = async () => itemsOf(await getJson(genreUrl(src, m[2], skip), 15000));
  const items = skip === 0 ? await cached(`genre:${src.id}:${m[2]}`, FRESH_GENRE_MS, load) : await load();
  return items.length >= GENRE_PAGE ? { items, next: String(skip + GENRE_PAGE) } : { items };
}

// ---- 8. section and categories --------------------------------------------------------------------------------

// The plugin's own section (a chip on the phone's Inicio, an entry in the TV's sidebar): one tab per enabled source.
export async function section({ tab }) {
  const sources = enabledSources();
  if (!sources.length) return { tabs: [], tab: "", rows: [] };
  const tabs = sources.map((s) => ({ id: s.id, label: s.label }));
  const chosen = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  const row = await onAirRow(sourceById(chosen));
  const rows = row ? [row] : [];
  const answer = { tabs, tab: chosen, rows };
  if (row) {
    // Today's pick: the same all day, a different one tomorrow.
    const pick = row.items[Math.floor(Date.now() / 86400000) % row.items.length];
    answer.hero = { title: pick.title, text: t("sectionHero") };
    if (pick.poster) answer.hero.image = pick.poster;
  }
  return answer;
}

// Genre tiles. The art of each is its first title's poster, cached 12 h per genre: the first opening asks for it (six at a
// time), every later one answers from storage without a request. A genre that cannot be asked is still a tile, without art.
export async function categories() {
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

// ---- 9. episodes and details ----------------------------------------------------------------------------------

// What the cache keeps of a title's meta: only what episodes() and details() read, so a 220-episode series fits.
async function metaOf(type, id) {
  return cached(`meta:${type}:${id}`, FRESH_META_MS, async () => {
    const meta = (await getJson(metaUrl(type, id))).meta;
    if (!meta) throw kino.error("not_found", "the backend has no title " + String(id).slice(0, 80));
    const year = /^(\d{4})/.exec(String(meta.releaseInfo || meta.released || ""));
    return {
      title: String(meta.name || ""),
      poster: meta.poster || "",
      backdrop: meta.background || "",
      overview: String(meta.description || "").slice(0, 2000),
      genres: Array.isArray(meta.genres) ? meta.genres.slice(0, 5).map((g) => String(g).slice(0, 30)) : [],
      year: year ? year[1] : "",
      // [season, number, video id, thumbnail, air date]
      videos: (Array.isArray(meta.videos) ? meta.videos : [])
        .filter((v) => v && v.id && v.available !== false)
        .map((v) => [
          Math.max(1, parseInt(v.season, 10) || 1),
          Math.max(1, parseInt(v.number || v.episode, 10) || 1),
          String(v.id),
          v.thumbnail || "",
          String(v.released || "").slice(0, 10),
        ]),
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

// A source lists its episodes newest first (Henaojara's start at 220): always season, then number, ascending.
export async function episodes(ref) {
  const r = parseRef("i:", ref);
  if (!r) throw kino.error("not_found", "not an item ref: " + String(ref).slice(0, 80));
  const meta = await metaOf(r.type, r.id);
  if (!meta.videos.length) throw kino.error("not_found", "no episodes for " + r.id.slice(0, 80), { userMessage: t("noStreams") });
  const list = meta.videos.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const seen = new Set();
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

// A film's title page (apiVersion 8): the same cached meta, no second request.
export async function details(ref) {
  const movie = movieIdOf(ref);
  const r = movie ? { type: "movie", id: movie } : parseRef("i:", ref);
  if (!r) return null;
  return seriesInfo(await metaOf(r.type, r.id));
}

// ---- 10. resolve ----------------------------------------------------------------------------------------------

function serverOf(name) {
  // "AnimeAV1\nYourUpload\n..." -- the first line is the source, the second the video server.
  const lines = String(name || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines[1] || lines[0] || "").replace(/[^\p{L}\p{N} ._+-]/gu, "").trim().slice(0, 24);
}

// The addon marks a dubbed stream with "DUB" in its name or description; every other one is the original audio, subtitled.
function isDub(s) {
  return /dub/i.test(String(s.name || "") + " " + String(s.description || ""));
}

function mimeOf(url) {
  const path = String(url).split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".m3u8")) return "application/x-mpegURL";
  if (path.endsWith(".mp4")) return "video/mp4";
  return undefined;
}

// The addon's proxyHeaders.request: only Referer is sent (the player sets its own User-Agent).
function headersOf(stream) {
  const req = stream.behaviorHints && stream.behaviorHints.proxyHeaders && stream.behaviorHints.proxyHeaders.request;
  return req && typeof req.Referer === "string" && req.Referer ? { Referer: req.Referer } : undefined;
}

function toStream(s) {
  const dub = isDub(s);
  const out = { url: s.url };
  const server = serverOf(s.name);
  out.label = (server ? server + " · " : "") + t(dub ? "dub" : "sub");
  const headers = headersOf(s);
  if (headers) out.headers = headers;
  const mime = mimeOf(s.url);
  if (mime) out.mime = mime;
  return { dub, stream: out };
}

// HLS copies (AnimeAV1's own player). The addon only hands out MP4Upload, which throttles per node, while the site itself
// also lists an HLS server (player.zilla-networks.com) that measured 35-43 Mbit/s. The copy is found by reading the episode
// page (kino.fetch). Its playlist `/m3u8/<id>` answers a plain request; its segments answer 403 (a Cloudflare rule) unless the
// request carries `Sec-Fetch-Site: same-origin`, so the stream is the playlist plus that header: no hidden page involved.
const SITE = "https://animeav1.com";
const HLS_PLAYER = /^https:\/\/player\.zilla-networks\.com\/play\/([a-f0-9]{16,64})$/;

// What AnimeAV1's page of the episode `slug`/`number` lists that is worth a copy: { hls: [{ dub, id }], voe: [{ dub, url }] },
// one of each per language that lists the server. Never throws.
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

// TioAnime lists its own servers in the episode page (`var videos = [["Voe","https://voe.sx/e/<id>",0,0],...]`):
// the only way to a Voe copy for a title AnimeAV1 does not have. Never throws.
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

// ---- Voe
// The embed page redirects (by script) to a mirror whose page carries the player's data as a JSON array of one
// obfuscated string: ROT13, junk markers removed, base64, every character shifted by 3, reversed, base64 again.
const VOE_EMBED = /^https:\/\/[a-z0-9.-]+\/e\/[A-Za-z0-9]{6,40}$/;
const VOE_JUNK = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];

function voeDecode(ct) {
  let t = String(ct).replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
  for (const j of VOE_JUNK) t = t.split(j).join("");
  const shifted = atob(t);
  let u = "";
  for (let i = shifted.length - 1; i >= 0; i--) u += String.fromCharCode(shifted.charCodeAt(i) - 3);
  const bin = atob(u);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Voe takes links down (about one episode in five here): a dead embed answers 404, and is not offered. Remembered an hour;
// when it cannot be told, it stays.
async function voeAlive(url) {
  try {
    return await cached("voe:" + String(url).split("/").pop(), 60 * 60 * 1000, async () => {
      const r = await kino.fetch(url, { timeoutMs: 3000 });
      return r.status !== 404 && r.status !== 410;
    });
  } catch {
    return true;
  }
}

// The playlist of a Voe copy. Its address carries a token bound to this connection's address, so it is read here, on the
// device that will play it.
async function voeStream(embedUrl) {
  if (!VOE_EMBED.test(String(embedUrl))) throw kino.error("not_found", "not a Voe embed: " + String(embedUrl).slice(0, 80));
  let url = embedUrl;
  let source = "";
  for (let hop = 0; hop < 3 && !source; hop++) {
    const r = await kino.fetch(url, { timeoutMs: RESOLVE_TIMEOUT_MS });
    if (!r.ok) break;
    const html = r.text();
    const json = /<script[^>]*type="application\/json"[^>]*>\s*(\[[\s\S]*?\])\s*<\/script>/.exec(html);
    if (json) {
      try {
        const data = voeDecode(JSON.parse(json[1])[0]);
        if (data && typeof data.source === "string" && /^https:\/\//.test(data.source)) source = data.source;
      } catch (e) {
        kino.log("voe decode failed: " + (e && e.message));
      }
      break;
    }
    const next = /location\.href\s*=\s*'(https:\/\/[^']+)'/.exec(html);
    if (!next) break;
    url = next[1];
  }
  if (!source) {
    kino.log.report("voe_failed", "no_source");
    throw kino.error("unavailable", "Voe gave no playlist", { userMessage: t("copyFailed") });
  }
  return { url: source, mime: "application/x-mpegURL", expiresInSeconds: 3600 };
}

function voeEntry(c) {
  const lang = c.dub === null ? "" : " · " + t(c.dub ? "dub" : "sub");
  return { label: ("Voe" + lang).slice(0, 40), ref: "v:" + c.url };
}

function hlsStream(c) {
  return {
    url: `https://player.zilla-networks.com/m3u8/${c.id}`,
    label: ("HLS · AnimeAV1 · " + t(c.dub ? "dub" : "sub")).slice(0, 40),
    mime: "application/x-mpegURL",
    headers: { "Sec-Fetch-Site": "same-origin" },
  };
}

// Does the HLS server still serve its segments to a request carrying our header? One cheap probe (the playlist, then a
// kilobyte of its first segment), shared by every episode. A blocked answer (403) turns the copy off for a few minutes
// and is reported; a network failure proves nothing, so it never turns the copy off.
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
    const pl = await kino.fetch(`https://player.zilla-networks.com/m3u8/${id}`, { timeoutMs: 4000 });
    status = pl.status;
    if (pl.ok) {
      const seg = /https:\/\/player\.zilla-networks\.com\/segs\/[^\s"']+/.exec(pl.text());
      if (seg) {
        const r = await kino.fetch(seg[0], { headers: { "Sec-Fetch-Site": "same-origin", Range: "bytes=0-1023" }, timeoutMs: 4000 });
        status = r.status;
        ok = r.status === 200 || r.status === 206 || (r.status !== 401 && r.status !== 403);
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
    // a full storage: the next play probes again
  }
  if (!ok) kino.log.report("hls_blocked", String(status));
  return ok;
}

// Letters and digits only, no accents: "Megami-sama" and "Megamisama" read the same.
function normTitle(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}

// The AnimeAV1 slug of a title another source lists under a slug AnimeAV1 does not use: found by name in the addon's
// AnimeAV1 catalog, accepted only on an exact match of the letters. "" when there is none (remembered too).
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

// The slug and episode number of a video id ("<source>:<slug>:<n>"). The sources share slugs for most titles, so any
// source's episode is looked up on AnimeAV1 too: a miss is just a 404 there and the episode keeps its own copies.
function animeav1Episode(videoId) {
  const m = /^(?:animeav1|henaojara|tioanime|jkanime):(.+):(\d{1,5})$/.exec(String(videoId || ""));
  return m ? { slug: m[1], number: m[2] } : null;
}

// Copies that read the same ("MP4Upload · Subtitulado" twice) are told apart in the Server menu by their node ("a1", "a3")
// when the hosts differ, else by their position ("#2"): a person whose first copy crawls needs to know which one to pick.
function tellApart(list) {
  const groups = new Map();
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
      x.stream.label = (label.includes(" · ") ? label.replace(" · ", ` ${tag} · `) : `${tag} · ${label}`).slice(0, 40);
    });
  }
}

// The backend scrapes the sites live: an empty answer is often a hiccup, so it is asked once more before giving up.
async function streamsOf(type, videoId, timeoutMs = RESOLVE_TIMEOUT_MS, attempts = 2) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const body = await getJson(streamUrl(type, videoId), timeoutMs);
    const list = Array.isArray(body.streams) ? body.streams.filter((s) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url)) : [];
    if (list.length) return list;
    if (attempt < attempts - 1) await kino.sleep(800);
  }
  return [];
}

// The person's audio preference goes first, then the fast HLS copy; the rest are the Server menu's other copies. The 30
// minutes only matter when a playback fails: Kino then asks for a fresh link.
// A film's single video is the addon's `<id>:1` (the id its meta lists too, though some films' meta lists none).
export async function resolve(ref) {
  const voe = /^v:(https:\/\/.+)$/.exec(String(ref || ""));
  if (voe) return voeStream(voe[1]);
  const movie = movieIdOf(ref);
  const r = movie ? { type: "movie", id: movie + ":1" } : parseRef("e:", ref);
  if (!r) throw kino.error("not_found", "not a playable ref: " + String(ref).slice(0, 80));
  const ep = animeav1Episode(r.id);
  // The addon failing must not take the site's own HLS down with it: its error is kept for when nothing else plays.
  // A title the site may have is asked in a fast single try, in parallel with the site; only when neither answers is
  // the addon given its full time.
  let addonError = null;
  const askAddon = (ms, tries) => streamsOf(r.type, r.id, ms, tries).then((l) => ((addonError = null), l), (e) => ((addonError = e), []));
  const addonFirst = askAddon(ep ? ADDON_FAST_MS : RESOLVE_TIMEOUT_MS, ep ? 1 : 2);
  const tioVoe = ep && /^tioanime:/.test(r.id) ? tioanimeVoe(ep.slug, ep.number) : Promise.resolve([]);
  let site = ep ? await siteCopies(ep.slug, ep.number) : { hls: [], voe: [] };
  if (ep && !site.hls.length && !/^animeav1:/.test(r.id)) {
    const twin = await twinSlug(r.type, r.id.replace(/:\d+$/, ""), ep.slug);
    if (twin && twin !== ep.slug) site = await siteCopies(twin, ep.number);
  }
  let copies = site.hls;
  if (copies.length && !(await hlsHealthy(copies[0].id))) copies = [];
  // Voe copies are lazy: nothing is fetched for them until the person picks one (or nothing else can play).
  const voeWanted = kino.config.get("voe") === false ? [] : site.voe.length ? site.voe : await tioVoe;
  const voeLive = await Promise.all(voeWanted.map((c) => voeAlive(c.url)));
  const voeCopies = voeWanted.filter((_, i) => voeLive[i]);
  let raw = await addonFirst;
  if (ep && !raw.length && !copies.length) raw = await askAddon(RESOLVE_TIMEOUT_MS, 1);
  const wantDubFirst = kino.config.get("audio") === "dub";
  const hlsOrdered = copies.slice().sort((a, b) => (a.dub === wantDubFirst ? -1 : 0) - (b.dub === wantDubFirst ? -1 : 0));
  if (!raw.length) {
    // The addon had nothing (it fails on some titles): the site's own HLS, when it lists one, is the only way to play.
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
  const seen = new Set();
  const all = raw.map(toStream).filter((x) => (seen.has(x.stream.url) ? false : (seen.add(x.stream.url), true)));
  tellApart(all);
  const wantDub = kino.config.get("audio") === "dub";
  // The person's audio first; within the same audio the HLS copy (fast, a CDN) goes before the addon's MP4Upload copies
  // (throttled per node). The rest stay in the Server menu.
  const hls = hlsOrdered.map((c) => ({ dub: c.dub, stream: hlsStream(c) }));
  const pool = [
    ...hls.filter((x) => x.dub === wantDub),
    ...all.filter((x) => x.dub === wantDub),
    ...hls.filter((x) => x.dub !== wantDub),
    ...all.filter((x) => x.dub !== wantDub),
  ];
  if (pool[0].dub !== wantDub) kino.log.report("audio_fallback", wantDub ? "dub" : "sub");
  const [first, ...rest] = pool;
  const main = { ...first.stream, expiresInSeconds: 1800 };
  // The fast copies first, then Voe (lazy), then the addon's copies.
  const hlsSet = new Set(hls);
  const ahead = rest.filter((x) => hlsSet.has(x));
  const behind = rest.filter((x) => !hlsSet.has(x));
  const alternatives = [...ahead.map((x) => x.stream), ...voeCopies.map(voeEntry), ...behind.map((x) => x.stream)].slice(0, 12);
  if (alternatives.length) main.alternatives = alternatives;
  return main;
}

// ---- 11. settings ---------------------------------------------------------------------------------------------

// One line for the form's status: the cache, then every source's health, at most 200 characters (the status line's cap).
export async function settingsStatus() {
  const keys = cacheKeys();
  let chars = 0;
  for (const k of keys) chars += k.length + (kino.storage.get(k) || "").length;
  const health = readHealth();
  const line = SOURCES.map((s) => {
    const h = health[s.id];
    const state = kino.config.get("src_" + s.id) === false ? "healthOff" : !h ? "healthNone" : h.ok ? "healthOk" : "healthFail";
    return `${s.label} ${t(state)}`;
  }).join(" · ");
  return { cache: t("cacheStatus", { n: keys.length, kb: Math.ceil(chars / 1024) }), health: line.slice(0, 200) };
}

export async function action(key) {
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

// Runs before Kino saves the form: with every source off, Home, search and the section would all be empty.
export async function validateSettings(values) {
  const on = SOURCES.some((s) => !values || values["src_" + s.id] !== false);
  return on ? null : { src_animeav1: t("noSources") };
}

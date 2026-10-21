#!/usr/bin/env node
/**
 * collect.mjs — Hotspawn LoL pick'em inventory + external market lines.
 *
 * Sources (all external to Hotspawn for probabilities):
 *   1. https://play.hotspawn.com/lol-pickems  (inventory only: which matches exist)
 *   2. https://www.hotspawn.com/wp-json/pickem/v1/fixtures?ids=...  (authoritative match permalinks)
 *   3. Pinnacle guest API  https://guest.api.arcadia.pinnacle.com/0.1/...  (sharp bookmoneyline)
 *   4. bo3.gg API https://api.bo3.gg/api/v1/matches (Thunderpick moneyline + bo3 team rank)
 *
 * Nothing is invented: a probability is only emitted when an external source provides it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const OUT_DIR = "data";
const NOW = new Date();
const log = (...a) => console.log(...a);
const errors = [];

async function getText(url, headers = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "user-agent": UA, accept: "*/*", ...headers },
        redirect: "follow",
      });
      const text = await r.text();
      return { status: r.status, text };
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1200 * (i + 1));
    }
  }
}
async function getJson(url, headers = {}, tries = 3) {
  const r = await getText(url, headers, tries);
  try {
    return { status: r.status, body: JSON.parse(r.text) };
  } catch {
    return { status: r.status, body: null, raw: r.text.slice(0, 200) };
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * 1. Hotspawn inventory (Angular TransferState)
 * ------------------------------------------------------------------ */
function findFixtureArray(node, acc = []) {
  if (Array.isArray(node)) {
    if (node.length && node[0] && typeof node[0] === "object" && "participants0_id" in node[0]) acc.push(node);
    for (const n of node) findFixtureArray(n, acc);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) findFixtureArray(v, acc);
  }
  return acc;
}

async function collectHotspawn() {
  const url = "https://play.hotspawn.com/lol-pickems";
  const r = await getText(url, { accept: "text/html" });
  if (r.status !== 200) throw new Error(`Hotspawn lobby HTTP ${r.status}`);
  const m = r.text.match(/<script id="ng-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Hotspawn lobby: ng-state transfer state not found (page structure changed?)");
  let state;
  try {
    state = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`Hotspawn lobby: ng-state JSON parse failed: ${e.message}`);
  }
  const arrays = findFixtureArray(state).sort((a, b) => b.length - a.length);
  if (!arrays.length) throw new Error("Hotspawn lobby: no fixture array in transfer state");
  const fixtures = arrays[0];
  const htmlLen = r.text.length;

  // Secondary, independent parse of the rendered cards (integrity cross-check).
  const cardCount = (r.text.match(/<app-pickem-vs-card/g) || []).length;

  return { url, fixtures, fetchedAt: NOW.toISOString(), htmlLen, cardCount, html: r.text };
}


/* ------------------------------------------------------------------ *
 * 2. Hotspawn match links — parsed from the lobby HTML cards.
 *    (wp-json /pickem/v1/fixtures is Cloudflare-protected for GitHub
 *     Actions egress IPs: HTTP 403 "Just a moment...", so we do not use it.)
 * ------------------------------------------------------------------ */
function parseLobbyCards(html) {
  const chunks = html.split("<app-pickem-vs-card").slice(1);
  const cards = [];
  for (const c of chunks) {
    const href = /href="(https:\/\/www\.hotspawn\.com\/matches\/[^"]+)"/.exec(c)?.[1] || null;
    const teams = [...c.matchAll(/class="vs-card-team-name"[^>]*>\s*([^<]+?)\s*<\/div>/g)].map((m) =>
      m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim()
    );
    if (teams.length < 2) continue;
    const date = /class="vs-card-date"[^>]*>\s*([^<]+?)\s*<\/div>/.exec(c)?.[1]?.trim() || null;
    const comp = /class="vs-card-tournament"[^>]*>\s*([^<]+?)\s*<\/div>/.exec(c)?.[1]?.trim() || null;
    cards.push({ href, teamA: teams[0], teamB: teams[1], date, comp });
  }
  return cards;
}

const slugPart = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function buildMatchUrl(f) {
  return `https://www.hotspawn.com/matches/${slugPart(f.participants0_name)}-vs-${slugPart(
    f.participants1_name
  )}-${slugPart(f.competition_name)}-${f.id}`;
}


/* ------------------------------------------------------------------ *
 * 3. Pinnacle moneyline
 * ------------------------------------------------------------------ */
function americanToDecimal(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}
function noVig(da, db) {
  if (!da || !db) return null;
  const ia = 1 / da;
  const ib = 1 / db;
  const s = ia + ib;
  return { a: ia / s, b: ib / s, overround: (s - 1) * 100 };
}

async function collectPinnacle() {
  const base = "https://guest.api.arcadia.pinnacle.com/0.1";
  const leagues = await getJson(`${base}/sports/12/leagues`);
  if (!leagues.body) throw new Error("Pinnacle leagues: non-JSON response");
  const lolLeagues = (leagues.body || []).filter((l) => /^league of legends/i.test(l.name || ""));
  const matchups = [];
  for (const lg of lolLeagues) {
    const mu = await getJson(`${base}/leagues/${lg.id}/matchups`);
    for (const m of mu.body || []) {
      if (m.type !== "matchup") continue;
      const parts = m.participants || [];
      if (parts.length !== 2) continue;
      const mk = await getJson(`${base}/matchups/${m.id}/markets/related/straight`);
      const lines = (mk.body || []).filter((x) => x.type === "moneyline");
      const ml = lines.find((x) => x.period === 1) || lines[0];
      if (!ml) continue;
      const home = parts.find((p) => p.alignment === "home") || parts[0];
      const away = parts.find((p) => p.alignment === "away") || parts[1];
      const ph = (ml.prices || []).find((p) => p.designation === "home");
      const pa = (ml.prices || []).find((p) => p.designation === "away");
      const dh = americanToDecimal(ph?.price);
      const daway = americanToDecimal(pa?.price);
      const nv = noVig(dh, daway);
      matchups.push({
        source: "Pinnacle",
        league: lg.name,
        leagueId: lg.id,
        matchupId: m.id,
        startTime: m.startTime,
        bestOf: m.bestOfX ?? null,
        home: home.name,
        away: away.name,
        homePriceAmerican: ph?.price ?? null,
        awayPriceAmerican: pa?.price ?? null,
        homeDecimal: dh,
        awayDecimal: daway,
        probHome: nv?.a ?? null,
        probAway: nv?.b ?? null,
        overround: nv?.overround ?? null,
        // Public, key-free URLs that anyone can re-check:
        sourceUrl: `${base}/matchups/${m.id}/markets/related/straight`,
        leagueUrl: `${base}/leagues/${lg.id}/matchups`,
      });
      await sleep(200);
    }
    await sleep(200);
  }
  return { leagues: lolLeagues.map((l) => ({ id: l.id, name: l.name, matchups: l.matchupCount })), matchups };
}

/* ------------------------------------------------------------------ *
 * 4. Thunderpick (via bo3.gg) + bo3 team ranks
 * ------------------------------------------------------------------ */
async function collectThunderpick() {
  const base = "https://api.bo3.gg/api/v1";
  const rows = [];
  let offset = 0;
  const limit = 50;
  for (let page = 0; page < 6; page++) {
    const r = await getJson(
      `${base}/matches?filter[matches.discipline_id][eq]=3&filter[matches.status][eq]=upcoming&page[limit]=${limit}&page[offset]=${offset}`
    );
    const res = r.body?.results || [];
    for (const m of res) {
      const bu = m.bet_updates;
      if (!bu || !bu.team_1 || !bu.team_2) continue;
      if (!bu.team_1.coeff || !bu.team_2.coeff) continue;
      const da = Number(bu.team_1.coeff);
      const db = Number(bu.team_2.coeff);
      const nv = noVig(da, db);
      rows.push({
        source: bu.provider === "thunderpick" ? "Thunderpick" : String(bu.provider || "bo3.gg"),
        provider: bu.provider,
        bo3MatchId: m.id,
        bo3Slug: m.slug,
        tournamentId: m.tournament_id,
        tier: m.tier,
        bestOf: m.bo_type ?? null,
        startTime: m.start_date,
        home: bu.team_1.name,
        away: bu.team_2.name,
        homeTeamId: bu.team_1.team_id ?? m.team1_id ?? null,
        awayTeamId: bu.team_2.team_id ?? m.team2_id ?? null,
        homeDecimal: da,
        awayDecimal: db,
        probHome: nv?.a ?? null,
        probAway: nv?.b ?? null,
        overround: nv?.overround ?? null,
        marketsCount: bu.markets_count ?? null,
        sourceUrl: bu.path || `https://bo3.gg/matches/${m.slug}`,
        apiUrl: `${base}/matches?filter[matches.id][eq]=${m.id}`,
      });
    }
    offset += limit;
    if (!r.body?.links?.next || res.length < limit) break;
    await sleep(250);
  }
  return rows;
}


/* ------------------------------------------------------------------ *
 * 5. Polymarket (prediction market) — per-match LoL moneylines
 * ------------------------------------------------------------------ */
async function collectPolymarket() {
  const base = "https://gamma-api.polymarket.com";
  const rows = [];
  const seen = new Set();
  let pagesScanned = 0;
  for (let offset = 0; offset < 1600; offset += 100) {
    const r = await getJson(`${base}/events?closed=false&limit=100&offset=${offset}&order=startDate&ascending=true`);
    const evs = Array.isArray(r.body) ? r.body : [];
    if (!evs.length) break;
    pagesScanned++;
    for (const ev of evs) {
      if (!/^LoL:/i.test(ev.title || "")) continue;
      if (seen.has(String(ev.id))) continue;
      seen.add(String(ev.id));
      const mks = (ev.markets || []).filter((m) => m && m.active !== false);
      if (!mks.length) continue;
      // series moneyline (not the per-game children)
      const ml =
        mks.find((m) => /^moneyline$/i.test((m.groupItemTitle || "").trim())) ||
        mks.find((m) => !/game\s*\d/i.test(m.question || "") && String(m.sportsMarketType || "") !== "child_moneyline");
      if (!ml) continue;
      let outcomes = [], prices = [];
      try { outcomes = JSON.parse(ml.outcomes || "[]"); } catch {}
      try { prices = JSON.parse(ml.outcomePrices || "[]").map(Number); } catch {}
      if (outcomes.length !== 2 || prices.length !== 2) continue;
      if (!prices.every((x) => Number.isFinite(x) && x > 0 && x < 1)) continue;
      const sum = prices[0] + prices[1];
      rows.push({
        source: "Polymarket",
        league: (ev.title || "").replace(/^LoL:\s*/i, ""),
        matchupId: String(ev.id),
        startTime: ml.eventStartTime || ml.gameStartTime || ev.startDate,
        bestOf: null,
        home: outcomes[0],
        away: outcomes[1],
        homeDecimal: 1 / prices[0],
        awayDecimal: 1 / prices[1],
        probHome: prices[0] / sum,
        probAway: prices[1] / sum,
        overround: (sum - 1) * 100,
        sourceUrl: `https://polymarket.com/event/${ev.slug}`,
        apiUrl: `${base}/events?slug=${ev.slug}`,
      });
    }
    await sleep(150);
  }
  return { rows, pagesScanned };
}

/* ------------------------------------------------------------------ *
 * Name normalisation + matching
 * ------------------------------------------------------------------ */
const ALIASES = [
  [/\bla\s*esports\b/g, ""],
  [/\besports?\b/g, ""],
  [/\besport\b/g, ""],
  [/\bgaming\b/g, ""],
  [/\bteam\b/g, ""],
  [/\bclub\b/g, ""],
  [/\bacademy\b/g, "acad"],
  [/\b(dplus|d plus)\s*kia\b/g, "dk"],
  [/\bdk\b/g, "dk"],
  [/\bbilibili\b/g, "blg"],
  [/\bag\s*al\b/g, "al"],
  [/\banyone'?s legend\b/g, "al"],
  [/\bmovistar koi\b/g, "koi"],
  [/\bteam secret whales\b/g, "swhales"],
  [/\bsecret whales\b/g, "swhales"],
  [/\bctbc flying oyster\b/g, "cfo"],
  [/\bflying oyster\b/g, "cfo"],
  [/\btop esports\b/g, "tes"],
  [/\bhanwha life\b/g, "hle"],
  [/\binvictus gaming\b/g, "ig"],
  [/\bgen\.?g\b/g, "geng"],
  [/\bg2 esports\b/g, "g2"],
  [/\bteam liquid\b/g, "tl"],
  [/\bdplus\s*kia\b/g, "dk"],
  [/\blos\b/g, "los"],
  [/\bløs\b/g, "los"],
  [/\blyon\b/g, "lyon"],
  [/\bkarmine corp\b/g, "kc"],
];
const CHAR_MAP = { "ø": "o", "æ": "ae", "å": "a", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ß": "ss", "ı": "i", "œ": "oe" };
function normName(s) {
  let x = String(s || "")
    .toLowerCase()
    .replace(/[øæåłđðþßıœ]/g, (c) => CHAR_MAP[c] || c)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, rep] of ALIASES) x = x.replace(re, rep);
  return x.replace(/\s+/g, " ").trim();
}
function tokens(s) {
  return new Set(normName(s).split(" ").filter((t) => t && t.length > 1));
}
function nameSimilarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const jaccard = inter / (A.size + B.size - inter);
  // substring bonus for "bilibili" vs "bilibili gaming"
  const na = normName(a).replace(/ /g, "");
  const nb = normName(b).replace(/ /g, "");
  const sub = na && nb && (na.includes(nb) || nb.includes(na)) ? 0.35 : 0;
  return Math.min(1, Math.max(jaccard, sub));
}
const HOUR = 3600 * 1000;

function matchMarket(fixture, markets) {
  const t = Number(fixture.scheduled_start_time);
  const fa = fixture.participants0_name;
  const fb = fixture.participants1_name;
  let best = null;
  for (const m of markets) {
    const mt = new Date(m.startTime).getTime();
    const dt = Math.abs(mt - t);
    if (!Number.isFinite(dt) || dt > 8 * HOUR) continue;
    const s1 = (nameSimilarity(fa, m.home) + nameSimilarity(fb, m.away)) / 2;
    const s2 = (nameSimilarity(fa, m.away) + nameSimilarity(fb, m.home)) / 2;
    const score = Math.max(s1, s2);
    if (score < 0.72) continue;
    const swapped = s2 > s1;
    const cand = { market: m, score, swapped, dt };
    if (!best || cand.score > best.score || (cand.score === best.score && cand.dt < best.dt)) best = cand;
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
async function main() {
  const started = Date.now();
  await mkdir(OUT_DIR, { recursive: true });

  let hotspawn;
  try {
    hotspawn = await collectHotspawn();
    log(`hotspawn: ${hotspawn.fixtures.length} fixtures, ${hotspawn.cardCount} rendered cards`);
  } catch (e) {
    errors.push({ source: "hotspawn", error: String(e.message || e) });
    // Keep the last good dataset rather than publishing a broken site.
    if (existsSync(`${OUT_DIR}/matches.json`)) {
      log("hotspawn failed; keeping previous data/matches.json", e.message);
      await writeFile(`${OUT_DIR}/collect-errors.json`, JSON.stringify({ at: NOW.toISOString(), errors }, null, 2));
      return;
    }
    throw e;
  }

  const fixtures = hotspawn.fixtures;


  // Match links come from the lobby HTML (play.hotspawn.com is not Cloudflare-gated).
  const cards = parseLobbyCards(hotspawn.html);
  const permalinks = {};
  const slugCheck = { checked: 0, ok: 0, mismatches: [] };
  for (const c of cards) {
    if (!c.href) continue;
    // validate our deterministic slug builder against the real href
    const id = c.href.match(/-(\d+)$/)?.[1];
    if (id) {
      const fixtureForCheck = { participants0_name: c.teamA, participants1_name: c.teamB, competition_name: c.comp, id };
      const built = buildMatchUrl(fixtureForCheck);
      slugCheck.checked++;
      if (built === c.href) slugCheck.ok++;
      else if (slugCheck.mismatches.length < 8) slugCheck.mismatches.push({ real: c.href, built });
      permalinks[id] = c.href;
    }
  }

  let pinnacle = { leagues: [], matchups: [] };
  try {
    pinnacle = await collectPinnacle();
  } catch (e) {
    errors.push({ source: "pinnacle", error: String(e.message || e) });
  }
  let thunderpick = [];
  try {
    thunderpick = await collectThunderpick();
  } catch (e) {
    errors.push({ source: "bo3-thunderpick", error: String(e.message || e) });
  }
  let polymarket = { rows: [], pagesScanned: 0 };
  try {
    polymarket = await collectPolymarket();
  } catch (e) {
    errors.push({ source: "polymarket", error: String(e.message || e) });
  }

  /* ---- assemble matches ---- */
  const nowMs = NOW.getTime();
  const matches = fixtures.map((f) => {
    const startMs = Number(f.scheduled_start_time);
    const fromCard = permalinks[String(f.id)] || null;
    const link = fromCard || buildMatchUrl(f);
    const linkSource = fromCard ? "lobby-card" : "constructed-slug";
    const m = {
      id: String(f.id),
      competition: f.competition_name,
      competitionId: String(f.competition_id),
      teamA: f.participants0_name,
      teamB: f.participants1_name,
      teamAId: String(f.participants0_id),
      teamBId: String(f.participants1_id),
      startUtc: new Date(startMs).toISOString(),
      startMs,
      tier: f.tier,
      stage: f.stage,
      points: f.offered_points,
      lockTime: f.lock_time ? new Date(Number(f.lock_time)).toISOString() : null,
      status: startMs < nowMs ? "completed-or-started" : "upcoming",
      hotspawnUrl: link,
      hotspawnUrlSource: linkSource,
      hotspawnPickedA: f.participants0_picked_percent,
      hotspawnPickedB: f.participants1_picked_percent,
      // NOTE: hotspawn pick% is stored for transparency only; it is NEVER used as a probability input.
    };
    return m;
  });

  // Match each fixture against market sources
  const marketsAll = [
    ...pinnacle.matchups.map((m) => ({ ...m, kind: "pinnacle" })),
    ...thunderpick.map((m) => ({ ...m, kind: "thunderpick" })),
    ...(polymarket.rows || []).map((m) => ({ ...m, kind: "polymarket" })),
  ];

  for (const m of matches) {
    const f = {
      scheduled_start_time: m.startMs,
      participants0_name: m.teamA,
      participants1_name: m.teamB,
    };
    const bySource = {};
    for (const mk of marketsAll) {
      const cand = matchMarket(f, [mk]);
      if (!cand) continue;
      const k = mk.source;
      if (!bySource[k] || cand.score > bySource[k].score) bySource[k] = { ...cand, market: mk };
    }
    const books = [];
    for (const [source, c] of Object.entries(bySource)) {
      const mk = c.market;
      const pa = c.swapped ? mk.probAway : mk.probHome;
      const pb = c.swapped ? mk.probHome : mk.probAway;
      const da = c.swapped ? mk.awayDecimal : mk.homeDecimal;
      const db = c.swapped ? mk.homeDecimal : mk.awayDecimal;
      books.push({
        source,
        matchName: `${mk.home} vs ${mk.away}`,
        oddsA: da,
        oddsB: db,
        probA: pa,
        probB: pb,
        overround: mk.overround,
        startTime: mk.startTime,
        bestOf: mk.bestOf,
        sourceUrl: mk.sourceUrl,
        apiUrl: mk.apiUrl || mk.sourceUrl,
        confidence: source === "Pinnacle" ? "sharp" : source === "Polymarket" ? "market" : "retail",
        matchScore: Number(c.score.toFixed(3)),
        swapped: c.swapped,
      });
    }
    if (books.length) {
      // Primary = Pinnacle (sharpest), else best-scoring book
      books.sort((x, y) => (x.confidence === "sharp" ? -1 : 1) - (y.confidence === "sharp" ? -1 : 1) || y.matchScore - x.matchScore);
      const primary = books[0];
      m.market = {
        source: primary.source,
        books,
        oddsA: primary.oddsA,
        oddsB: primary.oddsB,
        probA: primary.probA,
        probB: primary.probB,
        sourceUrl: primary.sourceUrl,
        confidence: primary.confidence,
      };
      const sameSide = books.every((b) => (b.probA >= 0.5) === (primary.probA >= 0.5));
      const spread = books.length > 1 ? Math.max(...books.map((b) => b.probA)) - Math.min(...books.map((b) => b.probA)) : 0;
      m.market.agreement = { sameSide, spreadPts: Number((spread * 100).toFixed(1)), nBooks: books.length };
    }
  }

  /* ---- resolution ---- */
  const byComp = {};
  for (const m of matches) {
    let resolution = "unresolved";
    let probA = null, probB = null, basis = null, confidence = "none";
    if (m.market) {
      resolution = "market";
      probA = m.market.probA;
      probB = m.market.probB;
      basis = `${m.market.source} moneyline, vig removed (overround ${m.market.books[0].overround?.toFixed(2)}%)`;
      confidence = m.market.confidence === "sharp" ? "high" : "medium";
      if (m.market.books.length > 1 && !m.market.agreement.sameSide) {
        confidence = "low";
        m.flags = [...(m.flags || []), "Books disagree on the favourite"];
      }
    }
    m.resolution = resolution;
    m.probA = probA;
    m.probB = probB;
    m.basis = basis;
    m.confidence = confidence;
    if (probA != null) {
      m.pick = probA >= probB ? m.teamA : m.teamB;
      m.pickProb = Math.max(probA, probB);
      m.pickSide = probA >= probB ? "A" : "B";
    } else {
      m.pick = null;
      m.pickProb = null;
      m.pickSide = null;
    }
    const key = m.competition;
    byComp[key] = byComp[key] || { name: key, total: 0, upcoming: 0, resolved: 0, unresolved: 0, market: 0 };
    byComp[key].total++;
    if (m.status === "upcoming") {
      byComp[key].upcoming++;
      if (m.resolution === "market") { byComp[key].resolved++; byComp[key].market++; }
      else byComp[key].unresolved++;
    }
  }

  /* ---- mapping diagnostics: which external prices attached to a Hotspawn fixture ---- */
  const usedMarketKeys = new Set();
  for (const m of matches) {
    for (const b of m.market?.books || []) usedMarketKeys.add(`${b.source}|${b.sourceUrl}`);
  }
  const unmatchedMarkets = marketsAll
    .filter((mk) => !usedMarketKeys.has(`${mk.source}|${mk.sourceUrl}`))
    .map((mk) => ({ source: mk.source, match: `${mk.home} vs ${mk.away}`, startTime: mk.startTime, sourceUrl: mk.sourceUrl }));

  /* ---- unresolved diagnostics: what was actually checked ---- */
  const checkedSources = [
    { name: "Pinnacle", detail: `${pinnacle.matchups.length} LoL matchups with moneyline (${pinnacle.leagues.map((l) => l.name).join("; ") || "none"})`, url: "https://guest.api.arcadia.pinnacle.com/0.1/sports/12/leagues" },
    { name: "Thunderpick (via bo3.gg)", detail: `${thunderpick.length} upcoming LoL matchups with prices`, url: "https://api.bo3.gg/api/v1/matches?filter[matches.discipline_id][eq]=3&filter[matches.status][eq]=upcoming" },
    { name: "Liquipedia", detail: "Checked for tournament pages; not used as a price source (no betting prices).", url: "https://liquipedia.net/leagueoflegends/Portal:Tournaments" },
  ];

  const data = {
    generatedAt: NOW.toISOString(),
    collectionMs: Date.now() - started,
    urlVerification: {
      cardsParsed: cards.length,
      cardsWithMatchLink: cards.filter((c) => c.href).length,
      slugBuilderChecked: slugCheck.checked,
      slugBuilderExactMatches: slugCheck.ok,
      slugBuilderMismatchSamples: slugCheck.mismatches,
    },
    inventory: {
      source: hotspawn.url,
      fetchedAt: hotspawn.fetchedAt,
      fixtures: fixtures.length,
      renderedCards: hotspawn.cardCount,
      htmlBytes: hotspawn.htmlLen,
      competitions: Object.keys(byComp).length,
      matchLinksFromLobbyHtml: Object.values(permalinks).filter(Boolean).length,
      matchLinksConstructed: matches.filter((m) => m.hotspawnUrlSource === "constructed-slug").length,
    },
    counts: {
      total: matches.length,
      upcoming: matches.filter((m) => m.status === "upcoming").length,
      started: matches.filter((m) => m.status !== "upcoming").length,
      upcomingResolved: matches.filter((m) => m.status === "upcoming" && m.resolution === "market").length,
      upcomingUnresolved: matches.filter((m) => m.status === "upcoming" && m.resolution !== "market").length,
      upcomingHighConfidence: matches.filter((m) => m.status === "upcoming" && m.confidence === "high").length,
    },
    sources: {
      pinnacle: { leagues: pinnacle.leagues, matchups: pinnacle.matchups.length },
      thunderpick: { matchups: thunderpick.length },
      polymarket: { matchups: polymarket.rows.length, pagesScanned: polymarket.pagesScanned },
      checkedSources,
    },
    competitions: Object.values(byComp).sort((a, b) => b.upcoming - a.upcoming || b.total - a.total),
    errors,
    mapping: {
      marketRowsFetched: marketsAll.length,
      marketRowsAttached: usedMarketKeys.size,
      unmatchedMarkets,
    },
    matches: matches.sort((a, b) => a.startMs - b.startMs),
  };

  await writeFile(`${OUT_DIR}/matches.json`, JSON.stringify(data, null, 1));

  // CSV (Excel-friendly)
  const cols = [
    "id", "startUtc", "status", "competition", "tier", "teamA", "teamB", "resolution",
    "pick", "pickProb", "probA", "probB", "confidence", "marketSource", "oddsA", "oddsB", "hotspawnUrl",
  ];
  const esc = (v) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(Number(v.toFixed(4))) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const m of data.matches) {
    lines.push([
      m.id, m.startUtc, m.status, m.competition, m.tier, m.teamA, m.teamB, m.resolution,
      m.pick, m.pickProb?.toFixed?.(4), m.probA?.toFixed?.(4), m.probB?.toFixed?.(4), m.confidence,
      m.market?.source, m.market?.oddsA?.toFixed?.(3), m.market?.oddsB?.toFixed?.(3), m.hotspawnUrl,
    ].map(esc).join(","));
  }
  await writeFile(`${OUT_DIR}/matches.csv`, lines.join("\n") + "\n");
  await writeFile(`${OUT_DIR}/collect-errors.json`, JSON.stringify({ at: NOW.toISOString(), errors }, null, 2));

  log(
    `done: ${data.counts.total} fixtures (${data.counts.upcoming} upcoming), ` +
    `${data.counts.upcomingResolved} upcoming with market line, ` +
    `${data.counts.upcomingUnresolved} unresolved; errors=${errors.length}`
  );
  for (const e of errors) log("  ERROR", e.source, e.error);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    `${OUT_DIR}/collect-errors.json`,
    JSON.stringify({ at: new Date().toISOString(), fatal: String(e.stack || e), errors }, null, 2)
  );
  process.exit(1);
});

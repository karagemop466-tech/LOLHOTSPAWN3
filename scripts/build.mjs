#!/usr/bin/env node
/**
 * build.mjs — renders the static dashboard in docs/ from data/*.json
 * No dependencies, no client-side build step. Served directly by GitHub Pages.
 */
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";

const SITE = ".";   // GitHub Pages (legacy) serves main:/ — the site must live at the repo root
const now = new Date();

const data = JSON.parse(await readFile("data/matches.json", "utf8"));
const audit = JSON.parse(await readFile("data/source-audit.json", "utf8"));
const flags = JSON.parse(await readFile("data/flags.json", "utf8"));

await mkdir("assets", { recursive: true });
await copyFile("scripts/site/style.css", "assets/style.css");
await writeFile(".nojekyll", "");   // serve files as-is (no Jekyll processing)

/* ------------------------------ helpers ------------------------------ */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const pct = (x, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const isoShort = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
};
const dateShort = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";
};
const confBadge = (c) =>
  c === "high" ? `<span class="pill ok">high</span>` :
  c === "medium" ? `<span class="pill ok">medium</span>` :
  c === "low" ? `<span class="pill warn">low</span>` :
  `<span class="pill mut">none</span>`;

const NAV = [
  ["index.html", "Summary"],
  ["picks.html", "Picks"],
  ["markets.html", "Market lines"],
  ["unresolved.html", "Unresolved"],
  ["method.html", "Method"],
  ["flagged.html", "Flagged"],
];

function page({ title, desc, active, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${esc(title)} · Hotspawn LoL Picks</title>
<meta name="description" content="${esc(desc)}">
<link rel="stylesheet" href="assets/style.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%237c6cff'/><text x='50' y='68' font-size='54' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>L</text></svg>">
</head>
<body>
<header class="site">
  <div class="wrap bar">
    <a class="brand" href="index.html"><span class="dot"></span> Hotspawn LoL Picks</a>
    <nav class="main">
      ${NAV.map(([href, label]) => `<a href="${href}"${href === active ? ' class="active"' : ""}>${label}</a>`).join("")}
    </nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="site">
  <div class="wrap">
    <p><strong>Hotspawn LoL Picks</strong> — automated inventory of every League of Legends fixture listed in the
    <a href="${esc(data.inventory.source)}" target="_blank" rel="noopener">Hotspawn Pick'ems LoL lobby</a>, with win probabilities only where an external
    betting market provides a verifiable price. Refreshed every 6 hours by GitHub Actions.</p>
    <p class="small">Data: <a href="data/matches.json">matches.json</a> · <a href="data/matches.csv">matches.csv</a> ·
    Last collection: ${esc(isoShort(data.generatedAt))} ·
    Sources are linked on every row. Unverified items are listed on the <a href="flagged.html">Flagged</a> page.</p>
  </div>
</footer>
<script src="assets/app.js" defer></script>
</body>
</html>`;
}

/* ------------------------------ derived ------------------------------ */
const upcoming = data.matches.filter((m) => m.status === "upcoming");
const started = data.matches.filter((m) => m.status !== "upcoming");
const resolved = upcoming.filter((m) => m.resolution === "market");
const unresolved = upcoming.filter((m) => m.resolution !== "market");
const comps = data.competitions;

function matchCard(m) {
  const has = m.probA != null;
  const cls = !has ? "unres" : m.confidence === "high" ? "pick-high" : "pick-med";
  const aWin = has && m.probA >= m.probB;
  const bWin = has && m.probB > m.probA;
  const src = m.hotspawnUrl
    ? `<a href="${esc(m.hotspawnUrl)}" target="_blank" rel="noopener">Hotspawn match ↗</a>`
    : `<span class="pill mut">no match URL</span>`;
  const marketLink = m.market
    ? `<a href="${esc(m.market.sourceUrl)}" target="_blank" rel="noopener">${esc(m.market.source)} line ↗</a>`
    : "";
  return `<article class="match ${cls}" data-comp="${esc(m.competition)}" data-res="${esc(m.resolution)}" data-search="${esc(
    `${m.teamA} ${m.teamB} ${m.competition}`.toLowerCase()
  )}" data-utc="${esc(m.startUtc)}">
  <div class="mhead"><span class="comp">${esc(m.competition)}</span><span class="when" data-fmt="utc">${esc(dateShort(m.startUtc))}</span></div>
  <div class="teams">
    <div class="team a${aWin ? " win" : ""}">${esc(m.teamA)}<span class="p">${has ? pct(m.probA) : "no line"}</span></div>
    <div class="vs">vs</div>
    <div class="team b${bWin ? " win" : ""}">${esc(m.teamB)}<span class="p">${has ? pct(m.probB) : "no line"}</span></div>
  </div>
  <div class="bar" aria-hidden="true"><span class="a" style="width:${has ? (m.probA * 100).toFixed(1) : 50}%"></span><span class="b" style="width:${has ? (m.probB * 100).toFixed(1) : 50}%"></span></div>
  <div class="pickrow">
    <span class="pick">${
      has
        ? `Pick: ${esc(m.pick)} <span class="tag market">${esc(m.market.source)}</span>`
        : `Pick: <span class="muted">unresolved</span> <span class="tag unres">no external line</span>`
    }</span>
    <span>${confBadge(m.confidence)}</span>
  </div>
  <div class="pickrow small"><span class="src">${src} ${marketLink ? " · " + marketLink : ""}</span><span>${esc(m.tier === "waiting for information" ? "tier n/a" : "tier " + m.tier.toUpperCase())}</span></div>
</article>`;
}

/* ------------------------------- INDEX ------------------------------- */
const topPicks = resolved.slice(0, 6);
const compRows = comps
  .filter((c) => c.upcoming > 0)
  .map(
    (c) => `<tr>
      <td>${esc(c.name)}</td>
      <td class="num">${c.upcoming}</td>
      <td class="num">${c.market}</td>
      <td class="num">${c.unresolved}</td>
      <td>${c.market > 0 ? `<span class="pill ok">market-priced</span>` : `<span class="pill warn">no external market</span>`}</td>
    </tr>`
  )
  .join("");

const indexBody = `
<section class="hero">
  <h1>Every League of Legends match on Hotspawn — with a pick wherever a real betting line exists</h1>
  <p class="lede">Automated collection from the Hotspawn Pick'ems LoL lobby. Probabilities come from external bookmakers
  (Pinnacle, Thunderpick) — never from Hotspawn's own pick percentages. Matches with no verifiable external line are
  listed separately and are <strong>not</strong> given a made-up number.</p>
  <p class="updated">Last collection: <strong>${esc(isoShort(data.generatedAt))}</strong> · refreshes every 6 hours · inventory ${data.inventory.fixtures} fixtures / ${data.inventory.competitions} competitions</p>
</section>

<div class="quick">
  <a href="picks.html"><span class="t">Picks <span>→</span></span><span class="s">${upcoming.length} upcoming matches · ${resolved.length} with a verified line</span></a>
  <a href="unresolved.html"><span class="t">Unresolved <span>→</span></span><span class="s">${unresolved.length} matches without an external price · why, and what would fix it</span></a>
  <a href="markets.html"><span class="t">Market lines <span>→</span></span><span class="s">Every external price, bookmaker and link</span></a>
  <a href="method.html"><span class="t">Method <span>→</span></span><span class="s">Formulas, sources, verification steps</span></a>
  <a href="flagged.html"><span class="t">Flagged <span>→</span></span><span class="s">Irregularities &amp; unverified items for review</span></a>
  <a href="data/matches.csv"><span class="t">Download CSV <span>↓</span></span><span class="s">Full dataset for spreadsheets</span></a>
</div>

<div class="kpis">
  <div class="kpi"><div class="n">${data.inventory.fixtures}</div><div class="l">Hotspawn LoL fixtures tracked</div></div>
  <div class="kpi"><div class="n">${upcoming.length}</div><div class="l">Upcoming (not yet started)</div></div>
  <div class="kpi good"><div class="n">${resolved.length}</div><div class="l">Upcoming with a verified external line</div></div>
  <div class="kpi warn"><div class="n">${unresolved.length}</div><div class="l">Upcoming with no external line</div></div>
</div>

<section>
  <h2>Executive summary</h2>
  <div class="card">
    <p><strong>What this site is.</strong> A full, automatically refreshed inventory of the League of Legends matches in the
    Hotspawn Pick'ems lobby (<a href="${esc(data.inventory.source)}" target="_blank" rel="noopener">play.hotspawn.com/lol-pickems</a>),
    each with a pick and a win probability <em>only</em> where an external betting market prices the match. The inventory is
    read from the lobby's server-rendered page; no Hotspawn probability or crowd-pick figure is used as an input.</p>

    <p><strong>What is covered.</strong> ${data.inventory.fixtures} fixtures across ${data.inventory.competitions} competitions
    (${upcoming.length} upcoming, ${started.length} already started/completed). ${resolved.length} upcoming fixtures carry a
    verifiable external moneyline: <strong>Pinnacle</strong> is the primary (sharp) book and every one of those fixtures is
    cross-checked against <strong>Thunderpick</strong>.</p>

    <p><strong>What is not covered, and why.</strong> ${unresolved.length} upcoming fixtures are amateur / semi-pro leagues
    (PRM 2nd &amp; 3rd Division, Tunisian Super League, 4 Nations, RIVALS LEAGUE, Komplettligaen, Icelandic Esports League,
    Arabian League 2nd Division, LigaGG CELOL). <strong>No bookmaker prices them</strong>: Pinnacle lists only World Championship
    and EMEA Masters for LoL, Thunderpick/bo3.gg the same, and Polymarket only carries tournament futures. Without a market
    there is no verifiable probability, so these rows show <em>unresolved</em> instead of an invented number. The
    <a href="unresolved.html">Unresolved page</a> lists each one with the sources checked and the limitation.</p>

    <p><strong>Where the picks are.</strong> <a href="picks.html">Picks</a> (all upcoming, filterable) ·
    <a href="markets.html">Market lines</a> (raw prices and no-vig maths) ·
    <a href="unresolved.html">Unresolved</a> (what we could not price) ·
    <a href="flagged.html">Flagged for review</a>.</p>

    <div class="note warn"><strong>Read this before betting or picking.</strong> A probability on this site means
    “external bookmaker moneyline with the margin removed”. It is not a prediction from this project. If a match shows
    <em>unresolved</em>, we do not know who is favoured and we will not guess.</div>
  </div>
</section>

<section>
  <h2>Next picks with a verified line</h2>
  <div class="matches">${topPicks.map(matchCard).join("") || `<p class="small">No market-priced fixtures right now.</p>`}</div>
  <p class="small"><a href="picks.html">See all ${upcoming.length} upcoming matches →</a></p>
</section>

<section>
  <h2>Coverage by competition</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Competition</th><th class="num">Upcoming</th><th class="num">With line</th><th class="num">Unresolved</th><th>Status</th></tr></thead>
    <tbody>${compRows}</tbody>
  </table></div>
  <p class="small">Only competitions with at least one upcoming fixture are shown. Full breakdown in
  <a href="picks.html">Picks</a> and <a href="unresolved.html">Unresolved</a>.</p>
</section>

<section>
  <h2>Refresh &amp; integrity</h2>
  <div class="card">
    <p>Collector runs on a <strong>6-hour schedule</strong> (GitHub Actions, <code>scripts/collect.mjs</code>) and can be
    triggered manually. Each run: (1) re-reads the Hotspawn LoL lobby, (2) re-pulls Pinnacle and Thunderpick LoL markets,
    (3) re-maps prices to fixtures by team name + kick-off time, (4) recomputes no-vig probabilities, (5) rebuilds this site.</p>
    <p class="small">Last run: ${esc(isoShort(data.generatedAt))} · collection took ${data.collectionMs} ms ·
    errors this run: ${data.errors.length} · market rows fetched: ${data.mapping.marketRowsFetched} ·
    rows attached to a fixture: ${data.mapping.marketRowsAttached}.</p>
    <p class="small">Integrity checks: lobby rendered ${data.inventory.renderedCards} match cards vs ${upcoming.length} upcoming fixtures in the
    transfer state; slug builder reproduced ${data.urlVerification.slugBuilderExactMatches}/${data.urlVerification.slugBuilderChecked} live match URLs.</p>
  </div>
</section>`;

await writeFile("index.html", page({
  title: "Executive summary",
  desc: "Full inventory of Hotspawn League of Legends pick'em matches with external-market win probabilities.",
  active: "index.html",
  body: indexBody,
}));

/* ------------------------------- PICKS ------------------------------- */
const picksBody = `
<section class="hero">
  <h1>Picks — ${upcoming.length} upcoming matches</h1>
  <p class="lede">Sorted by kick-off time. Matches with a verified external line are green/accent; unresolved matches are grey
  and carry no probability. Tap a source link to check the original market.</p>
  <p class="updated">Last collection: ${esc(isoShort(data.generatedAt))} · ${resolved.length} priced · ${unresolved.length} unresolved</p>
</section>

<div class="toolbar">
  <input id="q" type="search" placeholder="Search team or competition…" aria-label="Search">
  <select id="fComp" aria-label="Competition"><option value="">All competitions</option>
    ${comps.filter((c) => c.upcoming > 0).map((c) => `<option>${esc(c.name)}</option>`).join("")}
  </select>
  <div class="row">
    <select id="fRes" aria-label="Resolution">
      <option value="">All matches</option>
      <option value="market">With verified line</option>
      <option value="unresolved">Unresolved</option>
    </select>
    <select id="fTz" aria-label="Time zone"><option value="utc">Times in UTC</option><option value="local">Times in my zone</option></select>
  </div>
</div>
<p class="count" id="count">Showing ${upcoming.length} matches</p>

<div class="matches" id="list">
  ${upcoming.map(matchCard).join("")}
</div>

${started.length ? `<section>
  <h2>Already started / completed (${started.length})</h2>
  <p class="small">These fixtures are in the lobby's week but their start time has passed, so they are excluded from picks.
  Hotspawn does not render per-match cards for them, so the source link points at the lobby.</p>
  <details><summary class="small">Show ${started.length} fixtures</summary>
  <div class="matches">${started.map((m) => matchCard({ ...m, hotspawnUrl: m.hotspawnUrlSource === "lobby-card" ? m.hotspawnUrl : data.inventory.source })).join("")}</div>
  </details>
</section>` : ""}`;

await writeFile("picks.html", page({
  title: "Picks",
  desc: "All upcoming Hotspawn League of Legends matches with pick and win probability.",
  active: "picks.html",
  body: picksBody,
}));

/* ------------------------------ MARKETS ------------------------------ */
const bookRows = [];
for (const m of data.matches) {
  for (const b of m.market?.books || []) {
    bookRows.push(`<tr>
      <td>${esc(dateShort(m.startUtc))}</td>
      <td>${esc(m.teamA)} vs ${esc(m.teamB)}</td>
      <td>${esc(m.competition)}</td>
      <td>${esc(b.source)}</td>
      <td class="num">${b.oddsA?.toFixed(3) ?? "—"} / ${b.oddsB?.toFixed(3) ?? "—"}</td>
      <td class="num">${pct(b.probA)} / ${pct(b.probB)}</td>
      <td class="num">${b.overround != null ? b.overround.toFixed(2) + "%" : "—"}</td>
      <td class="num">${b.matchScore?.toFixed(2) ?? "—"}</td>
      <td><a href="${esc(b.sourceUrl)}" target="_blank" rel="noopener">source ↗</a></td>
    </tr>`);
  }
}
const marketsBody = `
<section class="hero">
  <h1>Market lines</h1>
  <p class="lede">Every external price used on this site, with the bookmaker and a link you can re-check. Decimal odds.
  “No-vig” removes the bookmaker margin so the two probabilities sum to 100%.</p>
  <p class="updated">Pulled ${esc(isoShort(data.generatedAt))}</p>
</section>

<div class="kpis">
  <div class="kpi"><div class="n">${data.sources.pinnacle.matchups}</div><div class="l">Pinnacle LoL moneylines</div></div>
  <div class="kpi"><div class="n">${data.sources.thunderpick.matchups}</div><div class="l">Thunderpick LoL moneylines</div></div>
  <div class="kpi good"><div class="n">${data.mapping.marketRowsAttached}</div><div class="l">Prices mapped to a Hotspawn fixture</div></div>
  <div class="kpi"><div class="n">${data.sources.pinnacle.leagues.length}</div><div class="l">Pinnacle LoL competitions listed</div></div>
</div>

<section>
  <h2>All prices</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Kick-off (UTC)</th><th>Match</th><th>Competition</th><th>Book</th><th class="num">Odds A / B</th><th class="num">No-vig A / B</th><th class="num">Margin</th><th class="num">Name match</th><th>Source</th></tr></thead>
    <tbody>${bookRows.join("")}</tbody>
  </table></div>
  <p class="small">“Name match” is the automated similarity score (0–1) between the bookmaker's team names and the Hotspawn
  fixture after normalisation; anything below 0.72 is rejected rather than guessed.</p>
</section>

<section>
  <h2>How the maths works</h2>
  <div class="card">
    <p>American → decimal: <code>price &gt; 0 ? 1 + price/100 : 1 + 100/|price|</code><br>
    Implied: <code>1 / decimal</code><br>
    No-vig: <code>p<sub>team</sub> = implied<sub>team</sub> / (implied<sub>A</sub> + implied<sub>B</sub>)</code></p>
    <p>When both Pinnacle and Thunderpick price a match, Pinnacle is used as the primary (sharper, lower margin) and
    Thunderpick is the cross-check. If the two disagree on the favourite, the row is downgraded to <em>low</em> confidence
    and flagged.</p>
  </div>
</section>

<section>
  <h2>Competitions Pinnacle currently lists for LoL</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>League</th><th class="num">Matchups</th><th>API</th></tr></thead>
    <tbody>${data.sources.pinnacle.leagues.map((l) => `<tr><td>${esc(l.name)}</td><td class="num">${l.matchups}</td><td><a href="https://guest.api.arcadia.pinnacle.com/0.1/leagues/${l.id}/matchups" target="_blank" rel="noopener">endpoint ↗</a></td></tr>`).join("")}</tbody>
  </table></div>
</section>`;

await writeFile("markets.html", page({
  title: "Market lines",
  desc: "External bookmaker prices used for Hotspawn League of Legends match probabilities.",
  active: "markets.html",
  body: marketsBody,
}));

/* ----------------------------- UNRESOLVED ---------------------------- */
const groups = {};
for (const m of unresolved) (groups[m.competition] = groups[m.competition] || []).push(m);
const groupHtml = Object.entries(groups)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([comp, list]) => {
    const note = audit.perCompetition[comp] || audit.defaultNote;
    return `<section>
      <h2>${esc(comp)} <span class="pill warn">${list.length} unresolved</span></h2>
      <div class="note warn"><strong>Why these cannot be priced:</strong> ${note.why}<br>
      <strong>Sources checked:</strong> ${note.checked}<br>
      <strong>What would resolve it:</strong> ${note.resolve}</div>
      <div class="matches">${list.map(matchCard).join("")}</div>
    </section>`;
  })
  .join("");

const unresolvedBody = `
<section class="hero">
  <h1>Unresolved picks — ${unresolved.length} of ${upcoming.length} upcoming</h1>
  <p class="lede">These fixtures have <strong>no verifiable external betting line</strong>. We deliberately do not print a
  probability for them: a number with no source behind it would be a guess dressed up as analysis. Each match still links to
  its Hotspawn page so you can make your own pick.</p>
  <p class="updated">Last collection: ${esc(isoShort(data.generatedAt))}</p>
</section>

<div class="kpis">
  <div class="kpi bad"><div class="n">${unresolved.length}</div><div class="l">Upcoming without a line</div></div>
  <div class="kpi"><div class="n">${Object.keys(groups).length}</div><div class="l">Competitions affected</div></div>
  <div class="kpi good"><div class="n">${resolved.length}</div><div class="l">Upcoming that are priced</div></div>
  <div class="kpi"><div class="n">${audit.sources.length}</div><div class="l">Sources audited</div></div>
</div>

<section>
  <h2>Limitations, in plain language</h2>
  <div class="card">
    <ul>
      <li><strong>No market, no probability.</strong> A win probability can only be verified against a price someone is willing
      to lay. For amateur leagues no book posts a price, so there is nothing to verify.</li>
      <li><strong>Results data does not exist in machine-readable form.</strong> Liquipedia has stub pages for several of these
      leagues but no per-match scores; the Riot esports API does not carry PRM 2nd/3rd Division, Komplettligaen, Tunisian,
      4 Nations, RIVALS LEAGUE or the Icelandic league; bo3.gg has no team record for these rosters.</li>
      <li><strong>Rosters and form are not usable here.</strong> The only roster data available for these fixtures is on
      Hotspawn itself, which is excluded as a probability input by design.</li>
      <li><strong>This is not a gap we can close with a better model.</strong> Adding a model would add assumptions, not data.
      A 50/50 prior is the only defensible null value, and a 50/50 “pick” is not a pick — so we show nothing and say so.</li>
    </ul>
    <p class="small">Full source-by-source audit: <a href="method.html#audit">Method → source audit</a>.</p>
  </div>
</section>

${groupHtml}`;

await writeFile("unresolved.html", page({
  title: "Unresolved picks",
  desc: "Hotspawn League of Legends matches with no verifiable external betting line, and the limitations.",
  active: "unresolved.html",
  body: unresolvedBody,
}));

/* ------------------------------ METHOD ------------------------------- */
const sourceRows = audit.sources
  .map(
    (s) => `<tr>
      <td><strong>${esc(s.name)}</strong><div class="small">${esc(s.type)}</div></td>
      <td>${esc(s.outcome)}</td>
      <td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">open ↗</a>` : "—"}</td>
    </tr>`
  )
  .join("");

const methodBody = `
<section class="hero">
  <h1>Method &amp; source audit</h1>
  <p class="lede">How every number on this site is produced, and what was checked when it could not be.</p>
</section>

<section>
  <h2>Pipeline</h2>
  <div class="card">
    <ol>
      <li><strong>Inventory.</strong> <code>GET https://play.hotspawn.com/lol-pickems</code> — the page is Angular SSR and embeds its
      fixture list in <code>&lt;script id="ng-state"&gt;</code>. All ${data.inventory.fixtures} LoL fixtures are read from that JSON
      (id, competition, teams, kick-off, tier, stage, points). Hotspawn's crowd-pick percentages are captured but never used as a
      probability input.</li>
      <li><strong>Match links.</strong> Each rendered card contains the canonical
      <code>https://www.hotspawn.com/matches/…</code> URL; those are extracted so every row links to its source.</li>
      <li><strong>Prices.</strong> Pinnacle (guest API, no key) and Thunderpick (via bo3.gg) LoL moneylines are pulled for all
      competitions those books list.</li>
      <li><strong>Mapping.</strong> A price is attached to a fixture only when the kick-off times are within 8 hours <em>and</em>
      the normalised team-name similarity is ≥ 0.72 (either orientation). Otherwise the price is left unmatched and reported.</li>
      <li><strong>Probability.</strong> Decimal odds → implied → remove the margin by normalisation. Primary book = Pinnacle;
      Thunderpick is the cross-check.</li>
      <li><strong>Unresolved.</strong> No attached price ⇒ no probability. The fixture is published on
      <a href="unresolved.html">Unresolved</a> with the sources that were checked.</li>
    </ol>
  </div>
</section>

<section>
  <h2 id="audit">Source audit (what each source actually returned)</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Source</th><th>Outcome</th><th>Link</th></tr></thead>
    <tbody>${sourceRows}</tbody>
  </table></div>
  <p class="small">Audited ${esc(audit.auditedAt)}. Outcomes are recorded from live requests made by this project's collector and
  probes; nothing here is assumed.</p>
</section>

<section>
  <h2>Verification rules applied</h2>
  <div class="card">
    <ul>
      <li>Every match row links to its Hotspawn match page (or the lobby, where Hotspawn renders no card).</li>
      <li>Every probability row links to the exact external price it came from.</li>
      <li>No value is filled in by inference. Missing ⇒ blank + flagged.</li>
      <li>Name matching is logged with a score; low-confidence links are rejected, not published.</li>
      <li>If the Hotspawn lobby cannot be read, the last good dataset is kept and the failure recorded in
      <code>data/collect-errors.json</code> rather than publishing an empty site.</li>
    </ul>
  </div>
</section>

<section>
  <h2>Refresh</h2>
  <div class="card">
    <p>GitHub Actions runs the collector every 6 hours (<code>17 */6 * * *</code> UTC) and on demand, then rebuilds this site.
    Cadence target from the brief: every 4–8 hours.</p>
    <p class="small">This build: ${esc(isoShort(data.generatedAt))} · runtime ${data.collectionMs} ms · errors ${data.errors.length}.</p>
    ${data.errors.length ? `<div class="note bad"><strong>Errors in the last run:</strong><ul>${data.errors.map((e) => `<li>${esc(e.source)}: ${esc(e.error)}</li>`).join("")}</ul></div>` : `<div class="note"><strong>No errors in the last collection run.</strong></div>`}
  </div>
</section>

<section>
  <h2>Known limitations</h2>
  <div class="card">
    <ul>
      <li>Hotspawn's own site is Cloudflare-protected for automated clients on <code>www.hotspawn.com</code>; the collector uses
      <code>play.hotspawn.com</code>, which serves the same fixture data.</li>
      <li>Best-of format is <code>null</code> for every fixture in Hotspawn's transfer state, so the site does not display it.</li>
      <li>Completed fixtures are listed but not graded; the project reports probabilities at collection time only.</li>
    </ul>
  </div>
</section>`;

await writeFile("method.html", page({
  title: "Method",
  desc: "Data pipeline, formulas, source audit and verification rules.",
  active: "method.html",
  body: methodBody,
}));

/* ------------------------------ FLAGGED ------------------------------ */
const flagHtml = flags.items
  .map(
    (f) => `<article class="card" style="margin-bottom:12px">
      <div class="pickrow"><strong>${esc(f.id)} · ${esc(f.title)}</strong><span class="pill ${f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : "mut"}">${esc(f.severity)}</span></div>
      <p>${f.detail}</p>
      <p class="small"><strong>Evidence:</strong> ${f.evidence}</p>
      <p class="small"><strong>Status:</strong> ${esc(f.status)}</p>
    </article>`
  )
  .join("");

const flaggedBody = `
<section class="hero">
  <h1>Flagged for review</h1>
  <p class="lede">Irregularities found while verifying the repository, the source sites and the published data. Nothing here
  blocks publication — it is the audit trail.</p>
  <p class="updated">Last reviewed ${esc(audit.auditedAt)}</p>
</section>

<section>
  <h2>Automatic checks from the last collector run</h2>
  <div class="card">
    <ul>
      <li>Fixtures in transfer state: <strong>${data.inventory.fixtures}</strong>; rendered match cards: <strong>${data.inventory.renderedCards}</strong>;
      upcoming by kick-off time: <strong>${upcoming.length}</strong>.</li>
      <li>Market rows fetched: <strong>${data.mapping.marketRowsFetched}</strong>; attached to a fixture: <strong>${data.mapping.marketRowsAttached}</strong>;
      unmatched: <strong>${data.mapping.unmatchedMarkets.length}</strong>.</li>
      <li>Rows missing a match URL: <strong>${data.matches.filter((m) => !m.hotspawnUrl).length}</strong>.</li>
      <li>Resolved fixtures where the two books disagree on the favourite: <strong>${data.matches.filter((m) => m.market && m.market.agreement && !m.market.agreement.sameSide).length}</strong>.</li>
      <li>Collector errors: <strong>${data.errors.length}</strong>.</li>
    </ul>
    ${data.mapping.unmatchedMarkets.length ? `<div class="note warn"><strong>Unmatched external prices:</strong><ul>${data.mapping.unmatchedMarkets.map((u) => `<li>${esc(u.source)} — ${esc(u.match)} (${esc(u.startTime)})</li>`).join("")}</ul></div>` : `<div class="note"><strong>Every external price fetched was attached to a fixture.</strong></div>`}
  </div>
</section>

<section>
  <h2>Review items</h2>
  ${flagHtml}
</section>`;

await writeFile("flagged.html", page({
  title: "Flagged for review",
  desc: "Irregularities and unverified items found during verification.",
  active: "flagged.html",
  body: flaggedBody,
}));

/* ------------------------------ APP JS ------------------------------- */
const appJs = `// time-zone rendering + client-side filtering (progressive enhancement only)
(function () {
  var tzSel = document.getElementById('fTz');
  function fmt(iso) {
    var d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function applyTz(mode) {
    document.querySelectorAll('.when[data-fmt="utc"]').forEach(function (el) {
      var card = el.closest('[data-utc]');
      if (!card) return;
      if (mode === 'local') { el.textContent = fmt(card.dataset.utc) + ' local'; }
      else { el.textContent = el.dataset.orig || el.textContent; }
    });
  }
  document.querySelectorAll('.when').forEach(function (el) { el.dataset.orig = el.textContent; });
  if (tzSel) tzSel.addEventListener('change', function () { applyTz(tzSel.value); });

  var q = document.getElementById('q'), fComp = document.getElementById('fComp'), fRes = document.getElementById('fRes');
  var list = document.getElementById('list'), count = document.getElementById('count');
  function filter() {
    if (!list) return;
    var term = (q && q.value || '').toLowerCase().trim();
    var comp = fComp && fComp.value, res = fRes && fRes.value, shown = 0;
    list.querySelectorAll('.match').forEach(function (el) {
      var ok = (!term || el.dataset.search.indexOf(term) > -1)
        && (!comp || el.dataset.comp === comp)
        && (!res || el.dataset.res === res);
      el.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (count) count.textContent = 'Showing ' + shown + ' matches';
  }
  [q, fComp, fRes].forEach(function (el) { if (el) el.addEventListener('input', filter); });
})();
`;
await writeFile("assets/app.js", appJs);

console.log(`built: index, picks, markets, unresolved, method, flagged (${data.matches.length} matches)`);

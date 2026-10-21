import { mkdir, writeFile } from "node:fs/promises";
const UA = "Mozilla/5.0 (compatible; LOLHotspawnPicksBot/1.0)";
const B = "https://api.bo3.gg/api/v1";
const j = async (u) => {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "application/json" } });
  const t = await r.text();
  try { return { s: r.status, b: JSON.parse(t) }; } catch { return { s: r.status, b: { _raw: t.slice(0, 200) } }; }
};
await mkdir("_probe", { recursive: true });
const out = {};

const names = [
  "BlackDivision", "Babos Gaming Academy", "Ascent Gaming", "Turbo Gaming",
  "El Menzah Esports", "Team VDS", "Galions", "Gen.G", "G2",
  "Socken und Sandalen", "Karolinerna", "Absolved",
];
out.nameSearch = [];
for (const n of names) {
  const r = await j(`${B}/teams?filter[teams.discipline_id][eq]=3&filter[teams.name][like]=${encodeURIComponent(n)}&page[limit]=3`);
  const rows = (r.b.results || []).map((t) => ({ id: t.id, name: t.name, rank: t.rank }));
  out.nameSearch.push({ q: n, status: r.s, count: r.b?.total?.count, rows });
  await new Promise((r) => setTimeout(r, 120));
}

// match-history endpoint discovery for one known team (Solary 17873)
const sol = 17873;
const tries = [
  `${B}/teams/${sol}/matches?page[limit]=5`,
  `${B}/matches?filter[matches.team1_id][eq]=${sol}&page[limit]=5`,
  `${B}/matches?filter[matches.teams][eq]=${sol}&page[limit]=5`,
  `${B}/matches?filter[matches.team_ids][contains]=${sol}&page[limit]=5`,
];
out.history = [];
for (const u of tries) {
  const r = await j(u);
  out.history.push({ url: u.replace(B, ""), status: r.s, count: r.b?.total?.count ?? null, n: r.b?.results?.length ?? null, keys: r.b?.results?.[0] ? Object.keys(r.b.results[0]).slice(0, 20) : null, msg: r.b?.message || r.b?.status });
  await new Promise((r) => setTimeout(r, 120));
}

// how many LoL teams have a rank? sample 2 pages of 100
const ranked = [];
for (let page = 0; page < 2; page++) {
  const r = await j(`${B}/teams?filter[teams.discipline_id][eq]=3&page[limit]=100&page[offset]=${page * 100}`);
  const rows = r.b.results || [];
  ranked.push({ page, n: rows.length, withRank: rows.filter((t) => t.rank != null).length, sample: rows.slice(0, 2).map((t) => [t.name, t.rank]) });
  await new Promise((r) => setTimeout(r, 120));
}
out.rankSample = ranked;

await writeFile("_probe/coverage.json", JSON.stringify(out, null, 1));
console.log("done", JSON.stringify({ names: out.nameSearch.length }));

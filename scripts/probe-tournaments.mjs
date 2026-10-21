import { mkdir, writeFile } from "node:fs/promises";
const UA = "LOLHotspawnPicksBot/1.0 (https://github.com/karagemop466-tech/LOLHOTSPAWN3)";
const B = "https://api.bo3.gg/api/v1";
const j = async (u, h = {}) => {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "application/json", ...h } });
  const t = await r.text();
  try { return { s: r.status, b: JSON.parse(t) }; } catch { return { s: r.status, b: { _raw: t.slice(0, 200) } }; }
};
await mkdir("_probe", { recursive: true });
const out = { bo3Tournaments: [], liquipedia: {} };

for (const q of ["Prime League", "PRM", "Komplettligaen", "Tunisian", "RIVALS", "4 Nations", "Icelandic", "Arabian League", "CELOL", "Benelux"]) {
  const r = await j(`${B}/tournaments?filter[tournaments.discipline_id][eq]=3&filter[tournaments.name][like]=${encodeURIComponent(q)}&page[limit]=8`);
  const rows = (r.b?.results || []).map((t) => ({ id: t.id, name: t.name, start: (t.start_date || "").slice(0, 10) }));
  out.bo3Tournaments.push({ q, status: r.s, count: r.b?.total?.count ?? null, rows });
  await new Promise((r) => setTimeout(r, 150));
}

// Liquipedia: check a tournament page's wikitext structure (match results parseable?)
const LQ = "https://liquipedia.net/leagueoflegends/api.php";
async function wikitext(page) {
  const r = await j(`${LQ}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}`);
  return r.b?.parse?.wikitext?.["*"] || r.b?.error?.code || r.b?._raw || "none";
}
for (const p of ["Komplettligaen/2026/Autumn", "Prime League/2026/Fall", "RIVALS LEAGUE/Season 2"]) {
  const wt = await wikitext(p);
  const s = typeof wt === "string" ? wt : JSON.stringify(wt);
  out.liquipedia[p] = {
    len: s.length,
    hasMatch: /\{\{Match|MatchMaps|matchmaps/i.test(s),
    hasGroupTable: /GroupTable/i.test(s),
    head: s.slice(0, 700),
  };
  await new Promise((r) => setTimeout(r, 2500));
}
await writeFile("_probe/bo3-tournaments.json", JSON.stringify(out, null, 1));
console.log("done");

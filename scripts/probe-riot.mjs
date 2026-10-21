import { mkdir, writeFile } from "node:fs/promises";
const UA = "Mozilla/5.0 (compatible; LOLHotspawnPicksBot/1.0)";
const RIOT_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"; // public web key used by lolesports.com
const j = async (u, h = {}) => {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "application/json", ...h } });
  const t = await r.text();
  try { return { s: r.status, b: JSON.parse(t) }; } catch { return { s: r.status, b: { _raw: t.slice(0, 300) } }; }
};
await mkdir("_probe", { recursive: true });
const out = {};

// 1) Riot leagues
const leagues = await j("https://esports-api.lolesports.com/persisted/gw/getLeagues?hl=en-US", { "x-api-key": RIOT_KEY });
out.riotLeaguesStatus = leagues.s;
out.riotLeagues = (leagues.b?.data?.leagues || []).map((l) => ({ id: l.id, name: l.name, slug: l.slug, region: l.region }));

// 2) Riot schedule for a page
const sched = await j("https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-US", { "x-api-key": RIOT_KEY });
const evs = sched.b?.data?.schedule?.events || [];
out.riotScheduleStatus = sched.s;
out.riotSchedule = {
  n: evs.length,
  leagues: [...new Set(evs.map((e) => e.league?.name))],
  sample: evs.slice(0, 3).map((e) => ({ start: e.startTime, league: e.league?.name, block: e.blockName, teams: (e.match?.teams || []).map((t) => t.name), state: e.state })),
};

// 3) EGamersWorld LOL match list -> event coverage + odds
const eg = await fetch("https://egamersworld.com/lol/matches", { headers: { "user-agent": UA, accept: "text/html" } });
const html = await eg.text();
const events = [...html.matchAll(/href="https:\/\/egamersworld\.com\/lol\/event\/([^"]+)"[^>]*>([^<]+)</g)].map((m) => m[2].trim());
out.egamersworld = {
  status: eg.status,
  bytes: html.length,
  uniqEvents: [...new Set(events)],
  eventCount: new Set(events).size,
  hasOddsDecimal: /"odds"|coeff|23\.10\.26/.test(html),
  otherUrls: [...new Set((html.match(/https:\/\/egamersworld\.com\/lol\/(events|event|matches|tournaments)[^"']*/g) || []))].slice(0, 10),
};

// 4) www.hotspawn.com match page accessibility (Cloudflare?)
const hs = await fetch("https://www.hotspawn.com/matches/galions-vs-solary-em-2026-summer-main-event-1081205", {
  headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "text/html" },
  redirect: "follow",
});
const hb = await hs.text();
out.hotspawnMatchPage = { status: hs.status, bytes: hb.length, cloudflare: /Just a moment|cf-browser-verification|challenge-platform/.test(hb) };

await writeFile("_probe/riot-eg.json", JSON.stringify(out, null, 1));
console.log("done");

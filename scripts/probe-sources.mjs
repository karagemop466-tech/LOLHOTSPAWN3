import { mkdir, writeFile } from "node:fs/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const B = "https://api.bo3.gg/api/v1";
const out = {};

async function j(url, headers = {}) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json", ...headers } });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { _nonjson: text.slice(0, 300) };
  }
  return { status: r.status, body };
}

await mkdir("_probe", { recursive: true });

/* ---------------- bo3.gg ---------------- */
const bo3 = {};
bo3.teamsLol = await j(`${B}/teams?filter[teams.discipline_id][eq]=3&page[limit]=3`);
bo3.teamByName = await j(`${B}/teams?filter[teams.discipline_id][eq]=3&filter[teams.name][like]=Solary&page[limit]=3`);
bo3.tournaments = await j(`${B}/tournaments?filter[tournaments.discipline_id][eq]=3&page[limit]=3`);
bo3.players = await j(`${B}/players?filter[players.discipline_id][eq]=3&page[limit]=1`);
bo3.matchDetail = await j(`${B}/matches/130167`);
bo3.upcoming = await j(`${B}/matches?filter[matches.discipline_id][eq]=3&filter[matches.status][eq]=upcoming&page[limit]=50`);
out.bo3 = {
  teams: { status: bo3.teamsLol.status, total: bo3.teamsLol.body?.total, sample: bo3.teamsLol.body?.results?.[0] },
  teamByName: { status: bo3.teamByName.status, total: bo3.teamByName.body?.total, sample: bo3.teamByName.body?.results?.[0] },
  tournaments: { status: bo3.tournaments.status, total: bo3.tournaments.body?.total, sample: bo3.tournaments.body?.results?.[0] },
  matchDetail: { status: bo3.matchDetail.status, keys: bo3.matchDetail.body ? Object.keys(bo3.matchDetail.body) : null, hasOdds: !!(bo3.matchDetail.body && bo3.matchDetail.body.bet_updates) },
  upcomingCount: bo3.upcoming.body?.total?.count,
  upcoming: (bo3.upcoming.body?.results || []).map((m) => ({
    id: m.id,
    slug: m.slug,
    start: m.start_date,
    tournament_id: m.tournament_id,
    tier: m.tier,
    bo: m.bo_type,
    t1: m.team1_id,
    t2: m.team2_id,
    odds: m.bet_updates
      ? {
          provider: m.bet_updates.provider,
          path: m.bet_updates.path,
          t1: m.bet_updates.team_1 && { name: m.bet_updates.team_1.name, coeff: m.bet_updates.team_1.coeff },
          t2: m.bet_updates.team_2 && { name: m.bet_updates.team_2.name, coeff: m.bet_updates.team_2.coeff },
        }
      : null,
  })),
};
await writeFile("_probe/bo3-upcoming.json", JSON.stringify(bo3.upcoming.body, null, 1));

/* ---------------- Pinnacle ---------------- */
const P = "https://guest.api.arcadia.pinnacle.com/0.1";
const pin = {};
const leagues = await j(`${P}/sports/12/leagues`);
const lolLeagues = (leagues.body || []).filter((l) => /league of legends/i.test(l.name));
pin.lolLeagues = lolLeagues.map((l) => ({ id: l.id, name: l.name, group: l.group, matchupCount: l.matchupCount }));
pin.leagueSample = lolLeagues[0];
const pinMatchups = [];
for (const l of lolLeagues) {
  const mu = await j(`${P}/leagues/${l.id}/matchups`);
  for (const m of mu.body || []) {
    if (m.type !== "matchup") continue;
    const parts = m.participants || [];
    if (parts.length !== 2) continue;
    const mk = await j(`${P}/matchups/${m.id}/markets/related/straight`);
    const ml = (mk.body || []).find((x) => x.type === "moneyline" && x.period === 1) ||
      (mk.body || []).find((x) => x.type === "moneyline");
    pinMatchups.push({
      league: l.name,
      id: m.id,
      startTime: m.startTime,
      home: parts[0].name,
      away: parts[1].name,
      moneyline: ml ? ml.prices.map((p) => ({ d: p.designation, price: p.price })) : null,
      nMarkets: (mk.body || []).length,
    });
    await new Promise((r) => setTimeout(r, 150));
  }
}
pin.matchups = pinMatchups;
out.pinnacle = pin;
await writeFile("_probe/pinnacle.json", JSON.stringify(pin, null, 1));

/* ---------------- Leaguepedia ---------------- */
const lp = {};
try {
  lp.rate = await j(
    "https://lol.fandom.com/api.php?action=cargoquery&tables=MatchSchedule&fields=Team1,Team2,DateTime_UTC,Tournament,OverviewPage&where=DateTime_UTC%3E%272026-10-01%2000:00:00%27&limit=3&format=json",
    { "user-agent": "LOLHotspawnPicksBot/1.0 (github.com/karagemop466-tech/LOLHOTSPAWN3)" }
  );
} catch (e) {
  lp.error = String(e);
}

/* ---------------- Liquipedia ---------------- */
const lq = {};
try {
  lq.search = await j(
    "https://liquipedia.net/leagueoflegends/api.php?action=query&format=json&list=search&srsearch=PRM%203rd%20Division&srlimit=5",
    { "user-agent": "LOLHotspawnPicksBot/1.0 (contact: github.com/karagemop466-tech/LOLHOTSPAWN3)" }
  );
} catch (e) {
  lq.error = String(e);
}
out.leaguepedia = lp;
out.liquipedia = lq;

await writeFile("_probe/sources-summary.json", JSON.stringify(out, null, 1));
console.log("bo3 upcoming", bo3.upcoming.body?.total?.count, "pinnacle lol leagues", pin.lolLeagues.length, "pinnacle matchups", pinMatchups.length);

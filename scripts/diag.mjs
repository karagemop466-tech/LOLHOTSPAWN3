import { readFile, writeFile, mkdir } from "node:fs/promises";
await mkdir("_probe", { recursive: true });
const d = JSON.parse(await readFile("data/matches.json", "utf8"));
const out = [];
const p = (...a) => out.push(a.join(" "));

p("generatedAt", d.generatedAt, "collectionMs", d.collectionMs);
p("inventory", JSON.stringify(d.inventory));
p("counts", JSON.stringify(d.counts));
p("sources", JSON.stringify(d.sources.pinnacle.leagues), "pinnacle matchups", d.sources.pinnacle.matchups, "thunderpick", d.sources.thunderpick.matchups);
p("errors", JSON.stringify(d.errors));
p("mapping", JSON.stringify({ fetched: d.mapping.marketRowsFetched, attached: d.mapping.marketRowsAttached }));
p("--- unmatched market rows ---");
for (const u of d.mapping.unmatchedMarkets) p("  ", u.source, "|", u.match, "|", u.startTime);
p("--- competitions ---");
for (const c of d.competitions) p("  ", String(c.total).padStart(3), "tot", String(c.upcoming).padStart(3), "up", String(c.market).padStart(3), "mkt", "|", c.name);
p("--- matches with market ---");
for (const m of d.matches.filter((x) => x.market)) {
  p("  ", m.startUtc.slice(0, 16), m.teamA, "vs", m.teamB, "|", m.market.source, m.market.oddsA, m.market.oddsB,
    "->", (m.probA * 100).toFixed(1) + "/" + (m.probB * 100).toFixed(1), "| pick", m.pick, m.confidence,
    "| books", m.market.books.length, m.market.agreement ? `agree=${m.market.agreement.sameSide} spread=${m.market.agreement.spreadPts}` : "");
}
p("--- next 12 upcoming ---");
for (const m of d.matches.filter((x) => x.status === "upcoming").slice(0, 12))
  p("  ", m.startUtc.slice(0, 16), m.tier, "|", m.competition, "|", m.teamA, "vs", m.teamB, "|", m.resolution, "| url:", m.hotspawnUrl ? "ok" : "MISSING");
p("--- missing permalinks:", d.matches.filter((m) => !m.hotspawnUrl).length);
await writeFile("_probe/diag.txt", out.join("\n"));
console.log(out.slice(0, 12).join("\n"));

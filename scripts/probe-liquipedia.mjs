import { mkdir, writeFile } from "node:fs/promises";
const UA =
  "LOLHotspawnPicksBot/1.0 (https://github.com/karagemop466-tech/LOLHOTSPAWN3; contact via GitHub issues)";
const LQ = "https://liquipedia.net/leagueoflegends/api.php";
const j = async (u, attempt = 0) => {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "application/json", "accept-encoding": "gzip" } });
  const t = await r.text();
  try {
    const b = JSON.parse(t);
    if (b.error && b.error.code === "ratelimited" && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      return j(u, attempt + 1);
    }
    return { s: r.status, b };
  } catch {
    return { s: r.status, b: { _raw: t.slice(0, 200) } };
  }
};
await mkdir("_probe", { recursive: true });

const comps = [
  "PRM 3rd Division 26-27 Fall", "PRM 2nd Division 26-27 Fall", "RIVALS LEAGUE Season 2",
  "Tunisian Super League 2026", "4 Nations 2026 Halloween Heist", "Komplettligaen 2026 Autumn",
  "Icelandic Esports League 2026 Autumn", "Arabian League 2nd Division 2026 Summer",
  "Worlds 2026", "Arabian Regional Championship 2026 Lebanon Libya", "Superstrike League 2026",
  "Benelux Ascend Series Rising 2026", "Benelux Ascend Series 2027 Winter Promotion",
  "LigaGG CELOL B 2026", "LigaGG CELOL A 2026", "EMEA Masters 2026 Summer",
  "FPL 2026 Summer", "LIT 2027 Winter Promotion", "POP Esports Masters Season 7",
  "Legends Academy Zabka Season 3", "Hitpoint 2nd Div Challengers 2026", "LGC Rising 2026",
  "LCP 2027 Promotion", "Benelux Ascend Series 2026 Summer",
];
const out = [];
for (const c of comps) {
  const r = await j(`${LQ}?action=query&format=json&list=search&srlimit=4&srsearch=${encodeURIComponent(c)}`);
  const hits = r.b?.query?.searchinfo?.totalhits ?? null;
  const titles = (r.b?.query?.search || []).map((x) => x.title);
  out.push({ q: c, status: r.s, hits, titles, err: r.b?.error?.code });
  await new Promise((r) => setTimeout(r, 2200));
}
await writeFile("_probe/liquipedia-search.json", JSON.stringify(out, null, 1));
console.log("done", out.length);

import { mkdir, writeFile } from "node:fs/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function get(url, extra = {}) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.8", ...extra },
    redirect: "follow",
  });
  return { status: r.status, headers: Object.fromEntries(r.headers), text: await r.text() };
}

await mkdir("_probe", { recursive: true });

const out = [];
const log = (...a) => out.push(a.map(String).join(" "));

const r = await get("https://play.hotspawn.com/lol-pickems");
log("STATUS", r.status, "LEN", r.text.length);
log("HEADERS", JSON.stringify(r.headers));
const t = r.text;

const idx = t.indexOf("View Match");
log("IDX_VIEW_MATCH", idx);
log("---- WINDOW AROUND FIRST MATCH ----");
log(t.slice(Math.max(0, idx - 4000), idx + 2500));
log("---- SCRIPT TAGS ----");
for (const m of t.matchAll(/<script[^>]*>/g)) log(m[0]);

await writeFile("_probe/lobby-sample.txt", out.join("\n"), "utf8");

// Save the raw html too, truncated, for structural analysis
await writeFile("_probe/lobby-raw-head.html", t.slice(0, 200000), "utf8");

// Count structures
const stats = {
  len: t.length,
  views: (t.match(/View Match/g) || []).length,
  dataAttrs: [...new Set([...t.matchAll(/data-[a-z-]+=/g)].map((m) => m[0]))].sort(),
  classes: [...new Set([...t.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))].sort(),
};
await writeFile("_probe/stats.json", JSON.stringify(stats, null, 2), "utf8");
console.log("done", JSON.stringify({ ...stats, classes: stats.classes.length, dataAttrs: stats.dataAttrs.length }));

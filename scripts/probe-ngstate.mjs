import { mkdir, writeFile } from "node:fs/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

await mkdir("_probe", { recursive: true });
const r = await fetch("https://play.hotspawn.com/lol-pickems", {
  headers: { "user-agent": UA, accept: "text/html" },
});
const html = await r.text();
const m = html.match(/<script id="ng-state"[^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.log("NO NG-STATE");
  await writeFile("_probe/ngstate-missing.txt", html.slice(-5000));
  process.exit(0);
}
const raw = m[1];
await writeFile("_probe/ng-state.raw.json", raw);

let state;
try {
  state = JSON.parse(raw);
} catch (e) {
  console.log("PARSE ERR", e.message);
  await writeFile("_probe/ngstate-parse-err.txt", raw.slice(0, 5000));
  process.exit(0);
}

const summary = [];
function walk(node, path, depth) {
  if (depth > 6) return;
  if (Array.isArray(node)) {
    summary.push(`${path} : ARRAY(${node.length})`);
    if (node.length && typeof node[0] === "object") describe(node[0], path + "[0]", depth + 1);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, depth + 1);
  }
}
function describe(obj, path, depth) {
  if (Array.isArray(obj)) return walk(obj, path, depth);
  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj);
    summary.push(`${path} : OBJECT keys=[${keys.slice(0, 40).join(", ")}]`);
    for (const k of keys.slice(0, 40)) {
      const v = obj[k];
      if (Array.isArray(v)) walk(v, `${path}.${k}`, depth + 1);
      else if (v && typeof v === "object") describe(v, `${path}.${k}`, depth + 1);
    }
  }
}
walk(state, "$", 0);
await writeFile("_probe/ng-state-shape.txt", summary.join("\n"), "utf8");

// find arrays that look like match lists
const found = [];
function scan(node, path) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    if (node.length && node[0] && typeof node[0] === "object") {
      const keys = Object.keys(node[0]).join(",");
      if (/fixture|match|team|home|away/i.test(keys))
        found.push(`${path}:ARRAY(${node.length}) sample=${JSON.stringify(node[0]).slice(0, 600)}`);
      node.forEach((n, i) => scan(n, `${path}[${i}]`));
    }
    return;
  }
  for (const [k, v] of Object.entries(node)) scan(v, `${path}.${k}`);
}
scan(state, "$");
await writeFile("_probe/ng-state-candidates.txt", found.join("\n\n"), "utf8");
console.log("state bytes", raw.length, "candidates", found.length);

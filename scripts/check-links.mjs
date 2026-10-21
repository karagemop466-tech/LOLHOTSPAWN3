#!/usr/bin/env node
/**
 * check-links.mjs — verifies the generated site has no broken internal links
 * and that every external source link is a well-formed absolute https URL.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = ".";
const pages = (await readdir(ROOT)).filter((f) => f.endsWith(".html"));
const problems = [];
let internal = 0, external = 0;
const externals = new Map();

for (const p of pages) {
  const html = await readFile(p, "utf8");
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = m[1];
    if (href.startsWith("#") || href.startsWith("data:") || href.startsWith("mailto:")) continue;
    if (/^https?:\/\//.test(href)) {
      external++;
      if (!href.startsWith("https://")) problems.push(`${p}: non-https external link ${href}`);
      try {
        const u = new URL(href);
        if (!u.hostname.includes(".")) problems.push(`${p}: odd host ${href}`);
      } catch {
        problems.push(`${p}: malformed URL ${href}`);
      }
      externals.set(href, (externals.get(href) || 0) + 1);
      continue;
    }
    internal++;
    const clean = href.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = path.join(ROOT, clean);
    if (!existsSync(target)) problems.push(`${p}: broken internal link ${href}`);
    else if ((await stat(target)).size === 0 && clean.endsWith(".html")) problems.push(`${p}: empty page ${href}`);
  }
}

// sanity: every page title/desc present, every page has the nav
for (const p of pages) {
  const html = await readFile(p, "utf8");
  if (!/<title>/.test(html)) problems.push(`${p}: missing <title>`);
  if (!/name="viewport"/.test(html)) problems.push(`${p}: missing viewport meta (mobile)`);
  if (!/class="main"/.test(html)) problems.push(`${p}: missing navigation`);
}

console.log(`pages: ${pages.join(", ")}`);
console.log(`internal links checked: ${internal}; external links checked: ${external} (${externals.size} unique)`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const x of problems) console.error(" -", x);
  process.exit(1);
}
console.log("OK: no broken internal links, all external links are absolute https URLs.");

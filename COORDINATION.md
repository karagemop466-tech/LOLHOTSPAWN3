# COORDINATION — LOLHOTSPAWN3

Shared task board. One row per task; claim before working, record sources/verification when done.
Status values: `unclaimed` · `in progress` · `done` · `needs review`.

**Active session:** `arena/1882cf1a-lolhotspawn3` (this branch)
**Pages target:** `main` → `/` (legacy branch build; the site is generated at the repo root)

| # | Task | Status | Owner (session) | File scope |
|---|---|---|---|---|
| T1 | Reverse-engineer Hotspawn LoL lobby → full fixture inventory (264) | done | `a8d3a4de` then `1882cf1a` | `scripts/collect.mjs`, `data/matches.json` |
| T2 | Canonical match URLs for every fixture | done | `1882cf1a` | `scripts/collect.mjs` |
| T3 | External market lines (Pinnacle, Thunderpick/bo3.gg) + no-vig probabilities | done | `1882cf1a` | `scripts/collect.mjs`, `data/matches.json` |
| T4 | Own-line / unresolved framework + per-competition limitations | done | `1882cf1a` | `data/source-audit.json`, `unresolved.html` |
| T5 | Mobile-first site: executive summary + picks/markets/unresolved/method/flagged | done | `1882cf1a` | `scripts/build.mjs`, `scripts/site/`, site HTML at repo root |
| T6 | Automated 6-hour refresh | done | `1882cf1a` | `.github/workflows/refresh.yml` |
| T7 | Fix Pages deployment (broken since PR #1) | done | `1882cf1a` | Pages settings, `.github/workflows/pages.yml` (removed) |
| T8 | Repo review + irregularity log | done → **needs review** | `1882cf1a` | `data/flags.json`, `flagged.html` |
| T9 | PR → merge → verify live site | in progress | `1882cf1a` | — |
| T10 | Integrate parallel session `40177473` (archive, no deletion) | done | `1882cf1a` | `archive/**`, `COORDINATION.md` |
| T11 | Add Polymarket as third market source | done | `1882cf1a` | `scripts/collect.mjs`, `data/source-audit.json` |

## Hand-off log

- **2026-10-21 ~19:45 UTC — session `a8d3a4de`** claimed the whole scope ("sole session, full scope claimed & done"),
  merged PR #1 to `main`. Delivered `data/matches.json` with **8 hand-typed fixtures** and prose odds strings drawn from
  tipster/SEO pages, a `refresh.yml` that re-ran a build script fetching nothing, and a `pages.yml` deploy workflow that
  failed on every push (Pages is configured for legacy branch deployment). Details: flags **F1**, **F2**.
- **2026-10-21 20:2x UTC — session `1882cf1a`** took over. It did **not** reuse the 8 hardcoded rows. Replaced the pipeline with an
  automated collector, regenerated the dataset (264 fixtures), rebuilt the site, removed `pages.yml` and `scripts/build.py`,
  and site generated at the repo root (Pages serves `main:/`). The earlier data is preserved in git history (`a730803`) and documented on the
  Flagged page rather than silently deleted.
- **2026-10-21 20:2x UTC** — two additional workflow runs appeared from `arena/a8d3a4de-lolhotspawn3` after its PR was merged
  (runs 39669259401, 39669471096). The branch no longer exists on the remote; no files were touched by those runs.
- **2026-10-21 ~20:35 UTC — session `40177473`** merged PR #4 with a full 264-fixture dataset and a root-level site built by
  `scripts/build.py` + `scripts/update_picks.py`. It originated probabilities for 171 fixtures via `MODEL_STANDINGS`
  (see flag **F11**): the cited standings records could not be reproduced from any source reachable by automation, so those
  numbers are **not published** here. Its work is preserved verbatim under `archive/data/` and `archive/pages/` and was
  not deleted.
- **2026-10-21 ~20:45 UTC — session `1882cf1a` (integration)** resolved the merge without discarding anything:
  created files (`index.html`, `picks.html`, `markets.html`, `unresolved.html`, `method.html`, `flagged.html`, `assets/*`,
  `data/matches.json`) resolved in favour of this branch because they are generated from the verified dataset and regenerate
  on every run; the duplicate `docs/` build was removed because Pages serves `main:/`; the parallel session's scripts and
  datasets were moved to `archive/`; their `methodology.html` was archived to `archive/pages/methodology.html`.
  **No conflict remains open.**

## Verification performed by `1882cf1a`

Sources are only "used" if a live request returned the data (all links re-checkable):

| Source | Live result | Used for |
|---|---|---|
| `play.hotspawn.com/lol-pickems` | HTTP 200, 264 fixtures in `ng-state`, 195 rendered cards | inventory + match URLs |
| Pinnacle guest API | HTTP 200; 2 LoL leagues, 9 moneylines | primary probabilities |
| bo3.gg / Thunderpick | HTTP 200; 42 upcoming LoL, 10 with prices | cross-check probabilities |
| Polymarket gamma API | HTTP 200; 9 per-match LoL markets (8 Worlds + 1 EMEA) via `public-search` | third cross-check |
| Liquipedia API | HTTP 200; stub pages, no per-match data | coverage proof |
| Riot esports API | HTTP 200; 51 leagues, no PRM 2nd/3rd, no prices | coverage proof |
| Leaguepedia Cargo | `ratelimited` error | excluded |
| Oddspedia | HTTP 410 Gone | excluded |
| EGamersWorld / GGScore | HTTP 403 / reCAPTCHA | excluded |
| `www.hotspawn.com` (match pages, wp-json) | Cloudflare HTTP 403 to Actions | not depended on |

Cross-checks run on the published dataset:
- 195 rendered lobby cards == 195 upcoming fixtures in the transfer state.
- 195/195 upcoming fixtures have a canonical match URL taken from Hotspawn's own HTML.
- 36 external price rows fetched → 25 unique attached to a fixture (duplicates are the same Polymarket event reached
  from both the Pinnacle and Thunderpick seeds; unmatched rows are logged, not hidden).
- 9 upcoming fixtures priced; 186 explicitly unresolved (no fabricated values).

## Irregularities / needs review

Published on the live **Flagged for review** page (`flagged.html`) with source links:
F1 hand-typed previous dataset · F2 broken Pages deploy · F3 Cloudflare blocking · F4 186 fixtures with no market ·
F5 Pinnacle futures excluded · F6 `best_of` null everywhere · F7 name variance (LØS/LOS) · F8 no URL for completed fixtures ·
F9 Leaguepedia/Oddspedia unusable · F10 Hotspawn pick % excluded by design.

## PR / merge record

- Session branch: `arena/1882cf1a-lolhotspawn3`
- PR: _(recorded after creation)_
- Merge result: _(recorded after merge)_
- Pages deploy: _(recorded after verification)_

## Final dataset of record (regenerated on every run)

| Metric | Value |
|---|---|
| Hotspawn LoL fixtures | 264 (27 competitions) |
| Upcoming | 195 |
| Started / completed | 69 |
| Upcoming with a verified external line | 9 |
| Upcoming unresolved (documented, no fabricated values) | 186 |
| Pinnacle LoL moneylines | 9 |
| Thunderpick LoL moneylines | 9 |
| Polymarket per-match LoL markets | 9 |
| External price rows attached to a fixture | 25 unique |
| Canonical match links from Hotspawn HTML | 195 / 195 upcoming |
| Collector errors (last run) | 0 |

# Hotspawn LoL Picks

A fully automated dashboard for **every League of Legends match listed in the [Hotspawn Pick'ems LoL lobby](https://play.hotspawn.com/lol-pickems)** — with a pick and a win probability wherever an **external bookmaker** prices the match, and an explicit *unresolved* section where no market exists.

Live site: **https://karagemop466-tech.github.io/LOLHOTSPAWN3/**

## What it does

| Step | Source | Where |
|---|---|---|
| Inventory of all LoL fixtures | `play.hotspawn.com/lol-pickems` (Angular transfer state + rendered cards) | `scripts/collect.mjs` |
| Match links | canonical `www.hotspawn.com/matches/…` URLs read from the lobby cards | `scripts/collect.mjs` |
| Market lines | Pinnacle guest API (sharp) + Thunderpick via bo3.gg (cross-check) | `scripts/collect.mjs` |
| Probability | decimal odds → implied → margin removed (no-vig) | `scripts/collect.mjs` |
| Site | static HTML built from `data/*.json` | `scripts/build.mjs` → repo root |
| Refresh | GitHub Actions every 6 hours (`17 */6 * * *` UTC) + manual | `.github/workflows/refresh.yml` |

Hotspawn's own pick percentages are **never** used as a probability input. This is enforced in code: the fields are stored for transparency only and no calculation reads them.

## Pages

- `index.html` — executive summary, KPIs, in-site links, coverage by competition, refresh status
- `picks.html` — all upcoming matches, searchable/filterable, mobile-first cards
- `markets.html` — every external price with bookmaker, odds, margin, no-vig probability and a source link
- `unresolved.html` — every match with no verifiable external line, grouped by competition, with the sources checked and what would resolve it
- `method.html` — pipeline, formulas, source audit, verification rules
- `flagged.html` — irregularities and unverified items for review

## Data

- `data/matches.json` — canonical dataset (264 fixtures, per-match resolution + sources)
- `data/matches.csv` — spreadsheet export
- `data/source-audit.json` — what each external source actually returned
- `data/flags.json` — review items rendered on the Flagged page
- `research/` — raw probe output used for the source audit

## Coverage reality check

At the time of writing: **264 fixtures / 27 competitions**, of which **195 upcoming**. Only **9** have an external moneyline (Worlds 2026 Swiss R1 and the EMEA Masters final). The rest are amateur/semi-pro leagues that no bookmaker prices and no data feed carries in machine-readable form. Those rows carry **no probability** — inventing one would be a guess, not analysis. See `unresolved.html`.

## Run locally

```bash
node scripts/collect.mjs   # needs outbound network to play.hotspawn.com, Pinnacle, bo3.gg
node scripts/build.mjs     # regenerates the site at the repo root
python3 -m http.server 8000
```

## Coordination

Multiple agent sessions may work on this repository. See [`COORDINATION.md`](COORDINATION.md) for the task board, ownership and the hand-off/irregularity log.

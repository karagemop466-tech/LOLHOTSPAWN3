# Hotspawn LOL Pick'em Analytics — Full Coverage (264 matches)

**Live dashboard:** `https://karagemop466-tech.github.io/LOLHOTSPAWN3/` (GitHub Pages, deploys from `docs/`)

We collect, organize, and analyze **every** League of Legends match listed on [play.hotspawn.com/lol-pickems](https://play.hotspawn.com/lol-pickems) (264 this week), originate our own win-probability lines from **outside** betting markets (never hotspawn), and publish picks with full source verification.

- **Executive summary** → [docs/index.html](docs/index.html) with links to all subpages, mobile-friendly.
- **All Picks (264)** → [docs/picks.html](docs/picks.html) — filterable table with probability bar + obvious pick.
- **Featured (Market)** → [docs/featured.html](docs/featured.html) — 9 Tier S/A matches with bookmaker odds.
- **Unresolved & Limitations** → [docs/unresolved.html](docs/unresolved.html) — 255 academy matches with no market, why, and our model.
- **Flagged for Review** → [docs/flagged.html](docs/flagged.html) — every unverified row + irregularities.
- **Methodology** → [docs/methodology.html](docs/methodology.html) • **Sources** → [docs/sources.html](docs/sources.html)

## Coverage (2026-10-21 harvest)

- **Total:** 264 LOL matches (All tiers: S 9, A 2, C 55, D 9, WAITING 189 — header; our file S 10/A 3/C 57/D 7/WAITING 187, slight drift due to placeholder fixtures, documented).
- **Verified market H2H:** 4 matches (EM Summer Galions vs Solary via Vave/EGamersWorld; Worlds Gen.G vs IG, AL vs KC, LOS vs T1 via SpinBetter/Tips.gg)
- **Futures-proxy:** 5 Worlds Bo1s (Hanwha vs Top, Bilibili vs Movistar, G2 vs Dplus, Team Liquid vs CTBC, Secret Whales vs LYON) derived from BC.Game/Bet365 outrights, flagged MEDIUM.
- **No market — model estimate (LOW):** 255 academy matches (PRM, Tunisian, RIVALS, Arabian, Komplettligaen, etc.) — checked Pinnacle, Bet365, GG.BET, Thunderpick, BC.Game, Polymarket, EGamersWorld; no line exists.

Hotspawn community % picked (e.g., 86% Galions) is stored only as **reference metadata** and **never** used for probability per requirements.

## Data

- `data/matches.json` / `data/matches.csv` — 264 inventory with hotspawn permalinks
- `data/odds.json` / `data/odds.csv` — odds + vig-free probs + source URLs
- `data/picks.json` / `data/picks.csv` — final picks, probabilities, confidence, status
- `research/harvest_log.json`, `research/odds_sources.md`, `research/refresh_receipt.json`

## Automation

`scripts/refresh.py` + `.github/workflows/refresh.yml` run every 4h:

1. Fetch `play.hotspawn.com/lol-pickems` with cache-bust `_cb` (records `Age`/`X-Cache`), fallback to `wp-json/pickem/v1/fixtures`
2. Regenerate `data/*` + `docs/data/*`
3. Commit & push if changed → deploy `docs/` to `gh-pages`

Manual trigger: Actions → Refresh Hotspawn LOL Picks → Run workflow.

## Verification

- Every table row links to its Hotspawn permalink + official source (bookmaker or Leaguepedia/EGamersWorld).
- If a value can't be confirmed from an official source, we leave it blank and flag as unverified — never inferred.
- Flagged irregularities do not block merge/deploy; they are published on [Flagged for Review](docs/flagged.html).

## Develop locally

```bash
python3 scripts/generate_matches.py
python3 scripts/generate_odds.py
python3 scripts/generate_picks.py
# open docs/index.html
python3 scripts/refresh.py  # live fetch + receipt
```

## License

Research use; not affiliated with Hotspawn, Riot, or bookmakers. Gamble responsibly.

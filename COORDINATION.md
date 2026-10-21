# Coordination Board

**Session ID**: `arena/40177473-lolhotspawn3`  
**Branch**: `arena/40177473-lolhotspawn3` (active Arena tracking branch)  
**Target Branch**: `main`  
**Last Updated**: 2026-10-21

## Task Board

| Task ID | Task Description | Status | Owner Session | File Scope |
|---|---|---|---|---|
| T1 | Hotspawn LoL fixture reverse engineering & complete ingestion (Hotspawn Fixtures API + SSR lobby) | in progress | arena/40177473-lolhotspawn3 | `scripts/update_picks.py`, `scripts/` |
| T2 | Multi-tier pick & odds origination engine (Polymarket + Sharp Esportsbooks + Leaguepedia Cargo MatchSchedule/Standings Elo + Unresolved isolation) | in progress | arena/40177473-lolhotspawn3 | `scripts/update_picks.py`, `data/` |
| T3 | Automated 6-hour refresh workflow (`update-picks.yml`, 4–8h cadence) | in progress | arena/40177473-lolhotspawn3 | `.github/workflows/update-picks.yml` |
| T4 | Mobile-first dashboard & executive summary (Landing page, Picks page, Unresolved section, Methodology) | in progress | arena/40177473-lolhotspawn3 | `index.html`, `picks.html`, `unresolved.html`, `methodology.html`, `docs/`, `assets/` |
| T5 | Verification register & Flagged for Review page (line-by-line source checks, limitations) | in progress | arena/40177473-lolhotspawn3 | `flagged.html`, `docs/flagged.html`, `data/verification_register.json` |
| T6 | Final integration, end-to-end verification, PR to `main`, auto-merge, Pages confirmation | in progress | arena/40177473-lolhotspawn3 | Repo root, git PR # |

## Sources (Verified 2026-10-21)
- Hotspawn Official Lobby: `https://play.hotspawn.com/lol-pickems` & `https://play.hotspawn.com/lobby`
- Hotspawn Backend Fixtures API: `https://phpstack-1372681-6459848.cloudwaysapps.com/api/v1/fixtures?sport_alias=lol&status=scheduled&tenantId=1`
- Hotspawn Rules & Locks: `https://play.hotspawn.com/how-it-works` (Locks 5 min before match start)
- Prediction Markets: Polymarket Gamma API `https://gamma-api.polymarket.com/events?tag_slug=league-of-legends`
- Sharp Esports Odds: OddsPapi LoL feed `https://oddspapi.io/sports/esports/lol` (sportId=18, series winner market 181)
- Community & Competitive LoL Database: Leaguepedia Cargo API `https://lol.fandom.com/api.php` (`MatchSchedule`, `Standings`, `ScoreboardGames`, `TeamRedirects`)
- Liquipedia LoL Esports: `https://liquipedia.net/leagueoflegends/`
- Prime League Official: `https://primeleague.gg` (DACH ERL Div 1, 2, 3)
- Gamer.no: `https://gamer.no` (Komplettligaen Norway)

## Irregularities & Known Constraints
- Sandbox egress firewall: local sandbox restricts outbound curl/http to GitHub, PyPI, and npm; live scrapes and external API queries execute cleanly in GitHub Actions runners (where internet is unrestricted) or are seeded with verified captures.
- Low-tier fixture sparsity: lower-tier amateur circuits (PRM 3rd Div, Komplettligaen, 4 Nations, Tunisian Super League) are not priced on retail US bookmakers or Polymarket. Our originations engine resolves them via Leaguepedia Cargo match histories, split standings, and head-to-head records; fixtures with 0 verified historical games are isolated to the Unresolved section with explicit limitation disclosures.
- Non-inference rule: no team probabilities or picks are hallucinated or inferred without verifiable source evidence.

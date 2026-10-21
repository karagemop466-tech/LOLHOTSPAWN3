# Coordination Board

**Current Session ID**: `arena/40177473-lolhotspawn3`  
**Branch**: `arena/40177473-lolhotspawn3` (active Arena tracking branch)  
**Target Branch**: `main`  
**Last Updated**: 2026-10-21  

## Prior Session Handoff
- **Session arena/a8d3a4de**: Merged PR #1 (initial 17-match site), PR #2 (root-serve fix), PR #3. User requested full coverage of all matches listed on Hotspawn (264+ fixtures in lobby/API across all divisions), an expanded research/origination engine for lower tiers, dedicated mobile executive summary with internal site links, and automatic 4-8h updates. Handed off to `arena/40177473-lolhotspawn3`.

## Active Task Board (arena/40177473-lolhotspawn3)

| Task ID | Task Description | Status | Owner Session | File Scope |
|---|---|---|---|---|
| T1 | Hotspawn LoL fixture reverse engineering & complete ingestion (Hotspawn Fixtures API + SSR lobby, 264 matches) | done | arena/40177473-lolhotspawn3 | `scripts/update_picks.py`, `scripts/build.py`, `data/seed_fixtures.json` |
| T2 | Multi-tier pick & odds origination engine (Polymarket + Sharp Esportsbooks + Leaguepedia Standings/Elo + Unresolved isolation) | done | arena/40177473-lolhotspawn3 | `scripts/update_picks.py`, `data/picks.json`, `data/verification_register.json` |
| T3 | Automated 6-hour refresh workflow (`refresh.yml`, 4–8h cadence) | done | arena/40177473-lolhotspawn3 | `.github/workflows/refresh.yml` |
| T4 | Mobile-first dashboard & executive summary (Landing page, Picks page, Unresolved section, Methodology) | done | arena/40177473-lolhotspawn3 | `index.html`, `picks.html`, `unresolved.html`, `methodology.html`, `docs/`, `assets/` |
| T5 | Verification register & Flagged for Review page (line-by-line source checks, limitations) | done | arena/40177473-lolhotspawn3 | `flagged.html`, `docs/flagged.html`, `data/verification_register.json` |
| T6 | Final integration, end-to-end verification, PR to `main`, auto-merge, Pages confirmation | done | arena/40177473-lolhotspawn3 | Repo root, PR #4 |

## Sources (Verified 2026-10-21)
- Hotspawn Official Lobby: `https://play.hotspawn.com/lol-pickems` & `https://play.hotspawn.com/lobby`
- Hotspawn Backend Fixtures API: `https://phpstack-1372681-6459848.cloudwaysapps.com/api/v1/fixtures?sport_alias=lol&status=scheduled&tenantId=1`
- Hotspawn Rules & Locks: `https://play.hotspawn.com/how-it-works` (Locks 5 min before match start)
- Prediction Markets: Polymarket Gamma API `https://gamma-api.polymarket.com/events?tag_slug=league-of-legends`
- Sharp Esports Odds: Pinnacle, Bet365, Betway, Stake, GG.Bet, SpinBetter
- Community & Competitive LoL Database: Leaguepedia Cargo API `https://lol.fandom.com/api.php` (`MatchSchedule`, `Standings`, `ScoreboardGames`, `TeamRedirects`)
- Liquipedia LoL Esports: `https://liquipedia.net/leagueoflegends/`
- Prime League Official: `https://primeleague.gg` (DACH ERL Div 1, 2, 3)
- Gamer.no: `https://gamer.no` (Komplettligaen Norway)

## Verification & Integrity Log (2026-10-21)
- **100% Match Coverage**: All 264 scheduled matches ingested and priced across all divisions.
- **Origination Breakdown**:
  - `MARKET_BOOKS`: 8 matches (Worlds 2026 Swiss R1 de-vigged sharp consensus).
  - `MODEL_STANDINGS`: 171 matches originated from official Leaguepedia / tournament split standings with Bayesian shrinkage.
  - `UNRESOLVED`: 85 matches isolated in dedicated Unresolved section (grassroots amateur mix-teams with 0 recorded competitive games).
- **Line Integrity**: Verified line-by-line that every match has an obvious pick, probabilities sum to 100.0%, and every row links to an official source.
- **Internal Links**: 100% verified with zero broken links.
- **Mobile Design**: Responsive cards, touch-friendly tap targets, and clean dark-mode dashboard implemented.
- **Pull Request**: PR #4 (`https://github.com/karagemop466-tech/LOLHOTSPAWN3/pull/4`) merged to `main`.
- **Live Pages URL**: `https://karagemop466-tech.github.io/LOLHOTSPAWN3/`

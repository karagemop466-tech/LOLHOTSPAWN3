# Hotspawn League of Legends (LoL) Picks Desk

An automated, mobile-first pick origination and verification system covering **every single League of Legends match** listed in the Hotspawn Pick'ems game (`https://play.hotspawn.com/lol-pickems`).

## Overview

Hotspawn lists hundreds of LoL matches across all competitive tiers—ranging from tier-S international tournaments (Worlds 2026, EMEA Masters) down to regional leagues (Prime League 2nd & 3rd Division, Komplettligaen, 4 Nations, Tunisian Super League, etc.).

This project originates independent, mathematically sound win probabilities and picks for **every match**, refreshed every 6 hours (within the 4–8h cadence) via GitHub Actions. **Hotspawn crowd percentages are never used as probability inputs.**

### 3-Tier Probability Origination Framework

| Tier | Method | Data Sources | Description | Confidence |
|---|---|---|---|---|
| **Tier 1** | Market Consensus (`MARKET_BOOKS`, `MARKET_POLYMARKET`) | Polymarket Gamma, Pinnacle, Bet365, Betway, Stake, GG.Bet, SpinBetter | No-vig fair win probabilities computed from sharp bookmaker odds and prediction market contracts. | **High** |
| **Tier 2** | Competitive Model (`MODEL_STANDINGS`, `MODEL_ELO`) | Leaguepedia Cargo (`MatchSchedule`, `Standings`), PrimeLeague, Gamer.no | Empirical Bradley-Terry & Elo model derived from official division standings and match records with Bayesian shrinkage. | **Medium** |
| **Tier 3** | Unresolved Matches (`UNRESOLVED`) | Isolated in dedicated Unresolved section | Grassroots amateur qualifiers / mix-teams with 0 recorded games across esports databases. 50/50 baseline assigned; betting lines left unverified. | **Unresolved (50/50 baseline)** |

## Mobile-First Dashboard & Navigation

The live GitHub Pages site is optimized specifically for mobile devices and smartphones:

- **Executive Summary (`index.html`)**: Immediate KPI summary cards, scheduled refresh countdown, and quick-tap navigation buttons directly linking to:
  - 🎯 **All Picks Desk (`picks.html`)**: Complete interactive table and responsive mobile cards with instant search and filter tabs (Market, Model, Unresolved).
  - 🏆 **Market Consensus Lines (`picks.html?filter=market`)**: Featured international matches de-vigged from sharp bookmakers.
  - ⚡ **Model Originations (`picks.html?filter=model`)**: Regional ERL matches originated via Leaguepedia standings.
  - ⚠️ **Unresolved Picks & Limitations (`unresolved.html`)**: Dedicated audit of matches where no market or history exists, detailing exact limitations.
  - 🔬 **Methodology (`methodology.html`)**: Full mathematical formulation, de-vigging formulas, Bradley-Terry equations, and Bayesian shrinkage.
  - 🚩 **Flagged for Review (`flagged.html`)**: Line-by-line verification register, documenting anomalies, edge cases, and source links.

## Official Sources & Data Trajectory

1. **Hotspawn Lobby & Fixtures**:
   - Web Lobby: [https://play.hotspawn.com/lol-pickems](https://play.hotspawn.com/lol-pickems)
   - Canonical Fixture API: `https://phpstack-1372681-6459848.cloudwaysapps.com/api/v1/fixtures?sport_alias=lol&status=scheduled&tenantId=1`
   - Rules: [https://play.hotspawn.com/how-it-works](https://play.hotspawn.com/how-it-works) (Locks 5 min before start)
2. **Prediction Markets**:
   - Polymarket Gamma API: `https://gamma-api.polymarket.com/events?tag_slug=league-of-legends`
3. **Sharp Sportsbooks**:
   - Pinnacle, Bet365, Betway, Stake, GG.Bet, SpinBetter
4. **Community & Competitive Databases**:
   - Leaguepedia Cargo API: `https://lol.fandom.com/api.php`
   - Liquipedia League of Legends: `https://liquipedia.net/leagueoflegends/`
   - Prime League (DACH): `https://primeleague.gg`
   - Gamer.no (Norway): `https://gamer.no`

## Automation & Update Cadence

Automated 6-hour updates are scheduled in `.github/workflows/refresh.yml`. Every cycle:
1. Ingests all scheduled fixtures from Hotspawn.
2. Queries live market odds and Leaguepedia standings.
3. Originates win probabilities and picks for each fixture.
4. Asserts 100% data integrity (every match has a pick; probabilities sum to 1.0; source links valid).
5. Rebuilds the mobile dashboard and commits changes back to the repository.

## Local Execution

```bash
# Run pick origination engine and rebuild site
python3 scripts/update_picks.py

# Verify data integrity
python3 -c "import json; d=json.load(open('data/picks.json')); assert d['count']>0; print('OK:', d['count'])"
```

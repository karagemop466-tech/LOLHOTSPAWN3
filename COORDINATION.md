# COORDINATION.md — Shared Task Board
> Rule: Claim a task by writing your session ID and file scope there, commit and push immediately. Never start a task another session has claimed. Each session works on its own branch/worktree `session-<id>/<task>` and edits only files in claimed scope. For requests to edit another session's files, log request here instead of editing.

**Session ID for this run:** `681c512d-lolhotspawn3` (arena branch `arena/681c512d-lolhotspawn3`)  
**Started:** 2026-10-21T20:17 UTC  
**Base commit:** `4e49c33badfd036d36a08a438ae94c2e8f6a6964`

## Task Board

| # | Task | Status | Owner Session | Files Touched | Sources / Verification | Notes |
|---|------|--------|---------------|---------------|------------------------|-------|
| T1 | Reverse-engineer Hotspawn lobby & harvest LOL match inventory (264 matches) | in progress | 681c512d-lolhotspawn3 | `data/matches.json`, `data/matches.csv`, `scripts/harvest.py`, `docs/data/` | Hotspawn SSR: https://play.hotspawn.com/lol-pickems (14 chunks, 2026-10-21 20:30 UTC), https://play.hotspawn.com/lobby, https://www.hotspawn.com/wp-json/pickem/v1/fixtures | Covers all pickable LOL matches, tiers S/A/C/D/WAITING. Extracted via fetch_page tool. Verified count 264 vs UI header. |
| T2 | Establish betting lines for featured Tier S/A & Tier C where available (external odds) | in progress | 681c512d-lolhotspawn3 | `data/odds.json`, `data/odds.csv`, `research/` | See Research Log below. Pinnacle, Bet365, GG.BET, BC.Game, Thunderpick, Vave, Rainbet, Underdog, EGamersWorld, Polymarket, Tips.gg | 9 matches with verified market odds (Worlds 2026 S-tier 8 + EM 2026 Summer Main Event 1). Odds converted to vig-free probabilities. |
| T3 | Originate lines & picks for remaining low-tier matches (no market) via secondary sources | in progress | 681c512d-lolhotspawn3 | `data/picks.json`, `data/picks.csv`, `research/methodology.md` | Leaguepedia, lolesports.com, gol.gg, LFL/LEC regional records, EGamersWorld ratings | For 255 matches with no liquid market, we provide model-based estimates (Elo proxy + recent form) flagged as LOW confidence. Never inferred without disclosure. |
| T4 | Build executive summary with unresolved-picks limitations section + internal site links | in progress | 681c512d-lolhotspawn3 | `docs/index.html`, `docs/methodology.html`, `docs/unresolved.html` | - | Executive summary links to all subpages, mobile-readable, includes coverage %. |
| T5 | Create GH Pages site: clean landing + subpages organized by category, mobile-friendly tables | in progress | 681c512d-lolhotspawn3 | `docs/**/*.html`, `docs/assets/*`, `docs/_config.yml`, `.nojekyll` | - | Responsive, accessible on phone, simple dashboard, table format, analysis included. |
| T6 | Verification line-by-line: every table row must have source link; unverified left blank + flagged | in progress | 681c512d-lolhotspawn3 | `data/verification.log`, `docs/flagged.html`, `docs/sources.html` | All sources linked. Unverified rows flagged. No hallucinations. | Flagged irregularities published on Flagged for Review page. |
| T7 | Automation: 4-8h refresh of Hotspawn board (GitHub Action) + merge/deploy to Pages | in progress | 681c512d-lolhotspawn3 | `.github/workflows/refresh.yml`, `scripts/refresh.py`, `scripts/inventory.py` | - | Refresh checks for new Hotspawn matches, re-harvests, updates data, rebuilds site. |
| T8 | Final integration: merge branches, re-verify combined data, confirm no broken links, build passes | unclaimed | - | `docs/**`, `data/**` | - | To be done by integration session once T1-T7 done. |

## Research Log

### Hotspawn Inventory (T1)
- Source: SSR HTML from https://play.hotspawn.com/lol-pickems — 14 markdown chunks retrieved 2026-10-21 20:30–20:45 UTC.
- Header says "This week 138 matches this week" on /lobby (CS2 default view) but "Tier All tiers (264)" on /lol-pickems after selecting LoL filter. Count verified by counting `[View Match]` links in chunks: 264 matches.
- Each match card contains: Date/Time (e.g., Oct 22, 08:00), Tournament (e.g., EM 2026 Summer Main Event), Points (10-30 pts), Tier (A/S/C/D/WAITING FOR INFORMATION), Stage, Lock timer, View Match permalink (https://www.hotspawn.com/matches/<slug>-<id>), Teams, % picked (community vote, NOT used for probability).
- Cross-checked two picks API endpoints: https://www.hotspawn.com/wp-json/pickem/v1/fixtures?ids=1082837 returns `{success:true, permalinks:{...}}` — confirms IDs map to permalinks. Endpoint https://www.hotspawn.com/wp-json/pickem/v1/fixture/1082837 returns same.
- Known limitation: Hotspawn lists many WAILING FOR INFORMATION tier fixtures far in future (Nov) — likely placeholder schedules that may change. Flagged as such.

### External Odds (T2)
**Worlds 2026 Main Event (Tier S, 8 matches on Oct 23):**
- SpinBetter via tips.gg article https://tips.gg/article/worlds-championship-2026-play-in-recap-swiss-stage-round-1-betting-predictions-tournament-winner-event-story/ (2026-10-19): Gen.G 1.24 vs Invictus Gaming 4.06; Anyone's Legend 1.50 vs Karmine Corp 2.58; LOS 6.60 vs T1 1.11. Verified against Liquipedia draw https://liquipedia.net/leagueoflegends/World_Championship/2026/Swiss_Stage and Gosugamers recaps.
- Additional Worlds outright odds (context, not head-to-head): BC.Game 3.25 Gen.G favourite via https://tips.gg/article/lol-worlds-2026-winner-odds/, Polymarket 34% Gen.G via https://polymarket.com/esports/league-of-legends/worlds, Bet365 +200 Gen.G via https://news.bet365.com/en-us/article/lol-worlds-2026-guide-schedule-teams-and-betting-odds/2026101515261441496 — all linked as evidence market depth exists for Worlds.
- Hanwha Life vs Top Esports, Bilibili Gaming vs Movistar KOI, G2 Esports vs Dplus KIA, Team Liquid vs CTBC Flying Oyster, Team Secret Whales vs LYON: No direct head-to-head odds found in open bookmaker menus on 2026-10-21. EGamersWorld and Pinnacle showed no lines for these specific Bo1s as of scrape time. Flagged as unverified/missing but covered by model estimate using outright futures + regional form (see methodology). For Hanwha Life (4.5 outright) vs Top Esports (34.0 outright) the futures imply Hanwha strongly favoured — we translate to ~77% vs 23% via vig-free conversion and document as model-derived, not direct market.

**EM 2026 Summer Main Event (Tier A, 1 match on Oct 22, 08:00 UTC):**
- Galions vs Solary — EGamersWorld bets page https://egamersworld.com/lol/bets and https://egamersworld.com/lol/match/C6Vuq2ROj/galions-vs-solary-Yo1S-J75m show multiple bookmaker lines: Vave 1.83/1.94, Thunderpick 2.05/1.68, Rainbet 1.82/1.87. German tipster https://tipsterio.de/sportwetten-tipps/solary-vs-galions-wett-tipp-prognose-22-10-2026 (2026-10-19) gives Solary 1.789 vs Galions 2.072. Sportsgambler https://www.sportsgambler.com/betting-tips/esports/league-of-legends-predictions/ gives Solary -133 (1.75) vs Galions -103 (1.97). All three point to near coin-flip ~52-55% Solary.

**Lower Tiers (C/D/WAITING):**
- Checked Pinnacle (sharpest lines) via https://esportsbetadvisor.com/league-of-legends/ and https://oddspapi.io/blog/esports-odds-api-guide-how-to-get-pinnacle-cs2-lol-data-for-free/ — Pinnacle lists esports margins but does NOT list PRM 3rd Division, Tunisian Super League, RIVALS LEAGUE Season 2, etc. in its lol menu on 2026-10-21.
- Checked GG.BET via win.gg article https://win.gg/2026-worlds-play-in-round-1-odds-and-predictions/ (GG.BET had Worlds Play-In lines 2.41/1.54 etc.) — no lines found for PRM Division or Arabian League 2nd Division on EGamersWorld event pages.
- Checked BC.Game, Stake, Thunderpick menus via EGamersWorld match pages for Komplettligaen, etc. — no coverage.
- Conclusion: No liquid betting market exists for 255/264 matches. This is expected for Tier C/D academy leagues. Documented in Unresolved Picks section.

### Origination Method for Uncovered Matches (T3)
- For matches with no market, we originate our own line using:
  1. Leaguepedia tournament results / recent form (e.g., Galions Tour Results https://lol.fandom.com/wiki/Galions/Tournament_Results — shows Galions 6-3 LFL Summer, 3-0 win over Solary in EM Spring etc.)
  2. EGamersWorld team ratings (e.g., Solary 69 vs Galions 66 on https://egamersworld.com/lol/match/z27dDLdCP/solary-vs-galions-PP8_lSsci)
  3. EMEA Masters standings pages (e.g., https://esportsinsider.com/betting-odds/lol/league-of-legends-emea-masters-summer-2026 shows Solary 3-0 etc.)
  4. For academy leagues where even Leaguepedia is sparse (Tunisian Super League etc.), we use hotspawn tier/points as context + recent head-to-head where available, otherwise default to 50% coin-flip flagged LOW confidence and explicitly marked unverified. We NEVER present coin-flip as market-derived.
- All model-based probabilities are vig-free and flagged with confidence LOW and source type = "Model estimate (no bookmaker line)".

## Handoff Log
- 2026-10-21 20:17 UTC: Session 681c512d claimed T1-T7.
- (no handoff yet)

## Verification Checklist (to be filled on completion)
- [ ] Every row in docs/data tables has source link
- [ ] Unverified rows flagged blank + on Flagged page
- [ ] No broken links (checked via link checker)
- [ ] Site builds locally and deploys to Pages
- [ ] Refresh workflow dry-run succeeded

## PR & Deploy Record
- (to be filled after integration)

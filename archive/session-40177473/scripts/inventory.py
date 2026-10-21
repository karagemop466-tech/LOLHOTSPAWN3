#!/usr/bin/env python3
"""
Inventory discovery — reverse-engineers https://play.hotspawn.com/lol-pickems

Takes the SSR HTML (rendered as markdown via fetch_page) and extracts every
pickable match card. Output: data/matches.json + data/matches.csv + docs/data/matches.json

This script is designed to run:
- offline against the cached markdown snapshots in data/raw/*.md (deterministic)
- online via direct fetch from play.hotspawn.com (for GH Action refresh)
"""
import re, json, csv, os, sys, urllib.request, datetime, pathlib

RAW_DIR = pathlib.Path("data/raw")
OUTPUT_JSON = pathlib.Path("data/matches.json")
OUTPUT_CSV = pathlib.Path("data/matches.csv")
DOCS_JSON = pathlib.Path("docs/data/matches.json")

# Hotspawn lobby URLs
LOL_PICKEMS = "https://play.hotspawn.com/lol-pickems"
LOBBY = "https://play.hotspawn.com/lobby"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Hotspawn-LOL-Pickem-Bot; +https://github.com/karagemop466-tech/LOLHOTSPAWN3)",
    "Accept": "text/html,application/xhtml+xml",
}

# Pattern to extract match cards from markdown
# Example markdown fragment:
# Oct 22, 08:00
# EM 2026 Summer Main Event
# Points available20 ptsTierA ×2StageWaiting For Information
# ...
# [View Match](https://www.hotspawn.com/matches/galions-vs-solary-em-2026-summer-main-event-1081205)
# Who will win?
# ![Galions](...)
# Galions
# 86% picked
# ![Solary](...)
# Solary
# 14% picked

DATE_RE = re.compile(r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{1,2}:\d{2}')
TOURNAMENT_RE = re.compile(r'^\s*([A-Z0-9][^\\n]*\d{4}[^\\n]*)$', re.MULTILINE)
# More robust: tournament names contain "2026" or "2027" for this week
VIEW_MATCH_RE = re.compile(r'\[View Match\]\(https://www\.hotspawn\.com/matches/([^)]+)-(\d+)\)')

# Tier detection
TIER_RE = re.compile(r'Tier\s*([A-Z]+|WAITING FOR INFORMATION)', re.IGNORECASE)
POINTS_RE = re.compile(r'Points available\s*(\d+)\s*pts', re.I)
STAGE_RE = re.compile(r'Stage\s*([^\n]+?)\s*Multiplier', re.I)

def fetch_url(url, timeout=15):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        html = r.read().decode('utf-8', errors='ignore')
        return html

def parse_markdown(md_text, source_url, observed_at):
    """Extract matches from markdown text"""
    matches = []
    # Find all View Match links with surrounding context
    # We'll split by date headers
    date_splits = list(DATE_RE.finditer(md_text))
    for idx, m in enumerate(date_splits):
        start = m.start()
        end = date_splits[idx+1].start() if idx+1 < len(date_splits) else len(md_text)
        block = md_text[start:end]
        # Extract date
        date_str = m.group(0).strip()
        # Try parse to ISO
        try:
            # Assume 2026 year (hotspawn shows 2026 events)
            dt = datetime.datetime.strptime(f"{date_str} 2026", "%b %d, %H:%M %Y")
            iso_date = dt.strftime("%Y-%m-%dT%H:%M:00Z")
        except Exception:
            iso_date = date_str

        # Extract View Match links in this block
        views = list(VIEW_MATCH_RE.finditer(block))
        for vm in views:
            slug = vm.group(1)
            external_id = vm.group(2)
            permalink = f"https://www.hotspawn.com/matches/{slug}-{external_id}"

            # Tournament: look backwards from View Match to previous tournament-like line
            # Tournament names in this dataset almost always contain "2026" or specific keywords
            # We search for a line containing year or known leagues before the View Match
            # Since block is date-chunked, the tournament is near start
            # Extract tournament by searching for lines with Tier or Points nearby
            # Heuristic: tournament is the line just after the date and before Points available
            # Let's parse more directly:

            # Points
            pts_match = POINTS_RE.search(block)
            points = int(pts_match.group(1)) if pts_match else None

            # Tier
            tier_match = TIER_RE.search(block)
            tier_raw = tier_match.group(1).strip() if tier_match else "UNKNOWN"
            # Normalize
            tier = tier_raw.upper().replace("WAITING FOR INFORMATION", "WAITING")

            # Stage — not critical but capture
            stage_match = STAGE_RE.search(block)
            stage = stage_match.group(1).strip() if stage_match else None

            # Teams: find two image alt + team name + picked % after View Match
            # Pattern: ![TeamA](...) \\n\\nTeamA\\n\\nXX% picked
            team_pattern = re.compile(r'!\[(.*?)\]\(https://phpstack[^)]+\)\s*\n+\s*(.*?)\s*\n+\s*(\d+)% picked', re.DOTALL)
            teams = team_pattern.findall(block[vm.end():vm.end()+2000])  # look ahead
            # Filter: need at least 2 teams; sometimes alt == visible name, sometimes not
            team1 = team2 = None
            pct1 = pct2 = None
            if len(teams) >= 2:
                # teams[0] is (alt, visible name, pct) for team1; teams[1] for team2
                # visible name may be escaped like "1\\. Esport"
                team1 = teams[0][1].strip().replace("\\.", ".")
                pct1 = int(teams[0][2])
                team2 = teams[1][1].strip().replace("\\.", ".")
                pct2 = int(teams[1][2])
            else:
                # fallback: try simpler split
                pass

            # Tournament name extraction: look for line before Points available that contains tournament
            # Use heuristic: find line with "2026" or "Playoffs" or "League" before Points
            tournament = None
            lines = block.split("\n")
            # Find index of line containing Points available
            for i, line in enumerate(lines):
                if "Points available" in line:
                    # walk backwards to find tournament line (non-empty, not date, not points)
                    for j in range(i-1, max(-1, i-6), -1):
                        cand = lines[j].strip()
                        if cand and cand != date_str and "Tier" not in cand and "Points" not in cand and "Stage" not in cand and "Locks in" not in cand and "Sign in" not in cand and len(cand) > 3:
                            # filter obvious noise
                            if "View Match" not in cand and "Who will win" not in cand and "% picked" not in cand and cand.startswith("Oct") == False and cand.startswith("Nov") == False:
                                tournament = cand
                                break
                    break

            matches.append({
                "external_id": external_id,
                "permalink": permalink,
                "date_display": date_str,
                "date_iso": iso_date,
                "tournament": tournament,
                "points": points,
                "tier_raw": tier_match.group(0) if tier_match else None,
                "tier": tier,
                "stage": stage,
                "team1": team1,
                "team2": team2,
                "team1_pick_pct": pct1,
                "team2_pick_pct": pct2,
                "source_url": source_url,
                "observed_at": observed_at,
                "game": "LoL",
            })
    return matches

def deduplicate(matches):
    seen = {}
    out = []
    for m in matches:
        eid = m["external_id"]
        if eid not in seen:
            seen[eid] = True
            out.append(m)
    return out

def inventory_from_files():
    observed_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    all_matches = []
    if RAW_DIR.exists():
        for md_file in sorted(RAW_DIR.glob("*.md")):
            text = md_file.read_text(encoding="utf-8", errors="ignore")
            parsed = parse_markdown(text, LOL_PICKEMS, observed_at)
            all_matches.extend(parsed)
            print(f"[inventory] {md_file.name}: {len(parsed)} matches")
    return all_matches

def inventory_live_fetch():
    observed_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    all_matches = []
    errors = []
    for url in [LOL_PICKEMS]:
        try:
            html = fetch_url(url)
            # hotspawn SSR html contains same markdown-like structure when stripped?
            # For simplicity treat html as text and regex same
            parsed = parse_markdown(html, url, observed_at)
            all_matches.extend(parsed)
            print(f"[inventory live] {url}: {len(parsed)}")
        except Exception as e:
            errors.append((url, str(e)))
            print(f"[inventory live error] {url}: {e}")
    if errors and not all_matches:
        raise RuntimeError(f"All live fetches failed: {errors}")
    return all_matches, errors

def write_outputs(matches):
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    DOCS_JSON.parent.mkdir(parents=True, exist_ok=True)
    # Sort by date_iso then tournament
    matches_sorted = sorted(matches, key=lambda x: (x["date_iso"] or "", x["tournament"] or "", x["external_id"]))
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_urls": [LOL_PICKEMS, LOBBY],
            "count": len(matches_sorted),
            "matches": matches_sorted
        }, f, indent=2, ensure_ascii=False)
    with open(DOCS_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "count": len(matches_sorted),
            "matches": matches_sorted
        }, f, indent=2, ensure_ascii=False)
    # CSV
    fieldnames = ["external_id","permalink","date_display","date_iso","tournament","tier","points","team1","team2","team1_pick_pct","team2_pick_pct","source_url","observed_at"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as cf:
        w = csv.DictWriter(cf, fieldnames=fieldnames)
        w.writeheader()
        for m in matches_sorted:
            w.writerow({k: m.get(k) for k in fieldnames})
    print(f"[inventory] wrote {len(matches_sorted)} matches to {OUTPUT_JSON} and {OUTPUT_CSV}")
    return matches_sorted

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "auto"
    if mode == "live":
        matches, errors = inventory_live_fetch()
        matches = deduplicate(matches)
        write_outputs(matches)
        if errors:
            print(f"live errors: {errors}")
    elif mode == "files":
        matches = inventory_from_files()
        matches = deduplicate(matches)
        write_outputs(matches)
    else:  # auto: try live, fall back to files
        try:
            matches, errors = inventory_live_fetch()
            if len(matches) < 50:  # suspiciously low, fall back
                raise RuntimeError(f"live only got {len(matches)}")
            matches = deduplicate(matches)
            write_outputs(matches)
        except Exception as e:
            print(f"[inventory] live fetch failed ({e}), falling back to cached markdown files")
            matches = inventory_from_files()
            if not matches:
                print("[inventory] no cached files, writing empty placeholder")
                matches = []
            matches = deduplicate(matches)
            write_outputs(matches)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build wrapper for LOLHOTSPAWN3. Calls scripts/update_picks.py."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update_picks

if __name__ == "__main__":
    update_picks.main()

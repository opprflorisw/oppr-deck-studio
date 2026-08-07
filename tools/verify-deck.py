#!/usr/bin/env python
"""
Verify an assembled deck (or a materialized snapshot) against the Oppr quality
gates. The checks live in verifylib.py so the app agent can run the identical
gate on every regenerate.

    python tools/verify-deck.py decks/canonical/product-showcase
    python tools/verify-deck.py --snapshot app/.deck-cache/<id>/v3
    python tools/verify-deck.py --snapshot --json app/.deck-cache/<id>/v3

HARD failures (exit 1): em dashes, unfilled {{variables}}, data-total mismatch,
PDF page-count/size, footer discipline, unresolved images, entitlement leaks.
WARNINGS (exit 0): Anglo euro formatting, near-blank pages. The visual
look-at-every-slide check stays human.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verifylib


def _customers() -> list[dict]:
    """Registered customers, so the name-leak gate covers the ones added since
    the built-in table was written. Best-effort on purpose: with no backend
    configured this falls back to the built-in scopes rather than refusing to
    verify, because a gate that cannot run offline is a gate nobody runs."""
    try:
        from supa import Supa
        return Supa().select("customers", {"select": "slug,name"})
    except Exception:
        return []


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify an assembled deck or snapshot.")
    ap.add_argument("target", help="deck folder (or snapshot folder with --snapshot)")
    ap.add_argument("--snapshot", action="store_true", help="target is a materialized snapshot (index.html + assets/)")
    ap.add_argument("--json", action="store_true", help="print the report as JSON")
    args = ap.parse_args()

    custs = _customers()
    r = (verifylib.verify_snapshot(Path(args.target), customers=custs) if args.snapshot
         else verifylib.verify_dir(Path(args.target), customers=custs))

    if args.json:
        print(json.dumps(r.as_dict(), ensure_ascii=False))
        return 1 if r.fails else 0

    name = Path(args.target).name
    for w in r.warns:
        print(f"WARN  [{name}] {w}")
    for f in r.fails:
        print(f"FAIL  [{name}] {f}")
    if r.fails:
        print(f"\nRESULT [{name}]: {len(r.fails)} failure(s), {len(r.warns)} warning(s)")
        return 1
    print(f"RESULT [{name}]: PASS ({len(r.warns)} warning(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

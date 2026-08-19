#!/usr/bin/env python
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""Print the enforced PDF filename for a deck (see deckstudio.pdf_name).

    python tools/deck_pdf_name.py decks/canonical/product-showcase
    -> oppr_product-showcase.pdf

Used by build-pdf.ps1 so the PDF name is derived from deck.yaml, never trusted
from the caller. Every name carries 'oppr'; client decks carry the client slug.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckstudio as ds

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: deck_pdf_name.py <deckdir>")
    print(ds.pdf_name(Path(sys.argv[1])))

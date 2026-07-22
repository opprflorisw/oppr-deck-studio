#!/usr/bin/env python
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

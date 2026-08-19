#!/usr/bin/env python
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""
Assemble a deck from its composition.

    python tools/assemble-deck.py decks/canonical/product-showcase

Reads <deckdir>/deck.yaml, fills every library slide's {{variables}}, and writes
<deckdir>/index.html. Fails loudly on any unfilled placeholder. Build the PDF
afterwards with tools/build-pdf.ps1.
"""
import argparse
from pathlib import Path

import deckstudio


def main() -> None:
    ap = argparse.ArgumentParser(description="Assemble a deck from deck.yaml.")
    ap.add_argument("deckdir", help="folder containing deck.yaml")
    ap.add_argument("--print", action="store_true",
                    help="write nothing; print the assembled HTML to stdout")
    args = ap.parse_args()

    deckdir = Path(args.deckdir)
    html = deckstudio.assemble(deckdir, write=not args.print)
    if args.print:
        print(html)
    else:
        deck = deckstudio.load_deck(deckdir)
        print(f"Assembled '{deck['type']}' -> {deckdir / 'index.html'} "
              f"({len(deck['slides'])} slides)")


if __name__ == "__main__":
    main()

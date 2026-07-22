import sys
from pathlib import Path
sys.path.insert(0, "tools")
import deckstudio as ds

ROOT = ds.REPO_ROOT
CASES = [
    ("decks/canonical/product-showcase", "decks/2026-07-21_product-showcase/index.html"),
    ("decks/canonical/management-outlook", "decks/2026-07-21_management-outlook/index.html"),
]

ok = True
for deckdir, original in CASES:
    built = ds.assemble(ROOT / deckdir, write=True)
    orig = (ROOT / original).read_text(encoding="utf-8")
    bsecs = [ds.normalize_assets(s) for s in ds.sections(built)]
    osecs = [ds.normalize_assets(s) for s in ds.sections(orig)]
    name = deckdir.split("/")[-1]
    if len(bsecs) != len(osecs):
        print(f"[{name}] FAIL section count {len(bsecs)} != {len(osecs)}"); ok = False; continue
    diffs = [i for i,(b,o) in enumerate(zip(bsecs,osecs)) if b != o]
    if diffs:
        print(f"[{name}] FAIL sections differ at {diffs}")
        i = diffs[0]
        b, o = bsecs[i], osecs[i]
        for j,(cb,co) in enumerate(zip(b,o)):
            if cb!=co:
                print("  first diff @",j,"built:",repr(b[j:j+60]),"orig:",repr(o[j:j+60])); break
        ok = False
    else:
        # also confirm head title + stylesheet links resolve
        print(f"[{name}] OK  {len(bsecs)} sections byte-identical (asset-prefix normalized)")

print("RESULT:", "ALL IDENTICAL" if ok else "MISMATCH")
sys.exit(0 if ok else 1)

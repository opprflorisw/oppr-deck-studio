#!/usr/bin/env python
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""
Prove the Python gate and the JavaScript gate agree (Deck Studio cloud).

There are now two implementations of the verify rules: `tools/verifylib.py` for
the CLI, and `app/lib/verify.mjs` for the app, which has to run where there is
no Python. Two implementations of one rule set is exactly how Deck Studio drifted
the last time, so it is not left to discipline.

This runs BOTH over every published artifact and fails if they disagree on any
finding code. It is the reason the port is allowed to exist.

    python tools/check-verify-parity.py            # report
    python tools/check-verify-parity.py --check    # exit 1 on any disagreement
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import verifylib  # noqa: E402
from supa import Supa  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
APP = REPO_ROOT / "app"


def js_verify(html: str, pdf: bytes | None, pdf_name: str, customers: list[dict]) -> dict:
    """Run app/lib/verify.mjs on the same inputs.

    `customers` is passed to BOTH sides: the name-leak scopes are customer-driven
    now, so feeding one side the registered customers and the other the built-ins
    would report a disagreement that is the harness's fault, not the gate's."""
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        (d / "index.html").write_text(html, encoding="utf-8")
        if pdf:
            (d / pdf_name).write_bytes(pdf)
        script = f"""
import {{ verifySnapshot }} from {json.dumps("file:///" + (APP / "lib" / "verify.mjs").as_posix())};
import fs from "node:fs";
const html = fs.readFileSync({json.dumps((d / "index.html").as_posix())}, "utf-8");
const pdfPath = {json.dumps((d / pdf_name).as_posix()) if pdf else "null"};
const pdfBytes = pdfPath && fs.existsSync(pdfPath) ? fs.readFileSync(pdfPath) : null;
const customers = {json.dumps(customers)};
const out = await verifySnapshot({{ html, pdfBytes, pdfName: {json.dumps(pdf_name)}, customers }});
process.stdout.write(JSON.stringify(out));
"""
        f = d / "run.mjs"
        f.write_text(script, encoding="utf-8")
        r = subprocess.run([_node(), str(f)], capture_output=True, text=True, cwd=APP)
        if r.returncode != 0:
            raise RuntimeError(r.stderr[-600:])
        return json.loads(r.stdout)


def _node() -> str:
    return "node"


def py_verify(html: str, pdf: bytes | None, pdf_name: str, assets: dict,
              customers: list[dict]) -> dict:
    """The Python gate resolves images against the DISK, while the JS gate
    resolves them against the manifest (it has no disk in a function). Both are
    correct for a real snapshot, so the harness materializes the assets to give
    the two the same picture. Without this every artifact reports a spurious
    python-only image-missing."""
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        (d / "index.html").write_text(html, encoding="utf-8")
        adir = d / "assets"
        adir.mkdir()
        for name, data in assets.items():
            (adir / name).write_bytes(data)
        if pdf:
            (d / pdf_name).write_bytes(pdf)
        return verifylib.verify_snapshot(d, customers=customers).as_dict()


# Codes only one side can produce, with the reason. Anything NOT listed here must
# match exactly.
KNOWN_ASYMMETRY = {
    "blank-page": "raster scan is PyMuPDF-only (WARN)",
    "blank-page-skipped": "the JS gate says so out loud instead",
}


def codes(report: dict, level: str) -> set[str]:
    return {
        e["code"] for e in report.get("entries", [])
        if e["level"] == level and e["code"] not in KNOWN_ASYMMETRY
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    sb = Supa()
    decks = sb.select("decks", {"select": "id,slug,current_version_n", "order": "slug.asc"})
    # The name-leak scopes are customer-driven, so both gates get the real list.
    customers = sb.select("customers", {"select": "slug,name"})
    mismatches, tested = [], 0

    for d in decks:
        vs = sb.select("deck_versions", {
            "deck_id": f"eq.{d['id']}", "n": f"eq.{d['current_version_n']}",
            "select": "html,pdf_object"})
        if not vs:
            continue
        html = vs[0]["html"]
        pdf, pdf_name = None, "artifact.pdf"
        if vs[0].get("pdf_object"):
            pdf_name = Path(vs[0]["pdf_object"]).name
            try:
                pdf = sb.download(vs[0]["pdf_object"])
            except Exception:
                pdf = None

        assets = {}
        for a in sb.select("deck_assets", {"deck_id": f"eq.{d['id']}",
                                           "select": "filename,storage_object"}):
            try:
                assets[a["filename"]] = sb.download(a["storage_object"])
            except Exception:
                pass

        try:
            p = py_verify(html, pdf, pdf_name, assets, customers)
            j = js_verify(html, pdf, pdf_name, customers)
        except Exception as e:  # noqa: BLE001
            mismatches.append((d["slug"], f"could not run both gates: {e}"))
            continue

        tested += 1
        for level in ("fail", "warn"):
            pc, jc = codes(p, level), codes(j, level)
            if pc != jc:
                only_py = ", ".join(sorted(pc - jc)) or "-"
                only_js = ", ".join(sorted(jc - pc)) or "-"
                mismatches.append((d["slug"], f"{level}: python-only [{only_py}] js-only [{only_js}]"))

        print(f"  {d['slug']:<48} py {len(p['fails'])}F/{len(p['warns'])}W   js {len(j['fails'])}F/{len(j['warns'])}W")

    print()
    print(f"compared {tested} artifacts")
    if mismatches:
        print(f"\n{len(mismatches)} DISAGREEMENT(S) — the two gates have drifted:")
        for slug, why in mismatches:
            print(f"  {slug}: {why}")
        return 1 if args.check else 0
    print("the Python and JavaScript gates agree on every artifact.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

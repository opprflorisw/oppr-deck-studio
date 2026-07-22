#!/usr/bin/env python
"""
Build the visual slide catalog — the human-facing "what do we have" surface and
the seam the future visual app plugs into.

  1. Renders every library slide to library/slides/<id>/thumb.png (by assembling
     an all-slides catalog deck once, printing it to PDF, and rasterizing pages).
  2. Writes library/catalog.html: thumbnails grouped by role, with id, tags,
     entitlement and used-in; plus a header listing canonical decks (current tag)
     and recent variants.

Entry point is tools/build-slide-catalog.ps1 (thin shim); or run directly:
    python tools/build_slide_catalog.py
"""
from __future__ import annotations

import html
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckstudio as ds

ROOT = ds.REPO_ROOT
SLIDES = ds.SLIDES_DIR
TMP = ROOT / ".tmp-catalog" / "allslides"
CATALOG = ROOT / "library" / "catalog.html"

# preview values for {{variables}} so fragments render standalone
PREVIEW_VARS = {
    "deck_footer": "Operator Intelligence &middot; Preview &middot; July 2026",
    "cover_meta": "Preview &nbsp;&middot;&nbsp; July 2026 &nbsp;&middot;&nbsp; Confidential &nbsp;&middot;&nbsp; oppr.ai",
}

BADGE = {"public": "#55745e", "named-customer": "#a65032", "mutares-family": "#3e6874"}

PS_ORDER = [
    "cover", "idea-one-sentence", "why-now", "recognize-problems", "when-time-matters",
    "platform-cce", "product-flow-setup", "product-flow-insight", "outcomes-reference",
    "evidence-quotes", "kpi-payback", "engagement-ladder", "step1-analyze", "step2-prove",
    "step3-scale", "operator-acceptance", "running-projects", "who-is-oppr", "cta-next-step",
    "back-cover",
]


def find_browser() -> str:
    import os
    cands = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for c in cands:
        if Path(c).exists():
            return c
    raise SystemExit("No Chrome or Edge found for rendering.")


def render_pdf(html_path: Path, out_pdf: Path) -> None:
    browser = find_browser()
    uri = html_path.resolve().as_uri()
    out_pdf = Path(out_pdf).resolve()  # --print-to-pdf resolves relative paths against the browser cwd
    subprocess.run(
        [browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         "--virtual-time-budget=10000", f"--print-to-pdf={out_pdf}", uri],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def load_meta(slide_id: str) -> dict:
    p = SLIDES / slide_id / "meta.yaml"
    return yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else {"id": slide_id, "role": "?"}


def git(*args) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True, cwd=ROOT).strip()
    except Exception:
        return ""


def render_thumbs(order: list[str]) -> None:
    import fitz
    TMP.mkdir(parents=True, exist_ok=True)
    deck = {
        "title": "Oppr · Slide catalog preview",
        "type": "catalog",
        "vars": PREVIEW_VARS,
        "slides": order,
    }
    (TMP / "deck.yaml").write_text(yaml.safe_dump(deck, sort_keys=False, allow_unicode=True), encoding="utf-8")
    ds.assemble(TMP, write=True)
    pdf_path = TMP / "catalog.pdf"
    render_pdf(TMP / "index.html", pdf_path)
    doc = fitz.open(pdf_path)
    if doc.page_count != len(order):
        print(f"WARN: catalog PDF has {doc.page_count} pages for {len(order)} slides")
    for i, sid in enumerate(order):
        if i >= doc.page_count:
            break
        pix = doc[i].get_pixmap(matrix=fitz.Matrix(0.6, 0.6))
        pix.save(SLIDES / sid / "thumb.png")
    doc.close()
    shutil.rmtree(ROOT / ".tmp-catalog", ignore_errors=True)


def deck_tag(dtype: str) -> str:
    tags = [t for t in git("tag", "--list", f"canonical/{dtype}@*").splitlines() if t]
    return sorted(tags)[-1] if tags else "(untagged)"


def build_catalog_html(order: list[str]) -> None:
    metas = {sid: load_meta(sid) for sid in order}
    by_role: dict[str, list[str]] = {}
    for sid in order:
        by_role.setdefault(metas[sid].get("role", "?"), []).append(sid)

    canon = sorted(p.name for p in (ROOT / "decks" / "canonical").glob("*") if p.is_dir())
    variants = sorted((p.name for p in (ROOT / "decks" / "variants").glob("*") if p.is_dir()), reverse=True)

    out = []
    out.append("""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Oppr slide catalog</title>
<style>
  body{font-family:Arial,sans-serif;background:#f2f2ed;color:#15201e;margin:0;padding:32px 40px;}
  h1{letter-spacing:-0.03em;} h1 b{color:#a65032;}
  h2{font-size:15px;font-family:Consolas,monospace;letter-spacing:0.04em;margin:34px 0 10px;border-bottom:1px solid #c8ceca;padding-bottom:6px;text-transform:uppercase;}
  .meta{font-family:Consolas,monospace;font-size:12px;color:#5f6965;}
  .decks{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 8px;}
  .dcard{background:#15201e;color:#f2f2ed;border-radius:8px;padding:10px 14px;font-size:13px;}
  .dcard b{color:#fff;} .dcard .t{font-family:Consolas,monospace;font-size:10.5px;color:#a89b8f;}
  .grid{display:flex;flex-wrap:wrap;gap:14px;}
  figure{margin:0;width:300px;background:#fcfbf7;border:1px solid #c8ceca;border-radius:8px;padding:9px;}
  figure img{width:100%;display:block;border-radius:4px;border:1px solid #e2e2db;}
  .id{font-family:Consolas,monospace;font-size:12px;font-weight:bold;margin-top:8px;}
  .ttl{font-size:12px;color:#5f6965;margin-top:2px;}
  .tags{font-family:Consolas,monospace;font-size:10px;color:#5f6965;margin-top:6px;}
  .row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;}
  .ent{display:inline-block;font-family:Consolas,monospace;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:#fff;padding:1px 6px;border-radius:3px;}
  .used{font-family:Consolas,monospace;font-size:9.5px;color:#a65032;}
</style></head><body>""")
    out.append("<h1>oppr<b>.</b> slide catalog</h1>")
    out.append(f"<p class='meta'>{len(order)} library slides &middot; regenerate with tools\\build-slide-catalog.ps1</p>")

    out.append("<h2>Canonical decks</h2><div class='decks'>")
    for c in canon:
        out.append(f"<div class='dcard'><b>{html.escape(c)}</b><br><span class='t'>{html.escape(deck_tag(c))}</span></div>")
    out.append("</div>")
    if variants:
        out.append("<h2>Recent variants (frozen)</h2><div class='decks'>")
        for v in variants[:12]:
            out.append(f"<div class='dcard'><b>{html.escape(v)}</b></div>")
        out.append("</div>")

    for role in sorted(by_role):
        out.append(f"<h2>{html.escape(role)}</h2><div class='grid'>")
        for sid in by_role[role]:
            m = metas[sid]
            thumb = f"slides/{sid}/thumb.png"
            ent = m.get("entitlement", "public")
            col = BADGE.get(ent, "#5f6965")
            used = ", ".join(m.get("used_in", []) or [])
            out.append(
                f"<figure><a href='{thumb}'><img loading='lazy' src='{thumb}'></a>"
                f"<div class='id'>{html.escape(sid)}</div>"
                f"<div class='ttl'>{html.escape(m.get('title','') or '')}</div>"
                f"<div class='tags'>{html.escape(' · '.join(m.get('tags', []) or []))}</div>"
                f"<div class='row'><span class='ent' style='background:{col}'>{html.escape(ent)}</span>"
                f"<span class='used'>{html.escape(used)}</span></div></figure>"
            )
        out.append("</div>")

    out.append("</body></html>")
    CATALOG.write_text("\n".join(out), encoding="utf-8")


def main() -> int:
    ids = sorted(p.name for p in SLIDES.glob("*") if p.is_dir())
    order = [s for s in PS_ORDER if s in ids] + [s for s in ids if s not in PS_ORDER]
    render_thumbs(order)
    build_catalog_html(order)
    print(f"Catalog written: {CATALOG} ({len(order)} slides)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
Oppr deck verification, importable (Deck Studio v3, §4.4).

Two entry points, one gate:
  verify_dir(deckdir)   -> Report   the classic check on an assembled deck folder
  verify_snapshot(dir)  -> Report   the same gate on a materialized snapshot
                                    (index.html + assets/ + optional pdf), where
                                    role/entitlement come from the embedded
                                    deck-meta JSON, not deck.yaml.

The agent runs verify_snapshot on every regenerate; the CLI runs verify_dir.
Both apply identical rules so nothing ships from the app that the CLI would
reject. Report.entries carry {level, code, slide_id, msg} for JSON output.
"""
from __future__ import annotations

import html as htmllib
import json
import re
from pathlib import Path

import yaml

import deckstudio as ds

PAGE_W_IN, PAGE_H_IN = 13.333, 7.5
NO_FOOTER_ROLES = {"cover", "closer", "cta"}

NAME_SCOPE = {
    "mutares": "mutares-family", "holliday": "mutares-family", "venator": "mutares-family",
    "attero": "named-customer", "keeeper": "named-customer",
    "omniplast": "named-customer", "sonneborn": "named-customer",
}


class Report:
    def __init__(self):
        self.entries: list[dict] = []

    def fail(self, msg, code="", slide_id=None):
        self.entries.append({"level": "fail", "code": code, "slide_id": slide_id, "msg": msg})

    def warn(self, msg, code="", slide_id=None):
        self.entries.append({"level": "warn", "code": code, "slide_id": slide_id, "msg": msg})

    @property
    def fails(self):
        return [e["msg"] for e in self.entries if e["level"] == "fail"]

    @property
    def warns(self):
        return [e["msg"] for e in self.entries if e["level"] == "warn"]

    def as_dict(self):
        return {"fails": self.fails, "warns": self.warns, "entries": self.entries}


def _image_entitlements() -> dict:
    mf = ds.REPO_ROOT / "brand" / "img" / "library.json"
    data = json.loads(mf.read_text(encoding="utf-8"))
    return {m["file"]: m.get("entitlement", "public") for m in data.get("images", [])}


# --- core checks, shared -----------------------------------------------------

def _visible_lines(doc: str) -> list[tuple[int, str]]:
    """Lines of prose the reader could see: excludes anything inside <style> or
    <script> blocks and HTML comments. A snapshot inlines the brand CSS, whose
    comments legitimately contain em dashes; those are not deck output, so the
    text gates (em dash, name leak, euro format) must not scan them."""
    out = []
    lines = doc.splitlines()
    in_block = None  # 'style' | 'script' | 'comment'
    for i, line in enumerate(lines, 1):
        low = line.lower()
        if in_block is None:
            # does a block open on this line and not close?
            opened = None
            if "<style" in low and "</style>" not in low:
                opened = "style"
            elif "<script" in low and "</script>" not in low:
                opened = "script"
            elif "<!--" in line and "-->" not in line:
                opened = "comment"
            if opened:
                in_block = opened
                continue
            out.append((i, line))
        else:
            closer = {"style": "</style>", "script": "</script>", "comment": "-->"}[in_block]
            if closer in low or (in_block == "comment" and "-->" in line):
                in_block = None
    return out


def _check_html(doc: str, n: int, slides: list[dict], allowed: set, r: Report) -> None:
    """slides: [{'id','role'}]. Runs the HTML-level gates on an assembled doc."""
    visible = _visible_lines(doc)
    text = htmllib.unescape("\n".join(l for _, l in visible))

    # 1. em dashes (visible prose only, not inlined CSS/script comments)
    for i, line in visible:
        if "—" in htmllib.unescape(line) or "&mdash;" in line:
            r.fail(f"em dash on line {i}: {line.strip()[:70]}", "em-dash")

    # 2. unfilled variables (whole doc — a stray placeholder anywhere is a bug)
    for v in ds.unfilled(doc):
        r.fail(f"unfilled placeholder in shipped HTML: {{{{{v}}}}}", "unfilled")

    # 3. data-total consistency
    for m in set(re.findall(r'data-total="(\d+)"', doc)):
        if int(m) != n:
            r.fail(f'data-total="{m}" != slide count {n}', "data-total")

    # 4. footer discipline (role-driven)
    secs = ds.sections(doc)
    if len(secs) != n:
        r.fail(f"{len(secs)} <section> blocks != {n} slides", "section-count")
    for sl, sec in zip(slides, secs):
        sid, role = sl["id"], sl["role"]
        has_foot = "slide-foot" in sec
        if not role:
            r.warn(f"slide '{sid}' has no declared role; footer discipline not checked", "no-role", sid)
            continue
        if role in NO_FOOTER_ROLES and has_foot:
            r.fail(f"slide '{sid}' (role {role}) should have NO footer", "footer", sid)
        if role not in NO_FOOTER_ROLES and not has_foot:
            r.fail(f"slide '{sid}' (role {role}) is missing its .slide-foot", "footer", sid)

    # 6. customer-name text leak
    low = text.lower()
    for name, scope in NAME_SCOPE.items():
        if re.search(rf"\b{name}\b", low) and scope not in allowed:
            r.fail(f"customer name '{name}' present but deck clearance is {sorted(allowed)}", "name-leak")

    # 7. euro number format (WARN)
    for m in re.findall(r"€\s?\d{1,3},\d{3}", text):
        r.warn(f"euro amount uses comma-grouping (Anglo) '{m}': confirm it is a verbatim quote", "euro-format")


def _check_pdf(pdf_path: Path, n: int, client: str, r: Report) -> None:
    pdf_lc = pdf_path.name.lower()
    if "oppr" not in pdf_lc:
        r.fail(f"PDF '{pdf_path.name}' does not carry 'oppr' in its name", "pdf-name")
    if client:
        cslug = ds.slugify(client)
        if cslug and cslug not in pdf_lc:
            r.fail(f"client deck PDF '{pdf_path.name}' is missing the client slug '{cslug}'", "pdf-name")
    import fitz
    pdf = fitz.open(pdf_path)
    if pdf.page_count != n:
        r.fail(f"PDF {pdf_path.name} has {pdf.page_count} pages, expected {n}", "pdf-pages")
    w, h = pdf[0].rect.width / 72, pdf[0].rect.height / 72
    if abs(w - PAGE_W_IN) > 0.02 or abs(h - PAGE_H_IN) > 0.02:
        r.fail(f"PDF page size {w:.3f}x{h:.3f} in, expected {PAGE_W_IN}x{PAGE_H_IN}", "pdf-size")
    for i in range(pdf.page_count):
        pix = pdf[i].get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
        s = pix.samples
        if not s:
            continue
        corner = bytes(s[:pix.n]); step = pix.n
        same = sum(1 for j in range(0, len(s) - step + 1, step) if s[j:j + step] == corner)
        frac = same / (len(s) / step)
        if frac > 0.995:
            r.warn(f"page {i + 1} is {frac*100:.1f}% one color — possibly blank/underfilled", "blank-page")


def _check_images(doc: str, base_dir: Path, allowed: set, ent_map: dict, r: Report) -> None:
    for src in re.findall(r'<img[^>]+src="([^"]+)"', doc):
        target = (base_dir / src).resolve()
        if not target.exists():
            r.fail(f"image does not resolve: {src}", "image-missing")
        mkey = None
        norm = src.replace("\\", "/")
        if "brand/img/" in norm:
            mkey = norm.split("brand/img/", 1)[1]
        if mkey and mkey in ent_map and ent_map[mkey] not in allowed:
            r.fail(f"image '{mkey}' entitlement '{ent_map[mkey]}' exceeds deck clearance {sorted(allowed)}", "image-entitlement")


# --- public entry points -----------------------------------------------------

def verify_dir(deckdir: Path, r: Report | None = None) -> Report:
    r = r or Report()
    deckdir = Path(deckdir).resolve()
    deck = ds.load_deck(deckdir)
    n = len(deck["slides"])
    allowed = set(deck.get("allowed_entitlements", ["public"])); allowed.add("public")
    index = deckdir / "index.html"
    if not index.exists():
        r.fail(f"no index.html in {deckdir} (assemble first)", "no-index")
        return r
    doc = index.read_text(encoding="utf-8")

    slides = []
    for sid in deck["slides"]:
        local = deckdir / "slides" / sid / "meta.yaml"
        meta = local if local.exists() else ds.SLIDES_DIR / sid / "meta.yaml"
        role = ""
        if meta.exists():
            role = (yaml.safe_load(meta.read_text(encoding="utf-8")) or {}).get("role", "")
        slides.append({"id": sid, "role": role})

    _check_html(doc, n, slides, allowed, r)
    _check_images(doc, deckdir, allowed, _image_entitlements(), r)

    pdfs = list(deckdir.glob("*.pdf"))
    if not pdfs:
        r.warn("no PDF found; skipped page-count / size / blank-page checks", "no-pdf")
    else:
        expected = ds.pdf_name(deckdir)
        if pdfs[0].name != expected:
            r.warn(f"PDF name '{pdfs[0].name}' differs from the derived '{expected}'", "pdf-name-warn")
        _check_pdf(pdfs[0], n, deck.get("client", ""), r)
    return r


def verify_snapshot(snapdir: Path, r: Report | None = None) -> Report:
    """Verify a materialized snapshot: index.html + assets/ + optional *.pdf.
    Role, client and entitlements come from the embedded deck-meta JSON."""
    r = r or Report()
    snapdir = Path(snapdir).resolve()
    index = snapdir / "index.html"
    if not index.exists():
        r.fail(f"no index.html in {snapdir}", "no-index")
        return r
    doc = index.read_text(encoding="utf-8")

    m = re.search(r'<script type="application/json" id="deck-meta">\s*(\{.*?\})\s*</script>', doc, re.DOTALL)
    if not m:
        r.fail("snapshot is missing its deck-meta manifest", "no-meta")
        return r
    meta = json.loads(m.group(1))
    slides = meta.get("slides", [])
    n = len(slides)
    allowed = set(meta.get("allowed_entitlements", ["public"])); allowed.add("public")
    client = meta.get("client", "")

    _check_html(doc, n, slides, allowed, r)

    # images: resolve inside the snapshot dir; entitlement from the manifest's assets
    asset_ent = {f"assets/{fn}": a.get("entitlement", "public") for fn, a in meta.get("assets", {}).items()}
    for src in re.findall(r'<img[^>]+src="([^"]+)"', doc):
        if not (snapdir / src).resolve().exists():
            r.fail(f"image does not resolve: {src}", "image-missing")
        if asset_ent.get(src, "public") not in allowed:
            r.fail(f"asset '{src}' entitlement '{asset_ent.get(src)}' exceeds clearance {sorted(allowed)}", "image-entitlement")

    pdfs = list(snapdir.glob("*.pdf"))
    if not pdfs:
        r.warn("no PDF in snapshot; skipped page-count / size / blank-page checks", "no-pdf")
    else:
        _check_pdf(pdfs[0], n, client, r)
    return r

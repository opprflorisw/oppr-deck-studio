# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

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

# Deck Studio 2.0: one gate, several formats.
#
# The brand rules (em dashes, unfilled placeholders, customer-name leaks, image
# entitlement, European numbers, the `oppr` filename token) are UNIVERSAL and run
# on every artifact. Only the page geometry and the deck-specific structural
# rules vary, and they vary by page_format — declared in the snapshot manifest,
# not guessed. A format whose size is None skips the page-size check.
#
# `structural` gates the two rules that only make sense for a composed deck:
# footer discipline by role, and the data-total page counter. A carousel has
# neither, and asserting them on one produced a FAIL for every carousel, which is
# exactly the "passes here, fails there" split this replaces.
#
# `paged` says whether one page <section> prints as exactly one PDF page. Every
# fixed-canvas format is paged, and for those the count is a real gate: a deck
# slide spilling onto a second sheet is a bug. A FLOWING document is not paged.
# An article is one <section> of prose that legitimately prints across five
# sheets, and asserting 1 == 5 there produced a FAIL on every article, which is
# the same class of mistake `structural` was added to fix.
PAGE_FORMATS = {
    "deck-16x9":     {"size": (13.333, 7.5),      "structural": True,  "paged": True},
    "linkedin-4x5":  {"size": (1080 / 96, 1350 / 96), "structural": False, "paged": True},
    "square-1x1":    {"size": (1080 / 96, 1080 / 96), "structural": False, "paged": True},
    "hero-1200x627": {"size": (1200 / 96, 627 / 96),  "structural": False, "paged": True},
    "none":          {"size": None,               "structural": False, "paged": False},
}


def page_rules(page_format: str) -> dict:
    return PAGE_FORMATS.get(page_format or "deck-16x9", PAGE_FORMATS["deck-16x9"])

# One clearance slug per customer (2026-08-01). The old `mutares-family` grouping
# is gone: Mutares is a company in its own right, and each company acquired
# through it is a separate customer at the same level, because a PE-level pitch
# and a plant-level pitch are different decks with different audiences. The old
# `named-customer` bucket is gone for the same reason: it let any customer-cleared
# deck carry any other customer's material, which is weaker than per-customer.
# A customer's own name is its scope, so a deck must be cleared for exactly the
# customers it names.
# Historical contract: never rename or remove an entry. Published decks carry
# `allowed_entitlements` naming these scopes, and changing a slug would
# retroactively fail decks that were correct when they were built. Registered
# customers are merged ON TOP by build_name_scope(), never over.
NAME_SCOPE = {
    "mutares": "mutares", "holliday": "holliday", "venator": "venator",
    "attero": "attero", "keeeper": "keeeper", "omniplast": "omniplast",
    "sonneborn": "sonneborn", "host": "host", "selo": "selo", "wavin": "wavin",
}

# Two customer names are also ordinary English words, so the default \bname\b
# would fail any deck containing "the plant that would host it" or "select".
# Match the full company name for those instead. The trade-off is deliberate:
# a bare "HoSt" now slips through, which is a miss, whereas the default matcher
# produced a false FAIL on every deck using the verb, which trains people to
# ignore the gate. A miss you can catch in the visual pass; a gate nobody
# believes is worse than no gate.
NAME_PATTERN = {
    "host": r"host\s*bioenergy",
    "selo": r"\bselo\b(?!ct)",
}


def _head(s: str) -> str:
    """First word of a slug or name. How a derived scope is tested for collision
    with a built-in one: the 'HoSt Bioenergy' customer row would otherwise derive
    a second scope (`host-bioenergy`) matching the same text the built-in `host`
    scope already claims, and a deck correctly cleared for `host` would start
    failing on a scope it had no way to know about."""
    return re.split(r"[-\s]+", str(s or "").lower())[0]


def clearance_for_customer(customer: dict) -> str:
    """A registered customer's effective clearance slug, or '' when a built-in
    scope already covers it. Mirrors namescope.mjs clearanceForCustomer."""
    slug = str(customer.get("slug") or "").lower()
    if not slug:
        return ""
    if slug in NAME_SCOPE:
        return NAME_SCOPE[slug]
    for h in (_head(slug), _head(customer.get("name"))):
        if h in NAME_SCOPE:
            return NAME_SCOPE[h]
    return slug


def build_name_scope(customers: list[dict] | None = None) -> list[dict]:
    """The scopes the gate enforces: the built-in table, plus one entry per
    registered customer not already covered by it. Mirrors namescope.mjs
    buildNameScope; `tools/check-verify-parity.py` feeds both the same customers
    and diffs the findings, so the two cannot drift."""
    out = [{"name": n, "scope": s, "pattern": NAME_PATTERN.get(n, rf"\b{re.escape(n)}\b")}
           for n, s in NAME_SCOPE.items()]
    seen = {e["scope"] for e in out}
    for c in customers or []:
        scope = clearance_for_customer(c)
        if not scope or scope in seen:      # built-in wins, and never twice
            continue
        # Match the company NAME as it would be written on a slide, not the slug:
        # 'HoSt Bioenergy' is written with a space, and a slug never appears in copy.
        label = str(c.get("name") or c.get("slug") or "").strip().lower()
        if not label:
            continue
        # Split on whitespace FIRST, then escape: re.escape() escapes a space, so
        # substituting the escaped run for \s+ would leave a stray backslash and
        # produce a pattern the JS side does not derive.
        pattern = r"\b" + r"\s+".join(re.escape(p) for p in label.split()) + r"\b"
        out.append({"name": scope, "scope": scope, "pattern": pattern})
        seen.add(scope)
    return out


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


def _check_html(doc: str, n: int, slides: list[dict], allowed: set, r: Report,
                page_format: str = "deck-16x9",
                name_scope: list[dict] | None = None) -> None:
    """slides: [{'id','role'}]. Runs the HTML-level gates on an assembled doc.

    Universal rules run for every page_format; the structural ones (footer
    discipline, data-total) only for formats that have them."""
    structural = page_rules(page_format)["structural"]
    visible = _visible_lines(doc)
    text = htmllib.unescape("\n".join(l for _, l in visible))

    # 1. em dashes (visible prose only, not inlined CSS/script comments)
    for i, line in visible:
        if "—" in htmllib.unescape(line) or "&mdash;" in line:
            r.fail(f"em dash on line {i}: {line.strip()[:70]}", "em-dash")

    # 2. unfilled variables (whole doc — a stray placeholder anywhere is a bug)
    for v in ds.unfilled(doc):
        r.fail(f"unfilled placeholder in shipped HTML: {{{{{v}}}}}", "unfilled")

    # 3. data-total consistency (composed decks only — a carousel has no counter)
    if structural:
        for m in set(re.findall(r'data-total="(\d+)"', doc)):
            if int(m) != n:
                r.fail(f'data-total="{m}" != slide count {n}', "data-total")

    # 4. page count, and footer discipline where the format has footers
    secs = ds.sections(doc)
    if len(secs) != n:
        r.fail(f"{len(secs)} <section> blocks != {n} pages", "section-count")
    if structural:
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
    for entry in (name_scope if name_scope is not None else build_name_scope()):
        if entry["scope"] in allowed:
            continue
        if re.search(entry["pattern"], low):
            r.fail(f"customer name '{entry['name']}' present but deck clearance is {sorted(allowed)}", "name-leak")

    # 7. euro number format (WARN)
    for m in re.findall(r"€\s?\d{1,3},\d{3}", text):
        r.warn(f"euro amount uses comma-grouping (Anglo) '{m}': confirm it is a verbatim quote", "euro-format")


def _check_pdf(pdf_path: Path, n: int, client: str, r: Report,
               page_format: str = "deck-16x9") -> None:
    pdf_lc = pdf_path.name.lower()
    if "oppr" not in pdf_lc:
        r.fail(f"PDF '{pdf_path.name}' does not carry 'oppr' in its name", "pdf-name")
    if client:
        cslug = ds.slugify(client)
        if cslug and cslug not in pdf_lc:
            r.fail(f"client deck PDF '{pdf_path.name}' is missing the client slug '{cslug}'", "pdf-name")
    import fitz
    pdf = fitz.open(pdf_path)
    rules = page_rules(page_format)
    if rules["paged"] and pdf.page_count != n:
        r.fail(f"PDF {pdf_path.name} has {pdf.page_count} pages, expected {n}", "pdf-pages")
    expected = rules["size"]
    if expected:
        w, h = pdf[0].rect.width / 72, pdf[0].rect.height / 72
        ew, eh = expected
        # px-derived formats round less cleanly than inch-declared ones
        tol = 0.02 if page_format == "deck-16x9" else 0.06
        if abs(w - ew) > tol or abs(h - eh) > tol:
            r.fail(f"PDF page size {w:.3f}x{h:.3f} in, expected {ew:.3f}x{eh:.3f} ({page_format})", "pdf-size")
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

def verify_dir(deckdir: Path, r: Report | None = None,
               customers: list[dict] | None = None) -> Report:
    """`customers` are the registered customers whose names the gate should watch
    for, on top of the built-in scopes. Omitting them checks the built-ins only,
    which is the behaviour this had before customers drove the table."""
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

    _check_html(doc, n, slides, allowed, r, name_scope=build_name_scope(customers))
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


def verify_snapshot(snapdir: Path, r: Report | None = None,
                    customers: list[dict] | None = None) -> Report:
    """Verify a materialized snapshot: index.html + assets/ + optional *.pdf.
    Role, client and entitlements come from the embedded deck-meta JSON.
    `customers` extends the name-leak scopes; see verify_dir."""
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
    # Which rule set applies. Declared by the snapshot, never inferred from the
    # bytes, so a carousel is checked as a carousel and a deck as a deck.
    page_format = meta.get("page_format", "deck-16x9")

    _check_html(doc, n, slides, allowed, r, page_format, build_name_scope(customers))

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
        _check_pdf(pdfs[0], n, client, r, page_format)
    return r

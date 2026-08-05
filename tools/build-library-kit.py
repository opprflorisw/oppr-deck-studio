#!/usr/bin/env python
"""
Build the Oppr **design kit**: one shareable zip of the whole visual system.

The brand kit (tools/build-brand-kit.py) answers "here is our logo". This
answers the bigger question a designer, an agency or a new hire actually asks:
*what does Oppr look like, and what am I allowed to build with?* So it bundles
three things that were previously only browsable inside the app:

    the icon set      library/icons/
    the design system library/design-system/  (every block and pattern specimen)
    the brand kit     brand/kit/              (logos, in every form)

    python tools\\build-library-kit.py
    python tools\\build-library-kit.py --check    # fail if the output is stale

WHY IT IS SELF-CONTAINED. The point of the zip is that it survives leaving the
building: no server, no repo, no network, no fonts installed. So the specimens
are rewritten to point at a bundled copy of the stylesheets, the stylesheets are
rewritten to point at bundled fonts, and `index.html` is a plain offline page
that opens straight off the filesystem by double-clicking it.

WHY THE VIEWER USES NO fetch(). Opened from disk, a page is an opaque origin and
`fetch()` of a sibling file is blocked. Anything the viewer needs to *read* is
inlined into the page at build time; anything it only needs to *show* or *link*
is an <img> or an <a>, both of which work fine on file://.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import zipfile
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
KIT = REPO_ROOT / "library" / "kit"
ZIP_NAME = "oppr-design-kit.zip"

ICONS_DIR = REPO_ROOT / "library" / "icons"
DS_DIR = REPO_ROOT / "library" / "design-system"
BRAND_KIT = REPO_ROOT / "brand" / "kit"
FONTS_DIR = REPO_ROOT / "brand" / "fonts-static"
TEMPLATES = REPO_ROOT / "templates"

DS_GROUPS = ("foundations", "blocks", "patterns")


# --- assembling the package --------------------------------------------------

def copy_css() -> None:
    """Bundle the stylesheets, repointed at the bundled fonts.

    deck.css asks for ../brand/fonts-static/*.woff2, which does not exist inside
    the kit. Without this rewrite every specimen falls back to a system font and
    the whole package misrepresents the type, which is most of the identity.
    """
    out = KIT / "css"
    out.mkdir(parents=True, exist_ok=True)
    for name in ("deck.css", "showcase.css", "linkedin.css"):
        src = TEMPLATES / name
        if not src.exists():
            continue
        css = src.read_text(encoding="utf-8")
        css = css.replace("../brand/fonts-static/", "../fonts/")
        (out / name).write_text(css, encoding="utf-8")


def copy_fonts() -> None:
    out = KIT / "fonts"
    out.mkdir(parents=True, exist_ok=True)
    for f in sorted(FONTS_DIR.glob("*.woff2")):
        shutil.copy2(f, out / f.name)


def copy_icons() -> list[dict]:
    out = KIT / "icons"
    out.mkdir(parents=True, exist_ok=True)
    meta = json.loads((ICONS_DIR / "icons.json").read_text(encoding="utf-8"))
    for f in sorted(ICONS_DIR.glob("*.svg")):
        shutil.copy2(f, out / f.name)
    shutil.copy2(ICONS_DIR / "icons.json", out / "icons.json")
    return meta["icons"]


def copy_design_system() -> list[dict]:
    """Copy every specimen, repointed at the bundled CSS.

    Specimens link ../../../templates/*.css because they live three deep in the
    repo. In the kit they live one deep, so the link is rewritten rather than
    the folder shape being faked.
    """
    out = KIT / "design-system"
    out.mkdir(parents=True, exist_ok=True)
    imgdir = KIT / "img"
    found = []
    for group in DS_GROUPS:
        gdir = DS_DIR / group
        if not gdir.is_dir():
            continue
        (out / group).mkdir(exist_ok=True)
        for f in sorted(gdir.glob("*.html")):
            html = f.read_text(encoding="utf-8")
            html = html.replace("../../../templates/", "../../css/")
            # Some specimens (the covers) use a real brand photograph. Bundle
            # whatever they actually reference rather than shipping a specimen
            # with a hole in it; check-kit.py fails the build if one is missed.
            for rel in sorted(set(re.findall(r"\.\./\.\./\.\./brand/img/([^\"')]+)", html))):
                src = REPO_ROOT / "brand" / "img" / rel
                if src.exists():
                    dst = imgdir / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dst)
                    html = html.replace(f"../../../brand/img/{rel}", f"../../img/{rel}")
            (out / group / f.name).write_text(html, encoding="utf-8")
            title = re.search(r"<title>(.*?)</title>", html, re.S)
            name = title.group(1).split("&middot;")[-1].strip() if title else f.stem
            found.append({"group": group, "file": f"{group}/{f.name}", "name": name, "stem": f.stem})
    return found


def copy_brand() -> dict:
    out = KIT / "brand"
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(BRAND_KIT, out, ignore=shutil.ignore_patterns("*.zip"))
    manifest = json.loads((BRAND_KIT / "kit.json").read_text(encoding="utf-8"))
    return manifest


# --- the offline viewer ------------------------------------------------------

def viewer_html(icons: list[dict], specimens: list[dict], brand: dict) -> str:
    colours = "".join(
        f'<figure class="sw"><div class="chip" style="background:{c["hex"]}"></div>'
        f'<figcaption><b>{c["name"]}</b><span class="mono">{c["hex"]}</span>'
        f'<span class="note">{c.get("note", "")}</span></figcaption></figure>'
        for c in brand.get("colours", []))

    # Icon SVGs are INLINED, not fetched: opened from disk this page cannot read
    # a sibling file, and an icon set you cannot see is not a reference.
    icon_cards = []
    for i in icons:
        svg = (KIT / "icons" / f"{i['name']}.svg").read_text(encoding="utf-8").strip()
        icon_cards.append(
            f'<figure class="ic" data-q="{i["name"]} {" ".join(i.get("keywords", []))}">'
            f'<div class="glyph">{svg}</div><figcaption><b>{i["name"]}</b>'
            f'<span class="note">{i.get("description", "")}</span>'
            f'<code>{{{{icon:{i["name"]}}}}}</code></figcaption></figure>')

    spec_groups = ""
    for group in DS_GROUPS:
        items = [s for s in specimens if s["group"] == group]
        if not items:
            continue
        links = "".join(
            f'<a class="spec" href="design-system/{s["file"]}" target="_blank" rel="noopener">'
            f'<span class="sname">{s["name"]}</span><span class="mono">{s["stem"]}</span></a>'
            for s in items)
        spec_groups += (f'<h3 class="grp">{group.capitalize()}'
                        f'<span class="count">{len(items)}</span></h3>'
                        f'<div class="specs">{links}</div>')

    # kit.json calls them `items`, and a wrong key here silently produced an
    # empty Logo section rather than an error.
    logos = ""
    for g in brand.get("groups", []):
        items = g.get("items", [])
        if not items:
            continue
        rec = ' <span class="pref">preferred</span>' if g.get("recommended") else ""
        logos += (f'<h3 class="grp">{g["title"]}{rec}</h3>'
                  f'<p class="note" style="margin:2px 0 0">{g.get("note", "")}</p>'
                  '<div class="grid logo-grid">'
                  + "".join(
                      f'<figure class="logo {"on-ink" if it.get("bg") == "ink" else ""}">'
                      f'<img src="brand/assets/{it["file"]}" alt="{it.get("label", it["file"])}">'
                      f'<figcaption><b>{it.get("label", "")}</b>'
                      f'<span class="mono">{it["file"]}</span></figcaption></figure>'
                      for it in items)
                  + "</div>")

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Oppr Design Kit</title>
<style>
@font-face {{ font-family: Archivo; font-weight: 400; font-display: swap;
  src: url("fonts/Archivo-400.woff2") format("woff2"); }}
@font-face {{ font-family: Archivo; font-weight: 700; font-display: swap;
  src: url("fonts/Archivo-700.woff2") format("woff2"); }}
@font-face {{ font-family: "JetBrains Mono"; font-weight: 400; font-display: swap;
  src: url("fonts/JetBrainsMono-400.woff2") format("woff2"); }}
:root {{ --bg:#f2f2ed; --surface:#fcfbf7; --ink:#15201e; --muted:#5f6965;
  --line:#c8ceca; --accent:#a65032;
  --sans:Archivo,system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,monospace; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans);
  line-height:1.55; }}
.wrap {{ max-width:1180px; margin:0 auto; padding:0 28px 90px; }}
header.top {{ position:sticky; top:0; z-index:5; background:var(--bg);
  border-bottom:1px solid var(--line); padding:20px 28px 14px; margin-bottom:34px; }}
header.top .in {{ max-width:1180px; margin:0 auto; display:flex; align-items:baseline;
  gap:16px; flex-wrap:wrap; }}
.mark {{ font-size:30px; font-weight:700; letter-spacing:-.045em; }}
.mark b {{ color:var(--accent); }}
.top nav {{ margin-left:auto; display:flex; gap:6px; flex-wrap:wrap; }}
.top nav a {{ color:var(--muted); text-decoration:none; font-weight:600; font-size:14px;
  padding:5px 11px; border-radius:7px; }}
.top nav a:hover {{ color:var(--ink); background:var(--surface); }}
h1 {{ font-size:34px; margin:0 0 10px; letter-spacing:-.02em; }}
h2 {{ font-size:23px; margin:52px 0 6px; letter-spacing:-.01em; }}
h2:first-of-type {{ margin-top:8px; }}
.lede {{ font-size:16px; color:var(--muted); max-width:74ch; margin:0 0 8px; }}
.eyebrow {{ font-family:var(--mono); font-size:11px; letter-spacing:.13em;
  text-transform:uppercase; color:var(--accent); margin:0 0 12px; }}
.mono {{ font-family:var(--mono); }}
.note {{ color:var(--muted); font-size:12.5px; }}
.grid {{ display:grid; gap:14px; margin-top:18px; }}
.sw-grid {{ grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); }}
.sw .chip {{ height:76px; border-radius:10px; border:1px solid var(--line); }}
.sw figcaption {{ display:flex; flex-direction:column; gap:1px; margin-top:8px; font-size:12.5px; }}
.ic-grid {{ grid-template-columns:repeat(auto-fill,minmax(212px,1fr)); }}
.ic {{ margin:0; background:var(--surface); border:1px solid var(--line);
  border-radius:10px; padding:16px; }}
.ic .glyph {{ display:flex; align-items:center; justify-content:center; height:52px;
  color:var(--accent); }}
.ic .glyph svg {{ width:28px; height:28px; }}
.ic figcaption {{ display:flex; flex-direction:column; gap:4px; text-align:center; }}
.ic b {{ font-family:var(--mono); font-size:12.5px; }}
.ic code {{ font-family:var(--mono); font-size:10.5px; color:var(--accent);
  background:var(--bg); border:1px solid var(--line); border-radius:5px; padding:2px 5px; }}
.specs {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(232px,1fr));
  gap:10px; margin:12px 0 4px; }}
.spec {{ display:flex; flex-direction:column; gap:2px; padding:13px 15px;
  background:var(--surface); border:1px solid var(--line); border-radius:9px;
  text-decoration:none; color:inherit; }}
.spec:hover {{ border-color:var(--accent); }}
.sname {{ font-weight:700; font-size:14px; }}
.spec .mono {{ font-size:11px; color:var(--muted); }}
.grp {{ font-size:14px; margin:26px 0 0; display:flex; align-items:center; gap:9px; }}
.grp .count {{ font-family:var(--mono); font-size:11px; color:var(--muted);
  border:1px solid var(--line); border-radius:999px; padding:1px 8px; }}
.logo-grid {{ grid-template-columns:repeat(auto-fill,minmax(252px,1fr)); }}
.logo {{ margin:0; background:var(--surface); border:1px solid var(--line);
  border-radius:10px; padding:24px; }}
.logo.on-ink {{ background:var(--ink); }}
.logo img {{ display:block; width:100%; height:58px; object-fit:contain; }}
.logo figcaption {{ display:flex; flex-direction:column; gap:2px; margin-top:14px; font-size:12.5px; }}
.logo.on-ink figcaption {{ color:#f2f2ed; }}
.logo.on-ink .mono {{ color:rgba(242,242,237,.65); }}
.pref {{ font-family:var(--mono); font-size:10px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--accent); border:1px solid var(--accent);
  border-radius:999px; padding:1px 8px; margin-left:8px; }}
#q {{ font:inherit; font-size:14px; padding:8px 12px; border:1px solid var(--line);
  border-radius:8px; background:var(--surface); color:var(--ink); width:220px; }}
.rules {{ background:var(--surface); border:1px solid var(--line); border-radius:10px;
  padding:6px 24px 18px; margin-top:18px; }}
.rules li {{ margin:9px 0; font-size:14.5px; }}
footer {{ margin-top:64px; padding-top:18px; border-top:1px solid var(--line);
  color:var(--muted); font-size:13px; }}
</style></head>
<body>
<header class="top"><div class="in">
  <span class="mark">oppr<b>.</b></span>
  <span class="note">Design Kit &middot; {date.today().isoformat()}</span>
  <nav>
    <a href="#colour">Colour</a><a href="#type">Type</a><a href="#logo">Logo</a>
    <a href="#icons">Icons</a><a href="#system">Design system</a><a href="#rules">Rules</a>
  </nav>
</div></header>

<div class="wrap">
  <h1>The Oppr visual system</h1>
  <p class="lede">Everything needed to make something that looks like Oppr: the palette,
    the two typefaces, the logo in every form, the icon set, and a rendered specimen of
    every block the decks are built from. It is self-contained. No network, no
    installation, no fonts to install: open this file and it works.</p>

  <h2 id="colour">Colour</h2>
  <p class="lede">One accent per element. Terracotta is the operator's voice and is the
    only accent that carries meaning by itself.</p>
  <div class="grid sw-grid">{colours}</div>

  <h2 id="type">Type</h2>
  <p class="lede">Archivo for everything that speaks, JetBrains Mono for everything that
    labels. Both are bundled in <span class="mono">fonts/</span> and used by this page,
    so what you see here is what prints.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div><p class="eyebrow">Archivo</p>
      <p style="font-size:40px;font-weight:700;letter-spacing:-.02em;margin:0">
        Find the improvements</p>
      <p style="font-size:17px;color:var(--muted);margin:6px 0 0">
        Regular for body, 700 for headlines. Tight tracking on display sizes.</p></div>
    <div><p class="eyebrow">JetBrains Mono</p>
      <p class="mono" style="font-size:19px;margin:0">STEP 1 &middot; ANALYZE</p>
      <p style="font-size:17px;color:var(--muted);margin:6px 0 0">
        Eyebrows, tags, footers, page numbers. Uppercase, letter-spaced.</p></div>
  </div>

  <h2 id="logo">Logo</h2>
  <p class="lede">The outlined versions carry no font dependency, which is why they are
    the ones to send outside Oppr. Clear space is
    <span class="mono">{brand.get("wordmark", {}).get("clear_space", "")}</span> units on
    every side. Full detail in <span class="mono">brand/README.txt</span>.</p>
  {logos}

  <h2 id="icons">Icons <span class="note" style="font-weight:400">({len(icons)})</span></h2>
  <p class="lede">Stroke-only, 24&times;24, <span class="mono">currentColor</span>: colour
    comes from whatever they sit in. In a deck they are written as
    <span class="mono">{{{{icon:name}}}}</span> and inlined at build time.
    <input id="q" type="search" placeholder="Filter icons&hellip;" style="margin-left:8px">
  </p>
  <div class="grid ic-grid" id="icons">{"".join(icon_cards)}</div>

  <h2 id="system">Design system</h2>
  <p class="lede">Every block and pattern the decks are composed from, rendered from the
    real stylesheets bundled here. Click one to open it full size. <b>A new slide may use
    only these</b>: if something is not here, it gets added here first.</p>
  {spec_groups}

  <h2 id="rules">The rules that matter</h2>
  <ul class="rules">
    <li><b>One accent per element.</b> No gradients on the mark, no second accent.</li>
    <li><b>No em dashes.</b> En dashes for numeric ranges are fine.</li>
    <li><b>European number formatting.</b> &euro;&nbsp;25.000 and 0,5%, not 25,000 and 0.5%.</li>
    <li><b>Short, declarative, concrete.</b> No hype. Claims are labelled when illustrative.</li>
    <li><b>Compose from documented blocks.</b> Need a new pattern? It gets a specimen first.</li>
    <li><b>The outlined logo travels.</b> Anything leaving Oppr uses it, so it needs no font.</li>
  </ul>

  <footer>
    Generated by <span class="mono">tools/build-library-kit.py</span> from the Oppr Deck
    Studio repository. The repository is the source of truth; this is a snapshot taken on
    {date.today().isoformat()}. Questions: floris@oppr.ai
  </footer>
</div>

<script>
// Filter the icon grid. Everything it needs is already in the page, because a
// file:// page cannot fetch its own siblings.
var q = document.getElementById('q');
if (q) q.addEventListener('input', function () {{
  var needle = q.value.trim().toLowerCase();
  document.querySelectorAll('#icons .ic').forEach(function (c) {{
    c.style.display = !needle || c.dataset.q.toLowerCase().indexOf(needle) > -1 ? '' : 'none';
  }});
}});
</script>
</body></html>
"""


def readme_txt(icons: list[dict], specimens: list[dict]) -> str:
    return f"""OPPR DESIGN KIT
{date.today().isoformat()}

WHAT THIS IS
  The whole Oppr visual system in one folder: the palette, the two typefaces,
  the logo in every form, the {len(icons)}-icon set, and a rendered specimen of
  every one of the {len(specimens)} blocks our decks are built from.

START HERE
  Open index.html in any browser. Double-clicking it is enough. There is no
  server to run, nothing to install and no network needed. The fonts are
  bundled, so the type you see is the type we ship.

WHAT IS IN HERE
  index.html         the viewer. Start here.
  brand/             the logo kit: outlined SVG and PNG, plus its own README.
  icons/             the icon set as individual SVGs, plus icons.json.
  design-system/     one rendered page per block and pattern.
  css/               the real stylesheets the specimens use.
  fonts/             Archivo and JetBrains Mono as static woff2.

USING IT
  Logo             Use the OUTLINED files for anything leaving Oppr: they carry
                   no font dependency, so they render the same everywhere.
                   Keep the clear space given in brand/README.txt. Do not
                   recolour the mark or put a gradient on it.
  Icons            Stroke-only, 24x24, currentColor. They take the colour of
                   whatever they sit in. Do not fill them and do not redraw
                   them; if one is missing, ask and it gets added to the set.
  Blocks           A slide is composed only from the documented blocks in
                   design-system/. That is what keeps the decks consistent.
                   If a layout is not in here, it does not exist yet.

THE WRITING RULES, BECAUSE THEY ARE PART OF THE LOOK
  No em dashes. En dashes for numeric ranges are fine.
  European number formatting: EUR 25.000 and 0,5%.
  Short, declarative, concrete. No hype. Illustrative claims say so.

PROVENANCE
  Generated by tools/build-library-kit.py from the Oppr Deck Studio repository,
  which is the source of truth. This folder is a snapshot, not the original: if
  it disagrees with the repository, the repository wins.

  floris@oppr.ai  ·  oppr.ai
"""


# --- build -------------------------------------------------------------------

def build() -> dict:
    if KIT.exists():
        shutil.rmtree(KIT)
    KIT.mkdir(parents=True)

    copy_css()
    copy_fonts()
    icons = copy_icons()
    specimens = copy_design_system()
    brand = copy_brand()

    (KIT / "index.html").write_text(viewer_html(icons, specimens, brand), encoding="utf-8")
    (KIT / "README.txt").write_text(readme_txt(icons, specimens), encoding="utf-8")

    manifest = {
        "generated_by": "tools/build-library-kit.py",
        "generated_on": date.today().isoformat(),
        "icons": len(icons),
        "specimens": len(specimens),
        "zip": ZIP_NAME,
    }
    (KIT / "kit.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_zip()
    return manifest


def write_zip() -> Path:
    """One file to hand to someone outside Oppr.

    Fixed timestamps and sorted entries, so an unchanged kit rebuilds to
    byte-identical output and `--check` means something.
    """
    out = KIT / ZIP_NAME
    members = sorted(
        (p for p in KIT.rglob("*") if p.is_file() and p.name != ZIP_NAME),
        key=lambda p: p.relative_to(KIT).as_posix(),
    )
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in members:
            # Everything sits under one folder, so unzipping never sprays files
            # across the recipient's Downloads.
            info = zipfile.ZipInfo(f"oppr-design-kit/{p.relative_to(KIT).as_posix()}",
                                   date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, p.read_bytes())
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the Oppr design kit.")
    ap.add_argument("--check", action="store_true",
                    help="rebuild and fail if anything differs (CI / doc drift)")
    args = ap.parse_args()

    if args.check:
        snap = lambda: {p.relative_to(KIT).as_posix(): p.read_bytes()
                        for p in KIT.rglob("*") if p.is_file()} if KIT.exists() else {}
        before = snap()
        build()
        after = snap()
        stale = sorted(set(before) ^ set(after)) + \
            sorted(k for k in before.keys() & after.keys() if before[k] != after[k])
        # The viewer and README carry today's date, so they always differ.
        stale = [s for s in stale if s not in ("index.html", "README.txt", "kit.json", ZIP_NAME)]
        if stale:
            print("STALE: " + ", ".join(stale))
            return 1
        print("design kit is up to date")
        return 0

    m = build()
    size = (KIT / ZIP_NAME).stat().st_size
    print(f"Design kit: {m['icons']} icons + {m['specimens']} specimens + the brand kit")
    print(f"  library/kit/{ZIP_NAME}  ({size // 1024} KB)")
    print(f"  open library/kit/index.html to preview the viewer")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

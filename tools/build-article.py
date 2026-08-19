#!/usr/bin/env python3
"""Build an Oppr article: article.yaml -> index.html (+ post.txt).

An article was the one output type with no HTML document, which is what kept it
outside the edit -> verify -> PDF loop (root CLAUDE.md, Roadmap). This is that
builder. It renders against the real `templates/article.css`, so an article can
never drift from the brand system, and it is a gate as well as a renderer:

  * an em dash anywhere in the copy is a hard stop (brand rule)
  * every [n] reference marker must resolve to a source
  * every source must be cited at least once, or it is decoration
  * a `{{placeholder}}` left in the copy is a hard stop, exactly as in a deck

Usage:
    python tools/build-article.py --article social/linkedin/<date>_<slug>
    python tools/build-article.py --all        # every article.yaml under social/
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent

# The whole article is ONE <section>, so the snapshot manifest reports one page.
# A subhead is not a page break: an article is a column, not a slide deck, and
# pretending otherwise would make verify count headings as pages.
DOC = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="{css}">
</head>
<body>
<section class="apage">
  <span class="awm">oppr<b>.</b></span>
  <p class="akicker">{kicker}</p>
  <h1>{title}</h1>
  <p class="astandfirst">{standfirst}</p>
  <div class="ameta">{meta}</div>
{body}
{sources}
  <div class="afoot">{foot}</div>
</section>
</body>
</html>
"""


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""), quote=False)


def inline(text: str, nsources: int, where: str, problems: list) -> str:
    """Escape, then re-introduce the two inline forms the copy may use:
    **bold** and [n] reference markers. Escaping first is the point: the copy is
    prose written by a human, not markup, so a stray < is text."""
    out = esc(text)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)

    def ref(m: re.Match) -> str:
        n = int(m.group(1))
        if not 1 <= n <= nsources:
            problems.append(f"{where}: reference [{n}] has no source {n} (there are {nsources})")
        return f'<sup class="aref"><a href="#s{n}">{n}</a></sup>'

    return re.sub(r"\[(\d+)\]", ref, out)


def render_block(b: dict, nsrc: int, problems: list) -> str:
    """One block of the article body. The vocabulary is deliberately small: a
    block that is not here does not exist, and adding one means adding its CSS to
    templates/article.css first (design-system composition rule)."""
    (kind, val), = b.items()
    i = lambda t, w: inline(t, nsrc, w, problems)  # noqa: E731

    if kind == "h2":
        return f"  <h2>{esc(val)}</h2>"
    if kind == "p":
        return f'  <p>{i(val, "paragraph")}</p>'
    if kind == "stat":
        tone = f' {val["tone"]}' if val.get("tone") else ""
        label = f'\n    <span class="l">{i(val.get("l", ""), "stat label")}</span>' if val.get("l") else ""
        return (f'  <div class="astat{tone}">\n    <span class="n">{esc(val["n"])}</span>'
                f'{label}\n  </div>')
    if kind == "quote":
        cite = f'\n    <span class="cite">{i(val.get("cite", ""), "quote cite")}</span>' if val.get("cite") else ""
        return f'  <blockquote class="aquote">\n    <p>{i(val["text"], "quote")}</p>{cite}\n  </blockquote>'
    if kind == "list":
        items = "\n".join(f'    <li>{i(x, "list item")}</li>' for x in val)
        return f'  <ul class="alist">\n{items}\n  </ul>'
    if kind == "contrast":
        cols = []
        for cls, key in (("see", "see"), ("blind", "blind")):
            c = val[key]
            cols.append(f'    <div class="col {cls}">\n      <div class="lbl">{esc(c["lbl"])}</div>'
                        f'\n      <div class="mk">{i(c["mk"], "contrast")}</div>\n    </div>')
        return '  <div class="acontrast">\n' + "\n".join(cols) + "\n  </div>"
    if kind == "cce":
        steps = "\n".join(
            f'    <div class="step">\n      <div class="n">{esc(s["n"])}</div>'
            f'\n      <div class="t">{esc(s["t"])}</div>'
            f'\n      <div class="d">{i(s["d"], "cce step")}</div>\n    </div>'
            for s in val)
        return f'  <div class="acce">\n{steps}\n  </div>'
    if kind == "caveat":
        return ('  <div class="acaveat">\n    <div class="lbl">What this does not prove</div>'
                f'\n    <p>{i(val, "caveat")}</p>\n  </div>')
    problems.append(f"unknown block type '{kind}' (add its CSS to templates/article.css first)")
    return ""


def render_sources(sources: list) -> str:
    if not sources:
        return ""
    items = []
    for n, s in enumerate(sources, 1):
        pub = f' {esc(s["pub"])}' if s.get("pub") else ""
        note = f' {esc(s["note"])}' if s.get("note") else ""
        url = f'<br><a href="{esc(s["url"])}">{esc(s["url"])}</a>' if s.get("url") else ""
        items.append(f'    <li id="s{n}"><span class="t">{esc(s["t"])}</span>{pub}.{note}{url}</li>')
    return ('  <div class="asources">\n    <h2>Sources</h2>\n    <ol>\n'
            + "\n".join(items) + "\n    </ol>\n  </div>")


def plain(blocks: list) -> str:
    """A readable plain-text rendering, for anyone reading the folder rather
    than the built page. Never the artifact: the HTML is."""
    out = []
    for b in blocks:
        (kind, val), = b.items()
        if kind == "h2":
            out.append(f"\n## {val}\n")
        elif kind == "p":
            out.append(re.sub(r"\[(\d+)\]", r" [\1]", val).replace("**", ""))
        elif kind == "stat":
            out.append(f"\n{val['n']} - {val.get('l', '')}\n")
        elif kind == "quote":
            out.append(f"\n> {val['text']}\n>   {val.get('cite', '')}\n")
        elif kind == "list":
            out.extend(f"- {x}" for x in val)
        elif kind == "contrast":
            out.append(f"\n{val['see']['lbl']}: {val['see']['mk']}\n{val['blind']['lbl']}: {val['blind']['mk']}\n")
        elif kind == "cce":
            out.extend(f"\n{s['n']} {s['t']} - {s['d']}" for s in val)
        elif kind == "caveat":
            out.append(f"\nWhat this does not prove: {val}\n")
    return "\n".join(out)


def build(adir: Path) -> int:
    src = adir / "article.yaml"
    if not src.is_file():
        print(f"FAIL no article.yaml in {adir}", file=sys.stderr)
        return 1
    data = yaml.safe_load(src.read_text(encoding="utf-8")) or {}
    blocks = data.get("blocks") or []
    sources = data.get("sources") or []
    problems: list[str] = []

    body = "\n".join(x for x in (render_block(b, len(sources), problems) for b in blocks) if x)

    # Every source has to be earned. An uncited source is a reading list, and a
    # reading list at the bottom of a claim is the shape of borrowed authority.
    used = {int(n) for n in re.findall(r"#s(\d+)", body)}
    for n in range(1, len(sources) + 1):
        if n not in used:
            problems.append(f"source [{n}] ({sources[n - 1].get('t', '?')}) is never cited in the body")

    depth = len(adir.resolve().relative_to(REPO).parts)
    meta_bits = [data.get("date", ""), data.get("read", ""), data.get("byline", "Floris Wyers, Oppr")]
    doc = DOC.format(
        title=esc(data.get("title", "")),
        css="../" * depth + "templates/article.css",
        kicker=esc(data.get("kicker", "")),
        standfirst=inline(data.get("standfirst", ""), len(sources), "standfirst", problems),
        meta="".join(f"<span>{esc(m)}</span>" for m in meta_bits if m),
        body=body,
        sources=render_sources(sources),
        foot=inline(data.get("foot", ""), len(sources), "foot", problems),
    )

    # Brand gates. These run here as well as in verify-deck so a mistake is
    # caught at the point it was written, not three tools later.
    for line_no, line in enumerate(doc.splitlines(), 1):
        if "—" in line:
            problems.append(f"em dash on line {line_no}: {line.strip()[:70]}")
    for ph in set(re.findall(r"\{\{([^}]+)\}\}", doc)):
        problems.append(f"unfilled placeholder {{{{{ph}}}}}")
    if "�" in doc:
        problems.append("replacement character in the copy (encoding got mangled upstream)")

    if problems:
        for p in problems:
            print("FAIL " + p, file=sys.stderr)
        return 1

    (adir / "index.html").write_text(doc, encoding="utf-8")
    (adir / "article.md").write_text(
        f"# {data.get('title', '')}\n\n{data.get('standfirst', '')}\n" + plain(blocks) + "\n",
        encoding="utf-8")
    if data.get("post"):
        (adir / "post.txt").write_text(str(data["post"]).rstrip() + "\n", encoding="utf-8")

    # The hero is built by its own tool, which owns the banner rules (claim
    # length, no dashes, no mojibake). Calling it here rather than duplicating
    # those rules keeps one gate for the banner.
    hero = data.get("hero") or {}
    if hero:
        import subprocess
        cmd = [sys.executable, str(REPO / "tools" / "build-article-hero.py"),
               "--claim", hero.get("claim", ""), "--kicker", hero.get("kicker", ""),
               "--stat-n", hero.get("stat_n", ""), "--stat-l", hero.get("stat_l", ""),
               "--out", str(adir / "hero")]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode:
            print(res.stderr.strip(), file=sys.stderr)
            return 1

    print(f"  {adir.relative_to(REPO).as_posix():<52} {len(blocks):>2} blocks  "
          f"{len(sources):>2} sources  {len(doc):>6} bytes")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Build an Oppr article from article.yaml.")
    ap.add_argument("--article", help="folder holding article.yaml")
    ap.add_argument("--all", action="store_true", help="build every article.yaml under social/")
    args = ap.parse_args()

    if args.all:
        dirs = sorted(p.parent for p in (REPO / "social").rglob("article.yaml"))
    elif args.article:
        dirs = [(REPO / args.article).resolve()]
    else:
        ap.error("need --article or --all")

    if not dirs:
        print("no article.yaml found")
        return 0
    rc = 0
    for d in dirs:
        rc |= build(d)
    return rc


if __name__ == "__main__":
    sys.exit(main())

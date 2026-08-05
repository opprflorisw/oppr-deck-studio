#!/usr/bin/env python
"""
Are the shareable kits actually self-contained?

`brand/kit/` and `library/kit/` are the two things in this repo built to leave
the building. They are opened from a filesystem by someone with no repo, no
server and no network, which means a single wrong relative path is not a cosmetic
bug: it is a broken download in front of a customer, and nobody here would ever
see it.

    python tools\\check-kit.py            # both kits
    python tools\\check-kit.py --zip      # check inside the zips instead

It fails on:
  - a src/href/url() that resolves to nothing inside the kit
  - any reference to the network (the kit must work offline)
  - a viewer that needs fetch()/XHR (blocked on file:// by every browser)

This exists because the brand kit shipped for weeks with every PNG download
pointing one folder too high.
"""
from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
KITS = {
    "brand kit": REPO_ROOT / "brand" / "kit",
    "design kit": REPO_ROOT / "library" / "kit",
}

# src="…", href="…", href='…', url(…), url("…"), url('…')
REF_RE = re.compile(
    r"""(?:src|href)\s*=\s*["']([^"'#>]+)["']|url\(\s*["']?([^"')]+)["']?\s*\)""")
NETWORK_RE = re.compile(r"^(?:https?:)?//")
BLOCKED_ON_FILE = ("fetch(", "XMLHttpRequest")


def normalise(base: str, ref: str) -> str:
    """Resolve `ref` against `base` without touching the filesystem."""
    parts = (base.split("/") if base else []) + ref.split("/")
    stack: list[str] = []
    for p in parts:
        if p == "..":
            if stack:
                stack.pop()
        elif p not in (".", ""):
            stack.append(p)
    return "/".join(stack)


def check(name: str, files: dict[str, bytes], strip: str = "") -> int:
    """`files` maps kit-relative path -> bytes."""
    have = set(files)
    problems: list[str] = []
    checked = 0

    for path, raw in sorted(files.items()):
        if not path.endswith((".html", ".css")):
            continue
        text = raw.decode("utf-8", "replace")
        base = str(Path(path).parent).replace("\\", "/")
        base = "" if base == "." else base

        if path.endswith(".html"):
            for banned in BLOCKED_ON_FILE:
                if banned in text:
                    problems.append(f"{path}: uses {banned}, which is blocked on file://")

        for m in REF_RE.finditer(text):
            ref = (m.group(1) or m.group(2) or "").strip()
            if not ref or ref.startswith(("data:", "mailto:", "#", "tel:")):
                continue
            if NETWORK_RE.match(ref):
                problems.append(f"{path}: reaches the network -> {ref}")
                continue
            checked += 1
            target = normalise(base, ref)
            if target not in have:
                problems.append(f"{path}: broken -> {ref}")

    label = f"{name:<11}"
    if problems:
        print(f"{label} FAIL  {len(problems)} problem(s), {checked} references checked")
        for p in problems:
            print(f"              {p}")
        return 1
    print(f"{label} ok    {checked} references, all resolve inside the kit, none online")
    return 0


def from_dir(root: Path) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes()
            for p in root.rglob("*") if p.is_file() and p.suffix != ".zip"}


def from_zip(zpath: Path) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    with zipfile.ZipFile(zpath) as z:
        names = z.namelist()
        # Entries may share one top folder; strip it so paths are kit-relative.
        tops = {n.split("/")[0] for n in names if "/" in n}
        prefix = f"{tops.pop()}/" if len(tops) == 1 else ""
        for n in names:
            if n.endswith("/"):
                continue
            out[n[len(prefix):] if n.startswith(prefix) else n] = z.read(n)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", action="store_true",
                    help="check inside the built zips rather than the folders")
    args = ap.parse_args()

    rc = 0
    for name, root in KITS.items():
        if not root.exists():
            print(f"{name:<11} skip  not built yet")
            continue
        if args.zip:
            zips = [p for p in root.glob("*.zip")]
            if not zips:
                print(f"{name:<11} skip  no zip built")
                continue
            rc |= check(f"{name} zip", from_zip(zips[0]))
        else:
            rc |= check(name, from_dir(root))
    return rc


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python
"""
One-shot, re-runnable migration of the existing repo decks into the backend
(Deck Studio v3, §4.6). Canonicals become master-tagged decks; variants get
lineage from their manifest; customers and the social publish log come along.

    python tools/migrate-decks.py

Safe to re-run: any deck whose slug already exists is SKIPPED.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckstudio as ds
from supa import Supa

TOOLS = Path(__file__).resolve().parent
PY = sys.executable


def _publish(deckdir: Path, *flags: str) -> bool:
    cmd = [PY, str(TOOLS / "publish-deck.py"), str(deckdir), *flags]
    print("  >", " ".join(["publish-deck.py", deckdir.name, *flags]))
    res = subprocess.run(cmd, cwd=ds.REPO_ROOT)
    return res.returncode == 0


def main() -> int:
    sb = Supa()
    existing = {d["slug"] for d in sb.select("decks", {"select": "slug"})}

    # 1. canonicals -> masters
    canon_dir = ds.REPO_ROOT / "decks" / "canonical"
    for d in sorted(p for p in canon_dir.iterdir() if (p / "deck.yaml").exists()):
        deck = ds.load_deck(d)
        slug = deck.get("type", d.name)
        if slug in existing:
            print(f"SKIP master {slug} (exists)")
            continue
        print(f"PUBLISH master {slug}")
        _publish(d, "--master", "--type", deck.get("type", ""))

    # refresh existing after masters land (so lineage lookups resolve)
    existing = {d["slug"] for d in sb.select("decks", {"select": "slug"})}

    # 2. variants
    var_dir = ds.REPO_ROOT / "decks" / "variants"
    for d in sorted(p for p in var_dir.iterdir() if (p / "deck.yaml").exists()):
        slug = d.name
        if slug in existing:
            print(f"SKIP variant {slug} (exists)")
            continue
        deck = ds.load_deck(d)
        flags = []
        client = deck.get("client", "")
        if client:
            flags += ["--client", client, "--customer", ds.slugify(client)]
        # lineage from manifest.yaml: canonical: canonical/<type>@vN
        man = d / "manifest.yaml"
        if man.exists():
            m = re.search(r"canonical:\s*canonical/([\w-]+)@", man.read_text(encoding="utf-8"))
            if m and m.group(1) in existing:
                flags += ["--derived-from", m.group(1)]
        print(f"PUBLISH variant {slug}")
        _publish(d, *flags)

    # 3. customers with no decks yet (customers/<slug>/customer.yaml)
    cust_dir = ds.REPO_ROOT / "customers"
    if cust_dir.exists():
        have = {c["slug"] for c in sb.select("customers", {"select": "slug"})}
        for c in sorted(p for p in cust_dir.iterdir() if (p / "customer.yaml").exists()):
            if c.name in have:
                print(f"SKIP customer {c.name} (exists)")
                continue
            data = yaml.safe_load((c / "customer.yaml").read_text(encoding="utf-8")) or {}
            logo_object = None
            logo = data.get("logo")
            if logo and (c / logo).exists():
                from supa import content_type_for
                obj = f"customers/{c.name}/{Path(logo).name}"
                sb.upload(obj, (c / logo).read_bytes(), content_type_for(logo))
                logo_object = obj
            sb.insert("customers", {"slug": c.name, "name": data.get("name", c.name),
                                    "notes": data.get("notes", "") or "", "logo_object": logo_object})
            print(f"PUBLISH customer {c.name}")

    # 4. social publish log
    sf = ds.REPO_ROOT / "social" / "_status.json"
    if sf.exists():
        data = json.loads(sf.read_text(encoding="utf-8"))
        rows = [{"slug": k, "status": v.get("status", "draft"),
                 "posted_date": v.get("posted_date", ""), "url": v.get("url", ""),
                 "archived": bool(v.get("archived", False))} for k, v in data.items()]
        if rows:
            sb.upsert("publish_log", rows, on_conflict="slug")
            print(f"MIGRATED publish_log: {len(rows)} rows")

    print("migration done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

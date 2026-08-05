#!/usr/bin/env python
"""
Publish a deck folder to the backend as a self-contained HTML snapshot version
(Deck Studio v3, §4.2). This is the final step of every CLI build: after this,
the backend snapshot IS the deck, and the app edits/versions it from there.

    python tools/publish-deck.py <deckdir> [options]

Options:
  --master                     tag this deck as the master for its type (moves
                               the tag off any previous master of that type)
  --type T                     override the presentation type (default: deck.yaml)
  --client SLUG                client slug (kept for PDF naming + verify)
  --customer SLUG              file under this customer (created from
                               customers/<slug>/ if missing)
  --audience-kind K            general|customer|person|event (default inferred)
  --audience-label L           free-form audience (e.g. "Career fair keynote")
  --derived-from DECK_SLUG     lineage: the deck this was built from
  --derived-from-version N     lineage: which version (default: its current)
  --version-of DECK_SLUG       publish as a NEW VERSION of an existing deck
  --note "..."                 change note for the version
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckstudio as ds
import snapshot as snap
from supa import Supa, content_type_for


def _slugify_slug(s: str) -> str:
    return ds.slugify(s)


def _ensure_customer(sb: Supa, slug: str) -> str:
    rows = sb.select("customers", {"slug": f"eq.{slug}", "select": "id"})
    if rows:
        return rows[0]["id"]
    # create from customers/<slug>/ if present
    name, notes, logo_object = slug, "", None
    cdir = ds.REPO_ROOT / "customers" / slug
    cy = cdir / "customer.yaml"
    if cy.exists():
        data = yaml.safe_load(cy.read_text(encoding="utf-8")) or {}
        name = data.get("name", slug)
        notes = data.get("notes", "") or ""
        logo = data.get("logo")
        if logo and (cdir / logo).exists():
            obj = f"customers/{slug}/{Path(logo).name}"
            sb.upload(obj, (cdir / logo).read_bytes(), content_type_for(logo))
            logo_object = obj
    row = sb.insert("customers", {"slug": slug, "name": name, "notes": notes, "logo_object": logo_object})
    return row[0]["id"]


def _upload_assets(sb: Supa, deck_id: str, assets: dict, existing: dict | None = None):
    """Upload each bundled asset to decks/<id>/assets/ and insert deck_assets.
    existing: {sha256: filename} already on this deck (dedup across versions)."""
    existing = existing or {}
    rows = []
    for fn, a in assets.items():
        if a["sha256"] in existing:
            continue
        obj = f"decks/{deck_id}/assets/{fn}"
        sb.upload(obj, a["bytes"], a["content_type"])
        rows.append({"deck_id": deck_id, "filename": fn, "storage_object": obj,
                     "entitlement": a["entitlement"], "sha256": a["sha256"]})
    if rows:
        sb.upsert("deck_assets", rows, on_conflict="deck_id,filename")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("deckdir")
    ap.add_argument("--master", action="store_true")
    ap.add_argument("--type")
    ap.add_argument("--client", default="")
    ap.add_argument("--customer", default="")
    ap.add_argument("--audience-kind", default="")
    ap.add_argument("--audience-label", default="")
    ap.add_argument("--derived-from", default="")
    ap.add_argument("--derived-from-version", type=int)
    ap.add_argument("--version-of", default="")
    ap.add_argument("--note", default="")
    args = ap.parse_args()

    deckdir = Path(args.deckdir).resolve()
    html, assets, deck = snap.build_snapshot(deckdir)
    sb = Supa()

    deck_type = args.type or deck.get("type", "")
    client = args.client or deck.get("client", "")

    # --- publish as a new VERSION of an existing deck ------------------------
    if args.version_of:
        existing = sb.select("decks", {"slug": f"eq.{args.version_of}",
                                       "select": "id,current_version_n"})
        if not existing:
            raise SystemExit(f"ERROR: no deck with slug '{args.version_of}' to add a version to")
        deck_id = existing[0]["id"]
        n = existing[0]["current_version_n"] + 1
        seen = {a["sha256"]: a["filename"] for a in
                sb.select("deck_assets", {"deck_id": f"eq.{deck_id}", "select": "filename,sha256"})}
        _upload_assets(sb, deck_id, assets, seen)
        pdf_object = _publish_pdf_if_any(sb, deckdir, deck_id, n)
        sb.insert("deck_versions", {"deck_id": deck_id, "n": n, "html": html,
                                    "change_note": args.note or "republished", "author": "cli",
                                    "pdf_object": pdf_object,
                                    "recipe": deck.get("_recipe")})
        sb.update("decks", {"id": deck_id}, {"current_version_n": n})
        print(f"published version {n} of {args.version_of} (deck {deck_id})")
        return 0

    # --- publish a NEW deck --------------------------------------------------
    slug = deckdir.name if deckdir.parent.name != "canonical" else deck_type
    if sb.select("decks", {"slug": f"eq.{slug}", "select": "id"}):
        raise SystemExit(f"ERROR: a deck with slug '{slug}' already exists. "
                         f"Use --version-of {slug} to add a version.")

    customer_id = _ensure_customer(sb, args.customer) if args.customer else None
    audience_kind = args.audience_kind or ("customer" if customer_id else "general")
    derived_id, derived_n = None, None
    if args.derived_from:
        src = sb.select("decks", {"slug": f"eq.{args.derived_from}", "select": "id,current_version_n"})
        if src:
            derived_id = src[0]["id"]
            derived_n = args.derived_from_version or src[0]["current_version_n"]

    if args.master:
        # one master per type: clear any existing master of this type first
        sb.update("decks", {"type": deck_type, "is_master": "true"}, {"is_master": False})

    row = sb.insert("decks", {
        "slug": slug, "title": deck["title"], "type": deck_type,
        "is_master": bool(args.master), "audience_kind": audience_kind,
        "customer_id": customer_id, "audience_label": args.audience_label,
        "client_slug": _slugify_slug(client) if client else "",
        "allowed_entitlements": list(deck.get("allowed_entitlements", ["public"])),
        "current_version_n": 1,
        "derived_from_deck_id": derived_id, "derived_from_version_n": derived_n,
        "created_by": "cli",
    })
    deck_id = row[0]["id"]
    _upload_assets(sb, deck_id, assets)
    pdf_object = _publish_pdf_if_any(sb, deckdir, deck_id, 1)
    sb.insert("deck_versions", {"deck_id": deck_id, "n": 1, "html": html,
                                "change_note": args.note or "published from CLI", "author": "cli",
                                "pdf_object": pdf_object,
                                "recipe": deck.get("_recipe")})
    print(f"published deck '{slug}' ({deck_id}) v1"
          + (" [master]" if args.master else ""))
    return 0


def _publish_pdf_if_any(sb: Supa, deckdir: Path, deck_id: str, n: int) -> str | None:
    """If a PDF sits next to the deck, upload it and return its object path.
    (Migration path; fresh publishes usually build the PDF later in the app.)"""
    pdfs = list(deckdir.glob("*.pdf"))
    if not pdfs:
        return None
    obj = f"decks/{deck_id}/pdf/v{n}_{pdfs[0].name}"
    sb.upload(obj, pdfs[0].read_bytes(), "application/pdf")
    return obj


if __name__ == "__main__":
    raise SystemExit(main())

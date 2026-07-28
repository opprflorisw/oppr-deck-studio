#!/usr/bin/env python3
"""Generate an on-brand image with the Gemini API and file it in the image library.

Roadmap item from CLAUDE.md, built to the research in
`.scratch/deck-app/research/07-gemini-imagegen.md`:

  * model      `gemini-3.1-flash-image` (Nano Banana 2) by default, 2K
  * API        the Interactions API (`client.interactions.create`), not legacy
               `generateContent`; never Imagen 4 (shut down 2026-08-17)
  * key        read from `.env` (gitignored) as GEMINI_API_KEY, never from code
  * brand      a frozen style block is prepended to every prompt, and up to 14
               style-reference images may be passed to hold the house look
  * provenance every generated file gets a full entry in brand/img/library.json
               with `source: generated`, the exact prompt, model, style refs and
               date, so any image can be reproduced or re-cut at another ratio

Generated images are illustrations. They are never presented as real customer or
reference photography (they also carry an invisible SynthID watermark that
Google's consumer tools can verify), so they are written with
`type: illustration` and always `entitlement: public`.

Usage
-----
  python tools/generate-image.py \
      --id gen/plastics-pellets-extrudate \
      --prompt "Close-up of translucent polymer pellets ..." \
      --description "Plastic pellets and warm extrudate, no people." \
      --tags plastics,material,extrusion \
      --use "industry band for the plastics case" \
      --aspect 16:9 --size 2K

  python tools/generate-image.py ... --dry-run     # show the final prompt only
"""

from __future__ import annotations

import argparse
import base64
import datetime as _dt
import json
import mimetypes
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "brand" / "img" / "library.json"
IMG_DIR = ROOT / "brand" / "img"

DEFAULT_MODEL = "gemini-3.1-flash-image"
ALLOWED_ASPECTS = {
    "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
}
ALLOWED_SIZES = {"0.5K", "1K", "2K", "4K"}

# Models that are retired or deprecated per the research note; refuse them.
FORBIDDEN_MODELS = {
    "imagen-4.0-generate-001",
    "imagen-4.0-ultra-generate-001",
    "imagen-4.0-fast-generate-001",
    "gemini-2.5-flash-image",
}

# Nothing generated may reference named-customer material: social output is
# public and the manifest's entitlement gate must stay meaningful.
FORBIDDEN_TERMS = ("holliday", "venator", "mutares")

# The frozen house style. Prepended verbatim to every prompt so the whole
# generated set stays recognisably Oppr. Change it deliberately, not per image.
BRAND_STYLE = (
    "Editorial industrial photography for a European manufacturing software brand. "
    "Warm, restrained, documentary; natural light, no studio gloss, no lens flare. "
    "Muted palette built on warm paper tones and desaturated industrial greys, with "
    "terracotta and deep teal reading only as incidental accents in the scene. "
    "Shallow depth of field, honest materials and real wear. "
    "Absolutely no text, no lettering, no numbers, no logos, no signage, no watermarks. "
    "No brand marks of any kind and no recognisable company identity. "
    "Composed with calm negative space so the frame can be cropped to a wide band."
)


# ---------------------------------------------------------------- environment


def load_env() -> None:
    """Load KEY=VALUE pairs from the gitignored .env into os.environ.

    Existing environment variables win, so a shell export can override .env.
    """
    env_file = ROOT / ".env"
    if not env_file.exists():
        sys.exit(
            "ERROR: no .env found.\n"
            "  copy .env.example .env   and fill in GEMINI_API_KEY\n"
            "  (image models need a billed Tier-1 key; there is no free tier)"
        )
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value
    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("ERROR: GEMINI_API_KEY is empty in .env.")


# ---------------------------------------------------------------- generation


def build_prompt(subject: str, extra_style: str | None) -> str:
    parts = [BRAND_STYLE]
    if extra_style:
        parts.append(extra_style.strip())
    parts.append(subject.strip())
    return "\n\n".join(parts)


def style_ref_parts(paths: list[str]) -> list[dict]:
    """Encode style-reference images as image content parts."""
    parts: list[dict] = []
    for p in paths:
        path = Path(p)
        if not path.is_absolute():
            path = ROOT / p
        if not path.exists():
            sys.exit(f"ERROR: style reference not found: {path}")
        mime = mimetypes.guess_type(path.name)[0] or "image/png"
        parts.append({
            "type": "image",
            "mime_type": mime,
            "data": base64.b64encode(path.read_bytes()).decode("ascii"),
        })
    return parts


def first_image(interaction) -> tuple[bytes, str]:
    """Walk the Interaction response and return the first image (bytes, mime).

    The response carries an `outputs` list whose items hold content parts; the
    shape is still marked experimental in the SDK, so search defensively rather
    than assuming one layout.
    """
    direct = getattr(interaction, "output_image", None)
    if direct is not None and getattr(direct, "data", None):
        return base64.b64decode(direct.data), getattr(direct, "mime_type", "image/png")

    seen: list[object] = []

    def walk(node, depth: int = 0):
        if depth > 6 or node is None:
            return None
        if isinstance(node, (list, tuple)):
            for item in node:
                found = walk(item, depth + 1)
                if found:
                    return found
            return None
        data = getattr(node, "data", None)
        kind = getattr(node, "type", None)
        if data and (kind == "image" or getattr(node, "mime_type", "").startswith("image/")):
            return node
        if node in seen:
            return None
        seen.append(node)
        for attr in ("output_image", "outputs", "steps", "content", "contents", "parts", "output"):
            child = getattr(node, attr, None)
            if child is not None:
                found = walk(child, depth + 1)
                if found:
                    return found
        return None

    node = walk(interaction)
    if node is None:
        sys.exit(
            "ERROR: the response contained no image.\n"
            "  This is usually a safety block or a text-only reply.\n"
            f"  status={getattr(interaction, 'status', '?')}"
        )
    return base64.b64decode(node.data), getattr(node, "mime_type", "image/png")


# ------------------------------------------------------------------ manifest


def upsert_manifest(entry: dict) -> str:
    """Insert or replace the manifest entry for entry['file']. Returns action."""
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))

    fields = data.setdefault("_schema", {}).setdefault("fields", {})
    fields.setdefault(
        "source",
        "generated  (AI-made illustration; absent means a real photo/diagram/screenshot)",
    )
    fields.setdefault(
        "generator",
        "for source=generated: model + provider used, so the image can be reproduced",
    )
    fields.setdefault("prompt", "for source=generated: the exact final prompt sent")
    fields.setdefault("style_refs", "for source=generated: style-reference images passed")
    fields.setdefault("synthid", "for source=generated: true, the file carries Google's SynthID watermark")

    images = data["images"]
    for i, existing in enumerate(images):
        if existing.get("file") == entry["file"]:
            images[i] = entry
            action = "replaced"
            break
    else:
        images.append(entry)
        action = "added"

    MANIFEST.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return action


# ---------------------------------------------------------------------- main


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Generate an on-brand image with Gemini and file it in brand/img/library.json."
    )
    ap.add_argument("--id", required=True,
                    help="path under brand/img/ without extension, e.g. gen/plastics-pellets")
    ap.add_argument("--prompt", required=True, help="the subject of the image")
    ap.add_argument("--description", help="one sentence of meaning (manifest + alt text)")
    ap.add_argument("--tags", default="", help="comma-separated tags")
    ap.add_argument("--use", action="append", default=[],
                    help="a suggested_use phrase; repeatable")
    ap.add_argument("--style", help="extra style guidance appended to the frozen brand block")
    ap.add_argument("--style-ref", action="append", default=[],
                    help="path to a style-reference image; repeatable (max 14)")
    ap.add_argument("--aspect", default="16:9", help=f"one of {sorted(ALLOWED_ASPECTS)}")
    ap.add_argument("--size", default="2K", help=f"one of {sorted(ALLOWED_SIZES)}")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--seed", type=int, help="optional seed for reproducibility")
    ap.add_argument("--orientation", help="landscape | portrait | square (default: from aspect)")
    ap.add_argument("--no-manifest", action="store_true", help="write the file but do not touch library.json")
    ap.add_argument("--dry-run", action="store_true", help="print the final prompt and exit")
    args = ap.parse_args()

    if args.aspect not in ALLOWED_ASPECTS:
        sys.exit(f"ERROR: --aspect must be one of {sorted(ALLOWED_ASPECTS)}")
    if args.size not in ALLOWED_SIZES:
        sys.exit(f"ERROR: --size must be one of {sorted(ALLOWED_SIZES)}")
    if args.model in FORBIDDEN_MODELS:
        sys.exit(f"ERROR: {args.model} is deprecated or retired; use {DEFAULT_MODEL}.")
    if len(args.style_ref) > 14:
        sys.exit("ERROR: at most 14 style-reference images per request.")

    blob = f"{args.id} {args.prompt} {args.description or ''}".lower()
    for term in FORBIDDEN_TERMS:
        if term in blob:
            sys.exit(
                f"ERROR: '{term}' is named-customer material and must never be generated.\n"
                "  Generated images are public-entitlement illustrations only."
            )

    prompt = build_prompt(args.prompt, args.style)

    if args.dry_run:
        print(prompt)
        return

    load_env()
    from google import genai  # imported after the key is in the environment

    client = genai.Client()
    parts: list[dict] = [{"type": "text", "text": prompt}]
    parts.extend(style_ref_parts(args.style_ref))

    image_config: dict = {"aspect_ratio": args.aspect, "image_size": args.size}
    generation_config: dict = {"image_config": image_config}
    if args.seed is not None:
        generation_config["seed"] = args.seed

    print(f"generating {args.id}  [{args.model} · {args.aspect} · {args.size}]", flush=True)
    interaction = client.interactions.create(
        model=args.model,
        input=parts,
        generation_config=generation_config,
        response_modalities=["image"],
    )

    raw, mime = first_image(interaction)
    ext = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(mime, ".png")
    out = IMG_DIR / (args.id + ext)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(raw)
    rel = out.relative_to(IMG_DIR).as_posix()
    print(f"wrote brand/img/{rel}  ({len(raw) / 1024:.0f} KB)")

    if args.no_manifest:
        return

    orientation = args.orientation
    if not orientation:
        w, h = (float(x) for x in args.aspect.split(":"))
        orientation = "square" if w == h else ("landscape" if w > h else "portrait")

    entry = {
        "file": rel,
        "type": "illustration",
        "orientation": orientation,
        "entitlement": "public",
        "description": args.description or args.prompt.strip(),
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
        "suggested_use": args.use,
        "source": "generated",
        "generator": {"model": args.model, "provider": "gemini-api"},
        "prompt": prompt,
        "style_refs": args.style_ref,
        "aspect_ratio": args.aspect,
        "resolution": args.size,
        "generated_on": _dt.date.today().isoformat(),
        "synthid": True,
    }
    if args.seed is not None:
        entry["seed"] = args.seed

    print(f"manifest entry {upsert_manifest(entry)}: {rel}")


if __name__ == "__main__":
    main()

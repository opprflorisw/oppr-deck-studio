"""
Phase 1 migration (one-time): carve the Product Showcase into a slide library.

Reads the existing hand-built decks/2026-07-21_product-showcase/index.html,
splits its 20 <section> blocks, replaces the three deck-level strings + the
asset prefix with {{variables}}, and writes:
  - library/slides/<id>/slide.html   (portable fragment)
  - library/slides/<id>/meta.yaml    (role, tags, entitlement, images, vars)
  - decks/canonical/product-showcase/deck.yaml   (all 20)
  - decks/canonical/management-outlook/deck.yaml  (12-slide subset)

Idempotent: safe to re-run; it overwrites the library + deck.yaml files.
Run from repo root:  python .scratch/deck-tool/migrate_phase1.py
"""
from pathlib import Path
import re
import sys

import yaml

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "decks" / "2026-07-21_product-showcase" / "index.html"

# Deck-level strings in the SOURCE (Product Showcase) -> placeholder
REPLACEMENTS = [
    ("Operator Intelligence &middot; Product Showcase &middot; July 2026", "{{deck_footer}}"),
    ('data-total="20"', 'data-total="{{total}}"'),
    ("Product Showcase &nbsp;&middot;&nbsp; July 2026 &nbsp;&middot;&nbsp; Confidential &nbsp;&middot;&nbsp; oppr.ai", "{{cover_meta}}"),
    ("../../brand/", "{{asset}}brand/"),
]

# id · role · tags · one-line note.  Order == the 20 sections in the source.
SLIDES = [
    ("cover", "cover", ["opening", "hero", "cover"],
     "Hero cover with unified-timeline treatment. No footer."),
    ("idea-one-sentence", "idea", ["opening", "message", "idea", "attero-style"],
     "One-sentence lede + three capture/connect/execute cards."),
    ("why-now", "why-now", ["context", "problem", "narrative"],
     "Cause-and-effect-are-lost narrative in three rows."),
    ("recognize-problems", "problem-recognition", ["problem", "recognition", "pain-points"],
     "Five familiar problems, summarised to recurring/knowledge/data."),
    ("when-time-matters", "when-time-matters", ["pressure", "ebitda", "urgency", "management"],
     "Four reasons to move now, icon cards. Management register."),
    ("platform-cce", "platform", ["product", "capture-connect-execute", "framework"],
     "Capture/Connect/Execute legend + the platform-loop image."),
    ("product-flow-setup", "product-flow", ["product", "screenshots", "workflow", "setup"],
     "Floorplan -> log builder -> take a round. Product screenshots."),
    ("product-flow-insight", "product-flow", ["product", "screenshots", "workflow", "insight"],
     "Capture -> analyze -> execute to SOP. Product screenshots."),
    ("outcomes-reference", "outcomes", ["outcomes", "reference-stats", "proof"],
     "Four outcomes + the verified reference-case stat grid."),
    ("evidence-quotes", "evidence", ["quotes", "testimonial", "credibility"],
     "Three anonymised operations-leader quotes with 'what we did'."),
    ("kpi-payback", "kpi", ["kpi", "payback", "roi", "commercial"],
     "One improvement's worth x multiply. Conservative, illustrative."),
    ("engagement-ladder", "engagement", ["engagement", "pricing", "steps", "ladder"],
     "Analyze/Prove/Scale rungs + what-we-need-from-you strip."),
    ("step1-analyze", "step-detail", ["step", "analyze", "commercial"],
     "Step 1 detail. Colored stepband sb1."),
    ("step2-prove", "step-detail", ["step", "prove", "10-week-proof", "commercial"],
     "Step 2 detail. Colored stepband sb2."),
    ("step3-scale", "step-detail", ["step", "scale", "annual", "commercial"],
     "Step 3 detail: convert / extend / wind down. Stepband sb3."),
    ("operator-acceptance", "acceptance", ["adoption", "operators", "change-management"],
     "Built-with-operators, four icon cards. Adoption is the game."),
    ("running-projects", "running-projects", ["references", "projects", "industries", "nda"],
     "Three current engagements by process type (NL/FR), no names."),
    ("who-is-oppr", "who-is-oppr", ["company", "team", "credibility", "founder"],
     "Company facts + three principles + founder line."),
    ("cta-next-step", "cta", ["cta", "next-step", "closing", "timeline"],
     "Next-step timeline (1-2-3) + contact block. Ink slide, no footer."),
    ("back-cover", "closer", ["closing", "contact", "cover"],
     "Back cover / contact. Ink slide, no footer."),
]

# The Management Outlook 12-slide cut (subset of the showcase, in its order)
OUTLOOK_ORDER = [
    "cover", "when-time-matters", "why-now", "platform-cce", "outcomes-reference",
    "evidence-quotes", "kpi-payback", "engagement-ladder", "operator-acceptance",
    "who-is-oppr", "cta-next-step", "back-cover",
]

IMG_RE = re.compile(r"\{\{asset\}\}(brand/img/[^\"']+)")
PLACEHOLDER_RE = re.compile(r"\{\{\s*([\w\-]+)\s*\}\}")
SECTION_RE = re.compile(r"<section\b.*?</section>", re.DOTALL)


def h2_title(section: str) -> str:
    m = re.search(r"<h[12][^>]*>(.*?)</h[12]>", section, re.DOTALL)
    if not m:
        return ""
    text = re.sub(r"<[^>]+>", "", m.group(1))
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main() -> None:
    html = SRC.read_text(encoding="utf-8")
    secs = SECTION_RE.findall(html)
    if len(secs) != len(SLIDES):
        sys.exit(f"Expected {len(SLIDES)} sections, found {len(secs)} in {SRC}")

    slides_dir = ROOT / "library" / "slides"
    for (slide_id, role, tags, note), section in zip(SLIDES, secs):
        frag = section
        for needle, repl in REPLACEMENTS:
            frag = frag.replace(needle, repl)

        images = sorted(set(IMG_RE.findall(frag)))
        variables = sorted(set(PLACEHOLDER_RE.findall(frag)))

        d = slides_dir / slide_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "slide.html").write_text(frag + "\n", encoding="utf-8")

        meta = {
            "id": slide_id,
            "role": role,
            "title": h2_title(section),
            "css": ["deck.css", "showcase.css"],
            "entitlement": "public",
            "language": "en",
            "tags": tags,
            "images": images,
            "variables": variables,
            "used_in": ["product-showcase"] + (["management-outlook"] if slide_id in OUTLOOK_ORDER else []),
            "notes": note,
        }
        (d / "meta.yaml").write_text(
            yaml.safe_dump(meta, sort_keys=False, allow_unicode=True, width=100),
            encoding="utf-8",
        )

    # deck.yaml compositions
    def write_deck(path: Path, title: str, dtype: str, footer: str, cover_meta: str, order: list):
        path.mkdir(parents=True, exist_ok=True)
        data = {
            "title": title,
            "type": dtype,
            "vars": {"deck_footer": footer, "cover_meta": cover_meta},
            "slides": order,
        }
        # keep slides as a clean block list
        text = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=120)
        path.joinpath("deck.yaml").write_text(text, encoding="utf-8")

    all_ids = [s[0] for s in SLIDES]
    write_deck(
        ROOT / "decks" / "canonical" / "product-showcase",
        "Oppr · Operator Intelligence · Product Showcase",
        "product-showcase",
        "Operator Intelligence &middot; Product Showcase &middot; July 2026",
        "Product Showcase &nbsp;&middot;&nbsp; July 2026 &nbsp;&middot;&nbsp; Confidential &nbsp;&middot;&nbsp; oppr.ai",
        all_ids,
    )
    write_deck(
        ROOT / "decks" / "canonical" / "management-outlook",
        "Oppr · Operator Intelligence · Management Outlook",
        "management-outlook",
        "Operator Intelligence &middot; Management Outlook &middot; July 2026",
        "Management Outlook &nbsp;&middot;&nbsp; July 2026 &nbsp;&middot;&nbsp; Confidential &nbsp;&middot;&nbsp; oppr.ai",
        OUTLOOK_ORDER,
    )

    print(f"Extracted {len(SLIDES)} slides -> {slides_dir}")
    print("Wrote deck.yaml for product-showcase (20) and management-outlook (12)")


if __name__ == "__main__":
    main()

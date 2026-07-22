# Oppr design philosophy

How an Oppr slide and deck is meant to look and read. This is the "why" behind
`templates/deck.css` and the `library/design-system/` specimens; `brand/BRAND.md`
holds the exact tokens and canonical language.

## One idea per slide

A slide makes a single point. If it needs two, it is two slides. The title says
the point in a full sentence ("What one improvement is worth. Then multiply it."),
not a topic label ("ROI"). Body copy supports that one point and stops.

## The palette carries meaning

- **Terracotta** (`--accent #a65032`) is the human voice — operators, judgment,
  the signal machines miss. Use it for the one thing that matters on a slide.
- **Teal** (`--machine #3e6874`) is the machine voice — data, sensors, systems.
- **Green** (`--verified #55745e`) marks a verified result, never a hope.
- **Warm paper / near-black ink** is the ground. Restful, print-first, not a
  glowing dashboard.

Spend the accent in one place per slide; let everything else stay quiet.

## Type and space

Archivo for everything structural, JetBrains Mono for eyebrows, data and labels.
Big, confident headings; generous space; never a wall of text. The reader should
get the point from the title and the one number, and read the rest only if they
want it.

## Structure honestly

Footer discipline is by role: content slides carry the wordmark + deck meta +
page counter; cover, closer and cta slides carry none. Numbered markers, steps
and timelines are used only when the content really is a sequence. A section with
one slide is a gap, not a design.

## Tone

Short, declarative, concrete, no hype. European number formatting (€ 25.000 ·
0,5%). No em dashes (en dashes for numeric ranges are fine). Payback claims are
labelled illustrative and deliberately conservative. Capture → Connect → Execute
is the story; Analyze → Prove → Scale is the path. Never tell the LOGS/IDA/DOCS
internals as the narrative.

## Composition rule

A new slide or social page may only use documented design-system blocks
(`library/design-system/`, `templates/*.css`). Need a new pattern? Add its
specimen and put its CSS in the shared stylesheet first, then use it. This is
what keeps every artifact on-brand and portable.

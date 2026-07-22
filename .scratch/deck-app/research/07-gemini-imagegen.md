# 07 — Gemini image generation: capabilities & fit

Research date: 2026-07-22. Docs-only (no API key used). Primary sources are the
official Google AI developer docs (ai.google.dev), fetched on the research date;
third-party sources are marked as such and used only for context.

---

## 1. Current models (Gemini API, plain API key / Google AI Studio tier)

Source: https://ai.google.dev/gemini-api/docs/image-generation (fetched 2026-07-22)
and https://ai.google.dev/gemini-api/docs/imagen (fetched 2026-07-22).

The "Nano Banana" lineage (Gemini native image generation) is now the whole
story; the Imagen line is on its way out on this tier.

| Model | ID | Best at | Notes |
|---|---|---|---|
| Nano Banana 2 | `gemini-3.1-flash-image` | The generalist workhorse: quality + speed, strong text rendering, editing, up to 14 reference images, Google Search grounding, video-to-image, thinking mode | Resolutions 0.5K/1K/2K/4K. Recommended default. |
| Nano Banana Pro | `gemini-3-pro-image` | Premium reasoning-driven model: complex graphic design, high-fidelity mockups, data visualizations, most accurate (multilingual) text rendering, brand consistency, interleaved text+image | GA (not preview). 1K/2K/4K. Slower + priciest. |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | Fastest/cheapest, high-volume pipelines | 1K only; no Search grounding; object references only (up to 14 object images). |
| Nano Banana (legacy) | `gemini-2.5-flash-image` | — | Deprecated; docs recommend migrating to the 3.x models. |
| Imagen 4 | `imagen-4.0-generate-001` / `-ultra-` / `-fast-` | Dedicated text-to-image, photorealistic photography styles; text limited (≤ ~25 chars advised) | **Deprecated: shuts down 2026-08-17** (per https://ai.google.dev/gemini-api/docs/imagen). Do not build on it. |

Photorealism vs illustration: none of the Nano Banana models is pigeonholed;
Pro is documented as strongest for design/illustration/text-heavy composites,
Flash (NB2) is the balanced default for both photoreal and illustrative work.
Imagen 4 was the photorealism specialist but is being retired.

### API surface (changed in 2026)

The **Interactions API** (`POST /v1beta/interactions`) reached GA on
2026-06-22 and is now the primary interface; `generateContent` still works but
is legacy and receives no new features.
Sources: https://ai.google.dev/gemini-api/docs/interactions-overview ·
https://blog.google/innovation-and-ai/technology/developers-tools/interactions-api-general-availability/ (2026-06-22).

### Minimal usage, key from `GEMINI_API_KEY`

The `google-genai` Python SDK picks up `GEMINI_API_KEY` from the environment
automatically (no key in code). Verbatim from the image-generation docs
(fetched 2026-07-22):

```python
# pip install google-genai   (key read from GEMINI_API_KEY env var)
from google import genai
import base64

client = genai.Client()
interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input="Create a picture of a nano banana dish in a fancy restaurant",
)
with open("generated_image.png", "wb") as f:
    f.write(base64.b64decode(interaction.output_image.data))
```

```bash
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": [ {"type": "text", "text": "your prompt"} ]
  }'
```

Source: https://ai.google.dev/gemini-api/docs/image-generation (2026-07-22).

---

## 2. Controls

Source: https://ai.google.dev/gemini-api/docs/image-generation (fetched 2026-07-22).

**Aspect ratios.** `gemini-3.1-flash-image` and `gemini-3.1-flash-lite-image`
support: 1:1, 3:2, 2:3, 3:4, 4:3, **4:5**, 5:4, 9:16, **16:9**, 21:9.
Both ratios Oppr needs (16:9 slides, 4:5 LinkedIn carousel) are natively
supported — no cropping needed. The model page for `gemini-3-pro-image` does
not list ratios separately; the image-generation page is the reference for its
set (1K/2K/4K sizes confirmed).

**Resolution.** Requested via the config alongside aspect ratio
(`aspect_ratio`, `image_size` fields): NB2 = 0.5K/1K/2K/4K; Pro = 1K/2K/4K;
Lite = 1K only. 2K is comfortably sufficient for a 13.333×7.5 in slide at
~150 dpi; 4K covers print-quality needs.

**Style steering / brand consistency.**
- Up to **14 reference images** per request on NB2/Pro, with distinct
  reference types: objects, characters (consistency across generations), and
  **style references** — the documented mechanism for holding a house style.
- Character/style consistency across generations is an advertised capability
  (dedicated reference images), i.e. a brand look (warm paper background,
  terracotta accents, industrial subject matter) can be anchored by reusing
  the same 2–3 style-reference images plus a fixed style prompt block.
- No user-settable seed is documented for the Interactions image API;
  consistency is achieved via references + detailed prompts, not seeds.

**Text-in-image.** Documented strength: "legible, stylized text for
infographics, menus, diagrams, and marketing assets"; Nano Banana Pro is the
top tier for accurate (incl. multilingual) text rendering. (Contrast: Imagen 4
advised ≤ 25 characters.)

**Editing / variation.** Same `interactions.create()` endpoint: pass the
existing image + a text instruction. Documented operations: image-to-image
transformation, element addition/removal, style transfer, inpainting via
semantic masking (describe the region in words; no mask files needed).

---

## 3. Pricing, free tier, rate limits (standard API-key tier)

Source: https://ai.google.dev/gemini-api/docs/pricing (fetched 2026-07-22).
Images are billed as output tokens; approximate per-image costs as published:

| Model | Per image (standard) | Notes |
|---|---|---|
| `gemini-3.1-flash-image` (NB2) | ~$0.045 (0.5K) · **~$0.067 (1K)** · ~$0.101 (2K) · ~$0.151 (4K) | Input $0.50/M tokens; output $60/M image tokens. Batch tier ≈ half price. |
| `gemini-3.1-flash-lite-image` | ~$0.034 (1K) | Input $0.25/M; output $30/M. Batch ≈ half. |
| `gemini-3-pro-image` (Pro) | ~$0.134 (1K/2K) · ~$0.24 (4K) | Input $2.00/M; output $120/M. Batch/Flex ≈ $0.067–0.12. Thinking (interim) images not charged separately. |
| `gemini-2.5-flash-image` (legacy) | ~$0.039 | Deprecated. |
| Imagen 4 Fast / Standard / Ultra | $0.02 / $0.04 / $0.06 | Deprecated, gone 2026-08-17. |

**Free tier:** the pricing page marks the 3.x image models "Free tier: not
available" — image generation requires a billing account (Tier 1+). Paid-tier
side benefit: prompts/responses are not used to improve Google products
(https://ai.google.dev/gemini-api/docs/billing, fetched 2026-07-22).

**Rate limits:** Google no longer publishes fixed per-model tables; limits are
per-project and shown live in AI Studio (https://aistudio.google.com/rate-limit).
Image models are additionally metered in **IPM (images per minute)**. Tiers:
Free → Tier 1 (billing linked) → Tier 2 ($100 spent + 3 days) → Tier 3
($1,000 spent + 30 days).
Source: https://ai.google.dev/gemini-api/docs/rate-limits (fetched 2026-07-22).

---

## 4. Licensing, commercial use, indemnification, SynthID

- **Ownership / commercial use.** Gemini API Additional Terms of Service
  (last updated 2026-04-28): Google "won't claim ownership" over generated
  content; you are responsible for your use of it; commercial/business use is
  contemplated (Paid Services are "for developers building with Google AI
  models for professional or business purposes"). No prohibition on using
  generated images in commercial sales/marketing material. Caveat: Google may
  generate identical/similar output for others — generated images are not
  exclusive to Oppr. Source: https://ai.google.dev/gemini-api/terms
  (fetched 2026-07-22).
- **Data use.** Unpaid tier: Google may use prompts/outputs to improve
  products (human review possible). Paid tier: not used for improvement.
  Same source.
- **Indemnification.** The Gemini API developer terms contain **no
  generated-output indemnity**, and the billing docs do not list one as a
  paid-tier benefit. Google's "Generative AI Indemnified Services" list
  (last updated 2026-01-20) covers Google Cloud / Vertex (Gemini Enterprise
  Agent Platform) offerings, not the AI Studio API-key tier. If Oppr ever
  needs IP indemnity on generated images, that is a reason to move the image
  pipeline to Vertex. Sources: https://ai.google.dev/gemini-api/terms ·
  https://cloud.google.com/terms/generative-ai-indemnified-services.
- **SynthID.** All images generated through the Gemini API carry an invisible
  SynthID watermark (non-removable, survives normal edits). Verification is
  consumer-visible: the Gemini app can check any uploaded image for a SynthID
  mark (rolled out broadly; Google reported 50M verifications by May 2026,
  expanding to Search/Chrome). Nano Banana Pro images additionally get C2PA
  Content Credentials on some surfaces (Gemini app, Vertex, Google Ads).
  Practical implication: images in Oppr decks are detectable as AI-generated;
  fine for illustrations, avoid passing them off as real customer photos.
  Sources: https://ai.google.dev/gemini-api/docs/image-generation ·
  https://blog.google/innovation-and-ai/products/ai-image-verification-gemini-app/ (2026-05) ·
  https://support.google.com/gemini/answer/16722517.

---

## 5. Pipeline fit: provenance metadata for generated images

There is no official Google schema for a private manifest, but the industry
provenance standards (C2PA Content Credentials; IPTC `DigitalSourceType =
trainedAlgorithmicMedia`) converge on recording: tool/model, creation date,
and how the asset was made. Recommended fields for each generated entry in
`brand/img/library.json`, mirroring that plus what regeneration needs:

```json
{
  "file": "gen/factory-floor-terracotta-01.png",
  "source": "generated",
  "generator": { "model": "gemini-3.1-flash-image", "provider": "gemini-api" },
  "prompt": "…full final prompt text…",
  "style_refs": ["gen/style-ref-warm-paper.png"],
  "aspect_ratio": "16:9",
  "resolution": "2K",
  "generated_on": "2026-07-22",
  "synthid": true,
  "description": "…meaning-based description as for any library image…",
  "tags": ["illustration", "factory", "terracotta"],
  "entitlement": "public"
}
```

Rationale: `prompt` + `model` + `style_refs` make every image reproducible and
variable (regenerate at 4:5 for a carousel from the same recipe); `source:
generated` lets verify-deck/asset tooling treat AI images differently from
customer photos; `synthid: true` records that the file is verifiable as
AI-made; entitlement stays `public` (no customer material is ever generated).
C2PA/IPTC context: https://c2pa.org · https://www.iptc.org/std/photometadata/documentation/ ·
Nano Banana Pro C2PA note in the SynthID sources above.

---

## Implications for Oppr

- **Default model: `gemini-3.1-flash-image` (Nano Banana 2)** at 2K. It covers
  both needed aspect ratios natively (16:9, 4:5), does strong text rendering,
  takes style-reference images for the warm-paper/terracotta look, and edits
  existing images through the same endpoint. Escalate to `gemini-3-pro-image`
  only for text-heavy composite graphics (diagrams, infographic-style slides).
- **Expected cost: ~$0.07–0.10 per NB2 image (1K–2K), ~$0.13 for Pro.** A
  full deck's illustration set (say 15 images incl. retries ×3) is a few
  euros. Batch tier halves it if generation is ever scripted in bulk.
  Requires a billed API key (no free tier for image models); Tier 1 is enough.
- **Brand consistency workflow:** keep 2–3 canonical style-reference images in
  `brand/img/` plus a frozen style prompt block (warm paper background,
  terracotta accent palette, industrial subject matter, no text unless asked);
  pass both on every generation. No seeds exist; references are the mechanism.
- **Library entry:** generated images enter `brand/img/library.json` with
  `source: generated`, full prompt, model ID, date, style refs used, and
  normal description/tags/entitlement (schema in §5), so the manifest stays
  the single retrieval-by-meaning surface and every image is regenerable.
- **Legal posture:** commercial use is fine and Google claims no ownership,
  but there is no IP indemnity on the API-key tier and every image carries a
  SynthID watermark. Use generated images as illustrations, never as implied
  real customer/reference photography.
- **Do not touch Imagen 4** (shutdown 2026-08-17) or `gemini-2.5-flash-image`
  (deprecated). Build on the Interactions API (`/v1beta/interactions`), not
  legacy `generateContent`.

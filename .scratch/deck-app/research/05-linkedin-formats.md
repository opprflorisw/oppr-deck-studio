# Research 05 — LinkedIn carousel & post format facts

Resolved: 2026-07-22. Sources: official LinkedIn Help pages plus recent (2025–2026)
marketing/analytics sources; publication dates noted per fact. Where sources
conflict, the conflict is flagged and a safest value given.

---

## 1. Carousel = document post: file specs and readability

### Accepted file types (official)
- **PPT, PPTX, DOC, DOCX, and PDF.** In practice everyone ships PDF (deterministic
  rendering; Office files get re-rendered server-side).
  Source: LinkedIn Help, "Upload and share documents on LinkedIn" —
  https://www.linkedin.com/help/linkedin/answer/a518909 (official, current as of Jul 2026).
- Documents **cannot be edited after posting** (only title/description); replacing
  the file means delete + repost. Only **one document per post**. Videos/animations
  inside the file render as **static images**. Multi-layer PDFs must be **flattened**;
  pages must be **uniform size**. Viewers can **download the PDF** from full-screen view.
  Sources: same Help page + "Document uploads on LinkedIn FAQ" —
  https://www.linkedin.com/help/linkedin/answer/a523054 (official).

### Hard limits (official)
- **Max file size: 100 MB. Max pages: 300.**
  Source: https://www.linkedin.com/help/linkedin/answer/a518909 (official).
- Practical guidance: keep the PDF **under 5–10 MB** so it renders before the user
  scrolls past on mobile data.
  Sources: TryMyPost PDF carousel design guide (Apr 7, 2026)
  https://www.trymypost.com/blog/linkedin-pdf-carousel-design-guide-2026 ;
  Contentdrips carousel size guide (Mar 2026)
  https://contentdrips.com/blog/2026/03/ultimate-guide-to-linkedin-carousel-sizes-for-2026/

### Aspect ratio: 1:1 vs 4:5
- LinkedIn accepts any uniform page size; the feed renders the document at the
  page's own aspect ratio. Options in circulation: 1080×1080 (1:1),
  1080×1350 (4:5 portrait), 1920×1080 (16:9).
- **Current best practice (2026) is 4:5 portrait, 1080×1350 px.** Rationale given by
  multiple 2026 guides: taller pages occupy more feed height on mobile (~65% of
  LinkedIn traffic), which raises dwell time, LinkedIn's strongest distribution
  signal. 1:1 remains a safe, slightly more conservative fallback (renders
  identically on desktop and mobile with no cropping risk); 16:9 is explicitly
  discouraged for feed carousels (small on mobile).
  Sources: TryMyPost design guide (Apr 2026, above); Contentdrips (Mar 2026, above);
  Postiv AI carousel size guide (2026) https://postiv.ai/blog/linkedin-carousel-size ;
  Oktopost carousel best practices (2026)
  https://www.oktopost.com/blog/linkedin-carousel-pdf-best-practices/
- **Conflict note:** older (2023–2024) guidance defaulted to 1:1 1080×1080; the
  2026 sources have converged on 4:5. Safest value going forward: **1080×1350 (4:5)**.

### Page count sweet spot
- Official max is 300, but 2026 engagement data converges on **7–12 pages**
  (TryMyPost: 7–10; Contentdrips/Oktopost: 8–12; AuthoredUp format data: best
  performers 8–10 slides). Below ~3 pages the upload behaves like a plain
  attachment; above ~10–12 completion rates fall.
  Sources: TryMyPost (Apr 2026); Oktopost (2026);
  AuthoredUp best-performing content (2026)
  https://authoredup.com/blog/best-performing-content-on-linkedin

### Minimum font size / text density at feed size
- The feed shows the page at roughly phone width (~375–430 px), so a 1080 px canvas
  is displayed at ~1/3 scale. Consensus floors on a 1080-wide canvas:
  - **Body text: ≥ 32 px** (range across sources 30–40 px; "going below 32px for
    body text is the most common technical error").
  - **Headlines: 60–80 px.**
  Sources: UseVisuals aspect-ratio guide (2026)
  https://usevisuals.com/blog/ideal-linkedin-carousel-aspect-ratio-for-mobile ;
  Lumeo carousel size guide (2026) https://www.lumeo.me/en/blog/linkedin-carousel-size-2026 ;
  CarouselMaker.co (2026) https://carouselmaker.co/en/blog/linkedin-carousel-size-dimensions-guide
- **Conflict note:** TryMyPost (Apr 2026) says minimum 24 px; most other 2026
  sources say 30–40 px. Safest floor: **32 px body / 60 px headline on 1080 px canvas**.
- Text density: one idea per page, value revealed incrementally per swipe; roughly
  25–40 words per page maximum; WCAG AA contrast (4.5:1) for body text.
  Sources: TryMyPost (Apr 2026); Oktopost (2026).

---

## 2. Post text: limits, fold, hashtags, mentions, line breaks

- **Character limit: 3.000** including spaces, emoji and line breaks. Emoji count
  as 2 characters (complex/flag emoji 4–7). Unicode-formatted characters count as
  normal characters.
  Source: AuthoredUp character limits (updated Jul 17, 2026)
  https://authoredup.com/blog/linkedin-character-limit
- **"See more" fold:** ~**210 characters on desktop**, ~**140 on mobile** before
  truncation; exact fold shifts with line breaks and attached media (observed
  range 120–220), and a paragraph break usually ends the snippet early.
  Safest rule: **make the hook self-contained in the first ~140 characters, no
  blank line before it ends.**
  Sources: AuthoredUp (Jul 2026, above); LinkedHelper character-limit guide (2026)
  https://www.linkedhelper.com/blog/linkedin-character-limit/ ;
  Ferryman https://ferryman.io/character-limits/linkedin (2026).
- **Optimal length:** 1.300–2.500 characters performed best in AuthoredUp's
  372k-post dataset (Sep 2025–Feb 2026), ~27% higher engagement than <400-char posts.
- **Hashtags:** LinkedIn removed hashtag following (2024) and Creator-Mode topics;
  hashtags no longer boost reach by themselves; the algorithm classifies posts
  from the full copy + author "Topic Authority". They still aid search/discovery.
  **Conflict:** ContentIn/Finallayer (2026) find posts *without* hashtags outperform
  by 5–10%, while Metricool's 2026 study (673k posts) finds posts with ≥1 hashtag
  get ~85% more impressions (likely confounded). Safest: **0–3 relevant hashtags at
  the end, never counted on for reach.**
  Sources: Finallayer (2026) https://finallayer.com/blog/linkedin-hashtags-changes ;
  ContentIn (2026) https://contentin.io/blog/do-hashtags-work-on-linkedin/ ;
  ConnectSafely (2026) https://connectsafely.ai/articles/linkedin-hashtags
- **@mentions:** typing `@name` creates a link and notifies the person/page.
  Standard 2025–2026 algorithm guidance: only tag people genuinely involved;
  tagging people who don't react is treated as engagement-bait and can suppress
  distribution.
  Sources: SocialBee algorithm guide (2026) https://socialbee.com/blog/linkedin-algorithm/ ;
  Hootsuite algorithm guide (updated Jul 14, 2026) https://blog.hootsuite.com/linkedin-algorithm/
- **Line breaks / blank lines:** single line breaks are preserved reliably.
  **Multiple consecutive blank lines are collapsed** (mobile editor is the most
  aggressive); pasted rich-text formatting is stripped. Reliable pattern: one
  Enter between paragraphs; if a visually empty line is essential, put an
  invisible character (e.g. zero-width or thin space) on it. Whitespace counts
  toward the 3.000-char limit.
  Sources: LinkedInFormatter line-breaks explainer (2026)
  https://linkedinformatter.net/blog/linkedin-line-breaks ;
  MarkdownToLinkedIn (2026) https://markdowntolinkedin.com/blog/linkedin-line-breaks/

---

## 3. Unicode "bold/italic" (Mathematical Alphanumeric Symbols)

- **Mechanism:** not formatting; each letter is swapped for a different Unicode
  code point (U+1D400 block) that merely looks bold/italic. LinkedIn has **no
  native bold/italic in ordinary posts** (native rich text exists only in
  Articles/newsletters).
- **Rendering:** the Mathematical **bold sans-serif** set renders reliably across
  LinkedIn desktop web, iOS and Android apps. Italic, script, double-struck and
  other fancy sets are less reliable (missing glyphs / tofu boxes on some older
  Android system fonts and in email digests of posts). Safest set if used at all:
  bold sans-serif only.
  Sources: BrandGhost formatting guide (2025)
  https://blog.brandghost.ai/posts/how-to-format-text-linkedin-posts/ ;
  ConnectSafely bold-text guide (2026)
  https://connectsafely.ai/articles/how-to-add-bold-text-to-linkedin-posts-2026
- **Documented downsides:**
  - **Screen readers** announce these characters one by one ("mathematical bold
    capital A…") or skip them entirely; whole sentences become unintelligible for
    blind/low-vision readers. Well-documented accessibility critique:
    Axbom, "Don't fake bold and italic text with Unicode" (evergreen, still the
    canonical reference) https://axbom.com/dont-fake-bold-and-italic-text-with-unicode/ ;
    M365 Princess https://www.m365princess.com/blogs/bold/
  - **Search/indexing:** LinkedIn search matches plain Latin characters; text
    written in Unicode lookalikes does not match searches for the normal spelling,
    so keywords set in fake bold are invisible to search.
    Source: ConnectSafely (2026, above).
- **Safer alternatives LinkedIn natively supports:** structure via single line
  breaks and short paragraphs; ALL-CAPS for one or two words; unicode bullets
  (→ • ▸) which screen readers handle better than letter substitution; emoji as
  section markers; native bold/italic inside Articles/newsletters when long-form
  is warranted.
- **Policy conclusion:** use Unicode bold sans-serif **sparingly and deliberately**:
  at most 1–3 short phrases per post (e.g. a hook word or section labels), never
  whole sentences, never numbers/prices, never anything a reader might search for.

---

## 4. Personal profile vs Company Page

- **Capability parity:** document posts work the same from a member profile, a
  LinkedIn Page and Groups; same file types and 100 MB / 300-page limits.
  Source: https://www.linkedin.com/help/linkedin/answer/a518909 (official).
- **Reach is very different:** organic Company Page content is ~1–2% of feed
  inventory; personal-profile posts of identical content reach roughly **5–10x**
  more (some 2026 datasets report >500% differences).
  Sources: Digital Applied (2026)
  https://www.digitalapplied.com/blog/linkedin-personal-profiles-vs-company-pages-8x-engagement ;
  meet-lea (2026) https://meet-lea.com/en/blog/linkedin-personal-profile-vs-company-page-engagement ;
  Ordinal, company-page reach (Jan 2026)
  https://www.tryordinal.com/blog/the-declining-reach-of-linkedin-company-pages
- Within Company Pages, carousels are still the best-performing organic format
  (~11x interactions vs single images). Pages can amplify personal posts via
  Thought Leader Ads.
  Source: Digital Applied (2026, above); Oktopost (2026).
- **Practical rule:** publish carousels from the personal profile (Floris);
  the Oppr Page reposts/hosts the same PDF for the company record.

---

## 5. 2025–2026 feed changes relevant to format choice

- **Dwell time is the dominant distribution signal.** LinkedIn confirmed document
  posts drive higher dwell time, and each swipe on a carousel is a micro
  engagement signal.
  Sources: Hootsuite algorithm guide (updated Jul 14, 2026)
  https://blog.hootsuite.com/linkedin-algorithm/ ;
  Digital Applied algorithm guide (2026)
  https://www.digitalapplied.com/blog/linkedin-algorithm-2026-engagement-strategy-guide
- **Carousel comeback:** carousels/documents dipped ~18% in reach during the
  2024–2025 video push, then recovered to the top of 2026 format rankings:
  ~6,6% average engagement rate (highest of any format), 2–3x dwell time of
  text/image posts, and in one 2026 dataset ~278% more engagement than video posts.
  Sources: PostUnreel carousel statistics (2026)
  https://postunreel.com/blog/linkedin-carousel-engagement-rate-statistics-2026 ;
  Dataslayer (Feb 2026) https://www.dataslayer.ai/blog/linkedin-algorithm-february-2026-whats-working-now ;
  ContentIn format strategy (2026)
  https://contentin.io/blog/linkedin-algorithm-2025-the-complete-content-format-strategy-guide/
- **Video still growing** (third consecutive quarter of double-digit watch-time
  growth in Q1 2026) and the algorithm favors it, but competition is intensifying;
  documents remain the strongest reach-per-effort format for B2B explainers.
  **Conflict:** one Q1 2026 dataset shows carousel reach declining quarter-on-quarter
  even as engagement rate stays highest; treat carousels as an engagement-quality
  play, not a guaranteed-reach play.
  Sources: Hootsuite (Jul 2026, above); Ordinal (Jan 2026, above).
- **Other 2026 signals:** saves ≈ 5x the reach value of likes; external links are
  deprioritized (keep links in the document's last page CTA or first comment);
  reach concentrates on authors with consistent "Topic Authority", and the first
  ~60 minutes of engagement decide distribution.
  Sources: Hootsuite (Jul 2026); Forbes, "The LinkedIn Algorithm Changed Again" (Jan 12, 2026)
  https://www.forbes.com/sites/jodiecook/2026/01/12/the-linkedin-algorithm-changed-again-heres-whats-new-for-2026/

---

## Implications for the Oppr LinkedIn workflow

- **Page geometry: standardize on 1080×1350 px (4:5 portrait) PDF pages.** This is
  a *new* page template, not a reuse of deck slides: the deck system's 13.333×7.5 in
  (16:9) pages are the wrong shape and their type is far too small at feed size.
  LinkedIn requires uniform page size and flattened, static PDFs, so export a
  dedicated carousel artifact.
- **Length and weight:** 8–10 pages (hook page, 6–8 content pages, CTA page);
  export under 5 MB.
- **Font-size floor:** on the 1080 px canvas, body ≥ 32 px, secondary/labels ≥ 28 px,
  headlines 60–80 px; WCAG AA contrast; one idea and ≤ ~35 words per page. This
  matches the existing "management-level" deck register (one idea/slide, bigger type).
- **Unicode policy:** allowed set = Mathematical bold sans-serif only; max 1–3
  short phrases per post; never whole sentences, numbers, prices, or searchable
  keywords; prefer structure (single line breaks, → bullets) over fake formatting.
  Screen-reader cost is real; the PDF itself carries the visual hierarchy, so the
  post copy can stay nearly plain.
- **Post copy:** hook complete in the first ~140 characters; total 1.300–2.500
  characters; single Enter between paragraphs (blank lines collapse, especially on
  mobile); 0–3 hashtags at the end; links in the final CTA page or first comment,
  not the post body; tag only people actually involved.
- **Channel:** publish from Floris's personal profile for reach (5–10x a Page);
  mirror on the Oppr Page for the record and potential Thought Leader Ads.
- **Note:** European number formatting (€ 25.000 · 0,5%) per brand rules applies to
  carousel pages and post copy alike.

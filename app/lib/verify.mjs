// The verify gate, in JavaScript (Deck Studio cloud).
//
// `tools/verifylib.py` is the CLI's gate and stays the reference. This is the
// same rule set for the snapshot path, so it can run where there is no Python —
// which is the whole reason the app can leave this machine.
//
// It is a deliberate port, not a reimplementation: same codes, same messages,
// same PAGE_FORMATS table, same NAME_SCOPE. `tools/check-verify-parity.py`
// compares the two on every real artifact so they cannot drift apart silently.
// If you change a rule, change it in both and run that check.

import { PDFDocument } from "pdf-lib";

export const NO_FOOTER_ROLES = new Set(["cover", "closer", "cta"]);

// Must match verifylib.PAGE_FORMATS exactly.
export const PAGE_FORMATS = {
  "deck-16x9": { size: [13.333, 7.5], structural: true },
  "linkedin-4x5": { size: [1080 / 96, 1350 / 96], structural: false },
  "square-1x1": { size: [1080 / 96, 1080 / 96], structural: false },
  "hero-1200x627": { size: [1200 / 96, 627 / 96], structural: false },
  none: { size: null, structural: false },
};

const pageRules = (f) => PAGE_FORMATS[f || "deck-16x9"] || PAGE_FORMATS["deck-16x9"];

// One clearance slug per customer. A deck must be cleared for exactly the
// customers it names.
const NAME_SCOPE = {
  mutares: "mutares", holliday: "holliday", venator: "venator",
  attero: "attero", keeeper: "keeeper", omniplast: "omniplast",
  sonneborn: "sonneborn", host: "host", selo: "selo", wavin: "wavin",
};

// Two customer names are ordinary English words, so \bname\b would fail any deck
// containing "the plant that would host it" or "select". Same trade-off as the
// Python side: a bare "HoSt" slips through, which the visual pass can catch,
// rather than a false FAIL that trains people to ignore the gate.
const NAME_PATTERN = {
  host: /host\s*bioenergy/,
  selo: /\bselo\b(?!ct)/,
};

class Report {
  constructor() { this.entries = []; }
  fail(msg, code = "", slideId = null) { this.entries.push({ level: "fail", code, slide_id: slideId, msg }); }
  warn(msg, code = "", slideId = null) { this.entries.push({ level: "warn", code, slide_id: slideId, msg }); }
  asDict() {
    return {
      fails: this.entries.filter((e) => e.level === "fail").map((e) => e.msg),
      warns: this.entries.filter((e) => e.level === "warn").map((e) => e.msg),
      entries: this.entries,
    };
  }
}

// Lines the reader actually sees: everything outside <style>, <script> and
// comments. Inlined CSS legitimately contains em dashes in its comments, and the
// deck-meta manifest holds the title, so scanning the raw document would produce
// a FAIL on every snapshot.
function visibleLines(doc) {
  const out = [];
  let block = null;
  const lines = doc.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const low = line.toLowerCase();
    if (!block) {
      let opened = null;
      if (low.includes("<style") && !low.includes("</style>")) opened = "style";
      else if (low.includes("<script") && !low.includes("</script>")) opened = "script";
      else if (line.includes("<!--") && !line.includes("-->")) opened = "comment";
      if (opened) { block = opened; continue; }
      // strip single-line blocks before looking at the text
      const stripped = line
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "");
      out.push([i + 1, stripped]);
    } else {
      const closer = { style: "</style>", script: "</script>", comment: "-->" }[block];
      if (low.includes(closer) || (block === "comment" && line.includes("-->"))) block = null;
    }
  }
  return out;
}

// Python's html.unescape resolves every named entity. The decks are written with
// entities rather than literal characters, so a partial table silently skips
// checks: without &euro; the euro-format WARN never fired on any deck.
const ENTITIES = {
  // Spaces matter more than they look. The decks write money as
  // `&euro;&thinsp;55,000`, so without &thinsp; the euro-format check sees "&"
  // after the symbol and never fires — a rule that silently does nothing.
  nbsp: " ", thinsp: " ", ensp: " ", emsp: " ",
  hairsp: " ", zwj: "‍", zwnj: "‌", shy: "­",
  mdash: "—", ndash: "–", minus: "−", hyphen: "‐",
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  euro: "€", pound: "£", cent: "¢", yen: "¥",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", sbquo: "‚",
  times: "×", divide: "÷", middot: "·", deg: "°", plusmn: "±", frac12: "½",
  eacute: "é", egrave: "è", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
  ccedil: "ç", ntilde: "ñ", aacute: "á", oacute: "ó", iacute: "í",
  reg: "®", copy: "©", trade: "™", sect: "§", para: "¶",
  larr: "←", rarr: "→", darr: "↓", uarr: "↑", harr: "↔",
  bull: "•", dagger: "†", prime: "′", Prime: "″", laquo: "«", raquo: "»",
};

function unescapeHtml(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : m);
}

const stripTags = (s) => s.replace(/<[^>]*>/g, " ");

function checkHtml(doc, n, slides, allowed, r, pageFormat) {
  const structural = pageRules(pageFormat).structural;
  const visible = visibleLines(doc);
  const text = unescapeHtml(visible.map(([, l]) => l).join("\n"));

  // 1. em dashes, in visible prose only
  for (const [i, line] of visible) {
    if (unescapeHtml(line).includes("—") || line.includes("&mdash;")) {
      r.fail(`em dash on line ${i}: ${line.trim().slice(0, 70)}`, "em-dash");
    }
  }

  // 2. unfilled variables, anywhere in the document
  const placeholders = new Set();
  // deckstudio._PLACEHOLDER_RE is {{\s*[\w-]+\s*}} — deliberately NOT matching
  // ":" or ".", so the {{icon:NAME}} token documented in the inlined CSS is not
  // mistaken for an unfilled variable. Widening this produced a false FAIL on
  // six decks.
  for (const m of doc.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)) placeholders.add(m[1]);
  for (const v of [...placeholders].sort()) {
    r.fail(`unfilled placeholder in shipped HTML: {{${v}}}`, "unfilled");
  }

  // 3. data-total consistency (composed decks only)
  if (structural) {
    const totals = new Set([...doc.matchAll(/data-total="(\d+)"/g)].map((m) => m[1]));
    for (const t of totals) {
      if (Number(t) !== n) r.fail(`data-total="${t}" != slide count ${n}`, "data-total");
    }
  }

  // 4. page count, and footer discipline where the format has footers
  const secs = [...doc.matchAll(/<section\b[\s\S]*?<\/section>/gi)].map((m) => m[0]);
  if (secs.length !== n) r.fail(`${secs.length} <section> blocks != ${n} pages`, "section-count");
  if (structural) {
    slides.forEach((sl, i) => {
      const sec = secs[i];
      if (sec === undefined) return;
      const { id: sid, role } = sl;
      const hasFoot = sec.includes("slide-foot");
      if (!role) {
        r.warn(`slide '${sid}' has no declared role; footer discipline not checked`, "no-role", sid);
        return;
      }
      if (NO_FOOTER_ROLES.has(role) && hasFoot) {
        r.fail(`slide '${sid}' (role ${role}) should have NO footer`, "footer", sid);
      }
      if (!NO_FOOTER_ROLES.has(role) && !hasFoot) {
        r.fail(`slide '${sid}' (role ${role}) is missing its .slide-foot`, "footer", sid);
      }
    });
  }

  // 6. customer-name text leak
  const low = stripTags(text).toLowerCase();
  for (const [name, scope] of Object.entries(NAME_SCOPE)) {
    if (allowed.has(scope)) continue;
    const re = NAME_PATTERN[name] || new RegExp(`\\b${name}\\b`);
    if (re.test(low)) {
      r.fail(`customer name '${name}' present but deck clearance is ${[...allowed].sort().join(", ")}`, "name-leak");
    }
  }

  // 7. euro number format (WARN)
  for (const m of text.matchAll(/€\s?\d{1,3},\d{3}/g)) {
    r.warn(`euro amount uses comma-grouping (Anglo) '${m[0]}': confirm it is a verbatim quote`, "euro-format");
  }
}

async function checkPdf(pdfBytes, pdfName, n, client, r, pageFormat) {
  const lc = pdfName.toLowerCase();
  if (!lc.includes("oppr")) {
    r.fail(`PDF '${pdfName}' does not carry 'oppr' in its name`, "pdf-name");
  }
  if (client) {
    const cslug = String(client).toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");
    if (cslug && !lc.includes(cslug)) {
      r.fail(`client deck PDF '${pdfName}' is missing the client slug '${cslug}'`, "pdf-name");
    }
  }

  let pdf;
  try {
    pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  } catch (e) {
    r.fail(`could not read the PDF: ${e.message}`, "pdf-unreadable");
    return;
  }
  const pages = pdf.getPages();
  if (pages.length !== n) {
    r.fail(`PDF ${pdfName} has ${pages.length} pages, expected ${n}`, "pdf-pages");
  }
  const expected = pageRules(pageFormat).size;
  if (expected && pages.length) {
    // pdf-lib reports points; 72 points to the inch, same as PyMuPDF's rect.
    const w = pages[0].getWidth() / 72;
    const h = pages[0].getHeight() / 72;
    const [ew, eh] = expected;
    const tol = pageFormat === "deck-16x9" ? 0.02 : 0.06;
    if (Math.abs(w - ew) > tol || Math.abs(h - eh) > tol) {
      r.fail(`PDF page size ${w.toFixed(3)}x${h.toFixed(3)} in, expected ${ew.toFixed(3)}x${eh.toFixed(3)} (${pageFormat})`, "pdf-size");
    }
  }
  // The blank-page WARN needs raster access, which the Python gate gets from
  // PyMuPDF. Not ported: it is a WARN, and rasterising in a serverless function
  // to produce a hint is not worth the cold start. Said out loud rather than
  // silently dropped.
  r.warn("blank-page check not run (raster scan is CLI-only)", "blank-page-skipped");
}

// Verify a materialized snapshot: index.html + assets/ + optional PDF.
// Mirrors verifylib.verify_snapshot.
export async function verifySnapshot({ html, pdfBytes = null, pdfName = "" }) {
  const r = new Report();
  if (!html) { r.fail("no index.html in snapshot", "no-index"); return r.asDict(); }

  const m = /<script type="application\/json" id="deck-meta">\s*(\{[\s\S]*?\})\s*<\/script>/.exec(html);
  if (!m) { r.fail("snapshot is missing its deck-meta manifest", "no-meta"); return r.asDict(); }

  let meta;
  try { meta = JSON.parse(m[1]); }
  catch (e) { r.fail(`deck-meta is not valid JSON: ${e.message}`, "no-meta"); return r.asDict(); }

  const slides = meta.slides || [];
  const n = slides.length;
  const allowed = new Set([...(meta.allowed_entitlements || ["public"]), "public"]);
  const client = meta.client || "";
  const pageFormat = meta.page_format || "deck-16x9";

  checkHtml(html, n, slides, allowed, r, pageFormat);

  // images: every <img> must point into the bundle, and its entitlement must be
  // within the artifact's clearance.
  const assetEnt = {};
  for (const [fn, a] of Object.entries(meta.assets || {})) {
    assetEnt[`assets/${fn}`] = a.entitlement || "public";
  }
  const bundled = new Set(Object.keys(meta.assets || {}).map((f) => `assets/${f}`));
  for (const im of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const src = im[1];
    if (src.startsWith("data:")) continue;
    if (!bundled.has(src)) r.fail(`image does not resolve: ${src}`, "image-missing");
    const ent = assetEnt[src] || "public";
    if (!allowed.has(ent)) {
      r.fail(`asset '${src}' entitlement '${ent}' exceeds clearance ${[...allowed].sort().join(", ")}`, "image-entitlement");
    }
  }

  if (!pdfBytes) {
    r.warn("no PDF in snapshot; skipped page-count / size / blank-page checks", "no-pdf");
  } else {
    await checkPdf(pdfBytes, pdfName, n, client, r, pageFormat);
  }
  return r.asDict();
}

// Unicode post editor — write the LinkedIn copy that goes with an artifact,
// then copy it whole and paste.
//
// LinkedIn has no rich text. "Bold" on LinkedIn is Unicode Mathematical
// Alphanumeric Symbols: different characters that happen to look bold. So the
// styling IS the text, which is why a plain <textarea> can display it and why
// copying is the whole delivery mechanism.
//
// The text lives on the artifact (`decks.post_text`), not in a file next to a
// build folder. That is the fix for how this editor went missing: it used to
// read social/<slug>/post.txt, and when social moved into the one artifact model
// the folder became disposable, so the button had nothing left to open. Saving
// here does NOT make a version — rewording a caption is not a new carousel.
//
// Digits are deliberately NOT mapped. brand rule: never bold a number, because
// search cannot index it and a screen reader spells it out. Leaving digits
// unmapped enforces that silently instead of warning about it after the fact.

import { $, el, esc, toast , backdropClose } from "./util.js";
import { icon } from "./icons.js";
import * as api from "./api.js";

// Sans-serif Mathematical Alphanumeric blocks. Sans-serif, not serif, because
// that is what the existing posts use and what matches Oppr's type.
const STYLES = {
  bold: { label: "Bold", upper: 0x1d5d4, lower: 0x1d5ee },
  italic: { label: "Italic", upper: 0x1d608, lower: 0x1d622 },
  bolditalic: { label: "Bold italic", upper: 0x1d63c, lower: 0x1d656 },
};

const UP_A = 0x41, UP_Z = 0x5a, LO_A = 0x61, LO_Z = 0x7a;

// Characters LinkedIn keeps and people actually use, since it strips markdown
// lists. No em dash: brand rule, en dash only, and only for numeric ranges.
const MARKS = [
  { ch: "•", title: "Bullet" },
  { ch: "▸", title: "Arrow bullet" },
  { ch: "→", title: "Arrow" },
  { ch: "✓", title: "Check" },
  { ch: "·", title: "Middle dot" },
];

// LinkedIn truncates the feed preview at roughly 140 characters, and hard-caps a
// post at 3000. Both are counted in characters, so every count here goes through
// Array.from: a Mathematical Alphanumeric character is ONE character but TWO
// UTF-16 units, so plain .length over-counts a styled hook by ~2x and would
// report a perfectly legal post as over the limit.
const FOLD = 140;
const MAX = 3000;
const chars = (s) => Array.from(s).length;

function applyStyle(str, key) {
  const s = STYLES[key];
  return Array.from(str)
    .map((c) => {
      const cp = c.codePointAt(0);
      if (cp >= UP_A && cp <= UP_Z) return String.fromCodePoint(s.upper + cp - UP_A);
      if (cp >= LO_A && cp <= LO_Z) return String.fromCodePoint(s.lower + cp - LO_A);
      return c;
    })
    .join("");
}

// Map any styled character back to ASCII. Used both for the "clear" action and
// for toggling a run off, so text that arrives already styled (several shipped
// posts do) behaves like text this editor styled itself.
function toPlain(str) {
  return Array.from(str)
    .map((c) => {
      const cp = c.codePointAt(0);
      for (const s of Object.values(STYLES)) {
        if (cp >= s.upper && cp < s.upper + 26) return String.fromCharCode(UP_A + cp - s.upper);
        if (cp >= s.lower && cp < s.lower + 26) return String.fromCharCode(LO_A + cp - s.lower);
      }
      return c;
    })
    .join("");
}

const hasStyle = (str, key) => {
  const s = STYLES[key];
  return Array.from(str).some((c) => {
    const cp = c.codePointAt(0);
    return (cp >= s.upper && cp < s.upper + 26) || (cp >= s.lower && cp < s.lower + 26);
  });
};

// deck: the artifact row (id + title). onSaved(text) lets the caller refresh
// whatever it shows about the post without reloading the whole list.
//
// postEditorPanel is the editor itself — toolbar, textarea, live feed preview —
// as an element any surface can host. The publication page embeds it straight
// into its Short form tab (no modal: the screen is already open). openPostEditor
// wraps the same panel in a modal for the places that only have a list row.
export function postEditorPanel(deck, text, { onSaved } = {}) {
  const styleBtns = Object.entries(STYLES)
    .map(([k, s]) => `<button class="ghost pe-style" data-style="${k}" title="${s.label}">${s.label}</button>`)
    .join("");
  const markBtns = MARKS.map(
    (m) => `<button class="ghost pe-mark" data-ch="${esc(m.ch)}" title="Insert ${m.title}">${esc(m.ch)}</button>`
  ).join("");

  const box = el(`
    <div class="pe-panel">
      <div class="pe-bar">
        ${styleBtns}
        <span class="pe-sep"></span>
        ${markBtns}
        <span class="pe-sep"></span>
        <button class="ghost pe-clear" title="Remove all Unicode styling">Clear styling</button>
        <div class="spacer"></div>
        <span class="pe-count note"></span>
        <button class="ghost pe-copy">${icon("copy", 14)} Copy all</button>
        <button class="primary pe-save">${icon("save", 14)} Save</button>
      </div>
      <div class="pe-split">
        <textarea class="postedit" spellcheck="false" placeholder="Write the post that goes with this artifact…"></textarea>
        <aside class="pe-side">
          <div class="pe-side-head">
            <b>In the feed</b>
            <label class="pe-toggle"><input type="checkbox" class="pe-expand"> Expand</label>
          </div>
          <div class="pe-phone">
            <div class="pe-author">
              <span class="pe-avatar">O</span>
              <span class="pe-who"><b>Floris Wyers</b><span>Oppr &middot; Operator Intelligence</span></span>
            </div>
            <div class="pe-post"></div>
            <div class="pe-meta"></div>
          </div>
        </aside>
      </div>
    </div>`);

  const ta = $(".postedit", box);
  ta.value = text || "";
  let last = ta.value;

  const expand = $(".pe-expand", box);

  function refresh() {
    const v = ta.value;
    const n = chars(v);
    const cnt = $(".pe-count", box);
    cnt.textContent = `${n} / ${MAX}`;
    cnt.classList.toggle("warn-text", n > MAX);

    // The feed preview shows what a phone shows: everything up to the fold, then
    // "see more". Slice by character, not by UTF-16 index, or a styled hook gets
    // cut in half and renders as two broken glyphs.
    const arr = Array.from(v);
    const folded = arr.length > FOLD;
    const shown = expand.checked || !folded ? v : arr.slice(0, FOLD).join("");

    // LinkedIn collapses runs of blank lines to one. Render it the same way, so
    // the preview is not quietly more spacious than the real thing.
    const post = $(".pe-post", box);
    post.textContent = shown.replace(/\n{3,}/g, "\n\n");
    if (folded && !expand.checked) post.append(el(`<span class="pe-more">… see more</span>`));

    $(".pe-meta", box).textContent = folded
      ? `Fold at ${FOLD} of ${n} characters`
      : `Whole post shows (${n} characters)`;
    $(".pe-save", box).disabled = ta.value === last;
  }

  // Replace the selection, keep it selected so the user can chain actions
  // (bold then italic) without reselecting.
  function replaceSelection(fn) {
    const { selectionStart: a, selectionEnd: b } = ta;
    if (a === b) { toast("Select some text first."); return; }
    const out = fn(ta.value.slice(a, b));
    ta.setRangeText(out, a, b, "select");
    ta.focus();
    refresh();
  }

  box.querySelectorAll(".pe-style").forEach((btn) =>
    btn.addEventListener("click", () => {
      const key = btn.dataset.style;
      // Toggle: styled text of this kind goes back to plain, anything else takes
      // the style. Going through toPlain first means bold -> italic works in one
      // click instead of stacking into nonsense.
      replaceSelection((sel) => (hasStyle(sel, key) ? toPlain(sel) : applyStyle(toPlain(sel), key)));
    })
  );

  box.querySelectorAll(".pe-mark").forEach((btn) =>
    btn.addEventListener("click", () => {
      const ch = btn.dataset.ch;
      const { selectionStart: a, selectionEnd: b } = ta;
      ta.setRangeText(a === b ? ch + " " : ch + " " + ta.value.slice(a, b), a, b, "end");
      ta.focus();
      refresh();
    })
  );

  $(".pe-clear", box).addEventListener("click", () => {
    const { selectionStart: a, selectionEnd: b } = ta;
    if (a === b) { ta.value = toPlain(ta.value); toast("Styling removed."); }
    else replaceSelection(toPlain);
    refresh();
  });

  $(".pe-copy", box).addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ta.value);
      toast("Copied. Paste straight into LinkedIn.");
    } catch {
      ta.select();
      toast("Press Ctrl+C to copy.");
    }
  });

  const save = async () => {
    const btn = $(".pe-save", box);
    btn.disabled = true;
    try {
      await api.patchDeck(deck.id, { post_text: ta.value });
      last = ta.value;
      toast("Post text saved.");
      onSaved?.(ta.value);
    } catch (e) {
      toast(e.message || "could not save");
    }
    refresh();
  };
  $(".pe-save", box).addEventListener("click", save);

  ta.addEventListener("input", refresh);
  expand.addEventListener("change", refresh);
  // Ctrl+S saves while the caret is in the editor; nothing global to unhook.
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  });

  refresh();
  return { node: box, unsaved: () => ta.value !== last, focus: () => ta.focus() };
}

// The modal wrapper, for surfaces that only have a list row to offer.
export function openPostEditor(deck, text, onSaved) {
  const m = el(`
    <div class="modal">
      <div class="modal-box pe-box">
        <header>
          <b>Post text · ${esc(deck.title || deck.slug)}</b>
          <div class="spacer"></div>
          <button class="ghost icon-only close" title="Close">${icon("close")}</button>
        </header>
      </div>
    </div>`);
  const panel = postEditorPanel(deck, text, { onSaved });
  $(".pe-box", m).append(panel.node);

  // Closing with unsaved text is the one way to lose work here, so it asks.
  const close = () => {
    if (panel.unsaved() && !confirm("Close without saving the post text?")) return;
    m.remove();
  };
  $(".close", m).addEventListener("click", close);
  backdropClose(m, close);
  document.addEventListener("keydown", function onKey(e) {
    if (!document.body.contains(m)) { document.removeEventListener("keydown", onKey); return; }
    if (e.key === "Escape") close();
  });

  document.body.append(m);
  setTimeout(() => panel.focus(), 30);
}

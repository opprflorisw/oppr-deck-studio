// The deck-building tools.
//
// This is the half of Deck Studio that Deck Studio 5 moves out of Claude Code.
// Until now, composing a deck meant either the app's builder or a skill reading
// a markdown file beside the repo; a colleague with neither could not make a
// deck at all. These tools are the same job through a connector, so it can be
// done from a phone.
//
// APPROVAL. The skills these replace had a hard approval gate: present the plan
// as a table, stop, wait for a human. That gate does not disappear -- it moves
// to where the human actually is. `deck_check` exists so the plan and the gate
// findings are shown in the conversation, and `deck_publish` refuses without
// `confirm: true`. A model can still misreport what it is about to do, exactly
// as it could with the markdown gate; what is different is that the refusal is
// now enforced by the server rather than by a paragraph of instructions.

import * as db from "./supabase.mjs";
import * as drafts from "./handlers/drafts.mjs";
import * as jobs from "./jobs.mjs";

const text = (s) => ({ content: [{ type: "text", text: s }], isError: false });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

const decode = (s) =>
  String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&middot;/g, "·").replace(/&nbsp;/g, " ").replace(/&euro;/g, "€");

// --- who am I ----------------------------------------------------------------

export async function whoami(_args, member) {
  const can = {
    owner: "everything, including the company decks and the slide library",
    editor: "register customers, build and publish their decks, record what was sent",
    viewer: "read only",
  }[member.role] || "nothing";
  return text(
    `You are acting as ${member.email} (${member.role}).\n` +
    `This connector can: ${can}.\n\n` +
    `Changing a company deck or the slide library is deliberately not possible here — ` +
    `it changes every deck built afterwards, so it is done by an owner in the app.`);
}

// --- composing ---------------------------------------------------------------

function renderDraft(draft, chapters) {
  const order = draft.slots?._order || [];
  const picked = Object.entries(draft.recipe || {});
  if (!picked.length) return "  (no slides yet)";
  const byId = new Map();
  for (const ch of chapters) for (const s of ch.slides) byId.set(s.slide_id, { ...s, chapter: ch.title });
  const flat = [];
  for (const ch of chapters) {
    const ids = draft.recipe[ch.id] || [];
    for (const id of ids) flat.push(id);
  }
  const ordered = [...order.filter((id) => flat.includes(id)),
                   ...flat.filter((id) => !order.includes(id))];
  return ordered.map((id, i) => {
    const s = byId.get(id);
    return `  ${String(i + 1).padStart(2)}. ${id.padEnd(24)} ${s ? s.chapter : "?"}`;
  }).join("\n");
}

export async function deckStart(args, member) {
  const r = await drafts.start(args || {}, member);
  if (!r.ok) return fail(r.message || "That deck could not be started.");

  const chapters = await drafts.chapters();
  const lines = [
    `Draft started: ${r.draft.title}`,
    `  slug ${r.draft.slug} · type ${r.draft.type} · cleared for ${r.allowed.join(", ")}`,
    r.started_from ? `  copied the slides from "${r.started_from}" (that deck is untouched)` : `  starting empty`,
    "",
    renderDraft(r.draft, chapters),
  ];
  if (r.dropped?.length) {
    lines.push("", `Dropped ${r.dropped.length} slide(s) this deck is not cleared for:`);
    for (const d of r.dropped) lines.push(`  - ${d.slide_id}: ${d.why}`);
  }
  lines.push("", `Draft id: ${r.draft.id}`,
    `Next: deck_slides to adjust, deck_vars to fill in the details, then deck_check.`);
  return text(lines.join("\n"));
}

export async function deckOpen({ slug }, member) {
  const r = await drafts.open(slug, member);
  if (!r.ok) return fail(r.message || `Could not open "${slug}".`);
  const chapters = await drafts.chapters();
  return text(
    `${r.resumed ? "Resumed your draft of" : "Opened"} ${decode(r.deck.title)} ` +
    `(currently v${r.deck.current_version_n}).\n` +
    `  cleared for ${(r.deck.allowed_entitlements || []).join(", ")} — inherited, not changeable\n\n` +
    renderDraft(r.draft, chapters) +
    `\n\nDraft id: ${r.draft.id}\nPublishing will add v${r.deck.current_version_n + 1}.`);
}

export async function deckSlides({ draft, add = [], remove = [], order = null }, member) {
  const r = await drafts.setSlides(draft, { add, remove, order }, member);
  if (!r.ok) {
    if (r.error === "not_yours") return fail("That draft belongs to someone else.");
    if (r.error === "not_pickable") {
      return fail("None of those slides can be used here:\n" +
                  r.refused.map((x) => `  - ${x.slide_id}: ${x.why}`).join("\n"));
    }
    return fail("No such draft. Start one with deck_start.");
  }
  const chapters = await drafts.chapters();
  const out = [renderDraft(r.draft, chapters)];
  if (r.refused?.length) {
    out.push("", "Not added:");
    for (const x of r.refused) out.push(`  - ${x.slide_id}: ${x.why}`);
  }
  return text(out.join("\n"));
}

export async function deckVars(args, member) {
  const { draft, vars = {}, ...rest } = args || {};
  const patch = { ...vars };
  for (const k of ["deck_footer", "cover_meta", "prepared_for"]) {
    if (rest[k] !== undefined) patch[k] = rest[k];
  }
  const cur = await drafts.get(draft, member);
  if (!cur) return fail("No such draft.");
  if (cur.forbidden) return fail("That draft belongs to someone else.");

  const next = { vars: { ...(cur.vars || {}), ...patch } };
  if (rest.title) next.title = rest.title;
  const r = await drafts.save(draft, next, member);
  if (!r.ok) return fail("That draft could not be updated.");

  const shown = Object.entries(r.draft.vars || {})
    .map(([k, v]) => `  ${k}: ${v}`).join("\n");
  return text(`${r.draft.title}\n${shown || "  (no variables set)"}`);
}

// --- checking and publishing --------------------------------------------------

// The gate findings, in the language the app uses. verify.mjs answers in codes;
// a person reading a chat needs the sentence.
function explain(entry) {
  const fixes = {
    "em-dash": "use an en dash (–) or rewrite the sentence",
    unfilled: "a {{variable}} was never given a value — set it with deck_vars",
    "name-leak": "this deck is not cleared to name that customer",
    "image-entitlement": "that image belongs to another customer",
    "image-missing": "an image is referenced that the deck does not carry",
    footer: "a slide's footer does not match its role",
    "data-total": "the page count in the footers disagrees with the number of slides",
    "pdf-size": "the printed page is not the size this format requires",
    "pdf-pages": "the PDF has a different number of pages than the deck has slides",
    "euro-format": "European formatting is € 25.000, not € 25,000",
  };
  const fix = fixes[entry.code];
  return `  ${entry.level === "fail" ? "BLOCKS" : "note  "}  ${entry.msg}${fix ? `\n          → ${fix}` : ""}`;
}

async function runBuild(draft, { dryRun }, member) {
  const recipe = await drafts.toRecipe(draft);
  recipe.author = member.email;
  recipe.author_id = member.id;
  if (draft.deck_id) {
    const [deck] = await db.select("decks", { id: `eq.${draft.deck_id}`, select: "slug" });
    if (deck) recipe.version_of = deck.slug;
  }
  return jobs.buildFromRecipe(recipe, { dryRun });
}

export async function deckCheck({ draft: draftId }, member) {
  const draft = await drafts.get(draftId, member);
  if (!draft) return fail("No such draft.");
  if (draft.forbidden) return fail("That draft belongs to someone else.");

  const r = await runBuild(draft, { dryRun: true }, member);
  const chapters = await drafts.chapters();
  const out = [
    `${draft.title}`,
    `  slug ${draft.slug} · type ${draft.type}`,
    "",
    renderDraft(draft, chapters),
    "",
  ];

  if (!r.ok && !r.verify_report) {
    out.push(`It could not be built: ${r.error || "unknown error"}`);
    return fail(out.join("\n"));
  }

  const entries = r.verify_report?.entries || [];
  const fails = entries.filter((e) => e.level === "fail");
  const warns = entries.filter((e) => e.level === "warn");
  if (fails.length) {
    out.push(`${fails.length} thing(s) must be fixed before this can be published:`);
    for (const e of fails) out.push(explain(e));
  } else {
    out.push("The brand gate passes.");
  }
  if (warns.length) {
    out.push("", "Worth a look:");
    for (const e of warns) out.push(explain(e));
  }
  out.push("", fails.length
    ? "Fix these, then run deck_check again."
    : "SHOW THIS TO THE PERSON AND ASK WHETHER TO PUBLISH. " +
      "If they say yes, call deck_publish with confirm: true.");
  return fails.length ? fail(out.join("\n")) : text(out.join("\n"));
}

export async function deckPublish({ draft: draftId, change_note = "", confirm = false }, member) {
  const draft = await drafts.get(draftId, member);
  if (!draft) return fail("No such draft.");
  if (draft.forbidden) return fail("That draft belongs to someone else.");

  if (!confirm) {
    // Not an error the model should route around: it is the approval step. The
    // check result is returned again so there is something concrete to show.
    const check = await deckCheck({ draft: draftId }, member);
    return fail(
      (check.content[0].text) +
      `\n\nNothing has been published. Show the above to the person, and call ` +
      `deck_publish again with confirm: true once they have approved it.`);
  }

  const r = await runBuild(draft, { dryRun: false }, member);
  if (!r.ok) {
    const entries = r.verify_report?.entries?.filter((e) => e.level === "fail") || [];
    return fail(
      `Not published — the brand gate refused it:\n` +
      (entries.length ? entries.map(explain).join("\n") : `  ${r.error || "unknown error"}`));
  }

  await drafts.remove(draftId, member);
  return text(
    `Published ${r.deck.slug} v${r.deck.version} (${r.deck.page_count || "?"} pages).\n` +
    (change_note ? `  note: ${change_note}\n` : "") +
    `Get the file with deck_pdf, and record deck_record_sent once it has gone out.`);
}

// --- the file ------------------------------------------------------------------

/**
 * A download link for the caller.
 *
 * Deliberately NOT a share link (Deck Studio 5, D3: the deliverable is the PDF
 * and sharing is out of scope). This is a signed Storage URL that expires in ten
 * minutes, so the person who asked can save the file from a phone. It is not
 * something to forward: it is the equivalent of pressing Download in the app.
 */
export async function deckPdf({ slug, version }, member) {
  const [deck] = await db.select("decks", { slug: `eq.${slug}`, select: "id,title,current_version_n" });
  if (!deck) return fail(`No deck with slug "${slug}". Use decks_search to find it.`);
  const n = Number(version) || deck.current_version_n;
  if (!Number.isInteger(n) || n < 1 || n > deck.current_version_n) {
    return fail(`"${slug}" has versions 1 to ${deck.current_version_n}; there is no v${version}.`);
  }
  const [v] = await db.select("deck_versions",
    { deck_id: `eq.${deck.id}`, n: `eq.${n}`, select: "pdf_object,verify_report" });
  if (!v) return fail(`"${slug}" has no version ${n}.`);

  let object = v.pdf_object;
  if (!object) {
    if (n !== deck.current_version_n) {
      return fail(`v${n} of "${slug}" was never printed, and only the current version is ` +
                  `printed on demand. Ask for the current version, or open it in the app.`);
    }
    const job = await jobs.buildAndWait(deck);
    if (job.state !== "pass") {
      const entries = job.verify_report?.entries?.filter((e) => e.level === "fail") || [];
      return fail(
        `No file: this deck does not pass the brand gate, so the PDF is withheld.\n` +
        (entries.length ? entries.map(explain).join("\n") : `  ${job.error || "the print failed"}`));
    }
    const [again] = await db.select("deck_versions",
      { deck_id: `eq.${deck.id}`, n: `eq.${n}`, select: "pdf_object" });
    object = again?.pdf_object;
  }
  if (!object) return fail("The PDF could not be produced.");

  const url = await db.signedUrl(object, 600);
  return text(
    `${decode(deck.title)} v${n}\n${url}\n\n` +
    `This link works for ten minutes and is for you — it is a download, not something to ` +
    `forward to a customer. Send them the file itself, then record it with deck_record_sent.`);
}

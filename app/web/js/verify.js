// Plain-language verify results (Deck Studio 2.0, the status surface).
//
// verify-deck.py already emits structured entries — {level, code, slide_id, msg}
// — and stores them on deck_versions.verify_report. The app used to reduce all
// of that to "2 fail · 1 warn", which tells you something is wrong and nothing
// about what to do. This module turns each code into a sentence you can act on,
// and says who fixes it: you, here, or a CLI session.
//
// `msg` is always kept as the detail line, so nothing is hidden by the
// translation — an unrecognised code degrades to the raw message.

const RULES = {
  "em-dash": {
    title: "An em dash slipped in",
    fix: "Brand rule: en dashes only. The editor replaces them as you type, so this one came from the CLI build.",
    where: "app",
  },
  unfilled: {
    title: "A placeholder was never filled",
    fix: "A {{variable}} reached the shipped HTML. It needs a value in deck.yaml, so this is a CLI fix.",
    where: "cli",
  },
  "data-total": {
    title: "The page counter disagrees with the slide count",
    fix: "Every slide's data-total must equal the number of slides. Structural, so the CLI rebuilds it.",
    where: "cli",
  },
  "section-count": {
    title: "The slide count does not match the document",
    fix: "Slides were added or removed outside the composition. The CLI rebuilds it.",
    where: "cli",
  },
  footer: {
    title: "Footer discipline is broken",
    fix: "Content slides carry a footer; cover, closer and cta slides must not. The CLI fixes the slide's role.",
    where: "cli",
  },
  "name-leak": {
    title: "A customer is named in a deck not cleared for them",
    fix: "Either clear the deck for that customer, or take the name out. Never widen clearance just to pass.",
    where: "human",
  },
  "image-entitlement": {
    title: "An image is above this artifact's clearance",
    fix: "Swap it for one you are cleared to use — the editor's image picker only offers those.",
    where: "app",
  },
  "image-missing": {
    title: "An image does not resolve",
    fix: "The file is referenced but not bundled. Re-publishing from the CLI rebuilds the asset bundle.",
    where: "cli",
  },
  "pdf-name": {
    title: "The PDF filename breaks the naming rule",
    fix: "Every PDF carries 'oppr', and a client deck carries the client slug. Rename keeps both, so this came from elsewhere.",
    where: "app",
  },
  "pdf-pages": {
    title: "The PDF has the wrong number of pages",
    fix: "Usually a slide overflowed onto a second page. Nudge the spacing down in the editor, then regenerate.",
    where: "app",
  },
  "pdf-size": {
    title: "The PDF page size is wrong",
    fix: "The page geometry comes from the stylesheet, so this is a CLI fix.",
    where: "cli",
  },
  "no-index": { title: "Nothing to verify", fix: "The artifact has no HTML document.", where: "cli" },
  "no-meta": { title: "The snapshot is missing its manifest", fix: "Re-publish from the CLI.", where: "cli" },
  // warns
  "euro-format": {
    title: "A euro amount uses Anglo grouping",
    fix: "European formatting is € 25.000, not € 25,000. Fine if it is a verbatim quote.",
    where: "app",
  },
  "blank-page": {
    title: "A page looks blank or underfilled",
    fix: "Worth a look before sending. Often deliberate on a cover.",
    where: "human",
  },
  "no-pdf": {
    title: "No PDF yet, so print checks were skipped",
    fix: "Regenerate to run the page-count, size and blank-page checks.",
    where: "app",
  },
  "no-role": {
    title: "A slide has no declared role",
    fix: "Footer discipline could not be checked on it.",
    where: "cli",
  },
  "pdf-name-warn": {
    title: "The PDF name differs from the derived one",
    fix: "Harmless, but Rename will bring it back in line.",
    where: "app",
  },
};

const WHERE_LABEL = {
  app: "fix here",
  cli: "needs the CLI",
  human: "your call",
};

// Turn a stored verify_report into an ordered list of explained findings.
export function explain(report) {
  if (!report) return [];
  const entries = report.entries?.length
    ? report.entries
    : [
        ...(report.fails || []).map((msg) => ({ level: "fail", code: "", msg })),
        ...(report.warns || []).map((msg) => ({ level: "warn", code: "", msg })),
      ];
  return entries.map((e) => {
    const rule = RULES[e.code] || null;
    return {
      level: e.level,
      slideId: e.slide_id || "",
      title: rule ? rule.title : e.msg,
      detail: e.msg,
      fix: rule ? rule.fix : "",
      where: rule ? rule.where : "human",
      whereLabel: WHERE_LABEL[rule ? rule.where : "human"],
    };
  });
}

// One-line summary for a list row. Says the worst thing first.
//
// A CLEAN report and NO report are different states and must not read alike:
// a passing verify produces `{fails:[],warns:[],entries:[]}`, which is zero
// findings but is emphatically not "unverified". Only a null/absent report
// means nothing has checked this version.
export function summarize(report) {
  if (!report) return { tone: "unknown", text: "not verified yet" };
  const found = explain(report);
  const fails = found.filter((f) => f.level === "fail");
  const warns = found.filter((f) => f.level === "warn");
  if (!found.length) return { tone: "pass", text: "verified" };
  if (fails.length) {
    return {
      tone: "fail",
      text: fails.length === 1 ? fails[0].title : `${fails[0].title} (+${fails.length - 1} more)`,
    };
  }
  if (warns.length) return { tone: "warn", text: `verified, ${warns.length} warning${warns.length === 1 ? "" : "s"}` };
  return { tone: "pass", text: "verified" };
}

// Does anything here need a CLI session rather than the editor?
export function needsCli(report) {
  return explain(report).some((f) => f.level === "fail" && f.where === "cli");
}

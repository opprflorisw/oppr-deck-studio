// Documentation is checked, not trusted.
//
// The port of tools/check-docs.py, plus the rules it could never apply because
// it did not read the files where the drift actually lived: the workflow command
// markdown, and the slide ids named in a type recipe. Four of six recipes named
// RETIRED slides; one named eight slides that do not exist; the command files
// pointed at three directories deleted a fortnight earlier.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const R = (p) => path.join(ROOT, p);
const read = (p) => fs.readFileSync(R(p), "utf-8");
const exists = (p) => fs.existsSync(R(p));

// Every doc that describes how to operate the studio.
const DOCS = [
  "CLAUDE.md", "decks/CLAUDE.md", "social/CLAUDE.md", "library/CLAUDE.md",
  "types/CLAUDE.md", "dump/CLAUDE.md", "knowledge/CLAUDE.md", "research/CLAUDE.md",
  "app/README.md", ".scratch/README.md",
].filter(exists);

const COMMANDS = exists(".claude/commands")
  ? fs.readdirSync(R(".claude/commands")).filter((f) => f.endsWith(".md"))
      .map((f) => `.claude/commands/${f}`)
  : [];

const ALL_DOCS = [...DOCS, ...COMMANDS];

// A backticked token that looks like a repo path: has a slash or a known
// extension, no spaces, no URL scheme, no placeholder.
const PATHY = /`([A-Za-z0-9_.\-]+(?:[\/\\][A-Za-z0-9_.\-]+)+)`/g;

function claimedPaths(text) {
  const out = new Set();
  let m;
  while ((m = PATHY.exec(text))) {
    let p = m[1].replace(/\\/g, "/");
    if (/^https?:/.test(p) || p.includes("<") || p.includes("*")) continue;
    if (/^(\.\.?\/)/.test(p)) continue;
    out.add(p.replace(/\/$/, ""));
  }
  return out;
}

// Build scratch and generated trees are legitimately absent in a clean clone.
const ABSENT_OK = /^(decks|social|references|dump|node_modules|library\/kit|brand\/kit|brand\/fonts-static|research\/last30days\/(posts|runs))\//;

// A doc whose subject is a subfolder writes paths relative to THAT, not to
// itself: research/CLAUDE.md documents research/last30days/ and says
// `posts/_status.json`. Stated once here rather than bending the prose to suit
// the checker.
const DOC_BASE = { "research/CLAUDE.md": "research/last30days" };

test("every repo path named in a doc exists", () => {
  const missing = [];
  for (const doc of ALL_DOCS) {
    const here = DOC_BASE[doc] || path.posix.dirname(doc.replace(/\\/g, "/"));
    for (const p of claimedPaths(read(doc))) {
      if (ABSENT_OK.test(p)) continue;
      // A doc may name a path relative to itself (app/README.md writes
      // `lib/verify.mjs`) or from the repo root. Either resolves.
      const asRelative = here === "." ? p : path.posix.join(here, p);
      if (exists(p) || exists(asRelative)) continue;
      missing.push(`${doc}: ${p}`);
    }
  }
  assert.deepEqual(missing, [], `paths named in docs but not present:\n  ${missing.join("\n  ")}`);
});

// Commands provided by the harness or by Floris's own global setup, not by this
// repo. Listed rather than pattern-matched so adding one is a decision.
const EXTERNAL_COMMANDS = new Set(["mcp", "model", "help", "clear", "config",
                                   "permissions", "goal", "last30days", "wayfinder",
                                   "design-sync", "loop", "code-review"]);
// URL prefixes this app serves. `/api` is not a slash command.
const URL_PREFIXES = new Set(["api", "repo", "deck-cache", "mcp", "oauth"]);

test("every /command named in a doc has a command file", () => {
  const bad = [];
  for (const doc of ALL_DOCS) {
    for (const m of read(doc).matchAll(/`\/([a-z][a-z0-9-]+)`/g)) {
      const name = m[1];
      if (EXTERNAL_COMMANDS.has(name) || URL_PREFIXES.has(name)) continue;
      if (!exists(`.claude/commands/${name}.md`)) bad.push(`${doc}: /${name}`);
    }
  }
  assert.deepEqual(bad, [], `commands named but not defined:\n  ${bad.join("\n  ")}`);
});

// --- the library's own consistency ----------------------------------------

function liveSlides() {
  const dir = R("library/slides");
  if (!fs.existsSync(dir)) return { live: new Set(), retired: new Set() };
  const live = new Set(), retired = new Set();
  for (const id of fs.readdirSync(dir)) {
    const meta = path.join(dir, id, "meta.yaml");
    if (!fs.existsSync(meta)) continue;
    const y = fs.readFileSync(meta, "utf-8");
    (/^retired:\s*true\s*$/m.test(y) ? retired : live).add(id);
  }
  return { live, retired };
}

function chapterMembership() {
  const f = R("library/chapters.yaml");
  if (!fs.existsSync(f)) return new Map();
  const text = fs.readFileSync(f, "utf-8");
  const map = new Map();          // slide id -> [chapter ids]
  let chapter = null;
  for (const line of text.split(/\r?\n/)) {
    const c = /^\s*-\s*id:\s*(\S+)/.exec(line);
    if (c) { chapter = c[1]; continue; }
    const s = /^\s*-\s*([a-z0-9][\w-]*)\s*$/.exec(line);
    if (s && chapter) {
      if (!map.has(s[1])) map.set(s[1], []);
      map.get(s[1]).push(chapter);
    }
  }
  return map;
}

test("every live slide is in exactly one chapter, and no retired slide is listed", () => {
  const { live, retired } = liveSlides();
  const membership = chapterMembership();
  const problems = [];
  for (const id of live) {
    const inCh = membership.get(id) || [];
    if (inCh.length === 0) problems.push(`${id} is live but in no chapter`);
    if (inCh.length > 1) problems.push(`${id} is in ${inCh.length} chapters (${inCh.join(", ")})`);
  }
  for (const id of retired) {
    if ((membership.get(id) || []).length) problems.push(`${id} is retired but still listed in a chapter`);
  }
  for (const id of membership.keys()) {
    if (!live.has(id) && !retired.has(id)) problems.push(`chapters.yaml lists ${id}, which has no folder`);
  }
  assert.deepEqual(problems, [], problems.join("\n  "));
});

// What a recipe PROPOSES must be buildable. What it REMEMBERS may name
// anything — a Learnings entry explaining why a slide was retired has to be
// able to say its name. So the scan covers the prescriptive half only: the
// `picks:` front-matter and the skeleton table, never the prose below.
function prescriptivePart(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const picks = fm ? fm[1] : "";
  const skel = /\n##\s*Skeleton([^\n]*)\n([\s\S]*?)(?=\n##\s|\s*$)/i.exec(text);
  // A skeleton the recipe itself labels as not yet buildable is a design note,
  // not an instruction. `investor` names seven slides that were designed and
  // never made; saying so in the heading is the honest state, and is better
  // than deleting the thinking or pretending the type is ready.
  if (skel && /PROPOSED|NOT YET/i.test(skel[1])) return picks;
  return `${picks}\n${skel ? skel[2] : ""}`;
}

test("no recipe proposes a slide that is retired or does not exist", () => {
  // A deck-building intake reads these to propose a skeleton. Naming a retired
  // slide there means the first deck a new colleague builds is already wrong.
  const dir = R("types");
  if (!fs.existsSync(dir)) return;
  const { live, retired } = liveSlides();
  const problems = [];
  for (const type of fs.readdirSync(dir)) {
    const f = path.join(dir, type, "recipe.md");
    if (!fs.existsSync(f)) continue;
    const part = prescriptivePart(fs.readFileSync(f, "utf-8"));
    const ids = new Set();
    // table cells: | n | role | slide-id | ... |  and  picks: `- slide-id`
    for (const m of part.matchAll(/^\s*\|[^|]*\|[^|]*\|\s*([a-z][a-z0-9-]{3,})\s*\|/gm)) ids.add(m[1]);
    for (const m of part.matchAll(/^\s*-\s*([a-z][a-z0-9-]{3,})\s*$/gm)) ids.add(m[1]);
    for (const m of part.matchAll(/`([a-z][a-z0-9-]{3,})`/g)) ids.add(m[1]);
    for (const id of ids) {
      // ch-* are CHAPTER ids (a `skips:` list names chapters, not slides); the
      // chapter test above owns those.
      if (id.startsWith("ch-")) continue;
      if (retired.has(id)) problems.push(`types/${type}/recipe.md proposes RETIRED slide '${id}'`);
      else if (!live.has(id) && /^[a-z]+(-[a-z0-9]+)+$/.test(id) && !["deck-title", "cover-meta"].includes(id)) {
        problems.push(`types/${type}/recipe.md proposes '${id}', which has no slide folder`);
      }
    }
  }
  assert.deepEqual(problems, [], `\n  ${problems.join("\n  ")}`);
});

// --- the app must not send an editor to a terminal -------------------------

test("no user-facing app string names a deck-building slash command", {
  // Deck Studio 5, phase 3: /deckbuilder and /new-deck become MCP tools and the
  // app stops telling editors to open a terminal. Five views still carry the old
  // prompt. Marked todo rather than deleted so the suite keeps reporting the
  // debt, and flipped to a hard assertion the moment those prompts are replaced.
  todo: "phase 3 replaces these prompts with the builder + MCP",
}, () => {
  // /deckbuilder and /new-deck were removed: building a deck is the app's job
  // and the MCP's job. A colleague who has never installed Claude Code must
  // never be shown a command to run.
  const webDir = R("app/web");
  if (!fs.existsSync(webDir)) return;
  const offenders = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!/\.(js|html|css)$/.test(f.name)) continue;
      const text = fs.readFileSync(p, "utf-8");
      for (const cmd of ["/deckbuilder", "/new-deck"]) {
        if (text.includes(cmd)) offenders.push(`${path.relative(ROOT, p)}: ${cmd}`);
      }
    }
  };
  walk(webDir);
  assert.deepEqual(offenders, [], `\n  ${offenders.join("\n  ")}`);
});

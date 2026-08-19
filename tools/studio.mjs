#!/usr/bin/env node
// The owner's CLI.
//
// Deck Studio 5, decision D1: there is ONE pipeline, and it is app/lib. This
// file is a thin shell over it -- it imports the same assemble, render, verify
// and publish the app imports, so there is nothing to keep in step. The Python
// pipeline it replaces was a second implementation of the same five gates, held
// to the first by two parity checks that nobody ran automatically, could not run
// offline, and could not run on a fresh clone.
//
// It is deliberately NOT the editor's surface. An editor builds decks in the app
// or through Claude over MCP; nothing here is needed for that. What lives here
// is owner work -- the library, the masters, the mirrors, the accounts -- plus
// the few utilities that are genuinely command-line shaped.
//
//   npm run studio -- <command> [options]
//
// Run with no arguments for the list.

import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const APP = path.join(REPO, "app", "lib");

const imp = (m) => import(`file:///${path.join(APP, m).replace(/\\/g, "/")}`);

// --- output ------------------------------------------------------------------

const isTTY = process.stdout.isTTY;
const c = (code, s) => (isTTY ? `[${code}m${s}[0m` : s);
const bold = (s) => c("1", s);
const dim = (s) => c("2", s);
const red = (s) => c("31", s);
const green = (s) => c("32", s);
const yellow = (s) => c("33", s);

const say = (s = "") => process.stdout.write(s + "\n");
function die(msg, code = 1) {
  process.stderr.write(red("error: ") + msg + "\n");
  process.exit(code);
}

// --- argument parsing ---------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, inline] = a.slice(2).split("=");
      if (inline !== undefined) flags[k] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

// --- commands -----------------------------------------------------------------

const COMMANDS = {};
const command = (name, summary, usage, fn) => { COMMANDS[name] = { name, summary, usage, fn }; };

command("verify", "Run the brand gate over a published artifact, a folder, or everything",
  "studio verify <slug> [--version N] | --dir <folder> | --all",
  async ({ positional, flags }) => {
    const { verifySnapshot } = await imp("verify.mjs");
    const db = await imp("supabase.mjs");

    // --all sweeps the live corpus. Worth having as a command rather than a
    // one-off script because a rule can be broken by something OTHER than a
    // build: reclassifying an image's entitlement retroactively invalidates
    // every artifact already carrying it, and nothing in the drift system looks
    // backwards. That is not hypothetical -- it is how a Holliday-entitled
    // screenshot ended up inside a carousel cleared `public`.
    if (flags.all) {
      const decks = await db.selectAll("decks", {
        select: "id,slug,kind,archived,current_version_n", order: "kind.asc",
      });
      const customers = await db.select("customers", { select: "slug,name" }).catch(() => []);
      const bad = [];
      let checked = 0;
      for (const d of decks) {
        if (d.archived || !d.current_version_n) continue;
        const [v] = await db.select("deck_versions",
          { deck_id: `eq.${d.id}`, n: `eq.${d.current_version_n}`, select: "html,pdf_object" });
        if (!v) continue;
        let pdfBytes = null, pdfName = "";
        if (v.pdf_object) {
          pdfName = path.basename(v.pdf_object).replace(/^v\d+_/, "");
          try { pdfBytes = await db.download(v.pdf_object); } catch { /* check the document anyway */ }
        }
        const r = await verifySnapshot({ html: v.html, pdfBytes, pdfName, customers });
        checked++;
        if (r.fails.length) {
          bad.push({ slug: d.slug, kind: d.kind, entries: r.entries.filter((e) => e.level === "fail") });
        }
      }
      say("");
      for (const b of bad) {
        say(`  ${red("FAIL")}  ${b.kind.padEnd(9)} ${bold(b.slug)}`);
        for (const e of b.entries) say(`          ${dim(`[${e.code}]`)} ${e.msg}`);
      }
      say("");
      say(`${checked} artifacts checked, ${green(`${checked - bad.length} pass`)}` +
          (bad.length ? `, ${red(`${bad.length} FAIL`)}` : ""));
      process.exit(bad.length ? 1 : 0);
    }

    let html, pdfBytes = null, pdfName = "";
    if (flags.dir) {
      const dir = path.resolve(flags.dir);
      html = await fsp.readFile(path.join(dir, "index.html"), "utf-8");
      const pdf = (await fsp.readdir(dir)).find((f) => f.endsWith(".pdf"));
      if (pdf) { pdfName = pdf; pdfBytes = await fsp.readFile(path.join(dir, pdf)); }
    } else {
      const slug = positional[0];
      if (!slug) die("which artifact? `studio verify <slug>` or `--dir <folder>`");
      const [deck] = await db.select("decks", { slug: `eq.${slug}`, select: "id,current_version_n" });
      if (!deck) die(`no artifact with slug "${slug}"`);
      const n = Number(flags.version) || deck.current_version_n;
      const [v] = await db.select("deck_versions",
        { deck_id: `eq.${deck.id}`, n: `eq.${n}`, select: "html,pdf_object" });
      if (!v) die(`"${slug}" has no version ${n}`);
      html = v.html;
      if (v.pdf_object) {
        pdfName = path.basename(v.pdf_object).replace(/^v\d+_/, "");
        try { pdfBytes = await db.download(v.pdf_object); } catch { /* verify without it */ }
      }
    }

    const customers = await db.select("customers", { select: "slug,name" }).catch(() => []);
    const report = await verifySnapshot({ html, pdfBytes, pdfName, customers });
    printReport(report);
    process.exit(report.fails.length ? 1 : 0);
  });

command("fetch", "Download a published artifact to a folder",
  "studio fetch <slug> [--version N] [--out DIR]",
  async ({ positional, flags }) => {
    const db = await imp("supabase.mjs");
    const slug = positional[0];
    if (!slug) die("which artifact? `studio fetch <slug>`");
    const [deck] = await db.select("decks", { slug: `eq.${slug}`, select: "id,current_version_n" });
    if (!deck) die(`no artifact with slug "${slug}"`);
    const n = Number(flags.version) || deck.current_version_n;
    const [v] = await db.select("deck_versions",
      { deck_id: `eq.${deck.id}`, n: `eq.${n}`, select: "html" });
    if (!v) die(`"${slug}" has no version ${n}`);

    const out = path.resolve(flags.out || path.join(REPO, ".scratch", "fetched", `${slug}-v${n}`));
    await fsp.mkdir(path.join(out, "assets"), { recursive: true });
    await fsp.writeFile(path.join(out, "index.html"), v.html, "utf-8");

    const assets = await db.select("deck_assets", { deck_id: `eq.${deck.id}`, select: "filename,storage_object" });
    let got = 0;
    for (const a of assets) {
      try {
        await fsp.writeFile(path.join(out, "assets", a.filename), await db.download(a.storage_object));
        got++;
      } catch (e) {
        say(yellow(`  ! ${a.filename}: ${e.message}`));
      }
    }
    say(`${green("fetched")} ${slug} v${n} -> ${path.relative(REPO, out)}  (${got}/${assets.length} assets)`);
  });

command("build", "Build and publish an artifact from a recipe file",
  "studio build <recipe.json> [--dry-run]",
  async ({ positional, flags }) => {
    const file = positional[0];
    if (!file) die("which recipe? `studio build <recipe.json>`");
    const recipe = JSON.parse(await fsp.readFile(path.resolve(file), "utf-8"));
    const jobs = await imp("jobs.mjs");
    const r = await jobs.buildFromRecipe(recipe, {
      dryRun: Boolean(flags["dry-run"]),
      onStep: (s) => {
        const mark = s.state === "ok" ? green("ok") : s.state === "fail" ? red("FAIL")
          : s.state === "skip" ? dim("skip") : dim("..");
        say(`  ${String(s.step).padEnd(9)} ${mark}  ${dim(s.detail || "")}`);
      },
    });
    if (r.verify_report) printReport(r.verify_report);
    if (!r.ok) die(r.error || "the build did not pass");
    if (flags["dry-run"]) {
      say(`${green("checked")} — it would build and pass. Nothing was published.`);
      return;
    }
    say(`${green("published")} ${r.deck?.slug} v${r.deck?.version}`);
  });

command("sync-library", "Mirror library/ into the backend so the hosted app sees it",
  "studio sync-library [--check]",
  async ({ flags }) => {
    const { syncLibrary } = await imp("library.mjs");
    const r = await syncLibrary({ check: Boolean(flags.check) });
    if (flags.check) {
      if (r.stale.length) {
        say(red(`${r.stale.length} slide(s) differ from the mirror:`));
        for (const s of r.stale) say(`  ${s}`);
        say(dim("\nRun `npm run studio -- sync-library` to bring the backend up to date."));
        process.exit(1);
      }
      say(green(`the mirror matches the repo (${r.slides} slides, ${r.chapters} chapters)`));
      return;
    }
    say(`${green("synced")} ${r.slides} slides, ${r.chapters} chapters` +
        (r.archivedBack ? `, promoted ${r.archivedBack} archive flag(s) back into meta.yaml` : ""));
  });

command("users", "List, add and manage accounts",
  "studio users list | add <email> [--name N] [--role R] | password <email> | role <email> <role> | disable <email> | enable <email>",
  async ({ positional, flags }) => {
    const { usersCommand } = await imp("accounts.mjs");
    await usersCommand(positional, flags, { say, die, green, dim, yellow });
  });

command("doctor", "Check that this machine can run the pipeline",
  "studio doctor",
  async () => {
    const { supabaseConfigured, supabaseUrl } = await imp("env.mjs");
    const render = await imp("render.mjs");

    const rows = [];
    rows.push(["node", process.version, true]);

    const browser = render.rendererName ? render.rendererName() : "";
    let hasBrowser = false;
    try { hasBrowser = Boolean(browser && !/none/i.test(browser)); } catch {}
    rows.push(["browser", hasBrowser ? browser : "not found", hasBrowser]);

    const cfg = supabaseConfigured();
    rows.push(["backend", cfg ? supabaseUrl() : "SUPABASE_URL / SUPABASE_SECRET_KEY missing in .env", cfg]);

    if (cfg) {
      const db = await imp("supabase.mjs");
      try {
        const d = await db.select("decks", { select: "slug", limit: "1" });
        rows.push(["backend read", `ok (${d.length ? d[0].slug : "empty"})`, true]);
      } catch (e) {
        rows.push(["backend read", e.message.slice(0, 60), false]);
      }
    }

    const lib = fs.existsSync(path.join(REPO, "library", "slides"));
    rows.push(["library on disk", lib ? "yes" : "no (owner commands need the repo)", lib]);

    say("");
    for (const [k, v, ok] of rows) {
      say(`  ${ok ? green("ok  ") : red("FAIL")}  ${bold(k.padEnd(16))} ${dim(v)}`);
    }
    say("");
    const bad = rows.filter((r) => !r[2]).length;
    if (bad) {
      say(yellow(`${bad} problem(s). The pipeline needs Node and a Chrome or Edge; ` +
                 `everything else is per-command.`));
      process.exit(1);
    }
    say(green("this machine can build, verify and publish."));
  });

// --- report printing ----------------------------------------------------------

function printReport(report) {
  const fails = report.entries?.filter((e) => e.level === "fail") || [];
  const warns = report.entries?.filter((e) => e.level === "warn") || [];
  if (!fails.length && !warns.length) { say(green("  verify: clean")); return; }
  for (const e of fails) say(`  ${red("FAIL")} ${dim(`[${e.code}]`)} ${e.msg}`);
  for (const e of warns) say(`  ${yellow("warn")} ${dim(`[${e.code}]`)} ${e.msg}`);
  say(`  ${fails.length} fail, ${warns.length} warn`);
}

// --- entry --------------------------------------------------------------------

function usage() {
  say("");
  say(bold("Deck Studio") + dim(" — the owner's CLI"));
  say("");
  say(dim("  Editors build decks in the app or through Claude (Settings -> Connect Claude)."));
  say(dim("  What lives here is owner work: the library, the masters, accounts."));
  say("");
  say(bold("  usage: ") + "npm run studio -- <command> [options]");
  say("");
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  for (const cmd of Object.values(COMMANDS)) {
    say(`  ${bold(cmd.name.padEnd(width))}  ${cmd.summary}`);
    say(`  ${" ".repeat(width)}  ${dim(cmd.usage)}`);
  }
  say("");
}

const argv = process.argv.slice(2);
if (!argv.length || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
  usage();
  process.exit(0);
}

const name = argv[0];
const cmd = COMMANDS[name];
if (!cmd) {
  const near = Object.keys(COMMANDS).filter((k) => k.startsWith(name[0]));
  die(`no command "${name}".` + (near.length ? ` Did you mean: ${near.join(", ")}?` : "") +
      `\nRun \`npm run studio\` for the list.`);
}

try {
  await cmd.fn(parseArgs(argv.slice(1)));
} catch (e) {
  die(e?.stack || String(e));
}

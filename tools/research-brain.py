#!/usr/bin/env python3
"""Rebuild the Last-30-days brain from every recorded run.

The brain is the studio's accumulated understanding of the topics we research.
Each `/last30days` run is written to research/last30days/runs/<slug>/run.json as
structured knowledge (themes, vocabulary, stats, entities, quotes, questions).
This tool folds every run into two artifacts:

    research/last30days/brain.json   machine-readable, what the app reads
    research/last30days/brain.md     the readable brain document

It is deterministic and idempotent: run it after every new research run and the
brain grows. Nothing is hand-edited in the outputs; the runs are the source of
truth, so a wrong run can be corrected and the brain rebuilt.

Corroboration is the point. A theme seen in one run is `emerging`; seen in two
it is `corroborated`; three or more and it is `established`. That is how the
brain gets more confident over time instead of just longer.

Usage:
    python tools/research-brain.py            # rebuild
    python tools/research-brain.py --check    # exit 1 if outputs are stale
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import OrderedDict
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BRAIN_DIR = REPO / "research" / "last30days"
RUNS_DIR = BRAIN_DIR / "runs"
BRAIN_JSON = BRAIN_DIR / "brain.json"
BRAIN_MD = BRAIN_DIR / "brain.md"
PERFORMANCE = BRAIN_DIR / "performance.json"

CONFIDENCE = ["emerging", "corroborated", "established"]


def confidence_for(n: int) -> str:
    return CONFIDENCE[min(n, len(CONFIDENCE)) - 1] if n else "emerging"


def load_runs() -> list[dict]:
    runs = []
    if not RUNS_DIR.exists():
        return runs
    for d in sorted(RUNS_DIR.iterdir()):
        f = d / "run.json"
        if not f.is_file():
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise SystemExit(f"FAIL {f.relative_to(REPO)}: invalid JSON ({e})")
        data["slug"] = data.get("slug") or d.name
        data["_dir"] = d.name
        data["_has_raw"] = (d / "raw.md").is_file()
        data["_has_brief"] = (d / "brief.html").is_file()
        runs.append(data)
    runs.sort(key=lambda r: (r.get("date", ""), r["slug"]))
    return runs


def merge_themes(runs: list[dict]) -> list[dict]:
    out: OrderedDict[str, dict] = OrderedDict()
    for r in runs:
        for t in r.get("themes", []):
            tid = t.get("id")
            if not tid:
                continue
            cur = out.setdefault(tid, {"id": tid, "runs": [], "topics": []})
            # Latest run wins on wording; earlier runs still count for corroboration.
            cur["label"] = t.get("label", cur.get("label", tid))
            cur["summary"] = t.get("summary", cur.get("summary", ""))
            cur["stance"] = t.get("stance", cur.get("stance", "observed"))
            cur["runs"].append(r["slug"])
            if r.get("topic") and r["topic"] not in cur["topics"]:
                cur["topics"].append(r["topic"])
            cur["first_seen"] = cur.get("first_seen") or r.get("date", "")
            cur["last_seen"] = r.get("date", "")
    themes = list(out.values())
    for t in themes:
        t["seen"] = len(t["runs"])
        t["confidence"] = confidence_for(t["seen"])
    # Most-corroborated first, then actionable stances, then alphabetical.
    stance_rank = {"actionable": 0, "risk": 1, "caution": 2, "observed": 3}
    themes.sort(key=lambda t: (-t["seen"], stance_rank.get(t["stance"], 9), t["label"]))
    return themes


def merge_vocabulary(runs: list[dict]) -> list[dict]:
    out: OrderedDict[str, dict] = OrderedDict()
    for r in runs:
        for v in r.get("vocabulary", []):
            term = (v.get("term") or "").strip()
            if not term:
                continue
            key = term.lower()
            cur = out.setdefault(key, {"term": term, "runs": [], "notes": []})
            cur["kind"] = v.get("kind", cur.get("kind", ""))
            note = (v.get("note") or "").strip()
            if note and note not in cur["notes"]:
                cur["notes"].append(note)
            cur["runs"].append(r["slug"])
            cur["first_seen"] = cur.get("first_seen") or r.get("date", "")
    vocab = list(out.values())
    for v in vocab:
        v["seen"] = len(v["runs"])
    kind_rank = {
        "search-term": 0, "category-term": 1, "analyst-term": 2, "framing": 3,
        "hype-term": 4, "own-positioning": 5, "own-product": 6,
    }
    vocab.sort(key=lambda v: (kind_rank.get(v.get("kind", ""), 9), -v["seen"], v["term"].lower()))
    return vocab


def merge_simple(runs: list[dict], field: str, key_fn) -> list[dict]:
    """Dedupe a per-run list of dicts by key_fn, recording which runs saw it."""
    out: OrderedDict[str, dict] = OrderedDict()
    for r in runs:
        for item in r.get(field, []):
            k = key_fn(item)
            if not k:
                continue
            cur = out.get(k)
            if cur is None:
                cur = dict(item)
                cur["runs"] = []
                out[k] = cur
            cur["runs"].append(r["slug"])
    for v in out.values():
        v["seen"] = len(v["runs"])
    return list(out.values())


def load_performance() -> dict:
    """Engagement per posted item, keyed by draft slug. Optional: no posts yet is
    the normal state for a young brain, not an error."""
    if not PERFORMANCE.exists():
        return {"posts": {}}
    try:
        return json.loads(PERFORMANCE.read_text(encoding="utf-8")) or {"posts": {}}
    except json.JSONDecodeError as e:
        raise SystemExit(f"FAIL {PERFORMANCE.relative_to(REPO)}: invalid JSON ({e})")


def latest_sample(rec: dict) -> dict | None:
    samples = sorted(rec.get("samples") or [], key=lambda s: s.get("date", ""))
    return samples[-1] if samples else None


def theme_validation(perf: dict) -> dict[str, dict]:
    """Roll engagement up to the theme a post came from.

    This is the second confidence axis. `confidence` says the evidence repeated;
    validation says an audience actually responded. A theme can be established
    and still land flat, and that is the most useful thing the brain can tell us.
    Only posts with a recorded reading count, so an unposted draft never drags a
    theme's average down.
    """
    out: dict[str, dict] = {}
    for rec in (perf.get("posts") or {}).values():
        s = latest_sample(rec)
        if not s:
            continue
        for tid in rec.get("themes") or []:
            v = out.setdefault(tid, {"posts": 0, "impressions": 0, "likes": 0, "comments": 0, "best": None})
            v["posts"] += 1
            for k in ("impressions", "likes", "comments"):
                v[k] += int(s.get(k) or 0)
            score = int(s.get("likes") or 0) + 3 * int(s.get("comments") or 0)
            if v["best"] is None or score > v["best"]["score"]:
                v["best"] = {"slug": rec.get("slug"), "title": rec.get("title"), "score": score, "url": rec.get("url", "")}
    for v in out.values():
        # Comments cost more than likes, so they weigh more. Per post, so a theme
        # with one strong post is not beaten by a theme with three weak ones.
        v["engagement_per_post"] = round((v["likes"] + 3 * v["comments"]) / max(v["posts"], 1), 1)
    return out


def coverage(runs: list[dict]) -> dict:
    totals: dict[str, int] = {}
    missing: dict[str, int] = {}
    degraded: dict[str, int] = {}
    for r in runs:
        s = r.get("sources", {})
        for k, n in (s.get("counts") or {}).items():
            totals[k] = totals.get(k, 0) + int(n or 0)
        for k in s.get("missing") or []:
            missing[k] = missing.get(k, 0) + 1
        for k in s.get("degraded") or []:
            degraded[k] = degraded.get(k, 0) + 1
    return {
        "items_by_source": dict(sorted(totals.items(), key=lambda kv: -kv[1])),
        "total_items": sum(totals.values()),
        "missing_in_runs": dict(sorted(missing.items(), key=lambda kv: -kv[1])),
        "degraded_in_runs": dict(sorted(degraded.items(), key=lambda kv: -kv[1])),
    }


def build(runs: list[dict]) -> dict:
    perf = load_performance()
    validation = theme_validation(perf)
    themes = merge_themes(runs)
    for t in themes:
        v = validation.get(t["id"])
        t["validation"] = v or None
        # published-but-flat is a real state and must not read as "not tried yet"
        t["audience"] = "untested" if not v else ("resonant" if v["engagement_per_post"] >= 40 else "flat")

    posts = list((perf.get("posts") or {}).values())
    return {
        "generated": date.today().isoformat(),
        "generator": "tools/research-brain.py",
        "runs": [
            {
                "slug": r["slug"], "date": r.get("date", ""), "topic": r.get("topic", ""),
                "question": r.get("question", ""), "domain": r.get("domain", ""),
                "verdict": r.get("verdict", ""), "headline": r.get("headline", ""),
                "engine": r.get("engine", {}), "sources": r.get("sources", {}),
                "findings": r.get("findings", []), "caveats": r.get("caveats", []),
                "has_raw": r["_has_raw"], "has_brief": r["_has_brief"],
                "counts": {
                    "findings": len(r.get("findings", [])), "themes": len(r.get("themes", [])),
                    "vocabulary": len(r.get("vocabulary", [])), "stats": len(r.get("stats", [])),
                    "entities": len(r.get("entities", [])), "quotes": len(r.get("quotes", [])),
                },
            }
            for r in runs
        ],
        "themes": themes,
        "performance": {
            "posts": sorted(posts, key=lambda r: (r.get("posted_date") or "", r.get("slug") or "")),
            "posted": sum(1 for r in posts if r.get("url")),
            "measured": sum(1 for r in posts if latest_sample(r)),
            "by_theme": validation,
        },
        "vocabulary": merge_vocabulary(runs),
        "stats": merge_simple(runs, "stats", lambda s: f"{s.get('value')}|{s.get('label')}"),
        "entities": merge_simple(runs, "entities", lambda e: (e.get("name") or "").lower()),
        "quotes": merge_simple(runs, "quotes", lambda q: (q.get("text") or "")[:80].lower()),
        "open_questions": [
            {"question": q, "run": r["slug"], "topic": r.get("topic", "")}
            for r in runs for q in r.get("open_questions", [])
        ],
        "coverage": coverage(runs),
    }


# --- markdown rendering -------------------------------------------------------

def md(brain: dict) -> str:
    L: list[str] = []
    runs = brain["runs"]
    themes = brain["themes"]
    vocab = brain["vocabulary"]

    L.append("# The Last-30-days brain")
    L.append("")
    L.append(
        f"_Generated {brain['generated']} by `tools/research-brain.py` from "
        f"{len(runs)} run{'s' if len(runs) != 1 else ''}. Do not hand-edit: correct the run "
        "and rebuild._"
    )
    L.append("")
    L.append(
        "This is the studio's accumulated understanding of what people are saying in the "
        "markets we care about. Every `/last30days` run folds into it. A theme seen once is "
        "**emerging**, twice is **corroborated**, three times or more is **established**."
    )
    L.append("")

    est = sum(1 for t in themes if t["confidence"] == "established")
    cor = sum(1 for t in themes if t["confidence"] == "corroborated")
    L.append(
        f"**State of the brain.** {len(runs)} runs · {len(themes)} themes "
        f"({est} established, {cor} corroborated) · {len(vocab)} tracked terms · "
        f"{len(brain['stats'])} sourced stats · {len(brain['entities'])} entities · "
        f"{len(brain['open_questions'])} open questions · "
        f"{brain['coverage']['total_items']} evidence items · "
        f"{brain.get('performance', {}).get('measured', 0)} measured posts."
    )
    L.append("")

    L.append("## What we believe")
    L.append("")
    if not themes:
        L.append("_No themes yet. Run `/last30days <topic>` and record it._")
    for t in themes:
        L.append(f"### {t['label']}")
        L.append("")
        aud = t.get("audience", "untested")
        v = t.get("validation")
        aud_txt = (
            f" · audience **{aud}** ({v['engagement_per_post']} eng/post over {v['posts']} post"
            f"{'s' if v['posts'] != 1 else ''})" if v else " · audience untested"
        )
        L.append(f"`{t['confidence']}` · seen in {t['seen']} run{'s' if t['seen'] != 1 else ''} · {t['stance']}{aud_txt}")
        L.append("")
        L.append(t["summary"])
        L.append("")
        L.append(f"_Topics: {', '.join(t['topics']) or 'n/a'}. First seen {t['first_seen']}, last {t['last_seen']}._")
        L.append("")

    perf = brain.get("performance", {})
    L.append("## What the audience did with it")
    L.append("")
    if not perf.get("posts"):
        L.append(
            "_Nothing promoted yet. Promote an idea from the Last 30 days page, post it, "
            "record the link and the numbers, and every theme gains a second confidence axis: "
            "not just whether the evidence repeated, but whether anyone responded._"
        )
        L.append("")
    else:
        L.append(
            f"{len(perf['posts'])} promoted · {perf.get('posted', 0)} posted · "
            f"{perf.get('measured', 0)} with a recorded reading. Engagement per post weights a "
            "comment as three likes, because a comment costs more to give."
        )
        L.append("")
        L.append("| Post | Posted | Impressions | Likes | Comments | Themes |")
        L.append("|---|---|---|---|---|---|")
        for r in perf["posts"]:
            s = latest_sample(r) or {}
            n = lambda k: (s.get(k) if s.get(k) is not None else "-")
            title = f"[{r.get('title', r.get('slug'))}]({r['url']})" if r.get("url") else r.get("title", r.get("slug"))
            L.append(
                f"| {title} | {r.get('posted_date') or 'not yet'} | {n('impressions')} | "
                f"{n('likes')} | {n('comments')} | {', '.join(r.get('themes') or []) or '-'} |"
            )
        L.append("")
        by_theme = perf.get("by_theme") or {}
        if by_theme:
            L.append("**Which beliefs earn attention.** Ranked by engagement per post.")
            L.append("")
            for tid, v in sorted(by_theme.items(), key=lambda kv: -kv[1]["engagement_per_post"]):
                label = next((t["label"] for t in themes if t["id"] == tid), tid)
                best = v.get("best") or {}
                L.append(
                    f"- **{label}** - {v['engagement_per_post']} eng/post across {v['posts']} post"
                    f"{'s' if v['posts'] != 1 else ''}"
                    + (f", best: {best.get('title', '')}" if best.get("title") else "")
                )
            L.append("")

    L.append("## The vocabulary")
    L.append("")
    L.append("The words the market actually uses, grouped by who uses them.")
    L.append("")
    by_kind: OrderedDict[str, list[dict]] = OrderedDict()
    for v in vocab:
        by_kind.setdefault(v.get("kind") or "other", []).append(v)
    for kind, items in by_kind.items():
        L.append(f"**{kind}**")
        L.append("")
        for v in items:
            note = f" - {v['notes'][0]}" if v.get("notes") else ""
            L.append(f"- `{v['term']}`{note}")
        L.append("")

    L.append("## Sourced numbers")
    L.append("")
    L.append("Every stat carries its source. Verify commercial facts before reuse.")
    L.append("")
    for s in brain["stats"]:
        src = s.get("source", "")
        url = s.get("url", "")
        cite = f"[{src}]({url})" if url else src
        when = f" ({s['date']})" if s.get("date") else ""
        L.append(f"- **{s.get('value')}** - {s.get('label')} - {cite}{when}")
    L.append("")

    L.append("## Who is in this market")
    L.append("")
    ents: OrderedDict[str, list[dict]] = OrderedDict()
    for e in brain["entities"]:
        ents.setdefault(e.get("kind") or "other", []).append(e)
    for kind, items in ents.items():
        L.append(f"**{kind}**")
        L.append("")
        for e in items:
            L.append(f"- **{e['name']}** - {e.get('note', '')}")
        L.append("")

    if brain["quotes"]:
        L.append("## Voices worth quoting")
        L.append("")
        for q in brain["quotes"]:
            attrib = q.get("author", "")
            weight = f", {q['weight']}" if q.get("weight") else ""
            url = q.get("url", "")
            tail = f" [link]({url})" if url else ""
            L.append(f"> {q['text']}")
            L.append(">")
            L.append(f"> - {attrib}{weight}{tail}")
            L.append("")

    L.append("## Open questions")
    L.append("")
    L.append("What the brain does not know yet. Each one is a candidate for the next run.")
    L.append("")
    for q in brain["open_questions"]:
        L.append(f"- {q['question']} _({q['topic']})_")
    L.append("")

    L.append("## Run log")
    L.append("")
    L.append("| Date | Topic | Verdict | Evidence | Artifacts |")
    L.append("|---|---|---|---|---|")
    for r in runs:
        counts = r.get("sources", {}).get("counts", {})
        n = sum(int(v or 0) for v in counts.values())
        arts = " ".join(x for x in [("raw" if r["has_raw"] else ""), ("brief" if r["has_brief"] else "")] if x)
        L.append(f"| {r['date']} | {r['topic']} | {r['verdict']} | {n} items | {arts} |")
    L.append("")

    cov = brain["coverage"]
    L.append("## Coverage health")
    L.append("")
    L.append("Which sources are actually feeding the brain, and which keep going missing.")
    L.append("")
    for k, v in cov["items_by_source"].items():
        L.append(f"- **{k}**: {v} items")
    if cov["missing_in_runs"]:
        L.append("")
        L.append("Missing sources, by number of runs affected:")
        L.append("")
        for k, v in cov["missing_in_runs"].items():
            L.append(f"- **{k}**: absent in {v} run{'s' if v != 1 else ''}")
    if cov["degraded_in_runs"]:
        L.append("")
        L.append("Degraded (rate-limited or partial) sources:")
        L.append("")
        for k, v in cov["degraded_in_runs"].items():
            L.append(f"- **{k}**: degraded in {v} run{'s' if v != 1 else ''}")
    L.append("")
    return "\n".join(L) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Rebuild the Last-30-days brain from recorded runs.")
    ap.add_argument("--check", action="store_true", help="exit 1 if the outputs are stale")
    args = ap.parse_args()

    runs = load_runs()
    if not runs:
        print(f"No runs found under {RUNS_DIR.relative_to(REPO)}. Nothing to build.")
        return 0

    brain = build(runs)
    out_json = json.dumps(brain, indent=2, ensure_ascii=False) + "\n"
    out_md = md(brain)

    if args.check:
        stale = []
        for path, content in ((BRAIN_JSON, out_json), (BRAIN_MD, out_md)):
            old = path.read_text(encoding="utf-8") if path.exists() else ""
            # `generated` changes daily; compare everything else.
            if path.suffix == ".json":
                try:
                    a, b = json.loads(old or "{}"), json.loads(content)
                    a.pop("generated", None); b.pop("generated", None)
                    if a != b:
                        stale.append(path.name)
                except json.JSONDecodeError:
                    stale.append(path.name)
            elif old.split("\n", 3)[3:] != content.split("\n", 3)[3:]:
                stale.append(path.name)
        if stale:
            print("STALE: " + ", ".join(stale) + " - run: python tools/research-brain.py")
            return 1
        print("Brain is up to date.")
        return 0

    BRAIN_DIR.mkdir(parents=True, exist_ok=True)
    BRAIN_JSON.write_text(out_json, encoding="utf-8")
    BRAIN_MD.write_text(out_md, encoding="utf-8")

    t = brain["themes"]
    print(f"Brain rebuilt from {len(runs)} run(s).")
    print(f"  themes      {len(t)} ({sum(1 for x in t if x['confidence'] != 'emerging')} corroborated or better)")
    print(f"  vocabulary  {len(brain['vocabulary'])}")
    print(f"  stats       {len(brain['stats'])}")
    print(f"  entities    {len(brain['entities'])}")
    print(f"  questions   {len(brain['open_questions'])}")
    print(f"  -> {BRAIN_JSON.relative_to(REPO)}")
    print(f"  -> {BRAIN_MD.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

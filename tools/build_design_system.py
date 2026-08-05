#!/usr/bin/env python
"""
Generate the design-system specimens under library/design-system/. Each specimen
is a small self-contained page that renders a token/block/pattern using the REAL
stylesheets (templates/deck.css + showcase.css), so the design system can never
drift from what ships. First line is an @dsCard marker for the claude.ai/design
Design System pane. Also writes library/design-system/index.html.

Entry point is tools/build-design-system.ps1 (shim); or:  python tools/build_design_system.py
"""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DS = ROOT / "library" / "design-system"
# specimens sit 3 deep (library/design-system/<group>/), so assets are ../../../
A = "../../../"

PAGE = """<!DOCTYPE html>
<!-- @dsCard group="{group}" -->
<html lang="en">
<head>
<meta charset="utf-8">
<title>Oppr DS · {title}</title>
<link rel="stylesheet" href="{a}templates/deck.css">
<link rel="stylesheet" href="{a}templates/showcase.css">
</head>
<body>
<div class="deck">
<section class="slide{mod}">
{inner}
</section>
</div>
</body>
</html>
"""


def colors_inner() -> str:
    toks = [("--bg", "#f2f2ed", "warm paper"), ("--surface", "#fcfbf7", "raised card"),
            ("--ink", "#15201e", "near-black"), ("--muted", "#5f6965", "secondary"),
            ("--line", "#c8ceca", "hairline"), ("--accent", "#a65032", "terracotta · human"),
            ("--machine", "#3e6874", "teal · machine"), ("--verified", "#55745e", "green · verified")]
    sw = []
    for name, hexv, use in toks:
        sw.append(
            f"<div style='width:150px'><div style='height:78px;border-radius:10px;"
            f"background:var({name});border:1px solid var(--line)'></div>"
            f"<div class='mono' style='font-size:12px;margin-top:8px'>{name}<br>{hexv}"
            f"<br><span style='color:var(--muted)'>{use}</span></div></div>")
    return ("<p class='eyebrow'>Foundations &middot; Color tokens</p><h2>Palette</h2>"
            "<div style='display:flex;gap:16px;flex-wrap:wrap;margin-top:16px'>" + "".join(sw) + "</div>"
            "<p class='fact-strip' style='margin-top:26px'><span>one accent per element</span>"
            "<span>no gradients on marks</span><span>no second accent</span></p>")


TYPE_INNER = """<p class="eyebrow">Foundations &middot; Type</p>
<h1>Heading one</h1>
<h2>Heading two</h2>
<h3>Heading three</h3>
<p class="lede">Lede: how manufacturing companies turn the knowledge of their best operators into measured, repeatable improvement.</p>
<p class="subcopy">Subcopy sits under a heading and carries the supporting sentence at a calm, readable size.</p>
<p class="mono" style="font-size:13px;margin-top:8px">JetBrains Mono &middot; tabular numerals &middot; &euro; 25.000 &middot; 0,5%</p>
<p style="margin-top:10px">Two-voice keywords: <span class="k-h">Capture</span> &middot; <span class="k-m">Connect</span> &middot; <span class="k-v">Execute</span>.</p>"""

CARDS_INNER = """<p class="eyebrow">Blocks &middot; grid2 + g2ico</p><h2>Icon cards (2&times;2)</h2>
<div class="grid2">
  <div class="card"><span class="g2ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg></span><h3>Results inside one quarter</h3><p>From first data access to a verified improvement in roughly 90 days.</p></div>
  <div class="card"><span class="g2ico"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><line x1="3" y1="10.5" x2="21" y2="10.5"/></svg></span><h3>Operating cost, not capex</h3><p>No hardware, no integration project. A fixed fee within local mandate.</p></div>
  <div class="card"><span class="g2ico"><svg viewBox="0 0 24 24"><line x1="5" y1="20" x2="5" y2="14"/><line x1="12" y1="20" x2="12" y2="9"/><line x1="19" y1="20" x2="19" y2="4"/></svg></span><h3>EBITDA levers you own</h3><p>Scrap, unplanned stops, changeover losses, reporting hours.</p></div>
  <div class="card"><span class="g2ico"><svg viewBox="0 0 24 24"><path d="M17 3l3.5 3.5L17 10"/><path d="M20.5 6.5H9A5 5 0 0 0 4 11.5"/><path d="M7 21l-3.5-3.5L7 14"/><path d="M3.5 17.5H15a5 5 0 0 0 5-5"/></svg></span><h3>A repeatable playbook</h3><p>The same method transfers from line to line and site to site.</p></div>
</div>"""

STATS_INNER = """<p class="eyebrow">Blocks &middot; stat-grid</p><h2>Figures</h2>
<div class="stat-grid" style="max-width:560px">
  <div class="stat"><strong>30%</strong><span>less scrap on the line under investigation</span></div>
  <div class="stat"><strong>40%</strong><span>fewer stoppages from the recurring fault</span></div>
  <div class="stat"><strong>5 hrs/wk</strong><span>less reporting time reconstructing the shift</span></div>
  <div class="stat"><strong>90 days</strong><span>from kickoff to implemented value</span></div>
</div>"""

TAGS_INNER = """<p class="eyebrow">Blocks &middot; tag</p><h2>Chips</h2>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">
  <span class="tag">default</span>
  <span class="tag tag--h">human</span>
  <span class="tag tag--m">machine</span>
  <span class="tag tag--v">verified</span>
</div>
<p class="subcopy" style="margin-top:22px">Used as small mono labels above a card heading or on a project row.</p>"""

QUOTES_INNER = """<p class="eyebrow">Blocks &middot; quotes</p><h2>Evidence card</h2>
<div class="quotes" style="max-width:420px">
  <div class="qc">
    <span class="mark">&ldquo;</span>
    <blockquote>Two weeks after starting with Oppr, our operators captured more useful information than we&rsquo;d collected in the previous decade.</blockquote>
    <p class="did-lbl">What we did</p>
    <ul><li>Connected ERP quality data, Excel parameters and LIMS results</li><li>Surfaced the golden recipe behind first-time-right output</li></ul>
    <p class="att">Operations Director<br>PVC extrusion &middot; Netherlands</p>
  </div>
</div>"""

RUNGS_INNER = """<p class="eyebrow">Blocks &middot; rungs (ascending ladder)</p><h2>Analyze &middot; Prove &middot; Scale</h2>
<div class="rungs">
  <div class="rung s1"><span class="rn">Step 1 &middot; Analyze</span><h3>Historical data analysis</h3><p class="rp">&euro; 10.000<small>fixed &middot; 2&ndash;3 weeks &middot; 100% credited</small></p><p>Your blind spots and payback, from data you already have.</p></div>
  <div class="rung s2"><span class="rn">Step 2 &middot; Prove</span><h3>The 10-Week Proof</h3><p class="rp">&euro; 25.000<small>fixed, all-in</small></p><p>One line, one blind spot, criteria signed up front.</p></div>
  <div class="rung s3"><span class="rn">Step 3 &middot; Scale</span><h3>Annual agreement</h3><p class="rp">Priced on size<small>50% of Proof fee credited</small></p><p>The improvement becomes standard practice and expands.</p></div>
</div>"""

STEPBAND_INNER = """<div class="stepband sb2">Step 2 &middot; Prove &middot; &euro; 25.000 fixed</div>
<h2>Ten weeks. One line. One clear question.</h2>
<p class="lede">The thick colored header band (sb1 / sb2 / sb3) marks a step-detail slide in the step's hue.</p>"""

LEVERS_INNER = """<p class="eyebrow">Blocks &middot; levers + multiply</p><h2>What one improvement is worth</h2>
<div class="levers">
  <div class="card"><div class="lv-val">&euro; 50k</div><div class="lv-name">Recurring unplanned stops</div><p class="lv-note">Recover ~20 production hours a year at &euro;&thinsp;2.500 per lost hour.</p></div>
  <div class="card"><div class="lv-val">&euro; 100k</div><div class="lv-name">Off-spec &amp; rework</div><p class="lv-note">0,5% less off-spec output on &euro;&thinsp;20M of production value.</p></div>
  <div class="card"><div class="lv-val">&euro; 15k</div><div class="lv-name">Reporting</div><p class="lv-note">Five hours a week of engineer time won back.</p></div>
</div>
<div class="multiply"><span class="big">&euro; 50&ndash;100k</span><span class="op">per line, per year</span><span class="op">&times;</span><span class="mtxt"><b>your lines and sites.</b> Illustrative, not a promise.</span></div>"""

GRID3_INNER = """<p class="eyebrow">Blocks &middot; grid3 + g3ico</p><h2>Deliverable cards (3&times;2)</h2>
<div class="grid3">
  <div class="card"><span class="g3ico"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="20"/></svg></span><h3>Working environment</h3><p>Floorplan, equipment, log points and QR codes configured.</p></div>
  <div class="card"><span class="g3ico"><svg viewBox="0 0 24 24"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span><h3>Field data from your people</h3><p>Operators record observations in seconds, in the flow of work.</p></div>
  <div class="card"><span class="g3ico"><svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7.5" cy="12" r="2.2"/><circle cx="16.5" cy="12" r="2.2"/></svg></span><h3>Conditions linked to outcomes</h3><p>One traceable dataset, upstream conditions to downstream results.</p></div>
  <div class="card"><span class="g3ico"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg></span><h3>Answers, not just data</h3><p>Query and correlate to see what actually drives performance.</p></div>
  <div class="card"><span class="g3ico"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><line x1="9" y1="12" x2="16" y2="12"/><line x1="9" y1="16" x2="14" y2="16"/></svg></span><h3>Closing report</h3><p>Findings, tested hypotheses, an ROI reading and a scale-up path.</p></div>
  <div class="card"><span class="g3ico"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 9l2 2 4-4"/></svg></span><h3>Hands-on support</h3><p>On-site set-up, a direct line, and a feedback round every two weeks.</p></div>
</div>"""

GATES_INNER = """<p class="eyebrow">Blocks &middot; gates + ph</p><h2>Gated phase timeline</h2>
<p class="subcopy">Two decision gates, not one flat row of phases. Gate colours match the step bands, so a step is the same hue wherever it appears.</p>
<div class="gates">
  <div class="gate gate--1">
    <div class="gate-lbl"><span>Gate 1 &middot; Analyze</span><span class="gl-fee">&euro; 10.000</span></div>
    <div class="gate-in">
      <div class="ph"><span class="ph-n">01</span><h3>Analyze</h3><span class="wk">2&ndash;3 weeks</span><p>The data you already have, read for blind spots. Scopes the Proof.</p></div>
    </div>
  </div>
  <div class="gate gate--2">
    <div class="gate-lbl"><span>Gate 2 &middot; The ten-week Proof</span><span class="gl-fee">&euro; 25.000 fixed, all-in</span></div>
    <div class="gate-in">
      <div class="ph"><span class="ph-n">02</span><h3>Set-up</h3><span class="wk">wk 1&ndash;2</span><p>Environment configured, operators trained, field-tested.</p></div>
      <div class="ph"><span class="ph-n">03</span><h3>Capture</h3><span class="wk">wk 3&ndash;7</span><p>Operator rounds across the pinned log points.</p></div>
      <div class="ph"><span class="ph-n">04</span><h3>Correlate</h3><span class="wk">wk 6&ndash;9</span><p>Outcomes tagged back to the conditions that produced them.</p></div>
      <div class="ph"><span class="ph-n">05</span><h3>Decide</h3><span class="wk">wk 10</span><p>Results reviewed against the signed criteria.</p></div>
    </div>
  </div>
</div>"""

PRICE_INNER = """<p class="eyebrow">Blocks &middot; priceline + pb</p><h2>The fee equation</h2>
<p class="subcopy">Two fees and a credit that resolve to one number. Written as an equation because the total, not the line items, is the thing to remember.</p>
<div class="priceline">
  <div class="pb"><span class="pb-lbl">Step 1 &middot; Analyze</span><span class="pb-val">&euro; 10.000</span><p class="pb-note">Fixed, excl. VAT. 2&ndash;3 weeks, mostly remote.</p></div>
  <div class="pb pb--op">+</div>
  <div class="pb"><span class="pb-lbl">Step 2 &middot; Proof</span><span class="pb-val">&euro; 25.000</span><p class="pb-note">Fixed, all-in, regardless of hours.</p></div>
  <div class="pb pb--op">&minus;</div>
  <div class="pb pb--credit"><span class="pb-lbl">Analyze credited</span><span class="pb-val">&euro; 10.000</span><p class="pb-note">100% of the Analyze fee credited against the Proof.</p></div>
  <div class="pb pb--op">=</div>
  <div class="pb pb--total"><span class="pb-lbl">Total to a verified improvement</span><span class="pb-val">&euro; 25.000</span><p class="pb-note">All-in. No hardware, no integration project.</p></div>
</div>"""

CRITERIA_INNER = """<p class="eyebrow">Blocks &middot; statcards--row + sc-how</p><h2>Signed success criteria</h2>
<div class="statcards statcards--row">
  <div class="card"><div class="sc-top"><span class="sc-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg></span><strong>&ge; 85%</strong></div><span>Operators use the tool in the field; pinned log points captured per shift.</span><span class="sc-how">Platform capture logs</span></div>
  <div class="card"><div class="sc-top"><span class="sc-ico"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span><strong>4 wks</strong></div><span>Data captured across the pinned points, four consecutive weeks minimum.</span><span class="sc-how">Platform timeline</span></div>
  <div class="card"><div class="sc-top"><span class="sc-ico"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg></span><strong>&ge; 3</strong></div><span>Hypotheses from the Analyze confirmed or rejected with data.</span><span class="sc-how">Joint review of the dataset</span></div>
  <div class="card"><div class="sc-top"><span class="sc-ico"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><line x1="9" y1="13" x2="16" y2="13"/></svg></span><strong>1</strong></div><span>Closing report including an action plan for the gaps found.</span><span class="sc-how">Deliverable acceptance</span></div>
</div>"""

STEPSLG_INNER = """<p class="eyebrow">Blocks &middot; steps--lg</p><h2>Numbered phases at management size</h2>
<ol class="steps steps--lg">
  <li><h3>Prove</h3><p>One line. Ten weeks. Decided on signed success criteria.</p><span class="st-fee">&euro; 25.000 fixed, one-off</span></li>
  <li><h3>Run</h3><p>Annual platform subscription for the plant, with the Proof credit applied.</p><span class="st-fee">Site subscription / yr</span></li>
  <li><h3>Scale</h3><p>Further plants at a volume advantage; configuration carries into each new location.</p><span class="st-fee">Bundled / yr</span></li>
</ol>"""

DOCLIST_INNER = """<p class="eyebrow">Blocks &middot; doclist</p><h2>Document list</h2>
<p class="subcopy">Used on the annex slides, inside a grid2 card, to name the documents in a set.</p>
<div class="grid2" style="max-width:760px">
  <div class="card"><h3>Core agreements</h3><ul class="doclist"><li><b>Order Form</b> &middot; annual platform licence</li><li><b>Services SOW</b> &middot; implementation and guidance</li></ul></div>
  <div class="card"><h3>Data &amp; service</h3><ul class="doclist"><li><b>DPA</b> &middot; EU data processing</li><li><b>SLA</b> &middot; uptime and support</li><li><b>AUP</b> &middot; acceptable use, including AI</li></ul></div>
</div>"""

CRITSPLIT_INNER = """<p class="eyebrow">Blocks &middot; critcols</p><h2>Split success criteria</h2>
<p class="subcopy">Two labelled groups, because conditions on the customer and things Oppr is held to are not the same kind of promise.</p>
<div class="critcols">
  <div class="critcol"><p class="crit-lbl">What has to be true on your side</p>
    <div class="crit-list">
      <div class="card"><span class="cv">&ge; 85%</span><div class="ct"><h3>Adoption</h3><p>Operators use the tool in the field; pinned log points captured per shift.</p></div></div>
      <div class="card"><span class="cv">4 wks</span><div class="ct"><h3>Consistent capture</h3><p>Four consecutive weeks minimum across the pinned points.</p></div></div>
    </div></div>
  <div class="critcol"><p class="crit-lbl">What we are held to</p>
    <div class="crit-list">
      <div class="card"><span class="cv">&ge; 3</span><div class="ct"><h3>Hypotheses answered</h3><p>Every hypothesis in the scope confirmed or rejected with data.</p></div></div>
      <div class="card"><span class="cv">1</span><div class="ct"><h3>Action plan to scale</h3><p>A closing report ending in the plan for the next line and site.</p></div></div>
    </div></div>
</div>"""

QLIST_INNER = """<p class="eyebrow">Blocks &middot; qlist</p><h2>Compact quotes</h2>
<div class="qlist" style="max-width:620px">
  <div class="q"><blockquote>Combining hard data with what our people know lets us see correlations we never saw before.</blockquote><p class="att">Operations Manager &middot; Mineral pigments &middot; North France</p></div>
  <div class="q"><blockquote>We can benchmark how our SOPs are actually executed against what the sensors say.</blockquote><p class="att">Operations Manager &middot; Chemical manufacturing &middot; Amsterdam</p></div>
</div>"""

PATHFLOW_INNER = """<p class="eyebrow">Blocks &middot; pathflow</p><h2>Chevron path</h2>
<div class="pathflow" style="min-height:220px">
  <div class="pf pf1"><span class="pf-n">Proved</span><h3>One line</h3><p class="pf-scope">The line in scope</p><p>A verified improvement, with the dataset behind it.</p><span class="pf-fee">&euro; 25.000 fixed</span></div>
  <div class="pf pf2"><span class="pf-n">Run</span><h3>One site</h3><p class="pf-scope">The whole plant</p><p>The improvement becomes the way the line is run.</p><span class="pf-fee">Single site / yr</span></div>
  <div class="pf pf3"><span class="pf-n">Scale</span><h3>Several sites</h3><p class="pf-scope">Plant to plant</p><p>Further plants at a volume advantage.</p><span class="pf-fee">Bundled / yr</span></div>
</div>"""

COVEROPEN_INNER = f"""<img class="hero-img" src="{A}brand/img/hero-plate.jpg" alt="Operator on the plant floor capturing an observation on his phone">
<div class="scrim"></div>
<div class="cover-in">
  <div class="cover-top"><div class="wm-lg">oppr<b>.</b></div><span class="cover-url">oppr.ai</span></div>
  <div style="margin-top:auto">
    <p class="eyebrow" style="color:var(--accent)">Patterns &middot; cover--open</p>
    <h1 style="font-size:60px;max-width:19ch">The lighter scrim keeps the plant visible.</h1>
    <p class="lede">Same cover pattern, ~40% black at the right edge instead of ~74%, so the photograph reads.</p>
  </div>
  <p class="meta" style="margin-top:28px">Pattern &nbsp;&middot;&nbsp; Open cover &nbsp;&middot;&nbsp; oppr.ai</p>
</div>"""

FOOTER_INNER = """<p class="eyebrow">Patterns &middot; footer</p>
<h2>Footer anatomy</h2>
<p class="subcopy">Every content slide carries <b>.slide-foot</b>: wordmark, deck meta line, and the auto page counter (<b>.pageno</b> with <b>data-total</b>). Roles cover / closer / cta have none.</p>
<footer class="slide-foot"><span class="wm">oppr<b>.</b></span><span>Operator Intelligence &middot; Product Showcase &middot; July 2026</span><span class="pageno" data-total="20"></span></footer>"""

CTA_INNER = """<p class="eyebrow" style="color:var(--accent)">Patterns &middot; CTA timeline</p>
<h2 style="font-size:44px;color:var(--bg)">Next step</h2>
<div class="ctatl"><div class="line"></div><div class="row">
  <div class="cstep"><div class="dot">1</div><h3>A 30-minute call</h3><p>Pick the plant, line and recurring question that costs you the most.</p></div>
  <div class="cstep"><div class="dot">2</div><h3>Historical data analysis</h3><p>2&ndash;3 weeks from data access. Blind spots and payback on the table.</p></div>
  <div class="cstep"><div class="dot">3</div><h3>Decide on a Proof</h3><p>With your own numbers, and the &euro; 10.000 fully credited.</p></div>
</div></div>"""

COVER_INNER = f"""<img class="hero-img" src="{A}brand/img/hero-plate.jpg" alt="Operator on the plant floor capturing an observation on his phone">
<div class="scrim"></div>
<div class="cover-in">
  <div class="cover-top"><div class="wm-lg">oppr<b>.</b></div><span class="cover-url">oppr.ai</span></div>
  <div style="margin-top:auto">
    <p class="eyebrow" style="color:var(--accent)">Operator Intelligence for manufacturing</p>
    <h1>Find the improvements your machines can&rsquo;t see.</h1>
    <p class="lede">Hero cover treatment: full-bleed film still, layered scrim, wordmark, one-line lede, mono meta.</p>
  </div>
  <p class="meta" style="margin-top:28px">Pattern &nbsp;&middot;&nbsp; Cover &nbsp;&middot;&nbsp; oppr.ai</p>
</div>"""

BRANDMARK_INNER = """<p class="eyebrow">Blocks &middot; Brandmark</p>
<h2 style="font-size:34px">The logo at slide scale</h2>
<p class="subcopy">The footer carries a 13px mark. When a slide has to show the actual logo, use
  <code>.brandmark</code>. It is text, not an imported SVG: the deck embeds Archivo, so it renders
  identically, stays vector in the PDF, and cannot go stale when the brand kit is regenerated. On an
  ink slide it flips to paper automatically.</p>
<div style="display:flex; gap:60px; align-items:flex-end; margin-top:30px">
  <div><div class="brandmark">oppr<b>.</b></div>
    <p class="mono" style="font-size:11px;color:var(--muted);margin-top:10px">.brandmark</p></div>
  <div><div class="brandmark brandmark--sm">oppr<b>.</b></div>
    <p class="mono" style="font-size:11px;color:var(--muted);margin-top:10px">.brandmark--sm</p></div>
  <div style="background:var(--ink); padding:22px 26px; border-radius:10px">
    <div class="slide--ink"><div class="brandmark">oppr<b>.</b></div></div>
    <p class="mono" style="font-size:11px;color:rgba(242,242,237,.6);margin-top:10px">on .slide--ink</p></div>
</div>
<footer class="slide-foot"><span class="wm">oppr<b>.</b></span><span>Design system</span><span class="pageno" data-total="1"></span></footer>"""

CLOSER_INNER = """<div class="brandmark">oppr<b>.</b></div>
<div class="closer">
  <div class="cl-main">
    <p class="eyebrow" style="margin-bottom:14px;">Operator Intelligence for manufacturing</p>
    <h2 style="font-size:38px; max-width:20ch; color:var(--bg); margin-bottom:0;">Find the improvements
      your machines can&rsquo;t see.</h2>
    <div class="cl-contact">
      <div class="row"><span class="k">Contact</span><span class="v"><b>Floris Wyers</b>, Founder &amp; CEO</span></div>
      <div class="row"><span class="k">Email</span><span class="v">floris@oppr.ai</span></div>
      <div class="row"><span class="k">Phone</span><span class="v">+31 (0)6 24 69 02 39</span></div>
      <div class="row"><span class="k">Web</span><span class="v">oppr.ai</span></div>
      <div class="row"><span class="k">Office</span><span class="v">The Hague, NL</span></div>
      <div class="row"><span class="k">LinkedIn</span><span class="v">linkedin.com/in/fwyers</span></div>
    </div>
  </div>
  <figure class="qrbox"><div class="qr"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 41 41" shape-rendering="crispEdges" role="img" aria-label="QR code: https://www.linkedin.com/in/fwyers/"><path fill="#15201e" d="M2 2h7v1h-7zM10 2h1v1h-1zM15 2h2v1h-2zM19 2h7v1h-7zM28 2h2v1h-2zM32 2h7v1h-7zM2 3h1v1h-1zM8 3h1v1h-1zM12 3h2v1h-2zM15 3h1v1h-1zM17 3h2v1h-2zM20 3h1v1h-1zM22 3h1v1h-1zM25 3h2v1h-2zM28 3h2v1h-2zM32 3h1v1h-1zM38 3h1v1h-1zM2 4h1v1h-1zM4 4h3v1h-3zM8 4h1v1h-1zM12 4h1v1h-1zM14 4h1v1h-1zM16 4h3v1h-3zM20 4h1v1h-1zM22 4h2v1h-2zM25 4h1v1h-1zM28 4h1v1h-1zM32 4h1v1h-1zM34 4h3v1h-3zM38 4h1v1h-1zM2 5h1v1h-1zM4 5h3v1h-3zM8 5h1v1h-1zM10 5h2v1h-2zM16 5h1v1h-1zM19 5h3v1h-3zM28 5h2v1h-2zM32 5h1v1h-1zM34 5h3v1h-3zM38 5h1v1h-1zM2 6h1v1h-1zM4 6h3v1h-3zM8 6h1v1h-1zM14 6h2v1h-2zM17 6h3v1h-3zM21 6h1v1h-1zM24 6h1v1h-1zM26 6h2v1h-2zM29 6h2v1h-2zM32 6h1v1h-1zM34 6h3v1h-3zM38 6h1v1h-1zM2 7h1v1h-1zM8 7h1v1h-1zM12 7h1v1h-1zM15 7h1v1h-1zM19 7h3v1h-3zM24 7h1v1h-1zM26 7h1v1h-1zM28 7h3v1h-3zM32 7h1v1h-1zM38 7h1v1h-1zM2 8h7v1h-7zM10 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM26 8h1v1h-1zM28 8h1v1h-1zM30 8h1v1h-1zM32 8h7v1h-7zM12 9h1v1h-1zM15 9h1v1h-1zM17 9h2v1h-2zM20 9h1v1h-1zM22 9h1v1h-1zM26 9h1v1h-1zM30 9h1v1h-1zM4 10h1v1h-1zM6 10h3v1h-3zM10 10h1v1h-1zM13 10h1v1h-1zM17 10h1v1h-1zM19 10h1v1h-1zM21 10h4v1h-4zM29 10h1v1h-1zM31 10h1v1h-1zM35 10h1v1h-1zM38 10h1v1h-1zM2 11h2v1h-2zM5 11h1v1h-1zM9 11h3v1h-3zM14 11h4v1h-4zM20 11h1v1h-1zM22 11h2v1h-2zM25 11h2v1h-2zM29 11h1v1h-1zM31 11h1v1h-1zM34 11h2v1h-2zM37 11h2v1h-2zM2 12h2v1h-2zM7 12h3v1h-3zM14 12h2v1h-2zM17 12h1v1h-1zM19 12h2v1h-2zM23 12h2v1h-2zM27 12h1v1h-1zM32 12h1v1h-1zM35 12h1v1h-1zM37 12h2v1h-2zM4 13h1v1h-1zM9 13h1v1h-1zM11 13h7v1h-7zM20 13h2v1h-2zM23 13h1v1h-1zM25 13h5v1h-5zM31 13h1v1h-1zM34 13h2v1h-2zM38 13h1v1h-1zM3 14h2v1h-2zM6 14h1v1h-1zM8 14h1v1h-1zM10 14h4v1h-4zM17 14h2v1h-2zM20 14h3v1h-3zM25 14h3v1h-3zM30 14h3v1h-3zM38 14h1v1h-1zM3 15h1v1h-1zM6 15h1v1h-1zM10 15h1v1h-1zM12 15h1v1h-1zM14 15h2v1h-2zM17 15h2v1h-2zM20 15h1v1h-1zM22 15h3v1h-3zM28 15h1v1h-1zM30 15h1v1h-1zM32 15h1v1h-1zM35 15h4v1h-4zM2 16h1v1h-1zM6 16h1v1h-1zM8 16h4v1h-4zM13 16h1v1h-1zM15 16h2v1h-2zM20 16h1v1h-1zM22 16h3v1h-3zM26 16h1v1h-1zM28 16h1v1h-1zM31 16h1v1h-1zM33 16h1v1h-1zM36 16h1v1h-1zM38 16h1v1h-1zM2 17h1v1h-1zM5 17h1v1h-1zM9 17h3v1h-3zM13 17h1v1h-1zM17 17h6v1h-6zM25 17h4v1h-4zM30 17h3v1h-3zM34 17h1v1h-1zM38 17h1v1h-1zM3 18h1v1h-1zM5 18h1v1h-1zM7 18h2v1h-2zM14 18h4v1h-4zM20 18h5v1h-5zM27 18h1v1h-1zM29 18h4v1h-4zM35 18h1v1h-1zM37 18h2v1h-2zM5 19h1v1h-1zM7 19h1v1h-1zM9 19h1v1h-1zM11 19h3v1h-3zM15 19h4v1h-4zM20 19h2v1h-2zM23 19h5v1h-5zM30 19h3v1h-3zM36 19h3v1h-3zM5 20h1v1h-1zM8 20h1v1h-1zM11 20h1v1h-1zM13 20h4v1h-4zM19 20h5v1h-5zM25 20h1v1h-1zM27 20h1v1h-1zM33 20h2v1h-2zM37 20h2v1h-2zM2 21h1v1h-1zM4 21h2v1h-2zM9 21h3v1h-3zM13 21h2v1h-2zM18 21h1v1h-1zM20 21h1v1h-1zM22 21h9v1h-9zM33 21h2v1h-2zM38 21h1v1h-1zM3 22h1v1h-1zM7 22h6v1h-6zM14 22h1v1h-1zM17 22h2v1h-2zM20 22h1v1h-1zM22 22h1v1h-1zM25 22h3v1h-3zM30 22h4v1h-4zM38 22h1v1h-1zM4 23h2v1h-2zM9 23h1v1h-1zM11 23h1v1h-1zM14 23h2v1h-2zM18 23h1v1h-1zM20 23h2v1h-2zM24 23h1v1h-1zM27 23h2v1h-2zM31 23h2v1h-2zM36 23h1v1h-1zM38 23h1v1h-1zM4 24h1v1h-1zM6 24h1v1h-1zM8 24h2v1h-2zM12 24h2v1h-2zM15 24h1v1h-1zM18 24h1v1h-1zM20 24h7v1h-7zM28 24h1v1h-1zM30 24h1v1h-1zM32 24h1v1h-1zM34 24h2v1h-2zM37 24h2v1h-2zM3 25h1v1h-1zM5 25h2v1h-2zM9 25h1v1h-1zM11 25h1v1h-1zM15 25h1v1h-1zM17 25h4v1h-4zM25 25h1v1h-1zM27 25h2v1h-2zM37 25h2v1h-2zM2 26h2v1h-2zM5 26h4v1h-4zM10 26h2v1h-2zM13 26h1v1h-1zM17 26h3v1h-3zM23 26h1v1h-1zM28 26h3v1h-3zM32 26h1v1h-1zM34 26h1v1h-1zM38 26h1v1h-1zM3 27h1v1h-1zM5 27h1v1h-1zM12 27h1v1h-1zM15 27h1v1h-1zM17 27h1v1h-1zM19 27h7v1h-7zM27 27h4v1h-4zM33 27h1v1h-1zM36 27h3v1h-3zM2 28h1v1h-1zM6 28h1v1h-1zM8 28h1v1h-1zM10 28h1v1h-1zM12 28h2v1h-2zM16 28h2v1h-2zM19 28h1v1h-1zM21 28h1v1h-1zM23 28h1v1h-1zM27 28h1v1h-1zM29 28h2v1h-2zM32 28h1v1h-1zM34 28h2v1h-2zM37 28h2v1h-2zM3 29h2v1h-2zM10 29h1v1h-1zM16 29h1v1h-1zM21 29h2v1h-2zM25 29h1v1h-1zM27 29h2v1h-2zM30 29h1v1h-1zM32 29h2v1h-2zM35 29h1v1h-1zM37 29h2v1h-2zM2 30h1v1h-1zM6 30h3v1h-3zM10 30h1v1h-1zM12 30h6v1h-6zM19 30h2v1h-2zM22 30h3v1h-3zM27 30h1v1h-1zM29 30h6v1h-6zM36 30h2v1h-2zM10 31h1v1h-1zM14 31h2v1h-2zM19 31h3v1h-3zM23 31h2v1h-2zM26 31h1v1h-1zM28 31h3v1h-3zM34 31h1v1h-1zM38 31h1v1h-1zM2 32h7v1h-7zM13 32h1v1h-1zM17 32h1v1h-1zM19 32h6v1h-6zM27 32h1v1h-1zM29 32h2v1h-2zM32 32h1v1h-1zM34 32h1v1h-1zM36 32h3v1h-3zM2 33h1v1h-1zM8 33h1v1h-1zM10 33h2v1h-2zM13 33h1v1h-1zM17 33h1v1h-1zM19 33h2v1h-2zM22 33h6v1h-6zM29 33h2v1h-2zM34 33h1v1h-1zM38 33h1v1h-1zM2 34h1v1h-1zM4 34h3v1h-3zM8 34h1v1h-1zM10 34h1v1h-1zM12 34h1v1h-1zM14 34h1v1h-1zM20 34h1v1h-1zM24 34h1v1h-1zM26 34h3v1h-3zM30 34h6v1h-6zM37 34h2v1h-2zM2 35h1v1h-1zM4 35h3v1h-3zM8 35h1v1h-1zM12 35h3v1h-3zM17 35h1v1h-1zM19 35h1v1h-1zM21 35h1v1h-1zM23 35h1v1h-1zM25 35h2v1h-2zM29 35h3v1h-3zM33 35h2v1h-2zM36 35h3v1h-3zM2 36h1v1h-1zM4 36h3v1h-3zM8 36h1v1h-1zM10 36h1v1h-1zM13 36h1v1h-1zM23 36h1v1h-1zM25 36h2v1h-2zM28 36h2v1h-2zM31 36h1v1h-1zM34 36h1v1h-1zM36 36h1v1h-1zM38 36h1v1h-1zM2 37h1v1h-1zM8 37h1v1h-1zM13 37h6v1h-6zM20 37h1v1h-1zM23 37h2v1h-2zM26 37h7v1h-7zM37 37h1v1h-1zM2 38h7v1h-7zM11 38h1v1h-1zM14 38h1v1h-1zM16 38h6v1h-6zM23 38h1v1h-1zM25 38h3v1h-3zM29 38h3v1h-3zM33 38h1v1h-1zM37 38h2v1h-2z"/></svg></div><figcaption>Scan to connect</figcaption></figure>
</div>"""

PROJX_INNER = """<p class="eyebrow">Patterns &middot; Running projects, expanded</p>
<h2>One card per engagement</h2>
<p class="lede" style="margin-bottom:4px;">Identity, what we did, and a quote where one exists. The quote is
  deliberately optional: see the middle card.</p>
<div class="projx">
  <div class="card">
    <div class="px-head">
      <span class="proj-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/></svg></span>
      <div class="lt"><span class="tag tag--h">Sector &middot; process &middot; country</span><h3>The engagement</h3></div>
    </div>
    <p class="px-what">One or two lines on the situation the plant was in.</p>
    <p class="did-lbl">What we did</p>
    <ul><li>The first thing we did</li><li>The second thing we did</li></ul>
    <blockquote>A quote, on a terracotta rule, because a person said it.</blockquote>
    <p class="att">Operations Director<br>Sector &middot; country</p>
  </div>
  <div class="card">
    <div class="px-head">
      <span class="proj-ico"><svg viewBox="0 0 24 24"><path d="M12 3c3.4 4 5.5 6.3 5.5 9.3a5.5 5.5 0 0 1-11 0C6.5 9.3 8.6 7 12 3z"/></svg></span>
      <div class="lt"><span class="tag tag--h">No quote on record</span><h3>The same card, without one</h3></div>
    </div>
    <p class="px-what">Everything above the quote slot is unchanged.</p>
    <p class="did-lbl">What we did</p>
    <ul><li>The first thing we did</li><li>The second thing we did</li></ul>
    <p class="px-pull">A plain statement on a grey rule: our words, not theirs, and no person attributed.</p>
    <p class="att">Sector &middot; country</p>
  </div>
  <div class="card">
    <div class="px-head">
      <span class="proj-ico"><svg viewBox="0 0 24 24"><path d="M12 2.5c.6 3.2 3.6 4.8 3.6 8.2a3.6 3.6 0 0 1-7.2 0c0-1.3.5-2.3 1.3-3.1.3 1 .9 1.5 1.6 1.7C10.6 8 11.3 5.5 12 2.5z"/></svg></span>
      <div class="lt"><span class="tag tag--h">Sector &middot; process &middot; country</span><h3>The engagement</h3></div>
    </div>
    <p class="px-what">Cards align at the bottom whatever the slot holds.</p>
    <p class="did-lbl">What we did</p>
    <ul><li>The first thing we did</li><li>The second thing we did</li></ul>
    <blockquote>The attribution is pinned to the bottom, so three uneven cards still line up.</blockquote>
    <p class="att">Operations Director<br>Sector &middot; country</p>
  </div>
</div>
<footer class="slide-foot"><span class="wm">oppr<b>.</b></span><span>Design system</span><span class="pageno" data-total="1"></span></footer>"""

SPECIMENS = [
    ("Foundations", "colors", "Color tokens", "", colors_inner()),
    ("Foundations", "type", "Type scale", "", TYPE_INNER),
    ("Blocks", "cards-grid2", "Icon cards", "", CARDS_INNER),
    ("Blocks", "stat-grid", "Stat grid", "", STATS_INNER),
    ("Blocks", "tags", "Tags", "", TAGS_INNER),
    ("Blocks", "quotes", "Evidence quotes", "", QUOTES_INNER),
    ("Blocks", "rungs", "Engagement rungs", "", RUNGS_INNER),
    ("Blocks", "stepband", "Step band", " step", STEPBAND_INNER),
    ("Blocks", "levers-multiply", "KPI levers", "", LEVERS_INNER),
    ("Blocks", "cards-grid3", "Deliverable cards", "", GRID3_INNER),
    ("Blocks", "gated-phases", "Gated phase timeline", "", GATES_INNER),
    ("Blocks", "price-equation", "Fee equation", "", PRICE_INNER),
    ("Blocks", "criteria-row", "Signed success criteria", "", CRITERIA_INNER),
    ("Blocks", "steps-lg", "Numbered phases", "", STEPSLG_INNER),
    ("Blocks", "doclist", "Document list", "", DOCLIST_INNER),
    ("Blocks", "criteria-split", "Split criteria", "", CRITSPLIT_INNER),
    ("Blocks", "qlist", "Compact quotes", "", QLIST_INNER),
    ("Blocks", "pathflow", "Chevron path", "", PATHFLOW_INNER),
    ("Patterns", "cover-open", "Open cover", " slide--ink cover cover--open", COVEROPEN_INNER),
    ("Patterns", "footer", "Footer anatomy", "", FOOTER_INNER),
    ("Patterns", "cta-timeline", "CTA timeline", " slide--ink", CTA_INNER),
    ("Patterns", "cover", "Cover treatment", " slide--ink cover", COVER_INNER),
    ("Blocks", "brandmark", "Brandmark", "", BRANDMARK_INNER),
    ("Patterns", "closer-contact", "Closer with contact + QR", " slide--ink\" style=\"display:flex;flex-direction:column;justify-content:space-between;", CLOSER_INNER),
    ("Patterns", "projects-expanded", "Running projects, expanded", "", PROJX_INNER),
]

GROUP_DIR = {"Foundations": "foundations", "Blocks": "blocks", "Patterns": "patterns"}


def main() -> int:
    written = []
    for group, name, title, mod, inner in SPECIMENS:
        page = PAGE.format(group=group, title=title, a=A, mod=mod, inner=inner)
        d = DS / GROUP_DIR[group]
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{name}.html").write_text(page, encoding="utf-8")
        written.append((group, name))

    # index
    idx = ["""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Oppr Deck System — design system</title>
<style>body{font-family:Arial,sans-serif;background:#f2f2ed;color:#15201e;margin:0;padding:32px 40px}
h1{letter-spacing:-.03em}h1 b{color:#a65032}h2{font-family:Consolas,monospace;font-size:14px;text-transform:uppercase;letter-spacing:.05em;margin:28px 0 8px;border-bottom:1px solid #c8ceca;padding-bottom:6px}
a{display:inline-block;margin:4px 12px 4px 0;font-family:Consolas,monospace;font-size:13px;color:#a65032;text-decoration:none}a:hover{text-decoration:underline}</style>
</head><body><h1>oppr<b>.</b> deck system</h1>
<p style="font-family:Consolas,monospace;font-size:12px;color:#5f6965">Specimens render from the real templates/deck.css + showcase.css. Regenerate with tools\\build-design-system.ps1. Sync to claude.ai/design with /design-sync.</p>"""]
    for group in ["Foundations", "Blocks", "Patterns"]:
        idx.append(f"<h2>{group}</h2>")
        for g, name in written:
            if g == group:
                idx.append(f"<a href='{GROUP_DIR[group]}/{name}.html'>{name}</a>")
    idx.append("</body></html>")
    (DS / "index.html").write_text("\n".join(idx), encoding="utf-8")

    print(f"Design system: {len(written)} specimens + index -> {DS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

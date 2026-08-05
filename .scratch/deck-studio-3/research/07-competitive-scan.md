# 07 Competitive scan: reusable slide libraries and propagation

Research for Wayfinder map "Chapters and mother slides". Run 2026-08-04.
Every substantive claim carries a URL. Where a page could not be fetched, the
claim is marked **unverified** and says what the evidence actually was.

## Summary

1. **Flag-and-accept is the mainstream answer, not the exotic one.** Figma,
   Templafy, SlideLizard, empower, Highspot, Google Slides linked slides and the
   old SharePoint slide library all notify and let a human accept. Automatic
   overwrite exists (Beautiful.ai, Shufflrr, DIGIDECK) and is sold as a feature,
   but only in link-hosted or fully cloud products where nothing was ever "sent".
2. **Three override models exist in the wild, not two.** Detach (empower: keeping
   your version removes the slide from the update group forever), override
   (Figma: per-property overrides survive an update), and **keep both** (Templafy
   unlocked slides and SlideLizard "Insert Copy" insert the new slide behind the
   old one and mark the old one outdated). Ticket 04 lists detach, override and
   block. Keep-both is missing and is the cheapest of the four to build.
3. **Overrides survive only where identity is stable.** Figma retains overrides by
   matching layer names, and loses them when a name changes. Any per-element
   accept we build needs a stable element id, not a position.
4. **Nobody found does chapters.** The closest primitives are PowerPoint Custom
   Shows (a named subset of one deck's slides) and Seismic LiveDocs (a rules
   questionnaire that includes or excludes slides). "Several slides in a subject,
   pick one or pick three" is not a shipped pattern anywhere I could find.
5. **Nobody stores a recipe as a first-class record either.** Parentage lives per
   page inside the file: Templafy stamps slide metadata into the pptx, Google
   Slides stores a link per slide, SharePoint stored a source URL per slide. The
   drift check is therefore a pull the client runs on open. A server-side "which
   decks are behind" query is something none of them appears to have.
6. **What a link buys, and what we lose by staying on PDF:** slide-level
   engagement analytics (Pitch, Qwilr, Storydoc, DIGIDECK), and the ability to fix
   a deck after sending it. Both are real. Neither is free: DIGIDECK's own pitch is
   that a price change reaches "presentations sent months ago", which is precisely
   what charting rejected.

---

## Pitch

1. **Component model.** Templates and **slide styles**. A template is a saved
   presentation with brand colours, fonts and pre-designed layouts
   ([create a template](https://help.pitch.com/en/articles/3752837-create-a-template)).
   A slide style is a reusable look you can apply to any slide and see where it is
   used ([create your own slide style](https://help.pitch.com/en/articles/4059534-create-your-own-slide-style)).
   The unit is a look, not a slide of content.
2. **Propagation.** Pitch's marketing says teams "centrally update templates to
   reflect new logos, brand colors, or messaging shifts, and those changes flow
   into every deck moving forward"
   ([Pitch blog](https://pitch.com/blog/personalize-your-pitching-at-scale)).
   Note the words "moving forward". I found **no** documentation of an existing
   presentation being updated or flagged when its template changes. **Unverified**
   either way: the help centre does not address it.
3. **Overrides.** Not documented. Styles are applied per slide, so a slide that has
   been restyled locally is simply on a different style.
4. **Depth selection.** None found.
5. **Sharing.** Link-first, with per-visit analytics: viewed slides, visit length,
   country, and a consent popover you can switch on
   ([view presentation analytics](https://help.pitch.com/en/articles/5592127-view-presentation-analytics),
   [share an external link](https://help.pitch.com/en/articles/3748926-share-an-external-link-to-your-presentation)).
   The consent toggle is the only GDPR-shaped control I saw in any of these tools.
6. Pitch does sharing analytics well and slide reuse barely at all.

## Tome

Tome sunset its presentation product. It announced the end of Tome Slides in
March 2025 and shut it down in April 2025, pivoting to AI sales tooling under
"Make deals, not decks"
([Autoppt writeup](https://autoppt.com/blog/tome-app-pivot-away-from-presentations/),
[Deckary timeline](https://deckary.com/blog/tome-review)).
There is no current slide-library or propagation model to report. The relevant
finding is negative and useful: the "AI generates the deck" category consolidated,
and the tool that had no reuse or governance story is the one that died.

## Beautiful.ai

1. **Component model.** **Shared Slides**: whole slides held in Team Resources and
   inserted into any team member's presentation
   ([Team Slides section](https://support.beautiful.ai/hc/en-us/sections/360010109011-Shared-Slides)).
   The unit is a whole slide.
2. **Propagation.** Fully automatic, in real time. "When a Shared Slide is updated,
   the changes are immediately reflected across every presentation using the
   slide", and you can edit the shared slide from any presentation that uses it,
   after which "your changes will update all presentations using that slide in
   real-time"
   ([Updating a Shared Slide](https://support.beautiful.ai/hc/en-us/articles/360047715952-Updating-a-Shared-Slide)).
   No accept step, no diff. **Partly unverified:** support.beautiful.ai returns 403
   to the fetcher, so these are the search index's extracts of that page, not my
   own read of it.
3. **Overrides.** There is no per-instance override. The escape hatch is deletion:
   delete a Shared Slide from Team Resources and existing copies "remain in the
   deck but become fully editable and unlinked from the original". That is detach,
   triggered from the library side rather than the instance side.
4. **Depth selection.** None found.
5. **Sharing.** Link and export. Not investigated in depth.
6. This is the pure automatic model. It works because there is no artefact outside
   the product: nothing has been "sent" that can disagree with the library.

## Storydoc

1. **Component model.** Saved slides, personal (**My Slides**) or shared (**Team
   Slides**), organised in subfolders
   ([save slides to My Slides or Team Slides](https://help.storydoc.com/en/articles/11810196-how-to-save-slides-to-my-slides-or-team-slides)).
   The unit is a whole slide.
2. **Propagation.** The help article covers save and reuse only. It says nothing
   about editing a saved slide later and nothing about linkage. **Unverified**, and
   the silence in a fairly complete help centre suggests inserted slides are
   copies.
3. **Overrides.** Not applicable if there is no link. Not documented.
4. **Depth selection.** None found.
5. **Sharing.** Link-native, and the deck stays live: "deploying new versions of
   your Storydoc presentations happens instantly, there's no downtime and no
   caching", so recipients see edits without a resend
   ([Storydoc FAQs](https://www.storydoc.com/frequently-asked-questions)).
   Analytics are per-slide: who viewed, how long, where they dropped off
   ([sharing and analytics](https://help.storydoc.com/en/collections/14076241-sharing-analytics)).
6. Storydoc's answer to "a deck is already out" is that a deck is never out. That
   is the opposite trade from ours and it costs the recipient's offline copy.

## Qwilr

1. **Component model.** **Saved blocks** and snippets: a block is a section within
   a page, saved to a library and dragged into other pages
   ([saved block library](https://help.qwilr.com/article/677-using-the-saved-block-library)).
   The unit is a block within a page, the finest granularity of the whole scan.
2. **Propagation.** Explicitly none. Verbatim: *"When you do, the changes will
   apply to any future pages where you use this block. Existing pages will
   continue to reflect the older version of the block."* Same source.
3. **Overrides.** Free, because an inserted block is a copy. Governance comes from
   the other end: *"you can choose to lock specific blocks so that only admins can
   edit them. This means anyone in your account can add the block to a Qwilr Page,
   but only an admin can update the content."*
4. **Depth selection.** None found.
5. **Sharing.** Link-native with block-level engagement: who viewed, which sections
   they focused on, time per block as a list and a pie chart, plus CRM sync
   ([Qwilr analytics](https://help.qwilr.com/article/156-analytics-insights),
   [document analytics](https://qwilr.com/blog/document-analytics/)).
6. Qwilr chose copy-on-insert deliberately and pairs it with a lock. It is the
   simplest model here, and it is the model our library has today.

## Highspot

1. **Component model.** Master decks plus **Remix**: reps pick slides from one or
   several master decks and reorder them. Remix "does not allow sellers to modify
   the content of a slide", and admins enable or disable editing and remix per role
   ([Empower your field with customizable sales content](https://www.highspot.com/blog/empower-your-field-with-customizable-sales-content/)).
   **Unverified:** that blog URL 404s to the fetcher; the wording is from the
   search index of Highspot's own blog. help.highspot.com is behind a login.
2. **Propagation.** **Smart Update**, an addition to Remix, "notifies users when
   specific slides within their Remixed content have been updated, allowing them to
   accept or reject the changes", and does so "even for sales presentations that
   reps have previously customized", while "still giving them the ability to accept
   updates that have been made, or keep the existing content as-is"
   ([Highspot November release](https://www.highspot.com/blog/sales-communications-features-launch-in-the-november-release/)).
   Same **unverified** caveat: search index of Highspot's blog, page not fetched.
   This is flag-and-accept per slide, in the tool closest to the actual job.
3. **Overrides.** Keeping your version is a first-class choice. Whether the slide
   then keeps receiving future flags is not documented publicly.
4. **Depth selection.** Not as a chapter. The nearest thing is remixing from
   several master decks, which is manual picking with no recorded structure.
5. **Sharing.** Pitch links with open, view and download alerts
   ([live pitch](https://www.highspot.com/resource/highspot-in-action-live-pitches/)).
   **Content Genomics** tracks usage and engagement of a presentation "even after
   they are modified", giving visibility into how content evolves in the field
   ([Content Genomics announcement](https://www.highspot.com/blog/highspot-launches-industry-first-smartpage-technology-to-turn-sales-strategy-into-action/)).
   That is lineage tracking of derivatives, which is our `derived_from` idea
   turned into an analytics product.
6. Highspot has the closest shipped equivalent of what this map wants, and it also
   has the permission model that decides who is even allowed to drift.

## Seismic

1. **Component model.** A slide library plus **LiveDocs**: PowerPoint files turned
   into templates with content placeholders, data connections and business rules
   ([LiveDocs](https://seismic.com/products/livedocs/),
   [LiveDocs for PowerPoint](https://exchange.seismic.com/apps/seismic/seismic-livedocs-for-powerpoint/)).
   The slide library component exists so sellers can assemble a deck from slides
   ([community thread](https://community.seismic.com/admins-57/livedoc-document-generator-presentation-builder-149)).
2. **Propagation.** Seismic publishes a documentation page titled
   [Accept slide updates in Presentation Builder without template](https://docs.seismic.com/bundle/draft_content-pro/page/accept_slide_updates_in_presentation_builder_without_template.html)
   (indexed, last updated 4 June 2025). The page 404s to every fetch route I tried,
   including the redirect target and a text proxy, so **the mechanism is
   unverified**. The title alone establishes that Seismic treats slide updates as
   something a user accepts. Their PowerPoint add-in is described as letting
   sellers "stay up-to-date on slide updates pushed by marketers"
   ([Introducing Seismic for PowerPoint](https://www.seismic.com/blog/introducing-seismic-for-powerpoint/)).
3. **Overrides.** Not verifiable from public sources.
4. **Depth selection.** The strongest analogue in the scan. A LiveDoc asks the
   seller a question-and-answer wizard, and business rules on slides and elements
   include or exclude content from the generated deck (same LiveDocs sources).
   Depth is therefore a rule per slide, driven by an input, not a pick per chapter.
5. **Sharing.** LiveSend links with engagement tracking. Not investigated further.
6. Seismic is the most capable and the least publicly documented. Treat every
   claim about its internals as second hand.

## Google Slides

1. **Component model.** Theme Builder: one master plus layouts, inside a single
   presentation
   ([use a template or change the theme, background, or layout](https://support.google.com/docs/answer/1705254)).
   There is no cross-presentation slide library. Google's own docs describe
   importing a theme from another presentation and inserting slides from a
   template, and nothing that persists as a searchable library.
2. **Propagation, layouts.** Automatic within the file. Editing the master affects
   every slide; editing one layout affects only slides on that layout
   ([BrightCarbon on Google Slides themes and layouts](https://www.brightcarbon.com/blog/editing-themes-and-layouts-in-google-slides/)).
3. **Propagation, linked slides.** This is the interesting one. Copy a slide from
   one presentation and paste it into another and Google offers **Link slides** or
   **Do not link**. Linked slides do **not** update on their own: an Update button
   appears on the object, and Tools > Linked objects offers Update all
   ([link a chart, table, or slides](https://support.google.com/docs/answer/7009814)).
   That is flag-and-accept, per object, with a whole-file accept-all.
4. **Overrides.** Brutal and clearly documented: *"When linked objects are updated,
   any edits to the objects in the original file will override changes made in the
   new file."* Edits also never flow back to the source. Accepting an update is
   therefore lossy, and Google simply tells you so. Same source.
5. **Depth selection.** None.
6. **Sharing.** Link with permissions; no engagement analytics.

## PowerPoint

Four separate mechanisms, worth separating because they answer different
questions.

**Slide masters and layouts.** A layout defines placeholder position, size and
default formatting, and changes flow to every slide using that layout
([customize a slide master](https://support.microsoft.com/en-us/office/customize-a-slide-master-036d317b-3251-4237-8ddc-22f4668e2b56),
[apply a slide layout](https://support.microsoft.com/en-us/office/apply-a-slide-layout-158e6dba-e53e-479b-a6fc-caab72609689)).
The override rule is the classic one: a placeholder that was moved, resized or
reformatted by hand stops following the layout, and **Reset Slide** restores
inheritance without deleting content
([Microsoft Q&A on layouts not propagating](https://learn.microsoft.com/en-us/answers/questions/5076853/powerpoint-slide-master-layout-formatting-changes),
[Indezine on Reset Slide](https://www.indezine.com/products/powerpoint/learn/interface/365/reset-slide.html)).
Local edit wins silently, and re-linking is a single explicit command that throws
the local edit away. No flag, no diff.

**SharePoint slide libraries (retired).** The historical answer to exactly our
problem. You published slides individually, reused them, and on opening the
presentation PowerPoint checked the library and offered to replace or compare the
changed slide, or to skip the check
([Microsoft archive: publishing and reusing PowerPoint content using slide library](https://learn.microsoft.com/en-us/archive/blogs/vedant/publishing-and-reusing-powerpoint-content-using-slide-library)).
It was a pull on open, not a push. Deprecated from PowerPoint 2016 and SharePoint
2013, and absent from SharePoint Online
([Microsoft Q&A: Publish Slides tool](https://learn.microsoft.com/en-us/answers/questions/5080842/publish-slides-tool),
[Microsoft Q&A: SharePoint Online slide library](https://learn.microsoft.com/en-us/answers/questions/5056527/sharepoint-online-slide-library)).
The current **Reuse Slides** command is a plain copy with no link
([SlideCamp on the gap it left](https://slidecamp.io/blog/sharepoint-slide-library-replacement)).
Microsoft built flag-and-accept for slides, then removed it, and a whole vendor
category (Templafy, SlideLizard, SlideHub, Shufflrr, empower) exists to fill the
hole.

**Custom Shows.** The closest thing to a short version and a long version: a named
subset of the slides in one file, in a chosen order, several per presentation
([create and present a custom show](https://support.microsoft.com/en-us/office/create-and-present-a-custom-show-09d4d340-3c47-4125-b177-0de3be462c5d)).
It is presentation-time only, not composition-time, and PowerPoint for the web
does not support it.

**Designer.** Per-slide layout suggestions from an AI. It produces no reusable
asset and has no library
([create professional slide layouts with Designer](https://support.microsoft.com/en-us/office/create-professional-slide-layouts-with-designer-53c77d7b-dc40-45c2-b684-81415eac0617)).
Not relevant to this map beyond ruling it out.

## Figma

**Figma Design libraries.** The best-documented flag-and-accept in the industry
and the model ticket 05 should copy.

1. **Component model.** Main component and instances, published to a team library
   ([guide to libraries](https://help.figma.com/hc/en-us/articles/360041051154-Guide-to-libraries-in-Figma)).
2. **Propagation.** Publishing makes the update *available* in every file that uses
   the component. A blue badge appears on the Libraries icon. You open the Updates
   tab, review with a **Side by side** view or an **Overlay** view with adjustable
   opacity, and click Update on one asset or Update all
   ([review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates)).
   Nothing is automatic. Anyone with edit access can accept.
3. **Overrides.** Text, fills, strokes, effects, nested instance swaps and layer
   names can be overridden per instance. Structure cannot: layer order, position in
   auto layout and constraints belong to the main component, and structural change
   requires detaching. Overrides are retained through swaps and variant changes by
   **matching layer names**, and are lost when names or starting values differ.
   **Reset** restores the main component's properties; there is also a push from
   instance back to main
   ([modify component instances](https://help.figma.com/hc/en-us/articles/360039150733-Modify-component-instances)).
4. **Depth selection.** Not as such. Component **variants** switch a component
   between states, which is a shape worth noting: one component, several forms,
   one selected per instance. It is not "pick three slides instead of one".
5. **Sharing.** Not comparable.
6. Figma is the only tool here that keeps a local edit **and** a live link at the
   same time, and it pays for that with a hard rule: instances have no structural
   freedom.

**Figma Slides.** Components exist inside a deck and instances update
automatically within the same file. Templates published to a team or organisation
carry their components as instances; templates published to the Community do not
receive updates. Shapes with text, code blocks, tables, live interactions and
prototypes cannot be components
([create components in Figma Slides](https://help.figma.com/hc/en-us/articles/30630178611991-Create-components-in-Figma-Slides),
[add Figma Design libraries to your slide deck](https://help.figma.com/hc/en-us/articles/24292359259543-Add-Figma-Design-libraries-to-your-slide-deck)).
A whole slide as a library component across decks is not clearly supported, and
users ask for it in the forum
([forum: Figma Slides linked to library](https://forum.figma.com/ask-the-community-7/figma-slides-linked-to-library-27889)).

## The PowerPoint governance vendors

These are not in the ticket list and they are the most directly relevant tools in
the scan, because they solve our exact problem against files that leave the
building.

**Templafy (Validator).** Slides in a downloaded, locally saved presentation stay
linked to the library. When a newer version exists, the user is notified on
reopening and offered the update
([Get latest update in PowerPoint](https://support.templafy.com/hc/en-us/articles/4404121868433-Get-latest-update-in-PowerPoint-Validator)).
Two modes: **locked** slides cannot be edited by the end user, and the newer
Validator "removes the option for users to preview and accept or dismiss changes,
instead admins make changes then lock a slide, preventing users from overriding
required updates". **Unlocked** slides get the keep-both treatment: the existing
slide stays, the updated slide is inserted after it, and "a notification is added
to the existing slide to make it clear that it is outdated", so the user can copy
their own changes across and delete the old one
([Lock and push updates for slides](https://support.templafy.com/hc/en-us/articles/360009524737-Lock-and-push-updates-for-slides-Validator),
[Validator with dynamics 1.11](https://support.templafy.com/hc/en-us/articles/360003482997-Validator-with-dynamics-version-1-11)).
A dismissed notification returns every time the presentation is opened, and only
accepting clears it. **Unverified:** support.templafy.com returns 403 to the
fetcher; this is the search index's extract of those pages.

**SlideLizard.** The cleanest per-slide accept UI found. **Check for Updates**
lists the slides with a newer library version, and each offers three actions:
**Update** (replace, the default), **Ignore Update** (keep, and it reappears on the
next check), and **Insert Copy** (keep the old slide and insert the new one after
it, so you can move your own edits across before deleting the old). There is an
Ignore-all for the presentation
([Ensure slides are up to date](https://help.slidelizard.com/d/update-slides/)).
Slides carry a release status of In Progress, Approved or Outdated, and approval
is per slide or per folder and per role, team or person
([central slide updates](https://slidelizard.com/en/features/slide-updates)).

**SlideHub.** Claims both models at once: editing a library slide "pushes the new
version into every deck that uses it", and for decks already out there "SlideHub
flags the new version inside every deck that still uses the old one. Users see a
banner the next time they open the file and swap in the approved slide in one
click"
([organize and update slides](https://slidehub.com/platform/organize-update-slides)).
The help article on updating a single slide covers publishing only and does not
describe the downstream behaviour
([SlideHub knowledge centre](https://help.slidehub.com/en-us/article/how-to-update-a-single-slide-in-your-company-library-within-powerpoint-1pfrw26/)),
so treat "pushes" as marketing and "flags with a banner" as the mechanism.

**empower.** Checks on open, notifies about outdated content, one-click update, and
checks at slide level only. The important detail is the **update group**: if you
overwrite an element that belongs to an update group you get a dialog asking
whether to share, force or not distribute the update, and **if you keep the older
version the slide is removed from the update group and will no longer receive any
updates**
([Content Updates](https://support.empowersuite.com/hc/en-us/articles/24052712012444-Content-Updates)).
That is detach-on-keep-mine, stated plainly. **Unverified:** the support page
returns 403; this is the search index's extract.

**Shufflrr.** Automatic: "Live Slide Updates: When the original slide changes, all
linked decks update automatically"
([the SharePoint PowerPoint problem](https://shufflrr.com/sharepoint/the-sharepoint-powerpoint-problem/)).
No accept step documented; their FAQ does not describe the mechanics
([FAQ](https://shufflrr.com/faqs/)).

**DIGIDECK.** The furthest end of automatic, and the clearest statement of the
trade this map rejected: "When a logo, font, message, or price changes, update it
once and have it reflected across every deck, including presentations sent months
ago", from a governed **Master Deck Library** where "there should be exactly one
place to find the current, correct version of any slide"
([how to scale presentation creation](https://www.thedigideck.com/how-to-scale-presentation-creation-in-large-organizations/)).
It works because a DIGIDECK deck is a hosted link, never a file.

## Also checked, briefly

**Canva Brand Templates.** Existing designs do not update when the template
changes: "Designs you already made won't update on their own, so you'll need to go
back and reapply the new colors or fonts". Template edits go live only after
approval and republishing
([edit brand templates](https://www.canva.com/help/update-brand-templates/),
[publish designs as brand templates](https://www.canva.com/help/publish-team-template/)).

**Gamma.** Block-based cards with themes. Themes are reusable and swapping one
leaves content and structure alone
([change your Gamma theme](https://help.gamma.app/en/articles/10262646-how-do-i-change-my-gamma-theme)).
No slide library with propagation found.

**Matik.** Solves a different problem: a template plus live CRM and warehouse data
generates a personalised deck, so freshness comes from regenerating rather than
from patching an existing file ([Matik](https://www.matik.io/)). Worth noting as an
alternative philosophy: if generation is cheap, propagation is a non-problem.

---

## What they can do that we cannot

- **Show a visual diff and accept it.** Figma's side-by-side and overlay review,
  per asset or all at once. We have nothing at all today.
  [Source](https://help.figma.com/hc/en-us/articles/360039234193-Review-and-accept-library-updates)
- **Keep a local edit and a live link at the same time.** Figma overrides at
  property level. Our library slides are copied at assembly and the link exists
  only as a `data-slide-id` stamp.
- **Offer keep-both instead of choosing.** Templafy and SlideLizard insert the new
  version next to the old and mark the old outdated. It is the least destructive
  option in the scan and nobody has to decide anything at the moment of the flag.
- **Update something already sent.** DIGIDECK, Storydoc, Beautiful.ai. Deliberately
  out of scope for us, and a genuine capability gap, not a fake one.
- **Slide-level engagement analytics.** Pitch, Qwilr, Storydoc, DIGIDECK, Highspot.
  A PDF tells us nothing after it leaves.
- **Track derivatives in the field.** Highspot Content Genomics follows a
  presentation's engagement after a rep has modified it.
- **Assemble by rule from an input.** Seismic LiveDocs generates the deck from a
  questionnaire plus business rules on slides.
- **Merge live data into slides.** Matik, Seismic LiveDocs.
- **Lock content by role.** Templafy locked slides, Highspot per-role remix and
  edit permissions, Qwilr admin-only blocks, SlideLizard approval per role. We have
  one user, so this is latent rather than missing.
- **Native PowerPoint output and coauthoring.** Every Office-side tool. We produce
  HTML and PDF only.

## What we can do that they cannot

Honest framing: several of these are things the others have no need for, and for
Highspot and Seismic "cannot" means "not documented publicly", because their
internals are behind a login.

- **Fail a build on content rules.** `verify-deck.py` blocks em dashes, unfilled
  placeholders, wrong page geometry, footer violations, non-European number
  formatting and a PDF filename missing `oppr` or the client slug. Templafy's
  Validator is the nearest thing and it governs slide freshness and locking, not
  the words on the slide. No tool in the scan runs editorial rules as a gate.
- **Enforce disclosure clearance per asset.** Every image carries an `entitlement`
  and every deck an `allowed_entitlements`, so naming another customer is a hard
  FAIL rather than a review comment. Sales enablement tools have permissions on who
  may *see* content. Per-asset clearance checked against the audience of the
  artefact being built is not something I found.
- **Prove a save is structure-preserving.** `app/lib/htmlcheck.mjs` fingerprints
  every save server side. That is a stronger guarantee than an admin lock, because
  it holds regardless of what the client sends.
- **Own the artefact as text.** A published deck is HTML we control, so a diff, a
  hash and a per-element accept are all cheap. In pptx-land these tools rebuild
  that from scratch with add-ins.
- **One artefact model across output types.** Deck, carousel, social image and
  article share one `kind`, one verify gate and one version history. Every tool in
  the scan is single-format.
- **Compose from an agent.** The CLI is the composition surface, so a deck is
  scriptable and reproducible from a recipe. All of these tools are GUI-first.

---

## Findings that would change a recommendation on this map

**Ticket 01 (where the recipe lives).** Supports the recommendation, with one
addition. No scanned tool keeps a recipe as a record separate from the document.
They all put the link **inside** the artefact, per page: Templafy stamps slide
metadata into the pptx, Google Slides stores a link per pasted slide, SharePoint
stored a source URL per slide. The consequence is that every one of them answers
"is this deck behind" only by opening it, which is why Templafy and empower check
on open and why nobody offers a dashboard of behind decks. A `recipe` JSON column
on `deck_versions` buys us the query none of them has. Keep `data-slide-id` in the
HTML as well, because belt-and-braces is what everyone in the scan actually
shipped.

**Ticket 02 (the slide refresh).** Minor. SlideLizard treats **Outdated** as a
first-class release status alongside In Progress and Approved
([source](https://slidelizard.com/en/features/slide-updates)), and Seismic has a
"manage outdated content" flow. When the refresh picks a winner per cluster, mark
the losers retired rather than deleting them, so an old published deck can still
explain what its page came from.

**Ticket 03 (what a chapter is).** Two alternatives to react to, neither of which
the ticket currently considers.
- **Rules instead of picks (Seismic LiveDocs).** Depth as a condition on each
  slide, evaluated against a deck-level input such as `depth: management | product`,
  rather than an explicit pick per chapter. Same result, no chapter object, and it
  degrades badly once conditions multiply. Worth rejecting explicitly rather than
  by omission.
- **Named subsets (PowerPoint Custom Shows).** A master holds every slide in the
  chapter and each deck names the subset it presents
  ([source](https://support.microsoft.com/en-us/office/create-and-present-a-custom-show-09d4d340-3c47-4125-b177-0de3be462c5d)).
  This is close to Floris's instinct and cheaper than chapters, but it cannot
  express "these three slides are alternatives to that one", which is the actual
  requirement. Also worth recording as considered and rejected.
- Confirming, not overturning: nobody ships the chapter model, so there is no
  proven design to copy and the prototype in ticket 03 is doing real work.

**Ticket 04 (drift and local edits).** The strongest findings on the map, and one
of them changes the option set.
- **Add a fourth option: keep both.** Templafy (unlocked) and SlideLizard
  ("Insert Copy") both resolve the conflict by inserting the new version beside the
  old, marking the old outdated, and letting the human merge. For us that means the
  accept view can offer *accept*, *keep mine*, and *keep both as two pages*, the
  last of which needs no per-element merge logic at all. The ticket currently lists
  detach, override and block.
- **Override at element level is real but expensive, and Figma shows the price.**
  Figma is the only tool that keeps overrides through an update, and it can only do
  it because instances are forbidden structural changes. Our htmlcheck already
  forbids structural change on a save, so the analogy holds and the recommendation
  stands. Note what it costs: Figma cannot let an instance add or remove a layer,
  and we will not be able to let an edited page add or remove an element either.
- **Override retention needs a stable identity.** Figma retains overrides by
  matching **layer names** and loses them when a name changes
  ([source](https://help.figma.com/hc/en-us/articles/360039150733-Modify-component-instances)).
  If we diff by node position, a mother-slide edit that reorders two paragraphs
  will silently throw away a local edit. The per-element accept has to key on a
  stable element id written into the slide fragment, which is a new requirement on
  the library slide format that the ticket does not currently mention.
- **Detach-on-keep-mine is what empower actually does**, and it is stated as a
  consequence rather than a choice: keep your version and the slide leaves the
  update group permanently. If we choose override instead, that is a deliberate
  divergence and worth writing down as such.
- **Content hash is consistent with the field.** Nobody exposes slide version
  numbers to end users. They all just say "a newer version exists".

**Ticket 05 (the app surface).** Mostly confirming, with three concrete borrowings.
- **Copy Figma's review surface wholesale**: a badge with a count, an Updates list,
  a side-by-side default view with an overlay alternative, Update per item and
  Update all. It is the most-used version of this UI in the world and it needs no
  invention.
- **A dismissed flag must come back.** Templafy's notification reappears on every
  open until the update is accepted, and SlideLizard's ignored update reappears on
  the next check. Do not build a dismiss that is permanent.
- **The boundary question has a precedent.** Highspot's answer is a permission:
  admins enable or disable content editing and remix per role, and Remix lets reps
  reorder slides but never change slide content. That is exactly our CLI/app wall
  expressed as a setting rather than a mechanism. It supports widening htmlcheck by
  one verified hole rather than moving the wall.

**Ticket 06 (customer decks).** Confirming, with one warning.
- **The already-sent problem splits by artefact type, not by policy.** Link-hosted
  tools update what was sent (DIGIDECK: "including presentations sent months ago").
  File-based tools cannot, so they flag on next open (Templafy, empower,
  SlideLizard). Our target is a PDF, so already-sent is frozen by construction and
  the charting decision is structurally right rather than merely cautious.
- **Warning on tracking picks versus content.** Highspot's Smart Update flags
  slides inside content a rep has already customised, which is our case exactly,
  and it flags **slide content only**. Nothing in the scan propagates a structural
  change (a new section) into an already-built deck. The recommendation that a
  customer deck tracks content but not chapter structure matches every shipped
  tool I could find.

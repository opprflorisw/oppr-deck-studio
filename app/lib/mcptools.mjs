// The MCP tool set, declared as data.
//
// Name, schema, access, audit action and annotations in one place, so the
// dispatcher, the guard, the audit trail and the Settings page all derive from
// the same table instead of four hand-maintained copies. The Settings page was
// one of those copies, and it already carried a promise the tool did not keep.
//
// ACCESS is the whole permission model, and it is enforced by the dispatcher
// rather than by each tool remembering:
//
//   "read"       any active member, viewer included
//   "leaf-write" an editor. If the call names a deck, requireLeaf runs first, so
//                a write aimed at a MASTER is refused to anyone but an owner --
//                the defence-in-depth the module header has claimed since August
//                while requireLeaf sat imported and never called.
//
// There is deliberately no "mother" access level, because there is deliberately
// no tool that does mother work. Editing a master, archiving a library slide,
// reassigning is_master, rebuilding an index: none of them exist here. The
// absence IS the boundary, and adding an access level for them would be the
// first step to eroding it.

export const ACCESS = { READ: "read", LEAF: "leaf-write" };

/**
 * Every tool. `impl` is filled in by mcp.mjs, which owns the bodies; this file
 * owns what a tool IS.
 */
export const TOOL_SPECS = [
  // --- who and what ---------------------------------------------------------
  {
    name: "whoami",
    title: "Who am I",
    access: ACCESS.READ,
    description:
      "The account this connector is acting as, and what that account may do. " +
      "Useful when a write is refused and it is not obvious why.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "customers_list",
    title: "List customers",
    access: ACCESS.READ,
    description:
      "Every registered customer, with the clearance slug a deck must hold to name them " +
      "and how many decks they have.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "customer_create",
    title: "Register a customer",
    access: ACCESS.LEAF,
    audit: "customer.create",
    description:
      "Register a new customer so decks can be filed under them and cleared to name them. " +
      "Refuses a name that would retroactively break published decks (a company called " +
      "'Data' would break most of them), reporting which decks it would break.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name as it is written on a slide, e.g. 'Rhyze'" },
        notes: { type: "string", description: "Optional free notes" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "customer_note",
    title: "Add a note to a customer",
    access: ACCESS.LEAF,
    audit: "customer.note",
    description:
      "Append a dated line to a customer's notes. What you learned in a meeting, " +
      "recorded where the next person will find it.",
    inputSchema: {
      type: "object",
      properties: {
        customer: { type: "string", description: "Customer slug" },
        note: { type: "string", description: "One line. It is stamped with today's date." },
      },
      required: ["customer", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "customer_timeline",
    title: "Customer timeline",
    access: ACCESS.READ,
    description:
      "What has been sent to a customer and when, newest first, including which version " +
      "they hold and whether the deck has changed since.",
    inputSchema: {
      type: "object",
      properties: { customer: { type: "string", description: "Customer slug" } },
      required: ["customer"],
      additionalProperties: false,
    },
  },
  {
    name: "decks_for_customer",
    title: "Decks for a customer",
    access: ACCESS.READ,
    description: "Every deck filed under a customer, with its type, current version and page count.",
    inputSchema: {
      type: "object",
      properties: { customer: { type: "string", description: "Customer slug" } },
      required: ["customer"],
      additionalProperties: false,
    },
  },
  {
    name: "company_decks_list",
    title: "List company decks",
    access: ACCESS.READ,
    description:
      "The reusable company decks (masters), one per type. These are what a customer deck " +
      "is copied from. They cannot be edited here: changing one changes every deck built " +
      "from it afterwards, which is owner work in the app.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "decks_search",
    title: "Find a deck",
    access: ACCESS.READ,
    description:
      "Search decks by title, slug, note, type or customer. Use it when you know roughly " +
      "what a deck is but not its slug.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to match" },
        kind: { type: "string", description: "Optional: deck, carousel, image, article" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "deck_read",
    title: "Read a deck",
    access: ACCESS.READ,
    description:
      "A deck's details and the visible text of a version, slide by slide. Use this to see " +
      "what a deck actually says before copying or sending it.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Deck slug" },
        version: { type: "integer", description: "Version number; defaults to current" },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_status",
    title: "Is this deck safe to send",
    access: ACCESS.READ,
    description:
      "Whether a deck's current version passed the brand gate, whether its PDF exists, " +
      "whether its slides have moved on since it was built, and who is holding which version. " +
      "Ask this before sending.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Deck slug" } },
      required: ["slug"],
      additionalProperties: false,
    },
  },

  // --- the library ----------------------------------------------------------
  {
    name: "library_search",
    title: "Search the slide library",
    access: ACCESS.READ,
    description:
      "Find slides by words or by chapter. Returns what each slide is for, so a deck can " +
      "be composed from what already exists.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to match against id, title, chapter and goal" },
        chapter: { type: "string", description: "Optional chapter id, e.g. ch-evidence" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "library_chapters",
    title: "The library, by chapter",
    access: ACCESS.READ,
    description:
      "Every chapter in reading order and the slides in each, with what the chapter is for. " +
      "This is the menu a deck is composed from: pick from each chapter, and skipping a " +
      "chapter drops every slide under it.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "slide_read",
    title: "Read a slide",
    access: ACCESS.READ,
    description:
      "One slide's text, what it is for, when to use it, and which slides it goes with.",
    inputSchema: {
      type: "object",
      properties: { slide_id: { type: "string", description: "Slide id, e.g. kpi-payback" } },
      required: ["slide_id"],
      additionalProperties: false,
    },
  },

  // --- composing a deck -----------------------------------------------------
  {
    name: "deck_start",
    title: "Start a deck",
    access: ACCESS.LEAF,
    audit: "draft.start",
    description:
      "Begin a deck for a customer. By default it copies the company deck (master) for its " +
      "type -- its slides and their order -- which is a COPY, not a link: the master is " +
      "untouched and this deck publishes as its own v1. Slides the new deck is not cleared " +
      "for are dropped, and it says which.",
    inputSchema: {
      type: "object",
      properties: {
        customer: { type: "string", description: "Customer slug. Register them first if new." },
        from: { type: "string", description: "Deck slug to copy the slides from, or 'empty'. Defaults to the master for the type." },
        type: { type: "string", description: "teaser, engagement, customer, product-showcase, management-outlook, investor" },
        title: { type: "string", description: "Optional; a sensible one is derived from the customer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "deck_open",
    title: "Edit an existing deck",
    access: ACCESS.LEAF,
    audit: "draft.open",
    description:
      "Open a published deck's slides for editing. Publishing afterwards adds a new version; " +
      "the deck's slug, customer and clearance are inherited and cannot be changed.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Deck slug" } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_slides",
    title: "Choose the slides",
    access: ACCESS.LEAF,
    description:
      "Add, remove or reorder the slides in a draft. Refuses a slide that is retired, " +
      "archived, or beyond this deck's clearance, and says which of those it is.",
    inputSchema: {
      type: "object",
      properties: {
        draft: { type: "string", description: "Draft id from deck_start or deck_open" },
        add: { type: "array", items: { type: "string" }, description: "Slide ids to add" },
        remove: { type: "array", items: { type: "string" }, description: "Slide ids to remove" },
        order: { type: "array", items: { type: "string" }, description: "The full slide order" },
      },
      required: ["draft"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_vars",
    title: "Fill in the deck's details",
    access: ACCESS.LEAF,
    description:
      "Set the title, footer, cover meta and the customer-specific values a deck carries. " +
      "These are variables, never edits to a slide.",
    inputSchema: {
      type: "object",
      properties: {
        draft: { type: "string", description: "Draft id" },
        title: { type: "string" },
        deck_footer: { type: "string", description: "The line in every content slide's footer" },
        cover_meta: { type: "string", description: "The line under the cover title" },
        prepared_for: { type: "string" },
        vars: { type: "object", description: "Any other {{variables}} the picked slides need",
                additionalProperties: { type: "string" } },
      },
      required: ["draft"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_check",
    title: "Check the deck before publishing",
    access: ACCESS.LEAF,
    description:
      "Build the draft without publishing and report what would happen: the slides in order, " +
      "and every brand-gate finding in plain words. ALWAYS run this and show the result to " +
      "the person before publishing.",
    inputSchema: {
      type: "object",
      properties: { draft: { type: "string", description: "Draft id" } },
      required: ["draft"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_publish",
    title: "Publish the deck",
    access: ACCESS.LEAF,
    audit: "deck.publish",
    description:
      "Publish the draft as an immutable version, behind the same gate as every other build. " +
      "Requires confirm:true, and you must show the person the deck_check result and get " +
      "their approval first. A new deck publishes as v1; an opened deck adds the next version.",
    inputSchema: {
      type: "object",
      properties: {
        draft: { type: "string", description: "Draft id" },
        change_note: { type: "string", description: "One line saying what changed. Kept forever." },
        confirm: { type: "boolean", description: "Must be true. Ask the person first." },
      },
      required: ["draft"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_pdf",
    title: "Get the PDF",
    access: ACCESS.LEAF,
    audit: "deck.pdf",
    description:
      "A link to download a deck's PDF, valid for ten minutes and only for you. Prints it " +
      "first if it has not been printed. If the deck fails the brand gate, no file is " +
      "produced and the findings come back instead.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Deck slug" },
        version: { type: "integer", description: "Version; defaults to current" },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_record_sent",
    title: "Record that a deck was sent",
    access: ACCESS.LEAF,
    audit: "deck.sent",
    description:
      "Record that a deck went to a customer, pinned to the exact version they received, so " +
      "'what are they holding' and 'has it changed since' stay answerable.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Deck slug" },
        recipient: { type: "string", description: "Who it went to, e.g. 'Jan de Vries, CFO'" },
        note: { type: "string", description: "Optional context" },
        version: { type: "integer", description: "Version sent; defaults to current" },
        sent_at: { type: "string", description: "ISO date; defaults to now" },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
];

/** What the client sees. Annotations are derived, so they cannot disagree. */
export function toolList() {
  return TOOL_SPECS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: {
      readOnlyHint: t.access === ACCESS.READ,
      // Nothing here deletes or overwrites: a version is immutable, a send is an
      // event, a draft is the caller's own.
      destructiveHint: false,
      idempotentHint: t.access === ACCESS.READ,
      openWorldHint: false,
    },
  }));
}

const BY_NAME = new Map(TOOL_SPECS.map((t) => [t.name, t]));
export const specFor = (name) => BY_NAME.get(name) || null;

/**
 * Default-deny, by inversion: a tool that is not declared read IS a write, so
 * one added and forgotten is refused to viewers rather than handed to them.
 */
export const isWriteTool = (name) => specFor(name)?.access !== ACCESS.READ;

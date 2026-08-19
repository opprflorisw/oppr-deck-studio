-- Deck Studio — baseline schema, captured 2026-08-19 from the live project.
--
-- WHY THIS FILE EXISTS
--
-- Until today the database was the one component of this system with no record
-- in the repo. Fifteen tables, seven functions, seven triggers, forty-odd
-- policies and two audit RPCs existed only inside the hosted project. The
-- consequences were not theoretical:
--
--   * A fresh clone could not stand up a working backend, so nobody could run
--     the system end to end without production credentials.
--   * There was no staging or branch database, because there was nothing to
--     apply to one.
--   * check-access.py could not verify its own append-only claim and hardcoded
--     `True` for it.
--   * Reviewing a schema change meant reading a dashboard, so the two policy
--     holes this repo has now found were both found by accident rather than by
--     review.
--
-- Every invariant the code comments describe — one master per type, a send names
-- a real version, an artifact's clearance cannot widen, the audit log cannot be
-- rewritten — was enforced in JavaScript and Python, twice, against a shape
-- nobody could read. This file is that shape, written down.
--
-- FROM NOW ON: every schema change is a migration file in this directory,
-- applied with the Supabase CLI or the Supabase MCP. Hand-editing in the
-- dashboard is how the `allow_authenticated` hole got in and how the storage
-- one stayed in.
--
-- Idempotent on purpose: it can be applied to the live project (where it is a
-- no-op) and to an empty branch database (where it builds everything).

-- ---------------------------------------------------------------------------
-- 1. Membership predicates
--
-- Three questions the policies ask. SECURITY DEFINER so a member can be
-- identified without being able to read the whole profiles table, and every one
-- re-checks `not disabled` and the @oppr.ai suffix, so revoking access is a
-- single flag rather than a sweep through forty policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and not disabled and lower(email) like '%@oppr.ai'
  )
$$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and not disabled and role in ('owner', 'editor')
      and lower(email) like '%@oppr.ai'
  )
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and not disabled and role = 'owner'
      and lower(email) like '%@oppr.ai'
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Accounts
--
-- Invitation-only, @oppr.ai-only, enforced by triggers on auth.users rather
-- than by the UI: a rule the front end owns is a rule the API does not have.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text not null default '',
  role         text not null default 'editor' check (role in ('owner','editor','viewer')),
  disabled     boolean not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.invited_emails (
  email      text primary key,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now()
);

-- The profile row is written by the database, not the app, so an account can
-- never exist without one. Creating it also CONSUMES the invitation, which is
-- what makes an invitation single-use.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  delete from public.invited_emails where email = lower(new.email);
  return new;
end $$;

create or replace function public.enforce_oppr_domain()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.email is null or lower(new.email) not like '%@oppr.ai' then
    raise exception 'Deck Studio is restricted to @oppr.ai accounts (got: %)', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- A password proves nothing about owning the mailbox, so an uninvited @oppr.ai
-- address is refused too. This matters more since magic links went away.
create or replace function public.enforce_signup_invite()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.invited_emails where email = lower(new.email)) then
    raise exception 'Deck Studio accounts are created by an owner, not by signing up (got: %)', new.email
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

-- A member editing their own row must not be able to promote themselves. The
-- service role (the local agent and the CLI) has no auth.uid() and is exempt.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;  -- service role (local agent / CLI)
  end if;
  if (new.role is distinct from old.role or new.disabled is distinct from old.disabled)
     and not public.is_owner() then
    raise exception 'only an owner may change role or disabled'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists enforce_oppr_domain on auth.users;
create trigger enforce_oppr_domain
  before insert on auth.users
  for each row execute function public.enforce_oppr_domain();

drop trigger if exists enforce_signup_invite on auth.users;
create trigger enforce_signup_invite
  before insert on auth.users
  for each row execute function public.enforce_signup_invite();

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- 3. Customers
--
-- `clearance` is deliberately NOT a column: it is derived from slug and name by
-- one function shared by the picker chip and the verify gate (namescope.mjs),
-- so the thing you tick and the thing that blocks cannot disagree.
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  logo_object text,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. The one artifact model
--
-- A deck, a carousel, a social image and an article are the same record, told
-- apart by `kind`, with `page_format` declaring the geometry the verify gate
-- holds them to. That is what lets one editor, one gate, one build job and one
-- version history serve all of them. Never add a parallel store for a new
-- output type: give it a kind.
-- ---------------------------------------------------------------------------

create table if not exists public.decks (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  title                  text not null,
  type                   text not null,
  is_master              boolean not null default false,
  kind                   text not null default 'deck'
                           check (kind in ('deck','carousel','image','article','post')),
  page_format            text not null default 'deck-16x9'
                           check (page_format in ('deck-16x9','linkedin-4x5','square-1x1',
                                                  'hero-1200x627','none')),
  channel                text not null default '',
  category               text not null default '',

  audience_kind          text not null default 'general'
                           check (audience_kind in ('general','customer','person','event')),
  customer_id            uuid references public.customers(id),
  audience_label         text not null default '',
  client_slug            text not null default '',

  -- What this artifact is allowed to CARRY. Derived server-side from the
  -- customer; never accepted from a request.
  allowed_entitlements   text[] not null default '{public}',

  status                 text not null default 'ok' check (status in ('ok','needs_cli')),
  needs_cli_reason       text not null default '',
  current_version_n      integer not null default 0,

  derived_from_deck_id   uuid references public.decks(id),
  derived_from_version_n integer,

  -- Findability and channel copy. Columns, not a side table, and none of them
  -- makes a version.
  note                   text not null default '',
  starred                boolean not null default false,
  post_text              text not null default '',
  pdf_core               text not null default '',

  -- The builder's unpublished working state. A draft, never a version.
  draft_recipe           jsonb,
  draft_updated_at       timestamptz,
  draft_updated_by       uuid references public.profiles(id),

  -- Archiving shelves; it never deletes. There is no DELETE path for a deck
  -- anywhere in the application.
  archived               boolean not null default false,
  archived_at            timestamptz,
  archived_by            uuid references public.profiles(id),
  archive_note           text,

  created_by             text not null default 'floris',
  created_by_id          uuid references public.profiles(id),
  updated_by_id          uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- A master is a TAG, not a folder, and there is exactly one per type. The
-- folder-suffix versioning this replaced (engagement-v2/, -v3/) is the mistake
-- the whole model exists to prevent.
create unique index if not exists one_master_per_type on public.decks (type) where is_master;
create index if not exists decks_kind_idx     on public.decks (kind);
create index if not exists decks_archived_idx on public.decks (archived) where archived;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists decks_set_updated_at on public.decks;
create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Versions — immutable, one row per save
--
-- Nothing updates `html`. Restore copies an old document forward as a NEW n; it
-- never rewinds the pointer. "Look back" is this timeline.
-- ---------------------------------------------------------------------------

create table if not exists public.deck_versions (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.decks(id) on delete cascade,
  n             integer not null,
  html          text not null,          -- the self-contained snapshot
  recipe        jsonb,                  -- schema 2: chapters + order + vars + content hashes
  verify_report jsonb,
  page_count    integer not null default 0,
  pdf_object    text,                   -- storage path of the PASS PDF
  change_note   text not null default '',
  author        text not null default 'floris',
  author_id     uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (deck_id, n)
);

create index if not exists deck_versions_recipe_gin
  on public.deck_versions using gin (recipe jsonb_path_ops);

-- Page count is the document's own, computed where the document lives, so an
-- app and a CLI cannot disagree about how long a deck is.
create or replace function public.deck_version_page_count()
returns trigger language plpgsql as $$
begin
  new.page_count := greatest(
    coalesce(array_length(string_to_array(lower(coalesce(new.html, '')), '<section'), 1), 1) - 1, 0);
  return new;
end $$;

drop trigger if exists deck_versions_page_count on public.deck_versions;
create trigger deck_versions_page_count
  before insert or update of html on public.deck_versions
  for each row execute function public.deck_version_page_count();

-- Assets are deduped by content hash across the versions of one deck.
create table if not exists public.deck_assets (
  deck_id        uuid not null references public.decks(id) on delete cascade,
  filename       text not null,
  storage_object text not null,
  entitlement    text not null default 'public',
  sha256         text,
  primary key (deck_id, filename)
);

-- ---------------------------------------------------------------------------
-- 6. Sends — an event, not a property
--
-- Pinned to (deck_id, version_n) because versions are immutable and the deck
-- keeps moving: "sent on the 7th" cannot answer what the customer is holding,
-- and comparing the sent version to current_version_n gives "they have v1, we
-- are on v3" for free.
-- ---------------------------------------------------------------------------

create table if not exists public.deck_sends (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.decks(id) on delete cascade,
  version_n     integer not null,
  sent_at       timestamptz not null default now(),
  sent_by       uuid references auth.users(id),
  sent_by_email text,
  recipient     text not null default '',
  note          text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists deck_sends_deck_idx on public.deck_sends (deck_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- 7. The library mirror
--
-- Derived from the repo, which stays the source of truth. `archived` is the one
-- column the app owns, and `studio sync-library` must never overwrite it —
-- promoting it back into meta.yaml as `retired: true` is a deliberate step.
-- ---------------------------------------------------------------------------

create table if not exists public.library_slides (
  slide_id     text primary key,
  content_hash text not null,
  chapter      text,
  role         text,
  title        text,
  goal         text,
  entitlements text[] not null default '{}',
  retired      boolean not null default false,   -- the repo's flag, git-versioned
  archived     boolean not null default false,   -- demoted in the app
  archived_at  timestamptz,
  archived_by  text,
  archive_note text,
  synced_at    timestamptz not null default now()
);

create index if not exists library_slides_pickable on public.library_slides (retired, archived);

create table if not exists public.library_chapters (
  id        text primary key,
  n         text,
  title     text not null,
  purpose   text,
  slides    jsonb not null default '[]',
  synced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Operations
-- ---------------------------------------------------------------------------

create table if not exists public.build_jobs (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.decks(id) on delete cascade,
  version_n     integer not null,
  state         text not null check (state in ('running','pass','fail','error')),
  verify_report jsonb,
  pdf_object    text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table if not exists public.publish_log (
  slug        text primary key,
  status      text not null default 'draft' check (status in ('draft','posted')),
  posted_date text not null default '',
  url         text not null default '',
  archived    boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Append-only BY CONSTRUCTION: there is no UPDATE or DELETE policy below, so
-- even an owner cannot rewrite history through the API.
create table if not exists public.audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_email text not null default '',
  action      text not null,
  deck_id     uuid,
  detail      jsonb not null default '{}'
);

create index if not exists audit_log_at_idx   on public.audit_log (at desc);
create index if not exists audit_log_deck_idx on public.audit_log (deck_id, at desc);

-- ---------------------------------------------------------------------------
-- 9. Legacy, retained until Deck Studio 5 phase 2 drains them
--
-- social_outputs is the registry the one-artifact model replaced; reference_files
-- has no reader anywhere in the repo. Both are scheduled for deletion, and are
-- reproduced here so the baseline matches the live project exactly rather than
-- describing a database that does not exist.
-- ---------------------------------------------------------------------------

create table if not exists public.social_outputs (
  channel      text not null,
  slug         text not null,
  path         text not null,
  kind         text not null default 'post',
  category     text not null default '',
  idx_path     text,
  pdf_path     text,
  image_path   text,
  post_path    text,
  article_path text,
  created_at   timestamptz not null default now(),
  primary key (channel, slug)
);

create table if not exists public.reference_files (
  path           text primary key,
  storage_object text not null,
  bytes          bigint,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. Row level security
--
-- The browser is proxy-only: it never talks to PostgREST or Storage, and the
-- agent holds the secret key server-side. These policies are therefore the
-- second line, not the first — which is exactly why they must be right, and
-- exactly why two holes in them went unnoticed for weeks.
--
-- Shape, everywhere: read = any member, write = editor, delete = owner.
-- ---------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.invited_emails   enable row level security;
alter table public.customers        enable row level security;
alter table public.decks            enable row level security;
alter table public.deck_versions    enable row level security;
alter table public.deck_assets      enable row level security;
alter table public.deck_sends       enable row level security;
alter table public.library_slides   enable row level security;
alter table public.library_chapters enable row level security;
alter table public.build_jobs       enable row level security;
alter table public.publish_log      enable row level security;
alter table public.audit_log        enable row level security;
alter table public.social_outputs   enable row level security;
alter table public.reference_files  enable row level security;

do $$
declare t text;
begin
  -- The content tables all take the same shape.
  foreach t in array array['customers','decks','deck_versions','deck_assets','deck_sends',
                           'build_jobs','publish_log','social_outputs','reference_files']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_editor())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_owner())', t || '_delete', t);
  end loop;
end $$;

-- The library mirror is read-only to everyone: it is written by the CLI with
-- the service key, and archiving goes through the app's own guarded route.
drop policy if exists library_slides_read on public.library_slides;
create policy library_slides_read on public.library_slides
  for select to authenticated using (public.is_member());

drop policy if exists library_chapters_read on public.library_chapters;
create policy library_chapters_read on public.library_chapters
  for select to authenticated using (public.is_member());

-- Profiles: everyone sees the team, an owner may change anyone, and you may
-- change yourself — but guard_profile_privileges() still refuses a self-promotion.
drop policy if exists profiles_select       on public.profiles;
drop policy if exists profiles_update_owner on public.profiles;
drop policy if exists profiles_update_self  on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (public.is_member());
create policy profiles_update_owner on public.profiles
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid() and public.is_member())
  with check (id = auth.uid());

-- invited_emails carries no policy at all: it is written only with the service
-- key, and an invitation list a member could read is a list of who is coming.

-- Audit: a member may read it and may write their OWN rows. No update, no
-- delete, by anyone.
drop policy if exists audit_select on public.audit_log;
drop policy if exists audit_insert on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_member());
create policy audit_insert on public.audit_log
  for insert to authenticated with check (public.is_member() and actor_id = auth.uid());

-- Storage. A deck's PDF is the whole deck, so the bucket is private and these
-- take the same shape as the tables.
--
-- NOTE the policy that is deliberately absent: "authenticated all deck-files",
-- ALL TO authenticated USING (bucket_id = 'deck-files'), which lived here until
-- 2026-08-19. Permissive policies are OR'd, so it silently nullified all four
-- rules below and handed every PDF, asset and mirrored library file to any
-- signed-in user — including a viewer and including a disabled account, because
-- unlike its neighbours it never called is_member(). It is the same defect as
-- the `allow_authenticated` hole found on eight tables on 2026-08-07, one schema
-- over, and it survived that clean-up because policy_audit() only looked in
-- `public`. Both now look everywhere.
drop policy if exists "authenticated all deck-files" on storage.objects;
drop policy if exists deck_files_select on storage.objects;
drop policy if exists deck_files_insert on storage.objects;
drop policy if exists deck_files_update on storage.objects;
drop policy if exists deck_files_delete on storage.objects;
create policy deck_files_select on storage.objects
  for select to authenticated using (bucket_id = 'deck-files' and public.is_member());
create policy deck_files_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'deck-files' and public.is_editor());
create policy deck_files_update on storage.objects
  for update to authenticated using (bucket_id = 'deck-files' and public.is_editor())
  with check (bucket_id = 'deck-files' and public.is_editor());
create policy deck_files_delete on storage.objects
  for delete to authenticated using (bucket_id = 'deck-files' and public.is_owner());

-- ---------------------------------------------------------------------------
-- 11. The audit RPCs
--
-- These exist because an adversarial suite that models only outsiders is half a
-- suite: `allow_authenticated` sat wide open on eight tables while the access
-- tests reported 17/17, because they only ever tested as `anon`, and an outsider
-- test cannot see a grant made to `authenticated`.
--
-- They look in public, storage AND auth, because scoping the first version to
-- `public` is precisely how the storage hole hid for twelve days.
-- ---------------------------------------------------------------------------

create or replace function public.policy_audit()
returns table(table_name text, policy_name text, cmd text, roles text,
              qual text, with_check text)
language sql security definer set search_path to 'public', 'pg_catalog'
as $$
  select
    (p.schemaname || '.' || p.tablename)::text,
    p.policyname::text,
    p.cmd::text,
    p.roles::text,
    coalesce(p.qual, '')::text,
    coalesce(p.with_check, '')::text
  from pg_policies p
  where p.schemaname in ('public', 'storage', 'auth')
    and p.permissive = 'PERMISSIVE'
    and (p.qual = 'true' or p.with_check = 'true'
         -- or scoped ONLY by which bucket it is, which is not a permission:
         -- every object in deck-files is deck content.
         or p.qual ~ '^\(?bucket_id = ''[a-z-]+''::text\)?$'
         or p.with_check ~ '^\(?bucket_id = ''[a-z-]+''::text\)?$')
    -- service_role bypasses RLS anyway, so a grant to it is not a finding
    and not (p.roles::text = '{service_role}')
  order by 1, 2;
$$;

-- A table with RLS switched off needs no bad policy to be wide open, and the
-- policy audit would never see it.
create or replace function public.rls_disabled_tables()
returns table(table_name text)
language sql security definer set search_path to 'public', 'pg_catalog'
as $$
  select (n.nspname || '.' || c.relname)::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and c.relkind = 'r'
    and not c.relrowsecurity
  order by 1;
$$;

revoke all on function public.policy_audit()        from anon;
revoke all on function public.rls_disabled_tables() from anon;

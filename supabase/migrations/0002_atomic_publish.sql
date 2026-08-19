-- Publishing becomes one act.
--
-- Applied to the live project 2026-08-19.
--
-- THE PROBLEM
--
-- Every publish path was insert-the-version then bump-the-pointer, across two
-- HTTP calls with nothing holding them together. publish-article.py did it the
-- other way round: it set current_version_n to n BEFORE inserting version n.
--
-- A failure between the two leaves a deck pointing at a version that does not
-- exist. Every consumer in the system finds the current document by matching
-- `v.n = d.current_version_n`, so they all silently get nothing: the deck list
-- shows no verify state, no page count and no drift; the PDF route cannot
-- print; MCP's deck_read reports the deck has no such version. The deck looks
-- healthy in the list and cannot be opened, and nothing anywhere says why.
--
-- Version numbers were also computed in the application as `current + 1`, read
-- from a row another request may already have moved, and slugs by a
-- read-then-write loop against a UNIQUE index. Both are races that were only
-- ever narrow enough not to have been noticed.
--
-- THE SHAPE OF THE FIX
--
-- Allocate inside the transaction that writes. `for update` on the deck row
-- serialises publishes of the SAME deck; different decks never contend. Taking
-- max(n)+1 rather than current_version_n+1 also means the versions themselves
-- are the truth and the pointer is a cache of them, which is the right way
-- round if the two ever disagree.

create or replace function public.publish_version(
  p_deck_id       uuid,
  p_html          text,
  p_change_note   text    default '',
  p_author        text    default 'app',
  p_author_id     uuid    default null,
  p_pdf_object    text    default null,
  p_recipe        jsonb   default null,
  p_verify_report jsonb   default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n integer;
begin
  perform 1 from public.decks where id = p_deck_id for update;
  if not found then
    raise exception 'no such deck: %', p_deck_id using errcode = 'no_data_found';
  end if;

  select coalesce(max(n), 0) + 1 into v_n
  from public.deck_versions where deck_id = p_deck_id;

  insert into public.deck_versions
    (deck_id, n, html, change_note, author, author_id, pdf_object, recipe, verify_report)
  values
    (p_deck_id, v_n, p_html, coalesce(p_change_note, ''), coalesce(p_author, 'app'),
     p_author_id, p_pdf_object, p_recipe, p_verify_report);

  update public.decks
     set current_version_n = v_n,
         updated_by_id     = coalesce(p_author_id, updated_by_id),
         -- A clean report clears the needs-CLI banner. A failing one leaves
         -- whatever was there: this function does not decide whether a deck is
         -- allowed to be published, verify does, before it is ever called.
         status            = case when p_verify_report is null then status
                                  when jsonb_array_length(coalesce(p_verify_report->'fails','[]'::jsonb)) = 0
                                  then 'ok' else status end,
         needs_cli_reason  = case when p_verify_report is null then needs_cli_reason
                                  when jsonb_array_length(coalesce(p_verify_report->'fails','[]'::jsonb)) = 0
                                  then '' else needs_cli_reason end
   where id = p_deck_id;

  return v_n;
end $$;

-- Creating a deck has the same shape and the same problem: the row, its assets
-- and its v1 were three calls, so a failure midway left a deck at
-- current_version_n: 1 with no version row.
create or replace function public.create_deck_with_v1(
  p_slug          text,
  p_title         text,
  p_type          text,
  p_html          text,
  p_fields        jsonb  default '{}'::jsonb,
  p_change_note   text   default '',
  p_author        text   default 'app',
  p_author_id     uuid   default null,
  p_pdf_object    text   default null,
  p_recipe        jsonb  default null,
  p_verify_report jsonb  default null
) returns table(deck_id uuid, slug text, n integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_slug text := p_slug;
  v_i    integer := 1;
  v_id   uuid;
begin
  while exists (select 1 from public.decks d where d.slug = v_slug) loop
    v_i := v_i + 1;
    v_slug := p_slug || '-' || v_i;
    if v_i > 200 then
      raise exception 'could not allocate a slug from %', p_slug using errcode = 'too_many_rows';
    end if;
  end loop;

  insert into public.decks (
    slug, title, type, kind, page_format, channel, category,
    audience_kind, customer_id, audience_label, client_slug, allowed_entitlements,
    derived_from_deck_id, derived_from_version_n,
    created_by, created_by_id, updated_by_id, current_version_n
  ) values (
    v_slug, p_title, p_type,
    coalesce(p_fields->>'kind', 'deck'),
    coalesce(p_fields->>'page_format', 'deck-16x9'),
    coalesce(p_fields->>'channel', ''),
    coalesce(p_fields->>'category', ''),
    coalesce(p_fields->>'audience_kind', 'general'),
    nullif(p_fields->>'customer_id','')::uuid,
    coalesce(p_fields->>'audience_label', ''),
    coalesce(p_fields->>'client_slug', ''),
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(p_fields->'allowed_entitlements') x),
      array['public']),
    nullif(p_fields->>'derived_from_deck_id','')::uuid,
    nullif(p_fields->>'derived_from_version_n','')::integer,
    coalesce(p_author, 'app'), p_author_id, p_author_id, 1
  ) returning id into v_id;

  insert into public.deck_versions
    (deck_id, n, html, change_note, author, author_id, pdf_object, recipe, verify_report)
  values
    (v_id, 1, p_html, coalesce(p_change_note, ''), coalesce(p_author, 'app'),
     p_author_id, p_pdf_object, p_recipe, p_verify_report);

  return query select v_id, v_slug, 1;
end $$;

-- Called by the agent with the service key. No grant to anon or authenticated:
-- publishing goes through the app, which gates it, not straight through
-- PostgREST.
revoke all on function public.publish_version(uuid, text, text, text, uuid, text, jsonb, jsonb)
  from anon, authenticated;
revoke all on function public.create_deck_with_v1(text, text, text, text, jsonb, text, text, uuid, text, jsonb, jsonb)
  from anon, authenticated;

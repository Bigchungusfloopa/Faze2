-- 0001_core_schema.sql
--
-- The MODULUS core schema, reconstructed from application query call sites.
--
-- This project never had migrations; the schema lived only in a Supabase
-- dashboard we no longer have access to. Every table and column below was
-- verified against a real query in the codebase -- the source is cited above
-- each table. Anything the app does not read or write is deliberately absent.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_core_schema.sql

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- users
-- src/app/setup/page.tsx:70-154 (select + upsert of the profile fields)
-- src/components/user-menu.tsx  (name, college, profile_pic)
-- src/app/api/vault/upload/route.ts:36-51 (storage_used_bytes quota)
-- ---------------------------------------------------------------------------
create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  name               text,
  email              text,
  profile_pic        text,
  college            text,
  stream             text,
  course             text,
  year               text,
  tags               text[] not null default '{}',
  storage_used_bytes bigint not null default 0 check (storage_used_bytes >= 0),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- communities
-- src/actions/modules.ts:62-171
-- Declared before `folders` because folders.community_id references it.
-- ---------------------------------------------------------------------------
create table public.communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  type         text not null default 'Private',
  owner_id     uuid not null references public.users (id) on delete cascade,
  banner_url   text,
  -- Denormalised counter, recomputed in src/actions/modules.ts:45-51.
  member_count int not null default 1,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- community_members
-- src/actions/modules.ts:70-298, src/actions/vault.ts:13-21
-- Composite PK: the app always addresses a membership by (community, user).
-- ---------------------------------------------------------------------------
create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         text not null default 'pending'
                 check (role in ('owner', 'curator', 'peer', 'pending')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- ---------------------------------------------------------------------------
-- folders  (unified personal + community folder tree)
-- src/actions/vault.ts:25-119, src/app/api/vault/folders/route.ts
--
-- deleteVaultFolder (src/actions/vault.ts:87-119) reparents children to root
-- rather than cascading, so parent_id is ON DELETE SET NULL -- the app's
-- behaviour and the constraint agree.
-- ---------------------------------------------------------------------------
create table public.folders (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.users (id) on delete cascade,
  name         text not null,
  parent_id    uuid references public.folders (id) on delete set null,
  scope        text not null default 'vault' check (scope in ('vault', 'community')),
  community_id uuid references public.communities (id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- files  (one row per unique object in blob storage)
-- src/app/api/vault/upload/route.ts:62-72
--
-- NOTE: the column is `storage_key`, not `r2_object_key`. The app is moving
-- from Cloudflare R2 to an S3-compatible layer where the provider is a config
-- choice, so a vendor name in the schema would be a permanent inaccuracy.
-- checksum_sha256 is new: it backs upload dedupe and vault->corpus promotion.
-- ---------------------------------------------------------------------------
create table public.files (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.users (id) on delete cascade,
  storage_key     text not null unique,
  filename        text not null,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  checksum_sha256 text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vault_items
-- src/actions/vault.ts:123-254, src/app/api/vault/items/route.ts:20
--
-- file_id is null for links and notes; the check constraint encodes the
-- invariant the application assumes everywhere but never enforces.
-- ---------------------------------------------------------------------------
create table public.vault_items (
  id           uuid primary key default gen_random_uuid(),
  file_id      uuid references public.files (id) on delete cascade,
  owner_id     uuid not null references public.users (id) on delete cascade,
  item_type    text not null check (item_type in ('file', 'link', 'note')),
  title        text,
  url          text,
  note_content text,
  is_private   boolean not null default true,
  folder_id    uuid references public.folders (id) on delete set null,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  constraint vault_items_file_shape check (
    (item_type = 'file' and file_id is not null) or
    (item_type <> 'file' and file_id is null)
  )
);

-- ---------------------------------------------------------------------------
-- community_vault_folders
-- src/actions/vault.ts:357-469
-- deleteModuleVaultFolder recurses and deletes children explicitly, so
-- parent_id cascades here (unlike personal folders, which reparent).
-- ---------------------------------------------------------------------------
create table public.community_vault_folders (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name         text not null,
  parent_id    uuid references public.community_vault_folders (id) on delete cascade,
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- community_vault_items  (references into member vaults; never owns a file)
-- src/actions/vault.ts:258-346, src/app/api/communities/[id]/vault/route.ts
-- ---------------------------------------------------------------------------
create table public.community_vault_items (
  id                uuid primary key default gen_random_uuid(),
  community_id      uuid not null references public.communities (id) on delete cascade,
  vault_item_id     uuid not null references public.vault_items (id) on delete cascade,
  shared_by_user_id uuid references public.users (id) on delete set null,
  title             text,
  tags              text[] not null default '{}',
  folder_id         uuid references public.community_vault_folders (id) on delete set null,
  created_at        timestamptz not null default now(),
  -- The same vault item cannot be shared into one community twice.
  unique (community_id, vault_item_id)
);

-- ---------------------------------------------------------------------------
-- votes
-- src/app/api/votes/route.ts
--
-- The route hand-rolls an upsert: look up by (user, target_type, target_id),
-- then insert / update / delete. That lookup is only correct if the triple is
-- unique, so the constraint below is load-bearing, not decorative.
-- target_id is intentionally not a foreign key: it points at either a thread
-- or a reply depending on target_type, and neither table exists yet.
-- ---------------------------------------------------------------------------
create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  target_type text not null check (target_type in ('thread', 'reply')),
  target_id   uuid not null,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

-- ---------------------------------------------------------------------------
-- Indexes for the access patterns the app actually has.
-- ---------------------------------------------------------------------------
create index vault_items_owner_folder_idx  on public.vault_items (owner_id, folder_id);
create index vault_items_file_idx          on public.vault_items (file_id);
create index folders_owner_scope_idx       on public.folders (owner_id, scope, parent_id);
create index files_owner_idx               on public.files (owner_id);
create index community_members_user_idx    on public.community_members (user_id);
create index cv_items_community_folder_idx on public.community_vault_items (community_id, folder_id);
create index cv_folders_community_idx      on public.community_vault_folders (community_id, parent_id);

-- ---------------------------------------------------------------------------
-- auth.users -> public.users bridge.
--
-- THIS IS THE ONE THAT SILENTLY BREAKS EVERYTHING IF OMITTED.
--
-- Nothing in the application code creates a public.users row. Without this
-- trigger signup still "succeeds" -- Supabase Auth inserts into auth.users and
-- returns a session -- but the profile row never exists, so every profile,
-- quota and vault query returns empty with no error anywhere to explain it.
--
-- The function lives in `public` and only the trigger is attached to
-- `auth.users`: that is the supported arrangement, and the one that survives
-- a future `--schema=public` dump.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name, profile_pic)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Atomic storage quota accounting.
--
-- src/app/api/vault/upload/route.ts currently reads storage_used_bytes, checks
-- the limit, then writes back the sum -- a lost-update race under concurrent
-- uploads, and a TOCTOU gap between the check and the increment. This does
-- both in one statement: the row is locked by the UPDATE, and the limit is a
-- predicate rather than a separate read.
--
-- Returns the new total. Raises if the increment would breach the quota.
-- ---------------------------------------------------------------------------
create or replace function public.bump_storage_used(
  p_user  uuid,
  p_delta bigint,
  p_limit bigint default 524288000  -- 500 MB
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new bigint;
begin
  update public.users
     set storage_used_bytes = greatest(storage_used_bytes + p_delta, 0)
   where id = p_user
     and (p_delta <= 0 or storage_used_bytes + p_delta <= p_limit)
  returning storage_used_bytes into v_new;

  if not found then
    raise exception 'storage quota exceeded for user %', p_user
      using errcode = 'check_violation';
  end if;

  return v_new;
end
$$;

revoke all on function public.bump_storage_used(uuid, bigint, bigint) from public, anon;
grant execute on function public.bump_storage_used(uuid, bigint, bigint) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- The original project had none; authorization was enforced entirely by
-- `.eq('owner_id', user.id)` filters in application code, with six routes
-- falling back to a service-role client to bypass the absence.
--
-- Personal-scope tables get owner policies now, since those are unambiguous.
-- The community tables are left RLS-disabled in this migration: their access
-- rules depend on membership role and the existing routes already run through
-- the service role, so enabling RLS there without rewriting those routes would
-- break working features. That is a deliberate, separate piece of work.
-- ---------------------------------------------------------------------------
alter table public.users       enable row level security;
alter table public.files       enable row level security;
alter table public.vault_items enable row level security;
alter table public.folders     enable row level security;

-- (select auth.uid()) rather than auth.uid() so the planner hoists it into an
-- InitPlan and evaluates it once per query instead of once per row.
create policy users_self_rw on public.users
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy files_owner_rw on public.files
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy vault_items_owner_rw on public.vault_items
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy folders_owner_rw on public.folders
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

commit;

-- 0005_workspaces.sql
--
-- Shared workspaces: join by name + password (a shared secret, like a room
-- code -- not a per-user Supabase Auth credential). A user must already be
-- signed in normally; the workspace password only gates membership in a
-- second, shared corpus that sits ALONGSIDE their personal one.
--
-- documents/chunks.workspace_id is nullable and additive: null keeps a
-- document exactly as it worked before this migration (owner_id-scoped,
-- personal). Setting it moves that document into a shared, workspace-scoped
-- corpus that every member can see and search, regardless of who uploaded it.
--
-- Two roles, deliberately simple: 'owner' (created the workspace, knows/can
-- rotate the password) and 'member' (can upload and chat). No moderation
-- tier -- see the migration comment near the RLS policies below for what
-- that does and doesn't cover yet.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0005_workspaces.sql

begin;

create type public.workspace_role as enum ('owner', 'member');

create table public.workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  password_hash text not null,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.workspace_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- documents / chunks: the optional workspace scope
-- ---------------------------------------------------------------------------
alter table public.documents add column workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.chunks    add column workspace_id uuid references public.workspaces (id) on delete cascade;

create index documents_workspace_idx on public.documents (workspace_id) where workspace_id is not null;
create index chunks_workspace_idx    on public.chunks    (workspace_id) where workspace_id is not null;

-- chunks.workspace_id is denormalised from its document for the same reason
-- owner_id already was: it turns the RLS policy on chunks into a flat
-- indexed comparison instead of a join back to documents evaluated per row
-- inside the vector scan. Rewritten (rather than just extended) so it always
-- trusts the document's CURRENT workspace_id, not just whatever the insert
-- happened to pass.
create or replace function public.tg_inherit_document_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner     uuid;
  v_workspace uuid;
begin
  select d.owner_id, d.workspace_id into v_owner, v_workspace
    from public.documents d where d.id = new.document_id;

  if v_owner is null then
    raise exception 'unknown document %', new.document_id;
  end if;

  if new.owner_id is null then
    new.owner_id := v_owner;
  end if;
  new.workspace_id := v_workspace;

  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS on documents / chunks -- replaces the owner-only policies from 0002.
--
-- SELECT: visible if it's your own personal document, OR you're a member of
-- the workspace it's shared to (any role). This is what makes "answers only
-- from that workspace's media" possible -- everyone in the workspace can see
-- everyone else's uploads there, not just their own.
--
-- INSERT: the same condition -- you can only create a document as yourself
-- (personal) or into a workspace you've actually joined.
--
-- UPDATE/DELETE: intentionally narrower than SELECT. Only the original
-- uploader (owner_id) or the workspace's owner can modify or delete a
-- workspace document. A plain member can see and query everyone's uploads,
-- but can only manage their own -- this is the real content of the
-- owner/member distinction. NOTE: the application routes as of this
-- migration only ever check owner_id, so a workspace owner deleting or
-- reprocessing another member's upload is not yet wired into the UI even
-- though this policy would permit it; that's future work, not a bug here.
-- ---------------------------------------------------------------------------
drop policy if exists documents_owner_rw on public.documents;

create policy documents_select on public.documents
  for select to authenticated
  using (
    (workspace_id is null and owner_id = (select auth.uid()))
    or (workspace_id is not null and exists (
      select 1 from public.workspace_members wm
       where wm.workspace_id = documents.workspace_id and wm.user_id = (select auth.uid())
    ))
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    (workspace_id is null and owner_id = (select auth.uid()))
    or (workspace_id is not null and exists (
      select 1 from public.workspace_members wm
       where wm.workspace_id = documents.workspace_id and wm.user_id = (select auth.uid())
    ))
  );

create policy documents_update on public.documents
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (workspace_id is not null and exists (
      select 1 from public.workspace_members wm
       where wm.workspace_id = documents.workspace_id and wm.user_id = (select auth.uid()) and wm.role = 'owner'
    ))
  );

create policy documents_delete on public.documents
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (workspace_id is not null and exists (
      select 1 from public.workspace_members wm
       where wm.workspace_id = documents.workspace_id and wm.user_id = (select auth.uid()) and wm.role = 'owner'
    ))
  );

drop policy if exists chunks_owner_rw on public.chunks;

create policy chunks_select on public.chunks
  for select to authenticated
  using (
    (workspace_id is null and owner_id = (select auth.uid()))
    or (workspace_id is not null and exists (
      select 1 from public.workspace_members wm
       where wm.workspace_id = chunks.workspace_id and wm.user_id = (select auth.uid())
    ))
  );

-- DELETE only (not insert/update): src/app/api/documents/[id]/reprocess/route.ts
-- clears a document's chunks with the caller's own cookie-scoped client
-- before re-ingesting. Every other chunk write goes through the admin
-- client, which bypasses RLS entirely.
create policy chunks_delete on public.chunks
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or (workspace_id is not null and exists (
      select 1 from public.workspace_members wm
       where wm.workspace_id = chunks.workspace_id and wm.user_id = (select auth.uid()) and wm.role = 'owner'
    ))
  );

-- ---------------------------------------------------------------------------
-- RLS on workspaces / workspace_members
--
-- workspaces_select intentionally does NOT let a non-member look a workspace
-- up by name -- that would make workspace names (half of the join secret)
-- enumerable. join_workspace() below is SECURITY DEFINER precisely so it can
-- look up any workspace by name to check the password, without this policy
-- granting that read to ordinary queries.
--
-- workspace_members_select is deliberately just "your own row," not "every
-- member of workspaces you're in" -- the natural way to write the latter
-- queries workspace_members from within its own RLS policy, which is a
-- self-referential recursion risk. A member-list UI is a real future
-- feature; it should be a SECURITY DEFINER function, not this policy.
-- ---------------------------------------------------------------------------
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;

create policy workspaces_select on public.workspaces
  for select to authenticated
  using (exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = workspaces.id and wm.user_id = (select auth.uid())
  ));

create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- create_workspace / join_workspace
--
-- Both SECURITY DEFINER: creating needs to insert into workspaces before any
-- membership (hence any RLS-granted visibility) exists, and joining needs to
-- look a workspace up by name+password before the caller is a member -- both
-- steps RLS above deliberately does not allow directly.
--
-- Password hashing uses pgcrypto's crypt()/gen_salt('bf') (bcrypt), enabled
-- already in 0001_core_schema.sql. Verification re-derives the hash using the
-- stored hash as crypt()'s salt argument -- the standard bcrypt-in-Postgres
-- pattern -- rather than ever comparing plaintext.
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text, p_password text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
  v_name text := trim(p_name);
begin
  if v_user is null then
    raise exception 'create_workspace: no authenticated user' using errcode = '42501';
  end if;
  if length(v_name) < 3 then
    raise exception 'Workspace name must be at least 3 characters.';
  end if;
  if length(p_password) < 4 then
    raise exception 'Workspace password must be at least 4 characters.';
  end if;

  insert into public.workspaces (name, password_hash, owner_id)
  values (v_name, extensions.crypt(p_password, extensions.gen_salt('bf')), v_user)
  returning workspaces.id into v_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_id, v_user, 'owner');

  return query select v_id, v_name;
end
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

create or replace function public.join_workspace(p_name text, p_password text)
returns table (id uuid, name text, role public.workspace_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_workspace record;
begin
  if v_user is null then
    raise exception 'join_workspace: no authenticated user' using errcode = '42501';
  end if;

  select w.id, w.name, w.password_hash into v_workspace
    from public.workspaces w where w.name = trim(p_name);

  if v_workspace.id is null then
    raise exception 'No workspace named "%" exists.', trim(p_name);
  end if;

  if extensions.crypt(p_password, v_workspace.password_hash) <> v_workspace.password_hash then
    raise exception 'Incorrect workspace password.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, v_user, 'member')
  on conflict (workspace_id, user_id) do nothing;

  return query
    select v_workspace.id, v_workspace.name, wm.role
      from public.workspace_members wm
     where wm.workspace_id = v_workspace.id and wm.user_id = v_user;
end
$$;

revoke all on function public.join_workspace(text, text) from public, anon;
grant execute on function public.join_workspace(text, text) to authenticated;

commit;

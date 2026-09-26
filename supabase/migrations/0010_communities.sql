-- 0010_communities.sql
--
-- Backs the Communities UI: a colour theme per workspace, a third role, and
-- member management. UI labels: owner = Admin, member = Editor, viewer = Viewer.
--
--   Admin  -- manage members/roles, delete the community, delete any file
--   Editor -- upload, delete own files, chat
--   Viewer -- read and chat only (no uploads)
--
-- ADD VALUE cannot share a transaction with statements that use the new
-- value, so it runs on its own before the transactional block.

alter type public.workspace_role add value if not exists 'viewer';

begin;

alter table public.workspaces
  add column if not exists theme_idx smallint not null default 0
  check (theme_idx between 0 and 5);

-- Viewers can see and search everything but cannot add documents.
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    (workspace_id is null and owner_id = (select auth.uid()))
    or (workspace_id is not null and exists (
      select 1 from public.workspace_members wm
       where wm.workspace_id = documents.workspace_id
         and wm.user_id = (select auth.uid())
         and wm.role in ('owner', 'member')
    ))
  );

-- New signature carries the theme. Drop the old one explicitly: CREATE OR
-- REPLACE with a different argument list would add an overload rather than
-- replace it (the bug 0006 fixed for hybrid_search_chunks).
drop function if exists public.create_workspace(text, text);

create function public.create_workspace(p_name text, p_password text, p_theme_idx int default 0)
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
    raise exception 'Community name must be at least 3 characters.';
  end if;
  if length(p_password) < 4 then
    raise exception 'Community password must be at least 4 characters.';
  end if;
  if exists (select 1 from public.workspaces w where w.name = v_name) then
    raise exception 'A community named "%" already exists.', v_name;
  end if;

  insert into public.workspaces (name, password_hash, owner_id, theme_idx)
  values (v_name, extensions.crypt(p_password, extensions.gen_salt('bf')), v_user,
          greatest(0, least(5, coalesce(p_theme_idx, 0))))
  returning workspaces.id into v_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_id, v_user, 'owner');

  return query select v_id, v_name;
end
$$;

revoke all on function public.create_workspace(text, text, int) from public, anon;
grant execute on function public.create_workspace(text, text, int) to authenticated;

-- Every community the caller belongs to, with the counts and member initials
-- the cards show. SECURITY DEFINER because workspace_members RLS only exposes
-- the caller's own row; the membership join below is the authorization.
create or replace function public.my_workspaces()
returns table (
  id uuid, name text, theme_idx smallint, role public.workspace_role,
  member_count bigint, file_count bigint, member_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, w.theme_idx, me.role,
         (select count(*) from public.workspace_members m where m.workspace_id = w.id),
         (select count(*) from public.documents d where d.workspace_id = w.id),
         array(
           select coalesce(nullif(u.name, ''), split_part(u.email, '@', 1), '?')
             from public.workspace_members m
             left join public.users u on u.id = m.user_id
            where m.workspace_id = w.id
            order by m.joined_at
            limit 4
         )
    from public.workspace_members me
    join public.workspaces w on w.id = me.workspace_id
   where me.user_id = auth.uid()
   order by me.joined_at desc;
$$;

revoke all on function public.my_workspaces() from public, anon;
grant execute on function public.my_workspaces() to authenticated;

create or replace function public.workspace_members_list(p_workspace_id uuid)
returns table (user_id uuid, name text, email text, role public.workspace_role, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this community.' using errcode = '42501';
  end if;

  return query
    select m.user_id,
           coalesce(nullif(u.name, ''), split_part(coalesce(u.email, au.email), '@', 1)),
           coalesce(u.email, au.email)::text,
           m.role, m.joined_at
      from public.workspace_members m
      left join public.users u on u.id = m.user_id
      left join auth.users au on au.id = m.user_id
     where m.workspace_id = p_workspace_id
     order by (m.role = 'owner') desc, m.joined_at;
end
$$;

revoke all on function public.workspace_members_list(uuid) from public, anon;
grant execute on function public.workspace_members_list(uuid) to authenticated;

-- Shared guard: a community must always keep at least one Admin.
create or replace function public._assert_not_last_admin(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id and user_id = p_user_id and role = 'owner'
  ) and (
    select count(*) from public.workspace_members
     where workspace_id = p_workspace_id and role = 'owner'
  ) <= 1 then
    raise exception 'A community needs at least one Admin. Promote someone else first.';
  end if;
end
$$;

revoke all on function public._assert_not_last_admin(uuid, uuid) from public, anon, authenticated;

create or replace function public.set_member_role(p_workspace_id uuid, p_user_id uuid, p_role public.workspace_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only an Admin can change roles.' using errcode = '42501';
  end if;
  if p_role <> 'owner' then
    perform public._assert_not_last_admin(p_workspace_id, p_user_id);
  end if;

  update public.workspace_members set role = p_role
   where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then
    raise exception 'That person is not a member of this community.';
  end if;
end
$$;

revoke all on function public.set_member_role(uuid, uuid, public.workspace_role) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, public.workspace_role) to authenticated;

-- Admins can remove anyone; anyone can remove themselves (leave).
create or replace function public.remove_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id <> auth.uid() and not exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only an Admin can remove members.' using errcode = '42501';
  end if;
  perform public._assert_not_last_admin(p_workspace_id, p_user_id);

  delete from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then
    raise exception 'That person is not a member of this community.';
  end if;
end
$$;

revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- Returns the storage keys of the deleted documents so the API route can
-- remove the files from the bucket (storage isn't reachable from SQL here).
create or replace function public.delete_workspace(p_workspace_id uuid)
returns table (storage_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only an Admin can delete this community.' using errcode = '42501';
  end if;

  return query
    with gone as (
      delete from public.documents d where d.workspace_id = p_workspace_id returning d.storage_key
    )
    select g.storage_key from gone g;

  delete from public.workspaces where id = p_workspace_id;
end
$$;

revoke all on function public.delete_workspace(uuid) from public, anon;
grant execute on function public.delete_workspace(uuid) to authenticated;

commit;

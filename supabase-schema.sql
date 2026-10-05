-- AI Teams cloud storage (Supabase)
-- Run this once in the Supabase SQL Editor.

create table if not exists public.ai_teams_projects (
  user_id uuid not null references auth.users(id) on delete restrict,
  project_id text not null,
  name text not null default 'AI Teams',
  state jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

alter table public.ai_teams_projects enable row level security;

-- Users can read and write only their own project.
drop policy if exists "ai teams select own projects" on public.ai_teams_projects;
create policy "ai teams select own projects"
on public.ai_teams_projects for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai teams insert own projects" on public.ai_teams_projects;
create policy "ai teams insert own projects"
on public.ai_teams_projects for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "ai teams update own projects" on public.ai_teams_projects;
create policy "ai teams update own projects"
on public.ai_teams_projects for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "ai teams delete own projects" on public.ai_teams_projects;
create policy "ai teams delete own projects"
on public.ai_teams_projects for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.ai_teams_projects to authenticated;

-- GitHub connection for AI Teams. OAuth tokens are encrypted by the Edge Function.
create table if not exists public.github_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_user_id bigint,
  github_login text not null,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  scopes text,
  updated_at timestamptz not null default now()
);
alter table public.github_connections enable row level security;
-- GitHub OAuth tokens are written/read only by the Edge Function with its server key.
-- The browser must never have direct table access to encrypted tokens.
drop policy if exists "github own connection select" on public.github_connections;
drop policy if exists "github own connection insert" on public.github_connections;
drop policy if exists "github own connection update" on public.github_connections;
revoke all on public.github_connections from anon, authenticated;

create table if not exists public.github_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text not null,
  expires_at timestamptz not null
);
alter table public.github_oauth_states enable row level security;
-- OAuth state is created/consumed only by the Edge Function using its server key.
revoke all on public.github_oauth_states from anon, authenticated;


-- AI Gateway abuse protection: per-user fixed-window limiter.
create table if not exists public.ai_gateway_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint ai_gateway_rate_limits_count_nonnegative check (request_count >= 0)
);
alter table public.ai_gateway_rate_limits enable row level security;
revoke all on public.ai_gateway_rate_limits from anon, authenticated;

create or replace function public.consume_ai_gateway_rate_limit(
  p_user_id uuid,
  p_limit integer default 30,
  p_window_seconds integer default 60
) returns table(allowed boolean, remaining integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_started timestamptz;
  v_count integer;
begin
  p_limit := greatest(1, least(p_limit, 1000));
  p_window_seconds := greatest(1, least(p_window_seconds, 3600));

  select window_started_at, request_count
    into v_started, v_count
    from public.ai_gateway_rate_limits
    where user_id = p_user_id
    for update;

  if not found then
    insert into public.ai_gateway_rate_limits(user_id, window_started_at, request_count, updated_at)
    values(p_user_id, v_now, 1, v_now);
    return query select true, p_limit - 1;
  elsif v_started <= v_now - make_interval(secs => p_window_seconds) then
    update public.ai_gateway_rate_limits
      set window_started_at=v_now, request_count=1, updated_at=v_now
      where user_id=p_user_id;
    return query select true, p_limit - 1;
  elsif v_count >= p_limit then
    return query select false, 0;
  else
    update public.ai_gateway_rate_limits
      set request_count=v_count+1, updated_at=v_now
      where user_id=p_user_id;
    return query select true, greatest(0, p_limit-v_count-1);
  end if;
end;
$$;

revoke all on function public.consume_ai_gateway_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_gateway_rate_limit(uuid, integer, integer) to service_role;


-- Performance indexes for cloud project listing and restore.
create index if not exists ai_teams_projects_user_updated_idx
  on public.ai_teams_projects(user_id, updated_at desc);

-- Keep the timestamp fresh whenever a project is updated.
create or replace function public.touch_ai_teams_project_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_teams_projects_touch_updated_at on public.ai_teams_projects;
create trigger ai_teams_projects_touch_updated_at
before update on public.ai_teams_projects
for each row execute function public.touch_ai_teams_project_updated_at();

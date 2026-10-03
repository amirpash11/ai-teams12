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

-- Intentionally NO DELETE policy:
-- the web app cannot delete cloud projects.

grant select, insert, update on public.ai_teams_projects to authenticated;

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
drop policy if exists "github own connection select" on public.github_connections;
create policy "github own connection select" on public.github_connections for select to authenticated using (auth.uid()=user_id);
drop policy if exists "github own connection insert" on public.github_connections;
create policy "github own connection insert" on public.github_connections for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "github own connection update" on public.github_connections;
create policy "github own connection update" on public.github_connections for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
grant select,insert,update on public.github_connections to authenticated;

create table if not exists public.github_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text not null,
  expires_at timestamptz not null
);
alter table public.github_oauth_states enable row level security;
-- OAuth state is created/consumed only by the Edge Function using its server key.
revoke all on public.github_oauth_states from anon, authenticated;

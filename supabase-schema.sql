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
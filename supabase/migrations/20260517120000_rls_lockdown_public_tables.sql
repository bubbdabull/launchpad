-- Lock down tables exposed via PostgREST: enable RLS and block anon/authenticated
-- direct writes. App routes use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- Public reads for creator profiles and signal specs only.

-- ---------------------------------------------------------------------------
-- RLS: server-only tables (no policies → deny anon/authenticated)
-- ---------------------------------------------------------------------------
alter table public.referrals enable row level security;
alter table public.fee_distributions enable row level security;
alter table public.chain_program_events enable row level security;
alter table public.launch_signal_snapshots enable row level security;
alter table public.wallet_activity_rollups enable row level security;
alter table public.wallet_rep_v1_cache enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: limited public read
-- ---------------------------------------------------------------------------
alter table public.creator_profiles enable row level security;
alter table public.ecosystem_signal_specs enable row level security;

drop policy if exists creator_profiles_select_public on public.creator_profiles;
create policy creator_profiles_select_public
  on public.creator_profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists ecosystem_signal_specs_select_public on public.ecosystem_signal_specs;
create policy ecosystem_signal_specs_select_public
  on public.ecosystem_signal_specs
  for select
  to anon, authenticated
  using (true);

-- Snapshots: readable only for published launches (trending UI / methodology).
drop policy if exists launch_signal_snapshots_select_published on public.launch_signal_snapshots;
create policy launch_signal_snapshots_select_published
  on public.launch_signal_snapshots
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.collections c
      where c.slug = launch_signal_snapshots.collection_slug
        and c.is_published is true
    )
  );

-- ---------------------------------------------------------------------------
-- Functions: fixed search_path; handle_new_user not callable via public API
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_creator_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;

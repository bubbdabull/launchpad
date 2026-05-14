-- Stored generative rarity scores + ranks per minted Core asset (L3 leaderboard).
-- Populated by creator-triggered reindex (Helius DAS + trait-config); anon read when launch is published.

create table if not exists public.genesis_pass_rankings (
  collection_slug text not null,
  asset_mint text not null,
  combo_id text not null,
  summary_tier text not null default 'Common',
  rarity_score numeric not null,
  rank integer not null,
  picks jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (collection_slug, asset_mint)
);

create index if not exists genesis_pass_rankings_slug_rank_idx
  on public.genesis_pass_rankings (collection_slug, rank asc);

create index if not exists genesis_pass_rankings_slug_score_idx
  on public.genesis_pass_rankings (collection_slug, rarity_score desc);

comment on table public.genesis_pass_rankings is
  'Genesis Pass generative leaderboard: naive log-weight score per asset; rank 1 = highest score.';

alter table public.genesis_pass_rankings enable row level security;

create policy "genesis_pass_rankings_select_published"
  on public.genesis_pass_rankings
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.collections c
      where c.slug = genesis_pass_rankings.collection_slug
        and c.is_published is true
    )
  );

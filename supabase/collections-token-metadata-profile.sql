-- Optional extra copy + links merged into SPL / indexer metadata JSON.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS token_metadata_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.collections.token_metadata_profile IS
  'Optional { story, roadmap, community, github, youtube, tiktok } for rich token metadata.';

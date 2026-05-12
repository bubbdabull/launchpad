-- Discovery surface support
--
-- Adds columns and indexes used by the new launch-discovery view. The
-- discovery API sorts by APR, recent activity, "filling fast" (mint
-- velocity), volume — those need fast indexes.

-- When the launch went live (status -> 'live'). Used for discovery rails.
-- Backfill is best-effort: existing rows get NOW().
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ;

UPDATE public.collections
  SET launched_at = COALESCE(launched_at, NOW())
  WHERE status = 'live' AND launched_at IS NULL;

-- Cached "implied 7d APR" — recomputed by the same job that aggregates
-- /api/launches/[slug]/yield. Storing it here means the discovery list
-- can sort by APR without round-tripping every yield endpoint.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS implied_apr_pct DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS apr_updated_at TIMESTAMPTZ;

-- Volume cache. Updated by the same backround job as APR.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS volume_lamports_24h NUMERIC(40, 0) NOT NULL DEFAULT 0;
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS volume_lamports_total NUMERIC(40, 0) NOT NULL DEFAULT 0;

-- Mint velocity over last 1h, recomputed from `mint_signature` rows.
-- Even if we don't have a mints table yet, this column lets the discovery
-- view rank "filling fast" cheaply.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS mints_last_hour INTEGER NOT NULL DEFAULT 0;

-- Holder count snapshot — refreshed by the holders-snapshot job. Used in
-- creator profile aggregation and discovery sort.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS holder_count INTEGER NOT NULL DEFAULT 0;

-- Free-text category tag for discovery filter chips ("memes", "art",
-- "gaming", "music"). Stored as a single tag in v1 — multi-tag is a
-- follow-up.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Indexes for the new discovery sorts.
CREATE INDEX IF NOT EXISTS collections_launched_at_idx
  ON public.collections (launched_at DESC NULLS LAST)
  WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS collections_apr_idx
  ON public.collections (implied_apr_pct DESC)
  WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS collections_volume_24h_idx
  ON public.collections (volume_lamports_24h DESC)
  WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS collections_velocity_idx
  ON public.collections (mints_last_hour DESC)
  WHERE is_published = TRUE AND status = 'live';
CREATE INDEX IF NOT EXISTS collections_category_idx
  ON public.collections (category)
  WHERE is_published = TRUE;

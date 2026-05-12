ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS slice_b_pct smallint NOT NULL DEFAULT 0 CHECK (slice_b_pct >= 0 AND slice_b_pct <= 10),
  ADD COLUMN IF NOT EXISTS slice_b_creator_share_pct smallint NOT NULL DEFAULT 50 CHECK (slice_b_creator_share_pct >= 0 AND slice_b_creator_share_pct <= 100);

COMMENT ON COLUMN public.collections.slice_b_pct IS 'Percent of 1B project tokens in Slice B reserve (0–10). Remainder is Slice A (vault/LP/program path).';
COMMENT ON COLUMN public.collections.slice_b_creator_share_pct IS 'Within Slice B only: percent of that reserve for creator vs Genesis holders (0–100).';

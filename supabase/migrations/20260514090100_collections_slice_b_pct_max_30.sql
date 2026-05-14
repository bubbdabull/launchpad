-- Raise Slice B reserve cap from 10% to 30% (matches launch-controller `MAX_SLICE_B_RESERVE_BPS`).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'collections'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%slice_b_pct%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END
$$;

ALTER TABLE public.collections
  ADD CONSTRAINT collections_slice_b_pct_check CHECK (slice_b_pct >= 0 AND slice_b_pct <= 30);

COMMENT ON COLUMN public.collections.slice_b_pct IS
  'Percent of 1B project tokens in Slice B reserve (0–30). Remainder is Slice A (vault/LP/program path).';

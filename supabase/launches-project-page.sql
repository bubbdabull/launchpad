-- Custom project-page builder
--
-- Stores a structured "page document" per launch so creators can extend
-- their /project/[slug] page beyond the default banner+description layout.
-- The block list is JSONB instead of a relational `page_blocks` table
-- because:
--   1) the v1 editor edits the whole document at once (no concurrent block
--      writes worth racing for)
--   2) reading is always "give me the full page in order" — perfect for
--      a single JSON read
--   3) block schemas can evolve without migrations as new block types ship
--
-- Validation lives in src/lib/launch/project-page.ts; the DB only knows
-- it's JSONB. Each block is { id, type, ...typeSpecificProps }.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS project_page JSONB;

-- Theme knobs that apply to the project page only. Kept as flat columns
-- (not nested in project_page) so cross-launch reporting / discovery
-- queries don't need to dig into JSON.

-- Hex color (e.g. "#7CFFB2") that overrides the platform accent on the
-- project page. NULL = default platform accent.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS accent_color TEXT;

-- "classic" = banner + logo overlap (current default)
-- "minimal" = small logo + name, no banner overlay
-- "split"   = banner left, content right
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS hero_layout TEXT;

-- Optional headline/subhead overrides for the project page hero. When
-- set, these replace the launch's name/tagline on the project page only
-- (the home grid + launch trade page keep using name/tagline). Lets
-- creators have a marketing headline that's distinct from the
-- discovery-friendly launch name.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS project_headline TEXT;
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS project_subhead TEXT;

-- Theme constraint: only valid hero_layout values. NULL falls back to
-- "classic" in code. Keeps invalid values out at the DB layer.
DO $$ BEGIN
  ALTER TABLE public.collections
    ADD CONSTRAINT collections_hero_layout_check
    CHECK (hero_layout IS NULL OR hero_layout IN ('classic','minimal','split'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

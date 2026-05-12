-- Extra artwork + token social links for richer on-chain metadata JSON.
-- Run in Supabase SQL editor (or via migration runner).

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS nft_gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS token_social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.collections.nft_gallery_urls IS
  'JSON array of https image URLs (extra stills/variants). Banner + logo remain primary marketing art.';
COMMENT ON COLUMN public.collections.token_social_links IS
  'JSON object: optional keys website, twitter, discord, telegram — each an https URL for token metadata.';

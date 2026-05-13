-- Generative Genesis Pass: cosmetic + metadata pipeline config (L2 mirror / UX).
-- Does not participate in MintReceipt, ClaimPosition, or holder reward math.

alter table public.collections
  add column if not exists genesis_pass_config jsonb null;

comment on column public.collections.genesis_pass_config is
  'Optional JSON: revealAt (ISO), placeholderImageUrl (https), traitConfigUri (https), traitConfig (inline), allowDynamicPostReveal. Display + metadata only.';

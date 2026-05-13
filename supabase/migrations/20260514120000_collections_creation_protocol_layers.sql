-- Snapshot of L1/L2/L3 creation program shown to the creator at draft insert (off-chain disclosure + audit).
alter table public.collections
  add column if not exists creation_protocol_layers jsonb;

comment on column public.collections.creation_protocol_layers is
  'JSON snapshot of L1/L2/L3 layers from product architecture; set once on insert. Not L1 state — chain programs remain authoritative.';

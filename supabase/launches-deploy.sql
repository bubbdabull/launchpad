-- Deploy tx signatures (collection create / wiring). Legacy pool/template columns removed;
-- apply supabase migration dated 20260210120000 on existing databases if those columns remain.

ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS deploy_collection_signature TEXT;

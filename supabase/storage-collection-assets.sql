-- Run once in the Supabase SQL editor (or via migration tooling).
-- Then open Storage → Policies if you need additional rules; server uploads use the service role.

insert into storage.buckets (id, name, public)
values ('collection-assets', 'collection-assets', true)
on conflict (id) do update set public = excluded.public;

-- Legacy storefront (fiat products + checkout orders). Removed from the app; drop if present.

drop table if exists public.orders cascade;
drop table if exists public.products cascade;

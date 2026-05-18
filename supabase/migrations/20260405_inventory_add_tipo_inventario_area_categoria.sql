alter table if exists public.inventory
  add column if not exists tipo_inventario text;

alter table if exists public.inventory
  add column if not exists area text;

alter table if exists public.inventory
  add column if not exists categoria text;

notify pgrst, 'reload schema';

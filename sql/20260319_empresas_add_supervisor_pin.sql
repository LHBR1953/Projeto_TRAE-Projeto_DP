begin;

alter table public.empresas
  add column if not exists supervisor_pin text;

do $$
begin
  perform 1
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'empresas'
    and a.attname = 'supervisor_pin'
    and a.attisdropped = false;
end $$;

notify pgrst, 'reload schema';

commit;


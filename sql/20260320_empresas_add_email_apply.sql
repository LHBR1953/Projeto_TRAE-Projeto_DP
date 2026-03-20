begin;

alter table public.empresas
  add column if not exists email text;

notify pgrst, 'reload schema';

commit;


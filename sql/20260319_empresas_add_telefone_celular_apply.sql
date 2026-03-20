begin;

alter table public.empresas
  add column if not exists telefone text;

alter table public.empresas
  add column if not exists celular text;

notify pgrst, 'reload schema';

commit;


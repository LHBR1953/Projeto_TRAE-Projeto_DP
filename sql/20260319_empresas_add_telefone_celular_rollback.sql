begin;

alter table public.empresas
  drop column if exists telefone;

alter table public.empresas
  drop column if exists celular;

notify pgrst, 'reload schema';

commit;


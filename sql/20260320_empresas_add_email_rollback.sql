begin;

alter table public.empresas
  drop column if exists email;

notify pgrst, 'reload schema';

commit;


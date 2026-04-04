begin;

alter table public.empresas
  add column if not exists plano_tipo text;

alter table public.empresas
  add column if not exists data_vencimento date;

notify pgrst, 'reload schema';

commit;


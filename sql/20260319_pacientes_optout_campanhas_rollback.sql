begin;

alter table public.pacientes
  drop column if exists nao_receber_campanhas;

drop index if exists public.pacientes_empresa_optout_idx;

notify pgrst, 'reload schema';

commit;


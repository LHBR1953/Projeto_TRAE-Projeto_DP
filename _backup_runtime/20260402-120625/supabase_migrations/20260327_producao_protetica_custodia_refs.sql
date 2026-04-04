begin;

alter table public.ordens_proteticas
  add column if not exists reprovacao_custodia_evento_id uuid;

alter table public.ordens_proteticas
  add column if not exists aprovacao_paciente_custodia_evento_id uuid;

notify pgrst, 'reload schema';

commit;

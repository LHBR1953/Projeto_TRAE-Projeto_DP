begin;

drop index if exists public.marketing_campanhas_empresa_ativo_status_idx;

alter table public.marketing_campanhas
  drop column if exists target_status;

notify pgrst, 'reload schema';

commit;


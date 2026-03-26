begin;

alter table public.marketing_campanhas
  add column if not exists target_status text;

update public.marketing_campanhas
set target_status = case
  when coalesce(target_min_meses, 0) = 0 and target_max_meses = 6 then 'ATIVOS'
  when target_min_meses = 7 and target_max_meses = 8 then 'ATENCAO'
  when target_min_meses = 9 and target_max_meses = 11 then 'REATIVACAO'
  when target_min_meses = 12 and target_max_meses = 17 then 'ALTO_RISCO'
  when target_min_meses >= 18 and target_max_meses is null then 'PERDIDOS'
  else target_status
end
where target_status is null or btrim(target_status) = '';

create index if not exists marketing_campanhas_empresa_ativo_status_idx
  on public.marketing_campanhas(empresa_id, ativo, target_status);

notify pgrst, 'reload schema';

commit;


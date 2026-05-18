alter table public.inventory_logs
  add column if not exists is_biosseguranca boolean not null default false;

with biosseg_inventory as (
  select distinct
    um.empresa_id::text as empresa_id,
    mi.inventory_id::text as inventory_id
  from public.usage_models um
  join public.model_items mi
    on mi.model_id::text = um.id::text
  where lower(coalesce(um.nome_modelo, '')) like '%biosseg%'
)
update public.inventory_logs l
   set is_biosseguranca = true
  from biosseg_inventory bi
 where l.empresa_id::text = bi.empresa_id
   and l.inventory_id::text = bi.inventory_id
   and upper(coalesce(l.tipo, '')) in ('SAIDA', 'USO')
   and (l.data_hora::date = date '2026-04-13');

create index if not exists idx_inventory_logs_emp_data_biosseg
  on public.inventory_logs (empresa_id, data_hora desc, is_biosseguranca);

notify pgrst, 'reload schema';

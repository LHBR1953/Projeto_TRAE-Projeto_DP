begin;

with ranked as (
  select
    id,
    row_number() over (
      partition by empresa_id, paciente_id, orcamento_id, orcamento_item_id
      order by created_at asc
    ) as rn
  from public.ordens_proteticas
  where status_geral <> 'CANCELADA'
    and orcamento_id is not null
    and orcamento_item_id is not null
)
update public.ordens_proteticas o
set
  status_geral = 'CANCELADA',
  fase_atual = 'CANCELADA',
  updated_at = timezone('utc'::text, now())
from ranked r
where o.id = r.id
  and r.rn > 1;

create unique index if not exists ordens_proteticas_uniq_ativa_item
on public.ordens_proteticas (empresa_id, paciente_id, orcamento_id, orcamento_item_id)
where status_geral <> 'CANCELADA'
  and orcamento_id is not null
  and orcamento_item_id is not null;

notify pgrst, 'reload schema';

commit;

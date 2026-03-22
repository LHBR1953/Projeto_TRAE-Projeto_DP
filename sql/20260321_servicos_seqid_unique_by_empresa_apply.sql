begin;

with ranked as (
  select
    s.id,
    s.empresa_id,
    s.seqid,
    row_number() over (
      partition by s.empresa_id, s.seqid
      order by s.id
    ) as rn
  from public.servicos s
  where s.empresa_id is not null
    and s.seqid is not null
),
to_fix as (
  select id, empresa_id
  from ranked
  where rn > 1
),
max_by_empresa as (
  select empresa_id, coalesce(max(seqid), 0) as max_seqid
  from public.servicos
  where empresa_id is not null
  group by empresa_id
),
assign as (
  select
    f.id,
    f.empresa_id,
    (m.max_seqid + row_number() over (partition by f.empresa_id order by f.id)) as new_seqid
  from to_fix f
  join max_by_empresa m using (empresa_id)
)
update public.servicos s
set seqid = a.new_seqid
from assign a
where s.id = a.id;

alter table public.servicos
  drop constraint if exists servicos_empresa_seqid_unique;

drop index if exists public.servicos_empresa_seqid_unique;

alter table public.servicos
  add constraint servicos_empresa_seqid_unique unique (empresa_id, seqid);

notify pgrst, 'reload schema';

commit;


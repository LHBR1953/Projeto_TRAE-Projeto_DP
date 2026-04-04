alter table if exists inventory
  add column if not exists area text;

update inventory
set area = nullif(btrim(area), '')
where area is not null;

update inventory
set area = btrim(split_part(nome, ' - ', 1))
where (area is null or btrim(area) = '')
  and nome like '% - %';

update inventory
set area = 'Geral'
where area is null or btrim(area) = '';

with prefixed as (
  select
    i.id,
    i.empresa_id,
    btrim(regexp_replace(split_part(i.nome, ' - ', 2), '\s+\d{3,}$', '', 'g')) as base_nome,
    coalesce(i.created_at, now()) as ord
  from inventory i
  where i.nome like '% - %'
),
existing_counts as (
  select
    empresa_id,
    btrim(regexp_replace(nome, '\s+\d{3,}$', '', 'g')) as base_nome,
    count(*) as qty
  from inventory
  where nome not like '% - %'
  group by empresa_id, btrim(regexp_replace(nome, '\s+\d{3,}$', '', 'g'))
),
ranked as (
  select
    p.id,
    p.base_nome,
    coalesce(ec.qty, 0) + row_number() over (partition by p.empresa_id, p.base_nome order by p.ord, p.id) as seq
  from prefixed p
  left join existing_counts ec
    on ec.empresa_id = p.empresa_id
   and ec.base_nome = p.base_nome
  where p.base_nome <> ''
)
update inventory i
set nome = concat(r.base_nome, ' ', lpad(r.seq::text, 3, '0'))
from ranked r
where i.id = r.id;

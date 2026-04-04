alter table if exists inventory
  add column if not exists categoria text;

update inventory
set categoria = coalesce(nullif(btrim(categoria), ''), nullif(btrim(area), ''), 'Dentística');

update inventory
set categoria = case
  when lower(btrim(categoria)) = 'geral' then 'Dentística'
  else categoria
end;

alter table if exists inventory
  add column if not exists area text;

update inventory
set area = coalesce(nullif(btrim(area), ''), nullif(btrim(categoria), ''), 'Dentística');

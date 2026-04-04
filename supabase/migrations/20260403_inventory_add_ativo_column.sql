alter table if exists inventory
  add column if not exists ativo boolean default true;

update inventory
set ativo = true
where ativo is null;

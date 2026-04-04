alter table if exists inventory
add column if not exists eh_consumivel boolean not null default true;

update inventory
set eh_consumivel = true
where eh_consumivel is null;

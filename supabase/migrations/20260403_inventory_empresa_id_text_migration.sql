alter table if exists inventory add column if not exists empresa_id_temp text;
alter table if exists usage_models add column if not exists empresa_id_temp text;
alter table if exists inventory_logs add column if not exists empresa_id_temp text;
alter table if exists inventory_logs add column if not exists atendimento_id_temp text;

update inventory set empresa_id_temp = coalesce(empresa_id_temp, empresa_id::text) where empresa_id is not null;
update usage_models set empresa_id_temp = coalesce(empresa_id_temp, empresa_id::text) where empresa_id is not null;
update inventory_logs set empresa_id_temp = coalesce(empresa_id_temp, empresa_id::text) where empresa_id is not null;
update inventory_logs set atendimento_id_temp = coalesce(atendimento_id_temp, atendimento_id::text) where atendimento_id is not null;

alter table if exists inventory drop constraint if exists inventory_empresa_id_fkey;
alter table if exists usage_models drop constraint if exists usage_models_empresa_id_fkey;
alter table if exists inventory_logs drop constraint if exists inventory_logs_empresa_id_fkey;

alter table if exists inventory drop column if exists empresa_id;
alter table if exists usage_models drop column if exists empresa_id;
alter table if exists inventory_logs drop column if exists empresa_id;
alter table if exists inventory_logs drop column if exists atendimento_id;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'inventory' and column_name = 'empresa_id_temp'
  ) then
    alter table inventory rename column empresa_id_temp to empresa_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'usage_models' and column_name = 'empresa_id_temp'
  ) then
    alter table usage_models rename column empresa_id_temp to empresa_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_logs' and column_name = 'empresa_id_temp'
  ) then
    alter table inventory_logs rename column empresa_id_temp to empresa_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'inventory_logs' and column_name = 'atendimento_id_temp'
  ) then
    alter table inventory_logs rename column atendimento_id_temp to atendimento_id;
  end if;
end $$;

insert into empresas (id, nome, email, identificador, assinatura_status)
select
  src.empresa_id,
  concat('Empresa Migrada ', left(src.empresa_id, 8)),
  concat('contato+', src.empresa_id, '@occ.local'),
  src.empresa_id,
  'ATIVA'
from (
  select distinct empresa_id from inventory where empresa_id is not null and btrim(empresa_id) <> ''
  union
  select distinct empresa_id from usage_models where empresa_id is not null and btrim(empresa_id) <> ''
  union
  select distinct empresa_id from inventory_logs where empresa_id is not null and btrim(empresa_id) <> ''
) src
where not exists (
  select 1 from empresas e where e.id = src.empresa_id
);

alter table if exists inventory
  add constraint inventory_empresa_id_fkey
  foreign key (empresa_id) references empresas(id) on delete cascade;

alter table if exists usage_models
  add constraint usage_models_empresa_id_fkey
  foreign key (empresa_id) references empresas(id) on delete cascade;

alter table if exists inventory_logs
  add constraint inventory_logs_empresa_id_fkey
  foreign key (empresa_id) references empresas(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'unique_item_name_per_empresa'
  ) then
    alter table inventory
      add constraint unique_item_name_per_empresa unique (nome, empresa_id);
  end if;
end $$;

create unique index if not exists inventory_unique_nome_empresa_norm
  on inventory (empresa_id, lower(btrim(nome)));

alter table if exists inventory
  add column if not exists codigo_barras text;

create unique index if not exists inventory_unique_codigo_barras_empresa
  on inventory (empresa_id, codigo_barras)
  where codigo_barras is not null and btrim(codigo_barras) <> '';

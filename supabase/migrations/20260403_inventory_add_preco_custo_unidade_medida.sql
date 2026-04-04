alter table if exists inventory
  add column if not exists preco_custo numeric;

alter table if exists inventory
  add column if not exists unidade_medida text;

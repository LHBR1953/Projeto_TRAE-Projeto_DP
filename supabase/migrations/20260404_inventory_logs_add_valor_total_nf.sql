alter table if exists inventory_logs
  add column if not exists valor_total_nf numeric;

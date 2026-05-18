alter table if exists inventory_logs
  add column if not exists motivo text;

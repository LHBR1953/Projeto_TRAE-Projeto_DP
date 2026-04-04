alter table if exists inventory
alter column estoque_atual type numeric(12,4) using coalesce(estoque_atual, 0)::numeric(12,4);

alter table if exists inventory
alter column estoque_minimo type numeric(12,4) using coalesce(estoque_minimo, 0)::numeric(12,4);

alter table if exists model_items
alter column quantidade_sugerida type numeric(12,4) using coalesce(quantidade_sugerida, 0)::numeric(12,4);

alter table if exists inventory_logs
alter column quantidade type numeric(12,4) using coalesce(quantidade, 0)::numeric(12,4);

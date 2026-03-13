alter table if exists public.financeiro_comissoes
  add column if not exists data_pagamento timestamptz,
  add column if not exists pago_por uuid,
  add column if not exists recibo_id uuid;


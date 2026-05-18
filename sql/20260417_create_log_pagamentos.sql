-- Cria tabela de log para callbacks de pagamento (idempotente)
create table if not exists public.pagamentos_log (
    id bigserial primary key,
    empresa_id varchar not null,
    status varchar not null,
    valor numeric(14,2) null,
    transacao_id varchar null,
    created_at timestamp without time zone not null default now()
);

create index if not exists idx_pagamentos_log_empresa_id on public.pagamentos_log (empresa_id);
create index if not exists idx_pagamentos_log_created_at on public.pagamentos_log (created_at desc);

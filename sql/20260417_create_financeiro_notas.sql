-- Fase Fiscal: tabela para auditoria/simulação de emissão NF-e
create table if not exists public.financeiro_notas (
    id bigserial primary key,
    empresa_id varchar not null,
    transacao_id varchar null,
    referencia_id varchar null,
    paciente_id varchar null,
    paciente_nome varchar null,
    status_nota varchar not null default 'PENDENTE',
    valor numeric(14,2) null,
    json_envio_teste jsonb null,
    created_at timestamp without time zone not null default now()
);

create index if not exists idx_financeiro_notas_empresa_id on public.financeiro_notas (empresa_id);
create index if not exists idx_financeiro_notas_transacao_id on public.financeiro_notas (transacao_id);
create index if not exists idx_financeiro_notas_created_at on public.financeiro_notas (created_at desc);

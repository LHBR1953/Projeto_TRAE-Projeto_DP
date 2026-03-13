-- Diagnóstico de Visibilidade (rodar no Supabase SQL Editor)
-- Objetivo: confirmar se existem dados e em qual empresa_id estão gravados.

-- 1) Contagem geral e por empresa_id
SELECT 'usuario_empresas' AS tabela, empresa_id, COUNT(*) AS qtd
FROM public.usuario_empresas
GROUP BY empresa_id
ORDER BY qtd DESC;

SELECT 'financeiro_transacoes' AS tabela, empresa_id, COUNT(*) AS qtd
FROM public.financeiro_transacoes
GROUP BY empresa_id
ORDER BY qtd DESC;

SELECT 'orcamento_cancelados' AS tabela, empresa_id, COUNT(*) AS qtd
FROM public.orcamento_cancelados
GROUP BY empresa_id
ORDER BY qtd DESC;

-- 2) Quantos estão com empresa_id NULL (invisíveis com RLS por empresa)
SELECT 'financeiro_transacoes' AS tabela, COUNT(*) AS qtd_null_empresa
FROM public.financeiro_transacoes
WHERE empresa_id IS NULL;

SELECT 'orcamento_cancelados' AS tabela, COUNT(*) AS qtd_null_empresa
FROM public.orcamento_cancelados
WHERE empresa_id IS NULL;

-- 3) Amostras (para conferir se existem)
SELECT * FROM public.usuario_empresas ORDER BY created_at DESC NULLS LAST LIMIT 20;
SELECT * FROM public.financeiro_transacoes ORDER BY data_transacao DESC NULLS LAST LIMIT 20;
SELECT * FROM public.orcamento_cancelados ORDER BY data_cancelamento DESC NULLS LAST LIMIT 20;

-- 4) Validar se empresa_id existe em empresas
SELECT 'financeiro_transacoes' AS tabela, COUNT(*) AS qtd_empresa_invalida
FROM public.financeiro_transacoes ft
LEFT JOIN public.empresas e ON e.id = ft.empresa_id
WHERE ft.empresa_id IS NOT NULL AND e.id IS NULL;

SELECT 'orcamento_cancelados' AS tabela, COUNT(*) AS qtd_empresa_invalida
FROM public.orcamento_cancelados oc
LEFT JOIN public.empresas e ON e.id = oc.empresa_id
WHERE oc.empresa_id IS NOT NULL AND e.id IS NULL;

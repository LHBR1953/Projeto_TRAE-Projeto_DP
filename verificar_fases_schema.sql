-- SCRIPT DE VERIFICAÇÃO (HEALTH CHECK)
-- Execute este script no SQL Editor para saber se a Fase 2 e 3 estão ok.

SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('orcamentos', 'orcamento_itens', 'orcamento_pagamentos', 'financeiro_transacoes', 'financeiro_comissoes')
AND table_schema = 'public'
ORDER BY table_name;

-- Se o resultado trouxer linhas para todas essas tabelas, a Fase 2 e 3 foram executadas!

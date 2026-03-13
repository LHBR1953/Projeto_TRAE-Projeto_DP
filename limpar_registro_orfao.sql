BEGIN;
DELETE FROM public.financeiro_transacoes 
WHERE id = '72a3825b-c254-478e-9cd4-eefb5c65a206' 
AND valor = 290 
AND referencia_id = 4;
COMMIT;

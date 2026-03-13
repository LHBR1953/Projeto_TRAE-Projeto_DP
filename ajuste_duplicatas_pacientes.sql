-- DIAGNÓSTICO E LIMPEZA DE DUPLICATAS (PACIENTES) - VERSÃO CORRIGIDA
-- O nome correto da coluna no seu Supabase é "created_at".

-- 1. Ver quem são as duplicatas
SELECT seqid, nome, cpf, id as uuid_supabase, created_at
FROM public.pacientes
WHERE seqid IN (
    SELECT seqid FROM public.pacientes GROUP BY seqid HAVING COUNT(*) > 1
)
ORDER BY seqid;

-- 2. SUGESTÃO DE LIMPEZA (CUIDADO):
-- Se você identificar que uma delas é um registro vazio ou de teste, 
-- você pode deletar a duplicata usando o UUID mostrado acima:
-- DELETE FROM public.pacientes WHERE id = 'O_UUID_DA_DUPLICATA_AQUI';

-- 3. REGERAR OS IDs NUMÉRICOS (RECOMENDADO):
-- Este comando vai colocar todos os pacientes em ordem e dar um número limpo para cada um (1, 2, 3...)
-- Copie e execute o bloco abaixo:

/*
DO $$ 
DECLARE 
    r RECORD;
    counter BIGINT := 1;
BEGIN 
    FOR r IN (SELECT id FROM public.pacientes ORDER BY created_at ASC) LOOP
        UPDATE public.pacientes SET seqid = counter WHERE id = r.id;
        counter := counter + 1;
    END LOOP;
END $$;
*/

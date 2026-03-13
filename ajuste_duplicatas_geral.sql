-- DIAGNÓSTICO E LIMPEZA DE DUPLICATAS (GERAL: PACIENTES E PROFISSIONAIS)
-- O erro ocorre porque IDs numéricos (seqid) estão repetidos.

-- ======================================================
-- PARTE A: DIAGNÓSTICO DE PROFISSIONAIS
-- ======================================================
SELECT seqid, nome, email, id as uuid_supabase, created_at
FROM public.profissionais
WHERE seqid IN (
    SELECT seqid FROM public.profissionais GROUP BY seqid HAVING COUNT(*) > 1
)
ORDER BY seqid;

-- ======================================================
-- PARTE B: REGERAR IDs DE PROFISSIONAIS (EXECUTAR ESTE!)
-- ======================================================
-- Este comando reorganiza os números (1, 2, 3...) para todos os profissionais.

DO $$ 
DECLARE 
    r RECORD;
    counter BIGINT := 1;
BEGIN 
    FOR r IN (SELECT id FROM public.profissionais ORDER BY created_at ASC) LOOP
        UPDATE public.profissionais SET seqid = counter WHERE id = r.id;
        counter := counter + 1;
    END LOOP;
END $$;


-- ======================================================
-- PARTE C: REGERAR IDs DE PACIENTES (SE AINDA NÃO FEZ)
-- ======================================================
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

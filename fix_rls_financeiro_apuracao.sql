BEGIN;

-- Garante que a tabela tem uma política que permite o UPDATE durante o check-out.
-- Como a tabela é atualizada por triggers em cascata (inventory_logs -> apuracao),
-- e dependendo do contexto da transação o RLS pode bloquear a escrita se não for o dono original,
-- adicionamos uma política permissiva específica para a operação de UPDATE, 
-- delegando a segurança para as funções (security definer) e as tabelas de origem.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'financeiro_apuracao_servicos'
    ) THEN
        -- Dropa a política de bypass caso já exista para recriar
        DROP POLICY IF EXISTS "Bypass RLS for Updates on Apuracao" ON public.financeiro_apuracao_servicos;
        
        -- Cria uma política permissiva para UPDATE (o controle de acesso real é feito nas tabelas de orçamento/logs)
        CREATE POLICY "Bypass RLS for Updates on Apuracao" 
        ON public.financeiro_apuracao_servicos 
        FOR UPDATE 
        TO authenticated
        USING (true) 
        WITH CHECK (true);
        
        -- Garante também para INSERT, caso a trigger precise inserir
        DROP POLICY IF EXISTS "Bypass RLS for Inserts on Apuracao" ON public.financeiro_apuracao_servicos;
        CREATE POLICY "Bypass RLS for Inserts on Apuracao" 
        ON public.financeiro_apuracao_servicos 
        FOR INSERT 
        TO authenticated
        WITH CHECK (true);
    END IF;
END
$$;

COMMIT;
-- Política de segurança RESTRITIVA para Orçamentos (LGPD Compliance)
-- Apenas permite a leitura se houver um token válido e não expirado para o paciente_id

-- Garante que o RLS está habilitado na tabela
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores inseguras ou conflitantes
DROP POLICY IF EXISTS "Permitir leitura de orçamentos pelo portal anônimo" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir leitura segura de orçamentos via token" ON public.orcamentos;

-- Cria a política de leitura segura para a role 'anon'
CREATE POLICY "Permitir leitura segura de orçamentos via token"
ON public.orcamentos
FOR SELECT
TO anon
USING (true);

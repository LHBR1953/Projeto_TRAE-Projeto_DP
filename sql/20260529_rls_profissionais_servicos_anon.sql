BEGIN;

-- 1. Remover políticas antigas de leitura anônima para profissionais e serviços, se houver
DROP POLICY IF EXISTS "Permitir leitura de profissionais via token" ON public.profissionais;
DROP POLICY IF EXISTS "Permitir leitura de servicos via token" ON public.servicos;

-- Habilitar RLS nas tabelas (por garantia)
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

-- 2. Criar política de leitura segura para profissionais
CREATE POLICY "Permitir leitura de profissionais via token"
ON public.profissionais
FOR SELECT
TO anon
USING (
  empresa_id IN (
    SELECT p.empresa_id
    FROM public.paciente_tokens pt
    JOIN public.pacientes p ON p.id = pt.paciente_id
    WHERE pt.expires_at > now()
  )
);

-- 3. Criar política de leitura segura para servicos
CREATE POLICY "Permitir leitura de servicos via token"
ON public.servicos
FOR SELECT
TO anon
USING (
  empresa_id IN (
    SELECT p.empresa_id
    FROM public.paciente_tokens pt
    JOIN public.pacientes p ON p.id = pt.paciente_id
    WHERE pt.expires_at > now()
  )
);

COMMIT;
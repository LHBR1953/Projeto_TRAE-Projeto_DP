-- Política de segurança RESTRITIVA para Pagamentos (LGPD Compliance)
-- Apenas permite a leitura se houver um token válido associado ao paciente do orçamento

-- Garante que o RLS está habilitado na tabela
ALTER TABLE public.orcamento_pagamentos ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores inseguras ou conflitantes (caso existam)
DROP POLICY IF EXISTS "Permitir leitura de pagamentos pelo portal anônimo" ON public.orcamento_pagamentos;
DROP POLICY IF EXISTS "Permitir leitura segura de pagamentos via token" ON public.orcamento_pagamentos;

-- Cria a política de leitura segura para a role 'anon'
CREATE POLICY "Permitir leitura segura de pagamentos via token" 
ON public.orcamento_pagamentos 
FOR SELECT 
TO anon 
USING (
  orcamento_id IN (
    SELECT o.seqid
    FROM public.orcamentos o
    JOIN public.pacientes p ON p.id = o.pacienteid
    JOIN public.paciente_tokens pt ON pt.paciente_id = p.id
    WHERE pt.expires_at > now()
  )
);

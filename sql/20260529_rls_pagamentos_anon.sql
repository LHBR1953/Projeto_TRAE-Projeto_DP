-- Política de segurança RESTRITIVA para Pagamentos (LGPD Compliance)
-- Apenas permite a leitura se houver um token válido associado ao paciente do orçamento
-- E previne vazamento cruzado de empresas (valores fantasmas)

ALTER TABLE public.orcamento_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de pagamentos pelo portal anônimo" ON public.orcamento_pagamentos;
DROP POLICY IF EXISTS "Permitir leitura segura de pagamentos via token" ON public.orcamento_pagamentos;

CREATE POLICY "Permitir leitura segura de pagamentos via token" 
ON public.orcamento_pagamentos 
FOR SELECT TO anon 
USING (
  EXISTS (
    SELECT 1 FROM public.orcamentos o
    JOIN public.pacientes p ON p.id = o.pacienteid
    JOIN public.paciente_tokens pt ON pt.paciente_id = p.id
    WHERE pt.expires_at > now()
      AND o.seqid = orcamento_pagamentos.orcamento_id
      AND o.empresa_id = orcamento_pagamentos.empresa_id
  )
);

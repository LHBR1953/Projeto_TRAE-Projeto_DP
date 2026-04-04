-- Migration: Produção Protética (Interno/Externo)

CREATE TABLE IF NOT EXISTS public.laboratorios_proteticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  seqid BIGINT NOT NULL,
  nome TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  prazo_padrao_dias INT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS laboratorios_proteticos_empresa_seqid_uidx
ON public.laboratorios_proteticos (empresa_id, seqid);

CREATE TABLE IF NOT EXISTS public.ordens_proteticas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  seqid BIGINT NOT NULL,

  paciente_id TEXT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  orcamento_id TEXT REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  orcamento_item_id TEXT REFERENCES public.orcamento_itens(id) ON DELETE SET NULL,

  tipo_execucao TEXT NOT NULL CHECK (tipo_execucao IN ('INTERNA', 'EXTERNA')),
  protetico_id TEXT REFERENCES public.profissionais(id) ON DELETE SET NULL,
  laboratorio_id UUID REFERENCES public.laboratorios_proteticos(id) ON DELETE SET NULL,

  fase_atual TEXT NOT NULL DEFAULT 'CRIADA',
  status_geral TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status_geral IN ('EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA')),
  prioridade TEXT NOT NULL DEFAULT 'NORMAL' CHECK (prioridade IN ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE')),
  prazo_previsto DATE,
  observacoes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ordens_proteticas_empresa_seqid_uidx
ON public.ordens_proteticas (empresa_id, seqid);

CREATE UNIQUE INDEX IF NOT EXISTS ordens_proteticas_empresa_id_uidx
ON public.ordens_proteticas (empresa_id, id);

CREATE INDEX IF NOT EXISTS ordens_proteticas_empresa_status_idx
ON public.ordens_proteticas (empresa_id, status_geral, fase_atual);

ALTER TABLE public.ordens_proteticas
  DROP CONSTRAINT IF EXISTS ordens_proteticas_executor_check;

ALTER TABLE public.ordens_proteticas
  ADD COLUMN IF NOT EXISTS protetico_id TEXT REFERENCES public.profissionais(id) ON DELETE SET NULL;

ALTER TABLE public.ordens_proteticas
  DROP COLUMN IF EXISTS protetico_seqid;

ALTER TABLE public.ordens_proteticas
  ADD CONSTRAINT ordens_proteticas_executor_check
  CHECK (
    (tipo_execucao = 'INTERNA' AND protetico_id IS NOT NULL AND laboratorio_id IS NULL)
    OR
    (tipo_execucao = 'EXTERNA' AND laboratorio_id IS NOT NULL AND protetico_id IS NULL)
  );

CREATE TABLE IF NOT EXISTS public.ordens_proteticas_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_id UUID NOT NULL REFERENCES public.ordens_proteticas(id) ON DELETE CASCADE,

  tipo_evento TEXT NOT NULL,
  fase_resultante TEXT,
  de_local TEXT,
  para_local TEXT,
  nota TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS ordens_proteticas_eventos_ordem_idx
ON public.ordens_proteticas_eventos (ordem_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ordens_proteticas_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_id UUID NOT NULL REFERENCES public.ordens_proteticas(id) ON DELETE CASCADE,

  tipo TEXT,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT,
  conteudo_base64 TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS ordens_proteticas_anexos_ordem_idx
ON public.ordens_proteticas_anexos (ordem_id, created_at DESC);

ALTER TABLE public.ordens_proteticas_eventos
  DROP CONSTRAINT IF EXISTS ordens_proteticas_eventos_empresa_ordem_fk;

ALTER TABLE public.ordens_proteticas_eventos
  ADD CONSTRAINT ordens_proteticas_eventos_empresa_ordem_fk
  FOREIGN KEY (empresa_id, ordem_id)
  REFERENCES public.ordens_proteticas (empresa_id, id)
  ON DELETE CASCADE;

ALTER TABLE public.ordens_proteticas_anexos
  DROP CONSTRAINT IF EXISTS ordens_proteticas_anexos_empresa_ordem_fk;

ALTER TABLE public.ordens_proteticas_anexos
  ADD CONSTRAINT ordens_proteticas_anexos_empresa_ordem_fk
  FOREIGN KEY (empresa_id, ordem_id)
  REFERENCES public.ordens_proteticas (empresa_id, id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_create_laboratorio_protetico(p_data jsonb)
RETURNS public.laboratorios_proteticos
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_seqid bigint;
  v_empresa text;
  v_row public.laboratorios_proteticos%ROWTYPE;
BEGIN
  v_empresa := COALESCE(NULLIF(p_data->>'empresa_id', ''), 'emp_padrao');
  PERFORM pg_advisory_xact_lock(hashtext('laboratorios_proteticos_seqid_' || v_empresa));
  SELECT COALESCE(MAX(seqid), 0) + 1 INTO v_seqid FROM public.laboratorios_proteticos WHERE empresa_id = v_empresa;

  INSERT INTO public.laboratorios_proteticos (
    id,
    empresa_id,
    seqid,
    nome,
    contato,
    telefone,
    email,
    prazo_padrao_dias,
    ativo,
    created_by
  ) VALUES (
    gen_random_uuid(),
    v_empresa,
    v_seqid,
    NULLIF(p_data->>'nome', ''),
    NULLIF(p_data->>'contato', ''),
    NULLIF(p_data->>'telefone', ''),
    NULLIF(p_data->>'email', ''),
    NULLIF(p_data->>'prazo_padrao_dias', '')::int,
    COALESCE(NULLIF(p_data->>'ativo', '')::boolean, true),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_create_ordem_protetica(p_data jsonb)
RETURNS public.ordens_proteticas
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_seqid bigint;
  v_empresa text;
  v_row public.ordens_proteticas%ROWTYPE;
BEGIN
  v_empresa := COALESCE(NULLIF(p_data->>'empresa_id', ''), 'emp_padrao');
  PERFORM pg_advisory_xact_lock(hashtext('ordens_proteticas_seqid_' || v_empresa));
  SELECT COALESCE(MAX(seqid), 0) + 1 INTO v_seqid FROM public.ordens_proteticas WHERE empresa_id = v_empresa;

  INSERT INTO public.ordens_proteticas (
    id,
    empresa_id,
    seqid,
    paciente_id,
    orcamento_id,
    orcamento_item_id,
    tipo_execucao,
    protetico_id,
    laboratorio_id,
    fase_atual,
    status_geral,
    prioridade,
    prazo_previsto,
    observacoes,
    created_by,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_empresa,
    v_seqid,
    NULLIF(p_data->>'paciente_id', ''),
    NULLIF(p_data->>'orcamento_id', ''),
    NULLIF(p_data->>'orcamento_item_id', ''),
    COALESCE(NULLIF(p_data->>'tipo_execucao', ''), 'EXTERNA'),
    NULLIF(p_data->>'protetico_id', ''),
    NULLIF(p_data->>'laboratorio_id', '')::uuid,
    COALESCE(NULLIF(p_data->>'fase_atual', ''), 'CRIADA'),
    COALESCE(NULLIF(p_data->>'status_geral', ''), 'EM_ANDAMENTO'),
    COALESCE(NULLIF(p_data->>'prioridade', ''), 'NORMAL'),
    NULLIF(p_data->>'prazo_previsto', '')::date,
    NULLIF(p_data->>'observacoes', ''),
    auth.uid(),
    timezone('utc'::text, now())
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

ALTER TABLE public.laboratorios_proteticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_proteticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_proteticas_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_proteticas_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view laboratorios_proteticos of their company"
ON public.laboratorios_proteticos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = laboratorios_proteticos.empresa_id
  )
);

CREATE POLICY "Admins can manage laboratorios_proteticos"
ON public.laboratorios_proteticos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = laboratorios_proteticos.empresa_id
      AND ue.perfil = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = laboratorios_proteticos.empresa_id
      AND ue.perfil = 'admin'
  )
);

CREATE POLICY "Users can view ordens_proteticas of their company"
ON public.ordens_proteticas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas.empresa_id
  )
);

CREATE POLICY "Users can insert ordens_proteticas in their company"
ON public.ordens_proteticas FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas.empresa_id
  )
);

CREATE POLICY "Users can update ordens_proteticas in their company"
ON public.ordens_proteticas FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas.empresa_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas.empresa_id
  )
);

CREATE POLICY "Users can view ordens_proteticas_eventos of their company"
ON public.ordens_proteticas_eventos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas_eventos.empresa_id
  )
);

CREATE POLICY "Users can insert ordens_proteticas_eventos in their company"
ON public.ordens_proteticas_eventos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas_eventos.empresa_id
  )
);

CREATE POLICY "Users can view ordens_proteticas_anexos of their company"
ON public.ordens_proteticas_anexos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas_anexos.empresa_id
  )
);

CREATE POLICY "Users can insert ordens_proteticas_anexos in their company"
ON public.ordens_proteticas_anexos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = ordens_proteticas_anexos.empresa_id
  )
);

-- Tabela de Auditoria para Cancelamento de Orçamentos
-- Ajustada para usar TEXT em todos os IDs de referência internos (Padrão atual do Banco)
CREATE TABLE IF NOT EXISTS public.orcamento_cancelados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orcamento_id TEXT REFERENCES public.orcamentos(id), -- Tipo TEXT para bater com public.orcamentos.id
    orcamento_seqid BIGINT,                           -- Para exibição amigável (#123)
    paciente_id BIGINT,
    paciente_nome TEXT,
    empresa_id TEXT REFERENCES public.empresas(id),    -- Tipo TEXT para bater com public.empresas.id
    total_pago_na_epoca DECIMAL(10,2) DEFAULT 0,
    comissoes_pagas_detalhe TEXT,                     -- Detalhes das comissões que já estavam pagas
    comissoes_estornadas_detalhe TEXT,                -- Detalhes das comissões pendentes que foram removidas
    motivo_cancelamento TEXT,
    cancelado_por_nome TEXT,
    cancelado_por_id UUID REFERENCES auth.users(id),  -- IDs de AUTH são UUID por padrão
    data_cancelamento TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.orcamento_cancelados ENABLE ROW LEVEL SECURITY;

-- Política de visualização (Admins e Supervisores da mesma empresa)
DROP POLICY IF EXISTS "Permitir leitura para admins da empresa" ON public.orcamento_cancelados;
CREATE POLICY "Permitir leitura para admins da empresa" ON public.orcamento_cancelados
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT usuario_id FROM public.usuario_empresas 
            WHERE empresa_id = orcamento_cancelados.empresa_id 
            AND perfil IN ('admin', 'supervisor')
        )
    );

-- Política de inserção (Qualquer usuário autenticado da empresa)
DROP POLICY IF EXISTS "Permitir inserção para membros da empresa" ON public.orcamento_cancelados;
CREATE POLICY "Permitir inserção para membros da empresa" ON public.orcamento_cancelados
    FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT usuario_id FROM public.usuario_empresas 
            WHERE empresa_id = orcamento_cancelados.empresa_id
        )
    );

COMMENT ON TABLE public.orcamento_cancelados IS 'Registra o log de auditoria detalhado sempre que um orçamento é cancelado.';

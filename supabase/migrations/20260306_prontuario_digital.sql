-- Migration: Create Clinical Record (Prontuário) Tables

-- 1. Patient Evolution (Prontuário propriamente dito)
-- "Append-only" by design (no update/delete policies will be created for regular users)
CREATE TABLE IF NOT EXISTS public.paciente_evolucao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id TEXT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id TEXT REFERENCES public.profissionais(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    dente_regiao TEXT,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    user_ip TEXT
);

-- 2. Patient Documents (Consent terms, etc.)
CREATE TABLE IF NOT EXISTS public.paciente_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id TEXT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- 'TCLE', 'Contrato', 'Anamnese Assinada'
    nome_arquivo TEXT NOT NULL,
    conteudo_base64 TEXT NOT NULL, -- Optimized for small files or stored in Storage bucket later
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Enable RLS
ALTER TABLE public.paciente_evolucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paciente_documentos ENABLE ROW LEVEL SECURITY;

-- 4. Policies for paciente_evolucao
CREATE POLICY "Users can view evolution records of their company" 
ON public.paciente_evolucao FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_empresas ue 
        WHERE ue.usuario_id = auth.uid() 
        AND ue.empresa_id = paciente_evolucao.empresa_id
    )
);

CREATE POLICY "Users can insert evolution records in their company" 
ON public.paciente_evolucao FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_empresas ue 
        WHERE ue.usuario_id = auth.uid() 
        AND ue.empresa_id = paciente_evolucao.empresa_id
    )
);

-- NOTICE: We EXPLICITLY do NOT create UPDATE or DELETE policies for paciente_evolucao 
-- to ensure legal "append-only" behavior.

-- 5. Policies for paciente_documentos (similar logic)
CREATE POLICY "Users can view documents of their company" 
ON public.paciente_documentos FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_empresas ue 
        WHERE ue.usuario_id = auth.uid() 
        AND ue.empresa_id = paciente_documentos.empresa_id
    )
);

CREATE POLICY "Users can insert documents in their company" 
ON public.paciente_documentos FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_empresas ue 
        WHERE ue.usuario_id = auth.uid() 
        AND ue.empresa_id = paciente_documentos.empresa_id
    )
);

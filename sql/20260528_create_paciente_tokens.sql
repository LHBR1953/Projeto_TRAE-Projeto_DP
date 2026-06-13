-- Criação da tabela de tokens de acesso para o Portal do Paciente
CREATE TABLE IF NOT EXISTS public.paciente_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id TEXT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de segurança (RLS)
ALTER TABLE public.paciente_tokens ENABLE ROW LEVEL SECURITY;

-- Permitir inserção de novos tokens (útil se o frontend gerar, ou pode ser restrito à service_role)
CREATE POLICY "Permitir inserção de tokens" ON public.paciente_tokens FOR INSERT WITH CHECK (true);

-- Permitir leitura de tokens (útil para o portal verificar a validade)
CREATE POLICY "Permitir leitura de tokens" ON public.paciente_tokens FOR SELECT USING (true);

-- Permitir deleção (opcional, para limpar tokens expirados)
CREATE POLICY "Permitir exclusão de tokens" ON public.paciente_tokens FOR DELETE USING (true);

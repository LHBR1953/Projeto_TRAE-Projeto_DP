-- 20260518_suporte_tickets.sql

CREATE TABLE public.suporte_tickets (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    emp_id uuid NOT NULL,
    nome_empresa text NULL,
    usuario_nome text NULL,
    titulo text NULL,
    categoria text NULL,
    descricao text NOT NULL,
    resposta_admin text NULL,
    status text NOT NULL DEFAULT 'Aberto'::text,
    data_criacao timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT suporte_tickets_pkey PRIMARY KEY (id),
    CONSTRAINT suporte_tickets_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.empresas(id) ON DELETE CASCADE
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.suporte_tickets ENABLE ROW LEVEL SECURITY;

-- Política de leitura: SuperAdmin pode ler tudo. Usuário comum lê apenas os tickets da sua empresa.
CREATE POLICY "Leitura de suporte_tickets"
    ON public.suporte_tickets
    FOR SELECT
    USING (
        (auth.uid() IN (SELECT user_id FROM super_admins)) 
        OR 
        (emp_id IN (SELECT empresa_id FROM usuario_empresas WHERE user_id = auth.uid()))
    );

-- Política de inserção: Usuário pode inserir tickets para sua própria empresa.
CREATE POLICY "Inserção de suporte_tickets"
    ON public.suporte_tickets
    FOR INSERT
    WITH CHECK (
        emp_id IN (SELECT empresa_id FROM usuario_empresas WHERE user_id = auth.uid())
    );

-- Política de atualização: SuperAdmin pode atualizar tudo (status).
CREATE POLICY "Atualização de suporte_tickets"
    ON public.suporte_tickets
    FOR UPDATE
    USING (
        (auth.uid() IN (SELECT user_id FROM super_admins))
    );

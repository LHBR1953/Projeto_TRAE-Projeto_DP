-- Create the user-to-company mapping table
CREATE TABLE IF NOT EXISTS public.usuario_empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'dentista', 'recepcao')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(usuario_id, empresa_id)
);

-- Turn on Row Level Security
ALTER TABLE public.usuario_empresas ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own mappings
CREATE POLICY "Users can view their own tenant mappings" 
ON public.usuario_empresas 
FOR SELECT 
USING (auth.uid() = usuario_id);

-- Allow admins to view all users in their tenant
CREATE POLICY "Admins can view all users in their company" 
ON public.usuario_empresas 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_empresas ue
        WHERE ue.usuario_id = auth.uid() 
        AND ue.empresa_id = usuario_empresas.empresa_id 
        AND ue.perfil = 'admin'
    )
);

-- Allow admins to insert/update users in their tenant
CREATE POLICY "Admins can manage users in their company" 
ON public.usuario_empresas 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_empresas ue
        WHERE ue.usuario_id = auth.uid() 
        AND ue.empresa_id = usuario_empresas.empresa_id 
        AND ue.perfil = 'admin'
    )
);

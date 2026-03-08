-- 1. Create User to Empresa Mapping Table
CREATE TABLE IF NOT EXISTS public.usuario_empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    perfil TEXT NOT NULL DEFAULT 'dentista', -- Ex: 'admin', 'dentista', 'recepcao'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, empresa_id) -- A user configures their profile per clinic once
);

-- Enable RLS (Row Level Security) - optional but good practice to ensure users only see their rows if policies are turned on later
ALTER TABLE public.usuario_empresas ENABLE ROW LEVEL SECURITY;

-- Note: Because Supabase 'auth.users' is managed by the Auth server, we link to it using UUID.
-- You will need to manually insert a test user into 'auth.users' via the Supabase Dashboard Authentication UI, 
-- and then link their UUID here to 'emp_padrao' to test the login.

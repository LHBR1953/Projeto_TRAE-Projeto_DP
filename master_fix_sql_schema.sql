-- MASTER FIX: Permissions and Email Columns
-- Run this in the Supabase SQL Editor to fix the login issues and enable RBAC.

-- 1. Ensure the 'empresas' table exists and has at least one record
-- Many users might be mapped to 'emp_padrao' or 'padrão'
INSERT INTO public.empresas (id, nome)
VALUES ('padrão', 'Minha Clínica')
ON CONFLICT (id) DO NOTHING;

-- 2. Add missing columns to 'usuario_empresas'
ALTER TABLE public.usuario_empresas ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.usuario_empresas ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 3. (Optional) Fix column name inconsistency if you used 'user_id' instead of 'usuario_id'
-- Uncomment if you see errors about "usuario_id" not found
-- ALTER TABLE public.usuario_empresas RENAME COLUMN user_id TO usuario_id;

-- 4. Ensure RLS allows the initial fetch (Already in your previous migrations, but safe to repeat)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own tenant mappings') THEN
        CREATE POLICY "Users can view their own tenant mappings" 
        ON public.usuario_empresas FOR SELECT 
        USING (auth.uid() = usuario_id);
    END IF;
END $$;

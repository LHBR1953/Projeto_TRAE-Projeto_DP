-- Migration to add user_email to usuario_empresas
-- This column is required to show the user's email instead of their UUID in the management list.

ALTER TABLE public.usuario_empresas ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Optional: If you already have existing users, you might want to try to recover their emails from auth.users (requires high privileges)
-- UPDATE public.usuario_empresas ue
-- SET user_email = au.email
-- FROM auth.users au
-- WHERE ue.usuario_id = au.id
-- AND ue.user_email IS NULL;

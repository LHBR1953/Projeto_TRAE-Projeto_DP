-- Add logotipo column to empresas table
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS logotipo TEXT;

-- Update RLS if necessary (assuming it already exists for general access by authenticated users)
-- Grant select/insert/update/delete on empresas for admin role via RBAC logic in app.js

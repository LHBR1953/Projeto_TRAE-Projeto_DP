-- ========================================================================================
-- SCRIPT DE CRIAÇÃO DE BUCKET E POLÍTICAS DE ACESSO (STORAGE)
-- Objetivo: Criar o bucket 'occ_documentos' para upload de PDFs no Chat do Portal do Paciente
-- ========================================================================================

-- 1. Criar o bucket 'occ_documentos' (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'occ_documentos', 
  'occ_documentos', 
  true, -- public: true permite acesso aos arquivos via getPublicUrl sem autenticação
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. Criar Política de SELECT (Leitura)
-- Permite que qualquer pessoa leia os arquivos (necessário para visualizar os anexos do chat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Leitura Pública do occ_documentos'
  ) THEN
    CREATE POLICY "Leitura Pública do occ_documentos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'occ_documentos');
  END IF;
END $$;


-- 3. Criar Política de INSERT (Upload)
-- Permite uploads públicos (anon) para o bucket (necessário pois o Portal do Paciente não usa Supabase Auth nativo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Upload Público para occ_documentos'
  ) THEN
    CREATE POLICY "Upload Público para occ_documentos"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'occ_documentos');
  END IF;
END $$;


-- 4. Criar Política de UPDATE/DELETE (Opcional, restrito a autenticados se necessário)
-- Apenas usuários autenticados da clínica podem deletar os arquivos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Delete Autenticado occ_documentos'
  ) THEN
    CREATE POLICY "Delete Autenticado occ_documentos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'occ_documentos');
  END IF;
END $$;

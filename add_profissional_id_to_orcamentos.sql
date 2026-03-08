-- Migration: Add profissional_id column to orcamentos table
-- Represents the professional responsible for creating the budget
-- Run this in Supabase Dashboard > SQL Editor

-- NOTE: profissionais.id is of type TEXT, so profissional_id must also be TEXT
ALTER TABLE orcamentos
ADD COLUMN IF NOT EXISTS profissional_id text REFERENCES profissionais(id) ON DELETE SET NULL;

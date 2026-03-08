-- Supabase Initial Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Especialidades Table
CREATE TABLE especialidades (
    id TEXT PRIMARY KEY,
    seqid SERIAL NOT NULL,
    nome TEXT NOT NULL,
    subdivisoes JSONB DEFAULT '[]'::jsonb
);

-- 3. Create Pacientes Table
CREATE TABLE pacientes (
    id TEXT PRIMARY KEY,
    seqid SERIAL NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT,
    datanascimento DATE,
    sexo TEXT,
    profissao TEXT,
    telefone TEXT,
    celular TEXT NOT NULL,
    email TEXT,
    cep TEXT,
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    anamnese JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Profissionais Table
CREATE TABLE profissionais (
    id TEXT PRIMARY KEY,
    seqid SERIAL NOT NULL,
    nome TEXT NOT NULL,
    celular TEXT NOT NULL,
    email TEXT,
    tipo TEXT NOT NULL, -- 'Clinico' or 'Especialista'
    especialidadeid TEXT REFERENCES especialidades(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Ativo',
    photo TEXT, -- Store Base64 strings or URLs here
    comissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Servicos/Estoque Table
CREATE TABLE servicos (
    id TEXT PRIMARY KEY,
    seqid SERIAL NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ie TEXT NOT NULL, -- 'S' or 'E'
    subdivisao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Orcamentos Table
CREATE TABLE orcamentos (
    id TEXT PRIMARY KEY,
    seqid SERIAL NOT NULL,
    pacienteid TEXT REFERENCES pacientes(id) ON DELETE CASCADE,
    pacientenome TEXT NOT NULL,
    pacientecelular TEXT,
    pacienteemail TEXT,
    status TEXT DEFAULT 'Pendente',
    itens JSONB DEFAULT '[]'::jsonb, -- Array of objects representing each sub-item
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

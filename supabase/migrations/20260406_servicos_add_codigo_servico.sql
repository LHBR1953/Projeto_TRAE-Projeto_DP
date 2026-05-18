alter table if exists public.servicos
  add column if not exists codigo_servico text;

notify pgrst, 'reload schema';

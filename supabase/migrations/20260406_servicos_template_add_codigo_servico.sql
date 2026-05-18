alter table if exists public.servicos_template
  add column if not exists codigo_servico text;

notify pgrst, 'reload schema';

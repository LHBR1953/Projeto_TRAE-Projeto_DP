alter table if exists public.pacientes
  add column if not exists numero_prontuario text;

notify pgrst, 'reload schema';

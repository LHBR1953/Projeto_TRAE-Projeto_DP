begin;

update public.servicos
set
  tipo_calculo = 'Fixo',
  exige_elemento = true
where
  (tipo_calculo is distinct from 'Fixo')
  or (exige_elemento is distinct from true);

notify pgrst, 'reload schema';

commit;

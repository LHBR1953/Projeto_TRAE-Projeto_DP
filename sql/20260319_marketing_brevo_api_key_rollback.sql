begin;

alter table public.marketing_smtp_config
  drop column if exists brevo_api_key;

notify pgrst, 'reload schema';

commit;


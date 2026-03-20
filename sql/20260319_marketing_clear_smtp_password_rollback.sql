begin;

drop function if exists public.rpc_marketing_clear_smtp_password(text);

notify pgrst, 'reload schema';

commit;


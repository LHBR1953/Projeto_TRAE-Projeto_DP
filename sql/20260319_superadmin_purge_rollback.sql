begin;

revoke execute on function public.rpc_occ_purge_empresa(text, text, text, text, boolean, boolean) from authenticated;
drop function if exists public.rpc_occ_purge_empresa(text, text, text, text, boolean, boolean);

commit;


begin;

do $$
declare
  p_bucket_override text := null;
  b text;
  pol text;
begin
  if p_bucket_override is not null and length(trim(p_bucket_override)) > 0 then
    b := trim(p_bucket_override);
    pol := 'pdf_read_authenticated_' || b;
    execute format('drop policy if exists %I on storage.objects', pol);
    return;
  end if;

  if to_regclass('public.financeiro_notas') is null then
    for pol in
      select p.policyname
      from pg_policies p
      where p.schemaname = 'storage'
        and p.tablename = 'objects'
        and p.policyname like 'pdf_read_authenticated\_%' escape '\'
    loop
      execute format('drop policy if exists %I on storage.objects', pol);
    end loop;
    return;
  end if;

  for b in
    select distinct substring(fn.pdf_url from '/storage/v1/object/(?:public/|sign/)?([^/]+)/')
    from public.financeiro_notas fn
    where fn.pdf_url is not null
      and fn.pdf_url like '%/storage/v1/object/%'
  loop
    b := coalesce(nullif(trim(b), ''), null);
    if b is null then
      continue;
    end if;
    pol := 'pdf_read_authenticated_' || b;
    execute format('drop policy if exists %I on storage.objects', pol);
  end loop;
end $$;

commit;

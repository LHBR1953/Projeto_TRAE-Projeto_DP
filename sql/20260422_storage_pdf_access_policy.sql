begin;

do $$
declare
  p_make_public boolean := false;
  p_bucket_override text := null;
  b text;
  pol text;
begin
  if p_bucket_override is not null and length(trim(p_bucket_override)) > 0 then
    b := trim(p_bucket_override);
    if not exists (select 1 from storage.buckets sb where sb.id = b) then
      raise notice 'Bucket override não encontrado em storage.buckets: %', b;
      return;
    end if;
    if p_make_public then
      update storage.buckets set public = true where id = b;
    end if;
    pol := 'pdf_read_authenticated_' || b;
    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'storage'
        and p.tablename = 'objects'
        and p.policyname = pol
    ) then
      execute format(
        'create policy %I on storage.objects for select to authenticated using (bucket_id = %L)',
        pol,
        b
      );
    end if;
    return;
  end if;

  if to_regclass('public.financeiro_notas') is null then
    raise notice 'Tabela public.financeiro_notas não encontrada; não foi possível detectar bucket pelo pdf_url.';
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
    if not exists (select 1 from storage.buckets sb where sb.id = b) then
      raise notice 'Bucket detectado no pdf_url, mas não existe em storage.buckets: %', b;
      continue;
    end if;
    if p_make_public then
      update storage.buckets set public = true where id = b;
    end if;
    pol := 'pdf_read_authenticated_' || b;
    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'storage'
        and p.tablename = 'objects'
        and p.policyname = pol
    ) then
      execute format(
        'create policy %I on storage.objects for select to authenticated using (bucket_id = %L)',
        pol,
        b
      );
    end if;
  end loop;
end $$;

commit;

with detected as (
  select
    substring(fn.pdf_url from '/storage/v1/object/(?:public/|sign/)?([^/]+)/') as bucket_id,
    count(*) as qtd
  from public.financeiro_notas fn
  where fn.pdf_url is not null
    and fn.pdf_url like '%/storage/v1/object/%'
  group by 1
)
select
  d.bucket_id,
  d.qtd,
  (sb.id is not null) as bucket_existe,
  sb.public as bucket_publico,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = ('pdf_read_authenticated_' || d.bucket_id)
  ) as policy_select_authenticated_existe
from detected d
left join storage.buckets sb on sb.id = d.bucket_id
order by d.qtd desc, d.bucket_id;

select id, name, public, created_at
from storage.buckets
order by id;

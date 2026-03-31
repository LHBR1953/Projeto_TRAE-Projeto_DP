do $$
declare
  v_src text := 'emp_dp';
  v_dst text := 'emp_gemini';
begin
  if v_src is null or v_dst is null or length(trim(v_src)) = 0 or length(trim(v_dst)) = 0 then
    raise exception 'Informe v_src e v_dst.';
  end if;
  if v_src = v_dst then
    raise exception 'v_src e v_dst devem ser diferentes.';
  end if;
  if to_regclass('public.especialidades') is null then
    raise exception 'Tabela public.especialidades não existe.';
  end if;
  if to_regclass('public.especialidade_subdivisoes') is null then
    raise exception 'Tabela public.especialidade_subdivisoes não existe.';
  end if;

  create temporary table if not exists tmp_spec_map (
    src_id text primary key,
    src_nome text not null,
    src_seqid integer,
    src_key text not null,
    dst_id text,
    dst_seqid integer
  ) on commit drop;

  truncate table tmp_spec_map;

  insert into tmp_spec_map (src_id, src_nome, src_seqid, src_key)
  select s.id, s.nome, s.seqid, upper(trim(s.nome))
  from public.especialidades s
  where s.empresa_id = v_src;

  update tmp_spec_map m
  set dst_id = d.id,
      dst_seqid = d.seqid
  from public.especialidades d
  where d.empresa_id = v_dst
    and upper(trim(d.nome)) = m.src_key;

  with missing as (
    select
      m.src_id,
      m.src_nome,
      m.src_seqid,
      m.src_key,
      case
        when m.src_seqid is not null
          and not exists (
            select 1
            from public.especialidades d
            where d.empresa_id = v_dst
              and d.seqid = m.src_seqid
          )
          and row_number() over (partition by m.src_seqid order by m.src_key, m.src_id) = 1
        then m.src_seqid
        else null
      end as preferred_seqid
    from tmp_spec_map m
    where m.dst_id is null
  ),
  base as (
    select coalesce(max(seqid), 0) as max_seq
    from public.especialidades
    where empresa_id = v_dst
  ),
  missing2 as (
    select
      'esp_' || substr(md5(v_dst || '|' || src_key), 1, 16) as new_id,
      src_nome,
      src_key,
      coalesce(preferred_seqid, base.max_seq + row_number() over (order by src_key, src_id)) as dst_seqid
    from missing
    cross join base
  ),
  ins as (
    insert into public.especialidades (id, empresa_id, nome, seqid)
    select new_id, v_dst, src_nome, dst_seqid
    from missing2
    on conflict (id) do update set
      empresa_id = excluded.empresa_id,
      nome = excluded.nome,
      seqid = excluded.seqid
    returning id, upper(trim(nome)) as key, seqid
  )
  update tmp_spec_map m
  set dst_id = i.id,
      dst_seqid = i.seqid
  from ins i
  where m.dst_id is null
    and m.src_key = i.key;

  insert into public.especialidade_subdivisoes (id, especialidade_id, nome, empresa_id)
  select
    'sub_' || substr(md5(v_dst || '|' || m.dst_id || '|' || upper(trim(s.nome))), 1, 16) as new_id,
    m.dst_id,
    s.nome,
    v_dst
  from public.especialidade_subdivisoes s
  join tmp_spec_map m on m.src_id = s.especialidade_id
  where s.empresa_id = v_src
    and m.dst_id is not null
    and not exists (
      select 1
      from public.especialidade_subdivisoes t
      where t.empresa_id = v_dst
        and t.especialidade_id = m.dst_id
        and upper(trim(t.nome)) = upper(trim(s.nome))
    );
end $$;


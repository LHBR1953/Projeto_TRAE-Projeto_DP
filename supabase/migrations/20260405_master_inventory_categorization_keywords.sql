create extension if not exists unaccent;

do $$
declare
  v_emp text := 'emp_a279673a1b';
  v_has_area boolean := false;
  v_has_cat boolean := false;
  v_has_tipo boolean := false;
begin
  if not exists (select 1 from public.empresas where id::text = v_emp) then
    raise exception 'Empresa mestre % não encontrada em empresas.', v_emp;
  end if;

  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='area')
    into v_has_area;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='categoria')
    into v_has_cat;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='tipo_inventario')
    into v_has_tipo;

  if not v_has_area and not v_has_cat then
    raise exception 'Colunas area/categoria não existem em inventory.';
  end if;

  with base as (
    select
      id,
      unaccent(coalesce(nome, '')) as nome_raw
    from public.inventory
    where empresa_id::text = v_emp
  ),
  rules as (
    select
      id,
      case
        when nome_raw ilike unaccent('%espelho%')
          or nome_raw ilike unaccent('%pinca%')
          or nome_raw ilike unaccent('%pinça%')
          or nome_raw ilike unaccent('%sonda%')
          or nome_raw ilike unaccent('%cureta%')
          or nome_raw ilike unaccent('%explorador%')
          or nome_raw ilike unaccent('%espatula%')
          or nome_raw ilike unaccent('%espátula%')
          or nome_raw ilike unaccent('%escavador%')
          or nome_raw ilike unaccent('%hollemback%')
          then 'Instrumental'

        when nome_raw ilike unaccent('%lamina%')
          or nome_raw ilike unaccent('%bisturi%')
          or nome_raw ilike unaccent('%sutura%')
          or nome_raw ilike unaccent('%nylon%')
          or nome_raw ilike unaccent('%seda%')
          or nome_raw ilike unaccent('%hemospon%')
          or nome_raw ilike unaccent('%alveollex%')
          or nome_raw ilike unaccent('%anestes%')
          or nome_raw ilike unaccent('%tubete%')
          or nome_raw ilike unaccent('%carpule%')
          or nome_raw ilike unaccent('%foice%')
          or nome_raw ilike unaccent('%forceps%')
          or nome_raw ilike unaccent('%fórceps%')
          or nome_raw ilike unaccent('%elevador%')
          or nome_raw ilike unaccent('%enxerto%')
          or nome_raw ilike unaccent('%membrana%')
          or nome_raw ilike unaccent('%parafuso%')
          or nome_raw ilike unaccent('%canula%')
          or nome_raw ilike unaccent('%cânula%')
          or nome_raw ilike unaccent('%soro%')
          or nome_raw ilike unaccent('%espacador%')
          or nome_raw ilike unaccent('%espaçador%')
          then 'Cirurgia'

        when nome_raw ilike unaccent('%guta%')
          or nome_raw ilike unaccent('%lima%')
          or nome_raw ilike unaccent('%edta%')
          or nome_raw ilike unaccent('%absorvente%')
          or nome_raw ilike unaccent('%cimento obturador%')
          or nome_raw ilike unaccent('%cimento endodont%')
          or nome_raw ilike unaccent('%hipoclorito%')
          or nome_raw ilike unaccent('%paramonoclorofenol%')
          or nome_raw ilike unaccent('%lentulo%')
          or nome_raw ilike unaccent('%irrig%')
          or nome_raw ilike unaccent('%localizador%')
          then 'Endodontia'

        when nome_raw ilike unaccent('%braquete%')
          or nome_raw ilike unaccent('%arco%')
          or nome_raw ilike unaccent('%elastic%')
          or nome_raw ilike unaccent('%alicate%')
          or nome_raw ilike unaccent('%corta fio%')
          or nome_raw ilike unaccent('%tubo%')
          or nome_raw ilike unaccent('%separador%')
          or nome_raw ilike unaccent('%fio ortodont%')
          or nome_raw ilike unaccent('%chave de torque%')
          or nome_raw ilike unaccent('%paquimetro%')
          or nome_raw ilike unaccent('%paquímetro%')
          then 'Ortodontia'

        when nome_raw ilike unaccent('%toxina botulinica%')
          or nome_raw ilike unaccent('%toxina botulínica%')
          or nome_raw ilike unaccent('%botox%')
          then 'Harmonização Facial'

        when nome_raw ilike unaccent('%resina%')
          or nome_raw ilike unaccent('%adesivo%')
          or nome_raw ilike unaccent('%acido%')
          or nome_raw ilike unaccent('%ionomero%')
          or nome_raw ilike unaccent('%ionômero%')
          or nome_raw ilike unaccent('%seringa%')
          or nome_raw ilike unaccent('%agulha%')
          or nome_raw ilike unaccent('%matriz%')
          or nome_raw ilike unaccent('%poliester%')
          or nome_raw ilike unaccent('%polie%')
          or nome_raw ilike unaccent('%lixa%')
          or nome_raw ilike unaccent('%tira%')
          or nome_raw ilike unaccent('%clareamento%')
          or nome_raw ilike unaccent('%peroxido%')
          or nome_raw ilike unaccent('%peróxido%')
          or nome_raw ilike unaccent('%microbrush%')
          or nome_raw ilike unaccent('%condicionador%')
          or nome_raw ilike unaccent('%broca%')
          or nome_raw ilike unaccent('%kit de broca%')
          or nome_raw ilike unaccent('%papel articul%')
          or nome_raw ilike unaccent('%gel%')
          or nome_raw ilike unaccent('%dappen%')
          or nome_raw ilike unaccent('%gode%')
          or nome_raw ilike unaccent('%godê%')
          then 'Dentística'

        when nome_raw ilike unaccent('%gaze%')
          then 'Biossegurança'

        when nome_raw ilike unaccent('%alginato%')
          or nome_raw ilike unaccent('%silicone%')
          or nome_raw ilike unaccent('%gesso%')
          or nome_raw ilike unaccent('%coping%')
          or nome_raw ilike unaccent('%munhao%')
          or nome_raw ilike unaccent('%munhão%')
          then 'Prótese'

        when nome_raw ilike unaccent('%luva%')
          or nome_raw ilike unaccent('%mascara%')
          or nome_raw ilike unaccent('%máscara%')
          or nome_raw ilike unaccent('%touca%')
          or nome_raw ilike unaccent('%prope%')
          or nome_raw ilike unaccent('%propé%')
          or nome_raw ilike unaccent('%alcool%')
          or nome_raw ilike unaccent('%álcool%')
          or nome_raw ilike unaccent('%detergente%')
          or nome_raw ilike unaccent('%enzimatic%')
          or nome_raw ilike unaccent('%grau cirurgic%')
          or nome_raw ilike unaccent('%autoclave%')
          or nome_raw ilike unaccent('%indicador%')
          or nome_raw ilike unaccent('%campo%')
          or nome_raw ilike unaccent('%sugador%')
          or nome_raw ilike unaccent('%babador%')
          or nome_raw ilike unaccent('%avental%')
          then 'Biossegurança'

        when nome_raw ilike unaccent('%contra-angulo%')
          or nome_raw ilike unaccent('%contra angulo%')
          or nome_raw ilike unaccent('%peca de mao%')
          or nome_raw ilike unaccent('%peça de mao%')
          or nome_raw ilike unaccent('%peça de mão%')
          or nome_raw ilike unaccent('%turbina%')
          or nome_raw ilike unaccent('%fotopolimerizador%')
          or nome_raw ilike unaccent('%ponta de sugador%')
          then 'Consultório'

        when nome_raw ilike unaccent('%papel sulfite%')
          or nome_raw ilike unaccent('%sulfite%')
          or nome_raw ilike unaccent('%caneta%')
          or nome_raw ilike unaccent('%toner%')
          or nome_raw ilike unaccent('%grampeador%')
          or nome_raw ilike unaccent('%cafe%')
          or nome_raw ilike unaccent('%café%')
          or nome_raw ilike unaccent('%acucar%')
          or nome_raw ilike unaccent('%açúcar%')
          or nome_raw ilike unaccent('%guardanapo%')
          or nome_raw ilike unaccent('%copo descart%')
          or nome_raw ilike unaccent('%copo plast%')
          or nome_raw ilike unaccent('%copo agua%')
          or nome_raw ilike unaccent('%copo café%')
          or nome_raw ilike unaccent('%copo cafe%')
          then 'Geral'

        else 'Dentística'
      end as target_area,
      case
        when nome_raw ilike unaccent('%espelho%')
          or nome_raw ilike unaccent('%pinca%')
          or nome_raw ilike unaccent('%pinça%')
          or nome_raw ilike unaccent('%sonda%')
          or nome_raw ilike unaccent('%cureta%')
          or nome_raw ilike unaccent('%explorador%')
          or nome_raw ilike unaccent('%espatula%')
          or nome_raw ilike unaccent('%espátula%')
          or nome_raw ilike unaccent('%escavador%')
          or nome_raw ilike unaccent('%hollemback%')
          then 'INSTRUMENTAL'

        when nome_raw ilike unaccent('%contra-angulo%')
          or nome_raw ilike unaccent('%contra angulo%')
          or nome_raw ilike unaccent('%peca de mao%')
          or nome_raw ilike unaccent('%peça de mao%')
          or nome_raw ilike unaccent('%peça de mão%')
          or nome_raw ilike unaccent('%turbina%')
          or nome_raw ilike unaccent('%fotopolimerizador%')
          or nome_raw ilike unaccent('%motor%')
          then 'CONSULTÓRIO'

        when nome_raw ilike unaccent('%lamina%')
          or nome_raw ilike unaccent('%bisturi%')
          or nome_raw ilike unaccent('%sutura%')
          or nome_raw ilike unaccent('%nylon%')
          or nome_raw ilike unaccent('%seda%')
          or nome_raw ilike unaccent('%hemospon%')
          or nome_raw ilike unaccent('%alveollex%')
          or nome_raw ilike unaccent('%anestes%')
          or nome_raw ilike unaccent('%tubete%')
          or nome_raw ilike unaccent('%carpule%')
          or nome_raw ilike unaccent('%foice%')
          or nome_raw ilike unaccent('%forceps%')
          or nome_raw ilike unaccent('%fórceps%')
          or nome_raw ilike unaccent('%elevador%')
          or nome_raw ilike unaccent('%enxerto%')
          or nome_raw ilike unaccent('%membrana%')
          or nome_raw ilike unaccent('%parafuso%')
          or nome_raw ilike unaccent('%canula%')
          or nome_raw ilike unaccent('%cânula%')
          or nome_raw ilike unaccent('%soro%')
          or nome_raw ilike unaccent('%espacador%')
          or nome_raw ilike unaccent('%espaçador%')
          then 'CIRURGIA'

        when nome_raw ilike unaccent('%contra-angulo%')
          or nome_raw ilike unaccent('%contra angulo%')
          or nome_raw ilike unaccent('%peca de mao%')
          or nome_raw ilike unaccent('%peça de mao%')
          or nome_raw ilike unaccent('%peça de mão%')
          or nome_raw ilike unaccent('%turbina%')
          or nome_raw ilike unaccent('%fotopolimerizador%')
          or nome_raw ilike unaccent('%motor%')
          then 'CONSULTÓRIO'

        when nome_raw ilike unaccent('%papel sulfite%')
          or nome_raw ilike unaccent('%sulfite%')
          or nome_raw ilike unaccent('%caneta%')
          or nome_raw ilike unaccent('%toner%')
          or nome_raw ilike unaccent('%grampeador%')
          or nome_raw ilike unaccent('%cafe%')
          or nome_raw ilike unaccent('%café%')
          or nome_raw ilike unaccent('%acucar%')
          or nome_raw ilike unaccent('%açúcar%')
          or nome_raw ilike unaccent('%guardanapo%')
          or nome_raw ilike unaccent('%copo descart%')
          or nome_raw ilike unaccent('%copo plast%')
          or nome_raw ilike unaccent('%copo agua%')
          or nome_raw ilike unaccent('%copo café%')
          or nome_raw ilike unaccent('%copo cafe%')
          then 'GERAL'

        else null
      end as target_categoria
    from base
  )
  update public.inventory i
     set area = case
                  when v_has_area then coalesce(r.target_area, i.area)
                  else i.area
                end,
         categoria = case
                      when not v_has_cat then i.categoria
                      when coalesce(nullif(btrim(i.categoria), ''), '') <> '' then i.categoria
                      when coalesce(r.target_categoria, '') <> '' then r.target_categoria
                      when coalesce(r.target_area, '') = 'Geral' then 'GERAL'
                      when coalesce(r.target_area, '') = 'Cirurgia' then 'CIRURGIA'
                      else 'CONSUMO'
                    end
    from rules r
   where i.id = r.id
     and i.empresa_id::text = v_emp
     and (
       (v_has_area and (i.area is null or btrim(i.area) = '' or lower(btrim(i.area)) = lower('Geral')))
       or (v_has_cat and (i.categoria is null or btrim(i.categoria) = ''))
     );
end $$;

notify pgrst, 'reload schema';

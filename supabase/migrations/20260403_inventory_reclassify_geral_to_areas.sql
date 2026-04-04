alter table if exists inventory
  add column if not exists area text;

update inventory
set area = case
  when lower(nome) like '%resina%' or lower(nome) like '%adesivo%' or lower(nome) like '%acido%' or lower(nome) like '%matriz%' then 'Dentística'
  when lower(nome) like '%hipoclorito%' or lower(nome) like '%edta%' or lower(nome) like '%guta%' or lower(nome) like '%endo%' then 'Endodontia'
  when lower(nome) like '%gracey%' or lower(nome) like '%periodontal%' or lower(nome) like '%foice%' or lower(nome) like '%clorexidina%' then 'Periodontia'
  when lower(nome) like '%fórceps%' or lower(nome) like '%forceps%' or lower(nome) like '%bisturi%' or lower(nome) like '%afastador%' or lower(nome) like '%elevador%' or lower(nome) like '%cirurg%' then 'Cirurgia'
  when lower(nome) like '%implante%' or lower(nome) like '%torque%' or lower(nome) like '%broca%' or lower(nome) like '%enxerto%' or lower(nome) like '%membrana%' then 'Implantodontia'
  when lower(nome) like '%ortodont%' or lower(nome) like '%bráquete%' or lower(nome) like '%bracket%' or lower(nome) like '%ligadura%' or lower(nome) like '%mathieu%' then 'Ortodontia'
  when lower(nome) like '%hialur%' or lower(nome) like '%botul%' or lower(nome) like '%cânula%' or lower(nome) like '%canula%' or lower(nome) like '%facial%' then 'Harmonização Facial'
  else coalesce(nullif(btrim(area), ''), 'Dentística')
end
where area is null
   or btrim(area) = ''
   or lower(btrim(area)) = 'geral';

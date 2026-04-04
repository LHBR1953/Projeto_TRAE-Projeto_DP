const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_TOTAL = Number(process.env.TARGET_TOTAL || 500);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const AREAS = [
  { area: 'Cirurgia', model: 'Kit Cirurgia', consumables: ['Lâmina de Bisturi', 'Anestésico', 'Soro Fisiológico', 'Fio de Sutura', 'Gaze'], instrumentals: ['Fórceps', 'Elevador', 'Afastador', 'Pinça Cirúrgica'] },
  { area: 'Dentística', model: 'Kit Dentística', consumables: ['Resina Composta', 'Adesivo', 'Ácido Condicionador', 'Anestésico', 'Matriz'], instrumentals: ['Espelho Clínico', 'Sonda Exploradora', 'Porta Matriz', 'Pinça Clínica'] },
  { area: 'Endodontia', model: 'Kit Endodontia', consumables: ['Hipoclorito', 'EDTA', 'Cone de Guta-Percha', 'Cimento Endodôntico', 'Anestésico'], instrumentals: ['Lima Manual', 'Lima Rotatória', 'Espaçador', 'Localizador Apical'] },
  { area: 'Harmonização Facial', model: 'Kit Harmonização Facial', consumables: ['Ácido Hialurônico', 'Toxina Botulínica', 'Anestésico Tópico', 'Agulha', 'Cânula'], instrumentals: ['Paquímetro Facial', 'Pinça Anatômica', 'Espelho Facial', 'Porta Agulha'] },
  { area: 'Implantodontia', model: 'Kit Implantodontia', consumables: ['Soro Fisiológico', 'Parafuso de Cobertura', 'Membrana', 'Enxerto', 'Anestésico'], instrumentals: ['Chave de Torque', 'Kit de Brocas', 'Contra-ângulo', 'Pinça de Implante'] },
  { area: 'Ortodontia', model: 'Kit Ortodontia', consumables: ['Fio Ortodôntico', 'Ligadura Elástica', 'Tubo Ortodôntico', 'Resina Ortodôntica', 'Anestésico'], instrumentals: ['Alicate Ortodôntico', 'Corta Fio', 'Pinça Mathieu', 'Posicionador de Bráquete'] },
  { area: 'Periodontia', model: 'Kit Periodontia', consumables: ['Clorexidina', 'Gel Hemostático', 'Soro Fisiológico', 'Anestésico', 'Fio de Sutura'], instrumentals: ['Cureta Gracey', 'Sonda Periodontal', 'Foice', 'Pinça Periodontal'] },
];

async function getEmpresaId() {
  const { data, error } = await db.from('empresas').select('id').limit(1);
  if (error) throw error;
  return String(data[0].id);
}

async function ensureModel(empresaId, nomeModelo) {
  const ex = await db.from('usage_models').select('id').eq('empresa_id', empresaId).eq('nome_modelo', nomeModelo).maybeSingle();
  if (ex.error) throw ex.error;
  if (ex.data && ex.data.id) return String(ex.data.id);
  const ins = await db.from('usage_models').insert({ empresa_id: empresaId, nome_modelo: nomeModelo }).select('id').single();
  if (ins.error) throw ins.error;
  return String(ins.data.id);
}

async function resetInventory(empresaId) {
  const mdelAll = await db.from('model_items').delete().not('id', 'is', null);
  if (mdelAll.error) throw mdelAll.error;
  const ldelAll = await db.from('inventory_logs').delete().eq('empresa_id', empresaId);
  if (ldelAll.error) throw ldelAll.error;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const del = await db.from('inventory').delete().eq('empresa_id', empresaId);
    if (!del.error) return;
    if (String(del.error.code || '') !== '23503') throw del.error;
    const details = String(del.error.details || '');
    const m = details.match(/\(id\)=\(([0-9a-fA-F-]{36})\)/);
    if (!m || !m[1]) throw del.error;
    const refId = m[1];
    const md = await db.from('model_items').delete().eq('inventory_id', refId);
    if (md.error) throw md.error;
    const lg = await db.from('inventory_logs').delete().eq('inventory_id', refId);
    if (lg.error) throw lg.error;
  }
  throw new Error('Falha ao resetar inventory: dependências não resolvidas.');
}

async function upsertInventory(empresaId, row) {
  const payload = {
    empresa_id: empresaId,
    nome: row.nome,
    unidade: row.unidade || 'un',
    estoque_atual: 0,
    estoque_minimo: 0,
    eh_consumivel: !!row.eh_consumivel,
    codigo_barras: null,
  };
  const res = await db.from('inventory').upsert(payload, { onConflict: 'empresa_id,nome' }).select('id').single();
  if (res.error) throw res.error;
  return String(res.data.id);
}

async function upsertModelItem(modelId, inventoryId, qtd) {
  const ex = await db.from('model_items').select('id').eq('model_id', modelId).eq('inventory_id', inventoryId).maybeSingle();
  if (ex.error) throw ex.error;
  if (ex.data && ex.data.id) {
    const up = await db.from('model_items').update({ quantidade_sugerida: qtd }).eq('id', ex.data.id);
    if (up.error) throw up.error;
    return;
  }
  const ins = await db.from('model_items').insert({ model_id: modelId, inventory_id: inventoryId, quantidade_sugerida: qtd });
  if (ins.error) throw ins.error;
}

async function run() {
  const empresaId = await getEmpresaId();
  await resetInventory(empresaId);

  const modelByArea = new Map();
  for (const a of AREAS) {
    const modelId = await ensureModel(empresaId, a.model);
    modelByArea.set(a.area, modelId);
  }

  const perArea = Math.floor(TARGET_TOTAL / AREAS.length);
  const rem = TARGET_TOTAL - (perArea * AREAS.length);
  const seqByBase = new Map();
  const nextSeq = (base) => {
    const k = String(base || '');
    const n = Number(seqByBase.get(k) || 0) + 1;
    seqByBase.set(k, n);
    return n;
  };

  const rows = [];
  for (let aidx = 0; aidx < AREAS.length; aidx += 1) {
    const area = AREAS[aidx];
    const target = perArea + (aidx < rem ? 1 : 0);
    let idx = 1;
    while (rows.length < TARGET_TOTAL && rows.filter(r => r.area === area.area).length < target) {
      const cons = area.consumables[(idx - 1) % area.consumables.length];
      const inst = area.instrumentals[(idx - 1) % area.instrumentals.length];
      rows.push({ area: area.area, nome: `${cons} ${String(nextSeq(cons)).padStart(3, '0')}`, unidade: cons.toLowerCase().includes('anest') ? 'ml' : 'un', eh_consumivel: true });
      if (rows.filter(r => r.area === area.area).length >= target) break;
      rows.push({ area: area.area, nome: `${inst} ${String(nextSeq(inst)).padStart(3, '0')}`, unidade: 'un', eh_consumivel: false });
      idx += 1;
    }
  }

  let inserted = 0;
  for (const row of rows.slice(0, TARGET_TOTAL)) {
    const invId = await upsertInventory(empresaId, row);
    await upsertModelItem(modelByArea.get(row.area), invId, 1);
    inserted += 1;
  }

  let extra = 1;
  const getCount = async () => {
    const c = await db.from('inventory').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId);
    if (c.error) throw c.error;
    return Number(c.count || 0);
  };
  let currentCount = await getCount();
  while (currentCount < TARGET_TOTAL) {
    const area = AREAS[(extra - 1) % AREAS.length];
    const nome = `Item Complementar ${String(extra).padStart(4, '0')}`;
    const invId = await upsertInventory(empresaId, { nome, unidade: 'un', eh_consumivel: extra % 5 !== 0 });
    await upsertModelItem(modelByArea.get(area.area), invId, 1);
    extra += 1;
    currentCount = await getCount();
  }

  const countRes = await db.from('inventory').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId);
  if (countRes.error) throw countRes.error;
  process.stdout.write(`empresa_id=${empresaId}\n`);
  process.stdout.write(`inventory_total_count=${countRes.count}\n`);
}

run().catch((e) => {
  const msg = e && e.stack ? e.stack : JSON.stringify(e);
  process.stderr.write(String(msg) + '\n');
  process.exit(1);
});

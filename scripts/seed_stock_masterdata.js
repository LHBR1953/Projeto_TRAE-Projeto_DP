const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_TOTAL = Number(process.env.TARGET_TOTAL || 500);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function errorText(error) {
  return String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
}

const AREA_DEFS = [
  {
    area: 'Dentística',
    model: 'Kit Dentística',
    consumables: ['Resina Composta', 'Adesivo', 'Ácido Condicionador', 'Anestésico', 'Matriz'],
    instrumentals: ['Espelho Clínico', 'Sonda Exploradora', 'Porta Matriz', 'Pinça Clínica'],
    fractions: { 'Resina Composta': 0.05, Adesivo: 0.02, 'Ácido Condicionador': 0.1 },
  },
  {
    area: 'Endodontia',
    model: 'Kit Endodontia',
    consumables: ['Hipoclorito', 'EDTA', 'Cone de Guta-Percha', 'Cimento Endodôntico', 'Anestésico'],
    instrumentals: ['Lima Manual', 'Lima Rotatória', 'Espaçador', 'Localizador Apical'],
  },
  {
    area: 'Periodontia',
    model: 'Kit Periodontia',
    consumables: ['Clorexidina', 'Gel Hemostático', 'Soro Fisiológico', 'Anestésico', 'Fio de Sutura'],
    instrumentals: ['Cureta Gracey', 'Sonda Periodontal', 'Foice', 'Pinça Periodontal'],
  },
  {
    area: 'Cirurgia',
    model: 'Kit Cirurgia',
    consumables: ['Lâmina de Bisturi', 'Anestésico', 'Soro Fisiológico', 'Fio de Sutura', 'Gaze'],
    instrumentals: ['Fórceps', 'Elevador', 'Afastador', 'Pinça Cirúrgica'],
  },
  {
    area: 'Implantodontia',
    model: 'Kit Implantodontia',
    consumables: ['Soro Fisiológico', 'Parafuso de Cobertura', 'Membrana', 'Enxerto', 'Anestésico'],
    instrumentals: ['Chave de Torque', 'Kit de Brocas', 'Contra-ângulo', 'Pinça de Implante'],
  },
  {
    area: 'Ortodontia',
    model: 'Kit Ortodontia',
    consumables: ['Fio Ortodôntico', 'Ligadura Elástica', 'Tubo Ortodôntico', 'Resina Ortodôntica', 'Anestésico'],
    instrumentals: ['Alicate Ortodôntico', 'Corta Fio', 'Pinça Mathieu', 'Posicionador de Bráquete'],
  },
  {
    area: 'Harmonização Facial',
    model: 'Kit Harmonização Facial',
    consumables: ['Ácido Hialurônico', 'Toxina Botulínica', 'Anestésico Tópico', 'Agulha', 'Cânula'],
    instrumentals: ['Paquímetro Facial', 'Pinça Anatômica', 'Espelho Facial', 'Porta Agulha'],
  },
];

async function getEmpresaId() {
  const { data, error } = await db.from('empresas').select('id').limit(1);
  if (error) throw error;
  if (!Array.isArray(data) || !data.length) throw new Error('Nenhuma empresa encontrada.');
  return String(data[0].id || '').trim();
}

async function ensureModel(empresaId, nomeModelo) {
  const { data: existing, error: exErr } = await db.from('usage_models')
    .select('id,nome_modelo')
    .eq('empresa_id', empresaId)
    .eq('nome_modelo', nomeModelo)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing && existing.id) return String(existing.id);
  const { data: inserted, error } = await db.from('usage_models')
    .insert({ empresa_id: empresaId, nome_modelo: nomeModelo })
    .select('id')
    .single();
  if (error) throw error;
  return String(inserted.id);
}

function buildAreaItems(def, countPerArea, nextSeqByBase) {
  const out = [];
  let idx = 1;
  while (out.length < countPerArea) {
    const cons = def.consumables[(idx - 1) % def.consumables.length];
    const inst = def.instrumentals[(idx - 1) % def.instrumentals.length];
    const consSeq = nextSeqByBase(cons);
    out.push({
      nome: `${cons} ${String(consSeq).padStart(3, '0')}`,
      unidade: cons.toLowerCase().includes('anest') ? 'ml' : 'un',
      qtd: def.fractions && Object.prototype.hasOwnProperty.call(def.fractions, cons) ? Number(def.fractions[cons]) : 1,
      eh_consumivel: true,
      area: def.area,
    });
    if (out.length >= countPerArea) break;
    const instSeq = nextSeqByBase(inst);
    out.push({
      nome: `${inst} ${String(instSeq).padStart(3, '0')}`,
      unidade: 'un',
      qtd: 1,
      eh_consumivel: false,
      area: def.area,
    });
    idx += 1;
  }
  return out.slice(0, countPerArea);
}

async function getInventoryCount(empresaId) {
  const { count, error } = await db.from('inventory').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId);
  if (error) throw error;
  return Number(count || 0);
}

async function ensureInventory(empresaId, row) {
  let payload = {
    empresa_id: empresaId,
    nome: row.nome,
    unidade: row.unidade || null,
    categoria: row.area,
    area: row.area,
    estoque_atual: 0,
    estoque_minimo: 0,
    ativo: true,
    eh_consumivel: !!row.eh_consumivel,
  };
  let { data, error } = await db.from('inventory').upsert(payload, { onConflict: 'empresa_id,nome' }).select('id,nome').single();
  const dropAndRetry = async (colName) => {
    const { [colName]: _, ...rest } = payload;
    payload = rest;
    ({ data, error } = await db.from('inventory').upsert(payload, { onConflict: 'empresa_id,nome' }).select('id,nome').single());
  };
  if (error && /categoria/.test(errorText(error))) await dropAndRetry('categoria');
  if (error && /area/.test(errorText(error))) await dropAndRetry('area');
  if (error && /ativo/.test(errorText(error))) await dropAndRetry('ativo');
  if (error && /categoria/.test(errorText(error))) await dropAndRetry('categoria');
  if (error && /area/.test(errorText(error))) await dropAndRetry('area');
  if (error && /ativo/.test(errorText(error))) await dropAndRetry('ativo');
  if (error) throw error;
  if (!data || !data.id) {
    const sel = await db.from('inventory').select('id').eq('empresa_id', empresaId).eq('nome', row.nome).maybeSingle();
    if (sel.error) throw sel.error;
    if (!sel.data || !sel.data.id) throw new Error(`Falha ao localizar item após upsert: ${row.nome}`);
    data = { id: sel.data.id };
  }
  return String(data.id);
}

async function ensureModelItem(modelId, inventoryId, qtd) {
  const { data: existing, error: exErr } = await db.from('model_items')
    .select('id')
    .eq('model_id', modelId)
    .eq('inventory_id', inventoryId)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing && existing.id) {
    const { error } = await db.from('model_items').update({ quantidade_sugerida: qtd }).eq('id', existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from('model_items').insert({ model_id: modelId, inventory_id: inventoryId, quantidade_sugerida: qtd });
  if (error) throw error;
}

async function run() {
  const empresaId = await getEmpresaId();
  const perArea = Math.floor(TARGET_TOTAL / AREA_DEFS.length);
  const remainder = TARGET_TOTAL - (perArea * AREA_DEFS.length);
  const allSeedRows = [];
  const seqByBase = new Map();
  const nextSeqByBase = (base) => {
    const k = String(base || '');
    const next = Number(seqByBase.get(k) || 0) + 1;
    seqByBase.set(k, next);
    return next;
  };
  AREA_DEFS.forEach((def, i) => {
    const size = perArea + (i < remainder ? 1 : 0);
    const rows = buildAreaItems(def, size, nextSeqByBase);
    rows.forEach(r => allSeedRows.push({ area: def.area, model: def.model, ...r }));
  });

  const modelIdByName = new Map();
  for (const def of AREA_DEFS) {
    const modelId = await ensureModel(empresaId, def.model);
    modelIdByName.set(def.model, modelId);
  }

  let processed = 0;
  for (const item of allSeedRows) {
    const modelId = modelIdByName.get(item.model);
    if (!modelId) continue;
    try {
      const invId = await ensureInventory(empresaId, item);
      await ensureModelItem(modelId, invId, Number(item.qtd || 0));
      processed += 1;
    } catch (e) {
      process.stderr.write(`Falha item ${item.nome}: ${String(e && e.message ? e.message : e)}\n`);
    }
  }

  let currentTotal = await getInventoryCount(empresaId);
  if (currentTotal < TARGET_TOTAL) {
    let seq = 1;
    while (currentTotal < TARGET_TOTAL) {
      const payload = {
        empresa_id: empresaId,
        nome: `Item Complementar ${String(seq).padStart(4, '0')}`,
        unidade: 'un',
        categoria: AREA_DEFS[(seq - 1) % AREA_DEFS.length].area,
        area: AREA_DEFS[(seq - 1) % AREA_DEFS.length].area,
        estoque_atual: 0,
        estoque_minimo: 0,
        ativo: true,
        eh_consumivel: seq % 5 !== 0,
      };
      let p = { ...payload };
      let { error } = await db.from('inventory').upsert(p, { onConflict: 'empresa_id,nome' });
      const retryDrop = async (colName) => {
        const { [colName]: _, ...rest } = p;
        p = rest;
        ({ error } = await db.from('inventory').upsert(p, { onConflict: 'empresa_id,nome' }));
      };
      if (error && /categoria/.test(errorText(error))) await retryDrop('categoria');
      if (error && /area/.test(errorText(error))) await retryDrop('area');
      if (error && /ativo/.test(errorText(error))) await retryDrop('ativo');
      if (error) throw error;
      seq += 1;
      currentTotal = await getInventoryCount(empresaId);
    }
  }

  const finalCount = await getInventoryCount(empresaId);
  process.stdout.write(`Empresa usada: ${empresaId}\n`);
  process.stdout.write(`Itens processados no seed: ${processed}\n`);
  process.stdout.write(`inventory_total_count=${finalCount}\n`);
}

run().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});

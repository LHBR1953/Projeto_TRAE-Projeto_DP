const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const KIT_DEFS = [
  {
    key: 'cirurgia',
    modelNames: ['Kit_Cirurgia', 'Kit Cirurgia', 'KitCirurgia'],
    itemNeedles: ['lamina de bisturi', 'fio de sutura', 'gaze esteril', 'tubete de anestesico', 'sugador cirurgico', 'campo fenestrado'],
  },
  {
    key: 'dentistica',
    modelNames: ['Kit_Dentistica', 'Kit Dentistica', 'Kit Dentística', 'KitDentistica'],
    itemNeedles: ['resina composta', 'adesivo universal', 'acido fosforico', 'matriz de aco', 'cunhas de madeira', 'microbrush', 'tira de lixa'],
  },
  {
    key: 'endodontia',
    modelNames: ['Kit_Endodontia', 'Kit Endodontia', 'KitEndodontia'],
    itemNeedles: ['lima', 'cones de guta', 'hipoclorito de sodio', 'cimento endodontico', 'sugador endo'],
  },
  {
    key: 'harmonizacao',
    modelNames: ['Kit_Harmonização_Facial', 'Kit_Harmonizacao_Facial', 'Kit Harmonização Facial', 'Kit Harmonizacao Facial', 'KitHarmonizacaoFacial'],
    itemNeedles: ['toxina botulinica', 'acido hialuronico', 'canula', 'agulha 30g', 'gaze', 'clorexidina'],
  },
  {
    key: 'implantodontia',
    modelNames: ['Kit_Implantodontia', 'Kit Implantodontia', 'KitImplantodontia'],
    itemNeedles: ['implante dentario', 'cicatrizador', 'montador', 'soro fisiologico', 'broca de lanca', 'guia cirurgico'],
  },
  {
    key: 'ortodontia',
    modelNames: ['Kit_Ortodontia', 'Kit Ortodontia', 'KitOrtodontia'],
    itemNeedles: ['jogo de braquetes', 'arco ortodontico', 'elasticos', 'resina de ortodontia'],
  },
  {
    key: 'periodontia',
    modelNames: ['Kit_Periodontia', 'Kit Periodontia', 'KitPeriodontia'],
    itemNeedles: ['pasta profilatica', 'taca de borracha', 'escova de robinson', 'pastilha evidenciadora', 'fio dental'],
  },
];

const SERVICE_RULES = [
  { key: 'cirurgia', needles: ['extracao', 'exodontia', 'cirurgia'] },
  { key: 'dentistica', needles: ['restauracao', 'resina'] },
  { key: 'endodontia', needles: ['canal', 'endodont'] },
  { key: 'harmonizacao', needles: ['harmonizacao', 'botox', 'preenchimento'] },
  { key: 'implantodontia', needles: ['implante', 'implantodont'] },
  { key: 'ortodontia', needles: ['ortodont', 'aparelho'] },
  { key: 'periodontia', needles: ['periodont', 'profilaxia', 'raspagem', 'limpeza'] },
];

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function getEmpresaId() {
  const res = await db.from('empresas').select('id').limit(1);
  if (res.error) throw res.error;
  if (!res.data || !res.data.length) throw new Error('Nenhuma empresa encontrada.');
  return String(res.data[0].id);
}

function findModelIdByNames(models, names) {
  const wanted = names.map(norm);
  const exact = models.find(m => wanted.includes(norm(m && m.nome_modelo)));
  if (exact) return String(exact.id);
  const fuzzy = models.find(m => wanted.some(w => norm(m && m.nome_modelo).includes(w) || w.includes(norm(m && m.nome_modelo))));
  return fuzzy ? String(fuzzy.id) : '';
}

function findInventoryByNeedle(items, needle) {
  const options = Array.isArray(needle) ? needle : [needle];
  const stop = new Set(['de', 'do', 'da', 'das', 'dos', 'e', 'tipo', 'serie', 'especial', 'dose', 'seringa', 'rolo']);
  let best = null;
  let bestScore = 0;
  for (const item of items || []) {
    const name = norm(item && item.nome);
    if (!name) continue;
    for (const optRaw of options) {
      const opt = norm(optRaw).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!opt) continue;
      if (name.includes(opt)) return item;
      const tokens = opt.split(' ').map(t => t.trim()).filter(t => t && !stop.has(t));
      if (!tokens.length) continue;
      const matched = tokens.filter(t => name.includes(t)).length;
      const minNeeded = Math.max(1, Math.ceil(tokens.length * 0.5));
      if (matched >= minNeeded && matched > bestScore) {
        best = item;
        bestScore = matched;
      }
    }
  }
  return best;
}

async function upsertModelItem(modelId, inventoryId) {
  const ex = await db.from('model_items').select('id').eq('model_id', modelId).eq('inventory_id', inventoryId).maybeSingle();
  if (ex.error) throw ex.error;
  if (ex.data && ex.data.id) {
    const up = await db.from('model_items').update({ quantidade_sugerida: 1 }).eq('id', ex.data.id);
    if (up.error) throw up.error;
    return;
  }
  const ins = await db.from('model_items').insert({ model_id: modelId, inventory_id: inventoryId, quantidade_sugerida: 1 });
  if (ins.error) throw ins.error;
}

async function fetchServices(empresaId) {
  const first = await db.from('services').select('id,descricao').eq('empresa_id', empresaId);
  if (!first.error) return first.data || [];
  const second = await db.from('servicos').select('id,descricao').eq('empresa_id', empresaId);
  if (!second.error) return second.data || [];
  const third = await db.from('servicos').select('id,descricao');
  if (third.error) throw third.error;
  return third.data || [];
}

async function upsertServiceMapping(serviceId, modelId) {
  const del = await db.from('service_mapping').delete().eq('service_id', serviceId);
  if (del.error) throw del.error;
  const ins = await db.from('service_mapping').insert({ service_id: serviceId, model_id: modelId });
  if (ins.error) throw ins.error;
}

async function run() {
  const empresaId = await getEmpresaId();
  const modelsRes = await db.from('usage_models').select('id,nome_modelo').eq('empresa_id', empresaId);
  if (modelsRes.error) throw modelsRes.error;
  const inventoryRes = await db.from('inventory').select('id,nome').eq('empresa_id', empresaId).order('nome');
  if (inventoryRes.error) throw inventoryRes.error;

  const models = modelsRes.data || [];
  const inventory = inventoryRes.data || [];
  const modelByKey = new Map();
  let kitLinks = 0;
  let missingItems = 0;
  const missingLogs = [];

  for (const def of KIT_DEFS) {
    const modelId = findModelIdByNames(models, def.modelNames);
    if (!modelId) {
      missingLogs.push(`Kit não encontrado: ${def.modelNames.join(' / ')}`);
      continue;
    }
    modelByKey.set(def.key, modelId);
    for (const needle of def.itemNeedles) {
      const inv = findInventoryByNeedle(inventory, needle);
      if (!inv) {
        missingItems += 1;
        missingLogs.push(`Item não encontrado para ${def.modelNames[0]}: ${needle}`);
        continue;
      }
      await upsertModelItem(modelId, String(inv.id));
      kitLinks += 1;
    }
  }

  const services = await fetchServices(empresaId);
  let serviceLinks = 0;
  for (const srv of services) {
    const desc = norm(srv && srv.descricao);
    const rule = SERVICE_RULES.find(r => r.needles.some(n => desc.includes(norm(n))));
    if (!rule) continue;
    const modelId = modelByKey.get(rule.key);
    if (!modelId) continue;
    await upsertServiceMapping(String(srv.id), modelId);
    serviceLinks += 1;
  }

  process.stdout.write(`empresa_id=${empresaId}\n`);
  process.stdout.write(`kit_item_links=${kitLinks}\n`);
  process.stdout.write(`missing_items=${missingItems}\n`);
  process.stdout.write(`service_links=${serviceLinks}\n`);
  if (missingLogs.length) {
    process.stdout.write(`missing_details=${missingLogs.slice(0, 30).join(' | ')}\n`);
  }
}

run().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : JSON.stringify(e)) + '\n');
  process.exit(1);
});

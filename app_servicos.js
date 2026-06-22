
let services = [];
let serviceModelMappings = [];
let serviceMappingSearchTerm = '';
let serviceMappingStatusFilter = 'com_modelo';
let serviceMappingCurrentRows = [];

function openServiceImportModal() {
    if (!isSuperAdmin || !serviceImportModal) {
        showToast('Apenas SuperAdmin pode importar serviços.', true);
        return;
    }
    if (!serviceImportModal.dataset.bound) {
        if (btnCloseServiceImportModal) btnCloseServiceImportModal.addEventListener('click', () => serviceImportModal.classList.add('hidden'));
        if (btnCancelServiceImport) btnCancelServiceImport.addEventListener('click', () => serviceImportModal.classList.add('hidden'));
        if (btnServiceImportParse) btnServiceImportParse.addEventListener('click', () => parseServiceImportFile());
        if (btnConfirmServiceImport) btnConfirmServiceImport.addEventListener('click', () => confirmServiceImport());
        if (btnExportServiceXlsx) btnExportServiceXlsx.addEventListener('click', () => exportServicesXlsx());
        serviceImportModal.addEventListener('click', (e) => { if (e.target === serviceImportModal) serviceImportModal.classList.add('hidden'); });
        serviceImportModal.dataset.bound = '1';
    }
    if (serviceImportStatus) serviceImportStatus.textContent = '';
    if (serviceImportPreviewWrap) serviceImportPreviewWrap.classList.add('hidden');
    if (serviceImportPreviewBody) serviceImportPreviewBody.innerHTML = '';
    if (btnConfirmServiceImport) btnConfirmServiceImport.disabled = true;
    window.__serviceImportRows = [];
    serviceImportModal.classList.remove('hidden');
}

async function parseServiceImportFile() {
    try {
        if (!serviceImportFile || !serviceImportFile.files || !serviceImportFile.files[0]) {
            showToast('Selecione um arquivo XLSX.', true);
            return;
        }
        const file = serviceImportFile.files[0];
        if (serviceImportStatus) serviceImportStatus.textContent = 'Lendo arquivo...';
        const rows = await readXlsxToRowArrays(file);
        const skipHeader = serviceImportSkipHeader ? Boolean(serviceImportSkipHeader.checked) : true;
        const headers = skipHeader ? (Array.isArray(rows[0]) ? rows[0] : []) : [];
        const norm = (v) => String(v || '').trim().toLowerCase();
        const h = headers.map(norm);
        const idx = (names, fallback) => {
            const found = (names || []).map(n => h.indexOf(norm(n))).find(i => i >= 0);
            return Number.isInteger(found) && found >= 0 ? found : fallback;
        };
        const colDescricao = idx(['descricao', 'descrição'], 1);
        const colValor = idx(['valor'], 2);
        const colIe = idx(['ie', 'tipo', 'tipo_ie'], 3);
        const colTipoCalc = idx(['tipo_calculo', 'tipo cálculo', 'tipo_calc'], 5);
        const colExigeEl = idx(['exige_elemento', 'exige elemento'], 6);
        const colSubdiv = idx(['subdivisao', 'subdivisão', 'subdivisao_nome'], 4);
        const dataRows = skipHeader ? rows.slice(1) : rows.slice();

        const parseBool = (v) => {
            const t = String(v || '').trim().toUpperCase();
            return t === '1' || t === 'TRUE' || t === 'SIM' || t === 'S' || t === 'X';
        };
        const parsed = [];
        dataRows.forEach(r => {
            const arr = Array.isArray(r) ? r : [];
            const descricao = String(arr[colDescricao] ?? '').trim().toUpperCase();
            const valorRaw = String(arr[colValor] ?? '').replace(',', '.').trim();
            const valor = parseFloat(valorRaw) || 0;
            const ie = String(arr[colIe] ?? '').trim().toUpperCase();
            const tipoCalculoRaw = String(arr[colTipoCalc] ?? '').trim();
            const tipoCalculo = tipoCalculoRaw ? tipoCalculoRaw : 'Fixo';
            const exigeElemento = parseBool(arr[colExigeEl]);
            const subdivisao = String(arr[colSubdiv] ?? '').trim().toUpperCase();
            if (!descricao) return;
            const ieVal = (ie === 'S' || ie === 'E') ? ie : 'S';
            parsed.push({ descricao, valor, ie: ieVal, tipo_calculo: tipoCalculo, exige_elemento: exigeElemento, subdivisao });
        });

        const uniqKeys = new Set(parsed.map(x => `${x.descricao}::${x.subdivisao}::${x.ie}`));
        window.__serviceImportRows = parsed;

        if (serviceImportPreviewBody) {
            const preview = parsed.slice(0, 200).map(x => `
                <tr>
                    <td>${escapeHtml(x.descricao)}</td>
                    <td style="text-align:right;">${escapeHtml(Number(x.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</td>
                    <td>${escapeHtml(x.ie)}</td>
                    <td>${escapeHtml(x.subdivisao || '')}</td>
                </tr>
            `).join('');
            serviceImportPreviewBody.innerHTML = preview || '<tr><td colspan="4" style="text-align:center; padding: 14px; color:#6b7280;">Nenhuma linha válida.</td></tr>';
        }
        if (serviceImportPreviewWrap) serviceImportPreviewWrap.classList.remove('hidden');
        if (btnConfirmServiceImport) btnConfirmServiceImport.disabled = parsed.length === 0;
        if (serviceImportStatus) {
            serviceImportStatus.textContent = [
                `Linhas válidas: ${parsed.length}`,
                `Chaves (Desc/Subdiv/IE) únicas: ${uniqKeys.size}`,
                'Colunas usadas: descricao, valor, ie, tipo_calculo, exige_elemento, subdivisao'
            ].join('\n');
        }
    } catch (e) {
        const msg = e && e.message ? String(e.message) : 'Erro ao ler XLSX.';
        if (serviceImportStatus) serviceImportStatus.textContent = msg;
        showToast(msg, true);
    }
}

async function confirmServiceImport() {
    if (!isSuperAdmin) { showToast('Apenas SuperAdmin.', true); return; }
    const parsed = Array.isArray(window.__serviceImportRows) ? window.__serviceImportRows : [];
    if (!parsed.length) { showToast('Nenhuma linha para importar.', true); return; }
    const mode = serviceImportMode ? String(serviceImportMode.value || 'skip_dupes') : 'skip_dupes';
    const empresaId = String(currentEmpresaId || '');
    if (!empresaId) { showToast('Empresa inválida.', true); return; }

    if (serviceImportStatus) serviceImportStatus.textContent = 'Carregando itens atuais...';
    const { data: existing, error } = await withTimeout(
        db.from(getDbTable('servicos')).select('id,descricao,subdivisao,subdivisao_id,ie,tipo_calculo,exige_elemento,seqid,codigo_servico,valor').eq('empresa_id', empresaId),
        20000,
        'srvImport:servicos'
    );
    if (error) { showToast('Falha ao carregar serviços.', true); return; }
    const { data: allSubs, error: subErr } = await withTimeout(
        db.from(getDbTable('especialidade_subdivisoes')).select('id,nome').eq('empresa_id', empresaId),
        20000,
        'srvImport:subdivisoes'
    );
    if (subErr) { showToast('Falha ao carregar subdivisões.', true); return; }

    const bySubName = new Map();
    const bySubCode = new Map();
    const extractSubCode = (text) => {
        const s = String(text || '').trim();
        const m = s.match(/^[^\d]*(\d+\.\d+)\s*[-.)]?\s*/);
        return m ? String(m[1]) : '';
    };
    (allSubs || []).forEach(s => {
        const nome = String(s && s.nome || '').trim().toUpperCase();
        const id = String(s && s.id || '');
        if (!nome || !id) return;
        if (!bySubName.has(nome)) bySubName.set(nome, { id, nome });
        const code = extractSubCode(nome);
        if (code && !bySubCode.has(code)) bySubCode.set(code, { id, nome });
    });
    const resolveSubdivision = (raw) => {
        const token = String(raw || '').trim().toUpperCase();
        if (!token) return { nome: '', id: null };
        if (bySubName.has(token)) return bySubName.get(token);
        const code = extractSubCode(token);
        if (code && bySubCode.has(code)) return bySubCode.get(code);
        return { nome: token, id: null };
    };

    const byKey = new Map();
    let maxSeq = 0;
    (existing || []).forEach(s => {
        const key = `${String(s.descricao || '').trim().toUpperCase()}::${String(s.subdivisao || '').trim().toUpperCase()}::${String(s.ie || '').trim().toUpperCase()}`;
        byKey.set(key, s);
        if (Number(s.seqid || 0) > maxSeq) maxSeq = Number(s.seqid || 0);
    });

    let created = 0, updated = 0, skipped = 0;
    for (const row of parsed) {
        const resolvedSub = resolveSubdivision(row.subdivisao);
        const key = `${row.descricao}::${String(resolvedSub.nome || '').trim().toUpperCase()}::${row.ie}`;
        const found = byKey.get(key);
        if (found) {
            if (mode === 'update_dupes') {
                const upd = {
                    valor: Number(row.valor || 0),
                    ie: row.ie,
                    tipo_calculo: String(row.tipo_calculo || 'Fixo'),
                    exige_elemento: !!row.exige_elemento,
                    subdivisao: String(resolvedSub.nome || ''),
                    subdivisao_id: resolvedSub.id || null
                };
                const { error: uErr } = await withTimeout(
                    db.from(getDbTable('servicos')).update(upd).eq('id', found.id),
                    20000,
                    'srvImport:update'
                );
                if (uErr) { showToast('Falha ao atualizar alguns itens.', true); continue; }
                found.valor = upd.valor;
                found.ie = upd.ie;
                found.tipo_calculo = upd.tipo_calculo;
                found.exige_elemento = upd.exige_elemento;
                found.subdivisao = upd.subdivisao;
                found.subdivisao_id = upd.subdivisao_id;
                updated += 1;
            } else {
                skipped += 1;
            }
            continue;
        }
        maxSeq += 1;
        const ins = {
            id: generateId(),
            seqid: maxSeq,
            descricao: row.descricao,
            valor: Number(row.valor || 0),
            ie: row.ie,
            tipo_calculo: String(row.tipo_calculo || 'Fixo'),
            exige_elemento: !!row.exige_elemento,
            subdivisao: String(resolvedSub.nome || ''),
            subdivisao_id: resolvedSub.id || null,
            empresa_id: empresaId
        };
        const { error: iErr } = await withTimeout(
            db.from(getDbTable('servicos')).insert(ins),
            20000,
            'srvImport:insert'
        );
        if (iErr) { showToast('Falha ao inserir alguns itens.', true); continue; }
        created += 1;
    }

    if (serviceImportStatus) {
        serviceImportStatus.textContent = [
            `Criados: ${created}`,
            `Atualizados: ${updated}`,
            `Ignorados: ${skipped}`
        ].join('\n');
    }
    try { await initializeApp(true); } catch { }
    showList('services');
    showToast('Importação de serviços concluída.');
}

async function exportServicesXlsx() {
    if (!isSuperAdmin) { showToast('Apenas SuperAdmin.', true); return; }
    const empresaId = getEffectiveImportEmpresaId();
    if (!empresaId) { showToast('Empresa inválida.', true); return; }
    const { data, error } = await withTimeout(
        db.from(getDbTable('servicos'))
            .select('seqid,descricao,valor,ie,tipo_calculo,exige_elemento,subdivisao')
            .eq('empresa_id', empresaId)
            .order('seqid', { ascending: true }),
        20000,
        'export:servicos'
    );
    if (error) { showToast('Falha ao exportar serviços.', true); return; }
    const rows = (data || []).map(s => ({
        seqid: Number(s && s.seqid || 0),
        descricao: String(s && s.descricao || ''),
        valor: Number(s && s.valor || 0),
        ie: String(s && s.ie || ''),
        tipo_calculo: String(s && s.tipo_calculo || 'Fixo'),
        exige_elemento: !!(s && s.exige_elemento),
        subdivisao: String(s && s.subdivisao || '')
    }));
    exportRowsToXlsx(rows, 'Servicos', `servicos_${empresaId}.xlsx`);
    showToast('Exportação de serviços concluída.');
}
const navServices = document.getElementById('navServices');
const navServiceMapping = document.getElementById('navServiceMapping');
const servicesListView = document.getElementById('servicesListView');
const serviceFormView = document.getElementById('serviceFormView');
const serviceMappingView = document.getElementById('serviceMappingView');

// Services DOM Elements
const btnNewService = document.getElementById('btnNewService');
const btnBackService = document.getElementById('btnBackService');
const btnCancelService = document.getElementById('btnCancelService');
const serviceForm = document.getElementById('serviceForm');
const servicesTableBody = document.getElementById('servicesTableBody');
const searchServiceInput = document.getElementById('searchServiceInput');

const serviceImportModal = document.getElementById('serviceImportModal');
const btnCloseServiceImportModal = document.getElementById('btnCloseServiceImportModal');
const btnCancelServiceImport = document.getElementById('btnCancelServiceImport');
const serviceImportFile = document.getElementById('serviceImportFile');
const serviceImportMode = document.getElementById('serviceImportMode');
const serviceImportSkipHeader = document.getElementById('serviceImportSkipHeader');
const btnServiceImportParse = document.getElementById('btnServiceImportParse');
const serviceImportStatus = document.getElementById('serviceImportStatus');
const serviceImportPreviewWrap = document.getElementById('serviceImportPreviewWrap');
const serviceImportPreviewBody = document.getElementById('serviceImportPreviewBody');
const btnConfirmServiceImport = document.getElementById('btnConfirmServiceImport');
const btnExportServiceXlsx = document.getElementById('btnExportServiceXlsx');

async function fetchServiceModelIdFromDb(serviceId) {
    let sid = String(serviceId || '').trim();
    if (!sid) return '';
    if (!isUuidLike(sid)) {
        const local = (services || []).find(s => String(s && s.seqid || '') === sid || String(s && s.id || '') === sid);
        if (local && local.id) sid = String(local.id).trim();
    }
    if (!isUuidLike(sid)) {
        const seq = Number(sid);
        if (Number.isFinite(seq)) {
            let sq = db.from(getDbTable('servicos'))
                .select('id')
                .eq('seqid', seq)
                .maybeSingle();
            let rs = await withTimeout(sq, 15000, 'servicos:resolve_id_by_seqid');
            if (rs && !rs.error && rs.data && rs.data.id) sid = String(rs.data.id).trim();
        }
    }
    if (!isUuidLike(sid)) return '';
    let q = db.from(getDbTable('service_mapping'))
        .select('model_id')
        .eq('service_id', sid)
        .maybeSingle();
    let { data, error } = await withTimeout(q, 15000, 'service_mapping:model_id');
    if (error && isInvalidUuidError(error)) return '';
    if (error) throw error;
    return String(data && data.model_id || '').trim();
}

async function fetchServicoFromDb(serviceId) {
    const sid = String(serviceId || '').trim();
    if (!sid) return null;
    const empId = String(currentEmpresaId || '').trim();
    let q = db.from(getDbTable('servicos'))
        .select('id,descricao,subdivisao,empresa_id')
        .eq('empresa_id', empId)
        .eq('id', sid)
        .maybeSingle();
    let { data, error } = await withTimeout(q, 15000, 'servicos:one');
    if (error && isDbMissingColumnError(error, 'empresa_id')) {
        q = db.from(getDbTable('servicos'))
            .select('id,descricao,subdivisao')
            .eq('id', sid)
            .maybeSingle();
        ({ data, error } = await withTimeout(q, 15000, 'servicos:one:no_emp'));
    }
    if (error) throw error;
    return data || null;
}

function resolveStockMasterKeyFromService(serv, specialtyById) {
    const desc = normalizeKey(String(serv && serv.descricao || ''));
    const subdiv = normalizeKey(String(serv && serv.subdivisao || ''));
    const specId = String(serv && serv.especialidadeid || '');
    const specName = normalizeKey(String(specialtyById.get(specId) || ''));
    const txt = `${desc} ${subdiv} ${specName}`;
    if (txt.includes('orto')) return 'ortodontia';
    if (txt.includes('implan')) return 'implantodontia';
    if (txt.includes('endo') || txt.includes('canal')) return 'endodontia';
    if (txt.includes('periodon') || txt.includes('gengiv')) return 'periodontia';
    if (txt.includes('odontopedi') || txt.includes('infantil') || txt.includes('pediatr')) return 'odontopediatria';
    if (txt.includes('cirurg') || txt.includes('siso') || txt.includes('bucomaxilo') || txt.includes('biopsia') || txt.includes('frenectom')) return 'cirurgia';
    if (txt.includes('dentist') || txt.includes('restaur') || txt.includes('resina') || txt.includes('adesivo') || txt.includes('acido') || txt.includes('ácido')) return 'dentistica';
    if (txt.includes('harmon') || txt.includes('botox') || txt.includes('toxina') || txt.includes('preench')) return 'harmonizacao';
    if (txt.includes('protese') || txt.includes('coroa') || txt.includes('ponte') || txt.includes('dentadura')) return 'protese';
    return 'clinico';
}

async function saveServiceModelMapping(serviceId, modelId) {
    const sid = String(serviceId || '').trim();
    if (!sid) return;
    const empId = String(currentEmpresaId || '').trim();
    let delRes = await db.from(getDbTable('service_mapping')).delete().eq('service_id', sid).eq('empresa_id', empId);
    if (delRes && delRes.error && isDbMissingColumnError(delRes.error, 'empresa_id')) {
        delRes = await db.from(getDbTable('service_mapping')).delete().eq('service_id', sid);
    }
    if (delRes && delRes.error) throw delRes.error;
    const mid = String(modelId || '').trim();
    if (!mid) return;
    let insRes = await db.from(getDbTable('service_mapping')).insert({ service_id: sid, model_id: mid, empresa_id: empId });
    if (insRes && insRes.error && isDbMissingColumnError(insRes.error, 'empresa_id')) {
        insRes = await db.from(getDbTable('service_mapping')).insert({ service_id: sid, model_id: mid });
    }
    if (insRes && insRes.error) throw insRes.error;
}

function renderServiceMappingTable() {
    const body = document.getElementById('serviceMappingTableBody');
    const empty = document.getElementById('serviceMappingEmptyState');
    if (!body) return;
    body.innerHTML = '';
    const q = normalizeKey(String(serviceMappingSearchTerm || '').trim());
    const mapByService = new Map();
    const modelById = new Map((usageModels || []).map(m => [String(m && m.id || ''), m]));
    const serviceIdsInScope = new Set((services || []).map(s => String(s && s.id || '').trim()).filter(Boolean));
    const mappingsInScope = (serviceModelMappings || []).filter(m => serviceIdsInScope.has(String(m && m.service_id || '').trim()));
    mappingsInScope.forEach(m => {
        const sid = String(m && m.service_id || '');
        if (!sid) return;
        mapByService.set(sid, String(m && m.model_id || ''));
    });
    const rows = (Array.isArray(services) ? services : []).filter(srv => {
        const sid = String(srv && srv.id || '');
        const modelId = String(mapByService.get(sid) || '').trim();
        const hasModel = !!modelId && modelById.has(modelId);
        if (serviceMappingStatusFilter === 'com_modelo' && !hasModel) return false;
        if (serviceMappingStatusFilter === 'sem_modelo' && hasModel) return false;
        if (!q) return true;
        const modelName = modelId && modelById.get(modelId) ? String(modelById.get(modelId).nome_modelo || '') : '';
        const text = `${String(srv && srv.descricao || '')} ${modelName}`;
        return normalizeKey(text).includes(q);
    }).sort((a, b) => String(a && a.descricao || '').localeCompare(String(b && b.descricao || ''), 'pt-BR'));
    serviceMappingCurrentRows = rows.slice();
    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');
    const countByModel = new Map();
    (usageModelItems || []).forEach(mi => {
        const mid = String(mi && mi.model_id || '');
        if (!mid) return;
        countByModel.set(mid, (countByModel.get(mid) || 0) + 1);
    });
    const canMapUpdate = canStockAction('mapping', 'update');
    const mappedModelIds = new Set(mappingsInScope.map(m => String(m && m.model_id || '').trim().toLowerCase()).filter(Boolean));
    const modelsSorted = (usageModels || [])
        .filter(m => isFamilyKitModelName(m && m.nome_modelo) || mappedModelIds.has(String(m && m.id || '').trim().toLowerCase()))
        .slice()
        .sort((a, b) => String(a && a.nome_modelo || '').localeCompare(String(b && b.nome_modelo || ''), 'pt-BR'));
    rows.forEach(srv => {
        const sid = String(srv && srv.id || '');
        const selectedRaw = String(mapByService.get(sid) || '').trim();
        const selected = modelById.has(selectedRaw) ? selectedRaw : '';
        const tr = document.createElement('tr');
        const modelCount = selected ? Number(countByModel.get(selected) || 0) : 0;
        const selectedModel = selected ? modelById.get(selected) : null;
        const modelName = selectedModel ? String(selectedModel.nome_modelo || 'Modelo') : 'Sem modelo';
        const modelSummary = selected
            ? (modelCount > 0
                ? `${modelName} - ${modelCount} ${modelCount === 1 ? 'item' : 'itens'}`
                : `<span class="inventory-alert"><i class="ri-alarm-warning-line"></i> ${modelName} - 0 itens</span>`)
            : 'Sem modelo';
        tr.innerHTML = `
            <td><strong>${String(srv && srv.descricao || '—')}</strong></td>
            <td>
                <select class="form-control js-service-model-select" data-service-id="${sid}" ${canMapUpdate ? '' : 'disabled'}>
                    <option value="">Sem modelo</option>
                    ${modelsSorted.map(m => {
                        const mid = String(m.id || '');
                        const c = Number(countByModel.get(mid) || 0);
                        return `<option value="${mid}" ${mid === selected ? 'selected' : ''}>${String(m.nome_modelo || '')} (${c})</option>`;
                    }).join('')}
                </select>
            </td>
            <td>${modelSummary}</td>
        `;
        body.appendChild(tr);
    });
    body.querySelectorAll('.js-service-model-select').forEach(sel => {
        sel.addEventListener('change', async () => {
            const sid = String(sel.getAttribute('data-service-id') || '');
            const mid = String(sel.value || '');
            if (mid && !isFamilyKitModelId(mid)) {
                showToast('Só é permitido vincular serviços a Famílias de Kits (ex: Kit Radiologia, Kit Dentística).', true);
                sel.value = '';
                return;
            }
            try {
                await saveServiceModelMapping(sid, mid);
                await loadEstoqueData(true);
                renderServiceMappingTable();
                showToast('Vínculo atualizado.');
            } catch (err) {
                showToast(err && err.message ? String(err.message) : 'Falha ao salvar vínculo.', true);
            }
        });
    });
}

function printServiceMappingFilteredReport() {
    const rows = (serviceMappingCurrentRows || [])
        .slice()
        .sort((a, b) => String(a && a.descricao || '').localeCompare(String(b && b.descricao || ''), 'pt-BR'));
    if (!rows.length) {
        showToast('Não há itens no filtro atual para impressão.', true);
        return;
    }
    const mapByService = new Map();
    const modelById = new Map((usageModels || []).map(m => [String(m && m.id || ''), m]));
    (serviceModelMappings || []).forEach(m => {
        const sid = String(m && m.service_id || '');
        if (!sid) return;
        mapByService.set(sid, String(m && m.model_id || ''));
    });
    const countByModel = new Map();
    (usageModelItems || []).forEach(mi => {
        const mid = String(mi && mi.model_id || '');
        if (!mid) return;
        countByModel.set(mid, (countByModel.get(mid) || 0) + 1);
    });
    const body = rows.map((srv) => {
        const sid = String(srv && srv.id || '');
        const selectedRaw = String(mapByService.get(sid) || '').trim();
        const selected = modelById.has(selectedRaw) ? selectedRaw : '';
        const modelCount = selected ? Number(countByModel.get(selected) || 0) : 0;
        const selectedModel = selected ? modelById.get(selected) : null;
        const modelName = selectedModel ? String(selectedModel.nome_modelo || 'Modelo') : 'Sem modelo';
        return `<tr>
            <td>${String(srv && srv.descricao || '—')}</td>
            <td>${modelName}</td>
            <td>${selected ? modelCount : '—'}</td>
        </tr>`;
    }).join('');
    const filtroNome = serviceMappingStatusFilter === 'sem_modelo' ? 'Itens Sem Modelo' : 'Itens com Modelo';
    const html = `
        <div class="meta">Filtro: ${filtroNome}${serviceMappingSearchTerm ? ` | Busca: ${String(serviceMappingSearchTerm)}` : ''}</div>
        <table>
            <thead><tr><th>Serviço</th><th>Modelo de Uso</th><th>Itens no Modelo</th></tr></thead>
            <tbody>${body}</tbody>
        </table>
    `;
    openStockReportPrintWindow(`Vínculo de Serviços - ${filtroNome}`, html);
}

function resolveServicoSubdivision(servico) {
    if (!servico) return '';
    return String(servico.subdivisao || '').trim();
}

async function refreshServSubdivisaoLookupForEmpresa(empresaId) {
    const emp = String(empresaId || '').trim();
    if (!emp) {
        __subdivLookupEmpresaId = '';
        __subdivLookupMap = new Map();
        __subdivLookupList = [];
        __subdivLookupById = new Map();
        return;
    }
    if (__subdivLookupEmpresaId === emp && __subdivLookupMap && __subdivLookupMap.size > 0) return;
    const subsRes = await db.from(getDbTable('especialidade_subdivisoes')).select('id,nome,especialidade_id').eq('empresa_id', emp).order('nome', { ascending: true });
    if (subsRes.error) throw subsRes.error;
    const specsRes = await db.from(getDbTable('especialidades')).select('id,nome,seqid').eq('empresa_id', emp);
    if (specsRes.error) throw specsRes.error;
    const specById = new Map((specsRes.data || []).map(s => [String(s.id), s]));
    const map = new Map();
    const byId = new Map();
    const list = [];

    (subsRes.data || []).forEach(sub => {
        const sid = String(sub && sub.id || '').trim();
        if (!sid) return;
        let label = String(sub && sub.nome || '').trim();
        if (!label) return;
        label = label.replace(/^\d+\.\d+\s*-\s*/, '').trim();
        const search = normalizeKey(label);
        map.set(label, sid);
        byId.set(sid, label);
        list.push({ label, id: sid, search });
    });

    list.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    __subdivLookupEmpresaId = emp;
    __subdivLookupMap = map;
    __subdivLookupById = byId;
    __subdivLookupList = list;
}

function updateServicesCursorInfo() {
    const el = document.getElementById('servicesCursorInfo');
    if (!el) return;
    if (!servicesListView || servicesListView.classList.contains('hidden')) { el.textContent = ''; return; }
    if (!servicesTableBody || !servicesTableBody.children) { el.textContent = ''; return; }
    const total = servicesTableBody.children.length;
    if (!total) { el.textContent = ''; return; }
    const idx = Number.isFinite(window.__servicesCursorIndex) && window.__servicesCursorIndex >= 0 ? window.__servicesCursorIndex : 0;
    el.textContent = `Registro ${Math.min(total, idx + 1)} de ${total}`;
}

function captureServicesListPositionForReturn(serviceId) {
    try {
        const sc = servicesTableBody ? servicesTableBody.closest('.table-container') : null;
        window.__servicesReturnScrollTop = sc ? Number(sc.scrollTop || 0) : null;
    } catch {
        window.__servicesReturnScrollTop = null;
    }
    try {
        window.__servicesReturnWindowScrollY = Number(window.scrollY || window.pageYOffset || 0);
    } catch {
        window.__servicesReturnWindowScrollY = null;
    }
    window.__servicesReturnCursorId = String(serviceId || '').trim();
}

function restoreServicesListPositionAfterReturn() {
    if (window.__servicesReturnWindowScrollY != null) {
        try { window.scrollTo(0, Math.max(0, Number(window.__servicesReturnWindowScrollY || 0))); } catch { }
    }
    const sc = servicesTableBody ? servicesTableBody.closest('.table-container') : null;
    if (sc && window.__servicesReturnScrollTop != null) {
        try { sc.scrollTop = Math.max(0, Number(window.__servicesReturnScrollTop || 0)); } catch { }
    }
    const tid = String(window.__servicesReturnCursorId || window.__servicesCursorId || '').trim();
    if (tid && servicesTableBody) {
        const rows = Array.from(servicesTableBody.children || []);
        const row = rows.find(el => el && el.dataset && String(el.dataset.id || '').trim() === tid);
        if (row) {
            const i = Number(row.dataset.index || '0');
            setServicesCursorByIndex(Number.isFinite(i) ? i : 0, false);
        }
    }
    window.__servicesReturnCursorId = '';
    window.__servicesReturnScrollTop = null;
    window.__servicesReturnWindowScrollY = null;
}

function restoreServicesCursorBySeqId() {
    if (!servicesTableBody) return;
    const seq = normalizeSeqId(window.__servicesReturnSeqId);
    if (!Number.isFinite(seq) || seq <= 0) return;
    const rows = Array.from(servicesTableBody.children || []);
    if (!rows.length) return;
    const row = rows.find(el => normalizeSeqId(el && el.dataset ? el.dataset.seqid : null) === seq);
    if (!row) return;
    const i = Number(row.dataset.index || '0');
    setServicesCursorByIndex(Number.isFinite(i) ? i : 0, true);
    window.__servicesReturnSeqId = null;
}

function restoreServicesCursorByPendingTarget() {
    const tid = String(window.__servicesPendingRestoreId || '').trim();
    const tseq = normalizeSeqId(window.__servicesPendingRestoreSeqId);
    if (!servicesTableBody) return false;
    const rows = Array.from(servicesTableBody.children || []);
    if (!rows.length) return false;
    let row = null;
    if (tid) {
        row = rows.find(el => el && el.dataset && String(el.dataset.id || '').trim() === tid) || null;
    }
    if (!row && Number.isFinite(tseq) && tseq > 0) {
        row = rows.find(el => normalizeSeqId(el && el.dataset ? el.dataset.seqid : null) === tseq) || null;
    }
    if (!row) return false;
    const i = Number(row.dataset.index || '0');
    setServicesCursorByIndex(Number.isFinite(i) ? i : 0, true);
    window.__servicesPendingRestoreId = '';
    window.__servicesPendingRestoreSeqId = null;
    return true;
}

function scheduleServicesPendingRestore() {
    let tries = 0;
    const run = () => {
        tries += 1;
        if (restoreServicesCursorByPendingTarget()) return;
        if (tries < 12) setTimeout(run, 80);
    };
    setTimeout(run, 0);
}

function restoreServicesCursorById() {
    if (!servicesTableBody) return;
    const tid = String(window.__servicesCursorId || window.__afterListScrollToServiceId || '').trim();
    if (!tid) return;
    const rows = Array.from(servicesTableBody.children || []);
    if (!rows.length) return;
    const row = rows.find(el => el && el.dataset && String(el.dataset.id || '') === tid);
    if (!row) return;
    const i = Number(row.dataset.index || '0');
    setServicesCursorByIndex(Number.isFinite(i) ? i : 0, true);
    window.__afterListScrollToServiceId = '';
}

function serviceRequiresOdonto(svc) {
    if (!svc) return false;
    if (isTruthy(svc.exige_elemento)) return true;
    const tipoCalc = String(svc.tipo_calculo || '').trim().toLowerCase();
    return tipoCalc === 'por elemento' || tipoCalc === 'por_elemento' || tipoCalc === 'elemento';
}

function syncOdontoButtonForServiceId(serviceId) {
    if (!btnOpenOdontograma) return;
    const svc = (services || []).find(s => String(s && s.id || '') === String(serviceId || '')) || null;
    const canSelect = serviceRequiresOdonto(svc);
    btnOpenOdontograma.disabled = !canSelect;
    btnOpenOdontograma.title = canSelect ? 'Selecionar dentes' : 'Este serviço não exige seleção por elemento';
    if (!canSelect) {
        if (budItemOdontoTeeth) budItemOdontoTeeth.value = '';
        if (budItemOdontoDisplay) budItemOdontoDisplay.value = 'Nenhum dente selecionado';
    }
}

const budItemSubdivisao = document.getElementById('budItemSubdivisao');
const btnPrintServiceList = document.getElementById('btnPrintServiceList');
const servicePrintFilterModal = document.getElementById('servicePrintFilterModal');
const btnCloseServicePrintModal = document.getElementById('btnCloseServicePrintModal');
const btnCancelServicePrint = document.getElementById('btnCancelServicePrint');
const btnConfirmServicePrint = document.getElementById('btnConfirmServicePrint');
const printFilterSubdivisao = document.getElementById('printFilterSubdivisao');

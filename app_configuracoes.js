
let activeEmpresasList = [];

async function checkEmpresaHasNfseModule() {
    try {
        const { data: empData, error: empErr } = await db.from('empresas').select('plano_tipo, modulos_contratados').eq('id', currentEmpresaId).maybeSingle();
        if (empErr) throw empErr;
        if (!empData) return false;

        let modulosStr = empData.modulos_contratados;

        // Fallback: se a empresa não tiver o snapshot gravado (ex: não rodou o backfill), busca do plano
        if (!modulosStr && empData.plano_tipo) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empData.plano_tipo);
            let planData = null;
            if (isUuid) {
                const { data } = await db.from('config_planos').select('modulos_texto').eq('id', empData.plano_tipo).maybeSingle();
                planData = data;
            } else {
                const { data } = await db.from('config_planos').select('modulos_texto').ilike('tipo_assinatura', empData.plano_tipo).maybeSingle();
                planData = data;
            }
            if (planData) modulosStr = planData.modulos_texto;
        }

        if (modulosStr) {
            const mods = modulosStr.toLowerCase();
            return mods.includes('nfse') || mods.includes('emitir nfs-e') || mods.includes('emitir nfs');
        }
    } catch (e) {
        console.error("Erro ao verificar permissão do módulo NFSe na empresa:", e);
    }
    return false;
}

async function openSpecialtyImportModal() {
    if (!isSuperAdmin || !specialtyImportModal) {
        showToast('Apenas SuperAdmin pode importar especialidades.', true);
        return;
    }
    if (!specialtyImportModal.dataset.bound) {
        if (btnCloseSpecialtyImportModal) btnCloseSpecialtyImportModal.addEventListener('click', () => specialtyImportModal.classList.add('hidden'));
        if (btnCancelSpecialtyImport) btnCancelSpecialtyImport.addEventListener('click', () => specialtyImportModal.classList.add('hidden'));
        if (typeof specialtyImportModal !== 'undefined' && specialtyImportModal) { specialtyImportModal.addEventListener('click', (e) => { if (e.target === specialtyImportModal) specialtyImportModal.classList.add('hidden'); }); }
        if (btnSpecialtyImportParse) btnSpecialtyImportParse.addEventListener('click', () => parseSpecialtyImportFile());
        if (btnSubdivisionImportParse) btnSubdivisionImportParse.addEventListener('click', () => parseSubdivisionImportFile());
        if (btnConfirmSpecialtyImport) btnConfirmSpecialtyImport.addEventListener('click', () => confirmSpecialtyImport());
        if (btnConfirmSubdivisionImport) btnConfirmSubdivisionImport.addEventListener('click', () => confirmSubdivisionImport());
        if (btnExportSpecialtyXlsx) btnExportSpecialtyXlsx.addEventListener('click', () => exportSpecialtiesXlsx());
        if (btnExportSubdivisionXlsx) btnExportSubdivisionXlsx.addEventListener('click', () => exportSubdivisionsXlsx());
        specialtyImportModal.dataset.bound = '1';
    }
    if (specialtyImportStatus) specialtyImportStatus.textContent = '';
    if (subdivisionImportStatus) subdivisionImportStatus.textContent = '';
    if (specialtyImportPreviewWrap) specialtyImportPreviewWrap.classList.add('hidden');
    if (subdivisionImportPreviewWrap) subdivisionImportPreviewWrap.classList.add('hidden');
    if (specialtyImportPreviewBody) specialtyImportPreviewBody.innerHTML = '';
    if (subdivisionImportPreviewBody) subdivisionImportPreviewBody.innerHTML = '';
    if (btnConfirmSpecialtyImport) btnConfirmSpecialtyImport.disabled = true;
    if (btnConfirmSubdivisionImport) btnConfirmSubdivisionImport.disabled = true;
    window.__specialtyImportRows = [];
    window.__subdivisionImportRows = [];
    specialtyImportModal.classList.remove('hidden');
}

function getEffectiveImportEmpresaId() {
    const curr = String(currentEmpresaId || '').trim();
    const sw = document.getElementById('companySwitcher');
    const swVal = String(sw && sw.value || '').trim();
    if (curr && curr !== 'emp_master') return curr;
    if (swVal && swVal !== 'emp_master') return swVal;
    return curr || swVal || '';
}

function extractLeadingSpecialtyCode(text) {
    const s = String(text || '').trim();
    const m = s.match(/^[^\d]*(\d+)\s*[-.)]?\s*/);
    return m ? String(m[1]) : '';
}

async function parseSpecialtyImportFile() {
    try {
        if (!specialtyImportFile || !specialtyImportFile.files || !specialtyImportFile.files[0]) {
            showToast('Selecione um arquivo XLSX.', true);
            return;
        }
        const file = specialtyImportFile.files[0];
        if (specialtyImportStatus) specialtyImportStatus.textContent = 'Lendo arquivo...';
        const rows = await readXlsxToRowArrays(file);
        const skipHeader = specialtyImportSkipHeader ? Boolean(specialtyImportSkipHeader.checked) : true;
        const parsed = parseImportValues(rows, skipHeader, ['nome', 'especialidade', 'especialidade_nome']);
        const uniqSpecs = new Set(parsed);
        window.__specialtyImportRows = parsed;

        if (specialtyImportPreviewBody) {
            const preview = parsed.slice(0, 200).map(x => `
                <tr>
                    <td>${escapeHtml(x)}</td>
                </tr>
            `).join('');
            if (typeof specialtyImportPreviewBody !== 'undefined' && specialtyImportPreviewBody) { specialtyImportPreviewBody.innerHTML = preview || '<tr><td style="text-align:center; padding: 14px; color:#6b7280;">Nenhuma linha válida.</td></tr>'; }
        }
        if (specialtyImportPreviewWrap) specialtyImportPreviewWrap.classList.remove('hidden');
        if (btnConfirmSpecialtyImport) btnConfirmSpecialtyImport.disabled = parsed.length === 0;
        if (specialtyImportStatus) {
            if (typeof specialtyImportStatus !== 'undefined' && specialtyImportStatus) { specialtyImportStatus.textContent = [
                `Linhas válidas: ${parsed.length}`,
                `Especialidades (únicas): ${uniqSpecs.size}`,
                'Coluna usada: nome (ou coluna A)'
            ].join('\n'); }
        }
    } catch (e) {
        const msg = e && e.message ? String(e.message) : 'Erro ao ler XLSX.';
        if (specialtyImportStatus) specialtyImportStatus.textContent = msg;
        showToast(msg, true);
    }
}

async function confirmSpecialtyImport() {
    if (!isSuperAdmin) { showToast('Apenas SuperAdmin.', true); return; }
    let parsed = Array.isArray(window.__specialtyImportRows) ? window.__specialtyImportRows : [];
    if (!parsed.length && specialtyImportFile && specialtyImportFile.files && specialtyImportFile.files[0]) {
        await parseSpecialtyImportFile();
        parsed = Array.isArray(window.__specialtyImportRows) ? window.__specialtyImportRows : [];
    }
    if (!parsed.length) { showToast('Nenhuma linha para importar.', true); return; }
    const empresaId = getEffectiveImportEmpresaId();
    if (!empresaId) { showToast('Empresa inválida.', true); return; }

    if (specialtyImportStatus) specialtyImportStatus.textContent = 'Carregando estado atual...';

    const { data: existingSpecs, error: sErr } = await withTimeout(
        db.from('especialidades').select('id,nome,seqid').eq('empresa_id', empresaId),
        20000,
        'specImport:especialidades'
    );
    if (sErr) { showToast('Falha ao carregar especialidades.', true); return; }

    const specByKey = new Map();
    let maxSeq = 0;
    (existingSpecs || []).forEach(s => {
        const key = String(s.nome || '').trim().toUpperCase();
        if (!key) return;
        specByKey.set(key, { id: String(s.id), seqid: Number(s.seqid || 0), nome: key });
        if (Number(s.seqid || 0) > maxSeq) maxSeq = Number(s.seqid || 0);
    });
    let createdSpecs = 0;
    let skipped = 0;

    for (const row of parsed) {
        const specKey = String(row || '').trim().toUpperCase();
        if (!specKey) continue;

        let spec = specByKey.get(specKey);
        if (!spec) {
            maxSeq += 1;
            const specData = { id: generateId(), seqid: maxSeq, nome: specKey, empresa_id: empresaId };
            const { data: ins, error } = await withTimeout(
                db.from('especialidades').insert(specData).select('id,seqid,nome').single(),
                20000,
                'specImport:insertEspecialidade'
            );
            if (error) throw error;
            spec = { id: String(ins.id), seqid: Number(ins.seqid || specData.seqid), nome: String(ins.nome || specKey) };
            specByKey.set(specKey, spec);
            createdSpecs += 1;
        } else {
            skipped += 1;
        }
    }

    if (specialtyImportStatus) {
        if (typeof specialtyImportStatus !== 'undefined' && specialtyImportStatus) { specialtyImportStatus.textContent = [
            `Especialidades criadas: ${createdSpecs}`,
            `Duplicados ignorados: ${skipped}`
        ].join('\n'); }
    }
    try {
        if (String(currentEmpresaId || '') !== String(empresaId || '')) {
            await switchCompany(String(empresaId));
        } else {
            await initializeApp(true);
        }
    } catch {
        await refreshSpecialtiesGridForEmpresa(empresaId);
    }
    showList('specialties');
    showToast(`Importação de especialidades concluída. Criadas: ${createdSpecs}.`);
}

async function refreshSpecialtiesGridForEmpresa(empresaId) {
    const empId = String(empresaId || '').trim();
    if (!empId) return;
    const [specRes, subRes] = await Promise.all([
        db.from('especialidades').select('*').eq('empresa_id', empId).order('seqid', { ascending: true }),
        db.from('especialidade_subdivisoes').select('*').eq('empresa_id', empId)
    ]);
    if (specRes.error || subRes.error) return;
    const specs = Array.isArray(specRes.data) ? specRes.data : [];
    const subs = Array.isArray(subRes.data) ? subRes.data : [];
    specs.forEach(spec => {
        const sid = String(spec && spec.id || '').trim();
        spec.subdivisoes = subs.filter(sub => String(sub && sub.especialidade_id || '').trim() === sid);
    });
    if (String(currentEmpresaId || '') === empId) {
        specialties = specs;
        renderTable(specialties, 'specialties');
    }
}

function getSaEmpresaId() {
    if (!saEmpresa) return String(currentEmpresaId || '');
    return String(saEmpresa.value || currentEmpresaId || '');
}

async function refreshSaEmpresaOptions({ keepSelection = true } = {}) {
    if (!isSuperAdmin || !saEmpresa) return;
    const prev = keepSelection ? String(saEmpresa.value || '') : '';
    try {
        const { data, error } = await withTimeout(
            db.from('empresas').select('*').order('nome'),
            20000,
            'sa:empresas_refresh'
        );
        if (error) throw error;
        activeEmpresasList = Array.isArray(data) ? data : [];
    } catch { }
    const empresas = (activeEmpresasList || []).slice().sort((a, b) => String(a.nome || a.id || '').localeCompare(String(b.nome || b.id || ''), 'pt-BR'));
    if (typeof saEmpresa !== 'undefined' && saEmpresa) { saEmpresa.innerHTML = empresas.map(e => `<option value="${escapeHtml(String(e.id))}">${escapeHtml(String(e.nome || e.id))}</option>`).join(''); }
    const canKeep = prev && empresas.some(e => String(e.id) === prev);
    const canUseCurrent = currentEmpresaId && empresas.some(e => String(e.id) === String(currentEmpresaId));
    const next = canKeep ? prev : (canUseCurrent ? String(currentEmpresaId) : (empresas[0] ? String(empresas[0].id) : ''));
    if (next) saEmpresa.value = next;
}
const navEmpresas = document.getElementById('navEmpresas');
const specialtyFormView = document.getElementById('specialtyFormView');
const empresasListView = document.getElementById('empresasListView');
const empresaFormView = document.getElementById('empresaFormView');
const btnAddNewEmpresa = document.getElementById('btnAddNewEmpresa');
const btnBackEmpresa = document.getElementById('btnBackEmpresa');
const btnCancelEmpresa = document.getElementById('btnCancelEmpresa');
const assinaturaEmpresaId = document.getElementById('assinaturaEmpresaId');
const empresaForm = document.getElementById('empresaForm');
const empresaLogoFile = document.getElementById('empresaLogoFile');
const empresaLogoBase64 = document.getElementById('empresaLogoBase64');

// Specialty DOM Elements
const btnNewSpecialty = document.getElementById('btnNewSpecialty');
const btnBackSpecialty = document.getElementById('btnBackSpecialty');
const btnCancelSpecialty = document.getElementById('btnCancelSpecialty');
const specialtyForm = document.getElementById('specialtyForm');
const specialtyEmptyState = document.getElementById('specialtyEmptyState');
const specialtyFormTitle = document.getElementById('specialtyFormTitle');
const btnFatMensalProfissional = document.getElementById('btnFatMensalProfissional');
const saEmpresa = document.getElementById('saEmpresa');
const btnSaRefreshEmpresas = document.getElementById('btnSaRefreshEmpresas');

const specialtyImportModal = document.getElementById('specialtyImportModal');
const btnCloseSpecialtyImportModal = document.getElementById('btnCloseSpecialtyImportModal');
const btnCancelSpecialtyImport = document.getElementById('btnCancelSpecialtyImport');
const specialtyImportFile = document.getElementById('specialtyImportFile');
const specialtyImportSkipHeader = document.getElementById('specialtyImportSkipHeader');
const btnSpecialtyImportParse = document.getElementById('btnSpecialtyImportParse');
const specialtyImportStatus = document.getElementById('specialtyImportStatus');
const specialtyImportPreviewWrap = document.getElementById('specialtyImportPreviewWrap');
const specialtyImportPreviewBody = document.getElementById('specialtyImportPreviewBody');
const btnConfirmSpecialtyImport = document.getElementById('btnConfirmSpecialtyImport');
const btnExportSpecialtyXlsx = document.getElementById('btnExportSpecialtyXlsx');
const subdivisionImportTargetSpecialty = document.getElementById('subdivisionImportTargetSpecialty');
// Active State
let currentSpecialtySubdivisions = [];
let deletedSpecialtySubdivisionIds = new Set();

function getEstoqueEmpresaScopeId() {
    const saEmp = (isSuperAdmin && saEmpresa) ? String(saEmpresa.value || '').trim() : '';
    if (saEmp) return saEmp;
    const sw = document.getElementById('companySwitcher');
    const swEmp = sw ? String(sw.value || '').trim() : '';
    if (swEmp) return swEmp;
    const emp = String(currentEmpresaId || '').trim();
    if (emp) return emp;
    return '';
}

const areasClinicas = ['Dentística', 'Endodontia', 'Periodontia', 'Cirurgia', 'Implantodontia', 'Ortodontia', 'Harmonização Facial'];

async function importDefaultTemplatesForCurrentEmpresa() {
    const empresaId = String(currentEmpresaId || '').trim();
    if (!empresaId) {
        showToast('Empresa inválida.', true);
        return { ok: false, reason: 'missing_empresa_id' };
    }
    if (importDefaultTemplatesInFlight) {
        showToast('Importação em andamento. Aguarde.', true);
        return { ok: false, reason: 'in_flight' };
    }
    if (wasTemplatesAlreadyImported(empresaId)) {
        const warn = 'A Inteligência OCC já foi importada para esta empresa. Não importe novamente para evitar duplicação de itens.';
        try { alert(warn); } catch { }
        showToast(warn, true);
        return { ok: false, reason: 'already_imported' };
    }
    const dashOverlay = document.getElementById('dashImportOverlay');
    const dashOverlayIcon = document.getElementById('dashImportOverlayIcon');
    const dashOverlayText = document.getElementById('dashImportOverlayText');
    const dashBtn = document.getElementById('btnDashImportDefaultTemplates');
    const dashDismiss = document.getElementById('btnDashDismissImportBanner');
    const servicesBtn = document.getElementById('btnServicesImportDefaultTemplates');
    const adminManualBtn = document.getElementById('btnAdminImportDefaultTemplates');
    const prevDashBtnHtml = dashBtn ? dashBtn.innerHTML : '';
    const prevServicesHtml = servicesBtn ? servicesBtn.innerHTML : '';
    const prevAdminManualHtml = adminManualBtn ? adminManualBtn.innerHTML : '';
    const setBusy = (busy) => {
        const setDisabled = (el, v) => { if (el) el.disabled = !!v; };
        setDisabled(dashBtn, busy);
        setDisabled(servicesBtn, busy);
        setDisabled(adminManualBtn, busy);
        if (dashDismiss) dashDismiss.disabled = !!busy;
        if (dashBtn) {
            if (typeof dashBtn !== 'undefined' && dashBtn) { dashBtn.innerHTML = busy
                ? `<i class="ri-loader-4-line occ-spin"></i> Importando Inteligência...`
                : prevDashBtnHtml; }
        }
        if (servicesBtn) {
            if (typeof servicesBtn !== 'undefined' && servicesBtn) { servicesBtn.innerHTML = busy
                ? `<i class="ri-loader-4-line occ-spin"></i> Importando...`
                : prevServicesHtml; }
        }
        if (adminManualBtn) {
            if (typeof adminManualBtn !== 'undefined' && adminManualBtn) { adminManualBtn.innerHTML = busy
                ? `<i class="ri-loader-4-line occ-spin"></i> Importando...`
                : prevAdminManualHtml; }
        }
        if (dashOverlay) {
            if (busy) dashOverlay.classList.remove('hidden');
            else dashOverlay.classList.add('hidden');
        }
        if (dashOverlayIcon && busy) if (typeof dashOverlayIcon !== 'undefined' && dashOverlayIcon) { dashOverlayIcon.className = 'ri-loader-4-line occ-spin'; }
        if (dashOverlayText && busy) if (typeof dashOverlayText !== 'undefined' && dashOverlayText) { dashOverlayText.textContent = 'Importando Inteligência... (aguarde)'; }
    };
    const setOverlayError = (message) => {
        if (!dashOverlay) return;
        dashOverlay.classList.remove('hidden');
        if (dashOverlayIcon) dashOverlayIcon.className = 'ri-error-warning-line';
        if (dashOverlayText) dashOverlayText.textContent = String(message || 'Falha ao importar.');
    };
    const setOverlaySuccess = (message) => {
        if (!dashOverlay) return;
        dashOverlay.classList.remove('hidden');
        if (dashOverlayIcon) dashOverlayIcon.className = 'ri-checkbox-circle-line';
        if (dashOverlayText) dashOverlayText.textContent = String(message || 'Dados importados com sucesso!');
    };
    let reloadPlanned = false;
    try {
        importDefaultTemplatesInFlight = true;
        setBusy(true);
        const { data, error } = await withTimeout(
            db.rpc('rpc_import_default_templates', { p_empresa_id: empresaId }),
            180000,
            'rpc_import_default_templates'
        );
        if (error) throw error;
        const result = (data && typeof data === 'string') ? (JSON.parse(data) || {}) : (data || {});
        const cServ = Number(result && result.servicos) || 0;
        const cInv = Number(result && result.inventory) || 0;
        const cKits = Number(result && result.usage_models) || 0;
        const warningPrices = 'Atenção: Os valores dos serviços importados são baseados na média de mercado. Revise e altere conforme sua tabela de preços própria.';
        const msgCounts = `Sucesso! Importados ${cServ} serviços, ${cInv} itens de estoque e ${cKits} kits. Recarregando o Dashboard...`;
        markTemplatesImported(empresaId);
        setOverlaySuccess(`${msgCounts} ${warningPrices}`);
        const banner = document.getElementById('templateImportPricingBanner');
        if (banner) banner.classList.remove('hidden');
        showToast(msgCounts);
        try { alert(warningPrices); } catch { }
        try { await loadServices(); } catch { }
        try { await loadEstoqueData(true); } catch { }
        try { renderUsageModelsTable(); } catch { }
        try { renderInventoryTable(); } catch { }
        try { renderServiceMappingTable(); } catch { }
        reloadPlanned = true;
        setTimeout(() => {
            try { window.location.reload(); } catch { }
        }, 2000);
        return { ok: true, result };
    } catch (err) {
        const code = err && err.code ? String(err.code) : '-';
        const msg = err && err.message ? String(err.message) : 'Falha ao importar dados padrão.';
        const details = err && err.details ? String(err.details) : '';
        const hint = err && err.hint ? String(err.hint) : '';
        const context = err && err.context ? String(err.context) : '';
        const full = [
            'Falha na importação da Inteligência OCC.',
            `Empresa: ${empresaId}`,
            `Código: ${code}`,
            `Mensagem: ${msg}`,
            details ? `Detalhes: ${details}` : '',
            hint ? `Hint: ${hint}` : '',
            context ? `Contexto: ${context}` : ''
        ].filter(Boolean).join('\n');
        setOverlayError(msg);
        try { alert(full); } catch { }
        showToast(msg, true);
        return { ok: false, message: msg, code, details, hint };
    } finally {
        if (reloadPlanned) return;
        if (importDefaultTemplatesInFlight) {
            importDefaultTemplatesInFlight = false;
            setBusy(false);
        }
    }
}

function getInventoryLogsEmpresaScopeId() {
    return getEstoqueEmpresaScopeId();
}

let __subdivLookupEmpresaId = '';

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
    const subsRes = await db.from('especialidade_subdivisoes').select('id,nome,especialidade_id').eq('empresa_id', emp).order('nome', { ascending: true });
    if (subsRes.error) throw subsRes.error;
    const specsRes = await db.from('especialidades').select('id,nome,seqid').eq('empresa_id', emp);
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

async function printFaturamentoMensalProfissionalCross(year) {
    let comRows = [];
    try {
        const { data, error } = await withTimeout(
            db.from('financeiro_comissoes')
                .select('profissional_id,valor_comissao,status,data_pagamento,data_geracao')
                .eq('empresa_id', currentEmpresaId)
                .in('status', ['PAGA', 'ANTECIPADA'])
                .order('data_pagamento', { ascending: true }),
            20000,
            'cross_profissional:financeiro_comissoes'
        );
        if (error) throw error;
        comRows = Array.isArray(data) ? data : [];
    } catch (err) {
        showToast(`Falha ao carregar comissões: ${err && err.message ? err.message : 'erro'}`, true);
        return;
    }
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const map = new Map();
    const monthTotals = Array(12).fill(0);
    let grandTotal = 0;
    comRows.forEach((r) => {
        const raw = r && (r.data_pagamento || r.data_geracao);
        const dt = raw ? new Date(raw) : null;
        if (!dt || !Number.isFinite(dt.getTime())) return;
        if (dt.getUTCFullYear() !== year && dt.getFullYear() !== year) return;
        const month = dt.getMonth();
        const profSeq = String(r && r.profissional_id || '').trim();
        const name = profSeq ? getProfessionalNameBySeqId(profSeq) : 'Sem profissional';
        if (!map.has(name)) map.set(name, { name, months: Array(12).fill(0), total: 0 });
        const row = map.get(name);
        const val = toDec(r && r.valor_comissao, 0);
        row.months[month] += val;
        row.total += val;
        monthTotals[month] += val;
        grandTotal += val;
    });
    const rows = Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const html = buildCrossTableHtml({
        title: `Faturamento Mensal`,
        subtitle: `Cross table por profissional (Comissões PAGA + ANTECIPADA) • Ano ${year}`,
        entityLabel: 'Profissional',
        monthLabels,
        rows,
        monthTotals,
        grandTotal
    });
    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: `Faturamento Mensal - Profissional (${year})`, legacyHtml: html, width: 1200, height: 780 });
    if (!ok) return;
}

function getSpecialtyName(id) {
    const s = specialties.find(spec => spec.id === id);
    return s ? s.nome : 'Desconhecida';
}

function getEmpresaName(id) {
    if (!id || id === '—') return '—';
    const e = activeEmpresasList.find(emp => emp.id === id);
    return e ? e.nome : id;
}

function getSpecialtyName(id) {
    const s = specialties.find(x => x.id === id);
    return s ? s.nome : '-';
}

const budItemProfissionalId = document.getElementById('budItemProfissionalId');

async function fetchEmpresas() {
    try {
        const { data, error } = await db.from('empresas').select('*').order('nome');
        if (error) throw error;
        activeEmpresasList = data || [];
        renderEmpresas();
    } catch (err) {
        console.error("Error fetching empresas:", err);
        showToast("Erro ao carregar empresas.", true);
    }
}

function renderEmpresas() {
    const tbody = document.getElementById('empresasTableBody');
    const emptyState = document.getElementById('empresasEmptyState');
    if (typeof tbody !== 'undefined' && tbody) { tbody.innerHTML = ''; }

    if (activeEmpresasList.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        activeEmpresasList.forEach(emp => {
            const tr = document.createElement('tr');
            if (typeof tr !== 'undefined' && tr) { tr.innerHTML = `
                                    <td>
                                        ${emp.logotipo ? `<img src="${emp.logotipo}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px;">` : `<div style="width: 40px; height: 40px; background: #eee; display: flex; align-items: center; justify-content: center; border-radius: 4px;"><i class="ri-image-line"></i></div>`}
                                    </td>
                                    <td>${emp.id}</td>
                                    <td style="font-weight: bold;">${emp.nome}</td>
                                    <td>
                                        <div class="actions">
                                            <button onclick="editEmpresa('${emp.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                                        </div>
                                    </td>
                                    `; }
            if (typeof tbody !== 'undefined' && tbody) { tbody.appendChild(tr); }
        });
    }
}
// Exposing functions to window to ensure global access
window.checkEmpresaHasNfseModule = checkEmpresaHasNfseModule;
window.openSpecialtyImportModal = openSpecialtyImportModal;
window.getEffectiveImportEmpresaId = getEffectiveImportEmpresaId;
window.extractLeadingSpecialtyCode = extractLeadingSpecialtyCode;
window.parseSpecialtyImportFile = parseSpecialtyImportFile;
window.confirmSpecialtyImport = confirmSpecialtyImport;
window.refreshSpecialtiesGridForEmpresa = refreshSpecialtiesGridForEmpresa;
window.getSaEmpresaId = getSaEmpresaId;
window.refreshSaEmpresaOptions = refreshSaEmpresaOptions;
window.getEstoqueEmpresaScopeId = getEstoqueEmpresaScopeId;
window.importDefaultTemplatesForCurrentEmpresa = importDefaultTemplatesForCurrentEmpresa;
window.getInventoryLogsEmpresaScopeId = getInventoryLogsEmpresaScopeId;
window.refreshServSubdivisaoLookupForEmpresa = refreshServSubdivisaoLookupForEmpresa;
window.printFaturamentoMensalProfissionalCross = printFaturamentoMensalProfissionalCross;
window.getSpecialtyName = getSpecialtyName;
window.getEmpresaName = getEmpresaName;
window.getSpecialtyName = getSpecialtyName;
window.fetchEmpresas = fetchEmpresas;
window.renderEmpresas = renderEmpresas;

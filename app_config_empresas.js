
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
    saEmpresa.innerHTML = empresas.map(e => `<option value="${escapeHtml(String(e.id))}">${escapeHtml(String(e.nome || e.id))}</option>`).join('');
    const canKeep = prev && empresas.some(e => String(e.id) === prev);
    const canUseCurrent = currentEmpresaId && empresas.some(e => String(e.id) === String(currentEmpresaId));
    const next = canKeep ? prev : (canUseCurrent ? String(currentEmpresaId) : (empresas[0] ? String(empresas[0].id) : ''));
    if (next) saEmpresa.value = next;
}
const navEmpresas = document.getElementById('navEmpresas');
const empresasListView = document.getElementById('empresasListView');
const empresaFormView = document.getElementById('empresaFormView');
const btnAddNewEmpresa = document.getElementById('btnAddNewEmpresa');
const btnBackEmpresa = document.getElementById('btnBackEmpresa');
const btnCancelEmpresa = document.getElementById('btnCancelEmpresa');
const empresaForm = document.getElementById('empresaForm');
const saEmpresa = document.getElementById('saEmpresa');
const btnSaRefreshEmpresas = document.getElementById('btnSaRefreshEmpresas');

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
            dashBtn.innerHTML = busy
                ? `<i class="ri-loader-4-line occ-spin"></i> Importando Inteligência...`
                : prevDashBtnHtml;
        }
        if (servicesBtn) {
            servicesBtn.innerHTML = busy
                ? `<i class="ri-loader-4-line occ-spin"></i> Importando...`
                : prevServicesHtml;
        }
        if (adminManualBtn) {
            adminManualBtn.innerHTML = busy
                ? `<i class="ri-loader-4-line occ-spin"></i> Importando...`
                : prevAdminManualHtml;
        }
        if (dashOverlay) {
            if (busy) dashOverlay.classList.remove('hidden');
            else dashOverlay.classList.add('hidden');
        }
        if (dashOverlayIcon && busy) dashOverlayIcon.className = 'ri-loader-4-line occ-spin';
        if (dashOverlayText && busy) dashOverlayText.textContent = 'Importando Inteligência... (aguarde)';
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

let __subdivLookupEmpresaId = '';

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
    tbody.innerHTML = '';

    if (activeEmpresasList.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        activeEmpresasList.forEach(emp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
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
                                    `;
            tbody.appendChild(tr);
        });
    }
}
window.importDefaultTemplatesForCurrentEmpresa = importDefaultTemplatesForCurrentEmpresa;

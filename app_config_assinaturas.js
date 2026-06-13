 // Store companies list for admins
let configPlanosList = [];
let assinaturaValidationInFlight = null;

function normalizeAssinaturaStatus(raw) {
    const k = normalizeKey(raw || '');
    if (k === 'ATIVO' || k === 'ATIVA') return 'ATIVO';
    if (k === 'PENDENTE') return 'PENDENTE';
    if (k === 'EXPIRADO' || k === 'EXPIRADA') return 'EXPIRADO';
    if (k === 'TRIAL') return 'TRIAL';
    return k || 'TRIAL';
}

async function validateAssinaturaStatusGate({ reason = 'navegacao' } = {}) {
    if (isSuperAdmin) return true;
    const empresaId = String(currentEmpresaId || '').trim();
    if (!empresaId) return true;
    if (assinaturaValidationInFlight) return assinaturaValidationInFlight;
    assinaturaValidationInFlight = (async () => {
        const { data, error } = await withTimeout(
            db.from('empresas').select('id,assinatura_status,data_vencimento,plano_tipo').eq('id', empresaId).single(),
            10000,
            `assinatura:gate:${reason}`
        );
        if (error) throw error;
        const row = data || {};
        if (!isAssinaturaIrregular(row)) return true;
        const plano = String(row.plano_tipo || 'plano').trim() || 'plano';
        const statusKey = normalizeAssinaturaStatus(row.assinatura_status);
        const msg = statusKey === 'PENDENTE'
            ? `Assinatura pendente para o ${plano}. Acesso bloqueado até confirmação do pagamento.`
            : 'Assinatura expirada/irregular. Faça login novamente para regularizar.';
        await forceLogoutBySubscription(msg);
        return false;
    })();
    try {
        return await assinaturaValidationInFlight;
    } finally {
        assinaturaValidationInFlight = null;
    }
}

function buildSaPlan(scopeRaw, empresaId, tableNameRaw, clearAuditFlag) {
    const scope = String(scopeRaw || '').trim().toUpperCase();
    const tableName = String(tableNameRaw || '').trim();
    const clearAudit = Boolean(clearAuditFlag);

    const plan = [];
    const add = (table) => plan.push({ table: String(table) });

    const baseAll = () => {
        add('orcamento_itens');
        add('orcamento_pagamentos');
        add('orcamentos');
        add('orcamento_cancelados');
        add('financeiro_comissoes');
        add('financeiro_transacoes');
        add('agenda_agendamentos');
        add('agenda_disponibilidade');
        add('paciente_documentos');
        add('paciente_evolucao');
        add('ordens_proteticas_anexos');
        add('ordens_proteticas_eventos');
        add('ordens_proteticas');
        add('protese_contas_pagas');
        add('ordens_proteticas_custodia_eventos');
        add('ordens_proteticas_custodia_tokens');
        add('laboratorios_proteticos');
        add('marketing_envios');
        add('marketing_campanhas');
        add('marketing_smtp_config');
        add('servicos');
        add('especialidade_subdivisoes');
        add('especialidades');
        add('profissionais');
        add('pacientes');
        add('usuario_empresas');
    };

    if (scope === 'ZERAR') {
        baseAll();
        add('occ_audit_log');
        add('empresas'); // delete empresa ao final
    } else if (scope === 'ALL') {
        baseAll();
        if (clearAudit) add('occ_audit_log');
        // opcionalmente não remove empresa em ALL (mantém cadastro)
    } else if (scope === 'AUDIT') {
        add('occ_audit_log');
    } else if (scope === 'CATALOG') {
        add('servicos');
        add('especialidade_subdivisoes');
        add('especialidades');
        if (clearAudit) add('occ_audit_log');
    } else if (scope === 'FINANCE') {
        add('financeiro_comissoes');
        add('financeiro_transacoes');
        add('orcamento_pagamentos');
        if (clearAudit) add('occ_audit_log');
    } else if (scope === 'AGENDA') {
        add('agenda_agendamentos');
        add('agenda_disponibilidade');
        if (clearAudit) add('occ_audit_log');
    } else if (scope === 'PATIENTS') {
        add('paciente_documentos');
        add('paciente_evolucao');
        add('pacientes');
        if (clearAudit) add('occ_audit_log');
    } else if (scope === 'BUDGETS') {
        add('orcamento_itens');
        add('orcamento_pagamentos');
        add('orcamentos');
        add('orcamento_cancelados');
        if (clearAudit) add('occ_audit_log');
    } else if (scope === 'PROTESE') {
        add('ordens_proteticas_anexos');
        add('ordens_proteticas_eventos');
        add('ordens_proteticas');
        add('protese_contas_pagas');
        add('ordens_proteticas_custodia_eventos');
        add('ordens_proteticas_custodia_tokens');
        add('laboratorios_proteticos');
        if (clearAudit) add('occ_audit_log');
    } else if (scope === 'TABLE') {
        const t = tableName;
        if (!t) return [];
        if (t === 'especialidades') {
            add('especialidade_subdivisoes');
            add('especialidades');
        } else if (t === 'orcamentos') {
            add('orcamento_itens');
            add('orcamento_pagamentos');
            add('orcamentos');
        } else if (t === 'profissionais') {
            add('agenda_disponibilidade');
            add('agenda_agendamentos');
            add('profissionais');
        } else {
            add(t);
        }
        if (clearAudit) add('occ_audit_log');
    }

    const seen = new Set();
    return plan.filter(p => {
        if (!p.table) return false;
        const k = String(p.table);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    }).map(p => ({ ...p, empresaId }));
}

function renderSaPlan() {
    if (!saPlan) return;
    const empresaId = getSaEmpresaId();
    const scope = saScope ? String(saScope.value || '') : 'ALL';
    const tableName = saTable ? String(saTable.value || '') : '';
    const clearAudit = saClearAudit ? Boolean(saClearAudit.checked) : false;
    const plan = buildSaPlan(scope, empresaId, tableName, clearAudit);
    const lines = [`[ESCOPO: ${scope || 'ALL'}]`];
    lines.push(...plan.map((p, idx) => {
        const n = String(idx + 1).padStart(2, '0');
        if (p.table === 'empresas') return `${String(idx + 1).padStart(2, '0')}. delete from empresas where id='${empresaId}'`;
        return `${n}. delete from ${p.table} where empresa_id='${empresaId}'`;
    }));
    saPlan.textContent = lines.length ? lines.join('\n') : 'Selecione o escopo.';
}

async function saExecutePlan(plan) {
    const results = [];
    for (const step of plan) {
        const table = String(step.table);
        try {
            let error = null;
            if (table === 'empresas') {
                const res = await withTimeout(
                    db.from('empresas').delete().eq('id', step.empresaId),
                    30000,
                    `sa:delete:empresas`
                );
                error = res.error || null;
            } else {
                const res = await withTimeout(
                    db.from(table).delete().eq('empresa_id', step.empresaId),
                    30000,
                    `sa:delete:${table}`
                );
                error = res.error || null;
            }
            if (error) throw error;
            results.push({ table, ok: true });
        } catch (e) {
            const msg = e && e.message ? String(e.message) : String(e);
            results.push({ table, ok: false, msg });
        }
    }
    return results;
}
const navAssinaturas = document.getElementById('navAssinaturas');
const assinaturasView = document.getElementById('assinaturasView');
const btnAddPlanoConfig = document.getElementById('btnAddPlanoConfig');
const configPlanosTableBody = document.getElementById('configPlanosTableBody');
const configPlanosEmptyState = document.getElementById('configPlanosEmptyState');
const assinaturasTableBody = document.getElementById('assinaturasTableBody');
const assinaturasEmptyState = document.getElementById('assinaturasEmptyState');
const assinaturaModal = document.getElementById('assinaturaModal');
const assinaturaEmpresaId = document.getElementById('assinaturaEmpresaId');
const assinaturaPlanoTipo = document.getElementById('assinaturaPlanoTipo');
const assinaturaDataVencimento = document.getElementById('assinaturaDataVencimento');
const assinaturaStatus = document.getElementById('assinaturaStatus');
const btnCloseAssinaturaModal = document.getElementById('btnCloseAssinaturaModal');
const btnCancelAssinaturaModal = document.getElementById('btnCancelAssinaturaModal');
const btnSaveAssinaturaModal = document.getElementById('btnSaveAssinaturaModal');
const planoConfigModal = document.getElementById('planoConfigModal');
const planoConfigModalTitle = document.getElementById('planoConfigModalTitle');
const planoConfigId = document.getElementById('planoConfigId');
const planoConfigTipoAssinatura = document.getElementById('planoConfigTipoAssinatura');
const planoConfigValor = document.getElementById('planoConfigValor');
const planoConfigModulos = document.getElementById('planoConfigModulos');
const planoConfigDestaque = document.getElementById('planoConfigDestaque');
const btnClosePlanoConfigModal = document.getElementById('btnClosePlanoConfigModal');
const btnCancelPlanoConfigModal = document.getElementById('btnCancelPlanoConfigModal');
const btnSavePlanoConfigModal = document.getElementById('btnSavePlanoConfigModal');
const saPlan = document.getElementById('saPlan');

function openAssinaturaModal(emp) {
    if (!emp || !isSuperAdmin) return;
    if (assinaturaEmpresaId) assinaturaEmpresaId.value = String(emp && emp.id || '');
    if (assinaturaPlanoTipo) assinaturaPlanoTipo.value = String(emp && emp.plano_tipo || '');
    if (assinaturaDataVencimento) assinaturaDataVencimento.value = emp && emp.data_vencimento ? String(emp.data_vencimento).slice(0, 10) : '';
    if (assinaturaStatus) {
        const key = normalizeKey(emp && emp.assinatura_status || 'PENDENTE');
        assinaturaStatus.value = (key === 'TRIAL' || key === 'ATIVO' || key === 'ATIVA') ? (key === 'ATIVA' ? 'ATIVO' : key) : 'PENDENTE';
    }
    assinaturaModal.classList.remove('hidden');
}

function openPlanoConfigModal(item) {
    if (!isSuperAdmin || !planoConfigModal) return;
    if (planoConfigModalTitle) planoConfigModalTitle.textContent = item ? 'Editar Plano' : 'Novo Plano';
    if (planoConfigId) planoConfigId.value = item && item.id ? String(item.id) : '';
    if (planoConfigTipoAssinatura) planoConfigTipoAssinatura.value = item && item.tipo_assinatura ? String(item.tipo_assinatura) : '';
    
    const planoConfigLegendaComercial = document.getElementById('planoConfigLegendaComercial');
    if (planoConfigLegendaComercial) planoConfigLegendaComercial.value = item && item.legenda_comercial ? String(item.legenda_comercial) : '';
    
    if (planoConfigValor) planoConfigValor.value = item && item.valor_plano ? String(item.valor_plano) : '';
    
    const modulosTxt = item && item.modulos_texto ? String(item.modulos_texto) : '';
    const planoConfigModulosHidden = document.getElementById('planoConfigModulos');
    if (planoConfigModulosHidden) planoConfigModulosHidden.value = modulosTxt;
    if (planoConfigDestaque) planoConfigDestaque.checked = !!(item && item.destaque);
    
    const checkboxesContainer = document.getElementById('planoModulosCheckboxContainer');
    if (checkboxesContainer) {
        const selectedMods = modulosTxt.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        checkboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.checked = selectedMods.includes(chk.value.toLowerCase()) || selectedMods.includes(chk.parentElement.textContent.trim().toLowerCase());
        });
        
        const updateHiddenInput = () => {
            const checkedVals = Array.from(checkboxesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
            if (planoConfigModulosHidden) planoConfigModulosHidden.value = checkedVals.join(', ');
        };
        
        checkboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', updateHiddenInput);
        });
    }

    planoConfigModal.classList.remove('hidden');
}

async function fetchAssinaturas() {
    try {
        const { data, error } = await db
            .from('empresas')
            .select('id, nome, plano_tipo, data_vencimento, assinatura_status, created_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        activeEmpresasList = data || [];
        renderAssinaturas();
    } catch (err) {
        console.error("Error fetching assinaturas:", err);
        showToast("Erro ao carregar assinaturas.", true);
    }
}

async function fetchConfigPlanos() {
    try {
        const { data, error } = await db
            .from('config_planos')
            .select('*')
            .order('destaque', { ascending: false })
            .order('tipo_assinatura', { ascending: true });
        if (error) throw error;
        configPlanosList = data || [];
        renderConfigPlanos();
        renderAssinaturas();
        renderSuperAdminRenewals();
    } catch (err) {
        console.error("Error fetching config_planos:", err);
        showToast("Erro ao carregar configuração de planos.", true);
    }
}

function resolvePlanDisplayName(rawPlan) {
    const value = String(rawPlan || '').trim();
    if (!value) return '—';
    const key = normalizeKey(value);
    const list = Array.isArray(configPlanosList) ? configPlanosList : [];
    
    // Tenta achar pelo ID (caso UUID)
    const byId = list.find(p => String(p.id).toLowerCase() === value.toLowerCase());
    if (byId && byId.tipo_assinatura) return String(byId.tipo_assinatura);
    
    // Tenta achar pelo nome
    const byTipo = list.find(p => normalizeKey(p && p.tipo_assinatura || '') === key);
    if (byTipo && byTipo.tipo_assinatura) return String(byTipo.tipo_assinatura);
    
    // Tenta achar pelo valor
    const byValor = list.find(p => normalizeKey(p && p.valor_plano || '') === key);
    if (byValor && byValor.tipo_assinatura) return String(byValor.tipo_assinatura);
    
    return value;
}

function renderConfigPlanos() {
    if (!configPlanosTableBody || !configPlanosEmptyState) return;
    configPlanosTableBody.innerHTML = '';
    const rows = Array.isArray(configPlanosList) ? [...configPlanosList] : [];
    if (rows.length === 0) {
        configPlanosEmptyState.classList.remove('hidden');
        configPlanosTableBody.parentElement.style.display = 'none'; // Esconde a tabela se vazia
        return;
    }
    configPlanosEmptyState.classList.add('hidden');
    configPlanosTableBody.parentElement.style.display = ''; // Mostra a tabela
    rows.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${String(item && item.tipo_assinatura || '—')}</td>
            <td>${String(item && item.valor_plano || '—')}</td>
            <td>${String(item && item.modulos_texto || '—')}</td>
            <td>${item && item.destaque ? '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#dbeafe; color:#1d4ed8; font-weight:700;">SIM</span>' : 'NÃO'}</td>
            <td>
                <div class="actions">
                    <button class="btn-icon" onclick="editPlanoConfig('${String(item && item.id || '')}')" title="Editar"><i class="ri-edit-line"></i></button>
                    <button class="btn-icon delete-btn" onclick="deletePlanoConfig('${String(item && item.id || '')}')" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                </div>
            </td>
        `;
        configPlanosTableBody.appendChild(tr);
    });
}

function renderAssinaturas() {
    if (!assinaturasTableBody || !assinaturasEmptyState) return;
    assinaturasTableBody.innerHTML = '';
    const rows = Array.isArray(activeEmpresasList) ? [...activeEmpresasList] : [];
    if (rows.length === 0) {
        assinaturasEmptyState.classList.remove('hidden');
        return;
    }
    assinaturasEmptyState.classList.add('hidden');
    const now = Date.now();
    rows.forEach(emp => {
        const createdTs = emp && emp.created_at ? Date.parse(String(emp.created_at)) : NaN;
        const isNovo = Number.isFinite(createdTs) && (now - createdTs) <= (72 * 60 * 60 * 1000);
        const statusVal = String(emp && emp.assinatura_status || 'PENDENTE').toUpperCase();
        const statusBadge = statusVal === 'ATIVO'
            ? '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#dcfce7; color:#166534; font-weight:700;">ATIVO</span>'
            : (statusVal === 'TRIAL'
                ? '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#dbeafe; color:#1d4ed8; font-weight:700;">TRIAL</span>'
                : '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#ffedd5; color:#c2410c; font-weight:700;">PENDENTE</span>');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${String(emp && emp.id || '')}${isNovo ? ' <span class="status-badge status-pendente" style="margin-left:6px;">NOVO</span>' : ''}</td>
            <td style="font-weight:700;">${String(emp && emp.nome || '—')}</td>
            <td>${resolvePlanDisplayName(emp && emp.plano_tipo)}</td>
            <td>${emp && emp.data_vencimento ? String(emp.data_vencimento).slice(0, 10) : '—'}</td>
            <td>${statusBadge}</td>
            <td><button class="btn-icon" title="Editar Assinatura"><i class="ri-edit-line"></i></button></td>
        `;
        const editBtn = tr.querySelector('button');
        if (editBtn) editBtn.addEventListener('click', () => openAssinaturaModal(emp));
        assinaturasTableBody.appendChild(tr);
    });
}
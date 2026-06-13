
let explicitLogoutRequested = false;

function auditAuth(event, session) {
    void event;
    void session;
}

function shouldBlockLoginUiByBootWindow() {
    if (!bootStartedAt) return false;
    return (Date.now() - bootStartedAt) < 4000;
}

function showLoginUi() {
    const bootLoader = document.getElementById('bootLoader');
    const loginView = document.getElementById('loginView');
    const appContainer = document.getElementById('appContainer');
    if (bootLoader) bootLoader.style.display = 'none';
    if (loginView) loginView.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

async function forceLogoutBySubscription(reasonMsg) {
    const msg = String(reasonMsg || 'Assinatura irregular. Faça login novamente.');
    if (cep) {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) {
            showToast('CEP inválido! O CEP deve conter exatamente 8 números.', true);
            if (expCep) expCep.focus();
            return;
        }
    }

    try { await db.auth.signOut(); } catch { }
    currentUser = null;
    currentEmpresaId = null;
    currentUserRole = null;
    currentUserPerms = {};
    isSuperAdmin = false;
    requirePasswordChange = false;
    hidePrivacyScreensaver();
    if (privacyScreensaverTimerId) {
        clearTimeout(privacyScreensaverTimerId);
        privacyScreensaverTimerId = null;
    }
    stopPrivacyScreensaverBouncing();
    showLoginUi();
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.textContent = msg;
        loginError.style.display = 'block';
    }
    showToast(msg, true);
}

let securityLogoutTimerId = null;

function resetSecurityLogoutTimer() {
    if (securityLogoutTimerId) clearTimeout(securityLogoutTimerId);
    securityLogoutTimerId = setTimeout(() => {
        console.warn("Inatividade de 30 minutos atingida. Bloqueando tela.");
        showLockScreen();
    }, 30 * 60 * 1000); // 30 minutos
}

function bindSchemaAuditUi() {
    const btn = document.getElementById('btnSchemaAudit');
    const modal = document.getElementById('modalSchemaAudit');
    const closeBtn = document.getElementById('btnCloseModalSchemaAudit');
    const copyBtn = document.getElementById('btnCopySchemaAudit');
    const out = document.getElementById('schemaAuditMarkdown');

    const close = () => { if (modal) modal.classList.add('hidden'); };

    if (closeBtn && !closeBtn.__bound) {
        closeBtn.__bound = true;
        closeBtn.addEventListener('click', close);
    }
    if (modal && !modal.__bound) {
        modal.__bound = true;
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }
    if (copyBtn && !copyBtn.__bound) {
        copyBtn.__bound = true;
        copyBtn.addEventListener('click', async () => {
            const text = String(out && out.value || '');
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                showToast('Copiado.');
            } catch {
                try {
                    if (out) out.select();
                    document.execCommand('copy');
                    showToast('Copiado.');
                } catch {
                    showToast('Não foi possível copiar.', true);
                }
            }
        });
    }
    if (btn && !btn.__bound) {
        btn.__bound = true;
        btn.addEventListener('click', async () => {
            if (!modal || !out) return;
            modal.classList.remove('hidden');
            out.value = 'Carregando...';
            try {
                const { data, error } = await withTimeout(
                    db.from('occ_schema_audit_tables')
                        .select('*')
                        .order('table_name', { ascending: true }),
                    20000,
                    'schema_audit:tables'
                );
                if (error) throw error;
                const rows = Array.isArray(data) ? data : [];
                const lines = [];
                lines.push('# Auditoria de Integridade Multi-empresa (Schema)');
                lines.push('');
                lines.push('| Tabela | empresa_id existe | empresa_id NOT NULL | FK empresa_id→empresas | ON DELETE p/ empresas | Integridade |');
                lines.push('|---|---:|---:|---:|---|---|');
                rows.forEach(r => {
                    const t = String(r.table_name || '');
                    const has = r.has_empresa_id ? 'SIM' : 'NÃO';
                    const nn = r.empresa_id_not_null ? 'SIM' : 'NÃO';
                    const fk = r.empresa_id_has_fk_to_empresas ? 'SIM' : 'NÃO';
                    const del = String(r.empresas_fk_delete_rules || '') || '—';
                    const integ = String(r.integridade_multiempresa || '') || '—';
                    lines.push(`| ${t} | ${has} | ${nn} | ${fk} | ${del} | ${integ} |`);
                });
                lines.push('');
                lines.push('## Observações');
                lines.push('- "ON DELETE p/ empresas" lista as regras encontradas nas FKs que referenciam a tabela empresas.');
                lines.push('- Se uma tabela estiver como "SEM empresa_id", ela exige revisão para SaaS multi-tenant.');
                out.value = lines.join('\n');
            } catch (err) {
                const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
                out.value = `Falha ao carregar auditoria de schema: ${msg}`;
            }
        });
    }
}
const empresaLogoFile = document.getElementById('empresaLogoFile');
const empresaLogoBase64 = document.getElementById('empresaLogoBase64');
const logoPreviewContainer = document.getElementById('logoPreviewContainer');
const saClearAudit = document.getElementById('saClearAudit');

function buildStockCostsRowsFromLogs({ startDate, endDate, categoryFilter } = {}) {
    const invRows = Array.isArray(inventoryItems) ? inventoryItems : [];
    const invById = new Map(invRows.map((r) => [String(r && r.id || ''), r]));
    const resolveLogCost = (log) => resolveInventoryLogCost(invById, log);
    const rows = (Array.isArray(inventoryLogs) ? inventoryLogs : []).filter((log) => {
        const tipo = String(log && log.tipo || '').toUpperCase();
        const isNf = tipo === 'ENTRADA_NF';
        const isAuto = (tipo === 'SAIDA' || tipo === 'USO') && !!String(log && log.atendimento_id || '').trim();
        if (!isNf && !isAuto) return false;
        const dt = log && log.data_hora ? new Date(log.data_hora) : null;
        if (startDate && dt && dt < startDate) return false;
        if (endDate && dt && dt > endDate) return false;
        if (startDate && !dt) return false;
        if (endDate && !dt) return false;
        if (categoryFilter) {
            const inv = invById.get(String(log && log.inventory_id || ''));
            if (!inventoryAreaMatchesFilter(inv, categoryFilter)) return false;
        }
        return true;
    }).slice().sort((a, b) => new Date(b && b.data_hora || 0).getTime() - new Date(a && a.data_hora || 0).getTime());
    inventoryCostHistoryRowsCurrent = [];
    rows.forEach((log) => {
        const tipo = String(log && log.tipo || '').toUpperCase();
        const dt = log && log.data_hora ? new Date(log.data_hora) : null;
        const dtTxt = dt && Number.isFinite(dt.getTime()) ? dt.toLocaleString('pt-BR') : '—';
        const qtd = toDec(log && log.quantidade, 0);
        const custo = resolveLogCost(log);
        const motivo = String(log && log.motivo || '').trim();
        const tipoLabel = tipo === 'ENTRADA_NF'
            ? 'Entrada NF'
            : ((tipo === 'SAIDA' || tipo === 'USO') && motivo
                ? `${tipo === 'SAIDA' ? 'SAÍDA' : 'USO'} - Motivo: ${motivo}`
                : 'Baixa Automática');
        inventoryCostHistoryRowsCurrent.push({
            dataHora: dtTxt,
            material: getInventoryNameById(log && log.inventory_id),
            tipo: tipoLabel,
            quantidade: qtd,
            custo,
            atendimento: String(log && log.atendimento_id || '—')
        });
    });
    return inventoryCostHistoryRowsCurrent.slice();
}

const btnLogout = document.getElementById('btnLogout');
const btnBackToLogin = document.getElementById('btnBackToLogin');
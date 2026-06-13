// --- UTILITIES & MASCARAS ---
function maskCPF(value) {
    value = value.replace(/\D/g, "");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return value;
}

function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6, 10);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${ddd}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${ddd}) ${part1}${part2 ? '-' + part2 : ''}`;
    return `(${ddd}) ${part1}-${part2}`;
}

function maskCellphone(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${ddd}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${ddd}) ${part1}${part2 ? '-' + part2 : ''}`;
    return `(${ddd}) ${part1}-${part2}`;
}

function maskCEP(value) {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{5})(\d)/, "$1-$2");
    return value;
}

function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === 't' || s === '1' || s === 'sim' || s === 'yes' || s === 'y' || s === 'on';
}

// CPF validation algorithm
function isValidCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    if (cpf.length != 11 ||
        cpf == "00000000000" ||
        cpf == "11111111111" ||
        cpf == "22222222222" ||
        cpf == "33333333333" ||
        cpf == "44444444444" ||
        cpf == "55555555555" ||
        cpf == "66666666666" ||
        cpf == "77777777777" ||
        cpf == "88888888888" ||
        cpf == "99999999999")
        return false;
    let add = 0;
    for (let i = 0; i < 9; i++)
        add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++)
        add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(10))) return false;
    return true;
}

// --- SUPABASE & APP STATE ---

// const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
// const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
// const APP_BUILD = '20260611_FINANCEIRO_PRODUCAO';

// const AUTO_SEED_SPECIALTIES = false;

document.title = `${document.title.split(' [build ')[0]} [build ${APP_BUILD}]`;

function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
    window.__dpDebug = window.__dpDebug || { pending: 0, lastUrl: null, lastError: null, lastStep: null, lastDataLen: null, lastRenderRows: null, lastRenderInputLen: null, lastFirstRow: null, startedAt: Date.now(), enabled: false };
    if (window.__dpDebug.enabled) {
        window.__dpDebug.pending += 1;
        window.__dpDebug.lastUrl = String(url || '');
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const mergedOptions = { ...options, signal: controller.signal };

    // [OCC SECURITY] Bloqueio físico de queries zumbis textuais de financeiro_transacoes no wrapper de fetch do estoque
    if (String(url).includes('financeiro_transacoes') && String(url).match(/eq\.mq0/)) {
        console.warn('[OCC SECURITY] Interceptada e bloqueada query zumbi para financeiro_transacoes com ID textual na linha 95 do estoque!');
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }

    return fetch(url, mergedOptions)
        .catch(err => {
            if (window.__dpDebug.enabled) {
                window.__dpDebug.lastError = (err && err.message) ? err.message : String(err);
            }
            throw err;
        })
        .finally(() => {
            clearTimeout(timeoutId);
            if (window.__dpDebug.enabled) {
                window.__dpDebug.pending = Math.max(0, (window.__dpDebug.pending || 1) - 1);
            }
        });
}

// if (typeof window.supabase === 'undefined') {
//     alert('Erro crítico: Não foi possível carregar a biblioteca de banco de dados (Supabase). Verifique sua conexão com a internet ou se há algum bloqueador de anúncios/firewall impedindo o acesso aos servidores CDN.');
//     throw new Error('Supabase client not loaded');
// }

// const db = window.supabase.createClient(supabaseUrl, supabaseKey, {
//     global: {
//         fetch: (url, options) => fetchWithTimeout(url, options, 60000)
//     }
// });

setInterval(() => {
    const el = document.getElementById('buildBadge');
    if (!el) return;
    
    // Se o elemento estiver com display 'none' (oculto pela lógica do app.html em produção), não force a reexibição/atualização desnecessária de conteúdo.
    if (el.style.display === 'none') return;

    const d = window.__dpDebug || {};
    if (!d.enabled) {
        el.textContent = `build ${APP_BUILD}`;
        return;
    }
    const up = d.startedAt ? Math.floor((Date.now() - d.startedAt) / 1000) : 0;
    const step = d.lastStep ? ` | ${d.lastStep}` : '';
    const pend = Number.isFinite(d.pending) ? d.pending : 0;
    const len = (d.lastDataLen === null || d.lastDataLen === undefined) ? '' : ` | len ${d.lastDataLen}`;
    const rows = (d.lastRenderRows === null || d.lastRenderRows === undefined) ? '' : ` | rows ${d.lastRenderRows}`;
    const inLen = (d.lastRenderInputLen === null || d.lastRenderInputLen === undefined) ? '' : ` | in ${d.lastRenderInputLen}`;
    const first = d.lastFirstRow ? ` | first ${String(d.lastFirstRow).slice(0, 30)}` : '';
    const err = d.lastError ? ` | err ${String(d.lastError).slice(0, 60)}` : '';
    el.textContent = `build ${APP_BUILD} | up ${up}s | pending ${pend}${len}${inLen}${rows}${step}${first}${err}`;
}, 1000);

// let currentUser = null;
// let currentEmpresaId = null;
// let currentEmpresaHorarios = null;
// let currentUserRole = null; // Store user role globally
// let currentUserPerms = {}; // Granular permissions
// let isSuperAdmin = false; // System owner flag
// let requirePasswordChange = false;
// let privacyScreensaverTimerId = null;
// let privacyScreensaverBound = false;
// let privacyScreensaverAnimId = null;
// let privacyScreensaverPos = { x: 0, y: 0, vx: 0.065, vy: 0.045, lastT: 0 };

// MASTER CONFIG: Change this email to transfer SuperAdmin ownership
// const SUPER_ADMIN_EMAIL = 'lhbr@lhbr.com.br';

// let patients = [];
// let professionals = [];
// let specialties = [];
// let services = [];
// let budgets = [];
// let budgetsListRows = [];
// let activeEmpresasList = []; // Store companies list for admins
// let configPlanosList = [];
// let transactions = []; // Global transactions state
// let authCheckInFlight = false;
// let authSessionResolvePromise = null;
// let authBootResolved = false;
// let explicitLogoutRequested = false;
// let authInitialSessionSeen = false;
// let appUrlLocked = false;
// let lastValidSession = null;
// let bootStartedAt = 0;
// let bootPreferredTab = null;
// let bootRenderCompleted = false;
// let inventoryItems = [];
// let usageModels = [];
// let usageModelItems = [];
// let serviceModelMappings = [];
// let financialParamsCache = null;
// let financialParamsCostsRows = [];
// let financialParamsAutoRevenue12m = null;
// let financialOnboardingLocked = false;
// let professionalImpExceptionSignature = '';
let inventoryLogs = [];
let estoqueBindingsReady = false;
let estoqueActiveModelId = null;
let inventorySupportsEhConsumivel = null;
let inventoryEhConsumivelWarned = false;
let inventorySupportsCodigoBarras = null;
let inventorySearchTerm = '';
let inventorySearchTimer = null;
// let breakEvenRowsForPrint = [];
let inventoryAreaFilter = '';
let inventoryTypeFilter = '';
let inventoryShowLibraryFull = false;
let inventoryBuyOnly = false;
let inventorySupportsArea = null;
let inventorySupportsPrecoCusto = null;
let inventorySupportsUnidadeMedida = null;
let inventorySupportsFatorConversao = null;
let inventorySupportsTipoInventario = null;
let inventoryAreaOptions = [];
let inventoryAreaById = new Map();
let inventoryCurrentGridRows = [];
let inventoryReportStartDate = '';
let inventoryReportEndDate = '';
let inventoryCostHistoryRowsCurrent = [];
let inventoryBiReportType = 'accuracy';
let inventoryBiReportRowsCurrent = [];
let inventoryBiAccuracyPhysicalById = new Map();
// let serviceMappingSearchTerm = '';
// let serviceMappingStatusFilter = 'com_modelo';
// let serviceMappingCurrentRows = [];
// let assinaturaValidationInFlight = null;
// let fiscalIbgeCacheByUf = new Map();

function auditAuth(event, session) {
    void event;
    void session;
}

function setAuthCheckingUi(isChecking) {
    auditAuth('setAuthCheckingUi', { isChecking });
    const bootLoader = document.getElementById('bootLoader');
    const loginView = document.getElementById('loginView');
    const appContainer = document.getElementById('appContainer');
    const btnLogin = document.getElementById('btnLogin');
    const loginError = document.getElementById('loginError');
    if (isChecking) {
        if (bootLoader) bootLoader.style.display = 'flex';
        if (loginView) loginView.style.display = 'none';
        if (appContainer) appContainer.style.display = 'none';
        if (btnLogin) btnLogin.disabled = true;
        if (loginError) {
            loginError.textContent = 'Verificando sessão...';
            loginError.style.display = 'none';
            loginError.style.color = 'var(--text-muted)';
        }
        return;
    }
    if (bootLoader) bootLoader.style.display = 'none';
    if (btnLogin) btnLogin.disabled = false;
    if (loginError && String(loginError.textContent || '').trim() === 'Verificando sessão...') {
        loginError.style.display = 'none';
        loginError.style.color = '#dc3545';
    }
}

function hasBootDataContext() {
    const hasUser = !!(currentUser && currentUser.id);
    const hasEmpresa = !!String(currentEmpresaId || '').trim();
    return hasUser && hasEmpresa;
}

function isValidSession(session) {
    return !!(session && typeof session === 'object' && session.user && typeof session.user === 'object' && session.user.id);
}

function shouldBlockLoginUiByBootWindow() {
    if (!bootStartedAt) return false;
    return (Date.now() - bootStartedAt) < 4000;
}

function getSafeSavedTab() {
    const allowed = new Set([
        'dashboard', 'patients', 'professionals', 'specialties', 'services', 'budgets',
        'usersAdmin', 'empresas', 'assinaturas', 'myCompany', 'financeiro', 'commissions',
        'marketing', 'atendimento', 'agenda', 'protese', 'cancelledBudgets',
        'stockInventory', 'stockModels', 'stockMapping', 'stockLogs', 'stockReports',
        'patientPortal'
    ]);
    const saved = String(sessionStorage.getItem('lastTab') || '').trim();
    return allowed.has(saved) ? saved : 'dashboard';
}

function showLoginUi() {
    const bootLoader = document.getElementById('bootLoader');
    const loginView = document.getElementById('loginView');
    const appContainer = document.getElementById('appContainer');
    if (bootLoader) bootLoader.style.display = 'none';
    if (loginView) loginView.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function showAppUi() {
    const bootLoader = document.getElementById('bootLoader');
    const loginView = document.getElementById('loginView');
    const appContainer = document.getElementById('appContainer');
    if (bootLoader) bootLoader.style.display = 'none';
    if (loginView) loginView.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
}

function normalizeAssinaturaStatus(raw) {
    const k = normalizeKey(raw || '');
    if (k === 'ATIVO' || k === 'ATIVA') return 'ATIVO';
    if (k === 'PENDENTE') return 'PENDENTE';
    if (k === 'EXPIRADO' || k === 'EXPIRADA') return 'EXPIRADO';
    if (k === 'TRIAL') return 'TRIAL';
    return k || 'TRIAL';
}

function isAssinaturaIrregular(empresaRow) {
    const statusKey = normalizeAssinaturaStatus(empresaRow && empresaRow.assinatura_status);
    if (statusKey === 'PENDENTE' || statusKey === 'EXPIRADO') return true;
    const vencRaw = empresaRow && empresaRow.data_vencimento ? String(empresaRow.data_vencimento).slice(0, 10) : '';
    if (!vencRaw) return false;
    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return todayYmd > vencRaw;
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

async function handleSubscriptionForbiddenResponse(errOrResponse, label = '') {
    const e = errOrResponse && errOrResponse.error ? errOrResponse.error : errOrResponse;
    const status = Number(e && (e.status || e.statusCode || e.code) || 0);
    if (status !== 403) return false;
    const msg = 'Assinatura irregular detectada pelo servidor. Sua sessão foi encerrada.';
    await forceLogoutBySubscription(msg);
    console.warn('403 assinatura interceptado em', label || 'requisição');
    return true;
}

function executarNavegacaoInicial() {
    const targetTab = bootPreferredTab || getSafeSavedTab();
    setActiveTab(targetTab);
    showAppUi();
}

function lockAppUrl() {
    try {
        if (appUrlLocked) return;
        const target = '/app.html';
        if (window.location.pathname !== target) {
            window.history.replaceState(null, '', target + window.location.search + window.location.hash);
        }
        appUrlLocked = true;
    } catch { }
}

async function waitForResolvedSession() {
    auditAuth('waitForResolvedSession:start', null);
    if (authSessionResolvePromise) return authSessionResolvePromise;
    authSessionResolvePromise = new Promise((resolve) => {
        let done = false;
        let gotAuthEvent = false;
        let subRef = null;
        const finish = (session) => {
            if (done) return;
            if (session === undefined) return;
            if (session !== null && !isValidSession(session)) return;
            done = true;
            authBootResolved = true;
            auditAuth('waitForResolvedSession:finish', session);
            if (isValidSession(session)) lastValidSession = session;
            try {
                if (subRef && subRef.subscription && typeof subRef.subscription.unsubscribe === 'function') {
                    subRef.subscription.unsubscribe();
                }
            } catch { }
            resolve(session);
        };

        try {
            const ret = db.auth.onAuthStateChange((event, session) => {
                auditAuth(`waitForResolvedSession:onAuthStateChange:${event}`, session);
                if (event === 'INITIAL_SESSION') {
                    authInitialSessionSeen = true;
                    gotAuthEvent = true;
                    if (session === null || isValidSession(session)) finish(session);
                    return;
                }
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                    if (isValidSession(session)) {
                        gotAuthEvent = true;
                        finish(session);
                    } else if (authInitialSessionSeen && session === null) {
                        gotAuthEvent = true;
                        finish(null);
                    }
                }
            });
            subRef = ret && ret.data ? ret.data : ret;
        } catch { }

        const startedAt = Date.now();
        const poll = async () => {
            if (done) return;
            try {
                const { data: { session } } = await db.auth.getSession();
                if (isValidSession(session)) {
                    finish(session);
                    return;
                }
                if (authInitialSessionSeen && gotAuthEvent && session === null) {
                    finish(null);
                    return;
                }
            } catch { }
            if ((Date.now() - startedAt) < 45000) {
                setTimeout(poll, 250);
                return;
            }
            finish(null);
        };
        poll();
    });
    return authSessionResolvePromise;
}

function normalizeRole(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return '';
    const r = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/(^adm$|^admin$|^admim$|administrador|administrator)/.test(r)) return 'admin';
    if (/(^dono$|^owner$|^gestor$)/.test(r)) return 'admin';
    if (/(dentista|especialista)/.test(r)) return 'dentista';
    if (/(protetico|lab|laboratorio)/.test(r)) return 'protetico';
    if (/(recepcao|recepcao|recepcionista)/.test(r)) return 'recepcao';
    if (/auxiliar/.test(r)) return 'auxiliar';
    if (/(paciente|patient)/.test(r)) return 'paciente';
    return r;
}

function isAdminRole() {
    return normalizeRole(currentUserRole) === 'admin';
}

function isDentistRole() {
    return normalizeRole(currentUserRole) === 'dentista';
}

function isReceptionRole() {
    return normalizeRole(currentUserRole) === 'recepcao';
}

function isAuxRole() {
    return normalizeRole(currentUserRole) === 'auxiliar';
}

function isPatientRole() {
    return normalizeRole(currentUserRole) === 'paciente';
}

function getPostLoginDefaultTab() {
    if (isSuperAdmin || isAdminRole()) return 'dashboard';
    if (isPatientRole()) return 'patientPortal';
    if (isReceptionRole() || isAuxRole()) return 'agenda';
    return '';
}

function isOnboardingStockEmpty() {
    const hasServices = Array.isArray(services) && services.length > 0;
    const hasInv = Array.isArray(inventoryItems) && inventoryItems.length > 0;
    const hasModels = Array.isArray(usageModels) && usageModels.length > 0;
    return !hasServices && !hasInv && !hasModels;
}

function hasPermission(key) {
    if (isSuperAdmin || isAdminRole()) return true;
    const k = String(key || '').trim();
    if (!k) return false;
    const v = currentUserPerms ? currentUserPerms[k] : null;
    if (typeof v === 'boolean') return v;
    if (v && typeof v === 'object') return !!(v.select || v.insert || v.update || v.delete);
    return false;
}

function canAccessStockTab(tab) {
    if (isSuperAdmin || isAdminRole() || hasPermission('estoque_admin')) return true;
    const t = String(tab || '');
    if (isDentistRole()) return t === 'stockInventory' || t === 'stockLogs' || t === 'stockReports';
    if (isReceptionRole()) return t === 'stockInventory' || t === 'stockReports';
    if (t === 'stockReports') return can('estoque_relatorios', 'select') || can('estoque_inventario', 'select');
    return can(getModuleKey(t), 'select');
}

function canStockAction(area, action, ctx = null) {
    if (isSuperAdmin || isAdminRole() || hasPermission('estoque_admin')) return true;
    const a = String(area || '');
    const act = String(action || 'select');
    if (isDentistRole()) {
        if (a === 'inventory') return act === 'select';
        if (a === 'models' || a === 'mapping') return false;
        if (a === 'logs') {
            if (act === 'select') return true;
            if (act === 'estorno') {
                const row = ctx || null;
                if (!row) return false;
                const isOwner = String(row.responsavel_id || '') === String(currentUser && currentUser.id || '');
                const created = row && row.data_hora ? new Date(row.data_hora) : null;
                const withinWindow = created && Number.isFinite(created.getTime()) ? ((Date.now() - created.getTime()) <= (4 * 60 * 60 * 1000)) : false;
                return isOwner && withinWindow;
            }
            return false;
        }
    }
    if (isReceptionRole()) {
        if (a === 'inventory') return act === 'select';
        return false;
    }
    const modByArea = {
        'inventory': 'estoque_inventario',
        'models': 'estoque_modelos',
        'mapping': 'estoque_vinculos',
        'logs': 'estoque_movimentacoes'
    };
    return can(modByArea[a] || a, act);
}

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

function setupAdminManualOCC() {
    const btn = document.getElementById('btnAdminManualOCC');
    const overlay = document.getElementById('adminManualOverlay');
    const btnClose = document.getElementById('btnCloseAdminManualOCC');
    if (!btn || !overlay) return;

    const open = () => {
        overlay.classList.remove('hidden');
        const focusable = overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable && typeof focusable.focus === 'function') focusable.focus();
    };
    const close = () => {
        overlay.classList.add('hidden');
        try { btn.focus(); } catch { }
    };

    if (btnClose) btnClose.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
    });

    if (isAdminRole()) {
        btn.style.display = 'inline-flex';
        btn.addEventListener('click', open);
    } else {
        btn.style.display = 'none';
    }
}

function getBudgetLockInfo(budget) {
    const status = String(budget && budget.status || '').trim();
    const createdAt = budget && budget.created_at ? Date.parse(budget.created_at) : NaN;
    const totalPago = Number(budget && budget.total_pago != null ? budget.total_pago : 0) || 0;
    const hasPaymentLinked = totalPago > 0;
    const now = Date.now();
    const within4h = Number.isFinite(createdAt) ? (now - createdAt) <= (4 * 60 * 60 * 1000) : false;

    const norm = status.toLowerCase();
    const isApproved = norm === 'aprovado';
    const isExecuted = norm === 'executado';
    const isLockedByStatus = isApproved || isExecuted;
    const isLockedByTime = !within4h;
    const isDentistAllowed = status.toLowerCase() === 'pendente' && within4h && !hasPaymentLinked;

    return {
        status,
        within4h,
        hasPaymentLinked,
        isApproved,
        isExecuted,
        isLockedByStatus,
        isLockedByTime,
        isDentistAllowed,
    };
}

function canMutateBudget(budget, action = 'update') {
    const info = getBudgetLockInfo(budget);
    if (info.isExecuted) return false;
    if (isSuperAdmin || isAdminRole()) return true;
    if (!isDentistRole()) return can('orcamentos', action);
    return info.isDentistAllowed;
}


async function loadCurrentEmpresaHorarios() {
    if (!currentEmpresaId) return;
    try {
        const { data, error } = await db.from('empresas').select('*').eq('id', currentEmpresaId).maybeSingle();
        
        // Fallback para o cache da memória caso o Supabase não retorne as colunas novas imediatamente
        const empCache = (typeof activeEmpresasList !== 'undefined' ? activeEmpresasList : []).find(e => String(e.id) === String(currentEmpresaId)) || {};

        if (data || empCache.id) {
            const source = data || empCache;
            currentEmpresaHorarios = {
                inicio_semana: source.horario_inicio_semana || empCache.horario_inicio_semana || '08:00',
                fim_semana: source.horario_fim_semana || empCache.horario_fim_semana || '20:30',
                inicio_sabado: source.horario_inicio_sabado || empCache.horario_inicio_sabado || '08:30',
                fim_sabado: source.horario_fim_sabado || empCache.horario_fim_sabado || '14:00',
                domingo_fechado: source.domingo_fechado !== undefined ? source.domingo_fechado : (empCache.domingo_fechado !== undefined ? empCache.domingo_fechado : true)
            };
            console.log('--- Horários da Empresa Carregados ---', currentEmpresaHorarios);
        } else {
            currentEmpresaHorarios = getDefaultHorarios();
            console.log('--- Horários da Empresa (DEFAULT) ---', currentEmpresaHorarios);
        }
    } catch(err) {
        console.error("Erro ao carregar horarios da empresa", err);
        currentEmpresaHorarios = getDefaultHorarios();
    }
}

function getDefaultHorarios() {
    return {
        inicio_semana: '08:00',
        fim_semana: '20:30',
        inicio_sabado: '08:30',
        fim_sabado: '14:00',
        domingo_fechado: true
    };
}

async function checkAuth(sessionOverride) {
    auditAuth('checkAuth:start', sessionOverride === undefined ? null : sessionOverride);
    let session = isValidSession(sessionOverride) ? sessionOverride : null;
    if (!session) session = await waitForResolvedSession();
    if (!isValidSession(session) && isValidSession(lastValidSession)) session = lastValidSession;
    auditAuth('checkAuth:session', session);
    if (!isValidSession(session)) return false;
    lastValidSession = session;

    currentUser = session.user;
    isSuperAdmin = (currentUser.email === SUPER_ADMIN_EMAIL);
    const savedEmpId = localStorage.getItem('lastEmpresaId');

    const { data: mappingsRaw, error } = await db.from('usuario_empresas')
        .select('*, empresas(nome)')
        .eq('usuario_id', currentUser.id)
        .order('created_at', { ascending: true });

    let mappings = mappingsRaw || [];
    if (error) {
        console.error("Database error in checkAuth mapping search:", error);
        auditAuth('checkAuth:mappingError', { code: error.code, message: error.message });
        if (isSuperAdmin) {
            mappings = [];
            currentEmpresaId = String(savedEmpId || 'emp_master').trim() || 'emp_master';
            currentUserRole = 'admin';
            currentUserPerms = {};
            requirePasswordChange = false;
            console.log("DEBUG: SuperAdmin Logged in via fallback (mapping query failed)");
        } else {
            showToast(`Falha ao acessar a tabela de permissões (usuario_empresas). Isso geralmente é bloqueio de RLS/policy. Código: ${error.code || '-'} / ${error.message || 'Erro desconhecido'}`, true);
            return false;
        }
    }

    let mapping = null;
    if (mappings && mappings.length > 0) {
        if (isSuperAdmin && savedEmpId && mappings.some(m => m.empresa_id === savedEmpId)) {
            mapping = mappings.find(m => m.empresa_id === savedEmpId) || mappings[0];
        } else {
            if (mappings.length === 1) {
                mapping = mappings[0];
            } else {
                const adminMappings = mappings.filter(m => normalizeRole(m.perfil) === 'admin');
                if (adminMappings.length === 1) {
                    mapping = adminMappings[0];
                } else if (adminMappings.length > 1) {
                    mapping = adminMappings.find(m => m.empresa_id === 'emp_dp') || adminMappings[0];
                } else {
                    mapping = mappings.find(m => m.empresa_id === 'emp_dp') || mappings[0];
                }
            }
        }
    }

    if (!mapping) {
        if (isSuperAdmin) {
            currentEmpresaId = savedEmpId || 'emp_master';
            currentUserRole = 'admin';
            currentUserPerms = {};
            requirePasswordChange = false;
            console.log("DEBUG: SuperAdmin Logged in via fallback (no mapping found)");
        } else {
            console.warn("User record not found in clinician mapping (usuario_empresas). User ID:", currentUser.id, "Email:", currentUser.email);
            showToast("Sua conta não possui vínculo com nenhuma clínica ativa. Contate o suporte.", true);
            return false;
        }
    } else {
        currentEmpresaId = (isSuperAdmin && savedEmpId) ? String(savedEmpId) : mapping.empresa_id;
        currentUserRole = normalizeRole(mapping.perfil);
        currentUserPerms = (typeof mapping.permissoes === 'string') ? JSON.parse(mapping.permissoes) : (mapping.permissoes || {});
        requirePasswordChange = (mapping.require_password_change === true || String(mapping.require_password_change).toLowerCase() === 'true');
    }

    localStorage.setItem('lastEmpresaId', String(currentEmpresaId || ''));
    localStorage.setItem('lastUserRole', String(currentUserRole || ''));

    console.log("DEBUG Auth Info:", { currentEmpresaId, currentUserRole, currentUserPerms, isSuperAdmin });
    
    await loadCurrentEmpresaHorarios();
    
    const forcedTab = getPostLoginDefaultTab();
    if (forcedTab) bootPreferredTab = forcedTab;

    const switcherSection = document.getElementById('navEmpresaContextSection');
    const switcherContainer = document.getElementById('companySwitcherContainer');
    const switcher = document.getElementById('companySwitcher');

    if (!isSuperAdmin) {
        localStorage.removeItem('lastEmpresaId');
        if (switcherSection) switcherSection.style.display = 'none';
        if (switcherContainer) switcherContainer.style.display = 'none';
    }

    if (isSuperAdmin) {
        const { data: allEmpresas } = await db.from('empresas').select('id, nome').order('nome');
        const empresasOptions = allEmpresas || [];
        if (switcher && empresasOptions) {
            switcher.innerHTML = empresasOptions.map(e =>
                `<option value="${e.id}" ${e.id === currentEmpresaId ? 'selected' : ''}>${e.nome}</option>`
            ).join('');

            if (switcherSection) switcherSection.style.display = 'block';
            if (switcherContainer) switcherContainer.style.display = 'block';

            switcher.onchange = (e) => switchCompany(e.target.value);
            if (!switcher.__occRefreshBound) {
                switcher.__occRefreshBound = true;
                const forceRefreshIfSingle = () => {
                    const val = String(switcher.value || '').trim();
                    if (!val) return;
                    const optionCount = Number((switcher.options && switcher.options.length) || 0);
                    if (optionCount !== 1) return;
                    switchCompany(val);
                };
                switcher.addEventListener('click', () => setTimeout(forceRefreshIfSingle, 0));
            }
        }
    }

    const uiName = document.getElementById('userNameDisplay');
    const uiRole = document.getElementById('userRoleDisplay');
    if (uiName) uiName.textContent = currentUser.email.split('@')[0];

    // UI Role display: if we switched company, find the name in the active list or fetch it
    if (uiRole) {
        let displayRole = currentUserRole;
        if (mapping && mapping.empresas) {
            uiRole.textContent = `${mapping.empresas.nome} [${currentEmpresaId}] (${displayRole})`;
        } else {
            uiRole.textContent = `Clínica [${currentEmpresaId}] (${displayRole})`;
        }
    }

    // Show Admin Menu if user is admin
    if (isAdminRole()) {
        const navConfigSection = document.getElementById('navConfigSection');
        const navEmpresas = document.getElementById('navEmpresas');
        const navAssinaturas = document.getElementById('navAssinaturas');
        const navUsersAdmin = document.getElementById('navUsersAdmin');

        if (navConfigSection) navConfigSection.style.display = 'block';

        if (navEmpresas) {
            navEmpresas.style.display = isSuperAdmin ? 'flex' : 'none';
        }
        if (navAssinaturas) {
            navAssinaturas.style.display = isSuperAdmin ? 'flex' : 'none';
        }

        if (navUsersAdmin) navUsersAdmin.style.display = 'flex';
    }

    // Aplica permissões RBAC para menus do usuário
    if (document.getElementById('navSuporteTickets')) {
        document.getElementById('navSuporteTickets').style.display = hasPermission('tickets') ? 'flex' : 'none';
    }
    if (document.getElementById('navChatPacientes')) {
        document.getElementById('navChatPacientes').style.display = hasPermission('chat_pacientes') ? 'flex' : 'none'; // Reusing tickets permission or default to flex
    }

    setupAdminManualOCC();

    return true;
}

// Global Context Switcher
async function switchCompany(newEmpId) {
    console.log("DEBUG: Switching company context to:", newEmpId);
    showToast("Alterando unidade...");
    currentEmpresaId = newEmpId;
    localStorage.setItem('lastEmpresaId', newEmpId);
    await loadCurrentEmpresaHorarios();

    const uiRole = document.getElementById('userRoleDisplay');
    if (uiRole) uiRole.textContent = `Unidade: ${newEmpId} (${currentUserRole || 'user'})`;

    // Clear current state
    patients = [];
    professionals = [];
    specialties = [];
    services = [];
    budgets = [];
    inventoryItems = [];
    usageModels = [];
    usageModelItems = [];
    serviceModelMappings = [];
    inventoryLogs = [];
    window.__estoqueLoadedEmpresa = null;

    // Reload App Data
    try {
        await initializeApp(true); // Flag to skip re-auth UI logic
        await loadEstoqueData(true);
        if (String(sessionStorage.getItem('lastTab') || '') === 'stockReports') {
            renderStockReports();
        }
        showToast("Unidade alterada com sucesso!");
    } catch (err) {
        console.error("Error switching company:", err);
        showToast("Erro ao alternar unidade.", true);
    }
}

// Map UI types to permission keys
function getModuleKey(type) {
    const map = {
        'dashboard': 'dashboard',
        'patients': 'pacientes',
        'professionals': 'profissionais',
        'specialties': 'especialidades',
        'services': 'servicos',
        'budgets': 'orcamentos',
        'financeiro': 'financeiro',
        'commissions': 'comissoes',
        'marketing': 'marketing',
        'atendimento': 'atendimento',
        'consultaAvaliacao': 'atendimento',
        'agenda': 'agenda',
        'protese': 'protese',
        'stockInventory': 'estoque_inventario',
        'stockModels': 'estoque_modelos',
        'stockMapping': 'estoque_vinculos',
        'stockLogs': 'estoque_movimentacoes',
        'stockReports': 'estoque_relatorios',
        'suporteTickets': 'tickets'
    };
    return map[type] || type;
}

// Global permission check helper
function can(mod, action) {
    if (isSuperAdmin) return true;

    if (mod === 'empresas') return false;
    // Admins have total access
    if (isAdminRole()) return true;

    // If it's a JSON object
    if (currentUserPerms && currentUserPerms[mod] && currentUserPerms[mod][action]) {
        return true;
    }

    // Default: if no permissions defined or explicitly false, block
    return false;
}

function isPasswordChangeEnforced() {
    return !!requirePasswordChange && !isSuperAdmin;
}

function showForcePasswordChangeModal() {
    const modal = document.getElementById('modalForcePasswordChange');
    if (!modal) return;
    modal.classList.remove('hidden');
    const pwd = document.getElementById('forceNewPassword');
    if (pwd) pwd.focus();
}

function bindForcePasswordChangeModal() {
    const btn = document.getElementById('btnForceChangePassword');
    if (!btn || btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener('click', async () => {
        const pwdEl = document.getElementById('forceNewPassword');
        const pwd2El = document.getElementById('forceNewPasswordConfirm');
        const newPwd = String(pwdEl && pwdEl.value || '').trim();
        const newPwd2 = String(pwd2El && pwd2El.value || '').trim();

        if (!newPwd || newPwd.length < 6) {
            showToast('A senha deve ter no mínimo 6 caracteres.', true);
            return;
        }
        if (newPwd !== newPwd2) {
            showToast('As senhas não conferem.', true);
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Salvando...';
        try {
            const { error: upErr } = await withTimeout(db.auth.updateUser({ password: newPwd }), 20000, 'auth:updateUser');
            if (upErr) throw upErr;

            const { error: flagErr } = await withTimeout(
                db.rpc('rpc_clear_password_change_flag', { p_empresa_id: String(currentEmpresaId || '') }),
                20000,
                'rpc_clear_password_change_flag'
            );
            if (flagErr) throw flagErr;

            requirePasswordChange = false;
            const modal = document.getElementById('modalForcePasswordChange');
            if (modal) modal.classList.add('hidden');
            if (pwdEl) pwdEl.value = '';
            if (pwd2El) pwd2El.value = '';
            showToast('Senha atualizada com sucesso!');
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            showToast(`Falha ao atualizar senha: ${msg}`, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ri-check-line"></i> Salvar Nova Senha';
        }
    });

    const btnLogout = document.getElementById('btnForceLogout');
    if (btnLogout && !btnLogout.__bound) {
        btnLogout.__bound = true;
        btnLogout.addEventListener('click', () => {
            const mainLogout = document.getElementById('btnLogout');
            if (mainLogout) mainLogout.click();
        });
    }
}

function bindCompanyPhoneMasks() {
    const pairs = [
        { id: 'empresaTelefone', mask: maskPhone },
        { id: 'empresaCelular', mask: maskCellphone },
        { id: 'myCompanyTelefone', mask: maskPhone },
        { id: 'myCompanyCelular', mask: maskCellphone }
    ];

    pairs.forEach(p => {
        const el = document.getElementById(p.id);
        if (!el || el.__maskBound) return;
        el.__maskBound = true;
        el.addEventListener('input', () => { el.value = p.mask(el.value); });
        el.addEventListener('blur', () => { el.value = p.mask(el.value); });
        el.value = p.mask(el.value);
    });
}

function clearPatientAddressFields() {
    const ids = ['occ_paciente_endereco', 'occ_paciente_bairro', 'occ_paciente_cidade', 'occ_paciente_numero', 'occ_paciente_complemento', 'occ_paciente_ibge'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const ufEl = document.getElementById('occ_paciente_uf');
    if (ufEl) ufEl.value = '';
}

function setPatientAddressLock(locked) {
    const elEndereco = document.getElementById('occ_paciente_endereco');
    const elBairro = document.getElementById('occ_paciente_bairro');
    const elCidade = document.getElementById('occ_paciente_cidade');
    const elUf = document.getElementById('occ_paciente_uf');
    if (elEndereco) elEndereco.readOnly = !!locked;
    if (elBairro) elBairro.readOnly = !!locked;
    if (elCidade) elCidade.readOnly = !!locked;
    if (elUf) elUf.disabled = !!locked;
}

function getPrivacyScreensaverBranding() {
    const emp = (activeEmpresasList || []).find(e => String(e && e.id || '') === String(currentEmpresaId || '')) || null;
    const nome = emp && emp.nome ? String(emp.nome) : (String(currentEmpresaId || '') ? `Clínica ${String(currentEmpresaId)}` : 'Clínica');
    const logo = emp && emp.logotipo ? String(emp.logotipo) : '';
    return { nome, logo };
}

function showPrivacyScreensaver() {
    const wrap = document.getElementById('privacyScreensaver');
    if (!wrap) return;
    if (document.getElementById('loginView') && document.getElementById('loginView').style.display !== 'none') return;
    const { nome, logo } = getPrivacyScreensaverBranding();
    const nameEl = document.getElementById('privacyScreensaverCompanyName');
    const logoEl = document.getElementById('privacyScreensaverLogo');
    const cardEl = document.getElementById('privacyScreensaverCard');
    if (nameEl) nameEl.textContent = nome || '—';
    if (logoEl) {
        if (logo) {
            logoEl.src = logo;
            logoEl.style.display = 'block';
        } else {
            logoEl.removeAttribute('src');
            logoEl.style.display = 'none';
        }
    }
    wrap.classList.remove('hidden');
    if (cardEl) startPrivacyScreensaverBouncing();
}

function hidePrivacyScreensaver() {
    const wrap = document.getElementById('privacyScreensaver');
    if (!wrap) return;
    wrap.classList.add('hidden');
    stopPrivacyScreensaverBouncing();
}

function startPrivacyScreensaverBouncing() {
    const overlay = document.getElementById('privacyScreensaver');
    const card = document.getElementById('privacyScreensaverCard');
    if (!overlay || !card) return;
    if (privacyScreensaverAnimId) return;

    const ow = overlay.clientWidth || window.innerWidth;
    const oh = overlay.clientHeight || window.innerHeight;
    const cw = card.offsetWidth || 560;
    const ch = card.offsetHeight || 240;

    const maxX = Math.max(0, ow - cw);
    const maxY = Math.max(0, oh - ch);

    const startX = Math.max(0, Math.min(maxX, Math.floor(maxX * 0.18)));
    const startY = Math.max(0, Math.min(maxY, Math.floor(maxY * 0.22)));

    privacyScreensaverPos.x = startX;
    privacyScreensaverPos.y = startY;
    privacyScreensaverPos.lastT = performance.now();

    const render = () => {
        card.style.transform = `translate3d(${Math.round(privacyScreensaverPos.x)}px, ${Math.round(privacyScreensaverPos.y)}px, 0)`;
    };

    const tick = (t) => {
        if (!overlay || overlay.classList.contains('hidden')) {
            stopPrivacyScreensaverBouncing();
            return;
        }

        const dt = Math.min(48, Math.max(8, t - (privacyScreensaverPos.lastT || t)));
        privacyScreensaverPos.lastT = t;

        const w = overlay.clientWidth || window.innerWidth;
        const h = overlay.clientHeight || window.innerHeight;
        const cW = card.offsetWidth || cw;
        const cH = card.offsetHeight || ch;

        const boundX = Math.max(0, w - cW);
        const boundY = Math.max(0, h - cH);

        privacyScreensaverPos.x += privacyScreensaverPos.vx * dt;
        privacyScreensaverPos.y += privacyScreensaverPos.vy * dt;

        if (privacyScreensaverPos.x <= 0) {
            privacyScreensaverPos.x = 0;
            privacyScreensaverPos.vx = Math.abs(privacyScreensaverPos.vx);
        } else if (privacyScreensaverPos.x >= boundX) {
            privacyScreensaverPos.x = boundX;
            privacyScreensaverPos.vx = -Math.abs(privacyScreensaverPos.vx);
        }

        if (privacyScreensaverPos.y <= 0) {
            privacyScreensaverPos.y = 0;
            privacyScreensaverPos.vy = Math.abs(privacyScreensaverPos.vy);
        } else if (privacyScreensaverPos.y >= boundY) {
            privacyScreensaverPos.y = boundY;
            privacyScreensaverPos.vy = -Math.abs(privacyScreensaverPos.vy);
        }

        render();
        privacyScreensaverAnimId = requestAnimationFrame(tick);
    };

    render();
    privacyScreensaverAnimId = requestAnimationFrame(tick);
}

function stopPrivacyScreensaverBouncing() {
    if (privacyScreensaverAnimId) {
        cancelAnimationFrame(privacyScreensaverAnimId);
        privacyScreensaverAnimId = null;
    }
}

function resetPrivacyScreensaverTimer() {
    if (privacyScreensaverTimerId) clearTimeout(privacyScreensaverTimerId);
    privacyScreensaverTimerId = setTimeout(async () => {
        const appContainer = document.getElementById('appContainer');
        if (!appContainer || appContainer.style.display === 'none') return;
        const ok = await validateAssinaturaStatusGate({ reason: 'screensaver' }).catch(() => true);
        if (!ok) return;
        showPrivacyScreensaver();
    }, 5 * 60 * 1000);
}

// let securityLogoutTimerId = null;

function resetSecurityLogoutTimer() {
    if (securityLogoutTimerId) clearTimeout(securityLogoutTimerId);
    securityLogoutTimerId = setTimeout(() => {
        console.warn("Inatividade de 30 minutos atingida. Bloqueando tela.");
        showLockScreen();
    }, 30 * 60 * 1000); // 30 minutos
}

async function showLockScreen() {
    if (document.getElementById('occLockScreen')) return;
    
    let empNome = 'OCC - Odonto Connect Cloud';
    let logoUrl = '';
    const userEmail = typeof currentUser !== 'undefined' && currentUser ? currentUser.email : '';

    // 1. Descobrir o ID da Empresa
    let empresaId = typeof currentEmpresaId !== 'undefined' ? currentEmpresaId : null;

    // Se não tiver, busca no sessionStorage onde já vimos que fica salvo como emp_431493663c
    if (!empresaId || empresaId === 'emp_master' || empresaId === 'emp_dp') {
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key.includes('emp_') && !key.includes('emp_master') && !key.includes('emp_dp')) {
                const partes = key.split(':');
                const idEncontrado = partes.length > 1 ? partes[1] : partes[0];
                if (idEncontrado && idEncontrado.startsWith('emp_')) {
                    empresaId = idEncontrado;
                    break;
                }
            }
        }
    }

    // 2. Buscar os dados REAIS no banco de dados na hora de exibir
    if (empresaId && empresaId !== 'emp_master' && empresaId !== 'emp_dp') {
        try {
            console.log("Buscando dados da empresa no banco. ID:", empresaId);
            const { data: empresa, error } = await db
                .from('empresas')
                .select('*')
                .eq('id', empresaId)
                .maybeSingle();

            if (empresa && !error) {
                empNome = empresa.nome || empNome;
                logoUrl = empresa.logotipo || empresa.logo || empresa.logotipo_url || empresa.logo_url || empresa.imagem_url || '';
                console.log("Dados reais da clínica recuperados:", empNome);
            } else {
                console.error("Erro ou empresa não encontrada no banco:", error);
            }
        } catch (err) {
            console.error("Exceção ao buscar dados da empresa:", err);
        }
    }

    const overlay = document.createElement('div');
    overlay.id = 'occLockScreen';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '999999';
    overlay.style.backgroundColor = '#f1f5f9';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.fontFamily = "'Inter', sans-serif";
    
    overlay.innerHTML = `
        <div style="width: 100%; max-width: 400px; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center;">
            
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height: 80px; max-width: 100%; object-fit: contain; margin-bottom: 20px; border-radius: 8px;">` : ''}
            
            <h2 style="margin: 0 0 24px 0; font-size: 22px; color: #0f172a; font-weight: 700;">${empNome}</h2>
            
            <div style="background-color: #fffbeb; color: #d97706; padding: 12px 16px; border-radius: 8px; font-size: 13px; text-align: left; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 24px; border: 1px solid #fef3c7;">
                <i class="ri-error-warning-fill" style="font-size: 18px; margin-top: -2px;"></i>
                <span style="line-height: 1.4;">👉 Deslogado por estar sem atividade há mais de 30 minutos. Favor efetuar o login novamente.</span>
            </div>

            <form id="occLockForm" style="display: flex; flex-direction: column; gap: 16px;">
                <div style="position: relative;">
                    <i class="ri-user-line" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 18px;"></i>
                    <input type="email" id="occLockUser" placeholder="Usuário / Email" value="${userEmail}" required style="width: 100%; padding: 12px 16px 12px 44px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; color: #334155; outline: none; transition: border-color 0.2s; box-sizing: border-box;">
                </div>
                
                <div style="position: relative;">
                    <i class="ri-lock-line" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 18px;"></i>
                    <input type="password" id="occLockPass" placeholder="Senha" required style="width: 100%; padding: 12px 44px 12px 44px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; color: #334155; outline: none; transition: border-color 0.2s; box-sizing: border-box;">
                    <i class="ri-eye-off-line" id="occLockEye" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 18px; cursor: pointer;"></i>
                </div>

                <button type="submit" id="occLockBtn" style="width: 100%; padding: 14px; background-color: #00c48c; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: background-color 0.2s; margin-top: 8px; box-shadow: 0 4px 10px rgba(0, 196, 140, 0.2);">
                    <i class="ri-login-box-line"></i> Entrar
                </button>
            </form>
            
        </div>
        
        <div style="margin-top: 24px; color: #64748b; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <i class="ri-shield-check-line" style="font-size: 15px;"></i>
            Tecnologia e cuidado para transformar sorrisos
        </div>
    `;

    document.body.appendChild(overlay);

    const form = document.getElementById('occLockForm');
    const eyeBtn = document.getElementById('occLockEye');
    const passInput = document.getElementById('occLockPass');
    const btnSubmit = document.getElementById('occLockBtn');

    eyeBtn.addEventListener('click', () => {
        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeBtn.className = 'ri-eye-line';
        } else {
            passInput.type = 'password';
            eyeBtn.className = 'ri-eye-off-line';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('occLockUser').value.trim();
        const password = passInput.value;
        if (!email || !password) return;

        btnSubmit.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Autenticando...';
        btnSubmit.disabled = true;

        try {
            const { data, error } = await db.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            // Força o recarregamento da página para restaurar toda a sessão, permissões e estado da aplicação com segurança!
            window.location.reload();
        } catch (err) {
            btnSubmit.innerHTML = '<i class="ri-login-box-line"></i> Entrar';
            btnSubmit.disabled = false;
            
            if (typeof showToast === 'function') {
                showToast('Credenciais inválidas. Tente novamente.', true);
            } else {
                alert('Credenciais inválidas. Tente novamente.');
            }
        }
    });
}

function initPrivacyScreensaver() {
    if (privacyScreensaverBound) return;
    privacyScreensaverBound = true;

    const activity = () => {
        hidePrivacyScreensaver();
        resetPrivacyScreensaverTimer();
        resetSecurityLogoutTimer();
    };

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, activity, { passive: true });
    });

    const overlay = document.getElementById('privacyScreensaver');
    if (overlay) overlay.addEventListener('click', activity);

    resetPrivacyScreensaverTimer();
    resetSecurityLogoutTimer();
}

function withTimeout(promiseLike, ms, label = '') {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const err = new Error(`Timeout ao consultar ${label || 'servidor'} (${ms}ms)`);
            err.code = 'TIMEOUT';
            err.label = label;
            reject(err);
        }, ms);
    });
    return Promise.race([Promise.resolve(promiseLike), timeoutPromise])
        .then(async (res) => {
            try { await handleSubscriptionForbiddenResponse(res, label); } catch { }
            return res;
        })
        .catch(async (err) => {
            try { await handleSubscriptionForbiddenResponse(err, label); } catch { }
            throw err;
        })
        .finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
        });
}

async function existsAnyRow(query, label) {
    const { data, error } = await withTimeout(query.limit(1), 15000, label);
    if (error) throw error;
    if (Array.isArray(data)) return data.length > 0;
    return !!data;
}

async function getPatientDeleteBlockers(patient) {
    const blocks = [];
    const patId = patient && patient.id ? String(patient.id) : '';
    const patSeq = patient && patient.seqid != null ? Number(patient.seqid) : NaN;

    if (patId) {
        const hasBudget = (budgets || []).some(b => String(b && (b.pacienteid || b.paciente_id) || '') === patId);
        if (hasBudget) blocks.push('Orçamentos');
        const hasProtese = (proteseOrders || []).some(o => String(o && o.paciente_id || '') === patId);
        if (hasProtese) blocks.push('Prótese');
        const hasEvo = await existsAnyRow(
            db.from('paciente_evolucao').select('id').eq('empresa_id', currentEmpresaId).eq('paciente_id', patId),
            'paciente_evolucao'
        );
        if (hasEvo) blocks.push('Prontuário');
        const hasDocs = await existsAnyRow(
            db.from('paciente_documentos').select('id').eq('empresa_id', currentEmpresaId).eq('paciente_id', patId),
            'paciente_documentos'
        );
        if (hasDocs) blocks.push('Documentos');
    }

    if (Number.isFinite(patSeq)) {
        const hasAgenda = await existsAnyRow(
            db.from('agenda_agendamentos').select('id').eq('empresa_id', currentEmpresaId).eq('paciente_id', patSeq),
            'agenda_agendamentos'
        );
        if (hasAgenda) blocks.push('Agenda');
    }

    return Array.from(new Set(blocks));
}

async function getProfessionalDeleteBlockers(prof) {
    const blocks = [];
    const profId = prof && prof.id ? String(prof.id) : '';
    const profSeq = prof && prof.seqid != null ? Number(prof.seqid) : NaN;

    if (Number.isFinite(profSeq)) {
        const usedInBudgetHeader = (budgets || []).some(b => Number(b && b.profissional_id) === profSeq);
        if (usedInBudgetHeader) blocks.push('Orçamentos');
        const usedInBudgetItemsLocal = (budgets || []).some(b => {
            const itens = (b && (b.orcamento_itens || b.itens)) || [];
            return Array.isArray(itens) && itens.some(it => Number(it && it.profissional_id) === profSeq || Number(it && it.protetico_id) === profSeq);
        });
        if (usedInBudgetItemsLocal) blocks.push('Itens de Orçamento');

        const hasAgenda = await existsAnyRow(
            db.from('agenda_agendamentos').select('id').eq('empresa_id', currentEmpresaId).eq('profissional_id', profSeq),
            'agenda_agendamentos:prof'
        );
        if (hasAgenda) blocks.push('Agenda');
        const hasItemsExec = await existsAnyRow(
            db.from('orcamento_itens').select('id').eq('empresa_id', currentEmpresaId).eq('profissional_id', profSeq),
            'orcamento_itens:prof'
        );
        if (hasItemsExec) blocks.push('Itens de Orçamento');
        const hasItemsProt = await existsAnyRow(
            db.from('orcamento_itens').select('id').eq('empresa_id', currentEmpresaId).eq('protetico_id', profSeq),
            'orcamento_itens:prot'
        );
        if (hasItemsProt) blocks.push('Itens de Orçamento');
    }

    if (profId) {
        const hasProtese = (proteseOrders || []).some(o => String(o && o.protetico_id || '') === profId);
        if (hasProtese) blocks.push('Prótese');
        const hasProteseDb = await existsAnyRow(
            db.from('ordens_proteticas').select('id').eq('empresa_id', currentEmpresaId).eq('protetico_id', profId),
            'ordens_proteticas'
        );
        if (hasProteseDb) blocks.push('Prótese');
        const hasEvo = await existsAnyRow(
            db.from('paciente_evolucao').select('id').eq('empresa_id', currentEmpresaId).eq('profissional_id', profId),
            'paciente_evolucao:prof'
        );
        if (hasEvo) blocks.push('Prontuário');
    }

    return Array.from(new Set(blocks));
}

async function getServiceDeleteBlockers(service) {
    const blocks = [];
    const servId = service && service.id ? String(service.id) : '';
    if (!servId) return blocks;

    const usedLocal = (budgets || []).some(b => {
        const itens = (b && (b.orcamento_itens || b.itens)) || [];
        return Array.isArray(itens) && itens.some(it => String(it && (it.servico_id || it.servicoId) || '') === servId);
    });
    if (usedLocal) blocks.push('Orçamentos');

    const hasItems = await existsAnyRow(
        db.from('orcamento_itens').select('id').eq('empresa_id', currentEmpresaId).eq('servico_id', servId),
        'orcamento_itens:servico'
    );
    if (hasItems) blocks.push('Orçamentos');

    return Array.from(new Set(blocks));
}

function isMissingEmbeddedRelationshipError(err) {
    const code = err && err.code ? String(err.code) : '';
    const msg = err && err.message ? String(err.message) : '';
    return code === 'PGRST200'
        || code === 'PGRST201'
        || /could not find a relationship between/i.test(msg)
        || /no relationship/i.test(msg);
}

// const _loadTimers = {};
function armLoadTimer(key, ms, onTimeout) {
    if (_loadTimers[key]) clearTimeout(_loadTimers[key]);
    _loadTimers[key] = setTimeout(() => {
        _loadTimers[key] = null;
        onTimeout();
    }, ms);
}
function clearLoadTimer(key) {
    if (_loadTimers[key]) clearTimeout(_loadTimers[key]);
    _loadTimers[key] = null;
}

function openSuperAdminModal(presetScope = '') {
    if (!isSuperAdmin || !modalSuperAdmin) {
        showToast('Acesso restrito ao SuperAdmin.', true);
        return;
    }
    if (!modalSuperAdmin.dataset.bound) {
        if (btnCloseModalSuperAdmin) btnCloseModalSuperAdmin.addEventListener('click', () => modalSuperAdmin.classList.add('hidden'));
        if (btnSuperAdminClose) btnSuperAdminClose.addEventListener('click', () => modalSuperAdmin.classList.add('hidden'));
        modalSuperAdmin.addEventListener('click', (e) => { if (e.target === modalSuperAdmin) modalSuperAdmin.classList.add('hidden'); });
        modalSuperAdmin.dataset.bound = '1';
    }
    initSuperAdminCleanupUI();
    refreshSaEmpresaOptions({ keepSelection: true });
    if (presetScope && saScope) {
        saScope.value = presetScope;
        handleSaScopeChange();
    }
    modalSuperAdmin.classList.remove('hidden');
}

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
        db.from('servicos').select('id,descricao,subdivisao,subdivisao_id,ie,tipo_calculo,exige_elemento,seqid,codigo_servico,valor').eq('empresa_id', empresaId),
        20000,
        'srvImport:servicos'
    );
    if (error) { showToast('Falha ao carregar serviços.', true); return; }
    const { data: allSubs, error: subErr } = await withTimeout(
        db.from('especialidade_subdivisoes').select('id,nome').eq('empresa_id', empresaId),
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
                    db.from('servicos').update(upd).eq('id', found.id),
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
            db.from('servicos').insert(ins),
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
        db.from('servicos')
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

async function openSpecialtyImportModal() {
    if (!isSuperAdmin || !specialtyImportModal) {
        showToast('Apenas SuperAdmin pode importar especialidades.', true);
        return;
    }
    if (!specialtyImportModal.dataset.bound) {
        if (btnCloseSpecialtyImportModal) btnCloseSpecialtyImportModal.addEventListener('click', () => specialtyImportModal.classList.add('hidden'));
        if (btnCancelSpecialtyImport) btnCancelSpecialtyImport.addEventListener('click', () => specialtyImportModal.classList.add('hidden'));
        specialtyImportModal.addEventListener('click', (e) => { if (e.target === specialtyImportModal) specialtyImportModal.classList.add('hidden'); });
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

async function readXlsxToRowArrays(file) {
    if (!file) return [];
    if (!window.XLSX) throw new Error('Biblioteca XLSX não encontrada.');
    const buf = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
        reader.onload = () => resolve(reader.result);
        reader.readAsArrayBuffer(file);
    });
    const wb = window.XLSX.read(buf, { type: 'array' });
    const firstName = wb && wb.SheetNames && wb.SheetNames[0] ? wb.SheetNames[0] : null;
    if (!firstName) return [];
    const ws = wb.Sheets[firstName];
    const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    return Array.isArray(rows) ? rows : [];
}

function parseOneColumnRows(rows, skipHeader) {
    const dataRows = skipHeader ? rows.slice(1) : rows.slice();
    const parsed = [];
    dataRows.forEach(r => {
        const arr = Array.isArray(r) ? r : [];
        const value = String(arr[0] ?? '').trim().toUpperCase();
        if (!value) return;
        parsed.push(value);
    });
    return parsed;
}

function parseImportValues(rows, skipHeader, preferredHeaders) {
    const allRows = Array.isArray(rows) ? rows : [];
    const headers = skipHeader ? (Array.isArray(allRows[0]) ? allRows[0] : []) : [];
    const norm = (v) => String(v || '').trim().toLowerCase();
    const normalizedHeaders = headers.map(norm);
    let colIndex = 0;
    if (skipHeader && Array.isArray(preferredHeaders) && preferredHeaders.length) {
        const idx = preferredHeaders
            .map(h => normalizedHeaders.indexOf(norm(h)))
            .find(i => i >= 0);
        if (Number.isInteger(idx) && idx >= 0) colIndex = idx;
    }
    const dataRows = skipHeader ? allRows.slice(1) : allRows.slice();
    const parsed = [];
    dataRows.forEach(r => {
        const arr = Array.isArray(r) ? r : [];
        const value = String(arr[colIndex] ?? '').trim().toUpperCase();
        if (!value) return;
        parsed.push(value);
    });
    return parsed;
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

function extractSubdivisionMajorCode(text) {
    const s = String(text || '').trim();
    const m = s.match(/^[^\d]*(\d+)(?:\.\d+)?\s*[-.)]?\s*/);
    return m ? String(m[1]) : '';
}

function exportRowsToXlsx(rows, sheetName, fileName) {
    if (!window.XLSX) {
        showToast('Biblioteca XLSX não encontrada.', true);
        return;
    }
    const list = Array.isArray(rows) ? rows : [];
    const ws = window.XLSX.utils.json_to_sheet(list);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, String(sheetName || 'Dados'));
    window.XLSX.writeFile(wb, String(fileName || 'export.xlsx'));
}

async function exportSpecialtiesXlsx() {
    if (!isSuperAdmin) { showToast('Apenas SuperAdmin.', true); return; }
    const empresaId = getEffectiveImportEmpresaId();
    if (!empresaId) { showToast('Empresa inválida.', true); return; }
    const { data, error } = await withTimeout(
        db.from('especialidades')
            .select('id,seqid,nome,empresa_id')
            .eq('empresa_id', empresaId)
            .order('seqid', { ascending: true }),
        20000,
        'export:especialidades'
    );
    if (error) { showToast('Falha ao exportar especialidades.', true); return; }
    const rows = (data || []).map(s => ({
        seqid: Number(s && s.seqid || 0),
        nome: String(s && s.nome || '')
    }));
    exportRowsToXlsx(rows, 'Especialidades', `especialidades_${empresaId}.xlsx`);
    showToast('Exportação de especialidades concluída.');
}

async function exportSubdivisionsXlsx() {
    if (!isSuperAdmin) { showToast('Apenas SuperAdmin.', true); return; }
    const empresaId = getEffectiveImportEmpresaId();
    if (!empresaId) { showToast('Empresa inválida.', true); return; }
    const { data: specs, error: specErr } = await withTimeout(
        db.from('especialidades')
            .select('id,seqid,nome,empresa_id')
            .eq('empresa_id', empresaId),
        20000,
        'export:subdivisoes_specs'
    );
    if (specErr) { showToast('Falha ao exportar subdivisões.', true); return; }
    const bySpecId = new Map((specs || []).map(s => [String(s && s.id || ''), s]));
    const { data, error } = await withTimeout(
        db.from('especialidade_subdivisoes')
            .select('id,especialidade_id,nome,empresa_id')
            .eq('empresa_id', empresaId),
        20000,
        'export:subdivisoes'
    );
    if (error) { showToast('Falha ao exportar subdivisões.', true); return; }
    const rows = (data || []).map(sub => {
        const spec = bySpecId.get(String(sub && sub.especialidade_id || '')) || null;
        return {
            especialidade_seqid: spec ? Number(spec.seqid || 0) : null,
            especialidade_nome: spec ? String(spec.nome || '') : '',
            nome: String(sub && sub.nome || '')
        };
    });
    exportRowsToXlsx(rows, 'Subdivisoes', `subdivisoes_${empresaId}.xlsx`);
    showToast('Exportação de subdivisões concluída.');
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
            specialtyImportPreviewBody.innerHTML = preview || '<tr><td style="text-align:center; padding: 14px; color:#6b7280;">Nenhuma linha válida.</td></tr>';
        }
        if (specialtyImportPreviewWrap) specialtyImportPreviewWrap.classList.remove('hidden');
        if (btnConfirmSpecialtyImport) btnConfirmSpecialtyImport.disabled = parsed.length === 0;
        if (specialtyImportStatus) {
            specialtyImportStatus.textContent = [
                `Linhas válidas: ${parsed.length}`,
                `Especialidades (únicas): ${uniqSpecs.size}`,
                'Coluna usada: nome (ou coluna A)'
            ].join('\n');
        }
    } catch (e) {
        const msg = e && e.message ? String(e.message) : 'Erro ao ler XLSX.';
        if (specialtyImportStatus) specialtyImportStatus.textContent = msg;
        showToast(msg, true);
    }
}

async function parseSubdivisionImportFile() {
    try {
        if (!subdivisionImportFile || !subdivisionImportFile.files || !subdivisionImportFile.files[0]) {
            showToast('Selecione um arquivo XLSX de subdivisões.', true);
            return;
        }
        const file = subdivisionImportFile.files[0];
        if (subdivisionImportStatus) subdivisionImportStatus.textContent = 'Lendo arquivo...';
        const rows = await readXlsxToRowArrays(file);
        const skipHeader = subdivisionImportSkipHeader ? Boolean(subdivisionImportSkipHeader.checked) : true;
        const parsed = parseImportValues(rows, skipHeader, ['nome', 'subdivisao', 'subdivisão']);
        const uniq = new Set(parsed);
        window.__subdivisionImportRows = parsed;

        if (subdivisionImportPreviewBody) {
            const preview = parsed.slice(0, 200).map(x => `<tr><td>${escapeHtml(x)}</td></tr>`).join('');
            subdivisionImportPreviewBody.innerHTML = preview || '<tr><td style="text-align:center; padding: 14px; color:#6b7280;">Nenhuma linha válida.</td></tr>';
        }
        if (subdivisionImportPreviewWrap) subdivisionImportPreviewWrap.classList.remove('hidden');
        if (btnConfirmSubdivisionImport) btnConfirmSubdivisionImport.disabled = parsed.length === 0;
        if (subdivisionImportStatus) {
            subdivisionImportStatus.textContent = [
                `Linhas válidas: ${parsed.length}`,
                `Subdivisões (únicas): ${uniq.size}`,
                'Vínculo automático por código: 1.x -> Especialidade 1'
            ].join('\n');
        }
    } catch (e) {
        const msg = e && e.message ? String(e.message) : 'Erro ao ler XLSX.';
        if (subdivisionImportStatus) subdivisionImportStatus.textContent = msg;
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
        specialtyImportStatus.textContent = [
            `Especialidades criadas: ${createdSpecs}`,
            `Duplicados ignorados: ${skipped}`
        ].join('\n');
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

async function confirmSubdivisionImport() {
    if (!isSuperAdmin) { showToast('Apenas SuperAdmin.', true); return; }
    let parsed = Array.isArray(window.__subdivisionImportRows) ? window.__subdivisionImportRows : [];
    if (!parsed.length && subdivisionImportFile && subdivisionImportFile.files && subdivisionImportFile.files[0]) {
        await parseSubdivisionImportFile();
        parsed = Array.isArray(window.__subdivisionImportRows) ? window.__subdivisionImportRows : [];
    }
    if (!parsed.length) { showToast('Nenhuma subdivisão para importar.', true); return; }
    const empresaId = getEffectiveImportEmpresaId();
    if (!empresaId) { showToast('Empresa inválida.', true); return; }

    const { data: specs, error: specErr } = await withTimeout(
        db.from('especialidades')
            .select('id,nome,seqid')
            .eq('empresa_id', empresaId),
        20000,
        'subImport:load_specs'
    );
    if (specErr) { showToast('Falha ao carregar especialidades.', true); return; }
    const specMap = new Map();
    (specs || []).forEach(s => {
        const codeFromName = extractLeadingSpecialtyCode(s && s.nome);
        const codeFromSeq = Number.isFinite(Number(s && s.seqid)) ? String(Number(s.seqid)) : '';
        const sid = String(s && s.id || '');
        if (codeFromName && sid && !specMap.has(codeFromName)) specMap.set(codeFromName, sid);
        if (codeFromSeq && sid && !specMap.has(codeFromSeq)) specMap.set(codeFromSeq, sid);
    });
    if (!specMap.size) {
        showToast('Nenhuma especialidade com código (ex: 1 - ...) encontrada.', true);
        return;
    }

    if (subdivisionImportStatus) subdivisionImportStatus.textContent = 'Carregando subdivisões atuais...';
    const { data: existingSubs, error: subErr } = await withTimeout(
        db.from('especialidade_subdivisoes')
            .select('nome,especialidade_id')
            .eq('empresa_id', empresaId)
            .in('especialidade_id', Array.from(specMap.values())),
        20000,
        'subImport:load'
    );
    if (subErr) { showToast('Falha ao carregar subdivisões.', true); return; }

    const existingBySpec = new Map();
    (existingSubs || []).forEach(r => {
        const sid = String(r && r.especialidade_id || '');
        const nk = String(r && r.nome || '').trim().toUpperCase();
        if (!sid || !nk) return;
        if (!existingBySpec.has(sid)) existingBySpec.set(sid, new Set());
        existingBySpec.get(sid).add(nk);
    });
    let created = 0;
    let skipped = 0;
    let semVinculo = 0;
    for (const nameRaw of parsed) {
        const name = String(nameRaw || '').trim().toUpperCase();
        if (!name) continue;
        const major = extractSubdivisionMajorCode(name);
        const targetSpecialtyId = major ? String(specMap.get(major) || '') : '';
        if (!targetSpecialtyId) {
            semVinculo += 1;
            continue;
        }
        if (!existingBySpec.has(targetSpecialtyId)) existingBySpec.set(targetSpecialtyId, new Set());
        const set = existingBySpec.get(targetSpecialtyId);
        if (set.has(name)) {
            skipped += 1;
            continue;
        }
        const row = { id: generateId(), empresa_id: empresaId, especialidade_id: targetSpecialtyId, nome: name };
        const { error } = await withTimeout(
            db.from('especialidade_subdivisoes').insert(row),
            20000,
            'subImport:insert'
        );
        if (error) throw error;
        set.add(name);
        created += 1;
    }
    if (subdivisionImportStatus) {
        subdivisionImportStatus.textContent = [
            `Subdivisões criadas: ${created}`,
            `Duplicados ignorados: ${skipped}`,
            `Sem especialidade correspondente: ${semVinculo}`
        ].join('\n');
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
    await refreshSpecialtiesGridForEmpresa(empresaId);
    showList('specialties');
    showToast('Importação de subdivisões concluída.');
}

function bindGlobalHotkeys() {
    if (window.__globalHotkeysInit) return;
    window.__globalHotkeysInit = true;
    let seq = '';
    let lastTs = 0;
    const resetSeq = () => { seq = ''; lastTs = 0; };
    document.addEventListener('keydown', (e) => {
        const mods = e.ctrlKey && e.altKey && e.shiftKey;
        if (!mods) { resetSeq(); return; }
        const code = String(e.code || '');
        if (!code) return;
        const now = Date.now();
        if (lastTs && now - lastTs > 1500) resetSeq();
        lastTs = now;
        // Sequence first: ZERAR (layout-independent)
        const codeToLetter = { KeyZ: 'Z', KeyE: 'E', KeyR: 'R', KeyA: 'A' };
        const letter = codeToLetter[code] || '';
        if (letter && !e.repeat) {
            let advanced = false;
            if (seq === '' && letter === 'Z') { seq = 'Z'; advanced = true; }
            else if (seq !== '') {
                const next = seq + letter;
                if ('ZERAR'.startsWith(next)) { seq = next; advanced = true; }
                else if (letter === 'Z') { seq = 'Z'; advanced = true; }
                else { seq = ''; }
            }
            if (seq === 'ZERAR') {
                e.preventDefault();
                openSuperAdminModal('ZERAR');
                resetSeq();
                return;
            }
            if (advanced) return;
        }
        // Single-key hotkeys (only when not building sequence)
        const ctx = String(window.__activeHelpContext || '').toLowerCase();
        if (code === 'KeyS' && ctx === 'services') {
            e.preventDefault();
            openServiceImportModal();
            resetSeq();
            return;
        }
        if (code === 'KeyE' && ctx === 'specialties') {
            e.preventDefault();
            openSpecialtyImportModal();
            resetSeq();
            return;
        }
    }, true);
}

function handleSaScopeChange() {
    if (!saScope) return;
    const scope = String(saScope.value || '');
    if (saTableWrap) saTableWrap.style.display = scope === 'TABLE' ? '' : 'none';
    if (saClearAudit) {
        saClearAudit.checked = (scope === 'ZERAR');
    }
    renderSaPlan();
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
    saEmpresa.innerHTML = empresas.map(e => `<option value="${escapeHtml(String(e.id))}">${escapeHtml(String(e.nome || e.id))}</option>`).join('');
    const canKeep = prev && empresas.some(e => String(e.id) === prev);
    const canUseCurrent = currentEmpresaId && empresas.some(e => String(e.id) === String(currentEmpresaId));
    const next = canKeep ? prev : (canUseCurrent ? String(currentEmpresaId) : (empresas[0] ? String(empresas[0].id) : ''));
    if (next) saEmpresa.value = next;
}

function buildSaPlan(scopeRaw, empresaId, tableNameRaw, clearAuditFlag) {
    const scope = String(scopeRaw || '').trim().toUpperCase();
    const tableName = String(tableNameRaw || '').trim();
    const clearAudit = Boolean(clearAuditFlag);

    const plan = [];
    const add = (table) => plan.push({ table: String(table) });

    const baseAll = () => {
        add('orcamento_itens');
        add('orcamentos');
        add('orcamento_cancelados');
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
        add('financeiro_transacoes');
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

async function saCountTableRows(table, empresaId) {
    try {
        const { count, error } = await withTimeout(
            db.from(table).select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
            15000,
            `sa:count:${table}`
        );
        if (error) throw error;
        return Number(count || 0);
    } catch {
        return null;
    }
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

function initSuperAdminCleanupUI() {
    if (!isSuperAdmin) return;
    if (!modalSuperAdmin) return;
    if (!saEmpresa || !saScope || !btnSaDryRun || !btnSaExecute || !saResult) return;
    const alreadyBound = Boolean(modalSuperAdmin.dataset.saBound);
    refreshSaEmpresaOptions({ keepSelection: true });

    const tableOptions = [
        'orcamentos', 'orcamento_itens', 'orcamento_cancelados',
        'financeiro_transacoes',
        'pacientes', 'paciente_evolucao', 'paciente_documentos',
        'profissionais', 'especialidades', 'especialidade_subdivisoes', 'servicos',
        'agenda_agendamentos', 'agenda_disponibilidade',
        'ordens_proteticas', 'ordens_proteticas_eventos', 'ordens_proteticas_anexos',
        'protese_contas_pagas',
        'ordens_proteticas_custodia_tokens', 'ordens_proteticas_custodia_eventos',
        'laboratorios_proteticos',
        'marketing_envios', 'marketing_campanhas', 'marketing_smtp_config',
        'usuario_empresas',
        'occ_audit_log',
        'empresas'
    ];
    if (saTable) {
        saTable.innerHTML = tableOptions.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }

    if (alreadyBound) {
        handleSaScopeChange();
        return;
    }

    saEmpresa.addEventListener('change', () => {
        if (saConfirm) saConfirm.value = '';
        renderSaPlan();
    });
    saScope.addEventListener('change', handleSaScopeChange);
    if (saClearAudit) saClearAudit.addEventListener('change', renderSaPlan);
    if (saTable) saTable.addEventListener('change', renderSaPlan);
    if (btnSaRefreshEmpresas) btnSaRefreshEmpresas.addEventListener('click', async (e) => {
        e.preventDefault();
        await refreshSaEmpresaOptions({ keepSelection: true });
        renderSaPlan();
    });

    btnSaDryRun.addEventListener('click', async (e) => {
        e.preventDefault();
        const empresaId = getSaEmpresaId();
        const scope = saScope ? String(saScope.value || '') : 'ALL';
        const tableName = saTable ? String(saTable.value || '') : '';
        const clearAudit = saClearAudit ? Boolean(saClearAudit.checked) : false;
        const plan = buildSaPlan(scope, empresaId, tableName, clearAudit);
        saResult.textContent = 'Calculando...';
        const lines = [];
        let total = 0;
        for (const step of plan) {
            const c = await saCountTableRows(step.table, step.empresaId);
            const label = c == null ? '?' : String(c);
            lines.push(`${step.table}: ${label}`);
            if (c != null) total += c;
        }
        lines.push(`TOTAL (somatório): ${total}`);
        saResult.textContent = lines.join('\n');
    });

    btnSaExecute.addEventListener('click', async (e) => {
        e.preventDefault();
        const empresaId = getSaEmpresaId();
        const expected = `DELETE ${empresaId}`.toUpperCase();
        const got = saConfirm ? String(saConfirm.value || '').trim().toUpperCase() : '';
        if (got !== expected) {
            showToast(`Confirmação inválida. Digite exatamente: ${expected}`, true);
            return;
        }
        const scope = saScope ? String(saScope.value || '') : 'ALL';
        const tableName = saTable ? String(saTable.value || '') : '';
        const clearAudit = saClearAudit ? Boolean(saClearAudit.checked) : false;
        const plan = buildSaPlan(scope, empresaId, tableName, clearAudit);
        saResult.textContent = 'Executando...';
        const res = await saExecutePlan(plan);
        const out = res.map(r => r.ok ? `OK: ${r.table}` : `ERRO: ${r.table} -> ${r.msg}`);
        let summary = out.join('\n');

        // Auth users purge (always for ZERAR)
        if (scope === 'ZERAR') {
            try {
                const { data: { session } } = await db.auth.getSession();
                if (!session) throw new Error('Sessão expirada.');
                const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
                const resp = await fetch(`${baseUrl}/functions/v1/purge-tenant-users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify({ empresa_id: empresaId, only_exclusive: false })
                });
                const j = await resp.json();
                if (!resp.ok) throw new Error(j && (j.error || j.message) ? (j.error || j.message) : 'Erro desconhecido ao limpar auth.users');
                summary += `\nAUTH: candidatos=${j.candidates} removidos=${j.deleted_auth}`;
            } catch (err) {
                summary += `\nAUTH ERRO: ${(err && err.message) ? err.message : String(err)}`;
            }
        }

        saResult.textContent = summary;
        try { await initializeApp(true); } catch { }
    });

    handleSaScopeChange();
    modalSuperAdmin.dataset.saBound = '1';
}

function updateFinanceiroHeaderVisibility() {
    if (btnMovDiaria) btnMovDiaria.style.display = isSuperAdmin ? '' : 'none';
    if (btnPagamentosPacientes) btnPagamentosPacientes.style.display = '';
}

async function initializeApp(isContextSwitch = false) {
    const contextSwitch = (isContextSwitch === true);
    auditAuth('initializeApp:start', { isContextSwitch: contextSwitch });
    if (!contextSwitch && authCheckInFlight) return;
    let keepCheckingUi = false;
    try {
        if (!contextSwitch) {
            bootStartedAt = Date.now();
            bootPreferredTab = getSafeSavedTab();
            bootRenderCompleted = false;
            authCheckInFlight = true;
            setAuthCheckingUi(true);
            const session = await waitForResolvedSession();
            console.log('DEBUG: Sessão encontrada:', session);
            let isAuth = false;
            try {
                isAuth = await checkAuth(session);
            } catch {
                isAuth = false;
            }
            if (!isAuth) {
                auditAuth('initializeApp:notAuth', session);
                showLoginUi();
                return;
            }

            setAuthCheckingUi(false);
            auditAuth('initializeApp:showApp', session);
            lockAppUrl();

            // PWA Install logic based on plan
            if (typeof deferredPrompt !== 'undefined' && deferredPrompt) {
                const btnInstallApp = document.getElementById('btnInstallApp');
                if (btnInstallApp) {
                    if (typeof currentEmpresaRecord !== 'undefined' && currentEmpresaRecord) {
                        const plano = normalizeAssinaturaStatus(currentEmpresaRecord.assinatura_status);
                        if (plano === 'ATIVO' || plano === 'TRIAL') {
                            btnInstallApp.style.display = 'flex';
                        }
                    } else {
                        // Fallback Se não houver registro da empresa, mas logou, libera.
                        btnInstallApp.style.display = 'flex';
                    }
                }
            }

        }

        if (!hasBootDataContext()) {
            showToast('Sessão carregada, aguardando contexto da clínica...', true);
            return;
        }

        const professionalsResponse = await db.from('profissionais').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true });
        professionals = professionalsResponse.data || [];

        let bQuery = db.from('orcamentos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: false });
        
        // Regra Single Ownership para Carga Inicial
        if (typeof isSuperAdmin !== 'undefined' && !isSuperAdmin && typeof isAdminRole !== 'undefined' && !isAdminRole()) {
            const uEmail = String(currentUser && currentUser.email ? currentUser.email : '').trim().toLowerCase();
            const profObj = professionals.find(p => String(p.email || '').trim().toLowerCase() === uEmail);
            if (profObj && profObj.seqid != null) {
                bQuery = bQuery.eq('profissional_id', Number(profObj.seqid));
            } else {
                bQuery = bQuery.eq('profissional_id', -1); // Block access if no professional is linked
            }
        }
        
        const results = await Promise.all([
            db.from('pacientes').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            Promise.resolve(professionalsResponse), // Keep index 1 intact
            db.from('especialidades').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('especialidade_subdivisoes').select('*').eq('empresa_id', currentEmpresaId),
            db.from('servicos').select('*').eq('empresa_id', currentEmpresaId).order('descricao', { ascending: true }),
            bQuery,
            (isSuperAdmin
                ? db.from('empresas').select('*').order('nome')
                : db.from('empresas').select('*').eq('id', currentEmpresaId))
        ]);

        const patientsRes = results[0];
        const professionalsRes = results[1];
        const specialtiesRes = results[2];
        const subdivisionsRes = results[3];
        const servicesRes = results[4];
        let budgetsRes = results[5];
        const empresasRes = results[6];

        if (patientsRes.error) throw patientsRes.error;
        if (professionalsRes && professionalsRes.error) throw professionalsRes.error;
        if (specialtiesRes.error) throw specialtiesRes.error;
        if (subdivisionsRes.error) throw subdivisionsRes.error;
        if (servicesRes.error) throw servicesRes.error;
        if (budgetsRes.error) throw budgetsRes.error;
        if (empresasRes.error) throw empresasRes.error;

        patients = patientsRes.data || [];
        professionals = (professionalsRes && professionalsRes.data) ? professionalsRes.data : [];
        activeEmpresasList = empresasRes.data || [];
        
        const headerLoggedUser = document.getElementById('headerLoggedUser');
        if (headerLoggedUser && currentUser && currentUser.email) {
            const uEmail = String(currentUser.email).trim().toLowerCase();
            const currentProf = professionals.find(p => String(p.email || '').trim().toLowerCase() === uEmail);
            if (currentProf) {
                headerLoggedUser.textContent = `| Profissional: ${currentProf.nome}`;
            } else {
                headerLoggedUser.textContent = `| Usuário: ${currentUser.user_metadata?.full_name || currentUser.email.split('@')[0]}`;
            }
        }

        const currentEmpresaRow = (activeEmpresasList || []).find(e => String(e && e.id || '') === String(currentEmpresaId || '')) || null;
        financialParamsCache = normalizeFinancialParams(currentEmpresaRow && currentEmpresaRow.financeiro_params ? currentEmpresaRow.financeiro_params : {});
        if (!isSuperAdmin && currentEmpresaRow) {
            const normalizeAssStatus = (raw) => {
                const k = normalizeKey(raw || '');
                if (k === 'ATIVO' || k === 'ATIVA') return 'ATIVO';
                if (k === 'PENDENTE') return 'PENDENTE';
                if (k === 'TRIAL') return 'TRIAL';
                return k || 'TRIAL';
            };
            const statusKey = normalizeAssStatus(currentEmpresaRow.assinatura_status);

            const now = new Date();
            const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const vencRaw = currentEmpresaRow.data_vencimento ? String(currentEmpresaRow.data_vencimento).slice(0, 10) : '';
            const vencExpired = vencRaw && todayYmd > vencRaw;
            const planoNomeAtual = String(currentEmpresaRow.plano_tipo || 'plano selecionado').trim() || 'plano selecionado';
            const blockMsg = statusKey === 'PENDENTE'
                ? `Recebemos seu pedido para o ${planoNomeAtual}! Estamos aguardando a confirmação do pagamento para liberar seu acesso.`
                : (vencExpired ? 'Seu período de uso expirou. Renove sua assinatura para continuar.' : '');

            if (blockMsg) {
                auditAuth('initializeApp:blockMsg', { blockMsg, statusKey });
                const loginError = document.getElementById('loginError');
                if (loginError) {
                    loginError.textContent = blockMsg;
                    loginError.style.display = 'block';
                }
                showToast(blockMsg, true);
                document.getElementById('loginView').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
                return;
            }
        }

        // De-duplicate specialties and map subdivisions
        const rawSpecialties = specialtiesRes.data || [];
        const seenIds = new Set();
        specialties = rawSpecialties.filter(s => {
            if (seenIds.has(s.id)) return false;
            seenIds.add(s.id);
            return true;
        });

        const subdivisions = subdivisionsRes.data || [];
        specialties.forEach(spec => {
            const sid = String(spec && spec.id || '').trim();
            spec.subdivisoes = subdivisions.filter(sub => String(sub && sub.especialidade_id || '').trim() === sid);
        });

        services = servicesRes.data || [];
        budgets = budgetsRes.data || [];
        try {
            const itensRes = await db.from('orcamento_itens').select('*').eq('empresa_id', currentEmpresaId);
            if (!itensRes.error) {
                const itens = itensRes.data || [];
                const byBudgetId = new Map();
                itens.forEach(it => {
                    const k = String(it && it.orcamento_id || '');
                    if (!k) return;
                    if (!byBudgetId.has(k)) byBudgetId.set(k, []);
                    byBudgetId.get(k).push(it);
                });
                budgets.forEach(b => {
                    const k1 = String(b && b.id || '');
                    const k2 = String(b && b.seqid || '');
                    b.orcamento_itens = byBudgetId.get(k1) || byBudgetId.get(k2) || [];
                });
            } else {
                budgets.forEach(b => { b.orcamento_itens = []; });
                console.error('Falha ao carregar itens de orçamento:', itensRes.error);
            }
        } catch (e) {
            budgets.forEach(b => { b.orcamento_itens = []; });
            console.error('Falha ao anexar itens de orçamento:', e);
        }

        let allPayments = [];
        bindEstoqueModule();
        bindNumericMasks();
        await loadEstoqueData(true);

        console.log("DEBUG Fetched Data Lengths:", {
            patients: patients.length,
            professionals: professionals.length,
            specialties: specialties.length,
            subdivisions: subdivisions.length,
            services: services.length,
            budgets: budgets.length
        });

        if (AUTO_SEED_SPECIALTIES && specialties.length === 0) {
            const defaultSpecialties = [
                { nome: "CLINICO GERAL", subs: ["Avaliação/Consulta", "Profilaxia (Limpeza)", "Restauração", "Extração Simples"] },
                { nome: "ORTODONTIA", subs: ["Manutenção de Aparelho", "Instalação de Aparelho", "Contenção"] },
                { nome: "IMPLANTODONTIA", subs: ["Implante Unitário", "Enxerto Ósseo", "Prótese sobre Implante"] },
                { nome: "ENDODONTIA", subs: ["Tratamento de Canal (Incisivo/Canino)", "Tratamento de Canal (Molar)"] },
                { nome: "PERIODONTIA", subs: ["Raspagem (Limpeza Profunda)", "Cirurgia Gengival"] },
                { nome: "ODONTOPEDIATRIA", subs: ["Aplicação de Flúor", "Selante", "Extração de Dente de Leite"] },
                { nome: "CIRURGIA BUCOMAXILOFACIAL", subs: ["Extração de Siso", "Biópsia"] },
                { nome: "PRÓTESE DENTÁRIA", subs: ["Coroa", "Ponte", "Prótese Total (Dentadura)"] }
            ];

            for (let def of defaultSpecialties) {
                const specId = generateId();
                const specSeqId = getNextSeqId(specialties);

                const specData = {
                    id: specId,
                    seqid: specSeqId,
                    nome: def.nome,
                    empresa_id: currentEmpresaId
                };

                const { data: newSpec } = await db.from('especialidades').insert(specData).select().single();
                if (newSpec) {
                    newSpec.subdivisoes = [];
                    // Insert subdivisions for this default specialty
                    for (let subName of def.subs) {
                        const subData = {
                            id: generateId(),
                            especialidade_id: specId,
                            nome: subName,
                            empresa_id: currentEmpresaId
                        };
                        const { data: newSub } = await db.from('especialidade_subdivisoes').insert(subData).select().single();
                        if (newSub) newSpec.subdivisoes.push(newSub);
                    }
                    specialties.push(newSpec);
                }
            }
        }

        // Render initial view
        initHelpShortcuts();
        updateSidebarVisibility();
        updateFinanceiroHeaderVisibility();
        bindGlobalHotkeys();
        bindSchemaAuditUi();
        bindForcePasswordChangeModal();
        bindCompanyPhoneMasks();
        initPrivacyScreensaver();
        refreshFinancialOnboardingLock(true);
        updateGlobalChatBadge();
        initChatAdminRealtime();
        executarNavegacaoInicial();
        if (isPasswordChangeEnforced()) showForcePasswordChangeModal();
        if (!contextSwitch) {
            setupNavigationListeners();
        }
        lockAppUrl();

    } catch (error) {
        console.error("Error initializing app data from Supabase:", error);
        const code = error && error.code ? String(error.code) : '-';
        const msg = error && error.message ? String(error.message) : 'Erro desconhecido';
        showToast(`Erro ao carregar dados do servidor (${code}): ${msg}`, true);
        throw error; // Rethrow to propagate to loginForm listener so it can reset UI
    } finally {
        if (!contextSwitch) {
            authCheckInFlight = false;
            if (!keepCheckingUi) setAuthCheckingUi(false);
        }
    }
}

function getNextSeqId(collection) {
    if (!collection || collection.length === 0) return 1;
    let maxId = 0;
    collection.forEach(i => { if (i.seqid && i.seqid > maxId) maxId = i.seqid; });
    return maxId + 1;
}

function getNextNumeroProntuario(collection) {
    const list = Array.isArray(collection) ? collection : [];
    let max = 0;
    list.forEach(p => {
        const raw = String(p && p.numero_prontuario || '').trim();
        if (/^\d+$/.test(raw)) {
            const n = Number.parseInt(raw, 10);
            if (Number.isFinite(n) && n > max) max = n;
        }
    });
    if (max <= 0) {
        list.forEach(p => {
            const n = Number(p && p.seqid || 0);
            if (Number.isFinite(n) && n > max) max = n;
        });
    }
    return String(max + 1);
}

async function fetchNextNumeroProntuarioForEmpresa(empresaId) {
    const empId = String(empresaId || '').trim();
    if (!empId) return '';
    try {
        const { data, error } = await withTimeout(
            db.rpc('rpc_next_numero_prontuario', { p_empresa_id: empId }),
            12000,
            'rpc_next_numero_prontuario'
        );
        if (error) throw error;
        const v = String(data || '').trim();
        return v;
    } catch {
        return '';
    }
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

// Call initialization
document.addEventListener('DOMContentLoaded', () => { 
    document.body.style.zoom = '100%';
    initializeApp(false); 
});

// Navigation Elements (Moved to setupNavigationListeners for attachment)
// const sidebar = document.querySelector('.sidebar');
// const mobileMenuBtn = document.getElementById('mobileMenuBtn');
function initFiscalHubInfoModalBindings() {
    const openIds = ['btnOpenFiscalHubInfo', 'btnOpenFiscalHubInfoLogin'];
    const closeIds = ['btnCloseFiscalHubInfoModal', 'btnCloseFiscalHubInfoModalFooter'];
    const modal = document.getElementById('fiscalHubInfoModal');
    if (!modal) return;
    const open = () => modal.classList.remove('hidden');
    const close = () => modal.classList.add('hidden');
    openIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.__boundFiscalHubModal) return;
        el.__boundFiscalHubModal = true;
        el.addEventListener('click', open);
    });
    closeIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.__boundFiscalHubModalClose) return;
        el.__boundFiscalHubModalClose = true;
        el.addEventListener('click', close);
    });
    if (!modal.__boundBackdropClose) {
        modal.__boundBackdropClose = true;
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }
}
initFiscalHubInfoModalBindings();
// const navPatients = document.getElementById('navPatients');
// const navProfessionals = document.getElementById('navProfessionals');
// const navSpecialties = document.getElementById('navSpecialties');
// const navServices = document.getElementById('navServices');
const navEstoqueToggle = document.getElementById('navEstoqueToggle');
const navEstoqueToggleIcon = document.getElementById('navEstoqueToggleIcon');
const navEstoqueSubmenu = document.getElementById('navEstoqueSubmenu');
const navInventory = document.getElementById('navInventory');
// const navUsageModels = document.getElementById('navUsageModels');
// const navServiceMapping = document.getElementById('navServiceMapping');
const navInventoryLogs = document.getElementById('navInventoryLogs');
const navInventoryReports = document.getElementById('navInventoryReports');
// const navBudgets = document.getElementById('navBudgets');
// const navFinanceiro = document.getElementById('navFinanceiro');
// const navCommissions = document.getElementById('navCommissions');
// const navMarketingToggle = document.getElementById('navMarketingToggle');
// const navMarketingSubmenu = document.getElementById('navMarketingSubmenu');
// const navMarketingToggleIcon = document.getElementById('navMarketingToggleIcon');
// const navMarketing = document.getElementById('navMarketing');
// const navWhatsappMarketing = document.getElementById('navWhatsappMarketing');
// const navDashboard = document.getElementById('navDashboard');
// const navAtendimentoToggle = document.getElementById('navAtendimentoToggle');
// const navAtendimentoSubmenu = document.getElementById('navAtendimentoSubmenu');
// const navAtendimentoToggleIcon = document.getElementById('navAtendimentoToggleIcon');
// const navConsultaAvaliacao = document.getElementById('navConsultaAvaliacao');
// const navAtendimento = document.getElementById('navAtendimento');
// const navAgenda = document.getElementById('navAgenda');
// const navProtese = document.getElementById('navProtese');
// const navSuporteTickets = document.getElementById('navSuporteTickets');
// const navChatPacientes = document.getElementById('navChatPacientes');
// const navEmpresas = document.getElementById('navEmpresas');
// const navAssinaturas = document.getElementById('navAssinaturas');
// const navMyCompany = document.getElementById('navMyCompany');
// const navFinancialParams = document.getElementById('navFinancialParams');
// const navUsersAdminBtn = document.getElementById('navUsersAdmin');

// View Elements
// const patientListView = document.getElementById('patientListView');
// const patientFormView = document.getElementById('patientFormView');
// const professionalListView = document.getElementById('professionalListView');
// const professionalFormView = document.getElementById('professionalFormView');
// const specialtiesListView = document.getElementById('specialtiesListView');
// const specialtyFormView = document.getElementById('specialtyFormView');
// const servicesListView = document.getElementById('servicesListView');
// const serviceFormView = document.getElementById('serviceFormView');
const inventoryView = document.getElementById('inventoryView');
// const usageModelsView = document.getElementById('usageModelsView');
// const serviceMappingView = document.getElementById('serviceMappingView');
const inventoryMovementsView = document.getElementById('inventoryMovementsView');
const inventoryReportsView = document.getElementById('inventoryReportsView');
// const budgetsListView = document.getElementById('budgetsListView');
// const budgetFormView = document.getElementById('budgetFormView');
// const usersAdminView = document.getElementById('usersAdminView');
// const userAdminFormView = document.getElementById('userAdminFormView');
// const empresasListView = document.getElementById('empresasListView');
// const assinaturasView = document.getElementById('assinaturasView');
// const empresaFormView = document.getElementById('empresaFormView');
// const financeiroView = document.getElementById('financeiroView');
// const commissionsView = document.getElementById('commissionsView');
// const marketingView = document.getElementById('marketingView');
// const dashboardView = document.getElementById('dashboardView');
// const patientPortalView = document.getElementById('patientPortalView');
// const atendimentoView = document.getElementById('atendimentoView');
// const consultaAvaliacaoView = document.getElementById('consultaAvaliacaoView');
// const consultaProfessionalGroup = document.getElementById('consultaProfessionalGroup');
// const agendaView = document.getElementById('agendaView');
// const proteseView = document.getElementById('proteseView');
// const suporteTicketsView = document.getElementById('suporteTicketsView');
// const btnNovoTicket = document.getElementById('btnNovoTicket');
// const btnRefreshTickets = document.getElementById('btnRefreshTickets');
// const btnPrintTicketsReport = document.getElementById('btnPrintTicketsReport');
// const btnPrintTicketsReportFull = document.getElementById('btnPrintTicketsReportFull');
// const ticketReportModal = document.getElementById('ticketReportModal');
// const btnTicketReportModalX = document.getElementById('btnTicketReportModalX');
// const btnTicketReportCancel = document.getElementById('btnTicketReportCancel');
// const btnTicketReportGenerate = document.getElementById('btnTicketReportGenerate');
// let ticketReportType = 'simples';
// const ticketReportCategoria = document.getElementById('ticketReportCategoria');
// const ticketReportStatus = document.getElementById('ticketReportStatus');
// const suporteTicketsBody = document.getElementById('suporteTicketsBody');
// const suporteTicketsEmptyState = document.getElementById('suporteTicketsEmptyState');
// const suporteTicketModal = document.getElementById('suporteTicketModal');
// const suporteTicketModalTitle = document.getElementById('suporteTicketModalTitle');
// const suporteTicketId = document.getElementById('suporteTicketId');
// const suporteTicketTitulo = document.getElementById('suporteTicketTitulo');
// const suporteTicketCategoria = document.getElementById('suporteTicketCategoria');
// const suporteTicketDescricao = document.getElementById('suporteTicketDescricao');
// const suporteTicketAdminStatusGroup = document.getElementById('suporteTicketAdminStatusGroup');
// const suporteTicketRespostaGroup = document.getElementById('suporteTicketRespostaGroup');
// const suporteTicketResposta = document.getElementById('suporteTicketResposta');
// const suporteTicketStatus = document.getElementById('suporteTicketStatus');
// const btnSalvarTicket = document.getElementById('btnSalvarTicket');
// const myCompanyView = document.getElementById('myCompanyView');
// const financialParamsView = document.getElementById('financialParamsView');
// const btnAddNewEmpresa = document.getElementById('btnAddNewEmpresa');
// const btnBackEmpresa = document.getElementById('btnBackEmpresa');
// const btnCancelEmpresa = document.getElementById('btnCancelEmpresa');
// const btnAddPlanoConfig = document.getElementById('btnAddPlanoConfig');
// const configPlanosTableBody = document.getElementById('configPlanosTableBody');
// const configPlanosEmptyState = document.getElementById('configPlanosEmptyState');
// const assinaturasTableBody = document.getElementById('assinaturasTableBody');
// const assinaturasEmptyState = document.getElementById('assinaturasEmptyState');
// const assinaturaModal = document.getElementById('assinaturaModal');
// const assinaturaEmpresaId = document.getElementById('assinaturaEmpresaId');
// const assinaturaPlanoTipo = document.getElementById('assinaturaPlanoTipo');
// const assinaturaDataVencimento = document.getElementById('assinaturaDataVencimento');
// const assinaturaStatus = document.getElementById('assinaturaStatus');
// const btnCloseAssinaturaModal = document.getElementById('btnCloseAssinaturaModal');
// const btnCancelAssinaturaModal = document.getElementById('btnCancelAssinaturaModal');
// const btnSaveAssinaturaModal = document.getElementById('btnSaveAssinaturaModal');
// const planoConfigModal = document.getElementById('planoConfigModal');
// const planoConfigModalTitle = document.getElementById('planoConfigModalTitle');
// const planoConfigId = document.getElementById('planoConfigId');
// const planoConfigTipoAssinatura = document.getElementById('planoConfigTipoAssinatura');
// const planoConfigValor = document.getElementById('planoConfigValor');
// const planoConfigModulos = document.getElementById('planoConfigModulos');
// const planoConfigDestaque = document.getElementById('planoConfigDestaque');
// const btnClosePlanoConfigModal = document.getElementById('btnClosePlanoConfigModal');
// const btnCancelPlanoConfigModal = document.getElementById('btnCancelPlanoConfigModal');
// const btnSavePlanoConfigModal = document.getElementById('btnSavePlanoConfigModal');
// const empresaForm = document.getElementById('empresaForm');
// const empresaLogoFile = document.getElementById('empresaLogoFile');
// const empresaLogoBase64 = document.getElementById('empresaLogoBase64');
// const logoPreviewContainer = document.getElementById('logoPreviewContainer');

// const systemModules = [
//     { id: 'agenda', label: 'Agenda' },
//     { id: 'atendimento', label: 'Atendimento' },
//     { id: 'audit_cancelados', label: 'Audit Cancelados' },
//     { id: 'chat_pacientes', label: 'Central do Paciente' },
//     { id: 'comissoes', label: 'Comissões' },
//     { id: 'dashboard', label: 'Dashboard' },
//     { id: 'especialidades', label: 'Especialidades' },
//     { id: 'estoque_inventario', label: 'Estoque: Inventário' },
//     { id: 'estoque_modelos', label: 'Estoque: Modelos de Uso' },
//     { id: 'estoque_movimentacoes', label: 'Estoque: Movimentações' },
//     { id: 'estoque_relatorios', label: 'Estoque: Relatórios' },
//     { id: 'estoque_vinculos', label: 'Estoque: Vínculo de Serviços' },
//     { id: 'financeiro', label: 'Financeiro' },
//     { id: 'ia', label: 'Inteligência OCC' },
//     { id: 'marketing', label: 'Marketing' },
//     { id: 'orcamentos', label: 'Orçamentos' },
//     { id: 'pacientes', label: 'Pacientes' },
//     { id: 'protese', label: 'Produção Protética' },
//     { id: 'profissionais', label: 'Profissionais' },
//     { id: 'servicos', label: 'Serviços/Estoque' },
//     { id: 'tickets', label: 'Suporte / Tickets' }
// ];

function buildFullPermissions() {
    const perms = {};
    (systemModules || []).forEach(mod => {
        perms[mod.id] = { select: true, insert: true, update: true, delete: true };
    });
    return perms;
}

function applyAdminFullPermissionsToGrid() {
    const tbody = document.getElementById('permissionsTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('.perm-check').forEach(c => {
        c.checked = true;
    });
    tbody.querySelectorAll('.perm-all').forEach(c => {
        c.checked = true;
    });
}

function isFinancialOnboardingTargetUser() {
    return isAdminRole() && !isSuperAdmin;
}

function getFinancialOnboardingStorageKey() {
    const uid = String((currentUser && (currentUser.id || currentUser.email)) || '').trim();
    const emp = String(currentEmpresaId || '').trim();
    return `occ_fin_onboard_seen_${emp}_${uid}`;
}

function validateFinancialParamsCompleteness(paramsInput) {
    const p = normalizeFinancialParams(paramsInput || {});
    const sn = p.simples_nacional || {};
    const mp = p.meios_pagamento || {};
    const mg = p.margem_seguranca || {};
    const custos = Array.isArray(p.custos_operacionais) ? p.custos_operacionais : [];
    const issues = [];
    if (toDec(sn.faturamento_base_12m, 0) <= 0) issues.push('Informe o Faturamento Bruto Acumulado (12 meses).');
    if (toDec(sn.aliquota_nominal, 0) <= 0) issues.push('Informe a Alíquota Nominal.');
    if (toDec(sn.parcela_deduzir, -1) < 0) issues.push('Informe a Parcela a Deduzir.');
    if (toDec(sn.iss_municipal, -1) < 0) issues.push('Informe o ISS Municipal.');
    if (toDec(mp.taxa_pix, -1) < 0 || toDec(mp.taxa_debito, -1) < 0 || toDec(mp.taxa_credito, -1) < 0) issues.push('Preencha as taxas de meios de pagamento.');
    if (toDec(mg.gordura_percentual, -1) < 0) issues.push('Informe a Margem de Segurança.');
    if (!custos.length) issues.push('Cadastre pelo menos 1 custo operacional fixo.');
    if (toDec(p.taxa_unica_sugerida, 0) <= 0) issues.push('A Taxa Única sugerida precisa ser maior que zero.');
    return { ok: issues.length === 0, issues, normalized: p };
}

function applyFinancialOnboardingMenuLock() {
    const all = Array.from(document.querySelectorAll('.sidebar-nav .nav-item'));
    all.forEach((el) => {
        const isAllowed = el && el.id === 'navFinancialParams';
        if (financialOnboardingLocked && !isAllowed) {
            el.classList.add('disabled');
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.45';
            el.setAttribute('aria-disabled', 'true');
        } else {
            el.classList.remove('disabled');
            el.style.pointerEvents = '';
            el.style.opacity = '';
            el.removeAttribute('aria-disabled');
        }
    });
    if (navFinancialParams) {
        if (financialOnboardingLocked) {
            navFinancialParams.style.display = 'flex';
            navFinancialParams.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.45), 0 0 18px rgba(16,185,129,0.35)';
            navFinancialParams.style.background = '#065f46';
            navFinancialParams.style.color = '#fff';
        } else {
            navFinancialParams.style.boxShadow = '';
            navFinancialParams.style.background = '';
            navFinancialParams.style.color = '';
        }
    }
}

function showFinancialOnboardingModal() {
    if (!financialOnboardingLocked) return;
    let modal = document.getElementById('financialOnboardingModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'financialOnboardingModal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(15,23,42,0.6)';
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML = `
            <div style="width:min(640px, 94vw); background:#fff; border-radius:14px; border:1px solid #cbd5e1; padding:20px;">
                <div style="font-weight:900; font-size:18px; color:#0f172a; margin-bottom:10px;">Configuração Inicial Obrigatória</div>
                <div style="font-size:14px; color:#334155; line-height:1.5; margin-bottom:16px;">
                    Bem-vindo ao Sistema OCC! Para garantir a precisão dos seus cálculos de lucro e comissão, você precisa configurar seus Parâmetros Financeiros antes de começar. Clique aqui para configurar.
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button id="btnAbortFinancialOnboarding" class="btn btn-secondary"><i class="ri-logout-box-r-line"></i> Sair do Sistema</button>
                    <button id="btnGoFinancialParamsOnboarding" class="btn btn-primary"><i class="ri-calculator-line"></i> Configurar Agora</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const abort = document.getElementById('btnAbortFinancialOnboarding');
        if (abort) abort.addEventListener('click', () => {
            if (db) db.auth.signOut().then(() => window.location.replace('index.html'));
        });

        const go = document.getElementById('btnGoFinancialParamsOnboarding');
        if (go) go.addEventListener('click', () => {
            hideFinancialOnboardingModal();
            setActiveTab('financialParams');
        });
    }
    modal.style.display = 'flex';
}

function hideFinancialOnboardingModal() {
    const modal = document.getElementById('financialOnboardingModal');
    if (modal) modal.style.display = 'none';
}

function refreshFinancialOnboardingLock(showModal = false) {
    if (!isFinancialOnboardingTargetUser()) {
        financialOnboardingLocked = false;
        applyFinancialOnboardingMenuLock();
        hideFinancialOnboardingModal();
        return;
    }
    const check = validateFinancialParamsCompleteness(financialParamsCache || {});
    financialOnboardingLocked = !check.ok;
    applyFinancialOnboardingMenuLock();

    const abortBtn = document.getElementById('btnAbortFinancialParams');
    if (abortBtn) {
        abortBtn.style.display = financialOnboardingLocked ? 'inline-flex' : 'none';
    }

    if (!financialOnboardingLocked) {
        hideFinancialOnboardingModal();
        try { localStorage.removeItem(getFinancialOnboardingStorageKey()); } catch { }
        return;
    }
    if (!showModal) return;
    const k = getFinancialOnboardingStorageKey();
    let seen = false;
    try { seen = localStorage.getItem(k) === '1'; } catch { }
    if (!seen) {
        showFinancialOnboardingModal();
        try { localStorage.setItem(k, '1'); } catch { }
    }
}

function renderPermissionsGrid(existingPerms = null, targetEmpresaId = null) {
    const tbody = document.getElementById('permissionsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let allowedModules = null; // null means all modules allowed
    const empId = targetEmpresaId || currentEmpresaId;
    if (empId && activeEmpresasList) {
        const emp = activeEmpresasList.find(e => e.id === empId);
        if (emp) {
            if (emp.modulos_contratados) {
                allowedModules = emp.modulos_contratados.toLowerCase().split(',').map(s => s.trim());
            } else if (emp.plano_tipo && configPlanosList && typeof resolvePlanDisplayName === 'function') {
                const planName = resolvePlanDisplayName(emp.plano_tipo);
                const planCfg = configPlanosList.find(p => p.tipo_assinatura === planName || p.id === emp.plano_tipo || p.tipo_assinatura === emp.plano_tipo);
                if (planCfg && planCfg.modulos_texto) {
                    allowedModules = planCfg.modulos_texto.toLowerCase().split(',').map(s => s.trim());
                }
            }
        }
    }

    if (allowedModules !== null) {
        // Limpa acentos e caracteres especiais
        allowedModules = allowedModules.map(m => m.normalize('NFD').replace(/[\u0300-\u036f]/g, ""));
    }

    systemModules.forEach(mod => {
        if (allowedModules) {
            const modLabelClean = mod.label.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
            const modIdClean = mod.id.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
            
            let isAllowed = allowedModules.includes(modLabelClean) || allowedModules.includes(modIdClean);
            
            // Regra específica para o Financeiro/NFS-e
            if (modIdClean === 'nfse' || modLabelClean.includes('nfs-e')) {
                if (allowedModules.some(m => m.includes('nfs-e') || m.includes('nfse'))) {
                    isAllowed = true;
                }
            }
            
            if (!isAllowed) {
                return; // Skip rendering this module if it's not in the plan/company
            }
        }

        const tr = document.createElement('tr');
        const p = existingPerms ? existingPerms[mod.id] : { select: false, insert: false, update: false, delete: false };

        tr.innerHTML = `
            <td><strong>${mod.label}</strong></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="select" ${p?.select ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="insert" ${p?.insert ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="update" ${p?.update ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="delete" ${p?.delete ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-all" data-mod="${mod.id}"></td>
        `;
        tbody.appendChild(tr);
    });

    // Handle "Todas" logic
    tbody.querySelectorAll('.perm-all').forEach(allCheck => {
        allCheck.addEventListener('change', (e) => {
            const modId = e.target.getAttribute('data-mod');
            const checks = tbody.querySelectorAll(`.perm-check[data-mod="${modId}"]`);
            checks.forEach(c => c.checked = e.target.checked);
        });
    });
}

// Patient DOM Elements
// const btnAddNewPatient = document.getElementById('btnAddNew');
// const btnBackPatient = document.getElementById('btnBack');
// const btnCancelPatient = document.getElementById('btnCancelPatient');
// const patientForm = document.getElementById('patientForm');
// const patientsTableBody = document.getElementById('patientsTableBody');
// const patientEmptyState = document.getElementById('patientEmptyState');
// const formTitle = document.getElementById('formTitle');

// Professional DOM Elements
// const btnAddNewProfessional = document.getElementById('btnAddNewProfessional');
// const btnBackProfessional = document.getElementById('btnBackProfessional');
// const btnCancelProfessional = document.getElementById('btnCancelProfessional');
// const professionalForm = document.getElementById('professionalForm');
// const professionalsTableBody = document.getElementById('professionalsTableBody');
// const professionalEmptyState = document.getElementById('professionalEmptyState');
// const searchProfessionalInput = document.getElementById('searchProfessionalInput');
// const professionalFormTitle = document.getElementById('professionalFormTitle');
// const profTipoSelect = document.getElementById('profTipo');
// const comissionCard = document.getElementById('comissionCard');
// const comissionCE = document.getElementById('comissionCE');
// const comissionCC = document.getElementById('comissionCC');
// const comissionCP = document.getElementById('comissionCP');
// const comissionEP = document.getElementById('comissionEP');
// const comissionImp = document.getElementById('comissionImp');

// const agendaCard = document.getElementById('agendaCard');
// const agendaFields = Array.from({ length: 7 }).map((_, i) => {
//     const day = i + 1;
//     return {
//         day,
//         enabled: document.getElementById(`agendaDay${day}Enabled`),
//         start: document.getElementById(`agendaDay${day}Start`),
//         end: document.getElementById(`agendaDay${day}End`),
//         slot: document.getElementById(`agendaDay${day}Slot`)
//     };
// });

// Specialty DOM Elements
// const btnNewSpecialty = document.getElementById('btnNewSpecialty');
// const btnBackSpecialty = document.getElementById('btnBackSpecialty');
// const btnCancelSpecialty = document.getElementById('btnCancelSpecialty');
// const specialtyForm = document.getElementById('specialtyForm');
// const specialtiesTableBody = document.getElementById('specialtiesTableBody');
// const specialtyEmptyState = document.getElementById('specialtyEmptyState');
// const specialtyFormTitle = document.getElementById('specialtyFormTitle');

// Services DOM Elements
// const btnNewService = document.getElementById('btnNewService');
// const btnBackService = document.getElementById('btnBackService');
// const btnCancelService = document.getElementById('btnCancelService');
// const serviceForm = document.getElementById('serviceForm');
// const servicesTableBody = document.getElementById('servicesTableBody');
// const searchServiceInput = document.getElementById('searchServiceInput');

// Budgets DOM Elements
// const btnNewBudget = document.getElementById('btnNewBudget');
// const btnBackBudget = document.getElementById('btnBackBudget');
// const btnCancelBudget = document.getElementById('btnCancelBudget');
// const budgetForm = document.getElementById('budgetForm');
// const budgetsTableBody = document.getElementById('budgetsTableBody');
// const searchBudgetInput = document.getElementById('searchBudgetInput');
// const btnToggleAddItem = document.getElementById('btnToggleAddItem');
// const addBudgetItemPanel = document.getElementById('addBudgetItemPanel');
// const btnCancelAddItem = document.getElementById('btnCancelAddItem');
// const btnSaveAddItem = document.getElementById('btnSaveAddItem');
// const budgetItemsTableBody = document.getElementById('budgetItemsTableBody');
// const budgetItemsEmptyState = document.getElementById('budgetItemsEmptyState');

// const helpModal = document.getElementById('helpModal');
// const helpModalTitle = document.getElementById('helpModalTitle');
// const helpModalBody = document.getElementById('helpModalBody');
// const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
// const btnCloseHelpModal2 = document.getElementById('btnCloseHelpModal2');

// Users Admin DOM Elements
// const btnAddNewUser = document.getElementById('btnAddNewUser');
// const btnBackUserAdmin = document.getElementById('btnBackUserAdmin');
// const btnCancelUserAdmin = document.getElementById('btnCancelUserAdmin');
// const userAdminForm = document.getElementById('userAdminForm');
// const usersAdminTableBody = document.getElementById('usersAdminTableBody');
// const usersAdminEmptyState = document.getElementById('usersAdminEmptyState');
// const userAdminFormTitle = document.getElementById('userAdminFormTitle');

// Financeiro DOM Elements
// const finTransacoesTable = document.getElementById('finTransacoesTable');
// const finTransacoesBody = document.getElementById('finTransacoesBody');
// const finPainelSaldo = document.getElementById('finPainelSaldo');
// const finNomePaciente = document.getElementById('finNomePaciente');
// const finSaldoPaciente = document.getElementById('finSaldoPaciente');
// const btnNovaTransacao = document.getElementById('btnNovaTransacao');
// const modalNovaTransacao = document.getElementById('modalNovaTransacao');
// const btnSalvarTransacao = document.getElementById('btnSalvarTransacao');
// const btnCancelarTransacao = document.getElementById('btnCancelarTransacao');
// const formNovaTransacao = document.getElementById('formNovaTransacao');
// const transacaoPaciente = document.getElementById('transacaoPaciente');
// const transacaoCategoria = document.getElementById('transacaoCategoria');
// const grpPacienteDestino = document.getElementById('grpPacienteDestino');
// const transacaoPacienteDestino = document.getElementById('transacaoPacienteDestino');
// const btnFinBuscar = document.getElementById('btnFinBuscar');
// const finPacienteSearch = document.getElementById('finPacienteSearch');
// const btnFinVerTodos = document.getElementById('btnFinVerTodos');
// const btnMovDiaria = document.getElementById('btnMovDiaria');
// const btnPagamentosPacientes = document.getElementById('btnPagamentosPacientes');
// const btnFatMensalPaciente = document.getElementById('btnFatMensalPaciente');
// const btnFatMensalProfissional = document.getElementById('btnFatMensalProfissional');
// const finNotasBody = document.getElementById('finNotasBody');
// const movDiariaModal = document.getElementById('movDiariaModal');
// const btnCloseMovDiariaModal = document.getElementById('btnCloseMovDiariaModal');
// const btnCancelMovDiaria = document.getElementById('btnCancelMovDiaria');
// const btnGenerateMovDiaria = document.getElementById('btnGenerateMovDiaria');
// const movDiariaDate = document.getElementById('movDiariaDate');
// const movDiariaProfessional = document.getElementById('movDiariaProfessional');
// const pagamentosPacientesModal = document.getElementById('pagamentosPacientesModal');
// const btnClosePagamentosPacientesModal = document.getElementById('btnClosePagamentosPacientesModal');
// const btnCancelPagamentosPacientes = document.getElementById('btnCancelPagamentosPacientes');
// const btnGeneratePagamentosPacientes = document.getElementById('btnGeneratePagamentosPacientes');
// const pagamentosPacientesStart = document.getElementById('pagamentosPacientesStart');
// const pagamentosPacientesEnd = document.getElementById('pagamentosPacientesEnd');
// const pagamentosPacientesForma = document.getElementById('pagamentosPacientesForma');

// let currentAgendaAgendamentos = [];

// Agenda DOM Elements
// const agendaDate = document.getElementById('agendaDate');
// const agendaProfessional = document.getElementById('agendaProfessional');
// const btnAgendaRefresh = document.getElementById('btnAgendaRefresh');
// const btnAgendaNew = document.getElementById('btnAgendaNew');
// const agendaSummary = document.getElementById('agendaSummary');
// const agendaSlotsBody = document.getElementById('agendaSlotsBody');
// const agendaEmptyState = document.getElementById('agendaEmptyState');
// const modalAgenda = document.getElementById('modalAgenda');
// const btnCloseModalAgenda = document.getElementById('btnCloseModalAgenda');
// const btnAgendaCancel = document.getElementById('btnAgendaCancel');
// const btnAgendaDelete = document.getElementById('btnAgendaDelete');
// const modalAgendaTitle = document.getElementById('modalAgendaTitle');
// const formAgenda = document.getElementById('formAgenda');
// const agendaId = document.getElementById('agendaId');
// const agendaPaciente = document.getElementById('agendaPaciente');
// const agendaPacienteBusca = document.getElementById('agendaPacienteBusca');
// const agendaPacienteDropdown = document.getElementById('agendaPacienteDropdown');
// const cadastroExpressoContainer = document.getElementById('cadastroExpressoContainer');
// const expNome = document.getElementById('expNome');
// const expCpf = document.getElementById('expCpf');
// const expCelular = document.getElementById('expCelular');
// const expCep = document.getElementById('expCep');
// const agendaTitulo = document.getElementById('agendaTitulo');
// const agendaDataInput = document.getElementById('agendaDataInput');
// const agendaInicio = document.getElementById('agendaInicio');
// const agendaFim = document.getElementById('agendaFim');
// const agendaStatus = document.getElementById('agendaStatus');
// const agendaObs = document.getElementById('agendaObs');

// Consulta/Avaliação DOM Elements
// const consultaDate = document.getElementById('consultaDate');
// const consultaProfessional = document.getElementById('consultaProfessional');
// const btnConsultaRefresh = document.getElementById('btnConsultaRefresh');
// const consultaPacientesTableBody = document.getElementById('consultaPacientesTableBody');
// const consultaEmptyState = document.getElementById('consultaEmptyState');

// Atendimento DOM Elements
// const atendimentoDate = document.getElementById('atendimentoDate');
// const atendimentoProfessional = document.getElementById('atendimentoProfessional');
// const atendimentoProfessionalGroup = document.getElementById('atendimentoProfessionalGroup');
// const btnAtendimentoRefresh = document.getElementById('btnAtendimentoRefresh');
// const btnAtendimentoFinalizeSelected = document.getElementById('btnAtendimentoFinalizeSelected');
// const atendimentoSummary = document.getElementById('atendimentoSummary');
// const atendimentoBody = document.getElementById('atendimentoBody');
// const atendimentoEmptyState = document.getElementById('atendimentoEmptyState');
// const btnFechamentoDiario = document.getElementById('btnFechamentoDiario');
// const fechamentoDiarioModal = document.getElementById('fechamentoDiarioModal');
// const btnCloseFechamentoDiarioModal = document.getElementById('btnCloseFechamentoDiarioModal');
// const btnCancelFechamentoDiario = document.getElementById('btnCancelFechamentoDiario');
// const btnGenerateFechamentoDiario = document.getElementById('btnGenerateFechamentoDiario');
// const fechamentoDiarioDate = document.getElementById('fechamentoDiarioDate');
// const fechamentoDiarioProfessional = document.getElementById('fechamentoDiarioProfessional');
// const btnFechamentoDiarioFull = document.getElementById('btnFechamentoDiarioFull');
// const fechamentoDiarioFullModal = document.getElementById('fechamentoDiarioFullModal');
// const btnCloseFechamentoDiarioFullModal = document.getElementById('btnCloseFechamentoDiarioFullModal');
// const btnCancelFechamentoDiarioFull = document.getElementById('btnCancelFechamentoDiarioFull');
// const btnGenerateFechamentoDiarioFull = document.getElementById('btnGenerateFechamentoDiarioFull');
// const fechamentoDiarioFullDate = document.getElementById('fechamentoDiarioFullDate');
// const fechamentoDiarioFullProfessional = document.getElementById('fechamentoDiarioFullProfessional');

// Commissions DOM Elements
// const commissionsTable = document.getElementById('commissionsTable');
// const commissionsTableBody = document.getElementById('commissionsTableBody');
// const commissionsEmptyState = document.getElementById('commissionsEmptyState');
// const commStatus = document.getElementById('commStatus');
// const commStart = document.getElementById('commStart');
// const commEnd = document.getElementById('commEnd');
// const commProfessional = document.getElementById('commProfessional');
// const btnCommSearch = document.getElementById('btnCommSearch');
// const btnCommPay = document.getElementById('btnCommPay');
// const btnCommAdvance = document.getElementById('btnCommAdvance');
// const btnCommTransfer = document.getElementById('btnCommTransfer');
// const btnCommReworkAdjustment = document.getElementById('btnCommReworkAdjustment');
// const btnCommPrint = document.getElementById('btnCommPrint');
// const btnCommPrintReport = document.getElementById('btnCommPrintReport');
// const commSelectAll = document.getElementById('commSelectAll');
// const commSelectedTotal = document.getElementById('commSelectedTotal');

// const commTransferModal = document.getElementById('commTransferModal');
// const commTransferSummary = document.getElementById('commTransferSummary');
// const commTransferNewProfessional = document.getElementById('commTransferNewProfessional');
// const commTransferObs = document.getElementById('commTransferObs');
// const btnCommTransferCancel = document.getElementById('btnCommTransferCancel');
// const btnCommTransferConfirm = document.getElementById('btnCommTransferConfirm');

// const commReworkAdjustmentModal = document.getElementById('commReworkAdjustmentModal');
// const commReworkAttendanceId = document.getElementById('commReworkAttendanceId');
// const commReworkDebitProfessional = document.getElementById('commReworkDebitProfessional');
// const commReworkDebitValue = document.getElementById('commReworkDebitValue');
// const commReworkCreditProfessional = document.getElementById('commReworkCreditProfessional');
// const commReworkCreditValue = document.getElementById('commReworkCreditValue');
// const commReworkObs = document.getElementById('commReworkObs');
// const btnCommReworkConfirm = document.getElementById('btnCommReworkConfirm');

// const modalSuperAdmin = document.getElementById('modalSuperAdmin');
// const btnCloseModalSuperAdmin = document.getElementById('btnCloseModalSuperAdmin');
// const btnSuperAdminClose = document.getElementById('btnSuperAdminClose');
// const saEmpresa = document.getElementById('saEmpresa');
// const saScope = document.getElementById('saScope');
// const saTableWrap = document.getElementById('saTableWrap');
// const saTable = document.getElementById('saTable');
// const saClearAudit = document.getElementById('saClearAudit');
// const saConfirm = document.getElementById('saConfirm');
// const btnSaDryRun = document.getElementById('btnSaDryRun');
// const btnSaExecute = document.getElementById('btnSaExecute');
// const btnSaRefreshEmpresas = document.getElementById('btnSaRefreshEmpresas');
// const saPlan = document.getElementById('saPlan');
// const saResult = document.getElementById('saResult');

// const serviceImportModal = document.getElementById('serviceImportModal');
// const btnCloseServiceImportModal = document.getElementById('btnCloseServiceImportModal');
// const btnCancelServiceImport = document.getElementById('btnCancelServiceImport');
// const serviceImportFile = document.getElementById('serviceImportFile');
// const serviceImportMode = document.getElementById('serviceImportMode');
// const serviceImportSkipHeader = document.getElementById('serviceImportSkipHeader');
// const btnServiceImportParse = document.getElementById('btnServiceImportParse');
// const serviceImportStatus = document.getElementById('serviceImportStatus');
// const serviceImportPreviewWrap = document.getElementById('serviceImportPreviewWrap');
// const serviceImportPreviewBody = document.getElementById('serviceImportPreviewBody');
// const btnConfirmServiceImport = document.getElementById('btnConfirmServiceImport');
// const btnExportServiceXlsx = document.getElementById('btnExportServiceXlsx');

// const specialtyImportModal = document.getElementById('specialtyImportModal');
// const btnCloseSpecialtyImportModal = document.getElementById('btnCloseSpecialtyImportModal');
// const btnCancelSpecialtyImport = document.getElementById('btnCancelSpecialtyImport');
// const specialtyImportFile = document.getElementById('specialtyImportFile');
// const specialtyImportSkipHeader = document.getElementById('specialtyImportSkipHeader');
// const btnSpecialtyImportParse = document.getElementById('btnSpecialtyImportParse');
// const specialtyImportStatus = document.getElementById('specialtyImportStatus');
// const specialtyImportPreviewWrap = document.getElementById('specialtyImportPreviewWrap');
// const specialtyImportPreviewBody = document.getElementById('specialtyImportPreviewBody');
// const btnConfirmSpecialtyImport = document.getElementById('btnConfirmSpecialtyImport');
// const btnExportSpecialtyXlsx = document.getElementById('btnExportSpecialtyXlsx');
// const subdivisionImportTargetSpecialty = document.getElementById('subdivisionImportTargetSpecialty');
// const subdivisionImportFile = document.getElementById('subdivisionImportFile');
// const subdivisionImportSkipHeader = document.getElementById('subdivisionImportSkipHeader');
// const btnSubdivisionImportParse = document.getElementById('btnSubdivisionImportParse');
// const subdivisionImportStatus = document.getElementById('subdivisionImportStatus');
// const subdivisionImportPreviewWrap = document.getElementById('subdivisionImportPreviewWrap');
// const subdivisionImportPreviewBody = document.getElementById('subdivisionImportPreviewBody');
// const btnConfirmSubdivisionImport = document.getElementById('btnConfirmSubdivisionImport');
// const btnExportSubdivisionXlsx = document.getElementById('btnExportSubdivisionXlsx');
// Active State
// let currentSpecialtySubdivisions = [];
// let deletedSpecialtySubdivisionIds = new Set();
// let editingSubSpecIndex = -1;
// let currentBudgetItems = [];
// let editingBudgetItemId = null;
// let usersAdminList = []; // Cache for user management
// let commissionsList = [];
// let selectedCommissionIds = new Set();
// let proteseOrders = [];
// let proteseLabs = [];
// let currentProteseOrder = null;
// let protesePayables = [];
// let protesePayablesFilteredRows = [];
// let currentProtesePayable = null;

// const btnOpenOdontograma = document.getElementById('btnOpenOdontograma');
// const budItemOdontoDisplay = document.getElementById('budItemOdontoDisplay');
// const budItemOdontoTeeth = document.getElementById('budItemOdontoTeeth');
// const modalOdontograma = document.getElementById('modalOdontograma');
// const btnCloseModalOdonto = document.getElementById('btnCloseModalOdonto');
// const btnCancelOdonto = document.getElementById('btnCancelOdonto');
// const btnConfirmOdonto = document.getElementById('btnConfirmOdonto');
// const odontogramaSvg = document.getElementById('odontogramaSvg');

// Odontograma Faces Modal Elements
// const modalOdontoFaces = document.getElementById('modalOdontoFaces');
// const modalOdontoFacesTitle = document.getElementById('modalOdontoFacesTitle');
// const btnCancelFaces = document.getElementById('btnCancelFaces');
// const btnConfirmFaces = document.getElementById('btnConfirmFaces');
// const odontoFaceBtns = document.querySelectorAll('.odonto-face-btn');
// let currentEditingTooth = null;
// let currentToothFaces = new Set();
// let odontoSelectionsMap = new Map(); // Armazena { tooth: '18', faces: ['V', 'M'] }

// Shared Inputs
// const inputCpf = document.getElementById('cpf');
// const inputCelular = document.getElementById('occ_paciente_celular');
// const inputTelefone = document.getElementById('occ_paciente_telefone');
// const inputCep = document.getElementById('occ_paciente_cep');
// const profCelular = document.getElementById('profCelular');
// const profEmailInput = document.getElementById('profEmail');
// const emailValidationIndicator = document.getElementById('emailValidationIndicator');
// const btnSaveProfessional = document.getElementById('btnSaveProfessional');

// Photo Upload Elements
// const professionalPhotoCapture = document.getElementById('professionalPhotoCapture');
// const professionalPhotoUpload = document.getElementById('professionalPhotoUpload');
// const photoPreview = document.getElementById('photoPreview');
// const photoBase64 = document.getElementById('photoBase64');
// const btnRemovePhoto = document.getElementById('btnRemovePhoto');

// Sidebar Visibility Controller
function updateSidebarVisibility() {
    console.log("DEBUG: updateSidebarVisibility called. Role:", currentUserRole, "IsSuperAdmin:", isSuperAdmin);
    if (isPatientRole()) {
        if (sidebar) sidebar.style.display = 'none';
        const header = document.querySelector('.main-header');
        if (header) header.style.display = '';
        return;
    }
    if (sidebar) sidebar.style.display = '';

    // Core Modules Mapping
    const sidebarMapping = {
        'navDashboard': 'dashboard',
        'navPatients': 'patients',
        'navProfessionals': 'professionals',
        'navSpecialties': 'specialties',
        'navServices': 'services',
        'navBudgets': 'budgets',
        'navFinanceiro': 'financeiro',
        'navCommissions': 'commissions',
        'navMarketingToggle': 'marketing',
        'navMarketing': 'marketing',
        'navWhatsappMarketing': 'whatsappMarketing',
        'navAtendimentoToggle': 'atendimento',
        'navAtendimento': 'atendimento',
        'navConsultaAvaliacao': 'consultaAvaliacao',
        'navAgenda': 'agenda',
        'navProtese': 'protese'
    };

    Object.entries(sidebarMapping).forEach(([id, type]) => {
        const el = document.getElementById(id);
        if (el) {
            let hasPerm = can(getModuleKey(type), 'select');
            
            // Exceção de interface solicitada: 
            // Dentistas (ou profissionais) não devem ver o menu global de "Orçamentos" 
            // para não manipularem todos. Eles criam orçamento via "Nova Avaliação".
            if (id === 'navBudgets' && isDentistRole() && !isAdminRole()) {
                hasPerm = false;
            }

            el.style.display = hasPerm ? 'flex' : 'none';
            console.log(`DEBUG: Sidebar Sync -> ${id} (${type}): ${hasPerm ? 'VISIBLE' : 'HIDDEN'}`);
        }
    });
    const stockPerms = {
        inventory: canAccessStockTab('stockInventory'),
        models: canAccessStockTab('stockModels'),
        mapping: canAccessStockTab('stockMapping'),
        logs: canAccessStockTab('stockLogs'),
        reports: canAccessStockTab('stockReports')
    };
    const hasAnyStock = !!(stockPerms.inventory || stockPerms.models || stockPerms.mapping || stockPerms.logs || stockPerms.reports);
    
    // Explicitly hide the entire nav section if the user doesn't have the base 'estoque' module permission
    const hasBaseStockPerm = can('estoque', 'select');
    if (navEstoqueToggle) navEstoqueToggle.style.display = (hasAnyStock && hasBaseStockPerm) ? 'flex' : 'none';
    if (navInventory) navInventory.style.display = (stockPerms.inventory && hasBaseStockPerm) ? 'flex' : 'none';
    if (navUsageModels) navUsageModels.style.display = (stockPerms.models && hasBaseStockPerm) ? 'flex' : 'none';
    if (navServiceMapping) navServiceMapping.style.display = (stockPerms.mapping && hasBaseStockPerm) ? 'flex' : 'none';
    if (navInventoryLogs) navInventoryLogs.style.display = (stockPerms.logs && hasBaseStockPerm) ? 'flex' : 'none';
    if (navInventoryReports) navInventoryReports.style.display = (stockPerms.reports && hasBaseStockPerm) ? 'flex' : 'none';
    if (!hasAnyStock || !hasBaseStockPerm) {
        if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = 'none';
        if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = 'ri-arrow-down-s-line';
    }

    // Admin Specific Logic (Double check Config sections)
    const navConfigSection = document.getElementById('navConfigSection');
    const navEmpresas = document.getElementById('navEmpresas');
    const navAssinaturas = document.getElementById('navAssinaturas');
    const navMyCompany = document.getElementById('navMyCompany');
    const navFinancialParams = document.getElementById('navFinancialParams');
    const navUsersAdmin = document.getElementById('navUsersAdmin');
    const navCancelledBudgets = document.getElementById('navCancelledBudgets');

    if (isAdminRole()) {
        if (navConfigSection) navConfigSection.style.display = 'block';
        if (navEmpresas) navEmpresas.style.display = isSuperAdmin ? 'flex' : 'none';
        if (navAssinaturas) navAssinaturas.style.display = isSuperAdmin ? 'flex' : 'none';
        if (navMyCompany) navMyCompany.style.display = 'flex';
        if (navFinancialParams) navFinancialParams.style.display = 'flex';
        if (navUsersAdmin) navUsersAdmin.style.display = 'flex';
        if (navCancelledBudgets) navCancelledBudgets.style.display = 'flex';
    } else {
        if (navConfigSection) navConfigSection.style.display = 'none';
        if (navEmpresas) navEmpresas.style.display = 'none';
        if (navAssinaturas) navAssinaturas.style.display = 'none';
        if (navMyCompany) navMyCompany.style.display = 'none';
        if (navFinancialParams) navFinancialParams.style.display = 'none';
        if (navUsersAdmin) navUsersAdmin.style.display = 'none';
        if (navCancelledBudgets) navCancelledBudgets.style.display = 'none';
    }
    applyFinancialOnboardingMenuLock();

    // Forçar liberação: Exceção na lógica de visibilidade para Avaliação/Orçamento
    const view = window.__activeHelpContext;
    if (view === 'budgets' || view === 'evaluation' || view === 'consultaAvaliacao') {
        const btnAdicionarItem = document.getElementById('btnToggleAddItem');
        if (btnAdicionarItem) {
            btnAdicionarItem.classList.remove('hidden');
            btnAdicionarItem.disabled = false;
        }
    }
}

// Navigation Logic
function setActiveTab(tab) {
    if (isPasswordChangeEnforced()) {
        showForcePasswordChangeModal();
        return;
    }
    console.log("setActiveTab called with:", tab);
    window.scrollTo(0, 0);

    // 1. Prepare Navigation Elements safely
    const navElements = [
        navPatients, navProfessionals, navSpecialties, navServices,
        navBudgets, navFinanceiro, navCommissions, navMarketingToggle, navMarketing, navWhatsappMarketing, navAtendimentoToggle, navAtendimento, navConsultaAvaliacao, navAgenda, navProtese, navSuporteTickets, navChatPacientes, navDashboard, navUsersAdminBtn, navEmpresas, navAssinaturas, navMyCompany, navFinancialParams, document.getElementById('navCancelledBudgets'),
        navEstoqueToggle, navInventory, navUsageModels, navServiceMapping, navInventoryLogs, navInventoryReports
    ];

    // 2. Prepare View Elements safely
    const viewMapping = {
          'chatPacientes': [document.getElementById('chatPacientesView')],
          'dashboard': [dashboardView],
        'patientPortal': [patientPortalView],
        'patients': [patientListView, patientFormView],
        'professionals': [professionalListView, professionalFormView],
        'specialties': [specialtiesListView, specialtyFormView],
        'services': [servicesListView, serviceFormView],
        'budgets': [budgetsListView, budgetFormView],
        'usersAdmin': [usersAdminView, userAdminFormView],
        'empresas': [empresasListView, empresaFormView],
        'assinaturas': [assinaturasView],
        'myCompany': [myCompanyView],
        'financialParams': [financialParamsView],
        'financeiro': [financeiroView],
        'commissions': [commissionsView],
        'marketing': [marketingView],
        'whatsappMarketing': [document.getElementById('whatsappMarketingView')],
        'atendimento': [atendimentoView],
        'consultaAvaliacao': [consultaAvaliacaoView],
        'agenda': [agendaView],
        'protese': [proteseView],
        'suporteTickets': [suporteTicketsView],
        'cancelledBudgets': [document.getElementById('cancelledBudgetsView')],
        'stockInventory': [inventoryView],
        'stockModels': [usageModelsView],
        'stockMapping': [serviceMappingView],
        'stockLogs': [inventoryMovementsView],
        'stockReports': [inventoryReportsView]
    };

    // Reset All Nav Items
    navElements.forEach(el => {
        if (el) el.classList.remove('active');
    });
    if (navEstoqueToggle) navEstoqueToggle.classList.remove('expanded');

    // Hide All Views
    Object.values(viewMapping).forEach(views => {
        views.forEach(v => {
            if (v) v.classList.add('hidden');
        });
    });

    // Handle Specific Detail Views (Ficha de Paciente)
    const patientDetailsView = document.getElementById('patientDetailsView');
    if (patientDetailsView) patientDetailsView.classList.add('hidden');
    if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = 'none';
    if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = 'ri-arrow-down-s-line';
    if (navAtendimentoSubmenu) navAtendimentoSubmenu.style.display = 'none';
    if (navAtendimentoToggleIcon) navAtendimentoToggleIcon.className = 'ri-arrow-down-s-line';
    if (navAtendimentoToggle) navAtendimentoToggle.classList.remove('expanded');
    
    if (navMarketingSubmenu) navMarketingSubmenu.style.display = 'none';
    if (navMarketingToggleIcon) navMarketingToggleIcon.className = 'ri-arrow-down-s-line';
    if (navMarketingToggle) navMarketingToggle.classList.remove('expanded');

    // Activate Selected Tab and View
    if (tab === 'patients') {
        if (navPatients) navPatients.classList.add('active');
        showList('patients');
    } else if (tab === 'dashboard') {
        const navD = document.getElementById('navDashboard');
        if (navD) navD.classList.add('active');
        showList('dashboard');
    } else if (tab === 'patientPortal') {
        showList('patientPortal');
    } else if (tab === 'professionals') {
        if (navProfessionals) navProfessionals.classList.add('active');
        showList('professionals');
    } else if (tab === 'specialties') {
        if (navSpecialties) navSpecialties.classList.add('active');
        showList('specialties');
    } else if (tab === 'services') {
        if (navServices) navServices.classList.add('active');
        showList('services');
    } else if (tab === 'budgets') {
        if (navBudgets) navBudgets.classList.add('active');
        showList('budgets');
    } else if (tab === 'usersAdmin') {
        if (navUsersAdminBtn) navUsersAdminBtn.classList.add('active');
        showList('usersAdmin');
    } else if (tab === 'empresas') {
        const navEmp = document.getElementById('navEmpresas');
        if (navEmp) navEmp.classList.add('active');
        showList('empresas');
    } else if (tab === 'assinaturas') {
        if (!isSuperAdmin) {
            showToast('Acesso restrito ao SuperAdmin.', true);
            return;
        }
        const navAssinaturasEl = document.getElementById('navAssinaturas');
        if (navAssinaturasEl) navAssinaturasEl.classList.add('active');
        showList('assinaturas');
    } else if (tab === 'myCompany') {
        if (navMyCompany) navMyCompany.classList.add('active');
        showList('myCompany');
    } else if (tab === 'financialParams') {
        if (navFinancialParams) navFinancialParams.classList.add('active');
        showList('financialParams');
    } else if (tab === 'financeiro') {
        const navFin = document.getElementById('navFinanceiro');
        if (navFin) navFin.classList.add('active');
        const views = (viewMapping && viewMapping.financeiro) ? viewMapping.financeiro : [];
        views.forEach(v => { if (v) v.classList.remove('hidden'); });
        console.log('[OCC SECURITY] Estoque mantendo apenas roteamento visual do financeiro');
    } else if (tab === 'cancelledBudgets') {
        const navCB = document.getElementById('navCancelledBudgets');
        if (navCB) navCB.classList.add('active');
        showList('cancelledBudgets');
    } else if (tab === 'marketing') {
        if (navMarketingToggle) navMarketingToggle.classList.add('expanded');
        if (navMarketing) navMarketing.classList.add('active');
        if (navMarketingSubmenu) navMarketingSubmenu.style.display = 'block';
        if (navMarketingToggleIcon) navMarketingToggleIcon.className = 'ri-arrow-up-s-line';
        showList('marketing');
    } else if (tab === 'whatsappMarketing') {
        if (navMarketingToggle) navMarketingToggle.classList.add('expanded');
        if (navWhatsappMarketing) navWhatsappMarketing.classList.add('active');
        if (navMarketingSubmenu) navMarketingSubmenu.style.display = 'block';
        if (navMarketingToggleIcon) navMarketingToggleIcon.className = 'ri-arrow-up-s-line';
        showList('whatsappMarketing');
    } else if (tab === 'atendimento') {
        if (navAtendimentoToggle) navAtendimentoToggle.classList.add('expanded');
        if (navAtendimento) navAtendimento.classList.add('active');
        if (navAtendimentoSubmenu) navAtendimentoSubmenu.style.display = 'block';
        if (navAtendimentoToggleIcon) navAtendimentoToggleIcon.className = 'ri-arrow-up-s-line';
        showList('atendimento');
    } else if (tab === 'consultaAvaliacao') {
        if (navAtendimentoToggle) navAtendimentoToggle.classList.add('expanded');
        if (navConsultaAvaliacao) navConsultaAvaliacao.classList.add('active');
        if (navAtendimentoSubmenu) navAtendimentoSubmenu.style.display = 'block';
        if (navAtendimentoToggleIcon) navAtendimentoToggleIcon.className = 'ri-arrow-up-s-line';
        showList('consultaAvaliacao');
    } else if (tab === 'agenda') {
        const navA = document.getElementById('navAgenda');
        if (navA) navA.classList.add('active');
        showList('agenda');
    } else if (tab === 'protese') {
        const navP = document.getElementById('navProtese');
        if (navP) navP.classList.add('active');
        showList('protese');
    } else if (tab === 'chatPacientes') {
        if (navChatPacientes) navChatPacientes.classList.add('active');
        showList('chatPacientes');
    } else if (tab === 'suporteTickets') {
        if (navSuporteTickets) navSuporteTickets.classList.add('active');
        showList('suporteTickets');
    } else if (tab === 'stockInventory') {
        if (!canAccessStockTab('stockInventory')) return;
        if (navEstoqueToggle) navEstoqueToggle.classList.add('expanded');
        if (navInventory) navInventory.classList.add('active');
        if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = 'block';
        if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = 'ri-arrow-up-s-line';
        showList('stockInventory');
    } else if (tab === 'stockModels') {
        if (!canAccessStockTab('stockModels')) return;
        if (navEstoqueToggle) navEstoqueToggle.classList.add('expanded');
        if (navUsageModels) navUsageModels.classList.add('active');
        if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = 'block';
        if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = 'ri-arrow-up-s-line';
        showList('stockModels');
    } else if (tab === 'stockMapping') {
        if (!canAccessStockTab('stockMapping')) return;
        if (navEstoqueToggle) navEstoqueToggle.classList.add('expanded');
        if (navServiceMapping) navServiceMapping.classList.add('active');
        if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = 'block';
        if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = 'ri-arrow-up-s-line';
        showList('stockMapping');
    } else if (tab === 'stockLogs') {
        if (!canAccessStockTab('stockLogs')) return;
        if (navEstoqueToggle) navEstoqueToggle.classList.add('expanded');
        if (navInventoryLogs) navInventoryLogs.classList.add('active');
        if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = 'block';
        if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = 'ri-arrow-up-s-line';
        showList('stockLogs');
    } else if (tab === 'stockReports') {
        if (!canAccessStockTab('stockReports')) return;
        if (navEstoqueToggle) navEstoqueToggle.classList.add('expanded');
        if (navInventoryReports) navInventoryReports.classList.add('active');
        if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = 'block';
        if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = 'ri-arrow-up-s-line';
        showList('stockReports');
    } else if (tab === 'professionals_fallback_removed') {
        if (navProfessionals) navProfessionals.classList.add('active');
        showList('professionals');
    }

    // Auto-close sidebar on mobile after clicking a link
    if (window.innerWidth <= 900 && sidebar) {
        sidebar.classList.remove('active');
    }
}

async function loadGlobalData() {
    // Valida apenas a sessão ativa (rápido)
    const session = await waitForResolvedSession();
    if (!session) {
        showLoginUi();
        throw new Error("Sessão expirada");
    }
}

async function loadTabData(tab) {
    if (!db || !currentEmpresaId) return;
    
    const updates = [];

    // Pacientes
    if (['patients', 'budgets', 'atendimento', 'consultaAvaliacao', 'dashboard', 'marketing', 'whatsappMarketing'].includes(tab)) {
        updates.push(db.from('pacientes').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }).then(res => { if(res.data) patients = res.data; }));
    }

    // Profissionais
    if (['professionals', 'agenda', 'atendimento', 'consultaAvaliacao', 'budgets', 'dashboard'].includes(tab)) {
        updates.push(db.from('profissionais').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }).then(res => { if(res.data) professionals = res.data; }));
    }

    // Especialidades e Subdivisões
    if (['specialties', 'services', 'professionals', 'budgets'].includes(tab)) {
        updates.push(db.from('especialidades').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }).then(async res => {
            if(res.data) {
                const rawSpecialties = res.data;
                const subRes = await db.from('especialidade_subdivisoes').select('*').eq('empresa_id', currentEmpresaId);
                const subdivisions = subRes.data || [];
                const seenIds = new Set();
                specialties = rawSpecialties.filter(s => {
                    if (seenIds.has(s.id)) return false;
                    seenIds.add(s.id);
                    return true;
                });
                specialties.forEach(spec => {
                    spec.subdivisoes = subdivisions.filter(sub => String(sub.especialidade_id) === String(spec.id));
                });
            }
        }));
    }

    // Serviços
    if (['services', 'budgets', 'atendimento'].includes(tab)) {
        updates.push(db.from('servicos').select('*').eq('empresa_id', currentEmpresaId).order('descricao', { ascending: true }).then(res => { if(res.data) services = res.data; }));
    }

    // Orçamentos e Itens
    if (['budgets', 'atendimento', 'consultaAvaliacao', 'cancelledBudgets', 'dashboard'].includes(tab)) {
        let bQuery = db.from('orcamentos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: false });
        if (typeof isSuperAdmin !== 'undefined' && !isSuperAdmin && typeof isAdminRole !== 'undefined' && !isAdminRole()) {
            const uEmail = String(currentUser && currentUser.email ? currentUser.email : '').trim().toLowerCase();
            const profObj = (professionals || []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
            if (profObj && profObj.seqid != null) {
                bQuery = bQuery.eq('profissional_id', Number(profObj.seqid));   
            } else {
                bQuery = bQuery.eq('profissional_id', -1);
            }
        }
        
        updates.push(bQuery.then(async res => {
            if(res.data) {
                const fetchedBudgets = res.data;
                const itensRes = await db.from('orcamento_itens').select('*').eq('empresa_id', currentEmpresaId);
                if (!itensRes.error) {
                    const itens = itensRes.data || [];
                    const byBudgetId = new Map();
                    itens.forEach(it => {
                        const k = String(it.orcamento_id || it.orcamentoid || '');
                        if (!k) return;
                        if (!byBudgetId.has(k)) byBudgetId.set(k, []);
                        byBudgetId.get(k).push(it);
                    });
                    fetchedBudgets.forEach(b => {
                        const k1 = String(b.id || '');
                        const k2 = String(b.seqid || '');
                        b.orcamento_itens = byBudgetId.get(k1) || byBudgetId.get(k2) || [];
                    });
                } else {
                    fetchedBudgets.forEach(b => { b.orcamento_itens = []; });
                }
                budgets = fetchedBudgets;
            }
        }));
    }

    // Empresas
    if (['empresas', 'myCompany', 'assinaturas'].includes(tab)) {
        updates.push(
            (isSuperAdmin ? db.from('empresas').select('*').order('nome') : db.from('empresas').select('*').eq('id', currentEmpresaId))
            .then(res => { if(res.data) activeEmpresasList = res.data; })
        );
    }

    await Promise.all(updates);
}

function setupNavigationListeners() {
    const navMapping = {
        'navDashboard': 'dashboard',
        'navPatients': 'patients',
        'navProfessionals': 'professionals',
        'navSpecialties': 'specialties',
        'navServices': 'services',
        'navBudgets': 'budgets',
        'navFinanceiro': 'financeiro',
        'navCommissions': 'commissions',
        'navMarketing': 'marketing',
        'navWhatsappMarketing': 'whatsappMarketing',
        'navAtendimento': 'atendimento',
        'navConsultaAvaliacao': 'consultaAvaliacao',
        'navAgenda': 'agenda',
        'navProtese': 'protese',
        'navSuporteTickets': 'suporteTickets',
        'navChatPacientes': 'chatPacientes',
        'navInventory': 'stockInventory',
        'navUsageModels': 'stockModels',
        'navServiceMapping': 'stockMapping',
        'navInventoryLogs': 'stockLogs',
        'navInventoryReports': 'stockReports',
        'navUsersAdmin': 'usersAdmin',
        'navEmpresas': 'empresas',
        'navAssinaturas': 'assinaturas',
        'navMyCompany': 'myCompany',
        'navFinancialParams': 'financialParams',
        'navCancelledBudgets': 'cancelledBudgets',
        'navSuporteTickets': 'suporteTickets'
    };

    Object.entries(navMapping).forEach(([id, tab]) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = async () => {
                const ok = await validateAssinaturaStatusGate({ reason: `menu:${tab}` }).catch(() => true);
                if (!ok) return;

                // Injeção de Refresh on Navigation
                try {
                    const currentTab = String(sessionStorage.getItem('lastTab') || '');
                    
                    // Cache Inteligente: Se o usuário já estiver na mesma aba, não recarrega do banco
                    if (currentTab === tab) {
                        setActiveTab(tab);
                        return;
                    }

                    // Define a tab de destino no storage
                    try { sessionStorage.setItem('lastTab', tab); } catch { }
                    bootPreferredTab = tab;
                    
                    // Otimização: Carrega apenas o essencial e o específico da aba
                    await loadGlobalData();
                    await loadTabData(tab);
                } catch (e) {
                    console.error("Erro ao atualizar dados na navegação:", e);
                }
                
                // Renderiza a tela após a atualização
                setActiveTab(tab);
            };
        }
    });

    if (navEstoqueToggle) {
        navEstoqueToggle.onclick = () => {
            if (!canAccessStockTab('stockInventory') && !canAccessStockTab('stockModels') && !canAccessStockTab('stockMapping') && !canAccessStockTab('stockLogs') && !canAccessStockTab('stockReports')) return;
            const open = navEstoqueSubmenu && navEstoqueSubmenu.style.display !== 'none';
            if (navEstoqueSubmenu) navEstoqueSubmenu.style.display = open ? 'none' : 'block';
            if (navEstoqueToggleIcon) navEstoqueToggleIcon.className = open ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
            navEstoqueToggle.classList.toggle('expanded', !open);
        };
    }

    if (navAtendimentoToggle) {
        navAtendimentoToggle.onclick = () => {
            const open = navAtendimentoSubmenu && navAtendimentoSubmenu.style.display !== 'none';
            if (navAtendimentoSubmenu) navAtendimentoSubmenu.style.display = open ? 'none' : 'block';
            if (navAtendimentoToggleIcon) navAtendimentoToggleIcon.className = open ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
            navAtendimentoToggle.classList.toggle('expanded', !open);
        };
    }

    if (navMarketingToggle) {
        navMarketingToggle.onclick = () => {
            const open = navMarketingSubmenu && navMarketingSubmenu.style.display !== 'none';
            if (navMarketingSubmenu) navMarketingSubmenu.style.display = open ? 'none' : 'block';
            if (navMarketingToggleIcon) navMarketingToggleIcon.className = open ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
            navMarketingToggle.classList.toggle('expanded', !open);
        };
    }

    if (!window.__sidebarArrowNavInit) {
        window.__sidebarArrowNavInit = true;
        document.addEventListener('keydown', (e) => {
            if (!e || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            const navRoot = document.querySelector('.sidebar-nav');
            if (!navRoot) return;
            const buttons = Array.from(navRoot.querySelectorAll('.nav-item')).filter(el => {
                if (!el) return false;
                if (el.style && el.style.display === 'none') return false;
                return el.offsetParent !== null;
            });
            if (!buttons.length) return;
            const current = buttons.findIndex(el => el.classList.contains('active'));
            const focused = buttons.findIndex(el => el === document.activeElement);
            const base = focused >= 0 ? focused : (current >= 0 ? current : 0);
            const next = e.key === 'ArrowDown'
                ? ((base + 1) % buttons.length)
                : ((base - 1 + buttons.length) % buttons.length);
            const target = buttons[next];
            if (!target) return;
            e.preventDefault();
            target.focus();
            target.click();
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.onclick = () => {
            sidebar.classList.toggle('active');
        };
    }

    // Sidebar Toggle (Desktop/Global)
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle && sidebar) {
        sidebarToggle.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('collapsed');
            const icon = sidebarToggle.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                icon.className = 'ri-menu-unfold-line';
            } else {
                icon.className = 'ri-menu-fold-line';
            }
        };
    }
}

function toDec(value, fallback = 0) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    let s = raw.replace(/\s+/g, '');
    s = s.replace(/^R\$\s*/i, '');
    const neg = s.startsWith('-');
    if (neg) s = s.slice(1);
    if (s.includes(',')) {
        s = s.replace(/\./g, '');
        s = s.replace(/,/g, '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
        s = s.replace(/\./g, '');
    }
    s = s.replace(/[^\d.]/g, '');
    if (neg) s = `-${s}`;
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
}

function formatNumberBR(value, decimals = 2) {
    const n = toDec(value, 0);
    const fixed = n.toFixed(Math.max(0, Number(decimals) || 0));
    const [intRaw, decRaw] = fixed.split('.');
    const intPart = String(intRaw || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (!decRaw || Number(decimals) === 0) return intPart;
    return `${intPart},${decRaw}`;
}

function formatCurrencyBR(value) {
    return `R$ ${formatNumberBR(value, 2)}`;
}

function sanitizeDecimalBRInput(value, maxDecimals = 2) {
    let s = String(value ?? '');
    s = s.replace(/[^\d,\.]/g, '');
    if (s.includes(',')) {
        s = s.replace(/\./g, '');
    } else if (s.includes('.')) {
        const partsDot = s.split('.');
        const decRaw = partsDot.pop() || '';
        const intRaw = partsDot.join('');
        s = decRaw.length ? `${intRaw},${decRaw}` : intRaw;
    }
    const parts = s.split(',');
    if (parts.length === 1) return parts[0];
    const intPart = parts[0];
    const decPart = parts.slice(1).join('').slice(0, Math.max(0, Number(maxDecimals) || 0));
    return `${intPart},${decPart}`;
}

function formatFactor3FromDigits(digits) {
    const intPart = String(digits || '').replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '') || '0';
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${grouped},000`;
}

function bindNumericMasks() {
    if (window.__occNumericMasksBound) return;
    window.__occNumericMasksBound = true;
    const applyMask = (el, phase = 'input') => {
        if (!el || !el.dataset) return;
        const mask = String(el.dataset.mask || '').trim();
        if (!mask) return;
        const v = String(el.value ?? '');
        const maxIntRaw = String(el.dataset.maxInt || '').trim();
        const maxIntDigits = maxIntRaw ? Math.max(1, toDec(maxIntRaw, 0)) : 18;
        if (mask === 'currency') {
            const maxDigits = Math.max(3, maxIntDigits + 2);
            const digits = v.replace(/[^\d]/g, '').slice(0, maxDigits);
            const cents = toDec(digits, 0);
            const amount = cents / 100;
            el.value = digits ? formatCurrencyBR(amount) : '';
            return;
        }
        if (mask === 'decimal2' || mask === 'money') {
            if (phase === 'input') {
                const s = sanitizeDecimalBRInput(v, 2);
                const hasComma = s.includes(',');
                const parts = s.split(',');
                const intPart = String(parts[0] || '').replace(/[^\d]/g, '').slice(0, maxIntDigits).replace(/^0+(?=\d)/, '') || '0';
                const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                if (!hasComma) {
                    el.value = intFmt === '0' && String(v || '').trim() === '' ? '' : intFmt;
                } else {
                    const decPart = String(parts[1] || '').replace(/[^\d]/g, '').slice(0, 2);
                    el.value = `${intFmt},${decPart}`;
                }
            } else {
                if (String(el.value || '').trim() === '') return;
                el.value = formatNumberBR(toDec(el.value, 0), 2);
            }
            return;
        }
        if (mask === 'int') {
            const digits = v.replace(/[^\d]/g, '');
            if (phase === 'input') {
                el.value = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
            } else {
                el.value = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
            }
            return;
        }
        if (mask === 'factor3') {
            const digits = v.replace(/[^\d]/g, '');
            if (phase === 'input') {
                el.value = digits;
            } else {
                if (digits) el.value = formatFactor3FromDigits(digits);
            }
            return;
        }
    };
    document.addEventListener('input', (e) => {
        const el = e && e.target;
        if (!(el instanceof HTMLInputElement)) return;
        applyMask(el, 'input');
    }, true);
    document.addEventListener('blur', (e) => {
        const el = e && e.target;
        if (!(el instanceof HTMLInputElement)) return;
        applyMask(el, 'blur');
    }, true);
    document.querySelectorAll('input[data-mask]').forEach(el => applyMask(el, 'blur'));
}

function isUuidLike(v) {
    const s = String(v || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

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

function getInventoryNameById(id) {
    const row = (inventoryItems || []).find(x => String(x && x.id || '') === String(id || ''));
    return row && row.nome ? String(row.nome) : '—';
}

function getInventoryById(id) {
    return (inventoryItems || []).find(x => String(x && x.id || '') === String(id || '')) || null;
}

function normalizeInventoryName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeBarcode(value) {
    return String(value || '').trim();
}

function normalizeInventoryArea(value) {
    return String(value || '').trim();
}

function normalizeUnitCode(value) {
    return String(value || '').trim().toLowerCase();
}

function isAllowedUnitCode(unit) {
    const u = normalizeUnitCode(unit);
    return ['g', 'kg', 'ml', 'l', 'un', 'par', 'pt', 'cx', 'fl', 'tb', 'rl', 'ct'].includes(u);
}

function getUnitGroup(unit) {
    const u = normalizeUnitCode(unit);
    if (u === 'g' || u === 'kg') return 'mass';
    if (u === 'ml' || u === 'l') return 'volume';
    if (u === 'un' || u === 'par' || u === 'pt' || u === 'cx' || u === 'fl' || u === 'tb' || u === 'rl' || u === 'ct') return 'count';
    return '';
}

function getSameGroupScaleFactor(compra, consumo) {
    const a = normalizeUnitCode(compra);
    const b = normalizeUnitCode(consumo);
    if (a === b) return 1;
    if (a === 'kg' && b === 'g') return 1000;
    if (a === 'l' && b === 'ml') return 1000;
    return 0;
}

function syncInventoryConversionUiFromInputs() {
    const compraEl = document.getElementById('inventoryUnidade');
    const consumoEl = document.getElementById('inventoryUnidadeMedida');
    const wrap = document.getElementById('inventoryFatorConversaoWrap');
    const fatorEl = document.getElementById('inventoryFatorConversao');
    const hint = document.getElementById('inventoryUnidadeConsumoHint');
    if (!compraEl || !consumoEl || !wrap || !fatorEl) return;
    const compra = normalizeUnitCode(compraEl.value);
    const consumo = normalizeUnitCode(consumoEl.value);
    if (hint) {
        if (consumo) hint.classList.remove('hidden');
        else hint.classList.add('hidden');
    }
    const differs = !!compra && !!consumo && compra !== consumo;
    if (differs) {
        wrap.classList.remove('hidden');
        fatorEl.required = true;
        const scale = getSameGroupScaleFactor(compra, consumo);
        if (scale && !String(fatorEl.value || '').trim()) fatorEl.value = String(scale);
    } else {
        wrap.classList.add('hidden');
        fatorEl.required = false;
        fatorEl.value = '1';
    }
}

function getCanonicalInventoryAreas() {
    return ['Cirurgia', 'Instrumental', 'Biossegurança', 'Prótese', 'Dentística', 'Endodontia', 'Harmonização Facial', 'Implantodontia', 'Ortodontia', 'Periodontia', 'Consultório'];
}

function getAreaFromModelName(name) {
    const raw = String(name || '').trim();
    const value = raw.replace(/^kit\s+/i, '').trim();
    const canonical = getCanonicalInventoryAreas();
    const match = canonical.find(a => normalizeKey(a) === normalizeKey(value));
    return match || '';
}

function getInventoryArea(item) {
    const raw = normalizeInventoryArea(item && (item.area || item.categoria) || '');
    if (raw) return raw;
    const invId = String(item && item.id || '');
    if (invId && inventoryAreaById.has(invId)) return String(inventoryAreaById.get(invId) || '');
    return '';
}

function getInventoryAreaBadgeStyle(area) {
    const key = normalizeKey(String(area || ''));
    if (!key) return null;
    const palette = {
        'endodontia': { bg: 'rgba(16, 185, 129, 0.14)', color: '#047857', border: 'rgba(16, 185, 129, 0.30)' },
        'ortodontia': { bg: 'rgba(245, 158, 11, 0.16)', color: '#b45309', border: 'rgba(245, 158, 11, 0.34)' },
        'periodontia': { bg: 'rgba(34, 211, 238, 0.16)', color: '#0e7490', border: 'rgba(34, 211, 238, 0.34)' },
        'cirurgia': { bg: 'rgba(239, 68, 68, 0.14)', color: '#b91c1c', border: 'rgba(239, 68, 68, 0.30)' },
        'instrumental': { bg: 'rgba(148, 163, 184, 0.22)', color: '#334155', border: 'rgba(148, 163, 184, 0.40)' },
        'implantodontia': { bg: 'rgba(99, 102, 241, 0.16)', color: '#4338ca', border: 'rgba(99, 102, 241, 0.34)' },
        'dentistica': { bg: 'rgba(59, 130, 246, 0.14)', color: '#1d4ed8', border: 'rgba(59, 130, 246, 0.30)' },
        'harmonizacao facial': { bg: 'rgba(236, 72, 153, 0.14)', color: '#9d174d', border: 'rgba(236, 72, 153, 0.30)' },
        'harmonizacao': { bg: 'rgba(236, 72, 153, 0.14)', color: '#9d174d', border: 'rgba(236, 72, 153, 0.30)' },
        'limpeza': { bg: 'rgba(148, 163, 184, 0.22)', color: '#334155', border: 'rgba(148, 163, 184, 0.40)' },
        'consultorio': { bg: 'rgba(148, 163, 184, 0.22)', color: '#334155', border: 'rgba(148, 163, 184, 0.40)' },
        'maquinas': { bg: 'rgba(148, 163, 184, 0.22)', color: '#334155', border: 'rgba(148, 163, 184, 0.40)' },
        'ti': { bg: 'rgba(148, 163, 184, 0.22)', color: '#334155', border: 'rgba(148, 163, 184, 0.40)' }
    };
    if (palette[key]) return palette[key];
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) - hash) + key.charCodeAt(i);
    const hue = Math.abs(hash) % 360;
    return {
        bg: `hsla(${hue}, 72%, 52%, 0.14)`,
        color: `hsl(${hue}, 62%, 34%)`,
        border: `hsla(${hue}, 72%, 44%, 0.28)`
    };
}

function isInventoryConsumable(item) {
    if (!item) return true;
    if (item.eh_consumivel === false || String(item.eh_consumivel).toLowerCase() === 'false' || Number(item.eh_consumivel) === 0) return false;
    return true;
}

function isInventoryActive(item) {
    if (!item) return false;
    if (item.ativo === false || String(item.ativo).toLowerCase() === 'false' || Number(item.ativo) === 0) return false;
    return true;
}

function normalizeInventoryTypeKey(value) {
    const raw = normalizeKey(String(value || ''));
    if (!raw) return '';
    if (raw.includes('consum')) return 'consumiveis';
    if (raw.includes('cirurg')) return 'cirurgia';
    if (raw.includes('instrument')) return 'instrumentais';
    if (raw.includes('equip')) return 'equipamentos';
    if (raw.includes('admin')) return 'administrativo';
    return raw;
}

function getInventoryFunctionalType(item) {
    const explicitType = normalizeInventoryTypeKey(item && (item.tipo_inventario || item.tipo_item || item.tipo || item.tipo_estoque || item.classificacao_tipo) || '');
    if (explicitType === 'consumiveis' || explicitType === 'cirurgia' || explicitType === 'instrumentais' || explicitType === 'equipamentos' || explicitType === 'administrativo') {
        return explicitType;
    }
    const name = normalizeKey(String(item && item.nome || ''));
    const equipmentNeedles = ['autoclave', 'compressor', 'fotopolimerizador', 'cadeira', 'raio x', 'rx', 'ultrassom', 'motor'];
    const adminNeedles = ['papel', 'sulfite', 'copo', 'detergente', 'alcool 70', 'álcool 70', 'limpeza', 'escritorio', 'escritório', 'toner'];
    if (equipmentNeedles.some(x => name.includes(normalizeKey(x)))) return 'equipamentos';
    if (adminNeedles.some(x => name.includes(normalizeKey(x)))) return 'administrativo';
    return isInventoryConsumable(item) ? 'consumiveis' : 'instrumentais';
}

// const areasClinicas = ['Dentística', 'Endodontia', 'Periodontia', 'Cirurgia', 'Implantodontia', 'Ortodontia', 'Harmonização Facial'];
// const areasAdmin = ['Limpeza', 'Escritório', 'Copa'];
// const areasEquip = ['Máquinas', 'TI', 'Consultório'];

function getInventoryAreasByType(typeKey) {
    const k = normalizeInventoryTypeKey(typeKey);
    if (k === 'administrativo') {
        return areasAdmin;
    }
    if (k === 'equipamentos') {
        return areasEquip;
    }
    if (k === 'consumiveis' || k === 'instrumentais') {
        return areasClinicas;
    }
    return areasClinicas;
}

function syncInventoryAreaByType(typeKey, preferredArea = '') {
    const areaInput = document.querySelector('select[id*="area"]') || document.getElementsByName('area')[0] || document.getElementById('inventoryArea');
    if (!areaInput) return;
    const options = getInventoryAreasByType(typeKey);
    areaInput.innerHTML = '';
    options.forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        areaInput.appendChild(opt);
    });
    const preferred = String(preferredArea || '').trim();
    if (preferred && options.includes(preferred)) {
        areaInput.value = preferred;
    } else {
        areaInput.value = options[0] || '';
    }
    const ehConsumivel = document.getElementById('inventoryEhConsumivel');
    if (ehConsumivel) {
        const k = normalizeInventoryTypeKey(typeKey);
        ehConsumivel.checked = (k === 'consumiveis');
    }
}

window.updateInventoryAreaOptionsForTipoInventario = function () {
    const inventoryTipoInventarioInput = document.getElementById('inventoryTipoInventario');
    if (!inventoryTipoInventarioInput) return;
    console.log('Troquei o tipo para:', inventoryTipoInventarioInput.value);
    const selectedText = inventoryTipoInventarioInput.options && inventoryTipoInventarioInput.selectedIndex >= 0
        ? String(inventoryTipoInventarioInput.options[inventoryTipoInventarioInput.selectedIndex]?.textContent || '')
        : '';
    const labelKey = normalizeKey(selectedText);
    let typeKey = '';
    if (labelKey.includes('administr')) typeKey = 'administrativo';
    else if (labelKey.includes('equip')) typeKey = 'equipamentos';
    else if (labelKey.includes('instrument')) typeKey = 'instrumentais';
    else if (labelKey.includes('consum')) typeKey = 'consumiveis';
    else typeKey = normalizeInventoryTypeKey(String(inventoryTipoInventarioInput.value || ''));
    syncInventoryAreaByType(typeKey, '');
};

function ensureInventoryTipoAreaBinding() {
    const tipo = document.getElementById('inventoryTipoInventario');
    if (!tipo) return;
    const handler = () => {
        if (window.updateInventoryAreaOptionsForTipoInventario) {
            window.updateInventoryAreaOptionsForTipoInventario();
        } else {
            syncInventoryAreaByType(String(tipo.value || ''), '');
        }
    };
    tipo.onchange = handler;
    tipo.oninput = handler;
}

function isEhConsumivelSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('eh_consumivel') && (msg.includes('schema cache') || msg.includes('column'));
}

function isCodigoBarrasSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('codigo_barras') && (msg.includes('schema cache') || msg.includes('column'));
}

function isAreaSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('area') && (msg.includes('schema cache') || msg.includes('column'));
}

function isCategoriaSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('categoria') && (msg.includes('schema cache') || msg.includes('column'));
}

function isAtivoSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('ativo') && (msg.includes('schema cache') || msg.includes('column'));
}

function isPrecoCustoSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('preco_custo') && (msg.includes('schema cache') || msg.includes('column'));
}

function isUnidadeMedidaSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('unidade_medida') && (msg.includes('schema cache') || msg.includes('column'));
}

function isFatorConversaoSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('fator_conversao') && (msg.includes('schema cache') || msg.includes('column'));
}

function isTipoInventarioSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('tipo_inventario') && (msg.includes('schema cache') || msg.includes('column'));
}

function isValorTotalNfSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('valor_total_nf') && (msg.includes('schema cache') || msg.includes('column'));
}

function isMotivoSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('motivo') && (msg.includes('schema cache') || msg.includes('column'));
}

function isOrcamentoItemIdSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('orcamento_item_id') && (msg.includes('schema cache') || msg.includes('column'));
}

function isIncludeBiossegSchemaError(error) {
    const msg = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
    return msg.includes('include_biosseguranca') && (msg.includes('schema cache') || msg.includes('column'));
}

function warnEhConsumivelPendingMigration() {
    if (inventoryEhConsumivelWarned) return;
    inventoryEhConsumivelWarned = true;
    showToast('Campo eh_consumivel ainda não disponível no banco. Aplique a migration para habilitar instrumentais sem baixa.', true);
}

async function saveInventoryRowWithFallback({ id = '', payload = {}, withSelect = false } = {}) {
    const rid = String(id || '').trim();
    let p = { ...payload };
    const run = async () => {
        if (rid) return db.from('inventory').update(p).eq('id', rid);
        let q = db.from('inventory').insert(p);
        if (withSelect) q = q.select('*').maybeSingle();
        return q;
    };
    let res = await run();
    if (res && res.error && isEhConsumivelSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'eh_consumivel')) {
        inventorySupportsEhConsumivel = false;
        warnEhConsumivelPendingMigration();
        const { eh_consumivel, ...rest } = p;
        p = rest;
        res = await run();
    } else if (res && !res.error && Object.prototype.hasOwnProperty.call(p, 'eh_consumivel')) {
        inventorySupportsEhConsumivel = true;
    }
    if (res && res.error && isCodigoBarrasSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'codigo_barras')) {
        inventorySupportsCodigoBarras = false;
        const { codigo_barras, ...rest } = p;
        p = rest;
        res = await run();
    } else if (res && !res.error && Object.prototype.hasOwnProperty.call(p, 'codigo_barras')) {
        inventorySupportsCodigoBarras = true;
    }
    if (res && res.error && isAreaSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'area')) {
        inventorySupportsArea = false;
        const { area, ...rest } = p;
        p = rest;
        res = await run();
    } else if (res && !res.error && Object.prototype.hasOwnProperty.call(p, 'area')) {
        inventorySupportsArea = true;
    }
    if (res && res.error && isCategoriaSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'categoria')) {
        const { categoria, ...rest } = p;
        p = rest;
        res = await run();
    }
    if (res && res.error && isPrecoCustoSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'preco_custo')) {
        inventorySupportsPrecoCusto = false;
        const { preco_custo, ...rest } = p;
        p = rest;
        res = await run();
    } else if (res && !res.error && Object.prototype.hasOwnProperty.call(p, 'preco_custo')) {
        inventorySupportsPrecoCusto = true;
    }
    if (res && res.error && isUnidadeMedidaSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'unidade_medida')) {
        inventorySupportsUnidadeMedida = false;
        const { unidade_medida, ...rest } = p;
        p = rest;
        res = await run();
    } else if (res && !res.error && Object.prototype.hasOwnProperty.call(p, 'unidade_medida')) {
        inventorySupportsUnidadeMedida = true;
    }
    if (res && res.error && isFatorConversaoSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'fator_conversao')) {
        inventorySupportsFatorConversao = false;
        const { fator_conversao, ...rest } = p;
        p = rest;
        res = await run();
    } else if (res && !res.error && Object.prototype.hasOwnProperty.call(p, 'fator_conversao')) {
        inventorySupportsFatorConversao = true;
    }
    if (res && res.error && isTipoInventarioSchemaError(res.error) && Object.prototype.hasOwnProperty.call(p, 'tipo_inventario')) {
        inventorySupportsTipoInventario = false;
        const { tipo_inventario, ...rest } = p;
        p = rest;
        res = await run();
    } else if (res && !res.error && Object.prototype.hasOwnProperty.call(p, 'tipo_inventario')) {
        inventorySupportsTipoInventario = true;
    }
    return res;
}

function getServiceModelId(serviceId) {
    const sid = String(serviceId || '').trim();
    if (!sid) return '';
    const row = (serviceModelMappings || []).find(m => String(m && m.service_id || '') === sid);
    return row && row.model_id ? String(row.model_id) : '';
}

function resolveBiossegModelId() {
    const models = Array.isArray(usageModels) ? usageModels : [];
    if (!models.length) return '';
    const candidates = models
        .map(m => ({ m, k: normalizeKey(String(m && m.nome_modelo || '')) }))
        .filter(x => x.k.includes('BIOSSEGUR'));
    if (!candidates.length) return '';
    const exact = candidates.filter(x => x.k.includes('BIOSSEGURAN'));
    const pickFrom = exact.length ? exact : candidates;
    pickFrom.sort((a, b) => {
        const aCount = (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === String(a.m && a.m.id || '')).length;
        const bCount = (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === String(b.m && b.m.id || '')).length;
        if (aCount !== bCount) return bCount - aCount;
        return String(a.m && a.m.nome_modelo || '').localeCompare(String(b.m && b.m.nome_modelo || ''), 'pt-BR');
    });
    return String(pickFrom[0] && pickFrom[0].m && pickFrom[0].m.id || '').trim();
}

async function ensureBiossegKitExists({ silent = false } = {}) {
    await loadEstoqueData(true);
    const existing = resolveBiossegModelId();
    if (existing) return existing;
    if (!(isSuperAdmin || isAdminRole())) return '';
    const empId = getEstoqueEmpresaScopeId();
    if (!empId) return '';
    let ins = await db.from('usage_models').insert({ empresa_id: empId, nome_modelo: 'Kit Biossegurança', include_biosseguranca: true });
    if (ins && ins.error && isIncludeBiossegSchemaError(ins.error)) {
        ins = await db.from('usage_models').insert({ empresa_id: empId, nome_modelo: 'Kit Biossegurança' });
    }
    if (ins && ins.error) {
        if (!silent) showToast(ins.error.message || 'Falha ao criar Kit Biossegurança.', true);
        return '';
    }
    await loadEstoqueData(true);
    const created = resolveBiossegModelId();
    if (created) {
        const inj = await injectBiossegItemsIntoModel(created);
        if (inj && inj.ok) await loadEstoqueData(true);
    }
    return created;
}

async function purgeBiossegItemsFromModel(modelId) {
    const mid = String(modelId || '').trim();
    if (!mid) return;
    await loadEstoqueData(true);
    const biossegId = resolveBiossegModelId();
    if (!biossegId) return;
    const biossegItems = (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === biossegId);
    const invIds = Array.from(new Set(biossegItems.map(mi => String(mi && mi.inventory_id || '')).filter(Boolean)));
    if (!invIds.length) return;
    await db.from('model_items').delete().eq('model_id', mid).in('inventory_id', invIds);
}

function getModelItemsByModelId(modelId) {
    const mid = String(modelId || '').trim();
    if (!mid) return [];
    const model = (usageModels || []).find(m => String(m && m.id || '') === mid) || null;
    const includeBiosseg = !(model && model.include_biosseguranca === false);
    const baseItems = (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === mid);
    const biossegModelId = resolveBiossegModelId();
    const biossegItems = biossegModelId ? (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === biossegModelId) : [];
    const biossegInvIds = new Set(biossegItems.map(mi => String(mi && mi.inventory_id || '')).filter(Boolean));
    if (!includeBiosseg) {
        return baseItems.filter(mi => !biossegInvIds.has(String(mi && mi.inventory_id || '')));
    }
    const existingInvIds = new Set(baseItems.map(mi => String(mi && mi.inventory_id || '')).filter(Boolean));
    const merged = baseItems.slice();
    biossegItems.forEach(mi => {
        const invId = String(mi && mi.inventory_id || '');
        if (!invId || existingInvIds.has(invId)) return;
        merged.push({ ...mi, model_id: mid, __inherited: true });
        existingInvIds.add(invId);
    });
    return merged;
}

function openModelItemsConfigPrompt(modelId) {
    const mid = String(modelId || '').trim();
    const model = (usageModels || []).find(m => String(m && m.id || '') === mid) || null;
    const modelName = String(model && model.nome_modelo || 'Modelo de Uso');
    return new Promise((resolve) => {
        const prev = document.getElementById('stockModelEmptyPrompt');
        if (prev) prev.remove();
        const overlay = document.createElement('div');
        overlay.id = 'stockModelEmptyPrompt';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(15,23,42,0.5)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '200010';
        overlay.innerHTML = `
            <div style="background:#fff; width:min(560px,94vw); border-radius:12px; box-shadow:0 18px 45px rgba(2,6,23,.28); padding:20px;">
                <h3 style="margin:0 0 8px 0; color:#0f172a;">Modelo sem itens</h3>
                <p style="margin:0 0 14px 0; color:#475569;">O serviço está vinculado ao modelo <strong>${modelName}</strong>, mas ele está vazio.</p>
                <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                    <button type="button" id="btnCfgModelItems" class="btn btn-primary">Configurar Itens deste Modelo</button>
                    <button type="button" id="btnSkipModelItems" class="btn btn-secondary">Concluir sem baixa</button>
                    <button type="button" id="btnCancelModelItems" class="btn btn-secondary">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const finish = (result) => {
            overlay.remove();
            resolve(result);
        };
        const btnCfg = document.getElementById('btnCfgModelItems');
        const btnSkip = document.getElementById('btnSkipModelItems');
        const btnCancel = document.getElementById('btnCancelModelItems');
        if (btnCfg) btnCfg.onclick = () => {
            estoqueActiveModelId = mid;
            setActiveTab('stockModels');
            setTimeout(() => {
                renderUsageModelsTable();
                renderModelItemsEditor();
            }, 60);
            finish({ ok: false, reason: 'configure_model' });
        };
        if (btnSkip) btnSkip.onclick = () => finish({ ok: true, skipped: true });
        if (btnCancel) btnCancel.onclick = () => finish({ ok: false, reason: 'cancelled' });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) finish({ ok: false, reason: 'cancelled' }); });
    });
}

async function getBudgetItemContext(budgetId, itemId) {
    const bid = String(budgetId || '').trim();
    const iid = String(itemId || '').trim();
    let budget = (budgets || []).find(b => String(b && b.id || '') === bid || String(b && b.seqid || '') === bid) || null;
    let item = null;
    if (iid) {
        const { data, error } = await withTimeout(
            db.from('orcamento_itens')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('id', iid)
                .maybeSingle(),
            15000,
            'orcamento_itens:checkout_context'
        );
        if (!error && data) item = data;
    }
    if (!item && budget && Array.isArray(budget.orcamento_itens)) {
        item = budget.orcamento_itens.find(it => String(it && it.id || '') === iid) || null;
    }
    return { budget, item };
}

function isDbMissingColumnError(err, columnName) {
    const msg = String(err && err.message || '').toLowerCase();
    const col = String(columnName || '').toLowerCase();
    if (!msg || !col) return false;
    return msg.includes(col) && (msg.includes('does not exist') || msg.includes('não existe') || msg.includes('nao existe'));
}

function isInvalidUuidError(err) {
    const msg = String(err && (err.message || err.details || err.hint) || '').toLowerCase();
    return msg.includes('invalid input syntax for type uuid');
}

function isUuidLike(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());
}

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
            let sq = db.from('servicos')
                .select('id')
                .eq('seqid', seq)
                .maybeSingle();
            let rs = await withTimeout(sq, 15000, 'servicos:resolve_id_by_seqid');
            if (rs && !rs.error && rs.data && rs.data.id) sid = String(rs.data.id).trim();
        }
    }
    if (!isUuidLike(sid)) return '';
    let q = db.from('service_mapping')
        .select('model_id')
        .eq('service_id', sid)
        .maybeSingle();
    let { data, error } = await withTimeout(q, 15000, 'service_mapping:model_id');
    if (error && isInvalidUuidError(error)) return '';
    if (error) throw error;
    return String(data && data.model_id || '').trim();
}

async function fetchUsageModelFromDb(modelId) {
    const mid = String(modelId || '').trim();
    if (!mid) return null;
    const empId = String(currentEmpresaId || '').trim();
    let q = db.from('usage_models')
        .select('id,nome_modelo,include_biosseguranca,empresa_id')
        .eq('id', mid);
    if (empId) q = q.eq('empresa_id', empId);
    q = q.maybeSingle();
    let { data, error } = await withTimeout(q, 15000, 'usage_models:one');
    if (error && isDbMissingColumnError(error, 'empresa_id')) {
        q = db.from('usage_models')
            .select('id,nome_modelo,include_biosseguranca')
            .eq('id', mid)
            .maybeSingle();
        ({ data, error } = await withTimeout(q, 15000, 'usage_models:one:no_emp'));
    }
    if (error) throw error;
    return data || null;
}

async function fetchBiossegModelIdFromDb() {
    const empId = String(currentEmpresaId || '').trim();
    let q = db.from('usage_models')
        .select('id,nome_modelo');
    if (empId) q = q.eq('empresa_id', empId);
    let { data, error } = await withTimeout(q, 15000, 'usage_models:biosseg');
    if (error && isDbMissingColumnError(error, 'empresa_id')) {
        q = db.from('usage_models')
            .select('id,nome_modelo');
        ({ data, error } = await withTimeout(q, 15000, 'usage_models:biosseg:no_emp'));
    }
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const candidates = rows
        .map(r => ({ r, k: normalizeKey(String(r && r.nome_modelo || '')) }))
        .filter(x => x.k.includes('BIOSSEGUR'));
    if (!candidates.length) {
        const local = (usageModels || [])
            .map(r => ({ r, k: normalizeKey(String(r && r.nome_modelo || '')) }))
            .filter(x => x.k.includes('BIOSSEGUR'));
        if (!local.length) return '';
        const exactLocal = local.filter(x => x.k.includes('BIOSSEGURAN'));
        const pickLocal = (exactLocal.length ? exactLocal : local)
            .sort((a, b) => String(a.r && a.r.nome_modelo || '').localeCompare(String(b.r && b.r.nome_modelo || ''), 'pt-BR'))[0];
        return String(pickLocal && pickLocal.r && pickLocal.r.id || '').trim();
    }
    const exact = candidates.filter(x => x.k.includes('BIOSSEGURAN'));
    const pick = (exact.length ? exact : candidates)
        .sort((a, b) => String(a.r && a.r.nome_modelo || '').localeCompare(String(b.r && b.r.nome_modelo || ''), 'pt-BR'))[0];
    return String(pick && pick.r && pick.r.id || '').trim();
}

async function fetchModelItemsFromDb(modelId) {
    let mid = String(modelId || '').trim();
    if (!mid) return [];
    if (!isUuidLike(mid)) {
        const local = (usageModels || []).find(m => String(m && m.seqid || '') === mid || String(m && m.id || '') === mid);
        if (local && local.id) mid = String(local.id).trim();
    }
    if (!isUuidLike(mid)) return [];
    let q = db.from('model_items')
        .select('inventory_id,quantidade_sugerida')
        .eq('model_id', mid);
    let { data, error } = await withTimeout(q, 20000, 'model_items:by_model');
    if (error && isInvalidUuidError(error)) return [];
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

async function fetchInventoryByIdsFromDb(ids = []) {
    const empId = String(currentEmpresaId || '').trim();
    const list = Array.from(new Set((Array.isArray(ids) ? ids : []).map(x => String(x || '').trim()).filter(Boolean)));
    if (!list.length) return [];
    const out = [];
    for (const chunk of splitIntoChunks(list, 200)) {
        let q = db.from('inventory')
            .select('id,nome,unidade,unidade_medida,fator_conversao,preco_custo,estoque_atual,estoque_minimo,tipo_inventario,eh_consumivel,ativo')
            .in('id', chunk)
            .eq('empresa_id', empId);
        let { data, error } = await withTimeout(q, 20000, 'inventory:by_ids');
        if (error && isDbMissingColumnError(error, 'empresa_id')) {
            q = db.from('inventory')
                .select('id,nome,unidade,unidade_medida,fator_conversao,preco_custo,estoque_atual,estoque_minimo,tipo_inventario,eh_consumivel,ativo')
                .in('id', chunk);
            ({ data, error } = await withTimeout(q, 20000, 'inventory:by_ids:no_emp'));
        }
        if (error) throw error;
        if (Array.isArray(data)) out.push(...data);
    }
    return out;
}

async function fetchServicoFromDb(serviceId) {
    const sid = String(serviceId || '').trim();
    if (!sid) return null;
    const empId = String(currentEmpresaId || '').trim();
    let q = db.from('servicos')
        .select('id,descricao,subdivisao,empresa_id')
        .eq('empresa_id', empId)
        .eq('id', sid)
        .maybeSingle();
    let { data, error } = await withTimeout(q, 15000, 'servicos:one');
    if (error && isDbMissingColumnError(error, 'empresa_id')) {
        q = db.from('servicos')
            .select('id,descricao,subdivisao')
            .eq('id', sid)
            .maybeSingle();
        ({ data, error } = await withTimeout(q, 15000, 'servicos:one:no_emp'));
    }
    if (error) throw error;
    return data || null;
}

function buildCheckoutMaterialList({ baseItems = [], includeBiosseg = true, biossegItems = [] } = {}) {
    const byInv = new Map();
    const add = (mi, inherited) => {
        const invId = String(mi && mi.inventory_id || '').trim();
        if (!invId) return;
        const qtd = toDec(mi && mi.quantidade_sugerida, 1);
        const prev = byInv.get(invId);
        if (!prev) {
            byInv.set(invId, { inventory_id: invId, quantidade_sugerida: qtd, __inherited: !!inherited });
            return;
        }
        byInv.set(invId, {
            ...prev,
            quantidade_sugerida: toDec(prev && prev.quantidade_sugerida, 0) + qtd,
            __inherited: !!(prev && prev.__inherited) || !!inherited
        });
    };
    (Array.isArray(baseItems) ? baseItems : []).forEach(mi => add(mi, false));
    if (includeBiosseg) (Array.isArray(biossegItems) ? biossegItems : []).forEach(mi => add(mi, true));
    return Array.from(byInv.values());
}

function getBiossegFallbackItemsFromInventory() {
    const invRows = Array.isArray(inventoryItems) ? inventoryItems : [];
    const findByNeedle = (needles = []) => {
        const list = Array.isArray(needles) ? needles : [];
        const row = invRows.find((i) => {
            const k = normalizeKey(String(i && i.nome || ''));
            return list.some((n) => k.includes(normalizeKey(String(n || ''))));
        }) || null;
        return row ? String(row.id || '').trim() : '';
    };
    const rules = [
        { invId: findByNeedle(['luva estéril', 'luva esteril', 'luva']), qtd: 2 },
        { invId: findByNeedle(['mascara', 'máscara']), qtd: 1 },
        { invId: findByNeedle(['sugador']), qtd: 1 },
        { invId: findByNeedle(['touca']), qtd: 1 },
        { invId: findByNeedle(['babador']), qtd: 1 }
    ].filter((r) => String(r && r.invId || '').trim());
    return rules.map((r) => ({ inventory_id: String(r.invId || ''), quantidade_sugerida: toDec(r.qtd, 0), __inherited: true }));
}

async function fetchBiossegFallbackItemsFromDb() {
    const empId = getEstoqueEmpresaScopeId();
    if (!empId) return [];
    const needles = ['luva', 'mascara', 'máscara', 'sugador', 'touca', 'babador'];
    const orParts = needles.map((n) => `nome.ilike.%${String(n).replaceAll(',', '')}%`).join(',');
    let q = db.from('inventory').select('id,nome').eq('empresa_id', empId).or(orParts).limit(200);
    let { data, error } = await withTimeout(q, 20000, 'inventory:biosseg_fallback');
    if (error && isDbMissingColumnError(error, 'empresa_id')) {
        q = db.from('inventory').select('id,nome').or(orParts).limit(200);
        ({ data, error } = await withTimeout(q, 20000, 'inventory:biosseg_fallback:no_emp'));
    }
    if (error) return [];
    const rows = Array.isArray(data) ? data : [];
    const byNeedle = (parts = []) => {
        const list = Array.isArray(parts) ? parts : [];
        return rows.find((r) => {
            const k = normalizeKey(String(r && r.nome || ''));
            return list.some((n) => k.includes(normalizeKey(String(n || ''))));
        }) || null;
    };
    const rules = [
        { row: byNeedle(['luva estéril', 'luva esteril', 'luva']), qtd: 2 },
        { row: byNeedle(['mascara', 'máscara']), qtd: 1 },
        { row: byNeedle(['sugador']), qtd: 1 },
        { row: byNeedle(['touca']), qtd: 1 },
        { row: byNeedle(['babador']), qtd: 1 }
    ].filter((r) => r && r.row && r.row.id);
    return rules.map((r) => ({ inventory_id: String(r.row.id || ''), quantidade_sugerida: toDec(r.qtd, 0), __inherited: true }));
}

function ensureStockCheckoutModal() {
    let overlay = document.getElementById('modalCheckOutEstoque');
    if (overlay) return overlay;
    const html = `
        <div id="modalCheckOutEstoque" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 860px; width: 95%;">
                <div class="modal-header" style="flex-direction: column; align-items: stretch;">
                    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                        <h3><i class="ri-archive-stack-line"></i> Check-out de Estoque</h3>
                        <button type="button" class="btn-close-modal" id="btnCloseModalCheckOutEstoque"><i class="ri-close-line"></i></button>
                    </div>
                    <div id="checkoutProgressBarContainer" style="width: 100%; height: 4px; background: var(--border-color); margin-top: 12px; border-radius: 2px; display: none; overflow: hidden;">
                        <div id="checkoutProgressBar" style="width: 0%; height: 100%; background: var(--primary-color); transition: width 0.3s ease;"></div>
                    </div>
                </div>
                <div class="modal-body" style="max-height: 72vh; overflow-y: auto;">
                    <div id="checkOutEstoqueSummary" style="margin-bottom: 10px; color: var(--text-muted);"></div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                        <input type="checkbox" id="selectAllCheckoutItems" style="transform: scale(1.2); cursor: pointer;" title="Marcar/Desmarcar Todos">
                                        <label for="selectAllCheckoutItems" style="margin:0; cursor: pointer;">Usar</label>
                                    </th>
                                    <th>Material</th>
                                    <th>Qtd Sugerida</th>
                                    <th>Qtd Usada</th>
                                </tr>
                            </thead>
                            <tbody id="checkOutEstoqueBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer" style="display:flex; justify-content:flex-end; gap: 0.75rem;">
                    <button type="button" class="btn btn-secondary" id="btnCancelCheckOutEstoque">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="btnConfirmCheckOutEstoque">Confirmar Check-out</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    overlay = document.getElementById('modalCheckOutEstoque');
    return overlay;
}

async function modalCheckOutEstoque({ budgetId, itemId, agendamentoId }) {
    if (window.__occCheckoutModalFinish && typeof window.__occCheckoutModalFinish === 'function') {
        try { window.__occCheckoutModalFinish({ ok: false, reason: 'cancelled' }); } catch { }
        window.__occCheckoutModalFinish = null;
    }

    const { item } = await getBudgetItemContext(budgetId, itemId);
    const serviceId = String(item && (item.servico_id || item.servicoId) || '').trim();
    if (!serviceId) return { ok: true, skipped: true };

    let modelId = '';
    try {
        modelId = await fetchServiceModelIdFromDb(serviceId);
    } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Falha ao buscar Modelo do serviço.';
        showToast(msg, true);
        return { ok: false, reason: 'model_lookup_error', message: msg };
    }
    if (!modelId) {
        const proceed = confirm('Este serviço não possui Modelo de Uso vinculado. Concluir item sem baixar material?');
        return { ok: !!proceed, skipped: true };
    }
    let modelRow = null;
    try {
        modelRow = await fetchUsageModelFromDb(modelId);
    } catch { }
    const modelName = String(modelRow && modelRow.nome_modelo || '').trim();
    const includeBiosseg = !(modelRow && modelRow.include_biosseguranca === false);
    let serviceRow = null;
    try {
        serviceRow = await fetchServicoFromDb(serviceId);
    } catch { }
    const serviceDesc = String(serviceRow && serviceRow.descricao || '').trim();

    let baseItems = [];
    try {
        baseItems = await fetchModelItemsFromDb(modelId);
    } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Falha ao buscar itens do modelo.';
        showToast(msg, true);
        return { ok: false, reason: 'model_items_error', message: msg };
    }

    let biossegItems = [];
    if (includeBiosseg) {
        try {
            const biossegId = await fetchBiossegModelIdFromDb();
            if (biossegId && biossegId !== String(modelId)) {
                biossegItems = await fetchModelItemsFromDb(biossegId);
            }
        } catch { }
        if (!biossegItems.length) {
            const biossegLocalId = resolveBiossegModelId();
            if (biossegLocalId && biossegLocalId !== String(modelId || '')) {
                biossegItems = (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === String(biossegLocalId));
            }
        }
        if (!biossegItems.length) {
            biossegItems = await fetchBiossegFallbackItemsFromDb();
        }
        if (!biossegItems.length) {
            biossegItems = getBiossegFallbackItemsFromInventory();
        }
    }

    if (!baseItems.length) {
        baseItems = (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === String(modelId || ''));
    }

    const mItems = buildCheckoutMaterialList({ baseItems, includeBiosseg, biossegItems })
        .sort((a, b) => String(a && a.inventory_id || '').localeCompare(String(b && b.inventory_id || '')));

    const invIds = mItems.map(mi => String(mi && mi.inventory_id || '')).filter(Boolean);
    let invRows = [];
    try {
        invRows = await fetchInventoryByIdsFromDb(invIds);
    } catch { }
    const invById = new Map(invRows.map(r => [String(r && r.id || ''), r]));
    const visibleItems = mItems.filter(mi => !(includeBiosseg && mi && mi.__inherited));

    if (!mItems.length) {
        return await openModelItemsConfigPrompt(modelId);
    }

    if (visibleItems.length === 0 || window.__isConsultaAvaliacaoMode) {
        // Apenas itens de biossegurança: baixar silenciosamente
        try {
            const selectedMap = new Map();
            if (includeBiosseg) {
                mItems.forEach((mi) => {
                    if (!(mi && mi.__inherited)) return;
                    const invId = String(mi && mi.inventory_id || '').trim();
                    if (!invId || selectedMap.has(invId)) return;
                    const qtdForced = Math.max(1, toDec(mi && mi.quantidade_sugerida, 0));
                    selectedMap.set(invId, { mi, qtd: qtdForced });
                });
            }
            const selected = Array.from(selectedMap.values());
            if (!selected.length) return { ok: true, skipped: true };

            const atendimentoRef = String(agendamentoId || itemId || '').trim() || null;
            const itemIdStr = String(itemId || '').trim();
            const motivo = atendimentoRef ? `Atendimento #${atendimentoRef}${modelName ? ` (${modelName})` : ''}` : '';
            
            for (const row of selected) {
                const invId = String(row && row.mi && row.mi.inventory_id || '');
                const inv = invById.get(invId) || getInventoryById(invId);
                if (!inv) continue;
                const consumivel = isInventoryConsumable(inv);
                if (consumivel) {
                    const novo = toDec(inv && inv.estoque_atual, 0) - toDec(row.qtd, 0);
                    const { error: updErr } = await db.from('inventory').update({ estoque_atual: novo }).eq('id', invId);
                    if (updErr) throw updErr;
                    try {
                        const nextInv = { ...inv, estoque_atual: novo };
                        invById.set(invId, nextInv);
                        const local = (inventoryItems || []).find(i => String(i && i.id || '') === String(invId));
                        if (local) local.estoque_atual = novo;
                    } catch { }
                }
                let payload = {
                    empresa_id: getEstoqueEmpresaScopeId(),
                    inventory_id: invId,
                    atendimento_id: atendimentoRef,
                    orcamento_item_id: itemIdStr || null,
                    tipo: consumivel ? 'SAIDA' : 'USO',
                    quantidade: toDec(row.qtd, 0),
                    motivo,
                    responsavel_id: currentUser && currentUser.id ? currentUser.id : null
                };
                let ins = await db.from('inventory_logs').insert(payload);
                if (ins && ins.error && isMotivoSchemaError(ins.error)) {
                    const { motivo, ...rest } = payload;
                    payload = rest;
                    ins = await db.from('inventory_logs').insert(payload);
                }
                if (ins && ins.error && isOrcamentoItemIdSchemaError(ins.error)) {
                    throw new Error("Schema cache desatualizado para inventory_logs.orcamento_item_id.");
                }
                if (ins && ins.error && isMotivoSchemaError(ins.error)) {
                    const { motivo, ...rest } = payload;
                    payload = rest;
                    ins = await db.from('inventory_logs').insert(payload);
                }
                if (ins && ins.error) throw ins.error;
            }
            await loadEstoqueData(true);
            return { ok: true, applied: true };
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Falha no check-out silencioso de estoque.';
            showToast(msg, true);
            return { ok: false, reason: 'error', message: msg };
        }
    }

    const overlay = ensureStockCheckoutModal();
    const body = document.getElementById('checkOutEstoqueBody');
    const summary = document.getElementById('checkOutEstoqueSummary');
    const btnClose = document.getElementById('btnCloseModalCheckOutEstoque');
    const btnCancel = document.getElementById('btnCancelCheckOutEstoque');
    const btnConfirm = document.getElementById('btnConfirmCheckOutEstoque');
    const selectAllCheckbox = document.getElementById('selectAllCheckoutItems');
    const progressBarContainer = document.getElementById('checkoutProgressBarContainer');
    const progressBar = document.getElementById('checkoutProgressBar');
    if (!overlay || !body || !btnCancel || !btnConfirm || !btnClose) return { ok: false, reason: 'modal_unavailable' };

    overlay.classList.add('hidden');
    btnCancel.onclick = null;
    btnClose.onclick = null;
    btnConfirm.onclick = null;
    
    // Reset select all
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.onchange = (e) => {
            const isChecked = e.target.checked;
            const checkboxes = body.querySelectorAll('.js-stock-use');
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
            });
        };
    }
    
    // Reset progress bar
    if (progressBarContainer && progressBar) {
        progressBarContainer.style.display = 'none';
        progressBar.style.width = '0%';
    }

    if (summary) {
        summary.innerHTML = `
            <div><strong>ID do Item:</strong> ${escapeHtml(String(itemId || '—'))} • <strong>ID do Modelo:</strong> ${escapeHtml(String(modelId || '—'))}</div>
            <div><strong>ID do Serviço:</strong> ${escapeHtml(String(serviceId || '—'))} • <strong>Serviço:</strong> ${escapeHtml(serviceDesc || '—')}</div>
            <div><strong>Modelo:</strong> ${escapeHtml(modelName || '—')} • <strong>Itens:</strong> ${escapeHtml(String(mItems.length))}</div>
            <div class="checkout-build-line"><strong>Checkout Build:</strong> 20260413-01 • <strong>Biosseg:</strong> ${escapeHtml(includeBiosseg ? 'ON' : 'OFF')} • <strong>Base:</strong> ${escapeHtml(String(baseItems.length))} • <strong>Biosseg Itens:</strong> ${escapeHtml(String(biossegItems.length))}</div>
            <div>${escapeHtml(`Atendimento: ${String(agendamentoId || itemId || '—')}`)}</div>
        `;
    }

    body.innerHTML = '';
    mItems.forEach((mi, idx) => {
        const forced = !!(includeBiosseg && mi && mi.__inherited);
        if (forced) return; // Hide biosafety items from the UI

        const suggested = toDec(mi && mi.quantidade_sugerida, 1);
        const invId = String(mi && mi.inventory_id || '').trim();
        const inv = invById.get(invId) || getInventoryById(invId);
        const consumivel = isInventoryConsumable(inv);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="js-stock-use" data-row="${idx}"></td>
            <td>${escapeHtml(String(inv && inv.nome || getInventoryNameById(invId) || 'Material'))} ${consumivel ? '' : '<span class="inventory-alert" title="Item instrumental - sem baixa de saldo"><i class="ri-shield-keyhole-line"></i> Instrumental</span>'}</td>
            <td>${suggested.toFixed(2)}</td>
            <td><input type="text" class="form-control js-stock-qtd" data-row="${idx}" inputmode="decimal" data-mask="decimal2" value="${formatNumberBR(suggested, 2)}"></td>
        `;
        body.appendChild(tr);
    });

    overlay.classList.remove('hidden');
    return await new Promise((resolve) => {
        let done = false;
        let isSaving = false;
        const setSavingUi = (saving) => {
            isSaving = !!saving;
            if (btnConfirm) {
                btnConfirm.disabled = isSaving;
                btnConfirm.innerHTML = isSaving
                    ? `<i class="ri-hourglass-line"></i> Processando...`
                    : `Confirmar Check-out`;
            }
            if (btnCancel) btnCancel.disabled = isSaving;
            if (btnClose) btnClose.disabled = isSaving;
        };
        const finish = (result) => {
            if (done) return;
            done = true;
            setSavingUi(false);
            try { if (window.__occCheckoutModalFinish === finish) window.__occCheckoutModalFinish = null; } catch { }
            overlay.classList.add('hidden');
            btnCancel.onclick = null;
            btnClose.onclick = null;
            btnConfirm.onclick = null;
            resolve(result);
        };
        window.__occCheckoutModalFinish = finish;
        btnCancel.onclick = () => { if (!isSaving) finish({ ok: false, reason: 'cancelled' }); };
        btnClose.onclick = () => { if (!isSaving) finish({ ok: false, reason: 'cancelled' }); };
        btnConfirm.onclick = async () => {
            setSavingUi(true);
            try {
                const selectedMap = new Map();
                mItems.forEach((mi, idx) => {
                    const ck = body.querySelector(`.js-stock-use[data-row="${idx}"]`);
                    const qtdInput = body.querySelector(`.js-stock-qtd[data-row="${idx}"]`);
                    const forced = !!(includeBiosseg && mi && mi.__inherited);
                    if ((!ck || !ck.checked) && !forced) return;
                    let qtd = toDec(qtdInput && qtdInput.value, 0);
                    if (qtd <= 0 && forced) qtd = toDec(mi && mi.quantidade_sugerida, 0);
                    if (qtd <= 0 && forced) qtd = 1;
                    if (qtd <= 0) return;
                    const invId = String(mi && mi.inventory_id || '').trim();
                    if (!invId) return;
                    const prev = selectedMap.get(invId);
                    if (!prev) {
                        selectedMap.set(invId, { mi, qtd });
                        return;
                    }
                    selectedMap.set(invId, { mi: prev.mi || mi, qtd: toDec(prev.qtd, 0) + qtd });
                });
                if (includeBiosseg) {
                    mItems.forEach((mi) => {
                        if (!(mi && mi.__inherited)) return;
                        const invId = String(mi && mi.inventory_id || '').trim();
                        if (!invId || selectedMap.has(invId)) return;
                        const qtdForced = Math.max(1, toDec(mi && mi.quantidade_sugerida, 0));
                        selectedMap.set(invId, { mi, qtd: qtdForced });
                    });
                }
                const selected = Array.from(selectedMap.values());
                if (!selected.length) {
                    const proceed = confirm('Nenhum material foi marcado. Concluir item sem baixa de estoque?');
                    if (!proceed) return;
                    finish({ ok: true, skipped: true });
                    return;
                }
                const atendimentoRef = String(agendamentoId || itemId || '').trim() || null;
                const itemIdStr = String(itemId || '').trim();
                console.log('StockCheckout Context:', { budgetId: String(budgetId || ''), agendamentoId: String(agendamentoId || ''), itemId: itemIdStr, selectedCount: selected.length });
                const motivo = atendimentoRef ? `Atendimento #${atendimentoRef}${modelName ? ` (${modelName})` : ''}` : '';
                
                // Show and init progress bar
                if (progressBarContainer && progressBar) {
                    progressBarContainer.style.display = 'block';
                    progressBar.style.width = '0%';
                }
                
                let processedCount = 0;
                const totalCount = selected.length;
                
                for (const row of selected) {
                    const invId = String(row && row.mi && row.mi.inventory_id || '');
                    const inv = invById.get(invId) || getInventoryById(invId);
                    if (!inv) {
                        processedCount++;
                        if (progressBar) progressBar.style.width = `${(processedCount / totalCount) * 100}%`;
                        continue;
                    }
                    const consumivel = isInventoryConsumable(inv);
                    if (consumivel) {
                        const novo = toDec(inv && inv.estoque_atual, 0) - toDec(row.qtd, 0);
                        const { error: updErr } = await db.from('inventory').update({ estoque_atual: novo }).eq('id', invId);
                        if (updErr) throw updErr;
                        try {
                            const nextInv = { ...inv, estoque_atual: novo };
                            invById.set(invId, nextInv);
                            const local = (inventoryItems || []).find(i => String(i && i.id || '') === String(invId));
                            if (local) local.estoque_atual = novo;
                        } catch { }
                    }
                    let payload = {
                        empresa_id: getEstoqueEmpresaScopeId(),
                        inventory_id: invId,
                        atendimento_id: atendimentoRef,
                        orcamento_item_id: itemIdStr || null,
                        tipo: consumivel ? 'SAIDA' : 'USO',
                        quantidade: toDec(row.qtd, 0),
                        motivo,
                        responsavel_id: currentUser && currentUser.id ? currentUser.id : null
                    };
                    console.log('Gravando Log:', itemIdStr || null, payload);
                    let ins = await db.from('inventory_logs').insert(payload);
                    if (ins && ins.error && isMotivoSchemaError(ins.error)) {
                        const { motivo, ...rest } = payload;
                        payload = rest;
                        ins = await db.from('inventory_logs').insert(payload);
                    }
                    if (ins && ins.error && isOrcamentoItemIdSchemaError(ins.error)) {
                        throw new Error("Schema cache desatualizado para inventory_logs.orcamento_item_id. Recarregue o schema do PostgREST (NOTIFY pgrst, 'reload schema') e tente novamente.");
                    }
                    if (ins && ins.error && isMotivoSchemaError(ins.error)) {
                        const { motivo, ...rest } = payload;
                        payload = rest;
                        ins = await db.from('inventory_logs').insert(payload);
                    }
                    if (ins && ins.error) throw ins.error;
                    console.log('Log gravado com sucesso:', { inventory_id: invId, atendimento_id: atendimentoRef, orcamento_item_id: itemIdStr || null });
                    
                    processedCount++;
                    if (progressBar) progressBar.style.width = `${(processedCount / totalCount) * 100}%`;
                }
                
                // Força visualização do final antes de fechar (opcional, pode fechar rápido)
                if (progressBar) progressBar.style.width = '100%';
                
                await loadEstoqueData(true);
                finish({ ok: true, applied: true });
            } catch (err) {
                const msg = err && err.message ? String(err.message) : 'Falha no check-out de estoque.';
                showToast(msg, true);
                finish({ ok: false, reason: 'error', message: msg });
            }
        };
    });
}

async function processStockOut({ budgetId, itemId, agendamentoId }) {
    const key = `${String(currentEmpresaId || '')}::${String(itemId || '')}::${String(agendamentoId || '')}`;
    window.__occStockOutLocks = window.__occStockOutLocks || new Map();
    const locks = window.__occStockOutLocks;
    if (locks.has(key)) return await locks.get(key);
    const p = (async () => await modalCheckOutEstoque({ budgetId, itemId, agendamentoId }))();
    locks.set(key, p);
    try {
        return await p;
    } finally {
        try { locks.delete(key); } catch { }
    }
}

async function tryCloseBudgetFromItems(budgetId) {
    const bid = String(budgetId || '').trim();
    if (!bid) return { closed: false };

    let budgetRow = null;
    try {
        const byId = await db.from('orcamentos').select('id,seqid,status').eq('empresa_id', currentEmpresaId).eq('id', bid).maybeSingle();
        if (!byId.error && byId.data) budgetRow = byId.data;
        if (!budgetRow) {
            const n = Number(bid);
            if (Number.isFinite(n)) {
                const bySeq = await db.from('orcamentos').select('id,seqid,status').eq('empresa_id', currentEmpresaId).eq('seqid', n).maybeSingle();
                if (!bySeq.error && bySeq.data) budgetRow = bySeq.data;
            }
        }
    } catch { }

    const refs = Array.from(new Set([bid, String(budgetRow && budgetRow.id || '')].filter(Boolean)));
    let items = [];
    for (const ref of refs) {
        if (String(ref).length < 20) continue; // Bloqueia consulta com seqid na coluna UUID
        const { data, error } = await db.from('orcamento_itens').select('status').eq('empresa_id', currentEmpresaId).eq('orcamento_id', ref);
        if (!error && Array.isArray(data) && data.length) {
            items = data;
            break;
        }
    }
    const allDone = Array.isArray(items)
        && items.length > 0
        && items.every(it => {
            const s = normalizeStatusKey(String(it && it.status || ''));
            return s === 'FINALIZADO' || s === 'CONCLUIDO';
        });
    if (allDone) {
        if (budgetRow && budgetRow.id) {
            await db.from('orcamentos').update({ status: 'Executado' }).eq('empresa_id', currentEmpresaId).eq('id', budgetRow.id);
        } else {
            await db.from('orcamentos').update({ status: 'Executado' }).eq('empresa_id', currentEmpresaId).eq('id', bid);
            const n = Number(bid);
            if (Number.isFinite(n)) {
                await db.from('orcamentos').update({ status: 'Executado' }).eq('empresa_id', currentEmpresaId).eq('seqid', n);
            }
        }
    }

    if (!budgetRow) {
        try {
            const byId = await db.from('orcamentos').select('id,seqid,status').eq('empresa_id', currentEmpresaId).eq('id', bid).maybeSingle();
            if (!byId.error && byId.data) budgetRow = byId.data;
            if (!budgetRow) {
                const n = Number(bid);
                if (Number.isFinite(n)) {
                    const bySeq = await db.from('orcamentos').select('id,seqid,status').eq('empresa_id', currentEmpresaId).eq('seqid', n).maybeSingle();
                    if (!bySeq.error && bySeq.data) budgetRow = bySeq.data;
                }
            }
        } catch { }
    }
    const statusNow = normalizeKey(String(budgetRow && budgetRow.status || ''));
    return { closed: statusNow === 'executado', budget: budgetRow };
}

// const STOCK_MASTER_MODEL_DEFS = [
//     { key: 'biosseguranca', nome: 'Kit Biossegurança' },
//     { key: 'clinico', nome: 'Kit Clínico Geral' },
//     { key: 'dentistica', nome: 'Kit Dentística' },
//     { key: 'ortodontia', nome: 'Kit Ortodontia' },
//     { key: 'implantodontia', nome: 'Kit Implantodontia' },
//     { key: 'endodontia', nome: 'Kit Endodontia' },
//     { key: 'periodontia', nome: 'Kit Periodontia' },
//     { key: 'cirurgia', nome: 'Kit Cirurgia' },
//     { key: 'harmonizacao', nome: 'Kit Harmonização Facial' },
//     { key: 'odontopediatria', nome: 'Kit Odontopediatria' },
//     { key: 'protese', nome: 'Kit Prótese Dentária' }
// ];

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

async function seedStockMasterData({ silent = false } = {}) {
    if (!(isSuperAdmin || isAdminRole())) return { ok: false, reason: 'forbidden' };
    const empId = getEstoqueEmpresaScopeId();
    if (!empId) return { ok: false, reason: 'missing_scope' };
    await loadEstoqueData(true);
    const existingByName = new Map((usageModels || []).map(m => [normalizeKey(String(m && m.nome_modelo || '')), m]));
    for (const def of STOCK_MASTER_MODEL_DEFS) {
        const k = normalizeKey(def.nome);
        if (existingByName.has(k)) continue;
        const { error } = await db.from('usage_models').insert({ empresa_id: empId, nome_modelo: def.nome });
        if (error && !silent) showToast(`Falha ao criar modelo ${def.nome}: ${error.message || 'erro'}`, true);
    }
    await loadEstoqueData(true);

    const modelByKey = new Map();
    (usageModels || []).forEach(m => {
        const nameKey = normalizeKey(String(m && m.nome_modelo || ''));
        const matched = STOCK_MASTER_MODEL_DEFS.find(def => nameKey.includes(normalizeKey(def.nome)) || nameKey.includes(def.key));
        if (matched) modelByKey.set(matched.key, String(m.id));
    });

    const specialtyById = new Map((specialties || []).map(s => [String(s && s.id || ''), String(s && s.nome || '')]));
    const existingMapByService = new Map();
    (serviceModelMappings || []).forEach(m => {
        const sid = String(m && m.service_id || '');
        if (!sid) return;
        existingMapByService.set(sid, String(m && m.model_id || ''));
    });
    for (const serv of (services || [])) {
        const sid = String(serv && serv.id || '');
        if (!sid) continue;
        const currentMapped = String(existingMapByService.get(sid) || '').trim();
        if (currentMapped) continue;
        const key = resolveStockMasterKeyFromService(serv, specialtyById);
        const modelId = String(modelByKey.get(key) || modelByKey.get('clinico') || '');
        if (!modelId) continue;
        const { error: delErr } = await db.from('service_mapping').delete().eq('service_id', sid);
        if (delErr) continue;
        await db.from('service_mapping').insert({ service_id: sid, model_id: modelId });
    }

    await loadEstoqueData(true);
    const invByName = new Map((inventoryItems || []).map(i => [normalizeKey(String(i && i.nome || '')), i]));

    const findInvByTerms = (terms) => Array.from(invByName.values()).find(i => {
        const n = normalizeKey(String(i && i.nome || ''));
        return terms.some(t => n.includes(normalizeKey(t)));
    }) || null;
    const ensureInventoryItem = async (nome, unidade, ehConsumivel, estoqueMinimo = 0) => {
        const key = normalizeKey(nome);
        let row = invByName.get(key) || null;
        if (!row) {
            const res = await saveInventoryRowWithFallback({ payload: {
                empresa_id: empId,
                nome,
                unidade: unidade || null,
                estoque_atual: 0,
                estoque_minimo: toDec(estoqueMinimo, 0),
                eh_consumivel: !!ehConsumivel
            }, withSelect: true });
            if (!res.error && res.data) row = res.data;
        } else {
            if (row.eh_consumivel !== !!ehConsumivel) {
                await saveInventoryRowWithFallback({ id: row.id, payload: { eh_consumivel: !!ehConsumivel } });
                row = { ...row, eh_consumivel: !!ehConsumivel };
            }
        }
        if (row) invByName.set(key, row);
        return row;
    };

    const resina = findInvByTerms(['resina']) || await ensureInventoryItem('Resina Composta', 'g', true, 0);
    const adesivo = findInvByTerms(['adesivo']) || await ensureInventoryItem('Adesivo', 'ml', true, 0);
    const acido = findInvByTerms(['acido', 'ácido']) || await ensureInventoryItem('Ácido Condicionador', 'ml', true, 0);
    const kitInstrumental = findInvByTerms(['kit clinico instrumental', 'espelho', 'sonda']) || await ensureInventoryItem('Kit Clínico (Instrumental)', 'kit', false, 0);
    const invLuva = findInvByTerms(['luva esteril', 'luva estéril', 'luva']) || await ensureInventoryItem('Luva Estéril (Par)', 'par', true, 0);
    const invMascara = findInvByTerms(['mascara', 'máscara']) || await ensureInventoryItem('Máscara', 'un', true, 0);
    const invSugador = findInvByTerms(['sugador']) || await ensureInventoryItem('Sugador', 'un', true, 0);
    const invTouca = findInvByTerms(['touca']) || await ensureInventoryItem('Touca', 'un', true, 0);
    const invBabador = findInvByTerms(['babador']) || await ensureInventoryItem('Babador', 'un', true, 0);

    await loadEstoqueData(true);
    const upsertModelItem = async (modelId, inv, qtd) => {
        if (!modelId || !(inv && inv.id)) return;
        const invId = String(inv.id);
        const existing = (usageModelItems || []).find(mi => String(mi && mi.model_id || '') === String(modelId) && String(mi && mi.inventory_id || '') === invId) || null;
        if (existing && existing.id) {
            await db.from('model_items').update({ quantidade_sugerida: toDec(qtd, 0) }).eq('id', existing.id);
        } else {
            await db.from('model_items').insert({ model_id: String(modelId), inventory_id: invId, quantidade_sugerida: toDec(qtd, 0) });
        }
    };

    const clinicoModelId = String(modelByKey.get('clinico') || '');
    if (clinicoModelId) {
        await upsertModelItem(clinicoModelId, resina, 0.05);
        await upsertModelItem(clinicoModelId, adesivo, 0.02);
        await upsertModelItem(clinicoModelId, acido, 0.10);
        await upsertModelItem(clinicoModelId, kitInstrumental, 1.00);
    }
    const biossegRules = [
        { inv: invLuva, qtd: 2 },
        { inv: invMascara, qtd: 1 },
        { inv: invSugador, qtd: 1 },
        { inv: invTouca, qtd: 1 },
        { inv: invBabador, qtd: 1 }
    ].filter(x => x && x.inv && x.inv.id);
    if (biossegRules.length) {
        for (const model of (usageModels || [])) {
            const mid = String(model && model.id || '');
            if (!mid) continue;
            for (const rule of biossegRules) {
                await upsertModelItem(mid, rule.inv, rule.qtd);
            }
        }
    }

    const cirurgiaModelId = String(modelByKey.get('cirurgia') || '');
    const dentisticaModelId = String(modelByKey.get('dentistica') || '');
    const endoModelId = String(modelByKey.get('endodontia') || '');
    const harmonModelId = String(modelByKey.get('harmonizacao') || '');
    const implModelId = String(modelByKey.get('implantodontia') || '');
    const ortoModelId = String(modelByKey.get('ortodontia') || '');
    const perioModelId = String(modelByKey.get('periodontia') || '');

    const invAnestesico = findInvByTerms(['anestesico', 'anestésico']) || await ensureInventoryItem('Anestésico', 'un', true, 0);
    const invAgulhaGengival = findInvByTerms(['agulha gengival']) || await ensureInventoryItem('Agulha Gengival', 'un', true, 0);
    const invLaminaBisturi = findInvByTerms(['lamina de bisturi', 'lâmina de bisturi']) || await ensureInventoryItem('Lâmina de Bisturi', 'un', true, 0);
    const invFioSutura = findInvByTerms(['fio de sutura', 'fio sutura']) || await ensureInventoryItem('Fio de Sutura', 'un', true, 0);

    const invMicrobrush = findInvByTerms(['microbrush']) || await ensureInventoryItem('Microbrush', 'un', true, 0);
    const invAcidoFosforico = findInvByTerms(['acido fosforico', 'ácido fosfórico']) || await ensureInventoryItem('Ácido Fosfórico', 'un', true, 0);
    const invAdesivoGota = findInvByTerms(['adesivo']) || adesivo || await ensureInventoryItem('Adesivo', 'gota', true, 0);
    const invMatrizPoliester = findInvByTerms(['matriz de poliester', 'matriz de poliéster']) || await ensureInventoryItem('Matriz de Poliéster', 'un', true, 0);

    const invConeGuta = findInvByTerms(['cone de guta', 'guta percha', 'guta-percha']) || await ensureInventoryItem('Cone de Guta', 'un', true, 0);
    const invCimentoEndo = findInvByTerms(['cimento endodont']) || await ensureInventoryItem('Cimento Endodôntico', 'un', true, 0);
    const invHipoclorito = findInvByTerms(['hipoclorito']) || await ensureInventoryItem('Hipoclorito', 'ml', true, 0);
    const invTamborel = findInvByTerms(['tamborel', 'tamborél']) || await ensureInventoryItem('Tamborel', 'un', true, 0);

    const invSeringa1ml = findInvByTerms(['seringa 1ml']) || await ensureInventoryItem('Seringa 1ml', 'un', true, 0);
    const invAgulha30g = findInvByTerms(['agulha 30g']) || await ensureInventoryItem('Agulha 30G', 'un', true, 0);
    const invToxina = findInvByTerms(['toxina']) || await ensureInventoryItem('Toxina', 'un', true, 0);
    const invPreenchedor = findInvByTerms(['preenchedor']) || await ensureInventoryItem('Preenchedor', 'un', true, 0);
    const invAlcool70 = findInvByTerms(['alcool 70', 'álcool 70']) || await ensureInventoryItem('Álcool 70', 'un', true, 0);
    const invLuvaEsteril = invLuva;
    const invCampoFenestrado = findInvByTerms(['campo fenestrado']) || await ensureInventoryItem('Campo Fenestrado', 'un', true, 0);
    const invAnestesicoTopico = findInvByTerms(['anestesico topico', 'anestésico tópico']) || await ensureInventoryItem('Anestésico Tópico', 'un', true, 0);

    const invGuiaCirurgico = findInvByTerms(['guia cirurgico', 'guia cirúrgico']) || await ensureInventoryItem('Guia Cirúrgico', 'un', true, 0);
    const invSoro = findInvByTerms(['soro fisiologico', 'soro fisiológico']) || await ensureInventoryItem('Soro Fisiológico', 'ml', true, 0);
    const invCompProt = findInvByTerms(['componente protetico', 'componente protético']) || await ensureInventoryItem('Componente Protético', 'un', true, 0);

    const invBrackets = findInvByTerms(['brackets', 'braquete', 'bráquete']) || await ensureInventoryItem('Brackets (Jogo)', 'jogo', true, 0);
    const invFioOrto = findInvByTerms(['fio ortodont']) || await ensureInventoryItem('Fio Ortodôntico', 'un', true, 0);
    const invElastico = findInvByTerms(['elastico', 'elástico']) || await ensureInventoryItem('Elástico', 'un', true, 0);
    const invResinaOrto = findInvByTerms(['resina de ortodont']) || await ensureInventoryItem('Resina de Ortodontia', 'un', true, 0);
    const invAcidoOrto = findInvByTerms(['acido']) || invAcidoFosforico || await ensureInventoryItem('Ácido', 'un', true, 0);
    const invAdesivoOrto = findInvByTerms(['adesivo']) || invAdesivoGota || await ensureInventoryItem('Adesivo', 'un', true, 0);
    const invStop = findInvByTerms(['stop']) || await ensureInventoryItem('Stop', 'un', true, 0);
    const invTuboOrto = findInvByTerms(['tubo']) || await ensureInventoryItem('Tubo', 'un', true, 0);

    const invPastaProfilatica = findInvByTerms(['pasta profilatica', 'pasta profilática']) || await ensureInventoryItem('Pasta Profilática', 'porção', true, 0);

    await loadEstoqueData(true);

    if (cirurgiaModelId) {
        await upsertModelItem(cirurgiaModelId, invAnestesico, 2);
        await upsertModelItem(cirurgiaModelId, invAgulhaGengival, 1);
        await upsertModelItem(cirurgiaModelId, invLaminaBisturi, 1);
        await upsertModelItem(cirurgiaModelId, invFioSutura, 1);
    }
    if (dentisticaModelId) {
        await upsertModelItem(dentisticaModelId, invMicrobrush, 2);
        await upsertModelItem(dentisticaModelId, invAcidoFosforico, 1);
        await upsertModelItem(dentisticaModelId, invAdesivoGota, 1);
        await upsertModelItem(dentisticaModelId, invMatrizPoliester, 1);
    }
    if (endoModelId) {
        await upsertModelItem(endoModelId, invConeGuta, 3);
        await upsertModelItem(endoModelId, invCimentoEndo, 1);
        await upsertModelItem(endoModelId, invHipoclorito, 5);
        await upsertModelItem(endoModelId, invTamborel, 1);
    }
    if (harmonModelId) {
        await upsertModelItem(harmonModelId, invSeringa1ml, 2);
        await upsertModelItem(harmonModelId, invAgulha30g, 4);
        await upsertModelItem(harmonModelId, invToxina, 1);
        await upsertModelItem(harmonModelId, invPreenchedor, 1);
        await upsertModelItem(harmonModelId, invAlcool70, 1);
        await upsertModelItem(harmonModelId, invLuvaEsteril, 1);
        await upsertModelItem(harmonModelId, invMascara, 1);
        await upsertModelItem(harmonModelId, invTouca, 1);
        await upsertModelItem(harmonModelId, invCampoFenestrado, 1);
        await upsertModelItem(harmonModelId, invAnestesicoTopico, 1);
    }
    if (implModelId) {
        await upsertModelItem(implModelId, invGuiaCirurgico, 1);
        await upsertModelItem(implModelId, invSoro, 500);
        await upsertModelItem(implModelId, invCompProt, 1);
    }
    if (ortoModelId) {
        await upsertModelItem(ortoModelId, invBrackets, 1);
        await upsertModelItem(ortoModelId, invFioOrto, 1);
        await upsertModelItem(ortoModelId, invElastico, 1);
        await upsertModelItem(ortoModelId, invResinaOrto, 1);
        await upsertModelItem(ortoModelId, invAcidoOrto, 1);
        await upsertModelItem(ortoModelId, invAdesivoOrto, 1);
        await upsertModelItem(ortoModelId, invStop, 2);
        await upsertModelItem(ortoModelId, invTuboOrto, 2);
    }
    if (perioModelId) {
        await upsertModelItem(perioModelId, invPastaProfilatica, 1);
    }

    await loadEstoqueData(true);
    const mappedCount = (serviceModelMappings || []).length;
    if (!silent) showToast(`Modelos mestres prontos. Vínculos ativos: ${mappedCount}.`);
    return { ok: true, mappedCount };
}

async function injectBiossegItemsIntoModel(modelId) {
    const mid = String(modelId || '').trim();
    if (!mid) return { ok: false, reason: 'missing_model' };
    await loadEstoqueData(true);
    const invByKey = new Map((inventoryItems || []).map(i => [normalizeKey(String(i && i.nome || '')), i]));
    const pick = (name, fallbackNeedle) => {
        const exact = invByKey.get(normalizeKey(name)) || null;
        if (exact) return exact;
        const needle = normalizeKey(fallbackNeedle || name);
        return (inventoryItems || []).find(i => normalizeKey(String(i && i.nome || '')).includes(needle)) || null;
    };
    const biossegRules = [
        { inv: pick('Luva Estéril (Par)', 'luva'), qtd: 2 },
        { inv: pick('Máscara', 'mascara'), qtd: 1 },
        { inv: pick('Sugador', 'sugador'), qtd: 1 },
        { inv: pick('Touca', 'touca'), qtd: 1 },
        { inv: pick('Babador', 'babador'), qtd: 1 }
    ].filter(x => x && x.inv && x.inv.id);
    if (!biossegRules.length) return { ok: false, reason: 'missing_inventory_items' };
    const existingRows = (usageModelItems || []).filter(mi => String(mi && mi.model_id || '') === mid);
    for (const rule of biossegRules) {
        const invId = String(rule && rule.inv && rule.inv.id || '');
        if (!invId) continue;
        const existing = existingRows.find(mi => String(mi && mi.inventory_id || '') === invId) || null;
        if (existing && existing.id) {
            const { error } = await db.from('model_items').update({ quantidade_sugerida: toDec(rule.qtd, 0) }).eq('id', existing.id);
            if (error) return { ok: false, reason: 'update_failed', error };
        } else {
            const { error } = await db.from('model_items').insert({ model_id: mid, inventory_id: invId, quantidade_sugerida: toDec(rule.qtd, 0) });
            if (error) return { ok: false, reason: 'insert_failed', error };
        }
    }
    return { ok: true };
}

function autoSeedStockMasterDataIfNeeded() {
    if (!(isSuperAdmin || isAdminRole())) return;
    const scope = getEstoqueEmpresaScopeId();
    if (!scope) return;
    const key = `stockMasterSeeded:${scope}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    seedStockMasterData({ silent: true }).catch(() => { });
}

window.seedStockMasterData = seedStockMasterData;

// let importDefaultTemplatesInFlight = false;

function getTemplatesImportDoneKey(empresaId) {
    return `occ_templates_import_done:${String(empresaId || '').trim()}`;
}

function wasTemplatesAlreadyImported(empresaId) {
    try { return localStorage.getItem(getTemplatesImportDoneKey(empresaId)) === '1'; } catch { return false; }
}

function markTemplatesImported(empresaId) {
    try { localStorage.setItem(getTemplatesImportDoneKey(empresaId), '1'); } catch { }
}

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

window.importDefaultTemplatesForCurrentEmpresa = importDefaultTemplatesForCurrentEmpresa;

async function templatesHealthcheck() {
    try {
        const { data, error } = await withTimeout(
            db.rpc('rpc_templates_healthcheck', {}),
            30000,
            'rpc_templates_healthcheck'
        );
        if (error) throw error;
        console.log('TEMPLATES_HEALTHCHECK', data);
        showToast('Healthcheck de templates concluído. Veja o console.');
        return data;
    } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Falha no healthcheck de templates.';
        showToast(msg, true);
        return null;
    }
}

window.templatesHealthcheck = templatesHealthcheck;

async function loadEstoqueData(force = false) {
    const empId = getEstoqueEmpresaScopeId();
    if (!empId) return;
    if (!force && String(window.__estoqueLoadedEmpresa || '') === empId) return;

    try {
        const [invRes, modelsRes, mapRes, logsRes] = await Promise.all([
            db.from('inventory').select('*').eq('empresa_id', empId).order('nome'),
            db.from('usage_models').select('*').eq('empresa_id', empId).order('nome_modelo'),
            db.from('service_mapping').select('*'),
            db.from('inventory_logs').select('*').eq('empresa_id', empId).order('data_hora', { ascending: false }).limit(300)
        ]);

        if (invRes.error) {
            console.error('Erro ao carregar inventory:', invRes.error);
            inventoryItems = [];
        } else {
            inventoryItems = invRes.data || [];
        }
        if (modelsRes.error) {
            console.error('Erro ao carregar usage_models:', modelsRes.error);
            usageModels = [];
        } else {
            usageModels = modelsRes.data || [];
        }

        const modelIdsRaw = (usageModels || []).map(m => String(m && m.id || '').trim()).filter(Boolean);
        const modelIds = new Set(modelIdsRaw.map(x => x.toLowerCase()));
        let items = [];
        if (modelIdsRaw.length) {
            const chunk = 200;
            for (let i = 0; i < modelIdsRaw.length; i += chunk) {
                const ids = modelIdsRaw.slice(i, i + chunk);
                const itemsRes = await db.from('model_items').select('*').in('model_id', ids);
                if (itemsRes && !itemsRes.error && Array.isArray(itemsRes.data)) items.push(...itemsRes.data);
            }
        }
        usageModelItems = items.filter(mi => modelIds.has(String(mi && mi.model_id || '').trim().toLowerCase()));
        serviceModelMappings = mapRes && !mapRes.error ? (mapRes.data || []) : [];
        inventoryLogs = logsRes && !logsRes.error ? (logsRes.data || []) : [];
        const modelNameById = new Map((usageModels || []).map(m => [String(m && m.id || ''), String(m && m.nome_modelo || '')]));
        const invArea = new Map();
        (usageModelItems || []).forEach(mi => {
            const invId = String(mi && mi.inventory_id || '');
            if (!invId || invArea.has(invId)) return;
            const areaByModel = getAreaFromModelName(modelNameById.get(String(mi && mi.model_id || '')) || '');
            if (areaByModel) invArea.set(invId, areaByModel);
        });
        inventoryAreaById = invArea;
        const rows = (inventoryItems || []).filter((r) => {
            if (!r || typeof r !== 'object') return false;
            if (Object.prototype.hasOwnProperty.call(r, 'ativo')) return !!r.ativo;
            return true;
        });
        const fromDbColumns = rows.map(r => normalizeInventoryArea(r && (r.area || r.categoria) || '')).filter(a => a);
        const fromDbModels = Array.from(new Set(Array.from(invArea.values())));
        const fromDb = Array.from(new Set([...fromDbColumns, ...fromDbModels]));
        const canonical = getCanonicalInventoryAreas();
        inventoryAreaOptions = [...canonical];
        window.__estoqueLoadedEmpresa = empId;
        if (force && invRes.error) {
            const msg = invRes.error && invRes.error.message ? String(invRes.error.message) : 'Falha ao carregar inventário.';
            showToast(`Inventário indisponível: ${msg}`, true);
        }
    } catch (err) {
        console.error('Falha ao carregar módulo de estoque:', err);
        if (force) {
            const msg = err && err.message ? String(err.message) : 'Falha ao carregar dados de estoque.';
            showToast(msg, true);
        }
    }
}

function renderInventoryTable() {
    const body = document.getElementById('inventoryTableBody');
    const empty = document.getElementById('inventoryEmptyState');
    const btnToggleLibrary = document.getElementById('btnToggleInventoryLibrary');
    const statusCounter = document.getElementById('inventoryStatusCounter');
    if (!body) return;
    const allRows = Array.isArray(inventoryItems) ? inventoryItems : [];
    if (statusCounter) {
        const activeCount = allRows.filter(isInventoryActive).length;
        const inactiveCount = Math.max(0, allRows.length - activeCount);
        statusCounter.textContent = `Ativos: ${activeCount} | Inativos: ${inactiveCount}`;
    }
    if (btnToggleLibrary) {
        btnToggleLibrary.innerHTML = inventoryShowLibraryFull
            ? '<i class="ri-eye-close-line"></i> Mostrar Apenas Ativos'
            : '<i class="ri-eye-line"></i> Mostrar Inativos';
    }
    renderInventoryAreaFilterOptions();
    body.innerHTML = '';
    const areaFilterKey = normalizeKey(String(inventoryAreaFilter || '').trim());
    const q = normalizeKey(String(inventorySearchTerm || '').trim());
    const typeFilterKey = normalizeInventoryTypeKey(String(inventoryTypeFilter || '').trim());
    const buyOnly = !!inventoryBuyOnly;
    const rows = allRows.filter(item => {
        const activeOk = buyOnly ? isInventoryActive(item) : (inventoryShowLibraryFull ? !isInventoryActive(item) : isInventoryActive(item));
        if (!activeOk) return false;
        const areaOk = !areaFilterKey || normalizeKey(getInventoryArea(item)) === areaFilterKey;
        if (!areaOk) return false;
        const typeOk = !typeFilterKey || normalizeInventoryTypeKey(getInventoryFunctionalType(item)) === typeFilterKey;
        if (!typeOk) return false;
        if (buyOnly) {
            const atual = toDec(item && item.estoque_atual, 0);
            const minimo = toDec(item && item.estoque_minimo, 0);
            if (!(atual < minimo)) return false;
        }
        if (!q) return true;
        const nome = normalizeKey(String(item && item.nome || ''));
        const unidade = normalizeKey(String(item && item.unidade || ''));
        const codigo = normalizeKey(String(item && item.codigo_barras || ''));
        return nome.includes(q) || unidade.includes(q) || codigo.includes(q) || normalizeKey(getInventoryArea(item)).includes(q);
    });
    inventoryCurrentGridRows = rows.slice();
    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');
    const canInvUpdate = canStockAction('inventory', 'update');
    const canInvEntry = canStockAction('inventory', 'update') || canStockAction('inventory', 'insert');
    const canInvDelete = canStockAction('inventory', 'delete');
    rows.forEach(item => {
        const atual = toDec(item && item.estoque_atual);
        const minimo = toDec(item && item.estoque_minimo);
        const isLow = atual <= minimo;
        const ativo = isInventoryActive(item);
        const isBuy = ativo && atual < minimo;
        const area = getInventoryArea(item);
        const badge = getInventoryAreaBadgeStyle(area);
        const invType = normalizeInventoryTypeKey(getInventoryFunctionalType(item));
        const statusTag = invType === 'cirurgia'
            ? '<span class="inventory-kind inventory-kind-cirurgia"><i class="ri-scissors-cut-line"></i> Cirurgia</span>'
            : (invType === 'consumiveis'
                ? '<span class="inventory-kind inventory-kind-consumo"><i class="ri-drop-line"></i> Consumo</span>'
                : (invType === 'instrumentais'
                    ? '<span class="inventory-kind inventory-kind-instrumental"><i class="ri-shield-keyhole-line"></i> Instrumental</span>'
                    : (invType === 'equipamentos'
                        ? '<span class="inventory-kind inventory-kind-equipamentos"><i class="ri-tools-line"></i> Equipamento</span>'
                        : '<span class="inventory-kind inventory-kind-administrativo"><i class="ri-briefcase-4-line"></i> Admin</span>'
                    )
                )
            );
        const areaTag = area ? `<span class="inventory-area-badge" style="background: ${badge.bg}; color: ${badge.color}; border: 1px solid ${badge.border};">${area}</span>` : '';
        const tr = document.createElement('tr');
        if (isLow) tr.classList.add('inventory-row-low');
        if (isBuy) tr.classList.add('inventory-row-buy');
        if (!ativo) tr.classList.add('inventory-row-inactive');
        tr.innerHTML = `
            <td><strong>${String(item && item.nome || '—')}</strong> ${areaTag} ${statusTag}${isBuy ? ` <span class="inventory-buy-badge"><i class="ri-shopping-cart-line"></i> Comprar</span>` : (isLow ? ` <span class="inventory-alert"><i class="ri-alarm-warning-line"></i> Mínimo</span>` : '')}</td>
            <td>${String(item && item.unidade || '—')}</td>
            <td class="${isLow ? 'inventory-balance-low' : ''}">${atual.toFixed(2)}</td>
            <td>${minimo.toFixed(2)}</td>
            <td style="text-align:center;">
                ${canInvUpdate ? `<button class="btn-icon js-inv-toggle-active ${ativo ? 'inventory-active' : 'inventory-inactive'}" data-id="${String(item && item.id || '')}" data-active="${ativo ? '1' : '0'}" title="${ativo ? 'Inativar item' : 'Reativar item'}"><i class="${ativo ? 'ri-check-line' : 'ri-close-line'}"></i></button>` : (ativo ? '<i class="ri-check-line inventory-active"></i>' : '<i class="ri-close-line inventory-inactive"></i>')}
            </td>
            <td>
                ${canInvEntry && ativo ? `<button class="btn-icon js-inv-entry-nf" data-id="${String(item && item.id || '')}" title="Dar Entrada (NF)"><i class="ri-file-list-3-line"></i></button>` : ''}
                ${canInvUpdate ? `<button class="btn-icon js-inv-edit" data-id="${String(item && item.id || '')}" data-tipo="${normalizeInventoryTypeKey(item && (item.tipo_inventario || getInventoryFunctionalType(item)) || '')}" title="Editar"><i class="ri-edit-line"></i></button>` : ''}
                ${canInvDelete ? `<button class="btn-icon delete-btn js-inv-del" data-id="${String(item && item.id || '')}" title="Excluir"><i class="ri-delete-bin-line"></i></button>` : ''}
            </td>
        `;
        body.appendChild(tr);
    });
    body.querySelectorAll('.js-inv-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = String(btn.getAttribute('data-id') || '');
            const item = (Array.isArray(inventoryItems) ? inventoryItems : []).find(x => String(x && x.id || '') === id)
                || rows.find(x => String(x && x.id || '') === id);
            if (!item) return;
            const form = document.getElementById('inventoryForm');
            const editId = document.getElementById('inventoryEditId');
            const nome = document.getElementById('inventoryNome');
            const codigoBarras = document.getElementById('inventoryCodigoBarras');
            const unidade = document.getElementById('inventoryUnidade');
            const unidadeMedida = document.getElementById('inventoryUnidadeMedida');
            const fatorConversao = document.getElementById('inventoryFatorConversao');
            const tipoInventario = document.getElementById('inventoryTipoInventario');
            const areaInput = document.getElementById('inventoryArea');
            const minimo = document.getElementById('inventoryMinimo');
            const atual = document.getElementById('inventoryAtual');
            const ehConsumivel = document.getElementById('inventoryEhConsumivel');
            if (editId) editId.value = id;
            if (nome) nome.value = String(item.nome || '');
            if (codigoBarras) codigoBarras.value = String(item.codigo_barras || '');
            if (unidade) unidade.value = String(item.unidade || '');
            if (unidadeMedida) unidadeMedida.value = String(item.unidade_medida || item.unidade || '');
            if (fatorConversao) {
                const compra0 = normalizeUnitCode(item && item.unidade || '');
                const consumo0 = normalizeUnitCode(item && (item.unidade_medida || item.unidade) || '');
                const differs0 = !!compra0 && !!consumo0 && compra0 !== consumo0;
                const fv = differs0 ? Math.trunc(toDec(item && item.fator_conversao, 0)) : 1;
                fatorConversao.value = differs0 ? (fv > 0 ? String(fv) : '') : '1';
            }
            syncInventoryConversionUiFromInputs();
            const tipoFromBtn = normalizeInventoryTypeKey(String(btn.getAttribute('data-tipo') || ''));
            const desiredType = tipoFromBtn || normalizeInventoryTypeKey(item && (item.tipo_inventario || getInventoryFunctionalType(item)) || '') || (isInventoryConsumable(item) ? 'consumiveis' : 'instrumentais');
            if (tipoInventario) {
                tipoInventario.value = desiredType;
                if (String(tipoInventario.value || '') !== desiredType) {
                    const opts = Array.from(tipoInventario.options || []);
                    const idx = opts.findIndex(o => normalizeInventoryTypeKey(String(o && o.value || '')) === desiredType);
                    if (idx >= 0) tipoInventario.selectedIndex = idx;
                }
                tipoInventario.dispatchEvent(new Event('change', { bubbles: true }));
                tipoInventario.dispatchEvent(new Event('input', { bubbles: true }));
            }
            ensureInventoryTipoAreaBinding();
            if (window.updateInventoryAreaOptionsForTipoInventario) window.updateInventoryAreaOptionsForTipoInventario();
            syncInventoryAreaByType(desiredType, getInventoryArea(item));
            if (minimo) minimo.value = formatNumberBR(toDec(item.estoque_minimo, 0), 2);
            if (atual) atual.value = formatNumberBR(toDec(item.estoque_atual, 0), 2);
            if (ehConsumivel) ehConsumivel.checked = isInventoryConsumable(item);
            const modal = document.getElementById('inventoryModal');
            const title = document.getElementById('inventoryModalTitle');
            if (title) title.textContent = 'Editar Material';
            if (form) form.classList.remove('hidden');
            if (modal) modal.classList.remove('hidden');
            setTimeout(() => {
                if (tipoInventario) {
                    tipoInventario.value = desiredType;
                    if (String(tipoInventario.value || '') !== desiredType) {
                        const opts = Array.from(tipoInventario.options || []);
                        const idx = opts.findIndex(o => normalizeInventoryTypeKey(String(o && o.value || '')) === desiredType);
                        if (idx >= 0) tipoInventario.selectedIndex = idx;
                    }
                    tipoInventario.dispatchEvent(new Event('change', { bubbles: true }));
                    tipoInventario.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (window.updateInventoryAreaOptionsForTipoInventario) window.updateInventoryAreaOptionsForTipoInventario();
                if (window.__forceInventoryAreaOptions) window.__forceInventoryAreaOptions(tipoInventario || document.getElementById('inventoryTipoInventario'));
            }, 0);
        });
    });
    body.querySelectorAll('.js-inv-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = String(btn.getAttribute('data-id') || '');
            if (!id) return;
            if (!confirm('Deseja excluir este material?')) return;
            const { error } = await db.from('inventory').delete().eq('id', id);
            if (error) {
                showToast(error.message || 'Falha ao excluir material.', true);
                return;
            }
            await loadEstoqueData(true);
            renderInventoryTable();
            renderModelItemsEditor();
            showToast('Material excluído com sucesso.');
        });
    });
    body.querySelectorAll('.js-inv-entry-nf').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!(canStockAction('inventory', 'update') || canStockAction('inventory', 'insert'))) {
                showToast('Ação permitida apenas para Administrador.', true);
                return;
            }
            const id = String(btn.getAttribute('data-id') || '');
            const item = rows.find(x => String(x && x.id || '') === id);
            if (!item) return;
            if (!isInventoryActive(item)) {
                showToast('Item inativo. Reative para dar entrada por NF.', true);
                return;
            }
            const entry = await openInventoryNfEntryModal(item);
            if (!entry || !entry.ok) return;
            const qtd = toDec(entry.quantidade, 0);
            const valorTotal = toDec(entry.valorTotal, 0);
            if (qtd <= 0 || valorTotal < 0) {
                showToast('Informe Quantidade e Valor Total válidos.', true);
                return;
            }
            const compra = normalizeUnitCode(entry.compra || item && item.unidade || '');
            const consumo = normalizeUnitCode(entry.consumo || item && item.unidade_medida || '');
            const fator = toDec(entry.fator, 0);
            if (fator <= 0) {
                showToast('Fator de conversão obrigatório para este item (unidades diferentes). Edite o material e informe o fator.', true);
                return;
            }
            const qtdBase = qtd * fator;
            const custoUnit = qtdBase > 0 ? (valorTotal / qtdBase) : 0;
            const novoSaldo = toDec(item && item.estoque_atual, 0) + qtdBase;
            const payload = {
                estoque_atual: novoSaldo,
                preco_custo: toDec(custoUnit, 0),
                unidade: compra || 'un',
                unidade_medida: consumo || (compra || 'un'),
                fator_conversao: fator
            };
            const upd = await saveInventoryRowWithFallback({ id, payload });
            if (upd && upd.error) {
                showToast(upd.error.message || 'Falha ao lançar entrada por NF.', true);
                return;
            }
            let logPayload = {
                empresa_id: getEstoqueEmpresaScopeId(),
                inventory_id: id,
                atendimento_id: null,
                tipo: 'ENTRADA_NF',
                quantidade: qtdBase,
                valor_total_nf: valorTotal,
                responsavel_id: currentUser && currentUser.id ? currentUser.id : null
            };
            let ins = await db.from('inventory_logs').insert(logPayload);
            if (ins && ins.error && isValorTotalNfSchemaError(ins.error)) {
                const { valor_total_nf, ...rest } = logPayload;
                logPayload = rest;
                ins = await db.from('inventory_logs').insert(logPayload);
            }
            if (ins && ins.error) {
                showToast(ins.error.message || 'Falha ao registrar log de entrada NF.', true);
                return;
            }
            await loadEstoqueData(true);
            renderInventoryTable();
            if (compra && consumo && compra !== consumo) {
                showToast(`Atenção: Produto convertido de [${compra}] para [${consumo}] para precisão de custo por procedimento.`);
            }
            showToast(`Entrada registrada. Custo unitário: ${formatCurrencyBRL(toDec(custoUnit, 0))}.`);
        });
    });
    body.querySelectorAll('.js-inv-toggle-active').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = String(btn.getAttribute('data-id') || '');
            const current = String(btn.getAttribute('data-active') || '1') === '1';
            if (!id) return;
            const { error } = await db.from('inventory').update({ ativo: !current }).eq('id', id);
            if (error) {
                showToast(error.message || 'Falha ao atualizar status ativo.', true);
                return;
            }
            await loadEstoqueData(true);
            renderInventoryTable();
            showToast(!current ? 'Item reativado.' : 'Item inativado.');
        });
    });
}

function renderUsageModelsTable() {
    const body = document.getElementById('usageModelsTableBody');
    const empty = document.getElementById('usageModelsEmptyState');
    if (!body) return;
    body.innerHTML = '';
    const rows = Array.isArray(usageModels) ? usageModels : [];
    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');
    const canModelDelete = canStockAction('models', 'delete');
    rows.forEach(model => {
        const id = String(model && model.id || '');
        const qtdItens = getModelItemsByModelId(id).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${String(model && model.nome_modelo || '—')}</strong></td>
            <td>${qtdItens}</td>
            <td>
                <button class="btn-icon js-model-select" data-id="${id}" title="Selecionar"><i class="ri-list-check-2"></i></button>
                ${canModelDelete ? `<button class="btn-icon delete-btn js-model-del" data-id="${id}" title="Excluir"><i class="ri-delete-bin-line"></i></button>` : ''}
            </td>
        `;
        body.appendChild(tr);
    });
    body.querySelectorAll('.js-model-select').forEach(btn => {
        btn.addEventListener('click', () => {
            estoqueActiveModelId = String(btn.getAttribute('data-id') || '');
            renderUsageModelsTable();
            renderModelItemsEditor();
        });
    });
    body.querySelectorAll('.js-model-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = String(btn.getAttribute('data-id') || '');
            if (!id) return;
            if (!confirm('Deseja excluir este modelo?')) return;
            const { error } = await db.from('usage_models').delete().eq('id', id);
            if (error) {
                showToast(error.message || 'Falha ao excluir modelo.', true);
                return;
            }
            if (estoqueActiveModelId === id) estoqueActiveModelId = null;
            await loadEstoqueData(true);
            renderUsageModelsTable();
            renderModelItemsEditor();
            renderServiceMappingTable();
            showToast('Modelo excluído com sucesso.');
        });
    });
}

function renderModelItemsEditor() {
    const title = document.getElementById('modelItemsTitle');
    const form = document.getElementById('modelItemForm');
    const invSelect = document.getElementById('modelItemInventoryId');
    const body = document.getElementById('modelItemsTableBody');
    const empty = document.getElementById('modelItemsEmptyState');
    const includeBiossegInput = document.getElementById('modelIncludeBiosseg');
    const btnSave = document.getElementById('btnSaveModelItems');
    const canModelUpdate = canStockAction('models', 'update');
    if (!body) return;
    body.innerHTML = '';
    const activeId = String(estoqueActiveModelId || '');
    const model = (usageModels || []).find(m => String(m && m.id || '') === activeId) || null;
    if (btnSave) {
        btnSave.style.display = canModelUpdate ? '' : 'none';
        btnSave.disabled = !model;
        if (!btnSave.__occBound) {
            btnSave.__occBound = true;
            btnSave.addEventListener('click', async () => {
                const mid = String(estoqueActiveModelId || '').trim();
                if (!mid) {
                    showToast('Selecione um modelo para salvar.', true);
                    return;
                }
                btnSave.disabled = true;
                try {
                    await loadEstoqueData(true);
                    renderUsageModelsTable();
                    renderModelItemsEditor();
                    renderServiceMappingTable();
                    showToast('Itens do modelo salvos.');
                } finally {
                    btnSave.disabled = false;
                }
            });
        }
    }
    if (invSelect) {
        const list = Array.isArray(inventoryItems) ? inventoryItems.slice() : [];
        const modelNameKey = normalizeKey(String(model && model.nome_modelo || ''));
        let prioritized = [];
        if (modelNameKey.includes('kit clinico') || modelNameKey.includes('clinico')) {
            prioritized = list.filter(i => {
                const n = normalizeKey(String(i && i.nome || ''));
                return n.includes('luva p') || n.includes('luva m') || n.includes('luva g');
            });
        }
        const prioritizedIds = new Set(prioritized.map(i => String(i && i.id || '')));
        const normalItems = list.filter(i => !prioritizedIds.has(String(i && i.id || '')));
        invSelect.innerHTML = '<option value="">Selecione o material...</option>'
            + prioritized.map(i => `<option value="${String(i.id)}">⭐ ${String(i.nome || '—')}</option>`).join('')
            + normalItems.map(i => `<option value="${String(i.id)}">${String(i.nome || '—')}</option>`).join('');
        invSelect.disabled = !canModelUpdate;
    }
    if (title) title.textContent = model ? `Itens do Modelo: ${String(model.nome_modelo || '')}` : 'Itens do Modelo';
    if (!model) {
        if (form) form.classList.add('hidden');
        if (includeBiossegInput) includeBiossegInput.checked = true;
        if (empty) {
            empty.classList.remove('hidden');
            empty.querySelector('p').textContent = 'Selecione um modelo para editar os itens.';
        }
        return;
    }
    if (includeBiossegInput) {
        includeBiossegInput.checked = !(model.include_biosseguranca === false);
        includeBiossegInput.disabled = !canModelUpdate;
        if (!includeBiossegInput.__occBound) {
            includeBiossegInput.__occBound = true;
            includeBiossegInput.addEventListener('change', async () => {
                const mid = String(estoqueActiveModelId || '').trim();
                const m = (usageModels || []).find(x => String(x && x.id || '') === mid) || null;
                if (!mid || !m) return;
                const nextVal = !!includeBiossegInput.checked;
                if (!nextVal) {
                    const ok = confirm('Atenção: Desmarcar a biossegurança impedirá a baixa automática de luvas e máscaras neste serviço');
                    if (!ok) {
                        includeBiossegInput.checked = true;
                        return;
                    }
                }
                if (nextVal) {
                    const biossegId = await ensureBiossegKitExists({ silent: false });
                    if (!biossegId) {
                        showToast('Kit Biossegurança não encontrado. Verifique se há itens de biossegurança cadastrados.', true);
                        includeBiossegInput.checked = false;
                        return;
                    }
                }
                let upd = await db.from('usage_models').update({ include_biosseguranca: nextVal }).eq('id', mid);
                if (upd && upd.error && isIncludeBiossegSchemaError(upd.error)) {
                    showToast('Campo include_biosseguranca ainda não disponível no banco. Aplique a migration para habilitar.', true);
                    includeBiossegInput.checked = true;
                    return;
                }
                if (upd && upd.error) {
                    showToast(upd.error.message || 'Falha ao salvar opção de biossegurança.', true);
                    return;
                }
                await purgeBiossegItemsFromModel(mid);
                await loadEstoqueData(true);
                renderUsageModelsTable();
                renderModelItemsEditor();
                showToast(nextVal ? 'Biossegurança incluída no kit.' : 'Biossegurança removida deste kit.');
            });
        }
    }
    if (form) form.classList.toggle('hidden', !canModelUpdate);
    const rows = getModelItemsByModelId(activeId);
    if (title && model) {
        const invById = new Map((inventoryItems || []).map(i => [String(i && i.id || ''), i]));
        const cost = rows.reduce((sum, mi) => {
            const inv = invById.get(String(mi && mi.inventory_id || ''));
            const qtd = toDec(mi && mi.quantidade_sugerida, 1);
            const unit = toDec(inv && inv.preco_custo, 0);
            return sum + (qtd * unit);
        }, 0);
        title.textContent = `Itens do Modelo: ${String(model.nome_modelo || '')} | Custo: ${formatCurrencyBRL(cost)}`;
    }
    if (!rows.length) {
        if (empty) {
            empty.classList.remove('hidden');
            empty.querySelector('p').textContent = 'Nenhum item neste modelo.';
        }
        return;
    }
    if (empty) empty.classList.add('hidden');
    rows.forEach(mi => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${getInventoryNameById(mi && mi.inventory_id)}</td>
            <td>${toDec(mi && mi.quantidade_sugerida, 1).toFixed(2)}</td>
            <td>${(canModelUpdate && mi && mi.id && !mi.__inherited) ? `<button class="btn-icon delete-btn js-model-item-del" data-id="${String(mi && mi.id || '')}" title="Remover"><i class="ri-delete-bin-line"></i></button>` : '—'}</td>
        `;
        body.appendChild(tr);
    });
    body.querySelectorAll('.js-model-item-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = String(btn.getAttribute('data-id') || '');
            if (!id) return;
            const { error } = await db.from('model_items').delete().eq('id', id);
            if (error) {
                showToast(error.message || 'Falha ao remover item do modelo.', true);
                return;
            }
            await loadEstoqueData(true);
            renderModelItemsEditor();
            showToast('Item removido do modelo.');
        });
    });
}

async function saveServiceModelMapping(serviceId, modelId) {
    const sid = String(serviceId || '').trim();
    if (!sid) return;
    const empId = String(currentEmpresaId || '').trim();
    let delRes = await db.from('service_mapping').delete().eq('service_id', sid).eq('empresa_id', empId);
    if (delRes && delRes.error && isDbMissingColumnError(delRes.error, 'empresa_id')) {
        delRes = await db.from('service_mapping').delete().eq('service_id', sid);
    }
    if (delRes && delRes.error) throw delRes.error;
    const mid = String(modelId || '').trim();
    if (!mid) return;
    let insRes = await db.from('service_mapping').insert({ service_id: sid, model_id: mid, empresa_id: empId });
    if (insRes && insRes.error && isDbMissingColumnError(insRes.error, 'empresa_id')) {
        insRes = await db.from('service_mapping').insert({ service_id: sid, model_id: mid });
    }
    if (insRes && insRes.error) throw insRes.error;
}

function isFamilyKitModelName(name) {
    const key = normalizeKey(String(name || ''));
    if (!key) return false;
    if (key.includes('KIT')) return true;
    if (key.includes('FAMILIA') && key.includes('MODELO')) return true;
    if (key.includes('BIOSSEGURAN')) return true;
    return false;
}

function isFamilyKitModelId(modelId) {
    const mid = String(modelId || '').trim();
    if (!mid) return false;
    const m = (usageModels || []).find(x => String(x && x.id || '') === mid) || null;
    if (!m) return false;
    return isFamilyKitModelName(m.nome_modelo);
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

async function estornarMovimentacao(logId) {
    const id = String(logId || '').trim();
    const log = (inventoryLogs || []).find(l => String(l && l.id || '') === id);
    if (!log) return;
    if (!canStockAction('logs', 'estorno', log)) {
        showToast('Você não possui permissão para estornar esta movimentação.', true);
        return;
    }
    const tipo = String(log && log.tipo || '').toUpperCase();
    if (tipo !== 'SAIDA' && tipo !== 'ENTRADA') return;
    const itemId = String(log && log.inventory_id || '');
    const item = (inventoryItems || []).find(i => String(i && i.id || '') === itemId);
    if (!item) {
        showToast('Material da movimentação não encontrado.', true);
        return;
    }
    const qtd = Math.abs(toDec(log && log.quantidade, 0));
    const delta = tipo === 'SAIDA' ? qtd : -qtd;
    const novoEstoque = toDec(item && item.estoque_atual, 0) + delta;
    const { error: updErr } = await db.from('inventory').update({ estoque_atual: novoEstoque }).eq('id', itemId);
    if (updErr) {
        showToast(updErr.message || 'Falha ao estornar estoque.', true);
        return;
    }
    const payload = {
        empresa_id: getEstoqueEmpresaScopeId(),
        inventory_id: itemId,
        atendimento_id: log.atendimento_id || null,
        tipo: 'ESTORNO',
        quantidade: delta,
        responsavel_id: currentUser && currentUser.id ? currentUser.id : null
    };
    const { error: logErr } = await db.from('inventory_logs').insert(payload);
    if (logErr) {
        showToast(logErr.message || 'Falha ao registrar estorno.', true);
        return;
    }
    await loadEstoqueData(true);
    renderInventoryTable();
    renderInventoryLogsTable();
    showToast('Estorno realizado com sucesso.');
}



function renderInventoryLogsTable() {
    const body = document.getElementById('inventoryLogsTableBody');
    const empty = document.getElementById('inventoryLogsEmptyState');
    if (!body) return;
    body.innerHTML = '';
    let rows = Array.isArray(inventoryLogs) ? inventoryLogs : [];
    if (isDentistRole()) {
        rows = rows.filter(r => String(r && r.responsavel_id || '') === String(currentUser && currentUser.id || ''));
    }
    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');
    rows.forEach(log => {
        const tipo = String(log && log.tipo || '').toUpperCase();
        const dt = log && log.data_hora ? new Date(log.data_hora) : null;
        const dtTxt = dt && Number.isFinite(dt.getTime()) ? dt.toLocaleString('pt-BR') : '—';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dtTxt}</td>
            <td>${getInventoryNameById(log && log.inventory_id)}</td>
            <td>${tipo || '—'}</td>
            <td>${toDec(log && log.quantidade).toFixed(2)}</td>
            <td>${String(log && log.atendimento_id || '—')}</td>
            <td>${((tipo === 'SAIDA' || tipo === 'ENTRADA') && canStockAction('logs', 'estorno', log)) ? `<button class="btn-icon js-log-estorno" data-id="${String(log && log.id || '')}" title="Estornar"><i class="ri-arrow-go-back-line"></i></button>` : '—'}</td>
        `;
        body.appendChild(tr);
    });
    body.querySelectorAll('.js-log-estorno').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = String(btn.getAttribute('data-id') || '');
            await estornarMovimentacao(id);
        });
    });
}

function applyInventoryReportDatePreset(preset) {
    const startInput = document.getElementById('inventoryReportStartDate');
    const endInput = document.getElementById('inventoryReportEndDate');
    if (!startInput || !endInput) return;
    const now = new Date();
    if (preset === 'today') {
        startInput.value = formatDateInput(now);
        endInput.value = formatDateInput(now);
    } else if (preset === 'last_7_days') {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        startInput.value = formatDateInput(start);
        endInput.value = formatDateInput(now);
    } else if (preset === 'current_month') {
        const firstCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startInput.value = formatDateInput(firstCurrentMonth);
        endInput.value = formatDateInput(now);
    } else if (preset === 'week') {
        const start = new Date(now);
        const day = start.getDay();
        const diff = day === 0 ? 6 : day - 1;
        start.setDate(start.getDate() - diff);
        startInput.value = formatDateInput(start);
        endInput.value = formatDateInput(now);
    } else if (preset === 'last_month') {
        const firstCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstLastMonth = new Date(firstCurrentMonth.getFullYear(), firstCurrentMonth.getMonth() - 1, 1);
        const lastLastMonth = new Date(firstCurrentMonth.getTime() - 1);
        startInput.value = formatDateInput(firstLastMonth);
        endInput.value = formatDateInput(lastLastMonth);
    }
    inventoryReportStartDate = String(startInput.value || '');
    inventoryReportEndDate = String(endInput.value || '');
    renderStockReports();
}

function exportInventoryCostsPdf() {
    const rows = Array.isArray(inventoryCostHistoryRowsCurrent) ? inventoryCostHistoryRowsCurrent : [];
    if (!rows.length) {
        showToast('Sem dados de custos para exportar no período.', true);
        return;
    }
    const body = rows.map((r) => `
        <tr>
            <td>${String(r.dataHora || '—')}</td>
            <td>${String(r.material || '—')}</td>
            <td>${String(r.tipo || '—')}</td>
            <td>${toDec(r.quantidade, 0).toFixed(2)}</td>
            <td>${formatCurrencyBRL(toDec(r.custo, 0))}</td>
            <td>${String(r.atendimento || '—')}</td>
        </tr>
    `).join('');
    const html = `
        <table>
            <thead>
                <tr><th>Data/Hora</th><th>Material</th><th>Tipo</th><th>Quantidade</th><th>Valor Movimentado</th><th>Atendimento</th></tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `;
    openStockReportPrintWindow('Relatório de Custos de Estoque', html);
}

function exportInventoryCostsExcel() {
    const rows = Array.isArray(inventoryCostHistoryRowsCurrent) ? inventoryCostHistoryRowsCurrent : [];
    if (!rows.length) {
        showToast('Sem dados de custos para exportar no período.', true);
        return;
    }
    if (typeof XLSX === 'undefined') {
        showToast('Biblioteca de Excel indisponível no momento.', true);
        return;
    }
    const data = rows.map((r) => ({
        'Data/Hora': String(r.dataHora || '—'),
        'Material': String(r.material || '—'),
        'Tipo': String(r.tipo || '—'),
        'Quantidade': toDec(r.quantidade, 0),
        'Valor Movimentado': toDec(r.custo, 0),
        'Atendimento': String(r.atendimento || '—')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CustosEstoque');
    XLSX.writeFile(wb, `custos_estoque_${formatDateInput(new Date()) || 'export'}.xlsx`);
}

async function fetchInventoryLogsForPeriod({ startDate, endDate, maxRows = 5000 } = {}) {
    const empId = getInventoryLogsEmpresaScopeId();
    if (!empId) return [];
    let q = db.from('inventory_logs').select('*').eq('empresa_id', empId).order('data_hora', { ascending: false });
    if (startDate instanceof Date && Number.isFinite(startDate.getTime())) q = q.gte('data_hora', startDate.toISOString());
    if (endDate instanceof Date && Number.isFinite(endDate.getTime())) q = q.lte('data_hora', endDate.toISOString());
    if (maxRows) q = q.limit(Math.max(1, Number(maxRows) || 5000));
    const { data, error } = await withTimeout(q, 30000, 'bi:inventory_logs');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

function resolveInventoryLogCost(invById, log) {
    const inv = invById.get(String(log && log.inventory_id || ''));
    const tipo = String(log && log.tipo || '').toUpperCase();
    const qtd = toDec(log && log.quantidade, 0);
    const fallback = qtd * toDec(inv && inv.preco_custo, 0);
    if (tipo === 'ENTRADA_NF') return toDec(log && log.valor_total_nf, 0);
    return fallback;
}

function renderInventoryAccuracyReport(container, invRows) {
    const rows = (Array.isArray(invRows) ? invRows : [])
        .filter(isInventoryActive)
        .slice()
        .sort((a, b) => String(a && a.nome || '').localeCompare(String(b && b.nome || ''), 'pt-BR'));
    inventoryBiReportRowsCurrent = rows.map(i => {
        const id = String(i && i.id || '');
        const sistema = toDec(i && i.estoque_atual, 0);
        const fisRaw = inventoryBiAccuracyPhysicalById.get(id);
        const fis = fisRaw != null && String(fisRaw).trim() !== '' ? toDec(fisRaw, 0) : null;
        const diff = fis == null ? null : (fis - sistema);
        const min = toDec(i && i.estoque_minimo, 0);
        const low = sistema <= min;
        return {
            inventory_id: id,
            produto: String(i && i.nome || '—'),
            unidade: String(i && i.unidade || '—'),
            saldo_sistema: sistema,
            saldo_fisico: fis,
            diferenca: diff,
            estoque_minimo: min,
            abaixo_minimo: low
        };
    });
    const body = inventoryBiReportRowsCurrent.map(r => {
        const fisTxt = r.saldo_fisico == null ? '' : formatNumberBR(toDec(r.saldo_fisico, 0), 2);
        const diffTxt = r.diferenca == null ? '—' : formatNumberBR(toDec(r.diferenca, 0), 2);
        return `<tr class="${r.abaixo_minimo ? 'inventory-row-low' : ''}">
            <td>${escapeHtml(String(r.produto || '—'))}</td>
            <td>${escapeHtml(String(r.unidade || '—'))}</td>
            <td class="num ${r.abaixo_minimo ? 'inventory-balance-low' : ''}">${toDec(r.saldo_sistema, 0).toFixed(2)}</td>
            <td class="num">
                <input type="text" class="form-control js-phys-count" data-inv-id="${escapeHtml(String(r.inventory_id || ''))}" inputmode="decimal" data-mask="decimal2" value="${escapeHtml(fisTxt)}" placeholder="0,00" style="max-width: 140px;">
            </td>
            <td class="num"><span class="js-phys-diff" data-inv-id="${escapeHtml(String(r.inventory_id || ''))}">${escapeHtml(diffTxt)}</span></td>
            <td class="num">${toDec(r.estoque_minimo, 0).toFixed(2)}</td>
        </tr>`;
    }).join('');
    container.innerHTML = `
        <h3 class="card-title">Relatório de Acuracidade</h3>
        <div class="stock-dashboard-sub" style="margin-top:-6px; margin-bottom:10px;">Produto | Saldo Sistema | Saldo Físico | Diferença (Físico - Sistema). Itens abaixo do mínimo ficam destacados.</div>
        <div class="table-container">
            <table>
                <thead><tr><th>Produto</th><th>Unidade</th><th class="num">Saldo Sistema</th><th class="num">Saldo Físico</th><th class="num">Diferença</th><th class="num">Mínimo</th></tr></thead>
                <tbody>${body || `<tr><td colspan="6" style="color:var(--text-muted);">Nenhum item encontrado.</td></tr>`}</tbody>
            </table>
        </div>
    `;
    container.querySelectorAll('.js-phys-count').forEach((el) => {
        el.addEventListener('input', (e) => {
            const target = e && e.target ? e.target : null;
            const invId = target ? String(target.getAttribute('data-inv-id') || '').trim() : '';
            const val = target ? String(target.value || '') : '';
            if (!invId) return;
            inventoryBiAccuracyPhysicalById.set(invId, val);
            const row = (Array.isArray(inventoryBiReportRowsCurrent) ? inventoryBiReportRowsCurrent : []).find(r => String(r && r.inventory_id || '') === invId) || null;
            if (row) {
                const fis = val.trim() === '' ? null : toDec(val, 0);
                row.saldo_fisico = fis;
                row.diferenca = fis == null ? null : (fis - toDec(row.saldo_sistema, 0));
                const diffTxt = row.diferenca == null ? '—' : formatNumberBR(toDec(row.diferenca, 0), 2);
                const diffEl = container.querySelector(`.js-phys-diff[data-inv-id="${invId}"]`);
                if (diffEl) diffEl.textContent = diffTxt;
            }
        });
    });
}

function renderInventoryCostBySubdivision(container, rows) {
    inventoryBiReportRowsCurrent = Array.isArray(rows) ? rows : [];
    const body = inventoryBiReportRowsCurrent.map(r => `
        <tr>
            <td><strong>${escapeHtml(String(r.subdivisao || '—'))}</strong></td>
            <td class="num">${formatCurrencyBRL(toDec(r.custo_total, 0))}</td>
            <td class="num">${toDec(r.quantidade_total, 0).toFixed(2)}</td>
            <td class="num">${Number(r.atendimentos || 0)}</td>
            <td class="num">${Number(r.movimentos || 0)}</td>
        </tr>
    `).join('');
    container.innerHTML = `
        <h3 class="card-title">Custo por Subdivisão</h3>
        <div class="table-container">
            <table>
                <thead><tr><th>Subdivisão</th><th class="num">Custo Total</th><th class="num">Quantidade (Total)</th><th class="num">Atendimentos</th><th class="num">Movimentos</th></tr></thead>
                <tbody>${body || `<tr><td colspan="5" style="color:var(--text-muted);">Sem consumos no período.</td></tr>`}</tbody>
            </table>
        </div>
    `;
}

function renderInventoryConsumptionByAttendance(container, rows) {
    inventoryBiReportRowsCurrent = Array.isArray(rows) ? rows : [];
    const body = inventoryBiReportRowsCurrent.map(r => `
        <tr>
            <td>${escapeHtml(String(r.paciente || '—'))}</td>
            <td>${escapeHtml(String(r.procedimento || '—'))}</td>
            <td>${escapeHtml(String(r.subdivisao || '—'))}</td>
            <td>${escapeHtml(String(r.materiais || '—'))}</td>
            <td class="num">${formatCurrencyBRL(toDec(r.custo_total, 0))}</td>
            <td>${escapeHtml(String(r.data_hora || '—'))}</td>
        </tr>
    `).join('');
    container.innerHTML = `
        <h3 class="card-title">Consumo por Atendimento</h3>
        <div class="table-container">
            <table>
                <thead><tr><th>Paciente</th><th>Procedimento</th><th>Subdivisão</th><th>Materiais Utilizados</th><th class="num">Custo</th><th>Data/Hora</th></tr></thead>
                <tbody>${body || `<tr><td colspan="6" style="color:var(--text-muted);">Sem consumos no período.</td></tr>`}</tbody>
            </table>
        </div>
    `;
}

async function renderInventoryBiReports() {
    const container = document.getElementById('inventoryBiReportContainer');
    if (!container) return;
    const typeEl = document.getElementById('inventoryBiReportType');
    if (typeEl) inventoryBiReportType = String(typeEl.value || inventoryBiReportType || 'accuracy');
    const startDate = parseDateFromInput(inventoryReportStartDate, false);
    const endDate = parseDateFromInput(inventoryReportEndDate, true);
    const invRows = Array.isArray(inventoryItems) ? inventoryItems : [];
    if (inventoryBiReportType === 'accuracy') {
        renderInventoryAccuracyReport(container, invRows);
        return;
    }
    container.innerHTML = `<div class="stock-dashboard-sub">Carregando relatório...</div>`;
    try {
        if (inventoryBiReportType === 'cost_by_subdivision') {
            const res = await buildCostBySubdivisionRows({ startDate, endDate });
            renderInventoryCostBySubdivision(container, res.rows);
            return;
        }
        if (inventoryBiReportType === 'consumption_by_attendance') {
            const res = await buildConsumptionReportRows({ startDate, endDate });
            renderInventoryConsumptionByAttendance(container, res.rows);
            return;
        }
        container.innerHTML = `<div class="stock-dashboard-sub">Relatório indisponível.</div>`;
    } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Falha ao gerar relatório.';
        container.innerHTML = `<div class="stock-dashboard-sub" style="color:#dc2626;">${escapeHtml(msg)}</div>`;
    }
}

function exportInventoryBiPdf() {
    const type = String(inventoryBiReportType || 'accuracy');
    const rows = Array.isArray(inventoryBiReportRowsCurrent) ? inventoryBiReportRowsCurrent : [];
    if (!rows.length) {
        showToast('Sem dados para exportar.', true);
        return;
    }
    if (type === 'accuracy') {
        const body = rows.map(r => `
            <tr class="${r.abaixo_minimo ? 'inventory-row-low' : ''}">
                <td>${escapeHtml(String(r.produto || '—'))}</td>
                <td>${escapeHtml(String(r.unidade || '—'))}</td>
                <td class="num">${toDec(r.saldo_sistema, 0).toFixed(2)}</td>
                <td class="num">${r.saldo_fisico == null ? '—' : toDec(r.saldo_fisico, 0).toFixed(2)}</td>
                <td class="num">${r.diferenca == null ? '—' : toDec(r.diferenca, 0).toFixed(2)}</td>
                <td class="num">${toDec(r.estoque_minimo, 0).toFixed(2)}</td>
            </tr>
        `).join('');
        const html = `
            <table>
                <thead><tr><th>Produto</th><th>Unidade</th><th class="num">Saldo Sistema</th><th class="num">Saldo Físico</th><th class="num">Diferença</th><th class="num">Mínimo</th></tr></thead>
                <tbody>${body}</tbody>
            </table>
        `;
        openStockReportPrintWindow('Relatório de Acuracidade', html);
        return;
    }
    if (type === 'cost_by_subdivision') {
        const body = rows.map(r => `
            <tr>
                <td>${escapeHtml(String(r.subdivisao || '—'))}</td>
                <td class="num">${formatCurrencyBRL(toDec(r.custo_total, 0))}</td>
                <td class="num">${toDec(r.quantidade_total, 0).toFixed(2)}</td>
                <td class="num">${Number(r.atendimentos || 0)}</td>
                <td class="num">${Number(r.movimentos || 0)}</td>
            </tr>
        `).join('');
        const html = `
            <table>
                <thead><tr><th>Subdivisão</th><th class="num">Custo Total</th><th class="num">Quantidade (Total)</th><th class="num">Atendimentos</th><th class="num">Movimentos</th></tr></thead>
                <tbody>${body}</tbody>
            </table>
        `;
        openStockReportPrintWindow('Custo por Subdivisão', html);
        return;
    }
    if (type === 'consumption_by_attendance') {
        const body = rows.map(r => `
            <tr>
                <td>${escapeHtml(String(r.paciente || '—'))}</td>
                <td>${escapeHtml(String(r.procedimento || '—'))}</td>
                <td>${escapeHtml(String(r.subdivisao || '—'))}</td>
                <td>${escapeHtml(String(r.materiais || '—'))}</td>
                <td class="num">${formatCurrencyBRL(toDec(r.custo_total, 0))}</td>
                <td>${escapeHtml(String(r.data_hora || '—'))}</td>
            </tr>
        `).join('');
        const html = `
            <table>
                <thead><tr><th>Paciente</th><th>Procedimento</th><th>Subdivisão</th><th>Materiais Utilizados</th><th class="num">Custo</th><th>Data/Hora</th></tr></thead>
                <tbody>${body}</tbody>
            </table>
        `;
        openStockReportPrintWindow('Consumo por Atendimento', html);
        return;
    }
}

function exportInventoryBiExcel() {
    const type = String(inventoryBiReportType || 'accuracy');
    const rows = Array.isArray(inventoryBiReportRowsCurrent) ? inventoryBiReportRowsCurrent : [];
    if (!rows.length) {
        showToast('Sem dados para exportar.', true);
        return;
    }
    if (typeof XLSX === 'undefined') {
        showToast('Biblioteca de Excel indisponível no momento.', true);
        return;
    }
    let data = [];
    let sheet = 'Relatorio';
    let file = 'relatorio';
    if (type === 'accuracy') {
        sheet = 'Acuracidade';
        file = 'acuracidade';
        data = rows.map(r => ({
            'Produto': String(r.produto || ''),
            'Unidade': String(r.unidade || ''),
            'Saldo Sistema': toDec(r.saldo_sistema, 0),
            'Saldo Físico': r.saldo_fisico == null ? '' : toDec(r.saldo_fisico, 0),
            'Diferença': r.diferenca == null ? '' : toDec(r.diferenca, 0),
            'Mínimo': toDec(r.estoque_minimo, 0),
            'Abaixo do Mínimo': r.abaixo_minimo ? 'Sim' : 'Não'
        }));
    } else if (type === 'cost_by_subdivision') {
        sheet = 'CustoSubdivisao';
        file = 'custo_subdivisao';
        data = rows.map(r => ({
            'Subdivisão': String(r.subdivisao || ''),
            'Custo Total': toDec(r.custo_total, 0),
            'Quantidade (Total)': toDec(r.quantidade_total, 0),
            'Atendimentos': Number(r.atendimentos || 0),
            'Movimentos': Number(r.movimentos || 0)
        }));
    } else if (type === 'consumption_by_attendance') {
        sheet = 'ConsumoAtendimento';
        file = 'consumo_atendimento';
        data = rows.map(r => ({
            'Paciente': String(r.paciente || ''),
            'Procedimento': String(r.procedimento || ''),
            'Subdivisão': String(r.subdivisao || ''),
            'Materiais Utilizados': String(r.materiais || ''),
            'Custo': toDec(r.custo_total, 0),
            'Data/Hora': String(r.data_hora || '')
        }));
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, `${file}_${formatDateInput(new Date()) || 'export'}.xlsx`);
}

function inventoryAreaMatchesFilter(item, filterValue) {
    const f = String(filterValue || '').trim();
    if (!f) return true;
    return normalizeKey(getInventoryAreaLabel(item)) === normalizeKey(f);
}

function printInventoryChecklistReport() {
    const rows = (inventoryCurrentGridRows || [])
        .slice()
        .sort((a, b) => String(a && a.nome || '').localeCompare(String(b && b.nome || ''), 'pt-BR'));
    const reportTitle = inventoryBuyOnly ? 'Compra de Materiais' : 'Conferência de Estoque (Grid Atual)';
    if (!rows.length) {
        showToast(inventoryBuyOnly ? 'Não há itens para compra na seleção atual.' : 'Não há itens ativos para impressão.', true);
        return;
    }
    const body = rows.map(i => `
        <tr>
            <td>${String(i && i.nome || '—')}</td>
            <td>${String(i && i.unidade || '—')}</td>
            <td>${toDec(i && i.estoque_atual, 0).toFixed(3)}</td>
            <td style="width:90px; text-align:center; font-size:18px;">[ ]</td>
        </tr>
    `).join('');
    const html = `
        <table>
            <thead>
                <tr>
                    <th>Nome do Item</th>
                    <th>Unidade</th>
                    <th>Estoque Atual</th>
                    <th>Conferido</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `;
    openStockReportPrintWindow(reportTitle, html);
}

function renderInventoryNameSuggestions(query = '') {
    const list = document.getElementById('inventoryNomeSuggestions');
    if (!list) return;
    const q = normalizeKey(normalizeInventoryName(query));
    const names = Array.from(new Set((inventoryItems || []).map(i => normalizeInventoryName(i && i.nome || '')).filter(Boolean)));
    const ordered = names
        .filter(n => !q || normalizeKey(n).includes(q))
        .sort((a, b) => {
            const aStarts = q && normalizeKey(a).startsWith(q) ? 0 : 1;
            const bStarts = q && normalizeKey(b).startsWith(q) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.localeCompare(b, 'pt-BR');
        })
        .slice(0, 12);
    list.innerHTML = ordered.map(n => `<option value="${n}"></option>`).join('');
}

function renderInventoryAreaFilterOptions() {
    const select = document.getElementById('inventoryAreaFilter');
    if (!select) return;
    const sourceRows = inventoryShowLibraryFull ? (inventoryItems || []).filter(i => !isInventoryActive(i)) : (inventoryItems || []).filter(isInventoryActive);
    const fallbackAreas = Array.from(new Set(sourceRows.map(getInventoryArea))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const areas = (inventoryAreaOptions && inventoryAreaOptions.length) ? inventoryAreaOptions : fallbackAreas;
    select.innerHTML = `<option value="">Todas as Áreas</option>${areas.map(a => `<option value="${a}">${a}</option>`).join('')}`;
    if (inventoryAreaFilter && areas.includes(inventoryAreaFilter)) {
        select.value = inventoryAreaFilter;
    } else {
        inventoryAreaFilter = '';
        select.value = '';
    }
}

function openInventoryNfEntryModal(item) {
    return new Promise((resolve) => {
        const prev = document.getElementById('inventoryNfEntryModal');
        if (prev) prev.remove();
        const overlay = document.createElement('div');
        overlay.id = 'inventoryNfEntryModal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 560px;">
                <div class="modal-header">
                    <h3>Dar Entrada (NF)</h3>
                    <button type="button" class="btn-close-modal" id="btnCloseInventoryNfEntry"><i class="ri-close-line"></i></button>
                </div>
                <div class="modal-body">
                    <form id="inventoryNfEntryForm" class="patient-form" style="margin-bottom: 0;">
                        <div class="form-grid">
                            <div class="form-group span-2">
                                <label>Material</label>
                                <input type="text" class="readonly-input" readonly value="${String(item && item.nome || '—')}">
                            </div>
                            <div class="form-group">
                                <label for="inventoryNfQuantidade">Quantidade Comprada *</label>
                                <input type="text" id="inventoryNfQuantidade" inputmode="decimal" data-mask="decimal2" value="1" required>
                            </div>
                            <div class="form-group">
                                <label for="inventoryNfValorTotal">Valor Total da NF *</label>
                                <input type="text" id="inventoryNfValorTotal" inputmode="decimal" data-mask="currency" value="R$ 0,00" required>
                            </div>
                            <div class="form-group span-2">
                                <label for="inventoryNfUnidadeCompra">Unidade de Compra (NF) <span title="💡 Recomendamos converter para a menor unidade de consumo (g, ml, un) para que o custo por procedimento seja exato." style="cursor:help; margin-left:4px;"><i class="ri-question-line"></i></span></label>
                                <select id="inventoryNfUnidadeCompra" class="form-control">
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                    <option value="ml">ml</option>
                                    <option value="l">l</option>
                                    <option value="cx">cx</option>
                                    <option value="tb">tb</option>
                                    <option value="pt">pt</option>
                                    <option value="un">un</option>
                                    <option value="par">par</option>
                                    <option value="fl">fl</option>
                                    <option value="rl">rl</option>
                                    <option value="ct">ct</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="inventoryNfUnidadeConsumo">Unidade de Consumo</label>
                                <select id="inventoryNfUnidadeConsumo" class="form-control">
                                    <option value="g">g</option>
                                    <option value="ml">ml</option>
                                    <option value="un">un</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="inventoryNfFatorInfo">Fator de Conversão</label>
                                <input type="text" id="inventoryNfFatorInfo" class="readonly-input" readonly value="1">
                            </div>
                            <div class="form-group span-2 hidden" id="inventoryNfConteudoWrap">
                                <label for="inventoryNfConteudo">Conteúdo por embalagem? *</label>
                                <input type="text" id="inventoryNfConteudo" class="form-control" inputmode="decimal" data-mask="decimal3" value="">
                            </div>
                            <div class="form-group span-2 hidden" id="inventoryNfAvisoWrap">
                                <div id="inventoryNfAviso" style="padding:10px 12px; border:1px solid #fde68a; border-radius:8px; background:#fffbeb; color:#92400e; font-size:12px;"></div>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" id="btnCancelInventoryNfEntry" class="btn btn-secondary">Cancelar</button>
                            <button type="submit" class="btn btn-primary"><i class="ri-save-line"></i> Salvar Entrada</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const form = document.getElementById('inventoryNfEntryForm');
        const btnClose = document.getElementById('btnCloseInventoryNfEntry');
        const btnCancel = document.getElementById('btnCancelInventoryNfEntry');
        const compraSel = document.getElementById('inventoryNfUnidadeCompra');
        const consumoSel = document.getElementById('inventoryNfUnidadeConsumo');
        const fatorInfo = document.getElementById('inventoryNfFatorInfo');
        const conteudoWrap = document.getElementById('inventoryNfConteudoWrap');
        const conteudoInput = document.getElementById('inventoryNfConteudo');
        const avisoWrap = document.getElementById('inventoryNfAvisoWrap');
        const aviso = document.getElementById('inventoryNfAviso');
        const packagingUnits = new Set(['pt', 'cx', 'fl', 'ct', 'rl', 'tb']);
        const suggest = () => {
            const compra = normalizeUnitCode(compraSel && compraSel.value);
            let consumo = normalizeUnitCode(consumoSel && consumoSel.value);
            let fator = 1;
            let requiresContent = false;
            let fixed = false;
            if (compra === 'kg') { consumo = 'g'; fator = 1000; fixed = true; }
            else if (compra === 'l') { consumo = 'ml'; fator = 1000; fixed = true; }
            else if (compra === 'par') { consumo = 'un'; fator = 2; fixed = true; }
            else if (packagingUnits.has(compra)) {
                requiresContent = true;
                if (!['g', 'ml', 'un'].includes(consumo)) consumo = normalizeUnitCode(String(item && item.unidade_medida || 'un')) || 'un';
                fator = toDec(conteudoInput && conteudoInput.value, 0);
            } else {
                if (!consumo) consumo = normalizeUnitCode(String(item && item.unidade_medida || '')) || compra || 'un';
                fator = compra && consumo && compra !== consumo ? toDec(item && item.fator_conversao, 0) : 1;
                if (fator <= 0) fator = 1;
            }
            if (consumoSel) consumoSel.value = consumo;
            if (conteudoWrap) conteudoWrap.classList.toggle('hidden', !requiresContent);
            if (conteudoInput) conteudoInput.required = !!requiresContent;
            if (fatorInfo) fatorInfo.value = Number.isFinite(fator) && fator > 0 ? String(fator) : '';
            if (avisoWrap && aviso) {
                const converted = !!(compra && consumo && compra !== consumo && fator > 0);
                if (!converted) {
                    avisoWrap.classList.add('hidden');
                } else {
                    avisoWrap.classList.remove('hidden');
                    aviso.textContent = `Atenção: Produto convertido de [${compra}] para [${consumo}] para precisão de custo por procedimento.`;
                }
            }
            if (consumoSel) consumoSel.disabled = fixed;
            return { compra, consumo, fator, requiresContent };
        };
        if (compraSel) {
            const v = normalizeUnitCode(item && item.unidade || '');
            compraSel.value = v;
            if (String(compraSel.value || '') !== v) {
                compraSel.value = 'un';
            }
            compraSel.addEventListener('change', suggest);
            compraSel.addEventListener('input', suggest);
        }
        if (consumoSel) {
            const c = normalizeUnitCode(item && item.unidade_medida || '');
            consumoSel.value = ['g', 'ml', 'un'].includes(c) ? c : 'un';
            consumoSel.addEventListener('change', suggest);
            consumoSel.addEventListener('input', suggest);
        }
        if (conteudoInput) {
            conteudoInput.addEventListener('input', suggest);
            conteudoInput.addEventListener('change', suggest);
        }
        suggest();
        const close = (result) => {
            overlay.remove();
            resolve(result);
        };
        if (btnClose) btnClose.onclick = () => close({ ok: false });
        if (btnCancel) btnCancel.onclick = () => close({ ok: false });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close({ ok: false });
        });
        if (form) form.onsubmit = (e) => {
            e.preventDefault();
            const qtdInput = document.getElementById('inventoryNfQuantidade');
            const totalInput = document.getElementById('inventoryNfValorTotal');
            const quantidade = toDec(qtdInput && qtdInput.value, 0);
            const valorTotal = toDec(totalInput && totalInput.value, 0);
            const conv = suggest();
            if (conv.requiresContent && toDec(conteudoInput && conteudoInput.value, 0) <= 0) {
                showToast('Informe o conteúdo por embalagem para calcular a conversão.', true);
                return;
            }
            close({
                ok: true,
                quantidade,
                valorTotal,
                compra: normalizeUnitCode(conv.compra || ''),
                consumo: normalizeUnitCode(conv.consumo || ''),
                fator: toDec(conv.fator, 1)
            });
        };
    });
}

function bindEstoqueModule() {
    if (estoqueBindingsReady) return;
    estoqueBindingsReady = true;
    const btnNew = document.getElementById('btnInventoryNew');
    const btnCancel = document.getElementById('btnInventoryCancel');
    const invForm = document.getElementById('inventoryForm');
    const usageForm = document.getElementById('usageModelForm');
    const modelItemForm = document.getElementById('modelItemForm');
    const btnRestore = document.getElementById('btnRestoreStockMaster');
    const btnPrintInv = document.getElementById('btnPrintInventoryReport');
    const btnPrintModels = document.getElementById('btnPrintModelsReport');
    const btnPrintInventoryChecklist = document.getElementById('btnPrintInventoryChecklist');
    const btnPrintUsageModelsReport = document.getElementById('btnPrintUsageModelsReport');
    const btnToggleLibrary = document.getElementById('btnToggleInventoryLibrary');
    const inventoryTypeFilterInput = document.getElementById('inventoryTypeFilter');
    const inventoryBuyOnlyInput = document.getElementById('inventoryBuyOnlyFilter');
    const serviceMappingSearchInput = document.getElementById('serviceMappingSearchInput');
    const serviceMappingStatusFilterInput = document.getElementById('serviceMappingStatusFilter');
    const btnPrintServiceMappingReport = document.getElementById('btnPrintServiceMappingReport');
    const usageModelIncludeBiosseg = document.getElementById('usageModelIncludeBiosseg');
    const nomeInput = document.getElementById('inventoryNome');
    const searchInput = document.getElementById('inventorySearchInput');
    const areaFilterInput = document.getElementById('inventoryAreaFilter');
    const reportStartDateInput = document.getElementById('inventoryReportStartDate');
    const reportEndDateInput = document.getElementById('inventoryReportEndDate');
    const btnReportToday = document.getElementById('btnInventoryReportToday');
    const btnReportLast7Days = document.getElementById('btnInventoryReportLast7Days');
    const btnReportCurrentMonth = document.getElementById('btnInventoryReportCurrentMonth');
    const btnExportInventoryCostsPdf = document.getElementById('btnExportInventoryCostsPdf');
    const btnExportInventoryCostsExcel = document.getElementById('btnExportInventoryCostsExcel');
    const biTypeSelect = document.getElementById('inventoryBiReportType');
    const btnExportInventoryBiPdf = document.getElementById('btnExportInventoryBiPdf');
    const btnExportInventoryBiExcel = document.getElementById('btnExportInventoryBiExcel');
    const btnStockReportHome = document.getElementById('btnStockReportHome');
    const btnStockReportAccuracy = document.getElementById('btnStockReportAccuracy');
    const btnStockReportReplenishment = document.getElementById('btnStockReportReplenishment');
    const btnStockReportCosts = document.getElementById('btnStockReportCosts');
    const btnStockReportCostBySubdivision = document.getElementById('btnStockReportCostBySubdivision');
    const btnStockReportConsumption = document.getElementById('btnStockReportConsumption');
    const btnStockReportInventory = document.getElementById('btnStockReportInventory');
    const btnStockReportKits = document.getElementById('btnStockReportKits');
    const btnStockReportApuracao = document.getElementById('btnStockReportApuracao');
    const btnStockReportBack = document.getElementById('btnStockReportBack');
    const btnStockReportInitialAdjust = document.getElementById('btnStockReportInitialAdjust');
    const btnStockReportPrint = document.getElementById('btnStockReportPrint');
    const btnStockReportPdf = document.getElementById('btnStockReportPdf');
    const btnStockReportExcel = document.getElementById('btnStockReportExcel');
    const inventoryModal = document.getElementById('inventoryModal');
    const inventoryModalX = document.getElementById('btnInventoryModalX');
    const inventoryModalTitle = document.getElementById('inventoryModalTitle');
    ensureInventoryTipoAreaBinding();
    const unidadeCompraInput = document.getElementById('inventoryUnidade');
    const unidadeConsumoInput = document.getElementById('inventoryUnidadeMedida');
    if (unidadeCompraInput) {
        unidadeCompraInput.addEventListener('change', syncInventoryConversionUiFromInputs);
        unidadeCompraInput.addEventListener('input', syncInventoryConversionUiFromInputs);
    }
    if (unidadeConsumoInput) {
        unidadeConsumoInput.addEventListener('change', syncInventoryConversionUiFromInputs);
        unidadeConsumoInput.addEventListener('input', syncInventoryConversionUiFromInputs);
    }
    syncInventoryConversionUiFromInputs();

    const canInvInsert = canStockAction('inventory', 'insert');
    const canModelInsert = canStockAction('models', 'insert');
    if (btnNew) {
        btnNew.style.display = canInvInsert ? 'inline-flex' : 'none';
        btnNew.addEventListener('click', () => {
            if (!canStockAction('inventory', 'insert')) {
                showToast('Ação permitida apenas para Administrador.', true);
                return;
            }
            const form = document.getElementById('inventoryForm');
            if (form) form.classList.remove('hidden');
            const editId = document.getElementById('inventoryEditId');
            const nome = document.getElementById('inventoryNome');
            const codigoBarras = document.getElementById('inventoryCodigoBarras');
            const unidade = document.getElementById('inventoryUnidade');
            const unidadeMedida = document.getElementById('inventoryUnidadeMedida');
            const tipoInventario = document.getElementById('inventoryTipoInventario');
            const areaInput = document.getElementById('inventoryArea');
            const minimo = document.getElementById('inventoryMinimo');
            const atual = document.getElementById('inventoryAtual');
            const ehConsumivel = document.getElementById('inventoryEhConsumivel');
            if (editId) editId.value = '';
            if (nome) nome.value = '';
            if (codigoBarras) codigoBarras.value = '';
            if (unidade) unidade.value = 'un';
            if (unidadeMedida) unidadeMedida.value = 'un';
            const fatorConversao = document.getElementById('inventoryFatorConversao');
            if (fatorConversao) fatorConversao.value = '1';
            syncInventoryConversionUiFromInputs();
            if (tipoInventario) tipoInventario.value = 'consumiveis';
            ensureInventoryTipoAreaBinding();
            if (window.updateInventoryAreaOptionsForTipoInventario) window.updateInventoryAreaOptionsForTipoInventario();
            syncInventoryAreaByType('consumiveis', 'Dentística');
            if (minimo) minimo.value = formatNumberBR(0, 2);
            if (atual) atual.value = formatNumberBR(0, 2);
            if (ehConsumivel) ehConsumivel.checked = true;
            if (inventoryModalTitle) inventoryModalTitle.textContent = 'Novo Material';
            if (inventoryModal) inventoryModal.classList.remove('hidden');
            setTimeout(() => {
                if (window.updateInventoryAreaOptionsForTipoInventario) window.updateInventoryAreaOptionsForTipoInventario();
                if (window.__forceInventoryAreaOptions) window.__forceInventoryAreaOptions(tipoInventario || document.getElementById('inventoryTipoInventario'));
            }, 0);
            renderInventoryNameSuggestions('');
        });
    }

    if (btnCancel) btnCancel.addEventListener('click', () => {
        if (inventoryModal) inventoryModal.classList.add('hidden');
    });
    if (inventoryModalX) inventoryModalX.addEventListener('click', () => {
        if (inventoryModal) inventoryModal.classList.add('hidden');
    });
    if (inventoryModal) inventoryModal.addEventListener('click', (e) => {
        if (e.target === inventoryModal) inventoryModal.classList.add('hidden');
    });

    if (nomeInput) {
        nomeInput.addEventListener('focus', () => renderInventoryNameSuggestions(nomeInput.value || ''));
        nomeInput.addEventListener('input', () => renderInventoryNameSuggestions(nomeInput.value || ''));
    }
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (inventorySearchTimer) clearTimeout(inventorySearchTimer);
            inventorySearchTimer = setTimeout(() => {
                inventorySearchTerm = String(searchInput.value || '');
                renderInventoryTable();
            }, 300);
        });
    }
    if (areaFilterInput) {
        areaFilterInput.addEventListener('change', () => {
            inventoryAreaFilter = String(areaFilterInput.value || '');
            renderInventoryTable();
        });
    }
    if (inventoryTypeFilterInput) {
        inventoryTypeFilterInput.value = String(inventoryTypeFilter || '');
        inventoryTypeFilterInput.addEventListener('change', () => {
            inventoryTypeFilter = String(inventoryTypeFilterInput.value || '');
            renderInventoryTable();
        });
    }
    if (inventoryBuyOnlyInput) {
        inventoryBuyOnlyInput.checked = !!inventoryBuyOnly;
        inventoryBuyOnlyInput.addEventListener('change', () => {
            inventoryBuyOnly = !!inventoryBuyOnlyInput.checked;
            renderInventoryTable();
        });
    }
    if (reportStartDateInput) {
        if (inventoryReportStartDate) reportStartDateInput.value = inventoryReportStartDate;
        reportStartDateInput.addEventListener('change', () => {
            inventoryReportStartDate = String(reportStartDateInput.value || '');
            renderStockReports();
        });
    }
    if (reportEndDateInput) {
        if (inventoryReportEndDate) reportEndDateInput.value = inventoryReportEndDate;
        reportEndDateInput.addEventListener('change', () => {
            inventoryReportEndDate = String(reportEndDateInput.value || '');
            renderStockReports();
        });
    }
    if (btnReportToday) {
        btnReportToday.addEventListener('click', () => {
            applyInventoryReportDatePreset('today');
        });
    }
    if (btnReportLast7Days) {
        btnReportLast7Days.addEventListener('click', () => {
            applyInventoryReportDatePreset('last_7_days');
        });
    }
    if (btnReportCurrentMonth) {
        btnReportCurrentMonth.addEventListener('click', () => {
            applyInventoryReportDatePreset('current_month');
        });
    }
    if (btnExportInventoryCostsPdf) btnExportInventoryCostsPdf.addEventListener('click', exportInventoryCostsPdf);
    if (btnExportInventoryCostsExcel) btnExportInventoryCostsExcel.addEventListener('click', exportInventoryCostsExcel);
    if (biTypeSelect) {
        biTypeSelect.value = String(inventoryBiReportType || 'accuracy');
        biTypeSelect.addEventListener('change', () => {
            inventoryBiReportType = String(biTypeSelect.value || 'accuracy');
            renderInventoryBiReports();
        });
    }
    if (btnExportInventoryBiPdf) btnExportInventoryBiPdf.addEventListener('click', exportInventoryBiPdf);
    if (btnExportInventoryBiExcel) btnExportInventoryBiExcel.addEventListener('click', exportInventoryBiExcel);
    if (btnStockReportHome) btnStockReportHome.addEventListener('click', () => { setStockReportsActive('home'); });
    if (btnStockReportAccuracy) btnStockReportAccuracy.addEventListener('click', () => setStockReportsActive('accuracy'));
    if (btnStockReportReplenishment) btnStockReportReplenishment.addEventListener('click', () => setStockReportsActive('replenishment'));
    if (btnStockReportCosts) btnStockReportCosts.addEventListener('click', () => setStockReportsActive('costs'));
    if (btnStockReportCostBySubdivision) btnStockReportCostBySubdivision.addEventListener('click', () => setStockReportsActive('cost_by_subdivision'));
    if (btnStockReportConsumption) btnStockReportConsumption.addEventListener('click', () => setStockReportsActive('consumption'));
    if (btnStockReportInventory) btnStockReportInventory.addEventListener('click', () => setStockReportsActive('inventory'));
    if (btnStockReportKits) btnStockReportKits.addEventListener('click', () => setStockReportsActive('kits'));
    if (btnStockReportApuracao) btnStockReportApuracao.addEventListener('click', () => { setStockReportsActive('financial_apportion'); });
    if (btnStockReportBack) btnStockReportBack.addEventListener('click', () => setStockReportsActive('home'));
    syncStockReportInitialAdjustButton();
    if (btnStockReportPrint) btnStockReportPrint.addEventListener('click', printStockReportActive);
    if (btnStockReportPdf) btnStockReportPdf.addEventListener('click', exportStockReportActivePdf);
    if (btnStockReportExcel) btnStockReportExcel.addEventListener('click', exportStockReportActiveExcel);
    if (btnToggleLibrary) {
        btnToggleLibrary.addEventListener('click', () => {
            inventoryShowLibraryFull = !inventoryShowLibraryFull;
            renderInventoryTable();
        });
    }
    if (btnPrintInventoryChecklist) {
        btnPrintInventoryChecklist.addEventListener('click', () => {
            printInventoryChecklistReport();
        });
    }
    if (btnPrintUsageModelsReport) {
        btnPrintUsageModelsReport.addEventListener('click', () => {
            printUsageModelsMasterDetailReport();
        });
    }
    if (usageModelIncludeBiosseg && !usageModelIncludeBiosseg.__occBound) {
        usageModelIncludeBiosseg.__occBound = true;
        usageModelIncludeBiosseg.checked = true;
        usageModelIncludeBiosseg.addEventListener('change', () => {
            if (usageModelIncludeBiosseg.checked) return;
            const ok = confirm('Atenção: Desmarcar a biossegurança impedirá a baixa automática de luvas e máscaras neste serviço');
            if (!ok) usageModelIncludeBiosseg.checked = true;
        });
    }
    if (serviceMappingSearchInput) {
        serviceMappingSearchInput.addEventListener('input', () => {
            serviceMappingSearchTerm = String(serviceMappingSearchInput.value || '');
            renderServiceMappingTable();
        });
    }
    if (serviceMappingStatusFilterInput) {
        serviceMappingStatusFilterInput.value = String(serviceMappingStatusFilter || 'com_modelo');
        serviceMappingStatusFilterInput.addEventListener('change', () => {
            serviceMappingStatusFilter = String(serviceMappingStatusFilterInput.value || 'com_modelo');
            renderServiceMappingTable();
        });
    }
    if (btnPrintServiceMappingReport) {
        btnPrintServiceMappingReport.addEventListener('click', () => {
            printServiceMappingFilteredReport();
        });
    }
    const inventoryTipoInventarioInput = document.getElementById('inventoryTipoInventario');
    if (inventoryTipoInventarioInput) {
        const updateInventoryAreaByType = () => {
            if (window.updateInventoryAreaOptionsForTipoInventario) {
                window.updateInventoryAreaOptionsForTipoInventario();
            } else {
                syncInventoryAreaByType(String(inventoryTipoInventarioInput.value || ''), '');
            }
        };
        inventoryTipoInventarioInput.addEventListener('change', updateInventoryAreaByType);
        inventoryTipoInventarioInput.addEventListener('input', updateInventoryAreaByType);
        updateInventoryAreaByType();
    }

    if (invForm) invForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!canStockAction('inventory', 'insert') && !canStockAction('inventory', 'update')) {
            showToast('Ação permitida apenas para Administrador.', true);
            return;
        }
        const editId = document.getElementById('inventoryEditId');
        const nome = document.getElementById('inventoryNome');
        const codigoBarras = document.getElementById('inventoryCodigoBarras');
        const unidade = document.getElementById('inventoryUnidade');
        const unidadeMedida = document.getElementById('inventoryUnidadeMedida');
        const fatorConversao = document.getElementById('inventoryFatorConversao');
        const tipoInventario = document.getElementById('inventoryTipoInventario');
        const areaInput = document.getElementById('inventoryArea');
        const minimo = document.getElementById('inventoryMinimo');
        const atual = document.getElementById('inventoryAtual');
        const ehConsumivel = document.getElementById('inventoryEhConsumivel');
        const id = String(editId && editId.value || '').trim();
        const nomeFinal = normalizeInventoryName(nome && nome.value || '');
        const codigoFinal = normalizeBarcode(codigoBarras && codigoBarras.value || '');
        const sameName = (inventoryItems || []).find(i =>
            String(i && i.id || '') !== id &&
            normalizeKey(normalizeInventoryName(i && i.nome || '')) === normalizeKey(nomeFinal)
        );
        if (sameName) {
            showToast('Já existe um item com este nome para esta empresa.', true);
            return;
        }
        const sameBarcode = codigoFinal ? (inventoryItems || []).find(i =>
            String(i && i.id || '') !== id &&
            normalizeBarcode(i && i.codigo_barras || '') === codigoFinal
        ) : null;
        if (!id && sameBarcode) {
            const qtdEntrada = toDec(atual && atual.value, 0);
            const okEntrada = confirm('Este item já existe. Deseja realizar uma Entrada de Estoque para aumentar o saldo atual?');
            if (!okEntrada) return;
            if (qtdEntrada <= 0) {
                showToast('Informe um saldo maior que zero para entrada.', true);
                return;
            }
            const novoSaldo = toDec(sameBarcode && sameBarcode.estoque_atual, 0) + qtdEntrada;
            const upd = await saveInventoryRowWithFallback({ id: String(sameBarcode.id), payload: { estoque_atual: novoSaldo } });
            if (upd.error) {
                showToast(upd.error.message || 'Falha ao lançar entrada de estoque.', true);
                return;
            }
            await db.from('inventory_logs').insert({
                empresa_id: getEstoqueEmpresaScopeId(),
                inventory_id: String(sameBarcode.id || ''),
                atendimento_id: null,
                tipo: 'ENTRADA',
                quantidade: qtdEntrada,
                responsavel_id: currentUser && currentUser.id ? currentUser.id : null
            });
            if (inventoryModal) inventoryModal.classList.add('hidden');
            await loadEstoqueData(true);
            renderInventoryTable();
            showToast('Entrada de estoque realizada com sucesso.');
            return;
        }
        if (id && sameBarcode) {
            showToast('Código de barras já cadastrado para outro item.', true);
            return;
        }
        const compra = normalizeUnitCode(unidade && unidade.value || '');
        const consumo = normalizeUnitCode(unidadeMedida && unidadeMedida.value || '');
        if (!compra || !consumo) {
            showToast('Selecione Unidade de Compra e Unidade de Consumo.', true);
            return;
        }
        if (!isAllowedUnitCode(compra) || !isAllowedUnitCode(consumo)) {
            showToast('Unidade inválida. Use apenas as unidades padronizadas.', true);
            return;
        }
        const groupA = getUnitGroup(compra);
        const groupB = getUnitGroup(consumo);
        if (!groupA || !groupB || groupA !== groupB) {
            showToast('Unidades incompatíveis', true);
            return;
        }
        const differs = compra !== consumo;
        const fator = differs ? Math.trunc(toDec(fatorConversao && fatorConversao.value, 0)) : 1;
        if (differs && fator <= 0) {
            showToast('Fator de conversão obrigatório quando as unidades forem diferentes.', true);
            if (fatorConversao) fatorConversao.focus();
            return;
        }
        const payload = {
            empresa_id: getEstoqueEmpresaScopeId(),
            nome: nomeFinal,
            codigo_barras: codigoFinal || null,
            unidade: compra,
            unidade_medida: consumo,
            categoria: normalizeInventoryArea(areaInput && areaInput.value || '') || 'Dentística',
            area: normalizeInventoryArea(areaInput && areaInput.value || '') || 'Dentística',
            estoque_minimo: toDec(minimo && minimo.value, 0),
            estoque_atual: toDec(atual && atual.value, 0),
            eh_consumivel: ehConsumivel ? !!ehConsumivel.checked : true,
            fator_conversao: fator
        };
        const tipoInventarioKey = normalizeInventoryTypeKey(tipoInventario && tipoInventario.value || '');
        if (!tipoInventarioKey) {
            showToast('Selecione o Tipo de Inventário.', true);
            return;
        }
        payload.tipo_inventario = tipoInventarioKey;
        if (!payload.nome) {
            showToast('Informe o nome do material.', true);
            return;
        }
        let error = null;
        if (id) {
            ({ error } = await saveInventoryRowWithFallback({ id, payload }));
        } else {
            ({ error } = await saveInventoryRowWithFallback({ payload }));
        }
        if (error) {
            showToast(error.message || 'Falha ao salvar material.', true);
            return;
        }
        if (inventoryModal) inventoryModal.classList.add('hidden');
        await loadEstoqueData(true);
        renderInventoryTable();
        renderModelItemsEditor();
        showToast('Material salvo com sucesso.');
    });

    if (usageForm) usageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!canModelInsert) {
            showToast('Ação permitida apenas para Administrador.', true);
            return;
        }
        const input = document.getElementById('usageModelNome');
        const includeBiossegInput = document.getElementById('usageModelIncludeBiosseg');
        const nome = String(input && input.value || '').trim();
        if (!nome) return;
        if (!isFamilyKitModelName(nome)) {
            showToast('Crie apenas Famílias de Kits (ex: "Kit Radiologia", "Kit Diagnóstico").', true);
            return;
        }
        const includeBiosseg = includeBiossegInput ? !!includeBiossegInput.checked : true;
        if (includeBiosseg) {
            const biossegId = await ensureBiossegKitExists({ silent: false });
            if (!biossegId) {
                showToast('Kit Biossegurança não encontrado. Verifique se há itens de biossegurança cadastrados.', true);
                return;
            }
        }
        let ins = await db.from('usage_models').insert({ empresa_id: getEstoqueEmpresaScopeId(), nome_modelo: nome, include_biosseguranca: includeBiosseg });
        if (ins && ins.error && isIncludeBiossegSchemaError(ins.error)) {
            ins = await db.from('usage_models').insert({ empresa_id: getEstoqueEmpresaScopeId(), nome_modelo: nome });
        }
        if (ins && ins.error) {
            showToast(ins.error.message || 'Falha ao criar modelo.', true);
            return;
        }
        if (input) input.value = '';
        if (includeBiossegInput) includeBiossegInput.checked = true;
        await loadEstoqueData(true);
        const created = (usageModels || []).find(m => String(m && m.nome_modelo || '') === nome);
        if (created) {
            estoqueActiveModelId = String(created.id || '');
            await purgeBiossegItemsFromModel(String(created.id || ''));
        }
        renderUsageModelsTable();
        renderModelItemsEditor();
        renderServiceMappingTable();
        showToast('Modelo criado com sucesso.');
    });

    if (modelItemForm) modelItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!canStockAction('models', 'update')) {
            showToast('Ação permitida apenas para Administrador.', true);
            return;
        }
        const modelId = String(estoqueActiveModelId || '');
        const inventoryId = String(document.getElementById('modelItemInventoryId')?.value || '').trim();
        const qtd = toDec(document.getElementById('modelItemQuantidade')?.value, 0);
        if (!modelId || !inventoryId || qtd <= 0) {
            showToast('Selecione material e quantidade válida.', true);
            return;
        }
        const { error } = await db.from('model_items').insert({ model_id: modelId, inventory_id: inventoryId, quantidade_sugerida: qtd });
        if (error) {
            showToast(error.message || 'Falha ao adicionar item ao modelo.', true);
            return;
        }
        await loadEstoqueData(true);
        renderModelItemsEditor();
        showToast('Item adicionado ao modelo.');
    });

    if (usageForm) {
        const usageBtn = usageForm.querySelector('button[type="submit"]');
        if (usageBtn) usageBtn.style.display = canModelInsert ? 'inline-flex' : 'none';
    }
    if (btnRestore) btnRestore.addEventListener('click', async () => {
        const ok = confirm('Restaurar modelos mestres e remapear os serviços automaticamente?');
        if (!ok) return;
        btnRestore.disabled = true;
        try {
            const res = await seedStockMasterData({ silent: false });
            if (res && res.ok) {
                renderUsageModelsTable();
                renderModelItemsEditor();
                renderServiceMappingTable();
                renderInventoryTable();
            }
        } finally {
            btnRestore.disabled = false;
        }
    });
    if (btnPrintInv) btnPrintInv.addEventListener('click', () => {
        const rows = (inventoryItems || []).map(i => {
            const atual = toDec(i && i.estoque_atual, 0);
            const min = toDec(i && i.estoque_minimo, 0);
            const low = atual <= min;
            return `<tr>
                <td>${String(i && i.nome || '—')}</td>
                <td>${String(i && i.unidade || '—')}</td>
                <td class="${low ? 'low' : ''}">${atual.toFixed(2)}</td>
                <td>${min.toFixed(2)}</td>
                <td class="${low ? 'low' : ''}">${low ? 'Abaixo do mínimo' : 'OK'}</td>
            </tr>`;
        }).join('');
        openStockReportPrintWindow('Relatório de Inventário', `<table><thead><tr><th>Material</th><th>Unidade</th><th>Saldo Atual</th><th>Mínimo</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
    });
    if (btnPrintModels) btnPrintModels.addEventListener('click', () => {
        const byModel = new Map();
        (usageModelItems || []).forEach(mi => {
            const mid = String(mi && mi.model_id || '');
            if (!mid) return;
            if (!byModel.has(mid)) byModel.set(mid, []);
            byModel.get(mid).push(mi);
        });
        const models = (usageModels || []).map(m => {
            const items = byModel.get(String(m && m.id || '')) || [];
            const subtotalItens = items.length;
            const subtotalQtd = items.reduce((sum, mi) => sum + toDec(mi && mi.quantidade_sugerida, 1), 0);
            return { model: m, items, subtotalItens, subtotalQtd };
        });
        const totalGeralItens = models.reduce((sum, x) => sum + x.subtotalItens, 0);
        const totalGeralQtd = models.reduce((sum, x) => sum + x.subtotalQtd, 0);
        const masterRows = models.map(x => `
            <tr>
                <td>${String(x && x.model && x.model.nome_modelo || 'Modelo')}</td>
                <td>${x.subtotalItens}</td>
                <td>${x.subtotalQtd.toFixed(2)}</td>
            </tr>
        `).join('');
        const detailBlocks = models.map(x => `
            <h2>Itens do Modelo: ${String(x && x.model && x.model.nome_modelo || 'Modelo')}</h2>
            <table>
                <thead><tr><th>Material</th><th>Qtd Sugerida</th></tr></thead>
                <tbody>
                    ${x.items.length ? x.items.map(mi => `<tr><td>${getInventoryNameById(mi && mi.inventory_id)}</td><td>${toDec(mi && mi.quantidade_sugerida, 1).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="2">Modelo sem itens</td></tr>'}
                    <tr><td><strong>Subtotal (itens)</strong></td><td><strong>${x.subtotalItens}</strong></td></tr>
                </tbody>
            </table>
        `).join('');
        const html = `
            <h2>MODELO (Master)</h2>
            <table>
                <thead><tr><th>Modelo</th><th>Subtotal (itens)</th><th>Subtotal (qtd sugerida)</th></tr></thead>
                <tbody>${masterRows}</tbody>
            </table>
            <h2>Total Geral</h2>
            <table>
                <tbody>
                    <tr><td><strong>Total de Modelos</strong></td><td><strong>${models.length}</strong></td></tr>
                    <tr><td><strong>Total Geral (itens)</strong></td><td><strong>${totalGeralItens}</strong></td></tr>
                    <tr><td><strong>Total Geral (qtd sugerida)</strong></td><td><strong>${totalGeralQtd.toFixed(2)}</strong></td></tr>
                </tbody>
            </table>
            ${detailBlocks}
        `;
        openStockReportPrintWindow('Relatório de Modelos de Uso', html);
    });
}

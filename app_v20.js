// --- UTILITIES & MASCARAS ---
function maskCPF(value) {
    value = value.replace(/\D/g, "");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return value;
}

function maskPhone(value) {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d{4})(\d)/, "$1-$2");
    return value;
}

function maskCellphone(value) {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d{1})(\d{4})(\d)/, "$1 $2-$3");
    return value;
}

function maskCEP(value) {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{5})(\d)/, "$1-$2");
    return value;
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

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const APP_BUILD = '20260317-1045';

document.title = `${document.title.split(' [build ')[0]} [build ${APP_BUILD}]`;

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    window.__dpDebug = window.__dpDebug || { pending: 0, lastUrl: null, lastError: null, lastStep: null, lastDataLen: null, lastRenderRows: null, lastRenderInputLen: null, lastFirstRow: null, startedAt: Date.now(), enabled: false };
    if (window.__dpDebug.enabled) {
        window.__dpDebug.pending += 1;
        window.__dpDebug.lastUrl = String(url || '');
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const mergedOptions = { ...options, signal: controller.signal };
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

const db = window.supabase.createClient(supabaseUrl, supabaseKey, {
    global: {
        fetch: (url, options) => fetchWithTimeout(url, options, 15000)
    }
});

setInterval(() => {
    const el = document.getElementById('buildBadge');
    if (!el) return;
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

let currentUser = null;
let currentEmpresaId = null;
let currentUserRole = null; // Store user role globally
let currentUserPerms = {}; // Granular permissions
let isSuperAdmin = false; // System owner flag

// MASTER CONFIG: Change this email to transfer SuperAdmin ownership
const SUPER_ADMIN_EMAIL = 'lhbr@lhbr.com.br';

let patients = [];
let professionals = [];
let specialties = [];
let services = [];
let budgets = [];
let proteseOrders = [];
let proteseLabs = [];
let activeEmpresasList = []; // Store companies list for admins
let transactions = []; // Global transactions state
let financeAllTransactions = [];
let financeSelectedPatientId = null;


async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return false;

    currentUser = session.user;
    isSuperAdmin = (currentUser.email === SUPER_ADMIN_EMAIL);

    const { data: mappings, error } = await db.from('usuario_empresas')
        .select('*, empresas(nome)')
        .eq('usuario_id', currentUser.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Database error in checkAuth mapping search:", error);
        showToast(`Falha ao acessar a tabela de permissões (usuario_empresas). Isso geralmente é bloqueio de RLS/policy. Código: ${error.code || '-'} / ${error.message || 'Erro desconhecido'}`, true);
        await db.auth.signOut();
        return false;
    }

    const savedEmpId = isSuperAdmin ? localStorage.getItem('lastEmpresaId') : null;
    let mapping = null;
    if (mappings && mappings.length > 0) {
        if (isSuperAdmin && savedEmpId && mappings.some(m => m.empresa_id === savedEmpId)) {
            mapping = mappings.find(m => m.empresa_id === savedEmpId) || mappings[0];
        } else {
            if (mappings.length === 1) {
                mapping = mappings[0];
            } else {
                const adminMappings = mappings.filter(m => m.perfil === 'admin');
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

    if (!mapping || !mapping.empresa_id) {
        if (isSuperAdmin) {
            currentEmpresaId = savedEmpId || 'emp_padrao';
            currentUserRole = 'admin';
            currentUserPerms = {};
            console.log("DEBUG: SuperAdmin Logged in via fallback (no valid mapping found)");
        } else {
            console.warn("User record not found or invalid in clinician mapping (usuario_empresas). User ID:", currentUser.id, "Email:", currentUser.email);
            showToast("Seu usuário não está vinculado corretamente a uma empresa (usuario_empresas). Contate o administrador.", true);
            await db.auth.signOut();
            return false;
        }
    } else {
        currentEmpresaId = (isSuperAdmin && savedEmpId && mappings && mappings.some(m => m.empresa_id === savedEmpId)) ? savedEmpId : mapping.empresa_id;
        currentUserRole = mapping.perfil;
        currentUserPerms = (typeof mapping.permissoes === 'string') ? JSON.parse(mapping.permissoes) : (mapping.permissoes || {});
    }

    console.log("DEBUG Auth Info:", { currentEmpresaId, currentUserRole, currentUserPerms, isSuperAdmin });

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
    if (currentUserRole === 'admin') {
        const navConfigSection = document.getElementById('navConfigSection');
        const navEmpresas = document.getElementById('navEmpresas');
        const navUsersAdmin = document.getElementById('navUsersAdmin');

        if (navConfigSection) navConfigSection.style.display = 'block';

        if (navEmpresas) {
            navEmpresas.style.display = isSuperAdmin ? 'flex' : 'none';
        }

        if (navUsersAdmin) navUsersAdmin.style.display = 'flex';
    }

    updateSidebarVisibility();
    return true;
}

// Global Context Switcher
async function switchCompany(newEmpId) {
    console.log("DEBUG: Switching company context to:", newEmpId);
    if (!newEmpId) {
        showToast("Unidade inválida.", true);
        return;
    }
    showToast("Alterando unidade...");

    currentEmpresaId = newEmpId;
    localStorage.setItem('lastEmpresaId', newEmpId);

    const uiRole = document.getElementById('userRoleDisplay');
    if (uiRole) uiRole.textContent = `Unidade: ${newEmpId} (${currentUserRole || 'user'})`;
    updateHeaderCompanyBox();

    // Clear current state
    patients = [];
    professionals = [];
    specialties = [];
    services = [];
    budgets = [];
    proteseOrders = [];
    proteseLabs = [];

    // Reload App Data
    try {
        await initializeApp(true); // Flag to skip re-auth UI logic
        showToast("Unidade alterada com sucesso!");
    } catch (err) {
        console.error("Error switching company:", err);
        showToast("Erro ao alternar unidade.", true);
    }
}

// Map UI types to permission keys
function getModuleKey(type) {
    const map = {
        'patients': 'pacientes',
        'professionals': 'profissionais',
        'specialties': 'especialidades',
        'services': 'servicos',
        'budgets': 'orcamentos',
        'financeiro': 'financeiro',
        'commissions': 'comissoes',
        'agenda': 'agenda',
        'atendimento': 'atendimento',
        'protese': 'protese',
        'dashboard': 'dashboard'
    };
    return map[type] || type;
}

// Global permission check helper
function can(mod, action) {
    // Admins have total access
    if (currentUserRole === 'admin') return true;

    // If it's a JSON object
    if (currentUserPerms && currentUserPerms[mod] && currentUserPerms[mod][action]) {
        return true;
    }

    // Default: for companies, ONLY SuperAdmin has any access
    if (mod === 'empresas') return isSuperAdmin;

    // Default: if no permissions defined or explicitly false, block
    return false;
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
    return Promise.race([Promise.resolve(promiseLike), timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
}

function isMissingRelationError(err) {
    const code = err && err.code ? String(err.code) : '';
    const msg = err && err.message ? String(err.message) : '';
    return code === '42P01' || /does not exist/i.test(msg) || /relation .* does not exist/i.test(msg);
}

async function countExact(query, label) {
    const { count, error } = await withTimeout(query, 15000, label);
    if (error) {
        if (isMissingRelationError(error)) return 0;
        throw error;
    }
    return Number(count || 0);
}

function formatBlockers(blockers) {
    const parts = (blockers || [])
        .filter(b => b && Number(b.count) > 0)
        .map(b => `${b.label}: ${b.count}`);
    return parts.join(' | ');
}

function normalizeKey(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function normalizeStatusKey(s) {
    return normalizeKey(s).replace(/\s+/g, '');
}

function financeCategoryForReport(row) {
    const tipoKey = normalizeKey(row && row.tipo);
    const catKey = normalizeKey(row && row.categoria);
    if (tipoKey === 'DEBITO' && catKey === 'PAGAMENTO') return 'CONSUMO';
    return String(row && row.categoria || '—');
}

function getBudgetSeqFromFinanceRow(row) {
    const v1 = Number(row && row.referencia_id);
    if (Number.isFinite(v1) && v1 > 0) return v1;
    const v2 = Number(row && row.orcamento_id);
    if (Number.isFinite(v2) && v2 > 0) return v2;
    const m = String(row && row.observacoes || '').match(/Orçamento\s*#\s*(\d{1,9})/i);
    if (m && m[1]) {
        const v3 = Number(m[1]);
        if (Number.isFinite(v3) && v3 > 0) return v3;
    }
    return NaN;
}

async function fetchBudgetPaymentFormasForSeqids(seqids) {
    const out = new Map();
    if (!currentEmpresaId) return out;
    const nums = (seqids || []).map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
    if (!nums.length) return out;

    const formsBySeq = new Map();
    const addForm = (seq, formaRaw) => {
        const label = normalizeFormaPagamento(formaRaw);
        if (normalizeKey(label) === 'NAO INFORMADO') return;
        const k = String(seq);
        if (!formsBySeq.has(k)) formsBySeq.set(k, new Set());
        formsBySeq.get(k).add(label);
    };

    const chunks = [];
    for (let i = 0; i < nums.length; i += 120) chunks.push(nums.slice(i, i + 120));

    for (const chunk of chunks) {
        const inList = `(${chunk.join(',')})`;
        try {
            const q = db.from('financeiro_transacoes')
                .select('referencia_id,orcamento_id,forma_pagamento,data_transacao')
                .eq('empresa_id', currentEmpresaId)
                .eq('tipo', 'CREDITO')
                .eq('categoria', 'PAGAMENTO')
                .or(`referencia_id.in.${inList},orcamento_id.in.${inList}`)
                .order('data_transacao', { ascending: false })
                .limit(10000);
            const { data, error } = await withTimeout(q, 20000, 'financeiro_transacoes:formas_por_orc');
            if (!error) {
                (data || []).forEach(r => {
                    const seq = Number(r && (r.referencia_id || r.orcamento_id));
                    if (!Number.isFinite(seq) || seq <= 0) return;
                    addForm(seq, r && r.forma_pagamento);
                });
            }
        } catch { }

        try {
            const q2 = db.from('orcamento_pagamentos')
                .select('orcamento_id,forma_pagamento,data_pagamento,criado_em,created_at,data,status_pagamento')
                .eq('empresa_id', currentEmpresaId)
                .in('orcamento_id', chunk)
                .neq('status_pagamento', 'Cancelado')
                .limit(10000);
            const { data: d2, error: e2 } = await withTimeout(q2, 20000, 'orcamento_pagamentos:formas_por_orc');
            if (!e2) {
                (d2 || []).forEach(r => {
                    const seq = Number(r && r.orcamento_id);
                    if (!Number.isFinite(seq) || seq <= 0) return;
                    addForm(seq, r && r.forma_pagamento);
                });
            }
        } catch { }
    }

    for (const [k, set] of formsBySeq.entries()) {
        const arr = Array.from(set);
        if (!arr.length) continue;
        out.set(k, arr.length === 1 ? arr[0] : 'Misto');
    }
    return out;
}

function computeBudgetProgressStatusKey(budget) {
    const bStatusKey = normalizeStatusKey(String(budget && budget.status || 'PENDENTE'));
    if (bStatusKey === 'CANCELADO') return 'CANCELADO';

    const itens = (budget && (budget.orcamento_itens || budget.itens)) || [];
    const qtdItens = Array.isArray(itens) ? itens.length : 0;
    if (qtdItens === 0) return bStatusKey || 'PENDENTE';

    const totalFinalizados = itens.filter(it => normalizeStatusKey(String(it && it.status || '')) === 'FINALIZADO').length;
    const allFinalizados = totalFinalizados === qtdItens;
    if (allFinalizados) return 'EXECUTADO';

    const anyReleasedOrExec = itens.some(it => {
        const k = normalizeStatusKey(String(it && it.status || ''));
        return k === 'LIBERADO' || k === 'EMEXECUCAO' || k === 'FINALIZADO';
    });
    if (anyReleasedOrExec || totalFinalizados > 0) return 'LIBERADO';

    return bStatusKey || 'PENDENTE';
}

function canDeleteFinanceTransactionRow(row) {
    const cat = normalizeKey(row && row.categoria);
    const obs = normalizeKey(row && row.observacoes);
    const refRaw = (row && row.referencia_id === null || row && row.referencia_id === undefined) ? '' : String(row.referencia_id);
    const refNum = Number(refRaw);
    const hasRef = (Number.isFinite(refNum) && refNum > 0) || (!Number.isFinite(refNum) && refRaw);
    const hasOrcamentoId = row && row.orcamento_id !== null && row.orcamento_id !== undefined && Number(row.orcamento_id) > 0;
    const hasPacienteDestino = row && row.paciente_destino_id !== null && row.paciente_destino_id !== undefined;

    if (cat === 'PAGAMENTO' || cat === 'TRANSFERENCIA' || cat === 'ESTORNO' || cat === 'REEMBOLSO') return false;
    if (hasPacienteDestino) return false;
    if (hasOrcamentoId) return false;
    if (hasRef) return false;
    if (obs.includes('ORCAMENTO') || obs.includes('CONSUMO')) return false;
    return true;
}

function isMissingEmbeddedRelationshipError(err) {
    const code = err && err.code ? String(err.code) : '';
    const msg = err && err.message ? String(err.message) : '';
    return code === 'PGRST200' || /Could not find a relationship/i.test(msg) || /relationship/i.test(msg) && /orcamento_itens/i.test(msg);
}

const _loadTimers = {};
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

async function initializeApp(isContextSwitch = false) {
    try {
        if (!isContextSwitch) {
            const isAuth = await checkAuth();
            if (!isAuth) {
                document.getElementById('loginView').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
                return;
            }

            document.getElementById('loginView').style.display = 'none';
            document.getElementById('appContainer').style.display = 'flex';
        }
        if (!currentEmpresaId && isContextSwitch) {
            const isAuth = await checkAuth();
            if (!isAuth) {
                document.getElementById('loginView').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
                return;
            }
        }
        if (!currentEmpresaId) {
            document.getElementById('loginView').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
            await db.auth.signOut();
            return;
        }

        const reqs = [
            { key: 'pacientes', required: true, timeoutMs: 15000, promise: db.from('pacientes').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }) },
            { key: 'profissionais', required: true, timeoutMs: 25000, promise: db.from('profissionais').select('id, seqid, nome, celular, email, tipo, status, especialidadeid, empresa_id, photo').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }) },
            { key: 'especialidades', required: true, timeoutMs: 15000, promise: db.from('especialidades').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }) },
            { key: 'especialidade_subdivisoes', required: true, timeoutMs: 15000, promise: db.from('especialidade_subdivisoes').select('*').eq('empresa_id', currentEmpresaId) },
            { key: 'servicos', required: true, timeoutMs: 15000, promise: db.from('servicos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }) },
            { key: 'orcamentos', required: true, timeoutMs: 20000, promise: db.from('orcamentos').select('*, orcamento_itens(*)').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }) },
            { key: 'orcamento_pagamentos', required: false, timeoutMs: 15000, promise: db.from('orcamento_pagamentos').select('*').eq('empresa_id', currentEmpresaId) },
            { key: 'empresas', required: false, timeoutMs: 15000, promise: db.from('empresas').select('*').order('nome') }
        ];

        const results = await Promise.all(reqs.map(r => withTimeout(r.promise, r.timeoutMs || 15000, `init:${r.key}`)));
        const byKey = {};
        reqs.forEach((r, idx) => { byKey[r.key] = results[idx]; });

        if (byKey.orcamentos && byKey.orcamentos.error && isMissingEmbeddedRelationshipError(byKey.orcamentos.error)) {
            const fallbackBud = await withTimeout(
                db.from('orcamentos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
                15000,
                'init:orcamentos_fallback'
            );
            if (fallbackBud.error) {
                const e = fallbackBud.error;
                try { e.__initKey = 'orcamentos'; } catch { }
                throw e;
            }

            const itensRes = await withTimeout(
                db.from('orcamento_itens').select('*').eq('empresa_id', currentEmpresaId),
                15000,
                'init:orcamento_itens'
            );
            const itens = (itensRes && !itensRes.error) ? (itensRes.data || []) : [];
            const byBudgetId = new Map();
            itens.forEach(it => {
                const k = String(it.orcamento_id || '');
                if (!k) return;
                if (!byBudgetId.has(k)) byBudgetId.set(k, []);
                byBudgetId.get(k).push(it);
            });
            (fallbackBud.data || []).forEach(b => {
                b.orcamento_itens = byBudgetId.get(String(b.id || '')) || [];
            });
            byKey.orcamentos = fallbackBud;
        }

        for (const r of reqs) {
            const res = byKey[r.key];
            if (res && res.error) {
                if (r.required) {
                    const e = res.error;
                    try { e.__initKey = r.key; } catch { }
                    throw e;
                } else {
                    console.warn(`WARN init:${r.key}:`, res.error);
                }
            }
        }

        const patientsRes = byKey.pacientes;
        const professionalsRes = byKey.profissionais;
        const specialtiesRes = byKey.especialidades;
        const subdivisionsRes = byKey.especialidade_subdivisoes;
        const servicesRes = byKey.servicos;
        const budgetsRes = byKey.orcamentos;
        const paymentsRes = byKey.orcamento_pagamentos;
        const empresasRes = byKey.empresas;

        patients = patientsRes.data || [];
        professionals = professionalsRes.data || [];
        activeEmpresasList = (empresasRes && !empresasRes.error) ? (empresasRes.data || []) : [];
        updateHeaderCompanyBox();

        // De-duplicate specialties and map subdivisions
        const rawSpecialties = specialtiesRes.data || [];
        const seenIds = new Set();
        const seenNames = new Set();
        specialties = rawSpecialties
            .slice()
            .sort((a, b) => {
                const sa = Number.isFinite(Number(a.seqid)) ? Number(a.seqid) : Number.MAX_SAFE_INTEGER;
                const sb = Number.isFinite(Number(b.seqid)) ? Number(b.seqid) : Number.MAX_SAFE_INTEGER;
                if (sa !== sb) return sa - sb;
                return String(a.id || '').localeCompare(String(b.id || ''), 'pt-BR');
            })
            .filter(s => {
                if (seenIds.has(s.id)) return false;
                seenIds.add(s.id);
                const nk = String(s.nome || '').trim().toUpperCase();
                if (!nk) return true;
                if (seenNames.has(nk)) return false;
                seenNames.add(nk);
                return true;
            });

        const subdivisions = subdivisionsRes.data || [];
        specialties.forEach(spec => {
            spec.subdivisoes = subdivisions.filter(sub => sub.especialidade_id === spec.id);
        });

        services = servicesRes.data || [];
        budgets = budgetsRes.data || [];

        let allPayments = [];
        if (paymentsRes.error) {
            console.warn("Table 'orcamento_pagamentos' not found. Financial features disabled until SQL is applied.");
        } else {
            allPayments = paymentsRes.data || [];
        }

        // Attach payments to budgets
        budgets.forEach(b => {
            const bSeq = Number(b.seqid);
            const bId = String(b.id || '');
            const bPayments = allPayments.filter(p => {
                const pOrc = p ? p.orcamento_id : null;
                const pNum = Number(pOrc);
                if (Number.isFinite(bSeq) && Number.isFinite(pNum) && pNum === bSeq) return true;
                if (bId && String(pOrc || '') === bId) return true;
                return false;
            });
            b.pagamentos = bPayments;
            b.total_pago = bPayments.reduce((acc, curr) => acc + (parseFloat(curr.valor_pago) || 0), 0);
        });

        await attachFinanceExtraPaymentsToBudgets(budgets, allPayments);

        console.log("DEBUG Fetched Data Lengths:", {
            patients: patients.length,
            professionals: professionals.length,
            specialties: specialties.length,
            subdivisions: subdivisions.length,
            services: services.length,
            budgets: budgets.length,
            payments: allPayments.length
        });

        // Pre-fill default specialties if empty for this company (guarded to avoid duplicate seeding)
        window.__seededDefaultSpecialties = window.__seededDefaultSpecialties || {};
        if (specialties.length === 0 && currentEmpresaId && !window.__seededDefaultSpecialties[currentEmpresaId]) {
            const { count: specCount, error: specCountErr } = await db
                .from('especialidades')
                .select('id', { count: 'exact', head: true })
                .eq('empresa_id', currentEmpresaId);
            if (specCountErr) throw specCountErr;
            if (Number(specCount || 0) > 0) {
                window.__seededDefaultSpecialties[currentEmpresaId] = true;
            }
        }
        if (specialties.length === 0 && currentEmpresaId && !window.__seededDefaultSpecialties[currentEmpresaId]) {
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
            window.__seededDefaultSpecialties[currentEmpresaId] = true;
        }

        // Render initial view
        updateSidebarVisibility();
        setActiveTab(getDefaultHomeTab());
        if (!isContextSwitch) {
            setupNavigationListeners();
        }

    } catch (error) {
        console.error("Error initializing app data from Supabase:", error);
        const key = error && error.__initKey ? String(error.__initKey) : '';
        const code = error && error.code ? String(error.code) : '-';
        const msg = error && error.message ? String(error.message) : 'Erro desconhecido';
        showToast(`Erro ao carregar dados (${key || 'geral'} - ${code}): ${msg}`, true);
        throw error; // Rethrow to propagate to loginForm listener so it can reset UI
    }
}

function getNextSeqId(collection) {
    if (!collection || collection.length === 0) return 1;
    let maxId = 0;
    collection.forEach(i => { if (i.seqid && i.seqid > maxId) maxId = i.seqid; });
    return maxId + 1;
}

// Call initialization
document.addEventListener('DOMContentLoaded', initializeApp);

// Navigation Elements (Moved to setupNavigationListeners for attachment)
const sidebar = document.querySelector('.sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navDashboard = document.getElementById('navDashboard');
const navPatients = document.getElementById('navPatients');
const navProfessionals = document.getElementById('navProfessionals');
const navSpecialties = document.getElementById('navSpecialties');
const navServices = document.getElementById('navServices');
const navBudgets = document.getElementById('navBudgets');
const navFinanceiro = document.getElementById('navFinanceiro');
const navCommissions = document.getElementById('navCommissions');
const navAtendimento = document.getElementById('navAtendimento');
const navAgenda = document.getElementById('navAgenda');
const navProtese = document.getElementById('navProtese');
const navEmpresas = document.getElementById('navEmpresas');
const navUsersAdminBtn = document.getElementById('navUsersAdmin');

// View Elements
const patientListView = document.getElementById('patientListView');
const patientFormView = document.getElementById('patientFormView');
const professionalListView = document.getElementById('professionalListView');
const professionalFormView = document.getElementById('professionalFormView');
const specialtiesListView = document.getElementById('specialtiesListView');
const specialtyFormView = document.getElementById('specialtyFormView');
const servicesListView = document.getElementById('servicesListView');
const serviceFormView = document.getElementById('serviceFormView');
const budgetsListView = document.getElementById('budgetsListView');
const budgetFormView = document.getElementById('budgetFormView');
const usersAdminView = document.getElementById('usersAdminView');
const userAdminFormView = document.getElementById('userAdminFormView');
const empresasListView = document.getElementById('empresasListView');
const empresaFormView = document.getElementById('empresaFormView');
const financeiroView = document.getElementById('financeiroView');
const commissionsView = document.getElementById('commissionsView');
const dashboardView = document.getElementById('dashboardView');
const atendimentoView = document.getElementById('atendimentoView');
const agendaView = document.getElementById('agendaView');
const proteseView = document.getElementById('proteseView');
const btnAddNewEmpresa = document.getElementById('btnAddNewEmpresa');
const btnBackEmpresa = document.getElementById('btnBackEmpresa');
const btnCancelEmpresa = document.getElementById('btnCancelEmpresa');
const empresaForm = document.getElementById('empresaForm');
const empresaLogoFile = document.getElementById('empresaLogoFile');
const empresaLogoBase64 = document.getElementById('empresaLogoBase64');
const logoPreviewContainer = document.getElementById('logoPreviewContainer');

const systemModules = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pacientes', label: 'Pacientes' },
    { id: 'profissionais', label: 'Profissionais' },
    { id: 'especialidades', label: 'Especialidades' },
    { id: 'servicos', label: 'Serviços/Estoque' },
    { id: 'orcamentos', label: 'Orçamentos' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'comissoes', label: 'Comissões' },
    { id: 'atendimento', label: 'Atendimento' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'protese', label: 'Produção Protética' }
];

function renderPermissionsGrid(existingPerms = null) {
    const tbody = document.getElementById('permissionsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    systemModules.forEach(mod => {
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
const btnAddNewPatient = document.getElementById('btnAddNew');
const btnBackPatient = document.getElementById('btnBack');
const btnCancelPatient = document.getElementById('btnCancelPatient');
const patientForm = document.getElementById('patientForm');
const patientsTableBody = document.getElementById('patientsTableBody');
const patientEmptyState = document.getElementById('patientEmptyState');
const formTitle = document.getElementById('formTitle');

// Professional DOM Elements
const btnAddNewProfessional = document.getElementById('btnAddNewProfessional');
const btnBackProfessional = document.getElementById('btnBackProfessional');
const btnCancelProfessional = document.getElementById('btnCancelProfessional');
const professionalForm = document.getElementById('professionalForm');
const professionalsTableBody = document.getElementById('professionalsTableBody');
const professionalEmptyState = document.getElementById('professionalEmptyState');
const searchProfessionalInput = document.getElementById('searchProfessionalInput');
const professionalFormTitle = document.getElementById('professionalFormTitle');
const profTipoSelect = document.getElementById('profTipo');
const comissionCard = document.getElementById('comissionCard');
const comissionCE = document.getElementById('comissionCE');
const comissionCC = document.getElementById('comissionCC');
const comissionCP = document.getElementById('comissionCP');
const comissionEP = document.getElementById('comissionEP');
const comissionImp = document.getElementById('comissionImp');

const agendaCard = document.getElementById('agendaCard');
const agendaFields = Array.from({ length: 7 }).map((_, i) => {
    const day = i + 1;
    return {
        day,
        enabled: document.getElementById(`agendaDay${day}Enabled`),
        start: document.getElementById(`agendaDay${day}Start`),
        end: document.getElementById(`agendaDay${day}End`),
        slot: document.getElementById(`agendaDay${day}Slot`)
    };
});

// Specialty DOM Elements
const btnNewSpecialty = document.getElementById('btnNewSpecialty');
const btnBackSpecialty = document.getElementById('btnBackSpecialty');
const btnCancelSpecialty = document.getElementById('btnCancelSpecialty');
const specialtyForm = document.getElementById('specialtyForm');
const specialtiesTableBody = document.getElementById('specialtiesTableBody');
const specialtyEmptyState = document.getElementById('specialtyEmptyState');
const specialtyFormTitle = document.getElementById('specialtyFormTitle');

// Services DOM Elements
const btnNewService = document.getElementById('btnNewService');
const btnBackService = document.getElementById('btnBackService');
const btnCancelService = document.getElementById('btnCancelService');
const serviceForm = document.getElementById('serviceForm');
const servicesTableBody = document.getElementById('servicesTableBody');
const searchServiceInput = document.getElementById('searchServiceInput');

// Budgets DOM Elements
const btnNewBudget = document.getElementById('btnNewBudget');
const btnBackBudget = document.getElementById('btnBackBudget');
const btnCancelBudget = document.getElementById('btnCancelBudget');
const budgetForm = document.getElementById('budgetForm');
const budgetsTableBody = document.getElementById('budgetsTableBody');
const searchBudgetInput = document.getElementById('searchBudgetInput');
const budgetStatusFilter = document.getElementById('budgetStatusFilter');
const btnToggleAddItem = document.getElementById('btnToggleAddItem');
const addBudgetItemPanel = document.getElementById('addBudgetItemPanel');
const btnCancelAddItem = document.getElementById('btnCancelAddItem');
const btnSaveAddItem = document.getElementById('btnSaveAddItem');
const budgetItemsTableBody = document.getElementById('budgetItemsTableBody');
const budgetItemsEmptyState = document.getElementById('budgetItemsEmptyState');

// Users Admin DOM Elements
const btnAddNewUser = document.getElementById('btnAddNewUser');
const btnBackUserAdmin = document.getElementById('btnBackUserAdmin');
const btnCancelUserAdmin = document.getElementById('btnCancelUserAdmin');
const userAdminForm = document.getElementById('userAdminForm');
const usersAdminTableBody = document.getElementById('usersAdminTableBody');
const usersAdminEmptyState = document.getElementById('usersAdminEmptyState');
const userAdminFormTitle = document.getElementById('userAdminFormTitle');

// Financeiro DOM Elements
const finTransacoesTable = document.getElementById('finTransacoesTable');
const finTransacoesBody = document.getElementById('finTransacoesBody');
const finPainelSaldo = document.getElementById('finPainelSaldo');
const finNomePaciente = document.getElementById('finNomePaciente');
const finSaldoPaciente = document.getElementById('finSaldoPaciente');
const btnNovaTransacao = document.getElementById('btnNovaTransacao');
const modalNovaTransacao = document.getElementById('modalNovaTransacao');
const btnSalvarTransacao = document.getElementById('btnSalvarTransacao');
const btnCancelarTransacao = document.getElementById('btnCancelarTransacao');
const formNovaTransacao = document.getElementById('formNovaTransacao');
const transacaoPaciente = document.getElementById('transacaoPaciente');
const transacaoCategoria = document.getElementById('transacaoCategoria');
const grpPacienteDestino = document.getElementById('grpPacienteDestino');
const transacaoPacienteDestino = document.getElementById('transacaoPacienteDestino');
const btnFinBuscar = document.getElementById('btnFinBuscar');
const finPacienteSearch = document.getElementById('finPacienteSearch');
const btnFinVerTodos = document.getElementById('btnFinVerTodos');
const btnMovDiaria = document.getElementById('btnMovDiaria');
const btnFechamentoDiarioFull = document.getElementById('btnFechamentoDiarioFull');
const movDiariaModal = document.getElementById('movDiariaModal');
const btnCloseMovDiariaModal = document.getElementById('btnCloseMovDiariaModal');
const btnCancelMovDiaria = document.getElementById('btnCancelMovDiaria');
const btnGenerateMovDiaria = document.getElementById('btnGenerateMovDiaria');
const movDiariaDate = document.getElementById('movDiariaDate');
const movDiariaProfessional = document.getElementById('movDiariaProfessional');

const fechamentoDiarioFullModal = document.getElementById('fechamentoDiarioFullModal');
const btnCloseFechamentoDiarioFullModal = document.getElementById('btnCloseFechamentoDiarioFullModal');
const btnCancelFechamentoDiarioFull = document.getElementById('btnCancelFechamentoDiarioFull');
const btnGenerateFechamentoDiarioFull = document.getElementById('btnGenerateFechamentoDiarioFull');
const fechamentoDiarioFullDate = document.getElementById('fechamentoDiarioFullDate');
const fechamentoDiarioFullProfessional = document.getElementById('fechamentoDiarioFullProfessional');
const fechamentoDiarioModal = document.getElementById('fechamentoDiarioModal');
const btnCloseFechamentoDiarioModal = document.getElementById('btnCloseFechamentoDiarioModal');
const btnCancelFechamentoDiario = document.getElementById('btnCancelFechamentoDiario');
const btnGenerateFechamentoDiario = document.getElementById('btnGenerateFechamentoDiario');
const fechamentoDiarioDate = document.getElementById('fechamentoDiarioDate');
const fechamentoDiarioProfessional = document.getElementById('fechamentoDiarioProfessional');

// Agenda DOM Elements
const agendaDate = document.getElementById('agendaDate');
const agendaProfessional = document.getElementById('agendaProfessional');
const agendaProfessionalGroup = document.getElementById('agendaProfessionalGroup');
const btnAgendaRefresh = document.getElementById('btnAgendaRefresh');
const btnAgendaNew = document.getElementById('btnAgendaNew');
const btnAgendaPrintDay = document.getElementById('btnAgendaPrintDay');
const btnAgendaPrintWeek = document.getElementById('btnAgendaPrintWeek');
const btnAgendaPrintWeekCompact = document.getElementById('btnAgendaPrintWeekCompact');
const agendaSummary = document.getElementById('agendaSummary');
const agendaSlotsBody = document.getElementById('agendaSlotsBody');
const agendaEmptyState = document.getElementById('agendaEmptyState');
const modalAgenda = document.getElementById('modalAgenda');
const btnCloseModalAgenda = document.getElementById('btnCloseModalAgenda');
const btnAgendaCancel = document.getElementById('btnAgendaCancel');
const btnAgendaDelete = document.getElementById('btnAgendaDelete');
const modalAgendaTitle = document.getElementById('modalAgendaTitle');
const formAgenda = document.getElementById('formAgenda');
const agendaId = document.getElementById('agendaId');
const agendaPaciente = document.getElementById('agendaPaciente');
const agendaTitulo = document.getElementById('agendaTitulo');
const agendaInicio = document.getElementById('agendaInicio');
const agendaFim = document.getElementById('agendaFim');
const agendaStatus = document.getElementById('agendaStatus');
const agendaObs = document.getElementById('agendaObs');

// Próteses DOM Elements
const btnProteseRefresh = document.getElementById('btnProteseRefresh');
const btnProteseNew = document.getElementById('btnProteseNew');
const btnProteseLabs = document.getElementById('btnProteseLabs');
const proteseStatusFilter = document.getElementById('proteseStatusFilter');
const proteseExecucaoFilter = document.getElementById('proteseExecucaoFilter');
const proteseOverdueFilter = document.getElementById('proteseOverdueFilter');
const proteseSearch = document.getElementById('proteseSearch');
const proteseTableBody = document.getElementById('proteseTableBody');
const proteseEmptyState = document.getElementById('proteseEmptyState');
const proteseKpiTotal = document.getElementById('proteseKpiTotal');
const proteseKpiOverdue = document.getElementById('proteseKpiOverdue');
const proteseKpiExterna = document.getElementById('proteseKpiExterna');
const proteseKpiInterna = document.getElementById('proteseKpiInterna');

const modalProtese = document.getElementById('modalProtese');
const btnCloseModalProtese = document.getElementById('btnCloseModalProtese');
const btnProteseCancel = document.getElementById('btnProteseCancel');
const btnProtesePrint = document.getElementById('btnProtesePrint');
const btnProteseSave = document.getElementById('btnProteseSave');
const modalProteseTitle = document.getElementById('modalProteseTitle');
const protesePaciente = document.getElementById('protesePaciente');
const proteseTipoExecucao = document.getElementById('proteseTipoExecucao');
const proteseLabGroup = document.getElementById('proteseLabGroup');
const proteseLaboratorio = document.getElementById('proteseLaboratorio');
const proteseProteticoGroup = document.getElementById('proteseProteticoGroup');
const proteseProtetico = document.getElementById('proteseProtetico');
const protesePrazo = document.getElementById('protesePrazo');
const protesePrioridade = document.getElementById('protesePrioridade');
const proteseNota = document.getElementById('proteseNota');
const proteseTimeline = document.getElementById('proteseTimeline');
const proteseOrcamentoSeqid = document.getElementById('proteseOrcamentoSeqid');
const proteseAnexoFile = document.getElementById('proteseAnexoFile');
const btnProteseAnexoUpload = document.getElementById('btnProteseAnexoUpload');
const proteseAnexosList = document.getElementById('proteseAnexosList');

const btnProteseEventSend = document.getElementById('btnProteseEventSend');
const btnProteseEventReceive = document.getElementById('btnProteseEventReceive');
const btnProteseEventTryIn = document.getElementById('btnProteseEventTryIn');
const btnProteseEventApprove = document.getElementById('btnProteseEventApprove');
const btnProteseEventReprove = document.getElementById('btnProteseEventReprove');
const btnProteseEventClose = document.getElementById('btnProteseEventClose');
const btnProteseCustodia = document.getElementById('btnProteseCustodia');

const proteseCustodiaModal = document.getElementById('proteseCustodiaModal');
const proteseCustodiaBody = document.getElementById('proteseCustodiaBody');
const btnCloseProteseCustodiaModal = document.getElementById('btnCloseProteseCustodiaModal');
const btnCloseProteseCustodiaModal2 = document.getElementById('btnCloseProteseCustodiaModal2');

const modalProteseLabs = document.getElementById('modalProteseLabs');
const btnCloseModalProteseLabs = document.getElementById('btnCloseModalProteseLabs');
const btnProteseLabsClose = document.getElementById('btnProteseLabsClose');
const proteseLabId = document.getElementById('proteseLabId');
const proteseLabNome = document.getElementById('proteseLabNome');
const proteseLabContato = document.getElementById('proteseLabContato');
const proteseLabPrazo = document.getElementById('proteseLabPrazo');
const proteseLabAtivo = document.getElementById('proteseLabAtivo');
const btnProteseLabSave = document.getElementById('btnProteseLabSave');
const proteseLabsBody = document.getElementById('proteseLabsBody');
const proteseLabsEmpty = document.getElementById('proteseLabsEmpty');

// Dashboard DOM Elements
const dashDate = document.getElementById('dashDate');
const dashProfessional = document.getElementById('dashProfessional');
const btnDashRefresh = document.getElementById('btnDashRefresh');
const btnDashPrint = document.getElementById('btnDashPrint');
const kpiAgendados = document.getElementById('kpiAgendados');
const kpiAgendadosSub = document.getElementById('kpiAgendadosSub');
const kpiRecebido = document.getElementById('kpiRecebido');
const kpiRecebidoSub = document.getElementById('kpiRecebidoSub');
const kpiOrcamentosHoje = document.getElementById('kpiOrcamentosHoje');
const kpiOrcamentosHojeSub = document.getElementById('kpiOrcamentosHojeSub');
const kpiPacientesHoje = document.getElementById('kpiPacientesHoje');
const kpiPacientesHojeSub = document.getElementById('kpiPacientesHojeSub');
const dashAgendaSummary = document.getElementById('dashAgendaSummary');
const dashAgendaBody = document.getElementById('dashAgendaBody');
const dashAgendaEmpty = document.getElementById('dashAgendaEmpty');
const dashFinanceCard = document.getElementById('dashFinanceCard');
const dashFinanceSummary = document.getElementById('dashFinanceSummary');
const dashPaymentsChart = document.getElementById('dashPaymentsChart');
const dashPaymentsBody = document.getElementById('dashPaymentsBody');
const dashPaymentsEmpty = document.getElementById('dashPaymentsEmpty');
const kpiCancelamentosHoje = document.getElementById('kpiCancelamentosHoje');
const kpiComissoesAPagar = document.getElementById('kpiComissoesAPagar');
const kpiTicketMedio = document.getElementById('kpiTicketMedio');

// Atendimento DOM Elements
const atendimentoDate = document.getElementById('atendimentoDate');
const atendimentoProfessional = document.getElementById('atendimentoProfessional');
const atendimentoProfessionalGroup = document.getElementById('atendimentoProfessionalGroup');
const btnAtendimentoRefresh = document.getElementById('btnAtendimentoRefresh');
const btnFechamentoDiario = document.getElementById('btnFechamentoDiario');
const atendimentoSummary = document.getElementById('atendimentoSummary');
const atendimentoBody = document.getElementById('atendimentoBody');
const atendimentoEmptyState = document.getElementById('atendimentoEmptyState');

const atendimentoEvolucaoModal = document.getElementById('atendimentoEvolucaoModal');
const btnCloseAtendimentoEvolucao = document.getElementById('btnCloseAtendimentoEvolucao');
const btnCancelAtendimentoEvolucao = document.getElementById('btnCancelAtendimentoEvolucao');
const btnSaveAtendimentoEvolucao = document.getElementById('btnSaveAtendimentoEvolucao');
const atEvoPacienteId = document.getElementById('atEvoPacienteId');
const atEvoProfSeqId = document.getElementById('atEvoProfSeqId');
const atEvoOrcamentoId = document.getElementById('atEvoOrcamentoId');
const atEvoItemId = document.getElementById('atEvoItemId');
const atEvoAgendamentoId = document.getElementById('atEvoAgendamentoId');
const atEvoResumo = document.getElementById('atEvoResumo');
const atEvoTexto = document.getElementById('atEvoTexto');

const helpModal = document.getElementById('helpModal');
const helpModalTitle = document.getElementById('helpModalTitle');
const helpModalBody = document.getElementById('helpModalBody');
const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
const btnCloseHelpModal2 = document.getElementById('btnCloseHelpModal2');

// Commissions DOM Elements
const commissionsTable = document.getElementById('commissionsTable');
const commissionsTableBody = document.getElementById('commissionsTableBody');
const commissionsEmptyState = document.getElementById('commissionsEmptyState');
const commStatus = document.getElementById('commStatus');
const commStart = document.getElementById('commStart');
const commEnd = document.getElementById('commEnd');
const commProfessional = document.getElementById('commProfessional');
const btnCommSearch = document.getElementById('btnCommSearch');
const btnCommPay = document.getElementById('btnCommPay');
const btnCommTransfer = document.getElementById('btnCommTransfer');
const btnCommPrint = document.getElementById('btnCommPrint');
const commSelectAll = document.getElementById('commSelectAll');
const commSelectedTotal = document.getElementById('commSelectedTotal');

// Active State
let currentSpecialtySubdivisions = [];
let editingSubSpecIndex = -1;
let currentBudgetItems = [];
let editingBudgetItemId = null;
let usersAdminList = []; // Cache for user management
let commissionsList = [];
let selectedCommissionIds = new Set();

// Shared Inputs
const inputCpf = document.getElementById('cpf');
const inputCelular = document.getElementById('celular');
const inputTelefone = document.getElementById('telefone');
const inputCep = document.getElementById('cep');
const profCelular = document.getElementById('profCelular');
const profEmailInput = document.getElementById('profEmail');
const emailValidationIndicator = document.getElementById('emailValidationIndicator');
const btnSaveProfessional = document.getElementById('btnSaveProfessional');

// Photo Upload Elements
const professionalPhotoCapture = document.getElementById('professionalPhotoCapture');
const professionalPhotoUpload = document.getElementById('professionalPhotoUpload');
const photoPreview = document.getElementById('photoPreview');
const photoBase64 = document.getElementById('photoBase64');
const btnRemovePhoto = document.getElementById('btnRemovePhoto');

// Sidebar Visibility Controller
function updateSidebarVisibility() {
    console.log("DEBUG: updateSidebarVisibility called. Role:", currentUserRole, "IsSuperAdmin:", isSuperAdmin);

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
        'navAtendimento': 'atendimento',
        'navAgenda': 'agenda',
        'navProtese': 'protese'
    };

    Object.entries(sidebarMapping).forEach(([id, type]) => {
        const el = document.getElementById(id);
        if (el) {
            const hasPerm = can(getModuleKey(type), 'select');
            el.style.display = hasPerm ? 'flex' : 'none';
            console.log(`DEBUG: Sidebar Sync -> ${id} (${type}): ${hasPerm ? 'VISIBLE' : 'HIDDEN'}`);
        }
    });

    // Admin Specific Logic (Double check Config sections)
    const navConfigSection = document.getElementById('navConfigSection');
    const navEmpresas = document.getElementById('navEmpresas');
    const navUsersAdmin = document.getElementById('navUsersAdmin');
    const navCancelledBudgets = document.getElementById('navCancelledBudgets');

    if (currentUserRole === 'admin') {
        if (navConfigSection) navConfigSection.style.display = 'block';
        if (navEmpresas) navEmpresas.style.display = isSuperAdmin ? 'flex' : 'none';
        if (navUsersAdmin) navUsersAdmin.style.display = 'flex';
        if (navCancelledBudgets) navCancelledBudgets.style.display = 'flex';
    } else {
        if (navConfigSection) navConfigSection.style.display = 'none';
        if (navEmpresas) navEmpresas.style.display = 'none';
        if (navUsersAdmin) navUsersAdmin.style.display = 'none';
        if (navCancelledBudgets) navCancelledBudgets.style.display = 'none';
    }
}

function getDefaultHomeTab() {
    const tabOrder = [
        'dashboard',
        'agenda',
        'atendimento',
        'protese',
        'patients',
        'budgets',
        'financeiro',
        'commissions',
        'professionals',
        'specialties',
        'services'
    ];

    for (const tab of tabOrder) {
        if (can(getModuleKey(tab), 'select')) return tab;
    }

    if (currentUserRole === 'admin') return 'patients';
    return 'agenda';
}

function toggleMobileSidebar() {
    const sb = document.getElementById('sidebar') || sidebar;
    if (!sb) return;
    const isNowActive = !sb.classList.contains('active');
    sb.classList.toggle('active');
    if (isNowActive) {
        sb.classList.remove('collapsed');
        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) icon.className = 'ri-menu-fold-line';
        }
    }
}

// Mobile Menu Toggle
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
    mobileMenuBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleMobileSidebar();
    }, { passive: false });
}

// Navigation Logic
function setActiveTab(tab) {
    console.log("setActiveTab called with:", tab);
    window.scrollTo(0, 0);

    // 1. Prepare Navigation Elements safely
    const navElements = [
        navDashboard, navPatients, navProfessionals, navSpecialties, navServices,
        navBudgets, navFinanceiro, navCommissions, navAtendimento, navAgenda, navProtese, navUsersAdminBtn, navEmpresas, document.getElementById('navCancelledBudgets')
    ];

    // 2. Prepare View Elements safely
    const viewMapping = {
        'dashboard': [dashboardView],
        'patients': [patientListView, patientFormView],
        'professionals': [professionalListView, professionalFormView],
        'specialties': [specialtiesListView, specialtyFormView],
        'services': [servicesListView, serviceFormView],
        'budgets': [budgetsListView, budgetFormView],
        'usersAdmin': [usersAdminView, userAdminFormView],
        'empresas': [empresasListView, empresaFormView],
        'financeiro': [financeiroView],
        'commissions': [commissionsView],
        'atendimento': [atendimentoView],
        'agenda': [agendaView],
        'protese': [proteseView],
        'cancelledBudgets': [document.getElementById('cancelledBudgetsView')]
    };

    // Reset All Nav Items
    navElements.forEach(el => {
        if (el) el.classList.remove('active');
    });

    // Hide All Views
    Object.values(viewMapping).forEach(views => {
        views.forEach(v => {
            if (v) v.classList.add('hidden');
        });
    });

    // Handle Specific Detail Views (Ficha de Paciente)
    const patientDetailsView = document.getElementById('patientDetailsView');
    if (patientDetailsView) patientDetailsView.classList.add('hidden');

    // Activate Selected Tab and View
    if (tab === 'dashboard') {
        const navD = document.getElementById('navDashboard');
        if (navD) navD.classList.add('active');
        showList('dashboard');
    } else if (tab === 'patients') {
        if (navPatients) navPatients.classList.add('active');
        showList('patients');
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
        if (navEmpresas) navEmpresas.classList.add('active');
        showList('empresas');
    } else if (tab === 'cancelledBudgets') {
        const navCB = document.getElementById('navCancelledBudgets');
        if (navCB) navCB.classList.add('active');
        showList('cancelledBudgets');
    } else if (tab === 'financeiro') {
        const navFin = document.getElementById('navFinanceiro');
        if (navFin) navFin.classList.add('active');
        showList('financeiro');
    } else if (tab === 'commissions') {
        const navC = document.getElementById('navCommissions');
        if (navC) navC.classList.add('active');
        showList('commissions');
    } else if (tab === 'atendimento') {
        const navAt = document.getElementById('navAtendimento');
        if (navAt) navAt.classList.add('active');
        showList('atendimento');
    } else if (tab === 'agenda') {
        const navA = document.getElementById('navAgenda');
        if (navA) navA.classList.add('active');
        showList('agenda');
    } else if (tab === 'protese') {
        const navP = document.getElementById('navProtese');
        if (navP) navP.classList.add('active');
        showList('protese');
    } else {
        if (navProfessionals) navProfessionals.classList.add('active');
        showList('professionals');
    }

    // Auto-close sidebar on mobile after clicking a link
    if (window.innerWidth <= 900 && sidebar) {
        sidebar.classList.remove('active');
    }
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
        'navAtendimento': 'atendimento',
        'navAgenda': 'agenda',
        'navProtese': 'protese',
        'navUsersAdmin': 'usersAdmin',
        'navEmpresas': 'empresas',
        'navCancelledBudgets': 'cancelledBudgets'
    };

    Object.entries(navMapping).forEach(([id, tab]) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = () => {
                setActiveTab(tab);
            };
        }
    });

    if (mobileMenuBtn) {
        mobileMenuBtn.onclick = () => toggleMobileSidebar();
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

// Init
function renderTable(data = [], type = 'patients') {
    if (type === 'patients') {
        patientsTableBody.innerHTML = '';
        if (data.length === 0) {
            patientsTableBody.parentElement.style.display = 'none';
            patientEmptyState.classList.remove('hidden');
            return;
        }
        patientsTableBody.parentElement.style.display = 'table';
        patientEmptyState.classList.add('hidden');

        data.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.seqid}</td>
                <td><strong>${p.nome}</strong></td>
                <td>${p.cpf}</td>
                <td>${p.celular}</td>
                <td>${p.cidade}/${p.uf}</td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="showPatientDetails('${p.id}')" title="Ver Prontuário / Ficha">
                        <i class="ri-folder-user-line"></i>
                    </button>
                    <button class="btn-icon" onclick="printPatient('${p.id}')" title="Imprimir Ficha">
                        <i class="ri-printer-line"></i>
                    </button>
                    ${can('pacientes', 'update') ? `
                    <button class="btn-icon" onclick="editPatient('${p.id}')" title="Editar">
                        <i class="ri-edit-line"></i>
                    </button>` : ''}
                    ${can('pacientes', 'delete') ? `
                    <button class="btn-icon delete-btn" onclick="deletePatient('${p.id}')" title="Deletar">
                        <i class="ri-delete-bin-line"></i>
                    </button>` : ''}
                </td>
            `;
            patientsTableBody.appendChild(tr);
        });
    } else if (type === 'specialties') {
        if (!specialtiesTableBody) return;
        specialtiesTableBody.innerHTML = '';
        if (data.length === 0) {
            specialtiesTableBody.parentElement.style.display = 'none';
            document.getElementById('specialtyEmptyState').classList.remove('hidden');
            return;
        }
        specialtiesTableBody.parentElement.style.display = 'table';
        document.getElementById('specialtyEmptyState').classList.add('hidden');

        data.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.seqid}</td>
                <td><strong>${s.nome}</strong></td>
                <td>
                    ${s.subdivisoes && s.subdivisoes.length > 0
                    ? `<div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${s.subdivisoes.map((sub, index) => `<span style="background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--text-color);"><strong>${s.seqid}.${index + 1}</strong> - ${sub.nome}</span>`).join('')}
                           </div>`
                    : '<small style="color:var(--text-muted)">Nenhuma</small>'}
                </td>
                <td class="actions-cell">
                    ${can('especialidades', 'update') ? `
                    <button class="btn-icon" onclick="editSpecialty('${s.id}')" title="Editar">
                        <i class="ri-edit-line"></i>
                    </button>` : ''}
                    ${can('especialidades', 'delete') ? `
                    <button class="btn-icon delete-btn" onclick="deleteSpecialty('${s.id}')" title="Deletar">
                        <i class="ri-delete-bin-line"></i>
                    </button>` : ''}
                </td>
            `;
            specialtiesTableBody.appendChild(tr);
        });
    } else if (type === 'services') {
        if (!servicesTableBody) return;
        servicesTableBody.innerHTML = '';
        if (data.length === 0) {
            servicesTableBody.parentElement.style.display = 'none';
            document.getElementById('serviceEmptyState').classList.remove('hidden');
            return;
        }
        servicesTableBody.parentElement.style.display = 'table';
        document.getElementById('serviceEmptyState').classList.add('hidden');

        data.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.seqid}</td>
                <td><strong>${s.descricao}</strong></td>
                <td>R$ ${Number(s.valor).toFixed(2)}</td>
                <td>${s.ie === 'S' ? 'Serviço' : 'Estoque'}</td>
                <td>
                    ${s.subdivisao ? `<span style="background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--text-color);">${s.subdivisao}</span>` : '<small style="color:var(--text-muted)">-</small>'}
                </td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="printService('${s.id}')" title="Imprimir Item">
                        <i class="ri-printer-line"></i>
                    </button>
                    ${can('servicos', 'update') ? `
                    <button class="btn-icon" onclick="editService('${s.id}')" title="Editar">
                        <i class="ri-edit-line"></i>
                    </button>` : ''}
                </td>
            `;
            servicesTableBody.appendChild(tr);
        });
    } else if (type === 'usersAdmin') {
        const usersAdminTableBody = document.getElementById('usersAdminTableBody');
        const usersAdminEmptyState = document.getElementById('usersAdminEmptyState');
        if (!usersAdminTableBody) return;
        usersAdminTableBody.innerHTML = '';
        if (data.length === 0) {
            usersAdminTableBody.parentElement.style.display = 'none';
            if (usersAdminEmptyState) usersAdminEmptyState.classList.remove('hidden');
            return;
        }
        usersAdminTableBody.parentElement.style.display = 'table';
        if (usersAdminEmptyState) usersAdminEmptyState.classList.add('hidden');

        usersAdminList = data; // Cache for editing

        data.forEach(u => {
            const tr = document.createElement('tr');
            const rawUserId = u.usuario_id || u.user_id || '';
            const userId = rawUserId ? String(rawUserId) : 'N/A';
            const userEmail = u.user_email || userId;
            const shortId = userId !== 'N/A' && userId.length > 8 ? userId.substring(0, 8) : userId;
            const userRole = (u.perfil || 'user').toUpperCase();

            tr.innerHTML = `
                <td>
                    <strong>${userEmail}</strong><br>
                    <small style="color:var(--text-muted)">ID: ${shortId}...</small>
                </td>
                <td>
                    <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-weight: bold; color: var(--primary-color);">
                        ${getEmpresaName(u.empresa_id)}
                    </code>
                </td>
                <td><span style="background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--text-color);">${userRole}</span></td>
                <td><strong style="color: var(--success-color)">Ativo</strong></td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="printUser('${userId}')" title="Imprimir Acesso">
                        <i class="ri-printer-line"></i>
                    </button>
                    ${userId !== 'N/A'
                    ? `<button class="btn-icon" onclick="editTenantUser('${userId}')" title="Editar Permissões"><i class="ri-edit-line"></i></button>`
                    : `<button class="btn-icon" style="opacity:0.35; cursor:not-allowed;" title="Sem ID de usuário"><i class="ri-edit-line"></i></button>`}
                    <button class="btn-icon delete-btn" onclick="removeTenantUser('${userId}')" title="Remover Acesso">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            `;
            usersAdminTableBody.appendChild(tr);
        });
    } else if (type === 'cancelled_budgets') {
        const cancelledBudgetsTableBody = document.getElementById('cancelledBudgetsTableBody');
        const cancelledBudgetsEmptyState = document.getElementById('cancelledBudgetsEmptyState');
        if (!cancelledBudgetsTableBody) return;
        cancelledBudgetsTableBody.innerHTML = '';
        if (window.__dpDebug) window.__dpDebug.lastRenderInputLen = Array.isArray(data) ? data.length : null;
        if (data.length === 0) {
            cancelledBudgetsTableBody.parentElement.style.display = 'none';
            if (cancelledBudgetsEmptyState) cancelledBudgetsEmptyState.classList.remove('hidden');
            return;
        }
        cancelledBudgetsTableBody.parentElement.style.display = 'table';
        if (cancelledBudgetsEmptyState) cancelledBudgetsEmptyState.classList.add('hidden');

        data.forEach(log => {
            const tr = document.createElement('tr');
            const dataCancel = log.data_cancelamento ? new Date(log.data_cancelamento).toLocaleString('pt-BR') : '-';
            tr.innerHTML = `
                <td><strong>#${log.orcamento_seqid || 'N/A'}</strong></td>
                <td>${log.paciente_nome || '-'}</td>
                <td>${dataCancel}</td>
                <td style="text-align: right; color: var(--danger-color); font-weight: 600;">R$ ${Number(log.total_pago_na_epoca).toFixed(2)}</td>
                <td title="${log.motivo_cancelamento || ''}">${log.motivo_cancelamento ? (log.motivo_cancelamento.substring(0, 30) + (log.motivo_cancelamento.length > 30 ? '...' : '')) : '-'}</td>
                <td><small>${log.cancelado_por_nome || '-'}</small></td>
                <td style="text-align: center;">
                    <button class="btn-icon" onclick="showCancelDetails('${log.id}')" title="Ver Detalhes Audit">
                        <i class="ri-eye-line"></i>
                    </button>
                </td>
            `;
            cancelledBudgetsTableBody.appendChild(tr);
        });
        if (window.__dpDebug) {
            window.__dpDebug.lastRenderRows = cancelledBudgetsTableBody.children.length;
            window.__dpDebug.lastFirstRow = cancelledBudgetsTableBody.textContent.trim().slice(0, 40);
        }
    } else if (type === 'budgets') {
        if (!budgetsTableBody) return;
        budgetsTableBody.innerHTML = '';
        if (data.length === 0) {
            budgetsTableBody.parentElement.style.display = 'none';
            document.getElementById('budgetEmptyState').classList.remove('hidden');
            return;
        }
        budgetsTableBody.parentElement.style.display = 'table';
        document.getElementById('budgetEmptyState').classList.add('hidden');

        data.forEach(b => {
            const tr = document.createElement('tr');

            // Format total value (b.orcamento_itens is the Supabase relation name)
            const itens = b.orcamento_itens || b.itens || [];
            const total = itens.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
            const qtdItens = itens.length;

            const totalPago = getBudgetPaidAmount(b);
            const saldoDevedor = total - totalPago;

            const totalFinalizados = itens.filter(it => normalizeStatusKey(String(it && it.status || '')) === 'FINALIZADO').length;
            const totalLiberados = itens.filter(it => ['LIBERADO', 'EMEXECUCAO', 'FINALIZADO'].includes(normalizeStatusKey(String(it && it.status || '')))).length;
            const allFinalizados = qtdItens > 0 && totalFinalizados === qtdItens;
            const baseStatus = String(b.status || 'Pendente');
            const statusTop = baseStatus;
            const statusHint = allFinalizados
                ? 'Concluído (itens finalizados)'
                : (totalLiberados > 0 ? 'Em atendimento' : (saldoDevedor > 0 ? 'Aguardando pagamento/liberação' : 'Aguardando liberação'));

            tr.innerHTML = `
                <td>${b.seqid}</td>
                <td>
                    <strong>${b.pacientenome}</strong><br>
                    <small style="color:var(--text-muted)">${b.pacientecelular}</small>
                </td>
                <td>${qtdItens} itens</td>
                <td><strong style="color: var(--primary-color)">R$ ${total.toFixed(2)}</strong></td>
                <td><strong style="color: ${saldoDevedor > 0 ? '#dc3545' : 'var(--success-color)'}">R$ ${totalPago.toFixed(2)}</strong></td>
                <td>
                    <div>
                        <span style="background: ${normalizeKey(statusTop) === 'EXECUTADO' ? '#dcfce7' : 'var(--bg-hover)'}; color: ${normalizeKey(statusTop) === 'EXECUTADO' ? '#166534' : 'var(--text-color)'}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 800;">
                            ${escapeHtml(statusTop)}
                        </span>
                        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted); font-weight: 700;">
                            ${escapeHtml(`${totalFinalizados}/${qtdItens} itens finalizados • ${statusHint}`)}
                        </div>
                    </div>
                </td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="viewBudgetPayments('${b.id}')" title="Ver Pagamentos">
                        <i class="ri-money-dollar-circle-line"></i>
                    </button>
                    <button class="btn-icon" onclick="printBudget('${b.id}')" title="Imprimir Orçamento">
                        <i class="ri-printer-line"></i>
                    </button>
                    ${can('orcamentos', 'update') ? `
                    <button class="btn-icon" onclick="editBudget('${b.id}')" title="Editar">
                        <i class="ri-edit-line"></i>
                    </button>` : ''}
                    ${can('orcamentos', 'delete') ? `
                    <button class="btn-icon delete-btn" onclick="deleteBudget('${b.id}')" title="Deletar">
                        <i class="ri-delete-bin-line"></i>
                    </button>` : ''}
                </td>
            `;
            budgetsTableBody.appendChild(tr);
        });
    } else if (type === 'protese') {
        if (!proteseTableBody) return;
        proteseTableBody.innerHTML = '';
        if (!Array.isArray(data) || data.length === 0) {
            if (proteseTableBody.parentElement) proteseTableBody.parentElement.style.display = 'none';
            if (proteseEmptyState) proteseEmptyState.classList.remove('hidden');
            return;
        }
        if (proteseTableBody.parentElement) proteseTableBody.parentElement.style.display = 'table';
        if (proteseEmptyState) proteseEmptyState.classList.add('hidden');

        data.forEach(o => {
            const tr = document.createElement('tr');
            const pacienteNome = getPatientNameById(o.paciente_id);
            const exec = String(o.tipo_execucao || '');
            const execLabel = exec === 'INTERNA' ? 'Interna' : 'Externa';
            const execName = exec === 'INTERNA' ? getProteticoNameById(o.protetico_id) : getLaboratorioNameById(o.laboratorio_id);
            const prazo = o.prazo_previsto ? String(o.prazo_previsto).slice(0, 10).split('-').reverse().join('/') : '';
            const overdue = isProteseOverdue(o);
            const st = String(o.status_geral || 'EM_ANDAMENTO');
            const stBg = st === 'CONCLUIDA' ? '#dcfce7' : (st === 'CANCELADA' ? '#fee2e2' : (st === 'PAUSADA' ? '#fef3c7' : 'var(--bg-hover)'));
            const stColor = st === 'CONCLUIDA' ? '#166534' : (st === 'CANCELADA' ? '#991b1b' : (st === 'PAUSADA' ? '#92400e' : 'var(--text-main)'));
            tr.innerHTML = `
                <td><strong>#${escapeHtml(String(o.seqid || ''))}</strong></td>
                <td>${escapeHtml(String(pacienteNome || '—'))}</td>
                <td>${escapeHtml(formatBudgetDisplay(o.orcamento_id))}</td>
                <td>${escapeHtml(execLabel)}</td>
                <td>${escapeHtml(String(execName || '—'))}</td>
                <td>${escapeHtml(String(o.fase_atual || '—'))}</td>
                <td style="color:${overdue ? 'var(--danger-color)' : 'var(--text-main)'}; font-weight:${overdue ? '800' : '500'};">${escapeHtml(prazo || '—')}</td>
                <td><span style="background:${stBg}; color:${stColor}; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem; font-weight: 800;">${escapeHtml(st)}</span></td>
                <td class="actions-cell">
                    <button class="btn-icon" data-action="open" data-id="${o.id}" title="Abrir"><i class="ri-eye-line"></i></button>
                    <button class="btn-icon" data-action="print" data-id="${o.id}" title="Imprimir"><i class="ri-printer-line"></i></button>
                </td>
            `;
            proteseTableBody.appendChild(tr);
        });

        proteseTableBody.querySelectorAll('button[data-action="open"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                openProteseModal({ orderId: id });
            });
        });
        proteseTableBody.querySelectorAll('button[data-action="print"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await printProteseOrder(id);
            });
        });
    } else if (type === 'financeiro') {
        const body = document.getElementById('finTransacoesBody');
        if (!body) return;
        body.innerHTML = '';
        if (window.__dpDebug) window.__dpDebug.lastRenderInputLen = Array.isArray(data) ? data.length : null;
        if (data.length === 0) {
            body.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Nenhum lançamento encontrado.</td></tr>';
            if (window.__dpDebug) {
                window.__dpDebug.lastRenderRows = body.children.length;
                window.__dpDebug.lastFirstRow = body.textContent.trim().slice(0, 40);
            }
            return;
        }

        data.forEach((t, index) => {
            const tr = document.createElement('tr');
            const valorFormatado = Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const tipoLabel = t.tipo === 'CREDITO' ?
                '<span style="color: var(--success-color); font-weight: 600;">CRÉDITO</span>' :
                '<span style="color: #dc3545; font-weight: 600;">DÉBITO</span>';
            const canDel = canDeleteFinanceTransactionRow(t) && can('financeiro', 'delete');
            const delBtn = canDel
                ? `<button class="btn-icon delete-btn" onclick="deleteTransaction('${t.id}')" title="Excluir Lançamento"><i class="ri-delete-bin-line"></i></button>`
                : `<button class="btn-icon" style="opacity:0.35; cursor:not-allowed;" title="Exclusão bloqueada: lançamento vinculado"><i class="ri-lock-line"></i></button>`;

            tr.innerHTML = `
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${t.seqid || index + 1}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);"><strong>${t.paciente_nome || '—'}</strong></td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${formatDateTime(t.data_transacao)}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${t.categoria}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${t.forma_pagamento || '—'}</td>
                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--border-color);"><strong>${valorFormatado}</strong></td>
                <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid var(--border-color);">${tipoLabel}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.observacoes || ''}">${t.observacoes || '—'}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); text-align: center;">
                    ${delBtn}
                </td>
            `;
            body.appendChild(tr);
        });
        if (window.__dpDebug) {
            window.__dpDebug.lastRenderRows = body.children.length;
            window.__dpDebug.lastFirstRow = body.textContent.trim().slice(0, 40);
        }
    } else {
        professionalsTableBody.innerHTML = '';
        if (data.length === 0) {
            professionalsTableBody.parentElement.style.display = 'none';
            professionalEmptyState.classList.remove('hidden');
            return;
        }
        professionalsTableBody.parentElement.style.display = 'table';
        professionalEmptyState.classList.add('hidden');

        data.forEach(p => {
            const tr = document.createElement('tr');
            const photoEl = p.photo
                ? `< img src = "${p.photo}" class="photo-thumb" alt = "Foto" > `
                : `< div class="photo-thumb" > <i class="ri-user-line"></i></div > `;

            const statusColor = p.status === 'Ativo' ? 'var(--success-color)' : 'var(--text-muted)';

            tr.innerHTML = `
                <td>${p.seqid}</td>
                <td>${photoEl}</td>
                <td>
                    <strong>${p.nome}</strong><br>
                    <small style="color:var(--text-muted)">${p.email}</small>
                </td>
                <td>${p.celular}</td>
                <td>
                    ${p.tipo}
                    ${p.especialidadeid ? `<br><small style="color:var(--primary-color)">${getSpecialtyName(p.especialidadeid)}</small>` : ''}
                </td>
                <td><strong style="color: ${statusColor}">${p.status}</strong></td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="printProfessional('${p.id}')" title="Imprimir Ficha">
                        <i class="ri-printer-line"></i>
                    </button>
                    ${can('profissionais', 'update') ? `
                    <button class="btn-icon" onclick="editProfessional('${p.id}')" title="Editar">
                        <i class="ri-edit-line"></i>
                    </button>` : ''}
                    ${can('profissionais', 'delete') ? `
                    <button class="btn-icon delete-btn" onclick="deleteProfessional('${p.id}')" title="Deletar">
                        <i class="ri-delete-bin-line"></i>
                    </button>` : ''}
                </td>
            `;
            professionalsTableBody.appendChild(tr);
        });
    }
}

function showForm(editMode = false, type = 'patients', dataObj = null) {
    // Always close the patient detail view when switching to a form
    const detailsView = document.getElementById('patientDetailsView');
    if (detailsView) detailsView.classList.add('hidden');

    // Permission check for creating new
    if (!editMode && type !== 'usersAdmin' && !can(getModuleKey(type), 'insert')) {
        showToast("Você não possui permissão para criar novos registros neste módulo.", true);
        return;
    }
    if (type === 'patients') {
        patientListView.classList.add('hidden');
        patientFormView.classList.remove('hidden');
        formTitle.innerText = editMode ? 'Editar Paciente' : 'Novo Paciente';
        inputCpf.classList.remove('input-error');
        document.getElementById('patIdDisplay').value = editMode ? '' : 'Novo';
        document.getElementById('cpfError').style.display = 'none';
    } else if (type === 'specialties') {
        if (specialtiesListView) specialtiesListView.classList.add('hidden');
        if (specialtyFormView) specialtyFormView.classList.remove('hidden');
        document.getElementById('specialtyFormTitle').innerText = editMode ? 'Editar Especialidade' : 'Nova Especialidade';
        document.getElementById('specIdDisplay').value = editMode ? '' : 'Novo';
        if (!editMode) {
            currentSpecialtySubdivisions = [];
            if (typeof renderSubSpecTable === 'function') renderSubSpecTable();
        }
    } else if (type === 'services') {
        if (servicesListView) servicesListView.classList.add('hidden');
        if (serviceFormView) serviceFormView.classList.remove('hidden');
        document.getElementById('serviceFormTitle').innerText = editMode ? 'Editar Item' : 'Novo Serviço/Item';
        document.getElementById('servIdDisplay').value = editMode ? '' : 'Novo';
        if (!editMode) {
            document.getElementById('servTipoIE').value = 'S';
        }

        // Carregar opções do dropdown de subdivisões
        const subSelect = document.getElementById('servSubdivisao');
        if (subSelect) {
            subSelect.innerHTML = '<option value="">Selecione...</option>';
            specialties.forEach(spec => {
                if (spec.subdivisoes && spec.subdivisoes.length > 0) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = `${spec.seqid} - ${spec.nome}`;

                    spec.subdivisoes.forEach((sub, i) => {
                        const subId = `${spec.seqid}.${i + 1}`;
                        const displayStr = `${subId} - ${sub.nome}`;
                        const opt = document.createElement('option');
                        opt.value = displayStr;
                        opt.textContent = displayStr;
                        optgroup.appendChild(opt);
                    });
                    subSelect.appendChild(optgroup);
                }
            });
        }
    } else if (type === 'budgets') {
        if (budgetsListView) budgetsListView.classList.add('hidden');
        if (budgetFormView) budgetFormView.classList.remove('hidden');
        if (document.getElementById('addBudgetItemPanel')) {
            document.getElementById('addBudgetItemPanel').style.display = 'none';
        }
        if (document.getElementById('budgetFormTitle')) {
            document.getElementById('budgetFormTitle').innerText = editMode ? 'Editar Orçamento - V2' : 'Novo Orçamento';
        }
        if (document.getElementById('budIdDisplay')) {
            document.getElementById('budIdDisplay').value = editMode ? '' : 'Novo';
        }

        // Load patients into datalist
        const datalist = document.getElementById('pacientesDataList');
        if (datalist) {
            datalist.innerHTML = '';
            patients.forEach(p => {
                // The value will be the patient's name, but we store the ID in a data attribute
                datalist.innerHTML += `<option data-id="${p.seqid || p.id}" value="${p.nome} (${p.cpf})"></option>`;
            });
        }

        // Load ALL professionals into the Responsible Professional dropdown
        const budProfSelect = document.getElementById('budProfissionalId');
        if (budProfSelect) {
            budProfSelect.innerHTML = '<option value="">Selecione o Profissional...</option>';
            // Load professionals — exclude Proteticos (they appear only in item lines)
            professionals
                .filter(p => (p.tipo || '').toLowerCase() !== 'protetico')
                .forEach(p => {
                    const val = p.seqid || p.id;
                    budProfSelect.innerHTML += `<option value="${val}">${p.seqid || ''} - ${p.nome} (${p.tipo || ''})</option>`;
                });
        }

        if (!editMode) {
            currentBudgetItems = [];
            if (typeof renderBudgetItemsTable === 'function') renderBudgetItemsTable();
            if (document.getElementById('budNomePaciente')) document.getElementById('budNomePaciente').value = '';
            if (document.getElementById('budCelularPaciente')) document.getElementById('budCelularPaciente').value = '';
            if (document.getElementById('budEmailPaciente')) document.getElementById('budEmailPaciente').value = '';
            
            const statusSelect = document.getElementById('budStatus');
            if (statusSelect) {
                statusSelect.innerHTML = `
                    <option value="Pendente">Pendente</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Executado">Executado</option>
                    <option value="Finalizado">Finalizado</option>
                    <option value="Cancelado">Cancelado</option>
                `;
                statusSelect.value = 'Pendente';
            }
            
            if (document.getElementById('budTipo')) document.getElementById('budTipo').value = 'Normal';
            if (document.getElementById('budObservacoes')) document.getElementById('budObservacoes').value = '';
            if (document.getElementById('budProfissionalId')) document.getElementById('budProfissionalId').value = '';
        }

        if (typeof validateBudgetMasterForm === 'function') validateBudgetMasterForm();
    } else if (type === 'usersAdmin') {
        if (usersAdminView) usersAdminView.classList.add('hidden');
        if (userAdminFormView) userAdminFormView.classList.remove('hidden');

        userAdminFormTitle.textContent = editMode ? 'Editar Usuário' : 'Novo Usuário';
        const emailInput = document.getElementById('adminUserEmail');
        const passInput = document.getElementById('adminUserPassword');

        if (!editMode) {
            userAdminForm.reset();
            document.getElementById('editAdminUserId').value = '';
            emailInput.readOnly = false;
            emailInput.classList.remove('readonly-input');
            passInput.required = true;
            const smallText = passInput.parentElement.querySelector('small');
            if (smallText) smallText.textContent = '(Mínimo 6 caracteres)';
            renderPermissionsGrid();
        }

        // Handle Company Selector for SuperAdmin
        const companyContainer = document.getElementById('adminUserCompanyContainer');
        const companySelect = document.getElementById('adminUserCompany');
        if (companyContainer && companySelect) {
            if (isSuperAdmin && !editMode) {
                companyContainer.style.display = 'block';
                companySelect.required = true;
                companySelect.innerHTML = '<option value="">Selecione a Empresa...</option>';
                activeEmpresasList.forEach(emp => {
                    companySelect.innerHTML += `<option value="${emp.id}">${emp.nome}</option>`;
                });
            } else {
                companyContainer.style.display = 'none';
                companySelect.required = false;
            }
        }
    } else if (type === 'empresas') {
        if (empresasListView) empresasListView.classList.add('hidden');
        if (empresaFormView) empresaFormView.classList.remove('hidden');
        document.getElementById('empresaFormTitle').innerText = editMode ? 'Editar Empresa' : 'Nova Empresa';
        document.getElementById('editEmpresaOldId').value = editMode ? dataObj.id : '';

        const idInput = document.getElementById('empresaId');
        const nomeInput = document.getElementById('empresaNome');
        const base64Input = document.getElementById('empresaLogoBase64');
        const logoPreview = document.getElementById('logoPreviewContainer');

        if (editMode && dataObj) {
            idInput.value = dataObj.id;
            nomeInput.value = dataObj.nome;
            document.getElementById('empresaSupervisorPin').value = dataObj.supervisor_pin || '';
            base64Input.value = dataObj.logotipo || '';
            if (dataObj.logotipo) {
                logoPreview.innerHTML = `< img src = "${dataObj.logotipo}" style = "width: 100%; height: 100%; object-fit: cover;" > `;
            } else {
                logoPreview.innerHTML = `< i class="ri-image-line" style = "font-size: 1.5rem; color: var(--text-muted);" ></i > `;
            }
        } else {
            empresaForm.reset();
            document.getElementById('empresaSupervisorPin').value = '';
            base64Input.value = '';
            logoPreview.innerHTML = `< i class="ri-image-line" style = "font-size: 1.5rem; color: var(--text-muted);" ></i > `;
        }
    } else {
        if (professionalListView) professionalListView.classList.add('hidden');
        if (professionalFormView) professionalFormView.classList.remove('hidden');
        if (document.getElementById('professionalFormTitle')) {
            document.getElementById('professionalFormTitle').innerText = editMode ? 'Editar Profissional' : 'Novo Profissional';
        }
        if (document.getElementById('profIdDisplay')) {
            document.getElementById('profIdDisplay').value = editMode ? '' : 'Novo';
        }

        btnSaveProfessional.disabled = false;

        // load specialities into dropdown
        const specSelect = document.getElementById('profEspecialidade');
        if (specSelect) {
            specSelect.innerHTML = '<option value="">Selecione uma especialidade...</option>';
            specialties.forEach(s => {
                specSelect.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
            });
        }

        // reset photo
        if (!editMode) {
            resetPhotoPreview();
            resetAgendaForm();
        }
    }
}

function showList(type = 'patients') {
    console.log("showList called with:", type);

    // Auto-collapse sidebar when a menu item is selected to free up space
    if (sidebar && window.innerWidth > 900 && !sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) icon.className = 'ri-menu-unfold-line';
        }
    }

    // Always close the patient detail view (Ficha/Prontuário) when navigating to any module
    const detailsView = document.getElementById('patientDetailsView');
    if (detailsView) detailsView.classList.add('hidden');

    if (type !== 'usersAdmin' && !can(getModuleKey(type), 'select')) {
        showToast("Você não possui permissão para visualizar este módulo.", true);
        return;
    }
    if (type === 'dashboard') {
        if (dashboardView) dashboardView.classList.remove('hidden');
        initDashboardFilters();
        renderDashboardPlaceholder();
        fetchDashboardFromUI();
    } else if (type === 'patients') {
        patientFormView.classList.add('hidden');
        patientListView.classList.remove('hidden');
        patientForm.reset();
        document.getElementById('editId').value = '';
        document.getElementById('tratamentoDescContainer').style.display = 'none';
        document.getElementById('medicacaoDescContainer').style.display = 'none';
        document.getElementById('alergiaDescContainer').style.display = 'none';
        renderTable(patients, 'patients');
    } else if (type === 'specialties') {
        if (specialtyFormView) specialtyFormView.classList.add('hidden');
        if (specialtiesListView) specialtiesListView.classList.remove('hidden');
        document.getElementById('specialtyForm').reset();
        document.getElementById('editSpecialtyId').value = '';
        renderTable(specialties, 'specialties');
    } else if (type === 'services') {
        if (serviceFormView) serviceFormView.classList.add('hidden');
        if (servicesListView) servicesListView.classList.remove('hidden');
        document.getElementById('serviceForm').reset();
        document.getElementById('editServiceId').value = '';
        renderTable(services, 'services');
    } else if (type === 'budgets') {
        if (budgetFormView) budgetFormView.classList.add('hidden');
        if (budgetsListView) budgetsListView.classList.remove('hidden');
        if (document.getElementById('budgetForm')) document.getElementById('budgetForm').reset();
        document.getElementById('editBudgetId').value = '';
        document.getElementById('addBudgetItemPanel').style.display = 'none';
        if (typeof refreshBudgetsList === 'function') refreshBudgetsList();
        else renderTable(budgets, 'budgets');
    } else if (type === 'usersAdmin') {
        if (userAdminFormView) userAdminFormView.classList.add('hidden');
        if (usersAdminView) usersAdminView.classList.remove('hidden');
        if (userAdminForm) userAdminForm.reset();
        document.getElementById('editAdminUserId').value = '';

        const usersAdminTableBody = document.getElementById('usersAdminTableBody');
        if (usersAdminTableBody) {
            usersAdminTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
            if (usersAdminTableBody.parentElement) usersAdminTableBody.parentElement.style.display = 'table';
        }
        const usersAdminEmptyState = document.getElementById('usersAdminEmptyState');
        if (usersAdminEmptyState) usersAdminEmptyState.classList.add('hidden');
        armLoadTimer('usersAdmin', 16000, () => {
            if (usersAdminTableBody && usersAdminTableBody.textContent && usersAdminTableBody.textContent.includes('Carregando')) {
                usersAdminTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger-color);">Timeout ao carregar Usuários. Verifique RLS/policies e disponibilidade do Supabase.</td></tr>';
                showToast('Timeout ao carregar Usuários. Verifique RLS/policies.', true);
            }
        });

        // Fetch real team data
        // For SuperAdmin, we might want to see ALL users across ALL companies, 
        // but for now, we follow the currentEmpresaId filter to be safe.
        let query = db.from('usuario_empresas')
            .select('id, usuario_id, perfil, user_email, permissoes, empresa_id');

        // If SuperAdmin, we could potentially remove the filter, 
        // but let's stick to currentEmpresaId and see if it helps with isolation.
        if (!isSuperAdmin) {
            query = query.eq('empresa_id', currentEmpresaId);
        }

        (async () => {
            try {
                const { data, error } = await withTimeout(query, 15000, 'usuario_empresas');
                console.log("DEBUG Users Admin Raw Data:", data);
                if (error) throw error;
                renderTable(data || [], 'usersAdmin');
                if (!data || data.length === 0) {
                    showToast(`Nenhum usuário encontrado para a unidade [${currentEmpresaId || '-'}].`, true);
                }
            } catch (err) {
                console.error("Panic in usersAdmin fetch:", err);
                showToast(`Erro ao carregar lista de usuários (usuario_empresas): ${err.code || '-'} / ${err.message || 'Erro desconhecido'}`, true);
                if (usersAdminTableBody) {
                    usersAdminTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger-color);">Falha ao carregar. Verifique RLS/policies.</td></tr>';
                    if (usersAdminTableBody.parentElement) usersAdminTableBody.parentElement.style.display = 'table';
                }
            } finally {
                clearLoadTimer('usersAdmin');
            }
        })();
    } else if (type === 'empresas') {
        if (empresaFormView) empresaFormView.classList.add('hidden');
        if (empresasListView) empresasListView.classList.remove('hidden');
        if (empresaForm) empresaForm.reset();
        document.getElementById('editEmpresaOldId').value = '';
        fetchEmpresas();
    } else if (type === 'financeiro') {
        if (financeiroView) financeiroView.classList.remove('hidden');
        // Hidden other forms if any
        if (finTransacoesBody) {
            finTransacoesBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        armLoadTimer('financeiro', 16000, () => {
            if (finTransacoesBody && finTransacoesBody.textContent && finTransacoesBody.textContent.includes('Carregando')) {
                finTransacoesBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--danger-color);">Timeout ao carregar Financeiro. Verifique RLS/policies e disponibilidade do Supabase.</td></tr>';
                showToast('Timeout ao carregar Financeiro. Verifique RLS/policies.', true);
            }
        });
        fetchTransactions();
    } else if (type === 'commissions') {
        if (commissionsView) commissionsView.classList.remove('hidden');
        initCommissionsFilters();
        resetCommissionSelection();
        if (commissionsTableBody) {
            commissionsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (commissionsEmptyState) commissionsEmptyState.classList.add('hidden');
        armLoadTimer('commissions', 16000, () => {
            if (commissionsTableBody && commissionsTableBody.textContent && commissionsTableBody.textContent.includes('Carregando')) {
                commissionsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--danger-color);">Timeout ao carregar Comissões. Verifique RLS/policies e disponibilidade do Supabase.</td></tr>';
                showToast('Timeout ao carregar Comissões. Verifique RLS/policies.', true);
            }
        });
        fetchCommissionsFromUI();
    } else if (type === 'atendimento') {
        if (atendimentoView) atendimentoView.classList.remove('hidden');
        initAtendimentoFilters();
        renderAtendimentoPlaceholder();
        fetchAtendimentoForUI();
    } else if (type === 'agenda') {
        if (agendaView) agendaView.classList.remove('hidden');
        initAgendaFilters();
        renderAgendaPlaceholder();
        fetchAgendaForUI();
    } else if (type === 'protese') {
        if (proteseView) proteseView.classList.remove('hidden');
        initProteseFilters();
        renderProtesePlaceholder();
        fetchProteseFromUI();
    } else if (type === 'cancelledBudgets') {
        const cbView = document.getElementById('cancelledBudgetsView');
        if (cbView) cbView.classList.remove('hidden');
        const cancelledBudgetsTableBody = document.getElementById('cancelledBudgetsTableBody');
        if (cancelledBudgetsTableBody) {
            cancelledBudgetsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
            if (cancelledBudgetsTableBody.parentElement) cancelledBudgetsTableBody.parentElement.style.display = 'table';
        }
        const cancelledBudgetsEmptyState = document.getElementById('cancelledBudgetsEmptyState');
        if (cancelledBudgetsEmptyState) cancelledBudgetsEmptyState.classList.add('hidden');
        armLoadTimer('cancelledBudgets', 16000, () => {
            if (cancelledBudgetsTableBody && cancelledBudgetsTableBody.textContent && cancelledBudgetsTableBody.textContent.includes('Carregando')) {
                cancelledBudgetsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--danger-color);">Timeout ao carregar Audit Cancelados. Verifique RLS/policies e disponibilidade do Supabase.</td></tr>';
                showToast('Timeout ao carregar Audit Cancelados. Verifique RLS/policies.', true);
            }
        });
        viewCancelledBudgets();
    } else {
        professionalFormView.classList.add('hidden');
        professionalListView.classList.remove('hidden');
        professionalForm.reset();
        document.getElementById('editProfessionalId').value = '';
        comissionCard.style.display = 'none';
        renderTable(professionals, 'professionals');
    }
}

let currentProteseOrderId = null;

function isProteseCustodiaEnabled() {
    try {
        const v = localStorage.getItem('dp_feature_protese_custodia');
        if (v === '0') return false;
        if (v === '1') return true;
    } catch {
    }
    return true;
}

let proteseCustodiaPollTimer = null;

function updateProteseCustodiaButtonState() {
    if (!btnProteseCustodia) return;
    const enabled = isProteseCustodiaEnabled();
    btnProteseCustodia.style.display = enabled ? '' : 'none';
    if (!enabled) return;

    const hasOrder = Boolean(currentProteseOrderId);
    btnProteseCustodia.disabled = !hasOrder;
    btnProteseCustodia.title = hasOrder ? 'Registrar custódia via QR' : 'Salve a OP para habilitar custódia';
}

function proteseCustodiaCloseModal() {
    if (proteseCustodiaPollTimer) {
        try { clearInterval(proteseCustodiaPollTimer); } catch { }
        proteseCustodiaPollTimer = null;
    }
    if (proteseCustodiaModal) proteseCustodiaModal.classList.add('hidden');
    if (proteseCustodiaBody) proteseCustodiaBody.innerHTML = '';
}

async function sha256Hex(input) {
    const data = new TextEncoder().encode(String(input || ''));
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytesLen) {
    const a = new Uint8Array(Math.max(8, Number(bytesLen) || 32));
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSixDigitCode() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    const n = a[0] % 1000000;
    return String(n).padStart(6, '0');
}

function getAppBaseUrl() {
    try {
        if (location.origin && location.origin !== 'null') return location.origin;
        const parts = String(location.href || '').split('?')[0].split('#')[0].split('/');
        parts.pop();
        return parts.join('/');
    } catch {
        return '';
    }
}

async function getProteseCustodiaAtual(orderId) {
    try {
        const q = db.from('ordens_proteticas_custodia_eventos')
            .select('para_local,created_at')
            .eq('empresa_id', currentEmpresaId)
            .eq('ordem_id', orderId)
            .order('created_at', { ascending: false })
            .limit(1);
        const { data, error } = await withTimeout(q, 12000, 'ordens_proteticas_custodia_eventos:last');
        if (error) throw error;
        const row = (data && data[0]) ? data[0] : null;
        if (row && row.para_local) return String(row.para_local);
    } catch {
    }
    const empresaLabel = getEmpresaName(currentEmpresaId);
    return empresaLabel ? `CLÍNICA (${empresaLabel})` : 'CLÍNICA';
}

async function openProteseCustodiaModal() {
    if (!isProteseCustodiaEnabled()) {
        showToast('Custódia está desabilitada (dp_feature_protese_custodia=0).', true);
        return;
    }
    if (!currentProteseOrderId) {
        showToast('Salve/abra uma OP antes de registrar custódia.', true);
        return;
    }
    if (!proteseCustodiaModal || !proteseCustodiaBody) return;

    const orderId = String(currentProteseOrderId);
    const localOrder = (proteseOrders || []).find(o => String(o.id) === orderId) || null;
    const ordemSeq = localOrder && localOrder.seqid != null ? String(localOrder.seqid) : '—';
    const pacienteNome = localOrder ? getPatientNameById(localOrder.paciente_id) : '—';

    const empresaLabel = getEmpresaName(currentEmpresaId);
    const clinicaLabel = empresaLabel ? `CLÍNICA (${empresaLabel})` : 'CLÍNICA';
    const exec = localOrder ? String(localOrder.tipo_execucao || '') : '';
    const parceiroLabel = exec === 'INTERNA'
        ? (localOrder ? getProteticoNameById(localOrder.protetico_id) : '')
        : (localOrder ? getLaboratorioNameById(localOrder.laboratorio_id) : '');
    const pacienteLabel = pacienteNome ? `PACIENTE (${pacienteNome})` : 'PACIENTE';

    const deAtual = await getProteseCustodiaAtual(orderId);
    const baseUrl = getAppBaseUrl();

    const locOptions = [
        { key: 'CLINICA', label: clinicaLabel },
        { key: 'PACIENTE', label: pacienteLabel }
    ];
    if (parceiroLabel) {
        locOptions.push({ key: exec === 'INTERNA' ? 'PROTETICO' : 'LABORATORIO', label: parceiroLabel });
    }

    proteseCustodiaBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap: 12px;">
            <div class="card" style="padding: 12px;">
                <div style="display:flex; gap: 10px; flex-wrap: wrap; align-items: baseline;">
                    <div style="font-weight: 900;">OP #${escapeHtml(ordemSeq)}</div>
                    <div style="color: var(--text-muted);">${escapeHtml(String(pacienteNome || ''))}</div>
                    <div style="margin-left:auto; color: var(--text-muted);">Custódia atual: <b style="color: var(--text-color);">${escapeHtml(deAtual || clinicaLabel)}</b></div>
                </div>
            </div>

            <div class="card" style="padding: 12px;">
                <div style="display:flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;">
                    <div class="form-group" style="min-width: 220px; margin-bottom: 0;">
                        <label>Ação</label>
                        <select id="custodiaAcao" class="form-control">
                            <option value="ENTREGA">Entrega</option>
                            <option value="RECEBIMENTO">Recebimento</option>
                        </select>
                    </div>
                    <div class="form-group" style="min-width: 240px; margin-bottom: 0;">
                        <label>Para (posse)</label>
                        <select id="custodiaPara" class="form-control">
                            ${locOptions.map(o => `<option value="${escapeHtml(o.key)}">${escapeHtml(o.label)}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary" id="btnCustodiaGerar" style="height: 42px;">
                        <i class="ri-qr-code-line"></i> Gerar QR
                    </button>
                </div>
                <div style="margin-top: 10px; color: var(--text-muted); font-size: 12px;">
                    O portador escaneia o QR no celular, digita o código exibido nesta tela e assina.
                </div>
            </div>

            <div class="card hidden" id="custodiaOut" style="padding: 12px;">
                <div style="display:grid; grid-template-columns: 240px 1fr; gap: 14px; align-items: start;">
                    <div style="display:flex; flex-direction:column; gap: 10px;">
                        <div style="border:1px solid var(--border-color); border-radius: 12px; padding: 10px; background: var(--bg-hover); text-align:center;">
                            <img id="custodiaQrImg" alt="QR" style="width: 220px; height: 220px; max-width: 100%;" />
                        </div>
                        <div style="text-align:center;">
                            <div style="color: var(--text-muted); font-size: 12px;">Código</div>
                            <div id="custodiaCodigo" style="font-size: 22px; font-weight: 900; letter-spacing: 0.15em;">—</div>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap: 10px;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label>Link</label>
                            <input id="custodiaLink" class="form-control" readonly />
                        </div>
                        <div style="display:flex; gap: 10px; flex-wrap: wrap;">
                            <button class="btn btn-secondary" id="btnCustodiaCopy"><i class="ri-file-copy-line"></i> Copiar link</button>
                            <button class="btn btn-secondary" id="btnCustodiaCheck"><i class="ri-refresh-line"></i> Verificar assinatura</button>
                            <button class="btn btn-danger" id="btnCustodiaCancel"><i class="ri-close-circle-line"></i> Cancelar QR</button>
                        </div>
                        <div id="custodiaStatus" style="color: var(--text-muted); font-size: 12px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const custodiaAcao = document.getElementById('custodiaAcao');
    const custodiaPara = document.getElementById('custodiaPara');
    const btnCustodiaGerar = document.getElementById('btnCustodiaGerar');
    const out = document.getElementById('custodiaOut');
    const qrImg = document.getElementById('custodiaQrImg');
    const codigoEl = document.getElementById('custodiaCodigo');
    const linkEl = document.getElementById('custodiaLink');
    const statusEl = document.getElementById('custodiaStatus');
    const btnCopy = document.getElementById('btnCustodiaCopy');
    const btnCheck = document.getElementById('btnCustodiaCheck');
    const btnCancel = document.getElementById('btnCustodiaCancel');

    let activeToken = null;

    const buildLink = (tok) => `${baseUrl}/protese_custodia.html?t=${encodeURIComponent(tok)}`;

    const resolveLocLabel = (key) => {
        const k = String(key || '').toUpperCase();
        if (k === 'CLINICA') return clinicaLabel;
        if (k === 'PACIENTE') return pacienteLabel;
        if (k === 'LABORATORIO') return parceiroLabel || 'LABORATÓRIO';
        if (k === 'PROTETICO') return parceiroLabel || 'PROTÉTICO';
        return String(key || '');
    };

    const syncParaByAcao = () => {
        if (!custodiaAcao || !custodiaPara) return;
        const acao = String(custodiaAcao.value || 'ENTREGA');
        if (acao === 'RECEBIMENTO') {
            custodiaPara.value = 'CLINICA';
            custodiaPara.disabled = true;
        } else {
            custodiaPara.disabled = false;
            if (parceiroLabel && (custodiaPara.value !== 'PACIENTE')) {
                const prefer = exec === 'INTERNA' ? 'PROTETICO' : 'LABORATORIO';
                custodiaPara.value = prefer;
            }
        }
    };
    if (custodiaAcao) custodiaAcao.addEventListener('change', syncParaByAcao);
    syncParaByAcao();

    const renderOut = ({ token, code }) => {
        if (!out) return;
        out.classList.remove('hidden');
        const link = buildLink(token);
        if (linkEl) linkEl.value = link;
        if (codigoEl) codigoEl.textContent = String(code || '—');
        if (qrImg) {
            const src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
            qrImg.src = src;
        }
        if (statusEl) statusEl.textContent = 'Aguardando confirmação...';
    };

    const checkStatus = async () => {
        if (!activeToken) return;
        try {
            const q = db.from('ordens_proteticas_custodia_tokens')
                .select('status,confirmed_at')
                .eq('empresa_id', currentEmpresaId)
                .eq('ordem_id', orderId)
                .eq('token', activeToken)
                .limit(1);
            const { data, error } = await withTimeout(q, 12000, 'ordens_proteticas_custodia_tokens:check');
            if (error) throw error;
            const row = (data && data[0]) ? data[0] : null;
            const st = row ? String(row.status || '') : '';
            if (statusEl) statusEl.textContent = st ? `Status: ${st}${row && row.confirmed_at ? ` (${formatDateTime(row.confirmed_at)})` : ''}` : 'Status: —';
            if (st === 'CONFIRMADO') {
                showToast('Custódia confirmada.');
                await loadProteseTimeline(orderId);
                proteseCustodiaCloseModal();
                return;
            }
            if (st === 'CANCELADO' || st === 'EXPIRADO') {
                if (proteseCustodiaPollTimer) {
                    try { clearInterval(proteseCustodiaPollTimer); } catch { }
                    proteseCustodiaPollTimer = null;
                }
            }
        } catch (err) {
            const msg = err && err.message ? err.message : 'Falha ao verificar.';
            showToast(msg, true);
        }
    };

    const cancelToken = async () => {
        if (!activeToken) return;
        if (!confirm('Cancelar este QR?')) return;
        try {
            const q = db.from('ordens_proteticas_custodia_tokens')
                .update({ status: 'CANCELADO' })
                .eq('empresa_id', currentEmpresaId)
                .eq('ordem_id', orderId)
                .eq('token', activeToken);
            const { error } = await withTimeout(q, 12000, 'ordens_proteticas_custodia_tokens:cancel');
            if (error) throw error;
            if (statusEl) statusEl.textContent = 'Status: CANCELADO';
            if (proteseCustodiaPollTimer) {
                try { clearInterval(proteseCustodiaPollTimer); } catch { }
                proteseCustodiaPollTimer = null;
            }
            showToast('QR cancelado.');
        } catch (err) {
            const msg = err && err.message ? err.message : 'Falha ao cancelar.';
            showToast(msg, true);
        }
    };

    if (btnCopy) btnCopy.addEventListener('click', async () => {
        const link = linkEl ? String(linkEl.value || '') : '';
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            showToast('Link copiado.');
        } catch {
            showToast('Não foi possível copiar automaticamente.', true);
        }
    });
    if (btnCheck) btnCheck.addEventListener('click', async () => { await checkStatus(); });
    if (btnCancel) btnCancel.addEventListener('click', async () => { await cancelToken(); });

    if (btnCustodiaGerar) btnCustodiaGerar.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const acao = custodiaAcao ? String(custodiaAcao.value || 'ENTREGA') : 'ENTREGA';
            const paraKey = custodiaPara ? String(custodiaPara.value || 'PACIENTE') : 'PACIENTE';
            const token = randomHex(32);
            const code = randomSixDigitCode();
            const challengeHash = await sha256Hex(code);
            const deLabel = String(deAtual || clinicaLabel);
            const paraLabel = resolveLocLabel(paraKey);
            const payload = {
                empresa_id: currentEmpresaId,
                ordem_id: orderId,
                token,
                challenge_hash: challengeHash,
                acao,
                de_local: deLabel,
                para_local: paraLabel,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                created_by: currentUser && currentUser.id ? currentUser.id : null
            };
            const q = db.from('ordens_proteticas_custodia_tokens').insert(payload);
            const { error } = await withTimeout(q, 15000, 'ordens_proteticas_custodia_tokens:insert');
            if (error) throw error;
            activeToken = token;
            renderOut({ token, code });
            if (proteseCustodiaPollTimer) {
                try { clearInterval(proteseCustodiaPollTimer); } catch { }
                proteseCustodiaPollTimer = null;
            }
            proteseCustodiaPollTimer = setInterval(() => { checkStatus(); }, 2000);
            setTimeout(() => { checkStatus(); }, 900);
        } catch (err) {
            console.error('Erro ao gerar custódia:', err);
            const msg = err && err.message ? err.message : 'Falha ao gerar QR.';
            showToast(msg, true);
        }
    });

    proteseCustodiaModal.classList.remove('hidden');
}

async function resolveBudgetIdFromSeqid(seqid) {
    const n = Number(seqid);
    if (!Number.isFinite(n) || n <= 0) return null;
    const local = (budgets || []).find(b => Number(b.seqid) === n);
    if (local && local.id) return String(local.id);
    try {
        const q = db.from('orcamentos').select('id').eq('empresa_id', currentEmpresaId).eq('seqid', n).limit(1);
        const { data, error } = await withTimeout(q, 15000, 'orcamentos:seqid_to_id');
        if (error) throw error;
        const row = (data || [])[0];
        return row && row.id ? String(row.id) : null;
    } catch {
        return null;
    }
}

function getPatientNameById(id) {
    const p = (patients || []).find(x => String(x.id) === String(id));
    return p ? p.nome : (id || '-');
}

function getProteticoNameById(id) {
    const p = (professionals || []).find(x => String(x.id) === String(id));
    return p ? p.nome : (id ? `Protético ${String(id).slice(0, 8)}` : '-');
}

function getLaboratorioNameById(id) {
    const l = (proteseLabs || []).find(x => String(x.id) === String(id));
    return l ? l.nome : (id ? `Lab ${String(id).slice(0, 8)}` : '-');
}

function getBudgetSeqIdById(orcamentoId) {
    if (!orcamentoId) return null;
    const raw = String(orcamentoId);
    const byId = (budgets || []).find(b => String(b.id) === raw);
    if (byId && byId.seqid != null) return byId.seqid;
    const n = Number(raw);
    if (Number.isFinite(n)) {
        const bySeq = (budgets || []).find(b => Number(b.seqid) === n);
        if (bySeq && bySeq.seqid != null) return bySeq.seqid;
    }
    return null;
}

function formatBudgetDisplay(orcamentoId) {
    const seq = getBudgetSeqIdById(orcamentoId);
    if (seq != null) return String(seq);
    return '—';
}

async function resolveBudgetSeqidFromDb(orcamentoId) {
    if (!orcamentoId) return null;
    const raw = String(orcamentoId);
    const n = Number(raw);
    try {
        if (Number.isFinite(n)) {
            const q1 = db.from('orcamentos').select('seqid, id').eq('empresa_id', currentEmpresaId).eq('seqid', n).limit(1);
            const { data, error } = await withTimeout(q1, 15000, 'orcamentos:seqid_lookup');
            if (error) throw error;
            const row = (data || [])[0];
            if (row && row.seqid != null) return row.seqid;
            return null;
        }
        const q2 = db.from('orcamentos').select('seqid').eq('empresa_id', currentEmpresaId).eq('id', raw).single();
        const { data, error } = await withTimeout(q2, 15000, 'orcamentos:id_lookup');
        if (error) throw error;
        return data && data.seqid != null ? data.seqid : null;
    } catch (err) {
        console.warn('Não foi possível resolver seqid do orçamento:', err);
        return null;
    }
}

async function printProteseOrder(orderId) {
    try {
        const id = orderId ? String(orderId) : '';
        if (!id) { showToast('OP não encontrada para impressão.', true); return; }

        let o = (proteseOrders || []).find(x => String(x.id) === id) || null;
        if (!o) {
            const q = db.from('ordens_proteticas').select('*').eq('empresa_id', currentEmpresaId).eq('id', id).single();
            const res = await withTimeout(q, 20000, 'ordens_proteticas:print_single');
            if (res.error) throw res.error;
            o = res.data;
        }
        if (!o) { showToast('OP não encontrada para impressão.', true); return; }

        const paciente = (patients || []).find(p => String(p.id) === String(o.paciente_id)) || null;
        const pacienteNome = paciente ? String(paciente.nome || '') : getPatientNameById(o.paciente_id);
        const pacienteSeq = paciente && paciente.seqid != null ? String(paciente.seqid) : '';
        const pacienteCel = paciente ? String(paciente.celular || '') : '';

        const exec = String(o.tipo_execucao || '');
        const execLabel = exec === 'INTERNA' ? 'Interna' : 'Externa';
        const executorNome = exec === 'INTERNA' ? getProteticoNameById(o.protetico_id) : getLaboratorioNameById(o.laboratorio_id);

        const prazo = o.prazo_previsto ? String(o.prazo_previsto).slice(0, 10).split('-').reverse().join('/') : '';
        const prioridade = String(o.prioridade || 'NORMAL');
        const fase = String(o.fase_atual || '');
        const status = String(o.status_geral || '');

        let orcSeq = getBudgetSeqIdById(o.orcamento_id);
        if (orcSeq == null && o.orcamento_id) orcSeq = await resolveBudgetSeqidFromDb(o.orcamento_id);
        const orcDisp = orcSeq != null ? String(orcSeq) : '—';

        const evRes = await withTimeout(
            db.from('ordens_proteticas_eventos')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('ordem_id', id)
                .order('created_at', { ascending: true })
                .limit(1000),
            25000,
            'ordens_proteticas_eventos:print'
        );
        if (evRes.error) throw evRes.error;
        const events = (evRes.data || []).map(e => ({ kind: 'op', ...e }));

        let custodia = [];
        try {
            const cRes = await withTimeout(
                db.from('ordens_proteticas_custodia_eventos')
                    .select('*')
                    .eq('empresa_id', currentEmpresaId)
                    .eq('ordem_id', id)
                    .order('created_at', { ascending: true })
                    .limit(1000),
                25000,
                'ordens_proteticas_custodia_eventos:print'
            );
            if (!cRes.error) custodia = (cRes.data || []).map(e => ({ kind: 'custodia', ...e }));
        } catch {
        }

        const allEvents = events.concat(custodia).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));

        const anRes = await withTimeout(
            db.from('ordens_proteticas_anexos')
                .select('id, tipo, nome_arquivo, mime_type, created_at')
                .eq('empresa_id', currentEmpresaId)
                .eq('ordem_id', id)
                .order('created_at', { ascending: true })
                .limit(500),
            25000,
            'ordens_proteticas_anexos:print'
        );
        if (anRes.error) throw anRes.error;
        const anexos = anRes.data || [];

        const evRows = allEvents.length
            ? allEvents.map((e, idx) => {
                const dt = e.created_at ? formatDateTime(e.created_at) : '';
                const isCust = e.kind === 'custodia';
                const tipo = isCust ? escapeHtml(`CUSTÓDIA · ${String(e.acao || '')}`) : escapeHtml(String(e.tipo_evento || ''));
                const faseRes = isCust ? '' : escapeHtml(String(e.fase_resultante || ''));
                const de = escapeHtml(String(e.de_local || ''));
                const para = escapeHtml(String(e.para_local || ''));
                const notaRaw = isCust
                    ? `Recebido por: ${String(e.recebedor_nome || '')}${e.recebedor_doc ? ` (${String(e.recebedor_doc || '')})` : ''}`
                    : String(e.nota || '');
                const nota = escapeHtml(notaRaw).replace(/\n/g, '<br>');
                return `
                    <tr>
                        <td style="width:30px; text-align:right;">${idx + 1}</td>
                        <td style="white-space:nowrap;">${escapeHtml(dt)}</td>
                        <td>${tipo}</td>
                        <td>${faseRes}</td>
                        <td>${de}</td>
                        <td>${para}</td>
                        <td>${nota}</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="7" style="text-align:center; color:#6b7280; padding:12px;">Nenhum evento registrado.</td></tr>`;

        const anRows = anexos.length
            ? anexos.map((a, idx) => {
                const dt = a.created_at ? formatDateTime(a.created_at) : '';
                return `
                    <tr>
                        <td style="width:30px; text-align:right;">${idx + 1}</td>
                        <td style="white-space:nowrap;">${escapeHtml(dt)}</td>
                        <td>${escapeHtml(String(a.tipo || ''))}</td>
                        <td>${escapeHtml(String(a.nome_arquivo || ''))}</td>
                        <td>${escapeHtml(String(a.mime_type || ''))}</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="5" style="text-align:center; color:#6b7280; padding:12px;">Nenhum anexo.</td></tr>`;

        const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>OP #${escapeHtml(String(o.seqid || ''))}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; padding: 24px; }
    .header { display:flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-weight: 800; color:#0066cc; font-size: 20px; line-height: 1.05; }
    .brand small { display:block; font-size: 11px; font-weight: 600; color:#6b7280; margin-top: 2px; }
    .doc { text-align:right; }
    .doc h1 { font-size: 14px; letter-spacing: 0.04em; }
    .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; background:#eff6ff; color:#1d4ed8; font-weight: 800; font-size: 11px; }
    .muted { color:#6b7280; }
    .grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 12px 0 16px; }
    .item label { display:block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color:#6b7280; }
    .item div { font-weight: 700; margin-top: 2px; }
    .section { margin-top: 14px; }
    .section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color:#6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { background:#f3f4f6; padding: 7px 8px; text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color:#6b7280; border: 1px solid #e5e7eb; }
    td { padding: 7px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background:#f9fafb; }
    .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color:#9ca3af; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">OCC <small>Odonto Connect Cloud</small></div>
      <div class="muted" style="margin-top:4px;">Controle de Produção Protética</div>
    </div>
    <div class="doc">
      <h1>ORDEM PROTÉTICA</h1>
      <div class="muted" style="margin-top:4px;">OP #${escapeHtml(String(o.seqid || ''))}</div>
      <div style="margin-top:6px;"><span class="badge">${escapeHtml(status || '—')}</span></div>
      <div class="muted" style="margin-top:6px; font-size: 11px;">Emitido em: ${escapeHtml(hoje)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="item"><label>Paciente</label><div>${escapeHtml(pacienteSeq ? `#${pacienteSeq} - ${pacienteNome}` : pacienteNome)}</div></div>
    <div class="item"><label>Celular</label><div>${escapeHtml(pacienteCel || '—')}</div></div>
    <div class="item"><label>Orçamento</label><div>#${escapeHtml(orcDisp)}</div></div>
    <div class="item"><label>Execução</label><div>${escapeHtml(execLabel)}</div></div>
    <div class="item"><label>Executor</label><div>${escapeHtml(String(executorNome || '—'))}</div></div>
    <div class="item"><label>Fase / Prioridade</label><div>${escapeHtml(fase || '—')} / ${escapeHtml(prioridade || '—')}</div></div>
    <div class="item"><label>Prazo</label><div>${escapeHtml(prazo || '—')}</div></div>
    <div class="item"><label>Empresa</label><div>${escapeHtml(String(currentEmpresaId || '—'))}</div></div>
  </div>

  <div class="section">
    <h2>Controle de idas e vindas (Histórico)</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Data/Hora</th>
          <th>Evento</th>
          <th>Fase</th>
          <th>De</th>
          <th>Para</th>
          <th>Observação</th>
        </tr>
      </thead>
      <tbody>
        ${evRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Anexos</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Data/Hora</th>
          <th>Tipo</th>
          <th>Arquivo</th>
          <th>MIME</th>
        </tr>
      </thead>
      <tbody>
        ${anRows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Documento gerado automaticamente pelo OCC.
  </div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=980,height=750');
        if (!win) { showToast('Habilite pop-ups para imprimir a OP.', true); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
    } catch (err) {
        console.error('Erro ao imprimir OP:', err);
        const msg = err && err.message ? err.message : String(err || 'erro');
        showToast(`Erro ao imprimir OP: ${msg}`, true);
    }
}

function renderProtesePlaceholder(msg = 'Carregando...') {
    if (proteseTableBody) {
        proteseTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">${escapeHtml(msg)}</td></tr>`;
        if (proteseTableBody.parentElement) proteseTableBody.parentElement.style.display = 'table';
    }
    if (proteseEmptyState) proteseEmptyState.classList.add('hidden');
    if (proteseKpiTotal) proteseKpiTotal.textContent = '0';
    if (proteseKpiOverdue) proteseKpiOverdue.textContent = '0';
    if (proteseKpiExterna) proteseKpiExterna.textContent = '0';
    if (proteseKpiInterna) proteseKpiInterna.textContent = '0';
}

function initProteseFilters() {
    if (proteseSearch && !proteseSearch.dataset.bound) {
        proteseSearch.addEventListener('input', () => applyProteseFiltersAndRender());
        proteseSearch.dataset.bound = '1';
    }
    [proteseStatusFilter, proteseExecucaoFilter, proteseOverdueFilter].forEach(el => {
        if (!el || el.dataset.bound) return;
        el.addEventListener('change', () => applyProteseFiltersAndRender());
        el.dataset.bound = '1';
    });

    if (btnProteseRefresh && !btnProteseRefresh.dataset.bound) {
        btnProteseRefresh.addEventListener('click', () => fetchProteseFromUI(true));
        btnProteseRefresh.dataset.bound = '1';
    }
    if (btnProteseNew && !btnProteseNew.dataset.bound) {
        btnProteseNew.addEventListener('click', () => openProteseModal({}));
        btnProteseNew.dataset.bound = '1';
    }
    if (btnProteseLabs && !btnProteseLabs.dataset.bound) {
        btnProteseLabs.addEventListener('click', () => openProteseLabsModal());
        btnProteseLabs.dataset.bound = '1';
    }
}

function resetProteseFilters() {
    if (proteseStatusFilter) proteseStatusFilter.value = '';
    if (proteseExecucaoFilter) proteseExecucaoFilter.value = '';
    if (proteseOverdueFilter) proteseOverdueFilter.value = '';
    if (proteseSearch) proteseSearch.value = '';
}

async function loadProteseLabs(force = false) {
    if (!force && Array.isArray(proteseLabs) && proteseLabs.length) return;
    const q = db.from('laboratorios_proteticos')
        .select('*')
        .eq('empresa_id', currentEmpresaId)
        .order('seqid', { ascending: true });
    const { data, error } = await withTimeout(q, 15000, 'laboratorios_proteticos');
    if (error) throw error;
    proteseLabs = data || [];
}

async function loadProteseOrders(force = false) {
    if (!force && Array.isArray(proteseOrders) && proteseOrders.length) return;
    const q = db.from('ordens_proteticas')
        .select('*')
        .eq('empresa_id', currentEmpresaId)
        .order('seqid', { ascending: false })
        .limit(2000);
    const { data, error } = await withTimeout(q, 20000, 'ordens_proteticas');
    if (error) throw error;
    proteseOrders = data || [];
}

async function fetchProteseFromUI(force = false) {
    try {
        renderProtesePlaceholder('Carregando...');
        await loadProteseLabs(force);
        await loadProteseOrders(force);
        applyProteseFiltersAndRender();
    } catch (err) {
        console.error('Erro ao carregar Produção Protética:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        renderProtesePlaceholder(`Falha ao carregar (${code}).`);
        showToast(`Erro ao carregar Produção Protética (${code}): ${msg}`, true);
    }
}

async function openProteseForBudgetItem(itemId) {
    try {
        if (!itemId) return;
        await loadProteseLabs(false);
        const bId = document.getElementById('editBudgetId')?.value || '';
        const pId = document.getElementById('budPacienteId')?.value || '';
        const q = db.from('ordens_proteticas')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('orcamento_item_id', String(itemId))
            .order('created_at', { ascending: false })
            .limit(1);
        const { data, error } = await withTimeout(q, 15000, 'ordens_proteticas:by_item');
        if (error) throw error;
        const existing = (data || [])[0];
        if (existing && existing.id) {
            await openProteseModal({ orderId: existing.id });
            return;
        }
        await openProteseModal({ pacienteId: pId || null, orcamentoId: bId || null, itemId: String(itemId) });
    } catch (err) {
        console.error('Erro ao abrir OP do item:', err);
        showToast('Erro ao abrir Produção Protética deste item.', true);
    }
}

function isProteseOverdue(o) {
    if (!o || !o.prazo_previsto) return false;
    if (String(o.status_geral || '') === 'CONCLUIDA' || String(o.status_geral || '') === 'CANCELADA') return false;
    const today = new Date();
    const d = new Date(`${String(o.prazo_previsto).slice(0, 10)}T00:00:00`);
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d < today;
}

function applyProteseFiltersAndRender() {
    const status = proteseStatusFilter ? String(proteseStatusFilter.value || '') : '';
    const execucao = proteseExecucaoFilter ? String(proteseExecucaoFilter.value || '') : '';
    const overdue = proteseOverdueFilter ? String(proteseOverdueFilter.value || '') : '';
    const q = proteseSearch ? String(proteseSearch.value || '').trim().toLowerCase() : '';

    let list = (proteseOrders || []).slice();
    if (status) list = list.filter(o => String(o.status_geral || '') === status);
    if (execucao) list = list.filter(o => String(o.tipo_execucao || '') === execucao);
    if (overdue === '1') list = list.filter(o => isProteseOverdue(o));
    if (overdue === '0') list = list.filter(o => !isProteseOverdue(o));

    if (q) {
        list = list.filter(o => {
            const patient = getPatientNameById(o.paciente_id).toLowerCase();
            const op = String(o.seqid || '').toLowerCase();
            const orc = String(o.orcamento_id || '').toLowerCase();
            const item = String(o.orcamento_item_id || '').toLowerCase();
            return patient.includes(q) || op.includes(q) || orc.includes(q) || item.includes(q);
        });
    }

    const overdueCount = list.filter(o => isProteseOverdue(o)).length;
    const externaCount = list.filter(o => String(o.tipo_execucao || '') === 'EXTERNA').length;
    const internaCount = list.filter(o => String(o.tipo_execucao || '') === 'INTERNA').length;
    if (proteseKpiTotal) proteseKpiTotal.textContent = String(list.length);
    if (proteseKpiOverdue) proteseKpiOverdue.textContent = String(overdueCount);
    if (proteseKpiExterna) proteseKpiExterna.textContent = String(externaCount);
    if (proteseKpiInterna) proteseKpiInterna.textContent = String(internaCount);

    renderTable(list, 'protese');
}

function syncProteseExecutorFields() {
    const t = proteseTipoExecucao ? String(proteseTipoExecucao.value || 'EXTERNA') : 'EXTERNA';
    if (proteseLabGroup) proteseLabGroup.style.display = (t === 'EXTERNA') ? '' : 'none';
    if (proteseProteticoGroup) proteseProteticoGroup.style.display = (t === 'INTERNA') ? '' : 'none';
}

async function loadProteseTimeline(orderId) {
    if (!proteseTimeline) return;
    proteseTimeline.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Carregando...</div>';
    try {
        const q = db.from('ordens_proteticas_eventos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('ordem_id', orderId)
            .order('created_at', { ascending: false })
            .limit(500);
        const { data, error } = await withTimeout(q, 15000, 'ordens_proteticas_eventos');
        if (error) throw error;
        const events = (data || []).map(ev => ({ kind: 'op', ...ev }));
        let custodia = [];
        try {
            const q2 = db.from('ordens_proteticas_custodia_eventos')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('ordem_id', orderId)
                .order('created_at', { ascending: false })
                .limit(200);
            const { data: d2, error: e2 } = await withTimeout(q2, 12000, 'ordens_proteticas_custodia_eventos');
            if (!e2) custodia = (d2 || []).map(ev => ({ kind: 'custodia', ...ev }));
        } catch {
        }
        const all = events.concat(custodia).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        if (!all.length) {
            proteseTimeline.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Nenhum evento registrado.</div>';
            return;
        }
        proteseTimeline.innerHTML = all.map(ev => {
            const dt = ev.created_at ? formatDateTime(ev.created_at) : '-';
            const isCust = ev.kind === 'custodia';
            const tipo = isCust ? `CUSTÓDIA · ${escapeHtml(String(ev.acao || ''))}` : escapeHtml(String(ev.tipo_evento || ''));
            const fase = escapeHtml(String(ev.fase_resultante || ''));
            const de = escapeHtml(String(ev.de_local || ''));
            const para = escapeHtml(String(ev.para_local || ''));
            const notaRaw = isCust
                ? `Recebido por: ${String(ev.recebedor_nome || '')}${ev.recebedor_doc ? ` (${String(ev.recebedor_doc || '')})` : ''}`
                : String(ev.nota || '');
            const nota = escapeHtml(notaRaw || '').replace(/\n/g, '<br>');
            const path = (de || para) ? `${de}${(de && para) ? ' → ' : ''}${para}` : '';
            return `
                <div class="protese-timeline-item">
                    <div class="protese-timeline-meta">
                        <div><i class="ri-calendar-line"></i> ${escapeHtml(dt)}</div>
                        ${tipo ? `<div><i class="ri-flashlight-line"></i> ${tipo}</div>` : ''}
                        ${fase ? `<div><i class="ri-flag-line"></i> ${fase}</div>` : ''}
                        ${path ? `<div><i class="ri-route-line"></i> ${path}</div>` : ''}
                    </div>
                    ${nota ? `<div class="protese-timeline-note">${nota}</div>` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar timeline:', err);
        proteseTimeline.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--danger-color);">Falha ao carregar histórico.</div>';
    }
}

function renderProteseAnexos(items) {
    if (!proteseAnexosList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
        proteseAnexosList.innerHTML = '<div style="text-align:center; padding: 0.75rem; color: var(--text-muted);">Nenhum anexo.</div>';
        return;
    }
    proteseAnexosList.innerHTML = list.map(a => {
        const dt = a.created_at ? formatDateTime(a.created_at) : '-';
        const nome = escapeHtml(String(a.nome_arquivo || 'arquivo'));
        const tipo = escapeHtml(String(a.mime_type || ''));
        const href = String(a.conteudo_base64 || '');
        const canOpen = href && href.startsWith('data:');
        const openBtn = canOpen
            ? `<a class="btn btn-secondary btn-sm" href="${href}" download="${nome}" style="text-decoration:none;"><i class="ri-download-2-line"></i> Baixar</a>`
            : '';
        return `
            <div class="protese-timeline-item" style="border-left-color: var(--primary-color);">
                    <div class="protese-timeline-meta">
                    <div><i class="ri-attachment-2-line"></i> ${nome}</div>
                    ${tipo ? `<div>${tipo}</div>` : ''}
                    <div><i class="ri-calendar-line"></i> ${escapeHtml(dt)}</div>
                </div>
                <div style="display:flex; gap: 0.5rem; flex-wrap: wrap;">${openBtn}</div>
            </div>
        `;
    }).join('');
}

async function loadProteseAnexos(orderId) {
    if (!proteseAnexosList) return;
    proteseAnexosList.innerHTML = '<div style="text-align:center; padding: 0.75rem; color: var(--text-muted);">Carregando anexos...</div>';
    try {
        const q = db.from('ordens_proteticas_anexos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('ordem_id', orderId)
            .order('created_at', { ascending: false })
            .limit(100);
        const { data, error } = await withTimeout(q, 20000, 'ordens_proteticas_anexos');
        if (error) throw error;
        renderProteseAnexos(data || []);
    } catch (err) {
        console.error('Erro ao carregar anexos:', err);
        proteseAnexosList.innerHTML = '<div style="text-align:center; padding: 0.75rem; color: var(--danger-color);">Falha ao carregar anexos.</div>';
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
        reader.readAsDataURL(file);
    });
}

async function uploadProteseAnexo() {
    if (!currentProteseOrderId) {
        showToast('Salve a OP antes de anexar arquivos.', true);
        return;
    }
    const file = proteseAnexoFile && proteseAnexoFile.files ? proteseAnexoFile.files[0] : null;
    if (!file) {
        showToast('Selecione um arquivo.', true);
        return;
    }
    try {
        const dataUrl = await readFileAsDataUrl(file);
        const payload = {
            empresa_id: currentEmpresaId,
            ordem_id: currentProteseOrderId,
            tipo: (file.type || '').startsWith('image/') ? 'IMAGEM' : ((file.type || '').includes('pdf') ? 'PDF' : 'ARQUIVO'),
            nome_arquivo: file.name || 'arquivo',
            mime_type: file.type || null,
            conteudo_base64: dataUrl
        };
        const q = db.from('ordens_proteticas_anexos').insert(payload).select().single();
        const { error } = await withTimeout(q, 25000, 'ordens_proteticas_anexos:insert');
        if (error) throw error;
        if (proteseAnexoFile) proteseAnexoFile.value = '';
        await loadProteseAnexos(currentProteseOrderId);
        showToast('Anexo enviado.');
    } catch (err) {
        console.error('Erro ao enviar anexo:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao enviar anexo (${code}): ${msg}`, true);
    }
}

async function openProteseModal({ orderId = null, pacienteId = null, orcamentoId = null, itemId = null } = {}) {
    if (!modalProtese) return;
    await loadProteseLabs(false);

    currentProteseOrderId = orderId ? String(orderId) : null;
    if (proteseNota) proteseNota.value = '';

    if (protesePaciente) {
        const opts = ['<option value="">Selecione...</option>'];
        (patients || []).slice().sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')).forEach(p => {
            opts.push(`<option value="${p.id}">${escapeHtml(String(p.seqid || ''))} - ${escapeHtml(String(p.nome || ''))}</option>`);
        });
        protesePaciente.innerHTML = opts.join('');
    }

    if (proteseLaboratorio) {
        const opts = ['<option value="">Selecione...</option>'];
        (proteseLabs || []).filter(l => l.ativo !== false).forEach(l => {
            opts.push(`<option value="${l.id}">${escapeHtml(String(l.seqid || ''))} - ${escapeHtml(String(l.nome || ''))}</option>`);
        });
        proteseLaboratorio.innerHTML = opts.join('');
    }

    if (proteseProtetico) {
        const opts = ['<option value="">Selecione...</option>'];
        (professionals || []).filter(p => String(p.tipo || '').toLowerCase() === 'protetico').forEach(p => {
            opts.push(`<option value="${p.id}">${escapeHtml(String(p.seqid || ''))} - ${escapeHtml(String(p.nome || ''))}</option>`);
        });
        proteseProtetico.innerHTML = opts.join('');
    }

    if (currentProteseOrderId) {
        const local = (proteseOrders || []).find(o => String(o.id) === currentProteseOrderId);
        let o = local;
        if (!o) {
            const q = db.from('ordens_proteticas').select('*').eq('empresa_id', currentEmpresaId).eq('id', currentProteseOrderId).single();
            const { data, error } = await withTimeout(q, 15000, 'ordens_proteticas:single');
            if (error) throw error;
            o = data;
        }
        if (modalProteseTitle) modalProteseTitle.textContent = `Ordem Protética #${o.seqid || ''}`;
        if (protesePaciente) protesePaciente.value = o.paciente_id || '';
        if (proteseTipoExecucao) proteseTipoExecucao.value = o.tipo_execucao || 'EXTERNA';
        if (proteseLaboratorio) proteseLaboratorio.value = o.laboratorio_id || '';
        if (proteseProtetico) proteseProtetico.value = o.protetico_id != null ? String(o.protetico_id) : '';
        if (protesePrazo) protesePrazo.value = o.prazo_previsto ? String(o.prazo_previsto).slice(0, 10) : '';
        if (protesePrioridade) protesePrioridade.value = o.prioridade || 'NORMAL';
        if (proteseTipoExecucao) proteseTipoExecucao.dataset.orcamentoId = o.orcamento_id || '';
        if (proteseTipoExecucao) proteseTipoExecucao.dataset.itemId = o.orcamento_item_id || '';
        if (proteseOrcamentoSeqid) {
            const seqLocal = getBudgetSeqIdById(o.orcamento_id);
            proteseOrcamentoSeqid.value = (seqLocal != null) ? String(seqLocal) : '';
            if (seqLocal == null && o.orcamento_id) {
                resolveBudgetSeqidFromDb(o.orcamento_id).then(seqDb => {
                    if (seqDb != null && currentProteseOrderId && String(currentProteseOrderId) === String(o.id)) {
                        proteseOrcamentoSeqid.value = String(seqDb);
                    }
                });
            }
        }
        syncProteseExecutorFields();
        await loadProteseTimeline(currentProteseOrderId);
        await loadProteseAnexos(currentProteseOrderId);
    } else {
        if (modalProteseTitle) modalProteseTitle.textContent = 'Nova Ordem Protética';
        if (protesePaciente) protesePaciente.value = pacienteId || '';
        if (proteseTipoExecucao) proteseTipoExecucao.value = 'EXTERNA';
        if (proteseLaboratorio) proteseLaboratorio.value = '';
        if (proteseProtetico) proteseProtetico.value = '';
        if (protesePrazo) protesePrazo.value = '';
        if (protesePrioridade) protesePrioridade.value = 'NORMAL';
        if (proteseTipoExecucao) proteseTipoExecucao.dataset.orcamentoId = orcamentoId || '';
        if (proteseTipoExecucao) proteseTipoExecucao.dataset.itemId = itemId || '';
        if (proteseOrcamentoSeqid) {
            const seqLocal = getBudgetSeqIdById(orcamentoId);
            proteseOrcamentoSeqid.value = (seqLocal != null) ? String(seqLocal) : '';
            if (seqLocal == null && orcamentoId) {
                resolveBudgetSeqidFromDb(orcamentoId).then(seqDb => {
                    if (seqDb != null && !currentProteseOrderId) {
                        proteseOrcamentoSeqid.value = String(seqDb);
                    }
                });
            }
        }
        syncProteseExecutorFields();
        if (proteseTimeline) proteseTimeline.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Salve a OP para iniciar o histórico.</div>';
        if (proteseAnexosList) proteseAnexosList.innerHTML = '<div style="text-align:center; padding: 0.75rem; color: var(--text-muted);">Salve a OP para anexar arquivos.</div>';
        if (proteseAnexoFile) proteseAnexoFile.value = '';
    }

    if (proteseTipoExecucao && !proteseTipoExecucao.dataset.bound) {
        proteseTipoExecucao.addEventListener('change', syncProteseExecutorFields);
        proteseTipoExecucao.dataset.bound = '1';
    }

    if (proteseOrcamentoSeqid && !proteseOrcamentoSeqid.dataset.bound) {
        let t = null;
        const applyTypedBudget = async () => {
            const raw = String(proteseOrcamentoSeqid.value || '').trim();
            if (!proteseTipoExecucao) return;
            if (!raw) {
                proteseTipoExecucao.dataset.orcamentoId = '';
                return;
            }
            const n = Number(raw);
            if (!Number.isFinite(n) || n <= 0) return;
            const id = await resolveBudgetIdFromSeqid(n);
            if (!id) return;
            proteseTipoExecucao.dataset.orcamentoId = id;
        };
        proteseOrcamentoSeqid.addEventListener('input', () => {
            if (t) clearTimeout(t);
            t = setTimeout(() => { applyTypedBudget(); }, 280);
        });
        proteseOrcamentoSeqid.addEventListener('blur', async () => {
            if (!proteseTipoExecucao) return;
            const raw = String(proteseOrcamentoSeqid.value || '').trim();
            if (!raw) return;
            const n = Number(raw);
            if (!Number.isFinite(n) || n <= 0) return;
            const id = await resolveBudgetIdFromSeqid(n);
            if (!id) {
                showToast('Orçamento não encontrado.', true);
                return;
            }
            proteseTipoExecucao.dataset.orcamentoId = id;
        });
        proteseOrcamentoSeqid.dataset.bound = '1';
    }

    if (btnProteseSave && !btnProteseSave.dataset.bound) {
        btnProteseSave.addEventListener('click', saveProteseOrderFromModal);
        btnProteseSave.dataset.bound = '1';
    }
    if (btnProtesePrint && !btnProtesePrint.dataset.bound) {
        btnProtesePrint.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentProteseOrderId) { showToast('Salve a OP antes de imprimir.', true); return; }
            await printProteseOrder(currentProteseOrderId);
        });
        btnProtesePrint.dataset.bound = '1';
    }
    if (btnCloseModalProtese && !btnCloseModalProtese.dataset.bound) {
        btnCloseModalProtese.addEventListener('click', closeProteseModal);
        btnCloseModalProtese.dataset.bound = '1';
    }
    if (btnProteseCancel && !btnProteseCancel.dataset.bound) {
        btnProteseCancel.addEventListener('click', closeProteseModal);
        btnProteseCancel.dataset.bound = '1';
    }
    if (modalProtese && !modalProtese.dataset.bound) {
        modalProtese.addEventListener('click', (e) => { if (e.target === modalProtese) closeProteseModal(); });
        modalProtese.dataset.bound = '1';
    }
    if (btnProteseAnexoUpload && !btnProteseAnexoUpload.dataset.bound) {
        btnProteseAnexoUpload.addEventListener('click', async (e) => { e.preventDefault(); await uploadProteseAnexo(); });
        btnProteseAnexoUpload.dataset.bound = '1';
    }

    const bindEventBtn = (btn, eventType, phase, status) => {
        if (!btn || btn.dataset.bound) return;
        btn.addEventListener('click', async () => { await addProteseEvent(eventType, phase, status); });
        btn.dataset.bound = '1';
    };
    bindEventBtn(btnProteseEventSend, 'ENVIO', 'ENVIADA', null);
    bindEventBtn(btnProteseEventReceive, 'RECEBIMENTO', 'RECEBIDA', null);
    bindEventBtn(btnProteseEventTryIn, 'PROVA_PACIENTE', 'PROVA_PACIENTE', null);
    bindEventBtn(btnProteseEventApprove, 'APROVACAO', 'APROVADA', null);
    bindEventBtn(btnProteseEventReprove, 'REPROVACAO', 'REPROVADA', 'PAUSADA');
    bindEventBtn(btnProteseEventClose, 'ENCERRAMENTO', 'ENCERRADA', 'CONCLUIDA');

    if (btnProteseCustodia) {
        updateProteseCustodiaButtonState();
        if (!btnProteseCustodia.dataset.bound) {
            btnProteseCustodia.addEventListener('click', async (e) => {
                e.preventDefault();
                await openProteseCustodiaModal();
            });
            btnProteseCustodia.dataset.bound = '1';
        }
    }

    if (btnCloseProteseCustodiaModal && !btnCloseProteseCustodiaModal.dataset.bound) {
        btnCloseProteseCustodiaModal.addEventListener('click', proteseCustodiaCloseModal);
        btnCloseProteseCustodiaModal.dataset.bound = '1';
    }
    if (btnCloseProteseCustodiaModal2 && !btnCloseProteseCustodiaModal2.dataset.bound) {
        btnCloseProteseCustodiaModal2.addEventListener('click', proteseCustodiaCloseModal);
        btnCloseProteseCustodiaModal2.dataset.bound = '1';
    }
    if (proteseCustodiaModal && !proteseCustodiaModal.dataset.bound) {
        proteseCustodiaModal.addEventListener('click', (e) => { if (e.target === proteseCustodiaModal) proteseCustodiaCloseModal(); });
        proteseCustodiaModal.dataset.bound = '1';
    }

    modalProtese.classList.remove('hidden');
}

function closeProteseModal() {
    if (modalProtese) modalProtese.classList.add('hidden');
    currentProteseOrderId = null;
}

async function deleteProteseOrder(orderId) {
    if (!orderId) return;
    if (!confirm('Deseja excluir esta OP?')) return;
    try {
        const { error } = await withTimeout(
            db.from('ordens_proteticas').delete().eq('empresa_id', currentEmpresaId).eq('id', String(orderId)),
            20000,
            'ordens_proteticas:delete'
        );
        if (error) throw error;
        proteseOrders = (proteseOrders || []).filter(o => String(o.id) !== String(orderId));
        applyProteseFiltersAndRender();
        showToast('OP excluída.');
    } catch (err) {
        console.error('Erro ao excluir OP:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao excluir OP (${code}): ${msg}`, true);
    }
}

async function saveProteseOrderFromModal() {
    try {
        const pacienteId = protesePaciente ? String(protesePaciente.value || '') : '';
        const tipoExec = proteseTipoExecucao ? String(proteseTipoExecucao.value || 'EXTERNA') : 'EXTERNA';
        const labId = proteseLaboratorio ? String(proteseLaboratorio.value || '') : '';
        const protId = proteseProtetico ? String(proteseProtetico.value || '') : '';
        const prazo = protesePrazo ? String(protesePrazo.value || '') : '';
        const prioridade = protesePrioridade ? String(protesePrioridade.value || 'NORMAL') : 'NORMAL';

        if (!pacienteId) { showToast('Selecione o paciente.', true); return; }
        if (tipoExec === 'EXTERNA' && !labId) { showToast('Selecione o laboratório.', true); return; }
        if (tipoExec === 'INTERNA' && !protId) { showToast('Selecione o protético interno.', true); return; }

        let orcamentoId = proteseTipoExecucao ? String(proteseTipoExecucao.dataset.orcamentoId || '') : '';
        const itemId = proteseTipoExecucao ? String(proteseTipoExecucao.dataset.itemId || '') : '';
        const orcSeqTyped = proteseOrcamentoSeqid ? String(proteseOrcamentoSeqid.value || '').trim() : '';
        if (!orcamentoId && orcSeqTyped) {
            const n = Number(orcSeqTyped);
            if (Number.isFinite(n) && n > 0) {
                const resolved = await resolveBudgetIdFromSeqid(n);
                if (!resolved) { showToast('Orçamento não encontrado.', true); return; }
                orcamentoId = resolved;
                if (proteseTipoExecucao) proteseTipoExecucao.dataset.orcamentoId = resolved;
            }
        }

        if (currentProteseOrderId) {
            const payload = {
                paciente_id: pacienteId,
                orcamento_id: orcamentoId || null,
                orcamento_item_id: itemId || null,
                tipo_execucao: tipoExec,
                laboratorio_id: tipoExec === 'EXTERNA' ? (labId || null) : null,
                protetico_id: tipoExec === 'INTERNA' ? (protId || null) : null,
                prazo_previsto: prazo || null,
                prioridade,
                updated_at: new Date().toISOString()
            };
            const q = db.from('ordens_proteticas').update(payload).eq('empresa_id', currentEmpresaId).eq('id', currentProteseOrderId);
            const { error } = await withTimeout(q, 15000, 'ordens_proteticas:update');
            if (error) throw error;
            await fetchProteseFromUI(true);
            showToast('OP atualizada.');
            closeProteseModal();
            return;
        }

        const pData = {
            empresa_id: currentEmpresaId,
            paciente_id: pacienteId,
            orcamento_id: orcamentoId || null,
            orcamento_item_id: itemId || null,
            tipo_execucao: tipoExec,
            protetico_id: tipoExec === 'INTERNA' ? protId : null,
            laboratorio_id: tipoExec === 'EXTERNA' ? labId : null,
            prioridade,
            prazo_previsto: prazo || null,
            fase_atual: 'CRIADA',
            status_geral: 'EM_ANDAMENTO'
        };

        const { data, error } = await withTimeout(db.rpc('rpc_create_ordem_protetica', { p_data: pData }), 15000, 'rpc_create_ordem_protetica');
        if (error) throw error;
        const created = Array.isArray(data) ? data[0] : data;
        currentProteseOrderId = created && created.id ? String(created.id) : null;

        if (created && created.id) {
            const keep = (proteseOrders || []).filter(o => String(o.id) !== String(created.id));
            proteseOrders = [created, ...keep];
        }

        resetProteseFilters();
        await fetchProteseFromUI(true);
        showToast('OP criada.');
        if (currentProteseOrderId) {
            await addProteseEvent('CRIACAO', 'CRIADA', null, true);
        }
        closeProteseModal();
    } catch (err) {
        console.error('Erro ao salvar OP:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao salvar OP (${code}): ${msg}`, true);
    }
}

async function addProteseEvent(tipoEvento, faseResultante, statusResultante, silent = false) {
    if (!currentProteseOrderId) { showToast('Salve a OP antes de registrar eventos.', true); return; }
    const o = (proteseOrders || []).find(x => String(x.id) === String(currentProteseOrderId));
    const tipoExec = proteseTipoExecucao ? String(proteseTipoExecucao.value || (o && o.tipo_execucao) || 'EXTERNA') : ((o && o.tipo_execucao) || 'EXTERNA');
    const note = proteseNota ? String(proteseNota.value || '').trim() : '';

    const deLocal = 'Clínica';
    let paraLocal = '';
    if (tipoExec === 'EXTERNA') {
        const labId = proteseLaboratorio ? String(proteseLaboratorio.value || (o && o.laboratorio_id) || '') : String(o && o.laboratorio_id || '');
        paraLocal = getLaboratorioNameById(labId);
    } else {
        const pId = proteseProtetico ? String(proteseProtetico.value || (o && o.protetico_id) || '') : String(o && o.protetico_id || '');
        paraLocal = getProteticoNameById(pId);
    }

    const evPayload = {
        empresa_id: currentEmpresaId,
        ordem_id: currentProteseOrderId,
        tipo_evento: tipoEvento,
        fase_resultante: faseResultante || null,
        de_local: deLocal,
        para_local: paraLocal || null,
        nota: note || null
    };

    try {
        const { error } = await withTimeout(db.from('ordens_proteticas_eventos').insert(evPayload), 15000, 'ordens_proteticas_eventos:insert');
        if (error) throw error;

        const up = {
            fase_atual: faseResultante || 'CRIADA',
            updated_at: new Date().toISOString()
        };
        if (statusResultante) up.status_geral = statusResultante;
        await withTimeout(db.from('ordens_proteticas').update(up).eq('empresa_id', currentEmpresaId).eq('id', currentProteseOrderId), 15000, 'ordens_proteticas:update_fase');

        if (proteseNota) proteseNota.value = '';
        await fetchProteseFromUI(true);
        await loadProteseTimeline(currentProteseOrderId);
        if (!silent) showToast('Evento registrado.');
    } catch (err) {
        console.error('Erro ao registrar evento:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao registrar evento (${code}): ${msg}`, true);
    }
}

function openProteseLabsModal() {
    if (!modalProteseLabs) return;
    if (proteseLabId) proteseLabId.value = '';
    if (proteseLabNome) proteseLabNome.value = '';
    if (proteseLabContato) proteseLabContato.value = '';
    if (proteseLabPrazo) proteseLabPrazo.value = '';
    if (proteseLabAtivo) proteseLabAtivo.value = 'true';
    renderProteseLabsTable();
    modalProteseLabs.classList.remove('hidden');

    if (btnCloseModalProteseLabs && !btnCloseModalProteseLabs.dataset.bound) {
        btnCloseModalProteseLabs.addEventListener('click', closeProteseLabsModal);
        btnCloseModalProteseLabs.dataset.bound = '1';
    }
    if (btnProteseLabsClose && !btnProteseLabsClose.dataset.bound) {
        btnProteseLabsClose.addEventListener('click', closeProteseLabsModal);
        btnProteseLabsClose.dataset.bound = '1';
    }
    if (modalProteseLabs && !modalProteseLabs.dataset.bound) {
        modalProteseLabs.addEventListener('click', (e) => { if (e.target === modalProteseLabs) closeProteseLabsModal(); });
        modalProteseLabs.dataset.bound = '1';
    }
    if (btnProteseLabSave && !btnProteseLabSave.dataset.bound) {
        btnProteseLabSave.addEventListener('click', async () => { await saveProteseLab(); });
        btnProteseLabSave.dataset.bound = '1';
    }
}

function closeProteseLabsModal() {
    if (modalProteseLabs) modalProteseLabs.classList.add('hidden');
}

function renderProteseLabsTable() {
    if (!proteseLabsBody) return;
    proteseLabsBody.innerHTML = '';
    const list = (proteseLabs || []).slice().sort((a, b) => Number(a.seqid || 0) - Number(b.seqid || 0));
    if (!list.length) {
        if (proteseLabsBody.parentElement) proteseLabsBody.parentElement.style.display = 'none';
        if (proteseLabsEmpty) proteseLabsEmpty.classList.remove('hidden');
        return;
    }
    if (proteseLabsBody.parentElement) proteseLabsBody.parentElement.style.display = 'table';
    if (proteseLabsEmpty) proteseLabsEmpty.classList.add('hidden');

    list.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(String(l.seqid || ''))}</td>
            <td><strong>${escapeHtml(String(l.nome || ''))}</strong></td>
            <td>${escapeHtml(String(l.contato || ''))}</td>
            <td>${escapeHtml(l.prazo_padrao_dias != null ? `${l.prazo_padrao_dias}d` : '')}</td>
            <td>${l.ativo === false ? 'Não' : 'Sim'}</td>
            <td class="actions-cell">
                <button class="btn-icon" data-action="edit" data-id="${l.id}" title="Editar"><i class="ri-edit-line"></i></button>
            </td>
        `;
        proteseLabsBody.appendChild(tr);
    });

    proteseLabsBody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const l = (proteseLabs || []).find(x => String(x.id) === String(id));
            if (!l) return;
            if (proteseLabId) proteseLabId.value = l.id;
            if (proteseLabNome) proteseLabNome.value = l.nome || '';
            if (proteseLabContato) proteseLabContato.value = l.contato || '';
            if (proteseLabPrazo) proteseLabPrazo.value = l.prazo_padrao_dias != null ? String(l.prazo_padrao_dias) : '';
            if (proteseLabAtivo) proteseLabAtivo.value = l.ativo === false ? 'false' : 'true';
        });
    });
}

async function saveProteseLab() {
    const id = proteseLabId ? String(proteseLabId.value || '') : '';
    const nome = proteseLabNome ? String(proteseLabNome.value || '').trim() : '';
    const contato = proteseLabContato ? String(proteseLabContato.value || '').trim() : '';
    const prazo = proteseLabPrazo ? String(proteseLabPrazo.value || '').trim() : '';
    const ativo = proteseLabAtivo ? String(proteseLabAtivo.value || 'true') : 'true';

    if (!nome) { showToast('Informe o nome do laboratório.', true); return; }

    try {
        if (id) {
            const payload = {
                nome,
                contato: contato || null,
                prazo_padrao_dias: prazo ? (parseInt(prazo, 10) || 0) : null,
                ativo: ativo === 'true'
            };
            const q = db.from('laboratorios_proteticos').update(payload).eq('empresa_id', currentEmpresaId).eq('id', id);
            const { error } = await withTimeout(q, 15000, 'laboratorios_proteticos:update');
            if (error) throw error;
            showToast('Laboratório atualizado.');
        } else {
            const pData = {
                empresa_id: currentEmpresaId,
                nome,
                contato: contato || null,
                prazo_padrao_dias: prazo ? (parseInt(prazo, 10) || 0) : null,
                ativo
            };
            const { error } = await withTimeout(db.rpc('rpc_create_laboratorio_protetico', { p_data: pData }), 15000, 'rpc_create_laboratorio_protetico');
            if (error) throw error;
            showToast('Laboratório criado.');
        }
        await loadProteseLabs(true);
        renderProteseLabsTable();
        if (proteseLabId) proteseLabId.value = '';
        if (proteseLabNome) proteseLabNome.value = '';
        if (proteseLabContato) proteseLabContato.value = '';
        if (proteseLabPrazo) proteseLabPrazo.value = '';
        if (proteseLabAtivo) proteseLabAtivo.value = 'true';
    } catch (err) {
        console.error('Erro ao salvar laboratório:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao salvar laboratório (${code}): ${msg}`, true);
    }
}

function initCommissionsFilters() {
    if (commProfessional && commProfessional.options.length <= 1) {
        const opts = ['<option value="">Todos os profissionais</option>'];
        (professionals || [])
            .slice()
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                opts.push(`<option value="${p.seqid}">${p.nome}</option>`);
            });
        commProfessional.innerHTML = opts.join('');
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const firstDayStr = `${yyyy}-${mm}-01`;

    if (commStart && !commStart.value) commStart.value = firstDayStr;
    if (commEnd && !commEnd.value) commEnd.value = todayStr;
}

function initDashboardFilters() {
    if (dashProfessional) {
        const opts = ['<option value="">Todos</option>'];
        (professionals || [])
            .slice()
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                opts.push(`<option value="${p.seqid}">${p.nome}</option>`);
            });
        dashProfessional.innerHTML = opts.join('');
    }

    if (dashDate && !dashDate.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dashDate.value = `${yyyy}-${mm}-${dd}`;
    }

    if (dashFinanceCard) {
        dashFinanceCard.style.display = can('financeiro', 'select') ? '' : 'none';
    }
}

function renderDashboardPlaceholder() {
    if (kpiAgendados) kpiAgendados.textContent = '—';
    if (kpiAgendadosSub) kpiAgendadosSub.textContent = '—';
    if (kpiRecebido) kpiRecebido.textContent = '—';
    if (kpiRecebidoSub) kpiRecebidoSub.textContent = '—';
    if (kpiOrcamentosHoje) kpiOrcamentosHoje.textContent = '—';
    if (kpiOrcamentosHojeSub) kpiOrcamentosHojeSub.textContent = '—';
    if (kpiPacientesHoje) kpiPacientesHoje.textContent = '—';
    if (kpiPacientesHojeSub) kpiPacientesHojeSub.textContent = '—';
    if (dashAgendaSummary) dashAgendaSummary.textContent = '—';
    if (dashAgendaBody) dashAgendaBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Use os filtros e clique em “Atualizar”.</td></tr>';
    if (dashAgendaEmpty) dashAgendaEmpty.classList.add('hidden');
    if (dashFinanceSummary) dashFinanceSummary.textContent = '—';
    if (dashPaymentsChart) dashPaymentsChart.innerHTML = '';
    if (dashPaymentsBody) dashPaymentsBody.innerHTML = '';
    if (dashPaymentsEmpty) dashPaymentsEmpty.classList.add('hidden');
    if (kpiCancelamentosHoje) kpiCancelamentosHoje.textContent = '—';
    if (kpiComissoesAPagar) kpiComissoesAPagar.textContent = '—';
    if (kpiTicketMedio) kpiTicketMedio.textContent = '—';
}

function fmtMoney(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeFormaPagamento(v) {
    const s = String(v || '').trim();
    const k = normalizeKey(s);
    if (!k) return 'Não informado';
    if (k === 'PIX') return 'PIX';
    if (k === 'CARTAODEBITO' || k === 'CARTAODEBITO' || k === 'CARTAO DEBITO') return 'Cartão Débito';
    if (k === 'CARTAODECREDITO' || k === 'CARTAODECREDITO' || k === 'CARTAO DE CREDITO') return 'Cartão de Crédito';
    if (k === 'CARTAO') return 'Cartão';
    if (k === 'DINHEIRO') return 'Dinheiro';
    if (k === 'BOLETO') return 'Boleto';
    if (k === 'CHEQUE') return 'Cheque';
    if (k === 'SALDOEMCONTA') return 'Saldo em Conta';
    return s;
}

function renderBarChart(containerEl, items, { valueKey = 'total', labelKey = 'label' } = {}) {
    if (!containerEl) return;
    const data = (items || []).slice().filter(x => x && Number(x[valueKey] || 0) > 0);
    if (!data.length) {
        containerEl.innerHTML = '';
        return;
    }
    const max = Math.max(...data.map(x => Number(x[valueKey] || 0)));
    const rows = data.map(x => {
        const v = Number(x[valueKey] || 0);
        const pct = max ? Math.round((v / max) * 100) : 0;
        return `
            <div style="display:flex; align-items:center; gap:10px; margin: 8px 0;">
                <div style="width: 140px; min-width: 140px; font-weight:700; color: var(--text-main);">${escapeHtml(String(x[labelKey] || ''))}</div>
                <div style="flex: 1; height: 10px; background: #eef2f7; border-radius: 999px; overflow: hidden;">
                    <div style="width:${pct}%; height: 100%; background: var(--primary-color);"></div>
                </div>
                <div style="width: 120px; min-width: 120px; text-align:right; font-weight:800;">${escapeHtml(fmtMoney(v))}</div>
            </div>
        `;
    }).join('');
    containerEl.innerHTML = rows;
}

async function fetchDashboardFromUI() {
    if (!dashDate) return;
    const dateStr = dashDate.value;
    const profSeqId = dashProfessional ? String(dashProfessional.value || '') : '';
    if (!dateStr) return;
    await fetchDashboardData({ dateStr, profSeqId: profSeqId ? Number(profSeqId) : null });
}

async function fetchDashboardData({ dateStr, profSeqId }) {
    try {
        if (!currentEmpresaId) return;

        const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
        const canFinance = can('financeiro', 'select');

        let agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .gte('inicio', startIso)
            .lte('inicio', endIso)
            .order('inicio', { ascending: true });
        if (profSeqId) agQ = agQ.eq('profissional_id', profSeqId);

        const agP = withTimeout(agQ, 15000, 'dash:agenda_agendamentos');

        const budCountP = withTimeout(
            db.from('orcamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).gte('created_at', startIso).lte('created_at', endIso),
            15000,
            'dash:orcamentos_count'
        );
        const patCountP = withTimeout(
            db.from('pacientes').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).gte('created_at', startIso).lte('created_at', endIso),
            15000,
            'dash:pacientes_count'
        );
        const cancelCountP = canFinance
            ? withTimeout(
                db.from('orcamento_cancelados').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).gte('data_cancelamento', startIso).lte('data_cancelamento', endIso),
                15000,
                'dash:cancelados_count'
            )
            : Promise.resolve({ count: null, data: null, error: null });

        const commP = canFinance
            ? withTimeout(
                db.from('financeiro_comissoes').select('valor_comissao, status').eq('empresa_id', currentEmpresaId),
                15000,
                'dash:comissoes'
            )
            : Promise.resolve({ data: [], error: null });

        const finP = canFinance
            ? withTimeout(
                db.from('financeiro_transacoes')
                    .select('id, valor, tipo, categoria, forma_pagamento, data_transacao, observacoes')
                    .eq('empresa_id', currentEmpresaId)
                    .eq('categoria', 'PAGAMENTO')
                    .eq('tipo', 'CREDITO')
                    .gte('data_transacao', startIso)
                    .lte('data_transacao', endIso)
                    .order('data_transacao', { ascending: true }),
                15000,
                'dash:financeiro_transacoes'
            )
            : Promise.resolve({ data: [], error: null });

        const [agRes, budCount, patCount, cancelCount, commRes, finRes] = await Promise.all([agP, budCountP, patCountP, cancelCountP, commP, finP]);
        if (agRes?.error) throw agRes.error;
        if (budCount?.error) throw budCount.error;
        if (patCount?.error) throw patCount.error;
        if (cancelCount?.error) throw cancelCount.error;
        if (commRes?.error) throw commRes.error;
        if (finRes?.error) throw finRes.error;

        const ags = agRes?.data || [];
        const agValid = ags.filter(a => String(a.status || '') !== 'CANCELADO');
        if (kpiAgendados) kpiAgendados.textContent = String(agValid.length);
        if (kpiAgendadosSub) kpiAgendadosSub.textContent = profSeqId ? `Profissional: ${getProfessionalNameBySeqId(profSeqId)}` : 'Todos os profissionais';

        if (dashAgendaSummary) {
            dashAgendaSummary.textContent = `${formatDateBR(dateStr)} • ${agValid.length} agendamentos`;
        }
        if (dashAgendaBody) {
            dashAgendaBody.innerHTML = '';
            if (!agValid.length) {
                if (dashAgendaEmpty) dashAgendaEmpty.classList.remove('hidden');
                dashAgendaBody.innerHTML = '';
            } else {
                if (dashAgendaEmpty) dashAgendaEmpty.classList.add('hidden');
                agValid.forEach(a => {
                    const hora = a.inicio ? formatTimeHHMM(new Date(a.inicio)) : '--:--';
                    const paciente = a.paciente_id ? (getPacienteDetailsBySeqId(a.paciente_id)?.nome || `Paciente #${a.paciente_id}`) : (a.titulo || '(Sem paciente)');
                    const prof = a.profissional_id ? getProfessionalNameBySeqId(a.profissional_id) : '-';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="font-weight:800;">${escapeHtml(hora)}</td>
                        <td>${escapeHtml(String(paciente || '-'))}</td>
                        <td>${escapeHtml(String(prof || '-'))}</td>
                        <td>${escapeHtml(String(a.status || 'MARCADO'))}</td>
                    `;
                    dashAgendaBody.appendChild(tr);
                });
            }
        }

        const budTotal = Number(budCount?.count || 0);
        const patTotal = Number(patCount?.count || 0);
        if (kpiOrcamentosHoje) kpiOrcamentosHoje.textContent = String(budTotal);
        if (kpiOrcamentosHojeSub) kpiOrcamentosHojeSub.textContent = `Data: ${formatDateBR(dateStr)}`;
        if (kpiPacientesHoje) kpiPacientesHoje.textContent = String(patTotal);
        if (kpiPacientesHojeSub) kpiPacientesHojeSub.textContent = `Data: ${formatDateBR(dateStr)}`;

        const finRows = finRes?.data || [];
        const recebido = finRows.reduce((acc, r) => acc + Number(r.valor || 0), 0);
        if (kpiRecebido) kpiRecebido.textContent = canFinance ? fmtMoney(recebido) : '—';
        if (kpiRecebidoSub) {
            const qtde = finRows.length;
            kpiRecebidoSub.textContent = canFinance ? `${qtde} lançamentos` : 'Sem acesso ao financeiro';
        }

        if (dashFinanceSummary) {
            dashFinanceSummary.textContent = canFinance ? `${formatDateBR(dateStr)} • ${fmtMoney(recebido)}` : 'Sem acesso ao financeiro';
        }

        if (canFinance) {
            const byForma = new Map();
            finRows.forEach(r => {
                const label = normalizeFormaPagamento(r.forma_pagamento);
                const cur = byForma.get(label) || { label, total: 0, count: 0 };
                cur.total += Number(r.valor || 0);
                cur.count += 1;
                byForma.set(label, cur);
            });
            const formas = Array.from(byForma.values()).sort((a, b) => b.total - a.total);

            renderBarChart(dashPaymentsChart, formas, { valueKey: 'total', labelKey: 'label' });

            if (dashPaymentsBody) {
                dashPaymentsBody.innerHTML = '';
                if (!formas.length) {
                    if (dashPaymentsEmpty) dashPaymentsEmpty.classList.remove('hidden');
                } else {
                    if (dashPaymentsEmpty) dashPaymentsEmpty.classList.add('hidden');
                    formas.forEach(f => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="font-weight:700;">${escapeHtml(f.label)}</td>
                            <td style="text-align:right; font-weight:800;">${escapeHtml(fmtMoney(f.total))}</td>
                            <td style="text-align:right;">${escapeHtml(String(f.count))}</td>
                        `;
                        dashPaymentsBody.appendChild(tr);
                    });
                }
            }

            const canc = Number(cancelCount?.count || 0);
            if (kpiCancelamentosHoje) kpiCancelamentosHoje.textContent = String(canc);

            const comms = commRes?.data || [];
            const commToPay = comms.filter(c => {
                const st = String(c.status || '');
                return st === 'PENDENTE' || st === 'GERADA';
            });
            const commSum = commToPay.reduce((acc, c) => acc + Number(c.valor_comissao || 0), 0);
            if (kpiComissoesAPagar) kpiComissoesAPagar.textContent = fmtMoney(commSum);

            const ticket = finRows.length ? (recebido / finRows.length) : 0;
            if (kpiTicketMedio) kpiTicketMedio.textContent = fmtMoney(ticket);
        }
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao carregar Dashboard (${code}): ${msg}`, true);
    }
}

function initAtendimentoFilters() {
    if (atendimentoProfessional) {
        const opts = ['<option value="">Selecione...</option>'];
        (professionals || [])
            .slice()
            .filter(p => (String(p.tipo || '').toLowerCase() !== 'protetico'))
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                opts.push(`<option value="${p.seqid}">${p.nome}</option>`);
            });
        atendimentoProfessional.innerHTML = opts.join('');
    }

    if (atendimentoDate && !atendimentoDate.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        atendimentoDate.value = `${yyyy}-${mm}-${dd}`;
    }

    const shouldAuto = currentUserRole === 'dentista';
    if (atendimentoProfessionalGroup) atendimentoProfessionalGroup.style.display = shouldAuto ? 'none' : '';

    if (shouldAuto && atendimentoProfessional && !atendimentoProfessional.value) {
        const uEmail = String(currentUser?.email || '').trim().toLowerCase();
        const prof = (professionals || []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
        if (prof && prof.seqid) {
            atendimentoProfessional.value = String(prof.seqid);
        } else {
            if (atendimentoProfessionalGroup) atendimentoProfessionalGroup.style.display = '';
        }
    }
}

function renderAtendimentoPlaceholder(msg = 'Selecione a data e o profissional.') {
    if (atendimentoBody) {
        atendimentoBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">${msg}</td></tr>`;
    }
    if (atendimentoEmptyState) atendimentoEmptyState.classList.add('hidden');
    if (atendimentoSummary) atendimentoSummary.textContent = '—';
}

async function fetchAtendimentoForUI() {
    if (!atendimentoDate || !atendimentoProfessional) return;
    const dateStr = atendimentoDate.value;
    let profSeqId = atendimentoProfessional.value;

    if (!dateStr) {
        renderAtendimentoPlaceholder();
        return;
    }

    if (!profSeqId && currentUserRole === 'dentista') {
        const uEmail = String(currentUser?.email || '').trim().toLowerCase();
        const prof = (professionals || []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
        if (prof && prof.seqid) {
            atendimentoProfessional.value = String(prof.seqid);
            profSeqId = atendimentoProfessional.value;
        }
    }

    if (!profSeqId) {
        renderAtendimentoPlaceholder();
        return;
    }

    await fetchAtendimentoDay({ empresaId: currentEmpresaId, profSeqId: Number(profSeqId), dateStr });
}

async function fetchAtendimentoDay({ empresaId, profSeqId, dateStr }) {
    try {
        if (!empresaId) {
            renderAtendimentoPlaceholder('Empresa não definida.');
            return;
        }
        if (atendimentoBody) {
            atendimentoBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (atendimentoEmptyState) atendimentoEmptyState.classList.add('hidden');

        const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
        const agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .gte('inicio', startIso)
            .lte('inicio', endIso)
            .order('inicio', { ascending: true });
        const { data: ags, error: agErr } = await withTimeout(agQ, 15000, 'agenda_agendamentos:atendimento');
        if (agErr) throw agErr;

        const agendamentos = (ags || []).filter(a => String(a.status || '') !== 'CANCELADO');
        const byPaciente = new Map();
        agendamentos.forEach(a => {
            if (!a.paciente_id) return;
            const k = String(a.paciente_id);
            if (!byPaciente.has(k)) byPaciente.set(k, []);
            byPaciente.get(k).push(a);
        });
        byPaciente.forEach((list, k) => {
            list.sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || '')));
        });

        const itemsRows = [];
        const agWithoutItems = [];
        byPaciente.forEach((list, pacienteSeqIdStr) => {
            const paciente = getPacienteDetailsBySeqId(pacienteSeqIdStr);
            const pacienteUuid = paciente?.id || null;
            if (!pacienteUuid) return;

            const patientBudgets = (budgets || []).filter(b => String(b.pacienteid || b.paciente_id || '') === String(pacienteUuid));
            const firstAg = list[0];
            const hora = firstAg && firstAg.inicio ? formatTimeHHMM(new Date(firstAg.inicio)) : '--:--';
            const agId = firstAg && firstAg.id ? String(firstAg.id) : '';

            const matched = [];
            let hasMatchButNotEligible = false;
            patientBudgets.forEach(b => {
                const itens = (b.orcamento_itens || b.itens || []);
                const tipoKey = normalizeKey(String(b.tipo || 'Normal'));
                const isFreeBudget = tipoKey === 'CORTESIA' || tipoKey === 'RETRABALHO';
                itens.forEach(it => {
                    const executor = it.profissional_id ?? it.profissionalId ?? it.executor_id ?? it.executorId;
                    const execProf = findProfessionalByAnyId(executor);
                    const execSeqId = execProf && execProf.seqid != null ? String(execProf.seqid) : String(executor || '');
                    if (execSeqId !== String(profSeqId)) return;

                    const st = String(it.status || it.item_status || '').trim();
                    const stKey = normalizeStatusKey(st);
                    if (stKey === 'FINALIZADO' || stKey === 'CANCELADO') return;
                    const eligible = isFreeBudget || stKey === 'LIBERADO' || stKey === 'EMEXECUCAO';
                    if (!eligible) {
                        hasMatchButNotEligible = true;
                        return;
                    }

                    const serv = (services || []).find(s => String(s.id) === String(it.servico_id || it.servicoId || ''));
                    const desc = serv ? serv.descricao : (it.servicoDescricao || it.descricao || `#${it.servico_id || it.servicoId || it.id || ''}`);
                    const sub = String(it.subdivisao || it.sub_divisao || '').trim();
                    const itemLabel = sub ? `${desc} — ${sub}` : desc;

                    matched.push({
                        hora,
                        agendamentoId: agId,
                        paciente,
                        budget: b,
                        itemId: String(it.id || ''),
                        itemLabel,
                        itemStatus: it.status || '-'
                    });
                });
            });

            if (matched.length) {
                matched.forEach(m => itemsRows.push(m));
                return;
            }

            const budgetForOpen = patientBudgets.length ? patientBudgets[0] : null;
            const msg = patientBudgets.length
                ? (hasMatchButNotEligible ? 'Sem itens liberados para atendimento' : 'Sem itens para este profissional (verifique Executor)')
                : 'Sem orçamento para este paciente';
            itemsRows.push({
                hora,
                agendamentoId: agId,
                paciente,
                budget: budgetForOpen,
                itemId: '',
                itemLabel: msg,
                itemStatus: '—',
                isPlaceholder: true
            });
            agWithoutItems.push({ paciente, hora, msg });
        });

        itemsRows.sort((a, b) => a.hora.localeCompare(b.hora) || String(a.paciente?.nome || '').localeCompare(String(b.paciente?.nome || ''), 'pt-BR'));

        const profName = getProfessionalNameBySeqId(profSeqId);
        if (atendimentoSummary) {
            const placeholders = itemsRows.filter(r => r && r.isPlaceholder).length;
            const real = itemsRows.length - placeholders;
            const extra = placeholders ? ` • ${placeholders} agendamentos sem itens` : '';
            atendimentoSummary.textContent = `${profName} — ${dateStr.split('-').reverse().join('/')} • ${real} itens${extra}`;
        }

        if (!itemsRows.length) {
            if (atendimentoBody) atendimentoBody.innerHTML = '';
            if (atendimentoEmptyState) atendimentoEmptyState.classList.remove('hidden');
            return;
        }

        if (!atendimentoBody) return;
        atendimentoBody.innerHTML = '';
        itemsRows.forEach(r => {
            const tr = document.createElement('tr');
            if (r.isPlaceholder) tr.style.background = '#fff7ed';
            tr.innerHTML = `
                <td style="font-weight:800;">${escapeHtml(r.hora)}</td>
                <td style="font-weight:600;">${escapeHtml(r.paciente?.nome || '-')}</td>
                <td style="white-space: normal;">${escapeHtml(r.itemLabel || '-')}</td>
                <td style="text-align:center; font-weight:800;">${escapeHtml(String(r.budget?.seqid || '-'))}</td>
                <td>${escapeHtml(String(r.itemStatus || '-'))}</td>
                <td>
                    ${r.isPlaceholder ? '' : `<button class="btn btn-secondary btn-sm" data-action="finish" data-agendamento="${escapeHtml(r.agendamentoId || '')}" data-item="${escapeHtml(r.itemId || '')}"><i class="ri-flag-line"></i> Finalizar</button>`}
                    <button class="btn btn-secondary btn-sm" data-action="note" data-patient="${escapeHtml(r.paciente?.id || '')}" data-prof="${escapeHtml(String(profSeqId))}" data-date="${escapeHtml(dateStr)}" data-time="${escapeHtml(r.hora)}" data-budget="${escapeHtml(r.budget?.id || '')}" data-budgetseq="${escapeHtml(String(r.budget?.seqid || ''))}" data-item="${escapeHtml(r.itemId || '')}" data-itemlabel="${escapeHtml(r.itemLabel || '')}" data-agendamento="${escapeHtml(r.agendamentoId || '')}"><i class="ri-file-edit-line"></i> Evolução</button>
                    <button class="btn-icon" data-action="patient" data-patient="${escapeHtml(r.paciente?.id || '')}" title="Prontuário"><i class="ri-folder-user-line"></i></button>
                    ${r.budget && r.budget.id ? `<button class="btn-icon" data-action="budgetView" data-budget="${escapeHtml(r.budget?.id || '')}" title="Orçamento"><i class="ri-file-list-3-line"></i></button>` : ''}
                </td>
            `;
            atendimentoBody.appendChild(tr);
        });

        atendimentoBody.querySelectorAll('button[data-action="finish"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const agId = btn.getAttribute('data-agendamento') || '';
                const itemId = btn.getAttribute('data-item') || '';
                await confirmAtendimentoItem({ agendamentoId: agId, itemId, itemStatus: 'Finalizado' });
            });
        });
        atendimentoBody.querySelectorAll('button[data-action="note"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const patientId = btn.getAttribute('data-patient') || '';
                const profId = btn.getAttribute('data-prof') || '';
                const d = btn.getAttribute('data-date') || '';
                const t = btn.getAttribute('data-time') || '';
                const budgetId = btn.getAttribute('data-budget') || '';
                const budgetSeq = btn.getAttribute('data-budgetseq') || '';
                const itemId = btn.getAttribute('data-item') || '';
                const itemLabel = btn.getAttribute('data-itemlabel') || '';
                const agId = btn.getAttribute('data-agendamento') || '';
                openAtendimentoEvolucaoModal({ patientId, profSeqId: profId, dateStr: d, timeStr: t, budgetId, budgetSeq, itemId, itemLabel, agendamentoId: agId });
            });
        });
        atendimentoBody.querySelectorAll('button[data-action="patient"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-patient');
                if (id) {
                    window.__returnContext = {
                        tab: 'atendimento',
                        scrollY: window.scrollY || 0,
                        dateStr: atendimentoDate ? String(atendimentoDate.value || '') : '',
                        profSeqId: atendimentoProfessional ? String(atendimentoProfessional.value || '') : ''
                    };
                    showPatientDetails(id);
                }
            });
        });
        atendimentoBody.querySelectorAll('button[data-action="budgetView"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-budget');
                if (id) openBudgetItemsView(id);
            });
        });

        if (typeof window.__atendimentoRestoreScrollY === 'number') {
            const y = window.__atendimentoRestoreScrollY;
            window.__atendimentoRestoreScrollY = null;
            setTimeout(() => window.scrollTo(0, y), 60);
        }
    } catch (err) {
        console.error('Erro ao carregar atendimento:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        renderAtendimentoPlaceholder(`Falha ao carregar Atendimento (${code}).`);
        showToast(`Erro ao carregar Atendimento (${code}): ${msg}`, true);
    }
}

function returnFromPatientDetails() {
    const ctx = window.__returnContext;
    if (ctx && ctx.tab === 'atendimento') {
        setActiveTab('atendimento');
        if (atendimentoDate && ctx.dateStr) atendimentoDate.value = String(ctx.dateStr);
        if (atendimentoProfessional && ctx.profSeqId) atendimentoProfessional.value = String(ctx.profSeqId);
        window.__atendimentoRestoreScrollY = Number(ctx.scrollY || 0);
        fetchAtendimentoForUI();
        return;
    }
    showList('patients');
}

function openAtendimentoEvolucaoModal({ patientId, profSeqId, dateStr, timeStr, budgetId, budgetSeq, itemId, itemLabel, agendamentoId }) {
    if (!atendimentoEvolucaoModal) return;
    if (atEvoPacienteId) atEvoPacienteId.value = String(patientId || '');
    if (atEvoProfSeqId) atEvoProfSeqId.value = String(profSeqId || '');
    if (atEvoOrcamentoId) atEvoOrcamentoId.value = String(budgetId || '');
    if (atEvoItemId) atEvoItemId.value = String(itemId || '');
    if (atEvoAgendamentoId) atEvoAgendamentoId.value = String(agendamentoId || '');

    const profName = getProfessionalNameBySeqId(profSeqId);
    const resumo = [
        dateStr ? `Data: ${formatDateBR(dateStr)}` : '',
        timeStr ? `Hora: ${timeStr}` : '',
        profName ? `Profissional: ${profName}` : '',
        budgetSeq ? `Orçamento #${budgetSeq}` : '',
        itemLabel ? `Item: ${itemLabel}` : ''
    ].filter(Boolean).join(' • ');
    if (atEvoResumo) atEvoResumo.textContent = resumo || '—';
    if (atEvoTexto) atEvoTexto.value = '';

    atendimentoEvolucaoModal.classList.remove('hidden');
    setTimeout(() => { try { atEvoTexto?.focus(); } catch { } }, 50);
}

function closeAtendimentoEvolucaoModal() {
    if (atendimentoEvolucaoModal) atendimentoEvolucaoModal.classList.add('hidden');
}

async function saveAtendimentoEvolucao() {
    if (!can('atendimento', 'insert')) {
        showToast('Você não possui permissão para registrar evolução.', true);
        return;
    }
    const patientId = String(atEvoPacienteId?.value || '').trim();
    const profSeqId = String(atEvoProfSeqId?.value || '').trim();
    const budgetId = String(atEvoOrcamentoId?.value || '').trim();
    const itemId = String(atEvoItemId?.value || '').trim();
    const agendamentoId = String(atEvoAgendamentoId?.value || '').trim();
    const texto = String(atEvoTexto?.value || '').trim();

    if (!patientId) { showToast('Paciente não definido.', true); return; }
    if (texto.length < 3) { showToast('Preencha a evolução (mín. 3 caracteres).', true); return; }

    const profName = getProfessionalNameBySeqId(profSeqId);
    const profObj = (professionals || []).find(p => String(p.seqid) === String(profSeqId));
    const profUuid = profObj ? String(profObj.id || '') : '';

    const budgetObj = (budgets || []).find(b => String(b.id) === String(budgetId));
    const budgetSeq = budgetObj ? String(budgetObj.seqid || '') : '';

    const header = [
        '[ATENDIMENTO]',
        `Data/Hora: ${formatDateTime(new Date().toISOString())}`,
        profName ? `Profissional: ${profName}` : '',
        budgetSeq ? `Orçamento #${budgetSeq}` : '',
        itemId ? `Item ID: ${itemId}` : '',
        agendamentoId ? `Agendamento ID: ${agendamentoId}` : ''
    ].filter(Boolean).join('\n');

    const resumo = String(atEvoResumo?.textContent || '').trim();
    const descricao = `${header}\n\nResumo: ${resumo || '-'}\n\nEvolução:\n${texto}`;

    const payload = {
        paciente_id: patientId,
        profissional_id: profUuid || null,
        descricao,
        empresa_id: currentEmpresaId,
        created_by: currentUser?.id || null
    };

    try {
        const { error } = await withTimeout(db.from('paciente_evolucao').insert(payload), 15000, 'paciente_evolucao:insert');
        if (error) throw error;
        closeAtendimentoEvolucaoModal();
        showToast('Evolução registrada no prontuário.');
    } catch (err) {
        console.error('Erro ao salvar evolução:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao salvar evolução (${code}): ${msg}`, true);
    }
}

function openViewWindow(innerHtml, title = 'Visualização') {
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) { showToast('Habilite pop-ups para visualizar.', true); return; }
    const doc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #fff; color: #111827; padding: 18px; }
    h1, h2, h3 { margin: 0; }
    .muted { color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .header { display:flex; justify-content: space-between; gap: 12px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; }
    .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; background:#eef2ff; color:#3730a3; font-size: 12px; }
  </style>
</head>
<body>${innerHtml}</body>
</html>`;
    win.document.open();
    win.document.write(doc);
    win.document.close();
    win.focus();
}

function openBudgetItemsView(budgetId) {
    const b = (budgets || []).find(x => String(x.id) === String(budgetId));
    if (!b) { showToast('Orçamento não encontrado.', true); return; }

    const empresaLabel = getEmpresaName(currentEmpresaId);
    const pat = (patients || []).find(p => String(p.id) === String(b.pacienteid));
    const patientName = pat ? (pat.nome || b.pacientenome || '-') : (b.pacientenome || '-');
    const issuedAt = formatDateTime(new Date().toISOString());

    const items = b.orcamento_itens || b.itens || [];
    const rowsHtml = items.map((it, idx) => {
        const serv = (services || []).find(s => String(s.id) === String(it.servico_id || ''));
        const desc = serv ? serv.descricao : (it.servicodescricao || it.descricao || '-');
        const sub = String(it.subdivisao || '').trim();
        const label = sub ? `${desc} — ${sub}` : desc;
        const executor = (professionals || []).find(p => String(p.seqid) === String(it.profissional_id || ''));
        const executorName = executor ? executor.nome : (it.executorNome || '-');
        return `
            <tr>
                <td style="width:48px; text-align:center;">${idx + 1}</td>
                <td>${escapeHtml(label)}</td>
                <td style="width:260px;">${escapeHtml(executorName)}</td>
                <td style="width:140px;">${escapeHtml(String(it.status || '-'))}</td>
            </tr>
        `;
    }).join('');

    const html = `
        <div class="header">
            <div>
                <div style="font-size: 20px; font-weight: 800;">ORÇAMENTO #${escapeHtml(String(b.seqid || '-'))}</div>
                <div class="muted" style="margin-top: 4px;">${escapeHtml(empresaLabel)} • ${escapeHtml(patientName)}</div>
            </div>
            <div style="text-align:right;">
                <div class="badge">Somente leitura</div>
                <div class="muted" style="margin-top: 6px; font-size: 12px;">Emitido em ${escapeHtml(issuedAt)}</div>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Executor</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="4" style="text-align:center;" class="muted">Sem itens.</td></tr>'}
            </tbody>
        </table>
    `;
    openViewWindow(html, `Orçamento #${b.seqid || ''}`);
}

async function confirmAtendimentoItem({ agendamentoId, itemId, itemStatus }) {
    if (!can('atendimento', 'update')) {
        showToast('Você não possui permissão para finalizar atendimentos.', true);
        return;
    }
    if (!can('agenda', 'update')) {
        showToast('Você não possui permissão para atualizar a agenda.', true);
        return;
    }
    if (!can('orcamentos', 'update')) {
        showToast('Você não possui permissão para atualizar itens do orçamento.', true);
        return;
    }
    if (!agendamentoId || !itemId) {
        showToast('Dados insuficientes para confirmar o atendimento.', true);
        return;
    }
    if (!confirm('Finalizar o atendimento e marcar o item como FINALIZADO?')) return;

    try {
        const upAg = db.from('agenda_agendamentos')
            .update({ status: 'CONCLUIDO' })
            .eq('id', agendamentoId)
            .eq('empresa_id', currentEmpresaId);
        const { error: agErr } = await withTimeout(upAg, 15000, 'agenda_agendamentos:confirmar');
        if (agErr) throw agErr;

        const upIt = db.from('orcamento_itens')
            .update({ status: 'Finalizado' })
            .eq('id', itemId)
            .eq('empresa_id', currentEmpresaId);
        const { error: itErr } = await withTimeout(upIt, 15000, 'orcamento_itens:status');
        if (itErr) throw itErr;

        let updatedBudget = null;
        if (Array.isArray(budgets)) {
            for (const b of budgets) {
                const itens = b && (b.orcamento_itens || b.itens || []);
                const it = Array.isArray(itens) ? itens.find(x => String(x && x.id) === String(itemId)) : null;
                if (it) {
                    it.status = 'Finalizado';
                    updatedBudget = b;
                    break;
                }
            }
        }

        if (updatedBudget) {
            const itens = updatedBudget.orcamento_itens || updatedBudget.itens || [];
            const qtd = Array.isArray(itens) ? itens.length : 0;
            const finalizados = Array.isArray(itens) ? itens.filter(x => normalizeKey(String(x && x.status || '')) === 'FINALIZADO').length : 0;
            const allFinal = qtd > 0 && finalizados === qtd;
            if (allFinal && String(updatedBudget.status || '') !== 'Executado') {
                const upB = db.from('orcamentos')
                    .update({ status: 'Executado' })
                    .eq('id', updatedBudget.id)
                    .eq('empresa_id', currentEmpresaId);
                const { error: bErr } = await withTimeout(upB, 15000, 'orcamentos:status_executado');
                if (!bErr) updatedBudget.status = 'Executado';
            }
            renderTable(budgets, 'budgets');
        }

        showToast(updatedBudget && String(updatedBudget.status || '') === 'Executado' ? 'Atendimento finalizado. Orçamento concluído.' : 'Atendimento finalizado.');
        await fetchAtendimentoForUI();
    } catch (err) {
        console.error('Erro ao confirmar atendimento:', err);
        const code = err && err.code ? err.code : '-';
        const msg2 = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao confirmar atendimento (${code}): ${msg2}`, true);
    }
}

function closeFechamentoDiarioModal() {
    if (fechamentoDiarioModal) fechamentoDiarioModal.classList.add('hidden');
}

function openFechamentoDiarioModal() {
    if (!fechamentoDiarioModal) return;

    const setTodayIfEmpty = (el) => {
        if (!el || el.value) return;
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        el.value = `${yyyy}-${mm}-${dd}`;
    };

    if (fechamentoDiarioDate) {
        if (atendimentoDate && atendimentoDate.value) fechamentoDiarioDate.value = String(atendimentoDate.value);
        setTodayIfEmpty(fechamentoDiarioDate);
    }

    if (fechamentoDiarioProfessional) {
        const opts = ['<option value="">Todos</option>'];
        (professionals || [])
            .slice()
            .filter(p => String(p.tipo || '').toLowerCase() !== 'protetico')
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                if (p.seqid == null) return;
                opts.push(`<option value="${escapeHtml(String(p.seqid))}">${escapeHtml(String(p.nome || ''))}</option>`);
            });
        fechamentoDiarioProfessional.innerHTML = opts.join('');
        if (atendimentoProfessional && atendimentoProfessional.value) {
            fechamentoDiarioProfessional.value = String(atendimentoProfessional.value);
        }
    }

    if (!fechamentoDiarioModal.dataset.bound) {
        if (btnCloseFechamentoDiarioModal) btnCloseFechamentoDiarioModal.addEventListener('click', closeFechamentoDiarioModal);
        if (btnCancelFechamentoDiario) btnCancelFechamentoDiario.addEventListener('click', closeFechamentoDiarioModal);
        if (btnGenerateFechamentoDiario) {
            btnGenerateFechamentoDiario.addEventListener('click', async (e) => {
                e.preventDefault();
                const dateStr = fechamentoDiarioDate ? String(fechamentoDiarioDate.value || '') : '';
                const profSeqId = fechamentoDiarioProfessional ? String(fechamentoDiarioProfessional.value || '') : '';
                await printFechamentoDiario({ dateStr, profSeqId });
            });
        }
        fechamentoDiarioModal.addEventListener('click', (e) => { if (e.target === fechamentoDiarioModal) closeFechamentoDiarioModal(); });
        fechamentoDiarioModal.dataset.bound = '1';
    }

    fechamentoDiarioModal.classList.remove('hidden');
}

async function fetchAgendaRowsForFechamento({ dateStr, profSeqId }) {
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
    let q = db.from('agenda_agendamentos')
        .select('id,paciente_id,profissional_id,inicio,status,titulo')
        .eq('empresa_id', currentEmpresaId)
        .gte('inicio', startIso)
        .lte('inicio', endIso)
        .order('inicio', { ascending: true });
    if (profSeqId) q = q.eq('profissional_id', Number(profSeqId));
    const { data, error } = await withTimeout(q, 20000, 'agenda_agendamentos:fechamento');
    if (error) throw error;
    return data || [];
}

function buildAtendimentoRowsFromAgenda({ agendaRows, profSeqId }) {
    const list = (agendaRows || []).filter(a => String(a.status || '') !== 'CANCELADO');
    const byPaciente = new Map();
    list.forEach(a => {
        if (!a.paciente_id) return;
        const k = String(a.paciente_id);
        if (!byPaciente.has(k)) byPaciente.set(k, []);
        byPaciente.get(k).push(a);
    });
    byPaciente.forEach(arr => arr.sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || ''))));

    const rows = [];
    byPaciente.forEach((arr, pacienteSeqIdStr) => {
        const paciente = getPacienteDetailsBySeqId(pacienteSeqIdStr);
        const pacienteUuid = paciente?.id || null;
        if (!pacienteUuid) return;

        const firstAg = arr[0];
        const hora = firstAg && firstAg.inicio ? formatTimeHHMM(new Date(firstAg.inicio)) : '--:--';

        const patientBudgets = (budgets || []).filter(b => String(b.pacienteid || b.paciente_id || '') === String(pacienteUuid));
        patientBudgets.forEach(b => {
            const itens = (b.orcamento_itens || b.itens || []);
            const tipoKey = normalizeKey(String(b.tipo || 'Normal'));
            const isFreeBudget = tipoKey === 'CORTESIA' || tipoKey === 'RETRABALHO';
            itens.forEach(it => {
                const executor = it.profissional_id ?? it.profissionalId ?? it.executor_id ?? it.executorId;
                const execProf = findProfessionalByAnyId(executor);
                const execSeqId = execProf && execProf.seqid != null ? String(execProf.seqid) : String(executor || '');
                if (execSeqId !== String(profSeqId)) return;

                const st = String(it.status || it.item_status || '').trim();
                const stKey = normalizeStatusKey(st);
                if (stKey === 'CANCELADO') return;
                const eligible = isFreeBudget || stKey === 'LIBERADO' || stKey === 'EMEXECUCAO' || stKey === 'FINALIZADO';
                if (!eligible) return;

                const serv = (services || []).find(s => String(s.id) === String(it.servico_id || it.servicoId || ''));
                const desc = serv ? serv.descricao : (it.servicoDescricao || it.descricao || `#${it.servico_id || it.servicoId || it.id || ''}`);
                const sub = String(it.subdivisao || it.sub_divisao || '').trim();
                const itemLabel = sub ? `${desc} — ${sub}` : desc;

                const qtde = Number(it.qtde || 1);
                const valor = Number(it.valor || 0);
                const total = (Number.isFinite(qtde) && qtde > 0 ? qtde : 1) * (Number.isFinite(valor) ? valor : 0);

                rows.push({
                    hora,
                    pacienteNome: String(paciente?.nome || ''),
                    budgetSeq: b.seqid,
                    itemId: it.id,
                    itemLabel,
                    itemStatus: it.status || it.item_status || '',
                    itemTotal: total
                });
            });
        });
    });

    rows.sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')) || String(a.pacienteNome || '').localeCompare(String(b.pacienteNome || ''), 'pt-BR'));
    return rows;
}

async function printFechamentoDiario({ dateStr, profSeqId }) {
    if (!dateStr) { showToast('Selecione a data.', true); return; }
    if (btnGenerateFechamentoDiario) btnGenerateFechamentoDiario.disabled = true;
    try {
        const agendaRows = await fetchAgendaRowsForFechamento({ dateStr, profSeqId });
        const agendaValid = (agendaRows || []).filter(a => String(a.status || '') !== 'CANCELADO');

        const statusCounts = new Map();
        const byProf = new Map();
        agendaValid.forEach(a => {
            const st = String(a.status || 'MARCADO');
            statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
            const p = String(a.profissional_id || '');
            if (!p) return;
            if (!byProf.has(p)) byProf.set(p, []);
            byProf.get(p).push(a);
        });

        const profKeys = profSeqId ? [String(profSeqId)] : Array.from(byProf.keys()).sort((a, b) => Number(a) - Number(b));
        const sections = [];

        const { rows: payRows, dateCol } = await fetchMovDiariaPayments({ dateStr });
        const allocCache = new Map();
        const allMovLines = [];

        payRows.forEach(p => {
            const budgetSeq = Number(p.orcamento_id);
            const b = (budgets || []).find(x => Number(x.seqid) === budgetSeq) || null;
            if (!b) return;
            const itens = b.orcamento_itens || b.itens || [];
            if (!Array.isArray(itens) || itens.length === 0) return;

            const pacienteNome = String(b.pacientenome || b.paciente_nome || '') || (patients || []).find(pp => pp.id === b.pacienteid)?.nome || '';
            const dataRaw = p[dateCol] || p.data_pagamento || p.criado_em || p.created_at || p.data || null;
            const dataFmt = dataRaw ? formatDateTime(dataRaw) : formatDateBR(dateStr);
            const formaLabel = normalizeFormaPagamento(p.forma_pagamento);
            const bucket = movBucketFromForma(p.forma_pagamento);
            const valorPago = Number(p.valor_pago || 0);

            let allocMap = allocCache.get(budgetSeq);
            if (!allocMap) {
                allocMap = buildAllocationsForBudget({ budget: b, items: itens });
                allocCache.set(budgetSeq, allocMap);
            }
            const alloc = allocMap.get(String(p.id || '')) || buildAllocationRows(valorPago, itens);
            const explicit = Boolean(extractAllocationItemIdFromObs(p.observacoes));
            const touches = Array.isArray(alloc) ? alloc.filter(v => Number(v || 0) > 0).length : 0;
            itens.forEach((it, idx) => {
                const execId = it.profissional_id;
                const execName = findProfessionalNameByAnyId(execId) || String(it.executorNome || '');
                const servName = findServiceNameById(it.servico_id) || String(it.servicodescricao || it.descricao || '');
                const itemName = `${servName}${it.subdivisao ? ` • ${it.subdivisao}` : ''}${explicit ? '' : (touches > 1 ? ' (auto)' : '')}`;
                const paid = Number(alloc[idx] || 0);
                if (!(paid > 0)) return;
                allMovLines.push({
                    profSeqId: String(execId || ''),
                    professional: execName || '—',
                    date: dataFmt,
                    patient: pacienteNome || '—',
                    service: itemName || '—',
                    paid,
                    forma: formaLabel || '—',
                    bucket
                });
            });
        });

        let totalProduzido = 0;
        let totalFinalizados = 0;
        profKeys.forEach(k => {
            const ags = byProf.get(String(k)) || [];
            const profName = getProfessionalNameBySeqId(k);

            const atendimentoRows = buildAtendimentoRowsFromAgenda({ agendaRows: ags, profSeqId: k });
            const finalizados = atendimentoRows.filter(r => normalizeStatusKey(r.itemStatus) === 'FINALIZADO');
            const pendentes = atendimentoRows.filter(r => normalizeStatusKey(r.itemStatus) !== 'FINALIZADO');
            const produzido = finalizados.reduce((acc, r) => acc + Number(r.itemTotal || 0), 0);

            totalProduzido += produzido;
            totalFinalizados += finalizados.length;

            const movLines = allMovLines.filter(l => String(l.profSeqId || '') === String(k));
            const movTotals = { PIX: 0, CC: 0, CD: 0, ESPECIE: 0, OUTROS: 0 };
            movLines.forEach(l => { movTotals[l.bucket] = (movTotals[l.bucket] || 0) + Number(l.paid || 0); });
            const movTotal = Object.values(movTotals).reduce((a, b) => a + b, 0);

            const finalHtml = finalizados.length ? finalizados.map(r => `
                <tr>
                    <td style="padding:8px; border:1px solid #e5e7eb; white-space:nowrap;">${escapeHtml(String(r.hora || ''))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(String(r.pacienteNome || '—'))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(String(r.itemLabel || '—'))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb; text-align:center;">${escapeHtml(String(r.budgetSeq || '—'))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(r.itemTotal || 0))}</td>
                </tr>
            `).join('') : `<tr><td colspan="5" style="text-align:center; padding:12px; color:#6b7280;">Nenhum item finalizado.</td></tr>`;

            const movHtml = movLines.length ? movLines.map(l => `
                <tr>
                    <td style="padding:8px; border:1px solid #e5e7eb; white-space:nowrap;">${escapeHtml(String(l.date || ''))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(String(l.patient || '—'))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(String(l.service || '—'))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(l.paid || 0))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(String(l.forma || '—'))}</td>
                </tr>
            `).join('') : `<tr><td colspan="5" style="text-align:center; padding:12px; color:#6b7280;">Nenhum recebimento alocado.</td></tr>`;

            sections.push(`
                <div style="margin-top: 16px; page-break-inside: avoid;">
                    <div style="display:flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline;">
                        <div style="font-size: 13px; font-weight: 900; color:#111827;">${escapeHtml(profName)}</div>
                        <div style="color:#374151; font-size: 12px;">
                            <strong>Produzido:</strong> ${escapeHtml(fmtMoney(produzido))} &nbsp;•&nbsp;
                            <strong>Finalizados:</strong> ${escapeHtml(String(finalizados.length))} &nbsp;•&nbsp;
                            <strong>Pendentes:</strong> ${escapeHtml(String(pendentes.length))} &nbsp;•&nbsp;
                            <strong>Recebido:</strong> ${escapeHtml(fmtMoney(movTotal))}
                        </div>
                    </div>

                    <div style="margin-top: 8px; font-size: 11px; color:#6b7280;">
                        Recebimentos por forma: PIX ${escapeHtml(fmtMoney(movTotals.PIX))} • CC ${escapeHtml(fmtMoney(movTotals.CC))} • CD ${escapeHtml(fmtMoney(movTotals.CD))} • Espécie ${escapeHtml(fmtMoney(movTotals.ESPECIE))} • Outros ${escapeHtml(fmtMoney(movTotals.OUTROS))}
                    </div>

                    <div style="margin-top: 10px;">
                        <div style="font-weight:900; margin-bottom: 6px;">Itens finalizados (fonte oficial)</div>
                        <table style="width:100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Hora</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Paciente</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Serviço</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:center;">Orc. #</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:right;">Valor</th>
                                </tr>
                            </thead>
                            <tbody>${finalHtml}</tbody>
                        </table>
                    </div>

                    <div style="margin-top: 12px;">
                        <div style="font-weight:900; margin-bottom: 6px;">Recebimentos do dia (alocados)</div>
                        <table style="width:100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Data</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Paciente</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Serviço</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:right;">Valor Pago</th>
                                    <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Forma</th>
                                </tr>
                            </thead>
                            <tbody>${movHtml}</tbody>
                        </table>
                    </div>
                </div>
            `);
        });

        const recebidoTotals = { PIX: 0, CC: 0, CD: 0, ESPECIE: 0, OUTROS: 0 };
        allMovLines.forEach(l => {
            if (profSeqId && String(l.profSeqId || '') !== String(profSeqId)) return;
            recebidoTotals[l.bucket] = (recebidoTotals[l.bucket] || 0) + Number(l.paid || 0);
        });
        const recebidoTotal = Object.values(recebidoTotals).reduce((a, b) => a + b, 0);

        const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const usuario = String(currentUser?.email || currentUser?.user_metadata?.email || '').trim() || '—';
        const profLabel = profSeqId ? getProfessionalNameBySeqId(profSeqId) : 'Todos';

        const resumoStatus = Array.from(statusCounts.entries())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
            .map(([k, v]) => `${k}: ${v}`)
            .join(' • ');

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Fechamento Diário - ${escapeHtml(formatDateBR(dateStr))}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; color:#111827; padding: 24px; }
    .header { display:flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-weight: 900; color:#0066cc; font-size: 20px; line-height: 1.05; }
    .brand small { display:block; font-size: 11px; font-weight: 700; color:#6b7280; margin-top: 2px; }
    .meta { text-align:right; color:#6b7280; font-size: 11px; }
    .title { font-size: 14px; font-weight: 900; letter-spacing: 0.04em; }
    .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #f9fafb; }
    .sig { margin-top: 18px; display:flex; gap: 40px; }
    .sig .line { flex:1; border-top: 1px solid #111827; padding-top: 6px; text-align:center; color:#6b7280; font-size: 11px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">OCC <small>Odonto Connect Cloud</small></div>
      <div style="margin-top:6px;" class="title">FECHAMENTO DIÁRIO</div>
      <div style="margin-top:4px; color:#6b7280; font-size: 11px;">Fonte oficial: itens finalizados via Atendimento</div>
    </div>
    <div class="meta">
      <div>Data: <strong>${escapeHtml(formatDateBR(dateStr))}</strong></div>
      <div>Profissional: <strong>${escapeHtml(profLabel)}</strong></div>
      <div>Emitido em: ${escapeHtml(hoje)}</div>
      <div>Usuário: ${escapeHtml(usuario)}</div>
    </div>
  </div>

  <div class="box">
    <div style="font-weight:900; margin-bottom: 6px;">Resumo</div>
    <div style="color:#374151; font-size: 12px; line-height: 1.5;">
      <div><strong>Agenda (status):</strong> ${escapeHtml(resumoStatus || '—')}</div>
      <div><strong>Itens finalizados:</strong> ${escapeHtml(String(totalFinalizados))} &nbsp;•&nbsp; <strong>Total produzido:</strong> ${escapeHtml(fmtMoney(totalProduzido))}</div>
      <div><strong>Total recebido (alocado):</strong> ${escapeHtml(fmtMoney(recebidoTotal))}</div>
      <div><strong>Recebido por forma:</strong>
        PIX ${escapeHtml(fmtMoney(recebidoTotals.PIX))} •
        CC ${escapeHtml(fmtMoney(recebidoTotals.CC))} •
        CD ${escapeHtml(fmtMoney(recebidoTotals.CD))} •
        Espécie ${escapeHtml(fmtMoney(recebidoTotals.ESPECIE))} •
        Outros ${escapeHtml(fmtMoney(recebidoTotals.OUTROS))}
      </div>
    </div>
  </div>

  ${sections.join('')}

  <div class="sig">
    <div class="line">Assinatura responsável do caixa/gestão</div>
    <div class="line">Observações</div>
  </div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=1020,height=780');
        if (!win) { showToast('Habilite pop-ups para imprimir o fechamento.', true); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
        closeFechamentoDiarioModal();
    } catch (err) {
        console.error('Erro ao gerar fechamento diário:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao gerar fechamento (${code}): ${msg}`, true);
    } finally {
        if (btnGenerateFechamentoDiario) btnGenerateFechamentoDiario.disabled = false;
    }
}

async function fetchBudgetsForDay({ dateStr }) {
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
    const baseCols = 'id,seqid,status,tipo,pacienteid,pacientenome,empresa_id';
    const dateCols = ['created_at', 'criado_em', 'data', 'data_criacao'];
    let lastErr = null;
    for (const col of dateCols) {
        try {
            const q = db.from('orcamentos')
                .select(`${baseCols},${col}`)
                .eq('empresa_id', currentEmpresaId)
                .gte(col, startIso)
                .lte(col, endIso)
                .order(col, { ascending: true })
                .limit(5000);
            const { data, error } = await withTimeout(q, 25000, `orcamentos:fechamento:${col}`);
            if (!error) return { rows: data || [], dateCol: col };
            lastErr = error;
        } catch (err) {
            lastErr = err;
        }
    }
    if (lastErr) throw lastErr;
    return { rows: [], dateCol: 'created_at' };
}

async function fetchFinanceTransacoesForDay({ dateStr }) {
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
    const q = db.from('financeiro_transacoes')
        .select('id,seqid,paciente_id,orcamento_id,referencia_id,tipo,categoria,valor,forma_pagamento,data_transacao,observacoes,criado_por,empresa_id')
        .eq('empresa_id', currentEmpresaId)
        .gte('data_transacao', startIso)
        .lte('data_transacao', endIso)
        .order('data_transacao', { ascending: true })
        .limit(10000);
    const { data, error } = await withTimeout(q, 25000, 'financeiro_transacoes:fechamento');
    if (error) throw error;
    return data || [];
}

async function fetchComissoesForDay({ dateStr }) {
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
    const baseCols = 'id,profissional_id,status,valor_comissao,data_geracao,data_pagamento,empresa_id';
    const dateCols = ['data_geracao', 'created_at'];
    let lastErr = null;
    for (const col of dateCols) {
        try {
            const q = db.from('financeiro_comissoes')
                .select(baseCols)
                .eq('empresa_id', currentEmpresaId)
                .gte(col, startIso)
                .lte(col, endIso)
                .order(col, { ascending: true })
                .limit(10000);
            const { data, error } = await withTimeout(q, 25000, `financeiro_comissoes:fechamento:${col}`);
            if (!error) return data || [];
            lastErr = error;
        } catch (err) {
            lastErr = err;
        }
    }
    if (lastErr) {
        try {
            const q2 = db.from('financeiro_comissoes')
                .select(baseCols)
                .eq('empresa_id', currentEmpresaId)
                .gte('data_pagamento', startIso)
                .lte('data_pagamento', endIso)
                .order('data_pagamento', { ascending: true })
                .limit(10000);
            const { data, error } = await withTimeout(q2, 25000, 'financeiro_comissoes:fechamento:pagamento');
            if (!error) return data || [];
        } catch { }
    }
    return [];
}

function sumByKey(rows, key) {
    return (rows || []).reduce((acc, r) => acc + Number(r && r[key] || 0), 0);
}

async function printFechamentoDiarioFull({ dateStr, profSeqId }) {
    if (!dateStr) { showToast('Selecione a data.', true); return; }
    if (btnGenerateFechamentoDiarioFull) btnGenerateFechamentoDiarioFull.disabled = true;
    try {
        const agendaRows = await fetchAgendaRowsForFechamento({ dateStr, profSeqId: '' });
        const agendaValid = (agendaRows || []).filter(a => String(a.status || '') !== 'CANCELADO');
        const statusCounts = new Map();
        const byProf = new Map();
        agendaValid.forEach(a => {
            const st = String(a.status || 'MARCADO');
            statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
            const p = String(a.profissional_id || '');
            if (!p) return;
            if (!byProf.has(p)) byProf.set(p, []);
            byProf.get(p).push(a);
        });

        const profKeysAll = Array.from(byProf.keys()).sort((a, b) => Number(a) - Number(b));
        const profKeys = profSeqId ? [String(profSeqId)] : profKeysAll;

        const { rows: payRows, dateCol: payDateCol } = await fetchMovDiariaPayments({ dateStr });
        const allMovLines = [];
        payRows.forEach(p => {
            const budgetSeq = Number(p.orcamento_id);
            const b = (budgets || []).find(x => Number(x.seqid) === budgetSeq) || null;
            if (!b) return;
            const itens = b.orcamento_itens || b.itens || [];
            if (!Array.isArray(itens) || itens.length === 0) return;
            const pacienteNome = String(b.pacientenome || b.paciente_nome || '') || (patients || []).find(pp => pp.id === b.pacienteid)?.nome || '';
            const dataRaw = p[payDateCol] || p.data_pagamento || p.criado_em || p.created_at || p.data || null;
            const dataFmt = dataRaw ? formatDateTime(dataRaw) : formatDateBR(dateStr);
            const formaLabel = normalizeFormaPagamento(p.forma_pagamento);
            const bucket = movBucketFromForma(p.forma_pagamento);
            const valorPago = Number(p.valor_pago || 0);
            const alloc = buildAllocationRows(valorPago, itens);
            itens.forEach((it, idx) => {
                const execId = it.profissional_id;
                const execName = findProfessionalNameByAnyId(execId) || String(it.executorNome || '');
                const servName = findServiceNameById(it.servico_id) || String(it.servicodescricao || it.descricao || '');
                const itemName = `${servName}${it.subdivisao ? ` • ${it.subdivisao}` : ''}`;
                const paid = Number(alloc[idx] || 0);
                if (!(paid > 0)) return;
                allMovLines.push({
                    profSeqId: String(execId || ''),
                    professional: execName || '—',
                    date: dataFmt,
                    patient: pacienteNome || '—',
                    service: itemName || '—',
                    paid,
                    forma: formaLabel || '—',
                    bucket
                });
            });
        });

        const finRows = await fetchFinanceTransacoesForDay({ dateStr });
        const finCred = finRows.filter(r => String(r.tipo || '') === 'CREDITO');
        const finDeb = finRows.filter(r => String(r.tipo || '') === 'DEBITO');
        const finTotalCred = sumByKey(finCred, 'valor');
        const finTotalDeb = sumByKey(finDeb, 'valor');
        const finSaldoDia = finTotalCred - finTotalDeb;

        const finByCat = new Map();
        finRows.forEach(r => {
            const k = financeCategoryForReport(r);
            finByCat.set(k, (finByCat.get(k) || 0) + Number(r.valor || 0) * (String(r.tipo || '') === 'DEBITO' ? -1 : 1));
        });
        const finByForma = new Map();
        finCred.forEach(r => {
            const k = normalizeFormaPagamento(r.forma_pagamento);
            finByForma.set(k, (finByForma.get(k) || 0) + Number(r.valor || 0));
        });

        const consumoSeqs = Array.from(new Set((finRows || [])
            .filter(r => normalizeKey(financeCategoryForReport(r)) === 'CONSUMO')
            .map(r => getBudgetSeqFromFinanceRow(r))
            .filter(n => Number.isFinite(n) && n > 0)
            .map(n => String(n))));
        const formaByBudgetSeq = consumoSeqs.length
            ? await fetchBudgetPaymentFormasForSeqids(consumoSeqs)
            : new Map();

        const { rows: budRows, dateCol: budDateCol } = await fetchBudgetsForDay({ dateStr });
        const budCriados = budRows.length;
        const budAprov = budRows.filter(b => normalizeKey(b.status) === 'APROVADO').length;
        const budCanc = budRows.filter(b => normalizeKey(b.status) === 'CANCELADO').length;

        const commRows = await fetchComissoesForDay({ dateStr });
        const commAPagar = commRows.filter(c => {
            const st = normalizeKey(c.status);
            return st === 'PENDENTE' || st === 'GERADA';
        });
        const commPagas = commRows.filter(c => normalizeKey(c.status) === 'PAGA');
        const commTotalAPagar = sumByKey(commAPagar, 'valor_comissao');
        const commTotalPagas = sumByKey(commPagas, 'valor_comissao');

        const recebidoTotals = { PIX: 0, CC: 0, CD: 0, ESPECIE: 0, OUTROS: 0 };
        allMovLines.forEach(l => {
            if (profSeqId && String(l.profSeqId || '') !== String(profSeqId)) return;
            recebidoTotals[l.bucket] = (recebidoTotals[l.bucket] || 0) + Number(l.paid || 0);
        });
        const recebidoTotal = Object.values(recebidoTotals).reduce((a, b) => a + b, 0);

        const orcPayTotal = (payRows || []).filter(p => String(p.status_pagamento || '') !== 'Cancelado').reduce((acc, p) => acc + Number(p.valor_pago || 0), 0);
        const finPayRows = finRows.filter(r => String(r.categoria || '') === 'PAGAMENTO' && String(r.tipo || '') === 'CREDITO');
        const finPayTotal = sumByKey(finPayRows, 'valor');
        const concDiff = Number((orcPayTotal - finPayTotal).toFixed(2));

        const proteseOver = (proteseOrders || []).filter(o => {
            if (!isProteseOverdue(o)) return false;
            const st = normalizeKey(o.status_geral || '');
            return st !== 'CONCLUIDA' && st !== 'CANCELADA';
        });

        const productionSections = [];
        let totalProduzido = 0;
        let totalFinalizados = 0;
        let totalPendentes = 0;
        const pendenciasRows = [];

        profKeys.forEach(k => {
            const ags = byProf.get(String(k)) || [];
            const profName = getProfessionalNameBySeqId(k);
            const atendimentoRows = buildAtendimentoRowsFromAgenda({ agendaRows: ags, profSeqId: k });
            const finalizados = atendimentoRows.filter(r => normalizeStatusKey(r.itemStatus) === 'FINALIZADO');
            const pendentes = atendimentoRows.filter(r => normalizeStatusKey(r.itemStatus) !== 'FINALIZADO');
            const produzido = finalizados.reduce((acc, r) => acc + Number(r.itemTotal || 0), 0);
            totalProduzido += produzido;
            totalFinalizados += finalizados.length;
            totalPendentes += pendentes.length;
            pendentes.forEach(r => pendenciasRows.push({ profName, ...r }));

            const movLines = allMovLines.filter(l => String(l.profSeqId || '') === String(k));
            const movTotals = { PIX: 0, CC: 0, CD: 0, ESPECIE: 0, OUTROS: 0 };
            movLines.forEach(l => { movTotals[l.bucket] = (movTotals[l.bucket] || 0) + Number(l.paid || 0); });
            const movTotal = Object.values(movTotals).reduce((a, b) => a + b, 0);

            const finalHtml = finalizados.length ? finalizados.map(r => `
                <tr>
                    <td style="padding:7px; border:1px solid #e5e7eb; white-space:nowrap;">${escapeHtml(String(r.hora || ''))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(r.pacienteNome || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(r.itemLabel || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb; text-align:center;">${escapeHtml(String(r.budgetSeq || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(r.itemTotal || 0))}</td>
                </tr>
            `).join('') : `<tr><td colspan="5" style="text-align:center; padding:10px; color:#6b7280;">Nenhum item finalizado.</td></tr>`;

            productionSections.push(`
                <div style="margin-top: 18px; page-break-inside: avoid;">
                    <div style="display:flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline;">
                        <div style="font-size: 13px; font-weight: 900; color:#111827;">${escapeHtml(profName)}</div>
                        <div style="color:#374151; font-size: 12px;">
                            <strong>Produzido:</strong> ${escapeHtml(fmtMoney(produzido))} •
                            <strong>Finalizados:</strong> ${escapeHtml(String(finalizados.length))} •
                            <strong>Pendentes:</strong> ${escapeHtml(String(pendentes.length))} •
                            <strong>Recebido (alocado):</strong> ${escapeHtml(fmtMoney(movTotal))}
                        </div>
                    </div>
                    <div style="margin-top: 10px;">
                        <table style="width:100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr>
                                    <th style="padding:7px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Hora</th>
                                    <th style="padding:7px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Paciente</th>
                                    <th style="padding:7px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Serviço</th>
                                    <th style="padding:7px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:center;">Orc. #</th>
                                    <th style="padding:7px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:right;">Valor</th>
                                </tr>
                            </thead>
                            <tbody>${finalHtml}</tbody>
                        </table>
                    </div>
                </div>
            `);
        });

        const pendList = pendenciasRows.slice(0, 60).map(r => `
            <tr>
                <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(r.profName || '—'))}</td>
                <td style="padding:7px; border:1px solid #e5e7eb; white-space:nowrap;">${escapeHtml(String(r.hora || ''))}</td>
                <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(r.pacienteNome || '—'))}</td>
                <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(r.itemLabel || '—'))}</td>
                <td style="padding:7px; border:1px solid #e5e7eb; text-align:center;">${escapeHtml(String(r.budgetSeq || '—'))}</td>
            </tr>
        `).join('') || `<tr><td colspan="5" style="text-align:center; padding:10px; color:#6b7280;">Sem pendências.</td></tr>`;

        const finDetails = finRows.slice(0, 300).map((t, idx) => {
            const pacNome = t.paciente_id ? (getPacienteDetailsBySeqId(t.paciente_id)?.nome || `Paciente #${t.paciente_id}`) : '—';
            const catDisp = String(financeCategoryForReport(t) || '—');
            let formaDisp = normalizeFormaPagamento(t.forma_pagamento);
            if (normalizeKey(catDisp) === 'CONSUMO' && normalizeKey(formaDisp) === 'NAO INFORMADO') {
                const seq = getBudgetSeqFromFinanceRow(t);
                const mapped = formaByBudgetSeq.get(String(seq));
                formaDisp = mapped || '—';
            }
            return `
                <tr>
                    <td style="padding:7px; border:1px solid #e5e7eb; text-align:right;">${escapeHtml(String(t.seqid || idx + 1))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(formatDateTime(t.data_transacao) || ''))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(pacNome || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(catDisp)}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(formaDisp || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(t.valor || 0))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb; text-align:center;">${escapeHtml(String(t.tipo || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb;">${escapeHtml(String(t.observacoes || '—'))}</td>
                </tr>
            `;
        }).join('') || `<tr><td colspan="8" style="text-align:center; padding:10px; color:#6b7280;">Sem lançamentos.</td></tr>`;

        const finCatHtml = Array.from(finByCat.entries())
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .map(([k, v]) => `
                <tr>
                    <td style="padding:7px; border:1px solid #e5e7eb; font-weight:800;">${escapeHtml(String(k || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(v || 0))}</td>
                </tr>
            `).join('') || `<tr><td colspan="2" style="text-align:center; padding:10px; color:#6b7280;">—</td></tr>`;

        const finFormaHtml = Array.from(finByForma.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `
                <tr>
                    <td style="padding:7px; border:1px solid #e5e7eb; font-weight:800;">${escapeHtml(String(k || '—'))}</td>
                    <td style="padding:7px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(v || 0))}</td>
                </tr>
            `).join('') || `<tr><td colspan="2" style="text-align:center; padding:10px; color:#6b7280;">—</td></tr>`;

        const resumoStatus = Array.from(statusCounts.entries())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
            .map(([k, v]) => `${k}: ${v}`)
            .join(' • ');

        const hoje = new Date();
        const emissao = hoje.toLocaleString('pt-BR');
        const usuario = String(currentUser?.email || currentUser?.user_metadata?.email || '').trim() || '—';
        const profLabel = profSeqId ? getProfessionalNameBySeqId(profSeqId) : 'Todos';

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Fechamento Diário - ${escapeHtml(formatDateBR(dateStr))}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; color:#111827; padding: 24px; font-size: 12px; }
    .header { display:flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-weight: 900; color:#0066cc; font-size: 20px; line-height: 1.05; }
    .brand small { display:block; font-size: 11px; font-weight: 700; color:#6b7280; margin-top: 2px; }
    .meta { text-align:right; color:#6b7280; font-size: 11px; }
    .title { font-size: 14px; font-weight: 900; letter-spacing: 0.04em; }
    .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #f9fafb; margin-top: 12px; }
    .section { margin-top: 16px; }
    .section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color:#6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { background:#f3f4f6; padding: 7px; text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color:#6b7280; border: 1px solid #e5e7eb; }
    td { padding: 7px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background:#f9fafb; }
    .sig { margin-top: 18px; display:flex; gap: 40px; }
    .sig .line { flex:1; border-top: 1px solid #111827; padding-top: 6px; text-align:center; color:#6b7280; font-size: 11px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">OCC <small>Odonto Connect Cloud</small></div>
      <div style="margin-top:6px;" class="title">FECHAMENTO DIÁRIO (COMPLETO)</div>
      <div style="margin-top:4px; color:#6b7280; font-size: 11px;">Fonte oficial: itens finalizados via Atendimento</div>
    </div>
    <div class="meta">
      <div>Data: <strong>${escapeHtml(formatDateBR(dateStr))}</strong> (00:00–23:59)</div>
      <div>Profissional: <strong>${escapeHtml(profLabel)}</strong></div>
      <div>Empresa: <strong>${escapeHtml(String(currentEmpresaId || '—'))}</strong></div>
      <div>Gerado por: ${escapeHtml(usuario)}</div>
      <div>Emissão: ${escapeHtml(emissao)}</div>
    </div>
  </div>

  <div class="box">
    <div style="font-weight:900; margin-bottom: 6px;">Resumo executivo</div>
    <div style="color:#374151; line-height: 1.55;">
      <div><strong>Atendimentos do dia (status):</strong> ${escapeHtml(resumoStatus || '—')}</div>
      <div><strong>Produção (fonte oficial):</strong> ${escapeHtml(String(totalFinalizados))} itens finalizados • ${escapeHtml(fmtMoney(totalProduzido))}</div>
      <div><strong>Pendências do dia:</strong> ${escapeHtml(String(totalPendentes))} itens não finalizados</div>
      <div><strong>Recebido (alocado):</strong> ${escapeHtml(fmtMoney(recebidoTotal))} • PIX ${escapeHtml(fmtMoney(recebidoTotals.PIX))} • CC ${escapeHtml(fmtMoney(recebidoTotals.CC))} • CD ${escapeHtml(fmtMoney(recebidoTotals.CD))} • Espécie ${escapeHtml(fmtMoney(recebidoTotals.ESPECIE))} • Outros ${escapeHtml(fmtMoney(recebidoTotals.OUTROS))}</div>
      <div><strong>Orçamentos do dia:</strong> ${escapeHtml(String(budCriados))} criados • ${escapeHtml(String(budAprov))} aprovados • ${escapeHtml(String(budCanc))} cancelados</div>
      <div><strong>Financeiro do dia:</strong> Entradas ${escapeHtml(fmtMoney(finTotalCred))} • Saídas ${escapeHtml(fmtMoney(finTotalDeb))} • Saldo ${escapeHtml(fmtMoney(finSaldoDia))}</div>
      <div><strong>Comissões do dia:</strong> A pagar ${escapeHtml(fmtMoney(commTotalAPagar))} • Pagas ${escapeHtml(fmtMoney(commTotalPagas))}</div>
      <div><strong>Próteses vencidas:</strong> ${escapeHtml(String(proteseOver.length))}</div>
    </div>
  </div>

  <div class="section">
    <h2>Conciliação</h2>
    <div class="box">
      <div><strong>Pagamentos do Orçamento (orcamento_pagamentos):</strong> ${escapeHtml(fmtMoney(orcPayTotal))}</div>
      <div><strong>Financeiro (categoria PAGAMENTO, crédito):</strong> ${escapeHtml(fmtMoney(finPayTotal))}</div>
      <div><strong>Diferença (Orçamento - Financeiro):</strong> ${escapeHtml(fmtMoney(concDiff))}</div>
    </div>
  </div>

  <div class="section">
    <h2>Financeiro do dia</h2>
    <div class="box" style="margin-bottom: 10px;">
      <div style="display:flex; gap: 16px; flex-wrap: wrap;">
        <div style="flex:1; min-width: 240px;">
          <div style="font-weight:900; margin-bottom: 6px;">Totais por categoria (saldo)</div>
          <table><tbody>${finCatHtml}</tbody></table>
        </div>
        <div style="flex:1; min-width: 240px;">
          <div style="font-weight:900; margin-bottom: 6px;">Totais por forma (bruto)</div>
          <table><tbody>${finFormaHtml}</tbody></table>
        </div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Data/Hora</th>
          <th>Paciente</th>
          <th>Categoria</th>
          <th>Forma</th>
          <th style="text-align:right;">Valor</th>
          <th style="text-align:center;">Tipo</th>
          <th>Obs</th>
        </tr>
      </thead>
      <tbody>${finDetails}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Produção por profissional</h2>
    ${productionSections.join('')}
  </div>

  <div class="section">
    <h2>Pendências e próximos passos</h2>
    <div class="box" style="margin-bottom: 10px;">
      <div><strong>Itens não finalizados (limitado a 60 linhas):</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Profissional</th>
          <th>Hora</th>
          <th>Paciente</th>
          <th>Item</th>
          <th style="text-align:center;">Orc. #</th>
        </tr>
      </thead>
      <tbody>${pendList}</tbody>
    </table>
    <div class="box" style="margin-top: 10px;">
      <div><strong>Próteses vencidas:</strong> ${escapeHtml(String(proteseOver.length))}</div>
    </div>
  </div>

  <div class="sig">
    <div class="line">Assinatura responsável do caixa/gestão</div>
    <div class="line">Observações</div>
  </div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=1100,height=800');
        if (!win) { showToast('Habilite pop-ups para imprimir o fechamento.', true); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
        if (fechamentoDiarioFullModal) fechamentoDiarioFullModal.classList.add('hidden');
    } catch (err) {
        console.error('Erro ao gerar fechamento diário completo:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao gerar fechamento (${code}): ${msg}`, true);
    } finally {
        if (btnGenerateFechamentoDiarioFull) btnGenerateFechamentoDiarioFull.disabled = false;
    }
}

function resetCommissionSelection() {
    selectedCommissionIds = new Set();
    if (commSelectAll) commSelectAll.checked = false;
    updateCommissionSelectedTotal();
}

function updateCommissionSelectedTotal() {
    const selected = (commissionsList || []).filter(r => selectedCommissionIds.has(String(r.id)));
    const total = selected.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);
    if (commSelectedTotal) {
        commSelectedTotal.textContent = `Total selecionado: ${Number(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }
}

function getProfessionalNameBySeqId(seqId) {
    const p = (professionals || []).find(x => String(x.seqid) === String(seqId));
    return p ? p.nome : `Profissional #${seqId}`;
}

function getCommissionStatusesForFilter(v) {
    if (v === 'A_PAGAR') return ['PENDENTE', 'GERADA'];
    if (v === 'PAGAS') return ['PAGA'];
    if (v === 'TRANSFERIDAS') return ['ESTORNADA'];
    return null;
}

function getCommissionItemLabel(r) {
    if (!r) return '-';
    if (r.item_descricao) return String(r.item_descricao);
    if (r._itemDescricao) return String(r._itemDescricao);
    if (r.servico_descricao) return String(r.servico_descricao);
    if (r.item_id) return `#${r.item_id}`;
    return '-';
}

async function enrichCommissionsItems(rows) {
    try {
        const itemIds = Array.from(new Set((rows || []).map(r => r.item_id).filter(Boolean).map(String)));
        if (!itemIds.length) return;

        const itemToServico = new Map();
        const itemToBudgetId = new Map();
        const chunkSize = 200;
        for (let i = 0; i < itemIds.length; i += chunkSize) {
            const chunk = itemIds.slice(i, i + chunkSize);
            const q = db.from('orcamento_itens').select('id, servico_id, orcamento_id').in('id', chunk);
            const { data, error } = await withTimeout(q, 15000, 'orcamento_itens');
            if (error) throw error;
            (data || []).forEach(it => {
                const itId = String(it && it.id || '');
                if (!itId) return;
                itemToServico.set(itId, String(it && it.servico_id || ''));
                itemToBudgetId.set(itId, String(it && it.orcamento_id || ''));
            });
        }

        (rows || []).forEach(r => {
            const sid = itemToServico.get(String(r.item_id || ''));
            if (!sid) return;
            r._servicoId = sid;
            const serv = (services || []).find(s => String(s.id) === String(sid));
            r._itemDescricao = serv ? serv.descricao : `Serviço ${sid}`;

            const budId = itemToBudgetId.get(String(r.item_id || '')) || '';
            if (budId) {
                r._orcamentoId = budId;
                const bud = (budgets || []).find(b => String(b && b.id || '') === budId);
                if (bud && bud.seqid != null) r._orcamentoSeqid = bud.seqid;
            }
        });
    } catch (err) {
        console.error('Erro ao enriquecer itens de comissão:', err);
    }
}

async function fetchCommissionsFromUI() {
    const statusVal = commStatus ? commStatus.value : 'A_PAGAR';
    const statuses = getCommissionStatusesForFilter(statusVal);
    const start = commStart ? commStart.value : '';
    const end = commEnd ? commEnd.value : '';
    const profId = commProfessional ? commProfessional.value : '';
    await fetchCommissions({ statuses, start, end, profId, statusVal });
}

async function fetchCommissions({ statuses, start, end, profId, statusVal }) {
    try {
        if (commissionsEmptyState) commissionsEmptyState.classList.add('hidden');
        if (commissionsTable) commissionsTable.style.display = 'table';

        let query = db.from('financeiro_comissoes').select('*').order('data_geracao', { ascending: false });
        if (!isSuperAdmin && currentEmpresaId) {
            query = query.eq('empresa_id', currentEmpresaId);
        }
        if (profId) {
            query = query.eq('profissional_id', Number(profId));
        }
        if (statuses && statuses.length) {
            query = query.in('status', statuses);
        }
        if (start) {
            const startIso = new Date(`${start}T00:00:00`).toISOString();
            query = query.gte('data_geracao', startIso);
        }
        if (end) {
            const endIso = new Date(`${end}T23:59:59`).toISOString();
            query = query.lte('data_geracao', endIso);
        }

        const { data, error } = await withTimeout(query, 15000, 'financeiro_comissoes');
        if (error) throw error;

        commissionsList = Array.isArray(data) ? data : [];
        if (window.__dpDebug && window.__dpDebug.enabled) {
            window.__dpDebug.lastStep = `comissoes: rendered`;
            window.__dpDebug.lastDataLen = commissionsList.length;
        }

        await enrichCommissionsItems(commissionsList);
        renderCommissionsTable(commissionsList, statusVal);
    } catch (err) {
        console.error('Erro ao carregar comissões:', err);
        if (commissionsTableBody) {
            commissionsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--danger-color);">Falha ao carregar Comissões. Verifique RLS/policies.</td></tr>';
        }
        showToast('Erro ao carregar Comissões.', true);
    } finally {
        clearLoadTimer('commissions');
    }
}

function renderCommissionsTable(rows, statusVal) {
    if (!commissionsTableBody) return;
    commissionsTableBody.innerHTML = '';

    if (!rows || rows.length === 0) {
        if (commissionsTable) commissionsTable.style.display = 'none';
        if (commissionsEmptyState) commissionsEmptyState.classList.remove('hidden');
        resetCommissionSelection();
        return;
    }

    if (commissionsTable) commissionsTable.style.display = 'table';
    if (commissionsEmptyState) commissionsEmptyState.classList.add('hidden');

    const showPayActions = statusVal !== 'PAGAS';
    if (btnCommPay) btnCommPay.disabled = !showPayActions;

    const byTransferGroup = new Map();
    (rows || []).forEach(r => {
        const g = r && (r.transfer_group_id || r.transferGroupId);
        if (!g) return;
        const k = String(g);
        if (!byTransferGroup.has(k)) byTransferGroup.set(k, []);
        byTransferGroup.get(k).push(r);
    });

    rows.forEach(r => {
        const id = String(r.id);
        const dt = r.data_geracao ? formatDateTime(r.data_geracao) : '-';
        const prof = getProfessionalNameBySeqId(r.profissional_id);
        const orcSeq = (r && r._orcamentoSeqid != null) ? String(r._orcamentoSeqid) : '-';
        const item = getCommissionItemLabel(r);
        const status = String(r.status || '-');
        const isDebit = status === 'ESTORNADA';
        const signed = (isDebit ? -1 : 1) * Number(r.valor_comissao || 0);
        const absFmt = Number(Math.abs(signed)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const val = (signed < 0 ? '-' : '') + absFmt;

        const g = r && (r.transfer_group_id || r.transferGroupId);
        let transferHint = '';
        if (g) {
            const groupRows = byTransferGroup.get(String(g)) || [];
            if (isDebit) {
                const dest = groupRows.find(x => String(x.status || '') !== 'ESTORNADA');
                if (dest && dest.profissional_id) transferHint = `transferida para CRÉDITO de ${getProfessionalNameBySeqId(dest.profissional_id)}`;
            } else {
                const orig = groupRows.find(x => String(x.status || '') === 'ESTORNADA');
                if (orig && orig.profissional_id) transferHint = `transferida de DÉBITO (ESTORNADA) de ${getProfessionalNameBySeqId(orig.profissional_id)}`;
            }
        }
        const metaParts = [];
        if (isDebit) metaParts.push(`DÉBITO (ESTORNADA${transferHint ? '/' + transferHint : ''})`);
        else if (transferHint) metaParts.push(`CRÉDITO (${transferHint})`);
        const obsText = String(r.observacoes || '').trim();
        if (obsText) metaParts.push(obsText);
        const meta = metaParts.length ? `<div style="font-size:11px; color: var(--text-muted); margin-top:4px;">${escapeHtml(metaParts.join(' • '))}</div>` : '';
        const checked = selectedCommissionIds.has(id) ? 'checked' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="comm-check" data-id="${id}" ${checked}>
            </td>
            <td>${dt}</td>
            <td style="font-weight: 600; width: 320px; max-width: 320px; white-space: normal; word-break: break-word;">${escapeHtml(prof)}</td>
            <td style="text-align:center; font-weight:800;">${escapeHtml(orcSeq)}</td>
            <td style="white-space: normal;">${escapeHtml(item)}${meta}</td>
            <td style="text-align:right; font-weight:700;">${val}</td>
            <td><span class="badge badge-info">${status}</span></td>
        `;
        commissionsTableBody.appendChild(tr);
    });

    commissionsTableBody.querySelectorAll('.comm-check').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            if (!id) return;
            if (e.target.checked) selectedCommissionIds.add(String(id));
            else selectedCommissionIds.delete(String(id));
            syncCommissionSelectAll();
            updateCommissionSelectedTotal();
        });
    });

    syncCommissionSelectAll();
    updateCommissionSelectedTotal();
}

function syncCommissionSelectAll() {
    if (!commSelectAll) return;
    const ids = (commissionsList || []).map(r => String(r.id));
    if (ids.length === 0) {
        commSelectAll.checked = false;
        return;
    }
    commSelectAll.checked = ids.every(id => selectedCommissionIds.has(id));
}

async function markSelectedCommissionsPaid() {
    if (!can('comissoes', 'update')) {
        showToast('Você não possui permissão para marcar comissões como pagas.', true);
        return;
    }

    const ids = Array.from(selectedCommissionIds);
    if (!ids.length) {
        showToast('Selecione pelo menos uma comissão.', true);
        return;
    }

    const toPay = (commissionsList || []).filter(r => ids.includes(String(r.id)) && String(r.status || '') !== 'PAGA');
    if (!toPay.length) {
        showToast('Nenhuma comissão selecionada está pendente.', true);
        return;
    }

    const itemIds = Array.from(new Set(toPay.map(r => r && r.item_id).filter(Boolean).map(String)));
    if (itemIds.length) {
        try {
            const { data: itemsData, error: itErr } = await withTimeout(
                db.from('orcamento_itens').select('id,status').in('id', itemIds),
                15000,
                'orcamento_itens:status_for_comm_pay'
            );
            if (itErr) throw itErr;
            const statusById = new Map((itemsData || []).map(it => [String(it.id), String(it.status || '')]));
            const notFinal = itemIds.filter(id2 => normalizeKey(statusById.get(id2)) !== 'FINALIZADO');
            if (notFinal.length) {
                showToast(`Existem ${notFinal.length} itens não finalizados. Finalize no Atendimento antes de pagar a comissão.`, true);
                return;
            }
        } catch (e) {
            showToast('Não foi possível validar status dos itens para pagamento de comissão.', true);
            return;
        }
    }

    const total = toPay.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);
    const totalFmt = Number(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (!confirm(`Confirmar pagamento de ${toPay.length} comissões? Total: ${totalFmt}`)) return;

    const idsToPay = toPay.map(r => r.id);
    const payloadFull = { status: 'PAGA', data_pagamento: new Date().toISOString(), pago_por: currentUser?.id || null };
    const payloadFallback = { status: 'PAGA' };

    try {
        let q = db.from('financeiro_comissoes').update(payloadFull).in('id', idsToPay);
        if (!isSuperAdmin && currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
        const { error } = await withTimeout(q, 15000, 'financeiro_comissoes:update');
        if (error) throw error;
        showToast('Comissões marcadas como pagas.');
        resetCommissionSelection();
        await fetchCommissionsFromUI();
    } catch (err) {
        try {
            let q2 = db.from('financeiro_comissoes').update(payloadFallback).in('id', idsToPay);
            if (!isSuperAdmin && currentEmpresaId) q2 = q2.eq('empresa_id', currentEmpresaId);
            const { error: e2 } = await withTimeout(q2, 15000, 'financeiro_comissoes:update2');
            if (e2) throw e2;
            showToast('Comissões marcadas como pagas.');
            resetCommissionSelection();
            await fetchCommissionsFromUI();
        } catch (err2) {
            console.error('Erro ao marcar como paga:', err, err2);
            showToast('Erro ao marcar comissões como pagas.', true);
        }
    }
}

function printCommissionReceipt() {
    const ids = Array.from(selectedCommissionIds);
    const rows = (commissionsList || []).filter(r => ids.includes(String(r.id)));
    if (!rows.length) {
        showToast('Selecione pelo menos uma comissão para imprimir.', true);
        return;
    }

    const empresaLabel = getEmpresaName(currentEmpresaId);
    const issuedAt = formatDateTime(new Date().toISOString());
    const start = commStart ? commStart.value : '';
    const end = commEnd ? commEnd.value : '';
    const periodLabel = (start && end) ? `${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}` : '';

    const byTransferGroup = new Map();
    (commissionsList || []).forEach(r => {
        const g = r && (r.transfer_group_id || r.transferGroupId);
        if (!g) return;
        const k = String(g);
        if (!byTransferGroup.has(k)) byTransferGroup.set(k, []);
        byTransferGroup.get(k).push(r);
    });

    const grouped = new Map();
    rows.forEach(r => {
        const k = String(r.profissional_id || '');
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k).push(r);
    });

    const entries = Array.from(grouped.entries());
    const parts = [];
    entries.forEach(([profId, list], idx) => {
        const profName = getProfessionalNameBySeqId(profId);
        const totalSigned = list.reduce((acc, r) => {
            const v = Number(r.valor_comissao || 0);
            const isDebit = String(r.status || '') === 'ESTORNADA';
            return acc + (isDebit ? -v : v);
        }, 0);
        const totalAbsFmt = Number(Math.abs(totalSigned)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const totalFmt = (totalSigned < 0 ? '-' : '') + totalAbsFmt;
        const pageBreak = idx < (entries.length - 1) ? 'page-break-after: always;' : '';

        const rowsHtml = list.map(r => {
            const dt = r.data_geracao ? formatDateTime(r.data_geracao) : '-';
            const item = getCommissionItemLabel(r);
            const status = String(r.status || '-');
            const isDebit = status === 'ESTORNADA';
            const signed = (isDebit ? -1 : 1) * Number(r.valor_comissao || 0);
            const absFmt = Number(Math.abs(signed)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const val = (signed < 0 ? '-' : '') + absFmt;

            const g = r && (r.transfer_group_id || r.transferGroupId);
            let transferHint = '';
            if (g) {
                const groupRows = byTransferGroup.get(String(g)) || [];
                if (isDebit) {
                    const dest = groupRows.find(x => String(x.status || '') !== 'ESTORNADA');
                    if (dest && dest.profissional_id) transferHint = `transferida para CRÉDITO de ${getProfessionalNameBySeqId(dest.profissional_id)}`;
                } else {
                    const orig = groupRows.find(x => String(x.status || '') === 'ESTORNADA');
                    if (orig && orig.profissional_id) transferHint = `transferida de DÉBITO (ESTORNADA) de ${getProfessionalNameBySeqId(orig.profissional_id)}`;
                }
            }

            const tipoLabel = isDebit
                ? (transferHint ? `DÉBITO (ESTORNADA/${transferHint})` : 'DÉBITO (ESTORNADA)')
                : (transferHint ? `CRÉDITO (${transferHint})` : 'CRÉDITO');
            const obsText = String(r.observacoes || '').trim();
            const meta = [tipoLabel, status].filter(Boolean).join(' • ');
            const metaHtml = meta ? `<div style="font-size:11px; color:#374151; margin-top:4px;">${escapeHtml(meta)}</div>` : '';
            const obsHtml = obsText ? `<div style="font-size:11px; color:#6b7280; margin-top:4px;">${escapeHtml(obsText)}</div>` : '';

            return `<tr style="border-bottom: 1px solid #000;">
                <td style="padding: 6px 8px;">${dt}</td>
                <td style="padding: 6px 8px;">${item}${metaHtml}${obsHtml}</td>
                <td style="padding: 6px 8px; text-align:right; font-weight:700;">${val}</td>
            </tr>`;
        }).join('');

        parts.push(`
            <div class="term-print-container" style="${pageBreak}">
                <div class="term-header">
                    <div style="font-size: 22px; font-weight: bold; color: #000;">RECIBO DE COMISSÃO</div>
                    <div style="margin-top: 6px; text-align:center; line-height:1.05;">
                        <div style="font-weight:800;">${empresaLabel}</div>
                        <div style="height: 8px;"></div>
                        <div style="font-size:12px; font-weight:600; color:#6b7280;">Emitido em ${issuedAt} via OCC - Odonto Connect Cloud</div>
                        <div style="height: 8px;"></div>
                    </div>
                </div>

                <div style="margin: 18px 0;">
                    <p><strong>Profissional:</strong> ${profName}</p>
                    ${periodLabel ? `<p><strong>Período:</strong> ${periodLabel}</p>` : ''}
                </div>

                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
                    <thead>
                        <tr style="border-bottom: 1px solid #000;">
                            <th style="padding: 8px; text-align:left;">Data</th>
                            <th style="padding: 8px; text-align:left;">Item</th>
                            <th style="padding: 8px; text-align:right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr>
                            <td colspan="2" style="padding: 10px; text-align:right; font-weight:800;">Total</td>
                            <td style="padding: 10px; text-align:right; font-weight:900;">${totalFmt}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="margin-top: 22px; text-align: justify;">
                    <p>Declaro para os devidos fins que recebi o valor acima referente às comissões listadas neste recibo.</p>
                </div>

                <div class="term-footer">
                    <div class="sig-box">
                        <strong>${profName}</strong><br>Assinatura do Profissional
                    </div>
                    <div class="sig-box">
                        <strong>${empresaLabel}</strong><br>Clínica / Consultório
                    </div>
                </div>
            </div>
        `);
    });

    openPrintWindow(parts.join(''), 'Recibo de Comissão');
}

function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function escapeHtml(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const HELP_PAGES = {
    dashboardView: { title: 'Dashboard', manualAnchor: 'dashboard' },

    patientListView: { title: 'Pacientes', manualAnchor: 'pacientes' },
    patientFormView: { title: 'Pacientes', manualAnchor: 'pacientes' },
    patientDetailsView: { title: 'Pacientes', manualAnchor: 'pacientes' },

    professionalListView: { title: 'Profissionais', manualAnchor: 'profissionais' },
    professionalFormView: { title: 'Profissionais', manualAnchor: 'profissionais' },

    specialtiesListView: { title: 'Especialidades', manualAnchor: 'especialidades' },
    specialtyFormView: { title: 'Especialidades', manualAnchor: 'especialidades' },

    servicesListView: { title: 'Serviços', manualAnchor: 'servicos' },
    serviceFormView: { title: 'Serviços', manualAnchor: 'servicos' },

    budgetsListView: { title: 'Orçamentos', manualAnchor: 'orcamentos' },
    budgetFormView: { title: 'Orçamentos', manualAnchor: 'orcamentos' },

    financeiroView: { title: 'Financeiro', manualAnchor: 'financeiro' },
    commissionsView: { title: 'Comissões', manualAnchor: 'comissoes' },
    atendimentoView: { title: 'Atendimento', manualAnchor: 'atendimento' },
    agendaView: { title: 'Agenda', manualAnchor: 'agenda' },
    proteseView: { title: 'Produção Protética', manualAnchor: 'producao_protetica' },
    cancelledBudgetsView: { title: 'Audit Cancelamentos', manualAnchor: 'audit_cancelamentos' },

    usersAdminView: { title: 'Gerenciar Usuários', manualAnchor: 'usuarios' },
    userAdminFormView: { title: 'Gerenciar Usuários', manualAnchor: 'usuarios' }
};

function getActiveSectionId() {
    const active = document.querySelector('section.view-section.active');
    if (active && active.id) return String(active.id);

    const visible = document.querySelector('section.view-section:not(.hidden)');
    if (visible && visible.id) return String(visible.id);

    const navActive = document.querySelector('.sidebar-nav .nav-item.active[id]');
    if (navActive) {
        const navId = String(navActive.id || '');
        const map = {
            navDashboard: 'dashboardView',
            navPatients: 'patientListView',
            navProfessionals: 'professionalListView',
            navSpecialties: 'specialtiesListView',
            navServices: 'servicesListView',
            navBudgets: 'budgetsListView',
            navFinanceiro: 'financeiroView',
            navCommissions: 'commissionsView',
            navAtendimento: 'atendimentoView',
            navAgenda: 'agendaView',
            navProtese: 'proteseView',
            navUsersAdmin: 'usersAdminView',
            navCancelledBudgets: 'cancelledBudgetsView',
            navEmpresas: 'empresasListView'
        };
        return map[navId] || '';
    }

    return '';
}

function openHelpModalForSection(sectionId) {
    if (!helpModal || !helpModalTitle || !helpModalBody) return;
    const page = HELP_PAGES[sectionId] || null;
    const title = page ? page.title : 'Ajuda';
    const manualAnchor = page && page.manualAnchor ? String(page.manualAnchor) : '';
    const manualUrl = manualAnchor ? `docs/manual_occ.html#${encodeURIComponent(manualAnchor)}` : 'docs/manual_occ.html';
    const html = `
        <div style="display:flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: baseline; margin-bottom: 10px;">
            <div style="color:#6b7280; font-size: 12px;">
                Conteúdo do Manual do Usuário
            </div>
            <div style="display:flex; gap: 10px; flex-wrap: wrap;">
                <a href="${manualUrl}" target="_blank" rel="noopener noreferrer" style="color:#0066cc; text-decoration:none; font-weight:800;">Abrir em nova aba</a>
                <a href="docs/Manual_OCC.pdf" target="_blank" rel="noopener noreferrer" style="color:#0066cc; text-decoration:none; font-weight:800;">Abrir PDF</a>
            </div>
        </div>
        <iframe
            src="${manualUrl}"
            style="width: 100%; height: 72vh; border: 1px solid #e5e7eb; border-radius: 10px;"
        ></iframe>
    `;
    helpModalTitle.textContent = title;
    helpModalBody.innerHTML = html;
    helpModal.classList.remove('hidden');
}

function closeHelpModal() {
    if (!helpModal) return;
    helpModal.classList.add('hidden');
}

function initHelpHotkey() {
    if (window.__helpBound) return;
    window.__helpBound = true;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            openHelpModalForSection(getActiveSectionId());
            return;
        }
        if (e.key === 'Escape') {
            if (helpModal && !helpModal.classList.contains('hidden')) closeHelpModal();
        }
    }, true);
    if (btnCloseHelpModal) btnCloseHelpModal.addEventListener('click', closeHelpModal);
    if (btnCloseHelpModal2) btnCloseHelpModal2.addEventListener('click', closeHelpModal);
    if (helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelpModal(); });
}

initHelpHotkey();

function openCommissionTransferModal() {
    if (!can('comissoes', 'update')) {
        showToast('Você não possui permissão para alterar comissões.', true);
        return;
    }

    const ids = Array.from(selectedCommissionIds);
    if (ids.length !== 1) {
        showToast('Selecione exatamente 1 comissão para trocar o profissional.', true);
        return;
    }

    const comm = (commissionsList || []).find(r => String(r.id) === String(ids[0]));
    if (!comm) {
        showToast('Comissão não encontrada na lista.', true);
        return;
    }

    const status = String(comm.status || '');
    if (status === 'ESTORNADA') {
        showToast('Esta comissão já está estornada.', true);
        return;
    }

    const modal = document.getElementById('commTransferModal');
    const selNew = document.getElementById('commTransferNewProfessional');
    const obsEl = document.getElementById('commTransferObs');
    const summary = document.getElementById('commTransferSummary');
    if (!modal || !selNew || !obsEl || !summary) return;

    const profAtual = getProfessionalNameBySeqId(comm.profissional_id);
    const item = getCommissionItemLabel(comm);
    const valFmt = Number(comm.valor_comissao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    summary.textContent = `${profAtual} • ${item} • ${valFmt} • ${status || '-'}`;

    const currentProfSeq = Number(comm.profissional_id);
    const options = (professionals || [])
        .filter(p => Number(p.seqid) !== currentProfSeq)
        .map(p => `<option value="${p.seqid}">${p.nome}</option>`)
        .join('');
    selNew.innerHTML = `<option value="">Selecione...</option>${options}`;

    obsEl.value = '';
    modal.classList.remove('hidden');
}

async function transferSelectedCommission() {
    if (!can('comissoes', 'update')) {
        showToast('Você não possui permissão para alterar comissões.', true);
        return;
    }

    const ids = Array.from(selectedCommissionIds);
    if (ids.length !== 1) {
        showToast('Selecione exatamente 1 comissão.', true);
        return;
    }

    const comm = (commissionsList || []).find(r => String(r.id) === String(ids[0]));
    if (!comm) {
        showToast('Comissão não encontrada.', true);
        return;
    }

    const modal = document.getElementById('commTransferModal');
    const selNew = document.getElementById('commTransferNewProfessional');
    const obsEl = document.getElementById('commTransferObs');
    if (!modal || !selNew || !obsEl) return;

    const newProfId = Number(selNew.value);
    const obs = String(obsEl.value || '').trim();
    if (!Number.isFinite(newProfId) || newProfId <= 0) {
        showToast('Selecione o novo profissional.', true);
        return;
    }
    if (obs.length < 5) {
        showToast('A observação é obrigatória (mín. 5 caracteres).', true);
        return;
    }

    const status = String(comm.status || '');
    if (status === 'PAGA' && !(isSuperAdmin || currentUserRole === 'admin' || currentUserRole === 'supervisor')) {
        const enteredPin = prompt('Autorização superior: informe a senha do supervisor');
        if (!enteredPin) return;
        const { data: emp, error: empErr } = await withTimeout(
            db.from('empresas').select('supervisor_pin').eq('id', currentEmpresaId).single(),
            15000,
            'empresas:supervisor_pin'
        );
        if (empErr) {
            showToast('Erro ao validar autorização.', true);
            return;
        }
        if (String(enteredPin) !== String(emp?.supervisor_pin || '')) {
            showToast('Senha de supervisor incorreta!', true);
            return;
        }
    }

    const profAtual = getProfessionalNameBySeqId(comm.profissional_id);
    const profNovo = getProfessionalNameBySeqId(newProfId);
    const item = getCommissionItemLabel(comm);
    const valFmt = Number(comm.valor_comissao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const confirmMsg =
        `Confirmar troca de profissional desta comissão?\n\n` +
        `De: ${profAtual}\n` +
        `Para: ${profNovo}\n` +
        `Item: ${item}\n` +
        `Valor: ${valFmt}\n\n` +
        `A comissão atual será marcada como ESTORNADA e será criada uma nova comissão para o novo profissional.`;
    if (!confirm(confirmMsg)) return;

    try {
        const nowIso = new Date().toISOString();
        const transferGroupId = createUuid();
        const obsFinal = `Transferência de comissão: de ${profAtual} para ${profNovo}. ${obs}`;
        const updateFull = { status: 'ESTORNADA', estornado_em: nowIso, estornado_por: currentUser?.id || null, observacoes: obsFinal, transfer_group_id: transferGroupId };
        const updateFallback = { status: 'ESTORNADA' };

        let u = db.from('financeiro_comissoes').update(updateFull).eq('id', comm.id);
        if (!isSuperAdmin && currentEmpresaId) u = u.eq('empresa_id', currentEmpresaId);
        const { error: uErr } = await withTimeout(u, 15000, 'financeiro_comissoes:estornar');
        if (uErr) {
            let u2 = db.from('financeiro_comissoes').update(updateFallback).eq('id', comm.id);
            if (!isSuperAdmin && currentEmpresaId) u2 = u2.eq('empresa_id', currentEmpresaId);
            const { error: uErr2 } = await withTimeout(u2, 15000, 'financeiro_comissoes:estornar2');
            if (uErr2) throw uErr2;
        }

        const newStatus = status === 'PAGA' ? 'PENDENTE' : (status || 'PENDENTE');
        const insertFull = {
            profissional_id: newProfId,
            item_id: comm.item_id,
            valor_comissao: Number(comm.valor_comissao || 0),
            status: newStatus,
            data_geracao: nowIso,
            empresa_id: currentEmpresaId,
            criado_por: currentUser?.id || null,
            observacoes: obsFinal,
            transfer_group_id: transferGroupId
        };
        const insertFallback = {
            profissional_id: newProfId,
            item_id: comm.item_id,
            valor_comissao: Number(comm.valor_comissao || 0),
            status: newStatus,
            empresa_id: currentEmpresaId
        };

        let ins = await withTimeout(db.from('financeiro_comissoes').insert(insertFull).select('*'), 15000, 'financeiro_comissoes:insert_new');
        if (ins.error) {
            ins = await withTimeout(db.from('financeiro_comissoes').insert(insertFallback).select('*'), 15000, 'financeiro_comissoes:insert_new2');
            if (ins.error) throw ins.error;
        }

        modal.classList.add('hidden');
        resetCommissionSelection();
        await fetchCommissionsFromUI();
        showToast('Troca de profissional registrada em Comissões.');
    } catch (err) {
        console.error('Erro ao trocar profissional na comissão:', err);
        showToast('Erro ao trocar profissional na comissão.', true);
    }
}

if (btnCommSearch) btnCommSearch.addEventListener('click', () => fetchCommissionsFromUI());
if (btnCommPay) btnCommPay.addEventListener('click', () => markSelectedCommissionsPaid());
if (btnCommTransfer) btnCommTransfer.addEventListener('click', () => openCommissionTransferModal());
if (btnCommPrint) btnCommPrint.addEventListener('click', () => printCommissionReceipt());
if (commStatus) commStatus.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
if (commProfessional) commProfessional.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
if (commStart) commStart.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
if (commEnd) commEnd.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
const btnCommTransferCancel = document.getElementById('btnCommTransferCancel');
const btnCommTransferConfirm = document.getElementById('btnCommTransferConfirm');
if (btnCommTransferCancel) btnCommTransferCancel.addEventListener('click', () => document.getElementById('commTransferModal')?.classList.add('hidden'));
if (btnCommTransferConfirm) btnCommTransferConfirm.addEventListener('click', () => transferSelectedCommission());
if (commSelectAll) commSelectAll.addEventListener('change', (e) => {
    if (!e.target.checked) {
        resetCommissionSelection();
        renderCommissionsTable(commissionsList, commStatus ? commStatus.value : 'A_PAGAR');
        return;
    }
    (commissionsList || []).forEach(r => selectedCommissionIds.add(String(r.id)));
    renderCommissionsTable(commissionsList, commStatus ? commStatus.value : 'A_PAGAR');
});

// Global action to delete user mapping
window.removeTenantUser = async function (mappingId) {
    const rec = usersAdminList.find(x => String(x.id || '') === String(mappingId || ''))
        || usersAdminList.find(x => String(x.usuario_id || x.user_id || '') === String(mappingId || ''));
    if (!rec) {
        showToast('Usuário não encontrado para revogar.', true);
        return;
    }
    const usuario_id = rec.usuario_id || rec.user_id || '';
    if (!usuario_id) {
        if (!confirm('Este registro não possui usuario_id. Revogar o acesso removendo apenas o mapeamento?')) return;
        try {
            const { error } = await db.from('usuario_empresas').delete().eq('id', rec.id);
            if (error) throw error;
            showToast('Acesso revogado com sucesso!');
            showList('usersAdmin');
        } catch (error) {
            console.error("Error revoking user access:", error);
            showToast("Erro ao remover usuário.", true);
        }
        return;
    }
    const blockers = [];
    try {
        if (currentEmpresaId) {
            blockers.push({
                label: 'Agenda (Agendamentos)',
                count: await countExact(
                    db.from('agenda_agendamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('criado_por', usuario_id),
                    'agenda_agendamentos:user'
                )
            });
            blockers.push({
                label: 'Prontuário',
                count: await countExact(
                    db.from('paciente_evolucao').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('created_by', usuario_id),
                    'paciente_evolucao:user'
                )
            });
            blockers.push({
                label: 'Documentos',
                count: await countExact(
                    db.from('paciente_documentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('created_by', usuario_id),
                    'paciente_documentos:user'
                )
            });
            blockers.push({
                label: 'Cancelamentos',
                count: await countExact(
                    db.from('orcamento_cancelados').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('cancelado_por_id', usuario_id),
                    'orcamento_cancelados:user'
                )
            });
            blockers.push({
                label: 'Comissões pagas',
                count: await countExact(
                    db.from('financeiro_comissoes').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('pago_por', usuario_id),
                    'financeiro_comissoes:user'
                )
            });
        }
    } catch (error) {
        console.error("Error checking user dependencies:", error);
        showToast("Erro ao validar vínculos do usuário.", true);
        return;
    }

    const blockedMsg = formatBlockers(blockers);
    if (blockedMsg) {
        showToast(`Não é possível revogar: ${blockedMsg}`, true);
        return;
    }

    if (confirm('Tem certeza que deseja REVOGAR O ACESSO deste usuário à sua clínica? Este usuário não poderá mais entrar no sistema.')) {
        try {
            const delQ = db.from('usuario_empresas').delete().eq('id', rec.id);
            const { error } = await delQ;
            if (error) throw error;
            showToast('Acesso revogado com sucesso!');
            showList('usersAdmin'); // refresh table
        } catch (error) {
            console.error("Error revoking user access:", error);
            showToast("Erro ao remover usuário.", true);
        }
    }
};

window.editTenantUser = function (mappingId) {
    const u = usersAdminList.find(user => String(user.id || '') === String(mappingId || ''))
        || usersAdminList.find(user => String(user.usuario_id || user.user_id || '') === String(mappingId || ''));
    if (!u) { showToast('Usuário não encontrado para edição.', true); return; }

    showForm(true, 'usersAdmin');
    document.getElementById('userAdminFormTitle').innerText = 'Editar Usuário';
    document.getElementById('editAdminUserId').value = String(u.id || '');

    const emailInput = document.getElementById('adminUserEmail');
    emailInput.value = u.user_email || '';
    emailInput.readOnly = true;
    emailInput.classList.add('readonly-input');

    const passInput = document.getElementById('adminUserPassword');
    passInput.required = false;
    passInput.placeholder = '(Deixe em branco para manter a atual)';

    document.getElementById('adminUserRole').value = u.perfil || '';

    // Load permissions
    const perms = (u.permissoes && typeof u.permissoes === 'object') ? u.permissoes : {};
    renderPermissionsGrid(perms);
};

function showToast(message, isError = false) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    toastMsg.innerText = message;
    if (isError) {
        toast.classList.add('toast-error');
        toastIcon.className = 'ri-error-warning-line';
    } else {
        toast.classList.remove('toast-error');
        toastIcon.className = 'ri-check-line';
    }

    toast.classList.remove('hidden');
    // slight delay for transition
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// Generate an ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

function updateHeaderCompanyBox() {
    const nameEl = document.getElementById('headerCompanyName');
    const logoEl = document.getElementById('headerCompanyLogo');
    if (!nameEl || !logoEl) return;

    const e = currentEmpresaId ? activeEmpresasList.find(emp => emp.id === currentEmpresaId) : null;
    const nome = e && e.nome ? e.nome : getEmpresaName(currentEmpresaId);
    nameEl.textContent = nome || '—';

    const logo = e && e.logotipo ? String(e.logotipo) : '';
    if (logo) {
        logoEl.src = logo;
        logoEl.classList.remove('hidden');
    } else {
        logoEl.removeAttribute('src');
        logoEl.classList.add('hidden');
    }
}

function resetAgendaForm() {
    agendaFields.forEach(f => {
        if (f.enabled) f.enabled.checked = false;
        if (f.start) f.start.value = '';
        if (f.end) f.end.value = '';
        if (f.slot) f.slot.value = '30';
        if (f.start) f.start.disabled = true;
        if (f.end) f.end.disabled = true;
        if (f.slot) f.slot.disabled = true;
    });
}

function attachAgendaListeners() {
    agendaFields.forEach(f => {
        if (!f.enabled) return;
        f.enabled.addEventListener('change', () => {
            const on = Boolean(f.enabled.checked);
            if (f.start) f.start.disabled = !on;
            if (f.end) f.end.disabled = !on;
            if (f.slot) f.slot.disabled = !on;
        });
    });
}

function initAgendaFilters() {
    if (agendaProfessional) {
        const opts = ['<option value="">Selecione...</option>'];
        (professionals || [])
            .slice()
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                opts.push(`<option value="${p.seqid}">${p.nome}</option>`);
            });
        agendaProfessional.innerHTML = opts.join('');
    }

    if (agendaPaciente) {
        const opts = ['<option value="">(Sem paciente)</option>'];
        (patients || [])
            .slice()
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                if (!p.seqid) return;
                const cpf = p.cpf ? `CPF: ${p.cpf}` : '';
                const cel = p.celular ? `Cel: ${p.celular}` : '';
                const em = p.email ? `Email: ${p.email}` : '';
                const parts = [cpf, cel, em].filter(Boolean).join(' | ');
                const label = parts ? `${p.nome} — ${parts}` : String(p.nome || '');
                opts.push(`<option value="${p.seqid}">${label}</option>`);
            });
        agendaPaciente.innerHTML = opts.join('');
    }

    if (agendaDate && !agendaDate.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        agendaDate.value = `${yyyy}-${mm}-${dd}`;
    }

    const shouldAuto = currentUserRole === 'dentista';
    if (agendaProfessionalGroup) agendaProfessionalGroup.style.display = shouldAuto ? 'none' : '';

    if (agendaProfessional) {
        agendaProfessional.disabled = false;
    }

    if (shouldAuto && agendaProfessional) {
        const uEmail = String(currentUser?.email || '').trim().toLowerCase();
        const prof = (professionals || []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
        if (prof && prof.seqid) {
            agendaProfessional.innerHTML = `<option value="${prof.seqid}">${escapeHtml(String(prof.nome || ''))}</option>`;
            agendaProfessional.value = String(prof.seqid);
            agendaProfessional.disabled = true;
        } else {
            if (agendaProfessionalGroup) agendaProfessionalGroup.style.display = '';
        }
    }
}

function renderAgendaPlaceholder(msg = 'Selecione a data e o profissional.') {
    if (agendaSlotsBody) {
        agendaSlotsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">${msg}</td></tr>`;
    }
    if (agendaEmptyState) agendaEmptyState.classList.add('hidden');
    if (agendaSummary) agendaSummary.textContent = '—';
}

function jsDayToAgendaDiaSemana(jsDay) {
    if (jsDay === 0) return 7;
    return jsDay;
}

function toLocalDatetimeInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function buildDayDateRangeUTC(localDateStr) {
    const start = new Date(`${localDateStr}T00:00:00`);
    const end = new Date(`${localDateStr}T23:59:59`);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function buildWeekDateRangeUTC(anyLocalDateStr) {
    const d = new Date(`${anyLocalDateStr}T00:00:00`);
    const jsDay = d.getDay();
    const mondayOffset = jsDay === 0 ? -6 : (1 - jsDay);
    const monday = new Date(d.getTime() + mondayOffset * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const start = new Date(`${monday.toISOString().slice(0, 10)}T00:00:00`);
    const end = new Date(`${sunday.toISOString().slice(0, 10)}T23:59:59`);
    return {
        weekStart: monday.toISOString().slice(0, 10),
        weekEnd: sunday.toISOString().slice(0, 10),
        startIso: start.toISOString(),
        endIso: end.toISOString()
    };
}

async function fetchAgendaForUI() {
    if (!agendaProfessional || !agendaDate) return;
    let profSeqId = agendaProfessional.value;
    const dateStr = agendaDate.value;

    if (!profSeqId && currentUserRole === 'dentista') {
        const uEmail = String(currentUser?.email || '').trim().toLowerCase();
        const prof = (professionals || []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
        if (prof && prof.seqid) {
            agendaProfessional.value = String(prof.seqid);
            profSeqId = agendaProfessional.value;
            if (agendaProfessional) agendaProfessional.disabled = true;
            if (agendaProfessionalGroup) agendaProfessionalGroup.style.display = 'none';
        }
    }

    if (!profSeqId || !dateStr) {
        renderAgendaPlaceholder();
        return;
    }
    await fetchAgendaDay({ empresaId: currentEmpresaId, profSeqId: Number(profSeqId), dateStr });
}

async function fetchAgendaDay({ empresaId, profSeqId, dateStr }) {
    try {
        if (!empresaId) {
            renderAgendaPlaceholder('Empresa não definida.');
            return;
        }
        if (agendaSlotsBody) {
            agendaSlotsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (agendaEmptyState) agendaEmptyState.classList.add('hidden');

        const jsDay = new Date(`${dateStr}T00:00:00`).getDay();
        const diaSemana = jsDayToAgendaDiaSemana(jsDay);

        const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
        const agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .gte('inicio', startIso)
            .lte('inicio', endIso)
            .order('inicio', { ascending: true });
        const { data: ags, error: agErr } = await withTimeout(agQ, 15000, 'agenda_agendamentos');
        if (agErr) throw agErr;

        const dispQ = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .eq('dia_semana', diaSemana)
            .eq('ativo', true);
        const { data: disp, error: dispErr } = await withTimeout(dispQ, 15000, 'agenda_disponibilidade');
        if (dispErr) throw dispErr;

        window.__agendaLast = window.__agendaLast || { empresaId: null, profSeqId: null, dateStr: null, disponibilidade: [], agendamentos: [] };
        window.__agendaLast.empresaId = empresaId;
        window.__agendaLast.profSeqId = Number(profSeqId);
        window.__agendaLast.dateStr = dateStr;
        window.__agendaLast.agendamentos = ags || [];

        if (!disp || disp.length === 0) {
            window.__agendaLast.disponibilidade = [];
            if (agendaSummary) agendaSummary.textContent = `${getProfessionalNameBySeqId(profSeqId)} — ${dateStr.split('-').reverse().join('/')} • Sem disponibilidade cadastrada`;

            if (!ags || ags.length === 0) {
                if (agendaSlotsBody) agendaSlotsBody.innerHTML = '';
                if (agendaEmptyState) agendaEmptyState.classList.remove('hidden');
                return;
            }

            if (agendaEmptyState) agendaEmptyState.classList.add('hidden');
            if (agendaSlotsBody) agendaSlotsBody.innerHTML = '';

            (ags || []).forEach(a => {
                const tr = document.createElement('tr');
                const hora = a.inicio ? formatTimeHHMM(new Date(a.inicio)) : '--:--';
                const pacienteHtml = a.paciente_id
                    ? getPacienteSummaryHtmlBySeqId(a.paciente_id)
                    : `<span style="color: var(--text-muted);">${escapeHtml(String(a.titulo || '(Sem paciente)'))}</span>`;
                tr.innerHTML = `
                    <td style="font-weight:700;">${escapeHtml(hora)}</td>
                    <td>${pacienteHtml}</td>
                    <td>${escapeHtml(String(a.status || 'MARCADO'))}</td>
                    <td><button class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}"><i class="ri-edit-line"></i> Editar</button></td>
                `;
                agendaSlotsBody.appendChild(tr);
            });
            agendaSlotsBody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const a = (window.__agendaLast && Array.isArray(window.__agendaLast.agendamentos)) ? window.__agendaLast.agendamentos.find(x => String(x.id) === String(id)) : null;
                    if (a) openAgendaModalEdit(a);
                });
            });
            return;
        }

        window.__agendaLast.disponibilidade = disp || [];

        renderAgendaSlots({ dateStr, profSeqId, disponibilidade: disp, agendamentos: ags || [] });
    } catch (err) {
        console.error('Erro ao carregar agenda:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        renderAgendaPlaceholder(`Falha ao carregar Agenda (${code}).`);
        showToast(`Erro ao carregar Agenda (${code}): ${msg}`, true);
    }
}

function parseTimeToMinutes(t) {
    const [h, m] = String(t || '').split(':').map(x => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function formatTimeHHMM(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function getPacienteNameBySeqId(seqId) {
    if (!seqId) return '';
    const p = (patients || []).find(x => String(x.seqid) === String(seqId));
    return p ? p.nome : `Paciente #${seqId}`;
}

function getPacienteDetailsBySeqId(seqId) {
    if (!seqId) return null;
    const p = (patients || []).find(x => String(x.seqid) === String(seqId));
    return p || null;
}

function getPacienteSummaryHtmlBySeqId(seqId) {
    const p = getPacienteDetailsBySeqId(seqId);
    if (!p) return `Paciente #${seqId || '-'}`;

    const parts = [];
    if (p.cpf) parts.push(`CPF: ${p.cpf}`);
    if (p.celular) parts.push(`Cel: ${p.celular}`);
    if (p.email) parts.push(`Email: ${p.email}`);

    const meta = parts.length ? parts.join(' • ') : '';
    return `
        <div style="display:flex; flex-direction:column; gap:2px; line-height:1.1;">
            <div style="font-weight:700;">${p.nome || '-'}</div>
            ${meta ? `<div style="font-size:0.78rem; color: var(--text-muted);">${meta}</div>` : ''}
        </div>
    `;
}

function renderAgendaSlots({ dateStr, profSeqId, disponibilidade, agendamentos }) {
    if (!agendaSlotsBody) return;

    const slots = [];
    const slotStepByTime = new Map();
    disponibilidade.forEach(d => {
        const startM = parseTimeToMinutes(d.hora_inicio);
        const endM = parseTimeToMinutes(d.hora_fim);
        const step = Number(d.slot_minutos || 30);
        if (startM == null || endM == null || !step) return;

        for (let m = startM; m + step <= endM; m += step) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            const time = `${hh}:${mm}`;
            slots.push({ time, step });
            if (!slotStepByTime.has(time)) slotStepByTime.set(time, step);
        }
    });

    if (!slots.length) {
        agendaSlotsBody.innerHTML = '';
        if (agendaEmptyState) agendaEmptyState.classList.remove('hidden');
        if (agendaSummary) agendaSummary.textContent = 'Sem slots para este dia.';
        return;
    }

    const byStart = new Map();
    (agendamentos || []).forEach(a => {
        const start = new Date(a.inicio);
        const key = formatTimeHHMM(start);
        if (!byStart.has(key)) byStart.set(key, a);
    });

    const isWithinDisponibilidade = (time) => {
        const m = parseTimeToMinutes(`${time}:00`);
        if (m == null) return false;
        return (disponibilidade || []).some(r => {
            const s = parseTimeToMinutes(r.hora_inicio);
            const e = parseTimeToMinutes(r.hora_fim);
            if (s == null || e == null) return false;
            return m >= s && m < e;
        });
    };

    const profName = getProfessionalNameBySeqId(profSeqId);
    if (agendaSummary) agendaSummary.textContent = `${profName} — ${dateStr.split('-').reverse().join('/')}`;

    agendaSlotsBody.innerHTML = '';
    const timesSet = new Set(slots.map(s => s.time));
    Array.from(byStart.keys()).forEach(t => timesSet.add(t));
    const times = Array.from(timesSet).sort((a, b) => a.localeCompare(b));

    times.forEach(time => {
        const a = byStart.get(time);
        const hasDisp = isWithinDisponibilidade(time);
        if (!hasDisp && !a) return;

        const step = slotStepByTime.get(time) || 30;
        const pacienteHtml = a
            ? (a.paciente_id ? getPacienteSummaryHtmlBySeqId(a.paciente_id) : `<span style="color: var(--text-muted);">${a.titulo || '(Sem paciente)'}</span>`)
            : '';
        const statusRaw = a ? String(a.status || 'MARCADO') : 'LIVRE';
        const status = a && !hasDisp ? `${statusRaw} (Fora da disponibilidade)` : statusRaw;

        const tr = document.createElement('tr');
        if (a && !hasDisp) tr.style.background = '#fff7ed';
        tr.innerHTML = `
            <td style="font-weight:700;">${time}</td>
            <td>${a ? (pacienteHtml || '-') : '-'}</td>
            <td>${status}</td>
            <td>
                ${a ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}"><i class="ri-edit-line"></i> Editar</button>` :
            `<button class="btn btn-primary btn-sm" data-action="new" data-time="${time}" data-step="${step}"><i class="ri-add-line"></i> Agendar</button>`}
            </td>
        `;
        agendaSlotsBody.appendChild(tr);
    });

    agendaSlotsBody.querySelectorAll('button[data-action="new"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const time = btn.getAttribute('data-time');
            const step = parseInt(btn.getAttribute('data-step') || '30', 10);
            openAgendaModalNew({ dateStr, time, step, profSeqId });
        });
    });
    agendaSlotsBody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const a = (agendamentos || []).find(x => String(x.id) === String(id));
            if (a) openAgendaModalEdit(a);
        });
    });
}

function buildAgendaDayRowsForPrint({ dateStr, disponibilidade, agendamentos }) {
    const slots = [];
    (disponibilidade || []).forEach(d => {
        const startM = parseTimeToMinutes(d.hora_inicio);
        const endM = parseTimeToMinutes(d.hora_fim);
        const step = Number(d.slot_minutos || 30);
        if (startM == null || endM == null || !step) return;
        for (let m = startM; m + step <= endM; m += step) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            slots.push({ time: `${hh}:${mm}` });
        }
    });

    const byStart = new Map();
    (agendamentos || []).forEach(a => {
        const start = new Date(a.inicio);
        const key = formatTimeHHMM(start);
        if (!byStart.has(key)) byStart.set(key, a);
    });

    const isWithinDisponibilidade = (time) => {
        const m = parseTimeToMinutes(`${time}:00`);
        if (m == null) return false;
        return (disponibilidade || []).some(r => {
            const s = parseTimeToMinutes(r.hora_inicio);
            const e = parseTimeToMinutes(r.hora_fim);
            if (s == null || e == null) return false;
            return m >= s && m < e;
        });
    };

    const timesSet = new Set((slots || []).map(s => s.time));
    Array.from(byStart.keys()).forEach(t => timesSet.add(t));

    return Array.from(timesSet)
        .sort((a, b) => a.localeCompare(b))
        .map(time => {
            const a = byStart.get(time);
            const hasDisp = isWithinDisponibilidade(time);
            if (!hasDisp && !a) return '';
            if (!a) {
                return `<tr><td style="width: 90px; font-weight:700;">${time}</td><td style="color:#6b7280;">—</td><td style="width: 120px;">LIVRE</td></tr>`;
            }

            const p = a.paciente_id ? getPacienteDetailsBySeqId(a.paciente_id) : null;
            const paciente = p ? (p.nome || '-') : (a.titulo || '(Sem paciente)');
            const cpf = p && p.cpf ? p.cpf : '';
            const cel = p && p.celular ? p.celular : '';
            const em = p && p.email ? p.email : '';
            const meta = [cpf && `CPF: ${cpf}`, cel && `Cel: ${cel}`, em && `Email: ${em}`].filter(Boolean).join(' • ');
            const statusBase = String(a.status || 'MARCADO');
            const status = !hasDisp ? `${statusBase} (Fora da disponibilidade)` : statusBase;
            const trStyle = !hasDisp ? ' style="background:#fff7ed;"' : '';

            return `
                <tr${trStyle}>
                    <td style="width: 90px; font-weight:700;">${time}</td>
                    <td>
                        <div style="font-weight:700;">${paciente}</div>
                        ${meta ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${meta}</div>` : ''}
                    </td>
                    <td style="width: 120px;">${status}</td>
                </tr>
            `;
        })
        .filter(Boolean)
        .join('');
}

async function printAgendaDay() {
    if (!agendaDate || !agendaProfessional) return;
    const dateStr = agendaDate.value;
    const profSeqId = agendaProfessional.value;
    if (!dateStr || !profSeqId) {
        showToast('Selecione data e profissional.', true);
        return;
    }

    await fetchAgendaForUI();

    const last = window.__agendaLast;
    if (!last || String(last.dateStr) !== String(dateStr) || String(last.profSeqId) !== String(profSeqId)) {
        showToast('Atualize a agenda antes de imprimir.', true);
        return;
    }

    const profName = getProfessionalNameBySeqId(profSeqId);
    const empresaLabel = getEmpresaName(currentEmpresaId);
    const dateLabel = formatDateBR(dateStr);
    const issuedAt = formatDateTime(new Date().toISOString());
    const rowsHtml = buildAgendaDayRowsForPrint({ dateStr, disponibilidade: last.disponibilidade || [], agendamentos: last.agendamentos || [] });

    const html = `
        <div class="term-print-container">
            <style>
                table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
                thead tr { border-bottom: 1px solid #000; }
                th { padding: 8px; text-align: left; font-weight: 800; }
                td { padding: 8px; vertical-align: top; }
                tbody tr { border-bottom: 1px solid #000; }
                tbody tr:nth-child(odd) { background: #ffffff; }
                tbody tr:nth-child(even) { background: #eef2f7; }
            </style>
            ${buildStandardReportHeaderHtml('AGENDA DO PROFISSIONAL', empresaLabel, issuedAt)}

            <div style="margin: 18px 0;">
                <p><strong>Profissional:</strong> ${profName}</p>
                <p><strong>Data:</strong> ${dateLabel}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 90px;">Hora</th>
                        <th>Paciente</th>
                        <th style="width: 120px; text-align: left;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || `<tr><td colspan="3" style="text-align:center; padding: 12px; color:#6b7280;">Sem agendamentos</td></tr>`}
                </tbody>
            </table>

            <div class="term-footer">
                <div class="sig-box">
                    <strong>${profName}</strong><br>Assinatura do Profissional
                </div>
                <div class="sig-box">
                    <strong>${empresaLabel}</strong><br>Clínica / Consultório
                </div>
            </div>
        </div>
    `;

    openPrintWindow(html, `Agenda do Profissional - ${profName} - ${dateLabel}`);
}

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    return dateStr.split('-').reverse().join('/');
}

function buildStandardReportHeaderHtml(titleText, empresaLabel, issuedAt) {
    return `
        <div class="term-header">
            <div style="font-size: 22px; font-weight: bold; color: #000;">${titleText}</div>
            <div style="margin-top: 6px; text-align:center; line-height:1.05;">
                <div style="font-weight:800;">${empresaLabel}</div>
                <div style="height: 8px;"></div>
                <div style="font-size:12px; font-weight:600; color:#6b7280;">Emitido em ${issuedAt} via OCC - Odonto Connect Cloud</div>
                <div style="height: 8px;"></div>
            </div>
        </div>
    `;
}

function groupAgendamentosByLocalDate(agendamentos) {
    const map = new Map();
    (agendamentos || []).forEach(a => {
        const dt = new Date(a.inicio);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(a);
    });
    map.forEach(list => list.sort((x, y) => new Date(x.inicio) - new Date(y.inicio)));
    return map;
}

function getFirstNameFromText(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    return t.split(/\s+/)[0] || '';
}

function buildWeekCompactGrid({ weekStart, disponibilidade, agendamentos }) {
    const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayDates = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(`${weekStart}T00:00:00`);
        d.setDate(d.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        dayDates.push({ dateStr, label: `${dayLabels[i]} ${formatDateBR(dateStr)}` });
    }

    const dispByDia = new Map();
    (disponibilidade || []).forEach(d => {
        const dia = Number(d.dia_semana);
        if (dia < 1 || dia > 6) return;
        if (!dispByDia.has(dia)) dispByDia.set(dia, []);
        dispByDia.get(dia).push(d);
    });

    const timesSet = new Set();
    for (let dia = 1; dia <= 6; dia++) {
        const ranges = dispByDia.get(dia) || [];
        ranges.forEach(r => {
            const startM = parseTimeToMinutes(r.hora_inicio);
            const endM = parseTimeToMinutes(r.hora_fim);
            const step = Number(r.slot_minutos || 30);
            if (startM == null || endM == null || !step) return;
            for (let m = startM; m + step <= endM; m += step) {
                const hh = String(Math.floor(m / 60)).padStart(2, '0');
                const mm = String(m % 60).padStart(2, '0');
                timesSet.add(`${hh}:${mm}`);
            }
        });
    }
    (agendamentos || []).forEach(a => {
        if (!a || !a.inicio) return;
        const t = formatTimeHHMM(new Date(a.inicio));
        if (t) timesSet.add(t);
    });

    const times = Array.from(timesSet).sort((a, b) => a.localeCompare(b));

    const agByDateTime = new Map();
    (agendamentos || []).forEach(a => {
        const dt = new Date(a.inicio);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const time = formatTimeHHMM(dt);
        const key = `${dateStr}|${time}`;
        if (!agByDateTime.has(key)) agByDateTime.set(key, a);
    });

    const headerHtml = `
        <tr>
            ${dayDates.map(d => `<th style="padding: 8px; text-align:center;">${d.label}</th>`).join('')}
        </tr>
    `;

    const rowsHtml = times.map(t => {
        const cells = dayDates.map((d, idx) => {
            const dia = idx + 1;
            const hasDisp = (dispByDia.get(dia) || []).some(r => {
                const s = parseTimeToMinutes(r.hora_inicio);
                const e = parseTimeToMinutes(r.hora_fim);
                const m = parseTimeToMinutes(`${t}:00`);
                if (s == null || e == null || m == null) return false;
                return m >= s && m < e;
            });
            const a = agByDateTime.get(`${d.dateStr}|${t}`);
            if (!hasDisp && !a) {
                return `<td style="height: 52px; background: #fff;"></td>`;
            }
            const pat = a && a.paciente_id ? getPacienteDetailsBySeqId(a.paciente_id) : null;
            const name = a ? (pat ? String(pat.nome || '') : String(a.titulo || '')) : '';
            const cel = pat ? String(pat.celular || '') : '';
            const cellStyle = !hasDisp && a ? 'background:#fff7ed; border: 1px solid #fdba74;' : '';
            return `
                <td style="height: 52px; padding: 6px; text-align:center; ${cellStyle}">
                    <div style="font-weight:900; font-size: 12px; line-height: 1;">${t}</div>
                    <div style="margin-top: 2px; font-size: 10px; font-weight: 700; color: #111827; line-height: 1.05; max-height: 26px; overflow: hidden;">${name || '&nbsp;'}</div>
                    <div style="margin-top: 2px; font-size: 10px; color: #6b7280; line-height: 1; max-height: 12px; overflow: hidden;">${cel || '&nbsp;'}</div>
                </td>
            `;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    return { headerHtml, rowsHtml };
}

async function printAgendaWeek() {
    if (!agendaDate || !agendaProfessional) return;
    const anyDateStr = agendaDate.value;
    const profSeqId = agendaProfessional.value;
    if (!anyDateStr || !profSeqId) {
        showToast('Selecione data e profissional.', true);
        return;
    }

    const { weekStart, weekEnd, startIso, endIso } = buildWeekDateRangeUTC(anyDateStr);
    const profName = getProfessionalNameBySeqId(profSeqId);
    const empresaLabel = getEmpresaName(currentEmpresaId);
    const issuedAt = formatDateTime(new Date().toISOString());

    try {
        const dispQ = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('profissional_id', Number(profSeqId))
            .eq('ativo', true);
        const { data: disp, error: dispErr } = await withTimeout(dispQ, 15000, 'agenda_disponibilidade:week');
        if (dispErr) throw dispErr;

        const agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('profissional_id', Number(profSeqId))
            .gte('inicio', startIso)
            .lte('inicio', endIso)
            .order('inicio', { ascending: true });
        const { data: ags, error: agErr } = await withTimeout(agQ, 15000, 'agenda_agendamentos:week');
        if (agErr) throw agErr;

        const byDate = groupAgendamentosByLocalDate(ags || []);
        const dispDays = new Set((disp || []).map(r => Number(r.dia_semana)));
        const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        let bodyHtml = '';
        for (let i = 0; i < 7; i++) {
            const date = new Date(`${weekStart}T00:00:00`);
            date.setDate(date.getDate() + i);
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            const jsDay = date.getDay();
            const diaSemana = jsDayToAgendaDiaSemana(jsDay);
            const label = `${dayLabels[jsDay]} — ${formatDateBR(dateStr)}`;

            const list = byDate.get(dateStr) || [];
            const hasWork = dispDays.has(diaSemana);

            bodyHtml += `
                <div style="page-break-inside: avoid; margin-top: 14px;">
                    <div style="display:flex; justify-content: space-between; align-items: baseline; gap: 12px;">
                        <div style="font-weight: 800; font-size: 14px;">${label}</div>
                        <div style="color:#6b7280; font-size: 12px;">${hasWork ? 'Atendimento' : 'Sem atendimento'}</div>
                    </div>
                    <table style="width:100%; border-collapse: collapse; margin-top: 8px;">
                        <thead>
                            <tr>
                                <th style="width: 90px;">Hora</th>
                                <th>Paciente</th>
                                <th style="width: 120px;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.length ? list.map(a => {
                                const time = formatTimeHHMM(new Date(a.inicio));
                                const p = a.paciente_id ? getPacienteDetailsBySeqId(a.paciente_id) : null;
                                const paciente = p ? (p.nome || '-') : (a.titulo || '(Sem paciente)');
                                const cpf = p && p.cpf ? p.cpf : '';
                                const cel = p && p.celular ? p.celular : '';
                                const em = p && p.email ? p.email : '';
                                const meta = [cpf && `CPF: ${cpf}`, cel && `Cel: ${cel}`, em && `Email: ${em}`].filter(Boolean).join(' • ');
                                const status = String(a.status || 'MARCADO');
                                return `
                                    <tr>
                                        <td style="font-weight:700;">${time}</td>
                                        <td>
                                            <div style="font-weight:700;">${paciente}</div>
                                            ${meta ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${meta}</div>` : ''}
                                        </td>
                                        <td>${status}</td>
                                    </tr>
                                `;
                            }).join('') : `<tr><td colspan="3" style="color:#6b7280; text-align:center; padding: 12px;">Sem agendamentos</td></tr>`}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const periodLabel = `${formatDateBR(weekStart)} a ${formatDateBR(weekEnd)}`;

        const html = `
            <div class="term-print-container">
                <style>
                    table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
                    thead tr { border-bottom: 1px solid #000; }
                    th { padding: 8px; text-align: left; font-weight: 800; }
                    td { padding: 8px; vertical-align: top; }
                    tbody tr { border-bottom: 1px solid #000; }
                    tbody tr:nth-child(odd) { background: #ffffff; }
                    tbody tr:nth-child(even) { background: #eef2f7; }
                </style>
                ${buildStandardReportHeaderHtml('AGENDA SEMANAL DO PROFISSIONAL', empresaLabel, issuedAt)}

                <div style="margin: 18px 0;">
                    <p><strong>Profissional:</strong> ${profName}</p>
                    <p><strong>Período:</strong> ${periodLabel}</p>
                </div>

                ${bodyHtml}

                <div class="term-footer">
                    <div class="sig-box">
                        <strong>${profName}</strong><br>Assinatura do Profissional
                    </div>
                    <div class="sig-box">
                        <strong>${empresaLabel}</strong><br>Clínica / Consultório
                    </div>
                </div>
            </div>
        `;

        openPrintWindow(html, `Agenda Semanal - ${profName} - ${periodLabel}`);
    } catch (err) {
        console.error('Erro ao imprimir agenda semanal:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao imprimir semana (${code}): ${msg}`, true);
    }
}

async function printAgendaWeekCompact() {
    if (!agendaDate || !agendaProfessional) return;
    const anyDateStr = agendaDate.value;
    const profSeqId = agendaProfessional.value;
    if (!anyDateStr || !profSeqId) {
        showToast('Selecione data e profissional.', true);
        return;
    }

    const { weekStart, weekEnd, startIso, endIso } = buildWeekDateRangeUTC(anyDateStr);
    const profName = getProfessionalNameBySeqId(profSeqId);
    const empresaLabel = getEmpresaName(currentEmpresaId);
    const issuedAt = formatDateTime(new Date().toISOString());
    const periodLabel = `${formatDateBR(weekStart)} a ${formatDateBR(weekEnd)}`;

    try {
        const dispQ = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('profissional_id', Number(profSeqId))
            .eq('ativo', true);
        const { data: disp, error: dispErr } = await withTimeout(dispQ, 15000, 'agenda_disponibilidade:week_compact');
        if (dispErr) throw dispErr;

        const agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('profissional_id', Number(profSeqId))
            .gte('inicio', startIso)
            .lte('inicio', endIso)
            .order('inicio', { ascending: true });
        const { data: ags, error: agErr } = await withTimeout(agQ, 15000, 'agenda_agendamentos:week_compact');
        if (agErr) throw agErr;

        const grid = buildWeekCompactGrid({ weekStart, disponibilidade: disp || [], agendamentos: ags || [] });

        const html = `
            <div class="term-print-container">
                <style>
                    table { width: 100%; border-collapse: collapse; border: 1px solid #000; table-layout: fixed; }
                    th, td { border: 1px solid #000; word-break: break-word; }
                    th { background: #f3f4f6; text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em; color: #374151; }
                    tbody tr:nth-child(odd) td { background: #ffffff; }
                    tbody tr:nth-child(even) td { background: #eef2f7; }
                </style>
                ${buildStandardReportHeaderHtml('AGENDA SEMANAL REDUZIDA', empresaLabel, issuedAt)}

                <div style="margin: 18px 0;">
                    <p><strong>Profissional:</strong> ${profName}</p>
                    <p><strong>Período:</strong> ${periodLabel} (Segunda a Sábado)</p>
                </div>

                <table>
                    <thead>
                        ${grid.headerHtml}
                    </thead>
                    <tbody>
                        ${grid.rowsHtml || ''}
                    </tbody>
                </table>
            </div>
        `;

        openPrintWindow(html, `Agenda Semanal Reduzida - ${profName} - ${periodLabel}`);
    } catch (err) {
        console.error('Erro ao imprimir agenda semanal reduzida:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao imprimir semanal reduzida (${code}): ${msg}`, true);
    }
}

function openAgendaModalNew({ dateStr, time, step, profSeqId }) {
    if (!modalAgenda) return;
    if (modalAgendaTitle) modalAgendaTitle.textContent = 'Novo Agendamento';
    if (agendaId) agendaId.value = '';
    if (btnAgendaDelete) btnAgendaDelete.classList.add('hidden');
    if (agendaPaciente) agendaPaciente.value = '';
    if (agendaTitulo) agendaTitulo.value = '';
    if (agendaObs) agendaObs.value = '';
    if (agendaStatus) agendaStatus.value = 'MARCADO';

    const start = new Date(`${dateStr}T${time}:00`);
    const end = new Date(start.getTime() + (step * 60000));
    if (agendaInicio) agendaInicio.value = toLocalDatetimeInputValue(start);
    if (agendaFim) agendaFim.value = toLocalDatetimeInputValue(end);

    modalAgenda.dataset.autoEnd = '1';
    modalAgenda.dataset.manualEnd = '0';
    modalAgenda.dataset.slotMinutes = String(step || 30);
    modalAgenda.dataset.profSeqId = String(profSeqId || '');
    modalAgenda.dataset.dateStr = String(dateStr || '');

    modalAgenda.classList.remove('hidden');
}

function openAgendaModalEdit(a) {
    if (!modalAgenda) return;
    if (modalAgendaTitle) modalAgendaTitle.textContent = 'Editar Agendamento';
    if (agendaId) agendaId.value = a.id;
    if (btnAgendaDelete) btnAgendaDelete.classList.remove('hidden');
    if (agendaPaciente) agendaPaciente.value = a.paciente_id ? String(a.paciente_id) : '';
    if (agendaTitulo) agendaTitulo.value = a.titulo || '';
    if (agendaObs) agendaObs.value = a.observacoes || '';
    if (agendaStatus) agendaStatus.value = a.status || 'MARCADO';
    if (agendaInicio) agendaInicio.value = toLocalDatetimeInputValue(new Date(a.inicio));
    if (agendaFim) agendaFim.value = toLocalDatetimeInputValue(new Date(a.fim));

    modalAgenda.dataset.autoEnd = '0';
    modalAgenda.dataset.manualEnd = '1';
    modalAgenda.dataset.slotMinutes = '';
    modalAgenda.dataset.profSeqId = String(a.profissional_id || '');
    modalAgenda.dataset.dateStr = '';

    modalAgenda.classList.remove('hidden');
}

function closeAgendaModal() {
    if (modalAgenda) modalAgenda.classList.add('hidden');
}

function renderAgendaAgendamentosOnly({ agendamentos }) {
    if (!agendaSlotsBody) return;
    if (!agendamentos || !agendamentos.length) {
        if (agendaSlotsBody) agendaSlotsBody.innerHTML = '';
        if (agendaEmptyState) agendaEmptyState.classList.remove('hidden');
        return;
    }
    if (agendaEmptyState) agendaEmptyState.classList.add('hidden');
    agendaSlotsBody.innerHTML = '';
    (agendamentos || [])
        .slice()
        .sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || '')))
        .forEach(a => {
            const tr = document.createElement('tr');
            const hora = a.inicio ? formatTimeHHMM(new Date(a.inicio)) : '--:--';
            const pacienteHtml = a.paciente_id
                ? getPacienteSummaryHtmlBySeqId(a.paciente_id)
                : `<span style="color: var(--text-muted);">${escapeHtml(String(a.titulo || '(Sem paciente)'))}</span>`;
            tr.innerHTML = `
                <td style="font-weight:700;">${escapeHtml(hora)}</td>
                <td>${pacienteHtml}</td>
                <td>${escapeHtml(String(a.status || 'MARCADO'))}</td>
                <td><button class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}"><i class="ri-edit-line"></i> Editar</button></td>
            `;
            agendaSlotsBody.appendChild(tr);
        });
    agendaSlotsBody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const a = (window.__agendaLast && Array.isArray(window.__agendaLast.agendamentos)) ? window.__agendaLast.agendamentos.find(x => String(x.id) === String(id)) : null;
            if (a) openAgendaModalEdit(a);
        });
    });
}

async function saveAgendaFromModal() {
    if (!agendaProfessional || !agendaDate) return;
    const profSeqId = agendaProfessional.value;
    if (!profSeqId) { showToast('Selecione o profissional.', true); return; }

    const id = agendaId ? agendaId.value : '';
    const inicioVal = agendaInicio ? agendaInicio.value : '';
    const fimVal = agendaFim ? agendaFim.value : '';
    if (!inicioVal || !fimVal) { showToast('Informe início e fim.', true); return; }

    const inicioIso = new Date(inicioVal).toISOString();
    const fimIso = new Date(fimVal).toISOString();
    if (fimIso <= inicioIso) { showToast('Fim deve ser maior que início.', true); return; }

    const pacienteVal = agendaPaciente ? agendaPaciente.value : '';
    const tituloVal = agendaTitulo ? String(agendaTitulo.value || '') : '';
    if (!pacienteVal && !tituloVal) {
        showToast('Selecione o paciente ou preencha o título.', true);
        return;
    }

    const payload = {
        empresa_id: currentEmpresaId,
        profissional_id: Number(profSeqId),
        paciente_id: pacienteVal ? Number(pacienteVal) : null,
        inicio: inicioIso,
        fim: fimIso,
        status: agendaStatus ? agendaStatus.value : 'MARCADO',
        titulo: tituloVal || null,
        observacoes: agendaObs ? agendaObs.value : null,
        criado_por: currentUser?.id || null,
        updated_at: new Date().toISOString()
    };

    try {
        try {
            let conflictQ = db.from('agenda_agendamentos')
                .select('id, inicio, fim, paciente_id, titulo, status')
                .eq('empresa_id', currentEmpresaId)
                .eq('profissional_id', Number(profSeqId))
                .neq('status', 'CANCELADO')
                .lt('inicio', fimIso)
                .gt('fim', inicioIso);
            if (id) conflictQ = conflictQ.neq('id', id);
            conflictQ = conflictQ.limit(1);
            const { data: conflicts, error: cErr } = await withTimeout(conflictQ, 15000, 'agenda_agendamentos:conflicts');
            if (cErr) throw cErr;
            if (conflicts && conflicts.length) {
                const c = conflicts[0];
                const cStart = c.inicio ? formatTimeHHMM(new Date(c.inicio)) : '--:--';
                const cEnd = c.fim ? formatTimeHHMM(new Date(c.fim)) : '--:--';
                const who = c.paciente_id ? getPacienteNameBySeqId(c.paciente_id) : (c.titulo || '(Sem paciente)');
                showToast(`Conflito de horário (${cStart}-${cEnd}) com ${who}.`, true);
                return;
            }
        } catch (err) {
            console.warn('Aviso: Falha ao checar conflito de horário.', err);
        }

        const selectCols = 'id,empresa_id,profissional_id,paciente_id,inicio,fim,status,titulo,observacoes';
        let savedRow = null;
        if (id) {
            const { data, error } = await withTimeout(
                db.from('agenda_agendamentos').update(payload).eq('id', id).eq('empresa_id', currentEmpresaId).select(selectCols).single(),
                15000,
                'agenda_agendamentos:update'
            );
            if (error) throw error;
            savedRow = data || null;
            showToast('Agendamento atualizado.');
        } else {
            const { data, error } = await withTimeout(
                db.from('agenda_agendamentos').insert(payload).select(selectCols).single(),
                15000,
                'agenda_agendamentos:insert'
            );
            if (error) throw error;
            savedRow = data || null;
            showToast('Agendamento criado.');
        }
        closeAgendaModal();

        const localDateStr = String(inicioVal || '').slice(0, 10);
        const canPatchAgenda =
            savedRow
            && agendaDate
            && agendaProfessional
            && String(agendaDate.value || '') === localDateStr
            && String(agendaProfessional.value || '') === String(profSeqId);
        if (canPatchAgenda) {
            window.__agendaLast = window.__agendaLast || { empresaId: null, profSeqId: null, dateStr: null, disponibilidade: [], agendamentos: [] };
            window.__agendaLast.empresaId = currentEmpresaId;
            window.__agendaLast.profSeqId = Number(profSeqId);
            window.__agendaLast.dateStr = localDateStr;
            const list = Array.isArray(window.__agendaLast.agendamentos) ? window.__agendaLast.agendamentos.slice() : [];
            const idx = list.findIndex(x => String(x && x.id) === String(savedRow.id));
            if (idx >= 0) list[idx] = savedRow;
            else list.push(savedRow);
            list.sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || '')));
            window.__agendaLast.agendamentos = list;

            if (Array.isArray(window.__agendaLast.disponibilidade) && window.__agendaLast.disponibilidade.length) {
                renderAgendaSlots({ dateStr: localDateStr, profSeqId, disponibilidade: window.__agendaLast.disponibilidade, agendamentos: list });
            } else {
                renderAgendaAgendamentosOnly({ agendamentos: list });
            }
        }

        setTimeout(() => { try { fetchAgendaForUI(); } catch { } }, 80);
    } catch (err) {
        console.error('Erro ao salvar agendamento:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao salvar agendamento (${code}): ${msg}`, true);
    }
}

async function deleteAgendaFromModal() {
    const id = agendaId ? agendaId.value : '';
    if (!id) return;
    if (!confirm('Excluir este agendamento?')) return;
    try {
        const { error } = await withTimeout(db.from('agenda_agendamentos').delete().eq('id', id).eq('empresa_id', currentEmpresaId), 15000, 'agenda_agendamentos:delete');
        if (error) throw error;
        showToast('Agendamento excluído.');
        closeAgendaModal();
        await fetchAgendaForUI();
    } catch (err) {
        console.error('Erro ao excluir agendamento:', err);
        showToast('Erro ao excluir agendamento.', true);
    }
}

async function loadAgendaDisponibilidade(profSeqId, empresaId) {
    try {
        resetAgendaForm();
        if (!profSeqId || !empresaId) return;

        const q = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .eq('ativo', true);

        const { data, error } = await withTimeout(q, 15000, 'agenda_disponibilidade');
        if (error) throw error;

        const byDay = new Map();
        (data || []).forEach(r => {
            const d = Number(r.dia_semana);
            if (!byDay.has(d)) byDay.set(d, r);
        });

        agendaFields.forEach(f => {
            const r = byDay.get(f.day);
            if (!r || !f.enabled) return;
            f.enabled.checked = true;
            if (f.start) f.start.value = String(r.hora_inicio || '').slice(0, 5);
            if (f.end) f.end.value = String(r.hora_fim || '').slice(0, 5);
            if (f.slot) f.slot.value = String(r.slot_minutos || 30);
            if (f.start) f.start.disabled = false;
            if (f.end) f.end.disabled = false;
            if (f.slot) f.slot.disabled = false;
        });
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        console.warn('Agenda indisponível:', msg);
        if (agendaCard) {
            showToast('Agenda ainda não habilitada. Execute o SQL da agenda no Supabase.', true);
        }
    }
}

function buildAgendaPayload(empresaId, profSeqId) {
    const rows = [];
    const errors = [];

    agendaFields.forEach(f => {
        if (!f.enabled || !f.enabled.checked) return;
        const start = f.start ? String(f.start.value || '') : '';
        const end = f.end ? String(f.end.value || '') : '';
        const slot = f.slot ? parseInt(f.slot.value || '30', 10) : 30;

        if (!start || !end) {
            errors.push(`Dia ${f.day}: informe início e fim.`);
            return;
        }
        if (end <= start) {
            errors.push(`Dia ${f.day}: horário final deve ser maior que o inicial.`);
            return;
        }

        rows.push({
            empresa_id: empresaId,
            profissional_id: Number(profSeqId),
            dia_semana: f.day,
            hora_inicio: start,
            hora_fim: end,
            slot_minutos: slot,
            ativo: true,
            updated_at: new Date().toISOString()
        });
    });

    return { rows, errors };
}

async function saveAgendaDisponibilidade(profSeqId, empresaId) {
    const { rows, errors } = buildAgendaPayload(empresaId, profSeqId);
    if (errors.length) {
        throw new Error(errors[0]);
    }

    const profId = Number(profSeqId);
    if (!empresaId || !profId) {
        throw new Error('Empresa ou profissional inválido para salvar disponibilidade.');
    }

    const baseQ = db.from('agenda_disponibilidade')
        .select('id,dia_semana,hora_inicio,hora_fim,slot_minutos,ativo')
        .eq('empresa_id', empresaId)
        .eq('profissional_id', profId);

    const { data: existing, error: exErr } = await withTimeout(baseQ, 15000, 'agenda_disponibilidade:select');
    if (exErr) throw exErr;

    const existingRows = existing || [];
    const desiredByDay = new Map();
    rows.forEach(r => desiredByDay.set(Number(r.dia_semana), r));

    if (rows.length === 0) {
        if (existingRows.length) {
            const del = db.from('agenda_disponibilidade')
                .delete()
                .eq('empresa_id', empresaId)
                .eq('profissional_id', profId);
            const { error: delError } = await withTimeout(del, 15000, 'agenda_disponibilidade:delete_all');
            if (delError) throw delError;
        }
        return true;
    }

    const rowsByDay = new Map();
    existingRows.forEach(r => {
        const d = Number(r.dia_semana);
        if (!rowsByDay.has(d)) rowsByDay.set(d, []);
        rowsByDay.get(d).push(r);
    });

    const toDeleteIds = [];
    rowsByDay.forEach((arr, day) => {
        arr.forEach((r, idx) => {
            if (!desiredByDay.has(day)) toDeleteIds.push(r.id);
            if (desiredByDay.has(day) && idx > 0) toDeleteIds.push(r.id);
        });
    });

    if (toDeleteIds.length) {
        const delDupe = db.from('agenda_disponibilidade')
            .delete()
            .in('id', toDeleteIds);
        const { error: delDupeErr } = await withTimeout(delDupe, 15000, 'agenda_disponibilidade:delete_ids');
        if (delDupeErr) throw delDupeErr;
    }

    for (const [day, desired] of desiredByDay.entries()) {
        const list = rowsByDay.get(day) || [];
        const keep = list.length ? list[0] : null;
        if (keep && keep.id) {
            const upd = db.from('agenda_disponibilidade')
                .update({
                    dia_semana: desired.dia_semana,
                    hora_inicio: desired.hora_inicio,
                    hora_fim: desired.hora_fim,
                    slot_minutos: desired.slot_minutos,
                    ativo: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', keep.id)
                .eq('empresa_id', empresaId);
            const { error: updErr } = await withTimeout(upd, 15000, `agenda_disponibilidade:update:${day}`);
            if (updErr) throw updErr;
        } else {
            const ins = db.from('agenda_disponibilidade').insert(desired);
            const { error: insErr } = await withTimeout(ins, 15000, `agenda_disponibilidade:insert:${day}`);
            if (insErr) throw insErr;
        }
    }

    return true;
}

// Check CPF duplicacy
function isCpfDuplicate(cpf, excludeId) {
    return patients.some(p => p.cpf === cpf && p.id !== excludeId);
}

// --- EVENT LISTENERS ---

// Nav Patient
btnAddNewPatient.addEventListener('click', () => showForm(false, 'patients'));
btnBackPatient.addEventListener('click', () => showList('patients'));
btnCancelPatient.addEventListener('click', () => showList('patients'));

// Nav Professional
btnAddNewProfessional.addEventListener('click', () => showForm(false, 'professionals'));
btnBackProfessional.addEventListener('click', () => showList('professionals'));
btnCancelProfessional.addEventListener('click', () => showList('professionals'));
if (agendaCard) {
    attachAgendaListeners();
    resetAgendaForm();
}

if (agendaDate) agendaDate.addEventListener('change', () => fetchAgendaForUI());
if (agendaProfessional) agendaProfessional.addEventListener('change', () => fetchAgendaForUI());
if (btnAgendaRefresh) btnAgendaRefresh.addEventListener('click', () => fetchAgendaForUI());
if (btnAgendaPrintDay) btnAgendaPrintDay.addEventListener('click', () => printAgendaDay());
if (btnAgendaPrintWeek) btnAgendaPrintWeek.addEventListener('click', () => printAgendaWeek());
if (btnAgendaPrintWeekCompact) btnAgendaPrintWeekCompact.addEventListener('click', () => printAgendaWeekCompact());

if (dashDate) dashDate.addEventListener('change', () => fetchDashboardFromUI());
if (dashProfessional) dashProfessional.addEventListener('change', () => fetchDashboardFromUI());
if (btnDashRefresh) btnDashRefresh.addEventListener('click', () => fetchDashboardFromUI());
if (btnDashPrint) btnDashPrint.addEventListener('click', () => window.printDashboard && window.printDashboard());

if (atendimentoDate) atendimentoDate.addEventListener('change', () => fetchAtendimentoForUI());
if (atendimentoProfessional) atendimentoProfessional.addEventListener('change', () => fetchAtendimentoForUI());
if (btnAtendimentoRefresh) btnAtendimentoRefresh.addEventListener('click', () => fetchAtendimentoForUI());
if (btnFechamentoDiario) btnFechamentoDiario.addEventListener('click', () => openFechamentoDiarioModal());
if (btnCloseAtendimentoEvolucao) btnCloseAtendimentoEvolucao.addEventListener('click', closeAtendimentoEvolucaoModal);
if (btnCancelAtendimentoEvolucao) btnCancelAtendimentoEvolucao.addEventListener('click', closeAtendimentoEvolucaoModal);
if (btnSaveAtendimentoEvolucao) btnSaveAtendimentoEvolucao.addEventListener('click', async () => { await saveAtendimentoEvolucao(); });
if (atendimentoEvolucaoModal) atendimentoEvolucaoModal.addEventListener('click', (e) => { if (e.target === atendimentoEvolucaoModal) closeAtendimentoEvolucaoModal(); });
if (btnAgendaNew) btnAgendaNew.addEventListener('click', () => {
    if (!agendaDate || !agendaProfessional) return;
    const profSeqId = agendaProfessional.value;
    const dateStr = agendaDate.value;
    if (!profSeqId || !dateStr) { showToast('Selecione data e profissional.', true); return; }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();

    let pickedTime = '08:00';
    let pickedStep = 30;

    const last = window.__agendaLast;
    const lastOk = last
        && String(last.dateStr || '') === String(dateStr)
        && String(last.profSeqId || '') === String(profSeqId)
        && Array.isArray(last.disponibilidade)
        && last.disponibilidade.length;

    if (lastOk) {
        const slots = [];
        last.disponibilidade.forEach(d => {
            const startM = parseTimeToMinutes(d.hora_inicio);
            const endM = parseTimeToMinutes(d.hora_fim);
            const step = Number(d.slot_minutos || 30);
            if (startM == null || endM == null || !step) return;
            for (let m = startM; m + step <= endM; m += step) {
                slots.push({ minutes: m, step, time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` });
            }
        });
        slots.sort((a, b) => a.minutes - b.minutes);
        if (slots.length) {
            const next = isToday ? (slots.find(s => s.minutes >= nowMinutes) || slots[0]) : slots[0];
            pickedTime = next.time;
            pickedStep = next.step;
        }
    } else if (isToday) {
        const rem = nowMinutes % 30;
        const rounded = rem ? (nowMinutes + (30 - rem)) : nowMinutes;
        const hh = String(Math.floor(rounded / 60)).padStart(2, '0');
        const mi = String(rounded % 60).padStart(2, '0');
        pickedTime = `${hh}:${mi}`;
        pickedStep = 30;
    }

    openAgendaModalNew({ dateStr, time: pickedTime, step: pickedStep, profSeqId: Number(profSeqId) });
});

if (btnCloseModalAgenda) btnCloseModalAgenda.addEventListener('click', closeAgendaModal);
if (btnAgendaCancel) btnAgendaCancel.addEventListener('click', closeAgendaModal);
if (modalAgenda) modalAgenda.addEventListener('click', (e) => { if (e.target === modalAgenda) closeAgendaModal(); });
if (formAgenda) formAgenda.addEventListener('submit', async (e) => { e.preventDefault(); await saveAgendaFromModal(); });
if (btnAgendaDelete) btnAgendaDelete.addEventListener('click', async () => { await deleteAgendaFromModal(); });
if (agendaFim) agendaFim.addEventListener('input', () => {
    if (modalAgenda) modalAgenda.dataset.manualEnd = '1';
});
if (agendaInicio) agendaInicio.addEventListener('input', () => {
    if (!modalAgenda) return;
    if (modalAgenda.dataset.autoEnd !== '1') return;
    if (modalAgenda.dataset.manualEnd === '1') return;
    if (!agendaInicio.value) return;

    const profSeqId = modalAgenda.dataset.profSeqId || (agendaProfessional ? agendaProfessional.value : '');
    const startDate = new Date(agendaInicio.value);
    if (Number.isNaN(startDate.getTime())) return;

    let slotMinutes = parseInt(modalAgenda.dataset.slotMinutes || '0', 10);
    if (!slotMinutes) slotMinutes = 30;

    const last = window.__agendaLast;
    if (last && String(last.profSeqId) === String(profSeqId) && Array.isArray(last.disponibilidade) && last.disponibilidade.length) {
        const startMin = (startDate.getHours() * 60) + startDate.getMinutes();
        const match = last.disponibilidade.find(d => {
            const s = parseTimeToMinutes(d.hora_inicio);
            const e = parseTimeToMinutes(d.hora_fim);
            if (s == null || e == null) return false;
            return startMin >= s && startMin < e;
        });
        if (match && match.slot_minutos) {
            slotMinutes = Number(match.slot_minutos);
        }
    }

    modalAgenda.dataset.slotMinutes = String(slotMinutes);
    const end = new Date(startDate.getTime() + (slotMinutes * 60000));
    if (agendaFim) agendaFim.value = toLocalDatetimeInputValue(end);
});

// Nav Specialty
if (btnNewSpecialty) btnNewSpecialty.addEventListener('click', () => showForm(false, 'specialties'));
if (btnBackSpecialty) btnBackSpecialty.addEventListener('click', () => showList('specialties'));
if (btnCancelSpecialty) btnCancelSpecialty.addEventListener('click', () => showList('specialties'));

// Nav Service
if (btnNewService) btnNewService.addEventListener('click', () => showForm(false, 'services'));
if (btnBackService) btnBackService.addEventListener('click', () => showList('services'));
if (btnCancelService) btnCancelService.addEventListener('click', () => showList('services'));

// Nav Budget
if (btnNewBudget) btnNewBudget.addEventListener('click', () => showForm(false, 'budgets'));
if (btnBackBudget) btnBackBudget.addEventListener('click', () => showList('budgets'));
if (btnCancelBudget) btnCancelBudget.addEventListener('click', () => showList('budgets'));

// Masks
inputCpf.addEventListener('input', e => e.target.value = maskCPF(e.target.value));
inputCelular.addEventListener('input', e => e.target.value = maskCellphone(e.target.value));
profCelular.addEventListener('input', e => e.target.value = maskCellphone(e.target.value));
inputTelefone.addEventListener('input', e => e.target.value = maskPhone(e.target.value));
inputCep.addEventListener('input', e => {
    e.target.value = maskCEP(e.target.value);

    // Auto-fill address from CEP via ViaCEP API
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(response => response.json())
            .then(data => {
                if (!data.erro) {
                    const elEndereco = document.getElementById('endereco');
                    const elBairro = document.getElementById('bairro');
                    const elCidade = document.getElementById('cidade');
                    const elUf = document.getElementById('uf');

                    if (elEndereco) elEndereco.value = data.logradouro || '';
                    if (elBairro) elBairro.value = data.bairro || '';
                    if (elCidade) elCidade.value = data.localidade || '';
                    if (elUf) elUf.value = data.uf || '';

                    // Highlight the auto-filled fields briefly
                    [elEndereco, elBairro, elCidade, elUf].forEach(input => {
                        if (input) {
                            input.style.backgroundColor = '#e8f0fe';
                            setTimeout(() => input.style.backgroundColor = '', 1000);
                        }
                    });

                    // Focus on the number field since address is filled
                    document.getElementById('numero').focus();
                } else {
                    showToast('CEP não encontrado.', true);
                }
            })
            .catch(error => {
                console.error('Error fetching CEP:', error);
                showToast('Erro ao buscar o CEP.', true);
            });
    }
});

// Conditional visibility for anamnese
document.getElementById('emTratamentoMedico').addEventListener('change', e => {
    document.getElementById('tratamentoDescContainer').style.display = e.target.checked ? 'block' : 'none';
});
document.getElementById('tomaMedicacao').addEventListener('change', e => {
    document.getElementById('medicacaoDescContainer').style.display = e.target.checked ? 'block' : 'none';
});
document.getElementById('temAlergia').addEventListener('change', e => {
    document.getElementById('alergiaDescContainer').style.display = e.target.checked ? 'block' : 'none';
});

// Variables for CEP auto-fill were moved into the event listener

// Real-time search Patients
searchInput.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    const filtered = patients.filter(p =>
        (p.seqid && p.seqid.toString().includes(term)) ||
        p.nome.toLowerCase().includes(term) ||
        p.cpf.includes(term)
    );
    renderTable(filtered, 'patients');
});

// Real-time search Professionals
searchProfessionalInput.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    const filtered = professionals.filter(p =>
        (p.seqid && p.seqid.toString().includes(term)) ||
        p.nome.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term)
    );
    renderTable(filtered, 'professionals');
});

// Real-time search Services
if (searchServiceInput) {
    searchServiceInput.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        const filtered = services.filter(s =>
            (s.seqid && s.seqid.toString().includes(term)) ||
            s.descricao.toLowerCase().includes(term) ||
            (s.subdivisao && s.subdivisao.toLowerCase().includes(term))
        );
        renderTable(filtered, 'services');
    });
}

// Form Submit Patient
patientForm.addEventListener('submit', async e => {
    e.preventDefault();

    const id = document.getElementById('editId').value;

    // Permission check
    if (!can('pacientes', id ? 'update' : 'insert')) {
        showToast("Você não tem permissão para esta ação.", true);
        return;
    }
    const cpfValue = document.getElementById('cpf').value;
    const cpfError = document.getElementById('cpfError');

    // Validate CPF format
    if (!isValidCPF(cpfValue)) {
        inputCpf.classList.add('input-error');
        cpfError.innerText = 'CPF inválido.';
        cpfError.style.display = 'block';
        return;
    }

    // Validate CPF duplicacy
    if (isCpfDuplicate(cpfValue, id)) {
        inputCpf.classList.add('input-error');
        cpfError.innerText = 'Este CPF já está cadastrado.';
        cpfError.style.display = 'block';
        return;
    }

    inputCpf.classList.remove('input-error');
    cpfError.style.display = 'none';

    const patientData = {
        nome: document.getElementById('nome').value,
        cpf: cpfValue,
        datanascimento: document.getElementById('dataNascimento').value || null,
        sexo: document.getElementById('sexo').value,
        profissao: document.getElementById('profissao').value,
        telefone: document.getElementById('telefone').value,
        celular: document.getElementById('celular').value,
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value,
        endereco: document.getElementById('endereco').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        uf: document.getElementById('uf').value,
        empresa_id: currentEmpresaId,
        // Anamnese
        anamnese: {
            emTratamentoMedico: document.getElementById('emTratamentoMedico').checked,
            tratamentoDesc: document.getElementById('tratamentoDesc').value,
            tomaMedicacao: document.getElementById('tomaMedicacao').checked,
            medicacaoDesc: document.getElementById('medicacaoDesc').value,
            temAlergia: document.getElementById('temAlergia').checked,
            alergiaDesc: document.getElementById('alergiaDesc').value,
            teveHemorragia: document.getElementById('teveHemorragia').checked,
            doencasPreexistentes: document.getElementById('doencasPreexistentes').value
        }
    };

    try {
        async function insertPacienteSmart(payload) {
            const base = { ...payload };
            delete base.seqid;

            try {
                const rpcRes = await db.rpc('rpc_create_paciente', { p_data: base });
                if (!rpcRes.error) return rpcRes;
                const rpcCode = String(rpcRes.error.code || '');
                const rpcMsg = String(rpcRes.error.message || '');
                const notFound = rpcCode === 'PGRST202' || /could not find the function/i.test(rpcMsg);
                if (!notFound) return rpcRes;
            } catch {
            }

            async function getNextPacienteSeqIdFromDB() {
                try {
                    const q = db.from('pacientes')
                        .select('seqid')
                        .order('seqid', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    const { data, error } = await withTimeout(q, 15000, 'pacientes:max_seqid');
                    if (error) throw error;
                    const maxSeq = data && data.seqid ? Number(data.seqid) : 0;
                    const next = maxSeq + 1;
                    return Number.isFinite(next) && next > 0 ? next : getNextSeqId(patients);
                } catch {
                    return getNextSeqId(patients);
                }
            }

            let res = await db.from('pacientes').insert(base).select().single();
            if (!res.error) return res;

            const code = String(res.error.code || '');
            const msg = String(res.error.message || '');

            const isDupSeq = code === '23505' && /pacientes_seqid_unique/i.test(msg);
            if (isDupSeq) {
                for (let i = 0; i < 3; i++) {
                    const nextSeq = await getNextPacienteSeqIdFromDB();
                    const attempt = { ...base, seqid: nextSeq };
                    res = await db.from('pacientes').insert(attempt).select().single();
                    if (!res.error) return res;
                    const c2 = String(res.error.code || '');
                    const m2 = String(res.error.message || '');
                    if (!(c2 === '23505' && /pacientes_seqid_unique/i.test(m2))) break;
                }
            }

            const needId = /null value in column \"id\"/i.test(msg) || /column \"id\".*violates not-null/i.test(msg);
            const needSeq = /null value in column \"seqid\"/i.test(msg) || /column \"seqid\".*violates not-null/i.test(msg);
            if (!needId && !needSeq) return res;

            const fallback = { ...base };
            if (needId) fallback.id = generateId();
            if (needSeq) fallback.seqid = await getNextPacienteSeqIdFromDB();
            res = await db.from('pacientes').insert(fallback).select().single();
            return res;
        }

        if (id) {
            // Edit existing
            const { error } = await db.from('pacientes').update(patientData).eq('id', id);
            if (error) throw error;

            const index = patients.findIndex(p => p.id === id);
            if (index !== -1) patients[index] = { ...patients[index], ...patientData };
            showToast('Paciente atualizado com sucesso!');
        } else {
            // Add new
            const { data, error } = await insertPacienteSmart(patientData);
            if (error) throw error;

            if (data) {
                patients.push(data);
            }
            showToast('Paciente cadastrado com sucesso!');
        }
        showList('patients');
    } catch (error) {
        console.error("Error saving patient:", error);
        const code = error && error.code ? String(error.code) : '-';
        const msg = error && error.message ? String(error.message) : 'Erro desconhecido';
        showToast(`Erro ao salvar paciente (${code}): ${msg}`, true);
    }
});

// --- PROFESSIONAL LOGIC, PHOTO & EMAIL VALIDATION ---

function resetPhotoPreview() {
    photoPreview.innerHTML = '<i class="ri-camera-line"></i>';
    photoBase64.value = '';
    btnRemovePhoto.style.display = 'none';
    if (professionalPhotoCapture) professionalPhotoCapture.value = '';
    if (professionalPhotoUpload) professionalPhotoUpload.value = '';
}

function handlePhotoFile(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const base64Str = event.target.result;
            photoBase64.value = base64Str;
            photoPreview.innerHTML = `<img src="${base64Str}" alt="Foto Profil">`;
            btnRemovePhoto.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

if (professionalPhotoCapture) professionalPhotoCapture.addEventListener('change', handlePhotoFile);
if (professionalPhotoUpload) professionalPhotoUpload.addEventListener('change', handlePhotoFile);
// WebRTC Camera Logic
const btnOpenModalCamera = document.getElementById('btnOpenModalCamera');
const cameraModal = document.getElementById('cameraModal');
const btnCloseCameraModal = document.getElementById('btnCloseCameraModal');
const btnCancelCamera = document.getElementById('btnCancelCamera');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');
const btnTakePhoto = document.getElementById('btnTakePhoto');
let mediaStream = null;

if (btnOpenModalCamera) {
    btnOpenModalCamera.addEventListener('click', async () => {
        cameraModal.classList.remove('hidden');
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            cameraVideo.srcObject = mediaStream;
            cameraVideo.play();
        } catch (err) {
            console.error("Erro ao acessar câmera: ", err);
            alert("Não foi possível acessar a câmera do seu dispositivo. Verifique as permissões de privacidade.");
            closeCameraModal();
        }
    });
}

function closeCameraModal() {
    cameraModal.classList.add('hidden');
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

if (btnCloseCameraModal) btnCloseCameraModal.addEventListener('click', closeCameraModal);
if (btnCancelCamera) btnCancelCamera.addEventListener('click', closeCameraModal);

if (btnTakePhoto) {
    btnTakePhoto.addEventListener('click', () => {
        if (!mediaStream) return;
        const context = cameraCanvas.getContext('2d');
        cameraCanvas.width = cameraVideo.videoWidth;
        cameraCanvas.height = cameraVideo.videoHeight;
        context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

        const base64Str = cameraCanvas.toDataURL('image/png');
        photoBase64.value = base64Str;
        photoPreview.innerHTML = `<img src="${base64Str}" alt="Foto Profil">`;
        btnRemovePhoto.style.display = 'block';

        closeCameraModal();
    });
}

btnRemovePhoto.addEventListener('click', resetPhotoPreview);

// Tipo Change -> Condicionais de Comissão
profTipoSelect.addEventListener('change', (e) => {
    const tipo = e.target.value;
    if (tipo) {
        comissionCard.style.display = 'block';

        // Reset inputs
        ['comissionCE', 'comissionCC', 'comissionCP', 'comissionEE', 'comissionEC', 'comissionEP', 'comissionImp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        if (tipo === 'Clinico') {
            document.getElementById('comissionCEDiv').style.display = 'block';
            document.getElementById('comissionCCDiv').style.display = 'block';
            document.getElementById('comissionCPDiv').style.display = 'block';
            document.getElementById('comissionEEDiv').style.display = 'none';
            document.getElementById('comissionECDiv').style.display = 'none';
            document.getElementById('comissionEPDiv').style.display = 'none';
            document.getElementById('profEspecialidadeDiv').style.display = 'none';
            document.getElementById('profEspecialidade').required = false;
        } else if (tipo === 'Especialista') {
            document.getElementById('comissionCEDiv').style.display = 'none';
            document.getElementById('comissionCCDiv').style.display = 'none';
            document.getElementById('comissionCPDiv').style.display = 'none';
            document.getElementById('comissionEEDiv').style.display = 'block';
            document.getElementById('comissionECDiv').style.display = 'block';
            document.getElementById('comissionEPDiv').style.display = 'block';
            document.getElementById('profEspecialidadeDiv').style.display = 'block';
            document.getElementById('profEspecialidade').required = true;
        } else if (tipo === 'Protetico') {
            document.getElementById('comissionCEDiv').style.display = 'block';
            document.getElementById('comissionCCDiv').style.display = 'block';
            document.getElementById('comissionCPDiv').style.display = 'block';
            document.getElementById('comissionEEDiv').style.display = 'none';
            document.getElementById('comissionECDiv').style.display = 'none';
            document.getElementById('comissionEPDiv').style.display = 'none';
            document.getElementById('profEspecialidadeDiv').style.display = 'none';
            document.getElementById('profEspecialidade').required = false;
        }
    } else {
        comissionCard.style.display = 'none';
    }
});

// Form Submit Professional
professionalForm.addEventListener('submit', async e => {
    e.preventDefault();

    // Prevent submit if email is invalid or checking
    if (btnSaveProfessional.disabled) return;

    const id = document.getElementById('editProfessionalId').value;
    const emailValue = profEmailInput.value.trim().toLowerCase();
    const profEmailError = document.getElementById('profEmailError');

    // Strict Unique validation across DBs (fallback sanity check)
    if (isEmailDuplicate(emailValue, id)) {
        profEmailInput.classList.add('input-error');
        profEmailError.innerText = 'E-mail já está sendo utilizado por outro paciente ou profissional.';
        profEmailError.style.display = 'block';
        return;
    }

    const tipo = profTipoSelect.value;

    const profData = {
        id: id || generateId(),
        seqid: id ? (professionals.find(x => x.id === id)?.seqid || getNextSeqId(professionals)) : getNextSeqId(professionals),
        nome: document.getElementById('profNome').value,
        celular: document.getElementById('profCelular').value,
        email: emailValue,
        tipo: tipo,
        especialidadeid: tipo === 'Especialista' ? document.getElementById('profEspecialidade').value : null,
        status: document.getElementById('profStatus').value,
        photo: photoBase64.value, // Base64 image
        empresa_id: currentEmpresaId,
        comissions: {
            ce: tipo === 'Clinico' ? (document.getElementById('comissionCE').value || 0) : null,
            cc: tipo === 'Clinico' ? (document.getElementById('comissionCC').value || 0) : null,
            cp: tipo === 'Clinico' ? (document.getElementById('comissionCP').value || 0) : null,
            ee: tipo === 'Especialista' ? (document.getElementById('comissionEE').value || 0) : null,
            ec: tipo === 'Especialista' ? (document.getElementById('comissionEC').value || 0) : null,
            ep: tipo === 'Especialista' ? (document.getElementById('comissionEP').value || 0) : null,
            imp: document.getElementById('comissionImp').value || 0
        }
    };

    const agendaCheck = buildAgendaPayload(currentEmpresaId, profData.seqid);
    if (agendaCheck.errors && agendaCheck.errors.length) {
        showToast(agendaCheck.errors[0], true);
        return;
    }

    try {
        let saved = null;
        if (id) {
            const q = db.from('profissionais').update(profData).eq('id', id);
            const { error } = await withTimeout(q, 20000, 'profissionais:update');
            if (error) throw error;

            const index = professionals.findIndex(p => p.id === id);
            if (index !== -1) professionals[index] = { ...professionals[index], ...profData };
            saved = profData;
        } else {
            profData.id = generateId();
            profData.seqid = getNextSeqId(professionals);

            const q = db.from('profissionais').insert(profData).select().single();
            const { data, error } = await withTimeout(q, 20000, 'profissionais:insert');
            if (error) throw error;

            if (data) professionals.push(data);
            saved = data || profData;
            document.getElementById('editProfessionalId').value = String(saved.id || '');
            document.getElementById('profIdDisplay').value = String(saved.seqid || '');
        }

        try {
            await saveAgendaDisponibilidade(saved.seqid, currentEmpresaId);
        } catch (err2) {
            const msg2 = (err2 && err2.message) ? err2.message : String(err2);
            console.error('Erro ao salvar disponibilidade do profissional:', msg2);
            showToast(`Profissional salvo, mas disponibilidade NÃO foi salva: ${msg2}`, true);
            return;
        }

        showToast(id ? 'Profissional atualizado com sucesso!' : 'Profissional cadastrado com sucesso!');
        showList('professionals');
    } catch (error) {
        console.error("Error saving professional:", error);
        const msg = (error && error.message) ? error.message : 'Erro ao salvar profissional.';
        showToast(msg, true);
    }
});

function isEmailDuplicate(email, excludeId) {
    // Check professionals
    const inProf = professionals.some(p => p.email.toLowerCase() === email && p.id !== excludeId);
    // Check patients (patients might not have email array property defined thoroughly yet, but we check if they do)
    const inPat = patients.some(p => p.email && p.email.toLowerCase() === email);

    return inProf || inPat;
}

// Advanced Email Checking via Mock API & Debounce
let emailValidationTimeout;

profEmailInput.addEventListener('input', (e) => {
    clearTimeout(emailValidationTimeout);

    const email = e.target.value.trim().toLowerCase();
    const errorMsgEl = document.getElementById('profEmailError');
    const id = document.getElementById('editProfessionalId').value;

    // Reset visual state
    e.target.classList.remove('input-error');
    errorMsgEl.style.display = 'none';
    emailValidationIndicator.innerHTML = '';
    emailValidationIndicator.className = 'validation-indicator';
    btnSaveProfessional.disabled = false;

    if (!email) return;

    // regex formatting fast check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        e.target.classList.add('input-error');
        errorMsgEl.innerText = 'Formato de e-mail inválido.';
        errorMsgEl.style.display = 'block';
        btnSaveProfessional.disabled = true;
        return;
    }

    // Checking uniqueness locally
    if (isEmailDuplicate(email, id)) {
        e.target.classList.add('input-error');
        errorMsgEl.innerText = 'E-mail já está sendo utilizado (Profissional ou Paciente).';
        errorMsgEl.style.display = 'block';
        btnSaveProfessional.disabled = true;
        return;
    }

    // Start Async API verification process (debounced)
    emailValidationIndicator.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Verificando MX/Domínio...';
    emailValidationIndicator.className = 'validation-indicator checking';
    btnSaveProfessional.disabled = true; // prevent save while checking

    emailValidationTimeout = setTimeout(async () => {
        try {
            // NOTE: In a real production environment, you would call a backend service or a paid API
            // (e.g. built-in abstractapi like `https://emailvalidation.abstractapi.com/v1/?api_key=YOUR_KEY&email=${email}`)
            // Here, we simulate a network call that checks the domain MX record.
            // We use a free public email validator API that allows CORS for demonstration.

            // For 100% vanilla client side without API keys, we simulate an API call checking the domain
            const domain = email.split('@')[1];

            // Public DNS over HTTPS (Google) to check MX records of the domain
            const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
            const data = await response.json();

            if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
                // MX record exists
                emailValidationIndicator.innerHTML = '<i class="ri-check-line"></i> E-mail válido e verificado';
                emailValidationIndicator.className = 'validation-indicator valid';
                btnSaveProfessional.disabled = false;
            } else {
                // Domain doesn't exist or no MX records
                throw new Error("Domínio inexistente ou sem servidor de e-mail.");
            }

        } catch (error) {
            console.error('Email MX Validation Error:', error);
            e.target.classList.add('input-error');
            emailValidationIndicator.innerHTML = '<i class="ri-error-warning-line"></i> Domínio Inválido';
            emailValidationIndicator.className = 'validation-indicator invalid';
            errorMsgEl.innerText = 'Este e-mail ou domínio não existe (MX não encontrado).';
            errorMsgEl.style.display = 'block';
            btnSaveProfessional.disabled = true;
        }
    }, 1000); // 1 second debounce
});

// Edit & Delete exposed to window for inline onclick handlers
window.editPatient = function (id) {
    const p = patients.find(pat => pat.id === id);
    if (!p) return;

    showForm(true, 'patients');
    document.getElementById('patIdDisplay').value = p.seqid || '';
    document.getElementById('editId').value = p.id;
    document.getElementById('nome').value = p.nome;
    document.getElementById('cpf').value = p.cpf;
    document.getElementById('dataNascimento').value = p.datanascimento || '';
    document.getElementById('sexo').value = p.sexo || '';
    document.getElementById('profissao').value = p.profissao || '';
    document.getElementById('telefone').value = p.telefone || '';
    document.getElementById('celular').value = p.celular || '';
    document.getElementById('email').value = p.email || '';
    document.getElementById('cep').value = p.cep || '';
    document.getElementById('endereco').value = p.endereco || '';
    document.getElementById('numero').value = p.numero || '';
    document.getElementById('complemento').value = p.complemento || '';
    document.getElementById('bairro').value = p.bairro || '';
    document.getElementById('cidade').value = p.cidade || '';
    document.getElementById('uf').value = p.uf || '';

    // Anamnese
    const a = p.anamnese || {};
    document.getElementById('emTratamentoMedico').checked = !!a.emTratamentoMedico;
    document.getElementById('tratamentoDesc').value = a.tratamentoDesc || '';

    document.getElementById('tomaMedicacao').checked = !!a.tomaMedicacao;
    document.getElementById('medicacaoDesc').value = a.medicacaoDesc || '';

    document.getElementById('temAlergia').checked = !!a.temAlergia;
    document.getElementById('alergiaDesc').value = a.alergiaDesc || '';

    document.getElementById('teveHemorragia').checked = !!a.teveHemorragia;
    document.getElementById('doencasPreexistentes').value = a.doencasPreexistentes || '';

    // Trigger changes to show/hide text inputs
    document.getElementById('emTratamentoMedico').dispatchEvent(new Event('change'));
    document.getElementById('tomaMedicacao').dispatchEvent(new Event('change'));
    document.getElementById('temAlergia').dispatchEvent(new Event('change'));
};

window.deletePatient = async function (id) {
    if (!can('pacientes', 'delete')) {
        showToast("Você não tem permissão para excluir pacientes.", true);
        return;
    }
    const p = patients.find(x => String(x.id) === String(id));
    const blockers = [];
    try {
        if (currentEmpresaId) {
            blockers.push({
                label: 'Orçamentos',
                count: await countExact(
                    db.from('orcamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('pacienteid', id),
                    'orcamentos:patient'
                )
            });
            if (p && p.seqid) {
                blockers.push({
                    label: 'Agendamentos',
                    count: await countExact(
                        db.from('agenda_agendamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('paciente_id', Number(p.seqid)),
                        'agenda_agendamentos:patient'
                    )
                });
                blockers.push({
                    label: 'Transações',
                    count: await countExact(
                        db.from('financeiro_transacoes').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('paciente_id', Number(p.seqid)),
                        'financeiro_transacoes:patient'
                    )
                });
                blockers.push({
                    label: 'Cancelamentos',
                    count: await countExact(
                        db.from('orcamento_cancelados').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('paciente_id', Number(p.seqid)),
                        'orcamento_cancelados:patient'
                    )
                });
            }
            blockers.push({
                label: 'Prontuário',
                count: await countExact(
                    db.from('paciente_evolucao').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('paciente_id', id),
                    'paciente_evolucao:patient'
                )
            });
            blockers.push({
                label: 'Documentos',
                count: await countExact(
                    db.from('paciente_documentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('paciente_id', id),
                    'paciente_documentos:patient'
                )
            });
        }
    } catch (error) {
        console.error("Error checking patient dependencies:", error);
        showToast("Erro ao validar vínculos do paciente.", true);
        return;
    }

    const blockedMsg = formatBlockers(blockers);
    if (blockedMsg) {
        showToast(`Não é possível excluir: ${blockedMsg}`, true);
        return;
    }

    if (confirm('Tem certeza que deseja excluir este paciente?')) {
        try {
            const { error } = await db.from('pacientes').delete().eq('id', id);
            if (error) throw error;

            patients = patients.filter(p => p.id !== id);
            renderTable(patients, 'patients');
            showToast('Paciente removido com sucesso!');
        } catch (error) {
            console.error("Error deleting patient:", error);
            showToast("Erro ao remover paciente.", true);
        }
    }
};

window.editProfessional = function (id) {
    const p = professionals.find(pat => pat.id === id);
    if (!p) return;

    showForm(true, 'professionals');
    document.getElementById('profIdDisplay').value = p.seqid || '';

    document.getElementById('editProfessionalId').value = p.id;
    document.getElementById('profNome').value = p.nome;
    document.getElementById('profCelular').value = p.celular || '';

    // Bypass validation visually on edit load for the existing email
    profEmailInput.value = p.email || '';
    btnSaveProfessional.disabled = false;

    document.getElementById('profStatus').value = p.status || 'Ativo';

    // Photo
    if (p.photo) {
        photoPreview.innerHTML = `<img src="${p.photo}" alt="Foto Profil">`;
        photoBase64.value = p.photo;
        btnRemovePhoto.style.display = 'block';
    } else {
        resetPhotoPreview();
    }

    // Tipo & Comissions
    profTipoSelect.value = p.tipo || '';
    if (p.tipo === 'Especialista' && p.especialidadeid) {
        document.getElementById('profEspecialidade').value = p.especialidadeid;
    }
    profTipoSelect.dispatchEvent(new Event('change')); // trigger display logic

    if (p.comissions) {
        if (p.tipo === 'Clinico') {
            document.getElementById('comissionCE').value = p.comissions.ce || '';
            document.getElementById('comissionCC').value = p.comissions.cc || '';
            document.getElementById('comissionCP').value = p.comissions.cp || '';
        } else if (p.tipo === 'Especialista') {
            document.getElementById('comissionEE').value = p.comissions.ee || '';
            document.getElementById('comissionEC').value = p.comissions.ec || '';
            document.getElementById('comissionEP').value = p.comissions.ep || '';
        }
        document.getElementById('comissionImp').value = p.comissions.imp || '';
    }

    loadAgendaDisponibilidade(p.seqid, currentEmpresaId);
};

window.deleteProfessional = async function (id) {
    if (!can('profissionais', 'delete')) {
        showToast("Você não tem permissão para excluir profissionais.", true);
        return;
    }
    const prof = professionals.find(x => String(x.id) === String(id));
    const blockers = [];
    try {
        if (currentEmpresaId) {
            if (prof && prof.seqid) {
                const seq = Number(prof.seqid);
                blockers.push({
                    label: 'Orçamentos',
                    count: await countExact(
                        db.from('orcamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('profissional_id', seq),
                        'orcamentos:professional'
                    )
                });
                blockers.push({
                    label: 'Itens de Orçamento',
                    count: await countExact(
                        db.from('orcamento_itens').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).or(`profissional_id.eq.${seq},protetico_id.eq.${seq}`),
                        'orcamento_itens:professional'
                    )
                });
                blockers.push({
                    label: 'Comissões',
                    count: await countExact(
                        db.from('financeiro_comissoes').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('profissional_id', seq),
                        'financeiro_comissoes:professional'
                    )
                });
                blockers.push({
                    label: 'Agenda (Disponibilidade)',
                    count: await countExact(
                        db.from('agenda_disponibilidade').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('profissional_id', seq),
                        'agenda_disponibilidade:professional'
                    )
                });
                blockers.push({
                    label: 'Agenda (Agendamentos)',
                    count: await countExact(
                        db.from('agenda_agendamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('profissional_id', seq),
                        'agenda_agendamentos:professional'
                    )
                });
            }
            blockers.push({
                label: 'Prontuário',
                count: await countExact(
                    db.from('paciente_evolucao').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('profissional_id', id),
                    'paciente_evolucao:professional'
                )
            });
        }
    } catch (error) {
        console.error("Error checking professional dependencies:", error);
        showToast("Erro ao validar vínculos do profissional.", true);
        return;
    }

    const blockedMsg = formatBlockers(blockers);
    if (blockedMsg) {
        showToast(`Não é possível excluir: ${blockedMsg}`, true);
        return;
    }

    if (confirm('Tem certeza que deseja excluir este profissional?')) {
        try {
            const { error } = await db.from('profissionais').delete().eq('id', id);
            if (error) throw error;

            professionals = professionals.filter(p => p.id !== id);
            renderTable(professionals, 'professionals');
            showToast('Profissional removido com sucesso!');
        } catch (error) {
            console.error("Error deleting professional:", error);
            showToast("Erro ao remover profissional.", true);
        }
    }
};

// Form Submit Specialty
if (specialtyForm) {
    specialtyForm.addEventListener('submit', async e => {
        e.preventDefault();
        const id = document.getElementById('editSpecialtyId').value;

        // Permission check
        if (!can('especialidades', id ? 'update' : 'insert')) {
            showToast("Você não tem permissão para esta ação.", true);
            return;
        }

        const name = document.getElementById('specNome').value.toUpperCase();
        const nameKey = String(name || '').trim().toUpperCase();
        if (nameKey) {
            const hasDup = specialties.some(s => {
                if (!s) return false;
                if (id && String(s.id) === String(id)) return false;
                return String(s.nome || '').trim().toUpperCase() === nameKey;
            });
            if (hasDup) {
                showToast('Já existe uma especialidade com este nome.', true);
                return;
            }
        }
        const specData = {
            nome: name,
            empresa_id: currentEmpresaId
        };

        try {
            let targetId = id;
            if (id) {
                const { error } = await db.from('especialidades').update(specData).eq('id', id);
                if (error) throw error;
                showToast('Especialidade atualizada com sucesso!');
            } else {
                targetId = generateId();
                specData.id = targetId;
                specData.seqid = getNextSeqId(specialties);

                const { data, error } = await db.from('especialidades').insert(specData).select().single();
                if (error) throw error;
                if (data) specialties.push(data);
                showToast('Especialidade cadastrada com sucesso!');
            }

            // Synchronize subdivisions: Delete old ones and insert new ones
            // This is a simple approach; for large data, a more granular diff would be better
            const { error: delError } = await db.from('especialidade_subdivisoes').delete().eq('empresa_id', currentEmpresaId).eq('especialidade_id', targetId);
            if (delError) throw delError;

            const newSubs = [];
            const seenSubKeys = new Set();
            const uniqueSubs = (currentSpecialtySubdivisions || []).filter(sub => {
                const k = String(sub && sub.nome ? sub.nome : '').trim().toUpperCase();
                if (!k) return false;
                if (seenSubKeys.has(k)) return false;
                seenSubKeys.add(k);
                return true;
            });
            for (let sub of uniqueSubs) {
                const subData = {
                    id: generateId(),
                    especialidade_id: targetId,
                    nome: sub.nome,
                    empresa_id: currentEmpresaId
                };
                const { data: savedSub, error: insError } = await db.from('especialidade_subdivisoes').insert(subData).select().single();
                if (insError) throw insError;
                if (savedSub) newSubs.push(savedSub);
            }

            // Update local state
            const specIndex = specialties.findIndex(s => s.id === targetId);
            if (specIndex !== -1) {
                specialties[specIndex].nome = name;
                specialties[specIndex].subdivisoes = newSubs;
            }

            showList('specialties');
        } catch (error) {
            console.error("Error saving specialty or subdivisions:", error);
            showToast("Erro ao salvar especialidade.", true);
        }
    });
}

window.editSpecialty = function (id) {
    const s = specialties.find(spec => spec.id === id);
    if (!s) return;

    showForm(true, 'specialties');
    document.getElementById('specIdDisplay').value = s.seqid || '';
    document.getElementById('editSpecialtyId').value = s.id;
    document.getElementById('specNome').value = s.nome;

    currentSpecialtySubdivisions = s.subdivisoes ? [...s.subdivisoes] : [];
    if (typeof renderSubSpecTable === 'function') renderSubSpecTable();
};

window.deleteSpecialty = async function (id) {
    if (!can('especialidades', 'delete')) {
        showToast("Você não tem permissão para excluir especialidades.", true);
        return;
    }
    const blockers = [];
    try {
        if (currentEmpresaId) {
            blockers.push({
                label: 'Profissionais',
                count: await countExact(
                    db.from('profissionais').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('especialidadeid', id),
                    'profissionais:specialty'
                )
            });
            blockers.push({
                label: 'Subdivisões',
                count: await countExact(
                    db.from('especialidade_subdivisoes').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('especialidade_id', id),
                    'especialidade_subdivisoes:specialty'
                )
            });
        }
    } catch (error) {
        console.error("Error checking specialty dependencies:", error);
        showToast("Erro ao validar vínculos da especialidade.", true);
        return;
    }

    const blockedMsg = formatBlockers(blockers);
    if (blockedMsg) {
        showToast(`Não é possível excluir: ${blockedMsg}`, true);
        return;
    }

    if (confirm('Tem certeza que deseja excluir esta especialidade?')) {
        try {
            const { error } = await db.from('especialidades').delete().eq('id', id);
            if (error) throw error;

            specialties = specialties.filter(s => s.id !== id);
            renderTable(specialties, 'specialties');
            showToast('Especialidade removida com sucesso!');
        } catch (error) {
            console.error("Error deleting specialty:", error);
            showToast("Erro ao remover especialidade.", true);
        }
    }
};

// --- SPECIALTY SUBDIVISIONS LOGIC ---
const btnAddSubSpec = document.getElementById('btnAddSubSpec');
if (btnAddSubSpec) {
    btnAddSubSpec.addEventListener('click', () => {
        const nameInput = document.getElementById('subSpecNome');
        const name = nameInput.value.trim().toUpperCase();
        if (name) {
            if (editingSubSpecIndex > -1) {
                const exists = currentSpecialtySubdivisions.some((s, i) => i !== editingSubSpecIndex && String(s.nome || '').trim().toUpperCase() === name);
                if (exists) {
                    showToast('Esta subdivisão já existe.', true);
                    return;
                }
                currentSpecialtySubdivisions[editingSubSpecIndex].nome = name;
                editingSubSpecIndex = -1;
                btnAddSubSpec.textContent = 'Adicionar';
                btnAddSubSpec.classList.remove('btn-primary');
                btnAddSubSpec.classList.add('btn-secondary');
            } else {
                const exists = currentSpecialtySubdivisions.some(s => String(s.nome || '').trim().toUpperCase() === name);
                if (exists) {
                    showToast('Esta subdivisão já existe.', true);
                    return;
                }
                currentSpecialtySubdivisions.push({ nome: name });
            }
            nameInput.value = '';
            renderSubSpecTable();
        }
    });

    const subSpecNomeInput = document.getElementById('subSpecNome');
    if (subSpecNomeInput) {
        subSpecNomeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnAddSubSpec.click();
            }
        });
    }
}

function renderSubSpecTable() {
    const tbody = document.getElementById('subSpecTableBody');
    const empty = document.getElementById('subSpecEmpty');
    if (!tbody || !empty) return;

    tbody.innerHTML = '';

    if (currentSpecialtySubdivisions.length === 0) {
        empty.style.display = 'block';
        tbody.parentElement.style.display = 'none';
    } else {
        empty.style.display = 'none';
        tbody.parentElement.style.display = 'table';

        const specSeqId = document.getElementById('specIdDisplay').value || 'Novo';
        const displayBaseId = specSeqId !== 'Novo' ? specSeqId : getNextSeqId(specialties);

        currentSpecialtySubdivisions.forEach((sub, index) => {
            const subId = `${displayBaseId}.${index + 1}`;
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";
            const rowStyle = (editingSubSpecIndex === index) ? "background-color: #fff4e5;" : "";
            tr.style.cssText += rowStyle;

            tr.innerHTML = `
                <td style="padding: 8px;">${subId}</td>
                <td style="padding: 8px;">${sub.nome}</td>
                <td style="padding: 8px; text-align: right;">
                    <button type="button" class="btn-icon" onclick="editSubSpec(${index})" title="Editar" style="padding: 4px; border: 1px solid #ddd; margin-right: 5px;">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button type="button" class="btn-icon delete-btn" onclick="removeSubSpec(${index})" title="Remover" style="padding: 4px;">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

window.editSubSpec = function (index) {
    const sub = currentSpecialtySubdivisions[index];
    if (!sub) return;

    editingSubSpecIndex = index;
    const nameInput = document.getElementById('subSpecNome');
    nameInput.value = sub.nome;
    nameInput.focus();

    const btnAdd = document.getElementById('btnAddSubSpec');
    btnAdd.textContent = 'Atualizar';
    btnAdd.classList.remove('btn-secondary');
    btnAdd.classList.add('btn-primary');

    renderSubSpecTable();
};

window.removeSubSpec = function (index) {
    if (editingSubSpecIndex === index) {
        editingSubSpecIndex = -1;
        const btnAdd = document.getElementById('btnAddSubSpec');
        btnAdd.textContent = 'Adicionar';
        btnAdd.classList.remove('btn-primary');
        btnAdd.classList.add('btn-secondary');
        document.getElementById('subSpecNome').value = '';
    } else if (editingSubSpecIndex > index) {
        editingSubSpecIndex--;
    }

    currentSpecialtySubdivisions.splice(index, 1);
    renderSubSpecTable();
};

window.renderTable = function (data, type) {
    const tableMap = {
        financeiro: { tbodyId: 'finTransacoesBody' },
        cancelled_budgets: { tbodyId: 'cancelledBudgetsTableBody', emptyStateId: 'cancelledBudgetsEmptyState' },
        usersAdmin: { tbodyId: 'usersAdminTableBody', emptyStateId: 'usersAdminEmptyState' }
    };

    const cfg = tableMap[type] || {};
    const tbody = document.getElementById(cfg.tbodyId || `${type}TableBody`);
    const emptyState = document.getElementById(cfg.emptyStateId || `${type}EmptyState`);
    if (!tbody) return;

    if (window.__dpDebug) {
        window.__dpDebug.lastRenderInputLen = Array.isArray(data) ? data.length : (data ? 1 : 0);
    }

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        if (type === 'financeiro') {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Nenhum lançamento encontrado.</td></tr>';
        } else {
            if (emptyState) emptyState.classList.remove('hidden');
        }
        if (window.__dpDebug) {
            window.__dpDebug.lastRenderRows = tbody.children.length;
            window.__dpDebug.lastFirstRow = tbody.textContent.trim().slice(0, 40);
        }
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (type === 'usersAdmin') {
        usersAdminList = data || [];
    }

    data.forEach((item, index) => {
        const tr = document.createElement('tr');

        if (type === 'patients') {
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td style="font-weight: 600;">${item.nome}</td>
                <td>${item.cpf || '-'}</td>
                <td>${item.celular || '-'}</td>
                <td><span class="badge badge-${(item.status || 'Ativo').toLowerCase()}">${item.status || 'Ativo'}</span></td>
                <td>
                    <div class="actions">
                        <button onclick="showPatientDetails('${item.id}')" class="btn-icon" title="Ver Prontuário"><i class="ri-folder-user-line"></i></button>
                        <button onclick="editPatient('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                        <button onclick="deletePatient('${item.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </td>
            `;
        } else if (type === 'budgets') {
            const total = calculateBudgetTotal(item);
            const isCancelled = item.status === 'Cancelado';
            
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td style="font-weight: 600;">${item.pacientenome}</td>
                <td>${item.pacientecelular || '-'}</td>
                <td>${(item.orcamento_itens || []).length} itens</td>
                <td style="font-weight: 600;">R$ ${total.toFixed(2)}</td>
                <td style="font-weight: 600; color: var(--success-color);">R$ ${getBudgetPaidAmount(item).toFixed(2)}</td>
                <td><span class="badge badge-${(item.status || 'Pendente').toLowerCase().replace(/\s+/g, '-')}">${item.status || 'Pendente'}</span></td>
                <td>
                    <div class="actions">
                        <button onclick="viewBudgetPayments('${item.id}')" class="btn-icon" title="Pagamentos & Liberação"><i class="ri-money-dollar-circle-line"></i></button>
                        <button onclick="printBudget('${item.id}')" class="btn-icon" title="Imprimir"><i class="ri-printer-line"></i></button>
                        ${!isCancelled ? `
                            <button onclick="editBudget('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                            <button onclick="deleteBudget('${item.id}')" class="btn-icon btn-delete" title="Cancelar Orçamento"><i class="ri-delete-bin-line"></i></button>
                        ` : `
                            <button class="btn-icon" style="opacity: 0.3; cursor: not-allowed;" title="Orçamento Cancelado (Edição Bloqueada)"><i class="ri-edit-line"></i></button>
                        `}
                    </div>
                </td>
            `;
        } else if (type === 'professionals') {
            const photoHtml = item.photo
                ? `<img src="${item.photo}" alt="Foto" style="width:34px; height:34px; border-radius:50%; object-fit:cover; display:block;">`
                : `<div style="width:34px; height:34px; border-radius:50%; background:#e5e7eb; display:flex; align-items:center; justify-content:center; color:var(--text-muted);"><i class="ri-user-3-line"></i></div>`;
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td>${photoHtml}</td>
                <td style="font-weight: 600;">${item.nome}</td>
                <td>${item.celular || '-'}</td>
                <td>${item.tipo}</td>
                <td><span class="badge badge-${(item.status || 'Ativo').toLowerCase()}">${item.status || 'Ativo'}</span></td>
                <td>
                    <div class="actions">
                        <button onclick="printProfessional('${item.id}')" class="btn-icon" title="Imprimir Ficha"><i class="ri-printer-line"></i></button>
                        <button onclick="editProfessional('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                        <button onclick="deleteProfessional('${item.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </td>
            `;
        } else if (type === 'specialties') {
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td style="font-weight: 600;">${item.nome}</td>
                <td>${(item.subdivisoes || []).length} subdivisões</td>
                <td>
                    <div class="actions">
                        <button onclick="editSpecialty('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                        <button onclick="deleteSpecialty('${item.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </td>
            `;
        } else if (type === 'services') {
            const subBadge = item.subdivisao
                ? `<span style="background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--text-color);">${item.subdivisao}</span>`
                : '<small style="color:var(--text-muted)">-</small>';
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td style="font-weight: 600;">${item.descricao}</td>
                <td style="font-weight: 600; color: var(--primary-color);">R$ ${parseFloat(item.valor || 0).toFixed(2)}</td>
                <td>${item.ie === 'S' ? 'Serviço' : 'Estoque'}</td>
                <td>${subBadge}</td>
                <td>
                    <div class="actions">
                        <button onclick="printService('${item.id}')" class="btn-icon" title="Imprimir"><i class="ri-printer-line"></i></button>
                        <button onclick="editService('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                        <button onclick="deleteService('${item.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </td>
            `;
        } else if (type === 'protese') {
            const pacienteNome = getPatientNameById(item.paciente_id);
            const exec = String(item.tipo_execucao || '');
            const execLabel = exec === 'INTERNA' ? 'Interna' : 'Externa';
            const execName = exec === 'INTERNA' ? getProteticoNameById(item.protetico_id) : getLaboratorioNameById(item.laboratorio_id);
            const prazo = item.prazo_previsto ? String(item.prazo_previsto).slice(0, 10).split('-').reverse().join('/') : '';
            const overdue = isProteseOverdue(item);
            const st = String(item.status_geral || 'EM_ANDAMENTO');
            const stBg = st === 'CONCLUIDA' ? '#dcfce7' : (st === 'CANCELADA' ? '#fee2e2' : (st === 'PAUSADA' ? '#fef3c7' : 'var(--bg-hover)'));
            const stColor = st === 'CONCLUIDA' ? '#166534' : (st === 'CANCELADA' ? '#991b1b' : (st === 'PAUSADA' ? '#92400e' : 'var(--text-main)'));
            tr.innerHTML = `
                <td><strong>#${escapeHtml(String(item.seqid || ''))}</strong></td>
                <td>${escapeHtml(String(pacienteNome || '—'))}</td>
                <td>${escapeHtml(formatBudgetDisplay(item.orcamento_id))}</td>
                <td>${escapeHtml(execLabel)}</td>
                <td>${escapeHtml(String(execName || '—'))}</td>
                <td>${escapeHtml(String(item.fase_atual || '—'))}</td>
                <td style="color:${overdue ? 'var(--danger-color)' : 'var(--text-main)'}; font-weight:${overdue ? '800' : '500'};">${escapeHtml(prazo || '—')}</td>
                <td><span style="background:${stBg}; color:${stColor}; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem; font-weight: 800;">${escapeHtml(st)}</span></td>
                <td class="actions-cell">
                    <button class="btn-icon" data-action="print" data-id="${item.id}" title="Imprimir"><i class="ri-printer-line"></i></button>
                    <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Editar"><i class="ri-edit-line"></i></button>
                    <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir" style="background:#ef444411; color:#ef4444;"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;

            const btnPrint = tr.querySelector('button[data-action="print"]');
            if (btnPrint) btnPrint.addEventListener('click', async () => { await printProteseOrder(item.id); });

            const btnEdit = tr.querySelector('button[data-action="edit"]');
            if (btnEdit) btnEdit.addEventListener('click', () => openProteseModal({ orderId: item.id }));

            const btnDelete = tr.querySelector('button[data-action="delete"]');
            if (btnDelete) btnDelete.addEventListener('click', async () => { await deleteProteseOrder(item.id); });
        } else if (type === 'financeiro') {
            const isCredit = item.tipo === 'CREDITO';
            const valorFormatado = Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const canDel = canDeleteFinanceTransactionRow(item) && can('financeiro', 'delete');
            const delBtn = canDel
                ? `<button class="btn-icon delete-btn" onclick="deleteTransaction('${item.id}')" title="Excluir Lançamento"><i class="ri-delete-bin-line"></i></button>`
                : `<button class="btn-icon" style="opacity:0.35; cursor:not-allowed;" title="Exclusão bloqueada: lançamento vinculado"><i class="ri-lock-line"></i></button>`;
            tr.innerHTML = `
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${item.seqid || index + 1}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);"><strong>${item.paciente_nome || '—'}</strong></td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${formatDateTime(item.data_transacao)}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${item.categoria || '—'}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${item.forma_pagamento || '—'}</td>
                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--border-color);"><strong>${valorFormatado}</strong></td>
                <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid var(--border-color);">
                    ${isCredit ? '<span style="color: var(--success-color); font-weight: 600;">CRÉDITO</span>' : '<span style="color: #dc3545; font-weight: 600;">DÉBITO</span>'}
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.observacoes || ''}">${item.observacoes || '—'}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); text-align: center;">
                    ${delBtn}
                </td>
            `;
        } else if (type === 'cancelled_budgets') {
            const dataCancel = item.data_cancelamento ? new Date(item.data_cancelamento).toLocaleString('pt-BR') : '-';
            const motivo = item.motivo_cancelamento || '-';
            tr.innerHTML = `
                <td><strong>#${item.orcamento_seqid || 'N/A'}</strong></td>
                <td>${item.paciente_nome || '-'}</td>
                <td>${dataCancel}</td>
                <td style="text-align: right; color: var(--danger-color); font-weight: 600;">R$ ${Number(item.total_pago_na_epoca || 0).toFixed(2)}</td>
                <td title="${motivo}">${motivo.length > 40 ? (motivo.substring(0, 40) + '...') : motivo}</td>
                <td><small>${item.cancelado_por_nome || '-'}</small></td>
                <td style="text-align: center;">
                    <button class="btn-icon" onclick="showCancelDetails('${item.id}')" title="Ver Detalhes Audit">
                        <i class="ri-eye-line"></i>
                    </button>
                    <button class="btn-icon" onclick="reprintCancellationTerm('${item.id}')" title="Reimprimir Termo">
                        <i class="ri-printer-line"></i>
                    </button>
                </td>
            `;
        } else if (type === 'usersAdmin') {
            const mappingId = item.id ? String(item.id) : 'N/A';
            const authUserId = item.usuario_id || item.user_id || '';
            const userEmail = item.user_email || (authUserId ? String(authUserId) : mappingId);
            const idForDisplay = authUserId ? String(authUserId) : mappingId;
            const shortId = idForDisplay.length > 8 ? idForDisplay.substring(0, 8) : idForDisplay;
            const userRole = (item.perfil || 'user').toUpperCase();
            tr.innerHTML = `
                <td>
                    <strong>${userEmail}</strong><br>
                    <small style="color:var(--text-muted)">ID: ${shortId}...</small>
                </td>
                <td>
                    <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-weight: bold; color: var(--primary-color);">
                        ${getEmpresaName(item.empresa_id)}
                    </code>
                </td>
                <td><span style="background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--text-color);">${userRole}</span></td>
                <td><strong style="color: var(--success-color)">Ativo</strong></td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="printUser('${mappingId}')" title="Imprimir Acesso">
                        <i class="ri-printer-line"></i>
                    </button>
                    ${mappingId !== 'N/A'
                        ? `<button class="btn-icon" onclick="editTenantUser('${mappingId}')" title="Editar Permissões"><i class="ri-edit-line"></i></button>`
                        : `<button class="btn-icon" style="opacity:0.35; cursor:not-allowed;" title="Sem ID de mapeamento"><i class="ri-edit-line"></i></button>`}
                    <button class="btn-icon delete-btn" onclick="removeTenantUser('${mappingId}')" title="Remover Acesso">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            `;
        }

        tbody.appendChild(tr);
    });

    if (window.__dpDebug) {
        window.__dpDebug.lastRenderRows = tbody.children.length;
        window.__dpDebug.lastFirstRow = tbody.textContent.trim().slice(0, 40);
    }
};

function getSpecialtyName(id) {
    const s = specialties.find(x => x.id === id);
    return s ? s.nome : '-';
}

// Form Submit Service
if (serviceForm) {
    serviceForm.addEventListener('submit', async e => {
        e.preventDefault();
        const id = document.getElementById('editServiceId').value;

        // Permission check
        if (!can('servicos', id ? 'update' : 'insert')) {
            showToast("Você não tem permissão para esta ação.", true);
            return;
        }

        const subEl = document.getElementById('servSubdivisao');
        if (!subEl || !String(subEl.value || '').trim()) {
            if (subEl) subEl.classList.add('input-error');
            showToast("Selecione a Subdivisão do item.", true);
            return;
        }

        const servData = {
            descricao: document.getElementById('servDescricao').value.toUpperCase(),
            valor: parseFloat(document.getElementById('servValor').value) || 0,
            ie: document.getElementById('servTipoIE').value,
            subdivisao: String(subEl.value || '').trim(),
            empresa_id: currentEmpresaId
        };

        try {
            if (id) {
                const { error } = await db.from('servicos').update(servData).eq('id', id);
                if (error) throw error;

                const index = services.findIndex(s => s.id === id);
                if (index !== -1) services[index] = { ...services[index], ...servData };
                showToast('Item atualizado com sucesso!');
            } else {
                servData.id = generateId();
                servData.seqid = getNextSeqId(services);

                const { data, error } = await db.from('servicos').insert(servData).select().single();
                if (error) throw error;

                if (data) services.push(data);
                showToast('Item cadastrado com sucesso!');
            }

            showList('services');
        } catch (error) {
            console.error("Error saving service:", error);
            showToast("Erro ao salvar serviço.", true);
        }
    });
}

window.editService = function (id) {
    const s = services.find(serv => serv.id === id);
    if (!s) return;

    showForm(true, 'services');
    document.getElementById('servIdDisplay').value = s.seqid || '';
    document.getElementById('editServiceId').value = s.id;
    document.getElementById('servDescricao').value = s.descricao;
    document.getElementById('servValor').value = s.valor;
    document.getElementById('servTipoIE').value = s.ie;
    const subSel = document.getElementById('servSubdivisao');
    const raw = String(s.subdivisao || '').trim();
    if (subSel) {
        subSel.classList.remove('input-error');
        if (raw) {
            const norm = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
            const options = Array.from(subSel.querySelectorAll('option'));
            const match = options.find(o => norm(o.value) === norm(raw));
            if (match) {
                subSel.value = match.value;
            } else {
                const opt = document.createElement('option');
                opt.value = raw;
                opt.textContent = raw;
                const firstOpt = subSel.querySelector('option');
                if (firstOpt && firstOpt.parentNode) {
                    firstOpt.parentNode.insertBefore(opt, firstOpt.nextSibling);
                } else {
                    subSel.appendChild(opt);
                }
                subSel.value = raw;
            }
        } else {
            subSel.value = '';
        }
    }
};

window.deleteService = async function (id) {
    if (!can('servicos', 'delete')) {
        showToast("Você não tem permissão para excluir serviços.", true);
        return;
    }
    const blockers = [];
    try {
        if (currentEmpresaId) {
            blockers.push({
                label: 'Itens de Orçamento',
                count: await countExact(
                    db.from('orcamento_itens').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('servico_id', id),
                    'orcamento_itens:service'
                )
            });
        }
    } catch (error) {
        console.error("Error checking service dependencies:", error);
        showToast("Erro ao validar vínculos do serviço.", true);
        return;
    }

    const blockedMsg = formatBlockers(blockers);
    if (blockedMsg) {
        showToast(`Não é possível excluir: ${blockedMsg}`, true);
        return;
    }

    if (confirm('Tem certeza que deseja excluir este item?')) {
        try {
            const { error } = await db.from('servicos').delete().eq('id', id);
            if (error) throw error;

            services = services.filter(s => s.id !== id);
            renderTable(services, 'services');
            showToast('Item removido com sucesso!');
        } catch (error) {
            console.error("Error deleting service:", error);
            showToast("Erro ao remover serviço.", true);
        }
    }
};

// ==========================================
// ORÇAMENTOS (BUDGETS) LOGIC
// ==========================================

if (btnNewBudget) {
    btnNewBudget.addEventListener('click', () => {
        showForm(false, 'budgets');
    });
}

if (btnBackBudget) {
    btnBackBudget.addEventListener('click', () => {
        showList('budgets');
    });
}

if (btnCancelBudget) {
    btnCancelBudget.addEventListener('click', () => {
        showList('budgets'); // Apenas esconde o formulário e mostra a lista
    });
}

function validateBudgetMasterForm() {
    if (!btnToggleAddItem) return;
    const patId = document.getElementById('budPacienteId')?.value;

    // Only enable generic "Adicionar Item" if a patient is selected
    if (patId) {
        btnToggleAddItem.disabled = false;
    } else {
        btnToggleAddItem.disabled = true;
    }
}

// Auto-fill Patient Data from Datalist
const budPacienteNomeInput = document.getElementById('budPacienteNome');
if (budPacienteNomeInput) {
    budPacienteNomeInput.addEventListener('input', (e) => {
        const inputValue = e.target.value;
        const datalistOptions = document.getElementById('pacientesDataList').options;
        let selectedId = null;

        for (let i = 0; i < datalistOptions.length; i++) {
            if (datalistOptions[i].value === inputValue) {
                selectedId = datalistOptions[i].getAttribute('data-id');
                break;
            }
        }

        document.getElementById('budPacienteId').value = selectedId;

        if (selectedId) {
            const pat = patients.find(p => p.id == selectedId || p.seqid == selectedId);
            if (pat) {
                document.getElementById('budCpfPaciente').value = pat.cpf || '';
                document.getElementById('budCelularPaciente').value = pat.celular || pat.telefone || '';
                document.getElementById('budEmailPaciente').value = pat.email || '';
            }
        } else {
            document.getElementById('budCpfPaciente').value = '';
            document.getElementById('budCelularPaciente').value = '';
            document.getElementById('budEmailPaciente').value = '';
        }
        validateBudgetMasterForm();
    });
}

function validateBudgetItemForm() {
    const fields = ['budItemServicoId', 'budItemValor', 'budItemQtde', 'budItemExecutorId', 'budItemSubdivisao'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) el.classList.remove('input-error');
    });
}

function populateBudgetServiceDropdown() {
    const servSelect = document.getElementById('budItemServicoId');
    if (!servSelect) return;
    servSelect.innerHTML = '<option value="">Selecione um Serviço...</option>';

    // Filter by ie flag, but show ALL services if no filtered items exist
    const filtered = services.filter(s => {
        return s.ie === 'S' || s.ie === 's' || s.ie === true || s.ie === "Sim";
    });
    const toShow = filtered.length > 0 ? filtered : services;

    toShow.forEach(s => {
        servSelect.innerHTML += `<option value="${s.id}">${s.seqid || ''} - ${s.descricao}</option>`;
    });
}

function populateBudgetProfDropdown() {
    // 1. Protéticos (Dropdown de repasse por item)
    const profSelect = document.getElementById('budItemProfissionalId');
    if (profSelect) {
        profSelect.innerHTML = '<option value="">Selecione...</option>';
        professionals
            .filter(p => (p.tipo || '').toLowerCase() === 'protetico')
            .forEach(p => {
                profSelect.innerHTML += `<option value="${p.seqid || p.id}">${p.seqid || ''} - ${p.nome}</option>`;
            });
    }

    // 2. Profissional Executor (Dropdown por item)
    const executorSelect = document.getElementById('budItemExecutorId');
    if (executorSelect) {
        executorSelect.innerHTML = '<option value="">Selecione...</option>';
        professionals
            .filter(p => (p.tipo || '').toLowerCase() !== 'protetico')
            .forEach(p => {
                executorSelect.innerHTML += `<option value="${p.seqid || p.id}">${p.seqid || ''} - ${p.nome} (${p.tipo || ''})</option>`;
            });
    }
}

function populateBudgetItemSubdivisaoDropdown() {
    const subSelect = document.getElementById('budItemSubdivisao');
    if (!subSelect) return;
    subSelect.innerHTML = '<option value="">Selecione...</option>';

    specialties.forEach(spec => {
        if (spec.subdivisoes && spec.subdivisoes.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `${spec.seqid} - ${spec.nome}`;

            spec.subdivisoes.forEach((sub) => {
                const opt = document.createElement('option');
                opt.value = sub.nome; // Use only the name for matching with Serviços table
                opt.textContent = sub.nome;
                optgroup.appendChild(opt);
            });
            subSelect.appendChild(optgroup);
        }
    });
}


// Toggle Add Item Panel
if (btnToggleAddItem) {
    btnToggleAddItem.addEventListener('click', () => {
        try {
            editingBudgetItemId = null;
            document.querySelector('#addBudgetItemPanel h4').innerText = 'Novo Serviço';
            document.getElementById('btnSaveAddItem').innerHTML = '<i class="ri-check-line"></i> Confirmar Item';
            addBudgetItemPanel.style.display = 'block';

            populateBudgetServiceDropdown();
            populateBudgetProfDropdown();

            // Reset fields
            if (document.getElementById('budItemServicoId')) document.getElementById('budItemServicoId').value = '';
            document.getElementById('budItemDescricao').value = '';

            const subSelect = document.getElementById('budItemSubdivisao');
            if (subSelect) {
                populateBudgetItemSubdivisaoDropdown();
                subSelect.value = '';
            }

            document.getElementById('budItemValor').value = '';
            document.getElementById('budItemQtde').value = '1';
            if (document.getElementById('budItemProfissionalId')) document.getElementById('budItemProfissionalId').value = '';
            document.getElementById('budItemValorProtetico').value = '';

            // Pre-fill Executor with Header Professional
            const headerProfId = document.getElementById('budProfissionalId')?.value || '';
            const executorSelect = document.getElementById('budItemExecutorId');
            if (executorSelect) {
                executorSelect.value = headerProfId;
            }

            validateBudgetItemForm();
        } catch (err) {
            alert("Erro ao abrir painel: " + err.message);
            console.error(err);
        }
    });
}

if (btnCancelAddItem) {
    btnCancelAddItem.addEventListener('click', () => {
        addBudgetItemPanel.style.display = 'none';
        editingBudgetItemId = null;
    });
}

// Función para atualizar campos do serviço selecionado
function updateBudgetItemFromService(serviceId) {
    function ensureBudgetSubOption(selectEl, rawValue) {
        if (!selectEl) return;
        const v = String(rawValue || '').trim();
        if (!v) return;
        const options = Array.from(selectEl.querySelectorAll('option'));
        const exact = options.find(o => String(o.value || '').trim().toLowerCase() === v.toLowerCase());
        if (exact) return;
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        const firstOpt = selectEl.querySelector('option');
        if (firstOpt && firstOpt.parentNode) {
            firstOpt.parentNode.insertBefore(opt, firstOpt.nextSibling);
        } else {
            selectEl.appendChild(opt);
        }
    }

    if (!serviceId) {
        // Se deselecionar, limpa os campos
        document.getElementById('budItemDescricao').value = '';
        const subSelect = document.getElementById('budItemSubdivisao');
        if (subSelect) {
            subSelect.value = '';
            subSelect.disabled = false;
        }
        document.getElementById('budItemValor').value = '';
        return false;
    }
    const serv = services.find(s => s.id === serviceId);
    if (serv) {
        document.getElementById('budItemDescricao').value = serv.descricao;

        const subSelect = document.getElementById('budItemSubdivisao');
        if (subSelect) {
            const subVal = String(serv.subdivisao || '').trim();
            if (subVal) {
                ensureBudgetSubOption(subSelect, subVal);
                subSelect.value = subVal;
                subSelect.disabled = true;
            } else {
                subSelect.value = '';
                subSelect.disabled = false;
            }
        }

        const valorEl = document.getElementById('budItemValor');
        valorEl.value = serv.valor || 0;

        // Feedback visual
        valorEl.style.backgroundColor = '#ecfdf5';
        setTimeout(() => {
            const el = document.getElementById('budItemValor');
            if (el) el.style.backgroundColor = '';
        }, 800);

        if (typeof validateBudgetItemForm === 'function') validateBudgetItemForm();
        return true;
    }
    return false;
}

// Auto-fill Service Data in Add Item Panel (Delegated)
// The 'change' event fires when a new value is selected OR when the same value is re-selected
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'budItemServicoId') {
        updateBudgetItemFromService(e.target.value);
    }
});



const budItemValor = document.getElementById('budItemValor');
if (budItemValor) budItemValor.addEventListener('input', validateBudgetItemForm);

const budItemQtde = document.getElementById('budItemQtde');
if (budItemQtde) budItemQtde.addEventListener('input', validateBudgetItemForm);

const budItemProfissionalId = document.getElementById('budItemProfissionalId');
if (budItemProfissionalId) budItemProfissionalId.addEventListener('change', validateBudgetItemForm);

const budItemSubdivisao = document.getElementById('budItemSubdivisao');
if (budItemSubdivisao) budItemSubdivisao.addEventListener('change', validateBudgetItemForm);

const budItemExecutorId = document.getElementById('budItemExecutorId');
if (budItemExecutorId) budItemExecutorId.addEventListener('change', validateBudgetItemForm);

// Save Sub-Item
if (btnSaveAddItem) {
    btnSaveAddItem.addEventListener('click', () => {
        try {
            const servEl = document.getElementById('budItemServicoId');
            const valorEl = document.getElementById('budItemValor');
            const qtdeEl = document.getElementById('budItemQtde');
            const profEl = document.getElementById('budItemProfissionalId');

            const servId = servEl.value;
            const valorUnit = parseFloat(valorEl.value);
            const qtde = parseInt(qtdeEl.value) || 1;
            const profId = profEl.value; // Protético
            const executorId = document.getElementById('budItemExecutorId')?.value || null;

            // Clear previous highlights
            [servEl, valorEl, qtdeEl, profEl].forEach(el => el.classList.remove('input-error'));

            // Validate each field individually with specific feedback
            let hasError = false;
            if (!servId) {
                servEl.classList.add('input-error');
                hasError = true;
            }
            if (!valorUnit || isNaN(valorUnit) || valorUnit < 0) {
                valorEl.classList.add('input-error');
                hasError = true;
            }
            if (!qtde || qtde <= 0) {
                qtdeEl.classList.add('input-error');
                hasError = true;
            }
            if (!executorId) {
                document.getElementById('budItemExecutorId')?.classList.add('input-error');
                hasError = true;
            }


            if (hasError) {
                showToast('Preencha todos os campos obrigat\u00f3rios do item (destacados em vermelho).', true);
                return;
            }

            const servData = services.find(s => s.id === servId);
            const profData = professionals.find(p => p.seqid == profId || p.id === profId); // Protético
            const executorData = professionals.find(p => p.seqid == executorId || p.id === executorId);

            // Use form field values as fallbacks in case servData lookup fails (e.g. type mismatch with DB IDs)
            const servicoDescricao = servData ? servData.descricao : (document.getElementById('budItemDescricao').value || servId);
            const subdivisao = document.getElementById('budItemSubdivisao').value || (servData ? servData.subdivisao : '') || '-';

            if (editingBudgetItemId) {
                const idx = currentBudgetItems.findIndex(i => i.id === editingBudgetItemId);
                if (idx !== -1) {
                    currentBudgetItems[idx] = {
                        ...currentBudgetItems[idx],
                        servicoId: servId,
                        servicoDescricao: servicoDescricao,
                        subdivisao: subdivisao,
                        valor: valorUnit,
                        qtde: qtde,
                        proteticoId: profId,
                        proteticoNome: profData ? profData.nome : '',
                        valorProtetico: parseFloat(document.getElementById('budItemValorProtetico').value) || 0,
                        profissionalId: executorId,
                        executorNome: executorData ? executorData.nome : '',
                        status: currentBudgetItems[idx].status || 'Pendente'
                    };
                }
            } else {
                const newItem = {
                    id: generateId(),
                    servicoId: servId,
                    servicoDescricao: servicoDescricao,
                    subdivisao: subdivisao,
                    valor: valorUnit,
                    qtde: qtde,
                    proteticoId: profId,
                    proteticoNome: profData ? profData.nome : '',
                    valorProtetico: parseFloat(document.getElementById('budItemValorProtetico').value) || 0,
                    profissionalId: executorId,
                    executorNome: executorData ? executorData.nome : '',
                    status: 'Pendente'
                };
                currentBudgetItems.push(newItem);
            }

            // Sync state and UI
            addBudgetItemPanel.style.display = 'none';
            editingBudgetItemId = null;
            renderBudgetItemsTable();
            if (typeof validateBudgetMasterForm === 'function') validateBudgetMasterForm();
        } catch (err) {
            alert('Erro ao salvar item: ' + err.message);
            console.error('[btnSaveAddItem] erro:', err);
        }
    });
}

function renderBudgetItemsTable() {
    const tbody = document.getElementById('budgetItemsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;

    const budgetItemsTable = document.getElementById('budgetItemsTable');
    if (currentBudgetItems.length === 0) {
        budgetItemsEmptyState.style.display = 'block';
        if (budgetItemsTable) budgetItemsTable.style.display = 'none';
    } else {
        budgetItemsEmptyState.style.display = 'none';
        if (budgetItemsTable) budgetItemsTable.style.display = 'table';
        // Garantir visibilidade caso tenha sido escondido antes
        if (budgetItemsTable) budgetItemsTable.classList.remove('hidden');
    }

    currentBudgetItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--border-color)";

        const subtotal = (parseFloat(item.valor) || 0) * (parseInt(item.qtde) || 1);
        total += subtotal;

        // Status badge logic
        const statusColors = {
            'Pendente': '#6b7280',
            'Liberado': '#16a34a',
            'Em Execução': '#0066cc',
            'Finalizado': '#10b981',
            'Aguardando Pagamento': '#f59e0b'
        };
        const stColor = statusColors[item.status] || '#6b7280';

        tr.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${item.servicoDescricao}</strong></td>
                <td>${item.subdivisao}</td>
                <td>${item.qtde}</td>
                <td>R$ ${(parseFloat(item.valor) || 0).toFixed(2)}</td>
                <td><strong>R$ ${subtotal.toFixed(2)}</strong></td>
                <td>${item.executorNome || '-'}</td>
                <td>${item.proteticoNome || ''}</td>
                <td><span style="font-size:10px; background:${stColor}22; color:${stColor}; padding:2px 8px; border-radius:10px; font-weight:600; border:1px solid ${stColor}44;">${item.status || 'Pendente'}</span></td>
                <td class="actions-cell">
                    <button type="button" class="btn-icon edit-btn" data-id="${item.id}" title="Editar Item" style="background:#0066cc11; color:#0066cc; border:none; padding:5px; border-radius:4px;">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button type="button" class="btn-icon protese-btn" data-id="${item.id}" title="Ordem Protética (OP)" style="background:#10b98111; color:#10b981; border:none; padding:5px; border-radius:4px;">
                        <i class="ri-settings-3-line"></i>
                    </button>
                    <button type="button" class="btn-icon delete-btn" data-id="${item.id}" title="Remover Item" style="background:#ef444411; color:#ef4444; border:none; padding:5px; border-radius:4px;">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            `;
        tbody.appendChild(tr);
    });

    // Delegated click for removal
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = null;
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            removeBudgetItem(id);
        });
    });

    // Click for editing
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = null;
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            editBudgetItem(id);
        });
    });

    tbody.querySelectorAll('.protese-btn').forEach(btn => {
        btn.onclick = null;
        btn.addEventListener('click', async (e) => {
            const itemId = e.currentTarget.getAttribute('data-id');
            await openProteseForBudgetItem(itemId);
        });
    });

    const totalEl = document.getElementById('budTotalValue');
    if (totalEl) totalEl.innerText = `R$ ${total.toFixed(2)} `;
}

window.removeBudgetItem = function (itemId) {
    if (confirm('Deseja remover este item do orçamento?')) {
        currentBudgetItems = currentBudgetItems.filter(i => i.id !== itemId);

        // Se o item deletado for o que está sendo editado, fecha o painel e reseta o ID
        if (editingBudgetItemId === itemId) {
            if (addBudgetItemPanel) addBudgetItemPanel.style.display = 'none';
            editingBudgetItemId = null;
        }

        renderBudgetItemsTable();
        // Garantir que a validação do formulário master reflita a mudança (ex: botão Salvar)
        if (typeof validateBudgetMasterForm === 'function') validateBudgetMasterForm();
    }
};

window.editBudgetItem = function (itemId) {
    const item = currentBudgetItems.find(i => i.id === itemId);
    if (!item) return;

    editingBudgetItemId = itemId;
    document.querySelector('#addBudgetItemPanel h4').innerText = 'Editar Serviço';
    document.getElementById('btnSaveAddItem').innerHTML = '<i class="ri-check-line"></i> Atualizar Item';
    addBudgetItemPanel.style.display = 'block';

    populateBudgetServiceDropdown();
    populateBudgetProfDropdown();
    populateBudgetItemSubdivisaoDropdown();

    const servId = item.servicoId || '';
    document.getElementById('budItemServicoId').value = servId;
    updateBudgetItemFromService(servId);

    document.getElementById('budItemDescricao').value = item.servicoDescricao || document.getElementById('budItemDescricao').value || '';
    const subEl = document.getElementById('budItemSubdivisao');
    if (subEl) {
        const v = String(item.subdivisao || '').trim();
        if (v) {
            const options = Array.from(subEl.querySelectorAll('option'));
            const exact = options.find(o => String(o.value || '').trim().toLowerCase() === v.toLowerCase());
            if (!exact) {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                const firstOpt = subEl.querySelector('option');
                if (firstOpt && firstOpt.parentNode) {
                    firstOpt.parentNode.insertBefore(opt, firstOpt.nextSibling);
                } else {
                    subEl.appendChild(opt);
                }
            }
            subEl.value = v;
        }
    }
    document.getElementById('budItemValor').value = item.valor !== undefined ? item.valor : document.getElementById('budItemValor').value || '';
    document.getElementById('budItemQtde').value = item.qtde || 1;
    document.getElementById('budItemExecutorId').value = item.profissionalId || '';
    document.getElementById('budItemProfissionalId').value = item.proteticoId || '';
    document.getElementById('budItemValorProtetico').value = item.valorProtetico !== undefined ? item.valorProtetico : '';

    validateBudgetItemForm();
};

// Form Save Budget (Master)
if (budgetForm) {
    budgetForm.addEventListener('submit', async e => {
        e.preventDefault();
        console.log("[Flow] Formulário de orçamento submetido.");

        const id = document.getElementById('editBudgetId').value;
        const statusElement = document.getElementById('budStatus');
        const newStatus = statusElement ? statusElement.value : '';

        // --- TRAVA DE SEGURANÇA: Orçamento Cancelado é IMUTÁVEL ---
        if (id) {
            const originalBudget = budgets.find(b => b.id === id);
            if (originalBudget && originalBudget.status === 'Cancelado') {
                showToast("Este orçamento está CANCELADO e não pode ser editado. Para novos serviços, crie um novo orçamento.", true);
                showList('budgets');
                return;
            }
        }

        console.log("[Flow] ID capturado:", id);
        console.log("[Flow] Status capturado:", newStatus);

        // ROTEAMENTO DA AÇÃO: Cancelar ou Salvar?
        if (newStatus === 'Cancelado') {
            console.log("[Flow] Status 'Cancelado' detectado. Iniciando fluxo de cancelamento.");
            // Se o orçamento ainda não existe (é novo), não há o que cancelar.
            if (!id) {
                showToast("Não é possível cancelar um orçamento que ainda não foi salvo.", true);
                return;
            }
            // Chama a função de cancelamento com todas as suas validações
            deleteBudget(id);
            return; // Interrompe o fluxo de salvamento
        }

        console.log("[Flow] Status diferente de 'Cancelado'. Prosseguindo com o salvamento normal.");

        const patId = document.getElementById('budPacienteId').value;

        if (document.getElementById('addBudgetItemPanel').style.display === 'block') {
            showToast('Você tem um item em edição. Clique em "Confirmar Item" antes de salvar o orçamento.', true);
            return;
        }

        if (currentBudgetItems.length === 0) {
            showToast('Adicione e confirme pelo menos um item ao orçamento antes de salvar.', true);
            return;
        }

        const pat = patients.find(p => p.id == patId || p.seqid == patId);

        if (!pat) {
            showToast('Erro crítico: Paciente selecionado não foi encontrado na base de dados local. Recarregue a página.', true);
            console.error("Falha ao encontrar paciente com ID/SeqID:", patId, "em", patients);
            return;
        }

        // Get professional seqid for the header
        const profIdVal = document.getElementById('budProfissionalId')?.value;
        const profObj = professionals.find(p => p.id == profIdVal || p.seqid == profIdVal);
        const profSeqId = profObj ? parseInt(profObj.seqid) : null;

        const budgetData = {
            pacienteid: pat.id,
            pacientenome: pat.nome,
            pacientecelular: pat.celular || pat.telefone,
            pacienteemail: pat.email,
            status: document.getElementById('budStatus').value,
            tipo: document.getElementById('budTipo')?.value || 'Normal',
            observacoes: document.getElementById('budObservacoes')?.value || '',
            empresa_id: currentEmpresaId,
            profissional_id: profSeqId
        };

        try {
            function isFreeBudgetTipo(tipo) {
                const k = normalizeKey(tipo);
                return k === 'CORTESIA' || k === 'RETRABALHO';
            }

            function isChargeableBudgetTipo(tipo) {
                const k = normalizeKey(tipo);
                return k === 'NORMAL' || k === 'URGENCIA';
            }

            async function requireSupervisorApproval(message) {
                if (currentUserRole === 'admin' || currentUserRole === 'supervisor') return true;
                const modalAuth = document.getElementById('supervisorAuthModal');
                const pinInput = document.getElementById('supervisorPinInput');
                const btnConfirm = document.getElementById('btnConfirmSupervisorAuth');
                if (!modalAuth || !pinInput || !btnConfirm) return false;

                const modalMsg = modalAuth.querySelector('p');
                if (modalMsg) modalMsg.innerText = message;
                modalAuth.classList.remove('hidden');
                pinInput.value = '';
                pinInput.focus();

                return await new Promise(resolve => {
                    btnConfirm.onclick = async () => {
                        try {
                            const enteredPin = String(pinInput.value || '');
                            const { data: emp } = await db.from('empresas').select('supervisor_pin').eq('id', currentEmpresaId).single();
                            if (enteredPin && enteredPin === emp?.supervisor_pin) {
                                modalAuth.classList.add('hidden');
                                resolve(true);
                            } else {
                                showToast("Senha de supervisor incorreta!", true);
                                resolve(false);
                            }
                        } catch {
                            showToast("Erro ao validar permissão.", true);
                            resolve(false);
                        }
                    };
                });
            }

            async function convertBudgetTypeIfNeeded({ budgetId, oldBudgetRow, newTipo }) {
                if (!oldBudgetRow) return;
                const oldTipo = String(oldBudgetRow.tipo || 'Normal');
                const oldIsCharge = isChargeableBudgetTipo(oldTipo);
                const newIsFree = isFreeBudgetTipo(newTipo);
                if (!(oldIsCharge && newIsFree)) return;

                const budgetSeq = Number(oldBudgetRow.seqid);
                if (!Number.isFinite(budgetSeq) || budgetSeq <= 0) return;

                const itemIds = await (async () => {
                    try {
                        const q = await withTimeout(
                            db.from('orcamento_itens').select('id').eq('orcamento_id', budgetId),
                            15000,
                            'orcamento_itens:ids_for_tipo_change'
                        );
                        return (q.data || []).map(r => String(r.id));
                    } catch {
                        return [];
                    }
                })();

                let pagamentosCount = 0;
                let comissoesPagasCount = 0;
                let consumoDebitosTotal = 0;
                let pagamentoCreditosTotal = 0;

                try {
                    const payQ = withTimeout(
                        db.from('orcamento_pagamentos')
                            .select('id', { count: 'exact', head: true })
                            .eq('empresa_id', currentEmpresaId)
                            .eq('orcamento_id', budgetSeq)
                            .neq('status_pagamento', 'Cancelado'),
                        15000,
                        'orcamento_pagamentos:count_for_tipo_change'
                    );
                    const [payRes] = await Promise.all([payQ]);
                    pagamentosCount = Number(payRes?.count || 0);
                } catch {
                }

                if (itemIds.length) {
                    try {
                        const q = await withTimeout(
                            db.from('financeiro_comissoes')
                                .select('id, status')
                                .eq('empresa_id', currentEmpresaId)
                                .in('item_id', itemIds),
                            15000,
                            'financeiro_comissoes:for_tipo_change'
                        );
                        const rows = q.data || [];
                        comissoesPagasCount = rows.filter(r => String(r.status || '') === 'PAGA').length;
                    } catch {
                    }
                }

                const pacIdRaw = oldBudgetRow.pacienteid || oldBudgetRow.paciente_id;
                const patientObj = patients.find(p => p.id === pacIdRaw || p.seqid == pacIdRaw);
                const pacNumId = patientObj ? Number(patientObj.seqid) : null;

                try {
                    const q = await withTimeout(
                        db.from('financeiro_transacoes')
                            .select('valor, tipo, categoria, observacoes')
                            .eq('empresa_id', currentEmpresaId)
                            .eq('referencia_id', budgetSeq)
                            .in('categoria', ['PAGAMENTO', 'CONSUMO']),
                        15000,
                        'financeiro_transacoes:for_tipo_change'
                    );
                    const rows = q.data || [];
                    pagamentoCreditosTotal = rows
                        .filter(r => String(r.tipo || '') === 'CREDITO' && String(r.categoria || '') === 'PAGAMENTO')
                        .reduce((acc, r) => acc + Number(r.valor || 0), 0);
                    consumoDebitosTotal = rows
                        .filter(r => String(r.tipo || '') === 'DEBITO' && (String(r.categoria || '') === 'CONSUMO' || (String(r.categoria || '') === 'PAGAMENTO' && String(r.observacoes || '').includes('[Consumo]'))))
                        .reduce((acc, r) => acc + Number(r.valor || 0), 0);
                } catch {
                }

                const needsApproval = pagamentosCount > 0 || comissoesPagasCount > 0 || pagamentoCreditosTotal > 0;
                if (needsApproval) {
                    const ok = await requireSupervisorApproval(`Mudança de tipo: ${oldTipo} → ${newTipo}. Existe histórico financeiro/comissões. Confirmar estornos?`);
                    if (!ok) throw new Error('Mudança de tipo cancelada');
                }

                try {
                    await withTimeout(
                        db.from('orcamento_pagamentos')
                            .update({ status_pagamento: 'Cancelado' })
                            .eq('empresa_id', currentEmpresaId)
                            .eq('orcamento_id', budgetSeq)
                            .neq('status_pagamento', 'Cancelado'),
                        15000,
                        'orcamento_pagamentos:cancel_for_tipo_change'
                    );
                } catch {
                }

                if (itemIds.length) {
                    const nowIso = new Date().toISOString();
                    const updFull = { status: 'ESTORNADA', estornado_em: nowIso, estornado_por: currentUser?.id || null, observacoes: `Conversão de tipo ${oldTipo} → ${newTipo}` };
                    try {
                        const q = db.from('financeiro_comissoes')
                            .update(updFull)
                            .eq('empresa_id', currentEmpresaId)
                            .in('item_id', itemIds)
                            .neq('status', 'ESTORNADA');
                        const r = await withTimeout(q, 15000, 'financeiro_comissoes:estornar_full_tipo_change');
                        if (r.error) throw r.error;
                    } catch {
                        try {
                            await withTimeout(
                                db.from('financeiro_comissoes')
                                    .update({ status: 'ESTORNADA' })
                                    .eq('empresa_id', currentEmpresaId)
                                    .in('item_id', itemIds)
                                    .neq('status', 'ESTORNADA'),
                                15000,
                                'financeiro_comissoes:estornar_fallback_tipo_change'
                            );
                        } catch {
                        }
                    }
                }

                if (pacNumId && Number.isFinite(pacNumId)) {
                    try {
                        const already = await withTimeout(
                            db.from('financeiro_transacoes')
                                .select('id', { count: 'exact', head: true })
                                .eq('empresa_id', currentEmpresaId)
                                .eq('referencia_id', budgetSeq)
                                .eq('categoria', 'ESTORNO')
                                .ilike('observacoes', '%[Conversão de Tipo]%'),
                            15000,
                            'financeiro_transacoes:estorno_exists_tipo_change'
                        );
                        const hasAny = Number(already?.count || 0) > 0;
                        if (!hasAny) {
                            if (pagamentoCreditosTotal > 0.005) {
                                await withTimeout(
                                    db.from('financeiro_transacoes').insert({
                                        paciente_id: pacNumId,
                                        tipo: 'DEBITO',
                                        categoria: 'ESTORNO',
                                        valor: Number(pagamentoCreditosTotal.toFixed(2)),
                                        forma_pagamento: null,
                                        referencia_id: budgetSeq,
                                        observacoes: `[Conversão de Tipo] Estorno Pagamento (Orçamento #${budgetSeq}) ${oldTipo} → ${newTipo}`,
                                        empresa_id: currentEmpresaId,
                                        criado_por: currentUser?.id || null
                                    }),
                                    15000,
                                    'financeiro_transacoes:estorno_pagamento_tipo_change'
                                );
                            }
                            if (consumoDebitosTotal > 0.005) {
                                await withTimeout(
                                    db.from('financeiro_transacoes').insert({
                                        paciente_id: pacNumId,
                                        tipo: 'CREDITO',
                                        categoria: 'ESTORNO',
                                        valor: Number(consumoDebitosTotal.toFixed(2)),
                                        forma_pagamento: null,
                                        referencia_id: budgetSeq,
                                        observacoes: `[Conversão de Tipo] Estorno Consumo (Orçamento #${budgetSeq}) ${oldTipo} → ${newTipo}`,
                                        empresa_id: currentEmpresaId,
                                        criado_por: currentUser?.id || null
                                    }),
                                    15000,
                                    'financeiro_transacoes:estorno_consumo_tipo_change'
                                );
                            }
                        }
                    } catch {
                    }
                }
            }

            let orcamentoId = id;

            // Prepare items properly formatted for PostgreSQL DB
            const itemsPayload = currentBudgetItems.map(item => {
                // Resolve professional and prothetic to seqid (BIGINT)
                const executorObj = professionals.find(p => p.id == item.profissionalId || p.seqid == item.profissionalId);
                const proteticoObj = professionals.find(p => p.id == item.proteticoId || p.seqid == item.proteticoId);

                return {
                    id: item.id || generateId(),
                    orcamento_id: id || generateId(), // Placeholder if new, will be updated below
                    empresa_id: currentEmpresaId,
                    servico_id: item.servicoId,
                    valor: item.valor,
                    qtde: item.qtde,
                    protetico_id: proteticoObj ? parseInt(proteticoObj.seqid) : null,
                    valor_protetico: item.valorProtetico || 0,
                    profissional_id: executorObj ? parseInt(executorObj.seqid) : null,
                    subdivisao: item.subdivisao || '',
                    status: item.status || 'Pendente'
                };
            });

            if (id) {
                const oldBudget = budgets.find(b => b.id === id);
                await convertBudgetTypeIfNeeded({ budgetId: id, oldBudgetRow: oldBudget, newTipo: budgetData.tipo });

                const { error } = await db.from('orcamentos').update(budgetData).eq('id', id);
                if (error) throw error;

                // Ensure orcamento_id is correct in itemsPayload for update
                itemsPayload.forEach(it => it.orcamento_id = id);

                // SMART SAVE for items:
                // 1. Get current item IDs in DB for this budget
                const { data: dbItems } = await db.from('orcamento_itens').select('id').eq('orcamento_id', id);
                const dbItemIds = dbItems ? dbItems.map(it => it.id) : [];
                const currentItemIds = itemsPayload.map(it => it.id);
                
                // 2. Identify removed items
                const removedItemIds = dbItemIds.filter(did => !currentItemIds.includes(did));
                
                // 3. Upsert current items (updates existing, inserts new)
                const { error: upsertError } = await db.from('orcamento_itens').upsert(itemsPayload);
                if (upsertError) throw upsertError;
                
                // 4. Delete only removed items
                if (removedItemIds.length > 0) {
                    const { error: delError } = await db.from('orcamento_itens').delete().in('id', removedItemIds);
                    if (delError) throw delError;
                }

                const index = budgets.findIndex(b => b.id === id);
                if (index !== -1) budgets[index] = { ...budgets[index], ...budgetData };

                try {
                    const { data: refreshedItems, error: refErr } = await withTimeout(
                        db.from('orcamento_itens')
                            .select('*')
                            .eq('empresa_id', currentEmpresaId)
                            .eq('orcamento_id', id)
                            .order('created_at', { ascending: true }),
                        15000,
                        'orcamento_itens:refresh_after_save'
                    );
                    if (refErr) throw refErr;
                    if (index !== -1) budgets[index].orcamento_itens = refreshedItems || [];
                } catch (e2) {
                }
                showToast('Orçamento atualizado com sucesso!');
            } else {
                const newId = generateId();
                budgetData.id = newId;
                budgetData.seqid = getNextSeqId(budgets);

                const { data: inserted, error } = await db.from('orcamentos').insert(budgetData).select().single();
                if (error) throw error;

                orcamentoId = inserted.id;
                budgets.push(inserted);
                
                // Update orcamento_id in itemsPayload for new budget
                itemsPayload.forEach(it => it.orcamento_id = orcamentoId);

                // Insert new items if there are any
                if (itemsPayload.length > 0) {
                    const { data: insertedItems, error: addError } = await db.from('orcamento_itens').insert(itemsPayload).select();
                    if (addError) throw addError;

                    // Sync the inserted relational items back to the cache
                    const index = budgets.findIndex(b => b.id === orcamentoId);
                    if (index !== -1 && insertedItems) {
                        budgets[index].orcamento_itens = insertedItems;
                    }
                }
                showToast('Orçamento cadastrado com sucesso!');
            }

            showList('budgets');
            const searchInput = document.getElementById('searchBudgetInput');
            if (searchInput) {
                searchInput.focus();
            }
        } catch (error) {
            console.error("DEBUG - Erro completo ao salvar orçamento:", error);
            const errorMsg = error.message || "Erro desconhecido";
            const errorDetails = error.details || "";
            const errorCode = error.code || "";
            const errorHint = error.hint || "";
            showToast(`Erro ao salvar orçamento (${errorCode}): ${errorMsg}. ${errorHint} ${errorDetails}`, true);
        }
    });
}

window.editBudget = function (id) {
    const b = budgets.find(bud => bud.id === id);
    if (!b) return;

    if (b.status === 'Cancelado') {
        showToast("Este orçamento está CANCELADO e não pode ser editado.", true);
        return;
    }

    showForm(true, 'budgets');
    document.getElementById('budIdDisplay').value = b.seqid || '';
    document.getElementById('editBudgetId').value = b.id;

    // Set Patient Autocomplete
    const pat = patients.find(p => p.id === b.pacienteid);
    if (pat) {
        document.getElementById('budPacienteNome').value = `${pat.nome} (${pat.cpf})`;
        document.getElementById('budPacienteId').value = pat.id; // Set the hidden ID
        document.getElementById('budCpfPaciente').value = pat.cpf || '';
    }
    document.getElementById('budCelularPaciente').value = b.pacientecelular || '';
    document.getElementById('budEmailPaciente').value = b.pacienteemail || '';

    // Conditionally populate and set the status dropdown (robust logic)
    const statusSelect = document.getElementById('budStatus');
    if (statusSelect) {
        const currentStatus = (b.status || 'Pendente').trim();
        const normStatus = currentStatus.toLowerCase();
        
        statusSelect.innerHTML = ''; // Clear existing options
        
        if (normStatus === 'aprovado') {
            // Se já está aprovado, as únicas ações lógicas são manter aprovado, voltar para pendente ou cancelar
            statusSelect.innerHTML = `
                <option value="Aprovado">Aprovado</option>
                <option value="Pendente">Pendente</option>
                <option value="Cancelado">Cancelado</option>
            `;
        } else {
            // Lista completa para outros status
            statusSelect.innerHTML = `
                <option value="Pendente">Pendente</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Executado">Executado</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Cancelado">Cancelado</option>
            `;
        }
        
        // Match value correctly regardless of original casing
        statusSelect.value = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).toLowerCase();
        if (!statusSelect.value && statusSelect.options.length > 0) {
            statusSelect.selectedIndex = 0;
        }
    }

    if (document.getElementById('budTipo')) {
        document.getElementById('budTipo').value = b.tipo || 'Normal';
    }
    if (document.getElementById('budObservacoes')) {
        document.getElementById('budObservacoes').value = b.observacoes || '';
    }

    // Set Responsible Professional
    if (document.getElementById('budProfissionalId')) {
        document.getElementById('budProfissionalId').value = b.profissional_id || '';
    }

    // Load Items List mapped from db row orcamento_itens back to state
    currentBudgetItems = (b.orcamento_itens || []).map(item => {
        const servData = services.find(s => s.id == item.servico_id);
        const proteticoData = professionals.find(p => p.id == item.protetico_id || p.seqid == item.protetico_id);
        const executorData = professionals.find(p => p.id == item.profissional_id || p.seqid == item.profissional_id);

        return {
            id: item.id,
            servicoId: item.servico_id,
            servicoDescricao: servData ? servData.descricao : 'Serviço Excluído/Desconhecido',
            subdivisao: item.subdivisao || (servData ? servData.subdivisao : '-'),
            valor: item.valor,
            qtde: item.qtde,
            proteticoId: item.protetico_id,
            proteticoNome: proteticoData ? proteticoData.nome : '',
            valorProtetico: item.valor_protetico,
            profissionalId: item.profissional_id,
            executorNome: executorData ? executorData.nome : '',
            status: item.status || 'Pendente'
        };
    });

    renderBudgetItemsTable();

    // Enable the "Adicionar Item" button since we have a patient selected
    if (typeof validateBudgetMasterForm === 'function') validateBudgetMasterForm();
};

window.deleteBudget = async function (id) {
    console.log(`[Flow] Iniciando deleteBudget para o ID: ${id}`);
    if (!can('orcamentos', 'delete')) {
        showToast("Você não tem permissão para esta ação.", true);
        return;
    }

    const budget = budgets.find(b => b.id === id);
    if (!budget) return;

    // 1. Analisar riscos e determinar o CASO de cancelamento
    const analysis = await validateCancellation(budget);
    
    let confirmMsg = "Tem certeza que deseja CANCELAR este orçamento?";
    if (analysis.cancelCase > 1) {
        confirmMsg = `⚠️ ATENÇÃO - CANCELAMENTO ${analysis.cancelCase === 3 ? 'CRÍTICO' : 'FINANCEIRO'}:\n\n` +
                     analysis.risks.join('\n') + `\n\n` +
                     analysis.message + `\n\nDeseja prosseguir?`;
    }

    if (!confirm(confirmMsg)) return;

    const motivo = prompt("Por favor, informe o MOTIVO do cancelamento (Obrigatório):");
    if (!motivo || motivo.trim().length < 5) {
        showToast("O motivo é obrigatório para auditoria (mín. 5 caracteres).", true);
        return;
    }

    // 2. Tratar CASO 3 (Requer PIN do Supervisor)
    if (analysis.cancelCase === 3) {
        const modalAuth = document.getElementById('supervisorAuthModal');
        const pinInput = document.getElementById('supervisorPinInput');
        const btnConfirm = document.getElementById('btnConfirmSupervisorAuth');
        const modalMsg = modalAuth.querySelector('p');

        modalAuth.classList.remove('hidden');
        if (modalMsg) modalMsg.innerText = "Este orçamento possui comissões PAGAS. A autorização do supervisor é necessária para estornar valores do profissional e do paciente.";
        pinInput.value = '';
        pinInput.focus();

        btnConfirm.onclick = async () => {
            const enteredPin = pinInput.value;
            const { data: emp } = await db.from('empresas').select('supervisor_pin').eq('id', currentEmpresaId).single();

            if (enteredPin === emp?.supervisor_pin) {
                modalAuth.classList.add('hidden');
                processBudgetCancel(budget, motivo, analysis);
            } else {
                showToast("Senha de supervisor incorreta!", true);
            }
        };
    } else {
        // Casos 1 e 2 seguem direto
        processBudgetCancel(budget, motivo, analysis);
    }
};

// Print Budget Report

window.printDashboard = function () {
    try {
        const dateStr = dashDate && dashDate.value ? dashDate.value : '';
        const dateLabel = dateStr ? formatDateBR(dateStr) : '';
        const empresaLabel = currentEmpresaId ? getEmpresaName(currentEmpresaId) : '—';
        const profLabel = dashProfessional
            ? (dashProfessional.options[dashProfessional.selectedIndex]?.textContent || 'Todos')
            : 'Todos';

        const canFinance = can('financeiro', 'select');

        const kpis = [
            { title: 'Agendados do dia', value: (kpiAgendados && kpiAgendados.textContent) || '—', sub: (kpiAgendadosSub && kpiAgendadosSub.textContent) || '—' },
            { title: 'Recebido hoje', value: canFinance ? ((kpiRecebido && kpiRecebido.textContent) || '—') : '—', sub: (kpiRecebidoSub && kpiRecebidoSub.textContent) || '—' },
            { title: 'Orçamentos criados', value: (kpiOrcamentosHoje && kpiOrcamentosHoje.textContent) || '—', sub: (kpiOrcamentosHojeSub && kpiOrcamentosHojeSub.textContent) || '—' },
            { title: 'Pacientes cadastrados', value: (kpiPacientesHoje && kpiPacientesHoje.textContent) || '—', sub: (kpiPacientesHojeSub && kpiPacientesHojeSub.textContent) || '—' }
        ];

        const agendaRows = dashAgendaBody ? dashAgendaBody.innerHTML : '';
        const paymentsRows = dashPaymentsBody ? dashPaymentsBody.innerHTML : '';

        const hoje = new Date().toLocaleString('pt-BR');
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Dashboard • ${escapeHtml(empresaLabel)} • ${escapeHtml(dateLabel || '—')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; padding: 20px; }
    .header { display:flex; justify-content: space-between; gap: 16px; align-items:flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 14px; }
    .brand { font-size: 18px; font-weight: 800; color: #0066cc; line-height: 1.1; }
    .meta { text-align: right; color: #6b7280; font-size: 11px; line-height: 1.4; }
    .title { font-size: 14px; font-weight: 800; color: #111827; margin-top: 4px; }
    .pill { display:inline-block; padding: 2px 8px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 11px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0 14px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #fff; }
    .kpi-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 800; }
    .kpi-value { font-size: 16px; font-weight: 900; margin-top: 6px; }
    .kpi-sub { margin-top: 4px; font-size: 10px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #6b7280; border: 1px solid #e5e7eb; }
    td { padding: 7px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    .two { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #fff; }
    .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
    .mini { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
    .mini .kpi-value { font-size: 14px; }
    .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print {
      body { padding: 10px; }
      .grid { grid-template-columns: repeat(2, 1fr); }
      .two { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">OCC</div>
      <div class="title">Dashboard <span class="pill">${escapeHtml(dateLabel || '—')}</span></div>
      <div style="margin-top:4px; color:#6b7280; font-size:11px;">Unidade: ${escapeHtml(empresaLabel)} • Profissional (agenda): ${escapeHtml(profLabel)}</div>
    </div>
    <div class="meta">
      <div>Gerado em: ${escapeHtml(hoje)}</div>
      <div>Build: ${escapeHtml(String(APP_BUILD || ''))}</div>
    </div>
  </div>

  <div class="grid">
    ${kpis.map(k => `
      <div class="kpi">
        <div class="kpi-title">${escapeHtml(k.title)}</div>
        <div class="kpi-value">${escapeHtml(String(k.value || '—'))}</div>
        <div class="kpi-sub">${escapeHtml(String(k.sub || '—'))}</div>
      </div>
    `).join('')}
  </div>

  <div class="two">
    <div class="card">
      <div class="section-title">Agenda do dia</div>
      <table>
        <thead>
          <tr>
            <th style="width: 90px;">Hora</th>
            <th>Paciente</th>
            <th style="width: 160px;">Profissional</th>
            <th style="width: 140px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${agendaRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}
        </tbody>
      </table>
    </div>

    ${canFinance ? `
    <div class="card">
      <div class="section-title">Pagamentos do dia</div>
      <div style="color:#6b7280; font-size:11px; margin-bottom:8px;">${escapeHtml((dashFinanceSummary && dashFinanceSummary.textContent) || '')}</div>
      <table>
        <thead>
          <tr>
            <th>Forma</th>
            <th style="width: 160px; text-align:right;">Total</th>
            <th style="width: 110px; text-align:right;">Qtde</th>
          </tr>
        </thead>
        <tbody>
          ${paymentsRows || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}
        </tbody>
      </table>
      <div class="mini">
        <div class="kpi">
          <div class="kpi-title">Cancelamentos (dia)</div>
          <div class="kpi-value">${escapeHtml(String((kpiCancelamentosHoje && kpiCancelamentosHoje.textContent) || '—'))}</div>
        </div>
        <div class="kpi">
          <div class="kpi-title">Comissões a pagar</div>
          <div class="kpi-value">${escapeHtml(String((kpiComissoesAPagar && kpiComissoesAPagar.textContent) || '—'))}</div>
        </div>
        <div class="kpi">
          <div class="kpi-title">Ticket médio</div>
          <div class="kpi-value">${escapeHtml(String((kpiTicketMedio && kpiTicketMedio.textContent) || '—'))}</div>
        </div>
      </div>
    </div>
    ` : ''}
  </div>

  <div class="footer">
    Documento gerado automaticamente pelo OCC.
  </div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=950,height=750');
        if (!win) { showToast('Habilite pop-ups para imprimir o dashboard.', true); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
    } catch (e) {
        const msg = e && e.message ? e.message : String(e || 'erro');
        showToast(`Erro ao imprimir dashboard: ${msg}`, true);
    }
};

window.printBudget = function (id) {
    const b = budgets.find(x => x.id === id);
    if (!b) { showToast('Or\u00e7amento n\u00e3o encontrado.', true); return; }

    // Normalize items
    const items = b.orcamento_itens || b.itens || [];
    const total = items.reduce((acc, i) => acc + ((parseFloat(i.valor) || 0) * (parseInt(i.qtde) || 1)), 0);
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Get patient CPF for signature
    const patData = patients.find(p => p.id === b.pacienteid);
    const patCpf = patData ? (patData.cpf || '') : '';

    // Get unique professionals (Responsible + Item Protothetics)
    const profIds = new Set();
    if (b.profissional_id) profIds.add(b.profissional_id);
    items.forEach(i => { if (i.protetico_id) profIds.add(i.protetico_id); });

    const profNames = Array.from(profIds)
        .map(pid => professionals.find(p => p.seqid == pid || p.id === pid))
        .filter(Boolean)
        .map(p => p.nome)
        .join(', ');

    const rowsHtml = items.map((item, idx) => {
        // Look up names from arrays by ID
        const servData = services.find(s => s.id === item.servico_id);
        const profData = professionals.find(p => p.seqid == item.protetico_id || p.id === item.protetico_id);
        const executorData = professionals.find(p => p.seqid == item.profissional_id || p.id === item.profissional_id);
        const servicoNome = servData ? servData.descricao : (item.servicodescricao || item.descricao || '-');
        const profNome = profData ? profData.nome : (item.proteticonome || '-');
        const executorNome = executorData ? executorData.nome : (item.executorNome || '-');
        const subtotal = (parseFloat(item.valor || 0) * parseInt(item.qtde || 1));
        return `
            <tr>
            <td>${idx + 1}</td>
            <td>${servicoNome}</td>
            <td style="text-align:center">${item.qtde || 1}</td>
            <td style="text-align:right">R$ ${parseFloat(item.valor || 0).toFixed(2)}</td>
            <td style="text-align:right">R$ ${subtotal.toFixed(2)}</td>
            <td>${executorNome}</td>
            <td>${profNome}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
                <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                            <title>Or\u00e7amento #${b.seqid} - ${b.pacientenome}</title>
                            <style>
                                * {margin: 0; padding: 0; box-sizing: border-box; }
                                body {font - family: Arial, sans-serif; font-size: 13px; color: #1f2937; padding: 30px; }
                                .header {display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; }
                                .clinic-name {font - size: 22px; font-weight: bold; color: #0066cc; }
                                .doc-title {font - size: 16px; font-weight: bold; text-align: right; color: #374151; }
                                .doc-num {font - size: 13px; color: #6b7280; text-align: right; }
                                .section {margin - bottom: 20px; }
                                .section-title {font - size: 11px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                                .info-grid {display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
                                .info-item label {font - size: 11px; color: #6b7280; display: block; }
                                .info-item span {font - weight: 600; }
                                table {width: 100%; border-collapse: collapse; }
                                th {background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border: 1px solid #e5e7eb; }
                                td {padding: 8px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
                                tr:nth-child(even) td {background: #f9fafb; }
                                .total-row td {font - weight: bold; background: #eff6ff; color: #0066cc; font-size: 14px; }
                                .status-badge {display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #dbeafe; color: #1d4ed8; font-weight: bold; }
                                .signature-spacer {height: 90px; }
                                .signature-section {margin-top: 0; page-break-inside: avoid; }
                                .signature-block {display: flex; gap: 60px; margin-top: 30px; }
                                .sig-line {flex: 1; text-align: center; }
                                .sig-line .line {border - top: 1px solid #374151; margin-bottom: 6px; }
                                .sig-line small {font - size: 11px; color: #6b7280; }
                                .footer {margin - top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
                                @media print {body {padding: 15px; } }
                            </style>
                    </head>
                    <body>
                        <div class="header">
                            <div>
                                <div class="clinic-name" style="text-align:center; line-height:1.05;">
                                    <div>OCC</div>
                                    <div style="font-size:12px; font-weight:600; color:#6b7280; margin-top:2px;">Odonto Connect Cloud</div>
                                </div>
                                <div style="color:#6b7280; margin-top:4px;">Sistema de Gest\u00e3o de Cl\u00ednica</div>
                            </div>
                            <div>
                                <div class="doc-title">OR\u00c7AMENTO</div>
                                <div class="doc-num">#${b.seqid} &nbsp;|&nbsp; <span class="status-badge">${b.status || 'Pendente'}</span></div>
                                <div style="color:#6b7280; margin-top:4px; font-size:11px;">Emitido em: ${hoje}</div>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
                            <div class="section">
                                <div class="section-title">Dados do Paciente</div>
                                <div class="info-grid" style="grid-template-columns:1fr;">
                                    <div class="info-item"><label>Nome</label><span>${b.pacientenome || '-'}</span></div>
                                    <div class="info-item" style="margin-top:6px;"><label>Celular</label><span>${b.pacientecelular || '-'}</span></div>
                                    <div class="info-item" style="margin-top:6px;"><label>E-mail</label><span>${b.pacienteemail || '-'}</span></div>
                                </div>
                            </div>
                            <div class="section">
                                <div class="section-title">Respons\u00e1vel pelo Or\u00e7amento</div>
                                <div class="info-grid" style="grid-template-columns:1fr;">
                                    <div class="info-item"><label>Profissional(is)</label><span>${profNames || 'N\u00e3o informado'}</span></div>
                                    <div class="info-item" style="margin-top:6px;"><label>Status</label><span>${b.status || 'Pendente'}</span></div>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <div class="section-title">Servi\u00e7os / Itens do Or\u00e7amento</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width:40px">#</th>
                                        <th>Servi\u00e7o / Procedimento</th>
                                        <th style="width:50px;text-align:center">Qtde</th>
                                        <th style="width:110px;text-align:right">Valor Unit.</th>
                                        <th style="width:120px;text-align:right">Subtotal</th>
                                        <th>Executor</th>
                                        <th>Protético</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml || '<tr><td colspan="7" style="text-align:center;color:#9ca3af">Nenhum item</td></tr>'}
                                </tbody>
                                <tfoot>
                                    <tr class="total-row">
                                        <td colspan="4" style="text-align:right">TOTAL GERAL:</td>
                                        <td style="text-align:right">R$ ${total.toFixed(2)}</td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        ${b.observacoes ? `
                        <div class="section">
                            <div class="section-title">Observações</div>
                            <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; background: #f9fafb; white-space: pre-wrap;">${b.observacoes}</div>
                        </div>
                        ` : ''}

                        <div class="signature-spacer"></div>
                        <div class="signature-section">
                            <div class="section-title">Assinaturas</div>
                            <div class="signature-block">
                                <div class="sig-line">
                                    <div class="line"></div>
                                    <strong>${b.pacientenome || 'Paciente'}</strong><br>
                                        <small>Assinatura do Paciente / Respons\u00e1vel</small><br>
                                            <small>CPF: ${patCpf || '_________________________________'}</small>
                                        </div>
                                </div>
                                <div style="margin-top:20px; font-size:11px; color:#6b7280;">
                                    <strong>Data:</strong> ${hoje}
                                </div>
                            </div>

                            <div class="footer">
                                Este documento \u00e9 apenas um or\u00e7amento e n\u00e3o constitui cobran\u00e7a. Valores sujeitos a altera\u00e7\u00e3o.
                            </div>
                    </body>
                </html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Habilite pop-ups para imprimir o or\u00e7amento.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
};

function movBucketFromForma(forma) {
    const k = normalizeKey(normalizeFormaPagamento(forma));
    if (!k) return 'OUTROS';
    if (k.includes('PIX')) return 'PIX';
    if (k.includes('CREDITO')) return 'CC';
    if (k.includes('DEBITO')) return 'CD';
    if (k.includes('DINHEIRO') || k.includes('ESPECIE')) return 'ESPECIE';
    return 'OUTROS';
}

function formatMovBucketLabel(bucket) {
    if (bucket === 'PIX') return 'PIX';
    if (bucket === 'CC') return 'CC (Cartão Crédito)';
    if (bucket === 'CD') return 'CD (Cartão Débito)';
    if (bucket === 'ESPECIE') return 'Espécie (Dinheiro)';
    return 'Outros';
}

function findProfessionalByAnyId(value) {
    const v = String(value || '');
    if (!v) return null;
    return (professionals || []).find(p => String(p.id) === v || String(p.seqid) === v) || null;
}

function findProfessionalNameByAnyId(value) {
    const p = findProfessionalByAnyId(value);
    return p ? String(p.nome || '') : '';
}

function findServiceNameById(id) {
    if (!id) return '';
    const s = (services || []).find(x => String(x.id) === String(id));
    return s ? String(s.descricao || '') : '';
}

function buildAllocationRows(valorPago, items) {
    const subs = items.map(it => {
        const qtde = Number(it.qtde || 1);
        const v = Number(it.valor || 0);
        return Math.max(0, v * (Number.isFinite(qtde) && qtde > 0 ? qtde : 1));
    });
    const total = subs.reduce((a, b) => a + b, 0);
    if (!(total > 0) || !(Number(valorPago) > 0)) return subs.map(() => 0);

    const raw = subs.map(s => (valorPago * (s / total)));
    const out = raw.map((r, idx) => idx === raw.length - 1 ? r : Number(r.toFixed(2)));
    const sumPrev = out.slice(0, -1).reduce((a, b) => a + b, 0);
    out[out.length - 1] = Number((valorPago - sumPrev).toFixed(2));
    return out.map(v => (v < 0 ? 0 : v));
}

function extractAllocationItemIdFromObs(observacoes) {
    const s = String(observacoes || '');
    const m = s.match(/\[AlocarItem:([^\]]+)\]/i);
    return m && m[1] ? String(m[1]).trim() : '';
}

function getOrcamentoPagamentoDateValue(p) {
    return (p && (p.data_pagamento || p.criado_em || p.created_at || p.data)) || null;
}

function getFinancePagamentoDateValue(p) {
    return (p && (p.data_transacao || p.created_at)) || null;
}

function getItemSubtotal(it) {
    const qtde = Number((it && it.qtde) || 1);
    const valor = Number((it && it.valor) || 0);
    return (Number.isFinite(qtde) ? qtde : 1) * (Number.isFinite(valor) ? valor : 0);
}

function buildAllocationsForBudget({ budget, items }) {
    const out = new Map();
    const remaining = (items || []).map(getItemSubtotal);
    const ledger = [];

    const op = (budget && Array.isArray(budget.pagamentos)) ? budget.pagamentos : [];
    op.forEach(p => {
        ledger.push({
            source: 'orcamento',
            id: String(p && p.id || ''),
            valor: Number(p && p.valor_pago || 0),
            obs: String(p && p.observacoes || ''),
            dt: getOrcamentoPagamentoDateValue(p)
        });
    });

    const fp = (budget && Array.isArray(budget.pagamentos_financeiro_extra)) ? budget.pagamentos_financeiro_extra : [];
    fp.forEach(p => {
        ledger.push({
            source: 'financeiro',
            id: String(p && p.id || ''),
            valor: Number(p && p.valor || 0),
            obs: String(p && p.observacoes || ''),
            dt: getFinancePagamentoDateValue(p)
        });
    });

    ledger.sort((a, b) => String(a.dt || '').localeCompare(String(b.dt || '')));

    ledger.forEach(entry => {
        let amt = Number(entry.valor || 0);
        if (!(amt > 0)) return;

        const alloc = (items || []).map(() => 0);
        const explicitItemId = extractAllocationItemIdFromObs(entry.obs);

        if (explicitItemId) {
            const idx = (items || []).findIndex(it => String(it && it.id || '') === explicitItemId);
            if (idx >= 0) {
                const take = Math.min(amt, Math.max(0, remaining[idx] || 0));
                if (take > 0) {
                    alloc[idx] += take;
                    remaining[idx] = Math.max(0, (remaining[idx] || 0) - take);
                    amt -= take;
                }
            }
        }

        if (amt > 0) {
            for (let i = 0; i < remaining.length && amt > 0; i++) {
                const rem = Math.max(0, remaining[i] || 0);
                if (!(rem > 0)) continue;
                const take = Math.min(amt, rem);
                alloc[i] += take;
                remaining[i] = rem - take;
                amt -= take;
            }
        }

        if (entry.source === 'orcamento' && entry.id) {
            out.set(entry.id, alloc);
        }
    });

    return out;
}

async function fetchMovDiariaPayments({ dateStr }) {
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
    const baseSelectCols = 'id,orcamento_id,valor_pago,forma_pagamento,observacoes,status_pagamento,empresa_id';
    const dateCols = ['data_pagamento', 'criado_em', 'created_at', 'data'];
    let lastErr = null;
    for (const col of dateCols) {
        try {
            const q = db.from('orcamento_pagamentos')
                .select(`${baseSelectCols},${col}`)
                .eq('empresa_id', currentEmpresaId)
                .neq('status_pagamento', 'Cancelado')
                .gte(col, startIso)
                .lte(col, endIso)
                .order(col, { ascending: true });
            const res = await withTimeout(q, 20000, `orcamento_pagamentos:${col}`);
            if (res && !res.error) {
                return { rows: res.data || [], dateCol: col };
            }
            lastErr = res && res.error ? res.error : lastErr;
        } catch (err) {
            lastErr = err;
        }
    }
    if (lastErr) throw lastErr;
    return { rows: [], dateCol: 'data_pagamento' };
}

async function printMovimentacaoDiaria({ dateStr, profVal }) {
    if (!dateStr) { showToast('Selecione a data.', true); return; }
    const selectedProf = findProfessionalByAnyId(profVal);
    const selectedLabel = selectedProf ? String(selectedProf.nome || '') : 'Todos';

    if (btnGenerateMovDiaria) btnGenerateMovDiaria.disabled = true;
    try {
        const { rows: payRows, dateCol } = await fetchMovDiariaPayments({ dateStr });
        const allocCache = new Map();

        const lines = [];
        payRows.forEach(p => {
            const budgetSeq = Number(p.orcamento_id);
            const b = (budgets || []).find(x => Number(x.seqid) === budgetSeq) || null;
            if (!b) return;
            const itens = b.orcamento_itens || b.itens || [];
            if (!Array.isArray(itens) || itens.length === 0) return;

            const pacienteNome = String(b.pacientenome || b.paciente_nome || '') || (patients || []).find(pp => pp.id === b.pacienteid)?.nome || '';
            const dataRaw = p[dateCol] || p.data_pagamento || p.criado_em || p.created_at || p.data || null;
            const dataFmt = dataRaw ? formatDateTime(dataRaw) : formatDateBR(dateStr);
            const formaLabel = normalizeFormaPagamento(p.forma_pagamento);
            const bucket = movBucketFromForma(p.forma_pagamento);
            const valorPago = Number(p.valor_pago || 0);

            let allocMap = allocCache.get(budgetSeq);
            if (!allocMap) {
                allocMap = buildAllocationsForBudget({ budget: b, items: itens });
                allocCache.set(budgetSeq, allocMap);
            }
            const alloc = allocMap.get(String(p.id || '')) || buildAllocationRows(valorPago, itens);
            const explicit = Boolean(extractAllocationItemIdFromObs(p.observacoes));
            const touches = Array.isArray(alloc) ? alloc.filter(v => Number(v || 0) > 0).length : 0;
            itens.forEach((it, idx) => {
                const execId = it.profissional_id;
                const execName = findProfessionalNameByAnyId(execId) || String(it.executorNome || '');
                const servName = findServiceNameById(it.servico_id) || String(it.servicodescricao || it.descricao || '');
                const itemName = `${servName}${it.subdivisao ? ` • ${it.subdivisao}` : ''}${explicit ? '' : (touches > 1 ? ' (auto)' : '')}`;
                const paid = Number(alloc[idx] || 0);
                if (!(paid > 0)) return;
                const execProf = findProfessionalByAnyId(execId);
                if (selectedProf && execProf) {
                    const same = (String(execProf.id) && String(execProf.id) === String(selectedProf.id)) || (String(execProf.seqid) && String(execProf.seqid) === String(selectedProf.seqid));
                    if (!same) return;
                } else if (selectedProf && !execProf) {
                    return;
                }
                lines.push({
                    professional: execName || '—',
                    date: dataFmt,
                    patient: pacienteNome || '—',
                    service: itemName || '—',
                    paid,
                    forma: formaLabel || '—',
                    bucket
                });
            });
        });

        const groups = new Map();
        lines.forEach(l => {
            const key = l.professional || '—';
            const arr = groups.get(key) || [];
            arr.push(l);
            groups.set(key, arr);
        });
        const groupKeys = Array.from(groups.keys()).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

        const totals = { PIX: 0, CC: 0, CD: 0, ESPECIE: 0, OUTROS: 0 };
        lines.forEach(l => { totals[l.bucket] = (totals[l.bucket] || 0) + Number(l.paid || 0); });
        const totalGeral = Object.values(totals).reduce((a, b) => a + b, 0);

        const totalsHtml = ['PIX', 'CC', 'CD', 'ESPECIE', 'OUTROS'].map(k => `
            <tr>
                <td style="padding:8px; border:1px solid #e5e7eb; font-weight:800;">${escapeHtml(formatMovBucketLabel(k))}</td>
                <td style="padding:8px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(totals[k] || 0))}</td>
            </tr>
        `).join('');

        const bodyHtml = groupKeys.length ? groupKeys.map(name => {
            const rows = (groups.get(name) || []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
            const rowsHtml = rows.map(r => `
                <tr>
                    <td style="padding:8px; border:1px solid #e5e7eb; white-space:nowrap;">${escapeHtml(r.date)}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(r.patient)}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(r.service)}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(r.paid || 0))}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(r.forma)}</td>
                </tr>
            `).join('');
            const subt = { PIX: 0, CC: 0, CD: 0, ESPECIE: 0, OUTROS: 0 };
            rows.forEach(r => { subt[r.bucket] = (subt[r.bucket] || 0) + Number(r.paid || 0); });
            const subtTotal = Object.values(subt).reduce((a, b) => a + b, 0);
            const subtLine = `<div style="display:flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; color:#374151;">
                <strong>Total ${escapeHtml(name)}:</strong> ${escapeHtml(fmtMoney(subtTotal))}
                <span>PIX: ${escapeHtml(fmtMoney(subt.PIX))}</span>
                <span>CC: ${escapeHtml(fmtMoney(subt.CC))}</span>
                <span>CD: ${escapeHtml(fmtMoney(subt.CD))}</span>
                <span>Espécie: ${escapeHtml(fmtMoney(subt.ESPECIE))}</span>
                <span>Outros: ${escapeHtml(fmtMoney(subt.OUTROS))}</span>
            </div>`;
            return `
                <div style="margin-top: 16px; page-break-inside: avoid;">
                    <div style="font-size: 13px; font-weight: 900; color:#111827; margin-bottom: 6px;">${escapeHtml(name)}</div>
                    <table style="width:100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr>
                                <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Data</th>
                                <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Paciente</th>
                                <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Serviço Executado</th>
                                <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:right;">Valor Pago</th>
                                <th style="padding:8px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Forma</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    ${subtLine}
                </div>
            `;
        }).join('') : `<div style="text-align:center; color:#6b7280; padding: 24px;">Nenhum registro encontrado.</div>`;

        const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Movimentação Diária - ${escapeHtml(formatDateBR(dateStr))}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; color:#111827; padding: 24px; }
    .header { display:flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-weight: 900; color:#0066cc; font-size: 20px; line-height: 1.05; }
    .brand small { display:block; font-size: 11px; font-weight: 700; color:#6b7280; margin-top: 2px; }
    .meta { text-align:right; color:#6b7280; font-size: 11px; }
    .title { font-size: 14px; font-weight: 900; letter-spacing: 0.04em; }
    .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #f9fafb; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">OCC <small>Odonto Connect Cloud</small></div>
      <div style="margin-top:6px;" class="title">MOVIMENTAÇÃO DIÁRIA</div>
    </div>
    <div class="meta">
      <div>Data: <strong>${escapeHtml(formatDateBR(dateStr))}</strong></div>
      <div>Profissional: <strong>${escapeHtml(selectedLabel)}</strong></div>
      <div>Emitido em: ${escapeHtml(hoje)}</div>
    </div>
  </div>

  <div class="box" style="margin-bottom: 14px;">
    <div style="font-weight:900; margin-bottom: 6px;">Totais por forma de pagamento</div>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <tbody>
        ${totalsHtml}
        <tr>
          <td style="padding:8px; border:1px solid #e5e7eb; font-weight:900;">TOTAL</td>
          <td style="padding:8px; border:1px solid #e5e7eb; text-align:right; font-weight:900;">${escapeHtml(fmtMoney(totalGeral))}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top: 8px; font-size: 10px; color:#6b7280;">
      Cálculo: pagamentos do dia alocados nos itens do orçamento (respeita alocação manual e saldo restante).
    </div>
  </div>

  ${bodyHtml}
</body>
</html>`;

        const win = window.open('', '_blank', 'width=980,height=750');
        if (!win) { showToast('Habilite pop-ups para imprimir o relatório.', true); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
        if (movDiariaModal) movDiariaModal.classList.add('hidden');
    } catch (err) {
        console.error('Erro ao gerar Movimentação Diária:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao gerar relatório (${code}): ${msg}`, true);
    } finally {
        if (btnGenerateMovDiaria) btnGenerateMovDiaria.disabled = false;
    }
}

window.printPatient = function (id) {
    const p = patients.find(x => x.id === id);
    if (!p) { showToast('Paciente n\u00e3o encontrado.', true); return; }

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const anamnese = p.anamnese || {};

    const html = `<!DOCTYPE html>
                        <html lang="pt-BR">
                            <head>
                                <meta charset="UTF-8">
                                    <title>Ficha do Paciente - ${p.nome}</title>
                                    <style>
                                        * {margin: 0; padding: 0; box-sizing: border-box; }
                                        body {font - family: Arial, sans-serif; font-size: 13px; color: #1f2937; padding: 30px; }
                                        .header {display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; }
                                        .clinic-name {font - size: 22px; font-weight: bold; color: #0066cc; }
                                        .doc-title {font - size: 16px; font-weight: bold; text-align: right; color: #374151; }
                                        .section {margin - bottom: 25px; }
                                        .section-title {font - size: 12px; font-weight: bold; text-transform: uppercase; color: #0066cc; letter-spacing: 0.05em; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                                        .info-grid {display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
                                        .info-item label {font - size: 11px; color: #6b7280; display: block; margin-bottom: 2px; }
                                        .info-item span {font - weight: 600; font-size: 13px; }
                                        .anamnese-item {margin - bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #f3f4f6; }
                                        .anamnese-item label {font - weight: bold; display: block; margin-bottom: 3px; }
                                        .anamnese-item p {color: #4b5563; }
                                        .footer {margin - top: 40px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
                                        @media print {body {padding: 15px; } .section {page -break-inside: avoid; } }
                                    </style>
                            </head>
                            <body>
                                <div class="header">
                                    <div>
                                        <div class="clinic-name" style="text-align:center; line-height:1.05;">
                                            <div>OCC</div>
                                            <div style="font-size:12px; font-weight:600; color:#6b7280; margin-top:2px;">Odonto Connect Cloud</div>
                                        </div>
                                        <div style="color:#6b7280; margin-top:4px;">Ficha Cadastral e Anamnese</div>
                                    </div>
                                    <div>
                                        <div class="doc-title">PRONTU\u00c1RIO DO PACIENTE</div>
                                        <div style="color:#6b7280; margin-top:4px; font-size:11px;">Gerado em: ${hoje}</div>
                                    </div>
                                </div>

                                <div class="section">
                                    <div class="section-title">Dados Pessoais</div>
                                    <div class="info-grid">
                                        <div class="info-item"><label>Nome Completo</label><span>${p.nome}</span></div>
                                        <div class="info-item"><label>CPF</label><span>${p.cpf}</span></div>
                                        <div class="info-item"><label>Data de Nascimento</label><span>${p.datanascimento || '-'}</span></div>
                                        <div class="info-item"><label>Sexo</label><span>${p.sexo || '-'}</span></div>
                                        <div class="info-item"><label>Profiss\u00e3o</label><span>${p.profissao || '-'}</span></div>
                                        <div class="info-item"><label>E-mail</label><span>${p.email || '-'}</span></div>
                                        <div class="info-item"><label>Celular</label><span>${p.celular || '-'}</span></div>
                                        <div class="info-item"><label>Telefone</label><span>${p.telefone || '-'}</span></div>
                                    </div>
                                </div>

                                <div class="section">
                                    <div class="section-title">Endere\u00e7o</div>
                                    <div class="info-grid">
                                        <div class="info-item" style="grid-column: span 2;"><label>Logradouro</label><span>${p.endereco || '-'}, ${p.numero || 'S/N'}</span></div>
                                        <div class="info-item"><label>CEP</label><span>${p.cep || '-'}</span></div>
                                        <div class="info-item"><label>Bairro</label><span>${p.bairro || '-'}</span></div>
                                        <div class="info-item"><label>Cidade</label><span>${p.cidade || '-'}</span></div>
                                        <div class="info-item"><label>UF</label><span>${p.uf || '-'}</span></div>
                                        <div class="info-item" style="grid-column: span 3;"><label>Complemento</label><span>${p.complemento || '-'}</span></div>
                                    </div>
                                </div>

                                <div class="section">
                                    <div class="section-title">Anamnese / Hist\u00f3rico de Sa\u00fade</div>
                                    <div class="anamnese-list">
                                        <div class="anamnese-item">
                                            <label>Est\u00e1 em tratamento m\u00e9dico?</label>
                                            <p>${anamnese.emTratamentoMedico ? 'Sim - ' + (anamnese.tratamentoDesc || 'N\u00e3o informado') : 'N\u00e3o'}</p>
                                        </div>
                                        <div class="anamnese-item">
                                            <label>Toma alguma medica\u00e7\u00e3o?</label>
                                            <p>${anamnese.tomaMedicacao ? 'Sim - ' + (anamnese.medicacaoDesc || 'N\u00e3o informado') : 'N\u00e3o'}</p>
                                        </div>
                                        <div class="anamnese-item">
                                            <label>Possui alguma alergia?</label>
                                            <p>${anamnese.temAlergia ? 'Sim - ' + (anamnese.alergiaDesc || 'N\u00e3o informado') : 'N\u00e3o'}</p>
                                        </div>
                                        <div class="anamnese-item">
                                            <label>J\u00e1 teve hemorragia?</label>
                                            <p>${anamnese.teveHemorragia ? 'Sim' : 'N\u00e3o'}</p>
                                        </div>
                                        <div class="anamnese-item">
                                            <label>Doen\u00e7as Preexistentes / Observa\u00e7\u00f5es:</label>
                                            <p>${anamnese.doencasPreexistentes || 'Nenhuma observa\u00e7\u00e3o registrada.'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div class="footer">
                                    Declaro que as informa\u00e7\u00f5es acima s\u00e3o verdadeiras.
                                    <br><br>
                                        _________________________________________________<br>
                                            Assinatura do Paciente / Respons\u00e1vel
                                        </div>
                                    </body>
                                    </html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Habilite pop-ups para imprimir a ficha.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
};

window.printProfessional = function (id) {
    const p = professionals.find(x => x.id === id);
    if (!p) { showToast('Profissional n\u00e3o encontrado.', true); return; }

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const specName = getSpecialtyName(p.especialidadeid);
    const com = p.comissions || {};

    const html = `
                                    <!DOCTYPE html>
                                    <html lang="pt-BR">
                                        <head>
                                            <meta charset="UTF-8">
                                                <title>Ficha do Profissional - ${p.nome}</title>
                                                <style>
                                                    * {margin: 0; padding: 0; box-sizing: border-box; }
                                                    body {font - family: Arial, sans-serif; font-size: 13px; color: #1f2937; padding: 30px; }
                                                    .header {display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; }
                                                    .clinic-name {font - size: 22px; font-weight: bold; color: #0066cc; }
                                                    .doc-title {font - size: 16px; font-weight: bold; text-align: right; color: #374151; }
                                                    .section {margin - bottom: 25px; }
                                                    .section-title {font - size: 12px; font-weight: bold; text-transform: uppercase; color: #0066cc; letter-spacing: 0.05em; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                                                    .main-info {display: flex; gap: 30px; margin-bottom: 20px; }
                                                    .photo-box {width: 120px; height: 150px; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; background: #f9fafb; overflow: hidden; }
                                                    .photo-box img {max - width: 100%; max-height: 100%; object-fit: cover; }
                                                    .info-grid {flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                                                    .info-item label {font - size: 11px; color: #6b7280; display: block; margin-bottom: 2px; }
                                                    .info-item span {font - weight: 600; font-size: 13px; }
                                                    .comission-table {width: 100%; border-collapse: collapse; margin-top: 10px; }
                                                    .comission-table th, .comission-table td {padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
                                                    .comission-table th {background: #f3f4f6; font-size: 11px; color: #6b7280; }
                                                    .footer {margin - top: 40px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
                                                </style>
                                        </head>
                                        <body>
                                            <div class="header">
                                                <div>
                                                    <div class="clinic-name" style="text-align:center; line-height:1.05;">
                                                        <div>OCC</div>
                                                        <div style="font-size:12px; font-weight:600; color:#6b7280; margin-top:2px;">Odonto Connect Cloud</div>
                                                    </div>
                                                    <div style="color:#6b7280; margin-top:4px;">Cadastro de Profissionais</div>
                                                </div>
                                                <div>
                                                    <div class="doc-title">FICHA DO PROFISSIONAL</div>
                                                    <div style="color:#6b7280; margin-top:4px; font-size:11px;">Emitido em: ${hoje}</div>
                                                </div>
                                            </div>

                                            <div class="main-info">
                                                <div class="photo-box">
                                                    ${p.photo ? `<img src="${p.photo}">` : '<span style="color:#9ca3af;font-size:10px">Sem Foto</span>'}
                                                </div>
                                                <div class="info-grid">
                                                    <div class="info-item"><label>Nome</label><span>${p.nome}</span></div>
                                                    <div class="info-item"><label>Status</label><span>${p.status}</span></div>
                                                    <div class="info-item"><label>Tipo</label><span>${p.tipo}</span></div>
                                                    <div class="info-item"><label>Especialidade</label><span>${specName || '-'}</span></div>
                                                    <div class="info-item"><label>E-mail</label><span>${p.email}</span></div>
                                                    <div class="info-item"><label>Celular</label><span>${p.celular}</span></div>
                                                </div>
                                            </div>

                                            <div class="section">
                                                <div class="section-title">Configura\u00e7\u00f5es de Comiss\u00e3o (%)</div>
                                                <table class="comission-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Categoria / Tipo</th>
                                                            <th>Execu\u00e7\u00e3o (E)</th>
                                                            <th>Capta\u00e7\u00e3o (C)</th>
                                                            <th>Planejamento (P)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td><strong>Cl\u00ednico</strong></td>
                                                            <td>${com.ce || '0'}%</td>
                                                            <td>${com.cc || '0'}%</td>
                                                            <td>${com.cp || '0'}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Especialista</strong></td>
                                                            <td>${com.ee || '0'}%</td>
                                                            <td>${com.ec || '0'}%</td>
                                                            <td>${com.ep || '0'}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Implantodontia (Geral)</strong></td>
                                                            <td colspan="3" style="text-align:center">${com.imp || '0'}%</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div class="footer">
                                                Documento para uso interno da cl\u00ednica.
                                            </div>
                                        </body>
                                    </html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Habilite pop-ups para imprimir a ficha.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
};

window.printService = function (id) {
    const s = services.find(x => x.id === id);
    if (!s) { showToast('Servi\u00e7o n\u00e3o encontrado.', true); return; }

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `
                                    <!DOCTYPE html>
                                    <html lang="pt-BR">
                                        <head>
                                            <meta charset="UTF-8">
                                                <title>Ficha do Servi\u00e7o - ${s.descricao}</title>
                                                <style>
                                                    * {margin: 0; padding: 0; box-sizing: border-box; }
                                                    body {font - family: Arial, sans-serif; font-size: 13px; color: #1f2937; padding: 30px; }
                                                    .header {display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; }
                                                    .clinic-name {font - size: 22px; font-weight: bold; color: #0066cc; }
                                                    .doc-title {font - size: 16px; font-weight: bold; text-align: right; color: #374151; }
                                                    .section {margin - bottom: 25px; }
                                                    .info-card {border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb; margin-top: 10px; }
                                                    .info-row {display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
                                                    .info-row:last-child {border - bottom: none; }
                                                    .label {color: #6b7280; font-size: 12px; }
                                                    .value {font - weight: bold; font-size: 14px; }
                                                    .footer {margin - top: 40px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
                                                </style>
                                        </head>
                                        <body>
                                            <div class="header">
                                                <div>
                                                    <div class="clinic-name" style="text-align:center; line-height:1.05;">
                                                        <div>OCC</div>
                                                        <div style="font-size:12px; font-weight:600; color:#6b7280; margin-top:2px;">Odonto Connect Cloud</div>
                                                    </div>
                                                    <div style="color:#6b7280; margin-top:4px;">Cat\u00e1logo de Servi\u00e7os e Estoque</div>
                                                </div>
                                                <div>
                                                    <div class="doc-title">DETALHES DO ITEM</div>
                                                    <div style="color:#6b7280; margin-top:4px; font-size:11px;">Emitido em: ${hoje}</div>
                                                </div>
                                            </div>

                                            <div class="section">
                                                <div class="info-card">
                                                    <div class="info-row">
                                                        <span class="label">C\u00f3digo (SeqID)</span>
                                                        <span class="value">#${s.seqid}</span>
                                                    </div>
                                                    <div class="info-row">
                                                        <span class="label">Descri\u00e7\u00e3o</span>
                                                        <span class="value">${s.descricao}</span>
                                                    </div>
                                                    <div class="info-row">
                                                        <span class="label">Valor</span>
                                                        <span class="value" style="color:#0066cc">R$ ${Number(s.valor || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div class="info-row">
                                                        <span class="label">Tipo</span>
                                                        <span class="value">${s.ie === 'S' ? 'Servi\u00e7o' : 'Estoque / Material'}</span>
                                                    </div>
                                                    <div class="info-row">
                                                        <span class="label">Subdivis\u00e3o</span>
                                                        <span class="value">${s.subdivisao || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="footer">
                                                Documento gerado pelo sistema de gest\u00e3o da cl\u00ednica.
                                            </div>
                                        </body>
                                    </html>`;

    const win = window.open('', '_blank', 'width=700,height=500');
    if (!win) { showToast('Habilite pop-ups para imprimir os detalhes.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
};

window.printServiceList = function (subdivisionName = '') {
    const filtered = subdivisionName
        ? services.filter(s => s.subdivisao === subdivisionName)
        : services;

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const filtroTexto = subdivisionName ? `Filtrado por: ${subdivisionName}` : 'Todos os Itens';

    let itemsHtml = '';
    filtered.forEach(s => {
        itemsHtml += `
            <tr>
                <td>${s.seqid}</td>
                <td>${s.descricao}</td>
                <td>${s.ie === 'S' ? 'Serviço' : 'Estoque'}</td>
                <td>${s.subdivisao || '-'}</td>
                <td style="text-align: right;">R$ ${Number(s.valor || 0).toFixed(2)}</td>
            </tr>
        `;
    });

    const html = `
                                    <!DOCTYPE html>
                                    <html lang="pt-BR">
                                        <head>
                                            <meta charset="UTF-8">
                                                <title>Relatório Geral de Serviços</title>
                                                <style>
                                                    * {margin: 0; padding: 0; box-sizing: border-box; }
                                                    body {font - family: Arial, sans-serif; font-size: 11px; color: #1f2937; padding: 20px; }
                                                    .header {display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 10px; margin-bottom: 15px; }
                                                    .clinic-name {font - size: 18px; font-weight: bold; color: #0066cc; }
                                                    .doc-title {font - size: 14px; font-weight: bold; text-align: right; color: #374151; }
                                                    table {width: 100%; border-collapse: collapse; margin-top: 10px; }
                                                    th, td {padding: 8px 5px; border: 1px solid #e5e7eb; text-align: left; }
                                                    th {background: #f3f4f6; color: #374151; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                                                    .footer {margin - top: 20px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
                                                    @media print {
                                                        @page {size: landscape; margin: 1cm; }
            }
                                                </style>
                                        </head>
                                        <body>
                                            <div class="header">
                                                <div>
                                                    <div class="clinic-name" style="text-align:center; line-height:1.05;">
                                                        <div>OCC</div>
                                                        <div style="font-size:12px; font-weight:600; color:#6b7280; margin-top:2px;">Odonto Connect Cloud</div>
                                                    </div>
                                                    <div style="color:#6b7280; margin-top:2px;">Relatório de Serviços e Itens de Estoque</div>
                                                </div>
                                                <div>
                                                    <div class="doc-title">CATÁLOGO GERAL</div>
                                                    <div style="color:#6b7280; font-size:10px;">${filtroTexto}</div>
                                                    <div style="color:#6b7280; font-size:10px;">Emitido em: ${hoje}</div>
                                                </div>
                                            </div>

                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th style="width: 50px;">ID</th>
                                                        <th>DESCRIÇÃO</th>
                                                        <th style="width: 80px;">TIPO</th>
                                                        <th style="width: 150px;">SUBDIVISÃO</th>
                                                        <th style="width: 100px; text-align: right;">VALOR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${itemsHtml || '<tr><td colspan="5" style="text-align:center">Nenhum item encontrado.</td></tr>'}
                                                </tbody>
                                            </table>

                                            <div class="footer">
                                                Total de registros: ${filtered.length} | Documento gerado pelo sistema de gestão da clínica.
                                            </div>
                                        </body>
                                    </html>`;

    const win = window.open('', '_blank', 'width=1000,height=700');
    if (!win) { showToast('Habilite pop-ups para gerar o relatório.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
};

window.printUser = function (id) {
    const idStr = String(id || '');
    const u = usersAdminList.find(x => String(x.id || '') === idStr)
        || usersAdminList.find(x => String(x.usuario_id || x.user_id || '') === idStr)
        || usersAdminList.find(x => {
            const uid = String(x.usuario_id || x.user_id || '');
            return idStr && uid && uid.startsWith(idStr);
        });
    if (!u) { showToast('Usu\u00e1rio n\u00e3o encontrado.', true); return; }

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const perms = (typeof u.permissoes === 'string') ? JSON.parse(u.permissoes) : (u.permissoes || {});

    const renderPermLine = (modLabel, modKey) => {
        const p = perms[modKey] || {};
        const pStr = [
            p.select ? 'Ver' : '',
            p.insert ? 'Criar' : '',
            p.update ? 'Editar' : '',
            p.delete ? 'Apagar' : ''
        ].filter(Boolean).join(', ') || 'Nenhuma';
        return `<tr><td style="font-weight:bold">${modLabel}</td><td>${pStr}</td></tr>`;
    };

    const html = `
                                    <!DOCTYPE html>
                                    <html lang="pt-BR">
                                        <head>
                                            <meta charset="UTF-8">
                                                <title>Acesso do Usu\u00e1rio - ${u.user_email || u.usuario_id || u.user_id}</title>
                                                <style>
                                                    * {margin: 0; padding: 0; box-sizing: border-box; }
                                                    body {font - family: Arial, sans-serif; font-size: 13px; color: #1f2937; padding: 30px; }
                                                    .header {display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; }
                                                    .clinic-name {font - size: 22px; font-weight: bold; color: #0066cc; }
                                                    .doc-title {font - size: 16px; font-weight: bold; text-align: right; color: #374151; }
                                                    .section {margin - bottom: 25px; }
                                                    .section-title {font - size: 12px; font-weight: bold; text-transform: uppercase; color: #0066cc; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                                                    table {width: 100%; border-collapse: collapse; margin-top: 10px; }
                                                    th, td {padding: 10px; border: 1px solid #e5e7eb; text-align: left; }
                                                    th {background: #f3f4f6; color: #6b7280; font-size: 11px; }
                                                    .user-info {margin - bottom: 20px; font-size: 14px; }
                                                    .user-info p {margin - bottom: 5px; }
                                                    .footer {margin - top: 40px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
                                                </style>
                                        </head>
                                        <body>
                                            <div class="header">
                                                <div>
                                                    <div class="clinic-name" style="text-align:center; line-height:1.05;">
                                                        <div>OCC</div>
                                                        <div style="font-size:12px; font-weight:600; color:#6b7280; margin-top:2px;">Odonto Connect Cloud</div>
                                                    </div>
                                                    <div style="color:#6b7280; margin-top:4px;">Gest\u00e3o de Acessos</div>
                                                </div>
                                                <div>
                                                    <div class="doc-title">RELAT\u00d3RIO DE PERMISS\u00d5ES</div>
                                                    <div style="color:#6b7280; margin-top:4px; font-size:11px;">Emitido em: ${hoje}</div>
                                                </div>
                                            </div>

                                            <div class="user-info">
                                                <p><strong>Usu\u00e1rio:</strong> ${u.user_email || u.usuario_id || u.user_id}</p>
                                                <p><strong>Perfil:</strong> ${u.perfil.toUpperCase()}</p>
                                                <p><strong>Status:</strong> Ativo</p>
                                            </div>

                                            <div class="section">
                                                <div class="section-title">Detalhamento de Permiss\u00f5es</div>
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>M\u00f3dulo</th>
                                                            <th>A\u00e7\u00f5es Autorizadas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${renderPermLine('Dashboard', 'dashboard')}
                                                        ${renderPermLine('Pacientes', 'pacientes')}
                                                        ${renderPermLine('Profissionais', 'profissionais')}
                                                        ${renderPermLine('Especialidades', 'especialidades')}
                                                        ${renderPermLine('Servi\u00e7os / Estoque', 'servicos')}
                                                        ${renderPermLine('Or\u00e7amentos', 'orcamentos')}
                                                        ${renderPermLine('Atendimento', 'atendimento')}
                                                        ${renderPermLine('Agenda', 'agenda')}
                                                        ${renderPermLine('Financeiro', 'financeiro')}
                                                        ${renderPermLine('Comiss\u00f5es', 'comissoes')}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div class="footer">
                                                Este relat\u00f3rio \u00e9 para fins de auditoria de seguran\u00e7a.
                                            </div>
                                        </body>
                                    </html>`;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) { showToast('Habilite pop-ups para imprimir as permiss\u00f5es.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
};

// Search Budget Input
function filterBudgetsForList({ term, statusFilter }) {
    const t = String(term || '').toLowerCase().trim();
    const statusKey = normalizeKey(String(statusFilter || 'TODOS'));

    return (budgets || []).filter(b => {
        if (t) {
            const ok =
                (b.seqid && String(b.seqid).includes(t)) ||
                (b.pacientenome && String(b.pacientenome).toLowerCase().includes(t)) ||
                (b.pacientecelular && String(b.pacientecelular).includes(t));
            if (!ok) return false;
        }

        if (statusKey === 'TODOS') return true;
        const bStatusKey = normalizeKey(String(b && b.status || 'PENDENTE'));
        return bStatusKey === statusKey;
    });
}

function refreshBudgetsList() {
    const term = searchBudgetInput ? searchBudgetInput.value : '';
    const statusFilter = budgetStatusFilter ? budgetStatusFilter.value : 'TODOS';
    renderTable(filterBudgetsForList({ term, statusFilter }), 'budgets');
}

if (searchBudgetInput) {
    searchBudgetInput.addEventListener('input', () => refreshBudgetsList());
}
if (budgetStatusFilter) {
    budgetStatusFilter.addEventListener('change', () => refreshBudgetsList());
}

// --- AUTH LOGIC (LOGIN / LOGOUT) ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        const btnLogin = document.getElementById('btnLogin');

        errorDiv.style.display = 'none';
        btnLogin.disabled = true;
        btnLogin.innerText = 'Autenticando...';

        try {
            const { error } = await db.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Re-initialize app to pull active user mapping
            await initializeApp();
        } catch (err) {
            errorDiv.innerText = err.message || 'Erro de autenticação.';
            errorDiv.style.display = 'block';
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerText = 'Entrar no Sistema';
        }
    });
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await db.auth.signOut();
        window.location.reload();
    });
}

// --- PASSWORD RECOVERY FLOW ---
const linkForgotPassword = document.getElementById('linkForgotPassword');
const forgotPasswordView = document.getElementById('forgotPasswordView');
const loginCard = document.getElementById('loginCard'); // inner login card only
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const btnBackToLogin = document.getElementById('btnBackToLogin');
const resetPasswordView = document.getElementById('resetPasswordView');
const resetPasswordForm = document.getElementById('resetPasswordForm');

if (linkForgotPassword) {
    linkForgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.style.display = 'none';
        forgotPasswordView.style.display = 'block';
    });
}

if (btnBackToLogin) {
    btnBackToLogin.addEventListener('click', () => {
        forgotPasswordView.style.display = 'none';
        loginCard.style.display = 'block';
    });
}

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value;
        const btnSend = document.getElementById('btnSendRecovery');

        btnSend.disabled = true;
        btnSend.innerText = 'Enviando...';

        try {
            const { error } = await db.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname,
            });
            if (error) throw error;
            showToast("E-mail de recuperação enviado com sucesso!");
            forgotPasswordView.style.display = 'none';
            loginCard.style.display = 'block';
        } catch (err) {
            showToast(err.message, true);
        } finally {
            btnSend.disabled = false;
            btnSend.innerText = 'Enviar Link de Recuperação';
        }
    });
}

if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        const btnUpdate = document.getElementById('btnUpdatePassword');

        if (newPassword !== confirmPassword) {
            showToast("As senhas não coincidem.", true);
            return;
        }

        btnUpdate.disabled = true;
        btnUpdate.innerText = 'Atualizando...';

        try {
            const { error } = await db.auth.updateUser({ password: newPassword });
            if (error) throw error;
            showToast("Senha atualizada com sucesso! Você já pode entrar.");
            resetPasswordView.style.display = 'none';
            loginCard.style.display = 'block';
            // Clear URL hash
            window.history.replaceState(null, null, window.location.pathname);
        } catch (err) {
            showToast(err.message, true);
        } finally {
            btnUpdate.disabled = false;
            btnUpdate.innerText = 'Atualizar Senha';
        }
    });
}

// Detect recovery flow from URL
db.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
        document.getElementById('loginView').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        loginCard.style.display = 'none';
        forgotPasswordView.style.display = 'none';
        resetPasswordView.style.display = 'block';
        if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }
});
// --- TENANT ADMIN LOGIC ---
if (userAdminForm) {
    userAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editAdminUserId').value;
        const email = document.getElementById('adminUserEmail').value.trim();
        const password = document.getElementById('adminUserPassword').value;
        const role = document.getElementById('adminUserRole').value;
        const btnSave = document.getElementById('btnSaveUserAdmin');

        if (!email || (!id && !password) || !role) {
            showToast("Preencha todos os campos obrigatórios.", true);
            return;
        }

        if (password && password.length < 6) {
            showToast("A senha deve ter no mínimo 6 caracteres.", true);
            return;
        }

        btnSave.disabled = true;
        btnSave.innerHTML = id ? '<i class="ri-loader-4-line ri-spin"></i> Atualizando...' : '<i class="ri-loader-4-line ri-spin"></i> Criando...';

        try {
            // Collect permissions
            const permissions = {};
            systemModules.forEach(mod => {
                const selectCheck = document.querySelector(`.perm-check[data-mod="${mod.id}"][data-action="select"]`);
                const insertCheck = document.querySelector(`.perm-check[data-mod="${mod.id}"][data-action="insert"]`);
                const updateCheck = document.querySelector(`.perm-check[data-mod="${mod.id}"][data-action="update"]`);
                const deleteCheck = document.querySelector(`.perm-check[data-mod="${mod.id}"][data-action="delete"]`);

                permissions[mod.id] = {
                    select: selectCheck ? selectCheck.checked : false,
                    insert: insertCheck ? insertCheck.checked : false,
                    update: updateCheck ? updateCheck.checked : false,
                    delete: deleteCheck ? deleteCheck.checked : false
                };
            });

            if (id) {
                // Update existing user permissions/role in our mapping table
                const { error: updateError } = await db.from('usuario_empresas')
                    .update({
                        perfil: role,
                        permissoes: permissions
                    })
                    .eq('id', id);
                if (updateError) throw updateError;

                showToast("Permissões do usuário atualizadas com sucesso!");
            } else {
                const { data: { session } } = await db.auth.getSession();
                if (!session) throw new Error("Sessão expirada.");

                // Call Edge Function for new user creation
                const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;

                // Determine which company ID to use
                let targetEmpresaId = currentEmpresaId;
                if (isSuperAdmin) {
                    const selectedCompany = document.getElementById('adminUserCompany').value;
                    if (selectedCompany) targetEmpresaId = selectedCompany;
                }

                const response = await fetch(`${baseUrl}/functions/v1/create-tenant-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        role: role,
                        empresa_id: targetEmpresaId,
                        permissoes: permissions
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    const errorMsg = result.error || result.message || "Erro desconhecido na nuvem.";
                    throw new Error(`Erro na nuvem: ${errorMsg}`);
                }

                showToast("Usuário criado e vinculado com sucesso!");
            }

            showList('usersAdmin');
        } catch (error) {
            console.error("Error saving tenant user:", error);
            showToast(error.message, true);
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="ri-save-line"></i> Salvar Usuário';
        }
    });
}

// Nav Users Admin Listeners
if (btnAddNewUser) btnAddNewUser.addEventListener('click', () => showForm(false, 'usersAdmin'));
if (btnCancelUserAdmin) btnCancelUserAdmin.addEventListener('click', () => showList('usersAdmin'));
if (btnBackUserAdmin) btnBackUserAdmin.addEventListener('click', () => showList('usersAdmin'));

// --- EMPRESAS CRUD LOGIC ---
if (btnAddNewEmpresa) btnAddNewEmpresa.addEventListener('click', () => showForm(false, 'empresas'));
if (btnBackEmpresa) btnBackEmpresa.addEventListener('click', () => showList('empresas'));
if (btnCancelEmpresa) btnCancelEmpresa.addEventListener('click', () => showList('empresas'));

if (empresaLogoFile) {
    empresaLogoFile.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                empresaLogoBase64.value = base64;
                logoPreviewContainer.innerHTML = `<img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

if (empresaForm) {
    empresaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldId = document.getElementById('editEmpresaOldId').value;
        const newId = document.getElementById('empresaId').value.trim();
        const nome = document.getElementById('empresaNome').value.trim();
        const logo = empresaLogoBase64.value;
        const btnSave = document.getElementById('btnSaveEmpresa');

        if (!newId || !nome) {
            showToast("ID e Nome são obrigatórios.", true);
            return;
        }

        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Salvando...';

        try {
            const supervisorPin = document.getElementById('empresaSupervisorPin').value;
            const empresaData = { id: newId, nome, logotipo: logo, supervisor_pin: supervisorPin };

            if (oldId && oldId !== newId) {
                // Changing ID is risky if there are foreign keys, but technically Empresas is the root
                // For safety, we warn or handle with a confirmation if it was a real production app.
                // Here we perform a delete + insert or a rename if Supabase supports it cleanly.
                // But Empresas usually don't change IDs. Let's assume standard upsert if ID is same.
            }

            const { error } = await db.from('empresas').upsert(empresaData);
            if (error) throw error;

            showToast("Empresa salva com sucesso!");
            showList('empresas');
        } catch (err) {
            console.error("Error saving empresa:", err);
            showToast(err.message, true);
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="ri-save-line"></i> Salvar Empresa';
        }
    });
}

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
                                            <button onclick="deleteEmpresa('${emp.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                                        </div>
                                    </td>
                                    `;
            tbody.appendChild(tr);
        });
    }
}

window.editEmpresa = function (id) {
    const emp = activeEmpresasList.find(x => x.id === id);
    if (!emp) return;
    showForm(true, 'empresas', emp);
};

window.deleteEmpresa = async function (id) {
    if (id === currentEmpresaId) {
        showToast("Você não pode excluir a empresa que está logado.", true);
        return;
    }
    if (!confirm("Tem certeza que deseja excluir esta empresa? Isso pode afetar todos os dados vinculados.")) return;

    try {
        const { error } = await db.from('empresas').delete().eq('id', id);
        if (error) throw error;
        showToast("Empresa excluída com sucesso.");
        fetchEmpresas();
    } catch (err) {
        showToast(err.message, true);
    }
};

// --- SERVICE PRINT LIST LOGIC ---
const btnPrintServiceList = document.getElementById('btnPrintServiceList');
const servicePrintFilterModal = document.getElementById('servicePrintFilterModal');
const btnCloseServicePrintModal = document.getElementById('btnCloseServicePrintModal');
const btnCancelServicePrint = document.getElementById('btnCancelServicePrint');
const btnConfirmServicePrint = document.getElementById('btnConfirmServicePrint');
const printFilterSubdivisao = document.getElementById('printFilterSubdivisao');

if (btnPrintServiceList) {
    btnPrintServiceList.addEventListener('click', () => {
        // Populate subdivisions from specialties
        if (printFilterSubdivisao) {
            printFilterSubdivisao.innerHTML = '<option value="">TODAS AS SUBDIVISÕES</option>';
            specialties.forEach(spec => {
                const subs = (typeof spec.subdivisoes === 'string') ? JSON.parse(spec.subdivisoes) : (spec.subdivisoes || []);
                subs.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.nome;
                    opt.textContent = `${spec.nome} - ${s.nome}`;
                    printFilterSubdivisao.appendChild(opt);
                });
            });
        }
        servicePrintFilterModal.classList.remove('hidden');
    });
}

if (btnCloseServicePrintModal) btnCloseServicePrintModal.addEventListener('click', () => servicePrintFilterModal.classList.add('hidden'));
if (btnCancelServicePrint) btnCancelServicePrint.addEventListener('click', () => servicePrintFilterModal.classList.add('hidden'));

if (btnConfirmServicePrint) {
    btnConfirmServicePrint.addEventListener('click', () => {
        const sub = printFilterSubdivisao.value;
        servicePrintFilterModal.classList.add('hidden');
        window.printServiceList(sub);
    });
}

// --- PRONTUÁRIO / PATIENT DETAILS LOGIC ---

async function showPatientDetails(id) {
    const patient = patients.find(p => p.id === id);
    if (!patient) return;

    // Store id so print/PDF buttons can access it
    window._currentPatientDetailId = id;

    // Switch views
    hideAllSections();
    const detailsView = document.getElementById('patientDetailsView');
    detailsView.classList.remove('hidden');

    // Set Header
    document.getElementById('detailsPatientName').innerText = patient.nome;

    // Fill General Tab
    document.getElementById('detCPF').innerText = patient.cpf || '-';
    document.getElementById('detNasc').innerText = patient.datanascimento ? formatDate(patient.datanascimento) : '-';
    document.getElementById('detCel').innerText = patient.celular || '-';
    document.getElementById('detEmail').innerText = patient.email || '-';
    document.getElementById('detEnd').innerText = `${patient.endereco || ''}, ${patient.numero || ''} - ${patient.bairro || ''}, ${patient.cidade || ''}/${patient.uf || ''}`;

    // Anamnese rendering
    const anamneseBody = document.getElementById('detAnamneseBody');
    const a = patient.anamnese || {};
    anamneseBody.innerHTML = `
                                    <p><strong>Em tratamento médico?</strong> ${a.emTratamentoMedico ? 'Sim (' + (a.tratamentoDesc || '') + ')' : 'Não'}</p>
                                    <p><strong>Toma medicação?</strong> ${a.tomaMedicacao ? 'Sim (' + (a.medicacaoDesc || '') + ')' : 'Não'}</p>
                                    <p><strong>Tem alergia?</strong> ${a.temAlergia ? 'Sim (' + (a.alergiaDesc || '') + ')' : 'Não'}</p>
                                    <p><strong>Teve hemorragia?</strong> ${a.teveHemorragia ? 'Sim' : 'Não'}</p>
                                    <p><strong>Doenças preexistentes:</strong> ${a.doencasPreexistentes || 'Nenhuma informada'}</p>
                                    `;

    // Reset Tabs to Geral
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="tabGeral"]').classList.add('active');
    document.getElementById('tabGeral').classList.add('active');

    // Load Evolution Timeline
    loadEvolution(id);

    // Load Budgets for this patient
    renderPatientBudgets(id);

    // Load Financial Statement for this patient
    renderPatientFinanceiro(id);

    // Load Documents
    loadPatientDocuments(id);
}

// Financeiro / Extrato tab
async function renderPatientFinanceiro(patientId) {
    const body = document.getElementById('detFinanceiroBody');
    if (!body) return;

    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Carregando extrato...</td></tr>';

    try {
        // Obter objeto do paciente para cruzar IDs (UUID ou SeqID)
        const pat = patients.find(p => String(p.id) === String(patientId) || String(p.seqid) === String(patientId));
        if (!pat) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 20px;">Paciente não encontrado.</td></tr>';
            return;
        }

        // Buscar transações vinculadas a este paciente (por ID numérico paciente_id)
        // Observação: incluímos registros legados com empresa_id NULL para não "sumirem" após migrações.
        let query = db.from('financeiro_transacoes')
            .select('*')
            .eq('paciente_id', pat.seqid) // Usa o seqid numérico que é o padrão desta tabela
            .order('data_transacao', { ascending: false });

        if (currentEmpresaId) {
            query = query.or(`empresa_id.eq.${currentEmpresaId},empresa_id.is.null`);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 20px;">Nenhuma movimentação financeira encontrada para este paciente.</td></tr>';
            return;
        }

        body.innerHTML = data.map(t => {
            const tipoUpper = (t.tipo || '').toUpperCase();
            const isCredit = tipoUpper === 'CREDITO' || tipoUpper === 'RECEITA' || tipoUpper === 'CRÉDITO';
            const typeClass = isCredit ? 'success-color' : 'danger-color';
            const typeIcon = isCredit ? 'ri-arrow-up-circle-line' : 'ri-arrow-down-circle-line';

            return `
                <tr>
                    <td>${formatDateTime(t.data_transacao)}</td>
                    <td><span class="badge badge-info">${t.categoria || 'Geral'}</span></td>
                    <td>${t.forma_pagamento || '-'}</td>
                    <td style="text-align: right;"><strong>R$ ${(parseFloat(t.valor) || 0).toFixed(2)}</strong></td>
                    <td style="text-align: center; color: var(--${typeClass});">
                        <i class="${typeIcon}"></i> ${t.tipo}
                    </td>
                    <td style="font-size: 0.85rem; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.observacoes || ''}">
                        ${t.observacoes || '-'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Erro ao carregar extrato do paciente:", err);
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--danger-color); padding: 20px;">Erro ao carregar o extrato financeiro.</td></tr>';
    }
}

// Helper to Hide All Sections (improved)
function hideAllSections() {
    const sections = ['patientListView', 'patientFormView', 'professionalListView', 'professionalFormView',
        'specialtiesListView', 'specialtyFormView', 'servicesListView', 'serviceFormView',
        'budgetsListView', 'budgetFormView', 'usersAdminView', 'userAdminFormView',
        'empresasListView', 'empresasFormView', 'dashboardView', 'financeiroView', 'commissionsView', 'atendimentoView', 'agendaView', 'cancelledBudgetsView', 'patientDetailsView'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');

        // Update Buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update Content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(target).classList.add('active');
    });
});

async function loadEvolution(patientId) {
    const timeline = document.getElementById('evolutionTimeline');
    timeline.innerHTML = '<p style="text-align:center; padding: 2rem;">Carregando prontuário...</p>';

    try {
        const { data, error } = await db.from('paciente_evolucao')
            .select('*, profissionais(nome)')
            .eq('paciente_id', patientId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            timeline.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma anotação neste prontuário.</p>';
            return;
        }

        timeline.innerHTML = data.map(ev => `
                                    <div class="evolution-item">
                                        <div class="evol-meta">
                                            <div><i class="ri-calendar-line"></i> ${escapeHtml(formatDateTime(ev.created_at))}</div>
                                            <div><i class="ri-user-smile-line"></i> Profissional: <strong>${escapeHtml(ev.profissionais?.nome || 'Não informado')}</strong></div>
                                        </div>
                                        <div class="evol-content">
                                            ${ev.dente_regiao ? `<p style="margin-bottom:0.5rem;"><strong>Dente/Região:</strong> ${ev.dente_regiao}</p>` : ''}
                                            <div class="evol-desc">${escapeHtml(String(ev.descricao || '')).replace(/\n/g, '<br>')}</div>
                                        </div>
                                        <div class="evol-footer">
                                            <span>IP: ${ev.user_ip || 'Auditado'}</span>
                                            <span>ID: ${ev.id.substring(0, 8)}</span>
                                        </div>
                                    </div>
                                    `).join('');
    } catch (err) {
        console.error("Erro ao carregar evolução:", err);
        timeline.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar prontuário.</p>';
    }
}

// New Evolution Logic
const btnNewEvolution = document.getElementById('btnNewEvolution');
const newEvolutionForm = document.getElementById('newEvolutionForm');
const btnCancelEvolution = document.getElementById('btnCancelEvolution');
const btnSaveEvolution = document.getElementById('btnSaveEvolution');

btnNewEvolution.addEventListener('click', () => {
    newEvolutionForm.classList.toggle('hidden');
    // Populate professionals dropdown
    const profSelect = document.getElementById('evolProfissional');
    profSelect.innerHTML = '<option value="">Selecione o Profissional Responsible...</option>';
    professionals.filter(p => p.status === 'Ativo').forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nome;
        profSelect.appendChild(opt);
    });
});

btnCancelEvolution.addEventListener('click', () => {
    newEvolutionForm.classList.add('hidden');
    document.getElementById('evolDescricao').value = '';
    document.getElementById('evolDente').value = '';
});

btnSaveEvolution.addEventListener('click', async () => {
    const desc = document.getElementById('evolDescricao').value.trim();
    const profId = document.getElementById('evolProfissional').value;
    const dente = document.getElementById('evolDente').value.trim();
    const patientName = document.getElementById('detailsPatientName').innerText;

    // Find patient ID (we are in details view, so we need the current patient)
    // A better way is to store currentPatientId globally
    const patientId = patients.find(p => p.nome === patientName)?.id;

    if (!desc || !profId || !patientId) {
        showToast("Preencha a descrição e selecione o profissional.", true);
        return;
    }

    try {
        const entry = {
            paciente_id: patientId,
            profissional_id: profId,
            descricao: desc,
            dente_regiao: dente,
            empresa_id: currentEmpresaId,
            created_by: (await db.auth.getUser()).data.user?.id
        };

        const { error } = await db.from('paciente_evolucao').insert(entry);
        if (error) throw error;

        showToast("Anotação gravada com sucesso!");
        btnCancelEvolution.click();
        loadEvolution(patientId);
    } catch (err) {
        console.error("Erro ao salvar evolução:", err);
        showToast("Erro ao gravar no prontuário.", true);
    }
});

// Back buttons logic
document.getElementById('btnBackDetails')?.addEventListener('click', () => returnFromPatientDetails());

// Helper Formatting
function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR');
}

function formatDate(isoString) {
    if (!isoString) return '-';
    const [year, month, day] = isoString.split('-');
    return `${day}/${month}/${year}`;
}

// Orçamentos tab
function renderPatientBudgets(patientId) {
    const body = document.getElementById('detOrcamentosBody');
    if (!body) return;

    // Buscar o objeto do paciente para ter o nome como fallback
    const patObj = patients.find(p => String(p.id) === String(patientId) || String(p.seqid) === String(patientId));
    const patName = patObj ? patObj.nome : null;

    const filtered = budgets.filter(b => {
        const bPacId = b.pacienteid || b.paciente_id || b.pacienteseqid;

        // 1. Comparação Direta de ID (Robustas)
        if (bPacId && patientId && String(bPacId).trim() === String(patientId).trim()) return true;

        // 2. Fallback por Nome (Útil para registros migrados ou inconsistencies de ID)
        if (patName && b.pacientenome && b.pacientenome.trim().toLowerCase() === patName.trim().toLowerCase()) return true;

        return false;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 20px;">Nenhum orçamento para este paciente.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(b => {
        try {
            const prof = professionals.find(p => String(p.id) === String(b.profissional_id) || String(p.seqid) === String(b.profissional_id));
            const profNome = prof ? prof.nome : 'Não informado';
            const total = calculateBudgetTotal(b);
            const status = b.status || 'Pendente';

            return `
                <tr>
                    <td>${formatDateTime(b.created_at)}</td>
                    <td>${profNome}</td>
                    <td><span class="badge badge-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td>
                    <td><strong>R$ ${total.toFixed(2)}</strong></td>
                    <td style="text-align:center;">
                        <button class="btn-icon" onclick="viewBudgetFromPatient('${b.id}')" title="Ver Orçamento">
                            <i class="ri-eye-line"></i><span>Ver</span>
                        </button>
                    </td>
                </tr>
            `;
        } catch (err) {
            console.warn("Erro ao renderizar linha de orçamento:", err, b);
            return '<tr><td colspan="5">Erro ao processar dados deste orçamento.</td></tr>';
        }
    }).join('');
}

window.viewBudgetFromPatient = function (budgetId) {
    const b = budgets.find(bud => bud.id === budgetId);
    if (!b) return;

    const modal = document.getElementById('budgetDetailModal');
    const body = document.getElementById('budgetDetailBody');
    const title = document.getElementById('budgetDetailTitle');

    const prof = professionals.find(p => p.id === b.profissional_id);
    const profNome = prof ? prof.nome : 'Não informado';
    const total = calculateBudgetTotal(b);

    title.textContent = `Orçamento #${b.seqid || budgetId.slice(0, 8)} — ${b.pacientenome || ''}`;

    // Build items HTML
    const itensHtml = (b.orcamento_itens || []).length === 0
        ? '<p style="color:var(--text-muted); text-align:center;">Sem itens</p>'
        : `<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
                <tr style="background:var(--bg-color); border-bottom: 2px solid var(--border-color);">
                    <th style="padding:8px; text-align:left;">Serviço</th>
                    <th style="padding:8px;">Qtde</th>
                    <th style="padding:8px;">Valor Un.</th>
                    <th style="padding:8px;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${(b.orcamento_itens || []).map(item => {
            const serv = services.find(s => s.id === item.servico_id);
            const desc = serv ? serv.descricao : (item.descricao || 'Serviço desconhecido');
            const sub = (Number(item.valor) * Number(item.qtde || 1));
            return `<tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding:8px;">${desc}</td>
                        <td style="padding:8px; text-align:center;">${item.qtde || 1}</td>
                        <td style="padding:8px; text-align:right;">R$ ${Number(item.valor).toFixed(2)}</td>
                        <td style="padding:8px; text-align:right; font-weight:600;">R$ ${sub.toFixed(2)}</td>
                    </tr>`;
        }).join('')}
            </tbody>
           </table>`;

    body.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
            <div style="background:var(--bg-color); padding:1rem; border-radius:var(--border-radius); border:1px solid var(--border-color);">
                <p style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Profissional Responsável</p>
                <p style="font-weight:600;">${profNome}</p>
            </div>
            <div style="background:var(--bg-color); padding:1rem; border-radius:var(--border-radius); border:1px solid var(--border-color);">
                <p style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Status</p>
                <span class="badge badge-${(b.status || 'pendente').toLowerCase()}">${b.status || 'Pendente'}</span>
            </div>
            <div style="background:var(--bg-color); padding:1rem; border-radius:var(--border-radius); border:1px solid var(--border-color);">
                <p style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Data</p>
                <p style="font-weight:600;">${formatDateTime(b.created_at)}</p>
            </div>
            <div style="background:var(--primary-color); padding:1rem; border-radius:var(--border-radius);">
                <p style="font-size:0.75rem; color:rgba(255,255,255,0.7); text-transform:uppercase; margin-bottom:6px;">Total do Orçamento</p>
                <p style="font-weight:700; font-size:1.2rem; color:#fff;">R$ ${total.toFixed(2)}</p>
            </div>
        </div>
        <div style="border-top: 2px solid var(--border-color); padding-top: 1rem;">
            <h4 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.75rem;">Itens do Orçamento</h4>
            ${itensHtml}
        </div>
    `;

    modal.classList.remove('hidden');
};

// Modal close listeners
(function () {
    const modal = document.getElementById('budgetDetailModal');
    if (!modal) return;

    const closeModal = () => modal.classList.add('hidden');

    document.getElementById('btnCloseBudgetDetail').addEventListener('click', closeModal);
    document.getElementById('btnCloseBudgetDetail2').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
})();

function calculateBudgetTotal(budget) {
    if (!budget.orcamento_itens) return 0;
    return budget.orcamento_itens.reduce((acc, item) => acc + (Number(item.valor) * Number(item.qtde || 1)), 0);
}

function getBudgetPaidAmount(budget) {
    return (parseFloat(budget && budget.total_pago) || 0) + (parseFloat(budget && budget.total_pago_financeiro_extra) || 0);
}

async function attachFinanceExtraPaymentsToBudgets(budgetsList, paymentsList) {
    if (!currentEmpresaId || !Array.isArray(budgetsList) || budgetsList.length === 0) return;

    const seqids = budgetsList
        .map(b => Number(b && b.seqid))
        .filter(n => Number.isFinite(n) && n > 0);
    if (seqids.length === 0) return;

    const budgetSet = new Set(seqids.map(n => String(n)));

    const existingKeys = new Map();
    (paymentsList || []).forEach(p => {
        const seq = Number(p && p.orcamento_id);
        if (!Number.isFinite(seq) || seq <= 0) return;
        const v = Number(p && p.valor_pago).toFixed(2);
        const f = normalizeKey(p && p.forma_pagamento);
        const d = String((p && (p.data_pagamento || p.criado_em || p.data)) || '').slice(0, 16);
        const k = String(seq);
        if (!existingKeys.has(k)) existingKeys.set(k, new Set());
        existingKeys.get(k).add(`${v}|${f}|${d}`);
    });

    const financeRows = new Map();
    const chunks = [];
    for (let i = 0; i < seqids.length; i += 120) chunks.push(seqids.slice(i, i + 120));

    for (const chunk of chunks) {
        const inList = chunk.join(',');
        const baseSelect = 'id,valor,forma_pagamento,data_transacao,observacoes,referencia_id';
        const qRef = await withTimeout(
            db.from('financeiro_transacoes')
                .select(baseSelect)
                .eq('empresa_id', currentEmpresaId)
                .eq('categoria', 'PAGAMENTO')
                .eq('tipo', 'CREDITO')
                .in('referencia_id', chunk),
            15000,
            'financeiro_transacoes:budget_ref_chunk'
        );
        if (!qRef.error) (qRef.data || []).forEach(r => financeRows.set(String(r.id), r));
    }

    const qObs = await withTimeout(
        db.from('financeiro_transacoes')
            .select('id,valor,forma_pagamento,data_transacao,observacoes,referencia_id')
            .eq('empresa_id', currentEmpresaId)
            .eq('categoria', 'PAGAMENTO')
            .eq('tipo', 'CREDITO')
            .ilike('observacoes', '%Orçamento #%')
            .order('data_transacao', { ascending: false })
            .limit(2000),
        15000,
        'financeiro_transacoes:budget_obs'
    );
    if (!qObs.error) (qObs.data || []).forEach(r => financeRows.set(String(r.id), r));

    const extraSum = new Map();
    const extrasBySeq = new Map();
    const rx = /#\s*(\d{1,9})/;
    for (const r of financeRows.values()) {
        let seq = Number(r && r.referencia_id);
        if (!Number.isFinite(seq) || seq <= 0) {
            const m = String(r && r.observacoes || '').match(rx);
            seq = m ? Number(m[1]) : NaN;
        }
        if (!Number.isFinite(seq) || seq <= 0) continue;
        const kSeq = String(seq);
        if (!budgetSet.has(kSeq)) continue;

        const v = Number(r && r.valor).toFixed(2);
        const f = normalizeKey(r && r.forma_pagamento);
        const d = String(r && r.data_transacao || '').slice(0, 16);
        const key = `${v}|${f}|${d}`;
        const exSet = existingKeys.get(kSeq);
        if (exSet && exSet.has(key)) continue;

        const curr = extraSum.get(kSeq) || 0;
        extraSum.set(kSeq, curr + (parseFloat(r.valor) || 0));
        if (!extrasBySeq.has(kSeq)) extrasBySeq.set(kSeq, []);
        extrasBySeq.get(kSeq).push(r);
    }

    budgetsList.forEach(b => {
        const k = String(Number(b && b.seqid));
        b.total_pago_financeiro_extra = extraSum.get(k) || 0;
        b.pagamentos_financeiro_extra = extrasBySeq.get(k) || [];
    });
}

// Documents placeholder (future expansion)
async function loadPatientDocuments(patientId) {
    const grid = document.getElementById('detDocsGrid');
    grid.innerHTML = '<p style="text-align:center; width:100%; color: var(--text-muted);">Módulo de documentos (TCLE) pronto para receber uploads.</p>';
}

// =============================================
//  PATIENT DETAIL REPORT — Print / Export PDF
// =============================================
async function printPatientDetailReport(saveAsPdf = false) {
    const patientId = window._currentPatientDetailId;
    if (!patientId) { showToast('Nenhum paciente selecionado.', true); return; }

    const patient = patients.find(p => p.id === patientId);
    if (!patient) { showToast('Paciente não encontrado.', true); return; }

    showToast('Gerando relatório...', false);

    // Fetch evolution from Supabase
    let evolutionItems = [];
    try {
        const { data } = await db.from('paciente_evolucao')
            .select('*, profissionais(nome)')
            .eq('paciente_id', patientId)
            .order('created_at', { ascending: false });
        evolutionItems = data || [];
    } catch (_) { /* continue without evolution */ }

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const a = patient.anamnese || {};
    const patientBudgets = budgets.filter(b => b.pacienteid === patientId);

    // ---- Anamnese section ----
    // 4 boolean fields horizontal, 'Doenças preexistentes' full-width below
    const boolCard = (label, val) => `
        <div style="flex:1; min-width:130px; background:#f9fafb; border:1px solid #e5e7eb; border-left:3px solid ${val.startsWith('Sim') ? '#dc2626' : '#16a34a'}; border-radius:6px; padding:8px 12px;">
            <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#9ca3af; letter-spacing:0.04em; margin-bottom:4px;">${label}</div>
            <div style="font-size:13px; font-weight:600; color:${val.startsWith('Sim') ? '#dc2626' : '#16a34a'};">${val}</div>
            ${val.includes('—') ? `<div style="font-size:11px; color:#6b7280; margin-top:2px;">${val.split('—')[1].trim()}</div>` : ''}
        </div>`;

    const anamneseHtml = `
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            ${boolCard('Em tratamento médico?', a.emTratamentoMedico ? 'Sim' + (a.tratamentoDesc ? ' — ' + a.tratamentoDesc : '') : 'Não')}
            ${boolCard('Toma medicação?', a.tomaMedicacao ? 'Sim' + (a.medicacaoDesc ? ' — ' + a.medicacaoDesc : '') : 'Não')}
            ${boolCard('Tem alergia?', a.temAlergia ? 'Sim' + (a.alergiaDesc ? ' — ' + a.alergiaDesc : '') : 'Não')}
            ${boolCard('Teve hemorragia?', a.teveHemorragia ? 'Sim' : 'Não')}
        </div>
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-left:3px solid #0066cc; border-radius:6px; padding:8px 12px;">
            <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#9ca3af; margin-bottom:4px;">Doenças Preexistentes / Observações</div>
            <div style="font-size:13px; color:#1f2937;">${a.doencasPreexistentes || 'Nenhuma informada'}</div>
        </div>`;

    // ---- Evolution rows ----
    const evolutionHtml = evolutionItems.length === 0
        ? '<p style="color:#9ca3af; padding:10px 0;">Nenhuma anotação registrada.</p>'
        : evolutionItems.map(ev => `
        <div style="border-left:3px solid #0066cc; padding:10px 16px; margin-bottom:14px; background:#fafafa; border-radius:0 6px 6px 0;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#6b7280; margin-bottom:6px;">
                <span>📅 ${formatDateTime(ev.created_at)}</span>
                <span>👤 ${ev.profissionais?.nome || 'Não informado'}</span>
            </div>
            ${ev.dente_regiao ? `<p style="font-size:12px; margin-bottom:4px;"><strong>Dente/Região:</strong> ${ev.dente_regiao}</p>` : ''}
            <p style="font-size:13px; color:#1f2937; white-space:pre-wrap;">${ev.descricao}</p>
        </div>`).join('');
    // Fetch financial transactions from Supabase
    let financialItems = [];
    try {
        const { data: finData } = await db.from('financeiro_transacoes')
            .select('*')
            .eq('paciente_id', patient.seqid || patient.id)
            .eq('empresa_id', currentEmpresaId)
            .order('data_transacao', { ascending: false });
        financialItems = finData || [];
    } catch (_) { /* continue without finance */ }

    // ---- Budgets table ----
    const budgetsHtml = patientBudgets.length === 0
        ? '<p style="color:#9ca3af; padding:10px 0;">Nenhum orçamento vinculado.</p>'
        : patientBudgets.map(b => {
            const prof = professionals.find(p => p.id === b.profissional_id);
            const total = calculateBudgetTotal(b);
            const itens = (b.orcamento_itens || []).map(item => {
                const serv = services.find(s => s.id === item.servico_id);
                const desc = serv ? serv.descricao : 'Serviço desconhecido';
                return `<tr>
                    <td style="padding:5px 8px; border-bottom:1px solid #e5e7eb;">${desc}</td>
                    <td style="padding:5px 8px; border-bottom:1px solid #e5e7eb; text-align:center;">${item.qtde || 1}</td>
                    <td style="padding:5px 8px; border-bottom:1px solid #e5e7eb; text-align:right;">R$ ${Number(item.valor).toFixed(2)}</td>
                    <td style="padding:5px 8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">R$ ${(Number(item.valor) * Number(item.qtde || 1)).toFixed(2)}</td>
                </tr>`;
            }).join('');
            return `
            <div style="margin-bottom:20px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
                <div style="background:#0066cc; color:white; padding:8px 14px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:700;">Orçamento #${b.seqid || b.id.slice(0, 8)}</span>
                    <span style="font-size:12px; background:rgba(255,255,255,0.2); padding:2px 10px; border-radius:20px;">${b.status || 'Pendente'}</span>
                </div>
                <div style="padding:10px 14px; font-size:12px; color:#6b7280; display:flex; gap:20px; background:#f9fafb; border-bottom:1px solid #e5e7eb;">
                    <span><strong>Data:</strong> ${formatDateTime(b.created_at)}</span>
                    <span><strong>Profissional:</strong> ${prof ? prof.nome : 'Não informado'}</span>
                    <span style="margin-left:auto; font-weight:700; color:#0066cc; font-size:14px;">Total: R$ ${total.toFixed(2)}</span>
                </div>
                ${itens.length > 0 ? `
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:6px 8px; text-align:left; color:#6b7280; font-size:11px;">Serviço</th>
                            <th style="padding:6px 8px; text-align:center; color:#6b7280; font-size:11px;">Qtde</th>
                            <th style="padding:6px 8px; text-align:right; color:#6b7280; font-size:11px;">Valor Un.</th>
                            <th style="padding:6px 8px; text-align:right; color:#6b7280; font-size:11px;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${itens}</tbody>
                </table>` : '<p style="padding:10px 14px; color:#9ca3af; font-size:12px;">Sem itens.</p>'}
            </div>`;
        }).join('');

    // ---- Financial table ----
    const financeHtml = financialItems.length === 0
        ? '<p style="color:#9ca3af; padding:10px 0;">Nenhum lançamento financeiro registrado.</p>'
        : `
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead>
                <tr style="background:#f3f4f6; border-bottom:2px solid #e5e7eb;">
                    <th style="padding:8px; text-align:left; color:#6b7280;">Data</th>
                    <th style="padding:8px; text-align:left; color:#6b7280;">Categoria</th>
                    <th style="padding:8px; text-align:left; color:#6b7280;">Forma</th>
                    <th style="padding:8px; text-align:right; color:#6b7280;">Valor</th>
                    <th style="padding:8px; text-align:center; color:#6b7280;">Tipo</th>
                    <th style="padding:8px; text-align:left; color:#6b7280; width:35%;">Observação</th>
                </tr>
            </thead>
            <tbody>
                ${financialItems.map(t => {
            const isCredito = t.tipo === 'CREDITO';
            const color = isCredito ? '#16a34a' : '#dc2626';
            return `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${formatDateTime(t.data_transacao)}</td>
                        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${t.categoria}</td>
                        <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${t.forma_pagamento || '—'}</td>
                        <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:700; color:${color};">
                            R$ ${Number(t.valor).toFixed(2)}
                        </td>
                        <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:center;">
                            <span style="background:${isCredito ? '#ecfdf5' : '#fef2f2'}; color:${color}; padding:2px 8px; border-radius:4px; font-weight:700; font-size:9px;">
                                ${t.tipo}
                            </span>
                        </td>
                        <td style="padding:8px; border-bottom:1px solid #e5e7eb; color:#4b5563; font-style:italic;">${t.observacoes || ''}</td>
                    </tr>`;
        }).join('')}
            </tbody>
        </table>`;

    // ---- Full HTML report ----
    const enderecoFull = [patient.endereco, patient.numero, patient.bairro, patient.cidade, patient.uf]
        .filter(Boolean).join(', ');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Ficha Clínica — ${patient.nome}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size:13px; color:#1f2937; background:#fff; }
        .page { max-width:900px; margin:0 auto; padding:32px; }

        /* Header */
        .report-header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; margin-bottom:24px; border-bottom:3px solid #0066cc; }
        .clinic-info .clinic-name { font-size:22px; font-weight:800; color:#0066cc; letter-spacing:-0.5px; }
        .clinic-info .subtitle { font-size:11px; color:#9ca3af; margin-top:2px; }
        .report-meta { text-align:right; }
        .report-meta .doc-type { font-size:15px; font-weight:700; color:#374151; }
        .report-meta .report-date { font-size:11px; color:#9ca3af; margin-top:3px; }

        /* Patient banner */
        .patient-banner { background:linear-gradient(135deg, #0066cc 0%, #004c99 100%); color:white; border-radius:10px; padding:18px 24px; margin-bottom:24px; display:flex; align-items:center; gap:20px; }
        .patient-avatar { width:60px; height:60px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; flex-shrink:0; }
        .patient-name { font-size:20px; font-weight:700; }
        .patient-id { font-size:12px; opacity:0.8; margin-top:2px; }

        /* Section blocks */
        .section { margin-bottom:28px; }
        .section-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .section-icon { width:32px; height:32px; background:#eff6ff; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
        .section-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#0066cc; }
        .section-line { flex:1; height:1px; background:#e5e7eb; }

        /* Contact grid */
        .contact-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
        .contact-card { background:#f9fafb; border:1px solid #e5e7eb; border-left:3px solid #0066cc; border-radius:6px; padding:8px 12px; }
        .contact-card .lbl { font-size:10px; font-weight:700; text-transform:uppercase; color:#9ca3af; letter-spacing:0.05em; }
        .contact-card .val { font-size:13px; font-weight:600; color:#1f2937; margin-top:2px; }
        .span-full { grid-column: 1 / -1; }

        /* Footer */
        .report-footer { margin-top:40px; padding-top:14px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10px; color:#9ca3af; }

        /* thead repeating header — only shows in print */
        thead.print-thead { display: none; }

        @media print {
            @page {
                margin: 20px 20px 40px 20px;
                /* Page number footer — Chrome 128+, Firefox, Edge */
                @bottom-left {
                    content: "Prontu\u00e1rio.io - Ficha Cl\u00ednica";
                    font-size: 10px;
                    color: #9ca3af;
                    font-family: Arial, sans-serif;
                }
                @bottom-right {
                    content: "Pagina " counter(page) " / " counter(pages);
                    font-size: 10px;
                    color: #9ca3af;
                    font-family: Arial, sans-serif;
                }
            }
            .page { padding: 0; max-width: 100%; }
            body { font-size: 12px; }
            .patient-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .contact-grid { grid-template-columns: repeat(4, 1fr); }

            /* The browser repeats thead on every printed page natively */
            thead.print-thead {
                display: table-header-group !important;
            }
            thead.print-thead td {
                background: #0066cc;
                color: white;
                padding: 10px 24px;
                font-size: 12px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .ph-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
            }
            .ph-clinic  { font-weight: 700; font-size: 14px; }
            .ph-patient { font-size: 11px; opacity: 0.85; }
            .ph-date    { font-size: 10px; opacity: 0.7; }
        }
    </style>
</head>
<body>
<div class="page">

<!-- Wrapping table: thead repeats on every printed page natively -->
<table style="width:100%; border-collapse:collapse;">
<thead class="print-thead">
  <tr>
    <td>
      <div class="ph-row">
        <span class="ph-clinic">🦷 Prontuári.io</span>
        <span class="ph-patient">FICHA CLÍNICA — ${patient.nome}</span>
        <span class="ph-date">Gerado em ${hoje}</span>
      </div>
    </td>
  </tr>
</thead>
<tfoot class="print-tfoot">
  <tr>
    <td style="padding:8px 24px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af;">
      <div style="display:flex; justify-content:space-between;">
        <span>🦷 Prontuári.io — Documento gerado automaticamente em ${hoje}</span>
        <span>Paciente ID: ${patient.seqid || patient.id.slice(0, 8)}</span>
      </div>
    </td>
  </tr>
</tfoot>
<tbody>
<tr><td>

    <!-- Header visible on screen only -->
    <div class="report-header">
        <div class="clinic-info">
            <div class="clinic-name">🦷 Prontuári.io</div>
            <div class="subtitle">Sistema de Gestão de Clínica Odontológica</div>
        </div>
        <div class="report-meta">
            <div class="doc-type">FICHA CLÍNICA DO PACIENTE</div>
            <div class="report-date">Gerado em ${hoje}</div>
        </div>
    </div>

    <!-- Patient Banner -->
    <div class="patient-banner">
        <div class="patient-avatar">${patient.nome.charAt(0).toUpperCase()}</div>
        <div>
            <div class="patient-name">${patient.nome}</div>
            <div class="patient-id">ID ${patient.seqid || patient.id.slice(0, 8)} · CPF: ${patient.cpf || 'Não informado'}</div>
        </div>
    </div>

    <!-- Section: Contact -->
    <div class="section">
        <div class="section-header">
            <div class="section-icon">📋</div>
            <div class="section-title">Informações de Contato</div>
            <div class="section-line"></div>
        </div>
        <div class="contact-grid">
            <div class="contact-card">
                <div class="lbl">Data de Nascimento</div>
                <div class="val">${patient.datanascimento ? formatDate(patient.datanascimento) : '—'}</div>
            </div>
            <div class="contact-card">
                <div class="lbl">Celular</div>
                <div class="val">${patient.celular || '—'}</div>
            </div>
            <div class="contact-card">
                <div class="lbl">E-mail</div>
                <div class="val">${patient.email || '—'}</div>
            </div>
            <div class="contact-card">
                <div class="lbl">Status</div>
                <div class="val" style="color:#16a34a;">● Ativo</div>
            </div>
            <div class="contact-card span-full">
                <div class="lbl">Endereço Completo</div>
                <div class="val">${enderecoFull || '—'}</div>
            </div>
        </div>
    </div>

    <!-- Section: Anamnese -->
    <div class="section">
        <div class="section-header">
            <div class="section-icon">❤️</div>
            <div class="section-title">Anamnese Clínica</div>
            <div class="section-line"></div>
        </div>
        ${anamneseHtml}
    </div>

    <!-- Section: Evolution -->
    <div class="section">
        <div class="section-header">
            <div class="section-icon">📝</div>
            <div class="section-title">Histórico de Evolução Clínica (Prontuário)</div>
            <div class="section-line"></div>
        </div>
        ${evolutionHtml}
    </div>

    <!-- Section: Budgets -->
    <div class="section">
        <div class="section-header">
            <div class="section-icon">💰</div>
            <div class="section-title">Orçamentos</div>
            <div class="section-line"></div>
        </div>
        ${budgetsHtml}
    </div>

    <!-- Section: Finance -->
    <div class="section">
        <div class="section-header">
            <div class="section-icon">💵</div>
            <div class="section-title">Histórico Financeiro / Extrato</div>
            <div class="section-line"></div>
        </div>
        ${financeHtml}
    </div>

    <!-- Footer -->
    <div class="report-footer">
        <span>Documento gerado automaticamente pelo sistema em ${hoje}. Não requer assinatura eletrônica.</span>
        <span>Paciente ID: ${patient.seqid || patient.id.slice(0, 8)}</span>
    </div>

</td></tr>
</tbody>
</table>

</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) { showToast('Habilite pop-ups para gerar o relatório.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
}

// Hook up Print and Export PDF buttons for patient detail
(function () {
    const btnPDF = document.getElementById('btnExportPDF');
    if (btnPDF) btnPDF.addEventListener('click', () => printPatientDetailReport());
})();

// =============================================
//  FINANCEIRO MODULE — TRANSACTIONS & WALLET
// =============================================

async function fetchTransactions(patientId = null) {
    try {
        if (finTransacoesBody) {
            finTransacoesBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (window.__dpDebug) window.__dpDebug.lastStep = 'financeiro: start';

        let query = db.from('financeiro_transacoes')
            .select('*')
            .order('data_transacao', { ascending: false });

        if (!isSuperAdmin && currentEmpresaId) {
            query = query.eq('empresa_id', currentEmpresaId);
        }

        if (patientId) {
            query = query.eq('paciente_id', patientId);
        }
        if (window.__dpDebug) window.__dpDebug.lastStep = 'financeiro: querying';

        const { data, error } = await withTimeout(query, 15000, 'financeiro_transacoes');
        if (error) throw error;
        if (window.__dpDebug) {
            window.__dpDebug.lastDataLen = Array.isArray(data) ? data.length : (data ? 1 : 0);
            window.__dpDebug.lastStep = 'financeiro: got response';
        }

        if (!data || data.length === 0) {
            transactions = [];
            financeSelectedPatientId = patientId ? patientId : null;
            renderTable([], 'financeiro');
            if (window.__dpDebug) {
                const body = document.getElementById('finTransacoesBody');
                window.__dpDebug.lastRenderRows = body ? body.children.length : null;
                window.__dpDebug.lastStep = 'financeiro: rendered empty';
            }
            if (patientId) {
                updateBalanceUI(patientId);
                showToast('Nenhum lançamento encontrado para este paciente.', true);
            } else {
                showToast(`Nenhum lançamento encontrado para a unidade [${currentEmpresaId || '-'}].`, true);
            }
            return;
        }

        // Flatten patient name for rendering (sem depender de FK name do Supabase)
        transactions = (data || []).map(t => {
            const pat = patients.find(p => String(p.seqid) === String(t.paciente_id));
            return {
                ...t,
                paciente_nome: pat ? pat.nome : '—'
            };
        });
        if (!patientId) financeAllTransactions = transactions.slice();
        financeSelectedPatientId = patientId ? patientId : null;

        renderTable(transactions, 'financeiro');
        if (window.__dpDebug) {
            const body = document.getElementById('finTransacoesBody');
            window.__dpDebug.lastRenderRows = body ? body.children.length : null;
            window.__dpDebug.lastStep = 'financeiro: rendered';
        }

        if (patientId) {
            updateBalanceUI(patientId);
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
        showToast(`Erro ao carregar transações (financeiro_transacoes): ${error.code || '-'} / ${error.message || 'Erro desconhecido'}`, true);
    } finally {
        clearLoadTimer('financeiro');
    }
}

async function updateBalanceUI(patientId) {
    try {
        const { data, error } = await db.from('view_saldo_paciente')
            .select('*')
            .eq('paciente_id', patientId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"

        const balance = data ? Number(data.saldo_atual) : 0;
        const patient = patients.find(p => p.seqid == patientId || p.id == patientId);

        if (finNomePaciente) finNomePaciente.textContent = patient ? patient.nome : 'Paciente selecionado';
        if (finSaldoPaciente) {
            finSaldoPaciente.textContent = balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            finSaldoPaciente.style.color = balance >= 0 ? 'var(--success-color)' : '#dc3545';
        }
        if (finPainelSaldo) finPainelSaldo.classList.remove('hidden');
    } catch (error) {
        console.error("Error updating balance UI:", error);
    }
}

async function deleteTransaction(id) {
    if (!can('financeiro', 'delete')) {
        showToast("Você não tem permissão para excluir lançamentos.", true);
        return;
    }
    if (!confirm("Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita e pode afetar o saldo do paciente.")) return;

    try {
        // 1. Fetch transaction details to see if it belongs to a budget payment
        const { data: trans, error: fError } = await db.from('financeiro_transacoes').select('*').eq('id', id).single();
        if (fError) throw fError;

        if (!canDeleteFinanceTransactionRow(trans)) {
            showToast("Exclusão bloqueada: lançamento vinculado ao sistema.", true);
            return;
        }

        const categoria = normalizeKey(trans.categoria);
        const tipo = normalizeKey(trans.tipo);
        const referenciaRaw = (trans.referencia_id === null || trans.referencia_id === undefined) ? '' : String(trans.referencia_id);
        const referencia = Number(referenciaRaw);
        const orcamentoId = (trans.orcamento_id === null || trans.orcamento_id === undefined) ? null : Number(trans.orcamento_id);

        const blockers = [];
        blockers.push({
            label: 'Comissões (Estorno)',
            count: await countExact(
                db.from('financeiro_comissoes').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('transacao_estorno_id', id),
                'financeiro_comissoes:transacao_estorno'
            )
        });
        if (categoria === 'PAGAMENTO' && Number.isFinite(referencia) && referencia > 0) {
            blockers.push({
                label: 'Pagamentos (Orçamento)',
                count: await countExact(
                    db.from('orcamento_pagamentos')
                        .select('id', { count: 'exact', head: true })
                        .eq('empresa_id', currentEmpresaId)
                        .eq('orcamento_id', referencia)
                        .eq('valor_pago', trans.valor),
                    'orcamento_pagamentos:from_finance'
                )
            });
        }

        const blockedMsg = formatBlockers(blockers);
        if (blockedMsg) {
            showToast(`Não é possível excluir: ${blockedMsg}`, true);
            return;
        }

        if (categoria === 'TRANSFERENCIA') {
            showToast("Exclusão bloqueada: lançamentos de transferência devem ser revertidos em conjunto.", true);
            return;
        }

        if (categoria === 'PAGAMENTO') {
            showToast("Exclusão bloqueada: este lançamento é um pagamento. Exclua pelo Orçamento > Pagamentos.", true);
            return;
        }

        if (orcamentoId && Number.isFinite(orcamentoId) && orcamentoId > 0) {
            showToast("Exclusão bloqueada: este lançamento está vinculado a um orçamento.", true);
            return;
        }

        if ((categoria === 'ESTORNO' || categoria === 'REEMBOLSO') && Number.isFinite(referencia) && referencia > 0) {
            const cnt = await countExact(
                db.from('orcamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('seqid', referencia),
                'orcamentos:by_seqid'
            );
            if (cnt > 0) {
                showToast("Exclusão bloqueada: este lançamento está vinculado a um orçamento/cancelamento.", true);
                return;
            }
        }

        if (Number.isFinite(referencia) && referencia > 0) {
            const cnt = await countExact(
                db.from('orcamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('seqid', referencia),
                'orcamentos:by_seqid_any'
            );
            if (cnt > 0) {
                showToast("Exclusão bloqueada: este lançamento está vinculado a um orçamento. Ajuste pelo módulo Orçamentos.", true);
                return;
            }
        }
        if (!Number.isFinite(referencia) && referenciaRaw) {
            const cnt = await countExact(
                db.from('orcamentos').select('id', { count: 'exact', head: true }).eq('empresa_id', currentEmpresaId).eq('id', referenciaRaw),
                'orcamentos:by_id_any'
            );
            if (cnt > 0) {
                showToast("Exclusão bloqueada: este lançamento está vinculado a um orçamento. Ajuste pelo módulo Orçamentos.", true);
                return;
            }
        }

        // 2. Delete from main financeiro_transacoes
        const { error: dError } = await db.from('financeiro_transacoes').delete().eq('id', id);
        if (dError) throw dError;

        showToast("Lançamento excluído com sucesso.");

        // 3. Refresh data
        if (trans.paciente_id) {
            fetchTransactions(trans.paciente_id);
            updateBalanceUI(trans.paciente_id);
        } else {
            fetchTransactions();
        }

        // Refresh budget state if necessary
        const { data: bData } = await db.from('orcamentos').select('*, orcamento_itens(*)').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true });
        if (bData) budgets = bData;

    } catch (error) {
        console.error("Error deleting transaction:", error);
        const code = error && error.code ? String(error.code) : '-';
        const msg = error && error.message ? String(error.message) : 'Erro desconhecido';
        showToast(`Erro ao excluir lançamento (${code}): ${msg}`, true);
    }
}

window.deleteTransaction = deleteTransaction;

// Hook up Financeiro search and listeners
(function () {
    let finSearchTimer = null;
    const getFinTerm = () => String(finPacienteSearch ? finPacienteSearch.value : '').toLowerCase().trim();
    const findPatientsByTerm = (term) => {
        const t = String(term || '').toLowerCase().trim();
        if (!t) return [];
        return (patients || []).filter(p => String(p && p.nome || '').toLowerCase().includes(t));
    };
    const applyFinLocalFilter = (rawTerm) => {
        const term = String(rawTerm || '').toLowerCase().trim();
        const base = Array.isArray(financeAllTransactions) && financeAllTransactions.length ? financeAllTransactions : (transactions || []);
        const filtered = term ? base.filter(t => String(t && t.paciente_nome || '').toLowerCase().includes(term)) : base;
        financeSelectedPatientId = null;
        if (finPainelSaldo) finPainelSaldo.classList.add('hidden');
        renderTable(filtered, 'financeiro');
    };
    const runFinanceSearch = async ({ showAmbiguousToast = false } = {}) => {
        const term = getFinTerm();
        if (!term) {
            financeSelectedPatientId = null;
            if (finPainelSaldo) finPainelSaldo.classList.add('hidden');
            await fetchTransactions();
            return;
        }

        const matches = findPatientsByTerm(term);
        if (matches.length === 1) {
            await fetchTransactions(matches[0].seqid);
            return;
        }

        if ((!financeAllTransactions || financeAllTransactions.length === 0) && (!transactions || transactions.length === 0)) {
            await fetchTransactions();
        }
        applyFinLocalFilter(term);
        if (showAmbiguousToast && matches.length > 1) {
            showToast(`Encontrados ${matches.length} pacientes. Digite mais para refinar.`, true);
        }
    };

    if (btnFinBuscar) {
        btnFinBuscar.addEventListener('click', () => {
            runFinanceSearch({ showAmbiguousToast: true });
        });
    }

    if (finPacienteSearch) {
        finPacienteSearch.addEventListener('input', () => {
            if (finSearchTimer) clearTimeout(finSearchTimer);
            finSearchTimer = setTimeout(() => {
                runFinanceSearch({ showAmbiguousToast: false });
            }, 220);
        });
    }

    if (btnFinVerTodos) {
        btnFinVerTodos.addEventListener('click', () => {
            if (finPainelSaldo) finPainelSaldo.classList.add('hidden');
            if (finPacienteSearch) finPacienteSearch.value = '';
            financeSelectedPatientId = null;
            fetchTransactions();
        });
    }

    // --- LOGICA DE TRANSFERÊNCIA DE SALDO ---
    const btnTransferirSaldo = document.getElementById('btnTransferirSaldo');
    const modalTransferencia = document.getElementById('modalTransferencia');
    const btnCloseModalTransferencia = document.getElementById('btnCloseModalTransferencia');
    const btnCancelarTransferencia = document.getElementById('btnCancelarTransferencia');
    const btnConfirmarTransferencia = document.getElementById('btnConfirmarTransferencia');

    if (btnTransferirSaldo) {
        btnTransferirSaldo.addEventListener('click', async () => {
            const term = getFinTerm();
            let patient = null;
            if (financeSelectedPatientId) {
                patient = (patients || []).find(p => String(p && p.seqid) === String(financeSelectedPatientId) || String(p && p.id) === String(financeSelectedPatientId)) || null;
            }
            if (!patient) {
                const matches = findPatientsByTerm(term);
                if (matches.length === 1) patient = matches[0];
            }

            if (!patient) {
                showToast("Selecione/Busque um paciente primeiro para transferir o saldo dele.", true);
                return;
            }

            // Pegar saldo atual do paciente de origem
            const { data: sData } = await db.from('view_saldo_paciente').select('saldo_atual').eq('paciente_id', patient.seqid).single();
            const saldo = sData ? parseFloat(sData.saldo_atual) : 0;

            if (saldo <= 0) {
                showToast("Este paciente não possui saldo positivo para transferir.", true);
                return;
            }

            document.getElementById('transOrigem').innerText = `${patient.nome} (Saldo: R$ ${saldo.toFixed(2)})`;
            window._transferSourcePatient = patient;
            window._transferSourceBalance = saldo;

            // Popular select de destino (excluindo a origem)
            const destSelect = document.getElementById('transPacienteDestino');
            destSelect.innerHTML = '<option value="">Selecione o destino...</option>' +
                patients.filter(p => p.id !== patient.id)
                    .map(p => `<option value="${p.seqid}">${p.nome}</option>`).join('');

            modalTransferencia.classList.remove('hidden');
        });
    }

    if (btnCloseModalTransferencia) btnCloseModalTransferencia.onclick = () => modalTransferencia.classList.add('hidden');
    if (btnCancelarTransferencia) btnCancelarTransferencia.onclick = () => modalTransferencia.classList.add('hidden');

    if (btnConfirmarTransferencia) {
        btnConfirmarTransferencia.addEventListener('click', async () => {
            const srcPatient = window._transferSourcePatient;
            const destId = document.getElementById('transPacienteDestino').value;
            const valor = parseFloat(document.getElementById('transValor').value);
            const obs = document.getElementById('transObs').value;

            if (!destId || isNaN(valor) || valor <= 0) {
                showToast("Preencha o destino e um valor válido.", true);
                return;
            }

            if (valor > window._transferSourceBalance) {
                showToast("Valor excede o saldo disponível.", true);
                return;
            }

            try {
                btnConfirmarTransferencia.disabled = true;

                // 1. Débito na Origem
                const debitoData = {
                    paciente_id: srcPatient.seqid,
                    tipo: 'DEBITO',
                    categoria: 'TRANSFERENCIA',
                    valor: valor,
                    paciente_destino_id: destId,
                    observacoes: `Transferência enviada para ${patients.find(p => p.seqid == destId)?.nome}. ${obs}`,
                    empresa_id: currentEmpresaId,
                    criado_por: currentUser.id
                };

                // 2. Crédito no Destino
                const creditoData = {
                    paciente_id: destId,
                    tipo: 'CREDITO',
                    categoria: 'TRANSFERENCIA',
                    valor: valor,
                    observacoes: `Transferência recebida de ${srcPatient.nome}. ${obs}`,
                    empresa_id: currentEmpresaId,
                    criado_por: currentUser.id
                };

                await db.from('financeiro_transacoes').insert([debitoData, creditoData]);

                showToast("Transferência realizada com sucesso!");
                modalTransferencia.classList.add('hidden');

                // Refresh
                fetchTransactions(srcPatient.seqid);
                updateBalanceUI(srcPatient.seqid);
            } catch (err) {
                console.error("Erro na transferência:", err);
                showToast("Falha ao realizar transferência.", true);
            } finally {
                btnConfirmarTransferencia.disabled = false;
            }
        });
    }

    if (btnNovaTransacao) {
        btnNovaTransacao.addEventListener('click', () => {
            if (formNovaTransacao) formNovaTransacao.reset();
            // Populate patient select
            if (transacaoPaciente) {
                transacaoPaciente.innerHTML = '<option value="">Selecione o paciente...</option>' +
                    patients.map(p => `<option value="${p.seqid}">${p.nome}</option>`).join('');
            }
            if (modalNovaTransacao) modalNovaTransacao.classList.remove('hidden');
        });
    }

    const closeMovDiaria = () => {
        if (movDiariaModal) movDiariaModal.classList.add('hidden');
    };
    const openMovDiaria = () => {
        if (!movDiariaModal) return;
        if (movDiariaDate && !movDiariaDate.value) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            movDiariaDate.value = `${yyyy}-${mm}-${dd}`;
        }
        if (movDiariaProfessional) {
            const opts = ['<option value="">Todos</option>'];
            (professionals || [])
                .slice()
                .filter(p => String(p.tipo || '').toLowerCase() !== 'protetico')
                .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
                .forEach(p => {
                    const v = (p.seqid != null && String(p.seqid)) ? String(p.seqid) : String(p.id || '');
                    if (!v) return;
                    opts.push(`<option value="${escapeHtml(v)}">${escapeHtml(String(p.nome || ''))}</option>`);
                });
            movDiariaProfessional.innerHTML = opts.join('');
        }
        movDiariaModal.classList.remove('hidden');
    };

    if (btnMovDiaria && !btnMovDiaria.dataset.bound) {
        btnMovDiaria.addEventListener('click', (e) => { e.preventDefault(); openMovDiaria(); });
        btnMovDiaria.dataset.bound = '1';
    }
    if (btnCloseMovDiariaModal && !btnCloseMovDiariaModal.dataset.bound) {
        btnCloseMovDiariaModal.addEventListener('click', closeMovDiaria);
        btnCloseMovDiariaModal.dataset.bound = '1';
    }
    if (btnCancelMovDiaria && !btnCancelMovDiaria.dataset.bound) {
        btnCancelMovDiaria.addEventListener('click', closeMovDiaria);
        btnCancelMovDiaria.dataset.bound = '1';
    }
    if (movDiariaModal && !movDiariaModal.dataset.bound) {
        movDiariaModal.addEventListener('click', (e) => { if (e.target === movDiariaModal) closeMovDiaria(); });
        movDiariaModal.dataset.bound = '1';
    }
    if (btnGenerateMovDiaria && !btnGenerateMovDiaria.dataset.bound) {
        btnGenerateMovDiaria.addEventListener('click', async (e) => {
            e.preventDefault();
            const dateStr = movDiariaDate ? String(movDiariaDate.value || '') : '';
            const profVal = movDiariaProfessional ? String(movDiariaProfessional.value || '') : '';
            await printMovimentacaoDiaria({ dateStr, profVal });
        });
        btnGenerateMovDiaria.dataset.bound = '1';
    }

    const closeFechamentoFull = () => {
        if (fechamentoDiarioFullModal) fechamentoDiarioFullModal.classList.add('hidden');
    };
    const openFechamentoFull = () => {
        if (!fechamentoDiarioFullModal) return;
        if (fechamentoDiarioFullDate && !fechamentoDiarioFullDate.value) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            fechamentoDiarioFullDate.value = `${yyyy}-${mm}-${dd}`;
        }
        if (fechamentoDiarioFullProfessional) {
            const opts = ['<option value="">Todos</option>'];
            (professionals || [])
                .slice()
                .filter(p => String(p.tipo || '').toLowerCase() !== 'protetico')
                .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
                .forEach(p => {
                    if (p.seqid == null) return;
                    opts.push(`<option value="${escapeHtml(String(p.seqid))}">${escapeHtml(String(p.nome || ''))}</option>`);
                });
            fechamentoDiarioFullProfessional.innerHTML = opts.join('');
        }
        fechamentoDiarioFullModal.classList.remove('hidden');
    };

    if (btnFechamentoDiarioFull && !btnFechamentoDiarioFull.dataset.bound) {
        btnFechamentoDiarioFull.addEventListener('click', (e) => { e.preventDefault(); openFechamentoFull(); });
        btnFechamentoDiarioFull.dataset.bound = '1';
    }
    if (btnCloseFechamentoDiarioFullModal && !btnCloseFechamentoDiarioFullModal.dataset.bound) {
        btnCloseFechamentoDiarioFullModal.addEventListener('click', closeFechamentoFull);
        btnCloseFechamentoDiarioFullModal.dataset.bound = '1';
    }
    if (btnCancelFechamentoDiarioFull && !btnCancelFechamentoDiarioFull.dataset.bound) {
        btnCancelFechamentoDiarioFull.addEventListener('click', closeFechamentoFull);
        btnCancelFechamentoDiarioFull.dataset.bound = '1';
    }
    if (fechamentoDiarioFullModal && !fechamentoDiarioFullModal.dataset.bound) {
        fechamentoDiarioFullModal.addEventListener('click', (e) => { if (e.target === fechamentoDiarioFullModal) closeFechamentoFull(); });
        fechamentoDiarioFullModal.dataset.bound = '1';
    }
    if (btnGenerateFechamentoDiarioFull && !btnGenerateFechamentoDiarioFull.dataset.bound) {
        btnGenerateFechamentoDiarioFull.addEventListener('click', async (e) => {
            e.preventDefault();
            const dateStr = fechamentoDiarioFullDate ? String(fechamentoDiarioFullDate.value || '') : '';
            const profSeqId = fechamentoDiarioFullProfessional ? String(fechamentoDiarioFullProfessional.value || '') : '';
            await printFechamentoDiarioFull({ dateStr, profSeqId });
        });
        btnGenerateFechamentoDiarioFull.dataset.bound = '1';
    }

    const btnCloseModalTransacao = document.getElementById('btnCloseModalTransacao');
    if (btnCloseModalTransacao) {
        btnCloseModalTransacao.addEventListener('click', () => modalNovaTransacao.classList.add('hidden'));
    }

    if (btnCancelarTransacao) {
        btnCancelarTransacao.addEventListener('click', () => modalNovaTransacao.classList.add('hidden'));
    }

    if (transacaoCategoria) {
        transacaoCategoria.addEventListener('change', (e) => {
            if (e.target.value === 'TRANSFERENCIA') {
                if (grpPacienteDestino) grpPacienteDestino.classList.remove('hidden');
                if (transacaoPacienteDestino) {
                    transacaoPacienteDestino.innerHTML = '<option value="">Selecione o paciente destino...</option>' +
                        patients.map(p => `<option value="${p.seqid}">${p.nome}</option>`).join('');
                }
            } else {
                if (grpPacienteDestino) grpPacienteDestino.classList.add('hidden');
            }
        });
    }

    const transacaoValor = document.getElementById('transacaoValor');
    const transacaoForma = document.getElementById('transacaoForma');
    const transacaoObs = document.getElementById('transacaoObs');

    if (btnSalvarTransacao) {
        btnSalvarTransacao.addEventListener('click', async () => {
            const pacId = transacaoPaciente.value;
            const cat = transacaoCategoria.value;
            const valor = parseFloat(transacaoValor.value);
            const forma = transacaoForma.value;

            if (!pacId || !cat || isNaN(valor) || valor <= 0) {
                showToast("Preencha todos os campos obrigatórios corretamente.", true);
                return;
            }

            const obs = (transacaoObs && typeof transacaoObs.value === 'string') ? transacaoObs.value.trim() : '';
            if (cat === 'REEMBOLSO' && obs.length === 0) {
                showToast("Para REEMBOLSO, preencha a Observação (ex.: Reembolso do cancelamento do Orçamento #1).", true);
                return;
            }

            if (cat === 'REEMBOLSO') {
                const obsNorm = normalizeKey(obs);
                const looksLikeCancel = obsNorm.includes('CANCELAMENTO') || obsNorm.includes('ORCAMENTO');
                const looksLikeAutoEstorno = obsNorm.includes('ESTORNO') && obsNorm.includes('AUTOMATIC');
                const msg = (looksLikeCancel || looksLikeAutoEstorno)
                    ? "Você selecionou REEMBOLSO (saída de caixa). Use isso somente se o dinheiro já foi devolvido ao paciente. Confirmar reembolso?"
                    : "REEMBOLSO é usado quando o dinheiro já foi devolvido ao paciente (PIX/dinheiro). Confirmar reembolso?";
                if (!confirm(msg)) return;
            }

            let tipo = (cat === 'PAGAMENTO' || cat === 'ESTORNO') ? 'CREDITO' : 'DEBITO';

            const transactionData = {
                paciente_id: pacId,
                tipo: tipo,
                categoria: cat,
                valor: valor,
                forma_pagamento: forma,
                observacoes: obs,
                empresa_id: currentEmpresaId,
                criado_por: currentUser.id
            };

            try {
                // Inserir Débito (Doador) e capturar o ID para atualizar a observação depois se necessário
                const { data: insertedRows, error } = await db.from('financeiro_transacoes').insert(transactionData).select();
                if (error) throw error;
                const donorTransactionId = insertedRows[0].id;

                if (cat === 'TRANSFERENCIA') {
                    const pacDestId = transacaoPacienteDestino.value;
                    if (!pacDestId) {
                        showToast("Paciente destino não selecionado.", true);
                        return;
                    }

                    // Buscar nomes para as observações
                    const donor = patients.find(p => String(p.seqid) === String(pacId));
                    const recipient = patients.find(p => String(p.seqid) === String(pacDestId));

                    const donorName = donor ? donor.nome : `Paciente ID ${pacId}`;
                    const recipientName = recipient ? recipient.nome : `Paciente ID ${pacDestId}`;

                    // Atualizar observação do DÉBITO (doador) usando o ID capturado
                    await db.from('financeiro_transacoes')
                        .update({ observacoes: `Transferiu o crédito de R$ ${valor.toFixed(2)} para o paciente ${recipientName}. ${obs}` })
                        .eq('id', donorTransactionId);

                    const transferData = {
                        ...transactionData,
                        paciente_id: pacDestId,
                        tipo: 'CREDITO',
                        observacoes: `Recebeu o crédito de R$ ${valor.toFixed(2)} do paciente ${donorName}. ${obs}`
                    };
                    const { error: err2 } = await db.from('financeiro_transacoes').insert(transferData);
                    if (err2) throw err2;
                }

                showToast("Lançamento realizado com sucesso!");
                modalNovaTransacao.classList.add('hidden');
                fetchTransactions(pacId);
            } catch (err) {
                console.error("Error saving transaction:", err);
                showToast("Erro ao salvar lançamento.", true);
            }
        });
    }
})();

// Budget Payment Functions
window.viewBudgetPayments = async function (budgetId) {
    const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
    if (!budget) return;

    const tipoBudget = String(budget.tipo || 'Normal').trim();
    const tipoKey = normalizeKey(tipoBudget);
    const isFreeBudget = tipoKey === 'CORTESIA' || tipoKey === 'RETRABALHO';

    if (modalNovaTransacao) modalNovaTransacao.classList.add('hidden');
    const budgetDetailModal = document.getElementById('budgetDetailModal');
    if (budgetDetailModal) budgetDetailModal.classList.remove('hidden');

    const itens = budget.orcamento_itens || budget.itens || [];
    const totalOrcado = itens.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
    let financePayments = [];
    try {
        const budgetSeq = Number(budget.seqid);
        if (currentEmpresaId && Number.isFinite(budgetSeq) && budgetSeq > 0) {
            const q = await withTimeout(
                db.from('financeiro_transacoes')
                    .select('id, valor, forma_pagamento, data_transacao, observacoes, referencia_id, orcamento_id, tipo, categoria')
                    .eq('empresa_id', currentEmpresaId)
                    .eq('categoria', 'PAGAMENTO')
                    .eq('tipo', 'CREDITO')
                    .or(`referencia_id.eq.${budgetSeq},orcamento_id.eq.${budgetSeq}`)
                    .order('data_transacao', { ascending: false }),
                15000,
                'financeiro_transacoes:budget_payments'
            );
            if (!q.error) financePayments = q.data || [];
        }
    } catch (e) {
        console.error("Error fetching finance payments for budget:", e);
    }

    const existingPaymentKeys = new Set();
    (budget.pagamentos || []).forEach(p => {
        const v = Number(p && p.valor_pago).toFixed(2);
        const f = normalizeKey(p && p.forma_pagamento);
        const d = String((p && (p.data_pagamento || p.criado_em || p.data)) || '').slice(0, 16);
        existingPaymentKeys.add(`${v}|${f}|${d}`);
    });
    const financePaymentsFiltered = (financePayments || []).filter(fp => {
        const v = Number(fp && fp.valor).toFixed(2);
        const f = normalizeKey(fp && fp.forma_pagamento);
        const d = String((fp && fp.data_transacao) || '').slice(0, 16);
        const key = `${v}|${f}|${d}`;
        if (existingPaymentKeys.has(key)) return false;
        existingPaymentKeys.add(key);
        return true;
    });

    const pagamentosOrcAll = (budget.pagamentos || []);
    const pagamentosOrc = pagamentosOrcAll.filter(p => String(p && p.status_pagamento) !== 'Cancelado');
    const totalPagoOrc = pagamentosOrc.reduce((acc, curr) => acc + (parseFloat(curr.valor_pago) || 0), 0);
    const totalPagoFin = (financePaymentsFiltered || []).reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);
    const totalPagoRaw = totalPagoOrc + totalPagoFin;
    const totalPago = isFreeBudget ? totalOrcado : totalPagoRaw;
    const saldo = isFreeBudget ? 0 : (totalOrcado - totalPagoRaw);

    budget.pagamentos_financeiro_extra = financePaymentsFiltered || [];
    budget.total_pago_financeiro_extra = totalPagoFin;
    await ensureBudgetCommissions(budget);

    const body = document.getElementById('budgetDetailBody');
    if (!body) return;

    // pagamentosOrc já filtrado acima
    const pagamentosFin = financePaymentsFiltered || [];
    let paymentsHtml = '';
    if (pagamentosOrc.length === 0 && pagamentosFin.length === 0) {
        paymentsHtml = '<p style="color: var(--text-muted); margin-top: 0.5rem;">Nenhum pagamento registrado.</p>';
    } else {
        const orcTable = pagamentosOrc.length === 0 ? '' : `
            <table class="simple-table" style="margin-top: 0.5rem; width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead style="background: var(--bg-hover);">
                    <tr>
                        <th style="padding: 0.5rem; text-align: left;">Data</th>
                        <th style="padding: 0.5rem; text-align: left;">Valor</th>
                        <th style="padding: 0.5rem; text-align: left;">Forma</th>
                        <th style="padding: 0.5rem; text-align: center;">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagamentosOrc.map(p => `
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${formatDateTime(p.data_pagamento || p.criado_em || p.data)}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">R$ ${Number(p.valor_pago).toFixed(2)}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${p.forma_pagamento || '—'}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: center;">
                                <button class="btn-icon delete-btn" onclick="deleteBudgetPayment('${budget.id}', '${p.id}')" title="Excluir Pagamento">
                                    <i class="ri-delete-bin-line"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        const finTable = pagamentosFin.length === 0 ? '' : `
            <table class="simple-table" style="margin-top: 0.75rem; width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead style="background: var(--bg-hover);">
                    <tr>
                        <th style="padding: 0.5rem; text-align: left;">Data</th>
                        <th style="padding: 0.5rem; text-align: left;">Valor</th>
                        <th style="padding: 0.5rem; text-align: left;">Forma</th>
                        <th style="padding: 0.5rem; text-align: center;">Origem</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagamentosFin.map(p => `
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${formatDateTime(p.data_transacao)}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">R$ ${Number(p.valor).toFixed(2)}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${p.forma_pagamento || '—'}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: center;">
                                <span style="opacity:0.8;"><i class="ri-lock-line"></i> Financeiro</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        paymentsHtml = `${orcTable}${finTable}`;
    }

    let itemsHtml = `
        <table class="simple-table" style="margin-top: 1rem; width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead style="background: var(--bg-hover);">
                <tr>
                    <th style="padding: 0.5rem; text-align: left;">Procedimento</th>
                    <th style="padding: 0.5rem; text-align: left;">Valor</th>
                    <th style="padding: 0.5rem; text-align: left;">Status</th>
                    <th style="padding: 0.5rem; text-align: center;">Ação</th>
                </tr>
            </thead>
            <tbody>
                ${itens.map(it => {
        const isReleased = ['Liberado', 'Em Execução', 'Finalizado'].includes(it.status);

        // Robust lookup for service
        const servId = String(it.servico_id).toLowerCase();
        const serv = services.find(s => String(s.id).toLowerCase() === servId);
        const desc = serv ? serv.descricao : 'Serviço não encontrado';

        // Robust lookup for professional (seqid can be string or number)
        const profId = it.profissional_id;
        const prof = professionals.find(p => String(p.seqid) === String(profId));
        const profNome = prof ? prof.nome : '—';

        return `
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                            <strong>${desc}</strong><br>
                            <small style="color: var(--text-muted)">Prof: ${profNome}</small>
                        </td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">R$ ${Number(it.valor).toFixed(2)}</td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 0.75rem; background: ${isReleased ? 'rgba(40,167,69,0.1)' : '#eee'}; color: ${isReleased ? 'var(--success-color)' : '#666'}; padding: 2px 6px; border-radius: 4px;">
                                ${it.status || 'Pendente'}
                            </span>
                        </td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: center;">
                            ${!isReleased
                ? `<button class="btn btn-primary btn-sm" onclick="releaseBudgetItem('${budget.id}', '${it.id}')" title="Liberar para Clínica">Liberar</button>`
                : it.status === 'Finalizado'
                    ? '<span style="color: var(--success-color); font-weight:bold;"><i class="ri-checkbox-circle-fill"></i> Concluído</span>'
                    : `<button class="btn btn-sm" onclick="finalizeBudgetItem('${budget.id}', '${it.id}')" style="background:#10b981; color:white; border:none; padding:4px 8px; border-radius:4px;" title="Marcar como Finalizado">Finalizar</button>`
            }
                        </td>
                    </tr>`;
    }).join('')}
            </tbody>
        </table>
    `;

    body.innerHTML = `
        <div style="background: var(--bg-hover); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
                <p><strong>Paciente:</strong> ${budget.pacientenome || '—'}</p>
                <p><strong>Tipo:</strong> ${escapeHtml(tipoBudget)}</p>
                <p><strong>Total Orçado:</strong> R$ ${totalOrcado.toFixed(2)}</p>
            </div>
            <div>
                <p><strong>Total Pago:</strong> <span style="color: var(--success-color)">R$ ${totalPago.toFixed(2)}</span></p>
                <p><strong>Saldo Devedor:</strong> <span style="color: ${saldo > 0 ? '#dc3545' : 'var(--success-color)'}">R$ ${saldo.toFixed(2)}</span></p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
            <div>
                <h4>Procedimentos e Liberações</h4>
                ${itemsHtml}
            </div>
            <div>
                <h4>Histórico de Pagamentos</h4>
                ${paymentsHtml}
            </div>
        </div>

        ${isFreeBudget ? `
            <div style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1rem; background: #fdfdfd; padding: 1rem; border-radius: 8px;">
                <h4>Pagamentos</h4>
                <div style="margin-top: 0.5rem; color: var(--text-muted);">
                    Este orçamento é do tipo <strong>${escapeHtml(tipoBudget)}</strong>. Não há cobrança, então não são registrados pagamentos.
                </div>
            </div>
        ` : `
            <div style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1rem; background: #fdfdfd; padding: 1rem; border-radius: 8px;">
                <h4>Registrar Novo Pagamento</h4>
                <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                    <div class="form-group">
                        <label>Valor do Pagamento *</label>
                        <input type="number" id="payBudgetAmount" value="${saldo > 0 ? saldo.toFixed(2) : ''}" step="0.01" style="width: 100%;">
                    </div>
                    <div class="form-group">
                        <label>Forma de Pagamento *</label>
                        <select id="payBudgetForma" style="width: 100%;">
                            <option value="PIX">PIX</option>
                            <option value="Cartão Débito">Cartão Débito</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="Boleto">Boleto</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Saldo em Conta">Saldo em Conta (Crédito Interno)</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Alocar pagamento para (opcional)</label>
                        <select id="payBudgetAllocItem" style="width: 100%;">
                            <option value="">Rateio proporcional (padrão)</option>
                            ${(itens || []).map(it => {
                                const servName = findServiceNameById(it.servico_id) || String(it.servicodescricao || it.descricao || '');
                                const sub = String(it.subdivisao || '').trim();
                                const st = String(it.status || 'Pendente');
                                const label = `${servName}${sub ? ` • ${sub}` : ''} — ${st}`;
                                return `<option value="${escapeHtml(String(it.id || ''))}">${escapeHtml(label)}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Observações</label>
                        <input type="text" id="payBudgetObs" placeholder="Ex: Pagamento 1a parcela" style="width: 100%;">
                    </div>
                    <div class="form-group" style="grid-column: span 2; display:flex; align-items:center; gap:10px;">
                        <input id="payBudgetAutoRelease" type="checkbox" checked>
                        <label for="payBudgetAutoRelease" style="margin:0; cursor:pointer;">Auto-liberar itens cobertos pelo pagamento</label>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="recordBudgetPayment('${budget.id}')" style="margin-top: 1rem; width: 100%;">
                    <i class="ri-save-line"></i> Confirmar Pagamento
                </button>
            </div>
        `}
    `;
};

window.deleteBudgetPayment = async function (budgetId, paymentId) {
    if (!can('financeiro', 'delete')) {
        showToast("Você não tem permissão para excluir pagamentos.", true);
        return;
    }

    const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
    if (!budget) return;

    try {
        // 1. Verificar se existem comissões já PAGAS vinculadas a este orçamento
        // Precisamos dos IDs dos itens para checar comissões
        const itemIds = (budget.orcamento_itens || []).map(it => it.id);

        if (itemIds.length > 0) {
            const { data: comissoesPagas, error: cErr } = await db.from('financeiro_comissoes')
                .select('id')
                .in('item_id', itemIds)
                .eq('status', 'PAGA');

            if (cErr) console.error("Erro ao checar comissões:", cErr);

            if (comissoesPagas && comissoesPagas.length > 0) {
                showToast("Não é possível excluir o pagamento: Já existem comissões pagas vinculadas!", true);
                return;
            }
        }

        if (!confirm("Tem certeza que deseja excluir este pagamento? Todos os itens deste orçamento voltarão para o status 'Pendente'.")) return;

        // 2. Buscar detalhes do pagamento para apagar o espelho financeiro
        const payment = (budget.pagamentos || []).find(p => p.id === paymentId);
        if (!payment) {
            showToast("Pagamento não encontrado localmente.", true);
            return;
        }

        // 3. Excluir de orcamento_pagamentos
        const { error: pErr } = await db.from('orcamento_pagamentos').delete().eq('id', paymentId);
        if (pErr) throw pErr;

        // 4. Buscar e excluir espelho em financeiro_transacoes
        const pacId = budget.pacienteid || budget.paciente_id;
        const patient = patients.find(p => p.id === pacId);
        const pacNumId = patient ? patient.seqid : null;

        if (pacNumId) {
            const { data: transList } = await db.from('financeiro_transacoes')
                .select('id')
                .eq('referencia_id', budget.seqid)
                .eq('valor', payment.valor_pago)
                .eq('paciente_id', pacNumId)
                .eq('categoria', 'PAGAMENTO')
                .order('created_at', { ascending: false });

            if (transList && transList.length > 0) {
                await db.from('financeiro_transacoes').delete().eq('id', transList[0].id);
            }
        }

        // 5. Reverter Status dos Itens e Estornar Comissões Pendentes
        if (itemIds.length > 0) {
            // Reverter itens para Pendente
            await db.from('orcamento_itens').update({ status: 'Pendente' }).in('id', itemIds);

            // Estornar comissões que ainda não foram pagas
            await db.from('financeiro_comissoes')
                .update({ status: 'ESTORNADA' })
                .in('item_id', itemIds)
                .eq('status', 'PENDENTE');

            // Atualizar estado local
            (budget.orcamento_itens || []).forEach(it => it.status = 'Pendente');
        }

        // 6. Atualizar estado local do orçamento
        budget.pagamentos = budget.pagamentos.filter(p => p.id !== paymentId);
        budget.total_pago = budget.pagamentos.reduce((acc, curr) => acc + (parseFloat(curr.valor_pago) || 0), 0);

        showToast("Pagamento excluído e itens resetados para Pendente.");
        viewBudgetPayments(budgetId);

        if (!budgetsListView.classList.contains('hidden')) {
            renderTable(budgets, 'budgets');
        }

    } catch (error) {
        console.error("Error deleting budget payment:", error);
        showToast("Erro ao excluir pagamento.", true);
    }
};

window.recordBudgetPayment = async function (budgetId) {
    const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
    if (!budget) return;

    const tipoBudget = String(budget.tipo || 'Normal').trim();
    const tipoKey = normalizeKey(tipoBudget);
    if (tipoKey === 'CORTESIA' || tipoKey === 'RETRABALHO') {
        showToast(`Este orçamento é do tipo "${tipoBudget}" e não aceita pagamentos.`, true);
        return;
    }

    const valorInput = document.getElementById('payBudgetAmount');
    const formaInput = document.getElementById('payBudgetForma');
    const obsInput = document.getElementById('payBudgetObs');
    const allocInput = document.getElementById('payBudgetAllocItem');
    const autoReleaseInput = document.getElementById('payBudgetAutoRelease');

    // Para type="number", o .value já vem no formato decimal (ex: "40.00")
    // Se usarmos .replace(/\./g, ''), "40.00" vira "4000"! Por isso o erro.
    const valor = parseFloat(valorInput.value);
    const forma = formaInput.value;
    const obs = obsInput.value;
    const allocItemId = allocInput ? String(allocInput.value || '').trim() : '';
    const obsFinal = allocItemId ? `[AlocarItem:${allocItemId}] ${obs || ''}`.trim() : obs;
    const autoRelease = autoReleaseInput ? Boolean(autoReleaseInput.checked) : true;

    if (isNaN(valor) || valor <= 0) {
        showToast("Insira um valor válido.", true);
        return;
    }

    // Trava de Valor Máximo: Calcular total REAL baseado nos itens (Fonte da Verdade)
    const itens = budget.orcamento_itens || budget.itens || [];
    const totalOrcado = itens.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
    const totalPagoJa = parseFloat(budget.total_pago) || 0;
    const saldoRestante = totalOrcado - totalPagoJa;

    console.log(`[Segurança] Orçamento #${budget.seqid}:`);
    console.log(`- Total Orçado (Itens): R$ ${totalOrcado.toFixed(2)}`);
    console.log(`- Total Pago Anterior: R$ ${totalPagoJa.toFixed(2)}`);
    console.log(`- Tentativa de Pagamento: R$ ${valor.toFixed(2)}`);
    console.log(`- Saldo Restante: R$ ${saldoRestante.toFixed(2)}`);

    if (valor > (saldoRestante + 0.10)) { // Margem de 10 centavos para arredondamentos
        showToast(`Valor excede o saldo do orçamento (Saldo: R$ ${saldoRestante.toFixed(2)}).`, true);
        console.warn("Validação de saldo bloqueada:", { valor, saldoRestante, totalOrcado, totalPagoJa });
        return;
    }

    // Validação extra se for SALDO EM CONTA
    if (forma === 'Saldo em Conta') {
        try {
            const pacIdRaw = budget.pacienteid || budget.paciente_id;
            const patientObj = patients.find(p => p.id === pacIdRaw || p.seqid == pacIdRaw);
            const pacNumId = patientObj ? patientObj.seqid : (budget.pacienteseqid || budget.paciente_id);

            const { data: sData } = await db.from('view_saldo_paciente').select('saldo_atual').eq('paciente_id', pacNumId).single();
            const saldoDisponivel = sData ? parseFloat(sData.saldo_atual) : 0;

            if (valor > (saldoDisponivel + 0.01)) {
                showToast(`Saldo insuficiente em conta (Disponível: R$ ${saldoDisponivel.toFixed(2)}).`, true);
                return;
            }
        } catch (err) {
            console.error("Erro ao validar saldo em conta:", err);
        }
    }

    try {
        // 1. Inserir em orcamento_pagamentos
        const paymentData = {
            orcamento_id: budget.seqid,
            valor_pago: valor,
            forma_pagamento: forma,
            observacoes: obsFinal,
            empresa_id: currentEmpresaId
        };

        const { data: pData, error: pErr } = await db.from('orcamento_pagamentos').insert(paymentData).select().single();
        if (pErr) {
            console.error("DEBUG V19: Erro no Passo 1 (orcamento_pagamentos):", pErr);
            throw pErr;
        }

        console.log("DEBUG V19: Passo 1 Sucesso, dado inserido:", pData);

        // --- SUCESSO NO PASSO 1: O pagamento já existe no banco ---

        // Atualizar estado local imediatamente
        if (!budget.pagamentos) budget.pagamentos = [];
        budget.pagamentos.push(pData);
        budget.total_pago = (budget.total_pago || 0) + valor;

        console.log("DEBUG V19: Estado local atualizado. Total pago:", budget.total_pago);

        if (autoRelease) {
            try {
                if (allocItemId) {
                    await releaseBudgetItem(budget.id, allocItemId);
                } else {
                    const itens2 = budget.orcamento_itens || budget.itens || [];
                    for (const it of itens2) {
                        const st = String(it && it.status || '');
                        if (['Liberado', 'Em Execução', 'Finalizado', 'Cancelado'].includes(st)) continue;
                        const valorLiberado2 = itens2
                            .filter(x => ['Liberado', 'Em Execução', 'Finalizado'].includes(String(x && x.status || '')))
                            .reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
                        const valorIt2 = (parseFloat(it.valor) || 0) * (parseInt(it.qtde) || 1);
                        const totalPago2 = budget.total_pago || 0;
                        if (valorLiberado2 + valorIt2 <= (totalPago2 + 0.01)) {
                            await releaseBudgetItem(budget.id, it.id);
                        }
                    }
                }
            } catch (_) {
            }
        }

        // Atualizar interface com pequeno delay para garantir sincronia
        setTimeout(() => {
            console.log("DEBUG V19: Atualizando interface via viewBudgetPayments...");
            viewBudgetPayments(budgetId);
            if (!budgetsListView.classList.contains('hidden')) {
                renderTable(budgets, 'budgets');
            }
        }, 300);

        // 2. Tentar inserir espelho em financeiro_transacoes (Conta Corrente)
        // Se a forma for 'Saldo em Conta', não inserimos nada aqui, pois o DÉBITO real
        // acontece no momento da Liberação/Consumo do item.
        if (forma === 'Saldo em Conta') {
            showToast("Pagamento via Saldo registrado!");
            return;
        }

        try {
            const pacIdRaw = budget.pacienteid || budget.paciente_id;
            const patientObj = patients.find(p => p.id === pacIdRaw || p.seqid == pacIdRaw);
            const pacNumId = patientObj ? patientObj.seqid : (budget.pacienteseqid || budget.paciente_id);

            const transactionData = {
                paciente_id: pacNumId,
                tipo: 'CREDITO', // Somente métodos externos (PIX, Dinheiro, etc) geram crédito aqui
                categoria: 'PAGAMENTO',
                valor: valor,
                forma_pagamento: forma,
                observacoes: `[Orçamento #${budget.seqid}] ${obsFinal}`,
                referencia_id: budget.seqid,
                empresa_id: currentEmpresaId,
                criado_por: currentUser.id
            };

            const { error: tErr } = await db.from('financeiro_transacoes').insert(transactionData);
            if (tErr) {
                console.error("Erro no registro financeiro secundário:", tErr);
                showToast("Pagamento salvo, mas houve um alerta no financeiro.", true);
            } else {
                showToast("Pagamento registrado com sucesso!");
            }
        } catch (finErr) {
            console.error("Erro ao tentar gravar no financeiro:", finErr);
            showToast("Pagamento salvo com aviso no financeiro.", true);
        }

        // 3. Atualizar status do orçamento para 'Aprovado' se estiver 'Pendente'
        if (budget.status === 'Pendente') {
            const { error: bErr } = await db.from('orcamentos')
                .update({ status: 'Aprovado' })
                .eq('id', budget.id);

            if (!bErr) {
                budget.status = 'Aprovado';
                console.log(`DEBUG V20: Orçamento #${budget.seqid} aprovado automaticamente via pagamento.`);
            }
        }

    } catch (error) {
        console.error("Error recording payment:", error);
        showToast("Erro ao processar pagamento no banco de dados.", true);
    }
};

window.releaseBudgetItem = async function (budgetId, itemId) {
    const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
    if (!budget) return;

    const item = (budget.orcamento_itens || []).find(it => it.id === itemId);
    if (!item) return;

    const tipoBudget = String(budget.tipo || 'Normal').trim();
    const tipoKey = normalizeKey(tipoBudget);
    const isFreeBudget = tipoKey === 'CORTESIA' || tipoKey === 'RETRABALHO';

    // Validar se o item já foi liberado
    if (['Liberado', 'Em Execução', 'Finalizado'].includes(item.status)) {
        showToast("Este item já está liberado.", true);
        return;
    }

    // 1. Verificar se o saldo pago cobre a liberação deste item
    const itens = budget.orcamento_itens || budget.itens || [];
    const valorLiberado = itens
        .filter(it => ['Liberado', 'Em Execução', 'Finalizado'].includes(it.status))
        .reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);

    const valorDesteItem = (parseFloat(item.valor) || 0) * (parseInt(item.qtde) || 1);
    const totalPago = budget.total_pago || 0;

    const realizarLiberacao = async (autorizadoPor = null) => {
        try {
            // Se houver profissional vinculado, calcula a comissão ANTES de atualizar o status
            const profId = item.profissional_id;
            const profissional = professionals.find(p => p.seqid == profId);
            let valorComissao = 0;

            if (profissional && !isFreeBudget) {
                valorComissao = calculateCommission(profissional, item, budget);
            }

            // Inicia atualização do item
            const { error: itErr } = await db.from('orcamento_itens').update({
                status: 'Liberado',
                autorizado_por: autorizadoPor
            }).eq('id', itemId);

            if (itErr) throw itErr;

            // Se o orçamento estiver Pendente, muda para Aprovado ao liberar o primeiro item
            if (budget.status === 'Pendente') {
                const { error: bErr } = await db.from('orcamentos')
                    .update({ status: 'Aprovado' })
                    .eq('id', budget.id);
                if (!bErr) {
                    budget.status = 'Aprovado';
                }
            }

            item.status = 'Liberado';
            item.autorizado_por = autorizadoPor;

            // Se houve comissão calculada, registra na tabela
            if (valorComissao > 0 && !isFreeBudget) {
                const comissaoData = {
                    profissional_id: profId,
                    item_id: item.id,
                    valor_comissao: valorComissao,
                    status: 'PENDENTE',
                    empresa_id: currentEmpresaId
                };
                const { error: cErr } = await db.from('financeiro_comissoes').insert(comissaoData);

                if (cErr) {
                    console.error("Erro ao registrar comissão:", cErr);
                    showToast(`Item liberado, mas houve um erro ao gerar a comissão: ${cErr.message}`, true);
                } else {
                    showToast(`Item liberado! Comissão de R$ ${valorComissao.toFixed(2)} gerada.`);
                }
            } else {
                showToast(isFreeBudget ? `Item liberado! (${tipoBudget}: sem comissão/cobrança)` : "Item liberado!");
            }

            // --- NOVO: Debitar serviço no financeiro para controle de conta corrente ---
            try {
                if (!isFreeBudget) {
                    const pacIdRaw = budget.pacienteid || budget.paciente_id;
                    const patientObj = patients.find(p => p.id === pacIdRaw || p.seqid == pacIdRaw);
                    const pacNumId = patientObj ? patientObj.seqid : (budget.pacienteseqid || budget.paciente_id);
                    const desc = item.descricao || 'Serviço';
                    const debitoData = {
                        paciente_id: pacNumId,
                        tipo: 'DEBITO',
                        categoria: 'CONSUMO',
                        valor: valorDesteItem,
                        observacoes: `[Consumo] ${desc} (Orçamento #${budget.seqid})`,
                        referencia_id: budget.seqid,
                        empresa_id: currentEmpresaId,
                        criado_por: currentUser.id
                    };
                    await db.from('financeiro_transacoes').insert(debitoData);
                }
            } catch (debErr) {
                if (!isFreeBudget) {
                    console.warn("Aviso: Não foi possível registrar o débito do serviço no financeiro.", debErr);
                }
            }

            viewBudgetPayments(budgetId);

            // Forçamos o refresh da tabela principal (mesmo que esteja em background) 
            // para que ao fechar o modal de pagamentos o status já esteja certo.
            console.log("DEBUG V20: Forçando refresh da tabela de orçamentos...");
            renderTable(budgets, 'budgets');
        } catch (err) {
            console.error("Error releasing item:", err);
            showToast(`Erro ao liberar item: ${err.message || 'Erro desconhecido'}`, true);
        }
    };

    if (isFreeBudget) {
        realizarLiberacao(`Auto-Autorizado (${tipoBudget})`);
        return;
    }

    if (valorLiberado + valorDesteItem > totalPago) {
        // Se o usuário logado já é Admin ou Supervisor, ele pode autorizar sem PIN extra
        if (currentUserRole === 'admin' || currentUserRole === 'supervisor') {
            realizarLiberacao(`Auto-Autorizado (${currentUserRole}: ${currentUser.email.split('@')[0]})`);
            return;
        }

        // Abrir modal de autorização
        const modalAuth = document.getElementById('supervisorAuthModal');
        const pinInput = document.getElementById('supervisorPinInput');
        const btnConfirm = document.getElementById('btnConfirmSupervisorAuth');

        modalAuth.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();

        btnConfirm.onclick = async () => {
            const enteredPin = pinInput.value;

            // Buscar PIN da empresa atual
            const { data: emp, error: empErr } = await db.from('empresas').select('supervisor_pin').eq('id', currentEmpresaId).single();

            if (empErr) {
                showToast("Erro ao validar permissão.", true);
                return;
            }

            if (enteredPin === emp.supervisor_pin) {
                modalAuth.classList.add('hidden');
                realizarLiberacao(`Supervisor (${currentUser.user_metadata?.full_name || currentUser.email.split('@')[0]})`);
            } else {
                showToast("Senha de supervisor incorreta!", true);
            }
        };
    } else {
        // Liberar normalmente
        realizarLiberacao();
    }
};

function calculateCommission(prof, item, budget) {
    const tipo = prof.tipo;
    const rules = prof.comissions || {}; // Nota: o banco usa 'comissions' com double 's' no JSON
    const valor = parseFloat(item.valor) || 0;
    const qtde = parseInt(item.qtde) || 1;
    const totalItem = valor * qtde;
    const valorProtetico = parseFloat(item.valor_protetico) || 0;

    let percComissao = 0;
    if (tipo === 'Clinico') percComissao = parseFloat(rules.cc) || parseFloat(rules.ce) || 0;
    else if (tipo === 'Especialista') percComissao = parseFloat(rules.ec) || parseFloat(rules.ee) || 0;
    else if (tipo === 'Protetico') percComissao = parseFloat(rules.cp) || 0;

    // Regra: (Valor total - Custo Protético)
    const baseLiquida = totalItem - valorProtetico;
    if (baseLiquida <= 0) return 0;

    // Verificar impostos com base na forma de pagamento
    const pagamentos = (budget.pagamentos || []).concat(
        (budget.pagamentos_financeiro_extra || []).map(p => ({
            forma_pagamento: p && p.forma_pagamento,
            data_pagamento: p && p.data_transacao
        }))
    );
    // Se houver QUALQUER pagamento que NÃO seja dinheiro, aplica imposto
    const temPagamentoComTaxa = pagamentos.some(p => p.forma_pagamento !== 'Dinheiro');

    let percImposto = 0;
    if (temPagamentoComTaxa) {
        percImposto = parseFloat(rules.imp) || 0;
    }

    // O imposto é uma porcentagem aplicada sobre a base líquida
    // Comissão = (BaseLiquida * (1 - Imposto/100)) * (PercComissao/100)
    const valorAposImposto = baseLiquida * (1 - (percImposto / 100));
    const comissaoFinal = (valorAposImposto * percComissao) / 100;

    return Math.max(0, comissaoFinal);
}

async function ensureBudgetCommissions(budget) {
    if (!budget) return;
    const tipoBudget = String(budget.tipo || 'Normal').trim();
    const tipoKey = normalizeKey(tipoBudget);
    const isFreeBudget = tipoKey === 'CORTESIA' || tipoKey === 'RETRABALHO';
    if (isFreeBudget) return;

    const itens = budget.orcamento_itens || budget.itens || [];
    const eligible = (itens || []).filter(it => ['Liberado', 'Em Execução', 'Finalizado'].includes(String(it && it.status || '')));
    if (!eligible.length) return;

    const ids = eligible.map(it => String(it && it.id || '')).filter(Boolean);
    if (!ids.length) return;

    let existing = [];
    try {
        let q = db.from('financeiro_comissoes').select('item_id,status,profissional_id').in('item_id', ids);
        if (!isSuperAdmin && currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
        const { data, error } = await withTimeout(q, 15000, 'financeiro_comissoes:exists_for_items');
        if (error) throw error;
        existing = Array.isArray(data) ? data : [];
    } catch (err) {
        return;
    }

    const hasAnyByItem = new Set(existing.map(r => String(r && r.item_id || '')).filter(Boolean));
    const toCreate = eligible.filter(it => !hasAnyByItem.has(String(it && it.id || '')));
    if (!toCreate.length) return;

    for (const it of toCreate) {
        const profId = it && it.profissional_id;
        const profissional = professionals.find(p => String(p.seqid) === String(profId));
        if (!profissional) continue;
        const valorComissao = calculateCommission(profissional, it, budget);
        if (!(valorComissao > 0)) continue;

        const comissaoData = {
            profissional_id: profId,
            item_id: it.id,
            valor_comissao: valorComissao,
            status: 'PENDENTE',
            empresa_id: currentEmpresaId
        };
        try {
            const { error } = await withTimeout(db.from('financeiro_comissoes').insert(comissaoData), 15000, 'financeiro_comissoes:insert_missing');
            if (error) throw error;
        } catch (err2) {
        }
    }
}

// Modal Budget Detail Close Listeners
(function () {
    const btn1 = document.getElementById('btnCloseBudgetDetail');
    const btn2 = document.getElementById('btnCloseBudgetDetail2');
    const modal = document.getElementById('budgetDetailModal');
    if (btn1) btn1.onclick = () => modal.classList.add('hidden');
    if (btn2) btn2.onclick = () => modal.classList.add('hidden');
})();

window.finalizeBudgetItem = async function (budgetId, itemId) {
    if (!confirm('Confirmar a conclusão deste serviço?')) return;

    try {
        const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
        if (!budget) return;

        // 1. Atualizar o item para Finalizado no banco
        const { error: itErr } = await db.from('orcamento_itens')
            .update({ status: 'Finalizado' })
            .eq('id', itemId);

        if (itErr) throw itErr;

        // 2. Atualizar estado local
        const item = (budget.orcamento_itens || []).find(it => it.id === itemId);
        if (item) item.status = 'Finalizado';

        // 3. Verificar se TODOS os itens do orçamento estão Finalizados
        const todosFinalizados = (budget.orcamento_itens || []).every(it => it.status === 'Finalizado');

        if (todosFinalizados) {
            // Mudar o status global do orçamento para Executado
            const { error: bErr } = await db.from('orcamentos')
                .update({ status: 'Executado' })
                .eq('id', budget.id);

            if (!bErr) {
                budget.status = 'Executado';
                showToast('Orçamento concluído e marcado como Executado! 🎉');
            }
        } else {
            showToast('Item marcado como Finalizado.');
        }

        // 4. Refresh na interface
        viewBudgetPayments(budgetId);
        renderTable(budgets, 'budgets');

    } catch (err) {
        console.error('Erro ao finalizar item:', err);
        showToast('Erro ao finalizar item no banco de dados.', true);
    }
};

// ==========================================
// CANCELLATION & AUDIT LOGIC
// ==========================================

async function validateCancellation(budget) {
    const totalPago = parseFloat(budget.total_pago) || 0;
    const itens = budget.orcamento_itens || [];
    
    // Buscar todas as comissões vinculadas aos itens deste orçamento
    const itemIds = itens.map(it => it.id);
    let hasCommissions = false;
    let hasPaidCommissions = false;
    let comissoesPagas = [];
    let comissoesPendentes = [];

    if (itemIds.length > 0) {
        const { data: coms, error } = await db.from('financeiro_comissoes')
            .select('*')
            .in('item_id', itemIds);
        
        if (!error && coms) {
            hasCommissions = coms.length > 0;
            comissoesPagas = coms.filter(c => c.status === 'PAGA');
            comissoesPendentes = coms.filter(c => c.status !== 'PAGA');
            hasPaidCommissions = comissoesPagas.length > 0;
        }
    }

    let cancelCase = 1; // Default: Case 1 (Direct)
    let message = "";
    let risks = [];

    if (totalPago > 0 || hasCommissions) {
        if (hasPaidCommissions) {
            cancelCase = 3;
            risks.push(`Este orçamento possui R$ ${totalPago.toFixed(2)} em pagamentos e COMISSÕES JÁ PAGAS aos profissionais.`);
            message = "Caso CRÍTICO: Requer autorização do Admin para estornar comissões e pagamentos.";
        } else if (totalPago > 0) {
            cancelCase = 2;
            risks.push(`Este orçamento possui R$ ${totalPago.toFixed(2)} em pagamentos realizados.`);
            message = "Caso FINANCEIRO: O sistema realizará o estorno automático para o saldo do paciente.";
        } else {
            // Has commissions but none paid
            cancelCase = 2; 
            message = "Caso ADMINISTRATIVO: As comissões pendentes serão removidas.";
        }
    }

    return { 
        cancelCase, 
        message, 
        risks, 
        totalPago, 
        comissoesPagas, 
        comissoesPendentes 
    };
}

async function processBudgetCancel(budget, motivo, analysis = { cancelCase: 1 }) {
    showToast("Processando cancelamento...");

    try {
        const currentUserData = await db.auth.getUser();
        const userId = currentUserData.data.user.id;
        const userName = currentUserData.data.user.user_metadata?.full_name || currentUserData.data.user.email;

        // Buscar o seqid do paciente para as tabelas financeiras
        const patientObj = patients.find(p => p.id === budget.pacienteid);
        const pacienteSeqId = patientObj ? parseInt(patientObj.seqid) : null;

        if (!pacienteSeqId) {
            throw new Error(`Não foi possível encontrar o ID numérico (seqid) do paciente ${budget.pacientenome}.`);
        }

        // Detalhes das comissões para o log
        const detalhePagas = (analysis.comissoesPagas || []).map(c => `Item ID: ${c.item_id}, Valor: R$ ${c.valor_comissao.toFixed(2)}`).join(' | ');
        const detalheEstornadas = (analysis.comissoesPendentes || []).map(c => `Item ID: ${c.item_id}, Valor: R$ ${c.valor_comissao.toFixed(2)}`).join(' | ');

        // 1. Registrar LOG de Auditoria
        const logEntry = {
            orcamento_id: budget.id,
            orcamento_seqid: budget.seqid,
            paciente_id: pacienteSeqId,
            paciente_nome: budget.pacientenome,
            total_pago_na_epoca: analysis.totalPago || 0,
            comissoes_pagas_detalhe: detalhePagas || 'Nenhuma',
            comissoes_estornadas_detalhe: detalheEstornadas || 'Nenhuma',
            motivo_cancelamento: motivo,
            cancelado_por_id: userId,
            cancelado_por_nome: userName,
            empresa_id: currentEmpresaId
        };

        const { error: logErr } = await db.from('orcamento_cancelados').insert(logEntry);
        if (logErr) throw logErr;

        // 2. Atualizar Status do Orçamento e Itens
        const { error: budErr } = await db.from('orcamentos').update({ status: 'Cancelado' }).eq('id', budget.id);
        if (budErr) throw budErr;

        const { error: itemErr } = await db.from('orcamento_itens').update({ status: 'Cancelado' }).eq('orcamento_id', budget.id);
        if (itemErr) throw itemErr;

        // 3. Tratar ESTORNOS FINANCEIROS (Casos 2 e 3)
        if (analysis.totalPago > 0) {
            // Estorno automático: gera um CRÉDITO na conta corrente do paciente (saldo em aberto)
            // O pagamento efetivo ao paciente (saída de caixa) deve ser registrado depois como REEMBOLSO (DÉBITO).
            const refundTransaction = {
                paciente_id: pacienteSeqId,
                tipo: 'CREDITO',
                categoria: 'ESTORNO',
                valor: analysis.totalPago,
                observacoes: `Crédito de estorno gerado via cancelamento do Orçamento #${budget.seqid}. Motivo: ${motivo}`,
                referencia_id: budget.seqid,
                empresa_id: currentEmpresaId,
                criado_por: userId
            };

            const { error: transErr } = await db.from('financeiro_transacoes').insert(refundTransaction);
            if (transErr) {
                console.error("Erro ao gerar estorno financeiro:", transErr);
                showToast("Falha ao gerar ESTORNO automático no Financeiro. Não registre REEMBOLSO até corrigir.", true);
            } else {
                showToast("ESTORNO automático gerado no Financeiro (crédito em conta).");
                // Caso 2: Gerar termo se houver estorno de pagamento (mesmo sem comissões pagas)
                if (analysis.cancelCase === 2) {
                    generateCancellationTerm(budget, analysis, motivo, userName);
                }
            }
        }

        // 4. Tratar COMISSÕES (Casos 2 e 3)
        const itemIds = (budget.orcamento_itens || []).map(i => i.id);
        if (itemIds.length > 0) {
            // Caso 2: Remover comissões pendentes
            const { error: delComErr } = await db.from('financeiro_comissoes')
                .delete()
                .in('item_id', itemIds)
                .eq('status', 'PENDENTE');
            if (delComErr) console.warn("Erro ao remover comissões pendentes:", delComErr);

            // Caso 3: Estornar comissões pagas
            if (analysis.cancelCase === 3) {
                if (analysis.comissoesPagas.length > 0) {
                    const { error: updComErr } = await db.from('financeiro_comissoes')
                        .update({ status: 'ESTORNADA' })
                        .in('item_id', itemIds)
                        .eq('status', 'PAGA');
                    if (updComErr) console.error("Erro ao estornar comissões pagas:", updComErr);
                }
                
                // Registro no Prontuário (Evolução) - Apenas para Caso 3
                const evolucaoEntry = {
                    paciente_id: budget.pacienteid,
                    descricao: `ORÇAMENTO CANCELADO (#${budget.seqid}): Cancelamento crítico realizado. Estorno de R$ ${analysis.totalPago.toFixed(2)} e comissões processados. Motivo: ${motivo}`,
                    empresa_id: currentEmpresaId,
                    created_by: userId
                };
                await db.from('paciente_evolucao').insert(evolucaoEntry);

                // Emissão de Documento (Sempre gera no Caso 3)
                generateCancellationTerm(budget, analysis, motivo, userName);
            }
        }

        // 5. Notificar Admin e Paciente (Simulação)
        const emailMsg = `E-mails de notificação enviados para ${budget.pacienteemail} e administrador.`;
        console.log(`[EMAIL] Para Paciente (${budget.pacienteemail}): Seu orçamento #${budget.seqid} foi cancelado. Valor estornado: R$ ${analysis.totalPago.toFixed(2)}`);
        console.log(`[EMAIL] Para Admin: Orçamento #${budget.seqid} cancelado por ${userName}. Motivo: ${motivo}. Caso: ${analysis.cancelCase}`);

        // 6. Atualizar Interface Local
        const bIdx = budgets.findIndex(b => b.id === budget.id);
        if (bIdx !== -1) {
            budgets[bIdx].status = 'Cancelado';
        }

        showToast(`Orçamento #${budget.seqid} CANCELADO com sucesso! ${emailMsg}`);
        renderTable(budgets, 'budgets');

    } catch (err) {
        console.error("Erro no processo de cancelamento:", err);
        const errorMsg = err.message || "Erro desconhecido";
        const errorCode = err.code || "";
        showToast(`Erro crítico ao processar cancelamento (${errorCode}): ${errorMsg}`, true);
    }
}

function generateCancellationTerm(budget, analysis, motivo, autorizador) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const modal = document.getElementById('cancellationTermModal');
    const body = document.getElementById('cancellationTermBody');
    
    if (!modal || !body) return;

    const perfilLabel = ((currentUserRole || (isSuperAdmin ? 'admin' : '')) || 'admin').toUpperCase();
    const empresaLabel = getEmpresaName(currentEmpresaId);
    const html = `
        <div class="term-print-container">
            <div class="term-header">
                <div style="font-size: 22px; font-weight: bold; color: #000;">TERMO DE CANCELAMENTO E ESTORNO</div>
                <div style="margin-top: 5px;">Orçamento #${budget.seqid}</div>
                <div style="margin-top: 4px; font-size: 12px; font-weight: 600; color: #6b7280;">${empresaLabel}</div>
            </div>
            
            <div style="margin: 30px 0;">
                <p>Eu, <strong>${budget.pacientenome}</strong>, declaro estar ciente do cancelamento do orçamento supracitado nesta data (${hoje}).</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #000;">
                    <tr style="border-bottom: 1px solid #000;"><td style="padding: 10px; font-weight: bold; width: 30%;">Motivo:</td><td style="padding: 10px;">${motivo}</td></tr>
                    <tr style="border-bottom: 1px solid #000;"><td style="padding: 10px; font-weight: bold;">Crédito em conta (estorno):</td><td style="padding: 10px;">R$ ${analysis.totalPago.toFixed(2)}</td></tr>
                    <tr style="border-bottom: 1px solid #000;"><td style="padding: 10px; font-weight: bold;">Autorizado por:</td><td style="padding: 10px;">${perfilLabel}</td></tr>
                    <tr class="no-print"><td style="padding: 10px; font-weight: bold;">Registrado por:</td><td style="padding: 10px;">${autorizador}</td></tr>
                </table>

                <p style="text-align: justify;">Este documento comprova o cancelamento e a geração de crédito na conta corrente virtual do paciente no sistema.</p>
                <p style="text-align: justify;">Caso seja efetuado reembolso ao paciente (PIX/dinheiro), o registro financeiro correspondente será lançado separadamente como REEMBOLSO para baixar o crédito.</p>
            </div>

            <div class="term-footer">
                <div class="sig-box">
                    <strong>${budget.pacientenome}</strong><br>Paciente / Responsável
                </div>
                <div class="sig-box">
                    <strong>${empresaLabel}</strong><br>Clínica / Consultório
                </div>
            </div>
        </div>
    `;
    
    body.innerHTML = html;
    modal.classList.remove('hidden');
}

function openPrintWindow(innerHtml, title = 'Termo de Cancelamento') {
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) { showToast('Habilite pop-ups para imprimir.', true); return; }

    const doc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page { margin: 12mm 8mm 12mm 12mm; }
    * { box-sizing: border-box; }
    html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
    body { margin: 0; color: #000; background: #fff; font-family: serif; line-height: 1.5; }
    .no-print { display: none !important; }
    .term-print-container { color: #000; max-width: 100%; }
    .term-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
    .term-footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 50px; }
    .sig-box { flex: 1 1 0; min-width: 0; text-align: center; border-top: 1px solid #000; padding-top: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { word-break: break-word; }
  </style>
</head>
<body>${innerHtml}</body>
</html>`;

    win.document.open();
    win.document.write(doc);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
}

window.printCancellationTerm = function () {
    const body = document.getElementById('cancellationTermBody');
    if (!body) return;
    openPrintWindow(body.innerHTML, 'Termo de Cancelamento');
};

window.reprintCancellationTerm = async function (logId) {
    try {
        const { data: log, error } = await db.from('orcamento_cancelados').select('*').eq('id', logId).single();
        if (error) throw error;

        const hoje = log.data_cancelamento ? new Date(log.data_cancelamento).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
        const total = Number(log.total_pago_na_epoca || 0).toFixed(2);
        const motivo = log.motivo_cancelamento || '-';
        const autorizador = log.cancelado_por_nome || '-';
        const perfilLabel = 'ADMIN';
        const paciente = log.paciente_nome || '-';
        const orcSeq = log.orcamento_seqid || '-';
        const empresaLabel = getEmpresaName(log.empresa_id || currentEmpresaId);

        const html = `
            <div class="term-print-container">
                <div class="term-header">
                    <div style="font-size: 22px; font-weight: bold; color: #000;">TERMO DE CANCELAMENTO E ESTORNO</div>
                    <div style="margin-top: 5px;">Orçamento #${orcSeq}</div>
                    <div style="margin-top: 4px; font-size: 12px; font-weight: 600; color: #6b7280;">${empresaLabel}</div>
                </div>
                
                <div style="margin: 30px 0;">
                    <p>Eu, <strong>${paciente}</strong>, declaro estar ciente do cancelamento do orçamento supracitado nesta data (${hoje}).</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #000;">
                        <tr style="border-bottom: 1px solid #000;"><td style="padding: 10px; font-weight: bold; width: 30%;">Motivo:</td><td style="padding: 10px;">${motivo}</td></tr>
                        <tr style="border-bottom: 1px solid #000;"><td style="padding: 10px; font-weight: bold;">Crédito em conta (estorno):</td><td style="padding: 10px;">R$ ${total}</td></tr>
                        <tr style="border-bottom: 1px solid #000;"><td style="padding: 10px; font-weight: bold;">Autorizado por:</td><td style="padding: 10px;">${perfilLabel}</td></tr>
                    </table>

                    <p style="text-align: justify;">Este documento comprova o cancelamento e a geração de crédito na conta corrente virtual do paciente no sistema.</p>
                    <p style="text-align: justify;">Caso seja efetuado reembolso ao paciente (PIX/dinheiro), o registro financeiro correspondente será lançado separadamente como REEMBOLSO para baixar o crédito.</p>
                </div>

                <div class="term-footer">
                    <div class="sig-box">
                        <strong>${paciente}</strong><br>Paciente / Responsável
                    </div>
                    <div class="sig-box">
                        <strong>${empresaLabel}</strong><br>Clínica / Consultório
                    </div>
                </div>
            </div>
        `;

        openPrintWindow(html, `Termo de Cancelamento - Orçamento #${orcSeq}`);
    } catch (err) {
        console.error("Erro ao reimprimir termo:", err);
        showToast("Erro ao reimprimir termo.", true);
    }
};

async function viewCancelledBudgets() {
    const loader = document.getElementById('cancelledBudgetsLoader');
    if (loader) loader.classList.remove('hidden');

    try {
        if (window.__dpDebug) window.__dpDebug.lastStep = 'cancelados: start';
        let query = db.from('orcamento_cancelados')
            .select('*')
            .order('data_cancelamento', { ascending: false });

        if (!isSuperAdmin && currentEmpresaId) {
            query = query.eq('empresa_id', currentEmpresaId);
        }
        if (window.__dpDebug) window.__dpDebug.lastStep = 'cancelados: querying';

        const { data, error } = await withTimeout(query, 15000, 'orcamento_cancelados');

        if (error) throw error;
        if (window.__dpDebug) {
            window.__dpDebug.lastDataLen = Array.isArray(data) ? data.length : (data ? 1 : 0);
            window.__dpDebug.lastStep = 'cancelados: got response';
        }

        renderTable(data || [], 'cancelled_budgets');
        if (window.__dpDebug) {
            const body = document.getElementById('cancelledBudgetsTableBody');
            window.__dpDebug.lastRenderRows = body ? body.children.length : null;
            window.__dpDebug.lastStep = 'cancelados: rendered';
        }
        if (!data || data.length === 0) {
            showToast(`Nenhum log de cancelamento encontrado para a unidade [${currentEmpresaId || '-'}].`, true);
        }
    } catch (err) {
        console.error("Erro ao buscar logs de cancelamento:", err);
        showToast(`Erro ao carregar auditoria (orcamento_cancelados): ${err.code || '-'} / ${err.message || 'Erro desconhecido'}`, true);
    } finally {
        if (loader) loader.classList.add('hidden');
        clearLoadTimer('cancelledBudgets');
    }
}

async function showCancelDetails(logId) {
    try {
        const { data: log, error } = await db.from('orcamento_cancelados').select('*').eq('id', logId).single();
        if (error) throw error;

        // Reutilizar modal de detalhes se houver (ou criar um novo específico)
        // Por simplicidade, usaremos um alert customizado ou expandiremos o log futuramente
        alert(`DETALHES DA AUDITORIA:\n\n` +
            `Orçamento: #${log.orcamento_seqid}\n` +
            `Paciente: ${log.paciente_nome}\n` +
            `Data: ${new Date(log.data_cancelamento).toLocaleString('pt-BR')}\n` +
            `Total Pago na Época: R$ ${Number(log.total_pago_na_epoca).toFixed(2)}\n` +
            `Responsável: ${log.cancelado_por_nome}\n` +
            `Motivo: ${log.motivo_cancelamento}`);

    } catch (err) {
        console.error("Erro ao ver detalhes:", err);
        showToast("Erro ao carregar detalhes.", true);
    }
}


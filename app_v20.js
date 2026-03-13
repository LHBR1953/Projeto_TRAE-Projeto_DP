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
const APP_BUILD = '20260312-0755';

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
let activeEmpresasList = []; // Store companies list for admins
let transactions = []; // Global transactions state


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

    // Clear current state
    patients = [];
    professionals = [];
    specialties = [];
    services = [];
    budgets = [];

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
            { key: 'profissionais', required: true, timeoutMs: 25000, promise: db.from('profissionais').select('id, seqid, nome, celular, email, tipo, status, especialidadeid, empresa_id').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }) },
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
    { id: 'agenda', label: 'Agenda' }
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

// Dashboard DOM Elements
const dashDate = document.getElementById('dashDate');
const dashProfessional = document.getElementById('dashProfessional');
const btnDashRefresh = document.getElementById('btnDashRefresh');
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
        'navAgenda': 'agenda'
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
        navBudgets, navFinanceiro, navCommissions, navAtendimento, navAgenda, navUsersAdminBtn, navEmpresas, document.getElementById('navCancelledBudgets')
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
                    <span style="background: var(--bg-hover); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                        ${b.status || 'Pendente'}
                    </span>
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
            subSelect.innerHTML = '<option value="">Nenhuma / Geral</option>';
            specialties.forEach(spec => {
                if (spec.subdivisoes && spec.subdivisoes.length > 0) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = `${spec.seqid} - ${spec.nome} `;

                    spec.subdivisoes.forEach((sub, i) => {
                        const subId = `${spec.seqid}.${i + 1} `;
                        const displayStr = `${subId} - ${sub.nome} `;
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
        renderTable(budgets, 'budgets');
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
        byPaciente.forEach((list, pacienteSeqIdStr) => {
            const paciente = getPacienteDetailsBySeqId(pacienteSeqIdStr);
            const pacienteUuid = paciente?.id || null;
            if (!pacienteUuid) return;

            const patientBudgets = (budgets || []).filter(b => String(b.pacienteid || b.paciente_id || '') === String(pacienteUuid));
            patientBudgets.forEach(b => {
                const itens = (b.orcamento_itens || b.itens || []);
                itens.forEach(it => {
                    const executor = it.profissional_id ?? it.profissionalId ?? it.executor_id ?? it.executorId;
                    if (String(executor || '') !== String(profSeqId)) return;

                    const st = String(it.status || it.item_status || '').trim();
                    if (st && normalizeKey(st) === 'FINALIZADO') return;

                    const firstAg = list[0];
                    const hora = firstAg && firstAg.inicio ? formatTimeHHMM(new Date(firstAg.inicio)) : '--:--';
                    const agId = firstAg && firstAg.id ? String(firstAg.id) : '';

                    const serv = (services || []).find(s => String(s.id) === String(it.servico_id || it.servicoId || ''));
                    const desc = serv ? serv.descricao : (it.servicoDescricao || it.descricao || `#${it.servico_id || it.servicoId || it.id || ''}`);
                    const sub = String(it.subdivisao || it.sub_divisao || '').trim();
                    const itemLabel = sub ? `${desc} — ${sub}` : desc;

                    itemsRows.push({
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
        });

        itemsRows.sort((a, b) => a.hora.localeCompare(b.hora) || String(a.paciente?.nome || '').localeCompare(String(b.paciente?.nome || ''), 'pt-BR'));

        const profName = getProfessionalNameBySeqId(profSeqId);
        if (atendimentoSummary) atendimentoSummary.textContent = `${profName} — ${dateStr.split('-').reverse().join('/')} • ${itemsRows.length} itens`;

        if (!itemsRows.length) {
            if (atendimentoBody) atendimentoBody.innerHTML = '';
            if (atendimentoEmptyState) atendimentoEmptyState.classList.remove('hidden');
            return;
        }

        if (!atendimentoBody) return;
        atendimentoBody.innerHTML = '';
        itemsRows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:800;">${escapeHtml(r.hora)}</td>
                <td style="font-weight:600;">${escapeHtml(r.paciente?.nome || '-')}</td>
                <td style="white-space: normal;">${escapeHtml(r.itemLabel || '-')}</td>
                <td style="text-align:center; font-weight:800;">${escapeHtml(String(r.budget?.seqid || '-'))}</td>
                <td>${escapeHtml(String(r.itemStatus || '-'))}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" data-action="finish" data-agendamento="${escapeHtml(r.agendamentoId || '')}" data-item="${escapeHtml(r.itemId || '')}"><i class="ri-flag-line"></i> Finalizar</button>
                    <button class="btn btn-secondary btn-sm" data-action="note" data-patient="${escapeHtml(r.paciente?.id || '')}" data-prof="${escapeHtml(String(profSeqId))}" data-date="${escapeHtml(dateStr)}" data-time="${escapeHtml(r.hora)}" data-budget="${escapeHtml(r.budget?.id || '')}" data-budgetseq="${escapeHtml(String(r.budget?.seqid || ''))}" data-item="${escapeHtml(r.itemId || '')}" data-itemlabel="${escapeHtml(r.itemLabel || '')}" data-agendamento="${escapeHtml(r.agendamentoId || '')}"><i class="ri-file-edit-line"></i> Evolução</button>
                    <button class="btn-icon" data-action="patient" data-patient="${escapeHtml(r.paciente?.id || '')}" title="Prontuário"><i class="ri-folder-user-line"></i></button>
                    <button class="btn-icon" data-action="budgetView" data-budget="${escapeHtml(r.budget?.id || '')}" title="Orçamento"><i class="ri-file-list-3-line"></i></button>
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

        showToast('Atendimento finalizado.');
        await fetchAtendimentoForUI();
    } catch (err) {
        console.error('Erro ao confirmar atendimento:', err);
        const code = err && err.code ? err.code : '-';
        const msg2 = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao confirmar atendimento (${code}): ${msg2}`, true);
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
        const chunkSize = 200;
        for (let i = 0; i < itemIds.length; i += chunkSize) {
            const chunk = itemIds.slice(i, i + chunkSize);
            const q = db.from('orcamento_itens').select('id, servico_id').in('id', chunk);
            const { data, error } = await withTimeout(q, 15000, 'orcamento_itens');
            if (error) throw error;
            (data || []).forEach(it => itemToServico.set(String(it.id), String(it.servico_id)));
        }

        (rows || []).forEach(r => {
            const sid = itemToServico.get(String(r.item_id || ''));
            if (!sid) return;
            r._servicoId = sid;
            const serv = (services || []).find(s => String(s.id) === String(sid));
            r._itemDescricao = serv ? serv.descricao : `Serviço ${sid}`;
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

        const dispQ = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .eq('dia_semana', diaSemana)
            .eq('ativo', true);
        const { data: disp, error: dispErr } = await withTimeout(dispQ, 15000, 'agenda_disponibilidade');
        if (dispErr) throw dispErr;

        if (!disp || disp.length === 0) {
            if (agendaSlotsBody) agendaSlotsBody.innerHTML = '';
            if (agendaEmptyState) agendaEmptyState.classList.remove('hidden');
            if (agendaSummary) agendaSummary.textContent = 'Sem disponibilidade cadastrada.';
            return;
        }

        window.__agendaLast = window.__agendaLast || { empresaId: null, profSeqId: null, dateStr: null, disponibilidade: [], agendamentos: [] };
        window.__agendaLast.empresaId = empresaId;
        window.__agendaLast.profSeqId = Number(profSeqId);
        window.__agendaLast.dateStr = dateStr;
        window.__agendaLast.disponibilidade = disp || [];

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

        window.__agendaLast.agendamentos = ags || [];

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
    disponibilidade.forEach(d => {
        const startM = parseTimeToMinutes(d.hora_inicio);
        const endM = parseTimeToMinutes(d.hora_fim);
        const step = Number(d.slot_minutos || 30);
        if (startM == null || endM == null || !step) return;

        for (let m = startM; m + step <= endM; m += step) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            slots.push({ time: `${hh}:${mm}`, step });
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

    const profName = getProfessionalNameBySeqId(profSeqId);
    if (agendaSummary) agendaSummary.textContent = `${profName} — ${dateStr.split('-').reverse().join('/')}`;

    agendaSlotsBody.innerHTML = '';
    slots.sort((a, b) => a.time.localeCompare(b.time)).forEach(s => {
        const a = byStart.get(s.time);
        const pacienteHtml = a
            ? (a.paciente_id ? getPacienteSummaryHtmlBySeqId(a.paciente_id) : `<span style="color: var(--text-muted);">${a.titulo || '(Sem paciente)'}</span>`)
            : '';
        const status = a ? String(a.status || 'MARCADO') : 'LIVRE';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${s.time}</td>
            <td>${a ? (pacienteHtml || '-') : '-'}</td>
            <td>${status}</td>
            <td>
                ${a ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}"><i class="ri-edit-line"></i> Editar</button>` :
            `<button class="btn btn-primary btn-sm" data-action="new" data-time="${s.time}" data-step="${s.step}"><i class="ri-add-line"></i> Agendar</button>`}
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

    return slots
        .sort((a, b) => a.time.localeCompare(b.time))
        .map(s => {
            const a = byStart.get(s.time);
            if (!a) {
                return `<tr><td style="width: 90px; font-weight:700;">${s.time}</td><td style="color:#6b7280;">—</td><td style="width: 120px;">LIVRE</td></tr>`;
            }

            const p = a.paciente_id ? getPacienteDetailsBySeqId(a.paciente_id) : null;
            const paciente = p ? (p.nome || '-') : (a.titulo || '(Sem paciente)');
            const cpf = p && p.cpf ? p.cpf : '';
            const cel = p && p.celular ? p.celular : '';
            const em = p && p.email ? p.email : '';
            const meta = [cpf && `CPF: ${cpf}`, cel && `Cel: ${cel}`, em && `Email: ${em}`].filter(Boolean).join(' • ');
            const status = String(a.status || 'MARCADO');

            return `
                <tr>
                    <td style="width: 90px; font-weight:700;">${s.time}</td>
                    <td>
                        <div style="font-weight:700;">${paciente}</div>
                        ${meta ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${meta}</div>` : ''}
                    </td>
                    <td style="width: 120px;">${status}</td>
                </tr>
            `;
        })
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
            if (!hasDisp) {
                return `<td style="height: 52px; background: #fff;"></td>`;
            }
            const a = agByDateTime.get(`${d.dateStr}|${t}`);
            const pat = a && a.paciente_id ? getPacienteDetailsBySeqId(a.paciente_id) : null;
            const name = a ? (pat ? String(pat.nome || '') : String(a.titulo || '')) : '';
            const cel = pat ? String(pat.celular || '') : '';
            return `
                <td style="height: 52px; padding: 6px; text-align:center;">
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
        if (id) {
            const { error } = await withTimeout(db.from('agenda_agendamentos').update(payload).eq('id', id).eq('empresa_id', currentEmpresaId), 15000, 'agenda_agendamentos:update');
            if (error) throw error;
            showToast('Agendamento atualizado.');
        } else {
            const { error } = await withTimeout(db.from('agenda_agendamentos').insert(payload), 15000, 'agenda_agendamentos:insert');
            if (error) throw error;
            showToast('Agendamento criado.');
        }
        closeAgendaModal();
        await fetchAgendaForUI();
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
        showToast(errors[0], true);
        return false;
    }

    try {
        const del = db.from('agenda_disponibilidade')
            .delete()
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId));
        const { error: delError } = await withTimeout(del, 15000, 'agenda_disponibilidade:delete');
        if (delError) throw delError;

        if (rows.length) {
            const { error: insError } = await withTimeout(db.from('agenda_disponibilidade').insert(rows), 15000, 'agenda_disponibilidade:insert');
            if (insError) throw insError;
        }

        return true;
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        console.error('Erro ao salvar agenda:', msg);
        showToast('Erro ao salvar agenda. Verifique se o SQL da agenda foi aplicado.', true);
        return false;
    }
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

if (atendimentoDate) atendimentoDate.addEventListener('change', () => fetchAtendimentoForUI());
if (atendimentoProfessional) atendimentoProfessional.addEventListener('change', () => fetchAtendimentoForUI());
if (btnAtendimentoRefresh) btnAtendimentoRefresh.addEventListener('click', () => fetchAtendimentoForUI());
if (btnCloseAtendimentoEvolucao) btnCloseAtendimentoEvolucao.addEventListener('click', closeAtendimentoEvolucaoModal);
if (btnCancelAtendimentoEvolucao) btnCancelAtendimentoEvolucao.addEventListener('click', closeAtendimentoEvolucaoModal);
if (btnSaveAtendimentoEvolucao) btnSaveAtendimentoEvolucao.addEventListener('click', async () => { await saveAtendimentoEvolucao(); });
if (atendimentoEvolucaoModal) atendimentoEvolucaoModal.addEventListener('click', (e) => { if (e.target === atendimentoEvolucaoModal) closeAtendimentoEvolucaoModal(); });
if (btnAgendaNew) btnAgendaNew.addEventListener('click', () => {
    if (!agendaDate || !agendaProfessional) return;
    const profSeqId = agendaProfessional.value;
    const dateStr = agendaDate.value;
    if (!profSeqId || !dateStr) { showToast('Selecione data e profissional.', true); return; }
    openAgendaModalNew({ dateStr, time: '08:00', step: 30, profSeqId: Number(profSeqId) });
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
        datanascimento: document.getElementById('dataNascimento').value,
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
        if (id) {
            // Edit existing
            const { error } = await db.from('pacientes').update(patientData).eq('id', id);
            if (error) throw error;

            const index = patients.findIndex(p => p.id === id);
            if (index !== -1) patients[index] = { ...patients[index], ...patientData };
            showToast('Paciente atualizado com sucesso!');
        } else {
            // Add new
            patientData.id = generateId(); // Using our generateId for sync matching with Supabase UUID constraint (needs valid format or text)
            // Or alternatively let supabase generate it and return it:
            // Since our DB uses TEXT for id, calculate seqId
            patientData.seqid = getNextSeqId(patients);

            const { data, error } = await db.from('pacientes').insert(patientData).select().single();
            if (error) throw error;

            if (data) {
                patients.push(data);
            }
            showToast('Paciente cadastrado com sucesso!');
        }
        showList('patients');
    } catch (error) {
        console.error("Error saving patient:", error);
        showToast("Erro ao salvar paciente no banco de dados.", true);
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
        if (id) {
            const { error } = await db.from('profissionais').update(profData).eq('id', id);
            if (error) throw error;

            const index = professionals.findIndex(p => p.id === id);
            if (index !== -1) professionals[index] = { ...professionals[index], ...profData };
            await saveAgendaDisponibilidade(profData.seqid, currentEmpresaId);
            showToast('Profissional atualizado com sucesso!');
        } else {
            profData.id = generateId();
            profData.seqid = getNextSeqId(professionals);

            const { data, error } = await db.from('profissionais').insert(profData).select().single();
            if (error) throw error;

            if (data) professionals.push(data);
            await saveAgendaDisponibilidade((data && data.seqid) ? data.seqid : profData.seqid, currentEmpresaId);
            showToast('Profissional cadastrado com sucesso!');
        }
        showList('professionals');
    } catch (error) {
        console.error("Error saving professional:", error);
        showToast("Erro ao salvar profissional.", true);
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
            const { error: delError } = await db.from('especialidade_subdivisoes').delete().eq('especialidade_id', targetId);
            if (delError) throw delError;

            const newSubs = [];
            for (let sub of currentSpecialtySubdivisions) {
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
                currentSpecialtySubdivisions[editingSubSpecIndex].nome = name;
                editingSubSpecIndex = -1;
                btnAddSubSpec.textContent = 'Adicionar';
                btnAddSubSpec.classList.remove('btn-primary');
                btnAddSubSpec.classList.add('btn-secondary');
            } else {
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
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td style="font-weight: 600;">${item.nome}</td>
                <td>${item.tipo}</td>
                <td>${item.especialidadeid ? getSpecialtyName(item.especialidadeid) : '-'}</td>
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
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td style="font-weight: 600;">${item.descricao}</td>
                <td>${item.subdivisao || '-'}</td>
                <td style="font-weight: 600; color: var(--primary-color);">R$ ${parseFloat(item.valor || 0).toFixed(2)}</td>
                <td>${item.ie === 'S' ? 'Serviço' : 'Estoque'}</td>
                <td>
                    <div class="actions">
                        <button onclick="printService('${item.id}')" class="btn-icon" title="Imprimir"><i class="ri-printer-line"></i></button>
                        <button onclick="editService('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                        <button onclick="deleteService('${item.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </td>
            `;
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
        const servData = {
            descricao: document.getElementById('servDescricao').value.toUpperCase(),
            valor: parseFloat(document.getElementById('servValor').value) || 0,
            ie: document.getElementById('servTipoIE').value,
            subdivisao: document.getElementById('servSubdivisao').value || '',
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
    document.getElementById('servSubdivisao').value = s.subdivisao || '';
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
    if (!serviceId) {
        // Se deselecionar, limpa os campos
        document.getElementById('budItemDescricao').value = '';
        document.getElementById('budItemSubdivisao').value = '-';
        document.getElementById('budItemValor').value = '';
        return false;
    }
    const serv = services.find(s => s.id === serviceId);
    if (serv) {
        document.getElementById('budItemDescricao').value = serv.descricao;

        const subSelect = document.getElementById('budItemSubdivisao');
        if (subSelect) {
            subSelect.value = serv.subdivisao || '';
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

    document.getElementById('budItemServicoId').value = item.servicoId || '';
    document.getElementById('budItemDescricao').value = item.servicoDescricao || '';
    document.getElementById('budItemSubdivisao').value = item.subdivisao || '';
    document.getElementById('budItemValor').value = item.valor !== undefined ? item.valor : '';
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
                                .signature-section {margin - top: 50px; page-break-inside: avoid; }
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
if (searchBudgetInput) {
    searchBudgetInput.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        const filtered = budgets.filter(b =>
            (b.seqid && b.seqid.toString().includes(term)) ||
            (b.pacientenome && b.pacientenome.toLowerCase().includes(term)) ||
            (b.pacientecelular && b.pacientecelular.includes(term))
        );
        renderTable(filtered, 'budgets');
    });
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
                                            <span><i class="ri-calendar-line"></i> ${formatDateTime(ev.created_at)}</span>
                                            <span><i class="ri-user-smile-line"></i> Profissional: <strong>${ev.profissionais?.nome || 'Não informado'}</strong></span>
                                        </div>
                                        <div class="evol-content">
                                            ${ev.dente_regiao ? `<p style="margin-bottom:0.5rem;"><strong>Dente/Região:</strong> ${ev.dente_regiao}</p>` : ''}
                                            ${ev.descricao}
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
    }

    budgetsList.forEach(b => {
        const k = String(Number(b && b.seqid));
        b.total_pago_financeiro_extra = extraSum.get(k) || 0;
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
            renderTable([], 'financeiro');
            if (window.__dpDebug) {
                const body = document.getElementById('finTransacoesBody');
                window.__dpDebug.lastRenderRows = body ? body.children.length : null;
                window.__dpDebug.lastStep = 'financeiro: rendered empty';
            }
            showToast(`Nenhum lançamento encontrado para a unidade [${currentEmpresaId || '-'}].`, true);
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
    if (btnFinBuscar) {
        btnFinBuscar.addEventListener('click', () => {
            const term = finPacienteSearch.value.toLowerCase();
            if (!term) {
                showToast("Digite o nome de um paciente para buscar.", true);
                return;
            }
            const patient = patients.find(p => p.nome.toLowerCase().includes(term));
            if (patient) {
                fetchTransactions(patient.seqid);
            } else {
                showToast("Paciente não encontrado.", true);
            }
        });
    }

    if (btnFinVerTodos) {
        btnFinVerTodos.addEventListener('click', () => {
            if (finPainelSaldo) finPainelSaldo.classList.add('hidden');
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
            const term = finPacienteSearch.value.toLowerCase();
            const patient = patients.find(p => p.nome.toLowerCase().includes(term));

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

    const totalPagoOrc = (budget.pagamentos || []).reduce((acc, curr) => acc + (parseFloat(curr.valor_pago) || 0), 0);
    const totalPagoFin = (financePaymentsFiltered || []).reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);
    const totalPago = totalPagoOrc + totalPagoFin;
    const saldo = totalOrcado - totalPago;

    const body = document.getElementById('budgetDetailBody');
    if (!body) return;

    const pagamentosOrc = budget.pagamentos || [];
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
                    <label>Observações</label>
                    <input type="text" id="payBudgetObs" placeholder="Ex: Pagamento 1a parcela" style="width: 100%;">
                </div>
            </div>
            <button class="btn btn-primary" onclick="recordBudgetPayment('${budget.id}')" style="margin-top: 1rem; width: 100%;">
                <i class="ri-save-line"></i> Confirmar Pagamento
            </button>
        </div>
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

    const valorInput = document.getElementById('payBudgetAmount');
    const formaInput = document.getElementById('payBudgetForma');
    const obsInput = document.getElementById('payBudgetObs');

    // Para type="number", o .value já vem no formato decimal (ex: "40.00")
    // Se usarmos .replace(/\./g, ''), "40.00" vira "4000"! Por isso o erro.
    const valor = parseFloat(valorInput.value);
    const forma = formaInput.value;
    const obs = obsInput.value;

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
            observacoes: obs,
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
                observacoes: `[Orçamento #${budget.seqid}] ${obs}`,
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

            if (profissional) {
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
            if (valorComissao > 0) {
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
                showToast("Item liberado!");
            }

            // --- NOVO: Debitar serviço no financeiro para controle de conta corrente ---
            try {
                const pacIdRaw = budget.pacienteid || budget.paciente_id;
                const patientObj = patients.find(p => p.id === pacIdRaw || p.seqid == pacIdRaw);
                const pacNumId = patientObj ? patientObj.seqid : (budget.pacienteseqid || budget.paciente_id);
                const desc = item.descricao || 'Serviço';
                const debitoData = {
                    paciente_id: pacNumId,
                    tipo: 'DEBITO',
                    categoria: 'PAGAMENTO', // Representa o consumo do serviço
                    valor: valorDesteItem,
                    observacoes: `[Consumo] ${desc} (Orçamento #${budget.seqid})`,
                    referencia_id: budget.seqid,
                    empresa_id: currentEmpresaId,
                    criado_por: currentUser.id
                };
                await db.from('financeiro_transacoes').insert(debitoData);
            } catch (debErr) {
                console.warn("Aviso: Não foi possível registrar o débito do serviço no financeiro.", debErr);
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
    const pagamentos = budget.pagamentos || [];
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


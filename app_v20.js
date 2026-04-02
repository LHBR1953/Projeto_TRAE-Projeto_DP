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

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const APP_BUILD = '20260325-1125';

const AUTO_SEED_SPECIALTIES = false;

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
let requirePasswordChange = false;
let privacyScreensaverTimerId = null;
let privacyScreensaverBound = false;
let privacyScreensaverAnimId = null;
let privacyScreensaverPos = { x: 0, y: 0, vx: 0.065, vy: 0.045, lastT: 0 };

// MASTER CONFIG: Change this email to transfer SuperAdmin ownership
const SUPER_ADMIN_EMAIL = 'lhbr@lhbr.com.br';

let patients = [];
let professionals = [];
let specialties = [];
let services = [];
let budgets = [];
let activeEmpresasList = []; // Store companies list for admins
let configPlanosList = [];
let transactions = []; // Global transactions state

function normalizeRole(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return '';
    const r = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/(^adm$|^admin$|^admim$|administrador|administrator)/.test(r)) return 'admin';
    if (/(dentista|especialista)/.test(r)) return 'dentista';
    if (/(protetico|lab|laboratorio)/.test(r)) return 'protetico';
    if (/(recepcao|recepcao|recepcionista)/.test(r)) return 'recepcao';
    if (/auxiliar/.test(r)) return 'auxiliar';
    return r;
}

function isAdminRole() {
    return normalizeRole(currentUserRole) === 'admin';
}

function isDentistRole() {
    return normalizeRole(currentUserRole) === 'dentista';
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


async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();

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
            console.log("DEBUG: SuperAdmin Logged in via fallback (no mapping found)");
        } else {
            console.warn("User record not found in clinician mapping (usuario_empresas). User ID:", currentUser.id, "Email:", currentUser.email);
            showToast("Seu usuário não está vinculado a nenhuma empresa (usuario_empresas). Contate o administrador para criar o vínculo.", true);
            await db.auth.signOut();
            return false;
        }
    } else {
        currentEmpresaId = (isSuperAdmin && savedEmpId && mappings && mappings.some(m => m.empresa_id === savedEmpId)) ? savedEmpId : mapping.empresa_id;
        currentUserRole = normalizeRole(mapping.perfil);
        currentUserPerms = (typeof mapping.permissoes === 'string') ? JSON.parse(mapping.permissoes) : (mapping.permissoes || {});
        requirePasswordChange = (mapping.require_password_change === true || String(mapping.require_password_change).toLowerCase() === 'true');
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

    setupAdminManualOCC();

    return true;
}

// Global Context Switcher
async function switchCompany(newEmpId) {
    console.log("DEBUG: Switching company context to:", newEmpId);
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
        'agenda': 'agenda',
        'protese': 'protese'
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
    const ids = ['occ_paciente_endereco', 'occ_paciente_bairro', 'occ_paciente_cidade', 'occ_paciente_numero', 'occ_paciente_complemento'];
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
    privacyScreensaverTimerId = setTimeout(() => {
        const appContainer = document.getElementById('appContainer');
        if (!appContainer || appContainer.style.display === 'none') return;
        showPrivacyScreensaver();
    }, 5 * 60 * 1000);
}

function initPrivacyScreensaver() {
    if (privacyScreensaverBound) return;
    privacyScreensaverBound = true;

    const activity = () => {
        hidePrivacyScreensaver();
        resetPrivacyScreensaverTimer();
    };

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, activity, { passive: true });
    });

    const overlay = document.getElementById('privacyScreensaver');
    if (overlay) overlay.addEventListener('click', activity);

    resetPrivacyScreensaverTimer();
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
        const hasFin = await existsAnyRow(
            db.from('financeiro_transacoes').select('id').eq('empresa_id', currentEmpresaId).eq('paciente_id', patSeq),
            'financeiro_transacoes'
        );
        if (hasFin) blocks.push('Financeiro');
        const hasFinDest = await existsAnyRow(
            db.from('financeiro_transacoes').select('id').eq('empresa_id', currentEmpresaId).eq('paciente_destino_id', patSeq),
            'financeiro_transacoes:destino'
        );
        if (hasFinDest) blocks.push('Financeiro');
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
        const hasCom = await existsAnyRow(
            db.from('financeiro_comissoes').select('id').eq('empresa_id', currentEmpresaId).eq('profissional_id', profSeq),
            'financeiro_comissoes'
        );
        if (hasCom) blocks.push('Comissões');
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
        db.from('servicos').select('id,descricao,subdivisao,subdivisao_id,ie,tipo_calculo,exige_elemento,seqid,valor').eq('empresa_id', empresaId),
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
        'orcamentos', 'orcamento_itens', 'orcamento_pagamentos', 'orcamento_cancelados',
        'financeiro_transacoes', 'financeiro_comissoes',
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
    if (btnPagamentosPacientes) btnPagamentosPacientes.style.display = (isSuperAdmin || isAdminRole()) ? '' : 'none';
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

        const results = await Promise.all([
            db.from('pacientes').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('profissionais').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('especialidades').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('especialidade_subdivisoes').select('*').eq('empresa_id', currentEmpresaId),
            db.from('servicos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('orcamentos').select('*, orcamento_itens(*)').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('orcamento_pagamentos').select('*').eq('empresa_id', currentEmpresaId),
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
        const paymentsRes = results[6];
        const empresasRes = results[7];

        if (budgetsRes && budgetsRes.error && isMissingEmbeddedRelationshipError(budgetsRes.error)) {
            const fallbackBud = await db.from('orcamentos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true });
            if (fallbackBud.error) throw fallbackBud.error;

            const itensRes = await db.from('orcamento_itens').select('*').eq('empresa_id', currentEmpresaId);
            if (itensRes.error) throw itensRes.error;

            const itens = itensRes.data || [];
            const byBudgetId = new Map();
            itens.forEach(it => {
                const k = String(it && it.orcamento_id || '');
                if (!k) return;
                if (!byBudgetId.has(k)) byBudgetId.set(k, []);
                byBudgetId.get(k).push(it);
            });

            (fallbackBud.data || []).forEach(b => {
                b.orcamento_itens = byBudgetId.get(String(b && b.id || '')) || [];
            });
            budgetsRes = fallbackBud;
        }

        if (patientsRes.error) throw patientsRes.error;
        if (professionalsRes.error) throw professionalsRes.error;
        if (specialtiesRes.error) throw specialtiesRes.error;
        if (subdivisionsRes.error) throw subdivisionsRes.error;
        if (servicesRes.error) throw servicesRes.error;
        if (budgetsRes.error) throw budgetsRes.error;
        // if (paymentsRes.error) throw paymentsRes.error; // Removed: Handled below
        if (empresasRes.error) throw empresasRes.error;

        patients = patientsRes.data || [];
        professionals = professionalsRes.data || [];
        activeEmpresasList = empresasRes.data || [];

        const currentEmpresaRow = (activeEmpresasList || []).find(e => String(e && e.id || '') === String(currentEmpresaId || '')) || null;
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
            const blockMsg = statusKey === 'PENDENTE'
                ? 'Sua assinatura está pendente. Entre em contato com o suporte.'
                : (vencExpired ? 'Seu período de uso expirou. Renove sua assinatura para continuar.' : '');

            if (blockMsg) {
                const loginError = document.getElementById('loginError');
                if (loginError) {
                    loginError.textContent = blockMsg;
                    loginError.style.display = 'block';
                }
                showToast(blockMsg, true);
                await db.auth.signOut();
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

        let allPayments = [];
        if (paymentsRes.error) {
            console.warn("Table 'orcamento_pagamentos' not found. Financial features disabled until SQL is applied.");
        } else {
            allPayments = paymentsRes.data || [];
        }

        // Attach payments to budgets
        budgets.forEach(b => {
            const bPayments = allPayments.filter(p => p.orcamento_id === b.seqid);
            b.pagamentos = bPayments;
            b.total_pago = bPayments.reduce((acc, curr) => acc + (parseFloat(curr.valor_pago) || 0), 0);
        });

        console.log("DEBUG Fetched Data Lengths:", {
            patients: patients.length,
            professionals: professionals.length,
            specialties: specialties.length,
            subdivisions: subdivisions.length,
            services: services.length,
            budgets: budgets.length,
            payments: allPayments.length
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
        showList('patients');
        if (isPasswordChangeEnforced()) showForcePasswordChangeModal();
        if (!isContextSwitch) {
            setupNavigationListeners();
        }

    } catch (error) {
        console.error("Error initializing app data from Supabase:", error);
        const code = error && error.code ? String(error.code) : '-';
        const msg = error && error.message ? String(error.message) : 'Erro desconhecido';
        showToast(`Erro ao carregar dados do servidor (${code}): ${msg}`, true);
        throw error; // Rethrow to propagate to loginForm listener so it can reset UI
    }
}

function getNextSeqId(collection) {
    if (!collection || collection.length === 0) return 1;
    let maxId = 0;
    collection.forEach(i => { if (i.seqid && i.seqid > maxId) maxId = i.seqid; });
    return maxId + 1;
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
document.addEventListener('DOMContentLoaded', initializeApp);

// Navigation Elements (Moved to setupNavigationListeners for attachment)
const sidebar = document.querySelector('.sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navPatients = document.getElementById('navPatients');
const navProfessionals = document.getElementById('navProfessionals');
const navSpecialties = document.getElementById('navSpecialties');
const navServices = document.getElementById('navServices');
const navBudgets = document.getElementById('navBudgets');
const navFinanceiro = document.getElementById('navFinanceiro');
const navCommissions = document.getElementById('navCommissions');
const navMarketing = document.getElementById('navMarketing');
const navDashboard = document.getElementById('navDashboard');
const navAtendimento = document.getElementById('navAtendimento');
const navAgenda = document.getElementById('navAgenda');
const navProtese = document.getElementById('navProtese');
const navEmpresas = document.getElementById('navEmpresas');
const navAssinaturas = document.getElementById('navAssinaturas');
const navMyCompany = document.getElementById('navMyCompany');
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
const assinaturasView = document.getElementById('assinaturasView');
const empresaFormView = document.getElementById('empresaFormView');
const financeiroView = document.getElementById('financeiroView');
const commissionsView = document.getElementById('commissionsView');
const marketingView = document.getElementById('marketingView');
const dashboardView = document.getElementById('dashboardView');
const atendimentoView = document.getElementById('atendimentoView');
const agendaView = document.getElementById('agendaView');
const proteseView = document.getElementById('proteseView');
const myCompanyView = document.getElementById('myCompanyView');
const btnAddNewEmpresa = document.getElementById('btnAddNewEmpresa');
const btnBackEmpresa = document.getElementById('btnBackEmpresa');
const btnCancelEmpresa = document.getElementById('btnCancelEmpresa');
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
    { id: 'marketing', label: 'Marketing' },
    { id: 'atendimento', label: 'Atendimento' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'protese', label: 'Produção Protética' }
];

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

const helpModal = document.getElementById('helpModal');
const helpModalTitle = document.getElementById('helpModalTitle');
const helpModalBody = document.getElementById('helpModalBody');
const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
const btnCloseHelpModal2 = document.getElementById('btnCloseHelpModal2');

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
const btnPagamentosPacientes = document.getElementById('btnPagamentosPacientes');
const movDiariaModal = document.getElementById('movDiariaModal');
const btnCloseMovDiariaModal = document.getElementById('btnCloseMovDiariaModal');
const btnCancelMovDiaria = document.getElementById('btnCancelMovDiaria');
const btnGenerateMovDiaria = document.getElementById('btnGenerateMovDiaria');
const movDiariaDate = document.getElementById('movDiariaDate');
const movDiariaProfessional = document.getElementById('movDiariaProfessional');
const pagamentosPacientesModal = document.getElementById('pagamentosPacientesModal');
const btnClosePagamentosPacientesModal = document.getElementById('btnClosePagamentosPacientesModal');
const btnCancelPagamentosPacientes = document.getElementById('btnCancelPagamentosPacientes');
const btnGeneratePagamentosPacientes = document.getElementById('btnGeneratePagamentosPacientes');
const pagamentosPacientesStart = document.getElementById('pagamentosPacientesStart');
const pagamentosPacientesEnd = document.getElementById('pagamentosPacientesEnd');
const pagamentosPacientesForma = document.getElementById('pagamentosPacientesForma');

// Agenda DOM Elements
const agendaDate = document.getElementById('agendaDate');
const agendaProfessional = document.getElementById('agendaProfessional');
const btnAgendaRefresh = document.getElementById('btnAgendaRefresh');
const btnAgendaNew = document.getElementById('btnAgendaNew');
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

// Atendimento DOM Elements
const atendimentoDate = document.getElementById('atendimentoDate');
const atendimentoProfessional = document.getElementById('atendimentoProfessional');
const atendimentoProfessionalGroup = document.getElementById('atendimentoProfessionalGroup');
const btnAtendimentoRefresh = document.getElementById('btnAtendimentoRefresh');
const btnAtendimentoFinalizeSelected = document.getElementById('btnAtendimentoFinalizeSelected');
const atendimentoSummary = document.getElementById('atendimentoSummary');
const atendimentoBody = document.getElementById('atendimentoBody');
const atendimentoEmptyState = document.getElementById('atendimentoEmptyState');
const btnFechamentoDiario = document.getElementById('btnFechamentoDiario');
const fechamentoDiarioModal = document.getElementById('fechamentoDiarioModal');
const btnCloseFechamentoDiarioModal = document.getElementById('btnCloseFechamentoDiarioModal');
const btnCancelFechamentoDiario = document.getElementById('btnCancelFechamentoDiario');
const btnGenerateFechamentoDiario = document.getElementById('btnGenerateFechamentoDiario');
const fechamentoDiarioDate = document.getElementById('fechamentoDiarioDate');
const fechamentoDiarioProfessional = document.getElementById('fechamentoDiarioProfessional');
const btnFechamentoDiarioFull = document.getElementById('btnFechamentoDiarioFull');
const fechamentoDiarioFullModal = document.getElementById('fechamentoDiarioFullModal');
const btnCloseFechamentoDiarioFullModal = document.getElementById('btnCloseFechamentoDiarioFullModal');
const btnCancelFechamentoDiarioFull = document.getElementById('btnCancelFechamentoDiarioFull');
const btnGenerateFechamentoDiarioFull = document.getElementById('btnGenerateFechamentoDiarioFull');
const fechamentoDiarioFullDate = document.getElementById('fechamentoDiarioFullDate');
const fechamentoDiarioFullProfessional = document.getElementById('fechamentoDiarioFullProfessional');

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
const btnCommAdvance = document.getElementById('btnCommAdvance');
const btnCommTransfer = document.getElementById('btnCommTransfer');
const btnCommPrint = document.getElementById('btnCommPrint');
const btnCommPrintReport = document.getElementById('btnCommPrintReport');
const commSelectAll = document.getElementById('commSelectAll');
const commSelectedTotal = document.getElementById('commSelectedTotal');

const commTransferModal = document.getElementById('commTransferModal');
const commTransferSummary = document.getElementById('commTransferSummary');
const commTransferNewProfessional = document.getElementById('commTransferNewProfessional');
const commTransferObs = document.getElementById('commTransferObs');
const btnCommTransferCancel = document.getElementById('btnCommTransferCancel');
const btnCommTransferConfirm = document.getElementById('btnCommTransferConfirm');

const modalSuperAdmin = document.getElementById('modalSuperAdmin');
const btnCloseModalSuperAdmin = document.getElementById('btnCloseModalSuperAdmin');
const btnSuperAdminClose = document.getElementById('btnSuperAdminClose');
const saEmpresa = document.getElementById('saEmpresa');
const saScope = document.getElementById('saScope');
const saTableWrap = document.getElementById('saTableWrap');
const saTable = document.getElementById('saTable');
const saClearAudit = document.getElementById('saClearAudit');
const saConfirm = document.getElementById('saConfirm');
const btnSaDryRun = document.getElementById('btnSaDryRun');
const btnSaExecute = document.getElementById('btnSaExecute');
const btnSaRefreshEmpresas = document.getElementById('btnSaRefreshEmpresas');
const saPlan = document.getElementById('saPlan');
const saResult = document.getElementById('saResult');

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
const subdivisionImportFile = document.getElementById('subdivisionImportFile');
const subdivisionImportSkipHeader = document.getElementById('subdivisionImportSkipHeader');
const btnSubdivisionImportParse = document.getElementById('btnSubdivisionImportParse');
const subdivisionImportStatus = document.getElementById('subdivisionImportStatus');
const subdivisionImportPreviewWrap = document.getElementById('subdivisionImportPreviewWrap');
const subdivisionImportPreviewBody = document.getElementById('subdivisionImportPreviewBody');
const btnConfirmSubdivisionImport = document.getElementById('btnConfirmSubdivisionImport');
const btnExportSubdivisionXlsx = document.getElementById('btnExportSubdivisionXlsx');
// Active State
let currentSpecialtySubdivisions = [];
let deletedSpecialtySubdivisionIds = new Set();
let editingSubSpecIndex = -1;
let currentBudgetItems = [];
let editingBudgetItemId = null;
let usersAdminList = []; // Cache for user management
let commissionsList = [];
let selectedCommissionIds = new Set();
let proteseOrders = [];
let proteseLabs = [];
let currentProteseOrder = null;
let protesePayables = [];
let protesePayablesFilteredRows = [];
let currentProtesePayable = null;

const btnOpenOdontograma = document.getElementById('btnOpenOdontograma');
const budItemOdontoDisplay = document.getElementById('budItemOdontoDisplay');
const budItemOdontoTeeth = document.getElementById('budItemOdontoTeeth');
const modalOdontograma = document.getElementById('modalOdontograma');
const btnCloseModalOdonto = document.getElementById('btnCloseModalOdonto');
const btnCancelOdonto = document.getElementById('btnCancelOdonto');
const btnConfirmOdonto = document.getElementById('btnConfirmOdonto');
const odontogramaSvg = document.getElementById('odontogramaSvg');

// Shared Inputs
const inputCpf = document.getElementById('cpf');
const inputCelular = document.getElementById('occ_paciente_celular');
const inputTelefone = document.getElementById('occ_paciente_telefone');
const inputCep = document.getElementById('occ_paciente_cep');
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
        'navMarketing': 'marketing',
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
    const navAssinaturas = document.getElementById('navAssinaturas');
    const navMyCompany = document.getElementById('navMyCompany');
    const navUsersAdmin = document.getElementById('navUsersAdmin');
    const navCancelledBudgets = document.getElementById('navCancelledBudgets');

    if (isAdminRole()) {
        if (navConfigSection) navConfigSection.style.display = 'block';
        if (navEmpresas) navEmpresas.style.display = isSuperAdmin ? 'flex' : 'none';
        if (navAssinaturas) navAssinaturas.style.display = isSuperAdmin ? 'flex' : 'none';
        if (navMyCompany) navMyCompany.style.display = 'flex';
        if (navUsersAdmin) navUsersAdmin.style.display = 'flex';
        if (navCancelledBudgets) navCancelledBudgets.style.display = 'flex';
    } else {
        if (navConfigSection) navConfigSection.style.display = 'none';
        if (navEmpresas) navEmpresas.style.display = 'none';
        if (navAssinaturas) navAssinaturas.style.display = 'none';
        if (navMyCompany) navMyCompany.style.display = 'none';
        if (navUsersAdmin) navUsersAdmin.style.display = 'none';
        if (navCancelledBudgets) navCancelledBudgets.style.display = 'none';
    }
}

// Mobile Menu Toggle
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
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
        navBudgets, navFinanceiro, navCommissions, navMarketing, navAtendimento, navAgenda, navProtese, navDashboard, navUsersAdminBtn, navEmpresas, navAssinaturas, navMyCompany, document.getElementById('navCancelledBudgets')
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
        'assinaturas': [assinaturasView],
        'myCompany': [myCompanyView],
        'financeiro': [financeiroView],
        'commissions': [commissionsView],
        'marketing': [marketingView],
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
    if (tab === 'patients') {
        if (navPatients) navPatients.classList.add('active');
        showList('patients');
    } else if (tab === 'dashboard') {
        const navD = document.getElementById('navDashboard');
        if (navD) navD.classList.add('active');
        showList('dashboard');
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
    } else if (tab === 'assinaturas') {
        if (!isSuperAdmin) {
            showToast('Acesso restrito ao SuperAdmin.', true);
            return;
        }
        if (navAssinaturas) navAssinaturas.classList.add('active');
        showList('assinaturas');
    } else if (tab === 'myCompany') {
        if (navMyCompany) navMyCompany.classList.add('active');
        showList('myCompany');
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
    } else if (tab === 'marketing') {
        const navM = document.getElementById('navMarketing');
        if (navM) navM.classList.add('active');
        showList('marketing');
    } else if (tab === 'atendimento') {
        const navT = document.getElementById('navAtendimento');
        if (navT) navT.classList.add('active');
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
        'navMarketing': 'marketing',
        'navAtendimento': 'atendimento',
        'navAgenda': 'agenda',
        'navProtese': 'protese',
        'navUsersAdmin': 'usersAdmin',
        'navEmpresas': 'empresas',
        'navAssinaturas': 'assinaturas',
        'navMyCompany': 'myCompany',
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
            const subs = Array.isArray(s && s.subdivisoes) ? s.subdivisoes : [];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.seqid}</td>
                <td><strong>${s.nome}</strong></td>
                <td>
                    ${subs && subs.length > 0
                    ? `<div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${subs.map((sub, index) => `<span style="background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--text-color);"><strong>${s.seqid}.${index + 1}</strong> - ${sub && sub.nome ? sub.nome : String(sub || '')}</span>`).join('')}
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
            tr.dataset.id = String(s.id || '');
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

        if (window.__afterListScrollToServiceId) {
            const tid = String(window.__afterListScrollToServiceId);
            window.__afterListScrollToServiceId = '';
            const rows = Array.from(servicesTableBody.children);
            const row = rows.find(el => el && el.dataset && String(el.dataset.id) === tid);
            if (row) {
                try {
                    const sc = row.closest('.table-container');
                    const doScroll = () => {
                        if (sc && sc.scrollTo) {
                            let off = 0, n = row;
                            while (n && n !== sc) {
                                off += n.offsetTop || 0;
                                n = n.offsetParent;
                            }
                            const target = Math.max(0, off - Math.max(0, (sc.clientHeight / 2) - (row.clientHeight / 2)));
                            sc.scrollTo({ top: target, behavior: 'auto' });
                        } else if (row.scrollIntoView) {
                            row.scrollIntoView({ block: 'center' });
                        }
                        row.style.outline = '2px solid var(--primary-color)';
                        setTimeout(() => { try { row.style.outline = ''; } catch {} }, 1000);
                    };
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => requestAnimationFrame(doScroll));
                    } else {
                        setTimeout(doScroll, 0);
                    }
                } catch { /* ignore */ }
            }
        }
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
            const userId = u.usuario_id || u.user_id || 'N/A';
            const empresaId = u.empresa_id || '';
            const userEmail = u.user_email || userId;
            const shortId = userId.length > 8 ? userId.substring(0, 8) : userId;
            const userRole = (normalizeRole(u.perfil) || 'user').toUpperCase();

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
                    <button class="btn-icon js-print-tenant-user" data-user-id="${userId}" data-empresa-id="${empresaId}" title="Imprimir Acesso">
                        <i class="ri-printer-line"></i>
                    </button>
                    <button class="btn-icon js-edit-tenant-user" data-user-id="${userId}" data-empresa-id="${empresaId}" title="Editar Permissões">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="btn-icon delete-btn js-delete-tenant-user" data-user-id="${userId}" data-empresa-id="${empresaId}" title="Remover Acesso">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            `;
            usersAdminTableBody.appendChild(tr);
        });

        if (!window.__usersAdminDelegated && usersAdminTableBody) {
            window.__usersAdminDelegated = true;
            usersAdminTableBody.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.js-edit-tenant-user');
                if (editBtn) {
                    const uid = editBtn.getAttribute('data-user-id') || '';
                    const eid = editBtn.getAttribute('data-empresa-id') || '';
                    try { window.editTenantUser(uid, eid); } catch (err) { showToast(err && err.message ? err.message : 'Falha ao abrir edição.', true); }
                    return;
                }
                const delBtn = e.target.closest('.js-delete-tenant-user');
                if (delBtn) {
                    const uid = delBtn.getAttribute('data-user-id') || '';
                    const eid = delBtn.getAttribute('data-empresa-id') || '';
                    try { window.removeTenantUser(uid, eid); } catch (err) { showToast(err && err.message ? err.message : 'Falha ao remover acesso.', true); }
                    return;
                }
                const printBtn = e.target.closest('.js-print-tenant-user');
                if (printBtn) {
                    const uid = printBtn.getAttribute('data-user-id') || '';
                    try { window.printUser(uid); } catch (err) { showToast(err && err.message ? err.message : 'Falha ao imprimir.', true); }
                }
            });
        }
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

            const totalPago = b.total_pago || 0;
            const saldoDevedor = total - totalPago;
            const criadoEm = b.created_at ? formatDateTime(b.created_at) : '—';

            tr.innerHTML = `
                <td>${b.seqid}</td>
                <td>
                    <strong>${b.pacientenome}</strong><br>
                    <small style="color:var(--text-muted)">${b.pacientecelular}</small>
                </td>
                <td>${criadoEm}</td>
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
                    ${canMutateBudget(b, 'update') ? `
                    <button class="btn-icon" onclick="editBudget('${b.id}')" title="Editar">
                        <i class="ri-edit-line"></i>
                    </button>` : ''}
                    ${canMutateBudget(b, 'delete') ? `
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
            let obsRaw = String(t.observacoes_display || t.observacoes || '');
            const obsNorm = obsRaw
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            const obsBudgetMatch = obsNorm.match(/(?:Orc\.?\s*#|Orcamento\s*#|Orcamento\s+)\s*(\d{1,})/i);
            const obsBudgetSeq = obsBudgetMatch && obsBudgetMatch[1] ? String(obsBudgetMatch[1]) : '';
            const refOrc = (t.referencia_id != null && String(t.referencia_id).trim() !== '') ? String(t.referencia_id) : '';
            const orcIdCol = (t.orcamento_id != null && String(t.orcamento_id).trim() !== '') ? String(t.orcamento_id) : '';
            const txnId = t.seqid || (index + 1);
            // Orçamento visível: prioriza extração da observação, depois orcamento_id, depois referencia_id
            const budgetId = obsBudgetSeq || orcIdCol || refOrc || '';
            if (obsBudgetSeq) {
                const pretty = `Orçamento ${obsBudgetSeq}`;
                const hasPretty = obsNorm.includes(`Orcamento ${obsBudgetSeq}`);
                if (!hasPretty) obsRaw = `${obsRaw} | ${pretty}`;
            }
            const valorFormatado = Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const tipoLabel = t.tipo === 'CREDITO' ?
                '<span style="color: var(--success-color); font-weight: 600;">CRÉDITO</span>' :
                '<span style="color: #dc3545; font-weight: 600;">DÉBITO</span>';

            tr.innerHTML = `
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${escapeHtml(String(txnId))}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);" title="${escapeHtml(obsBudgetSeq ? `ref: observação (orç=${obsBudgetSeq})${refOrc && refOrc !== obsBudgetSeq ? ` (referencia_id=${refOrc})` : ''}` : (orcIdCol ? `ref: orcamento_id${refOrc && refOrc !== orcIdCol ? ` (referencia_id=${refOrc})` : ''}` : (refOrc ? 'ref: referencia_id' : 'ref: seq')))}">${escapeHtml(budgetId || '—')}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);"><strong>${t.paciente_nome || '—'}</strong></td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${formatDateTime(t.data_transacao)}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${t.categoria}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${t.forma_pagamento || '—'}</td>
                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid var(--border-color);"><strong>${valorFormatado}</strong></td>
                <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid var(--border-color);">${tipoLabel}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${obsRaw}">${obsRaw || '—'}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); text-align: center;">
                    <button class="btn-icon delete-btn" onclick="deleteTransaction('${t.id}')" title="Excluir Lançamento">
                        <i class="ri-delete-bin-line"></i>
                    </button>
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
            const photoSrc = getProfessionalPhotoValue(p);
            const hasRawPhoto = !!(p && (p.photo || p.foto || p.foto_base64 || p.photo_base64 || p.imagem || p.imagem_base64));

            const isIncomplete = String(p.nome || '').startsWith('[INCOMPLETO]');
            const statusColor = isIncomplete
                ? 'var(--danger-color)'
                : (p.status === 'Ativo' ? 'var(--success-color)' : 'var(--text-muted)');
            if (isIncomplete) tr.style.background = 'rgba(220, 38, 38, 0.08)';

            tr.innerHTML = `
                <td>${p.seqid}</td>
                <td class="js-prof-photo"></td>
                <td>
                    <strong>${escapeHtml(p.nome)}</strong><br>
                    <small style="color:var(--text-muted)">${escapeHtml(p.email || '')}</small>
                </td>
                <td>${escapeHtml(p.celular || '')}</td>
                <td>
                    ${escapeHtml(p.tipo || '')}
                    ${p.especialidadeid ? `<br><small style="color:var(--primary-color)">${escapeHtml(getSpecialtyName(p.especialidadeid))}</small>` : ''}
                </td>
                <td><strong style="color: ${statusColor}">${escapeHtml(p.status || '')}</strong></td>
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

            const photoCell = tr.querySelector('.js-prof-photo');
            if (photoCell) {
                if (photoSrc) {
                    const img = document.createElement('img');
                    img.className = 'photo-thumb';
                    img.alt = 'Foto';
                    img.decoding = 'async';
                    img.loading = 'lazy';
                    let objectUrl = '';
                    img.onerror = () => {
                        try {
                            if (objectUrl) URL.revokeObjectURL(objectUrl);
                            photoCell.innerHTML = '';
                            const div = document.createElement('div');
                            div.className = 'photo-thumb photo-thumb--placeholder';
                            div.title = 'Foto inválida';
                            div.innerHTML = '<i class="ri-alert-line"></i>';
                            photoCell.appendChild(div);
                        } catch { }
                    };
                    img.onload = () => {
                        try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch { }
                    };
                    if (photoSrc.startsWith('data:image/') && photoSrc.length > 200000) {
                        objectUrl = dataUrlToObjectUrl(photoSrc);
                    }
                    img.src = objectUrl || photoSrc;
                    photoCell.appendChild(img);
                } else {
                    const div = document.createElement('div');
                    div.className = 'photo-thumb photo-thumb--placeholder';
                    div.title = hasRawPhoto ? 'Foto inválida' : 'Sem foto';
                    div.innerHTML = hasRawPhoto ? '<i class="ri-alert-line"></i>' : '<i class="ri-user-line"></i>';
                    photoCell.appendChild(div);
                }
            }

            professionalsTableBody.appendChild(tr);
        });
    }
}

if (!window.__usersAdminGlobalDelegated) {
    window.__usersAdminGlobalDelegated = true;
    document.addEventListener('click', (e) => {
        const editBtn = e.target && e.target.closest ? e.target.closest('.js-edit-tenant-user') : null;
        if (editBtn) {
            const uid = editBtn.getAttribute('data-user-id') || '';
            const eid = editBtn.getAttribute('data-empresa-id') || '';
            try { window.editTenantUser(uid, eid); } catch (err) { showToast(err && err.message ? err.message : 'Falha ao abrir edição.', true); }
            return;
        }

        const delBtn = e.target && e.target.closest ? e.target.closest('.js-delete-tenant-user') : null;
        if (delBtn) {
            const uid = delBtn.getAttribute('data-user-id') || '';
            const eid = delBtn.getAttribute('data-empresa-id') || '';
            try { window.removeTenantUser(uid, eid); } catch (err) { showToast(err && err.message ? err.message : 'Falha ao remover acesso.', true); }
            return;
        }

        const printBtn = e.target && e.target.closest ? e.target.closest('.js-print-tenant-user') : null;
        if (printBtn) {
            const uid = printBtn.getAttribute('data-user-id') || '';
            try { window.printUser(uid); } catch (err) { showToast(err && err.message ? err.message : 'Falha ao imprimir.', true); }
        }
    });
}

function showForm(editMode = false, type = 'patients', dataObj = null) {
    window.__activeHelpContext = type;
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
        if (patientForm) patientForm.reset();
        if (typeof syncPatientProfissaoUI === 'function') syncPatientProfissaoUI();
        setPatientAddressLock(true);
        clearPatientAddressFields();
    } else if (type === 'specialties') {
        if (specialtiesListView) specialtiesListView.classList.add('hidden');
        if (specialtyFormView) specialtyFormView.classList.remove('hidden');
        document.getElementById('specialtyFormTitle').innerText = editMode ? 'Editar Especialidade' : 'Nova Especialidade';
        document.getElementById('specIdDisplay').value = editMode ? '' : 'Novo';
        deletedSpecialtySubdivisionIds.clear();
        if (!editMode) {
            currentSpecialtySubdivisions = [];
            if (typeof renderSubSpecTable === 'function') renderSubSpecTable();
        }
    } else if (type === 'services') {
        if (servicesListView) servicesListView.classList.add('hidden');
        if (serviceFormView) serviceFormView.classList.remove('hidden');
        if (!editMode) {
            const f = document.getElementById('serviceForm');
            if (f) f.reset();
        }
        document.getElementById('serviceFormTitle').innerText = editMode ? 'Editar Item' : 'Novo Serviço/Item';
        document.getElementById('servIdDisplay').value = editMode ? '' : 'Novo';
        if (!editMode) {
            document.getElementById('servTipoIE').value = 'S';
            const tipoCalcEl = document.getElementById('servTipoCalculo');
            if (tipoCalcEl) tipoCalcEl.value = 'Fixo';
            const exigeEl = document.getElementById('servExigeElemento');
            if (exigeEl) exigeEl.checked = false;
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
                        opt.value = String(sub.id || '');
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
            const empresaHidden = document.getElementById('editAdminEmpresaId');
            if (empresaHidden) empresaHidden.value = '';
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
        const emailInput = document.getElementById('empresaEmail');
        const telInput = document.getElementById('empresaTelefone');
        const celInput = document.getElementById('empresaCelular');
        const assinaturaStatusInput = document.getElementById('empresaAssinaturaStatus');
        const planoTipoInput = document.getElementById('empresaPlanoTipo');
        const dataVencInput = document.getElementById('empresaDataVencimento');
        const base64Input = document.getElementById('empresaLogoBase64');
        const logoPreview = document.getElementById('logoPreviewContainer');

        if (editMode && dataObj) {
            idInput.value = dataObj.id;
            nomeInput.value = dataObj.nome;
            if (emailInput) emailInput.value = dataObj.email || '';
            if (telInput) telInput.value = dataObj.telefone || '';
            if (celInput) celInput.value = dataObj.celular || '';
            if (assinaturaStatusInput) {
                const k = normalizeKey(dataObj.assinatura_status || '');
                assinaturaStatusInput.value = (k === 'ATIVO' || k === 'PENDENTE' || k === 'TRIAL') ? k : 'TRIAL';
            }
            if (planoTipoInput) planoTipoInput.value = dataObj.plano_tipo || '';
            if (planoTipoInput && planoTipoInput.tagName === 'SELECT') {
                const v = String(dataObj.plano_tipo || '').trim();
                if (v && !Array.from(planoTipoInput.options || []).some(o => String(o.value || '') === v)) {
                    const opt = document.createElement('option');
                    opt.value = v;
                    opt.textContent = v;
                    planoTipoInput.appendChild(opt);
                    planoTipoInput.value = v;
                }
            }
            if (dataVencInput) dataVencInput.value = dataObj.data_vencimento ? String(dataObj.data_vencimento).slice(0, 10) : '';
            document.getElementById('empresaSupervisorPin').value = dataObj.supervisor_pin || '';
            base64Input.value = dataObj.logotipo || '';
            if (dataObj.logotipo) {
                logoPreview.innerHTML = `<img src="${dataObj.logotipo}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                logoPreview.innerHTML = `<i class="ri-image-line" style="font-size: 1.5rem; color: var(--text-muted);"></i>`;
            }
            idInput.readOnly = true;
        } else {
            empresaForm.reset();
            document.getElementById('empresaSupervisorPin').value = '';
            if (emailInput) emailInput.value = '';
            if (telInput) telInput.value = '';
            if (celInput) celInput.value = '';
            if (assinaturaStatusInput) assinaturaStatusInput.value = 'TRIAL';
            if (planoTipoInput) planoTipoInput.value = '';
            if (dataVencInput) dataVencInput.value = '';
            base64Input.value = '';
            logoPreview.innerHTML = `<i class="ri-image-line" style="font-size: 1.5rem; color: var(--text-muted);"></i>`;
            idInput.readOnly = false;
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
    window.__activeHelpContext = type;

    // Auto-collapse sidebar when a menu item is selected to free up space
    if (sidebar && !sidebar.classList.contains('collapsed')) {
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
        refreshDashboardFromUI();
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
        bindOdontogramaEvents();
    } else if (type === 'budgets') {
        if (budgetFormView) budgetFormView.classList.add('hidden');
        if (budgetsListView) budgetsListView.classList.remove('hidden');
        if (document.getElementById('budgetForm')) document.getElementById('budgetForm').reset();
        document.getElementById('editBudgetId').value = '';
        document.getElementById('addBudgetItemPanel').style.display = 'none';
        renderTable(budgets, 'budgets');
        bindOdontogramaEvents();
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
        let query = db.from('usuario_empresas').select('*');

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
        const titleEl = document.getElementById('empresasListTitle');
        if (titleEl) titleEl.textContent = 'Cadastro de Empresas';
        if (btnAddNewEmpresa) btnAddNewEmpresa.style.display = isSuperAdmin ? 'inline-flex' : 'none';
        if (empresaForm) empresaForm.reset();
        document.getElementById('editEmpresaOldId').value = '';
        fetchEmpresas();
    } else if (type === 'assinaturas') {
        if (!isSuperAdmin) {
            showToast('Acesso restrito ao SuperAdmin.', true);
            return;
        }
        if (assinaturasView) assinaturasView.classList.remove('hidden');
        fetchAssinaturas();
        fetchConfigPlanos();
    } else if (type === 'myCompany') {
        if (myCompanyView) myCompanyView.classList.remove('hidden');
        initMyCompanyForm();
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
    } else if (type === 'marketing') {
        if (marketingView) marketingView.classList.remove('hidden');
        initMarketingModule();
    } else if (type === 'atendimento') {
        if (atendimentoView) atendimentoView.classList.remove('hidden');
        initAtendimentoFilters();
        renderAtendimentoPlaceholder();
    } else if (type === 'agenda') {
        if (agendaView) agendaView.classList.remove('hidden');
        initAgendaFilters();
        renderAgendaPlaceholder();
        fetchAgendaForUI();
    } else if (type === 'protese') {
        if (proteseView) proteseView.classList.remove('hidden');
        initProteseModule();
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

function initMarketingModule() {
    if (window.__marketingDelegated) return;
    window.__marketingDelegated = true;

    const btnFid = document.getElementById('btnMarketingTabFidelidade');
    const btnCamp = document.getElementById('btnMarketingTabCampanhas');
    const btnSmtp = document.getElementById('btnMarketingTabSmtp');
    const tabFid = document.getElementById('marketingTabFidelidade');
    const tabCamp = document.getElementById('marketingTabCampanhas');
    const tabSmtp = document.getElementById('marketingTabSmtp');

    const marketingBucket = document.getElementById('marketingBucket');
    const btnMarketingRefresh = document.getElementById('btnMarketingRefresh');
    const btnMarketingSend = document.getElementById('btnMarketingSend');
    const btnMarketingLastReturn = document.getElementById('btnMarketingLastReturn');
    const marketingSendResult = document.getElementById('marketingSendResult');
    const marketingPatientsBody = document.getElementById('marketingPatientsBody');
    const marketingPatientsSummary = document.getElementById('marketingPatientsSummary');
    const marketingActiveCampaign = document.getElementById('marketingActiveCampaign');

    const kpiMkAtivos = document.getElementById('kpiMkAtivos');
    const kpiMk7a8 = document.getElementById('kpiMk7a8');
    const kpiMk9a11 = document.getElementById('kpiMk9a11');
    const kpiMk12a17 = document.getElementById('kpiMk12a17');
    const kpiMk18 = document.getElementById('kpiMk18');

    const mkSmtpEnabled = document.getElementById('mkSmtpEnabled');
    const mkSmtpHost = document.getElementById('mkSmtpHost');
    const mkSmtpPort = document.getElementById('mkSmtpPort');
    const mkSmtpUser = document.getElementById('mkSmtpUser');
    const mkSmtpPass = document.getElementById('mkSmtpPass');
    const mkFromEmail = document.getElementById('mkFromEmail');
    const mkBrevoApiKey = document.getElementById('mkBrevoApiKey');
    const btnMkSaveSmtp = document.getElementById('btnMkSaveSmtp');
    const btnMkReloadSmtp = document.getElementById('btnMkReloadSmtp');
    const mkSmtpResult = document.getElementById('mkSmtpResult');

    const canSelect = can('marketing', 'select');
    const canUpdate = can('marketing', 'update') || isAdminRole() || isSuperAdmin;
    if (btnMarketingRefresh) btnMarketingRefresh.disabled = false;
    if (btnMarketingSend) btnMarketingSend.disabled = false;
    if (btnMarketingLastReturn) btnMarketingLastReturn.disabled = false;
    if (btnMkReloadSmtp) btnMkReloadSmtp.disabled = false;
    if (btnMkSaveSmtp) btnMkSaveSmtp.disabled = false;

    const mkCampaignNome = document.getElementById('mkCampaignNome');
    const mkCampaignIdEl = document.getElementById('mkCampaignId');
    const mkCampaignAssunto = document.getElementById('mkCampaignAssunto');
    const mkStatusAlvo = document.getElementById('mkStatusAlvo');
    const mkDiasReenvio = document.getElementById('mkDiasReenvio');
    const mkLimiteDia = document.getElementById('mkLimiteDia');
    const mkJanelaConv = document.getElementById('mkJanelaConv');
    const mkAtivo = document.getElementById('mkAtivo');
    const mkCorpo = document.getElementById('mkCorpo');
    const mkRodape = document.getElementById('mkRodape');
    const btnMkSaveCampaign = document.getElementById('btnMkSaveCampaign');
    const btnMkDryRun = document.getElementById('btnMkDryRun');
    const btnMkSend = document.getElementById('btnMkSend');
    const mkCampaignResult = document.getElementById('mkCampaignResult');
    const btnMkNewCampaign = document.getElementById('btnMkNewCampaign');
    const mkCampaignsBody = document.getElementById('mkCampaignsBody');

    let activeCampaignRow = null;
    let lastFidelidadeRows = [];
    let lastCampaignRows = [];

    const parseBucket = (v) => {
        const s = String(v || '').trim();
        const parts = s.split('-').map(x => x.trim());
        const min = Number(parts[0]);
        const max = (parts.length > 1) ? Number(parts[1]) : NaN;
        return {
            min: Number.isFinite(min) ? min : 0,
            max: Number.isFinite(max) && max < 900 ? max : null
        };
    };

    const renderPatients = (rows) => {
        if (!marketingPatientsBody) return;
        const list = Array.isArray(rows) ? rows : [];
        lastFidelidadeRows = list;
        if (!list.length) {
            marketingPatientsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum paciente no filtro.</td></tr>';
            if (marketingPatientsSummary) marketingPatientsSummary.textContent = '0 pacientes';
            return;
        }
        marketingPatientsBody.innerHTML = '';
        list.forEach(r => {
            const nome = escapeHtml(String(r.nome || '—'));
            const email = escapeHtml(String(r.email || '—'));
            const meses = (r.meses_sem_pagamento != null) ? String(r.meses_sem_pagamento) : '—';
            const ultimo = r.ultimo_pagamento_em ? formatDateTime(r.ultimo_pagamento_em) : '—';
            const total = formatCurrencyBRL(r.total_pago || 0);
            const qtd = (r.qtd_pagamentos != null) ? String(r.qtd_pagamentos) : '0';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${nome}</td>
                <td>${escapeHtml(ultimo)}</td>
                <td style="text-align:center; font-weight:700;">${escapeHtml(meses)}</td>
                <td style="text-align:right; font-weight:700;">${escapeHtml(total)}</td>
                <td style="text-align:right;">${escapeHtml(qtd)}</td>
                <td>${email}</td>
            `;
            marketingPatientsBody.appendChild(tr);
        });
        if (marketingPatientsSummary) marketingPatientsSummary.textContent = `${list.length} pacientes`;
    };

    const loadActiveCampaign = async (statusKey) => {
        if (!marketingActiveCampaign || !currentEmpresaId) return;
        try {
            const sk = statusKey != null ? String(statusKey).trim().toUpperCase() : '';
            let q = db.from('marketing_campanhas')
                .select('id,nome,limite_dia')
                .eq('empresa_id', currentEmpresaId)
                .eq('ativo', true)
                ;
            if (sk) q = q.eq('target_status', sk);
            q = q
                .order('updated_at', { ascending: false })
                .limit(1);
            const { data, error } = await withTimeout(q, 15000, 'marketing:campanha_ativa');
            if (error) throw error;
            let row = Array.isArray(data) ? data[0] : null;
            if (!row && sk) {
                const range = (() => {
                    if (sk === 'ATIVOS') return { min: 0, max: 6 };
                    if (sk === 'ATENCAO') return { min: 7, max: 8 };
                    if (sk === 'REATIVACAO') return { min: 9, max: 11 };
                    if (sk === 'ALTO_RISCO') return { min: 12, max: 17 };
                    if (sk === 'PERDIDOS') return { min: 18, max: null };
                    return { min: 0, max: 6 };
                })();
                let q2 = db.from('marketing_campanhas')
                    .select('id,nome,limite_dia')
                    .eq('empresa_id', currentEmpresaId)
                    .eq('ativo', true)
                    .eq('target_min_meses', range.min);
                q2 = (range.max == null) ? q2.is('target_max_meses', null) : q2.eq('target_max_meses', range.max);
                q2 = q2.order('updated_at', { ascending: false }).limit(1);
                const r2 = await withTimeout(q2, 15000, 'marketing:campanha_ativa:minmax');
                if (r2 && !r2.error) {
                    const d2 = r2.data;
                    row = Array.isArray(d2) ? d2[0] : null;
                }
            }
            activeCampaignRow = row || null;
            marketingActiveCampaign.textContent = row && row.nome ? String(row.nome) : '—';
        } catch {
            activeCampaignRow = null;
            marketingActiveCampaign.textContent = '—';
        }
    };

    const fillCampaignForm = (row) => {
        const r = row && typeof row === 'object' ? row : {};
        if (mkCampaignIdEl) mkCampaignIdEl.value = r.id ? String(r.id) : '';
        if (mkCampaignNome) mkCampaignNome.value = r.nome != null ? String(r.nome) : '';
        if (mkCampaignAssunto) mkCampaignAssunto.value = r.assunto != null ? String(r.assunto) : '';
        if (mkCorpo) mkCorpo.value = r.corpo != null ? String(r.corpo) : '';
        if (mkRodape) mkRodape.value = r.rodape != null ? String(r.rodape) : '';
        if (mkDiasReenvio) mkDiasReenvio.value = r.dias_reenvio != null ? String(r.dias_reenvio) : '0';
        if (mkLimiteDia) mkLimiteDia.value = r.limite_dia != null ? String(r.limite_dia) : '50';
        if (mkJanelaConv) mkJanelaConv.value = r.janela_conversao_dias != null ? String(r.janela_conversao_dias) : '30';
        if (mkAtivo) mkAtivo.checked = Boolean(r.ativo);
        if (mkStatusAlvo) {
            const target = String(r.target_status || '').trim().toUpperCase();
            if (target && Array.from(mkStatusAlvo.options).some(o => String(o.value).toUpperCase() === target)) {
                mkStatusAlvo.value = target;
            } else {
                const min = Number(r.target_min_meses ?? 0);
                const max = (r.target_max_meses == null) ? null : Number(r.target_max_meses);
                const s = (() => {
                    if (min === 0 && max === 6) return 'ATIVOS';
                    if (min === 7 && max === 8) return 'ATENCAO';
                    if (min === 9 && max === 11) return 'REATIVACAO';
                    if (min === 12 && max === 17) return 'ALTO_RISCO';
                    if (min >= 18 && max == null) return 'PERDIDOS';
                    return 'ATIVOS';
                })();
                mkStatusAlvo.value = s;
            }
        }
        if (mkCampaignResult) mkCampaignResult.textContent = '';
    };

    const renderCampaigns = (rows) => {
        if (!mkCampaignsBody) return;
        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) {
            mkCampaignsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma campanha cadastrada.</td></tr>';
            return;
        }

        const statusLabel = (r) => {
            const st = String(r && r.target_status || '').trim().toUpperCase();
            if (st) return st;
            const min = Number(r && (r.target_min_meses ?? 0));
            const max = (r && r.target_max_meses == null) ? null : Number(r && r.target_max_meses);
            if (min === 0 && max === 6) return 'ATIVOS';
            if (min === 7 && max === 8) return 'ATENCAO';
            if (min === 9 && max === 11) return 'REATIVACAO';
            if (min === 12 && max === 17) return 'ALTO_RISCO';
            if (min >= 18 && max == null) return 'PERDIDOS';
            return '—';
        };

        lastCampaignRows = list.slice();

        mkCampaignsBody.innerHTML = '';
        lastCampaignRows.forEach(r => {
            const tr = document.createElement('tr');
            const ativo = Boolean(r && r.ativo);
            tr.innerHTML = `
                <td><strong>${escapeHtml(String(r && r.nome || '—'))}</strong></td>
                <td>${escapeHtml(String(r && r.assunto || '—'))}</td>
                <td>${escapeHtml(statusLabel(r))}</td>
                <td style="text-align:center; font-weight:900;">${ativo ? 'SIM' : 'NÃO'}</td>
                <td>
                    <div style="display:flex; gap: 6px; align-items:center; justify-content:flex-start; flex-wrap: nowrap;">
                        <button class="btn btn-secondary btn-sm" title="Editar" data-mk-action="edit" data-mk-id="${escapeHtml(String(r && r.id || ''))}">
                            <i class="ri-pencil-line"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" title="Excluir" data-mk-action="delete" data-mk-id="${escapeHtml(String(r && r.id || ''))}">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </td>
            `;
            mkCampaignsBody.appendChild(tr);
        });
    };

    const loadCampaigns = async () => {
        if (!mkCampaignsBody) return;
        if (!currentEmpresaId) {
            mkCampaignsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger-color);">Empresa não definida.</td></tr>';
            return;
        }
        mkCampaignsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        try {
            const q = db.from('marketing_campanhas')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .order('created_at', { ascending: true })
                .limit(200);
            const { data, error } = await withTimeout(q, 20000, 'marketing:campanhas:list');
            if (error) throw error;
            renderCampaigns(data || []);
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            mkCampaignsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger-color);">Falha ao carregar: ${escapeHtml(msg)}</td></tr>`;
        }
    };

    const loadFidelidadeKpis = async () => {
        if (!currentEmpresaId) return;
        try {
            const { data, error } = await withTimeout(db.rpc('rpc_marketing_fidelidade_kpis', { p_empresa_id: currentEmpresaId }), 15000, 'marketing:fidelidade:kpis');
            if (error) throw error;
            const obj = Array.isArray(data) ? data[0] : data;
            const k = obj && typeof obj === 'object' ? obj : {};
            if (kpiMkAtivos) kpiMkAtivos.textContent = String(k.ativos ?? '—');
            if (kpiMk7a8) kpiMk7a8.textContent = String(k.m7_8 ?? '—');
            if (kpiMk9a11) kpiMk9a11.textContent = String(k.m9_11 ?? '—');
            if (kpiMk12a17) kpiMk12a17.textContent = String(k.m12_17 ?? '—');
            if (kpiMk18) kpiMk18.textContent = String(k.m18_plus ?? '—');
        } catch { }
    };

    const loadFidelidade = async () => {
        if (!currentEmpresaId) {
            showToast('Empresa não definida.', true);
            return;
        }
        if (!marketingPatientsBody) return;
        const { min, max } = parseBucket(marketingBucket ? marketingBucket.value : '0-6');
        marketingPatientsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        try {
            const payload = { p_empresa_id: currentEmpresaId, p_min_meses: min, p_max_meses: max, p_limit: 500, p_offset: 0 };
            const { data, error } = await withTimeout(db.rpc('rpc_marketing_fidelidade', payload), 20000, 'marketing:fidelidade:list');
            if (error) throw error;
            renderPatients(data || []);
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            marketingPatientsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--danger-color);">Falha ao carregar: ${escapeHtml(msg)}</td></tr>`;
        }
    };

    const statusToRange = (statusAlvo) => {
        const s = String(statusAlvo || '').trim().toUpperCase();
        if (s === 'ATIVOS') return { min: 0, max: 6 };
        if (s === 'ATENCAO') return { min: 7, max: 8 };
        if (s === 'REATIVACAO') return { min: 9, max: 11 };
        if (s === 'ALTO_RISCO') return { min: 12, max: 17 };
        if (s === 'PERDIDOS') return { min: 18, max: null };
        return { min: 0, max: 6 };
    };

    const simulateCampaign = async () => {
        if (!currentEmpresaId) {
            showToast('Empresa não definida.', true);
            return;
        }
        const { min, max } = statusToRange(mkStatusAlvo ? mkStatusAlvo.value : 'ATIVOS');
        if (mkCampaignResult) mkCampaignResult.textContent = 'Simulando...';
        try {
            const { data, error } = await withTimeout(db.rpc('rpc_marketing_fidelidade_count', { p_empresa_id: currentEmpresaId, p_min_meses: min, p_max_meses: max }), 20000, 'marketing:campanhas:simular');
            if (error) throw error;
            const count = Number(data);
            const qtd = Number.isFinite(count) ? count : 0;
            if (mkCampaignResult) mkCampaignResult.textContent = `Público estimado: ${qtd} paciente(s)`;
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            if (mkCampaignResult) mkCampaignResult.textContent = `Falha ao simular: ${msg}`;
            showToast('Falha ao simular campanha.', true);
        }
    };

    const saveCampaign = async () => {
        if (!canUpdate) {
            showToast('Você não possui permissão para salvar campanhas.', true);
            return;
        }
        if (!currentEmpresaId) {
            showToast('Empresa não definida.', true);
            return;
        }
        const nome = mkCampaignNome ? String(mkCampaignNome.value || '').trim() : '';
        const assunto = mkCampaignAssunto ? String(mkCampaignAssunto.value || '').trim() : '';
        const corpo = mkCorpo ? String(mkCorpo.value || '').trim() : '';
        const rodape = mkRodape ? String(mkRodape.value || '').trim() : '';
        const diasReenvio = mkDiasReenvio ? Number(String(mkDiasReenvio.value || '').trim()) : 0;
        const limiteDia = mkLimiteDia ? Number(String(mkLimiteDia.value || '').trim()) : 50;
        const janelaConv = mkJanelaConv ? Number(String(mkJanelaConv.value || '').trim()) : 30;
        const ativo = mkAtivo ? Boolean(mkAtivo.checked) : false;
        const { min, max } = statusToRange(mkStatusAlvo ? mkStatusAlvo.value : 'ATIVOS');

        if (!nome || !assunto || !corpo) {
            showToast('Preencha Nome, Assunto e E-mail.', true);
            return;
        }

        if (btnMkSaveCampaign) btnMkSaveCampaign.disabled = true;
        if (mkCampaignResult) mkCampaignResult.textContent = 'Salvando...';
        try {
            const payload = {
                empresa_id: currentEmpresaId,
                nome,
                assunto,
                corpo,
                rodape: rodape || null,
                ativo,
                target_min_meses: min,
                target_max_meses: max,
                dias_reenvio: Number.isFinite(diasReenvio) ? diasReenvio : 0,
                limite_dia: Number.isFinite(limiteDia) ? limiteDia : 50,
                janela_conversao_dias: Number.isFinite(janelaConv) ? janelaConv : 30,
                updated_at: new Date().toISOString()
            };
            const existingId = mkCampaignIdEl && mkCampaignIdEl.value ? String(mkCampaignIdEl.value).trim() : '';
            let savedRow = null;
            if (existingId) {
                const { data, error } = await withTimeout(
                    db.from('marketing_campanhas')
                        .update(payload)
                        .eq('empresa_id', currentEmpresaId)
                        .eq('id', existingId)
                        .select('id,ativo')
                        .limit(1),
                    20000,
                    'marketing:campanhas:update'
                );
                if (error) throw error;
                savedRow = Array.isArray(data) ? data[0] : null;
                if (!savedRow || !savedRow.id) throw new Error('Registro não encontrado/sem permissão para atualizar.');
            } else {
                const { data, error } = await withTimeout(
                    db.from('marketing_campanhas')
                        .insert(payload)
                        .select('id,ativo')
                        .limit(1),
                    20000,
                    'marketing:campanhas:insert'
                );
                if (error) throw error;
                savedRow = Array.isArray(data) ? data[0] : null;
                if (!savedRow || !savedRow.id) throw new Error('Falha ao criar campanha.');
            }
            if (mkCampaignIdEl) mkCampaignIdEl.value = String(savedRow.id);
            if (mkAtivo && typeof savedRow.ativo === 'boolean') {
                mkAtivo.checked = savedRow.ativo;
                if (savedRow.ativo !== ativo) {
                    showToast('A campanha foi salva, mas o status "Ativa" foi ajustado pelo banco.', true);
                }
            }

            // Mantém a flag 'ativo' desta campanha sem alterar as demais
            if (mkCampaignResult) mkCampaignResult.textContent = 'Campanha salva.';
            showToast('Campanha salva.');
            await loadActiveCampaign();
            await loadCampaigns();
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            if (mkCampaignResult) mkCampaignResult.textContent = `Falha ao salvar: ${msg}`;
            showToast('Falha ao salvar campanha.', true);
        } finally {
            if (btnMkSaveCampaign) btnMkSaveCampaign.disabled = false;
        }
    };

    const bucketToStatusKey = (bucketValue) => {
        const v = String(bucketValue || '').trim();
        if (v.startsWith('0-6')) return 'ATIVOS';
        if (v.startsWith('7-8')) return 'ATENCAO';
        if (v.startsWith('9-11')) return 'REATIVACAO';
        if (v.startsWith('12-17')) return 'ALTO_RISCO';
        return 'PERDIDOS';
    };

    const runCampaignNow = async (opts = {}) => {
        if (!canUpdate) {
            showToast('Apenas admin pode disparar campanhas.', true);
            return null;
        }
        if (!currentEmpresaId) {
            showToast('Empresa não definida.', true);
            return null;
        }

        const campaignId = opts && typeof opts === 'object' ? String(opts.campaignId || '') : '';
        const statusKey = opts && typeof opts === 'object' ? String(opts.statusKey || '') : '';
        const dryRun = Boolean(opts && typeof opts === 'object' ? opts.dryRun : false);

        try {
            const invoke = db.functions && typeof db.functions.invoke === 'function'
                ? db.functions.invoke('run-marketing-campaign', { body: { empresa_id: currentEmpresaId, campaign_id: campaignId || undefined, status_key: statusKey || undefined, dry_run: dryRun } })
                : Promise.reject(new Error('Supabase Functions não disponível neste build.'));
            const { data, error } = await withTimeout(invoke, 120000, 'marketing:run-marketing-campaign');
            if (error) throw error;
            return data;
        } catch (err) {
            let msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            try {
                const ctx = err && err.context ? err.context : null;
                if (ctx) {
                    if (typeof ctx.json === 'function') {
                        const j = await ctx.json();
                        if (j && (j.error || j.message)) msg = String(j.error || j.message);
                    } else if (typeof ctx === 'string') {
                        const j = JSON.parse(ctx);
                        if (j && (j.error || j.message)) msg = String(j.error || j.message);
                    } else if (ctx && typeof ctx === 'object' && ctx.body) {
                        const raw = typeof ctx.body === 'string' ? ctx.body : '';
                        if (raw) {
                            const j = JSON.parse(raw);
                            if (j && (j.error || j.message)) msg = String(j.error || j.message);
                        }
                    }
                }
            } catch { }
            showToast(`Falha ao disparar campanha: ${msg}`, true);
            return null;
        }
    };

    const loadRecentEnvios = async (campaignId) => {
        if (!currentEmpresaId || !campaignId) return [];
        try {
            const sinceIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const q = db.from('marketing_envios')
                .select('status,paciente_nome,paciente_email,enviado_em,created_at,smtp_message_id,smtp_response,erro')
                .eq('empresa_id', currentEmpresaId)
                .eq('campanha_id', campaignId)
                .gte('created_at', sinceIso)
                .order('created_at', { ascending: false })
                .limit(20);
            const { data, error } = await withTimeout(q, 20000, 'marketing:envios:recent');
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    };

    const dispararAgoraDoFiltro = async () => {
        if (!currentEmpresaId) return;
        const statusKey = bucketToStatusKey(marketingBucket ? marketingBucket.value : '0-6');
        await loadActiveCampaign(statusKey);
        if (!activeCampaignRow || !activeCampaignRow.id) {
            showToast('Nenhuma campanha ativa para este Status (meses sem pagamento).', true);
            return;
        }
        const recipientsAll = (lastFidelidadeRows || []).filter(r => {
            const email = String(r && r.email || '').trim();
            return email && email.includes('@');
        });
        const limitDia = activeCampaignRow ? Number(activeCampaignRow.limite_dia) : NaN;
        const limit = Number.isFinite(limitDia) && limitDia > 0 ? Math.min(limitDia, 500) : 50;
        const previewCount = Math.min(recipientsAll.length, limit);
        const campNome = activeCampaignRow && activeCampaignRow.nome ? String(activeCampaignRow.nome) : 'campanha ativa';
        if (!confirm(`Disparar e-mails agora para ${campNome}?\nPúblico do filtro: ${previewCount} paciente(s) (limite do dia: ${limit}).`)) return;

        if (marketingSendResult) marketingSendResult.textContent = 'Disparando...';
        if (btnMarketingSend) btnMarketingSend.disabled = true;
        const res = await runCampaignNow({ statusKey });
        if (res) {
            const sent = Number(res.sent) || 0;
            const failed = Number(res.failed) || 0;
            const remaining = Number(res.remaining_estimate) || 0;
            if (marketingSendResult) marketingSendResult.textContent = `Enviados: ${sent} | Falhas: ${failed} | Restantes estimados: ${remaining}`;
            showToast('Disparo concluído.');
        }
        if (btnMarketingSend) btnMarketingSend.disabled = false;
    };

    const enviarAgoraDaCampanha = async () => {
        if (!currentEmpresaId) return;
        const statusKey = mkStatusAlvo ? String(mkStatusAlvo.value || '').trim() : 'ATIVOS';
        const campaignId = (mkCampaignIdEl && mkCampaignIdEl.value) ? String(mkCampaignIdEl.value).trim() : '';
        const campNome = mkCampaignNome && mkCampaignNome.value ? String(mkCampaignNome.value) : 'campanha';
        if (!confirm(`Disparar e-mails agora?\nCampanha: ${campNome}`)) return;

        if (mkCampaignResult) mkCampaignResult.textContent = 'Disparando...';
        if (btnMkSend) btnMkSend.disabled = true;
        const res = await runCampaignNow({ campaignId, statusKey });
        if (res) {
            const sent = Number(res.sent) || 0;
            const failed = Number(res.failed) || 0;
            const remaining = Number(res.remaining_estimate) || 0;
            if (mkCampaignResult) mkCampaignResult.textContent = `Enviados: ${sent} | Falhas: ${failed} | Restantes estimados: ${remaining}`;
            showToast('Disparo concluído.');
        }
        if (btnMkSend) btnMkSend.disabled = false;
    };

    const loadSmtpConfig = async () => {
        if (!currentEmpresaId) {
            showToast('Empresa não definida.', true);
            return;
        }
        if (mkSmtpResult) mkSmtpResult.textContent = 'Carregando...';
        try {
            const { data, error } = await withTimeout(db.rpc('rpc_marketing_get_smtp_config', { p_empresa_id: currentEmpresaId }), 15000, 'marketing:smtp:get');
            if (error) throw error;
            const cfg = Array.isArray(data) ? data[0] : data;
            if (mkSmtpEnabled) mkSmtpEnabled.checked = Boolean(cfg && cfg.enabled);
            if (mkSmtpHost) mkSmtpHost.value = cfg && cfg.host != null ? String(cfg.host) : '';
            if (mkSmtpPort) mkSmtpPort.value = cfg && cfg.port != null ? String(cfg.port) : '587';
            if (mkSmtpUser) mkSmtpUser.value = cfg && cfg.username != null ? String(cfg.username) : '';
            if (mkFromEmail) mkFromEmail.value = cfg && cfg.from_email != null ? String(cfg.from_email) : '';
            if (mkSmtpPass) mkSmtpPass.value = '';
            if (mkBrevoApiKey) mkBrevoApiKey.value = '';
            if (mkSmtpResult) mkSmtpResult.textContent = JSON.stringify(cfg || {}, null, 2);
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            if (mkSmtpResult) mkSmtpResult.textContent = msg;
            showToast('Falha ao recarregar SMTP.', true);
        }
    };

    const saveSmtpConfig = async () => {
        if (!canUpdate) {
            showToast('Você não possui permissão para salvar SMTP.', true);
            return;
        }
        if (!currentEmpresaId) {
            showToast('Empresa não definida.', true);
            return;
        }
        const enabled = mkSmtpEnabled ? Boolean(mkSmtpEnabled.checked) : false;
        const host = mkSmtpHost ? String(mkSmtpHost.value || '').trim() : '';
        const port = mkSmtpPort ? Number(String(mkSmtpPort.value || '').trim()) : 587;
        const username = mkSmtpUser ? String(mkSmtpUser.value || '').trim() : '';
        const password = mkSmtpPass ? String(mkSmtpPass.value || '').trim() : '';
        const fromEmail = mkFromEmail ? String(mkFromEmail.value || '').trim() : '';
        const brevoKey = mkBrevoApiKey ? String(mkBrevoApiKey.value || '').trim() : '';

        if (btnMkSaveSmtp) btnMkSaveSmtp.disabled = true;
        try {
            const base = {
                p_empresa_id: currentEmpresaId,
                p_enabled: enabled,
                p_host: host,
                p_port: Number.isFinite(port) ? port : 587,
                p_username: username,
                p_password: password ? password : null,
                p_from_email: fromEmail ? fromEmail : null,
                p_from_name: null
            };
            try {
                const payload = { ...base, p_brevo_api_key: brevoKey ? brevoKey : null };
                const { data, error } = await withTimeout(db.rpc('rpc_marketing_set_smtp_config', payload), 20000, 'marketing:smtp:set');
                if (error) throw error;
                if (mkSmtpResult) mkSmtpResult.textContent = JSON.stringify(data || {}, null, 2);
            } catch (e1) {
                const { data, error } = await withTimeout(db.rpc('rpc_marketing_set_smtp_config', base), 20000, 'marketing:smtp:set2');
                if (error) throw error;
                if (mkSmtpResult) mkSmtpResult.textContent = JSON.stringify(data || {}, null, 2);
            }
            showToast('SMTP salvo.');
            await loadSmtpConfig();
        } catch (err) {
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            if (mkSmtpResult) mkSmtpResult.textContent = msg;
            showToast('Falha ao salvar SMTP.', true);
        } finally {
            if (btnMkSaveSmtp) btnMkSaveSmtp.disabled = false;
        }
    };

    const setTab = (tab) => {
        const t = String(tab || 'fidelidade');
        if (tabFid) tabFid.classList.toggle('hidden', t !== 'fidelidade');
        if (tabCamp) tabCamp.classList.toggle('hidden', t !== 'campanhas');
        if (tabSmtp) tabSmtp.classList.toggle('hidden', t !== 'smtp');

        const setBtnActive = (btn, active) => {
            if (!btn) return;
            btn.classList.toggle('btn-primary', active);
            btn.classList.toggle('btn-secondary', !active);
        };

        setBtnActive(btnFid, t === 'fidelidade');
        setBtnActive(btnCamp, t === 'campanhas');
        setBtnActive(btnSmtp, t === 'smtp');

        if (t === 'fidelidade') {
            loadActiveCampaign(bucketToStatusKey(marketingBucket ? marketingBucket.value : '0-6'));
            loadFidelidadeKpis();
            loadFidelidade();
        }
        if (t === 'smtp') {
            loadSmtpConfig();
        }
        if (t === 'campanhas') {
            loadCampaigns();
        }
    };

    if (btnFid) btnFid.addEventListener('click', () => setTab('fidelidade'));
    if (btnCamp) btnCamp.addEventListener('click', () => setTab('campanhas'));
    if (btnSmtp) btnSmtp.addEventListener('click', () => setTab('smtp'));
    if (btnMarketingRefresh) btnMarketingRefresh.addEventListener('click', () => { loadFidelidadeKpis(); loadFidelidade(); });
    if (marketingBucket) marketingBucket.addEventListener('change', () => { loadActiveCampaign(bucketToStatusKey(marketingBucket.value)); loadFidelidade(); });
    if (btnMarketingSend) btnMarketingSend.addEventListener('click', () => dispararAgoraDoFiltro());
    if (btnMkReloadSmtp) btnMkReloadSmtp.addEventListener('click', () => loadSmtpConfig());
    if (btnMkSaveSmtp) btnMkSaveSmtp.addEventListener('click', () => saveSmtpConfig());
    if (btnMkDryRun) btnMkDryRun.addEventListener('click', () => simulateCampaign());
    if (btnMkSaveCampaign) btnMkSaveCampaign.addEventListener('click', () => saveCampaign());
    if (btnMkSend) btnMkSend.addEventListener('click', () => enviarAgoraDaCampanha());

    if (btnMkNewCampaign) btnMkNewCampaign.addEventListener('click', () => fillCampaignForm(null));
    if (mkCampaignsBody && !mkCampaignsBody.dataset.bound) {
        mkCampaignsBody.dataset.bound = '1';
        mkCampaignsBody.addEventListener('click', async (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('button[data-mk-action]') : null;
            if (!btn) return;
            const action = String(btn.dataset.mkAction || '');
            const id = String(btn.dataset.mkId || '');
            const row = (lastCampaignRows || []).find(r => String(r && r.id || '') === id);
            if (!row) return;
            if (action === 'edit') {
                fillCampaignForm(row);
                return;
            }
            if (action === 'delete') {
                if (!canUpdate && !can('marketing', 'delete') && !(isAdminRole() || isSuperAdmin)) {
                    showToast('Você não possui permissão para excluir campanhas.', true);
                    return;
                }
                const nome = String(row && row.nome || '').trim() || 'campanha';
                const ativo = Boolean(row && row.ativo);
                const msg = ativo
                    ? `Excluir a campanha ativa "${nome}"?\nIsso remove a campanha do sistema.`
                    : `Excluir a campanha "${nome}"?`;
                if (!confirm(msg)) return;
                try {
                    const { error } = await withTimeout(
                        db.from('marketing_campanhas')
                            .delete()
                            .eq('empresa_id', currentEmpresaId)
                            .eq('id', id),
                        20000,
                        'marketing:campanhas:delete'
                    );
                    if (error) throw error;
                    if (mkCampaignIdEl && String(mkCampaignIdEl.value || '') === id) fillCampaignForm(null);
                    await loadActiveCampaign();
                    await loadCampaigns();
                    showToast('Campanha excluída.');
                } catch (err) {
                    const eMsg = err && err.message ? String(err.message) : 'Erro desconhecido';
                    showToast(`Falha ao excluir campanha: ${eMsg}`, true);
                }
            }
        });
    }

    setTab('fidelidade');
}

function initDashboardFilters() {
    const dashDate = document.getElementById('dashDate');
    const dashProfessional = document.getElementById('dashProfessional');
    const btnDashRefresh = document.getElementById('btnDashRefresh');
    const btnDashPrint = document.getElementById('btnDashPrint');

    if (dashDate && !dashDate.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dashDate.value = `${yyyy}-${mm}-${dd}`;
    }

    if (dashProfessional && dashProfessional.options.length <= 1) {
        const opts = ['<option value="">Todos</option>'];
        (professionals || [])
            .slice()
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                opts.push(`<option value="${p.seqid}">${p.nome}</option>`);
            });
        dashProfessional.innerHTML = opts.join('');
    }

    if (!window.__dashboardDelegated) {
        window.__dashboardDelegated = true;
        if (btnDashRefresh) btnDashRefresh.addEventListener('click', () => refreshDashboardFromUI());
        if (btnDashPrint) btnDashPrint.addEventListener('click', () => window.print());
        if (dashDate) dashDate.addEventListener('change', () => refreshDashboardFromUI());
        if (dashProfessional) dashProfessional.addEventListener('change', () => refreshDashboardFromUI());
    }
}

function initAtendimentoFilters() {
    if (atendimentoProfessional) {
        const prev = String(atendimentoProfessional.value || '');
        const opts = ['<option value="">Selecione...</option>'];
        (professionals || [])
            .slice()
            .filter(p => String(p.status || '') === 'Ativo')
            .filter(p => (String(p.tipo || '').toLowerCase() !== 'protetico'))
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                opts.push(`<option value="${p.seqid}">${p.nome}</option>`);
            });
        atendimentoProfessional.innerHTML = opts.join('');
        if (prev && Array.from(atendimentoProfessional.options).some(o => String(o.value) === prev)) {
            atendimentoProfessional.value = prev;
        }
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

    if (!window.__atendimentoDelegated) {
        window.__atendimentoDelegated = true;
        if (btnAtendimentoRefresh) btnAtendimentoRefresh.addEventListener('click', () => fetchAtendimentoForUI());
        if (atendimentoDate) atendimentoDate.addEventListener('change', () => fetchAtendimentoForUI());
        if (atendimentoProfessional) atendimentoProfessional.addEventListener('change', () => fetchAtendimentoForUI());
        if (btnAtendimentoFinalizeSelected) btnAtendimentoFinalizeSelected.addEventListener('click', () => finalizeAtendimentoSelectedItems());
        if (btnFechamentoDiario) btnFechamentoDiario.addEventListener('click', () => openFechamentoDiarioModal());
        if (btnFechamentoDiarioFull) btnFechamentoDiarioFull.addEventListener('click', () => openFechamentoDiarioFullModal());
    }

    fetchAtendimentoForUI();
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
            .filter(p => String(p.status || '') === 'Ativo')
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

function closeFechamentoDiarioFullModal() {
    if (fechamentoDiarioFullModal) fechamentoDiarioFullModal.classList.add('hidden');
}

function openFechamentoDiarioFullModal() {
    if (!fechamentoDiarioFullModal) return;

    const setTodayIfEmpty = (el) => {
        if (!el || el.value) return;
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        el.value = `${yyyy}-${mm}-${dd}`;
    };

    if (fechamentoDiarioFullDate) {
        if (atendimentoDate && atendimentoDate.value) fechamentoDiarioFullDate.value = String(atendimentoDate.value);
        setTodayIfEmpty(fechamentoDiarioFullDate);
    }

    if (fechamentoDiarioFullProfessional) {
        const opts = ['<option value="">Todos</option>'];
        (professionals || []).forEach(p => {
            if (p.seqid == null) return;
            opts.push(`<option value="${escapeHtml(String(p.seqid))}">${escapeHtml(String(p.nome || ''))}</option>`);
        });
        fechamentoDiarioFullProfessional.innerHTML = opts.join('');
        if (atendimentoProfessional && atendimentoProfessional.value) {
            fechamentoDiarioFullProfessional.value = String(atendimentoProfessional.value);
        }
    }

    if (!fechamentoDiarioFullModal.dataset.bound) {
        if (btnCloseFechamentoDiarioFullModal) btnCloseFechamentoDiarioFullModal.addEventListener('click', closeFechamentoDiarioFullModal);
        if (btnCancelFechamentoDiarioFull) btnCancelFechamentoDiarioFull.addEventListener('click', closeFechamentoDiarioFullModal);
        if (btnGenerateFechamentoDiarioFull) {
            btnGenerateFechamentoDiarioFull.addEventListener('click', async (e) => {
                e.preventDefault();
                const dateStr = fechamentoDiarioFullDate ? String(fechamentoDiarioFullDate.value || '') : '';
                const profSeqId = fechamentoDiarioFullProfessional ? String(fechamentoDiarioFullProfessional.value || '') : '';
                await printFechamentoDiario({ dateStr, profSeqId });
                closeFechamentoDiarioFullModal();
            });
        }
        fechamentoDiarioFullModal.addEventListener('click', (e) => { if (e.target === fechamentoDiarioFullModal) closeFechamentoDiarioFullModal(); });
        fechamentoDiarioFullModal.dataset.bound = '1';
    }

    fechamentoDiarioFullModal.classList.remove('hidden');
}

function closeMovDiariaModal() {
    if (movDiariaModal) movDiariaModal.classList.add('hidden');
}

function openMovDiariaModal() {
    if (!movDiariaModal) return;

    const setTodayIfEmpty = (el) => {
        if (!el || el.value) return;
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        el.value = `${yyyy}-${mm}-${dd}`;
    };

    if (movDiariaDate) setTodayIfEmpty(movDiariaDate);

    if (movDiariaProfessional) {
        const opts = ['<option value="">Todos</option>'];
        (professionals || [])
            .slice()
            .filter(p => String(p.status || '') === 'Ativo')
            .filter(p => String(p.tipo || '').toLowerCase() !== 'protetico')
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                if (p.seqid == null) return;
                opts.push(`<option value="${escapeHtml(String(p.seqid))}">${escapeHtml(String(p.nome || ''))}</option>`);
            });
        movDiariaProfessional.innerHTML = opts.join('');
    }

    if (!movDiariaModal.dataset.bound) {
        if (btnCloseMovDiariaModal) btnCloseMovDiariaModal.addEventListener('click', closeMovDiariaModal);
        if (btnCancelMovDiaria) btnCancelMovDiaria.addEventListener('click', closeMovDiariaModal);
        if (btnGenerateMovDiaria) {
            btnGenerateMovDiaria.addEventListener('click', async (e) => {
                e.preventDefault();
                const dateStr = movDiariaDate ? String(movDiariaDate.value || '') : '';
                const profSeqId = movDiariaProfessional ? String(movDiariaProfessional.value || '') : '';
                await printMovimentacaoDiaria({ dateStr, profSeqId });
                closeMovDiariaModal();
            });
        }
        movDiariaModal.addEventListener('click', (e) => { if (e.target === movDiariaModal) closeMovDiariaModal(); });
        movDiariaModal.dataset.bound = '1';
    }

    movDiariaModal.classList.remove('hidden');
}

function closePagamentosPacientesModal() {
    if (pagamentosPacientesModal) pagamentosPacientesModal.classList.add('hidden');
}

function openPagamentosPacientesModal() {
    if (!pagamentosPacientesModal) return;

    const setTodayIfEmpty = (el) => {
        if (!el || el.value) return;
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        el.value = `${yyyy}-${mm}-${dd}`;
    };

    if (pagamentosPacientesStart) setTodayIfEmpty(pagamentosPacientesStart);
    if (pagamentosPacientesEnd) setTodayIfEmpty(pagamentosPacientesEnd);
    if (pagamentosPacientesForma && pagamentosPacientesForma.value == null) pagamentosPacientesForma.value = '';

    if (!pagamentosPacientesModal.dataset.bound) {
        if (btnClosePagamentosPacientesModal) btnClosePagamentosPacientesModal.addEventListener('click', closePagamentosPacientesModal);
        if (btnCancelPagamentosPacientes) btnCancelPagamentosPacientes.addEventListener('click', closePagamentosPacientesModal);
        if (btnGeneratePagamentosPacientes) {
            btnGeneratePagamentosPacientes.addEventListener('click', async (e) => {
                e.preventDefault();
                const startDateStr = pagamentosPacientesStart ? String(pagamentosPacientesStart.value || '') : '';
                const endDateStr = pagamentosPacientesEnd ? String(pagamentosPacientesEnd.value || '') : '';
                const forma = pagamentosPacientesForma ? String(pagamentosPacientesForma.value || '') : '';
                await printPagamentosPacientes({ startDateStr, endDateStr, forma });
                closePagamentosPacientesModal();
            });
        }
        pagamentosPacientesModal.addEventListener('click', (e) => { if (e.target === pagamentosPacientesModal) closePagamentosPacientesModal(); });
        pagamentosPacientesModal.dataset.bound = '1';
    }

    pagamentosPacientesModal.classList.remove('hidden');
}

async function printPagamentosPacientes({ startDateStr, endDateStr, forma }) {
    if (!startDateStr || !endDateStr) { showToast('Selecione o período.', true); return; }
    if (startDateStr > endDateStr) { showToast('Período inválido: início maior que fim.', true); return; }

    const { startIso } = buildDayDateRangeUTC(startDateStr);
    const { endIso } = buildDayDateRangeUTC(endDateStr);

    const formaKey = forma ? normalizeKey(forma) : '';

    let paymentsRaw = [];
    let payDateCol = 'created_at';
    try {
        const qByDateCol = async (dateCol) => {
            const { data, error } = await withTimeout(
                db.from('orcamento_pagamentos')
                    .select('*')
                    .eq('empresa_id', currentEmpresaId)
                    .gte(dateCol, startIso)
                    .lte(dateCol, endIso)
                    .order(dateCol, { ascending: true }),
                20000,
                `pagamentos_pacientes:orcamento_pagamentos:${dateCol}`
            );
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        };
        try {
            paymentsRaw = await qByDateCol('created_at');
            payDateCol = 'created_at';
        } catch {
            paymentsRaw = await qByDateCol('data_pagamento');
            payDateCol = 'data_pagamento';
        }
    } catch (err) {
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao carregar pagamentos: ${msg}`, true);
        return;
    }

    if (formaKey) {
        paymentsRaw = paymentsRaw.filter(p => normalizeKey(String(p.forma_pagamento || '')) === formaKey);
    }

    const budgetBySeqid = new Map((budgets || []).map(b => [String(b.seqid), b]));
    const patientById = new Map((patients || []).map(p => [String(p.id), p]));
    const patientBySeq = new Map((patients || []).map(p => [String(p.seqid), p]));

    const seqids = Array.from(new Set(paymentsRaw.map(p => String(p.orcamento_id || '')).filter(Boolean)));
    const seqidToPacienteUuid = new Map();
    seqids.forEach(s => {
        const b = budgetBySeqid.get(String(s));
        const pid = b ? String(b.pacienteid || b.paciente_id || '') : '';
        if (pid) seqidToPacienteUuid.set(String(s), pid);
    });
    const missingSeq = seqids.filter(s => !seqidToPacienteUuid.has(String(s)));
    if (missingSeq.length) {
        try {
            const { data: orcs, error: oErr } = await withTimeout(
                db.from('orcamentos')
                    .select('seqid,paciente_id,pacienteid,pacientenome')
                    .eq('empresa_id', currentEmpresaId)
                    .in('seqid', missingSeq.slice(0, 200).map(n => Number(n))),
                15000,
                'pagamentos_pacientes:orcamentos:seqid'
            );
            if (!oErr && Array.isArray(orcs)) {
                orcs.forEach(o => {
                    const pid = String(o.pacienteid || o.paciente_id || '');
                    if (o.seqid != null && pid) seqidToPacienteUuid.set(String(o.seqid), pid);
                });
            }
        } catch { }
    }

    const rows = paymentsRaw.map(p => {
        const dt = p[payDateCol] ? new Date(p[payDateCol]) : null;
        const hora = dt ? formatTimeHHMM(dt) : '—';
        const data = dt ? dt.toLocaleDateString('pt-BR') : '—';
        const seq = String(p.orcamento_id || '');
        const pacUuid = seqidToPacienteUuid.get(seq) || '';
        const pac = pacUuid ? (patientById.get(pacUuid) || patientBySeq.get(pacUuid)) : null;
        const pacNome = pac ? String(pac.nome || '') : (seq ? `Orçamento #${seq}` : '—');
        const formaLabel = String(p.forma_pagamento || '—');
        const valor = Number(p.valor_pago || 0);
        return { data, hora, orc: seq || '—', paciente: pacNome, forma: formaLabel, valor };
    });

    const total = rows.reduce((acc, r) => acc + Number(r.valor || 0), 0);
    const byForma = {};
    rows.forEach(r => {
        const f = String(r.forma || '—');
        byForma[f] = (byForma[f] || 0) + Number(r.valor || 0);
    });
    const formaSummary = Object.entries(byForma)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${formatCurrencyBRL(v)}`)
        .join(' | ') || '—';

    const humanStart = startDateStr.split('-').reverse().join('/');
    const humanEnd = endDateStr.split('-').reverse().join('/');
    const filtroForma = forma ? forma : 'Todos';

    const sorted = rows
        .slice()
        .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || String(a.hora || '').localeCompare(String(b.hora || '')) || String(a.paciente || '').localeCompare(String(b.paciente || ''), 'pt-BR'));

    const groupedRows = [];
    let currentDay = null;
    let daySubtotal = 0;
    let dayCount = 0;
    const flushDay = () => {
        if (!currentDay) return;
        groupedRows.push(`
            <tr>
                <td colspan="5" style="text-align:right; font-weight: 900;">SUBTOTAL ${escapeHtml(currentDay)} (${dayCount})</td>
                <td style="text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(daySubtotal))}</td>
            </tr>
        `);
    };

    if (!sorted.length) {
        groupedRows.push(`<tr><td colspan="6" style="text-align:center; padding: 14px; color:#6b7280;">Nenhum pagamento no período/filtro.</td></tr>`);
    } else {
        sorted.forEach(r => {
            if (currentDay !== r.data) {
                flushDay();
                currentDay = r.data;
                daySubtotal = 0;
                dayCount = 0;
            }
            daySubtotal += Number(r.valor || 0);
            dayCount += 1;
            groupedRows.push(`
                <tr>
                    <td style="width:90px;">${escapeHtml(r.data)}</td>
                    <td style="width:72px;">${escapeHtml(r.hora)}</td>
                    <td style="width:90px; text-align:center;">${escapeHtml(String(r.orc || '—'))}</td>
                    <td>${escapeHtml(r.paciente)}</td>
                    <td style="width:160px;">${escapeHtml(r.forma)}</td>
                    <td style="width:120px; text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(r.valor))}</td>
                </tr>
            `);
        });
        flushDay();
        groupedRows.push(`
            <tr>
                <td colspan="5" style="text-align:right; font-weight: 900;">TOTAL GERAL (${sorted.length})</td>
                <td style="text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(total))}</td>
            </tr>
        `);
    }

    const tableRows = groupedRows.join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pagamentos de Pacientes - ${humanStart} a ${humanEnd}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color:#111827; padding: 24px; }
    .header { border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 14px; }
    .title { font-size: 16px; font-weight: 900; color:#0066cc; }
    .sub { color:#6b7280; margin-top: 4px; font-size: 11px; }
    .kpis { display:flex; gap: 14px; flex-wrap: wrap; margin: 12px 0 14px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; min-width: 170px; }
    .kpi label { display:block; font-size: 10px; color:#6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .kpi div { font-weight: 900; margin-top: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px; }
    th { background: #f9fafb; text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
    .footer { margin-top: 16px; font-size: 10px; color:#9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align:center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Pagamentos de Pacientes</div>
    <div class="sub">Período: <strong>${escapeHtml(humanStart)}</strong> a <strong>${escapeHtml(humanEnd)}</strong> • Forma: <strong>${escapeHtml(filtroForma)}</strong></div>
    <div class="sub">Unidade: ${escapeHtml(String(currentEmpresaId || '—'))}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><label>Registros</label><div>${rows.length}</div></div>
    <div class="kpi"><label>Total</label><div>${escapeHtml(formatCurrencyBRL(total))}</div></div>
    <div class="kpi"><label>Por forma</label><div style="font-size: 12px; font-weight: 700;">${escapeHtml(formaSummary)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:90px;">Data</th>
        <th style="width:72px;">Hora</th>
        <th style="width:90px; text-align:center;">Orç. #</th>
        <th>Paciente</th>
        <th style="width:160px;">Forma</th>
        <th style="width:120px; text-align:right;">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">Documento interno • Pagamentos de Pacientes</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=980,height=720');
    if (!win) { showToast('Habilite pop-ups para gerar o relatório.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
}

async function printMovimentacaoDiaria({ dateStr, profSeqId }) {
    if (!dateStr) { showToast('Selecione a data.', true); return; }
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);

    let paymentsRaw = [];
    let payDateCol = 'created_at';
    try {
        const qByDateCol = async (dateCol) => {
            const { data, error } = await withTimeout(
                db.from('orcamento_pagamentos')
                    .select('*')
                    .eq('empresa_id', currentEmpresaId)
                    .gte(dateCol, startIso)
                    .lte(dateCol, endIso)
                    .order(dateCol, { ascending: true }),
                20000,
                `movdiaria:orcamento_pagamentos:${dateCol}`
            );
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        };
        try {
            paymentsRaw = await qByDateCol('created_at');
            payDateCol = 'created_at';
        } catch {
            paymentsRaw = await qByDateCol('data_pagamento');
            payDateCol = 'data_pagamento';
        }
    } catch (err) {
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao carregar pagamentos do dia: ${msg}`, true);
        return;
    }

    const budgetBySeqid = new Map((budgets || []).map(b => [String(b.seqid), b]));
    const patientById = new Map((patients || []).map(p => [String(p.id), p]));
    const servById = new Map((services || []).map(s => [String(s.id), s]));

    const rows = [];
    paymentsRaw.forEach(p => {
        const seq = String(p.orcamento_id || '');
        const budget = budgetBySeqid.get(seq);
        const itens = budget ? (budget.orcamento_itens || budget.itens || []) : [];
        const pacienteUuid = budget ? String(budget.pacienteid || budget.paciente_id || '') : '';
        const paciente = pacienteUuid ? patientById.get(pacienteUuid) : null;
        const pacNome = paciente ? String(paciente.nome || '') : (seq ? `Orçamento #${seq}` : '—');

        const validItens = itens.filter(it => normalizeStatusKey(String(it.status || it.item_status || '')) !== 'CANCELADO');
        const weights = validItens.map(it => {
            const qtde = Number(it.qtde || 1);
            const valor = Number(it.valor || 0);
            const w = (Number.isFinite(qtde) && qtde > 0 ? qtde : 1) * (Number.isFinite(valor) ? valor : 0);
            return w > 0 ? w : 1;
        });
        const totalW = weights.reduce((a, b) => a + b, 0) || 1;

        const paid = Number(p.valor_pago || 0);
        const forma = String(p.forma_pagamento || '—');
        const dt = p[payDateCol] ? new Date(p[payDateCol]) : null;
        const hora = dt ? formatTimeHHMM(dt) : '—';

        validItens.forEach((it, idx) => {
            const executor = it.profissional_id ?? it.profissionalId ?? it.executor_id ?? it.executorId;
            const execProf = findProfessionalByAnyId(executor);
            const execSeqId = execProf && execProf.seqid != null ? String(execProf.seqid) : String(executor || '');
            if (profSeqId && execSeqId !== String(profSeqId)) return;

            const serv = servById.get(String(it.servico_id || it.servicoId || ''));
            const servLabel = serv ? String(serv.descricao || serv.nome || '') : `Serviço ${it.servico_id || it.servicoId || ''}`;
            const sub = String(it.subdivisao || it.sub_divisao || '').trim();
            const itemLabel = sub ? `${servLabel} — ${sub}` : servLabel;

            const alocado = paid * (weights[idx] / totalW);
            rows.push({
                hora,
                orcSeq: seq || '—',
                paciente: pacNome,
                profissional: execProf ? String(execProf.nome || '') : '—',
                forma,
                item: itemLabel,
                valor: alocado
            });
        });
    });

    const totalAlocado = rows.reduce((acc, r) => acc + Number(r.valor || 0), 0);
    const byForma = {};
    rows.forEach(r => {
        const f = String(r.forma || '—');
        byForma[f] = (byForma[f] || 0) + Number(r.valor || 0);
    });
    const formaSummary = Object.entries(byForma)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${formatCurrencyBRL(v)}`)
        .join(' | ') || '—';

    const humanDate = dateStr.split('-').reverse().join('/');
    const profName = profSeqId ? getProfessionalNameBySeqId(profSeqId) : 'Todos';

    const tableRows = rows.length ? rows
        .slice()
        .sort((a, b) => String(a.paciente || '').localeCompare(String(b.paciente || ''), 'pt-BR') || String(a.hora || '').localeCompare(String(b.hora || '')))
        .map(r => `
            <tr>
                <td style="width:72px;">${escapeHtml(r.hora)}</td>
                <td style="width:90px; text-align:center;">${escapeHtml(String(r.orcSeq || '—'))}</td>
                <td>${escapeHtml(r.paciente)}</td>
                <td>${escapeHtml(r.item)}</td>
                <td>${escapeHtml(r.profissional)}</td>
                <td style="width:160px;">${escapeHtml(r.forma)}</td>
                <td style="width:120px; text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(r.valor))}</td>
            </tr>
        `).join('') : `<tr><td colspan="7" style="text-align:center; padding: 14px; color:#6b7280;">Nenhum registro para o dia/filtro.</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Movimentação Diária - ${humanDate}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color:#111827; padding: 24px; }
    .header { border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 14px; }
    .title { font-size: 16px; font-weight: 900; color:#0066cc; }
    .sub { color:#6b7280; margin-top: 4px; font-size: 11px; }
    .kpis { display:flex; gap: 14px; flex-wrap: wrap; margin: 12px 0 14px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; min-width: 170px; }
    .kpi label { display:block; font-size: 10px; color:#6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .kpi div { font-weight: 900; margin-top: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px; }
    th { background: #f9fafb; text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
    .footer { margin-top: 16px; font-size: 10px; color:#9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align:center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Movimentação Diária</div>
    <div class="sub">Data: <strong>${escapeHtml(humanDate)}</strong> • Profissional: <strong>${escapeHtml(profName)}</strong></div>
    <div class="sub">Unidade: ${escapeHtml(String(currentEmpresaId || '—'))}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><label>Registros</label><div>${rows.length}</div></div>
    <div class="kpi"><label>Total</label><div>${escapeHtml(formatCurrencyBRL(totalAlocado))}</div></div>
    <div class="kpi"><label>Por forma</label><div style="font-size: 12px; font-weight: 700;">${escapeHtml(formaSummary)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:72px;">Hora</th>
        <th style="width:90px; text-align:center;">Orç. #</th>
        <th>Paciente</th>
        <th>Item</th>
        <th style="width:180px;">Profissional</th>
        <th style="width:160px;">Forma</th>
        <th style="width:120px; text-align:right;">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">Documento interno • Movimentação Diária</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=980,height=720');
    if (!win) { showToast('Habilite pop-ups para imprimir.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
}

async function fetchAgendaRowsForFechamento({ dateStr, profSeqId }) {
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
    let q = db.from('agenda_agendamentos')
        .select('id,paciente_id,profissional_id,inicio,status,titulo,observacoes')
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
        if (a.paciente_id == null) return;
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
                if (profSeqId && execSeqId !== String(profSeqId)) return;

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

async function printAgendaDayFromUI() {
    if (!agendaDate || !agendaProfessional || !agendaSlotsBody) { showToast('Agenda indisponível.', true); return; }
    const dateStr = String(agendaDate.value || '');
    const profSeqId = String(agendaProfessional.value || '');
    if (!dateStr || !profSeqId) { showToast('Selecione Data e Profissional.', true); return; }
    const profName = getProfessionalNameBySeqId(Number(profSeqId));
    const humanDate = dateStr.split('-').reverse().join('/');
    const titulo = `Agenda do Dia - ${profName} - ${humanDate}`;

    const rows = Array.from(agendaSlotsBody.querySelectorAll('tr')).map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        const hora = tds[0] ? tds[0].textContent.trim() : '';
        const paciente = tds[1] ? tds[1].textContent.trim() : '';
        const status = tds[2] ? tds[2].textContent.trim() : '';
        if (!hora) return null;
        return { hora, paciente, status };
    }).filter(Boolean);

    const itens = rows.map(r => `<tr><td>${escapeHtml(r.hora)}</td><td>${escapeHtml(r.paciente || '-')}</td><td>${escapeHtml(r.status || '-')}</td></tr>`).join('')
        || `<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:12px;">Sem agendamentos</td></tr>`;

    const w = window.open('', '_blank');
    if (!w) { showToast('Habilite pop-ups para imprimir.', true); return; }
    w.document.write(`
        <html><head><title>${escapeHtml(titulo)}</title>
        <style>
        body { font-family: Inter, Arial, sans-serif; padding: 16px; color: #111827; }
        h2 { margin: 0 0 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
        th { background: #f3f4f6; font-size: 12px; color: #6b7280; }
        </style>
        </head><body>
        <h2>${escapeHtml(titulo)}</h2>
        <table>
            <thead><tr><th>Horário</th><th>Paciente/Título</th><th>Status</th></tr></thead>
            <tbody>${itens}</tbody>
        </table>
        </body></html>
    `);
    setTimeout(() => w.print(), 400);
}

async function printAgendaWeekFromUI(compact = false) {
    if (!agendaProfessional) { showToast('Selecione o profissional.', true); return; }
    const profSeqId = Number(agendaProfessional.value || 0);
    if (!profSeqId) { showToast('Selecione o profissional.', true); return; }
    try {
        const q = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('profissional_id', profSeqId)
            .eq('ativo', true)
            .order('dia_semana', { ascending: true })
            .order('hora_inicio', { ascending: true });
        const { data, error } = await withTimeout(q, 15000, 'agenda_disponibilidade:print_week');
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const byDay = new Map();
        rows.forEach(r => {
            const d = Number(r.dia_semana || 0);
            if (!byDay.has(d)) byDay.set(d, []);
            byDay.get(d).push(r);
        });
        const dayNames = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo' };
        const profName = getProfessionalNameBySeqId(profSeqId);
        const titulo = compact ? `Agenda Semanal Reduzida - ${profName}` : `Agenda Semanal - ${profName}`;

        const content = [1, 2, 3, 4, 5, 6, 7].map(d => {
            const arr = (byDay.get(d) || []).slice();
            const items = arr.map(r => {
                const ini = String(r.hora_inicio || '');
                const fim = String(r.hora_fim || '');
                const slot = Number(r.slot_minutos || 30);
                return compact
                    ? `<div>${escapeHtml(ini)}-${escapeHtml(fim)} • ${slot}min</div>`
                    : `<tr><td>${escapeHtml(ini)}</td><td>${escapeHtml(fim)}</td><td>${escapeHtml(String(slot))}</td></tr>`;
            }).join('') || (compact ? `<div style="color:#6b7280;">Sem disponibilidade</div>` : `<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:12px;">Sem disponibilidade</td></tr>`);

            return compact
                ? `<div style="margin-bottom:10px;"><div style="font-weight:700;margin:6px 0;">${dayNames[d]}</div>${items}</div>`
                : `<h3 style="margin:12px 0 6px 0;">${dayNames[d]}</h3>
                   <table><thead><tr><th>Início</th><th>Fim</th><th>Slot (min)</th></tr></thead><tbody>${items}</tbody></table>`;
        }).join('');

        const w = window.open('', '_blank');
        if (!w) { showToast('Habilite pop-ups para imprimir.', true); return; }
        w.document.write(`
            <html><head><title>${escapeHtml(titulo)}</title>
            <style>
            body { font-family: Inter, Arial, sans-serif; padding: 16px; color: #111827; }
            h2 { margin: 0 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
            th { background: #f3f4f6; font-size: 12px; color: #6b7280; }
            </style>
            </head><body>
            <h2>${escapeHtml(titulo)}</h2>
            ${content}
            </body></html>
        `);
        setTimeout(() => w.print(), 500);
    } catch (e) {
        showToast('Falha ao gerar impressão da agenda semanal.', true);
    }
}

async function printAgendaWeekAppointmentsFromUI() {
    if (!agendaProfessional || !agendaDate) { showToast('Agenda indisponível.', true); return; }
    const profSeqId = Number(agendaProfessional.value || 0);
    const dateStr = String(agendaDate.value || '');
    if (!profSeqId || !dateStr) { showToast('Selecione Data e Profissional.', true); return; }
    const base = new Date(`${dateStr}T00:00:00`);
    const day = base.getDay() || 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - (day - 1));
    const days = Array.from({ length: 7 }).map((_, i) => {
        const x = new Date(monday);
        x.setDate(monday.getDate() + i);
        const yyyy = x.getFullYear();
        const mm = String(x.getMonth() + 1).padStart(2, '0');
        const dd = String(x.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    try {
        const profName = getProfessionalNameBySeqId(profSeqId);
        const titulo = `Agenda Semanal (Agendamentos) - ${profName}`;
        const sections = [];
        for (const d of days) {
            const rows = await fetchAgendaRowsForFechamento({ dateStr: d, profSeqId });
            const valid = rows.filter(a => String(a.status || '') !== 'CANCELADO');
            const itens = valid.map(a => {
                const dt = new Date(a.inicio);
                const hh = String(dt.getHours()).padStart(2, '0');
                const mi = String(dt.getMinutes()).padStart(2, '0');
                const ini = `${hh}:${mi}`;
                const st = a.status || '—';
                const pacienteId = a.paciente_id != null ? String(a.paciente_id) : '';
                const pacienteNome = pacienteId ? getPacienteNameBySeqId(pacienteId) : '';
                const tit = String(a.titulo || '').trim();
                const label = pacienteNome
                    ? (tit && normalizeKey(tit) !== normalizeKey(pacienteNome) ? `${pacienteNome} — ${tit}` : pacienteNome)
                    : (tit || '-');
                return `<tr><td>${ini}</td><td>${escapeHtml(label)}</td><td>${escapeHtml(st)}</td></tr>`;
            }).join('') || `<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:12px;">Sem agendamentos</td></tr>`;
            sections.push(`
                <h3 style="margin:12px 0 6px 0;">${d}</h3>
                <table><thead><tr><th>Início</th><th>Paciente/Título</th><th>Status</th></tr></thead><tbody>${itens}</tbody></table>
            `);
        }
        const w = window.open('', '_blank');
        if (!w) { showToast('Habilite pop-ups para imprimir.', true); return; }
        w.document.write(`
            <html><head><title>${escapeHtml(titulo)}</title>
            <style>
            body { font-family: Inter, Arial, sans-serif; padding: 16px; color: #111827; }
            h2 { margin: 0 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
            th { background: #f3f4f6; font-size: 12px; color: #6b7280; }
            </style>
            </head><body>
            <h2>${escapeHtml(titulo)}</h2>
            ${sections.join('')}
            </body></html>
        `);
        setTimeout(() => w.print(), 500);
    } catch (e) {
        showToast('Falha ao gerar impressão semanal com agendamentos.', true);
    }
}

async function printFechamentoDiario({ dateStr, profSeqId }) {
    if (!dateStr) { showToast('Selecione a data.', true); return; }
    if (btnGenerateFechamentoDiario) btnGenerateFechamentoDiario.disabled = true;
    try {
        const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
        const agendaRows = await fetchAgendaRowsForFechamento({ dateStr, profSeqId });
        const agValid = (agendaRows || []).filter(a => String(a.status || '') !== 'CANCELADO');
        const statusCounts = {};
        agValid.forEach(a => {
            const st = String(a.status || 'MARCADO');
            statusCounts[st] = (statusCounts[st] || 0) + 1;
        });

        const profName = profSeqId ? getProfessionalNameBySeqId(profSeqId) : 'Todos';
        const humanDate = dateStr.split('-').reverse().join('/');
        const rows = buildAtendimentoRowsFromAgenda({ agendaRows: agValid, profSeqId: profSeqId || '' });
        const totalProduzido = rows.reduce((acc, r) => acc + Number(r.itemTotal || 0), 0);
        const totalFinalizados = rows.filter(r => normalizeStatusKey(r.itemStatus) === 'FINALIZADO').length;
        const totalFinalizadosValor = rows
            .filter(r => normalizeStatusKey(r.itemStatus) === 'FINALIZADO')
            .reduce((acc, r) => acc + Number(r.itemTotal || 0), 0);

        const statusSummary = Object.entries(statusCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ') || '—';

        let paymentsRows = [];
        try {
            const tryFetchByDateCol = async (dateCol) => {
                const { data, error } = await withTimeout(
                    db.from('orcamento_pagamentos')
                        .select('*')
                        .eq('empresa_id', currentEmpresaId)
                        .gte(dateCol, startIso)
                        .lte(dateCol, endIso)
                        .order(dateCol, { ascending: true }),
                    15000,
                    `fechamento:orcamento_pagamentos:${dateCol}`
                );
                if (error) throw error;
                return { rows: Array.isArray(data) ? data : [], dateCol };
            };

            let paymentsRaw = [];
            let payDateCol = 'created_at';
            try {
                const res = await tryFetchByDateCol('created_at');
                paymentsRaw = res.rows;
                payDateCol = res.dateCol;
            } catch {
                const res = await tryFetchByDateCol('data_pagamento');
                paymentsRaw = res.rows;
                payDateCol = res.dateCol;
            }

            const budgetBySeqid = new Map((budgets || []).map(b => [String(b.seqid), b]));
            const patientById = new Map((patients || []).map(p => [String(p.id), p]));
            const patientBySeq = new Map((patients || []).map(p => [String(p.seqid), p]));

            const seqids = Array.from(new Set(paymentsRaw.map(p => String(p.orcamento_id || '')).filter(Boolean)));
            const seqidToPacienteUuid = new Map();
            seqids.forEach(s => {
                const b = budgetBySeqid.get(String(s));
                const pid = b ? String(b.pacienteid || b.paciente_id || '') : '';
                if (pid) seqidToPacienteUuid.set(String(s), pid);
            });
            const missingSeq = seqids.filter(s => !seqidToPacienteUuid.has(String(s)));
            if (missingSeq.length) {
                try {
                    const { data: orcs, error: oErr } = await withTimeout(
                        db.from('orcamentos')
                            .select('seqid,paciente_id,pacienteid')
                            .eq('empresa_id', currentEmpresaId)
                            .in('seqid', missingSeq.slice(0, 200).map(n => Number(n))),
                        15000,
                        'fechamento:orcamentos:seqid'
                    );
                    if (!oErr && Array.isArray(orcs)) {
                        orcs.forEach(o => {
                            const pid = String(o.pacienteid || o.paciente_id || '');
                            if (o.seqid != null && pid) seqidToPacienteUuid.set(String(o.seqid), pid);
                        });
                    }
                } catch { }
            }

            paymentsRows = paymentsRaw.map(p => {
                const dt = p[payDateCol] ? new Date(p[payDateCol]) : null;
                const hora = dt ? formatTimeHHMM(dt) : '—';
                const seq = String(p.orcamento_id || '');
                const pacUuid = seqidToPacienteUuid.get(seq) || '';
                const pac = pacUuid ? (patientById.get(pacUuid) || patientBySeq.get(pacUuid)) : null;
                const pacNome = pac ? String(pac.nome || '') : (seq ? `Orçamento #${seq}` : '—');
                const forma = String(p.forma_pagamento || '—');
                const valor = Number(p.valor_pago || 0);
                return { hora, pacNome, forma, valor };
            });
        } catch {
            paymentsRows = [];
        }

        const paymentsTotal = paymentsRows.reduce((acc, r) => acc + Number(r.valor || 0), 0);
        const paymentsByForma = {};
        paymentsRows.forEach(r => {
            const f = String(r.forma || '—');
            paymentsByForma[f] = (paymentsByForma[f] || 0) + Number(r.valor || 0);
        });
        const paymentsFormaSummary = Object.entries(paymentsByForma)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k}: ${formatCurrencyBRL(v)}`)
            .join(' | ') || '—';

        const paymentsTableRows = paymentsRows.length ? paymentsRows
            .slice()
            .sort((a, b) => String(a.pacNome || '').localeCompare(String(b.pacNome || ''), 'pt-BR') || String(a.hora || '').localeCompare(String(b.hora || '')))
            .map(r => `
                <tr>
                    <td style="width:72px;">${escapeHtml(r.hora)}</td>
                    <td>${escapeHtml(r.pacNome)}</td>
                    <td>${escapeHtml(r.forma)}</td>
                    <td style="text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(r.valor))}</td>
                </tr>
            `).join('') : `<tr><td colspan="4" style="text-align:center; padding: 14px; color:#6b7280;">Nenhum pagamento registrado no dia.</td></tr>`;

        const paymentsTableRowsWithTotal = paymentsRows.length ? (paymentsTableRows + `
            <tr>
                <td colspan="3" style="text-align:right; font-weight: 900;">TOTAL</td>
                <td style="text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(paymentsTotal))}</td>
            </tr>
        `) : paymentsTableRows;

        let commissionsHtml = '';
        let commissionsTotal = null;
        if (isAdminRole() || isSuperAdmin || can('comissoes', 'select')) {
            try {
                const tryFetchComByDateCol = async (dateCol) => {
                    let comQ = db.from('financeiro_comissoes')
                        .select('*')
                        .eq('empresa_id', currentEmpresaId)
                        .gte(dateCol, startIso)
                        .lte(dateCol, endIso)
                        .order('profissional_id', { ascending: true });
                    if (profSeqId) comQ = comQ.eq('profissional_id', Number(profSeqId));
                    const { data, error } = await withTimeout(comQ, 15000, `fechamento:financeiro_comissoes:${dateCol}`);
                    if (error) throw error;
                    return Array.isArray(data) ? data : [];
                };
                let comRows = [];
                try {
                    comRows = await tryFetchComByDateCol('data_geracao');
                } catch {
                    try {
                        comRows = await tryFetchComByDateCol('criado_em');
                    } catch {
                        comRows = await tryFetchComByDateCol('created_at');
                    }
                }

                const itemIds = Array.from(new Set(comRows.map(r => r.item_id).filter(Boolean).map(String)));
                const itemToServico = new Map();
                if (itemIds.length) {
                    const chunk = itemIds.slice(0, 200);
                    const { data: its, error: itErr } = await withTimeout(
                        db.from('orcamento_itens').select('id, servico_id').in('id', chunk),
                        15000,
                        'fechamento:orcamento_itens'
                    );
                    if (!itErr && Array.isArray(its)) {
                        its.forEach(it => itemToServico.set(String(it.id), String(it.servico_id || '')));
                    }
                }
                const servById = new Map((services || []).map(s => [String(s.id), s]));

                const comTotal = comRows.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);
                commissionsTotal = comTotal;
                const comTableRows = comRows.length ? comRows.map(r => {
                    const prof = getProfessionalNameBySeqId(r.profissional_id);
                    const sid = itemToServico.get(String(r.item_id || '')) || '';
                    const serv = sid ? servById.get(String(sid)) : null;
                    const itemLabel = r.item_descricao ? String(r.item_descricao) : (serv ? String(serv.descricao || serv.nome || '—') : '—');
                    const val = formatCurrencyBRL(Number(r.valor_comissao || 0));
                    const st = String(r.status || '—');
                    return `
                        <tr>
                            <td>${escapeHtml(String(prof || '—'))}</td>
                            <td>${escapeHtml(itemLabel)}</td>
                            <td>${escapeHtml(st)}</td>
                            <td style="text-align:right; font-weight: 900;">${escapeHtml(val)}</td>
                        </tr>
                    `;
                }).join('') : `<tr><td colspan="4" style="text-align:center; padding: 14px; color:#6b7280;">Nenhuma comissão gerada no dia.</td></tr>`;

                commissionsHtml = `
                    <div style="margin-top: 18px;">
                        <div style="font-weight: 900; font-size: 13px;">Comissões do Dia (Admin)</div>
                        <div style="color:#6b7280; font-size: 11px; margin-top: 4px;">Total: <strong>${escapeHtml(formatCurrencyBRL(comTotal))}</strong></div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Profissional</th>
                                    <th>Serviço</th>
                                    <th style="width: 110px;">Status</th>
                                    <th style="width: 120px; text-align:right;">Valor</th>
                                </tr>
                            </thead>
                            <tbody>${comTableRows}</tbody>
                        </table>
                    </div>
                `;
            } catch {
                commissionsTotal = null;
                commissionsHtml = `
                    <div style="margin-top: 18px;">
                        <div style="font-weight: 900; font-size: 13px;">Comissões do Dia (Admin)</div>
                        <div style="color:#6b7280; font-size: 11px; margin-top: 4px;">Falha ao carregar comissões.</div>
                    </div>
                `;
            }
        }

        const tableRows = rows.length ? rows.map(r => `
            <tr>
                <td>${escapeHtml(r.hora)}</td>
                <td>${escapeHtml(r.pacienteNome)}</td>
                <td>${escapeHtml(String(r.budgetSeq || '—'))}</td>
                <td>${escapeHtml(r.itemLabel)}</td>
                <td>${escapeHtml(String(r.itemStatus || '—'))}</td>
                <td style="text-align:right;">${formatCurrencyBRL(r.itemTotal)}</td>
            </tr>
        `).join('') : `
            <tr><td colspan="6" style="text-align:center; padding: 14px; color:#6b7280;">Nenhum item encontrado para o filtro.</td></tr>
        `;

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Fechamento Diário - ${humanDate}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color:#111827; padding: 24px; }
    .header { display:flex; justify-content: space-between; border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 14px; }
    .title { font-size: 16px; font-weight: 900; color:#0066cc; }
    .sub { color:#6b7280; margin-top: 4px; font-size: 11px; }
    .kpis { display:flex; gap: 14px; flex-wrap: wrap; margin: 12px 0 14px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; min-width: 170px; }
    .kpi label { display:block; font-size: 10px; color:#6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .kpi div { font-weight: 900; margin-top: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px; }
    th { background: #f9fafb; text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
    .footer { margin-top: 16px; font-size: 10px; color:#9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align:center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Fechamento Diário</div>
      <div class="sub">Data: <strong>${humanDate}</strong> • Profissional: <strong>${escapeHtml(profName)}</strong></div>
      <div class="sub">Agenda: ${escapeHtml(statusSummary)}</div>
    </div>
    <div style="text-align:right;">
      <div class="sub">Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
      <div class="sub">Unidade: ${escapeHtml(String(currentEmpresaId || '—'))}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><label>Itens</label><div>${rows.length}</div></div>
    <div class="kpi"><label>Finalizados</label><div>${totalFinalizados}</div></div>
    <div class="kpi"><label>Total Produzido</label><div>${formatCurrencyBRL(totalProduzido)}</div></div>
    <div class="kpi"><label>Total Finalizados</label><div>${formatCurrencyBRL(totalFinalizadosValor)}</div></div>
    <div class="kpi"><label>Total Pagamentos</label><div>${formatCurrencyBRL(paymentsTotal)}</div></div>
    ${(isAdminRole() || isSuperAdmin || can('comissoes','select'))
        ? `<div class="kpi"><label>Total Comissões</label><div>${commissionsTotal == null ? '—' : escapeHtml(formatCurrencyBRL(commissionsTotal))}</div></div>`
        : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:72px;">Hora</th>
        <th>Paciente</th>
        <th style="width:70px; text-align:center;">Orc. #</th>
        <th>Item</th>
        <th style="width:120px;">Status</th>
        <th style="width:120px; text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div style="margin-top: 10px;">
    <div style="font-weight: 900; font-size: 13px;">Pagamentos do Dia</div>
    <div class="sub">Total: <strong>${escapeHtml(formatCurrencyBRL(paymentsTotal))}</strong> • ${escapeHtml(paymentsFormaSummary)}</div>
    <table>
      <thead>
        <tr>
          <th style="width:72px;">Hora</th>
          <th>Paciente</th>
          <th style="width:160px;">Forma</th>
          <th style="width:120px; text-align:right;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${paymentsTableRowsWithTotal}
      </tbody>
    </table>
  </div>

  ${commissionsHtml}

  <div class="footer">Documento interno • Fechamento Diário</div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=980,height=720');
        if (!win) { showToast('Habilite pop-ups para imprimir.', true); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
        closeFechamentoDiarioModal();
    } catch (err) {
        console.error('Erro ao gerar Fechamento Diário:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao gerar Fechamento Diário: ${msg}`, true);
    } finally {
        if (btnGenerateFechamentoDiario) btnGenerateFechamentoDiario.disabled = false;
    }
}

function renderAtendimentoPlaceholder(msg = 'Selecione a data e o profissional.') {
    if (atendimentoBody) {
        atendimentoBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">${msg}</td></tr>`;
    }
    if (atendimentoEmptyState) atendimentoEmptyState.classList.add('hidden');
    if (atendimentoSummary) atendimentoSummary.textContent = '—';
    atendimentoSelectedItems.clear();
    updateAtendimentoFinalizeButton();
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeImageSrc(src) {
    const s0 = String(src || '');
    let s = s0.trim();
    if (!s) return '';
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
        if (!s) return '';
    }
    s = s.replace(/^\uFEFF/, '').trim();
    if (!s) return '';
    s = s.replace(/\\r\\n|\\n|\\r/g, '');
    const lower = s.toLowerCase();
    if (lower.includes('data:image/')) {
        const idx = lower.indexOf('data:image/');
        const sub = s.slice(idx);
        return sub.replace(/\s+/g, '');
    }
    if (lower.startsWith('data:')) return s.replace(/\s+/g, '');
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('blob:')) return s;
    if (s.startsWith('/')) return s;
    const compact = s.replace(/\s+/g, '');
    if (/^[a-z0-9+/]+={0,2}$/i.test(compact) && compact.length > 100) {
        const mime = compact.startsWith('/9j/') ? 'image/jpeg' : (compact.startsWith('iVBOR') ? 'image/png' : 'image/png');
        return `data:${mime};base64,${compact}`;
    }
    return '';
}

function dataUrlToObjectUrl(dataUrl) {
    try {
        const s = String(dataUrl || '');
        const idx = s.indexOf(',');
        if (idx <= 0) return '';
        const header = s.slice(0, idx);
        const data = s.slice(idx + 1);
        const m = header.match(/^data:([^;]+);base64$/i);
        if (!m) return '';
        const mime = m[1] || 'application/octet-stream';
        const binStr = atob(data);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        return URL.createObjectURL(blob);
    } catch {
        return '';
    }
}

function getProfessionalPhotoValue(p) {
    if (!p || typeof p !== 'object') return '';
    const tryValue = (v) => {
        if (!v) return '';
        if (typeof v === 'string' || typeof v === 'number') return normalizeImageSrc(v);
        if (typeof v === 'object') {
            const keys = ['src', 'url', 'data', 'base64', 'value', 'photo', 'foto', 'imagem'];
            for (const k of keys) {
                if (v && Object.prototype.hasOwnProperty.call(v, k)) {
                    const out = normalizeImageSrc(v[k]);
                    if (out) return out;
                }
            }
        }
        return '';
    };
    const candidates = [p.photo, p.foto, p.foto_base64, p.photo_base64, p.imagem, p.imagem_base64];
    for (const c of candidates) {
        const out = tryValue(c);
        if (out) return out;
    }
    return '';
}

function normalizeKey(v) {
    return String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/_/g, '')
        .trim()
        .toUpperCase();
}

function normalizeStatusKey(v) {
    const k = normalizeKey(v);
    if (k === 'FINALIZADO' || k === 'FINALIZADA') return 'FINALIZADO';
    if (k === 'CANCELADO' || k === 'CANCELADA') return 'CANCELADO';
    if (k === 'LIBERADO' || k === 'LIBERADA') return 'LIBERADO';
    if (k === 'EMEXECUCAO' || k === 'EMEXECUÇÃO') return 'EMEXECUCAO';
    return k;
}

function formatOrcamentoItemElementos(it) {
    let els = [];
    if (it && it.elementos != null) {
        if (Array.isArray(it.elementos)) {
            els = it.elementos;
        } else if (typeof it.elementos === 'string') {
            const raw = String(it.elementos || '').trim();
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) els = parsed;
                } catch { }
            }
        }
    }
    const list = els.map(x => {
        if (x == null) return '';
        if (typeof x === 'string' || typeof x === 'number') return String(x).trim();
        if (typeof x === 'object') return String(x.dente ?? x.value ?? x.id ?? '').trim();
        return '';
    }).filter(Boolean);
    return list.length ? list.join(' • ') : '';
}

function findProfessionalByAnyId(v) {
    if (v == null) return null;
    const raw = String(v);
    const num = Number(raw);
    const byId = (professionals || []).find(p => String(p.id) === raw);
    if (byId) return byId;
    if (Number.isFinite(num)) {
        const bySeq = (professionals || []).find(p => Number(p.seqid) === num);
        if (bySeq) return bySeq;
    }
    const bySeqStr = (professionals || []).find(p => String(p.seqid) === raw);
    return bySeqStr || null;
}

function getPacienteDetailsBySeqId(seqId) {
    const n = Number(seqId);
    if (!Number.isFinite(n)) return null;
    return (patients || []).find(p => Number(p.seqid) === n) || null;
}

const atendimentoSelectedItems = new Map();

function updateAtendimentoFinalizeButton() {
    if (!btnAtendimentoFinalizeSelected) return;
    let n = atendimentoSelectedItems.size;
    if (atendimentoBody) {
        const checked = atendimentoBody.querySelectorAll('input[type="checkbox"][data-action="done"]:checked');
        if (checked && checked.length) n = checked.length;
    }
    btnAtendimentoFinalizeSelected.disabled = n === 0;
    btnAtendimentoFinalizeSelected.innerHTML = n === 0
        ? '<i class="ri-check-double-line"></i> Finalizar Selecionados'
        : `<i class="ri-check-double-line"></i> Finalizar Selecionados (${n})`;
}

async function fetchAtendimentoForUI() {
    if (!atendimentoDate || !atendimentoProfessional) return;
    const dateStr = atendimentoDate.value;
    const profSeqId = atendimentoProfessional.value;
    if (!dateStr || !profSeqId) {
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
        if (!Number.isFinite(Number(profSeqId))) {
            renderAtendimentoPlaceholder('Profissional inválido.');
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
            if (a.paciente_id == null) return;
            const k = String(a.paciente_id);
            if (!byPaciente.has(k)) byPaciente.set(k, []);
            byPaciente.get(k).push(a);
        });
        byPaciente.forEach(list => list.sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || ''))));

        const itemsRows = [];
        byPaciente.forEach((list, pacienteSeqIdStr) => {
            const paciente = getPacienteDetailsBySeqId(pacienteSeqIdStr);
            const pacienteUuid = paciente?.id || null;
            if (!pacienteUuid) return;

            const allPatientBudgets = (budgets || []).filter(b => String(b.pacienteid || b.paciente_id || '') === String(pacienteUuid));
            const patientBudgets = allPatientBudgets
                .filter(b => {
                    const stKey = normalizeKey(b && b.status || '');
                    return stKey !== 'EXECUTADO' && stKey !== 'CANCELADO';
                })
                .sort((a, b) => {
                    const sa = Number(a && a.seqid || 0);
                    const sb = Number(b && b.seqid || 0);
                    return sb - sa;
                });
            const hasOnlyClosedBudgets = allPatientBudgets.length > 0 && patientBudgets.length === 0;
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
                    const elsDisplay = formatOrcamentoItemElementos(it);
                    const itemLabelWithEls = elsDisplay ? `${itemLabel} (${elsDisplay})` : itemLabel;

                    matched.push({
                        hora,
                        agendamentoId: agId,
                        paciente,
                        budget: b,
                        itemId: String(it.id || ''),
                        itemLabel: itemLabelWithEls,
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
                : (hasOnlyClosedBudgets ? 'Todos os orçamentos do paciente estão Executados/Cancelados' : 'Sem orçamento para este paciente');
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
            atendimentoSelectedItems.clear();
            updateAtendimentoFinalizeButton();
            return;
        }

        if (!atendimentoBody) return;
        atendimentoBody.innerHTML = '';
        itemsRows.forEach(r => {
            const tr = document.createElement('tr');
            if (r.isPlaceholder) tr.style.background = '#fff7ed';
            const selected = r.itemId ? atendimentoSelectedItems.has(String(r.itemId)) : false;
            tr.innerHTML = `
                <td style="font-weight:800;">${escapeHtml(r.hora)}</td>
                <td style="font-weight:600;">${escapeHtml(r.paciente?.nome || '-')}</td>
                <td style="white-space: normal;">${escapeHtml(r.itemLabel || '-')}</td>
                <td style="text-align:center; font-weight:800;">${escapeHtml(String(r.budget?.seqid || '-'))}</td>
                <td>${escapeHtml(String(r.itemStatus || '-'))}</td>
                <td>
                    ${r.isPlaceholder ? '' : `
                        <label style="display:inline-flex; align-items:center; gap: 6px; margin-right: 10px;">
                            <input type="checkbox" data-action="done" data-agendamento="${escapeHtml(r.agendamentoId || '')}" data-budget="${escapeHtml(r.budget?.id || '')}" data-item="${escapeHtml(r.itemId || '')}" ${selected ? 'checked' : ''}>
                            Feito
                        </label>
                    `}
                    ${r.paciente?.id ? `<button class="btn-icon" onclick="showPatientDetails('${escapeHtml(r.paciente?.id)}')" title="Prontuário"><i class="ri-folder-user-line"></i></button>` : ''}
                    ${r.budget && r.budget.id ? `<button class="btn-icon" onclick="viewBudgetPayments('${escapeHtml(r.budget?.id)}')" title="Orçamento"><i class="ri-file-list-3-line"></i></button>` : ''}
                </td>
            `;
            atendimentoBody.appendChild(tr);
        });

        atendimentoBody.querySelectorAll('input[type="checkbox"][data-action="done"]').forEach(chk => {
            chk.addEventListener('change', () => {
                const budgetId = chk.getAttribute('data-budget') || '';
                const itemId = chk.getAttribute('data-item') || '';
                const agendamentoId = chk.getAttribute('data-agendamento') || '';
                if (!itemId) return;
                if (chk.checked) atendimentoSelectedItems.set(String(itemId), { budgetId, itemId, agendamentoId });
                else atendimentoSelectedItems.delete(String(itemId));
                updateAtendimentoFinalizeButton();
            });
        });

        updateAtendimentoFinalizeButton();
    } catch (err) {
        console.error('Erro ao carregar Atendimento:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        renderAtendimentoPlaceholder(`Erro ao carregar atendimentos: ${msg}`);
    }
}

async function confirmAtendimentoItem({ budgetId, itemId, agendamentoId }, { suppressRefresh } = {}) {
    if (!itemId) return { ok: false, reason: 'missing_item_id' };
    try {
        const { data, error } = await withTimeout(
            db.from('orcamento_itens')
                .update({ status: 'Finalizado' })
                .eq('empresa_id', currentEmpresaId)
                .eq('id', itemId)
                .select('id'),
            15000,
            'orcamento_itens:finalizar_atendimento'
        );
        if (error) throw error;
        const updatedRows = Array.isArray(data) ? data : [];
        if (!updatedRows.length) throw new Error('Item não encontrado ou sem permissão para atualizar.');

        let agendaOk = true;
        let agendaErrorMessage = '';
        if (agendamentoId) {
            const { error: agErr } = await withTimeout(
                db.from('agenda_agendamentos')
                    .update({ status: 'CONCLUIDO' })
                    .eq('empresa_id', currentEmpresaId)
                    .eq('id', agendamentoId),
                15000,
                'agenda_agendamentos:concluir_atendimento'
            );
            if (agErr) {
                agendaOk = false;
                agendaErrorMessage = agErr && agErr.message ? String(agErr.message) : 'Falha ao concluir agendamento.';
                console.error('Falha ao concluir agenda do atendimento:', agErr);
            }
        }

        const b = (budgets || []).find(x => String(x.id) === String(budgetId));
        if (b && Array.isArray(b.orcamento_itens)) {
            const it = b.orcamento_itens.find(x => String(x.id) === String(itemId));
            if (it) it.status = 'Finalizado';
        }

        if (!suppressRefresh) {
            showToast('Serviço marcado como Finalizado.');
            await fetchAtendimentoForUI();
        }
        return { ok: true, agendaOk, agendaErrorMessage };
    } catch (err) {
        console.error('Erro ao finalizar item do atendimento:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        if (!suppressRefresh) {
            showToast(`Falha ao finalizar: ${msg}`, true);
            await fetchAtendimentoForUI();
        } else {
            throw err;
        }
    }
}

function getAtendimentoSelectedEntries() {
    const entries = [];
    if (atendimentoBody) {
        const checked = atendimentoBody.querySelectorAll('input[type="checkbox"][data-action="done"]:checked');
        checked.forEach(chk => {
            const itemId = chk.getAttribute('data-item') || '';
            if (!itemId) return;
            entries.push({
                itemId,
                budgetId: chk.getAttribute('data-budget') || '',
                agendamentoId: chk.getAttribute('data-agendamento') || '',
            });
        });
    }
    if (entries.length) {
        const byId = new Map();
        entries.forEach(e => byId.set(String(e.itemId), e));
        return Array.from(byId.values());
    }
    return Array.from(atendimentoSelectedItems.values());
}

async function finalizeAtendimentoSelectedItems() {
    const entries = getAtendimentoSelectedEntries();
    if (!entries.length) return;
    const ok = confirm(`Finalizar ${entries.length} item(ns) selecionado(s)?`);
    if (!ok) return;

    if (btnAtendimentoFinalizeSelected) btnAtendimentoFinalizeSelected.disabled = true;

    let success = 0;
    let fail = 0;
    let agendaWarn = 0;
    let firstErrorMsg = '';
    try {
        for (const e of entries) {
            try {
                const res = await confirmAtendimentoItem({ budgetId: e.budgetId, itemId: e.itemId, agendamentoId: e.agendamentoId }, { suppressRefresh: true });
                success += 1;
                if (res && res.agendaOk === false) agendaWarn += 1;
            } catch (err) {
                console.error('Falha ao finalizar item do atendimento:', err);
                if (!firstErrorMsg) firstErrorMsg = err && err.message ? String(err.message) : 'Erro desconhecido';
                fail += 1;
            }
        }
    } finally {
        atendimentoSelectedItems.clear();
        updateAtendimentoFinalizeButton();
        if (success && !fail && !agendaWarn) showToast(`Finalizado(s) ${success} item(ns).`);
        else if (success) {
            const parts = [`Finalizado(s) ${success} item(ns).`];
            if (fail) parts.push(`Falha em ${fail}.`);
            if (agendaWarn) parts.push(`Agenda não foi concluída em ${agendaWarn}.`);
            showToast(parts.join(' '), true);
        } else if (fail) {
            const suffix = firstErrorMsg ? ` Motivo: ${firstErrorMsg}` : '';
            showToast(`Falha ao finalizar ${fail} item(ns).${suffix}`, true);
        } else {
            showToast('Nenhum item foi finalizado.', true);
        }
        await fetchAtendimentoForUI();
    }
}

async function refreshDashboardFromUI() {
    const dashDate = document.getElementById('dashDate');
    const dashProfessional = document.getElementById('dashProfessional');
    const dateStr = dashDate ? dashDate.value : '';
    const profSeqId = dashProfessional ? dashProfessional.value : '';
    if (!dateStr) return;
    await fetchDashboard({ dateStr, profSeqId: profSeqId ? Number(profSeqId) : null });
    renderSuperAdminRenewals();
}

function renderSuperAdminRenewals() {
    const kpiCard = document.getElementById('kpiRenovacoesCard');
    const kpiVal = document.getElementById('kpiRenovacoes');
    const kpiSub = document.getElementById('kpiRenovacoesSub');
    const card = document.getElementById('dashRenewalsCard');
    const sub = document.getElementById('dashRenewalsSub');
    const body = document.getElementById('dashRenewalsBody');
    const empty = document.getElementById('dashRenewalsEmpty');

    if (!isSuperAdmin) {
        if (kpiCard) kpiCard.classList.add('hidden');
        if (card) card.classList.add('hidden');
        return;
    }

    if (kpiCard) kpiCard.classList.remove('hidden');
    if (card) card.classList.remove('hidden');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayMs = 24 * 60 * 60 * 1000;

    const rows = (activeEmpresasList || [])
        .map(e => {
            const id = e && e.id ? String(e.id) : '';
            const nome = e && e.nome ? String(e.nome) : id || '—';
            const venc = e && e.data_vencimento ? String(e.data_vencimento).slice(0, 10) : '';
            if (!venc) return null;
            const vencDate = new Date(`${venc}T00:00:00`);
            if (!Number.isFinite(vencDate.getTime())) return null;
            const threshold = new Date(vencDate.getTime() - (5 * dayMs));
            const due = today.getTime() >= threshold.getTime();
            if (!due) return null;
            const diffDays = Math.ceil((vencDate.getTime() - today.getTime()) / dayMs);
            return { id, nome, venc, vencDate, diffDays };
        })
        .filter(Boolean)
        .sort((a, b) => {
            const ta = a.vencDate.getTime();
            const tb = b.vencDate.getTime();
            if (ta !== tb) return ta - tb;
            return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });

    const expired = rows.filter(r => r.diffDays < 0).length;
    const dueSoon = rows.filter(r => r.diffDays >= 0).length;

    if (kpiVal) kpiVal.textContent = String(rows.length);
    if (kpiSub) {
        if (!rows.length) kpiSub.textContent = 'Sem pendências';
        else if (expired && dueSoon) kpiSub.textContent = `${expired} vencida(s) | ${dueSoon} a vencer`;
        else if (expired) kpiSub.textContent = `${expired} vencida(s)`;
        else kpiSub.textContent = `${dueSoon} a vencer`;
    }

    if (sub) {
        if (!rows.length) sub.textContent = 'Nenhuma clínica em janela de renovação.';
        else sub.textContent = `${rows.length} clínica(s) com vencimento em até 5 dias (ou vencidas)`;
    }

    if (body) body.innerHTML = '';
    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    rows.forEach(r => {
        const tr = document.createElement('tr');
        const dd = String(r.vencDate.getDate()).padStart(2, '0');
        const mm = String(r.vencDate.getMonth() + 1).padStart(2, '0');
        const yyyy = String(r.vencDate.getFullYear());
        const vencBr = `${dd}/${mm}/${yyyy}`;
        const diasLabel = r.diffDays < 0 ? `Vencida há ${Math.abs(r.diffDays)}d` : `Em ${r.diffDays}d`;
        tr.innerHTML = `
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);"><strong>${r.nome}</strong><br><small style="color: var(--text-muted);">${r.id}</small></td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${vencBr}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:right; ${r.diffDays < 0 ? 'color: var(--danger-color); font-weight:700;' : ''}">${diasLabel}</td>
        `;
        body.appendChild(tr);
    });
}

function formatCurrencyBRL(v) {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function fetchDashboard({ dateStr, profSeqId }) {
    const kpiAgendados = document.getElementById('kpiAgendados');
    const kpiAgendadosSub = document.getElementById('kpiAgendadosSub');
    const kpiRecebido = document.getElementById('kpiRecebido');
    const kpiRecebidoSub = document.getElementById('kpiRecebidoSub');
    const kpiOrcamentosHoje = document.getElementById('kpiOrcamentosHoje');
    const kpiOrcamentosHojeSub = document.getElementById('kpiOrcamentosHojeSub');
    const kpiPacientesHoje = document.getElementById('kpiPacientesHoje');
    const kpiPacientesHojeSub = document.getElementById('kpiPacientesHojeSub');
    const kpiCancelamentosHoje = document.getElementById('kpiCancelamentosHoje');
    const kpiComissoesAPagar = document.getElementById('kpiComissoesAPagar');
    const kpiTicketMedio = document.getElementById('kpiTicketMedio');

    const dashAgendaBody = document.getElementById('dashAgendaBody');
    const dashAgendaEmpty = document.getElementById('dashAgendaEmpty');
    const dashAgendaSummary = document.getElementById('dashAgendaSummary');
    const dashPaymentsBody = document.getElementById('dashPaymentsBody');
    const dashPaymentsEmpty = document.getElementById('dashPaymentsEmpty');
    const dashFinanceSummary = document.getElementById('dashFinanceSummary');

    try {
        const { startIso, endIso } = buildDayDateRangeUTC(dateStr);

        if (dashAgendaBody) {
            dashAgendaBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (dashPaymentsBody) {
            dashPaymentsBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (dashAgendaEmpty) dashAgendaEmpty.classList.add('hidden');
        if (dashPaymentsEmpty) dashPaymentsEmpty.classList.add('hidden');

        let agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .gte('inicio', startIso)
            .lte('inicio', endIso)
            .order('inicio', { ascending: true });
        if (profSeqId) agQ = agQ.eq('profissional_id', Number(profSeqId));
        const { data: ags, error: agErr } = await withTimeout(agQ, 15000, 'dashboard:agenda_agendamentos');
        if (agErr) throw agErr;
        const agendaRows = Array.isArray(ags) ? ags : [];

        const patientNameBySeqid = new Map();
        (patients || []).forEach(p => {
            const seq = Number(p && p.seqid);
            if (!Number.isFinite(seq)) return;
            const nm = String((p && (p.nome || p.pacientenome)) || '').trim();
            if (!nm) return;
            patientNameBySeqid.set(seq, nm);
        });
        try {
            const needed = Array.from(new Set(
                agendaRows
                    .map(a => Number(a && a.paciente_id))
                    .filter(n => Number.isFinite(n) && n > 0 && !patientNameBySeqid.has(n))
            ));
            if (needed.length) {
                let pQ = db.from('pacientes')
                    .select('seqid,nome')
                    .eq('empresa_id', currentEmpresaId)
                    .in('seqid', needed);
                const { data: ps, error: pErr } = await withTimeout(pQ, 15000, 'dashboard:pacientes_by_seqid');
                if (!pErr) {
                    (ps || []).forEach(pr => {
                        const seq = Number(pr && pr.seqid);
                        if (!Number.isFinite(seq)) return;
                        const nm = String((pr && pr.nome) || '').trim();
                        if (!nm) return;
                        patientNameBySeqid.set(seq, nm);
                    });
                }
            }
        } catch { }

        const statusCount = {};
        agendaRows.forEach(a => {
            const st = String(a.status || a.status_agendamento || '—');
            statusCount[st] = (statusCount[st] || 0) + 1;
        });
        if (kpiAgendados) kpiAgendados.textContent = String(agendaRows.length);
        if (kpiAgendadosSub) {
            const parts = Object.entries(statusCount).slice(0, 4).map(([k, v]) => `${k}: ${v}`);
            kpiAgendadosSub.textContent = parts.length ? parts.join(' | ') : '—';
        }

        if (dashAgendaBody) {
            dashAgendaBody.innerHTML = '';
            if (!agendaRows.length) {
                if (dashAgendaEmpty) dashAgendaEmpty.classList.remove('hidden');
                dashAgendaBody.innerHTML = '';
            } else {
                agendaRows.slice(0, 40).forEach(a => {
                    const tr = document.createElement('tr');
                    const inicio = a.inicio ? new Date(a.inicio) : null;
                    const hora = inicio ? formatTimeHHMM(inicio) : '—';
                    const pid = Number(a && a.paciente_id);
                    const pacNome = a.paciente_nome || a.paciente || a.pacientenome || (Number.isFinite(pid) ? (patientNameBySeqid.get(pid) || '') : '') || '—';
                    const profNome = a.profissional_nome || getProfessionalNameBySeqId(a.profissional_id) || '—';
                    const st = a.status || a.status_agendamento || '—';
                    tr.innerHTML = `
                        <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${hora}</td>
                        <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);"><strong>${pacNome}</strong></td>
                        <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${profNome}</td>
                        <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${st}</td>
                    `;
                    dashAgendaBody.appendChild(tr);
                });
            }
        }
        if (dashAgendaSummary) dashAgendaSummary.textContent = `${agendaRows.length} agendamentos`;

        let trQ = db.from('financeiro_transacoes')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .gte('data_transacao', startIso)
            .lte('data_transacao', endIso)
            .order('data_transacao', { ascending: false });
        const { data: trs, error: trErr } = await withTimeout(trQ, 15000, 'dashboard:financeiro_transacoes');
        if (trErr) throw trErr;
        const transRows = Array.isArray(trs) ? trs : [];
        const receivedRows = transRows.filter(t => String(t.categoria || '').toUpperCase() === 'PAGAMENTO' && String(t.tipo || '').toUpperCase() === 'CREDITO');
        const totalRecebido = receivedRows.reduce((acc, t) => acc + Number(t.valor || 0), 0);
        if (kpiRecebido) kpiRecebido.textContent = formatCurrencyBRL(totalRecebido);
        if (kpiRecebidoSub) kpiRecebidoSub.textContent = `${receivedRows.length} pagamentos`;

        const byForma = {};
        receivedRows.forEach(t => {
            const f = String(t.forma_pagamento || '—');
            if (!byForma[f]) byForma[f] = { total: 0, count: 0 };
            byForma[f].total += Number(t.valor || 0);
            byForma[f].count += 1;
        });
        if (dashPaymentsBody) {
            dashPaymentsBody.innerHTML = '';
            const entries = Object.entries(byForma).sort((a, b) => b[1].total - a[1].total);
            if (!entries.length) {
                if (dashPaymentsEmpty) dashPaymentsEmpty.classList.remove('hidden');
            } else {
                entries.forEach(([f, v]) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${f}</td>
                        <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:right;"><strong>${formatCurrencyBRL(v.total)}</strong></td>
                        <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:right;">${v.count}</td>
                    `;
                    dashPaymentsBody.appendChild(tr);
                });
            }
        }
        if (dashFinanceSummary) dashFinanceSummary.textContent = formatCurrencyBRL(totalRecebido);

        let oQ = db.from('orcamentos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('created_at', { ascending: false });
        const { data: os, error: oErr } = await withTimeout(oQ, 15000, 'dashboard:orcamentos');
        if (oErr) throw oErr;
        const orcRows = Array.isArray(os) ? os : [];
        const startMs = new Date(`${dateStr}T00:00:00`).getTime();
        const endMs = new Date(`${dateStr}T23:59:59`).getTime();
        const orcHoje = orcRows.filter(o => {
            const raw = o.created_at || o.criado_em || o.data_criacao;
            if (!raw) return false;
            const t = new Date(raw).getTime();
            return Number.isFinite(t) && t >= startMs && t <= endMs;
        });
        if (kpiOrcamentosHoje) kpiOrcamentosHoje.textContent = String(orcHoje.length);
        if (kpiOrcamentosHojeSub) kpiOrcamentosHojeSub.textContent = `Unidade: ${currentEmpresaId || '—'}`;

        let pQ = db.from('pacientes')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('created_at', { ascending: false });
        const { data: ps, error: pErr } = await withTimeout(pQ, 15000, 'dashboard:pacientes');
        if (pErr) throw pErr;
        const pacRows = Array.isArray(ps) ? ps : [];
        const pacHoje = pacRows.filter(p => {
            const raw = p.created_at || p.criado_em || p.data_criacao;
            if (!raw) return false;
            const t = new Date(raw).getTime();
            return Number.isFinite(t) && t >= startMs && t <= endMs;
        });
        if (kpiPacientesHoje) kpiPacientesHoje.textContent = String(pacHoje.length);
        if (kpiPacientesHojeSub) kpiPacientesHojeSub.textContent = `Total base: ${pacRows.length}`;

        let cQ = db.from('orcamento_cancelados')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('data_cancelamento', { ascending: false });
        const { data: cs, error: cErr } = await withTimeout(cQ, 15000, 'dashboard:orcamento_cancelados');
        if (cErr) throw cErr;
        const cancelRows = Array.isArray(cs) ? cs : [];
        const cancHoje = cancelRows.filter(r => {
            const raw = r.data_cancelamento || r.created_at;
            if (!raw) return false;
            const t = new Date(raw).getTime();
            return Number.isFinite(t) && t >= startMs && t <= endMs;
        });
        if (kpiCancelamentosHoje) kpiCancelamentosHoje.textContent = String(cancHoje.length);

        let comQ = db.from('financeiro_comissoes')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .in('status', ['PENDENTE', 'GERADA']);
        const { data: coms, error: comErr } = await withTimeout(comQ, 15000, 'dashboard:financeiro_comissoes');
        if (comErr) throw comErr;
        const comRows = Array.isArray(coms) ? coms : [];
        const comTotal = comRows.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);
        if (kpiComissoesAPagar) kpiComissoesAPagar.textContent = formatCurrencyBRL(comTotal);

        const ticket = receivedRows.length ? (totalRecebido / receivedRows.length) : 0;
        if (kpiTicketMedio) kpiTicketMedio.textContent = formatCurrencyBRL(ticket);
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao carregar Dashboard: ${msg}`, true);
    }
}

function initProteseModule() {
    const btnProteseRefresh = document.getElementById('btnProteseRefresh');
    const btnProteseNew = document.getElementById('btnProteseNew');
    const btnProteseLabs = document.getElementById('btnProteseLabs');
    const btnProtesePayables = document.getElementById('btnProtesePayables');
    const btnProteseReports = document.getElementById('btnProteseReports');
    const statusFilter = document.getElementById('proteseStatusFilter');
    const execFilter = document.getElementById('proteseExecucaoFilter');
    const overdueFilter = document.getElementById('proteseOverdueFilter');
    const searchInput = document.getElementById('proteseSearch');

    const modal = document.getElementById('modalProtese');
    const btnCloseModal = document.getElementById('btnCloseModalProtese');
    const btnCancel = document.getElementById('btnProteseCancel');
    const btnSave = document.getElementById('btnProteseSave');
    const btnPrint = document.getElementById('btnProtesePrint');
    const btnPrintSimple = document.getElementById('btnProtesePrintSimple');
    const btnCustodia = document.getElementById('btnProteseCustodia');
    const proteseQuickEventType = document.getElementById('proteseQuickEventType');
    const btnProteseQuickEventApply = document.getElementById('btnProteseQuickEventApply');
    const execSelect = document.getElementById('proteseTipoExecucao');
    const origemSelect = document.getElementById('proteseOrigemTrabalho');
    const materialSelect = document.getElementById('proteseMaterialTipo');
    const orcInput = document.getElementById('proteseOrcamentoSeqid');
    const orcItemSelect = document.getElementById('proteseOrcamentoItemId');
    const btnEventClose = document.getElementById('btnProteseEventClose');
    const btnEventTryIn = document.getElementById('btnProteseEventTryIn');
    const btnEventApprove = document.getElementById('btnProteseEventApprove');
    const btnEventReprove = document.getElementById('btnProteseEventReprove');
    const anexoFile = document.getElementById('proteseAnexoFile');
    const btnAnexoUpload = document.getElementById('btnProteseAnexoUpload');
    const anexosList = document.getElementById('proteseAnexosList');

    const modalReprov = document.getElementById('modalProteseReprovacao');
    const btnCloseReprov = document.getElementById('btnCloseModalProteseReprovacao');
    const btnCancelReprov = document.getElementById('btnCancelProteseReprovacao');
    const btnConfirmReprov = document.getElementById('btnConfirmProteseReprovacao');
    const reprovMotivo = document.getElementById('proteseReprovacaoMotivo');
    const reprovCusto = document.getElementById('proteseReprovacaoCusto');
    const reprovStatus = document.getElementById('proteseReprovacaoStatus');

    const labsModal = document.getElementById('modalProteseLabs');
    const btnLabsClose = document.getElementById('btnProteseLabsClose');
    const btnLabsClose2 = document.getElementById('btnCloseModalProteseLabs');
    const btnLabSave = document.getElementById('btnProteseLabSave');

    const payablesModal = document.getElementById('modalProtesePayables');
    const btnPayablesClose = document.getElementById('btnProtesePayablesClose');
    const btnPayablesClose2 = document.getElementById('btnCloseModalProtesePayables');
    const btnPayablesRefresh = document.getElementById('btnProtesePayablesRefresh');
    const btnPayablesPrint = document.getElementById('btnProtesePayablesPrint');
    const payStatusFilter = document.getElementById('protesePayablesStatusFilter');
    const payDestFilter = document.getElementById('protesePayablesDestFilter');
    const paySearch = document.getElementById('protesePayablesSearch');

    const payModal = document.getElementById('modalProtesePayablePay');
    const btnPayModalClose = document.getElementById('btnCloseModalProtesePayablePay');
    const btnPayModalCancel = document.getElementById('btnProtesePayablePayCancel');
    const btnPayModalConfirm = document.getElementById('btnProtesePayablePayConfirm');

    const custModal = document.getElementById('proteseCustodiaModal');
    const btnCustClose = document.getElementById('btnCloseProteseCustodiaModal');
    const btnCustClose2 = document.getElementById('btnCloseProteseCustodiaModal2');

    const canSelect = can('protese', 'select');
    const canInsert = can('protese', 'insert');
    if (btnProteseNew) btnProteseNew.disabled = !canInsert;
    if (btnProteseNew) btnProteseNew.style.opacity = canInsert ? '1' : '0.5';
    if (btnProteseLabs) btnProteseLabs.disabled = !canInsert;
    if (btnProteseLabs) btnProteseLabs.style.opacity = canInsert ? '1' : '0.5';
    if (btnProtesePayables) btnProtesePayables.disabled = !canSelect;
    if (btnProtesePayables) btnProtesePayables.style.opacity = canSelect ? '1' : '0.5';
    if (btnProteseRefresh) btnProteseRefresh.disabled = !canSelect;
    if (btnProteseReports) {
        btnProteseReports.disabled = !canSelect;
        btnProteseReports.style.opacity = canSelect ? '1' : '0.5';
    }

    if (window.__proteseDelegated) return;
    window.__proteseDelegated = true;

    if (btnProteseRefresh) btnProteseRefresh.addEventListener('click', () => fetchProteseFromUI());
    if (btnProteseNew) btnProteseNew.addEventListener('click', () => openProteseModal(null));
    if (btnProteseLabs) btnProteseLabs.addEventListener('click', () => openProteseLabsModal());
    if (btnProtesePayables) btnProtesePayables.addEventListener('click', () => openProtesePayablesModal());
    if (btnProteseReports) btnProteseReports.addEventListener('click', () => openProteseReportsModal());

    const refetch = () => fetchProteseFromUI();
    if (statusFilter) statusFilter.addEventListener('change', refetch);
    if (execFilter) execFilter.addEventListener('change', refetch);
    if (overdueFilter) overdueFilter.addEventListener('change', refetch);
    if (searchInput) searchInput.addEventListener('input', () => {
        clearTimeout(window.__proteseSearchDebounce);
        window.__proteseSearchDebounce = setTimeout(refetch, 250);
    });

    const closeProteseModal = () => {
        if (modal) modal.classList.add('hidden');
        currentProteseOrder = null;
    };
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeProteseModal);
    if (btnCancel) btnCancel.addEventListener('click', closeProteseModal);
    if (btnSave) btnSave.addEventListener('click', () => saveProteseOrder());
    const btnViewExisting = document.getElementById('btnProteseViewExisting');
    if (btnViewExisting) btnViewExisting.addEventListener('click', async () => {
        const opId = String(btnViewExisting.dataset.opId || '').trim();
        if (!opId) return;
        await openProteseById(opId);
    });
    if (btnPrint) btnPrint.addEventListener('click', () => printProteseOrder());
    if (btnPrintSimple) btnPrintSimple.addEventListener('click', () => printProteseOrderSimple());
    if (btnCustodia) btnCustodia.addEventListener('click', async () => {
        const selectedAction = proteseQuickEventType ? String(proteseQuickEventType.value || '') : '';
        if (!selectedAction) {
            showToast('Selecione Entrega (Envio) ou Recebimento.', true);
            return;
        }
        const mat = materialSelect ? String(materialSelect.value || '') : '';
        if (mat === 'DIGITAL') {
            showToast('Material DIGITAL: use upload de arquivo para o laboratório.', true);
            return;
        }
        if (!currentProteseOrder) {
            await saveProteseOrder();
        }
        if (!currentProteseOrder || !currentProteseOrder.id) {
            showToast('Salve a OP para usar Custódia.', true);
            return;
        }
        if (proteseQuickEventType) proteseQuickEventType.value = selectedAction;
        syncProteseEventButtons();
        const { fromClinic, executorName } = getExecLabels();
        const de = selectedAction === 'ENTREGA' ? fromClinic : executorName;
        const para = selectedAction === 'ENTREGA' ? executorName : fromClinic;
        openProteseCustodiaWithDefaults({
            acao: selectedAction,
            de,
            para,
            autoGenerate: true,
            context: { kind: 'TRANSPORTE' }
        });
    });
    if (proteseQuickEventType) proteseQuickEventType.addEventListener('change', () => syncProteseEventButtons());
    if (execSelect) execSelect.addEventListener('change', () => syncProteseExecucaoGroups());
    if (materialSelect) materialSelect.addEventListener('change', () => { syncProteseMaterialUi(); syncProteseEventButtons(); });
    const pacienteSelect = document.getElementById('protesePaciente');
    if (pacienteSelect) pacienteSelect.addEventListener('change', () => { syncProteseUniqueOpGuard(); });
    if (orcInput) orcInput.addEventListener('input', () => syncProteseOrcamentoItens());
    if (orcItemSelect) orcItemSelect.addEventListener('change', () => updateProteseItemInfo());
    if (btnEventClose) btnEventClose.addEventListener('click', async () => {
        try {
            if (!currentProteseOrder) {
                await saveProteseOrder();
            }
            if (!currentProteseOrder || !currentProteseOrder.id) {
                showToast('Salve a OP para encerrar.', true);
                return;
            }
            const st = document.getElementById('proteseStatusGeral');
            if (st) st.value = 'CONCLUIDA';
            await addProteseTimelineEvent({
                tipoEvento: 'ENCERRAMENTO',
                faseResultante: 'ENCERRADA',
                statusResultante: 'CONCLUIDA',
                deLocal: null,
                paraLocal: null,
                nota: getNota()
            });
            showToast('OP encerrada.');
        } catch (err) {
            const msg = err && err.message ? err.message : 'Erro desconhecido';
            showToast(`Falha ao registrar encerramento: ${msg}`, true);
        }
    });
    const getExecLabels = () => {
        const o = currentProteseOrder;
        const exec = String((document.getElementById('proteseTipoExecucao') || {}).value || (o ? o.tipo_execucao : '') || 'EXTERNA');
        const labId = String((document.getElementById('proteseLaboratorio') || {}).value || (o ? o.laboratorio_id : '') || '');
        const protId = String((document.getElementById('proteseProtetico') || {}).value || (o ? o.protetico_id : '') || '');
        const executor = exec === 'EXTERNA'
            ? ((proteseLabs || []).find(l => String(l.id) === labId)?.nome || 'Laboratório')
            : ((professionals || []).find(p => String(p.id) === protId)?.nome || 'Protético');
        return {
            exec,
            fromClinic: 'Clínica',
            executorName: executor
        };
    };
    const getNota = () => String((document.getElementById('proteseNota') || {}).value || '').trim();
    if (btnProteseQuickEventApply) btnProteseQuickEventApply.addEventListener('click', async () => {
        const kind = proteseQuickEventType ? String(proteseQuickEventType.value || '') : '';
        if (!kind) { showToast('Selecione Entrega ou Recebimento.', true); return; }
        const { fromClinic, executorName } = getExecLabels();
        const nota = getNota();
        try {
            btnProteseQuickEventApply.disabled = true;
            if (!currentProteseOrder) {
                await saveProteseOrder();
            }
            if (!currentProteseOrder || !currentProteseOrder.id) {
                showToast('Salve a OP para registrar eventos.', true);
                return;
            }
            if (kind === 'ENTREGA') {
                await addProteseTimelineEvent({
                    tipoEvento: 'ENVIO',
                    faseResultante: 'ENVIADA',
                    statusResultante: null,
                    deLocal: fromClinic,
                    paraLocal: executorName,
                    nota
                });
                showToast('Entrega registrada.');
            } else if (kind === 'RECEBIMENTO') {
                await addProteseTimelineEvent({
                    tipoEvento: 'RECEBIMENTO',
                    faseResultante: 'RECEBIDA',
                    statusResultante: null,
                    deLocal: executorName,
                    paraLocal: fromClinic,
                    nota
                });
                showToast('Recebimento registrado.');
            }
            if (proteseQuickEventType) proteseQuickEventType.value = '';
        } catch (err) {
            const msg = err && err.message ? err.message : 'Erro desconhecido';
            showToast(`Falha ao registrar: ${msg}`, true);
        } finally {
            btnProteseQuickEventApply.disabled = false;
            syncProteseEventButtons();
        }
    });
    if (btnEventTryIn) btnEventTryIn.addEventListener('click', async () => {
        try {
            if (!currentProteseOrder) {
                await saveProteseOrder();
            }
            if (!currentProteseOrder || !currentProteseOrder.id) {
                showToast('Salve a OP para registrar prova.', true);
                return;
            }
            await addProteseTimelineEvent({
                tipoEvento: 'PROVA_PACIENTE',
                faseResultante: 'PROVA_PACIENTE',
                statusResultante: null,
                deLocal: null,
                paraLocal: null,
                nota: getNota()
            });
        } catch (err) {
            const msg = err && err.message ? err.message : 'Erro desconhecido';
            showToast(`Falha ao registrar prova: ${msg}`, true);
        }
    });
    if (btnEventApprove) btnEventApprove.addEventListener('click', async () => {
        try {
            if (!currentProteseOrder) {
                await saveProteseOrder();
            }
            if (!currentProteseOrder || !currentProteseOrder.id) {
                showToast('Salve a OP para aprovar.', true);
                return;
            }
            const fase = String(currentProteseOrder.fase_atual || '').trim();
            if (fase !== 'PROVA_PACIENTE') {
                showToast('Aprovação disponível na fase PROVA_PACIENTE.', true);
                return;
            }
            const pac = (patients || []).find(p => String(p.id) === String(currentProteseOrder.paciente_id || ''));
            const pacNome = pac ? String(pac.nome || 'Paciente') : 'Paciente';
            window.__protesePendingApproval = {
                ordemId: String(currentProteseOrder.id),
                nota: getNota()
            };
            openProteseCustodiaWithDefaults({
                acao: 'ENTREGA',
                de: 'Clínica',
                para: pacNome,
                autoGenerate: true,
                context: { kind: 'VALIDACAO_PACIENTE' }
            });
            showToast('Gere o QR e peça para o paciente assinar. Depois clique em "Verificar assinatura".');
        } catch (err) {
            const msg = err && err.message ? err.message : 'Erro desconhecido';
            showToast(`Falha ao registrar aprovação: ${msg}`, true);
        }
    });
    if (btnEventReprove) btnEventReprove.addEventListener('click', async () => {
        if (!modalReprov) return;
        if (reprovMotivo) reprovMotivo.value = '';
        if (reprovCusto) reprovCusto.value = 'GARANTIA_LAB';
        if (reprovStatus) reprovStatus.textContent = '';
        if (btnConfirmReprov) btnConfirmReprov.disabled = false;
        if (btnCancelReprov) btnCancelReprov.disabled = false;
        if (btnCloseReprov) btnCloseReprov.disabled = false;
        modalReprov.classList.remove('hidden');
    });

    const closeReprovModal = () => {
        const pend = window.__protesePendingReprovacao;
        if (pend && currentProteseOrder && String(pend.ordemId || '') === String(currentProteseOrder.id || '')) {
            showToast('Aguardando assinatura do dentista na Custódia.', true);
            return;
        }
        if (modalReprov) modalReprov.classList.add('hidden');
    };
    if (btnCloseReprov) btnCloseReprov.addEventListener('click', closeReprovModal);
    if (btnCancelReprov) btnCancelReprov.addEventListener('click', closeReprovModal);
    if (btnConfirmReprov) btnConfirmReprov.addEventListener('click', async () => {
        const motivo = String(reprovMotivo && reprovMotivo.value || '').trim();
        if (!motivo) { showToast('Informe o motivo da reprovação.', true); return; }
        const custo = String(reprovCusto && reprovCusto.value || 'GARANTIA_LAB');
        try {
            if (!currentProteseOrder) {
                await saveProteseOrder();
            }
            if (!currentProteseOrder || !currentProteseOrder.id) {
                showToast('Salve a OP para reprovar.', true);
                return;
            }
            if (btnConfirmReprov) btnConfirmReprov.disabled = true;
            if (btnCancelReprov) btnCancelReprov.disabled = true;
            if (btnCloseReprov) btnCloseReprov.disabled = true;
            if (reprovMotivo) reprovMotivo.disabled = true;
            if (reprovCusto) reprovCusto.disabled = true;
            if (reprovStatus) reprovStatus.textContent = 'Gravando motivo...';

            await withTimeout(
                db.from('ordens_proteticas')
                    .update({
                        prova_motivo: motivo,
                        prova_custo_responsabilidade: custo,
                        prova_reprovada_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('empresa_id', currentEmpresaId)
                    .eq('id', currentProteseOrder.id),
                15000,
                'ordens_proteticas:update_prova_reprov'
            );

            await addProteseTimelineEvent({
                tipoEvento: 'REPROVADO',
                faseResultante: null,
                statusResultante: null,
                deLocal: 'Dentista',
                paraLocal: 'Paciente',
                nota: `Motivo: ${motivo} | Custo: ${custo}`
            });

            const de = 'Dentista';
            const para = 'Clínica/Expedição';
            await addProteseTimelineEvent({
                tipoEvento: 'CUSTODIA_PENDENTE',
                faseResultante: null,
                statusResultante: null,
                deLocal: de,
                paraLocal: para,
                nota: 'Gerando QR para assinatura do dentista (transferência de posse).'
            });
            window.__protesePendingReprovacao = {
                ordemId: String(currentProteseOrder.id),
                motivo,
                custo,
                startedAt: new Date().toISOString(),
                expectedAcao: 'ENTREGA',
                expectedDe: de,
                expectedPara: para
            };

            if (reprovStatus) reprovStatus.textContent = 'Aguardando assinatura do dentista na Custódia...';
            openProteseCustodiaWithDefaults({
                acao: 'ENTREGA',
                de,
                para,
                autoGenerate: true,
                context: { kind: 'REPROVACAO_POSSE_DENTISTA' }
            });
        } catch (err) {
            const msg = err && err.message ? err.message : 'Erro desconhecido';
            showToast(`Falha ao registrar reprovação: ${msg}`, true);
            if (btnConfirmReprov) btnConfirmReprov.disabled = false;
            if (btnCancelReprov) btnCancelReprov.disabled = false;
            if (btnCloseReprov) btnCloseReprov.disabled = false;
            if (reprovMotivo) reprovMotivo.disabled = false;
            if (reprovCusto) reprovCusto.disabled = false;
            if (reprovStatus) reprovStatus.textContent = '';
        }
    });

    const closeCustModal = () => {
        closeProteseCustodiaModal();
    };
    if (btnCustClose) btnCustClose.addEventListener('click', closeCustModal);
    if (btnCustClose2) btnCustClose2.addEventListener('click', closeCustModal);

    const closeLabsModal = () => {
        if (labsModal) labsModal.classList.add('hidden');
    };
    if (btnLabsClose) btnLabsClose.addEventListener('click', closeLabsModal);
    if (btnLabsClose2) btnLabsClose2.addEventListener('click', closeLabsModal);
    if (btnLabSave) btnLabSave.addEventListener('click', () => saveProteseLab());

    const closePayablesModal = () => {
        if (payablesModal) payablesModal.classList.add('hidden');
    };
    if (btnPayablesClose) btnPayablesClose.addEventListener('click', closePayablesModal);
    if (btnPayablesClose2) btnPayablesClose2.addEventListener('click', closePayablesModal);
    if (btnPayablesRefresh) btnPayablesRefresh.addEventListener('click', () => fetchProtesePayablesFromUI());
    if (btnPayablesPrint) btnPayablesPrint.addEventListener('click', () => printProtesePayablesReport());
    const refetchPay = () => fetchProtesePayablesFromUI();
    if (payStatusFilter) payStatusFilter.addEventListener('change', refetchPay);
    if (payDestFilter) payDestFilter.addEventListener('change', refetchPay);
    if (paySearch) paySearch.addEventListener('input', () => {
        clearTimeout(window.__protesePaySearchDebounce);
        window.__protesePaySearchDebounce = setTimeout(refetchPay, 250);
    });

    const closePayModal = () => {
        if (payModal) payModal.classList.add('hidden');
        currentProtesePayable = null;
    };
    if (btnPayModalClose) btnPayModalClose.addEventListener('click', closePayModal);
    if (btnPayModalCancel) btnPayModalCancel.addEventListener('click', closePayModal);
    if (btnPayModalConfirm) btnPayModalConfirm.addEventListener('click', () => confirmProtesePayablePayment());

    if (btnAnexoUpload) btnAnexoUpload.addEventListener('click', () => uploadProteseAnexo({ fileInput: anexoFile, listEl: anexosList }));
}

async function fetchProteseFromUI() {
    const tbody = document.getElementById('proteseTableBody');
    const empty = document.getElementById('proteseEmptyState');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
    if (empty) empty.classList.add('hidden');

    const statusVal = (document.getElementById('proteseStatusFilter') || {}).value || '';
    const execVal = (document.getElementById('proteseExecucaoFilter') || {}).value || '';
    const overdueVal = (document.getElementById('proteseOverdueFilter') || {}).value || '';
    const q = (document.getElementById('proteseSearch') || {}).value || '';

    await fetchProteseData({ statusVal, execVal, overdueVal, q });
}

async function fetchProteseData({ statusVal, execVal, overdueVal, q }) {
    try {
        const labsQ = db.from('laboratorios_proteticos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('seqid', { ascending: true });
        const { data: labs, error: labsErr } = await withTimeout(labsQ, 15000, 'laboratorios_proteticos');
        if (labsErr) throw labsErr;
        proteseLabs = Array.isArray(labs) ? labs : [];

        let ordQ = db.from('ordens_proteticas')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('seqid', { ascending: false });
        if (statusVal) ordQ = ordQ.eq('status_geral', statusVal);
        if (execVal) ordQ = ordQ.eq('tipo_execucao', execVal);
        const { data: ords, error: ordErr } = await withTimeout(ordQ, 15000, 'ordens_proteticas');
        if (ordErr) throw ordErr;
        proteseOrders = Array.isArray(ords) ? ords : [];

        const today = new Date();
        const todayMs = new Date(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`).getTime();
        const overdueOnly = overdueVal === '1';
        const ontimeOnly = overdueVal === '0';
        const queryText = String(q || '').trim().toLowerCase();

        const patientById = new Map((patients || []).map(p => [String(p.id), p]));
        const budgetById = new Map((budgets || []).map(b => [String(b.id), b]));
        const labById = new Map((proteseLabs || []).map(l => [String(l.id), l]));
        const profById = new Map((professionals || []).map(p => [String(p.id), p]));

        let rows = proteseOrders.slice();
        rows = rows.filter(o => {
            const prazo = o.prazo_previsto ? new Date(String(o.prazo_previsto) + 'T00:00:00').getTime() : null;
            const isDone = String(o.status_geral || '') === 'CONCLUIDA' || String(o.status_geral || '') === 'CANCELADA';
            const isOverdue = !isDone && prazo != null && Number.isFinite(prazo) && prazo < todayMs;
            if (overdueOnly && !isOverdue) return false;
            if (ontimeOnly && isOverdue) return false;
            if (!queryText) return true;

            const pac = patientById.get(String(o.paciente_id || ''));
            const pacNome = pac ? String(pac.nome || '') : '';
            const b = budgetById.get(String(o.orcamento_id || ''));
            const orcSeq = b ? String(b.seqid || '') : '';
            const opSeq = String(o.seqid || '');
            const lab = labById.get(String(o.laboratorio_id || ''));
            const labNome = lab ? String(lab.nome || '') : '';
            const prot = profById.get(String(o.protetico_id || ''));
            const protNome = prot ? String(prot.nome || '') : '';

            const haystack = `${pacNome} ${orcSeq} ${opSeq} ${labNome} ${protNome}`.toLowerCase();
            return haystack.includes(queryText);
        });

        renderProteseTable({ rows, patientById, budgetById, labById, profById });
    } catch (err) {
        console.error('Erro ao carregar produção protética:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao carregar Produção Protética: ${msg}`, true);
        const tbody = document.getElementById('proteseTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--danger-color);">Falha ao carregar. Verifique RLS/policies.</td></tr>';
    }
}

function renderProteseTable({ rows, patientById, budgetById, labById, profById }) {
    const tbody = document.getElementById('proteseTableBody');
    const empty = document.getElementById('proteseEmptyState');
    const kTotal = document.getElementById('proteseKpiTotal');
    const kOverdue = document.getElementById('proteseKpiOverdue');
    const kExt = document.getElementById('proteseKpiExterna');
    const kInt = document.getElementById('proteseKpiInterna');

    const today = new Date();
    const todayMs = new Date(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`).getTime();

    const total = rows.length;
    const overdue = rows.filter(o => {
        const prazo = o.prazo_previsto ? new Date(String(o.prazo_previsto) + 'T00:00:00').getTime() : null;
        const isDone = String(o.status_geral || '') === 'CONCLUIDA' || String(o.status_geral || '') === 'CANCELADA';
        return !isDone && prazo != null && Number.isFinite(prazo) && prazo < todayMs;
    }).length;
    const ext = rows.filter(o => String(o.tipo_execucao || '') === 'EXTERNA').length;
    const intr = rows.filter(o => String(o.tipo_execucao || '') === 'INTERNA').length;

    if (kTotal) kTotal.textContent = String(total);
    if (kOverdue) kOverdue.textContent = String(overdue);
    if (kExt) kExt.textContent = String(ext);
    if (kInt) kInt.textContent = String(intr);

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    rows.forEach(o => {
        const tr = document.createElement('tr');
        const pac = patientById.get(String(o.paciente_id || ''));
        const pacNome = pac ? String(pac.nome || '') : '—';
        const b = budgetById.get(String(o.orcamento_id || ''));
        const orcSeq = b ? String(b.seqid || '') : '—';
        const exec = String(o.tipo_execucao || '—');
        const executor = exec === 'EXTERNA'
            ? (labById.get(String(o.laboratorio_id || ''))?.nome || '—')
            : (profById.get(String(o.protetico_id || ''))?.nome || '—');
        const fase = String(o.fase_atual || '—');
        const prazo = o.prazo_previsto ? String(o.prazo_previsto) : '—';
        const st = String(o.status_geral || '—');
        const canEdit = can('protese', 'update');
        const canDeleteCandidate = canEdit && String(o.fase_atual || '') === 'CRIADA' && ['EM_ANDAMENTO', 'PAUSADA'].includes(String(o.status_geral || ''));
        tr.innerHTML = `
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);"><strong>#${o.seqid}</strong></td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${pacNome}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${orcSeq}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${exec}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${executor}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${fase}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${prazo}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${st}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:center;">
                <button class="btn-icon" onclick="openProteseOrder('${o.id}')" title="Abrir">
                    <i class="ri-eye-line"></i>
                </button>
                <button class="btn-icon" onclick="openProteseOrder('${o.id}')" title="Editar" ${canEdit ? '' : 'disabled style="opacity:.4; cursor:not-allowed;"'}>
                    <i class="ri-edit-line"></i>
                </button>
                <button class="btn-icon" onclick="deleteProteseOrder('${o.id}')" title="Excluir" ${canDeleteCandidate ? '' : 'disabled style="opacity:.4; cursor:not-allowed;"'}>
                    <i class="ri-delete-bin-line"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteProteseOrder = async function (ordemId) {
    if (!can('protese', 'update')) {
        showToast('Você não tem permissão para excluir OP.', true);
        return;
    }
    const o = (proteseOrders || []).find(x => String(x.id) === String(ordemId));
    if (!o) {
        showToast('OP não encontrada. Atualize a lista.', true);
        return;
    }
    if (String(o.fase_atual || '') !== 'CRIADA' || !['EM_ANDAMENTO', 'PAUSADA'].includes(String(o.status_geral || ''))) {
        showToast('Só é possível excluir OP sem fluxo (fase CRIADA e status em andamento/pausada).', true);
        return;
    }
    const ok = confirm(`Excluir a OP #${o.seqid}? Esta ação não pode ser desfeita.`);
    if (!ok) return;

    try {
        const { data, error } = await withTimeout(
            db.rpc('rpc_delete_ordem_protetica', { p_empresa_id: currentEmpresaId, p_ordem_id: o.id }),
            15000,
            'rpc_delete_ordem_protetica'
        );
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row || row.ok !== true) {
            showToast((row && row.message) ? String(row.message) : 'Não foi possível excluir a OP.', true);
            return;
        }

        proteseOrders = (proteseOrders || []).filter(x => String(x.id) !== String(o.id));
        showToast(String(row.message || 'OP excluída com sucesso!'));
        fetchProteseFromUI();
    } catch (err) {
        console.error('Erro ao excluir OP:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao excluir OP: ${msg}`, true);
    }
};

window.openProteseOrder = function (ordemId) {
    const o = (proteseOrders || []).find(x => String(x.id) === String(ordemId));
    if (!o) {
        showToast('OP não encontrada. Atualize a lista.', true);
        return;
    }
    openProteseModal(o);
};

function openProteseModal(order) {
    const modal = document.getElementById('modalProtese');
    if (!modal) return;

    currentProteseOrder = order || null;

    const pacienteSel = document.getElementById('protesePaciente');
    const labSel = document.getElementById('proteseLaboratorio');
    const protSel = document.getElementById('proteseProtetico');

    if (pacienteSel && pacienteSel.options.length === 0) {
        const opts = ['<option value="">Selecione...</option>'];
        (patients || [])
            .slice()
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => opts.push(`<option value="${p.id}">${p.nome}</option>`));
        pacienteSel.innerHTML = opts.join('');
    }

    if (labSel) {
        const opts = ['<option value="">Selecione...</option>'];
        (proteseLabs || []).filter(l => l.ativo !== false).forEach(l => opts.push(`<option value="${l.id}">#${l.seqid} - ${l.nome}</option>`));
        labSel.innerHTML = opts.join('');
    }

    if (protSel) {
        const opts = ['<option value="">Selecione...</option>'];
        (professionals || [])
            .filter(p => normalizeRole(p.tipo) === 'protetico' || String(p.tipo || '').toLowerCase().includes('prot'))
            .forEach(p => opts.push(`<option value="${p.id}">${p.nome}</option>`));
        protSel.innerHTML = opts.join('');
    }

    const orcSeqInput = document.getElementById('proteseOrcamentoSeqid');
    const orcItemSel = document.getElementById('proteseOrcamentoItemId');
    const execSel = document.getElementById('proteseTipoExecucao');
    const origemSel = document.getElementById('proteseOrigemTrabalho');
    const materialSel = document.getElementById('proteseMaterialTipo');
    const statusSel = document.getElementById('proteseStatusGeral');
    const prazoInput = document.getElementById('protesePrazo');
    const priSel = document.getElementById('protesePrioridade');
    const obs = document.getElementById('proteseObservacoes');

    if (!order) {
        if (pacienteSel) pacienteSel.value = '';
        if (orcSeqInput) orcSeqInput.value = '';
        if (orcItemSel) orcItemSel.value = '';
        if (execSel) execSel.value = 'EXTERNA';
        if (origemSel) origemSel.value = 'MOLDAGEM_CLINICA';
        if (materialSel) materialSel.value = 'FISICO';
        if (statusSel) statusSel.value = 'EM_ANDAMENTO';
        if (labSel) labSel.value = '';
        if (protSel) protSel.value = '';
        if (prazoInput) prazoInput.value = '';
        if (priSel) priSel.value = 'NORMAL';
        if (obs) obs.value = '';
    } else {
        if (pacienteSel) pacienteSel.value = String(order.paciente_id || '');
        if (execSel) execSel.value = String(order.tipo_execucao || 'EXTERNA');
        if (origemSel) origemSel.value = String(order.origem_trabalho || 'MOLDAGEM_CLINICA');
        if (materialSel) materialSel.value = String(order.material_tipo || 'FISICO');
        if (statusSel) statusSel.value = String(order.status_geral || 'EM_ANDAMENTO');
        if (labSel) labSel.value = String(order.laboratorio_id || '');
        if (protSel) protSel.value = String(order.protetico_id || '');
        if (prazoInput) prazoInput.value = order.prazo_previsto ? String(order.prazo_previsto) : '';
        if (priSel) priSel.value = String(order.prioridade || 'NORMAL');
        if (obs) obs.value = String(order.observacoes || '');
        const bud = (budgets || []).find(b => String(b.id) === String(order.orcamento_id || ''));
        if (orcSeqInput) orcSeqInput.value = bud && bud.seqid ? String(bud.seqid) : '';
        if (orcItemSel) orcItemSel.value = String(order.orcamento_item_id || '');
    }

    syncProteseOrcamentoItens();
    syncProteseExecucaoGroups();
    const btnPrint = document.getElementById('btnProtesePrint');
    if (btnPrint) btnPrint.disabled = !currentProteseOrder;
    const btnPrintSimple = document.getElementById('btnProtesePrintSimple');
    if (btnPrintSimple) btnPrintSimple.disabled = !currentProteseOrder;
    const timeline = document.getElementById('proteseTimeline');
    if (timeline) {
        if (currentProteseOrder && currentProteseOrder.id) {
            loadProteseTimeline(String(currentProteseOrder.id));
        } else {
            timeline.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Salve a OP para iniciar o histórico.</div>';
        }
    }
    const anexos = document.getElementById('proteseAnexosList');
    if (anexos) {
        if (currentProteseOrder && currentProteseOrder.id) {
            loadProteseAnexos(String(currentProteseOrder.id));
        } else {
            anexos.innerHTML = '<div style="color: var(--text-muted);">Salve a OP para enviar anexos.</div>';
        }
    }
    syncProteseMaterialUi();
    syncProteseEventButtons();
    modal.classList.remove('hidden');
    if (currentProteseOrder && currentProteseOrder.id) {
        (async () => {
            await ensureProteseRecebidoClinicaFromCustodia();
            syncProteseEventButtons();
        })();
    }
}

function openProteseReportsModal() {
    const modal = document.getElementById('proteseReportsModal');
    const body = document.getElementById('proteseReportsBody');
    const btnClose = document.getElementById('btnCloseProteseReportsModal');
    const btnClose2 = document.getElementById('btnCloseProteseReportsModal2');
    const btnPrint = document.getElementById('btnProteseReportsPrint');
    if (!modal || !body) return;

    const orders = Array.isArray(proteseOrders) ? proteseOrders : [];
    const budgetById = new Map((budgets || []).map(b => [String(b.id), b]));
    const byStatus = {};
    const byPhase = {};
    let totalProt = 0;
    orders.forEach(o => {
        const st = String(o.status_geral || '—');
        const ph = String(o.fase_atual || '—');
        byStatus[st] = (byStatus[st] || 0) + 1;
        byPhase[ph] = (byPhase[ph] || 0) + 1;
        const rawDirect = Number(o.valor_protetico || 0);
        if (rawDirect) {
            totalProt += rawDirect;
        } else {
            const b = budgetById.get(String(o.orcamento_id || ''));
            const itens = b ? (b.orcamento_itens || []) : [];
            const it = (o.orcamento_item_id ? itens.find(x => String(x.id) === String(o.orcamento_item_id)) : null);
            totalProt += Number((it && (it.valor_protetico || it.valorProtetico)) || 0);
        }
    });

    const toRows = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td style="text-align:right;">${v}</td></tr>`).join('');
    const html = `
      <div class="card" style="padding: 12px; margin-bottom: 12px;">
        <div style="display:flex; gap: 12px; flex-wrap: wrap;">
          <div style="flex:1; min-width: 260px;">
            <div style="font-weight: 900; margin-bottom: 6px;">Por Status</div>
            <table class="main-table">
              <thead><tr><th>Status</th><th style="text-align:right;">Qtd</th></tr></thead>
              <tbody>${toRows(byStatus)}</tbody>
            </table>
          </div>
          <div style="flex:1; min-width: 260px;">
            <div style="font-weight: 900; margin-bottom: 6px;">Por Fase</div>
            <table class="main-table">
              <thead><tr><th>Fase</th><th style="text-align:right;">Qtd</th></tr></thead>
              <tbody>${toRows(byPhase)}</tbody>
            </table>
          </div>
          <div style="flex:1; min-width: 220px;">
            <div style="font-weight: 900; margin-bottom: 6px;">KPIs</div>
            <div>Total OPs: <strong>${orders.length}</strong></div>
            <div style="margin-top: 6px;">Total Protético: <strong>${formatCurrencyBRL(totalProt)}</strong></div>
          </div>
        </div>
      </div>
    `;
    body.innerHTML = html;

    const close = () => { modal.classList.add('hidden'); };
    if (!modal.dataset.bound) {
        if (btnClose) btnClose.addEventListener('click', close);
        if (btnClose2) btnClose2.addEventListener('click', close);
        if (btnPrint) btnPrint.addEventListener('click', () => {
            const w = window.open('', '_blank', 'width=900,height=700');
            if (!w) return;
            w.document.write(`<html><head><meta charset="utf-8"><title>Relatórios OP</title>
                <link rel="stylesheet" href="styles.css?v=${encodeURIComponent(APP_BUILD)}">
                </head><body>${body.innerHTML}</body></html>`);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 300);
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.dataset.bound = '1';
    }
    modal.classList.remove('hidden');
}

function syncProteseEventButtons() {
    const quickSel = document.getElementById('proteseQuickEventType');
    const btnQuick = document.getElementById('btnProteseQuickEventApply');
    const btnCustodia = document.getElementById('btnProteseCustodia');
    const btnTryIn = document.getElementById('btnProteseEventTryIn');
    const btnApprove = document.getElementById('btnProteseEventApprove');
    const btnReprove = document.getElementById('btnProteseEventReprove');
    const btnClose = document.getElementById('btnProteseEventClose');
    const materialSel = document.getElementById('proteseMaterialTipo');

    const canWrite = can('protese', 'insert') || can('protese', 'update');
    const fase = String((currentProteseOrder && currentProteseOrder.fase_atual) || '').trim();
    const st = String((currentProteseOrder && currentProteseOrder.status_geral) || (document.getElementById('proteseStatusGeral') || {}).value || '').trim();
    const isDone = fase === 'ENCERRADA' || st === 'CANCELADA';
    const materialTipo = String((materialSel && materialSel.value) || (currentProteseOrder && currentProteseOrder.material_tipo) || 'FISICO');
    const isSaved = !!(currentProteseOrder && currentProteseOrder.id);

    const setBtn = (btn, enabled) => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.55';
    };

    const enabled = canWrite && !isDone;
    const received = fase === 'RECEBIDO_CLINICA' || fase === 'RECEBIDA' || fase === 'PROVA_PACIENTE' || !!(currentProteseOrder && currentProteseOrder.__custodia_received);
    const inTryIn = fase === 'PROVA_PACIENTE';
    const isDelivered = fase === 'ENTREGUE';
    const inDecision = inTryIn || isDelivered;

    setBtn(btnQuick, enabled);
    setBtn(btnTryIn, enabled && received && !inDecision);
    setBtn(btnApprove, enabled && inTryIn);
    setBtn(btnReprove, enabled && inDecision);
    setBtn(btnClose, enabled);
    if (quickSel) {
        quickSel.disabled = !enabled;
        quickSel.style.opacity = enabled ? '1' : '0.55';
    }
    if (btnCustodia) {
        const hasChoice = quickSel ? Boolean(String(quickSel.value || '')) : false;
        const canCustody = enabled && hasChoice && materialTipo !== 'DIGITAL';
        btnCustodia.disabled = !canCustody;
        btnCustodia.style.opacity = canCustody ? '1' : '0.55';
    }
}

function syncProteseMaterialUi() {
    const materialSel = document.getElementById('proteseMaterialTipo');
    const btnCustodia = document.getElementById('btnProteseCustodia');
    const mat = String((materialSel && materialSel.value) || (currentProteseOrder && currentProteseOrder.material_tipo) || 'FISICO');
    if (btnCustodia) {
        btnCustodia.title = mat === 'DIGITAL' ? 'Material DIGITAL: use upload de arquivo' : 'Custódia do Produto (QR)';
    }
}

function openProteseCustodiaWithDefaults({ acao, de, para, autoGenerate, context } = {}) {
    if (!currentProteseOrder || !currentProteseOrder.id) {
        showToast('Salve a OP para usar Custódia.', true);
        return;
    }
    if (context && typeof context === 'object') {
        window.__proteseCustodiaContext = {
            ...context,
            ordemId: String(currentProteseOrder.id),
            expectedAcao: String(acao || ''),
            expectedDe: String(de || ''),
            expectedPara: String(para || ''),
        };
    } else {
        window.__proteseCustodiaContext = null;
    }
    try {
        const quickSel = document.getElementById('proteseQuickEventType');
        if (quickSel && acao) quickSel.value = String(acao);
    } catch { }
    openProteseCustodiaModal();
    setTimeout(() => {
        const custModal = document.getElementById('proteseCustodiaModal');
        const reprovModal = document.getElementById('modalProteseReprovacao');
        if (custModal) custModal.style.zIndex = '21000';
        if (reprovModal) reprovModal.style.zIndex = '20000';

        const acaoEl = document.getElementById('custAcao');
        const deEl = document.getElementById('custDe');
        const paraEl = document.getElementById('custPara');
        if (acaoEl && acao) {
            acaoEl.value = String(acao);
            try { acaoEl.dispatchEvent(new Event('change', { bubbles: true })); } catch { }
        }
        if (deEl && de) deEl.value = String(de);
        if (paraEl && para) paraEl.value = String(para);
        if (autoGenerate) {
            const baseEl = document.getElementById('custBaseUrl');
            const base = String(baseEl && baseEl.value || '').trim();
            const btnGerar = document.getElementById('btnCustGerar');
            if (!base) {
                try { if (baseEl) baseEl.focus(); } catch { }
            } else if (btnGerar && !btnGerar.disabled) {
                btnGerar.click();
            }
        }
    }, 50);
}

async function loadProteseAnexos(ordemId) {
    const list = document.getElementById('proteseAnexosList');
    if (!list) return;
    if (!ordemId) {
        list.innerHTML = '<div style="color: var(--text-muted);">Salve a OP para enviar anexos.</div>';
        return;
    }
    try {
        const q = db.from('ordens_proteticas_anexos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('ordem_id', ordemId)
            .order('created_at', { ascending: false })
            .limit(50);
        const { data, error } = await withTimeout(q, 15000, 'ordens_proteticas_anexos:select');
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        if (!rows.length) {
            list.innerHTML = '<div style="color: var(--text-muted);">Nenhum anexo.</div>';
            return;
        }
        list.innerHTML = rows.map(r => {
            const nome = escapeHtml(String(r.nome_arquivo || 'arquivo'));
            const mime = escapeHtml(String(r.mime_type || ''));
            const url = String(r.conteudo_base64 || '');
            const dt = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '';
            const dtTxt = dt ? `<div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(dt)}</div>` : '';
            const mimeTxt = mime ? `<div style="font-size: 12px; color: var(--text-muted);">${mime}</div>` : '';
            const href = url ? `href="${escapeHtml(url)}"` : '';
            return `
                <div class="card" style="padding: 10px; margin-bottom: 8px; display:flex; justify-content: space-between; gap: 12px; align-items:center;">
                    <div style="min-width:0;">
                        <div style="font-weight: 800; overflow:hidden; text-overflow: ellipsis; white-space: nowrap;">${nome}</div>
                        ${mimeTxt}
                        ${dtTxt}
                    </div>
                    <div style="display:flex; gap: 8px;">
                        <a class="btn btn-secondary" ${href} ${url ? `download="${nome}"` : ''} style="text-decoration:none;">
                            <i class="ri-download-2-line"></i> Baixar
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        list.innerHTML = `<div style="color: var(--danger-color);">Erro ao carregar anexos: ${escapeHtml(msg)}</div>`;
    }
}

async function uploadProteseAnexo({ fileInput, listEl }) {
    const o = currentProteseOrder;
    if (!o || !o.id) { showToast('Salve a OP antes de enviar anexos.', true); return; }
    const input = fileInput || document.getElementById('proteseAnexoFile');
    const file = input && input.files ? input.files[0] : null;
    if (!file) { showToast('Selecione um arquivo.', true); return; }
    const readAsDataUrl = f => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('Falha ao ler arquivo.'));
        r.readAsDataURL(f);
    });
    try {
        if (listEl) listEl.innerHTML = '<div style="color: var(--text-muted);">Enviando...</div>';
        const dataUrl = await readAsDataUrl(file);
        const payload = {
            empresa_id: currentEmpresaId,
            ordem_id: o.id,
            tipo: 'ARQUIVO',
            nome_arquivo: file.name,
            mime_type: file.type || '',
            conteudo_base64: dataUrl,
            created_by: currentUser && currentUser.id ? currentUser.id : null
        };
        const { error } = await withTimeout(
            db.from('ordens_proteticas_anexos').insert(payload),
            15000,
            'ordens_proteticas_anexos:insert'
        );
        if (error) throw error;
        if (input) input.value = '';
        await loadProteseAnexos(String(o.id));
        showToast('Arquivo enviado.');
        const mat = String((document.getElementById('proteseMaterialTipo') || {}).value || (o.material_tipo || 'FISICO'));
        if (mat === 'DIGITAL') {
            await addProteseTimelineEvent({
                tipoEvento: 'UPLOAD',
                faseResultante: 'ENVIADO_LAB',
                statusResultante: null,
                deLocal: 'Clínica',
                paraLocal: null,
                nota: `Upload enviado ao laboratório: ${file.name}`
            });
        }
    } catch (err) {
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao enviar anexo: ${msg}`, true);
        if (listEl) await loadProteseAnexos(String(o.id));
    }
}

async function ensureProteseRecebidoClinicaFromCustodia() {
    const o = currentProteseOrder;
    if (!o || !o.id) return;
    const fase = String(o.fase_atual || '').trim();
    if (fase === 'RECEBIDO_CLINICA' || fase === 'RECEBIDA' || fase === 'PROVA_PACIENTE') return;
    try {
        const q = db.from('ordens_proteticas_custodia_eventos')
            .select('id,acao,confirmed_at')
            .eq('ordem_id', o.id)
            .eq('acao', 'RECEBIMENTO')
            .not('confirmed_at', 'is', null)
            .order('confirmed_at', { ascending: false })
            .limit(1);
        const { data, error } = await withTimeout(q, 15000, 'custodia_eventos:recebimento');
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : null;
        if (!row) return;
        o.__custodia_received = true;
        const { error: uErr } = await withTimeout(
            db.from('ordens_proteticas')
                .update({ fase_atual: 'RECEBIDO_CLINICA', updated_at: new Date().toISOString() })
                .eq('empresa_id', currentEmpresaId)
                .eq('id', o.id),
            15000,
            'ordens_proteticas:update_fase_pos_custodia'
        );
        if (uErr) throw uErr;
        o.fase_atual = 'RECEBIDO_CLINICA';
        const inList = (proteseOrders || []).find(x => String(x.id) === String(o.id));
        if (inList) inList.fase_atual = 'RECEBIDO_CLINICA';
    } catch { }
}

function syncProteseExecucaoGroups() {
    const execSel = document.getElementById('proteseTipoExecucao');
    const labGroup = document.getElementById('proteseLabGroup');
    const protGroup = document.getElementById('proteseProteticoGroup');
    const v = execSel ? String(execSel.value || 'EXTERNA') : 'EXTERNA';
    if (labGroup) labGroup.style.display = v === 'EXTERNA' ? 'block' : 'none';
    if (protGroup) protGroup.style.display = v === 'INTERNA' ? 'block' : 'none';
}

let __proteseOrcFetchToken = 0;
let __proteseOrcDebounceTimer = null;
async function syncProteseOrcamentoItens() {
    const orcSeqRaw = String((document.getElementById('proteseOrcamentoSeqid') || {}).value || '').trim();
    const orcItemSel = document.getElementById('proteseOrcamentoItemId');
    if (!orcItemSel) return;

    const normId = (v) => String(v == null ? '' : v).trim();

    const prev = String(orcItemSel.value || '');
    const orcSeq = orcSeqRaw ? Number(orcSeqRaw) : null;
    const token = ++__proteseOrcFetchToken;

    if (__proteseOrcDebounceTimer) clearTimeout(__proteseOrcDebounceTimer);
    await new Promise(resolve => {
        __proteseOrcDebounceTimer = setTimeout(resolve, 250);
    });
    if (token !== __proteseOrcFetchToken) return;

    let b = (orcSeq && Number.isFinite(orcSeq)) ? (budgets || []).find(x => Number(x.seqid) === Number(orcSeq)) : null;
    if (!b && orcSeq && Number.isFinite(orcSeq) && currentEmpresaId) {
        try {
            const q = db.from('orcamentos')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('seqid', orcSeq)
                .limit(1);
            const { data, error } = await withTimeout(q, 15000, 'protese:orcamentos:by_seqid');
            if (error) throw error;
            if (token !== __proteseOrcFetchToken) return;
            const row = Array.isArray(data) ? data[0] : null;
            if (row) {
                try {
                    let itQ = db.from('orcamento_itens')
                        .select('*')
                        .eq('empresa_id', currentEmpresaId)
                        .eq('orcamento_id', row.id);
                    const { data: itData, error: itErr } = await withTimeout(itQ, 15000, 'protese:orcamento_itens:by_orc_id');
                    if (!itErr) row.orcamento_itens = Array.isArray(itData) ? itData : [];
                } catch { }

                budgets = Array.isArray(budgets) ? budgets : [];
                const exists = budgets.some(x => String(x.id) === String(row.id));
                if (!exists) budgets.push(row);
                b = row;
            }
        } catch (err) {
            const code = err && err.code ? String(err.code) : '';
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            const details = err && err.details ? String(err.details) : '';
            const hint = err && err.hint ? String(err.hint) : '';
            const full = [msg, details, hint].filter(Boolean).join(' ');
            showToast(code ? `Falha ao buscar orçamento (${code}): ${full}` : `Falha ao buscar orçamento: ${full}`, true);
        }
    }
    const itens = b ? (b.orcamento_itens || []) : [];

    const pacienteSel = document.getElementById('protesePaciente');
    if (pacienteSel) {
        const raw = b ? (b.pacienteid || b.paciente_id) : null;
        let budgetPatientUuid = '';
        let budgetPatientName = b && b.pacientenome ? String(b.pacientenome) : '';

        if (raw != null && String(raw).trim() !== '') {
            const s = String(raw).trim();
            if (!/^\d+$/.test(s)) {
                budgetPatientUuid = s;
            } else {
                const seq = Number(s);
                if (Number.isFinite(seq)) {
                    const pLocal = (patients || []).find(pp => Number(pp.seqid) === seq);
                    if (pLocal && pLocal.id) {
                        budgetPatientUuid = String(pLocal.id);
                        budgetPatientName = budgetPatientName || String(pLocal.nome || '');
                    } else if (currentEmpresaId) {
                        try {
                            let pq = db.from('pacientes').select('id,nome').eq('empresa_id', currentEmpresaId).eq('seqid', seq).limit(1);
                            const { data: pData, error: pErr } = await withTimeout(pq, 15000, 'protese:pacientes:by_seqid');
                            if (pErr) throw pErr;
                            if (token !== __proteseOrcFetchToken) return;
                            const pRow = Array.isArray(pData) ? pData[0] : null;
                            if (pRow && pRow.id) {
                                budgetPatientUuid = String(pRow.id);
                                budgetPatientName = budgetPatientName || String(pRow.nome || '');
                                patients = Array.isArray(patients) ? patients : [];
                                const exists = patients.some(x => String(x.id) === String(pRow.id));
                                if (!exists) patients.push({ id: pRow.id, nome: pRow.nome, seqid: seq });
                            }
                        } catch { }
                    }
                }
            }
        }

        if (budgetPatientUuid) {
            const hasOpt = Array.from(pacienteSel.options).some(o => String(o.value) === budgetPatientUuid);
            if (!hasOpt) {
                const label = budgetPatientName || 'Paciente';
                const opt = document.createElement('option');
                opt.value = budgetPatientUuid;
                opt.textContent = label;
                pacienteSel.appendChild(opt);
            }
            pacienteSel.value = budgetPatientUuid;
            pacienteSel.dataset.lastAuto = budgetPatientUuid;
        }
    }

    const notFound = Boolean(orcSeqRaw && orcSeq && Number.isFinite(orcSeq) && !b);
    if (notFound) showToast('Orçamento não encontrado para este número.', true);
    const opts = ['<option value="">' + (notFound ? 'Orçamento não encontrado' : 'Selecione...') + '</option>'];
    itens.forEach((it, idx) => {
        const servId = normId(it.servico_id || it.servicoId || '');
        const serv = (services || []).find(s => normId(s.id) === servId);
        const desc = serv ? serv.descricao : (it.descricao || `Item ${idx + 1}`);
        const valorItem = Number(it.valor || it.valorUnit || 0);
        const valorProt = Number(it.valor_protetico || it.valorProtetico || 0);
        const label = `${desc} — ${formatCurrencyBRL(valorItem)} | Prot: ${formatCurrencyBRL(valorProt)}`;
        opts.push(`<option value="${normId(it.id)}">${label}</option>`);
    });
    orcItemSel.innerHTML = opts.join('');

    if (prev && Array.from(orcItemSel.options).some(o => String(o.value) === prev)) {
        orcItemSel.value = prev;
    }
    if (!prev && itens.length === 1) {
        orcItemSel.value = normId(itens[0].id || '');
    }

    updateProteseItemInfo();
    syncProteseUniqueOpGuard();
}

function updateProteseItemInfo() {
    const descEl = document.getElementById('proteseItemDescricao');
    const valEl = document.getElementById('proteseItemValor');
    const protEl = document.getElementById('proteseItemValorProtetico');
    const orcSeqRaw = String((document.getElementById('proteseOrcamentoSeqid') || {}).value || '').trim();
    const itemId = String((document.getElementById('proteseOrcamentoItemId') || {}).value || '').trim();
    const execSel = document.getElementById('proteseTipoExecucao');
    const labSel = document.getElementById('proteseLaboratorio');
    const protSel = document.getElementById('proteseProtetico');
    const prazoEl = document.getElementById('protesePrazo');

    if (!descEl && !valEl && !protEl && !execSel && !labSel && !protSel && !prazoEl) return;

    const orcSeq = orcSeqRaw ? Number(orcSeqRaw) : null;
    const b = (orcSeq && Number.isFinite(orcSeq)) ? (budgets || []).find(x => Number(x.seqid) === Number(orcSeq)) : null;
    const itens = b ? (b.orcamento_itens || []) : [];
    const it = itemId ? itens.find(x => String(x.id || '').trim() === itemId) : null;
    if (!it) {
        if (descEl) descEl.value = '';
        if (valEl) valEl.value = '';
        if (protEl) protEl.value = '';
        return;
    }

    const servId = String(it.servico_id || it.servicoId || '').trim();
    const serv = (services || []).find(s => String(s.id || '').trim() === servId);
    const desc = serv ? serv.descricao : (it.descricao || '—');
    const valorItem = Number(it.valor || it.valorUnit || 0);
    const valorProt = Number(it.valor_protetico || it.valorProtetico || 0);
    if (descEl) descEl.value = desc;
    if (valEl) valEl.value = formatCurrencyBRL(valorItem);
    if (protEl) protEl.value = formatCurrencyBRL(valorProt);

    const desiredExec = (() => {
        const raw = String(it.protese_tipo_execucao || it.proteseExecucao || '').toUpperCase();
        if (raw === 'INTERNA' || raw === 'EXTERNA') return raw;
        const hasLab = Boolean(it.protese_laboratorio_id || it.proteseLaboratorioId);
        const hasProt = Boolean(it.protetico_id || it.proteticoId);
        if (hasLab) return 'EXTERNA';
        if (hasProt) return 'INTERNA';
        return '';
    })();

    const applyExec = (v) => {
        if (execSel && v && String(execSel.value || '') !== v) execSel.value = v;
        syncProteseExecucaoGroups();
    };

    if (desiredExec) applyExec(desiredExec);

    if (desiredExec === 'EXTERNA') {
        const labId = String(it.protese_laboratorio_id || it.proteseLaboratorioId || '');
        if (protSel) protSel.value = '';
        if (labSel && labId) labSel.value = labId;
    } else if (desiredExec === 'INTERNA') {
        const rawProt = String(it.protetico_id || it.proteticoId || '');
        if (labSel) labSel.value = '';
        if (protSel && rawProt) {
            const direct = (professionals || []).find(p => String(p.id) === rawProt);
            if (direct) {
                protSel.value = String(direct.id);
            } else {
                const bySeq = (professionals || []).find(p => String(p.seqid) === rawProt);
                if (bySeq) protSel.value = String(bySeq.id);
            }
        }
    }

    const addDays = (days) => {
        const base = new Date();
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        d.setDate(d.getDate() + Number(days || 0));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    if (prazoEl && !String(prazoEl.value || '').trim()) {
        if (desiredExec === 'INTERNA') {
            prazoEl.value = addDays(5);
        } else if (desiredExec === 'EXTERNA') {
            const labId = String(it.protese_laboratorio_id || it.proteseLaboratorioId || '');
            const lab = labId ? (proteseLabs || []).find(l => String(l.id) === labId) : null;
            const dias = lab && lab.prazo_padrao_dias != null ? Number(lab.prazo_padrao_dias) : 0;
            prazoEl.value = addDays(dias);
        }
    }

    syncProteseUniqueOpGuard();
}

let __proteseUniqGuardToken = 0;
async function syncProteseUniqueOpGuard() {
    const warn = document.getElementById('proteseUniqueWarning');
    const warnText = document.getElementById('proteseUniqueWarningText');
    const btnView = document.getElementById('btnProteseViewExisting');
    const btnSave = document.getElementById('btnProteseSave');
    if (!warn || !warnText || !btnView) return;

    const pacienteId = String((document.getElementById('protesePaciente') || {}).value || '').trim();
    const orcSeqRaw = String((document.getElementById('proteseOrcamentoSeqid') || {}).value || '').trim();
    const itemId = String((document.getElementById('proteseOrcamentoItemId') || {}).value || '').trim();
    const orcSeq = orcSeqRaw ? Number(orcSeqRaw) : null;
    const b = (orcSeq && Number.isFinite(orcSeq)) ? (budgets || []).find(x => Number(x.seqid) === Number(orcSeq)) : null;
    const orcamentoId = b ? String(b.id || '') : '';

    const clear = () => {
        warn.classList.add('hidden');
        warnText.textContent = '';
        btnView.dataset.opId = '';
        if (btnSave) btnSave.disabled = false;
    };

    if (!pacienteId || !orcamentoId || !itemId) {
        clear();
        return;
    }

    if (currentProteseOrder && String(currentProteseOrder.id || '') && String(currentProteseOrder.orcamento_item_id || '') === itemId) {
        clear();
        return;
    }

    const token = ++__proteseUniqGuardToken;
    try {
        const { data, error } = await withTimeout(
            db.from('ordens_proteticas')
                .select('id, seqid, status_geral, created_at')
                .eq('empresa_id', currentEmpresaId)
                .eq('paciente_id', pacienteId)
                .eq('orcamento_id', orcamentoId)
                .eq('orcamento_item_id', itemId)
                .neq('status_geral', 'CANCELADA')
                .order('created_at', { ascending: true })
                .limit(1),
            12000,
            'protese:uniq_guard'
        );
        if (token !== __proteseUniqGuardToken) return;
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
            clear();
            return;
        }
        const opNum = row.seqid != null ? `#${row.seqid}` : String(row.id);
        warnText.textContent = `Este item já possui uma Ordem de Prótese ativa (Nº ${opNum}).`;
        btnView.dataset.opId = String(row.id || '');
        warn.classList.remove('hidden');
        if (btnSave) btnSave.disabled = true;
    } catch {
        clear();
    }
}

async function openProteseById(opId) {
    const id = String(opId || '').trim();
    if (!id) return;
    try {
        const { data, error } = await withTimeout(
            db.from('ordens_proteticas')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('id', id)
                .limit(1),
            15000,
            'protese:open_by_id'
        );
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : null;
        if (!row) { showToast('OP não encontrada.', true); return; }
        openProteseModal(row);
    } catch (err) {
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao abrir OP: ${msg}`, true);
    }
}

async function loadProteseTimeline(orderId) {
    const wrap = document.getElementById('proteseTimeline');
    if (!wrap) return;
    if (!orderId) {
        wrap.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Salve a OP para iniciar o histórico.</div>';
        return;
    }
    wrap.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Carregando...</div>';
    try {
        const q = db.from('ordens_proteticas_eventos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('ordem_id', orderId)
            .order('created_at', { ascending: true })
            .limit(500);
        const { data, error } = await withTimeout(q, 15000, 'ordens_proteticas_eventos');
        if (error) throw error;
        const events = (data || []).map(ev => ({ kind: 'op', ts: ev.created_at || null, ...ev }));

        let custodia = [];
        let custodiaErrMsg = '';
        try {
            const q2 = db.from('ordens_proteticas_custodia_eventos')
                .select('*')
                .eq('ordem_id', orderId)
                .order('confirmed_at', { ascending: true })
                .limit(200);
            const { data: d2, error: e2 } = await withTimeout(q2, 12000, 'ordens_proteticas_custodia_eventos');
            if (!e2) {
                custodia = (d2 || []).map(ev => ({ kind: 'custodia', ts: ev.confirmed_at || ev.created_at || null, ...ev }));
            } else {
                custodiaErrMsg = String(e2.message || e2.code || 'Falha ao carregar custódia');
            }
        } catch {
            custodiaErrMsg = custodiaErrMsg || 'Falha ao carregar custódia';
        }

        const all = events.concat(custodia).sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
        if (!all.length) {
            wrap.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Nenhum evento registrado.</div>';
            return;
        }

        const warnHtml = custodiaErrMsg
            ? `<div style="padding: 10px 12px; border: 1px solid var(--danger-color); background: rgba(239,68,68,0.06); border-radius: 12px; margin-bottom: 10px; color: var(--text-color);">
                 <div style="font-weight: 900;">Custódia (QR) indisponível no histórico</div>
                 <div style="margin-top:4px; color: var(--text-muted); font-size: 12px;">${custodiaErrMsg}</div>
               </div>`
            : '';

        const rows = all.map((ev, idx) => {
            const isCust = ev.kind === 'custodia';
            const dtIso = ev.ts || ev.created_at || ev.confirmed_at || null;
            const dt = dtIso ? formatDateTime(dtIso) : '—';
            const tipo = isCust ? `CUSTÓDIA · ${String(ev.acao || '')}` : String(ev.tipo_evento || '');
            const fase = String(ev.fase_resultante || '');
            const de = String(ev.de_local || '');
            const para = String(ev.para_local || '');
            const notaRaw = isCust
                ? `Recebedor: ${String(ev.recebedor_nome || '')}${ev.recebedor_doc ? ` (${String(ev.recebedor_doc || '')})` : ''}`
                : String(ev.nota || '');
            return {
                i: idx + 1,
                dt,
                tipo,
                fase,
                de,
                para,
                nota: notaRaw
            };
        });

        wrap.innerHTML = warnHtml + `
            <div style="overflow:auto;">
                <table class="main-table" style="min-width: 860px;">
                    <thead>
                        <tr>
                            <th style="width: 54px; text-align:center;">#</th>
                            <th style="width: 170px;">Data/Hora</th>
                            <th style="width: 140px;">Evento</th>
                            <th style="width: 140px;">Fase</th>
                            <th style="width: 170px;">De</th>
                            <th style="width: 170px;">Para</th>
                            <th>Observação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr>
                                <td style="text-align:center; font-weight:800;">${r.i}</td>
                                <td>${escapeHtml(r.dt)}</td>
                                <td style="font-weight:800;">${escapeHtml(r.tipo || '—')}</td>
                                <td>${escapeHtml(r.fase || '—')}</td>
                                <td>${escapeHtml(r.de || '—')}</td>
                                <td>${escapeHtml(r.para || '—')}</td>
                                <td style="white-space: pre-wrap;">${escapeHtml(r.nota || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error('Erro ao carregar histórico da OP:', err);
        wrap.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--danger-color);">Falha ao carregar histórico.</div>';
    }
}

async function addProteseTimelineEvent({ tipoEvento, faseResultante, statusResultante, deLocal, paraLocal, nota }) {
    if (!currentProteseOrder) {
        await saveProteseOrder();
    }
    const o = currentProteseOrder;
    if (!o || !o.id) return;

    const payload = {
        empresa_id: currentEmpresaId,
        ordem_id: o.id,
        tipo_evento: tipoEvento,
        fase_resultante: faseResultante || null,
        de_local: deLocal || null,
        para_local: paraLocal || null,
        nota: nota || null,
        created_by: currentUser.id
    };

    const { error } = await withTimeout(
        db.from('ordens_proteticas_eventos').insert(payload),
        15000,
        'ordens_proteticas_eventos:insert'
    );
    if (error) throw error;

    if (faseResultante || statusResultante) {
        const upd = {};
        if (faseResultante) upd.fase_atual = faseResultante;
        if (statusResultante) upd.status_geral = statusResultante;
        const { error: uErr } = await withTimeout(
            db.from('ordens_proteticas')
                .update(upd)
                .eq('empresa_id', currentEmpresaId)
                .eq('id', o.id),
            15000,
            'ordens_proteticas:update_fase'
        );
        if (uErr) throw uErr;
        if (faseResultante) o.fase_atual = faseResultante;
        if (statusResultante) o.status_geral = statusResultante;
        const inList = (proteseOrders || []).find(x => String(x.id) === String(o.id));
        if (inList) {
            if (faseResultante) inList.fase_atual = faseResultante;
            if (statusResultante) inList.status_geral = statusResultante;
        }
    }

    const notaEl = document.getElementById('proteseNota');
    if (notaEl) notaEl.value = '';
    const quickSel = document.getElementById('proteseQuickEventType');
    if (quickSel) quickSel.value = '';
    syncProteseEventButtons();

    await loadProteseTimeline(String(o.id));
    await fetchProteseFromUI();
}

async function saveProteseOrder() {
    if (!can('protese', 'insert') && !currentProteseOrder) {
        showToast('Você não tem permissão para criar OP.', true);
        return;
    }
    if (!can('protese', 'update') && currentProteseOrder) {
        showToast('Você não tem permissão para editar OP.', true);
        return;
    }

    const pacienteId = (document.getElementById('protesePaciente') || {}).value || '';
    const exec = (document.getElementById('proteseTipoExecucao') || {}).value || 'EXTERNA';
    const statusGeral = (document.getElementById('proteseStatusGeral') || {}).value || 'EM_ANDAMENTO';
    const labId = (document.getElementById('proteseLaboratorio') || {}).value || '';
    const protId = (document.getElementById('proteseProtetico') || {}).value || '';
    const orcItemId = (document.getElementById('proteseOrcamentoItemId') || {}).value || '';
    const prazo = (document.getElementById('protesePrazo') || {}).value || null;
    const prioridade = (document.getElementById('protesePrioridade') || {}).value || 'NORMAL';
    const obs = (document.getElementById('proteseObservacoes') || {}).value || '';
    const origemTrabalho = (document.getElementById('proteseOrigemTrabalho') || {}).value || 'MOLDAGEM_CLINICA';
    const materialTipo = (document.getElementById('proteseMaterialTipo') || {}).value || 'FISICO';

    const orcSeqRaw = (document.getElementById('proteseOrcamentoSeqid') || {}).value || '';
    const orcSeq = orcSeqRaw ? Number(orcSeqRaw) : null;
    let orcamentoId = null;
    if (orcSeq && Number.isFinite(orcSeq)) {
        const b = (budgets || []).find(x => Number(x.seqid) === Number(orcSeq));
        if (b) orcamentoId = b.id;
    }

    if (!pacienteId) {
        showToast('Selecione o paciente.', true);
        return;
    }
    if (exec === 'EXTERNA' && !labId) {
        showToast('Selecione um laboratório (ou use execução Interna).', true);
        return;
    }
    if (exec === 'INTERNA' && !protId) {
        showToast('Selecione um protético (interno).', true);
        return;
    }

    try {
        if (!currentProteseOrder) {
            const payload = {
                empresa_id: currentEmpresaId,
                paciente_id: pacienteId,
                orcamento_id: orcamentoId || '',
                orcamento_item_id: orcItemId || '',
                tipo_execucao: exec,
                laboratorio_id: exec === 'EXTERNA' ? labId : '',
                protetico_id: exec === 'INTERNA' ? protId : '',
                status_geral: statusGeral,
                prioridade,
                prazo_previsto: prazo || '',
                observacoes: obs || '',
                origem_trabalho: origemTrabalho,
                material_tipo: materialTipo
            };
            const { data, error } = await withTimeout(db.rpc('rpc_create_ordem_protetica', { p_data: payload }), 15000, 'rpc_create_ordem_protetica');
            if (error) throw error;
            currentProteseOrder = data;
            try {
                const { error: uErr } = await withTimeout(
                    db.from('ordens_proteticas')
                        .update({ origem_trabalho: origemTrabalho, material_tipo: materialTipo, updated_at: new Date().toISOString() })
                        .eq('empresa_id', currentEmpresaId)
                        .eq('id', currentProteseOrder.id),
                    15000,
                    'ordens_proteticas:update_origem_material'
                );
                if (!uErr) {
                    currentProteseOrder.origem_trabalho = origemTrabalho;
                    currentProteseOrder.material_tipo = materialTipo;
                }
            } catch { }
            showToast('OP criada com sucesso!');
            const btnPrint = document.getElementById('btnProtesePrint');
            if (btnPrint) btnPrint.disabled = false;
            const btnPrintSimple = document.getElementById('btnProtesePrintSimple');
            if (btnPrintSimple) btnPrintSimple.disabled = false;
            const quickSel = document.getElementById('proteseQuickEventType');
            if (quickSel) quickSel.value = '';
            syncProteseEventButtons();
            try {
                const execLocal = exec === 'EXTERNA'
                    ? ((proteseLabs || []).find(l => String(l.id) === String(labId || ''))?.nome || 'Laboratório')
                    : ((professionals || []).find(p => String(p.id) === String(protId || ''))?.nome || 'Protético');
                const paraLocal = String(execLocal || 'Protético');
                await addProteseTimelineEvent({
                    tipoEvento: 'CRIACAO',
                    faseResultante: 'CRIADA',
                    statusResultante: null,
                    deLocal: 'Clínica',
                    paraLocal,
                    nota: obs ? String(obs) : null
                });
            } catch { }
        } else {
            const upd = {
                paciente_id: pacienteId,
                orcamento_id: orcamentoId,
                orcamento_item_id: orcItemId || null,
                tipo_execucao: exec,
                laboratorio_id: exec === 'EXTERNA' ? labId : null,
                protetico_id: exec === 'INTERNA' ? protId : null,
                status_geral: statusGeral,
                prioridade,
                prazo_previsto: prazo || null,
                observacoes: obs || null,
                origem_trabalho: origemTrabalho,
                material_tipo: materialTipo,
                updated_at: new Date().toISOString()
            };
            const { error } = await withTimeout(
                db.from('ordens_proteticas')
                    .update(upd)
                    .eq('empresa_id', currentEmpresaId)
                    .eq('id', currentProteseOrder.id),
                15000,
                'ordens_proteticas:update'
            );
            if (error) throw error;
            showToast('OP atualizada com sucesso!');
            try {
                currentProteseOrder.origem_trabalho = origemTrabalho;
                currentProteseOrder.material_tipo = materialTipo;
                const inList = (proteseOrders || []).find(x => String(x.id) === String(currentProteseOrder.id));
                if (inList) {
                    inList.origem_trabalho = origemTrabalho;
                    inList.material_tipo = materialTipo;
                }
            } catch { }
            const btnPrint = document.getElementById('btnProtesePrint');
            if (btnPrint) btnPrint.disabled = false;
            const btnPrintSimple = document.getElementById('btnProtesePrintSimple');
            if (btnPrintSimple) btnPrintSimple.disabled = false;
            const quickSel = document.getElementById('proteseQuickEventType');
            if (quickSel) quickSel.value = '';
            syncProteseEventButtons();
        }
        await fetchProteseFromUI();
    } catch (err) {
        const rawMsg = err && err.message ? String(err.message) : 'Erro desconhecido';
        const code = err && err.code ? String(err.code) : '';
        const isDup = code === '23505' || /duplicate key/i.test(rawMsg) || /ordens_proteticas_uniq_ativa_item/i.test(rawMsg);
        if (isDup && !currentProteseOrder) {
            try {
                const pacienteId = String((document.getElementById('protesePaciente') || {}).value || '').trim();
                const orcSeqRaw = String((document.getElementById('proteseOrcamentoSeqid') || {}).value || '').trim();
                const itemId = String((document.getElementById('proteseOrcamentoItemId') || {}).value || '').trim();
                const orcSeq = orcSeqRaw ? Number(orcSeqRaw) : null;
                const b = (orcSeq && Number.isFinite(orcSeq)) ? (budgets || []).find(x => Number(x.seqid) === Number(orcSeq)) : null;
                const orcamentoId = b ? String(b.id || '') : '';
                const { data } = await withTimeout(
                    db.from('ordens_proteticas')
                        .select('id, seqid')
                        .eq('empresa_id', currentEmpresaId)
                        .eq('paciente_id', pacienteId)
                        .eq('orcamento_id', orcamentoId)
                        .eq('orcamento_item_id', itemId)
                        .neq('status_geral', 'CANCELADA')
                        .order('created_at', { ascending: true })
                        .limit(1),
                    12000,
                    'protese:dup_lookup'
                );
                const row = Array.isArray(data) ? data[0] : null;
                if (row && row.id) {
                    const opNum = row.seqid != null ? `#${row.seqid}` : String(row.id);
                    showToast(`Este item já possui uma OP ativa (${opNum}). Abrindo...`, true);
                    await openProteseById(String(row.id));
                    return;
                }
            } catch { }
            showToast('Este item já possui uma Ordem de Prótese ativa.', true);
            return;
        }
        showToast(`Falha ao salvar OP: ${rawMsg}`, true);
    }
}

async function printProteseOrder() {
    const o = currentProteseOrder;
    if (!o) { showToast('Salve a OP antes de imprimir.', true); return; }

    const pac = (patients || []).find(p => String(p.id) === String(o.paciente_id || ''));
    const pacNome = pac ? String(pac.nome || '') : '—';
    const b = (budgets || []).find(x => String(x.id) === String(o.orcamento_id || ''));
    const orcSeq = b && b.seqid != null ? String(b.seqid) : '—';
    const exec = String(o.tipo_execucao || '—');
    const executor = exec === 'EXTERNA'
        ? ((proteseLabs || []).find(l => String(l.id) === String(o.laboratorio_id || ''))?.nome || '—')
        : ((professionals || []).find(p => String(p.id) === String(o.protetico_id || ''))?.nome || '—');

    const itens = b ? (b.orcamento_itens || []) : [];
    const it = (o.orcamento_item_id ? itens.find(x => String(x.id) === String(o.orcamento_item_id)) : null);
    const serv = it ? (services || []).find(s => String(s.id) === String(it.servico_id || it.servicoId || '')) : null;
    const itemDesc = serv ? serv.descricao : (it ? (it.descricao || '—') : '—');
    const itemValor = it ? Number(it.valor || it.valorUnit || 0) : 0;
    const itemValorProt = it ? Number(it.valor_protetico || it.valorProtetico || 0) : 0;

    const hoje = new Date().toLocaleString('pt-BR');
    const status = String(o.status_geral || '—');
    const fase = String(o.fase_atual || '—');
    const prazo = o.prazo_previsto ? String(o.prazo_previsto) : '—';
    const prioridade = String(o.prioridade || '—');
    const obs = String(o.observacoes || '').trim();

    let historicoRows = [];
    try {
        const q = db.from('ordens_proteticas_eventos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('ordem_id', o.id)
            .order('created_at', { ascending: true })
            .limit(500);
        const { data, error } = await withTimeout(q, 15000, 'ordens_proteticas_eventos:print');
        if (error) throw error;
        historicoRows = (Array.isArray(data) ? data : []).map(r => ({
            created_at: r.created_at,
            tipo: String(r.tipo_evento || ''),
            fase: String(r.fase_resultante || ''),
            de: String(r.de_local || ''),
            para: String(r.para_local || ''),
            nota: String(r.nota || '')
        }));
    } catch {
        historicoRows = [];
    }

    try {
        const q2 = db.from('ordens_proteticas_custodia_eventos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('ordem_id', o.id)
            .order('confirmed_at', { ascending: true })
            .limit(200);
        const { data: d2, error: e2 } = await withTimeout(q2, 12000, 'ordens_proteticas_custodia_eventos:print');
        if (!e2) {
            const crows = (Array.isArray(d2) ? d2 : []).map(r => ({
                created_at: r.confirmed_at || r.created_at,
                tipo: `CUSTÓDIA · ${String(r.acao || '')}`,
                fase: '',
                de: String(r.de_local || ''),
                para: String(r.para_local || ''),
                nota: `Recebido por: ${String(r.recebedor_nome || '')}${r.recebedor_doc ? ` (${String(r.recebedor_doc || '')})` : ''}`
            }));
            historicoRows = historicoRows.concat(crows).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
        }
    } catch { }

    const histTable = historicoRows.length ? `
      <table>
        <thead>
          <tr>
            <th style="width: 52px; text-align:center;">#</th>
            <th style="width: 160px;">Data/Hora</th>
            <th style="width: 140px;">Evento</th>
            <th style="width: 140px;">Fase</th>
            <th style="width: 180px;">De</th>
            <th style="width: 180px;">Para</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          ${historicoRows.map((r, idx) => {
              const dt = r.created_at ? formatDateTime(r.created_at) : '—';
              return `
                <tr>
                  <td style="text-align:center; font-weight:800;">${idx + 1}</td>
                  <td>${escapeHtml(dt)}</td>
                  <td>${escapeHtml(r.tipo || '—')}</td>
                  <td>${escapeHtml(r.fase || '—')}</td>
                  <td>${escapeHtml(r.de || '—')}</td>
                  <td>${escapeHtml(r.para || '—')}</td>
                  <td style="white-space: pre-wrap;">${escapeHtml(r.nota || '')}</td>
                </tr>
              `;
          }).join('')}
        </tbody>
      </table>
    ` : `<div style="color:#6b7280;">Nenhum evento registrado.</div>`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>OP #${o.seqid} - ${pacNome}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color:#111827; padding: 28px; }
    .header { display:flex; justify-content: space-between; align-items:flex-start; border-bottom: 2px solid #0066cc; padding-bottom: 14px; margin-bottom: 18px; }
    .clinic-name { font-size: 20px; font-weight: 800; color:#0066cc; line-height: 1.05; }
    .sub { font-size: 11px; color:#6b7280; margin-top: 3px; }
    .doc-title { font-size: 15px; font-weight: 800; text-align:right; color:#374151; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color:#0066cc; letter-spacing: .05em; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .item label { font-size: 11px; color:#6b7280; display:block; margin-bottom: 2px; }
    .item span { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; }
    th { background: #f9fafb; text-align:left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
    .footer { margin-top: 22px; font-size: 10px; color:#9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align:center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="clinic-name">OCC</div>
      <div class="sub">Odonto Connect Cloud</div>
      <div class="sub">Gerado em: ${hoje}</div>
    </div>
    <div>
      <div class="doc-title">ORDEM PROTÉTICA</div>
      <div class="sub" style="text-align:right;">OP #${o.seqid}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados</div>
    <div class="grid">
      <div class="item"><label>Paciente</label><span>${pacNome}</span></div>
      <div class="item"><label>Orçamento</label><span>${orcSeq !== '—' ? `#${orcSeq}` : '—'}</span></div>
      <div class="item"><label>Execução</label><span>${exec}</span></div>
      <div class="item"><label>Executor</label><span>${executor}</span></div>
      <div class="item"><label>Status</label><span>${status}</span></div>
      <div class="item"><label>Fase</label><span>${fase}</span></div>
      <div class="item"><label>Prazo</label><span>${prazo}</span></div>
      <div class="item"><label>Prioridade</label><span>${prioridade}</span></div>
      <div class="item"><label>Item do Orçamento</label><span>${itemDesc}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Valores</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="width: 160px; text-align:right;">Valor do Item</th>
          <th style="width: 160px; text-align:right;">Vlr Protético</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${itemDesc}</td>
          <td style="text-align:right;">${formatCurrencyBRL(itemValor)}</td>
          <td style="text-align:right;">${formatCurrencyBRL(itemValorProt)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${obs ? `
  <div class="section">
    <div class="section-title">Observações</div>
    <div style="white-space: pre-wrap; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #f9fafb;">${obs}</div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Controle de Idas e Vindas (Histórico)</div>
    ${histTable}
  </div>

  <div class="footer">Documento interno • Produção Protética</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Habilite pop-ups para imprimir a OP.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
}

async function printProteseOrderSimple() {
    const o = currentProteseOrder;
    if (!o) { showToast('Salve a OP antes de imprimir.', true); return; }

    const pac = (patients || []).find(p => String(p.id) === String(o.paciente_id || ''));
    const pacNome = pac ? String(pac.nome || '') : '—';
    const exec = String(o.tipo_execucao || '');
    const executor = exec === 'EXTERNA'
        ? ((proteseLabs || []).find(l => String(l.id) === String(o.laboratorio_id || ''))?.nome || '—')
        : ((professionals || []).find(p => String(p.id) === String(o.protetico_id || ''))?.nome || '—');

    let opEvents = [];
    try {
        const { data, error } = await withTimeout(
            db.from('ordens_proteticas_eventos')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('ordem_id', o.id)
                .order('created_at', { ascending: false })
                .limit(500),
            15000,
            'ordens_proteticas_eventos:print_simple'
        );
        if (error) throw error;
        opEvents = Array.isArray(data) ? data : [];
    } catch {
        opEvents = [];
    }

    let custEvents = [];
    try {
        const { data, error } = await withTimeout(
            db.from('ordens_proteticas_custodia_eventos')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('ordem_id', o.id)
                .order('confirmed_at', { ascending: false })
                .limit(200),
            15000,
            'ordens_proteticas_custodia_eventos:print_simple'
        );
        if (error) throw error;
        custEvents = Array.isArray(data) ? data : [];
    } catch {
        custEvents = [];
    }

    const all = (opEvents || [])
        .filter(r => String(r.tipo_evento || '') !== 'CUSTODIA')
        .filter(r => !String(r.nota || '').includes('[custodia_evento_id='))
        .map(r => ({
            ts: r.created_at || null,
            evento: String(r.tipo_evento || ''),
            fase: String(r.fase_resultante || ''),
            de: String(r.de_local || ''),
            para: String(r.para_local || ''),
            obs: String(r.nota || ''),
            rubrica: ''
        }))
        .concat((custEvents || []).map(r => {
            const acao = String(r.acao || '');
            const sig = String(r.assinatura_base64 || r.assinatura || r.assinatura_img || r.signature || '');
            const rubrica = sig && sig.startsWith('data:image') ? sig : '';
            const doc = r.recebedor_doc ? ` (${String(r.recebedor_doc || '')})` : '';
            return {
                ts: r.confirmed_at || r.created_at || null,
                evento: `CUSTÓDIA - ${acao}`,
                fase: acao === 'ENTREGA' ? 'ENVIADA' : (acao === 'RECEBIMENTO' ? 'RECEBIDA' : ''),
                de: String(r.de_local || ''),
                para: String(r.para_local || ''),
                obs: `Recebedor: ${String(r.recebedor_nome || '')}${doc}`,
                rubrica
            };
        }))
        .filter(x => x.ts);

    all.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));

    const blocks = all.length ? all.map(r => {
        const dt = r.ts ? formatDateTime(r.ts) : '—';
        const rubricaCell = r.rubrica
            ? `<div style="background:#fff; border:1px solid #e5e7eb; padding:2px; display:flex; align-items:center; justify-content:center;">
                   <img src="${r.rubrica}" alt="Rubrica" style="height: 34px; width: auto; display:block; margin: 0 auto; filter: invert(1) grayscale(1) contrast(1.15) brightness(1.0); background:#fff;">
               </div>`
            : '';
        return `
            <tr>
                <td class="nowrap">${escapeHtml(dt)}</td>
                <td class="nowrap" style="font-weight: 900;">${escapeHtml(r.evento || '—')}</td>
                <td class="nowrap">${escapeHtml(r.fase || '—')}</td>
                <td>${escapeHtml(r.de || '—')}</td>
                <td>${escapeHtml(r.para || '—')}</td>
                <td style="white-space: pre-wrap;">${escapeHtml(r.obs || '')}</td>
                <td style="text-align:center;">${rubricaCell}</td>
            </tr>
        `;
    }).join('') : '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Impressão Simples — OP</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color:#111827; padding: 16px 16px 20px; }
    .header { border-bottom: 2px solid #0066cc; padding-bottom: 10px; margin-bottom: 10px; }
    .title { font-size: 16px; font-weight: 900; color:#0066cc; }
    .sub { color:#6b7280; margin-top: 6px; font-size: 12px; }
    .sec { margin-top: 12px; }
    .sec h3 { font-size: 13px; font-weight: 900; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
    th { background: #f9fafb; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
    td.muted, .muted { color:#6b7280; }
    .nowrap { white-space: nowrap; }
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Impressão Simples — Ordem Protética</div>
    <div class="sub">Paciente: <strong>${escapeHtml(pacNome)}</strong></div>
    <div class="sub">Executor: <strong>${escapeHtml(String(executor || '—'))}</strong></div>
    <div class="sub">Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
  </div>

  <div class="sec">
    <h3>Controle de Idas e Vindas (Histórico)</h3>
    ${blocks ? `
      <table>
        <thead>
          <tr>
            <th class="nowrap" style="width: 150px;">Data/Hora</th>
            <th class="nowrap" style="width: 120px;">Evento</th>
            <th class="nowrap" style="width: 95px;">Fase</th>
            <th style="width: 180px;">De</th>
            <th style="width: 180px;">Para</th>
            <th>Observação</th>
            <th style="width: 120px; text-align:center;">Rubrica</th>
          </tr>
        </thead>
        <tbody>
          ${blocks}
        </tbody>
      </table>
    ` : `<div class="muted">Nenhum registro de custódia encontrado.</div>`}
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Habilite pop-ups para imprimir.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
}

function isProteseCustodiaEnabled() {
    try {
        const v = localStorage.getItem('dp_feature_protese_custodia');
        return v !== '0';
    } catch {
        return true;
    }
}

function getProteseCustodiaBaseUrl() {
    const stored = (() => {
        try { return localStorage.getItem('dp_protese_custodia_baseurl') || ''; } catch { return ''; }
    })();
    if (stored) return stored;

    const origin = String(window.location.origin || '');
    const host = String(window.location.hostname || '');
    if (host === 'localhost' || host === '127.0.0.1') return origin;
    return origin;
}

async function openProteseCustodiaModal() {
    if (!isProteseCustodiaEnabled()) {
        showToast('Custódia (QR) desativada neste navegador.', true);
        return;
    }

    const quickSel = document.getElementById('proteseQuickEventType');
    const selected = quickSel ? String(quickSel.value || '') : '';
    if (!selected) {
        showToast('Selecione Entrega ou Recebimento antes de usar Custódia (QR).', true);
        if (quickSel) quickSel.focus();
        return;
    }
    if (quickSel) quickSel.value = '';
    syncProteseEventButtons();

    if (!currentProteseOrder) {
        await saveProteseOrder();
    }
    const o = currentProteseOrder;
    if (!o) return;

    const modal = document.getElementById('proteseCustodiaModal');
    const body = document.getElementById('proteseCustodiaBody');
    if (!modal || !body) return;

    const exec = String(o.tipo_execucao || '');
    const executor = exec === 'EXTERNA'
        ? ((proteseLabs || []).find(l => String(l.id) === String(o.laboratorio_id || ''))?.nome || '—')
        : ((professionals || []).find(p => String(p.id) === String(o.protetico_id || ''))?.nome || '—');

    const defaults = (() => {
        const fromClinic = 'Clínica';
        const toExec = String(executor || 'Protético');
        const a = selected === 'RECEBIMENTO' ? 'RECEBIMENTO' : 'ENTREGA';
        return a === 'ENTREGA'
            ? { acao: 'ENTREGA', de_local: fromClinic, para_local: toExec }
            : { acao: 'RECEBIMENTO', de_local: toExec, para_local: fromClinic };
    })();

    const baseUrl = getProteseCustodiaBaseUrl();

    body.innerHTML = `
        <div style="display:flex; gap: 1rem; flex-wrap: wrap; align-items:flex-end;">
            <div class="form-group" style="min-width: 180px; margin-bottom: 0;">
                <label for="custAcao">Ação</label>
                <select id="custAcao" class="form-control">
                    <option value="ENTREGA">Entrega</option>
                    <option value="RECEBIMENTO">Recebimento</option>
                </select>
            </div>
            <div class="form-group" style="min-width: 220px; flex:1; margin-bottom: 0;">
                <label for="custDe">De (posse)</label>
                <input id="custDe" class="form-control" placeholder="Ex.: Clínica">
            </div>
            <div class="form-group" style="min-width: 220px; flex:1; margin-bottom: 0;">
                <label for="custPara">Para (posse)</label>
                <input id="custPara" class="form-control" placeholder="Ex.: Laboratório">
            </div>
            <div class="form-group" style="min-width: 240px; flex: 1; margin-bottom: 0;">
                <label for="custBaseUrl">URL base (para o celular)</label>
                <input id="custBaseUrl" class="form-control" placeholder="Ex.: http://192.168.0.25:8282">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <button id="btnCustGerar" class="btn btn-primary"><i class="ri-qr-code-line"></i> Gerar QR</button>
            </div>
        </div>

        <div id="custOut" style="margin-top: 1rem; display:none;"></div>

        <div class="section-divider" style="margin: 1.25rem 0 1rem;"><span>Últimas confirmações</span></div>
        <div id="custEvents" style="color: var(--text-muted);">Carregando...</div>
    `;

    const acaoEl = document.getElementById('custAcao');
    const deEl = document.getElementById('custDe');
    const paraEl = document.getElementById('custPara');
    const baseEl = document.getElementById('custBaseUrl');
    if (acaoEl) acaoEl.value = defaults.acao;
    if (deEl) deEl.value = defaults.de_local;
    if (paraEl) paraEl.value = defaults.para_local;
    if (baseEl) baseEl.value = baseUrl;

    const syncDePara = () => {
        const a = acaoEl ? String(acaoEl.value || 'ENTREGA') : 'ENTREGA';
        const fromClinic = 'Clínica';
        const toExec = String(executor || 'Protético');
        if (a === 'ENTREGA') {
            if (deEl) deEl.value = fromClinic;
            if (paraEl) paraEl.value = toExec;
        } else {
            if (deEl) deEl.value = toExec;
            if (paraEl) paraEl.value = fromClinic;
        }
    };
    if (acaoEl) acaoEl.addEventListener('change', syncDePara);

    const btnGerar = document.getElementById('btnCustGerar');
    if (btnGerar) btnGerar.addEventListener('click', async () => {
        const acao = String((acaoEl || {}).value || 'ENTREGA');
        const de = String((deEl || {}).value || '').trim();
        const para = String((paraEl || {}).value || '').trim();
        const base = String((baseEl || {}).value || '').trim();
        if (!de || !para) { showToast('Informe De/Para.', true); return; }
        if (!base) { showToast('Informe a URL base para o celular.', true); return; }
        try { localStorage.setItem('dp_protese_custodia_baseurl', base); } catch { }

        btnGerar.disabled = true;
        btnGerar.style.opacity = '0.6';

        try {
            try {
                const { data: lastRows, error: lastErr } = await withTimeout(
                    db.from('ordens_proteticas_custodia_eventos')
                        .select('acao,confirmed_at')
                        .eq('ordem_id', o.id)
                        .order('confirmed_at', { ascending: false })
                        .limit(1),
                    10000,
                    'custodia:check_last'
                );
                const ctx = window.__proteseCustodiaContext;
                const skipSameActionConfirm = !!(ctx && ctx.kind && ctx.kind !== 'TRANSPORTE');
                if (!skipSameActionConfirm && !lastErr && Array.isArray(lastRows) && lastRows.length) {
                    const last = lastRows[0];
                    const lastA = String(last.acao || '').toUpperCase();
                    const curA = String(acao || '').toUpperCase();
                    if (lastA === curA) {
                        const opp = curA === 'ENTREGA' ? 'RECEBIMENTO' : 'ENTREGA';
                        let hasOppAfter = false;
                        try {
                            const { data: oppRows, error: oppErr } = await withTimeout(
                                db.from('ordens_proteticas_custodia_eventos')
                                    .select('id')
                                    .eq('ordem_id', o.id)
                                    .eq('acao', opp)
                                    .gt('confirmed_at', last.confirmed_at || '')
                                    .limit(1),
                                8000,
                                'custodia:check_opp'
                            );
                            hasOppAfter = !oppErr && Array.isArray(oppRows) && oppRows.length > 0;
                        } catch {}
                        if (!hasOppAfter) {
                            const proceed = window.confirm(`A última custódia registrada foi ${curA}. Não encontramos ${opp} posterior.\nDeseja mesmo gerar uma nova ${curA} para conserto?`);
                            if (!proceed) {
                                btnGerar.disabled = false;
                                btnGerar.style.opacity = '1';
                                return;
                            }
                        }
                    }
                }
            } catch { /* se checagem falhar, prossegue */ }

            const { data, error } = await withTimeout(
                db.rpc('rpc_protese_custodia_issue_token', {
                    p_empresa_id: currentEmpresaId,
                    p_ordem_id: o.id,
                    p_acao: acao,
                    p_de_local: de,
                    p_para_local: para,
                    p_ttl_minutes: 10
                }),
                15000,
                'rpc_protese_custodia_issue_token'
            );
            if (error) throw error;
            const row = (data && data[0]) ? data[0] : null;
            if (!row || row.ok !== true) {
                showToast(row && row.message ? String(row.message) : 'Falha ao gerar QR.', true);
                return;
            }

            const token = String(row.token || '');
            const code = String(row.code || '');
            const exp = row.expires_at ? String(row.expires_at) : '';
            const link = `${base.replace(/\/$/, '')}/protese_custodia.html?t=${encodeURIComponent(token)}&c=${encodeURIComponent(code)}&v=${encodeURIComponent(APP_BUILD)}`;
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}`;
            try {
                window.__custAckShown = false;
                window.__custPollIssuedAt = new Date().toISOString();
                window.__custPollToken = token;
                window.__custPollTokenId = null;
                window.__custPollExpected = {
                    empresa_id: currentEmpresaId,
                    ordem_id: o.id,
                    acao: String(acao || ''),
                    de_local: String(de || ''),
                    para_local: String(para || '')
                };
                const prev = document.getElementById('custAckOverlay');
                if (prev) prev.remove();
            } catch { }

            const out = document.getElementById('custOut');
            if (out) {
                out.style.display = '';
                out.innerHTML = `
                    <div class="card" style="padding: 1rem;">
                        <div style="display:flex; gap: 1rem; flex-wrap: wrap; align-items:flex-start;">
                            <div style="min-width: 240px;">
                                <img src="${qrSrc}" alt="QR Code" style="width:240px; height:240px; border-radius: 12px; border:1px solid var(--border-color); background: white;">
                            </div>
                            <div style="flex:1; min-width: 240px;">
                                <div style="font-weight:900; font-size: 14px;">Código (digitar no celular)</div>
                                <div style="font-size: 28px; letter-spacing: 0.12em; font-weight: 900; margin: 6px 0 10px 0;">${code || '—'}</div>
                                <div style="color: var(--text-muted); font-size: 12px;">Validade: ${exp ? formatDateTime(exp) : '—'}</div>
                                <div style="margin-top: 10px;">
                                    <label style="display:block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Link</label>
                                    <input id="custLink" class="form-control" readonly value="${link}">
                                </div>
                                <div style="display:flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                                    <button class="btn btn-secondary" id="btnCustCopy"><i class="ri-file-copy-line"></i> Copiar link</button>
                                    <button class="btn btn-secondary" id="btnCustCancel"><i class="ri-close-line"></i> Cancelar QR</button>
                                    <button class="btn btn-primary" id="btnCustVerify"><i class="ri-refresh-line"></i> Verificar assinatura</button>
                                </div>
                                <div style="margin-top: 8px; color: var(--text-muted); font-size: 12px;">
                                    Se você estiver no PC com localhost, ajuste a URL base para o IP do PC (ex.: http://192.168.x.x:8282).
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const btnCopy = document.getElementById('btnCustCopy');
                if (btnCopy) btnCopy.addEventListener('click', async () => {
                    const tryClipboardApi = async () => {
                        if (!navigator.clipboard || !window.isSecureContext) return false;
                        await navigator.clipboard.writeText(link);
                        return true;
                    };
                    const tryExecCommand = () => {
                        const input = document.getElementById('custLink');
                        if (input && typeof input.select === 'function') {
                            input.focus();
                            input.select();
                            try { input.setSelectionRange(0, 99999); } catch { }
                            try {
                                return document.execCommand && document.execCommand('copy');
                            } catch {
                                return false;
                            }
                        }
                        try {
                            const ta = document.createElement('textarea');
                            ta.value = link;
                            ta.setAttribute('readonly', '');
                            ta.style.position = 'fixed';
                            ta.style.left = '-9999px';
                            ta.style.top = '0';
                            document.body.appendChild(ta);
                            ta.focus();
                            ta.select();
                            const ok = document.execCommand && document.execCommand('copy');
                            document.body.removeChild(ta);
                            return ok;
                        } catch {
                            return false;
                        }
                    };
                    try {
                        const ok = (await tryClipboardApi()) || tryExecCommand();
                        if (ok) showToast('Link copiado.');
                        else showToast('Falha ao copiar. Selecione e copie manualmente.', true);
                    } catch {
                        const ok = tryExecCommand();
                        if (ok) showToast('Link copiado.');
                        else showToast('Falha ao copiar. Selecione e copie manualmente.', true);
                    }
                });

                const btnCancel = document.getElementById('btnCustCancel');
                if (btnCancel) btnCancel.addEventListener('click', async () => {
                    try {
                        const { error: uErr } = await withTimeout(
                            db.from('ordens_proteticas_custodia_tokens')
                                .update({ status: 'CANCELADO' })
                                .eq('empresa_id', currentEmpresaId)
                                .eq('token', token)
                                .eq('status', 'PENDENTE'),
                            15000,
                            'ordens_proteticas_custodia_tokens:cancel'
                        );
                        if (uErr) throw uErr;
                        showToast('QR cancelado.');
                    } catch (e) {
                        const msg = e && e.message ? e.message : 'Erro desconhecido';
                        showToast(`Falha ao cancelar QR: ${msg}`, true);
                    }
                });

                const btnVerify = document.getElementById('btnCustVerify');
                if (btnVerify) btnVerify.addEventListener('click', async () => {
                    await refreshProteseCustodiaEvents(o.id, true);
                });

                try {
                    if (window.__custPollTimer) {
                        clearInterval(window.__custPollTimer);
                        window.__custPollTimer = null;
                    }
                    window.__custPollUntil = Date.now() + 15 * 60 * 1000;
                    window.__custPollTimer = setInterval(async () => {
                        if (Date.now() > (window.__custPollUntil || 0)) {
                            clearInterval(window.__custPollTimer);
                            window.__custPollTimer = null;
                            window.__custPollUntil = 0;
                            return;
                        }
                        try {
                            let confirmed = false;
                            try {
                                const { data: trows, error: terr } = await withTimeout(
                                    db.from('ordens_proteticas_custodia_tokens')
                                        .select('id, status, confirmed_at')
                                        .eq('empresa_id', currentEmpresaId)
                                        .eq('token', token)
                                        .limit(1),
                                    10000,
                                    'custodia:poll_token'
                                );
                                if (!terr && Array.isArray(trows) && trows.length) {
                                    try { window.__custPollTokenId = trows[0].id || null; } catch {}
                                    const st = String(trows[0].status || '');
                                    const confirmedAt = trows[0].confirmed_at ? String(trows[0].confirmed_at) : '';
                                    confirmed = (st === 'CONFIRMADO' || !!confirmedAt);
                                }
                            } catch { }

                            if (!confirmed) {
                                try {
                                    const exp = window.__custPollExpected || {};
                                    const issuedAt = window.__custPollIssuedAt ? String(window.__custPollIssuedAt) : '';
                                    const q = db.from('ordens_proteticas_custodia_eventos')
                                        .select('id,acao,de_local,para_local,confirmed_at')
                                        .eq('ordem_id', o.id)
                                        .gt('confirmed_at', issuedAt || '1970-01-01T00:00:00Z')
                                        .order('confirmed_at', { ascending: false })
                                        .limit(1);
                                    const { data: erows, error: eerr } = await withTimeout(q, 10000, 'custodia:poll_eventos');
                                    if (!eerr && Array.isArray(erows) && erows.length) {
                                        const ev = erows[0];
                                        const ac = String(ev.acao || '');
                                        const de2 = String(ev.de_local || '');
                                        const pa2 = String(ev.para_local || '');
                                        if (!exp.acao || (ac === exp.acao && de2 === exp.de_local && pa2 === exp.para_local)) {
                                            confirmed = true;
                                        }
                                    }
                                } catch { }
                            }

                            if (confirmed) {
                                try { await refreshProteseCustodiaEvents(o.id, true); } catch { }
                                try {
                                    if (!document.getElementById('custAckOverlay')) {
                                        showCustodiaAck('Assinatura registrada no histórico da OP.');
                                    }
                                } catch { }
                                clearInterval(window.__custPollTimer);
                                window.__custPollTimer = null;
                                window.__custPollUntil = 0;
                            }
                        } catch { /* ignore */ }
                    }, 3000);
                } catch { /* ignore */ }
            }

            await refreshProteseCustodiaEvents(o.id, false);
        } catch (e) {
            const msg = e && e.message ? e.message : 'Erro desconhecido';
            showToast(`Falha ao gerar QR: ${msg}`, true);
        } finally {
            btnGerar.disabled = false;
            btnGerar.style.opacity = '1';
        }
    });

    modal.classList.remove('hidden');
    await refreshProteseCustodiaEvents(o.id, false);
}

function closeProteseCustodiaModal() {
    const modal = document.getElementById('proteseCustodiaModal');
    if (modal) modal.classList.add('hidden');
    const ack = document.getElementById('custAckOverlay');
    if (ack) ack.remove();
    if (window.__custPollTimer) {
        clearInterval(window.__custPollTimer);
        window.__custPollTimer = null;
        window.__custPollUntil = 0;
    }
    if (window.__custAckKeyHandler) {
        document.removeEventListener('keydown', window.__custAckKeyHandler, true);
        window.__custAckKeyHandler = null;
    }
}

function showCustodiaAck(message) {
    const modal = document.getElementById('proteseCustodiaModal');
    if (!modal) { showToast(message); return; }
    if (window.__custPollTimer) {
        clearInterval(window.__custPollTimer);
        window.__custPollTimer = null;
        window.__custPollUntil = 0;
    }
    const prev = document.getElementById('custAckOverlay');
    if (prev) prev.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custAckOverlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '22000';
    overlay.innerHTML = `
        <div style="background:#ffffff; color:#111827; border-radius: 14px; border: 1px solid #e5e7eb; padding: 18px 18px; max-width: 640px; width: 92%; text-align:center;">
            <div style="font-weight: 900; font-size: 16px;">${escapeHtml(String(message || ''))}</div>
            <div style="margin-top: 10px; color:#6b7280;">Pressione ENTER para fechar</div>
            <div style="margin-top: 14px; display:flex; justify-content:center;">
                <button id="custAckCloseBtn" class="btn btn-primary" type="button" style="min-width: 200px; display:flex; justify-content:center; align-items:center; text-align:center;">Fechar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => closeProteseCustodiaModal();
    const btn = document.getElementById('custAckCloseBtn');
    if (btn) btn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    if (window.__custAckKeyHandler) document.removeEventListener('keydown', window.__custAckKeyHandler, true);
    window.__custAckKeyHandler = (e) => {
        if (!e) return;
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    };
    document.addEventListener('keydown', window.__custAckKeyHandler, true);
    try { setTimeout(() => { try { (btn || overlay).focus(); } catch { } }, 50); } catch { }
}

async function refreshProteseCustodiaEvents(ordemId, tryMirrorToTimeline) {
    const wrap = document.getElementById('custEvents');
    if (!wrap) return;
    wrap.innerHTML = 'Carregando...';

    try {
        const { data, error } = await withTimeout(
            db.from('ordens_proteticas_custodia_eventos')
                .select('*')
                .eq('ordem_id', ordemId)
                .order('confirmed_at', { ascending: false })
                .limit(10),
            15000,
            'ordens_proteticas_custodia_eventos:list'
        );
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];

        if (!rows.length) {
            wrap.innerHTML = '<div style="color: var(--text-muted);">Nenhuma confirmação registrada ainda.</div>';
            return;
        }

        try {
            const hasReceived = rows.some(r => String(r && r.acao || '').toUpperCase() === 'RECEBIMENTO' && r.confirmed_at);
            if (hasReceived && currentProteseOrder && String(currentProteseOrder.id) === String(ordemId)) {
                currentProteseOrder.__custodia_received = true;
                const fase = String(currentProteseOrder.fase_atual || '').trim();
                if (fase !== 'RECEBIDO_CLINICA' && fase !== 'RECEBIDA' && fase !== 'PROVA_PACIENTE') {
                    const { error: uErr } = await withTimeout(
                        db.from('ordens_proteticas')
                            .update({ fase_atual: 'RECEBIDO_CLINICA', updated_at: new Date().toISOString() })
                            .eq('empresa_id', currentEmpresaId)
                            .eq('id', ordemId),
                        15000,
                        'ordens_proteticas:update_fase_pos_custodia_refresh'
                    );
                    if (!uErr) {
                        currentProteseOrder.fase_atual = 'RECEBIDO_CLINICA';
                        const inList = (proteseOrders || []).find(x => String(x.id) === String(ordemId));
                        if (inList) inList.fase_atual = 'RECEBIDO_CLINICA';
                    }
                }
                syncProteseEventButtons();
            }
        } catch { }

        try {
            const ctx = window.__proteseCustodiaContext;
            const pending = window.__protesePendingApproval;
            const latest = rows[0];
            const ok = ctx
                && ctx.kind === 'VALIDACAO_PACIENTE'
                && pending
                && String(pending.ordemId || '') === String(ordemId)
                && latest
                && latest.confirmed_at
                && String(latest.acao || '').toUpperCase() === String(ctx.expectedAcao || '').toUpperCase()
                && String(latest.para_local || '').trim() === String(ctx.expectedPara || '').trim();
            const faseNow = currentProteseOrder ? String(currentProteseOrder.fase_atual || '').trim() : '';
            if (ok && faseNow !== 'ENTREGUE' && faseNow !== 'ENCERRADA') {
                window.__proteseCustodiaContext = null;
                window.__protesePendingApproval = null;
                await addProteseTimelineEvent({
                    tipoEvento: 'APROVACAO',
                    faseResultante: 'ENTREGUE',
                    statusResultante: null,
                    deLocal: 'Clínica',
                    paraLocal: 'Paciente',
                    nota: pending && pending.nota ? String(pending.nota) : null
                });
                if (currentProteseOrder && currentProteseOrder.id) {
                    await withTimeout(
                        db.from('ordens_proteticas')
                            .update({ entregue_at: new Date().toISOString() })
                            .eq('empresa_id', currentEmpresaId)
                            .eq('id', currentProteseOrder.id),
                        15000,
                        'ordens_proteticas:update_entregue_at_after_validation'
                    );
                }
                showToast('Assinatura do paciente confirmada. OP aprovada.');
            }
        } catch { }

        try {
            const pend = window.__protesePendingReprovacao;
            if (pend && String(pend.ordemId || '') === String(ordemId)) {
                const started = pend.startedAt ? Date.parse(pend.startedAt) : NaN;
                const expectedAcao = String(pend.expectedAcao || 'ENTREGA').toUpperCase();
                const candidates = rows.filter(r => {
                    if (!r || !r.confirmed_at) return false;
                    const acao = String(r.acao || '').toUpperCase();
                    if (acao !== expectedAcao) return false;
                    const t = r.confirmed_at ? Date.parse(r.confirmed_at) : NaN;
                    if (Number.isFinite(started) && Number.isFinite(t) && t < started) return false;
                    return true;
                });
                const match = candidates[0] || null;
                if (match && match.id) {
                    const marker = `[custodia_evento_id=${match.id}]`;
                    let already = false;
                    try {
                        const { data: exRows, error: exErr } = await withTimeout(
                            db.from('ordens_proteticas_eventos')
                                .select('id')
                                .eq('ordem_id', ordemId)
                                .ilike('nota', `%${marker}%`)
                                .limit(1),
                            12000,
                            'protese:reprov:marker_check'
                        );
                        already = !exErr && Array.isArray(exRows) && exRows.length > 0;
                    } catch { }

                    if (!already) {
                        await addProteseTimelineEvent({
                            tipoEvento: 'REPROVACAO',
                            faseResultante: 'RETORNO_AJUSTE',
                            statusResultante: 'PAUSADA',
                            deLocal: String(pend.expectedDe || 'Dentista'),
                            paraLocal: String(pend.expectedPara || 'Clínica/Expedição'),
                            nota: [marker, `Motivo: ${pend.motivo}`, `Custo: ${pend.custo}`].join(' | ')
                        });
                    } else {
                        try {
                            const { error: uErr } = await withTimeout(
                                db.from('ordens_proteticas')
                                    .update({ fase_atual: 'RETORNO_AJUSTE', status_geral: 'PAUSADA', updated_at: new Date().toISOString() })
                                    .eq('id', ordemId),
                                12000,
                                'protese:reprov:ensure_phase'
                            );
                            if (!uErr && currentProteseOrder && String(currentProteseOrder.id) === String(ordemId)) {
                                currentProteseOrder.fase_atual = 'RETORNO_AJUSTE';
                                currentProteseOrder.status_geral = 'PAUSADA';
                                const inList = (proteseOrders || []).find(x => String(x.id) === String(ordemId));
                                if (inList) {
                                    inList.fase_atual = 'RETORNO_AJUSTE';
                                    inList.status_geral = 'PAUSADA';
                                }
                            }
                        } catch { }
                    }

                    try {
                        await withTimeout(
                            db.from('ordens_proteticas')
                                .update({ reprovacao_custodia_evento_id: match.id, updated_at: new Date().toISOString() })
                                .eq('id', ordemId),
                            12000,
                            'protese:reprov:update_ref'
                        );
                    } catch { }

                    window.__protesePendingReprovacao = null;
                    window.__proteseCustodiaContext = null;
                    try { closeProteseCustodiaModal(); } catch { }
                    try {
                        const m = document.getElementById('modalProteseReprovacao');
                        if (m) m.classList.add('hidden');
                        const b1 = document.getElementById('btnConfirmProteseReprovacao');
                        const b2 = document.getElementById('btnCancelProteseReprovacao');
                        const b3 = document.getElementById('btnCloseModalProteseReprovacao');
                        const t1 = document.getElementById('proteseReprovacaoMotivo');
                        const s1 = document.getElementById('proteseReprovacaoCusto');
                        const st1 = document.getElementById('proteseReprovacaoStatus');
                        if (b1) b1.disabled = false;
                        if (b2) b2.disabled = false;
                        if (b3) b3.disabled = false;
                        if (t1) t1.disabled = false;
                        if (s1) s1.disabled = false;
                        if (st1) st1.textContent = '';
                    } catch { }
                    showToast('Assinatura do dentista confirmada. OP em retorno para ajuste.');
                }
            }
        } catch { }

        const html = rows.map(r => {
            const dt = r.confirmed_at ? formatDateTime(r.confirmed_at) : '—';
            const acao = String(r.acao || '');
            const de = String(r.de_local || '');
            const para = String(r.para_local || '');
            const rec = String(r.recebedor_nome || '');
            const doc = r.recebedor_doc ? ` (${r.recebedor_doc})` : '';
            return `<div style="padding: 10px; border:1px solid var(--border-color); border-radius: 10px; margin-bottom: 10px;">
                <div style="display:flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                    <div style="font-weight:800;">${acao} • ${de} → ${para}</div>
                    <div style="color: var(--text-muted); font-size: 12px;">${dt}</div>
                </div>
                <div style="margin-top: 6px; color: var(--text-muted);">Recebedor: <span style="color: var(--text-color); font-weight:700;">${rec}${doc}</span></div>
                <div style="margin-top: 6px; color: var(--text-muted); font-size: 12px;">Evento ID: ${r.id}</div>
            </div>`;
        }).join('');
        wrap.innerHTML = html;

        if (tryMirrorToTimeline) {
            const latest = rows[0];
            if (latest && latest.id) {
                const marker = `[custodia_evento_id=${latest.id}]`;
                const { data: existing, error: exErr } = await withTimeout(
                    db.from('ordens_proteticas_eventos')
                        .select('id')
                        .eq('empresa_id', currentEmpresaId)
                        .eq('ordem_id', ordemId)
                        .ilike('nota', `%${marker}%`)
                        .limit(1),
                    15000,
                    'ordens_proteticas_eventos:mirror_check'
                );
                if (!exErr && Array.isArray(existing) && existing.length) {
                    showCustodiaAck('Assinatura já registrada no histórico da OP.');
                    await loadProteseTimeline(String(ordemId));
                    return;
                }

                const note = [
                    marker,
                    `Ação: ${latest.acao}`,
                    `De: ${latest.de_local}`,
                    `Para: ${latest.para_local}`,
                    `Recebedor: ${latest.recebedor_nome}${latest.recebedor_doc ? ` (${latest.recebedor_doc})` : ''}`,
                    latest.confirmed_at ? `Confirmado em: ${formatDateTime(latest.confirmed_at)}` : null
                ].filter(Boolean).join(' | ');

                const payload = {
                    empresa_id: currentEmpresaId,
                    ordem_id: ordemId,
                    tipo_evento: 'CUSTODIA',
                    fase_resultante: null,
                    de_local: latest.de_local,
                    para_local: latest.para_local,
                    nota: note,
                    created_by: currentUser.id
                };
                const { error: insErr } = await withTimeout(
                    db.from('ordens_proteticas_eventos').insert(payload),
                    15000,
                    'ordens_proteticas_eventos:mirror_insert'
                );
                if (insErr) throw insErr;
                showCustodiaAck('Assinatura registrada no histórico da OP.');
                await loadProteseTimeline(String(ordemId));
            }
        }
    } catch (e) {
        const msg = e && e.message ? e.message : 'Erro desconhecido';
        wrap.innerHTML = `<div style="color: var(--danger-color);">Falha ao carregar custódia: ${msg}</div>`;
    }
}

function openProteseLabsModal() {
    const modal = document.getElementById('modalProteseLabs');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderProteseLabsTable();
}

function renderProteseLabsTable() {
    const body = document.getElementById('proteseLabsBody');
    const empty = document.getElementById('proteseLabsEmpty');
    if (!body) return;
    body.innerHTML = '';
    const rows = (proteseLabs || []).slice().sort((a, b) => Number(a.seqid || 0) - Number(b.seqid || 0));
    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    rows.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">#${l.seqid}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);"><strong>${l.nome || ''}</strong></td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${l.contato || ''}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${(l.prazo_padrao_dias != null) ? `${l.prazo_padrao_dias}d` : '—'}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${l.ativo === false ? 'Não' : 'Sim'}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:center;">
                <button class="btn-icon" onclick="editProteseLab('${l.id}')" title="Editar"><i class="ri-edit-line"></i></button>
            </td>
        `;
        body.appendChild(tr);
    });
}

window.editProteseLab = function (labId) {
    const l = (proteseLabs || []).find(x => String(x.id) === String(labId));
    if (!l) return;
    const id = document.getElementById('proteseLabId');
    const nome = document.getElementById('proteseLabNome');
    const contato = document.getElementById('proteseLabContato');
    const prazo = document.getElementById('proteseLabPrazo');
    const ativo = document.getElementById('proteseLabAtivo');
    if (id) id.value = String(l.id);
    if (nome) nome.value = String(l.nome || '');
    if (contato) contato.value = String(l.contato || '');
    if (prazo) prazo.value = (l.prazo_padrao_dias != null) ? String(l.prazo_padrao_dias) : '';
    if (ativo) ativo.value = (l.ativo === false) ? 'false' : 'true';
};

async function saveProteseLab() {
    if (!can('protese', 'insert')) {
        showToast('Você não tem permissão para gerenciar laboratórios.', true);
        return;
    }
    const id = (document.getElementById('proteseLabId') || {}).value || '';
    const nome = (document.getElementById('proteseLabNome') || {}).value || '';
    const contato = (document.getElementById('proteseLabContato') || {}).value || '';
    const prazoRaw = (document.getElementById('proteseLabPrazo') || {}).value || '';
    const ativoVal = (document.getElementById('proteseLabAtivo') || {}).value || 'true';
    const prazo = prazoRaw ? Number(prazoRaw) : null;
    const ativo = ativoVal === 'false' ? false : true;

    if (!nome.trim()) {
        showToast('Informe o nome do laboratório.', true);
        return;
    }

    try {
        if (!id) {
            const payload = {
                empresa_id: currentEmpresaId,
                nome: nome.trim(),
                contato: contato.trim(),
                prazo_padrao_dias: (prazo != null && Number.isFinite(prazo)) ? prazo : '',
                ativo: ativo ? 'true' : 'false'
            };
            const { data, error } = await withTimeout(db.rpc('rpc_create_laboratorio_protetico', { p_data: payload }), 15000, 'rpc_create_laboratorio_protetico');
            if (error) throw error;
            proteseLabs = (proteseLabs || []).concat([data]);
            showToast('Laboratório criado com sucesso!');
        } else {
            const { error } = await withTimeout(
                db.from('laboratorios_proteticos')
                    .update({
                        nome: nome.trim(),
                        contato: contato.trim(),
                        prazo_padrao_dias: (prazo != null && Number.isFinite(prazo)) ? prazo : null,
                        ativo
                    })
                    .eq('empresa_id', currentEmpresaId)
                    .eq('id', id),
                15000,
                'laboratorios_proteticos:update'
            );
            if (error) throw error;
            proteseLabs = (proteseLabs || []).map(l => String(l.id) === String(id) ? { ...l, nome: nome.trim(), contato: contato.trim(), prazo_padrao_dias: (prazo != null && Number.isFinite(prazo)) ? prazo : null, ativo } : l);
            showToast('Laboratório atualizado com sucesso!');
        }

        const idEl = document.getElementById('proteseLabId');
        const nomeEl = document.getElementById('proteseLabNome');
        const contatoEl = document.getElementById('proteseLabContato');
        const prazoEl = document.getElementById('proteseLabPrazo');
        if (idEl) idEl.value = '';
        if (nomeEl) nomeEl.value = '';
        if (contatoEl) contatoEl.value = '';
        if (prazoEl) prazoEl.value = '';

        renderProteseLabsTable();
        fetchProteseFromUI();
    } catch (err) {
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao salvar laboratório: ${msg}`, true);
    }
}

async function ensureProteseLabsLoaded() {
    if (Array.isArray(proteseLabs) && proteseLabs.length) return;
    const { data, error } = await withTimeout(
        db.from('laboratorios_proteticos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('seqid', { ascending: true }),
        15000,
        'laboratorios_proteticos:ensure'
    );
    if (error) throw error;
    proteseLabs = Array.isArray(data) ? data : [];
}

async function ensureProteseOrdersLoaded() {
    if (Array.isArray(proteseOrders) && proteseOrders.length) return;
    const { data, error } = await withTimeout(
        db.from('ordens_proteticas')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('seqid', { ascending: false }),
        15000,
        'ordens_proteticas:ensure'
    );
    if (error) throw error;
    proteseOrders = Array.isArray(data) ? data : [];
}

function openProtesePayablesModal() {
    const modal = document.getElementById('modalProtesePayables');
    if (!modal) return;
    modal.classList.remove('hidden');
    fetchProtesePayablesFromUI();
}

async function fetchProtesePayablesFromUI() {
    const tbody = document.getElementById('protesePayablesBody');
    const empty = document.getElementById('protesePayablesEmpty');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
    if (empty) empty.classList.add('hidden');

    const statusVal = (document.getElementById('protesePayablesStatusFilter') || {}).value || '';
    const destVal = (document.getElementById('protesePayablesDestFilter') || {}).value || '';
    const q = String((document.getElementById('protesePayablesSearch') || {}).value || '').trim().toLowerCase();
    await fetchProtesePayables({ statusVal, destVal, q });
}

async function fetchProtesePayables({ statusVal, destVal, q }) {
    try {
        await ensureProteseOrdersLoaded();

        let payQ = db.from('protese_contas_pagar')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .order('vencimento', { ascending: true })
            .order('seqid', { ascending: false });
        if (statusVal) payQ = payQ.eq('status', statusVal);
        if (destVal) payQ = payQ.eq('destinatario_tipo', destVal);
        const { data, error } = await withTimeout(payQ, 15000, 'protese_contas_pagar');
        if (error) throw error;
        protesePayables = Array.isArray(data) ? data : [];

        const ordersById = new Map((proteseOrders || []).map(o => [String(o.id), o]));
        const budgetById = new Map((budgets || []).map(b => [String(b.id), b]));
        const patientById = new Map((patients || []).map(p => [String(p.id), p]));
        const labById = new Map((proteseLabs || []).map(l => [String(l.id), l]));
        const profById = new Map((professionals || []).map(p => [String(p.id), p]));

        let rows = protesePayables.slice();
        if (q) {
            rows = rows.filter(r => {
                const ord = ordersById.get(String(r.ordem_id || ''));
                const opSeq = ord ? String(ord.seqid || '') : '';
                const bud = ord ? budgetById.get(String(ord.orcamento_id || '')) : null;
                const orcSeq = bud ? String(bud.seqid || '') : '';
                const pac = ord ? patientById.get(String(ord.paciente_id || '')) : null;
                const pacNome = pac ? String(pac.nome || '') : '';
                const destNome = String(getProtesePayableDestName(r, labById, profById) || '');
                const hay = `${opSeq} ${orcSeq} ${pacNome} ${destNome}`.toLowerCase();
                return hay.includes(q);
            });
        }

        protesePayablesFilteredRows = rows.slice();
        renderProtesePayablesTable({ rows, ordersById, budgetById, patientById, labById, profById });
    } catch (err) {
        console.error('Erro ao carregar contas a pagar protética:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao carregar Contas a Pagar: ${msg}`, true);
        const tbody = document.getElementById('protesePayablesBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--danger-color);">Falha ao carregar. Verifique RLS/policies.</td></tr>';
    }
}

function getProtesePayableDestName(r, labById, profById) {
    if (!r) return '—';
    const t = String(r.destinatario_tipo || '');
    if (t === 'LABORATORIO') {
        const lab = labById.get(String(r.laboratorio_id || ''));
        return lab ? lab.nome : '—';
    }
    const p = profById.get(String(r.protetico_id || ''));
    return p ? p.nome : '—';
}

function renderProtesePayablesTable({ rows, ordersById, budgetById, patientById, labById, profById }) {
    const tbody = document.getElementById('protesePayablesBody');
    const empty = document.getElementById('protesePayablesEmpty');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    const canPay = can('financeiro', 'insert') || can('financeiro', 'update') || can('protese', 'update');

    rows.forEach(r => {
        const ord = ordersById.get(String(r.ordem_id || ''));
        const opSeq = ord ? `#${ord.seqid}` : '—';
        const bud = ord ? budgetById.get(String(ord.orcamento_id || '')) : null;
        const orcSeq = bud && bud.seqid != null ? `#${bud.seqid}` : '—';
        const pac = ord ? patientById.get(String(ord.paciente_id || '')) : null;
        const pacNome = pac ? String(pac.nome || '') : '—';
        const destNome = getProtesePayableDestName(r, labById, profById);
        const venc = r.vencimento ? String(r.vencimento) : '—';
        const val = Number(r.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const st = String(r.status || '—');
        const canMarkPaid = canPay && st === 'PENDENTE';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); font-weight:800;">${opSeq}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:center; font-weight:700;">${orcSeq}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${pacNome}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${destNome}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:center;">${venc}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:right; font-weight:800;">${val}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${st}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:center;">
                ${canMarkPaid ? `<button class="btn btn-sm btn-primary" onclick="openProtesePayablePay('${r.id}')"><i class="ri-check-line"></i> Pagar</button>` : '<span style="color: var(--text-muted);">—</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function printProtesePayablesReport() {
    const rows = Array.isArray(protesePayablesFilteredRows) ? protesePayablesFilteredRows : [];
    const ordersById = new Map((proteseOrders || []).map(o => [String(o.id), o]));
    const budgetById = new Map((budgets || []).map(b => [String(b.id), b]));
    const patientById = new Map((patients || []).map(p => [String(p.id), p]));
    const labById = new Map((proteseLabs || []).map(l => [String(l.id), l]));
    const profById = new Map((professionals || []).map(p => [String(p.id), p]));

    const statusVal = String((document.getElementById('protesePayablesStatusFilter') || {}).value || '');
    const destVal = String((document.getElementById('protesePayablesDestFilter') || {}).value || '');
    const q = String((document.getElementById('protesePayablesSearch') || {}).value || '').trim();

    const total = rows.reduce((acc, r) => acc + Number(r.valor || 0), 0);
    const byStatus = {};
    rows.forEach(r => {
        const st = String(r.status || '—');
        byStatus[st] = (byStatus[st] || 0) + 1;
    });
    const statusSummary = Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' | ') || '—';

    const tableRows = rows.length ? rows.map(r => {
        const ord = ordersById.get(String(r.ordem_id || ''));
        const opSeq = ord ? `#${ord.seqid}` : '—';
        const bud = ord ? budgetById.get(String(ord.orcamento_id || '')) : null;
        const orcSeq = bud && bud.seqid != null ? `#${bud.seqid}` : '—';
        const pac = ord ? patientById.get(String(ord.paciente_id || '')) : null;
        const pacNome = pac ? String(pac.nome || '') : '—';
        const destNome = getProtesePayableDestName(r, labById, profById);
        const venc = r.vencimento ? String(r.vencimento) : '—';
        const val = formatCurrencyBRL(Number(r.valor || 0));
        const st = String(r.status || '—');
        return `
            <tr>
                <td>${escapeHtml(opSeq)}</td>
                <td style="text-align:center;">${escapeHtml(orcSeq)}</td>
                <td>${escapeHtml(pacNome)}</td>
                <td>${escapeHtml(String(destNome || '—'))}</td>
                <td style="text-align:center;">${escapeHtml(venc)}</td>
                <td style="text-align:right; font-weight: 900;">${escapeHtml(val)}</td>
                <td>${escapeHtml(st)}</td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="7" style="text-align:center; padding: 14px; color:#6b7280;">Nenhum registro para os filtros.</td></tr>`;

    const destLabel = destVal === 'LABORATORIO' ? 'Laboratório' : (destVal === 'PROTETICO_INTERNO' ? 'Protético interno' : 'Todos');
    const statusLabel = statusVal || 'Todos';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Contas a Pagar Protética</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color:#111827; padding: 18px; }
    .header { border-bottom: 2px solid #0066cc; padding-bottom: 10px; margin-bottom: 10px; }
    .title { font-size: 16px; font-weight: 900; color:#0066cc; }
    .sub { color:#6b7280; margin-top: 6px; font-size: 12px; }
    .kpis { display:flex; gap: 14px; flex-wrap: wrap; margin: 10px 0; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; min-width: 180px; }
    .kpi label { display:block; font-size: 10px; color:#6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .kpi div { font-weight: 900; margin-top: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px; }
    th { background: #f9fafb; text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
    @media print { @page { size: A4 portrait; margin: 10mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Contas a Pagar Protética</div>
    <div class="sub">Unidade: <strong>${escapeHtml(String(currentEmpresaId || '—'))}</strong> • Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
    <div class="sub">Filtros • Status: <strong>${escapeHtml(statusLabel)}</strong> • Destinatário: <strong>${escapeHtml(destLabel)}</strong> • Busca: <strong>${escapeHtml(q || '—')}</strong></div>
  </div>

  <div class="kpis">
    <div class="kpi"><label>Registros</label><div>${rows.length}</div></div>
    <div class="kpi"><label>Total</label><div>${escapeHtml(formatCurrencyBRL(total))}</div></div>
    <div class="kpi"><label>Status</label><div style="font-size: 12px; font-weight: 700;">${escapeHtml(statusSummary)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 90px;">OP</th>
        <th style="width: 80px; text-align:center;">Orç.</th>
        <th>Paciente</th>
        <th>Destinatário</th>
        <th style="width: 90px; text-align:center;">Venc.</th>
        <th style="width: 120px; text-align:right;">Valor</th>
        <th style="width: 100px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=980,height=720');
    if (!w) { showToast('Habilite pop-ups para imprimir.', true); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
}

window.openProtesePayablePay = function (payableId) {
    const r = (protesePayables || []).find(x => String(x.id) === String(payableId));
    if (!r) {
        showToast('Conta a pagar não encontrada. Atualize a lista.', true);
        return;
    }
    currentProtesePayable = r;
    const modal = document.getElementById('modalProtesePayablePay');
    if (!modal) return;
    const idEl = document.getElementById('protesePayablePayId');
    const dtEl = document.getElementById('protesePayablePayData');
    const obsEl = document.getElementById('protesePayablePayObs');
    const refBox = document.getElementById('protesePayablePayRefContent');
    if (idEl) idEl.value = String(r.id);
    if (obsEl) obsEl.value = '';
    if (dtEl && !dtEl.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dtEl.value = `${yyyy}-${mm}-${dd}`;
    }
    if (refBox) refBox.textContent = 'Carregando referência...';

    (async () => {
        try {
            const ord = (proteseOrders || []).find(o => String(o.id) === String(r.ordem_id || ''));
            const bud = ord ? (budgets || []).find(b => String(b.id) === String(ord.orcamento_id || '')) : null;
            const pac = ord ? (patients || []).find(p => String(p.id) === String(ord.paciente_id || '')) : null;
            const opLabel = ord && ord.seqid != null ? `OP #${ord.seqid}` : 'OP —';
            const orcLabel = bud && bud.seqid != null ? `Orçamento #${bud.seqid}` : 'Orçamento —';
            const pacLabel = pac ? `Paciente: ${pac.nome}` : 'Paciente: —';

            let itemDesc = 'Item: —';
            const itemId = String(r.orcamento_item_id || (ord ? (ord.orcamento_item_id || '') : '') || '');
            if (itemId) {
                const { data: it, error: itErr } = await withTimeout(
                    db.from('orcamento_itens')
                        .select('id, servico_id')
                        .eq('empresa_id', currentEmpresaId)
                        .eq('id', itemId)
                        .limit(1),
                    15000,
                    'orcamento_itens:payref_item'
                );
                if (!itErr && Array.isArray(it) && it.length) {
                    const serv = (services || []).find(s => String(s.id) === String(it[0].servico_id || ''));
                    const name = serv ? String(serv.descricao || serv.nome || `Serviço ${serv.seqid || ''}`) : `Serviço ${it[0].servico_id || ''}`;
                    itemDesc = `Item: ${name}`;
                }
            }

            if (refBox) refBox.innerHTML = `
                <div>${opLabel} • ${orcLabel}</div>
                <div>${pacLabel}</div>
                <div>${itemDesc}</div>
            `;
        } catch (e) {
            if (refBox) refBox.textContent = 'Referência indisponível.';
        }
    })();
    modal.classList.remove('hidden');
};

async function confirmProtesePayablePayment() {
    if (!currentProtesePayable) return;
    if (String(currentProtesePayable.status || '') !== 'PENDENTE') {
        showToast('Somente pendentes podem ser pagos.', true);
        return;
    }

    const forma = (document.getElementById('protesePayablePayForma') || {}).value || '';
    const dataStr = (document.getElementById('protesePayablePayData') || {}).value || '';
    const obs = (document.getElementById('protesePayablePayObs') || {}).value || '';
    const payTs = dataStr ? `${dataStr}T12:00:00.000Z` : new Date().toISOString();

    try {
        const ord = (proteseOrders || []).find(o => String(o.id) === String(currentProtesePayable.ordem_id || ''));
        const bud = ord ? (budgets || []).find(b => String(b.id) === String(ord.orcamento_id || '')) : null;
        const refId = bud && bud.seqid != null ? Number(bud.seqid) : null;

        const destLabel = String(currentProtesePayable.destinatario_tipo || '') === 'LABORATORIO' ? 'Laboratório' : 'Protético';
        const destName = String(currentProtesePayable.destinatario_tipo || '') === 'LABORATORIO'
            ? ((proteseLabs || []).find(l => String(l.id) === String(currentProtesePayable.laboratorio_id || ''))?.nome || '—')
            : ((professionals || []).find(p => String(p.id) === String(currentProtesePayable.protetico_id || ''))?.nome || '—');

        const observacoes = [
            `[Prótese] ${destLabel}: ${destName}`,
            ord && ord.seqid != null ? `OP #${ord.seqid}` : null,
            bud && bud.seqid != null ? `Orç. #${bud.seqid}` : null,
            obs ? String(obs).trim() : null
        ].filter(Boolean).join(' | ');

        const tx = {
            paciente_id: null,
            tipo: 'DEBITO',
            categoria: 'PAGAMENTO',
            valor: Number(currentProtesePayable.valor || 0),
            data_transacao: payTs,
            forma_pagamento: forma || null,
            referencia_id: (refId != null && Number.isFinite(refId)) ? refId : null,
            observacoes,
            empresa_id: currentEmpresaId,
            criado_por: currentUser.id
        };
        const { data: txRow, error: txErr } = await withTimeout(
            db.from('financeiro_transacoes').insert(tx).select().single(),
            15000,
            'financeiro_transacoes:protese_pay'
        );
        if (txErr) throw txErr;

        const upd = {
            status: 'PAGO',
            pago_em: payTs,
            pago_por: currentUser.id,
            transacao_id: txRow.id
        };
        const { error: upErr } = await withTimeout(
            db.from('protese_contas_pagar')
                .update(upd)
                .eq('empresa_id', currentEmpresaId)
                .eq('id', currentProtesePayable.id),
            15000,
            'protese_contas_pagar:pay'
        );
        if (upErr) throw upErr;

        const modal = document.getElementById('modalProtesePayablePay');
        if (modal) modal.classList.add('hidden');
        currentProtesePayable = null;
        showToast('Pagamento registrado com sucesso!');
        fetchProtesePayablesFromUI();
    } catch (err) {
        console.error('Erro ao baixar conta a pagar protética:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Falha ao registrar pagamento: ${msg}`, true);
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
    updateCommTransferButtonState();
    updateCommAdvanceButtonState();
}

function getSelectedCommissionRows() {
    const ids = Array.from(selectedCommissionIds || []);
    return (commissionsList || []).filter(r => ids.includes(String(r.id)));
}

function updateCommTransferButtonState() {
    if (!btnCommTransfer) return;
    const rows = getSelectedCommissionRows();
    const hasPerm = isSuperAdmin || isAdminRole() || can('comissoes', 'update');
    if (!hasPerm) {
        btnCommTransfer.disabled = true;
        return;
    }
    if (!rows.length) {
        btnCommTransfer.disabled = true;
        return;
    }
    btnCommTransfer.disabled = false;
}

function updateCommAdvanceButtonState() {
    if (!btnCommAdvance) return;
    const rows = getSelectedCommissionRows();
    const hasPerm = isSuperAdmin || isAdminRole() || can('comissoes', 'update');
    if (!hasPerm || !rows.length) {
        btnCommAdvance.disabled = true;
        return;
    }
    const hasPaid = rows.some(r => String(r.status || '').toUpperCase() === 'PAGA');
    btnCommAdvance.disabled = hasPaid;
}

function getProfessionalNameBySeqId(seqId) {
    const p = (professionals || []).find(x => String(x.seqid) === String(seqId));
    return p ? p.nome : `Profissional #${seqId}`;
}

function getCommissionStatusesForFilter(v) {
    if (v === 'A_PAGAR') return ['PENDENTE', 'GERADA'];
    if (v === 'ANTECIPADAS') return ['ANTECIPADA'];
    if (v === 'PAGAS') return ['PAGA'];
    if (v === 'TRANSFERIDAS') return ['ESTORNADA', 'TRANSFERIDA'];
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

function getCommissionDateForFilter(r, statusVal) {
    if (!r) return null;
    if (statusVal === 'PAGAS') return r.data_pagamento || r.data_geracao || r.created_at || null;
    if (statusVal === 'TRANSFERIDAS') return r.estornado_em || r.data_geracao || r.created_at || null;
    return r.data_geracao || r.created_at || null;
}

async function enrichCommissionsItems(rows) {
    try {
        const itemIds = Array.from(new Set((rows || []).map(r => r.item_id).filter(Boolean).map(String)));
        if (!itemIds.length) return;

        const itemToServico = new Map();
        const itemToOrcamento = new Map();
        const chunkSize = 200;
        for (let i = 0; i < itemIds.length; i += chunkSize) {
            const chunk = itemIds.slice(i, i + chunkSize);
            const q = db.from('orcamento_itens').select('id, servico_id, orcamento_id').in('id', chunk);
            const { data, error } = await withTimeout(q, 15000, 'orcamento_itens');
            if (error) throw error;
            (data || []).forEach(it => {
                itemToServico.set(String(it.id), String(it.servico_id));
                itemToOrcamento.set(String(it.id), String(it.orcamento_id || ''));
            });
        }

        (rows || []).forEach(r => {
            const sid = itemToServico.get(String(r.item_id || ''));
            if (!sid) return;
            r._servicoId = sid;
            const serv = (services || []).find(s => String(s.id) === String(sid));
            r._itemDescricao = serv ? serv.descricao : `Serviço ${sid}`;

            const oid = itemToOrcamento.get(String(r.item_id || ''));
            if (oid) {
                r._orcamentoId = oid;
                const b = (budgets || []).find(x => String(x.id) === String(oid));
                if (b && b.seqid != null) r._orcamentoSeqid = b.seqid;
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
        if (currentEmpresaId) {
            query = query.eq('empresa_id', currentEmpresaId);
        }
        if (profId) {
            query = query.eq('profissional_id', Number(profId));
        }
        if (statuses && statuses.length) {
            query = query.in('status', statuses);
        }

        const { data, error } = await withTimeout(query, 15000, 'financeiro_comissoes');
        if (error) throw error;

        commissionsList = Array.isArray(data) ? data : [];
        if (start || end) {
            const startMs = start ? new Date(`${start}T00:00:00`).getTime() : null;
            const endMs = end ? new Date(`${end}T23:59:59`).getTime() : null;
            commissionsList = commissionsList.filter(r => {
                const raw = (statusVal === 'PAGAS')
                    ? (r && (r.data_pagamento || r.data_geracao || r.created_at))
                    : (statusVal === 'TRANSFERIDAS')
                        ? (r && (r.estornado_em || r.data_geracao || r.created_at))
                        : (r && (r.data_geracao || r.created_at));
                if (!raw) return false;
                const t = new Date(raw).getTime();
                if (!Number.isFinite(t)) return false;
                if (startMs != null && t < startMs) return false;
                if (endMs != null && t > endMs) return false;
                return true;
            });
        }
        if (window.__dpDebug && window.__dpDebug.enabled) {
            window.__dpDebug.lastStep = `comissoes: rendered`;
            window.__dpDebug.lastDataLen = commissionsList.length;
        }

        await enrichCommissionsItems(commissionsList);
        renderCommissionsTable(commissionsList, statusVal);
    } catch (err) {
        console.error('Erro ao carregar comissões:', err);
        if (commissionsTableBody) {
            commissionsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--danger-color);">Falha ao carregar Comissões. Verifique RLS/policies.</td></tr>';
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
    updateCommTransferButtonState();

    rows.forEach(r => {
        const id = String(r.id);
        const dt = r.data_geracao ? formatDateTime(r.data_geracao) : '-';
        const prof = getProfessionalNameBySeqId(r.profissional_id);
        const orcSeq = r._orcamentoSeqid != null ? String(r._orcamentoSeqid) : '';
        const item = getCommissionItemLabel(r);
        const val = Number(r.valor_comissao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const status = String(r.status || '-');
        const checked = selectedCommissionIds.has(id) ? 'checked' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="comm-check" data-id="${id}" ${checked}>
            </td>
            <td>${dt}</td>
            <td style="font-weight: 600;">${prof}</td>
            <td style="text-align:center; font-weight:700;">${orcSeq ? `#${orcSeq}` : '-'}</td>
            <td>${item}</td>
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

async function markSelectedCommissionsAdvanced() {
    if (!can('comissoes', 'update')) {
        showToast('Você não possui permissão para antecipar comissões.', true);
        return;
    }

    const rows = getSelectedCommissionRows();
    if (!rows.length) {
        showToast('Selecione pelo menos uma comissão.', true);
        return;
    }

    const toAdvance = rows.filter(r => String(r.status || '').toUpperCase() !== 'PAGA' && String(r.status || '').toUpperCase() !== 'TRANSFERIDA' && String(r.status || '').toUpperCase() !== 'ESTORNADA');
    if (!toAdvance.length) {
        showToast('Nenhuma comissão selecionada pode ser antecipada.', true);
        return;
    }

    try {
        const itemIds = Array.from(new Set(toAdvance.map(r => r.item_id).filter(Boolean).map(String)));
        if (itemIds.length) {
            let q = db.from('orcamento_itens').select('id,status').in('id', itemIds);
            if (!isSuperAdmin && currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
            const { data, error } = await withTimeout(q, 15000, 'orcamento_itens:status_for_comm_advance');
            if (error) throw error;
            const statusDone = new Set(['finalizado', 'executado', 'atendido']);
            const doneIds = (data || [])
                .filter(it => statusDone.has(String(it.status || '').trim().toLowerCase()))
                .map(it => String(it.id));
            if (doneIds.length) {
                showToast('Existem comissões de serviços já realizados. Use "Marcar como Pago" (não antecipar).', true);
                return;
            }
        }
    } catch (e) {
        showToast('Não foi possível validar se o serviço foi realizado. Use "Marcar como Pago" se já foi feito.', true);
        return;
    }

    const obsRaw = prompt('Observação da antecipação (opcional):', '') || '';
    const nowIso = new Date().toISOString();
    const receiptId = genUuid();
    const payloadFull = {
        status: 'ANTECIPADA',
        data_pagamento: nowIso,
        pago_por: currentUser?.id || null,
        recibo_id: receiptId,
        observacoes: obsRaw
    };
    const payloadFallback = { status: 'ANTECIPADA', data_pagamento: nowIso, pago_por: currentUser?.id || null };

    const ids = toAdvance.map(r => r.id);
    if (!confirm(`Confirmar antecipação de ${ids.length} comissão(ões)?`)) return;

    if (btnCommAdvance) btnCommAdvance.disabled = true;
    try {
        try {
            let q = db.from('financeiro_comissoes').update(payloadFull).in('id', ids);
            if (!isSuperAdmin && currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
            const { error } = await withTimeout(q, 15000, 'financeiro_comissoes:advance');
            if (error) throw error;
        } catch (e1) {
            let q2 = db.from('financeiro_comissoes').update(payloadFallback).in('id', ids);
            if (!isSuperAdmin && currentEmpresaId) q2 = q2.eq('empresa_id', currentEmpresaId);
            const { error: e2 } = await withTimeout(q2, 15000, 'financeiro_comissoes:advance2');
            if (e2) throw e2;
        }

        showToast('Comissões antecipadas.');
        resetCommissionSelection();
        await fetchCommissionsFromUI();

        const printed = (commissionsList || []).filter(r => ids.includes(String(r.id)));
        printCommissionReceipt({ rows: printed, mode: 'ANTECIPACAO' });
    } catch (err) {
        console.error('Erro ao antecipar comissões:', err);
        showToast('Erro ao antecipar comissões.', true);
    } finally {
        if (btnCommAdvance) btnCommAdvance.disabled = false;
        updateCommAdvanceButtonState();
    }
}

function openCommTransferModalFromSelection() {
    if (!commTransferModal || !commTransferNewProfessional || !commTransferObs) return;
    if (!(isSuperAdmin || isAdminRole() || can('comissoes', 'update'))) {
        showToast('Você não possui permissão para transferir comissões.', true);
        return;
    }
    const rows = getSelectedCommissionRows();
    if (!rows.length) {
        showToast('Selecione pelo menos uma comissão.', true);
        return;
    }
    const allNotPaid = rows.every(r => String(r.status || '').toUpperCase() !== 'PAGA');
    if (!allNotPaid) {
        showToast('Não é possível transferir comissões já pagas.', true);
        return;
    }
    const firstProf = String(rows[0].profissional_id || '');
    const sameProf = rows.every(r => String(r.profissional_id || '') === firstProf);
    if (!sameProf) {
        showToast('Selecione comissões do mesmo profissional para transferir.', true);
        return;
    }

    const total = rows.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);
    const profName = getProfessionalNameBySeqId(firstProf);
    if (commTransferSummary) {
        commTransferSummary.textContent = `${rows.length} comissão(ões) • ${profName} • ${Number(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }

    const opts = ['<option value="">Selecione...</option>'];
    (professionals || [])
        .slice()
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
        .forEach(p => {
            if (String(p.seqid) === String(firstProf)) return;
            opts.push(`<option value="${p.seqid}">${escapeHtml(p.nome || '')}</option>`);
        });
    commTransferNewProfessional.innerHTML = opts.join('');
    commTransferNewProfessional.value = '';
    commTransferObs.value = '';

    commTransferModal.classList.remove('hidden');
}

function closeCommTransferModal() {
    if (commTransferModal) commTransferModal.classList.add('hidden');
}

function genUuid() {
    try {
        if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch {}
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

async function transferSelectedCommissionsToProfessional() {
    if (!(isSuperAdmin || isAdminRole() || can('comissoes', 'update'))) {
        showToast('Você não possui permissão para transferir comissões.', true);
        return;
    }
    const rows = getSelectedCommissionRows();
    if (!rows.length) { showToast('Selecione pelo menos uma comissão.', true); return; }
    const firstProf = String(rows[0].profissional_id || '');
    const sameProf = rows.every(r => String(r.profissional_id || '') === firstProf);
    if (!sameProf) { showToast('Selecione comissões do mesmo profissional para transferir.', true); return; }
    const allNotPaid = rows.every(r => String(r.status || '').toUpperCase() !== 'PAGA');
    if (!allNotPaid) { showToast('Não é possível transferir comissões já pagas.', true); return; }

    const newProf = commTransferNewProfessional ? String(commTransferNewProfessional.value || '') : '';
    const obs = commTransferObs ? String(commTransferObs.value || '').trim() : '';
    if (!newProf) { showToast('Selecione o novo profissional.', true); return; }
    if (!obs) { showToast('Informe uma observação.', true); return; }

    const oldProfName = getProfessionalNameBySeqId(firstProf);
    const newProfName = getProfessionalNameBySeqId(newProf);
    const note = `TRANSFERÊNCIA: ${oldProfName} -> ${newProfName}. ${obs}`;
    const nowIso = new Date().toISOString();
    const groupId = genUuid();
    const ids = rows.map(r => r.id);

    if (btnCommTransferConfirm) btnCommTransferConfirm.disabled = true;
    try {
        const payloadFull = { status: 'TRANSFERIDA', observacoes: note, estornado_em: nowIso, estornado_por: currentUser?.id || null, transfer_group_id: groupId };
        const payloadFallback = { status: 'TRANSFERIDA', observacoes: note };
        const payloadMin = { status: 'TRANSFERIDA' };

        try {
            let q = db.from('financeiro_comissoes').update(payloadFull).in('id', ids);
            if (!isSuperAdmin && currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
            const { error } = await withTimeout(q, 15000, 'financeiro_comissoes:transfer:update');
            if (error) throw error;
        } catch (e1) {
            try {
                let q2 = db.from('financeiro_comissoes').update(payloadFallback).in('id', ids);
                if (!isSuperAdmin && currentEmpresaId) q2 = q2.eq('empresa_id', currentEmpresaId);
                const { error: e2 } = await withTimeout(q2, 15000, 'financeiro_comissoes:transfer:update2');
                if (e2) throw e2;
            } catch (e2) {
                let q3 = db.from('financeiro_comissoes').update(payloadMin).in('id', ids);
                if (!isSuperAdmin && currentEmpresaId) q3 = q3.eq('empresa_id', currentEmpresaId);
                const { error: e3 } = await withTimeout(q3, 15000, 'financeiro_comissoes:transfer:update3');
                if (e3) throw e3;
            }
        }

        const insertFull = rows.map(r => ({
            empresa_id: currentEmpresaId,
            profissional_id: Number(newProf),
            item_id: r.item_id || null,
            valor_comissao: Number(r.valor_comissao || 0),
            status: 'GERADA',
            data_geracao: r.data_geracao || nowIso,
            observacoes: note,
            criado_por: currentUser?.id || null,
            transfer_group_id: groupId
        }));
        const insertFallback = rows.map(r => ({
            empresa_id: currentEmpresaId,
            profissional_id: Number(newProf),
            item_id: r.item_id || null,
            valor_comissao: Number(r.valor_comissao || 0),
            status: 'GERADA'
        }));

        try {
            const { error } = await withTimeout(db.from('financeiro_comissoes').insert(insertFull), 15000, 'financeiro_comissoes:transfer:insert');
            if (error) throw error;
        } catch (eIns) {
            const { error: e2 } = await withTimeout(db.from('financeiro_comissoes').insert(insertFallback), 15000, 'financeiro_comissoes:transfer:insert2');
            if (e2) throw e2;
        }

        showToast('Transferência de comissão registrada.');
        closeCommTransferModal();
        resetCommissionSelection();
        await fetchCommissionsFromUI();
    } catch (err) {
        console.error('Erro ao transferir comissões:', err);
        const code = err && err.code ? String(err.code) : '';
        const msg = err && err.message ? String(err.message) : 'Falha ao transferir comissões.';
        const details = err && err.details ? String(err.details) : '';
        const hint = err && err.hint ? String(err.hint) : '';
        const full = [msg, details, hint].filter(Boolean).join(' ');
        showToast(code ? `Falha ao transferir comissões (${code}): ${full}` : `Falha ao transferir comissões: ${full}`, true);
    } finally {
        if (btnCommTransferConfirm) btnCommTransferConfirm.disabled = false;
    }
}

function printCommissionReceipt(opts = null) {
    const mode = opts && typeof opts === 'object' ? String(opts.mode || '') : '';
    const rows = (opts && typeof opts === 'object' && Array.isArray(opts.rows))
        ? opts.rows
        : (commissionsList || []).filter(r => Array.from(selectedCommissionIds).includes(String(r.id)));
    if (!rows.length) {
        showToast('Selecione pelo menos uma comissão para imprimir.', true);
        return;
    }

    const empresaLabel = getEmpresaName(currentEmpresaId);
    const start = commStart ? commStart.value : '';
    const end = commEnd ? commEnd.value : '';
    const periodLabel = (start && end) ? `${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}` : '';

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
        const total = list.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);
        const totalFmt = Number(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const pageBreak = idx < (entries.length - 1) ? 'page-break-after: always;' : '';

        const rowsHtml = list.map(r => {
            const dt = r.data_geracao ? formatDateTime(r.data_geracao) : '-';
            const orcSeq = r && r._orcamentoSeqid != null ? String(r._orcamentoSeqid) : '';
            const item = getCommissionItemLabel(r);
            const val = Number(r.valor_comissao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return `<tr style="border-bottom: 1px solid #000;">
                <td style="padding: 6px 8px;">${dt}</td>
                <td style="padding: 6px 8px; text-align:center; font-weight:700;">${orcSeq ? `#${orcSeq}` : '-'}</td>
                <td style="padding: 6px 8px;">${item}</td>
                <td style="padding: 6px 8px; text-align:right; font-weight:700;">${val}</td>
            </tr>`;
        }).join('');

        const isAdvance = mode === 'ANTECIPACAO' || list.every(r => String(r.status || '').toUpperCase() === 'ANTECIPADA');
        const headerTitle = isAdvance ? 'RECIBO DE ANTECIPAÇÃO DE COMISSÃO' : 'RECIBO DE COMISSÃO';
        const payLabel = isAdvance ? 'Antecipado em' : 'Pago em';
        const payDtRaw = list.find(r => r.data_pagamento)?.data_pagamento || null;
        const payDt = payDtRaw ? formatDateTime(payDtRaw) : formatDateTime(new Date().toISOString());
        const receiptId = String(list.find(r => r.recibo_id)?.recibo_id || '');
        const operatorName = currentUser?.email ? String(currentUser.email) : '';

        parts.push(`
            <div class="term-print-container" style="${pageBreak}">
                <div class="term-header">
                    <div style="font-size: 22px; font-weight: bold; color: #000;">${headerTitle}</div>
                    <div style="margin-top: 6px; text-align:center; line-height:1.05;">
                        <div style="font-weight:800;">${empresaLabel}</div>
                        <div style="font-size:12px; font-weight:600; color:#6b7280; margin-top:2px;">Emitido via OCC - Odonto Connect Cloud</div>
                    </div>
                </div>

                <div style="margin: 18px 0;">
                    <p><strong>Profissional:</strong> ${profName}</p>
                    ${periodLabel ? `<p><strong>Período:</strong> ${periodLabel}</p>` : ''}
                    <p><strong>${payLabel}:</strong> ${payDt}</p>
                    ${receiptId ? `<p><strong>Recibo:</strong> ${escapeHtml(receiptId)}</p>` : ''}
                    ${operatorName ? `<p><strong>Operador:</strong> ${escapeHtml(operatorName)}</p>` : ''}
                </div>

                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
                    <thead>
                        <tr style="border-bottom: 1px solid #000;">
                            <th style="padding: 8px; text-align:left;">Data</th>
                            <th style="padding: 8px; text-align:center;">Orç. #</th>
                            <th style="padding: 8px; text-align:left;">Item</th>
                            <th style="padding: 8px; text-align:right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align:right; font-weight:800;">Total</td>
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

async function printCommissionsReportFromUI() {
    if (!(isSuperAdmin || isAdminRole() || can('comissoes', 'select'))) {
        showToast('Você não possui permissão para acessar Comissões.', true);
        return;
    }

    await fetchCommissionsFromUI();

    const statusVal = commStatus ? String(commStatus.value || '') : '';
    const statusLabel = (commStatus && commStatus.options && commStatus.selectedIndex >= 0)
        ? String(commStatus.options[commStatus.selectedIndex].text || statusVal || '—')
        : (statusVal || '—');
    const start = commStart ? String(commStart.value || '') : '';
    const end = commEnd ? String(commEnd.value || '') : '';
    const profId = commProfessional ? String(commProfessional.value || '') : '';
    const profLabel = profId ? getProfessionalNameBySeqId(profId) : 'Todos os profissionais';

    const list = (commissionsList || []).slice();
    const total = list.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);

    const grouped = new Map();
    list.forEach(r => {
        const profName = getProfessionalNameBySeqId(r.profissional_id);
        if (!grouped.has(profName)) grouped.set(profName, []);
        grouped.get(profName).push(r);
    });

    const groups = Array.from(grouped.entries())
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR'));

    const dateColLabel = statusVal === 'PAGAS' ? 'Data de Pagamento' : (statusVal === 'TRANSFERIDAS' ? 'Data do Estorno' : 'Data de Geração');
    const humanStart = start ? start.split('-').reverse().join('/') : '—';
    const humanEnd = end ? end.split('-').reverse().join('/') : '—';

    const sections = groups.map(([profName, rows]) => {
        const sorted = rows.slice().sort((a, b) => {
            const da = new Date(getCommissionDateForFilter(a, statusVal) || 0).getTime();
            const dbb = new Date(getCommissionDateForFilter(b, statusVal) || 0).getTime();
            return (Number.isFinite(da) ? da : 0) - (Number.isFinite(dbb) ? dbb : 0);
        });
        const subTotal = sorted.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);

        const trs = sorted.map(r => {
            const dt = getCommissionDateForFilter(r, statusVal);
            const dtLabel = dt ? formatDateTime(dt) : '-';
            const orcSeq = (r._orcamentoSeqid != null) ? String(r._orcamentoSeqid) : (r.orcamento_seqid != null ? String(r.orcamento_seqid) : '');
            const item = getCommissionItemLabel(r);
            const val = formatCurrencyBRL(Number(r.valor_comissao || 0));
            const st = String(r.status || '-');
            return `
                <tr>
                    <td style="width: 140px;">${escapeHtml(dtLabel)}</td>
                    <td style="width: 90px; text-align:center;">${orcSeq ? `#${escapeHtml(orcSeq)}` : '-'}</td>
                    <td>${escapeHtml(item)}</td>
                    <td style="width: 130px;">${escapeHtml(st)}</td>
                    <td style="width: 140px; text-align:right; font-weight: 900;">${escapeHtml(val)}</td>
                </tr>
            `;
        }).join('') + `
            <tr>
                <td colspan="4" style="text-align:right; font-weight: 900;">SUBTOTAL (${sorted.length})</td>
                <td style="text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(subTotal))}</td>
            </tr>
        `;

        return `
            <div style="margin-top: 14px;">
                <div style="font-weight: 900; font-size: 13px; margin: 10px 0 6px;">${escapeHtml(profName)}</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 140px;">${escapeHtml(dateColLabel)}</th>
                            <th style="width: 90px; text-align:center;">Orc. #</th>
                            <th>Item</th>
                            <th style="width: 130px;">Status</th>
                            <th style="width: 140px; text-align:right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>${trs}</tbody>
                </table>
            </div>
        `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comissões - ${humanStart} a ${humanEnd}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color:#111827; padding: 24px; }
    .header { border-bottom: 2px solid #0066cc; padding-bottom: 12px; margin-bottom: 14px; }
    .title { font-size: 16px; font-weight: 900; color:#0066cc; }
    .sub { color:#6b7280; margin-top: 4px; font-size: 11px; }
    .kpis { display:flex; gap: 14px; flex-wrap: wrap; margin: 12px 0 14px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; min-width: 170px; }
    .kpi label { display:block; font-size: 10px; color:#6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .kpi div { font-weight: 900; margin-top: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px; }
    th { background: #f9fafb; text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
    .footer { margin-top: 16px; font-size: 10px; color:#9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align:center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Comissões</div>
    <div class="sub">Status: <strong>${escapeHtml(statusLabel)}</strong> • Período: <strong>${escapeHtml(humanStart)}</strong> a <strong>${escapeHtml(humanEnd)}</strong></div>
    <div class="sub">Profissional: <strong>${escapeHtml(profLabel)}</strong> • Unidade: ${escapeHtml(String(currentEmpresaId || '—'))}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><label>Registros</label><div>${list.length}</div></div>
    <div class="kpi"><label>Total</label><div>${escapeHtml(formatCurrencyBRL(total))}</div></div>
    <div class="kpi"><label>Profissionais</label><div>${groups.length}</div></div>
  </div>

  ${sections}

  <div style="margin-top: 14px;">
    <table>
      <tbody>
        <tr>
          <td style="text-align:right; font-weight: 900;">TOTAL GERAL (${list.length})</td>
          <td style="width: 160px; text-align:right; font-weight: 900;">${escapeHtml(formatCurrencyBRL(total))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">Documento interno • Comissões</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=980,height=720');
    if (!win) { showToast('Habilite pop-ups para imprimir.', true); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
}

if (btnCommSearch) btnCommSearch.addEventListener('click', () => fetchCommissionsFromUI());
if (btnCommPay) btnCommPay.addEventListener('click', () => markSelectedCommissionsPaid());
if (btnCommAdvance) btnCommAdvance.addEventListener('click', () => markSelectedCommissionsAdvanced());
if (btnCommTransfer) btnCommTransfer.addEventListener('click', () => openCommTransferModalFromSelection());
if (btnCommPrint) btnCommPrint.addEventListener('click', () => printCommissionReceipt());
if (btnCommPrintReport) btnCommPrintReport.addEventListener('click', () => printCommissionsReportFromUI());
if (commStatus) commStatus.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
if (commProfessional) commProfessional.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
if (commStart) commStart.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
if (commEnd) commEnd.addEventListener('change', () => { resetCommissionSelection(); fetchCommissionsFromUI(); });
if (commSelectAll) commSelectAll.addEventListener('change', (e) => {
    if (!e.target.checked) {
        resetCommissionSelection();
        renderCommissionsTable(commissionsList, commStatus ? commStatus.value : 'A_PAGAR');
        return;
    }
    (commissionsList || []).forEach(r => selectedCommissionIds.add(String(r.id)));
    renderCommissionsTable(commissionsList, commStatus ? commStatus.value : 'A_PAGAR');
});

if (btnCommTransferCancel) btnCommTransferCancel.addEventListener('click', closeCommTransferModal);
if (btnCommTransferConfirm) btnCommTransferConfirm.addEventListener('click', transferSelectedCommissionsToProfessional);

// Global action to delete user mapping
window.removeTenantUser = async function (usuario_id) {
    if (confirm('Não é possível excluir este registro pois ele possui movimentações vinculadas. Sugerimos apenas inativar.\n\nSe este usuário NÃO tiver movimentações, você pode continuar para revogar o acesso.\n\nDeseja prosseguir?')) {
        try {
            const empId = arguments.length > 1 ? arguments[1] : null;
            const targetEmpresaId = empId || currentEmpresaId;
            const { error, count } = await db
                .from('usuario_empresas')
                .delete({ count: 'exact' })
                .eq('usuario_id', usuario_id)
                .eq('empresa_id', targetEmpresaId);
            if (error) throw error;
            if (Number(count || 0) === 0) {
                try {
                    const { data: { session } } = await db.auth.getSession();
                    if (!session) throw new Error("Sessão expirada.");
                    const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
                    const resp = await fetch(`${baseUrl}/functions/v1/delete-tenant-user`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                            'apikey': supabaseKey
                        },
                        body: JSON.stringify({
                            usuario_id: usuario_id,
                            empresa_id: targetEmpresaId
                        })
                    });
                    const result = await resp.json();
                    if (!resp.ok) {
                        const errorMsg = result.error || result.message || 'Erro desconhecido na nuvem.';
                        throw new Error(`Erro na nuvem: ${errorMsg}`);
                    }
                } catch (cloudErr) {
                    const msg = cloudErr && cloudErr.message ? cloudErr.message : String(cloudErr);
                    showToast(`Nenhuma alteração feita no banco. ${msg}`, true);
                    return;
                }
            }
            showToast('Acesso revogado com sucesso!');
            showList('usersAdmin'); // refresh table
        } catch (error) {
            console.error("Error revoking user access:", error);
            const code = error && error.code ? String(error.code) : '-';
            const msg = error && error.message ? String(error.message) : 'Erro desconhecido';
            if (msg.toLowerCase().includes('movimenta') || msg.toLowerCase().includes('vinculad')) {
                showToast('Não é possível excluir este registro pois ele possui movimentações vinculadas. Sugerimos apenas inativar.', true);
            } else {
                showToast(`Erro ao remover usuário (${code}): ${msg}`, true);
            }
        }
    }
};

window.editTenantUser = async function (usuario_id, empresa_id) {
    const empId = empresa_id || '';
    const resolveUserId = (x) => (x && (x.usuario_id || x.user_id)) ? String(x.usuario_id || x.user_id) : '';
    let u = usersAdminList.find(user => resolveUserId(user) === String(usuario_id) && String(user.empresa_id || '') === String(empId))
        || usersAdminList.find(user => resolveUserId(user) === String(usuario_id));
    if (!u) {
        try {
            const targetEmpresaId = empId || currentEmpresaId;
            const tryByUsuarioId = async () => {
                const q = db.from('usuario_empresas')
                    .select('*')
                    .eq('empresa_id', targetEmpresaId)
                    .eq('usuario_id', usuario_id)
                    .maybeSingle();
                return await withTimeout(q, 15000, 'usuario_empresas:edit_lookup1');
            };
            const tryByUserId = async () => {
                const q = db.from('usuario_empresas')
                    .select('*')
                    .eq('empresa_id', targetEmpresaId)
                    .eq('user_id', usuario_id)
                    .maybeSingle();
                return await withTimeout(q, 15000, 'usuario_empresas:edit_lookup2');
            };

            let res1 = await tryByUsuarioId();
            if (res1 && res1.error && String(res1.error.message || '').toLowerCase().includes('usuario_id')) {
                res1 = { data: null, error: null };
            }
            if (res1.error) throw res1.error;
            if (res1.data) {
                u = res1.data;
            } else {
                const res2 = await tryByUserId();
                if (res2.error) throw res2.error;
                if (res2.data) u = res2.data;
            }
        } catch (err) {
            const code = err && err.code ? String(err.code) : '-';
            const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
            showToast(`Não foi possível abrir edição (${code}): ${msg}`, true);
            return;
        }
    }
    if (!u) {
        showToast('Usuário não encontrado para edição. Recarregue a lista.', true);
        return;
    }

    showForm(true, 'usersAdmin');
    document.getElementById('userAdminFormTitle').innerText = 'Editar Usuário';
    document.getElementById('editAdminUserId').value = resolveUserId(u);
    const empresaHidden = document.getElementById('editAdminEmpresaId');
    if (empresaHidden) empresaHidden.value = String(u.empresa_id || empId || currentEmpresaId || '');

    const emailInput = document.getElementById('adminUserEmail');
    emailInput.value = u.user_email || '';
    emailInput.readOnly = true;
    emailInput.classList.add('readonly-input');

    const passInput = document.getElementById('adminUserPassword');
    passInput.required = false;
    passInput.placeholder = '(Deixe em branco para manter a atual)';

    document.getElementById('adminUserRole').value = normalizeRole(u.perfil) || '';

    // Load permissions
    const perms = (u.permissoes && typeof u.permissoes === 'object') ? u.permissoes : {};
    renderPermissionsGrid(perms);
    if (normalizeRole(u.perfil) === 'admin') {
        applyAdminFullPermissionsToGrid();
    }
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
                opts.push(`<option value="${p.seqid}">${escapeHtml(p.nome || '')}</option>`);
            });
        agendaProfessional.innerHTML = opts.join('');
    }

    if (agendaProfessional) {
        const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const applyLock = (prof) => {
            const tipo = prof ? norm(prof.tipo) : '';
            const allowed = tipo.startsWith('clinico') || tipo.startsWith('especialista') || tipo.startsWith('protetico');
            if (prof && allowed && prof.seqid != null) {
                agendaProfessional.value = String(prof.seqid);
                agendaProfessional.disabled = true;
                return true;
            }
            return false;
        };

        const uEmail = norm(currentUser && currentUser.email ? currentUser.email : '');
        const uId = String(currentUser && currentUser.id ? currentUser.id : '').trim();

        const localProf = (professionals || []).find(p => {
            if (!p) return false;
            const candidates = [
                norm(p.email),
                norm(p.user_email),
                norm(p.usuario_email),
                norm(p.login_email),
            ].filter(Boolean);
            if (uEmail && candidates.includes(uEmail)) return true;
            const pid = String(p.usuario_id || p.user_id || '').trim();
            if (uId && pid && pid === uId) return true;
            return false;
        });

        const lockedByLocal = applyLock(localProf);
        if (!lockedByLocal) {
            agendaProfessional.disabled = false;
            if (currentEmpresaId && uId && db) {
                (async () => {
                    try {
                        const q = db.from('profissional_usuarios')
                            .select('profissional_id')
                            .eq('empresa_id', currentEmpresaId)
                            .eq('usuario_id', uId)
                            .limit(1);
                        const { data, error } = await withTimeout(q, 15000, 'agenda:profissional_usuarios');
                        if (error) throw error;
                        const row = Array.isArray(data) ? data[0] : null;
                        const profId = row && row.profissional_id ? String(row.profissional_id) : '';
                        if (!profId) return;
                        const prof = (professionals || []).find(p => String(p && p.id || '') === profId) || null;
                        if (applyLock(prof)) {
                            try { await fetchAgendaForUI(); } catch { }
                        }
                    } catch { }
                })();
            }
        }
    }

    if (agendaPaciente) {
        const opts = ['<option value="">(Sem paciente)</option>'];
        (patients || [])
            .slice()
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
            .forEach(p => {
                const label = `${p.nome}${p.cpf ? ` (${p.cpf})` : ''}`;
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

    const bDay = document.getElementById('btnAgendaPrintDay');
    const bWeek = document.getElementById('btnAgendaPrintWeek');
    const bWeekAppts = document.getElementById('btnAgendaPrintWeekAppts');
    const bWeekC = document.getElementById('btnAgendaPrintWeekCompact');
    if (bDay && !bDay.__agendaBound) { bDay.addEventListener('click', printAgendaDayFromUI); bDay.disabled = false; bDay.__agendaBound = true; }
    if (bWeekAppts && !bWeekAppts.__agendaBound) { bWeekAppts.addEventListener('click', printAgendaWeekAppointmentsFromUI); bWeekAppts.disabled = false; bWeekAppts.__agendaBound = true; }
    if (bWeek && !bWeek.__agendaBound) { bWeek.addEventListener('click', () => printAgendaWeekFromUI(false)); bWeek.disabled = false; bWeek.__agendaBound = true; }
    if (bWeekC && !bWeekC.__agendaBound) { bWeekC.addEventListener('click', () => printAgendaWeekFromUI(true)); bWeekC.disabled = false; bWeekC.__agendaBound = true; }
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

async function getNextOrcamentoSeqIdForEmpresa(empresaId) {
    if (!empresaId) return getNextSeqId(budgets);
    const q = db.from('orcamentos')
        .select('seqid')
        .eq('empresa_id', empresaId)
        .order('seqid', { ascending: false })
        .limit(1);
    const { data, error } = await withTimeout(q, 15000, 'orcamentos:max_seqid');
    if (error) throw error;
    const maxSeq = data && data[0] && data[0].seqid != null ? Number(data[0].seqid) : 0;
    return (Number.isFinite(maxSeq) ? maxSeq : 0) + 1;
}

async function fetchAgendaForUI() {
    if (!agendaProfessional || !agendaDate) return;
    const profSeqId = agendaProfessional.value;
    const dateStr = agendaDate.value;
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
        const pacienteNome = a ? (getPacienteNameBySeqId(a.paciente_id) || (a.titulo || '')) : '';
        const status = a ? String(a.status || 'MARCADO') : 'LIVRE';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${s.time}</td>
            <td>${a ? (pacienteNome || a.titulo || '-') : '-'}</td>
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

    const payload = {
        empresa_id: currentEmpresaId,
        profissional_id: Number(profSeqId),
        paciente_id: agendaPaciente && agendaPaciente.value ? Number(agendaPaciente.value) : null,
        inicio: inicioIso,
        fim: fimIso,
        status: agendaStatus ? agendaStatus.value : 'MARCADO',
        titulo: agendaTitulo ? agendaTitulo.value : null,
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
if (inputCpf) inputCpf.addEventListener('input', e => e.target.value = maskCPF(e.target.value));
if (inputCelular) inputCelular.addEventListener('input', e => e.target.value = maskCellphone(e.target.value));
if (profCelular) profCelular.addEventListener('input', e => e.target.value = maskCellphone(e.target.value));
if (inputTelefone) inputTelefone.addEventListener('input', e => e.target.value = maskPhone(e.target.value));

const handlePatientCepLookup = () => {
    if (!inputCep) return;
    inputCep.value = maskCEP(inputCep.value);

    const cep = String(inputCep.value || '').replace(/\D/g, '');
    if (cep.length !== 8) {
        setPatientAddressLock(true);
        clearPatientAddressFields();
        return;
    }

    setPatientAddressLock(true);
    clearPatientAddressFields();

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(response => response.json())
        .then(data => {
            if (!data.erro) {
                const elEndereco = document.getElementById('occ_paciente_endereco');
                const elBairro = document.getElementById('occ_paciente_bairro');
                const elCidade = document.getElementById('occ_paciente_cidade');
                const elUf = document.getElementById('occ_paciente_uf');

                if (elEndereco) elEndereco.value = data.logradouro || '';
                if (elBairro) elBairro.value = data.bairro || '';
                if (elCidade) elCidade.value = data.localidade || '';
                if (elUf) elUf.value = data.uf || '';

                [elEndereco, elBairro, elCidade, elUf].forEach(input => {
                    if (input) {
                        input.style.backgroundColor = '#e8f0fe';
                        setTimeout(() => input.style.backgroundColor = '', 1000);
                    }
                });

                setPatientAddressLock(false);
                const numEl = document.getElementById('occ_paciente_numero');
                if (numEl) numEl.focus();
            } else {
                setPatientAddressLock(true);
                clearPatientAddressFields();
                showToast('CEP não encontrado.', true);
            }
        })
        .catch(error => {
            console.error('Error fetching CEP:', error);
            setPatientAddressLock(true);
            clearPatientAddressFields();
            showToast('Erro ao buscar o CEP.', true);
        });
};

if (inputCep && !inputCep.__cepBound) {
    inputCep.__cepBound = true;
    ['input', 'change', 'blur'].forEach(evt => inputCep.addEventListener(evt, handlePatientCepLookup));
}

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
function syncPatientProfissaoUI() {
    const sel = document.getElementById('profissao');
    const other = document.getElementById('profissaoOutro');
    if (!sel || !other) return;
    const isOther = String(sel.value || '') === 'Outro';
    other.style.display = isOther ? 'block' : 'none';
    if (!isOther) other.value = '';
}

function getPatientProfissaoValue() {
    const sel = document.getElementById('profissao');
    const other = document.getElementById('profissaoOutro');
    if (!sel) return '';
    const v = String(sel.value || '').trim();
    if (v !== 'Outro') return v;
    return other ? String(other.value || '').trim() : '';
}

function setPatientProfissaoValue(raw) {
    const sel = document.getElementById('profissao');
    const other = document.getElementById('profissaoOutro');
    if (!sel || !other) return;
    const v = String(raw || '').trim();
    const hasOption = Array.from(sel.options || []).some(o => String(o.value || '') === v);
    if (!v) {
        sel.value = '';
        other.value = '';
        other.style.display = 'none';
        return;
    }
    if (hasOption && v !== 'Outro') {
        sel.value = v;
        other.value = '';
        other.style.display = 'none';
        return;
    }
    sel.value = 'Outro';
    other.value = v === 'Outro' ? '' : v;
    other.style.display = 'block';
}

(() => {
    const sel = document.getElementById('profissao');
    if (!sel || sel.__boundProfissao) return;
    sel.__boundProfissao = true;
    sel.addEventListener('change', syncPatientProfissaoUI);
    syncPatientProfissaoUI();
})();

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

    const dataNascimentoValue = document.getElementById('dataNascimento').value;
    const patientData = {
        nome: document.getElementById('occ_paciente_nome').value,
        cpf: cpfValue,
        datanascimento: dataNascimentoValue ? dataNascimentoValue : null,
        sexo: document.getElementById('sexo').value,
        profissao: getPatientProfissaoValue(),
        telefone: document.getElementById('occ_paciente_telefone').value,
        celular: document.getElementById('occ_paciente_celular').value,
        email: document.getElementById('occ_paciente_email').value,
        cep: document.getElementById('occ_paciente_cep').value,
        endereco: document.getElementById('occ_paciente_endereco').value,
        numero: document.getElementById('occ_paciente_numero').value,
        complemento: document.getElementById('occ_paciente_complemento').value,
        bairro: document.getElementById('occ_paciente_bairro').value,
        cidade: document.getElementById('occ_paciente_cidade').value,
        uf: document.getElementById('occ_paciente_uf').value,
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
        const code = error && error.code ? String(error.code) : '';
        const msg = error && error.message ? String(error.message) : 'Erro ao salvar paciente no banco de dados.';
        const details = error && error.details ? String(error.details) : '';
        const hint = error && error.hint ? String(error.hint) : '';
        const full = [msg, details, hint].filter(Boolean).join(' ');
        if (code === '23505' && /pacientes_seqid_unique/i.test(full)) {
            showToast('Erro ao salvar paciente: seqid duplicado. Aplique o SQL de correção de seqid por empresa.', true);
            return;
        }
        if (code === '42501' || /row-level security|rls/i.test(full)) {
            showToast('Erro ao salvar paciente: sem permissão (RLS) na empresa atual. Verifique o vínculo do usuário na empresa.', true);
            return;
        }
        showToast(code ? `Erro ao salvar paciente (${code}): ${full}` : `Erro ao salvar paciente: ${full}`, true);
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
        if (!window.isSecureContext) {
            showToast('A câmera exige HTTPS ou http://localhost. Abra o OCC em localhost/HTTPS e tente novamente.', true);
            return;
        }
        const hasMediaDevices = !!(navigator.mediaDevices);
        const hasGetUserMedia = hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
        const hasLegacyGetUserMedia = typeof navigator.getUserMedia === 'function'
            || typeof navigator.webkitGetUserMedia === 'function'
            || typeof navigator.mozGetUserMedia === 'function';
        if (!hasGetUserMedia && !hasLegacyGetUserMedia) {
            showToast('Captura por câmera indisponível neste navegador/dispositivo.', true);
            return;
        }

        cameraModal.classList.remove('hidden');
        try {
            const constraints = { video: { facingMode: 'user' }, audio: false };
            if (hasGetUserMedia) {
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            } else {
                const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                mediaStream = await new Promise((resolve, reject) => legacy.call(navigator, constraints, resolve, reject));
            }
            cameraVideo.srcObject = mediaStream;
            await new Promise(resolve => {
                if (cameraVideo.readyState >= 1) return resolve();
                cameraVideo.onloadedmetadata = () => resolve();
            });
            try { await cameraVideo.play(); } catch { }
        } catch (err) {
            console.error("Erro ao acessar câmera: ", err);
            const name = err && err.name ? String(err.name) : '';
            if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                showToast('Permissão de câmera negada. Habilite a câmera no navegador e tente novamente.', true);
            } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                showToast('Nenhuma câmera foi encontrada neste dispositivo.', true);
            } else if (!window.isSecureContext) {
                showToast('Câmera exige HTTPS/localhost. Use "Escolher" para enviar uma foto.', true);
            } else {
                showToast('Não foi possível acessar a câmera. Use "Escolher" para enviar uma foto.', true);
            }
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
    if (cameraVideo) cameraVideo.srcObject = null;
}

if (btnCloseCameraModal) btnCloseCameraModal.addEventListener('click', closeCameraModal);
if (btnCancelCamera) btnCancelCamera.addEventListener('click', closeCameraModal);

if (btnTakePhoto) {
    btnTakePhoto.addEventListener('click', () => {
        if (!mediaStream) return;
        if (!cameraVideo || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
            showToast('Aguarde a câmera iniciar antes de gravar a foto.', true);
            return;
        }
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
            comissionCard.style.display = 'none';
            document.getElementById('comissionCEDiv').style.display = 'none';
            document.getElementById('comissionCCDiv').style.display = 'none';
            document.getElementById('comissionCPDiv').style.display = 'none';
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
        photo: photoBase64.value,
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
    document.getElementById('occ_paciente_nome').value = p.nome;
    document.getElementById('cpf').value = p.cpf;
    document.getElementById('dataNascimento').value = p.datanascimento || '';
    document.getElementById('sexo').value = p.sexo || '';
    setPatientProfissaoValue(p.profissao || '');
    document.getElementById('occ_paciente_telefone').value = p.telefone || '';
    document.getElementById('occ_paciente_celular').value = p.celular || '';
    document.getElementById('occ_paciente_email').value = p.email || '';
    document.getElementById('occ_paciente_cep').value = p.cep || '';
    document.getElementById('occ_paciente_endereco').value = p.endereco || '';
    document.getElementById('occ_paciente_numero').value = p.numero || '';
    document.getElementById('occ_paciente_complemento').value = p.complemento || '';
    document.getElementById('occ_paciente_bairro').value = p.bairro || '';
    document.getElementById('occ_paciente_cidade').value = p.cidade || '';
    document.getElementById('occ_paciente_uf').value = p.uf || '';
    setPatientAddressLock(false);

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
    try {
        const p = patients.find(x => String(x && x.id || '') === String(id));
        const blockers = await getPatientDeleteBlockers(p);
        if (blockers.length) {
            showToast(`Não é possível excluir: paciente em uso em ${blockers.join(', ')}.`, true);
            return;
        }
        if (!confirm('Tem certeza que deseja excluir este paciente?')) return;
        const { error } = await db.from('pacientes').delete().eq('id', id);
        if (error) throw error;
        patients = patients.filter(p2 => p2.id !== id);
        renderTable(patients, 'patients');
        showToast('Paciente removido com sucesso!');
    } catch (error) {
        console.error("Error deleting patient:", error);
        showToast(error && error.message ? String(error.message) : "Erro ao remover paciente.", true);
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
    const pPhoto = getProfessionalPhotoValue(p);
    if (pPhoto) {
        photoPreview.innerHTML = `<img src="${escapeHtml(pPhoto)}" alt="Foto Profil">`;
        photoBase64.value = pPhoto;
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
    try {
        const p = professionals.find(x => String(x && x.id || '') === String(id));
        const blockers = await getProfessionalDeleteBlockers(p);
        if (blockers.length) {
            showToast(`Não é possível excluir: profissional em uso em ${blockers.join(', ')}.`, true);
            return;
        }
        if (!confirm('Tem certeza que deseja excluir este profissional?')) return;
        if (p && p.seqid != null) {
            const profSeq = Number(p.seqid);
            if (Number.isFinite(profSeq)) {
                await db.from('agenda_disponibilidade').delete().eq('empresa_id', currentEmpresaId).eq('profissional_id', profSeq);
            }
        }
        const { error } = await db.from('profissionais').delete().eq('id', id);
        if (error) throw error;
        professionals = professionals.filter(p2 => p2.id !== id);
        renderTable(professionals, 'professionals');
        showToast('Profissional removido com sucesso!');
    } catch (error) {
        console.error("Error deleting professional:", error);
        showToast(error && error.message ? String(error.message) : "Erro ao remover profissional.", true);
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

            for (const subId of Array.from(deletedSpecialtySubdivisionIds.values())) {
                const { count: srvCount, error: srvErr } = await withTimeout(
                    db.from('servicos')
                        .select('id', { count: 'exact', head: true })
                        .eq('empresa_id', currentEmpresaId)
                        .eq('subdivisao_id', subId),
                    15000,
                    'especialidades:check_subdivisao_servicos'
                );
                if (srvErr) throw srvErr;
                if (Number(srvCount || 0) > 0) {
                    showToast('Integridade de Dados: esta subdivisão possui serviços vinculados e não pode ser removida.', true);
                    continue;
                }
                const { error: delSubErr } = await db.from('especialidade_subdivisoes')
                    .delete()
                    .eq('empresa_id', currentEmpresaId)
                    .eq('especialidade_id', targetId)
                    .eq('id', subId);
                if (delSubErr) throw delSubErr;
            }
            deletedSpecialtySubdivisionIds.clear();

            const upserted = [];
            for (const sub of (currentSpecialtySubdivisions || [])) {
                const nome = String(sub && sub.nome || '').trim();
                if (!nome) continue;
                if (sub && sub.id) {
                    const { data: uData, error: uErr } = await db.from('especialidade_subdivisoes')
                        .update({ nome })
                        .eq('empresa_id', currentEmpresaId)
                        .eq('especialidade_id', targetId)
                        .eq('id', sub.id)
                        .select()
                        .maybeSingle();
                    if (uErr) throw uErr;
                    if (uData) upserted.push(uData);
                } else {
                    const subData = {
                        id: generateId(),
                        especialidade_id: targetId,
                        nome,
                        empresa_id: currentEmpresaId
                    };
                    const { data: savedSub, error: insError } = await db.from('especialidade_subdivisoes').insert(subData).select().single();
                    if (insError) throw insError;
                    if (savedSub) upserted.push(savedSub);
                }
            }

            const { data: refreshedSubs, error: refErr } = await db.from('especialidade_subdivisoes')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('especialidade_id', targetId);
            if (refErr) throw refErr;
            const newSubs = Array.isArray(refreshedSubs) ? refreshedSubs : upserted;

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
    deletedSpecialtySubdivisionIds.clear();
    if (typeof renderSubSpecTable === 'function') renderSubSpecTable();
};

window.deleteSpecialty = async function (id) {
    if (!can('especialidades', 'delete')) {
        showToast("Você não tem permissão para excluir especialidades.", true);
        return;
    }
    try {
        const spec = (specialties || []).find(s => String(s.id) === String(id));
        const specName = spec ? String(spec.nome || '') : '';

        const { count: profCount, error: profErr } = await withTimeout(
            db.from('profissionais')
                .select('id', { count: 'exact', head: true })
                .eq('empresa_id', currentEmpresaId)
                .eq('especialidadeid', id),
            15000,
            'especialidades:check_profissionais'
        );
        if (profErr) throw profErr;
        if (Number(profCount || 0) > 0) {
            showToast(`Não é possível excluir: ${profCount} profissional(is) vinculado(s) a esta especialidade.`, true);
            return;
        }

        const { data: subsList, count: subCount, error: subErr } = await withTimeout(
            db.from('especialidade_subdivisoes')
                .select('id', { count: 'exact' })
                .eq('empresa_id', currentEmpresaId)
                .eq('especialidade_id', id),
            15000,
            'especialidades:check_subdivisoes'
        );
        if (subErr) throw subErr;
        const subIds = (subsList || []).map(r => String(r && r.id || '')).filter(Boolean);

        if (subIds.length) {
            const { count: srvCount, error: srvErr } = await withTimeout(
                db.from('servicos')
                    .select('id', { count: 'exact', head: true })
                    .eq('empresa_id', currentEmpresaId)
                    .in('subdivisao_id', subIds),
                15000,
                'especialidades:check_servicos_por_subdiv'
            );
            if (srvErr) throw srvErr;
            if (Number(srvCount || 0) > 0) {
                showToast('Integridade de Dados: esta especialidade possui serviços vinculados via subdivisões. Sugerimos apenas inativar.', true);
                return;
            }
        }

        const msg = `Tem certeza que deseja excluir esta especialidade${specName ? ` (${specName})` : ''}?`;
        if (!confirm(msg)) return;

        if (subIds.length) {
            const { error: delSubsErr } = await db.from('especialidade_subdivisoes')
                .delete()
                .eq('empresa_id', currentEmpresaId)
                .eq('especialidade_id', id);
            if (delSubsErr) throw delSubsErr;
        }

        const { error } = await db.from('especialidades')
            .delete()
            .eq('empresa_id', currentEmpresaId)
            .eq('id', id);
        if (error) throw error;

        specialties = specialties.filter(s => s.id !== id);
        renderTable(specialties, 'specialties');
        showToast('Especialidade removida com sucesso!');
    } catch (error) {
        console.error("Error deleting specialty:", error);
        const code = error && error.code ? String(error.code) : '';
        if (code === '23503') {
            showToast("Integridade de Dados: não é possível excluir pois existem movimentações/vínculos.", true);
            return;
        }
        const msg = error && error.message ? String(error.message) : '';
        if (msg.toLowerCase().includes('integridade') || msg.toLowerCase().includes('foreign key') || msg.toLowerCase().includes('restrict')) {
            showToast("Integridade de Dados: não é possível excluir pois existem movimentações/vínculos.", true);
            return;
        }
        showToast("Erro ao remover especialidade.", true);
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

window.removeSubSpec = async function (index) {
    const sub = currentSpecialtySubdivisions[index];
    if (!sub) return;
    if (sub && sub.id) {
        try {
            const { count: srvCount, error: srvErr } = await withTimeout(
                db.from('servicos')
                    .select('id', { count: 'exact', head: true })
                    .eq('empresa_id', currentEmpresaId)
                    .eq('subdivisao_id', sub.id),
                15000,
                'especialidades:check_subdivisao_servicos_ui'
            );
            if (srvErr) throw srvErr;
            if (Number(srvCount || 0) > 0) {
                showToast('Integridade de Dados: esta subdivisão possui serviços vinculados e não pode ser excluída.', true);
                return;
            }
            deletedSpecialtySubdivisionIds.add(String(sub.id));
        } catch (e) {
            const msg = e && e.message ? String(e.message) : 'Falha ao validar integridade.';
            showToast(msg, true);
            return;
        }
    }

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
            const canEdit = !isCancelled && canMutateBudget(item, 'update');
            const canDel = !isCancelled && canMutateBudget(item, 'delete');
            
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td style="font-weight: 600;">${item.pacientenome}</td>
                <td>${item.pacientecelular || '-'}</td>
                <td>${(item.orcamento_itens || []).length} itens</td>
                <td style="font-weight: 600;">R$ ${total.toFixed(2)}</td>
                <td style="font-weight: 600; color: var(--success-color);">R$ ${parseFloat(item.total_pago || 0).toFixed(2)}</td>
                <td><span class="badge badge-${(item.status || 'Pendente').toLowerCase().replace(/\s+/g, '-')}">${item.status || 'Pendente'}</span></td>
                <td>
                    <div class="actions">
                        <button onclick="viewBudgetPayments('${item.id}')" class="btn-icon" title="Pagamentos & Liberação"><i class="ri-money-dollar-circle-line"></i></button>
                        <button onclick="printBudget('${item.id}')" class="btn-icon" title="Imprimir"><i class="ri-printer-line"></i></button>
                        ${canEdit ? `<button onclick="editBudget('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>` : ''}
                        ${canDel ? `<button onclick="deleteBudget('${item.id}')" class="btn-icon btn-delete" title="Cancelar Orçamento"><i class="ri-delete-bin-line"></i></button>` : ''}
                        ${(!canEdit && !canDel && !isCancelled) ? `<button class="btn-icon" style="opacity: 0.3; cursor: not-allowed;" title="Edição/Exclusão bloqueada para o seu perfil"><i class="ri-lock-2-line"></i></button>` : ''}
                        ${isCancelled ? `<button class="btn-icon" style="opacity: 0.3; cursor: not-allowed;" title="Orçamento Cancelado (Edição Bloqueada)"><i class="ri-edit-line"></i></button>` : ''}
                    </div>
                </td>
            `;
        } else if (type === 'professionals') {
            const table = document.getElementById('professionalsTable');
            const headRow = table ? table.querySelector('thead tr') : null;
            if (headRow) {
                const ths = Array.from(headRow.querySelectorAll('th'));
                const hasFoto = ths.some(th => String(th.textContent || '').trim().toLowerCase() === 'foto');
                if (!hasFoto) {
                    const th = document.createElement('th');
                    th.textContent = 'Foto';
                    th.style.width = '70px';
                    th.style.textAlign = 'center';
                    if (ths.length >= 2) headRow.insertBefore(th, ths[1]);
                    else headRow.appendChild(th);
                }
            }

            const photoSrc = getProfessionalPhotoValue(item);
            tr.innerHTML = `
                <td>${item.seqid}</td>
                <td class="js-prof-photo" style="text-align:center;"></td>
                <td style="font-weight: 600;">${escapeHtml(item.nome || '')}</td>
                <td>${escapeHtml(item.tipo || '')}</td>
                <td>${item.especialidadeid ? escapeHtml(getSpecialtyName(item.especialidadeid)) : '-'}</td>
                <td><span class="badge badge-${escapeHtml(String(item.status || 'Ativo').toLowerCase())}">${escapeHtml(item.status || 'Ativo')}</span></td>
                <td>
                    <div class="actions">
                        <button onclick="printProfessional('${item.id}')" class="btn-icon" title="Imprimir Ficha"><i class="ri-printer-line"></i></button>
                        <button onclick="editProfessional('${item.id}')" class="btn-icon" title="Editar"><i class="ri-edit-line"></i></button>
                        <button onclick="deleteProfessional('${item.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </td>
            `;

            const photoCell = tr.querySelector('.js-prof-photo');
            if (photoCell) {
                if (photoSrc) {
                    const img = document.createElement('img');
                    img.className = 'photo-thumb';
                    img.alt = 'Foto';
                    let objectUrl = '';
                    img.onerror = () => {
                        try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch { }
                        try {
                            photoCell.innerHTML = '<i class="ri-user-line"></i>';
                        } catch { }
                    };
                    img.onload = () => { try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch { } };
                    if (photoSrc.startsWith('data:image/') && photoSrc.length > 200000) {
                        objectUrl = dataUrlToObjectUrl(photoSrc);
                    }
                    img.src = objectUrl || photoSrc;
                    photoCell.appendChild(img);
                } else {
                    photoCell.innerHTML = '<i class="ri-user-line"></i>';
                }
            }
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
                    <button class="btn-icon delete-btn" onclick="deleteTransaction('${item.id}')" title="Excluir Lançamento">
                        <i class="ri-delete-bin-line"></i>
                    </button>
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
            const userId = item.usuario_id || item.user_id || 'N/A';
            const empresaId = item.empresa_id || '';
            const userEmail = item.user_email || userId;
            const shortId = userId.length > 8 ? userId.substring(0, 8) : userId;
            const userRole = (normalizeRole(item.perfil) || 'user').toUpperCase();
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
                    <button class="btn-icon js-print-tenant-user" data-user-id="${userId}" data-empresa-id="${empresaId}" title="Imprimir Acesso">
                        <i class="ri-printer-line"></i>
                    </button>
                    <button class="btn-icon js-edit-tenant-user" data-user-id="${userId}" data-empresa-id="${empresaId}" title="Editar Permissões">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="btn-icon delete-btn js-delete-tenant-user" data-user-id="${userId}" data-empresa-id="${empresaId}" title="Remover Acesso">
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
        const subId = subEl && subEl.value ? String(subEl.value) : '';
        const subLabel = subEl && subEl.selectedOptions && subEl.selectedOptions[0]
            ? String(subEl.selectedOptions[0].textContent || '').trim()
            : '';
        const servData = {
            descricao: document.getElementById('servDescricao').value.toUpperCase(),
            valor: parseFloat(document.getElementById('servValor').value) || 0,
            ie: document.getElementById('servTipoIE').value,
            tipo_calculo: document.getElementById('servTipoCalculo') ? document.getElementById('servTipoCalculo').value : 'Fixo',
            exige_elemento: document.getElementById('servExigeElemento') ? !!document.getElementById('servExigeElemento').checked : false,
            subdivisao: subId ? subLabel : '',
            subdivisao_id: subId ? subId : null,
            empresa_id: currentEmpresaId
        };

        const stripMissingServiceColumns = (err, data) => {
            const msg = [
                err && err.code ? String(err.code) : '',
                err && err.message ? String(err.message) : '',
                err && err.details ? String(err.details) : '',
                err && err.hint ? String(err.hint) : ''
            ].join(' | ').toLowerCase();
            const missingTipo = msg.includes('tipo_calculo') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'));
            const missingExige = msg.includes('exige_elemento') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'));
            if (!missingTipo && !missingExige) return null;
            const next = { ...data };
            if (missingTipo) delete next.tipo_calculo;
            if (missingExige) delete next.exige_elemento;
            return next;
        };

        try {
            let targetId = id || '';
            if (id) {
                const res1 = await db.from('servicos').update(servData).eq('id', id);
                if (res1.error) {
                    const reduced = stripMissingServiceColumns(res1.error, servData);
                    if (reduced) {
                        const res2 = await db.from('servicos').update(reduced).eq('id', id);
                        if (res2.error) throw res2.error;
                        showToast('Atenção: atualize o schema do Supabase para ativar Tipo de Cálculo/Exige Elemento.', true);
                    } else {
                        throw res1.error;
                    }
                }

                const index = services.findIndex(s => s.id === id);
                if (index !== -1) services[index] = { ...services[index], ...servData };
                showToast('Item atualizado com sucesso!');
            } else {
                servData.id = generateId();
                servData.seqid = getNextSeqId(services);
                targetId = servData.id;

                const res1 = await db.from('servicos').insert(servData).select().single();
                if (res1.error) {
                    const reduced = stripMissingServiceColumns(res1.error, servData);
                    if (reduced) {
                        const res2 = await db.from('servicos').insert(reduced).select().single();
                        if (res2.error) throw res2.error;
                        if (res2.data) services.push(res2.data);
                        showToast('Atenção: atualize o schema do Supabase para ativar Tipo de Cálculo/Exige Elemento.', true);
                        window.__afterListScrollToServiceId = targetId;
                        showList('services');
                        return;
                    }
                    throw res1.error;
                }

                if (res1.data) services.push(res1.data);
                showToast('Item cadastrado com sucesso!');
            }

            window.__afterListScrollToServiceId = targetId;
            showList('services');
        } catch (error) {
            console.error("Error saving service:", error);
            const errorMsg = error && error.message ? String(error.message) : "Erro ao salvar serviço.";
            const errorCode = error && error.code ? String(error.code) : "";
            const errorHint = error && error.hint ? String(error.hint) : "";
            const errorDetails = error && error.details ? String(error.details) : "";
            showToast(`Erro ao salvar serviço${errorCode ? ` (${errorCode})` : ''}: ${errorMsg}. ${errorHint} ${errorDetails}`.trim(), true);
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
    const tipoCalcEl = document.getElementById('servTipoCalculo');
    if (tipoCalcEl) tipoCalcEl.value = s.tipo_calculo ? String(s.tipo_calculo) : '';
    const exigeEl = document.getElementById('servExigeElemento');
    if (exigeEl) exigeEl.checked = isTruthy(s.exige_elemento);
    const subEl = document.getElementById('servSubdivisao');
    if (subEl) {
        const direct = s.subdivisao_id ? String(s.subdivisao_id) : '';
        if (direct) {
            subEl.value = direct;
        } else {
            const label = String(s.subdivisao || '').trim();
            const opt = Array.from(subEl.options || []).find(o => String(o && o.textContent || '').trim() === label);
            subEl.value = opt ? String(opt.value) : '';
        }
    }
};

window.deleteService = async function (id) {
    if (!can('servicos', 'delete')) {
        showToast("Você não tem permissão para excluir serviços.", true);
        return;
    }
    try {
        const s = services.find(x => String(x && x.id || '') === String(id));
        const blockers = await getServiceDeleteBlockers(s);
        if (blockers.length) {
            showToast(`Não é possível excluir: serviço em uso em ${blockers.join(', ')}.`, true);
            return;
        }
        if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
        const { error } = await db.from('servicos').delete().eq('id', id);
        if (error) throw error;
        services = services.filter(s2 => s2.id !== id);
        renderTable(services, 'services');
        showToast('Serviço removido com sucesso!');
    } catch (error) {
        console.error("Error deleting service:", error);
        showToast(error && error.message ? String(error.message) : "Erro ao remover serviço.", true);
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

function getSelectedBudgetService() {
    const servSel = document.getElementById('budItemServicoId');
    const servId = servSel ? String(servSel.value || '') : '';
    if (!servId) return null;
    return (services || []).find(s => String(s && s.id || '') === servId) || null;
}

function getOdontoSelectedTeethList() {
    return String(budItemOdontoTeeth && budItemOdontoTeeth.value || '')
        .split(',')
        .map(s => String(s || '').trim())
        .filter(Boolean);
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

function syncBudgetItemCalcFromOdonto() {
    const svc = getSelectedBudgetService();
    const qtdeEl = document.getElementById('budItemQtde');
    const totalEl = document.getElementById('budItemTotalCalc');
    const valorEl = document.getElementById('budItemValor');

    const valorUnit = Number(valorEl && valorEl.value ? valorEl.value : 0) || 0;
    const teethCount = getOdontoSelectedTeethList().length;
    const tipoCalc = String(svc && svc.tipo_calculo || '').trim().toLowerCase();
    const porElemento = tipoCalc === 'por elemento' || tipoCalc === 'por_elemento' || tipoCalc === 'elemento';
    const fixo = tipoCalc === 'fixo';

    if (qtdeEl) {
        if (fixo || porElemento) {
            qtdeEl.value = '1';
            qtdeEl.readOnly = true;
        } else {
            qtdeEl.readOnly = false;
        }
    }

    const qtde = Number(qtdeEl && qtdeEl.value ? qtdeEl.value : 0) || 0;
    const total = porElemento ? (valorUnit * teethCount) : (valorUnit * qtde);
    if (totalEl) totalEl.value = formatCurrencyBRL(total);
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

function closeHelp() {
    if (helpModal) helpModal.classList.add('hidden');
}

function openHelp(title, html) {
    if (!helpModal || !helpModalBody) return;
    if (helpModalTitle) helpModalTitle.textContent = title || 'Ajuda';
    helpModalBody.innerHTML = html || '';
    helpModal.classList.remove('hidden');
}

function getBudgetsHelpHtml() {
    return `
        <div style="line-height:1.45;">
            <h3 style="margin: 0 0 10px 0;">Negócio do Orçamento (OCC)</h3>
            <p style="margin: 0 0 12px 0;">
                No OCC, <strong>Orçamento</strong> é o “objeto de negócio” que organiza o atendimento do paciente em <strong>itens (procedimentos)</strong> e define as regras de <strong>pagamento, liberação, consumo no financeiro e comissão</strong>, conforme o campo <strong>Tipo</strong> do orçamento.
            </p>

            <h4 style="margin: 14px 0 8px 0;">Trâmites por tipo</h4>
            <div style="margin: 0 0 10px 0;">
                <div style="font-weight:800; margin-bottom:4px;">NORMAL</div>
                <ul style="margin: 0 0 0 18px; padding: 0;">
                    <li>Registra pagamentos.</li>
                    <li>Liberação de item segue regra de saldo pago (ou autorização quando não cobrir).</li>
                    <li>Gera comissão na liberação (se o profissional tiver regra).</li>
                    <li>Pode registrar “consumo” no financeiro (débito do serviço).</li>
                </ul>
            </div>

            <div style="margin: 0 0 10px 0;">
                <div style="font-weight:800; margin-bottom:4px;">RETRABALHO</div>
                <ul style="margin: 0 0 0 18px; padding: 0;">
                    <li>É um orçamento “sem cobrança” (refação/ajuste).</li>
                    <li>Não registra pagamentos.</li>
                    <li>Não gera comissão.</li>
                    <li>Não registra consumo no financeiro.</li>
                    <li>Itens podem ser liberados sem depender de pagamento.</li>
                    <li>Pode ser executado pelo mesmo profissional ou outro (você escolhe o executor no item), mas como o tipo é “Retrabalho”, não há comissão para ninguém.</li>
                </ul>
            </div>

            <div style="margin: 0 0 10px 0;">
                <div style="font-weight:800; margin-bottom:4px;">CORTESIA</div>
                <ul style="margin: 0 0 0 18px; padding: 0;">
                    <li>Mesma lógica do Retrabalho: sem pagamento, sem comissão, sem consumo no financeiro, liberação direta.</li>
                    <li>Então, em Cortesia o profissional não recebe comissão.</li>
                </ul>
            </div>

            <h4 style="margin: 14px 0 8px 0;">E se o retrabalho for de outro profissional e a comissão do original já foi paga?</h4>
            <ul style="margin: 0 0 0 18px; padding: 0;">
                <li>Hoje o OCC não faz abatimento automático de comissão paga só porque você criou um orçamento “Retrabalho”.</li>
                <li>Se a intenção for “corrigir” o que já foi pago, o caminho previsto é via estorno/controle de comissões (com governança; pode exigir autorização quando já está “PAGA”).</li>
            </ul>
        </div>
    `;
}

function initHelpShortcuts() {
    if (window.__helpShortcutsInit) return;
    window.__helpShortcutsInit = true;

    if (btnCloseHelpModal) btnCloseHelpModal.addEventListener('click', closeHelp);
    if (btnCloseHelpModal2) btnCloseHelpModal2.addEventListener('click', closeHelp);
    if (helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

    document.addEventListener('keydown', (e) => {
        const isF1 = e.key === 'F1' || e.keyCode === 112;
        if (!isF1) return;
        e.preventDefault();
        const ctx = String(window.__activeHelpContext || '').toLowerCase();
        if (ctx === 'budgets') {
            openHelp('Ajuda — Orçamentos', getBudgetsHelpHtml());
            return;
        }
        openHelp('Ajuda', '<div style="color: var(--text-muted);">Ajuda indisponível para esta tela.</div>');
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

    const labSelect = document.getElementById('budItemProteseLaboratorioId');
    if (labSelect) {
        const fill = () => {
            const opts = ['<option value="">Selecione...</option>'];
            (proteseLabs || []).filter(l => l.ativo !== false).forEach(l => opts.push(`<option value="${l.id}">#${l.seqid} - ${l.nome}</option>`));
            labSelect.innerHTML = opts.join('');
        };
        if (Array.isArray(proteseLabs) && proteseLabs.length) {
            fill();
        } else {
            ensureProteseLabsLoaded().then(fill).catch(() => fill());
        }
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

function syncBudgetProteseExecucaoGroups() {
    const execSel = document.getElementById('budItemProteseExecucao');
    const protGroup = document.getElementById('budItemProteseProteticoGroup');
    const labGroup = document.getElementById('budItemProteseLabGroup');
    const protSel = document.getElementById('budItemProfissionalId');
    const labSel = document.getElementById('budItemProteseLaboratorioId');
    const v = execSel ? String(execSel.value || 'INTERNA') : 'INTERNA';
    if (protGroup) protGroup.style.display = v === 'INTERNA' ? 'block' : 'none';
    if (labGroup) labGroup.style.display = v === 'EXTERNA' ? 'block' : 'none';
    if (v === 'INTERNA' && labSel) labSel.value = '';
    if (v === 'EXTERNA' && protSel) protSel.value = '';
}

function populateBudgetItemSubdivisaoDropdown() {
    const subSelect = document.getElementById('budItemSubdivisao');
    if (!subSelect) return;
    subSelect.innerHTML = '<option value="">Selecione...</option><option value="-">Nenhuma / Geral</option>';

    specialties.forEach(spec => {
        if (spec.subdivisoes && spec.subdivisoes.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `${spec.seqid} - ${spec.nome}`;

            spec.subdivisoes.forEach((sub, i) => {
                const subCode = `${spec.seqid}.${i + 1}`;
                const displayStr = `${subCode} - ${sub.nome}`;
                const opt = document.createElement('option');
                opt.value = displayStr;
                opt.textContent = displayStr;
                opt.dataset.subid = String(sub && sub.id || '');
                opt.dataset.subnome = String(sub && sub.nome || '');
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
            const qtdeEl = document.getElementById('budItemQtde');
            if (qtdeEl) qtdeEl.readOnly = false;
            if (budItemOdontoTeeth) budItemOdontoTeeth.value = '';
            if (budItemOdontoDisplay) budItemOdontoDisplay.value = 'Nenhum dente selecionado';
            if (btnOpenOdontograma) {
                btnOpenOdontograma.disabled = true;
                btnOpenOdontograma.title = 'Selecione um serviço que exija elemento';
            }
            if (document.getElementById('budItemProfissionalId')) document.getElementById('budItemProfissionalId').value = '';
            document.getElementById('budItemValorProtetico').value = '';
            const execProtese = document.getElementById('budItemProteseExecucao');
            const labProtese = document.getElementById('budItemProteseLaboratorioId');
            if (execProtese) execProtese.value = 'INTERNA';
            if (labProtese) labProtese.value = '';
            syncBudgetProteseExecucaoGroups();

            // Pre-fill Executor with Header Professional
            const headerProfId = document.getElementById('budProfissionalId')?.value || '';
            const executorSelect = document.getElementById('budItemExecutorId');
            if (executorSelect) {
                executorSelect.value = headerProfId;
            }

            validateBudgetItemForm();
            bindOdontogramaEvents();
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
        const subSelect = document.getElementById('budItemSubdivisao');
        if (subSelect) subSelect.value = '';
        document.getElementById('budItemValor').value = '';
        return false;
    }
    const serv = services.find(s => s.id === serviceId);
    if (serv) {
        document.getElementById('budItemDescricao').value = serv.descricao;

        const subSelect = document.getElementById('budItemSubdivisao');
        if (subSelect) {
            const raw = String(serv.subdivisao || '').trim();
            const rawSubId = String(serv.subdivisao_id || '').trim();
            if (!subSelect.options || subSelect.options.length <= 1) {
                populateBudgetItemSubdivisaoDropdown();
            }
            if (!raw) {
                subSelect.value = '-';
            } else {
                const rawTrim = raw;
                subSelect.value = rawTrim;
                if (subSelect.value !== rawTrim) {
                    const options = Array.from(subSelect.options);
                    const optById = rawSubId ? options.find(o => String(o && o.dataset && o.dataset.subid || '').trim() === rawSubId) : null;
                    const optExact = options.find(o => String(o.value || '').trim() === rawTrim);
                    if (optById) {
                        subSelect.value = optById.value;
                    } else if (optExact) {
                        subSelect.value = optExact.value;
                    } else {
                        const rawKey = normalizeKey(rawTrim);
                        const optByName = options.find(o => {
                            const v = String(o.value || '');
                            const tail = v.includes('-') ? v.split('-').slice(1).join('-') : v;
                            const n1 = normalizeKey(tail);
                            const n2 = normalizeKey(v);
                            const n3 = normalizeKey(String(o && o.dataset && o.dataset.subnome || ''));
                            return n1 === rawKey || n2 === rawKey || n3 === rawKey;
                        });
                        if (optByName) subSelect.value = optByName.value;
                    }
                }
            }
        }

        const valorEl = document.getElementById('budItemValor');
        valorEl.value = serv.valor || 0;
        valorEl.readOnly = true;
        valorEl.classList.add('readonly-input');

        // Feedback visual
        valorEl.style.backgroundColor = '#ecfdf5';
        setTimeout(() => {
            const el = document.getElementById('budItemValor');
            if (el) el.style.backgroundColor = '';
        }, 800);

        if (typeof validateBudgetItemForm === 'function') validateBudgetItemForm();
        syncBudgetItemCalcFromOdonto();
        return true;
    }
    return false;
}

function bindOdontogramaEvents() {
    if (btnOpenOdontograma && !btnOpenOdontograma.__bound) {
        btnOpenOdontograma.__bound = true;
        btnOpenOdontograma.addEventListener('click', () => {
            const svc = getSelectedBudgetService();
            const canSelect = serviceRequiresOdonto(svc);
            if (!canSelect) {
                showToast('Este serviço não exige seleção por elemento.', true);
                return;
            }
            if (modalOdontograma) modalOdontograma.classList.remove('hidden');
            window.__odontoDraftStartVal = String(budItemOdontoTeeth && budItemOdontoTeeth.value || '');
            const selected = new Set(String(budItemOdontoTeeth && budItemOdontoTeeth.value || '').split(',').filter(Boolean));
            if (odontogramaSvg) {
                odontogramaSvg.querySelectorAll('.tooth').forEach(g => {
                    const t = g.getAttribute('data-tooth');
                    if (selected.has(t)) g.classList.add('selected');
                    else g.classList.remove('selected');
                });
            }
            syncBudgetItemCalcFromOdonto();
        });
    }
    if (btnCloseModalOdonto && !btnCloseModalOdonto.__bound) {
        btnCloseModalOdonto.__bound = true;
        btnCloseModalOdonto.addEventListener('click', () => {
            if (odontogramaSvg) {
                const selected = new Set(String(window.__odontoDraftStartVal || '').split(',').filter(Boolean));
                odontogramaSvg.querySelectorAll('.tooth').forEach(g => {
                    const t = g.getAttribute('data-tooth');
                    if (selected.has(t)) g.classList.add('selected');
                    else g.classList.remove('selected');
                });
            }
            if (modalOdontograma) modalOdontograma.classList.add('hidden');
        });
    }
    if (btnCancelOdonto && !btnCancelOdonto.__bound) {
        btnCancelOdonto.__bound = true;
        btnCancelOdonto.addEventListener('click', () => {
            if (odontogramaSvg) {
                const selected = new Set(String(window.__odontoDraftStartVal || '').split(',').filter(Boolean));
                odontogramaSvg.querySelectorAll('.tooth').forEach(g => {
                    const t = g.getAttribute('data-tooth');
                    if (selected.has(t)) g.classList.add('selected');
                    else g.classList.remove('selected');
                });
            }
            if (modalOdontograma) modalOdontograma.classList.add('hidden');
        });
    }
    if (odontogramaSvg && !odontogramaSvg.__bound) {
        odontogramaSvg.__bound = true;
        odontogramaSvg.addEventListener('click', (e) => {
            const tooth = e && e.target && typeof e.target.closest === 'function'
                ? e.target.closest('.tooth')
                : null;
            if (!tooth) return;
            tooth.classList.toggle('selected');
        });
    }
    if (btnConfirmOdonto && !btnConfirmOdonto.__bound) {
        btnConfirmOdonto.__bound = true;
        btnConfirmOdonto.addEventListener('click', () => {
            const selected = odontogramaSvg
                ? Array.from(odontogramaSvg.querySelectorAll('.tooth.selected')).map(el => el.getAttribute('data-tooth')).filter(Boolean)
                : [];
            const val = selected.join(',');
            if (budItemOdontoTeeth) budItemOdontoTeeth.value = val;
            if (budItemOdontoDisplay) budItemOdontoDisplay.value = selected.length ? selected.join(' • ') : 'Nenhum dente selecionado';
            window.__odontoDraftStartVal = '';
            syncBudgetItemCalcFromOdonto();
            if (modalOdontograma) modalOdontograma.classList.add('hidden');
        });
    }
}

// Auto-fill Service Data in Add Item Panel (Delegated)
// The 'change' event fires when a new value is selected OR when the same value is re-selected
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'budItemServicoId') {
        updateBudgetItemFromService(e.target.value);
        syncOdontoButtonForServiceId(e.target.value);
        syncBudgetItemCalcFromOdonto();
    }
});



const budItemValor = document.getElementById('budItemValor');
if (budItemValor) budItemValor.addEventListener('input', () => { validateBudgetItemForm(); syncBudgetItemCalcFromOdonto(); });

const budItemQtde = document.getElementById('budItemQtde');
if (budItemQtde) budItemQtde.addEventListener('input', () => { validateBudgetItemForm(); syncBudgetItemCalcFromOdonto(); });

const budItemProfissionalId = document.getElementById('budItemProfissionalId');
if (budItemProfissionalId) budItemProfissionalId.addEventListener('change', validateBudgetItemForm);

const budItemSubdivisao = document.getElementById('budItemSubdivisao');
if (budItemSubdivisao) budItemSubdivisao.addEventListener('change', validateBudgetItemForm);

const budItemExecutorId = document.getElementById('budItemExecutorId');
if (budItemExecutorId) budItemExecutorId.addEventListener('change', validateBudgetItemForm);

const budItemProteseExecucao = document.getElementById('budItemProteseExecucao');
if (budItemProteseExecucao) budItemProteseExecucao.addEventListener('change', () => { syncBudgetProteseExecucaoGroups(); validateBudgetItemForm(); });

const budItemProteseLaboratorioId = document.getElementById('budItemProteseLaboratorioId');
if (budItemProteseLaboratorioId) budItemProteseLaboratorioId.addEventListener('change', validateBudgetItemForm);

const budItemValorProtetico = document.getElementById('budItemValorProtetico');
if (budItemValorProtetico) budItemValorProtetico.addEventListener('input', validateBudgetItemForm);

// Save Sub-Item
if (btnSaveAddItem) {
    btnSaveAddItem.addEventListener('click', () => {
        try {
            const servEl = document.getElementById('budItemServicoId');
            const valorEl = document.getElementById('budItemValor');
            const qtdeEl = document.getElementById('budItemQtde');
            const profEl = document.getElementById('budItemProfissionalId');
            const labEl = document.getElementById('budItemProteseLaboratorioId');
            const valorProtEl = document.getElementById('budItemValorProtetico');
            const execProtese = document.getElementById('budItemProteseExecucao')?.value || '';

            const servId = servEl.value;
            const teethCsv = String(budItemOdontoTeeth && budItemOdontoTeeth.value || '').trim();
            const teethList = teethCsv ? teethCsv.split(',').filter(Boolean) : [];
            const teethCount = teethList.length;
            const svc = (services || []).find(s => String(s && s.id || '') === servId) || null;
            const tipoCalc = String(svc && svc.tipo_calculo || '').trim().toLowerCase();
            const porElemento = tipoCalc === 'por elemento' || tipoCalc === 'por_elemento' || tipoCalc === 'elemento';
            const fixo = tipoCalc === 'fixo';
            if (porElemento && teethCount === 0) {
                showToast('Selecione pelo menos 1 dente no odontograma para este serviço.', true);
                return;
            }
            const unitPrice = svc ? (Number(svc.valor) || 0) : (Number(valorEl.value) || 0);
            if (isNaN(unitPrice) || unitPrice < 0) {
                valorEl.classList.add('input-error');
                showToast('Preço inválido no cadastro do serviço.', true);
                return;
            }
            const qtde = 1;
            const profId = profEl.value; // Protético
            const labId = labEl ? labEl.value : '';
            const valorProtetico = valorProtEl ? parseFloat(valorProtEl.value) : 0;
            const executorId = document.getElementById('budItemExecutorId')?.value || null;

            // Clear previous highlights
            [servEl, valorEl, qtdeEl, profEl, labEl, valorProtEl].filter(Boolean).forEach(el => el.classList.remove('input-error'));

            // Validate each field individually with specific feedback
            let hasError = false;
            if (!servId) {
                servEl.classList.add('input-error');
                hasError = true;
            }
            if (isNaN(unitPrice) || unitPrice < 0) {
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

            const hasProtese = Boolean(profId) || Boolean(labId);
            if (hasProtese) {
                if (!valorProtetico || isNaN(valorProtetico) || valorProtetico <= 0) {
                    if (valorProtEl) valorProtEl.classList.add('input-error');
                    hasError = true;
                }
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
                    const base = {
                        ...currentBudgetItems[idx],
                        servicoId: servId,
                        servicoDescricao: servicoDescricao,
                        subdivisao: subdivisao,
                        valor: unitPrice,
                        qtde: 1,
                        proteticoId: profId,
                        proteticoNome: profData ? profData.nome : '',
                        proteseExecucao: execProtese,
                        proteseLaboratorioId: labId,
                        valorProtetico: valorProtetico || 0,
                        profissionalId: executorId,
                        executorNome: executorData ? executorData.nome : '',
                        status: currentBudgetItems[idx].status || 'Pendente'
                    };
                    if (porElemento) {
                        const firstTooth = teethList[0] ? String(teethList[0]) : '';
                        currentBudgetItems[idx] = { ...base, dentes: firstTooth };
                        const rest = teethList.slice(1).map(t => String(t));
                        rest.forEach(t => {
                            currentBudgetItems.push({
                                ...base,
                                id: generateId(),
                                dentes: t
                            });
                        });
                    } else {
                        currentBudgetItems[idx] = { ...base, dentes: teethCsv };
                    }
                }
            } else {
                const base = {
                    servicoId: servId,
                    servicoDescricao: servicoDescricao,
                    subdivisao: subdivisao,
                    valor: unitPrice,
                    qtde: 1,
                    proteticoId: profId,
                    proteticoNome: profData ? profData.nome : '',
                    proteseExecucao: execProtese,
                    proteseLaboratorioId: labId,
                    valorProtetico: valorProtetico || 0,
                    profissionalId: executorId,
                    executorNome: executorData ? executorData.nome : '',
                    status: 'Pendente'
                };
                if (porElemento) {
                    teethList.forEach(t => {
                        currentBudgetItems.push({
                            ...base,
                            id: generateId(),
                            dentes: String(t)
                        });
                    });
                } else {
                    currentBudgetItems.push({
                        ...base,
                        id: generateId(),
                        dentes: teethCsv
                    });
                }
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
        const toothTag = String(item.dentes || '').trim();
        const toothDisplay = toothTag ? escapeHtml(toothTag.split(',').filter(Boolean).join(' • ')) : '—';

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
                <td>${toothDisplay}</td>
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
    syncOdontoButtonForServiceId(item.servicoId || '');
    document.getElementById('budItemDescricao').value = item.servicoDescricao || '';
    document.getElementById('budItemSubdivisao').value = item.subdivisao || '';
    document.getElementById('budItemValor').value = item.valor !== undefined ? item.valor : '';
    document.getElementById('budItemQtde').value = item.qtde || 1;
    const qtdeEl = document.getElementById('budItemQtde');
    const svc = services.find(s => s.id == item.servicoId);
    const tipoCalc = String(svc && svc.tipo_calculo || '').trim().toLowerCase();
    const porElemento = tipoCalc === 'por elemento' || tipoCalc === 'por_elemento' || tipoCalc === 'elemento';
    const fixo = tipoCalc === 'fixo';
    if (qtdeEl) qtdeEl.readOnly = fixo || porElemento;
    if (budItemOdontoTeeth) budItemOdontoTeeth.value = item.dentes ? String(item.dentes) : '';
    if (budItemOdontoDisplay) {
        const list = String(item.dentes || '').split(',').filter(Boolean);
        budItemOdontoDisplay.value = list.length ? list.join(' • ') : 'Nenhum dente selecionado';
    }
    document.getElementById('budItemExecutorId').value = item.profissionalId || '';
    document.getElementById('budItemProfissionalId').value = item.proteticoId || '';
    document.getElementById('budItemValorProtetico').value = item.valorProtetico !== undefined ? item.valorProtetico : '';

    validateBudgetItemForm();
    syncBudgetItemCalcFromOdonto();
    bindOdontogramaEvents();
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
            if (originalBudget && String(originalBudget.status || '').trim().toLowerCase() === 'executado') {
                showToast('Este orçamento já foi executado e não pode mais ser alterado por questões de segurança contábil.', true);
                showList('budgets');
                return;
            }
        }

        if (id) {
            const originalBudget = budgets.find(b => b.id === id);
            if (originalBudget && !canMutateBudget(originalBudget, 'update')) {
                showToast("Edição bloqueada: orçamento travado para o seu perfil.", true);
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
            const originalBudget = id ? budgets.find(b => b.id === id) : null;
            const lockInfo = originalBudget ? getBudgetLockInfo(originalBudget) : null;
            const shouldAuditLockedAdminChange = !!(id && (isSuperAdmin || isAdminRole()) && lockInfo && !lockInfo.isDentistAllowed);
            const auditOldValue = shouldAuditLockedAdminChange
                ? { orcamento: originalBudget, itens: (originalBudget && (originalBudget.orcamento_itens || originalBudget.itens)) || [] }
                : null;

            // Prepare items properly formatted for PostgreSQL DB
            const itemsPayload = currentBudgetItems.map(item => {
                // Resolve professional and prothetic to seqid (BIGINT)
                const executorObj = professionals.find(p => p.id == item.profissionalId || p.seqid == item.profissionalId);
                const proteticoObj = professionals.find(p => p.id == item.proteticoId || p.seqid == item.proteticoId);
                const svc = services.find(s => s.id == item.servicoId);
                const tipoCalc = String(svc && svc.tipo_calculo || '').trim().toLowerCase();
                const porElemento = tipoCalc === 'por elemento' || tipoCalc === 'por_elemento' || tipoCalc === 'elemento';
                const fixo = tipoCalc === 'fixo';
                const els = String(item.dentes || '').split(',').filter(Boolean);

                return {
                    id: item.id || generateId(),
                    orcamento_id: id || generateId(), // Placeholder if new, will be updated below
                    empresa_id: currentEmpresaId,
                    servico_id: item.servicoId,
                    valor: svc ? (Number(svc.valor) || 0) : item.valor,
                    qtde: (fixo || porElemento) ? 1 : item.qtde,
                    elementos: porElemento ? (els[0] ? [String(els[0])] : []) : els.map(x => String(x)),
                    protetico_id: proteticoObj ? parseInt(proteticoObj.seqid) : null,
                    valor_protetico: item.valorProtetico || 0,
                    profissional_id: executorObj ? parseInt(executorObj.seqid) : null,
                    subdivisao: item.subdivisao || '',
                    status: item.status || 'Pendente'
                };
            });

            const allFinalizadoNow = currentBudgetItems.length > 0
                && currentBudgetItems.every(it => String(it.status || 'Pendente') === 'Finalizado');
            const stNorm = String(budgetData.status || '').trim().toLowerCase();
            if (allFinalizadoNow && stNorm !== 'cancelado' && stNorm !== 'finalizado') {
                budgetData.status = 'Executado';
                const statusSelect = document.getElementById('budStatus');
                if (statusSelect) statusSelect.value = 'Executado';
            }

            if (id) {
                const originalBudget = budgets.find(b => b.id === id);
                const hasNonFinalizadoItem = currentBudgetItems.some(it => String(it.status || 'Pendente') !== 'Finalizado');
                const isExecuted = String(budgetData.status || '').trim().toLowerCase() === 'executado'
                    || String(originalBudget?.status || '').trim().toLowerCase() === 'executado';
                if (isExecuted && hasNonFinalizadoItem) {
                    budgetData.status = 'Aprovado';
                    const statusSelect = document.getElementById('budStatus');
                    if (statusSelect) statusSelect.value = 'Aprovado';
                    showToast('Status ajustado para Aprovado (novos itens adicionados).');
                }

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
                if (index !== -1) budgets[index] = { ...budgets[index], ...budgetData, orcamento_itens: itemsPayload };
                showToast('Orçamento atualizado com sucesso!');

                if (shouldAuditLockedAdminChange) {
                    const auditNewValue = { orcamento: { ...originalBudget, ...budgetData }, itens: itemsPayload };
                    if (currentUser && currentUser.id) {
                        const { error: auditErr } = await db.from('auditoria_log').insert({
                            empresa_id: currentEmpresaId,
                            usuario_id: currentUser.id,
                            data_hora: new Date().toISOString(),
                            valor_antigo: auditOldValue,
                            valor_novo: auditNewValue
                        });
                        if (auditErr) console.warn('[auditoria_log] falha ao registrar auditoria:', auditErr);
                    }
                }
            } else {
                const newId = generateId();
                budgetData.id = newId;
                let inserted = null;
                let lastErr = null;
                for (let attempt = 0; attempt < 5; attempt++) {
                    budgetData.seqid = await getNextOrcamentoSeqIdForEmpresa(currentEmpresaId);
                    const res = await db.from('orcamentos').insert(budgetData).select().single();
                    if (!res.error) {
                        inserted = res.data;
                        lastErr = null;
                        break;
                    }
                    lastErr = res.error;
                    if (String(res.error.code || '') === '23505') continue;
                    break;
                }
                if (lastErr) throw lastErr;

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

    if (String(b.status || '').trim().toLowerCase() === 'executado') {
        showToast('Este orçamento já foi executado e não pode mais ser alterado por questões de segurança contábil.', true);
        return;
    }
    if (b.status === 'Cancelado') {
        showToast("Este orçamento está CANCELADO e não pode ser editado.", true);
        return;
    }
    if (!canMutateBudget(b, 'update')) {
        const info = getBudgetLockInfo(b);
        if (info.isApproved) showToast("Edição bloqueada: orçamento aprovado.", true);
        else if (info.hasPaymentLinked) showToast("Edição bloqueada: orçamento com pagamento vinculado.", true);
        else if (!info.within4h) showToast("Edição bloqueada: janela de 4 horas expirou.", true);
        else showToast("Edição bloqueada para o seu perfil.", true);
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
                <option value="Executado">Executado</option>
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
        const els = item && item.elementos != null
            ? (Array.isArray(item.elementos) ? item.elementos : [])
            : [];

        return {
            id: item.id,
            servicoId: item.servico_id,
            servicoDescricao: servData ? servData.descricao : 'Serviço Excluído/Desconhecido',
            subdivisao: item.subdivisao || (servData ? servData.subdivisao : '-'),
            valor: item.valor,
            qtde: item.qtde,
            dentes: els.length ? els.map(x => String(x)).join(',') : '',
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
    if (String(budget.status || '').trim().toLowerCase() === 'executado') {
        showToast('Este orçamento já foi executado e não pode mais ser alterado por questões de segurança contábil.', true);
        return;
    }
    if (!canMutateBudget(budget, 'delete')) {
        showToast("Exclusão bloqueada: orçamento travado para o seu perfil.", true);
        return;
    }

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
        const dentes = formatOrcamentoItemElementos(item);
        const profNome = profData ? profData.nome : (item.proteticonome || '-');
        const executorNome = executorData ? executorData.nome : (item.executorNome || '-');
        const subtotal = (parseFloat(item.valor || 0) * parseInt(item.qtde || 1));
        return `
            <tr>
            <td>${idx + 1}</td>
            <td>${servicoNome}</td>
            <td>${dentes || '-'}</td>
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
                                        <th style="width:120px">Dente</th>
                                        <th style="width:50px;text-align:center">Qtde</th>
                                        <th style="width:110px;text-align:right">Valor Unit.</th>
                                        <th style="width:120px;text-align:right">Subtotal</th>
                                        <th>Executor</th>
                                        <th>Protético</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#9ca3af">Nenhum item</td></tr>'}
                                </tbody>
                                <tfoot>
                                    <tr class="total-row">
                                        <td colspan="5" style="text-align:right">TOTAL GERAL:</td>
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
                                                    ${getProfessionalPhotoValue(p) ? `<img src="${escapeHtml(getProfessionalPhotoValue(p))}">` : '<span style="color:#9ca3af;font-size:10px">Sem Foto</span>'}
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

window.printServiceList = function () {
    const filtered = Array.isArray(services) ? services : [];

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    let itemsHtml = '';
    filtered.forEach(s => {
        const tipoCalculo = String(s && s.tipo_calculo || 'Fixo');
        const odontograma = (s && s.exige_elemento) ? 'SIM' : 'NÃO';
        itemsHtml += `
            <tr>
                <td>${s.seqid}</td>
                <td>${s.descricao}</td>
                <td>${s.ie === 'S' ? 'Serviço' : 'Estoque'}</td>
                <td>${s.subdivisao || '-'}</td>
                <td>${tipoCalculo}</td>
                <td>${odontograma}</td>
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
                                                        <th style="width: 120px;">TIPO CÁLCULO</th>
                                                        <th style="width: 120px;">ODONTOGRAMA</th>
                                                        <th style="width: 100px; text-align: right;">VALOR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${itemsHtml || '<tr><td colspan="7" style="text-align:center">Nenhum item encontrado.</td></tr>'}
                                                </tbody>
                                            </table>

                                            <div class="footer">
                                                Quantidade total de itens: ${filtered.length} | Documento gerado pelo sistema de gestão da clínica.
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

window.printSpecialtiesMasterDetail = function () {
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const list = Array.isArray(specialties) ? [...specialties].sort((a, b) => Number(a.seqid || 0) - Number(b.seqid || 0)) : [];
    let totalGeral = 0;
    let bodyHtml = '';

    list.forEach(spec => {
        const subs = Array.isArray(spec && spec.subdivisoes) ? spec.subdivisoes : [];
        totalGeral += subs.length;
        const rows = subs.map((sub, i) => `
            <tr>
                <td style="width:90px;">${spec.seqid}.${i + 1}</td>
                <td>${String(sub && sub.nome || '-')}</td>
            </tr>
        `).join('');
        bodyHtml += `
            <div style="margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <div style="background:#f3f4f6; padding:8px 10px; font-weight:700; color:#111827;">
                    ${spec.seqid} - ${spec.nome}
                </div>
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align:left; border-bottom:1px solid #e5e7eb; padding:6px 10px; width:90px;">CÓD.</th>
                            <th style="text-align:left; border-bottom:1px solid #e5e7eb; padding:6px 10px;">SUBDIVISÃO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="2" style="padding:8px 10px; color:#6b7280;">Nenhuma subdivisão cadastrada.</td></tr>'}
                    </tbody>
                </table>
                <div style="padding:8px 10px; border-top:1px solid #e5e7eb; text-align:right; font-weight:700;">
                    Subtotal de itens: ${subs.length}
                </div>
            </div>
        `;
    });

    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório Master/Detail - Especialidades</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; font-size: 12px; color:#1f2937; padding: 18px; }
                    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0066cc; padding-bottom:10px; margin-bottom:12px; }
                    .title { font-size:16px; font-weight:700; color:#0066cc; }
                    .subtitle { font-size:12px; color:#6b7280; margin-top:2px; }
                    .footer { margin-top: 16px; border-top:1px solid #e5e7eb; padding-top:8px; font-weight:700; text-align:right; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="title">OCC - Relatório Master/Detail</div>
                        <div class="subtitle">Especialidades e Subdivisões</div>
                    </div>
                    <div class="subtitle">Emitido em: ${hoje}</div>
                </div>
                ${bodyHtml || '<div style="color:#6b7280;">Nenhuma especialidade cadastrada.</div>'}
                <div class="footer">Total geral de itens: ${totalGeral}</div>
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
    const u = usersAdminList.find(x => x.usuario_id === id);
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
                                                <title>Acesso do Usu\u00e1rio - ${u.user_email || u.usuario_id}</title>
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
                                                <p><strong>Usu\u00e1rio:</strong> ${u.user_email || u.usuario_id}</p>
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
                                                        ${renderPermLine('Pacientes', 'pacientes')}
                                                        ${renderPermLine('Profissionais', 'profissionais')}
                                                        ${renderPermLine('Especialidades', 'especialidades')}
                                                        ${renderPermLine('Servi\u00e7os / Estoque', 'servicos')}
                                                        ${renderPermLine('Or\u00e7amentos', 'orcamentos')}
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
        try {
            await db.auth.signOut();
        } catch (e) {
            console.warn('Logout error:', e);
        }

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

        const forceModal = document.getElementById('modalForcePasswordChange');
        if (forceModal) forceModal.classList.add('hidden');

        const loginView = document.getElementById('loginView');
        const appContainer = document.getElementById('appContainer');
        if (loginView) loginView.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';

        const loginEmail = document.getElementById('loginEmail');
        const loginPassword = document.getElementById('loginPassword');
        if (loginEmail) loginEmail.value = '';
        if (loginPassword) loginPassword.value = '';
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

async function createAndLinkProvisionalProfessional(ctx) {
    const empresaId = ctx && ctx.empresaId ? String(ctx.empresaId) : '';
    const usuarioId = ctx && ctx.usuarioId ? String(ctx.usuarioId) : '';
    const role = ctx && ctx.role ? String(ctx.role) : '';
    const email = ctx && ctx.email ? String(ctx.email) : '';
    if (!empresaId || !usuarioId) throw new Error('Dados insuficientes para vínculo do profissional.');

    const modal = document.getElementById('modalVinculoProfissional');
    const form = document.getElementById('formVinculoProfissional');
    const vpEmpresaId = document.getElementById('vpEmpresaId');
    const vpUsuarioId = document.getElementById('vpUsuarioId');
    const vpRole = document.getElementById('vpRole');
    const vpEmailLogin = document.getElementById('vpEmailLogin');
    const vpNome = document.getElementById('vpNomeProfissional');
    const vpTipo = document.getElementById('vpTipoProfissional');
    const btn = document.getElementById('btnVincularProfissional');

    if (!modal || !form || !vpEmpresaId || !vpUsuarioId || !vpRole || !vpEmailLogin || !vpNome || !vpTipo || !btn) {
        throw new Error('Tela de vínculo do profissional não disponível.');
    }

    vpEmpresaId.value = empresaId;
    vpUsuarioId.value = usuarioId;
    vpRole.value = role;
    vpEmailLogin.value = email;
    vpNome.value = '';

    if (role === 'protetico') {
        vpTipo.value = 'Protetico';
        vpTipo.disabled = true;
    } else {
        vpTipo.disabled = false;
        vpTipo.value = 'Especialista';
    }

    modal.classList.remove('hidden');

    return new Promise((resolve) => {
        form.__vpResolve = resolve;
        if (form.__vpSubmitBound) return;
        form.__vpSubmitBound = true;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = String(vpNome.value || '').trim();
            const tipo = String(vpTipo.value || '').trim();
            if (!nome) {
                showToast('Informe o nome do profissional.', true);
                return;
            }
            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Vinculando...';
            try {
                const empresaId2 = String(vpEmpresaId.value || '').trim();
                const usuarioId2 = String(vpUsuarioId.value || '').trim();
                const email2 = String(vpEmailLogin.value || '').trim();
                if (!empresaId2 || !usuarioId2) throw new Error('Dados insuficientes para vínculo do profissional.');

                let nextSeq = null;
                if (empresaId2 === currentEmpresaId) {
                    nextSeq = getNextSeqId(professionals);
                } else {
                    const q = db.from('profissionais')
                        .select('seqid')
                        .eq('empresa_id', empresaId2)
                        .order('seqid', { ascending: false })
                        .limit(1);
                    const { data, error } = await withTimeout(q, 15000, 'profissionais:max_seqid');
                    if (error) throw error;
                    const maxSeq = data && data[0] && data[0].seqid != null ? Number(data[0].seqid) : 0;
                    nextSeq = (Number.isFinite(maxSeq) ? maxSeq : 0) + 1;
                }

                const profData = {
                    id: generateId(),
                    seqid: nextSeq,
                    nome: `[INCOMPLETO] ${nome}`,
                    celular: '',
                    email: null,
                    tipo,
                    especialidadeid: null,
                    status: 'Ativo',
                    empresa_id: empresaId2,
                };
                const { data: created, error: insErr } = await withTimeout(
                    db.from('profissionais').insert(profData).select().single(),
                    20000,
                    'profissionais:provisorio:insert'
                );
                if (insErr) throw insErr;
                const profId = String((created && created.id) ? created.id : profData.id);

                const { error: linkErr } = await withTimeout(
                    db.from('profissional_usuarios').upsert(
                        { empresa_id: empresaId2, usuario_id: usuarioId2, profissional_id: profId },
                        { onConflict: 'empresa_id,usuario_id' }
                    ),
                    20000,
                    'profissional_usuarios:upsert'
                );
                if (linkErr) throw linkErr;

                if (created && empresaId2 === currentEmpresaId) {
                    professionals.push(created);
                }

                try {
                    await saveAgendaDisponibilidade(Number((created && created.seqid) ? created.seqid : profData.seqid), empresaId2);
                } catch { }

                modal.classList.add('hidden');
                const r = form.__vpResolve;
                form.__vpResolve = null;
                if (typeof r === 'function') r(true);
            } catch (err) {
                const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
                showToast(`Falha ao criar/vincular profissional: ${msg}`, true);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="ri-link"></i> Criar e Vincular';
            }
        });
    });
}
// --- TENANT ADMIN LOGIC ---
if (userAdminForm) {
    userAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editAdminUserId').value;
        const email = document.getElementById('adminUserEmail').value.trim();
        const password = document.getElementById('adminUserPassword').value;
        const role = normalizeRole(document.getElementById('adminUserRole').value);
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
            let permissions = {};
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
            if (role === 'admin') {
                permissions = buildFullPermissions();
            }

            if (id) {
                const empresaId = document.getElementById('editAdminEmpresaId') ? document.getElementById('editAdminEmpresaId').value : '';
                const targetEmpresaId = empresaId || currentEmpresaId;
                // Update existing user permissions/role in our mapping table
                const { error: updateError, count } = await db.from('usuario_empresas')
                    .update({
                        perfil: role,
                        permissoes: permissions
                    }, { count: 'exact' })
                    .eq('usuario_id', id)
                    .eq('empresa_id', targetEmpresaId);
                if (updateError) throw updateError;
                if (Number(count || 0) === 0) {
                    try {
                        const { data: { session } } = await db.auth.getSession();
                        if (!session) throw new Error("Sessão expirada.");
                        const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
                        const resp = await fetch(`${baseUrl}/functions/v1/update-tenant-user`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`,
                                'apikey': supabaseKey
                            },
                            body: JSON.stringify({
                                usuario_id: id,
                                empresa_id: targetEmpresaId,
                                role,
                                permissoes: permissions
                            })
                        });
                        const result = await resp.json();
                        if (!resp.ok) {
                            const errorMsg = result.error || result.message || 'Erro desconhecido na nuvem.';
                            throw new Error(`Erro na nuvem: ${errorMsg}`);
                        }
                    } catch (cloudErr) {
                        const msg = cloudErr && cloudErr.message ? cloudErr.message : String(cloudErr);
                        showToast(`Nenhuma alteração feita no banco. ${msg}`, true);
                        return;
                    }
                }

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

                const createdUserId = result && (result.userId || result.user_id || result.usuario_id)
                    ? String(result.userId || result.user_id || result.usuario_id)
                    : '';
                if ((role === 'dentista' || role === 'protetico') && createdUserId) {
                    await createAndLinkProvisionalProfessional({ empresaId: targetEmpresaId, usuarioId: createdUserId, role, email });
                    showToast("Usuário, profissional e vínculo criados com sucesso!");
                } else {
                    showToast("Usuário criado e vinculado com sucesso!");
                }
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
const adminUserRoleSelect = document.getElementById('adminUserRole');
if (adminUserRoleSelect) {
    adminUserRoleSelect.addEventListener('change', (e) => {
        const v = normalizeRole(e && e.target ? e.target.value : '');
        if (v === 'admin') applyAdminFullPermissionsToGrid();
    });
}

// --- EMPRESAS CRUD LOGIC ---
if (btnAddNewEmpresa) btnAddNewEmpresa.addEventListener('click', () => showForm(false, 'empresas'));
if (btnBackEmpresa) btnBackEmpresa.addEventListener('click', () => showList('empresas'));
if (btnCancelEmpresa) btnCancelEmpresa.addEventListener('click', () => showList('empresas'));
if (btnCloseAssinaturaModal) btnCloseAssinaturaModal.addEventListener('click', () => assinaturaModal.classList.add('hidden'));
if (btnCancelAssinaturaModal) btnCancelAssinaturaModal.addEventListener('click', () => assinaturaModal.classList.add('hidden'));
if (assinaturaModal) assinaturaModal.addEventListener('click', (e) => { if (e.target === assinaturaModal) assinaturaModal.classList.add('hidden'); });
if (btnClosePlanoConfigModal) btnClosePlanoConfigModal.addEventListener('click', () => planoConfigModal.classList.add('hidden'));
if (btnCancelPlanoConfigModal) btnCancelPlanoConfigModal.addEventListener('click', () => planoConfigModal.classList.add('hidden'));
if (planoConfigModal) planoConfigModal.addEventListener('click', (e) => { if (e.target === planoConfigModal) planoConfigModal.classList.add('hidden'); });
if (btnAddPlanoConfig) btnAddPlanoConfig.addEventListener('click', () => openPlanoConfigModal(null));

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
    if (planoConfigValor) planoConfigValor.value = item && item.valor_plano ? String(item.valor_plano) : '';
    if (planoConfigModulos) planoConfigModulos.value = item && item.modulos_texto ? String(item.modulos_texto) : '';
    if (planoConfigDestaque) planoConfigDestaque.checked = !!(item && item.destaque);
    planoConfigModal.classList.remove('hidden');
}

if (btnSaveAssinaturaModal) btnSaveAssinaturaModal.addEventListener('click', async () => {
    if (!isSuperAdmin) {
        showToast('Acesso restrito ao SuperAdmin.', true);
        return;
    }
    const id = String(assinaturaEmpresaId && assinaturaEmpresaId.value || '').trim();
    if (!id) return;
    const payload = {
        plano_tipo: String(assinaturaPlanoTipo && assinaturaPlanoTipo.value || '').trim() || null,
        data_vencimento: String(assinaturaDataVencimento && assinaturaDataVencimento.value || '').trim() || null,
        assinatura_status: String(assinaturaStatus && assinaturaStatus.value || '').trim() || 'PENDENTE'
    };
    const btn = btnSaveAssinaturaModal;
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Salvando...';
    try {
        const { error } = await db.from('empresas').update(payload).eq('id', id);
        if (error) throw error;
        const idx = (activeEmpresasList || []).findIndex(x => String(x && x.id || '') === id);
        if (idx >= 0) activeEmpresasList[idx] = { ...activeEmpresasList[idx], ...payload };
        assinaturaModal.classList.add('hidden');
        showToast('Assinatura atualizada com sucesso.');
        renderAssinaturas();
    } catch (err) {
        showToast(err && err.message ? String(err.message) : 'Falha ao atualizar assinatura.', true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
    }
});
if (btnSavePlanoConfigModal) btnSavePlanoConfigModal.addEventListener('click', async () => {
    if (!isSuperAdmin) {
        showToast('Acesso restrito ao SuperAdmin.', true);
        return;
    }
    const id = String(planoConfigId && planoConfigId.value || '').trim();
    const tipo = String(planoConfigTipoAssinatura && planoConfigTipoAssinatura.value || '').trim();
    const valor = String(planoConfigValor && planoConfigValor.value || '').trim();
    const modulos = String(planoConfigModulos && planoConfigModulos.value || '').trim();
    const destaque = !!(planoConfigDestaque && planoConfigDestaque.checked);
    if (!tipo || !valor || !modulos) {
        showToast('Preencha tipo, valor e módulos.', true);
        return;
    }
    const payload = {
        tipo_assinatura: tipo,
        valor_plano: valor,
        modulos_texto: modulos,
        destaque
    };
    const btn = btnSavePlanoConfigModal;
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Salvando...';
    try {
        if (id) {
            const { error } = await db.from('config_planos').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await db.from('config_planos').insert(payload);
            if (error) throw error;
        }
        planoConfigModal.classList.add('hidden');
        showToast('Plano salvo com sucesso.');
        fetchConfigPlanos();
    } catch (err) {
        showToast(err && err.message ? String(err.message) : 'Falha ao salvar plano.', true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
    }
});

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
            const telefone = String((document.getElementById('empresaTelefone') || {}).value || '').trim();
            const celular = String((document.getElementById('empresaCelular') || {}).value || '').trim();
            const email = String((document.getElementById('empresaEmail') || {}).value || '').trim().toLowerCase();

            if (!email) {
                showToast("E-mail da empresa é obrigatório.", true);
                return;
            }

            if (!oldId) {
                const { data: { session } } = await db.auth.getSession();
                if (!session) throw new Error("Sessão expirada.");
                const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
                const resp = await fetch(`${baseUrl}/functions/v1/create-tenant-company`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify({
                        empresa_id: newId,
                        identificador: newId,
                        nome,
                        email,
                        supervisor_pin: supervisorPin,
                        telefone: telefone || null,
                        celular: celular || null,
                        logotipo: logo || null,
                        assinatura_status: 'TRIAL'
                    })
                });
                const result = await resp.json();
                if (!resp.ok) {
                    const errorMsg = result.error || result.message || 'Erro desconhecido na nuvem.';
                    throw new Error(`Erro na nuvem: ${errorMsg}`);
                }
                const msg = result && (result.message || result.msg) ? String(result.message || result.msg) : `Clínica ${nome} cadastrada!`;
                showToast(msg);
                showToast(`📧 Login: ${email} | 🔑 Senha Inicial: 123456 (Será solicitado que você crie uma nova senha no primeiro acesso).`);
            } else {
            if (oldId && oldId !== newId) {
                document.getElementById('empresaId').value = oldId;
                showToast('Não é permitido alterar o Identificador (ID) da empresa.', true);
                return;
            }

            const empresaData = {
                nome,
                email,
                telefone: telefone || null,
                celular: celular || null,
                logotipo: logo || null,
                supervisor_pin: supervisorPin || null,
                plano_tipo: String((document.getElementById('empresaPlanoTipo') || {}).value || '').trim() || null,
                data_vencimento: String((document.getElementById('empresaDataVencimento') || {}).value || '').trim() || null,
                assinatura_status: String((document.getElementById('empresaAssinaturaStatus') || {}).value || '').trim() || null
            };

            const { error } = await db.from('empresas').update(empresaData).eq('id', oldId);
            if (error) throw error;
            showToast("Empresa salva com sucesso!");
            }

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
            .select('id, tipo_assinatura, valor_plano, modulos_texto, destaque')
            .order('destaque', { ascending: false })
            .order('tipo_assinatura', { ascending: true });
        if (error) throw error;
        configPlanosList = data || [];
        renderConfigPlanos();
    } catch (err) {
        console.error("Error fetching config_planos:", err);
        showToast("Erro ao carregar configuração de planos.", true);
    }
}

function renderConfigPlanos() {
    if (!configPlanosTableBody || !configPlanosEmptyState) return;
    configPlanosTableBody.innerHTML = '';
    const rows = Array.isArray(configPlanosList) ? [...configPlanosList] : [];
    if (rows.length === 0) {
        configPlanosEmptyState.classList.remove('hidden');
        return;
    }
    configPlanosEmptyState.classList.add('hidden');
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
            <td>${String(emp && emp.plano_tipo || '—')}</td>
            <td>${emp && emp.data_vencimento ? String(emp.data_vencimento).slice(0, 10) : '—'}</td>
            <td>${statusBadge}</td>
            <td><button class="btn-icon" title="Editar Assinatura"><i class="ri-edit-line"></i></button></td>
        `;
        const editBtn = tr.querySelector('button');
        if (editBtn) editBtn.addEventListener('click', () => openAssinaturaModal(emp));
        assinaturasTableBody.appendChild(tr);
    });
}

window.editPlanoConfig = function (id) {
    const item = (configPlanosList || []).find(x => String(x && x.id || '') === String(id || ''));
    if (!item) return;
    openPlanoConfigModal(item);
};

window.deletePlanoConfig = async function (id) {
    if (!isSuperAdmin) {
        showToast('Acesso restrito ao SuperAdmin.', true);
        return;
    }
    const pid = String(id || '').trim();
    if (!pid) return;
    const ok = window.confirm('Excluir este plano?');
    if (!ok) return;
    try {
        const { error } = await db.from('config_planos').delete().eq('id', pid);
        if (error) throw error;
        showToast('Plano excluído com sucesso.');
        fetchConfigPlanos();
    } catch (err) {
        showToast(err && err.message ? String(err.message) : 'Falha ao excluir plano.', true);
    }
};

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

window.editEmpresa = function (id) {
    const emp = activeEmpresasList.find(x => x.id === id);
    if (!emp) return;
    showForm(true, 'empresas', emp);
};

window.deleteEmpresa = async function (id) {
    showToast('Não é possível excluir este registro pois ele possui movimentações vinculadas. Sugerimos apenas inativar.', true);
    return;
};

function initMyCompanyForm() {
    const form = document.getElementById('myCompanyForm');
    if (!form) return;

    const idEl = document.getElementById('myCompanyId');
    const nomeEl = document.getElementById('myCompanyNome');
    const emailEl = document.getElementById('myCompanyEmail');
    const telEl = document.getElementById('myCompanyTelefone');
    const celEl = document.getElementById('myCompanyCelular');
    const logoFileEl = document.getElementById('myCompanyLogoFile');
    const logoBase64El = document.getElementById('myCompanyLogoBase64');
    const logoPreviewEl = document.getElementById('myCompanyLogoPreview');

    const emp = (activeEmpresasList || []).find(e => String(e && e.id || '') === String(currentEmpresaId || '')) || null;
    if (idEl) idEl.value = String(currentEmpresaId || '');
    if (nomeEl) nomeEl.value = emp && emp.nome ? String(emp.nome) : '';
    if (emailEl) emailEl.value = emp && emp.email ? String(emp.email) : '';
    if (telEl) telEl.value = emp && emp.telefone ? String(emp.telefone) : '';
    if (celEl) celEl.value = emp && emp.celular ? String(emp.celular) : '';
    if (logoBase64El) logoBase64El.value = emp && emp.logotipo ? String(emp.logotipo) : '';
    if (logoPreviewEl) {
        if (emp && emp.logotipo) {
            logoPreviewEl.innerHTML = `<img src="${String(emp.logotipo)}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            logoPreviewEl.innerHTML = `<i class="ri-image-line" style="font-size: 1.5rem; color: var(--text-muted);"></i>`;
        }
    }

    if (logoFileEl && !logoFileEl.__bound) {
        logoFileEl.__bound = true;
        logoFileEl.addEventListener('change', (e) => {
            const file = e && e.target && e.target.files ? e.target.files[0] : null;
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev && ev.target ? String(ev.target.result || '') : '';
                if (logoBase64El) logoBase64El.value = base64;
                if (logoPreviewEl) logoPreviewEl.innerHTML = `<img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;">`;
            };
            reader.readAsDataURL(file);
        });
    }

    if (!form.__bound) {
        form.__bound = true;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSaveMyCompany');
            const nome = String(nomeEl && nomeEl.value || '').trim();
            const email = String(emailEl && emailEl.value || '').trim().toLowerCase();
            const telefone = String(telEl && telEl.value || '').trim();
            const celular = String(celEl && celEl.value || '').trim();
            const logotipo = String(logoBase64El && logoBase64El.value || '').trim();

            if (!nome || !email) {
                showToast('Nome e e-mail são obrigatórios.', true);
                return;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Salvando...';
            }

            try {
                const { data, error } = await withTimeout(
                    db.rpc('rpc_update_empresa_profile', {
                        p_empresa_id: String(currentEmpresaId || ''),
                        p_nome: nome,
                        p_email: email,
                        p_telefone: telefone || null,
                        p_celular: celular || null,
                        p_logotipo: logotipo || null
                    }),
                    20000,
                    'empresas:rpc_update_empresa_profile'
                );
                if (error) throw error;

                const row = Array.isArray(data) ? data[0] : data;
                if (row && row.id) {
                    const idx = (activeEmpresasList || []).findIndex(x => String(x && x.id || '') === String(row.id || ''));
                    if (idx >= 0) activeEmpresasList[idx] = row;
                }

                showToast('Dados da clínica atualizados com sucesso!');
            } catch (err) {
                const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
                showToast(`Falha ao salvar: ${msg}`, true);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ri-save-line"></i> Salvar';
                }
            }
        });
    }
}

// --- SERVICE PRINT LIST LOGIC ---
const btnPrintSpecialtiesReport = document.getElementById('btnPrintSpecialtiesReport');
const btnPrintServiceList = document.getElementById('btnPrintServiceList');
const servicePrintFilterModal = document.getElementById('servicePrintFilterModal');
const btnCloseServicePrintModal = document.getElementById('btnCloseServicePrintModal');
const btnCancelServicePrint = document.getElementById('btnCancelServicePrint');
const btnConfirmServicePrint = document.getElementById('btnConfirmServicePrint');
const printFilterSubdivisao = document.getElementById('printFilterSubdivisao');

if (btnPrintSpecialtiesReport) {
    btnPrintSpecialtiesReport.addEventListener('click', () => {
        window.printSpecialtiesMasterDetail();
    });
}

if (btnPrintServiceList) {
    btnPrintServiceList.addEventListener('click', () => {
        window.printServiceList();
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
        'empresasListView', 'empresasFormView', 'patientDetailsView'];
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
document.getElementById('btnBackDetails')?.addEventListener('click', () => showList('patients'));

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
            const rawProfId = b.profissional_id ?? b.profissionalid ?? b.profissionalId;
            const prof = professionals.find(p => String(p.id) === String(rawProfId) || String(p.seqid) === String(rawProfId));
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

        const replaceObsBudgetTag = (obs) => {
            if (!obs) return obs;
            try {
                const v = String(obs);
                const replBudgetNum = (match, seq) => {
                    return String(match)
                        .replace(/Orç\.?\s*#/i, 'Orçamento ')
                        .replace(/Orçamento\s*#/i, 'Orçamento ')
                        .replace('#', '')
                        .replace(String(seq), String(seq));
                };
                return v
                    .replace(/\[(Orçamento|Orcamento|Orç\.?|Orc\.?)\s*#\s*(\d+)\]/gi, (m, _lbl, seq) => `[Orçamento ${seq}]`)
                    .replace(/\((Orçamento|Orcamento|Orç\.?|Orc\.?)\s*#\s*(\d+)\)/gi, (m, _lbl, seq) => `(Orçamento ${seq})`)
                    .replace(/(Orçamento|Orcamento|Orç\.?|Orc\.?)\s*#\s*(\d+)/gi, (m, _lbl, seq) => replBudgetNum(m, seq));
            } catch { /* ignore */ }
            return obs;
        };

        const extractBudgetSeqFromObs = (obs) => {
            if (!obs) return '';
            const s = String(obs);
            const m = s.match(/(?:Orç\.?\s*#|Orc\.?\s*#|Orçamento\s*#|Orcamento\s*#)\s*(\d{1,})/i);
            return m && m[1] ? String(m[1]) : '';
        };

        const needsBudgetSeq = [];
        (data || []).forEach(t => {
            const pid = t && t.paciente_id != null ? String(t.paciente_id) : '';
            const hasPat = !!patients.find(p => String(p.seqid) === pid || String(p.id) === pid);
            if (hasPat) return;
            const seq = extractBudgetSeqFromObs(t && t.observacoes ? t.observacoes : '');
            if (seq) needsBudgetSeq.push(seq);
        });

        const budgetSeqInfo = new Map();
        if (needsBudgetSeq.length && currentEmpresaId) {
            const uniq = Array.from(new Set(needsBudgetSeq)).slice(0, 200);
            try {
                const { data: orcs, error: oErr } = await withTimeout(
                    db.from('orcamentos')
                        .select('seqid,paciente_id,pacienteid,pacientenome')
                        .eq('empresa_id', currentEmpresaId)
                        .in('seqid', uniq.map(n => Number(n))),
                    15000,
                    'financeiro:orcamentos:seqid'
                );
                if (!oErr && Array.isArray(orcs)) {
                    orcs.forEach(o => {
                        if (o && o.seqid != null) {
                            budgetSeqInfo.set(String(o.seqid), {
                                pacienteUuid: String(o.pacienteid || o.paciente_id || ''),
                                pacienteNome: String(o.pacientenome || '')
                            });
                        }
                    });
                }
            } catch { }
            try {
                const { data: canc, error: cErr } = await withTimeout(
                    db.from('orcamento_cancelados')
                        .select('orcamento_seqid,paciente_nome')
                        .eq('empresa_id', currentEmpresaId)
                        .in('orcamento_seqid', uniq.map(n => Number(n))),
                    15000,
                    'financeiro:orcamento_cancelados'
                );
                if (!cErr && Array.isArray(canc)) {
                    canc.forEach(r => {
                        if (r && r.orcamento_seqid != null) {
                            const k = String(r.orcamento_seqid);
                            const prev = budgetSeqInfo.get(k) || { pacienteUuid: '', pacienteNome: '' };
                            budgetSeqInfo.set(k, { ...prev, pacienteNome: prev.pacienteNome || String(r.paciente_nome || '') });
                        }
                    });
                }
            } catch { }
        }

        // Fallback adicional: extrair OP #<seqid> da observação e resolver paciente via ordens_proteticas
        const extractOpSeqFromObs = (obs) => {
            if (!obs) return '';
            const s = String(obs);
            const m = s.match(/OP\s*#\s*(\d{1,})/i);
            return m && m[1] ? String(m[1]) : '';
        };
        const needsOpSeq = [];
        (data || []).forEach(t => {
            const pid = t && t.paciente_id != null ? String(t.paciente_id) : '';
            const hasPat = !!patients.find(p => String(p.seqid) === pid || String(p.id) === pid);
            if (hasPat) return;
            const op = extractOpSeqFromObs(t && t.observacoes ? t.observacoes : '');
            if (op) needsOpSeq.push(op);
        });
        const opSeqInfo = new Map();
        if (needsOpSeq.length && currentEmpresaId) {
            const uniqOps = Array.from(new Set(needsOpSeq)).slice(0, 200);
            try {
                const { data: ops, error: opErr } = await withTimeout(
                    db.from('ordens_proteticas')
                        .select('seqid,paciente_id,orcamento_id')
                        .eq('empresa_id', currentEmpresaId)
                        .in('seqid', uniqOps.map(n => Number(n))),
                    15000,
                    'financeiro:ordens_proteticas:seqid'
                );
                if (!opErr && Array.isArray(ops)) {
                    ops.forEach(o => {
                        if (o && o.seqid != null) {
                            opSeqInfo.set(String(o.seqid), {
                                pacienteUuid: String(o.paciente_id || ''),
                                orcamentoId: String(o.orcamento_id || '')
                            });
                        }
                    });
                }
            } catch { }
        }

        transactions = (data || []).map(t => {
            let pat = patients.find(p => String(p.seqid) === String(t.paciente_id));
            if (!pat) pat = patients.find(p => String(p.id) === String(t.paciente_id));
            let obsDisplay = replaceObsBudgetTag(t.observacoes || '');
            if (!pat) {
                try {
                    const mId = String(t.observacoes || '').match(/\[Orçamento\s+([0-9a-f\-]{8,})\]/i);
                    const mSeq = String(t.observacoes || '').match(/\[Orçamento\s*#(\d+)\]/i);
                    let b = null;
                    if (mId && mId[1]) b = (budgets || []).find(x => String(x.id) === String(mId[1]));
                    if (!b && mSeq && mSeq[1]) b = (budgets || []).find(x => String(x.seqid) === String(mSeq[1]));
                    if (b) {
                        pat = patients.find(p => String(p.id) === String(b.pacienteid || b.paciente_id));
                        obsDisplay = replaceObsBudgetTag(t.observacoes || '');
                    }
                } catch { /* ignore */ }
            }
            let pacienteNomeFallback = '';
            if (!pat) {
                const seq = extractBudgetSeqFromObs(t.observacoes || '');
                if (seq) {
                    const info = budgetSeqInfo.get(String(seq));
                    const uuid = info && info.pacienteUuid ? String(info.pacienteUuid) : '';
                    if (uuid) pat = patients.find(p => String(p.id) === uuid) || patients.find(p => String(p.seqid) === uuid);
                    pacienteNomeFallback = info && info.pacienteNome ? String(info.pacienteNome) : '';
                }
            }
            if (!pat) {
                const op = extractOpSeqFromObs(t.observacoes || '');
                if (op) {
                    const info = opSeqInfo.get(String(op));
                    const uuid = info && info.pacienteUuid ? String(info.pacienteUuid) : '';
                    if (uuid) pat = patients.find(p => String(p.id) === uuid) || patients.find(p => String(p.seqid) === uuid);
                }
            }
            return {
                ...t,
                paciente_nome: pat ? pat.nome : (pacienteNomeFallback || '—'),
                observacoes_display: obsDisplay
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
    try {
        // 1. Fetch transaction details to see if it belongs to a budget payment
        const { data: trans, error: fError } = await db.from('financeiro_transacoes').select('*').eq('id', id).single();
        if (fError) throw fError;

        const catKey = String(trans && trans.categoria || '').trim().toUpperCase();
        const hasRef = trans && trans.referencia_id != null && String(trans.referencia_id).trim() !== '';
        if (hasRef || ['PAGAMENTO', 'CONSUMO', 'ESTORNO', 'TRANSFERENCIA', 'TRANSFERÊNCIA', 'REEMBOLSO'].includes(catKey)) {
            showToast('Integridade de Dados: não é permitido excluir lançamentos financeiros com histórico/vínculos. Sugerimos estornar ou inativar.', true);
            return;
        }

        if (!confirm("Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita e pode afetar o saldo do paciente.")) return;

        // 2. If it's a budget payment, find and delete the record in orcamento_pagamentos
        if (trans.categoria === 'PAGAMENTO' && trans.referencia_id) {
            // Find in orcamento_pagamentos (using seqid since it's common for referenca_id)
            const { error: pError } = await db.from('orcamento_pagamentos')
                .delete()
                .eq('orcamento_id', trans.referencia_id)
                .eq('valor_pago', trans.valor)
                .eq('empresa_id', currentEmpresaId);

            if (pError) console.warn("Could not delete from orcamento_pagamentos:", pError);
        }

        // 3. Delete from main financeiro_transacoes
        const { error: dError } = await db.from('financeiro_transacoes').delete().eq('id', id);
        if (dError) throw dError;

        showToast("Lançamento excluído com sucesso.");

        // 4. Refresh data
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
        showToast("Erro ao excluir lançamento.", true);
    }
}

// Hook up Financeiro search and listeners
(function () {
    if (!window.__financeiroHeaderBound) {
        window.__financeiroHeaderBound = true;
        if (btnMovDiaria) btnMovDiaria.addEventListener('click', () => openMovDiariaModal());
        if (btnPagamentosPacientes) btnPagamentosPacientes.addEventListener('click', () => openPagamentosPacientesModal());
        if (btnFechamentoDiarioFull) btnFechamentoDiarioFull.addEventListener('click', () => openFechamentoDiarioFullModal());
    }

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
            const obs = transacaoObs.value;

            if (!pacId || !cat || isNaN(valor) || valor <= 0) {
                showToast("Preencha todos os campos obrigatórios corretamente.", true);
                return;
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
    const totalPago = budget.total_pago || 0;
    const saldo = totalOrcado - totalPago;

    const body = document.getElementById('budgetDetailBody');
    if (!body) return;

    let paymentsHtml = '';
    if (budget.pagamentos && budget.pagamentos.length > 0) {
        paymentsHtml = `
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
                    ${budget.pagamentos.map(p => `
                        <tr>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${formatDateTime(p.data_pagamento || p.data)}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">R$ ${Number(p.valor_pago).toFixed(2)}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${p.forma_pagamento}</td>
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
    } else {
        paymentsHtml = '<p style="color: var(--text-muted); margin-top: 0.5rem;">Nenhum pagamento registrado.</p>';
    }

    let itemsHtml = `
        <table class="simple-table" style="margin-top: 1rem; width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead style="background: var(--bg-hover);">
                <tr>
                    <th style="padding: 0.5rem; text-align: left;">Procedimento</th>
                    <th style="padding: 0.5rem; text-align: left;">Dente</th>
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
        const dentes = formatOrcamentoItemElementos(it);

        return `
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                            <strong>${desc}</strong><br>
                            <small style="color: var(--text-muted)">Prof: ${profNome}</small>
                        </td>
                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${dentes || '-'}</td>
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
    showToast('Integridade de Dados: não é permitido excluir pagamentos. Sugerimos estornar o pagamento para manter histórico contábil.', true);
    return;
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

        // 2. Tentar inserir espelho em financeiro_transacoes (Conta Corrente)
        // Se a forma for 'Saldo em Conta', não inserimos nada aqui, pois o DÉBITO real
        // acontece no momento da Liberação/Consumo do item.
        if (forma === 'Saldo em Conta') {
            showToast("Pagamento via Saldo registrado!");
        } else {
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

        await autoReleaseEligibleBudgetItems(budget, `Auto-Liberado via Pagamento (${currentUser.email.split('@')[0]})`);
        await syncBudgetStatusToExecutedIfAllFinalized(budget.id);

        console.log("DEBUG V19: Atualizando interface via viewBudgetPayments...");
        viewBudgetPayments(budgetId);
        if (!budgetsListView.classList.contains('hidden')) {
            renderTable(budgets, 'budgets');
        }

    } catch (error) {
        console.error("Error recording payment:", error);
        showToast("Erro ao processar pagamento no banco de dados.", true);
    }
};

async function autoReleaseEligibleBudgetItems(budget, autorizadoPor) {
    try {
        const itens = budget.orcamento_itens || budget.itens || [];
        let valorLiberado = itens
            .filter(it => ['Liberado', 'Em Execução', 'Finalizado'].includes(it.status))
            .reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);

        const pending = itens.filter(it => !['Liberado', 'Em Execução', 'Finalizado'].includes(it.status));
        if (!pending.length) return;

        let releasedCount = 0;
        for (const item of pending) {
            const itemTotal = (parseFloat(item.valor) || 0) * (parseInt(item.qtde) || 1);
            if (valorLiberado + itemTotal > (Number(budget.total_pago || 0) + 0.01)) break;

            const profId = item.profissional_id;
            const profissional = professionals.find(p => p.seqid == profId);
            let valorComissao = 0;
            if (profissional) valorComissao = calculateCommission(profissional, item, budget);

            const { error: itErr } = await db.from('orcamento_itens').update({
                status: 'Liberado',
                autorizado_por: autorizadoPor
            }).eq('id', item.id);
            if (itErr) throw itErr;

            item.status = 'Liberado';
            item.autorizado_por = autorizadoPor;

            if (valorComissao > 0) {
                const { data: existing, error: exErr } = await withTimeout(
                    db.from('financeiro_comissoes')
                        .select('id')
                        .eq('item_id', item.id)
                        .eq('empresa_id', currentEmpresaId)
                        .maybeSingle(),
                    15000,
                    'financeiro_comissoes:auto_exists'
                );
                if (exErr) throw exErr;
                if (!existing) {
                    const nowIso = new Date().toISOString();
                    const comissaoData = {
                        profissional_id: profId,
                        item_id: item.id,
                        valor_comissao: valorComissao,
                        status: 'PENDENTE',
                        data_geracao: nowIso,
                        empresa_id: currentEmpresaId
                    };
                    const { error: cErr } = await db.from('financeiro_comissoes').insert(comissaoData);
                    if (cErr) throw cErr;
                }
            }

            try {
                const pacIdRaw = budget.pacienteid || budget.paciente_id;
                const patientObj = patients.find(p => p.id === pacIdRaw || p.seqid == pacIdRaw);
                const pacNumId = patientObj ? patientObj.seqid : (budget.pacienteseqid || budget.paciente_id);
                const desc = item.descricao || 'Serviço';
                const debitoData = {
                    paciente_id: pacNumId,
                    tipo: 'DEBITO',
                    categoria: 'PAGAMENTO',
                    valor: itemTotal,
                    observacoes: `[Consumo] ${desc} (Orçamento #${budget.seqid})`,
                    referencia_id: budget.seqid,
                    empresa_id: currentEmpresaId,
                    criado_por: currentUser.id
                };
                await db.from('financeiro_transacoes').insert(debitoData);
            } catch (debErr) {
                console.warn("Aviso: Não foi possível registrar o débito do serviço no financeiro.", debErr);
            }

            valorLiberado += itemTotal;
            releasedCount += 1;
        }

        if (releasedCount > 0) {
            showToast(`Itens liberados automaticamente: ${releasedCount}`);
        }
    } catch (err) {
        console.error("Erro ao liberar itens automaticamente:", err);
        showToast(`Pagamento confirmado, mas falhou ao liberar itens: ${err.message || 'Erro desconhecido'}`, true);
    }
}

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
                const nowIso = new Date().toISOString();
                const comissaoData = {
                    profissional_id: profId,
                    item_id: item.id,
                    valor_comissao: valorComissao,
                    status: 'PENDENTE',
                    data_geracao: nowIso,
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
        if (isAdminRole() || normalizeRole(currentUserRole) === 'supervisor') {
            realizarLiberacao(`Auto-Autorizado (${normalizeRole(currentUserRole)}: ${currentUser.email.split('@')[0]})`);
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

    const pagamentos = (budget && budget.pagamentos) ? budget.pagamentos : [];
    const formas = (pagamentos || []).map(p => String(p && p.forma_pagamento ? p.forma_pagamento : '')).filter(Boolean);
    const hasCard = formas.some(f => f.toLowerCase().includes('cart'));
    const hasPix = formas.some(f => f.toLowerCase().includes('pix'));
    const hasNonCash = formas.some(f => f.toLowerCase() !== 'dinheiro');

    let percComissao = 0;
    if (tipo === 'Clinico') {
        if (hasCard) percComissao = parseFloat(rules.cc) || 0;
        else if (hasPix) percComissao = parseFloat(rules.cp) || 0;
        else percComissao = parseFloat(rules.ce) || 0;
    } else if (tipo === 'Especialista') {
        if (hasCard) percComissao = parseFloat(rules.ec) || 0;
        else if (hasPix) percComissao = parseFloat(rules.ep) || 0;
        else percComissao = parseFloat(rules.ee) || 0;
    } else if (tipo === 'Protetico') {
        percComissao = parseFloat(rules.cp) || 0;
    }

    // Regra: (Valor total - Custo Protético)
    const baseLiquida = totalItem - valorProtetico;
    if (baseLiquida <= 0) return 0;

    // Se houver QUALQUER pagamento que NÃO seja dinheiro, aplica imposto
    const temPagamentoComTaxa = hasNonCash;

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

async function syncBudgetStatusToExecutedIfAllFinalized(budgetId) {
    if (!budgetId) return;
    try {
        const { data, error } = await withTimeout(
            db.from('orcamento_itens')
                .select('status')
                .eq('empresa_id', currentEmpresaId)
                .eq('orcamento_id', budgetId),
            15000,
            'orcamento_itens:sync_executado'
        );
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        if (!rows.length) return;
        const allFinal = rows.every(r => ['finalizado', 'concluido', 'concluído'].includes(String(r && r.status || '').trim().toLowerCase()));
        if (!allFinal) return;

        const { error: bErr } = await withTimeout(
            db.from('orcamentos')
                .update({ status: 'Executado' })
                .eq('id', budgetId),
            15000,
            'orcamentos:set_executado'
        );
        if (bErr) throw bErr;

        const b = budgets.find(x => String(x.id) === String(budgetId));
        if (b) b.status = 'Executado';
    } catch (e) {
        console.warn('Falha ao sincronizar status do orçamento para Executado:', e);
    }
}

window.finalizeBudgetItem = async function (budgetId, itemId) {
    if (!confirm('Confirmar a conclusão deste serviço?')) return;

    try {
        const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
        if (!budget) return;
        const prevStatus = String(budget.status || '').trim();

        await window.generateCommissionForItem(budgetId, itemId, true);

        // 1. Atualizar o item para Finalizado no banco
        const { error: itErr } = await db.from('orcamento_itens')
            .update({ status: 'Finalizado' })
            .eq('id', itemId);

        if (itErr) throw itErr;

        // 2. Atualizar estado local
        const item = (budget.orcamento_itens || []).find(it => it.id === itemId);
        if (item) item.status = 'Finalizado';

        try {
            await withTimeout(
                db.rpc('rpc_try_close_orcamento', { p_empresa_id: String(currentEmpresaId || ''), p_orcamento_id: String(budget.id || '') }),
                15000,
                'rpc_try_close_orcamento'
            );
        } catch (e) {
            await syncBudgetStatusToExecutedIfAllFinalized(budget.id);
        }

        const { data: budRow, error: budErr } = await withTimeout(
            db.from('orcamentos')
                .select('status')
                .eq('id', budget.id)
                .eq('empresa_id', currentEmpresaId)
                .maybeSingle(),
            15000,
            'orcamentos:status'
        );
        if (budErr) throw budErr;

        const newStatus = budRow && budRow.status ? String(budRow.status).trim() : prevStatus;
        budget.status = newStatus;
        const wasEligible = ['aprovado', 'em andamento', 'em_andamento', 'em execucao', 'em execução'].includes(prevStatus.toLowerCase());
        if (wasEligible && newStatus.toLowerCase() === 'executado') {
            showToast('Todos os itens finalizados. Orçamento encerrado com sucesso!');
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

window.generateCommissionForItem = async function (budgetId, itemId, silent) {
    try {
        const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
        if (!budget) {
            if (!silent) showToast('Orçamento não encontrado.', true);
            return false;
        }
        const item = (budget.orcamento_itens || budget.itens || []).find(it => it.id === itemId);
        if (!item) {
            if (!silent) showToast('Item não encontrado.', true);
            return false;
        }
        const profId = item.profissional_id;
        if (!profId) {
            if (!silent) showToast('Item sem profissional executor. Comissão não será gerada.', true);
            return false;
        }

        const { data: existing, error: exErr } = await withTimeout(
            db.from('financeiro_comissoes')
                .select('id')
                .eq('item_id', item.id)
                .eq('empresa_id', currentEmpresaId)
                .maybeSingle(),
            15000,
            'financeiro_comissoes:exists'
        );
        if (exErr) throw exErr;
        if (existing && existing.id) {
            if (!silent) showToast('Comissão já existe para este item.');
            return true;
        }

        const prof = (professionals || []).find(p => String(p.seqid) === String(profId));
        if (!prof) {
            if (!silent) showToast('Profissional executor não encontrado. Comissão não será gerada.', true);
            return false;
        }

        const valorComissao = calculateCommission(prof, item, budget);
        if (!(valorComissao > 0)) {
            if (!silent) showToast('Comissão calculada = 0. Verifique regras de comissão no Profissional.', true);
            return false;
        }

        const nowIso = new Date().toISOString();
        const comissaoData = {
            profissional_id: profId,
            item_id: item.id,
            valor_comissao: valorComissao,
            status: 'PENDENTE',
            data_geracao: nowIso,
            empresa_id: currentEmpresaId
        };
        const { error: insErr } = await withTimeout(
            db.from('financeiro_comissoes').insert(comissaoData),
            15000,
            'financeiro_comissoes:insert'
        );
        if (insErr) throw insErr;
        if (!silent) showToast(`Comissão gerada: R$ ${valorComissao.toFixed(2)}`);
        return true;
    } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        if (!silent) showToast(`Falha ao gerar comissão: ${msg}`, true);
        return false;
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
            } else {
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


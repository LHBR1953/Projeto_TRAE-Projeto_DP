
(function () {
const adminUserRoleSelect = document.getElementById('adminUserRole');

function normalizeModuleKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function isTruthyModuleFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const v = String(value).trim().toLowerCase();
        return v === 'true' || v === '1' || v === 'ativo' || v === 'active' || v === 'sim' || v === 'yes';
    }
    if (value && typeof value === 'object') {
        return !!(value.select || value.active || value.ativo || value.enabled || value.habilitado);
    }
    return false;
}

function getSystemModulesRef() {
    if (typeof systemModules !== 'undefined' && Array.isArray(systemModules)) return systemModules;
    if (Array.isArray(window.systemModules)) return window.systemModules;
    return [];
}

function getActiveEmpresasListRef() {
    if (typeof activeEmpresasList !== 'undefined' && Array.isArray(activeEmpresasList)) return activeEmpresasList;
    if (Array.isArray(window.activeEmpresasList)) return window.activeEmpresasList;
    return [];
}

function getConfigPlanosListRef() {
    if (typeof configPlanosList !== 'undefined' && Array.isArray(configPlanosList)) return configPlanosList;
    if (Array.isArray(window.configPlanosList)) return window.configPlanosList;
    return [];
}

function getCurrentEmpresaIdRef() {
    if (typeof currentEmpresaId !== 'undefined') return currentEmpresaId;
    return window.currentEmpresaId || '';
}

function getDbClientRef() {
    if (typeof db !== 'undefined' && db && typeof db.from === 'function') return db;
    if (window.db && typeof window.db.from === 'function') return window.db;
    if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
    return null;
}

function resolvePlanDisplayNameRef(value) {
    if (typeof resolvePlanDisplayName === 'function') return resolvePlanDisplayName(value);
    if (typeof window.resolvePlanDisplayName === 'function') return window.resolvePlanDisplayName(value);
    return value;
}

function ensureStockModelsModuleEntry() {
    const modules = getSystemModulesRef();
    if (!Array.isArray(modules)) return;
    const exists = modules.some(mod => String(mod && mod.id || '') === 'estoque_modelos');
    if (!exists) {
        modules.push({ id: 'estoque_modelos', label: 'Estoque: Modelos de Uso' });
    }
}

function ensurePlanManagedModuleEntries() {
    const modules = getSystemModulesRef();
    if (!Array.isArray(modules)) return;
    const requiredModules = [
        { id: 'nfse', label: 'Emitir NFS-e' },
        { id: 'suporte', label: 'Suporte' },
        { id: 'tickets', label: 'Suporte: Tickets' },
        { id: 'chat_portal', label: 'Suporte: Chat do Portal' },
        { id: 'auditoria', label: 'Auditoria' }
    ];
    requiredModules.forEach(required => {
        const exists = modules.some(mod => String(mod && mod.id || '') === required.id);
        if (!exists) modules.push(required);
    });
}

const moduleAliasFamilies = {
    estoque_modelos: [
        'estoque_modelos',
        'estoque_modelo_uso',
        'Estoque: Modelo de Uso',
        'Estoque: Modelos',
        'Estoque: Modelos de Uso'
    ],
    nfse: [
        'nfse',
        'emissao_nfse',
        'navNfse',
        'Emitir NFS-e',
        'NFSe',
        'NFS-e'
    ],
    suporte: [
        'suporte',
        'support',
        'navSupport',
        'navSuporte',
        'Suporte'
    ],
    tickets: [
        'tickets',
        'suporte_tickets',
        'suporteTickets',
        'navSuporteTickets',
        'Suporte: Tickets'
    ],
    chat_portal: [
        'chat_portal',
        'portal_chat',
        'portalChat',
        'navPortalChat',
        'Suporte: Chat do Portal',
        'Chat do Portal'
    ],
    auditoria: [
        'auditoria',
        'audit',
        'navAudit',
        'Auditoria'
    ]
};
const allowedModulesCache = new Map();
let permissionsGridRenderToken = 0;

function expandCollectedModuleAliases(collector) {
    if (!collector || typeof collector.forEach !== 'function') return;
    Object.keys(moduleAliasFamilies).forEach(familyKey => {
        const normalizedAliases = moduleAliasFamilies[familyKey].map(normalizeModuleKey).filter(Boolean);
        const hasAnyAlias = normalizedAliases.some(alias => collector.has(alias));
        if (!hasAnyAlias) return;
        normalizedAliases.forEach(alias => collector.add(alias));
        collector.add(normalizeModuleKey(familyKey));
    });
    const suporteAliases = (moduleAliasFamilies.suporte || []).map(normalizeModuleKey).filter(Boolean);
    const hasSuporte = suporteAliases.some(alias => collector.has(alias));
    if (hasSuporte) {
        ['tickets', 'chat_portal'].forEach(key => {
            (moduleAliasFamilies[key] || []).map(normalizeModuleKey).filter(Boolean).forEach(alias => collector.add(alias));
            collector.add(normalizeModuleKey(key));
        });
    }
}

function getModuleAliasValues(modOrKey) {
    const familyKey = typeof modOrKey === 'string'
        ? normalizeModuleKey(modOrKey)
        : normalizeModuleKey(modOrKey && modOrKey.id || '');
    const baseAliases = typeof modOrKey === 'string' ? [modOrKey] : getModuleAliases(modOrKey);
    const familyAliases = moduleAliasFamilies[familyKey] || [];
    return Array.from(new Set(baseAliases.concat(familyAliases).map(normalizeModuleKey).filter(Boolean)));
}

function clonePermissionValue(value) {
    return {
        select: !!(value && value.select),
        insert: !!(value && value.insert),
        update: !!(value && value.update),
        delete: !!(value && value.delete)
    };
}

function setModuleChecksState(tbody, moduleId, checked, disabled) {
    const checks = tbody.querySelectorAll(`.perm-check[data-mod="${moduleId}"], .perm-all[data-mod="${moduleId}"]`);
    checks.forEach(check => {
        check.checked = !!checked;
        if (typeof disabled === 'boolean') {
            check.disabled = disabled;
        }
    });
}

function syncSupportHierarchyUi(tbody) {
    if (!tbody) return;
    const parentChecks = tbody.querySelectorAll('.perm-check[data-mod="suporte"], .perm-all[data-mod="suporte"]');
    if (!parentChecks.length) return;
    const supportEnabled = Array.from(parentChecks).some(check => !!check.checked);
    ['tickets', 'chat_portal'].forEach(childId => {
        setModuleChecksState(tbody, childId, supportEnabled, !supportEnabled);
    });
}

function installSupportHierarchyListener(tbody) {
    if (!tbody || tbody.__occSupportHierarchyBound) return;
    tbody.__occSupportHierarchyBound = true;
    tbody.addEventListener('change', (event) => {
        const target = event && event.target;
        if (!target || !target.matches) return;
        if (!target.matches('.perm-check[data-mod="suporte"], .perm-all[data-mod="suporte"]')) return;
        syncSupportHierarchyUi(tbody);
    });
}

function getModuleAliases(mod) {
    const id = String(mod && mod.id || '');
    const label = String(mod && mod.label || '');
    const aliases = [id, label];
    if (id === 'estoque_modelos') {
        aliases.push(
            'Estoque: Modelo de Uso',
            'Estoque: Modelos de Uso',
            'Estoque: Modelos',
            'estoque_modelo_uso',
            'estoque_modelos'
        );
    }
    if (id === 'nfse' || normalizeModuleKey(label).indexOf('nfs_e') >= 0) {
        aliases.push('Emitir NFS-e', 'NFSe', 'NFS-e', 'nfse');
    }
    if (id === 'suporte') {
        aliases.push('Suporte', 'support', 'navSupport', 'navSuporte');
    }
    if (id === 'tickets') {
        aliases.push('tickets', 'suporte_tickets', 'suporteTickets', 'navSuporteTickets', 'Suporte: Tickets');
    }
    if (id === 'chat_portal') {
        aliases.push('chat_portal', 'portal_chat', 'portalChat', 'navPortalChat', 'Suporte: Chat do Portal', 'Chat do Portal');
    }
    if (id === 'auditoria' || id === 'audit_cancelados') {
        aliases.push('Auditoria', 'audit', 'navAudit', 'audit_cancelados', 'auditLog');
    }
    return aliases.map(normalizeModuleKey).filter(Boolean);
}

function parseAllowedModulesFromValue(source, collector) {
    if (source == null) return;
    if (Array.isArray(source)) {
        source.forEach(item => parseAllowedModulesFromValue(item, collector));
        return;
    }
    if (typeof source === 'string') {
        String(source)
            .split(/[,\n;|]/)
            .map(item => normalizeModuleKey(item))
            .filter(Boolean)
            .forEach(item => collector.add(item));
        return;
    }
    if (typeof source === 'object') {
        Object.keys(source).forEach(key => {
            const value = source[key];
            if (isTruthyModuleFlag(value)) {
                collector.add(normalizeModuleKey(key));
            }
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                parseAllowedModulesFromValue(value, collector);
            }
        });
    }
}

function mergeEmpresaSnapshotIntoState(empData) {
    if (!empData || !empData.id) return;
    const empresas = getActiveEmpresasListRef();
    const idx = empresas.findIndex(e => String(e && e.id || '') === String(empData.id || ''));
    if (idx >= 0) {
        empresas[idx] = Object.assign({}, empresas[idx], empData);
        return;
    }
    empresas.push(empData);
}

function mergePlanoSnapshotIntoState(planData) {
    if (!planData) return;
    const planos = getConfigPlanosListRef();
    const idx = planos.findIndex(p =>
        String(p && p.id || '') === String(planData.id || '')
        || String(p && p.tipo_assinatura || '') === String(planData.tipo_assinatura || '')
    );
    if (idx >= 0) {
        planos[idx] = Object.assign({}, planos[idx], planData);
        return;
    }
    planos.push(planData);
}

function collectAllowedModulesFromEmpresaState(emp) {
    const collector = new Set();
    if (!emp) return collector;
    parseAllowedModulesFromValue(emp.modulos_contratados, collector);
    parseAllowedModulesFromValue(emp.modulos, collector);
    parseAllowedModulesFromValue(emp.modulos_liberados, collector);
    const configPlanos = getConfigPlanosListRef();
    if (!collector.size && emp.plano_tipo && configPlanos.length) {
        const planName = resolvePlanDisplayNameRef(emp.plano_tipo);
        const planCfg = configPlanos.find(p =>
            String(p && p.tipo_assinatura || '') === String(planName || '')
            || String(p && p.id || '') === String(emp.plano_tipo || '')
            || String(p && p.tipo_assinatura || '') === String(emp.plano_tipo || '')
        );
        if (planCfg) {
            parseAllowedModulesFromValue(planCfg.modulos_texto, collector);
            parseAllowedModulesFromValue(planCfg.modulos, collector);
        }
    }
    expandCollectedModuleAliases(collector);
    return collector;
}

function getAllowedModuleSet(targetEmpresaId) {
    ensurePlanManagedModuleEntries();
    const empId = targetEmpresaId || getCurrentEmpresaIdRef();
    const empresas = getActiveEmpresasListRef();
    const emp = empresas.find(e => String(e && e.id || '') === String(empId || ''));
    const collector = collectAllowedModulesFromEmpresaState(emp);

    if (!collector.size) return null;

    return collector;
}

async function fetchAllowedModuleSet(targetEmpresaId, forceReload = false) {
    ensurePlanManagedModuleEntries();
    const empId = String(targetEmpresaId || getCurrentEmpresaIdRef() || '').trim();
    if (!empId) return getAllowedModuleSet(empId);
    if (!forceReload && allowedModulesCache.has(empId)) {
        return allowedModulesCache.get(empId);
    }

    const client = getDbClientRef();
    if (client && typeof client.from === 'function') {
        try {
            const { data: empData, error: empErr } = await client
                .from('empresas')
                .select('id, nome, plano_tipo, modulos_contratados, modulos, modulos_liberados')
                .eq('id', empId)
                .maybeSingle();
            if (!empErr && empData) {
                mergeEmpresaSnapshotIntoState(empData);
                if (empData.plano_tipo) {
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(empData.plano_tipo || ''));
                    let planResult = null;
                    if (isUuid) {
                        planResult = await client.from('config_planos')
                            .select('id, tipo_assinatura, modulos_texto, modulos')
                            .eq('id', empData.plano_tipo)
                            .maybeSingle();
                    } else {
                        planResult = await client.from('config_planos')
                            .select('id, tipo_assinatura, modulos_texto, modulos')
                            .ilike('tipo_assinatura', String(empData.plano_tipo || ''))
                            .maybeSingle();
                    }
                    if (planResult && !planResult.error && planResult.data) {
                        mergePlanoSnapshotIntoState(planResult.data);
                    }
                }
            }
        } catch (err) {
            console.warn('Erro isolado ao consultar módulos contratados da empresa selecionada:', err);
        }
    }

    const allowedSet = getAllowedModuleSet(empId);
    allowedModulesCache.set(empId, allowedSet);
    return allowedSet;
}

function resolveTargetEmpresaId(targetEmpresaId = null) {
    const explicit = String(targetEmpresaId || '').trim();
    if (explicit) return explicit;
    const editHidden = document.getElementById('editAdminEmpresaId');
    const editValue = String(editHidden && editHidden.value || '').trim();
    if (editValue) return editValue;
    const companySelect = document.getElementById('adminUserCompany');
    const selectedCompany = String(companySelect && companySelect.value || '').trim();
    if (selectedCompany) return selectedCompany;
    return String(getCurrentEmpresaIdRef() || '').trim();
}

function isModuleAllowed(mod, allowedSet) {
    if (!allowedSet) return true;
    const aliases = getModuleAliases(mod);
    return aliases.some(alias => allowedSet.has(alias));
}

function patchedBuildFullPermissions() {
    ensureStockModelsModuleEntry();
    ensurePlanManagedModuleEntries();
    const perms = {};
    getSystemModulesRef().forEach(mod => {
        perms[mod.id] = { select: true, insert: true, update: true, delete: true };
    });
    return perms;
}

function patchedApplyAdminFullPermissionsToGrid() {
    const tbody = document.getElementById('permissionsTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('.perm-check').forEach(c => {
        c.checked = true;
    });
    tbody.querySelectorAll('.perm-all').forEach(c => {
        c.checked = true;
    });
}

function buildDefaultPermissionsForModule(mod, existingPerms) {
    if (existingPerms && typeof existingPerms === 'object') {
        const direct = existingPerms[mod.id];
        if (direct) return clonePermissionValue(direct);
        const aliases = getModuleAliasValues(mod);
        for (let i = 0; i < aliases.length; i += 1) {
            const aliasPerm = existingPerms[aliases[i]];
            if (aliasPerm) return clonePermissionValue(aliasPerm);
        }
    }
    return { select: false, insert: false, update: false, delete: false };
}

function renderPermissionsRows(tbody, existingPerms, allowedModules) {
    tbody.innerHTML = '';
    getSystemModulesRef().forEach(mod => {
        if (!isModuleAllowed(mod, allowedModules)) return;

        const tr = document.createElement('tr');
        const p = buildDefaultPermissionsForModule(mod, existingPerms);

        tr.innerHTML = `
            <td><strong>${mod.label}</strong></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="select" ${p && p.select ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="insert" ${p && p.insert ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="update" ${p && p.update ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-check" data-mod="${mod.id}" data-action="delete" ${p && p.delete ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" class="perm-all" data-mod="${mod.id}" ${p && p.select && p.insert && p.update && p.delete ? 'checked' : ''}></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.perm-all').forEach(allCheck => {
        allCheck.addEventListener('change', (e) => {
            const modId = e.target.getAttribute('data-mod');
            const checks = tbody.querySelectorAll(`.perm-check[data-mod="${modId}"]`);
            checks.forEach(c => { c.checked = e.target.checked; });
        });
    });
    installSupportHierarchyListener(tbody);
    syncSupportHierarchyUi(tbody);
}

function filterPermissionsByAllowedModules(permissions, allowedModules) {
    if (!permissions || typeof permissions !== 'object') return {};
    if (!allowedModules) return Object.assign({}, permissions);
    const result = {};
    getSystemModulesRef().forEach(mod => {
        if (!isModuleAllowed(mod, allowedModules)) return;
        const basePerm = clonePermissionValue(permissions[mod.id] || buildDefaultPermissionsForModule(mod, permissions));
        result[mod.id] = basePerm;
        getModuleAliasValues(mod).forEach(alias => {
            result[alias] = clonePermissionValue(basePerm);
        });
    });
    return result;
}

function enforceSupportHierarchyPermissions(permissions) {
    const result = permissions && typeof permissions === 'object' ? permissions : {};
    const supportAliases = getModuleAliasValues('suporte');
    const childKeys = ['tickets', 'chat_portal'];
    const supportEnabled = supportAliases.some(alias => {
        const value = result[alias];
        return !!(value && (value.select || value.insert || value.update || value.delete));
    });
    childKeys.forEach(childKey => {
        const childPerm = supportEnabled
            ? { select: true, insert: true, update: true, delete: true }
            : { select: false, insert: false, update: false, delete: false };
        getModuleAliasValues(childKey).forEach(alias => {
            result[alias] = clonePermissionValue(childPerm);
        });
        result[childKey] = clonePermissionValue(childPerm);
    });
    return result;
}

async function patchedRenderPermissionsGrid(existingPerms = null, targetEmpresaId = null) {
    ensureStockModelsModuleEntry();
    ensurePlanManagedModuleEntries();
    const tbody = document.getElementById('permissionsTableBody');
    if (!tbody) return;
    const renderToken = ++permissionsGridRenderToken;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; opacity:.75;">Carregando módulos herdados do plano...</td></tr>';
    const resolvedEmpresaId = resolveTargetEmpresaId(targetEmpresaId);
    const allowedModules = await fetchAllowedModuleSet(resolvedEmpresaId, true);
    if (renderToken !== permissionsGridRenderToken) return;
    renderPermissionsRows(tbody, existingPerms, allowedModules);
}

ensureStockModelsModuleEntry();
ensurePlanManagedModuleEntries();
window.buildFullPermissions = patchedBuildFullPermissions;
window.applyAdminFullPermissionsToGrid = patchedApplyAdminFullPermissionsToGrid;
window.renderPermissionsGrid = patchedRenderPermissionsGrid;
window.getAllowedModuleSetForUserCompany = fetchAllowedModuleSet;
window.filterPermissionsByAllowedModules = filterPermissionsByAllowedModules;
window.enforceSupportHierarchyPermissions = enforceSupportHierarchyPermissions;

if (adminUserRoleSelect && !adminUserRoleSelect.__occUsersPatchBound) {
    adminUserRoleSelect.__occUsersPatchBound = true;
    adminUserRoleSelect.addEventListener('change', (e) => {
        const value = e && e.target ? e.target.value : '';
        const role = typeof window.normalizeRole === 'function' ? window.normalizeRole(value) : String(value || '').toLowerCase().trim();
        if (role === 'admin') {
            window.applyAdminFullPermissionsToGrid();
        }
    });
}
})();

/*
 * PONTE DE INTEGRAÇÃO MONOREPO: Projeto_GeradorRelatorios
 * Cria um menu restrito exclusivo para a role 'superadmin' que roteia para o 
 * sistema de relatórios avançado.
 * O roteamento é sensível ao ambiente (localhost vs produção).
 */
function initSuperAdminReportsMenu() {
    // 1. Trava de Segurança Contratual/Acesso: apenas superadmin
    if (typeof isSuperAdmin === 'undefined' || !isSuperAdmin) {
        return;
    }

    if (document.getElementById('navGeradorRelatoriosSuperAdmin')) {
        return;
    }

    // 3. Comportamento e Design da Interface
    const btn = document.createElement('button');
    btn.id = 'navGeradorRelatoriosSuperAdmin';
    btn.className = 'nav-item';
    btn.style.display = 'flex';
    btn.title = 'Avançado: Gerador de Relatórios';
    // Usando Remix Icon conforme padrão do sistema
    btn.innerHTML = `<i class="ri-bar-chart-box-line"></i> <span>Gerador de Relatórios</span>`;
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 2. Roteamento Inteligente (Ambientes) com Injeção de Empresa Ativa
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const baseUrl = isLocalhost ? 'http://localhost:3000/' : 'https://seu-gerador.vercel.app/';
        
        // Resgata a variável global que armazena a empresa ativa no OCC
        const empId = typeof currentEmpresaId !== 'undefined' ? currentEmpresaId : '';
        const targetUrl = empId ? `${baseUrl}?empresa_id=${empId}` : baseUrl;
        
        window.open(targetUrl, '_blank');
    });

    // Injeta no container de menus administrativos
    const sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar) return;

    const navAuditLog = document.getElementById('navAuditLog');
    if (navAuditLog && navAuditLog.parentNode === sidebar) {
        sidebar.insertBefore(btn, navAuditLog.nextSibling);
    } else {
        sidebar.appendChild(btn);
    }
}

// Monitorador de estado para renderizar e proteger o menu dinamicamente
setInterval(() => {
    const btn = document.getElementById('navGeradorRelatoriosSuperAdmin');
    const isSuper = typeof isSuperAdmin !== 'undefined' && isSuperAdmin;
    
    if (isSuper) {
        if (!btn) {
            initSuperAdminReportsMenu();
        } else {
            btn.style.display = 'flex';
        }
    } else {
        if (btn) {
            btn.style.display = 'none';
        }
    }
}, 1000);

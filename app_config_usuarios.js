
const navUsersAdminBtn = document.getElementById('navUsersAdmin');
const usersAdminView = document.getElementById('usersAdminView');
const userAdminFormView = document.getElementById('userAdminFormView');

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

// Users Admin DOM Elements
const btnAddNewUser = document.getElementById('btnAddNewUser');
const btnBackUserAdmin = document.getElementById('btnBackUserAdmin');
const btnCancelUserAdmin = document.getElementById('btnCancelUserAdmin');
const userAdminForm = document.getElementById('userAdminForm');
const usersAdminTableBody = document.getElementById('usersAdminTableBody');
const usersAdminEmptyState = document.getElementById('usersAdminEmptyState');
const userAdminFormTitle = document.getElementById('userAdminFormTitle');
let usersAdminList = [];
const adminUserRoleSelect = document.getElementById('adminUserRole');
if (adminUserRoleSelect) { adminUserRoleSelect.addEventListener('change', (e) => { const v = window.normalizeRole ? window.normalizeRole(e && e.target ? e.target.value : '') : (typeof normalizeRole !== 'undefined' ? normalizeRole(e && e.target ? e.target.value : '') : ''); if (v === 'admin') { if(window.applyAdminFullPermissionsToGrid) window.applyAdminFullPermissionsToGrid(); else if(typeof applyAdminFullPermissionsToGrid !== 'undefined') applyAdminFullPermissionsToGrid(); } }); }

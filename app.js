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
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

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


async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return false;

    currentUser = session.user;

    // Fetch user mapping to know their company context
    const { data: mappings, error } = await db.from('usuario_empresas')
        .select('*, empresas(nome)')
        .eq('usuario_id', currentUser.id)
        .limit(1); // Take the first valid mapping to avoid single() errors

    const mapping = (mappings && mappings.length > 0) ? mappings[0] : null;

    if (error) {
        console.error("Database error in checkAuth mapping search:", error);
        await db.auth.signOut();
        return false;
    }

    if (!mapping) {
        if (currentUser.email === SUPER_ADMIN_EMAIL) {
            isSuperAdmin = true;
            currentEmpresaId = 'emp_master';
            currentUserRole = 'admin';
            currentUserPerms = {}; // SuperAdmin has all permissions via bypass
            console.log("DEBUG: SuperAdmin Logged in via fallback (no mapping found)");
        } else {
            console.warn("User record not found in clinician mapping (usuario_empresas). User ID:", currentUser.id, "Email:", currentUser.email);
            await db.auth.signOut();
            return false;
        }
    } else {
        currentEmpresaId = mapping.empresa_id;
        currentUserRole = mapping.perfil;
        currentUserPerms = (typeof mapping.permissoes === 'string') ? JSON.parse(mapping.permissoes) : (mapping.permissoes || {});
        isSuperAdmin = (currentUser.email === SUPER_ADMIN_EMAIL);
    }

    console.log("DEBUG Auth Info:", { currentEmpresaId, currentUserRole, currentUserPerms, isSuperAdmin });

    const uiName = document.getElementById('userNameDisplay');
    const uiRole = document.getElementById('userRoleDisplay');
    if (uiName) uiName.textContent = currentUser.email.split('@')[0];
    if (uiRole) uiRole.textContent = (mapping.empresas && mapping.empresas.nome) ? mapping.empresas.nome + ' (' + mapping.perfil + ')' : 'Clínica (' + mapping.perfil + ')';

    // Show Admin Menu if user is admin
    if (mapping.perfil === 'admin') {
        const navConfigSection = document.getElementById('navConfigSection');
        const navEmpresas = document.getElementById('navEmpresas');
        const navUsersAdmin = document.getElementById('navUsersAdmin');

        if (navConfigSection) navConfigSection.style.display = 'block';

        // ONLY SuperAdmin sees "Cadastro de Empresas"
        if (navEmpresas) {
            navEmpresas.style.display = isSuperAdmin ? 'flex' : 'none';
        }

        if (navUsersAdmin) navUsersAdmin.style.display = 'flex';
    }

    return true;
}

// Map UI types to permission keys
function getModuleKey(type) {
    const map = {
        'patients': 'pacientes',
        'professionals': 'profissionais',
        'specialties': 'especialidades',
        'services': 'servicos',
        'budgets': 'orcamentos'
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

async function initializeApp() {
    try {
        // Check if user arrived via a password recovery link
        const urlHash = window.location.hash;
        if (urlHash.includes('type=recovery')) {
            // Show the reset password view - Supabase will fire PASSWORD_RECOVERY event
            document.getElementById('loginCard').style.display = 'none';
            document.getElementById('resetPasswordView').style.display = 'block';
            return;
        }

        const isAuth = await checkAuth();
        if (!isAuth) {
            document.getElementById('loginView').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
            return;
        }

        document.getElementById('loginView').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';

        const [patientsRes, professionalsRes, specialtiesRes, subdivisionsRes, servicesRes, budgetsRes, empresasRes] = await Promise.all([
            db.from('pacientes').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('profissionais').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('especialidades').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('especialidade_subdivisoes').select('*').eq('empresa_id', currentEmpresaId),
            db.from('servicos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('orcamentos').select('*, orcamento_itens(*)').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true }),
            db.from('empresas').select('*').order('nome')
        ]);

        if (patientsRes.error) throw patientsRes.error;
        if (professionalsRes.error) throw professionalsRes.error;
        if (specialtiesRes.error) throw specialtiesRes.error;
        if (subdivisionsRes.error) throw subdivisionsRes.error;
        if (servicesRes.error) throw servicesRes.error;
        if (budgetsRes.error) throw budgetsRes.error;
        if (empresasRes.error) throw empresasRes.error;

        patients = patientsRes.data || [];
        professionals = professionalsRes.data || [];
        activeEmpresasList = empresasRes.data || [];

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
            spec.subdivisoes = subdivisions.filter(sub => sub.especialidade_id === spec.id);
        });

        services = servicesRes.data || [];
        budgets = budgetsRes.data || [];

        console.log("DEBUG Fetched Data Lengths:", {
            patients: patients.length,
            professionals: professionals.length,
            specialties: specialties.length,
            subdivisions: subdivisions.length,
            services: services.length,
            budgets: budgets.length
        });

        // Pre-fill default specialties if empty for this company
        if (specialties.length === 0) {
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
        showList('patients');
        setupNavigationListeners();

    } catch (error) {
        console.error("Error initializing app data from Supabase:", error);
        showToast("Erro ao carregar dados do servidor.", true);
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
const navPatients = document.getElementById('navPatients');
const navProfessionals = document.getElementById('navProfessionals');
const navSpecialties = document.getElementById('navSpecialties');
const navServices = document.getElementById('navServices');
const navBudgets = document.getElementById('navBudgets');
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

const navEmpresas = document.getElementById('navEmpresas');
const btnAddNewEmpresa = document.getElementById('btnAddNewEmpresa');
const btnBackEmpresa = document.getElementById('btnBackEmpresa');
const btnCancelEmpresa = document.getElementById('btnCancelEmpresa');
const empresaForm = document.getElementById('empresaForm');
const empresaLogoFile = document.getElementById('empresaLogoFile');
const empresaLogoBase64 = document.getElementById('empresaLogoBase64');
const logoPreviewContainer = document.getElementById('logoPreviewContainer');

const systemModules = [
    { id: 'pacientes', label: 'Pacientes' },
    { id: 'profissionais', label: 'Profissionais' },
    { id: 'especialidades', label: 'Especialidades' },
    { id: 'servicos', label: 'Serviços/Estoque' },
    { id: 'orcamentos', label: 'Orçamentos' }
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
const navUsersAdminBtn = document.getElementById('navUsersAdmin');

// Active State
let currentSpecialtySubdivisions = [];
let editingSubSpecIndex = -1;
let currentBudgetItems = [];
let editingBudgetItemId = null;
let usersAdminList = []; // Cache for user management

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

// Mobile Menu Toggle
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

// Navigation Logic
function setActiveTab(tab) {
    console.log("setActiveTab called with:", tab);
    // Reset all tabs
    navPatients.classList.remove('active');
    navProfessionals.classList.remove('active');
    if (navSpecialties) navSpecialties.classList.remove('active');
    if (navServices) navServices.classList.remove('active');
    if (navBudgets) navBudgets.classList.remove('active');
    if (navUsersAdminBtn) navUsersAdminBtn.classList.remove('active');
    if (navEmpresas) navEmpresas.classList.remove('active');

    // Hide all views
    patientListView.classList.add('hidden');
    patientFormView.classList.add('hidden');
    professionalListView.classList.add('hidden');
    professionalFormView.classList.add('hidden');
    if (specialtiesListView) specialtiesListView.classList.add('hidden');
    if (specialtyFormView) specialtyFormView.classList.add('hidden');
    if (servicesListView) servicesListView.classList.add('hidden');
    if (serviceFormView) serviceFormView.classList.add('hidden');
    if (budgetsListView) budgetsListView.classList.add('hidden');
    if (budgetFormView) budgetFormView.classList.add('hidden');
    if (usersAdminView) usersAdminView.classList.add('hidden');
    if (userAdminFormView) userAdminFormView.classList.add('hidden');
    if (empresasListView) empresasListView.classList.add('hidden');
    if (empresaFormView) empresaFormView.classList.add('hidden');

    if (tab === 'patients') {
        navPatients.classList.add('active');
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
    } else {
        navProfessionals.classList.add('active');
        showList('professionals');
    }

    // Auto-close sidebar on mobile after clicking a link
    if (window.innerWidth <= 900) {
        sidebar.classList.remove('active');
    }
}

function setupNavigationListeners() {
    const navMapping = {
        'navPatients': 'patients',
        'navProfessionals': 'professionals',
        'navSpecialties': 'specialties',
        'navServices': 'services',
        'navBudgets': 'budgets',
        'navUsersAdmin': 'usersAdmin',
        'navEmpresas': 'empresas'
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
function renderTable(data = patients, type = 'patients') {
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
                    ${can('servicos', 'delete') ? `
                    <button class="btn-icon delete-btn" onclick="deleteService('${s.id}')" title="Deletar">
                        <i class="ri-delete-bin-line"></i>
                    </button>` : ''}
                </td>
            `;
            servicesTableBody.appendChild(tr);
        });
    } else if (type === 'usersAdmin') {
        const usersAdminTableBody = document.getElementById('usersAdminTableBody');
        if (!usersAdminTableBody) return;
        usersAdminTableBody.innerHTML = '';
        if (data.length === 0) {
            usersAdminTableBody.parentElement.style.display = 'none';
            document.getElementById('usersAdminEmptyState').classList.remove('hidden');
            return;
        }
        usersAdminTableBody.parentElement.style.display = 'table';
        document.getElementById('usersAdminEmptyState').classList.add('hidden');

        usersAdminList = data; // Cache for editing

        data.forEach(u => {
            const tr = document.createElement('tr');
            // Safety check for user ID and email
            const userId = u.usuario_id || 'N/A';
            const userEmail = u.user_email || userId;
            const shortId = userId.length > 8 ? userId.substring(0, 8) : userId;
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
                    <button class="btn-icon" onclick="editTenantUser('${userId}')" title="Editar Permissões">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="btn-icon delete-btn" onclick="removeTenantUser('${userId}')" title="Remover Acesso">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            `;
            usersAdminTableBody.appendChild(tr);
        });
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

            tr.innerHTML = `
                <td>${b.seqid}</td>
                <td>
                    <strong>${b.pacientenome}</strong><br>
                    <small style="color:var(--text-muted)">${b.pacientecelular}</small>
                </td>
                <td>${qtdItens} itens</td>
                <td><strong style="color: var(--primary-color)">R$ ${total.toFixed(2)}</strong></td>
                <td>
                    <span style="background: var(--bg-hover); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                        ${b.status || 'Pendente'}
                    </span>
                </td>
                <td class="actions-cell">
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
                ? `<img src="${p.photo}" class="photo-thumb" alt="Foto">`
                : `<div class="photo-thumb"><i class="ri-user-line"></i></div>`;

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
            document.getElementById('budgetFormTitle').innerText = editMode ? 'Editar Orçamento' : 'Novo Orçamento';
        }
        if (document.getElementById('budIdDisplay')) {
            document.getElementById('budIdDisplay').value = editMode ? '' : 'Novo';
        }

        // Load patients into dropdown
        const patSelect = document.getElementById('budPacienteId');
        if (patSelect) {
            patSelect.innerHTML = '<option value="">Selecione um Paciente...</option>';
            patients.forEach(p => {
                patSelect.innerHTML += `<option value="${p.id}">${p.nome} (${p.cpf})</option>`;
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
                    budProfSelect.innerHTML += `<option value="${p.seqid}">${p.seqid} - ${p.nome} (${p.tipo || ''})</option>`;
                });
        }

        if (!editMode) {
            currentBudgetItems = [];
            if (typeof renderBudgetItemsTable === 'function') renderBudgetItemsTable();
            if (document.getElementById('budNomePaciente')) document.getElementById('budNomePaciente').value = '';
            if (document.getElementById('budCelularPaciente')) document.getElementById('budCelularPaciente').value = '';
            if (document.getElementById('budEmailPaciente')) document.getElementById('budEmailPaciente').value = '';
            if (document.getElementById('budStatus')) document.getElementById('budStatus').value = 'Pendente';
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
            base64Input.value = dataObj.logotipo || '';
            if (dataObj.logotipo) {
                logoPreview.innerHTML = `<img src="${dataObj.logotipo}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                logoPreview.innerHTML = `<i class="ri-image-line" style="font-size: 1.5rem; color: var(--text-muted);"></i>`;
            }
        } else {
            empresaForm.reset();
            base64Input.value = '';
            logoPreview.innerHTML = `<i class="ri-image-line" style="font-size: 1.5rem; color: var(--text-muted);"></i>`;
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
        }
    }
}

function showList(type = 'patients') {
    console.log("showList called with:", type);

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
    if (type === 'patients') {
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

        // Fetch real team data
        // For SuperAdmin, we might want to see ALL users across ALL companies, 
        // but for now, we follow the currentEmpresaId filter to be safe.
        let query = db.from('usuario_empresas')
            .select('usuario_id, perfil, user_email, permissoes, empresa_id');

        // If SuperAdmin, we could potentially remove the filter, 
        // but let's stick to currentEmpresaId and see if it helps with isolation.
        if (!isSuperAdmin) {
            query = query.eq('empresa_id', currentEmpresaId);
        }

        query.then(({ data, error }) => {
            console.log("DEBUG Users Admin Raw Data:", data);
            if (error) {
                console.error("Error fetching users admin:", error);
                showToast("Erro ao carregar lista de usuários.", true);
                return;
            }
            if (data) {
                renderTable(data, 'usersAdmin');
            }
        })
            .catch(err => {
                console.error("Panic in usersAdmin fetch:", err);
                showToast("Erro fatal ao carregar usuários.", true);
            });
    } else if (type === 'empresas') {
        if (empresaFormView) empresaFormView.classList.add('hidden');
        if (empresasListView) empresasListView.classList.remove('hidden');
        if (empresaForm) empresaForm.reset();
        document.getElementById('editEmpresaOldId').value = '';
        fetchEmpresas();
    } else {
        professionalFormView.classList.add('hidden');
        professionalListView.classList.remove('hidden');
        professionalForm.reset();
        document.getElementById('editProfessionalId').value = '';
        comissionCard.style.display = 'none';
        renderTable(professionals, 'professionals');
    }
}

// Global action to delete user mapping
window.removeTenantUser = async function (usuario_id) {
    if (confirm('Tem certeza que deseja REVOGAR O ACESSO deste usuário à sua clínica? Este usuário não poderá mais entrar no sistema.')) {
        try {
            const { error } = await db.from('usuario_empresas').delete().eq('usuario_id', usuario_id).eq('empresa_id', currentEmpresaId);
            if (error) throw error;
            showToast('Acesso revogado com sucesso!');
            showList('usersAdmin'); // refresh table
        } catch (error) {
            console.error("Error revoking user access:", error);
            showToast("Erro ao remover usuário.", true);
        }
    }
};

window.editTenantUser = function (usuario_id) {
    const u = usersAdminList.find(user => user.usuario_id === usuario_id);
    if (!u) return;

    showForm(true, 'usersAdmin');
    document.getElementById('userAdminFormTitle').innerText = 'Editar Usuário';
    document.getElementById('editAdminUserId').value = u.usuario_id;

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

    try {
        if (id) {
            const { error } = await db.from('profissionais').update(profData).eq('id', id);
            if (error) throw error;

            const index = professionals.findIndex(p => p.id === id);
            if (index !== -1) professionals[index] = { ...professionals[index], ...profData };
            showToast('Profissional atualizado com sucesso!');
        } else {
            profData.id = generateId();
            profData.seqid = getNextSeqId(professionals);

            const { data, error } = await db.from('profissionais').insert(profData).select().single();
            if (error) throw error;

            if (data) professionals.push(data);
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
    if (confirm('Tem certeza que deseja excluir as informações deste paciente? O paciente e atrelados serão apagados.')) {
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
};

window.deleteProfessional = async function (id) {
    if (!can('profissionais', 'delete')) {
        showToast("Você não tem permissão para excluir profissionais.", true);
        return;
    }
    if (confirm('Tem certeza que deseja excluir as informações deste profissional?')) {
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
    if (confirm('Tem certeza que deseja excluir esta especialidade? Profissionais podem perder a referência.')) {
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

// Initial Render
renderTable(patients, 'patients');
renderTable(professionals, 'professionals');
renderTable(specialties, 'specialties');
renderTable(services, 'services');

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
        showList('budgets');
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

// Auto-fill Patient Data
const budPacienteId = document.getElementById('budPacienteId');
if (budPacienteId) {
    budPacienteId.addEventListener('change', (e) => {
        const id = e.target.value;
        const pat = patients.find(p => p.id === id);
        if (pat) {
            document.getElementById('budNomePaciente').value = pat.nome || '';
            document.getElementById('budCelularPaciente').value = pat.celular || pat.telefone || '';
            document.getElementById('budEmailPaciente').value = pat.email || '';
        } else {
            document.getElementById('budNomePaciente').value = '';
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
                profSelect.innerHTML += `<option value="${p.seqid}">${p.seqid} - ${p.nome}</option>`;
            });
    }

    // 2. Profissional Executor (Dropdown por item)
    const executorSelect = document.getElementById('budItemExecutorId');
    if (executorSelect) {
        executorSelect.innerHTML = '<option value="">Selecione...</option>';
        professionals
            .filter(p => (p.tipo || '').toLowerCase() !== 'protetico')
            .forEach(p => {
                executorSelect.innerHTML += `<option value="${p.seqid}">${p.seqid} - ${p.nome} (${p.tipo || ''})</option>`;
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

        const id = document.getElementById('editBudgetId').value;
        const patId = document.getElementById('budPacienteId').value;

        if (!patId) {
            showToast('Selecione um Paciente.', true);
            return;
        }

        if (document.getElementById('addBudgetItemPanel').style.display === 'block') {
            showToast('Você tem um item em edição. Clique em "Confirmar Item" antes de salvar o orçamento.', true);
            return;
        }

        if (currentBudgetItems.length === 0) {
            showToast('Adicione e confirme pelo menos um item ao orçamento antes de salvar.', true);
            return;
        }

        const pat = patients.find(p => p.id === patId);

        const budgetData = {
            pacienteid: patId,
            pacientenome: pat.nome,
            pacientecelular: pat.celular || pat.telefone,
            pacienteemail: pat.email,
            status: document.getElementById('budStatus').value,
            profissional_id: parseInt(document.getElementById('budProfissionalId')?.value) || null,
            empresa_id: currentEmpresaId
        };

        try {
            let orcamentoId = id;

            if (id) {
                const { error } = await db.from('orcamentos').update(budgetData).eq('id', id);
                if (error) throw error;

                // For updates, we delete existing items first to fully overwrite them
                const { error: delError } = await db.from('orcamento_itens').delete().eq('orcamento_id', id);
                if (delError) throw delError;

                const index = budgets.findIndex(b => b.id === id);
                if (index !== -1) budgets[index] = { ...budgets[index], ...budgetData };
                showToast('Orçamento atualizado com sucesso!');
            } else {
                budgetData.id = generateId();
                budgetData.seqid = getNextSeqId(budgets);

                const { data: inserted, error } = await db.from('orcamentos').insert(budgetData).select().single();
                if (error) throw error;

                orcamentoId = inserted.id;
                budgets.push(inserted);
                showToast('Orçamento cadastrado com sucesso!');
            }

            // Prepare items properly formatted for PostgreSQL DB
            const itemsPayload = currentBudgetItems.map(item => ({
                id: item.id || generateId(),
                orcamento_id: orcamentoId,
                empresa_id: currentEmpresaId,
                servico_id: item.servicoId,
                valor: item.valor,
                qtde: item.qtde,
                protetico_id: parseInt(item.proteticoId) || null,
                valor_protetico: item.valorProtetico || 0,
                profissional_id: parseInt(item.profissionalId) || null,
                subdivisao: item.subdivisao || '',
                status: item.status || 'Pendente'
            }));

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

            showList('budgets');
        } catch (error) {
            console.error("Error saving budget:", error);
            showToast("Erro ao salvar orçamento.", true);
        }
    });
}

window.editBudget = function (id) {
    const b = budgets.find(bud => bud.id === id);
    if (!b) return;

    showForm(true, 'budgets');
    document.getElementById('budIdDisplay').value = b.seqid || '';
    document.getElementById('editBudgetId').value = b.id;

    // Set Patient Combobox
    document.getElementById('budPacienteId').value = b.pacienteid;
    document.getElementById('budNomePaciente').value = b.pacientenome;
    document.getElementById('budCelularPaciente').value = b.pacientecelular || '';
    document.getElementById('budEmailPaciente').value = b.pacienteemail || '';
    document.getElementById('budStatus').value = b.status || 'Pendente';

    // Set Responsible Professional
    if (document.getElementById('budProfissionalId')) {
        document.getElementById('budProfissionalId').value = b.profissional_id || '';
    }

    // Load Items List mapped from db row orcamento_itens back to state
    currentBudgetItems = (b.orcamento_itens || []).map(item => {
        const servData = services.find(s => s.id === item.servico_id);
        const profData = professionals.find(p => p.id === item.protetico_id);

        return {
            id: item.id,
            servicoId: item.servico_id,
            servicoDescricao: servData ? servData.descricao : 'Serviço Excluído/Desconhecido',
            subdivisao: item.subdivisao || (servData ? servData.subdivisao : '-'),
            valor: item.valor,
            qtde: item.qtde,
            proteticoId: item.protetico_id,
            proteticoNome: professionals.find(p => p.seqid == item.protetico_id || p.id === item.protetico_id)?.nome || '',
            valorProtetico: item.valor_protetico,
            profissionalId: item.profissional_id,
            executorNome: professionals.find(p => p.seqid == item.profissional_id)?.nome || '',
            status: item.status || 'Pendente'
        };
    });

    renderBudgetItemsTable();

    // Enable the "Adicionar Item" button since we have a patient selected
    if (typeof validateBudgetMasterForm === 'function') validateBudgetMasterForm();
};

window.deleteBudget = async function (id) {
    if (!can('orcamentos', 'delete')) {
        showToast("Você não tem permissão para excluir orçamentos.", true);
        return;
    }
    if (confirm('Tem certeza que deseja excluir este orçamento?')) {
        try {
            const { error } = await db.from('orcamentos').delete().eq('id', id);
            if (error) throw error;

            budgets = budgets.filter(b => b.id !== id);
            renderTable(budgets, 'budgets');
            showToast('Orçamento removido com sucesso!');
        } catch (error) {
            console.error("Error deleting budget:", error);
            showToast("Erro ao remover orçamento.", true);
        }
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
                                <div class="clinic-name">\uD83E\uDDBA OdontoClinic</div>
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
                                        <div class="clinic-name">\uD83E\uDDBA OdontoClinic</div>
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
                                                    <div class="clinic-name">\uD83E\uDDBA OdontoClinic</div>
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
                                                    <div class="clinic-name">\uD83E\uDDBA OdontoClinic</div>
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
                                                    <div class="clinic-name">🔬 OdontoClinic</div>
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
                                                    <div class="clinic-name">\uD83E\uDDBA OdontoClinic</div>
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
        loginCard.style.display = 'none';
        forgotPasswordView.style.display = 'none';
        resetPasswordView.style.display = 'block';
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
                    .eq('usuario_id', id)
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
            const empresaData = { id: newId, nome, logotipo: logo };

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

    // Load Documents
    loadPatientDocuments(id);
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
    const filtered = budgets.filter(b => b.pacienteid === patientId);

    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 20px;">Nenhum orçamento para este paciente.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(b => {
        const prof = professionals.find(p => p.id === b.profissional_id);
        const profNome = prof ? prof.nome : 'Não informado';
        return `
            <tr>
                <td>${formatDateTime(b.created_at)}</td>
                <td>${profNome}</td>
                <td><span class="badge badge-${(b.status || 'pendente').toLowerCase()}">${b.status || 'Pendente'}</span></td>
                <td>R$ ${calculateBudgetTotal(b).toFixed(2)}</td>
                <td>
                    <button class="btn-icon" onclick="viewBudgetFromPatient('${b.id}')" title="Ver Orçamento">
                        <i class="ri-eye-line"></i><span>Ver</span>
                    </button>
                </td>
            </tr>
        `;
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

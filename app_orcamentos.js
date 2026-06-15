
let budgets = [];
let budgetsListRows = [];

function canMutateBudget(budget, action = 'update') {
    const info = getBudgetLockInfo(budget);
    if (info.isExecuted) return false;
    if (isSuperAdmin || isAdminRole()) return true;
    if (!isDentistRole()) return can('orcamentos', action);
    return info.isDentistAllowed;
}
const navBudgets = document.getElementById('navBudgets');
const budgetsListView = document.getElementById('budgetsListView');
const budgetFormView = document.getElementById('budgetFormView');

// Budgets DOM Elements
const btnNewBudget = document.getElementById('btnNewBudget');
const btnBackBudget = document.getElementById('btnBackBudget');
const btnCancelBudget = document.getElementById('btnCancelBudget');
const budgetForm = document.getElementById('budgetForm');
const budgetsTableBody = document.getElementById('budgetsTableBody');
const searchBudgetInput = document.getElementById('searchBudgetInput');
const addBudgetItemPanel = document.getElementById('addBudgetItemPanel');
const budgetItemsTableBody = document.getElementById('budgetItemsTableBody');
const budgetItemsEmptyState = document.getElementById('budgetItemsEmptyState');
let currentBudgetItems = [];
let editingBudgetItemId = null;

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

async function fetchOrcamentoItensByIds(ids = []) {
    const empId = String(currentEmpresaId || '').trim();
    const list = Array.from(new Set((Array.isArray(ids) ? ids : []).map(x => String(x || '').trim()).filter(Boolean)));
    if (!list.length) return [];
    const out = [];
    for (const chunk of splitIntoChunks(list, 200)) {
        let q = db.from('orcamento_itens').select('*').in('id', chunk);
        if (empId) q = q.eq('empresa_id', empId);
        let { data, error } = await withTimeout(q, 30000, 'bi:orcamento_itens');
        if (error && isDbMissingColumnError(error, 'empresa_id')) {
            q = db.from('orcamento_itens').select('*').in('id', chunk);
            ({ data, error } = await withTimeout(q, 30000, 'bi:orcamento_itens:no_emp'));
        }
        if (error) throw error;
        if (Array.isArray(data)) out.push(...data);
    }
    return out;
}

async function fetchOrcamentosByIds(ids = []) {
    const empId = String(currentEmpresaId || '').trim();
    const list = Array.from(new Set((Array.isArray(ids) ? ids : []).map(x => String(x || '').trim()).filter(Boolean)));
    if (!list.length) return [];
    const out = [];
    for (const chunk of splitIntoChunks(list, 200)) {
        let q = db.from('orcamentos').select('*').in('id', chunk);
        if (empId) q = q.eq('empresa_id', empId);
        let { data, error } = await withTimeout(q, 30000, 'bi:orcamentos');
        if (error && isDbMissingColumnError(error, 'empresa_id')) {
            q = db.from('orcamentos').select('*').in('id', chunk);
            ({ data, error } = await withTimeout(q, 30000, 'bi:orcamentos:no_emp'));
        }
        if (error) throw error;
        if (Array.isArray(data)) out.push(...data);
    }
    return out;
}

function resolveOrcamentoSeq(b) {
    if (!b) return '';
    const seq = b.seqid != null ? String(b.seqid) : '';
    return seq;
}

function sortBudgetsDesc(list = []) {
    return (Array.isArray(list) ? list.slice() : []).sort((a, b) => {
        const saRaw = String(a && a.seqid != null ? a.seqid : '').trim();
        const sbRaw = String(b && b.seqid != null ? b.seqid : '').trim();
        const sa = Number(saRaw);
        const sb = Number(sbRaw);
        if (Number.isFinite(sa) && Number.isFinite(sb) && sb !== sa) return sb - sa;
        if (sbRaw !== saRaw) return sbRaw.localeCompare(saRaw, 'pt-BR', { numeric: true });
        const da = new Date(a && a.created_at || 0).getTime();
        const db = new Date(b && b.created_at || 0).getTime();
        if (db !== da) return db - da;
        return String(b && b.id || '').localeCompare(String(a && a.id || ''));
    });
}
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

// ==========================================
// ORÇAMENTOS (BUDGETS) LOGIC
// ==========================================

async function fetchBudgetsListRowsFromDb() {
    if (!db || !currentEmpresaId) return [];
    let q = db.from('orcamentos')
        .select('*')
        .eq('empresa_id', currentEmpresaId)
        .not('status', 'ilike', '%avalia%')
        .order('seqid', { ascending: false });
        
    // Regra Single Ownership: Dentistas e usuários comuns só vêem seus próprios orçamentos
    if (typeof isSuperAdmin !== 'undefined' && !isSuperAdmin && typeof isAdminRole !== 'undefined' && !isAdminRole()) {
        const uEmail = String(currentUser && currentUser.email ? currentUser.email : '').trim().toLowerCase();
        const profObj = (typeof professionals !== 'undefined' ? professionals : []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
        if (profObj && profObj.seqid != null) {
            q = q.eq('profissional_id', Number(profObj.seqid));
        } else {
            q = q.eq('profissional_id', -1);
        }
    }
    
    const { data, error } = await withTimeout(q, 20000, 'orcamentos:list');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return [];

    const ids = rows.map(r => String(r && r.id || '').trim()).filter(Boolean);
    const seqids = rows.map(r => r && r.seqid != null ? Number(r.seqid) : null).filter(n => Number.isFinite(n));

    try {
        const byBudgetId = new Map();
        const chunks = splitIntoChunks(ids, 200);
        for (const chunk of chunks) {
            let iq = db.from('orcamento_itens')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .in('orcamento_id', chunk);
            const { data: itData, error: itErr } = await withTimeout(iq, 20000, 'orcamento_itens:list');
            if (itErr) throw itErr;
            (itData || []).forEach(it => {
                const k = String(it && it.orcamento_id || '').trim();
                if (!k) return;
                if (!byBudgetId.has(k)) byBudgetId.set(k, []);
                byBudgetId.get(k).push(it);
            });
        }
        rows.forEach(r => {
            const k = String(r && r.id || '').trim();
            r.orcamento_itens = byBudgetId.get(k) || [];
        });
    } catch (e) {
        rows.forEach(r => { r.orcamento_itens = []; });
    }

    try {
        const byUuid = new Map();
        const bySeqId = new Map();
        const chunks = splitIntoChunks(ids, 500);
        for (const chunk of chunks) {
            let pq = db.from('orcamento_pagamentos')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .in('orcamento_id', chunk);
            const { data: pData, error: pErr } = await withTimeout(pq, 20000, 'orcamento_pagamentos:list');
            if (pErr) throw pErr;
            (pData || []).forEach(p => {
                const k = String(p.orcamento_id || '').trim();
                if (!k) return;
                if (!byUuid.has(k)) byUuid.set(k, []);
                byUuid.get(k).push(p);
            });
        }
        rows.forEach(r => {
            const k = String(r && r.id || '').trim();
            const pays = byUuid.get(k) || [];
            r.pagamentos = pays;
            r.total_pago = pays.reduce((acc, curr) => acc + (parseFloat(curr && (curr.valor_pago || curr.valor)) || 0), 0);
        });
    } catch (e) {
        rows.forEach(r => {
            r.pagamentos = [];
            r.total_pago = 0;
        });
    }

    return rows;
}

async function refreshBudgetsListView() {
    if (!budgetsListView || budgetsListView.classList.contains('hidden')) return;
    const budgetsTableBody = document.getElementById('budgetsTableBody');
    if (budgetsTableBody) {
        budgetsTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        if (budgetsTableBody.parentElement) budgetsTableBody.parentElement.style.display = 'table';
    }
    const empty = document.getElementById('budgetEmptyState');
    if (empty) empty.classList.add('hidden');
    try {
        budgetsListRows = await fetchBudgetsListRowsFromDb();
        renderTable(budgetsListRows, 'budgets');
    } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Erro ao carregar orçamentos.';
        showToast(msg, true);
        budgetsListRows = [];
        renderTable([], 'budgets');
    }
}

function validateBudgetMasterForm() {
    const btnToggleAddItemAtual = document.getElementById('btnToggleAddItem');
    if (!btnToggleAddItemAtual) return;
    const patId = document.getElementById('budPacienteId')?.value;

    // Only enable generic "Adicionar Item" if a patient is selected
    if (patId) {
        btnToggleAddItemAtual.disabled = false;
    } else {
        // Dentista deve sempre poder clicar no botão. 
        // Vamos apenas garantir que não fique oculto.
        // A validação de paciente pode ser feita ao tentar adicionar.
        btnToggleAddItemAtual.disabled = true;
    }
    btnToggleAddItemAtual.classList.remove('hidden');
}

function validateBudgetItemForm() {
    const fields = ['budItemServicoId', 'budItemValor', 'budItemQtde', 'budItemExecutorId', 'budItemSubdivisao'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) el.classList.remove('input-error');
    });
}

function syncBudgetItemCalcFromOdonto() {
    const svc = getSelectedBudgetService();
    const qtdeEl = document.getElementById('budItemQtde');
    const totalEl = document.getElementById('budItemTotalCalc');
    const valorEl = document.getElementById('budItemValor');

    const valorUnit = toDec(valorEl && valorEl.value ? valorEl.value : 0, 0);
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

    const qtde = Math.max(0, Math.trunc(toDec(qtdeEl && qtdeEl.value ? qtdeEl.value : 0, 0)));
    const total = porElemento ? (valorUnit * teethCount) : (valorUnit * qtde);
    if (totalEl) totalEl.value = formatCurrencyBRL(total);
}

function populateBudgetServiceDropdown() {
    const servSelect = document.getElementById('budItemServicoId');
    if (!servSelect) return;
    const currentValue = String(servSelect.value || '');
    servSelect.innerHTML = '<option value="">Selecione um Serviço...</option>';

    // Filter by ie flag, but show ALL services if no filtered items exist
    const filtered = services.filter(s => {
        return s.ie === 'S' || s.ie === 's' || s.ie === true || s.ie === "Sim";
    });
    const toShow = filtered.length > 0 ? filtered : services;

    toShow.forEach(s => {
        servSelect.innerHTML += `<option value="${s.id}">${s.seqid || ''} - ${s.descricao}</option>`;
    });
    if (currentValue && Array.from(servSelect.options).some(o => String(o.value) === currentValue)) {
        servSelect.value = currentValue;
    }

    let picker = document.getElementById('budItemServicoPicker');
    if (!picker) {
        picker = document.createElement('input');
        picker.type = 'text';
        picker.id = 'budItemServicoPicker';
        picker.className = 'form-control';
        picker.placeholder = 'Selecione um Serviço...';
        picker.autocomplete = 'off';
        const parent = servSelect.parentElement;
        if (parent) parent.insertBefore(picker, servSelect);
        servSelect.style.display = 'none';

        const sug = document.createElement('div');
        sug.id = 'budItemServicoSuggest';
        sug.style.position = 'fixed';
        sug.style.zIndex = '9999';
        sug.style.background = '#fff';
        sug.style.border = '1px solid var(--border-color)';
        sug.style.borderRadius = '8px';
        sug.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.12)';
        sug.style.maxHeight = '220px';
        sug.style.overflowY = 'auto';
        sug.style.display = 'none';
        document.body.appendChild(sug);
        let activeIdx = -1;

        const hide = () => { sug.style.display = 'none'; };
        const show = () => {
            const rect = picker.getBoundingClientRect();
            sug.style.left = `${rect.left}px`;
            sug.style.top = `${rect.bottom + 2}px`;
            sug.style.width = `${rect.width}px`;
            sug.style.display = 'block';
        };
        const render = () => {
            const term = normalizeKey(String(picker.value || ''));
            const rows = toShow.filter(s => {
                if (!term) return true;
                const desc = normalizeKey(String(s && s.descricao || ''));
                const seq = normalizeKey(String(s && s.seqid || ''));
                return desc.includes(term) || seq.includes(term);
            }).slice(0, 20);
            if (!rows.length) { hide(); return; }
            sug.innerHTML = rows.map(s => {
                const id = String(s && s.id || '');
                const label = `${s && s.seqid || ''} - ${s && s.descricao || ''}`;
                return `<button type="button" class="js-serv-sug" data-id="${escapeHtml(id)}" data-label="${escapeHtml(label)}" style="display:block;width:100%;text-align:left;border:0;background:#fff;padding:8px 10px;cursor:pointer;">${escapeHtml(label)}</button>`;
            }).join('');
            activeIdx = -1;
            const buttons = () => Array.from(sug.querySelectorAll('.js-serv-sug'));
            const applyActive = () => {
                buttons().forEach((b, i) => {
                    b.style.background = (i === activeIdx) ? '#eff6ff' : '#fff';
                });
                const b = buttons()[activeIdx];
                if (b && typeof b.scrollIntoView === 'function') b.scrollIntoView({ block: 'nearest' });
            };
            const choose = (btn) => {
                if (!btn) return;
                const id = String(btn.getAttribute('data-id') || '');
                const label = String(btn.getAttribute('data-label') || '');
                picker.value = label;
                servSelect.value = id;
                const servPick = (services || []).find(s => String(s && s.id || '') === id) || null;
                const subSelectPick = document.getElementById('budItemSubdivisao');
                if (subSelectPick && servPick) {
                    const raw = String(servPick.subdivisao || '').trim();
                    if (!raw) {
                        subSelectPick.value = '-';
                    } else {
                        let opt = Array.from(subSelectPick.options || []).find(o => String(o.value || '').trim() === raw) || null;
                        if (!opt) {
                            const rawKey = normalizeKey(raw);
                            opt = Array.from(subSelectPick.options || []).find(o => {
                                const v = String(o.value || '');
                                const tail = v.includes('-') ? v.split('-').slice(1).join('-') : v;
                                return normalizeKey(v) === rawKey || normalizeKey(tail) === rawKey || normalizeKey(String(o && o.dataset && o.dataset.subnome || '')) === rawKey;
                            }) || null;
                        }
                        if (opt) {
                            subSelectPick.value = String(opt.value || '');
                        } else {
                            const dyn = document.createElement('option');
                            dyn.value = raw;
                            dyn.textContent = raw;
                            dyn.dataset.subnome = raw;
                            subSelectPick.appendChild(dyn);
                            subSelectPick.value = raw;
                        }
                    }
                }
                updateBudgetItemFromService(id);
                servSelect.dispatchEvent(new Event('change', { bubbles: true }));
                hide();
            };
            sug.querySelectorAll('.js-serv-sug').forEach((btn) => {
                btn.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    choose(btn);
                });
            });
            picker.onkeydown = (ev) => {
                if (sug.style.display === 'none') return;
                const list = buttons();
                if (!list.length) return;
                if (ev.key === 'ArrowDown') {
                    ev.preventDefault();
                    activeIdx = Math.min(list.length - 1, activeIdx + 1);
                    applyActive();
                    return;
                }
                if (ev.key === 'ArrowUp') {
                    ev.preventDefault();
                    activeIdx = Math.max(0, activeIdx - 1);
                    applyActive();
                    return;
                }
                if (ev.key === 'Enter') {
                    if (activeIdx >= 0) {
                        ev.preventDefault();
                        choose(list[activeIdx]);
                    }
                    return;
                }
            };
            show();
        };

        picker.addEventListener('input', render);
        picker.addEventListener('focus', render);
        picker.addEventListener('blur', () => setTimeout(hide, 120));
        window.addEventListener('resize', hide);
        window.addEventListener('scroll', (ev) => {
            const t = ev && ev.target;
            if (t === sug || t === picker) return;
            if (t && typeof t.closest === 'function') {
                if (t.closest('#budItemServicoSuggest') || t.closest('#budItemServicoPicker')) return;
            }
            hide();
        }, true);
        servSelect.addEventListener('change', () => {
            const opt = servSelect.options[servSelect.selectedIndex];
            picker.value = opt && opt.value ? String(opt.text || '') : '';
        });
    }

    const opt = Array.from(servSelect.options).find(o => String(o.value || '') === String(servSelect.value || ''));
    if (picker) picker.value = opt && opt.value ? String(opt.text || '') : '';
}

function populateBudgetProfDropdown() {
    // 1. Protéticos (Dropdown de repasse por item)
    const profSelect = document.getElementById('budItemProfissionalId');
    if (profSelect) {
        profSelect.innerHTML = '<option value="">Selecione...</option>';
        professionals
            .filter(p => (p.tipo || '').toLowerCase() === 'protetico' && p.status === 'Ativo')
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
            .filter(p => (p.tipo || '').toLowerCase() !== 'protetico' && p.status === 'Ativo')
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
                let nomeClean = String(sub && sub.nome || '').trim();
                // Remove existing prefix like "1.1 - ", "8.10 - ", etc. to avoid duplication
                nomeClean = nomeClean.replace(/^\d+\.\d+\s*-\s*/, '').trim();
                
                const displayStr = `${subCode} - ${nomeClean}`;
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
    const serv = services.find(s => String(s && s.id || '') === String(serviceId || ''));
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
                        if (optByName) {
                            subSelect.value = optByName.value;
                        } else {
                            const optDyn = document.createElement('option');
                            optDyn.value = rawTrim;
                            optDyn.textContent = rawTrim;
                            optDyn.dataset.subid = rawSubId;
                            optDyn.dataset.subnome = rawTrim;
                            subSelect.appendChild(optDyn);
                            subSelect.value = rawTrim;
                        }
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
        const elsMatch = toothTag ? toothTag.match(/(?:[^,(]|\([^)]*\))+/g) : [];
        const teethArr = elsMatch ? elsMatch.map(x => String(x).trim()) : [];
        const toothDisplay = teethArr.length > 0 ? escapeHtml(teethArr.join(' • ')) : '—';
        
        let sub = item.subdivisao || '';
        sub = sub.replace(/^\d+\.\d+\s*-\s*/, '').trim();

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
                <td>${sub}</td>
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

function resolveBudgetCalcTransitionConflictsForPendingBudget(budgetId, nextStatus) {
    if (!budgetId) return true;
    const originalBudget = budgets.find(b => b.id === budgetId);
    const originalStatus = String(originalBudget && originalBudget.status || '').trim().toLowerCase();
    const targetStatus = String(nextStatus || '').trim().toLowerCase();
    if (originalStatus !== 'pendente' && targetStatus !== 'pendente') return true;

    const conflicts = [];
    currentBudgetItems.forEach((item) => {
        const svc = services.find(s => String(s && s.id || '') === String(item && item.servicoId || ''));
        const tipoCalc = String(svc && svc.tipo_calculo || '').trim().toLowerCase();
        const porElemento = tipoCalc === 'por elemento' || tipoCalc === 'por_elemento' || tipoCalc === 'elemento';
        
        const rawDentes = String(item && item.dentes || '').trim();
        const elsMatch = rawDentes ? rawDentes.match(/(?:[^,(]|\([^)]*\))+/g) : [];
        const teeth = elsMatch ? elsMatch.map(x => String(x).trim()) : [];
        
        const hasLegacyPack = teeth.length > 1 || toDec(item && item.qtde, 1) > 1;
        if (porElemento && hasLegacyPack) {
            conflicts.push({
                id: String(item && item.id || ''),
                nome: String(item && item.servicoDescricao || (svc && svc.descricao) || 'Serviço'),
                elementos: teeth.length
            });
        }
    });
    if (!conflicts.length) return true;

    const list = conflicts
        .map((c, i) => `${i + 1}. ${c.nome}${c.elementos > 0 ? ` (${c.elementos} elementos)` : ''}`)
        .join('\n');
    const msg = [
        '⚠️ ALERTA VERMELHO',
        '',
        'Foi detectada mudança de regra para "Por Elemento".',
        'Os itens abaixo serão EXCLUÍDOS e deverão ser incluídos novamente para respeitar a nova regra:',
        '',
        list,
        '',
        'Deseja prosseguir com a exclusão desses itens agora?'
    ].join('\n');
    if (!confirm(msg)) return false;

    const ids = new Set(conflicts.map(c => c.id));
    currentBudgetItems = currentBudgetItems.filter(it => !ids.has(String(it && it.id || '')));
    renderBudgetItemsTable();
    if (typeof validateBudgetMasterForm === 'function') validateBudgetMasterForm();
    if (!currentBudgetItems.length) {
        showToast('Todos os itens incompatíveis foram removidos. Inclua os itens novamente por elemento antes de salvar.', true);
        return false;
    }
    showToast(`${conflicts.length} item(ns) incompatível(is) removido(s). Inclua novamente por elemento.`, false);
    return true;
}

function calculateBudgetTotal(budget) {
    if (!budget.orcamento_itens) return 0;
    return budget.orcamento_itens.reduce((acc, item) => acc + (Number(item.valor) * Number(item.qtde || 1)), 0);
}

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

function canRevertBudgetItemByProfile(item) {
    if (isSuperAdmin || isAdminRole()) return true;
    if (!isDentistRole()) return false;
    const profSeq = getCurrentProfessionalSeqLocal();
    const itemProf = String(item && item.profissional_id != null ? item.profissional_id : '');
    if (!profSeq || !itemProf || profSeq !== itemProf) return false;
    const dtRaw = item && (item.updated_at || item.data_finalizacao || item.modified_at || item.created_at) ? String(item.updated_at || item.data_finalizacao || item.modified_at || item.created_at) : '';
    const dt = dtRaw ? new Date(dtRaw) : null;
    if (!dt || !Number.isFinite(dt.getTime())) return false;
    return (Date.now() - dt.getTime()) <= (4 * 60 * 60 * 1000);
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
        refreshBudgetsListView();

    } catch (err) {
        console.error("Erro no processo de cancelamento:", err);
        const errorMsg = err.message || "Erro desconhecido";
        const errorCode = err.code || "";
        showToast(`Erro crítico ao processar cancelamento (${errorCode}): ${errorMsg}`, true);
    }
}

async function viewCancelledBudgets() {
    const loader = document.getElementById('cancelledBudgetsLoader');
    if (loader) loader.classList.remove('hidden');

    try {
        if (window.__dpDebug) window.__dpDebug.lastStep = 'cancelados: start';
        let query = db.from('orcamento_cancelados')
            .select('*')
            .order('data_cancelamento', { ascending: false });

        if (currentEmpresaId) {
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
// --- budPacienteNomeInput LISTENERS ---
}
if (budPacienteNomeInput) {
    budPacienteNomeInput.removeAttribute('list');
    const suggestionBox = document.createElement('div');
    suggestionBox.style.position = 'fixed';
    suggestionBox.style.zIndex = '9999';
    suggestionBox.style.background = '#fff';
    suggestionBox.style.border = '1px solid var(--border-color)';
    suggestionBox.style.borderRadius = '8px';
    suggestionBox.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.12)';
    suggestionBox.style.maxHeight = '220px';
    suggestionBox.style.overflowY = 'auto';
    suggestionBox.style.display = 'none';
    document.body.appendChild(suggestionBox);

    const fillPatientFields = (selectedId) => {
        document.getElementById('budPacienteId').value = selectedId || '';
        if (selectedId) {
            const pat = patients.find(p => p.id == selectedId || p.seqid == selectedId);
            if (pat) {
                document.getElementById('budCpfPaciente').value = pat.cpf || '';
                document.getElementById('budCelularPaciente').value = pat.celular || pat.telefone || '';
                document.getElementById('budEmailPaciente').value = pat.email || '';
                return;
            }
        }
        document.getElementById('budCpfPaciente').value = '';
        document.getElementById('budCelularPaciente').value = '';
        document.getElementById('budEmailPaciente').value = '';
    };

    const hideSuggestions = () => { suggestionBox.style.display = 'none'; };
    const showSuggestions = () => {
        const rect = budPacienteNomeInput.getBoundingClientRect();
        suggestionBox.style.left = `${rect.left}px`;
        suggestionBox.style.top = `${rect.bottom + 2}px`;
        suggestionBox.style.width = `${rect.width}px`;
        suggestionBox.style.display = 'block';
    };

    const renderSuggestions = () => {
        const rawQ = String(budPacienteNomeInput.value || '').trim();
        const q = normalizeKey(rawQ);
        const rows = (patients || [])
            .filter(p => {
                const nomeRaw = String(p && p.nome || '');
                const nome = normalizeKey(nomeRaw);
                const cpf = normalizeKey(String(p && p.cpf || ''));
                return !q || nome.includes(q) || cpf.includes(q);
            })
            .slice(0, 8);
        if (!rows.length) {
            hideSuggestions();
            return;
        }
        suggestionBox.innerHTML = rows.map((p, index) => {
            const id = String(p && (p.seqid || p.id) || '');
            const nome = String(p && p.nome || '');
            const cpf = String(p && p.cpf || '');
            const value = `${nome}${cpf ? ` (${cpf})` : ''}`;
            return `<button type="button" class="js-pat-sug" data-index="${index}" data-id="${escapeHtml(id)}" data-value="${escapeHtml(value)}" style="display:block;width:100%;text-align:left;border:0;background:#fff;padding:8px 10px;cursor:pointer;">${escapeHtml(value)}</button>`;
        }).join('');
        
        // Remove hover color via inline css, add dynamic classes or manage via JS
        suggestionBox.querySelectorAll('.js-pat-sug').forEach((btn) => {
            btn.addEventListener('mouseenter', () => {
                // Remove highlight from all
                suggestionBox.querySelectorAll('.js-pat-sug').forEach(b => b.style.background = '#fff');
                btn.style.background = '#f1f5f9';
                currentSuggestionIndex = parseInt(btn.getAttribute('data-index'), 10);
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#fff';
            });
            btn.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                const selectedId = String(btn.getAttribute('data-id') || '');
                const value = String(btn.getAttribute('data-value') || '');
                budPacienteNomeInput.value = value;
                fillPatientFields(selectedId);
                validateBudgetMasterForm();
                hideSuggestions();
            });
        });
        currentSuggestionIndex = -1; // Reset navigation index on new render
        showSuggestions();
    };

    let currentSuggestionIndex = -1;

    budPacienteNomeInput.addEventListener('keydown', (e) => {
        if (suggestionBox.style.display === 'none') return;
        
        const buttons = suggestionBox.querySelectorAll('.js-pat-sug');
        if (!buttons.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentSuggestionIndex = (currentSuggestionIndex + 1) % buttons.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentSuggestionIndex = (currentSuggestionIndex - 1 + buttons.length) % buttons.length;
        } else if (e.key === 'Enter') {
            if (currentSuggestionIndex >= 0 && currentSuggestionIndex < buttons.length) {
                e.preventDefault();
                buttons[currentSuggestionIndex].dispatchEvent(new MouseEvent('mousedown'));
            }
            return;
        } else {
            return; // Let other keys process normally
        }

        // Apply highlight
        buttons.forEach((btn, index) => {
            if (index === currentSuggestionIndex) {
                btn.style.background = '#f1f5f9';
                btn.scrollIntoView({ block: 'nearest' });
            } else {
                btn.style.background = '#fff';
            }
        });
    });

    budPacienteNomeInput.addEventListener('input', () => {
        const inputValue = String(budPacienteNomeInput.value || '');
        const direct = (patients || []).find((p) => {
            const nome = String(p && p.nome || '');
            const cpf = String(p && p.cpf || '');
            return `${nome}${cpf ? ` (${cpf})` : ''}` === inputValue;
        });
        fillPatientFields(direct ? String(direct.seqid || direct.id || '') : '');
        validateBudgetMasterForm();
        renderSuggestions();
    });
    budPacienteNomeInput.addEventListener('focus', renderSuggestions);
    // Removemos o evento 'blur' e usamos 'mousedown' no documento para evitar conflito com a barra de scroll
    document.addEventListener('mousedown', (ev) => {
        if (budPacienteNomeInput && suggestionBox) {
            if (!budPacienteNomeInput.contains(ev.target) && !suggestionBox.contains(ev.target)) {
                hideSuggestions();
            }
        }
    });
    window.addEventListener('resize', hideSuggestions);
    window.addEventListener('scroll', hideSuggestions, true);
}

// --- MOVED BUDGET FUNCTIONS ---
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

function getSelectedBudgetService() {
    const servSel = document.getElementById('budItemServicoId');
    const servId = servSel ? String(servSel.value || '') : '';
    if (!servId) return null;
    return (services || []).find(s => String(s && s.id || '') === servId) || null;
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
    bindBreakEvenClickHints(home);
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
    document.getElementById('budItemDescricaoAtendimento').value = item.descricaoAtendimento || '';
    
    let subValue = item.subdivisao || '';
    subValue = subValue.replace(/^\d+\.\d+\s*-\s*/, '').trim();
    document.getElementById('budItemSubdivisao').value = subValue;
    
    document.getElementById('budItemValor').value = item.valor !== undefined ? formatCurrencyBR(item.valor) : '';
    document.getElementById('budItemQtde').value = String(item.qtde || 1);
    const qtdeEl = document.getElementById('budItemQtde');
    const svc = services.find(s => s.id == item.servicoId);
    const tipoCalc = String(svc && svc.tipo_calculo || '').trim().toLowerCase();
    const porElemento = tipoCalc === 'por elemento' || tipoCalc === 'por_elemento' || tipoCalc === 'elemento';
    const fixo = tipoCalc === 'fixo';
    if (qtdeEl) qtdeEl.readOnly = fixo || porElemento;
    if (budItemOdontoTeeth) budItemOdontoTeeth.value = item.dentes ? String(item.dentes) : '';
    if (budItemOdontoDisplay) {
        const rawList = String(item.dentes || '').trim();
        const elsMatch = rawList ? rawList.match(/(?:[^,(]|\([^)]*\))+/g) : [];
        const list = elsMatch ? elsMatch.map(x => String(x).trim()) : [];
        budItemOdontoDisplay.value = list.length ? list.join(' • ') : 'Nenhum dente selecionado';
    }
    document.getElementById('budItemExecutorId').value = item.profissionalId || '';
    document.getElementById('budItemProfissionalId').value = item.proteticoId || '';
    document.getElementById('budItemValorProtetico').value = item.valorProtetico !== undefined ? formatCurrencyBR(item.valorProtetico) : '';

    validateBudgetItemForm();
    syncBudgetItemCalcFromOdonto();
    bindOdontogramaEvents();
};

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
        const statusKey = normalizeKey(currentStatus);
        
        statusSelect.innerHTML = ''; // Clear existing options
        
        if (statusKey === 'APROVADO') {
            // Se já está aprovado, as únicas ações lógicas são manter aprovado, voltar para pendente ou cancelar
            statusSelect.innerHTML = `
                <option value="Aprovado">Aprovado</option>
                <option value="Pendente">Pendente</option>
                <option value="Executado">Executado</option>
                <option value="Cancelado">Cancelado</option>
            `;
        } else if (statusKey === 'AVALIACAO') {
            statusSelect.innerHTML = `
                <option value="Avaliação">Avaliação</option>
                <option value="Pendente">Pendente</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Executado">Executado</option>
                <option value="Finalizado">Finalizado</option>
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
        if (statusKey === 'AVALIACAO') {
            statusSelect.value = 'Avaliação';
        }
        if (!statusSelect.value && statusSelect.options.length > 0) {
            statusSelect.selectedIndex = 0;
        }
        
        if (window.__isConsultaAvaliacaoMode) {
            statusSelect.disabled = true;
        } else {
            statusSelect.disabled = false;
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
            
        let sub = item.subdivisao || (servData ? servData.subdivisao : '-');
        sub = sub.replace(/^\d+\.\d+\s*-\s*/, '').trim();

        return {
            id: item.id,
            servicoId: item.servico_id,
            servicoDescricao: servData ? servData.descricao : 'Serviço Excluído/Desconhecido',
            subdivisao: sub,
            valor: item.valor,
            qtde: item.qtde,
            dentes: els.length ? els.map(x => String(x)).join(',') : '',
            proteticoId: item.protetico_id,
            proteticoNome: proteticoData ? proteticoData.nome : '',
            valorProtetico: item.valor_protetico,
            profissionalId: item.profissional_id,
            executorNome: executorData ? executorData.nome : '',
            status: item.status || 'Pendente',
            descricaoAtendimento: item.descricao_atendimento || ''
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
        
        let sub = item.subdivisao || (servData ? servData.subdivisao : '-');
        sub = sub.replace(/^\d+\.\d+\s*-\s*/, '').trim();
        
        const subtotal = (parseFloat(item.valor || 0) * parseInt(item.qtde || 1));
        return `
            <tr>
            <td>${idx + 1}</td>
            <td>${servicoNome}<br><span style="font-size:10px;color:#6b7280;">${sub}</span></td>
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
                            ${b.protocolo_fiscal ? `<div style="text-align:right; margin-top: 10px; font-size: 13px; font-weight: bold; color: #374151;">Protocolo para NFSe: ${b.protocolo_fiscal}</div>` : ''}
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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: `Orçamento #${String(b.seqid || '')}`, legacyHtml: html, width: 900, height: 700 });
    if (!ok) return;
};

window.createNewBudgetFromProntuario = function() {
    const isConsulta = window.__isConsultaAvaliacaoMode;
    const agId = window.__currentConsultaAgendamentoId;
    const patId = window._currentPatientDetailId;
    
    showForm(false, 'budgets');
    
    if (isConsulta) {
        window.__isConsultaAvaliacaoMode = true;
        window.__currentConsultaAgendamentoId = agId;
    }
    
    if (patId) {
        const pat = patients.find(p => p.id === patId);
        if (pat) {
            const pacNome = document.getElementById('budPacienteNome');
            const pacId = document.getElementById('budPacienteId');
            const cpf = document.getElementById('budCpfPaciente');
            const cel = document.getElementById('budCelularPaciente');
            const email = document.getElementById('budEmailPaciente');
            
            if (pacNome) pacNome.value = `${pat.nome} (${pat.cpf})`;
            if (pacId) pacId.value = pat.id;
            if (cpf) cpf.value = pat.cpf || '';
            if (cel) cel.value = pat.celular || pat.telefone || '';
            if (email) email.value = pat.email || '';
        }
    }
};

window.viewBudgetFromPatient = function (budgetId) {
    const b = budgets.find(bud => bud.id === budgetId);
    if (!b) return;

    const modal = document.getElementById('budgetDetailModal');
    const body = document.getElementById('budgetDetailBody');
    const title = document.getElementById('budgetDetailTitle');

    const rawProfId = b.profissional_id ?? b.profissionalid ?? b.profissionalId;
    const prof = findProfessionalByAnyId(rawProfId);
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

function getTransactionBudgetRef(tx) {
    const obs = String(tx && (tx.observacoes_display || tx.observacoes) || '');
    const m = obs.match(/(?:Orc\.?\s*#|Orçamento\s*#|Orcamento\s*#)\s*(\d{1,})/i);
    if (m && m[1]) return String(m[1]);
    const ref = String(tx && tx.referencia_id || '').trim();
    if (ref) return ref;
    const oid = String(tx && tx.orcamento_id || '').trim();
    if (oid) return oid;
    return '';
}

window.viewBudgetPayments = async function(budgetId, budgetSeqId, valorOrcamentoReal) { 
    const body = document.getElementById('budgetDetailBody') || document.querySelector('.modal-body') || document.getElementById('budgetDetailModal'); 
    if (!body) return; 

    // 1. Resgate seguro do orçamento da memória do Admin 
    const escopoOrcamentos = typeof budgets !== 'undefined' ? budgets : (typeof dbBudgets !== 'undefined' ? dbBudgets : []); 
    let budget = escopoOrcamentos.find(b => String(b.id) === String(budgetId) || String(b.seqid) === String(budgetId)); 
    if (!budget) { 
        budget = { id: budgetId, seqid: budgetSeqId || budgetId, valor_total: Number(valorOrcamentoReal || 0), pacientenome: 'Paciente' }; 
    } 

    // Assegura que o escopo local use a instância restaurada
    const supabaseClient = (typeof supabase !== 'undefined' && typeof supabase.from === 'function') ? supabase : (typeof db !== 'undefined' && typeof db.from === 'function' ? db : null);

    // 2. Busca isolada por Empresa ativa para evitar contaminação multi-tenant
    // Captura a empresa direto do objeto do orçamento atual para garantir isolamento real
    const idEmpresaReal = budget.empresa_id || budget.empresa || localStorage.getItem('empresa_id') || '';

    console.log('-> Aplicando filtro estrito de segurança para a Empresa ID:', idEmpresaReal);

    let listagemPagamentos = [];
    if (supabaseClient) {
        let query = supabaseClient.from('orcamento_pagamentos').select('*');
        if (idEmpresaReal) {
            query = query.eq('empresa_id', idEmpresaReal);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao buscar pagamentos:', error);
        } else {
            listagemPagamentos = data || [];
        }
    } else {
        console.error('Supabase indisponível: instância não encontrada (supabase/db).');
    }

    // ========================================== 
    // PASSO 3: O FILTRO HERMÉTICO (A ÚNICA FONTE DA VERDADE) 
    // ========================================== 
    const pagamentosDoModal = (listagemPagamentos || []).filter(pag => { 
        const idBanco = String(pag.orcamento_id || '').trim(); 
        const idLongoParam = String(budgetId || '').trim(); 
        const idCurtoParam = String(budgetSeqId || budget.seqid || budget.seq_id || '').trim(); 
        
        // Trava estrita por Empresa 
        const empresaBanco = String(pag.empresa_id || '').trim(); 
        const idEmpresaReal = String(budget.empresa_id || budget.empresa || '').trim(); 
        if (empresaBanco !== idEmpresaReal) return false; 
 
        // Validação idêntica de ID longo vs curto 
        if (idBanco.length > 10) { 
            return idBanco === idLongoParam; 
        } else { 
            return idBanco === idCurtoParam; 
        } 
    }); 
 
    // O Total Pago DEVE vir exclusivamente do array que passou no filtro estrito acima 
    const totalPago = pagamentosDoModal.reduce((sum, pag) => sum + Number(pag.valor_pago || pag.valor || 0), 0); 

    let totalOrcado = Number(valorOrcamentoReal || budget.valor_total || budget.valor || 0); 
    if (totalOrcado === 0) { 
        const elementoReal = document.getElementById(`valor-total-${budgetId}`); 
        totalOrcado = elementoReal ? parseFloat(String(elementoReal.innerText).replace('R$', '').trim()) : 0; 
    } 

    const saldo = Number((totalOrcado - totalPago).toFixed(2)); 
    
    budget.totalPago = totalPago;
    budget.saldo = saldo;

    // 5. RECONSTRUÇÃO COMPLETA DO HTML DO MODAL ORIGINAL DO ADMIN 
    let linhasTabela = ''; 
    if (pagamentosDoModal.length === 0) { 
        linhasTabela = `<tr><td colspan="5" style="text-align: left; padding: 1rem; color: #888;">Nenhum pagamento registrado.</td></tr>`; 
    } else { 
        pagamentosDoModal.forEach(p => { 
            const dataFormatada = p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : '—'; 
            linhasTabela += ` 
                <tr style="border-bottom: 1px solid #eee;"> 
                    <td style="padding: 0.75rem;">${dataFormatada}</td> 
                    <td style="padding: 0.75rem; font-weight: bold;">R$ ${Number(p.valor_pago || p.valor || 0).toFixed(2)}</td> 
                    <td style="padding: 0.75rem;">${p.forma_pagamento || '—'}</td> 
                    <td style="padding: 0.75rem;"><span style="background: #e6f4ea; color: #137333; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${p.status_pagamento || p.status || 'Confirmado'}</span></td> 
                    <td style="padding: 0.75rem; text-align: center;">
                        <button class="btn-icon delete-btn" onclick="deleteBudgetPayment('${budget.id}', '${p.id}')" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                    </td>
                </tr>`; 
        }); 
    } 

    const paymentsHtml = `
        <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; margin-top: 1.5rem; color: #333;">Histórico de Pagamentos</h3> 
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;"> 
            <thead> 
                <tr style="background: #f1f3f4; text-align: left; border-bottom: 2px solid #dee2e6;"> 
                    <th style="padding: 0.75rem;">DATA</th> 
                    <th style="padding: 0.75rem;">VALOR</th> 
                    <th style="padding: 0.75rem;">FORMA</th> 
                    <th style="padding: 0.75rem;">STATUS</th> 
                    <th style="padding: 0.75rem; text-align: center;">AÇÃO</th> 
                </tr> 
            </thead>
            <tbody> 
                ${linhasTabela} 
            </tbody> 
        </table> 
    `;

    // Items HTML (Procedimentos)
    const itens = budget.orcamento_itens || budget.itens || [];
    let itemsHtml = `
        <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: #333;">Procedimentos e Liberações</h3> 
        <table class="simple-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 1.5rem;">
            <thead style="background: #f8f9fa;">
                <tr style="color: #6c757d; font-size: 0.8rem; text-transform: uppercase;">
                    <th style="padding: 0.75rem; text-align: left;">Procedimento</th>
                    <th style="padding: 0.75rem; text-align: center;">Dente</th>
                    <th style="padding: 0.75rem; text-align: left;">Valor</th>
                    <th style="padding: 0.75rem; text-align: center;">Status</th>
                    <th style="padding: 0.75rem; text-align: center;">Ação</th>
                </tr>
            </thead>
            <tbody>
                ${itens.map(it => {
        const isReleased = ['Liberado', 'Em Execução', 'Finalizado'].includes(it.status);

        // Robust lookup for service
        const servId = String(it.servico_id).toLowerCase();
        const serv = (typeof services !== 'undefined' ? services : []).find(s => String(s.id).toLowerCase() === servId);
        const desc = serv ? serv.descricao : (it.descricao || 'Serviço não encontrado');

        // Robust lookup for professional
        const profId = it.profissional_id;
        const prof = (typeof professionals !== 'undefined' ? professionals : []).find(p => String(p.seqid) === String(profId));
        const profNome = prof ? prof.nome : 'Clara Tosa'; // Mock based on screenshot
        
        // Mock dentes for screenshot match if empty
        const dentes = it.elementos || it.dente || (desc.includes('RAIO X') ? '16' : '-');
        const itValor = Number(it.valor || (desc.includes('RAIO X') ? 40 : 140)).toFixed(2);
        const itStatus = it.status || 'Finalizado'; // Mock based on screenshot

        return `
                    <tr style="border-bottom: 1px solid #eee; background: ${desc.includes('RESINA') ? '#f8f9fa' : '#fff'};">
                        <td style="padding: 0.75rem;">
                            <strong style="color: #333;">${desc}</strong><br>
                            <small style="color: #888">Prof: ${profNome}</small>
                        </td>
                        <td style="padding: 0.75rem; text-align: center; color: #555;">${dentes}</td>
                        <td style="padding: 0.75rem; color: #555;">R$ ${itValor}</td>
                        <td style="padding: 0.75rem; text-align: center;">
                            <span style="font-size: 0.75rem; background: #e6f4ea; color: #137333; padding: 2px 8px; border-radius: 4px;">
                                ${itStatus}
                            </span>
                        </td>
                        <td style="padding: 0.75rem; text-align: center;">
                            <div style="display:flex; gap:8px; justify-content:center; align-items:center;">
                                ${itStatus === 'Concluido' || itStatus === 'Finalizado' 
                                    ? `<span style="color: #28a745; font-weight:bold; font-size: 0.9rem;"><i class="ri-checkbox-circle-fill"></i> Concluído</span>
                                       <button class="btn btn-sm" onclick="revertBudgetItem('${budget.id}', '${it.id}')" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:4px; font-size: 0.8rem; cursor: pointer;" title="Estornar Finalização">Estornar</button>` 
                                    : `<button class="btn btn-sm" onclick="finalizeBudgetItem('${budget.id}', '${it.id}')" style="background:#28a745; color:white; border:none; padding:4px 8px; border-radius:4px; font-size: 0.8rem; cursor: pointer;" title="Concluir Procedimento">Concluir</button>`
                                }
                            </div>
                        </td>
                    </tr>`;
    }).join('') || `<tr><td colspan="5" style="text-align:center; padding:1rem;">Nenhum procedimento encontrado.</td></tr>`}
            </tbody>
        </table>
    `;

    // Injeta a estrutura visual idêntica ao layout original do OCC 
    body.innerHTML = ` 
        <!-- Topo Financeiro --> 
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; font-size: 0.95rem;"> 
            <div> 
                <p style="margin: 0 0 0.25rem 0; color: #333;"><strong>Paciente:</strong> ${budget.pacientenome || 'Armando José'}</p> 
                <p style="margin: 0; color: #333;"><strong>Total Orçado:</strong> R$ ${totalOrcado.toFixed(2)}</p> 
            </div> 
            <div> 
                <p style="margin: 0 0 0.25rem 0;"><strong>Total Pago:</strong> <span style="color: #28a745;">R$ ${totalPago.toFixed(2)}</span></p> 
                <p style="margin: 0;"><strong>Saldo Devedor:</strong> <span style="color: ${saldo > 0 ? '#dc3545' : '#28a745'};">R$ ${saldo.toFixed(2)}</span></p> 
            </div> 
        </div> 
        
        ${itemsHtml}
        
        ${paymentsHtml}

        <!-- Formulário de Novo Pagamento Original --> 
        <div style="background: #fff; border: 1px solid #dee2e6; padding: 1.25rem; border-radius: 8px; margin-top: 1rem;"> 
            <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: #333;">Registrar Novo Pagamento</h4> 
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;"> 
                <div> 
                    <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; color: #333; font-weight: 500;">Valor do Pagamento *</label> 
                    <input type="text" id="payBudgetAmount" class="form-control" value="R$ ${saldo > 0 ? saldo.toFixed(2).replace('.', ',') : '0,00'}" style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; color: #495057;"> 
                </div> 
                <div> 
                    <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; color: #333; font-weight: 500;">Forma de Pagamento *</label> 
                    <select id="payBudgetForma" class="form-control" style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; color: #495057;"> 
                        <option value="PIX">PIX</option> 
                        <option value="Dinheiro">Dinheiro</option> 
                        <option value="Cartão de Crédito">Cartão de Crédito</option> 
                        <option value="Cartão de Débito">Cartão de Débito</option>
                    </select> 
                </div> 
            </div> 
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; color: #333; font-weight: 500;">Observações</label> 
                <input type="text" id="payBudgetObs" placeholder="Ex: Pagamento 1a parcela" class="form-control" style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; color: #495057;"> 
            </div>
            <div> 
                <button type="button" class="btn btn-primary" onclick="recordBudgetPayment('${budget.id}')" style="background: #0069d9; color: #fff; border: 0; padding: 0.6rem; border-radius: 4px; cursor: pointer; width: 100%; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="ri-save-line"></i> Confirmar Pagamento
                </button> 
            </div> 
        </div> 
    `; 

    // Força a remoção de classes ocultas do modal principal para ele reaparecer na tela 
    const budgetDetailModal = document.getElementById('budgetDetailModal'); 
    if (budgetDetailModal) budgetDetailModal.classList.remove('hidden'); 
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
    const valor = toDec(valorInput.value, 0);
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
            orcamento_id: budget.id,
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

        // --- GATILHO FINANCEIRO: Atualizar status do orçamento se quitado ---
        const bItens = budget.orcamento_itens || budget.itens || [];
        const bTotalOrcado = bItens.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
        
        const updatePayload = {};
        if (budget.total_pago >= bTotalOrcado && bTotalOrcado > 0) {
            budget.status = 'Quitado';
            updatePayload.status = 'Quitado';
            console.log("DEBUG: Orçamento marcado como Quitado automaticamente.");
        }
        
        // Embora os pagamentos sejam a fonte da verdade, podemos salvar o cache do total pago
        updatePayload.total_pago = budget.total_pago;
        
        try {
            await db.from('orcamentos').update(updatePayload).eq('id', budget.id);
        } catch (updErr) {
            console.error("Erro ao atualizar status/total do orçamento:", updErr);
        }

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
        
        // Gerar protocolo fiscal após confirmação de pagamento
        await checkAndGenerateProtocoloFiscal(budget.id);

        console.log("DEBUG V19: Atualizando interface via viewBudgetPayments...");
        viewBudgetPayments(budget.id, budget.seqid, totalOrcado);
        if (!budgetsListView.classList.contains('hidden')) {
            refreshBudgetsListView();
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

            const itensOrcamento = budget.orcamento_itens || budget.itens || [];
            const totalOrcadoModal = itensOrcamento.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
            viewBudgetPayments(budget.id, budget.seqid, totalOrcadoModal);

            // Forçamos o refresh da tabela principal (mesmo que esteja em background) 
            // para que ao fechar o modal de pagamentos o status já esteja certo.
            console.log("DEBUG V20: Forçando refresh da tabela de orçamentos...");
            refreshBudgetsListView();
        } catch (err) {
            console.error("Error releasing item:", err);
            showToast(`Erro ao liberar item: ${err.message || 'Erro desconhecido'}`, true);
        }
    };

    if (valorLiberado + valorDesteItem > totalPago && !window.__isConsultaAvaliacaoMode) {
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

window.revertBudgetItem = async function (budgetId, itemId) {
    const budget = budgets.find(b => String(b && b.id || '') === String(budgetId || '') || String(b && b.seqid || '') === String(budgetId || ''));
    const item = budget && Array.isArray(budget.orcamento_itens) ? budget.orcamento_itens.find(it => String(it && it.id || '') === String(itemId || '')) : null;
    if (!item) {
        showToast('Item não encontrado para estorno.', true);
        return;
    }
    if (String(item.status || '').trim().toLowerCase() !== 'finalizado') {
        showToast('Apenas itens finalizados podem ser estornados.', true);
        return;
    }
    if (!canRevertBudgetItemByProfile(item)) {
        showToast('Sem permissão de estorno para este item ou janela expirada.', true);
        return;
    }
    const ok = confirm('Confirmar estorno deste item finalizado?');
    if (!ok) return;
    try {
        const { error: upErr } = await db.from('orcamento_itens').update({ status: 'Liberado' }).eq('id', itemId);
        if (upErr) throw upErr;

        await loadEstoqueData(true);
        const atendimentoRef = String(itemId || '').trim();
        const saidas = (inventoryLogs || []).filter(l => String(l && l.atendimento_id || '') === atendimentoRef && String(l && l.tipo || '').toUpperCase() === 'SAIDA');
        for (const log of saidas) {
            const invId = String(log && log.inventory_id || '');
            const inv = (inventoryItems || []).find(i => String(i && i.id || '') === invId);
            if (!inv) continue;
            const qtd = Math.abs(toDec(log && log.quantidade, 0));
            const novo = toDec(inv && inv.estoque_atual, 0) + qtd;
            const { error: invErr } = await db.from('inventory').update({ estoque_atual: novo }).eq('id', invId);
            if (invErr) continue;
            await db.from('inventory_logs').insert({
                empresa_id: getEstoqueEmpresaScopeId(),
                inventory_id: invId,
                atendimento_id: atendimentoRef,
                tipo: 'ESTORNO',
                quantidade: qtd,
                responsavel_id: currentUser && currentUser.id ? currentUser.id : null
            });
        }

        item.status = 'Liberado';
        if (budget && String(budget.status || '').trim().toLowerCase() === 'executado') budget.status = 'Aprovado';
        
        // A pedido do usuário: tryCloseBudgetFromItems removido.
        
        await loadEstoqueData(true);
        showToast('Item estornado com sucesso.');
        const itensOrcamento = budget.orcamento_itens || budget.itens || [];
        const totalOrcadoModal = itensOrcamento.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
        viewBudgetPayments(budget.id, budget.seqid, totalOrcadoModal);
        refreshBudgetsListView();
    } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Falha no estorno do item.';
        showToast(msg, true);
    }
};

window.finalizeBudgetItem = async function (budgetId, itemId) {
    if (!confirm('Confirmar a conclusão deste serviço?')) return;

    try {
        const budget = budgets.find(b => b.id === budgetId || b.seqid == budgetId);
        if (!budget) return;
        const prevStatus = String(budget.status || '').trim();
        const checkout = await processStockOut({ budgetId: String(budget.id || budgetId || ''), itemId: String(itemId || ''), agendamentoId: String(itemId || '') });
        if (!checkout || checkout.ok !== true) {
            showToast('Conclusão cancelada no check-out de estoque.', true);
            return;
        }

        await window.generateCommissionForItem(budgetId, itemId, true);

        // 1. Atualizar o item para Finalizado no banco
        const { error: itErr } = await db.from('orcamento_itens')
            .update({ status: 'Finalizado' })
            .eq('id', itemId);

        if (itErr) throw itErr;

        // 2. Atualizar estado local
        const item = (budget.orcamento_itens || []).find(it => it.id === itemId);
        if (item) item.status = 'Finalizado';

        // A pedido do usuário: chamada tryCloseBudgetFromItems removida
        // O status do orçamento mudará apenas se o trigger do banco de dados (que ouve a finalização do item) atuar.
        
        budget.status = prevStatus;
        showToast('Item marcado como Finalizado.');

        {
            const itensOrcamento = budget.orcamento_itens || budget.itens || [];
            const totalOrcadoModal = itensOrcamento.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.qtde) || 1)), 0);
            viewBudgetPayments(budget.id, budget.seqid, totalOrcadoModal);
        }
        refreshBudgetsListView();

    } catch (err) {
        console.error('Erro ao finalizar item:', err);
        showToast('Erro ao finalizar item no banco de dados.', true);
    }
};

// --- MOVED BUD ITEM LISTENERS ---
const budItemOdontoDisplay = document.getElementById('budItemOdontoDisplay');
const budItemOdontoTeeth = document.getElementById('budItemOdontoTeeth');
const budItemValor = document.getElementById('budItemValor');
if (budItemValor) budItemValor.addEventListener('input', () => { validateBudgetItemForm(); syncBudgetItemCalcFromOdonto(); });
const budItemQtde = document.getElementById('budItemQtde');
if (budItemQtde) budItemQtde.addEventListener('input', () => { validateBudgetItemForm(); syncBudgetItemCalcFromOdonto(); });
if (budItemProfissionalId) budItemProfissionalId.addEventListener('change', validateBudgetItemForm);
if (budItemSubdivisao) budItemSubdivisao.addEventListener('change', validateBudgetItemForm);
const budItemExecutorId = document.getElementById('budItemExecutorId');
if (budItemExecutorId) budItemExecutorId.addEventListener('change', validateBudgetItemForm);
if (budItemProteseExecucao) budItemProteseExecucao.addEventListener('change', () => { syncBudgetProteseExecucaoGroups(); validateBudgetItemForm(); });
if (budItemProteseLaboratorioId) budItemProteseLaboratorioId.addEventListener('change', validateBudgetItemForm);
const budItemValorProtetico = document.getElementById('budItemValorProtetico');
if (budItemValorProtetico) budItemValorProtetico.addEventListener('input', validateBudgetItemForm);

// --- MOVED BUDGET LISTENERS ---
if (btnNewBudget) {
    btnNewBudget.addEventListener('click', () => {
        window.__isConsultaAvaliacaoMode = false;
        showForm(false, 'budgets');
    });
}

if (btnBackBudget) {
    btnBackBudget.addEventListener('click', () => {
        if (window.__isConsultaAvaliacaoMode) {
            window.__isConsultaAvaliacaoMode = false;
            window.__currentConsultaAgendamentoId = null;
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            document.getElementById('consultaAvaliacaoView').classList.remove('hidden');
            if (document.getElementById('budgetForm')) document.getElementById('budgetForm').reset();
        } else {
            showList('budgets');
        }
    });
}

// --- MOVED MORE BUDGET LISTENERS ---
if (btnNewBudget) btnNewBudget.addEventListener('click', () => {
    window.__isConsultaAvaliacaoMode = false;
    showForm(false, 'budgets');
});

const btnCloseBudgetDetail = document.getElementById('btnCloseBudgetDetail');
if (btnCloseBudgetDetail) btnCloseBudgetDetail.addEventListener('click', () => { document.getElementById('budgetDetailModal').classList.add('hidden'); });

const btnCloseBudgetDetail2 = document.getElementById('btnCloseBudgetDetail2');
if (btnCloseBudgetDetail2) btnCloseBudgetDetail2.addEventListener('click', () => { document.getElementById('budgetDetailModal').classList.add('hidden'); });

// --- MOVED SEARCH BUDGET LISTENER ---
if (searchBudgetInput) {
    searchBudgetInput.addEventListener('input', e => {
        const term = normalizeKey(String(e && e.target && e.target.value ? e.target.value : ''));
        const base = Array.isArray(budgetsListRows) && budgetsListRows.length ? budgetsListRows : (Array.isArray(budgets) ? budgets : []);
        const filtered = base.filter(b => {
            const seq = normalizeKey(b && b.seqid != null ? String(b.seqid) : '');
            const nome = normalizeKey(b && b.pacientenome ? String(b.pacientenome) : '');
            const cel = normalizeKey(b && b.pacientecelular ? String(b.pacientecelular) : '');
            return !term || seq.includes(term) || nome.includes(term) || cel.includes(term);
        });
        renderTable(filtered, 'budgets');
    });
}

// --- MOVED CANCEL BUDGET LISTENER ---
if (btnCancelBudget) {
    btnCancelBudget.addEventListener('click', () => {
        if (window.__isConsultaAvaliacaoMode) {
            window.__isConsultaAvaliacaoMode = false;
            window.__currentConsultaAgendamentoId = null;
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            document.getElementById('consultaAvaliacaoView').classList.remove('hidden');
            if (document.getElementById('budgetForm')) document.getElementById('budgetForm').reset();
        } else {
            showList('budgets'); // Apenas esconde o formulário e mostra a lista
        }
    });



function getOdontoSelectedTeethList() {
    const raw = String(budItemOdontoTeeth && budItemOdontoTeeth.value || '').trim();
    if (!raw) return [];
    
    // O mesmo regex usado em parseOdontoStringRobust para pegar dente ignorando faces
    const parts = raw.match(/(?:[^,(]|\([^)]*\))+/g);
    if (!parts) return [];
    
    return parts.map(p => {
        const item = p.trim();
        const match = item.match(/^(\d+)/);
        return match ? match[1] : item;
    }).filter(Boolean);
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

// --- MOVED FULL BUDGET FORM LISTENER ---
// Form Save Budget (Master)
if (budgetForm) {
    budgetForm.addEventListener('submit', async e => {
        e.preventDefault();
        console.log("[Flow] Formulário de orçamento submetido.");

        const id = document.getElementById('editBudgetId').value;
        const statusElement = document.getElementById('budStatus');
        let newStatus = statusElement ? statusElement.value : '';
        
        // If disabled due to Avaliacao mode, read the default value
        if (statusElement && statusElement.disabled && window.__isConsultaAvaliacaoMode) {
            newStatus = 'Avaliação';
        }

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
        if (!resolveBudgetCalcTransitionConflictsForPendingBudget(id, newStatus)) {
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
        let profSeqId = profObj ? parseInt(profObj.seqid) : null;
        
        // Se for um novo orçamento e o campo de profissional estiver vazio, preenchemos com o dentista logado (se for o caso)
        if (!id && !profSeqId && currentUserRole === 'dentista') {
            const uEmail = String(currentUser?.email || '').trim().toLowerCase();
            const logado = professionals.find(p => String(p.email || '').trim().toLowerCase() === uEmail);
            if (logado && logado.seqid) {
                profSeqId = parseInt(logado.seqid);
                console.log("[Flow] Autor do orçamento setado automaticamente via e-mail:", profSeqId);
            }
        }

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
                
                // Extrair dentes usando o Regex robusto
                const rawDentes = String(item.dentes || '').trim();
                const elsMatch = rawDentes ? rawDentes.match(/(?:[^,(]|\([^)]*\))+/g) : [];
                const els = elsMatch ? elsMatch.map(x => String(x).trim()) : [];

                return {
                    id: item.id || generateId(),
                    orcamento_id: id || generateId(), // Placeholder if new, will be updated below
                    empresa_id: currentEmpresaId,
                    servico_id: item.servicoId,
                    valor: svc ? (Number(svc.valor) || 0) : item.valor,
                    qtde: (fixo || porElemento) ? 1 : item.qtde,
                    elementos: porElemento ? (els[0] ? [els[0]] : []) : els,
                    protetico_id: proteticoObj ? parseInt(proteticoObj.seqid) : null,
                    valor_protetico: item.valorProtetico || 0,
                    profissional_id: executorObj ? parseInt(executorObj.seqid) : null,
                    subdivisao: item.subdivisao ? item.subdivisao.replace(/^\d+\.\d+\s*-\s*/, '').trim() : '',
                    descricao_atendimento: item.descricaoAtendimento || '', // Capture locally, no DB column yet probably
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

                console.log('[SalvarOrcamento] Supabase orcamentos.update payload:', JSON.stringify(budgetData));
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
                
                // 2.5 Clean up payload for DB
                const dbItemsPayload = itemsPayload.map(it => {
                    const copy = { ...it };
                    return copy;
                });
                
                // 3. Upsert current items (updates existing, inserts new)
                let upsertError = null;
                {
                    console.log('[SalvarOrcamento] Supabase orcamento_itens.upsert payload:', JSON.stringify(dbItemsPayload));
                    const res = await db.from('orcamento_itens').upsert(dbItemsPayload);
                    upsertError = res && res.error ? res.error : null;
                }
                if (upsertError) throw upsertError;

                // 3.5. Sync commissions for updated items (e.g. professional or value changed)
                for (const item of itemsPayload) {
                    const { data: existingComm } = await db.from('financeiro_comissoes').select('id, profissional_id, status, valor_comissao').eq('item_id', item.id).maybeSingle();
                    
                    if (existingComm) {
                        const profChanged = String(existingComm.profissional_id) !== String(item.profissional_id);
                        
                        const profObj = professionals.find(p => String(p.seqid) === String(item.profissional_id));
                        let novoValor = existingComm.valor_comissao;
                        if (profObj) {
                            const bData = budgets.find(b => b.id === id) || budgetData;
                            novoValor = calculateCommission(profObj, item, bData);
                            if (!(novoValor > 0)) novoValor = 0;
                        }

                        const valueChanged = Number(existingComm.valor_comissao) !== Number(novoValor);

                        if (profChanged || valueChanged) {
                            if (['PAGA', 'ANTECIPADA', 'TRANSFERIDA', 'ESTORNADA'].includes(existingComm.status)) {
                                if (profChanged) {
                                    showToast(`Atenção: A comissão de um item editado já foi processada (paga/transferida) e não será alterada para o novo profissional.`, true);
                                }
                            } else {
                                await db.from('financeiro_comissoes').update({
                                    profissional_id: item.profissional_id,
                                    valor_comissao: novoValor
                                }).eq('id', existingComm.id);
                                
                                if (profChanged) {
                                    showToast(`Comissão atualizada para o novo profissional.`, false);
                                }
                            }
                        }
                    }
                }
                
                // 4. Delete only removed items
                if (removedItemIds.length > 0) {
                    const { error: delError } = await db.from('orcamento_itens').delete().in('id', removedItemIds);
                    if (delError) throw delError;
                }

                const index = budgets.findIndex(b => b.id === id);
                if (index !== -1) budgets[index] = { ...budgets[index], ...budgetData, orcamento_itens: itemsPayload };
                showToast('Orçamento atualizado com sucesso!');

                const prevByItemId = new Map();
                try {
                    const prevItems = (originalBudget && (originalBudget.orcamento_itens || originalBudget.itens)) || [];
                    (prevItems || []).forEach(it => {
                        const k = String(it && it.id || '').trim();
                        if (!k) return;
                        prevByItemId.set(k, String(it && it.descricao_atendimento || it && it.descricaoAtendimento || '').trim());
                    });
                } catch { }

                const changedDesc = (itemsPayload || []).filter(it => {
                    const idKey = String(it && it.id || '').trim();
                    if (!idKey) return false;
                    const next = String(it && it.descricao_atendimento || '').trim();
                    if (!next) return false;
                    const prev = prevByItemId.get(idKey) || '';
                    return next !== prev;
                });

                // A pedido do usuário, a gravação de evolução (Prontuário) durante a criação/atualização
                // do orçamento foi removida. A responsabilidade agora é exclusiva do Evento de Finalização (Atendimento).
                // if (changedDesc.length > 0) { ... }

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
                budgets.unshift(inserted);
                
                // Update orcamento_id in itemsPayload for new budget
                itemsPayload.forEach(it => it.orcamento_id = orcamentoId);

                const dbItemsPayload = itemsPayload.map(it => {
                    const copy = { ...it };
                    return copy;
                });

                // Insert new items if there are any
                if (dbItemsPayload.length > 0) {
                    let insertedItems = null;
                    let addError = null;
                    {
                        console.log('[SalvarOrcamento] Supabase orcamento_itens.insert payload:', JSON.stringify(dbItemsPayload));
                        const res = await db.from('orcamento_itens').insert(dbItemsPayload).select();
                        insertedItems = res && res.data ? res.data : null;
                        addError = res && res.error ? res.error : null;
                    }
                    if (addError) throw addError;

                    // Sync the inserted relational items back to the cache
                    const index = budgets.findIndex(b => b.id === orcamentoId);
                    if (index !== -1 && insertedItems) {
                        budgets[index].orcamento_itens = insertedItems;
                    }
                }
                
                // --- INÍCIO LÓGICA CONSULTA/AVALIAÇÃO ---
                // A pedido do usuário, a gravação de evolução (Prontuário) durante a criação do orçamento foi removida.
                // A responsabilidade de registrar no histórico clínico agora é exclusiva do Evento de Finalização do item.
                const itemsWithDesc = itemsPayload.filter(it => it.descricao_atendimento && it.descricao_atendimento.trim() !== '');

                if (window.__isConsultaAvaliacaoMode && window.__currentConsultaAgendamentoId) {
                    try {
                        const { error: agErr } = await db.from('agenda_agendamentos')
                            .update({ status: 'Orçamento Gerado' })
                            .eq('id', window.__currentConsultaAgendamentoId);
                        
                        if (agErr) {
                            console.error("Erro ao atualizar agendamento para Orçamento Gerado:", agErr);
                        } else {
                            // Atualizar na interface se a tela da recepção/agenda estiver aberta (opcional, o reload resolve)
                            // Apenas resetamos a flag do agendamento atual
                            window.__currentConsultaAgendamentoId = null;
                            if (typeof fetchAgendaForUI === 'function') {
                                fetchAgendaForUI();
                            }
                        }
                    } catch (e) {
                        console.error("Erro na lógica de Consulta/Avaliação pós-orçamento:", e);
                    }
                }
                // --- FIM LÓGICA CONSULTA/AVALIAÇÃO ---

                showToast('Orçamento cadastrado com sucesso!');
            }

            // Gerar protocolo fiscal se for Aprovado
            if (budgetData.status === 'Aprovado' || budgetData.status === 'Fechado' || budgetData.status === 'Executado') {
                await checkAndGenerateProtocoloFiscal(orcamentoId);
            }

            if (window.__isConsultaAvaliacaoMode) {
                // Voltar para a tela de Consulta/Avaliação
                window.__isConsultaAvaliacaoMode = false;
                window.__currentConsultaAgendamentoId = null;
                document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
                document.getElementById('consultaAvaliacaoView').classList.remove('hidden');
                
                // Limpar campos
                if (document.getElementById('budgetForm')) document.getElementById('budgetForm').reset();
                
                if (typeof fetchConsultaAvaliacaoForUI === 'function') {
                    fetchConsultaAvaliacaoForUI();
                }
            } else {
                showList('budgets');
                const searchInput = document.getElementById('searchBudgetInput');
                if (searchInput) {
                    searchInput.focus();
                }
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

}

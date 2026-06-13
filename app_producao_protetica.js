
const navProtese = document.getElementById('navProtese');
const proteseView = document.getElementById('proteseView');
let proteseOrders = [];
let proteseLabs = [];
let currentProteseOrder = null;
let protesePayables = [];
let protesePayablesFilteredRows = [];
let currentProtesePayable = null;

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
        const isDoneState = String(o.fase_atual || '') === 'ENCERRADA' || String(o.status_geral || '') === 'CONCLUIDA' || String(o.status_geral || '') === 'CANCELADA';
        const canEditAction = canEdit && !isDoneState;
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
                <button class="btn-icon" onclick="openProteseOrder('${o.id}', true)" title="Visualizar">
                    <i class="ri-eye-line"></i>
                </button>
                <button class="btn-icon" onclick="openProteseOrder('${o.id}')" title="Editar" ${canEditAction ? '' : 'disabled style="opacity:.4; cursor:not-allowed;"'}>
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

function openProteseModal(order, forceReadonly = false) {
    window.__currentProteseReadonly = forceReadonly;
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
            .filter(p => (normalizeRole(p.tipo) === 'protetico' || String(p.tipo || '').toLowerCase().includes('prot')) && p.status === 'Ativo')
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
    
    const btnSave = document.getElementById('btnProteseSave');
    if (btnSave) {
        if (forceReadonly) {
            btnSave.disabled = true;
            btnSave.style.opacity = '0.5';
            btnSave.style.cursor = 'not-allowed';
            btnSave.title = 'Modo de visualização (Apenas Leitura)';
        } else if (order && order.fase_atual === 'ENCERRADA') {
            btnSave.disabled = true;
            btnSave.style.opacity = '0.5';
            btnSave.style.cursor = 'not-allowed';
            btnSave.title = 'Ordens encerradas não podem ser alteradas';
        } else {
            btnSave.disabled = false;
            btnSave.style.opacity = '1';
            btnSave.style.cursor = 'pointer';
            btnSave.title = '';
        }
    }

    const mainInputs = [
        'protesePaciente', 'proteseOrcamentoSeqid', 'proteseOrcamentoItemId',
        'proteseTipoExecucao', 'proteseOrigemTrabalho', 'proteseMaterialTipo',
        'proteseStatusGeral', 'proteseLaboratorio', 'proteseProtetico',
        'protesePrazo', 'protesePrioridade', 'proteseObservacoes',
        'proteseAnexoFile', 'proteseNota'
    ];
    mainInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = forceReadonly;
            if (forceReadonly) {
                el.style.opacity = '0.7';
            } else {
                el.style.opacity = '1';
            }
        }
    });

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
            const ok = openOCCReportPrintWindow({ reportName: 'Relatórios OP', bodyHtml: body.innerHTML, width: 900, height: 700 });
            if (!ok) return;
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

    const canWrite = (can('protese', 'insert') || can('protese', 'update')) && !window.__currentProteseReadonly;
    const fase = String((currentProteseOrder && currentProteseOrder.fase_atual) || '').trim();
    const st = String((currentProteseOrder && currentProteseOrder.status_geral) || (document.getElementById('proteseStatusGeral') || {}).value || '').trim();
    const isSaved = !!(currentProteseOrder && currentProteseOrder.id);
    const isDone = (fase === 'ENCERRADA' || st === 'CANCELADA');
    const materialTipo = String((materialSel && materialSel.value) || (currentProteseOrder && currentProteseOrder.material_tipo) || 'FISICO');

    const setBtn = (btn, enabled) => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.55';
    };

    const enabled = canWrite && !isDone && isSaved;
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
        if (!enabled) {
            quickSel.title = isSaved ? 'Ações desabilitadas para OP Encerrada/Cancelada' : 'Salve a OP primeiro para habilitar ações';
        } else {
            quickSel.title = '';
        }
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
            .order('created_at', { ascending: false })
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
                .order('confirmed_at', { ascending: false })
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

        const all = events.concat(custodia).sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
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
                i: all.length - idx,
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

    if (currentProteseOrder && currentProteseOrder.status_geral === 'CONCLUIDA') {
        showToast('Ordens Protéticas já CONCLUÍDAS não podem ser alteradas ou salvas.', true);
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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: 'Produção Protética - Ordem de Prótese', legacyHtml: html, width: 900, height: 700 });
    if (!ok) return;
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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: 'Produção Protética - Ordem de Prótese (Simples)', legacyHtml: html, width: 900, height: 700 });
    if (!ok) return;
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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: 'Financeiro - Contas a Pagar Protética', legacyHtml: html, width: 980, height: 720 });
    if (!ok) return;
}

const budItemProteseExecucao = document.getElementById('budItemProteseExecucao');

const budItemProteseLaboratorioId = document.getElementById('budItemProteseLaboratorioId');
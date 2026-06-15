

let patients = [];

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
const navPatients = document.getElementById('navPatients');
const navChatPacientes = document.getElementById('navChatPacientes');

// View Elements
const patientListView = document.getElementById('patientListView');
const patientFormView = document.getElementById('patientFormView');
const patientPortalView = document.getElementById('patientPortalView');

// Patient DOM Elements
const btnAddNewPatient = document.getElementById('btnAddNew');
const btnBackPatient = document.getElementById('btnBack');
const btnCancelPatient = document.getElementById('btnCancelPatient');
const patientForm = document.getElementById('patientForm');
const patientsTableBody = document.getElementById('patientsTableBody');
const patientEmptyState = document.getElementById('patientEmptyState');
const finNomePaciente = document.getElementById('finNomePaciente');
const finSaldoPaciente = document.getElementById('finSaldoPaciente');
const transacaoPaciente = document.getElementById('transacaoPaciente');
const grpPacienteDestino = document.getElementById('grpPacienteDestino');
const transacaoPacienteDestino = document.getElementById('transacaoPacienteDestino');
const finPacienteSearch = document.getElementById('finPacienteSearch');
const btnPagamentosPacientes = document.getElementById('btnPagamentosPacientes');
const btnFatMensalPaciente = document.getElementById('btnFatMensalPaciente');
const pagamentosPacientesModal = document.getElementById('pagamentosPacientesModal');
const btnClosePagamentosPacientesModal = document.getElementById('btnClosePagamentosPacientesModal');
const btnCancelPagamentosPacientes = document.getElementById('btnCancelPagamentosPacientes');
const btnGeneratePagamentosPacientes = document.getElementById('btnGeneratePagamentosPacientes');
const pagamentosPacientesStart = document.getElementById('pagamentosPacientesStart');
const pagamentosPacientesEnd = document.getElementById('pagamentosPacientesEnd');
const pagamentosPacientesForma = document.getElementById('pagamentosPacientesForma');
const consultaPacientesTableBody = document.getElementById('consultaPacientesTableBody');

function resolvePacienteNameById(pid) {
    const id = String(pid || '').trim();
    if (!id) return '';
    const p = (patients || []).find(x => String(x && x.id || '') === id || String(x && x.seqid || '') === id) || null;
    if (!p) return '';
    const ficha = String(p && p.numero_prontuario || '').trim();
    const nome = String(p && p.nome || '').trim();
    if (ficha) return `${ficha} - ${nome || 'Paciente'}`;
    return nome || '';
}

function resolveOrcamentoPacienteId(b) {
    if (!b) return '';
    return String(b.paciente_id || b.pacienteid || b.pacienteId || '').trim();
}

let patientPortalLoading = false;

async function fetchPatientPortalAppointments(pacienteSeqId) {
    const empId = String(currentEmpresaId || '').trim();
    const pid = Number(pacienteSeqId);
    if (!empId || !pid) return [];
    const nowIso = new Date().toISOString();
    const q = db.from('agenda_agendamentos')
        .select('*')
        .eq('empresa_id', empId)
        .eq('paciente_id', pid)
        .gte('inicio', nowIso)
        .order('inicio', { ascending: true })
        .limit(50);
    const { data, error } = await withTimeout(q, 15000, 'patient_portal:agenda_agendamentos');
    if (error) throw error;
    return data || [];
}

function renderPatientPortal(rows, paciente) {
    const body = document.getElementById('patientPortalBody');
    const summary = document.getElementById('patientPortalSummary');
    if (summary) {
        const nome = paciente && paciente.nome ? String(paciente.nome) : String(currentUser && currentUser.email || 'Paciente');
        summary.textContent = `${nome} • ${rows.length} agendamentos futuros`;
    }
    if (!body) return;
    if (!rows || rows.length === 0) {
        body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum agendamento futuro encontrado.</td></tr>`;
        return;
    }
    body.innerHTML = rows.map(r => {
        const dt = r && r.inicio ? new Date(r.inicio) : null;
        const dateStr = dt && Number.isFinite(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : '—';
        const timeStr = dt && Number.isFinite(dt.getTime()) ? dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
        const prof = getProfessionalNameBySeqId(r && r.profissional_id);
        const st = String(r && (r.status || r.status_agendamento) || 'MARCADO');
        return `
            <tr>
                <td>${escapeHtml(dateStr)}</td>
                <td>${escapeHtml(timeStr)}</td>
                <td>${escapeHtml(prof || '—')}</td>
                <td>${escapeHtml(st)}</td>
                <td style="text-align:center;">
                    <button class="btn btn-secondary btn-sm js-portal-checkin" data-id="${escapeHtml(String(r && r.id || ''))}"><i class="ri-login-box-line"></i> Check-in</button>
                </td>
            </tr>
        `;
    }).join('');
    body.querySelectorAll('.js-portal-checkin').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = String(btn.getAttribute('data-id') || '').trim();
            if (!id) return;
            try {
                btn.disabled = true;
                const { error } = await withTimeout(
                    db.from('agenda_agendamentos').update({ status: 'CHECKIN' }).eq('id', id).eq('empresa_id', currentEmpresaId),
                    15000,
                    'patient_portal:checkin'
                );
                if (error) throw error;
                showToast('Check-in registrado.');
                await loadPatientPortalView();
            } catch (err) {
                const msg = err && err.message ? String(err.message) : 'Falha ao registrar check-in.';
                showToast(msg, true);
            } finally {
                btn.disabled = false;
            }
        });
    });
}

async function loadPatientPortalView() {
    if (patientPortalLoading) return;
    patientPortalLoading = true;
    const body = document.getElementById('patientPortalBody');
    if (body) body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>`;
    try {
        const paciente = getPatientPortalPaciente();
        if (!paciente || !paciente.seqid) {
            if (body) body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Não foi possível localizar seu cadastro de paciente por e-mail.</td></tr>`;
            const summary = document.getElementById('patientPortalSummary');
            if (summary) summary.textContent = '—';
            return;
        }
        const rows = await fetchPatientPortalAppointments(paciente.seqid);
        renderPatientPortal(rows, paciente);
    } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Falha ao carregar seus agendamentos.';
        showToast(msg, true);
        if (body) body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">${escapeHtml(msg)}</td></tr>`;
    } finally {
        patientPortalLoading = false;
    }
}

// ==========================================
// WHATSAPP MARKETING MODULE
// ==========================================
let waSelectedPatients = [];

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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: 'Pagamentos de Pacientes', legacyHtml: html, width: 980, height: 720 });
    if (!ok) return;
}

async function printFaturamentoMensalPacienteCross(year) {
    const startIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
    const endIso = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();
    let payments = [];
    let dateCol = 'created_at';
    const qByDateCol = async (col) => {
        const { data, error } = await withTimeout(
            db.from('orcamento_pagamentos')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .gte(col, startIso)
                .lte(col, endIso)
                .order(col, { ascending: true }),
            20000,
            `cross_paciente:orcamento_pagamentos:${col}`
        );
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    };
    try {
        try {
            payments = await qByDateCol('created_at');
            dateCol = 'created_at';
        } catch {
            payments = await qByDateCol('data_pagamento');
            dateCol = 'data_pagamento';
        }
    } catch (err) {
        showToast(`Falha ao carregar pagamentos: ${err && err.message ? err.message : 'erro'}`, true);
        return;
    }

    const budgetBySeqid = new Map((budgets || []).map(b => [String(b.seqid), b]));
    const patientById = new Map((patients || []).map(p => [String(p.id), p]));
    const patientBySeq = new Map((patients || []).map(p => [String(p.seqid), p]));
    const seqids = Array.from(new Set(payments.map(p => String(p.orcamento_id || '')).filter(Boolean)));
    const seqidToPacienteUuid = new Map();
    seqids.forEach(s => {
        const b = budgetBySeqid.get(String(s));
        const pid = b ? String(b.pacienteid || b.paciente_id || '') : '';
        if (pid) seqidToPacienteUuid.set(String(s), pid);
    });
    const missingSeq = seqids.filter(s => !seqidToPacienteUuid.has(String(s)));
    if (missingSeq.length) {
        try {
            const { data: orcs } = await withTimeout(
                db.from('orcamentos')
                    .select('seqid,paciente_id,pacienteid,pacientenome')
                    .eq('empresa_id', currentEmpresaId)
                    .in('seqid', missingSeq.slice(0, 200).map(n => Number(n))),
                15000,
                'cross_paciente:orcamentos'
            );
            (Array.isArray(orcs) ? orcs : []).forEach(o => {
                const pid = String(o.pacienteid || o.paciente_id || '');
                if (o.seqid != null && pid) seqidToPacienteUuid.set(String(o.seqid), pid);
            });
        } catch { }
    }

    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const map = new Map();
    const monthTotals = Array(12).fill(0);
    let grandTotal = 0;
    payments.forEach((p) => {
        const dt = p && p[dateCol] ? new Date(p[dateCol]) : null;
        if (!dt || !Number.isFinite(dt.getTime())) return;
        if (dt.getUTCFullYear() !== year && dt.getFullYear() !== year) return;
        const month = dt.getMonth();
        const seq = String(p.orcamento_id || '');
        const pacUuid = seqidToPacienteUuid.get(seq) || '';
        const pac = pacUuid ? (patientById.get(pacUuid) || patientBySeq.get(pacUuid)) : null;
        const name = pac ? String(pac.nome || '') : (seq ? `Orçamento #${seq}` : 'Sem paciente');
        if (!map.has(name)) map.set(name, { name, months: Array(12).fill(0), total: 0 });
        const row = map.get(name);
        const val = Number(p.valor_pago || 0);
        row.months[month] += val;
        row.total += val;
        monthTotals[month] += val;
        grandTotal += val;
    });
    const rows = Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const html = buildCrossTableHtml({
        title: `Faturamento Mensal`,
        subtitle: `Cross table por paciente • Ano ${year}`,
        entityLabel: 'Paciente',
        monthLabels,
        rows,
        monthTotals,
        grandTotal
    });
    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: `Faturamento Mensal - Paciente (${year})`, legacyHtml: html, width: 1200, height: 780 });
    if (!ok) return;
}

let buscaPacienteTimeout = null;

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
                const elIbge = document.getElementById('occ_paciente_ibge');

                if (elEndereco) elEndereco.value = data.logradouro || '';
                if (elBairro) elBairro.value = data.bairro || '';
                if (elCidade) elCidade.value = data.localidade || '';
                if (elUf) elUf.value = data.uf || '';
                if (elIbge) elIbge.value = data.ibge || '';

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

// Form Submit Patient
function syncPatientProfissaoUI() {
    const sel = document.getElementById('profissao');
    const other = document.getElementById('profissaoOutro');
    if (!sel || !other) return;
    const isOther = String(sel.value || '') === 'Outro';
    other.style.display = isOther ? 'block' : 'none';
    if (!isOther) other.value = '';
}

// Auto-fill Patient Data from Datalist
const budPacienteNomeInput = document.getElementById('budPacienteNome');

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

// Orçamentos tab
function renderPatientBudgets(patientId) {
    const body = document.getElementById('detOrcamentosBody');
    if (!body) return;

    // Buscar o objeto do paciente para ter o nome como fallback
    const patObj = patients.find(p => String(p.id) === String(patientId) || String(p.seqid) === String(patientId));
    const patName = patObj ? patObj.nome : null;

    const filtered = budgets.filter(b => {
        // Ignorar orçamentos de avaliação na listagem do paciente
        const statusKey = normalizeKey(b.status);
        if (statusKey.includes('AVALIACAO')) return false;

        const bPacId = b.pacienteid || b.paciente_id || b.pacienteseqid;

        // 1. Comparação Direta de ID (Robustas)
        if (bPacId && patientId && String(bPacId).trim() === String(patientId).trim()) return true;

        // 2. Fallback por Nome (Útil para registros migrados ou inconsistencies de ID)
        if (patName && b.pacientenome && b.pacientenome.trim().toLowerCase() === patName.trim().toLowerCase()) return true;

        return false;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 20px;">Nenhum orçamento para este paciente.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(b => {
        try {
            const prof = professionals.find(p => String(p.id) === String(b.profissional_id) || String(p.seqid) === String(b.profissional_id));
            const profNome = prof ? prof.nome : 'Não informado';
            const total = calculateBudgetTotal(b);
            
            // Calcula o total pago considerando pagamentos e propriedades legadas
            let totalPago = Number(b.total_pago || 0);
            if (totalPago === 0 && Number(b.total_pago_na_epoca || 0) > 0) {
                totalPago = Number(b.total_pago_na_epoca);
            }
            
            const status = b.status || 'Pendente';

            return `
                <tr>
                    <td>${formatDateTime(b.created_at)}</td>
                    <td>${profNome}</td>
                    <td><span class="badge badge-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td>
                    <td><strong>R$ ${total.toFixed(2)}</strong></td>
                    <td style="color: var(--success-color);"><strong>R$ ${totalPago.toFixed(2)}</strong></td>
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
            <div class="section-icon">Ã°Å¸â€œâ€¹</div>
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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: `Prontuário do Paciente - ${String(patient.nome || '')}`, legacyHtml: html, width: 1000, height: 800 });
    if (!ok) return;
}

function findPatientFromTransaction(tx) {
    const pid = String(tx && tx.paciente_id || '').trim();
    if (!pid) return null;
    return (patients || []).find(p => String(p.id) === pid || String(p.seqid) === pid) || null;
}

async function persistPatientIbgeCode(patient, ibgeCode) {
    const pid = String(patient && patient.id || '').trim();
    const code = String(ibgeCode || '').trim();
    if (!pid || !code) return false;
    const sample = (patients || []).find(p => p && (String(p.id || '') === pid || String(p.seqid || '') === String(patient && patient.seqid || ''))) || {};
    const dynamicCols = ['codigo_ibge', 'ibge', 'codigo_municipio_ibge', 'cod_ibge', 'municipio_ibge']
        .filter(col => Object.prototype.hasOwnProperty.call(sample, col));
    const orderedCols = Array.from(new Set([...dynamicCols, 'codigo_ibge', 'ibge', 'codigo_municipio_ibge', 'cod_ibge', 'municipio_ibge']));
    const tries = orderedCols.map((col) => ({ [col]: code }));
    for (const body of tries) {
        let q = db.from('pacientes').update(body).eq('id', pid);
        if (currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
        const { error } = await withTimeout(q, 12000, 'pacientes:update_ibge');
        if (!error) return true;
    }
    return false;
}

async function autoFixPatientIbge(patient) {
    if (!patient) return '';
    const existing = getPatientIbgeCode(patient);
    if (existing) return existing;
    const city = String(patient.cidade || '').trim();
    const uf = String(patient.uf || '').trim().toUpperCase();
    if (!city || !uf) return '';
    const code = await resolveMunicipioIbgeCode(city, uf);
    if (!code) return '';
    const ok = await persistPatientIbgeCode(patient, code);
    if (ok) {
        patient.codigo_ibge = code;
        patient.ibge = code;
    }
    return code;
}

async function autoFixPatientsIbgeForTransactions(txRows = []) {
    const pats = new Map();
    (txRows || []).forEach((t) => {
        const p = findPatientFromTransaction(t);
        if (p && p.id) pats.set(String(p.id), p);
    });
    for (const p of pats.values()) {
        if (getPatientIbgeCode(p)) continue;
        await autoFixPatientIbge(p);
    }
}











// ============================================================================
// MÓDULO CENTRAL DO PACIENTE (CHAT)
// ============================================================================
let currentChatPacienteId = null;

async function loadChatPacientesList() {
    const listContainer = document.getElementById('chatPacientesList');
    if (!listContainer) return;
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">Carregando...</p>';

    try {
        console.log('Dados da Sessão:', { isSuperAdmin, currentEmpresaId });
        
        // Obter mensagens do banco de dados (RAW)
        let query = isSuperAdmin ? db.from('portal_mensagens').select('id, paciente_id, conteudo, remetente, lida, created_at, empresa_id, tipo_mensagem') : db.from('portal_mensagens').select('id, paciente_id, conteudo, remetente, lida, created_at, empresa_id, tipo_mensagem');
        
        if (!isSuperAdmin) {
            if (currentEmpresaId) {
                query = query.eq('empresa_id', currentEmpresaId);
            } else {
                query = query.eq('empresa_id', 'emp_165f9d072a');
            }
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        console.log('Resultado Query Chat:', { data, error });

        if (error) throw error;

        if (!data || data.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">Nenhuma conversa encontrada.</p>';
            return;
        }

        // Agrupar por paciente
        const contactsMap = new Map();
        data.forEach(msg => {
            const pid = msg.paciente_id;
            if (!contactsMap.has(pid)) {
                // Find patient in global array
                const pac = (typeof patients !== 'undefined' ? patients : []).find(p => String(p.id) === String(pid) || String(p.seqid) === String(pid));
                contactsMap.set(pid, {
                    paciente_id: pid,
                    nome: pac && pac.nome ? pac.nome : (pid || 'Paciente Sem ID'),
                    celular: pac ? pac.occ_paciente_celular : '',
                    lastMessage: msg.conteudo,
                    lastMessageDate: msg.created_at,
                    unreadCount: 0
                });
            }
            // case-insensitive check for remetente
            if (msg.remetente && msg.remetente.toUpperCase() === 'PACIENTE' && !msg.lida) {
                contactsMap.get(pid).unreadCount++;
            }
        });

        const contacts = Array.from(contactsMap.values());
        renderChatPacientesList(contacts);

        // Inicializar Realtime se ainda não foi
        if (!chatSubscriptionAdmin) {
            initChatAdminRealtime();
        }

    } catch (err) {
        console.error('Erro ao carregar lista de chat:', err);
        listContainer.innerHTML = '<p style="text-align: center; color: var(--danger-color); font-size: 13px; margin-top: 20px;">Erro ao carregar conversas.</p>';
    }
}

function renderChatPacientesList(contacts) {
    const listContainer = document.getElementById('chatPacientesList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (contacts.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">Nenhuma conversa.</p>';
        return;
    }

    contacts.forEach(contact => {
        const item = document.createElement('div');
        const isActive = currentChatPacienteId === contact.paciente_id;
        
        item.style.padding = '12px';
        item.style.borderRadius = '8px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        item.style.background = isActive ? '#e0e7ff' : 'transparent';
        item.style.transition = 'background 0.2s';
        
        item.onmouseenter = () => { if(!isActive) item.style.background = '#f1f5f9'; };
        item.onmouseleave = () => { if(!isActive) item.style.background = 'transparent'; };

        item.onclick = () => openChatPaciente(contact.paciente_id, contact.nome);

        // Avatar
        const avatar = document.createElement('div');
        avatar.style.width = '40px';
        avatar.style.height = '40px';
        avatar.style.borderRadius = '50%';
        avatar.style.background = 'var(--primary-color)';
        avatar.style.color = '#fff';
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.style.fontWeight = 'bold';
        avatar.style.fontSize = '14px';
        avatar.innerText = (contact.nome || 'P').substring(0, 2).toUpperCase();

        const info = document.createElement('div');
        info.style.flex = '1';
        info.style.overflow = 'hidden';

        const nameDiv = document.createElement('div');
        nameDiv.style.fontWeight = '600';
        nameDiv.style.fontSize = '14px';
        nameDiv.style.color = 'var(--text-color)';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.innerText = contact.nome;

        const msgDiv = document.createElement('div');
        msgDiv.style.fontSize = '12px';
        msgDiv.style.color = 'var(--text-muted)';
        msgDiv.style.whiteSpace = 'nowrap';
        msgDiv.style.overflow = 'hidden';
        msgDiv.style.textOverflow = 'ellipsis';
        msgDiv.innerText = contact.lastMessage;

        info.appendChild(nameDiv);
        info.appendChild(msgDiv);

        item.appendChild(avatar);
        item.appendChild(info);

        if (contact.unreadCount > 0) {
            const badge = document.createElement('div');
            badge.style.background = 'var(--danger-color)';
            badge.style.color = '#fff';
            badge.style.fontSize = '11px';
            badge.style.fontWeight = 'bold';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '10px';
            badge.innerText = contact.unreadCount;
            item.appendChild(badge);
        }

        listContainer.appendChild(item);
    });
}

async function openChatPaciente(pacienteId, pacienteNome) {
    currentChatPacienteId = pacienteId;
    
    // Atualizar UI
    document.getElementById('chatActivePatientName').innerText = pacienteNome;
    
    const messagesContainer = document.getElementById('chatActiveMessages');
    messagesContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">Carregando mensagens...</p>';

    // Recarregar lista para marcar como ativo
    loadChatPacientesList();

    try {
        // Buscar histórico
        let query = isSuperAdmin ? db.from('portal_mensagens').select('id, paciente_id, conteudo, remetente, lida, created_at, empresa_id, tipo_mensagem') : db.from('portal_mensagens').select('id, paciente_id, conteudo, remetente, lida, created_at, empresa_id, tipo_mensagem');
        
        if (!isSuperAdmin) {
            if (currentEmpresaId) {
                query = query.eq('empresa_id', currentEmpresaId);
            } else {
                query = query.eq('empresa_id', 'emp_165f9d072a');
            }
        }
        
        const { data, error } = await query
            .eq('paciente_id', pacienteId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        messagesContainer.innerHTML = '';
        window.lastRenderedDateAdmin = null;
        if (data && data.length > 0) {
            data.forEach(msg => appendChatMessageAdmin(msg));
            scrollToBottomAdmin();
            
            // Marcar como lida
            const unreadIds = data.filter(m => m.remetente && m.remetente.toUpperCase() === 'PACIENTE' && !m.lida).map(m => m.id);
            if (unreadIds.length > 0) {
                await db.from('portal_mensagens').update({ lida: true }).in('id', unreadIds);
                loadChatPacientesList(); // Atualizar badges
                updateGlobalChatBadge();
            }
        } else {
            messagesContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">Nenhuma mensagem ainda.</p>';
        }
    } catch (err) {
        console.error('Erro ao abrir chat:', err);
        messagesContainer.innerHTML = '<p style="text-align: center; color: var(--danger-color); font-size: 13px; margin-top: 20px;">Erro ao carregar histórico.</p>';
    }

    // Configurar botão de enviar
    const btnSend = document.getElementById('btnSendAdminChat');
    const inputMsg = document.getElementById('chatAdminInput');
    
    btnSend.disabled = false;
    inputMsg.disabled = false;
    const btnAnexo = document.getElementById('btnAdminAnexo');
    if (btnAnexo) btnAnexo.disabled = false;

    // Remover listeners anteriores (cloneNode trick)
    const newBtn = btnSend.cloneNode(true);
    btnSend.parentNode.replaceChild(newBtn, btnSend);
    
    const newInput = inputMsg.cloneNode(true);
    inputMsg.parentNode.replaceChild(newInput, inputMsg);
    
    newBtn.onclick = () => sendChatMensagemAdmin(pacienteId);
    newInput.onkeypress = (e) => {
        if (e.key === 'Enter') sendChatMensagemAdmin(pacienteId);
    };
    newInput.focus();
}

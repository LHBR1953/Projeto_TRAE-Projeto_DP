

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
const navDashboard = document.getElementById('navDashboard');
const navSuporteTickets = document.getElementById('navSuporteTickets');
const dashboardView = document.getElementById('dashboardView');
const suporteTicketsView = document.getElementById('suporteTicketsView');
const btnNovoTicket = document.getElementById('btnNovoTicket');
const btnRefreshTickets = document.getElementById('btnRefreshTickets');
const btnPrintTicketsReport = document.getElementById('btnPrintTicketsReport');
const btnPrintTicketsReportFull = document.getElementById('btnPrintTicketsReportFull');
const ticketReportModal = document.getElementById('ticketReportModal');
const btnTicketReportModalX = document.getElementById('btnTicketReportModalX');
const btnTicketReportCancel = document.getElementById('btnTicketReportCancel');
const btnTicketReportGenerate = document.getElementById('btnTicketReportGenerate');
let ticketReportType = 'simples';
const ticketReportCategoria = document.getElementById('ticketReportCategoria');
const ticketReportStatus = document.getElementById('ticketReportStatus');
const suporteTicketsBody = document.getElementById('suporteTicketsBody');
const suporteTicketsEmptyState = document.getElementById('suporteTicketsEmptyState');
const suporteTicketModal = document.getElementById('suporteTicketModal');
const suporteTicketModalTitle = document.getElementById('suporteTicketModalTitle');
const suporteTicketId = document.getElementById('suporteTicketId');
const suporteTicketTitulo = document.getElementById('suporteTicketTitulo');
const suporteTicketCategoria = document.getElementById('suporteTicketCategoria');
const suporteTicketDescricao = document.getElementById('suporteTicketDescricao');
const suporteTicketAdminStatusGroup = document.getElementById('suporteTicketAdminStatusGroup');
const suporteTicketRespostaGroup = document.getElementById('suporteTicketRespostaGroup');
const suporteTicketResposta = document.getElementById('suporteTicketResposta');
const suporteTicketStatus = document.getElementById('suporteTicketStatus');
const btnSalvarTicket = document.getElementById('btnSalvarTicket');

const modalSuperAdmin = document.getElementById('modalSuperAdmin');
const btnCloseModalSuperAdmin = document.getElementById('btnCloseModalSuperAdmin');
const btnSuperAdminClose = document.getElementById('btnSuperAdminClose');

let dashImportBannerBound = false;

function updateDashboardImportDefaultBanner() {
    const banner = document.getElementById('dashImportDefaultBanner');
    const btn = document.getElementById('btnDashImportDefaultTemplates');
    const dismissBtn = document.getElementById('btnDashDismissImportBanner');
    if (!banner || !btn) return;
    refreshImportDefaultTemplatesVisibility();
    const prefKey = `occ_hide_import_banner:${String(currentUser && currentUser.id || '')}:${String(currentEmpresaId || '')}`;
    let isDismissed = false;
    try { isDismissed = localStorage.getItem(prefKey) === '1'; } catch { }
    const canSee = !!((isSuperAdmin || isAdminRole()) && isOnboardingStockEmpty() && !isDismissed);
    if (canSee) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
    if (!dashImportBannerBound) {
        dashImportBannerBound = true;
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                const res = await importDefaultTemplatesForCurrentEmpresa();
                if (res && res.ok) banner.classList.add('hidden');
            } finally {
                btn.disabled = false;
            }
        });
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                try { localStorage.setItem(prefKey, '1'); } catch { }
                banner.classList.add('hidden');
                showToast('Sugestão ocultada.');
            });
        }
    }
}

async function refreshDashboardFromUI() {
    const dashDate = document.getElementById('dashDate');
    const dashProfessional = document.getElementById('dashProfessional');
    const dateStr = dashDate ? dashDate.value : '';
    const profSeqId = dashProfessional ? dashProfessional.value : '';
    if (!dateStr) return;
    if (!hasBootDataContext()) return;
    await fetchDashboard({ dateStr, profSeqId: profSeqId ? Number(profSeqId) : null });
    
    // Ensure configPlanosList is loaded before rendering renewals so resolvePlanDisplayName works
    if (!configPlanosList || configPlanosList.length === 0) {
        await fetchConfigPlanos();
    }
    renderSuperAdminRenewals();
    fetchDashboardTicketKpis();
}

async function fetchDashboardTicketKpis() {
    const kpiWrap = document.getElementById('superAdminTicketsKpis');
    if (!kpiWrap) return;
    
    if (!isSuperAdmin) {
        kpiWrap.classList.add('hidden');
        return;
    }
    
    kpiWrap.classList.remove('hidden');
    
    try {
        const { data, error } = await db.from('suporte_tickets')
            .select('categoria, status')
            .neq('status', 'Concluído');
            
        if (error) throw error;
        
        let countBug = 0;
        let countDuvida = 0;
        let countSol = 0;
        let countFin = 0;
        let countOutros = 0;
        
        for (const t of (data || [])) {
            const cat = (t.categoria || '').trim();
            if (cat === 'Bug / Erro') countBug++;
            else if (cat === 'Dúvidas') countDuvida++;
            else if (cat === 'Solicitação') countSol++;
            else if (cat === 'Financeiro') countFin++;
            else countOutros++;
        }
        
        const elBug = document.getElementById('kpiTicketBug');
        const elDuvida = document.getElementById('kpiTicketDuvida');
        const elSol = document.getElementById('kpiTicketSol');
        const elFin = document.getElementById('kpiTicketFin');
        const elOutros = document.getElementById('kpiTicketOutros');
        
        if (elBug) elBug.textContent = countBug;
        if (elDuvida) elDuvida.textContent = countDuvida;
        if (elSol) elSol.textContent = countSol;
        if (elFin) elFin.textContent = countFin;
        if (elOutros) elOutros.textContent = countOutros;
        
    } catch (err) {
        console.error('Erro ao buscar KPIs de tickets:', err);
    }
}

function renderSuperAdminRenewals() {
    const kpiCard = document.getElementById('kpiRenovacoesCard');
    const kpiVal = document.getElementById('kpiRenovacoes');
    const kpiSub = document.getElementById('kpiRenovacoesSub');
    const card = document.getElementById('dashRenewalsCard');
    const sub = document.getElementById('dashRenewalsSub');
    const filterEl = document.getElementById('dashRenewalsFilter');
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

    const getFilterValue = () => {
        let val = '';
        try { val = filterEl ? String(filterEl.value || '') : ''; } catch { }
        if (!val) {
            try { val = String(localStorage.getItem('dashRenewalsFilter') || ''); } catch { }
        }
        return val || 'ALL';
    };
    const setFilterValue = (v) => {
        if (filterEl) filterEl.value = v;
        try { localStorage.setItem('dashRenewalsFilter', v); } catch { }
    };
    const filterValue = getFilterValue();
    if (filterEl && !filterEl.__bound) {
        filterEl.__bound = true;
        filterEl.addEventListener('change', () => {
            const v = getFilterValue();
            setFilterValue(v);
            renderSuperAdminRenewals();
        });
    }
    setFilterValue(filterValue);

    const allRows = (activeEmpresasList || [])
        .map(e => {
            const id = e && e.id ? String(e.id) : '';
            const nome = e && e.nome ? String(e.nome) : id || '—';
            const statusRaw = String(e && e.assinatura_status || 'PENDENTE').toUpperCase();
            const status = statusRaw === 'TRAIL' ? 'TRIAL' : statusRaw;
            const venc = e && e.data_vencimento ? String(e.data_vencimento).slice(0, 10) : '';
            let vencDate = null;
            let diffDays = null;
            if (venc) {
                const tmp = new Date(`${venc}T00:00:00`);
                if (Number.isFinite(tmp.getTime())) {
                    vencDate = tmp;
                    diffDays = Math.ceil((vencDate.getTime() - today.getTime()) / dayMs);
                }
            }
            const isPending = status === 'PENDENTE';
            const isActive = status === 'ATIVO';
            const isTrial = status === 'TRIAL';
            const isExpired = Number.isFinite(diffDays) && diffDays < 0;
            return { id, nome, status, venc, vencDate, diffDays, isPending, isActive, isTrial, isExpired };
        })
        .filter(r => r && r.id);

    // Apenas quem vence nos próximos 5 dias (0 a 5)
    const within5Days = allRows.filter(r => r.vencDate && r.diffDays >= 0 && r.diffDays <= 5);

    const rows = allRows
        .filter(r => {
            if (filterValue === 'ALL') return true;
            if (filterValue === 'ATIVO') return r.isActive;
            if (filterValue === 'TRIAL') return r.isTrial;
            if (filterValue === 'PENDENTE') return r.isPending;
            if (filterValue === 'VENCIDA') return r.isExpired;
            if (filterValue === '5DIAS') return r.vencDate && r.diffDays >= 0 && r.diffDays <= 5;
            return true;
        })
        .sort((a, b) => {
            const ta = a.vencDate ? a.vencDate.getTime() : Number.MAX_SAFE_INTEGER;
            const tb = b.vencDate ? b.vencDate.getTime() : Number.MAX_SAFE_INTEGER;
            if (ta !== tb) return ta - tb;
            return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });

    const total5Days = within5Days.length;
    const activeCount = within5Days.filter(r => r.isActive).length;
    const trialCount = within5Days.filter(r => r.isTrial).length;

    if (kpiVal) kpiVal.textContent = String(total5Days);
    if (kpiSub) {
        const parts = [];
        if (activeCount) parts.push(`${activeCount} ativa(s)`);
        if (trialCount) parts.push(`${trialCount} trial`);
        kpiSub.textContent = parts.length ? parts.join(' | ') : 'Nenhuma no período';
    }

    if (sub) {
        const label = filterValue === 'ALL'
            ? 'Todas as clínicas'
            : (filterValue === 'ATIVO' ? 'Clínicas ativas'
                : (filterValue === 'TRIAL' ? 'Clínicas em trial'
                    : (filterValue === 'PENDENTE' ? 'Clínicas pendentes'
                        : (filterValue === 'VENCIDA' ? 'Clínicas vencidas' 
                            : (filterValue === '5DIAS' ? 'Vencem em até 5 dias' : 'Clínicas')))));
        sub.textContent = `${label}: ${rows.length}`;
    }

    if (body) body.innerHTML = '';
    if (!rows.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    const statusBadgeHtml = (statusRaw) => {
        const status = String(statusRaw || 'PENDENTE').toUpperCase();
        if (status === 'ATIVO') return '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#dcfce7; color:#166534; font-weight:700;">ATIVO</span>';
        if (status === 'TRIAL' || status === 'TRAIL') return '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#dbeafe; color:#1d4ed8; font-weight:700;">TRIAL</span>';
        return '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#ffedd5; color:#c2410c; font-weight:700;">PENDENTE</span>';
    };
    const updateRenewalStatus = async (empresaId, newStatus) => {
        if (!isSuperAdmin) return;
        const id = String(empresaId || '').trim();
        const status = String(newStatus || '').trim().toUpperCase();
        if (!id || !status) return;
        try {
            const payload = { assinatura_status: status };
            if (status === 'ATIVO' || status === 'TRIAL') {
                const now = new Date();
                now.setDate(now.getDate() + 30);
                payload.data_vencimento = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }
            const { error } = await db.from('empresas').update(payload).eq('id', id);
            if (error) throw error;
            const idx = (activeEmpresasList || []).findIndex(x => String(x && x.id || '') === id);
            if (idx >= 0) {
                const oldEmp = activeEmpresasList[idx] || {};
                activeEmpresasList[idx] = { ...oldEmp, ...payload };
            }
            renderSuperAdminRenewals();
            if (assinaturasView && !assinaturasView.classList.contains('hidden')) renderAssinaturas();
            if (status === 'ATIVO') {
                const emp = (activeEmpresasList || []).find(x => String(x && x.id || '') === id) || {};
                const plano = resolvePlanDisplayName(emp && emp.plano_tipo);
                showToast(`Bem-vindo ao Plano ${plano}! Acesso liberado por 30 dias.`);
            } else {
                showToast('Status atualizado com sucesso.');
            }
        } catch (err) {
            showToast(err && err.message ? String(err.message) : 'Falha ao atualizar status.', true);
        }
    };

    rows.forEach(r => {
        const tr = document.createElement('tr');
        const vencBr = r.vencDate
            ? `${String(r.vencDate.getDate()).padStart(2, '0')}/${String(r.vencDate.getMonth() + 1).padStart(2, '0')}/${String(r.vencDate.getFullYear())}`
            : '—';
        const diasLabel = r.isPending
            ? 'Aguardando pagamento'
            : (Number.isFinite(r.diffDays)
                ? (r.diffDays < 0 ? `Vencida há ${Math.abs(r.diffDays)}d` : `Em ${r.diffDays}d`)
                : '—');
        const emp = (activeEmpresasList || []).find(e => String(e && e.id || '') === String(r.id || '')) || null;
        const planoVal = resolvePlanDisplayName(emp && emp.plano_tipo);
        const statusValRaw = String(emp && emp.assinatura_status || 'PENDENTE').toUpperCase();
        const statusVal = statusValRaw === 'TRAIL' ? 'TRIAL' : statusValRaw;
        const planoDisplay = planoVal === 'TRAIL' ? 'TRIAL' : planoVal;
        tr.innerHTML = `
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);"><strong>${r.nome}</strong><br><small style="color: var(--text-muted);">${r.id}</small></td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${planoDisplay}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${vencBr}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color);">${statusBadgeHtml(statusVal)}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:right; ${(Number.isFinite(r.diffDays) && r.diffDays < 0) ? 'color: var(--danger-color); font-weight:700;' : ''}">${diasLabel}</td>
            <td style="padding: 0.6rem; border-bottom: 1px solid var(--border-color); text-align:center;">
                <button class="btn-icon js-renewal-status" data-status="TRIAL" title="Definir TRIAL" style="color:#1d4ed8;"><i class="ri-flask-line"></i></button>
                <button class="btn-icon js-renewal-status" data-status="ATIVO" title="Definir ATIVO" style="color:#166534;"><i class="ri-checkbox-circle-line"></i></button>
                <button class="btn-icon js-renewal-status" data-status="PENDENTE" title="Definir PENDENTE" style="color:#c2410c;"><i class="ri-time-line"></i></button>
            </td>
        `;
        tr.querySelectorAll('.js-renewal-status').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const next = String(btn.getAttribute('data-status') || '');
                updateRenewalStatus(r.id, next);
            });
        });
        body.appendChild(tr);
    });
}

async function fetchDashboard({ dateStr, profSeqId }) {
    if (!hasBootDataContext()) return;
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
    const kpiFiscalNotasHoje = document.getElementById('kpiFiscalNotasHoje');
    const kpiFiscalValorHoje = document.getElementById('kpiFiscalValorHoje');
    const dashFiscalSummary = document.getElementById('dashFiscalSummary');
    const dashFiscalRecentList = document.getElementById('dashFiscalRecentList');
    const dashFiscalPanelWrapper = document.getElementById('dashFiscalPanelWrapper');

    try {
        const hasNfse = await checkEmpresaHasNfseModule();
        if (dashFiscalPanelWrapper) {
            dashFiscalPanelWrapper.style.display = hasNfse ? 'block' : 'none';
        }

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

        try {
            const now = new Date();
            const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const { startIso: fiscalStartIso, endIso: fiscalEndIso } = buildDayDateRangeUTC(todayYmd);
            let nfQ = db.from('financeiro_notas')
                .select('paciente_nome,pdf_url,valor,status_nota,created_at')
                .eq('empresa_id', currentEmpresaId)
                .gte('created_at', fiscalStartIso)
                .lte('created_at', fiscalEndIso)
                .order('created_at', { ascending: false })
                .limit(100);
            const { data: nfs, error: nfErr } = await withTimeout(nfQ, 15000, 'dashboard:financeiro_notas_monitoramento');
            if (nfErr) throw nfErr;
            const allRows = Array.isArray(nfs) ? nfs : [];
            const okRows = allRows.filter((r) => {
                const k = normalizeKey(String(r && r.status_nota || ''));
                return k.includes('CONCLUID') || k.includes('EMIT') || k.includes('SUCESS') || k.includes('SIMULAD');
            });
            const totalNotas = okRows.length;
            const totalValor = okRows.reduce((acc, r) => acc + toDec(r && r.valor, 0), 0);
            if (kpiFiscalNotasHoje) kpiFiscalNotasHoje.textContent = String(totalNotas);
            if (kpiFiscalValorHoje) kpiFiscalValorHoje.textContent = formatCurrencyBRL(totalValor);
            if (dashFiscalSummary) dashFiscalSummary.textContent = `${todayYmd} | ${totalNotas} notas`;
            if (dashFiscalRecentList) {
                const top3 = okRows.slice(0, 3);
                if (!top3.length) {
                    dashFiscalRecentList.innerHTML = '<li style="color:var(--text-muted);">Sem emissões hoje.</li>';
                } else {
                    dashFiscalRecentList.innerHTML = top3.map((r) => {
                        const nm = String(r && r.paciente_nome || 'Paciente').trim() || 'Paciente';
                        const pdf = String(r && r.pdf_url || '').trim();
                        const dt = r && r.created_at ? formatDateTime(r.created_at) : '';
                        if (pdf) {
                            return `<li><a href="#" onclick="occOpenNotaPdf('${escapeJsString(pdf)}'); return false;">${escapeHtml(nm)}</a> <span style="color:var(--text-muted); font-size:12px;">(${escapeHtml(dt)})</span></li>`;
                        }
                        return `<li>${escapeHtml(nm)} <span style="color:var(--text-muted); font-size:12px;">(PDF indisponível)</span></li>`;
                    }).join('');
                }
            }
        } catch {
            if (kpiFiscalNotasHoje) kpiFiscalNotasHoje.textContent = '—';
            if (kpiFiscalValorHoje) kpiFiscalValorHoje.textContent = '—';
            if (dashFiscalSummary) dashFiscalSummary.textContent = 'Monitoramento indisponível';
            if (dashFiscalRecentList) dashFiscalRecentList.innerHTML = '<li style="color:var(--text-muted);">Sem dados fiscais disponíveis.</li>';
        }
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao carregar Dashboard: ${msg}`, true);
    }
}

// ==========================================
// MÓDULO DE SUPORTE - TICKETS
// ==========================================

async function fetchTickets() {
    if (!suporteTicketsBody) return;
    
    suporteTicketsBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando chamados...</td></tr>';
    if (suporteTicketsEmptyState) suporteTicketsEmptyState.classList.add('hidden');
    
    try {
        let query = db.from('suporte_tickets').select('*').order('data_criacao', { ascending: false });
        
        if (!isSuperAdmin) {
            if (!currentEmpresaId) {
                suporteTicketsBody.innerHTML = '';
                return;
            }
            query = query.eq('emp_id', currentEmpresaId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        renderTicketsTable(data || []);
    } catch (err) {
        console.error('Erro ao buscar tickets:', err);
        suporteTicketsBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--danger-color);">Erro ao carregar: ${err.message}</td></tr>`;
    }
}

function renderTicketsTable(tickets) {
    if (!tickets || tickets.length === 0) {
        suporteTicketsBody.innerHTML = '';
        if (suporteTicketsEmptyState) suporteTicketsEmptyState.classList.remove('hidden');
        return;
    }
    
    if (suporteTicketsEmptyState) suporteTicketsEmptyState.classList.add('hidden');
    suporteTicketsBody.innerHTML = '';
    
    tickets.forEach(t => {
        const tr = document.createElement('tr');
        
        const dateObj = new Date(t.data_criacao);
        const dateStr = dateObj.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const shortId = t.id.substring(0, 8).toUpperCase();
        
        let statusBadge = 'bg-secondary';
        if (t.status === 'Aberto') statusBadge = 'bg-primary';
        else if (t.status === 'Em Atendimento') statusBadge = 'bg-warning text-dark';
        else if (t.status === 'Concluído') statusBadge = 'bg-success';
        
        tr.innerHTML = `
            <td><strong style="color: var(--primary-color);">TCK-${shortId}</strong></td>
            <td>${t.nome_empresa || 'N/A'}<br><small class="text-muted" style="font-size: 0.8em;">${t.usuario_nome || 'Usuário'}</small></td>
            <td>${t.titulo || 'Sem Título'}</td>
            <td>${t.categoria || 'Geral'}</td>
            <td><span class="badge ${statusBadge}">${t.status}</span></td>
            <td>${dateStr}</td>
            <td style="text-align:center;">
                <button class="btn btn-sm btn-outline-primary btn-view-ticket" title="Visualizar">
                    <i class="ri-eye-line"></i>
                </button>
            </td>
        `;
        
        const btnView = tr.querySelector('.btn-view-ticket');
        btnView.addEventListener('click', () => openViewTicketModal(t));
        
        suporteTicketsBody.appendChild(tr);
    });
}

function openNovoTicketModal() {
    if (suporteTicketId) suporteTicketId.value = '';
    if (suporteTicketTitulo) {
        suporteTicketTitulo.value = '';
        suporteTicketTitulo.readOnly = false;
    }
    if (suporteTicketCategoria) {
        suporteTicketCategoria.value = 'Dúvidas';
        suporteTicketCategoria.disabled = false;
    }
    if (suporteTicketDescricao) {
        suporteTicketDescricao.value = '';
        suporteTicketDescricao.readOnly = false;
    }
    if (suporteTicketResposta) {
        suporteTicketResposta.value = '';
    }
    
    if (suporteTicketModalTitle) suporteTicketModalTitle.textContent = 'Abrir Novo Chamado';
    if (suporteTicketAdminStatusGroup) suporteTicketAdminStatusGroup.classList.add('hidden');
    if (suporteTicketRespostaGroup) suporteTicketRespostaGroup.classList.add('hidden');
    
    if (btnSalvarTicket) {
        btnSalvarTicket.style.display = 'inline-flex';
        btnSalvarTicket.innerHTML = 'Salvar';
    }
    
    if (suporteTicketModal) suporteTicketModal.classList.remove('hidden');
}

function openViewTicketModal(ticket) {
    if (suporteTicketId) suporteTicketId.value = ticket.id;
    if (suporteTicketTitulo) {
        suporteTicketTitulo.value = ticket.titulo || '';
        suporteTicketTitulo.readOnly = true;
    }
    if (suporteTicketCategoria) {
        suporteTicketCategoria.value = ticket.categoria || 'Dúvidas';
        suporteTicketCategoria.disabled = true;
    }
    if (suporteTicketDescricao) {
        suporteTicketDescricao.value = ticket.descricao || '';
        suporteTicketDescricao.readOnly = true;
    }
    
    if (suporteTicketModalTitle) suporteTicketModalTitle.textContent = `Chamado TCK-${ticket.id.substring(0,8).toUpperCase()}`;
    
    if (suporteTicketRespostaGroup) {
        if (isSuperAdmin || ticket.resposta_admin) {
            suporteTicketRespostaGroup.classList.remove('hidden');
        } else {
            suporteTicketRespostaGroup.classList.add('hidden');
        }
    }
    
    if (suporteTicketResposta) {
        let respostaText = ticket.resposta_admin || '';
        
        // Resposta Automática Inteligente (SuperAdmin)
        if (isSuperAdmin && !respostaText) {
            respostaText = `Olá, ${ticket.usuario_nome || 'Usuário'}!\n\n`;
            
            // Salva os dados no próprio elemento para ser usado no salvamento
            suporteTicketResposta.dataset.nomeEmpresa = ticket.nome_empresa || 'Clínica';
            suporteTicketResposta.dataset.autoResposta = "true";
        } else {
            delete suporteTicketResposta.dataset.autoResposta;
            delete suporteTicketResposta.dataset.nomeEmpresa;
        }
        
        suporteTicketResposta.value = respostaText;
        suporteTicketResposta.readOnly = !isSuperAdmin;
    }
    
    if (isSuperAdmin) {
        if (suporteTicketAdminStatusGroup) suporteTicketAdminStatusGroup.classList.remove('hidden');
        if (suporteTicketStatus) suporteTicketStatus.value = ticket.status || 'Aberto';
        if (btnSalvarTicket) {
            btnSalvarTicket.style.display = 'inline-flex';
            btnSalvarTicket.innerHTML = 'Atualizar Status';
        }
    } else {
        if (suporteTicketAdminStatusGroup) suporteTicketAdminStatusGroup.classList.add('hidden');
        if (btnSalvarTicket) btnSalvarTicket.style.display = 'none';
    }
    
    if (suporteTicketModal) suporteTicketModal.classList.remove('hidden');
}

async function saveTicket() {
    const id = suporteTicketId ? suporteTicketId.value : '';
    const titulo = (suporteTicketTitulo ? suporteTicketTitulo.value : '').trim();
    const categoria = (suporteTicketCategoria ? suporteTicketCategoria.value : '').trim();
    const descricao = (suporteTicketDescricao ? suporteTicketDescricao.value : '').trim();
    
    if (!titulo || !descricao) {
        showToast('Título e Descrição são obrigatórios.', true);
        return;
    }
    
    if (btnSalvarTicket) {
        btnSalvarTicket.disabled = true;
        btnSalvarTicket.innerHTML = 'Salvando...';
    }
    
    try {
        if (id && isSuperAdmin) {
            const status = suporteTicketStatus ? suporteTicketStatus.value : 'Aberto';
            let resposta = (suporteTicketResposta ? suporteTicketResposta.value : '').trim();
            
            // Adiciona a assinatura final automaticamente
            if (suporteTicketResposta && suporteTicketResposta.dataset.autoResposta === "true") {
                const nomeEmpresa = suporteTicketResposta.dataset.nomeEmpresa || 'Clínica';
                if (!resposta.includes('Obrigado por nos acionar')) {
                    resposta += "\n\nObrigado por nos acionar! Estamos à disposição para apoiar o sucesso da " + nomeEmpresa + ".";
                }
            }
            
            const { error } = await db.from('suporte_tickets').update({
                status: status,
                resposta_admin: resposta
            }).eq('id', id);
            
            if (error) throw error;
            showToast('Status do chamado atualizado!');
        } else {
            if (!currentEmpresaId) throw new Error('Empresa não identificada.');
            
            let nomeEmpresa = 'Clínica';
            if (typeof activeEmpresasList !== 'undefined' && activeEmpresasList) {
                const emp = activeEmpresasList.find(e => String(e.id) === String(currentEmpresaId));
                if (emp) nomeEmpresa = emp.nome_fantasia || emp.razao_social || emp.nome || 'Clínica';
            }
            
            let nomeUsuario = 'Usuário';
            if (typeof userProfile !== 'undefined' && userProfile && userProfile.nome) {
                nomeUsuario = userProfile.nome;
            } else if (typeof currentUserProfile !== 'undefined' && currentUserProfile && currentUserProfile.nome) {
                nomeUsuario = currentUserProfile.nome;
            } else if (typeof currentUser !== 'undefined' && currentUser) {
                nomeUsuario = currentUser.user_metadata?.full_name || (currentUser.email ? currentUser.email.split('@')[0] : 'Usuário');
            }
            
            const { error } = await db.from('suporte_tickets').insert([{
                emp_id: currentEmpresaId,
                nome_empresa: nomeEmpresa,
                usuario_nome: nomeUsuario,
                titulo: titulo,
                categoria: categoria,
                descricao: descricao,
                status: 'Aberto'
            }]);
            
            if (error) throw error;
            showToast('Chamado aberto com sucesso!');
        }
        
        if (suporteTicketModal) suporteTicketModal.classList.add('hidden');
        fetchTickets();
        if (isSuperAdmin) fetchDashboardTicketKpis();
        
    } catch (err) {
        console.error('Erro ao salvar ticket:', err);
        showToast('Erro: ' + err.message, true);
    } finally {
        if (btnSalvarTicket) {
            btnSalvarTicket.disabled = false;
            btnSalvarTicket.innerHTML = id ? 'Atualizar Status' : 'Salvar';
        }
    }
}

async function generateTicketReport() {
    showToast('Gerando relatório de chamados...', false);
    try {
        let query = db.from('suporte_tickets').select('*');
        
        const catFilter = ticketReportCategoria ? ticketReportCategoria.value : '';
        const statusFilter = ticketReportStatus ? ticketReportStatus.value : '';
        
        if (catFilter) query = query.eq('categoria', catFilter);
        if (statusFilter) query = query.eq('status', statusFilter);
        
        const { data, error } = await query;
        if (error) throw error;
        
        let sortedData = (data || []).sort((a, b) => {
            const dateA = new Date(a.data_criacao || 0).getTime();
            const dateB = new Date(b.data_criacao || 0).getTime();
            if (dateA !== dateB) return dateB - dateA;
            
            const empA = (a.emp_id || '').localeCompare(b.emp_id || '');
            if (empA !== 0) return empA;
            
            return (a.categoria || '').localeCompare(b.categoria || '');
        });
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast('Permita popups para imprimir o relatório.', true);
            return;
        }
        
        const isFull = (ticketReportType === 'completo');
        
        let html = `
        <html>
        <head>
            <title>Relatório ${isFull ? 'Completo' : 'Simples'} de Chamados</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                h2 { text-align: center; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
                .meta { text-align: right; font-size: 0.9rem; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f4f4f4; }
                .checkbox-cell { text-align: center; width: 60px; }
                .checkbox-box { display: inline-block; width: 16px; height: 16px; border: 1px solid #000; }
                .full-details { margin-top: 5px; font-size: 0.85rem; color: #444; border-top: 1px dashed #eee; padding-top: 5px; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h2>Relatório ${isFull ? 'Completo' : 'Simples'} de Chamados - Suporte OCC</h2>
            <div class="meta">
                Filtros: Categoria: ${catFilter || 'Todas'} | Status: ${statusFilter || 'Todos'}<br>
                Gerado em: ${new Date().toLocaleString('pt-BR')}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Clínica (Empresa)</th>
                        <th>Categoria / Detalhes</th>
                        <th>Status</th>
                        <th class="checkbox-cell">Concluído</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (sortedData.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center;">Nenhum chamado encontrado para os filtros selecionados.</td></tr>`;
        } else {
            for (const t of sortedData) {
                const dataFormatada = t.data_criacao ? new Date(t.data_criacao).toLocaleString('pt-BR').slice(0,16) : '-';
                
                let detalhesHtml = `<strong>Título:</strong> ${t.titulo || '-'}`;
                if (isFull) {
                    const descSafe = (t.descricao || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const respSafe = (t.resposta_admin || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    detalhesHtml += `
                        <div class="full-details">
                            <div style="margin-bottom:4px;"><strong>Pergunta/Descrição:</strong><br>${descSafe || '-'}</div>
                            ${respSafe ? `<div><strong>Resposta Admin:</strong><br>${respSafe}</div>` : ''}
                        </div>
                    `;
                }

                html += `
                    <tr>
                        <td style="vertical-align: top;">${dataFormatada}</td>
                        <td style="vertical-align: top;">${t.emp_id || 'Geral'}</td>
                        <td style="vertical-align: top;">
                            <div style="margin-bottom:4px; font-weight:600; color:var(--primary-color)">${t.categoria || '-'}</div>
                            ${detalhesHtml}
                        </td>
                        <td style="vertical-align: top;">${t.status || '-'}</td>
                        <td class="checkbox-cell" style="vertical-align: top;"><div class="checkbox-box"></div></td>
                    </tr>
                `;
            }
        }
        
        html += `
                </tbody>
            </table>
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Imprimir Relatório</button>
            </div>
        </body>
        </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
        
    } catch (err) {
        console.error('Erro ao gerar relatorio de tickets:', err);
        showToast('Erro ao gerar relatório: ' + err.message, true);
    }
}
window.openNovoTicketModal = openNovoTicketModal;

window.saveTicket = saveTicket;
window.generateTicketReport = generateTicketReport;


const navCommissions = document.getElementById('navCommissions');
const commissionsView = document.getElementById('commissionsView');

// Commissions DOM Elements
const commissionsTable = document.getElementById('commissionsTable');
const commissionsTableBody = document.getElementById('commissionsTableBody');
const commissionsEmptyState = document.getElementById('commissionsEmptyState'); // Cache for user management
let commissionsList = [];
let selectedCommissionIds = new Set();

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
        if (currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
        const { error } = await withTimeout(q, 15000, 'financeiro_comissoes:update');
        if (error) throw error;
        showToast('Comissões marcadas como pagas.');
        resetCommissionSelection();
        await fetchCommissionsFromUI();
    } catch (err) {
        try {
            let q2 = db.from('financeiro_comissoes').update(payloadFallback).in('id', idsToPay);
            if (currentEmpresaId) q2 = q2.eq('empresa_id', currentEmpresaId);
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
            if (currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
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
            if (currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
            const { error } = await withTimeout(q, 15000, 'financeiro_comissoes:advance');
            if (error) throw error;
        } catch (e1) {
            let q2 = db.from('financeiro_comissoes').update(payloadFallback).in('id', ids);
            if (currentEmpresaId) q2 = q2.eq('empresa_id', currentEmpresaId);
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
            if (currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId);
            const { error } = await withTimeout(q, 15000, 'financeiro_comissoes:transfer:update');
            if (error) throw error;
        } catch (e1) {
            try {
                let q2 = db.from('financeiro_comissoes').update(payloadFallback).in('id', ids);
                if (currentEmpresaId) q2 = q2.eq('empresa_id', currentEmpresaId);
                const { error: e2 } = await withTimeout(q2, 15000, 'financeiro_comissoes:transfer:update2');
                if (e2) throw e2;
            } catch (e2) {
                let q3 = db.from('financeiro_comissoes').update(payloadMin).in('id', ids);
                if (currentEmpresaId) q3 = q3.eq('empresa_id', currentEmpresaId);
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
            const breakdown = getCommissionBreakdown(r);
            const valorItem = formatCurrencyBRL(toDec(breakdown.valorItem, 0));
            const vlrProtetico = formatCurrencyBRL(toDec(breakdown.vlrProtetico, 0));
            const percComissao = `${formatNumberBR(toDec(breakdown.percComissao, 0), 2)}%`;
            const percImposto = `${formatNumberBR(toDec(breakdown.percImposto, 0), 2)}%`;
            const val = formatCurrencyBRL(Number(r.valor_comissao || 0));
            const st = String(r.status || '-');
            return `
                <tr>
                    <td style="width: 140px;">${escapeHtml(dtLabel)}</td>
                    <td style="width: 90px; text-align:center;">${orcSeq ? `#${escapeHtml(orcSeq)}` : '-'}</td>
                    <td>${escapeHtml(item)}</td>
                    <td style="width: 120px; text-align:right;">${escapeHtml(valorItem)}</td>
                    <td style="width: 120px; text-align:right;">${escapeHtml(vlrProtetico)}</td>
                    <td style="width: 95px; text-align:right;">${escapeHtml(percComissao)}</td>
                    <td style="width: 95px; text-align:right;">${escapeHtml(percImposto)}</td>
                    <td style="width: 120px;">${escapeHtml(st)}</td>
                    <td style="width: 140px; text-align:right; font-weight: 900;">${escapeHtml(val)}</td>
                </tr>
            `;
        }).join('') + `
            <tr>
                <td colspan="8" style="text-align:right; font-weight: 900;">SUBTOTAL (${sorted.length})</td>
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
                            <th style="width: 120px; text-align:right;">Valor Item</th>
                            <th style="width: 120px; text-align:right;">Vlr Protetico</th>
                            <th style="width: 95px; text-align:right;">% Comissao</th>
                            <th style="width: 95px; text-align:right;">% Imposto</th>
                            <th style="width: 120px;">Status</th>
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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: 'Financeiro - Comissões', legacyHtml: html, width: 980, height: 720 });
    if (!ok) return;
}

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
window.transferSelectedCommissionsToProfessional = transferSelectedCommissionsToProfessional;

window.closeCommTransferModal = closeCommTransferModal;

window.confirmCommReworkAdjustment = confirmCommReworkAdjustment;

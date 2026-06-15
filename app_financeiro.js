
let transactions = [];

function updateFinanceiroHeaderVisibility() {
    if (btnMovDiaria) btnMovDiaria.style.display = isSuperAdmin ? '' : 'none';
    if (btnPagamentosPacientes) btnPagamentosPacientes.style.display = '';
}
const navFinanceiro = document.getElementById('navFinanceiro');
const financeiroView = document.getElementById('financeiroView');
const btnNovaTransacao = document.getElementById('btnNovaTransacao');
const modalNovaTransacao = document.getElementById('modalNovaTransacao');
const btnSalvarTransacao = document.getElementById('btnSalvarTransacao');
const btnCancelarTransacao = document.getElementById('btnCancelarTransacao');
const formNovaTransacao = document.getElementById('formNovaTransacao');
const transacaoCategoria = document.getElementById('transacaoCategoria');

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

async function fetchFinanceiroNotasStatusMap(txRows = []) {
    const map = new Map();
    if (!currentEmpresaId) return map;
    const refs = Array.from(new Set((txRows || []).map(t => String(t && t.referencia_id || '').trim()).filter(Boolean)));
    try {
        let q = db.from('financeiro_notas').select('*').eq('empresa_id', currentEmpresaId).order('created_at', { ascending: false }).limit(500);
        if (refs.length) q = q.in('referencia_id', refs.slice(0, 300));
        const { data, error } = await withTimeout(q, 15000, 'financeiro_notas:status_map');
        if (error) throw error;
        (Array.isArray(data) ? data : []).forEach((r) => {
            const txid = String(r && r.transacao_id || '').trim();
            const ref = String(r && r.referencia_id || '').trim();
            const status = String((r && (r.status_nota || r.status)) || 'PENDENTE');
            const meta = {
                status,
                pdf_url: String(r && r.pdf_url || '').trim(),
                numero_nota: String(r && r.numero_nota || '').trim(),
                chave_acesso: String(r && r.chave_acesso || '').trim()
            };
            if (txid && !map.has(`tx:${txid}`)) map.set(`tx:${txid}`, meta);
            if (ref && !map.has(`ref:${ref}`)) map.set(`ref:${ref}`, meta);
        });
    } catch {
        // tabela ainda não provisionada ou sem permissão: exibe status neutro
    }
    return map;
}

async function updateFinanceiroNotaProviderResult(payload, providerResult, providerKey) {
    const result = providerResult || {};
    const patch = {
        status_nota: String(result.status_nota || 'CONCLUIDO'),
        pdf_url: String(result.pdf_url || 'https://focusnfe.com.br/exemplo_nota.pdf'),
        xml_retorno: String(result.xml_retorno || ''),
        mensagem_sefaz: String(result.mensagem_sefaz || ''),
        numero_nota: String(result.numero_nota || ''),
        chave_acesso: String(result.chave_acesso || ''),
        provedor_nfe: String(providerKey || '')
    };
    let q = db.from('financeiro_notas')
        .update(patch)
        .eq('empresa_id', String(payload && payload.empresa_id || ''))
        .eq('referencia_id', String(payload && payload.referencia_id || ''));
    let { error } = await withTimeout(q, 7000, 'financeiro_notas:update_provider');
    if (!error) return true;
    const fallbackPatch = { status_nota: patch.status_nota, pdf_url: patch.pdf_url, mensagem_sefaz: patch.mensagem_sefaz };
    let q2 = db.from('financeiro_notas')
        .update(fallbackPatch)
        .eq('empresa_id', String(payload && payload.empresa_id || ''))
        .eq('referencia_id', String(payload && payload.referencia_id || ''));
    ({ error } = await withTimeout(q2, 7000, 'financeiro_notas:update_provider:fallback_status_nota'));
    if (!error) return true;
    const msg2 = String(error && error.message || '');
    const statusNotaMissing = /Could not find the 'status_nota' column/i.test(msg2) || /column .*status_nota.* does not exist/i.test(msg2);
    if (!statusNotaMissing) throw error;
    const legacyPatch = { status: patch.status_nota, pdf_url: patch.pdf_url, mensagem_sefaz: patch.mensagem_sefaz };
    let q3 = db.from('financeiro_notas')
        .update(legacyPatch)
        .eq('empresa_id', String(payload && payload.empresa_id || ''))
        .eq('referencia_id', String(payload && payload.referencia_id || ''));
    ({ error } = await withTimeout(q3, 7000, 'financeiro_notas:update_provider:fallback_status_legacy'));
    if (error) throw error;
    return true;
}

async function saveFinanceiroNotaTeste(payload) {
    const primary = {
        empresa_id: payload.empresa_id,
        transacao_id: payload.transacao_id,
        referencia_id: payload.referencia_id,
        paciente_id: payload.paciente_id,
        paciente_nome: payload.paciente_nome,
        status_nota: payload.status_nota,
        json_envio_teste: payload.json_envio_teste,
        valor: payload.valor,
        created_at: payload.created_at
    };
    let { error } = await withTimeout(db.from('financeiro_notas').insert(primary), 7000, 'financeiro_notas:insert_teste:primary');
    if (!error) return true;
    const msg = String(error && error.message || '');
    const code = String(error && error.code || '');
    const missingCol = code === '42703' || /column .* does not exist/i.test(msg);
    if (!missingCol) throw error;
    const fallback = {
        empresa_id: payload.empresa_id,
        referencia_id: payload.referencia_id,
        status_nota: payload.status_nota,
        json_envio_teste: payload.json_envio_teste,
        valor: payload.valor
    };
    ({ error } = await withTimeout(db.from('financeiro_notas').insert(fallback), 7000, 'financeiro_notas:insert_teste:fallback'));
    if (error) throw error;
    return true;
}

async function renderFinanceiroNotasGrid() {
    const wrapper = document.getElementById('financeiroEmissaoNotasWrapper');
    const conciliaWrapper = document.getElementById('financeiroConciliacaoFiscalWrapper');
    const hasNfse = await checkEmpresaHasNfseModule();
    if (wrapper) {
        if (!hasNfse) {
            wrapper.style.display = 'none';
            if (conciliaWrapper) conciliaWrapper.style.display = 'block';
            return;
        } else {
            wrapper.style.display = 'block';
            if (conciliaWrapper) conciliaWrapper.style.display = 'none';
        }
    }

    if (!finNotasBody) return;
    const txRowsRaw = (transactions || [])
        .filter(t => String(t && t.tipo || '').toUpperCase() === 'CREDITO' && String(t && t.categoria || '').toUpperCase() === 'PAGAMENTO')
        .slice(0, 250);
    if (!txRowsRaw.length) {
        finNotasBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1rem; color:var(--text-muted);">Nenhum orçamento fechado disponível para emissão.</td></tr>';
        return;
    }
    const byRef = new Map();
    txRowsRaw.forEach((t) => {
        const ref = getTransactionBudgetRef(t);
        if (!ref) return;
        if (!byRef.has(ref)) byRef.set(ref, []);
        byRef.get(ref).push(t);
    });
    const groups = Array.from(byRef.entries()).map(([ref, list]) => {
        const ordered = (list || []).slice().sort((a, b) => new Date(b && b.data_transacao || 0).getTime() - new Date(a && a.data_transacao || 0).getTime());
        const sample = ordered[0] || {};
        const budget = (budgets || []).find(b => String(b && b.seqid || '') === String(ref)) || null;
        const st = normalizeStatusKey(String(budget && budget.status || ''));
        const isClosed = st === 'FINALIZADO' || st === 'EXECUTADO' || st === 'APROVADO' || st === 'EMEXECUCAO' || st === 'EM_EXECUCAO';
        if (!budget || !isClosed) return null;
        const bruto = Math.max(0, toDec(calculateBudgetTotal(budget), 0));
        const paid = ordered.reduce((sum, x) => sum + toDec(x && x.valor, 0), 0);
        const patientId = String(budget && (budget.paciente_id || budget.pacienteid) || sample && sample.paciente_id || '').trim();
        const patient = (patients || []).find(p => String(p.id) === patientId || String(p.seqid) === patientId) || null;
        const itens = Array.isArray(budget && budget.orcamento_itens) ? budget.orcamento_itens : [];
        return {
            ref: String(ref),
            data: String(sample && sample.data_transacao || ''),
            patient,
            patientName: String(patient && patient.nome || sample && sample.paciente_nome || budget && budget.pacientenome || '—'),
            budget,
            itens,
            descricao: itens.length ? itens.map(it => String(it && (it.descricao || it.servicodescricao || it.nome) || '').trim()).filter(Boolean).slice(0, 3).join(' • ') : `Serviços Odontológicos ref. ao Orçamento #${ref}`,
            valorBruto: bruto > 0 ? bruto : paid
        };
    }).filter(Boolean).sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());

    if (!groups.length) {
        finNotasBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1rem; color:var(--text-muted);">Nenhum orçamento fechado com pagamento encontrado para emissão.</td></tr>';
        return;
    }

    const txRows = groups.map(g => ({ referencia_id: g.ref }));
    void autoFixPatientsIbgeForTransactions(txRowsRaw);
    const statusMap = await fetchFinanceiroNotasStatusMap(txRows);
    finNotasBody.innerHTML = groups.map((g) => {
        const meta = statusMap.get(`ref:${g.ref}`) || { status: 'PENDENTE', pdf_url: '' };
        const st = String(meta && meta.status || 'PENDENTE');
        const v = getNotaStatusVisual(st);
        const pdfUrl = String(meta && meta.pdf_url || '').trim();
        const detailsItems = (g.itens || []).map(it => {
            const d = String(it && (it.descricao || it.servicodescricao || it.nome) || 'Serviço').trim();
            const q = toDec(it && (it.qtde || it.quantidade), 1);
            const u = toDec(it && it.valor, 0);
            return `<li>${escapeHtml(d)} — ${escapeHtml(formatNumberBR(q, 2))} x ${escapeHtml(formatCurrencyBRL(u))} = <strong>${escapeHtml(formatCurrencyBRL(q * u))}</strong></li>`;
        }).join('');
        return `
            <tr>
                <td style="padding:0.65rem; border-bottom:1px solid var(--border-color);"><strong>#${escapeHtml(g.ref)}</strong><br><span style="font-size:11px; color:var(--text-muted);">${escapeHtml(formatDateTime(g.data))}</span></td>
                <td style="padding:0.65rem; border-bottom:1px solid var(--border-color);">${escapeHtml(g.patientName)}</td>
                <td style="padding:0.65rem; border-bottom:1px solid var(--border-color);">
                    <details>
                        <summary style="cursor:pointer;">${escapeHtml(g.descricao || `Serviços Odontológicos ref. ao Orçamento #${g.ref}`)}</summary>
                        ${detailsItems ? `<ul style="margin:8px 0 0 18px; padding:0;">${detailsItems}</ul>` : '<div style="margin-top:6px; color:var(--text-muted);">Sem itens detalhados.</div>'}
                    </details>
                </td>
                <td style="padding:0.65rem; border-bottom:1px solid var(--border-color); text-align:right;"><strong>${escapeHtml(formatCurrencyBRL(g.valorBruto))}</strong></td>
                <td style="padding:0.65rem; border-bottom:1px solid var(--border-color); text-align:center;" title="${escapeHtml(String(st))}">${v.icon} ${escapeHtml(v.label)}</td>
                <td style="padding:0.65rem; border-bottom:1px solid var(--border-color); text-align:center;">
                    <button class="btn btn-secondary" style="padding:4px 10px; font-size:12px;" onclick="emitirNotaTesteFinanceiro('${escapeHtml(g.ref)}')"><i class="ri-file-add-line"></i> Emitir NF-e do Orçamento</button>
                    ${pdfUrl ? `<button class="btn btn-muted" style="padding:4px 10px; font-size:12px; margin-left:6px;" onclick="occOpenNotaPdf('${escapeJsString(pdfUrl)}')"><i class="ri-file-pdf-line"></i> PDF</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function fetchTransactions(patientId = null) {
    try {
        const nfseWrapper = document.getElementById('financeiroEmissaoNotasWrapper');
        const conciliaWrapper = document.getElementById('financeiroConciliacaoFiscalWrapper');
        if (nfseWrapper) {
            checkEmpresaHasNfseModule().then(hasNfse => {
                nfseWrapper.style.display = hasNfse ? 'block' : 'none';
                if (conciliaWrapper) {
                    conciliaWrapper.style.display = hasNfse ? 'none' : 'block';
                }
            });
        }

        // Mostra o card do extrato para os resultados da busca
        const cardExtrato = document.getElementById('finExtratoCard');
        if (cardExtrato) cardExtrato.style.display = 'block';

        if (finTransacoesBody) {
            finTransacoesBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (window.__dpDebug) window.__dpDebug.lastStep = 'financeiro: start';

        let query = db.from('financeiro_transacoes')
            .select('*')
            .order('data_transacao', { ascending: false });

        if (currentEmpresaId) {
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
            if (finNotasBody) finNotasBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1rem; color:var(--text-muted);">Nenhum atendimento financeiro disponível para emissão.</td></tr>';
            
            // Garantir que a área de NFS-e seja ocultada mesmo se não houver dados, caso não haja permissão
            await renderFinanceiroNotasGrid();

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
        await renderFinanceiroNotasGrid();
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
            let targetUuid = trans.referencia_id;
            if (String(targetUuid).length < 20) {
                const bEncontrado = (budgets || []).find(b => String(b.seqid) === String(targetUuid));
                if (bEncontrado) targetUuid = bEncontrado.id;
            }

            // Find in orcamento_pagamentos (using UUID)
            const { error: pError } = await db.from('orcamento_pagamentos')
                .delete()
                .eq('orcamento_id', targetUuid)
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
        {
            let bq = db.from('orcamentos').select('*').eq('empresa_id', currentEmpresaId).order('seqid', { ascending: true });
            
            // Regra Single Ownership
            if (typeof isSuperAdmin !== 'undefined' && !isSuperAdmin && typeof isAdminRole !== 'undefined' && !isAdminRole()) {
                const uEmail = String(currentUser && currentUser.email ? currentUser.email : '').trim().toLowerCase();
                const profObj = (typeof professionals !== 'undefined' ? professionals : []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
                if (profObj && profObj.seqid != null) {
                    bq = bq.eq('profissional_id', Number(profObj.seqid));
                } else {
                    bq = bq.eq('profissional_id', -1);
                }
            }
            
            const { data: bData, error: bErr } = await withTimeout(bq, 20000, 'orcamentos:refresh');
            if (bErr) throw bErr;
            if (bData) budgets = bData;

            try {
                const itensRes = await db.from('orcamento_itens').select('*').eq('empresa_id', currentEmpresaId);
                if (!itensRes.error) {
                    const itens = itensRes.data || [];
                    const byBudgetId = new Map();
                    itens.forEach(it => {
                        const k = String(it && it.orcamento_id || '');
                        if (!k) return;
                        if (!byBudgetId.has(k)) byBudgetId.set(k, []);
                        byBudgetId.get(k).push(it);
                    });
                    budgets.forEach(b => {
                        const k1 = String(b && b.id || '');
                        const k2 = String(b && b.seqid || '');
                        b.orcamento_itens = byBudgetId.get(k1) || byBudgetId.get(k2) || [];
                    });
                } else {
                    budgets.forEach(b => { b.orcamento_itens = []; });
                }
            } catch (e) {
                budgets.forEach(b => { b.orcamento_itens = []; });
            }

            try {
                const paysRes = await db.from('orcamento_pagamentos').select('*').eq('empresa_id', currentEmpresaId);
                if (!paysRes.error) {
                    const allPayments = paysRes.data || [];
                    budgets.forEach(b => {
                        const idLongo = String(b && b.id || '').trim().toLowerCase();
                        const idCurto = String(b && b.seqid || '').trim();
                        const bPayments = allPayments.filter(p => {
                            const idBanco = String(p && p.orcamento_id || '').trim().toLowerCase();
                            if (!idBanco) return false;
                            if (idBanco.length > 10) return idBanco === idLongo;
                            return idBanco === idCurto;
                        });
                        b.pagamentos = bPayments;
                        b.total_pago = bPayments.reduce((acc, curr) => acc + Number(curr.valor_pago || curr.valor || 0), 0);
                    });
                } else {
                    budgets.forEach(b => { b.pagamentos = []; b.total_pago = 0; });
                }
            } catch (e) {
                budgets.forEach(b => { b.pagamentos = []; b.total_pago = 0; });
            }
        }

    } catch (error) {
        console.error("Error deleting transaction:", error);
        showToast("Erro ao excluir lançamento.", true);
    }
}

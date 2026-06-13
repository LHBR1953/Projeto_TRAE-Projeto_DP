

async function estornarMovimentacao(logId) {
    const id = String(logId || '').trim();
    const log = (inventoryLogs || []).find(l => String(l && l.id || '') === id);
    if (!log) return;
    if (!canStockAction('logs', 'estorno', log)) {
        showToast('Você não possui permissão para estornar esta movimentação.', true);
        return;
    }
    const tipo = String(log && log.tipo || '').toUpperCase();
    if (tipo !== 'SAIDA' && tipo !== 'ENTRADA') return;
    const itemId = String(log && log.inventory_id || '');
    const item = (inventoryItems || []).find(i => String(i && i.id || '') === itemId);
    if (!item) {
        showToast('Material da movimentação não encontrado.', true);
        return;
    }
    const qtd = Math.abs(toDec(log && log.quantidade, 0));
    const delta = tipo === 'SAIDA' ? qtd : -qtd;
    const novoEstoque = toDec(item && item.estoque_atual, 0) + delta;
    const { error: updErr } = await db.from('inventory').update({ estoque_atual: novoEstoque }).eq('id', itemId);
    if (updErr) {
        showToast(updErr.message || 'Falha ao estornar estoque.', true);
        return;
    }
    const payload = {
        empresa_id: getEstoqueEmpresaScopeId(),
        inventory_id: itemId,
        atendimento_id: log.atendimento_id || null,
        tipo: 'ESTORNO',
        quantidade: delta,
        responsavel_id: currentUser && currentUser.id ? currentUser.id : null
    };
    const { error: logErr } = await db.from('inventory_logs').insert(payload);
    if (logErr) {
        showToast(logErr.message || 'Falha ao registrar estorno.', true);
        return;
    }
    await loadEstoqueData(true);
    renderInventoryTable();
    renderInventoryLogsTable();
    showToast('Estorno realizado com sucesso.');
}

async function printMovimentacaoDiariaEstoque({ dateStr, profSeqId }) {
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

    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: 'Movimentação Diária', legacyHtml: html, width: 980, height: 720 });
    if (!ok) return;
}


const navAtendimentoToggle = document.getElementById('navAtendimentoToggle');
const navAtendimentoSubmenu = document.getElementById('navAtendimentoSubmenu');
const navAtendimentoToggleIcon = document.getElementById('navAtendimentoToggleIcon');
const navAtendimento = document.getElementById('navAtendimento');
const atendimentoView = document.getElementById('atendimentoView');

// Atendimento DOM Elements
const atendimentoDate = document.getElementById('atendimentoDate');
const atendimentoProfessional = document.getElementById('atendimentoProfessional');
const atendimentoProfessionalGroup = document.getElementById('atendimentoProfessionalGroup');
const btnAtendimentoRefresh = document.getElementById('btnAtendimentoRefresh');
const btnAtendimentoFinalizeSelected = document.getElementById('btnAtendimentoFinalizeSelected');
const atendimentoSummary = document.getElementById('atendimentoSummary');
const atendimentoBody = document.getElementById('atendimentoBody');
const atendimentoEmptyState = document.getElementById('atendimentoEmptyState');

const atendimentoSelectedItems = new Map();

function renderAtendimentoPlaceholder(msg = 'Selecione a data e o profissional.') {
    if (atendimentoBody) {
        atendimentoBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">${msg}</td></tr>`;
    }
    if (atendimentoEmptyState) atendimentoEmptyState.classList.add('hidden');
    if (atendimentoSummary) atendimentoSummary.textContent = '—';
    atendimentoSelectedItems.clear();
    updateAtendimentoFinalizeButton();
}

function updateAtendimentoFinalizeButton() {
    if (!btnAtendimentoFinalizeSelected) return;
    const n = atendimentoSelectedItems.size;
    if (n > 0) {
        btnAtendimentoFinalizeSelected.disabled = false;
        btnAtendimentoFinalizeSelected.innerHTML = `<i class="ri-check-double-line"></i> Finalizar (${n})`;
    } else {
        btnAtendimentoFinalizeSelected.disabled = true;
        btnAtendimentoFinalizeSelected.innerHTML = `<i class="ri-check-double-line"></i> Finalizar Selecionados`;
    }
}

function bindAtendimentoFinalizeSingle() {
    if (!atendimentoBody) return;
    if (atendimentoBody.dataset.finalizeBound === '1') return;
    atendimentoBody.dataset.finalizeBound = '1';
    atendimentoBody.addEventListener('click', async (ev) => {
        if (window.__isFinalizingItem) return; // Bloqueio global contra cliques múltiplos
        const target = ev && ev.target && typeof ev.target.closest === 'function'
            ? ev.target.closest('button[data-action="finalize-one"]')
            : null;
        if (!target) return;
        if (target.disabled) return;
        const budgetId = target.getAttribute('data-budget') || '';
        const itemId = target.getAttribute('data-item') || '';
        const agendamentoId = target.getAttribute('data-agendamento') || '';
        if (!itemId) return;
        
        window.__isFinalizingItem = true;
        target.disabled = true;
        const originalHtml = target.innerHTML;
        target.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Processando...';
        
        try {
            await confirmAtendimentoItem({ budgetId, itemId, agendamentoId }, { suppressRefresh: false });
        } finally {
            window.__isFinalizingItem = false;
            if (document.body.contains(target)) {
                target.disabled = false;
                target.innerHTML = originalHtml;
            }
        }
    });
}

async function fetchAtendimentoForUI() {
    if (!atendimentoDate || !atendimentoProfessional) return;
    const dateStr = atendimentoDate.value;
    const profSeqId = atendimentoProfessional.value;
    if (!dateStr || !profSeqId) {
        renderAtendimentoPlaceholder();
        return;
    }
    await fetchAtendimentoDay({ empresaId: currentEmpresaId, profSeqId: Number(profSeqId), dateStr });
}

async function fetchAtendimentoDay({ empresaId, profSeqId, dateStr }) {
    try {
        if (!empresaId) {
            renderAtendimentoPlaceholder('Empresa não definida.');
            return;
        }
        if (!Number.isFinite(Number(profSeqId))) {
            renderAtendimentoPlaceholder('Profissional inválido.');
            return;
        }
        if (atendimentoBody) {
            atendimentoBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (atendimentoEmptyState) atendimentoEmptyState.classList.add('hidden');

        // A pedido do usuário: Buscar DIRETAMENTE na tabela orcamento_itens, itens estritamente com status 'Liberado'
        const itensQ = db.from('orcamento_itens')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('status', 'Liberado');
            
        const { data: itensLiberados, error: itensErr } = await withTimeout(itensQ, 15000, 'orcamento_itens:liberados');
        if (itensErr) throw itensErr;

        // Busca agendamentos do dia para mostrar a hora
        const agQ = db.from('agenda_agendamentos')
            .select('id, paciente_id, hora_inicio')
            .eq('empresa_id', empresaId)
            .eq('data_agendamento', dateStr);
        const { data: agData } = await withTimeout(agQ, 15000, 'agenda_agendamentos:horarios');

        const itemsRows = [];

        for (const it of (itensLiberados || [])) {
            // Verifica o orcamento no array global (para pegar paciente, etc)
            const b = (budgets || []).find(x => String(x.id) === String(it.orcamento_id || it.orcamentoid || ''));
            
            const pacId = b ? String(b.paciente_id || b.pacienteid || '') : '';
            let paciente = null;
            if (pacId && pacId !== 'null' && pacId !== 'undefined') {
                paciente = (patients || []).find(p => String(p.id) === pacId);
            }
            if (!paciente) {
                paciente = { nome: 'Paciente Desconhecido', id: '' };
            }

            // Pega o nome do serviço
            const serv = (services || []).find(s => String(s.id) === String(it.servico_id || it.servicoId || ''));
            const desc = serv ? serv.descricao : (it.servicoDescricao || it.descricao || `#${it.servico_id || it.servicoId || it.id || ''}`);
            const sub = String(it.subdivisao || it.sub_divisao || '').trim();
            const itemLabel = sub ? `${desc} — ${sub}` : desc;
            const elsDisplay = formatOrcamentoItemElementos(it);
            const itemLabelWithEls = elsDisplay ? `${itemLabel} (${elsDisplay})` : itemLabel;

            // Filtro de profissional opcional, mas se o usuário quer ver tudo que tá Liberado pra clínica:
            // Vou mostrar apenas se o dentista logado for o executor do item OU dono do orçamento, para não poluir
            const executor = it.profissional_id ?? it.profissionalId ?? it.executor_id ?? it.executorId ?? (b ? (b.profissional_id ?? b.profissionalId) : '');
            const execProf = findProfessionalByAnyId(executor);
            const execSeqId = execProf && execProf.seqid != null ? String(execProf.seqid) : String(executor || '');
            
            const amICreator = b ? (String(b.profissional_id) === String(profSeqId) || String(b.profissionalid) === String(profSeqId)) : false;
            
            // Permite se o executor é o logado, ou ele criou, ou não tem executor definido (item orfão na clinica)
            const isMyItem = execSeqId === String(profSeqId) || amICreator || !execSeqId;
            
            // Para garantir que a Restauração APAREÇA de qualquer forma conforme exigido pelo usuário, não bloquearemos por dentista
            // A instrução diz "A query deve buscar APENAS os registros onde o status seja igual a 'Liberado' para a empresa logada."
            // Mas por garantia, não vamos filtrar rigorosamente. Tudo que for "Liberado" na empresa aparece na fila.

            let horaAtend = '--:--';
            let agId = '';
            if (agData && paciente && paciente.id) {
                const ag = agData.find(a => String(a.paciente_id) === String(paciente.id) || String(a.paciente_id) === String(paciente.seqid));
                if (ag) {
                    horaAtend = String(ag.hora_inicio || '--:--').substring(0, 5);
                    agId = ag.id;
                }
            }

            itemsRows.push({
                hora: horaAtend,
                agendamentoId: agId,
                paciente,
                budget: b,
                itemId: String(it.id || ''),
                itemLabel: itemLabelWithEls,
                itemStatus: it.status || '-'
            });
        }

        itemsRows.sort((a, b) => String(a.paciente?.nome || '').localeCompare(String(b.paciente?.nome || ''), 'pt-BR'));

        const profName = getProfessionalNameBySeqId(profSeqId);
        if (atendimentoSummary) {
            atendimentoSummary.textContent = `${profName} — ${dateStr.split('-').reverse().join('/')} • ${itemsRows.length} itens liberados`;
        }

        if (!itemsRows.length) {
            if (atendimentoBody) atendimentoBody.innerHTML = '';
            if (atendimentoEmptyState) atendimentoEmptyState.classList.remove('hidden');
            return;
        }

        if (!atendimentoBody) return;
        bindAtendimentoFinalizeSingle();
        atendimentoBody.innerHTML = '';
        itemsRows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:800;">${escapeHtml(r.hora)}</td>
                <td style="font-weight:600;">${escapeHtml(r.paciente?.nome || '-')}</td>
                <td style="white-space: normal;">${escapeHtml(r.itemLabel || '-')}</td>
                <td style="text-align:center; font-weight:800;">${escapeHtml(String(r.budget?.seqid || '-'))}</td>
                <td>${escapeHtml(String(r.itemStatus || '-'))}</td>
                <td style="white-space: nowrap;">
                    <button type="button" class="btn-icon" style="color: var(--primary-color); margin-right: 4px;" onclick="openLaudoModal('${escapeHtml(r.itemId || '')}', '${escapeHtml(r.paciente?.nome || '')}', '${escapeHtml(r.itemLabel || '')}')" title="Editar Laudo/Evolução">
                        <i class="ri-file-edit-line"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-primary" data-action="finalize-one" data-agendamento="${escapeHtml(r.agendamentoId || '')}" data-budget="${escapeHtml(r.budget?.id || '')}" data-item="${escapeHtml(r.itemId || '')}" title="Marcar este item como Finalizado">
                        <i class="ri-check-double-line"></i> Finalizar
                    </button>
                    ${r.paciente?.id ? `<button class="btn-icon" onclick="showPatientDetails('${escapeHtml(r.paciente?.id)}')" title="Prontuário"><i class="ri-folder-user-line"></i></button>` : ''}
                    ${r.budget && r.budget.id ? `<button class="btn-icon" onclick="viewBudgetPayments('${escapeHtml(r.budget?.id)}', '${escapeHtml(String(r.budget?.seqid || ''))}', ${typeof calculateBudgetTotal === 'function' ? calculateBudgetTotal(r.budget) : Number(r.budget?.valor_total || r.budget?.valor || 0)})" title="Pagamentos e Liberação"><i class="ri-money-dollar-circle-line" style="color: #10b981;"></i></button>
                    <button class="btn-icon" onclick="viewBudgetFromPatient('${escapeHtml(r.budget?.id)}')" title="Ver Orçamento Pai"><i class="ri-file-list-3-line"></i></button>` : ''}
                </td>
            `;
            atendimentoBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Erro ao carregar Atendimento:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        renderAtendimentoPlaceholder(`Erro ao carregar atendimentos: ${msg}`);
    }
}

async function confirmAtendimentoItem({ budgetId, itemId, agendamentoId }, { suppressRefresh } = {}) {
    if (!itemId) return { ok: false, reason: 'missing_item_id' };
    try {
        console.log('[Atendimento] UPDATE item:', { itemId: String(itemId), budgetId: String(budgetId || ''), agendamentoId: String(agendamentoId || '') });
        
        // Bloqueio cirúrgico: verifica se o item JÁ ESTÁ finalizado no banco antes de prosseguir
        const { data: checkItem, error: checkErr } = await withTimeout(
            db.from('orcamento_itens').select('*').eq('id', itemId).maybeSingle(),
            10000,
            'orcamento_itens:check_status'
        );
        if (checkErr) throw checkErr;
        if (checkItem && (String(checkItem.status || '').trim().toUpperCase() === 'FINALIZADO' || String(checkItem.status || '').trim().toUpperCase() === 'CONCLUÍDO')) {
            console.warn(`[Atendimento] Item ${itemId} já se encontra finalizado no banco de dados. Abortando operação duplicada.`);
            if (!suppressRefresh) showToast('O item já havia sido finalizado anteriormente.', false);
            return { ok: true, skipped: true };
        }

        const checkout = await processStockOut({ budgetId, itemId, agendamentoId });
        if (!checkout || checkout.ok !== true) {
            if (!suppressRefresh) showToast('Conclusão cancelada no check-out de estoque.', true);
            return { ok: false, reason: 'checkout_cancelled' };
        }

        // Prepara os dados do Laudo e do Profissional
        const b = (budgets || []).find(x => String(x.id) === String(budgetId || checkItem?.orcamento_id));
        let profName = 'Profissional';
        let executorId = checkItem?.profissional_id ?? checkItem?.profissionalId ?? checkItem?.executor_id ?? checkItem?.executorId ?? b?.profissional_id ?? b?.profissionalId;
        
        if (executorId && typeof professionals !== 'undefined') {
            const profObj = professionals.find(p => String(p.id) === String(executorId) || String(p.seqid) === String(executorId));
            if (profObj && profObj.nome) {
                profName = profObj.nome;
            }
        }
        
        if (profName === 'Profissional') {
            const uEmail = String(currentUser && currentUser.email ? currentUser.email : '').trim().toLowerCase();
            const profObj = (typeof professionals !== 'undefined' ? professionals : []).find(p => String(p.email || '').trim().toLowerCase() === uEmail);
            profName = profObj && profObj.nome ? profObj.nome : (currentUser?.user_metadata?.full_name || 'Profissional');
            if (profObj) {
                executorId = profObj.id || profObj.seqid || executorId;
            }
        }
        
        // Garante que executorId esteja preenchido caso seja vazio, usando o currentUser
        if (!executorId && currentUser?.id) {
            executorId = currentUser.id;
        }

        const denteRegiao = checkItem?.sub_divisao || checkItem?.subdivisao || 'Não especificado';
        const defaultText = `Procedimento finalizado conforme orçamento. Profissional: ${profName}. Dente/Região: ${denteRegiao}.`;
        
        const obsLivre = window.__occCustomLaudos && window.__occCustomLaudos[itemId] ? `\n\nObservações Adicionais:\n${window.__occCustomLaudos[itemId]}` : '';
        const textoLaudo = defaultText + obsLivre;

        // UPDATE ATÔMICO
        // Envia status, profissional_id e laudo_clinico de uma só vez
        const { data, error } = await withTimeout(
            db.from('orcamento_itens')
                .update({ 
                    status: 'Finalizado',
                    profissional_id: executorId,
                    laudo_clinico: textoLaudo
                })
                .eq('empresa_id', currentEmpresaId)
                .eq('id', itemId)
                .select('id'),
            15000,
            'orcamento_itens:finalizar_atendimento'
        );
        if (error) throw error;
        const updatedRows = Array.isArray(data) ? data : [];
        if (!updatedRows.length) throw new Error('Item não encontrado ou sem permissão para atualizar.');

        if (window.__occCustomLaudos) {
            delete window.__occCustomLaudos[itemId];
        }

        let agendaOk = true;
        let agendaErrorMessage = '';
        // REMOVIDO: O sistema não deve concluir o agendamento inteiro automaticamente quando apenas um item é finalizado.
        // if (agendamentoId) {
        //     const { error: agErr } = await withTimeout(
        //         db.from('agenda_agendamentos')
        //             .update({ status: 'CONCLUIDO' })
        //             .eq('empresa_id', currentEmpresaId)
        //             .eq('id', agendamentoId),
        //         15000,
        //         'agenda_agendamentos:concluir_atendimento'
        //     );
        //     if (agErr) {
        //         agendaOk = false;
        //         agendaErrorMessage = agErr && agErr.message ? String(agErr.message) : 'Falha ao concluir agendamento.';
        //         console.error('Falha ao concluir agenda do atendimento:', agErr);
        //     }
        // }

        if (b && Array.isArray(b.orcamento_itens)) {
            const it = b.orcamento_itens.find(x => String(x.id) === String(itemId));
            if (it) it.status = 'Finalizado';
        }
        
        // --- 1. CHAMADA DE COMISSÃO (CORREÇÃO DE REGRA DE NEGÓCIO) ---
        // Chama a função global que gera a comissão do item.
        if (typeof window.generateCommissionForItem === 'function') {
            await window.generateCommissionForItem(budgetId, itemId, true);
        }

        // A pedido do usuário: chamada tryCloseBudgetFromItems removida
        // O status do orçamento mudará apenas se o trigger do banco de dados (que ouve a finalização do item) atuar.
        const closeRes = { closed: false, budget: b };

        if (!suppressRefresh) {
            showToast('Serviço marcado como Finalizado.');
            await fetchAtendimentoForUI();
        }
        return { ok: true, agendaOk, agendaErrorMessage };
    } catch (err) {
        console.error('Erro ao finalizar item do atendimento:', err);
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        if (!suppressRefresh) {
            showToast(`Falha ao finalizar: ${msg}`, true);
            await fetchAtendimentoForUI();
        } else {
            throw err;
        }
    }
}
// modulo_atendimento.js
window.finalizeBudgetItem = async function(budgetId, itemId, event) {
    // 1. TRAVA DE DUPLO CLIQUE (DEBOUNCE)
    const btn = (event && event.target) ? event.target.closest('button') : document.querySelector(`[data-item-id="${itemId}"]`);
    if (btn) {
        if (btn.disabled || btn.getAttribute('data-loading') === 'true') {
            console.warn("MÓDULO ATENDIMENTO - Clique bloqueado pelo Debounce.");
            return;
        }
        btn.disabled = true;
        btn.setAttribute('data-loading', 'true');
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Processando...';
    }

    if (!confirm('Confirmar a conclusão deste serviço?')) {
        if (btn) {
            btn.disabled = false;
            btn.removeAttribute('data-loading');
            btn.innerHTML = '<i class="ri-check-double-line"></i> Finalizar';
        }
        return;
    }

    try {
        const db = window.db || window.supabase;
        if (!db || typeof db.from !== 'function') {
            console.error("DEBUG CRÍTICO OCC - Instância do Supabase não encontrada no window no momento da execução.");
            throw new Error("Cliente do Supabase com método .from() não foi encontrado em nenhuma variável global!");
        }

        // Buscar dados essenciais duplicando a query (isolamento total)
        const { data: budgetData, error: budgetError } = await db
            .from('orcamentos')
            .select('*')
            .eq('id', budgetId)
            .single();

        if (budgetError || !budgetData) {
            console.error("MÓDULO ATENDIMENTO - Erro ao buscar orçamento:", budgetError);
            alert("MÓDULO ATENDIMENTO: Erro ao buscar orçamento!");
            throw new Error("Abort");
        }

        const { data: itemData, error: itemError } = await db
            .from('orcamento_itens')
            .select('*')
            .eq('id', itemId)
            .single();

        if (itemError || !itemData) {
            console.error("MÓDULO ATENDIMENTO - Erro ao buscar item:", itemError);
            alert("MÓDULO ATENDIMENTO: Erro ao buscar item!");
            throw new Error("Abort");
        }

        // 2. VALIDAÇÃO DE STATUS INDIVIDUAL ANTES DO INSERT
        const stKey = String(itemData.status || itemData.item_status || '').trim().toUpperCase();
        if (stKey === 'FINALIZADO' || stKey === 'EXECUTADO' || stKey === 'CONCLUIDO' || stKey === 'CONCLUÍDO') {
            console.warn("MÓDULO ATENDIMENTO - Abortando silenciosamente: Procedimento já consta como Finalizado/Executado no banco.");
            if (btn && btn.parentNode) {
                btn.outerHTML = `<span class="badge bg-success text-white" style="background-color: #28a745; padding: 5px 10px; border-radius: 4px; font-weight: bold;"><i class="ri-check-line"></i> Finalizado</span>`;
            }
            return; 
        }

        // a) Update do status do item para 'Finalizado' (padrão de conclusão de item)
        const { error: itErr } = await db.from('orcamento_itens')
            .update({ status: 'Finalizado' })
            .eq('id', itemId);

        if (itErr) {
            console.error("MÓDULO ATENDIMENTO - Erro ao atualizar item:", itErr);
            alert("MÓDULO ATENDIMENTO: Erro ao atualizar item!");
            return;
        }

        // Atualiza no array de memória local se existir para que a tela não precise dar F5
        const listBud = window.budgets || (typeof budgets !== 'undefined' ? budgets : []);
        if (listBud && listBud.length > 0) {
            const memBudget = listBud.find(b => b.id === budgetId || b.seqid == budgetId);
            if (memBudget) {
                const memItem = (memBudget.orcamento_itens || memBudget.itens || []).find(it => it.id === itemId);
                if (memItem) memItem.status = 'Finalizado';
                memBudget.status = 'Em Andamento'; // Update status in memory
            }
        }

        // b) Update IMEDIATO e mandatório do status global do orçamento para 'Em Andamento'
        console.log("MÓDULO ATENDIMENTO - Forçando status do Orçamento para Em Andamento");
        const { error: updErr } = await db.from('orcamentos')
            .update({ status: 'Em Andamento' })
            .eq('id', budgetId);
            
        if (updErr) {
            console.error("MÓDULO ATENDIMENTO - Erro ao atualizar status global:", updErr);
        }

        // c) Chame a função de comissão.
        if (typeof window.generateCommissionForItem === 'function') {
            await window.generateCommissionForItem(budgetId, itemId, true);
        } else {
            console.warn("MÓDULO ATENDIMENTO - generateCommissionForItem não encontrada.");
        }

        // d) Chame a função 'gravarDebitoPaciente' importada do módulo financeiro.
        const itemTotal = (parseFloat(itemData.valor) || 0) * (parseInt(itemData.qtde) || 1);
        
        // Puxando o ID do paciente do Orçamento
        let pacId = budgetData.paciente_id || budgetData.pacienteid || budgetData.pacienteseqid;
        
        // Resolvendo o seqid se tivermos a array local de patients
        if (typeof window.patients !== 'undefined') {
            const patientObj = window.patients.find(p => p.id === pacId || p.seqid == pacId);
            if (patientObj) pacId = patientObj.seqid;
        }
        
        // CORREÇÃO CIRÚRGICA: Se pacId ainda for um UUID (string longa com letras),
        // o parseInt() no financeiro vai falhar e inserir paciente_id como NULL!
        // Precisamos buscar o seqid numérico diretamente do banco de dados.
        if (pacId && isNaN(pacId) && String(pacId).length > 15) {
            console.log("MÓDULO ATENDIMENTO - Resolvendo UUID do paciente para seqid no banco...");
            const { data: pData } = await db.from('pacientes').select('seqid').eq('id', pacId).single();
            if (pData && pData.seqid) {
                pacId = pData.seqid;
            }
        }
        
        const empId = budgetData.empresa_id || window.currentEmpresaId;
        const desc = itemData.descricao || 'Serviço Executado';
        
        // CORREÇÃO CRÍTICA DE TIPAGEM: Força parse do ID para numérico a fim de não enviar a string uuid
        const refId = parseInt(budgetData.seqid || budgetData.id_sequencial || budgetData.seq_id || 0, 10) || null;
        
        const currentUserId = window.currentUser && window.currentUser.id ? window.currentUser.id : null;

        await window.gravarDebitoPaciente(budgetId, itemTotal, empId, pacId, `[Consumo/Execução] ${desc} (Orçamento #${refId})`, refId, currentUserId);

        // 3. RENDERIZE O SELO VERDE IMEDIATAMENTE APÓS O SUCESSO
        if (btn && btn.parentNode) {
            btn.outerHTML = `<span class="badge bg-success text-white" style="background-color: #28a745; padding: 5px 10px; border-radius: 4px; font-weight: bold;"><i class="ri-check-line"></i> Finalizado</span>`;
        }

        // Feedback de UI
        if (typeof window.showToast === 'function') {
            window.showToast('Item marcado como Finalizado.');
        } else {
            alert('Item marcado como Finalizado.');
        }

        if (typeof window.refreshBudgetsListView === 'function') {
            window.refreshBudgetsListView();
        }
        if (typeof window.fetchAtendimentoForUI === 'function') {
            window.fetchAtendimentoForUI();
        }

        // 1. REINTEGRE A TELA DE BAIXA DE INSUMOS
        const fnEstoque = window.modalCheckOutEstoque || (typeof modalCheckOutEstoque !== 'undefined' ? modalCheckOutEstoque : null);
        if (typeof fnEstoque === 'function') {
            console.log("MÓDULO ATENDIMENTO - Chamando tela nativa de baixa de insumos...");
            // Executa a função do monólito passando o ID do orçamento e do item para abrir o Modal de Consumo
            fnEstoque({ budgetId, itemId }).catch(e => console.error("MÓDULO ATENDIMENTO - Erro na rotina de estoque:", e));
        } else {
            console.warn("MÓDULO ATENDIMENTO - Função 'modalCheckOutEstoque' não encontrada no escopo global.");
        }

    } catch (err) {
        console.error('MÓDULO ATENDIMENTO - Erro fatal:', err);
        if (err.message !== "Abort") {
            alert('MÓDULO ATENDIMENTO: Erro fatal ao finalizar atendimento.');
        }
        // Restaura o botão em caso de erro para permitir nova tentativa
        if (btn) {
            btn.disabled = false;
            btn.removeAttribute('data-loading');
            btn.innerHTML = '<i class="ri-check-double-line"></i> Finalizar';
        }
    }
};
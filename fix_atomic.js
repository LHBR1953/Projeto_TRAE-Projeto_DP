const fs = require('fs');
let txt = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');

const search = `        const checkout = await processStockOut({ budgetId, itemId, agendamentoId });
        if (!checkout || checkout.ok !== true) {
            if (!suppressRefresh) showToast('Conclusão cancelada no check-out de estoque.', true);
            return { ok: false, reason: 'checkout_cancelled' };
        }
        const { data, error } = await withTimeout(
            db.from('orcamento_itens')
                .update({ status: 'Finalizado' })
                .eq('empresa_id', currentEmpresaId)
                .eq('id', itemId)
                .select('id'),
            15000,
            'orcamento_itens:finalizar_atendimento'
        );
        if (error) throw error;
        const updatedRows = Array.isArray(data) ? data : [];
        if (!updatedRows.length) throw new Error('Item não encontrado ou sem permissão para atualizar.');

        // --- GATILHO: Gravar no prontuário (paciente_evolucao) ---
        try {
            // Busca o orçamento pai para pegar o paciente_id
            const b = (budgets || []).find(x => String(x.id) === String(budgetId || checkItem?.orcamento_id));
            const pacId = b ? (b.paciente_id || b.pacienteid || b.pacienteseqid) : null;

            if (pacId) {
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
                }

                const denteRegiao = checkItem?.sub_divisao || checkItem?.subdivisao || 'Não especificado';
                const defaultText = \`Procedimento finalizado conforme orçamento. Profissional: \${profName}. Dente/Região: \${denteRegiao}.\`;

                const obsLivre = window.__occCustomLaudos[itemId] ? \`\\n\\nObservações Adicionais:\\n\${window.__occCustomLaudos[itemId]}\` : '';
                const textoLaudo = defaultText + obsLivre;

                // Atualiza a evolução criada pelo trigger para evitar duplicação e corrigir profissional
                await new Promise(resolve => setTimeout(resolve, 600)); // Aguarda trigger do banco
                
                const { data: evols } = await db.from('paciente_evolucao')
                    .select('*')
                    .eq('paciente_id', pacId)
                    .order('created_at', { ascending: false })
                    .limit(3);

                if (evols && evols.length > 0) {
                    const trigEvol = evols.find(e => e.descricao && e.descricao.includes('Procedimento finalizado conforme orçamento'));
                    
                    if (trigEvol) {
                        await db.from('paciente_evolucao')
                            .update({ 
                                descricao: textoLaudo,
                                profissional_id: executorId || currentUser?.id
                            })
                            .eq('id', trigEvol.id);
                    }
                }

                console.log("[Atendimento] Evolução clínica unificada com sucesso.");

                // Limpa a memória temporária após salvar
                delete window.__occCustomLaudos[itemId];
            }
        } catch (evoErr) {
            console.error("Erro ao gravar evolução clínica:", evoErr);
        }`;

const replace = `        const checkout = await processStockOut({ budgetId, itemId, agendamentoId });
        if (!checkout || checkout.ok !== true) {
            if (!suppressRefresh) showToast('Conclusão cancelada no check-out de estoque.', true);
            return { ok: false, reason: 'checkout_cancelled' };
        }

        // --- PREPARAÇÃO DOS DADOS DO LAUDO ---
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
        }

        const denteRegiao = checkItem?.sub_divisao || checkItem?.subdivisao || 'Não especificado';
        const defaultText = \`Procedimento finalizado conforme orçamento. Profissional: \${profName}. Dente/Região: \${denteRegiao}.\`;
        const obsLivre = window.__occCustomLaudos[itemId] ? \`\\n\\nObservações Adicionais:\\n\${window.__occCustomLaudos[itemId]}\` : '';
        const textoLaudo = defaultText + obsLivre;

        // --- UPDATE ATÔMICO ---
        // O banco (Trigger) usará profissional_id e laudo_clinico para gerar um único card de evolução
        const { data, error } = await withTimeout(
            db.from('orcamento_itens')
                .update({ 
                    status: 'Finalizado',
                    profissional_id: executorId || currentUser?.id,
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

        // Limpa a memória temporária após salvar
        delete window.__occCustomLaudos[itemId];`;

txt = txt.replace(search, replace);

// Remove the tryCloseBudgetFromItems and finalizeBudgetItem logic hack
const search2 = `        // Merge evolution trigger logic to fix profissional_id
        try {
            const pacId = budget.paciente_id || budget.pacienteid || budget.pacienteseqid;
            const itemToFix = (budget.orcamento_itens || []).find(it => it.id === itemId);
            let executorId = itemToFix?.profissional_id || budget.profissional_id || (typeof currentUser !== 'undefined' ? currentUser?.id : null);
            
            if (pacId) {
                await new Promise(r => setTimeout(r, 600)); // wait for trigger
                const { data: evols } = await db.from('paciente_evolucao')
                    .select('*')
                    .eq('paciente_id', pacId)
                    .order('created_at', { ascending: false })
                    .limit(3);
                    
                if (evols && evols.length > 0) {
                    const trigEvol = evols.find(e => e.descricao && e.descricao.includes('Procedimento finalizado conforme orçamento'));
                    if (trigEvol) {
                        await db.from('paciente_evolucao')
                            .update({ profissional_id: executorId })
                            .eq('id', trigEvol.id);
                    }
                }
            }
        } catch (e) { console.error('Erro ao atualizar profissional na evolução:', e); }`;

txt = txt.replace(search2, '');

txt = txt.replace(/20260605_UNIFY_EVOLUTION_CARDS/g, '20260606_CLEAN_ARCH_EVOLUTION');

fs.writeFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', txt);
console.log('Done!');

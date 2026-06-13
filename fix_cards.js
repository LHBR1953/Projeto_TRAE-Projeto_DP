const fs = require('fs');
let txt = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');

const search1 = `                const obsLivre = window.__occCustomLaudos[itemId] ? \`\\n\\nObservações Adicionais:\\n\${window.__occCustomLaudos[itemId]}\` : '';
                const textoLaudo = defaultText + obsLivre;

                const evolucaoEntry = {
                    paciente_id: pacId,
                    descricao: textoLaudo,
                    dente_regiao: denteRegiao,
                    empresa_id: currentEmpresaId,
                    created_by: currentUser?.id
                };

                await db.from('paciente_evolucao').insert(evolucaoEntry);
                console.log("[Atendimento] Evolução clínica gravada com sucesso.");

                // Limpa a memória temporária após salvar
                delete window.__occCustomLaudos[itemId];`;

const replace1 = `                const obsLivre = window.__occCustomLaudos[itemId] ? \`\\n\\nObservações Adicionais:\\n\${window.__occCustomLaudos[itemId]}\` : '';
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
                delete window.__occCustomLaudos[itemId];`;

txt = txt.replace(search1, replace1);

const search2 = `        if (itErr) throw itErr;

        // 2. Atualizar estado local
        const item = (budget.orcamento_itens || []).find(it => it.id === itemId);`;

const replace2 = `        if (itErr) throw itErr;

        // Merge evolution trigger logic to fix profissional_id
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
        } catch (e) { console.error('Erro ao atualizar profissional na evolução:', e); }

        // 2. Atualizar estado local
        const item = (budget.orcamento_itens || []).find(it => it.id === itemId);`;

txt = txt.replace(search2, replace2);

// Atualizar build version
txt = txt.replace(/20260605_BUGFIX_MODAL_PAGAMENTO/g, '20260605_UNIFY_EVOLUTION_CARDS');

fs.writeFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', txt);
console.log('DONE');
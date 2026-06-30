// modulo_financeiro.js
window.gravarDebitoPaciente = async function(orcamentoId, valor, empresaId, pacienteId, observacoes, referenciaId, criadoPor) {
    try {
        const debitoData = {
            tipo: 'DEBITO',
            categoria: 'PAGAMENTO', // A categoria exata descoberta no monólito
            valor: parseFloat(valor) || 0,
            orcamento_id: orcamentoId, // Assume-se uuid do orcamento ou nulo dependendo do modelo, mantemos o pass-through
            empresa_id: empresaId || window.currentEmpresaId || null,
            paciente_id: pacienteId ? parseInt(pacienteId, 10) || null : null, // Proteção de tipagem se paciente_id for numérico
            observacoes: observacoes || `[Consumo/Execução] (Orçamento #${referenciaId || orcamentoId})`,
            referencia_id: referenciaId ? parseInt(referenciaId, 10) || null : null, // A coluna referencia_id é bigint
            criado_por: criadoPor || (window.currentUser ? window.currentUser.id : null) || null
        };
        
        console.log("PAYLOAD DEBITO (PAGAMENTO):", debitoData);
        
        // Uso dinâmico para garantir que pegamos a instância global com proxy
        const db = window.db || window.supabase;
        if (!db) throw new Error("Instância do Supabase não encontrada no modulo financeiro!");

        const { error: debErrDb } = await db.from('financeiro_transacoes').insert(debitoData);
        
        if (debErrDb) {
            console.error("ERRO CRÍTICO DO POSTGRES:", JSON.stringify(debErrDb));
            alert("FALHA NO DÉBITO: " + debErrDb.message + " | Detalhes: " + debErrDb.details);
        } else {
            console.log("MÓDULO FINANCEIRO - DÉBITO registrado com sucesso na tabela financeiro_transacoes!");
            alert("MÓDULO FINANCEIRO: Débito gravado com sucesso!");
        }
    } catch (debErr) {
        console.error("MÓDULO FINANCEIRO - FALHA CRÍTICA NO INSERT DO DÉBITO (catch):", debErr);
        alert("MÓDULO FINANCEIRO: FALHA no catch do Débito!");
    }
};
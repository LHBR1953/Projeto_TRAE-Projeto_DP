window.getComissoesPorItens = async function(empId, itemIds) {
    if (!itemIds || !itemIds.length) return [];
    
    // Divide em lotes menores caso tenha muitos itens para evitar erros de URL muito longa (400 Bad Request)
    const chunkSize = 50;
    const results = [];
    
    for (let i = 0; i < itemIds.length; i += chunkSize) {
        const chunk = itemIds.slice(i, i + chunkSize);
        try {
            const { data, error } = await withTimeout(
                db.from('financeiro_comissoes').select('item_id,valor_comissao').eq('empresa_id', empId).in('item_id', chunk),
                15000,
                'financeiro_comissoes:chunk'
            );
            if (!error && Array.isArray(data)) {
                results.push(...data);
            }
        } catch (e) {
            console.warn('Erro ao buscar chunk de comissões:', e);
        }
    }
    return results;
};

window.checkProfessionalHasCommissions = async function(empresaId, profSeq) {
    try {
        const { data, error } = await withTimeout(
            db.from('financeiro_comissoes').select('*').eq('empresa_id', empresaId),
            15000,
            'financeiro_comissoes:check:all_by_empresa'
        );
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        return rows.some(r => String(r && r.profissional_id) === String(profSeq));
    } catch {
        return false;
    }
};

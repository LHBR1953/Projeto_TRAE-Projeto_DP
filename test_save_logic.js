const html = `
    <div id="addBudgetItemPanel" style="display: block;">
        <h4 id="panelTitle">Novo Serviço</h4>
        <select id="budItemServicoId"><option value="s1">Servico 1</option></select>
        <input id="budItemDescricao" value="Desc">
        <input id="budItemSubdivisao" value="-">
        <input id="budItemValor" value="100.00">
        <input id="budItemQtde" value="1">
        <select id="budItemProfissionalId"><option value="p1">Profissional 1</option></select>
        <input id="budItemValorProtetico" value="0">
        <button id="btnSaveAddItem">Confirmar Item</button>
    </div>
    <table id="budgetItemsTableBody"></table>
`;

let currentBudgetItems = [];
let editingBudgetItemId = null;

function clickSave() {
    const servId = 's1';
    const valorUnit = parseFloat('100.00');
    const qtde = parseInt('1') || 1;
    const profId = 'p1';

    if (!servId || isNaN(valorUnit) || !profId) {
        console.log("Validation failed!");
        return;
    }

    const servData = { id: 's1', descricao: 'Desc', subdivisao: '-' };
    const profData = { id: 'p1', nome: 'Profissional Teste' };

    console.log("Before save, isEditing?", editingBudgetItemId);

    if (editingBudgetItemId) {
        const idx = currentBudgetItems.findIndex(i => i.id === editingBudgetItemId);
        if (idx !== -1) {
            currentBudgetItems[idx] = {
                ...currentBudgetItems[idx],
                servicoId: servId,
                servicoDescricao: servData.descricao,
                subdivisao: servData.subdivisao || '-',
                valor: valorUnit,
                qtde: qtde,
                proteticoId: profId,
                proteticoNome: profData ? profData.nome : '',
                valorProtetico: parseFloat('0') || 0
            };
        }
    } else {
        const newItem = {
            id: 'test_id',
            servicoId: servId,
            servicoDescricao: servData.descricao,
            subdivisao: servData.subdivisao || '-',
            valor: valorUnit,
            qtde: qtde,
            proteticoId: profId,
            proteticoNome: profData ? profData.nome : '',
            valorProtetico: parseFloat('0') || 0
        };
        currentBudgetItems.push(newItem);
    }

    // Simulate Panel Hide
    console.log("Hiding Panel...");
    // addBudgetItemPanel.style.display = 'none';
    editingBudgetItemId = null;

    console.log("Items:", currentBudgetItems);
}

clickSave();

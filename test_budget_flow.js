const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf-8');
const js = fs.readFileSync('app.js', 'utf-8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

// Mock dependencies
window.services = [{ id: 's1', seqid: 1, descricao: 'Servico Teste', subdivisao: 'Geral', ie: 'S', valor: 100 }];
window.professionals = [{ id: 'p1', seqid: 1, nome: 'Protetico Teste' }];

// Mock generateId
window.generateId = () => "test_id";

// Inject app.js
try {
    const scriptEl = document.createElement("script");
    scriptEl.textContent = js;
    document.body.appendChild(scriptEl);
} catch (e) {
    console.log("App.js inject error:", e);
}

setTimeout(() => {
    // 1. User clicks Add Item Toggle (to open panel)
    document.getElementById('btnToggleAddItem').click();
    console.log("Panel display:", document.getElementById('addBudgetItemPanel').style.display);

    // 2. Select service and professional
    const servSelect = document.getElementById('budItemServicoId');
    servSelect.value = 's1';
    servSelect.dispatchEvent(new window.Event('change'));

    document.getElementById('budItemValor').value = '100';
    document.getElementById('budItemQtde').value = '1';

    const profSelect = document.getElementById('budItemProfissionalId');
    profSelect.value = 'p1';
    profSelect.dispatchEvent(new window.Event('change'));

    console.log("Btn Disabled?", document.getElementById('btnSaveAddItem').disabled);

    // 3. User clicks Confirm Item
    document.getElementById('btnSaveAddItem').click();

    // 4. Verify Grid
    console.log("currentBudgetItems length:", window.currentBudgetItems.length);
    console.log("Grid HTML:", document.getElementById('budgetItemsTableBody').innerHTML.trim());
    console.log("Grid Parent Display:", document.getElementById('budgetItemsTableBody').parentElement.style.display);
}, 500);

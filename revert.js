const fs = require('fs');

function revertInFile(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/db\.from\(getDbTable\('especialidades'\)\)/g, "db.from('especialidades')");
    code = code.replace(/db\.from\(getDbTable\('especialidade_subdivisoes'\)\)/g, "db.from('especialidade_subdivisoes')");
    code = code.replace(/db\.from\(getDbTable\('servicos'\)\)/g, "db.from('servicos')");
    code = code.replace(/db\.from\(getDbTable\('usage_models'\)\)/g, "db.from('usage_models')");
    code = code.replace(/db\.from\(getDbTable\('model_items'\)\)/g, "db.from('model_items')");
    code = code.replace(/db\.from\(getDbTable\('inventory'\)\)/g, "db.from('inventory')");
    code = code.replace(/db\.from\(getDbTable\('service_mapping'\)\)/g, "db.from('service_mapping')");
    fs.writeFileSync(filePath, code);
}

revertInFile('app_v22.js');
revertInFile('app_estoque_inventario.js');
revertInFile('app_estoque_modelos.js');
revertInFile('app_estoque_vinculo.js');
revertInFile('app_servicos.js');
revertInFile('app_especialidades.js');
console.log('Revert done.');
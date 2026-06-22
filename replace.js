const fs = require('fs');

function replaceInFile(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/db\.from\('especialidades'\)/g, "db.from(getDbTable('especialidades'))");
    code = code.replace(/db\.from\('especialidade_subdivisoes'\)/g, "db.from(getDbTable('especialidade_subdivisoes'))");
    code = code.replace(/db\.from\('servicos'\)/g, "db.from(getDbTable('servicos'))");
    code = code.replace(/db\.from\('usage_models'\)/g, "db.from(getDbTable('usage_models'))");
    code = code.replace(/db\.from\('model_items'\)/g, "db.from(getDbTable('model_items'))");
    code = code.replace(/db\.from\('inventory'\)/g, "db.from(getDbTable('inventory'))");
    code = code.replace(/db\.from\('service_mapping'\)/g, "db.from(getDbTable('service_mapping'))");
    fs.writeFileSync(filePath, code);
}

replaceInFile('app_v22.js');
replaceInFile('app_estoque_inventario.js');
replaceInFile('app_estoque_modelos.js');
replaceInFile('app_estoque_vinculo.js');
replaceInFile('app_servicos.js');
replaceInFile('app_especialidades.js');
console.log('Replace done.');
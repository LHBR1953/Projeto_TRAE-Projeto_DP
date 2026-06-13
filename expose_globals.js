const fs = require('fs');
const acorn = require('acorn');
const path = require('path');

const dir = 'C:/Projeto_TRAE/Projeto_DP/';
const files = fs.readdirSync(dir).filter(f => f.startsWith('app_') && f.endsWith('.js') && f !== 'app_v22.js' && !f.includes('backup') && !f.includes('FUNCIONANDO') && !f.includes('fixed') && !f.includes('app_v18') && !f.includes('app_v19') && !f.includes('app_v20'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let code = fs.readFileSync(filePath, 'utf8');
    try {
        const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
        const functions = [];
        ast.body.forEach(n => {
            if (n.type === 'FunctionDeclaration' && n.id && n.id.name) {
                functions.push(n.id.name);
            }
        });
        
        if (functions.length > 0) {
            let additions = '\n// Exposing functions to window to ensure global access\n';
            for (const f of functions) {
                additions += `window.${f} = ${f};\n`;
            }
            fs.appendFileSync(filePath, additions, 'utf8');
            console.log(`Exposed ${functions.length} functions in ${file}`);
        }
    } catch (e) {
        console.error(`Error parsing ${file}:`, e.message);
    }
}

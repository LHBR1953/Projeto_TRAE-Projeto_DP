const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const files = fs.readdirSync('C:/Projeto_TRAE/Projeto_DP/').filter(f => f.startsWith('app_') && f.endsWith('.js') && !f.includes('backup') && !f.includes('FUNCIONANDO') && !f.includes('v18') && !f.includes('v19') && !f.includes('v20'));

for (const file of files) {
    const code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/' + file, 'utf8');
    try {
        const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
        
        // Find top-level expressions
        ast.body.forEach(node => {
            if (node.type === 'ExpressionStatement') {
                const expr = node.expression;
                // Check for obj.addEventListener(...) or obj.value = ...
                if (expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression' && expr.callee.property.name === 'addEventListener') {
                    // Check if the object is document or window
                    if (expr.callee.object.name === 'document' || expr.callee.object.name === 'window') return;
                    console.log(`${file}: Top-level addEventListener without if check: line ${acorn.getLineInfo(code, node.start).line}`);
                }
                if (expr.type === 'AssignmentExpression' && expr.left.type === 'MemberExpression') {
                    const prop = expr.left.property.name;
                    if (['value', 'innerHTML', 'innerText', 'classList', 'style', 'display'].includes(prop)) {
                        console.log(`${file}: Top-level DOM assignment without if check: line ${acorn.getLineInfo(code, node.start).line}`);
                    }
                }
            }
        });
    } catch (e) {
        console.log(`Error parsing ${file}: ${e.message}`);
    }
}

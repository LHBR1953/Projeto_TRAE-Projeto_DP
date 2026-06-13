const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const files = fs.readdirSync('C:/Projeto_TRAE/Projeto_DP/').filter(f => f.startsWith('app_') && f.endsWith('.js') && !f.includes('backup') && !f.includes('FUNCIONANDO') && !f.includes('v18') && !f.includes('v19') && !f.includes('v20'));

for (const file of files) {
    const path = 'C:/Projeto_TRAE/Projeto_DP/' + file;
    let code = fs.readFileSync(path, 'utf8');
    let changed = false;

    try {
        const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
        
        // We will collect top-level statements that need wrapping.
        const toWrap = [];

        ast.body.forEach(node => {
            if (node.type === 'ExpressionStatement') {
                const expr = node.expression;
                let targetVar = null;

                if (expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression') {
                    if (expr.callee.object.type === 'Identifier') {
                        targetVar = expr.callee.object.name;
                    }
                } else if (expr.type === 'AssignmentExpression' && expr.left.type === 'MemberExpression') {
                    if (expr.left.object.type === 'Identifier') {
                        targetVar = expr.left.object.name;
                    }
                }

                if (targetVar && targetVar !== 'window' && targetVar !== 'document' && targetVar !== 'console' && targetVar !== 'localStorage' && targetVar !== 'sessionStorage' && targetVar !== 'location' && targetVar !== 'history' && targetVar !== 'navigator') {
                    // Check if the property accessed is a DOM property/method
                    let isDom = false;
                    if (expr.type === 'CallExpression' && ['addEventListener', 'removeEventListener', 'appendChild', 'removeChild', 'setAttribute', 'removeAttribute', 'classList'].includes(expr.callee.property.name)) {
                        isDom = true;
                    } else if (expr.type === 'AssignmentExpression' && ['value', 'innerHTML', 'innerText', 'textContent', 'style', 'className', 'checked', 'disabled'].includes(expr.left.property.name)) {
                        isDom = true;
                    } else if (expr.type === 'AssignmentExpression' && expr.left.object.type === 'MemberExpression' && expr.left.object.property.name === 'style') {
                        // e.g. el.style.display = 'none'
                        isDom = true;
                        targetVar = expr.left.object.object.name;
                    }

                    if (isDom) {
                        toWrap.push({
                            start: node.start,
                            end: node.end,
                            varName: targetVar
                        });
                    }
                }
            }
        });

        if (toWrap.length > 0) {
            // Sort descending so replacements don't mess up offsets
            toWrap.sort((a, b) => b.start - a.start);
            
            for (const w of toWrap) {
                const original = code.slice(w.start, w.end);
                const replacement = `if (typeof ${w.varName} !== 'undefined' && ${w.varName}) { ${original} }`;
                code = code.slice(0, w.start) + replacement + code.slice(w.end);
            }
            fs.writeFileSync(path, code, 'utf8');
            console.log(`Wrapped ${toWrap.length} top-level DOM accesses in ${file}`);
        }
    } catch (e) {
        console.log(`Error parsing ${file}: ${e.message}`);
    }
}

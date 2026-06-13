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
        
        const toWrap = [];

        walk.simple(ast, {
            ExpressionStatement(node) {
                // Only wrap if it's at the top level OR inside a DOMContentLoaded block
                // It's safer to just wrap ANY ExpressionStatement that directly accesses a DOM property 
                // of an identifier, as long as it's not already inside an `if`.
                // Actually, if we wrap it, and it's inside a function, it's also fine (adds safety).
                // But wait, what if it's inside an `if` without braces? acorn-walk `ExpressionStatement` handles that, 
                // but replacing text might break `if (foo) el.value = 1;` into `if (foo) if (typeof el...) { el.value = 1; }`. That is syntactically valid!
                
                const expr = node.expression;
                let targetVar = null;

                if (expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression') {
                    if (expr.callee.object.type === 'Identifier') {
                        targetVar = expr.callee.object.name;
                    }
                } else if (expr.type === 'AssignmentExpression' && expr.left.type === 'MemberExpression') {
                    if (expr.left.object.type === 'Identifier') {
                        targetVar = expr.left.object.name;
                    } else if (expr.left.object.type === 'MemberExpression' && expr.left.object.property.name === 'style') {
                        if (expr.left.object.object.type === 'Identifier') {
                            targetVar = expr.left.object.object.name;
                        }
                    }
                }

                if (targetVar && targetVar !== 'window' && targetVar !== 'document' && targetVar !== 'console' && targetVar !== 'localStorage' && targetVar !== 'sessionStorage' && targetVar !== 'location' && targetVar !== 'history' && targetVar !== 'navigator' && targetVar !== 'e' && targetVar !== 'ev' && targetVar !== 'event') {
                    let isDom = false;
                    if (expr.type === 'CallExpression' && ['addEventListener', 'removeEventListener', 'appendChild', 'removeChild', 'setAttribute', 'removeAttribute', 'classList'].includes(expr.callee.property.name)) {
                        isDom = true;
                    } else if (expr.type === 'AssignmentExpression' && ['value', 'innerHTML', 'innerText', 'textContent', 'className', 'checked', 'disabled', 'display'].includes(expr.left.property.name)) {
                        isDom = true;
                    } else if (expr.type === 'AssignmentExpression' && expr.left.object.type === 'MemberExpression' && expr.left.object.property.name === 'style') {
                        isDom = true;
                    }

                    if (isDom) {
                        // Check if it's already wrapped in an if (we can't easily check parents with walk.simple, but we can look at the code string)
                        // If the text before this node is `if (...)` or if we just naively wrap it.
                        // Actually, if we just wrap it, it's safer.
                        // Let's only wrap if it's NOT already wrapped.
                        const codeBefore = code.slice(Math.max(0, node.start - 50), node.start);
                        if (!codeBefore.includes('if (typeof ' + targetVar) && !codeBefore.match(/if\s*\(\s*!?\s*[a-zA-Z0-9_]+\s*\)\s*$/)) {
                            toWrap.push({
                                start: node.start,
                                end: node.end,
                                varName: targetVar
                            });
                        }
                    }
                }
            }
        });

        if (toWrap.length > 0) {
            toWrap.sort((a, b) => b.start - a.start);
            
            for (const w of toWrap) {
                const original = code.slice(w.start, w.end);
                // Make sure we don't double wrap if we already wrapped it in a previous run
                if (!original.startsWith('if (typeof')) {
                    const replacement = `if (typeof ${w.varName} !== 'undefined' && ${w.varName}) { ${original} }`;
                    code = code.slice(0, w.start) + replacement + code.slice(w.end);
                }
            }
            fs.writeFileSync(path, code, 'utf8');
            console.log(`Wrapped ${toWrap.length} DOM accesses in ${file}`);
        }
    } catch (e) {
        console.log(`Error parsing ${file}: ${e.message}`);
    }
}

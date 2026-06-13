const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });

// Find all top-level declared functions and variables in app_v22.js
const declared = new Set();
ast.body.forEach(node => {
    if (node.type === 'FunctionDeclaration') {
        declared.add(node.id.name);
    } else if (node.type === 'VariableDeclaration') {
        node.declarations.forEach(d => {
            if (d.id && d.id.name) declared.add(d.id.name);
        });
    }
});

// Also add DOM methods, console, etc
declared.add('console');
declared.add('document');
declared.add('window');
declared.add('setTimeout');
declared.add('clearTimeout');
declared.add('setInterval');
declared.add('clearInterval');
declared.add('Math');
declared.add('Date');
declared.add('Number');
declared.add('String');
declared.add('Boolean');
declared.add('Object');
declared.add('Array');
declared.add('Promise');

const toReplace = [];

// Walk the AST to find addEventListener calls
const walk = require('acorn-walk');
walk.simple(ast, {
    CallExpression(node) {
        if (node.callee.type === 'MemberExpression' && node.callee.property.name === 'addEventListener') {
            if (node.arguments.length >= 2) {
                const arg = node.arguments[1];
                if (arg.type === 'Identifier') {
                    if (!declared.has(arg.name)) {
                        console.log(`Missing reference: ${arg.name} at line ${acorn.getLineInfo(code, node.start).line}`);
                        toReplace.push({
                            start: arg.start,
                            end: arg.end,
                            name: arg.name
                        });
                    }
                }
            }
        }
    }
});

console.log('Total missing references:', toReplace.length);

// Replace them with arrow functions
let newCode = code;
// sort descending by start
toReplace.sort((a, b) => b.start - a.start);

for (const r of toReplace) {
    newCode = newCode.slice(0, r.start) + `(e) => window.${r.name}(e)` + newCode.slice(r.end);
}

fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', newCode, 'utf8');
console.log('Fixed app_v22.js');

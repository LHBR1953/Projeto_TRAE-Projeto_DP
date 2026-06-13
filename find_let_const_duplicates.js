const fs = require('fs');
const acorn = require('acorn');

const htmlCode = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app.html', 'utf8');
const scriptRegex = /<script src="(app_[^"]+\.js)\?v=.*?"><\/script>/g;
let match;
const scripts = [];
while ((match = scriptRegex.exec(htmlCode)) !== null) {
    scripts.push(match[1]);
}

const allGlobals = new Map();
const duplicates = [];

for (const script of scripts) {
    const code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/' + script, 'utf8');
    try {
        const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
        for (const node of ast.body) {
            if (node.type === 'VariableDeclaration') {
                for (const decl of node.declarations) {
                    if (decl.id.type === 'Identifier') {
                        const name = decl.id.name;
                        if (allGlobals.has(name)) {
                            duplicates.push(`Duplicate '${node.kind} ${name}' found in ${script} (first seen in ${allGlobals.get(name)})`);
                        } else {
                            if (node.kind !== 'var') {
                                allGlobals.set(name, script);
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(`Error parsing ${script}:`, err.message);
    }
}

if (duplicates.length > 0) {
    console.log('Duplicates found:');
    duplicates.forEach(d => console.log(d));
} else {
    console.log('No top-level let/const duplicates found!');
}

const fs = require('fs');

const appJs = fs.readFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\app.js', 'utf8');
const indexHtml = fs.readFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\index.html', 'utf8');

// Find all document.getElementById('...') inside app.js
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const missing = [];

while ((match = regex.exec(appJs)) !== null) {
    const id = match[1];
    // Check if ID exists in index.html
    const idRegex = new RegExp(`id=['"]${id}['"]`);
    if (!idRegex.test(indexHtml)) {
        missing.push(id);
    }
}

console.log("Missing IDs requested by app.js from index.html:");
console.log(missing.length ? missing : "None");

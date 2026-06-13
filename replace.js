const fs = require('fs');
let html = fs.readFileSync('app.html', 'utf8');

// Replace old versions with the new one
html = html.replace(/\?v=[A-Za-z0-9_]+/g, '?v=20260607_FULL_27_MODULES_OCC_FIX4');

fs.writeFileSync('app.html', html, 'utf8');
console.log('Updated app.html');

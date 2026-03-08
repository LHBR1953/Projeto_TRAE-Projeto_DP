const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

global.document = {
    getElementById: (id) => html.includes(`id="${id}"`) || html.includes(`id='${id}'`) ? { addEventListener: () => { }, classList: { add: () => { }, remove: () => { } }, style: {}, value: '' } : null,
    querySelector: () => ({ addEventListener: () => { }, classList: { add: () => { }, remove: () => { }, toggle: () => { } }, style: {} }),
};
global.window = {
    innerWidth: 1000,
    addEventListener: () => { }
};
global.localStorage = {
    getItem: () => null,
    setItem: () => { }
};

// Also mock ANY global variable that might correspond to an ID
const ids = [...html.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);
for (const id of ids) {
    if (!global[id]) {
        global[id] = document.getElementById(id);
    }
}

try {
    require('./app.js');
    console.log("SUCCESS: No top-level throw.");
} catch (e) {
    console.log("ERROR THROWN:", e.stack);
}

const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('response', async response => {
        if (response.url().includes('supabase.co')) {
            console.log('SUPABASE RESPONSE:', response.status(), await response.text());
        }
    });

    await page.goto('http://localhost:8080');

    console.log('Page loaded. Clicking Novo Paciente...');
    try {
        await page.click('#btnAddNew');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fill form
        await page.type('#nome', 'Teste Cliente');
        await page.type('#cpf', '11122233344');
        await page.type('#celular', '11999999999');
        await page.type('#endereco', 'Rua Teste');
        await page.type('#numero', '123');
        await page.type('#bairro', 'Bairro Teste');
        await page.type('#cidade', 'Cidade Teste');
        await page.select('#uf', 'SP');

        console.log('Clicking Save...');
        await page.click('#btnSavePatient');

        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
        console.log('Action failed:', err.message);
    }
    await browser.close();
})();

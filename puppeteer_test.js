const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('dialog', async dialog => {
        console.log('DIALOG ALERT:', dialog.message());
        await dialog.dismiss();
    });

    await page.goto('http://localhost:8080');

    console.log('Page loaded. Clicking professionals menu...');
    try {
        await page.click('#navProfessionals');
        console.log('Clicked. Waiting 2s...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
        console.log('Action failed:', err.message);
    }
    await browser.close();
})();

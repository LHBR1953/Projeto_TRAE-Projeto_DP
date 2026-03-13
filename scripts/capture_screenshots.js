const fs = require('fs');
const path = require('path');

function env(name, fallback = '') {
  return (process.env[name] || fallback).toString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    process.stderr.write('Puppeteer não está instalado.\n');
    process.stderr.write('Execute na pasta Projeto_DP:\n');
    process.stderr.write('  npm init -y\n');
    process.stderr.write('  npm i puppeteer\n');
    process.stderr.write('Depois rode:\n');
    process.stderr.write('  node scripts/capture_screenshots.js\n');
    process.exit(1);
  }

  const baseUrl = env('BASE_URL', 'http://127.0.0.1:8282/');
  const outDir = path.resolve(env('OUT_DIR', path.join(__dirname, '..', 'docs', 'manual', 'screenshots')));
  const email = env('USER_EMAIL', '');
  const password = env('USER_PASSWORD', '');

  ensureDir(outDir);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1366, height: 768 }
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(baseUrl, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(outDir, '01-login.png'), fullPage: true });

  const hasCreds = Boolean(email && password);
  if (!hasCreds) {
    process.stdout.write(`OK: screenshots básicos gerados em ${outDir}\n`);
    process.stdout.write('Para gerar telas internas, rode com USER_EMAIL e USER_PASSWORD.\n');
    await browser.close();
    return;
  }

  await page.type('#loginEmail', email, { delay: 10 });
  await page.type('#loginPassword', password, { delay: 10 });
  await Promise.all([
    page.click('#btnLogin'),
    page.waitForSelector('#appContainer', { visible: true })
  ]);

  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '02-menu.png'), fullPage: true });

  const navTargets = [
    { nav: '#navPatients', view: '#patientListView', file: '10-pacientes-lista.png' },
    { nav: '#navProfessionals', view: '#professionalListView', file: '20-profissionais-lista.png' },
    { nav: '#navSpecialties', view: '#specialtiesListView', file: '30-especialidades.png' },
    { nav: '#navServices', view: '#servicesListView', file: '40-servicos.png' },
    { nav: '#navBudgets', view: '#budgetsListView', file: '50-orcamentos-lista.png' },
    { nav: '#navFinanceiro', view: '#financeiroView', file: '70-financeiro.png' },
    { nav: '#navCommissions', view: '#commissionsView', file: '75-comissoes.png' },
    { nav: '#navCancelledBudgets', view: '#cancelledBudgetsView', file: '80-audit-cancelados.png' },
    { nav: '#navUsersAdmin', view: '#usersAdminView', file: '90-gerenciar-equipe.png' },
    { nav: '#navEmpresas', view: '#empresasListView', file: '95-empresas.png' }
  ];

  for (const t of navTargets) {
    const navExists = await page.$(t.nav);
    if (!navExists) continue;

    try {
      await page.click(t.nav);
      await page.waitForSelector(`${t.view}.active, ${t.view}:not(.hidden)`, { timeout: 8000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, t.file), fullPage: true });

      if (t.nav === '#navFinanceiro') {
        const btn = await page.$('#btnNovaTransacao');
        if (btn) {
          await page.click('#btnNovaTransacao');
          await page.waitForSelector('#modalNovaTransacao', { visible: true, timeout: 8000 });
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(outDir, '71-financeiro-novo-lancamento.png'), fullPage: true });
          await page.keyboard.press('Escape');
        }
      }
    } catch (e) {
      process.stdout.write(`WARN: falhou em ${t.nav}: ${e.message}\n`);
    }
  }

  process.stdout.write(`OK: screenshots gerados em ${outDir}\n`);
  await browser.close();
}

main().catch(err => {
  process.stderr.write((err && err.stack) ? err.stack : String(err));
  process.exit(1);
});

/*
 * PONTE DE INTEGRAÇÃO MONOREPO: Projeto_GeradorRelatorios
 * Cria um menu restrito exclusivo para a role 'superadmin' que roteia para o 
 * sistema de relatórios avançado.
 * O roteamento é sensível ao ambiente (localhost vs produção).
 */
function initSuperAdminReportsMenu() {
    // 1. Trava de Segurança Contratual/Acesso: apenas superadmin
    if (typeof isSuperAdmin === 'undefined' || !isSuperAdmin) {
        return;
    }

    if (document.getElementById('navGeradorRelatoriosSuperAdmin')) {
        return;
    }

    // 2. Roteamento Inteligente (Ambientes)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const targetUrl = isLocalhost ? 'http://localhost:3000/' : 'https://seu-gerador.vercel.app/';

    // 3. Comportamento e Design da Interface
    const btn = document.createElement('button');
    btn.id = 'navGeradorRelatoriosSuperAdmin';
    btn.className = 'nav-item';
    btn.style.display = 'flex';
    btn.title = 'Avançado: Gerador de Relatórios';
    // Usando FontAwesome conforme especificado
    btn.innerHTML = `<i class="fa fa-bar-chart" style="margin-right: 8px;"></i> <span>Gerador de Relatórios</span>`;
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(targetUrl, '_blank');
    });

    // Injeta no container de menus administrativos
    const sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar) return;

    // Coloca logo após Auditoria Geral ou no final da sidebar
    const navAuditLog = document.getElementById('navAuditLog');
    if (navAuditLog && navAuditLog.parentNode === sidebar) {
        sidebar.insertBefore(btn, navAuditLog.nextSibling);
    } else {
        sidebar.appendChild(btn);
    }
}

// Monitorador de estado para renderizar e proteger o menu dinamicamente
setInterval(() => {
    const btn = document.getElementById('navGeradorRelatoriosSuperAdmin');
    const isSuper = typeof isSuperAdmin !== 'undefined' && isSuperAdmin;
    
    if (isSuper) {
        if (!btn) {
            initSuperAdminReportsMenu();
        } else {
            btn.style.display = 'flex';
        }
    } else {
        if (btn) {
            btn.style.display = 'none';
        }
    }
}, 1000);
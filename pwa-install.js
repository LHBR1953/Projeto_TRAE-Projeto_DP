(function () {
  const PWA_BUTTON_ID = 'occPwaInstallButton';
  let deferredInstallPrompt = null;

  function isStandaloneMode() {
    return !!(
      window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
    ) || window.navigator.standalone === true;
  }

  function ensureInstallButton() {
    let button = document.getElementById(PWA_BUTTON_ID);
    if (button) return button;

    button = document.createElement('button');
    button.id = PWA_BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Instalar OCC';
    button.setAttribute('aria-label', 'Instalar aplicativo OCC');
    button.style.position = 'fixed';
    button.style.right = '16px';
    button.style.bottom = '16px';
    button.style.zIndex = '10001';
    button.style.display = 'none';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.gap = '8px';
    button.style.padding = '12px 16px';
    button.style.border = '0';
    button.style.borderRadius = '999px';
    button.style.background = '#2563eb';
    button.style.color = '#ffffff';
    button.style.fontFamily = 'Inter, system-ui, sans-serif';
    button.style.fontSize = '14px';
    button.style.fontWeight = '700';
    button.style.boxShadow = '0 10px 24px rgba(37, 99, 235, 0.3)';
    button.style.cursor = 'pointer';
    button.style.maxWidth = 'calc(100vw - 32px)';
    document.body.appendChild(button);
    return button;
  }

  function showInstallButton() {
    if (isStandaloneMode()) return;
    const button = ensureInstallButton();
    button.style.display = 'inline-flex';
  }

  function hideInstallButton() {
    const button = document.getElementById(PWA_BUTTON_ID);
    if (button) {
      button.style.display = 'none';
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      registration.update();
      registration.onupdatefound = function () {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.onstatechange = function () {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        };
      };
    } catch (error) {
      console.warn('Falha ao registrar service worker do OCC:', error);
    }
  }

  function bindInstallButton() {
    const button = ensureInstallButton();
    if (button.__occBound) return;
    button.__occBound = true;

    button.addEventListener('click', async function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (_) {
      }
      deferredInstallPrompt = null;
      hideInstallButton();
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    bindInstallButton();
    showInstallButton();
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    hideInstallButton();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindInstallButton();
    }, { once: true });
    window.addEventListener('load', function () {
      registerServiceWorker();
    }, { once: true });
  } else {
    bindInstallButton();
    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', function () {
        registerServiceWorker();
      }, { once: true });
    }
  }
})();

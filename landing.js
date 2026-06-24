const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const db = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;
let cachedPlanos = [];

function maskCell(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  const ddd = digits.slice(0, 2);
  const part1 = digits.slice(2, 7);
  const part2 = digits.slice(7, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 7) return `(${ddd}) ${part1}`;
  return `(${ddd}) ${part1}-${part2}`;
}

function maskCpf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function lazyLoadHeroVideo() {
  const video = document.getElementById('heroVideo');
  if (!video) return;

  const videosAttr = video.getAttribute('data-videos');
  if (!videosAttr) return;
  
  const videoList = videosAttr.split(',').map(s => s.trim()).filter(Boolean);
  if (videoList.length === 0) return;

  let currentIndex = 0;
  let loopCount = 0;

  const loadAndPlay = () => {
    video.src = videoList[currentIndex];
    video.playbackRate = 0.5; // Reduz a velocidade para 50%
    try { video.load(); } catch { }
    try {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { }
    
    // Controle inicial da visibilidade: Garante que o texto esteja visível no primeiro play
    const heroText = document.querySelector('.lp-hero-inner');
    const heroScrim = document.querySelector('.lp-hero-scrim');
    const heroGlow1 = document.querySelector('.lp-glow');
    const heroGlow2 = document.querySelector('.lp-glow-2');
    
    if (heroText && currentIndex === 0) {
      heroText.style.display = 'grid';
      setTimeout(() => {
        heroText.style.opacity = '1';
        heroText.style.pointerEvents = 'auto';
        if (heroScrim) heroScrim.style.opacity = '1';
        if (heroGlow1) heroGlow1.style.opacity = '0.95';
        if (heroGlow2) heroGlow2.style.opacity = '0.92';
      }, 50);
    }
  };

  const load = () => {
    if (video.__occLoaded) return;
    video.__occLoaded = true;

    video.addEventListener('ended', () => {
      currentIndex++;
      if (currentIndex >= videoList.length) {
        currentIndex = 0; // Volta para o primeiro vídeo
        loopCount++;
      }

      // Lógica de visibilidade do texto da Hero Section
      const heroText = document.querySelector('.lp-hero-inner');
      const heroScrim = document.querySelector('.lp-hero-scrim');
      const heroGlow1 = document.querySelector('.lp-glow');
      const heroGlow2 = document.querySelector('.lp-glow-2');
      
      if (heroText) {
        // Exibe o texto sempre que for o primeiro vídeo
        if (currentIndex === 0) {
          heroText.style.display = 'grid'; // Retorna ao fluxo normal
          // Pequeno atraso para a transição de opacidade funcionar após o display
          setTimeout(() => {
            heroText.style.opacity = '1';
            heroText.style.pointerEvents = 'auto';
            if (heroScrim) heroScrim.style.opacity = '1';
            if (heroGlow1) heroGlow1.style.opacity = '0.95';
            if (heroGlow2) heroGlow2.style.opacity = '0.92';
          }, 50);
          
          // AQUI É O PONTO CORRETO DO AUTO-SCROLL: Quando voltamos ao índice 0!
          // Inicia o auto-scroll (vitrine) EXATAMENTE após o segundo vídeo (quando dá o primeiro loop)
          if (loopCount === 1) {
            console.log("Transição após o 2º vídeo detectada! Iniciando vitrine...");
            if (typeof window.startAutoScroll === 'function') {
              console.log("Preparando AutoScroll...");
              // Delay um pouco maior para garantir que tudo foi renderizado
              setTimeout(() => {
                console.log("Chamando window.startAutoScroll()...");
                window.startAutoScroll();
              }, 600);
            } else {
              console.error("ERRO: window.startAutoScroll não é uma função!");
            }
          }

        } else {
          heroText.style.opacity = '0';
          heroText.style.pointerEvents = 'none';
          if (heroScrim) heroScrim.style.opacity = '0';
          if (heroGlow1) heroGlow1.style.opacity = '0';
          if (heroGlow2) heroGlow2.style.opacity = '0';
          
          // Remove o elemento do fluxo após a transição de opacidade (0.5s) para que o conteúdo abaixo suba
          setTimeout(() => {
            if (currentIndex !== 0) { // Garante que não mudou de ideia no meio tempo
              heroText.style.display = 'none';
            }
          }, 500);
        }
      }

      loadAndPlay();
    });

    video.addEventListener('error', () => {
      console.error('Erro ao carregar o vídeo:', videoList[currentIndex]);
      currentIndex++;
      if (currentIndex >= videoList.length) {
        currentIndex = 0;
      }
      // Tenta o próximo vídeo após uma breve pausa para evitar loop infinito
      setTimeout(loadAndPlay, 1000);
    });

    loadAndPlay();
  };

  const start = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(load, { timeout: 1400 });
    } else {
      setTimeout(load, 260);
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: '200px' });
    io.observe(video);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
}

function initTrialModal() {
  const backdrop = document.getElementById('trialModalBackdrop');
  const btnOpen = document.getElementById('btnOpenTrial');
  const btnOpen2 = document.getElementById('btnOpenTrial2');
  const btnClose = document.getElementById('btnCloseTrial');
  const form = document.getElementById('trialForm');
  const inputCell = document.getElementById('trialCell');
  const btnSubmit = document.getElementById('btnSubmitTrial');
  const boxErr = document.getElementById('trialError');
  const boxOk = document.getElementById('trialResult');
  const progressWrap = document.getElementById('trialProgressWrap');
  const progressBar = document.getElementById('trialProgressBar');
  const progressText = document.getElementById('trialProgressText');
  const termsBox = document.getElementById('occTermosBox');
  const chkTerms = document.getElementById('chk_termos_occ');
  let progressTimer = null;

  if (!backdrop || !btnOpen || !btnClose || !form) return;

  if (termsBox && chkTerms) {
    termsBox.addEventListener('scroll', () => {
      if (termsBox.scrollTop + termsBox.clientHeight >= termsBox.scrollHeight - 5) {
        chkTerms.disabled = false;
      }
    });
  }

  const open = (selectedPlan = '') => {
    backdrop.style.display = 'flex';
    if (boxErr) boxErr.style.display = 'none';
    if (boxOk) boxOk.style.display = 'none';
    
    if (chkTerms) {
      chkTerms.checked = false;
      chkTerms.disabled = true;
    }
    if (termsBox) {
      termsBox.scrollTop = 0;
    }

    const planEl = document.getElementById('trialPlan');
    if (planEl && selectedPlan) planEl.value = String(selectedPlan);
    
    const modalTitle = document.getElementById('trialModalTitle');
    if (modalTitle) {
      const isTrial = selectedPlan.toUpperCase() === 'TRIAL' || selectedPlan.toUpperCase() === 'TRAIL';
      modalTitle.textContent = isTrial ? 'Criar clínica e testar por 30 dias' : 'Criar clínica';
    }

    const first = document.getElementById('trialClinicName');
    if (first) first.focus();
  };
  const close = () => { backdrop.style.display = 'none'; };

  btnOpen.addEventListener('click', () => open(''));
  if (btnOpen2) btnOpen2.addEventListener('click', () => open(''));
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.style.display === 'flex') close();
  });

  if (inputCell) {
    inputCell.addEventListener('input', (e) => {
      e.target.value = maskCell(e.target.value);
    });
  }

  const setErr = (msg) => {
    if (!boxErr) return;
    boxErr.textContent = String(msg || 'Erro desconhecido');
    boxErr.style.display = 'block';
  };
  const setOk = (msg) => {
    if (!boxOk) return;
    boxOk.textContent = String(msg || '');
    boxOk.style.display = 'block';
  };
  const setProgress = (pct, text) => {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = `${p}%`;
    if (progressText) progressText.textContent = String(text || 'Processando...');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!db) {
      setErr('Não foi possível conectar ao servidor. Verifique internet/bloqueio de CDN e tente novamente.');
      return;
    }
    if (chkTerms && !chkTerms.checked) {
      setErr('Você precisa rolar a caixa de texto até o final e concordar com os Termos de Assinatura.');
      return;
    }
    const prevBtnText = btnSubmit ? String(btnSubmit.textContent || '') : '';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Criando...';
    }
    setProgress(6, 'Iniciando cadastro...');
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      const current = progressBar ? Number(String(progressBar.style.width || '0').replace('%', '')) : 0;
      if (current >= 90) return;
      setProgress(current + 2, 'Processando cadastro da clínica...');
    }, 350);
    if (boxErr) boxErr.style.display = 'none';
    if (boxOk) boxOk.style.display = 'none';

    const nome = String((document.getElementById('trialClinicName') || {}).value || '').trim();
    const email = String((document.getElementById('trialEmail') || {}).value || '').trim().toLowerCase();
    const celular = String((document.getElementById('trialCell') || {}).value || '').trim();
    const planoTipo = String((document.getElementById('trialPlan') || {}).value || '').trim();
    const password = String((document.getElementById('trialPassword') || {}).value || '');

    if (!nome || !email || !password || !planoTipo) {
      setErr('Preencha os campos obrigatórios.');
      if (btnSubmit) btnSubmit.disabled = false;
      return;
    }

    try {
      let signedIn = false;
      setProgress(18, 'Validando acesso...');
      const signUp = await db.auth.signUp({ email, password });
      if (signUp.error) {
        const signIn = await db.auth.signInWithPassword({ email, password });
        if (signIn.error) throw signIn.error;
        signedIn = true;
      } else {
        signedIn = Boolean(signUp.data && signUp.data.session);
        if (!signedIn) {
          const signIn = await db.auth.signInWithPassword({ email, password });
          if (signIn.error) throw signIn.error;
          signedIn = true;
        }
      }

      if (!signedIn) throw new Error('Não foi possível iniciar sessão. Verifique o e-mail.');

      setProgress(55, 'Configurando clínica e plano...');
      const { data, error } = await db.functions.invoke('self-onboard-company', {
        body: { nome, email, celular: celular || null, plano_tipo: planoTipo, tipo_assinatura: planoTipo }
      });
      if (error) throw error;
      setProgress(95, 'Finalizando e liberando acesso...');
      const empresaId = data && data.empresa_id ? String(data.empresa_id) : '';
      const status = String(data && data.assinatura_status || '').toUpperCase();
      if (status === 'TRIAL') {
        setOk(`Clínica criada com sucesso.\nEmpresa: ${empresaId || '—'}\nEntrando no OCC...`);
        if (btnSubmit) btnSubmit.textContent = 'Entrando...';
        setTimeout(() => {
          setProgress(100, 'Acesso liberado. Redirecionando...');
          try { backdrop.style.display = 'none'; } catch { }
          window.location.assign('/app.html');
        }, 600);
      } else {
        setProgress(100, 'Pedido recebido.');
        setOk(`Recebemos seu pedido para o ${planoTipo}!\nEstamos aguardando a confirmação do pagamento para liberar seu acesso.`);
        try { await db.auth.signOut(); } catch { }
      }
    } catch (err) {
      let msg = err && err.message ? String(err.message) : 'Falha ao criar o trial.';
      try {
        const ctx = err && err.context ? err.context : null;
        if (ctx && typeof ctx.json === 'function') {
          const j = await ctx.json();
          if (j && (j.error || j.message)) msg = String(j.error || j.message);
        } else if (ctx && typeof ctx.text === 'function') {
          const raw = await ctx.text();
          if (raw) {
            const j = JSON.parse(raw);
            if (j && (j.error || j.message)) msg = String(j.error || j.message);
          }
        }
      } catch { }
      setErr(msg);
    } finally {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = prevBtnText || 'Criar e Entrar';
      }
      if (progressWrap && (!boxOk || boxOk.style.display !== 'block')) progressWrap.style.display = 'none';
    }
  });

  window.__openTrialModalWithPlan = (plan) => open(String(plan || ''));
}

function splitModulesText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n|;|\||,/g)
    .map(x => String(x || '').trim())
    .filter(Boolean);
}

function renderPlanosCards(planos) {
  const container = document.getElementById('plansContainer');
  const trialPlan = document.getElementById('trialPlan');
  if (!container || !trialPlan) return;
  const list = Array.isArray(planos) ? planos : [];
  trialPlan.innerHTML = '<option value="">Selecione um plano</option>';

  if (!list.length) {
    container.innerHTML = `
      <div class="lp-plan">
        <h3>Sem planos configurados</h3>
        <div class="lp-price">--</div>
        <ul><li>Consulte o administrador do sistema.</li></ul>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(p => {
    const tipo = String(p && p.tipo_assinatura || '').trim() || 'Plano';
    const legenda = String(p && p.legenda_comercial || '').trim();
    const legendaHtml = legenda ? `<div style="font-size: 0.95rem; color: #64748b; font-weight: 500; margin-top: 4px; margin-bottom: 12px; text-align: left;">${legenda}</div>` : '';
    const valor = String(p && p.valor_plano || '').trim() || '-';
    const modulos = splitModulesText(p && p.modulos_texto);
    const itens = modulos.length ? modulos : ['Plano OCC'];
    const destaque = !!(p && p.destaque);
    const border = destaque ? 'border-color:#1d4ed8; box-shadow: 0 20px 72px rgba(29,78,216,0.20);' : '';
    return `
      <div class="lp-plan" style="${border}">
        <h3>${tipo}</h3>
        ${legendaHtml}
        <div class="lp-price">${valor}</div>
        <ul>${itens.map(i => `<li>${i}</li>`).join('')}</ul>
        <div style="margin-top:14px;">
          <button type="button" class="lp-btn lp-btn-primary js-plan-signup" data-plan="${tipo}" style="width:100%;">Assinar</button>
        </div>
      </div>
    `;
  }).join('');

  trialPlan.innerHTML += list.map(p => {
    const tipo = String(p && p.tipo_assinatura || '').trim();
    return `<option value="${tipo}">${tipo}</option>`;
  }).join('');

  container.querySelectorAll('.js-plan-signup').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = String(btn.getAttribute('data-plan') || '').trim();
      if (typeof window.__openTrialModalWithPlan === 'function') {
        window.__openTrialModalWithPlan(plan);
      }
    });
  });
}

async function loadPlanosConfig() {
  if (!db) return;
  try {
    const { data, error } = await db
      .from('config_planos')
      .select('id,tipo_assinatura,legenda_comercial,valor_plano,modulos_texto,destaque')
      .order('destaque', { ascending: false })
      .order('tipo_assinatura', { ascending: true });
    if (error) throw error;
    cachedPlanos = Array.isArray(data) ? data : [];
    renderPlanosCards(cachedPlanos);
  } catch {
    renderPlanosCards([]);
  }
}

function initAccessModal() {
  const backdrop = document.getElementById('accessModalBackdrop');
  const btnOpen = document.getElementById('btnPatientPortal');
  const btnClose = document.getElementById('btnCloseAccess');
  const btnBack = document.getElementById('btnBackAccess');
  const btnVerify = document.getElementById('btnVerifyAccess');
  const form = document.getElementById('accessForm');
  const inputCpf = document.getElementById('accessCpf');
  const inputPhone = document.getElementById('accessPhone');
  const inputToken = document.getElementById('accessToken');
  
  const step1 = document.getElementById('step1Access');
  const step2 = document.getElementById('step2Access');

  let generatedToken = '';

  if (!backdrop || !btnOpen || !btnClose || !form || !inputCpf) return;

  const open = () => {
    backdrop.style.display = 'flex';
    inputCpf.value = '';
    if (inputPhone) inputPhone.value = '';
    if (inputToken) inputToken.value = '';
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    setTimeout(() => inputCpf.focus(), 50);
  };
  const close = () => { backdrop.style.display = 'none'; };

  btnOpen.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.style.display === 'flex') close();
  });

  inputCpf.addEventListener('input', (e) => {
    e.target.value = maskCpf(e.target.value);
  });
  
  if (inputPhone) {
    inputPhone.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
      e.target.value = v;
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cleanCpf = inputCpf.value.replace(/\D/g, '');
    const cleanPhone = inputPhone ? inputPhone.value.replace(/\D/g, '') : '';
    
    if (cleanCpf.length !== 11) {
      alert('Por favor, informe um CPF válido.');
      return;
    }
    if (cleanPhone.length < 10) {
      alert('Por favor, informe um telefone válido.');
      return;
    }
    
    // Simulate Token Generation and WhatsApp sending
    generatedToken = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Token de Acesso Gerado:", generatedToken);
    alert(`[Simulação] Um token de acesso foi enviado para o WhatsApp ${inputPhone.value}.\n\nToken para teste: ${generatedToken}`);
    
    step1.style.display = 'none';
    step2.style.display = 'block';
    setTimeout(() => inputToken.focus(), 50);
  });

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
    });
  }

  if (btnVerify) {
    btnVerify.addEventListener('click', () => {
      const token = inputToken.value.trim();
      if (token !== generatedToken) {
        alert('Token inválido. Tente novamente.');
        return;
      }
      const cleanCpf = inputCpf.value.replace(/\D/g, '');
      window.location.href = `/app.html?mode=patient&id=${cleanCpf}&token=${token}`;
    });
  }
}

lazyLoadHeroVideo();
initTrialModal();
initAccessModal();
loadPlanosConfig();

function initNavLinks() {
  const anchors = Array.from(document.querySelectorAll('a[href^="#"]'));
  anchors.forEach(a => {
    a.addEventListener('click', (e) => {
      const href = String(a.getAttribute('href') || '');
      const id = href.replace(/^#/, '');
      const target = document.getElementById(id);
      if (!id || !target) return;
      e.preventDefault();
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        location.hash = href;
      }
    });
  });
}

initNavLinks();

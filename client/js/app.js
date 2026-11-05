/**
 * 🗄️ Gavet — Controlador Principal da Aplicação
 * Caminho: js/app.js
 * Arquitetura: Offline-First PWA, Mobile-First Luxury Vault
 */

import {
  calculateDocumentExpiration,
  getUrgentAlerts,
  calculateFinancialMetrics
} from './alerts.js';

import {
  getDB,
  saveDocument,
  getAllDocuments,
  getDocumentById,
  deleteDocument,
  getUnsyncedDocuments,
  markDocumentSynced,
  seedIfEmpty,
  clearAllDocuments,
  importDocuments
} from './db.js';

import {
  sendFileToGemini,
  syncWithServer,
  apiRegister,
  apiLogin,
  apiGetMe,
  fetchServerDocuments
} from './api.js';

import {
  loginWithGoogle,
  checkOAuthCallback,
  deleteAccountApi
} from './supabase.js';

import {
  renderUrgencyRadar,
  renderDocumentsList,
  updateMetrics,
  updateProfileStats,
  updateConnectionStatus,
  setModalMode,
  populateModalForm,
  setupCurrencyMask,
  parseBRLInput,
  setAiLoadingState,
  showToast,
  updateExpirationPreview,
  updateTermChips
} from './ui.js';

/**
 * Lê a sessão de autenticação do usuário
 */
function getStoredAuth() {
  try {
    const token = localStorage.getItem('gavet_token') || null;
    const userRaw = localStorage.getItem('gavet_user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token, user };
  } catch (e) {
    return { token: null, user: null };
  }
}

/**
 * Lê o perfil do usuário armazenado no localStorage
 */
function getStoredProfile() {
  try {
    const raw = localStorage.getItem('gavet_profile');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Falha ao ler perfil local:', e);
  }
  return {
    name: 'Usuário Gavet',
    email: 'usuario@gavet.app',
    avatar: 'BC'
  };
}

// Estado global da aplicação
let appState = {
  documents: [],
  currentFilter: 'todos',
  currentView: 'vault',
  theme: localStorage.getItem('gavet_theme') || 'dark',
  radarDays: parseInt(localStorage.getItem('gavet_radar_days') || '30', 10),
  profile: getStoredProfile(),
  auth: getStoredAuth(),
  isOnline: navigator.onLine
};

/**
 * Dados de demonstração para semeadura inicial
 */
const DEMO_ITEMS = [
  {
    id: 'demo_iphone_15_pro',
    loja: 'Apple Morumbi Shopping',
    valor: 7299.00,
    data_compra: new Date(Date.now() - 362 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // vence em ~3 dias
    meses_garantia: 12,
    tipo_documento: 'garantia',
    synced: 1,
    createdAt: new Date(Date.now() - 362 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo_netflix_premium',
    loja: 'Netflix 4K Premium',
    valor: 55.90,
    data_compra: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // renova em 15 dias
    meses_garantia: 1,
    tipo_documento: 'assinatura',
    synced: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo_chair_herman_miller',
    loja: 'Herman Miller Brasil',
    valor: 6450.00,
    data_compra: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    meses_garantia: 60,
    tipo_documento: 'garantia',
    synced: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo_amazon_prime',
    loja: 'Amazon Prime Video',
    valor: 19.90,
    data_compra: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // renova em 5 dias
    meses_garantia: 1,
    tipo_documento: 'assinatura',
    synced: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo_smart_tv_samsung',
    loja: 'Fast Shop S.A.',
    valor: 3499.00,
    data_compra: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    meses_garantia: 12,
    tipo_documento: 'nota_fiscal',
    synced: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/**
 * Inicialização do App
 */
async function initApp() {
  console.log('💎 Gavet — Bespoke Architecture Initialized.');

  // Registro do Service Worker para suporte PWA offline
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => console.log('[PWA] Service Worker registrado:', reg.scope))
        .catch((err) => console.warn('[PWA] Falha ao registrar SW:', err));
    });
  }

  updateConnectionStatus(navigator.onLine);
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);

  // Inicializa tema salvo
  initTheme();

  // Inicializa banco de dados IndexedDB
  try {
    await getDB();
    appState.documents = await seedIfEmpty(DEMO_ITEMS);
  } catch (err) {
    console.error('Falha ao inicializar IndexedDB:', err);
    showToast('Erro ao acessar base local IndexedDB', 'danger');
  }

  // Verifica se o usuário retornou de um redirecionamento OAuth com o Google
  try {
    const oauthSession = await checkOAuthCallback();
    if (oauthSession) {
      appState.auth = {
        token: oauthSession.token,
        user: oauthSession.user
      };
      appState.profile = {
        name: oauthSession.user.name,
        email: oauthSession.user.email,
        avatar: oauthSession.user.avatar
      };

      localStorage.setItem('gavet_token', oauthSession.token);
      localStorage.setItem('gavet_user', JSON.stringify(oauthSession.user));
      localStorage.setItem('gavet_profile', JSON.stringify(appState.profile));

      populateProfileForm();
      updateAuthUI();
      showToast(`Bem-vindo, ${oauthSession.user.name}!`, 'success');
      await syncPullFromServer();
    } else if (appState.auth && appState.auth.token) {
      // Valida se a sessão existente continua ativa no backend
      if (navigator.onLine) {
        const validatedUser = await apiGetMe(appState.auth.token);
        if (validatedUser) {
          appState.auth.user = validatedUser;
          localStorage.setItem('gavet_user', JSON.stringify(validatedUser));
          await syncPullFromServer();
        } else {
          console.warn('[Auth] Sessão anterior expirada.');
          localStorage.removeItem('gavet_token');
          localStorage.removeItem('gavet_user');
          appState.auth = null;
        }
      }
    }
  } catch (err) {
    console.warn('[OAuth] Verificação falhou:', err);
  }

  // Preenche dados do perfil na UI
  populateProfileForm();
  updateAuthUI();

  // Inicializa seletor de dias do radar
  const selectRadarDays = document.getElementById('setting-radar-days');
  if (selectRadarDays) {
    selectRadarDays.value = String(appState.radarDays);
  }

  // Configura máscara de Real BRL com vírgula automática
  const inputValor = document.getElementById('doc-valor');
  if (inputValor) {
    setupCurrencyMask(inputValor);
  }

  setupEventListeners();
  refreshUI();
  triggerBackgroundSync();

  // Exibe a tela de login de primeira se o usuário não possuir sessão ativa
  if (!appState.auth || !appState.auth.token) {
    openAuthModal('login');
  }
}

/**
 * Atualiza todas as camadas de renderização da UI
 */
function refreshUI() {
  const enrichedDocs = appState.documents.map(calculateDocumentExpiration);
  const urgentAlerts = getUrgentAlerts(enrichedDocs, appState.radarDays);

  renderUrgencyRadar(urgentAlerts, handleOpenEditModal);
  updateMetrics(enrichedDocs);
  updateProfileStats(enrichedDocs, urgentAlerts.length);
  renderDocumentsList(
    enrichedDocs,
    appState.currentFilter,
    handleDeleteDocument,
    handleOpenEditModal
  );
}

/**
 * Aplica o tema visual selecionado (dark, light, cyberpunk)
 */
function applyTheme(themeName, notify = false) {
  const validThemes = ['dark', 'light', 'cyberpunk'];
  const theme = validThemes.includes(themeName) ? themeName : 'dark';

  appState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gavet_theme', theme);

  // Atualiza meta tag theme-color no topo do navegador / PWA
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    if (theme === 'light') metaTheme.setAttribute('content', '#F4F6F9');
    else if (theme === 'cyberpunk') metaTheme.setAttribute('content', '#090514');
    else metaTheme.setAttribute('content', '#08090C');
  }

  // Atualiza rádios e visual dos cards de tema
  const themeRadios = document.querySelectorAll('input[name="app_theme"]');
  themeRadios.forEach(r => {
    r.checked = (r.value === theme);
  });

  const themeCards = document.querySelectorAll('.theme-card-option');
  themeCards.forEach(c => {
    c.classList.toggle('active', c.dataset.themeValue === theme);
  });

  // Atualiza botões rápidos de tema no drawer
  const quickThemeBtns = document.querySelectorAll('.quick-theme-btn');
  quickThemeBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.themeSet === theme);
  });

  if (notify) {
    const labels = {
      dark: 'Obsidian Escuro',
      light: 'Clean Claro',
      cyberpunk: 'Cyber Neon'
    };
    showToast(`Tema alterado para ${labels[theme]}`, 'info');
  }
}

function initTheme() {
  applyTheme(appState.theme, false);
}

/**
 * Alterna entre as abas principais (vault, settings, profile)
 */
function switchView(viewName) {
  const validViews = ['vault', 'settings', 'profile'];
  const target = validViews.includes(viewName) ? viewName : 'vault';

  appState.currentView = target;

  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('active');
  });

  const targetEl = document.getElementById(`view-${target}`);
  if (targetEl) {
    targetEl.classList.remove('hidden');
    targetEl.classList.add('active');
  }

  // Atualiza indicadores de menu ativo
  document.querySelectorAll('.drawer-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.navigate === target);
  });

  const drawerUserCard = document.getElementById('drawer-user-trigger');
  if (drawerUserCard) {
    drawerUserCard.classList.toggle('active', target === 'profile');
  }

  closeDrawer();

  if (target === 'profile') {
    populateProfileForm();
    const enrichedDocs = appState.documents.map(calculateDocumentExpiration);
    const urgentAlerts = getUrgentAlerts(enrichedDocs, appState.radarDays);
    updateProfileStats(enrichedDocs, urgentAlerts.length);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Controles do Menu Hambúrguer / Drawer Lateral
 */
function openDrawer() {
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const hamburger = document.getElementById('btn-hamburger');

  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (backdrop) {
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
  }
  if (hamburger) {
    hamburger.classList.add('is-active');
    hamburger.setAttribute('aria-expanded', 'true');
  }
}

function closeDrawer() {
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const hamburger = document.getElementById('btn-hamburger');

  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (backdrop) {
    backdrop.classList.add('hidden');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  if (hamburger) {
    hamburger.classList.remove('is-active');
    hamburger.setAttribute('aria-expanded', 'false');
  }
}

function toggleDrawer() {
  const drawer = document.getElementById('nav-drawer');
  if (drawer && drawer.classList.contains('open')) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

function getProfileInitials() {
  const name = appState.profile?.name || '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return 'G';
}

function renderAvatarElement(el, avatarVal) {
  if (!el) return;
  const initials = getProfileInitials();
  if (avatarVal && (avatarVal.startsWith('http') || avatarVal.startsWith('data:'))) {
    el.innerHTML = `<img src="${avatarVal}" alt="" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.onerror=null; this.parentElement.textContent='${initials}';" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50% !important; display: block;">`;
  } else {
    el.textContent = avatarVal || initials;
  }
}

/**
 * Sincroniza dados do perfil nos múltiplos elementos da interface
 */
function populateProfileForm() {
  const p = appState.profile;

  // Header avatar
  const headerAvatar = document.getElementById('header-avatar-initials');
  renderAvatarElement(headerAvatar, p.avatar);

  // Drawer
  const drawerAvatar = document.getElementById('drawer-user-avatar');
  const drawerName = document.getElementById('drawer-user-name');
  const drawerEmail = document.getElementById('drawer-user-email');
  renderAvatarElement(drawerAvatar, p.avatar);
  if (drawerName) drawerName.textContent = p.name || 'Usuário Gavet';
  if (drawerEmail) drawerEmail.textContent = p.email || 'usuario@gavet.app';

  // View Perfil
  const profileAvatar = document.getElementById('profile-avatar-display');
  const profileName = document.getElementById('profile-name-display');
  const profileEmail = document.getElementById('profile-email-display');
  renderAvatarElement(profileAvatar, p.avatar);
  if (profileName) profileName.textContent = p.name || 'Usuário Gavet';
  if (profileEmail) profileEmail.textContent = p.email || 'usuario@gavet.app';

  // Campos do Formulário
  const inputName = document.getElementById('input-profile-name');
  if (inputName) inputName.value = p.name || '';
}

function handleSaveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('input-profile-name')?.value.trim();
  if (!name) {
    showToast('Informe seu nome ou apelido.', 'warning');
    return;
  }

  appState.profile.name = name;

  // Se avatar for iniciais textuais, recalcula
  if (!appState.profile.avatar || appState.profile.avatar.length <= 2) {
    const parts = name.split(/\s+/);
    appState.profile.avatar = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  localStorage.setItem('gavet_profile', JSON.stringify(appState.profile));
  populateProfileForm();
  showToast('Perfil atualizado com sucesso!', 'success');
}

function handleSelectAvatar(avatarVal) {
  if (avatarVal === 'initials') {
    const name = appState.profile.name || 'Usuário Gavet';
    const parts = name.trim().split(/\s+/);
    appState.profile.avatar = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  } else {
    appState.profile.avatar = avatarVal;
  }

  localStorage.setItem('gavet_profile', JSON.stringify(appState.profile));
  populateProfileForm();

  const dock = document.getElementById('avatar-picker-dock');
  if (dock) dock.classList.add('hidden');
  showToast('Avatar alterado!', 'info');
}

/**
 * Abre o Modal/Tela de Autenticação (Login / Cadastro)
 */
function openAuthModal(defaultTab = 'login') {
  const modal = document.getElementById('auth-screen');
  const btnClose = document.getElementById('btn-close-auth');
  if (!modal) return;

  switchAuthTab(defaultTab);
  clearAuthFeedback();
  modal.classList.remove('hidden');

  if (btnClose) {
    if (appState.auth && appState.auth.token) {
      btnClose.classList.remove('hidden');
    } else {
      btnClose.classList.add('hidden');
    }
  }
}

/**
 * Fecha a tela de autenticação (bloqueado se não autenticado)
 */
function closeAuthModal() {
  if (!appState.auth || !appState.auth.token) {
    showToast('Por favor, faça login ou crie sua conta para acessar o Gavet.', 'warning');
    return;
  }
  const modal = document.getElementById('auth-screen');
  if (modal) modal.classList.add('hidden');
}

/**
 * Alterna entre a aba de login e cadastro
 */
function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  const contentLogin = document.getElementById('tab-content-login');
  const contentRegister = document.getElementById('tab-content-register');

  clearAuthFeedback();

  if (tab === 'register') {
    tabRegister?.classList.add('active');
    tabRegister?.setAttribute('aria-selected', 'true');
    tabLogin?.classList.remove('active');
    tabLogin?.setAttribute('aria-selected', 'false');

    contentRegister?.classList.remove('hidden');
    contentLogin?.classList.add('hidden');
  } else {
    tabLogin?.classList.add('active');
    tabLogin?.setAttribute('aria-selected', 'true');
    tabRegister?.classList.remove('active');
    tabRegister?.setAttribute('aria-selected', 'false');

    contentLogin?.classList.remove('hidden');
    contentRegister?.classList.add('hidden');
  }
}

function showAuthFeedback(msg, type = 'error') {
  const banner = document.getElementById('auth-feedback');
  if (!banner) return;
  banner.textContent = msg;
  banner.className = `auth-feedback-banner ${type}`;
  banner.classList.remove('hidden');
}

function clearAuthFeedback() {
  const banner = document.getElementById('auth-feedback');
  if (banner) {
    banner.textContent = '';
    banner.className = 'auth-feedback-banner hidden';
  }
}

/**
 * Avalia força da senha para o formulário de cadastro
 */
function evaluatePasswordStrength(password) {
  let score = 0;
  if (!password) return score;
  if (password.length >= 6) score++;
  if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (password.length >= 10 && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function updatePasswordStrengthUI(password) {
  const score = evaluatePasswordStrength(password);
  const bar1 = document.getElementById('str-bar-1');
  const bar2 = document.getElementById('str-bar-2');
  const bar3 = document.getElementById('str-bar-3');
  const label = document.getElementById('strength-label');

  const neutral = 'var(--border-medium)';
  const red = '#EF4444';
  const yellow = '#F59E0B';
  const green = 'var(--accent-mint)';

  if (!bar1 || !bar2 || !bar3 || !label) return;

  if (score === 0) {
    bar1.style.backgroundColor = neutral;
    bar2.style.backgroundColor = neutral;
    bar3.style.backgroundColor = neutral;
    label.textContent = 'Mínimo 6 chars';
    label.style.color = 'var(--text-muted)';
  } else if (score === 1) {
    bar1.style.backgroundColor = red;
    bar2.style.backgroundColor = neutral;
    bar3.style.backgroundColor = neutral;
    label.textContent = 'Fraca';
    label.style.color = red;
  } else if (score === 2) {
    bar1.style.backgroundColor = yellow;
    bar2.style.backgroundColor = yellow;
    bar3.style.backgroundColor = neutral;
    label.textContent = 'Média';
    label.style.color = yellow;
  } else {
    bar1.style.backgroundColor = green;
    bar2.style.backgroundColor = green;
    bar3.style.backgroundColor = green;
    label.textContent = 'Forte';
    label.style.color = green;
  }
}

/**
 * Submissão do Formulário de Login
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthFeedback();

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('btn-submit-login');

  const email = emailInput?.value.trim() || '';
  const password = passwordInput?.value || '';

  if (!email || !password) {
    showAuthFeedback('Por favor, informe seu e-mail e senha.');
    return;
  }

  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-text">Autenticando...</span>';
  }

  try {
    const data = await apiLogin({ email, password });
    
    appState.auth = {
      token: data.token,
      user: data.user
    };
    appState.profile = {
      name: data.user.name,
      email: data.user.email,
      avatar: data.user.avatar || 'BC'
    };

    localStorage.setItem('gavet_token', data.token);
    localStorage.setItem('gavet_user', JSON.stringify(data.user));
    localStorage.setItem('gavet_profile', JSON.stringify(appState.profile));

    populateProfileForm();
    updateAuthUI();
    closeAuthModal();
    showToast(`Bem-vindo de volta, ${data.user.name}!`, 'success');
    await syncPullFromServer();
    await triggerBackgroundSync();
  } catch (err) {
    showAuthFeedback(err.message || 'Falha ao autenticar.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

/**
 * Submissão do Formulário de Cadastro
 */
async function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthFeedback();

  const nameInput = document.getElementById('register-name');
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  const confirmInput = document.getElementById('register-password-confirm');
  const submitBtn = document.getElementById('btn-submit-register');

  const name = nameInput?.value.trim() || '';
  const email = emailInput?.value.trim() || '';
  const password = passwordInput?.value || '';
  const confirm = confirmInput?.value || '';

  if (!name || name.length < 2) {
    showAuthFeedback('O nome deve conter ao menos 2 caracteres.');
    return;
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    showAuthFeedback('Por favor, insira um e-mail válido.');
    return;
  }
  if (!password || password.length < 6) {
    showAuthFeedback('A senha deve conter ao menos 6 caracteres.');
    return;
  }
  if (password !== confirm) {
    showAuthFeedback('As senhas digitadas não coincidem.');
    return;
  }

  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-text">Criando conta...</span>';
  }

  try {
    const data = await apiRegister({ name, email, password });

    appState.auth = {
      token: data.token,
      user: data.user
    };
    appState.profile = {
      name: data.user.name,
      email: data.user.email,
      avatar: data.user.avatar || 'BC'
    };

    localStorage.setItem('gavet_token', data.token);
    localStorage.setItem('gavet_user', JSON.stringify(data.user));
    localStorage.setItem('gavet_profile', JSON.stringify(appState.profile));

    populateProfileForm();
    updateAuthUI();
    closeAuthModal();
    showToast(`Conta criada com sucesso! Olá, ${data.user.name}!`, 'success');
    await triggerBackgroundSync();
    await syncPullFromServer();
  } catch (err) {
    showAuthFeedback(err.message || 'Erro ao cadastrar conta.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

/**
 * Realiza logout da conta
 */
async function handleLogout() {
  localStorage.removeItem('gavet_token');
  localStorage.removeItem('gavet_user');
  
  appState.auth = { token: null, user: null };
  appState.profile = {
    name: 'Usuário Gavet',
    email: 'usuario@gavet.app',
    avatar: 'BC'
  };
  localStorage.setItem('gavet_profile', JSON.stringify(appState.profile));

  // Restaura dados iniciais e limpa vault do usuário logado
  try {
    await clearAllDocuments();
    appState.documents = await seedIfEmpty(DEMO_ITEMS);
    refreshUI();
  } catch (err) {
    console.warn('[Logout] Erro ao redefinir base local:', err);
  }

  populateProfileForm();
  updateAuthUI();
  showToast('Você saiu da sua conta.', 'info');
  openAuthModal('login');
}

/**
 * Sincroniza indicadores visuais da sessão na interface
 */
function updateAuthUI() {
  const isLoggedIn = Boolean(appState.auth && appState.auth.token);
  const user = appState.auth?.user;

  // Drawer Auth Action Button
  const drawerAuthTitle = document.getElementById('drawer-auth-action-title');
  const drawerAuthSub = document.getElementById('drawer-auth-action-sub');
  if (drawerAuthTitle && drawerAuthSub) {
    if (isLoggedIn) {
      drawerAuthTitle.textContent = 'Sair da Conta';
      drawerAuthSub.textContent = user?.email || 'Encerrar sessão';
    } else {
      drawerAuthTitle.textContent = 'Entrar / Cadastrar';
      drawerAuthSub.textContent = 'Sincronize seus dados';
    }
  }

  // Profile View: Badge e Descrição de Sessão
  const sessionDesc = document.getElementById('account-session-desc');
  const btnOpenAuthLabel = document.getElementById('btn-open-auth-profile-label');
  const btnLogoutProfile = document.getElementById('btn-logout-profile');

  if (sessionDesc) {
    sessionDesc.textContent = isLoggedIn
      ? `Conectado como ${user?.email || appState.profile.email}`
      : 'Modo offline local ativo. Entre para sincronizar.';
  }

  if (btnOpenAuthLabel) {
    btnOpenAuthLabel.textContent = isLoggedIn ? 'Trocar de Conta' : 'Entrar ou Criar Conta';
  }

  if (btnLogoutProfile) {
    btnLogoutProfile.style.display = isLoggedIn ? 'flex' : 'none';
  }

  const btnDeleteAccount = document.getElementById('btn-delete-account');
  if (btnDeleteAccount) {
    btnDeleteAccount.style.display = isLoggedIn ? 'flex' : 'none';
  }
}

/**
 * Abre o modal de confirmação para deletar a conta
 */
function openDeleteAccountModal() {
  const modal = document.getElementById('modal-delete-account');
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }
}

/**
 * Fecha o modal de confirmação para deletar a conta
 */
function closeDeleteAccountModal() {
  const modal = document.getElementById('modal-delete-account');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Executa a exclusão permanente da conta e dados
 */
async function handleConfirmDeleteAccount() {
  const btnConfirm = document.getElementById('btn-confirm-delete-account');
  const btnCancel = document.getElementById('btn-cancel-delete-account');
  const originalText = btnConfirm ? btnConfirm.innerHTML : '';

  try {
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `<span class="btn-spinner" style="width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite;margin-right:8px;"></span> Excluindo...`;
    }
    if (btnCancel) btnCancel.disabled = true;

    // 1. Tenta excluir no Supabase / backend
    try {
      await deleteAccountApi();
    } catch (apiErr) {
      console.warn('Erro ao excluir no backend/Supabase, prosseguindo com limpeza local:', apiErr);
    }

    // 2. Limpa banco de dados local (IndexedDB)
    await clearAllDocuments();

    // 3. Remove tokens e chaves do armazenamento local
    localStorage.removeItem('gavet_token');
    localStorage.removeItem('gavet_user');
    localStorage.removeItem('gavet_profile');

    // 4. Reseta estado da aplicação
    appState.auth = { token: null, user: null };
    appState.profile = getDefaultProfile();
    appState.documents = [];

    // 5. Atualiza dashboard e perfil
    await renderDashboard();
    populateProfileForm();
    updateAuthUI();

    // 6. Fecha o modal de confirmação
    closeDeleteAccountModal();

    // 7. Feedback de sucesso e reabre a tela de autenticação
    showToast('Sua conta e registros foram excluídos permanentemente.', 'success');
    openAuthModal('login');
  } catch (error) {
    console.error('Falha ao excluir conta:', error);
    showToast(error.message || 'Erro ao excluir conta. Tente novamente.', 'error');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = originalText;
    }
    if (btnCancel) btnCancel.disabled = false;
  }
}

/**
 * Exporta backup de todos os dados do Vault em arquivo JSON
 */
function exportVaultBackup() {
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.documents, null, 2));
    const downloadAnchor = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gavet-backup-${today}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Backup do Vault exportado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro na exportação:', err);
    showToast('Falha ao exportar backup.', 'danger');
  }
}

/**
 * Importa e mescla backup JSON no IndexedDB
 */
async function handleImportBackup(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('Formato inválido. O arquivo deve conter uma lista JSON de registros.');
    }
    const count = await importDocuments(parsed);
    appState.documents = await getAllDocuments();
    refreshUI();
    showToast(`${count} registros restaurados no Vault com sucesso!`, 'success');
  } catch (err) {
    console.error('Erro ao importar backup:', err);
    showToast('Falha ao importar. Verifique o arquivo JSON.', 'danger');
  }
}

/**
 * Limpa todos os dados locais com confirmação
 */
async function handleClearDatabase() {
  if (!window.confirm('Atenção: Todos os comprovantes, notas e garantias armazenados no seu dispositivo serão apagados permanentemente. Deseja continuar?')) {
    return;
  }
  try {
    await clearAllDocuments();
    appState.documents = [];
    refreshUI();
    showToast('Todos os registros foram removidos do Vault.', 'info');
  } catch (err) {
    console.error('Erro ao limpar base:', err);
    showToast('Falha ao limpar banco local.', 'danger');
  }
}

/**
 * Registra ouvintes de eventos da interface
 */
function setupEventListeners() {
  // Menu Hambúrguer & Drawer
  const btnHamburger = document.getElementById('btn-hamburger');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const drawerUserTrigger = document.getElementById('drawer-user-trigger');
  const btnHeaderProfile = document.getElementById('btn-header-profile');
  const brandHomeTrigger = document.getElementById('brand-home-trigger');

  if (btnHamburger) btnHamburger.addEventListener('click', toggleDrawer);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  if (brandHomeTrigger) {
    brandHomeTrigger.addEventListener('click', () => switchView('vault'));
  }
  if (btnHeaderProfile) {
    btnHeaderProfile.addEventListener('click', () => switchView('profile'));
  }
  if (drawerUserTrigger) {
    drawerUserTrigger.addEventListener('click', () => switchView('profile'));
  }

  // Itens de Navegação do Drawer
  const drawerNavItems = document.querySelectorAll('.drawer-nav-item');
  drawerNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const dest = item.dataset.navigate;
      switchView(dest);
    });
  });

  // Botões de Voltar das Abas
  const btnBackSettings = document.getElementById('btn-back-settings');
  const btnBackProfile = document.getElementById('btn-back-profile');
  if (btnBackSettings) btnBackSettings.addEventListener('click', () => switchView('vault'));
  if (btnBackProfile) btnBackProfile.addEventListener('click', () => switchView('vault'));

  // Seleção de Tema pelos Cards de Configurações
  const themeCardOptions = document.querySelectorAll('.theme-card-option');
  themeCardOptions.forEach(card => {
    card.addEventListener('click', () => {
      const selectedTheme = card.dataset.themeValue;
      applyTheme(selectedTheme, true);
    });
  });

  // Botões Rápidos de Tema no Drawer
  const quickThemeBtns = document.querySelectorAll('.quick-theme-btn');
  quickThemeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedTheme = btn.dataset.themeSet;
      applyTheme(selectedTheme, true);
    });
  });

  // Alteração da Janela de Atenção do Radar
  const selectRadarDays = document.getElementById('setting-radar-days');
  if (selectRadarDays) {
    selectRadarDays.addEventListener('change', (e) => {
      appState.radarDays = parseInt(e.target.value, 10) || 30;
      localStorage.setItem('gavet_radar_days', String(appState.radarDays));
      refreshUI();
      showToast(`Radar calibrado para ${appState.radarDays} dias de antecedência.`, 'info');
    });
  }

  // Exportar e Importar Backup
  const btnExport = document.getElementById('btn-export-vault');
  const inputImport = document.getElementById('input-import-vault');
  const btnClearDb = document.getElementById('btn-clear-db');

  if (btnExport) btnExport.addEventListener('click', exportVaultBackup);
  if (inputImport) {
    inputImport.addEventListener('change', (e) => {
      handleImportBackup(e.target.files[0]);
      e.target.value = '';
    });
  }
  if (btnClearDb) btnClearDb.addEventListener('click', handleClearDatabase);

  // Perfil: Formulário e Avatar
  const profileForm = document.getElementById('profile-form');
  if (profileForm) profileForm.addEventListener('submit', handleSaveProfile);

  const btnToggleAvatar = document.getElementById('btn-toggle-avatar-picker');
  const avatarPickerDock = document.getElementById('avatar-picker-dock');
  if (btnToggleAvatar && avatarPickerDock) {
    btnToggleAvatar.addEventListener('click', () => {
      avatarPickerDock.classList.toggle('hidden');
    });
  }

  const avatarChips = document.querySelectorAll('.avatar-chip');
  avatarChips.forEach(chip => {
    chip.addEventListener('click', () => {
      handleSelectAvatar(chip.dataset.avatar);
    });
  });

  // Thumb Dock: Novo Item
  const fabBtn = document.getElementById('fab-add-document');
  if (fabBtn) {
    fabBtn.addEventListener('click', () => openModal('create'));
  }

  // Thumb Dock: Câmera Rápida Direta
  const dockCamera = document.getElementById('dock-quick-camera');
  if (dockCamera) {
    dockCamera.addEventListener('change', (e) => {
      openModal('create');
      handleAiFileUpload(e.target.files[0]);
    });
  }

  // Botão do Estado Vazio
  const btnEmptyAdd = document.getElementById('btn-empty-add');
  if (btnEmptyAdd) {
    btnEmptyAdd.addEventListener('click', () => openModal('create'));
  }

  // Fechar Modal
  const btnClose = document.getElementById('btn-close-modal');
  const modalOverlay = document.getElementById('modal-overlay');
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Filtros em Chips
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      appState.currentFilter = tab.dataset.filter;
      refreshUI();
    });
  });

  // Chips de Vigência (Presets e Modo Personalizado)
  const termChips = document.querySelectorAll('.term-quick-chip');
  termChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const months = chip.dataset.months;
      if (months === 'custom') {
        const customPanel = document.getElementById('custom-term-panel');
        const isHidden = customPanel?.classList.contains('hidden');
        const currentMonths = parseInt(document.getElementById('doc-meses-garantia')?.value, 10) || 12;
        updateTermChips(currentMonths, true);
        const inputCustomQty = document.getElementById('input-custom-term-qty');
        if (inputCustomQty && isHidden) {
          inputCustomQty.focus();
          inputCustomQty.select();
        }
      } else {
        updateTermChips(months);
      }
      updateExpirationPreview();
    });
  });

  // Controles Adaptativos Personalizados (Quantidade, Unidade e Data Exata)
  const inputCustomQty = document.getElementById('input-custom-term-qty');
  const selectCustomUnit = document.getElementById('select-custom-term-unit');
  const inputCustomExactDate = document.getElementById('input-custom-exact-date');

  function handleCustomTermChange() {
    let qty = parseInt(inputCustomQty?.value, 10);
    if (isNaN(qty) || qty <= 0) qty = 1;
    const unit = selectCustomUnit?.value || 'months';
    const totalMonths = unit === 'years' ? qty * 12 : qty;

    const hiddenInput = document.getElementById('doc-meses-garantia');
    if (hiddenInput) hiddenInput.value = String(totalMonths);

    updateTermChips(totalMonths, true);
    updateExpirationPreview();
  }

  if (inputCustomQty) {
    inputCustomQty.addEventListener('input', handleCustomTermChange);
  }
  if (selectCustomUnit) {
    selectCustomUnit.addEventListener('change', handleCustomTermChange);
  }

  if (inputCustomExactDate) {
    inputCustomExactDate.addEventListener('change', () => {
      const exactVal = inputCustomExactDate.value;
      const dataCompraVal = document.getElementById('doc-data-compra')?.value;
      if (exactVal && dataCompraVal) {
        const dCompra = new Date(dataCompraVal + 'T00:00:00');
        const dVenc = new Date(exactVal + 'T00:00:00');
        
        let diffMonths = (dVenc.getFullYear() - dCompra.getFullYear()) * 12 + (dVenc.getMonth() - dCompra.getMonth());
        if (dVenc.getDate() > dCompra.getDate()) {
          diffMonths += Math.round((dVenc.getDate() - dCompra.getDate()) / 30);
        }
        if (diffMonths <= 0) diffMonths = 1;

        if (inputCustomQty) inputCustomQty.value = String(diffMonths);
        if (selectCustomUnit) selectCustomUnit.value = 'months';

        updateTermChips(diffMonths, true);
        updateExpirationPreview();
      }
    });
  }

  // Upload Câmera & Arquivo
  const inputCamera = document.getElementById('input-camera');
  const inputFile = document.getElementById('input-file');

  if (inputCamera) {
    inputCamera.addEventListener('change', (e) => handleAiFileUpload(e.target.files[0]));
  }
  if (inputFile) {
    inputFile.addEventListener('change', (e) => handleAiFileUpload(e.target.files[0]));
  }

  // Submissão do Formulário
  const form = document.getElementById('document-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // Atualização da Prévia Dinâmica
  const inputDataCompra = document.getElementById('doc-data-compra');
  const selectMeses = document.getElementById('doc-meses-garantia');
  const radioTipos = document.querySelectorAll('input[name="tipo_documento"]');

  if (inputDataCompra) inputDataCompra.addEventListener('change', updateExpirationPreview);
  if (selectMeses) selectMeses.addEventListener('change', updateExpirationPreview);

  radioTipos.forEach(radio => radio.addEventListener('change', () => {
    const labelData = document.getElementById('label-data-compra');
    const labelMeses = document.getElementById('label-meses');
    if (radio.value === 'assinatura') {
      if (labelData) labelData.textContent = 'Início da Assinatura';
      if (labelMeses) labelMeses.textContent = 'Ciclo de Renovação';
    } else {
      if (labelData) labelData.textContent = 'Data de Emissão';
      if (labelMeses) labelMeses.textContent = 'Prazo de Vigência';
    }
    updateExpirationPreview();
  }));

  // Autenticação: Drawer e Perfil
  const drawerAuthAction = document.getElementById('drawer-auth-action');
  if (drawerAuthAction) {
    drawerAuthAction.addEventListener('click', () => {
      closeDrawer();
      if (appState.auth && appState.auth.token) {
        handleLogout();
      } else {
        openAuthModal('login');
      }
    });
  }

  const btnOpenAuthProfile = document.getElementById('btn-open-auth-profile');
  const btnLogoutProfile = document.getElementById('btn-logout-profile');

  if (btnOpenAuthProfile) {
    btnOpenAuthProfile.addEventListener('click', () => openAuthModal('login'));
  }
  if (btnLogoutProfile) {
    btnLogoutProfile.addEventListener('click', handleLogout);
  }

  // Ações de Exclusão de Conta
  const btnDeleteAccount = document.getElementById('btn-delete-account');
  const btnCancelDeleteAccount = document.getElementById('btn-cancel-delete-account');
  const btnConfirmDeleteAccount = document.getElementById('btn-confirm-delete-account');
  const modalDeleteAccount = document.getElementById('modal-delete-account');

  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', openDeleteAccountModal);
  }
  if (btnCancelDeleteAccount) {
    btnCancelDeleteAccount.addEventListener('click', closeDeleteAccountModal);
  }
  if (btnConfirmDeleteAccount) {
    btnConfirmDeleteAccount.addEventListener('click', handleConfirmDeleteAccount);
  }
  if (modalDeleteAccount) {
    modalDeleteAccount.addEventListener('click', (e) => {
      if (e.target === modalDeleteAccount) {
        closeDeleteAccountModal();
      }
    });
  }

  // Auth Screen / Modal Controls
  const authScreen = document.getElementById('auth-screen');
  const btnCloseAuth = document.getElementById('btn-close-auth');
  const tabAuthLogin = document.getElementById('tab-auth-login');
  const tabAuthRegister = document.getElementById('tab-auth-register');
  const linkGoToLogin = document.getElementById('link-go-to-login');
  const linkGoToRegister = document.getElementById('link-go-to-register');

  if (btnCloseAuth) btnCloseAuth.addEventListener('click', closeAuthModal);
  if (authScreen) {
    authScreen.addEventListener('click', (e) => {
      // Bloqueia fechamento ao clicar no backdrop se o usuário não estiver autenticado
      if (e.target === authScreen && appState.auth && appState.auth.token) {
        closeAuthModal();
      }
    });
  }

  if (tabAuthLogin) tabAuthLogin.addEventListener('click', () => switchAuthTab('login'));
  if (tabAuthRegister) tabAuthRegister.addEventListener('click', () => switchAuthTab('register'));
  if (linkGoToLogin) linkGoToLogin.addEventListener('click', () => switchAuthTab('login'));
  if (linkGoToRegister) linkGoToRegister.addEventListener('click', () => switchAuthTab('register'));

  // Formulários de Autenticação
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  if (formLogin) formLogin.addEventListener('submit', handleLoginSubmit);
  if (formRegister) formRegister.addEventListener('submit', handleRegisterSubmit);

  // Botões de Visualizar/Ocultar Senha
  const togglePwdBtns = document.querySelectorAll('.btn-toggle-pwd');
  togglePwdBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;
      const isPassword = targetInput.type === 'password';
      targetInput.type = isPassword ? 'text' : 'password';
      btn.title = isPassword ? 'Ocultar senha' : 'Ver senha';
    });
  });

  // Medidor de Força de Senha e Confirmação
  const registerPwd = document.getElementById('register-password');
  const registerPwdConfirm = document.getElementById('register-password-confirm');
  const pwdMatchHint = document.getElementById('pwd-match-hint');

  function checkPasswordMatch() {
    if (!registerPwdConfirm || !registerPwd || !pwdMatchHint) return;
    const pwd = registerPwd.value;
    const confirm = registerPwdConfirm.value;
    if (!confirm) {
      pwdMatchHint.style.display = 'none';
      return;
    }
    pwdMatchHint.style.display = 'block';
    if (pwd === confirm) {
      pwdMatchHint.textContent = '✓ As senhas coincidem';
      pwdMatchHint.style.color = 'var(--accent-mint)';
    } else {
      pwdMatchHint.textContent = '✕ As senhas não coincidem';
      pwdMatchHint.style.color = '#EF4444';
    }
  }

  if (registerPwd) {
    registerPwd.addEventListener('input', (e) => {
      updatePasswordStrengthUI(e.target.value);
      checkPasswordMatch();
    });
  }

  if (registerPwdConfirm) {
    registerPwdConfirm.addEventListener('input', checkPasswordMatch);
  }

  // Login com o Google (nas abas Entrar e Cadastrar)
  const handleGoogleAuthClick = async (btn) => {
    try {
      clearAuthFeedback();
      btn.disabled = true;
      const span = btn.querySelector('span');
      const originalText = span ? span.textContent : '';
      if (span) span.textContent = 'Conectando ao Google...';
      await loginWithGoogle();
    } catch (err) {
      btn.disabled = false;
      const span = btn.querySelector('span');
      if (span) span.textContent = btn.id === 'btn-google-register' ? 'Cadastrar com o Google' : 'Entrar com o Google';
      showAuthFeedback(err.message || 'Falha ao iniciar autenticação com Google.');
    }
  };

  const btnGoogleLogin = document.getElementById('btn-google-login');
  const btnGoogleRegister = document.getElementById('btn-google-register');
  if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', () => handleGoogleAuthClick(btnGoogleLogin));
  if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', () => handleGoogleAuthClick(btnGoogleRegister));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDrawer();
      closeDeleteAccountModal();
      if (appState.auth && appState.auth.token) {
        closeAuthModal();
      }
    }
  });
}

/**
 * Trata o envio do arquivo para o Gemini OCR
 */
async function handleAiFileUpload(file) {
  if (!file) return;

  setAiLoadingState(true);
  try {
    const extracted = await sendFileToGemini(file);
    populateModalForm(extracted);
    showToast(`Comprovante lido com sucesso (${extracted.loja})`, 'success');
  } catch (error) {
    console.error('Erro no OCR:', error);
    showToast(error.message || 'Falha na leitura automática. Insira manualmente.', 'warning');
  } finally {
    setAiLoadingState(false);
  }
}

/**
 * Trata submissão do formulário (Criar ou Editar registro)
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const id = form.querySelector('#doc-id').value;
  const loja = form.querySelector('#doc-loja').value.trim();
  const valorStr = form.querySelector('#doc-valor').value;
  const data_compra = form.querySelector('#doc-data-compra').value;
  const meses_garantia = parseInt(form.querySelector('#doc-meses-garantia').value, 10) || 12;
  const tipo_documento = form.querySelector('input[name="tipo_documento"]:checked')?.value || 'garantia';

  if (!loja) {
    showToast('Informe o estabelecimento ou serviço', 'warning');
    return;
  }
  if (!data_compra) {
    showToast('Selecione a data de compra ou início', 'warning');
    return;
  }

  const valor = parseBRLInput(valorStr);

  const docPayload = {
    loja,
    valor,
    data_compra,
    meses_garantia,
    tipo_documento
  };

  if (id) {
    docPayload.id = id;
  }

  try {
    await saveDocument(docPayload);
    appState.documents = await getAllDocuments();
    refreshUI();
    closeModal();

    showToast(id ? 'Registro atualizado na Gavet' : 'Guardado no seu Vault local', 'success');
    triggerBackgroundSync();
  } catch (error) {
    console.error('Erro ao salvar documento:', error);
    showToast('Erro ao salvar no banco local.', 'danger');
  }
}

function openModal(mode = 'create', data = null) {
  setModalMode(mode, data);
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function handleOpenEditModal(item) {
  openModal('edit', item);
}

async function handleDeleteDocument(id) {
  const target = appState.documents.find(d => d.id === id);
  const confirmMsg = target ? `Deseja remover "${target.loja}" da gaveta?` : 'Deseja remover este item?';

  if (!window.confirm(confirmMsg)) {
    return;
  }

  try {
    await deleteDocument(id);
    appState.documents = await getAllDocuments();
    refreshUI();
    showToast('Item removido do Vault.', 'info');
  } catch (error) {
    console.error('Erro ao excluir item:', error);
    showToast('Erro ao excluir registro local.', 'danger');
  }
}

function handleNetworkChange() {
  const isOnline = navigator.onLine;
  appState.isOnline = isOnline;
  updateConnectionStatus(isOnline);

  if (isOnline) {
    showToast('Rede restabelecida. Sincronizando com nuvem...', 'info');
    triggerBackgroundSync();
  } else {
    showToast('Modo Offline ativo. Dados salvos localmente.', 'warning');
  }
}

/**
 * Baixa os documentos do servidor para sincronização bidirecional (PULL)
 * e hidrata a base IndexedDB local.
 */
async function syncPullFromServer() {
  const token = localStorage.getItem('gavet_token');
  if (!token || !navigator.onLine) return;

  try {
    const serverDocs = await fetchServerDocuments();
    if (Array.isArray(serverDocs) && serverDocs.length > 0) {
      // Se houver documentos reais no servidor, limpa os registros fictícios de demonstração
      const localDocs = await getAllDocuments();
      for (const item of localDocs) {
        if (item.id && String(item.id).startsWith('demo_')) {
          await deleteDocument(item.id);
        }
      }

      // Converte e grava no IndexedDB com status de sincronizado ativo
      const normalized = serverDocs.map((doc) => ({
        id: doc.id,
        loja: doc.loja || 'Documento',
        valor: typeof doc.valor === 'number' ? doc.valor : parseFloat(doc.valor) || 0,
        data_compra: doc.data_compra,
        meses_garantia: parseInt(doc.meses_garantia, 10) || 12,
        tipo_documento: doc.tipo_documento || 'garantia',
        synced: 1,
        createdAt: doc.created_at || doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updated_at || doc.updatedAt || new Date().toISOString()
      }));

      await importDocuments(normalized);
      appState.documents = await getAllDocuments();
      refreshUI();
    }
  } catch (err) {
    console.warn('[Sync Pull] Falha ao sincronizar documentos do servidor:', err);
  }
}

/**
 * Envia pendências locais ao servidor (PUSH) e sincroniza novos dados remotos (PULL)
 */
async function triggerBackgroundSync() {
  if (!navigator.onLine) return;

  try {
    const unsynced = await getUnsyncedDocuments();
    if (unsynced.length > 0) {
      const res = await syncWithServer(unsynced);
      if (res.success) {
        for (const item of unsynced) {
          await markDocumentSynced(item.id);
        }
        appState.documents = await getAllDocuments();
        refreshUI();
      }
    }
    // Realiza sincronização reversa (PULL)
    await syncPullFromServer();
  } catch (err) {
    console.warn('[Sync] Falha na sincronização:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

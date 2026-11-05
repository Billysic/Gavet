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
  syncWithServer
} from './api.js';

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
    avatar: 'BC',
    apiKey: ''
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

  // Preenche dados do perfil na UI
  populateProfileForm();

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

/**
 * Sincroniza dados do perfil nos múltiplos elementos da interface
 */
function populateProfileForm() {
  const p = appState.profile;

  // Header avatar
  const headerAvatar = document.getElementById('header-avatar-initials');
  if (headerAvatar) headerAvatar.textContent = p.avatar || 'BC';

  // Drawer
  const drawerAvatar = document.getElementById('drawer-user-avatar');
  const drawerName = document.getElementById('drawer-user-name');
  const drawerEmail = document.getElementById('drawer-user-email');
  if (drawerAvatar) drawerAvatar.textContent = p.avatar || 'BC';
  if (drawerName) drawerName.textContent = p.name || 'Usuário Gavet';
  if (drawerEmail) drawerEmail.textContent = p.email || 'usuario@gavet.app';

  // View Perfil
  const profileAvatar = document.getElementById('profile-avatar-display');
  const profileName = document.getElementById('profile-name-display');
  const profileEmail = document.getElementById('profile-email-display');
  if (profileAvatar) profileAvatar.textContent = p.avatar || 'BC';
  if (profileName) profileName.textContent = p.name || 'Usuário Gavet';
  if (profileEmail) profileEmail.textContent = p.email || 'usuario@gavet.app';

  // Campos do Formulário
  const inputName = document.getElementById('input-profile-name');
  const inputEmail = document.getElementById('input-profile-email');
  const inputApiKey = document.getElementById('input-profile-gemini-key');
  if (inputName) inputName.value = p.name || '';
  if (inputEmail) inputEmail.value = p.email || '';
  if (inputApiKey) inputApiKey.value = p.apiKey || '';
}

function handleSaveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('input-profile-name')?.value.trim() || 'Usuário Gavet';
  const email = document.getElementById('input-profile-email')?.value.trim() || 'usuario@gavet.app';
  const apiKey = document.getElementById('input-profile-gemini-key')?.value.trim() || '';

  appState.profile.name = name;
  appState.profile.email = email;
  appState.profile.apiKey = apiKey;

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

  // Chips Rápidos de Vigência (1m, 6m, 12m, 24m, 60m)
  const termChips = document.querySelectorAll('.term-quick-chip');
  termChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const months = chip.dataset.months;
      updateTermChips(months);
      updateExpirationPreview();
    });
  });

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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDrawer();
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
    showToast('Falha na leitura automática. Insira manualmente.', 'warning');
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

async function triggerBackgroundSync() {
  if (!navigator.onLine) return;

  try {
    const unsynced = await getUnsyncedDocuments();
    if (unsynced.length === 0) return;

    const res = await syncWithServer(unsynced);
    if (res.success) {
      for (const item of unsynced) {
        await markDocumentSynced(item.id);
      }
      appState.documents = await getAllDocuments();
      refreshUI();
    }
  } catch (err) {
    console.warn('[Sync] Falha na sincronização:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

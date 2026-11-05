/**
 * 🗄️ Gavet — Controlador Principal da Aplicação
 * Caminho: js/app.js
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
  seedIfEmpty
} from './db.js';

import {
  sendFileToGemini,
  syncWithServer
} from './api.js';

import {
  renderUrgencyRadar,
  renderDocumentsList,
  updateMetrics,
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

// Estado global da aplicação
let appState = {
  documents: [],
  currentFilter: 'todos',
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
 * Inicialização
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

  try {
    await getDB();
    appState.documents = await seedIfEmpty(DEMO_ITEMS);
  } catch (err) {
    console.error('Falha ao inicializar IndexedDB:', err);
    showToast('Erro ao acessar base local IndexedDB', 'danger');
  }

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
  const urgentAlerts = getUrgentAlerts(enrichedDocs, 30);

  renderUrgencyRadar(urgentAlerts, handleOpenEditModal);
  updateMetrics(enrichedDocs);
  renderDocumentsList(
    enrichedDocs,
    appState.currentFilter,
    handleDeleteDocument,
    handleOpenEditModal
  );
}

/**
 * Registra ouvintes de eventos da interface
 */
function setupEventListeners() {
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
    if (e.key === 'Escape') closeModal();
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
 * Trata submissão do formulário
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

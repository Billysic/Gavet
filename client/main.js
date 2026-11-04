import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import * as bootstrap from 'bootstrap';
import './src/styles/main.css';

import {
  saveDocument,
  getAllDocuments,
  deleteDocument,
  seedIfEmpty,
  getUnsyncedDocuments,
  markDocumentSynced
} from './src/js/db.js';

import {
  sendFileToGemini,
  syncWithServer
} from './src/js/api.js';

import {
  calculateDocumentExpiration,
  getUrgentAlerts
} from './src/js/alerts.js';

import {
  updateConnectionStatus,
  renderUrgencyRadar,
  renderDocumentsList,
  updateMetrics,
  showToast,
  setAiLoadingState,
  populateModalForm,
  setModalMode,
  setupCurrencyMask,
  parseBRLInput
} from './src/js/ui.js';

// Disponibiliza o objeto bootstrap globalmente para componentes dinâmicos (Modals, Toasts)
window.bootstrap = bootstrap;

// Estado reativo em memória sincronizado com IndexedDB
let appState = {
  documents: [],
  activeFilter: 'todos',
  selectedFile: null
};

/**
 * Ponto de entrada da aplicação
 */
document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  setupNetworkListeners();
  setupFilterButtons();
  setupUploadTriggers();
  setupDocumentForm();
  setupCurrencyMask(document.getElementById('input-valor'));

  // Carrega os dados reais do IndexedDB (semeia itens demo no primeiro acesso)
  await loadDocumentsFromDB();
});

/**
 * Registro do Service Worker para suporte PWA e Cache Offline
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[PWA] Service Worker registrado com sucesso:', registration.scope);
      } catch (error) {
        console.warn('[PWA] Falha ao registrar Service Worker:', error);
      }
    });
  }
}

/**
 * Monitora status de conectividade do dispositivo
 */
function setupNetworkListeners() {
  updateConnectionStatus(navigator.onLine);

  window.addEventListener('online', () => {
    updateConnectionStatus(true);
    showToast('Conexão restabelecida! Sincronizando dados...', 'success');
    trySyncWithBackend();
  });

  window.addEventListener('offline', () => {
    updateConnectionStatus(false);
    showToast('Sem conexão. Seus dados estão salvos no IndexedDB (Offline).', 'warning');
  });
}

/**
 * Carrega a lista completa de documentos diretamente do IndexedDB
 */
async function loadDocumentsFromDB() {
  try {
    const demoItems = getInitialDemoItems();
    appState.documents = await seedIfEmpty(demoItems);
    refreshUI();
  } catch (err) {
    console.error('Erro ao ler do IndexedDB:', err);
    showToast('Erro ao carregar dados locais.', 'danger');
  }
}

/**
 * Configuração dos botões de filtro rápido por categoria
 */
function setupFilterButtons() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.activeFilter = btn.dataset.filter;
      refreshUI();
    });
  });
}

/**
 * Gatilhos de upload (Câmera do celular e Seletor de Arquivos/PDF)
 */
function setupUploadTriggers() {
  const cameraInput = document.getElementById('camera-input');
  const fileInput = document.getElementById('file-input');
  const filePreview = document.getElementById('file-preview-container');
  const fileNamePreview = document.getElementById('file-name-preview');
  const removeFileBtn = document.getElementById('btn-remove-file');

  const handleFileSelect = (file) => {
    if (!file) return;
    appState.selectedFile = file;

    // Exibe pré-visualização do arquivo selecionado
    if (filePreview && fileNamePreview) {
      fileNamePreview.textContent = file.name;
      filePreview.classList.remove('d-none');
      filePreview.classList.add('d-flex');
    }

    showToast(`Arquivo selecionado: ${file.name}`, 'info');

    // Dispara a extração real de dados com a API do Gemini via backend
    processDocumentWithGemini(file);
  };

  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', () => {
      appState.selectedFile = null;
      if (cameraInput) cameraInput.value = '';
      if (fileInput) fileInput.value = '';
      if (filePreview) {
        filePreview.classList.remove('d-flex');
        filePreview.classList.add('d-none');
      }
    });
  }
}

/**
 * Extração de dados reais via endpoint Node.js + Google Gemini AI
 */
async function processDocumentWithGemini(file) {
  if (!navigator.onLine) {
    showToast('Modo Offline: preencha os dados manualmente ou aguarde a conexão.', 'warning');
    return;
  }

  setAiLoadingState(true);

  try {
    const extractedData = await sendFileToGemini(file);
    populateModalForm(extractedData);
    showToast('Dados extraídos com sucesso pela IA!', 'success');
  } catch (error) {
    console.warn('[Gemini OCR Warning]', error.message);
    showToast(`Nota: ${error.message}`, 'warning');
  } finally {
    setAiLoadingState(false);
  }
}

/**
 * Tenta sincronizar documentos pendentes do IndexedDB para o back-end
 */
async function trySyncWithBackend() {
  if (!navigator.onLine) return;

  try {
    const pendingDocs = await getUnsyncedDocuments();
    if (pendingDocs.length > 0) {
      await syncWithServer(pendingDocs);
      for (const doc of pendingDocs) {
        await markDocumentSynced(doc.id);
      }
      showToast(`${pendingDocs.length} registro(s) sincronizado(s) com o servidor.`, 'success');
    }
  } catch (err) {
    console.warn('[Sync Status] Servidor indisponível para sincronização no momento.');
  }
}

/**
 * Submissão do formulário do documento e salvamento no IndexedDB
 */
function setupDocumentForm() {
  const form = document.getElementById('document-form');
  const modalEl = document.getElementById('magicModal');
  const fabBtn = document.getElementById('fab-magic-btn');

  // Ao clicar no FAB, garante que o modal abre no modo de criação limpo
  if (fabBtn) {
    fabBtn.addEventListener('click', () => {
      setModalMode('create');
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = document.getElementById('input-edit-id')?.value;
    const selectedType = form.querySelector('input[name="tipo_documento"]:checked')?.value || 'garantia';
    const loja = document.getElementById('input-loja').value.trim();
    const valor = parseBRLInput(document.getElementById('input-valor').value);
    const dataCompra = document.getElementById('input-data').value;
    const meses = parseInt(document.getElementById('input-meses').value, 10) || 0;

    try {
      if (editId) {
        // MODO EDIÇÃO: Atualiza documento existente mantendo o ID e data de criação
        const existingDoc = appState.documents.find(d => d.id === editId);
        const updatedDoc = {
          ...existingDoc,
          id: editId,
          loja,
          valor,
          data_compra: dataCompra,
          meses_garantia: meses,
          tipo_documento: selectedType,
          synced: 0 // Marca para sincronizar a alteração com o servidor
        };

        const saved = await saveDocument(updatedDoc);
        const index = appState.documents.findIndex(d => d.id === editId);
        if (index !== -1) {
          appState.documents[index] = saved;
        }

        showToast('Lembrete atualizado com sucesso!', 'success');
      } else {
        // MODO CRIAÇÃO: Novo documento
        const newDoc = {
          loja,
          valor,
          data_compra: dataCompra,
          meses_garantia: meses,
          tipo_documento: selectedType
        };

        const savedDoc = await saveDocument(newDoc);
        appState.documents.unshift(savedDoc);
        showToast('Documento guardado na Gavet!', 'success');
      }

      refreshUI();

      // Fecha o modal
      if (modalEl && window.bootstrap?.Modal) {
        const modalInstance = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
        modalInstance.hide();
      }

      form.reset();
      document.getElementById('btn-remove-file')?.click();

      // Tenta sincronizar em background se estiver conectado
      trySyncWithBackend();
    } catch (err) {
      console.error('Falha ao gravar no IndexedDB:', err);
      showToast('Erro ao salvar localmente.', 'danger');
    }
  });
}

/**
 * Abre o modal preenchido no modo de edição para o documento selecionado
 */
function handleEditDocument(id) {
  const doc = appState.documents.find(d => d.id === id);
  if (!doc) return;

  setModalMode('edit', doc);

  const modalEl = document.getElementById('magicModal');
  if (modalEl && window.bootstrap?.Modal) {
    const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }
}

/**
 * Exclusão de documento do IndexedDB
 */
async function handleDeleteDocument(id) {
  try {
    await deleteDocument(id);
    appState.documents = appState.documents.filter(d => d.id !== id);
    refreshUI();
    showToast('Documento removido da gaveta.', 'info');
  } catch (err) {
    console.error('Erro ao excluir do IndexedDB:', err);
    showToast('Não foi possível remover o item.', 'danger');
  }
}

/**
 * Renderiza e recalcula todos os elementos da interface com base nas regras de alertas
 */
function refreshUI() {
  // Enriquecimento de cada documento com prazos e cálculos de vencimento
  const enrichedDocuments = appState.documents.map(calculateDocumentExpiration);

  // Alertas prioritários para o Radar de Urgência (ordenados por gravidade)
  const urgentAlerts = getUrgentAlerts(appState.documents);

  renderUrgencyRadar(urgentAlerts, handleEditDocument);
  updateMetrics(enrichedDocuments);
  renderDocumentsList(enrichedDocuments, appState.activeFilter, handleDeleteDocument, handleEditDocument);
}

/**
 * Dados de amostra para semeadura no primeiro acesso
 */
function getInitialDemoItems() {
  const today = new Date();
  
  const d1 = new Date(today);
  d1.setMonth(d1.getMonth() - 11);
  d1.setDate(d1.getDate() - 26);

  const d2 = new Date(today);
  d2.setDate(d2.getDate() - 15);

  return [
    {
      id: 'demo-1',
      loja: 'Apple Store (iPhone 15)',
      valor: 7299.00,
      data_compra: d1.toISOString().split('T')[0],
      meses_garantia: 12,
      tipo_documento: 'garantia'
    },
    {
      id: 'demo-2',
      loja: 'Netflix Premium',
      valor: 55.90,
      data_compra: d2.toISOString().split('T')[0],
      meses_garantia: 1,
      tipo_documento: 'assinatura'
    },
    {
      id: 'demo-3',
      loja: 'Supermercado Pão de Açúcar',
      valor: 342.15,
      data_compra: today.toISOString().split('T')[0],
      meses_garantia: 0,
      tipo_documento: 'nota_fiscal'
    }
  ];
}

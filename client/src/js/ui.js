/**
 * Camada de Manipulação de Interface (UI) - Gaveta Inteligente
 * Responsável pela renderização de cards, badges de urgência e comportamento do modal.
 */

// Formatação monetária padrão BRL
export function formatCurrency(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(number);
}

// Formatação de data padrão DD/MM/AAAA
export function formatDate(dateStr) {
  if (!dateStr) return 'Data não informada';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('pt-BR');
}

/**
 * Atualiza o indicador de status de conexão (Online / Offline)
 */
export function updateConnectionStatus(isOnline) {
  const container = document.getElementById('connection-status');
  if (!container) return;

  if (isOnline) {
    container.className = 'status-pill badge rounded-pill d-flex align-items-center gap-1 bg-success-subtle text-success border border-success-subtle px-2 py-1';
    container.innerHTML = `
      <span class="status-dot bg-success pulse"></span>
      <span class="status-text fw-medium" style="font-size: 0.72rem;">Online</span>
    `;
  } else {
    container.className = 'status-pill badge rounded-pill d-flex align-items-center gap-1 bg-warning-subtle text-dark border border-warning-subtle px-2 py-1';
    container.innerHTML = `
      <span class="status-dot bg-warning"></span>
      <span class="status-text fw-medium" style="font-size: 0.72rem;">Offline (Local)</span>
    `;
  }
}

/**
 * Exibe notificação tátil via Bootstrap Toast
 */
export function showToast(message, type = 'info') {
  const toastEl = document.getElementById('app-toast');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  if (!toastEl || !toastMessage) return;

  const icons = {
    success: 'bi-check-circle-fill text-success',
    warning: 'bi-exclamation-triangle-fill text-warning',
    danger: 'bi-x-circle-fill text-danger',
    info: 'bi-info-circle-fill text-info'
  };

  toastIcon.className = `bi ${icons[type] || icons.info} fs-5`;
  toastMessage.textContent = message;

  // Import dinâmico do bootstrap Toast caso necessário
  if (window.bootstrap?.Toast) {
    const toast = new window.bootstrap.Toast(toastEl, { delay: 3500 });
    toast.show();
  }
}

/**
 * Alterna estado de carregamento da IA no Modal
 */
export function setAiLoadingState(isLoading) {
  const loadingContainer = document.getElementById('ai-loading-container');
  const actionButtons = document.getElementById('upload-action-buttons');
  const saveBtn = document.getElementById('btn-save-document');

  if (loadingContainer) {
    loadingContainer.classList.toggle('d-none', !isLoading);
  }
  if (actionButtons) {
    actionButtons.style.opacity = isLoading ? '0.5' : '1';
    actionButtons.style.pointerEvents = isLoading ? 'none' : 'auto';
  }
  if (saveBtn) {
    saveBtn.disabled = isLoading;
  }
}

/**
 * Renderiza o Radar de Urgência no topo do Dashboard
 */
export function renderUrgencyRadar(urgentItems = []) {
  const container = document.getElementById('urgency-cards-container');
  const countBadge = document.getElementById('urgency-count-badge');
  if (!container) return;

  container.innerHTML = '';

  if (!urgentItems || urgentItems.length === 0) {
    if (countBadge) {
      countBadge.className = 'badge bg-success-subtle text-success rounded-pill';
      countBadge.textContent = 'Tudo em dia';
    }

    container.innerHTML = `
      <div class="card border-0 shadow-sm w-100 p-3 rounded-3 bg-white text-center">
        <div class="d-flex align-items-center justify-content-center gap-2 text-success">
          <i class="bi bi-shield-check fs-4"></i>
          <span class="small fw-bold">Nenhuma garantia ou assinatura vencendo nos próximos 30 dias!</span>
        </div>
      </div>
    `;
    return;
  }

  if (countBadge) {
    countBadge.className = 'badge bg-danger rounded-pill';
    countBadge.textContent = `${urgentItems.length} alerta${urgentItems.length > 1 ? 's' : ''}`;
  }

  urgentItems.forEach(item => {
    const isCritical = item.nivelUrgencia === 'critico' || item.nivelUrgencia === 'hoje' || item.nivelUrgencia === 'expirado';
    const borderClass = isCritical ? 'border-urgency-critical' : 'border-urgency-warning';
    const badgeBg = isCritical ? 'bg-danger text-white' : 'bg-warning text-dark';
    const icon = item.tipo_documento === 'assinatura' ? 'bi-arrow-repeat' : 'bi-shield-exclamation';

    const card = document.createElement('div');
    card.className = `card urgency-card border-0 shadow-sm p-3 bg-white ${borderClass}`;
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <span class="badge ${badgeBg} rounded-pill px-2 py-1 small">
          <i class="bi ${icon} me-1"></i>
          ${item.labelUrgencia}
        </span>
        <span class="fw-bold text-dark">${formatCurrency(item.valor)}</span>
      </div>
      <h3 class="h6 fw-bold mb-1 text-truncate">${item.loja}</h3>
      <div class="d-flex justify-content-between align-items-center text-muted small">
        <span>Vencimento: ${formatDate(item.dataVencimento)}</span>
        <span class="text-capitalize">${item.tipo_documento}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Atualiza os contadores numéricos de resumo
 */
export function updateMetrics(documents = []) {
  const garantias = documents.filter(d => d.tipo_documento === 'garantia').length;
  const assinaturas = documents.filter(d => d.tipo_documento === 'assinatura').length;
  const notas = documents.filter(d => d.tipo_documento === 'nota_fiscal').length;

  const countGarantias = document.getElementById('count-garantias');
  const countAssinaturas = document.getElementById('count-assinaturas');
  const countNotas = document.getElementById('count-notas');
  const totalCount = document.getElementById('total-items-count');

  if (countGarantias) countGarantias.textContent = garantias;
  if (countAssinaturas) countAssinaturas.textContent = assinaturas;
  if (countNotas) countNotas.textContent = notas;
  if (totalCount) totalCount.textContent = `${documents.length} ite${documents.length === 1 ? 'm' : 'ns'}`;
}

/**
 * Renderiza a lista principal de documentos
 */
export function renderDocumentsList(documents = [], activeFilter = 'todos', onDelete) {
  const listContainer = document.getElementById('documents-list');
  const emptyState = document.getElementById('empty-state');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  const filtered = activeFilter === 'todos'
    ? documents
    : documents.filter(d => d.tipo_documento === activeFilter);

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');

  filtered.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'card doc-card p-3 shadow-sm';

    const typeIcons = {
      garantia: 'bi-shield-check text-primary',
      assinatura: 'bi-arrow-repeat text-info',
      nota_fiscal: 'bi-receipt text-success'
    };

    const typeLabels = {
      garantia: 'Garantia',
      assinatura: 'Assinatura',
      nota_fiscal: 'Nota Fiscal'
    };

    // Indicador visual de vencimento na lista
    let statusBadge = '';
    if (doc.diasRestantes !== undefined) {
      if (doc.diasRestantes < 0) {
        statusBadge = '<span class="badge bg-secondary-subtle text-secondary border rounded-pill">Expirado</span>';
      } else if (doc.diasRestantes <= 7) {
        statusBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">${doc.labelUrgencia}</span>`;
      } else if (doc.diasRestantes <= 30) {
        statusBadge = `<span class="badge bg-warning-subtle text-dark border border-warning-subtle rounded-pill">${doc.labelUrgencia}</span>`;
      } else {
        statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Válido</span>';
      }
    }

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi ${typeIcons[doc.tipo_documento] || 'bi-file-text'} fs-5"></i>
          <div>
            <h3 class="h6 fw-bold mb-0 text-dark">${doc.loja}</h3>
            <div class="d-flex align-items-center gap-1 mt-1">
              <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 0.68rem;">
                ${typeLabels[doc.tipo_documento] || doc.tipo_documento}
              </span>
              ${statusBadge}
            </div>
          </div>
        </div>
        <div class="text-end">
          <span class="fw-bold fs-6 text-dark d-block">${formatCurrency(doc.valor)}</span>
          <small class="text-muted" style="font-size: 0.72rem;">${formatDate(doc.data_compra)}</small>
        </div>
      </div>

      <div class="mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
        <span class="text-muted small">
          ${doc.tipo_documento === 'assinatura'
            ? `<i class="bi bi-arrow-repeat me-1"></i> Ciclo: <strong>${doc.meses_garantia || 1} mês(es)</strong>`
            : `<i class="bi bi-clock-history me-1"></i> Validade: <strong>${doc.dataVencimento ? formatDate(doc.dataVencimento) : `${doc.meses_garantia || 0} meses`}</strong>`
          }
        </span>
        <button class="btn btn-sm btn-link text-danger p-0 delete-doc-btn" data-id="${doc.id}" aria-label="Remover">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    `;

    // Handler de exclusão
    const deleteBtn = card.querySelector('.delete-doc-btn');
    if (deleteBtn && onDelete) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete(doc.id);
      });
    }

    listContainer.appendChild(card);
  });
}

/**
 * Preenche os inputs do formulário no modal com os dados extraídos
 */
export function populateModalForm(data = {}) {
  const inputLoja = document.getElementById('input-loja');
  const inputValor = document.getElementById('input-valor');
  const inputData = document.getElementById('input-data');
  const inputMeses = document.getElementById('input-meses');

  if (inputLoja) inputLoja.value = data.loja || '';
  if (inputValor) inputValor.value = data.valor || '';
  if (inputData) inputData.value = data.data_compra || new Date().toISOString().split('T')[0];
  if (inputMeses) inputMeses.value = data.meses_garantia ?? 12;

  // Marcação do radio do tipo
  const tipo = data.tipo_documento || 'garantia';
  const radio = document.querySelector(`input[name="tipo_documento"][value="${tipo}"]`);
  if (radio) radio.checked = true;
}

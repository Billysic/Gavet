/**
 * Camada de Manipulação de Interface (UI) - Gavet
 * Design System Dark Mode: Azul Noturno (#0F172A), Azul Aço (#1E293B) e Verde Menta (#10B981)
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
    container.className = 'status-pill online badge rounded-pill d-flex align-items-center gap-1 px-2 py-1';
    container.innerHTML = `
      <span class="status-dot bg-success pulse" style="background-color: #10B981 !important;"></span>
      <span class="status-text fw-medium" style="font-size: 0.72rem;">Online</span>
    `;
  } else {
    container.className = 'status-pill offline badge rounded-pill d-flex align-items-center gap-1 px-2 py-1';
    container.innerHTML = `
      <span class="status-dot" style="background-color: #F59E0B !important;"></span>
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
    actionButtons.style.opacity = isLoading ? '0.4' : '1';
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
      countBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      countBadge.style.color = '#10B981';
      countBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      countBadge.textContent = 'Tudo em dia';
    }

    container.innerHTML = `
      <div class="card border-0 w-100 p-3 rounded-3 text-center" style="background-color: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25) !important;">
        <div class="d-flex align-items-center justify-content-center gap-2" style="color: #10B981;">
          <i class="bi bi-shield-check fs-4"></i>
          <span class="small fw-bold">Nenhuma garantia ou assinatura vencendo nos próximos 30 dias!</span>
        </div>
      </div>
    `;
    return;
  }

  if (countBadge) {
    countBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    countBadge.style.color = '#EF4444';
    countBadge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    countBadge.textContent = `${urgentItems.length} alerta${urgentItems.length > 1 ? 's' : ''}`;
  }

  urgentItems.forEach(item => {
    const isCritical = item.nivelUrgencia === 'critico' || item.nivelUrgencia === 'hoje' || item.nivelUrgencia === 'expirado';
    const borderClass = isCritical ? 'border-urgency-critical' : 'border-urgency-warning';
    
    // Cores Semânticas de Alerta
    const badgeStyle = isCritical
      ? 'background: rgba(239, 68, 68, 0.25); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4);'
      : 'background: rgba(245, 158, 11, 0.25); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4);';

    const icon = item.tipo_documento === 'assinatura' ? 'bi-arrow-repeat' : 'bi-shield-exclamation';

    const card = document.createElement('div');
    card.className = `card urgency-card p-3 ${borderClass}`;
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <span class="badge rounded-pill px-2 py-1 small" style="${badgeStyle}">
          <i class="bi ${icon} me-1"></i>
          ${item.labelUrgencia}
        </span>
        <span class="fw-bold" style="color: #F1F5F9;">${formatCurrency(item.valor)}</span>
      </div>
      <h3 class="h6 fw-bold mb-1 text-truncate" style="color: #F1F5F9;">${item.loja}</h3>
      <div class="d-flex justify-content-between align-items-center small" style="color: #94A3B8;">
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
 * Renderiza a lista principal de documentos (Minha Gaveta)
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
      garantia: 'bi-shield-check text-success',
      assinatura: 'bi-arrow-repeat text-info',
      nota_fiscal: 'bi-receipt text-warning'
    };

    const typeLabels = {
      garantia: 'Garantia',
      assinatura: 'Assinatura',
      nota_fiscal: 'Nota Fiscal'
    };

    // Cores Semânticas nos Badges dos cards
    let statusBadge = '';
    if (doc.diasRestantes !== undefined) {
      if (doc.diasRestantes < 0) {
        statusBadge = '<span class="badge rounded-pill" style="background: rgba(148, 163, 184, 0.15); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.3);">Expirado</span>';
      } else if (doc.diasRestantes <= 7) {
        statusBadge = `<span class="badge rounded-pill" style="background: rgba(239, 68, 68, 0.18); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35);">${doc.labelUrgencia}</span>`;
      } else if (doc.diasRestantes <= 30) {
        statusBadge = `<span class="badge rounded-pill" style="background: rgba(245, 158, 11, 0.18); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35);">${doc.labelUrgencia}</span>`;
      } else {
        statusBadge = '<span class="badge rounded-pill" style="background: rgba(16, 185, 129, 0.18); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35);">Seguro</span>';
      }
    }

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi ${typeIcons[doc.tipo_documento] || 'bi-file-text'} fs-5"></i>
          <div>
            <h3 class="h6 fw-bold mb-0" style="color: #F1F5F9;">${doc.loja}</h3>
            <div class="d-flex align-items-center gap-1 mt-1">
              <span class="badge rounded-pill" style="background: rgba(148, 163, 184, 0.12); color: #94A3B8; border: 1px solid #334155; font-size: 0.68rem;">
                ${typeLabels[doc.tipo_documento] || doc.tipo_documento}
              </span>
              ${statusBadge}
            </div>
          </div>
        </div>
        <div class="text-end">
          <span class="fw-bold fs-6 d-block" style="color: #F1F5F9;">${formatCurrency(doc.valor)}</span>
          <small style="color: #94A3B8; font-size: 0.72rem;">${formatDate(doc.data_compra)}</small>
        </div>
      </div>

      <div class="mt-2 pt-2 border-top d-flex justify-content-between align-items-center" style="border-color: #334155 !important;">
        <span class="small" style="color: #94A3B8;">
          ${doc.tipo_documento === 'assinatura'
            ? `<i class="bi bi-arrow-repeat me-1"></i> Renovação: <strong style="color: #F1F5F9;">${doc.dataVencimento ? formatDate(doc.dataVencimento) : 'Mensal'}</strong>`
            : `<i class="bi bi-clock-history me-1"></i> Garantia até: <strong style="color: #F1F5F9;">${doc.dataVencimento ? formatDate(doc.dataVencimento) : `${doc.meses_garantia || 0} meses`}</strong>`
          }
        </span>
        <button class="btn btn-sm btn-link p-0 delete-doc-btn" data-id="${doc.id}" aria-label="Remover" style="color: #EF4444;">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    `;

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

  const tipo = data.tipo_documento || 'garantia';
  const radio = document.querySelector(`input[name="tipo_documento"][value="${tipo}"]`);
  if (radio) radio.checked = true;
}

/**
 * 🗄️ Gavet — Manipulação de Interface e UI (DOM & A11y)
 * Caminho: js/ui.js
 * Design: Editorial Luxury, Native Mobile-First, Obsidian & Titanium
 */

import { calculateDocumentExpiration, calculateFinancialMetrics } from './alerts.js';

/**
 * Sanitiza texto para evitar Stored XSS em inserções no DOM
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

/**
 * Retorna o ícone SVG vetorial correspondente ao tipo de documento.
 * @param {string} tipo
 * @param {number} size
 * @returns {string}
 */
export function getTypeIconSvg(tipo, size = 18) {
  if (tipo === 'assinatura') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
    `;
  }
  if (tipo === 'nota_fiscal') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    `;
  }
  // Garantia padrão
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `;
}

/**
 * Retorna o micro-ícone SVG de urgência.
 * @param {string} urgency
 * @param {number} size
 * @returns {string}
 */
export function getUrgencyIconSvg(urgency, size = 13) {
  if (urgency === 'critico') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    `;
  }
  if (urgency === 'atencao') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    `;
  }
  if (urgency === 'expirado') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `;
  }
  // seguro
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  `;
}

/**
 * Extrai 2 letras de monograma para o logotipo do estabelecimento.
 * @param {string} name
 * @returns {string}
 */
export function getMerchantMonogram(name = '') {
  if (!name) return 'GV';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Converte número float para formato monetário legível em Real (BRL).
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  });
}

/**
 * Converte valor para string sem o símbolo "R$".
 * @param {number|string} value
 * @returns {string}
 */
export function formatBRLInput(value = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Converte string digitada para float numérico.
 * @param {string} str
 * @returns {number}
 */
export function parseBRLInput(str = '') {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const clean = str.replace(/[^\d]/g, '');
  if (!clean) return 0;
  return parseFloat(clean) / 100;
}

/**
 * Formata data ISO (YYYY-MM-DD) para padrão brasileiro DD/MM/AAAA.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr = '') {
  if (!dateStr || !dateStr.includes('-')) return '--/--/----';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Aplica máscara de moeda BRL em tempo real.
 * @param {HTMLInputElement} inputElement
 */
export function setupCurrencyMask(inputElement) {
  if (!inputElement) return;

  inputElement.addEventListener('input', (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      e.target.value = '';
      return;
    }
    const floatVal = parseFloat(rawVal) / 100;
    e.target.value = formatBRLInput(floatVal);
  });
}

/**
 * Atualiza o badge do topo entre Online e Offline (Local).
 * @param {boolean} isOnline
 */
export function updateConnectionStatus(isOnline) {
  const badge = document.getElementById('connection-badge');
  const label = document.getElementById('connection-text');
  if (!badge || !label) return;

  if (isOnline) {
    badge.className = 'live-status-pill online';
    label.textContent = 'Local & Cloud';
  } else {
    badge.className = 'live-status-pill offline';
    label.textContent = 'Modo Local (Offline)';
  }
}

/**
 * Exibe ou oculta o painel HUD do scanner da IA.
 * @param {boolean} isLoading
 */
export function setAiLoadingState(isLoading) {
  const overlay = document.getElementById('ai-scanner-overlay');
  const form = document.getElementById('document-form');
  const quickActions = document.getElementById('ai-quick-actions');
  const saveBtn = document.getElementById('btn-save-doc');

  if (overlay) {
    overlay.classList.toggle('hidden', !isLoading);
  }
  if (form) {
    form.style.opacity = isLoading ? '0.25' : '1';
    form.style.pointerEvents = isLoading ? 'none' : 'auto';
  }
  if (quickActions) {
    quickActions.style.opacity = isLoading ? '0.25' : '1';
    quickActions.style.pointerEvents = isLoading ? 'none' : 'auto';
  }
  if (saveBtn) {
    saveBtn.disabled = isLoading;
  }
}

/**
 * Dispara notificação flutuante com estética premium.
 * @param {string} message
 * @param {'success'|'warning'|'danger'|'info'} type
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let dotColor = 'var(--text-muted)';
  if (type === 'success') dotColor = 'var(--accent-mint)';
  if (type === 'danger') dotColor = 'var(--urgency-critical)';
  if (type === 'warning') dotColor = 'var(--urgency-warning)';

  toast.innerHTML = `
    <span style="width:6px; height:6px; border-radius:50%; background:${dotColor}; flex-shrink:0;"></span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

/**
 * Renderiza os cartões no estilo Pass Ticket no Radar de Urgência.
 * @param {Array} urgentItems
 * @param {Function} onEdit
 */
export function renderUrgencyRadar(urgentItems = [], onEdit) {
  const container = document.getElementById('urgency-radar');
  const countBadge = document.getElementById('radar-count-badge');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = urgentItems.length;
  }

  if (urgentItems.length === 0) {
    container.innerHTML = `
      <div class="radar-empty-ticket">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Nenhum vencimento nos próximos 30 dias. Tudo protegido!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = urgentItems.map(item => {
    const urgencyClass = item.nivelUrgencia || 'seguro';
    const safeLoja = escapeHTML(item.loja);
    const safeUrgencia = escapeHTML(item.labelUrgencia);

    return `
      <article class="pass-ticket-card ${urgencyClass}" data-id="${item.id}" tabindex="0" role="button" aria-label="${safeLoja}, ${safeUrgencia}">
        <div class="ticket-header">
          <h3 class="ticket-store-name" title="${safeLoja}">${safeLoja}</h3>
          <span class="ticket-countdown-pill">${safeUrgencia}</span>
        </div>
        
        <div class="ticket-footer">
          <span class="ticket-value">${formatCurrency(item.valor)}</span>
          <span class="ticket-date-mono">${formatDate(item.dataVencimento)}</span>
        </div>
      </article>
    `;
  }).join('');

  container.onclick = (e) => {
    const card = e.target.closest('.pass-ticket-card');
    if (!card) return;
    const id = card.dataset.id;
    const target = urgentItems.find(i => i.id === id);
    if (target && onEdit) onEdit(target);
  };
}

/**
 * Renderiza a lista principal com linha do tempo de vigência (Timeline Bar).
 * @param {Array} documents
 * @param {string} filter
 * @param {Function} onDelete
 * @param {Function} onEdit
 */
export function renderDocumentsList(documents = [], filter = 'todos', onDelete, onEdit) {
  const container = document.getElementById('documents-list');
  const emptyState = document.getElementById('empty-state');
  const totalBadge = document.getElementById('total-documents-badge');
  if (!container) return;

  const filtered = documents.filter(doc => {
    if (filter === 'todos') return true;
    return doc.tipo_documento === filter;
  });

  if (totalBadge) {
    totalBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(doc => {
    const item = calculateDocumentExpiration(doc);
    const urgencyClass = item.nivelUrgencia || 'seguro';
    const isSynced = item.synced === 1;

    // Calcular percentual decorrido para a barra de progresso
    const totalDays = Math.max(30, (item.meses_garantia || 12) * 30);
    const daysLeft = Math.max(0, item.diasRestantes || 0);
    const percentRemaining = Math.min(100, Math.max(4, Math.round((daysLeft / totalDays) * 100)));

    let typeDisplayName = 'Garantia';
    if (item.tipo_documento === 'assinatura') typeDisplayName = 'Assinatura';
    if (item.tipo_documento === 'nota_fiscal') typeDisplayName = 'Nota Fiscal';

    const safeLoja = escapeHTML(item.loja);
    const safeUrgencia = escapeHTML(item.labelUrgencia);

    return `
      <div class="inventory-row-card" data-id="${item.id}" role="listitem">
        <div class="inventory-row-main">
          <div class="inventory-item-lead">
            <div class="item-icon-badge kind-${item.tipo_documento}" aria-hidden="true">
              ${getTypeIconSvg(item.tipo_documento, 18)}
            </div>
            <div class="inventory-meta">
              <h3 class="inventory-store">${safeLoja}</h3>
              <div class="inventory-subline">
                <span class="kind-tag kind-${item.tipo_documento}">${typeDisplayName}</span>
                <span>•</span>
                <span>Compra: ${formatDate(item.data_compra)}</span>
              </div>
            </div>
          </div>

          <div class="inventory-val-box">
            ${formatCurrency(item.valor)}
          </div>
        </div>

        <!-- Hairline Timeline Bar -->
        <div class="timeline-track-wrap" aria-hidden="true">
          <div class="timeline-hairline-track">
            <div class="timeline-progress-fill ${urgencyClass}" style="width: ${percentRemaining}%;"></div>
          </div>
        </div>

        <div class="inventory-row-bottom">
          <span class="urgency-badge-subtle ${urgencyClass}">
            ${getUrgencyIconSvg(urgencyClass, 13)}
            <span>${safeUrgencia}</span>
            <span style="color:var(--text-muted); font-weight:400;">(${formatDate(item.dataVencimento)})</span>
          </span>

          <div class="inventory-action-group">
            <button type="button" class="action-btn-pill action-btn-edit" data-id="${item.id}" aria-label="Editar ${safeLoja}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="action-btn-pill action-btn-delete" data-id="${item.id}" aria-label="Excluir ${safeLoja}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.onclick = (e) => {
    const editBtn = e.target.closest('.action-btn-edit');
    if (editBtn) {
      e.stopPropagation();
      const id = editBtn.dataset.id;
      const target = documents.find(d => d.id === id);
      if (target && onEdit) onEdit(target);
      return;
    }

    const delBtn = e.target.closest('.action-btn-delete');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.id;
      if (onDelete) onDelete(id);
      return;
    }
  };
}

/**
 * Atualiza o Vault Cockpit e os contadores.
 * @param {Array} documents
 */
export function updateMetrics(documents = []) {
  const metrics = calculateFinancialMetrics(documents);

  const elWarrantyVal = document.getElementById('metric-warranty-value');
  const elWarrantyCount = document.getElementById('metric-warranty-count');
  const elSubVal = document.getElementById('metric-sub-value');
  const elSubCount = document.getElementById('metric-sub-count');
  const elInvCount = document.getElementById('metric-invoices-count');
  const elInvTotal = document.getElementById('metric-invoices-total');

  if (elWarrantyVal) elWarrantyVal.textContent = formatCurrency(metrics.activeWarrantiesValue);
  if (elWarrantyCount) elWarrantyCount.textContent = `${metrics.activeWarrantiesCount} coberturas ativas`;

  if (elSubVal) elSubVal.textContent = formatCurrency(metrics.monthlySubscriptionsValue);
  if (elSubCount) elSubCount.textContent = `${metrics.monthlySubscriptionsCount} serviços ativos`;

  if (elInvCount) elInvCount.textContent = metrics.totalInvoicesCount;
  if (elInvTotal) elInvTotal.textContent = `${formatCurrency(metrics.totalInvoicesValue)} arquivados`;

  // Contadores dos botões de filtro
  const countTodos = document.getElementById('count-todos');
  const countGarantia = document.getElementById('count-garantia');
  const countAssinatura = document.getElementById('count-assinatura');
  const countNota = document.getElementById('count-nota_fiscal');

  if (countTodos) countTodos.textContent = documents.length;
  if (countGarantia) countGarantia.textContent = documents.filter(d => d.tipo_documento === 'garantia').length;
  if (countAssinatura) countAssinatura.textContent = documents.filter(d => d.tipo_documento === 'assinatura').length;
  if (countNota) countNota.textContent = documents.filter(d => d.tipo_documento === 'nota_fiscal').length;
}

/**
 * Atualiza o painel de estatísticas da aba de perfil.
 * @param {Array} documents
 * @param {number} urgentCount
 */
export function updateProfileStats(documents = [], urgentCount = 0) {
  const statDocs = document.getElementById('profile-stat-docs');
  const statVal = document.getElementById('profile-stat-value');
  const statAlerts = document.getElementById('profile-stat-alerts');

  if (statDocs) statDocs.textContent = documents.length;
  if (statVal) {
    const total = documents.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
    statVal.textContent = formatCurrency(total);
  }
  if (statAlerts) statAlerts.textContent = urgentCount;
}

/**
 * Configura o Bottom Sheet: modo 'create' ou 'edit'.
 * @param {'create'|'edit'} mode
 * @param {Object} [data]
 */
export function setModalMode(mode = 'create', data = null) {
  const modalTitle = document.getElementById('modal-title');
  const aiQuickActions = document.getElementById('ai-quick-actions');
  const btnSave = document.getElementById('btn-save-doc');
  const form = document.getElementById('document-form');

  if (!form) return;

  if (mode === 'create') {
    if (modalTitle) modalTitle.textContent = 'Novo Registro';
    if (aiQuickActions) aiQuickActions.style.display = 'grid';
    if (btnSave) btnSave.querySelector('.btn-text').textContent = 'Confirmar e Guardar na Gavet';

    form.reset();
    document.getElementById('doc-id').value = '';
    document.getElementById('doc-data-compra').value = new Date().toISOString().split('T')[0];
    document.getElementById('doc-meses-garantia').value = '12';
    
    // Seleciona chip de 12 meses
    updateTermChips(12);

    const garantiaRadio = form.querySelector('input[name="tipo_documento"][value="garantia"]');
    if (garantiaRadio) garantiaRadio.checked = true;

  } else {
    if (modalTitle) modalTitle.textContent = 'Editar Registro';
    if (aiQuickActions) aiQuickActions.style.display = 'none';
    if (btnSave) btnSave.querySelector('.btn-text').textContent = 'Atualizar Registro';

    if (data) {
      populateModalForm(data);
    }
  }

  updateExpirationPreview();
}

/**
 * Preenche o formulário com dados retornados pela IA ou em edição.
 * @param {Object} data
 */
export function populateModalForm(data = {}) {
  const form = document.getElementById('document-form');
  if (!form) return;

  if (data.id) document.getElementById('doc-id').value = data.id;
  if (data.loja) document.getElementById('doc-loja').value = data.loja;
  if (data.valor !== undefined) document.getElementById('doc-valor').value = formatBRLInput(data.valor);
  if (data.data_compra) document.getElementById('doc-data-compra').value = data.data_compra;
  if (data.meses_garantia !== undefined) {
    document.getElementById('doc-meses-garantia').value = String(data.meses_garantia);
    updateTermChips(data.meses_garantia);
  }

  if (data.tipo_documento) {
    const radio = form.querySelector(`input[name="tipo_documento"][value="${data.tipo_documento}"]`);
    if (radio) radio.checked = true;
  }

  updateExpirationPreview();
}

/**
 * Atualiza visualmente os chips rápidos de prazo de vigência ou o seletor personalizado.
 * @param {number|string} months
 * @param {boolean} [forceCustomOpen=false]
 */
export function updateTermChips(months, forceCustomOpen = false) {
  const m = parseInt(months, 10) || 12;
  const chips = document.querySelectorAll('.term-quick-chip');
  const customPanel = document.getElementById('custom-term-panel');
  const customQty = document.getElementById('input-custom-term-qty');
  const customUnit = document.getElementById('select-custom-term-unit');
  const customExactDate = document.getElementById('input-custom-exact-date');
  const dataCompra = document.getElementById('doc-data-compra')?.value;

  const presetValues = [1, 6, 12, 24];
  const isPreset = presetValues.includes(m) && !forceCustomOpen;

  chips.forEach(chip => {
    if (chip.dataset.months === 'custom') {
      chip.classList.toggle('active', !isPreset);
    } else {
      const chipVal = parseInt(chip.dataset.months, 10);
      chip.classList.toggle('active', isPreset && chipVal === m);
    }
  });

  const hiddenInput = document.getElementById('doc-meses-garantia');
  if (hiddenInput) hiddenInput.value = String(m);

  if (customPanel) {
    customPanel.classList.toggle('hidden', isPreset);
  }

  // Sincroniza campos do painel personalizado
  if (customQty) {
    if (m >= 12 && m % 12 === 0 && customUnit && customUnit.value === 'years') {
      customQty.value = String(m / 12);
    } else {
      customQty.value = String(m);
      if (customUnit) customUnit.value = 'months';
    }
  }

  // Sincroniza data exata projetada
  if (customExactDate && dataCompra) {
    const d = new Date(dataCompra + 'T00:00:00');
    d.setMonth(d.getMonth() + m);
    customExactDate.value = d.toISOString().split('T')[0];
  }

  const hint = document.getElementById('hint-meses');
  if (hint) {
    if (m === 1) hint.textContent = '1 mês (Mensal)';
    else if (m === 3) hint.textContent = '3 meses (Trimestral)';
    else if (m === 6) hint.textContent = '6 meses (Semestral)';
    else if (m === 12) hint.textContent = '12 meses (1 ano)';
    else if (m === 24) hint.textContent = '24 meses (2 anos)';
    else if (m === 36) hint.textContent = '36 meses (3 anos)';
    else if (m === 60) hint.textContent = '60 meses (5 anos)';
    else {
      const anos = Math.floor(m / 12);
      const remMeses = m % 12;
      if (anos > 0 && remMeses > 0) {
        hint.textContent = `${m} meses (${anos}a ${remMeses}m)`;
      } else if (anos > 0) {
        hint.textContent = `${m} meses (${anos} ${anos === 1 ? 'ano' : 'anos'})`;
      } else {
        hint.textContent = `${m} meses`;
      }
    }
  }
}

/**
 * Atualiza o card de previsão de vencimento no formulário.
 */
export function updateExpirationPreview() {
  const previewText = document.getElementById('preview-date-text');
  const dataCompra = document.getElementById('doc-data-compra')?.value;
  const meses = parseInt(document.getElementById('doc-meses-garantia')?.value, 10) || 12;
  const radioSelected = document.querySelector('input[name="tipo_documento"]:checked')?.value || 'garantia';

  if (!previewText) return;

  if (!dataCompra) {
    previewText.textContent = 'Preencha a data e o prazo';
    return;
  }

  const dummy = calculateDocumentExpiration({
    data_compra: dataCompra,
    meses_garantia: meses,
    tipo_documento: radioSelected
  });

  const prefix = radioSelected === 'assinatura' ? 'Próxima renovação:' : 'Válido até:';
  previewText.textContent = `${prefix} ${formatDate(dummy.dataVencimento)} (${dummy.labelUrgencia})`;

  // Mantém sincronizada a data de vencimento no seletor personalizado se data de compra mudar
  const customExactDate = document.getElementById('input-custom-exact-date');
  if (customExactDate && dummy.dataVencimento && !document.activeElement?.isSameNode(customExactDate)) {
    customExactDate.value = dummy.dataVencimento;
  }
}

/**
 * 🗄️ Gavet — Módulo de Regras de Negócio e Alertas de Vencimento
 * Caminho: js/alerts.js
 */

/**
 * Calcula a data de vencimento precisa, dias restantes e nível de urgência.
 * Para assinaturas, projeta o próximo ciclo de renovação futuro.
 * 
 * @param {Object} doc - Objeto Documento
 * @returns {Object} Documento enriquecido com propriedades calculadas
 */
export function calculateDocumentExpiration(doc) {
  if (!doc.data_compra) {
    return {
      ...doc,
      dataVencimento: '',
      diasRestantes: 999,
      nivelUrgencia: 'seguro',
      labelUrgencia: 'Sem data'
    };
  }

  // Normalizar data base no fuso horário local (meia-noite)
  const [ano, mes, dia] = doc.data_compra.split('-').map(Number);
  const dataCompra = new Date(ano, mes - 1, dia);
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const meses = parseInt(doc.meses_garantia, 10) || 12;
  let dataVenc = new Date(dataCompra);

  if (doc.tipo_documento === 'assinatura') {
    // Para assinaturas: projeta os próximos ciclos (mensal, anual, etc) até encontrar uma data futura
    dataVenc.setMonth(dataVenc.getMonth() + meses);
    while (dataVenc < hoje) {
      dataVenc.setMonth(dataVenc.getMonth() + meses);
    }
  } else {
    // Para garantias e notas fiscais: data_compra + prazo em meses
    dataVenc.setMonth(dataVenc.getMonth() + meses);
  }

  // Calcular diferença em dias corridos
  const diffTime = dataVenc.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Formatar data ISO de vencimento YYYY-MM-DD
  const y = dataVenc.getFullYear();
  const m = String(dataVenc.getMonth() + 1).padStart(2, '0');
  const d = String(dataVenc.getDate()).padStart(2, '0');
  const dataVencimento = `${y}-${m}-${d}`;

  // Definir nível de urgência semântica e rótulo
  let nivelUrgencia = 'seguro';
  let labelUrgencia = '';

  if (diasRestantes < 0) {
    nivelUrgencia = 'expirado';
    const diasAtras = Math.abs(diasRestantes);
    labelUrgencia = diasAtras === 1 ? 'Expirou ontem' : `Expirou há ${diasAtras} dias`;
  } else if (diasRestantes === 0) {
    nivelUrgencia = 'critico';
    labelUrgencia = 'Vence hoje!';
  } else if (diasRestantes <= 7) {
    nivelUrgencia = 'critico';
    labelUrgencia = diasRestantes === 1 ? 'Vence amanhã' : `Vence em ${diasRestantes} dias`;
  } else if (diasRestantes <= 30) {
    nivelUrgencia = 'atencao';
    labelUrgencia = `Vence em ${diasRestantes} dias`;
  } else {
    nivelUrgencia = 'seguro';
    labelUrgencia = `Válido (${diasRestantes} dias)`;
  }

  return {
    ...doc,
    dataVencimento,
    diasRestantes,
    nivelUrgencia,
    labelUrgencia
  };
}

/**
 * Retorna apenas lembretes que vencem em <= maxDays ou expiraram recentemente (<= 7 dias).
 * Ordenados do mais urgente para o menos urgente.
 * 
 * @param {Array} documents - Lista de Documentos
 * @param {number} maxDays - Limite de dias (padrão 30)
 * @returns {Array} Documentos filtrados e ordenados por criticidade
 */
export function getUrgentAlerts(documents = [], maxDays = 30) {
  return documents
    .map(doc => (doc.diasRestantes !== undefined ? doc : calculateDocumentExpiration(doc)))
    .filter(doc => {
      // Exclui notas fiscais puras sem garantia relevante, foca em itens acionáveis
      if (doc.tipo_documento === 'nota_fiscal' && (!doc.meses_garantia || doc.meses_garantia <= 0)) {
        return false;
      }
      return doc.diasRestantes <= maxDays && doc.diasRestantes >= -7;
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/**
 * Calcula o patrimônio total sob garantia ativa e o custo mensal consolidado em assinaturas.
 * 
 * @param {Array} documents - Lista de Documentos
 * @returns {Object} { activeWarrantiesValue, monthlySubscriptionsValue, totalInvoicesValue, counts }
 */
export function calculateFinancialMetrics(documents = []) {
  let activeWarrantiesValue = 0;
  let activeWarrantiesCount = 0;
  let monthlySubscriptionsValue = 0;
  let monthlySubscriptionsCount = 0;
  let totalInvoicesValue = 0;
  let totalInvoicesCount = 0;

  documents.forEach(doc => {
    const enriched = doc.diasRestantes !== undefined ? doc : calculateDocumentExpiration(doc);
    const valor = parseFloat(enriched.valor) || 0;

    if (enriched.tipo_documento === 'garantia') {
      if (enriched.diasRestantes >= 0) {
        activeWarrantiesValue += valor;
        activeWarrantiesCount++;
      }
    } else if (enriched.tipo_documento === 'assinatura') {
      monthlySubscriptionsCount++;
      const meses = parseInt(enriched.meses_garantia, 10) || 1;
      // Normaliza para custo mensal (se anual divide por 12, se trimestral por 3, etc)
      monthlySubscriptionsValue += meses > 1 ? valor / meses : valor;
    } else if (enriched.tipo_documento === 'nota_fiscal') {
      totalInvoicesValue += valor;
      totalInvoicesCount++;
    }
  });

  return {
    activeWarrantiesValue,
    activeWarrantiesCount,
    monthlySubscriptionsValue,
    monthlySubscriptionsCount,
    totalInvoicesValue,
    totalInvoicesCount
  };
}

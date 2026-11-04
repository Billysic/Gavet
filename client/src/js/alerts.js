/**
 * Módulo de Regras de Negócio e Cálculo de Vencimentos - Gaveta Inteligente
 * Responsável pela auditoria temporal de garantias, assinaturas recorrentes e notas fiscais.
 */

/**
 * Converte string 'YYYY-MM-DD' em objeto Date local sem desvios de fuso horário UTC
 */
function parseLocalDate(dateString) {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return new Date(dateString);
  return new Date(year, month - 1, day);
}

/**
 * Formata um objeto Date para 'YYYY-MM-DD'
 */
function formatISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula a data exata de vencimento e o nível de urgência de um documento
 * @param {Object} doc Registro do documento
 * @returns {Object} Documento enriquecido com dataVencimento, diasRestantes e nivelUrgencia
 */
export function calculateDocumentExpiration(doc) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const purchaseDate = parseLocalDate(doc.data_compra);
  let expireDate = new Date(purchaseDate);

  const tipo = doc.tipo_documento || 'garantia';
  const meses = Number(doc.meses_garantia) || 0;

  if (tipo === 'assinatura') {
    // Para assinaturas, calculamos o próximo ciclo recorrente de renovação
    const cycleMonths = meses > 0 ? meses : 1; // Padrão: mensal (1 mês)
    expireDate = new Date(purchaseDate);

    // Avança os ciclos até encontrar a próxima renovação futura ou o dia de hoje
    while (expireDate < today) {
      expireDate.setMonth(expireDate.getMonth() + cycleMonths);
    }
  } else if (tipo === 'garantia') {
    // Prazo de garantia contratual ou padrão
    const garantiaMeses = meses > 0 ? meses : 12; // Padrão de eletrônicos: 12 meses
    expireDate.setMonth(expireDate.getMonth() + garantiaMeses);
  } else {
    // Nota Fiscal em geral: garantia legal mínima (3 meses CDC) ou prazo estipulado
    const prazoMeses = meses > 0 ? meses : 3;
    expireDate.setMonth(expireDate.getMonth() + prazoMeses);
  }

  // Cálculo de dias restantes para o vencimento
  const diffMs = expireDate.getTime() - today.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Classificação semântica de urgência
  let nivelUrgencia = 'seguro'; // > 30 dias
  let labelUrgencia = `Vence em ${diasRestantes} dias`;

  if (diasRestantes < 0) {
    nivelUrgencia = 'expirado';
    labelUrgencia = `Expirou há ${Math.abs(diasRestantes)} dia${Math.abs(diasRestantes) > 1 ? 's' : ''}`;
  } else if (diasRestantes === 0) {
    nivelUrgencia = 'hoje';
    labelUrgencia = 'Renova/Vence Hoje!';
  } else if (diasRestantes <= 7) {
    nivelUrgencia = 'critico';
    labelUrgencia = `Vence em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`;
  } else if (diasRestantes <= 30) {
    nivelUrgencia = 'atencao';
    labelUrgencia = `Vence em ${diasRestantes} dias`;
  }

  return {
    ...doc,
    dataVencimento: formatISODate(expireDate),
    diasRestantes,
    nivelUrgencia,
    labelUrgencia
  };
}

/**
 * Filtra e ordena os alertas que devem aparecer no Radar de Urgência (até 30 dias ou vencidos recentemente)
 * @param {Array} documents Lista bruta de documentos
 * @returns {Array} Lista filtrada e ordenada pelo mais urgente primeiro
 */
export function getUrgentAlerts(documents = []) {
  return documents
    .map(calculateDocumentExpiration)
    .filter(item => {
      // Itens que vencem nos próximos 30 dias ou que expiraram há no máximo 15 dias (para dar tempo de renovar/acionar)
      return item.diasRestantes <= 30 && item.diasRestantes >= -15;
    })
    .sort((a, b) => {
      // Prioridade: Vencendo hoje -> Vencendo em breve -> Já expirados
      return a.diasRestantes - b.diasRestantes;
    });
}

/**
 * Calcula o total financeiro sob risco (garantias ativas) e o gasto mensal estimado em assinaturas
 */
export function calculateFinancialMetrics(documents = []) {
  let activeWarrantiesValue = 0;
  let monthlySubscriptionsValue = 0;

  for (const doc of documents) {
    const enriched = calculateDocumentExpiration(doc);
    const valor = Number(enriched.valor) || 0;

    if (enriched.tipo_documento === 'garantia' && enriched.diasRestantes >= 0) {
      activeWarrantiesValue += valor;
    } else if (enriched.tipo_documento === 'assinatura') {
      const cycleMonths = Number(enriched.meses_garantia) || 1;
      monthlySubscriptionsValue += cycleMonths === 12 ? valor / 12 : valor;
    }
  }

  return {
    activeWarrantiesValue,
    monthlySubscriptionsValue
  };
}

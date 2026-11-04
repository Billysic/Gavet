/**
 * Camada de Comunicação com a API (Back-end & Gemini)
 */

/**
 * Envia imagem ou PDF para o endpoint do Express para OCR e extração estruturada via Gemini
 * @param {File} file Arquivo de imagem ou PDF
 * @returns {Promise<Object>} Dados estruturados: { loja, valor, data_compra, meses_garantia, tipo_documento }
 */
export async function sendFileToGemini(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/documents/analyze', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    const errorMsg = result.details || result.error || 'Erro ao processar documento na IA.';
    throw new Error(errorMsg);
  }

  return result.data;
}

/**
 * Sincroniza documentos locais do IndexedDB com o banco de dados do servidor
 * @param {Array} documents Lista de documentos pendentes
 */
export async function syncWithServer(documents = []) {
  if (documents.length === 0) return { success: true, count: 0 };

  const response = await fetch('/api/documents/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ documents })
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Falha ao sincronizar com o servidor.');
  }

  return result;
}

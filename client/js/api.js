/**
 * 🗄️ Gavet — Comunicação com a API e IA Gemini
 * Caminho: js/api.js
 * Endpoints: POST /api/documents/analyze | POST /api/documents/sync
 */

/**
 * Envia imagem (cupom/foto) ou PDF para o backend com Gemini 2.5 Flash OCR.
 * Comunica-se com o backend real, enviando token de autorização.
 * 
 * @param {File} file - Arquivo de imagem ou PDF
 * @returns {Promise<{ loja: string, valor: number, data_compra: string, meses_garantia: number, tipo_documento: string }>}
 */
export async function sendFileToGemini(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('gavet_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch('/api/documents/analyze', {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Você precisa estar logado para analisar comprovantes com a IA.');
      }
      if (response.status === 429) {
        throw new Error('Muitas análises em pouco tempo. Aguarde 1 minuto antes de enviar novamente.');
      }
      throw new Error(errData.error || `Servidor retornou status ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('[OCR Service Error]:', error);
    throw new Error(
      error.name === 'AbortError'
        ? 'O envio do arquivo excedeu o tempo limite. Tente novamente com um arquivo menor.'
        : (error.message || 'Não foi possível analisar o comprovante com a IA. Preencha os campos manualmente.')
    );
  }
}

/**
 * Envia lote de documentos locais para persistência no servidor (isolado por usuário).
 * 
 * @param {Array} documents - Lista de Documentos
 * @returns {Promise<{ success: boolean, count: number }>}
 */
export async function syncWithServer(documents = []) {
  if (!navigator.onLine || documents.length === 0) {
    return { success: false, count: 0, reason: 'offline' };
  }

  const token = localStorage.getItem('gavet_token');
  if (!token) {
    return { success: false, count: 0, reason: 'unauthenticated' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  try {
    const response = await fetch('/api/documents/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ documents })
    });

    if (!response.ok) {
      throw new Error(`Falha na sincronização: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('Erro ao sincronizar com servidor remoto:', error.message);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Cria uma nova conta no backend
 * @param {{ name: string, email: string, password: string }} data
 */
export async function apiRegister({ name, email, password }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao criar conta.');
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tempo de conexão esgotado ao contatar o servidor.');
    }
    throw err;
  }
}

/**
 * Realiza autenticação com email e senha no backend
 * @param {{ email: string, password: string }} credentials
 */
export async function apiLogin({ email, password }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao realizar login.');
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tempo de conexão esgotado ao contatar o servidor.');
    }
    throw err;
  }
}

/**
 * Valida o token e retorna o usuário logado
 * @param {string} token
 */
export async function apiGetMe(token) {
  if (!token) return null;
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  } catch {
    return null;
  }
}

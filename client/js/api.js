/**
 * 🗄️ Gavet — Comunicação com a API e IA Gemini
 * Caminho: js/api.js
 * Endpoints: POST /api/documents/analyze | POST /api/documents/sync
 */

/**
 * Envia imagem (cupom/foto) ou PDF para o backend com Gemini 2.5 Flash OCR.
 * Se o backend não estiver respondendo (ex: teste estático do front-end),
 * aciona uma simulação inteligente com dados realistas para não travar a UX.
 * 
 * @param {File} file - Arquivo de imagem ou PDF
 * @returns {Promise<{ loja: string, valor: number, data_compra: string, meses_garantia: number, tipo_documento: string }>}
 */
export async function sendFileToGemini(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch('/api/documents/analyze', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Servidor retornou status ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.warn('API /api/documents/analyze indisponível ou em modo offline. Usando fallback de simulação Gemini:', error.message);
    
    // Simulação visual de latência de IA (1.6 segundos)
    await new Promise(r => setTimeout(r, 1600));

    // Exemplos dinâmicos para demonstração offline
    const mockPresets = [
      {
        loja: 'Apple Brasil (Store Morumbi)',
        valor: 7499.00,
        data_compra: new Date().toISOString().split('T')[0],
        meses_garantia: 12,
        tipo_documento: 'garantia'
      },
      {
        loja: 'Amazon Prime Video & Retail',
        valor: 19.90,
        data_compra: new Date().toISOString().split('T')[0],
        meses_garantia: 1,
        tipo_documento: 'assinatura'
      },
      {
        loja: 'Dell Computadores do Brasil',
        valor: 4289.50,
        data_compra: new Date(Date.now() - 330 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        meses_garantia: 12,
        tipo_documento: 'garantia'
      },
      {
        loja: 'Fast Shop S.A.',
        valor: 2199.90,
        data_compra: new Date().toISOString().split('T')[0],
        meses_garantia: 24,
        tipo_documento: 'garantia'
      }
    ];

    const randomMock = mockPresets[Math.floor(Math.random() * mockPresets.length)];
    return randomMock;
  }
}

/**
 * Envia lote de documentos locais para persistência no SQLite do servidor.
 * 
 * @param {Array} documents - Lista de Documentos
 * @returns {Promise<{ success: boolean, count: number }>}
 */
export async function syncWithServer(documents = []) {
  if (!navigator.onLine || documents.length === 0) {
    return { success: false, count: 0, reason: 'offline' };
  }

  try {
    const response = await fetch('/api/documents/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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

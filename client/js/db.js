/**
 * 🗄️ Gavet — Persistência Local Offline-First (IndexedDB)
 * Caminho: js/db.js
 * Banco: GavetaInteligenteDB v1 | Store: documentos
 */

const DB_NAME = 'GavetaInteligenteDB';
const DB_VERSION = 1;
const STORE_NAME = 'documentos';

let dbInstance = null;

/**
 * Abre ou inicializa a conexão com o IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
export function getDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('tipo_documento', 'tipo_documento', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Salva ou atualiza um documento localmente.
 * Marca automaticamente como synced = 0 (pendente de envio ao servidor).
 * 
 * @param {Object} doc - Documento parcial ou completo
 * @returns {Promise<Object>} Documento persistido
 */
export async function saveDocument(doc) {
  const db = await getDB();
  const now = new Date().toISOString();

  const record = {
    id: doc.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    loja: doc.loja || 'Fornecedor Desconhecido',
    valor: typeof doc.valor === 'number' ? doc.valor : parseFloat(doc.valor) || 0,
    data_compra: doc.data_compra || now.split('T')[0],
    meses_garantia: parseInt(doc.meses_garantia, 10) || 12,
    tipo_documento: doc.tipo_documento || 'garantia',
    synced: 0,
    createdAt: doc.createdAt || now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve(record);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retorna todos os documentos locais ordenados pela data de criação decrescente.
 * @returns {Promise<Array>}
 */
export async function getAllDocuments() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result || [];
      // Ordena pelos criados mais recentemente
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(items);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Busca documento local por ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getDocumentById(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Exclui documento do IndexedDB.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteDocument(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retorna todos os itens onde synced === 0.
 * @returns {Promise<Array>}
 */
export async function getUnsyncedDocuments() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('synced');
    const request = index.getAll(0);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Marca o status do item como synced = 1.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function markDocumentSynced(id) {
  const db = await getDB();
  const doc = await getDocumentById(id);
  if (!doc) return;

  doc.synced = 1;
  doc.updatedAt = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(doc);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Semeia dados de demonstração caso a base esteja vazia na primeira utilização.
 * @param {Array} demoItems
 * @returns {Promise<Array>}
 */
export async function seedIfEmpty(demoItems = []) {
  const existing = await getAllDocuments();
  if (existing.length > 0) {
    return existing;
  }

  const db = await getDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const seeded = [];
  for (const item of demoItems) {
    store.put(item);
    seeded.push(item);
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(seeded);
    transaction.onerror = (e) => reject(e.target.error);
  });
}

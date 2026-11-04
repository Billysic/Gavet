import { openDB } from 'idb';

const DB_NAME = 'GavetaInteligenteDB';
const DB_VERSION = 1;
const STORE_NAME = 'documentos';

let dbPromise = null;

/**
 * Inicializa ou retorna a conexão com o IndexedDB
 */
export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[IndexedDB] Atualizando banco da versão ${oldVersion} para ${newVersion}`);
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          
          // Índices para buscas otimizadas e sincronização
          store.createIndex('by_tipo', 'tipo_documento');
          store.createIndex('by_data', 'data_compra');
          store.createIndex('by_synced', 'synced'); // 0 = pendente de sincronização, 1 = sincronizado
          store.createIndex('by_created', 'createdAt');
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Salva ou atualiza um documento no IndexedDB
 * @param {Object} doc Objeto com loja, valor, data_compra, meses_garantia, tipo_documento
 */
export async function saveDocument(doc) {
  const db = await getDB();
  const now = new Date().toISOString();

  const record = {
    id: doc.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    loja: doc.loja || 'Desconhecido',
    valor: Number(doc.valor) || 0,
    data_compra: doc.data_compra || now.split('T')[0],
    meses_garantia: doc.meses_garantia !== undefined ? Number(doc.meses_garantia) : 12,
    tipo_documento: doc.tipo_documento || 'garantia',
    synced: doc.synced !== undefined ? doc.synced : 0, // 0 = pendente de sync
    createdAt: doc.createdAt || now,
    updatedAt: now
  };

  await db.put(STORE_NAME, record);
  return record;
}

/**
 * Retorna todos os documentos salvos localmente ordenados por data de criação
 */
export async function getAllDocuments() {
  const db = await getDB();
  const docs = await db.getAll(STORE_NAME);
  
  // Ordena pelos mais recentes primeiro
  return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Busca um documento por ID
 */
export async function getDocumentById(id) {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/**
 * Remove um documento do IndexedDB
 */
export async function deleteDocument(id) {
  const db = await getDB();
  return db.delete(STORE_NAME, id);
}

/**
 * Retorna documentos pendentes de sincronização com o servidor (synced = 0)
 */
export async function getUnsyncedDocuments() {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('by_synced');
  return index.getAll(0);
}

/**
 * Marca um documento como sincronizado com a API remota
 */
export async function markDocumentSynced(id) {
  const db = await getDB();
  const doc = await db.get(STORE_NAME, id);
  if (doc) {
    doc.synced = 1;
    doc.updatedAt = new Date().toISOString();
    await db.put(STORE_NAME, doc);
  }
}

/**
 * Preenche dados iniciais se o banco estiver vazio na primeira abertura
 */
export async function seedIfEmpty(demoItems = []) {
  const existing = await getAllDocuments();
  if (existing.length === 0 && demoItems.length > 0) {
    for (const item of demoItems) {
      await saveDocument({ ...item, synced: 1 });
    }
    return getAllDocuments();
  }
  return existing;
}

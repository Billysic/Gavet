import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, '../../gaveta.sqlite');

let dbInstance = null;

/**
 * Salva o estado atual do banco SQLite no disco
 */
function persistDatabase() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE_PATH, buffer);
}

/**
 * Inicializa a conexão com o banco de dados SQLite
 */
export async function getDatabase() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Criação da tabela de documentos caso não exista
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      loja TEXT NOT NULL,
      valor REAL NOT NULL,
      data_compra TEXT NOT NULL,
      meses_garantia INTEGER NOT NULL,
      tipo_documento TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  persistDatabase();
  return dbInstance;
}

/**
 * Retorna todos os documentos salvos no SQLite
 */
export async function getAllDocuments() {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM documents ORDER BY created_at DESC');
  const documents = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    documents.push(row);
  }
  stmt.free();
  return documents;
}

/**
 * Insere ou atualiza um documento no SQLite
 */
export async function upsertDocument(doc) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO documents (id, loja, valor, data_compra, meses_garantia, tipo_documento, created_at, updated_at)
    VALUES ($id, $loja, $valor, $data_compra, $meses_garantia, $tipo_documento, $created_at, $updated_at)
    ON CONFLICT(id) DO UPDATE SET
      loja = excluded.loja,
      valor = excluded.valor,
      data_compra = excluded.data_compra,
      meses_garantia = excluded.meses_garantia,
      tipo_documento = excluded.tipo_documento,
      updated_at = excluded.updated_at;
  `);

  stmt.run({
    $id: doc.id || `server_${Date.now()}`,
    $loja: doc.loja || 'Desconhecido',
    $valor: Number(doc.valor) || 0,
    $data_compra: doc.data_compra || now.split('T')[0],
    $meses_garantia: Number(doc.meses_garantia) || 0,
    $tipo_documento: doc.tipo_documento || 'garantia',
    $created_at: doc.createdAt || doc.created_at || now,
    $updated_at: now
  });
  stmt.free();

  persistDatabase();
  return doc;
}

/**
 * Remove um documento pelo ID
 */
export async function deleteDocumentById(id) {
  const db = await getDatabase();
  const stmt = db.prepare('DELETE FROM documents WHERE id = $id');
  stmt.run({ $id: id });
  stmt.free();
  persistDatabase();
  return { success: true, id };
}

/**
 * Sincronização em lote dos dados vindos do IndexedDB (offline-first sync)
 */
export async function syncBatchDocuments(documents = []) {
  for (const doc of documents) {
    await upsertDocument(doc);
  }
  return getAllDocuments();
}

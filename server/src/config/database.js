import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

  // Criação das tabelas caso não existam
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

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      avatar TEXT,
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

/**
 * Encontra um usuário pelo e-mail
 */
export async function findUserByEmail(email) {
  const db = await getDatabase();
  const normalizedEmail = (email || '').toLowerCase().trim();
  const stmt = db.prepare('SELECT * FROM users WHERE email = $email LIMIT 1');
  stmt.bind({ $email: normalizedEmail });
  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();
  return user;
}

/**
 * Encontra um usuário pelo ID (sem expor o hash de senha)
 */
export async function findUserById(id) {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT id, name, email, avatar, created_at, updated_at FROM users WHERE id = $id LIMIT 1');
  stmt.bind({ $id: id });
  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();
  return user;
}

/**
 * Cria um novo usuário no SQLite
 */
export async function createUser({ name, email, password }) {
  const db = await getDatabase();
  const normalizedEmail = (email || '').toLowerCase().trim();
  
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('E-mail já cadastrado.');
  }

  const id = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const password_hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const parts = name.trim().split(/\s+/);
  const avatar = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, salt, avatar, created_at, updated_at)
    VALUES ($id, $name, $email, $password_hash, $salt, $avatar, $created_at, $updated_at)
  `);

  stmt.run({
    $id: id,
    $name: name.trim(),
    $email: normalizedEmail,
    $password_hash: password_hash,
    $salt: salt,
    $avatar: avatar,
    $created_at: now,
    $updated_at: now
  });
  stmt.free();
  persistDatabase();

  return { id, name: name.trim(), email: normalizedEmail, avatar, created_at: now };
}

/**
 * Valida a senha informada contra o hash armazenado
 */
export async function verifyUserPassword(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !user.password_hash || !user.salt) return null;

  try {
    const testHash = crypto.scryptSync(password, user.salt, 64).toString('hex');
    const isValid = crypto.timingSafeEqual(Buffer.from(user.password_hash, 'hex'), Buffer.from(testHash, 'hex'));
    if (!isValid) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      created_at: user.created_at
    };
  } catch (err) {
    console.error('Erro ao verificar senha:', err);
    return null;
  }
}

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env de server/.env ou da raiz
const serverEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else {
  dotenv.config();
}

let supabaseInstance = null;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  return { url, key };
}

/**
 * Verifica se as credenciais do Supabase foram configuradas no ambiente
 */
export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig();
  return Boolean(
    url &&
    key &&
    url.startsWith('http') &&
    !url.includes('sua-url-do-projeto')
  );
}

/**
 * Retorna o cliente Supabase inicializado
 */
export function getSupabase() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    const { url, key } = getSupabaseConfig();
    supabaseInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      }
    });
  }
  return supabaseInstance;
}

// ==========================================
// OPERAÇÕES DE DOCUMENTOS COM SUPABASE
// ==========================================

export async function supabaseGetAllDocuments() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar documentos no Supabase:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    loja: row.loja,
    valor: Number(row.valor),
    data_compra: row.data_compra,
    meses_garantia: row.meses_garantia,
    tipo_documento: row.tipo_documento,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

export async function supabaseUpsertDocument(doc) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const now = new Date().toISOString();
  const payload = {
    id: doc.id || `doc_${Date.now()}`,
    loja: doc.loja || 'Desconhecido',
    valor: Number(doc.valor) || 0,
    data_compra: doc.data_compra || now.split('T')[0],
    meses_garantia: Number(doc.meses_garantia) || 0,
    tipo_documento: doc.tipo_documento || 'garantia',
    updated_at: now
  };

  const { data, error } = await supabase
    .from('documents')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('Erro ao upsert documento no Supabase:', error);
    throw error;
  }

  return data;
}

export async function supabaseDeleteDocument(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar documento no Supabase:', error);
    throw error;
  }

  return { success: true, id };
}

export async function supabaseSyncBatch(documents = []) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const now = new Date().toISOString();
  const payload = documents.map(doc => ({
    id: doc.id || `doc_${Date.now()}`,
    loja: doc.loja || 'Desconhecido',
    valor: Number(doc.valor) || 0,
    data_compra: doc.data_compra || now.split('T')[0],
    meses_garantia: Number(doc.meses_garantia) || 0,
    tipo_documento: doc.tipo_documento || 'garantia',
    updated_at: now
  }));

  if (payload.length > 0) {
    const { error } = await supabase
      .from('documents')
      .upsert(payload);

    if (error) {
      console.error('Erro ao sincronizar lote no Supabase:', error);
      throw error;
    }
  }

  return supabaseGetAllDocuments();
}

// ==========================================
// OPERAÇÕES DE AUTENTICAÇÃO COM SUPABASE
// ==========================================

export async function supabaseRegister({ name, email, password }) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const parts = name.trim().split(/\s+/);
  const avatar = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name.trim(),
        avatar
      }
    }
  });

  if (authError) {
    throw new Error(authError.message || 'Falha ao cadastrar usuário no Supabase.');
  }

  const user = authData.user;
  if (!user) {
    throw new Error('Usuário não retornado pelo Supabase.');
  }

  // Tenta sincronizar com a tabela public.profiles
  try {
    await supabase.from('profiles').upsert({
      id: user.id,
      name: name.trim(),
      email: email.trim(),
      avatar
    });
  } catch (err) {
    console.warn('Gatilho de perfil do Supabase cuidará da criação de profile:', err.message);
  }

  return {
    user: {
      id: user.id,
      name: name.trim(),
      email: email.trim(),
      avatar,
      created_at: user.created_at
    },
    token: authData.session?.access_token || `gavet_sb_${user.id}`
  };
}

export async function supabaseLogin({ email, password }) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    throw new Error(authError.message || 'Credenciais inválidas.');
  }

  const user = authData.user;
  let name = user.user_metadata?.name || user.email.split('@')[0];
  let avatar = user.user_metadata?.avatar || name.slice(0, 2).toUpperCase();

  // Consulta se há perfil detalhado em public.profiles
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', user.id)
      .single();

    if (profile) {
      name = profile.name || name;
      avatar = profile.avatar || avatar;
    }
  } catch {
    // Mantém os metadados da autenticação
  }

  return {
    user: {
      id: user.id,
      name,
      email: user.email,
      avatar,
      created_at: user.created_at
    },
    token: authData.session?.access_token || `gavet_sb_${user.id}`
  };
}

export async function supabaseGetMe(token) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  let name = user.user_metadata?.name || user.email.split('@')[0];
  let avatar = user.user_metadata?.avatar || name.slice(0, 2).toUpperCase();

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', user.id)
      .single();

    if (profile) {
      name = profile.name || name;
      avatar = profile.avatar || avatar;
    }
  } catch {
    // Silencioso
  }

  return {
    id: user.id,
    name,
    email: user.email,
    avatar,
    created_at: user.created_at
  };
}

/**
 * Remove permanentemente a conta de um usuário no Supabase Auth e em cascata nas tabelas
 */
export async function supabaseDeleteUser(token) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    throw new Error('Sessão expirada ou usuário não autenticado.');
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('Erro ao excluir usuário no Supabase:', deleteError);
    throw new Error(deleteError.message || 'Falha ao deletar usuário no Supabase.');
  }

  return { success: true, userId: user.id };
}

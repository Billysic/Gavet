import { extractDocumentData } from '../config/gemini.js';
import {
  getAllDocuments,
  upsertDocument,
  deleteDocumentById,
  syncBatchDocuments
} from '../config/database.js';
import {
  isSupabaseConfigured,
  supabaseGetAllDocuments,
  supabaseUpsertDocument,
  supabaseDeleteDocument,
  supabaseSyncBatch
} from '../config/supabase.js';

/**
 * Processa upload de imagem ou PDF e extrai dados usando a API do Gemini
 */
export async function analyzeDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado. Envie uma foto ou arquivo PDF via campo "file".'
      });
    }

    const { buffer, mimetype, originalname } = req.file;

    console.log(`[OCR] Processando arquivo "${originalname}" (${mimetype}, ${buffer.length} bytes)...`);

    const extractedData = await extractDocumentData(buffer, mimetype);

    return res.status(200).json({
      success: true,
      message: 'Documento analisado com sucesso!',
      data: extractedData
    });
  } catch (error) {
    console.error('[OCR Error] Falha na extração de dados:', error.message);

    // Se o usuário ainda não colocou a chave no .env, devolvemos instrução clara
    if (error.message.includes('GEMINI_API_KEY')) {
      return res.status(401).json({
        success: false,
        error: 'GEMINI_API_KEY ausente ou não configurada.',
        details: 'Adicione sua chave no arquivo server/.env para habilitar a extração via IA.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao processar documento com Gemini AI.',
      details: error.message
    });
  }
}

/**
 * Sincroniza lista de documentos do IndexedDB para o banco SQLite do servidor
 */
export async function syncDocuments(req, res) {
  try {
    const { documents } = req.body;

    if (!Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: 'O corpo da requisição deve conter um array "documents".'
      });
    }

    const updatedList = isSupabaseConfigured()
      ? await supabaseSyncBatch(documents)
      : await syncBatchDocuments(documents);

    return res.status(200).json({
      success: true,
      message: `${documents.length} documento(s) sincronizado(s) com sucesso.`,
      count: updatedList.length,
      data: updatedList,
      source: isSupabaseConfigured() ? 'supabase' : 'sqlite'
    });
  } catch (error) {
    console.error('[Sync Error] Falha na sincronização:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao sincronizar com o banco de dados do servidor.',
      details: error.message
    });
  }
}

/**
 * Retorna todos os documentos persistidos no servidor
 */
export async function listDocuments(req, res) {
  try {
    const documents = isSupabaseConfigured()
      ? await supabaseGetAllDocuments()
      : await getAllDocuments();

    return res.status(200).json({
      success: true,
      data: documents,
      source: isSupabaseConfigured() ? 'supabase' : 'sqlite'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar documentos no servidor.',
      details: error.message
    });
  }
}

/**
 * Remove um documento pelo ID
 */
export async function removeDocument(req, res) {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured()) {
      await supabaseDeleteDocument(id);
    } else {
      await deleteDocumentById(id);
    }
    return res.status(200).json({
      success: true,
      message: `Documento ${id} removido do servidor.`,
      source: isSupabaseConfigured() ? 'supabase' : 'sqlite'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao remover documento.',
      details: error.message
    });
  }
}

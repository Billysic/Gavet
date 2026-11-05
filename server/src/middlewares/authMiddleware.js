import { findUserBySessionToken } from '../config/database.js';
import { isSupabaseConfigured, supabaseGetMe } from '../config/supabase.js';

/**
 * Middleware de Autenticação Obrigatória
 * Interrompe qualquer requisição não autenticada com HTTP 401 Unauthorized
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Token não fornecido.'
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou vazio.'
      });
    }

    // Se Supabase estiver ativo, valida com o Supabase Auth
    if (isSupabaseConfigured()) {
      const user = await supabaseGetMe(token);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Sessão inválida ou expirada no Supabase.'
        });
      }
      req.user = user;
      return next();
    }

    // Modo SQLite Local: Validação de Token Criptográfico persistido na tabela de sessões
    const user = await findUserBySessionToken(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Sessão expirada ou inválida.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[AuthMiddleware Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro de validação de acesso.'
    });
  }
}

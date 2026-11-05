import crypto from 'node:crypto';
import {
  createUser,
  findUserByEmail,
  verifyUserPassword,
  findUserById
} from '../config/database.js';
import {
  isSupabaseConfigured,
  supabaseRegister,
  supabaseLogin,
  supabaseGetMe
} from '../config/supabase.js';

/**
 * Cria uma nova conta de usuário
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'O nome completo deve conter ao menos 2 caracteres.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A senha de acesso deve ter pelo menos 6 caracteres.' });
    }

    // Se Supabase estiver configurado, utiliza o Supabase Auth
    if (isSupabaseConfigured()) {
      const result = await supabaseRegister({
        name: name.trim(),
        email: email.trim(),
        password
      });

      return res.status(201).json({
        success: true,
        message: 'Conta criada com sucesso no Supabase!',
        user: result.user,
        token: result.token,
        provider: 'supabase'
      });
    }

    // Modo SQLite Local
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login ou use outro.' });
    }

    const user = await createUser({
      name: name.trim(),
      email: email.trim(),
      password
    });

    const token = `gavet_${user.id}_${crypto.randomBytes(16).toString('hex')}`;

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso no Gavet!',
      user,
      token,
      provider: 'sqlite'
    });
  } catch (error) {
    console.error('Erro no registro do usuário:', error);
    return res.status(500).json({ error: error.message || 'Erro ao criar conta no servidor.' });
  }
}

/**
 * Autentica o usuário com email e senha
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe o e-mail e a senha cadastrados.' });
    }

    // Se Supabase estiver configurado, autentica via Supabase Auth
    if (isSupabaseConfigured()) {
      const result = await supabaseLogin({
        email: email.trim(),
        password
      });

      return res.status(200).json({
        success: true,
        message: 'Acesso autorizado via Supabase!',
        user: result.user,
        token: result.token,
        provider: 'supabase'
      });
    }

    // Modo SQLite Local
    const user = await verifyUserPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos. Verifique suas credenciais.' });
    }

    const token = `gavet_${user.id}_${crypto.randomBytes(16).toString('hex')}`;

    return res.status(200).json({
      success: true,
      message: 'Acesso autorizado!',
      user,
      token,
      provider: 'sqlite'
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao autenticar usuário.' });
  }
}

/**
 * Retorna os dados do usuário atual a partir do token
 * GET /api/auth/me
 */
export async function getMe(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Nenhum token fornecido.' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (isSupabaseConfigured()) {
      const user = await supabaseGetMe(token);
      if (user) {
        return res.status(200).json({ success: true, user, provider: 'supabase' });
      }
    }

    const match = token.match(/^gavet_(user_\d+_[a-f0-9]+)_/);
    if (match && match[1]) {
      const user = await findUserById(match[1]);
      if (user) {
        return res.status(200).json({ success: true, user, provider: 'sqlite' });
      }
    }

    return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  } catch (error) {
    console.error('Erro em getMe:', error);
    return res.status(500).json({ error: 'Falha ao verificar dados da sessão.' });
  }
}

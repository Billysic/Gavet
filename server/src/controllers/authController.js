import {
  createUser,
  findUserByEmail,
  verifyUserPassword,
  findUserById,
  createSession,
  findUserBySessionToken,
  deleteSession,
  deleteUserAccount
} from '../config/database.js';
import {
  isSupabaseConfigured,
  supabaseRegister,
  supabaseLogin,
  supabaseGetMe,
  supabaseDeleteUser
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
      try {
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
      } catch (err) {
        const msg = err.message || '';
        const lower = msg.toLowerCase();
        if (
          lower.includes('already registered') ||
          lower.includes('already exists') ||
          lower.includes('user already registered')
        ) {
          return res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login ou use outro.' });
        }
        if (lower.includes('rate limit') || lower.includes('too many requests')) {
          return res.status(429).json({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' });
        }
        if (lower.includes('weak password') || lower.includes('password should be')) {
          return res.status(400).json({ error: 'A senha informada não atende aos requisitos mínimos de segurança.' });
        }
        return res.status(400).json({ error: msg || 'Falha ao criar conta no Supabase.' });
      }
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

    const token = await createSession(user.id);

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
      try {
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
      } catch (err) {
        const msg = err.message || '';
        const lower = msg.toLowerCase();
        if (
          lower.includes('invalid login credentials') ||
          lower.includes('credentials') ||
          lower.includes('incorret') ||
          lower.includes('invalid credentials')
        ) {
          return res.status(401).json({ error: 'E-mail ou senha incorretos. Verifique suas credenciais.' });
        }
        if (lower.includes('rate limit') || lower.includes('too many requests')) {
          return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.' });
        }
        if (lower.includes('email not confirmed')) {
          return res.status(403).json({ error: 'Endereço de e-mail ainda não confirmado. Verifique sua caixa de entrada.' });
        }
        return res.status(400).json({ error: msg || 'Falha ao autenticar no Supabase.' });
      }
    }

    // Modo SQLite Local
    const user = await verifyUserPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos. Verifique suas credenciais.' });
    }

    const token = await createSession(user.id);

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

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (isSupabaseConfigured()) {
      const user = await supabaseGetMe(token);
      if (user) {
        return res.status(200).json({ success: true, user, provider: 'supabase' });
      }
      return res.status(401).json({ error: 'Sessão Supabase inválida ou expirada.' });
    }

    // Modo SQLite: Validação estrita por correspondência de sessão no banco
    const user = await findUserBySessionToken(token);
    if (user) {
      return res.status(200).json({ success: true, user, provider: 'sqlite' });
    }

    return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  } catch (error) {
    console.error('Erro em getMe:', error);
    return res.status(500).json({ error: 'Falha ao verificar dados da sessão.' });
  }
}

/**
 * Exclui a conta do usuário e limpa seus registros associados
 * DELETE /api/auth/account
 */
export async function deleteAccount(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Nenhum token fornecido para exclusão.' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Se Supabase estiver ativo
    if (isSupabaseConfigured()) {
      try {
        await supabaseDeleteUser(token);
        return res.status(200).json({
          success: true,
          message: 'Sua conta e registros foram excluídos permanentemente do Supabase.'
        });
      } catch (sbErr) {
        console.warn('Erro ao excluir no Supabase:', sbErr.message);
        return res.status(400).json({ error: sbErr.message || 'Falha ao excluir conta no Supabase.' });
      }
    }

    // Modo SQLite: Valida token na tabela de sessões e exclui dados vinculados
    const user = await findUserBySessionToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida para exclusão de conta.' });
    }

    await deleteUserAccount(user.id);
    return res.status(200).json({
      success: true,
      message: 'Conta e registros excluídos com sucesso do sistema local.'
    });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao excluir conta.' });
  }
}

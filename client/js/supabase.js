import { createClient } from '@supabase/supabase-js';

// Credenciais públicas do Supabase (Anon Key é segura para expor no cliente)
export const SUPABASE_URL = 'https://qytgfeusiiglfamsdcyo.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_UNtAt1udtFg4x95Wj8NsqA_mVHgtNg0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

/**
 * Inicia o fluxo de autenticação OAuth com o Google
 */
export async function loginWithGoogle() {
  const redirectUrl = window.location.origin;
  console.log('[Supabase OAuth] Redirecionando para autenticação Google. Retorno em:', redirectUrl);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    console.error('[Supabase OAuth] Erro:', error);
    throw error;
  }

  return data;
}

/**
 * Captura e processa o retorno do OAuth do Google a partir da URL
 */
export async function checkOAuthCallback() {
  // Se a URL contiver hash de tokens ou code PKCE
  const hasAuthParams = window.location.hash.includes('access_token') ||
                        window.location.search.includes('code=');

  if (!hasAuthParams) return null;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    const user = session.user;
    const name = user.user_metadata?.full_name || 
                 user.user_metadata?.name || 
                 user.email.split('@')[0];

    // Se tiver foto no Google, podemos utilizar como avatar ou derivar iniciais
    const photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    let avatar = 'BC';

    if (photoUrl) {
      avatar = photoUrl;
    } else {
      const parts = name.trim().split(/\s+/);
      avatar = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    }

    // Limpa parâmetros de autenticação da URL sem recarregar a página
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    return {
      user: {
        id: user.id,
        name,
        email: user.email,
        avatar
      },
      token: session.access_token
    };
  } catch (err) {
    console.warn('[Supabase OAuth] Falha ao processar callback:', err);
    return null;
  }
}

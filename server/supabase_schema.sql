-- =============================================================================
-- 🗄️ GAVET — SCHEMA DO BANCO DE DADOS SUPABASE (PostgreSQL)
-- Copie e cole este script no "SQL Editor" do painel do seu projeto no Supabase
-- =============================================================================

-- 1. Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Perfis de Usuário (vinculada ao auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar TEXT DEFAULT 'BC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Documentos (Garantias, Notas Fiscais e Assinaturas)
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  loja TEXT NOT NULL,
  valor NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  data_compra DATE NOT NULL,
  meses_garantia INTEGER NOT NULL DEFAULT 0,
  tipo_documento TEXT NOT NULL DEFAULT 'garantia',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Função e Gatilho para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Configuração de Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso seguro para profiles (restritas ao próprio usuário autenticado)
DROP POLICY IF EXISTS "Permitir leitura de perfis" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserção e atualização de perfis" ON public.profiles;
DROP POLICY IF EXISTS "Leitura de perfil do proprietario" ON public.profiles;
DROP POLICY IF EXISTS "Insercao de perfil do proprietario" ON public.profiles;
DROP POLICY IF EXISTS "Atualizacao de perfil do proprietario" ON public.profiles;

CREATE POLICY "Leitura de perfil do proprietario" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Insercao de perfil do proprietario" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Atualizacao de perfil do proprietario" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Políticas de acesso seguro para documents (isolamento estrito de tenant por user_id)
DROP POLICY IF EXISTS "Permitir leitura de documentos" ON public.documents;
DROP POLICY IF EXISTS "Permitir inserção de documentos" ON public.documents;
DROP POLICY IF EXISTS "Permitir atualização de documentos" ON public.documents;
DROP POLICY IF EXISTS "Permitir exclusão de documentos" ON public.documents;
DROP POLICY IF EXISTS "Leitura de documentos do proprietario" ON public.documents;
DROP POLICY IF EXISTS "Insercao de documentos do proprietario" ON public.documents;
DROP POLICY IF EXISTS "Atualizacao de documentos do proprietario" ON public.documents;
DROP POLICY IF EXISTS "Exclusao de documentos do proprietario" ON public.documents;

CREATE POLICY "Leitura de documentos do proprietario" 
  ON public.documents FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Insercao de documentos do proprietario" 
  ON public.documents FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Atualizacao de documentos do proprietario" 
  ON public.documents FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Exclusao de documentos do proprietario" 
  ON public.documents FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 6. Gatilho automático ao criar usuário pelo Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar', UPPER(SUBSTRING(NEW.email FROM 1 FOR 2)))
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

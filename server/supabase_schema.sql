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

-- Políticas de acesso público/autenticado para profiles
CREATE POLICY "Permitir leitura de perfis" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Permitir inserção e atualização de perfis" 
  ON public.profiles FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Políticas de acesso público/autenticado para documents
CREATE POLICY "Permitir leitura de documentos" 
  ON public.documents FOR SELECT 
  USING (true);

CREATE POLICY "Permitir inserção de documentos" 
  ON public.documents FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de documentos" 
  ON public.documents FOR UPDATE 
  USING (true);

CREATE POLICY "Permitir exclusão de documentos" 
  ON public.documents FOR DELETE 
  USING (true);

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

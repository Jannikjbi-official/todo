-- ═══════════════════════════════════════════════════
--  VAULTIFY — Supabase Schema Setup
--  Führe dieses SQL im Supabase SQL Editor aus
--  (Dashboard → SQL Editor → New Query → Run)
-- ═══════════════════════════════════════════════════

-- ── 1. CATEGORIES ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  emoji      TEXT,
  color      TEXT DEFAULT '#5b6ef5',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. ITEMS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  price       NUMERIC(10,2) DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  url         TEXT,
  previews    JSONB DEFAULT '[]'::jsonb,
  notes       TEXT DEFAULT '',
  images      TEXT[] DEFAULT '{}',
  bought      BOOLEAN DEFAULT FALSE,
  favorite    BOOLEAN DEFAULT FALSE,
  priority    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_updated_at ON public.items;
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 3. PROFILES (extends auth.users) ─────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  email      TEXT,
  role       TEXT DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 4. ROW LEVEL SECURITY ────────────────────────

-- Categories: everyone can read, only authenticated can write
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (true);

-- Items: everyone authenticated can read/write (shared workspace)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read items"
  ON public.items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert items"
  ON public.items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update items"
  ON public.items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete items"
  ON public.items FOR DELETE
  TO authenticated
  USING (true);

-- Profiles: users can only read all profiles, update their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ── 5. REALTIME ──────────────────────────────────
-- Enable Realtime for items table
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;

-- ── 6. STORAGE BUCKET ────────────────────────────
-- Run this in Dashboard → Storage → Create Bucket
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('vaultify', 'vaultify', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload/read
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vaultify');

CREATE POLICY "Anyone can view images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vaultify');

CREATE POLICY "Authenticated users can delete their uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'vaultify');

-- ── 7. INDEXES ───────────────────────────────────
CREATE INDEX IF NOT EXISTS items_category_idx ON public.items(category_id);
CREATE INDEX IF NOT EXISTS items_bought_idx   ON public.items(bought);
CREATE INDEX IF NOT EXISTS items_created_idx  ON public.items(created_at DESC);

-- ══════════════════════════════════════════════════
--  SETUP COMPLETE ✓
--  Jetzt die App öffnen und Supabase-Daten eingeben
-- ══════════════════════════════════════════════════

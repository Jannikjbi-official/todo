-- ═══════════════════════════════════════════════════════
--  VAULTIFY — Admin Fix & Profiles Patch
--  Führe dieses SQL im Supabase SQL Editor aus
--  Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════

-- ── SCHRITT 1: Profiles-Tabelle sicherstellen ──────────
-- (Falls noch nicht vorhanden aus dem Haupt-Schema)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  email      TEXT,
  role       TEXT DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SCHRITT 2: Bestehende Auth-User in profiles eintragen
-- (Falls der Trigger nicht gefeuert hat)
INSERT INTO public.profiles (id, name, email, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.email,
  'member'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- ── SCHRITT 3: RLS Policies sicherstellen ──────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop alte Policies falls vorhanden
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;

-- Neu anlegen
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ── SCHRITT 4: DEINEN USER ALS ADMIN SETZEN ────────────
-- ⚠️  WICHTIG: Ersetze 'deine@email.de' mit deiner echten E-Mail!
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'deine@email.de';  -- ← HIER DEINE E-MAIL EINTRAGEN

-- Bestätigung anzeigen
SELECT id, name, email, role FROM public.profiles ORDER BY created_at;

-- ═══════════════════════════════════════════════════════
--  Nach dem Ausführen:
--  1. Browser-Tab der App neu laden (F5)
--  2. Neu einloggen
--  3. Admin Panel erscheint jetzt in der Sidebar
-- ═══════════════════════════════════════════════════════

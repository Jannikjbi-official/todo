# 🚀 Vaultify — Setup & Architektur Dokumentation

## Übersicht

**Vaultify** ist eine vollständige SaaS-Web-App die Todo/Task Management, Content Management und Finanz-Tracking kombiniert.

---

## 📁 Dateistruktur

```
vaultify/
├── index.html        → Haupt-HTML (alle Screens & Modals)
├── style.css         → Design System, Komponenten, Layout
├── app.js            → Gesamte App-Logik (State, Render, Data)
├── manifest.json     → PWA Manifest (installierbar)
└── SETUP.md          → Diese Dokumentation
```

---

## ⚡ Schnellstart (Standalone)

### Option 1 — Browser (lokal)
1. Lade alle 4 Dateien in einen Ordner herunter
2. Öffne `index.html` direkt im Browser
3. **Fertig!** Die App läuft komplett lokal

### Option 2 — Live Server (empfohlen für Dev)
```bash
# Mit VS Code Live Server Extension:
Rechtsklick index.html → "Open with Live Server"

# Oder mit Node.js:
npx serve .

# Oder mit Python:
python -m http.server 8080
```

### Option 3 — Statisches Hosting (Production)
Lade alle Dateien auf:
- **Netlify** (Drop & Deploy unter app.netlify.com)
- **GitHub Pages**
- **Vercel** (`vercel deploy`)
- **Cloudflare Pages**

---

## 🔐 Demo-Zugänge

| Rolle   | E-Mail                    | Passwort   |
|---------|---------------------------|------------|
| Admin   | `admin@vaultify.app`      | `admin123` |
| Member  | `user@vaultify.app`       | `user123`  |

**Admin** hat Zugriff auf das Admin Panel (Kategorien verwalten, alle Einträge, Statistiken).

---

## 💰 Finanz-Berechnungslogik

### Kernformel (in `calcStats()` in app.js):

```javascript
const items  = getItems();
const total  = items.reduce((sum, item) => sum + item.price, 0);
const bought = items.filter(i => i.bought)
                    .reduce((sum, item) => sum + item.price, 0);
const open   = total - bought;
const pct    = total > 0 ? Math.round((bought / total) * 100) : 0;
```

### Echtzeit-Update-Flow:

```
User klickt "Gekauft" Toggle
        ↓
toggleBought(itemId) wird aufgerufen
        ↓
item.bought wird invertiert (true/false)
        ↓
DB.set('items', updatedItems) → localStorage
        ↓
refreshAll() → re-rendert ALLE Komponenten
        ↓
calcStats() berechnet neue Summen
        ↓
UI aktualisiert: stat-total, stat-bought, stat-open, progress-fill
```

**Wichtig:** Kein Page-Reload nötig. Alle Werte aktualisieren sich sofort.

---

## 🗄️ Datenstruktur

### User
```json
{
  "id": "u1",
  "name": "Admin",
  "email": "admin@vaultify.app",
  "password": "admin123",
  "role": "admin"
}
```

### Kategorie
```json
{
  "id": "c1",
  "name": "Elektronik",
  "emoji": "💻",
  "color": "#6366f1"
}
```

### Item (Eintrag)
```json
{
  "id": "i1",
  "name": "MacBook Pro M3",
  "price": 2199,
  "desc": "14-Zoll, Apple M3 Chip...",
  "url": "https://apple.com",
  "categoryId": "c1",
  "images": ["https://...jpg"],
  "bought": false,
  "favorite": true,
  "createdAt": 1703000000000
}
```

---

## 🏗️ Architektur

### Pattern: Reactive State + localStorage

```
[User Action]
     ↓
[Event Handler in app.js]
     ↓
[State Update + DB.set()]
     ↓
[refreshAll() → renderX()]
     ↓
[DOM Update via innerHTML]
```

### Key-Funktionen im Überblick:

| Funktion              | Beschreibung |
|-----------------------|--------------|
| `initDB()`            | Seed-Daten beim ersten Start |
| `calcStats()`         | **Finanzberechnung** (total, bought, open, %) |
| `filteredItems()`     | Filter + Suche auf Items anwenden |
| `renderDashboard()`   | Stats, Recent Items, Category Breakdown |
| `renderItemsPage()`   | Grid/Liste, Filter-Chips, Kategoriefilter |
| `renderCard(item)`    | Einzelne Item-Karte als HTML-String |
| `toggleBought(id)`    | ✅ Echtzeit Kauf-Toggle + Neuberechnung |
| `toggleFavorite(id)`  | ⭐ Favorit setzen |
| `saveItem()`          | Erstellen/Bearbeiten mit Validierung |
| `saveCategory()`      | Kategorie erstellen/bearbeiten |
| `refreshAll()`        | Komplettes Re-Render aller aktiven Views |

---

## 🔌 Supabase Integration (Next Step)

### 1. Supabase Setup

```bash
npm install @supabase/supabase-js
```

### 2. DB Schema (SQL)

```sql
-- Users (wird von Supabase Auth verwaltet)

-- Categories
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items
CREATE TABLE items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  url TEXT,
  images TEXT[],
  category_id UUID REFERENCES categories(id),
  bought BOOLEAN DEFAULT FALSE,
  favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own items"
  ON items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 3. Supabase Client ersetzen

```javascript
// Ersetze DB.get/set durch Supabase-Calls:
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Items laden:
const { data: items } = await supabase
  .from('items')
  .select('*, categories(*)')
  .order('created_at', { ascending: false })

// Item erstellen:
const { data } = await supabase
  .from('items')
  .insert([{ name, price, ...rest }])

// Realtime:
supabase
  .channel('items')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, payload => {
    refreshAll() // Echtzeit-Update für alle
  })
  .subscribe()
```

---

## 🎨 Design System

| Token | Wert |
|-------|------|
| `--accent` | `#6366f1` (Indigo) |
| `--bg-base` | `#0a0a0f` (Tief-Schwarz) |
| `--bg-elevated` | `#111118` |
| `--text-primary` | `#f0f0f8` |
| `--green` | `#22c55e` (Gekauft) |
| `--amber` | `#f59e0b` (Offen) |
| Font Display | **Syne** (Headings) |
| Font Body | **DM Sans** (Text) |

---

## 📱 PWA Installation

Die App ist als PWA konfiguriert:
1. In Chrome/Edge: Adressleiste → Install-Icon klicken
2. Oder: Browser-Menü → "Zum Startbildschirm hinzufügen"
3. App startet dann wie eine native App

---

## 🧪 Beispieldaten

Beim ersten Start werden automatisch geladen:
- **5 Kategorien:** Elektronik, Kleidung, Haushalt, Gaming, Bücher
- **5 Items:** MacBook Pro (€2.199), Sony WH-1000XM5 (€349, gekauft), Nike Air Max (€129), PS5 (€499, gekauft), Atomic Habits (€18)
- **Startfinanzübersicht:** €3.194 gesamt, €848 gekauft, €2.346 noch offen

---

## ✅ Feature Checkliste

- [x] Login / Registrierung
- [x] Admin & Member Rollen
- [x] Item CRUD (Erstellen, Lesen, Bearbeiten, Löschen)
- [x] Kategorie CRUD
- [x] Finanzberechnung (Total, Gekauft, Offen) in Echtzeit
- [x] Fortschrittsbalken
- [x] Filter (Alle / Offen / Gekauft / Favoriten)
- [x] Kategoriefilter
- [x] Volltextsuche
- [x] Grid & Listen Ansicht
- [x] Dark Mode (Standard)
- [x] Admin Dashboard mit Statistiken
- [x] Toast-Benachrichtigungen
- [x] Form-Validierung
- [x] Session-Persistenz (Auto-Login)
- [x] PWA Manifest
- [x] Responsive Design
- [x] Sidebar collapse
- [x] Mehrere Bilder pro Eintrag

/* ═══════════════════════════════════════════════════════
   JannikJBI v3 — Supabase-First Architecture
   ─ Auth:       Supabase Auth
   ─ Data:       Supabase Postgres (items, categories)
   ─ Realtime:   Supabase Realtime channels
   ─ Images:     Supabase Storage  (bucket: "jannikjbi")
   ─ Fallback:   No localStorage for content — only for
                 API keys (oai) and UI prefs (view/sort)
   ─ Seed:       Auto-seeds categories + Script + MLO
                 items on first admin login via DB flag
═══════════════════════════════════════════════════════ */

let _sb = null; // set via initSupabase()

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

const sbReady = () => !!_sb;

const SB_URL = typeof CONFIG !== 'undefined' ? CONFIG.SB_URL : '';
const SB_KEY = typeof CONFIG !== 'undefined' ? CONFIG.SB_KEY : '';


// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  STORAGE UTILITY (LOCAL FALLBACK)
// ═══════════════════════════════════════════
const LStore = {
  get: (k) => JSON.parse(localStorage.getItem('jbi_' + k) || '[]'),
  set: (k, v) => localStorage.setItem('jbi_' + k, JSON.stringify(v)),
  isLocal: () => !localStorage.getItem('sb_url') || !localStorage.getItem('sb_akey')
};

async function initSupabase() {
  try {
    if (!window.supabase) {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
    }
    _sb = window.supabase.createClient(SB_URL, SB_KEY);
    return true;
  } catch(e) {
    console.error('Supabase init failed:', e);
    return false;
  }
}


// ═══════════════════════════════════════════
//  SUPABASE DATA LAYER
//  All functions return plain JS objects/arrays
// ═══════════════════════════════════════════
const SB = {
  // ── CATEGORIES ──
  async getCats() {
    if (!sbReady()) return LStore.get('cats');
    const { data, error } = await _sb.from('categories').select('*').order('name');
    if (error) { console.error(error); return LStore.get('cats'); }
    return data;
  },
  async upsertCat(cat) {
    if (!sbReady()) {
      const cats = LStore.get('cats');
      if (!cat.id) cat.id = uid();
      const idx = cats.findIndex(c => c.id === cat.id);
      if (idx > -1) cats[idx] = cat; else cats.push(cat);
      LStore.set('cats', cats);
      return cat;
    }
    const { data, error } = await _sb.from('categories').upsert(cat).select().single();
    if (error) throw error;
    return data;
  },
  async deleteCat(id) {
    if (!sbReady()) {
      LStore.set('cats', LStore.get('cats').filter(c => c.id !== id));
      const items = LStore.get('items');
      items.forEach(i => { if (i.category_id === id) i.category_id = null; });
      LStore.set('items', items);
      return;
    }
    await _sb.from('items').update({ category_id: null }).eq('category_id', id);
    const { error } = await _sb.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  // ── ITEMS ──
  async getItems() {
    if (!sbReady()) return (LStore.get('items') || []).map(normalizeItem);
    const { data, error } = await _sb.from('items').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return (LStore.get('items') || []).map(normalizeItem); }
    return (data||[]).map(normalizeItem);
  },
  async upsertItem(item) {
    if (!sbReady()) {
      const items = LStore.get('items');
      const row = denormalizeItem(item);
      if (!row.id) {
        row.id = uid();
        row.created_at = new Date().toISOString();
      }
      const idx = items.findIndex(i => i.id === row.id);
      if (idx > -1) items[idx] = row; else items.push(row);
      LStore.set('items', items);
      return normalizeItem(row);
    }
    const row = denormalizeItem(item);
    const { data, error } = await _sb.from('items').upsert(row).select().single();
    if (error) throw error;
    return normalizeItem(data);
  },
  async deleteItem(id) {
    if (!sbReady()) {
      LStore.set('items', LStore.get('items').filter(i => i.id !== id));
      return;
    }
    const { error } = await _sb.from('items').delete().eq('id', id);
    if (error) throw error;
  },
  async patchItem(id, patch) {
    if (!sbReady()) {
      const items = LStore.get('items');
      const idx = items.findIndex(i => i.id === id);
      if (idx > -1) {
        Object.assign(items[idx], denormalizePatch(patch));
        LStore.set('items', items);
      }
      return;
    }
    const { error } = await _sb.from('items').update(denormalizePatch(patch)).eq('id', id);
    if (error) throw error;
  },

  // ── USERS ──
  async signIn(email, password) {
    if (!sbReady()) {
      // Local Auth simulation
      if (email && password) return { data: { user: { id: 'local-user', email, user_metadata: { name: email.split('@')[0], role: 'admin' } } } };
      return { error: { message: 'Ungültige Zugangsdaten' } };
    }
    return await _sb.auth.signInWithPassword({ email, password });
  },
  async signInDiscord() {
    if (!sbReady()) {
      // Local Discord mock
      return { data: { user: { id: 'discord-user', email: 'discord@user.io', user_metadata: { name: 'Discord User', role: 'member' } } } };
    }
    return await _sb.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin }
    });
  },
  async signUp(email, password, name) {
    if (!sbReady()) return { error: { message: 'Registrierung im lokalen Modus nicht nötig. Bitte anmelden.' } };
    const { data, error } = await _sb.auth.signUp({ email, password, options: { data: { name, role: 'member' } } });
    return { data, error };
  },
  async signOut() {
    if (!sbReady()) { localStorage.removeItem('local_session'); return; }
    await _sb.auth.signOut();
  },
  async getSession() {
    if (!sbReady()) return JSON.parse(localStorage.getItem('local_session'));
    const { data: { session } } = await _sb.auth.getSession();
    return session;
  },
  async getProfile(userId) {
    if (!sbReady()) return { id: userId, name: 'Local Admin', role: 'admin' };
    
    // Get session to check for Discord ID
    const { data: { session } } = await _sb.auth.getSession();
    const meta = session?.user?.user_metadata || {};
    const discordId = session?.user?.identities?.find(i => i.provider === 'discord')?.id || meta.provider_id || meta.sub;
    const isOwner = discordId === (typeof CONFIG !== 'undefined' ? CONFIG.OWNER_DISCORD_ID : '')
                 || session?.user?.id === '56d6d448-524f-402e-a842-318d2a2f636c';

    const { data, error } = await _sb.from('profiles').select('*').eq('id', userId).single();
    
    if (error) {
      if (error.code === 'PGRST116' && session) {
        // Create new profile
        const role = isOwner ? 'admin' : 'member';
        await _sb.from('profiles').upsert({ 
          id: userId, 
          name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'User', 
          email: session.user.email, 
          role: role 
        });
        const { data: d2 } = await _sb.from('profiles').select('*').eq('id', userId).single();
        return d2 || null;
      }
      return null;
    }

    // Auto-promote owner to admin if they are not already
    if (isOwner && data.role !== 'admin') {
      await _sb.from('profiles').update({ role: 'admin' }).eq('id', userId);
      data.role = 'admin';
    }

    return data;
  },
  async getUsers() {
    if (!sbReady()) return [{ id: 'local-user', name: 'Local Admin', role: 'admin', email: 'local@local.host' }];
    const { data, error } = await _sb.from('profiles').select('*');
    return error ? [] : data;
  },

  async isSeeded() {
    if (!sbReady()) return LStore.get('cats').length > 0;
    const { data } = await _sb.from('categories').select('id').limit(1);
    return (data||[]).length > 0;
  },

  async uploadImage(file, path) {
    if (!sbReady()) {
      // Return file as data URL (already processed in processFiles)
      return null; // Handle in saveEntry
    }
    const { data, error } = await _sb.storage.from('jannikjbi').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = _sb.storage.from('jannikjbi').getPublicUrl(path);
    return publicUrl;
  },

  subscribeItems(callback) {
    if (!sbReady()) return null;
    return _sb.channel('items-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, callback).subscribe();
  },
};

// DB column ↔ UI field normalization
function normalizeItem(row) {
  return {
    id:         row.id,
    name:       row.name,
    price:      row.price,
    categoryId: row.category_id,
    url:        row.url,
    previews:   row.previews || [],
    notes:      row.notes || '',
    images:     row.images || [],
    bought:     row.bought || false,
    favorite:   row.favorite || false,
    priority:   row.priority || false,
    createdAt:  new Date(row.created_at).getTime(),
  };
}
function denormalizeItem(item) {
  const row = {
    name:        item.name,
    price:       item.price,
    category_id: item.categoryId || null,
    url:         item.url || null,
    previews:    item.previews || [],
    notes:       item.notes || null,
    images:      item.images || [],
    bought:      item.bought || false,
    favorite:    item.favorite || false,
    priority:    item.priority || false,
  };
  if (item.id) row.id = item.id;
  return row;
}
function denormalizePatch(patch) {
  const map = { categoryId:'category_id', bought:'bought', favorite:'favorite', priority:'priority', notes:'notes', images:'images', previews:'previews', url:'url', name:'name', price:'price' };
  const out = {};
  for (const [k,v] of Object.entries(patch)) { out[map[k]||k] = v; }
  return out;
}

// ═══════════════════════════════════════════
//  SEED DATA — Scripts + MLOs
// ═══════════════════════════════════════════
const SEED_CATEGORIES = [
  { name:'Script',       emoji:'📜', color:'#5b6ef5' },
  { name:'MLO',          emoji:'🏙️', color:'#22d47e' },
  { name:'Discord Bots', emoji:'🤖', color:'#f5a623' },
  { name:'Fahrzeuge',    emoji:'🚗', color:'#f04f5f' },
];

const SEED_SCRIPTS = [
  { name:'LB Phone',             price:104.72, url:'https://store.lbscripts.com/package/5356987',         previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=CirWSvYno70'}],        notes:'' },
  { name:'Nat. Disasters Pack',  price:57.45,  url:'https://store.nights-software.com/package/5177022',  previews:[{label:'Preview Base',url:'https://youtu.be/lz7RaZrXBNE'},{label:'Preview 1',url:'https://youtu.be/zpPcxAkyCPY'},{label:'Preview 2',url:'https://youtu.be/9we1WhLZJhI'},{label:'Preview 3',url:'https://youtu.be/3xQeLZbZRbI'},{label:'Preview 4',url:'https://youtu.be/XcLUc7sOQ2E'}], notes:'' },
  { name:'Drunk System',         price:23.80,  url:'https://store.rcore.cz/package/5161129',             previews:[{label:'Preview',url:'https://youtu.be/LD5pEi8UOrE'}],                      notes:'' },
  { name:'Jobs Creator',         price:80.00,  url:'https://www.jaksam-scripts.com/package/5369987',     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=ULCSM0yKPkw'}],       notes:'Rabattcode vorhanden' },
  { name:'EmergencyDispatch',    price:47.99,  url:'https://love-rp.tebex.io/package/4887641',           previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=Rpw26Sm-7kQ'}],       notes:'' },
  { name:'Bus Control',          price:6.99,   url:'https://love-rp.tebex.io/package/5892199',           previews:[],                                                                           notes:'Bilder kommen' },
  { name:'okokVehicleShop',      price:35.69,  url:'https://okok.tebex.io/package/4868575',              previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=lrM4iAVPyb0'}],       notes:'' },
  { name:'okokReportsV2',        price:17.84,  url:'https://okok.tebex.io/package/5032111',              previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=aAKUFDSRVKc'}],       notes:'' },
  { name:'okokGasStation',       price:23.79,  url:'https://okok.tebex.io/package/5751548',              previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=aZs14PhkCm0'}],       notes:'' },
  { name:'okokBillingV2',        price:23.79,  url:'https://okok.tebex.io/package/5246431',              previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=ir20JxeXk-c'}],       notes:'' },
  { name:'okokBanking',          price:29.74,  url:'https://okok.tebex.io/package/5126428',              previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=-bC489zMaZI'}],       notes:'' },
  { name:'Miner Job',            price:39.99,  url:'https://17movement.net/scripts/6203865',             previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=VHrykiMat-k'}],       notes:'' },
  { name:'Handling Pro',         price:36.26,  url:'https://jgscripts.com/scripts/handling',             previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=08T0yre0sso'}],       notes:'' },
  { name:'okokNotify',           price:4.75,   url:'https://okok.tebex.io/package/4724993',              previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=xDqu0GAORwI'}],       notes:'' },
  { name:'okokTextUI',           price:4.75,   url:'https://okok.tebex.io/package/6024831',              previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=CGVBsQWlrLw'}],       notes:'' },
  { name:'mAdmin Panel',         price:71.40,  url:'https://codem.tebex.io/package/6214962',             previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=_jYNEZzWllQ'}],       notes:'' },
  { name:'CodeM mWeaponshop',    price:13.39,  url:'https://codem.tebex.io/package/5519312',             previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=0BaplErfPbs'}],        notes:'' },
  { name:'Medical Equipment',    price:19.99,  url:'https://love-rp.tebex.io/package/6045786',           previews:[],                                                                           notes:'Bilder werden angehangen' },
  { name:'RailwaySim',           price:25.99,  url:'https://love-rp.tebex.io/package/5892199',           previews:[],                                                                           notes:'Vorschau auf der Webseite' },
  { name:'YourEquipment',        price:25.99,  url:'https://love-rp.tebex.io/package/5698932',           previews:[{label:'Preview 1',url:'https://youtu.be/yDCBwF0iMrs'},{label:'Preview 2',url:'https://youtu.be/fZlpznjIQbI'}], notes:'' },
  { name:'IBIS Control',         price:25.99,  url:'https://love-rp.tebex.io/package/5916327',           previews:[],                                                                           notes:'Vorschau auf der Seite' },
  { name:'Farming Creator',      price:65.00,  url:'https://www.jaksam-scripts.com/package/5391625',     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=3P12JXMgUBo'}],       notes:'' },
  { name:'Blips Creator',        price:30.00,  url:'https://www.jaksam-scripts.com/package/5653049',     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=e99VCsfwCbw'}],        notes:'' },
  { name:'Robberies Creator',    price:65.00,  url:'https://www.jaksam-scripts.com/package/5369985',     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=dyA8zHzLB5A'}],       notes:'' },
  { name:'Drugs Creator',        price:65.00,  url:'https://www.jaksam-scripts.com/package/5369988',     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=9S0Xl9tean0'}],       notes:'' },
  { name:'Housing Creator',      price:71.40,  url:'https://buy.quasar-store.com/package/5677308',       previews:[{label:'Preview',url:'https://youtu.be/mn6g9Uk_4YA'}],                      notes:'' },
  { name:'Smartphone',           price:59.99,  url:'https://buy.quasar-store.com/package/5676013',       previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=Ki52JlPmk3I'}],       notes:'' },
  { name:'Camera',               price:24.99,  url:'https://buy.quasar-store.com/package/5264886',       previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=618CCVHrTA0'}],       notes:'' },
  { name:'Motorhome',            price:24.99,  url:'https://buy.quasar-store.com/package/5256221',       previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=AzJQHhdhU9E'}],       notes:'' },
  { name:'Vehiclekeys',          price:24.99,  url:'https://buy.quasar-store.com/package/5269147',       previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=hQoR3j3zGJ0'}],       notes:'' },
  { name:'Renzu_customs',        price:23.80,  url:'https://forum.cfx.re/t/renzu-customs-unique-and-advanced-mechanic-tuning-lscustom-lscustoms/4755869', previews:[], notes:'Bilder unten auf der Seite' },
  { name:'Coinsystem',           price:60.00,  url:'https://shop.sky-systems.net/category/scripts',      previews:[{label:'Preview',url:'https://youtu.be/efbcT8n_PrE'}],                      notes:'' },
  { name:'visn_are',             price:73.78,  url:'https://store.veryinsanee.space/package/5215195',    previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=eHbeDGs8kaw'}],       notes:'' },
  { name:'K5 Documents',         price:0,      url:'https://forum.cfx.re/t/qb-esx-k5-documents-free/4904713', previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=cRgh2nqzROI'}], notes:'Kostenlos' },
  { name:'Outfit Bag',           price:14.88,  url:'https://kuzquality.com/package/5018286',             previews:[{label:'Preview',url:'https://forum.cfx.re/t/outfit-bag-esx-qb/4827499'}], notes:'' },
  { name:'EZELS',                price:65.56,  url:'https://cologic.tebex.io/package/4984295',           previews:[{label:'Preview 1',url:'https://www.youtube.com/watch?v=c9fgRL1rj-E'},{label:'Preview 2',url:'https://www.youtube.com/watch?v=0Le56tri7c4'}], notes:'' },
  { name:'Ai Taxi Pro',          price:17.60,  url:'https://codineer-digital.tebex.io/?package=4268959', previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=PDd8KFU9cNA'}],       notes:'' },
  { name:'VCAD',                 price:16.00,  url:'https://vcad.li/#preise',                            previews:[],                                                                           notes:'7–25€ je nach Plan' },
  { name:'JobStars',             price:2.96,   url:'https://luis-scripts.tebex.io/package/5034523',      previews:[{label:'Preview',url:'https://youtu.be/PNrNLWiPpyk'}],                      notes:'' },
  { name:'Fiveguard',            price:85.00,  url:'https://fiveguard.net/#pricing',                     previews:[],                                                                           notes:'45–125€ je nach Plan' },
  { name:'Banners (In-game Ads)',price:41.65,  url:'https://store.rcore.cz/package/6075584',             previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=PHOSXlVFZXw'}],       notes:'' },
  { name:'Prison All-in-One',    price:47.60,  url:'https://store.rcore.cz/package/5341769',             previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=uYRJgXeIKI4'}],       notes:'' },
  { name:'Guidebook',            price:35.70,  url:'https://store.rcore.cz/package/5041989',             previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=9V9O1gyT3Ho'}],       notes:'' },
];

const SEED_MLOS = [
  { name:'Logistic Company',                  price:52.43,  url:'https://greencome-mapping.tebex.io/package/5768030',          previews:[{label:'Preview',url:'https://youtu.be/aHDGQp_PC6c'}] },
  { name:'Rex\'s Diner',                      price:59.49,  url:'https://as-mlo.tebex.io/package/5885870',                     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=HFyoVq5-a60'}] },
  { name:'Auto Exotic + Dealership',          price:59.49,  url:'https://as-mlo.tebex.io/package/5368837',                     previews:[{label:'Preview',url:'https://youtu.be/Bqka6Cy3rPw'}] },
  { name:'PDM Dealership',                    price:59.49,  url:'https://as-mlo.tebex.io/package/6038374',                     previews:[{label:'Preview',url:'https://youtu.be/xgCPKlgDTqg'}] },
  { name:'Editable Studio',                   price:35.70,  url:'https://patoche-mapping.tebex.io/package/5078528',            previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=_hQ44HMVBSY'}] },
  { name:'Aldore Hospital v2',                price:59.50,  url:'https://ajaxon.tebex.io/package/6444982',                     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=45sgogztHTk'}] },
  { name:'La Fuente Blanca',                  price:47.60,  url:'https://energy-shop-fivem.tebex.io/package/6638257',          previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=_NF7Hm__ZY8'}] },
  { name:'Marlowe Vineyard Mafia',            price:47.60,  url:'https://energy-shop-fivem.tebex.io/package/6863743',          previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=BpKZ9i4EPRo'}] },
  { name:'Al Dente Restaurant & Compound',   price:47.60,  url:'https://turbosaif.tebex.io/package/6549958',                  previews:[{label:'Preview',url:'https://youtu.be/bp_AmI7a4ww'}] },
  { name:'Department of Justice',            price:117.81, url:'https://shmannworks.tebex.io/package/6283325',                previews:[{label:'Preview',url:'https://youtu.be/6owGtoSGR7U'}] },
  { name:'Shopping Center V2',               price:117.81, url:'https://shmannworks.tebex.io/package/6283397',                previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=EF5Wxot9K3U'}] },
  { name:'Bunker',                            price:27.41,  url:'https://ajaxon.tebex.io/package/5931233',                     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=kdgdQ4j4C1w'}] },
  { name:'Police Station',                    price:54.58,  url:'https://3d-market-webstore.tebex.io/package/6180907',         previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=2o4AoZH89kM'}] },
  { name:'Regierungsgebäude (Politik)',       price:28.55,  url:'https://bestfivem.com/de/shop/regierungsgebaude/',            previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=72r641Imqb8'}] },
  { name:'G&N\'s - All Mods',                price:19.83,  url:'https://fivem.gnstud.io/package/6078302',                     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=DRWU_TmpkP8'}] },
  { name:'VILLA 21',                          price:28.55,  url:'https://shop.brofxmlo.com/package/5753747',                   previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=5RYZvGYQLXA'}] },
  { name:'IBONOJA_MRPD',                      price:196.35, url:'https://ibonoja-maps.tebex.io/package/5348990',               previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=V0iCUG6CB94'}] },
  { name:'Evo Motors Mechanic',               price:47.60,  url:'https://energy-shop-fivem.tebex.io/package/6064489',          previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=76jbNvl0rp8'}] },
  { name:'Mansion Elite',                     price:35.70,  url:'https://energy-shop-fivem.tebex.io/package/6077946',          previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=GeH64B95PUM'}] },
  { name:'KORTZ CENTER BUNKER',               price:29.75,  url:'https://script.redstartrp.fr/category/fivem-mapping',         previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=871LDbxeTFY'}] },
  { name:'Bridge Sandy - Paleto',             price:23.80,  url:'https://nteamdev.tebex.io/category/packages',                 previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=SvlNe6wJU-E'}] },
  { name:'Mile High',                         price:65.45,  url:'https://nteamdev.tebex.io/category/packages',                 previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=lnpKKCTs6kI'}] },
  { name:'Legion Square Extended',            price:59.50,  url:'https://nteamdev.tebex.io/category/packages',                 previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=Rt18jFYmCt8'}] },
  { name:'Beschlagnahmungsstelle',            price:29.75,  url:'https://pugsmind.tebex.io/package/5234695',                   previews:[], notes:'Vorschau auf der Seite' },
  { name:'LS International Airport V2',      price:23.80,  url:'https://pugsmind.tebex.io/package/5234691',                   previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=FRiJQ_xWL94'}] },
  { name:'Feuerwehrwache Hannover',           price:238.95, url:'https://blighty3d.co.uk/collections/new-products/products/mlo-feuerwehrwache-hannover-hannover-fire-station', previews:[], notes:'Sehr teuer — Priorität prüfen' },
  { name:'24/7 Supermarkets Rework',          price:7.62,   url:'https://forum.cfx.re/t/mlo-24-7-supermarkets-rework/5126837', previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=-c0iQ4yNByI'}] },
  { name:'Fast Customs Mechanic',             price:47.60,  url:'https://energy-shop-fivem.tebex.io/package/5921912',          previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=AgLhhZsFBh4'}] },
  { name:'Auto Race Performance',             price:29.75,  url:'https://energy-shop-fivem.tebex.io/package/5925839',          previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=sUxmUxasCSc'}] },
  { name:'Burton LSC',                        price:43.72,  url:'https://ajaxon.tebex.io/package/4706394',                     previews:[{label:'Preview',url:'https://youtu.be/WPyPt-xid_A'}] },
  { name:'East Customs Garage',               price:29.75,  url:'https://rfc-mapping.tebex.io/package/5004794',                previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=4hULCvO1Vwc'}] },
  { name:'East Customs Garage v2',            price:29.75,  url:'https://rfc-mapping.tebex.io/package/4652693',                previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=ewjr82Ktbzc'}] },
  { name:'Diamond Casino & Heist Interior',  price:59.50,  url:'https://www.k4mb1maps.com/package/5325085',                   previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=-Iu78FNCYR4'}] },
  { name:'Ocean Medical Center',              price:76.16,  url:'https://mxaizen-map.tebex.io/package/4852215',                previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=ZA5DrqXkHNA'}] },
  { name:'Moto Clubhouse (Garage/Bar/Tattoo)',price:17.87, url:'https://rfc-mapping.tebex.io/package/4777230',                previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=22Y_vLOUuQU'}] },
  { name:'Breze Dealership',                  price:56.31,  url:'https://store.breze.dev/package/5380862',                     previews:[{label:'Preview',url:'https://youtu.be/9EVHVLkeCic'}] },
  { name:'Breze Sanders Motorcycles',         price:33.78,  url:'https://store.breze.dev/package/5380901',                     previews:[{label:'Preview',url:'https://youtu.be/qtrNsw2US1k'}] },
  { name:'AmmuNation',                        price:53.55,  url:'https://fivem.gabzv.com/package/5024631',                     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=Bxunb01OLi0'}] },
  { name:'G&N\'s Studio Mazebank West',       price:29.74,  url:'https://fivem.gnstud.io/package/5105340',                     previews:[{label:'Preview',url:'https://www.youtube.com/watch?v=0vpRiKHrP_Q'}] },
];

async function runSeed(catMap) {
  // Insert scripts
  const scriptRows = SEED_SCRIPTS.map((s,i) => ({
    name: s.name, price: s.price, categoryId: catMap['Script'],
    url: s.url, previews: s.previews, notes: s.notes||'',
    images: [], bought: false, favorite: false, priority: false,
  }));
  // Insert MLOs
  const mloRows = SEED_MLOS.map((m,i) => ({
    name: m.name, price: m.price, categoryId: catMap['MLO'],
    url: m.url, previews: m.previews||[], notes: m.notes||'',
    images: [], bought: false, favorite: false, priority: false,
  }));
  const allRows = [...scriptRows, ...mloRows];

  for (const row of allRows) {
    await SB.upsertItem(row);
  }
}

// ═══════════════════════════════════════════
//  CACHE — in-memory store (refreshed from Supabase)
// ═══════════════════════════════════════════
let CACHE = { items: [], cats: [], users: [] };

async function reloadCache() {
  [CACHE.items, CACHE.cats] = await Promise.all([SB.getItems(), SB.getCats()]);
}

const getItems = () => CACHE.items;
const getCats  = () => CACHE.cats;
const getUsers = () => CACHE.users;
const getCat   = id => CACHE.cats.find(c=>c.id===id)||null;

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
const S = {
  user: null,
  page: 'dashboard',
  filter: 'all',
  catFilter: null,
  search: '',
  view: localStorage.getItem('pref_view') || 'grid',
  sort: localStorage.getItem('pref_sort') || 'newest',
  loading: false,
};

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
const el  = id => document.getElementById(id);
const v   = id => el(id).value.trim();
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2,11);
const fmt = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n||0);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function showErr(domEl,msg){domEl.textContent=msg;domEl.classList.remove('hidden');}

function setLoading(on, msg='Lädt…') {
  S.loading = on;
  const overlay = el('loading-overlay');
  if (overlay) {
    overlay.classList.toggle('hidden', !on);
    const txt = overlay.querySelector('.loading-msg');
    if (txt) txt.textContent = msg;
  }
}

function filteredItems() {
  let items = [...CACHE.items];
  if (S.filter==='open')      items = items.filter(i=>!i.bought);
  if (S.filter==='bought')    items = items.filter(i=> i.bought);
  if (S.filter==='favorites') items = items.filter(i=> i.favorite);
  if (S.catFilter)            items = items.filter(i=>i.categoryId===S.catFilter);
  if (S.search) {
    const q = S.search.toLowerCase();
    items = items.filter(i=>i.name.toLowerCase().includes(q)||(i.notes||'').toLowerCase().includes(q));
  }
  if (S.sort==='newest')     items.sort((a,b)=>b.createdAt-a.createdAt);
  if (S.sort==='oldest')     items.sort((a,b)=>a.createdAt-b.createdAt);
  if (S.sort==='price-desc') items.sort((a,b)=>b.price-a.price);
  if (S.sort==='price-asc')  items.sort((a,b)=>a.price-b.price);
  if (S.sort==='az')         items.sort((a,b)=>a.name.localeCompare(b.name));
  return items;
}

function calcStats() {
  const items = CACHE.items;
  const total  = items.reduce((s,i)=>s+(i.price||0), 0);
  const spent  = items.filter(i=>i.bought).reduce((s,i)=>s+(i.price||0), 0);
  const open   = total - spent;
  const pct    = total>0 ? Math.round((spent/total)*100) : 0;
  return { total, spent, open, pct,
    n: items.length,
    nBought: items.filter(i=>i.bought).length,
    nOpen:   items.filter(i=>!i.bought).length };
}

// ═══════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════

async function doLoginLocal() {
  S.user = {
    id:    'local-user',
    name:  'Local Admin',
    email: 'local@local.host',
    role:  'admin',
  };
  localStorage.setItem('local_session', JSON.stringify({ user: S.user }));
  await bootApp();
}

async function doLoginDiscord() {
  const { error } = await SB.signInDiscord();
  if (error) { toast(error.message, 'e'); return; }
}

async function doLogout() {
  await SB.signOut();
  S.user = null;
  el('app').classList.add('hidden');
  el('auth-screen').classList.remove('hidden');
}


// (setup flow is now handled by two-card HTML — showSetupCard / doSetupConnect)


// ═══════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════
async function bootApp() {
  el('auth-screen').classList.add('hidden');
  el('app').classList.remove('hidden');

  const u = S.user;
  el('sb-avatar').textContent = u.name[0].toUpperCase();
  el('sb-name').textContent   = u.name;
  el('sb-role').textContent   = u.role;

  if (u.role==='admin') {
    el('sb-admin-sec').classList.remove('hidden');
    el('sb-admin-links').classList.remove('hidden');
  }

  setLoading(true, 'Daten werden geladen…');
  await reloadCache();

  // Auto-seed on first load (admin only)
  if (u.role==='admin' && CACHE.cats.length===0) {
    setLoading(true, 'Ersteinrichtung: Kategorien & Einträge werden angelegt…');
    await runFirstSeed();
    await reloadCache();
  }

  setLoading(false);
  updateModIndicator();
  renderSbCats();
  nav('dashboard');
  setupRealtime();
}

async function runFirstSeed() {
  const catMap = {};
  for (const cat of SEED_CATEGORIES) {
    const data = await SB.upsertCat(cat);
    if (data) catMap[cat.name] = data.id;
  }
  await runSeed(catMap);
  toast('Daten erfolgreich angelegt ✓','s');
}

// ═══════════════════════════════════════════
//  REALTIME
// ═══════════════════════════════════════════
function setupRealtime() {
  SB.subscribeItems(async () => {
    await reloadCache();
    refreshAll();
  });
}

// ═══════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════
function nav(page) {
  S.page = page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  el('page-'+page).classList.add('active');
  document.querySelectorAll('.sb-link').forEach(b=>b.classList.remove('active'));
  const nb = el('nav-'+page); if(nb) nb.classList.add('active');
  const titles = { dashboard:'Dashboard', list:'Alle Assets', admin:'Admin Panel' };
  el('topbar-title').textContent = titles[page]||page;
  if (page==='dashboard') renderDashboard();
  if (page==='list')      renderList();
  if (page==='admin')     renderAdmin();
}
function toggleSidebar() { el('sidebar').classList.toggle('sb-collapsed'); }

// ═══════════════════════════════════════════
//  SIDEBAR CATS
// ═══════════════════════════════════════════
function renderSbCats() {
  el('sb-cats').innerHTML = CACHE.cats.map(c=>`
    <button class="sb-link" onclick="nav('list');setCatFilter('${c.id}')">
      <span style="width:7px;height:7px;border-radius:50%;background:${c.color};flex-shrink:0"></span>
      <span>${c.emoji} ${c.name}</span>
    </button>`).join('');
}

// ═══════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════
function renderDashboard() {
  const s = calcStats();
  const h = new Date().getHours();
  el('dash-greeting').textContent = h<12?'Guten Morgen':h<18?'Guten Tag':'Guten Abend';
  el('dash-username').textContent = S.user?.name||'—';

  el('s-total').textContent     = fmt(s.total);
  el('s-spent').textContent     = fmt(s.spent);
  el('s-open').textContent      = fmt(s.open);
  el('s-pct').textContent       = s.pct+'%';
  el('s-total-meta').textContent = s.n+' Assets';
  el('s-spent-meta').textContent = s.nBought+' gekauft';
  el('s-open-meta').textContent  = s.nOpen+' offen';
  el('s-pct-meta').textContent   = `${s.nBought} von ${s.n} gekauft`;
  el('progress-fill').style.width = s.pct+'%';
  el('pill-val').textContent      = fmt(s.open);

  const circ = 2*Math.PI*28;
  el('ring-progress').setAttribute('stroke-dasharray', circ);
  el('ring-progress').setAttribute('stroke-dashoffset', circ*(1-s.pct/100));
  el('ring-num').textContent = s.pct+'%';

  el('sb-total-badge').textContent  = s.n;
  el('sb-open-badge').textContent   = s.nOpen;
  el('sb-bought-badge').textContent = s.nBought;

  renderCatCards();
  const recent = [...CACHE.items].sort((a,b)=>b.createdAt-a.createdAt).slice(0,6);
  renderGrid(el('dash-recent'), recent);
}

function renderCatCards() {
  const cats = CACHE.cats, items = CACHE.items;
  const container = el('cat-cards');
  if (!cats.length) { container.innerHTML='<p style="color:var(--t3);font-size:.8rem">Noch keine Kategorien.</p>'; return; }

  container.innerHTML = cats.map(c=>{
    const ci     = items.filter(i=>i.categoryId===c.id);
    const total  = ci.reduce((s,i)=>s+(i.price||0), 0);
    const bought = ci.filter(i=>i.bought).reduce((s,i)=>s+(i.price||0), 0);
    const open   = total - bought;
    const nBought= ci.filter(i=>i.bought).length;
    const pct    = total>0 ? Math.round((bought/total)*100) : 0;

    return `<div class="cat-card" onclick="nav('list');setCatFilter('${c.id}')">
      <div class="cat-card-accent-bar" style="background:${c.color}"></div>
      <div class="cat-card-top">
        <span class="cat-card-emoji">${c.emoji}</span>
        <div style="flex:1;min-width:0">
          <div class="cat-card-name">${c.name}</div>
          <div class="cat-card-count">${ci.length} Assets &middot; ${nBought} gekauft</div>
        </div>
        <div class="cat-card-pct" style="color:${c.color}">${pct}%</div>
      </div>
      <div class="cat-track"><div class="cat-fill" style="width:${pct}%;background:${c.color}"></div></div>
      <div class="cat-fin-row">
        <div class="cat-fin-item">
          <div class="cat-fin-label">Gesamt</div>
          <div class="cat-fin-val">${fmt(total)}</div>
        </div>
        <div class="cat-fin-div"></div>
        <div class="cat-fin-item">
          <div class="cat-fin-label">Gekauft</div>
          <div class="cat-fin-val cat-fin-green">${fmt(bought)}</div>
        </div>
        <div class="cat-fin-div"></div>
        <div class="cat-fin-item">
          <div class="cat-fin-label">Noch offen</div>
          <div class="cat-fin-val cat-fin-amber">${fmt(open)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
//  LIST
// ═══════════════════════════════════════════
function renderList() {
  renderCatStrip();
  renderGrid(el('list-grid'), filteredItems());
  updateChips();
}

function renderCatStrip() {
  el('cat-strip').innerHTML =
    `<button class="cat-strip-chip ${!S.catFilter?'active':''}" onclick="setCatFilter(null)">Alle</button>`+
    CACHE.cats.map(c=>`<button class="cat-strip-chip ${S.catFilter===c.id?'active':''}" onclick="setCatFilter('${c.id}')"
      style="${S.catFilter===c.id?`background:${c.color};border-color:${c.color}`:''}">
      <span class="cat-dot" style="background:${c.color}"></span>${c.emoji} ${c.name}
    </button>`).join('');
}

function renderGrid(container, items) {
  container.className = 'asset-grid'+(S.view==='list'?' list-view':'');
  if (!items.length) {
    container.innerHTML=`<div class="empty-state">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" opacity=".25"><rect x="6" y="6" width="32" height="32" rx="8" stroke="currentColor" stroke-width="1.5"/><path d="M14 22h16M14 29h8M22 14v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <p>Keine Einträge gefunden.</p>
    </div>`; return;
  }
  container.innerHTML = items.map(renderCard).join('');
}

function renderCard(item) {
  const cat = getCat(item.categoryId);
  const img = item.images?.[0];
  const imgHtml = img
    ? `<img class="ac-img" src="${esc(img)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'"/><div class="ac-placeholder" style="display:none"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity=".25"><rect x="3" y="3" width="26" height="26" rx="6" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="13" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 22l8-6 5 4 5-4 8 7" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></div>`
    : `<div class="ac-placeholder"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity=".25"><rect x="3" y="3" width="26" height="26" rx="6" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="13" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 22l8-6 5 4 5-4 8 7" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></div>`;

  return `<div class="asset-card ${item.bought?'is-bought':''} ${item.priority?'is-prio':''}" onclick="openDetail('${item.id}')">
    ${imgHtml}
    <div class="ac-body">
      <div class="ac-top">
        <div class="ac-name">${esc(item.name)}</div>
        <div class="ac-price">${item.price===0?'<span style="color:var(--green)">Free</span>':fmt(item.price)}</div>
      </div>
      ${item.notes?`<div class="ac-notes">${esc(item.notes)}</div>`:''}
    </div>
    <div class="ac-footer">
      <div class="ac-tags">
        ${cat?`<span class="ac-tag" style="color:${cat.color};border-color:${cat.color}20;background:${cat.color}10">${cat.emoji} ${cat.name}</span>`:''}
        ${item.bought?'<span class="ac-status-bought">✓ Gekauft</span>':''}
        ${item.priority&&!item.bought?`<span class="ac-tag" style="color:var(--red);border-color:rgba(240,79,95,.2);background:var(--red-dim)">🔥</span>`:''}
      </div>
      <div class="ac-actions" onclick="event.stopPropagation()">
        <button class="ac-action-btn ${item.favorite?'ac-action-fav':''}" onclick="toggleFav('${item.id}')">
          <span class="ac-action-icon">${item.favorite?'⭐':'☆'}</span>
          <span class="ac-action-label">${item.favorite?'Favorit':'Merken'}</span>
        </button>
        <button class="ac-action-btn ${item.bought?'ac-action-done':''}" onclick="toggleBought('${item.id}')">
          <span class="ac-action-icon">${item.bought?'✅':'🛒'}</span>
          <span class="ac-action-label">${item.bought?'Gekauft':'Kaufen'}</span>
        </button>
        <button class="ac-action-btn" onclick="openEntryModal('${item.id}')">
          <span class="ac-action-icon">✏️</span>
          <span class="ac-action-label">Bearbeiten</span>
        </button>
        <button class="ac-action-btn ac-action-del" onclick="deleteItemAction('${item.id}')">
          <span class="ac-action-icon">🗑</span>
          <span class="ac-action-label">Löschen</span>
        </button>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════
//  DETAIL MODAL
// ═══════════════════════════════════════════
function openDetail(id) {
  const item = CACHE.items.find(i=>i.id===id); if(!item) return;
  const cat  = getCat(item.categoryId);
  el('dm-title').textContent = item.name;

  const previewLinks = (item.previews||[]).map(p=>{
    let domain='', favicon='';
    try { const u=new URL(p.url); domain=u.hostname.replace('www.',''); favicon=`https://www.google.com/s2/favicons?domain=${domain}&sz=32`; } catch{}
    const isYT = p.url.includes('youtube')||p.url.includes('youtu.be');
    return `<a class="detail-preview-link" href="${esc(p.url)}" target="_blank" rel="noopener">
      ${favicon?`<img class="link-favicon" src="${favicon}" alt="" onerror="this.style.display='none'"/>`:'<span>▶</span>'}
      <div><div class="link-domain">${domain||'Link'}</div><div class="link-title">${esc(p.label||'Vorschau')}${isYT?' (YouTube)':''}</div></div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-left:auto;flex-shrink:0;color:var(--t3)"><path d="M4.5 1.5h6m0 0v6m0-6L4 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>`;
  }).join('');

  el('dm-body').innerHTML = `
    ${item.images?.length?`<div class="detail-img-strip">${item.images.map(s=>`<img class="detail-img" src="${esc(s)}" alt=""/>`).join('')}</div>`:''}
    <div class="detail-meta-row">
      <div class="detail-meta" style="flex:1"><div class="detail-meta-label">Preis</div><div class="detail-price">${item.price===0?'<span style="color:var(--green)">Kostenlos</span>':fmt(item.price)}</div></div>
      <div class="detail-meta"><div class="detail-meta-label">Status</div><div class="detail-meta-val" style="color:${item.bought?'var(--green)':'var(--amber)'}">${item.bought?'✓ Gekauft':'⏳ Offen'}</div></div>
      ${cat?`<div class="detail-meta"><div class="detail-meta-label">Kategorie</div><div class="detail-meta-val">${cat.emoji} ${cat.name}</div></div>`:''}
      ${item.priority?`<div class="detail-meta"><div class="detail-meta-label">Priorität</div><div class="detail-meta-val">🔥 Hoch</div></div>`:''}
    </div>
    ${item.notes?`<div><div class="detail-meta-label" style="margin-bottom:6px">Notizen</div><div class="detail-notes">${esc(item.notes)}</div></div>`:''}
    ${previewLinks?`<div><div class="detail-meta-label" style="margin-bottom:8px">Vorschau-Links</div><div class="detail-preview-links">${previewLinks}</div></div>`:''}
    ${item.url?`<div><div class="detail-meta-label" style="margin-bottom:8px">Download</div>
      <a class="detail-buy-link" href="${esc(item.url)}" target="_blank" rel="noopener">
        🛒 Zum Shop
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 1.5h6m0 0v6m0-6L4 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a></div>`:''}`;

  el('dm-edit').onclick = ()=>{ closeModal('detail-modal'); openEntryModal(id); };
  el('dm-del').onclick  = ()=>{ closeModal('detail-modal'); deleteItemAction(id); };
  el('detail-modal').classList.remove('hidden');
}

// ═══════════════════════════════════════════
//  ENTRY MODAL
// ═══════════════════════════════════════════
let pendingImgs = [];

function openEntryModal(id) {
  const item = id ? CACHE.items.find(i=>i.id===id) : null;
  el('em-title').textContent = item ? 'Eintrag bearbeiten' : 'Neuer Eintrag';
  el('em-save').textContent  = item ? 'Aktualisieren' : 'Speichern';
  el('em-id').value    = item?.id||'';
  el('em-name').value  = item?.name||'';
  el('em-price').value = item?.price!=null ? item.price : '';
  el('em-url').value   = item?.url||'';
  el('em-notes').value = item?.notes||'';
  el('em-bought').checked = item?.bought||false;
  el('em-fav').checked    = item?.favorite||false;
  el('em-prio').checked   = item?.priority||false;

  el('em-cat').innerHTML = '<option value="">— wählen —</option>'+
    CACHE.cats.map(c=>`<option value="${c.id}" ${item?.categoryId===c.id?'selected':''}>${c.emoji} ${c.name}</option>`).join('');

  el('preview-links-container').innerHTML='';
  (item?.previews||[]).forEach(p=>addPreviewRow(p.label, p.url));

  pendingImgs = (item?.images||[]).map(s=>({src:s,type:s.startsWith('data:')||s.startsWith('blob:')?'file':'url'}));
  renderImgThumbs();
  switchImgTab('upload');
  el('mod-bar').className='mod-bar hidden';
  el('url-img-preview').classList.add('hidden');
  el('img-url-inp').value='';
  el('em-err').classList.add('hidden');
  el('entry-modal').classList.remove('hidden');
  setTimeout(()=>el('em-name').focus(),60);
}

async function saveEntry() {
  const id    = el('em-id').value;
  const name  = el('em-name').value.trim();
  const price = parseFloat(el('em-price').value);
  const url   = el('em-url').value.trim();
  const notes = el('em-notes').value.trim();
  const catId = el('em-cat').value;
  const bought= el('em-bought').checked;
  const fav   = el('em-fav').checked;
  const prio  = el('em-prio').checked;
  const errEl = el('em-err');

  const previews = [];
  document.querySelectorAll('.preview-link-row').forEach(row=>{
    const lbl  = row.querySelector('.pl-label')?.value?.trim()||'Vorschau';
    const purl = row.querySelector('.pl-url')?.value?.trim()||'';
    if (purl) previews.push({label:lbl, url:purl});
  });

  errEl.classList.add('hidden');
  if (!name)               { showErr(errEl,'Name ist Pflichtfeld.'); return; }
  if (isNaN(price)||price<0){ showErr(errEl,'Bitte gültigen Preis eingeben.'); return; }

  // Upload images (Supabase Storage if available, else Base64)
  const images = [];
  for (const img of pendingImgs) {
    if (img.type==='file' && img.src.startsWith('data:')) {
      if (sbReady()) {
        try {
          const blob = dataUrlToBlob(img.src);
          const path = `items/${uid()}.${blob.type.split('/')[1]||'jpg'}`;
          const publicUrl = await SB.uploadImage(blob, path);
          images.push(publicUrl);
        } catch(e) { images.push(img.src); }
      } else {
        images.push(img.src); // Local mode: store as Base64
      }
    } else {
      images.push(img.src);
    }
  }

  const itemData = { name, price, categoryId: catId||null, url, notes, previews, images, bought, favorite:fav, priority:prio };
  if (id) itemData.id = id;

  const saveBtn = el('em-save');
  saveBtn.disabled=true; saveBtn.textContent='Speichern…';

  try {
    await SB.upsertItem(itemData);
    await reloadCache();
    toast(id?'Aktualisiert ✓':'Erstellt ✓','s');
    pendingImgs=[];
    closeModal('entry-modal');
    refreshAll();
  } catch(e) {
    showErr(errEl, e.message||'Fehler beim Speichern.');
  } finally {
    saveBtn.disabled=false; saveBtn.textContent = id?'Aktualisieren':'Speichern';
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
  return new Blob([arr],{type:mime});
}

// Preview link rows
function addPreviewRow(label='', url='') {
  const div = document.createElement('div');
  div.className = 'preview-link-row';
  div.innerHTML = `
    <input type="text" class="pl-label" placeholder="Label" value="${esc(label)}" style="flex:.8;background:var(--bg2);border:1px solid var(--b2);border-radius:8px;color:var(--t1);font-family:Outfit,sans-serif;font-size:.82rem;padding:8px 10px;outline:none"/>
    <input type="url" class="pl-url" placeholder="https://youtube.com/…" value="${esc(url)}" style="flex:2;background:var(--bg2);border:1px solid var(--b2);border-radius:8px;color:var(--t1);font-family:Outfit,sans-serif;font-size:.82rem;padding:8px 10px;outline:none"/>
    <button type="button" class="rm-link-btn" onclick="this.parentElement.remove()">✕</button>`;
  el('preview-links-container').appendChild(div);
}

// ═══════════════════════════════════════════
//  IMAGE UPLOAD
// ═══════════════════════════════════════════
function switchImgTab(t) {
  el('itab-upload').classList.toggle('hidden', t!=='upload');
  el('itab-url').classList.toggle('hidden', t!=='url');
  document.querySelectorAll('.img-tab').forEach((b,i)=>b.classList.toggle('active',(i===0&&t==='upload')||(i===1&&t==='url')));
}
function renderImgThumbs() {
  el('img-thumbs').innerHTML = pendingImgs.map((img,i)=>`
    <div class="img-thumb">
      <img src="${img.src}" alt=""/>
      <button class="img-thumb-rm" onclick="removeImg(${i})">✕</button>
      <div class="thumb-badge ${img.type==='file'?'tb-file':'tb-url'}">${img.type}</div>
    </div>`).join('');
}
function removeImg(i) { pendingImgs.splice(i,1); renderImgThumbs(); }
function dzOver(e)  { e.preventDefault(); el('drop-zone').classList.add('dz-over'); }
function dzLeave()  { el('drop-zone').classList.remove('dz-over'); }
function dzDrop(e)  { e.preventDefault(); el('drop-zone').classList.remove('dz-over'); processFiles(Array.from(e.dataTransfer.files)); }
function filesSelected(e) { processFiles(Array.from(e.target.files)); e.target.value=''; }

async function processFiles(files) {
  const imgs = files.filter(f=>f.type.startsWith('image/'));
  if (!imgs.length) { toast('Nur Bilddateien erlaubt.','e'); return; }
  const big  = imgs.filter(f=>f.size>5*1024*1024);
  if (big.length) { toast(`${big.length} Datei(en) zu groß (max 5 MB).`,'e'); return; }
  for (const f of imgs) {
    const b64 = await fileToB64(f);
    const ok  = await moderateImg(b64, f.name);
    if (!ok) continue;
    pendingImgs.push({src:b64, type:'file', name:f.name});
  }
  renderImgThumbs();
}
function fileToB64(f) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
}
async function urlToB64(url) {
  const res=await fetch(url); const blob=await res.blob();
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(blob); });
}
async function addUrlImage() {
  const url = el('img-url-inp').value.trim();
  if (!url) { toast('Bitte URL eingeben.','e'); return; }
  const prev=el('url-img-preview'), img=el('url-img-el');
  img.src=url; prev.classList.remove('hidden');
  try {
    const b64=await urlToB64(url);
    const ok=await moderateImg(b64,url);
    if (!ok) { prev.classList.add('hidden'); img.src=''; return; }
  } catch { toast('Bild geladen (Moderation übersprungen – CORS).','i'); }
  pendingImgs.push({src:url,type:'url'});
  renderImgThumbs();
  el('img-url-inp').value='';
  setTimeout(()=>prev.classList.add('hidden'),800);
}

// ═══════════════════════════════════════════
//  MODERATION
// ═══════════════════════════════════════════
function getApiKey() { return localStorage.getItem('oai_key')||''; }
function setModBar(type,msg) {
  const b=el('mod-bar');
  b.className=`mod-bar ${type}`; b.classList.remove('hidden');
  b.innerHTML=`${type==='checking'?'<div class="mod-spin"></div>':type==='ok'?'✓':'✕'} ${msg}`;
  if(type!=='checking') setTimeout(()=>b.classList.add('hidden'),3000);
}
async function moderateImg(b64url, label='Bild') {
  const key=getApiKey(); if(!key) return true;
  setModBar('checking',`Prüfe "${String(label).slice(0,28)}…"`);
  try {
    const base64=(b64url.includes(',')?b64url.split(',')[1]:b64url);
    const mime=(b64url.match(/^data:(image\/[a-zA-Z+]+);base64/)||[])[1]||'image/jpeg';
    const res=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({model:'gpt-4o-mini',max_tokens:60,messages:[{role:'user',content:[
        {type:'text',text:'Content moderation for a FiveM server management app. Reply ONLY JSON: {"safe":true} or {"safe":false,"reason":"German reason"}. Block: nudity, gore, hate, illegal. Allow: game screenshots, UI, products.'},
        {type:'image_url',image_url:{url:`data:${mime};base64,${base64}`,detail:'low'}}
      ]}]})
    });
    if(!res.ok) { if(res.status===401){setModBar('blocked','API-Key ungültig.');return false;} setModBar('ok','Moderation n/v — akzeptiert.');return true; }
    const data=await res.json();
    const txt=(data.choices?.[0]?.message?.content||'{}').replace(/```json|```/g,'').trim();
    const r=JSON.parse(txt);
    if(r.safe===false){setModBar('blocked',`Abgelehnt: ${r.reason||'Ungeeigneter Inhalt'}`);toast(`Bild abgelehnt: ${r.reason||'Ungeeigneter Inhalt'}`,'e');return false;}
    setModBar('ok',`"${String(label).slice(0,22)}" freigegeben ✓`);return true;
  } catch(e){setModBar('ok','Moderation Fehler — akzeptiert.');return true;}
}

// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
function openSettingsModal() {
  el('oai-key').value = getApiKey();
  el('sb-url').value  = SB_URL;
  el('sb-akey').value = SB_KEY;
  updateModIndicator();
  el('settings-modal').classList.remove('hidden');
}
async function saveSettings() {
  const oaiKey = el('oai-key').value.trim();
  localStorage.setItem('oai_key', oaiKey);

  updateModIndicator();
  closeModal('settings-modal');
  toast('Einstellungen gespeichert ✓','s');
}
function updateModIndicator() {
  const active = !!getApiKey();
  const dot=el('mod-dot'), lbl=el('mod-label');
  if(!dot) return;
  dot.className='mod-dot '+(active?'on':'off');
  lbl.textContent=active?'Moderation: aktiv (OpenAI)':'Moderation: nicht konfiguriert';
}
function togglePw(id) { const i=el(id); i.type=i.type==='password'?'text':'password'; }

// ═══════════════════════════════════════════
//  CATEGORY MODAL
// ═══════════════════════════════════════════
function openCatModal(catId) {
  const cat=catId?CACHE.cats.find(c=>c.id===catId):null;
  el('cm-title').textContent=cat?'Kategorie bearbeiten':'Neue Kategorie';
  el('cm-id').value=cat?.id||'';
  el('cm-name').value=cat?.name||'';
  el('cm-emoji').value=cat?.emoji||'';
  const col=cat?.color||'#5b6ef5';
  el('cm-color').value=col; el('cm-cv').textContent=col;
  el('cm-err').classList.add('hidden');
  el('cat-modal').classList.remove('hidden');
}
async function saveCat() {
  const id=el('cm-id').value, name=el('cm-name').value.trim(),
        emoji=el('cm-emoji').value.trim(), color=el('cm-color').value;
  const errEl=el('cm-err'); errEl.classList.add('hidden');
  if(!name){showErr(errEl,'Name ist Pflichtfeld.');return;}
  try {
    const catData={name,emoji,color};
    if(id) catData.id=id;
    await SB.upsertCat(catData);
    await reloadCache();
    toast(id?'Kategorie aktualisiert ✓':'Kategorie erstellt ✓','s');
    closeModal('cat-modal');
    refreshAll();
  } catch(e){showErr(errEl,e.message);}
}
async function deleteCat(catId) {
  if(!confirm('Kategorie löschen? Items verlieren die Zuordnung.')) return;
  try {
    await SB.deleteCat(catId);
    await reloadCache();
    toast('Kategorie gelöscht.','i'); refreshAll();
  } catch(e){toast(e.message,'e');}
}

// ═══════════════════════════════════════════
//  ITEM ACTIONS
// ═══════════════════════════════════════════
async function toggleBought(id) {
  const item=CACHE.items.find(i=>i.id===id); if(!item) return;
  const nb=!item.bought;
  try {
    await SB.patchItem(id,{bought:nb});
    // Optimistic UI update
    item.bought=nb;
    toast(nb?`"${item.name}" gekauft (+${fmt(item.price)}) ✓`:`"${item.name}" zurückgesetzt.`,nb?'s':'i');
    refreshAll();
    // Background reload for consistency
    reloadCache().then(refreshAll);
  } catch(e){toast(e.message,'e');}
}

async function toggleFav(id) {
  const item=CACHE.items.find(i=>i.id===id); if(!item) return;
  try {
    await SB.patchItem(id,{favorite:!item.favorite});
    item.favorite=!item.favorite;
    refreshAll();
    reloadCache().then(refreshAll);
  } catch(e){toast(e.message,'e');}
}

async function deleteItemAction(id) {
  const item=CACHE.items.find(i=>i.id===id);
  if(!confirm(`"${item?.name}" wirklich löschen?`)) return;
  try {
    await SB.deleteItem(id);
    CACHE.items=CACHE.items.filter(i=>i.id!==id);
    toast('Gelöscht.','i'); refreshAll();
    reloadCache().then(refreshAll);
  } catch(e){toast(e.message,'e');}
}

// ═══════════════════════════════════════════
//  FILTERS / SEARCH / VIEW
// ═══════════════════════════════════════════
function setFilter(f) {
  S.filter=f; updateChips();
  if(S.page==='list')      renderGrid(el('list-grid'),filteredItems());
  if(S.page==='dashboard') renderDashboard();
}
function setCatFilter(id) {
  S.catFilter=id;
  if(S.page==='list') renderList();
}
function handleSearch(q) {
  S.search=q;
  if(S.page==='list')      renderGrid(el('list-grid'),filteredItems());
  if(S.page==='dashboard') renderDashboard();
}
function handleSort(val) {
  S.sort=val; localStorage.setItem('pref_sort',val);
  if(S.page==='list') renderGrid(el('list-grid'),filteredItems());
}
function setView(v) {
  S.view=v; localStorage.setItem('pref_view',v);
  el('vt-grid').classList.toggle('active',v==='grid');
  el('vt-list').classList.toggle('active',v==='list');
  if(S.page==='list') renderGrid(el('list-grid'),filteredItems());
}
function updateChips() {
  document.querySelectorAll('.chip').forEach(c=>{
    const t=c.textContent.trim();
    c.classList.toggle('active',
      (t==='Alle'&&S.filter==='all')||(t==='Offen'&&S.filter==='open')||
      (t==='Gekauft'&&S.filter==='bought')||((t==='⭐'||t.includes('Favoriten'))&&S.filter==='favorites'));
  });
}

// ═══════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════
async function renderAdmin() {
  const items=CACHE.items, cats=CACHE.cats, s=calcStats();
  const users = await SB.getUsers();
  el('admin-count').textContent=items.length;

  document.getElementById('admin-cats').innerHTML = cats.length
    ? cats.map(c=>`<div class="admin-cat-row">
        <div class="admin-cat-dot" style="background:${c.color}"></div>
        <div class="admin-cat-info">${c.emoji} ${c.name}<div class="admin-cat-sub">${items.filter(i=>i.categoryId===c.id).length} Items · ${fmt(items.filter(i=>i.categoryId===c.id).reduce((s,i)=>s+(i.price||0),0))}</div></div>
        <div class="admin-cat-btns">
          <button class="admin-icon-btn" onclick="openCatModal('${c.id}')">✏</button>
          <button class="admin-icon-btn" onclick="deleteCat('${c.id}')">🗑</button>
        </div>
      </div>`).join('')
    : '<p style="padding:14px;font-size:.8rem;color:var(--t3)">Keine Kategorien.</p>';

  document.getElementById('admin-entries').innerHTML = [...items].sort((a,b)=>b.createdAt-a.createdAt).map(i=>{
    const cat=getCat(i.categoryId);
    return `<div class="admin-entry-row">
      <div class="admin-entry-name" title="${esc(i.name)}">${esc(i.name)}</div>
      ${cat?`<span style="color:${cat.color};font-size:.7rem">${cat.emoji}</span>`:''}
      <div class="admin-entry-price">${i.price===0?'Free':fmt(i.price)}</div>
      <span class="entry-status ${i.bought?'s-bought':'s-open'}">${i.bought?'Gekauft':'Offen'}</span>
    </div>`;
  }).join('') || '<p style="padding:14px;font-size:.8rem;color:var(--t3)">Keine Einträge.</p>';

  el('as-n').textContent=items.length; el('as-total').textContent=fmt(s.total);
  el('as-spent').textContent=fmt(s.spent); el('as-open').textContent=fmt(s.open);
  el('as-cats').textContent=cats.length; el('as-users').textContent=users.length||'—';

  document.getElementById('admin-users').innerHTML = users.length
    ? users.map(u=>`<div class="admin-user-row">
        <div class="admin-user-av">${(u.name||u.email||'?')[0].toUpperCase()}</div>
        <div class="admin-user-name">${esc(u.name||u.email||'—')}<div style="font-size:.68rem;color:var(--t3)">${esc(u.email||'')}</div></div>
        <span class="admin-user-role ${u.role==='admin'?'role-admin':'role-member'}">${u.role||'member'}</span>
      </div>`).join('')
    : '<p style="padding:14px;font-size:.78rem;color:var(--t3)">Nur über Supabase Dashboard einsehbar.</p>';
}

// ═══════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════
function closeModal(id) { el(id).classList.add('hidden'); }
function overlayClose(e,id) { if(e.target===el(id)) closeModal(id); }

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
function toast(msg, type='i') {
  const icons={s:'✓',e:'✕',i:'ℹ'};
  const div=document.createElement('div');
  div.className=`toast toast-${type}`;
  div.innerHTML=`<span>${icons[type]}</span><span>${msg}</span>`;
  el('toast-container').appendChild(div);
  setTimeout(()=>{ div.style.opacity='0'; div.style.transform='translateX(20px)'; div.style.transition='.3s'; setTimeout(()=>div.remove(),300); },3500);
}

// ═══════════════════════════════════════════
//  REFRESH
// ═══════════════════════════════════════════
function refreshAll() {
  renderSbCats();
  if(S.page==='dashboard') renderDashboard();
  if(S.page==='list')      renderList();
  if(S.page==='admin')     renderAdmin();
  const s=calcStats();
  el('sb-total-badge').textContent  = s.n;
  el('sb-open-badge').textContent   = s.nOpen;
  el('sb-bought-badge').textContent = s.nBought;
  el('pill-val').textContent        = fmt(s.open);
}


// ═══════════════════════════════════════════
//  BOOT SEQUENCE
// ═══════════════════════════════════════════
(async () => {
  // 1. Connect to Supabase
  const ok = await initSupabase();
  if (!ok) {
    toast('Datenbank-Verbindung fehlgeschlagen.', 'e');
    return;
  }

  // 2. Check for existing session
  const session = await SB.getSession();
  if (session) {
    const profile = await SB.getProfile(session.user.id);
    const meta = session.user.user_metadata || {};
    // Detailed logging for debugging
    console.log('Full User Object:', session.user);
    
    // Try multiple ways to find the Discord ID
    const discordId = session.user.identities?.find(i => i.provider === 'discord')?.id 
                   || meta.provider_id 
                   || meta.sub 
                   || meta.custom_claims?.provider_id;
                   
    const isOwner = discordId === (typeof CONFIG !== 'undefined' ? CONFIG.OWNER_DISCORD_ID : '')
                 || session.user.id === '56d6d448-524f-402e-a842-318d2a2f636c'; // Fallback to Supabase UUID
    
    console.log('Auth Check:', { discordId, supabaseId: session.user.id, isOwner, role: profile?.role });

    S.user = {
      id:    session.user.id,
      name:  profile?.name || meta.full_name || meta.name || session.user.email?.split('@')[0],
      email: session.user.email,
      role:  profile?.role || 'member',
    };

    if (S.user.role !== 'admin') {
      toast('Zugriff verweigert. Du hast keine Berechtigung.', 'e');
      el('login-card').innerHTML = `
        <div class="auth-logo">
          <div class="auth-logo-icon"><img src="icon.png" alt="JBI" style="width:28px;height:28px;object-fit:contain;border-radius:6px"/></div>
          <span>JannikJBI <span style="font-weight:400;opacity:.55">Todo</span></span>
        </div>
        <div class="auth-headline" style="color:var(--red)">Zugriff verweigert</div>
        <div class="auth-form">
          <p style="color:var(--t2);font-size:.85rem;margin-bottom:15px;text-align:center;line-height:1.4">Dein Account (ID: ${S.user.id}) ist nicht für den Zugriff freigeschaltet.</p>
          <button class="btn-discord" onclick="doLogout()">Zurück zum Login</button>
        </div>
      `;
      el('auth-screen').classList.remove('hidden');
      return;
    }

    await bootApp();
    return;
  }

  // 3. No session -> show login card (Discord only)
  el('auth-screen').classList.remove('hidden');
})();


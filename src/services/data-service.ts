import { supabase } from "@/lib/supabase";
import { Asset, Category, UserProfile, DashboardStats } from "@/types";

export const DataService = {
  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return data || [];
  },

  async upsertCategory(category: Partial<Category>): Promise<Category> {
    const { data, error } = await supabase
      .from("categories")
      .upsert(category)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    // Set items in this category to null first
    await supabase.from("items").update({ category_id: null }).eq("category_id", id);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
  },

  // --- ASSETS ---
  async getAssets(): Promise<Asset[]> {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async upsertAsset(asset: Partial<Asset>): Promise<Asset> {
    const { data, error } = await supabase
      .from("items")
      .upsert(asset)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAsset(id: string): Promise<void> {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) throw error;
  },

  async patchAsset(id: string, patch: Partial<Asset>): Promise<void> {
    const { error } = await supabase.from("items").update(patch).eq("id", id);
    if (error) throw error;
  },

  // --- STATS ---
  async getStats(): Promise<DashboardStats> {
    const assets = await this.getAssets();
    const total = assets.reduce((s, i) => s + (i.price || 0), 0);
    const spent = assets.filter((i) => i.bought).reduce((s, i) => s + (i.price || 0), 0);
    const open = total - spent;
    const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
    
    return {
      total,
      spent,
      open,
      pct,
      n: assets.length,
      nBought: assets.filter((i) => i.bought).length,
      nOpen: assets.filter((i) => !i.bought).length,
    };
  },

  // --- PROFILES ---
  async getUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) throw error;
    return data || [];
  },

  // --- SEEDING ---
  async isSeeded(): Promise<boolean> {
    const { data } = await supabase.from("categories").select("id").limit(1);
    return (data || []).length > 0;
  },

  async runFirstSeed(): Promise<void> {
    const SEED_CATEGORIES = [
      { name: 'Script', emoji: '📜', color: '#5b6ef5' },
      { name: 'MLO', emoji: '🏙️', color: '#22d47e' },
      { name: 'Discord Bots', emoji: '🤖', color: '#f5a623' },
      { name: 'Fahrzeuge', emoji: '🚗', color: '#f04f5f' },
    ];

    const catMap: Record<string, string> = {};
    for (const cat of SEED_CATEGORIES) {
      const data = await this.upsertCategory(cat);
      if (data) catMap[cat.name] = data.id;
    }

    const SEED_SCRIPTS = [
      { name: 'LB Phone', price: 104.72, url: 'https://store.lbscripts.com/package/5356987', previews: [{ label: 'Preview', url: 'https://www.youtube.com/watch?v=CirWSvYno70' }], notes: '' },
      { name: 'Nat. Disasters Pack', price: 57.45, url: 'https://store.nights-software.com/package/5177022', previews: [{ label: 'Preview Base', url: 'https://youtu.be/lz7RaZrXBNE' }], notes: '' },
      // ... more scripts could be added here
    ];

    for (const s of SEED_SCRIPTS) {
      await this.upsertAsset({
        ...s,
        category_id: catMap['Script'],
        images: [],
        bought: false,
        favorite: false,
        priority: false,
      });
    }
  },
};

"use client";

import { useState, useEffect } from "react";
import { Asset, Category, PreviewLink } from "@/types";
import { X, Plus, Trash2, Image as ImageIcon, Link as LinkIcon } from "lucide-react";

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Partial<Asset>) => Promise<void>;
  asset?: Asset | null;
  categories: Category[];
}

export default function AssetModal({ isOpen, onClose, onSave, asset, categories }: AssetModalProps) {
  const [formData, setFormData] = useState<Partial<Asset>>({
    name: "",
    price: 0,
    category_id: null,
    url: "",
    notes: "",
    images: [],
    previews: [],
    bought: false,
    favorite: false,
    priority: false,
  });

  const [newPreview, setNewPreview] = useState<PreviewLink>({ label: "", url: "" });

  useEffect(() => {
    if (asset) {
      setFormData(asset);
    } else {
      setFormData({
        name: "",
        price: 0,
        category_id: null,
        url: "",
        notes: "",
        images: [],
        previews: [],
        bought: false,
        favorite: false,
        priority: false,
      });
    }
  }, [asset, isOpen]);

  if (!isOpen) return null;

  const handleAddPreview = () => {
    if (newPreview.url) {
      setFormData({
        ...formData,
        previews: [...(formData.previews || []), newPreview]
      });
      setNewPreview({ label: "", url: "" });
    }
  };

  const removePreview = (index: number) => {
    setFormData({
      ...formData,
      previews: (formData.previews || []).filter((_, i) => i !== index)
    });
  };

  const handleAddImageUrl = () => {
    const url = prompt("Bild URL eingeben:");
    if (url) {
      setFormData({
        ...formData,
        images: [...(formData.images || []), url]
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0c14]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#161925] z-10">
          <h2 className="text-xl font-bold text-white">{asset ? "Asset bearbeiten" : "Neues Asset hinzufügen"}</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-[#0a0c14] border border-[#1e2235] rounded-xl py-2 px-4 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preis (€)</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.price} 
                onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                className="w-full bg-[#0a0c14] border border-[#1e2235] rounded-xl py-2 px-4 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kategorie</label>
            <select 
              value={formData.category_id || ""} 
              onChange={e => setFormData({...formData, category_id: e.target.value || null})}
              className="w-full bg-[#0a0c14] border border-[#1e2235] rounded-xl py-2 px-4 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Keine Kategorie</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shop-Link</label>
            <input 
              type="url" 
              placeholder="https://..."
              value={formData.url || ""} 
              onChange={e => setFormData({...formData, url: e.target.value})}
              className="w-full bg-[#0a0c14] border border-[#1e2235] rounded-xl py-2 px-4 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vorschau-Links</label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input 
                placeholder="Label (z.B. Video)" 
                value={newPreview.label}
                onChange={e => setNewPreview({...newPreview, label: e.target.value})}
                className="md:col-span-1 bg-[#0a0c14] border border-[#1e2235] rounded-xl py-2 px-4 text-sm"
              />
              <input 
                placeholder="URL" 
                value={newPreview.url}
                onChange={e => setNewPreview({...newPreview, url: e.target.value})}
                className="md:col-span-1 bg-[#0a0c14] border border-[#1e2235] rounded-xl py-2 px-4 text-sm"
              />
              <button 
                onClick={handleAddPreview}
                className="bg-indigo-600/10 text-indigo-400 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Hinzufügen
              </button>
            </div>
            <div className="space-y-2">
              {formData.previews?.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#0a0c14] rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <LinkIcon className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-300 truncate">{p.label}: {p.url}</span>
                  </div>
                  <button onClick={() => removePreview(i)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bilder</label>
            <div className="flex flex-wrap gap-3">
              {formData.images?.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-[#1e2235]">
                  <img src={img} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setFormData({...formData, images: formData.images?.filter((_, idx) => idx !== i)})}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button 
                onClick={handleAddImageUrl}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-[#1e2235] flex flex-col items-center justify-center text-slate-500 hover:border-indigo-500 hover:text-indigo-400 transition-all"
              >
                <Plus className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase mt-1">URL</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notizen</label>
            <textarea 
              value={formData.notes || ""} 
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-[#0a0c14] border border-[#1e2235] rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-indigo-500 min-h-[100px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={formData.bought} 
                onChange={e => setFormData({...formData, bought: e.target.checked})}
                className="w-5 h-5 rounded-md bg-[#0a0c14] border-[#1e2235] text-indigo-600 focus:ring-indigo-500" 
              />
              <span className="text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Gekauft</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={formData.favorite} 
                onChange={e => setFormData({...formData, favorite: e.target.checked})}
                className="w-5 h-5 rounded-md bg-[#0a0c14] border-[#1e2235] text-amber-500 focus:ring-amber-500" 
              />
              <span className="text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Favorit</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.checked})}
                className="w-5 h-5 rounded-md bg-[#0a0c14] border-[#1e2235] text-red-500 focus:ring-red-500" 
              />
              <span className="text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Priorität</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-[#161925] flex justify-end gap-3 sticky bottom-0">
          <button onClick={onClose} className="btn-ghost">Abbrechen</button>
          <button onClick={() => onSave(formData)} className="btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}

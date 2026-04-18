"use client";

import { Asset, Category } from "@/types";
import { 
  Star, 
  ShoppingCart, 
  Pencil, 
  Trash2, 
  ExternalLink, 
  Flame,
  CheckCircle2
} from "lucide-react";
import Image from "next/image";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AssetCardProps {
  asset: Asset;
  category?: Category;
  onToggleFav?: (id: string) => void;
  onToggleBought?: (id: string) => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (id: string) => void;
}

export default function AssetCard({ 
  asset, 
  category, 
  onToggleFav, 
  onToggleBought, 
  onEdit, 
  onDelete 
}: AssetCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const mainImage = asset.images?.[0];

  return (
    <div className={cn(
      "glass-card overflow-hidden group hover:border-indigo-500/50 transition-all duration-300",
      asset.bought && "opacity-75"
    )}>
      {/* Image Preview */}
      <div className="relative h-48 bg-[#0a0c14] overflow-hidden">
        {mainImage ? (
          <img 
            src={mainImage} 
            alt={asset.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
            <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
            <span className="text-[10px] uppercase tracking-widest font-bold">Keine Vorschau</span>
          </div>
        )}
        
        {/* Status Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {asset.priority && !asset.bought && (
            <div className="bg-red-500 text-white p-1.5 rounded-lg shadow-lg">
              <Flame className="w-4 h-4" />
            </div>
          )}
          {asset.bought && (
            <div className="bg-green-500 text-white p-1.5 rounded-lg shadow-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Action Overlay */}
        <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button 
            onClick={() => onToggleFav?.(asset.id)}
            className={cn("p-2.5 rounded-xl transition-all hover:scale-110", asset.favorite ? "bg-amber-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}
          >
            <Star className={cn("w-5 h-5", asset.favorite && "fill-current")} />
          </button>
          <button 
            onClick={() => onToggleBought?.(asset.id)}
            className={cn("p-2.5 rounded-xl transition-all hover:scale-110", asset.bought ? "bg-green-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="font-bold text-lg text-slate-100 line-clamp-1">{asset.name}</h3>
          <div className="text-indigo-400 font-bold whitespace-nowrap">
            {asset.price === 0 ? <span className="text-green-400">Gratis</span> : formatPrice(asset.price)}
          </div>
        </div>

        {asset.notes && (
          <p className="text-sm text-slate-400 line-clamp-2 mb-4 h-10">{asset.notes}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            {category ? (
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md border" style={{ color: category.color, borderColor: `${category.color}40`, backgroundColor: `${category.color}10` }}>
                {category.emoji} {category.name}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-500 uppercase">Unkategorisiert</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => onEdit?.(asset)}
              className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete?.(asset.id)}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {asset.url && (
              <a 
                href={asset.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 text-slate-500 hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

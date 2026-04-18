import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { DataService } from "@/services/data-service";
import AssetCard from "@/components/ui/AssetCard";
import { ListFilter, Search, ArrowUpDown, LayoutGrid, List as ListIcon } from "lucide-react";
import Link from "next/link";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AssetsPageProps {
  searchParams: {
    filter?: string;
    category?: string;
    search?: string;
    sort?: string;
  };
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const [assets, categories] = await Promise.all([
    DataService.getAssets(),
    DataService.getCategories()
  ]);

  const { filter, category: catId, search, sort } = searchParams;

  // Filtering
  let filteredAssets = assets.filter(asset => {
    if (filter === "open" && asset.bought) return false;
    if (filter === "bought" && !asset.bought) return false;
    if (filter === "favorites" && !asset.favorite) return false;
    if (catId && asset.category_id !== catId) return false;
    if (search && !asset.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Sorting
  if (sort === "price-asc") filteredAssets.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") filteredAssets.sort((a, b) => b.price - a.price);
  else if (sort === "name") filteredAssets.sort((a, b) => a.name.localeCompare(b.name));
  else filteredAssets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filters = [
    { label: "Alle", value: undefined },
    { label: "Offen", value: "open" },
    { label: "Gekauft", value: "bought" },
    { label: "Favoriten", value: "favorites" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Alle Assets</h1>
          <p className="text-slate-400">Verwalte und durchsuche deine Asset-Liste.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="btn-primary flex items-center gap-2">
            + Neues Asset
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={`/assets?${new URLSearchParams({ ...searchParams, filter: f.value || "" }).toString()}`}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                filter === f.value || (!filter && !f.value)
                  ? "bg-indigo-600 text-white"
                  : "bg-[#161925] text-slate-400 hover:text-white"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Suchen..."
              className="w-full bg-[#161925] border border-[#1e2235] rounded-xl py-2 pl-10 pr-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
            />
          </div>
          
          <div className="flex items-center gap-1 bg-[#161925] p-1 rounded-xl border border-[#1e2235]">
            <button className="p-1.5 bg-indigo-600 text-white rounded-lg"><LayoutGrid className="w-4 h-4" /></button>
            <button className="p-1.5 text-slate-500 hover:text-white rounded-lg"><ListIcon className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Category Strip */}
      <div className="flex items-center gap-3 overflow-x-auto pb-6 scrollbar-hide">
        <Link 
          href="/assets"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all",
            !catId ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "border-[#1e2235] bg-[#161925] text-slate-400 hover:border-slate-700"
          )}
        >
          Alle Kategorien
        </Link>
        {categories.map(cat => (
          <Link 
            key={cat.id}
            href={`/assets?category=${cat.id}`}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all whitespace-nowrap",
              catId === cat.id ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "border-[#1e2235] bg-[#161925] text-slate-400 hover:border-slate-700"
            )}
            style={catId === cat.id ? { color: cat.color, borderColor: `${cat.color}60`, backgroundColor: `${cat.color}15` } : {}}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
            {cat.emoji} {cat.name}
          </Link>
        ))}
      </div>

      {/* Grid */}
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAssets.map(asset => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              category={categories.find(c => c.id === asset.category_id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-card">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-200">Keine Assets gefunden</h3>
          <p className="text-slate-500">Versuche es mit anderen Filtern oder Suchbegriffen.</p>
        </div>
      )}
    </div>
  );
}

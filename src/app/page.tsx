import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { DataService } from "@/services/data-service";
import StatBox from "@/components/ui/StatBox";
import AssetCard from "@/components/ui/AssetCard";
import { 
  TrendingUp, 
  CreditCard, 
  Clock, 
  PieChart,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const [stats, assets, categories] = await Promise.all([
    DataService.getStats(),
    DataService.getAssets(),
    DataService.getCategories()
  ]);

  const recentAssets = assets.slice(0, 4);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-2">
          Willkommen zurück, <span className="text-indigo-400">{session.user?.name}</span>
        </h1>
        <p className="text-slate-400">Hier ist die Übersicht deiner geplanten Assets und Ausgaben.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatBox 
          label="Gesamtbudget" 
          value={formatCurrency(stats.total)} 
          meta={`${stats.n} Assets insgesamt`}
          icon={TrendingUp}
          colorClass="text-blue-400"
        />
        <StatBox 
          label="Bereits Gekauft" 
          value={formatCurrency(stats.spent)} 
          meta={`${stats.nBought} Assets erledigt`}
          icon={CreditCard}
          colorClass="text-green-400"
        />
        <StatBox 
          label="Noch Offen" 
          value={formatCurrency(stats.open)} 
          meta={`${stats.nOpen} Assets ausstehend`}
          icon={Clock}
          colorClass="text-amber-400"
        />
        <StatBox 
          label="Fortschritt" 
          value={`${stats.pct}%`} 
          meta={`${stats.nBought} von ${stats.n} gekauft`}
          icon={PieChart}
          colorClass="text-indigo-400"
          progress={stats.pct}
        />
      </div>

      {/* Categories Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Kategorien</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map(cat => {
            const catAssets = assets.filter(a => a.category_id === cat.id);
            const catTotal = catAssets.reduce((s, a) => s + (a.price || 0), 0);
            const catBought = catAssets.filter(a => a.bought).length;
            const catPct = catAssets.length > 0 ? Math.round((catBought / catAssets.length) * 100) : 0;

            return (
              <Link 
                key={cat.id} 
                href={`/assets?category=${cat.id}`}
                className="glass-card p-5 hover:bg-[#161925] transition-all group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{cat.emoji}</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-200">{cat.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{catAssets.length} Assets</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: cat.color }}>{catPct}%</div>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                  <div className="h-full transition-all duration-500" style={{ width: `${catPct}%`, backgroundColor: cat.color }} />
                </div>
                <div className="flex justify-between items-center text-xs font-medium text-slate-400">
                  <span>Gesamt: {formatCurrency(catTotal)}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Assets */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Zuletzt hinzugefügt</h2>
          <Link href="/assets" className="text-indigo-400 hover:text-indigo-300 text-sm font-bold flex items-center gap-2 group">
            Alle ansehen
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentAssets.map(asset => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              category={categories.find(c => c.id === asset.category_id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { DataService } from "@/services/data-service";
import { 
  ShieldCheck, 
  Users, 
  Settings, 
  Database, 
  Plus, 
  MoreVertical,
  Trash2,
  Mail
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "admin") {
    redirect("/");
  }

  const [users, categories, stats] = await Promise.all([
    DataService.getUsers(),
    DataService.getCategories(),
    DataService.getStats()
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Admin Panel</h1>
          <p className="text-slate-400">Systemverwaltung und Benutzerkontrolle.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Categories Management */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                Kategorien
              </h2>
              <button className="btn-primary py-2 px-4 text-xs">
                + Neu
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {categories.map((cat) => (
                <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{cat.emoji}</span>
                    <div>
                      <div className="font-bold text-slate-200">{cat.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold" style={{ color: cat.color }}>{cat.color}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-500 hover:text-white transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              System-Einstellungen
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#0a0c14] rounded-2xl border border-white/5">
                <div>
                  <div className="font-bold text-slate-200">Wartungsmodus</div>
                  <div className="text-xs text-slate-500">Deaktiviert alle öffentlichen Zugriffe.</div>
                </div>
                <div className="w-12 h-6 bg-slate-800 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-slate-600 rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0a0c14] rounded-2xl border border-white/5">
                <div>
                  <div className="font-bold text-slate-200">Discord Sync</div>
                  <div className="text-xs text-slate-500">Synchronisiert Rollen automatisch.</div>
                </div>
                <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Users Management */}
        <div className="space-y-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Benutzer
              </h2>
            </div>
            <div className="divide-y divide-white/5">
              {users.map((user) => (
                <div key={user.id} className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold uppercase">
                    {user.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-200 truncate">{user.name}</div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                        user.role === "admin" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                      )}>
                        {user.role}
                      </span>
                      {user.email && <span className="text-[10px] text-slate-500 truncate">{user.email}</span>}
                    </div>
                  </div>
                  <button className="p-2 text-slate-500 hover:text-white transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 bg-gradient-to-br from-indigo-600 to-purple-700 border-none text-white">
            <h3 className="font-bold mb-1">System Status</h3>
            <p className="text-white/70 text-xs mb-4">Alle Systeme laufen normal.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase opacity-60 font-bold">Assets</div>
                <div className="text-xl font-bold">{stats.n}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase opacity-60 font-bold">Nutzer</div>
                <div className="text-xl font-bold">{users.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutDashboard, 
  List, 
  Clock, 
  CheckCircle2, 
  Star, 
  ShieldCheck, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  Search,
  Package
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isAdmin = session?.user?.role === "admin";

  const navLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Alle Assets", href: "/assets", icon: List },
    { name: "Offen", href: "/assets?filter=open", icon: Clock },
    { name: "Gekauft", href: "/assets?filter=bought", icon: CheckCircle2 },
    { name: "Favoriten", href: "/assets?filter=favorites", icon: Star },
  ];

  return (
    <nav className={cn(
      "fixed left-0 top-0 h-screen bg-[#0f111a] border-r border-[#1e2235] transition-all duration-300 flex flex-col z-50",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <div className={cn("flex items-center gap-3 transition-opacity duration-300", isCollapsed && "opacity-0 invisible w-0")}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Package className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-white">JBI <span className="opacity-50 font-medium">Todo</span></span>
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-[#1e2235] rounded-lg text-slate-400 transition-colors"
        >
          <ChevronLeft className={cn("w-5 h-5 transition-transform duration-300", isCollapsed && "rotate-180")} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder={isCollapsed ? "" : "Suchen..."}
            className={cn(
              "w-full bg-[#161925] border border-[#1e2235] rounded-xl py-2 pl-10 pr-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-all",
              isCollapsed && "px-0 text-transparent"
            )}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className={cn("px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider", isCollapsed && "text-center px-0")}>
          {isCollapsed ? "•••" : "Übersicht"}
        </div>
        {navLinks.map((link) => (
          <Link 
            key={link.name} 
            href={link.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              pathname === link.href ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:bg-[#161925] hover:text-slate-200"
            )}
          >
            <link.icon className={cn("w-5 h-5", pathname === link.href ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200")} />
            {!isCollapsed && <span className="text-sm font-medium">{link.name}</span>}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className={cn("px-4 py-2 mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider", isCollapsed && "text-center px-0")}>
              {isCollapsed ? "•••" : "Admin"}
            </div>
            <Link 
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                pathname === "/admin" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:bg-[#161925] hover:text-slate-200"
              )}
            >
              <ShieldCheck className={cn("w-5 h-5", pathname === "/admin" ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200")} />
              {!isCollapsed && <span className="text-sm font-medium">Admin Panel</span>}
            </Link>
            <Link 
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                pathname === "/settings" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:bg-[#161925] hover:text-slate-200"
              )}
            >
              <Settings className={cn("w-5 h-5", pathname === "/settings" ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200")} />
              {!isCollapsed && <span className="text-sm font-medium">Einstellungen</span>}
            </Link>
          </>
        )}
      </div>

      {/* Footer / User */}
      <div className="p-4 border-t border-[#1e2235]">
        <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-[#161925] mb-2", isCollapsed && "justify-center px-0")}>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs uppercase">
            {session?.user?.name?.[0] || "?"}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-200 truncate">{session?.user?.name || "User"}</div>
              <div className="text-[10px] text-slate-500 uppercase">{session?.user?.role || "member"}</div>
            </div>
          )}
          {!isCollapsed && (
            <button 
              onClick={() => signOut()}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
        {isCollapsed && (
           <button 
           onClick={() => signOut()}
           className="w-full flex justify-center p-2 text-slate-500 hover:text-red-400 transition-colors"
         >
           <LogOut className="w-5 h-5" />
         </button>
        )}
      </div>
    </nav>
  );
}

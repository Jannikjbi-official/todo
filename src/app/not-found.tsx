"use client";

import Link from "next/link";
import { MoveLeft, HelpCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8">
        <HelpCircle className="w-10 h-10 text-amber-500" />
      </div>
      <h1 className="text-4xl font-bold mb-4">404 - Seite nicht gefunden</h1>
      <p className="text-slate-400 mb-10 max-w-md">
        Ups! Die Seite, nach der du suchst, existiert leider nicht oder wurde verschoben.
      </p>
      <Link href="/" className="btn-primary flex items-center gap-2">
        <MoveLeft className="w-4 h-4" />
        Zurück zum Dashboard
      </Link>
    </div>
  );
}

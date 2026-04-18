"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8">
        <AlertTriangle className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-4xl font-bold mb-4">Ein Fehler ist aufgetreten</h1>
      <p className="text-slate-400 mb-10 max-w-md">
        Entschuldigung, da ist etwas schiefgelaufen. Wir haben den Fehler protokolliert.
      </p>
      <button 
        onClick={() => reset()}
        className="btn-primary flex items-center gap-2"
      >
        <RefreshCcw className="w-4 h-4" />
        Erneut versuchen
      </button>
    </div>
  );
}

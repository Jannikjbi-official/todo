import { LucideIcon } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatBoxProps {
  label: string;
  value: string;
  meta?: string;
  icon: LucideIcon;
  colorClass?: string;
  className?: string;
  progress?: number;
}

export default function StatBox({ 
  label, 
  value, 
  meta, 
  icon: Icon, 
  colorClass = "text-indigo-400", 
  className,
  progress
}: StatBoxProps) {
  return (
    <div className={cn("glass-card p-6 flex flex-col relative overflow-hidden group hover:bg-[#161925] transition-colors", className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</div>
          <div className="text-2xl font-bold text-white">{value}</div>
        </div>
        <div className={cn("p-3 rounded-2xl bg-slate-800 group-hover:scale-110 transition-transform duration-300", colorClass.replace('text', 'text-opacity-20 bg'))}>
          <Icon className={cn("w-6 h-6", colorClass)} />
        </div>
      </div>
      
      {meta && <div className="text-xs text-slate-400 font-medium">{meta}</div>}
      
      {progress !== undefined && (
        <div className="mt-4">
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className={cn("absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-500", progress !== undefined ? "opacity-0" : "w-0 group-hover:w-full")} />
    </div>
  );
}

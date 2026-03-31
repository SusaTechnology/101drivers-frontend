// components/badges/AdminBadge.tsx
import { ShieldCheck as AdminPanelSettings } from 'lucide-react';

export function AdminBadge() {
  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      <AdminPanelSettings className="w-4 h-4 text-primary" />
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
        Admin
      </span>
    </div>
  );
}
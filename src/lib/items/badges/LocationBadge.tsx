// components/badges/LocationBadge.tsx
import { MapPin } from 'lucide-react';

interface LocationBadgeProps {
  location: string;
}

export function LocationBadge({ location }: LocationBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
      <MapPin className="w-4 h-4 text-primary" />
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
        {location}
      </span>
    </div>
  );
}
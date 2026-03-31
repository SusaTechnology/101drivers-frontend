// components/actions/SignOutAction.tsx
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LogOut } from 'lucide-react';

interface SignOutActionProps {
  onSignOut: () => void;
  className?: string;
}

export function SignOutAction({ onSignOut, className }: SignOutActionProps) {

    
  return (
    <Button
      onClick={onSignOut}
      className={cn(
        "hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold",
        className
      )}
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </Button>
  );
}
// components/actions/MobileMenuButton.tsx
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';

interface MobileMenuButtonProps {
  onOpen: () => void;
  className?: string;
}

export function MobileMenuButton({ onOpen, className }: MobileMenuButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("md:hidden w-11 h-11 rounded-2xl", className)}
      onClick={onOpen}
    >
      <Menu className="w-5 h-5" />
    </Button>
  );
}
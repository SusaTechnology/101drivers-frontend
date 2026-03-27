// components/dashboard/ViewSwitcher.tsx
import React from 'react';
import { PieChart, BarChart3, Table, LayoutGrid } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const VIEW_TYPES = ['donut', 'bar', 'table'] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

interface ViewSwitcherProps {
  value: ViewType;
  onChange: (value: ViewType) => void;
  options?: ViewType[];
}

const VIEW_CONFIG = {
  donut: {
    icon: PieChart,
    label: 'Donut Chart',
  },
  bar: {
    icon: BarChart3,
    label: 'Bar Chart',
  },
  table: {
    icon: Table,
    label: 'Table View',
  },
};

export function ViewSwitcher({ 
  value, 
  onChange,
  options = ['donut', 'bar', 'table']
}: ViewSwitcherProps) {
  return (
    <ToggleGroup 
      type="single" 
      value={value} 
      onValueChange={(val) => val && onChange(val as ViewType)}
      className="border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 gap-0"
    >
      <TooltipProvider>
        {options.map((viewType) => {
          const config = VIEW_CONFIG[viewType];
          const Icon = config.icon;
          return (
            <Tooltip key={viewType}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={viewType}
                  aria-label={config.label}
                  className="h-6 w-6 p-0 data-[state=on]:bg-primary data-[state=on]:text-slate-950 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Icon className="w-3.5 h-3.5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1">
                {config.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </ToggleGroup>
  );
}

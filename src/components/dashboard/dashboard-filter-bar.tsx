'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardFilterBarProps {
  children: React.ReactNode;
  className?: string;
  itemsPerPage?: number;
  onItemsPerPageChange?: (value: number) => void;
}

export function DashboardFilterBar({
  children,
  className,
  itemsPerPage,
  onItemsPerPageChange,
}: DashboardFilterBarProps) {
  return (
    <Card className={cn("p-4 bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-sm mb-8 rounded-2xl", className)}>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        {children}
        
        {itemsPerPage !== undefined && onItemsPerPageChange && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rows:</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(val) => onItemsPerPageChange(Number(val))}
            >
              <SelectTrigger className="w-[80px] h-8 text-[10px] font-bold border-slate-200/60 rounded-xl bg-white/50 backdrop-blur-sm">
                <SelectValue placeholder="Items" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200/60 shadow-xl">
                <SelectItem value="5" className="text-[10px] font-bold">5</SelectItem>
                <SelectItem value="10" className="text-[10px] font-bold">10</SelectItem>
                <SelectItem value="25" className="text-[10px] font-bold">25</SelectItem>
                <SelectItem value="50" className="text-[10px] font-bold">50</SelectItem>
                <SelectItem value="100" className="text-[10px] font-bold">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </Card>
  );
}

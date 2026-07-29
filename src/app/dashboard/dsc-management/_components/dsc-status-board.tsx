'use client';

import React, { useState } from 'react';
import { DSC, DSCWorkflowStage, Client } from './types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { User, Calendar, CreditCard, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';

interface BoardProps {
    dscs: DSC[];
    stages: DSCWorkflowStage[];
    clients: Client[];
    onStageChange: () => void;
}

// Stage color palette for visual differentiation
const stageColors = [
    { bg: 'bg-slate-50', border: 'border-slate-200', header: 'bg-slate-100', text: 'text-slate-700', badge: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400', progress: 'bg-slate-400' },
    { bg: 'bg-blue-50/60', border: 'border-blue-200', header: 'bg-blue-100/80', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', progress: 'bg-blue-500' },
    { bg: 'bg-violet-50/60', border: 'border-violet-200', header: 'bg-violet-100/80', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', progress: 'bg-violet-500' },
    { bg: 'bg-amber-50/60', border: 'border-amber-200', header: 'bg-amber-100/80', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', progress: 'bg-amber-500' },
    { bg: 'bg-emerald-50/60', border: 'border-emerald-200', header: 'bg-emerald-100/80', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', progress: 'bg-emerald-500' },
    { bg: 'bg-rose-50/60', border: 'border-rose-200', header: 'bg-rose-100/80', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', progress: 'bg-rose-500' },
    { bg: 'bg-cyan-50/60', border: 'border-cyan-200', header: 'bg-cyan-100/80', text: 'text-cyan-800', badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500', progress: 'bg-cyan-500' },
];

const paymentColor = (s?: string) =>
    s === 'PAID' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
        s === 'PARTIAL' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            'bg-red-50 text-red-600 border-red-200';

export function DSCStatusBoard({ dscs, stages, onStageChange }: BoardProps) {
    const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());

    const pendingDscs = dscs.filter(d => !d.currentStageId || d.currentStageId === 'pending' || d.currentStageId === '');
    const sortedStages = [...stages].sort((a, b) => a.order - b.order);

    // Build all columns: "pending" + stage ids
    const columns: { id: string; name: string; items: DSC[]; colorIdx: number; progress?: number }[] = [
        { id: '', name: 'Not Started', items: pendingDscs, colorIdx: 0 },
        ...sortedStages.map((s, i) => ({
            id: s.id,
            name: s.name,
            items: dscs.filter(d => d.currentStageId === s.id),
            colorIdx: (i + 1) % stageColors.length,
            progress: s.completionPercentage,
        })),
    ];

    const toggleCollapse = (id: string) => {
        setCollapsedCols(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleDragStart = (e: React.DragEvent, dscId: string) => {
        e.dataTransfer.setData('dscId', dscId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e: React.DragEvent, newStageId: string) => {
        e.preventDefault();
        const dscId = e.dataTransfer.getData('dscId');
        if (!dscId) return;
        try {
            const res = await fetch(`/api/dsc/${dscId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentStageId: newStageId })
            });
            if (res.ok) onStageChange();
        } catch (err) { console.error(err); }
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

    // Compact DSC card
    const DSCChip = ({ dsc }: { dsc: DSC }) => (
        <div
            draggable
            onDragStart={(e) => handleDragStart(e, dsc.id)}
            className="group flex items-center gap-2 bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40 transition-all duration-200 mb-1.5"
        >
            <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate text-slate-800">{dsc.companyName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    {dsc.currentHolder?.memberName && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                            <User className="w-2.5 h-2.5" />{dsc.currentHolder.memberName}
                        </span>
                    )}
                </div>
            </div>
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0 font-medium", paymentColor(dsc.paymentStatus))}>
                {dsc.paymentStatus || 'UNPAID'}
            </Badge>
        </div>
    );

    return (
        <div className="space-y-3">
            {/* Summary bar */}
            <div className="flex items-center gap-2 flex-wrap">
                {columns.map(col => {
                    const c = stageColors[col.colorIdx];
                    return (
                        <div key={col.id || 'pending'} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", c.border, c.bg)}>
                            <div className={cn("w-2 h-2 rounded-full", c.dot)} />
                            <span className={c.text}>{col.name}</span>
                            <span className={cn("font-bold tabular-nums", c.text)}>{col.items.length}</span>
                        </div>
                    );
                })}
                <div className="ml-auto text-xs text-muted-foreground font-medium">Total: {dscs.length}</div>
            </div>

            {/* Board columns — responsive grid fills full width */}
            <div
                className="grid gap-3 pb-2"
                style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(180px, 1fr))` }}
            >
                {columns.map(col => {
                    const c = stageColors[col.colorIdx];
                    const isCollapsed = collapsedCols.has(col.id);
                    const maxVisible = 10;
                    const visibleItems = isCollapsed ? col.items.slice(0, 3) : col.items;
                    const hasMore = col.items.length > 3;

                    return (
                        <div
                            key={col.id || 'pending'}
                            className={cn("rounded-xl border flex flex-col min-w-0", c.border, c.bg)}
                            onDrop={(e) => handleDrop(e, col.id)}
                            onDragOver={handleDragOver}
                        >
                            {/* Column header */}
                            <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-xl", c.header)}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                                    <span className={cn("text-xs font-bold truncate", c.text)}>{col.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Badge className={cn("text-[10px] font-bold px-1.5 py-0 h-5", c.badge, "hover:" + c.badge)}>{col.items.length}</Badge>
                                    {hasMore && (
                                        <button onClick={() => toggleCollapse(col.id)} className="p-0.5 rounded hover:bg-black/5 transition-colors">
                                            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar */}
                            {col.progress !== undefined && (
                                <div className="mx-3 mt-1.5">
                                    <div className="w-full bg-slate-200/60 h-1 rounded-full overflow-hidden">
                                        <div className={cn("h-full rounded-full transition-all", c.progress)} style={{ width: `${col.progress}%` }} />
                                    </div>
                                </div>
                            )}

                            {/* Cards */}
                            <div className="px-2 py-2 flex-1 min-h-[60px]">
                                {visibleItems.map(d => <DSCChip key={d.id} dsc={d} />)}
                                {hasMore && (
                                    <button
                                        onClick={() => toggleCollapse(col.id)}
                                        className="w-full text-[10px] font-medium text-center py-1 text-muted-foreground hover:text-slate-700 transition-colors"
                                    >
                                        {isCollapsed ? `Show all ${col.items.length}` : 'Collapse'}
                                    </button>
                                )}
                                {col.items.length === 0 && (
                                    <div className={cn("text-[10px] text-center py-3 border-2 border-dashed rounded-lg", c.border, "text-slate-400")}>
                                        Drop DSC here
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

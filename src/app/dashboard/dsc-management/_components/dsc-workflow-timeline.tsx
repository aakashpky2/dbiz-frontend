'use client';

import React from 'react';
import { DSC, DSCWorkflowStage } from './types';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface DSCWorkflowTimelineProps {
    dsc: DSC;
    stages: DSCWorkflowStage[];
}

export function DSCWorkflowTimeline({ dsc, stages }: DSCWorkflowTimelineProps) {
    const currentStageIndex = stages.findIndex(s => s.id === dsc.currentStageId);

    return (
        <div className="relative flex flex-col space-y-4 py-4">
            {stages.map((stage, index) => {
                const isCompleted = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const historyEntry = dsc.stageHistory?.[stage.id];

                return (
                    <div key={stage.id} className="flex relative items-start group">
                        {/* Line connector */}
                        {index < stages.length - 1 && (
                            <div
                                className={cn(
                                    "absolute left-[11px] top-6 w-[2px] h-[calc(100%+8px)] transition-colors duration-500",
                                    isCompleted ? "bg-green-500" : "bg-slate-200"
                                )}
                            />
                        )}

                        {/* Icon/Indicator */}
                        <div className="z-10 flex items-center justify-center bg-white dark:bg-slate-950">
                            {isCompleted ? (
                                <CheckCircle2 className="h-6 w-6 text-green-500 fill-green-50" />
                            ) : isCurrent ? (
                                <div className="h-6 w-6 rounded-full border-2 border-blue-600 flex items-center justify-center animate-pulse">
                                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                                </div>
                            ) : (
                                <Circle className="h-6 w-6 text-slate-300" />
                            )}
                        </div>

                        {/* Stage Details */}
                        <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className={cn(
                                    "text-sm font-bold transition-colors duration-300",
                                    isCompleted ? "text-slate-900" : isCurrent ? "text-blue-700 font-extrabold" : "text-slate-400"
                                )}>
                                    {stage.name}
                                </h4>
                                {historyEntry?.updatedAt && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {historyEntry.updatedAt}
                                    </span>
                                )}
                            </div>
                            <p className={cn(
                                "text-xs mt-0.5",
                                isCurrent ? "text-slate-600" : "text-slate-400"
                            )}>
                                {stage.description || (isCurrent ? "Currently in this stage" : "Awaiting processing")}
                            </p>
                            {historyEntry?.note && (
                                <div className="mt-2 bg-slate-50 dark:bg-slate-900 border-l-2 border-slate-200 p-2 text-[11px] text-slate-600 italic">
                                    "{historyEntry.note}"
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

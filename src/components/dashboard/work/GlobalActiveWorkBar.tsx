'use client';

import React from 'react';
import { useActiveWork } from '@/contexts/ActiveWorkContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

function formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatStartedAt(isoString: string | undefined): string {
    if (!isoString) return '';
    try {
        return format(new Date(isoString), 'h:mm a');
    } catch {
        return '';
    }
}

export function GlobalActiveWorkBar() {
    const { activeWork, loading, localElapsed, resumeWork, pauseWork } = useActiveWork();
    const router = useRouter();

    if (loading) return null;

    if (!activeWork) {
        return (
            <div className="hidden md:flex items-center text-xs text-muted-foreground bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-dashed border-slate-200 dark:border-slate-700">
                No active task
            </div>
        );
    }

    const taskTitle = activeWork.title || 'Active Task';
    const isPaused = activeWork.status === 'paused';
    const startedAtLabel = formatStartedAt(activeWork.started_at);

    const handlePillClick = () => {
        if (activeWork.task_id) {
            router.push(`/dashboard/work-register/my-tasks/${activeWork.task_id}`);
        }
    };

    const handleActionClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPaused) {
            try {
                await resumeWork(activeWork.id);
            } catch {
                // toast handled in context
            }
        } else {
            try {
                await pauseWork();
            } catch {
                // toast handled in context
            }
        }
    };

    const handleViewClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeWork.task_id) {
            router.push(`/dashboard/work-register/my-tasks/${activeWork.task_id}`);
        }
    };

    return (
        <div
            onClick={handlePillClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-200 hover:shadow-md bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800/50"
        >
            {/* Pulse indicator */}
            <div className={`h-2 w-2 rounded-full shrink-0 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />

            {/* Mobile — just title + timer */}
            <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                {taskTitle}
                <span className="font-mono ml-1 text-indigo-600 dark:text-indigo-400">
                    {formatDuration(localElapsed)}
                </span>
            </span>

            {/* Desktop — full pill */}
            <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                <strong className={isPaused ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {isPaused ? 'Paused:' : 'Working:'}
                </strong>
                <span className="max-w-[140px] lg:max-w-[200px] truncate font-medium">{taskTitle}</span>
                {startedAtLabel && (
                    <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[10px]">Started {startedAtLabel}</span>
                    </>
                )}
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums w-[58px]">
                    {formatDuration(localElapsed)}
                </span>
            </span>

            {/* Pause / Continue button */}
            <Button
                variant={isPaused ? 'default' : 'outline'}
                size="sm"
                className={`hidden md:flex h-6 rounded-full px-2.5 text-[10px] uppercase font-bold tracking-wider transition-colors ${
                    isPaused
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
                onClick={handleActionClick}
            >
                {isPaused ? <><Play className="h-2.5 w-2.5 mr-1" />Continue</> : <><Pause className="h-2.5 w-2.5 mr-1" />Pause</>}
            </Button>

            {/* View button */}
            <Button
                variant="outline"
                size="sm"
                className="hidden md:flex h-6 rounded-full px-2.5 text-[10px] uppercase font-bold tracking-wider border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                onClick={handleViewClick}
            >
                <ExternalLink className="h-2.5 w-2.5 mr-1" />View
            </Button>
        </div>
    );
}

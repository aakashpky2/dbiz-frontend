import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
    return (
        <div className="p-6 flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-1/4 rounded-xl bg-muted" />
                <Skeleton className="h-4 w-1/3 rounded-lg bg-muted" />
            </div>

            {/* Content Area */}
            <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl bg-muted border border-border" />
                ))}
            </div>
        </div>
    );
}

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
    return (
        <div className="w-full rounded-2xl border border-border overflow-hidden bg-card">
            <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/50/50">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-6 flex-1 rounded-lg bg-muted" />
                ))}
            </div>
            <div className="flex flex-col">
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex items-center gap-4 p-4 border-b border-border">
                        {Array.from({ length: columns }).map((_, c) => (
                            <Skeleton key={c} className="h-8 flex-1 rounded-xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

interface CardGridSkeletonProps {
    cards?: number;
}

export function CardGridSkeleton({ cards = 3 }: CardGridSkeletonProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {Array.from({ length: cards }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl bg-muted border border-border" />
            ))}
        </div>
    );
}

export function FormSkeleton() {
    return (
        <div className="flex flex-col gap-4 w-full">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24 rounded-md bg-muted" />
                    <Skeleton className="h-10 w-full rounded-xl bg-muted border border-border" />
                </div>
            ))}
            <div className="flex justify-end gap-2 mt-4">
                <Skeleton className="h-10 w-24 rounded-xl bg-muted" />
                <Skeleton className="h-10 w-24 rounded-xl bg-muted" />
            </div>
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="p-6 flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-1/4 rounded-xl bg-muted" />
                <Skeleton className="h-4 w-1/3 rounded-lg bg-muted" />
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl bg-muted border border-border" />
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Skeleton className="h-[400px] w-full rounded-2xl bg-muted border border-border" />
                </div>
                <div className="lg:col-span-1">
                    <Skeleton className="h-[400px] w-full rounded-2xl bg-muted border border-border" />
                </div>
            </div>
        </div>
    );
}

'use client';

import React from 'react';
import { InteractionCard } from '../components/InteractionCard';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { FormSkeleton } from '@/components/ui/page-skeleton';

interface TimelineTabProps {
    history: any[];
    isLoading?: boolean;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ history, isLoading }) => {
    // Sort latest first with robust fallback priority
    const sortedHistory = React.useMemo(() => {
        if (!history) return [];
        return [...history].sort((a, b) => {
            const getDate = (item: any) => {
                const dateStr = item.timestamp || item.performed_at || item.date || item.interactionDate || item.createdAt || item.created_at || item.revised_at;
                if (!dateStr) return 0;
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? 0 : d.getTime();
            };
            return getDate(b) - getDate(a);
        });
    }, [history]);

    if (isLoading) {
        return (
            <div className="py-6">
                <FormSkeleton />
            </div>
        );
    }

    if (sortedHistory.length === 0) {
        return (
            <EmptyState 
                title="No Chronology Found" 
                description="Initial contact has been established, but no subsequent follow-ups are on record." 
                icon={<History className="h-10 w-10 text-slate-400" />}
            />
        );
    }

    return (
        <div className="py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col mb-8">
                <h4 className="text-lg font-semibold text-gray-900">Interaction History</h4>
                <p className="text-sm text-gray-500">A chronological record of engagements with this client.</p>
            </div>
            <div className="flex flex-col gap-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gray-100">
                {sortedHistory.map((fu, i) => (
                    <InteractionCard key={fu.id || `fu-${i}`} interaction={fu} />
                ))}
            </div>
        </div>
    );
};

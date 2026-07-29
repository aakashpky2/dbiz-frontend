'use client';

import React, { useState } from 'react';
import { ProposalCard } from './ProposalCard';
import { FileText } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/page-skeleton';
import { Button } from '@/components/ui/button';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/ui/empty-state';

interface ProposalListProps {
    proposals: any[];
    onEdit: (p: any) => void;
    onGenerate: (p: any) => void;
    onDelete: (id: string, name: string) => void;
    onFollowUp: (p: any, tab?: 'add' | 'history') => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onSend: (id: string, payload: any) => void;
    onAccept: (id: string) => void;
    onConvert: (p: any) => void;
    onAddMoreWork: (p: any) => void;
    isSubmitting?: boolean;
    onNewProposal: () => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    emptyMessage?: string;
    activeTab?: 'pending' | 'generated';
    isLoading?: boolean;
    onView?: (p: any) => void;
    canManageProposals?: boolean;
}

export const ProposalList: React.FC<ProposalListProps> = ({
    proposals,
    onEdit,
    onGenerate,
    onDelete,
    onFollowUp,
    onApprove,
    onReject,
    onSend,
    onAccept,
    onConvert,
    onAddMoreWork,
    isSubmitting,
    onNewProposal,
    currentPage,
    totalPages,
    onPageChange,
    emptyMessage = "Capture requirements and formalize your enquiries into trackable proposals to boost conversion.",
    activeTab,
    isLoading,
    onView,
    canManageProposals
}) => {
    const [activeProposalId, setActiveProposalId] = useState<string | null>(null);

    const handleToggle = React.useCallback((id: string) => {
        setActiveProposalId(prev => prev === id ? null : id);
    }, []);

    if (isLoading) {
        return (
            <div className="p-6">
                <CardGridSkeleton cards={3} />
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <div className="py-12 px-6">
                <EmptyState 
                    title={emptyMessage.includes('search') ? "No Results Match Your Search" : "No proposals available yet"}
                    description={emptyMessage} 
                    icon={<FileText className="h-10 w-10 text-slate-400" />}
                    actionLabel="Create Manually"
                    onAction={onNewProposal}
                    className="border-none bg-transparent"
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 px-6 pb-8">
                {proposals.map((proposal) => (
                    <ProposalCard 
                        key={proposal.id}
                        proposal={proposal}
                        isExpanded={activeProposalId === proposal.id}
                        onToggle={handleToggle}
                        onEdit={onEdit}
                        onGenerate={onGenerate}
                        onDelete={onDelete}
                        onFollowUp={onFollowUp}
                        onApprove={onApprove}
                        onReject={onReject}
                        onSend={onSend}
                        onAccept={onAccept}
                        onConvert={onConvert}
                        onAddMoreWork={onAddMoreWork}
                        isSubmitting={isSubmitting}
                        activeTab={activeTab}
                        onView={onView}
                        canManageProposals={canManageProposals}
                    />
                ))}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};

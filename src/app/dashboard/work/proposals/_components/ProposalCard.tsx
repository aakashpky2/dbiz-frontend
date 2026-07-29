'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, User, CalendarDays, Building2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const ProposalActions = dynamic(() => import('./ProposalActions').then(mod => mod.ProposalActions), { ssr: false });
const ProposalExpandedContent = dynamic(() => import('./ProposalExpandedContent').then(mod => mod.ProposalExpandedContent), { ssr: false });
import { normalizeStage, STAGE_LABELS, getStageBadgeStyle } from './CRMFollowUpModal/lib/workflowEngine';
import { useProposal } from '@/hooks/use-proposals';
import { Skeleton } from '@/components/ui/skeleton';

interface ProposalCardProps {
    proposal: any;
    isExpanded: boolean;
    onToggle: (id: string) => void;
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
    activeTab?: 'pending' | 'generated';
    onView?: (p: any) => void;
    canManageProposals?: boolean;
}

export const ProposalCard = React.memo(({
    proposal,
    isExpanded,
    onToggle,
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
    activeTab,
    onView,
    canManageProposals
}: ProposalCardProps) => {
    // ... existing content ...
    const isHighValue = (proposal.totalAmount || 0) > 50000;
    const isOverdue = proposal.nextFollowUpDate && new Date(proposal.nextFollowUpDate) < new Date();

    const { data: fullProposalData, isLoading: isLoadingFull } = useProposal(isExpanded ? proposal.id : null);
    const expandedProposal = fullProposalData?.data || proposal;

    return (
        <Card className={cn(
            "group border-slate-200/60 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-xl",
            isExpanded ? "border-indigo-400 ring-2 ring-indigo-50 ring-offset-0" : "hover:border-indigo-200/60",
            isOverdue && !proposal.convertedToWork && "border-red-200 ring-1 ring-red-50",
            isHighValue && !isExpanded && "border-l-4 border-l-amber-400"
        )}>
            {/* Collapsed Header */}
            <div 
                className={cn(
                    "flex items-center gap-4 p-5 cursor-pointer transition-colors relative z-10",
                    isExpanded ? "bg-slate-50/80" : "bg-white hover:bg-slate-50/40"
                )}
                onClick={() => onToggle(proposal.id)}
            >
                {/* Expand Indicator */}
                <div className="shrink-0 transition-transform duration-300">
                    {isExpanded ? 
                        <ChevronDown className="h-5 w-5 text-indigo-600 stroke-[3]" /> : 
                        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-400" />
                    }
                </div>

                {/* Primary Info Grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    {/* Client Name */}
                    <div className="md:col-span-5 flex items-center gap-4">
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-500",
                            isExpanded ? "bg-indigo-600 text-white scale-110" : "bg-slate-50 border border-slate-100 text-blue-600 group-hover:scale-105"
                        )}>
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-black text-slate-900 text-base tracking-tight truncate">
                                {proposal.clientName}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">#{proposal.proposal_code || proposal.reference_no || 'Proposal'} {/* TODO: Replace with business-generated proposal reference number like PROP-2026-0001 */}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">v{proposal.version || '1.0'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Meta Info (Date) */}
                    <div className="md:col-span-4 flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">Creation Date</span>
                            <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-slate-300" />
                                <span className="text-[11px] font-bold text-slate-700 tabular-nums">{proposal.date}</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Badge - sourced from currentStage as single source of truth */}
                    <div className="md:col-span-3 flex items-center justify-start md:justify-center">
                        <div className="flex flex-col md:flex-row items-center gap-2">
                            <Badge 
                                variant="outline" 
                                className={cn(
                                    "font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 shadow-sm transition-all animate-in fade-in zoom-in-95",
                                    getStageBadgeStyle(proposal?.currentStage || proposal?.current_stage || proposal?.status || "Draft")
                                )}
                            >
                                {STAGE_LABELS[normalizeStage(proposal?.currentStage || proposal?.current_stage || proposal?.status || "Draft")] ?? (proposal?.currentStage || proposal?.current_stage || proposal?.status || 'Draft')}
                            </Badge>
                            {proposal.convertedToWork && (
                                <Badge className="bg-emerald-600 text-white border-0 font-black text-[8px] uppercase tracking-widest px-2 py-1 shadow-md animate-in slide-in-from-right-2">
                                    Converted to Work
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Collapsed Actions */}
                <ProposalActions 
                    proposal={proposal} 
                    isExpanded={false}
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
                    activeTab={activeTab}
                    onView={onView}
                    canManageProposals={canManageProposals}
                />
            </div>

            {/* Expandable Section */}
            <div className={cn(
                "grid transition-all duration-300 ease-in-out border-t border-slate-100/50",
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    {isExpanded && isLoadingFull ? (
                        <div className="p-6 space-y-4 animate-in fade-in">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : (
                        <ProposalExpandedContent 
                            proposal={expandedProposal} 
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
                    )}
                </div>
            </div>
        </Card>
    );
});

ProposalCard.displayName = 'ProposalCard';

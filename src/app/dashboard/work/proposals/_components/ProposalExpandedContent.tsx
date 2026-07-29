'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProposalActions } from './ProposalActions';
import { Briefcase, IndianRupee, MessageSquare, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeStage, STAGE_LABELS, getStageBadgeStyle, isPendingProposal } from './CRMFollowUpModal/lib/workflowEngine';
import { calculateProposalFinancials } from '@/lib/proposal-utils';
import { MetadataPanel } from '@/components/common/metadata-panel';
import { format } from 'date-fns';

interface ProposalExpandedContentProps {
    proposal: any;
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

export const ProposalExpandedContent: React.FC<ProposalExpandedContentProps> = ({
    proposal,
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
}) => {
    const latestFollowUp = React.useMemo(() => {
        if (!proposal.followUps || proposal.followUps.length === 0) return null;
        return [...proposal.followUps].sort((a, b) => {
            const dateA = new Date(a.date || a.interactionDate || a.createdAt).getTime();
            const dateB = new Date(b.date || b.interactionDate || b.createdAt).getTime();
            return dateB - dateA;
        })[0];
    }, [proposal.followUps]);

    const isPending = isPendingProposal(proposal);
    const financials = React.useMemo(() => calculateProposalFinancials(proposal.proposedWork || []), [proposal.proposedWork]);

    return (
        <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                {/* Left Column: Services & Stage */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm transition-all hover:bg-slate-100/50">
                        <div className="flex items-center gap-2 mb-1">
                            <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proposed Services</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 leading-relaxed">
                            {proposal.proposedWork && proposal.proposedWork.length > 0 
                                ? proposal.proposedWork.map((w: any) => w.workTypeName).join(', ') 
                                : 'No services specified'}
                        </p>
                    </div>

                    {!isPending && (
                        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <History className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Stage</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-2">
                                    <Badge variant="outline" className={cn(
                                        "w-fit font-black uppercase tracking-tighter",
                                        getStageBadgeStyle(proposal?.currentStage || proposal?.current_stage || proposal?.status || "Draft")
                                    )}>
                                        {STAGE_LABELS[normalizeStage(proposal?.currentStage || proposal?.current_stage || proposal?.status || "Draft")] ?? (proposal?.currentStage || proposal?.current_stage || proposal?.status || 'Draft')}
                                    </Badge>
                                    
                                    {proposal.convertedToWork && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge className="bg-emerald-600 text-white border-0 font-black text-[8px] uppercase tracking-widest px-2 py-0.5">
                                                Converted to Work
                                            </Badge>
                                            {proposal.convertedAt && (
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    on {new Date(proposal.convertedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {proposal.conversionProbability && (
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Win Probability</span>
                                        <span className={cn(
                                            "text-xs font-black tabular-nums",
                                            proposal.conversionProbability >= 70 ? "text-emerald-600" :
                                            proposal.conversionProbability >= 40 ? "text-amber-600" : "text-red-600"
                                        )}>{proposal.conversionProbability}%</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Financials & Context */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <IndianRupee className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Net Amount</span>
                            </div>
                            {financials.totalDiscount > 0 && (
                                <Badge className="bg-green-100 text-green-700 border-green-200 text-[8px] font-black uppercase tracking-widest h-4 px-1.5">
                                    -₹{financials.totalDiscount.toLocaleString()} OFF
                                </Badge>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-black text-slate-900 tracking-tighter">
                                ₹{financials.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            {financials.totalDiscount > 0 && (
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter line-through">
                                    ₹{financials.totalBeforeDiscount.toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>

                    {proposal.queryDescription && (
                        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-amber-50/50 border border-amber-100/60 shadow-sm">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Requirement Notes</span>
                            </div>
                            <p className="text-xs font-semibold text-amber-900/70 leading-relaxed italic line-clamp-3">
                                "{proposal.queryDescription}"
                            </p>
                        </div>
                    )}

                    {!isPending && (
                        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[140px]">
                            <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-1">
                                <div className="flex items-center gap-2">
                                    <History className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Latest Interaction</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {proposal.nextFollowUpDate && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[8px] font-black uppercase tracking-widest h-5 px-2">
                                            Next: {new Date(proposal.nextFollowUpDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                        </Badge>
                                    )}
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => onFollowUp(proposal, 'history')}
                                        className="h-6 px-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-md"
                                    >
                                        More
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1">
                                {latestFollowUp ? (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="secondary" className="text-[9px] h-4.5 font-black uppercase tracking-wider border-slate-100 bg-slate-100 text-slate-600 px-2">
                                                {latestFollowUp.type || latestFollowUp.interactionType || 'Engagement'}
                                            </Badge>
                                            <span className="text-[10px] font-bold tabular-nums text-slate-400 uppercase tracking-tighter">
                                                {new Date(latestFollowUp.date || latestFollowUp.interactionDate || latestFollowUp.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 leading-snug line-clamp-2">
                                            {latestFollowUp.notesSummary || latestFollowUp.remarks || 'No notes summary available.'}
                                        </p>
                                        <div className="flex items-center gap-1.5 opacity-50">
                                            <div className="h-1 w-1 rounded-full bg-slate-400" />
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                                                Logged by {latestFollowUp.createdBy || 'System'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No interactions yet.</p>
                                        <p className="text-[9px] font-semibold text-slate-400/50 mt-1">Start a conversation to track progress</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 print:hidden">
                <MetadataPanel 
                    createdBy={proposal?.createdByName || undefined}
                    createdOn={proposal?.createdAt ? format(new Date(proposal.createdAt), 'dd MMM yyyy, p') : '-'}
                    updatedBy={proposal?.updatedByName || undefined}
                    updatedOn={proposal?.updatedAt ? format(new Date(proposal.updatedAt), 'dd MMM yyyy, p') : '-'}
                />
            </div>

            <ProposalActions 
                proposal={proposal} 
                isExpanded={true}
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
        </div>
    );
};

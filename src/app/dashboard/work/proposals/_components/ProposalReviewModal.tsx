'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
    Check, 
    Edit, 
    X, 
    FileText, 
    User, 
    Building2, 
    Briefcase, 
    IndianRupee, 
    Mail, 
    Phone, 
    Calendar, 
    Clock, 
    MapPin,
    AlertCircle,
    UserCheck,
    Tag,
    Info,
    History,
    MessageSquare,
    Loader2,
    Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeStage, STAGE_LABELS, getStageBadgeStyle } from './CRMFollowUpModal/lib/workflowEngine';
import { calculateProposalFinancials } from '@/lib/proposal-utils';

interface ProposalReviewModalProps {
    proposal: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (id: string) => void;
    onReject?: (id: string) => void;
    onEdit: (p: any) => void;
    isSubmitting?: boolean;
    title?: string;
    confirmLabel?: string;
    confirmIcon?: React.ReactNode;
    showReject?: boolean;
}

export const ProposalReviewModal: React.FC<ProposalReviewModalProps> = ({
    proposal,
    open,
    onOpenChange,
    onConfirm,
    onReject,
    onEdit,
    isSubmitting,
    title = "Review Proposal",
    confirmLabel = "Approve Now",
    confirmIcon = <Check className="h-4 w-4 stroke-[3]" />,
    showReject = false
}) => {
    if (!proposal) return null;

    const stage = normalizeStage(proposal?.currentStage || proposal?.current_stage || proposal?.status || "Draft");
    const workItems = proposal.proposedWork || [];
    const contacts = proposal.contacts || [];
    const primaryContact = contacts[0] || null;

    // Unified financial calculation
    const financials = calculateProposalFinancials(workItems);
    const { 
        profSubtotal, 
        govtSubtotal, 
        totalGst: gstAmount, 
        totalDiscount, 
        totalBeforeDiscount, 
        finalTotal: totalAmount 
    } = financials;

    // Note: User explicitly requested Government fee split-ups to be shown ITEM-WISE in the table,
    // not aggregated in the final summary. So we removed the global govtFeeSplit aggregation logic.

    const handleConfirm = () => {
        onConfirm(proposal.id);
        onOpenChange(false);
    };

    const handleReject = () => {
        if (onReject) {
            onReject(proposal.id);
            onOpenChange(false);
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
                {/* Header */}
                <DialogHeader className="px-8 py-6 border-b shrink-0 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                                <FileText className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800">{title}</DialogTitle>
                                <DialogDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-0.5 flex items-center gap-2">
                                    {proposal.id?.slice(0, 8) || 'DRAFT'} <span className="h-1 w-1 rounded-full bg-slate-300" /> V{proposal.version || '1.0'} <span className="h-1 w-1 rounded-full bg-slate-300" /> {new Date(proposal.createdAt || proposal.date || Date.now()).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className={cn(
                            "h-7 px-3 font-black uppercase tracking-widest text-[10px] border-2",
                            getStageBadgeStyle(proposal.currentStage)
                        )}>
                            {STAGE_LABELS[stage] || proposal.currentStage}
                        </Badge>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 custom-scrollbar bg-slate-50/30">
                    
                    {/* Top Stats/Context Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 opacity-50">
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Client Name</span>
                            </div>
                            <p className="text-sm font-black text-slate-800 uppercase truncate">{proposal.clientName || 'N/A'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">Source: {proposal.reference || 'Direct'}</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 opacity-50">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expected Delivery</span>
                            </div>
                            <p className="text-sm font-black text-slate-800 uppercase truncate">
                                {proposal.processingDays || 0} Days {proposal.processingHours ? `/ ${proposal.processingHours} Hrs` : ''}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">Standard Timeline</p>
                        </div>
                    </div>

                    {/* Primary Contact Details */}
                    {primaryContact && (
                        <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100/50 space-y-4">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-blue-600" />
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-700">Contact Details</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Name</p>
                                    <p className="text-sm font-black text-slate-800 uppercase">{primaryContact.name}</p>
                                    {primaryContact.description && <p className="text-[10px] font-bold text-slate-500 uppercase italic">{primaryContact.description}</p>}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Phone</p>
                                    <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                                        <Phone className="h-3 w-3 text-slate-400" />
                                        {primaryContact.phone}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Email</p>
                                    <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                                        <Mail className="h-3 w-3 text-slate-400" />
                                        <span className="lowercase">{primaryContact.email || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Work Items Table */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-slate-400" />
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Proposed Services</h4>
                            </div>
                            <Badge variant="secondary" className="bg-slate-200/50 text-slate-600 border-none font-black text-[9px] uppercase tracking-widest h-5">
                                {workItems.length} Services
                            </Badge>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Description</th>
                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-32">Professional Fee</th>
                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-32">Government Fee</th>
                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-32">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {workItems.map((item: any, idx: number) => {
                                        const pFee = Number(item.professionalFee) || 0;
                                        const gFee = Number(item.governmentFee) || 0;
                                        const isGst = item.isGstApplicable;
                                        const rate = (Number(item.gstPercentage) || 18) / 100;
                                        const on = item.gstAppliedOn || 'professional';
                                        
                                        let gst = 0;
                                        if (isGst) {
                                            if (on === 'professional') gst = pFee * rate;
                                            else if (on === 'government') gst = gFee * rate;
                                            else if (on === 'both') gst = (pFee + gFee) * rate;
                                        }

                                        const itemTotalBeforeDiscount = pFee + gFee + gst;
                                        const dType = item.discountType || 'amount';
                                        const dValue = Number(item.discountValue) || 0;
                                        let itemDiscount = 0;
                                        if (dType === 'percentage') {
                                            itemDiscount = itemTotalBeforeDiscount * Math.min(dValue, 100) / 100;
                                        } else {
                                            itemDiscount = Math.min(dValue, itemTotalBeforeDiscount);
                                        }

                                        const rowTotal = itemTotalBeforeDiscount - itemDiscount;
                                        
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <p className="text-xs font-black text-slate-800 uppercase leading-tight">{item.workTypeName}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                                                        {item.departmentName} {item.categoryName ? `• ${item.categoryName}` : ''}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                        {isGst && (
                                                            <div className="h-4 px-1.5 rounded-md bg-blue-50 border border-blue-100 flex items-center">
                                                                <span className="text-[7px] font-black uppercase tracking-widest text-blue-600">GST 18% on {on}</span>
                                                            </div>
                                                        )}
                                                        {itemDiscount > 0 && (
                                                            <div className="h-4 px-1.5 rounded-md bg-green-50 border border-green-100 flex items-center">
                                                                <span className="text-[7px] font-black uppercase tracking-widest text-green-600">Discount -₹{itemDiscount.toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-right font-bold text-xs tabular-nums text-slate-600">
                                                    ₹{pFee.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3.5 text-right font-bold text-xs tabular-nums text-slate-600 align-top">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span>₹{gFee.toLocaleString()}</span>
                                                        {(() => {
                                                            const rows = item.governmentFeeBreakup || item.governmentFees || item.governmentFeeRows || item.government_fees || [];
                                                            if (Array.isArray(rows) && rows.length > 0) {
                                                                return rows.map((fee: any, fIdx: number) => {
                                                                    const name = fee.fee_name || fee.name || fee.label || fee.feeName || 'Govt Fee';
                                                                    const amount = Number(fee.amount || fee.feeAmount || fee.value || 0);
                                                                    if (amount <= 0) return null;
                                                                    return (
                                                                        <div key={`split-${idx}-${fIdx}`} className="text-[8px] font-black uppercase text-slate-400">
                                                                            {name}: ₹{amount.toLocaleString()}
                                                                        </div>
                                                                    );
                                                                });
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-right font-black text-xs tabular-nums text-slate-900">
                                                    ₹{rowTotal.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financial Summary Box */}
                    <div className="flex justify-end">
                        <div className="w-full md:w-80 rounded-2xl bg-slate-200 p-6 shadow-lg border border-slate-300 space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
                                <span>Professional Fee Total</span>
                                <span className="text-black font-black tabular-nums">₹{profSubtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
                                <span>Government Fee Total</span>
                                <span className="text-black font-black tabular-nums">₹{govtSubtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
                                <span>GST Amount</span>
                                <span className="text-black font-black tabular-nums">₹{gstAmount.toLocaleString()}</span>
                            </div>

                            {totalDiscount > 0 && (
                                <>
                                    <Separator className="bg-slate-300 my-1 opacity-50" />
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
                                        <span>Before Discount</span>
                                        <span className="text-black font-black tabular-nums">₹{totalBeforeDiscount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
                                        <span>Discount</span>
                                        <span className="font-black tabular-nums">-₹{totalDiscount.toLocaleString()}</span>
                                    </div>
                                </>
                            )}
                            
                            <Separator className="bg-slate-300 my-1" />
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-black">Net Amount</span>
                                <span className="text-xl font-black text-black tracking-tighter tabular-nums">₹{totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Description / Notes */}
                    {(proposal.description || proposal.queryDescription) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {proposal.description && (
                                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proposal Description</span>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {proposal.description}
                                    </p>
                                </div>
                            )}
                            {proposal.queryDescription && (
                                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inquiry Notes</span>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600 leading-relaxed whitespace-pre-wrap italic">
                                        "{proposal.queryDescription}"
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Latest Activity */}
                    {proposal.followUps?.length > 0 && (
                        <div className="p-5 rounded-2xl bg-slate-100/50 border border-slate-200/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <History className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Latest Activity</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {new Date(proposal.followUps[proposal.followUps.length - 1].createdAt || proposal.followUps[proposal.followUps.length - 1].date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-black text-slate-700 uppercase tracking-tight">
                                    {proposal.followUps[proposal.followUps.length - 1].interactionType || 'Follow-up Logged'}
                                </p>
                                <p className="text-xs font-medium text-slate-500 leading-relaxed line-clamp-2">
                                    {proposal.followUps[proposal.followUps.length - 1].notesSummary || proposal.followUps[proposal.followUps.length - 1].remarks || 'N/A'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="px-8 py-5 border-t bg-slate-50 shrink-0 gap-3">
                    <div className="flex items-center justify-between w-full">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="h-11 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl"
                        >
                            <X className="h-4 w-4 mr-2" /> Cancel
                        </Button>
                        <div className="flex items-center gap-3">
                            {showReject && onReject && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleReject}
                                    className="h-11 px-6 font-black uppercase tracking-widest text-[10px] border-2 border-slate-200 hover:bg-white hover:border-red-500 hover:text-red-600 rounded-xl transition-all"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" /> Reject
                                </Button>
                            )}
                            <Button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting}
                                className="h-11 px-10 font-black uppercase tracking-[0.2em] text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmIcon}
                                {confirmLabel}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

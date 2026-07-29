'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IndianRupee, User, Clock, AlertTriangle, TrendingUp, Building2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { isBefore } from 'date-fns';
import { startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface OverviewTabProps {
    proposal: any;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ proposal }) => {
    const isOverdue = proposal?.nextFollowUpDate && isBefore(new Date(proposal.nextFollowUpDate), startOfDay(new Date()));
    const followUps = proposal?.followUps || [];
    const latestInteraction = followUps.length > 0 ? followUps[followUps.length - 1] : null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {isOverdue && !proposal.convertedToWork && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50/50 border border-red-100 text-red-900">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold">Follow-up Overdue</span>
                        <span className="text-xs text-red-700/70">Scheduled for {proposal?.nextFollowUpDate ? format(new Date(proposal.nextFollowUpDate), 'dd MMM yyyy') : 'N/A'}, but no interaction logged since.</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Client Entity</span>
                            <span className="text-sm font-semibold text-gray-900">{proposal.clientName}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                            <IndianRupee className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Proposal Value</span>
                            <span className="text-sm font-semibold text-gray-900">₹{(proposal.totalAmount || proposal.amount || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                            <User className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Assigned Consultant</span>
                            <span className="text-sm font-semibold text-gray-900">{proposal.assignedTo?.name || 'Unassigned'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Conversion Probability</span>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className={cn(
                                            "h-full transition-all duration-1000",
                                            proposal.conversionProbability > 70 ? "bg-green-500" :
                                            proposal.conversionProbability > 30 ? "bg-orange-500" : "bg-blue-500"
                                        )} 
                                        style={{ width: `${proposal.conversionProbability || 0}%` }} 
                                    />
                                </div>
                                <span className="text-xs font-bold text-gray-700">{proposal.conversionProbability || 0}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col">
                    <h4 className="text-lg font-semibold text-gray-900">Latest Engagement</h4>
                    <p className="text-sm text-gray-500">Summary of the most recent interaction with this client.</p>
                </div>
                
                {latestInteraction ? (
                    <div className="p-6 rounded-2xl border border-gray-100 bg-white shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-100 text-[10px] uppercase tracking-wider font-bold px-3 py-1">
                                {latestInteraction.interactionType}
                            </Badge>
                            <div className="flex items-center gap-1.5 text-gray-400">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">{latestInteraction?.date ? format(new Date(latestInteraction.date), 'dd MMM yyyy') : 'N/A'}</span>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-100 rounded-full" />
                            <p className="pl-4 text-sm text-gray-600 leading-relaxed italic">
                                {latestInteraction.remarks}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-sm font-medium text-gray-400">No interaction logs found for this proposal.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

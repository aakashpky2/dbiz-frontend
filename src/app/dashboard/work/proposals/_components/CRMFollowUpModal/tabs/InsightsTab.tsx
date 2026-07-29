'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { differenceInDays } from 'date-fns';
import { PieChart, TrendingUp, Calendar, Zap, MessageCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface InsightsTabProps {
    proposal: any;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({ proposal }) => {
    const followUps = proposal.followUps || [];
    const totalFollowUps = followUps.length;
    
    // Proposal age based on created date of proposal or first followup
    let startTimestamp = proposal.createdAt || Date.now();
    if (proposal.createdAt && typeof proposal.createdAt === 'string') {
        startTimestamp = new Date(proposal.createdAt).getTime();
    }
    const daysSinceCreated = differenceInDays(new Date(), new Date(startTimestamp));
    
    // Calculate responsiveness / sentiment
    const positiveCount = followUps.filter((f: any) => 
        f.clientSentiment === 'positive' || f.followUpOutcome?.includes('accepted')
    ).length;
    
    const responsivenessContent = totalFollowUps > 0 
        ? Math.round((positiveCount / totalFollowUps) * 100)
        : 0;

    // Revision Cycles
    const revisionCount = followUps.filter((f: any) => 
        f.followUpOutcome === 'client_revision_requested' || 
        f.followUpOutcome === 'internal_revision_requested' ||
        f.requestedRevision === true
    ).length;

    // Calculate Risk Level
    let riskLevel = 'Low Risk';
    let riskReason = 'Active engagement';
    let insightMessage = "Moving smoothly. Continue planned cadence.";

    if (revisionCount >= 3) {
        riskLevel = 'High Risk';
        riskReason = 'Infinite Revision Loop detected';
        insightMessage = `Proposal has undergone ${revisionCount} revisions. Recommend scheduling a direct alignment meeting to close requirements.`;
    } else if (daysSinceCreated > 30 && proposal.currentStage !== 'accepted' && proposal.currentStage !== 'closed') {
        riskLevel = 'Medium Risk';
        riskReason = 'Stagnant deal cycle';
        insightMessage = 'Cycle is extending beyond 30 days. Recommend sending a "Re-engagement" touchpoint.';
    } else if (proposal.currentStage === 'approved') {
        riskLevel = 'Low Risk';
        insightMessage = 'Internally approved. Ready to send to the client immediately.';
    } else if (followUps.some((f: any) => f.competitorMentioned)) {
        riskLevel = 'High Risk';
        riskReason = 'Competitor active';
        insightMessage = 'Client mentioned a competitor. Expedite interactions and consider focusing on strict differentiators.';
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-100 pb-2">Deal Analytics & Risks</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-100 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex flex-col gap-2">
                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <span className="text-2xl font-black text-slate-900">{totalFollowUps}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interactions</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex flex-col gap-2">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <span className="text-2xl font-black text-slate-900">{daysSinceCreated}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Days Active</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex flex-col gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Zap className="h-4 w-4" />
                            </div>
                            <span className="text-2xl font-black text-slate-900">{responsivenessContent}%</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Positive Sentiment</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex flex-col gap-2">
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", 
                                revisionCount > 2 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                            )}>
                                <AlertCircle className="h-4 w-4" />
                            </div>
                            <span className="text-2xl font-black text-slate-900">{revisionCount}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Revision Cycles</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className={cn("p-8 rounded-3xl shadow-lg relative overflow-hidden", 
                riskLevel === 'High Risk' ? "bg-red-900 text-white" : 
                riskLevel === 'Medium Risk' ? "bg-amber-100 text-amber-900" : 
                "bg-slate-900 text-white"
            )}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <PieChart className="h-32 w-32" />
                </div>
                <div className="relative z-10 flex flex-col gap-4">
                    <Badge className={cn("w-fit border-0 text-[10px] font-black tracking-[0.2em] px-4", 
                        riskLevel === 'High Risk' ? "bg-red-500 text-white" : 
                        riskLevel === 'Medium Risk' ? "bg-amber-500 text-white" : 
                        "bg-blue-500 text-white"
                    )}>
                        {riskLevel.toUpperCase()}
                    </Badge>
                    <h3 className="text-xl font-bold tracking-tight max-w-md">
                        {insightMessage}
                    </h3>
                    {riskReason && riskLevel !== 'Low Risk' && (
                        <p className={cn("text-sm font-medium tracking-tight", 
                            riskLevel === 'High Risk' ? "text-red-300" : "text-amber-700"
                        )}>Flagged due to: {riskReason}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

'use client';

import { AlertCircle, Clock, CheckCircle2, FileEdit, Users, HelpCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardInsights({ alerts = {} }: { alerts?: any }) {
    const insights = [
        {
            title: "Overdue Tasks",
            value: alerts.overdueTasks || 0,
            description: "Require immediate attention",
            icon: AlertCircle,
            color: "text-red-600",
            bg: "bg-red-50",
            border: "border-red-100",
        },
        {
            title: "Tasks Due Today",
            value: alerts.tasksDueToday || 0,
            description: "Scheduled for completion",
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
        },
        {
            title: "Pending Approvals",
            value: alerts.pendingApprovals || 0,
            description: "Awaiting your review",
            icon: HelpCircle,
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100",
        },
        {
            title: "Draft Proposals",
            value: alerts.draftProposals || 0,
            description: "Needs to be finalized",
            icon: FileEdit,
            color: "text-purple-600",
            bg: "bg-purple-50",
            border: "border-purple-100",
        },
        {
            title: "Inactive Clients",
            value: alerts.inactiveClients || 0,
            description: "No recent activity",
            icon: Users,
            color: "text-slate-600",
            bg: "bg-slate-100",
            border: "border-slate-200",
        }
    ];

    return (
        <div className="space-y-4 animate-in fade-in duration-500 delay-100">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Smart Insights</h3>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {insights.map((insight, i) => (
                    <Card key={i} className={`border ${insight.border} shadow-sm hover:shadow-md transition-shadow cursor-pointer`}>
                        <CardContent className="p-4 flex flex-col items-start gap-3">
                            <div className={`p-2 rounded-lg ${insight.bg}`}>
                                <insight.icon className={`h-5 w-5 ${insight.color}`} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-900">{insight.value}</div>
                                <div className="text-xs font-bold text-slate-700 mt-1">{insight.title}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{insight.description}</div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

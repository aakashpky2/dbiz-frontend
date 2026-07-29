'use client';

import { 
    Users, Briefcase, LayoutList, 
    CheckSquare, Clock, FileText, 
    CheckCircle, ShieldCheck
} from 'lucide-react';

export function AdminOverview({ kpis = {} }: { kpis?: any }) {
    const stats = [
        { label: "Total Clients", value: kpis.totalClients || 0, icon: Briefcase },
        { label: "Total Proposals", value: kpis.totalProposals || 0, icon: FileText },
        { label: "Pending Proposals", value: kpis.pendingProposals || 0, icon: Clock },
        { label: "Accepted Proposals", value: kpis.acceptedProposals || 0, icon: ShieldCheck },
        { label: "Active Works", value: kpis.activeWorks || 0, icon: LayoutList },
        { label: "Completed Works", value: kpis.completedWorks || 0, icon: CheckCircle },
        { label: "DSC Expiring", value: kpis.dscExpiring || 0, icon: CheckSquare },
    ];

    return (
        <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">System Statistics</h3>
                <span className="text-xs font-medium text-slate-400">
                    Last updated: {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                {stats.map((stat, idx) => (
                    <div 
                        key={idx} 
                        className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-shadow cursor-default group"
                    >
                        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors mb-2">
                            <stat.icon className="h-4 w-4 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white mb-0.5">{stat.value}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

'use client';

import React from 'react';
import { Building, User, ChevronDown, ChevronRight, Edit, Trash2, Shield, Phone, EyeOff, Eye, Mail, FileText, CheckCircle2, Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QueryWorkItem {
    workTypeId: string;
    workTypeName: string;
    departmentName: string;
    categoryName: string;
}

interface EnquiryContact {
    id: string;
    name: string;
    phone: string;
    email?: string;
    description?: string;
}

interface QueryEntry {
    id: string;
    companyName: string;
    contactPerson: string;
    contactNumber: string;
    contactCountryCode?: string;
    emailId: string;
    workItems?: QueryWorkItem[];
    status: 'Open' | 'Working' | 'Resolved' | 'Closed' | 'Dropped' | 'Proposal Generated';
}

interface EnquiryCardProps {
    query: QueryEntry;
    isExpanded: boolean;
    showPhone: boolean;
    showEmail: boolean;
    onToggleExpand: (id: string) => void;
    onTogglePhone: (id: string, e?: React.MouseEvent) => void;
    onToggleEmail: (id: string, e?: React.MouseEvent) => void;
    onEdit: (q: QueryEntry) => void;
    onDelete: (q: QueryEntry) => void;
    onDrop: (q: QueryEntry) => void;
    onRaiseProposal: (q: QueryEntry) => void;
    activeTab: string;
}

export const EnquiryCard = React.memo(({
    query: q,
    isExpanded,
    showPhone,
    showEmail,
    onToggleExpand,
    onTogglePhone,
    onToggleEmail,
    onEdit,
    onDelete,
    onDrop,
    onRaiseProposal,
    activeTab
}: EnquiryCardProps) => {
    const [proposals, setProposals] = React.useState<any[]>([]);
    const [loadingProposals, setLoadingProposals] = React.useState(false);

    React.useEffect(() => {
        if (isExpanded && (activeTab === 'working' || q.status === 'Working')) {
            const fetchProposals = async () => {
                setLoadingProposals(true);
                try {
                    const res = await fetch(`/api/proposals?queryId=${q.id}`);
                    if (res.ok) {
                        const result = await res.json();
                        setProposals(result.data || []);
                    }
                } catch (error) {
                    console.error('Error fetching proposals for enquiry:', error);
                } finally {
                    setLoadingProposals(false);
                }
            };
            fetchProposals();
        }
    }, [isExpanded, activeTab, q.id, q.status]);

    const firstService = q.workItems && q.workItems.length > 0 ? q.workItems[0].workTypeName : 'No services selected';
    const hasMoreServices = q.workItems && q.workItems.length > 1;

    return (
        <div className="group bg-white border border-slate-200/60 hover:border-primary/30 shadow-sm hover:shadow-xl rounded-2xl overflow-hidden transition-all duration-300">
            {/* Main Row */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-5 cursor-pointer bg-transparent transition-colors" onClick={() => onToggleExpand(q.id)}>
                <div className="shrink-0 text-muted-foreground transition-transform">
                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-6 items-center w-full">
                    {/* Company & Lead */}
                    <div className="md:col-span-4 flex items-center gap-4">
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                            <Building className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-foreground text-sm md:text-base tracking-tight">
                                    {q.companyName || q.contactPerson}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 md:mt-1">
                                <User className="h-3.5 w-3.5 text-muted-foreground/50" />
                                <span className="text-xs font-semibold text-muted-foreground truncate">{q.contactPerson}</span>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="md:col-span-3 flex items-center">
                        <div className={cn(
                            "inline-flex items-center font-bold text-[10px] sm:text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm w-fit",
                            q.status === 'Open' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                            q.status === 'Working' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                            q.status === 'Dropped' ? "bg-rose-50 text-rose-600 border border-rose-100" :
                            "bg-green-50 text-green-600 border border-green-100"
                        )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full mr-2 shadow-sm",
                                q.status === 'Open' ? "bg-amber-500" :
                                q.status === 'Working' ? "bg-blue-500" : 
                                q.status === 'Dropped' ? "bg-rose-500" : 
                                "bg-green-500")}
                            />
                            {q.status}
                        </div>
                    </div>

                    {/* One Service */}
                    <div className="md:col-span-5 flex items-center gap-2 truncate">
                        {q.workItems && q.workItems.length > 0 ? (
                            <>
                                <Badge variant="outline" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-slate-50 text-slate-700 px-3 py-1.5 border-slate-200 truncate rounded-lg">
                                    {firstService}
                                </Badge>
                                {hasMoreServices && (
                                    <span className="text-[10px] font-black text-white bg-slate-800 rounded-md px-2 py-1 shadow-sm shrink-0">+{q.workItems.length - 1}</span>
                                )}
                            </>
                        ) : (
                            <span className="text-xs text-muted-foreground italic font-medium">—</span>
                        )}
                    </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 mt-4 md:mt-0 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="h-9 px-3 text-slate-600 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 rounded-lg shadow-sm bg-white font-bold text-[10px] uppercase tracking-wider" onClick={() => onDrop(q)} title="Drop Enquiry">
                        Drop
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg shadow-sm bg-white" onClick={() => onEdit(q)} title="Edit">
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 text-white bg-red-500 hover:bg-red-600 border-0 rounded-lg shadow-sm transition-all" onClick={() => onDelete(q)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Expandable Section */}
            <div className={cn(
                "grid transition-all duration-300 ease-in-out",
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    <div className="p-5 md:p-6 bg-transparent border-t border-blue-100/50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 relative">

                        {/* Decorative subtle gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 to-transparent pointer-events-none" />

                        {/* Contact Privacy Block */}
                        <div className="space-y-4 relative z-10">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Shield className="h-3.5 w-3.5 text-slate-400" /> Secure Contact Details
                            </h5>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-50 rounded-lg shrink-0"><Phone className="h-4 w-4 text-slate-400" /></div>
                                        <span className={cn("text-xs md:text-sm tracking-tight", showPhone ? "font-bold font-mono text-slate-800" : "text-slate-400 font-medium")}>
                                            {showPhone ? `${q.contactCountryCode || '+91'} ${q.contactNumber || 'No phone provided'}` : '••••••••••'}
                                        </span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg shrink-0 ml-2" onClick={(e) => onTogglePhone(q.id, e)}>
                                        {showPhone ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                        <div className="p-2 bg-slate-50 rounded-lg shrink-0"><Mail className="h-4 w-4 text-slate-400" /></div>
                                        <span className={cn("text-xs md:text-sm tracking-tight truncate", showEmail ? "font-bold text-slate-800" : "text-slate-400 font-medium")}>
                                            {showEmail ? (q.emailId || 'No email provided') : '••••••@••••.com'}
                                        </span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg shrink-0" onClick={(e) => onToggleEmail(q.id, e)}>
                                        {showEmail ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Services List Block */}
                        <div className="space-y-4 lg:col-span-1 lg:border-l lg:border-slate-200/60 lg:pl-8 relative z-10">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service Scope Details</h5>
                            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2.5 max-h-[160px] overflow-y-auto no-scrollbar">
                                {q.workItems && q.workItems.length > 0 ? (
                                    q.workItems.map((wi, i) => (
                                        <div key={i} className="flex flex-col gap-1 w-full bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-tight leading-snug">{wi.workTypeName}</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{wi.departmentName} &gt; {wi.categoryName}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs font-medium text-slate-400 italic text-center py-4">No specific services added.</p>
                                )}
                            </div>
                        </div>

                        {/* Action Block */}
                        <div className={cn(
                            "flex flex-col items-start justify-center p-6 bg-gradient-to-br from-indigo-50 to-blue-50/30 rounded-2xl border border-indigo-100/60 shadow-sm relative z-10 w-full h-full transition-all",
                            (q.status !== 'Open' && q.status !== 'Working') && "opacity-60 grayscale-[0.3]"
                        )}>
                            {activeTab === 'working' ? (
                                <div className="w-full space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-indigo-100/50 rounded-lg">
                                            <FileText className="h-4 w-4 text-indigo-600" />
                                        </div>
                                        <h4 className="font-black text-indigo-900 text-xs md:text-sm uppercase tracking-wide">
                                            Linked Proposals
                                        </h4>
                                    </div>
                                    
                                    <div className="space-y-2 max-h-[120px] overflow-y-auto no-scrollbar pr-1">
                                        {loadingProposals ? (
                                            <div className="flex items-center justify-center py-4">
                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                            </div>
                                        ) : proposals.length > 0 ? (
                                            proposals.map((p) => (
                                                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-indigo-100 bg-white/80 shadow-sm group/prop transition-all hover:border-indigo-300">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate">
                                                            ID: {p.id.slice(-6).toUpperCase()}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-indigo-600/70 uppercase">
                                                            {p.currentStage || p.status || 'Draft'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="outline" className="text-[8px] font-black bg-indigo-50 text-indigo-700 border-indigo-100 py-0 px-1.5 h-5">
                                                            ₹{Math.round(p.totalAmount).toLocaleString()}
                                                        </Badge>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 rounded-md hover:bg-indigo-100 hover:text-indigo-700"
                                                            asChild
                                                        >
                                                            <a href={`/dashboard/work/proposals?id=${p.id}`} target="_blank" rel="noopener noreferrer">
                                                                <ChevronRight className="h-3 w-3" />
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-4">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase italic">No proposals found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-indigo-100/50 rounded-lg">
                                            {(q.status === 'Open' || q.status === 'Working') ? <FileText className="h-4 w-4 text-indigo-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                        </div>
                                        <h4 className="font-black text-indigo-900 text-xs md:text-sm uppercase tracking-wide">
                                            {(q.status === 'Open' || q.status === 'Working') ? 'Create Proposal' : 'Proposal Generated'}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-indigo-800/60 font-medium mb-6 leading-relaxed max-w-[250px]">
                                        {(q.status === 'Open' || q.status === 'Working') 
                                            ? 'Ready to formalize this enquiry? Generate and dispatch a detailed proposal instantly.' 
                                            : 'This enquiry has been moved to the proposal pipeline and is currently being processed.'}
                                    </p>
                                    <Button 
                                        onClick={() => (q.status === 'Open' || q.status === 'Working') && onRaiseProposal(q)} 
                                        disabled={q.status !== 'Open' && q.status !== 'Working'}
                                        className={cn(
                                            "w-full h-11 md:h-12 font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-lg transition-all rounded-xl flex items-center justify-center mt-auto",
                                            (q.status === 'Open' || q.status === 'Working') 
                                                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-indigo-300 active:scale-[0.98]" 
                                                : "bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-none cursor-not-allowed"
                                        )}
                                    >
                                        {(q.status === 'Open' || q.status === 'Working') ? 'Create Proposal' : 'Proposal Handled'}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

EnquiryCard.displayName = 'EnquiryCard';

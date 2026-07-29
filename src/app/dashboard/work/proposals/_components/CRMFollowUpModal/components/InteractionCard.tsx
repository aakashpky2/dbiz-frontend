'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Phone, Mail, Users, MessageSquare, Clock, User, ArrowRight, CheckCircle2, TrendingUp, History, Info, RefreshCw, CalendarDays, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InteractionCardProps {
    interaction: any;
}

export const InteractionCard: React.FC<InteractionCardProps> = ({ interaction }) => {
    const formatLabel = (str: string) => {
        if (!str) return 'N/A';
        return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const getIcon = () => {
        if (interaction.type === 'revision') return <RefreshCw className="h-4 w-4" />;
        if (interaction.type === 'history') return <Info className="h-4 w-4" />;
        
        const method = (interaction.interactionType || interaction.metadata?.interactionType || '').toLowerCase();
        if (method.includes('call')) return <Phone className="h-4 w-4" />;
        if (method.includes('email')) return <Mail className="h-4 w-4" />;
        if (method.includes('meeting') || method.includes('visit')) return <Users className="h-4 w-4" />;
        if (method.includes('whatsapp')) return <MessageSquare className="h-4 w-4" />;
        return <MessageSquare className="h-4 w-4" />;
    };

    const getOutcomeColor = () => {
        if (interaction.type === 'revision') return "bg-rose-500";
        if (interaction.type === 'history') return "bg-slate-400";
        
        if (!interaction.followUpOutcome) return "bg-gray-400";
        if (interaction.followUpOutcome.includes('accepted') || interaction.followUpOutcome.includes('positive')) return "bg-emerald-500";
        if (interaction.followUpOutcome.includes('rejected') || interaction.followUpOutcome.includes('negative')) return "bg-red-500";
        if (interaction.followUpOutcome.includes('revision')) return "bg-orange-500";
        return "bg-blue-500";
    };

    const getBgOutcomeColor = () => {
        if (interaction.type === 'revision') return "bg-rose-50 text-rose-700 border-rose-100";
        if (interaction.type === 'history') return "bg-slate-50 text-slate-700 border-slate-100";
        
        if (!interaction.followUpOutcome) return "bg-slate-50 text-slate-700";
        if (interaction.followUpOutcome.includes('accepted')) return "bg-emerald-50 text-emerald-700 border-emerald-100";
        if (interaction.followUpOutcome.includes('rejected')) return "bg-red-50 text-red-700 border-red-100";
        if (interaction.followUpOutcome.includes('revision')) return "bg-orange-50 text-orange-700 border-orange-100";
        return "bg-blue-50 text-blue-700 border-blue-100";
    };

    return (
        <div className="relative pl-10 group">
            {/* Timeline Dot */}
            <div className={cn(
                "absolute left-0 top-1 h-6 w-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center z-10 transition-transform group-hover:scale-110",
                getOutcomeColor()
            )}>
                <div className="text-white">
                    {getIcon()}
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:border-slate-200 transition-all space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {format(new Date(interaction.timestamp || interaction.performed_at || interaction.date || interaction.createdAt || interaction.created_at || interaction.revised_at), 'dd MMM yyyy • hh:mm a')}
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-500 rounded-md px-1.5 h-5">
                                {interaction.type === 'revision' ? `Version ${interaction.new_version || interaction.newVersion}` : formatLabel(interaction.currentStage || interaction.new_stage)}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                {interaction.type === 'revision' ? <TrendingUp className="h-4 w-4 text-rose-500" /> : <User className="h-4 w-4" />}
                            </div>
                            <div>
                                <span className="text-sm font-bold text-slate-900 tracking-tight block leading-none mb-1">
                                    {interaction.type === 'revision' ? 'Proposal Revised' : (interaction.type === 'history' ? (interaction.event_type || 'System Event') : (interaction.contactPerson || interaction.contactedPerson || 'Unknown Contact'))}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
                                    {interaction.type === 'revision' ? `By ${interaction.revised_by || 'Staff'}` : (interaction.type === 'history' ? `By ${interaction.performed_by || 'System'}` : formatLabel(interaction.contactRole || 'External'))}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Badge variant="outline" className={cn("px-3 h-7 font-bold text-[10px] uppercase tracking-wider rounded-md", getBgOutcomeColor())}>
                        {interaction.type === 'revision' ? 'REVISED' : (interaction.type === 'history' ? 'LOGGED' : formatLabel(interaction.followUpOutcome || interaction.responseType || 'Logged'))}
                    </Badge>
                </div>

                <div className="relative pl-6 py-1">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 rounded-full" />
                    <div className="text-sm text-slate-700 leading-relaxed font-medium">
                        {interaction.type === 'revision' 
                            ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Version Change:</span>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none font-bold text-[10px]">
                                            {interaction.previous_version || 'v1.0'} → {interaction.new_version}
                                        </Badge>
                                    </div>
                                    
                                    {interaction.client_requested_changes && (
                                        <div className="bg-rose-50/50 border border-rose-100/50 rounded-xl p-3">
                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-1">Client Requests</span>
                                            <p className="text-sm text-slate-700 font-medium italic">"{interaction.client_requested_changes}"</p>
                                        </div>
                                    )}

                                    {interaction.changed_fields && Array.isArray(interaction.changed_fields) && interaction.changed_fields.length > 0 && (
                                        <div className="pt-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Modified Components</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {interaction.changed_fields.map((f: any, idx: number) => (
                                                    <Badge key={idx} variant="outline" className="bg-white text-slate-600 border-slate-200 text-[9px] font-bold py-0.5">
                                                        {f.field.replace(/_/g, ' ')}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                            : (interaction.type === 'history' 
                                ? (interaction.description || 'System state change.')
                                : (interaction.notesSummary || interaction.remarks || 'No notes provided for this interaction.'))
                        }
                    </div>

                    {/* Metadata Display for History (e.g. Sent action) */}
                    {interaction.type === 'history' && interaction.metadata && (
                        <div className="flex flex-wrap gap-x-6 gap-y-3 mt-3 pt-3 border-t border-slate-50">
                            {interaction.metadata.clientName && (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Client</span>
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Building className="h-3 w-3 text-indigo-500" />
                                        {interaction.metadata.clientName}
                                    </span>
                                </div>
                            )}
                            {interaction.metadata.interactionType && (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mode</span>
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <MessageSquare className="h-3 w-3 text-blue-500" />
                                        {interaction.metadata.interactionType}
                                    </span>
                                </div>
                            )}
                            {interaction.metadata.contactDetail && (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contact Details</span>
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Info className="h-3 w-3 text-emerald-500" />
                                        {interaction.metadata.contactDetail}
                                    </span>
                                </div>
                            )}
                            {interaction.metadata.sentDate && (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</span>
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <CalendarDays className="h-3 w-3 text-blue-500" />
                                        {format(new Date(interaction.metadata.sentDate), 'dd MMM yyyy')}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {interaction.type !== 'history' && interaction.type !== 'revision' && (
                <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                    <div className="flex-1 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> Target Action
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 flex items-center gap-1.5 rounded-md">
                                <CheckCircle2 className="h-3 w-3 text-slate-500" />
                                {formatLabel(interaction.nextAction || interaction.nextActionType || 'None Defined')}
                            </span>
                        </div>
                    </div>
                    {(interaction.nextFollowUpDate) && (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Scheduled</span>
                            <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-xs font-bold">{format(new Date(interaction.nextFollowUpDate), 'MMM dd, yyyy')}</span>
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};

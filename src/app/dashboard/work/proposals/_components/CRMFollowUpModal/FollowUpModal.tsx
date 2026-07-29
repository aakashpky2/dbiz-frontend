'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Form } from '@/components/ui/form';
import { useFollowUpForm, FollowUpFormValues, getLocalYYYYMMDD } from './hooks/useFollowUpForm';
import { TimelineTab } from './tabs/TimelineTab';
import { FollowUpFormTab } from './tabs/FollowUpFormTab';
import { InsightsTab } from './tabs/InsightsTab';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, User, Building, History, LineChart, Save, PlusCircle } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import {
    normalizeStage, resolveNextStage, STAGE_LABELS, getStageBadgeStyle, type ProposalStage,
} from './lib/workflowEngine';
import { supabase } from '@/lib/supabase';

interface FollowUpModalProps {
    proposal: any;
    open: boolean;
    isLoading?: boolean;
    initialTab?: 'add' | 'history' | 'insights';
    onClose: () => void;
    onUpdate: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({ 
    proposal, 
    open, 
    isLoading = false,
    initialTab = 'add',
    onClose, 
    onUpdate 
}) => {
    // We use a local state for tab, but we must sync it when modal opens
    const [activeTab, setActiveTab] = useState<'add' | 'history' | 'insights'>(initialTab);
    const [isSaving, setIsSaving] = useState(false);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [masterCategories, setMasterCategories] = useState<any[]>([]);
    const [masterOptions, setMasterOptions] = useState<any>({
        methods: [],
        outcomes: [],
        contactRoles: [],
        clientRoles: [],
        purposes: [],
        sentiments: []
    });
    const { toast } = useToast();
    const { user } = useAuth();

    const currentStage = normalizeStage(proposal?.currentStage) as ProposalStage;

    // Fetch Master Options
    const fetchMasters = React.useCallback(async () => {
        try {
            const { data: categories } = await supabase
                .from('app_master_categories')
                .select('id, name, description')
                .in('name', [
                    'Proposal / Method', 
                    'Proposal / Interaction Outcome', 
                    'Proposal / Contact Role', 
                    'Proposal / Client Role',
                    'Proposal / Purpose',
                    'Proposal / Client Sentiment'
                ]);

            if (!categories) return;
            setMasterCategories(categories);

            const catIds = categories.map(c => c.id);
            const { data: values } = await supabase
                .from('app_master_values')
                .select('*')
                .in('category_id', catIds)
                .order('order', { ascending: true });

            if (!values) return;

            const options: any = { 
                methods: [], 
                outcomes: [], 
                contactRoles: [], 
                clientRoles: [], 
                purposes: [],
                sentiments: []
            };
            
            categories.forEach(cat => {
                const catValues = values.filter(v => v.category_id === cat.id).map(v => v.name);
                if (cat.name === 'Proposal / Method') options.methods = catValues;
                if (cat.name === 'Proposal / Interaction Outcome') options.outcomes = catValues;
                if (cat.name === 'Proposal / Contact Role') options.contactRoles = catValues;
                if (cat.name === 'Proposal / Client Role') options.clientRoles = catValues;
                if (cat.name === 'Proposal / Purpose') options.purposes = catValues;
                if (cat.name === 'Proposal / Client Sentiment') options.sentiments = catValues;
            });

            setMasterOptions(options);
        } catch (err) {
            // Silent fail
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
    }, []);

    React.useEffect(() => {
        fetchMasters();
    }, [fetchMasters]);

    const form = useFollowUpForm({
        currentStage,
        contactPerson: proposal?.contactPerson || '',
    });

    const fetchHistory = React.useCallback(async () => {
        if (!proposal?.id) return;
        setIsHistoryLoading(true);
        try {
            const res = await fetch(`/api/proposals/${proposal.id}/history`);
            if (res.ok) {
                const result = await res.json();
                const { interactions = [], history = [], revisions = [] } = result.data || {};
                
                // Merge all three sources into one combined array (Requirement 1 & 6)
                const combined = [
                    ...interactions,
                    ...history,
                    ...revisions
                ];
                
                setHistoryData(combined);
            }
        } catch (err) {
            // Silent fail
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsHistoryLoading(false);
        }
    }, [proposal?.id]);

    React.useEffect(() => {
        if (open) {
            setActiveTab(initialTab);
            fetchHistory();
            if (proposal) {
                form.reset({
                    currentStage: (proposal.currentStage || 'drafted') as ProposalStage,
                    interactionDate: getLocalYYYYMMDD(),
                    contactPerson: proposal.contactPerson || '',
                    followUpOutcome: 'No Response',
                    clientSentiment: 'neutral',
                    notesSummary: '',
                    priority: 'medium',
                    competitorMentioned: false,
                    clientRole: '',
                });
            }
        }
    }, [open, initialTab, proposal?.id, fetchHistory]);

    if (!proposal && !isLoading) return null;

    const version = proposal?.version || '1.0';
    const sentDate = proposal?.sentDate ? new Date(proposal.sentDate).toLocaleDateString() : 'Not Sent';
    const lastFollowUp = proposal?.lastFollowUpDate ? new Date(proposal.lastFollowUpDate).toLocaleDateString() : 'None';
    const nextFollowUp = proposal?.nextFollowUpDate ? new Date(proposal.nextFollowUpDate).toLocaleDateString() : 'Not Scheduled';

    const handleSave = async (values: FollowUpFormValues) => {
        setIsSaving(true);
        try {
            const nextStage = resolveNextStage(currentStage, values.followUpOutcome);

            const payload = {
                followUp: {
                    ...values,
                    id: Math.random().toString(36).substring(7),
                    date: values.interactionDate || new Date().toISOString(),
                    createdAt: Date.now(),
                    createdBy: user?.displayName || 'Unknown',
                },
                stage: nextStage || currentStage,
                nextFollowUpDate: values.nextFollowUpDate,
                conversionProbability: values.clientSentiment === 'positive' ? 80 : values.clientSentiment === 'negative' ? 20 : 50
            };

            const res = await fetch(`/api/proposals/${proposal.id}/followups`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Data persistence failed');
            }

            toast({ title: 'Engagement Logged', description: 'Interaction record has been saved.' });
            
            // Re-fetch detail in parent
            onUpdate();
            
            // Re-fetch history
            fetchHistory();
            
            // Switch to history to show the new entry
            setActiveTab('history');
        } catch (error: any) {
            toast({ title: 'Sync Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden border border-gray-100 rounded-2xl shadow-xl bg-white h-[90vh] flex flex-col">

                {/* ── Header ───────────────────────────────────────────────── */}
                <DialogHeader className="px-8 py-5 border-b border-gray-100 flex-shrink-0 bg-slate-50/50">
                    {isLoading ? (
                        <div className="p-6">
                            <PageSkeleton />
                        </div>
                    ) : proposal && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
                                        <Building className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-base font-bold text-slate-900 tracking-tight leading-none mb-1">
                                            {proposal.clientName}
                                        </DialogTitle>
                                        <div className="flex items-center gap-2">
                                            <DialogDescription className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                                ID: {proposal?.id?.slice(0, 8) || 'N/A'}
                                            </DialogDescription>
                                            <span className="text-slate-300">|</span>
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <User className="h-3 w-3" />
                                                <span className="text-[10px] uppercase font-bold tracking-wider">
                                                    {proposal.assignedTo?.name || 'Unassigned'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <Badge className={`h-7 px-3 font-semibold uppercase text-[10px] tracking-widest rounded-md border ${getStageBadgeStyle(currentStage)}`}>
                                    {STAGE_LABELS[currentStage] ?? currentStage}
                                </Badge>
                            </div>

                            {/* Meta info strip */}
                            <div className="grid grid-cols-4 md:grid-cols-5 gap-4 py-3 border-t border-slate-100 mt-2">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Version</span>
                                    <span className="text-[11px] font-semibold text-slate-800">v{version}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Approval</span>
                                    <span className="text-[11px] font-semibold text-slate-800">{proposal.approvalStatus || 'N/A'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sent Date</span>
                                    <span className="text-[11px] font-semibold text-slate-800">{sentDate}</span>
                                </div>
                                <div className="flex flex-col gap-1 hidden md:flex">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Last Follow-up</span>
                                    <span className="text-[11px] font-semibold text-slate-800">{lastFollowUp}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Next Action Due</span>
                                    <span className="text-[11px] font-semibold text-blue-600">{nextFollowUp}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                {/* ── Tabs ─────────────────────────────────────────────────── */}
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col min-h-0">
                    <div className="px-8 border-b border-gray-100 flex-shrink-0">
                        <TabsList className="bg-transparent h-12 p-0 w-full justify-start gap-8 rounded-none border-none">
                            {[
                                { value: 'add', label: 'Follow Up' },
                                { value: 'history', label: 'History' },
                                { value: 'insights', label: 'Insights' },
                            ].map(tab => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-900 text-xs font-bold uppercase tracking-widest px-0 transition-all"
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-50/30 p-8 pb-24">
                        <div className="max-w-4xl mx-auto w-full space-y-6">
                            
                            {isLoading ? (
                                <div className="p-6">
                                    <PageSkeleton />
                                </div>
                            ) : proposal ? (
                                <>
                                    <TabsContent value="add" className="m-0 focus-visible:ring-0">
                                        <Form {...form}>
                                            <form id="follow-up-form" onSubmit={form.handleSubmit(handleSave)}>
                                                 <FollowUpFormTab 
                                                     proposal={proposal} 
                                                     form={form} 
                                                     masterOptions={masterOptions}
                                                     masterCategories={masterCategories}
                                                     onRefreshMasters={fetchMasters}
                                                 />
                                             </form>
                                        </Form>
                                    </TabsContent>

                                    <TabsContent value="history" className="m-0 focus-visible:ring-0">
                                        <TimelineTab history={historyData} isLoading={isHistoryLoading} />
                                    </TabsContent>

                                    <TabsContent value="insights" className="m-0 focus-visible:ring-0">
                                        <InsightsTab proposal={proposal} />
                                    </TabsContent>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                                    <History className="h-12 w-12 text-slate-200 mb-4" />
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Proposal Context</p>
                                </div>
                            )}

                        </div>
                    </div>
                </Tabs>

                {/* ── Sticky Footer ─────────────────────────────────────────── */}
                {!isLoading && proposal && (
                    <div className="shrink-0 bg-white border-t border-gray-100 p-6 flex items-center justify-between">
                        <Button variant="outline" onClick={onClose} className="rounded-md font-medium text-gray-600 px-6 border-gray-200">
                            Cancel
                        </Button>

                        {activeTab === 'add' ? (
                            <Button
                                form="follow-up-form"
                                type="submit"
                                disabled={isSaving}
                                className="bg-blue-700 hover:bg-black/90 text-white rounded-md font-medium text-sm h-10 px-8 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save
                            </Button>
                        ) : (
                            <Button
                                onClick={() => setActiveTab('add')}
                                className="bg-black hover:bg-black/90 text-white rounded-md font-medium text-sm h-10 px-8 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <PlusCircle className="h-4 w-4" />
                                Log Interaction
                            </Button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};



'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ProposalList } from './_components/ProposalList';
import { 
    Clock, 
    Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useProfiles } from '@/hooks/use-profiles';
import dynamic from 'next/dynamic';

const ProposalDialog = dynamic(
    () => import('@/components/dashboard/proposals/ProposalDialog').then((mod) => mod.ProposalDialog),
    { ssr: false }
);

const AddMoreWorkDialog = dynamic(
    () => import('@/components/dashboard/proposals/AddMoreWorkDialog').then((mod) => mod.AddMoreWorkDialog),
    { ssr: false }
);

const FollowUpModal = dynamic(
    () => import('./_components/CRMFollowUpModal/FollowUpModal').then((mod) => mod.FollowUpModal),
    { ssr: false }
);

const AddWorkDialog = dynamic(
    () => import('@/components/dashboard/work/add-work-dialog').then((mod) => mod.AddWorkDialog),
    { ssr: false }
);
import { useProposals, useProposal } from '@/hooks/use-proposals';
import { sanitizeErrorMessage } from '@/lib/error-utils';
import { useQueries } from '@/hooks/use-queries';
import { useDebounce } from '@/hooks/use-debounce';
import { isPendingProposal, isSentToClientStage } from './_components/CRMFollowUpModal/lib/workflowEngine';
import { useQueryClient } from '@tanstack/react-query';
import { globalCache } from '@/lib/cache-utils';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';



interface Proposal {
    id: string;
    clientName: string;
    proposedWork: any[];
    totalAmount: number;
    status: string;
    date: string;
    currentStage: string;
    proposalStages: any[];
    assignedTo?: { id: string, name: string };
    followUps: any[];
    nextFollowUpDate?: string;
    tempClientId?: string;
    convertedToWork: boolean;
    queryDescription?: string;
    clientType: string;
    profileId?: string;
    clientId?: string;
    queryId?: string;
    professionalFee?: number;
    governmentFee?: number;
    gstPercentage?: number;
    gstTarget?: string;
    gstAmount?: number;
    conversionProbability?: number;
    processingDays?: number;
    convertedAt?: string;
    conversionStatus?: string;
}

// Form schemas moved to ProposalDialog

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ProposalsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogResetKey, setDialogResetKey] = useState(0);
    const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
    const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [activeTab, setActiveTab] = useState<'pending' | 'generated'>('pending');

    const [linkedQueryId, setLinkedQueryId] = useState<string | null>(null);
    const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [queryToDelete, setQueryToDelete] = useState<any | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [proposalDialogMode, setProposalDialogMode] = useState<'create-pending' | 'generate-from-pending' | 'edit-generated' | 'revise-client' | 'view'>('create-pending');
    const [isAddMoreWorkOpen, setIsAddMoreWorkOpen] = useState(false);
    const [proposalForAddWork, setProposalForAddWork] = useState<any | null>(null);
    const [isAddWorkDialogOpen, setIsAddWorkDialogOpen] = useState(false);
    const [proposalToConvertId, setProposalToConvertId] = useState<string | undefined>(undefined);

    const { profiles, loading: profilesLoading } = useProfiles();
    const queryClient = useQueryClient();

    const { hasPermission, loading: permLoading } = usePermissions();
    const canViewProposals = hasPermission('VIEW_PROPOSALS');
    const canManageProposals = hasPermission('MANAGE_PROPOSALS');
    const router = useRouter();

    useEffect(() => {
        if (!permLoading && !canViewProposals) {
            toast({ title: "Access Denied", description: "You do not have permission to view proposals.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canViewProposals, router, toast]);

    // Optimized Main Hook
    const { 
        data: proposalsResponse, 
        isLoading: proposalsLoading, 
        refetch: refreshProposals 
    } = useProposals({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        tab: activeTab,
    });

    // Helper: refresh list + expanded proposal after any mutation
    const refreshAfterMutation = React.useCallback(async (updatedId?: string) => {
        // Invalidate and refetch the proposal list
        await queryClient.invalidateQueries({ queryKey: ['proposals'] });
        // If an expanded proposal was updated, invalidate and refetch it too
        if (updatedId) {
            await queryClient.invalidateQueries({ queryKey: ['proposal', updatedId] });
            try {
                const res = await fetch(`/api/proposals/${updatedId}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.success && result.data) {
                        setSelectedProposal({
                            ...result.data,
                            date: result.data.createdAt ? format(new Date(result.data.createdAt), 'dd MMM yyyy') : 'N/A'
                        });
                    }
                }
            } catch (_) {
            /* silent – list still refreshed */
            toast({
                title: "Error",
                description: _ instanceof Error ? _.message : "Operation failed",
                variant: "destructive"
            });
        
        }
        }
    }, [queryClient]);

    // --- CRM Modal State ---
    const [isCRMOpen, setIsCRMOpen] = useState(false);
    const [initialCRMTab, setInitialCRMTab] = useState<'add' | 'history'>('add');
    const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);

    const allProposals = useMemo(() => {
        const rawData = proposalsResponse?.data || [];
        return rawData.map((p: any) => ({
            ...p,
            date: p.createdAt ? format(new Date(p.createdAt), 'dd MMM yyyy') : 'N/A',
            works: p.proposedWork?.map((w: any) => w.workTypeName).join(', ') || 'No services'
        }));
    }, [proposalsResponse]);

    const totalPages = proposalsResponse?.pagination?.totalPages || 1;
    const totalItems = proposalsResponse?.pagination?.total || 0;

    // Optimized Queries Hook (for Create Proposal dropdown)
    const { data: queriesResponse } = useQueries({ limit: 100, fields: 'id,company_name,contact_person' });
    const queries = queriesResponse?.data || [];


    const searchParams = useSearchParams();
    const queryIdFromUrl = searchParams.get('queryId');



    // Local helpers for summary counts
    const todayFollowUps = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        return allProposals.filter((p: any) => p.nextFollowUpDate === todayStr && !p.convertedToWork);
    }, [allProposals]);

    useEffect(() => {
        const fetchEmployees = async () => {
            const cached = globalCache.get<{ id: string; name: string }[]>('employees_short');
            if (cached) {
                setEmployees(cached);
                return;
            }
            const res = await fetch('/api/employees?limit=200&fields=id,full_name');
            if (res.ok) {
                const result = await res.json();
                if (result.success && Array.isArray(result.data)) {
                    const mapped = result.data.map((e: any) => ({ id: e.id, name: e.full_name }));
                    globalCache.set('employees_short', mapped);
                    setEmployees(mapped);
                }
            }
        };
        fetchEmployees();
    }, []);

    // Removed redundant client selection check from page level (handled in dialog)

    useEffect(() => {
        if (queryIdFromUrl && queries.length > 0) {
            const q = queries.find((cur: any) => cur.id === queryIdFromUrl);
            if (q) {
                setLinkedQueryId(q.id);
                setIsDialogOpen(true);
            }
        }
    }, [queryIdFromUrl, queries]);

    const fetchProposals = refreshProposals;

    const handleWorkflowAction = async (id: string, action: string, payload: any = {}) => {
        try {
            setIsSubmitting(true);
            const res = await fetch(`/api/proposals/${id}/workflow`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action, 
                    payload,
                    performer: { id: user?.uid, name: user?.displayName || user?.email || 'User' }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `${action} failed`);
            }
            
            toast({ 
                title: 'Success', 
                description: `Proposal successfully updated via ${action}.`,
                className: "bg-indigo-600 text-white border-none shadow-lg"
            });
            // Refresh list AND the expanded card immediately
            await refreshAfterMutation(id);
        } catch (e: any) {
            toast({ title: 'Workflow Error', description: sanitizeErrorMessage(e, "Failed to update workflow."), variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApproveProposal = (id: string) => handleWorkflowAction(id, 'approve');
    const handleRejectProposal = (id: string) => handleWorkflowAction(id, 'reject');
    const handleSendProposal = (id: string, payload: any) => handleWorkflowAction(id, 'send', payload);
    const handleAcceptProposal = (id: string) => handleWorkflowAction(id, 'accept');

    const handleConvertProposal = (proposal: Proposal) => {
        setProposalToConvertId(proposal.id);
        setDialogResetKey(k => k + 1); setIsAddWorkDialogOpen(true);
    };

    const handleAddMoreWork = (p: Proposal) => {
        setProposalForAddWork(p);
        setIsAddMoreWorkOpen(true);
    };

    const openNewProposalDialog = () => {
        if (!canManageProposals) {
            toast({ title: 'Access Denied', description: 'You do not have permission to create proposals.', variant: 'destructive' });
            return;
        }
        setSelectedProposal(null);
        setEditingProposalId(null);
        setLinkedQueryId(null);
        setProposalDialogMode('create-pending');
        setIsDialogOpen(true);
    };

    const handleEditProposal = async (p: Proposal) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/proposals/${p.id}`);
            if (res.ok) {
                const result = await res.json();
                if (result.success && result.data) {
                    setSelectedProposal(result.data);
                    setEditingProposalId(p.id);
                    
                    // Determine mode
                    const isPending = isPendingProposal(result.data);
                    const isSent = isSentToClientStage(result.data);
                    
                    if (isPending) {
                        // "Edit" icon on Pending should allow normal full edit
                        setProposalDialogMode('edit-generated'); 
                    } else if (isSent) {
                        setProposalDialogMode('revise-client');
                    } else {
                        setProposalDialogMode('edit-generated');
                    }
                    
                    setIsDialogOpen(true);
                } else {
                    toast({ title: 'Error', description: result.error || 'Failed to fetch proposal details', variant: 'destructive' });
                }
            } else {
                toast({ title: 'Error', description: 'Could not connect to the server', variant: 'destructive' });
            }
        } catch (err) {
            
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewProposal = async (p: Proposal) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/proposals/${p.id}`);
            if (res.ok) {
                const result = await res.json();
                if (result.success && result.data) {
                    setSelectedProposal(result.data);
                    setEditingProposalId(p.id);
                    setProposalDialogMode('view');
                    setIsDialogOpen(true);
                } else {
                    toast({ title: 'Error', description: result.error || 'Failed to fetch proposal details', variant: 'destructive' });
                }
            } else {
                toast({ title: 'Error', description: 'Could not connect to the server', variant: 'destructive' });
            }
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateProposal = async (p: Proposal) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/proposals/${p.id}`);
            if (res.ok) {
                const result = await res.json();
                if (result.success && result.data) {
                    setSelectedProposal(result.data);
                    setEditingProposalId(p.id);
                    setProposalDialogMode('generate-from-pending');
                    setDialogResetKey(k => k + 1);
                    setIsDialogOpen(true);
                }
            }
        } catch (err) {
            
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsSubmitting(false);
        }
    };



    const handleOpenFollowUp = async (input: any, tab: 'add' | 'history' = 'add') => {
        // Support both ID string or Proposal object
        const proposalId = typeof input === 'string' ? input : input?.id;
        
        if (!proposalId) {
            toast({ title: 'Application Error', description: 'Missing proposal reference for CRM view.', variant: 'destructive' });
            return;
        }

        setInitialCRMTab(tab);
        setIsCRMOpen(true);
        setIsLoadingFollowUp(true);
        setSelectedProposal(null); // Clear to show loading skeleton

        try {
            const res = await fetch(`/api/proposals/${proposalId}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Data hydration failed');
            }
            const result = await res.json();
            
            if (result.success && result.data) {
                const hydrated = result.data;
                // Normalize and set selected proposal
                setSelectedProposal({
                    ...hydrated,
                    date: hydrated.createdAt ? format(new Date(hydrated.createdAt), 'dd MMM yyyy') : 'N/A'
                });
            }
        } finally {
            setIsLoadingFollowUp(false);
        }
    };

    if (permLoading || !canViewProposals) return <div className="p-6 flex flex-col gap-4"><Skeleton className="h-24 w-full rounded-xl" /></div>;

    return (
        <>
            {/* ── Flexible layout ── */}
            <div className="flex flex-col gap-6 pb-20">

                {/* Top bar */}
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Proposals</h1>
                        <p className="text-sm text-slate-500">Formalise inquiries into trackable proposals.</p>
                    </div>
                    <div className="flex items-center gap-3">
                         {canManageProposals && (
                             <Button onClick={openNewProposalDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md transition-all active:scale-95 group">
                <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" /> Create New Proposal
              </Button>
                         )}
                        {/* <Button type="button" size="sm"  className="bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95 px-5">
                            <PlusCircle className="mr-2 h-4 w-4" /> New Proposal
                        </Button> */}
                    </div>
                </div>

                {/* Requirement 4: Today's Follow-ups Dashboard */}
                {todayFollowUps.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/30 mb-8 border-dashed shadow-sm">
                        <CardHeader className="py-3">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-600" />
                                <CardTitle className="text-xs font-black uppercase text-amber-900 tracking-widest">Today's Active Follow-ups</CardTitle>
                                <Badge className="bg-amber-600 text-white border-0 ml-auto h-5 px-1.5 min-w-[20px] text-[10px]">{todayFollowUps.length}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {todayFollowUps.map((p: any) => (
                                    <div key={p.id} className="bg-white p-3 rounded-xl border border-amber-100 flex flex-col gap-2 shadow-sm hover:border-amber-300 transition-colors cursor-pointer" onClick={() => handleOpenFollowUp(p, 'add')}>
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-xs text-slate-900 truncate">{p.clientName}</span>
                                            <Badge variant="outline" className="text-[8px] bg-indigo-50 border-indigo-100 text-indigo-600 h-4">{p.assignedTo?.name || 'Unassigned'}</Badge>
                                        </div>
                                        <div className="text-[10px] font-medium text-slate-500 line-clamp-1 italic">
                                            {p.followUps?.length > 0 
                                                ? (p.followUps[p.followUps.length - 1].notesSummary || p.followUps[p.followUps.length - 1].remarks || 'Activity logged.') 
                                                : 'No interactions yet.'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Main Content Area */}
                <div>
                    <Card className="border-none shadow-xl bg-white/70 backdrop-blur-md overflow-hidden">
                        <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-6 py-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className=" w-1.5 bg-primary rounded-full" />
                                <CardTitle className="text-lg font-semibold text-slate-800">Proposal Register</CardTitle>
                            </div>
                            <CardDescription>Formalise your enquiries into trackable proposals to track conversion.</CardDescription>
                        </CardHeader>

                        <CardContent className="p-0">
                            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setCurrentPage(1); }}>
                                <div className="px-6 border-b border-slate-100">
                                    <TabsList className="bg-transparent gap-6 h-12 p-0">
                                        <TabsTrigger 
                                            value="pending" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-bold text-xs uppercase tracking-widest"
                                        >
                                            Pending Proposals
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="generated" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-bold text-xs uppercase tracking-widest"
                                        >
                                            Generated Proposals
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="pending" className="m-0">
                                    {activeTab === 'pending' && (
                                        proposalsLoading ? (
                                            <div className="p-6 flex flex-col gap-4">
                                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                                            </div>
                                    ) : (
                                        <ProposalList 
                                            activeTab={activeTab}
                                            proposals={allProposals}
                                            onEdit={handleEditProposal}
                                            onGenerate={handleGenerateProposal}
                                            onDelete={(id, name) => {
                                                setQueryToDelete({ id, companyName: name } as any);
                                                setIsDeleteConfirmOpen(true);
                                            }}
                                            onFollowUp={(item: any, tab?: 'add' | 'history') => handleOpenFollowUp(item, tab)}
                                            onApprove={handleApproveProposal}
                                            onReject={handleRejectProposal}
                                            onSend={handleSendProposal}
                                            onAccept={handleAcceptProposal}
                                            onConvert={handleConvertProposal}
                                            onAddMoreWork={handleAddMoreWork}
                                            isSubmitting={isSubmitting}
                                            onNewProposal={openNewProposalDialog}
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={setCurrentPage}
                                            emptyMessage={debouncedSearch ? "No results match your search" : "No proposals available yet"}
                                            onView={handleViewProposal}
                                            canManageProposals={canManageProposals}
                                        />
                                    )
                                    )}
                                </TabsContent>

                                <TabsContent value="generated" className="m-0">
                                    {activeTab === 'generated' && (
                                        proposalsLoading ? (
                                            <div className="p-6 flex flex-col gap-4">
                                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                                            </div>
                                    ) : (
                                        <ProposalList 
                                            activeTab={activeTab}
                                            proposals={allProposals}
                                            onEdit={handleEditProposal}
                                            onGenerate={handleGenerateProposal}
                                            onDelete={(id, name) => {
                                                setQueryToDelete({ id, companyName: name } as any);
                                                setIsDeleteConfirmOpen(true);
                                            }}
                                            onFollowUp={(item: any, tab?: 'add' | 'history') => handleOpenFollowUp(item, tab)}
                                            onApprove={handleApproveProposal}
                                            onReject={handleRejectProposal}
                                            onSend={handleSendProposal}
                                            onAccept={handleAcceptProposal}
                                            onConvert={handleConvertProposal}
                                            onAddMoreWork={handleAddMoreWork}
                                            isSubmitting={isSubmitting}
                                            onNewProposal={openNewProposalDialog}
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={setCurrentPage}
                                            emptyMessage={debouncedSearch ? "No results match your search" : "No proposals available yet"}
                                            onView={handleViewProposal}
                                            canManageProposals={canManageProposals}
                                        />
                                    )
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8 max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                            Are you sure you want to remove the proposal for <span className="font-black text-foreground underline underline-offset-4 decoration-destructive/30 uppercase tracking-tighter">{queryToDelete?.companyName}</span>? This record will be permanently purged.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold h-11 px-6 border-muted-foreground/10 hover:bg-muted/10 transition-all ring-0">No</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (!queryToDelete) return;
                                try {
                                    const res = await fetch(`/api/proposals/${queryToDelete.id}`, { method: 'DELETE' });
                                    if (!res.ok) throw new Error('Delete failed');
                                    toast({ title: "Deleted", description: "Proposal record removed successfully." });
                                    // Clear selected if it was the deleted proposal
                                    if (selectedProposal?.id === queryToDelete.id) {
                                        setSelectedProposal(null);
                                    }
                                    await queryClient.invalidateQueries({ queryKey: ['proposals'] });
                                    refreshProposals();
                                } catch (error) {
                                    toast({ title: "Error", description: "Could not delete proposal.", variant: "destructive" });
                                } finally {
                                    setIsDeleteConfirmOpen(false);
                                }
                            }}
                            className="rounded-xl font-black uppercase tracking-widest text-[10px] h-11 px-8 bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-500/20 transition-all active:scale-95"
                        >
                            Delete Record
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <ProposalDialog 
                key={`proposal-dialog-${dialogResetKey}`}
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
                query={linkedQueryId ? (queries.find((q: any) => q.id === linkedQueryId) || { id: linkedQueryId }) : null}
                editingProposal={editingProposalId ? selectedProposal : null}
                mode={proposalDialogMode}
                onSuccess={async (savedId?: string) => {
                    await refreshAfterMutation(savedId || editingProposalId || undefined);
                    if (linkedQueryId) {
                        setLinkedQueryId(null);
                    }
                }}
            />

            <FollowUpModal 
                proposal={selectedProposal} 
                open={isCRMOpen} 
                isLoading={isLoadingFollowUp}
                initialTab={initialCRMTab}
                onClose={() => setIsCRMOpen(false)} 
                onUpdate={async () => {
                    // 1. Refresh the main list in the background
                    refreshProposals();
                    
                    // 2. Fetch the latest version of the specific proposal to update the modal
                    if (!selectedProposal?.id) return;
                    
                    try {
                        const res = await fetch(`/api/proposals/${selectedProposal.id}`);
                        if (res.ok) {
                            const result = await res.json();
                            if (result.success && result.data) {
                                // Update selectedProposal with the new data
                                const updatedData = result.data;
                                setSelectedProposal({
                                    ...updatedData,
                                    date: updatedData.createdAt ? format(new Date(updatedData.createdAt), 'dd MMM yyyy') : 'N/A'
                                });
                            }
                        } else {
                            const err = await res.json();
                            throw new Error(err.error || 'Could not sync');
                         }
                    } catch (err: any) {
                        toast({ title: 'Refresh Error', description: sanitizeErrorMessage(err, "Could not sync latest interaction."), variant: 'destructive' });
                    } finally {
                        // Background refresh done
                    }
                }}
            />

            <AddMoreWorkDialog 
                open={isAddMoreWorkOpen}
                onOpenChange={setIsAddMoreWorkOpen}
                proposal={proposalForAddWork}
                onSuccess={async () => {
                    setIsAddMoreWorkOpen(false);
                    await refreshAfterMutation(proposalForAddWork?.id);
                }}
            />

            <AddWorkDialog 
                open={isAddWorkDialogOpen}
                onClose={() => {
                    setIsAddWorkDialogOpen(false);
                    setProposalToConvertId(undefined);
                }}
                onWorkCreated={async () => {
                    setIsAddWorkDialogOpen(false);
                    await refreshAfterMutation(proposalToConvertId);
                    setProposalToConvertId(undefined);
                }}
                preselectedProposalId={proposalToConvertId}
            />
        </>
    );
}

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import type { WorkEntry } from '@/components/dashboard/work/add-work-dialog';
import dynamic from 'next/dynamic';

const AddWorkDialog = dynamic(
    () => import('@/components/dashboard/work/add-work-dialog').then((mod) => mod.AddWorkDialog),
    { ssr: false }
);
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { format } from 'date-fns';
import { isBefore } from 'date-fns';
import { startOfDay } from 'date-fns';
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { isTabDisabled, getFirstVisibleTab } from '@/lib/ui-visibility';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { PageSkeleton, TableSkeleton } from '@/components/ui/page-skeleton';
import { PageHero } from '@/components/dashboard/page-hero';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    PlusCircle, Briefcase, Search, Loader2,
    Clock, AlarmClock, Calendar, Flag,
    RefreshCw, AlertCircle, Edit, Trash2,
    ChevronDown, ChevronUp, User, Globe, Eye
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkRecord extends Omit<WorkEntry, 'status'> {
    id: string;
    status: string;
    enteredBy: string;
    enteredByName: string;
    enteredDate: string;
    enteredTime: string;
    createdAt: string;
    pendingOrder?: number;
    billingStatus?: { ready: boolean; fully_billed: boolean };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalize = (val: string) => (val || '').trim().toLowerCase();

const isValidDate = (d: any) => {
    if (!d) return false;
    const date = typeof d === 'string' ? parseISO(d) : d;
    return isValid(date);
};

const safeFormat = (d: any, fmt: string) => {
    if (!isValidDate(d)) return '—';
    return format(typeof d === 'string' ? parseISO(d) : d, fmt);
};

const isOverdueByDay = (dueDateStr: string | null) => {
    if (!dueDateStr || !isValidDate(dueDateStr)) return false;
    const dueDate = startOfDay(parseISO(dueDateStr));
    const today = startOfDay(new Date());
    return isBefore(dueDate, today);
};

// ─── Priority Config ──────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
    low: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    high: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
    critical: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-600' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorksPage() {
    const [works, setWorks] = useState<WorkRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [dialogResetKey, setDialogResetKey] = useState(0);
    const [formMode, setFormMode] = useState<'create'|'edit'|'view'>('create');
    const [editingWork, setEditingWork] = useState<WorkRecord | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<WorkRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const { toast } = useToast();
    
    // Filters & Search
    const [search, setSearch] = useState('');
    const [filterOccurrence, setFilterOccurrence] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [activeTab, setActiveTab] = useState('all');
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const router = useRouter();
    const { hasPermission, loading: permLoading } = usePermissions();
    const canViewWork = hasPermission('VIEW_WORK');
    const canManageWork = hasPermission('MANAGE_WORK');

    useEffect(() => {
        if (!permLoading && !canViewWork) {
            toast({ title: "Access Denied", description: "You do not have permission to view work.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canViewWork, router, toast]);

    // ── Fetch works ──
    
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            // 1. Delete tracking
            await supabase.from('work_tracking').delete().eq('work_id', deleteTarget.id);
            
            // 2. Delete work
            const { error } = await supabase.from('works').delete().eq('id', deleteTarget.id);
            if (error) throw error;

            toast({
                title: "Work Deleted",
                description: "The work entry has been removed successfully.",
            });
            fetchWorks();
        } catch (err: any) {
            console.error('Delete failed:', err);
            toast({
                title: "Error",
                description: err.message || "Failed to delete work entry.",
                variant: "destructive"
            });
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const fetchWorks = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const { data, error } = await supabase
                .from('works')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const list: WorkRecord[] = (data || []).map((v: any) => ({
                id: v.id,
                clientId: v.client_id,
                clientName: v.client_name,
                departmentId: v.department_id,
                departmentName: v.department_name,
                categoryId: v.category_id,
                categoryName: v.category_name,
                workTypeId: v.work_type_id,
                workTypeName: v.work_type_name,
                workTypeStatus: v.work_type_status,
                occurrence: v.occurrence,
                financialYear: v.financial_year,
                period: v.period,
                priority: v.priority,
                referenceType: v.reference_type,
                associateId: v.associate_id,
                associateName: v.associate_name,
                associateEffectiveDate: v.associate_effective_date,
                dueDate: v.due_date,
                finishByDate: v.finish_by_date,
                finishByTime: v.finish_by_time,
                durationDays: v.duration_days || v.time_limit || 0,
                durationHours: v.duration_hours || v.time_limit_hours || 0,
                status: v.status,
                enteredBy: v.entered_by,
                enteredByName: v.entered_by_name,
                enteredDate: v.entered_date,
                enteredTime: v.entered_time,
                remarks: v.remarks,
                proposalId: v.proposal_id,
                professionalFee: v.professional_fee,
                governmentFee: v.government_fee,
                gstPercentage: v.gst_percentage,
                gstAmount: v.gst_amount,
                totalAmount: v.total_amount,
                pendingOrder: v.pending_order,
                entryDate: v.entry_date || v.entered_date,
                createdAt: v.created_at,
                billingStatus: v.billing_work_status ? {
                    ready: v.billing_work_status.is_ready_for_billing,
                    fully_billed: v.billing_work_status.is_fully_billed
                } : undefined,
            }));

            setWorks(list);
        } catch (err: any) {
            console.error('Failed to fetch works:', err);
            setFetchError(err.message || 'Unable to connect to the database. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorks();
    }, [fetchWorks]);

    // ── Priority Checker (Unified logic) ──
    const isCriticalOrHigh = useCallback((priority: string) => {
        const p = normalize(priority);
        return p === 'critical' || p === 'high';
    }, []);

    // ── Filtered works ──
    const filteredWorks = useMemo(() => {
        return works.filter(w => {
            const normalizedSearch = normalize(search);
            const matchSearch =
                !normalizedSearch ||
                normalize(w.clientName).includes(normalizedSearch) ||
                normalize(w.workTypeName).includes(normalizedSearch) ||
                normalize(w.categoryName).includes(normalizedSearch) ||
                normalize(w.departmentName).includes(normalizedSearch);

            const matchOcc = filterOccurrence === 'all' || normalize(w.occurrence) === normalize(filterOccurrence);
            const matchPriority = filterPriority === 'all' || normalize(w.priority) === normalize(filterPriority);

            let matchTab = true;
            if (activeTab === 'pending_wt') matchTab = normalize(w.workTypeStatus) === 'pending';
            if (activeTab === 'critical') matchTab = isCriticalOrHigh(w.priority);

            return matchSearch && matchOcc && matchPriority && matchTab;
        });
    }, [works, search, filterOccurrence, filterPriority, activeTab, isCriticalOrHigh]);

    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedData: paginatedWorks,
    } = usePagination(filteredWorks, itemsPerPage);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterOccurrence, filterPriority, activeTab, itemsPerPage, setCurrentPage]);

    const stats = useMemo(() => ({
        total: works.length,
        notStarted: works.filter(w => normalize(w.status) === 'not started').length,
        pendingWT: works.filter(w => normalize(w.workTypeStatus) === 'pending').length,
        critical: works.filter(w => isCriticalOrHigh(w.priority)).length,
    }), [works, isCriticalOrHigh]);

    const visibleTabs = useMemo(() => [
        { value: 'all', count: stats.total, alwaysShow: true, mode: 'disable' as const },
        { value: 'pending_wt', count: stats.pendingWT, mode: 'disable' as const },
        { value: 'critical', count: stats.critical, mode: 'disable' as const },
    ], [stats]);

    useEffect(() => {
        const activeTabObj = visibleTabs.find(t => t.value === activeTab);
        if (activeTabObj && isTabDisabled(activeTabObj.count || 0, activeTabObj.mode)) {
            setActiveTab(getFirstVisibleTab(visibleTabs) || 'all');
        }
    }, [visibleTabs, activeTab]);

    if (permLoading || !canViewWork) return <div className="p-6"><PageSkeleton /></div>;

    return (
        <div className="space-y-6 p-6 pb-24">
            {/* ── Header ── */}
            <PageHero
                pattern="pattern-1"
                icon={Briefcase}
                badge="WORK MANAGEMENT"
                title="Work Register"
                description="Enterprise work management with discovery & validation."
            >
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline" size="icon"
                        onClick={fetchWorks}
                        disabled={loading}
                        title="Refresh"
                        className="shrink-0 transition-all active:rotate-180 duration-500 h-11 w-11 rounded-lg"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                    {canManageWork && (
                        <Button onClick={() => { setDialogResetKey(k => k + 1); setFormMode('create'); setAddOpen(true); }} className="shadow-md shadow-primary/20 gap-2 h-11 px-6 rounded-lg font-bold" size="lg">
                            <PlusCircle className="h-5 w-5" />
                            Add Work
                        </Button>
                    )}
                </div>
            </PageHero>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Works"
                    value={stats.total}
                    icon={Briefcase}
                    color="blue"
                    onClick={() => setActiveTab('all')}
                />
                <StatCard
                    label="Not Started"
                    value={stats.notStarted}
                    icon={Clock}
                    color="slate"
                    onClick={() => setActiveTab('all')}
                />
                <StatCard
                    label="Pending Work Type"
                    value={stats.pendingWT}
                    icon={AlarmClock}
                    color="amber"
                    onClick={() => setActiveTab('pending_wt')}
                    subtitle="Validation required"
                />
                <StatCard
                    label="High Priority"
                    value={stats.critical}
                    icon={Flag}
                    color="red"
                    onClick={() => setActiveTab('critical')}
                    subtitle="Critical & High"
                />
            </div>

            {/* ── Main Table Card ── */}
            <Card className="shadow-sm border-muted">
                <CardHeader className="border-b pb-4 bg-muted/10">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="space-y-1">
                            <CardTitle className="text-lg">Work Entries</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                <Badge variant="secondary" className="px-1.5 h-5 font-bold">{filteredWorks.length}</Badge>
                                record{filteredWorks.length !== 1 ? 's' : ''} filtered
                            </CardDescription>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search client, work type..."
                                    className="pl-9 h-9 w-64 bg-background"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
                                <SelectTrigger className="h-9 w-20 bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[5, 10, 25, 50].map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterOccurrence} onValueChange={setFilterOccurrence}>
                                <SelectTrigger className="h-9 w-36 bg-background">
                                    <SelectValue placeholder="Occurrence" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Occurrences</SelectItem>
                                    <SelectItem value="Monthly">Monthly</SelectItem>
                                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                                    <SelectItem value="Half-yearly">Half-yearly</SelectItem>
                                    <SelectItem value="Yearly">Yearly</SelectItem>
                                    <SelectItem value="Often">Often</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterPriority} onValueChange={setFilterPriority}>
                                <SelectTrigger className="h-9 w-32 bg-background">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priorities</SelectItem>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                        <TabsList className="h-9 bg-muted/50 p-1 gap-0.5">
                            <TabsTrigger value="all" className="px-4 text-xs font-semibold" disabled={isTabDisabled(stats.total, 'disable')}>All Works</TabsTrigger>
                            <TabsTrigger value="pending_wt" className="px-4 text-xs font-semibold gap-2" disabled={isTabDisabled(stats.pendingWT, 'disable')}>
                                Pending Work Type
                                {stats.pendingWT > 0 && (
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                                        {stats.pendingWT}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="critical" className="px-4 text-xs font-semibold gap-2" disabled={isTabDisabled(stats.critical, 'disable')}>
                                High Priority
                                {stats.critical > 0 && (
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                        {stats.critical}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>

                <CardContent className="p-0 min-h-[400px] flex flex-col">
                    {loading ? (
                        <div className="p-6">
                            <TableSkeleton rows={5} columns={6} />
                        </div>
                    ) : fetchError ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="h-16 w-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
                                <AlertCircle className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Database Connection Error</h3>
                            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">{fetchError}</p>
                            <Button onClick={fetchWorks} variant="outline" className="mt-6 gap-2">
                                <RefreshCw className="h-4 w-4" /> Try Reconnecting
                            </Button>
                        </div>
                    ) : filteredWorks.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-70">
                            <Calendar className="h-16 w-16 text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-semibold text-lg">No entries found matching filters</p>
                            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                                Adjust your filters or click refresh to sync with the latest backend records.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {paginatedWorks.map(work => (
                                <WorkRowCard 
                                    key={work.id} 
                                    work={work} 
                                    onEdit={async () => {
                                        const { data, error } = await supabase
                                            .from('works')
                                            .select(`
                                                *,
                                                work_type:work_type_id (
                                                    id,
                                                    name,
                                                    time_limit,
                                                    time_limit_hours,
                                                    duration_days,
                                                    duration_hours,
                                                    due_time_config
                                                )
                                            `)
                                            .eq('id', work.id)
                                            .single();
                                        if (!error && data) {
                                            setFormMode('edit');
                                            setEditingWork(data);
                                        } else {
                                            setFormMode('edit');
                                            setEditingWork(work); // fallback if fetch fails
                                        }
                                    }}
                                    onDelete={() => {
                                        if (!canManageWork) {
                                            toast({ title: "Access Denied", description: "You do not have permission to delete work entries.", variant: "destructive" });
                                            return;
                                        }
                                        setDeleteTarget(work);
                                    }}
                                    onView={async () => {
                                        setDialogResetKey(k => k + 1);
                                        // Fetch latest full details for view mode as well
                                        const { data, error } = await supabase.from('works').select('*').eq('id', work.id).single();
                                        if (!error && data) {
                                            setFormMode('view');
                                            setEditingWork(data);
                                        } else {
                                            setFormMode('view');
                                            setEditingWork(work);
                                        }
                                    }}
                                    canManageWork={canManageWork}
                                />
                            ))}
                        </div>
                    )}
                    
                    <div className="mt-auto p-4 border-t border-muted bg-muted/5">
                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ── Add Work Dialog ── */}
            <AddWorkDialog key={`add-work-${editingWork?.id || 'new'}-${dialogResetKey}`}
                open={addOpen || !!editingWork}
                onClose={() => {
                    setAddOpen(false);
                    setEditingWork(null);
                }}
                onWorkCreated={fetchWorks}
                initialData={editingWork || undefined}
                mode={formMode}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5" /> Delete Work?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="pt-2">
                            This action will permanently remove this work entry and its historical logs. 
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => { e.preventDefault(); handleDelete(); }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={deleting}
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
    blue: 'from-blue-50/50 border-blue-100 text-blue-600 bg-blue-100 ring-blue-500/10',
    slate: 'from-slate-50/50 border-slate-100 text-slate-600 bg-slate-100 ring-slate-500/10',
    amber: 'from-amber-50/50 border-amber-100 text-amber-600 bg-amber-100 ring-amber-500/10',
    red: 'from-red-50/50 border-red-100 text-red-600 bg-red-100 ring-red-500/10',
};

// ─── Work Row Card ────────────────────────────────────────────────────────────
function WorkRowCard({ 
    work, onEdit, onDelete, onView, canManageWork 
}: { 
    work: WorkRecord; 
    onEdit: () => void; 
    onDelete: () => void;
    onView?: () => void;
    canManageWork?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const pb = PRIORITY_BADGE[normalize(work.priority)] || PRIORITY_BADGE.medium;
    const isOverdue = isOverdueByDay(work.dueDate);

    return (
        <div className={cn(
            "group bg-white border rounded-2xl transition-all duration-200 overflow-hidden",
            expanded ? "ring-2 ring-primary/20 shadow-lg border-primary/20" : "hover:border-slate-300 hover:shadow-md"
        )}>
            {/* Header / Collapsed View */}
            <div 
                className="flex items-center p-4 cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Expand Icon */}
                <div className="mr-4">
                    <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                        expanded ? "bg-primary/10 text-primary" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                    )}>
                        {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                </div>

                {/* Client & Service */}
                <div className="flex-1 min-w-0 mr-6">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-slate-900 tracking-tight leading-none truncate max-w-[200px]">
                            {work.clientName || '—'}
                        </span>
                        {normalize(work.workTypeStatus) === 'pending' && (
                            <Badge variant="outline" className="text-[8px] h-4 bg-amber-50 text-amber-600 border-amber-200 font-black uppercase tracking-widest px-1">
                                Pending Approval
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide truncate">
                            {work.workTypeName}
                        </span>
                        <Badge variant="secondary" className={cn(
                            "text-[8px] h-4 font-black uppercase tracking-widest px-1.5 ml-2 border",
                            normalize(work.status) === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            normalize(work.status) === 'in progress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-slate-50 text-slate-600 border-slate-200"
                        )}>
                            {work.status}
                        </Badge>
                        {normalize(work.status) === 'pending' && work.pendingOrder && (
                            <Badge variant="outline" className="text-[9px] h-4 bg-indigo-50 text-indigo-700 border-indigo-200 font-black uppercase tracking-widest px-1.5 ml-1">
                                Order #{work.pendingOrder}
                            </Badge>
                        )}
                        {work.billingStatus && (
                            <Badge variant="outline" className={cn(
                                "text-[9px] h-4 font-black uppercase tracking-widest px-1.5 ml-1 border",
                                work.billingStatus.fully_billed ? "bg-green-50 text-green-700 border-green-200" :
                                work.billingStatus.ready ? "bg-amber-50 text-amber-700 border-amber-200" : 
                                "bg-slate-50 text-slate-500 border-slate-200"
                            )}>
                                {work.billingStatus.fully_billed ? '💰 Billed' : work.billingStatus.ready ? '🟡 Ready to Bill' : '⚪ Not Billable'}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Period */}
                <div className="w-32 hidden md:block">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Period</p>
                    <p className="text-xs font-bold text-slate-700">{work.period || '—'}</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{work.financialYear}</p>
                </div>

                {/* Entered By */}
                <div className="w-44 hidden lg:block text-right mr-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Entered By</p>
                    <p className="text-xs font-bold text-slate-900 truncate">{work.enteredByName || '—'}</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{safeFormat(work.enteredDate, 'dd MMM yyyy')}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {!canManageWork && onView && (
                        <Button 
                            variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                            onClick={onView}
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                    )}
                    {canManageWork && (
                        <>
                            <Button 
                                variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                onClick={onEdit}
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                onClick={onDelete}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t bg-slate-50/50 p-5 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Due Date Details */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date Info</h4>
                            <div className="bg-white p-3 rounded-xl border shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center shadow-inner",
                                        isOverdue ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                                    )}>
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className={cn(
                                            "text-sm font-black tracking-tight",
                                            isOverdue ? "text-red-600" : "text-slate-900"
                                        )}>
                                            {safeFormat(work.dueDate, 'dd MMMM yyyy')}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">ETD: {work.finishByTime || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                                {isOverdue && (
                                    <div className="mt-2 flex items-center gap-2 text-red-600 text-[10px] font-black uppercase italic bg-red-50 p-1.5 rounded-lg border border-red-100">
                                        <AlertCircle className="h-3 w-3" /> Overdue Work Entry
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Priority & Frequency */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority & Frequency</h4>
                            <div className="flex flex-wrap gap-2">
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl border font-black uppercase text-[10px] tracking-widest bg-white shadow-sm",
                                    pb.text, "border-current/10"
                                )}>
                                    <span className={cn("h-2 w-2 rounded-full", pb.dot)} />
                                    {work.priority}
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-widest shadow-sm">
                                    <RefreshCw className="h-3 w-3 opacity-50" />
                                    {work.occurrence}
                                </div>
                            </div>
                        </div>

                        {/* Reference Source */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference Source</h4>
                            <div className="p-3 rounded-xl border bg-white shadow-sm flex items-start gap-3">
                                {normalize(work.referenceType) === 'associate' ? (
                                    <>
                                        <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Associate Case</p>
                                            <p className="text-xs font-bold text-slate-800">{work.associateName || '—'}</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-inner">
                                            <Globe className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Direct Entry</p>
                                            <p className="text-xs font-bold text-slate-800">In-house source</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Metadata & Remarks */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Additional Info</h4>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg w-fit">
                                    <Briefcase className="h-3 w-3" /> {work.departmentName} {work.categoryName ? ` / ${work.categoryName}` : ''}
                                </div>
                                {work.remarks && (
                                    <div className="text-[10px] font-medium text-muted-foreground italic line-clamp-2 px-1">
                                        "{work.remarks}"
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    label, value, icon: Icon, color, onClick, subtitle
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    onClick?: () => void;
    subtitle?: string;
}) {
    const config = COLOR_MAP[color] || COLOR_MAP.slate;
    const [from, border, text, iconBg, ring] = config.split(' ');
    
    return (
        <Card
            className={cn(
                'bg-gradient-to-br', `${from} to-white`, border, 'ring-1', ring,
                'shadow-sm hover:shadow-lg transition-all cursor-pointer group active:scale-[0.98]',
            )}
            onClick={onClick}
        >
            <CardContent className="p-5 flex items-center justify-between overflow-hidden relative">
                {/* Visual Accent */}
                <div className={cn("absolute -right-2 -bottom-2 h-16 w-16 opacity-[0.03] group-hover:opacity-10 transition-opacity", text)}>
                    <Icon className="h-full w-full" />
                </div>

                <div className="relative z-10">
                    <p className={cn('text-[10px] font-black uppercase tracking-widest opacity-80', text)}>{label}</p>
                    <h3 className="text-3xl font-black mt-1 tabular-nums">{value}</h3>
                    {subtitle && <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase italic">{subtitle}</p>}
                </div>
                <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 group-hover:rotate-6', iconBg)}>
                    <Icon className={cn('h-6 w-6', text)} />
                </div>
            </CardContent>
        </Card>
    );
}

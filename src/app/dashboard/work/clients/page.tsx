'use client';

import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UserPlus, Users2, Search, CheckCircle, Edit, Trash2, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useBusinessConstitutions, type BusinessTypeSetup } from '@/hooks/use-profiles';
const ClientForm = dynamic(() => import('@/components/dashboard/work/client-form').then(mod => mod.ClientForm), {
    loading: () => <div className="flex items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
    ssr: false
});
import { type ClientFormValues, type Client, hasBlankFields } from '@/components/dashboard/work/client-form';
import { cn, deepEqual, getChangedFields, flattenFields, groupFieldsBySection } from '@/lib/utils';
import { shouldShowTab, getFirstVisibleTab } from '@/lib/ui-visibility';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { usePagination } from '@/hooks/usePagination';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ClientRow } from './_components/ClientRow';
import { PaginationControls } from '@/components/common/PaginationControls';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useClients, useClient, useClientStats } from '@/hooks/use-clients';
import { useAssociates } from '@/hooks/use-associates';
import { useDebounce } from '@/hooks/use-debounce';
import { sanitizeErrorMessage } from '@/lib/error-utils';
import type { MergeClientPayload } from './_components/MergeClientsDialog';
import { MergeClientsDialog } from './_components/MergeClientsDialog';

import { DataTableSkeleton } from '@/components/ui/data-table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';



interface Associate {
    id: string;
    name: string;
}

const VALID_SOURCE_TYPES = ['manual', 'signatory', 'import'];

export default function ClientsPage() {
    // UI Local State
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit' | 'view'>('add');
    const [formResetKey, setFormResetKey] = useState(0);
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValidationMode, setIsValidationMode] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500); // Optimized: Debounce search
    const [constitutionFilter, setConstitutionFilter] = useState('all');
    const [currentTab, setCurrentTab] = useState('all');

    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [isMergeOpen, setIsMergeOpen] = useState(false);
    const [isMerging, setIsMerging] = useState(false);

    const { toast } = useToast();
    const router = useRouter();
    const { hasPermission, loading: permLoading } = usePermissions();
    const canManageClients = hasPermission('MANAGE_CLIENTS');
    const canViewClients = hasPermission('VIEW_CLIENTS') || canManageClients;
    const canEditClients = hasPermission('EDIT_CLIENTS') || canManageClients;
    const canDeleteClients = hasPermission('DELETE_CLIENTS') || canManageClients;

    useEffect(() => {
        if (!permLoading && !canViewClients) {
            toast({ title: "Access Denied", description: "You do not have permission to view clients.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canViewClients, router, toast]);


    // Fetch clients and associates
    const mapFromDB = (d: any): Client => {
        return {
            id: d.id,
            clientName: d.client_name,
            constitutionId: d.constitution_id,
            reference: d.reference || (d.associate_id ? 'Associate' : 'Direct'),
            sourceType: d.reference || (d.associate_id ? 'Associate' : 'Direct'),
            associateId: d.associate_id,
            remarks: d.remarks,
            fields: d.fields || {},
            roles: d.roles || {},
            signatories: d.signatories || [],
            primarySignatories: d.primary_signatories || {},
            completionStatus: d.completion_status,
            changeStatus: d.change_status,
            createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
            updatedAt: d.updated_at ? new Date(d.updated_at).getTime() : 0,
            originalData: d.original_data,
            contacts: (d.contacts || []).map((c: any, index: number) => ({
                ...c,
                _id: c._id || `${d.id}-contact-${index}`,
                sourceType: VALID_SOURCE_TYPES.includes(c.sourceType) ? c.sourceType : 'manual',
            })),
            profileId: d.profile_id
        };
    };

    const mapToDB = (data: Partial<Client>) => ({
        client_name: data.clientName,
        constitution_id: data.constitutionId || null,
        associate_id: data.associateId || null,
        reference: data.sourceType || data.reference,
        remarks: data.remarks,
        fields: data.fields || {},
        roles: data.roles || {},
        signatories: data.signatories || [],
        primary_signatories: data.primarySignatories || {},
        completion_status: data.completionStatus,
        change_status: data.changeStatus,
        original_data: data.originalData,
        contacts: data.contacts || [],
        profile_id: data.profileId || null,
        updated_at: new Date().toISOString()
    });

    const changeStatus = currentTab === 'pending' ? 'Pending' : currentTab === 'validated' ? 'Validated' : undefined;
    const completionStatus = currentTab === 'incomplete' ? 'Incomplete' : currentTab === 'validated' ? 'Complete' : undefined;

    // Fetch clients with server-side pagination, search, and filtering
    const {
        data: clientsResponse,
        isLoading: isListingLoading,
        refetch: refreshListing
    } = useClients({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        constitutionId: constitutionFilter,
        changeStatus,
        completionStatus
    });
    const { constitutions = [], loading: isConstitutionsLoading } = useBusinessConstitutions();

    const queryClient = useQueryClient();

    const refreshClients = useCallback(async () => {
        console.log('[CLIENTS] refreshing list');
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['clients'] }),
            queryClient.invalidateQueries({ queryKey: ['clientStats'] }),
            queryClient.invalidateQueries({ queryKey: ['client'] })
        ]);
        console.log('[CLIENTS] refreshed');
    }, [queryClient]);

    const { data: statsResponse } = useClientStats();
    const stats = useMemo(() => {
        return {
            total: statsResponse?.total || 0,
            pending: statsResponse?.pending || 0,
            incomplete: statsResponse?.incomplete || 0,
            validated: statsResponse?.validated || 0
        };
    }, [statsResponse]);

    const visibleTabs = useMemo(() => {
        return [
            { value: 'all', count: stats.total, alwaysShow: true, mode: 'hide' as const },
            { value: 'pending', count: stats.pending, mode: 'hide' as const },
            { value: 'incomplete', count: stats.incomplete, mode: 'hide' as const },
            { value: 'validated', count: stats.validated, mode: 'hide' as const },
        ].filter(tab => shouldShowTab(tab.count, tab.mode, tab.alwaysShow));
    }, [stats]);

    useEffect(() => {
        if (!visibleTabs.some(t => t.value === currentTab)) {
            setCurrentTab(getFirstVisibleTab(visibleTabs) || 'all');
        }
    }, [visibleTabs, currentTab]);

    const clientsResponseSafe = (clientsResponse as any) || {
        success: false,
        data: [],
        pagination: { totalPages: 1 }
    };

    // 1. Raw Data Mapping
    const paginatedClients = useMemo(() => {
        const rawData = clientsResponseSafe?.data;
        if (!Array.isArray(rawData)) return [];
        return rawData.map(mapFromDB);
    }, [clientsResponseSafe?.data]);

    const rawClients = paginatedClients; // Backwards compatibility for dialogs/selections within page scope

    const selectedClients = useMemo(
        () => paginatedClients.filter(c => selectedClientIds.includes(c.id)),
        [paginatedClients, selectedClientIds]
    );

    const handleSelect = useCallback((client: Client, checked: boolean) => {
        setSelectedClientIds(prev => {
            if (checked) {
                if (prev.length >= 2) return prev;
                return [...prev, client.id];
            } else {
                return prev.filter(id => id !== client.id);
            }
        });
    }, []);

    // 6. Pagination & Clamping
    const totalPages = clientsResponseSafe?.pagination?.totalPages || 1;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showValidateConfirm, setShowValidateConfirm] = useState(false);
    const [clientToValidate, setClientToValidate] = useState<Client | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    const parentRef = React.useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: paginatedClients.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60, // Estimated row height
        overscan: 5,
    });


    const handleOpenForm = useCallback((client: any | null = null, validationMode = false, mode: 'add' | 'edit' | 'view' = 'add') => {
        if (!canManageClients && client === null && mode === 'add') {
            toast({ title: "Access Denied", description: "You do not have permission to add clients.", variant: "destructive" });
            return;
        }
        setEditingClientId(client?.id || null);
        setIsValidationMode(validationMode);
        setFormMode(mode);
        setIsFormOpen(true);
    }, [canManageClients, toast]);

    const handleCloseForm = useCallback(() => {
        setIsFormOpen(false);
        setEditingClientId(null);
        setIsValidationMode(false);
    }, []);

    const { data: fullClientToEdit, isLoading: isFetchingClient } = useClient(editingClientId);

    const fetchedEditSource = useMemo(() => {
        if (!editingClientId) return null;
        const source = (fullClientToEdit as any)?.data ?? fullClientToEdit ?? null;
        if (!source || !source.id) return null;
        return source;
    }, [fullClientToEdit, editingClientId]);

    const stableInitialClient = useMemo(() => {
        if (!editingClientId || !fetchedEditSource) return null;
        if (String(fetchedEditSource.id) !== String(editingClientId)) return null;
        return mapFromDB(fetchedEditSource);
    }, [editingClientId, fetchedEditSource]);

    const normalizedInitialClient = useMemo(() => {
        if (!stableInitialClient) return null;
        return {
            ...stableInitialClient,
            constitutionId: stableInitialClient.constitutionId ? String(stableInitialClient.constitutionId) : '',
            associateId: stableInitialClient.associateId ? String(stableInitialClient.associateId) : undefined,
        };
    }, [stableInitialClient]);

    const isEditFormReady = useMemo(() => {
        if (!editingClientId) return true;
        if (isFetchingClient || isConstitutionsLoading) return false;
        if (!stableInitialClient) return false;

        // If the client has a constitution, verify it's loaded. 
        // If they don't have one (edge case), we still want the form to open to let them pick one.
        if (stableInitialClient.constitutionId) {
            return (constitutions || []).some(c => String(c.id) === String(stableInitialClient.constitutionId));
        }
        return true;
    }, [editingClientId, isFetchingClient, isConstitutionsLoading, stableInitialClient, constitutions]);

    const changedFieldsForValidation = useMemo(() => {
        if (!isValidationMode || !stableInitialClient) return [];
        if (!fetchedEditSource) return [];
        const original = fetchedEditSource.original_data || fetchedEditSource.originalData || {};
        return getChangedFields(original, fetchedEditSource);
    }, [isValidationMode, stableInitialClient, fetchedEditSource]);

    const { data: associatesData, isLoading: isLoadingAssociates } = useAssociates({ fields: 'id,name' });
    const associates = associatesData?.data || [];

    const handleFormSave = useCallback(async (data: ClientFormValues, constitution: BusinessTypeSetup | null) => {
        setIsSubmitting(true);

        // Trust the contacts already normalized by the form
        const cleanedContacts = Array.isArray(data.contacts) ? data.contacts : [];
        data.contacts = cleanedContacts;

        // 🔥 STEP 10: FIX SAFE FIELD ACCESS
        const sanitizedFields = {
            ...(data.fields || {}),
            country: (data.fields || {}).country || 'India',
            pincode: (data.fields || {}).pincode || (data.fields || {}).pin_code || (data.fields || {}).pinCode || '',
        };

        // 🔥 NEW STATUS LOGIC: Full completeness check
        const isFullyComplete = !hasBlankFields(data, constitution);
        const completionStatus: Client['completionStatus'] = isFullyComplete ? 'Complete' : 'Incomplete';

        // GROUP FIELDS BY SECTION FOR DB COMPATIBILITY
        const groupedFields = groupFieldsBySection(sanitizedFields, constitution);
        data.fields = groupedFields;

        // Block validation if record is not fully complete
        if (isValidationMode && !isFullyComplete) {
            toast({
                title: "Validation Blocked",
                description: "Client cannot be validated until all fields (including optional) are completed.",
                variant: 'destructive'
            });
            setIsSubmitting(false);
            return;
        }

        const isEditing = !!editingClientId;
        const baselineData = stableInitialClient?.originalData || stableInitialClient || {};
        const hasChanged = isEditing ? !deepEqual(baselineData, data) : false;

        let changeStatus: Client['changeStatus'] = 'Pending';
        if (isEditing) {
            // Business Rule: Revert back to Pending if data changed, even if it was Validated before
            changeStatus = hasChanged ? 'Pending' : (stableInitialClient?.changeStatus || 'Pending');
        } else {
            changeStatus = 'Pending';
        }

        const dataToSave: Partial<Client> = {
            ...data,
            remarks: data.remarks || '',
            completionStatus,
            changeStatus,
        };

        try {
            const url = isEditing ? `/api/clients/${editingClientId}` : '/api/clients';
            const method = isEditing ? 'PATCH' : 'POST';
            
            const payload = {
                ...dataToSave,
                isValidationMode
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.details || 'Failed to save client');
            }

            await refreshClients();
            toast({ 
                title: isEditing ? (isValidationMode ? "Client Validated" : "Client Updated") : "Client Added", 
                description: isEditing ? (isValidationMode ? "The client's changes have been approved." : (hasChanged ? "Client details updated. Status reverted to Pending." : "Client details updated.")) : "New client added successfully."
            });
            handleCloseForm();
        } catch (err: any) {
            console.error("Failed to save client:", err);
            toast({ title: "Error", description: sanitizeErrorMessage(err, "Failed to save client."), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }, [stableInitialClient, editingClientId, isValidationMode, toast, refreshClients, handleCloseForm, queryClient]);

    const handleExecuteMerge = useCallback(async (payload: MergeClientPayload) => {
        setIsMerging(true);
        try {
            const response = await fetch('/api/clients/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.details || 'Failed to merge clients');
            }

            await refreshClients();
            toast({ title: "Success", description: "Clients merged successfully." });
            setIsMergeOpen(false);
            setSelectedClientIds([]);
        } catch (error: any) {
            console.error("[Merge Error]:", error);
            toast({ title: "Merge Failed", description: sanitizeErrorMessage(error, "Failed to merge clients."), variant: "destructive" });
        } finally {
            setIsMerging(false);
        }
    }, [toast, refreshClients, queryClient]);

    const handleDeleteClick = useCallback((client: Client) => {
        if (!canManageClients) {
            toast({ title: "Access Denied", description: "You do not have permission to delete clients.", variant: "destructive" });
            return;
        }
        setClientToDelete(client);
        setShowDeleteConfirm(true);
    }, [canManageClients, toast]);

    const executeDelete = useCallback(async () => {
        if (!clientToDelete?.id) return;

        setIsDeleting(true);
        try {
            // Check for linked works
            const { data: linkedWorks, error: worksError } = await supabase
                .from('works')
                .select('id')
                .eq('client_id', clientToDelete.id)
                .limit(1);

            if (worksError) throw worksError;

            if (linkedWorks && linkedWorks.length > 0) {
                toast({
                    title: "Cannot Delete Client",
                    description: "This client cannot be deleted because works are linked to it. Please archive the client or remove/transfer linked works first.",
                    variant: "destructive"
                });
                setShowDeleteConfirm(false);
                setClientToDelete(null);
                return;
            }

            const response = await fetch(`/api/clients/${clientToDelete.id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle foreign key violation or other specific errors from backend
                throw new Error(result.error || result.details || 'Failed to delete client');
            }

            await refreshClients();
            toast({ title: "Success", description: "Client and related records were successfully deleted." });
            setShowDeleteConfirm(false);
            setClientToDelete(null);
        } catch (error: any) {
            console.error("[Delete Client Error]:", error);
            const isFkError = error?.message?.includes('foreign key constraint') || error?.message?.includes('violates foreign key');
            toast({
                title: isFkError ? "Cannot Delete Client" : "Deletion Failed",
                description: isFkError ? "This client cannot be deleted because works or other records are linked to it. Please archive the client or remove/transfer linked records first." : sanitizeErrorMessage(error, "Failed to delete the client."),
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    }, [clientToDelete, toast, refreshClients, queryClient]);

    const handleValidateClick = useCallback((client: Client) => {
        setClientToValidate(client);
        setShowValidateConfirm(true);
    }, []);

    const executeValidate = useCallback(async () => {
        if (!clientToValidate?.id) return;

        // Safety: Prevent validation of incomplete profiles
        if (clientToValidate.completionStatus !== 'Complete') {
            toast({
                title: "Validation Blocked",
                description: "This profile is incomplete. Please click 'Edit' to complete all fields before validating.",
                variant: "destructive"
            });
            setShowValidateConfirm(false);
            return;
        }

        setIsValidating(true);
        try {
            const response = await fetch(`/api/clients/${clientToValidate.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    changeStatus: 'Validated',
                    completionStatus: 'Complete'
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.details || 'Failed to validate client');
            }

            await refreshClients();
            toast({
                title: "Client Validated",
                description: `${clientToValidate.clientName} has been validated successfully.`
            });
            setShowValidateConfirm(false);
            setClientToValidate(null);
        } catch (error: any) {
            console.error("[Validate Client Error]:", error);
            toast({
                title: "Validation Failed",
                description: sanitizeErrorMessage(error, "Failed to validate the client."),
                variant: "destructive"
            });
        } finally {
            setIsValidating(false);
        }
    }, [clientToValidate, toast, refreshClients, constitutions, queryClient]);


    if (permLoading || !canViewClients) return <div className="p-6"><PageSkeleton /></div>;

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Clients"
                description="Manage and monitor your client database, track validation status, and profiles."
            >
                <div className="flex items-center gap-3">
                    {selectedClientIds.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (selectedClientIds.length !== 2) {
                                    toast({ title: "Selection Error", description: "Please select exactly 2 clients to merge.", variant: "destructive" });
                                    return;
                                }
                                setIsMergeOpen(true);
                            }}
                            className="h-10 px-4 border-primary/20 text-primary hover:bg-primary/5 font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Users2 className="h-4 w-4" />
                            Merge Selected ({selectedClientIds.length})
                        </Button>
                    )}
                    
                    {canManageClients && (
                        <Button
                            onClick={() => handleOpenForm()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md transition-all active:scale-95 group"
                        >
                            <UserPlus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
                            Add Client
                        </Button>
                    )}
                </div>
            </DashboardPageHeader>


            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-6">
                <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-600">Total Clients</CardTitle>
                        <Users2 className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-600">Pending Validation</CardTitle>
                        <Clock className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.pending}</div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-600">Incomplete Profiles</CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.incomplete}</div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-600">Validated & Active</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.validated}</div>
                    </CardContent>
                </Card>
            </div>

            <DashboardFilterBar
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                }}
            >
                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search clients..."
                        className="pl-9 h-10 w-full bg-white border-slate-200 shadow-sm focus-visible:ring-1 focus-visible:ring-slate-300 rounded-lg"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                    <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full sm:w-auto">
                        <TabsList className="bg-slate-100/60 p-1 h-10 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto">
                            {visibleTabs.find(t => t.value === 'all') && <TabsTrigger value="all" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">All</TabsTrigger>}
                            {visibleTabs.find(t => t.value === 'pending') && <TabsTrigger value="pending" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Pending</TabsTrigger>}
                            {visibleTabs.find(t => t.value === 'incomplete') && <TabsTrigger value="incomplete" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Incomplete</TabsTrigger>}
                            {visibleTabs.find(t => t.value === 'validated') && <TabsTrigger value="validated" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Validated</TabsTrigger>}
                        </TabsList>
                    </Tabs>

                    <Select value={constitutionFilter} onValueChange={setConstitutionFilter}>
                        <SelectTrigger className="w-full sm:w-[220px] bg-white border-slate-200 shadow-sm h-10 rounded-lg hover:bg-slate-50 transition-colors focus:ring-1 focus:ring-slate-300">
                            <SelectValue placeholder="All Constitutions" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg shadow-md border-slate-200">
                            <SelectItem value="all" className="rounded-md">All Constitutions</SelectItem>
                            {(constitutions || []).map((c: any) => (
                                <SelectItem key={c.id} value={c.id} className="rounded-md">{c.businessType} - {c.businessSubType}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </DashboardFilterBar>

            <div className="w-full mt-6">
                {isListingLoading || isConstitutionsLoading ? (
                    <DataTableSkeleton columnCount={5} rowCount={10} title="Synchronizing client records..." />
                ) : (
                    <div
                        ref={parentRef}
                        className="max-h-[600px] overflow-y-auto no-scrollbar relative"
                    >
                        <Table>
                            <TableHeader className="bg-transparent sticky top-0 z-10 transition-colors">
                                <TableRow className="flex w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm hover:bg-white/95">
                                    <TableHead className="flex-[3] min-w-[250px] flex items-center font-semibold text-slate-500 text-xs uppercase tracking-wider h-11">Client Name</TableHead>
                                    {(currentTab === 'all' || currentTab === 'pending' || currentTab === 'incomplete') && (
                                        <>
                                            <TableHead className="w-[140px] flex items-center justify-center font-semibold text-slate-500 text-xs uppercase tracking-wider h-11">Status</TableHead>
                                            <TableHead className="w-[140px] flex items-center justify-center font-semibold text-slate-500 text-xs uppercase tracking-wider h-11">Completion</TableHead>
                                        </>
                                    )}
                                    <TableHead className="w-[200px] flex items-center font-semibold text-slate-500 text-xs uppercase tracking-wider h-11">Reference</TableHead>
                                    <TableHead className="w-[220px] flex items-center justify-end pr-6 font-semibold text-slate-500 text-xs uppercase tracking-wider h-11">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="relative" style={{ height: `${Math.max(rowVirtualizer.getTotalSize(), 120)}px` }}>
                                {paginatedClients.length > 0 ? (
                                    rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                        const client = paginatedClients[virtualItem.index];
                                        if (!client) return null;

                                        const displayClient = { ...client };

                                        return (
                                            <ClientRow
                                                // 🔥 STEP 13: FIX KEY WARNINGS
                                                key={client.id || `client-${virtualItem.index}`}
                                                client={displayClient}
                                                currentTab={currentTab}
                                                associates={associates}
                                                onValidate={handleValidateClick as any}
                                                onEdit={(c) => handleOpenForm(c, false, 'edit')}
                                                onView={(c) => handleOpenForm(c, false, 'view')}
                                                onDelete={handleDeleteClick as any}
                                                selected={selectedClientIds.includes(client.id)}
                                                onSelect={handleSelect as any}
                                                selectionDisabled={selectedClientIds.length >= 2 && !selectedClientIds.includes(client.id)}
                                                canEdit={canEditClients}
                                                canDelete={canDeleteClients}
                                                canView={canViewClients}
                                                style={{
                                                    top: 0,
                                                    left: 0,
                                                    height: `${virtualItem.size}px`,
                                                    transform: `translateY(${virtualItem.start}px)`,
                                                }}
                                                dataIndex={virtualItem.index}
                                                measureRef={rowVirtualizer.measureElement}
                                            />
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="p-0 border-b-0 h-48">
                                            <EmptyState 
                                                title={stats.total === 0 ? "No Clients Available Yet" : "No Results Match Your Search"} 
                                                description={stats.total === 0 ? "You have not added any clients to the system." : "No clients match your search or exist in the system database."} 
                                                icon={<AlertCircle className="h-10 w-10 text-slate-400" />}
                                                className="border-0 rounded-none bg-transparent"
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>

            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCloseForm(); }}>
                <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
                        <DialogTitle className="text-xl">
                            {isValidationMode 
                                ? "Validate Client" 
                                : formMode === 'view'
                                    ? stableInitialClient?.clientName || 'Client'
                                    : formMode === 'edit'
                                        ? `Editing "${stableInitialClient?.clientName || 'Client'}"`
                                        : 'Adding New Client'}
                        </DialogTitle>
                        <DialogDescription>
                            {isValidationMode ? "Review all fields. Validation is only permitted for fully completed profiles." : (formMode === 'view' ? 'View the details of this item.' : (formMode === 'edit' ? 'Update the details of this item.' : 'Enter the details for Client.'))}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar min-h-[400px]">
                        {editingClientId ? (
                            isEditFormReady ? (
                                <ClientForm
                                    key={`edit-${editingClientId}-${formResetKey}`}
                                    initialData={normalizedInitialClient}
                                    onSave={handleFormSave}
                                    onCancel={handleCloseForm}
                                    isSubmitting={isSubmitting}
                                    constitutions={constitutions}
                                    associates={associates}
                                    isValidationMode={false}
                                    mode={formMode}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center p-20 space-y-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                                    <p className="text-sm font-medium text-slate-500">Preparing registration form...</p>
                                </div>
                            )
                        ) : (
                            <ClientForm
                                key={`create-client-${formResetKey}`}
                                initialData={null}
                                onSave={handleFormSave}
                                onCancel={handleCloseForm}
                                isSubmitting={isSubmitting}
                                constitutions={constitutions}
                                associates={associates}
                                isValidationMode={false}
                                mode="add"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showValidateConfirm} onOpenChange={(open) => !isValidating && setShowValidateConfirm(open)}>
                <AlertDialogContent className="rounded-xl shadow-xl border border-slate-200 max-w-sm sm:max-w-[425px] p-0 overflow-hidden bg-white">
                    <div className="p-6 pt-7 space-y-4">
                        <AlertDialogHeader className="space-y-4 text-left">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-50 rounded-full border border-emerald-100 shadow-sm shrink-0">
                                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                                </div>
                                <AlertDialogTitle className="text-xl font-semibold text-slate-900 tracking-tight">
                                    Validate Client
                                </AlertDialogTitle>
                            </div>
                            <AlertDialogDescription className="text-sm text-slate-500 leading-relaxed font-medium">
                                Are you sure you want to validate <span className="font-bold text-slate-700 underline decoration-slate-300 underline-offset-2">{clientToValidate?.clientName}</span>?
                                <br /><br />
                                This will approve the existing data and move the client to the <strong>Validated</strong> directory. No changes can be made during this action.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>
                    <AlertDialogFooter className="bg-slate-50 p-4 border-t border-slate-100 gap-2 sm:gap-0">
                        <AlertDialogCancel className="h-10 rounded-lg border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 font-medium">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                executeValidate();
                            }}
                            disabled={isValidating}
                            className="h-10 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-sm shadow-emerald-200 px-6 font-semibold transition-all inline-flex items-center justify-center min-w-[100px]"
                        >
                            {isValidating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : "Confirm Validation"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => !isDeleting && setShowDeleteConfirm(open)}>
                <AlertDialogContent className="rounded-xl shadow-xl border border-slate-200 max-w-sm sm:max-w-[425px] p-0 overflow-hidden bg-white">
                    <div className="p-6 pt-7 space-y-4">
                        <AlertDialogHeader className="space-y-4 text-left">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-50 rounded-full border border-red-100 shadow-sm shrink-0">
                                    <Trash2 className="h-5 w-5 text-red-600" />
                                </div>
                                <AlertDialogTitle className="text-xl font-semibold text-slate-900 tracking-tight">
                                    Delete Client
                                </AlertDialogTitle>
                            </div>
                            <AlertDialogDescription className="text-slate-500 text-sm leading-normal">
                                Are you sure you want to delete <strong className="text-slate-900 font-medium">{clientToDelete?.clientName || 'this client'}</strong>? This action cannot be undone and will permanently erase all associated configurations and data.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>

                    <AlertDialogFooter className="bg-slate-50/50 border-t border-slate-100 p-4 sm:px-6 flex justify-end gap-2 sm:gap-2 m-0">
                        <AlertDialogCancel
                            disabled={isDeleting}
                            onClick={() => {
                                setShowDeleteConfirm(false);
                                setClientToDelete(null);
                            }}
                            className="mt-0 h-9 px-4 rounded-lg font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            disabled={isDeleting}
                            onClick={executeDelete}
                            variant="destructive"
                            className="h-9 px-4 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors flex items-center"
                        >
                            {isDeleting ? (
                                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Deleting...</>
                            ) : (
                                "Delete Client"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {selectedClients.length === 2 && (
                <MergeClientsDialog
                    open={isMergeOpen}
                    onOpenChange={setIsMergeOpen}
                    clientA={selectedClients[0]}
                    clientB={selectedClients[1]}
                    onMerge={handleExecuteMerge}
                    isMerging={isMerging}
                />
            )}
        </div>
    );
}



'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Clock, PlusCircle, Edit, ChevronRight, CheckCircle, ListChecks, Info, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { listenToDepartments, type Department } from '@/lib/department-management';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';

// V2 Imports
import { WorkflowEditorTabs } from '@/components/workflow/WorkflowEditorTabs';
import { WorkflowTemplateData } from '@/components/workflow/CommonRulesForm';
import { WorkflowStepData } from '@/components/workflow/StepWiseRulesForm';
import { WorkflowCloneDialog } from '@/components/workflow/WorkflowCloneDialog';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { PageHero } from '@/components/dashboard/page-hero';

interface Client {
    id: string;
    clientName: string;
}

export default function ClientSchedulesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [departments, setDepartments] = useState<Department[]>([]);
    
    // V2 States
    const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
    const [clientTemplates, setClientTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string | null>(null);
    
    // In-memory states for creating a new client override draft
    const [isCreatingDraftOverride, setIsCreatingDraftOverride] = useState(false);
    const [localDraftTemplate, setLocalDraftTemplate] = useState<WorkflowTemplateData | null>(null);
    const [localDraftSteps, setLocalDraftSteps] = useState<WorkflowStepData[]>([]);

    // For Clone Dialog
    const [isCloneOpen, setIsCloneOpen] = useState(false);
    const [cloneTemplate, setCloneTemplate] = useState<any | null>(null);

    // New Add Workflow Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modalStep, setModalStep] = useState<"SELECT" | "EDIT">("SELECT");
    const [modalClientId, setModalClientId] = useState<string>('');
    const [modalDeptId, setModalDeptId] = useState<string | null>(null);
    const [modalCategoryId, setModalCategoryId] = useState<string | null>(null);
    const [modalWorkTypeId, setModalWorkTypeId] = useState<string | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);

    const resetModalState = useCallback(() => {
        setModalClientId(selectedClientId);
        setModalDeptId(null);
        setModalCategoryId(null);
        setModalWorkTypeId(null);
        setModalError(null);
        setModalStep("SELECT");
    }, [selectedClientId]);

    const router = useRouter();
    const { hasPermission, loading: permLoading } = usePermissions();
    const canViewWorkSchedules = hasPermission('VIEW_WORK_SCHEDULES');
    const canManageWorkSchedules = hasPermission('MANAGE_WORK_SCHEDULES');

    useEffect(() => {
        if (!permLoading && !canViewWorkSchedules) {
            toast({ title: "Access Denied", description: "You do not have permission to view work schedules.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canViewWorkSchedules, router, toast]);

    // Fetch initial client listing
    useEffect(() => {
        const fetchClients = async () => {
            if (!user?.uid) return;
            try {
                const res = await fetch('/api/clients', {
                    headers: {
                        'x-user-id': user.uid,
                        'x-user-email': user.email || ''
                    }
                });
                if (res.ok) {
                    const response = await res.json();
                    const list = Array.isArray(response) ? response : (response?.data || []);
                    const sorted = list
                        .map((c: any) => ({ id: c.id, clientName: c.client_name }))
                        .sort((a: any, b: any) => a.clientName.localeCompare(b.clientName));
                    setClients(sorted);
                    if (sorted.length > 0) {
                        setSelectedClientId(sorted[0].id);
                        setModalClientId(sorted[0].id);
                    }
                } else {
                    setError("Failed to fetch clients.");
                }
            } catch (err) {
            console.error(err);
                setError("Failed to fetch clients.");
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
        };

        fetchClients();

        const unsubscribeDepts = listenToDepartments((depts) => {
            setDepartments(depts);
        });

        return () => {
            unsubscribeDepts();
        };
    }, [user?.uid]);

    // Load templates whenever the selected client changes
    const fetchTemplates = async () => {
        if (!selectedClientId || !user?.uid) return;
        try {
            setIsLoading(true);
            setError(null);
            
            const headers = {
                'Content-Type': 'application/json',
                'x-user-id': user.uid,
                'x-user-email': user.email || ''
            };

            // 1. Fetch all Global templates
            const globalRes = await fetch(`/api/workflow-templates?scope=GLOBAL`, { headers });
            const globalResult = await globalRes.json();
            if (!globalRes.ok || !globalResult.success) throw new Error("Failed to fetch global templates");
            setGlobalTemplates(globalResult.data || []);

            // 2. Fetch all templates custom overrides for this Client
            const clientRes = await fetch(`/api/workflow-templates/client/${selectedClientId}`, { headers });
            const clientResult = await clientRes.json();
            if (!clientRes.ok || !clientResult.success) throw new Error("Failed to fetch client templates");

            const workflows = clientResult.data || [];
            console.log("Workflow API raw result:", clientResult);
            console.log("Workflow templates from result.data:", workflows);

            // Temporarily removed filter to display all workflows
            const visibleWorkflows = workflows;
            console.log("Workflow templates after frontend filter:", visibleWorkflows);

            setClientTemplates(visibleWorkflows);

            // Reset current draft creation states on client change
            setIsCreatingDraftOverride(false);
            setLocalDraftTemplate(null);
            setLocalDraftSteps([]);

        } catch (err: any) {
            console.error("Failed to load workflows:", err);
            setError("Failed to load workflows.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [selectedClientId, user?.uid]);

    const allWorkTypes = useMemo(() => {
        const types: { id: string; name: string; deptName: string; categoryName: string }[] = [];
        departments.forEach(dept => {
            dept.workCategories?.forEach(cat => {
                cat.workTypes?.forEach(wt => {
                    types.push({ id: wt.id, name: wt.name, deptName: dept.name, categoryName: cat.name });
                });
            });
        });
        return types;
    }, [departments]);

    // Cascading select selectors logic inside modal
    const modalSelectedDept = useMemo(() => {
        return departments.find(d => d.id === modalDeptId);
    }, [departments, modalDeptId]);

    const modalCategories = useMemo(() => {
        return modalSelectedDept?.workCategories || [];
    }, [modalSelectedDept]);

    const modalSelectedCategory = useMemo(() => {
        return modalCategories.find(c => c.id === modalCategoryId);
    }, [modalCategories, modalCategoryId]);

    const modalWorkTypes = useMemo(() => {
        return modalSelectedCategory?.workTypes || [];
    }, [modalSelectedCategory]);

    const modalSelectedWorkType = useMemo(() => {
        return modalWorkTypes.find(wt => wt.id === modalWorkTypeId);
    }, [modalWorkTypes, modalWorkTypeId]);

    const modalExistingOverride = useMemo(() => {
        if (!modalWorkTypeId || !modalClientId) return null;
        return clientTemplates.find(t => t.work_type_id === modalWorkTypeId && t.client_id === modalClientId);
    }, [clientTemplates, modalWorkTypeId, modalClientId]);

    const modalGlobalTemplate = useMemo(() => {
        if (!modalWorkTypeId) return null;
        return globalTemplates.find(t => t.work_type_id === modalWorkTypeId);
    }, [globalTemplates, modalWorkTypeId]);

    const handleModalClientChange = (clientId: string) => {
        setModalClientId(clientId);
        setModalError(null);
    };

    const handleModalDeptChange = (deptId: string) => {
        setModalDeptId(deptId);
        setModalCategoryId(null);
        setModalWorkTypeId(null);
        setModalError(null);
    };

    const handleModalCategoryChange = (catId: string) => {
        setModalCategoryId(catId);
        setModalWorkTypeId(null);
        setModalError(null);
    };

    const handleModalWorkTypeChange = (wtId: string) => {
        setModalWorkTypeId(wtId);
        setModalError(null);
    };

    const handleSave = async (template: WorkflowTemplateData, steps: WorkflowStepData[]) => {
        if (!selectedClientId) return;
        console.log("Save started");
        try {
            console.log("[Client WorkSchedules] Sending save payload to backend...");
            
            // Client override scope setup
            const clientTemplate = {
                ...template,
                scope: 'CLIENT',
                client_id: selectedClientId
            };

            const response = await fetch('/api/workflow-templates/save', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': user?.uid || '',
                    'x-user-email': user?.email || ''
                },
                body: JSON.stringify({ template: clientTemplate, steps })
            });

            const result = await response.json();
            console.log("Save response", result);
            
            if (!response.ok || !result?.success) {
                console.error("[Client WorkSchedules] Backend save error:", result);
                throw new Error(result?.message || "Failed to save workflow");
            }

            console.log("[Client WorkSchedules] Save successful, template ID:", result.data?.template?.id);
            
            // Clean local states
            setIsCreatingDraftOverride(false);
            setLocalDraftTemplate(null);
            setLocalDraftSteps([]);
            
            return result;
        } catch (error: any) {
            console.error("[Client WorkSchedules] Save failed completely:", error);
            throw new Error(error?.message || error?.details || "An unknown error occurred during save");
        }
    };

    const handleStartConfiguration = () => {
        if (!modalClientId || !modalWorkTypeId) {
            setModalError("Please select a client and work type to continue.");
            return;
        }

        // Check if override already exists
        const override = clientTemplates.find(t => t.work_type_id === modalWorkTypeId && t.client_id === modalClientId);
        if (override) {
            // Edit existing override directly
            setSelectedWorkTypeId(modalWorkTypeId);
            setSelectedClientId(modalClientId);
            setIsCreatingDraftOverride(false);
            setLocalDraftTemplate(null);
            setLocalDraftSteps([]);
            setModalStep("EDIT");
            return;
        }

        // No override exists, check global
        const globalTpl = globalTemplates.find(t => t.work_type_id === modalWorkTypeId);
        
        setSelectedWorkTypeId(modalWorkTypeId);
        setSelectedClientId(modalClientId);

        const overrideTemplate: WorkflowTemplateData = globalTpl ? {
            id: '', 
            workflow_name: `${globalTpl.workflow_name} Override`,
            description: globalTpl.description,
            version: 1,
            scope: 'CLIENT',
            client_id: modalClientId,
            status: 'DRAFT',
            is_active: false,
            work_type_id: modalWorkTypeId,
            inheritance_mode: 'INHERIT',
            common_information_fields: globalTpl.common_information_fields || []
        } : {
            id: '',
            workflow_name: `${modalSelectedWorkType?.name || 'Workflow'} Client Flow`,
            description: '',
            version: 1,
            scope: 'CLIENT',
            client_id: modalClientId,
            status: 'DRAFT',
            is_active: false,
            work_type_id: modalWorkTypeId,
            inheritance_mode: 'INHERIT',
            common_information_fields: []
        };

        const overrideSteps: WorkflowStepData[] = globalTpl?.steps ? globalTpl.steps.map((s: any) => ({
            ...s,
            id: '', 
            workflow_template_id: ''
        })) : [];

        setLocalDraftTemplate(overrideTemplate);
        setLocalDraftSteps(overrideSteps);
        setIsCreatingDraftOverride(true);
        setModalStep("EDIT");
    };

    const handleEditClientWorkflow = (tpl: any) => {
        setSelectedWorkTypeId(tpl.work_type_id);
        setSelectedClientId(tpl.client_id);
        
        // Find corresponding department and category to pre-fill cascading select states
        const wtInfo = allWorkTypes.find(wt => wt.id === tpl.work_type_id);
        if (wtInfo) {
            const dept = departments.find(d => d.name === wtInfo.deptName);
            if (dept) {
                setModalDeptId(dept.id);
                const cat = dept.workCategories?.find(c => c.name === wtInfo.categoryName);
                if (cat) {
                    setModalCategoryId(cat.id);
                    setModalWorkTypeId(tpl.work_type_id);
                }
            }
        }
        
        setModalClientId(tpl.client_id);
        setIsCreatingDraftOverride(false);
        setLocalDraftTemplate(null);
        setLocalDraftSteps([]);
        setModalStep("EDIT");
        setIsAddModalOpen(true);
    };

    const handleCopyFlow = (tpl: any) => {
        setCloneTemplate(tpl);
        setIsCloneOpen(true);
    };

    const selectedClientName = clients.find(c => c.id === selectedClientId)?.clientName || '';
    
    // Deduplicate templates by work_type_id to show only the latest version on dashboard
    // Remove filters temporarily per user request #5
    const uniqueWorkflowTemplates = clientTemplates;

    // Calculate Summary Stats
    const totalClientsCount = clients.length;
    const clientFlowsCount = clientTemplates.length;
    const draftClientFlowsCount = clientTemplates.filter(w => w.status === "DRAFT" || w.is_draft === true).length;
    const activeClientFlowsCount = clientTemplates.filter(w => w.status === "ACTIVE" || w.is_active === true).length;

    // Retrieve active template data for Step 2 modal
    const clientOverride = selectedWorkTypeId ? clientTemplates.find(t => t.work_type_id === selectedWorkTypeId && t.client_id === selectedClientId) : null;

    const activeTemplateData: WorkflowTemplateData | null = isCreatingDraftOverride 
        ? localDraftTemplate 
        : (clientOverride ? {
            ...clientOverride,
            common_information_fields: clientOverride.common_information_fields || []
        } : null);

    const activeStepsData: WorkflowStepData[] = isCreatingDraftOverride 
        ? localDraftSteps 
        : (clientOverride?.steps || []);

    if (permLoading || !canViewWorkSchedules) return <div className="p-6"><PageSkeleton /></div>;

    return (
        <div className="space-y-8 pb-24">
            
            {/* 1. Header Card */}
            <PageHero
                pattern="pattern-5"
                icon={ListChecks}
                badge="WORK MANAGEMENT"
                title="Client Based Flow"
                description="Create client-specific workflow overrides for selected clients and work types."
            >
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0 items-stretch sm:items-center">
                    <Select onValueChange={setSelectedClientId} value={selectedClientId}>
                        <SelectTrigger className="w-full sm:w-[220px] bg-slate-50 border-slate-200 text-slate-700 font-medium">
                            <SelectValue placeholder="Select a Client..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[220px]">
                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {canManageWorkSchedules && (
                        <Button 
                            onClick={() => {
                                resetModalState();
                                setIsAddModalOpen(true);
                            }} 
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm shrink-0 flex items-center justify-center gap-2"
                        >
                            <PlusCircle className="h-4 w-4" /> Add Client Workflow
                        </Button>
                    )}
                </div>
            </PageHero>

            {/* 2. Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-400">
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Total Clients</div>
                        <div className="text-2xl font-bold text-slate-800">{totalClientsCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Client Flows Created</div>
                        <div className="text-2xl font-bold text-slate-800">{clientFlowsCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Draft Client Flows</div>
                        <div className="text-2xl font-bold text-amber-600">{draftClientFlowsCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Active Client Flows</div>
                        <div className="text-2xl font-bold text-emerald-600">{activeClientFlowsCount}</div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 p-6 rounded-xl flex items-center justify-between mb-6 animate-in fade-in duration-300">
                    <div>
                        <h4 className="font-semibold text-red-900">Client workflows could not be loaded.</h4>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                    <Button variant="outline" onClick={fetchTemplates} className="bg-white">Retry</Button>
                </div>
            )}

            {/* 3. Existing Client Workflows & Empty State */}
            {isLoading ? (<div className="p-6"><PageSkeleton /></div>) : (
                <div>
                    {uniqueWorkflowTemplates.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-200 p-10 rounded-2xl text-left w-full my-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm animate-in fade-in duration-300">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                                    <ListChecks className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-slate-800">No client workflows created yet</h3>
                                    <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                                        Click Add Client Workflow to create a client-specific override for this client. Overrides allow standardizing custom SLA rules, checklists, or steps to meet specific contract agreements.
                                    </p>
                                </div>
                            </div>
                            {canManageWorkSchedules && (
                                <Button 
                                    onClick={() => {
                                        resetModalState();
                                        setIsAddModalOpen(true);
                                    }} 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 shadow-md shrink-0 flex items-center gap-2"
                                >
                                    <PlusCircle className="h-4 w-4" /> Add Client Workflow
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-slate-800">Existing Overrides for {selectedClientName}</h2>
                                <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-semibold">
                                    {uniqueWorkflowTemplates.length} custom override{uniqueWorkflowTemplates.length === 1 ? '' : 's'}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {uniqueWorkflowTemplates.map((t) => {
                                    const wtInfo = allWorkTypes.find(wt => wt.id === t.work_type_id);
                                    const wtName = wtInfo?.name || t.workflow_name;
                                    const deptName = wtInfo?.deptName || "Global";
                                    const catName = wtInfo?.categoryName || "Uncategorized";
                                    const stepsCount = t.steps?.length || 0;
                                    const updatedDate = t.updated_at ? new Date(t.updated_at) : (t.created_at ? new Date(t.created_at) : null);
                                    
                                    return (
                                        <Card key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
                                            <CardHeader className="p-5 pb-3">
                                                <div className="flex justify-between items-start gap-2 mb-2">
                                                    <div className="space-y-1">
                                                        <h3 className="font-bold text-slate-900 leading-tight text-sm line-clamp-1">
                                                            {t.workflow_name || `${wtName} Custom Override`}
                                                        </h3>
                                                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                            Work Type: <span className="font-semibold text-slate-700">{wtName}</span>
                                                        </p>
                                                    </div>
                                                    <Badge 
                                                        variant="outline" 
                                                        className={cn(
                                                            "text-[9px] font-bold px-2 py-0.5 border-none shrink-0",
                                                            t.status === 'ACTIVE' && "bg-emerald-50 text-emerald-700",
                                                            t.status === 'DRAFT' && "bg-amber-50 text-amber-700",
                                                            t.status === 'ARCHIVED' && "bg-red-50 text-red-700"
                                                        )}
                                                    >
                                                        {t.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-50 px-2.5 py-1 rounded-md">
                                                        <span>{deptName}</span>
                                                        <ChevronRight className="h-3 w-3 text-slate-300" />
                                                        <span>{catName}</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-blue-200 bg-blue-50 text-blue-700 font-bold uppercase tracking-wider shrink-0">
                                                        Client Override
                                                    </Badge>
                                                </div>
                                            </CardHeader>

                                            <CardContent className="p-5 pt-0 pb-3 text-xs text-slate-500 space-y-2">
                                                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                                                        <ListChecks className="h-4 w-4 text-indigo-500" />
                                                        {stepsCount} {stepsCount === 1 ? 'step' : 'steps'}
                                                    </span>
                                                    <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none shrink-0">
                                                        Version {t.version}
                                                    </Badge>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                                                    <span className="truncate max-w-[150px]">Client: <strong>{selectedClientName}</strong></span>
                                                    {updatedDate && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Clock className="h-3 w-3 text-slate-300" />
                                                            <span>{format(updatedDate, 'dd MMM yyyy')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>

                                            <CardFooter className="p-5 pt-0 bg-slate-50/50 border-t border-slate-100/50 flex items-center justify-end gap-2 mt-auto">
                                                {canManageWorkSchedules && (
                                                    <>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => handleCopyFlow(t)} 
                                                            className="h-8 text-slate-600 hover:text-indigo-600 hover:bg-indigo-55/50 text-xs px-2.5"
                                                        >
                                                            <Copy className="h-3.5 w-3.5 mr-1" />
                                                            Copy
                                                        </Button>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleEditClientWorkflow(t)}
                                                            className="h-8 border-slate-200 text-indigo-600 hover:bg-indigo-55 hover:border-indigo-200 text-xs font-bold px-3 shadow-sm bg-white"
                                                        >
                                                            <Edit className="h-3.5 w-3.5 mr-1" />
                                                            Edit Client Workflow
                                                        </Button>
                                                    </>
                                                )}
                                            </CardFooter>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Progressive Workflow Configuration Modal */}
            <Dialog 
                open={isAddModalOpen} 
                onOpenChange={(open) => {
                    setIsAddModalOpen(open);
                    if (!open) {
                        setTimeout(() => resetModalState(), 200);
                    }
                }}
            >
                <DialogContent 
                    className={cn(
                        "transition-all duration-300 flex flex-col p-0 overflow-hidden bg-white border border-slate-100 shadow-2xl rounded-2xl",
                        modalStep === "SELECT" ? "sm:max-w-[480px] h-auto max-h-[90vh]" : "sm:max-w-[950px] md:max-w-[1100px] w-[95vw] h-[85vh]"
                    )}
                >
                    {modalStep === "SELECT" ? (
                        <div className="flex flex-col h-full bg-white animate-in fade-in zoom-in-95 duration-200">
                            <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
                                <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <PlusCircle className="h-5 w-5 text-indigo-600" />
                                    Adding New Client Override
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 text-xs mt-1 leading-relaxed">
                                    Enter the details for Client Override.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {/* Client selector in Modal */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Client</label>
                                    <Select value={modalClientId} onValueChange={handleModalClientChange}>
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Select Client" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                            {clients.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.clientName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Department Dropdown */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Department</label>
                                    <Select value={modalDeptId || ""} onValueChange={handleModalDeptChange}>
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((dept) => (
                                                <SelectItem key={dept.id} value={dept.id}>
                                                    {dept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Category Dropdown */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Category</label>
                                    <Select 
                                        value={modalCategoryId || ""} 
                                        onValueChange={handleModalCategoryChange}
                                        disabled={!modalDeptId}
                                    >
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200 disabled:opacity-50">
                                            <SelectValue placeholder={modalDeptId ? "Select Category" : "Select Department First"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {modalCategories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Work Type Dropdown */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Work Type</label>
                                    <Select 
                                        value={modalWorkTypeId || ""} 
                                        onValueChange={handleModalWorkTypeChange}
                                        disabled={!modalCategoryId}
                                    >
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200 disabled:opacity-50">
                                            <SelectValue placeholder={modalCategoryId ? "Select Work Type" : "Select Category First"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {modalWorkTypes.map((wt) => (
                                                <SelectItem key={wt.id} value={wt.id}>
                                                    {wt.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Validation Error Message */}
                                {modalError && (
                                    <p className="text-xs text-red-600 font-medium">{modalError}</p>
                                )}

                                {/* Context Check & Notice Areas */}
                                {modalWorkTypeId && modalClientId && (
                                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs animate-in slide-in-from-top-2 duration-350">
                                        {modalExistingOverride ? (
                                            <div className="text-emerald-700 font-medium flex items-start gap-2">
                                                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                                                <span>A client workflow already exists for this client and work type. You can edit the existing override.</span>
                                            </div>
                                        ) : modalGlobalTemplate ? (
                                            <div className="text-indigo-700 font-medium flex items-start gap-2">
                                                <Info className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                                                <span>This client is currently using the global workflow. You can create a client-specific override initialized from global standards.</span>
                                            </div>
                                        ) : (
                                            <div className="text-amber-700 font-medium flex items-start gap-2">
                                                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                                <span>No global workflow exists for this work type. You can create a client-specific workflow override from scratch.</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="border-t p-6 shrink-0 flex items-center justify-between bg-slate-50/50 gap-2">
                                <DialogClose asChild>
                                    <Button variant="ghost" className="flex-1 text-slate-500 border-none hover:bg-slate-100 h-10">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button 
                                    onClick={handleStartConfiguration} 
                                    disabled={!modalWorkTypeId || !modalClientId}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md h-10 disabled:opacity-50"
                                >
                                    {modalExistingOverride 
                                        ? "Edit Existing Client Workflow" 
                                        : (modalGlobalTemplate ? "Create Client Override" : "Configure New Client Workflow")
                                    }
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full overflow-hidden bg-white animate-in fade-in zoom-in-95 duration-200">
                            <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50 flex flex-row items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                                        {activeTemplateData?.id ? "Editing \"Client Override\"" : "Adding New Client Override"}
                                        <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-blue-200 bg-blue-50 text-blue-700 font-bold uppercase tracking-wider shrink-0">
                                            Client Override
                                        </Badge>
                                    </DialogTitle>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                        <span className="font-semibold text-slate-800">Client: {clients.find(c => c.id === modalClientId)?.clientName}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="font-semibold text-indigo-600">{modalSelectedWorkType?.name}</span>
                                        <span className="text-slate-300">•</span>
                                        <span>{modalSelectedDept?.name}</span>
                                        <span className="text-slate-300">/</span>
                                        <span>{modalSelectedCategory?.name}</span>
                                    </div>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setModalStep("SELECT")}
                                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/60 font-semibold text-xs h-9 pr-3 mr-6 shrink-0"
                                >
                                    <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                                    Change Selection
                                </Button>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {selectedWorkTypeId && activeTemplateData && (
                                    <div className="w-full max-w-full">
                                        <WorkflowEditorTabs
                                            key={`${selectedWorkTypeId}-${selectedClientId}`} // Force remount on scope/client changes
                                            initialTemplate={activeTemplateData}
                                            initialSteps={activeStepsData}
                                            departments={departments}
                                            onSave={async (template, steps) => {
                                                return await handleSave(template, steps);
                                            }}
                                            onSuccess={async () => {
                                                await fetchTemplates().catch(err => console.error("Workflow list refresh failed", err));
                                                setIsAddModalOpen(false);
                                                resetModalState();
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {cloneTemplate && (
                <WorkflowCloneDialog 
                    isOpen={isCloneOpen} 
                    onClose={() => {
                        setIsCloneOpen(false);
                        setCloneTemplate(null);
                    }} 
                    templateId={cloneTemplate.id}
                    templateName={cloneTemplate.workflow_name}
                    currentScope="CLIENT"
                    clients={clients.map(c => ({ id: c.id, client_name: c.clientName }))} 
                    onSuccess={async (newTpl) => {
                        await fetchTemplates();
                        toast({ title: 'Flow Copied Successfully' });
                    }}
                />
            )}
        </div>
    );
}

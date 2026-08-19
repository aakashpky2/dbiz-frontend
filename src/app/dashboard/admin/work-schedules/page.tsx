
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FormProvider, useForm, useFormContext, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { addDays } from 'date-fns';
import { addMonths } from 'date-fns';
import { subDays } from 'date-fns';
import { startOfMonth } from 'date-fns';
import { endOfMonth } from 'date-fns';
import { startOfQuarter } from 'date-fns';
import { endOfQuarter } from 'date-fns';
import { startOfYear } from 'date-fns';
import { getYear } from 'date-fns';
import { getMonth } from 'date-fns';
import { subMonths } from 'date-fns';
import { lastDayOfMonth } from 'date-fns';
import { lastDayOfQuarter } from 'date-fns';
import { lastDayOfYear } from 'date-fns';
import { subQuarters } from 'date-fns';
import { subYears } from 'date-fns';
import { endOfYear } from 'date-fns';
import { sub } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { useBusinessConstitutions, type BusinessTypeSetup } from '@/hooks/use-profiles';
import { Loader2, AlertTriangle, Clock, PlusCircle, Edit, Trash2, CalendarIcon, Cog, ChevronRight, Settings, CheckCircle, ListChecks, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { PageHero } from '@/components/dashboard/page-hero';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '@/components/ui/badge';

export interface ChecklistItem {
    id?: string;
    stepTitle: string;
    instructions?: string;
    videoUrl?: string;
    requiredDocs?: Array<{ name: string }>;
    templateId?: string;
}

export interface Schedule {
    frequency?: string;
    checklist?: ChecklistItem[];
}

// ==========================================
// V2 WORKFLOW MANAGEMENT WRAPPER
// ==========================================
import { WorkflowEditorTabs } from '@/components/workflow/WorkflowEditorTabs';
import { WorkflowTemplateData } from '@/components/workflow/CommonRulesForm';
import { WorkflowStepData } from '@/components/workflow/StepWiseRulesForm';

import { WorkflowCloneDialog } from '@/components/workflow/WorkflowCloneDialog';
import { Search, Filter, Play, Copy } from 'lucide-react';

function V2WorkSchedules() {
    const { toast } = useToast();
    const [departments, setDepartments] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
    const [templateError, setTemplateError] = useState(false);

    const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string | null>(null);
    
    // For Clone Dialog
    const [isCloneOpen, setIsCloneOpen] = useState(false);
    const [cloneTemplate, setCloneTemplate] = useState<any | null>(null);

    // New Add Workflow Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modalStep, setModalStep] = useState<"SELECT" | "EDIT">("SELECT");
    const [modalDeptId, setModalDeptId] = useState<string | null>(null);
    const [modalCategoryId, setModalCategoryId] = useState<string | null>(null);
    const [modalWorkTypeId, setModalWorkTypeId] = useState<string | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);

    // Delete Workflow State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const resetModalState = useCallback(() => {
        setModalDeptId(null);
        setModalCategoryId(null);
        setModalWorkTypeId(null);
        setModalError(null);
        setModalStep("SELECT");
    }, []);

    const fetchTemplates = async () => {
        try {
            setIsLoadingTemplates(true);
            setTemplateError(false);
            
            const response = await fetch(`/api/workflow-templates?scope=GLOBAL`, {
                credentials: 'include'
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to fetch workflow templates");
            }
            
            const workflows = result.data || [];
            console.log("Workflow API raw result:", result);
            console.log("Workflow templates from result.data:", workflows);
            
            // Temporarily removed filter to display all workflows
            const visibleWorkflows = workflows;
            console.log("Workflow templates after frontend filter:", visibleWorkflows);
            
            setTemplates(visibleWorkflows);
        } catch (error) {
            console.error("Failed to fetch workflow templates", error);
            setTemplateError(true);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const handleDeleteWorkflow = async () => {
        if (!templateToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/workflow-templates/${templateToDelete}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const result = await res.json();
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                setDeleteDialogOpen(false);
                fetchTemplates();
            } else {
                toast({ title: 'Failed to delete', description: result.message || result.error || 'Unknown error', variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsDeleting(false);
            setTemplateToDelete(null);
        }
    };

    useEffect(() => {
        apiFetch('/api/departments?active=true')
            .then(res => res.json())
            .then(data => setDepartments(data.data || []))
            .catch(err => console.error('[work-schedules] Error fetching departments:', err));
        fetchTemplates();
    }, []);

    const allWorkTypes = useMemo(() => {
        const types: { id: string; name: string; deptName: string; categoryName: string }[] = [];
        departments.forEach(dept => {
            dept.workCategories?.forEach((cat: any) => {
                cat.workTypes?.forEach((wt: any) => {
                    types.push({ id: wt.id, name: wt.name, deptName: dept.name, categoryName: cat.name });
                });
            });
        });
        return types;
    }, [departments]);

    // Cascading select selectors logic
    const modalSelectedDept = useMemo(() => {
        return departments.find(d => d.id === modalDeptId);
    }, [departments, modalDeptId]);

    const modalCategories = useMemo(() => {
        return modalSelectedDept?.workCategories || [];
    }, [modalSelectedDept]);

    const modalSelectedCategory = useMemo(() => {
        return modalCategories.find((c: any) => c.id === modalCategoryId);
    }, [modalCategories, modalCategoryId]);

    const modalWorkTypes = useMemo(() => {
        return modalSelectedCategory?.workTypes || [];
    }, [modalSelectedCategory]);

    const modalExistingTemplate = useMemo(() => {
        if (!modalWorkTypeId) return null;
        return templates.find(t => t.work_type_id === modalWorkTypeId);
    }, [templates, modalWorkTypeId]);

    const handleDeptChange = (deptId: string) => {
        setModalDeptId(deptId);
        setModalCategoryId(null);
        setModalWorkTypeId(null);
        setModalError(null);
    };

    const handleCategoryChange = (catId: string) => {
        setModalCategoryId(catId);
        setModalWorkTypeId(null);
        setModalError(null);
    };

    const handleWorkTypeChange = (wtId: string) => {
        setModalWorkTypeId(wtId);
        setModalError(null);
    };

    // Get the most recent template for a specific work type
    const getTemplateForWorkType = (workTypeId: string) => {
        return templates.find(t => t.work_type_id === workTypeId);
    };

    const handleSave = async (template: WorkflowTemplateData, steps: WorkflowStepData[]) => {
        console.log("Save started");
        try {
            console.log("[Admin WorkSchedules] Sending save payload to backend...");
            
            const response = await fetch('/api/workflow-templates/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ template, steps })
            });

            const result = await response.json();
            console.log("Save response", result);
            
            if (!response.ok || !result?.success) {
                console.error("[Admin WorkSchedules] Backend save error:", result);
                throw new Error(result?.message || "Failed to save workflow");
            }

            console.log("[Admin WorkSchedules] Save successful, template ID:", result.data?.template?.id);
            return result;
        } catch (error: any) {
            console.error("[Admin WorkSchedules] Save failed completely:", error);
            throw new Error(error?.message || error?.details || "An unknown error occurred during save");
        }
    };

    const selectedWT = allWorkTypes.find(w => w.id === selectedWorkTypeId);
    const existingTemplate = selectedWT ? getTemplateForWorkType(selectedWT.id) : null;
    
    const activeTemplateData: WorkflowTemplateData | null = selectedWT ? (existingTemplate ? {
        ...existingTemplate,
        common_information_fields: existingTemplate.common_information_fields || []
    } : {
        id: '',
        workflow_name: `${selectedWT.name} Flow`,
        description: '',
        version: 1,
        scope: 'GLOBAL',
        client_id: null,
        status: 'ACTIVE',
        is_active: true,
        work_type_id: selectedWT.id,
        common_information_fields: []
    }) : null;

    const handleModalSubmit = () => {
        if (!modalDeptId || !modalCategoryId || !modalWorkTypeId) {
            setModalError("Please select a department, category, and work type to continue.");
            return;
        }
        setModalError(null);
        setSelectedWorkTypeId(modalWorkTypeId);
        setModalStep("EDIT");
    };

    const handleEditWorkflow = (wtId: string) => {
        setSelectedWorkTypeId(wtId);
        
        // Find corresponding department and category to pre-fill cascading select states
        const wtInfo = allWorkTypes.find((wt: any) => wt.id === wtId);
        if (wtInfo) {
            const dept = departments.find(d => d.name === wtInfo.deptName);
            if (dept) {
                setModalDeptId(dept.id);
                const cat = dept.workCategories?.find((c: any) => c.name === wtInfo.categoryName);
                if (cat) {
                    setModalCategoryId(cat.id);
                    setModalWorkTypeId(wtId);
                }
            }
        }
        
        setModalStep("EDIT");
        setIsAddModalOpen(true);
    };

    const handleCopyFlow = (tpl: any) => {
        setCloneTemplate(tpl);
        setIsCloneOpen(true);
    };

    // Calculate Summary Stats
    const totalWorkTypesCount = allWorkTypes.length;
    const flowsCreatedCount = templates.length;
    const draftFlowsCount = templates.filter(w => w.status === "DRAFT" || w.is_draft === true).length;
    const activeFlowsCount = templates.filter(w => w.status === "ACTIVE" || w.is_active === true).length;

    // Remove filters temporarily per user request #5
    const uniqueWorkflowTemplates = templates;

    return (
        <div className="space-y-8 pb-24">
            
            {/* 1. Page Header */}
            <PageHero
                pattern="pattern-1"
                icon={CalendarIcon}
                badge="ADMINISTRATION"
                title="Work Based Flow"
                description="Create and manage reusable workflow flows for work types."
            >
                <Button 
                    onClick={() => {
                        resetModalState();
                        setIsAddModalOpen(true);
                    }} 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm shrink-0"
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Workflow
                </Button>
            </PageHero>

            {/* 2. Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Total Work Types</div>
                        <div className="text-2xl font-bold text-slate-800">{totalWorkTypesCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Flows Created</div>
                        <div className="text-2xl font-bold text-slate-800">{flowsCreatedCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Draft Flows</div>
                        <div className="text-2xl font-bold text-amber-600">{draftFlowsCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100 bg-white">
                    <CardContent className="p-5 flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Active Flows</div>
                        <div className="text-2xl font-bold text-emerald-600">{activeFlowsCount}</div>
                    </CardContent>
                </Card>
            </div>

            {templateError && (
                <div className="bg-red-50 border border-red-200 p-6 rounded-xl flex items-center justify-between mb-6">
                    <div>
                        <h4 className="font-semibold text-red-900">Workflow flows could not be loaded.</h4>
                        <p className="text-sm text-red-700">The server encountered an error while fetching existing flows.</p>
                    </div>
                    <Button variant="outline" onClick={fetchTemplates} className="bg-white">Retry</Button>
                </div>
            )}

            {/* 3. Existing Workflows Grid & Empty State */}
            {!isLoadingTemplates && (
                <div>
                    {uniqueWorkflowTemplates.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-200 p-10 rounded-2xl text-left w-full my-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                                    <ListChecks className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-slate-800">No workflows created yet</h3>
                                    <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                                        Click Add Workflow to create your first work type flow. Once created, you will see a summary, status, versioning, and step metrics for all workflow types right here.
                                    </p>
                                </div>
                            </div>
                            <Button 
                                onClick={() => {
                                    resetModalState();
                                    setIsAddModalOpen(true);
                                }} 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 shadow-md shrink-0 flex items-center gap-2"
                            >
                                <PlusCircle className="h-4 w-4" /> Add Workflow
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-800">Existing Workflows</h2>
                                <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-semibold">
                                    {uniqueWorkflowTemplates.length} flows
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {uniqueWorkflowTemplates.map((t) => {
                                    const wtInfo = allWorkTypes.find((wt: any) => wt.id === t.work_type_id);
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
                                                            {t.workflow_name || `${wtName} Flow`}
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
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-50 px-2.5 py-1 rounded-md mt-2 w-fit">
                                                    <span>{deptName}</span>
                                                    <ChevronRight className="h-3 w-3 text-slate-300" />
                                                    <span>{catName}</span>
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
                                                {updatedDate && (
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1">
                                                        <Clock className="h-3 w-3 text-slate-300" />
                                                        <span>Updated: {format(updatedDate, 'dd MMM yyyy')}</span>
                                                    </div>
                                                )}
                                            </CardContent>

                                            <CardFooter className="p-5 pt-0 bg-slate-50/50 border-t border-slate-100/50 flex items-center justify-end gap-2 mt-auto">
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => {
                                                            setTemplateToDelete(t.id);
                                                            setDeleteDialogOpen(true);
                                                        }} 
                                                        className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50/50 text-xs px-2.5"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                        Delete
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleCopyFlow(t)} 
                                                        className="h-8 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 text-xs px-2.5"
                                                    >
                                                        <Copy className="h-3.5 w-3.5 mr-1" />
                                                        Copy
                                                    </Button>
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => handleEditWorkflow(t.work_type_id)}
                                                    className="h-8 border-slate-200 text-indigo-600 hover:bg-indigo-55 hover:border-indigo-200 text-xs font-bold px-3 shadow-sm bg-white"
                                                >
                                                    <Edit className="h-3.5 w-3.5 mr-1" />
                                                    Edit Workflow
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the workflow. If it is being used by active works, it will be archived instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteWorkflow();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Progressive Workflow Configuration Modal */}
            <Dialog 
                open={isAddModalOpen} 
                onOpenChange={(open) => {
                    setIsAddModalOpen(open);
                    if (!open) {
                        // Small timeout to prevent visual jump while dialog is closing
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
                        <div className="flex flex-col h-full">
                            <DialogHeader className="p-6 pb-4 border-b border-slate-100">
                                <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <PlusCircle className="h-5 w-5 text-indigo-600" />
                                    Adding New Workflow
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 text-xs mt-1 leading-relaxed">
                                    Enter the details for Workflow.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="p-6 space-y-4 overflow-y-auto">
                                {/* Department Dropdown */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Department</label>
                                    <Select value={modalDeptId || ""} onValueChange={handleDeptChange}>
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
                                        onValueChange={handleCategoryChange}
                                        disabled={!modalDeptId}
                                    >
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200 disabled:opacity-50">
                                            <SelectValue placeholder={modalDeptId ? "Select Category" : "Select Department First"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {modalCategories.map((cat: any) => (
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
                                        onValueChange={handleWorkTypeChange}
                                        disabled={!modalCategoryId}
                                    >
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200 disabled:opacity-50">
                                            <SelectValue placeholder={modalCategoryId ? "Select Work Type" : "Select Category First"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {modalWorkTypes.map((wt: any) => (
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

                                {/* Existing Flow Detection Text */}
                                {modalWorkTypeId && (
                                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                                        {modalExistingTemplate ? (
                                            <div className="text-emerald-700 font-medium flex items-start gap-2">
                                                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                                                <span>A workflow already exists for this work type. You can edit the existing flow.</span>
                                            </div>
                                        ) : (
                                            <div className="text-amber-700 font-medium flex items-start gap-2">
                                                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                                <span>No workflow exists for this work type. A new draft will be created.</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="p-6 pt-4 border-t border-slate-100 bg-slate-50/50 flex flex-row items-center gap-2">
                                <DialogClose asChild>
                                    <Button variant="ghost" className="flex-1 text-slate-500 border-none hover:bg-slate-100 h-10">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button 
                                    onClick={handleModalSubmit} 
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md h-10"
                                >
                                    {modalExistingTemplate ? "Edit Existing Workflow" : "Configure New Workflow"}
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full overflow-hidden bg-white">
                            <DialogHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <DialogTitle className="text-lg font-bold text-slate-800">
                                        {existingTemplate ? `Editing "Workflow Flow"` : "Adding New Workflow"}
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-500 text-xs mt-1 leading-relaxed">
                                        {existingTemplate ? "Update the details of this item." : "Enter the details for Workflow."}
                                    </DialogDescription>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                        <span className="font-semibold text-indigo-600">{selectedWT?.name}</span>
                                        <span className="text-slate-300">•</span>
                                        <span>{selectedWT?.deptName}</span>
                                        <span className="text-slate-300">/</span>
                                        <span>{selectedWT?.categoryName}</span>
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

                            <div className="flex-1 overflow-y-auto p-6 max-h-[75vh]">
                                {selectedWorkTypeId && activeTemplateData && (
                                    <div className="w-full max-w-full">
                                        <WorkflowEditorTabs
                                            key={selectedWorkTypeId} // Force remount on work type change
                                            initialTemplate={activeTemplateData}
                                            initialSteps={existingTemplate?.steps || []}
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
                    currentScope="GLOBAL"
                    clients={[]} 
                    onSuccess={async (newTpl) => {
                        await fetchTemplates();
                        toast({ title: 'Flow Copied Successfully' });
                    }}
                />
            )}
        </div>
    );
}

export default function WorkSchedulesPage() {
    return (
        <div className="w-full space-y-8 pb-12 animate-in fade-in duration-300">
            <V2WorkSchedules />
        </div>
    );
}

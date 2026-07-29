// frontend/src/components/workflow/WorkflowTimelineDrawer.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
    CheckCircle2, 
    Circle, 
    Play, 
    Lock, 
    AlertCircle, 
    Clock, 
    User, 
    Users, 
    Check, 
    Loader2, 
    ArrowRight, 
    FileText 
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface StepInstance {
    id: string;
    step_order: number;
    step_name: string;
    step_type: string;
    status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'AT_RISK' | 'OVERDUE' | 'SKIPPED';
    depends_on_step_instance_ids: string[];
    planned_start_date: string;
    planned_finish_date: string;
    actual_started_at: string | null;
    actual_completed_at: string | null;
    claimed_by: string | null;
    claimed_by_name: string | null;
    completed_by: string | null;
    completed_by_name: string | null;
    expected_duration_value: number;
    expected_duration_unit: string;
}

interface WorkflowExecution {
    id: string;
    status: string;
    progress_percentage: number;
    planned_start_date: string;
    planned_finish_date: string;
    work: {
        id: string;
        client_name: string;
        work_type_name: string;
        priority: string;
        due_date: string;
        finish_by_date: string;
    };
}

interface WorkflowTimelineDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    executionInstanceId: string | null;
    currentUserId: string | null;
    onActionCompleted?: () => void;
}

export function WorkflowTimelineDrawer({
    isOpen,
    onClose,
    executionInstanceId,
    currentUserId,
    onActionCompleted
}: WorkflowTimelineDrawerProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const [execution, setExecution] = useState<WorkflowExecution | null>(null);
    const [steps, setSteps] = useState<StepInstance[]>([]);

    const fetchTimelineData = useCallback(async () => {
        if (!executionInstanceId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/my-tasks/timeline/${executionInstanceId}`);
            const result = await res.json();
            if (result.success) {
                setExecution(result.execution);
                setSteps(result.steps || []);
            } else {
                throw new Error(result.error || 'Failed to fetch timeline details');
            }
        } catch (error: any) {
            console.error('Error fetching timeline:', error);
            toast({
                title: 'Error Loading Flow',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [executionInstanceId, toast]);

    useEffect(() => {
        if (isOpen && executionInstanceId) {
            fetchTimelineData();
        }
    }, [isOpen, executionInstanceId, fetchTimelineData]);

    const handleClaimStep = async (stepId: string) => {
        if (!currentUserId) return;
        setIsActionLoading(stepId);
        try {
            // Note: In Phase 5 we will make an official claim step api, for Phase 4 we will use standard claims or placeholder
            const res = await fetch('/api/my-tasks/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workId: stepId, employeeId: currentUserId }) // Maps step ID directly
            });
            const result = await res.json();
            if (result.success) {
                toast({ title: 'Success', description: 'Workflow step claimed successfully!' });
                fetchTimelineData();
                if (onActionCompleted) onActionCompleted();
            } else {
                throw new Error(result.error || 'Failed to claim step');
            }
        } catch (error: any) {
            toast({ title: 'Claim Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleCompleteStep = async (stepId: string) => {
        if (!currentUserId) return;
        setIsActionLoading(stepId);
        try {
            // Decoupled claim/complete API. Fulfills Phase 4 UI complete action
            const res = await fetch('/api/my-tasks/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workId: stepId, employeeId: currentUserId }) // Maps step ID directly
            });
            const result = await res.json();
            if (result.success) {
                toast({ title: 'Success', description: 'Workflow step completed successfully!' });
                fetchTimelineData();
                if (onActionCompleted) onActionCompleted();
            } else {
                throw new Error(result.error || 'Failed to complete step');
            }
        } catch (error: any) {
            toast({ title: 'Completion Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsActionLoading(null);
        }
    };

    const getStatusIcon = (status: StepInstance['status']) => {
        switch (status) {
            case 'COMPLETED':
                return <CheckCircle2 className="h-6 w-6 text-emerald-600 fill-emerald-50" />;
            case 'IN_PROGRESS':
                return <Circle className="h-6 w-6 text-blue-600 fill-blue-50 animate-pulse border-blue-600 border-2 rounded-full" />;
            case 'AVAILABLE':
                return <Circle className="h-6 w-6 text-blue-600" />;
            case 'BLOCKED':
            case 'LOCKED':
            default:
                return <Lock className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const getStepBadge = (status: StepInstance['status']) => {
        switch (status) {
            case 'COMPLETED':
                return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-bold uppercase text-[9px]">COMPLETED</Badge>;
            case 'IN_PROGRESS':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 font-bold uppercase text-[9px] animate-pulse">ACTIVE</Badge>;
            case 'AVAILABLE':
                return <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 font-bold uppercase text-[9px]">AVAILABLE</Badge>;
            case 'BLOCKED':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 font-bold uppercase text-[9px]">BLOCKED</Badge>;
            case 'LOCKED':
            default:
                return <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border font-bold uppercase text-[9px]">LOCKED</Badge>;
        }
    };

    const totalStepsCount = steps.length;
    const completedStepsCount = steps.filter(s => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;
    const activeStepsCount = steps.filter(s => s.status === 'IN_PROGRESS').length;
    const availableStepsCount = steps.filter(s => s.status === 'AVAILABLE').length;
    const blockedStepsCount = steps.filter(s => s.status === 'LOCKED' || s.status === 'BLOCKED').length;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto border-l shadow-2xl bg-card p-0">
                {isLoading && !execution ? (
                    <div className="flex flex-col justify-center items-center h-full gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                        <p className="text-muted-foreground font-medium animate-pulse">Loading Timeline Flow...</p>
                    </div>
                ) : !execution ? (
                    <div className="flex flex-col justify-center items-center h-full p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground font-bold">No Active Workflow Instance</p>
                        <p className="text-xs text-muted-foreground">This work does not have a V2 workflow template.</p>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Header Section */}
                        <div className="p-6 border-b bg-muted/50/50">
                            <SheetHeader className="text-left">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] uppercase font-black text-indigo-600 tracking-wider">Active V2 Workflow</span>
                                        <SheetTitle className="text-xl font-black text-foreground tracking-tight mt-0.5">
                                            {execution.work.work_type_name}
                                        </SheetTitle>
                                    </div>
                                    <Badge className={cn(
                                        "font-bold uppercase text-[9px]",
                                        execution.work.priority === 'High' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                        execution.work.priority === 'Medium' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                        "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                    )}>
                                        {execution.work.priority} Priority
                                    </Badge>
                                </div>
                                <SheetDescription className="text-xs text-muted-foreground font-medium mt-1">
                                    Client: <span className="text-foreground font-bold">{execution.work.client_name}</span>
                                </SheetDescription>
                            </SheetHeader>

                            {/* Overall Progress Indicator */}
                            <div className="mt-6 space-y-2">
                                <div className="flex justify-between text-xs font-bold text-foreground">
                                    <span>Workflow Progression</span>
                                    <span>{Math.round(execution.progress_percentage)}%</span>
                                </div>
                                <Progress value={execution.progress_percentage} className="h-2.5 bg-muted" />
                                {execution.progress_percentage === 100 && (
                                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase rounded p-2 text-center mt-2 flex items-center justify-center gap-1.5 animate-bounce">
                                        <Check className="h-3.5 w-3.5" /> Workflow Completed
                                    </div>
                                )}
                            </div>

                            {/* Analytics Summary Panel */}
                            <div className="grid grid-cols-3 gap-3 mt-6">
                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center">
                                    <span className="text-[10px] uppercase font-black text-emerald-700 tracking-wider block">Steps Done</span>
                                    <span className="text-sm font-black text-emerald-800 block mt-1">
                                        {completedStepsCount} <span className="text-[10px] font-normal text-emerald-600">/ {totalStepsCount}</span>
                                    </span>
                                </div>
                                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-center">
                                    <span className="text-[10px] uppercase font-black text-blue-700 tracking-wider block">Active Steps</span>
                                    <span className="text-sm font-black text-blue-800 block mt-1">
                                        {activeStepsCount + availableStepsCount}
                                    </span>
                                </div>
                                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-center">
                                    <span className="text-[10px] uppercase font-black text-amber-700 tracking-wider block">Blocked Steps</span>
                                    <span className="text-sm font-black text-amber-800 block mt-1">
                                        {blockedStepsCount}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <div className="bg-muted/70 border border-border/50 rounded-xl p-3">
                                    <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider block">Claimed By Users</span>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {steps.filter(s => s.claimed_by_name).length > 0 ? (
                                            Array.from(new Set(steps.map(s => s.claimed_by_name).filter(Boolean))).map((name, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 bg-card text-foreground text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm">
                                                    <User className="h-2 w-2 text-indigo-500" /> {name}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[9px] text-muted-foreground italic">No steps claimed yet</span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
                                    <span className="text-[10px] uppercase font-black text-indigo-700 tracking-wider block">Parallel Active</span>
                                    <span className="text-sm font-black text-indigo-800 block mt-1">
                                        {activeStepsCount} <span className="text-[10px] font-normal text-indigo-600">running</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Steps List Timeline */}
                        <div className="flex-1 p-6 space-y-6">
                            <div className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4">Steps Timeline Execution</div>
                            
                            <div className="relative border-l-2 border-border pl-6 ml-3 space-y-8">
                                {steps.map((step) => {
                                    const isClaimedByMe = step.claimed_by === currentUserId;
                                    const canClaim = step.status === 'AVAILABLE' && !step.claimed_by;

                                    return (
                                        <div key={step.id} className="relative group">
                                            {/* Status Node Circle */}
                                            <div className="absolute -left-[35px] top-0 bg-card p-1 rounded-full border border-border shadow-sm z-10">
                                                {getStatusIcon(step.status)}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-indigo-600">Step {step.step_order}</span>
                                                            {getStepBadge(step.status)}
                                                        </div>
                                                        <h4 className="font-bold text-foreground text-sm mt-0.5">
                                                            {step.step_name}
                                                        </h4>
                                                    </div>
                                                    
                                                    {/* Expected Duration */}
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {step.expected_duration_value} {step.expected_duration_unit}
                                                    </span>
                                                </div>

                                                {/* Meta: Planned Schedule & Assigned Handler */}
                                                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-medium bg-muted/50 rounded-lg p-2.5">
                                                    <div>
                                                        <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-tight">Planned Finish</span>
                                                        <span className="text-foreground font-bold">
                                                            {step.planned_finish_date ? format(new Date(step.planned_finish_date), 'dd MMM yyyy') : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-tight">Assigned Handler</span>
                                                        <span className="text-foreground font-bold flex items-center gap-1">
                                                            <User className="h-2.5 w-2.5" />
                                                            {step.status === 'COMPLETED' ? (step.completed_by_name || 'System') : (step.claimed_by_name || 'Unclaimed')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Blocked Reason details */}
                                                {step.status === 'BLOCKED' && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-semibold bg-red-50 p-2 rounded">
                                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                        <span>Locked: Waiting on upstream parents.</span>
                                                    </div>
                                                )}

                                                {/* Interactive actions for AVAILABLE or IN_PROGRESS steps */}
                                                {canClaim && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleClaimStep(step.id)}
                                                        disabled={!!isActionLoading}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-[11px] px-3.5 mt-2"
                                                    >
                                                        {isActionLoading === step.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                                        ) : (
                                                            <Play className="h-3 w-3 mr-1.5 fill-current" />
                                                        )}
                                                        Claim & Start Step
                                                    </Button>
                                                )}

                                                {isClaimedByMe && step.status === 'IN_PROGRESS' && (
                                                    <div className="flex gap-2 mt-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleCompleteStep(step.id)}
                                                            disabled={!!isActionLoading}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-[11px] px-3.5"
                                                        >
                                                            {isActionLoading === step.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                                            ) : (
                                                                <Check className="h-3 w-3 mr-1.5" />
                                                            )}
                                                            Mark Complete
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer section with Close actions */}
                        <div className="p-4 border-t bg-muted/50/50 flex justify-end">
                            <Button variant="outline" onClick={onClose} className="font-bold">
                                Close Flow
                            </Button>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

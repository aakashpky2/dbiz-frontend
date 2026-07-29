
'use client';
import { PageSkeleton } from '@/components/ui/page-skeleton';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileText, Video, Download } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { type Client } from '@/components/dashboard/work/client-form';
import { type ChecklistItem, type Schedule } from '@/app/dashboard/admin/work-schedules/page';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type Template } from '@/components/dashboard/settings/template-manager';


interface WorkflowStep extends ChecklistItem {
    status?: 'Complete' | 'Pending';
    remarks?: string;
    checkedDocs?: Record<string, boolean>;
}

interface AssignedWorkDetails {
    clientId: string;
    clientName: string;
    workTypeId: string;
    workTypeName: string;
    workflow: {
        schedule?: Schedule;
        steps: WorkflowStep[];
    }
}

export default function TaskDetailPage() {
    const params = useParams();
    const taskId = params.id as string;
    const [clientId, workTypeId] = taskId.split('-');

    const [task, setTask] = useState<AssignedWorkDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [templates, setTemplates] = useState<Template[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (!clientId || !workTypeId) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch client
                const { data: clientData } = await supabase
                    .from('clients')
                    .select('*')
                    .eq('id', clientId)
                    .maybeSingle();

                // Fetch workflow
                const { data: workflowData } = await supabase
                    .from('client_workflows')
                    .select('*')
                    .eq('client_id', clientId)
                    .eq('work_type_id', workTypeId)
                    .maybeSingle();

                if (!clientData || !workflowData) {
                    setTask(null);
                    return;
                }

                // Fetch work type name
                const { data: workTypeData } = await supabase
                    .from('work_types')
                    .select('name')
                    .eq('id', workTypeId)
                    .maybeSingle();
                const workTypeName = workTypeData?.name || "Work Type " + workTypeId;

                // Fetch templates
                const { data: templatesData } = await supabase
                    .from('pdf_templates')
                    .select('*');
                setTemplates((templatesData || []) as any);

                const checklist = workflowData.checklist || [];
                const progress = workflowData.progress || {};

                setTask({
                    clientId,
                    clientName: clientData.client_name,
                    workTypeId,
                    workTypeName: workTypeName,
                    workflow: {
                        schedule: workflowData.schedule,
                        steps: checklist.map((item: any) => ({
                            ...item,
                            status: progress[item.id]?.status || 'Pending',
                            remarks: progress[item.id]?.remarks || '',
                            checkedDocs: progress[item.id]?.checkedDocs || {}
                        }))
                    }
                });

            } catch (error) {
            console.error("Error fetching task details:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [clientId, workTypeId]);

    const handleStepStateChange = (stepId: string, field: 'remarks' | 'checkedDocs', value: any) => {
        if (!task) return;

        const updatedSteps = task.workflow.steps.map(step => {
            if (step.id === stepId) {
                if (field === 'checkedDocs') {
                    return {
                        ...step,
                        checkedDocs: { ...step.checkedDocs, ...value }
                    };
                }
                return { ...step, [field]: value };
            }
            return step;
        });

        setTask({ ...task, workflow: { ...task.workflow, steps: updatedSteps } });
    }

    const handleSaveProgress = async (stepId: string) => {
        const stepToSave = task?.workflow.steps.find(s => s.id === stepId);
        if (!stepToSave) return;

        try {
            // Update progress in the client_workflows row's progress JSON column
            const { data: current } = await supabase
                .from('client_workflows')
                .select('progress')
                .eq('client_id', clientId)
                .eq('work_type_id', workTypeId)
                .maybeSingle();

            const updatedProgress = {
                ...(current?.progress || {}),
                [stepId]: {
                    remarks: stepToSave.remarks || "",
                    checkedDocs: stepToSave.checkedDocs || {},
                }
            };

            await supabase
                .from('client_workflows')
                .update({ progress: updatedProgress })
                .eq('client_id', clientId)
                .eq('work_type_id', workTypeId);

            toast({ title: "Progress Saved", description: `Your changes for "${stepToSave.stepTitle}" have been saved.` });
        } catch (error) {
            toast({ title: "Save Error", description: "Could not save your progress.", variant: "destructive" });
        }
    };

    const getTemplateName = (templateId?: string) => {
        if (!templateId) return 'No Template Linked';
        return templates.find(t => t.id === templateId)?.name || 'Unknown Template';
    }


    if (isLoading) {
        return <div className="p-6"><PageSkeleton /></div>;
    }

    if (!task) {
        return <div>Task not found or you do not have permission to view it.</div>
    }

    return (
        <div className="space-y-6">
            <Button asChild variant="outline">
                <Link href="/dashboard/work-register/my-tasks"><ArrowLeft className="mr-2 h-4 w-4" /> Back to My Tasks</Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">{task.workTypeName}</CardTitle>
                    <CardDescription>For Client: <span className="font-semibold text-primary">{task.clientName}</span></CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full" defaultValue={`step-0`}>
                        {task.workflow.steps.map((step, index) => (
                            <AccordionItem value={`step-${index}`} key={step.id}>
                                <AccordionTrigger>Step {index + 1}: {step.stepTitle}</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4">
                                    {step.instructions && <p className="text-muted-foreground">{step.instructions}</p>}

                                    {step.videoUrl && (
                                        <Button asChild variant="secondary" size="sm">
                                            <a href={step.videoUrl} target="_blank" rel="noopener noreferrer">
                                                <Video className="mr-2 h-4 w-4" /> Watch Tutorial
                                            </a>
                                        </Button>
                                    )}

                                    {step.requiredDocs && step.requiredDocs.length > 0 && (
                                        <Card className="bg-muted/50">
                                            <CardHeader className="pb-2"><CardTitle className="text-base">Required Documents / Checks</CardTitle></CardHeader>
                                            <CardContent className="space-y-2">
                                                {step.requiredDocs.map((doc, docIndex) => (
                                                    <div key={docIndex} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`${step.id}-${doc.name}`}
                                                            checked={step.checkedDocs?.[doc.name] || false}
                                                            onCheckedChange={(checked) => handleStepStateChange(step.id!, 'checkedDocs', { [doc.name]: checked })}
                                                        />
                                                        <Label htmlFor={`${step.id}-${doc.name}`} className="font-normal">{doc.name}</Label>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {step.templateId && (
                                        <Card className="bg-muted/50">
                                            <CardHeader className="pb-2"><CardTitle className="text-base">Linked Template</CardTitle></CardHeader>
                                            <CardContent className="flex items-center gap-4">
                                                <FileText className="h-5 w-5 text-primary" />
                                                <p className="font-medium">{getTemplateName(step.templateId)}</p>
                                                <Button size="sm" variant="outline" disabled><Download className="h-4 w-4 mr-2" /> Download</Button>
                                            </CardContent>
                                        </Card>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor={`remarks-${step.id}`}>Your Remarks</Label>
                                        <Textarea
                                            id={`remarks-${step.id}`}
                                            placeholder="Add any notes or comments for this step..."
                                            value={step.remarks || ""}
                                            onChange={(e) => handleStepStateChange(step.id!, 'remarks', e.target.value)}
                                        />
                                    </div>

                                    <Button onClick={() => handleSaveProgress(step.id!)}>Save Progress for this Step</Button>

                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
                <CardFooter>
                    <Button>Mark Entire Task as Complete</Button>
                </CardFooter>
            </Card>
        </div>
    );
}

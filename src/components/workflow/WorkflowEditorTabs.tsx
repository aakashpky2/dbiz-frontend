"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CommonRulesForm, WorkflowTemplateData } from './CommonRulesForm';
import { StepWiseRulesForm, WorkflowStepData } from './StepWiseRulesForm';
import { WorkflowPreview } from './WorkflowPreview';
import { Save, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface WorkflowEditorTabsProps {
    initialTemplate: WorkflowTemplateData;
    initialSteps: WorkflowStepData[];
    departments: { id: string; name: string }[];
    onSave: (template: WorkflowTemplateData, steps: WorkflowStepData[]) => Promise<any>;
    onSuccess?: () => void;
}

export function WorkflowEditorTabs({ initialTemplate, initialSteps, departments, onSave, onSuccess }: WorkflowEditorTabsProps) {
    const { toast } = useToast();
    const [template, setTemplate] = useState<WorkflowTemplateData>(initialTemplate);
    const [steps, setSteps] = useState<WorkflowStepData[]>(initialSteps);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        console.log("[WorkflowEditorTabs] Starting save lifecycle...");

        // Phase 1: Frontend Validation
        if (!template.workflow_name || template.workflow_name.trim() === '') {
            toast({ title: 'Validation Error', description: 'Workflow Name is required.', variant: 'destructive' });
            return;
        }

        if (!steps || steps.length === 0) {
            toast({ title: 'Validation Error', description: 'At least one step is required.', variant: 'destructive' });
            return;
        }

        const orders = new Set<number>();
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (!step.step_name || step.step_name.trim() === '') {
                toast({ title: 'Validation Error', description: `Step ${i + 1} is missing a name.`, variant: 'destructive' });
                return;
            }
            if (orders.has(step.step_order)) {
                toast({ title: 'Validation Error', description: `Duplicate step order detected: ${step.step_order}`, variant: 'destructive' });
                return;
            }
            orders.add(step.step_order);
        }

        // Phase 1: Payload Sanitization
        console.log("[WorkflowEditorTabs] Sanitizing payload...");
        const sanitizedTemplate = {
            ...template,
            common_information_fields: Array.isArray(template.common_information_fields) ? template.common_information_fields : [],
        };
        
        // Strip undefined values from template
        Object.keys(sanitizedTemplate).forEach(key => {
            if ((sanitizedTemplate as any)[key] === undefined) {
                delete (sanitizedTemplate as any)[key];
            }
        });

        const sanitizedSteps = steps.map(s => {
            const cleanStep = {
                ...s,
                custom_fields: Array.isArray(s.custom_fields) ? s.custom_fields : [],
                document_fields: Array.isArray(s.document_fields) ? s.document_fields : [],
                depends_on_step_ids: Array.isArray(s.depends_on_step_ids) ? s.depends_on_step_ids : [],
                step_due_date_rule: typeof s.step_due_date_rule === 'object' && s.step_due_date_rule !== null ? s.step_due_date_rule : {},
                step_finish_date_rule: typeof s.step_finish_date_rule === 'object' && s.step_finish_date_rule !== null ? s.step_finish_date_rule : {},
                audio_enabled: !!s.audio_enabled,
                audio_file_url: s.audio_file_url || '',
                video_enabled: !!s.video_enabled,
                video_url: s.video_url || ''
            };
            Object.keys(cleanStep).forEach(key => {
                if ((cleanStep as any)[key] === undefined) {
                    delete (cleanStep as any)[key];
                }
            });
            return cleanStep;
        });

        try {
            setIsSaving(true);
            console.log("Save started");
            console.log("[WorkflowEditorTabs] Calling onSave prop with sanitized payload...");
            
            const result = await onSave(sanitizedTemplate, sanitizedSteps);
            console.log("Save response", result);

            if (!result?.success || !result?.data?.template) {
                throw new Error(result?.message || "Failed to save workflow");
            }

            setTemplate(result.data.template);
            setSteps(result.data.steps || []);

            toast({ title: 'Success', description: 'Work Type Flow successfully saved.' });
        } catch (error: any) {
            console.error("[WorkflowEditorTabs] onSave prop failed:", error);
            toast({ title: 'Save Failed', description: error.message || 'An error occurred', variant: 'destructive' });
        } finally {
            console.log("Save finished - stopping loader");
            setIsSaving(false);
        }

        try {
            if (onSuccess) {
                await onSuccess();
            }
        } catch (error) {
            console.error("Workflow list refresh failed:", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Workflow Editor</h2>
                    <p className="text-sm text-slate-500">Design and configure advanced workflow rules and steps.</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={handleSave} disabled={isSaving} className="bg-primary shadow-md hover:shadow-lg transition-all">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Work Type Flow
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="common" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-8 bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="common" className="rounded-lg">Common Rules</TabsTrigger>
                    <TabsTrigger value="steps" className="rounded-lg">Step-wise Rules</TabsTrigger>
                    <TabsTrigger value="preview" className="rounded-lg">Preview Flow</TabsTrigger>
                </TabsList>

                <TabsContent value="common" className="mt-0">
                    <div className="bg-white p-6 rounded-xl shadow-sm border animate-in fade-in zoom-in-95 duration-200">
                        <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertTitle>Common Rules</AlertTitle>
                            <AlertDescription>
                                These rules act as the default fallback for the entire workflow. If a specific step does not declare its own rules, it will inherit these.
                            </AlertDescription>
                        </Alert>
                        <CommonRulesForm 
                            data={template} 
                            onChange={setTemplate} 
                            departments={departments}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="steps" className="mt-0">
                    <div className="bg-white p-6 rounded-xl shadow-sm border animate-in fade-in zoom-in-95 duration-200">
                        <Alert className="mb-6 bg-amber-50 border-amber-200 text-amber-800">
                            <Info className="h-4 w-4 text-amber-600" />
                            <AlertTitle>Step-wise Overrides</AlertTitle>
                            <AlertDescription>
                                Configure individual steps. You can override the Common Rules here, attach documents, and require custom information fields.
                            </AlertDescription>
                        </Alert>
                        <StepWiseRulesForm 
                            templateId={template.id} // Added templateId from DB if available
                            steps={steps} 
                            onChange={setSteps} 
                            departments={departments} 
                        />
                    </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-0">
                    <div className="bg-white p-6 rounded-xl shadow-sm border animate-in fade-in zoom-in-95 duration-200">
                        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
                            <Info className="h-4 w-4 text-green-600" />
                            <AlertTitle>Execution Simulation Preview</AlertTitle>
                            <AlertDescription>
                                This is a visual representation of how the workflow will behave when executed. Notice the explicit rule source labels showing how inheritance was resolved.
                            </AlertDescription>
                        </Alert>
                        <WorkflowPreview 
                            data={template} 
                            steps={steps} 
                            departments={departments}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

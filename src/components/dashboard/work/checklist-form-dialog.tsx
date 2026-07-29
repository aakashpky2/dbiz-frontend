
'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, Trash2, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { type WorkType as DeptWorkType } from '@/lib/department-management';
import { type Schedule, type ChecklistItem } from '@/app/dashboard/admin/work-schedules/page';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { type Template } from '@/components/dashboard/settings/template-manager';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const requiredDocSchema = z.object({
    name: z.string().min(1, 'Document name cannot be empty.'),
});

const checklistItemSchema = z.object({
    id: z.string().optional(),
    stepTitle: z.string().min(1, "Step title cannot be empty."),
    instructions: z.string().optional(),
    videoUrl: z.string().url({ message: "Please enter a valid URL." }).or(z.literal("")).optional(),
    requiredDocs: z.array(requiredDocSchema).optional(),
    templateId: z.string().optional(),
});

const checklistFormSchema = z.object({
    workTypeId: z.string(),
    checklist: z.array(checklistItemSchema).optional().default([]),
});

export type ChecklistFormValues = z.infer<typeof checklistFormSchema>;

interface ChecklistFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ChecklistFormValues) => void;
    workType: DeptWorkType;
    existingSchedule?: Schedule | null;
    isSubmitting: boolean;
}

export function ChecklistFormDialog({ isOpen, onOpenChange, onSubmit, workType, existingSchedule, isSubmitting }: ChecklistFormDialogProps) {
    const [templates, setTemplates] = useState<Template[]>([]);

    useEffect(() => {
        supabase.from('pdf_templates').select('*').then(({ data }) => {
            setTemplates((data || []) as any);
        });
    }, []);

    const checklistForm = useForm<ChecklistFormValues>({
        resolver: zodResolver(checklistFormSchema),
        defaultValues: {
            workTypeId: workType.id,
            checklist: existingSchedule?.checklist || [],
        },
    });

    const { control, handleSubmit } = checklistForm;
    const { fields, append, remove, move } = useFieldArray({
        control,
        name: "checklist",
    });

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="border-b p-6 pb-4 shrink-0">
                    <DialogTitle className="text-xl">Define Workflow Steps for: <span className="text-primary">{workType.name}</span></DialogTitle>
                    <DialogDescription>Create a step-by-step guide for users to complete this work, including instructions and required documents.</DialogDescription>
                </DialogHeader>
                
                <Form {...checklistForm}>
                    <form id="checklist-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
                            <div className="space-y-4">
                                {fields.map((item, index) => (
                                    <StepCard key={item.id} index={index} onRemove={() => remove(index)} onMove={move} totalSteps={fields.length} templates={templates} />
                                ))}
                            </div>

                            <Button type="button" variant="outline" size="sm" onClick={() => append({ stepTitle: "", instructions: "", videoUrl: "", requiredDocs: [], templateId: "" })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add New Step
                            </Button>

                        </div>
                        
                        <DialogFooter className="border-t p-6 pt-4 shrink-0 flex gap-2">
                            <DialogClose asChild><Button type="button" variant="ghost" className="flex-1">Cancel</Button></DialogClose>
                            <Button form="checklist-form" type="submit" disabled={isSubmitting} className="flex-1 font-bold">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Workflow
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// Sub-component for each step
function StepCard({ index, onRemove, onMove, totalSteps, templates }: { index: number, onRemove: () => void, onMove: (from: number, to: number) => void, totalSteps: number, templates: Template[] }) {
    const { control } = useFormContext<ChecklistFormValues>();
    const { fields, append, remove } = useFieldArray({
        control,
        name: `checklist.${index}.requiredDocs`,
    });

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-semibold pt-2">Step {index + 1}</h4>
                    <div className="flex items-center">
                        <Button type="button" variant="ghost" size="icon" onClick={() => onMove(index, index - 1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => onMove(index, index + 1)} disabled={index === totalSteps - 1}><ArrowDown className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </div>

                <div className="space-y-4">
                    <FormField control={control} name={`checklist.${index}.stepTitle`} render={({ field }) => (
                        <FormItem><FormLabel>Step Title</FormLabel><FormControl><Input placeholder="e.g., Director KYC Verification" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name={`checklist.${index}.instructions`} render={({ field }) => (
                        <FormItem><FormLabel>Instructions</FormLabel><FormControl><Textarea placeholder="Detailed instructions for the user..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name={`checklist.${index}.videoUrl`} render={({ field }) => (
                        <FormItem><FormLabel>Video Tutorial URL (Optional)</FormLabel><FormControl><Input placeholder="https://youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />

                    <Separator />

                    <div>
                        <FormLabel>Required Documents/Checks</FormLabel>
                        <div className="space-y-2 mt-2">
                            {fields.map((doc, docIndex) => (
                                <div key={doc.id} className="flex items-center gap-2">
                                    <FormField control={control} name={`checklist.${index}.requiredDocs.${docIndex}.name`} render={({ field }) => (
                                        <FormItem className="flex-grow"><FormControl><Input placeholder="e.g., PAN Card, Aadhar Card" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(docIndex)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ name: "" })}><PlusCircle className="mr-2 h-4 w-4" />Add Document</Button>
                    </div>

                    <Separator />

                    <FormField control={control} name={`checklist.${index}.templateId`} render={({ field }) => (
                        <FormItem>
                            <FormLabel>Linked Document Template (Optional)</FormLabel>
                            <Select
                                onValueChange={(value) => field.onChange(value === 'no_template' ? '' : value)}
                                value={field.value || 'no_template'}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a template..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="no_template">None</SelectItem>
                                    {templates.map(template => (
                                        <SelectItem key={template.id} value={template.id}>
                                            {template.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>
    );
}

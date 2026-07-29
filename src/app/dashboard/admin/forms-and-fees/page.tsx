
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormProvider, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2, PlusCircle, Edit, Trash2, FileSpreadsheet, Inbox, Settings, BadgeDollarSign, LayoutTemplate } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { v4 as uuidv4 } from 'uuid'; // Fallback for push key
import { PageSkeleton } from '@/components/ui/page-skeleton';

// --- Data Structures ---

const conditionSchema = z.object({
    parameter: z.string().min(1, "Parameter is required"),
    operator: z.enum(['==', '!=', '>', '<', '>=', '<=']),
    value: z.string().min(1, "Value is required"),
});

const slabSchema = z.object({
    from: z.coerce.number(),
    to: z.coerce.number().optional(),
    fee: z.coerce.number(),
});

const lateFeeSlabSchema = z.object({
    fromDay: z.coerce.number(),
    toDay: z.coerce.number().optional(),
    amount: z.coerce.number(),
});

const progressiveStepSchema = z.object({
    triggerDay: z.coerce.number(),
    amount: z.coerce.number(),
});

const lateFeeSettingsSchema = z.object({
    enabled: z.boolean().default(false),
    type: z.enum(['none', 'daily', 'slab', 'progressive', 'interest']).default('none'),
    dailyAmount: z.coerce.number().optional(),
    slabs: z.array(lateFeeSlabSchema).optional(),
    progressiveSteps: z.array(progressiveStepSchema).optional(),
    interestRate: z.coerce.number().optional(),
    interestPeriod: z.enum(['day', 'month', 'year']).optional(),
}).optional();

const feeStructureSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Fee structure name is required"),
    type: z.enum(['fixed', 'slab']),
    fixedAmount: z.coerce.number().optional(),
    slabBaseParam: z.string().optional(),
    slabs: z.array(slabSchema).optional(),
    conditions: z.array(conditionSchema).optional(),
    lateFee: lateFeeSettingsSchema,
});

const formSchema = z.object({
    name: z.string().min(1, "Form name is required"),
    description: z.string().optional(),
    fees: z.array(feeStructureSchema).optional(),
});

type FeeStructure = z.infer<typeof feeStructureSchema>;
type FormValues = z.infer<typeof formSchema>;
type FormDefinition = FormValues & { id: string };

// --- Main Page Component ---

export default function FormsAndFeesPage() {
    const [forms, setForms] = useState<FormDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<FormDefinition | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [formToDeleteId, setFormToDeleteId] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: '', description: '', fees: [] },
    });

    const fetchForms = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('forms').select('*');
            if (error) throw error;
            const loadedForms: FormDefinition[] = data ? data.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                fees: item.fees || []
            })) : [];
            setForms(loadedForms);
        } catch (error: any) {
            console.error(error);
            toast({ title: "Error", description: "Failed to load forms.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchForms();
    }, [fetchForms]);

    const openAddDialog = useCallback(() => {
        form.reset({ name: '', description: '', fees: [] });
        setEditingForm(null);
        setIsFormOpen(true);
    }, [form]);

    const openEditDialog = useCallback((formDef: FormDefinition) => {
        form.reset(formDef);
        setEditingForm(formDef);
        setIsFormOpen(true);
    }, [form]);

    const handleDeleteClick = useCallback((id: string) => {
        setFormToDeleteId(id);
        setShowDeleteConfirm(true);
    }, []);

    const executeDelete = useCallback(async () => {
        if (!formToDeleteId) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('forms').delete().eq('id', formToDeleteId);
            if (error) throw error;
            await fetchForms();
            toast({ title: "Form Deleted" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            setShowDeleteConfirm(false);
        }
    }, [formToDeleteId, fetchForms, toast]);

    const handleSaveForm = useCallback(async (data: FormValues) => {
        setIsSubmitting(true);
        const dataToSave = {
            name: data.name,
            description: data.description,
            fees: (data.fees || []).map(fee => ({ ...fee, id: fee.id || crypto.randomUUID() })),
        };

        try {
            if (editingForm) {
                const { error } = await supabase.from('forms').update(dataToSave).eq('id', editingForm.id);
                if (error) throw error;
                await fetchForms();
                toast({ title: "Form Updated" });
                setIsFormOpen(false);
            } else {
                const { data: savedData, error } = await supabase.from('forms').insert([dataToSave]).select().single();
                if (error) throw error;
                toast({ title: "Form Created" });
                setIsFormOpen(false);
                if (savedData) {
                    router.push(`/dashboard/admin/forms-and-fees/${savedData.id}/builder`);
                }
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }, [editingForm, fetchForms, router, toast]);

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-500">
            <DashboardPageHeader
                title="Forms & Fees"
                description="Define official forms and their associated dynamic government fees."
            >
                <Button onClick={openAddDialog} className="font-bold">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Form
                </Button>
            </DashboardPageHeader>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    {isLoading ? (<div className="p-6"><PageSkeleton /></div>) : forms.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-card text-muted-foreground">
                            <Inbox className="mx-auto h-12 w-12 opacity-20" />
                            <p className="mt-4 font-semibold">No forms found.</p>
                            <Button variant="ghost" className="mt-2" onClick={openAddDialog}>Create your first form</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {forms.map(formDef => (
                                <Card key={formDef.id} className="group hover:shadow-md transition-all duration-300 border-slate-200/60 overflow-hidden flex flex-col h-full bg-card">
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-start">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                                                <FileSpreadsheet className="h-5 w-5" />
                                            </div>
                                            <Badge variant="secondary" className="font-normal text-xs">
                                                {formDef.fees?.length || 0} Fees
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-lg mt-3 group-hover:text-primary transition-colors">{formDef.name}</CardTitle>
                                        <CardDescription className="line-clamp-2">{formDef.description || 'No description provided.'}</CardDescription>
                                    </CardHeader>
                                    <div className="mt-auto p-6 pt-0 flex items-center gap-2 border-t bg-slate-50/50 dark:bg-slate-900/50">
                                        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => router.push(`/dashboard/admin/forms-and-fees/${formDef.id}/builder`)}>
                                            <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />Builder
                                        </Button>
                                        <Separator orientation="vertical" className="h-4" />
                                        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => openEditDialog(formDef)}>
                                            <Edit className="h-3.5 w-3.5 mr-1.5" />Edit
                                        </Button>
                                        <Separator orientation="vertical" className="h-4" />
                                        <Button variant="ghost" size="sm" className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(formDef.id)}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 rounded-xl shadow-2xl border-border/60">
                    <DialogHeader className="px-6 py-5 border-b bg-muted/20">
                        <DialogTitle className="text-xl flex items-center gap-2 font-semibold">
                            {editingForm ? <Edit className="w-5 h-5 text-primary" /> : <PlusCircle className="w-5 h-5 text-primary" />}
                            {editingForm ? `Editing "${editingForm.name}"` : 'Adding New Form'}
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-1.5">
                            {editingForm ? 'Update the details of this item.' : 'Enter the details for Form.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-grow overflow-y-auto px-6 py-6 custom-scrollbar">
                        <FormProvider {...form}>
                            <Form {...form}>
                                <form id="form-fees-form" onSubmit={form.handleSubmit(handleSaveForm)} className="space-y-8">
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <FormField control={form.control} name="name" render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel className="text-sm font-semibold text-foreground/90">Form Name <span className="text-destructive">*</span></FormLabel>
                                                <FormControl><Input className="bg-background transition-shadow focus-visible:ring-primary/30" placeholder="e.g., Building Permit Application" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="description" render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel className="text-sm font-semibold text-foreground/90">Description</FormLabel>
                                                <FormControl><Textarea className="bg-background resize-none min-h-[80px] transition-shadow focus-visible:ring-primary/30" placeholder="Briefly describe the purpose of this form..." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <div className="space-y-5">
                                        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                                            <BadgeDollarSign className="w-5 h-5 text-primary shrink-0" />
                                            <div>
                                                <h3 className="text-lg font-semibold tracking-tight leading-none mb-1.5">Fee Structures</h3>
                                                <p className="text-sm text-muted-foreground leading-none">Define calculation methods that apply to this form based on various parameters.</p>
                                            </div>
                                        </div>
                                        <FeeStructureSection />
                                    </div>
                                </form>
                            </Form>
                        </FormProvider>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t bg-muted/10 mt-auto flex-col sm:flex-row gap-3 sm:gap-0">
                        <div className="flex justify-end gap-3 w-full">
                            <DialogClose asChild><Button type="button" variant="outline" className="w-24">Cancel</Button></DialogClose>
                            <Button type="submit" form="form-fees-form" disabled={isSubmitting} className="min-w-[130px] shadow-sm">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                                {editingForm ? 'Save Changes' : 'Create Form'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

 
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action will permanently delete this form and all its fee structures.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


// --- Fee Structure Section ---
const FeeStructureSection = () => {
    const { control, watch } = useFormContext<FormValues>();
    const { fields, append, remove } = useFieldArray({ control, name: "fees" });
    const watchedFees = watch("fees") || [];

    return (
        <div className="space-y-4">
            {fields.map((field, index) => (
                <Accordion key={field.id} type="single" collapsible defaultValue="item-0" className="w-full">
                    <AccordionItem value={`item-${index}`} className="border border-border/60 rounded-lg bg-card shadow-sm overflow-hidden data-[state=open]:ring-1 data-[state=open]:ring-primary/20 transition-all">
                        <AccordionTrigger className="px-5 py-3 hover:bg-muted/30 hover:no-underline transition-colors data-[state=open]:bg-muted/20 data-[state=open]:border-b">
                            <div className="flex items-center gap-3 text-left w-full pr-4">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                                    <span className="text-xs font-bold">{index + 1}</span>
                                </div>
                                <span className="font-semibold text-[15px] flex-1 truncate">{watchedFees[index]?.name || `Fee Structure ${index + 1}`}</span>
                                <Badge variant="secondary" className="ml-auto font-normal text-xs px-2 py-0.5 whitespace-nowrap hidden sm:inline-flex">
                                    {(watchedFees[index]?.type === 'fixed' ? 'Fixed Fee' : 'Slab Fee')}
                                </Badge>

                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-0">
                            <div className="px-5 py-5 bg-muted/5">
                                <FeeStructureCard index={index} onRemove={() => remove(index)} />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            ))}

            {fields.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed rounded-lg border-muted-foreground/20 bg-muted/5">
                    <BadgeDollarSign className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-[15px] font-medium text-foreground">No fee structures defined</p>
                    <p className="text-sm text-muted-foreground mt-1.5 mb-5 max-w-sm mx-auto">Click below to add a fee structure to dictate how costs are calculated for this form.</p>
                </div>
            )}

            <Button
                type="button"
                variant="outline"
                className="w-full border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors py-6 shadow-sm"
                onClick={() => append({ type: 'fixed', name: `Fee Structure ${fields.length + 1}`, slabs: [], conditions: [], lateFee: { enabled: false, type: 'none', slabs: [], progressiveSteps: [] } })}
            >
                <PlusCircle className="mr-2 h-5 w-5 opacity-70" />
                <span className="font-semibold">Add Fee Structure</span>
            </Button>
        </div>
    );
}

// --- Individual Fee Structure Card ---
const FeeStructureCard: React.FC<{ index: number; onRemove: () => void }> = ({ index, onRemove }) => {
    const { control, watch } = useFormContext<FormValues>();
    const feeType = watch(`fees.${index}.type`);
    const { fields: slabFields, append: appendSlab, remove: removeSlab } = useFieldArray({ control, name: `fees.${index}.slabs` });
    const { fields: conditionFields, append: appendCondition, remove: removeCondition } = useFieldArray({ control, name: `fees.${index}.conditions` });

    // Late Fee specific
    const lateFeeEnabled = watch(`fees.${index}.lateFee.enabled`);
    const lateFeeType = watch(`fees.${index}.lateFee.type`);
    const { fields: lateFeeSlabs, append: appendLateFeeSlab, remove: removeLateFeeSlab } = useFieldArray({ control, name: `fees.${index}.lateFee.slabs` });
    const { fields: progressiveSteps, append: appendProgressiveStep, remove: removeProgressiveStep } = useFieldArray({ control, name: `fees.${index}.lateFee.progressiveSteps` });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground/90">Structure Configuration</h4>
                <Button type="button" size="sm" variant="destructive" onClick={onRemove} className="h-8 shadow-sm">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remove
                </Button>
            </div>

            <div className="grid gap-6">
                <FormField control={control} name={`fees.${index}.name`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-sm font-semibold">Fee Structure Name</FormLabel>
                        <FormControl><Input className="bg-background" {...field} value={field.value ?? ''} placeholder="e.g., Standard Fee, High Value Fee" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <Separator className="bg-border/60" />

                <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-foreground/90">Application Conditions</h4>
                    <p className="text-xs text-muted-foreground mt-0">Specify when this structure applies based on form inputs.</p>

                    <div className="space-y-3 mt-2">
                        {conditionFields.map((field, cIndex) => (
                            <div key={field.id} className="grid grid-cols-[1fr_80px_1fr_auto] gap-2 items-start bg-background p-2 rounded-md border border-border/50 shadow-sm">
                                <FormField control={control} name={`fees.${index}.conditions.${cIndex}.parameter`} render={({ field }) => (<FormItem><FormControl><Input {...field} value={field.value ?? ''} placeholder="Parameter (e.g., capital)" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`fees.${index}.conditions.${cIndex}.operator`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{['==', '!=', '>', '<', '>=', '<='].map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`fees.${index}.conditions.${cIndex}.value`} render={({ field }) => (<FormItem><FormControl><Input {...field} value={field.value ?? ''} placeholder="Value (e.g., 'Category A')" /></FormControl><FormMessage /></FormItem>)} />
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive mt-0.5 hover:bg-destructive/10" onClick={() => removeCondition(cIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="mt-2 h-8 text-xs border-dashed" onClick={() => appendCondition({ parameter: '', operator: '==', value: '' })}>
                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />Add Condition
                    </Button>
                </div>

                <Separator className="bg-border/60" />

                <div className="space-y-4">
                    <FormField control={control} name={`fees.${index}.type`} render={({ field }) => (
                        <FormItem className="w-full md:max-w-xs">
                            <FormLabel className="text-sm font-semibold">Calculation Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="fixed">Fixed Amount</SelectItem><SelectItem value="slab">Slab-based (Dynamic)</SelectItem></SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />

                    {feeType === 'fixed' && (
                        <div className="p-4 rounded-lg bg-background border border-border/50 shadow-sm md:max-w-xs">
                            <FormField control={control} name={`fees.${index}.fixedAmount`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold">Fixed Fee Amount (₹)</FormLabel>
                                    <FormControl><Input className="font-mono" type="number" {...field} value={field.value ?? ''} placeholder="0.00" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    )}

                    {feeType === 'slab' && (
                        <div className="space-y-4 p-5 bg-background border border-border/50 rounded-lg shadow-sm">
                            <FormField control={control} name={`fees.${index}.slabBaseParam`} render={({ field }) => (
                                <FormItem className="md:max-w-xs">
                                    <FormLabel className="text-sm font-semibold">Slab Variable Parameter</FormLabel>
                                    <FormControl><Input placeholder="e.g., project_cost" {...field} value={field.value ?? ''} /></FormControl>
                                    <p className="text-[11px] text-muted-foreground mt-1">The system key from the builder that dictates the tier.</p>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="space-y-3 mt-4">
                                <label className="text-sm font-semibold text-foreground/90">Defined Tiers</label>
                                {slabFields.map((slab, sIndex) => (
                                    <div key={slab.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-start relative group pl-3 py-1">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-border/50 rounded-full group-hover:bg-primary/50 transition-colors" />
                                        <FormField control={control} name={`fees.${index}.slabs.${sIndex}.from`} render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] text-muted-foreground uppercase py-0 leading-none mb-1 shadow-none">From Value</FormLabel><FormControl><Input className="h-8 text-sm" type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name={`fees.${index}.slabs.${sIndex}.to`} render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] text-muted-foreground uppercase py-0 leading-none mb-1 shadow-none">To Value</FormLabel><FormControl><Input className="h-8 text-sm" type="number" placeholder="∞" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name={`fees.${index}.slabs.${sIndex}.fee`} render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] text-muted-foreground uppercase py-0 leading-none mb-1 shadow-none">Fee Amount (₹)</FormLabel><FormControl><Input className="h-8 text-sm font-mono text-primary font-medium" type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive self-end mt-4 opacity-50 hover:opacity-100 hover:bg-destructive/10" onClick={() => removeSlab(sIndex)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-xs border-dashed w-full sm:w-auto" onClick={() => appendSlab({ from: 0, to: undefined, fee: 0 })}>
                                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" />Add New Slab Tier
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <Separator className="bg-border/60" />

                {/* Late Fee Settings */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-sm text-foreground/90">Late Fee Configuration</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">Apply automatic penalties when payment is delayed past the due date.</p>
                        </div>
                        <FormField control={control} name={`fees.${index}.lateFee.enabled`} render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                                <FormLabel className="text-xs font-semibold cursor-pointer">Late Fee Enabled</FormLabel>
                                <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                    </div>

                    {lateFeeEnabled && (
                        <div className="p-5 rounded-lg bg-background border border-border/50 shadow-sm space-y-5">
                            <FormField control={control} name={`fees.${index}.lateFee.type`} render={({ field }) => (
                                <FormItem className="w-full md:max-w-xs">
                                    <FormLabel className="text-sm font-semibold">Late Fee Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                                        <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">No Late Fee</SelectItem>
                                            <SelectItem value="daily">Per Day Late Fee (Fixed)</SelectItem>
                                            <SelectItem value="slab">Slab-Based Late Fee</SelectItem>
                                            <SelectItem value="progressive">Progressive Late Fee</SelectItem>
                                            <SelectItem value="interest">Interest-Based Late Fee</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {lateFeeType === 'daily' && (
                                <FormField control={control} name={`fees.${index}.lateFee.dailyAmount`} render={({ field }) => (
                                    <FormItem className="md:max-w-xs">
                                        <FormLabel className="text-sm font-semibold">Late Fee Amount Per Day (₹)</FormLabel>
                                        <FormControl><Input className="font-mono text-sm" type="number" {...field} value={field.value ?? ''} placeholder="0.00" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}

                            {lateFeeType === 'slab' && (
                                <div className="space-y-3 pt-2">
                                    <label className="text-sm font-semibold text-foreground/90">Late Fee Slabs</label>
                                    <div className="bg-muted/5 p-4 rounded-lg border border-dashed">
                                        {lateFeeSlabs.map((slab, lIndex) => (
                                            <div key={slab.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-start relative group py-1 border-b last:border-0 border-border/40 pb-3 mb-3 last:pb-1 last:mb-1">
                                                <FormField control={control} name={`fees.${index}.lateFee.slabs.${lIndex}.fromDay`} render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[11px] text-muted-foreground uppercase leading-none mb-1 shadow-none">From Day</FormLabel><FormControl><Input className="h-8 text-sm" type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={control} name={`fees.${index}.lateFee.slabs.${lIndex}.toDay`} render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[11px] text-muted-foreground uppercase leading-none mb-1 shadow-none">To Day</FormLabel><FormControl><Input className="h-8 text-sm" type="number" placeholder="∞" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={control} name={`fees.${index}.lateFee.slabs.${lIndex}.amount`} render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[11px] text-muted-foreground uppercase leading-none mb-1 shadow-none">Fee Amount (₹)</FormLabel><FormControl><Input className="h-8 text-sm font-mono text-primary font-medium" type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive self-end mt-4 opacity-50 hover:opacity-100 hover:bg-destructive/10" onClick={() => removeLateFeeSlab(lIndex)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" className="mt-2 h-8 text-xs border-dashed bg-background w-full sm:w-auto" onClick={() => appendLateFeeSlab({ fromDay: 1, toDay: undefined, amount: 0 })}>
                                            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />Add Late Fee Slab
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {lateFeeType === 'progressive' && (
                                <div className="space-y-3 pt-2">
                                    <label className="text-sm font-semibold text-foreground/90">Progressive Steps</label>
                                    <div className="bg-muted/5 p-4 rounded-lg border border-dashed">
                                        {progressiveSteps.map((step, pIndex) => (
                                            <div key={step.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-start relative group py-1 border-b last:border-0 border-border/40 pb-3 mb-3 last:pb-1 last:mb-1">
                                                <FormField control={control} name={`fees.${index}.lateFee.progressiveSteps.${pIndex}.triggerDay`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[11px] text-muted-foreground uppercase leading-none mb-1 shadow-none">After Days (Trigger)</FormLabel>
                                                        <FormControl><Input className="h-8 text-sm" type="number" {...field} value={field.value ?? ''} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={control} name={`fees.${index}.lateFee.progressiveSteps.${pIndex}.amount`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[11px] text-muted-foreground uppercase leading-none mb-1 shadow-none">Fee Amount (₹)</FormLabel>
                                                        <FormControl><Input className="h-8 text-sm font-mono text-primary font-medium" type="number" {...field} value={field.value ?? ''} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive self-end mt-4 opacity-50 hover:opacity-100 hover:bg-destructive/10" onClick={() => removeProgressiveStep(pIndex)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" className="mt-2 h-8 text-xs border-dashed bg-background w-full sm:w-auto" onClick={() => appendProgressiveStep({ triggerDay: 0, amount: 0 })}>
                                            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />Add Progressive Step
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {lateFeeType === 'interest' && (
                                <div className="grid grid-cols-2 gap-4 md:max-w-md border bg-muted/5 border-dashed p-4 rounded-lg">
                                    <FormField control={control} name={`fees.${index}.lateFee.interestRate`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-semibold">Interest Rate (%)</FormLabel>
                                            <FormControl><Input className="font-mono text-sm bg-background" type="number" {...field} value={field.value ?? ''} placeholder="2.0" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name={`fees.${index}.lateFee.interestPeriod`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-semibold">Interest Period</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value || 'month'}>
                                                <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Period" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="day">Per Day</SelectItem>
                                                    <SelectItem value="month">Per Month</SelectItem>
                                                    <SelectItem value="year">Per Year</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

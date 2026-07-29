
'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
    Plus, 
    PlusCircle,
    Loader2, 
    Briefcase, 
    Building2, 
    Building,
    User, 
    Info,
    CheckCircle2
} from 'lucide-react';
import { ProposalServicesPricingSection } from './ProposalServicesPricingSection';
import { Badge } from '@/components/ui/badge';
import { useProfiles } from '@/hooks/use-profiles';
import { listenToDepartments, type Department, type WorkType } from '@/lib/department-management';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

// Reuse schemas from ProposalDialog or define simplified ones
const proposalItemSchema = z.object({
    id: z.string().optional(),
    workTypeId: z.string().optional(), // More lenient to avoid blocking handleSubmit
    workTypeName: z.string().optional(),
    departmentName: z.string().optional(),
    categoryName: z.string().optional(),
    professionalFee: z.number().optional(),
    governmentFee: z.number().optional(),
    totalAmount: z.number().optional(),
    isGstApplicable: z.boolean().optional(),
    gstPercentage: z.number().optional(),
    gstAppliedOn: z.enum(['professional', 'government', 'both']).optional(),
    noInvoice: z.boolean().optional().default(false),
    gstAmount: z.number().optional()
});

const addMoreWorkSchema = z.object({
    proposalItems: z.array(proposalItemSchema).min(1, "At least one service is required."),
});

type AddMoreWorkValues = z.infer<typeof addMoreWorkSchema>;

interface AddMoreWorkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    proposal: any;
    onSuccess: () => void;
}

export const AddMoreWorkDialog: React.FC<AddMoreWorkDialogProps> = ({
    open,
    onOpenChange,
    proposal,
    onSuccess
}) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { profiles } = useProfiles();
    
    const [masterWorkTypes, setMasterWorkTypes] = useState<WorkType[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [existingItemsCount, setExistingItemsCount] = useState(0);

    const enquiryWorkItems = proposal?.query?.workItems || proposal?.workItems || [];
    const originalItemIds = new Set((proposal?.proposedWork || proposal?.proposalItems || []).map((i: any) => i.workTypeId));
    const pendingEnquiryPool = enquiryWorkItems.filter((eqItem: any) => !originalItemIds.has(eqItem.workTypeId));

    const isServiceInProposal = (workTypeId: string) => {
        return workFields.some(f => f.workTypeId === workTypeId);
    };

    const toggleEnquiryService = (service: any) => {
        const existingIdx = workFields.findIndex(f => f.workTypeId === service.workTypeId);
        if (existingIdx >= 0) {
            if (existingIdx >= existingItemsCount) {
                removeWork(existingIdx);
            } else {
                toast({ title: "Restricted", description: "Original services cannot be removed.", variant: "destructive" });
            }
        } else {
            appendWork({
                workTypeId: service.workTypeId,
                workTypeName: service.workTypeName,
                departmentName: service.departmentName,
                categoryName: service.categoryName,
                professionalFee: Number(service.professionalFees || service.professionalFee || 0),
                governmentFee: Number(service.govtFees || service.governmentFee || 0),
                isGstApplicable: true,
                gstPercentage: 18,
                gstAppliedOn: 'professional',
                noInvoice: false,
                totalAmount: Number(service.amount || service.totalAmount || 0)
            });
        }
    };

    const form = useForm<AddMoreWorkValues>({
        resolver: zodResolver(addMoreWorkSchema),
        defaultValues: {
            proposalItems: []
        },
    });

    const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({
        control: form.control,
        name: "proposalItems"
    });

    // Hydrate existing items
    useEffect(() => {
        if (open && proposal) {
            const items = proposal.proposedWork || proposal.proposalItems || [];
            const mappedItems = items.map((item: any) => ({
                workTypeId: item.workTypeId || '',
                workTypeName: item.workTypeName || '',
                departmentName: item.departmentName || '',
                categoryName: item.categoryName || '',
                professionalFee: Number(item.professionalFee) || 0,
                governmentFee: Number(item.governmentFee) || 0,
                totalAmount: Number(item.totalAmount) || 0,
                isGstApplicable: item.isGstApplicable ?? true,
                gstPercentage: item.gstPercentage ?? 18,
                gstAppliedOn: item.gstAppliedOn || item.gstTarget || 'professional',
                noInvoice: item.noInvoice ?? false,
                gstAmount: item.gstAmount ?? 0
            }));
            
            form.reset({ proposalItems: mappedItems });
            setExistingItemsCount(mappedItems.length);
        }
    }, [open, proposal, form]);

    // Fetch master data
    useEffect(() => {
        if (!open) return;
        const unsubscribe = listenToDepartments((deps) => {
            const allTypes: WorkType[] = [];
            const deptNames = deps.map(d => d.name);
            deps.forEach(dept => {
                const categories = dept.workCategories || [];
                categories.forEach((cat: any) => {
                    const workTypes = cat.workTypes || [];
                    workTypes.forEach((wt: any) => {
                        allTypes.push({
                            id: wt.id,
                            name: wt.name,
                            departmentName: dept.name,
                            categoryName: cat.name,
                            description: wt.description,
                            warningNote: wt.warning_note || wt.warningNote
                        } as any);
                    });
                });
            });
            setMasterWorkTypes(allTypes.sort((a, b) => a.name.localeCompare(b.name)));
            setDepartments(deptNames);
        });
        return () => unsubscribe();
    }, [open]);

    const onSubmit = async (data: AddMoreWorkValues) => {

        
        const newItems = data.proposalItems.slice(existingItemsCount);

        
        // Manual validation for new items only
        if (newItems.length === 0) {
            toast({ 
                title: "No New Services", 
                description: "Please add at least one new service to update the proposal.", 
                variant: "destructive" 
            });
            return;
        }

        for (const item of newItems) {
            if (!item.workTypeId) {
                toast({ title: "Validation Error", description: "All new services must have a work type selected.", variant: "destructive" });
                return;
            }
            if (Number(item.professionalFee) < 0) {
                toast({ title: "Validation Error", description: "Professional fee cannot be negative.", variant: "destructive" });
                return;
            }
            if (Number(item.governmentFee) < 0) {
                toast({ title: "Validation Error", description: "Government fee cannot be negative.", variant: "destructive" });
                return;
            }
        }

        if (isSubmitting) return;
        setIsSubmitting(true);

        try {

            const res = await fetch(`/api/proposals/${proposal.id}/workflow`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_work',
                    payload: { proposedWork: newItems },
                    performer: { id: user?.uid, name: user?.displayName || user?.email || 'System' }
                })
            });



            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to add more work');
            }

            toast({ 
                title: 'Success', 
                description: 'More services added to the proposal successfully.',
                className: "bg-emerald-600 text-white border-none"
            });
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const onFormError = (errors: any) => {

        const firstError = Object.values(errors)[0] as any;
        const errorMessage = firstError?.message || "Please check the form for errors.";
        toast({ 
            title: "Form Error", 
            description: errorMessage, 
            variant: "destructive" 
        });
    };

    if (!proposal) return null;

    const clientName = proposal.client_name || proposal.clientName || proposal.client?.client_name || 'Client';
    const profile = profiles.find(p => p.id === proposal.profileId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1000px] p-0 border-none shadow-2xl rounded-3xl overflow-hidden bg-slate-50">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="bg-white px-8 py-6 border-b border-slate-100 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                                        <PlusCircle className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800">Add Services</DialogTitle>
                                        <DialogDescription className="text-slate-500 font-medium">
                                            Append new services to the proposal.
                                        </DialogDescription>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-bold px-3 py-1">
                                        Proposal #{proposal.id?.slice(-6).toUpperCase()}
                                    </Badge>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Version {proposal.version || '1.0'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            
                            {/* Summary / Read-only details */}
                            <div className="grid grid-cols-3 gap-6 p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client / Entity</Label>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-slate-400" />
                                        <span className="font-bold text-sm text-slate-700">{clientName}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Professional Profile</Label>
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-slate-400" />
                                        <span className="font-bold text-sm text-slate-700">{profile?.profileName || 'Default Profile'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</Label>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        <span className="font-black text-[10px] uppercase tracking-widest text-emerald-600 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
                                            {proposal.current_stage || proposal.status || 'Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Remaining Services from Enquiry */}
                            {pendingEnquiryPool.length > 0 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500 bg-amber-50/30 p-5 rounded-3xl border border-amber-100 border-dashed">
                                    <div className="flex items-center gap-2 px-1">
                                        <Briefcase className="h-4 w-4 text-amber-500" />
                                        <h5 className="text-[11px] font-black uppercase tracking-widest text-amber-700">Pending services from enquiry</h5>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {pendingEnquiryPool.map((service: any, idx: number) => {
                                            const isChecked = isServiceInProposal(service.workTypeId);
                                            return (
                                                <div key={idx} 
                                                    className={cn(
                                                        "flex items-center gap-3 p-3.5 bg-white border rounded-2xl transition-all cursor-pointer select-none",
                                                        isChecked ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-100 hover:border-amber-200"
                                                    )}
                                                    onClick={() => toggleEnquiryService(service)}
                                                >
                                                    <Checkbox 
                                                        checked={isChecked}
                                                        onCheckedChange={() => toggleEnquiryService(service)}
                                                        className="h-5 w-5 rounded-lg border-2 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                                    />
                                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                                        <span className="text-[11px] font-black text-slate-700 truncate uppercase tracking-tight">{service.workTypeName}</span>
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">{service.departmentName}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Services & Pricing Section */}
                            <ProposalServicesPricingSection 
                                form={form}
                                fieldName="proposalItems"
                                workFields={workFields}
                                appendWork={appendWork}
                                removeWork={(idx) => {
                                    if (idx < existingItemsCount) {
                                        toast({ title: "Restricted", description: "Existing services cannot be removed in this mode.", variant: "destructive" });
                                        return;
                                    }
                                    removeWork(idx);
                                }}
                                masterWorkTypes={masterWorkTypes}
                                departments={departments}
                                isClientResolved={true}
                                isDraftReview={false} // Strict locking for existing items
                                lockedItemsCount={existingItemsCount}
                                clientId={proposal.clientId || proposal.client_id}
                                associateId={proposal.associateId || proposal.associate_id}
                                profileId={proposal.profileId || proposal.business_profile_id}
                                clientType={proposal.clientType || (proposal.reference === 'Associate' || proposal.associateId ? 'associate' : 'direct')}
                            />

                            {/* Total Summary */}
                            <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                                        <Briefcase className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consolidated Proposal Value</p>
                                        <p className="text-sm font-medium text-slate-300">Total after adding {workFields.length - existingItemsCount} new services</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black tracking-tight">
                                        ₹{workFields.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inc. all taxes & fees</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-white px-8 py-6 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Info className="h-4 w-4" />
                                <span className="text-xs font-medium">Saving will update the proposal and increment the version.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => onOpenChange(false)}
                                    className="h-12 px-6 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit"
                                    disabled={isSubmitting || workFields.length === existingItemsCount}
                                    className="h-12 px-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200 transition-all active:scale-95"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                                    Confirm & Add Services
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

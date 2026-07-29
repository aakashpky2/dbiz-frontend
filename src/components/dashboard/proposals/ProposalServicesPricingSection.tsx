'use client';

import React, { useState, useMemo } from 'react';
import { 
    Briefcase, 
    Filter, 
    PlusCircle, 
    Check, 
    ChevronsUpDown, 
    Trash2, 
    IndianRupee, 
    Percent, 
    AlertCircle, 
    Info,
    Loader2
} from 'lucide-react';
import { calculateProposalFinancials } from '@/lib/proposal-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { useWatch } from 'react-hook-form';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { GovernmentFeeInputs } from '../shared/GovernmentFeeInputs';
import { useRateSuggestions } from '@/hooks/useRateSuggestions';

interface ProposalServicesPricingSectionProps {
    form: any;
    workFields: any[];
    appendWork: (data: any) => void;
    removeWork: (idx: number) => void;
    masterWorkTypes: any[];
    departments: string[];
    isClientResolved?: boolean;
    readOnly?: boolean;
    fieldName?: string;
    isPendingFlow?: boolean;
    selectedIndexes?: Set<number>;
    onToggleIndex?: (idx: number) => void;
    isDraftReview?: boolean;
    noInvoice?: boolean;
    lockedItemsCount?: number;
    showDiscount?: boolean;
    discountType?: 'amount' | 'percentage';
    discountValue?: number;
    discountAmount?: number;
    totalBeforeDiscount?: number;
    finalTotal?: number;
    // Context for rate suggestions
    clientId?: string | null;
    associateId?: string | null;
    profileId?: string | null;
    clientType?: string | null;
    hasGST?: boolean;
}

export const ProposalServicesPricingSection: React.FC<ProposalServicesPricingSectionProps> = ({
    form,
    workFields,
    appendWork,
    removeWork,
    masterWorkTypes,
    departments,
    isClientResolved = true,
    readOnly = false,
    fieldName = 'proposalItems',
    isPendingFlow = false,
    selectedIndexes = new Set(),
    onToggleIndex,
    isDraftReview = false,
    noInvoice = false,
    lockedItemsCount = 0,
    showDiscount = false,
    discountType = 'amount',
    discountValue = 0,
    discountAmount = 0,
    totalBeforeDiscount = 0,
    finalTotal = 0,
    clientId = null,
    associateId = null,
    profileId = null,
    clientType = null,
    hasGST = true
}) => {
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [workTypeSearch, setWorkTypeSearch] = useState('');
    const [workTypePopoverOpen, setWorkTypePopoverOpen] = useState(false);

    const filteredWorkTypes = useMemo(() => {
        return masterWorkTypes.filter(wt => {
            const matchesDept = selectedDepartment === 'all' || wt.departmentName === selectedDepartment;
            const matchesSearch = !workTypeSearch || 
                wt.name.toLowerCase().includes(workTypeSearch.toLowerCase()) ||
                wt.departmentName?.toLowerCase().includes(workTypeSearch.toLowerCase()) ||
                wt.categoryName?.toLowerCase().includes(workTypeSearch.toLowerCase());
            return matchesDept && matchesSearch;
        });
    }, [masterWorkTypes, selectedDepartment, workTypeSearch]);

    const watchedItems = form.watch(fieldName);
    
    // Financial calculations
    const financials = useMemo(() => {
        return calculateProposalFinancials(watchedItems || []);
    }, [watchedItems]);

    if (!isClientResolved) return null;

    return (
        <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <span className="h-5 w-5 rounded-md bg-blue-100 flex items-center justify-center text-[9px] font-black text-blue-600 border border-blue-200">S</span>
                        <h4 className="text-[13px] font-bold text-slate-800 uppercase tracking-[0.3em]">Services & Pricing</h4>
                    </div>

                </div>
                
                <Badge variant="outline" className="text-[11px] font-bold uppercase text-blue-600 bg-blue-50 border-blue-100 h-5 px-2">
                    {workFields.length} Service{workFields.length !== 1 ? 's' : ''} Added
                </Badge>
            </div>

            {(!readOnly && !isDraftReview) && (
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 pl-1">Add Services</h4>
                    <div className="flex flex-col md:flex-row gap-2">
                        <div className="w-full md:w-52 shrink-0">
                            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                <SelectTrigger className="h-11 rounded-xl border-slate-400 bg-white font-bold text-sm hover:bg-blue-50 transition-all">
                                    <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground/50 shrink-0" /><SelectValue placeholder="All Departments" /></div>
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-none p-1 z-[100]">
                                    <SelectItem value="all" className="rounded-xl py-2.5 font-bold">All Departments</SelectItem>
                                    {departments.map(d => <SelectItem key={d} value={d} className="rounded-xl py-2.5 font-bold">{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <Popover open={workTypePopoverOpen} onOpenChange={setWorkTypePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full h-11 justify-between rounded-xl border-slate-400 bg-white font-bold text-sm hover:bg-blue-50 transition-all">
                                        <span className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4 text-blue-600 shrink-0" />Select a service to add...</span>
                                        <ChevronsUpDown className="h-4 w-4 opacity-40" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-2xl border border-slate-200 z-[110] bg-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200" align="start" sideOffset={4} collisionPadding={20}>
                                    <Command shouldFilter={false}>
                                        <CommandInput placeholder="Search services..." className="h-11 border-none focus:ring-0" onValueChange={setWorkTypeSearch} />
                                        <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                            <CommandEmpty>No services found.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredWorkTypes.map(wt => {
                                                    const alreadyAdded = workFields.some(f => f.workTypeId === wt.id);
                                                    return (
                                                        <CommandItem key={wt.id} value={`${wt.name} ${wt.departmentName}`} disabled={alreadyAdded}
                                                            onSelect={() => {
                                                                if (alreadyAdded) return;
                                                                console.log("[ProposalServicesPricingSection] selected service before add:", wt);
                                                                console.log("[ProposalServicesPricingSection] selected service warning fields:", {
                                                                  warning_note: wt.warning_note,
                                                                  warningNote: wt.warningNote,
                                                                  warning: wt.warning,
                                                                  warning_flow_note: wt.warning_flow_note,
                                                                  flowNote: wt.flowNote,
                                                                });

                                                                const newServiceItem = { 
                                                                    workTypeId: wt.id, 
                                                                    workTypeName: wt.name, 
                                                                    departmentName: wt.departmentName, 
                                                                    categoryName: wt.categoryName, 
                                                                    warningNote: wt.warningNote,
                                                                    professionalFee: 0, 
                                                                    governmentFee: 0, 
                                                                    isGstApplicable: true,
                                                                    gstPercentage: 18,
                                                                    gstAppliedOn: 'professional',
                                                                    noInvoice: false,
                                                                    manualRate: true
                                                                };

                                                                console.log("[ProposalServicesPricingSection] mapped proposal item:", newServiceItem);
                                                                console.log("[ProposalServicesPricingSection] mapped warning fields:", {
                                                                  warning_note: (newServiceItem as any).warning_note,
                                                                  warningNote: newServiceItem.warningNote,
                                                                  warning: (newServiceItem as any).warning,
                                                                  warning_flow_note: (newServiceItem as any).warning_flow_note,
                                                                  flowNote: (newServiceItem as any).flowNote,
                                                                });

                                                                appendWork(newServiceItem);
                                                                setWorkTypePopoverOpen(false);
                                                            }}
                                                            className={cn("rounded-xl py-2.5 cursor-pointer", alreadyAdded && "opacity-40 cursor-not-allowed")}>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-bold text-sm">{wt.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{wt.departmentName} → {wt.categoryName}</span>
                                                            </div>
                                                            {alreadyAdded && <Check className="ml-auto h-4 w-4 text-primary" />}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
            )}

            {/* Services table */}
            {workFields.length > 0 && (
                <div className="space-y-2 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className={cn(
                        "grid gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 sticky top-0 z-10",
                        isPendingFlow ? "grid-cols-[40px_1fr_120px_140px_100px_40px]" : "grid-cols-[1fr_120px_140px_100px_40px]"
                    )}>
                        {isPendingFlow && <div />}
                        {['Service', 'Prof. Fee', 'Govt. Fee', 'Total', ''].map(h => (
                            <p key={h} className={`text-[9px] font-black uppercase tracking-widest text-slate-400 ${h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</p>
                        ))}
                    </div>
                    
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {workFields.map((item: any, idx: number) => (
                            <ServiceRow
                                key={item.id}
                                item={item}
                                idx={idx}
                                control={form.control}
                                onRemove={removeWork}
                                fieldName={fieldName}
                                isSelected={selectedIndexes.has(idx)}
                                onToggle={() => onToggleIndex?.(idx)}
                                showCheckbox={isPendingFlow}
                                isDraftReview={isDraftReview}
                                readOnly={readOnly || (idx < lockedItemsCount)}
                                clientId={clientId}
                                associateId={associateId}
                                profileId={profileId}
                                clientType={clientType}
                                form={form}
                                masterWorkTypes={masterWorkTypes}
                                hasGST={hasGST}
                            />
                        ))}
                    </div>

                </div>
            )}

            {/* Discount Section Removed - Now per service */}
        </div>
    );
};

interface ServiceRowProps {
    item: any;
    idx: number;
    control: any;
    onRemove: (idx: number) => void;
    readOnly?: boolean;
    fieldName: string;
    isSelected?: boolean;
    onToggle?: () => void;
    showCheckbox?: boolean;
    isDraftReview?: boolean;
    clientId?: string | null;
    associateId?: string | null;
    profileId?: string | null;
    clientType?: string | null;
    form?: any;
    masterWorkTypes?: any[];
    hasGST?: boolean;
}

const ServiceRow = React.memo(({ item, idx, control, onRemove, fieldName, isSelected, onToggle, showCheckbox, isDraftReview, readOnly = false, clientId, associateId, profileId, clientType, form, masterWorkTypes, hasGST = true }: ServiceRowProps) => {
    // Local calculation for row total
    const profFee = useWatch({ control, name: `${fieldName}.${idx}.professionalFee` }) || 0;
    const govtFee = useWatch({ control, name: `${fieldName}.${idx}.governmentFee` }) || 0;
    const isGst = useWatch({ control, name: `${fieldName}.${idx}.isGstApplicable` });
    const noInvoice = useWatch({ control, name: `${fieldName}.${idx}.noInvoice` });
    const gstRate = useWatch({ control, name: `${fieldName}.${idx}.gstPercentage` }) || 18;
    const appliedOn = useWatch({ control, name: `${fieldName}.${idx}.gstAppliedOn` }) || 'professional';
    const discountType = useWatch({ control, name: `${fieldName}.${idx}.discountType` }) || 'amount';
    const discountValue = useWatch({ control, name: `${fieldName}.${idx}.discountValue` }) || 0;
    const isManualRate = useWatch({ control, name: `${fieldName}.${idx}.manualRate` });
    const govtFeeBreakupRaw = useWatch({ control, name: `${fieldName}.${idx}.governmentFeeBreakup` });
    const govtFeeItemsRaw = useWatch({ control, name: `${fieldName}.${idx}.governmentFeeItems` });
    const govtFeeBreakup = useMemo(() => {
        const raw = govtFeeBreakupRaw || govtFeeItemsRaw;
        return Array.isArray(raw) ? raw : [];
    }, [govtFeeBreakupRaw, govtFeeItemsRaw]);

    const { data: suggestions = [], isLoading: loadingSuggestions } = useRateSuggestions({
        workTypeId: item.workTypeId,
        clientId: clientId || undefined,
        associateId: associateId || undefined,
        profileId: profileId || undefined,
        clientType: clientType || undefined,
        enabled: !readOnly && !!item.workTypeId
    });

    // Advanced Govt Fee Engine state
    const [missingValues, setMissingValues] = useState<any[]>([]);
    const [manualValues, setManualValues] = useState<Record<string, any>>({});
    const [selectedRateCard, setSelectedRateCard] = useState<any>(null);
    const [isCalculatingFees, setIsCalculatingFees] = useState(false);

    React.useEffect(() => {
        if (form && form.register) {
            form.register(`${fieldName}.${idx}.governmentFeeBreakup`);
        }
    }, [form, fieldName, idx]);

    const applyRateToForm = (rate: any, evaluatedGovtFees: any[]) => {
        if (!form) return;
        const profFeeType = rate.professional_fee_type || 'fixed';
        const profFeeValue = profFeeType === 'range' ? 0 : (rate.professionalFee || 0);
        form.setValue(`${fieldName}.${idx}.professionalFee`, profFeeValue, { shouldValidate: true, shouldDirty: true });
        
        // Sum up from evaluated Govt Fees if any, otherwise default to 0
        const governmentFee = evaluatedGovtFees && evaluatedGovtFees.length > 0
            ? evaluatedGovtFees.reduce((sum: number, fee: any) => sum + Number(fee.calculated_amount || 0), 0)
            : 0;

        form.setValue(`${fieldName}.${idx}.governmentFee`, governmentFee, { shouldValidate: true, shouldDirty: true });

        // Save rate card tracking info
        form.setValue(`${fieldName}.${idx}.rateCardItemId`, rate.id || rate.rate_card_item_id || null, { shouldDirty: true });
        form.setValue(`${fieldName}.${idx}.rateCardName`, rate.rateCardName || rate.rate_card_name || 'Rate Card', { shouldDirty: true });
        form.setValue(`${fieldName}.${idx}.manualRate`, false, { shouldDirty: true });
        form.setValue(`${fieldName}.${idx}.professionalFeeType`, rate.professional_fee_type || 'fixed', { shouldDirty: true });
        form.setValue(`${fieldName}.${idx}.professionalFeeMin`, rate.professional_fee_min || 0, { shouldDirty: true });
        form.setValue(`${fieldName}.${idx}.professionalFeeMax`, rate.professional_fee_max || 0, { shouldDirty: true });

        // Save detailed split-up for Review & Approve modal
        if (Array.isArray(evaluatedGovtFees) && evaluatedGovtFees.length > 0) {
            const breakup = evaluatedGovtFees.map((fee: any) => ({
                name: fee.fee_name || fee.rule_label || 'Government Fee',
                amount: Number(fee.calculated_amount || 0),
                government_fee_id: fee.government_fee_id,
                calculation_rule_id: fee.calculation_rule_id,
                fee_name: fee.fee_name,
                rule_label: fee.rule_label,
                calculation_type: fee.calculation_type,
                calculated_amount: Number(fee.calculated_amount || 0),
                calculation_explanation: fee.calculation_explanation,
                resolved_values: fee.resolved_values,
                input_values: fee.input_values,
                checked_at: new Date().toISOString()
            }));
            form.setValue(`${fieldName}.${idx}.governmentFeeBreakup`, breakup, { shouldDirty: true });
        } else {
            form.setValue(`${fieldName}.${idx}.governmentFeeBreakup`, null, { shouldDirty: true });
        }
        
        const finalProfFee = profFeeType === 'range' ? 0 : (rate.professionalFee || 0);
        form.setValue(`${fieldName}.${idx}.itemTotal`, (finalProfFee + governmentFee), { shouldDirty: true });
        
        // clear states
        setMissingValues([]);
        setSelectedRateCard(null);
    };

    const handleUseRate = async (rate: any, providedValues = manualValues) => {
        if (!form) return;
        setSelectedRateCard(rate);
        
        const feeRows = rate.governmentFeeRows || rate.governmentFees || rate.government_fees || [];
        const feeIds = feeRows.map((f: any) => f.government_fee_rule_id || f.government_fee_id).filter(Boolean);
        
        if (feeIds.length === 0) {
            // No govt fees, just apply professional fee
            applyRateToForm(rate, []);
            return;
        }

        setIsCalculatingFees(true);
        try {
            // Build context from form
            const flatFields = form.getValues('flatFields') || {};
            const context = {
                client_id: clientId,
                business_profile_id: profileId,
                work_item_id: item.workTypeId,
                ...flatFields
            };

            const res = await fetch('/api/government-fees/check-applicability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    government_fee_ids: feeIds,
                    context,
                    manual_values: providedValues,
                    as_of_date: rate.applicable_from || new Date().toISOString().slice(0, 10)
                })
            });
            const data = await res.json();
            
            if (data.success && data.data) {
                if (data.data.missingValuesRequired && data.data.missingValuesRequired.length > 0) {
                    setMissingValues(data.data.missingValuesRequired);
                } else {
                    applyRateToForm(rate, data.data.applicableFees);
                }
            } else {
                console.error("Failed to check applicability", data.error);
                // Fallback to empty govt fees
                applyRateToForm(rate, []);
            }
        } catch (error) {
            console.error("Error evaluating govt fees", error);
            applyRateToForm(rate, []);
        } finally {
            setIsCalculatingFees(false);
        }
    };

    const rowTotal = useMemo(() => {
        let gst = 0;
        if (isGst && !noInvoice) {
            const rate = Number(gstRate) / 100;
            if (appliedOn === 'professional') gst = profFee * rate;
            else if (appliedOn === 'government') gst = govtFee * rate;
            else if (appliedOn === 'both') gst = (profFee + govtFee) * rate;
        }
        
        const totalBeforeDiscount = profFee + govtFee + gst;
        let discount = 0;
        if (discountType === 'percentage') {
            discount = totalBeforeDiscount * Math.min(Number(discountValue), 100) / 100;
        } else {
            discount = Math.min(Number(discountValue), totalBeforeDiscount);
        }

        return totalBeforeDiscount - discount;
    }, [profFee, govtFee, isGst, gstRate, appliedOn, discountType, discountValue, noInvoice]);

    return (
        <div className={cn(
            "flex flex-col gap-3 px-4 py-5 bg-white hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-0 group",
            showCheckbox && !isSelected && "opacity-60 bg-slate-50/30"
        )}>
            {/* Top Row: Info and Fee Inputs */}
            <div className={cn(
                "grid gap-4 items-start",
                showCheckbox ? "grid-cols-[40px_1fr_120px_140px_100px_40px]" : "grid-cols-[1fr_120px_140px_100px_40px]"
            )}>
                {showCheckbox && (
                    <div className="pt-2 flex justify-center">
                        <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={onToggle}
                            className="h-5 w-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all hover:border-blue-400"
                        />
                    </div>
                )}
                <div className="min-w-0 pt-1 flex flex-col gap-1.5">
                    <p className="text-sm font-black uppercase tracking-tight text-slate-800 truncate leading-none">{item.workTypeName}</p>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest h-4 bg-slate-50 text-slate-400 border-slate-200">{(item.departmentName || 'N/A')}</Badge>
                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{(item.categoryName || 'N/A')}</span>
                    </div>
                    {isManualRate && !readOnly && !loadingSuggestions && suggestions.length === 0 && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-amber-500">
                            <AlertCircle className="h-3 w-3" />
                            <span>No active approved rate card found. Manual rate entered.</span>
                        </div>
                    )}
                    {isManualRate && !readOnly && !loadingSuggestions && suggestions.length > 0 && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                            <AlertCircle className="h-3 w-3" />
                            <span>Using custom manual rate</span>
                        </div>
                    )}
                    {(() => {
                        const note = item.warningNote || item.warning_note || masterWorkTypes?.find(wt => wt.id === item.workTypeId)?.warningNote || masterWorkTypes?.find(wt => wt.id === item.workTypeId)?.warning_note;
                        if (!note) return null;
                        return (
                            <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                                ⚠️ Note: {note}
                            </p>
                        );
                    })()}
                </div>
                
                <FormField control={control} name={`${fieldName}.${idx}.professionalFee` as any} render={({ field }: { field: any }) => {
                    const feeType = form.watch(`${fieldName}.${idx}.professionalFeeType`);
                    const feeMin = form.watch(`${fieldName}.${idx}.professionalFeeMin`);
                    const feeMax = form.watch(`${fieldName}.${idx}.professionalFeeMax`);
                    return (
                    <FormItem className="space-y-1">
                        <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Professional</Label>
                        <div className="relative">
                            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                            <Input 
                                {...field}
                                value={field.value ?? ''}
                                type="number"
                                readOnly={readOnly && !isDraftReview}
                                className="h-10 pl-7 pr-2 text-sm font-black bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all tabular-nums"
                                onChange={e => {
                                    field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                    form.setValue(`${fieldName}.${idx}.manualRate`, true, { shouldDirty: true });
                                }}
                            />
                        </div>
                        {feeType === 'range' && (
                            <div className="text-[9px] text-blue-600 font-bold mt-1">
                                Allowed range: ₹{feeMin} - ₹{feeMax}
                            </div>
                        )}
                    </FormItem>
                )}} />

                <div className="flex flex-col gap-1 w-full lg:w-[160px]">
                    <FormField control={control} name={`${fieldName}.${idx}.governmentFee` as any} render={({ field }: { field: any }) => (
                        <FormItem className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Government</Label>
                            <div className="relative">
                                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                                <Input 
                                    {...field}
                                    value={field.value ?? ''}
                                    type="number"
                                    readOnly={readOnly && (!isDraftReview || govtFeeBreakup.length > 0) || govtFeeBreakup.length > 0}
                                    className="h-10 pl-7 pr-2 text-sm font-black bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all tabular-nums disabled:opacity-50"
                                    onChange={e => {
                                        field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                        form.setValue(`${fieldName}.${idx}.manualRate`, true, { shouldDirty: true });
                                    }}
                                />
                            </div>
                        </FormItem>
                    )} />

                    {(!readOnly || isDraftReview) && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className={cn(
                                        "inline-flex w-fit items-center justify-center whitespace-nowrap rounded-full px-3 py-1 h-auto text-[10px] font-bold uppercase tracking-wide transition-all mt-1",
                                        govtFeeBreakup.length > 0 ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" : "text-slate-500 hover:text-blue-600"
                                    )}
                                >
                                    <span className="hidden sm:inline">
                                        {govtFeeBreakup.length > 0 ? `Manage Breakdown (${govtFeeBreakup.length})` : "+ Add Breakdown"}
                                    </span>
                                    <span className="inline sm:hidden">
                                        {govtFeeBreakup.length > 0 ? `Breakdown (${govtFeeBreakup.length})` : "+ Breakdown"}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4 rounded-2xl shadow-xl border-slate-200 bg-white" align="start">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="h-6 w-6 rounded-md bg-amber-100 flex items-center justify-center">
                                            <IndianRupee className="h-3 w-3 text-amber-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Govt Fee Breakdown</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Modify specific fee components</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                        {govtFeeBreakup.map((fee: any, fIdx: number) => (
                                            <div key={fIdx} className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                                <Input 
                                                    value={fee.name || fee.feeName || ''} 
                                                    onChange={e => {
                                                        const newArr = [...govtFeeBreakup];
                                                        newArr[fIdx] = { ...newArr[fIdx], name: e.target.value, feeName: e.target.value };
                                                        form.setValue(`${fieldName}.${idx}.governmentFeeBreakup`, newArr, { shouldDirty: true });
                                                    }} 
                                                    className="h-8 text-xs font-bold bg-white border-slate-200 rounded-md placeholder:text-slate-300"
                                                    placeholder="Fee Name (e.g. Stamp Duty)"
                                                />
                                                <div className="relative w-24 shrink-0">
                                                    <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-slate-400" />
                                                    <Input 
                                                        value={fee.amount ?? ''} 
                                                        type="number"
                                                        onChange={e => {
                                                            const newArr = [...govtFeeBreakup];
                                                            newArr[fIdx] = { ...newArr[fIdx], amount: e.target.value === '' ? 0 : Number(e.target.value) };
                                                            form.setValue(`${fieldName}.${idx}.governmentFeeBreakup`, newArr, { shouldDirty: true });
                                                            
                                                            const newTotal = newArr.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                                                            form.setValue(`${fieldName}.${idx}.governmentFee`, newTotal, { shouldDirty: true });
                                                        }} 
                                                        className="h-8 pl-6 pr-1 text-xs font-black tabular-nums bg-white border-slate-200 rounded-md"
                                                    />
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0" 
                                                    onClick={() => {
                                                        const newArr = govtFeeBreakup.filter((_, i) => i !== fIdx);
                                                        form.setValue(`${fieldName}.${idx}.governmentFeeBreakup`, newArr.length > 0 ? newArr : null, { shouldDirty: true });
                                                        const newTotal = newArr.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                                                        form.setValue(`${fieldName}.${idx}.governmentFee`, newTotal, { shouldDirty: true });
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 px-2 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50"
                                            onClick={() => {
                                                const newArr = [...govtFeeBreakup, { name: '', amount: 0 }];
                                                form.setValue(`${fieldName}.${idx}.governmentFeeBreakup`, newArr, { shouldDirty: true });
                                            }}
                                        >
                                            <PlusCircle className="h-3 w-3 mr-1" /> Add Component
                                        </Button>
                                        
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total</span>
                                            <span className="text-sm font-black tabular-nums text-slate-800">
                                                ₹{govtFeeBreakup.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>

                <div className="flex flex-col items-end pt-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Total</span>
                    <span className="text-base font-black text-slate-900 tabular-nums tracking-tighter">
                        ₹{rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

                <div className="flex justify-center pt-5">
                    {(!readOnly && !isDraftReview) && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemove(idx)}
                            className="h-8 w-8 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Bottom Row: GST Controls */}
            {hasGST && (
                <div className="flex items-center gap-8 pl-2 py-2 rounded-xl bg-slate-50/50 border border-slate-100 w-fit pr-6">
                    <FormField control={control} name={`${fieldName}.${idx}.isGstApplicable`} render={({ field }) => (
                    <div className="flex items-center gap-3">
                        <Switch 
                            checked={field.value} 
                            onCheckedChange={field.onChange} 
                            disabled={readOnly && !isDraftReview}
                            className="data-[state=checked]:bg-blue-600 scale-75"
                        />
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">GST Applicable?</Label>
                    </div>
                )} />

                <FormField control={control} name={`${fieldName}.${idx}.noInvoice`} render={({ field }) => (
                    <div className="flex items-center gap-3">
                        <Checkbox 
                            id={`no-invoice-${idx}`}
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                            disabled={readOnly && !isDraftReview}
                            className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor={`no-invoice-${idx}`} className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">No Invoice</Label>
                    </div>
                )} />

                {isGst && (
                    <div className="flex items-center gap-6 animate-in slide-in-from-left-2 duration-300">
                        <div className="h-4 w-[1px] bg-slate-200" />
                        
                        <div className="flex items-center gap-3">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Apply On</Label>
                            <FormField control={control} name={`${fieldName}.${idx}.gstAppliedOn`} render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly && !isDraftReview}>
                                    <SelectTrigger className="h-8 w-32 text-[10px] font-black uppercase tracking-widest border-slate-200 bg-white rounded-lg">
                                        <SelectValue placeholder="Apply GST on..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="professional" className="text-[10px] font-bold uppercase tracking-wider">Professional Fee</SelectItem>
                                        <SelectItem value="government" className="text-[10px] font-bold uppercase tracking-wider">Government Fee</SelectItem>
                                        <SelectItem value="both" className="text-[10px] font-bold uppercase tracking-wider">Both Fees</SelectItem>
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="px-2 py-1 bg-blue-100/50 rounded-md border border-blue-200">
                                <span className="text-[10px] font-black text-blue-700 tracking-widest">18% GST</span>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-slate-400" />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-none rounded-lg p-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider">Standard GST rate of 18% is applied.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        </div>
                    )}
                </div>
            )}

            {/* Discount Row */}
            <div className="flex items-center gap-8 pl-2 py-2 rounded-xl bg-green-50/30 border border-green-100 w-fit pr-6 mt-1 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md bg-green-100 flex items-center justify-center text-[9px] font-black text-green-600 border border-green-200">%</div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-green-700">Service Discount</Label>
                </div>

                <div className="flex items-center gap-4">
                    <FormField control={control} name={`${fieldName}.${idx}.discountType`} render={({ field }) => (
                        <div className="flex items-center bg-white border border-green-200 rounded-lg p-0.5 shadow-sm">
                            <button
                                type="button"
                                onClick={() => field.onChange('amount')}
                                className={cn(
                                    "px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-md transition-all",
                                    field.value === 'amount' ? "bg-green-600 text-white shadow-sm" : "text-green-600 hover:bg-green-50"
                                )}
                            >
                                ₹
                            </button>
                            <button
                                type="button"
                                onClick={() => field.onChange('percentage')}
                                className={cn(
                                    "px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-md transition-all",
                                    field.value === 'percentage' ? "bg-green-600 text-white shadow-sm" : "text-green-600 hover:bg-green-50"
                                )}
                            >
                                %
                            </button>
                        </div>
                    )} />

                    <FormField control={control} name={`${fieldName}.${idx}.discountValue` as any} render={({ field }: { field: any }) => (
                        <div className="relative w-24">
                            {discountType === 'percentage' ? (
                                <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-green-400" />
                            ) : (
                                <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-green-400" />
                            )}
                            <Input 
                                {...field}
                                value={field.value ?? ''}
                                type="number"
                                readOnly={readOnly && !isDraftReview}
                                className="h-8 pl-6 pr-1 text-[11px] font-black bg-white border-green-200 rounded-lg focus:ring-2 focus:ring-green-100 focus:border-green-400 transition-all tabular-nums"
                                placeholder="0.00"
                                onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    )} />

                    {Number(discountValue) > 0 && (
                        <span className="text-[10px] font-black text-green-600 animate-in fade-in zoom-in-95 duration-300">
                            -₹{(Number(discountType === 'percentage' 
                                ? (profFee + govtFee + (isGst && !noInvoice ? (Number(gstRate)/100 * (appliedOn === 'professional' ? profFee : appliedOn === 'government' ? govtFee : profFee + govtFee)) : 0)) * Number(discountValue) / 100 
                                : discountValue
                            )).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    )}
                </div>
            </div>

            {/* Suggested Rates Section */}
            {!readOnly && !isDraftReview && (suggestions.length > 0 || loadingSuggestions) && (
                <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-700">Suggested Rates from Rate Cards</h5>
                        {loadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-blue-400 ml-2" />}
                    </div>
                    {suggestions.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {suggestions.map((rate: any, i: number) => {
                                const feeRows = rate.governmentFeeRows || rate.governmentFees || rate.government_fees || [];
                                const governmentFeeTotal = Array.isArray(feeRows) && feeRows.length > 0
                                    ? feeRows.reduce((sum: number, fee: any) => sum + Number(fee.amount || fee.value || 0), 0)
                                    : Number(rate.governmentFeeTotal || rate.government_fee_total || rate.governmentFee || 0);
                                
                                return (
                                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">{rate.rateCardName}</span>
                                            <Badge variant="outline" className="text-[8px] uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-200 py-0 h-4">
                                                {rate.confidenceLabel}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500">
                                            {rate.professional_fee_type === 'range' ? (
                                                <>
                                                    <span>Prof: ₹{(rate.professional_fee_min || 0).toLocaleString()} - ₹{(rate.professional_fee_max || 0).toLocaleString()}</span>
                                                    <span>Govt: ₹{governmentFeeTotal.toLocaleString()}</span>
                                                    <span className="font-bold text-slate-700">Total: To be calculated in proposal</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Prof: ₹{(rate.professionalFee || 0).toLocaleString()}</span>
                                                    <span>Govt: ₹{governmentFeeTotal.toLocaleString()}</span>
                                                    <span className="font-bold text-slate-700">Total: ₹{(rate.itemTotal || 0).toLocaleString()}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <Button 
                                        type="button"
                                        size="sm" 
                                        variant="outline"
                                        className="h-8 text-[10px] font-bold uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-50"
                                        onClick={() => handleUseRate(rate)}
                                    >
                                        Use This Rate
                                    </Button>
                                </div>
                                );
                            })}
                        </div>
                    ) : !loadingSuggestions ? (
                        <p className="text-xs text-slate-500 italic">No matching Rate Card found for this client and service. You can enter the rate manually.</p>
                    ) : null}
                </div>
            )}

            {missingValues.length > 0 && selectedRateCard && (
                <div className="mt-4 px-2">
                    <GovernmentFeeInputs 
                        missingValues={missingValues} 
                        values={manualValues} 
                        onChange={(mapping_id, value) => setManualValues(prev => ({ ...prev, [mapping_id]: value }))} 
                    />
                    <div className="mt-2 flex justify-end">
                        <Button 
                            type="button" 
                            size="sm" 
                            className="text-xs"
                            disabled={isCalculatingFees}
                            onClick={() => handleUseRate(selectedRateCard, manualValues)}
                        >
                            {isCalculatingFees ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                            Recalculate & Apply Rate
                        </Button>
                    </div>
                </div>
            )}

            {!readOnly && !isDraftReview && !loadingSuggestions && suggestions.length === 0 && item.workTypeId && !isManualRate && (
                <div className="mt-4 px-2">
                    <p className="text-[10px] text-slate-400 italic">No matching Rate Card found for this client and service. You can enter the rate manually.</p>
                </div>
            )}
        </div>
    );
});

ServiceRow.displayName = 'ServiceRow';

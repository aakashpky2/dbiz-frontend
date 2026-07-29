'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Department } from '@/lib/department-management';
import { rateCardService } from '@/services/rateCardService';
import { governmentFeeService } from '@/services/governmentFeeService';
import { GovernmentFeeInputs } from '@/components/dashboard/shared/GovernmentFeeInputs';
import { useToast } from '@/hooks/use-toast';

interface RateCardItemFormProps {
    rateCardId: string;
    mainRateCard: any;
    departments: Department[];
    constitutions: any[];
    flatWorkTypes: any[];
    initialItem: any | null;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

export default function RateCardItemForm({
    rateCardId,
    mainRateCard,
    departments,
    constitutions,
    flatWorkTypes,
    initialItem,
    onSaveSuccess,
    onCancel
}: RateCardItemFormProps) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const formRef = useRef<HTMLDivElement>(null);

    const [formItem, setFormItem] = useState<any>({
        department_id: '',
        category_id: '',
        work_item_id: '',
        work_item_name: '',
        professional_fee_type: 'fixed',
        professional_fee_min: 0,
        professional_fee_max: 0,
        professional_fee: 0,
        government_fees: [],
        constitution_constraints: [],
        sub_constitutions: [],
        constitution_scope: 'all',
        applicable_from: '',
        applicability_mode: 'until_next_rate',
        applicable_until: '',
        government_fee_filter_values: {},
        government_fee_calculation_mode: 'dynamic'
    });

    const [autoRecalculateFees, setAutoRecalculateFees] = useState(true);
    const [suggestedFees, setSuggestedFees] = useState<any[]>([]);
    const [missingValuesRequired, setMissingValuesRequired] = useState<any[]>([]);
    const [resolvedValues, setResolvedValues] = useState<Record<string, any>>({});
    const [conditionsChanged, setConditionsChanged] = useState(false);
    const [isCalculatingFees, setIsCalculatingFees] = useState(false);
    const [rejectedFeesLog, setRejectedFeesLog] = useState<any[]>([]);

    // Initialize form state
    useEffect(() => {
        if (initialItem && !initialItem.isMissing) {
            // Edit mode
            let bTypes: string[] = [];
            let bSubTypes: string[] = [];
            
            // Handle array of constitution_ids or legacy constitution_id
            if (initialItem.constitution_ids && Array.isArray(initialItem.constitution_ids) && initialItem.constitution_ids.length > 0) {
                const isUuid = initialItem.constitution_ids.some((id: string) => typeof id === 'string' && id.length === 36 && id.includes('-'));
                if (isUuid) {
                    const constRows = constitutions.filter(c => initialItem.constitution_ids.includes(c.id));
                    bTypes = constRows.map(c => c.business_type).filter(Boolean);
                } else {
                    bTypes = initialItem.constitution_ids;
                }
            } else if (initialItem.constitution_id) {
                const constRow = constitutions.find(c => c.id === initialItem.constitution_id);
                if (constRow) {
                    bTypes = [constRow.business_type];
                }
            }

            if (bTypes.length === 0) {
                bTypes = mainRateCard?.constitution_ids || [];
            }

            if (initialItem.sub_constitution_ids && Array.isArray(initialItem.sub_constitution_ids) && initialItem.sub_constitution_ids.length > 0) {
                const isUuid = initialItem.sub_constitution_ids.some((id: string) => typeof id === 'string' && id.length === 36 && id.includes('-'));
                if (isUuid) {
                    const subs = constitutions.filter(c => initialItem.sub_constitution_ids.includes(c.id));
                    bSubTypes = subs.map(c => c.business_sub_type).filter(Boolean);
                } else {
                    bSubTypes = initialItem.sub_constitution_ids;
                }
            }
            
            if (bSubTypes.length === 0) {
                bSubTypes = mainRateCard?.sub_constitution_ids || [];
            }

            // Reverse lookup department and category
            let deptId = '';
            let catId = '';
            for (const d of departments) {
                for (const c of (d.workCategories || [])) {
                    if (c.workTypes?.some(t => String(t.id) === String(initialItem.work_item_id))) {
                        deptId = String(d.id);
                        catId = String(c.id);
                        break;
                    }
                }
                if (deptId) break;
            }

            setFormItem({
                ...initialItem,
                department_id: deptId,
                category_id: catId,
                constitution_constraints: bTypes,
                sub_constitutions: bSubTypes,
                applicable_from: initialItem.applicable_from ? new Date(initialItem.applicable_from).toISOString().split('T')[0] : (mainRateCard?.applicable_from ? new Date(mainRateCard.applicable_from).toISOString().split('T')[0] : ''),
                applicability_mode: initialItem.applicability_mode || mainRateCard?.applicability_mode || 'until_next_rate',
                applicable_until: initialItem.applicable_until ? new Date(initialItem.applicable_until).toISOString().split('T')[0] : '',
                professional_fee_type: initialItem.professional_fee_type || 'fixed',
                professional_fee_min: parseFloat(initialItem.professional_fee_min) || 0,
                professional_fee_max: parseFloat(initialItem.professional_fee_max) || 0,
                government_fee_filter_values: initialItem.government_fee_filter_values || {},
                government_fee_calculation_mode: initialItem.government_fee_calculation_mode || 'dynamic'
            });
            setConditionsChanged(false);
        } else {
            // New mode or Missing Item prefill
            setFormItem({
                department_id: initialItem?.department_id || '',
                category_id: initialItem?.category_id || '',
                work_item_id: initialItem?.work_item_id ? String(initialItem.work_item_id) : '',
                work_item_name: initialItem?.work_item_name || '',
                professional_fee_type: 'fixed',
                professional_fee_min: 0,
                professional_fee_max: 0,
                professional_fee: 0,
                government_fees: [],
                constitution_constraints: mainRateCard?.constitution_ids || [],
                sub_constitutions: mainRateCard?.sub_constitution_ids || [],
                constitution_scope: 'all',
                applicable_from: mainRateCard?.applicable_from ? new Date(mainRateCard.applicable_from).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                applicability_mode: mainRateCard?.applicability_mode || 'until_next_rate',
                applicable_until: mainRateCard?.applicable_until ? new Date(mainRateCard.applicable_until).toISOString().split('T')[0] : '',
                government_fee_filter_values: {},
                government_fee_calculation_mode: 'dynamic'
            });
            setConditionsChanged(false);
        }
    }, [initialItem, mainRateCard, departments, constitutions]);

    // Auto-scroll Helpers
    const findScrollParent = useCallback((element: HTMLElement | null): HTMLElement | Window => {
        if (!element) return window;

        let parent = element.parentElement;

        while (parent) {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY;

            if (
                (overflowY === 'auto' || overflowY === 'scroll') &&
                parent.scrollHeight > parent.clientHeight
            ) {
                return parent;
            }

            parent = parent.parentElement;
        }

        return window;
    }, []);

    const scrollToRateForm = useCallback(() => {
        const el = formRef.current;
        if (!el) return;

        const scrollParent = findScrollParent(el);

        if (scrollParent === window) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
                window.scrollBy({ top: -90, behavior: 'smooth' });
            }, 250);
            return;
        }

        const parent = scrollParent as HTMLElement;
        const parentRect = parent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        parent.scrollTo({
            top: parent.scrollTop + elRect.top - parentRect.top - 24,
            behavior: 'smooth',
        });
    }, [findScrollParent]);

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToRateForm();
        }, 150);
        return () => clearTimeout(timer);
    }, [scrollToRateForm]);

    // No need to fetch library fees or set selectedLibraryFeeIds on mount anymore

    const handleGetSuggestions = useCallback(async () => {
        setIsCalculatingFees(true);
        try {
            const parentConstIds = mainRateCard?.constitution_ids || [];
            const parentSubConstIds = mainRateCard?.sub_constitution_ids || [];
            const clientType = mainRateCard?.client_type || 'direct';

            const payloadValues = { 
                ...formItem.government_fee_filter_values,
                constitution: parentConstIds.length === 1 ? parentConstIds[0] : (parentConstIds.length > 1 ? parentConstIds : undefined),
                sub_constitution: parentSubConstIds.length === 1 ? parentSubConstIds[0] : (parentSubConstIds.length > 1 ? parentSubConstIds : undefined),
                client_type: clientType
            };

            const context = {
                business_profile_id: mainRateCard?.business_profile_id,
                client_id: mainRateCard?.client_id,
                rate_card_id: rateCardId
            };

            const res = await governmentFeeService.getSuggestions({
                context,
                manual_values: payloadValues,
                as_of_date: formItem.applicable_from || new Date().toISOString().slice(0, 10)
            });

            if (res) {
                setSuggestedFees(res.applicableFees || []);
                setRejectedFeesLog(res.rejectedFees || []);
                setMissingValuesRequired(res.missingValuesRequired || []);
                setResolvedValues(res.resolvedValues || {});
                setConditionsChanged(false);
                toast({ title: 'Success', description: 'Government fee suggestions loaded.' });
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to get suggestions', variant: 'destructive' });
        } finally {
            setIsCalculatingFees(false);
        }
    }, [formItem.government_fee_filter_values, mainRateCard, rateCardId, formItem.applicable_from, toast]);

    useEffect(() => {
        if (autoRecalculateFees && conditionsChanged && formItem.government_fee_calculation_mode === 'dynamic') {
            const timer = setTimeout(() => {
                handleGetSuggestions();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [formItem.government_fee_filter_values, autoRecalculateFees, conditionsChanged, formItem.government_fee_calculation_mode, handleGetSuggestions]);

    // Derived Constitution logic from Parent Rate Card
    const uniqueConstitutions = useMemo(() => {
        const rcConsts = mainRateCard?.constitution_ids || [];
        return rcConsts.map((name: string) => ({ label: name, value: name }));
    }, [mainRateCard]);

    const availableSubConstitutions = useMemo(() => {
        const rcSubs = mainRateCard?.sub_constitution_ids || [];
        return rcSubs.map((name: string) => ({ label: name, value: name }));
    }, [mainRateCard]);

    // Parent scope display and help note
    const constitutionDisplayAndHelp = useMemo(() => {
        const parentConstIds = mainRateCard?.constitution_ids || [];
        const parentSubConstIds = mainRateCard?.sub_constitution_ids || [];

        // 1. Constitution Display
        let constDisplay = "All Constitutions";
        if (parentConstIds.length === 1) {
            constDisplay = parentConstIds[0];
        } else if (parentConstIds.length > 1) {
            constDisplay = `${parentConstIds.length} Selected`;
        }

        // 2. Sub-Constitution Display
        let subConstDisplay = "All Sub-Constitutions";
        if (parentSubConstIds.length > 0) {
            if (parentSubConstIds.length === 1) {
                subConstDisplay = parentSubConstIds[0];
            } else {
                subConstDisplay = `${parentSubConstIds.length} Selected`;
            }
        } else {
            if (parentConstIds.length > 0) {
                subConstDisplay = "All Sub-Constitutions within selected constitution(s)";
            }
        }

        // 3. Help note
        let helpNote = "Only work/services applicable to the selected Rate Card constitution should be added here.";
        if (parentConstIds.length === 1) {
            helpNote = `This Rate Card is restricted to: ${parentConstIds[0]}. Add only services applicable to this constitution.`;
        } else if (parentConstIds.length > 1) {
            helpNote = "This Rate Card is restricted to selected constitutions. Add only services applicable to these constitutions.";
        }

        return {
            constDisplay,
            subConstDisplay,
            helpNote
        };
    }, [mainRateCard]);

    // Filtered Work Types based on Rate Card constraints & selections
    const filteredWorkTypes = useMemo(() => {
        let filtered = flatWorkTypes;
        
        // Filter by Rate Card Constitution Constraints
        const rcConstitutions = mainRateCard?.constitution_ids || [];
        const rcSubConstitutions = mainRateCard?.sub_constitution_ids || [];
        
        if (rcConstitutions.length > 0) {
            filtered = filtered.filter(wt => {
                const applicability = wt.constitution_applicability_type || wt.constitutionApplicabilityType || 'All';
                const wtConstList = wt.constitution_list || wt.constitutionList || [];
                
                if (applicability === 'All' || wtConstList.length === 0) {
                    return true;
                }
                
                // Map parent's const/sub-const to business constitution IDs (UUIDs)
                const parentConstIds = constitutions
                    .filter(c => rcConstitutions.includes(c.business_type))
                    .map(c => c.id);
                    
                const parentSubIds = constitutions
                    .filter(c => rcSubConstitutions.includes(c.business_sub_type))
                    .map(c => c.id);
                    
                const allParentIds = [...parentConstIds, ...parentSubIds];
                
                if (applicability === 'Selected') {
                    return allParentIds.some(id => wtConstList.includes(id));
                } else if (applicability === 'Except Selected') {
                    return !allParentIds.some(id => wtConstList.includes(id));
                }
                
                return true;
            });
        }
        
        return filtered;
    }, [flatWorkTypes, mainRateCard, constitutions]);

    const liveItemTotal = useMemo(() => {
        const profFee = parseFloat(formItem.professional_fee) || 0;
        const govFee = (formItem.government_fees || []).reduce((sum: number, fee: any) => sum + (parseFloat(fee.amount) || 0), 0);
        return profFee + govFee;
    }, [formItem.professional_fee, formItem.government_fees]);

    const handleSaveItem = async () => {
        if (!rateCardId) return;
        
        if (!formItem.work_item_id) {
            toast({ title: 'Error', description: 'Please select a Work Type.', variant: 'destructive' });
            return;
        }

        if (mainRateCard?.applicable_from && formItem.applicable_from) {
            const mainDate = new Date(mainRateCard.applicable_from).toISOString().split('T')[0];
            const itemDate = new Date(formItem.applicable_from).toISOString().split('T')[0];
            if (itemDate < mainDate) {
                toast({ title: 'Error', description: 'Service item applicable date cannot be earlier than the main rate card applicable date.', variant: 'destructive' });
                return;
            }
        }

        setIsSaving(true);
        try {
            // Determine Scope from parent Rate Card
            const parentConstIds = mainRateCard?.constitution_ids || [];
            const parentSubConstIds = mainRateCard?.sub_constitution_ids || [];

            let resolvedScope = 'all';
            if (parentConstIds.length > 0) {
                resolvedScope = 'constitution';
                if (parentSubConstIds.length > 0) {
                     resolvedScope = 'sub_constitution';
                }
            }

            const payload = {
                ...formItem,
                constitution_ids: parentConstIds,
                constitution_id: null, // Legacy, can remain null if migration applied
                sub_constitution_ids: parentSubConstIds,
                constitution_scope: resolvedScope
            };
            
            // Clean up temporary UI state variables not needed in backend
            delete payload.constitution_constraints;
            delete payload.sub_constitutions;

            if (initialItem && !initialItem.isMissing) {
                await rateCardService.updateItem(rateCardId, initialItem.id, payload);
                toast({ title: 'Success', description: 'Item updated successfully.' });
            } else {
                await rateCardService.addItem(rateCardId, payload);
                toast({ title: 'Success', description: 'Item added successfully.' });
            }
            
            onSaveSuccess();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div ref={formRef}>
            <Card className="border-primary/50 shadow-md">
                <CardContent className="pt-4 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="font-bold text-sm">{(initialItem && !initialItem.isMissing) ? 'Edit Service Item' : 'New Service Item'}</h4>
                        <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 w-6 p-0"><X className="h-4 w-4"/></Button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {/* Row 1: Work Type (Smart Search) */}
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Work Type (Smart Search)</label>
                            <Combobox
                                options={filteredWorkTypes.map(t => ({
                                    value: String(t.id),
                                    label: t.name,
                                    description: t.description || `${t.department_name} > ${t.category_name}`
                                }))}
                                value={formItem.work_item_id}
                                onChange={(val) => {
                                    const t = filteredWorkTypes.find(x => String(x.id) === val);
                                    if (t) {
                                        setFormItem({
                                            ...formItem,
                                            work_item_id: val,
                                            work_item_name: t.name,
                                            department_id: t.department_id,
                                            category_id: t.category_id
                                        });
                                    } else {
                                        setFormItem({
                                            ...formItem,
                                            work_item_id: '',
                                            work_item_name: ''
                                        });
                                    }
                                }}
                                placeholder="Search by name or description..."
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                Work types are filtered based on selected rate card constitution and sub constitution.
                            </p>
                        </div>

                        {/* Row 2: Department & Category */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Department</label>
                                <Combobox
                                    options={departments.map(d => ({ label: d.name, value: String(d.id) }))}
                                    value={formItem.department_id}
                                    onChange={() => {}}
                                    disabled={true}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Category</label>
                                <Combobox
                                    options={(departments.find(d => String(d.id) === formItem.department_id)?.workCategories || []).map(c => ({ label: c.name, value: String(c.id) }))}
                                    value={formItem.category_id}
                                    onChange={() => {}}
                                    disabled={true}
                                />
                            </div>
                        </div>

                        {/* Row 3: Constitution & Sub-Constitution */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Constitution Constraint (Optional)</label>
                                <MultiSelectCombobox
                                    options={uniqueConstitutions}
                                    value={mainRateCard?.constitution_ids || []}
                                    onChange={() => {}}
                                    placeholder="All Constitutions"
                                    selectedItemsLabel="Constitutions Selected"
                                    maxDisplay={1}
                                    disabled={true}
                                    triggerLabel={constitutionDisplayAndHelp.constDisplay}
                                    selectAllLabel="All Constitutions"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Sub-Constitution Constraint (Optional)</label>
                                <MultiSelectCombobox
                                    options={availableSubConstitutions}
                                    value={mainRateCard?.sub_constitution_ids || []}
                                    onChange={() => {}}
                                    placeholder="All Sub-Constitutions"
                                    selectedItemsLabel="Sub-Constitutions Selected"
                                    maxDisplay={1}
                                    disabled={true}
                                    triggerLabel={constitutionDisplayAndHelp.subConstDisplay}
                                    selectAllLabel="All Sub-Constitutions"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {constitutionDisplayAndHelp.helpNote}
                        </p>

                    {/* Row 4: Professional Fee */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground block">Professional Fee Type</label>
                            <RadioGroup 
                                value={formItem.professional_fee_type} 
                                onValueChange={(val) => setFormItem({...formItem, professional_fee_type: val})} 
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="fixed" id="prof_fixed" />
                                    <label htmlFor="prof_fixed" className="font-normal cursor-pointer text-xs">Fixed Amount</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="range" id="prof_range" />
                                    <label htmlFor="prof_range" className="font-normal cursor-pointer text-xs">Range</label>
                                </div>
                            </RadioGroup>
                        </div>
                        
                        {formItem.professional_fee_type === 'fixed' ? (
                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Professional Fee</label>
                                <div className="relative w-full md:w-1/3">
                                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
                                    <Input 
                                        type="number" 
                                        className="pl-6 h-9 text-sm" 
                                        value={formItem.professional_fee} 
                                        onChange={e => setFormItem({...formItem, professional_fee: parseFloat(e.target.value) || 0})} 
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-4 items-center">
                                <div className="flex-1 max-w-[200px]">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Minimum Fee</label>
                                    <div className="relative w-full">
                                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
                                        <Input 
                                            type="number" 
                                            className="pl-6 h-9 text-sm" 
                                            value={formItem.professional_fee_min} 
                                            onChange={e => setFormItem({...formItem, professional_fee_min: parseFloat(e.target.value) || 0})} 
                                        />
                                    </div>
                                </div>
                                <div className="pt-5 text-muted-foreground">-</div>
                                <div className="flex-1 max-w-[200px]">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Maximum Fee</label>
                                    <div className="relative w-full">
                                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
                                        <Input 
                                            type="number" 
                                            className="pl-6 h-9 text-sm" 
                                            value={formItem.professional_fee_max} 
                                            onChange={e => setFormItem({...formItem, professional_fee_max: parseFloat(e.target.value) || 0})} 
                                        />
                                    </div>
                                </div>
                                <div className="pt-5 text-xs text-muted-foreground italic flex-1">
                                    Staff will enter the final professional fee within this range while preparing proposal.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Government Fees</span>
                        <div className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground mr-2">Mode:</div>
                            <RadioGroup 
                                value={formItem.government_fee_calculation_mode} 
                                onValueChange={(val) => {
                                    setFormItem({...formItem, government_fee_calculation_mode: val});
                                    if (val === 'dynamic') setConditionsChanged(true);
                                }} 
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="dynamic" id="mode_dynamic" />
                                    <label htmlFor="mode_dynamic" className="font-normal cursor-pointer text-xs">Linked Government Fees</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="manual" id="mode_manual" />
                                    <label htmlFor="mode_manual" className="font-normal cursor-pointer text-xs">Manual Entry</label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                    
                    {formItem.government_fee_calculation_mode === 'dynamic' ? (
                        <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Suggested Government Fees</label>
                                    <p className="text-[10px] text-muted-foreground mb-2">Automatically matched based on Client and Business Profile conditions.</p>
                                    
                                    {suggestedFees.length > 0 ? (
                                        <div className="space-y-2">
                                            {suggestedFees.map((fee: any, idx: number) => {
                                                const isAlreadyAdded = formItem.government_fees.some((f: any) => f.government_fee_rule_id === fee.government_fee_id);
                                                return (
                                                <div key={idx} className="flex justify-between items-center text-sm border rounded p-2 bg-white">
                                                    <div>
                                                        <span className="font-medium">{fee.fee_name}</span>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">{fee.calculation_explanation || 'Linked dynamically'}</p>
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        size="sm" 
                                                        variant={isAlreadyAdded ? "secondary" : "default"}
                                                        disabled={isAlreadyAdded}
                                                        onClick={() => {
                                                            const dynamicFee = {
                                                                fee_name: fee.fee_name,
                                                                authority_name: fee.authority_name || '',
                                                                amount: 0, // Rates are calculated at proposal time
                                                                source: 'library',
                                                                government_fee_rule_id: fee.government_fee_id,
                                                                matched_at: new Date().toISOString(),
                                                                condition_snapshot: []
                                                            };
                                                            setFormItem((prev: any) => ({
                                                                ...prev,
                                                                government_fees: [...prev.government_fees, dynamicFee]
                                                            }));
                                                        }}
                                                    >
                                                        {isAlreadyAdded ? 'Linked' : 'Link Fee'}
                                                    </Button>
                                                </div>
                                            )})}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground italic py-2">No matching government fees found for this context.</div>
                                    )}
                                </div>
                                <div className="pt-4 border-t">
                                    {Object.keys(resolvedValues).length > 0 && (
                                        <div className="mb-4">
                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Resolved Context</label>
                                            <p className="text-[10px] text-muted-foreground mb-2">System suggested these fees because the selected company/profile matches the configured conditions.</p>
                                            <div className="bg-muted/50 rounded-md p-2 space-y-1">
                                                {Object.entries(resolvedValues).map(([key, val]) => (
                                                    <div key={key} className="text-xs flex gap-2">
                                                        <span className="font-medium min-w-[120px] text-muted-foreground">{key}:</span>
                                                        <span>{String(val)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {missingValuesRequired.length > 0 && (
                                        <div className="mb-4">
                                            <GovernmentFeeInputs 
                                                missingValues={missingValuesRequired}
                                                values={formItem.government_fee_filter_values || {}}
                                                onChange={(mapping_id, value) => {
                                                    setFormItem({
                                                        ...formItem, 
                                                        government_fee_filter_values: { 
                                                            ...formItem.government_fee_filter_values, 
                                                            [mapping_id]: value 
                                                        }
                                                    });
                                                    setConditionsChanged(true);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t pt-3 mt-4">
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="checkbox" 
                                        id="auto_recalc" 
                                        checked={autoRecalculateFees} 
                                        onChange={e => setAutoRecalculateFees(e.target.checked)} 
                                        className="rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="auto_recalc" className="text-xs cursor-pointer">Auto Get Suggestions</label>
                                </div>
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={handleGetSuggestions} 
                                    disabled={isCalculatingFees || (!conditionsChanged && suggestedFees.length > 0 && missingValuesRequired.length === 0)}
                                >
                                    {isCalculatingFees ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    {missingValuesRequired.length > 0 ? 'Recheck Suggestions' : 'Get Suggestions'}
                                </Button>
                            </div>

                            {conditionsChanged && !autoRecalculateFees && (
                                <div className="text-xs text-amber-600 font-medium">
                                    Context changed. Please get suggestions.
                                </div>
                            )}

                            {formItem.government_fees.length > 0 && (
                                <div className="mt-4 border rounded-md p-3 bg-green-50 border-green-200">
                                    <div className="text-xs font-bold mb-2 text-green-800">Linked/Selected Fees:</div>
                                    <div className="space-y-2">
                                        {formItem.government_fees.map((fee: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-sm border-b border-green-200 pb-1 last:border-0 last:pb-0 text-green-900">
                                                <span>{fee.fee_name} {fee.authority_name ? `(${fee.authority_name})` : ''} {fee.source === 'manual' ? '(Manual)' : '(Linked)'}</span>
                                                <div className="flex items-center gap-2">
                                                    {fee.source === 'manual' && <span className="font-medium">₹{fee.amount}</span>}
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-red-500"
                                                        onClick={() => {
                                                            const next = [...formItem.government_fees];
                                                            next.splice(idx, 1);
                                                            setFormItem({ ...formItem, government_fees: next });
                                                        }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {rejectedFeesLog.length > 0 && !conditionsChanged && (
                                <div className="mt-4 border rounded-md p-3 bg-red-50 border-red-200">
                                    <div className="text-xs font-bold mb-2 text-red-800">Not Applicable (Rejected):</div>
                                    <div className="space-y-3">
                                        {rejectedFeesLog.map((fee: any, idx: number) => (
                                            <div key={idx} className="text-xs border-b border-red-200 pb-2 last:border-0 last:pb-0">
                                                <div className="font-bold text-red-900">{fee.fee_name}</div>
                                                <div className="text-red-700 mt-1">Reason: {fee.reason || 'Conditions failed'}</div>
                                                {fee.failed_conditions && fee.failed_conditions.length > 0 && (
                                                    <ul className="list-disc pl-4 mt-1 text-red-600 space-y-1">
                                                        {fee.failed_conditions.map((fc: any, cidx: number) => (
                                                            <li key={cidx}>{fc.label} (Expected: {fc.expected_value}, Actual: {fc.actual_value || 'Missing'})</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-end">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-[10px]"
                                    onClick={() => {
                                        setFormItem({
                                            ...formItem,
                                            government_fees: [...formItem.government_fees, { fee_name: '', amount: 0, source: 'manual' }]
                                        });
                                    }}
                                >
                                    + Add Fee Row
                                </Button>
                            </div>
                            {formItem.government_fees.map((fee: any, gIndex: number) => (
                                <div key={gIndex} className="flex gap-2 items-center">
                                    <Input 
                                        placeholder="Fee Name (e.g. Challan)" 
                                        className="h-8 text-xs flex-1" 
                                        value={fee.fee_name}
                                        onChange={(e) => {
                                            const next = [...formItem.government_fees];
                                            next[gIndex].fee_name = e.target.value;
                                            setFormItem({...formItem, government_fees: next});
                                        }} 
                                    />
                                    <div className="relative w-32">
                                        <span className="absolute left-2 top-2 text-[10px] text-muted-foreground">₹</span>
                                        <Input 
                                            type="number" 
                                            className="h-8 pl-5 text-xs" 
                                            value={fee.amount}
                                            onChange={(e) => {
                                                const next = [...formItem.government_fees];
                                                next[gIndex].amount = parseFloat(e.target.value) || 0;
                                                setFormItem({...formItem, government_fees: next});
                                            }} 
                                        />
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                            const next = [...formItem.government_fees];
                                            next.splice(gIndex, 1);
                                            setFormItem({...formItem, government_fees: next});
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 mt-4 rounded-lg border bg-card/50 space-y-4 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 border-b pb-2">Validity & Applicability</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Applicable From</label>
                            <Input
                                type="date"
                                className="w-[200px] max-w-full"
                                value={formItem.applicable_from}
                                min={mainRateCard?.applicable_from ? new Date(mainRateCard.applicable_from).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                onChange={(e) => setFormItem({...formItem, applicable_from: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Applicability Mode</label>
                            <RadioGroup 
                                value={formItem.applicability_mode} 
                                onValueChange={(val) => setFormItem({...formItem, applicability_mode: val})} 
                                className="flex gap-4 mt-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="until_next_rate" id="mode_until_next" />
                                    <label htmlFor="mode_until_next" className="font-normal cursor-pointer text-sm">Until Next Rate</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="specific_expiry" id="mode_specific_expiry" />
                                    <label htmlFor="mode_specific_expiry" className="font-normal cursor-pointer text-sm">Specific Expiry</label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                    {formItem.applicability_mode === 'specific_expiry' && (
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Applicable Until</label>
                            <Input
                                type="date"
                                className="w-[200px] max-w-full"
                                value={formItem.applicable_until}
                                min={formItem.applicable_from || new Date().toISOString().split('T')[0]}
                                onChange={(e) => setFormItem({...formItem, applicable_until: e.target.value})}
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t mt-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Service Item Total</span>
                        <span className="text-lg font-black text-primary">₹ {liveItemTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSaveItem} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Item
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
    );
}

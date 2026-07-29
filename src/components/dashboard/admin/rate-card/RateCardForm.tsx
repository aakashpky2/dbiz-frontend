'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Loader2, Save, X, Edit3, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { rateCardService } from '@/services/rateCardService';
import { useAssociates } from '@/hooks/use-associates';
import { useClients } from '@/hooks/use-clients';
import { useProfiles, useBusinessConstitutions } from '@/hooks/use-profiles';
import { useRateCards } from '@/hooks/useRateCards';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RateCardItemsSection from './RateCardItemsSection';
import { listenToDepartments, Department } from '@/lib/department-management';
import { sortDepartmentHierarchy } from '@/lib/sorting';
import { useDebounce } from '@/hooks/use-debounce';

const rateCardSchema = z.object({
    name: z.string().min(1, 'Rate Card Name is required'),
    constitution_ids: z.array(z.string()).optional().default([]),
    sub_constitution_ids: z.array(z.string()).optional().default([]),
    business_profile_ids: z.array(z.string()).optional().default([]),
    client_types: z.array(z.string()).optional().default([]),
    associate_ids: z.array(z.string()).optional().default([]),
    client_ids: z.array(z.string()).optional().default([]),
    // Legacy fields for backward compatibility
    client_type: z.string().optional().nullable(),
    associate_id: z.string().optional().nullable(),
    client_id: z.string().optional().nullable(),
    business_profile_id: z.string().optional().nullable(),
    applicable_from: z.date({ required_error: 'Applicable From date is required' }),
    applicability_mode: z.enum(['specific_expiry', 'until_next_rate']),
    applicable_until: z.date().optional().nullable(),
    items: z.any().array().optional()
});

export type RateCardFormValues = z.infer<typeof rateCardSchema>;

interface RateCardFormProps {
    rateCardId?: string;
    onSuccess: (newId?: string) => void;
    onCancel: () => void;
}

export default function RateCardForm({ rateCardId, onSuccess, onCancel }: RateCardFormProps) {
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    
    const [viewMode, setViewMode] = useState<'basic' | 'services'>(rateCardId ? 'services' : 'basic');
    const [viewClientsOpen, setViewClientsOpen] = useState(false);
    const [viewClientsSearch, setViewClientsSearch] = useState('');
    
    // Server-side search state
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const debouncedClientSearch = useDebounce(clientSearchTerm, 500);
    const [associateSearchTerm, setAssociateSearchTerm] = useState('');
    const debouncedAssociateSearch = useDebounce(associateSearchTerm, 500);

    const [initialRateCardData, setInitialRateCardData] = useState<any>(null);

    const { toast } = useToast();

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    
    // Fetch all related data
    const { data: associatesResponse, isLoading: associatesLoading } = useAssociates({ page: 1, limit: 50, search: debouncedAssociateSearch });
    const { data: clientsResponse, isLoading: clientsLoading } = useClients({ limit: 50, search: debouncedClientSearch });
    const { profiles: businessProfiles, loading: profilesLoading } = useProfiles();
    const { constitutions, loading: constLoading } = useBusinessConstitutions();
    const { rateCards } = useRateCards({ limit: 1000 });

    const associates = useMemo(() => {
        const fetched = (associatesResponse?.data || []).filter((a: any) => a.status === 'Active' || a.is_active === true);
        const initial = initialRateCardData?.associates || [];
        const combined = [...fetched, ...initial];
        // Deduplicate by ID
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique;
    }, [associatesResponse?.data, initialRateCardData]);

    const clients = useMemo(() => {
        const fetched = clientsResponse?.data || [];
        const initial = initialRateCardData?.clients || [];
        const combined = [...fetched, ...initial];
        // Deduplicate by ID
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique;
    }, [clientsResponse?.data, initialRateCardData]);

    // Extract unique previous rate card names for autocomplete
    const uniqueRateCardNames = useMemo(() => {
        return Array.from(new Set(rateCards.map((rc: any) => rc.name))).filter(Boolean) as string[];
    }, [rateCards]);

    const form = useForm<RateCardFormValues>({
        resolver: zodResolver(rateCardSchema),
        defaultValues: {
            name: '',
            constitution_ids: [],
            sub_constitution_ids: [],
            business_profile_ids: [],
            client_types: [],
            associate_ids: [],
            client_ids: [],
            client_type: null,
            associate_id: null,
            client_id: null,
            business_profile_id: null,
            applicable_from: new Date(),
            applicability_mode: 'until_next_rate',
            applicable_until: null,
            items: []
        }
    });

    const applicabilityMode = form.watch('applicability_mode');

    const rawFormConstitutions = form.watch('constitution_ids');
    const formConstitutions = useMemo(() => rawFormConstitutions || [], [rawFormConstitutions]);
    const rawFormSubConstitutions = form.watch('sub_constitution_ids');
    const formSubConstitutions = useMemo(() => rawFormSubConstitutions || [], [rawFormSubConstitutions]);
    const rawFormClientTypes = form.watch('client_types');
    const formClientTypes = useMemo(() => rawFormClientTypes || [], [rawFormClientTypes]);
    const rawFormAssociateIds = form.watch('associate_ids');
    const formAssociateIds = useMemo(() => rawFormAssociateIds || [], [rawFormAssociateIds]);

    const constitutionOptions = useMemo(() => {
        const set = new Set<string>();
        constitutions.forEach(c => {
            if (c.businessType) set.add(c.businessType);
        });
        return Array.from(set).map(c => ({ label: c, value: c }));
    }, [constitutions]);

    const subConstitutionOptions = useMemo(() => {
        const set = new Set<string>();
        constitutions.forEach(c => {
            if (c.businessSubType) {
                if (formConstitutions.length === 0 || formConstitutions.includes(c.businessType)) {
                    set.add(c.businessSubType);
                }
            }
        });
        return Array.from(set).map(c => ({ label: c, value: c }));
    }, [constitutions, formConstitutions]);

    const businessProfileOptions = useMemo(() => {
        return businessProfiles.filter(bp => {
            const constObj = constitutions.find(c => c.id === bp.constitutionId);
            if (!constObj) return true;
            if (formConstitutions.length > 0 && !formConstitutions.includes(constObj.businessType)) return false;
            if (formSubConstitutions.length > 0 && !formSubConstitutions.includes(constObj.businessSubType)) return false;
            return true;
        }).map(bp => ({ label: bp.profileName, value: bp.id }));
    }, [businessProfiles, constitutions, formConstitutions, formSubConstitutions]);

    const associateOptions = useMemo(() => {
        return associates.map((a: any) => ({
            label: a.company_name || a.companyName || a.name,
            value: a.id
        }));
    }, [associates]);

    const filteredClients = useMemo(() => {
        return clients.filter((client: any) => {
            const clientAssociateId = client.associate_id || client.associateId || null;
            if (formClientTypes.length === 0) return true;
            if (clientAssociateId) {
                if (!formClientTypes.includes('associate')) return false;
                if (formAssociateIds.length > 0 && !formAssociateIds.includes(String(clientAssociateId))) return false;
                return true;
            } else {
                return formClientTypes.includes('direct');
            }
        });
    }, [clients, formClientTypes, formAssociateIds]);

    const clientOptions = useMemo(() => {
        return filteredClients.map((c: any) => ({
            label: c.clientName || c.client_name,
            value: c.id
        }));
    }, [filteredClients]);

    // Load Departments
    useEffect(() => {
        const unsubscribe = listenToDepartments((data) => {
            const activeOnly = data.filter(d => !d.isDeleted && d.isValidated);
            setDepartments(sortDepartmentHierarchy(activeOnly));
        });
        return () => unsubscribe();
    }, []);

    // Load Initial Data
    useEffect(() => {
        if (rateCardId) {
            if (departments.length === 0) return; // Wait until departments are loaded to hydrate items

            const loadRateCard = async () => {
                setInitialLoading(true);
                try {
                    const res = await rateCardService.getById(rateCardId);
                    if (res.success) {
                        const data = res.data;
                        setInitialRateCardData(data);
                        const hydratedItems = data.items.map((item: any) => {
                            let resolvedDeptId = '';
                            let resolvedCatId = '';
                            for (const dept of departments) {
                                for (const cat of (dept.workCategories || [])) {
                                    if ((cat.workTypes || []).some((t: any) => String(t.id) === String(item.work_item_id))) {
                                        resolvedDeptId = String(dept.id);
                                        resolvedCatId = String(cat.id);
                                        break;
                                    }
                                }
                                if (resolvedDeptId) break;
                            }
                            return {
                                department_id: resolvedDeptId,
                                category_id: resolvedCatId,
                                work_item_id: item.work_item_id,
                                work_item_name: item.work_item_name,
                                professional_fee: parseFloat(item.professional_fee),
                                government_fees: (item.government_fees || []).map((fee: any) => ({
                                    fee_name: fee.fee_name,
                                    amount: parseFloat(fee.amount)
                                }))
                            };
                        });

                        form.reset({
                            name: data.name || "",
                            constitution_ids: Array.isArray(data.constitution_ids) ? data.constitution_ids : [],
                            sub_constitution_ids: Array.isArray(data.sub_constitution_ids) ? data.sub_constitution_ids : [],
                            business_profile_ids: Array.isArray(data.business_profile_ids) ? data.business_profile_ids : data.business_profile_id ? [data.business_profile_id] : [],
                            client_types: Array.isArray(data.client_types) ? data.client_types : data.client_type ? [data.client_type] : [],
                            associate_ids: Array.isArray(data.associate_ids) ? data.associate_ids : data.associate_id ? [data.associate_id] : [],
                            client_ids: Array.isArray(data.client_ids) ? data.client_ids : data.client_id ? [data.client_id] : [],
                            client_type: data.client_type || null,
                            associate_id: data.associate_id || null,
                            client_id: data.client_id || null,
                            business_profile_id: data.business_profile_id || null,
                            applicable_from: data.applicable_from ? new Date(data.applicable_from) : new Date(),
                            applicability_mode: data.applicability_mode || 'until_next_rate',
                            applicable_until: data.applicable_until ? new Date(data.applicable_until) : null,
                            items: hydratedItems
                        });
                    }
                } catch (err) {
                    toast({ title: 'Error', description: 'Failed to load rate card', variant: 'destructive' });
                } finally {
                    setInitialLoading(false);
                }
            };
            loadRateCard();
        } else {
            setInitialRateCardData(null);
            form.reset({
                name: '',
                constitution_ids: [],
                sub_constitution_ids: [],
                business_profile_ids: [],
                client_types: [],
                associate_ids: [],
                client_ids: [],
                client_type: null,
                associate_id: null,
                client_id: null,
                business_profile_id: null,
                applicable_from: new Date(),
                applicability_mode: 'until_next_rate',
                applicable_until: null,
                items: []
            });
        }
    }, [rateCardId, departments, departments.length, form, toast]);

    const onSubmit = async (values: RateCardFormValues) => {
        console.log("Initial edit form state:", form.getValues());
        setLoading(true);
        try {
            let derivedClientTypes = values.client_types || [];
            if (derivedClientTypes.includes('direct') && derivedClientTypes.includes('associate')) {
                derivedClientTypes = [];
            }

            const deriveLegacyClientType = (cTypes: string[]) => {
                if (!cTypes || cTypes.length === 0) return 'direct';
                if (cTypes.includes('direct')) return 'direct';
                if (cTypes.includes('associate')) return 'associate';
                return 'direct';
            };

            const payload = {
                ...values,
                client_ids: values.client_ids,
                client_id: values.client_ids?.length ? values.client_ids[0] : null,
                associate_id: values.associate_ids?.length ? values.associate_ids[0] : null,
                business_profile_id: values.business_profile_ids?.length ? values.business_profile_ids[0] : null,
                client_types: derivedClientTypes,
                client_type: deriveLegacyClientType(derivedClientTypes),
                applicable_from: format(values.applicable_from, 'yyyy-MM-dd'),
                applicable_until: values.applicable_until ? format(values.applicable_until, 'yyyy-MM-dd') : null
            };

            console.log("Saving rate card payload:", payload);

            let savedId = rateCardId;
            if (rateCardId) {
                const res = await rateCardService.update(rateCardId, payload);
                console.log("Save response:", res);
                if (res.success) {
                    toast({ title: 'Success', description: 'Rate card updated successfully.' });
                    onSuccess(rateCardId);
                } else {
                    toast({ title: 'Error', description: res.error || 'Failed to update rate card.', variant: 'destructive' });
                }
            } else {
                const res = await rateCardService.create(payload);
                if (res.success) {
                    toast({ title: 'Success', description: 'Rate card created successfully.' });
                    onSuccess(res.data.id);
                } else {
                    toast({ title: 'Error', description: res.error || 'Failed to create rate card.', variant: 'destructive' });
                }
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="flex flex-col h-full bg-background relative">
            <div className="flex items-center justify-between p-4 border-b bg-card z-10 shrink-0 sticky top-0">
                <div>
                    <h2 className="text-lg font-bold">{rateCardId ? 'Edit Rate Card Details' : 'New Rate Card'}</h2>
                    <p className="text-xs text-muted-foreground">Configure basic settings and applicability</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} size="sm">
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button onClick={form.handleSubmit(onSubmit as any)} disabled={loading} size="sm">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {rateCardId ? 'Save Changes' : 'Save'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <Form {...form}>
                    <form className="space-y-6 max-w-4xl mx-auto">
                        
                        <div className="p-4 rounded-lg border bg-card/50 space-y-4 shadow-sm">
                            <h3 className="text-sm font-semibold mb-4 border-b pb-2">General Information</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <FormField
                                    control={form.control as any}
                                    name="constitution_ids"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Constitution</FormLabel>
                                            <FormControl>
                                                <MultiSelectCombobox
                                                    options={constitutionOptions}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="All Constitutions"
                                                    disabled={constLoading}
                                                    selectedItemsLabel="Constitutions Selected"
                                                    selectAllLabel="All Constitutions"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control as any}
                                    name="sub_constitution_ids"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sub Constitution</FormLabel>
                                            <FormControl>
                                                <MultiSelectCombobox
                                                    options={subConstitutionOptions}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="All Sub Constitutions"
                                                    disabled={constLoading}
                                                    selectedItemsLabel="Sub Constitutions Selected"
                                                    selectAllLabel="All Sub Constitutions"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <FormField
                                    control={form.control as any}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Rate Card Name</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    placeholder="e.g. Standard Direct Rates" 
                                                    list="rate-card-names" 
                                                    autoComplete="off"
                                                    className="truncate"
                                                    title={field.value}
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <datalist id="rate-card-names">
                                                {uniqueRateCardNames.map((name, i) => (
                                                    <option key={i} value={name} />
                                                ))}
                                            </datalist>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control as any}
                                    name="business_profile_ids"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Business Profile</FormLabel>
                                            <FormControl>
                                                <MultiSelectCombobox
                                                    options={businessProfileOptions}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="All Business Profiles"
                                                    disabled={profilesLoading}
                                                    selectedItemsLabel="Profiles Selected"
                                                    selectAllLabel="All Business Profiles"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <FormField
                                    control={form.control as any}
                                    name="client_types"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Client Type</FormLabel>
                                            <FormControl>
                                                <MultiSelectCombobox
                                                    options={[
                                                        { label: "Direct", value: "direct" },
                                                        { label: "Associate", value: "associate" }
                                                    ]}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="All Client Types"
                                                    selectedItemsLabel="Types Selected"
                                                    selectAllLabel="All Client Types"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control as any}
                                    name="associate_ids"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Associate</FormLabel>
                                            <FormControl>
                                                <MultiSelectCombobox
                                                    options={associateOptions}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="All Associates"
                                                    disabled={associatesLoading && associates.length === 0}
                                                    selectedItemsLabel="Associates Selected"
                                                    selectAllLabel="All Associates"
                                                    onSearchChange={setAssociateSearchTerm}
                                                    loading={associatesLoading}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="mb-4">
                                <FormField
                                    control={form.control as any}
                                    name="client_ids"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Client</FormLabel>
                                            <div className="flex gap-2 items-start">
                                                <div className="flex-1 min-w-0">
                                                    <MultiSelectCombobox
                                                        options={clientOptions}
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="All Clients"
                                                        disabled={clientsLoading && clients.length === 0}
                                                        selectedItemsLabel="Clients Selected"
                                                        maxDisplay={1}
                                                        selectAllLabel="All Clients"
                                                        onSearchChange={setClientSearchTerm}
                                                        loading={clientsLoading}
                                                    />
                                                </div>
                                                {field.value && field.value.length > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-10 shrink-0"
                                                        onClick={() => setViewClientsOpen(true)}
                                                    >
                                                        View Selected
                                                    </Button>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border bg-card/50 space-y-4 shadow-sm">
                            <h3 className="text-sm font-semibold mb-4 border-b pb-2">Validity & Applicability</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control as any}
                                    name="applicable_from"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Applicable From</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    className="w-[200px] max-w-full"
                                                    value={field.value ? field.value.toISOString().split('T')[0] : ""}
                                                    min={today.toISOString().split('T')[0]}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            const d = new Date(val);
                                                            if (d >= today) field.onChange(d);
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control as any}
                                    name="applicability_mode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Applicability Mode</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 mt-2">
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="until_next_rate" /></FormControl>
                                                        <FormLabel className="font-normal cursor-pointer text-sm">Until Next Rate</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="specific_expiry" /></FormControl>
                                                        <FormLabel className="font-normal cursor-pointer text-sm">Specific Expiry</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {applicabilityMode === 'specific_expiry' && (
                                <FormField
                                    control={form.control as any}
                                    name="applicable_until"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Applicable Until</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    className="w-[200px] max-w-full"
                                                    value={field.value ? field.value.toISOString().split('T')[0] : ""}
                                                    min={form.watch("applicable_from") ? form.watch("applicable_from")!.toISOString().split('T')[0] : today.toISOString().split('T')[0]}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val) field.onChange(new Date(val));
                                                        else field.onChange(null);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </form>
                </Form>
            </div>

            <Dialog open={viewClientsOpen} onOpenChange={setViewClientsOpen}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-4 border-b pb-4">
                        <DialogTitle>Selected Clients</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 flex-1 overflow-y-auto">
                        <div className="relative mb-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search clients..."
                                className="pl-9"
                                value={viewClientsSearch}
                                onChange={(e) => setViewClientsSearch(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            {form.watch('client_ids')
                                .filter(id => id !== 'all')
                                .map(id => {
                                    const c = clients.find((client: any) => client.id === id);
                                    if (!c) return null;
                                    const match = (c.clientName || c.client_name || '').toLowerCase().includes(viewClientsSearch.toLowerCase());
                                    if (!match) return null;
                                    return (
                                        <div key={id} className="p-2 border rounded text-sm bg-muted/50">
                                            {c.clientName || c.client_name}
                                        </div>
                                    );
                                })}
                            {form.watch('client_ids').filter(id => id !== 'all').length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No clients selected.</p>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

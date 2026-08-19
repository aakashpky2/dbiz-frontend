'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Save, FileText, CheckCircle2, Building, AlertCircle, Send, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHero } from '@/components/dashboard/page-hero';
import { apiFetch } from '@/lib/apiFetch';
import { supabase } from '@/lib/supabase';

function normalizeListResponse(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response.data && response.data.data && Array.isArray(response.data.data)) return response.data.data;
    if (response.clients && Array.isArray(response.clients)) return response.clients;
    if (response.profiles && Array.isArray(response.profiles)) return response.profiles;
    if (response.works && Array.isArray(response.works)) return response.works;
    if (response.items && Array.isArray(response.items)) return response.items;
    if (response.results && Array.isArray(response.results)) return response.results;
    if (response.records && Array.isArray(response.records)) return response.records;
    if (response.steps && Array.isArray(response.steps)) return response.steps;
    return [];
}

const getDisplayName = (item: any, type: 'profile' | 'client' | 'work' | 'step') => {
    if (!item) return '';
    if (type === 'profile') return item.profile_name || item.profileName || item.name || item.company_name || 'Unnamed Profile';
    if (type === 'client') return item.client_name || item.clientName || item.name || item.company_name || 'Unnamed Client';
    if (type === 'work') return item.work_type_name || item.workTypeName || item.title || item.name || item.service_name || 'Unnamed Work';
    if (type === 'step') return item.step_name || item.name || item.title || item.workflow_step_name || 'Unnamed Step';
    return '';
};

export default function CreateInvoicePage() {
    return (
        <React.Suspense fallback={<div className="p-10 flex justify-center"><Skeleton className="h-10 w-40" /></div>}>
            <CreateInvoiceContent />
        </React.Suspense>
    );
}

function CreateInvoiceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    // Logic States
    const [clients, setClients] = useState<any[]>([]);
    const [works, setWorks] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [eligibleSteps, setEligibleSteps] = useState<any[]>([]);

    const [clientId, setClientId] = useState(searchParams.get('client_id') || '');
    const [workId, setWorkId] = useState(searchParams.get('work_id') || '');
    const [profileId, setProfileId] = useState('');
    // Unified billing params from Billable Works table
    const [billableType] = useState(searchParams.get('billable_type') || '');
    const [sourceRef] = useState(searchParams.get('source_ref') || '');
    const [sourceId] = useState(searchParams.get('source_id') || '');
    // Legacy billing mode for manually-created bills
    const [billingType, setBillingType] = useState(searchParams.get('billing_type') || 'full_work');
    const [workflowStepInstanceId, setWorkflowStepInstanceId] = useState(searchParams.get('workflow_step_instance_id') || searchParams.get('step_id') || '');
    const [executionInstanceId, setExecutionInstanceId] = useState(searchParams.get('execution_instance_id') || '');
    const [workflowStepId, setWorkflowStepId] = useState(searchParams.get('workflow_step_id') || '');
    const [workflowTemplateId, setWorkflowTemplateId] = useState(searchParams.get('workflow_template_id') || '');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');

    const [items, setItems] = useState([
        { fee_type: 'Professional Fee', particulars: '', amount: '', gst_applicable: false, gst_rate: '18' }
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Loading States
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isClientsLoading, setIsClientsLoading] = useState(false);
    const [isProfilesLoading, setIsProfilesLoading] = useState(false);
    const [isWorksLoading, setIsWorksLoading] = useState(false);
    const [isStepsLoading, setIsStepsLoading] = useState(false);
    const [isWorkDataLoading, setIsWorkDataLoading] = useState(false);

    // Error States
    const [configError, setConfigError] = useState('');
    const [clientsError, setClientsError] = useState('');
    const [profilesError, setProfilesError] = useState('');
    const [worksError, setWorksError] = useState('');
    const [stepsError, setStepsError] = useState('');
    const [autofillError, setAutofillError] = useState('');

    useEffect(() => {
        const fetchInitial = async () => {
            setIsInitialLoading(true);
            setIsClientsLoading(true);
            setIsProfilesLoading(true);

            // Fetch Clients
            apiFetch('/api/clients?limit=100') // Increasing limit to improve likelihood, but fallback remains
                .then(async res => {
                    if (!res.ok) {
                        let text = await res.text();
                        if (text.trim().startsWith('<')) text = `Endpoint unavailable (${res.status})`;
                        throw new Error(text || `Request failed with ${res.status}`);
                    }
                    return res.json();
                })
                .then(async data => {
                    if (process.env.NODE_ENV === 'development') console.log('[CreateBill] clients response:', data);
                    let fetchedClients = normalizeListResponse(data);
                    
                    // If a specific clientId is provided in the URL, ensure it is in the list
                    if (clientId && !fetchedClients.some(c => String(c.id) === String(clientId))) {
                        try {
                            const singleRes = await apiFetch(`/api/clients/${clientId}`);
                            if (singleRes.ok) {
                                const singleData = await singleRes.json();
                                if (singleData.success && singleData.data) {
                                    fetchedClients = [...fetchedClients, singleData.data];
                                }
                            }
                        } catch (err) {
                            console.error('Failed to fetch specific client:', err);
                        }
                    }
                    
                    setClients(fetchedClients);
                })
                .catch(err => {
                    console.error('Clients fetch error:', err);
                    setClientsError("Unable to load clients.");
                })
                .finally(() => setIsClientsLoading(false));

            // Fetch Profiles using Supabase (pattern used across the app)
            const fetchProfilesData = async () => {
                try {
                    const { data, error } = await supabase.from('business_profiles').select('*');
                    if (error) throw error;
                    if (process.env.NODE_ENV === 'development') console.log('[CreateBill] profiles response:', data);
                    const normalized = normalizeListResponse(data);
                    setProfiles(normalized);
                    const def = normalized.find((p: any) => p.is_default);
                    if (def) setProfileId(String(def.id));
                } catch (err: any) {
                    console.error('Profiles fetch error:', err);
                    setProfilesError("Business profile endpoint not found. Unable to load profiles.");
                } finally {
                    setIsProfilesLoading(false);
                }
            };
            fetchProfilesData();

            setIsInitialLoading(false);
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        if (!clientId) {
            setWorks([]);
            return;
        }

        const fetchWorks = async () => {
            setIsWorksLoading(true);
            setWorksError('');
            try {
                const res = await apiFetch(`/api/tasks?clientId=${clientId}`);
                if (!res.ok) {
                    let text = await res.text();
                    if (res.status === 410) {
                        throw new Error("Work endpoint deprecated. Please use task endpoint.");
                    }
                    if (text.trim().startsWith('<')) text = `Endpoint unavailable (${res.status})`;
                    throw new Error(text || `Request failed with ${res.status}`);
                }
                const data = await res.json();
                if (process.env.NODE_ENV === 'development') console.log('[CreateBill] tasks response:', data);
                
                let normalized = normalizeListResponse(data);
                normalized = normalized.map((w: any) => ({
                    ...w,
                    id: w.id,
                    title: w.work_type_name || w.task_name || w.work_name || w.title || w.service_name || 'Unnamed Work',
                    status: w.status || w.task_status || w.work_status || w.current_status || ''
                })).filter((w: any) => {
                    const status = w.status;
                    return status !== 'Cancelled' && status !== 'Deleted';
                });
                setWorks(normalized);
            } catch (err: any) {
                console.error('Tasks fetch error:', err);
                setWorksError(err.message || "Unable to load works/tasks for this client.");
            } finally {
                setIsWorksLoading(false);
            }
        };
        fetchWorks();
    }, [clientId]);

    const fetchAutofillData = useCallback(async () => {
        if (!workId) return;
        setIsWorkDataLoading(true);
        setAutofillError('');
        try {
            const autofillRes = await apiFetch(`/api/billing/autofill-data/${workId}`);
            if (!autofillRes.ok) {
                if (autofillRes.status === 500) {
                    setAutofillError("Unable to load autofill data.");
                } else {
                    const errText = await autofillRes.text();
                    console.error("[Billing] Autofill API failed", errText);
                }
                setIsWorkDataLoading(false);
                return;
            }
            const autofillData = await autofillRes.json();
            if (process.env.NODE_ENV === 'development') console.log('[CreateBill] autofill response:', autofillData);

            if (autofillData.success === true) {
                if (autofillData.autofillAvailable === false || !autofillData.data) {
                    console.info("[Billing] No autofill configured for this work.");
                } else {
                    const profFee = autofillData.data.professional_fee || 0;
                    const govtFee = autofillData.data.government_fee || 0;

                    if (profFee > 0 || govtFee > 0) {
                        const newItems = [];
                        if (profFee > 0) {
                            newItems.push({ fee_type: 'Professional Fee', particulars: 'Professional Services', amount: profFee.toString(), gst_applicable: true, gst_rate: '18' });
                        }
                        if (govtFee > 0) {
                            newItems.push({ fee_type: 'Government Fee', particulars: 'Statutory/Government Fee', amount: govtFee.toString(), gst_applicable: false, gst_rate: '0' });
                        }
                        setItems(newItems);
                    }
                }
            }
        } catch (err) {
            console.error('Autofill data fetch error:', err);
            setAutofillError("Autofill data could not be loaded. You can add items manually.");
        } finally {
            setIsWorkDataLoading(false);
        }
    }, [workId]);

    useEffect(() => {
        fetchAutofillData();
    }, [fetchAutofillData]);

    useEffect(() => {
        if (!workId || billingType !== 'workflow_step') return;

        const fetchEligibleSteps = async () => {
            setIsStepsLoading(true);
            setStepsError('');
            try {
                const stepRes = await apiFetch(`/api/billing/eligible-steps/${workId}`);
                if (!stepRes.ok) {
                    setStepsError(`Eligible steps endpoint unavailable (${stepRes.status})`);
                    setIsStepsLoading(false);
                    return;
                }
                const stepData = await stepRes.json();
                if (process.env.NODE_ENV === 'development') console.log('[CreateBill] eligible steps response:', stepData);
                
                setEligibleSteps(normalizeListResponse(stepData));
            } catch (err) {
                console.error('Eligible steps fetch error:', err);
                setStepsError("Unable to load eligible workflow steps.");
            } finally {
                setIsStepsLoading(false);
            }
        };

        fetchEligibleSteps();
    }, [workId, billingType]);

    const handleClientChange = (val: string) => {
        setClientId(val);
        setWorkId('');
        setWorkflowStepInstanceId('');
        setWorks([]);
        setEligibleSteps([]);
    };

    const handleWorkChange = (val: string) => {
        setWorkId(val);
        setWorkflowStepInstanceId('');
        setEligibleSteps([]);
    };

    const handleBillingTypeChange = (val: string) => {
        setBillingType(val);
        if (val === 'full_work') {
            setWorkflowStepInstanceId('');
            setEligibleSteps([]);
        }
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { fee_type: 'Professional Fee', particulars: '', amount: '', gst_applicable: false, gst_rate: '18' }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            const newItems = [...items];
            newItems.splice(index, 1);
            setItems(newItems);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!clientId || !workId || !profileId) {
            toast?.({ title: "Validation Error", description: "Please select Client, Work, and Business Profile.", variant: "destructive" });
            return;
        }

        if (billingType === 'workflow_step' && !workflowStepInstanceId) {
            toast?.({ title: "Validation Error", description: "Please select an eligible workflow step.", variant: "destructive" });
            return;
        }

        const validItems = items.filter(i => i.particulars.trim() !== '' && parseFloat(i.amount) > 0);
        if (validItems.length === 0) {
            toast?.({ title: "Validation Error", description: "Please add at least one valid line item with an amount greater than 0.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                client_id: clientId,
                work_id: workId,
                // Unified billing fields (from Billable Works → Create Bill flow)
                billable_type: billableType || undefined,
                source_id: sourceId || undefined,
                source_ref: sourceRef || undefined,
                // Legacy fields (from manual Create Bill flow)
                billing_type: billingType,
                workflow_step_instance_id: workflowStepInstanceId || null,
                execution_instance_id: executionInstanceId || null,
                workflow_step_id: workflowStepId || null,
                workflow_template_id: workflowTemplateId || null,
                business_profile_id: profileId,
                invoice_date: invoiceDate,
                due_date: dueDate || null,
                notes,
                items: validItems.map(i => ({
                    fee_type: i.fee_type,
                    particulars: i.particulars,
                    amount: parseFloat(i.amount),
                    gst_applicable: i.gst_applicable,
                    gst_rate: i.gst_applicable ? parseFloat(i.gst_rate) : 0
                }))
            };

            const res = await apiFetch(`/api/billing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                let text = await res.text();
                if (text.trim().startsWith('<')) text = `Billing endpoint unavailable (${res.status})`;
                throw new Error(text || `Request failed with ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                toast?.({ title: "Success", description: "Bill created successfully!", variant: "default" });
                router.push('/dashboard/accounts/billing');
            } else {
                toast?.({ title: "Error", description: data.message, variant: "destructive" });
            }
        } catch (error) {
            console.error('Create bill error:', error);
            toast?.({ title: "Error", description: "Failed to create bill. Please check the console for details.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    let profFeeTotal = 0;
    let govtFeeTotal = 0;
    let reimbTotal = 0;
    let taxableValue = 0;
    let totalGST = 0;

    items.forEach(i => {
        const amt = parseFloat(i.amount) || 0;

        if (i.fee_type === 'Professional Fee') profFeeTotal += amt;
        else if (i.fee_type === 'Government Fee') govtFeeTotal += amt;
        else if (i.fee_type === 'Reimbursement') reimbTotal += amt;

        if (i.gst_applicable) {
            taxableValue += amt;
            if (i.gst_rate) {
                totalGST += (amt * parseFloat(i.gst_rate)) / 100;
            }
        }
    });

    const grandTotal = profFeeTotal + govtFeeTotal + reimbTotal + totalGST;

    return (
        <div className="bg-slate-50/50 min-h-screen">
            {/* Page Header */}
            <div className="mb-6 px-6 md:px-10 pt-6">
            <PageHero
                pattern="pattern-3"
                compact
                icon={FileText}
                badge="CREATE BILL"
                title="Create Bill"
                description={
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mt-1">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium">Draft</Badge>
                            {billableType && (
                                <Badge className={billableType === 'WORKFLOW' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                                    {billableType === 'WORKFLOW' ? 'Full Workflow' : 'Step Billing'}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 mt-2">Generate internal bill from work or workflow step.</p>
                        <p className="text-xs text-slate-400 mt-0.5">Tax invoice will be generated only after approval.</p>
                    </div>
                }
            />
            </div>


            {/* Main Layout */}
            <div className="px-6 py-8 md:px-10 pb-40">
                <div className="w-full max-w-none">
                    <form id="create-bill-form" onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">

                        {/* Left / Main Column */}
                        <div className="space-y-6">

                            {/* Billing Context Card */}
                            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b px-6 py-4 flex flex-row items-center gap-2">
                                    <Building className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <CardTitle className="text-lg font-semibold text-slate-800">Billing Context</CardTitle>
                                        <CardDescription className="text-sm text-slate-500">Select the profile, client, work, and billing mode.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    
                                    {/* Business Profile */}
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold uppercase text-xs tracking-wider">Billing Business Profile <span className="text-red-500">*</span></Label>
                                        {isProfilesLoading || isInitialLoading ? <Skeleton className="h-11 w-full rounded-lg" /> : (
                                            <Select value={profileId} onValueChange={setProfileId} required disabled={isProfilesLoading || !!configError}>
                                                <SelectTrigger className="h-11 rounded-lg border-slate-300 focus:ring-blue-600">
                                                    <SelectValue placeholder="Select Profile" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {profiles.length === 0 ? (
                                                        <SelectItem value="__empty_profiles" disabled>No business profiles found</SelectItem>
                                                    ) : profiles.map(p => (
                                                        <SelectItem key={p.id} value={String(p.id)}>{getDisplayName(p, 'profile')}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {(profilesError || configError) && <p className="text-xs text-red-500 mt-1">{configError || profilesError}</p>}
                                    </div>

                                    {/* Client */}
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold uppercase text-xs tracking-wider">Client <span className="text-red-500">*</span></Label>
                                        {isClientsLoading || isInitialLoading ? <Skeleton className="h-11 w-full rounded-lg" /> : (
                                            <Select value={clientId} onValueChange={handleClientChange} required disabled={isClientsLoading || !!configError}>
                                                <SelectTrigger className="h-11 rounded-lg border-slate-300 focus:ring-blue-600">
                                                    <SelectValue placeholder="Select Client" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {clients.length === 0 ? (
                                                        <SelectItem value="__empty_clients" disabled>No clients found</SelectItem>
                                                    ) : clients.map(c => (
                                                        <SelectItem key={c.id} value={String(c.id)}>{getDisplayName(c, 'client')}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {(clientsError || configError) && <p className="text-xs text-red-500 mt-1">{configError || clientsError}</p>}
                                    </div>

                                    {/* Work */}
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
                                            Work <span className="text-red-500">*</span>
                                        </Label>
                                        {isWorksLoading ? <Skeleton className="h-11 w-full rounded-lg" /> : (
                                            <Select value={workId} onValueChange={handleWorkChange} required disabled={!clientId || isWorksLoading || !!configError}>
                                                <SelectTrigger className={`h-11 rounded-lg border-slate-300 focus:ring-blue-600 ${!clientId ? 'bg-slate-100/50' : ''}`}>
                                                    <SelectValue placeholder={!clientId ? "Select client first" : "Select Work"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {!clientId ? (
                                                        <SelectItem value="__empty_client_first" disabled>Select client first</SelectItem>
                                                    ) : works.length === 0 ? (
                                                        <SelectItem value="__empty_works" disabled>No works found for this client</SelectItem>
                                                    ) : works.map(w => (
                                                        <SelectItem key={w.id} value={String(w.id)}>
                                                            {getDisplayName(w, 'work')} ({w.status || w.work_status || w.current_status || 'Unknown'})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {worksError && <p className="text-xs text-red-500 mt-1">{worksError}</p>}
                                        {!clientId && !worksError && <p className="text-xs text-slate-500 mt-1">Please select a client to view their works.</p>}
                                    </div>

                                    {/* Billing Type */}
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
                                            Billing Type <span className="text-red-500">*</span>
                                        </Label>
                                        <Select value={billingType} onValueChange={handleBillingTypeChange} required disabled={!workId}>
                                            <SelectTrigger className={`h-11 rounded-lg border-slate-300 focus:ring-blue-600 ${!workId ? 'bg-slate-100/50' : ''}`}>
                                                <SelectValue placeholder={!workId ? "Select work first" : ""} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="full_work">Full Work (Final Bill)</SelectItem>
                                                <SelectItem value="workflow_step">Step-wise Billing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!workId && <p className="text-xs text-slate-500 mt-1">Requires a selected work.</p>}
                                    </div>

                                    {/* Workflow Step */}
                                    {billingType === 'workflow_step' && (
                                        <div className="space-y-3 md:col-span-2 p-5 bg-blue-50/50 border border-blue-100 rounded-xl">
                                            <Label className="text-blue-900 font-semibold uppercase text-xs tracking-wider">Eligible Workflow Step <span className="text-red-500">*</span></Label>
                                            {isStepsLoading ? <Skeleton className="h-11 w-full rounded-lg bg-blue-200/50" /> : (
                                                <Select value={workflowStepInstanceId} onValueChange={setWorkflowStepInstanceId} required disabled={billingType !== 'workflow_step' || !workId || isStepsLoading || eligibleSteps.length === 0}>
                                                    <SelectTrigger className="h-11 bg-white border-blue-200 rounded-lg focus:ring-blue-600">
                                                        <SelectValue placeholder={eligibleSteps.length === 0 ? "No eligible billable steps" : "Select a completed billable step"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {eligibleSteps.length === 0 ? (
                                                            <SelectItem value="__empty_steps" disabled>No eligible billable steps</SelectItem>
                                                        ) : (
                                                            eligibleSteps.map((step, idx) => (
                                                                <SelectItem key={step.id} value={String(step.id)}>
                                                                    Step {step.step_order || step.order || step.sequence || (idx + 1)}: {getDisplayName(step, 'step')}
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {stepsError && <p className="text-xs text-red-500 mt-1">{stepsError}</p>}
                                            {eligibleSteps.length === 0 && !isStepsLoading && !stepsError && (
                                                <div className="flex items-start gap-2 mt-2 text-sm text-blue-700 bg-blue-100/50 p-3 rounded-md border border-blue-200/50">
                                                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                                    <p>No billable completed steps are available for this work. Ensure previous steps are completed and marked as billable.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold uppercase text-xs tracking-wider">Invoice Date <span className="text-red-500">*</span></Label>
                                        <Input className="h-11 rounded-lg border-slate-300 focus:ring-blue-600" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold uppercase text-xs tracking-wider">Due Date</Label>
                                        <Input className="h-11 rounded-lg border-slate-300 focus:ring-blue-600" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Line Items Card */}
                            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b px-6 py-4 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-slate-800">Line Items</CardTitle>
                                            <CardDescription className="text-sm text-slate-500">Add professional fees, government fees, and reimbursements.</CardDescription>
                                        </div>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-9 shadow-sm rounded-lg border-slate-300 text-slate-700">
                                        <Plus className="h-4 w-4 mr-1.5" /> Add Item
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0 overflow-hidden">
                                    {autofillError && (
                                        <div className="px-6 pt-4 pb-2">
                                            <div className="flex items-center justify-between text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200/50">
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                                    <p>{autofillError}</p>
                                                </div>
                                                <Button type="button" variant="outline" size="sm" onClick={fetchAutofillData} className="h-8 text-red-700 border-red-200 hover:bg-red-100">
                                                    Retry
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {isWorkDataLoading ? (
                                        <div className="p-6 space-y-4">
                                            <Skeleton className="h-10 w-full rounded-md" />
                                            <Skeleton className="h-10 w-full rounded-md" />
                                        </div>
                                    ) : (
                                        <div className="w-full">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                                                    <tr>
                                                        <th className="px-2 md:px-3 py-3 font-semibold text-xs uppercase tracking-wider w-[22%]">Fee Type</th>
                                                        <th className="px-2 md:px-3 py-3 font-semibold text-xs uppercase tracking-wider">Particulars</th>
                                                        <th className="px-2 md:px-3 py-3 font-semibold text-xs uppercase tracking-wider w-[15%] text-right">Amount (₹)</th>
                                                        <th className="px-2 md:px-3 py-3 font-semibold text-xs uppercase tracking-wider w-[10%] text-center">GST App.</th>
                                                        <th className="px-2 md:px-3 py-3 font-semibold text-xs uppercase tracking-wider w-[12%]">Rate</th>
                                                        <th className="px-2 md:px-3 py-3 font-semibold text-xs uppercase tracking-wider w-[8%] text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {items.map((item, index) => (
                                                        <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-2 md:px-3 py-3 align-top">
                                                                <Select value={item.fee_type} onValueChange={(val) => handleItemChange(index, 'fee_type', val)}>
                                                                    <SelectTrigger className="h-10 min-w-0 w-full rounded-lg border-slate-200 focus:ring-blue-600"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="Professional Fee">Professional Fee</SelectItem>
                                                                        <SelectItem value="Government Fee">Government Fee</SelectItem>
                                                                        <SelectItem value="Reimbursement">Reimbursement</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </td>
                                                            <td className="px-2 md:px-3 py-3 align-top">
                                                                <Textarea
                                                                    className="h-10 min-w-0 w-full min-h-[40px] py-2 px-3 rounded-lg border-slate-200 resize-none focus:ring-blue-600 transition-all leading-relaxed"
                                                                    placeholder="Item description..."
                                                                    value={item.particulars}
                                                                    onChange={(e) => handleItemChange(index, 'particulars', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-2 md:px-3 py-3 align-top">
                                                                <Input
                                                                    className="h-10 min-w-0 w-full rounded-lg border-slate-200 text-right focus:ring-blue-600 font-medium"
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="0.00"
                                                                    value={item.amount}
                                                                    onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-2 md:px-3 py-3 align-top text-center pt-6">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 transition-all cursor-pointer"
                                                                    checked={item.gst_applicable}
                                                                    onChange={(e) => handleItemChange(index, 'gst_applicable', e.target.checked)}
                                                                />
                                                            </td>
                                                            <td className="px-2 md:px-3 py-3 align-top">
                                                                <Select
                                                                    value={item.gst_rate}
                                                                    onValueChange={(val) => handleItemChange(index, 'gst_rate', val)}
                                                                    disabled={!item.gst_applicable}
                                                                >
                                                                    <SelectTrigger className="h-10 min-w-0 w-full rounded-lg border-slate-200 disabled:opacity-50 disabled:bg-slate-50 focus:ring-blue-600"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="0">0%</SelectItem>
                                                                        <SelectItem value="5">5%</SelectItem>
                                                                        <SelectItem value="12">12%</SelectItem>
                                                                        <SelectItem value="18">18%</SelectItem>
                                                                        <SelectItem value="28">28%</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </td>
                                                            <td className="px-2 md:px-3 py-3 align-top text-center pt-3">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-50 group-hover:opacity-100 transition-all rounded-lg"
                                                                    onClick={() => removeItem(index)}
                                                                    disabled={items.length === 1}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Additional Notes Card */}
                            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b px-6 py-4">
                                    <CardTitle className="text-lg font-semibold text-slate-800">Additional Notes</CardTitle>
                                    <CardDescription className="text-sm text-slate-500">Add terms, payment instructions, or internal remarks.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <Textarea
                                        className="border-slate-200 min-h-[120px] rounded-lg focus:ring-blue-600 p-4 leading-relaxed"
                                        placeholder="Enter additional remarks here..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right / Sidebar Column */}
                        <div className="space-y-6">

                            {/* Approval Info Card */}
                            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b px-5 py-4 bg-slate-50/50">
                                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                        <Info className="h-4 w-4 text-blue-600" />
                                        Approval Flow
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 text-sm text-slate-600 space-y-3">
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-medium text-slate-500 text-xs">1</div>
                                        <p className="pt-0.5"><strong>Save Draft</strong> for later editing.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-medium text-slate-500 text-xs">2</div>
                                        <p className="pt-0.5"><strong>Submit for Approval</strong> to lock changes and send to admins.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center font-medium text-blue-600 text-xs">3</div>
                                        <p className="pt-0.5 text-slate-700"><strong>Generate Tax Invoice</strong> after approval.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Workflow Eligibility Card */}
                            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b px-5 py-4 bg-slate-50/50">
                                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        Bill Readiness
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 space-y-4 text-sm">
                                    {isWorksLoading || (isWorkDataLoading && !clientId) ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-6 w-3/4" />
                                            <Skeleton className="h-6 w-full" />
                                            <Skeleton className="h-6 w-1/2" />
                                        </div>
                                    ) : !clientId || !workId ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500 gap-3">
                                            <div className="p-3 bg-slate-100 rounded-full">
                                                <AlertCircle className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <p>Select client and work to check billing eligibility.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600">Selected Work:</span>
                                                <Badge variant="outline" className="font-medium bg-slate-50 text-slate-700 border-slate-200">
                                                    {works.find(w => String(w.id) === workId)?.status || works.find(w => String(w.id) === workId)?.work_status || works.find(w => String(w.id) === workId)?.current_status || 'Unknown'}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600">Billing Type:</span>
                                                <span className="font-medium text-slate-900">{billingType === 'full_work' ? 'Full Work' : 'Step-wise'}</span>
                                            </div>
                                            {billingType === 'workflow_step' && (
                                                <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
                                                    <span className="text-slate-600">Eligible Steps:</span>
                                                    {isStepsLoading ? (
                                                        <Skeleton className="h-5 w-16" />
                                                    ) : eligibleSteps.length > 0 ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-medium px-2 py-0.5">
                                                            {eligibleSteps.length} Ready to Bill
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-medium px-2 py-0.5">
                                                            Blocked
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Billing Summary Card */}
                            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white sticky top-24">
                                <CardHeader className="border-b px-5 py-4 bg-slate-50/50">
                                    <CardTitle className="text-base font-semibold text-slate-800">Billing Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="p-5 space-y-3 text-sm">
                                        <div className="flex justify-between text-slate-600">
                                            <span>Professional Fee</span>
                                            <span className="font-medium text-slate-900">₹{profFeeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span>Government Fee</span>
                                            <span className="font-medium text-slate-900">₹{govtFeeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span>Reimbursement</span>
                                            <span className="font-medium text-slate-900">₹{reimbTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>

                                        <div className="border-t border-slate-100 my-3 pt-3"></div>

                                        <div className="flex justify-between text-slate-600">
                                            <span>Taxable Value</span>
                                            <span className="font-medium text-slate-900">₹{taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span className="flex items-center gap-1">
                                                Estimated GST
                                                <span className="group relative cursor-help">
                                                    <Info className="h-3.5 w-3.5 text-slate-400" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 text-center transition-opacity shadow-lg">
                                                        Exact CGST/SGST/IGST split is calculated by backend based on POS.
                                                    </div>
                                                </span>
                                            </span>
                                            <span className="font-medium text-slate-900">₹{totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 text-right mt-1">
                                            Includes CGST / SGST / IGST
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-5 border-t border-slate-200">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-slate-900">Grand Total</span>
                                            <span className="text-2xl font-bold text-blue-700">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>
                    </form>
                </div>
            </div>

            {/* Action Footer */}
            <div className=" bottom-0 left-0 md:left-[108px] right-0 z-[100] border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
              <div className="px-6 md:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-none">
                <div className="flex items-center text-sm text-slate-600 w-full sm:w-auto justify-center sm:justify-start">
                  <AlertCircle className="h-4 w-4 mr-2 text-blue-600" />
                  <span>Please verify all details before submitting.</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
                  <Link href="/dashboard/accounts/billing">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50 h-10 px-5"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </Link>

                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 h-10 px-5"
                    disabled={isSubmitting}
                    onClick={() => {
                      toast?.({ title: "Draft Saved", description: "Draft saved locally. (Real endpoint connection needed)", variant: "default" });
                    }}
                  >
                    <Save className="mr-2 h-4 w-4 hidden sm:inline" />
                    Save Draft
                  </Button>

                  <Button
                    type="submit"
                    form="create-bill-form"
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-md h-10 px-6 font-medium"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Processing..." : (
                      <>
                        <Send className="mr-2 h-4 w-4 hidden sm:inline" />
                        Submit for Approval
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
        </div>
    );
}

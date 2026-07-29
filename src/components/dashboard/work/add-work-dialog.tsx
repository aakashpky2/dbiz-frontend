'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2, Check, ChevronsUpDown, PlusCircle, AlertTriangle,
    User, Briefcase, CalendarDays, Clock, Link, Flag, CircleDollarSign,
    ArrowRight, ArrowLeft, CheckCircle2, X, Building2, FileText, ClipboardList,
    Mail, Phone, MapPin, Info, UserPlus
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { listenToDepartments, addWorkType, type Department, type WorkCategory, type WorkType } from '@/lib/department-management';
import { format } from 'date-fns';
import { parseISO } from 'date-fns';
import { startOfDay } from 'date-fns';
import { isBefore } from 'date-fns';
import { isAfter } from 'date-fns';
import { useBusinessConstitutions, type BusinessTypeSetup } from '@/hooks/use-profiles';
import { type ClientFormValues, type Client, hasIncompleteMandatoryFields } from './client-form';
import dynamic from 'next/dynamic';

const ClientForm = dynamic(() => import('./client-form').then(mod => mod.ClientForm), { ssr: false });
import { useClients } from '@/hooks/use-clients';
import { autoAssignWorkToTeam } from '@/lib/work-assignment';
import { parsePhoneFromPayload } from '@/lib/phone-utils';
import { calculateWorkDates, type DateInput as CalcDateInput, validateDateHierarchy } from '@/lib/work-date-calculator';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OccurrenceType = 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly' | 'Often';
export type PriorityType = 'Low' | 'Medium' | 'High' | 'Critical';
export type ReferenceType = 'Direct' | 'Associate';
export type WorkStatus = 'Not Started' | 'In Progress' | 'Pending Approval' | 'Completed' | 'Pending';

export interface ProposalWorkItem {
    id: string;
    workTypeId: string;
    workTypeName: string;
    professionalFee: number;
    governmentFee: number;
    gstPercentage: number;
    gstAmount: number;
    totalAmount: number;
    selected: boolean;
    // Configuration for conversion
    occurrence: OccurrenceType;
    financialYear: string;
    period?: string;
    priority: PriorityType;
    dueDate: string;
    finishByDate: string;
    doNow: boolean; // true = Not Started, false = Pending
    remarks?: string;
    durationDays?: number;
    durationHours?: number;
    configName?: string;
    allowOverride?: boolean;
    configIndex?: number;
    timeLimitConfigId?: string;
    timeLimitConfigName?: string;
    allowOccurrenceOverride?: boolean;
    allowDueDateOverride?: boolean;
    allowFinishByOverride?: boolean;
    finishByEnabled?: boolean;
    finishByMode?: 'days_based' | 'event_based';
    finishByDays?: number;
    finishByEvent?: 'work_start_date' | 'due_date' | 'period_start' | 'period_end';
    finishByDirection?: 'before' | 'after';
    pendingOrder?: number;
    // Metadata for works table
    departmentId?: string;
    departmentName?: string;
    categoryId?: string;
    categoryName?: string;
    proposalId?: string;
    entryDate?: string;
    isEntryDateManual?: boolean;
    isTargetDueDateManual?: boolean;
    isFinishByGoalManual?: boolean;
}

export interface WorkEntry {
    // Client
    clientId: string;
    clientName: string;

    // Work Type
    departmentId: string;
    departmentName: string;
    categoryId: string;
    categoryName: string;
    workTypeId: string;
    workTypeName: string;
    workTypeStatus: 'PENDING' | 'ACTIVE';

    // Occurrence
    occurrence: OccurrenceType;
    financialYear: string;
    period?: string; // month / quarter / half

    // Priority
    priority: PriorityType;

    // Reference
    referenceType: ReferenceType;
    associateId?: string;
    associateName?: string;
    associateEffectiveDate?: string; // Point 11

    // Dates
    dueDate: string;
    finishByDate: string; // Point 7: Entry Date + Duration
    finishByTime?: string; // HH:MM
    entryDate: string;
    isEntryDateManual?: boolean;
    isTargetDueDateManual?: boolean;
    isFinishByGoalManual?: boolean;

    // Optional
    remarks?: string;
    durationDays?: number;
    durationHours?: number;
    configName?: string;
    allowOverride?: boolean;
    configIndex?: number;
    timeLimitConfigId?: string;
    timeLimitConfigName?: string;
    allowOccurrenceOverride?: boolean;
    allowDueDateOverride?: boolean;
    allowFinishByOverride?: boolean;
    finishByEnabled?: boolean;
    finishByMode?: 'days_based' | 'event_based';
    finishByDays?: number;
    finishByEvent?: 'work_start_date' | 'due_date' | 'period_start' | 'period_end';
    finishByDirection?: 'before' | 'after';

    // Proposal mapping
    proposalId?: string;
    professionalFee?: number;
    governmentFee?: number;
    gstPercentage?: number;
    gstTarget?: string;
    gstAmount?: number;
    totalAmount?: number;
    pendingOrder?: number;
    status?: WorkStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sanitizeNonNegativeNumber = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, '');
    return cleaned === '' ? 0 : Number(cleaned);
};

const blockInvalidNumberKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) {
        e.preventDefault();
    }
};

const handleNumericPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!/^\d+$/.test(pasted)) {
        e.preventDefault();
    }
};


interface ClientSimple {
    id: string;
    clientName: string;
    companyName?: string;
    email?: string;
    phone?: string;
    clientIdHash?: string;
    reference?: string;
    associateName?: string;
}

interface Associate {
    id: string;
    name: string;
}

interface FlatWorkType {
    departmentId: string;
    departmentName: string;
    categoryId: string;
    categoryName: string;
    workTypeId: string;
    workTypeName: string;
    description?: string;
    workTypeStatus: 'PENDING' | 'ACTIVE';
    financialYearLogic?: 'Previous' | 'Current';
    monthLogic?: 'Current' | 'Previous';
    defaultPriority?: string;
    defaultOccurrence?: string;
    durationDays?: number;
    durationHours?: number;
    timeLimit?: number;
    timeLimitHours?: number;
    dueTimeConfig?: any;
    // Specific logic fields
    dueDay?: number;
    monthOffset?: number;
    configIndex?: number;
    configName?: string;
    allowOverride?: boolean;
    allowOccurrenceOverride?: boolean;
    allowDueDateOverride?: boolean;
    allowFinishByOverride?: boolean;
    finishByEnabled?: boolean;
    finishByMode?: 'days_based' | 'event_based';
    finishByDays?: number;
    finishByEvent?: 'work_start_date' | 'due_date' | 'period_start' | 'period_end';
    finishByDirection?: 'before' | 'after';
}

// ─── Financial Years ──────────────────────────────────────────────────────────

const FINANCIAL_YEARS = ['2023-24', '2024-25', '2025-26', '2026-27', '2027-28'];

const MONTHS = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
];

const QUARTERS = ['Q1 (Apr–Jun)', 'Q2 (Jul–Sep)', 'Q3 (Oct–Dec)', 'Q4 (Jan–Mar)'];
const HALVES = ['H1 (Apr–Sep)', 'H2 (Oct–Mar)'];

const OCCURRENCES: OccurrenceType[] = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Often'];

const PERIOD_OPTIONS: Record<OccurrenceType, string[]> = {
    'Monthly': MONTHS,
    'Quarterly': QUARTERS,
    'Half-yearly': HALVES,
    'Yearly': ['One-time'],
    'Often': ['N/A']
};

const mapFrequencyToOccurrence = (value?: string): OccurrenceType => {
    const normalized = String(value || '').toLowerCase().trim();

    if (normalized === 'monthly') return 'Monthly';
    if (normalized === 'quarterly') return 'Quarterly';
    if (normalized === 'half-yearly' || normalized === 'halfyearly') return 'Half-yearly';
    if (normalized === 'annually' || normalized === 'annual' || normalized === 'yearly') return 'Yearly';
    if (normalized === 'event_based' || normalized === 'event-based' || normalized === 'often') return 'Often';

    return 'Monthly';
};

const parseDueTimeConfig = (rawConfig: any) => {
    if (!rawConfig) return null;
    if (typeof rawConfig === "string") {
        try {
            return JSON.parse(rawConfig);
        } catch {
            return null;
        }
    }
    return rawConfig;
};

const normalizeRule = (rule: any) => {
    if (!rule) return null;
    
    // Map rule types
    let ruleType = rule.ruleType || rule.rule_type;
    if (!ruleType && rule.mode) {
        if (rule.mode === 'days') ruleType = 'By Days';
        else if (rule.mode === 'fixed') ruleType = 'Fixed Date';
        else if (rule.mode === 'month') ruleType = 'By Month';
        else ruleType = rule.mode;
    }
    if (!ruleType) ruleType = 'By Days'; // Default

    // Map start position
    let startCountingFrom = rule.startCountingFrom || rule.start_counting_from;
    if (!startCountingFrom && rule.periodPosition) {
        if (rule.periodPosition === 'end') startCountingFrom = 'End of Choice/Month';
        else if (rule.periodPosition === 'start' || rule.periodPosition === 'beginning') startCountingFrom = 'Start of Choice/Month';
        else startCountingFrom = rule.periodPosition;
    }
    if (!startCountingFrom) startCountingFrom = 'Start of Choice/Month'; // Default

    // Map day value
    const day = parseInt(rule.day || rule.days || rule.fixedDate || rule.fixed_date || rule.daysFromEnd || rule.days_from_end || rule.daysAfter || rule.value || 0);
    
    const normalized = {
        frequency: rule.frequency || rule.occurrence,
        ruleType,
        calculationType: rule.calculationType || rule.calculation_type,
        startCountingFrom,
        day,
        monthOffset: parseInt(rule.month || 0)
    };

    return normalized;
};

const getMatchingRule = (config: any, occurrence: string) => {
    const parsed = parseDueTimeConfig(config);
    if (!parsed) return null;

    // Handle nested configs array if the root was passed
    let rules = [];
    if (parsed.configs && Array.isArray(parsed.configs)) {
        // If we don't know which one, we can't easily pick. 
        // But usually we pass the SPECIFIC config object now.
        // If a specific config was passed (one item from the array), it won't have .configs
        rules = parsed.dueTimeConfigurations || parsed.due_time_configurations || parsed.rules || [];
    } else {
        rules = parsed.dueTimeConfigurations || parsed.due_time_configurations || parsed.rules || [];
    }
    
    if (!Array.isArray(rules) || rules.length === 0) return null;
    
    // Find rule that matches frequency exactly
    const targetFreq = (occurrence || '').toLowerCase();
    const matchedRule = rules.find((r: any) => {
        const freq = (r.frequency || r.occurrence || '').toLowerCase();
        return freq === targetFreq;
    }) || rules[0]; // Fallback to first rule if no exact match

    return normalizeRule(matchedRule);
};

function getPeriodDateRange(occurrence: OccurrenceType, financialYear: string, period?: string) {
    const fyStartYear = parseInt(financialYear.split('-')[0]);
    
    let startDate: Date;
    let endDate: Date;

    const p = (period || '').toLowerCase().trim();

    if (occurrence === 'Monthly' && period) {
        let monthIdx = MONTHS.findIndex(m => m.toLowerCase().startsWith(p) || p.startsWith(m.toLowerCase()));
        if (monthIdx === -1) monthIdx = 0; // Default to April if somehow lost

        const year = monthIdx >= 9 ? fyStartYear + 1 : fyStartYear;
        const jsMonth = (monthIdx + 3) % 12;
        startDate = new Date(year, jsMonth, 1);
        endDate = new Date(year, jsMonth + 1, 0);
    } else if (occurrence === 'Quarterly' && period) {
        let qIdx = QUARTERS.findIndex(q => q.toLowerCase().startsWith(p.split(' ')[0]) || p.toLowerCase().startsWith(q.toLowerCase().split(' ')[0]));
        if (qIdx === -1) qIdx = 0; // Default to Q1

        const year = qIdx === 3 ? fyStartYear + 1 : fyStartYear;
        const startJsMonth = (qIdx * 3 + 3) % 12;
        startDate = new Date(year, startJsMonth, 1);
        endDate = new Date(year, startJsMonth + 3, 0);
    } else if (occurrence === 'Half-yearly' && period) {
        let hIdx = HALVES.findIndex(h => h.toLowerCase().startsWith(p.split(' ')[0]) || p.toLowerCase().startsWith(h.toLowerCase().split(' ')[0]));
        if (hIdx === -1) hIdx = 0; // Default to H1

        const year = hIdx === 1 ? fyStartYear + 1 : fyStartYear;
        const startJsMonth = hIdx === 0 ? 3 : 9;
        startDate = new Date(year, startJsMonth, 1);
        endDate = new Date(year, startJsMonth + 6, 0);
    } else {
        // Yearly or Often
        startDate = new Date(fyStartYear, 3, 1);
        endDate = new Date(fyStartYear + 1, 2, 31);
    }

    return { startDate, endDate };
}

const getOccurrenceFromWorkType = (wt: any): OccurrenceType => {
    const config = parseDueTimeConfig(wt?.dueTimeConfig || wt?.due_time_config);

    const firstFrequency =
        config?.dueTimeConfigurations?.[0]?.frequency ||
        config?.due_time_configurations?.[0]?.frequency ||
        wt?.defaultOccurrence ||
        wt?.default_occurrence;

    return mapFrequencyToOccurrence(firstFrequency);
};

const calculateWorkTotal = (professionalFee: number, governmentFee: number, gstAmount: number = 0) => {
    return Number(professionalFee || 0) + Number(governmentFee || 0) + Number(gstAmount || 0);
};

// ─── Priority Config ──────────────────────────────────────────────────────────

const PRIORITIES: PriorityType[] = ['Low', 'Medium', 'High', 'Critical'];

const PRIORITY_CONFIG: Record<PriorityType, { label: string; color: string; bg: string; border: string }> = {
    Low: { label: 'Low', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
    Medium: { label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    High: { label: 'High', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    Critical: { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
};

// ─── Step Config ──────────────────────────────────────────────────────────────

const STEPS = [
    { id: 'client_work', label: 'Client & Work Type', icon: Building2 },
    { id: 'occurrence_details', label: 'Occurrence & Details', icon: CalendarDays },
    { id: 'review', label: 'Review', icon: CheckCircle2 },
];

// ─── Date Input Component ───────────────────────────────────────────────────

const DateInput = ({ value, onChange, className, max, min, disabled }: { value: string | undefined, onChange: (val: string) => void, className?: string, max?: string, min?: string, disabled?: boolean }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const openPicker = () => {
        if (disabled) return;
        inputRef.current?.focus();
        // @ts-ignore - showPicker is a newer API
        inputRef.current?.showPicker?.();
    };

    return (
        <div className="relative">
            <Input
                ref={inputRef}
                type="date"
                value={value || ''}
                max={max}
                min={min}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className={cn("pr-10", className, disabled && "opacity-50 cursor-not-allowed")}
            />
            <button
                type="button"
                onClick={openPicker}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                tabIndex={-1}
            >
                <CalendarDays className="h-4 w-4" />
            </button>
        </div>
    );
};

// ─── Client Details Card ─────────────────────────────────────────────────────

const ClientDetailsCard = ({ client, constitutions, associates }: { client: any, constitutions: any[], associates: any[] }) => {
    if (!client) return null;

    const constitution = constitutions.find((c: any) => String(c.id) === String(client.constitutionId));
    const primaryContact = client.contacts?.find((c: any) => c.isPrimary) || client.contacts?.[0];

    // Robust flattening to find address parts
    const fields = client.fields || {};
    const getAddress = () => {
        const parts: string[] = [];
        const process = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.entries(obj).forEach(([key, val]) => {
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    process(val);
                } else if (val !== null && val !== undefined && val !== '') {
                    const k = key.toLowerCase();
                    if (k.includes('address') || k.includes('city') || k.includes('state') || k.includes('pin') || k.includes('street')) {
                        if (typeof val === 'string' || typeof val === 'number') {
                            parts.push(String(val));
                        }
                    }
                }
            });
        };
        process(fields);
        // Remove duplicates and join
        return Array.from(new Set(parts)).filter(Boolean).join(', ') || '-';
    };

    const address = getAddress();

    return (
        <Card className="border-none shadow-none bg-slate-50 border-2 border-slate-100 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-200/60 pb-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Info className="h-4 w-4" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Client Information</h4>
                        <p className="text-[10px] text-slate-500 font-medium italic">Read-only details from master register</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-lg bg-white border shadow-sm flex items-center justify-center shrink-0">
                            <Mail className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Email ID</p>
                            <p className="text-sm font-bold text-slate-700 truncate">{client.email || primaryContact?.email || '-'}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-lg bg-white border shadow-sm flex items-center justify-center shrink-0">
                            <Phone className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Phone Number</p>
                            <p className="text-sm font-bold text-slate-700">{client.phone || primaryContact?.phone || '-'}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-lg bg-white border shadow-sm flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Constitution</p>
                            <p className="text-sm font-bold text-slate-700">{constitution?.name || '-'}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-lg bg-white border shadow-sm flex items-center justify-center shrink-0">
                            <MapPin className="h-3.5 w-3.5 text-rose-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Address</p>
                            <p className="text-xs font-bold text-slate-600 line-clamp-2" title={address}>{address}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


// ─── New Work Type Dialog ─────────────────────────────────────────────────────

interface NewWorkTypeDialogProps {
    open: boolean;
    onClose: () => void;
    departments: Department[];
    userId: string;
    userName: string;
    onCreated: (wt: FlatWorkType) => void;
}

function NewWorkTypeDialog({ open, onClose, departments, userId, userName, onCreated }: NewWorkTypeDialogProps) {
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [selectedCatId, setSelectedCatId] = useState('');
    const [workTypeName, setWorkTypeName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const activeDepts = useMemo(() => departments.filter(d => !d.isDeleted && d.status !== 'INACTIVE'), [departments]);
    const selectedDept = useMemo(() => activeDepts.find(d => d.id === selectedDeptId), [activeDepts, selectedDeptId]);
    const activeCategories = useMemo(() =>
        (selectedDept?.workCategories || []).filter((c: any) => !c.isDeleted && c.status !== 'INACTIVE'),
        [selectedDept]
    );

    const handleReset = () => {
        setSelectedDeptId('');
        setSelectedCatId('');
        setWorkTypeName('');
        setDescription('');
    };

    const handleSave = async () => {
        if (!selectedDeptId || !selectedCatId || !workTypeName.trim()) {
            toast({ title: 'Required', description: 'Please fill all fields.', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            await addWorkType(selectedDeptId, selectedCatId, {
                name: workTypeName.trim(),
                description: description.trim(),
            }, userId, userName);

            const dept = activeDepts.find(d => d.id === selectedDeptId);
            const cat = dept?.workCategories.find((c: any) => c.id === selectedCatId);

            // Fetch the newly created work type id from Supabase
            const { data: matchedWt } = await supabase
                .from('work_types')
                .select('id')
                .eq('category_id', selectedCatId)
                .eq('name', workTypeName.trim())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let newWtId = matchedWt?.id || '';

            toast({ title: 'Work Type Created', description: `"${workTypeName}" has been submitted for validation.` });

            onCreated({
                departmentId: selectedDeptId,
                departmentName: dept?.name || '',
                categoryId: selectedCatId,
                categoryName: cat?.name || '',
                workTypeId: newWtId,
                workTypeName: workTypeName.trim(),
                workTypeStatus: 'PENDING',
            });

            handleReset();
            onClose();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to create Work Type.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { handleReset(); onClose(); } }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5 text-primary" /> Add New Work Type
                    </DialogTitle>
                    <DialogDescription>
                        New work types go for validation. They can be used immediately while pending approval.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Department */}
                    <div className="space-y-1.5">
                        <Label className="font-medium">Department <span className="text-red-500">*</span></Label>
                        <Select value={selectedDeptId} onValueChange={(v) => { setSelectedDeptId(v); setSelectedCatId(''); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeDepts.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                        <Label className="font-medium">Category <span className="text-red-500">*</span></Label>
                        <Select value={selectedCatId} onValueChange={setSelectedCatId} disabled={!selectedDeptId}>
                            <SelectTrigger>
                                <SelectValue placeholder={selectedDeptId ? 'Select Category' : 'Select department first'} />
                            </SelectTrigger>
                            <SelectContent>
                                {activeCategories.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                                {activeCategories.length === 0 && (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">No categories found.</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Work Type Name */}
                    <div className="space-y-1.5">
                        <Label className="font-medium">Work Type Name <span className="text-red-500">*</span></Label>
                        <Input
                            value={workTypeName}
                            onChange={e => setWorkTypeName(e.target.value)}
                            placeholder="e.g. GST Monthly Filing"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label className="font-medium text-muted-foreground">Description (optional)</Label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Brief description..."
                            rows={2}
                            className="resize-none"
                        />
                    </div>

                    {/* Pending notice */}
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>This Work Type will be created with <strong>Pending Validation</strong> status. It's immediately usable, and will become permanent once approved by a validator.</span>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { handleReset(); onClose(); }}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Create Work Type
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Add Work Dialog ─────────────────────────────────────────────────────

interface AddWorkDialogProps {
    open: boolean;
    onClose: () => void;
    onWorkCreated?: () => void;
    /** Pre-select client (optional) */
    preselectedClientId?: string;
    preselectedProposalId?: string;
    initialData?: any;
    mode?: 'create' | 'edit' | 'view';
}

const EMPTY_FORM: Partial<WorkEntry> = {
    occurrence: 'Monthly',
    financialYear: '2025-26',
    priority: 'Medium',
    referenceType: 'Direct',
    entryDate: format(new Date(), 'yyyy-MM-dd'),
    finishByDate: format(new Date(), 'yyyy-MM-dd'),
    associateEffectiveDate: format(new Date(), 'yyyy-MM-dd'),
    allowOverride: true,
    configIndex: 0,
};

const toDateOnly = (value: any) => {
    if (!value) return '';
    const dateStr = String(value);
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    // If it's already in a recognizable format, try to format it to yyyy-MM-dd
    try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            return format(d, 'yyyy-MM-dd');
        }
    } catch (e) {
        // Fallback to original
    }
    return dateStr;
};

const normalizeWorkForEdit = (data: any): Partial<WorkEntry> => {
    if (!data) return EMPTY_FORM;

    return {
        clientId: data.clientId ?? data.client_id ?? '',
        clientName: data.clientName ?? data.client_name ?? '',

        departmentId: data.departmentId ?? data.department_id ?? '',
        departmentName: data.departmentName ?? data.department_name ?? '',
        categoryId: data.categoryId ?? data.category_id ?? '',
        categoryName: data.categoryName ?? data.category_name ?? '',
        workTypeId: data.workTypeId ?? data.work_type_id ?? '',
        workTypeName: data.workTypeName ?? data.work_type_name ?? '',
        workTypeStatus: data.workTypeStatus ?? data.work_type_status ?? 'ACTIVE',

        occurrence: mapFrequencyToOccurrence(data.occurrence),
        financialYear: data.financialYear ?? data.financial_year ?? '2025-26',
        period: data.period ?? '',

        priority: (data.priority ?? 'Medium') as PriorityType,
        referenceType: (data.referenceType ?? data.reference_type ?? 'Direct') as ReferenceType,
        associateId: data.associateId ?? data.associate_id ?? undefined,
        associateName: data.associateName ?? data.associate_name ?? undefined,
        associateEffectiveDate: toDateOnly(data.associateEffectiveDate ?? data.associate_effective_date),

        dueDate: toDateOnly(data.dueDate ?? data.due_date),
        finishByDate: toDateOnly(data.finishByDate ?? data.finish_by_date),
        finishByTime: data.finishByTime ?? data.finish_by_time ?? '',

        entryDate: toDateOnly(data.entryDate ?? data.entered_date ?? data.created_at) || format(new Date(), 'yyyy-MM-dd'),

        remarks: data.remarks ?? '',
        proposalId: data.proposalId ?? data.proposal_id ?? undefined,

        // Point 3: Normalization with Fallbacks
        durationDays: Number(
            data.durationDays ??
            data.duration_days ??
            data.timeLimit ??
            data.time_limit ??
            data.work_type?.duration_days ??
            data.work_type?.durationDays ??
            data.work_type?.time_limit ??
            data.work_type?.timeLimit ??
            0
        ),
        durationHours: Number(
            data.durationHours ??
            data.duration_hours ??
            data.timeLimitHours ??
            data.time_limit_hours ??
            data.work_type?.duration_hours ??
            data.work_type?.durationHours ??
            data.work_type?.time_limit_hours ??
            data.work_type?.timeLimitHours ??
            0
        ),

        professionalFee: Number(data.professionalFee ?? data.professional_fee ?? 0),
        governmentFee: Number(data.governmentFee ?? data.government_fee ?? 0),
        gstPercentage: Number(data.gstPercentage ?? data.gst_percentage ?? 18),
        gstAmount: Number(data.gstAmount ?? data.gst_amount ?? 0),
        totalAmount: Number(data.totalAmount ?? data.total_amount ?? 0),

        status: (data.status ?? 'Not Started') as WorkStatus,
        pendingOrder: data.pendingOrder ?? data.pending_order ?? undefined,
        configName: data.configName ?? data.config_name ?? undefined,
        allowOverride: data.allowOverride ?? data.allow_override ?? true,
        configIndex: data.configIndex ?? data.config_index ?? 0,
    };
};

// ─── Refactored Config Helpers ──────────────────────────────────────────────
const getConfigsForWorkType = (wt: any) => {
    const dtc = wt.dueTimeConfig || (wt as any).due_time_config;
    const configs = dtc?.configs || [];
    
    const mapConfig = (c: any, idx: number) => ({
        id: c.id || idx.toString(),
        name: c.configName || (wt.configName || wt.name || `Config ${idx + 1}`),
        dueTimeConfigurations: c.dueTimeConfigurations || [],
        timeLimit: c.timeToFinish?.days ?? (wt.timeLimit ?? 0),
        timeLimitHours: c.timeToFinish?.hours ?? (wt.timeLimitHours ?? 0),
        durationDays: c.timeToFinish?.days ?? (wt.durationDays ?? wt.timeLimit ?? 0),
        durationHours: c.timeToFinish?.hours ?? (wt.durationHours ?? wt.timeLimitHours ?? 0),
        allowOverride: c.allowOverride ?? (wt.allowOverride ?? (wt as any).allow_override ?? true),
        allowOccurrenceOverride: c.allowOccurrenceOverride ?? (wt.allowOccurrenceOverride ?? (wt as any).allow_occurrence_override ?? false),
        allowDueDateOverride: c.allowDueDateOverride ?? (wt.allowDueDateOverride ?? (wt as any).allow_due_date_override ?? false),
        allowFinishByOverride: c.allowFinishByOverride ?? (wt.allowFinishByOverride ?? (wt as any).allow_finish_by_override ?? false),
        finishByEnabled: c.finishByEnabled ?? (wt.finishByEnabled ?? (wt as any).finish_by_enabled ?? false),
        finishByMode: c.finishByMode ?? (wt.finishByMode ?? (wt as any).finish_by_mode ?? 'days_based'),
        finishByDays: c.finishByDays ?? (wt.finishByDays ?? (wt as any).finish_by_days ?? 0),
        finishByEvent: c.finishByEvent ?? (wt.finishByEvent ?? (wt as any).finish_by_event ?? 'work_start_date'),
        finishByDirection: c.finishByDirection ?? (wt.finishByDirection ?? (wt as any).finish_by_direction ?? 'after'),
        createdAt: c.createdAt || c.created_at || null,
        configIndex: idx
    });

    if (configs.length > 0) {
        return configs.map(mapConfig);
    }
    
    // Fallback to top-level fields on wt if no configs array exists
    return [mapConfig({
        dueTimeConfigurations: dtc?.dueTimeConfigurations || [],
    }, 0)];
};

const getDefaultConfigForWorkType = (wt: any) => {
    const configs = getConfigsForWorkType(wt);
    if (configs.length <= 1) return configs[0];
    
    return [...configs].sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })[0];
};

export function AddWorkDialog({ open, onClose, onWorkCreated, preselectedClientId, preselectedProposalId, initialData, mode = 'create' }: AddWorkDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const today = format(new Date(), 'yyyy-MM-dd');

    // ── Data ──
    const { data: clientsData, isLoading: clientsLoading } = useClients();
    const clients = clientsData?.data || [];

    const isEditMode = !!initialData?.id && mode !== 'view';
    const isViewMode = mode === 'view';
    const isClientPreselected = !!preselectedClientId;
    const isProposalPreselected = !!preselectedProposalId;

    const [associates, setAssociates] = useState<Associate[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<{ uid: string; displayName: string }[]>([]);
    const { constitutions, loading: constitutionsLoading } = useBusinessConstitutions();
    const [loadingData, setLoadingData] = useState(true);

    // ── Form State ──
    const [form, setForm] = useState<Partial<WorkEntry>>(EMPTY_FORM);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [saving, setSaving] = useState(false);
    const [clientSubmitting, setClientSubmitting] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    // ── UI State ──
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
    const [workTypePopoverOpen, setWorkTypePopoverOpen] = useState(false);
    const [showNewWorkTypeDialog, setShowNewWorkTypeDialog] = useState(false);
    const [showNewClientDialog, setShowNewClientDialog] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [clientFormInitialData, setClientFormInitialData] = useState<Partial<Client> | null>(null);

    // Proposals State
    const [proposals, setProposals] = useState<any[]>([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [proposalPopoverOpen, setProposalPopoverOpen] = useState(false);
    const [proposalSearch, setProposalSearch] = useState('');
    const [proposalsError, setProposalsError] = useState<string | null>(null);
    const [currentProposal, setCurrentProposal] = useState<any | null>(null);

    // Point 5: Warning Dialog State
    const [warning, setWarning] = useState<{
        open: boolean;
        field: string;
        oldValue: any;
        newValue: any;
        onConfirm: () => void;
    } | null>(null);

    const [proposalWorkList, setProposalWorkList] = useState<ProposalWorkItem[]>([]);
    const [normalWorkList, setNormalWorkList] = useState<ProposalWorkItem[]>([]);

    // ── Normalize Proposals ──
    const normalizedProposals = useMemo(() => {
        if (!Array.isArray(proposals)) return [];
        return proposals.map(p => {
            // Safe field extraction (handles both camelCase from API and snake_case if any)
            const status = (p.status || '').toLowerCase().trim();
            const currentStage = (p.current_stage || p.currentStage || '').toLowerCase().trim();
            const clientName = p.clientName || p.client_name || 'Unknown Client';
            const clientId = p.clientId || p.client_id || '';
            const tempClientId = p.tempClientId || p.temp_client_id || '';
            const phone = p.phone || p.contactPhone || '';
            const email = p.email || p.contactEmail || '';
            const proposedWork = Array.isArray(p.proposedWork || p.proposed_work) ? (p.proposedWork || p.proposed_work) : [];

            // ELIGIBILITY LOGIC:
            // Only show proposals that are Accepted or Closed but NOT yet Converted.
            // Once a proposal is Converted, it should be hidden from this list to prevent duplicates.
            const eligibleStatuses = ['accepted', 'closed'];
            const isEligible = eligibleStatuses.includes(status) || eligibleStatuses.includes(currentStage);

            return {
                ...p,
                id: p.id,
                clientId,
                tempClientId,
                clientName,
                phone,
                email,
                proposedWork,
                totalAmount: p.totalAmount || p.total_amount || 0,
                professionalFee: p.professionalFee || p.professional_fee,
                governmentFee: p.governmentFee || p.government_fee,
                gstPercentage: p.gstPercentage || p.gst_percentage,
                gstTarget: p.gstTarget || p.gst_target,
                gstAmount: p.gstAmount || p.gst_amount,
                description: p.description || p.remarks,
                isEligible,
                searchBlob: `${clientName} ${proposedWork.map((pw: any) => pw.workTypeName || pw.work_type_name || '').join(' ')}`.toLowerCase()
            };
        });
    }, [proposals]);

    const selectedProposal = useMemo(() => {
        if (!form.proposalId) return null;
        return normalizedProposals.find(p => p.id === form.proposalId);
    }, [form.proposalId, normalizedProposals]);

    useEffect(() => {
        if (!open) return;

        // Reset all states when modal opens
        setNormalWorkList([]);
        setProposalWorkList([]);
        setClientPopoverOpen(false);
        setWorkTypePopoverOpen(false);
        setProposalPopoverOpen(false);
        setClientSearch('');
        setProposalSearch('');

        if (isEditMode) {
            setIsHydrated(false);
            setForm(normalizeWorkForEdit(initialData));
            setCurrentStep(0); // Start from step 1 with all data loaded
            
            // If linked to a proposal, fetch it specifically for display
            if (initialData.proposalId || initialData.proposal_id) {
                const pid = initialData.proposalId || initialData.proposal_id;
                const normalized = normalizeWorkForEdit(initialData);

                // Initialize proposalWorkList with exactly one item so the "Proposal Layout" works
                setProposalWorkList([{
                    id: initialData.id,
                    workTypeId: normalized.workTypeId!,
                    workTypeName: normalized.workTypeName!,
                    professionalFee: normalized.professionalFee!,
                    governmentFee: normalized.governmentFee!,
                    gstPercentage: normalized.gstPercentage!,
                    gstAmount: normalized.gstAmount!,
                    totalAmount: normalized.totalAmount!,
                    selected: true,
                    occurrence: normalized.occurrence!,
                    financialYear: normalized.financialYear!,
                    period: normalized.period!,
                    priority: normalized.priority!,
                    dueDate: normalized.dueDate!,
                    finishByDate: normalized.finishByDate!,
                    doNow: normalized.status === 'Not Started' || normalized.status === 'Pending',
                    remarks: normalized.remarks!,
                    durationDays: normalized.durationDays!,
                    durationHours: normalized.durationHours!,
                    departmentId: normalized.departmentId!,
                    departmentName: normalized.departmentName!,
                    categoryId: normalized.categoryId!,
                    categoryName: normalized.categoryName!,
                    proposalId: pid
                }]);

                supabase.from('proposals').select('*').eq('id', pid).maybeSingle().then(({ data }) => {
                    if (data) setCurrentProposal(data);
                    setIsHydrated(true);
                });
            } else {
                setIsHydrated(true);
            }
        } else {
            setForm({
                ...EMPTY_FORM,
                entryDate: format(new Date(), 'yyyy-MM-dd'),
                finishByDate: format(new Date(), 'yyyy-MM-dd'),
                associateEffectiveDate: format(new Date(), 'yyyy-MM-dd'),
            });
            setCurrentStep(0);
            setCurrentProposal(null);
            setIsHydrated(true);
        }
    }, [open, isEditMode, initialData]);
    


    // Sync proposalWorkList[0] back to form in Edit Mode to ensure save payload is correct
    useEffect(() => {
        if (isEditMode && form.proposalId && proposalWorkList.length === 1) {
            const pw = proposalWorkList[0];
            setForm(prev => {
                // Prevent unnecessary updates
                if (
                    prev.occurrence === pw.occurrence &&
                    prev.financialYear === pw.financialYear &&
                    prev.period === pw.period &&
                    prev.priority === pw.priority &&
                    prev.dueDate === pw.dueDate &&
                    prev.finishByDate === pw.finishByDate &&
                    prev.remarks === pw.remarks &&
                    prev.professionalFee === pw.professionalFee &&
                    prev.governmentFee === pw.governmentFee &&
                    prev.gstPercentage === pw.gstPercentage &&
                    prev.gstAmount === pw.gstAmount &&
                    prev.totalAmount === pw.totalAmount
                ) return prev;

                return {
                    ...prev,
                    occurrence: pw.occurrence,
                    financialYear: pw.financialYear,
                    period: pw.period,
                    priority: pw.priority,
                    dueDate: pw.dueDate,
                    finishByDate: pw.finishByDate,
                    remarks: pw.remarks,
                    durationDays: pw.durationDays,
                    durationHours: pw.durationHours,
                    professionalFee: pw.professionalFee,
                    governmentFee: pw.governmentFee,
                    gstPercentage: pw.gstPercentage,
                    gstAmount: pw.gstAmount,
                    totalAmount: pw.totalAmount,
                };
            });
        }
    }, [proposalWorkList, isEditMode, form.proposalId]);


    // ── Proposal Data Normalization Helpers ──
    const getProfessionalFee = useCallback((pw: any, p: any) => {
        return Number(pw.professionalFee || pw.professional_fee || pw.fee || pw.amount || 0);
    }, []);

    const getGovernmentFee = useCallback((pw: any) => {
        return Number(pw.governmentFee || pw.government_fee || 0);
    }, []);

    const getGstPercentage = useCallback((pw: any, p: any) => {
        return Number(pw.gstPercentage || pw.gst_percentage || p.gst_percentage || 18);
    }, []);

    const getGstAmount = useCallback((pw: any, p: any) => {
        if (pw.gstAmount || pw.gst_amount) return Number(pw.gstAmount || pw.gst_amount);
        const prof = getProfessionalFee(pw, p);
        const gstPct = getGstPercentage(pw, p);
        return Math.round(prof * (gstPct / 100));
    }, [getProfessionalFee, getGstPercentage]);

    const getServiceTotal = useCallback((pw: any, p: any, allWorks: any[]) => {
        if (pw.totalAmount || pw.total_amount) return Number(pw.totalAmount || pw.total_amount);
        // If we only have proposal-level total and this is the only service
        if (allWorks.length === 1 && (p.total_amount || p.totalAmount)) return Number(p.total_amount || p.totalAmount);

        const prof = getProfessionalFee(pw, p);
        const govt = getGovernmentFee(pw);
        const gst = getGstAmount(pw, p);
        return prof + govt + gst;
    }, [getProfessionalFee, getGovernmentFee, getGstAmount]);

    const getServiceName = useCallback((pw: any) => {
        return pw.workTypeName || pw.serviceName || pw.work_name || pw.name || 'Unknown Service';
    }, []);

    // ── Point 4 & 6: Automated Work Type Selection ──
    const getWorkTypeDefaults = useCallback((wt: FlatWorkType, config?: any) => {
        const now = new Date();
        let fy = '2025-26';
        let period = undefined;

        const selectedConfig = config || getDefaultConfigForWorkType(wt);

        // 1. Occurrence / Frequency
        let occurrence: OccurrenceType = 'Monthly';
        if (selectedConfig?.dueTimeConfigurations?.length > 0) {
            const firstFreq = selectedConfig.dueTimeConfigurations[0].frequency;
            occurrence = mapFrequencyToOccurrence(firstFreq);
        } else {
            occurrence = mapFrequencyToOccurrence(wt.defaultOccurrence) || 'Monthly';
        }

        // 2. Financial Year Logic
        const currentYear = now.getFullYear();
        const currentMonthIdx = now.getMonth();
        const isCurrentFYStarted = currentMonthIdx >= 3;
        const fyStart = isCurrentFYStarted ? currentYear : currentYear - 1;

        if (wt.financialYearLogic === 'Previous') {
            fy = `${fyStart - 1}-${(fyStart).toString().slice(-2)}`;
        } else {
            fy = `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
        }

        // 3. Period / Month Logic
        if (occurrence === 'Monthly') {
            let targetMonthDate = new Date(now);
            if (wt.monthLogic === 'Previous') {
                targetMonthDate.setMonth(targetMonthDate.getMonth() - 1);
            }
            const monthIdx = (targetMonthDate.getMonth() - 3 + 12) % 12;
            period = MONTHS[monthIdx];
        } else if (occurrence === 'Quarterly') {
            const qIdx = Math.floor(((now.getMonth() - 3 + 12) % 12) / 3);
            period = QUARTERS[qIdx];
        } else if (occurrence === 'Half-yearly') {
            const hIdx = Math.floor(((now.getMonth() - 3 + 12) % 12) / 6);
            period = HALVES[hIdx];
        } else {
            period = PERIOD_OPTIONS[occurrence]?.[0];
        }

        // 4. Dates Logic (Target Due Date & Finish By Goal)
        const durationDays = Number(selectedConfig?.durationDays ?? wt.durationDays ?? 0);
        const durationHours = Number(selectedConfig?.durationHours ?? wt.durationHours ?? 0);

        const calcInput: CalcDateInput = {
            workStartDate: format(now, 'yyyy-MM-dd'),
            workTypeName: wt.workTypeName,
            occurrence: occurrence as any,
            financialYear: fy,
            period: period || '',
            priority: (wt.defaultPriority as any) || 'Medium',
            durationDays,
            durationHours,
            config: selectedConfig ? { dueTimeConfigurations: selectedConfig.dueTimeConfigurations } : wt.dueTimeConfig
        };

        const { targetDueDate, finishByGoal } = calculateWorkDates(calcInput);
        const dueDate = targetDueDate;
        const finishByDate = finishByGoal;
        return {
            occurrence,
            financialYear: fy,
            period: period || '',
            priority: (wt.defaultPriority as PriorityType) || 'Medium',
            dueDate,
            finishByDate,
            entryDate: format(now, 'yyyy-MM-dd'),
            isEntryDateManual: false,
            isTargetDueDateManual: false,
            isFinishByGoalManual: false,
            durationDays,
            durationHours,
            configName: selectedConfig?.name,
            allowOverride: selectedConfig?.allowOverride ?? false,
            allowOccurrenceOverride: selectedConfig?.allowOccurrenceOverride ?? false,
            allowDueDateOverride: selectedConfig?.allowDueDateOverride ?? false,
            allowFinishByOverride: selectedConfig?.allowFinishByOverride ?? false,
            finishByEnabled: selectedConfig?.finishByEnabled ?? false,
            finishByMode: selectedConfig?.finishByMode,
            finishByDays: selectedConfig?.finishByDays,
            finishByEvent: selectedConfig?.finishByEvent,
            finishByDirection: selectedConfig?.finishByDirection,
            configIndex: selectedConfig?.configIndex ?? 0,
            timeLimitConfigId: selectedConfig?.id,
            timeLimitConfigName: selectedConfig?.name
        };
    }, []);

    // ── Derived: flat list of all work types ──
    const flatWorkTypes: FlatWorkType[] = useMemo(() => {
        const result: FlatWorkType[] = [];
        departments.forEach(dept => {
            if (dept.isDeleted || dept.status === 'INACTIVE') return;
            dept.workCategories.forEach(cat => {
                if (cat.isDeleted || cat.status === 'INACTIVE') return;
                cat.workTypes.forEach(wt => {
                    if (wt.isDeleted) return;
                    
                    result.push({
                        departmentId: dept.id,
                        departmentName: dept.name,
                        categoryId: cat.id,
                        categoryName: cat.name,
                        workTypeId: wt.id,
                        workTypeName: wt.name,
                        description: wt.description,
                        workTypeStatus: wt.status === 'PENDING' ? 'PENDING' : 'ACTIVE',
                        financialYearLogic: wt.financialYearLogic || (wt as any).financial_year_logic,
                        monthLogic: wt.monthLogic || (wt as any).month_logic,
                        defaultPriority: wt.defaultPriority || (wt as any).default_priority,
                        defaultOccurrence: wt.defaultOccurrence || (wt as any).default_occurrence,
                        durationDays: Number(wt.durationDays || (wt as any).duration_days || wt.timeLimit || (wt as any).time_limit || 0),
                        durationHours: Number(wt.durationHours || (wt as any).duration_hours || wt.timeLimitHours || (wt as any).time_limit_hours || 0),
                        timeLimit: Number(wt.timeLimit ?? (wt as any).time_limit ?? 0),
                        timeLimitHours: Number(wt.timeLimitHours ?? (wt as any).time_limit_hours ?? 0),
                        dueTimeConfig: wt.dueTimeConfig || (wt as any).due_time_config,
                        allowOverride: (wt as any).allowOverride ?? (wt as any).allow_override ?? true
                    });
                });
            });
        });
        return result.sort((a, b) => a.workTypeName.localeCompare(b.workTypeName));
    }, [departments]);

    const handleWorkTypeSelect = useCallback((wt: FlatWorkType) => {
        const defaultConfig = getDefaultConfigForWorkType(wt);
        const defaults = getWorkTypeDefaults(wt, defaultConfig);

        // AUTO-ADD to normalWorkList
        const newItem: ProposalWorkItem = {
            id: `normal-${Date.now()}-${wt.workTypeId}`,
            workTypeId: wt.workTypeId,
            workTypeName: wt.workTypeName,
            departmentId: wt.departmentId,
            departmentName: wt.departmentName,
            categoryId: wt.categoryId,
            categoryName: wt.categoryName,
            selected: true,
            occurrence: defaults.occurrence,
            financialYear: defaults.financialYear,
            period: defaults.period,
            priority: defaults.priority,
            dueDate: defaults.dueDate,
            finishByDate: defaults.finishByDate,
            entryDate: defaults.entryDate,
            durationDays: defaults.durationDays,
            durationHours: defaults.durationHours,
            configName: defaults.configName,
            allowOverride: defaults.allowOverride,
            allowOccurrenceOverride: defaults.allowOccurrenceOverride,
            allowDueDateOverride: defaults.allowDueDateOverride,
            allowFinishByOverride: defaults.allowFinishByOverride,
            finishByEnabled: defaults.finishByEnabled,
            finishByMode: defaults.finishByMode,
            finishByDays: defaults.finishByDays,
            finishByEvent: defaults.finishByEvent,
            finishByDirection: defaults.finishByDirection,
            configIndex: defaults.configIndex,
            timeLimitConfigId: defaults.timeLimitConfigId,
            timeLimitConfigName: defaults.timeLimitConfigName,
            doNow: true,
            remarks: '',
            professionalFee: 0,
            governmentFee: 0,
            gstPercentage: 18,
            gstAmount: 0,
            totalAmount: 0
        };

        setNormalWorkList(prev => {
            if (prev.some(w => w.workTypeId === wt.workTypeId)) {
                toast({ title: 'Already Added', description: 'This work type is already in your list.', variant: 'default' });
                return prev;
            }
            return [...prev, newItem];
        });

        toast({ title: 'Work Added', description: `"${wt.workTypeName}" added to the list.` });
    }, [toast, getWorkTypeDefaults]);

    const updateWithWarning = useCallback((field: keyof WorkEntry, value: any) => {
        const automatedFields: (keyof WorkEntry)[] = ['occurrence', 'priority'];
        const isAutomated = automatedFields.includes(field);

        const applyUpdate = (val: any) => {
            if (field === 'entryDate' || field === 'dueDate' || field === 'finishByDate') {
                const workStart = field === 'entryDate' ? val : form.entryDate;
                const nextDueDate = field === 'dueDate' ? val : form.dueDate;
                const nextFinishByDate = field === 'finishByDate' ? val : form.finishByDate;
                
                const startObj = parseISO(workStart || new Date().toISOString());
                const dueObj = nextDueDate ? parseISO(nextDueDate) : null;
                const finishObj = nextFinishByDate ? parseISO(nextFinishByDate) : null;

                if (dueObj && isBefore(startOfDay(dueObj), startOfDay(startObj))) {
                    toast({ title: "Invalid Date", description: "Target Due Date cannot be before Work Start Date.", variant: "destructive" });
                    return;
                }
                if (finishObj && isBefore(startOfDay(finishObj), startOfDay(startObj))) {
                    toast({ title: "Invalid Date", description: "Finish By Goal cannot be before Work Start Date.", variant: "destructive" });
                    return;
                }
                let newFinishByDate = nextFinishByDate;
                if (finishObj && dueObj && isAfter(startOfDay(finishObj), startOfDay(dueObj))) {
                    if (form.isFinishByGoalManual) {
                        toast({ title: "Invalid Date", description: "Finish By Goal cannot exceed Target Due Date.", variant: "destructive" });
                        return;
                    } else {
                        newFinishByDate = nextDueDate; // Cap to Target Due Date
                    }
                }
                
                // Track manual overrides
                let manualFlagUpdates = {};
                if (field === 'entryDate') manualFlagUpdates = { isEntryDateManual: true };
                if (field === 'dueDate') manualFlagUpdates = { isTargetDueDateManual: true };
                if (field === 'finishByDate') manualFlagUpdates = { isFinishByGoalManual: true };

                setForm(prev => ({ ...prev, [field]: val, finishByDate: newFinishByDate, ...manualFlagUpdates }));
                return;
            }
            setForm(prev => ({ ...prev, [field]: val }));
        };

        if (isAutomated && form[field] !== undefined && form[field] !== value) {
            setWarning({
                open: true,
                field: field === 'dueDate' ? 'Due Date' : field.charAt(0).toUpperCase() + field.slice(1),
                oldValue: form[field],
                newValue: value,
                onConfirm: () => {
                    applyUpdate(value);
                    setWarning(null);
                }
            });
        } else {
            applyUpdate(value);
        }
    }, [form, toast]);

    const applyConfigToWorkItem = useCallback((itemId: string, configId: string) => {
        const isProposal = !!form.proposalId;
        const list = isProposal ? proposalWorkList : normalWorkList;
        const setList = isProposal ? setProposalWorkList : setNormalWorkList;

        const targetIdx = list.findIndex(item => item.id === itemId);
        if (targetIdx === -1) return;

        const item = list[targetIdx];
        const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(item.workTypeId));
        if (!wt) return;

        const configs = getConfigsForWorkType(wt);
        const selectedConfig = configs.find((c: any) => String(c.id) === String(configId)) || configs[0];
        const defaults = getWorkTypeDefaults(wt, selectedConfig);

        const newList = [...list];
        newList[targetIdx] = {
            ...item,
            ...defaults
        };

        setList(newList);
        toast({ title: 'Config Applied', description: `Applied "${selectedConfig.name}" to ${item.workTypeName}.` });
    }, [form.proposalId, proposalWorkList, normalWorkList, flatWorkTypes, getWorkTypeDefaults, toast]);

    // Fallback: If duration is missing in Edit Mode, load from flatWorkTypes config
    useEffect(() => {
        if (isEditMode && isHydrated && form.workTypeId && flatWorkTypes.length > 0) {
            // Only fallback if both are 0/empty to avoid overwriting manual adjustments
            if (!form.durationDays && !form.durationHours) {
                const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(form.workTypeId));
                if (wt) {
                    if ((wt.durationDays || 0) > 0 || (wt.durationHours || 0) > 0) {
                        setForm(prev => ({
                            ...prev,
                            durationDays: prev.durationDays || wt.durationDays || 0,
                            durationHours: prev.durationHours || wt.durationHours || 0,
                        }));
                    }
                }
            }
        }
    }, [isEditMode, isHydrated, form.workTypeId, flatWorkTypes, form.durationDays, form.durationHours]);

    // ── Load Data ──
    useEffect(() => {
        if (!open) return;

        setLoadingData(true);

        Promise.all([
            supabase.from('associates').select('id, name'),
            apiFetch('/api/employees?active=true').then(res => res.json())
        ]).then(([associatesRes, usersRes]) => {
            const assocList: Associate[] = (associatesRes.data || []).map((a: any) => ({
                id: a.id,
                name: a.name || ''
            }));
            setAssociates(assocList);

            const userList = (usersRes.data || []).map((u: any) => ({
                uid: u.id,
                displayName: u.full_name || u.email || 'Unknown',
                email: u.email
            })).filter((u: any) => u.uid && (u.displayName || u.email));
            setUsers(userList);
        }).catch(console.error);

        apiFetch('/api/departments?active=true')
            .then(res => res.json())
            .then(data => {
                setDepartments(data.data || []);
                setLoadingData(false);
            })
            .catch(err => {
                console.error('[AddWorkDialog] Error fetching active departments:', err);
                setLoadingData(false);
            });

        const fetchProposals = async () => {
            setProposalsLoading(true);
            setProposalsError(null);
            try {
                const res = await fetch('/api/proposals');
                if (res.ok) {
                    const result = await res.json();
                    const list = Array.isArray(result) ? result : (result?.data || []);
                    setProposals(Array.isArray(list) ? list : []);
                } else {
                    setProposalsError('Failed to load proposals');
                }
            } catch (e) {
                console.error("Failed to load proposals", e);
                setProposalsError('Network error while loading proposals');
            } finally {
                setProposalsLoading(false);
            }
        };
        fetchProposals();
    }, [open]);

    // Save to Supabase on change
    useEffect(() => {
        if (!user || loadingData || !open || isEditMode) return;
        if (Object.keys(form).length === 0 || form === EMPTY_FORM) return;

        const timer = setTimeout(async () => {
            try {
                await fetch(`/api/work-drafts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.uid,
                        formData: form,
                        currentStep
                    }),
                });
            } catch (e) {
                console.error("Failed to save draft to Supabase", e);
            }
        }, 1000); // Debounce saves

        return () => clearTimeout(timer);
    }, [form, currentStep, user, open, loadingData, isEditMode]);

    // Restore from Supabase
    useEffect(() => {
        if (!open || !user || preselectedClientId || isEditMode) return;

        const restoreDraft = async () => {
            try {
                const res = await fetch(`/api/work-drafts?userId=${user.uid}`);
                if (!res.ok) return;
                const draft = await res.json();

                if (draft && draft.form_data && Object.keys(draft.form_data).length > 0) {
                    setForm(prev => ({ ...prev, ...draft.form_data }));
                    setCurrentStep(draft.current_step || 0);
                }
            } catch (e) {
                console.error("Failed to restore draft from Supabase", e);
            }
        };

        restoreDraft();
    }, [open, user, preselectedClientId, isEditMode]);

    const clearPersistence = useCallback(async () => {
        if (!user) return;
        try {
            await fetch(`/api/work-drafts?userId=${user.uid}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Failed to clear draft from Supabase", e);
        }
    }, [user]);

    // ── Automatic Recalculation Hooks ──

    // 1. Single Mode Recalculation
    useEffect(() => {
        if (isEditMode || (form.proposalId || normalWorkList.length > 0)) return;
        if (!form.workTypeId) return;

        const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(form.workTypeId));
        if (!wt) return;

        const configs = getConfigsForWorkType(wt);
        const selectedConfig = configs.find((c: any) => c.id === form.timeLimitConfigId) || configs[0];

        const calcInput: CalcDateInput = {
            workStartDate: form.entryDate || format(new Date(), 'yyyy-MM-dd'),
            workTypeName: wt.workTypeName,
            occurrence: (form.occurrence as any) || 'Monthly',
            financialYear: form.financialYear || '2025-26',
            period: form.period || '',
            priority: (form.priority as any) || 'Medium',
            durationDays: form.durationDays || 0,
            durationHours: form.durationHours || 0,
            config: selectedConfig
        };

        const result = calculateWorkDates(calcInput);
        if (!form.isTargetDueDateManual && result.targetDueDate !== form.dueDate) {
            setForm(prev => ({ ...prev, dueDate: result.targetDueDate }));
        }
        if (!form.isFinishByGoalManual && result.finishByGoal !== form.finishByDate) {
            setForm(prev => ({ ...prev, finishByDate: result.finishByGoal }));
        }
        
    }, [form.entryDate, form.occurrence, form.period, form.financialYear, form.workTypeId, form.timeLimitConfigId, form.priority, isEditMode, flatWorkTypes, form.dueDate, form.durationDays, form.durationHours, form.finishByDate, form.isFinishByGoalManual, form.isTargetDueDateManual, form.proposalId, normalWorkList.length]);

    // 2. Batch Mode Recalculation (Normal List)
    useEffect(() => {
        if (isEditMode || normalWorkList.length === 0) return;

        setNormalWorkList(prev => {
            let changed = false;
            const next = prev.map(item => {
                const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(item.workTypeId));
                if (!wt) return item;

                const configs = getConfigsForWorkType(wt);
                const selectedConfig = configs.find((c: any) => c.id === item.timeLimitConfigId) || configs[0];

                const calcInput: CalcDateInput = {
                    workStartDate: item.entryDate || form.entryDate || format(new Date(), 'yyyy-MM-dd'),
                    workTypeName: item.workTypeName,
                    occurrence: (item.occurrence as any) || 'Monthly',
                    financialYear: item.financialYear || '2025-26',
                    period: item.period || '',
                    priority: (item.priority as any) || 'Medium',
                    durationDays: item.durationDays || 0,
                    durationHours: item.durationHours || 0,
                    config: selectedConfig
                };

                const result = calculateWorkDates(calcInput);

                if (result.targetDueDate !== item.dueDate || result.finishByGoal !== item.finishByDate) {
                    changed = true;
                    return { ...item, dueDate: result.targetDueDate, finishByDate: result.finishByGoal };
                }
                return item;
            });
            return changed ? next : prev;
        });
    }, [form.entryDate, normalWorkList, flatWorkTypes, isEditMode]);

    // 3. Batch Mode Recalculation (Proposal List)
    useEffect(() => {
        if (isEditMode || proposalWorkList.length === 0) return;

        setProposalWorkList(prev => {
            let changed = false;
            const next = prev.map(item => {
                const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(item.workTypeId));
                if (!wt) return item;

                const configs = getConfigsForWorkType(wt);
                const selectedConfig = configs.find((c: any) => c.id === item.timeLimitConfigId) || configs[0];

                const calcInput: CalcDateInput = {
                    workStartDate: item.entryDate || form.entryDate || format(new Date(), 'yyyy-MM-dd'),
                    workTypeName: item.workTypeName,
                    occurrence: (item.occurrence as any) || 'Monthly',
                    financialYear: item.financialYear || '2025-26',
                    period: item.period || '',
                    priority: (item.priority as any) || 'Medium',
                    durationDays: item.durationDays || 0,
                    durationHours: item.durationHours || 0,
                    config: selectedConfig
                };

                const result = calculateWorkDates(calcInput);

                if (result.targetDueDate !== item.dueDate || result.finishByGoal !== item.finishByDate) {
                    changed = true;
                    return { ...item, dueDate: result.targetDueDate, finishByDate: result.finishByGoal };
                }
                return item;
            });
            return changed ? next : prev;
        });
    }, [form.entryDate, proposalWorkList, flatWorkTypes, isEditMode]);


    // ── Reset on close ──
    const handleClose = useCallback(async () => {
        setForm(EMPTY_FORM);
        setNormalWorkList([]);
        setCurrentStep(0);
        setProposalSearch('');
        await clearPersistence(); // Clear when explicitly closed/canceled
        onClose();
    }, [onClose, clearPersistence]);


    // ── Update form helper ──
    const update = <K extends keyof WorkEntry>(key: K, value: WorkEntry[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleAddClientFromProposal = async () => {
        if (!selectedProposal) return;
        
        // 1. Robust Data Extraction
        const clientName = selectedProposal.contact_person || selectedProposal.client_name || selectedProposal.clientName || '';
        const email = selectedProposal.email || selectedProposal.email_id || selectedProposal.contact_email || selectedProposal.client_email || '';
        const rawPhone = selectedProposal.phone || selectedProposal.mobile || selectedProposal.contact_number || selectedProposal.contact_phone || selectedProposal.client_phone || '';
        const contacts = selectedProposal.contacts || [];
        
        // Parse phone for country code separation
        const { countryCode, number: phoneNum } = parsePhoneFromPayload(rawPhone, '+91');

        // 2. Precise Deduplication Check
        const existing = clients.find((c: any) => {
            const sameName = c.clientName?.toLowerCase() === clientName.toLowerCase();
            const sameEmail = email && c.email?.toLowerCase() === email.toLowerCase();
            // Use normalized phone for comparison (last 10 digits)
            const samePhone = phoneNum && (c.phone?.includes(phoneNum) || c.mobile_no?.includes(phoneNum));
            return sameName || sameEmail || samePhone;
        });

        if (existing) {
            update('clientId', existing.id);
            update('clientName', existing.clientName);
            update('referenceType', (existing.reference as ReferenceType) || 'Direct');
            update('associateId', existing.associate_id || undefined);
            update('associateName', associates.find(a => a.id === existing.associate_id)?.name);
            toast({ title: 'Client Linked', description: `Identified existing client: ${existing.clientName}` });
            return;
        }

        // 3. Map all contacts from proposal for the ClientForm
        const initialContacts = contacts.length > 0 ? contacts.map((c: any) => {
            const contactPhone = c.phone || c.contact_phone || c.mobile || '';
            const { countryCode: cCC, number: cNum } = parsePhoneFromPayload(contactPhone, c.country_code || c.contact_country_code || countryCode);
            return {
                _id: crypto.randomUUID(),
                sourceType: 'manual',
                name: c.name || c.contact_name || clientName,
                email: c.email || c.contact_email || '',
                phone: cNum,
                countryCode: cCC,
                description: c.description || 'Imported from proposal',
                memberId: ''
            };
        }) : [
            {
                _id: crypto.randomUUID(),
                sourceType: 'manual',
                name: clientName,
                email: email,
                phone: phoneNum,
                countryCode: countryCode,
                description: 'Imported from proposal',
                memberId: ''
            }
        ];

        // 4. Pre-fill common dynamic fields (Email ID, Mobile No)
        const commonFields: Record<string, any> = {};
        
        // Map common keys to extracted values
        if (email) {
            ['Email ID', 'Email', 'Email Address', 'email_id', 'emailId', 'email_address', 'emailAddress'].forEach(k => {
                commonFields[k] = email;
            });
        }
        if (phoneNum) {
            const phoneKeys = [
                'Mobile', 'Mobile No', 'Mobile Number', 'mobile', 'mobile_no', 'mobileNo', 'mobile_number',
                'Phone', 'Phone No', 'Phone Number', 'phone', 'phone_no', 'phoneNo', 'phone_number', 'phoneNumber',
                'Contact', 'Contact No', 'Contact Number', 'contact', 'contact_no', 'contactNo', 'contact_number', 'contactNumber'
            ];
            
            phoneKeys.forEach(k => {
                commonFields[k] = phoneNum;
                commonFields[`${k}_countryCode`] = countryCode;
                // Some fields might use camelCase for countryCode key in metadata
                commonFields[`${k}CountryCode`] = countryCode;
            });
        }

        // 5. Open ClientForm with full pre-filled data
        const initialData: any = {
            clientName: clientName,
            constitutionId: '', // User must pick constitution
            reference: 'Direct',
            contacts: initialContacts,
            fields: commonFields,
            roles: {}
        };

        setClientFormInitialData(initialData);
        setShowNewClientDialog(true);
    };

    // ── Handle new client created inline ──
    const handleClientSave = async (data: ClientFormValues, constitution: BusinessTypeSetup | null) => {
        setClientSubmitting(true);
        try {
            // Use API instead of direct Supabase to ensure normalization and validation logic runs
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.details || 'Failed to create client');
            }

            const newClient = result.data;
            const newClientId = newClient.id;
            const newClientName = newClient.client_name || newClient.clientName;

            // Auto-select
            update('clientId', newClientId);
            update('clientName', newClientName);

            toast({ title: 'Client Created', description: `"${newClientName}" has been created and selected.` });
            setShowNewClientDialog(false);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to create client.', variant: 'destructive' });
        } finally {
            setClientSubmitting(false);
        }
    };

    const handleWorkTypeCreated = (wt: FlatWorkType) => {
        const defaultConfig = getDefaultConfigForWorkType(wt);
        const defaults = getWorkTypeDefaults(wt, defaultConfig);
        setForm(prev => ({
            ...prev,
            departmentId: wt.departmentId,
            departmentName: wt.departmentName,
            categoryId: wt.categoryId,
            categoryName: wt.categoryName,
            workTypeId: wt.workTypeId,
            workTypeName: wt.workTypeName,
            workTypeStatus: wt.workTypeStatus,
            ...defaults
        }));
    };

    const removeNormalWork = (id: string) => {
        setNormalWorkList(prev => prev.filter(w => w.id !== id));
    };

    const toggleProposalWork = (id: string) => {
        setProposalWorkList(prev => prev.map(w => w.id === id ? { ...w, selected: !w.selected } : w));
    };

    const addNormalWork = () => {
        if (!form.workTypeId) {
            toast({ title: 'Select Work Type', description: 'Please select a work type first.', variant: 'destructive' });
            return;
        }
        
        const newItem: ProposalWorkItem = {
            id: `normal-${Date.now()}-${form.workTypeId}`,
            workTypeId: form.workTypeId,
            workTypeName: form.workTypeName || '',
            departmentId: form.departmentId,
            departmentName: form.departmentName,
            categoryId: form.categoryId,
            categoryName: form.categoryName,
            selected: true,
            occurrence: form.occurrence || 'Monthly',
            financialYear: form.financialYear || '',
            period: form.period,
            priority: form.priority || 'Medium',
            dueDate: form.dueDate || '',
            finishByDate: form.finishByDate || '',
            entryDate: form.entryDate || format(new Date(), 'yyyy-MM-dd'),
            durationDays: form.durationDays || 0,
            durationHours: form.durationHours || 0,
            configName: form.configName,
            allowOverride: form.allowOverride,
            allowOccurrenceOverride: form.allowOccurrenceOverride,
            allowDueDateOverride: form.allowDueDateOverride,
            allowFinishByOverride: form.allowFinishByOverride,
            finishByEnabled: form.finishByEnabled,
            finishByMode: form.finishByMode,
            finishByDays: form.finishByDays,
            finishByEvent: form.finishByEvent,
            finishByDirection: form.finishByDirection,
            configIndex: form.configIndex,
            timeLimitConfigId: form.timeLimitConfigId,
            timeLimitConfigName: form.timeLimitConfigName,
            doNow: form.status !== 'Pending',
            remarks: form.remarks || '',
            professionalFee: form.professionalFee || 0,
            governmentFee: form.governmentFee || 0,
            gstPercentage: form.gstPercentage || 18,
            gstAmount: form.gstAmount || 0,
            totalAmount: form.totalAmount || 0,
        };

        setNormalWorkList(prev => [...prev, newItem]);
        
        // Reset only work-specific fields
        setForm(prev => ({
            ...prev,
            workTypeId: '',
            workTypeName: '',
            departmentId: '',
            departmentName: '',
            categoryId: '',
            categoryName: '',
            professionalFee: 0,
            governmentFee: 0,
            gstAmount: 0,
            totalAmount: 0,
            remarks: ''
        }));

        setCurrentStep(0); // Go back to Client & Work Type Selection
        toast({ title: 'Added', description: 'Work added to batch. You can now add more.' });
    };

    const mapProposalWorks = (list: ProposalWorkItem[], clientId: string, clientName: string, userId: string, userName: string) => {
        const now = new Date();
        return list.filter(pw => pw.selected).map(pw => ({
            client_id: clientId,
            client_name: clientName,
            department_id: pw.departmentId,
            department_name: pw.departmentName,
            category_id: pw.categoryId,
            category_name: pw.categoryName,
            work_type_id: pw.workTypeId,
            work_type_name: pw.workTypeName,
            occurrence: pw.occurrence,
            financial_year: pw.financialYear,
            period: pw.period || null,
            priority: pw.priority,
            due_date: pw.dueDate || null,
            finish_by_date: pw.finishByDate || null,
            duration_days: pw.durationDays || 0,
            duration_hours: pw.durationHours || 0,
            status: pw.doNow ? 'Not Started' : 'Pending',
            entered_by: userId,
            entered_by_name: userName,
            entered_date: pw.entryDate || format(now, 'yyyy-MM-dd'),
            entered_time: format(now, 'HH:mm:ss'),
            remarks: pw.remarks || null,
            proposal_id: pw.proposalId || form.proposalId || null,
            professional_fee: pw.professionalFee || 0,
            government_fee: pw.governmentFee || 0,
            gst_percentage: pw.gstPercentage || 18,
            gst_amount: pw.gstAmount || 0,
            total_amount: pw.totalAmount || 0,
            pending_order: !pw.doNow ? pw.pendingOrder : null,
            workflow_status: 'AVAILABLE',
        }));
    };

    // ── Save ──
    const handleSave = async () => {
        if (!user) return;

        const now = new Date();
        const currentUser = users.find((u: any) => u.uid === user.uid);
        const enteredByName = currentUser?.displayName || user.email || 'Unknown';

        setSaving(true);
        try {
            // Date Validation Hierarchy
            let dateErrors: string[] = [];
            const itemsToValidate = isEditMode 
                ? [] 
                : (form.proposalId ? proposalWorkList.filter(pw => pw.selected) : normalWorkList);

            if (isEditMode) {
                const val = validateDateHierarchy(form.entryDate || '', form.dueDate || '', form.finishByDate || '');
                if (!val.isValid) {
                    if (val.isTargetBeforeStart) dateErrors.push(`Target Due Date cannot be before Work Start Date.`);
                    if (val.isFinishBeforeStart) dateErrors.push(`Finish By Goal cannot be before Work Start Date.`);
                    if (val.isFinishAfterTarget) dateErrors.push(`Finish By Goal cannot be after Target Due Date.`);
                }
            } else {
                itemsToValidate.forEach((item, index) => {
                    const itemName = item.workTypeName || `Item ${index + 1}`;
                    const val = validateDateHierarchy(item.entryDate || form.entryDate || '', item.dueDate || '', item.finishByDate || '');
                    if (!val.isValid) {
                        if (val.isTargetBeforeStart) dateErrors.push(`${itemName}: Due Date cannot be before Start Date.`);
                        if (val.isFinishBeforeStart) dateErrors.push(`${itemName}: Finish By cannot be before Start Date.`);
                        if (val.isFinishAfterTarget) dateErrors.push(`${itemName}: Finish By cannot be after Due Date.`);
                    }
                });
            }

            if (dateErrors.length > 0) {
                toast({ 
                    title: "Invalid Dates", 
                    description: dateErrors[0], 
                    variant: "destructive" 
                });
                setSaving(false);
                return;
            }

            // Validation for Pending Order
            const listToValidate = isEditMode 
                ? [] // No batch validation in single edit
                : (form.proposalId ? proposalWorkList.filter(pw => pw.selected) : normalWorkList);

            if (listToValidate.length > 0) {
                const pendingItems = listToValidate.filter(item => !item.doNow);
                if (pendingItems.length > 1) {
                    const orders = pendingItems.map(item => item.pendingOrder).filter(Boolean) as number[];
                    
                    // Check if all pending items have an order
                    if (orders.length < pendingItems.length) {
                        toast({ 
                            title: "Missing Sequence", 
                            description: "Please define the execution order for all pending items.", 
                            variant: "destructive" 
                        });
                        setSaving(false);
                        return;
                    }

                    // Check for uniqueness
                    const uniqueOrders = new Set(orders);
                    if (uniqueOrders.size < orders.length) {
                        toast({ 
                            title: "Duplicate Order", 
                            description: "Execution orders must be unique.", 
                            variant: "destructive" 
                        });
                        setSaving(false);
                        return;
                    }

                    // Check for gaps and starting from 1
                    const sortedOrders = [...orders].sort((a, b) => a - b);
                    for (let i = 0; i < sortedOrders.length; i++) {
                        if (sortedOrders[i] !== i + 1) {
                            toast({ 
                                title: "Invalid Sequence", 
                                description: "Execution order must be continuous starting from 1 (e.g., 1, 2, 3...).", 
                                variant: "destructive" 
                            });
                            setSaving(false);
                            return;
                        }
                    }
                }
            }

            if (isEditMode) {
                // UPDATE logic
                const payload = {
                    client_id: form.clientId,
                    client_name: form.clientName,
                    department_id: form.departmentId,
                    department_name: form.departmentName,
                    category_id: form.categoryId,
                    category_name: form.categoryName,
                    work_type_id: form.workTypeId,
                    work_type_name: form.workTypeName,
                    work_type_status: form.workTypeStatus,
                    occurrence: form.occurrence,
                    financial_year: form.financialYear,
                    period: form.period,
                    priority: form.priority,
                    reference_type: form.referenceType,
                    associate_id: form.associateId,
                    associate_name: form.associateName,
                    associate_effective_date: form.associateEffectiveDate,
                    due_date: form.dueDate,
                    finish_by_date: form.finishByDate,
                    finish_by_time: form.finishByTime,
                    duration_days: form.durationDays || 0,
                    duration_hours: form.durationHours || 0,
                    remarks: form.remarks,
                    status: form.status,
                    proposal_id: form.proposalId,
                    professional_fee: form.professionalFee,
                    government_fee: form.governmentFee,
                    gst_percentage: form.gstPercentage,
                    gst_amount: form.gstAmount,
                    total_amount: form.totalAmount,
                    pending_order: form.status === 'Pending' ? form.pendingOrder : null,
                };

                const response = await apiFetch(`/api/works/${initialData.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to update work');

                toast({ title: "Work Updated", description: "The work entry has been updated successfully." });
            } else {
                // INSERT logic
                let entries: any[] = [];

                if (form.proposalId) {
                    // Proposal Conversion Path
                    entries = mapProposalWorks(proposalWorkList, form.clientId || '', form.clientName || '', user.uid, enteredByName);
                } else if (normalWorkList.length > 0) {
                    // Normal Multi-Work Path
                    entries = mapProposalWorks(normalWorkList, form.clientId || '', form.clientName || '', user.uid, enteredByName);
                } else {
                    // Normal Single-Work Path
                    if (form.workTypeId) {
                        const w = form;
                        entries = [{
                            client_id: w.clientId || null,
                            client_name: w.clientName || '',
                            department_id: w.departmentId || '',
                            department_name: w.departmentName || '',
                            category_id: w.categoryId || '',
                            category_name: w.categoryName || '',
                            work_type_id: w.workTypeId || '',
                            work_type_name: w.workTypeName || '',
                            work_type_status: w.workTypeStatus || 'ACTIVE',
                            occurrence: w.occurrence || 'Monthly',
                            financial_year: w.financialYear || '',
                            period: w.period || null,
                            priority: w.priority || 'Medium',
                            reference_type: w.referenceType || 'Direct',
                            associate_id: w.associateId || null,
                            associate_name: w.associateName || null,
                            associate_effective_date: w.associateEffectiveDate || null,
                            due_date: w.dueDate || null,
                            finish_by_date: w.finishByDate || null,
                            finish_by_time: w.finishByTime || null,
                            duration_days: w.durationDays || 0,
                            duration_hours: w.durationHours || 0,
                            status: w.status || 'Not Started',
                            entered_by: user.uid || null,
                            entered_by_name: enteredByName,
                            entered_date: w.entryDate || format(now, 'yyyy-MM-dd'),
                            entered_time: format(now, 'HH:mm:ss'),
                            remarks: w.remarks || null,
                            proposal_id: w.proposalId || null,
                            professional_fee: w.professionalFee || 0,
                            government_fee: w.governmentFee || 0,
                            gst_percentage: w.gstPercentage || 18,
                            gst_amount: w.gstAmount || 0,
                            total_amount: w.totalAmount || 0,
                            pending_order: w.status === 'Pending' ? w.pendingOrder : null,
                            workflow_status: 'AVAILABLE',
                        }];
                    }
                }

                if (entries.length === 0) {
                    toast({
                        title: "No works to save",
                        description: "Please select at least one service or add a work entry.",
                        variant: "destructive"
                    });
                    setSaving(false);
                    return;
                }

                const response = await apiFetch('/api/works', {
                    method: 'POST',
                    body: JSON.stringify({ works: entries })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to create work entries');

                // Server now handles atomic assignments and audits!
                toast({ title: '✅ Success', description: `${entries.length} work entries created successfully.` });
                await clearPersistence();
            }

            await handleClose();
            onWorkCreated?.();
        } catch (err: any) {
            console.error('Save failed:', err);
            toast({ title: 'Error', description: err.message || 'Failed to save.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // ── Validation per step ──
    const canProceedFromStep = (step: number): boolean => {
        if (!isHydrated || loadingData) return false;

        const isBatchMode = (form.proposalId || normalWorkList.length > 0) && !isEditMode;
        const list = form.proposalId ? proposalWorkList : normalWorkList;
        const selected = list.filter(pw => pw.selected);

        switch (step) {
            case 0: // Client + Work Type
                if (!form.clientId) return false;
                if (isBatchMode) return selected.length > 0;
                return !!form.workTypeId;

            case 1: // Occurrence + Details & Dates
                if (isBatchMode) {
                    // Validate Occurrence fields
                    const occurrenceValid = selected.every(pw =>
                        pw.occurrence &&
                        pw.financialYear &&
                        (pw.occurrence === 'Yearly' || pw.occurrence === 'Often' || pw.period)
                    );
                    if (!occurrenceValid) return false;

                    // Validate Details & Dates fields
                    for (const pw of selected) {
                        if (!pw.priority || !pw.dueDate || !pw.finishByDate) return false;
                        if (new Date(pw.finishByDate) > new Date(pw.dueDate)) {
                            toast({
                                title: "Invalid Dates",
                                description: `"${pw.workTypeName}": Finish By Goal cannot be after the Target Due Date.`,
                                variant: "destructive"
                            });
                            return false;
                        }
                    }
                    return true;
                }
                if (!form.priority || !form.referenceType || !form.dueDate || !form.finishByDate) return false;
                if (new Date(form.finishByDate) > new Date(form.dueDate)) {
                    toast({
                        title: "Invalid Dates",
                        description: "Finish By Date cannot be after the Target Due Date.",
                        variant: "destructive"
                    });
                    return false;
                }
                return true;

            default:
                return true;
        }
    };

    const nextStep = () => {
        if (canProceedFromStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
        } else {
            toast({ title: "Required", description: "Please complete all fields on this step.", variant: "destructive" });
        }
    };

    const prevStep = async () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };


    // ── Preselect Proposal ──
    useEffect(() => {
        if (preselectedProposalId && normalizedProposals.length > 0 && open && !isEditMode) {
            const p = normalizedProposals.find(p => p.id === preselectedProposalId);
            if (p && p.isEligible) {
                // 5. Do not create duplicate clients: Before creating, check by client name + phone/email
                const existing = clients.find((c: any) => {
                    const sameName = c.clientName?.toLowerCase() === p.clientName.toLowerCase();
                    const sameEmail = p.email && c.email?.toLowerCase() === p.email.toLowerCase();
                    const samePhone = p.phone && (c.phone === p.phone || c.mobile_no === p.phone);
                    return sameName || sameEmail || samePhone;
                });

                let clientData = {
                    clientId: '',
                    clientName: p.clientName,
                    referenceType: 'Direct' as ReferenceType,
                    associateId: undefined as string | undefined,
                    associateName: undefined as string | undefined
                };

                if (existing) {
                    clientData = {
                        clientId: existing.id,
                        clientName: existing.clientName,
                        referenceType: (existing.reference as ReferenceType) || 'Direct',
                        associateId: existing.associate_id || undefined,
                        associateName: associates.find(a => a.id === existing.associate_id)?.name
                    };
                } else {
                    const isRealClient = clients.some((c: any) => c.id === p.clientId);
                    if (p.clientId && isRealClient) {
                        clientData.clientId = p.clientId;
                    }
                }

                setForm(prev => ({
                    ...prev,
                    ...clientData,
                    proposalId: p.id,
                    professionalFee: p.professionalFee,
                    governmentFee: p.governmentFee,
                    gstPercentage: p.gstPercentage,
                    gstTarget: p.gstTarget,
                    gstAmount: p.gstAmount,
                    totalAmount: p.totalAmount,
                    remarks: p.description
                }));

                // Initialize granular work list for multi-step config
                const initialWorks = (p.proposedWork || []).map((pw: any, idx: number) => {
                    const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(pw.workTypeId));
                    const defaultConfig = wt ? getDefaultConfigForWorkType(wt) : null;
                    const defaults = wt ? getWorkTypeDefaults(wt, defaultConfig) : {
                        occurrence: 'Monthly' as OccurrenceType,
                        financialYear: '2025-26',
                        period: 'April',
                        priority: 'Medium' as PriorityType,
                        dueDate: '',
                        finishByDate: '',
                        durationDays: 0,
                        durationHours: 0,
                        configName: undefined,
                        allowOverride: true,
                        configIndex: 0,
                        timeLimitConfigId: undefined,
                        timeLimitConfigName: undefined
                    };

                    return {
                        id: pw.id || `pw-${idx}`,
                        workTypeId: pw.workTypeId,
                        workTypeName: getServiceName(pw),
                        departmentId: wt?.departmentId,
                        departmentName: wt?.departmentName,
                        categoryId: wt?.categoryId,
                        categoryName: wt?.categoryName,
                        professionalFee: getProfessionalFee(pw, p),
                        governmentFee: getGovernmentFee(pw),
                        gstPercentage: getGstPercentage(pw, p),
                        gstAmount: getGstAmount(pw, p),
                        totalAmount: getServiceTotal(pw, p, p.proposedWork || []),
                        selected: true,
                        ...defaults,
                        doNow: true,
                        remarks: '',
                        proposalId: p.id
                    };
                });
                setProposalWorkList(initialWorks);

                toast({ title: 'Proposal Loaded', description: `Loaded ${initialWorks.length} services for ${p.clientName}.` });
            }
        }
    }, [preselectedProposalId, normalizedProposals, open, isEditMode, clients, associates, flatWorkTypes, toast, getGstAmount, getServiceTotal, getWorkTypeDefaults, getGovernmentFee, getGstPercentage, getProfessionalFee, getServiceName]);

    // ── Derive Eligible Proposals ──
    const eligibleProposals = useMemo(() => {
        const search = proposalSearch.toLowerCase().trim();
        return normalizedProposals.filter(p => {
            if (!p.isEligible) return false;
            if (!search) return true;
            return p.searchBlob.includes(search);
        });
    }, [normalizedProposals, proposalSearch]);

    if (!open) return null;

    // ─── Step Content ───────────────────────────────────────────────────────────

    const selectedClient = clients.find((c: any) => String(c.id) === String(form.clientId));
    const selectedWorkType = flatWorkTypes.find(w => String(w.workTypeId) === String(form.workTypeId));

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(v) => { if (!v) handleClose(); }}
            >
                <DialogContent
                    className="max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    {/* Header */}
                    <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent flex-row justify-between items-center shrink-0">
                        <div className="flex flex-col">
                            <DialogTitle className="text-xl font-bold">{isViewMode ? 'View Work' : (isEditMode ? 'Update Work' : 'Add New Work')}</DialogTitle>
                            <DialogDescription className="text-sm">
                                {isViewMode ? 'View details for this work entry.' : (isEditMode ? 'Modify editable details for this work entry.' : 'Create a new work entry with validation workflow.')}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2 pr-12">
                            <Badge variant="outline" className="text-xs bg-background h-6">
                                Step {currentStep + 1} of {STEPS.length}
                            </Badge>
                        </div>
                    </DialogHeader>

                    {/* Step Indicator */}
                    <div className="flex items-center border-b bg-muted/30 px-6 py-4 overflow-x-auto scrollbar-hide">
                        <div className="flex items-center justify-center w-full gap-1 min-w-max">
                            {STEPS.map((step, idx) => {
                                const Icon = step.icon;
                                const isActive = idx === currentStep;
                                const isDone = idx < currentStep;

                                return (
                                    <React.Fragment key={step.id}>
                                        <button
                                            onClick={() => {
                                                if (isEditMode || isDone || idx === currentStep) {
                                                    setCurrentStep(idx);
                                                }
                                            }}
                                            className={cn(
                                                'flex items-center gap-3 px-4 py-2 rounded-2xl transition-all group shrink-0',
                                                isActive
                                                    ? 'bg-white shadow-md shadow-primary/5 ring-1 ring-primary/10'
                                                    : (isDone || isEditMode) ? 'hover:bg-white/50 cursor-pointer' : 'opacity-60 cursor-default'
                                            )}
                                        >
                                            <div className={cn(
                                                'h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-sm',
                                                isActive && 'bg-primary text-white scale-110',
                                                isDone && 'bg-emerald-500 text-white',
                                                !isActive && !isDone && 'bg-muted text-muted-foreground'
                                            )}>
                                                {isDone && !isActive ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                            </div>
                                            <div className="flex flex-col items-start pr-1">
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest leading-none mb-1",
                                                    isActive ? "text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                                                )}>
                                                    Step {idx + 1}
                                                </span>
                                                <span className={cn(
                                                    "text-xs font-bold whitespace-nowrap",
                                                    isActive ? "text-slate-900" : "text-slate-500"
                                                )}>
                                                    {step.label}
                                                </span>
                                            </div>
                                        </button>
                                        {idx < STEPS.length - 1 && (
                                            <div className="h-px w-4 bg-muted-foreground/10 shrink-0" />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                      <fieldset disabled={isViewMode} className="min-w-0 space-y-5">
                        {loadingData ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-3 text-muted-foreground">Loading data...</span>
                            </div>
                        ) : (
                            <>
                                {/* ── STEP 0: Client ── */}
                                {currentStep === 0 && (
                                    <div className="space-y-5 animate-in fade-in-50 slide-in-from-right-4 duration-300">

                                        <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col gap-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-indigo-600" /> Convert from Proposal
                                                    </h3>
                                                    <p className="text-xs text-indigo-700 mt-1">Automatically fill client, works, and financial setups by selecting an approved proposal.</p>
                                                </div>
                                            </div>
                                            <Popover
                                                open={!isProposalPreselected && !isEditMode && proposalPopoverOpen}
                                                onOpenChange={(v) => {
                                                    if (isProposalPreselected || isEditMode) return;
                                                    setProposalPopoverOpen(v);
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        disabled={proposalsLoading || isProposalPreselected || isEditMode}
                                                        className={cn(
                                                            "w-full justify-between border-indigo-200 bg-white",
                                                            (isProposalPreselected || isEditMode)
                                                                ? "opacity-70 cursor-not-allowed bg-slate-50 hover:bg-slate-50"
                                                                : "hover:bg-indigo-50 hover:text-indigo-900"
                                                        )}
                                                    >
                                                        <span className={form.proposalId ? "text-indigo-900 font-semibold truncate" : "text-muted-foreground truncate"}>
                                                            {form.proposalId ? (
                                                                currentProposal?.clientName || 
                                                                currentProposal?.client_name || 
                                                                normalizedProposals.find(p => p.id === form.proposalId)?.clientName || 
                                                                (isEditMode ? `Proposal #${form.proposalId.slice(-6)}` : 'Selected Proposal')
                                                            ) : 'Select a Proposal to Convert (Optional)...'}
                                                        </span>
                                                        {proposalsLoading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
                                                        ) : (isProposalPreselected || isEditMode) ? (
                                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                                        ) : (
                                                            <ChevronsUpDown className="h-4 w-4 shrink-0 text-indigo-400" />
                                                        )}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0" align="start">
                                                    <Command shouldFilter={false}>
                                                        <CommandInput placeholder="Search proposals..." value={proposalSearch} onValueChange={setProposalSearch} />
                                                        <CommandList>
                                                            {proposalsLoading ? (
                                                                <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading proposals...
                                                                </div>
                                                            ) : proposalsError ? (
                                                                <div className="p-4 text-center text-sm text-red-500 uppercase font-bold tracking-tight">
                                                                    {proposalsError}
                                                                </div>
                                                            ) : eligibleProposals.length === 0 ? (
                                                                <CommandEmpty>No approved proposals available.</CommandEmpty>
                                                            ) : (
                                                                <CommandGroup>
                                                                    {eligibleProposals.map(p => {
                                                                        const desc = p.proposedWork.map((pw: any) => pw.workTypeName).join(', ');

                                                                        return (
                                                                            <CommandItem
                                                                                key={p.id}
                                                                                value={`${p.id}`}
                                                                                onSelect={() => {
                                                                                    setForm(prev => ({
                                                                                        ...prev,
                                                                                        proposalId: p.id,
                                                                                        professionalFee: p.professionalFee,
                                                                                        governmentFee: p.governmentFee,
                                                                                        gstPercentage: p.gstPercentage,
                                                                                        gstTarget: p.gstTarget,
                                                                                        gstAmount: p.gstAmount,
                                                                                        totalAmount: p.totalAmount,
                                                                                        remarks: p.description
                                                                                    }));

                                                                                    // Initialize granular work list for multi-step config
                                                                                    const initialWorks = (p.proposedWork || []).map((pw: any, idx: number) => {
                                                                                        const wt = flatWorkTypes.find(w => w.workTypeId === pw.workTypeId);
                                                                                        
                                                                                        // Use helper for standardized defaults
                                                                                        const defaults = wt ? getWorkTypeDefaults(wt, 0) : {
                                                                                            occurrence: 'Monthly' as OccurrenceType,
                                                                                            financialYear: '2025-26',
                                                                                            period: 'April',
                                                                                            priority: 'Medium' as PriorityType,
                                                                                            dueDate: '',
                                                                                            finishByDate: '',
                                                                                            durationDays: 0,
                                                                                            durationHours: 0,
                                                                                            configName: undefined,
                                                                                            allowOverride: true,
                                                                                            configIndex: 0
                                                                                        };

                                                                                        return {
                                                                                            id: pw.id || 'pw-' + idx,
                                                                                            workTypeId: pw.workTypeId,
                                                                                            workTypeName: getServiceName(pw),
                                                                                            departmentId: wt?.departmentId,
                                                                                            departmentName: wt?.departmentName,
                                                                                            categoryId: wt?.categoryId,
                                                                                            categoryName: wt?.categoryName,
                                                                                            professionalFee: getProfessionalFee(pw, p),
                                                                                            governmentFee: getGovernmentFee(pw),
                                                                                            gstPercentage: getGstPercentage(pw, p),
                                                                                            gstAmount: getGstAmount(pw, p),
                                                                                            totalAmount: getServiceTotal(pw, p, p.proposedWork || []),
                                                                                            selected: true,
                                                                                            occurrence: defaults.occurrence,
                                                                                            financialYear: defaults.financialYear,
                                                                                            period: defaults.period,
                                                                                            priority: defaults.priority,
                                                                                            dueDate: defaults.dueDate,
                                                                                            finishByDate: defaults.finishByDate,
                                                                                            durationDays: defaults.durationDays,
                                                                                            durationHours: defaults.durationHours,
                                                                                            configName: defaults.configName,
                                                                                            allowOverride: defaults.allowOverride,
                                                                                            configIndex: defaults.configIndex,
                                                                                            doNow: true,
                                                                                            remarks: '',
                                                                                            proposalId: p.id
                                                                                        };
                                                                                    });
                                                                                    setProposalWorkList(initialWorks);

                                                                                    // 5. Do not create duplicate clients: Before creating, check by client name + phone/email
                                                                                    const existing = clients.find((c: any) => {
                                                                                        const sameName = c.clientName?.toLowerCase() === p.clientName.toLowerCase();
                                                                                        const sameEmail = p.email && c.email?.toLowerCase() === p.email.toLowerCase();
                                                                                        const samePhone = p.phone && (c.phone === p.phone || c.mobile_no === p.phone);
                                                                                        return sameName || sameEmail || samePhone;
                                                                                    });

                                                                                    if (existing) {
                                                                                        update('clientId', existing.id);
                                                                                        update('clientName', existing.clientName);
                                                                                        update('referenceType', (existing.reference as ReferenceType) || 'Direct');
                                                                                        update('associateId', existing.associate_id || undefined);
                                                                                        update('associateName', associates.find(a => a.id === existing.associate_id)?.name);
                                                                                        toast({ title: 'Client Linked', description: `Identified existing client: ${existing.clientName}` });
                                                                                    } else {
                                                                                        // Check if p.clientId is a REAL client in the database
                                                                                        const isRealClient = clients.some((c: any) => c.id === p.clientId);
                                                                                        if (p.clientId && isRealClient) {
                                                                                            update('clientId', p.clientId);
                                                                                            update('clientName', p.clientName);
                                                                                        } else {
                                                                                            // Clear clientId to trigger "New Client From Proposal" card if it's a temp ID or null
                                                                                            update('clientId', '');
                                                                                            update('clientName', p.clientName);
                                                                                        }
                                                                                    }

                                                                                    setProposalPopoverOpen(false);
                                                                                    toast({ title: 'Proposal Loaded', description: `Loaded ${initialWorks.length} services for ${p.clientName}. Verify details and proceed.` });
                                                                                }}
                                                                                className="flex flex-col items-start p-3 py-3 border-b"
                                                                            >
                                                                                <span className="font-bold text-slate-800">{p.clientName}</span>
                                                                                <span className="text-xs text-slate-500 mt-1 truncate w-full">{desc}</span>
                                                                                <span className="text-xs font-semibold text-emerald-600 mt-1 w-full text-right tracking-tighter">Amount: ₹{p.totalAmount.toLocaleString()}</span>
                                                                            </CommandItem>
                                                                        );
                                                                    })}
                                                                </CommandGroup>
                                                            )}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        <SectionHeader icon={Building2} title="Client Selection" subtitle="Select an existing client or add a new one." />

                                        <div className="space-y-2">
                                            <Label className="font-semibold">Client Name <span className="text-red-500">*</span></Label>
                                            <Popover
                                                open={!isClientPreselected && !isEditMode && clientPopoverOpen}
                                                onOpenChange={(v) => {
                                                    if (isClientPreselected || isEditMode) return;
                                                    setClientPopoverOpen(v);
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        disabled={clientsLoading || isClientPreselected || isEditMode}
                                                        className={cn(
                                                            "w-full justify-between border-slate-200 bg-white h-11 transition-all",
                                                            (isClientPreselected || isEditMode)
                                                                ? "opacity-70 cursor-not-allowed bg-slate-50 border-slate-200"
                                                                : "hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <span className={form.clientId ? "text-slate-900 font-semibold truncate" : "text-muted-foreground truncate"}>
                                                            {form.clientId ? (clients.find((c: any) => c.id === form.clientId)?.name || 'Selected Client') : 'Search or Select Client...'}
                                                        </span>
                                                        {clientsLoading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                                                        ) : (isClientPreselected || isEditMode) ? (
                                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                                        ) : (
                                                            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                                                        )}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0" align="start" style={{ width: '100%', minWidth: 380 }}>
                                                    <Command>
                                                        <CommandInput placeholder="Search clients..." value={clientSearch} onValueChange={setClientSearch} />
                                                        <CommandList>
                                                            <CommandEmpty>No client found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {/* Add New Client Option */}
                                                                <CommandItem
                                                                    value="__add_new__"
                                                                    onSelect={() => {
                                                                        if (isEditMode) return;
                                                                        setClientPopoverOpen(false);
                                                                        setShowNewClientDialog(true);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-primary font-bold hover:bg-primary/5 flex items-center gap-2 border-b-2 border-slate-50"
                                                                >
                                                                    <PlusCircle className="h-4 w-4" /> Create New Client
                                                                </CommandItem>
                                                            </CommandGroup>
                                                            <CommandSeparator />
                                                            <CommandGroup heading="Existing Clients">
                                                                {clients
                                                                    .filter((c: ClientSimple) => {
                                                                        const searchStr = `${c.clientName} ${c.companyName || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
                                                                        return searchStr.includes(clientSearch.toLowerCase());
                                                                    })
                                                                    .map((c: any) => (
                                                                        <CommandItem
                                                                            key={c.id}
                                                                            value={`${c.clientName} ${c.companyName || ''} ${c.clientIdHash || ''} ${c.id}`}
                                                                            onSelect={() => {
                                                                                update('clientId', c.id);
                                                                                update('clientName', c.clientName);
                                                                                setClientPopoverOpen(false);
                                                                            }}
                                                                            className="flex flex-col items-start py-3 px-4 cursor-pointer hover:bg-slate-50 border-b last:border-0"
                                                                        >
                                                                            <div className="flex w-full justify-between items-center mb-1">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-slate-900">{c.clientName}</span>
                                                                                    {c.clientIdHash && <span className="text-[10px] font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded w-fit mt-1">CODE: {c.clientIdHash}</span>}
                                                                                </div>
                                                                                {form.clientId === c.id && <Check className="h-4 w-4 text-primary" />}
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground w-full mt-2">
                                                                                {c.companyName && <span className="flex items-center gap-1 font-medium text-primary/70 truncate max-w-[150px]"><Building2 className="h-3 w-3" /> {c.companyName}</span>}
                                                                                {c.reference && <span className="flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-1 rounded"><Flag className="h-3 w-3" /> {c.reference}</span>}
                                                                                {c.email && <span className="flex items-center gap-1 truncate max-w-[180px]"><Link className="h-3 w-3" /> {c.email}</span>}
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {!form.clientId && form.proposalId && selectedProposal && (
                                            <Card className="border-amber-200 bg-amber-50/30 overflow-hidden rounded-2xl mb-6 border-dashed animate-in fade-in zoom-in-95 duration-300">
                                                <CardContent className="p-5">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="flex items-start gap-4">
                                                            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200 shadow-sm">
                                                                <UserPlus className="h-6 w-6 text-amber-600" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-black text-amber-900 tracking-tight">New Client From Proposal</h3>
                                                                    <Badge variant="outline" className="bg-amber-100/50 text-amber-700 border-amber-200 text-[9px] font-black uppercase px-2 py-0">Temporary</Badge>
                                                                </div>
                                                                <p className="text-xs font-bold text-amber-700/80 leading-relaxed">
                                                                    This proposal is for <span className="text-amber-900 font-black underline decoration-amber-300 underline-offset-2">"{selectedProposal.clientName}"</span>. 
                                                                    Create a permanent client record to proceed with work creation.
                                                                </p>
                                                                <div className="flex flex-wrap gap-3 mt-3">
                                                                    {selectedProposal.email && (
                                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-white/50 px-2 py-1 rounded-lg border border-amber-200/50">
                                                                            <Mail className="h-3 w-3 text-amber-500" /> {selectedProposal.email}
                                                                        </div>
                                                                    )}
                                                                    {selectedProposal.phone && (
                                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-white/50 px-2 py-1 rounded-lg border border-amber-200/50">
                                                                            <Phone className="h-3 w-3 text-amber-500" /> {selectedProposal.phone}
                                                                        </div>
                                                                    )}
                                                                    {selectedProposal.contacts?.length > 1 && (
                                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-800 bg-blue-50/50 px-2 py-1 rounded-lg border border-blue-200/50">
                                                                            <UserPlus className="h-3 w-3 text-blue-500" /> +{selectedProposal.contacts.length - 1} More Contacts
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button 
                                                            onClick={handleAddClientFromProposal}
                                                            className="h-11 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-lg shadow-amber-200 border-none transition-all active:scale-95 group shrink-0"
                                                        >
                                                            Add Client From Proposal
                                                            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {form.clientId && (
                                            <div className="space-y-5 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                                                <ClientDetailsCard
                                                    client={selectedClient}
                                                    constitutions={constitutions}
                                                    associates={associates}
                                                />

                                                <SectionHeader
                                                    icon={form.proposalId ? ClipboardList : Briefcase}
                                                    title={form.proposalId ? "Configure Proposal Services" : (isEditMode ? "Update Work Type" : "Work Type Selection")}
                                                    subtitle={form.proposalId ? `Setting up ${proposalWorkList.length} services for ${form.clientName}.` : (isEditMode ? `Reviewing work type for ${form.clientName}.` : "Choose from your master list or add a new work type.")}
                                                />

                                                {form.proposalId ? (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 gap-4">
                                                            {proposalWorkList.map((pw, idx) => (
                                                                <Card key={pw.id} className={cn(
                                                                    "border shadow-sm transition-all rounded-2xl overflow-hidden",
                                                                    pw.selected ? "border-indigo-200 bg-white ring-1 ring-indigo-50" : "border-gray-100 bg-slate-50 opacity-60"
                                                                )}>
                                                                    <div className={cn(
                                                                        "px-5 py-4 flex items-center justify-between border-b transition-colors",
                                                                        pw.selected ? "bg-indigo-600 border-indigo-600" : "bg-slate-200 border-slate-200"
                                                                    )}>
                                                                        <div className="flex items-center gap-4">
                                                                            <div
                                                                                className={cn(
                                                                                    "h-6 w-6 rounded-lg flex items-center justify-center cursor-pointer transition-all border-2",
                                                                                    pw.selected ? "bg-white border-white" : "bg-transparent border-slate-400"
                                                                                )}
                                                                                onClick={() => {
                                                                                    if (isEditMode) return;
                                                                                    const newList = [...proposalWorkList];
                                                                                    newList[idx].selected = !pw.selected;
                                                                                    setProposalWorkList(newList);
                                                                                }}
                                                                            >
                                                                                {pw.selected && <Check className="h-4 w-4 text-indigo-600 stroke-[4px]" />}
                                                                            </div>
                                                                            <div>
                                                                                <h4 className={cn("font-black uppercase tracking-tight text-sm leading-none transition-colors", pw.selected ? "text-white" : "text-slate-600")}>{pw.workTypeName}</h4>
                                                                                <p className={cn("text-[9px] font-black opacity-70 mt-1 uppercase tracking-widest leading-none transition-colors", pw.selected ? "text-indigo-100" : "text-slate-400")}>SERVICE #{idx + 1}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className={cn("text-[8px] font-black uppercase tracking-widest leading-none mb-1 opacity-60", pw.selected ? "text-white" : "text-slate-500")}>TOTAL FEE</p>
                                                                            <p className={cn("text-lg font-black leading-none", pw.selected ? "text-white" : "text-slate-700")}>₹{pw.totalAmount.toLocaleString()}</p>
                                                                        </div>
                                                                    </div>

                                                                    {pw.selected && (
                                                                        <CardContent className="p-4 bg-slate-50/30">
                                                                            <div className="grid grid-cols-4 gap-4 text-center">
                                                                                <div>
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Prof. Fee</p>
                                                                                    <p className="text-xs font-bold text-slate-700">₹{pw.professionalFee.toLocaleString()}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Govt. Fee</p>
                                                                                    <p className="text-xs font-bold text-slate-700">₹{pw.governmentFee.toLocaleString()}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">GST ({pw.gstPercentage}%)</p>
                                                                                    <p className="text-xs font-bold text-slate-700">₹{pw.gstAmount.toLocaleString()}</p>
                                                                                </div>
                                                                                <div className="bg-indigo-50 rounded-lg p-1.5 border border-indigo-100">
                                                                                    <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Total</p>
                                                                                    <p className="text-xs font-black text-indigo-700">₹{pw.totalAmount.toLocaleString()}</p>
                                                                                </div>
                                                                            </div>
                                                                        </CardContent>
                                                                    )}
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="font-semibold">Work Type <span className="text-red-500">*</span></Label>
                                                            </div>
                                                            <Popover
                                                                open={!isEditMode && workTypePopoverOpen}
                                                                onOpenChange={(v) => {
                                                                    if (isEditMode) return;
                                                                    setWorkTypePopoverOpen(v);
                                                                }}
                                                            >
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        aria-expanded={workTypePopoverOpen}
                                                                        className="w-full justify-between h-11 border-slate-200 hover:border-primary/30 hover:bg-slate-50 rounded-xl transition-all font-bold"
                                                                        disabled={isEditMode}
                                                                    >
                                                                        <span className={cn(!form.workTypeId && 'text-muted-foreground')}>
                                                                            {form.workTypeId ? `${form.categoryName} → ${form.workTypeName}${form.configName ? ' (' + form.configName + ')' : ''}` : 'Select work type...'}
                                                                        </span>
                                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-full p-0" align="start" style={{ width: '100%', minWidth: 420 }}>
                                                                    <Command>
                                                                        <CommandInput placeholder="Search work types..." />
                                                                        <CommandList>
                                                                            <CommandEmpty>No work type found.</CommandEmpty>
                                                                            <CommandGroup>
                                                                                <CommandItem
                                                                                    value="__add_new_wt__"
                                                                                    onSelect={() => {
                                                                                        if (isEditMode) return;
                                                                                        setWorkTypePopoverOpen(false);
                                                                                        setShowNewWorkTypeDialog(true);
                                                                                    }}
                                                                                    className="text-primary font-medium"
                                                                                >
                                                                                    <PlusCircle className="mr-2 h-4 w-4" />
                                                                                    + Add New Work Type
                                                                                </CommandItem>
                                                                            </CommandGroup>
                                                                            <CommandSeparator />
                                                                            {departments
                                                                                .filter(d => !d.isDeleted && d.status !== 'INACTIVE')
                                                                                .map(dept => {
                                                                                    const deptWTs = flatWorkTypes.filter(w => w.departmentId === dept.id);
                                                                                    if (deptWTs.length === 0) return null;
                                                                                    return (
                                                                                        <CommandGroup key={dept.id} heading={dept.name}>
                                                                                            {deptWTs.map(wt => (
                                                                                                <CommandItem
                                                                                                    key={wt.workTypeId + (wt.configIndex !== undefined ? '-' + wt.configIndex : '')}
                                                                                                    value={`${wt.workTypeName} ${wt.configName || ''} ${wt.categoryName} ${wt.departmentName} ${wt.description || ''}`}
                                                                                                    onSelect={() => {
                                                                                                        handleWorkTypeSelect(wt);
                                                                                                        setWorkTypePopoverOpen(false);
                                                                                                    }}
                                                                                                    className="flex flex-col items-start py-3 px-4 cursor-pointer hover:bg-slate-50 border-b last:border-0"
                                                                                                >
                                                                                                    <div className="flex w-full justify-between items-start gap-2">
                                                                                                        <div className="flex flex-col">
                                                                                                            <span className="font-bold text-slate-900 leading-tight">{wt.workTypeName}</span>
                                                                                                            {wt.configName && (
                                                                                                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter mt-0.5 bg-blue-50 px-1 rounded w-fit border border-blue-100">
                                                                                                                    {wt.configName}
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        {normalWorkList.some(w => w.workTypeId === wt.workTypeId && w.configIndex === wt.configIndex) && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                                                                                                    </div>
                                                                                                    <div className="flex flex-wrap gap-2 text-[10px] items-center mt-1.5 font-semibold text-muted-foreground uppercase tracking-tight">
                                                                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">DEPT: {wt.departmentName}</span>
                                                                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-primary/70">CAT: {wt.categoryName}</span>
                                                                                                        {wt.workTypeStatus === 'PENDING' && (
                                                                                                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">PENDING</span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </CommandItem>
                                                                                            ))}
                                                                                        </CommandGroup>
                                                                                    );
                                                                                })}
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>

                                                        {/* ── Multi-Work List for Normal Flow ── */}
                                                        {!isEditMode && normalWorkList.length > 0 && (
                                                            <div className="space-y-4 pt-2">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                                                    <ClipboardList className="h-3.5 w-3.5 text-primary" /> Selected Works ({normalWorkList.length})
                                                                </p>
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    {normalWorkList.map((pw, idx) => (
                                                                        <div key={pw.id} className="group relative p-4 rounded-2xl border bg-white shadow-sm border-slate-100 hover:border-indigo-200 transition-all animate-in slide-in-from-bottom-2">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="absolute top-2 right-2 h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                                                                onClick={() => removeNormalWork(pw.id)}
                                                                            >
                                                                                <X className="h-3.5 w-3.5" />
                                                                            </Button>

                                                                            <div className="flex items-center gap-3">
                                                                                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-inner">
                                                                                    {idx + 1}
                                                                                </div>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="font-bold text-sm text-slate-900 truncate">{pw.workTypeName}</p>
                                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter px-1.5 h-4 border-slate-200 text-slate-400">{pw.departmentName}</Badge>
                                                                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter px-1.5 h-4 border-indigo-100 text-indigo-400 bg-indigo-50/30">{pw.categoryName}</Badge>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 px-4 border-l border-slate-50">
                                                                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Auto-Load</p>
                                                                                    <div className="flex gap-1.5">
                                                                                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] h-3.5 font-bold px-1 uppercase">Ready</Badge>
                                                                                        <Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[8px] h-3.5 font-bold px-1 uppercase">{pw.occurrence}</Badge>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── STEP 1: Frequency & Period ── */}
                                {currentStep === 1 && (
                                    <div className="space-y-5 animate-in fade-in-50 slide-in-from-right-4 duration-300">
                                        <SectionHeader
                                            icon={CalendarDays}
                                            title="Occurrence & Details"
                                            subtitle={(form.proposalId || normalWorkList.length > 0) ? "Batch configure occurrence, period, and deadline targets." : "Set the recurrence, financial period, and deadline targets."}
                                        />

                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between mb-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Global Work Start Date</Label>
                                                <p className="text-[10px] text-slate-400 font-medium tracking-tight">Affects Finish By calculations for all items.</p>
                                            </div>
                                            <DateInput
                                                value={form.entryDate || format(new Date(), 'yyyy-MM-dd')}
                                                onChange={val => {
                                                    update('entryDate', val);
                                                }}
                                                className="h-10 w-40 text-xs font-bold border-slate-200 bg-white rounded-xl"
                                            />
                                        </div>

                                        {(form.proposalId || normalWorkList.length > 0) && !isEditMode ? (
                                            <div className="space-y-6">
                                                {(form.proposalId ? proposalWorkList : normalWorkList).filter(pw => pw.selected).map((pw, idx) => (
                                                    <Card key={pw.id} className="border-none shadow-sm bg-slate-50/50 border-2 border-slate-100 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 50}ms` }}>
                                                        <div className="bg-white px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-6 w-6 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                                                                    {idx + 1}
                                                                </div>
                                                                <span className="font-bold text-slate-800 text-sm tracking-tight">{pw.workTypeName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5", PRIORITY_CONFIG[pw.priority].bg, PRIORITY_CONFIG[pw.priority].color, PRIORITY_CONFIG[pw.priority].border)}>
                                                                    {pw.priority}
                                                                </Badge>
                                                                {(() => {
                                                                    const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(pw.workTypeId));
                                                                    const configs = wt ? getConfigsForWorkType(wt) : [];
                                                                    if (configs.length > 1) {
                                                                        return (
                                                                            <Select 
                                                                                value={pw.timeLimitConfigId || 'default'}
                                                                                onValueChange={(val) => applyConfigToWorkItem(pw.id, val)}
                                                                            >
                                                                                <SelectTrigger className="h-7 min-w-[120px] px-2 text-[10px] font-bold border-indigo-100 bg-indigo-50/30 text-indigo-700 rounded-lg">
                                                                                    <SelectValue placeholder="Config" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {configs.map((c: any) => (
                                                                                        <SelectItem key={c.id} value={c.id} className="text-[10px] font-bold">{c.name}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        );
                                                                    }
                                                                    return <Badge variant="outline" className="bg-indigo-50/50 text-indigo-600 border-indigo-100 font-black text-[9px] uppercase tracking-widest px-2 py-0.5">Cycle Config</Badge>;
                                                                })()}
                                                            </div>
                                                        </div>
                                                        <CardContent className="p-5 space-y-6">
                                                            {/* Frequency Row */}
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Frequency</Label>
                                                                    <Select
                                                                        disabled={pw.allowOccurrenceOverride === false}
                                                                        value={pw.occurrence}
                                                                        onValueChange={(val: OccurrenceType) => {
                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                            const newList = [...list];
                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                            newList[targetIdx].occurrence = val;
                                                                            newList[targetIdx].period = PERIOD_OPTIONS[val][0];
                                                                            setList(newList);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-11 text-xs font-bold border-gray-200 bg-white hover:border-indigo-300 transition-all rounded-xl">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl shadow-xl border-indigo-100">
                                                                            {OCCURRENCES.map(o => <SelectItem key={o} value={o} className="font-medium text-xs">{o}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Financial Year</Label>
                                                                    <Select
                                                                        disabled={pw.allowOccurrenceOverride === false}
                                                                        value={pw.financialYear}
                                                                        onValueChange={(val) => {
                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                            const newList = [...list];
                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                            newList[targetIdx].financialYear = val;
                                                                            setList(newList);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-11 text-xs font-bold border-gray-200 bg-white hover:border-indigo-300 transition-all rounded-xl">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl shadow-xl border-indigo-100">
                                                                            {FINANCIAL_YEARS.map(fy => <SelectItem key={fy} value={fy} className="font-medium text-xs">{fy}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Period</Label>
                                                                    <Select
                                                                        disabled={pw.allowOccurrenceOverride === false}
                                                                        value={pw.period || ''}
                                                                        onValueChange={(val) => {
                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                            const newList = [...list];
                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                            newList[targetIdx].period = val;
                                                                            setList(newList);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-11 text-xs font-bold border-gray-200 bg-white hover:border-indigo-300 transition-all rounded-xl">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl shadow-xl border-indigo-100">
                                                                            {PERIOD_OPTIONS[pw.occurrence]?.map(p => <SelectItem key={p} value={p} className="font-medium text-xs">{p}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            {/* Priority & Dates Row */}
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Priority</Label>
                                                                    <Select
                                                                        value={pw.priority}
                                                                        onValueChange={(val: PriorityType) => {
                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                            const newList = [...list];
                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                            newList[targetIdx].priority = val;
                                                                            setList(newList);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-11 text-xs font-bold border-gray-200 bg-white hover:border-indigo-300 transition-all rounded-xl">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl shadow-xl border-indigo-100">
                                                                            {PRIORITIES.map(p => <SelectItem key={p} value={p} className="font-medium text-xs">{p}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                 <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Work Start Date</Label>
                                                                    <DateInput
                                                                        value={pw.entryDate || form.entryDate}
                                                                        onChange={(val) => {
                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                            const newList = [...list];
                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                            newList[targetIdx].entryDate = val;
                                                                            setList(newList);
                                                                        }}
                                                                        className="h-11 text-xs font-bold border-gray-200 bg-white rounded-xl"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Target Due Date</Label>
                                                                    <DateInput
                                                                        value={pw.dueDate}
                                                                        disabled={pw.allowDueDateOverride === false}
                                                                        onChange={(val) => {
                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                            const newList = [...list];
                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                            newList[targetIdx].dueDate = val;
                                                                            setList(newList);
                                                                        }}
                                                                        className="h-11 text-xs font-bold border-gray-200 bg-white rounded-xl"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Finish By Goal</Label>
                                                                    <DateInput
                                                                        value={pw.finishByDate}
                                                                        disabled={pw.allowFinishByOverride === false}
                                                                        onChange={(val) => {
                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                            const newList = [...list];
                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                            newList[targetIdx].finishByDate = val;
                                                                            setList(newList);
                                                                        }}
                                                                        className="h-11 text-xs font-bold border-gray-200 bg-white rounded-xl"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Initial Action Row */}
                                                            {(() => {
                                                                const selectedWorks = (form.proposalId ? proposalWorkList : normalWorkList).filter(pw => pw.selected);
                                                                if (selectedWorks.length <= 1) return null;

                                                                return (
                                                                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-200/50">
                                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Initial Action</Label>
                                                                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 h-[60px]">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className={cn(
                                                                                    "h-full flex-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                                                                                    pw.doNow ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600" : "text-slate-500 hover:bg-slate-200"
                                                                                )}
                                                                                onClick={() => {
                                                                                    const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                                    const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                                    const newList = [...list];
                                                                                    const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                                    newList[targetIdx].doNow = true;
                                                                                    newList[targetIdx].pendingOrder = undefined;
                                                                                    setList(newList);
                                                                                }}
                                                                            >
                                                                                DO NOW
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className={cn(
                                                                                    "h-full flex-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                                                                                    !pw.doNow ? "bg-amber-500 text-white shadow-sm hover:bg-amber-600" : "text-slate-500 hover:bg-slate-200"
                                                                                )}
                                                                                onClick={() => {
                                                                                    const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                                    const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                                    const newList = [...list];
                                                                                    const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                                    newList[targetIdx].doNow = false;
                                                                                    setList(newList);
                                                                                }}
                                                                            >
                                                                                PENDING
                                                                            </Button>
                                                                        </div>
                                                                        {!pw.doNow && selectedWorks.filter(item => !item.doNow).length > 1 && (
                                                                            <div className="pt-1 animate-in fade-in slide-in-from-top-2">
                                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-indigo-600 ml-1">Pending Order</Label>
                                                                                <div className="relative mt-1">
                                                                                    <Input
                                                                                        type="text"
                                                                                        inputMode="numeric"
                                                                                        pattern="[0-9]*"
                                                                                        value={pw.pendingOrder || ''}
                                                                                        onKeyDown={blockInvalidNumberKeys}
                                                                                        onPaste={handleNumericPaste}
                                                                                        onChange={(e) => {
                                                                                            const val = sanitizeNonNegativeNumber(e.target.value);
                                                                                            const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                                            const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                                            const newList = [...list];
                                                                                            const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                                            newList[targetIdx].pendingOrder = val || undefined;
                                                                                            setList(newList);
                                                                                        }}
                                                                                        placeholder="1"
                                                                                        className="h-10 text-xs font-black border-indigo-100 bg-white pr-12 rounded-xl"
                                                                                    />
                                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-indigo-300 uppercase tracking-tighter">Pos</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div className="space-y-2 pt-4 border-t border-slate-200/50">
                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Remarks (Optional)</Label>
                                                                <Input
                                                                    placeholder="Add any specific instructions for this work item..."
                                                                    value={pw.remarks}
                                                                    onChange={(e) => {
                                                                        const list = form.proposalId ? proposalWorkList : normalWorkList;
                                                                        const setList = form.proposalId ? setProposalWorkList : setNormalWorkList;
                                                                        const newList = [...list];
                                                                        const targetIdx = newList.findIndex(item => item.id === pw.id);
                                                                        newList[targetIdx].remarks = e.target.value;
                                                                        setList(newList);
                                                                    }}
                                                                    className="h-11 text-xs font-bold border-gray-200 bg-white rounded-xl"
                                                                />
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* Single Mode Config Selector */}
                                                {(() => {
                                                    const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(form.workTypeId));
                                                    const configs = wt ? getConfigsForWorkType(wt) : [];
                                                    if (configs.length <= 1) return null;
                                                    
                                                    return (
                                                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Rule Configuration</Label>
                                                                <p className="text-[10px] text-indigo-400 font-medium">This work has multiple setups. Choose one.</p>
                                                            </div>
                                                            <Select 
                                                                value={form.timeLimitConfigId || 'default'} 
                                                                onValueChange={(val) => {
                                                                    const selectedConfig = configs.find((c: any) => c.id === val) || configs[0];
                                                                    const newDefaults = getWorkTypeDefaults(wt!, selectedConfig);
                                                                    setForm(prev => ({
                                                                        ...prev,
                                                                        ...newDefaults
                                                                    }));
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-10 w-48 text-xs font-bold border-indigo-200 bg-white rounded-xl">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {configs.map((c: any) => (
                                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6">
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Work Start Date</Label>
                                                            <p className="text-[10px] text-slate-400 font-medium tracking-tight">Recalculates Finish By Date based on rules.</p>
                                                        </div>
                                                        <DateInput
                                                            value={form.entryDate}
                                                            onChange={val => updateWithWarning('entryDate', val)}
                                                            className="h-11 w-44 text-xs font-bold border-slate-200 bg-white rounded-xl"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="font-semibold">Occurrence <span className="text-red-500">*</span></Label>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                                        {(['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Often'] as OccurrenceType[]).map(occ => (
                                                            <button
                                                                key={occ}
                                                                disabled={form.allowOccurrenceOverride === false}
                                                                onClick={() => {
                                                                    update('occurrence', occ);
                                                                    update('period', PERIOD_OPTIONS[occ][0]);
                                                                }}
                                                                className={cn(
                                                                    "h-12 px-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all",
                                                                    form.occurrence === occ 
                                                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-105" 
                                                                        : "bg-white border-slate-100 text-slate-400 hover:border-indigo-200"
                                                                )}
                                                            >
                                                                {occ}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="font-semibold">Financial Year <span className="text-red-500">*</span></Label>
                                                        <Select 
                                                            disabled={form.allowOccurrenceOverride === false}
                                                            value={form.financialYear} 
                                                            onValueChange={v => update('financialYear', v)}
                                                        >
                                                            <SelectTrigger className="bg-background">
                                                                <SelectValue placeholder="Select FY" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {FINANCIAL_YEARS.map(fy => (
                                                                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {form.occurrence === 'Monthly' && (
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold">Month <span className="text-red-500">*</span></Label>
                                                            <Select 
                                                                disabled={form.allowOccurrenceOverride === false}
                                                                value={form.period || ''} 
                                                                onValueChange={v => {
                                                                    update('period', v);
                                                                    const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(form.workTypeId));
                                                                    const configs = wt ? getConfigsForWorkType(wt) : [];
                                                                    const selectedConfig = configs.find((c: any) => c.id === form.timeLimitConfigId) || configs[0];
                                                                    
                                                                }}>
                                                                <SelectTrigger className="bg-background">
                                                                    <SelectValue placeholder="Select Month" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {MONTHS.map(m => (
                                                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {form.occurrence === 'Quarterly' && (
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold">Quarter <span className="text-red-500">*</span></Label>
                                                            <Select 
                                                                disabled={form.allowOccurrenceOverride === false}
                                                                value={form.period || ''} 
                                                                onValueChange={v => {
                                                                    update('period', v);
                                                                    const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(form.workTypeId));
                                                                    const configs = wt ? getConfigsForWorkType(wt) : [];
                                                                    const selectedConfig = configs.find((c: any) => c.id === form.timeLimitConfigId) || configs[0];
                                                                    
                                                                }}>
                                                                <SelectTrigger className="bg-background">
                                                                    <SelectValue placeholder="Select Quarter" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {QUARTERS.map(q => (
                                                                        <SelectItem key={q} value={q}>{q}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {form.occurrence === 'Half-yearly' && (
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold">Half <span className="text-red-500">*</span></Label>
                                                            <Select 
                                                                disabled={form.allowOccurrenceOverride === false}
                                                                value={form.period || ''} 
                                                                onValueChange={v => {
                                                                    update('period', v);
                                                                    const wt = flatWorkTypes.find(w => String(w.workTypeId) === String(form.workTypeId));
                                                                    const configs = wt ? getConfigsForWorkType(wt) : [];
                                                                    const selectedConfig = configs.find((c: any) => c.id === form.timeLimitConfigId) || configs[0];
                                                                    
                                                                }}>
                                                                <SelectTrigger className="bg-background">
                                                                    <SelectValue placeholder="Select Half" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {HALVES.map(h => (
                                                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                </div>

                                                <Separator />

                                                {/* Details Section for Single Mode */}
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold">Priority <span className="text-red-500">*</span></Label>
                                                            <Select value={form.priority} onValueChange={v => updateWithWarning('priority', v as PriorityType)}>
                                                                <SelectTrigger className="bg-background">
                                                                    <SelectValue placeholder="Select Priority" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold">Reference Type <span className="text-red-500">*</span></Label>
                                                            <Select value={form.referenceType} onValueChange={v => update('referenceType', v as ReferenceType)}>
                                                                <SelectTrigger className="bg-background">
                                                                    <SelectValue placeholder="Select Reference" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Direct">Direct</SelectItem>
                                                                    <SelectItem value="Associate">Associate</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    {form.referenceType === 'Associate' && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                            <div className="space-y-2">
                                                                <Label>Associate Reference <span className="text-red-500">*</span></Label>
                                                                <Select
                                                                    value={form.associateId || ''}
                                                                    onValueChange={v => {
                                                                        const a = associates.find(a => a.id === v);
                                                                        update('associateId', v);
                                                                        update('associateName', a?.name || '');
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="bg-background">
                                                                        <SelectValue placeholder="Select Associate" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {associates.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Effective Date</Label>
                                                                <DateInput
                                                                    value={form.associateEffectiveDate || ''}
                                                                    onChange={val => update('associateEffectiveDate', val)}
                                                                    className="bg-background"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold">Due Date <span className="text-red-500">*</span></Label>
                                                            <DateInput
                                                                value={form.dueDate || ''}
                                                                disabled={form.allowDueDateOverride === false}
                                                                onChange={val => updateWithWarning('dueDate', val)}
                                                                min={form.entryDate || ''}
                                                                className="bg-background"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold">Finish By Goal</Label>
                                                            <DateInput
                                                                value={form.finishByDate || ''}
                                                                disabled={form.allowFinishByOverride === false}
                                                                onChange={val => updateWithWarning('finishByDate', val)}
                                                                min={form.entryDate || ''}
                                                                className="bg-background"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="font-semibold text-muted-foreground">Finish By Time</Label>
                                                            <Input
                                                                type="time"
                                                                value={form.finishByTime || '18:00'}
                                                                disabled={form.allowFinishByOverride === false}
                                                                onChange={e => update('finishByTime', e.target.value)}
                                                                className="bg-background h-11"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="font-semibold text-muted-foreground">Remarks (Optional)</Label>
                                                        <Input
                                                            placeholder="Any internal notes or special instructions..."
                                                            value={form.remarks || ''}
                                                            onChange={e => update('remarks', e.target.value)}
                                                            className="bg-background h-11"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {currentStep === 2 && (
                                    <div className="space-y-6 animate-in fade-in-50 slide-in-from-right-4 duration-300">
                                        <SectionHeader 
                                            icon={CheckCircle2} 
                                            title="Review & Confirm" 
                                            subtitle="Final verification of all work items in this batch." 
                                        />

                                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            {(isEditMode 
                                                ? [{ 
                                                    ...form, 
                                                    id: 'edit-mode-item', 
                                                    workTypeName: form.workTypeName || '',
                                                    priority: form.priority || 'Medium',
                                                    occurrence: form.occurrence || 'Monthly',
                                                    financialYear: form.financialYear || '',
                                                    dueDate: form.dueDate || '',
                                                    professionalFee: form.professionalFee || 0,
                                                    governmentFee: form.governmentFee || 0,
                                                    gstAmount: form.gstAmount || 0,
                                                    totalAmount: form.totalAmount || 0,
                                                    doNow: form.status !== 'Pending' 
                                                  } as ProposalWorkItem] 
                                                : (form.proposalId ? proposalWorkList.filter(pw => pw.selected) : normalWorkList)
                                            ).map((pw, idx) => (
                                                <div key={pw.id} className="group relative p-5 rounded-3xl border-2 bg-white shadow-sm border-slate-100 hover:border-indigo-100 transition-all">
                                                    {!isEditMode && !isViewMode && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute top-3 right-3 h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                                            onClick={() => form.proposalId ? toggleProposalWork(pw.id) : removeNormalWork(pw.id)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-inner">
                                                                 {idx + 1}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-base text-slate-900 leading-tight">{pw.workTypeName}</p>
                                                                <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tight opacity-70">
                                                                    {pw.departmentName} <span className="mx-1 opacity-30">|</span> {pw.categoryName}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5", PRIORITY_CONFIG[pw.priority].bg, PRIORITY_CONFIG[pw.priority].color, PRIORITY_CONFIG[pw.priority].border)}>
                                                            {pw.priority}
                                                        </Badge>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-50">
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Cycle</p>
                                                            <p className="text-xs font-bold text-slate-700">{pw.occurrence} {pw.period ? `(${pw.period})` : ''}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Financial Year</p>
                                                            <p className="text-xs font-bold text-slate-700">{pw.financialYear}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Target Due</p>
                                                            <p className="text-xs font-black text-indigo-600">{pw.dueDate ? format(new Date(pw.dueDate), 'dd MMM yyyy') : 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Action</p>
                                                            <Badge className={cn("text-[8px] font-black px-1.5 h-4 uppercase", pw.doNow ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                                                                {pw.doNow ? 'DO NOW' : 'PENDING'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    
                                                    {pw.remarks && (
                                                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Remarks</p>
                                                            <p className="text-xs text-slate-600 leading-relaxed italic">"{pw.remarks}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className={cn(
                                            "p-5 rounded-3xl text-white shadow-xl flex items-center justify-between animate-in zoom-in-95",
                                            isEditMode ? "bg-emerald-600 shadow-emerald-200" : "bg-indigo-600 shadow-indigo-200"
                                        )}>
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                    <Briefcase className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                                                        {isEditMode ? 'Update Summary' : 'Total Batch Size'}
                                                    </p>
                                                    <p className="text-2xl font-black">
                                                        {isEditMode ? '1 Work Item' : `${form.proposalId ? proposalWorkList.filter(pw => pw.selected).length : normalWorkList.length} Work Items`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Filing Mode</p>
                                                <p className="text-sm font-bold">{isEditMode ? 'Direct Edit' : `${form.referenceType} Entry`}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                      </fieldset>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-muted/10 flex items-center justify-between gap-3 shrink-0">
                        <Button
                            variant="outline"
                            onClick={currentStep === 0 ? handleClose : prevStep}
                            className="flex items-center gap-2 h-11 px-6 rounded-xl border-2 hover:bg-slate-50 transition-all font-bold"
                        >
                            {currentStep === 0 ? (
                                <><X className="h-4 w-4" /> {isViewMode ? 'Close' : 'Cancel'}</>
                            ) : (
                                <><ArrowLeft className="h-4 w-4" /> Back</>
                            )}
                        </Button>

                        {currentStep < 2 ? (
                            <Button
                                onClick={nextStep}
                                disabled={loadingData}
                                className="flex items-center gap-2 h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                            >
                                Next <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            !isViewMode && (
                                <div className="flex gap-2">
                                    {form.workTypeId && !isEditMode && (
                                        <Button
                                            variant="outline"
                                            onClick={addNormalWork}
                                            className="flex items-center gap-2 h-11 px-6 rounded-xl border-2 border-primary/20 text-primary font-bold hover:bg-primary/5 transition-all"
                                        >
                                            <PlusCircle className="h-4 w-4" /> Add More
                                        </Button>
                                    )}
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving || (normalWorkList.length === 0 && !form.workTypeId && (!form.proposalId || proposalWorkList.filter(pw => pw.selected).length === 0))}
                                        className="flex items-center gap-2 h-11 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95"
                                    >
                                        {saving ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> {isEditMode ? 'Updating...' : 'Saving...'}</>
                                        ) : (
                                            <><CheckCircle2 className="h-4 w-4" /> {isEditMode ? 'Update Work' : (normalWorkList.length > 0 ? `Create ${normalWorkList.length + (form.workTypeId ? 1 : 0)} Works` : 'Save Work')}</>
                                        )}
                                    </Button>
                                </div>
                            )
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* New Work Type Dialog */}
            {user && (
                <NewWorkTypeDialog
                    open={showNewWorkTypeDialog}
                    onClose={() => setShowNewWorkTypeDialog(false)}
                    departments={departments}
                    userId={user.uid}
                    userName={users.find((u: any) => u.uid === user.uid)?.displayName || user.email || 'Unknown'}
                    onCreated={handleWorkTypeCreated}
                />
            )}

            {/* Client Dialog */}
            {showNewClientDialog && (
                <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
                    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
                        <DialogHeader className="px-6 py-4 border-b">
                            <DialogTitle>Add New Client</DialogTitle>
                            <DialogDescription>
                                Fill in the details to create a new client. This will auto-select them once saved.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="p-4">
                            <ClientForm
                                constitutions={constitutions}
                                associates={associates}
                                initialData={clientFormInitialData as any}
                                onSave={handleClientSave}
                                onCancel={() => {
                                    setShowNewClientDialog(false);
                                    setClientFormInitialData(null);
                                }}
                                isSubmitting={clientSubmitting}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Warning Dialog (Requirement 5) */}
            {warning && (
                <AlertDialog open={warning.open} onOpenChange={(o: boolean) => !o && setWarning(null)}>
                    <AlertDialogContent className="max-w-md">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                                <AlertTriangle className="h-5 w-5" />
                                Confirm Manual Edit
                            </AlertDialogTitle>
                            <div className="space-y-3 pt-2">
                                <p className="text-sm text-muted-foreground">You are manually changing an <strong>automated field</strong> ({warning.field}).</p>
                                <div className="p-3 bg-slate-50 rounded-lg border text-xs divide-y">
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Original (Auto):</span>
                                        <span className="font-semibold">{String(warning.oldValue || 'None')}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">New (Manual):</span>
                                        <span className="font-bold text-amber-700">{String(warning.newValue)}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground italic">Are you sure you want to proceed with this manual override?</p>
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setWarning(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={warning.onConfirm} className="bg-amber-600 hover:bg-amber-700">Confirm Override</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </>
    );
}

// ─── Small Helpers ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
    return (
        <div className="flex items-start gap-3 pb-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
                <h3 className="font-bold text-base">{title}</h3>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
        </div>
    );
}

function ReviewRow({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground font-medium w-32 shrink-0">{label}</span>
            <div className="flex items-center gap-2 text-right flex-1 justify-end">
                <span className="font-semibold">{value}</span>
                {badge}
            </div>
        </div>
    );
}











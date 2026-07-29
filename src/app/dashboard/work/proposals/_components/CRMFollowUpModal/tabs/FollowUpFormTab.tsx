'use client';

import React, { useEffect } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StageFields } from '../components/StageFields';
import { CalendarDays, User, MessageSquare, Briefcase, CheckCircle2, ChevronRight, PlusCircle } from 'lucide-react';
import {
    NEXT_ACTIONS, getLocalYYYYMMDD, getTomorrowYYYYMMDD,
} from '../hooks/useFollowUpForm';
import { type ProposalStage, suggestNextAction, normalizeStage, STAGE_LABELS } from '../lib/workflowEngine';
import { MasterValueDialog } from '@/components/dashboard/master-data/MasterValueDialog';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatLabel = (str: string) => {
    if (!str) return '';
    return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const FollowUpFormTab = ({ 
    proposal, 
    form, 
    masterOptions,
    masterCategories,
    onRefreshMasters
}: { 
    proposal: any; 
    form: any; 
    masterOptions: { 
        methods: string[]; 
        outcomes: string[]; 
        contactRoles: string[]; 
        clientRoles: string[];
        purposes: string[];
        sentiments: string[];
    };
    masterCategories: any[];
    onRefreshMasters?: () => void;
}) => {
    const { watch, setValue } = form;
    const [addingCategory, setAddingCategory] = React.useState<string | null>(null);
    const [targetFieldName, setTargetFieldName] = React.useState<string | null>(null);

    const currentStage = normalizeStage(watch('currentStage')) as ProposalStage;
    const outcome = watch('followUpOutcome') as string;

    // ── Smart Defaults: suggest next action based on current stage ───────────
    useEffect(() => {
        const isPristine = form.formState.dirtyFields.nextAction === undefined;
        if (!isPristine) return;

        const suggested = suggestNextAction(currentStage);
        if (suggested) {
            setValue('nextAction', suggested);
        }
    }, [currentStage, setValue, form.formState.dirtyFields.nextAction]);

    const handleAddNewSuccess = (newValue?: string) => {
        if (onRefreshMasters) onRefreshMasters();
        if (targetFieldName && newValue) {
            setValue(targetFieldName, newValue);
        }
        setAddingCategory(null);
        setTargetFieldName(null);
    };

    const isTerminal = currentStage === 'closed';

    const activeCategory = masterCategories.find(c => c.name === addingCategory);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-500 pb-16">
            <MasterValueDialog 
                open={!!addingCategory} 
                categoryId={activeCategory?.id || null} 
                categoryName={activeCategory?.name || null} 
                onOpenChange={(open) => !open && setAddingCategory(null)} 
                onSuccess={handleAddNewSuccess}
            />

            {/* ── SECTION 1: Log This Interaction ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="bg-white border-b border-slate-100 px-6 py-4 rounded-t-xl">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-500" /> Log This Interaction
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">Capture the details and immediate outcome of the touchpoint.</p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Interaction Type (Method) */}
                        <FormField control={form.control} name="interactionType" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Method <span className="text-red-500">*</span></FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        if (val === '__ADD_NEW__') {
                                            setAddingCategory('Proposal / Method');
                                            setTargetFieldName('interactionType');
                                        } else {
                                            field.onChange(val);
                                        }
                                    }} 
                                    value={field.value ?? ''}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-10 bg-slate-50/50">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="z-[110] border border-slate-200 shadow-2xl rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                        <SelectItem value="__ADD_NEW__" className="font-bold text-blue-600 border-b border-slate-100 rounded-none mb-1">
                                            <span className="flex items-center gap-2">
                                                <PlusCircle className="h-3 w-3" /> Add New Method
                                            </span>
                                        </SelectItem>
                                        {masterOptions.methods.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        {masterOptions.methods.length === 0 && <SelectItem value="loading" disabled>Loading methods...</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Interaction Date */}
                        <FormField control={form.control} name="interactionDate" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Date <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input 
                                            type="date" 
                                            max={getLocalYYYYMMDD()}
                                            {...field} 
                                            value={field.value ?? ''} 
                                            className="pl-10 h-10 bg-slate-50/50" 
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Contact Person */}
                        <FormField control={form.control} name="contactPerson" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Contact Person <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input {...field} value={field.value ?? ''} className="pl-10 h-10 bg-slate-50/50" placeholder="Name" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Client Role */}
                        <FormField control={form.control} name="clientRole" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Client Role</FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        if (val === '__ADD_NEW__') {
                                            setAddingCategory('Proposal / Client Role');
                                            setTargetFieldName('clientRole');
                                        } else {
                                            field.onChange(val);
                                        }
                                    }} 
                                    value={field.value ?? ''}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-10 bg-slate-50/50">
                                            <SelectValue placeholder="Select client role" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="z-[110] border border-slate-200 shadow-2xl rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                        <SelectItem value="__ADD_NEW__" className="font-bold text-blue-600 border-b border-slate-100 rounded-none mb-1">
                                            <span className="flex items-center gap-2">
                                                <PlusCircle className="h-3 w-3" /> Add New Role
                                            </span>
                                        </SelectItem>
                                        {masterOptions.clientRoles.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        {masterOptions.clientRoles.length === 0 && <SelectItem value="loading" disabled>Loading roles...</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Contact Role */}
                        <FormField control={form.control} name="contactRole" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Contact Role</FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        if (val === '__ADD_NEW__') {
                                            setAddingCategory('Proposal / Contact Role');
                                            setTargetFieldName('contactRole');
                                        } else {
                                            field.onChange(val);
                                        }
                                    }} 
                                    value={field.value ?? ''}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-10 bg-slate-50/50">
                                            <SelectValue placeholder="Select contact role" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="z-[110] border border-slate-200 shadow-2xl rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                        <SelectItem value="__ADD_NEW__" className="font-bold text-blue-600 border-b border-slate-100 rounded-none mb-1">
                                            <span className="flex items-center gap-2">
                                                <PlusCircle className="h-3 w-3" /> Add New Role
                                            </span>
                                        </SelectItem>
                                        {masterOptions.contactRoles.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        {masterOptions.contactRoles.length === 0 && <SelectItem value="loading" disabled>Loading roles...</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Follow-up Purpose */}
                        <FormField control={form.control} name="followUpPurpose" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Purpose</FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        if (val === '__ADD_NEW__') {
                                            setAddingCategory('Proposal / Purpose');
                                            setTargetFieldName('followUpPurpose');
                                        } else {
                                            field.onChange(val);
                                        }
                                    }} 
                                    value={field.value ?? ''}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-10 bg-slate-50/50">
                                            <SelectValue placeholder="Select purpose" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="z-[110] border border-slate-200 shadow-2xl rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                        <SelectItem value="__ADD_NEW__" className="font-bold text-blue-600 border-b border-slate-100 rounded-none mb-1">
                                            <span className="flex items-center gap-2">
                                                <PlusCircle className="h-3 w-3" /> Add New Purpose
                                            </span>
                                        </SelectItem>
                                        {masterOptions.purposes.map(t => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}
                                        {masterOptions.purposes.length === 0 && <SelectItem value="loading" disabled>Loading purposes...</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Follow-up Outcome — interaction result only, NOT lifecycle state */}
                        <FormField control={form.control} name="followUpOutcome" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Interaction Outcome <span className="text-red-500">*</span></FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        if (val === '__ADD_NEW__') {
                                            setAddingCategory('Proposal / Interaction Outcome');
                                            setTargetFieldName('followUpOutcome');
                                        } else {
                                            field.onChange(val);
                                        }
                                    }} 
                                    value={field.value ?? ''}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-10 bg-blue-50 border-blue-200 text-blue-900 font-semibold">
                                            <SelectValue placeholder="Select outcome" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="z-[110] border border-slate-200 shadow-2xl rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                        <SelectItem value="__ADD_NEW__" className="font-bold text-blue-600 border-b border-slate-100 rounded-none mb-1">
                                            <span className="flex items-center gap-2">
                                                <PlusCircle className="h-3 w-3" /> Add New Outcome
                                            </span>
                                        </SelectItem>
                                        {masterOptions.outcomes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        {masterOptions.outcomes.length === 0 && <SelectItem value="loading" disabled>Loading outcomes...</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    {/* Client Sentiment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <FormField control={form.control} name="clientSentiment" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-700">Client Sentiment</FormLabel>
                                 <Select 
                                    onValueChange={(val) => {
                                        if (val === '__ADD_NEW__') {
                                            setAddingCategory('Proposal / Client Sentiment');
                                            setTargetFieldName('clientSentiment');
                                        } else {
                                            field.onChange(val);
                                        }
                                    }} 
                                    value={field.value ?? ''}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-10 bg-slate-50/50">
                                            <SelectValue placeholder="Select sentiment" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="z-[110] border border-slate-200 shadow-2xl rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                        <SelectItem value="__ADD_NEW__" className="font-bold text-blue-600 border-b border-slate-100 rounded-none mb-1">
                                            <span className="flex items-center gap-2">
                                                <PlusCircle className="h-3 w-3" /> Add New Sentiment
                                            </span>
                                        </SelectItem>
                                        {masterOptions.sentiments.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        {masterOptions.sentiments.length === 0 && <SelectItem value="loading" disabled>Loading sentiments...</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </div>
            </div>

            {/* ── SECTION 2: Workflow / Stage Details (Dynamic) ────────────── */}
            <div className="bg-blue-50/30 rounded-xl border border-blue-100 shadow-sm p-6 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">Workflow Details</h4>
                    <Badge variant="outline" className="ml-2 text-[9px] bg-white border-blue-200 text-blue-600">
                        {STAGE_LABELS[currentStage] ?? currentStage}
                    </Badge>
                </div>
                <StageFields form={form} stage={currentStage} outcome={outcome} />
            </div>

            {/* ── SECTION 3: Notes ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="mb-4">
                    <h4 className="text-sm font-bold text-slate-900">Interaction Notes <span className="text-red-500">*</span></h4>
                    <p className="text-xs text-slate-500">Summarize what the client/approver said, blockers, and what happens next.</p>
                </div>
                <FormField control={form.control} name="notesSummary" render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Textarea
                                {...field}
                                value={field.value ?? ''}
                                className="min-h-[140px] rounded-lg border-slate-200 bg-slate-50/50 text-sm leading-relaxed p-4"
                                placeholder="Summary..."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            {/* ── SECTION 4: Next Action Plan ──────────────────────────────── */}
            {!isTerminal && (
                <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 text-white/5 opacity-50 transform rotate-12">
                        <ChevronRight className="w-64 h-64" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <CheckCircle2 className="h-5 w-5 text-blue-400" />
                            <div>
                                <h4 className="text-base font-bold">Next Action Plan</h4>
                                <p className="text-xs text-slate-400">Determine the immediate next step in the pipeline.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                            <FormField control={form.control} name="nextAction" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-medium text-slate-300">Target Action</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                        <FormControl>
                                            <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white focus:ring-blue-500/50">
                                                <SelectValue placeholder="Select action" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {NEXT_ACTIONS.map(t => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="nextFollowUpDate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-medium text-slate-300">Follow-up Date</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            min={getTomorrowYYYYMMDD()}
                                            {...field}
                                            value={field.value ?? ''}
                                            className="h-10 bg-slate-900 border-slate-700 text-white focus:ring-blue-500/50 [color-scheme:dark]"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

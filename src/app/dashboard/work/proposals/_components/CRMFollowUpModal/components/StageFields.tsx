'use client';

import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { type ProposalStage } from '../lib/workflowEngine';

interface StageFieldsProps {
    stage: ProposalStage | string;
    outcome: string;
    form: any;
}

export const StageFields: React.FC<StageFieldsProps> = ({ stage, outcome, form }) => {
    
    const isClientReviewStage = stage === 'client_reviewing' || outcome === 'client_received';
    const isClientRevisionStage = stage === 'revision_required_client' || outcome === 'client_revision_requested';
    const isAcceptedStage = stage === 'accepted' || outcome === 'accepted_by_client';
    const isLostStage = stage === 'lost' || outcome === 'lost';

    // ── CLIENT REVISION / RESTRUCTURING ───────────────────────────────────
    if (isClientRevisionStage) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="clientResponseStatus" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Client Status Summary</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value ?? ''} className="h-10 bg-white" placeholder="e.g. Needs pricing break-up" />
                            </FormControl>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="concernType" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Primary Hurdle</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                <FormControl>
                                    <SelectTrigger className="h-10 bg-white border-orange-200">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="pricing">Pricing</SelectItem>
                                    <SelectItem value="scope">Scope of Work</SelectItem>
                                    <SelectItem value="timeline">Timeline</SelectItem>
                                    <SelectItem value="legal">Legal / T&C</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="concernSummary" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                            Restructuring Details <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                value={field.value ?? ''}
                                className="min-h-[80px] bg-white border-orange-200"
                                placeholder="What specifically needs to be restructured?"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
        );
    }

    // ── CLIENT REVIEWING ──────────────────────────────────────────────────
    if (isClientReviewStage) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                <FormField control={form.control} name="clientResponseStatus" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">Engagement Update</FormLabel>
                        <FormControl>
                            <Input {...field} value={field.value ?? ''} className="h-10 bg-white" placeholder="e.g. Pitch deck delivered, reviewing technicals..." />
                        </FormControl>
                    </FormItem>
                )} />
            </div>
        );
    }

    // ── ACCEPTED ───────────────────────────────────────────────────────────
    if (isAcceptedStage) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="acceptedBy" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Accepted By</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value ?? ''} className="h-10 bg-green-50 border-green-200" placeholder="Name of decision maker" />
                            </FormControl>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="acceptanceDate" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Acceptance Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} value={field.value ?? ''} className="h-10 bg-green-50 border-green-200" />
                            </FormControl>
                        </FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="finalRemarks" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">Final Handover Notes</FormLabel>
                        <FormControl>
                            <Textarea {...field} value={field.value ?? ''} className="bg-green-50 border-green-200" placeholder="Any final conditions or verbal agreements..." />
                        </FormControl>
                    </FormItem>
                )} />
            </div>
        );
    }

    // ── LOST ───────────────────────────────────────────────────────────────
    if (isLostStage) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="lossReason" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">
                                Reason for Loss <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                <FormControl>
                                    <SelectTrigger className="h-10 bg-red-50 border-red-200 text-red-900">
                                        <SelectValue placeholder="Select reason" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="pricing">Pricing Too High</SelectItem>
                                    <SelectItem value="competitor">Lost to Competitor</SelectItem>
                                    <SelectItem value="timeline">Timeline / Delay</SelectItem>
                                    <SelectItem value="cancelled">Project Cancelled</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="competitorMentioned" render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md bg-white p-3 border border-slate-200 h-10 mt-6">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="text-xs font-semibold text-slate-900">Competitor Named?</FormLabel>
                            </div>
                        </FormItem>
                    )} />
                </div>

                {form.watch('competitorMentioned') && (
                    <FormField control={form.control} name="competitorName" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Competitor Name</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value ?? ''} className="h-10 bg-white" placeholder="e.g. XYZ Consultants" />
                            </FormControl>
                        </FormItem>
                    )} />
                )}
            </div>
        );
    }

    return (
        <div className="text-center p-6 bg-white/50 rounded-lg">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Stage: {stage}<br />
                No additional parameters required for this interaction.
            </p>
        </div>
    );
};

"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, FileText, Settings, Video, Mic } from 'lucide-react';
import { WorkflowTemplateData } from './CommonRulesForm';
import { WorkflowStepData } from './StepWiseRulesForm';

interface WorkflowPreviewProps {
    data: WorkflowTemplateData;
    steps: WorkflowStepData[];
    departments: { id: string; name: string }[];
}

// Helper Functions
function isEmptyValue(value: any) {
    if (value === null || value === undefined || value === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return true;
    return false;
}

function displayValue(value: any, fallback = "Not configured") {
    return isEmptyValue(value) ? fallback : String(value);
}

function displayBoolean(value: any, trueLabel = "Enabled", falseLabel = "Disabled") {
    return value ? trueLabel : falseLabel;
}

function formatDateOrDefault(value: unknown, fallback: string) {
    if (!value) return fallback;
    try {
        return new Date(value as string).toLocaleDateString();
    } catch {
        return String(value);
    }
}

function formatJsonRule(rule: any) {
    if (isEmptyValue(rule)) return "Not configured";
    if (typeof rule === "string") return rule;
    try {
        return JSON.stringify(rule, null, 2);
    } catch {
        return "Configured";
    }
}

function getFieldLabel(field: any) {
    return field?.label || field?.field_label || field?.name || "Unnamed Field";
}

function getFieldKey(field: any) {
    return field?.key || field?.field_key || "Not configured";
}

function getFieldType(field: any) {
    return field?.type || field?.field_type || "TEXT";
}

function getFieldPlaceholder(field: any) {
    return field?.placeholder || "";
}

function isFieldRequired(field: any) {
    return Boolean(field?.required || field?.is_required);
}

// Subcomponents
const RuleItem = ({ label, value }: { label: string, value: string }) => (
    <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-medium text-sm mt-0.5">{value}</span>
    </div>
);


const CommonInformationFieldsPreview = ({ fields }: { fields: any[] }) => {
    if (!fields || fields.length === 0) {
        return (
            <div>
                <h4 className="text-sm font-semibold mb-2">Common Information Fields</h4>
                <p className="text-sm text-muted-foreground">Not configured</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-sm font-semibold mb-3">Common Information Fields Configuration</h4>
                <div className="border rounded-md overflow-hidden bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 font-medium">Field Label</th>
                                <th className="px-4 py-2 font-medium">Field Key</th>
                                <th className="px-4 py-2 font-medium">Type</th>
                                <th className="px-4 py-2 font-medium">Placeholder</th>
                                <th className="px-4 py-2 font-medium">Required</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {fields.map((f, i) => (
                                <tr key={i} className="bg-white hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2 font-medium text-slate-700">{getFieldLabel(f)}</td>
                                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{getFieldKey(f)}</td>
                                    <td className="px-4 py-2"><Badge variant="outline" className="bg-slate-50">{getFieldType(f)}</Badge></td>
                                    <td className="px-4 py-2 text-muted-foreground">{getFieldPlaceholder(f) || '-'}</td>
                                    <td className="px-4 py-2">
                                        {isFieldRequired(f) ? 
                                            <span className="text-destructive text-xs font-semibold">Required</span> : 
                                            <span className="text-muted-foreground text-xs">Optional</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-slate-50/80 p-5 rounded-lg border shadow-sm">
                <h4 className="text-sm font-semibold mb-4 text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Preview Common Information Form
                </h4>
                <div className="grid gap-4 max-w-xl">
                    {fields.map((f, i) => {
                        const type = getFieldType(f);
                        return (
                            <div key={i} className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">
                                    {getFieldLabel(f)}
                                    {isFieldRequired(f) && <span className="text-destructive ml-1">*</span>}
                                </label>
                                {type === 'TEXTAREA' ? (
                                    <textarea 
                                        disabled 
                                        placeholder={getFieldPlaceholder(f)} 
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground cursor-not-allowed opacity-70" 
                                    />
                                ) : type === 'SELECT' ? (
                                    <select disabled className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground cursor-not-allowed opacity-70">
                                        <option>{getFieldPlaceholder(f) || 'Select...'}</option>
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        disabled 
                                        placeholder={getFieldPlaceholder(f)} 
                                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground cursor-not-allowed opacity-70"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export function WorkflowPreview({ data, steps, departments }: WorkflowPreviewProps) {
    return (
        <div className="space-y-8">
            <section className="rounded-xl border bg-muted/20 p-6 space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-slate-800">Common Rules / Default Rules</h3>
                    <p className="text-sm text-muted-foreground mt-1">These values are the core configuration for this workflow template.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                    <RuleItem label="Workflow Name" value={displayValue(data.workflow_name, "Untitled Workflow")} />
                    <RuleItem label="Status" value={displayValue(data.status, "DRAFT")} />
                </div>

                <div className="border-t pt-4">
                    <h4 className="text-xs text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm text-slate-700">{displayValue(data.description)}</p>
                </div>

                <div className="border-t pt-4">
                    <CommonInformationFieldsPreview fields={data.common_information_fields || []} />
                </div>
            </section>

            <section className="space-y-4">
                <h3 className="text-xl font-medium">Execution Simulation Timeline</h3>

            {steps.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                    No steps defined. Please configure steps in the Step-wise Rules tab to see the preview.
                </div>
            ) : (
                <div className="relative border-l-2 border-primary/30 ml-3 pl-6 space-y-8">
                    {steps.map((step) => {
                        const getDepartmentName = (id: string | null) => {
                            if (!id) return 'None';
                            return departments.find(d => d.id === id)?.name || id;
                        };
                        
                        const deptRule = {
                            value: step.assigned_department_id,
                            source: step.assigned_department_id ? 'Step Specific' : 'Not Set'
                        };

                        const roleRule = {
                            value: step.assigned_role,
                            source: step.assigned_role ? 'Step Specific' : 'Not Set'
                        };

                        const reminderRule = {
                            value: step.reminder_days_before !== null ? step.reminder_days_before : 'N/A',
                            source: step.reminder_days_before !== null ? 'Step Specific' : 'Not Set'
                        };

                        const approvalRule = {
                            value: step.approval_required || false,
                            source: step.approval_required !== null ? 'Step Specific' : 'Not Set'
                        };

                        return (
                            <div key={step.id} className="relative">
                                <div className="absolute -left-9 mt-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold border-4 border-background">
                                    {step.step_order}
                                </div>
                                
                                <Card className="shadow-sm">
                                    <CardHeader className="py-4 bg-muted/10 border-b">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    {step.step_name} 
                                                    {step.is_mandatory && <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-normal">Mandatory</span>}
                                                </CardTitle>
                                                <CardDescription className="mt-1">{step.step_type}</CardDescription>
                                            </div>
                                            <div className="flex gap-2">
                                                {step.video_enabled && <Badge variant="secondary"><Video className="w-3 h-3 mr-1" /> Video</Badge>}
                                                {step.audio_enabled && <Badge variant="secondary"><Mic className="w-3 h-3 mr-1" /> Audio</Badge>}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    
                                    <CardContent className="py-4">
                                        {/* Resolved Rule Table */}
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-4 mb-4 border text-sm">
                                            <h4 className="font-semibold mb-3 text-slate-700 dark:text-slate-300">Resolved Assignment & Rules</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
                                                
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground text-xs">Assigned Department</span>
                                                    <div className="flex justify-between items-center mt-0.5">
                                                        <span className="font-medium">{getDepartmentName(deptRule.value)}</span>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-background">{deptRule.source}</Badge>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground text-xs">Assigned Role</span>
                                                    <div className="flex justify-between items-center mt-0.5">
                                                        <span className="font-medium">{roleRule.value || 'None'}</span>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-background">{roleRule.source}</Badge>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground text-xs">Reminder (Days Before)</span>
                                                    <div className="flex justify-between items-center mt-0.5">
                                                        <span className="font-medium">{reminderRule.value} Days</span>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-background">{reminderRule.source}</Badge>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground text-xs">Requires Approval</span>
                                                    <div className="flex justify-between items-center mt-0.5">
                                                        <span className="font-medium">{approvalRule.value ? 'Yes' : 'No'}</span>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-background">{approvalRule.source}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {step.document_fields?.length > 0 && (
                                                <div className="border rounded-md p-3 space-y-2">
                                                    <div className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                        <FileText className="w-4 h-4 mr-2 text-blue-500" />
                                                        Documents Required ({step.document_fields.length})
                                                    </div>
                                                    <ul className="text-sm space-y-1 ml-6 list-disc text-muted-foreground">
                                                        {step.document_fields.map((doc: any, i: number) => (
                                                            <li key={i}>{doc.fieldName} {doc.required && <span className="text-destructive">*</span>}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {step.custom_fields?.length > 0 && (
                                                <div className="border rounded-md p-3 space-y-2">
                                                    <div className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                        <Settings className="w-4 h-4 mr-2 text-green-500" />
                                                        Custom Fields ({step.custom_fields.length})
                                                    </div>
                                                    <ul className="text-sm space-y-1 ml-6 list-disc text-muted-foreground">
                                                        {step.custom_fields.map((cf: any, i: number) => (
                                                            <li key={i}>{cf.fieldName} <span className="text-xs">({cf.fieldType})</span></li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            )}
            </section>
        </div>
    );
}

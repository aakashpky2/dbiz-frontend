"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronUp, ChevronDown, Edit2, Video, Mic, CheckCircle, FileText, LayoutList } from 'lucide-react';
import { DocumentRequirementBuilder } from './builders/DocumentRequirementBuilder';
import { CustomInformationBuilder } from './builders/CustomInformationBuilder';

export interface WorkflowStepData {
    id: string;
    step_order: number;
    step_name: string;
    long_description: string;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    step_type: string;
    depends_on_step_ids?: string[];
    video_enabled: boolean;
    video_url: string;
    audio_enabled: boolean;
    audio_file_url: string;
    document_fields: any[];
    custom_fields: any[];
    step_due_date_rule: any;
    step_finish_date_rule: any;
    is_mandatory: boolean;
    assigned_department_id: string | null;
    assigned_role: string | null;
    estimated_time: string;
    reminder_days_before: number | null;
    approval_required: boolean | null;
    is_billable: boolean;
    billing_category: 'none' | 'professional_fee' | 'government_fee' | 'both';
}

interface StepWiseRulesFormProps {
    templateId?: string; // Needed for storage paths
    steps: WorkflowStepData[];
    onChange: (steps: WorkflowStepData[]) => void;
    departments: { id: string; name: string }[];
    allowStepOverride?: boolean;
}

const STEP_TYPES = [
    'Document Collection',
    'Data Entry',
    'Client Approval',
    'Internal Review',
    'Government Filing',
    'Payment Processing',
    'Final Delivery',
    'Other'
];

export function StepWiseRulesForm({ templateId, steps, onChange, departments, allowStepOverride }: StepWiseRulesFormProps) {
    const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
    const [editingStepId, setEditingStepId] = useState<string | null>(null);

    const editingStep = steps.find(s => s.id === editingStepId);

    const handleAudioUpload = async (stepId: string, file: File) => {
        if (!templateId) {
            alert("Please save the workflow template first before uploading media.");
            return;
        }

        try {
            setUploadingStepId(stepId);
            
            // 1. Get Signed URL from Backend
            const res = await fetch(`/api/workflow-templates/audio/upload-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: file.name, contentType: file.type })
            });
            const data = await res.json();
            
            if (!data.success) throw new Error(data.message);

            // 2. Upload file directly to Supabase via Signed URL
            const uploadRes = await fetch(data.uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type,
                },
                body: file
            });

            if (!uploadRes.ok) throw new Error('Failed to upload file to storage');

            // 3. Save the public URL to the step
            updateStep(stepId, 'audio_file_url', data.publicUrl);
            alert("Audio uploaded successfully!");
        } catch (error: any) {
            console.error("Upload error:", error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            setUploadingStepId(null);
        }
    };

    const addStep = () => {
        const newStep: WorkflowStepData = {
            id: Math.random().toString(36).substring(7),
            step_order: steps.length + 1,
            step_name: `New Step ${steps.length + 1}`,
            long_description: '',
            status: 'DRAFT',
            step_type: 'Data Entry',
            depends_on_step_ids: [],
            video_enabled: false,
            video_url: '',
            audio_enabled: false,
            audio_file_url: '',
            document_fields: [],
            custom_fields: [],
            step_due_date_rule: null,
            step_finish_date_rule: null,
            is_mandatory: true,
            assigned_department_id: null,
            assigned_role: null,
            estimated_time: '',
            reminder_days_before: null,
            approval_required: null,
            is_billable: false,
            billing_category: 'none'
        };
        onChange([...steps, newStep]);
    };

    const updateStep = (id: string, key: keyof WorkflowStepData, value: any) => {
        onChange(steps.map(s => {
            if (s.id === id) {
                const updated = { ...s, [key]: value };
                // Keep backward compatible is_billable in sync
                if (key === 'billing_category') {
                    updated.is_billable = value !== 'none';
                }
                return updated;
            }
            return s;
        }));
    };

    const removeStep = (id: string) => {
        const newSteps = steps.filter(s => s.id !== id);
        // Reorder
        newSteps.forEach((s, idx) => s.step_order = idx + 1);
        onChange(newSteps);
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;
        
        const newSteps = [...steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        // Swap
        const temp = newSteps[index];
        newSteps[index] = newSteps[targetIndex];
        newSteps[targetIndex] = temp;
        
        // Reassign orders
        newSteps.forEach((s, idx) => s.step_order = idx + 1);
        onChange(newSteps);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-medium">Step-wise Configuration</h3>
                    <p className="text-sm text-muted-foreground">Define the sequence of tasks and their specific requirements.</p>
                </div>
                <Button onClick={addStep} variant="default" className="shadow-sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Step
                </Button>
            </div>

            {!allowStepOverride && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm mb-4">
                    <strong>Note:</strong> Step overrides are currently disabled in the Common Rules. Step-level department, role, date, and approval rules will be strictly inherited and cannot be modified here.
                </div>
            )}

            {steps.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed rounded-2xl text-muted-foreground bg-slate-50/50">
                    No steps defined. Click "Add Step" to begin building the workflow.
                </div>
            ) : (
                <div className="w-full space-y-4">
                    {steps.map((step, index) => (
                        <Card key={step.id} className="overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center p-4 bg-white">
                                <div className="flex flex-col gap-1 mr-4">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700" onClick={() => moveStep(index, 'up')} disabled={index === 0}>
                                        <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <div className="text-center text-xs font-bold w-6 text-slate-700">{step.step_order}</div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700" onClick={() => moveStep(index, 'down')} disabled={index === steps.length - 1}>
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800">{step.step_name || 'Untitled Step'}</span>
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{step.step_type}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 line-clamp-1 max-w-lg">
                                            {step.long_description || 'No description provided.'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        {step.is_mandatory && <Badge variant="destructive" className="shadow-sm h-6">Mandatory</Badge>}
                                        {step.document_fields?.length > 0 && (
                                            <Badge variant="secondary" className="h-6 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"><FileText className="h-3 w-3 mr-1" /> {step.document_fields.length}</Badge>
                                        )}
                                        {step.custom_fields?.length > 0 && (
                                            <Badge variant="secondary" className="h-6 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"><LayoutList className="h-3 w-3 mr-1" /> {step.custom_fields.length}</Badge>
                                        )}
                                        {step.video_enabled && <Badge variant="outline" className="h-6 border-slate-300 text-slate-600"><Video className="h-3 w-3" /></Badge>}
                                        {step.audio_enabled && <Badge variant="outline" className="h-6 border-slate-300 text-slate-600"><Mic className="h-3 w-3" /></Badge>}
                                        {step.approval_required && <Badge variant="outline" className="h-6 border-green-200 text-green-700 bg-green-50"><CheckCircle className="h-3 w-3 mr-1" /> Approval</Badge>}
                                        
                                        <div className="flex items-center gap-2 ml-4 border-l pl-4">
                                            <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={() => setEditingStepId(step.id)}>
                                                <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit Step
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => removeStep(step.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* STEP EDIT MODAL */}
            <Dialog open={!!editingStepId} onOpenChange={(open) => !open && setEditingStepId(null)}>
                <DialogContent className="max-w-5xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-0">
                    {editingStep && (
                        <>
                            <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50 flex flex-row justify-between items-center shadow-sm">
                                <div>
                                    <DialogTitle className="text-xl">Edit Step: {editingStep.step_name}</DialogTitle>
                                    <DialogDescription>Configure step rules, documents, and instructions.</DialogDescription>
                                </div>
                            </DialogHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {/* Basic Step Settings */}
                                <Card className="shadow-sm border-0 ring-1 ring-slate-200">
                                    <CardHeader className="bg-white pb-4 border-b">
                                        <CardTitle className="text-lg">Basic Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                                        <div className="space-y-2">
                                            <Label className="font-semibold">Step Name</Label>
                                            <Input value={editingStep.step_name} onChange={(e) => updateStep(editingStep.id, 'step_name', e.target.value)} className="bg-slate-50" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-semibold">Step Type</Label>
                                            <Select value={editingStep.step_type} onValueChange={(val) => updateStep(editingStep.id, 'step_type', val)}>
                                                <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {STEP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="font-semibold">Long Description / Instructions</Label>
                                            <Textarea 
                                                value={editingStep.long_description} 
                                                onChange={(e) => updateStep(editingStep.id, 'long_description', e.target.value)}
                                                rows={3} 
                                                className="bg-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-semibold">Estimated Time (e.g. '2 Hours')</Label>
                                            <Input value={editingStep.estimated_time || ''} onChange={(e) => updateStep(editingStep.id, 'estimated_time', e.target.value)} className="bg-slate-50" />
                                        </div>
                                        <div className="flex items-center space-x-3 mt-8 bg-slate-50 p-3 rounded-lg border">
                                            <Switch 
                                                checked={editingStep.is_mandatory} 
                                                onCheckedChange={(c) => updateStep(editingStep.id, 'is_mandatory', c)} 
                                            />
                                            <div className="space-y-0.5">
                                                <Label className="font-semibold">Is Mandatory Step?</Label>
                                                <p className="text-xs text-muted-foreground">Workflow cannot proceed if skipped.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3 bg-blue-50 p-4 rounded-lg border border-blue-100 md:col-span-2 mt-4">
                                            <Switch 
                                                checked={editingStep.is_billable || editingStep.billing_category !== 'none'} 
                                                onCheckedChange={(c) => {
                                                    updateStep(editingStep.id, 'is_billable', c);
                                                    updateStep(editingStep.id, 'billing_category', c ? 'both' : 'none');
                                                }} 
                                            />
                                            <div className="space-y-0.5">
                                                <Label className="font-semibold text-blue-900">Is Billable?</Label>
                                                <p className="text-xs text-blue-700">
                                                    {editingStep.is_billable || editingStep.billing_category !== 'none'
                                                        ? 'This step will be available for bill creation in Billing.' 
                                                        : 'This step will not create any bill.'}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Optional Overrides */}
                                <Card className={`shadow-sm border-0 ring-1 ring-slate-200 ${!allowStepOverride ? 'opacity-60 pointer-events-none' : ''}`}>
                                    <CardHeader className="bg-slate-100/50 pb-4 border-b">
                                        <CardTitle className="text-lg">Inheritance Overrides</CardTitle>
                                        {!allowStepOverride && <CardDescription className="text-amber-600 font-medium">Currently disabled by Global Common Rules.</CardDescription>}
                                    </CardHeader>
                                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white">
                                        <div className="space-y-2">
                                            <Label>Assigned Department</Label>
                                            <Select value={editingStep.assigned_department_id || ''} onValueChange={(val) => updateStep(editingStep.id, 'assigned_department_id', val === 'none' ? null : val)}>
                                                <SelectTrigger><SelectValue placeholder="Inherit Default" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Inherit Default</SelectItem>
                                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Assigned Role</Label>
                                            <Input 
                                                value={editingStep.assigned_role || ''} 
                                                onChange={(e) => updateStep(editingStep.id, 'assigned_role', e.target.value)} 
                                                placeholder="Inherit Default"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Reminder Days Before</Label>
                                            <Input 
                                                type="number" 
                                                value={editingStep.reminder_days_before === null ? '' : editingStep.reminder_days_before} 
                                                onChange={(e) => {
                                                    const parsed = parseInt(e.target.value);
                                                    updateStep(editingStep.id, 'reminder_days_before', isNaN(parsed) ? null : parsed);
                                                }} 
                                                placeholder="Inherit Default"
                                            />
                                        </div>
                                        <div className="flex items-center space-x-3 md:col-span-3 border p-4 rounded-lg bg-slate-50">
                                            <Switch 
                                                checked={editingStep.approval_required || false} 
                                                onCheckedChange={(c) => updateStep(editingStep.id, 'approval_required', c)} 
                                            />
                                            <div className="space-y-0.5">
                                                <Label className="font-semibold">Override: Require Approval</Label>
                                                <p className="text-xs text-muted-foreground">Force a manual approval for this specific step.</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Media Integration */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="shadow-sm border-0 ring-1 ring-slate-200">
                                        <CardContent className="pt-6 space-y-6 bg-white">
                                            <div className="flex items-center space-x-3 pb-4 border-b">
                                                <Switch checked={editingStep.video_enabled} onCheckedChange={(c) => updateStep(editingStep.id, 'video_enabled', c)} />
                                                <Label className="font-semibold flex items-center gap-2"><Video className="h-4 w-4 text-blue-500" /> Enable Video Instruction</Label>
                                            </div>
                                            {editingStep.video_enabled && (
                                                <div className="space-y-2">
                                                    <Label>YouTube URL</Label>
                                                    <Input value={editingStep.video_url || ''} onChange={(e) => updateStep(editingStep.id, 'video_url', e.target.value)} placeholder="https://youtube.com/..." />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-sm border-0 ring-1 ring-slate-200">
                                        <CardContent className="pt-6 space-y-6 bg-white">
                                            <div className="flex items-center space-x-3 pb-4 border-b">
                                                <Switch checked={editingStep.audio_enabled} onCheckedChange={(c) => updateStep(editingStep.id, 'audio_enabled', c)} />
                                                <Label className="font-semibold flex items-center gap-2"><Mic className="h-4 w-4 text-indigo-500" /> Enable Audio Instruction</Label>
                                            </div>
                                            {editingStep.audio_enabled && (
                                                <div className="space-y-4">
                                                    <Label>Audio File Instruction</Label>
                                                    {editingStep.audio_file_url ? (
                                                        <div className="space-y-3 p-4 border border-slate-200 rounded-lg bg-slate-50">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-slate-700 truncate mr-4">Uploaded Audio</span>
                                                                <Button variant="destructive" size="sm" onClick={() => updateStep(editingStep.id, 'audio_file_url', '')}>Remove Audio</Button>
                                                            </div>
                                                            <audio controls className="w-full h-10">
                                                                <source src={editingStep.audio_file_url} type="audio/mpeg" />
                                                                Your browser does not support the audio element.
                                                            </audio>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <Input 
                                                                    type="file" 
                                                                    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-m4a"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            if (file.size > 20 * 1024 * 1024) {
                                                                                alert("File size must be less than 20MB");
                                                                                e.target.value = '';
                                                                                return;
                                                                            }
                                                                            handleAudioUpload(editingStep.id, file);
                                                                        }
                                                                    }}
                                                                    disabled={uploadingStepId === editingStep.id}
                                                                />
                                                                {uploadingStepId === editingStep.id && <span className="text-xs text-indigo-600 font-semibold animate-pulse">Uploading...</span>}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">Max 20MB. Accepted formats: MP3, WAV, M4A.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Builders */}
                                <div className="space-y-8 bg-white p-6 rounded-xl shadow-sm ring-1 ring-slate-200">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                            <h4 className="text-lg font-bold text-slate-800">Document Requirements</h4>
                                        </div>
                                        <DocumentRequirementBuilder 
                                            fields={editingStep.document_fields || []}
                                            onChange={(f) => updateStep(editingStep.id, 'document_fields', f)}
                                        />
                                    </div>
                                    
                                    <div className="border-t border-slate-200"></div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <LayoutList className="h-5 w-5 text-indigo-600" />
                                            <h4 className="text-lg font-bold text-slate-800">Custom Information Fields</h4>
                                        </div>
                                        <CustomInformationBuilder 
                                            fields={editingStep.custom_fields || []}
                                            onChange={(f) => updateStep(editingStep.id, 'custom_fields', f)}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <DialogFooter className="border-t p-6 shrink-0 flex justify-end">
                                <Button onClick={() => setEditingStepId(null)} className="px-8 shadow-md">Done Editing</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

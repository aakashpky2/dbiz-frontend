"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Edit, Copy, Trash2, ArrowUp, ArrowDown, Eye, Info, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export interface CommonInformationField {
  id: string;
  label: string;
  key: string;
  type: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  ifAvailable: boolean;
  validation?: {
    type?: string;
    minLength?: number | null;
    maxLength?: number | null;
    pattern?: string | null;
  };
  options?: Array<{ label: string; value: string }>;
  defaultValue?: any;
  section?: string;
  order: number;
  isActive: boolean;
}

export interface WorkflowTemplateData {
    id?: string;
    workflow_name: string;
    description: string;
    is_active: boolean;
    is_billable?: boolean;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    client_id?: string | null;
    inheritance_mode?: string;
    scope?: string;
    version?: number;
    work_type_id?: string;
    common_information_fields?: CommonInformationField[];
}

interface CommonRulesFormProps {
    data: WorkflowTemplateData;
    onChange: (data: WorkflowTemplateData) => void;
    departments: { id: string; name: string }[];
}

const FIELD_TYPES = [
  { value: 'Text', label: 'Text' },
  { value: 'Number', label: 'Number' },
  { value: 'Email', label: 'Email' },
  { value: 'Phone', label: 'Phone' },
  { value: 'PAN', label: 'PAN' },
  { value: 'GSTIN', label: 'GSTIN' },
  { value: 'CIN', label: 'CIN' },
  { value: 'Date', label: 'Date' },
  { value: 'Dropdown', label: 'Dropdown' },
  { value: 'Multi-select', label: 'Multi-select' },
  { value: 'Radio', label: 'Radio' },
  { value: 'Checkbox', label: 'Checkbox' },
  { value: 'Textarea', label: 'Textarea' },
  { value: 'File Upload', label: 'File Upload' },
  { value: 'URL', label: 'URL' },
  { value: 'Password', label: 'Password/secret field' }
];

const slugify = (text: string | null | undefined): string => {
  if (typeof text !== 'string') return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export function CommonRulesForm({ data, onChange, departments }: CommonRulesFormProps) {
    const fields = data.common_information_fields || [];
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingField, setEditingField] = useState<CommonInformationField | null>(null);
    const [isNewField, setIsNewField] = useState(true);
    
    // Form fields within Modal
    const [fieldLabel, setFieldLabel] = useState('');
    const [fieldKey, setFieldKey] = useState('');
    const [fieldType, setFieldType] = useState('Text');
    const [fieldPlaceholder, setFieldPlaceholder] = useState('');
    const [fieldHelpText, setFieldHelpText] = useState('');
    const [fieldDefaultValue, setFieldDefaultValue] = useState('');
    const [fieldSection, setFieldSection] = useState('');
    const [fieldRequired, setFieldRequired] = useState(false);
    const [fieldIfAvailable, setFieldIfAvailable] = useState(false);
    const [fieldActive, setFieldActive] = useState(true);
    
    // Validation settings
    const [valMinLength, setValMinLength] = useState<number | null>(null);
    const [valMaxLength, setValMaxLength] = useState<number | null>(null);
    const [valPattern, setValPattern] = useState('');
    
    // Options Builder State
    const [fieldOptions, setFieldOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [newOptionLabel, setNewOptionLabel] = useState('');
    const [newOptionValue, setNewOptionValue] = useState('');
    const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
    
    // Uniqueness & general validation warnings in modal
    const [modalError, setModalError] = useState<string | null>(null);

    const updateField = (key: keyof WorkflowTemplateData, value: any) => {
        onChange({ ...data, [key]: value });
    };

    const updateFieldsList = (updatedFields: CommonInformationField[]) => {
        // Sort by order
        const sorted = [...updatedFields].map((f, i) => ({ ...f, order: i + 1 }));
        updateField('common_information_fields', sorted);
    };

    // Auto-generate key from label
    useEffect(() => {
        if (isNewField && fieldLabel) {
            setFieldKey(slugify(fieldLabel));
        }
    }, [fieldLabel, isNewField]);

    // Handle field type constraints auto-fill
    useEffect(() => {
        if (fieldType === 'PAN') {
            setValMaxLength(10);
            setValMinLength(10);
        } else if (fieldType === 'GSTIN') {
            setValMaxLength(15);
            setValMinLength(15);
        } else if (fieldType === 'CIN') {
            setValMaxLength(21);
            setValMinLength(21);
        } else if (fieldType === 'Phone') {
            setValMaxLength(10);
            setValMinLength(10);
        } else if (!['Text', 'Textarea', 'Number', 'Password'].includes(fieldType)) {
            setValMinLength(null);
            setValMaxLength(null);
        }
    }, [fieldType]);

    const openAddFieldModal = () => {
        setIsNewField(true);
        setEditingField(null);
        setFieldLabel('');
        setFieldKey('');
        setFieldType('Text');
        setFieldPlaceholder('');
        setFieldHelpText('');
        setFieldDefaultValue('');
        setFieldSection('');
        setFieldRequired(false);
        setFieldIfAvailable(false);
        setFieldActive(true);
        setValMinLength(null);
        setValMaxLength(null);
        setValPattern('');
        setFieldOptions([]);
        setNewOptionLabel('');
        setNewOptionValue('');
        setEditingOptionIndex(null);
        setModalError(null);
        setIsModalOpen(true);
    };

    const openEditFieldModal = (field: CommonInformationField) => {
        setIsNewField(false);
        setEditingField(field);
        setFieldLabel(field.label);
        setFieldKey(field.key);
        setFieldType(field.type);
        setFieldPlaceholder(field.placeholder || '');
        setFieldHelpText(field.helpText || '');
        setFieldDefaultValue(field.defaultValue || '');
        setFieldSection(field.section || '');
        setFieldRequired(field.required);
        setFieldIfAvailable(field.ifAvailable);
        setFieldActive(field.isActive);
        setValMinLength(field.validation?.minLength ?? null);
        setValMaxLength(field.validation?.maxLength ?? null);
        setValPattern(field.validation?.pattern || '');
        setFieldOptions(field.options || []);
        setNewOptionLabel('');
        setNewOptionValue('');
        setEditingOptionIndex(null);
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleSaveField = () => {
        if (!fieldLabel.trim()) {
            setModalError('Field label is required.');
            return;
        }
        if (!fieldKey.trim()) {
            setModalError('Field key is required.');
            return;
        }
        if (!/^[a-z0-9_]+$/.test(fieldKey)) {
            setModalError('Field key must contain only lowercase alphanumeric characters and underscores.');
            return;
        }

        // Uniqueness check for field key
        const duplicateKey = fields.some(
            (f) => f.key === fieldKey && (isNewField || f.id !== editingField?.id)
        );
        if (duplicateKey) {
            setModalError(`A field with key "${fieldKey}" already exists in this workflow.`);
            return;
        }

        // Selection types require options
        const isSelectType = ['Dropdown', 'Radio', 'Checkbox', 'Multi-select'].includes(fieldType);
        if (isSelectType && fieldOptions.length === 0) {
            setModalError('Please define at least one option choice.');
            return;
        }

        if (valMinLength !== null && valMaxLength !== null && valMinLength > valMaxLength) {
            setModalError('Minimum length cannot be greater than maximum length.');
            return;
        }

        const fieldPayload: CommonInformationField = {
            id: isNewField ? uuidv4() : editingField!.id,
            label: fieldLabel.trim(),
            key: fieldKey.trim(),
            type: fieldType,
            placeholder: fieldPlaceholder.trim(),
            helpText: fieldHelpText.trim(),
            required: fieldRequired,
            ifAvailable: fieldIfAvailable,
            validation: {
                type: fieldType.toLowerCase(),
                minLength: valMinLength,
                maxLength: valMaxLength,
                pattern: valPattern.trim() || null
            },
            options: isSelectType ? fieldOptions : [],
            defaultValue: fieldDefaultValue,
            section: fieldSection.trim(),
            order: isNewField ? fields.length + 1 : editingField!.order,
            isActive: fieldActive
        };

        let updatedFields = [];
        if (isNewField) {
            updatedFields = [...fields, fieldPayload];
        } else {
            updatedFields = fields.map((f) => (f.id === editingField!.id ? fieldPayload : f));
        }

        updateFieldsList(updatedFields);
        setIsModalOpen(false);
    };

    const handleDuplicateField = (field: CommonInformationField) => {
        let baseKey = `${field.key}_copy`;
        let suffix = 1;
        while (fields.some((f) => f.key === baseKey)) {
            baseKey = `${field.key}_copy${suffix}`;
            suffix++;
        }

        const duplicated: CommonInformationField = {
            ...field,
            id: uuidv4(),
            key: baseKey,
            label: `${field.label} (Copy)`,
            order: fields.length + 1
        };

        const updated = [...fields, duplicated];
        updateFieldsList(updated);
    };

    const handleDeleteField = (fieldId: string, label: string) => {
        if (window.confirm(`Are you sure you want to delete the field "${label}"?`)) {
            const updated = fields.filter((f) => f.id !== fieldId);
            updateFieldsList(updated);
        }
    };

    const moveField = (index: number, direction: 'UP' | 'DOWN') => {
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= fields.length) return;

        const updated = [...fields];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        updateFieldsList(updated);
    };

    // Option Builder Helpers
    const handleAddOption = () => {
        if (!newOptionLabel.trim()) return;
        const value = newOptionValue.trim() || slugify(newOptionLabel);

        if (fieldOptions.some((o, i) => o.value === value && i !== editingOptionIndex)) {
            alert('An option with this value already exists.');
            return;
        }

        if (editingOptionIndex !== null) {
            const updated = fieldOptions.map((o, i) => 
                i === editingOptionIndex ? { label: newOptionLabel.trim(), value } : o
            );
            setFieldOptions(updated);
            setEditingOptionIndex(null);
        } else {
            setFieldOptions([...fieldOptions, { label: newOptionLabel.trim(), value }]);
        }

        setNewOptionLabel('');
        setNewOptionValue('');
    };

    const handleEditOption = (index: number) => {
        const opt = fieldOptions[index];
        setNewOptionLabel(opt.label);
        setNewOptionValue(opt.value);
        setEditingOptionIndex(index);
    };

    const handleDeleteOption = (index: number) => {
        setFieldOptions(fieldOptions.filter((_, i) => i !== index));
        if (editingOptionIndex === index) {
            setEditingOptionIndex(null);
            setNewOptionLabel('');
            setNewOptionValue('');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* 1. Basic Workflow Details Card */}
            <Card className="shadow-sm border-slate-100 bg-white">
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-bold text-slate-800">Basic Workflow Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">Workflow Name</Label>
                            <Input 
                                value={data.workflow_name || ''} 
                                onChange={(e) => updateField('workflow_name', e.target.value)} 
                                placeholder="e.g. Standard GST Filing"
                                className="bg-slate-50 border-slate-200"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">Status</Label>
                            <Select value={data.status} onValueChange={(val: any) => updateField('status', val)}>
                                <SelectTrigger className="bg-slate-50 border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="ACTIVE">Active (Published)</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 flex flex-col justify-center">
                            <div className="flex items-center justify-between mt-2">
                                <Label className="text-xs font-semibold text-slate-600 flex flex-col">
                                    Is Billable?
                                    <span className="text-[10px] text-slate-400 font-normal">Enable billing for this workflow</span>
                                </Label>
                                <Switch 
                                    checked={data.is_billable || false} 
                                    onCheckedChange={(checked) => updateField('is_billable', checked)} 
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5 md:col-span-3">
                            <Label className="text-xs font-semibold text-slate-600">Description</Label>
                            <Textarea 
                                value={data.description || ''} 
                                onChange={(e) => updateField('description', e.target.value)} 
                                placeholder="Brief description of the workflow's purpose..."
                                rows={2}
                                className="bg-slate-50 border-slate-200"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Common Information Field Builder */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-base font-bold text-slate-800">Common Information Field Builder</h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            Define custom fields to collect client/work information required for this specific workflow type.
                        </p>
                    </div>
                    <Button 
                        type="button" 
                        onClick={openAddFieldModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm shrink-0"
                    >
                        <PlusCircle className="mr-1.5 h-4 w-4" /> Add Field
                    </Button>
                </div>

                {/* Empty State Banner */}
                {fields.length === 0 ? (
                    <div className="border border-dashed border-slate-200 bg-slate-50/50 p-8 rounded-xl text-left flex flex-col items-start gap-4">
                        <div className="space-y-1.5">
                            <h5 className="text-sm font-bold text-slate-700">No common information fields added yet.</h5>
                            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                                Click Add Field to define the information required for this workflow. Examples of fields you can build include Company Name, PAN, GSTIN, Return Period, etc.
                            </p>
                        </div>
                        <Button 
                            type="button" 
                            onClick={openAddFieldModal}
                            variant="outline"
                            className="border-slate-200 text-indigo-600 hover:bg-indigo-50/50 text-xs font-bold shadow-sm"
                        >
                            <PlusCircle className="mr-1.5 h-4 w-4" /> Add Field
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {fields.map((field, index) => {
                            return (
                                <Card 
                                    key={field.id} 
                                    className={cn(
                                        "relative overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:shadow-md",
                                        !field.isActive && "opacity-60 bg-slate-50/50"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute left-0 top-0 bottom-0 w-1",
                                        field.isActive ? "bg-indigo-500" : "bg-slate-300"
                                    )} />
                                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-slate-800">{field.label}</span>
                                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-slate-200 bg-slate-50 text-slate-600 font-mono">
                                                    {field.key}
                                                </Badge>
                                                <Badge className="text-[9px] px-1.5 py-0 border-none bg-indigo-50 text-indigo-700 font-bold uppercase tracking-wider">
                                                    {field.type}
                                                </Badge>
                                                {field.required && (
                                                    <Badge className="text-[9px] px-1.5 py-0 border-none bg-red-50 text-red-700 font-bold uppercase tracking-wider">
                                                        Required
                                                    </Badge>
                                                )}
                                                {field.ifAvailable && (
                                                    <Badge className="text-[9px] px-1.5 py-0 border-none bg-amber-50 text-amber-700 font-bold uppercase tracking-wider">
                                                        If Available
                                                    </Badge>
                                                )}
                                                {!field.isActive && (
                                                    <Badge className="text-[9px] px-1.5 py-0 border-none bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                                                {field.section && (
                                                    <span className="font-medium">
                                                        Section: <span className="text-slate-600 font-bold">{field.section}</span>
                                                    </span>
                                                )}
                                                {field.placeholder && (
                                                    <span>Placeholder: <span className="font-mono text-slate-500">{field.placeholder}</span></span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                                            {/* Reorder actions */}
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => moveField(index, 'UP')} 
                                                disabled={index === 0} 
                                                className="h-8 w-8 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => moveField(index, 'DOWN')} 
                                                disabled={index === fields.length - 1} 
                                                className="h-8 w-8 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                            
                                            <span className="h-4 w-px bg-slate-200 mx-1" />

                                            {/* Edit / Duplicate / Delete Actions */}
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => openEditFieldModal(field)}
                                                className="h-8 border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold"
                                            >
                                                <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDuplicateField(field)} 
                                                title="Duplicate Field"
                                                className="h-8 w-8 text-slate-500 hover:bg-slate-50"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDeleteField(field.id, field.label)} 
                                                title="Delete Field"
                                                className="h-8 w-8 text-red-500 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 3. Collapsible Live Form Simulator Preview */}
            {fields.length > 0 && (
                <Card className="shadow-sm border-slate-100 bg-slate-50/40">
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Eye className="h-4 w-4 text-indigo-500" />
                            Preview Common Information Form
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                            Interactive visual simulation of how this dynamically generated form will look during client workflows.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Group fields by section for premium preview visual */}
                        {(() => {
                            const activeFields = fields.filter(f => f.isActive);
                            const sectionsMap: { [key: string]: CommonInformationField[] } = {};
                            const defaultSectionKey = "_default";

                            activeFields.forEach(f => {
                                const sec = f.section?.trim() || "";
                                if (sec) {
                                    if (!sectionsMap[sec]) sectionsMap[sec] = [];
                                    sectionsMap[sec].push(f);
                                } else {
                                    if (!sectionsMap[defaultSectionKey]) sectionsMap[defaultSectionKey] = [];
                                    sectionsMap[defaultSectionKey].push(f);
                                }
                            });

                            const sortedSectionNames = Object.keys(sectionsMap).filter(k => k !== defaultSectionKey).sort();

                            const renderFieldPreview = (f: CommonInformationField) => {
                                return (
                                    <div key={f.id} className="space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <Label className="text-xs font-semibold text-slate-700">
                                                {f.label}
                                                {f.required && <span className="text-red-500 ml-0.5">*</span>}
                                            </Label>
                                            {f.ifAvailable && (
                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded uppercase">
                                                    If Applicable
                                                </span>
                                            )}
                                        </div>

                                        {f.helpText && (
                                            <p className="text-[10px] text-slate-400 mt-px">{f.helpText}</p>
                                        )}

                                        {f.ifAvailable && (
                                            <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-slate-100/50 border border-slate-200/40 w-fit">
                                                <span className="text-[11px] text-slate-500 font-medium">
                                                    {`Is ${f.label} available?`}
                                                </span>
                                                <Switch checked={true} disabled className="scale-75 origin-left" />
                                            </div>
                                        )}

                                        {/* Dynamic Render based on type */}
                                        {['Dropdown', 'Radio', 'Checkbox', 'Multi-select'].includes(f.type) ? (
                                            f.type === 'Dropdown' ? (
                                                <Select value={f.defaultValue || ''} disabled>
                                                    <SelectTrigger className="bg-white border-slate-200 text-slate-500 h-9">
                                                        <SelectValue placeholder={f.placeholder || "Select option"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(f.options || []).map(o => (
                                                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : f.type === 'Multi-select' ? (
                                                <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-200 rounded-lg min-h-9 items-center">
                                                    {(f.options || []).slice(0, 2).map(o => (
                                                        <Badge key={o.value} variant="secondary" className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 border-none flex items-center">
                                                            {o.label}
                                                        </Badge>
                                                    ))}
                                                    <span className="text-[10px] text-slate-400 px-1 font-semibold">Select options...</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-4 pt-1 bg-white p-3 rounded-lg border border-slate-200/50">
                                                    {(f.options || []).map(o => (
                                                        <div key={o.value} className="flex items-center gap-1.5">
                                                            <input 
                                                                type={f.type === 'Radio' ? 'radio' : 'checkbox'} 
                                                                checked={f.defaultValue === o.value} 
                                                                disabled 
                                                                className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600" 
                                                            />
                                                            <span className="text-xs text-slate-600">{o.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        ) : f.type === 'Textarea' ? (
                                            <Textarea 
                                                placeholder={f.placeholder} 
                                                defaultValue={f.defaultValue || ''} 
                                                disabled 
                                                rows={2}
                                                className="bg-white border-slate-200 text-xs"
                                            />
                                        ) : f.type === 'File Upload' ? (
                                            <div className="border border-dashed border-indigo-200/60 bg-indigo-50/20 p-4 rounded-lg flex items-center justify-center text-xs text-indigo-700 font-semibold cursor-not-allowed">
                                                Click to Upload Document / Safe Attachment File
                                            </div>
                                        ) : (
                                            <Input 
                                                type={f.type === 'Password' ? 'password' : f.type === 'Date' ? 'date' : 'text'} 
                                                placeholder={f.placeholder} 
                                                defaultValue={f.defaultValue || ''} 
                                                disabled 
                                                className="bg-white border-slate-200 h-9 text-xs"
                                            />
                                        )}
                                    </div>
                                );
                            };

                            return (
                                <div className="space-y-6">
                                    {/* Default Section fields */}
                                    {sectionsMap[defaultSectionKey]?.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {sectionsMap[defaultSectionKey].map(renderFieldPreview)}
                                        </div>
                                    )}

                                    {/* Categorized Sections */}
                                    {sortedSectionNames.map(secName => (
                                        <div key={secName} className="border border-slate-100 rounded-lg p-4 bg-white space-y-4">
                                            <h5 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b border-indigo-50 pb-2">
                                                {secName}
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                                {sectionsMap[secName].map(renderFieldPreview)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}

            {/* ADD / EDIT DYNAMIC FIELD MODAL DIALOG */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-2xl">
                    <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-indigo-500" />
                            {isNewField ? 'Add Custom Information Field' : 'Edit Dynamic Field Configuration'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 mt-1">
                            Configure parameters, constraints, and validation options for this reusable workflow variable.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Section 1: Basic Field Details */}
                        <div className="space-y-4">
                            <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                                1. Basic Field Details
                            </h5>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <Label className="text-xs font-semibold text-slate-700">Field Label</Label>
                                    <Input 
                                        value={fieldLabel} 
                                        onChange={(e) => setFieldLabel(e.target.value)} 
                                        placeholder="e.g. Registered PAN"
                                        className="bg-slate-50 border-slate-200 h-9"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <Label className="text-xs font-semibold text-slate-700">Field Key (Unique Variable Name)</Label>
                                    <Input 
                                        value={fieldKey} 
                                        onChange={(e) => setFieldKey(slugify(e.target.value))} 
                                        placeholder="e.g. registered_pan"
                                        disabled={!isNewField}
                                        className="bg-slate-50 border-slate-200 font-mono text-xs h-9 disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <Label className="text-xs font-semibold text-slate-700">Field Type</Label>
                                    <Select value={fieldType} onValueChange={setFieldType}>
                                        <SelectTrigger className="bg-slate-50 border-slate-200 h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FIELD_TYPES.map(t => (
                                                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <Label className="text-xs font-semibold text-slate-700">Logical Section (Grouping Header)</Label>
                                    <Input 
                                        value={fieldSection} 
                                        onChange={(e) => setFieldSection(e.target.value)} 
                                        placeholder="e.g. Identity Details, Tax Information"
                                        className="bg-slate-50 border-slate-200 h-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Display & Helper Settings */}
                        <div className="space-y-4">
                            <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                                2. Display & Helper Settings
                            </h5>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <Label className="text-xs font-semibold text-slate-700">Placeholder</Label>
                                    <Input 
                                        value={fieldPlaceholder} 
                                        onChange={(e) => setFieldPlaceholder(e.target.value)} 
                                        placeholder="Helpful ghost text in the input"
                                        className="bg-slate-50 border-slate-200 h-9"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <Label className="text-xs font-semibold text-slate-700">Default Value</Label>
                                    <Input 
                                        value={fieldDefaultValue} 
                                        onChange={(e) => setFieldDefaultValue(e.target.value)} 
                                        placeholder="Pre-populated value"
                                        className="bg-slate-50 border-slate-200 h-9"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <Label className="text-xs font-semibold text-slate-700">Help/Instruction Text</Label>
                                    <Input 
                                        value={fieldHelpText} 
                                        onChange={(e) => setFieldHelpText(e.target.value)} 
                                        placeholder="Informational subtext displayed below the field label"
                                        className="bg-slate-50 border-slate-200 h-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Validation Settings */}
                        <div className="space-y-4">
                            <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                                3. Validation Rules
                            </h5>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-semibold text-slate-700">Mark Required?</Label>
                                        <p className="text-[10px] text-slate-400">Block submission if field is empty during work execution</p>
                                    </div>
                                    <Switch checked={fieldRequired} onCheckedChange={setFieldRequired} />
                                </div>

                                <div className="flex items-center justify-between border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-semibold text-slate-700">Applicable Toggle ("If Available")</Label>
                                        <p className="text-[10px] text-slate-400">Add a switch (e.g. "Do you have this?") before validating the input</p>
                                    </div>
                                    <Switch checked={fieldIfAvailable} onCheckedChange={setFieldIfAvailable} />
                                </div>

                                {fieldActive && (
                                    <div className="flex items-center justify-between border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-semibold text-slate-700">Field Is Active?</Label>
                                            <p className="text-[10px] text-slate-400">Suspended fields will not display in workflows</p>
                                        </div>
                                        <Switch checked={fieldActive} onCheckedChange={setFieldActive} />
                                    </div>
                                )}

                                {/* Advanced validators depending on type */}
                                {['Text', 'Textarea', 'Number', 'Password'].includes(fieldType) && (
                                    <div className="grid grid-cols-2 gap-4 border border-slate-100 p-4 rounded-lg bg-slate-50/30">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-600">Min Length / Value Limit</Label>
                                            <Input 
                                                type="number" 
                                                value={valMinLength ?? ''} 
                                                onChange={(e) => setValMinLength(e.target.value === '' ? null : parseInt(e.target.value))} 
                                                placeholder="e.g. 3"
                                                className="bg-white border-slate-200 h-9 font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-600">Max Length / Value Limit</Label>
                                            <Input 
                                                type="number" 
                                                value={valMaxLength ?? ''} 
                                                onChange={(e) => setValMaxLength(e.target.value === '' ? null : parseInt(e.target.value))} 
                                                placeholder="e.g. 50"
                                                className="bg-white border-slate-200 h-9 font-mono"
                                            />
                                        </div>
                                        {fieldType === 'Text' && (
                                            <div className="space-y-1.5 col-span-2">
                                                <Label className="text-xs font-semibold text-slate-600">Custom Validation Regex Pattern</Label>
                                                <Input 
                                                    value={valPattern} 
                                                    onChange={(e) => setValPattern(e.target.value)} 
                                                    placeholder="e.g. ^[A-Z]{3}$ for 3 uppercase letters"
                                                    className="bg-white border-slate-200 h-9 font-mono text-xs"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Options Builder (Dropdown, Radio, Checkbox, Multiselect) */}
                        {['Dropdown', 'Radio', 'Checkbox', 'Multi-select'].includes(fieldType) && (
                            <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/40">
                                <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                                    4. Selection Options Builder
                                </h5>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Option Label</Label>
                                            <Input 
                                                value={newOptionLabel} 
                                                onChange={(e) => setNewOptionLabel(e.target.value)} 
                                                placeholder="e.g. Active Regular"
                                                className="bg-white border-slate-200 h-8 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Option Value (Database Key)</Label>
                                            <Input 
                                                value={newOptionValue} 
                                                onChange={(e) => setNewOptionValue(slugify(e.target.value))} 
                                                placeholder="e.g. active_regular"
                                                className="bg-white border-slate-200 h-8 font-mono text-xs"
                                            />
                                        </div>
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddOption}
                                        className="h-8 border-slate-200 text-indigo-600 hover:bg-white text-xs font-bold w-full"
                                    >
                                        {editingOptionIndex !== null ? 'Save Option' : '+ Add Option'}
                                    </Button>

                                    {fieldOptions.length > 0 && (
                                        <div className="border border-slate-200 rounded-lg p-2 bg-white max-h-40 overflow-y-auto space-y-1">
                                            {fieldOptions.map((opt, i) => (
                                                <div key={opt.value} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-50 hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                                        <span className="font-bold">{opt.label}</span>
                                                        <span className="text-slate-400 font-mono text-[10px]">({opt.value})</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => handleEditOption(i)} 
                                                            className="h-6 w-6 text-slate-400 hover:text-indigo-600"
                                                        >
                                                            <Edit className="h-3 w-3" />
                                                        </Button>
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => handleDeleteOption(i)} 
                                                            className="h-6 w-6 text-red-400 hover:text-red-600"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Error notice */}
                        {modalError && (
                            <p className="text-xs font-semibold text-red-600 mt-2 bg-red-50 p-3 rounded-lg border border-red-100">
                                {modalError}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="border-t p-6 shrink-0 flex items-center justify-between bg-slate-50/50 gap-2">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 text-slate-500 hover:bg-slate-100 h-9 border-none font-bold text-xs"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="button" 
                            onClick={handleSaveField}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md h-9"
                        >
                            Save Field Configuration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

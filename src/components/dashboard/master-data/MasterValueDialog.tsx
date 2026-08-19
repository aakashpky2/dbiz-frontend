'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { normalizeDialCode } from '@/lib/country-code-utils';

const FIELD_TYPES = ['Text', 'Number', 'Email', 'Phone', 'PAN', 'GSTIN', 'File Upload'];
const INPUT_TYPES = [
    { value: 'TextInput', label: 'Text Input' },
    { value: 'Textarea', label: 'Textarea' },
    { value: 'Dropdown', label: 'Dropdown' },
    { value: 'Checkbox', label: 'Checkbox' },
    { value: 'Radio', label: 'Radio' },
    { value: 'FileUpload', label: 'File Upload' },
];

const safeParse = (str: string | null | undefined, fallback: any = {}) => {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
};

const normalizeString = (val?: string | null) => (val || "").trim();

interface MasterValue {
    id: string;
    category_id: string;
    name: string;
    description: string | null;
    order: number;
    is_active: boolean;
}

interface MasterValueDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categoryId: string | null;
    categoryName: string | null;
    editingValue?: MasterValue | null;
    onSuccess: (newValueName?: string) => void;
    initialOrder?: number;
    // We can also pass existing values for validation if needed, 
    // but for inline add we might not have the full list.
    // However, the original code used 'values' for duplicate checks.
    existingValues?: MasterValue[]; 
}

export function MasterValueDialog({
    open,
    onOpenChange,
    categoryId,
    categoryName,
    editingValue,
    onSuccess,
    initialOrder = 0,
    existingValues = []
}: MasterValueDialogProps) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    
    // Form state
    const [valueName, setValueName] = useState('');
    const [valueDesc, setValueDesc] = useState('');
    const [valueOrder, setValueOrder] = useState(0);
    const [isDefault, setIsDefault] = useState(false);
    
    const [fieldType, setFieldType] = useState('Text');
    const [inputType, setInputType] = useState('TextInput');
    const [requirement, setRequirement] = useState('Optional');
    const [availableQuestion, setAvailableQuestion] = useState('');
    const [maxLength, setMaxLength] = useState(0);
    const [fieldTarget, setFieldTarget] = useState('Both');
    const [isGroup, setIsGroup] = useState(false);
    const [groupFields, setGroupFields] = useState<any[]>([]);
    const [permissionActions, setPermissionActions] = useState<string[]>([]);
    const [newAction, setNewAction] = useState('');
    const [countryOptions, setCountryOptions] = useState<string[]>([]);

    const isConstitutionCategory = categoryName?.toLowerCase() === 'constitution';
    const isPermissionCategory = categoryName?.toLowerCase() === 'permissions';
    const isCountryCodesCategory = categoryName?.toLowerCase() === 'country codes';
    const isCountriesCategory = categoryName?.toLowerCase() === 'countries';

    // Hydrate form on edit/open
    useEffect(() => {
        if (open) {
            if (editingValue) {
                setValueName(editingValue.name);
                setValueOrder(editingValue.order || 0);

                if (isConstitutionCategory) {
                    const parsed = safeParse(editingValue.description, {});
                    if (parsed.type === 'group') {
                        setIsGroup(true);
                        setValueOrder(parsed.buttonOrder !== undefined ? parsed.buttonOrder : editingValue.order || 0);
                        setGroupFields(Array.isArray(parsed.fields) ? parsed.fields : []);
                        setFieldType('Text');
                        setInputType('TextInput');
                        setRequirement('Optional');
                        setAvailableQuestion('');
                        setMaxLength(0);
                        setFieldTarget('Both');
                    } else {
                        setIsGroup(false);
                        setGroupFields([]);
                        setValueOrder(parsed.fieldOrder !== undefined ? parsed.fieldOrder : editingValue.order || 0);
                        setFieldType(parsed.fieldType || 'Text');
                        setInputType(parsed.inputType || 'TextInput');
                        setRequirement(parsed.requirement || 'Optional');
                        setAvailableQuestion(parsed.availableQuestion || '');
                        setMaxLength(parsed.maxLength || 0);
                        setFieldTarget(parsed.fieldTarget || 'Both');
                    }
                    setValueDesc(editingValue.description || '');
                } else if (isPermissionCategory) {
                    const actions = safeParse(editingValue.description, ['view', 'create', 'edit', 'delete']);
                    setPermissionActions(Array.isArray(actions) ? actions : ['view', 'create', 'edit', 'delete']);
                    setValueDesc(editingValue.description || '');
                } else if (isCountryCodesCategory || isCountriesCategory) {
                    const parsed = safeParse(editingValue.description, {});
                    setIsDefault(parsed?.isDefault || false);
                    
                    // Display dial code without + if it exists
                    const rawCode = parsed?.code || parsed?.dialCode || parsed?.phoneCode || '';
                    setValueDesc(String(rawCode).replace(/\D/g, ''));
                } else {
                    setValueDesc(editingValue.description || '');
                }
            } else {
                // Reset for new
                setValueName('');
                setValueDesc('');
                setValueOrder(initialOrder);
                setFieldType('Text');
                setInputType('TextInput');
                setRequirement('Optional');
                setAvailableQuestion('');
                setMaxLength(0);
                setFieldTarget('Both');
                setIsGroup(false);
                setGroupFields([]);
                setPermissionActions(['view', 'create', 'edit', 'delete']);
                setIsDefault(false);
                setNewAction('');
            }
        }
    }, [open, editingValue, initialOrder, isConstitutionCategory, isPermissionCategory, isCountryCodesCategory, isCountriesCategory]);

    // Fetch country options if needed
    useEffect(() => {
        if (open && isCountryCodesCategory) {
            const fetchCountries = async () => {
                try {
                    const { data: catData } = await supabase.from('app_master_categories').select('id').eq('name', 'Countries').single();
                    if (catData) {
                        const { data } = await supabase
                            .from('app_master_values')
                            .select('name')
                            .eq('category_id', catData.id)
                            .order('name', { ascending: true });
                        setCountryOptions(data?.map(v => v.name) || []);
                    }
                } catch (error) {
                    console.error("Error fetching country options:", error);
                }
            };
            fetchCountries();
        }
    }, [open, isCountryCodesCategory]);

    const handleSave = async () => {
        if (!categoryId || !normalizeString(valueName)) return;
        
        // Validation: Duplicate Country Code check
        if (isCountryCodesCategory) {
            const normalizedCodeValue = normalizeDialCode(valueDesc);
            const isDuplicate = existingValues.some(v => {
                if (v.id === editingValue?.id) return false;
                const parsed = safeParse(v.description, {});
                const existingCode = normalizeDialCode(parsed.code || parsed.dialCode || parsed.phoneCode || v.description);
                return existingCode === normalizedCodeValue;
            });

            if (isDuplicate) {
                toast({ 
                    title: "Validation Error", 
                    description: "Country code already exists", 
                    variant: "destructive" 
                });
                return;
            }
        }

        setSaving(true);
        try {
            let finalDescription = valueDesc.trim();
            if (isConstitutionCategory) {
                if (isGroup) {
                    finalDescription = JSON.stringify({ type: 'group', buttonOrder: valueOrder, fields: groupFields });
                } else {
                    const isPhoneField = valueName.toLowerCase().includes('phone');
                    finalDescription = JSON.stringify({
                        type: 'field',
                        fieldType,
                        inputType,
                        requirement,
                        availableQuestion: requirement === 'If Available' ? availableQuestion : '',
                        maxLength,
                        fieldTarget,
                        fieldOrder: valueOrder,
                        isCountryCodeEnabled: isPhoneField
                    });
                }
            } else if (isPermissionCategory) {
                finalDescription = JSON.stringify(permissionActions);
            } else if (isCountryCodesCategory || isCountriesCategory) {
                finalDescription = JSON.stringify({ 
                    code: isCountryCodesCategory ? normalizeDialCode(valueDesc) : undefined,
                    isDefault 
                });
            }

            // Handle default logic (only one can be default)
            if ((isCountryCodesCategory || isCountriesCategory) && isDefault) {
                const defaultItem = existingValues.find(v => {
                    const parsed = safeParse(v.description, {});
                    return parsed?.isDefault === true && v.id !== editingValue?.id;
                });

                if (defaultItem) {
                    await supabase
                        .from('app_master_values')
                        .update({ description: JSON.stringify({ isDefault: false }) })
                        .eq('id', defaultItem.id);
                }
            }

            const payload = {
                category_id: categoryId,
                name: valueName.trim(),
                description: finalDescription,
                order: valueOrder,
            };

            if (editingValue) {
                const { error } = await supabase.from('app_master_values').update(payload).eq('id', editingValue.id);
                if (error) throw error;
                toast({ title: "Value Updated" });
            } else {
                const { error } = await supabase.from('app_master_values').insert(payload);
                if (error) throw error;
                toast({ title: "Value Added" });
            }
            
            onSuccess(valueName.trim());
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("flex max-h-[88vh] flex-col overflow-hidden rounded-2xl border shadow-xl p-0 gap-0", isConstitutionCategory && isGroup ? "sm:max-w-[900px]" : "sm:max-w-[640px]")}>
                {open && (
                    <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 50, overflow: 'visible' }}>
                        <defs>
                            <linearGradient id="modalBorderGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="transparent" />
                                <stop offset="25%" stopColor="rgba(220, 38, 38, 0.4)" />
                                <stop offset="50%" stopColor="rgba(239, 68, 68, 0.9)" />
                                <stop offset="75%" stopColor="rgba(244, 63, 94, 1)" />
                                <stop offset="95%" stopColor="rgba(251, 113, 133, 0.8)" />
                                <stop offset="100%" stopColor="transparent" />
                            </linearGradient>
                            <style>
                                {`
                                    @keyframes modal-border-trace {
                                        0% { stroke-dashoffset: 850; opacity: 0; }
                                        5% { opacity: 1; }
                                        82% { opacity: 1; }
                                        100% { stroke-dashoffset: 0; opacity: 0; }
                                    }
                                    @media (prefers-reduced-motion: reduce) {
                                        .modal-trace-path { display: none !important; }
                                    }
                                `}
                            </style>
                        </defs>
                        <path 
                            className="modal-trace-path"
                            d="M 0,400 L 0,16 Q 0,0 16,0 L 450,0" 
                            fill="none"
                            stroke="url(#modalBorderGradient)"
                            strokeWidth="7.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                strokeDasharray: '850',
                                strokeDashoffset: '850',
                                filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.55)) drop-shadow(0 0 8px rgba(244,63,94,0.25))',
                                animation: 'modal-border-trace 1300ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards'
                            }}
                        />
                    </svg>
                )}
                <DialogHeader className="shrink-0 px-6 pt-6 pb-5 border-b border-border/70 bg-background relative z-10">
                    <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                        {editingValue ? `Editing "${editingValue.name || 'Value'}"` : `Adding New Item in ${categoryName || 'Category'}`}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mt-1">
                        {editingValue ? 'Update the details of this item.' : `Enter the details for ${categoryName || 'Category'}.`}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-5 space-y-5 bg-primary/[0.025] dark:bg-primary/[0.035] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-200">
                    <div className="space-y-2">
                        <Label htmlFor="vname" className="text-foreground">
                            {isConstitutionCategory ? "Field Name" : isCountryCodesCategory ? "Country Name" : "Name"}
                            <span className="text-red-500">*</span>
                        </Label>
                        {isCountryCodesCategory ? (
                            <Select value={valueName} onValueChange={setValueName}>
                                <SelectTrigger id="vname" className="h-10 rounded-lg text-sm bg-background border-border">
                                    <SelectValue placeholder="Select Country" />
                                </SelectTrigger>
                                <SelectContent>
                                    {countryOptions.map(country => (
                                        <SelectItem key={country} value={country}>{country}</SelectItem>
                                    ))}
                                    {countryOptions.length === 0 && (
                                        <div className="p-4 text-center text-xs text-muted-foreground italic">
                                            No countries found. Please add countries in the "Countries" tab first.
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input className="h-10 rounded-lg text-sm bg-background border-border" id="vname" value={valueName} onChange={e => setValueName(e.target.value)} placeholder={isConstitutionCategory ? "e.g. DIN / PAN / Email" : "e.g. Critical"} />
                        )}
                    </div>

                    {isConstitutionCategory ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Label className="text-xs font-semibold text-muted-foreground mr-2">Config Type</Label>
                                <div className="inline-flex items-center rounded-lg bg-background border border-border p-1 h-9 shadow-sm">
                                    <Button type="button" variant="ghost" size="sm" className={cn("h-7 px-4 text-sm rounded-md transition-all", !isGroup ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground")} onClick={() => setIsGroup(false)}>Single Field</Button>
                                    <Button type="button" variant="ghost" size="sm" className={cn("h-7 px-4 text-sm rounded-md transition-all", isGroup ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground")} onClick={() => setIsGroup(true)}>Field Group</Button>
                                </div>
                            </div>
                            {isGroup ? (
                                <div className="space-y-4 rounded-xl border bg-card p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Label className="text-xs font-bold uppercase">Dynamic Fields</Label>
                                            <Button type="button" size="sm" variant="outline" className="h-9"
                                                onClick={() => {
                                                    const addressSubFields = [
                                                        { fieldName: 'Building / House No.', fieldType: 'Text', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 1 },
                                                        { fieldName: 'Street / Area', fieldType: 'Text', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 2 },
                                                        { fieldName: 'City / Town / Village', fieldType: 'Text', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 3 },
                                                        { fieldName: 'State / Province', fieldType: 'Text', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 4 },
                                                        { fieldName: 'District', fieldType: 'Text', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 5 },
                                                        { fieldName: 'Country', fieldType: 'Text', inputType: 'Dropdown', requirement: 'Mandatory', maxLength: 0, fieldOrder: groupFields.length + 6 },
                                                        { fieldName: 'Pincode', fieldType: 'Number', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 7 },
                                                    ];
                                                    setGroupFields([...groupFields, ...addressSubFields]);
                                                }}
                                            >
                                                + Address
                                            </Button>
                                        </div>
                                        <Button type="button" size="sm" variant="secondary" className="h-9" onClick={() => setGroupFields([...groupFields, { fieldName: '', fieldType: 'Text', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 1 }])}>
                                            <Plus className="h-3 w-3 mr-1" /> Add Field
                                        </Button>
                                    </div>
                                    {groupFields.map((gf, idx) => (
                                        <div key={idx} className="flex flex-col gap-4 border rounded-xl bg-background p-5 shadow-sm relative group">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setGroupFields(groupFields.filter((_, i) => i !== idx))}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>

                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pr-8">
                                                <div className="md:col-span-2 space-y-1">
                                                    <Label className="text-xs font-semibold text-muted-foreground">Field Name</Label>
                                                    <Input className="h-10 text-sm rounded-lg bg-background border-border" placeholder="e.g. Area Code" value={gf.fieldName} onChange={e => { const updated = [...groupFields]; updated[idx].fieldName = e.target.value; setGroupFields(updated); }} />
                                                </div>
                                                <div className=" space-y-1">
                                                    <Label className="text-xs font-semibold text-muted-foreground">Data Type</Label>
                                                    <Select value={gf.fieldType} onValueChange={v => { const updated = [...groupFields]; updated[idx].fieldType = v; setGroupFields(updated); }}>
                                                        <SelectTrigger className="h-10 text-sm rounded-lg px-3 bg-background border-border"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className=" space-y-1">
                                                    <Label className="text-xs font-semibold text-muted-foreground">Requirement</Label>
                                                    <Select value={gf.requirement} onValueChange={v => { const updated = [...groupFields]; updated[idx].requirement = v; setGroupFields(updated); }}>
                                                        <SelectTrigger className="h-10 text-sm rounded-lg px-3 bg-background border-border"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Mandatory">Mandatory</SelectItem><SelectItem value="Optional">Optional</SelectItem><SelectItem value="If Available">If Available</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pr-8">
                                                <div className="col-span-6 sm:col-span-5 space-y-1">
                                                    <Label className="text-xs font-semibold text-muted-foreground">Input Protocol</Label>
                                                    <Select value={gf.inputType} onValueChange={v => { const updated = [...groupFields]; updated[idx].inputType = v; setGroupFields(updated); }}>
                                                        <SelectTrigger className="h-8 text-xs px-2.5 bg-background border-border"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-3 sm:col-span-3 space-y-1">
                                                    <Label className="text-xs font-semibold text-muted-foreground">Field Order</Label>
                                                    <Input type="number" className="h-8 text-xs bg-background border-border font-mono" value={gf.fieldOrder} onChange={e => { const updated = [...groupFields]; updated[idx].fieldOrder = parseInt(e.target.value) || 0; setGroupFields(updated); }} />
                                                </div>
                                                <div className="col-span-3 sm:col-span-4 space-y-1">
                                                    <Label className="text-xs font-semibold text-muted-foreground">Max Length</Label>
                                                    <Input type="number" className="h-8 text-xs bg-background border-border font-mono" placeholder="unlimited" value={gf.maxLength === 0 ? '' : gf.maxLength} onChange={e => { const updated = [...groupFields]; updated[idx].maxLength = parseInt(e.target.value) || 0; setGroupFields(updated); }} />
                                                </div>
                                            </div>
                                            {gf.requirement === 'If Available' && (
                                                <div className="pr-6 mt-1">
                                                    <Label className="text-xs font-semibold text-primary">Conditional Question</Label>
                                                    <Input className="h-10 rounded-lg text-sm" placeholder="e.g. Do you have a PAN card?" value={gf.availableQuestion || ''} onChange={e => { const updated = [...groupFields]; updated[idx].availableQuestion = e.target.value; setGroupFields(updated); }} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {groupFields.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No fields added to this group yet.</p>}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground">Field Type</Label>
                                        <Select onValueChange={setFieldType} value={fieldType}>
                                            <SelectTrigger className="h-10 rounded-lg text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {FIELD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground">Input Control Type</Label>
                                        <Select onValueChange={setInputType} value={inputType}>
                                            <SelectTrigger className="h-10 rounded-lg text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground">Requirement</Label>
                                        <Select onValueChange={setRequirement} value={requirement}>
                                            <SelectTrigger className="h-10 rounded-lg text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Mandatory">Mandatory</SelectItem>
                                                <SelectItem value="Optional">Optional</SelectItem>
                                                <SelectItem value="If Available">If Available</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground">Max Length</Label>
                                        <Input type="number" className="h-10 rounded-lg text-sm bg-background border-border" value={maxLength} onChange={e => setMaxLength(parseInt(e.target.value) || 0)} placeholder="0 for no limit" />
                                    </div>
                                    {requirement === 'If Available' && (
                                        <div className="col-span-2 space-y-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                                            <Label className="text-xs font-bold text-primary">Conditional Question</Label>
                                            <Input value={availableQuestion} onChange={e => setAvailableQuestion(e.target.value)} placeholder="e.g. Do you have a GSTIN?" className="h-9 bg-background focus-visible:ring-primary border-border" />
                                        </div>
                                    )}
                                    <div className="col-span-2 space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground">Field Applicability</Label>
                                        <Select onValueChange={setFieldTarget} value={fieldTarget}>
                                            <SelectTrigger className="h-10 rounded-lg text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Constitution">Constitution Level</SelectItem>
                                                <SelectItem value="Role">Role Level</SelectItem>
                                                <SelectItem value="Both">All level</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-1.5">Specify where this automatic field should be implemented.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : isPermissionCategory ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground block mb-2">Configure Actions for {valueName || 'Module'}</Label>
                                <div className="flex flex-wrap gap-2 p-3 rounded-xl border bg-card min-h-[60px]">
                                    {permissionActions.map((act, idx) => (
                                        <Badge key={idx} variant="secondary" className="h-7 pl-3 pr-1 py-1 rounded-md font-medium text-xs bg-muted text-foreground border shadow-sm">
                                            {act}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setPermissionActions(prev => prev.filter((_, i) => i !== idx))}
                                                className="h-5 w-5 ml-1 hover:bg-destructive/10 hover:text-destructive"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </Badge>
                                    ))}
                                    <div className="flex items-center gap-2 flex-grow">
                                        <Input
                                            value={newAction}
                                            onChange={e => setNewAction(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = newAction.trim().toLowerCase();
                                                    if (val && !permissionActions.includes(val)) {
                                                        setPermissionActions(prev => [...prev, val]);
                                                        setNewAction('');
                                                    }
                                                }
                                            }}
                                            placeholder="Add an action, then press Enter"
                                            className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm px-0"
                                        />
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    ) : (isCountryCodesCategory || isCountriesCategory) ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-4 mb-4">
                                <div className="space-y-1"><Label className="text-sm font-medium">Set as Default</Label><p className="text-xs text-muted-foreground">Use this value as the default option.</p></div>
                                <Button type="button" size="sm" variant={isDefault ? "default" : "secondary"} className="h-8 px-4 rounded-full" onClick={() => setIsDefault(prev => !prev)}>{isDefault ? "Enabled" : "Disabled"}</Button>
                            </div>
                            {isCountryCodesCategory && (
                                <div className="space-y-2">
                                    <Label htmlFor="vdesc" className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                        Dial Code <span className="text-xs font-medium text-muted-foreground">(e.g. 91)</span>
                                    </Label>
                                    <Input 
                                        id="vdesc" 
                                        value={valueDesc} 
                                        onChange={e => setValueDesc(e.target.value.replace(/\D/g, ""))} 
                                        placeholder="Enter numeric dial code (e.g. 91)" 
                                        className="h-10 rounded-lg text-sm font-mono font-medium bg-background border-border"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="vdesc">Description</Label>
                            <Input 
                                id="vdesc" 
                                value={valueDesc} 
                                onChange={e => setValueDesc(e.target.value)} 
                                placeholder="Optional details" 
                                className="h-10 rounded-lg text-sm bg-background border-border"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="vorder">{isConstitutionCategory && isGroup ? "Button Display Order" : "Display / Field Order"}</Label>
                        <Input className="h-10 rounded-lg text-sm bg-background border-border" id="vorder" type="number" value={valueOrder} onChange={e => setValueOrder(parseInt(e.target.value) || 0)} />
                    </div>
                </div>
                <DialogFooter className="shrink-0 border-t border-border/70 px-6 py-4 flex flex-col-reverse sm:flex-row justify-end items-center gap-3 bg-background relative z-10">
                    <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-[150px] h-[42px] rounded-[10px] px-5 text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-background text-foreground border border-border shadow-sm hover:bg-muted hover:border-primary/15 hover:-translate-y-[1px] active:translate-y-0"
                        style={{ transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease' }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={saving || !normalizeString(valueName)}
                        className="w-full sm:w-[150px] h-[42px] rounded-[10px] px-5 text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground border border-primary shadow-sm hover:bg-primary/90 hover:shadow-md hover:-translate-y-[1px] active:translate-y-0"
                        style={{ transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease' }}
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {editingValue ? 'Save Changes' : 'Add Item'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

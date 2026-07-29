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
            <DialogContent className={cn("transition-all duration-300 max-h-[90vh] flex flex-col overflow-hidden", isConstitutionCategory && isGroup ? "sm:max-w-2xl" : "sm:max-w-md")}>
                <DialogHeader className="border-b pb-4 shrink-0">
                    <DialogTitle className="text-xl">
                        {editingValue ? `Editing "${editingValue.name || 'Value'}"` : `Adding New Item in ${categoryName || 'Category'}`}
                    </DialogTitle>
                    <DialogDescription>
                        {editingValue ? 'Update the details of this item.' : `Enter the details for ${categoryName || 'Category'}.`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 px-1 flex-1 overflow-y-auto -mx-1">
                    <div className="space-y-2">
                        <Label htmlFor="vname">
                            {isConstitutionCategory ? "Field Name (e.g. GST Number)" : isCountryCodesCategory ? "Country Name" : "Name"}
                            <span className="text-red-500">*</span>
                        </Label>
                        {isCountryCodesCategory ? (
                            <Select value={valueName} onValueChange={setValueName}>
                                <SelectTrigger id="vname" className="h-10">
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
                            <Input id="vname" value={valueName} onChange={e => setValueName(e.target.value)} placeholder={isConstitutionCategory ? "e.g. DIN / PAN / Email" : "e.g. Critical"} />
                        )}
                    </div>

                    {isConstitutionCategory ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Label className="text-xs font-bold uppercase text-muted-foreground mr-2">Config Type:</Label>
                                <div className="flex items-center space-x-2">
                                    <Button type="button" variant={!isGroup ? "secondary" : "outline"} size="sm" onClick={() => setIsGroup(false)}>Single Field</Button>
                                    <Button type="button" variant={isGroup ? "secondary" : "outline"} size="sm" onClick={() => setIsGroup(true)}>Field Group</Button>
                                </div>
                            </div>
                            {isGroup ? (
                                <div className="space-y-4 border rounded-xl p-4 bg-muted/10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Label className="text-xs font-bold uppercase">Dynamic Fields Section</Label>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] px-2 font-black uppercase tracking-widest border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:border-emerald-500 transition-all rounded-lg"
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
                                                + Address Preset
                                            </Button>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={() => setGroupFields([...groupFields, { fieldName: '', fieldType: 'Text', inputType: 'TextInput', requirement: 'Optional', maxLength: 0, fieldOrder: groupFields.length + 1 }])}>
                                            <Plus className="h-3 w-3 mr-1" /> Add Field
                                        </Button>
                                    </div>
                                    {groupFields.map((gf, idx) => (
                                        <div key={idx} className="flex flex-col gap-3 border border-muted/60 p-4 pt-5 rounded-lg relative bg-white transition-all group shadow-sm hover:shadow-md">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => setGroupFields(groupFields.filter((_, i) => i !== idx))}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>

                                            <div className="grid grid-cols-12 gap-3 pr-6">
                                                <div className="col-span-12 sm:col-span-5 space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Field Name</Label>
                                                    <Input className="h-8 text-xs font-semibold" placeholder="e.g. Area Code" value={gf.fieldName} onChange={e => { const updated = [...groupFields]; updated[idx].fieldName = e.target.value; setGroupFields(updated); }} />
                                                </div>
                                                <div className="col-span-6 sm:col-span-4 space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Type</Label>
                                                    <Select value={gf.fieldType} onValueChange={v => { const updated = [...groupFields]; updated[idx].fieldType = v; setGroupFields(updated); }}>
                                                        <SelectTrigger className="h-8 text-xs px-2.5 bg-muted/5"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-6 sm:col-span-3 space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Requirement</Label>
                                                    <Select value={gf.requirement} onValueChange={v => { const updated = [...groupFields]; updated[idx].requirement = v; setGroupFields(updated); }}>
                                                        <SelectTrigger className="h-8 text-xs px-2.5 bg-muted/5"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Mandatory">Mandatory</SelectItem><SelectItem value="Optional">Optional</SelectItem><SelectItem value="If Available">If Available</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-12 gap-3 pr-6">
                                                <div className="col-span-6 sm:col-span-5 space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Input Protocol</Label>
                                                    <Select value={gf.inputType} onValueChange={v => { const updated = [...groupFields]; updated[idx].inputType = v; setGroupFields(updated); }}>
                                                        <SelectTrigger className="h-8 text-xs px-2.5 bg-muted/5"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-3 sm:col-span-3 space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Field Order</Label>
                                                    <Input type="number" className="h-8 text-xs bg-muted/5 font-mono" value={gf.fieldOrder} onChange={e => { const updated = [...groupFields]; updated[idx].fieldOrder = parseInt(e.target.value) || 0; setGroupFields(updated); }} />
                                                </div>
                                                <div className="col-span-3 sm:col-span-4 space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Max Length</Label>
                                                    <Input type="number" className="h-8 text-xs bg-muted/5 font-mono" placeholder="unlimited" value={gf.maxLength === 0 ? '' : gf.maxLength} onChange={e => { const updated = [...groupFields]; updated[idx].maxLength = parseInt(e.target.value) || 0; setGroupFields(updated); }} />
                                                </div>
                                            </div>
                                            {gf.requirement === 'If Available' && (
                                                <div className="pr-6 mt-1">
                                                    <Label className="text-[10px] uppercase font-bold text-primary">Conditional Question</Label>
                                                    <Input className="h-8 text-xs bg-primary/5 border-primary/20" placeholder="e.g. Do you have a PAN card?" value={gf.availableQuestion || ''} onChange={e => { const updated = [...groupFields]; updated[idx].availableQuestion = e.target.value; setGroupFields(updated); }} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {groupFields.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No fields added to this group yet.</p>}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Field Type</Label>
                                        <Select onValueChange={setFieldType} value={fieldType}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {FIELD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Input Control Type</Label>
                                        <Select onValueChange={setInputType} value={inputType}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Requirement</Label>
                                        <Select onValueChange={setRequirement} value={requirement}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Mandatory">Mandatory</SelectItem>
                                                <SelectItem value="Optional">Optional</SelectItem>
                                                <SelectItem value="If Available">If Available</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Max Length</Label>
                                        <Input type="number" value={maxLength} onChange={e => setMaxLength(parseInt(e.target.value) || 0)} placeholder="0 for no limit" />
                                    </div>
                                    {requirement === 'If Available' && (
                                        <div className="col-span-2 space-y-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                                            <Label className="text-xs font-bold text-primary">Conditional Question</Label>
                                            <Input value={availableQuestion} onChange={e => setAvailableQuestion(e.target.value)} placeholder="e.g. Do you have a GSTIN?" className="h-9 bg-background focus-visible:ring-primary" />
                                        </div>
                                    )}
                                    <div className="col-span-2 space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Field Applicability</Label>
                                        <Select onValueChange={setFieldTarget} value={fieldTarget}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Constitution">Constitution Level</SelectItem>
                                                <SelectItem value="Role">Role Level</SelectItem>
                                                <SelectItem value="Both">All level</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground italic">Specify where this automatic field should be implemented.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : isPermissionCategory ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Configure Actions for {valueName || 'Module'}</Label>
                                <div className="flex flex-wrap gap-2 p-3 rounded-xl border-2 bg-muted/5 min-h-[50px]">
                                    {permissionActions.map((act, idx) => (
                                        <Badge key={idx} variant="secondary" className="h-8 pl-3 pr-1 py-1 rounded-lg font-black text-xs uppercase tracking-widest bg-white border shadow-sm">
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
                                            placeholder="Add action (e.g. print)"
                                            className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs font-bold uppercase tracking-widest px-0"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] font-medium text-muted-foreground opacity-60">Press enter to add custom actions.</p>
                            </div>
                        </div>
                    ) : (isCountryCodesCategory || isCountriesCategory) ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/5 shadow-sm">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">
                                    Set as Default
                                </Label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isDefault ? "secondary" : "outline"}
                                    onClick={() => setIsDefault(prev => !prev)}
                                >
                                    {isDefault ? "Default Selected" : "Mark as Default"}
                                </Button>
                            </div>
                            {isCountryCodesCategory && (
                                <div className="space-y-2">
                                    <Label htmlFor="vdesc" className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                        Dial Code <span className="text-[10px] font-medium text-slate-400 font-mono">(e.g. 91)</span>
                                    </Label>
                                    <Input 
                                        id="vdesc" 
                                        value={valueDesc} 
                                        onChange={e => setValueDesc(e.target.value.replace(/\D/g, ""))} 
                                        placeholder="Enter numeric dial code (e.g. 91)" 
                                        className="font-mono text-blue-600 font-bold"
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
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="vorder">{isConstitutionCategory && isGroup ? "Button Display Order" : "Display / Field Order"}</Label>
                        <Input id="vorder" type="number" value={valueOrder} onChange={e => setValueOrder(parseInt(e.target.value) || 0)} />
                    </div>
                </div>
                <DialogFooter className="border-t pt-4 mt-4 shrink-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={
                            saving || 
                            !normalizeString(valueName)
                        }
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {editingValue ? 'Save Changes' : 'Add Item'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

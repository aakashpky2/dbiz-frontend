"use client";
import { parsePhoneFromPayload, formatPhoneForPayload, sanitizePhoneInput, isValidLocalPhone, formatPhoneNumber, phoneValidation } from '@/lib/phone-utils';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useForm, useFieldArray, FormProvider, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfiles, useBusinessConstitutions, type Profile, type Role, type BusinessTypeSetup, type FieldDefinitionData, type SectionData } from '@/hooks/use-profiles';
import { Loader2, PlusCircle, Trash2, ArrowLeft, AlertTriangle, Copy, CheckCircle, Edit, ListTodo, AlertCircle as AlertCircleIcon, Users, Shield, Check } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { CloudUpload } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { CompanyBrandingForm } from '@/components/dashboard/admin/company-settings/CompanyBrandingDialog';
import { Palette } from 'lucide-react';


// --- Dynamic Validation Schema Generation ---

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const STRICT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECTION_REQUIREMENTS: Record<string, { requiresStakeholder: boolean }> = {
    'beneficial_owners': { requiresStakeholder: true },
    'stakeholding_pattern': { requiresStakeholder: true },
    'promoters_details': { requiresStakeholder: true }
};

const isPhoneField = (f: FieldDefinitionData) => 
    f.fieldType === 'Phone' || 
    f.isCountryCodeEnabled === true || 
    f.fieldName?.toLowerCase().includes('mobile') || 
    f.fieldName?.toLowerCase().includes('phone');

const createFieldValidator = (field: FieldDefinitionData): z.ZodTypeAny => {
    const isPhone = isPhoneField(field);

    if (isPhone) {
        const phoneValidator = z.string().refine(
            (val) => {
                if (!val) return true;
                const { number } = parsePhoneFromPayload(val);
                return !!number && isValidLocalPhone(number);
            },
            { message: `${field.fieldName}: Phone number must be exactly 10 digits.` }
        );
        if (field.requirement !== 'Mandatory') {
            return z.union([z.literal(''), z.literal(undefined), phoneValidator]);
        }
        return z.string()
            .min(1, { message: `${field.fieldName} is required.` })
            .refine((val) => {
                const { number } = parsePhoneFromPayload(val);
                return !!number && isValidLocalPhone(number);
            }, { message: `${field.fieldName}: Phone number must be exactly 10 digits.` });
    }

    let validator: z.ZodString | z.ZodEffects<z.ZodString, string, string> = z.string();

    if (field.maxLength && field.maxLength > 0) {
        validator = validator.max(field.maxLength, { message: `${field.fieldName} cannot exceed ${field.maxLength} characters.` });
    }

    switch (field.fieldType) {
        case 'Email': validator = validator.email({ message: `Invalid Email format for ${field.fieldName}.` }).max(100, "Email cannot exceed 100 characters.").regex(STRICT_EMAIL_REGEX, { message: `${field.fieldName} must be a valid email (e.g. user@example.com).` }); break;
        case 'PAN': validator = validator.regex(PAN_REGEX, { message: `Invalid PAN format for ${field.fieldName}.` }); break;
        case 'GSTIN': validator = validator.regex(GSTIN_REGEX, { message: `Invalid GSTIN format for ${field.fieldName}.` }); break;
        case 'Number': validator = validator.regex(/^\d*$/, { message: `${field.fieldName} must only contain numbers.` }); break;
    }

    if (field.requirement !== 'Mandatory') {
        return z.union([z.literal(''), z.literal(undefined), validator]);
    }
    return validator.min(1, { message: `${field.fieldName} is required.` });
};

const generateSchema = (constitution: BusinessTypeSetup | null | undefined) => {
    const memberSchema = z.object({
        _id: z.string().default(''), // stable id
        details: z.any(), // Details will be validated inside the role object
        isSaved: z.boolean().optional(),
    });

    const baseSchema = {
        profileName: z.string().min(1, "Profile name is required.").max(100, "Profile name cannot exceed 100 characters."),
        constitutionId: z.string().min(1, "Please select a constitution."),
        isDefault: z.boolean().optional(),
        signatories: z.array(z.object({
            roleKey: z.string(),
            memberId: z.string(),
        })).default([]),
        primarySignatories: z.record(
            z.string(),
            z.string().optional()
        ).default({}),
    };

    if (!constitution) {
        return z.object({
            ...baseSchema,
            fields: z.any(),
            roles: z.any(),
        }).superRefine((data, ctx) => {
            // Signatories are OPTIONAL during save
            // Validation handled later during final submission stage
        });
    }

    const topLevelFieldsShape: Record<string, z.ZodTypeAny> = {
        gst_applicable: z.boolean().default(false)
    };
    (constitution.requiredSections || []).forEach(section => {
        (section.fields || []).forEach(field => {
            if (field.fieldKey === 'gstin') {
                topLevelFieldsShape[field.fieldKey] = z.string().optional(); // Validation handled in superRefine
            } else {
                topLevelFieldsShape[field.fieldKey] = createFieldValidator(field);
            }
        });
    });

    const rolesShape: Record<string, z.ZodTypeAny> = {};
    (constitution.roles || []).forEach(role => {
        const memberDetailsShape: Record<string, z.ZodTypeAny> = {};

        (role.requiredDetails || []).forEach((section: any) => {
            (section.fields || []).forEach((field: any) => {
                memberDetailsShape[field.fieldKey] = createFieldValidator(field);
            });
        });

        if (role.designations && role.designations.length > 0) {
            memberDetailsShape['designation'] = z.string().min(1, "Designation is required.");
        }

        const validatedMemberSchema = memberSchema.extend({
            details: z.any()
        }).superRefine((member, ctx) => {
            if (member.isSaved) {
                const result = z.object(memberDetailsShape).safeParse(member.details);
                if (!result.success) {
                    result.error.issues.forEach(issue => {
                        ctx.addIssue({ ...issue, path: ['details', ...issue.path] });
                    });
                }
            }
        });

        let membersArrayValidator: any = z.array(validatedMemberSchema);
        if (role.maxMembers > 0) membersArrayValidator = membersArrayValidator.max(role.maxMembers, `No more than ${role.maxMembers} members allowed for the ${role.roleName} role.`);

        membersArrayValidator = membersArrayValidator.refine(
            (members = []) => {
                const names = members.map((m: { details?: { full_name?: string } }) => m.details?.full_name?.trim().toLowerCase()).filter(Boolean);
                const uniqueNames = new Set(names);
                return uniqueNames.size === names.length;
            },
            { message: "Duplicate member names are not allowed in the same role." }
        );

        rolesShape[role.roleKey] = z.object({
            members: z.array(z.any()).optional().superRefine((members: any[] | undefined, refineContext: z.RefinementCtx) => {
                if (members && members.length > 0) {
                    members.forEach((member, index) => {
                        const memberValidationResult = validatedMemberSchema.safeParse(member);
                        if (!memberValidationResult.success) {
                            memberValidationResult.error.errors.forEach(err => {
                                refineContext.addIssue({ ...err, path: [index, ...err.path] });
                            });
                        }
                    });
                }
            })
        }).optional();
    });

    return z.object({
        ...baseSchema,
        fields: z.object(topLevelFieldsShape).superRefine((fields, ctx) => {
            if (fields.gst_applicable) {
                if (!fields.gstin || typeof fields.gstin !== 'string' || fields.gstin.trim() === '') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['gstin'],
                        message: 'GSTIN is required when GST is applicable.'
                    });
                } else if (!GSTIN_REGEX.test(fields.gstin)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['gstin'],
                        message: 'Invalid GSTIN format.'
                    });
                }
            }
        }),
        roles: z.object(rolesShape).optional()
    }).superRefine((data, ctx) => {
        // Signatories are OPTIONAL during save
        // Validation handled later during final submission stage

        // Global Stakeholder Requirement: show as warning only — do NOT block save
        // (stakeholders can be added later; profile save must succeed regardless)
    });
};


const isValueBlank = (value: any): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return true;
    if (value === false) return true; // For single checkbox where false means empty
    return false;
};

import { CountryCodeSelect } from '@/components/common/CountryCodeSelect';
import { normalizeStage } from '@/app/dashboard/work/proposals/_components/CRMFollowUpModal/lib/workflowEngine';
import { getMemberDisplayName, ensureMemberNameField, normalizeMemberForSave } from '@/lib/member-name-utils';

const PhoneMultiInput = ({
    value,
    onChange,
    fieldName
}: {
    value: string,
    onChange: (val: string) => void,
    fieldName?: string
}) => {
    const { clearErrors } = useFormContext();
    const [localNumber, setLocalNumber] = useState('');
    const [localCode, setLocalCode] = useState('+91');

    useEffect(() => {
        const safeValue = value || '';
        
        // If the incoming value matches what we would generate from our local state,
        // it means WE caused this value change (user is typing). 
        // We must ignore it so that parsePhoneNumber doesn't clobber partial inputs like "+919".
        if (safeValue === formatPhoneNumber(localCode, localNumber)) {
            return;
        }

        // Otherwise, this is an external change (initial load, form reset, etc.)
        const { countryCode, number } = parsePhoneFromPayload(safeValue);
        setLocalCode(countryCode || '+91');
        setLocalNumber(number || '');
    }, [value, localCode, localNumber]);

    return (
        <div className="flex items-center overflow-hidden">
            <CountryCodeSelect 
                value={localCode} 
                onChange={(code) => {
                    setLocalCode(code);
                    if (localNumber) {
                        onChange(formatPhoneNumber(code, localNumber));
                    }
                }} 
            />
            <Input
                placeholder="9876543210"
                value={localNumber}
                maxLength={10}
                className="h-10 border border-l-0 bg-white rounded-r-md rounded-l-none text-sm focus-visible:ring-blue-500 shadow-sm flex-1 font-bold tracking-widest tabular-nums"
                onChange={e => {
                    const digits = sanitizePhoneInput(e.target.value);
                    setLocalNumber(digits);
                    
                    if (digits) {
                        onChange(formatPhoneNumber(localCode, digits));
                    } else {
                        onChange('');
                    }

                    if (isValidLocalPhone(digits) && fieldName) {
                        clearErrors(fieldName as any);
                    }
                }}
            />
        </div>
    );
};

const CreatableMasterSelect = ({
    categoryName,
    value,
    onChange,
    placeholder,
    disabled
}: {
    categoryName: string,
    value: string,
    onChange: (val: string) => void,
    placeholder?: string,
    disabled?: boolean
}) => {
    const [options, setOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const fetchOptions = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Find Category ID
            let { data: catData } = await supabase
                .from('app_master_categories')
                .select('id')
                .eq('name', categoryName)
                .single();

            if (!catData) {
                // Auto-create category if it doesn't exist
                const { data: newCat, error: catError } = await supabase
                    .from('app_master_categories')
                    .insert({ name: categoryName, description: `Dynamic ${categoryName} list` })
                    .select()
                    .single();

                if (catError) throw catError;
                catData = newCat;
            }

            if (catData?.id) {
                // 2. Get Values
                const { data: valData } = await supabase
                    .from('app_master_values')
                    .select('name')
                    .eq('category_id', catData.id)
                    .order('name', { ascending: true });

                if (valData) {
                    setOptions(valData.map((v: { name: string }) => v.name));
                }
            }
        } catch (error) {
            console.error(`Error fetching ${categoryName}:`, error);
        } finally {
            setLoading(false);
        }
    }, [categoryName]);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    const handleAddNew = async () => {
        if (!newValue.trim()) return;
        setIsSaving(true);
        try {
            const { data: catData } = await supabase
                .from('app_master_categories')
                .select('id')
                .eq('name', categoryName)
                .single();

            if (catData?.id) {
                const { error } = await supabase
                    .from('app_master_values')
                    .insert({
                        category_id: catData.id,
                        name: newValue.trim(),
                        order: options.length + 1
                    });

                if (error) throw error;

                toast({ title: "Updated Registry", description: `"${newValue}" has been added to ${categoryName}.` });
                await fetchOptions();
                onChange(newValue.trim());
                setIsAddingNew(false);
                setNewValue('');
            }
        } catch (error: any) {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <Select
                value={value || ''}
                onValueChange={(val) => {
                    if (val === 'ADD_NEW_MASTER_VALUE') {
                        setIsAddingNew(true);
                    } else {
                        onChange(val);
                    }
                }}
                disabled={disabled || loading}
            >
                <FormControl>
                    <SelectTrigger className="h-10 border bg-white rounded-md shadow-sm text-sm">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-blue-600" /> : <SelectValue placeholder={placeholder} />}
                    </SelectTrigger>
                </FormControl>
                <SelectContent className="rounded-md border shadow-lg bg-white">
                    {options.map(opt => <SelectItem key={opt} value={opt} className="rounded-sm py-2 text-sm">{opt}</SelectItem>)}
                    <Separator className="my-1" />
                    <SelectItem value="ADD_NEW_MASTER_VALUE" className="text-blue-600 focus:bg-blue-50 focus:text-blue-700 py-2 cursor-pointer font-medium text-sm">
                        <PlusCircle className="h-4 w-4 mr-2 inline-block" />
                        New {categoryName === 'Countries' ? 'Country' : categoryName.slice(0, -1)}
                    </SelectItem>
                </SelectContent>
            </Select>

            {isAddingNew && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200 mt-2 shadow-inner">
                    <Input
                        placeholder={`New ${categoryName === 'Countries' ? 'Country' : categoryName.slice(0, -1)} Name`}
                        value={newValue}
                        onChange={e => setNewValue(e.target.value)}
                        className="h-9 bg-white border-gray-300 shadow-sm focus-visible:ring-blue-500 text-sm"
                        autoFocus
                    />
                    <Button
                        size="sm"
                        onClick={handleAddNew}
                        disabled={isSaving || !newValue.trim()}
                        className="rounded-md bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 text-xs font-semibold"
                    >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setIsAddingNew(false); setNewValue(''); }}
                        className="rounded-md h-9 text-xs font-semibold text-gray-500 hover:text-red-600"
                    >
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    );
};

/**
 * SmartField: Renders a form field with optional conditional toggle for "If Available" fields.
 *
 * Toggle key convention: `${name}_isAvailable` (stored as a sibling key in the same form namespace)
 * - "Mandatory" / "Optional": always renders the input
 * - "If Available": renders a labelled Switch; only shows input when Switch is ON;
 *   clears field value when Switch is turned OFF
 */
const SmartField = ({ field, name }: { field: FieldDefinitionData, name: string }) => {
    const { control, setValue, watch } = useFormContext<Profile>();

    const isIfAvailable = field.requirement === 'If Available';
    // Unique toggle key: sibling of the actual field path
    const toggleKey = `${name}_isAvailable` as any;
    const isAvailable = watch(toggleKey);

    // When toggle turns OFF → clear the field value
    const handleToggleChange = (checked: boolean) => {
        setValue(toggleKey, checked, { shouldDirty: true });
        if (!checked) {
            // Clear the field's value so no stale data is submitted
            setValue(name as any, '' as any, { shouldDirty: true, shouldValidate: false });
        }
    };

    const renderInput = (formField: any) => {
        switch (field.inputType) {
            case 'Textarea':
                return <Textarea placeholder={`Enter ${field.fieldName}`} {...formField} value={formField.value || ''} className="min-h-[120px] resize-none border bg-white rounded-md text-sm focus-visible:ring-blue-500 shadow-sm" />;
            case 'Dropdown':
                if (field.fieldName.toLowerCase() === 'country') {
                    return (
                        <CreatableMasterSelect
                            categoryName="Countries"
                            value={formField.value}
                            onChange={formField.onChange}
                            placeholder={`Select Country`}
                        />
                    );
                }
                return (
                    <Select onValueChange={formField.onChange} value={formField.value || ''}>
                        <FormControl><SelectTrigger className="h-10 border bg-white rounded-md shadow-sm text-sm"><SelectValue placeholder={`Select ${field.fieldName}`} /></SelectTrigger></FormControl>
                        <SelectContent>
                            {(field.options || []).map(opt => <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                );
            case 'Checkbox':
                return (
                    <div className="space-y-2 py-2">
                        {(field.options || []).length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {(field.options || []).map(opt => (
                                    <div key={opt} className="flex items-center space-x-2 bg-gray-50/50 p-2.5 rounded-md border border-gray-100 hover:bg-gray-100 transition-colors">
                                        <Checkbox
                                            id={`${name}-${opt}`}
                                            className="h-4 w-4 rounded border-gray-300"
                                            checked={(formField.value || []).includes(opt)}
                                            onCheckedChange={(checked) => {
                                                const current = formField.value || [];
                                                formField.onChange(checked ? [...current, opt] : current.filter((v: string) => v !== opt));
                                            }}
                                        />
                                        <Label htmlFor={`${name}-${opt}`} className="text-xs cursor-pointer font-medium text-gray-700">{opt}</Label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <Checkbox id={name} checked={formField.value === true} onCheckedChange={formField.onChange} />
                                <Label htmlFor={name} className="text-sm cursor-pointer">{field.fieldName}</Label>
                            </div>
                        )}
                    </div>
                );
            case 'Radio':
                return (
                    <RadioGroup onValueChange={formField.onChange} value={formField.value || ''} className="grid grid-cols-2 gap-3 py-1">
                        {(field.options || []).map(opt => (
                            <div key={opt} className="flex items-center space-x-2 bg-gray-50/50 p-2.5 rounded-md border border-gray-100 hover:bg-gray-100 transition-colors">
                                <RadioGroupItem value={opt} id={`${name}-${opt}`} className="h-4 w-4 border-gray-300 text-blue-600" />
                                <Label htmlFor={`${name}-${opt}`} className="text-xs cursor-pointer font-medium text-gray-700">{opt}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                );
            case 'FileUpload':
                return (
                    <div className="group relative border border-dashed rounded-md p-6 bg-gray-50/50 hover:bg-blue-50/30 hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-2">
                        <div className="p-2.5 bg-white border rounded-full text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                            <CloudUpload className="h-5 w-5" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-semibold text-gray-700">Click to upload or drag and drop</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">PDF, PNG, JPG (max 5MB)</p>
                        </div>
                        <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                            console.log("File selected:", e.target.files?.[0]);
                        }} />
                    </div>
                );
            default:
                if (field.fieldType === 'Phone' || field.isCountryCodeEnabled || field.fieldName?.toLowerCase().includes('mobile')) {
                    return (
                        <PhoneMultiInput
                            value={formField.value}
                            onChange={formField.onChange}
                            fieldName={name}
                        />
                    );
                }
                return (
                    <Input
                        placeholder={`Enter ${field.fieldName}`}
                        {...formField}
                        value={formField.value || ''}
                        maxLength={field.maxLength || 255}
                        onChange={(e) => {
                            let val = e.target.value;
                            if (field.fieldType === 'Number') {
                                formField.onChange(val.replace(/\D/g, ''));
                            } else {
                                formField.onChange(val);
                            }
                        }}
                        className="h-10 border bg-white rounded-md shadow-sm focus-visible:ring-blue-500"
                    />
                );
        }
    };

    return (
        <div className="space-y-3">
            {/* Toggle row — only rendered for "If Available" fields */}
            {isIfAvailable && (
                <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gray-50/70 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-semibold text-gray-800 uppercase tracking-wide truncate">
                            {field.fieldName}
                        </span>
                        <span className="text-[11px] text-gray-500 leading-snug">
                            {field.availableQuestion || `Do you have ${field.fieldName}?`}
                        </span>
                    </div>
                    <FormField
                        control={control}
                        name={toggleKey}
                        render={({ field: switchField }) => (
                            <Switch
                                id={`toggle-${name}`}
                                checked={!!switchField.value}
                                onCheckedChange={(checked) => {
                                    switchField.onChange(checked);
                                    handleToggleChange(checked);
                                }}
                                className="shrink-0 data-[state=checked]:bg-blue-600"
                            />
                        )}
                    />
                </div>
            )}

            {/* Actual input — always for Mandatory/Optional, only when toggle is ON for "If Available" */}
            {(!isIfAvailable || isAvailable) && (
                <FormField
                    control={control}
                    name={name as any}
                    render={({ field: inputField }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">
                                {field.fieldName}
                                {field.requirement === 'Mandatory' && <span className="text-red-500 ml-0.5">*</span>}
                                {field.requirement === 'Optional' && (
                                    <span className="ml-1.5 text-[10px] font-normal text-gray-400 normal-case">(optional)</span>
                                )}
                            </FormLabel>
                            <FormControl>
                                {renderInput(inputField)}
                            </FormControl>
                            <FormMessage className="text-xs text-red-500" />
                        </FormItem>
                    )}
                />
            )}
        </div>
    );
};

/**
 * RHFSectionRenderer: RHF-native replacement for DynamicSectionRenderer inside the profile form.
 * Renders each section's fields as SmartField components connected to `fields.${fieldKey}`.
 * Supports "If Available" toggle, Mandatory/Optional validation — all via useFormContext.
 */
const RHFSectionRenderer: React.FC<{ sections: SectionData[] }> = ({ sections }) => {
    const { watch, setValue, control } = useFormContext<Profile>();
    const gstApplicable = watch('fields.gst_applicable');

    useEffect(() => {
        if (gstApplicable === false) {
            setValue('fields.gstin', '', { shouldDirty: true });
            setValue('fields.gstin_isAvailable', false, { shouldDirty: true });
        }
    }, [gstApplicable, setValue]);

    if (!sections || sections.length === 0) return null;
    return (
        <div className="space-y-10">
            {sections.map((section) => (
                <div key={section.sectionKey} className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <h6 className="text-sm font-black text-slate-700 uppercase tracking-widest">{section.sectionName}</h6>
                    </div>
                    <div className="grid md:grid-cols-2 gap-x-6 gap-y-5">
                        {[...(section.fields || [])]
                            .sort((a, b) => (a.requirement === 'If Available' ? 1 : 0) - (b.requirement === 'If Available' ? 1 : 0))
                            .map((field) => {
                                if (field.fieldKey === 'gstin') {
                                    return (
                                        <React.Fragment key="gst_wrapper">
                                            <FormField
                                                control={control}
                                                name="fields.gst_applicable"
                                                render={({ field: gstField }) => (
                                                    <FormItem className="flex flex-row items-center justify-between rounded-xl border p-5 bg-slate-50 border-slate-200 transition-all shadow-sm h-[86px]">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 text-slate-900">
                                                                <FormLabel className="text-xs font-black uppercase tracking-widest mb-0 cursor-pointer">GST Applicable?</FormLabel>
                                                            </div>
                                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tight max-w-md">
                                                                Enable if GST is applicable
                                                            </p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={gstField.value || false}
                                                                onCheckedChange={gstField.onChange}
                                                                className="data-[state=checked]:bg-slate-900 scale-90"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            {gstApplicable && (
                                                <SmartField
                                                    key={field.fieldKey}
                                                    field={{ ...field, requirement: 'Mandatory' }}
                                                    name={`fields.${field.fieldKey}` as any}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                }
                                return (
                                    <SmartField
                                        key={field.fieldKey}
                                        field={field}
                                        name={`fields.${field.fieldKey}` as any}
                                    />
                                );
                            })}
                    </div>
                </div>
            ))}
        </div>
    );
};

type Issue = { message: string; type: 'error' | 'warning' };
const listPendingMandatoryIssues = (
    data: Profile,
    constitution: BusinessTypeSetup | null | undefined
): Issue[] => {
    const issues: Issue[] = [];
    if (!constitution) {
        if (!data.constitutionId) issues.push({ message: 'Select a business constitution', type: 'error' });
        return issues;
    }

    if (isValueBlank(data.profileName)) issues.push({ message: 'Profile Name is required', type: 'error' });
    if (isValueBlank(data.constitutionId)) issues.push({ message: 'Business Constitution is required', type: 'error' });

    const hasAnyMembers = Object.values(data.roles || {}).some((role: any) => role.members && role.members.length > 0);

    if (hasAnyMembers) {
        if (!data.signatories || data.signatories.length === 0) {
            issues.push({ message: 'Signatory Management: At least one member must be selected as a signatory.', type: 'error' });
        }
        if (!data.primarySignatories || Object.values(data.primarySignatories).filter(Boolean).length === 0) {
            issues.push({ message: 'Signatory Management: At least one role must have a primary signatory selected.', type: 'error' });
        }
    }

    for (const section of constitution.requiredSections || []) {
        for (const f of section.fields || []) {
            if (f.requirement === 'Mandatory' && isValueBlank(data.fields?.[f.fieldKey])) {
                issues.push({ message: `${section.sectionName} → ${f.fieldName}`, type: 'error' });
            }
        }
    }

    for (const role of constitution.roles || []) {
        const members = data.roles?.[role.roleKey]?.members || [];

        // minMembers shown as warning only — NEVER blocks save
        if (role.minMembers > 0 && members.length < role.minMembers) {
            issues.push({
                message: `Role "${role.roleName}": at least ${role.minMembers} member(s) recommended (currently ${members.length})`,
                type: 'warning'
            });
        }

        if (members.length > 0) {
            members.forEach((member: any, idx: number) => {
                for (const section of role.requiredDetails || []) {
                    for (const df of section.fields || []) {
                        if (df.requirement === 'Mandatory' && isValueBlank(member?.details?.[df.fieldKey])) {
                            issues.push({ message: `Role "${role.roleName}" → Member ${idx + 1}: ${section.sectionName} → ${df.fieldName}`, type: 'error' });
                        }
                    }
                }
                if ((role.designations?.length || 0) > 0 && isValueBlank(member?.details?.designation)) {
                    issues.push({ message: `Role "${role.roleName}" → Member ${idx + 1}: Designation`, type: 'error' });
                }
            });
        }
    }

    // Stakeholder requirement is warning-only — does not block save
    const needsStakeholder = (constitution.requiredSections || []).some(s => SECTION_REQUIREMENTS[s.sectionKey]?.requiresStakeholder);
    if (needsStakeholder) {
        const stakeholders = data.roles?.['stakeholders']?.members || [];
        if (stakeholders.length === 0) {
            issues.push({
                message: 'Stakeholder role: at least one stakeholder is recommended for this configuration.',
                type: 'warning'
            });
        }
    }

    return issues;
};

// Helper to recursively get error messages
const getErrorMessages = (obj: any): string[] => {
    if (!obj) return [];
    if (typeof obj === 'object') {
        if (obj.message && typeof obj.message === 'string') {
            return [obj.message];
        }
        return Object.values(obj).flatMap(getErrorMessages);
    }
    return [];
};


interface ProfileFormProps {
    existingProfile?: Profile;
    onCancel: () => void;
    onSuccess?: () => void;
    formMode?: 'edit' | 'view';
}

const ProfileFormWrapper: React.FC<ProfileFormProps> = ({ existingProfile, onCancel, onSuccess, formMode }) => {
    const { constitutions, loading: constitutionsLoading } = useBusinessConstitutions();

    const [constitutionId, setConstitutionId] = useState(
        existingProfile?.constitutionId || ''
    );

    const [primaryType, setPrimaryType] = useState(
        existingProfile?.constitutionId
            ? constitutions.find(c => String(c.id) === String(existingProfile.constitutionId))?.businessType || ''
            : ''
    );

    useEffect(() => {
        // We no longer auto-set constitutions[0].id here to prevent infinite loop 
        // and allow for the Case 2/3 manual selection logic in InnerForm.
    }, [constitutions, constitutionId, constitutionsLoading]);


    if (constitutionsLoading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <InnerForm
            key={existingProfile?.id || 'new-profile'}
            existingProfile={existingProfile}
            onCancel={onCancel}
            onSuccess={onSuccess}
            formMode={formMode}
            constitutions={constitutions}
            selectedConstitutionId={constitutionId}
            onConstitutionChange={setConstitutionId}
            selectedPrimaryType={primaryType}
            onPrimaryTypeChange={setPrimaryType}
        />
    );
};

interface InnerFormProps {
    existingProfile?: Profile;
    onCancel: () => void;
    onSuccess?: () => void;
    formMode?: 'edit' | 'view';
    constitutions: BusinessTypeSetup[];
    selectedConstitutionId: string;
    onConstitutionChange: (id: string) => void;
    selectedPrimaryType: string;
    onPrimaryTypeChange: (type: string) => void;
}


const InnerForm: React.FC<InnerFormProps> = ({
    existingProfile, onCancel, onSuccess, formMode, constitutions,
    selectedConstitutionId, onConstitutionChange,
    selectedPrimaryType, onPrimaryTypeChange
}) => {
    const { profiles, addProfile, updateProfile, setDefaultProfile, loading: isSaving } = useProfiles();
    const { toast } = useToast();

    type ProfileFormValues = Profile & { primaryConstitution?: string };

    const selectedConstitution = useMemo(() =>
        constitutions.find(c => c.id === selectedConstitutionId),
        [constitutions, selectedConstitutionId]
    );

    const primaryTypes = useMemo(() => {
        const types: string[] = [];
        constitutions.forEach(c => {
            if (!types.includes(c.businessType)) {
                types.push(c.businessType);
            }
        });
        return types;
    }, [constitutions]);

    const formSchema = useMemo(() => generateSchema(selectedConstitution), [selectedConstitution]);

    const freshDefaults = useMemo(() => {
        const defaults: Partial<ProfileFormValues> = existingProfile && existingProfile.constitutionId === selectedConstitutionId
            ? {
                ...existingProfile,
                primaryConstitution: selectedConstitution?.businessType || '',
                constitutionId: selectedConstitutionId,
                isDefault: existingProfile.isDefault || false,
                signatories: existingProfile.signatories || [],
                primarySignatories: existingProfile.primarySignatories || {},
            }
            : {
                profileName: existingProfile?.profileName || '',
                primaryConstitution: selectedPrimaryType || selectedConstitution?.businessType || '',
                constitutionId: selectedConstitutionId,
                fields: {},
                roles: {},
                isDefault: existingProfile?.isDefault || false,
                signatories: [],
                primarySignatories: {},
            };

        const newRoles: Record<string, any> = {};
        if (selectedConstitution?.roles) {
            selectedConstitution.roles.forEach(role => {
                const existingMembers = (existingProfile?.constitutionId === selectedConstitutionId ? existingProfile?.roles?.[role.roleKey]?.members : []) || [];

                const formattedMembers = existingMembers.map((member: any) => {
                    const memberDetails: Record<string, any> = {};
                    role.requiredDetails.forEach((section: any) => {
                        (section.fields || []).forEach((detailField: any) => {
                            const val = member.details?.[detailField.fieldKey] ?? '';
                            memberDetails[detailField.fieldKey] = val;
                            if (detailField.requirement === 'If Available') {
                                const availKey = `${detailField.fieldKey}_isAvailable`;
                                memberDetails[availKey] = member.details?.[availKey] ?? false;
                            }
                        });
                    });
                    if (role.designations?.length) {
                        memberDetails['designation'] = member.details?.designation ?? '';
                    }
                    return { _id: member._id ?? crypto.randomUUID(), details: memberDetails, isSaved: true };
                });

                newRoles[role.roleKey] = { members: formattedMembers };
            });
        }
        defaults.roles = newRoles;

        const newFields: Record<string, any> = {};
        if (selectedConstitution?.requiredSections) {
            selectedConstitution.requiredSections.forEach(section => {
                (section.fields || []).forEach(field => {
                    const val = (existingProfile?.constitutionId === selectedConstitutionId ? existingProfile?.fields?.[field.fieldKey] : '') ?? '';
                    newFields[field.fieldKey] = val;
                    if (field.requirement === 'If Available') {
                        const availKey = `${field.fieldKey}_isAvailable`;
                        newFields[availKey] = (existingProfile?.constitutionId === selectedConstitutionId ? existingProfile?.fields?.[availKey] : false) ?? false;
                    }
                });
            });
            // Ensure gst_applicable is set in fields
            const isSameConst = existingProfile?.constitutionId === selectedConstitutionId;
            const existingFields = existingProfile?.fields || {};
            let defaultGstApplicable = false;
            if (isSameConst) {
                if (typeof existingFields.gst_applicable === 'boolean') {
                    defaultGstApplicable = existingFields.gst_applicable;
                } else if (existingFields.gstin_isAvailable === false) {
                    defaultGstApplicable = false;
                } else {
                    defaultGstApplicable = !!(existingFields.gstin || existingFields.gstin_isAvailable);
                }
            }
            newFields.gst_applicable = defaultGstApplicable;
        }
        defaults.fields = newFields;

        return defaults;
    }, [existingProfile, selectedConstitution, selectedConstitutionId, selectedPrimaryType]);

    const methods = useForm<ProfileFormValues>({
        resolver: zodResolver(formSchema as any),
        defaultValues: freshDefaults,
        mode: "onChange"
    });

    const { control, handleSubmit, trigger, getValues, setValue, watch, reset, formState: { errors } } = methods;

    // Effect to rebuild dynamic fields/roles when constitution changes, while PRESERVING profileName
    useEffect(() => {
        const current = getValues();
        if (current.constitutionId === selectedConstitutionId) return; // No real change

        reset({
            ...current,   // preserve all existing values
            constitutionId: selectedConstitutionId
        });
    }, [selectedConstitutionId, freshDefaults, getValues, reset, existingProfile]);

    const [showDefaultConfirm, setShowDefaultConfirm] = useState(false);

    const handleDefaultToggle = (checked: boolean) => {
        if (!checked) {
            setValue('isDefault', false);
            return;
        }

        const currentDefault = profiles.find(p => p.isDefault && p.id !== existingProfile?.id);
        if (currentDefault) {
            setShowDefaultConfirm(true);
        } else {
            setValue('isDefault', true);
        }
    };

    const confirmDefaultChange = () => {
        setValue('isDefault', true);
        setShowDefaultConfirm(false);
    };

    const watchedValues = useWatch({ control });
    const watchPrimary = watch('primaryConstitution');

    const availableSubTypes = useMemo(() => {
        if (!watchPrimary) return [];
        return constitutions.filter(c => c.businessType === watchPrimary);
    }, [constitutions, watchPrimary]);

    const handlePrimaryTypeChange = (val: string) => {
        onPrimaryTypeChange(val);

        if (!val) {
            setValue('constitutionId', '', { shouldValidate: true });
            onConstitutionChange('');
            return;
        }

        const subTypes = constitutions.filter(c => c.businessType === val);

        if (subTypes.length === 1) {
            const targetId = subTypes[0].id;
            setValue('constitutionId', targetId, { shouldValidate: true });
            onConstitutionChange(targetId);
        } else {
            setValue('constitutionId', '', { shouldValidate: true });
            onConstitutionChange('');
        }
        // profileName is intentionally NOT touched here
    };

    const allPendingIssues = useMemo(() => {
        const completenessIssues = listPendingMandatoryIssues(getValues() as Profile, selectedConstitution);
        const validationErrorMessages = getErrorMessages(errors).map(msg => ({ message: msg, type: 'error' as const }));

        // Simple deduplication
        const messageSet = new Set<string>();
        const combined: Issue[] = [];
        [...validationErrorMessages, ...completenessIssues].forEach(issue => {
            if (!messageSet.has(issue.message)) {
                messageSet.add(issue.message);
                combined.push(issue);
            }
        });

        return combined;
    }, [errors, selectedConstitution, getValues]);

    const criticalErrors = useMemo(() => allPendingIssues.filter(i => i.type === 'error'), [allPendingIssues]);
    const warnings = useMemo(() => allPendingIssues.filter(i => i.type === 'warning'), [allPendingIssues]);

    const isSaveDisabled = isSaving;

    const onSubmit = async (data: Profile) => {
        const isValid = await trigger();

        console.log("===============================");
        console.log("SUBMIT TRIGGERED");
        console.log("FORM VALID:", isValid);
        console.log("FORM DATA:", data);
        console.log("FORM ERRORS:", errors);
        console.log("===============================");

        if (!isValid) {
            // Check if any CRITICAL mandatory field has an error — block save if so
            const currentErrors = methods.formState.errors;
            const hasCriticalError = !!(
                currentErrors.profileName ||
                currentErrors.constitutionId ||
                (currentErrors.fields && Object.keys(currentErrors.fields).length > 0)
            );

            if (hasCriticalError) {
                toast({
                    title: "Required Fields Missing",
                    description: "Please fill in all required fields (Profile Name, Email, Mobile, etc.) before saving.",
                    variant: "destructive"
                });
                return; // BLOCK save for critical fields
            }

            // Non-critical (roles, signatories) — allow partial save with warning
            toast({
                title: "Partially Configured",
                description: "Profile saved. Roles and signatories can be completed later.",
                variant: "default"
            });
        }

        console.log("SENDING DATA TO BACKEND:", data);
        try {
            if (existingProfile) {
                console.log("UPDATING EXISTING PROFILE:", existingProfile.id);
                console.log("UPDATING EXISTING PROFILE:", existingProfile.id);
                // 0. Normalize all members in all roles to ensure name/displayName/full_name consistency
                if (data.roles) {
                    Object.entries(data.roles).forEach(([roleKey, roleValue]: [string, { members?: any[] } | any]) => {
                        if (roleValue?.members && Array.isArray(roleValue.members)) {
                            const roleDef = selectedConstitution?.roles?.find(r => r.roleKey === roleKey);
                            roleValue.members = roleValue.members.map((member: any, index: number) => 
                                normalizeMemberForSave(member, roleDef?.roleName || roleKey, index)
                            );
                        }
                    });
                }
                await updateProfile(existingProfile.id, data);
                if (data.isDefault) {
                    console.log("SETTING AS DEFAULT PROFILE");
                    await setDefaultProfile(existingProfile.id);
                }
                console.log("UPDATE SUCCESSFUL");
            } else {
                const isFirstProfile = profiles.length === 0;
                console.log("ADDING NEW PROFILE. isFirstProfile:", isFirstProfile);
                if (isFirstProfile || data.isDefault) {
                    data.isDefault = true;
                }
                // 0. Normalize all members in all roles to ensure name/displayName/full_name consistency
                if (data.roles) {
                    Object.entries(data.roles).forEach(([roleKey, roleValue]: [string, { members?: any[] } | any]) => {
                        if (roleValue?.members && Array.isArray(roleValue.members)) {
                            const roleDef = selectedConstitution?.roles?.find(r => r.roleKey === roleKey);
                            roleValue.members = roleValue.members.map((member: any, index: number) => 
                                normalizeMemberForSave(member, roleDef?.roleName || roleKey, index)
                            );
                        }
                    });
                }

                await addProfile(data, isFirstProfile);
                console.log("ADD SUCCESSFUL");
            }
            if (onSuccess) {
                console.log("CALLING onSuccess()");
                onSuccess();
            } else {
                console.log("CALLING onCancel() (default fallback)");
                onCancel();
            }
        } catch (e: any) {
            console.error("!!! SAVE FAILED WITH ERROR !!!");
            console.error(e);
            console.error("Error Message:", e?.message);
            if (e?.response) {
                console.error("Error Response Data:", e.response.data);
            }
            toast({ title: "Save Error", description: "Could not save profile.", variant: "destructive" });
        }
    };

    // --- Helper for Dynamic Tab Grouping ---
    interface GroupedStructure {
        label: string;
        sections: SectionData[];
        subTabs?: {
            [key: string]: {
                label: string;
                sections: SectionData[];
            }
        };
        order: number;
    }

    const formatLabel = useCallback((str: string) => {
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (s) => s.toUpperCase())
            .replace(/_/g, ' ')
            .trim();
    }, []);

    const groupSections = useCallback((sections: SectionData[], roles: Role[] = []): { [key: string]: GroupedStructure } => {
        const mainTabs: { [key: string]: GroupedStructure } = {};

        const categoryFirstSeen: Record<string, number> = {};

        // 1. Process regular sections and track their first appearance order
        (selectedConstitution?.requiredSections || []).forEach((section, index) => {
            const key = section.sectionKey.toLowerCase();
            let categoryKey = 'general';
            let categoryLabel = 'Additional Details';

            if (section.fields?.some((f: any) => f.category === 'core' || f.group === 'core') || key.includes('core')) {
                categoryKey = 'core';
                categoryLabel = 'Core Information';
            } else if (key.includes('address')) {
                categoryKey = 'address';
                categoryLabel = 'Address Details';
            } else if (key.includes('contact')) {
                categoryKey = 'contact';
                categoryLabel = 'Contact Details';
            } else if (key.includes('business')) {
                categoryKey = 'business';
                categoryLabel = 'Business Information';
            }

            // Track first appearance to preserve constitution's order
            if (categoryFirstSeen[categoryKey] === undefined) {
                categoryFirstSeen[categoryKey] = index;
            }

            if (!mainTabs[categoryKey]) {
                mainTabs[categoryKey] = { label: categoryLabel, sections: [], order: categoryFirstSeen[categoryKey] };
            }
            mainTabs[categoryKey].sections.push(section);
        });

        // 2. Process Roles into the Roles tab
        if (roles && roles.length > 0) {
            const roleKey = 'roles';
            if (!mainTabs[roleKey]) {
                // Roles always comes last (using 999 to guarantee position)
                mainTabs[roleKey] = { label: 'Roles', sections: [], subTabs: {}, order: 999 };
            }

            roles.forEach(role => {
                const subKey = `role_${role.roleKey || (role as any).id}`;
                mainTabs[roleKey].subTabs![subKey] = {
                    label: role.roleName,
                    sections: [],
                    roleData: role
                } as any;
            });
        }

        return mainTabs;
    }, [formatLabel]);


    const groupedData = useMemo(() => {
        if (!selectedConstitution?.requiredSections) return {};
        return groupSections(selectedConstitution.requiredSections, selectedConstitution.roles || []);
    }, [selectedConstitution, groupSections]);

    const calculatedActiveTab = useMemo(() => {
        const sorted = Object.entries(groupedData).sort(([, a], [, b]) => a.order - b.order);
        return sorted.length > 0 ? sorted[0][0] : null;
    }, [groupedData]);

    const [currentTab, setCurrentTab] = useState<string | null>(null);

    useEffect(() => {
        if (!currentTab && calculatedActiveTab) {
            setCurrentTab(calculatedActiveTab);
        }
    }, [calculatedActiveTab, currentTab]);

    const handleGoToRolesTab = () => {
        setCurrentTab('roles');
    };

    const StakeholderWarning = () => (
        <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
            <Users className="h-10 w-10 text-gray-300 mb-4" />
            <h4 className="text-sm font-semibold text-gray-500">Stakeholder Required</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-[280px] mx-auto">This section requires information from stakeholders. Please ensure at least one stakeholder is registered.</p>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGoToRolesTab}
                className="mt-4 border-blue-200 text-blue-600 hover:bg-blue-50 h-8 text-xs"
            >
                Add Stakeholder
            </Button>
        </div>
    );

    const [topLevelTab, setTopLevelTab] = useState<'details' | 'branding'>('details');

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues() as Profile))} className="h-[90vh] flex flex-col bg-background relative overflow-hidden">
                <fieldset disabled={formMode === 'view'} className="contents">
                {/* Sticky Header */}
                <div className="bg-white sticky top-0 z-40 border-b px-6 py-4 flex items-center justify-between border-slate-200 shadow-sm backdrop-blur-md">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                            {existingProfile && <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold bg-slate-900 text-white border-transparent uppercase tracking-wider">Draft</Badge>}
                        </div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">
                            {existingProfile ? 'Update Profile' : 'New Profile'}
                        </h2>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                            {selectedConstitution?.name || 'Standard Setup'}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onCancel}
                        className="h-10 w-10 text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm rounded-lg transition-all"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </div>

                <div className="bg-white px-6 border-b border-slate-200 sticky z-30" style={{ top: '73px' }}>
                    <Tabs value={topLevelTab} onValueChange={(val: any) => setTopLevelTab(val)} className="w-full">
                        <TabsList className="bg-transparent h-12 w-full justify-start rounded-none border-b-0 p-0 gap-6">
                            <TabsTrigger 
                                value="details" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-700 font-semibold text-sm h-full px-1"
                            >
                                Profile Details
                            </TabsTrigger>
                            <TabsTrigger 
                                value="branding" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-700 font-semibold text-sm h-full px-1"
                            >
                                Branding
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {topLevelTab === 'details' && (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10">
                    <OrphanedDataHandler constitution={selectedConstitution} />

                    {/* Section 1: Core Selection */}
                    <div className="space-y-6">
                        <div className="border-b pb-4 border-slate-200">
                            <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">01. Basic Details</h3>
                            <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Provide the primary organizational parameters.</p>
                        </div>

                        <Card className="rounded-lg border bg-white shadow-sm overflow-hidden">
                            <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                                <FormField control={control} name="profileName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black text-slate-700 uppercase tracking-widest">Profile Name</FormLabel>
                                        <FormControl><Input placeholder="e.g. Main Branch Office" {...field} value={field.value || ''} className="h-10 border-slate-300 focus-visible:ring-slate-900 rounded-lg shadow-sm" /></FormControl>
                                        <FormMessage className="text-[10px] font-medium text-slate-400 uppercase mt-1" />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={control} name="primaryConstitution" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black text-slate-700 uppercase tracking-widest">Primary Constitution</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    handlePrimaryTypeChange(val);
                                                }}
                                            >
                                                <FormControl><SelectTrigger className="h-10 border-gray-300 rounded-lg"><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {primaryTypes.map(t => <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />

                                    <FormField control={control} name="constitutionId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black text-slate-700 uppercase tracking-widest">Sub Type</FormLabel>
                                            <Select
                                                disabled={!watchPrimary || availableSubTypes.length === 0}
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    onConstitutionChange(val);
                                                }}
                                                value={field.value || ''}
                                            >
                                                <FormControl><SelectTrigger className="h-10 border-gray-300 rounded-lg"><SelectValue placeholder="Select Sub Type" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {availableSubTypes.map(c => (
                                                        <SelectItem key={c.id} value={c.id} className="text-sm">
                                                            {c.businessSubType}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px] font-medium text-slate-400 uppercase mt-1" />
                                        </FormItem>
                                    )} />
                                </div>

                                <FormField
                                    control={control}
                                    name="isDefault"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-xl border p-5 bg-slate-50 col-span-full border-slate-200 transition-all hover:bg-slate-100/50 shadow-sm">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-slate-900">
                                                    <Shield className="h-4 w-4" />
                                                    <FormLabel className="text-xs font-black uppercase tracking-widest mb-0 cursor-pointer">Set as Default Profile</FormLabel>
                                                </div>
                                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tight max-w-md">
                                                    Primary identity for all system operations.
                                                </p>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value || false}
                                                    onCheckedChange={handleDefaultToggle}
                                                    className="data-[state=checked]:bg-slate-900 scale-90"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />


                            </CardContent>
                        </Card>
                    </div>

                    {/* Section 2: Dynamic configuration */}
                    {Object.keys(groupedData).length > 0 && (
                        <div className="space-y-8">
                            <div className="border-b pb-4 border-slate-200">
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">02. Additional Details</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Specialized parameters based on the framework.</p>
                            </div>

                            <Tabs value={currentTab || ''} onValueChange={setCurrentTab} className="w-full">
                                <div className="z-20 bg-white pb-8">
                                    <TabsList className="bg-slate-100 p-1 rounded-xl flex flex-wrap justify-start gap-1 h-auto border border-slate-200 shadow-inner">
                                        {Object.entries(groupedData)
                                            .sort(([, a], [, b]) => a.order - b.order)
                                            .map(([key, tab]) => (
                                                <TabsTrigger
                                                    key={key}
                                                    value={key}
                                                    className="rounded-lg h-10 px-6 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all border border-transparent data-[state=active]:border-slate-200"
                                                >
                                                    {tab.label}
                                                </TabsTrigger>
                                            ))}
                                    </TabsList>
                                </div>

                                {Object.entries(groupedData).map(([tabKey, tabData]) => (
                                    <TabsContent key={tabKey} value={tabKey} className="space-y-6 focus-visible:outline-none">
                                        {tabData.subTabs ? (
                                            <div className="space-y-8">
                                                {Object.entries(tabData.subTabs).map(([subKey, subTab]: [string, any]) => (
                                                    <div key={subKey} className="space-y-4 focus-visible:outline-none">
                                                        {tabKey !== 'roles' && (
                                                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-4">
                                                                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">{subTab.label}</h4>
                                                            </div>
                                                        )}
                                                        {subTab.roleData ? (
                                                            <RoleSection
                                                                role={subTab.roleData}
                                                                allRoles={selectedConstitution?.roles || []}
                                                            />
                                                        ) : (
                                                            (() => {
                                                                const requiresStakeholder = subTab.sections?.some((s: SectionData) => SECTION_REQUIREMENTS[s.sectionKey]?.requiresStakeholder);
                                                                const stakeholders = watch('roles.stakeholders.members') || [];

                                                                if (requiresStakeholder && stakeholders.length === 0) {
                                                                    return <StakeholderWarning />;
                                                                }

                                                                return (
                                                                    <RHFSectionRenderer sections={subTab.sections} />
                                                                );
                                                            })()
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            (() => {
                                                const requiresStakeholder = tabData.sections?.some(s => SECTION_REQUIREMENTS[s.sectionKey]?.requiresStakeholder);
                                                const stakeholders = watch('roles.stakeholders.members') || [];

                                                if (requiresStakeholder && stakeholders.length === 0) {
                                                    return <StakeholderWarning />;
                                                }

                                                return (
                                                    <RHFSectionRenderer sections={tabData.sections} />
                                                );
                                            })()
                                        )}
                                        {tabKey === 'roles' && selectedConstitution?.roles && selectedConstitution.roles.length > 0 && (
                                            <div className="space-y-6 pt-12 mt-12 border-t border-slate-200">
                                                <div className="flex items-center gap-3 pb-6">
                                                    <div className="h-8 w-8 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                                                        <Shield className="h-4 w-4 text-white" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Authority Delegation</h3>
                                                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Assign authorized signatories and designate primary representatives.</p>
                                                    </div>
                                                </div>
                                                <GeneralSection allRoles={selectedConstitution?.roles || []} />
                                            </div>
                                        )}
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </div>
                    )}



                        </div>
                        
                        {/* Sticky Footer */}
                        <div className="bg-slate-50 sticky bottom-0 z-30 border-t px-6 py-4 flex items-center justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <Button type="button" variant="ghost" onClick={onCancel} className="h-11 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-red-300 hover:text-slate-900 transition-all">
                                {formMode === 'view' ? 'Close' : 'Discard Changes'}
                            </Button>
                            {formMode !== 'view' && (
                                <Button type="submit" disabled={isSaving} className="h-11 px-8 rounded-xl bg-blue-700 hover:bg-blue text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:bg-slate-400">
                                    {isSaving ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                                    ) : (
                                        <><CheckCircle className="mr-2 h-4 w-4" /> {existingProfile ? 'Update Profile' : 'Save Profile'}</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </>
                )}

                {topLevelTab === 'branding' && (
                    <div className="flex-1 overflow-y-auto bg-slate-50 relative p-6">
                        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                            {existingProfile ? (
                                <CompanyBrandingForm businessProfileId={existingProfile.id} isGlobal={false} />
                            ) : (
                                <div className="text-center py-12">
                                    <Palette className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-slate-900">Save Profile First</h3>
                                    <p className="text-sm text-slate-500 mt-1">Save the profile first to configure branding.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}


                <AlertDialog open={showDefaultConfirm} onOpenChange={setShowDefaultConfirm}>
                    <AlertDialogContent className="rounded-lg border shadow-lg">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-lg font-semibold text-gray-900">Change Default Profile?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-gray-500">
                                This will unset the current default profile. Do you want to continue?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="h-10 rounded-md border-gray-300 font-medium px-4">No, Keep current</AlertDialogCancel>
                            <AlertDialogAction
                                className="h-10 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium px-6"
                                onClick={confirmDefaultChange}
                            >
                                Yes, Proceed
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </fieldset>
            </form>
        </FormProvider>
    );
};


const RoleSection: React.FC<{ role: Role, allRoles: Role[] }> = ({ role, allRoles }) => {
    const { control, setValue, trigger, getValues, watch } = useFormContext<Profile>();
    const { toast } = useToast();
    const { fields, append, remove } = useFieldArray({
        control,
        name: `roles.${role.roleKey}.members`,
    });

    const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
    const currentProfileRoles = watch('roles');

    const uid = () =>
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);

    const addMember = () => {
        if (role.maxMembers > 0 && fields.length >= role.maxMembers) {
            toast({
                title: "Member Limit Reached",
                description: `You cannot add more than ${role.maxMembers} members to the "${role.roleName}" role.`,
                variant: "destructive"
            });
            return;
        }

        // Check if any existing member is unsaved
        const isAnyUnsaved = fields.some((m: any) => (m as { isSaved?: boolean }).isSaved === false);
        if (isAnyUnsaved) return;

        const newMember: Record<string, string> = {};
        let hasNameField = false;
        role.requiredDetails.forEach((section: any) => {
            (section.fields || []).forEach((field: any) => {
                newMember[field.fieldKey] = '';
            });
        });
        
        // Always ensure full_name exists for normalization
        newMember['full_name'] = '';
        
        if (role.designations?.length > 0) {
            newMember['designation'] = '';
        }
        append({ _id: uid(), details: newMember, isSaved: false } as any);
        setEditingMemberIndex(fields.length); // Edit the new member immediately
    };

    const saveMember = async (index: number) => {
        const member = getValues(`roles.${role.roleKey}.members.${index}`);
        const details = member.details || {};

        // Use the utility to get the display name
        const displayName = getMemberDisplayName(member, role.roleName, index);

        // Custom Validation Rules - Name is MANDATORY
        const hasRealName = displayName !== "Unnamed Member" && !displayName.includes(`${role.roleName} Member`);
        if (!hasRealName) {
            toast({ title: "Validation Error", description: "A valid member name is mandatory.", variant: "destructive" });
            return;
        }

        const isValid = await trigger(`roles.${role.roleKey}.members.${index}`);
        if (isValid) {
            const currentMembers = getValues(`roles.${role.roleKey}.members`);
            // Sync name and displayName to the member object root
            (currentMembers[index] as any).name = displayName;
            (currentMembers[index] as any).displayName = displayName;
            currentMembers[index].isSaved = true;
            setValue(`roles.${role.roleKey}.members`, currentMembers, { shouldDirty: true, shouldValidate: true });
            setEditingMemberIndex(null);
        } else {
            toast({ title: "Validation Error", description: `Please correct the errors for Member #${index + 1}.`, variant: "destructive" });
        }
    };

    const removeMemberAndClean = (index: number) => {
        const member = getValues(`roles.${role.roleKey}.members.${index}`);
        const memberId: string | undefined = member?._id;

        remove(index); // removes from the field array

        if (!memberId) return;

        // drop from signatories
        const sigs = getValues('signatories') || [];
        const nextSigs = sigs.filter(
            (s: { roleKey: string; memberId: string }) => !(s.roleKey === role.roleKey && s.memberId === memberId)
        );
        if (nextSigs.length !== sigs.length) {
            setValue('signatories', nextSigs, { shouldDirty: true, shouldValidate: true });
        }

        // unset primary for this role if pointing to the removed member
        if (getValues(`primarySignatories.${role.roleKey}`) === memberId) {
            setValue(`primarySignatories.${role.roleKey}`, undefined, { shouldDirty: true, shouldValidate: true });
        }
    };

    const copyMember = (indexToCopyTo: number, detailsToCopy: Record<string, any>) => {
        role.requiredDetails.forEach((section: any) => {
            (section.fields || []).forEach((field: any) => {
                setValue(`roles.${role.roleKey}.members.${indexToCopyTo}.details.${field.fieldKey}`, detailsToCopy[field.fieldKey] || '');
            });
        });
        if (role.designations?.length) {
            setValue(`roles.${role.roleKey}.members.${indexToCopyTo}.details.designation`, detailsToCopy.designation || '');
        }
        toast({ title: "Details Copied", description: "Member details have been copied." });
        trigger(`roles.${role.roleKey}.members.${indexToCopyTo}.details`);
    }

    const otherMembers = useMemo(() => {
        return allRoles
            .filter(r => r.roleKey !== role.roleKey)
            .flatMap(r =>
                (currentProfileRoles?.[r.roleKey]?.members || []).map((member: any, index: number) => ({
                    id: `${r.roleKey}-${index}`,
                    name: getMemberDisplayName(member, r.roleName, index),
                    details: member.details,
                }))
            ).filter((m: { name: string }) => m.name && m.name.trim() && m.name.trim() !== 'Unnamed Member' && !m.name.includes(' Member'));
    }, [allRoles, currentProfileRoles, role.roleKey]);

    const isAnyUnsaved = fields.some((m: any) => (m as { isSaved?: boolean }).isSaved === false);
    const isAddButtonDisabled = (role.maxMembers > 0 && fields.length >= role.maxMembers) || isAnyUnsaved;

    return (
        <Card className="rounded-lg border bg-white shadow-sm overflow-hidden">
            <CardHeader className="px-6 py-4 border-b bg-gray-50/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-gray-500" />
                        <div>
                            <CardTitle className="text-base font-semibold text-gray-900">{role.roleName}</CardTitle>
                            <CardDescription className="text-xs text-gray-500">
                                {role.minMembers} required • {role.maxMembers === 0 ? 'Unlimited' : `${role.maxMembers} max`}
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant="secondary" className="font-medium text-[10px] bg-gray-100 text-gray-600 border-gray-200">
                        {fields.length} Active
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {fields.length > 0 ? (
                    <div className="space-y-4">
                        {fields.map((member, index) => {
                            const memberDetails = getValues(`roles.${role.roleKey}.members.${index}.details`);
                            const isEditing = editingMemberIndex === index;

                            return (
                                <div key={member.id} className={`relative p-5 rounded-xl border transition-all ${isEditing ? 'border-slate-900 bg-white shadow-md z-10' : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-6 w-6 rounded-md flex items-center justify-center font-black text-[10px] ${isEditing ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                {index + 1}
                                            </div>
                                            <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded leading-none">
                                                {getMemberDisplayName(member, role.roleName, index)}
                                            </h5>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isEditing && (
                                                <Button type="button" variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                    onClick={() => {
                                                        const currentMembers = getValues(`roles.${role.roleKey}.members`);
                                                        currentMembers[index].isSaved = false;
                                                        setValue(`roles.${role.roleKey}.members`, currentMembers, { shouldDirty: true, shouldValidate: true });
                                                        setEditingMemberIndex(index);
                                                    }}
                                                >
                                                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                                                </Button>
                                            )}
                                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:text-black hover:bg-slate-100 rounded-lg" onClick={() => removeMemberAndClean(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <div className="space-y-8 animate-in fade-in duration-300">
                                            <div className="space-y-8">
                                                {(() => {
                                                    const hasNameInDetails = role.requiredDetails.some(s => s.fields?.some((f: { fieldKey: string }) => f.fieldKey.toLowerCase().includes('name')));
                                                    if (!hasNameInDetails) {
                                                        return (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                                                    <div className="h-4 w-1 bg-blue-600 rounded-full shadow-sm" />
                                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Identity Details</h3>
                                                                </div>
                                                                <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                                                                    <FormField
                                                                        control={control}
                                                                        name={`roles.${role.roleKey}.members.${index}.details.full_name`}
                                                                        render={({ field }) => (
                                                                            <FormItem className="col-end-2 flex flex-row items-center gap-3 space-y-0">
                                                                                <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap shrink-0 text-right m-0">Name</FormLabel>
                                                                                <div className="flex-1">
                                                                                    <FormControl>
                                                                                        <Input {...field} placeholder="Enter name" className="h-10 text-sm font-bold border-slate-300 focus:border-slate-900 focus:ring-slate-900 transition-all shadow-sm w-full" />
                                                                                    </FormControl>
                                                                                    <FormMessage className="text-[10px] uppercase font-medium text-slate-400 mt-1" />
                                                                                </div>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                {role.requiredDetails.map((section, sIdx) => (
                                                    <div key={section.sectionKey || `section-${sIdx}`} className="space-y-4">
                                                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-6">
                                                            <div className="h-4 w-1 bg-slate-400 rounded-full shadow-sm" />
                                                            <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">{section.sectionName}</h5>
                                                        </div>
                                                        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                                                            {[...(section.fields || [])]
                                                                .sort((a: any, b: any) => ((a as { requirement?: string }).requirement === 'If Available' ? 1 : 0) - ((b as { requirement?: string }).requirement === 'If Available' ? 1 : 0))
                                                                .map((field: FieldDefinitionData, idx: number) => (
                                                                    <SmartField key={field.fieldKey || `field-${idx}`} field={field} name={`roles.${role.roleKey}.members.${index}.details.${field.fieldKey}`} />
                                                                ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                {role.designations && role.designations.length > 0 && (
                                                    <FormField control={control} name={`roles.${role.roleKey}.members.${index}.details.designation`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-sm font-medium text-gray-700">Designation</FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-10 border-gray-300">
                                                                            <SelectValue placeholder="Select a designation" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {role.designations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select><FormMessage className="text-xs text-red-500" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-center gap-3 pt-8 border-t border-slate-100">
                                                <Button type="button" className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white rounded-lg h-10 px-6 text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95" onClick={() => saveMember(index)}>
                                                    <CheckCircle className="h-4 w-4 mr-2" /> Save Member
                                                </Button>
                                                {otherMembers.length > 0 && (
                                                    <div className="w-full sm:w-auto flex items-center gap-2">
                                                        <span className="hidden sm:inline text-xs text-gray-400 mx-1">or</span>
                                                        <Select onValueChange={(memberId) => {
                                                            const memberToCopy = otherMembers.find(m => m.id === memberId);
                                                            if (memberToCopy) copyMember(index, memberToCopy.details);
                                                        }}>
                                                            <SelectTrigger className="h-9 rounded-lg bg-white border-slate-200 text-xs font-medium min-w-[180px] shadow-xs">
                                                                <Copy className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                                                <SelectValue placeholder="Copy From Existing" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {otherMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 p-4 rounded-md bg-gray-50 border border-gray-100">
                                            {(() => {
                                                const memberDetails = member?.details || {};
                                                const entries = Object.entries(memberDetails).filter(([k, v]) => !k.endsWith('_isAvailable') && v);
                                                if (entries.length === 0) {
                                                    return (
                                                        <div className="col-span-full py-2 text-center">
                                                            <p className="text-[10px] font-medium text-gray-400 italic">No details provided yet.</p>
                                                        </div>
                                                    );
                                                }
                                                return entries.map(([key, value]) => (
                                                    <div key={key} className="space-y-0.5">
                                                        <span className="block text-[10px] font-medium text-gray-400 uppercase tracking-tight">{key.replace(/_/g, ' ')}</span>
                                                        <span className="block text-sm font-semibold text-gray-700 truncate">{String(value)}</span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <Users className="h-10 w-10 text-slate-300 mb-4" />
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">No Members Yet</h4>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight mt-1">Add members to this role to get started.</p>
                    </div>
                )}

                {!isAddButtonDisabled && (
                    <Button type="button" variant="outline" className="w-full h-12 border-dashed border-2 bg-slate-50/50 text-slate-400 border-slate-200 hover:text-slate-900 hover:border-slate-900 hover:bg-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm" onClick={addMember}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Member
                    </Button>
                )}
                <FormField
                    control={control}
                    name={`roles.${role.roleKey}.members`}
                    render={({ fieldState }) => fieldState.error ? <FormMessage className="mt-2">{fieldState.error.message}</FormMessage> : <></>}
                />
            </CardContent>
        </Card>
    );
};


// Component to find and display orphaned data
const OrphanedDataHandler: React.FC<{ constitution: BusinessTypeSetup | null | undefined }> = ({ constitution }) => {
    const { watch, getValues, setValue } = useFormContext<Profile>();
    const fields = watch('fields');
    const [orphanedFields, setOrphanedFields] = useState<string[]>([]);

    useEffect(() => {
        if (!constitution || !fields) {
            setOrphanedFields([]);
            return;
        }

        const definedFieldKeys = new Set<string>();
        (constitution.requiredSections || []).forEach(section => {
            (section.fields || []).forEach(f => {
                definedFieldKeys.add(f.fieldKey);
            });
        });

        const existingFieldKeys = Object.keys(fields);
        const orphans = existingFieldKeys.filter(key => !definedFieldKeys.has(key) && fields[key as keyof typeof fields]);
        setOrphanedFields(orphans);
    }, [constitution, fields]);

    const handleDeleteOrphan = (fieldName: string) => {
        const currentFields = { ...getValues('fields') };
        delete currentFields[fieldName];
        setValue('fields', currentFields, { shouldDirty: true, shouldValidate: true });
    };

    if (orphanedFields.length === 0) {
        return null;
    }

    // Hidden as per user request
    return null;
};

const GeneralSection: React.FC<{ allRoles: Role[] }> = ({ allRoles }) => {
    const { control, watch, setValue, getValues, formState: { errors } } = useFormContext<Profile>();

    const rawRoles = useWatch({ name: 'roles' });
    const watchedRoles = useMemo(() => rawRoles || {}, [rawRoles]);
    
    const rawSignatories = useWatch({ name: 'signatories' });
    const watchedSignatories = useMemo(() => rawSignatories || [], [rawSignatories]);
    
    const rawPrimary = useWatch({ name: 'primarySignatories' });
    const watchedPrimarySignatoryMap = useMemo(() => rawPrimary || {}, [rawPrimary]);

    const selectAllRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const rolesVal = getValues('roles') || {};
        // Build valid ids per role
        const valid: Record<string, Set<string>> = {};
        Object.keys(rolesVal).forEach(rk => {
            valid[rk] = new Set((rolesVal[rk]?.members || []).map((m: any) => (m as { _id?: string })?._id).filter((id): id is string => !!id));
        });

        // Filter signatories that no longer exist
        const currSigs = getValues('signatories') || [];
        const filtered = currSigs.filter((s: { roleKey: string; memberId: string }) => s.memberId && valid[s.roleKey]?.has(s.memberId));

        let sigsChanged = filtered.length !== currSigs.length;
        if (sigsChanged) {
            setValue('signatories', filtered, { shouldDirty: true, shouldValidate: true });
        }

        // Drop invalid primaries per role
        const currPrim = getValues('primarySignatories') || {};
        const nextPrim: Record<string, string> = { ...currPrim };
        let primChanged = false;
        Object.keys(currPrim).forEach(rk => {
            if (currPrim[rk] && !valid[rk]?.has(currPrim[rk]!)) {
                delete nextPrim[rk];
                primChanged = true;
            }
        });
        if (primChanged) {
            setValue('primarySignatories', nextPrim, { shouldDirty: true, shouldValidate: true });
        }
    }, [watchedRoles, watchedSignatories, watchedPrimarySignatoryMap, setValue, getValues]);

    const displayName = (d: { full_name?: string; name?: string; partner_name?: string; director_name?: string }) => d.full_name || d.name || d.partner_name || d.director_name || '';

    const allMembers = useMemo(() => {
        if (!allRoles || !watchedRoles) return [];
        return allRoles.flatMap(role =>
            (watchedRoles?.[role.roleKey]?.members || []).map((m: any, i: number) => ({
                roleKey: role.roleKey,
                roleName: role.roleName,
                memberId: m._id,
                memberIndex: i,
                details: m.details || {},
            }))
        );
    }, [watchedRoles, allRoles]);

    const isSignatory = (rk: string, mid: string) =>
        (watchedSignatories || []).some((s: { roleKey: string; memberId: string }) => s.roleKey === rk && s.memberId === mid);

    const isPrimary = (rk: string, mid: string) =>
        (watchedPrimarySignatoryMap?.[rk] ?? '') === mid;

    const handleSignatoryChange = (roleKey: string, memberId: string, checked: boolean) => {
        const curr = getValues('signatories') || [];
        let next;
        if (checked) {
            next = [...curr, { roleKey, memberId }];
        } else {
            next = curr.filter(s => !(s.roleKey === roleKey && s.memberId === memberId));
            // If removing a primary, unset it for that role
            if (getValues('primarySignatories')?.[roleKey] === memberId) {
                setValue(`primarySignatories.${roleKey}`, undefined, { shouldDirty: true, shouldValidate: true });
            }
        }
        setValue('signatories', next, { shouldDirty: true, shouldValidate: true });
    };

    const handlePrimaryChange = (roleKey: string, memberId: string) => {
        // Only allow primary for a checked signatory
        if (!isSignatory(roleKey, memberId)) return;
        setValue(`primarySignatories.${roleKey}`, memberId, { shouldDirty: true, shouldValidate: true });
    };

    const allSelected = allMembers.length > 0 && watchedSignatories.length === allMembers.length;
    const someSelected = watchedSignatories.length > 0 && !allSelected;

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someSelected;
        }
    }, [someSelected]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const all = allMembers.map(m => ({ roleKey: m.roleKey, memberId: m.memberId }));
            setValue('signatories', all, { shouldDirty: true, shouldValidate: true });
        } else {
            setValue('signatories', [], { shouldDirty: true, shouldValidate: true });
            setValue('primarySignatories', {}, { shouldDirty: true, shouldValidate: true });
        }
    };

    if (allMembers.length === 0) return null;

    return (
        <Card className="rounded-lg border bg-white shadow-sm overflow-hidden">
            <CardHeader className="px-6 py-4 border-b bg-slate-50/50">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-slate-500" />
                        <div>
                            <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Signatory Authority</CardTitle>
                            <CardDescription className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">
                                Choose who can sign documents and assign one main person per role.
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant="secondary" className="font-bold text-[9px] bg-slate-900 text-white border-transparent uppercase tracking-wider">
                        {watchedSignatories.length} / {allMembers.length} Selected
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-hidden">
                    <div className="grid grid-cols-[1fr_6rem_6rem] items-center text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-3 bg-slate-50 border-b">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="select-all-signatories"
                                className="h-4 w-4 rounded border-slate-300 data-[state=checked]:bg-slate-900"
                                checked={allSelected}
                                onCheckedChange={(checked) => handleSelectAll({ target: { checked } } as any)}
                            />
                            <span>Members List</span>
                        </div>
                        <div className="text-center">Can Sign</div>
                        <div className="text-center">Main</div>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        {allMembers.map((member, idx) => {
                            if (!member.memberId) return null;
                            const otherDetails = { ...member.details };
                            delete otherDetails.full_name;
                            delete otherDetails.designation;

                            const active = isSignatory(member.roleKey, member.memberId);
                            const primary = isPrimary(member.roleKey, member.memberId);

                            return (
                                <AccordionItem value={`item-${idx}`} key={member.memberId} className="border-b last:border-0 hover:bg-slate-50/50 transition-all">
                                    <div className="grid grid-cols-[1fr_6rem_6rem] items-center px-6 py-2">
                                        <AccordionTrigger className="text-left hover:no-underline py-2 [&>svg]:hidden">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-[10px] border shadow-sm ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}>
                                                    {(displayName(member.details) || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <div onClick={(e) => e.stopPropagation()} className="max-w-[240px]">
                                                        <Input
                                                            placeholder="Enter Name"
                                                            className="h-7 py-0 px-1 -ml-1 text-sm font-semibold text-gray-900 border-none focus-visible:ring-0 bg-transparent hover:bg-white hover:border-gray-200 rounded transition-all w-full truncate"
                                                            value={displayName(member.details)}
                                                            onChange={(e) => {
                                                                const d = member.details;
                                                                const nameKey = d.full_name !== undefined ? 'full_name' : (d.name !== undefined ? 'name' : (d.director_name !== undefined ? 'director_name' : (d.partner_name !== undefined ? 'partner_name' : 'full_name')));
                                                                setValue(`roles.${member.roleKey}.members.${member.memberIndex}.details.${nameKey}`, e.target.value, { shouldDirty: true, shouldValidate: true });
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-gray-500 lowercase first-letter:uppercase truncate">
                                                        {member.details.designation || member.roleName}
                                                    </span>
                                                </div>
                                            </div>
                                        </AccordionTrigger>

                                        <div className="justify-self-center">
                                            <Checkbox
                                                id={`signatory-${member.memberId}`}
                                                className="h-4 w-4 rounded border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 transition-all"
                                                checked={active}
                                                onCheckedChange={(checked) =>
                                                    handleSignatoryChange(member.roleKey, member.memberId, checked === true)
                                                }
                                            />
                                        </div>

                                        <div className="justify-self-center">
                                            <RadioGroup
                                                value={primary ? member.memberId : ''}
                                                onValueChange={(val) => val === member.memberId && handlePrimaryChange(member.roleKey, member.memberId)}
                                            >
                                                <RadioGroupItem
                                                    value={member.memberId}
                                                    id={`primary-${member.memberId}`}
                                                    className={`h-4 w-4 border-slate-300 text-slate-900 focus:ring-0 ${!active && 'opacity-10 cursor-not-allowed'}`}
                                                    disabled={!active}
                                                />
                                            </RadioGroup>
                                        </div>
                                    </div>


                                    <AccordionContent className="bg-slate-50/20">
                                        <div className="mx-6 my-4 p-5 rounded-lg border border-slate-100 bg-white shadow-xs">
                                            <div className="flex items-center gap-2 mb-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Additional Details</p>
                                            </div>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                                {Object.entries(member.details).filter(([k, v]) => !k.endsWith('_isAvailable') && v && !['full_name', 'name', 'director_name', 'partner_name', 'designation'].includes(k)).map(([key, value]) => (
                                                    <div key={key} className="space-y-0.5">
                                                        <span className="block text-[10px] font-medium text-gray-400 uppercase tracking-tight">
                                                            {key.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="block text-sm font-semibold text-gray-700 truncate">
                                                            {String(value) || '—'}
                                                        </span>
                                                    </div>
                                                ))}
                                                {Object.entries(member.details).filter(([k, v]) => !k.endsWith('_isAvailable') && v && !['full_name', 'name', 'director_name', 'partner_name', 'designation'].includes(k)).length === 0 && (
                                                    <div className="col-span-full py-2">
                                                        <p className="text-xs text-gray-400 italic">No supplementary data recorded.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>
                {errors.signatories && <p className="mt-4 px-6 text-xs text-red-500 font-medium">{String(errors.signatories.message)}</p>}
                {errors.primarySignatories && <p className="mt-2 px-6 text-xs text-red-500 font-medium">{String(errors.primarySignatories.message)}</p>}
            </CardContent>
        </Card>
    );
};

export { ProfileFormWrapper as ProfileForm };

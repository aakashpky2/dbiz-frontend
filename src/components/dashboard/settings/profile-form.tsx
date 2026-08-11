"use client";
import { parsePhoneFromPayload, formatPhoneForPayload, sanitizePhoneInput, isValidLocalPhone, formatPhoneNumber, phoneValidation } from '@/lib/phone-utils';
import { cn } from '@/lib/utils';

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

const normalizeNameForDuplicateCheck = (name: string) => {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const createFieldValidator = (field: FieldDefinitionData): z.ZodTypeAny => {
    // 1. Checkboxes
    if (field.inputType === 'Checkbox') {
        if (field.options && field.options.length > 0) {
            const arrVal = z.array(z.string());
            if (field.requirement === 'Mandatory') {
                return arrVal.min(1, { message: `At least one option must be selected for ${field.fieldName}.` });
            }
            return arrVal.default([]);
        } else {
            return z.boolean().default(false);
        }
    }

    // 2. Dropdown / Radio static options restriction
    const isMasterSelect = field.fieldName.toLowerCase() === 'country' || field.fieldName.toLowerCase() === 'designation';
    if ((field.inputType === 'Dropdown' || field.inputType === 'Radio') && field.options && field.options.length > 0 && !isMasterSelect) {
        const optionValidator = z.string().refine(val => !val || field.options!.includes(val), {
            message: `Invalid selection for ${field.fieldName}.`
        });
        if (field.requirement === 'Mandatory') {
            return optionValidator.refine(val => !!val && val !== 'ADD_NEW_MASTER_VALUE', { message: `${field.fieldName} is required.` });
        }
        return z.union([z.literal(''), z.literal(undefined), optionValidator]);
    }

    // 3. FileUpload
    if (field.inputType === 'FileUpload') {
        const fileMetadataSchema = z.object({
            path: z.string().min(1, "File path is required"),
            publicUrl: z.string().optional(),
            name: z.string().min(1, "File name is required"),
            mimeType: z.string().min(1, "MIME type is required"),
            size: z.number().max(5 * 1024 * 1024, "File size exceeds the 5 MB limit")
        });

        if (field.requirement === 'Mandatory') {
            return fileMetadataSchema;
        }
        return z.union([z.null(), z.undefined(), fileMetadataSchema]);
    }

    // 4. Phones
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

    // 5. String fields (Text, Textarea, Email, PAN, GSTIN, Number)
    let validator: z.ZodTypeAny = z.string();

    if (field.fieldType === 'PAN') {
        validator = z.preprocess(
            (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
            z.string().regex(PAN_REGEX, { message: `Invalid PAN format for ${field.fieldName}.` })
        );
    } else if (field.fieldType === 'GSTIN') {
        validator = z.preprocess(
            (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
            z.string().regex(GSTIN_REGEX, { message: `Invalid GSTIN format for ${field.fieldName}.` })
        );
    } else if (field.fieldType === 'Email') {
        validator = z.preprocess(
            (val) => (typeof val === 'string' ? val.trim() : val),
            z.string().email({ message: `Invalid Email format for ${field.fieldName}.` })
                .max(100, "Email cannot exceed 100 characters.")
                .regex(STRICT_EMAIL_REGEX, { message: `${field.fieldName} must be a valid email (e.g. user@example.com).` })
        );
    } else if (field.fieldType === 'Number') {
        validator = z.string().regex(/^\d*$/, { message: `${field.fieldName} must only contain numbers.` });
    } else {
        validator = z.preprocess(
            (val) => (typeof val === 'string' ? val.trim() : val),
            z.string()
        );
    }

    if (field.maxLength && field.maxLength > 0) {
        validator = (validator as any).refine((val: string) => !val || val.length <= field.maxLength!, {
            message: `${field.fieldName} cannot exceed ${field.maxLength} characters.`
        });
    }

    if (field.requirement !== 'Mandatory') {
        return z.union([z.literal(''), z.literal(undefined), validator]);
    }
    return (validator as any).refine((val: string) => !!val && val.length > 0, {
        message: `${field.fieldName} is required.`
    });
};

const generateSchema = (constitution: BusinessTypeSetup | null | undefined) => {
    const memberSchema = z.object({
        _id: z.string().default(''), 
        details: z.any(), 
        isSaved: z.boolean().optional(),
    });

    const baseSchema = {
        profileName: z.string()
            .trim()
            .min(1, "Profile name is required.")
            .max(100, "Profile name cannot exceed 100 characters.")
            .refine(val => val.length > 0, { message: "Profile name is required." }),
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
        });
    }

    const topLevelFieldsShape: Record<string, z.ZodTypeAny> = {
        gst_applicable: z.boolean().default(false)
    };
    (constitution.requiredSections || []).forEach(section => {
        (section.fields || []).forEach(field => {
            if (field.requirement === 'If Available') {
                topLevelFieldsShape[`${field.fieldKey}_isAvailable`] = z.boolean().optional();
                topLevelFieldsShape[field.fieldKey] = createFieldValidator({ ...field, requirement: 'Optional' });
            } else if (field.fieldKey === 'gstin') {
                topLevelFieldsShape[field.fieldKey] = z.string().optional(); 
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
                if (field.requirement === 'If Available') {
                    memberDetailsShape[`${field.fieldKey}_isAvailable`] = z.boolean().optional();
                    memberDetailsShape[field.fieldKey] = createFieldValidator({ ...field, requirement: 'Optional' });
                } else {
                    memberDetailsShape[field.fieldKey] = createFieldValidator(field);
                }
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

                // Check If Available fields for the member
                (role.requiredDetails || []).forEach((section: any) => {
                    (section.fields || []).forEach((field: any) => {
                        if (field.requirement === 'If Available') {
                            const details = member.details || {};
                            const isAvailable = details[`${field.fieldKey}_isAvailable`] === true;
                            const val = details[field.fieldKey];
                            if (isAvailable) {
                                const mandatoryValidator = createFieldValidator({ ...field, requirement: 'Mandatory' });
                                const res = mandatoryValidator.safeParse(val);
                                if (!res.success) {
                                    res.error.issues.forEach(issue => {
                                        ctx.addIssue({
                                            ...issue,
                                            path: ['details', field.fieldKey, ...issue.path]
                                        });
                                    });
                                }
                            }
                        }
                    });
                });
            }
        });

        let membersArrayValidator: any = z.array(validatedMemberSchema);
        if (role.maxMembers > 0) {
            membersArrayValidator = membersArrayValidator.max(role.maxMembers, `No more than ${role.maxMembers} members allowed for the ${role.roleName} role.`);
        }

        // Duplicate names check within role
        membersArrayValidator = membersArrayValidator.refine(
            (members = []) => {
                const names = members.map((m: any) => {
                    const d = m.details || {};
                    const rawName = d.full_name || d.name || d.director_name || d.partner_name || '';
                    return normalizeNameForDuplicateCheck(rawName);
                }).filter(Boolean);
                const uniqueNames = new Set(names);
                return uniqueNames.size === names.length;
            },
            { message: "Duplicate member names are not allowed in the same role." }
        );

        // Block Profile Save if any member is unsaved
        membersArrayValidator = membersArrayValidator.refine(
            (members = []) => {
                return !members.some((m: any) => m.isSaved === false);
            },
            { message: `Please save or remove the unfinished member in ${role.roleName}.` }
        );

        rolesShape[role.roleKey] = z.object({
            members: membersArrayValidator
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

            // Check If Available fields
            (constitution.requiredSections || []).forEach(section => {
                (section.fields || []).forEach(field => {
                    if (field.requirement === 'If Available') {
                        const isAvailable = fields[`${field.fieldKey}_isAvailable` as keyof typeof fields] === true;
                        const val = fields[field.fieldKey as keyof typeof fields];
                        if (isAvailable) {
                            const mandatoryValidator = createFieldValidator({ ...field, requirement: 'Mandatory' });
                            const res = mandatoryValidator.safeParse(val);
                            if (!res.success) {
                                res.error.issues.forEach(issue => {
                                    ctx.addIssue({
                                        ...issue,
                                        path: [field.fieldKey, ...issue.path]
                                    });
                                });
                            }
                        }
                    }
                });
            });
        }),
        roles: z.object(rolesShape).optional()
    }).superRefine((data, ctx) => {
        const signatories = data.signatories || [];
        const primarySignatories = data.primarySignatories || {};
        const roles = data.roles || {};

        const validMembersMap: Record<string, Set<string>> = {};
        Object.entries(roles).forEach(([roleKey, roleVal]: [string, any]) => {
            const members = roleVal?.members || [];
            validMembersMap[roleKey] = new Set(members.map((m: any) => m._id).filter(Boolean));
        });

        const seenSignatories = new Set<string>();
        signatories.forEach((sig, idx) => {
            if (!sig.roleKey || !sig.memberId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['signatories', idx],
                    message: 'Role and Member selection are required for all signatories.'
                });
                return;
            }

            const sigKey = `${sig.roleKey}-${sig.memberId}`;
            if (seenSignatories.has(sigKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['signatories', idx],
                    message: 'Duplicate signatory entries are not allowed.'
                });
            } else {
                seenSignatories.add(sigKey);
            }

            const validIds = validMembersMap[sig.roleKey];
            if (!validIds || !validIds.has(sig.memberId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['signatories', idx],
                    message: `Signatory references a member that does not exist in the role.`
                });
            }
        });

        Object.entries(primarySignatories).forEach(([roleKey, memberId]) => {
            if (!memberId) return;

            const validIds = validMembersMap[roleKey];
            if (!validIds || !validIds.has(memberId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['primarySignatories', roleKey],
                    message: 'Primary signatory references a member that does not exist.'
                });
                return;
            }

            const isSigSelected = signatories.some(sig => sig.roleKey === roleKey && sig.memberId === memberId);
            if (!isSigSelected) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['primarySignatories', roleKey],
                    message: 'Primary signatory must also be selected as a signatory.'
                });
            }
        });
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
    const methods = useFormContext<Profile>();
    const { control, setValue, watch, setError, clearErrors } = methods;
    const { toast } = useToast();

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
                const fileVal = formField.value;
                const hasFile = fileVal && (fileVal.name || fileVal.path);

                if (hasFile) {
                    const formattedSize = fileVal.size ? `${(fileVal.size / (1024 * 1024)).toFixed(2)} MB` : '';
                    return (
                        <div className="flex items-center justify-between border rounded-md p-4 bg-slate-50/50">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                                <div className="text-left overflow-hidden">
                                    <p className="text-xs font-semibold text-gray-700 truncate">{fileVal.name}</p>
                                    {formattedSize && <p className="text-[10px] text-gray-500">{formattedSize}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {fileVal.path && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-blue-600 hover:text-blue-700 text-xs font-semibold gap-1"
                                        onClick={async () => {
                                            try {
                                                const { getProfileDocumentUrl } = await import('@/lib/upload-profile-document');
                                                const url = await getProfileDocumentUrl(fileVal.path);
                                                window.open(url, '_blank');
                                            } catch (err: any) {
                                                toast({ title: "Failed to download", description: err.message, variant: "destructive" });
                                            }
                                        }}
                                    >
                                        Download
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                        formField.onChange(null);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="group relative border border-dashed rounded-md p-6 bg-gray-50/50 hover:bg-blue-50/30 hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-2">
                        <div className="p-2.5 bg-white border rounded-full text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                            <CloudUpload className="h-5 w-5" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-semibold text-gray-700">Click to upload or drag and drop</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">PDF, PNG, JPG (max 5MB)</p>
                        </div>
                        <Input
                            type="file"
                            accept=".pdf,image/png,image/jpeg"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={async (e) => {
                                const selectedFile = e.target.files?.[0];
                                if (!selectedFile) return;

                                const { validateProfileFile } = await import('@/lib/upload-profile-document');
                                const check = validateProfileFile(selectedFile);
                                if (!check.isValid) {
                                    methods.setError(name as any, {
                                        type: "manual",
                                        message: check.error
                                    });
                                    return;
                                }

                                methods.clearErrors(name as any);
                                formField.onChange({
                                    file: selectedFile,
                                    name: selectedFile.name,
                                    mimeType: selectedFile.type,
                                    size: selectedFile.size,
                                    isPendingUpload: true
                                });
                            }}
                        />
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
                            <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                                {field.fieldName}
                                {field.requirement === 'Mandatory' && <span className="text-red-500 ml-1 font-bold">*</span>}
                                {field.requirement === 'Optional' && (
                                    <span className="ml-1.5 text-[9px] font-bold text-slate-400 normal-case tracking-normal">(Optional)</span>
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

    // Effect to rebuild dynamic fields/roles when constitution changes, while PRESERVING profileName and isDefault
    useEffect(() => {
        const current = getValues();
        if (current.constitutionId === selectedConstitutionId) return; // No real change

        const nextDefaults = { ...freshDefaults };
        nextDefaults.profileName = current.profileName || '';
        nextDefaults.isDefault = current.isDefault || false;

        // Preserve same-key compatible fields across constitutions if applicable
        if (current.fields && nextDefaults.fields) {
            const preservedFields: Record<string, any> = { ...nextDefaults.fields };
            selectedConstitution?.requiredSections?.forEach(section => {
                section.fields?.forEach(field => {
                    const currentVal = current.fields[field.fieldKey];
                    if (currentVal !== undefined) {
                        preservedFields[field.fieldKey] = currentVal;
                        const availKey = `${field.fieldKey}_isAvailable`;
                        if (current.fields[availKey] !== undefined) {
                            preservedFields[availKey] = current.fields[availKey];
                        }
                    }
                });
            });
            nextDefaults.fields = preservedFields;
        }

        reset(nextDefaults);
    }, [selectedConstitutionId, freshDefaults, reset]);

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

    const normalizeProfilePayload = (data: Profile, constitution: BusinessTypeSetup | null | undefined): Omit<Profile, 'id'> & { id?: string } => {
        const trimmedProfileName = data.profileName?.trim() || '';

        const normalizedFields: Record<string, any> = {};
        if (constitution?.requiredSections) {
            constitution.requiredSections.forEach(section => {
                section.fields?.forEach(field => {
                    const key = field.fieldKey;
                    const isAvailKey = `${key}_isAvailable`;
                    const isAvailable = data.fields?.[isAvailKey] !== false;

                    if (field.requirement === 'If Available') {
                        normalizedFields[isAvailKey] = isAvailable;
                        if (!isAvailable) {
                            normalizedFields[key] = field.inputType === 'Checkbox' && field.options?.length ? [] : '';
                            return;
                        }
                    }

                    let val = data.fields?.[key];

                    // Perform specific type normalization
                    if (typeof val === 'string') {
                        val = val.trim();
                        if (field.fieldType === 'PAN' || field.fieldType === 'GSTIN') {
                            val = val.toUpperCase();
                        } else if (field.fieldType === 'Number') {
                            val = val.replace(/\D/g, '');
                        }
                    }

                    normalizedFields[key] = val !== undefined ? val : '';
                });
            });

            // Handle GSTIN specific conditional logic
            const gstApplicable = data.fields?.gst_applicable === true;
            normalizedFields.gst_applicable = gstApplicable;
            if (gstApplicable) {
                normalizedFields.gstin = (data.fields?.gstin || '').trim().toUpperCase();
            } else {
                normalizedFields.gstin = '';
            }
        }

        const normalizedRoles: Record<string, any> = {};
        if (constitution?.roles) {
            constitution.roles.forEach(role => {
                const rawMembers = data.roles?.[role.roleKey]?.members || [];
                const cleanMembers = rawMembers.map((member: any, index: number) => {
                    const normalized = normalizeMemberForSave(member, role.roleName, index);
                    
                    // Clean the member details string fields
                    const cleanedDetails: Record<string, any> = { ...(normalized.details || {}) };
                    role.requiredDetails.forEach((section: any) => {
                        section.fields?.forEach((field: any) => {
                            const key = field.fieldKey;
                            const isAvailKey = `${key}_isAvailable`;
                            const isAvailable = cleanedDetails[isAvailKey] !== false;

                            if (field.requirement === 'If Available') {
                                cleanedDetails[isAvailKey] = isAvailable;
                                if (!isAvailable) {
                                    cleanedDetails[key] = field.inputType === 'Checkbox' && field.options?.length ? [] : '';
                                    return;
                                }
                            }

                            let val = cleanedDetails[key];
                            if (typeof val === 'string') {
                                val = val.trim();
                                if (field.fieldType === 'PAN' || field.fieldType === 'GSTIN') {
                                    val = val.toUpperCase();
                                } else if (field.fieldType === 'Number') {
                                    val = val.replace(/\D/g, '');
                                }
                            }
                            cleanedDetails[key] = val !== undefined ? val : '';
                        });
                    });

                    if (role.designations?.length) {
                        cleanedDetails.designation = (cleanedDetails.designation || '').trim();
                    }

                    // UI only flags like isSaved should be excluded
                    const { isSaved, ...persistedMember } = normalized;
                    return {
                        ...persistedMember,
                        details: cleanedDetails
                    };
                });

                normalizedRoles[role.roleKey] = { members: cleanMembers };
            });
        }

        // Signatories reference validation
        const validMemberIdsByRole: Record<string, Set<string>> = {};
        Object.entries(normalizedRoles).forEach(([roleKey, roleVal]: [string, any]) => {
            validMemberIdsByRole[roleKey] = new Set((roleVal?.members || []).map((m: any) => m._id).filter(Boolean));
        });

        const cleanSignatories = (data.signatories || []).filter(sig => {
            if (!sig.roleKey || !sig.memberId) return false;
            const validIds = validMemberIdsByRole[sig.roleKey];
            return validIds && validIds.has(sig.memberId);
        });

        const seenSignatories = new Set<string>();
        const uniqueSignatories = cleanSignatories.filter(sig => {
            const key = `${sig.roleKey}-${sig.memberId}`;
            if (seenSignatories.has(key)) return false;
            seenSignatories.add(key);
            return true;
        });

        const cleanPrimarySignatories: Record<string, string> = {};
        if (data.primarySignatories) {
            Object.entries(data.primarySignatories).forEach(([roleKey, memberId]) => {
                if (!memberId) return;
                const validIds = validMemberIdsByRole[roleKey];
                const isSigSelected = uniqueSignatories.some(sig => sig.roleKey === roleKey && sig.memberId === memberId);
                if (validIds && validIds.has(memberId) && isSigSelected) {
                    cleanPrimarySignatories[roleKey] = memberId;
                }
            });
        }

        return {
            profileName: trimmedProfileName,
            constitutionId: data.constitutionId,
            isDefault: data.isDefault || false,
            fields: normalizedFields,
            roles: normalizedRoles,
            signatories: uniqueSignatories,
            primarySignatories: cleanPrimarySignatories
        };
    };

    const completionStats = useMemo(() => {
        if (!selectedConstitution) return null;
        
        let totalRequired = 2; // profileName + constitutionId
        let filledRequired = 0;
        
        const current = watchedValues as any || freshDefaults as any;
        
        if (current.profileName && current.profileName.trim().length > 0) filledRequired++;
        if (current.constitutionId) filledRequired++;
        
        selectedConstitution.requiredSections?.forEach(section => {
            section.fields?.forEach(field => {
                if (field.requirement === 'Mandatory') {
                    totalRequired++;
                    if (current.fields?.[field.fieldKey] !== undefined && current.fields[field.fieldKey] !== '') {
                        filledRequired++;
                    }
                }
            });
        });
        
        selectedConstitution.roles?.forEach(role => {
            const members = current.roles?.[role.roleKey]?.members || [];
            members.forEach((member: any) => {
                role.requiredDetails?.forEach((section: any) => {
                    section.fields?.forEach((field: any) => {
                        if (field.requirement === 'Mandatory') {
                            totalRequired++;
                            if (member?.details?.[field.fieldKey] !== undefined && member.details[field.fieldKey] !== '') {
                                filledRequired++;
                            }
                        }
                    });
                });
                if (role.designations?.length) {
                    totalRequired++;
                    if (member?.details?.designation) {
                        filledRequired++;
                    }
                }
            });
        });

        const percentage = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;
        return { totalRequired, filledRequired, percentage };
    }, [selectedConstitution, watchedValues, freshDefaults]);

    const allPendingIssues = useMemo(() => {
        const completenessIssues = listPendingMandatoryIssues(watchedValues as any || freshDefaults as any, selectedConstitution);
        const validationErrorMessages = getErrorMessages(errors).map(msg => ({ message: msg, type: 'error' as const }));

        const messageSet = new Set<string>();
        const combined: Issue[] = [];
        [...validationErrorMessages, ...completenessIssues].forEach(issue => {
            if (!messageSet.has(issue.message)) {
                messageSet.add(issue.message);
                combined.push(issue);
            }
        });

        return combined;
    }, [errors, selectedConstitution, watchedValues, freshDefaults]);

    const criticalErrors = useMemo(() => allPendingIssues.filter(i => i.type === 'error'), [allPendingIssues]);
    const warnings = useMemo(() => allPendingIssues.filter(i => i.type === 'warning'), [allPendingIssues]);

    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const isSaveDisabled = isSaving || isSavingLocal;

    const onValidSubmit = async (data: Profile) => {
        if (isSaveDisabled) return;
        setIsSavingLocal(true);

        try {
            let profileId = existingProfile?.id;
            let isNew = false;
            let initialPayload = normalizeProfilePayload(data, selectedConstitution);

            if (!profileId) {
                isNew = true;
                const created = await addProfile(initialPayload, profiles.length === 0);
                if (!created) {
                    toast({ title: "Save Error", description: "Failed to create profile record.", variant: "destructive" });
                    setIsSavingLocal(false);
                    return;
                }
                profileId = created.id;
            }

            if (!profileId) {
                setIsSavingLocal(false);
                return;
            }

            // Now, upload pending files using the created/existing profileId
            const fieldsCopy = { ...initialPayload.fields };
            const { uploadProfileDocument } = await import('@/lib/upload-profile-document');
            let hasUploadedNewFiles = false;

            // Search top-level fields
            for (const [key, value] of Object.entries(fieldsCopy)) {
                if (value && typeof value === 'object' && (value as any).isPendingUpload && (value as any).file) {
                    const fileObj = (value as any).file as File;
                    try {
                        const meta = await uploadProfileDocument(fileObj, profileId, key);
                        fieldsCopy[key] = meta;
                        hasUploadedNewFiles = true;
                    } catch (err: any) {
                        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
                        setIsSavingLocal(false);
                        return;
                    }
                }
            }

            // Search roles member details
            const rolesCopy = { ...initialPayload.roles };
            for (const [roleKey, roleVal] of Object.entries(rolesCopy)) {
                const members = (roleVal as any)?.members || [];
                for (let i = 0; i < members.length; i++) {
                    const member = members[i];
                    const details = member.details || {};
                    for (const [key, value] of Object.entries(details)) {
                        if (value && typeof value === 'object' && (value as any).isPendingUpload && (value as any).file) {
                            const fileObj = (value as any).file as File;
                            try {
                                const meta = await uploadProfileDocument(fileObj, profileId, `${roleKey}_${i}_${key}`);
                                details[key] = meta;
                                hasUploadedNewFiles = true;
                            } catch (err: any) {
                                toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
                                setIsSavingLocal(false);
                                return;
                            }
                        }
                    }
                }
            }

            const finalPayload = {
                ...initialPayload,
                fields: fieldsCopy,
                roles: rolesCopy
            };

            await updateProfile(profileId, finalPayload);
            if (finalPayload.isDefault) {
                await setDefaultProfile(profileId);
            }

            toast({ title: "Success", description: existingProfile ? "Profile updated successfully." : "Profile created successfully." });

            if (onSuccess) {
                onSuccess();
            } else {
                onCancel();
            }
        } catch (e: any) {
            console.error("!!! SAVE FAILED WITH ERROR !!!", e);
            toast({ title: "Save Error", description: e?.message || "Could not save profile.", variant: "destructive" });
        } finally {
            setIsSavingLocal(false);
        }
    };

    const onInvalidSubmit = (formErrors: any) => {
        console.log("FORM INVALID SUBMIT ERRORS:", formErrors);
        toast({
            title: "Validation Failed",
            description: "Please fix the highlighted errors before saving.",
            variant: "destructive"
        });

        setTopLevelTab('details');

        const firstErrorKey = Object.keys(formErrors)[0];
        if (!firstErrorKey) return;

        if (firstErrorKey === 'profileName') {
            const el = document.getElementsByName('profileName')[0];
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus();
            return;
        }

        if (firstErrorKey === 'fields' && formErrors.fields) {
            const firstFieldKey = Object.keys(formErrors.fields)[0];
            let targetTabKey = '';
            (selectedConstitution?.requiredSections || []).forEach(section => {
                const hasField = section.fields?.some(f => f.fieldKey === firstFieldKey);
                if (hasField) {
                    const key = section.sectionKey.toLowerCase();
                    if (section.fields?.some((f: any) => f.category === 'core' || f.group === 'core') || key.includes('core')) {
                        targetTabKey = 'core';
                    } else if (key.includes('address')) {
                        targetTabKey = 'address';
                    } else if (key.includes('contact')) {
                        targetTabKey = 'contact';
                    } else if (key.includes('business')) {
                        targetTabKey = 'business';
                    } else {
                        targetTabKey = 'general';
                    }
                }
            });

            if (targetTabKey) {
                setCurrentTab(targetTabKey);
            }

            setTimeout(() => {
                const el = document.getElementsByName(`fields.${firstFieldKey}`)[0] || document.getElementById(`fields.${firstFieldKey}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                }
            }, 100);
        } else if (firstErrorKey === 'roles' && formErrors.roles) {
            setCurrentTab('roles');
            setTimeout(() => {
                const firstRoleKey = Object.keys(formErrors.roles)[0];
                const el = document.getElementById(`role-section-${firstRoleKey}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        } else if (firstErrorKey === 'signatories') {
            setCurrentTab('roles');
            setTimeout(() => {
                const el = document.getElementById('select-all-signatories');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
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
    }, [formatLabel, selectedConstitution]);


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
            <form onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)} className="h-[90vh] flex flex-col bg-background relative overflow-hidden">
                {/* Sticky Header */}
                <div 
                    className="sticky top-0 z-40 border-b px-6 py-4 flex items-center justify-between shadow-sm backdrop-blur-md"
                    style={{
                        background: 'linear-gradient(110deg, hsl(var(--primary) / 0.045), hsl(var(--background)) 45%, hsl(var(--background)))'
                    }}
                >
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                            {formMode === 'view' ? (
                                <Badge variant="secondary" className="h-5 px-2 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-transparent uppercase tracking-widest">
                                    View Mode
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="h-5 px-2 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-transparent uppercase tracking-widest">
                                    {existingProfile ? 'Edit Profile' : 'New Profile'}
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-foreground leading-tight uppercase tracking-tight">
                            {formMode === 'view' ? existingProfile?.profileName : (existingProfile ? existingProfile.profileName : 'Create Business Profile')}
                        </h2>
                        {formMode !== 'view' && (
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                                {existingProfile ? (
                                    <span>{selectedConstitution?.businessType || 'Business'} &middot; {selectedConstitution?.businessSubType || 'Profile'}</span>
                                ) : (
                                    <span>Configure your organization's identity and business details</span>
                                )}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-6">
                        {completionStats && formMode !== 'view' && (
                            <div className="flex items-center gap-3 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Setup {completionStats.percentage}%
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                        {completionStats.filledRequired} of {completionStats.totalRequired} required
                                    </span>
                                </div>
                                <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50">
                                    <div 
                                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                        style={{ width: `${completionStats.percentage}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onCancel}
                            className="h-10 w-10 text-slate-500 hover:text-foreground hover:bg-muted border border-border shadow-sm rounded-lg transition-colors duration-150"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="bg-background px-6 py-2 border-b border-border sticky z-30" style={{ top: '76px' }}>
                    <Tabs value={topLevelTab} onValueChange={(val: any) => setTopLevelTab(val)} className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl flex justify-start gap-1 h-11 w-fit border border-slate-200/60 dark:border-slate-800/80 shadow-inner">
                            <TabsTrigger 
                                value="details" 
                                className="rounded-lg h-9 px-6 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all border border-transparent data-[state=active]:border-slate-200/50"
                            >
                                Profile Details
                            </TabsTrigger>
                            <TabsTrigger 
                                value="branding" 
                                className="rounded-lg h-9 px-6 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all border border-transparent data-[state=active]:border-slate-200/50"
                            >
                                Branding
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {topLevelTab === 'details' && (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10 modal-radial-bg animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <OrphanedDataHandler constitution={selectedConstitution} />

                    {/* Section 1: Core Selection */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b pb-4 border-slate-200/60">
                            <div className="h-8 w-10 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-black rounded-lg flex items-center justify-center text-xs tracking-wider border border-blue-100/50">
                                01
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-foreground uppercase tracking-widest">Basic Details</h3>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Provide the primary organizational parameters.</p>
                            </div>
                        </div>

                        <Card className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/[0.015] via-card to-card hover:border-primary/15 transition-all duration-300 shadow-sm overflow-hidden">
                            <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                                <fieldset disabled={formMode === 'view'} className={cn("contents", formMode === 'view' && "view-mode-fieldset")}>
                                <FormField control={control} name="profileName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Profile Name <span className="text-red-500 font-bold ml-1">*</span></FormLabel>
                                        <FormControl><Input placeholder="e.g. Main Branch Office" {...field} value={field.value || ''} className="h-10 border-slate-300 focus-visible:ring-slate-900 rounded-lg shadow-sm" /></FormControl>
                                        <FormMessage className="text-[10px] font-medium text-slate-400 uppercase mt-1" />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={control} name="primaryConstitution" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Primary Constitution <span className="text-red-500 font-bold ml-1">*</span></FormLabel>
                                            <Select
                                                disabled={formMode === 'view'}
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
                                            <FormLabel className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Sub Type <span className="text-red-500 font-bold ml-1">*</span></FormLabel>
                                            <Select
                                                disabled={formMode === 'view' || !watchPrimary || availableSubTypes.length === 0}
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
                                                    disabled={formMode === 'view'}
                                                    checked={field.value || false}
                                                    onCheckedChange={handleDefaultToggle}
                                                    className="data-[state=checked]:bg-slate-900 scale-90"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                </fieldset>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Section 2: Dynamic configuration */}
                    {Object.keys(groupedData).length > 0 && (
                        <div className="space-y-8">
                            <div className="flex items-center gap-3 border-b pb-4 border-slate-200/60">
                                <div className="h-8 w-10 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-black rounded-lg flex items-center justify-center text-xs tracking-wider border border-blue-100/50">
                                    02
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-foreground uppercase tracking-widest">Additional Details</h3>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Specialized parameters based on the framework.</p>
                                </div>
                            </div>

                            <Tabs value={currentTab || ''} onValueChange={setCurrentTab} className="w-full">
                                <div className="z-20 bg-background pb-8">
                                    <TabsList className="bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl flex flex-wrap justify-start gap-1 h-auto border border-slate-200/60 dark:border-slate-800/80 shadow-inner">
                                        {Object.entries(groupedData)
                                            .sort(([, a], [, b]) => a.order - b.order)
                                            .map(([key, tab]) => (
                                                <TabsTrigger
                                                    key={key}
                                                    value={key}
                                                    className="rounded-lg h-10 px-6 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all border border-transparent data-[state=active]:border-slate-200/50"
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
                                                            <fieldset disabled={formMode === 'view'} className={cn("contents", formMode === 'view' && "view-mode-fieldset")}>
                                                            <RoleSection
                                                                role={subTab.roleData}
                                                                allRoles={selectedConstitution?.roles || []}
                                                            />
                                                            </fieldset>
                                                        ) : (
                                                            (() => {
                                                                const requiresStakeholder = subTab.sections?.some((s: SectionData) => SECTION_REQUIREMENTS[s.sectionKey]?.requiresStakeholder);
                                                                const stakeholders = watch('roles.stakeholders.members') || [];

                                                                if (requiresStakeholder && stakeholders.length === 0) {
                                                                    return <StakeholderWarning />;
                                                                }

                                                                return (
                                                                    <fieldset disabled={formMode === 'view'} className={cn("contents", formMode === 'view' && "view-mode-fieldset")}>
                                                                    <RHFSectionRenderer sections={subTab.sections} />
                                                                    </fieldset>
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
                                                        <fieldset disabled={formMode === 'view'} className={cn("contents", formMode === 'view' && "view-mode-fieldset")}>
                                                        <RHFSectionRenderer sections={tabData.sections} />
                                                        </fieldset>
                                                    );
                                            })()
                                        )}
                                        {tabKey === 'roles' && selectedConstitution?.roles && selectedConstitution.roles.length > 0 && (
                                            <div className="space-y-6 pt-12 mt-12 border-t border-slate-200/60">
                                                <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                                                    <div className="h-8 w-10 bg-slate-900 text-white font-black rounded-lg flex items-center justify-center text-xs border border-slate-800">
                                                        <Shield className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-slate-900 dark:text-foreground uppercase tracking-widest">Authority Delegation</h3>
                                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Assign authorized signatories and designate primary representatives.</p>
                                                    </div>
                                                </div>
                                                <fieldset disabled={formMode === 'view'} className={cn("contents", formMode === 'view' && "view-mode-fieldset")}>
                                                <GeneralSection allRoles={selectedConstitution?.roles || []} />
                                                </fieldset>
                                            </div>
                                        )}
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </div>
                    )}



                        </div>
                        
                        {/* Sticky Footer */}
                        <div className="bg-background/95 backdrop-blur-sm sticky bottom-0 z-30 border-t border-border/80 px-6 py-4 flex items-center justify-end gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
                            <Button type="button" variant="ghost" onClick={onCancel} className="h-11 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 transition-all">
                                {formMode === 'view' ? 'Close' : 'Discard Changes'}
                            </Button>
                            {formMode !== 'view' && (
                                <Button 
                                    type="submit" 
                                    disabled={isSaving} 
                                    className="h-11 px-8 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all duration-150 active:scale-95 disabled:bg-slate-400 hover:-translate-y-0.5 active:translate-y-0"
                                >
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
                                <fieldset disabled={formMode === 'view'} className={cn("contents", formMode === 'view' && "view-mode-fieldset")}>
                                <CompanyBrandingForm businessProfileId={existingProfile.id} isGlobal={false} />
                                </fieldset>
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

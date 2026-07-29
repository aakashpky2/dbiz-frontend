'use client';
import { apiFetch } from '@/lib/apiFetch';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useForm, useFieldArray, FormProvider, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Loader2, PlusCircle, Trash2, Copy, CheckCircle, Edit, AlertTriangle, AlertCircle as AlertCircleIcon, User, FileText, Users, Phone, Mail, Image as ImageIcon, FileUp, ShieldCheck, UserPlus, Building } from 'lucide-react';
import { type BusinessTypeSetup, type FieldDefinitionData, type Role, useProfiles } from '@/hooks/use-profiles';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn, flattenFields } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { PhoneInput } from '@/components/ui/phone-input';
import { normalizeStage } from '@/app/dashboard/work/proposals/_components/CRMFollowUpModal/lib/workflowEngine';
import { getMemberDisplayName, normalizeMemberForSave } from '@/lib/member-name-utils';
import { parsePhoneFromPayload, formatPhoneForPayload, sanitizePhoneInput, isValidLocalPhone, PHONE_ERROR_MESSAGE, parsePhoneNumber, formatPhoneNumber, phoneValidation } from '@/lib/phone-utils';
import { CountryCodeSelect } from '@/components/common/CountryCodeSelect';
import { Switch } from '@/components/ui/switch';

// --- ROBUST UTILITY FUNCTIONS ---

/**
 * Deep cleans an object by removing undefined, null, "", {}, [].
 * Standardized across frontend and backend.
 */
const deepClean = (obj: any): any => {
    if (obj === null || obj === undefined || obj === "") return undefined;
    
    if (Array.isArray(obj)) {
        const cleaned = obj.map(item => deepClean(item))
            .filter(item => item !== undefined && item !== null && item !== "" && (typeof item !== 'object' || Object.keys(item).length > 0));
        return cleaned.length > 0 ? cleaned : undefined;
    }
    
    if (typeof obj === 'object') {
        const cleaned: any = {};
        let hasPayload = false;
        
        for (const [key, value] of Object.entries(obj)) {
            const cleanedValue = deepClean(value);
            
            if (cleanedValue === undefined || cleanedValue === null || cleanedValue === "") {
                continue;
            }
            
            if (typeof cleanedValue === 'object' && Object.keys(cleanedValue).length === 0) {
                continue;
            }
            
            cleaned[key] = cleanedValue;
            hasPayload = true;
        }
        return hasPayload ? cleaned : undefined;
    }
    
    return obj;
};

/**
 * Extracts the core number part from a variety of phone input formats (string, object, etc.)
 */
function getPhoneNumberPart(value: any, fallbackCountryCode = '+91') {
    if (!value) return '';
    
    let rawValue = value;
    if (typeof value === 'object') {
        rawValue = value.number || value.phone || value.value || '';
    }
    
    // Use the robust utility if available
    const parsed = parsePhoneNumber(String(rawValue), fallbackCountryCode);
    return parsed.number || String(rawValue).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
}

const ensureId = (id?: string | null) => id || crypto.randomUUID();

const isValidUuid = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
};

const normalizePhone = (value: any, fallbackCountryCode = '+91') => {
    const { number } = parsePhoneFromPayload(String(value || ''), fallbackCountryCode);
    return sanitizePhoneInput(number || String(value || ''));
};

// Client Data Structure
export interface Client {
    id: string;
    clientName: string;
    constitutionId: string;
    reference: 'Direct' | 'Associate';
    sourceType?: 'Direct' | 'Associate' | null; // Match reference for validation
    associateId?: string | null;
    remarks?: string | null;
    contacts: {
        _id: string;
        sourceType: 'manual' | 'signatory' | 'import';
        name?: string | null;
        email?: string | null;
        phone?: string | null; // Combined
        countryCode?: string | null;
        description?: string | null;
        memberId?: string | null;
    }[];
    fields: Record<string, any>;
    roles: Record<string, {
        members: { _id: string; details: Record<string, any> }[];
    }>;
    signatories?: {
        roleKey: string;
        memberId: string; // Use stable ID
    }[];
    primarySignatories?: Record<string, string | undefined>; // { [roleKey]: memberId }
    completionStatus: 'Complete' | 'Incomplete';
    changeStatus: 'Pending' | 'Validated';
    createdAt?: number | object;
    updatedAt?: number | object;
    originalData?: any;
    profileId?: string;
    client_type?: string;
}
export type ClientFormValues = Omit<Client, 'id' | 'completionStatus' | 'changeStatus' | 'createdAt' | 'updatedAt' | 'originalData'>;

// --- Zod Schema Generation ---
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const getFieldMaxLength = (field: FieldDefinitionData) => {
  const max = Number(field?.maxLength || 0);
  return Number.isFinite(max) && max > 0 ? max : undefined;
};

const isExactLengthField = (field: FieldDefinitionData) => {
  const type = String(field?.fieldType || '').toUpperCase();
  const name = String(field?.fieldName || '').toUpperCase();
  const key = String(field?.fieldKey || '').toUpperCase();

  return (
    type === 'PAN' ||
    type === 'GSTIN' ||
    name.includes('DPIN') ||
    key.includes('DPIN') ||
    name.includes('DIN') ||
    key.includes('DIN')
  );
};

const createFieldValidator = (field: FieldDefinitionData): z.ZodTypeAny => {
    // For dynamic fields, we make them optional in the Zod schema 
    // and handle mandatory validation via RHF rules to support visibility-based requirements.
    let validator: z.ZodTypeAny = z.string().optional().or(z.literal(''));

    const maxLength = getFieldMaxLength(field);
    const isExact = isExactLengthField(field);

    switch (field.fieldType) {
        case 'Email': 
            validator = z.string().optional().or(z.literal('')).refine((val: string | undefined) => !val || z.string().email().safeParse(val).success, { message: `Invalid Email format.` });
            break;
        case 'PAN': 
            validator = z.string().optional().or(z.literal('')).refine((val: string | undefined) => !val || PAN_REGEX.test(val), { message: `Invalid PAN format.` });
            break;
        case 'GSTIN': 
            validator = z.string().optional().or(z.literal('')).refine((val: string | undefined) => !val || GSTIN_REGEX.test(val), { message: `Invalid GSTIN format.` });
            break;
        case 'Number': 
            validator = z.string().optional().or(z.literal('')).refine((val: string | undefined) => !val || /^\d*$/.test(val), { message: `Must only contain numbers.` });
            break;
        case 'Phone': 
            // Optional: only validate if value exists. Must be 10 digits.
            validator = z.string().optional().or(z.literal('')).refine((val: string | undefined) => {
                if (!val) return true;
                return isValidLocalPhone(sanitizePhoneInput(val));
            }, { message: "Phone number must be exactly 10 digits (Local)" });
            break;
    }

    // Add MaxLength validation
    if (maxLength) {
        validator = validator.refine((val: string) => !val || val.length <= maxLength, {
            message: `${field.fieldName || field.fieldKey} cannot exceed ${maxLength} characters.`
        });
        
        if (isExact) {
            // For Exact length fields, they MUST be exactly maxLength if not empty
            validator = validator.refine((val: string) => !val || val.length === maxLength, {
                message: `${field.fieldName || field.fieldKey} must be exactly ${maxLength} characters.`
            });
        }
    }

    return validator;
};

const generateSchema = (constitution: BusinessTypeSetup | null | undefined, hasSubcategories: boolean = true) => {
    const baseSchema = {
        clientName: z.string().min(1, "Client name is required.").max(100, "Client name cannot exceed 100 characters."),
        constitutionId: hasSubcategories ? z.string().min(1, "Please select a subcategory.") : z.string().optional(),
        client_type: z.string().min(1, "Client type is required").default('direct'),
        reference: z.enum(['Direct', 'Associate']),
        sourceType: z.enum(['Direct', 'Associate']).optional(),
        associateId: z.string().nullable().optional(),
        profileId: z.string().optional(),
        remarks: z.string().optional(),
        contacts: z.array(z.object({
            _id: z.string().optional().default(''),
            sourceType: z.enum(['manual', 'signatory', 'import']).default('manual'),
            name: z.string().optional().nullable(),
            email: z.string().optional().nullable().or(z.literal('')),
            phone: z.string().optional().nullable(),
            countryCode: z.string().optional().nullable().default('+91'),
            description: z.string().optional().nullable(),
            memberId: z.string().optional().nullable()
        }).superRefine((contact, ctx) => {
            const hasName = !!(contact.name || '').trim();
            const number = getPhoneNumberPart(contact.phone, contact.countryCode || '+91');
            const hasPhone = !!number;

            // Name is required if ANY field is filled
            if (hasName || contact.email || hasPhone) {
                if (!hasName) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Name is required' });
                }
                if (contact.email && !z.string().email().safeParse(contact.email).success) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Invalid email' });
                }
                if (hasPhone) {
                    const countryCode = contact.countryCode || '+91';
                    if (!isValidLocalPhone(sanitizePhoneInput(number))) {
                        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: PHONE_ERROR_MESSAGE });
                    }
                }
            }
        })).default([]),
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
        return z.object({ ...baseSchema, fields: z.record(z.string(), z.any()).default({}), roles: z.record(z.string(), z.any()).default({}) });
    }

    const topLevelFieldsShape: Record<string, z.ZodTypeAny> = {};
    const flatRequiredFields = (constitution?.requiredFields || []).flatMap((f: any) => Array.isArray(f?.fields) ? f.fields : [f]);
    
    flatRequiredFields.forEach((field: any) => {
        if (!field || !field.fieldKey) return;
        topLevelFieldsShape[field.fieldKey] = createFieldValidator(field);
    });

    const rolesShape: Record<string, z.ZodTypeAny> = {};
    (constitution?.roles || []).forEach((role: any) => {
        const memberDetailsShape: Record<string, z.ZodTypeAny> = {};

        const flatRequiredDetails = (role?.requiredDetails || []).flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[]);

        flatRequiredDetails.forEach((field: any) => {
            if (!field || !field.fieldKey) return;
            memberDetailsShape[field.fieldKey] = createFieldValidator(field);
        });

        if (role.designations && role.designations.length > 0) {
            memberDetailsShape['designation'] = z.string().min(1, "Designation is required.");
        }

        const memberSchema = z.object({
            _id: z.string().default(''),
            details: z.object(memberDetailsShape)
        });

        let membersArrayValidator: z.ZodTypeAny = z.array(memberSchema);
        if (role.maxMembers > 0) membersArrayValidator = (membersArrayValidator as z.ZodArray<any>).max(role.maxMembers, `No more than ${role.maxMembers} members allowed for the ${role.roleName} role.`);

        rolesShape[role.roleKey] = z.object({
            members: membersArrayValidator.optional().refine(
                (members = []) => {
                    const names = members.map((m: { details?: { full_name?: string } }) => (m.details?.full_name || '').trim().toLowerCase()).filter(Boolean);
                    const uniqueNames = new Set(names);
                    return uniqueNames.size === names.length;
                },
                { message: "Duplicate member names are not allowed in the same role." }
            )
        }).optional();
    });

    return z.object({ 
        ...baseSchema, 
        fields: z.object(topLevelFieldsShape).optional().default({}), 
        roles: z.object(rolesShape).optional().default({}) 
    })
        .refine(data => data.reference !== 'Associate' || (data.associateId && data.associateId !== '0' && data.associateId !== ''), {
            message: "Associate name is required when reference is 'Associate'.",
            path: ["associateId"],
        });
};

const isValueBlank = (value: any): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return true;
    return false;
};

export const hasBlankFields = (data: ClientFormValues | Client, constitution: BusinessTypeSetup | null): boolean => {
    if (!constitution) return true;
    // 1. Core identifying fields
    if (isValueBlank(data.clientName) || isValueBlank(data.constitutionId)) return true;
    if (data.reference === 'Associate' && isValueBlank(data.associateId)) return true;

    // 2. Constitutional fields (Check ALL fields regardless of requirement)
    const allExpectedFields = (constitution.requiredFields || (constitution as any).required_fields || [])
        .flatMap((f: any) => Array.isArray(f.fields) ? f.fields : [f])
        .filter((f: any) => f && f.fieldKey && !f.fieldName?.toLowerCase()?.includes('pan copy') && !f.fieldName?.toLowerCase()?.includes('pan proof'));

    const fieldsData = (data.fields as any) || {};
    let flatFields = fieldsData;
    if (Object.values(fieldsData).some(v => typeof v === 'object' && v !== null && !Array.isArray(v))) {
        flatFields = {};
        Object.values(fieldsData).forEach((section: any) => {
            Object.assign(flatFields, section);
        });
    }

    for (const field of allExpectedFields) {
        const isVisible = field.dependsOn ? !isValueBlank(flatFields[field.dependsOn]) : true;
        const isAvailable = field.requirement === 'If Available' ? !!flatFields[`${field.fieldKey}_is_available`] : true;

        if (isVisible && isAvailable) {
            if (isValueBlank(flatFields[field.fieldKey])) return true;
        }
    }

    // 3. Roles and Members
    const rolesData = (data.roles as any) || {};
    const constitutionRoles = constitution.roles || [];
    
    for (const roleDef of constitutionRoles) {
        const members = rolesData[roleDef.roleKey]?.members || [];
        if (roleDef.minMembers > 0 && members.length < roleDef.minMembers) return true;
        
        for (const member of members) {
            const details = member.details || {};
            const roleFields = (roleDef.requiredDetails || []).flatMap((d: any) => Array.isArray(d.fields) ? d.fields : [d]);

            for (const df of roleFields) {
                if (!df || !df.fieldKey) continue;
                
                const isVisible = df.dependsOn ? !isValueBlank(details[df.dependsOn]) : true;
                const isAvailable = df.requirement === 'If Available' ? !!details[`${df.fieldKey}_is_available`] : true;

                if (isVisible && isAvailable) {
                    if (isValueBlank(details[df.fieldKey])) return true;
                }
            }
            if ((roleDef.designations?.length || 0) > 0 && isValueBlank(details.designation)) return true;
        }
    }

    // 4. Signatories & Primary Selection
    const signatories = (data as any).signatories || [];
    if (signatories.length === 0) return true;

    const primarySignatories = (data as any).primarySignatories || (data as any).primary_signatories || {};
    for (const roleDef of constitutionRoles) {
        if (rolesData[roleDef.roleKey]?.members?.length > 0) {
            if (!primarySignatories[roleDef.roleKey]) return true;
        }
    }

    return false;
};

export const hasIncompleteMandatoryFields = (data: ClientFormValues, constitution: BusinessTypeSetup | null): boolean => {
    if (!constitution) return true;

    if (isValueBlank(data.clientName) || isValueBlank(data.constitutionId)) return true;
    if (data.reference === 'Associate' && isValueBlank(data.associateId)) return true;

    const allFields = (constitution?.requiredFields || []).flatMap((f: any) => Array.isArray(f?.fields) ? f.fields : [f]);
    for (const field of allFields.filter((f: any) => f && f.fieldKey && !f.fieldName?.toLowerCase()?.includes('pan copy') && !f.fieldName?.toLowerCase()?.includes('pan proof'))) {
        if (field.requirement === 'Mandatory' && isValueBlank(data.fields?.[field.fieldKey])) return true;
    }

    const hasAnyMembers = Object.values(data.roles || {}).some((role: any) => role.members && role.members.length > 0);

    for (const role of constitution.roles || []) {
        const members = data.roles?.[role.roleKey]?.members || [];
        // Only validate member details if members exist for that role
        if (members.length > 0) {
            for (const member of members) {
                for (const detailField of role.requiredDetails || []) {
                    if (detailField.requirement === 'Mandatory' && isValueBlank(member.details?.[detailField.fieldKey])) return true;
                }
                if ((role.designations?.length || 0) > 0 && isValueBlank(member.details.designation)) return true;
            }
        }
    }

    // Do NOT block initial save based on signatories
    // if (hasAnyMembers) {
    //     if (!data.signatories || data.signatories.length === 0) return true;
    //     if (!data.primarySignatories || Object.values(data.primarySignatories).filter(Boolean).length === 0) return true;
    // }

    return false;
};

type Issue = { tabId?: string; message: string; type: 'error' | 'warning' };

const listPendingMandatoryIssues = (
    data: ClientFormValues,
    constitution: BusinessTypeSetup | null | undefined
): Issue[] => {
    const issues: Issue[] = [];
    if (!constitution) {
        if (!data.constitutionId) issues.push({ tabId: 'general', message: 'Select a business constitution', type: 'error' });
        return issues;
    }

    if (isValueBlank(data.clientName)) issues.push({ tabId: 'general', message: 'Client Name is required', type: 'error' });
    if (isValueBlank(data.constitutionId)) issues.push({ tabId: 'general', message: 'Business Constitution is required', type: 'error' });
    if (data.reference === 'Associate' && isValueBlank(data.associateId)) {
        issues.push({ tabId: 'general', message: 'Associate Name is required (since reference is Associate)', type: 'error' });
    }

    const allFields = (constitution?.requiredFields || []).flatMap((f: any) => Array.isArray(f?.fields) ? f.fields : [f]);
    for (const f of allFields.filter((field: any) => field && field.fieldKey && !field.fieldName?.toLowerCase()?.includes('pan copy') && !field.fieldName?.toLowerCase()?.includes('pan proof'))) {
        const isVisible = f.dependsOn ? !isValueBlank(data.fields?.[f.dependsOn]) : true;
        const isAvailable = f.requirement === 'If Available' ? !!data.fields?.[`${f.fieldKey}_is_available`] : true;

        if (isVisible && isAvailable) {
            if (f.requirement === 'Mandatory' && isValueBlank(data.fields?.[f.fieldKey])) {
                issues.push({ tabId: 'constitution', message: `Constitution Details → ${f.fieldName}`, type: 'error' });
            }
        }
    }

    const hasAnyMembers = Object.values(data.roles || {}).some((role: any) => role.members && role.members.length > 0);

    for (const role of constitution.roles || []) {
        const members = data.roles?.[role.roleKey]?.members || [];

        if (role.minMembers > 0 && members.length < role.minMembers) {
            issues.push({
                tabId: 'roles',
                message: `Role "${role.roleName}": at least ${role.minMembers} member(s) required (currently ${members.length})`,
                type: 'warning'
            });
        }

        if (members.length > 0) {
            members.forEach((member, idx) => {
                const roleFields = (role.requiredDetails || []).flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[]);
                
                for (const df of roleFields) {
                    if (!df || !df.fieldKey) continue;

                    const isVisible = df.dependsOn ? !isValueBlank(member?.details?.[df.dependsOn]) : true;
                    const isAvailable = df.requirement === 'If Available' ? !!member?.details?.[`${df.fieldKey}_is_available`] : true;

                    if (isVisible && isAvailable) {
                        if (df.requirement === 'Mandatory' && isValueBlank(member?.details?.[df.fieldKey])) {
                            issues.push({ tabId: 'roles', message: `Role "${role.roleName}" → Member ${idx + 1}: ${df.fieldName}`, type: 'error' });
                        }
                    }
                }
                
                if ((role.designations?.length || 0) > 0 && isValueBlank(member?.details?.designation)) {
                    issues.push({ tabId: 'roles', message: `Role "${role.roleName}" → Member ${idx + 1}: Designation`, type: 'error' });
                }
            });
        }
    }

    if (hasAnyMembers) {
        if (!data.signatories || data.signatories.length === 0) {
            issues.push({ tabId: 'signatories', message: 'Signatory Management: At least one member must be selected as a signatory.', type: 'warning' });
        }
        if (!data.primarySignatories || Object.values(data.primarySignatories).filter(Boolean).length === 0) {
            issues.push({ tabId: 'signatories', message: 'Signatory Management: At least one primary signatory must be selected.', type: 'warning' });
        }
    } else {
        issues.push({ tabId: 'roles', message: 'Roles & Members: No members added yet.', type: 'warning' });
        issues.push({ tabId: 'signatories', message: 'Signatory Management: No signatories selected.', type: 'warning' });
    }

    return issues;
};

// Removed PanProofUpload component as per requirement

// --- Main Form Component ---
interface ClientFormProps {
    initialData?: Client | null;
    onSave: (data: ClientFormValues, constitution: BusinessTypeSetup | null) => void;
    onCancel: () => void;
    isSubmitting: boolean;
    constitutions: BusinessTypeSetup[];
    associates: { id: string; name: string }[];
    isValidationMode?: boolean;
    changedFields?: string[];
    mode?: 'add' | 'edit' | 'view';
}

const NAME_KEYS = ['full_name', 'name', 'partner_name', 'director_name', 'member_name'];
const EMAIL_KEYS = ['email_id', 'email', 'mail', 'email_address', 'emailAddress', 'e_mail'];
const PHONE_KEYS = ['mobile_no', 'phone', 'contact_no', 'mobile', 'phone_number', 'phoneNumber'];



const pickFirst = (obj: Record<string, any> | undefined, keys: string[], isPhone = false) => {
    const val = keys.map(k => obj?.[k]).find(val => val !== undefined && val !== null && val !== '');
    if (!val) return '';
    return isPhone ? normalizePhone(val) : String(val);
};

export const ClientForm: React.FC<ClientFormProps> = (props) => {
    const { initialData, constitutions } = props;
    const [constitutionId, setConstitutionId] = useState(
        initialData?.constitutionId || ''
    );

    // 🔥 Sync local state with initialData when it loads/changes
    useEffect(() => {
        if (initialData?.constitutionId) {
            const savedId = String(initialData.constitutionId);
            if (savedId !== String(constitutionId)) {
                setConstitutionId(savedId);
            }
        }
    }, [initialData?.constitutionId, constitutionId]);


    // Return the inner form even if constitutionId is empty to allow initial selection
    return (
        <InnerClientForm
            {...props}
            selectedConstitutionId={constitutionId}
            onConstitutionChange={setConstitutionId}
        />
    );
}

interface InnerClientFormProps extends ClientFormProps {
    selectedConstitutionId: string;
    onConstitutionChange: (id: string) => void;
}

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


function InnerClientForm({
    initialData, onSave, onCancel, isSubmitting, constitutions, associates,
    isValidationMode = false, changedFields = [], selectedConstitutionId, onConstitutionChange, mode = 'add'
}: InnerClientFormProps) {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [attemptedTabs, setAttemptedTabs] = useState<Record<string, boolean>>({});
    
    const { profiles, loading: profilesLoading } = useProfiles();
    const { toast } = useToast();

    useEffect(() => {
        setHasAttemptedSubmit(false);
        setActiveTab('general');
        setAttemptedTabs({});
    }, [initialData?.id]);

    const sortedProfiles = useMemo(() => {
        if (!profiles) return [];
        return [...profiles].sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.profileName.localeCompare(b.profileName);
        });
    }, [profiles]);

    const selectedConstitutionForRender = useMemo(() => {
        if (!selectedConstitutionId) return null;
        return constitutions.find(c => String(c.id) === String(selectedConstitutionId));
    }, [constitutions, selectedConstitutionId]);

    const availableTabs = useMemo(() => {
        const tabs = ['general'];
        if (selectedConstitutionForRender) {
            if (selectedConstitutionForRender.requiredFields?.length > 0) tabs.push('constitution');
            if (selectedConstitutionForRender.roles?.length > 0) tabs.push('roles');
            tabs.push('contact');
            tabs.push('signatories');
        }
        return tabs;
    }, [selectedConstitutionForRender]);

    useEffect(() => {
        if (!availableTabs.includes(activeTab)) {
            setActiveTab('general');
        }
    }, [availableTabs, activeTab]);

    const primaryTypes = useMemo(() => {
        const types: string[] = [];
        constitutions.forEach(c => {
            if (!types.includes(c.businessType)) {
                types.push(c.businessType);
            }
        });
        return types;
    }, [constitutions]);

    const [clientTypes, setClientTypes] = useState<{label: string, value: string}[]>([]);
    const [loadingClientTypes, setLoadingClientTypes] = useState(true);

    useEffect(() => {
        const fetchClientTypes = async () => {
            try {
                // Future-proof: attempt to fetch from master data API if implemented
                const res = await fetch('/api/master-data?type=client_type');
                if (!res.ok) throw new Error('API not available');
                const result = await res.json();
                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    setClientTypes(result.data);
                    return;
                }
                throw new Error('No data');
            } catch (err) {
                console.warn("[CLIENT_FORM] Client types missing from master data. Using fallback options.");
                setClientTypes([
                    { label: "Direct", value: "direct" },
                    { label: "Associate", value: "associate" },
                    { label: "Indirect", value: "indirect" },
                    { label: "Referral", value: "referral" }
                ]);
            } finally {
                setLoadingClientTypes(false);
            }
        };
        fetchClientTypes();
    }, []);

    const [localPrimaryType, setLocalPrimaryType] = useState<string>('');

    const primaryType = localPrimaryType;

    const availableSubTypes = useMemo(() => {
        if (!primaryType) return [];
        return constitutions.filter(c => c.businessType === primaryType);
    }, [constitutions, primaryType]);

    const handlePrimaryTypeChange = (val: string) => {
        setLocalPrimaryType(val);
        if (!val) {
            setValue('constitutionId', '');
            onConstitutionChange('');
            return;
        }

        const subTypes = constitutions.filter(c => c.businessType === val);
        
        if (subTypes.length === 1) {
            const targetId = subTypes[0].id;
            setValue('constitutionId', targetId);
            onConstitutionChange(targetId);
        } else {
            // Multiple subtypes: clear current ID so user can pick from the new subcategory
            setValue('constitutionId', '');
            onConstitutionChange('');
        }
    };

    const score = (f: any) => {
        const name = f.fieldName?.toLowerCase() || '';
        if (name.includes('address')) return 1;
        if (name.includes('phone') || name.includes('mobile')) return 2;
        if (name.includes('email')) return 3;
        if (f.fieldType === 'PAN' || name.includes('pan')) return 4;
        if (name.includes('gst')) return 5;
        return 10;
    };

    const constitutionFields = useMemo(() => {
        const sectionsData = selectedConstitutionForRender?.requiredFields || (selectedConstitutionForRender as any)?.required_fields || [];
        return sectionsData
            .flatMap((f: any) => Array.isArray(f?.fields) ? f.fields : [f])
            .filter((f: any) => f && f.fieldKey && f.fieldName?.toLowerCase() !== 'pan copy');
    }, [selectedConstitutionForRender]);

    const constitutionSections = useMemo(() => {
        const sectionsData = selectedConstitutionForRender?.requiredFields || (selectedConstitutionForRender as any)?.required_fields || [];
        if (!sectionsData.length) return [];

        return sectionsData
            .map((section: any, index: number) => ({
                key: section.sectionKey || `section_${index}`,
                title: section.sectionName || `Section ${index + 1}`,
                fields: Array.isArray(section.fields) 
                    ? section.fields.filter((f: any) => f && f.fieldKey && f.fieldName?.toLowerCase() !== 'pan copy') 
                    : []
            }))
            .filter((section: any) => section.fields.length > 0);
    }, [selectedConstitutionForRender]);

    const hasSubcategories = useMemo(() => {
        if (!localPrimaryType) return false;
        const subTypes = constitutions.filter(c => c.businessType === localPrimaryType);
        return subTypes.some(c => c.businessSubType && c.businessSubType.trim() !== '');
    }, [constitutions, localPrimaryType]);

    const formSchema = useMemo(() => generateSchema(selectedConstitutionForRender, hasSubcategories), [selectedConstitutionForRender, hasSubcategories]);

    const defaultVals = useMemo(() => {
        const defaults = {
            clientName: initialData?.clientName || '',
            client_type: String(initialData?.client_type || (initialData as any)?.clientType || 'direct').toLowerCase(),
            constitutionId: initialData?.constitutionId || selectedConstitutionId || '',
            reference: initialData?.reference || 'Direct',
            sourceType: (initialData as any)?.sourceType || (initialData?.reference) || 'Direct',
            associateId: initialData?.associateId || null,
            remarks: initialData?.remarks || '',
            signatories: initialData?.signatories || [],
            primarySignatories: initialData?.primarySignatories || {},
            profileId: initialData?.profileId || '',
            // contacts.phone stores full phone (+91XXXXXXXXXX) for PhoneInput
            contacts: (initialData?.contacts || []).map(c => {
                const { countryCode: cCC, number: cNum } = parsePhoneFromPayload(c.phone || "", c.countryCode || "+91");
                return {
                    ...c,
                    name: c.name || '',
                    email: c.email || '',
                    phone: cNum,
                    countryCode: cCC,
                    description: c.description || '',
                    memberId: c.memberId || ''
                };
            }),
            fields: {} as Record<string, any>,
            roles: {} as Record<string, any>
        };

        // Handle dynamic roles — phone fields use full phone format for PhoneInput
        if (selectedConstitutionForRender?.roles) {
            selectedConstitutionForRender.roles.forEach((role: any) => {
                const existingMembers = (initialData?.constitutionId === selectedConstitutionId ? initialData?.roles?.[role.roleKey]?.members : []) || [];
                const roleFieldDefs = (role.requiredDetails || []).flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[]);
                const formattedMembers = existingMembers.map((member: any) => ({
                    _id: member._id || crypto.randomUUID(),
                    details: member.details ? Object.fromEntries(
                        Object.entries(member.details).map(([k, v]) => {
                            const fieldDef = roleFieldDefs.find((f: any) => f.fieldKey === k);
                            if (fieldDef?.fieldType === 'Phone') {
                                const ccKey = `${k}_countryCode`;
                                const { number: rNum } = parsePhoneNumber(String(v) || "", (member.details[ccKey] as string) || "+91");
                                return [k, rNum || ""];
                            }
                            return [k, v];
                        })
                    ) : {}
                }));
                defaults.roles[role.roleKey] = { members: formattedMembers };
            });
        }

        // Handle dynamic fields — Phone fields produce full phone + countryCode key
        const flatInitialFields = flattenFields(initialData?.fields || {});
        if (constitutionFields.length > 0) {
            constitutionFields.forEach((field: any) => {
                let val = (flatInitialFields[field.fieldKey]) ?? '';

                // HEURISTIC: If exact key didn't match, try matching by label/name
                // only for new clients from proposals where we passed "commonFields"
                const isNewFromProposal = initialData && !initialData.id;
                if (!val && isNewFromProposal) {
                    const label = `${field.fieldName || ''} ${field.fieldKey || ''}`.toLowerCase();
                    const isPhoneField = label.includes('mobile') || label.includes('phone') || label.includes('contact');
                    const isEmailField = label.includes('email') || label.includes('mail');

                    if (isPhoneField) {
                        const phoneEntry = Object.entries(flatInitialFields).find(([k, v]) => {
                            const l = k.toLowerCase();
                            return (l.includes('mobile') || l.includes('phone') || l.includes('contact')) && v;
                        });
                        if (phoneEntry) val = phoneEntry[1];
                    } else if (isEmailField) {
                        const emailEntry = Object.entries(flatInitialFields).find(([k, v]) => {
                            const l = k.toLowerCase();
                            return (l.includes('email') || l.includes('mail')) && v;
                        });
                        if (emailEntry) val = emailEntry[1];
                    }
                }

                if (field.fieldType === 'Phone') {
                    const storedCC = (flatInitialFields[`${field.fieldKey}_countryCode`] || flatInitialFields[`${field.fieldKey}CountryCode`] || '+91');
                    const { countryCode: parsedCC, number: parsedNum } = parsePhoneFromPayload(String(val) || "", storedCC);
                    val = parsedNum;
                    // Pre-populate countryCode key so submit normalizer has it
                    defaults.fields[`${field.fieldKey}_countryCode`] = parsedCC;
                }
                defaults.fields[field.fieldKey] = val;
            });
        }

        return defaults;
    }, [initialData, selectedConstitutionForRender, selectedConstitutionId, constitutionFields]);

    const methods = useForm<ClientFormValues>({
        resolver: zodResolver(formSchema as any),
        defaultValues: {
            ...defaultVals,
            fields: defaultVals.fields || {},
            roles: defaultVals.roles || {},
            contacts: defaultVals.contacts || [],
            signatories: defaultVals.signatories || [],
            primarySignatories: defaultVals.primarySignatories || {}
        },
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const { 
        control, 
        handleSubmit, 
        watch, 
        getValues, 
        setValue, 
        reset, 
        trigger,
        clearErrors,
        formState: { errors } 
    } = methods;

    const watchedValues = useWatch({ 
        control,
        name: ['constitutionId', 'profileId', 'clientName', 'reference', 'client_type', 'roles', 'fields', 'contacts']
    }) as any;
    
    // Helper to get watched values safely
    const watchedConstitutionId = watchedValues[0];
    const watchedProfileId = watchedValues[1];
    const watchedClientName = watchedValues[2];
    const watchedReferenceValue = watchedValues[3];
    const watchedClientType = watchedValues[4];

    const watchedRolesValue = watchedValues[5];
    const watchedFieldsValue = watchedValues[6];
    const watchedContactsValue = watchedValues[7];

    // 🔥 STEP 1: FIX SUBCATEGORY SYNC & ERROR CLEARING
    useEffect(() => {
        if (!initialData?.constitutionId || constitutions.length === 0) return;

        const savedId = String(initialData.constitutionId);
        const matched = constitutions.find(c => String(c.id) === savedId);
        
        if (matched) {
            const normalizedId = String(matched.id);

            // Ensure Primary Category is derived and set
            if (localPrimaryType !== matched.businessType) {
                setLocalPrimaryType(matched.businessType);
            }

            // Ensure parent state is synced (required for rendering tabs and constitution sections)
            if (String(selectedConstitutionId) !== normalizedId) {
                onConstitutionChange(normalizedId);
            }

            // Ensure form state is synced (required for Subcategory Select to display properly)
            if (watchedConstitutionId !== normalizedId) {
                setValue('constitutionId', normalizedId);
            }
        }
    }, [initialData?.constitutionId, constitutions, localPrimaryType, selectedConstitutionId, watchedConstitutionId, setValue, onConstitutionChange]);

    // 🔥 STEP 2: FIX PROCESSING BRANCH LOADING
    useEffect(() => {
        if (!initialData?.profileId || profiles.length === 0) return;

        const normalizedProfileId = String(initialData.profileId);
        if (String(watchedProfileId || '') !== normalizedProfileId) {
            setValue('profileId', normalizedProfileId, {
                shouldDirty: false,
                shouldValidate: false,
            });
        }
    }, [initialData?.profileId, profiles, setValue, watchedProfileId]);

    // Debugging: Monitor data flow
    useEffect(() => {
        console.log('ClientForm Data Flow:', {
            initialDataId: initialData?.id,
            selectedConstitutionId,
            isOptionsLoaded: constitutions.length > 0,
            hasConstitutionData: !!selectedConstitutionForRender,
            currentFormConstitutionId: watchedConstitutionId
        });
    }, [initialData, selectedConstitutionId, constitutions, selectedConstitutionForRender, watchedConstitutionId]);

    const isOptionsLoaded = constitutions.length > 0;

    // 🔥 STABLE STATE MANAGEMENT
    const prevIdRef = React.useRef(selectedConstitutionId);
    const hasHydratedRef = React.useRef(false);

    useEffect(() => {
        if (constitutions.length === 0) return;

        const isNewFromProposal = initialData && !initialData.id;

        if (!initialData || isNewFromProposal) {
            // CREATE MODE: Surgical reset to avoid wiping clientName/remarks
            if (selectedConstitutionId !== prevIdRef.current) {
                if (isNewFromProposal) {
                    setValue('fields', defaultVals.fields || {}, { shouldDirty: true });
                    setValue('roles', defaultVals.roles || {}, { shouldDirty: true });
                } else {
                    setValue('fields', {}, { shouldDirty: true });
                }

                setValue('signatories', [], { shouldDirty: true });
                setValue('primarySignatories', {}, { shouldDirty: true });
                prevIdRef.current = selectedConstitutionId;
            }
        } else if (!hasHydratedRef.current || String(initialData.id) !== prevIdRef.current) {
            // EDIT MODE: Only reset when initialData is loaded or client changes
            reset(defaultVals);
            prevIdRef.current = String(initialData.id);
            hasHydratedRef.current = true;
        }
    }, [selectedConstitutionId, initialData, constitutions.length, reset, defaultVals, setValue]);
    const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({ control, name: 'contacts' });

    // Auto-populate from default profile if it exists and we're creating a new client
    useEffect(() => {
        if (!initialData && selectedConstitutionId && !profilesLoading && profiles.length > 0) {
            // Check if form is still empty (at least clientName) before auto-populating
            const currentName = watch('clientName');
            if (!currentName) {
                const defaultProfile = profiles.find((p: any) => p.constitutionId === selectedConstitutionId && p.isDefault);
                if (defaultProfile) {
                    setValue('clientName', defaultProfile.profileName, { shouldDirty: true });
                    setValue('fields', defaultProfile.fields || {}, { shouldDirty: true });
                    setValue('roles', defaultProfile.roles || {}, { shouldDirty: true });
                    setValue('signatories', defaultProfile.signatories || [], { shouldDirty: true });
                    setValue('primarySignatories', defaultProfile.primarySignatories || {}, { shouldDirty: true });
                    
                    toast({
                        title: "Auto-Populated",
                        description: `Loaded details from default profile: "${defaultProfile.profileName}"`
                    });
                }
            }
        }
    }, [selectedConstitutionId, profiles, profilesLoading, initialData, setValue, watch, toast]);

    // Automatically select the default profile ID on mount if in create mode
    useEffect(() => {
        if (!initialData && !profilesLoading && profiles.length > 0) {
            const currentProfileId = watch('profileId');
            if (!currentProfileId) {
                const defaultProfile = profiles.find((p: any) => p.isDefault) || (profiles.length > 0 ? profiles[0] : null);
                if (defaultProfile) {
                    setValue('profileId', defaultProfile.id, { shouldDirty: true });
                }
            }
        }
    }, [profiles, profilesLoading, initialData, setValue, watch]);

    const watchedReference = watch('reference');
    const watchedContacts = watch('contacts');
    const watchedRoles = watch('roles');

    const allPendingIssues = useMemo(() => {
        const completenessIssues = listPendingMandatoryIssues(getValues() as ClientFormValues, selectedConstitutionForRender);
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
    }, [errors, selectedConstitutionForRender, getValues]);

    const criticalErrors = useMemo(() => allPendingIssues.filter(i => i.type === 'error'), [allPendingIssues]);
    const warnings = useMemo(() => allPendingIssues.filter(i => i.type === 'warning'), [allPendingIssues]);

    // Combine RHF errors with criticalErrors mapped to tabs
    const errorsByTab = useMemo(() => {
        const result: Record<string, string[]> = { general: [], constitution: [], roles: [], contact: [], signatories: [] };
        
        // Add RHF errors
        if (errors.clientName || errors.constitutionId || errors.reference || errors.associateId || errors.client_type) result.general.push('Please correct general fields.');
        if (errors.fields) result.constitution.push('Please correct constitution fields.');
        if (errors.roles) result.roles.push('Please correct role fields.');
        if (errors.contacts) result.contact.push('Please correct contact fields.');
        if (errors.signatories || errors.primarySignatories) result.signatories.push('Please correct signatory selections.');

        // Add criticalErrors from pending mandatory issues
        criticalErrors.forEach(err => {
            if (err.type === 'error' && err.tabId) {
                if (!result[err.tabId]) result[err.tabId] = [];
                if (!result[err.tabId].includes(err.message)) result[err.tabId].push(err.message);
            }
        });
        return result;
    }, [errors, criticalErrors]);

    const isReady = useMemo(() => {
        if (!selectedConstitutionForRender) return false;
        
        // Basic check for minimal readiness (always required)
        const hasBaseInfo = !isValueBlank(watchedClientName) && !isValueBlank(watchedConstitutionId);
        if (!hasBaseInfo) return false;

        // Strict check: No critical errors allowed before saving (Point 1: "disable the save button till then")
        return criticalErrors.length === 0;
    }, [watchedClientName, watchedConstitutionId, selectedConstitutionForRender, criticalErrors.length]);

    const getFieldClass = (fieldName: string) => isValidationMode && changedFields.includes(fieldName) ? "border-yellow-400 border-2" : "";

    const allMembers = useMemo(() => {
        const people: {
            key: string;
            _id: string;
            name: string; // display label
            role: string;
            roleKey: string;
            details: any;
            derived: { email: string; phone: string; countryCode: string };
        }[] = [];

        if (!watchedRolesValue || !selectedConstitutionForRender?.roles) return people;

        for (const role of selectedConstitutionForRender.roles) {
            const roleKey = role.roleKey;
            const members = watchedRolesValue?.[roleKey]?.members || [];
            members.forEach((member: any, index: number) => {
                if (!member) return;
                const displayName = getMemberDisplayName(member, role.roleName, index);

                people.push({
                    key: `${roleKey}_${index}`,
                    _id: member._id || '',
                    name: displayName,
                    role: role.roleName,
                    roleKey: role.roleKey,
                    details: member.details || {},
                    derived: {
                        email: pickFirst(member.details, EMAIL_KEYS),
                        phone: pickFirst(member.details, PHONE_KEYS, true),
                        countryCode: (() => {
                            const details = member.details || {};
                            const phoneKey = PHONE_KEYS.find(k => details[k] !== undefined);
                            return phoneKey ? (details[`${phoneKey}_countryCode`] || '+91') : '+91';
                        })()
                    },
                });
            });
        }
        return people;
    }, [watchedRolesValue, selectedConstitutionForRender]);

    // Registry sync logic remains...
    // Auto-sync Registry Contacts with Role Members
    useEffect(() => {
        const currentContacts = getValues('contacts') || [];
        let changed = false;
        const nextContacts = currentContacts.map(contact => {
            if (contact.sourceType !== 'import' || !contact.memberId) return contact;
            
            const sourceMember = allMembers.find(m => m._id === contact.memberId);
            if (!sourceMember) return contact;
            
            const updatedEmail = sourceMember.derived.email;
            const updatedPhone = sourceMember.derived.phone;
            const updatedCC = sourceMember.derived.countryCode;
            const updatedName = sourceMember.name;
            
            if (contact.email !== updatedEmail || contact.phone !== updatedPhone || contact.countryCode !== updatedCC || contact.name !== updatedName) {
                changed = true;
                return { ...contact, name: updatedName, email: updatedEmail, phone: updatedPhone, countryCode: updatedCC };
            }
            return contact;
        });
        
        if (changed) {
            setValue('contacts', nextContacts, { shouldDirty: true });
        }
    }, [allMembers, setValue, getValues]);

    // 🔥 STEP 9: TOGGLE / DEPENDENT FIELD LOGIC
    // Auto-cleanup dependent fields when parent toggle is turned off
    const watchedFields = watch('fields');
    const watchedRolesForCleanup = watch('roles');
    useEffect(() => {
        if (!selectedConstitutionForRender) return;
        
        let hasChanges = false;

        // 1. Cleanup top-level constitution fields
        if (watchedFields) {
            const allFields = (selectedConstitutionForRender.requiredFields || [])
                .flatMap((f: any) => Array.isArray(f?.fields) ? f.fields : [f]);
                
            allFields.forEach((field: any) => {
                if (field?.fieldKey) {
                    // Manual dependsOn cleanup
                    if (field.dependsOn) {
                        const parentValue = watchedFields[field.dependsOn];
                        if (parentValue === false || parentValue === undefined || parentValue === '') {
                            if (watchedFields[field.fieldKey] !== '' && watchedFields[field.fieldKey] !== undefined) {
                                setValue(`fields.${field.fieldKey}`, '', { shouldDirty: true });
                                hasChanges = true;
                            }
                        }
                    }
                    // 'If Available' cleanup
                    if (field.requirement === 'If Available') {
                        const toggleValue = watchedFields[`${field.fieldKey}_is_available`];
                        if (!toggleValue) {
                            if (watchedFields[field.fieldKey] !== '' && watchedFields[field.fieldKey] !== undefined) {
                                setValue(`fields.${field.fieldKey}`, '', { shouldDirty: true });
                                hasChanges = true;
                            }
                        }
                    }
                }
            });
        }

        // 2. Cleanup role member details
        if (watchedRolesForCleanup) {
            selectedConstitutionForRender.roles?.forEach((role: any) => {
                const roleFields = (role.requiredDetails || []).flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[]);
                const members = watchedRolesForCleanup[role.roleKey]?.members || [];
                
                members.forEach((member: any, idx: number) => {
                    roleFields.forEach((field: any) => {
                        if (field.fieldKey) {
                            // Manual dependsOn cleanup
                            if (field.dependsOn) {
                                const parentValue = member.details?.[field.dependsOn];
                                if (parentValue === false || parentValue === undefined || parentValue === '') {
                                    if (member.details?.[field.fieldKey] !== '' && member.details?.[field.fieldKey] !== undefined) {
                                        setValue(`roles.${role.roleKey}.members.${idx}.details.${field.fieldKey}`, '', { shouldDirty: true });
                                        hasChanges = true;
                                    }
                                }
                            }
                            // 'If Available' cleanup
                            if (field.requirement === 'If Available') {
                                const toggleValue = member.details?.[`${field.fieldKey}_is_available`];
                                if (!toggleValue) {
                                    if (member.details?.[field.fieldKey] !== '' && member.details?.[field.fieldKey] !== undefined) {
                                        setValue(`roles.${role.roleKey}.members.${idx}.details.${field.fieldKey}`, '', { shouldDirty: true });
                                        hasChanges = true;
                                    }
                                }
                            }
                        }
                    });
                });
            });
        }
        
        if (hasChanges) {
            trigger(); // Re-validate everything to clear errors
        }
    }, [watchedFields, watchedRolesForCleanup, selectedConstitutionForRender, setValue, trigger]);

    const handleFormSubmit = async (values: ClientFormValues) => {
        setHasAttemptedSubmit(true);
        const newAttempted = { ...attemptedTabs };
        availableTabs.forEach(t => newAttempted[t] = true);
        setAttemptedTabs(newAttempted);

        if (!isReady) {
            await methods.trigger();
            const firstErrorTab = availableTabs.find(tab => errorsByTab[tab]?.length > 0);
            if (firstErrorTab) setActiveTab(firstErrorTab);
            
            toast({
                title: "Validation Error",
                description: "Required fields are missing across the form tabs. Please review the highlighted sections.",
                variant: "destructive"
            });
            return;
        }
        
        // STEP 11: FINAL SUBMISSION PIPELINE
        const isEditMode = !!initialData?.id;

        // 1. Run React Hook Form validation first
        const isValid = await methods.trigger(undefined, { shouldFocus: true });
        if (!isValid) return;

        // Create a deep copy to avoid mutating form state during normalization
        let data = JSON.parse(JSON.stringify(values));

        // 2. Normalize Contacts (Requirement: Do not block on empty optional phone)
        const contactMap = new Map();
        const rawContacts = Array.isArray(data.contacts) ? data.contacts : [];
        data.contacts = rawContacts
            .map((c: any) => {
                const countryCode = c.countryCode || '+91';
                const number = normalizePhone(c.phone);

                return {
                    _id: ensureId(c._id),
                    name: (c.name || '').trim(),
                    email: (c.email || '').trim().toLowerCase(),
                    phone: number,
                    countryCode: countryCode,
                    description: (c.description || '').trim(),
                    sourceType: c.sourceType || 'manual',
                    memberId: isValidUuid(c.memberId) ? c.memberId : null
                };
            })
            .filter((c: any) => {
                // Remove empty contacts (no name AND no email AND no phone)
                if (!c.name && !c.email && !c.phone) return false;
                
                // Remove duplicates (same email OR same phone)
                const emailKey = c.email ? `email:${c.email}` : null;
                const phoneKey = c.phone ? `phone:${c.phone}` : null;
                
                if (emailKey && contactMap.has(emailKey)) return false;
                if (phoneKey && contactMap.has(phoneKey)) return false;
                
                if (emailKey) contactMap.set(emailKey, true);
                if (phoneKey) contactMap.set(phoneKey, true);
                
                return true;
            });

        // 2. Duplicate Check Helper
        const checkDuplicateClient = async (name: string) => {
            try {
                const params = new URLSearchParams({ search: name, fields: 'id,client_name' });
                const res = await apiFetch(`/api/clients?${params.toString()}`);
                if (!res.ok) return false;
                const result = await res.json();
                const existing = Array.isArray(result.data) ? result.data : [];
                // Check if any client has this exact name (case insensitive)
                return existing.some((c: any) => c.client_name?.toLowerCase() === name.toLowerCase() && String(c.id) !== String(initialData?.id));
            } catch (err) {
                console.error("Duplicate check failed:", err);
                return false;
            }
        };

        // 3. Handle Duplicate Name (Edit Mode Fix)
        const isDuplicate = await checkDuplicateClient(data.clientName);
        if (isEditMode) {
            const isSameName = (data.clientName || '').trim().toLowerCase() === (initialData.clientName || '').trim().toLowerCase();
            if (!isSameName && isDuplicate) {
                toast({ title: "Duplicate Client", description: "Another client with this name already exists.", variant: "destructive" });
                return;
            }
        } else {
            if (isDuplicate) {
                toast({ title: "Duplicate Client", description: "Client name already exists.", variant: "destructive" });
                return;
            }
        }

        // 4. Data Normalization (Fields)
        // Ensure backend receives flat structure for fields
        const flatFields: any = {};
        if (data.fields) {
            const allConstitutionFields = (selectedConstitutionForRender?.requiredFields || [])
                .flatMap((f: any) => Array.isArray(f?.fields) ? f.fields : [f]);

            Object.keys(data.fields).forEach(key => {
                const section = data.fields[key];
                const fieldDef = allConstitutionFields.find((f: any) => f.fieldKey === key);
                
                if (fieldDef?.dependsOn && !data.fields[fieldDef.dependsOn]) return;
                if (fieldDef?.requirement === 'If Available' && !data.fields[`${key}_is_available`]) return;

                if (section && typeof section === 'object' && !Array.isArray(section)) {
                    Object.entries(section).forEach(([fKey, fVal]) => {
                        if (fKey && fKey !== 'undefined') {
                            const subFieldDef = allConstitutionFields.find((f: any) => f.fieldKey === fKey);
                            if (subFieldDef?.fieldType === 'Phone') {
                                const { countryCode, number } = parsePhoneNumber(String(fVal) || "");
                                flatFields[fKey] = number;
                                flatFields[`${fKey}_countryCode`] = countryCode;
                            } else {
                                flatFields[fKey] = fVal;
                            }
                        }
                    });
                } else {
                    if (fieldDef?.fieldType === 'Phone') {
                        const { countryCode, number } = parsePhoneNumber(String(section) || "");
                        flatFields[key] = number;
                        flatFields[`${key}_countryCode`] = countryCode;
                    } else {
                        flatFields[key] = section;
                    }
                }
            });
        }
        data.fields = flatFields;


        // 4. Role Member Hardening
        const validMemberIds = new Set();
        const cleanedRoles: any = {};
        
        if (data.roles) {
            Object.entries(data.roles).forEach(([roleKey, roleObj]: [string, any]) => {
                const roleDef = selectedConstitutionForRender?.roles?.find((r: any) => r.roleKey === roleKey);
                const roleFields = (roleDef?.requiredDetails || [])
                    .flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[]);

                const members = (roleObj.members || [])
                    .map((m: any, index: number) => {
                        // STEP 5: HIDDEN FIELD HANDLING (NESTED DETAILS)
                        const cleanedDetails = { ...(m.details || {}) };
                        Object.keys(cleanedDetails).forEach(detailKey => {
                            const fieldDef = roleFields.find((f: any) => f.fieldKey === detailKey);
                            if (fieldDef?.dependsOn && !cleanedDetails[fieldDef.dependsOn]) {
                                delete cleanedDetails[detailKey];
                            }
                            if (fieldDef?.requirement === 'If Available' && !cleanedDetails[`${detailKey}_is_available`]) {
                                delete cleanedDetails[detailKey];
                            }
                            // Split phone numbers
                            if (fieldDef?.fieldType === 'Phone') {
                                const { countryCode, number } = parsePhoneNumber(cleanedDetails[detailKey] || "");
                                cleanedDetails[detailKey] = number;
                                cleanedDetails[`${detailKey}_countryCode`] = countryCode;
                            }
                        });

                        return normalizeMemberForSave({
                            ...m,
                            _id: ensureId(m._id),
                            details: deepClean(cleanedDetails)
                        }, roleDef?.roleName || roleKey, index);
                    })
                    .filter((m: any) => {
                        // Remove members with empty details
                        return m.details && Object.keys(m.details).length > 0;
                    });
                
                members.forEach((m: any) => validMemberIds.add(m._id));
                cleanedRoles[roleKey] = { members };
            });
        }
        data.roles = cleanedRoles;

        // Signatories normalization handled after role cleanup

        data.signatories = (data.signatories || [])
            .filter((s: any) => validMemberIds.has(s.memberId));
        
        const cleanedPrimarySignatories: any = {};
        if (data.primarySignatories) {
            Object.entries(data.primarySignatories).forEach(([roleKey, memberId]) => {
                if (memberId && validMemberIds.has(memberId)) {
                    cleanedPrimarySignatories[roleKey] = memberId;
                }
            });
        }
        data.primarySignatories = cleanedPrimarySignatories;

        // 6. ENFORCE: ONE PRIMARY PER ROLE (Only if signatories exist)
        const roleGroups: Record<string, string[]> = {};
        (data.signatories || []).forEach((s: any) => {
            if (!roleGroups[s.roleKey]) roleGroups[s.roleKey] = [];
            roleGroups[s.roleKey].push(s.memberId);
        });

        for (const roleKey in roleGroups) {
            if (!data.primarySignatories?.[roleKey]) {
                toast({
                    title: "Primary Missing",
                    description: `Please select a primary signatory for the ${roleKey.replace(/_/g, ' ')} role.`,
                    variant: "destructive"
                });
                return;
            }
        }

        // 6. Final Clean & Strict Schema Compliance
        const finalPayload = deepClean({
            ...data,
            clientName: (data.clientName || '').trim(),
            constitutionId: data.constitutionId,
            client_type: data.client_type || (data.reference === 'Associate' ? 'associate' : 'direct'),
            reference: data.reference,
            sourceType: data.sourceType || data.reference || 'Direct',
            associateId: (data.client_type === 'direct' || data.reference === 'Direct') ? null : (data.associateId || null),
            remarks: (data.remarks || '').trim(),
        });

        // IMPORTANT: Ensure top-level phone/email are gone (they should be in contacts/fields/roles)
        if (finalPayload) {
            delete finalPayload.phone;
            delete finalPayload.email;
            delete finalPayload.countryCode;
        }

        // Signaling the start of signatory validation if any are present
        if (finalPayload.signatories && finalPayload.signatories.length > 0) {
            if (!finalPayload.primarySignatories || Object.keys(finalPayload.primarySignatories).length === 0) {
                 toast({ title: "Signatory Error", description: "At least one primary signatory is required if signatories are designated.", variant: "destructive" });
                 return;
            }
        }

        // 9. PRESERVE EXISTING DATA & ENSURE ID
        const cleanedData = {
            ...(initialData || {}),
            ...finalPayload,
            id: initialData?.id
        };

        // TEMP DEBUGGING
        console.log("EDIT PAYLOAD:", cleanedData);

        try {
            await onSave(cleanedData, selectedConstitutionForRender || null);
        } catch (err: any) {
            // Handle DB Unique Constraint Error (23505)
            if (err?.code === '23505') {
                toast({
                    title: "Duplicate Client",
                    description: "Client name already exists.",
                    variant: "destructive"
                });
                return;
            }

            toast({
                title: isEditMode ? "Update Failed" : "Save Failed",
                description: "Something went wrong while saving.",
                variant: "destructive"
            });
        }
    };

    const onFormError = (errs: any) => {
        setHasAttemptedSubmit(true);
        const newAttempted = { ...attemptedTabs };
        availableTabs.forEach(t => newAttempted[t] = true);
        setAttemptedTabs(newAttempted);
        
        console.log('Form Validation Errors:', errs);
        
        const firstErrorTab = availableTabs.find(tab => errorsByTab[tab]?.length > 0);
        if (firstErrorTab) setActiveTab(firstErrorTab);

        const errorMessages = getErrorMessages(errs);
        const uniqueErrors = Array.from(new Set(errorMessages)).slice(0, 5); // Limit to top 5

        toast({
            title: "Validation Error",
            description: uniqueErrors.length > 0 
                ? `Please correct the following: \n- ${uniqueErrors.join('\n- ')}` 
                : "Required fields are missing or invalid across the form tabs.",
            variant: "destructive"
        });
    };

    const handleNext = async () => {
        setAttemptedTabs(prev => ({ ...prev, [activeTab]: true }));
        const hasErr = errorsByTab[activeTab]?.length > 0;
        if (hasErr) {
            await methods.trigger(); // Trigger RHF validation
            toast({
                title: "Incomplete Section",
                description: "Please complete required fields in this section before proceeding.",
                variant: "destructive"
            });
            return;
        }
        
        const currentIndex = availableTabs.indexOf(activeTab);
        if (currentIndex < availableTabs.length - 1) {
            setActiveTab(availableTabs[currentIndex + 1]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrev = () => {
        const currentIndex = availableTabs.indexOf(activeTab);
        if (currentIndex > 0) {
            setActiveTab(availableTabs[currentIndex - 1]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const renderTabIndicator = (tabId: string) => {
        const hasErr = errorsByTab[tabId]?.length > 0;
        const attempted = attemptedTabs[tabId];
        if (hasErr && attempted) {
            return <AlertCircleIcon className="absolute top-1 right-1 h-3 w-3 text-destructive animate-pulse bg-white rounded-full" />;
        } else if (!hasErr) {
            return <CheckCircle className="absolute top-1 right-1 h-3 w-3 text-green-500 bg-white rounded-full" />;
        }
        return null;
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(handleFormSubmit as any, onFormError)} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <fieldset disabled={!!initialData && !isOptionsLoaded || mode === 'view'} className={cn("space-y-6 border-none p-0 m-0", mode === 'view' && "pointer-events-none opacity-90")}>
                <div className="flex flex-row items-center justify-between w-full mb-8 pb-6 border-b border-slate-200/60 transition-all duration-500">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm">
                            <Building className="h-6 w-6 text-slate-900" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Registration Profile</h2>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 opacity-60">Entity Onboarding Terminal</p>
                        </div>
                    </div>
                    
                    <div className="min-w-[300px] flex flex-col gap-1.5">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Processing Branch</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase italic">Required</span>
                        </div>
                        <FormField 
                            control={control as any} 
                            name="profileId" 
                            render={({ field }: { field: any }) => (
                                <Select onValueChange={field.onChange} value={field.value ? String(field.value) : ''}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 bg-white border-slate-400 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-sm transition-all [&>svg]:text-black">
                                            <SelectValue placeholder="Select Branch" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-2xl shadow-2xl border-none p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        {sortedProfiles.map((p: any) => (
                                            <SelectItem key={String(p.id)} value={String(p.id)} className="font-bold py-2.5 rounded-lg flex items-center justify-between">
                                                <span>{p.profileName}</span>
                                                {p.isDefault && <Badge variant="outline" className="ml-2 text-[8px] uppercase border-blue-200 bg-blue-50 text-blue-600 font-black px-1 h-4">Default</Badge>}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

                    <TabsList className="flex w-full h-12 p-1 bg-muted/50 rounded-xl gap-1 mb-6 overflow-hidden no-scrollbar">
                        <TabsTrigger value="general" className="relative flex-1 flex items-center justify-center gap-2 px-1 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full min-w-0">
                            <User className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium truncate">General</span>
                            {renderTabIndicator('general')}
                        </TabsTrigger>

                        {selectedConstitutionForRender && (
                            <>
                                {selectedConstitutionForRender.requiredFields?.length > 0 && (
                                    <TabsTrigger value="constitution" className="relative flex-1 flex items-center justify-center gap-2 px-1 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full min-w-0">
                                        <FileText className="h-4 w-4 shrink-0" />
                                        <span className="text-sm font-medium truncate">Constitution</span>
                                        {renderTabIndicator('constitution')}
                                    </TabsTrigger>
                                )}

                                {selectedConstitutionForRender.roles?.length > 0 && (
                                    <TabsTrigger value="roles" className="relative flex-1 flex items-center justify-center gap-2 px-1 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full min-w-0">
                                        <Users className="h-4 w-4 shrink-0" />
                                        <span className="text-sm font-medium truncate">Roles</span>
                                        {renderTabIndicator('roles')}
                                    </TabsTrigger>
                                )}

                                <TabsTrigger value="contact" className="relative flex-1 flex items-center justify-center gap-2 px-1 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full min-w-0">
                                    <Phone className="h-4 w-4 shrink-0" />
                                    <span className="text-sm font-medium truncate">Contact</span>
                                    {renderTabIndicator('contact')}
                                </TabsTrigger>

                                <TabsTrigger value="signatories" className="relative flex-1 flex items-center justify-center gap-2 px-1 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-full min-w-0">
                                    <CheckCircle className="h-4 w-4 shrink-0" />
                                    <span className="text-sm font-medium truncate">Signatories</span>
                                    {renderTabIndicator('signatories')}
                                </TabsTrigger>
                            </>
                        )}
                    </TabsList>

                    <TabsContent value="general" className="space-y-6 outline-none animate-in fade-in slide-in-from-left-4 duration-300">
                        <Card className="border shadow-sm bg-white/50 backdrop-blur-sm">
                            <CardHeader className="border-b bg-muted/20 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-primary/10 rounded-full"><User className="h-5 w-5 text-primary" /></div>
                                    <div>
                                        <CardTitle className="text-lg">Client Information</CardTitle>
                                        <CardDescription>Basic identification and entity details.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <FormField control={control as any} name="clientName" render={({ field }: { field: any }) => (
                                        <FormItem><FormLabel>Client Name <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} value={field.value || ''} maxLength={100} className={getFieldClass('clientName')} placeholder="e.g. Acme Corp" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormItem>
                                            <FormLabel>Primary Constitution <span className="text-destructive">*</span></FormLabel>
                                            <Select 
                                                value={primaryType} 
                                                onValueChange={handlePrimaryTypeChange}
                                            >
                                                <FormControl><SelectTrigger className={getFieldClass('constitutionId')}><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {primaryTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>

                                        <FormField control={control as any} name="constitutionId" render={({ field }: { field: any }) => {
                                            const hasSubcategoriesLocal = availableSubTypes.some(c => c.businessSubType && c.businessSubType.trim() !== '');
                                            return (
                                            <FormItem>
                                                <FormLabel>Subcategory {hasSubcategoriesLocal && <span className="text-destructive">*</span>}</FormLabel>
                                                {hasSubcategoriesLocal ? (
                                                    <Select 
                                                        disabled={!primaryType || availableSubTypes.length === 0}
                                                        onValueChange={(val: any) => { 
                                                            field.onChange(val); 
                                                            onConstitutionChange(val); 
                                                        }} 
                                                        value={field.value ? String(field.value) : ''}
                                                    >
                                                        <FormControl><SelectTrigger className={getFieldClass('constitutionId')}><SelectValue placeholder={!primaryType ? "Choose Primary First" : "Select Subtype"} /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {availableSubTypes.map(c => <SelectItem key={String(c.id)} value={String(c.id)}>{c.businessSubType}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <div className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 items-center">
                                                        {!primaryType ? "Choose Primary First" : "No subcategories configured."}
                                                    </div>
                                                )}
                                                {hasSubcategoriesLocal && <FormMessage />}
                                            </FormItem>
                                            );
                                        }} />
                                    </div>
                                </div>



                                <div className="grid md:grid-cols-2 gap-6">
                                    <FormField control={control as any} name="client_type" render={({ field }: { field: any }) => (
                                        <FormItem><FormLabel>Client Type <span className="text-destructive">*</span></FormLabel>
                                            <Select 
                                                disabled={loadingClientTypes}
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    setValue('reference', val === 'associate' ? 'Associate' : 'Direct');
                                                }} 
                                                value={field.value || ""}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={getFieldClass('client_type')}>
                                                        <SelectValue placeholder={loadingClientTypes ? "Loading client types..." : "Select client type"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {clientTypes.map(type => (
                                                        <SelectItem key={type.value} value={type.value}>
                                                            {type.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    {(watchedClientType === 'associate' || watchedReference === 'Associate') && (
                                        <FormField control={control as any} name="associateId" render={({ field }: { field: any }) => (
                                            <FormItem><FormLabel>Associate Name <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger className={getFieldClass('associateId')}><SelectValue placeholder="Select associate" /></SelectTrigger></FormControl>
                                                    <SelectContent>{associates.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                                                </Select><FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                </div>
                                <FormField control={control as any} name="remarks" render={({ field }: { field: any }) => (
                                    <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} value={field.value || ''} rows={3} className={`resize-none min-h-[100px] rounded-2xl border-muted-foreground/10 bg-muted/5 focus:bg-background transition-all ${getFieldClass('remarks')}`} placeholder="e.g. Needs GST registration, specific billing instructions, or follow-up next week..." /></FormControl><FormMessage /></FormItem>
                                )} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {selectedConstitutionForRender && (
                        <>
                            {selectedConstitutionForRender.requiredFields?.length > 0 && (
                                <TabsContent value="constitution" className="outline-none animate-in fade-in slide-in-from-left-4 duration-300">
                                    <Card className="border shadow-sm bg-white/50 backdrop-blur-sm">
                                        <CardHeader className="border-b bg-muted/20 pb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-blue-100 rounded-full"><FileText className="h-5 w-5 text-blue-600" /></div>
                                                <div>
                                                    <CardTitle className="text-lg">Constitution Details</CardTitle>
                                                    <CardDescription>Required fields for this business type.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-6 pt-6">
                                            {(() => {
                                                const renderConstitutionField = (field: any) => {
                                                    if (!field?.fieldKey) return null;
                                                    
                                                    const isToggleField = field.fieldType === 'BOOLEAN' || field.fieldName?.toLowerCase()?.includes('is applicable');
                                                    const isIfAvailable = field.requirement === 'If Available';
                                                    
                                                    const isVisible = field.dependsOn 
                                                        ? Boolean(watch(`fields.${field.dependsOn}`)) 
                                                        : true;
                                                    
                                                    const isContentVisible = isVisible && (!isIfAvailable || Boolean(watch(`fields.${field.fieldKey}_is_available`)));
                                                    const isRequired = field.requirement === 'Mandatory' && isVisible;

                                                    if (!isVisible && !isToggleField && !isIfAvailable) return null;

                                                    return (
                                                        <React.Fragment key={field.fieldKey}>
                                                            {/* Render 'If Available' Toggle */}
                                                            {isIfAvailable && isVisible && (
                                                                <FormField
                                                                    control={control as any}
                                                                    name={`fields.${field.fieldKey}_is_available`}
                                                                    render={({ field: f }: { field: any }) => (
                                                                        <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-muted/10 md:col-span-2 hover:bg-muted/20 transition-all border-dashed border-primary/10">
                                                                            <div className="space-y-0.5">
                                                                                <FormLabel className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                                                    {field.availableQuestion || `Do you have ${field.fieldName}?`}
                                                                                    {f.value ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                                                                </FormLabel>
                                                                                <p className="text-[11px] text-muted-foreground font-medium text-amber-600/80">Toggle to 'Yes' if you have this information available.</p>
                                                                            </div>
                                                                            <FormControl>
                                                                                <Switch
                                                                                    checked={Boolean(f.value)}
                                                                                    onCheckedChange={f.onChange}
                                                                                    className="data-[state=checked]:bg-emerald-500"
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            )}

                                                            {/* Render Main Toggle Fields */}
                                                            {isToggleField && isVisible && (
                                                                <FormField
                                                                    control={control as any}
                                                                    name={`fields.${field.fieldKey}`}
                                                                    render={({ field: f }: { field: any }) => (
                                                                        <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-muted/10 md:col-span-2 hover:bg-muted/20 transition-all border-dashed border-primary/10">
                                                                            <div className="space-y-0.5">
                                                                                <FormLabel className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                                                    {field.fieldName}
                                                                                    {f.value ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                                                                </FormLabel>
                                                                                <p className="text-[11px] text-muted-foreground font-medium">Select if this information is applicable for this client.</p>
                                                                            </div>
                                                                            <FormControl>
                                                                                <Switch
                                                                                    checked={Boolean(f.value)}
                                                                                    onCheckedChange={f.onChange}
                                                                                    className="data-[state=checked]:bg-emerald-500"
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            )}

                                                            {/* Render Actual Input Field (only if visible and content is allowed) */}
                                                            {!isToggleField && isContentVisible && (
                                                                <div className={cn(
                                                                    "animate-in fade-in slide-in-from-top-1 duration-200",
                                                                    (field.fieldName?.toLowerCase()?.includes('address') || field.fieldType === 'PAN') && "md:col-span-2"
                                                                )}>
                                                                    <div className={cn(field.fieldType === 'PAN' && "grid md:grid-cols-1 gap-6 items-start")}>
                                                                        <FormField 
                                                                            control={control as any} 
                                                                            name={`fields.${field.fieldKey}`} 
                                                                            rules={{
                                                                                validate: (value: any) => {
                                                                                    if (!isVisible || (isIfAvailable && !isContentVisible)) return true;
                                                                                    if (field.requirement === 'Mandatory' || (isIfAvailable && isContentVisible)) {
                                                                                        if (!value || value === '') return `${field.fieldName} is required`;
                                                                                    }
                                                                                    return true;
                                                                                }
                                                                            }}
                                                                            render={({ field: formField }: { field: any }) => (
                                                                            <FormItem className="relative">
                                                                                <FormLabel className="flex items-center gap-1.5 font-bold text-slate-700 text-sm">
                                                                                    {field.fieldName} 
                                                                                    {(isRequired || isIfAvailable) && <span className="text-destructive">*</span>} 
                                                                                    {field.fieldType === 'PAN' && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
                                                                                </FormLabel>
                                                                                <FormControl>
                                                                                    {field.fieldName?.toLowerCase()?.includes('address') ? (
                                                                                        <Textarea 
                                                                                            placeholder={`Enter ${field.fieldName}`} 
                                                                                            {...formField} 
                                                                                            value={formField.value || ''} 
                                                                                            rows={2}
                                                                                            maxLength={getFieldMaxLength(field)}
                                                                                            className={cn("transition-all focus:ring-2 focus:ring-primary/20 min-h-[60px] rounded-lg", getFieldClass(`fields.${field.fieldKey}`))} 
                                                                                        />
                                                                                    ) : field.fieldType === 'Phone' ? (
                                                                                        <PhoneInput 
                                                                                            value={formField.value} 
                                                                                            onChange={(val: any) => {
                                                                                                const digits = sanitizePhoneInput(val);
                                                                                                formField.onChange(digits);
                                                                                                if (isValidLocalPhone(digits)) {
                                                                    clearErrors(`fields.${field.fieldKey}`);
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                    <Input 
                                                                                        placeholder={`Enter ${field.fieldName}`} 
                                                                                        {...formField} 
                                                                                        value={formField.value || ''} 
                                                                                        maxLength={getFieldMaxLength(field)}
                                                                                        onChange={(e: any) => {
                                                                                            if (field.fieldType === 'Number') {
                                                                                                formField.onChange(e.target.value.replace(/\D/g, ''));
                                                                                            } else {
                                                                                                formField.onChange(e.target.value);
                                                                                            }
                                                                                        }}
                                                                                        className={cn("transition-all h-10 focus:ring-2 focus:ring-primary/20 rounded-lg", getFieldClass(`fields.${field.fieldKey}`))} 
                                                                                    />
                                                                                    )}
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )} />

                                                                        {/* Removed PAN proof upload */}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                };

                                                return constitutionSections.length > 0 ? (
                                                    constitutionSections.map((section: any, sIdx: number) => (
                                                        <React.Fragment key={section.key}>
                                                            {/* Section Header */}
                                                            <div className="md:col-span-2 mt-6 first:mt-0 pb-2 border-b border-primary/5 mb-4">
                                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/70 flex items-center gap-2">
                                                                    <span className="h-5 w-5 rounded-md bg-blue-50 flex items-center justify-center text-[10px] text-blue-600 border border-blue-100">{sIdx + 1}</span>
                                                                    {section.title}
                                                                </h4>
                                                            </div>
                                                            
                                                            {/* Fields in Section */}
                                                            {section.fields.map((field: any) => renderConstitutionField(field))}
                                                        </React.Fragment>
                                                    ))
                                                ) : (
                                                    // Fallback for flat structure or malformed data
                                                    constitutionFields.map((field: any) => renderConstitutionField(field))
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            )}

                            {selectedConstitutionForRender.roles?.length > 0 && (
                                <TabsContent value="roles" className="outline-none animate-in fade-in slide-in-from-left-4 duration-300">
                                    <Card className="border shadow-sm bg-white/50 backdrop-blur-sm">
                                        <CardHeader className="border-b bg-muted/20 pb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-purple-100 rounded-full"><Users className="h-5 w-5 text-purple-600" /></div>
                                                <div>
                                                    <CardTitle className="text-lg">Roles & Members</CardTitle>
                                                    <CardDescription>Define key persons and their roles.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-6">
                                            {selectedConstitutionForRender.roles.map((role: any) => (
                                                <RoleSection key={role.roleKey} role={role} allRoles={selectedConstitutionForRender.roles!} currentClientRoles={(watchedValues.roles as any) || {}} isValidationMode={isValidationMode} changedFields={changedFields} />
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            )}

                            <TabsContent value="contact" className="outline-none animate-in fade-in slide-in-from-left-4 duration-300">
                                <Card className="border shadow-sm bg-white/50 backdrop-blur-sm">
                                    <CardHeader className="border-b bg-muted/20 pb-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-green-100 rounded-full"><Phone className="h-5 w-5 text-green-600" /></div>
                                                <div>
                                                    <CardTitle className="text-lg">Contact Management</CardTitle>
                                                    <CardDescription>Manage both role-based and manual contacts for this client.</CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {allMembers.length > 0 && (
                                                    <Select onValueChange={(memberKey: string) => {
                                                        const member = allMembers.find(m => m.key === memberKey);
                                                        if (!member) return;
                                                        
                                                        // Prevent duplicate entries
                                                        const exists = contactFields.some(c => c.email === member.derived.email);
                                                        if (exists) {
                                                            toast({ title: "Already Added", description: `${member.name} is already in the contact list.` });
                                                            return;
                                                        }

                                                        appendContact({
                                                            _id: crypto.randomUUID(),
                                                            sourceType: 'import',
                                                            name: member.name,
                                                            email: member.derived.email,
                                                            phone: member.derived.phone,
                                                            countryCode: member.derived.countryCode,
                                                            description: member.role,
                                                            memberId: member._id
                                                        });
                                                    }}>
                                                        <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Add from Registry..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {allMembers.map(m => (
                                                                <SelectItem key={m.key} value={m.key}>
                                                                    <div className="flex flex-col">
                                                                        <span>{m.name}</span>
                                                                        <span className="text-[10px] text-muted-foreground">{m.role}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                                <Button type="button" variant="outline" size="sm" onClick={() => appendContact({ _id: crypto.randomUUID(), sourceType: 'manual', name: '', email: '', phone: '', countryCode: '+91', description: '' })} className="h-9">
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Manual
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-6">
                                        {contactFields.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-muted/5 rounded-xl border-2 border-dashed">
                                                <Phone className="h-8 w-8 mb-2 opacity-20" />
                                                <p className="text-sm italic">No contacts added yet.</p>
                                                <p className="text-xs">Add manual contacts or import from registry roles.</p>
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {contactFields.map((field, index) => (
                                                <Card key={field.id} className="relative group overflow-hidden border-muted/60 hover:border-primary/30 transition-all shadow-none bg-background/50 hover:bg-background">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/10 group-hover:bg-primary transition-colors" />
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex items-center gap-2">
                                                                 <div className={cn(
                                                                    "p-1.5 rounded-lg",
                                                                    field.sourceType === 'manual' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                                                )}>
                                                                    {field.sourceType === 'manual' ? <User className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                                                                </div>
                                                                <Badge variant="secondary" className="text-[9px] uppercase tracking-wider font-bold">
                                                                    {field.sourceType === 'manual' ? 'Manual' : 'Registry'}
                                                                </Badge>
                                                            </div>
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(index)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <FormField
                                                                control={control as any}
                                                                name={`contacts.${index}.name`}
                                                                render={({ field: f }: { field: any }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest pl-1 leading-none flex items-center">Full Name <span className="text-destructive ml-1">*</span></FormLabel>
                                                                        <FormControl>
                                                                            <Input {...f} value={f.value || ''} placeholder="Enter name" className="h-9 text-sm rounded-lg" />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <FormField
                                                                    control={control as any}
                                                                    name={`contacts.${index}.email`}
                                                                    render={({ field: f }: { field: any }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest pl-1 leading-none flex items-center">Email <span className="text-destructive ml-1">*</span></FormLabel>
                                                                            <FormControl>
                                                                                <Input {...f} value={f.value || ''} type="email" placeholder="Email" className="h-9 text-sm rounded-lg" />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField
                                                                    control={control as any}
                                                                    name={`contacts.${index}.phone`}
                                                                    render={({ field: f }: { field: any }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest pl-1 leading-none flex items-center">Phone <span className="text-destructive ml-1">*</span></FormLabel>
                                                                            <FormControl>
                                                                                <PhoneInput
                                                                                    value={f.value || ''}
                                                                                    onChange={(fullPhone: any) => {
                                                                                        const digits = sanitizePhoneInput(fullPhone);
                                                                                        f.onChange(digits);
                                                                                        if (isValidLocalPhone(digits)) {
                                                                                            clearErrors(`contacts.${index}.phone`);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>
                                                            <FormField
                                                                control={control as any}
                                                                name={`contacts.${index}.description`}
                                                                render={({ field: f }: { field: any }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest pl-1 leading-none">Description / Role</FormLabel>
                                                                        <FormControl>
                                                                            <Input {...f} value={f.value || ''} placeholder="e.g. Primary for billing" className="h-9 text-sm rounded-lg" />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="signatories" className="outline-none animate-in fade-in slide-in-from-left-4 duration-300">
                                <Card className="border shadow-sm bg-white/50 backdrop-blur-sm">
                                    {/* HIDDEN FIELDS FOR SIGNATORY VALIDATION ENFORCEMENT */}
                                    {/* Signatory validation is now handled in handleFormSubmit only if signatories are present */}
                                    <ClientSignatoryManagement allRoles={selectedConstitutionForRender.roles || []} />
                                </Card>
                            </TabsContent>
                        </>
                    )}
                </Tabs>
                {hasAttemptedSubmit && criticalErrors.length > 0 && (
                    <div className="mb-4 p-4 rounded-xl bg-destructive/5 border border-destructive/10 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 mb-2 text-destructive">
                            <AlertCircleIcon className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Required Information Missing</span>
                        </div>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                            {criticalErrors.map((err, i) => (
                                <li key={i} className="text-[11px] text-destructive/80 flex items-start gap-1.5 font-medium leading-tight">
                                    <span className="mt-1 h-1 w-1 rounded-full bg-destructive/40 shrink-0" />
                                    {err.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="flex justify-between items-center gap-4 pt-8 mt-8 border-t border-slate-200">
                    <div className="flex-1">
                        {availableTabs.indexOf(activeTab) > 0 && (
                            <Button type="button" variant="outline" onClick={handlePrev} disabled={isSubmitting} className="h-11 px-8 rounded-xl font-bold border-slate-300">
                                Previous
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 justify-end">
                        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="h-11 px-6 rounded-xl font-bold text-slate-500 hover:text-slate-900">
                            {mode === 'view' ? 'Close' : 'Cancel'}
                        </Button>
                        
                        {availableTabs.indexOf(activeTab) < availableTabs.length - 1 && (
                            <Button type="button" variant="secondary" onClick={handleNext} disabled={isSubmitting} className="h-11 px-8 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 shadow-sm">
                                Next
                            </Button>
                        )}

                        {mode !== 'view' && (
                            <Button 
                                type="button" 
                                disabled={isSubmitting} 
                                onClick={async () => {
                                    console.log("[CLIENT_SAVE] button clicked");
                                    const isValid = await trigger();
                                    if (!isValid) {
                                        console.log("[CLIENT_SAVE] validation errors", errors);
                                        
                                        // 1. Mark form as attempted so inline errors show
                                        setHasAttemptedSubmit(true);
                                        const newAttempted = { ...attemptedTabs };
                                        availableTabs.forEach(t => newAttempted[t] = true);
                                        setAttemptedTabs(newAttempted);

                                        // 2. Switch to first tab with errors
                                        const firstErrorTab = availableTabs.find(tab => errorsByTab[tab]?.length > 0);
                                        if (firstErrorTab) {
                                            setActiveTab(firstErrorTab);
                                        } else if (Object.keys(errors).length > 0) {
                                            // Fallback to general tab if mapping fails
                                            setActiveTab('general');
                                        }
                                        
                                        // 3. Show toast
                                        toast({
                                            title: "Validation Error",
                                            description: "Required fields are missing or invalid. Please check the highlighted fields.",
                                            variant: "destructive"
                                        });
                                        return;
                                    }
                                    
                                    console.log("[CLIENT_SAVE] form is valid, submitting");
                                    await handleSubmit(handleFormSubmit)();
                                }}
                                className={cn(
                                    "h-11 px-10 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95",
                                    (!isReady && !isSubmitting) ? "bg-slate-200 text-slate-400 shadow-none hover:bg-slate-300" : "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02]"
                                )}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                ) : (isValidationMode ? 'Validate Client' : 'Save Client')}
                            </Button>
                        )}
                    </div>
                </div>
                </fieldset>
            </form>
        </FormProvider>
    );
};




// --- Role Section Sub-component ---
const RoleSection: React.FC<{ role: Role; allRoles: Role[]; currentClientRoles: Record<string, any>, isValidationMode: boolean, changedFields: string[] }> = ({ role, allRoles, currentClientRoles, isValidationMode, changedFields }) => {
    const { control, setValue, trigger, getValues, watch, clearErrors } = useFormContext<ClientFormValues>();
    const rawContacts = useWatch({ name: 'contacts', control });
    const watchedContacts = useMemo(() => rawContacts || [], [rawContacts]);
    const { toast } = useToast();
    const { fields, append, remove } = useFieldArray({ control, name: `roles.${role.roleKey}.members` });
    const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
    const [originalMemberData, setOriginalMemberData] = useState<any>(null);

    const startEditing = (index: number) => {
        setEditingMemberIndex(index);
        setOriginalMemberData(JSON.parse(JSON.stringify(getValues(`roles.${role.roleKey}.members.${index}`))));
    };

    const getFieldClass = (fieldName: string) => isValidationMode && changedFields.includes(fieldName) ? "border-yellow-400 border-2" : "";

    const addMember = () => {
        if (role.maxMembers > 0 && fields.length >= role.maxMembers) {
            toast({
                title: "Member Limit Reached",
                description: `You cannot add more than ${role.maxMembers} members to the "${role.roleName}" role.`,
                variant: "destructive",
            });
            return;
        }
        const newMember: Record<string, string> = {};
        (role.requiredDetails || [])
            .flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[])
            .forEach((field: any) => { 
                if (field && field.fieldKey) {
                    newMember[field.fieldKey] = '';
                    if (field.fieldType === 'Phone') newMember[`${field.fieldKey}_countryCode`] = '+91';
                }
            });
        if (role.designations?.length > 0) newMember['designation'] = '';
        append({ _id: crypto.randomUUID(), details: newMember });
        setEditingMemberIndex(fields.length);
        setOriginalMemberData(null); // New member, nothing to restore
    };

    const saveMember = async (index: number) => {
        const isValid = await trigger(`roles.${role.roleKey}.members.${index}`);
        if (isValid) {
            setEditingMemberIndex(null);
            setOriginalMemberData(null);
            toast({ title: "Member Saved", description: "Member details have been staged for saving." });
        } else {
            toast({ title: "Validation Error", description: `Please correct the errors for this member before saving.`, variant: "destructive" });
        }
    }

    const cancelEdit = (index: number) => {
        if (originalMemberData) {
            setValue(`roles.${role.roleKey}.members.${index}`, originalMemberData);
        } else {
            // NEW MEMBER -> REMOVE IT properly
            remove(index);
        }
        setEditingMemberIndex(null);
        setOriginalMemberData(null);
    }

    const removeMember = (index: number) => {
        const memberId = getValues(`roles.${role.roleKey}.members.${index}._id`);
        
        remove(index);

        // Clean signatories immediately (Point 4)
        const currSigs = getValues('signatories') || [];
        setValue(
            'signatories',
            currSigs.filter((s: any) => s.memberId !== memberId),
            { shouldDirty: true }
        );

        // Clean primary
        if (getValues(`primarySignatories.${role.roleKey}`) === memberId) {
            setValue(`primarySignatories.${role.roleKey}`, undefined as any, { shouldDirty: true });
        }
    }

    const copyMember = (indexToCopyTo: number, detailsToCopy: Record<string, any>) => {
        // STEP 5: SAFE COPY MEMBER LOGIC
        const allowedDetails: Record<string, any> = {};
        
        // Copy ONLY allowed fields from requiredDetails
        (role.requiredDetails || [])
          .flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[])
          .forEach((field: any) => {
            if (!field?.fieldKey) return;
            
            // DO NOT copy: _id, proof fields (*proof*)
            if (field.fieldKey === '_id' || field.fieldKey?.toLowerCase()?.includes('proof')) return;
            
            allowedDetails[field.fieldKey] = 
                detailsToCopy[field.fieldKey] !== undefined 
                    ? detailsToCopy[field.fieldKey] 
                    : '';
            
            if (field.fieldType === 'Phone') {
                allowedDetails[`${field.fieldKey}_countryCode`] = detailsToCopy[`${field.fieldKey}_countryCode`] || '+91';
            }
          });
        
        if (role.designations?.length) {
            allowedDetails.designation = detailsToCopy.designation || '';
        }
        
        // Use setValue for individual fields to trigger validation correctly
        Object.entries(allowedDetails).forEach(([key, val]) => {
            setValue(`roles.${role.roleKey}.members.${indexToCopyTo}.details.${key}`, val, { shouldDirty: true, shouldValidate: true });
        });

        toast({ title: "Details Copied", description: "Allowed member details have been safely copied." });
    }

    const otherMembers = useMemo(() => {
        if (!allRoles || !currentClientRoles) return [];
        const registryPeople = allRoles
            .filter(r => r.roleKey !== role.roleKey)
            .flatMap(r =>
                (currentClientRoles?.[r.roleKey]?.members || []).map((member: any, index: number) => ({
                    id: `${r.roleKey}-${index}`,
                    name: getMemberDisplayName(member, r.roleName, index),
                    icon: <Users className="mr-2 h-3 w-3" />,
                    details: member.details,
                }))
            );

        const manualContacts = (watchedContacts || [])
            .filter(c => c.sourceType === "manual" && c.name)
            .map((c, i) => ({
                id: `contact-${i}`,
                name: c.name || 'Unnamed Contact',
                icon: <Phone className="mr-2 h-3 w-3" />,
                details: {
                    full_name: c.name,
                    email: c.email,
                    phone: c.phone,
                    phone_countryCode: c.countryCode
                }
            }));

        return [...registryPeople, ...manualContacts].filter(m => m.name && m.name.trim() && m.name.trim() !== "Member" && m.name.trim().toLowerCase() !== "undefined");
    }, [allRoles, currentClientRoles, role.roleKey, watchedContacts]);

    const isAddButtonDisabled = role.maxMembers > 0 && fields.length >= role.maxMembers;


    return (
        <Card className="bg-muted/30"><CardHeader className="pb-4">
            <CardTitle className="text-lg">{role.roleName}</CardTitle>
            <CardDescription>Min: {role.minMembers}, Max: {role.maxMembers === 0 ? 'Unlimited' : role.maxMembers}</CardDescription>
        </CardHeader><CardContent>
                {fields.length > 0 && <Separator className="mb-4" />}
                <div className="space-y-4">
                    {fields.map((member, index) => {
                        const memberDetails = getValues(`roles.${role.roleKey}.members.${index}.details`);
                        const isEditing = editingMemberIndex === index;

                        return (
                            <div key={member.id} className={cn("p-4 border bg-background rounded-lg relative", getFieldClass(`roles.${role.roleKey}.members.${index}`))}>
                                <div className="flex justify-between items-start mb-2 gap-2">
                                    <h5 className="font-semibold pt-2 flex items-center gap-2">
                                        <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">{index + 1}</Badge>
                                        {memberDetails?.full_name || `Member ${index + 1}`}
                                    </h5>
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        {!isEditing ? (
                                            <Button type="button" variant="outline" size="sm" onClick={() => startEditing(index)}><Edit className="h-4 w-4 mr-1" />Edit</Button>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {otherMembers.length > 0 && (
                                                    <Select onValueChange={(memberId: string) => {
                                                        const memberToCopy = otherMembers.find(m => m.id === memberId);
                                                        if (memberToCopy) copyMember(index, memberToCopy.details);
                                                    }}>
                                                        <SelectTrigger className="w-auto h-8 text-xs flex-shrink-0"><SelectValue placeholder="Copy From..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {otherMembers.map(m => (
                                                                <SelectItem key={m.id} value={m.id}>
                                                                    <span className="flex items-center">
                                                                        {m.icon}
                                                                        {m.name}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                                <Button type="button" variant="ghost" size="sm" onClick={() => cancelEdit(index)}>Cancel</Button>
                                                <Button type="button" size="sm" onClick={() => saveMember(index)}><CheckCircle className="h-4 w-4 mr-2" />Save Member</Button>
                                            </div>
                                        )}
                                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => removeMember(index)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                                {isEditing ? (
                                    <div className="grid md:grid-cols-2 gap-4">
                                            {/* Standard Member Name Field */}
                                            <FormField
                                                control={control as any}
                                                name={`roles.${role.roleKey}.members.${index}.details.full_name`}
                                                rules={{ required: "Member name is required" }}
                                                render={({ field: f }: { field: any }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                            Full Name <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input 
                                                                {...f} 
                                                                placeholder="Enter member's full name" 
                                                                value={f.value || ''} 
                                                                maxLength={100}
                                                                className="h-10 transition-all focus:ring-2 focus:ring-primary/20 bg-primary/5 border-primary/10" 
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {(role.requiredDetails || [])
                                                .flatMap((d: any) => (Array.isArray(d?.fields) ? d.fields : [d]) as any[])
                                                .filter((f: any) => f && f.fieldKey)
                                                .map((field: any) => {
                                                    const isIfAvailable = field.requirement === 'If Available';
                                                    const isVisible = field.dependsOn 
                                                        ? Boolean(watch(`roles.${role.roleKey}.members.${index}.details.${field.dependsOn}` as any)) 
                                                        : true;
                                                    
                                                    const isContentVisible = isVisible && (!isIfAvailable || Boolean(watch(`roles.${role.roleKey}.members.${index}.details.${field.fieldKey}_is_available`)));
                                                    const isRequired = field.requirement === 'Mandatory' && isVisible;

                                                    if (!isVisible) return null;

                                                    return (
                                                        <React.Fragment key={field.fieldKey}>
                                                            {/* Render 'If Available' Toggle for Member Details */}
                                                            {isIfAvailable && isVisible && (
                                                                <FormField
                                                                    control={control as any}
                                                                    name={`roles.${role.roleKey}.members.${index}.details.${field.fieldKey}_is_available`}
                                                                    render={({ field: f }: { field: any }) => (
                                                                        <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-muted/10 md:col-span-2 hover:bg-muted/20 transition-all border-dashed border-primary/10">
                                                                            <div className="space-y-0.5">
                                                                                <FormLabel className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                                                    {field.availableQuestion || `Do you have ${field.fieldName}?`}
                                                                                    {f.value ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                                                                </FormLabel>
                                                                                <p className="text-[11px] text-muted-foreground font-medium text-amber-600/80">Toggle to 'Yes' if available.</p>
                                                                            </div>
                                                                            <FormControl>
                                                                                <Switch
                                                                                    checked={Boolean(f.value)}
                                                                                    onCheckedChange={f.onChange}
                                                                                    className="data-[state=checked]:bg-emerald-500 flex-shrink-0"
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            )}

                                                            {/* Render Actual Input Field */}
                                                            {isContentVisible && (
                                                                <div className={cn(
                                                                    (field.fieldName?.toLowerCase()?.includes('address') || field.fieldType === 'PAN') && "md:col-span-2",
                                                                    field.fieldType === 'PAN' && "grid md:grid-cols-1 gap-4 items-start"
                                                                )}>
                                                                    <FormField 
                                                                        control={control as any} 
                                                                        name={`roles.${role.roleKey}.members.${index}.details.${field.fieldKey}`}
                                                                        rules={{
                                                                            validate: (value: any) => {
                                                                                if (!isVisible || (isIfAvailable && !isContentVisible)) return true;
                                                                                if (field.requirement === 'Mandatory' || (isIfAvailable && isContentVisible)) {
                                                                                    if (!value || value === '') return `${field.fieldName} is required`;
                                                                                }
                                                                                return true;
                                                                            }
                                                                        }}
                                                                        render={({ field: formField }: { field: any }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-sm flex items-center gap-1.5 font-semibold text-slate-700">
                                                                                    {field.fieldName} {(isRequired || isIfAvailable) && <span className="text-destructive">*</span>} {field.fieldType === 'PAN' && <ShieldCheck className="h-3 w-3 text-blue-500" />}
                                                                                </FormLabel>
                                                                                <FormControl>
                                                                                    {field.fieldType === 'Phone' ? (
                                                                                        <PhoneInput 
                                                                                            value={formField.value} 
                                                                                            onChange={(val: any) => {
                                                                                                const digits = sanitizePhoneInput(val);
                                                                                                formField.onChange(digits);
                                                                                                if (isValidLocalPhone(digits)) {
                                                                    clearErrors(`fields.${field.fieldKey}`);
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                        <Input 
                                                                                            placeholder={`Enter ${field.fieldName}`}
                                                                                            {...formField} 
                                                                                            value={formField.value || ''} 
                                                                                            maxLength={getFieldMaxLength(field)}
                                                                                            onChange={(e: any) => {
                                                                                                formField.onChange(e.target.value);
                                                                                            }}
                                                                                            className={cn("h-10 transition-all focus:ring-2 focus:ring-primary/20", getFieldClass(`roles.${role.roleKey}.members.${index}.details.${field.fieldKey}`))} 
                                                                                        />
                                                                                    )}
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )} 
                                                                    />
                                                                    
                                                                    {/* Removed role member PAN proof upload */}
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                        {role.designations && role.designations.length > 0 && (
                                            <FormField control={control as any} name={`roles.${role.roleKey}.members.${index}.details.designation`}
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-sm">Designation <span className="text-destructive">*</span></FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value || ''}>
                                                            <FormControl><SelectTrigger className={getFieldClass(`roles.${role.roleKey}.members.${index}.details.designation`)}><SelectValue placeholder="Select a designation" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {role.designations.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        {Object.entries(memberDetails || {})
                                            .filter(([key]) => key && key !== 'undefined' && key !== 'null' && !key.includes('_proof_'))
                                            .map(([key, value]) => (
                                            <div key={key}>
                                                <span className="font-semibold">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: </span>
                                                <span>{String(value) || '—'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={addMember}
                    disabled={isAddButtonDisabled}
                    title={isAddButtonDisabled ? `Maximum of ${role.maxMembers} members reached` : `Add new ${role.roleName}`}
                    className="mt-4"
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add {role.roleName}
                </Button>
                <FormField control={control as any} name={`roles.${role.roleKey}.members`} render={({ fieldState }: { fieldState: any }) => fieldState.error ? <FormMessage className="mt-2">{fieldState.error.message}</FormMessage> : <></>} />
            </CardContent></Card>
    );
};

const ClientSignatoryManagement: React.FC<{ allRoles: Role[] }> = ({ allRoles }) => {
    const { control, watch, setValue, getValues, trigger, formState: { errors } } = useFormContext<ClientFormValues>();
    const { toast } = useToast();

    const rawRoles = useWatch({ name: 'roles' });
    const watchedRoles = useMemo(() => rawRoles || {}, [rawRoles]);
    
    const rawSignatories = useWatch({ name: 'signatories' });
    const watchedSignatories = useMemo(() => rawSignatories || [], [rawSignatories]);
    
    const rawPrimary = useWatch({ name: 'primarySignatories' });
    const watchedPrimarySignatoryMap = useMemo(() => rawPrimary || {}, [rawPrimary]);

    const selectAllRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const rolesVal = getValues('roles') || {};
        const valid: Record<string, Set<string>> = {};
        Object.keys(rolesVal).forEach(rk => {
            valid[rk] = new Set((rolesVal[rk]?.members || []).map((m: any) => m?._id).filter(Boolean));
        });
        const currSigs = getValues('signatories') || [];
        const filtered = currSigs.filter((s: any) => s.memberId && valid[s.roleKey]?.has(s.memberId));

        if (filtered.length !== currSigs.length) {
            setValue('signatories', filtered, { shouldDirty: true, shouldValidate: true });
        }

        const currPrim = getValues('primarySignatories') || {};
        const nextPrim: Record<string, string | undefined> = { ...currPrim };
        let primChanged = false;
        Object.keys(currPrim).forEach(rk => {
            if (currPrim[rk] && !valid[rk]?.has(currPrim[rk]!)) {
                nextPrim[rk] = undefined;
                primChanged = true;
            }
        });
        if (primChanged) {
            setValue('primarySignatories', nextPrim, { shouldDirty: true, shouldValidate: true });
        }
    }, [watchedRoles, getValues, setValue]); // Optimized dependency

    const displayName = (d: any) => 
        d.full_name || 
        d.name || 
        d.partner_name || 
        d.director_name || 
        'Unnamed Member';

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
        (watchedSignatories || []).some((s: any) => s.roleKey === rk && s.memberId === mid);

    const isPrimary = (rk: string, mid: string) =>
        (watchedPrimarySignatoryMap?.[rk] ?? '') === mid;

    const handleSignatoryChange = (roleKey: string, memberId: string, checked: boolean) => {
        const curr = getValues('signatories') || [];
        let next;
        if (checked) {
            if (!curr.some((s: any) => s.roleKey === roleKey && s.memberId === memberId)) {
                next = [...curr, { roleKey, memberId }];
            } else {
                next = curr;
            }
        } else {
            next = curr.filter((s: any) => !(s.roleKey === roleKey && s.memberId === memberId));
            if (getValues('primarySignatories')?.[roleKey] === memberId) {
                setValue(`primarySignatories.${roleKey}`, undefined as any, { shouldDirty: true, shouldValidate: true });
                trigger('primarySignatories');
            }
        }
        setValue('signatories', next, { shouldDirty: true, shouldValidate: true });
        trigger('signatories');
        trigger('primarySignatories');
    };

    const handlePrimaryChange = (roleKey: string, memberId: string) => {
        if (!isSignatory(roleKey, memberId)) {
            toast({
                title: "Invalid Action",
                description: "This member must be a signatory before they can be assigned as Primary.",
                variant: "destructive"
            });
            return;
        }
        setValue(`primarySignatories.${roleKey}`, memberId, { shouldDirty: true, shouldValidate: true });
        trigger('primarySignatories');
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
            const grouped: Record<string, string[]> = {};
            
            allMembers.forEach(m => {
                if (!m.memberId) return;
                if (!grouped[m.roleKey]) grouped[m.roleKey] = [];
                grouped[m.roleKey].push(m.memberId);
            });

            const all: any[] = [];
            const primary: Record<string, string> = {};

            Object.entries(grouped).forEach(([rk, members]) => {
                members.forEach(mid => all.push({ roleKey: rk, memberId: mid }));
                if (members.length > 0) {
                    primary[rk] = members[0]; // auto primary for first member in role
                }
            });

            setValue('signatories', all, { shouldDirty: true, shouldValidate: true });
            setValue('primarySignatories', primary, { shouldDirty: true, shouldValidate: true });
            
            trigger('signatories');
            trigger('primarySignatories');
        } else {
            setValue('signatories', [], { shouldDirty: true, shouldValidate: true });
            setValue('primarySignatories', {}, { shouldDirty: true, shouldValidate: true });
            
            trigger('signatories');
            trigger('primarySignatories');
        }
    };

    if (allMembers.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <CardTitle>Signatory Management</CardTitle>
                    <Badge variant="secondary">{watchedSignatories.length}/{allMembers.length}</Badge>
                </div>
                <CardDescription>
                    Designate which members are authorized signatories and select one primary per role.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="grid grid-cols-[2.5rem_1fr_7rem_7rem] items-center text-sm font-semibold text-muted-foreground px-2 py-2 border-b">
                        <div className="text-center">#</div>
                        <div className="px-4">Member Details</div>
                        <div className="text-center flex items-center justify-center gap-2">
                            <input
                                type="checkbox"
                                ref={selectAllRef}
                                id="select-all-signatories-client"
                                className="h-4 w-4"
                                checked={allSelected}
                                onChange={handleSelectAll}
                            />
                            <label htmlFor="select-all-signatories-client">Signatory</label>
                        </div>
                        <div className="text-center">Primary</div>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        {allMembers.map((member, idx) => {
                            if (!member.memberId) return null;
                            const otherDetails = { ...member.details };
                            delete otherDetails.full_name;
                            delete otherDetails.designation;

                            return (
                                <AccordionItem value={`item-${idx}`} key={member.memberId} className="border-b">
                                    <div className="grid grid-cols-[2.5rem_1fr_7rem_7rem] items-center px-2 py-1">
                                        <div className="text-center text-muted-foreground">{idx + 1}</div>

                                        <AccordionTrigger className="px-4 text-left hover:no-underline [&>svg]:hidden">
                                            <div className="flex flex-col">
                                                <span className="font-semibold">
                                                    {displayName(member.details) || 'Unnamed Member'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {member.details.designation || member.roleName}
                                                </span>
                                            </div>
                                        </AccordionTrigger>

                                        <div className="justify-self-center">
                                            <input
                                                type="checkbox"
                                                id={`client-signatory-${member.memberId}`}
                                                className="h-4 w-4 align-middle"
                                                checked={isSignatory(member.roleKey, member.memberId)}
                                                onChange={(e: any) =>
                                                    handleSignatoryChange(member.roleKey, member.memberId, e.target.checked)
                                                }
                                            />
                                        </div>

                                        <div className="justify-self-center">
                                            <input
                                                type="radio"
                                                id={`client-primary-${member.memberId}`}
                                                name={`client-primary-${member.roleKey}`}
                                                className="h-4 w-4 align-middle"
                                                checked={isPrimary(member.roleKey, member.memberId)}
                                                disabled={!isSignatory(member.roleKey, member.memberId)}
                                                onChange={() => handlePrimaryChange(member.roleKey, member.memberId)}
                                            />
                                        </div>
                                    </div>

                                    <AccordionContent>
                                        <div className="p-4 border rounded-lg bg-muted/30 ml-12 mt-2">
                                            <h4 className="font-semibold mb-2 text-primary">Full Details</h4>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                                {Object.entries(otherDetails).map(([key, value]) => (
                                                    <div key={key}>
                                                        <span className="font-medium capitalize">
                                                            {key.replace(/_/g, ' ')}:
                                                        </span>{' '}
                                                        <span>{String(value) || 'N/A'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>

                {/* --- Manual Contact Enrolment --- */}
                {watch('contacts')?.filter((c: any) => c.sourceType === 'manual').length > 0 && (
                    <div className="mt-8 pt-8 border-t border-dashed">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-green-100 rounded-full"><UserPlus className="h-4 w-4 text-green-600" /></div>
                            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Available Contacts (Manual)</h4>
                        </div>
                        <div className="space-y-3">
                            {watch('contacts')?.filter((c: any) => c.sourceType === 'manual').map((contact: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-muted/10 group hover:bg-muted/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border shadow-sm group-hover:border-primary/30 transition-colors">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{contact.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{contact.description || 'General Contact'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {allRoles.length > 0 ? (
                                            <Select onValueChange={(roleKey: string) => {
                                                const role = allRoles.find(r => r.roleKey === roleKey);
                                                if (!role) return;
                                                const currentRoleMembers = getValues(`roles.${roleKey}.members`) || [];
                                                if (role.maxMembers > 0 && currentRoleMembers.length >= role.maxMembers) {
                                                    toast({ title: "Role Full", description: `This role reached its limit.`, variant: "destructive" });
                                                    return;
                                                }
                                                const newMemberId = crypto.randomUUID();
                                                const nextRoleMembers = [
                                                    ...currentRoleMembers,
                                                    { 
                                                        _id: newMemberId, 
                                                        details: { 
                                                            full_name: contact.name, 
                                                            email: contact.email, 
                                                            phone: contact.phone,
                                                            designation: contact.description || role.roleName
                                                        } 
                                                    }
                                                ];
                                                setValue(`roles.${roleKey}.members`, nextRoleMembers, { shouldDirty: true });
                                                const currSigs = getValues('signatories') || [];
                                                setValue('signatories', [...currSigs, { roleKey, memberId: newMemberId }], { shouldDirty: true });
                                                const contactIdx = (getValues('contacts') || []).findIndex((c: any) => c.name === contact.name);
                                                if (contactIdx !== -1) {
                                                    const nextContacts = [...(getValues('contacts') || [])];
                                                    nextContacts[contactIdx] = { 
                                                        ...contact, 
                                                        sourceType: 'signatory',
                                                        memberId: newMemberId 
                                                    };
                                                    setValue('contacts', nextContacts, { shouldDirty: true });
                                                }
                                                toast({ title: "Signatory Enrolled", description: `${contact.name} has been assigned as a signatory for ${role.roleName}.` });
                                            }}>
                                                <SelectTrigger className="h-8 w-auto text-xs bg-white/80 border-primary/20 hover:border-primary/40"><SelectValue placeholder="Sign as Role..." /></SelectTrigger>
                                                <SelectContent>
                                                    {allRoles.map(r => (
                                                        <SelectItem key={r.roleKey} value={r.roleKey}>
                                                            <div className="flex flex-col items-start">
                                                                <span className="font-bold">{r.roleName}</span>
                                                                <span className="text-[9px] text-muted-foreground leading-none">Min: {r.minMembers}, Max: {r.maxMembers === 0 ? '∞' : r.maxMembers}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground italic">No roles available</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {errors.signatories && <FormMessage className="mt-2 text-destructive">{errors.signatories.message?.toString()}</FormMessage>}
                {errors.primarySignatories && <FormMessage className="mt-2 text-destructive">{errors.primarySignatories.message?.toString()}</FormMessage>}
            </CardContent>
        </Card>
    );
}

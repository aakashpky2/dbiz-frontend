'use client';
import { apiFetch } from '@/lib/apiFetch';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
    Loader2, Check, PlusCircle, Trash2, Edit, X, Briefcase, FileText, Download, FileUp,
    Building, Users, User, ChevronsUpDown, Clock,Phone, Mail, MapPin,
    Building2, UserCheck, ShieldCheck, UserCheck2, TrendingUp, Info} from 'lucide-react';
import { calculateProposalFinancials, normalizeStage, getStageColor } from '@/lib/proposal-utils';
import { PhoneInput } from '@/components/ui/phone-input';
import { phoneValidation, PHONE_ERROR_MESSAGE, formatPhoneNumber, parsePhoneNumber, PHONE_REGEX, isValidLocalPhone } from '@/lib/phone-utils';
import { Label } from '@/components/ui/label';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useBusinessConstitutions, useProfiles } from '@/hooks/use-profiles';
import { useClients } from '@/hooks/use-clients';
import { useQueries } from '@/hooks/use-queries';
import { useDebounce } from '@/hooks/use-debounce';
import { Separator } from '@/components/ui/separator';
import { listenToDepartments, type Department, type WorkType } from '@/lib/department-management';
import { Badge } from '@/components/ui/badge';
import { validateProposalForm, buildValidationToastMessage } from '@/lib/validation-utils';
import { CountryCodeSelect } from '@/components/common/CountryCodeSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, flattenFields } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
const ProposalServicesPricingSection = dynamic(() => import('./ProposalServicesPricingSection').then(mod => mod.ProposalServicesPricingSection), { ssr: false });
import { getMemberDisplayName } from '@/lib/member-name-utils';


const proposalItemSchema = z.object({
    workTypeId: z.string().min(1),
    workTypeName: z.string(),
    departmentName: z.string(),
    categoryName: z.string(),
    professionalFee: z.coerce.number().min(0, "Fee cannot be negative").default(0),
    governmentFee: z.coerce.number().min(0, "Fee cannot be negative").default(0),
    governmentFeeBreakup: z.array(z.object({
        name: z.string(),
        amount: z.number(),
    })).optional().nullable(),
    isGstApplicable: z.boolean().default(true),
    gstPercentage: z.coerce.number().min(0).max(100).default(18),
    gstAppliedOn: z.enum(['professional', 'government', 'both']).default('professional'),
    noInvoice: z.boolean().default(false),
    discountType: z.enum(['amount', 'percentage']).default('amount'),
    discountValue: z.coerce.number().min(0).default(0),
    discountAmount: z.coerce.number().default(0),
    rateCardItemId: z.string().optional().nullable(),
    rateCardName: z.string().optional().nullable(),
    manualRate: z.boolean().default(true),
    itemTotal: z.number().optional().nullable(),
    warningNote: z.string().optional().nullable(),
});

type ProposalItem = z.infer<typeof proposalItemSchema>;

const contactSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    phone: z.string().min(1, "Phone number is required"),
    countryCode: z.string().optional().default('+91'),
    email: z.string().email("Invalid email").or(z.literal("")).optional(),
    description: z.string().optional(),
    remarks: z.string().optional(),
}).superRefine((data, ctx) => {
    const parsed = parsePhoneNumber(data.phone || '', data.countryCode || '+91');
    const localNumber = (parsed.number || '').replace(/\D/g, '').slice(-10);

    if (!isValidLocalPhone(localNumber)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Phone number must be exactly 10 digits",
            path: ["phone"],
        });
    }
});

type ProposalContact = z.infer<typeof contactSchema>;

const proposalFormSchema = z.object({
    flowType: z.enum(['pending', 'new']),
    selectedQueryId: z.string().optional(),

    // 'new' flow specific
    clientType: z.enum(['existing', 'new']).optional(),
    existingClientId: z.string().optional(),
    clientName: z.string().optional(), // Renamed from companyName
    phone: z.string().min(10, "Phone number must be exactly 10 digits").max(10, "Phone number must be exactly 10 digits").optional().or(z.literal('')),
    email: z.string().optional().or(z.literal('')),
    countryCode: z.string().optional().default('+91'),

    // New Client specific details
    constitutionId: z.string().optional(),
    reference: z.enum(['Direct', 'Associate']).default('Direct'),
    associateId: z.string().optional(),

    profileId: z.string().min(1, "Profile (Branch) is required."),
    contacts: z.array(contactSchema),
    proposalItems: z.array(proposalItemSchema).min(1, "At least one service is required."),

    clientRequestedChanges: z.string().optional(),
    queryDescription: z.string().optional(),
    noInvoice: z.boolean().optional().default(false),
    discountType: z.enum(['amount', 'percentage']).optional().default('amount'),
    discountValue: z.coerce.number().min(0).optional().default(0),
    discountAmount: z.coerce.number().optional().default(0),
    processingDays: z.coerce.number().optional().default(0),
    processingHours: z.coerce.number().optional().default(0),
}).refine(data => {
    // Note: We can't easily check 'mode' inside the schema unless we pass it to the validator
    // But we will handle the 'required' check in the submit handler or via conditional field validation
    return true;
}, {
    message: "Validation failed",
    path: ["clientRequestedChanges"]
}).superRefine((data, ctx) => {
    if (data.flowType === 'pending') {
        if (!data.selectedQueryId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select an enquiry",
                path: ["selectedQueryId"]
            });
        }
    }
    
    if (data.flowType === 'new') {
        if (data.clientType === 'existing' && !data.existingClientId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select an existing client",
                path: ["existingClientId"]
            });
        }
        
        if (data.clientType === 'new') {
            if (!data.clientName?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Client name is required",
                    path: ["clientName"]
                });
            }
            
            const hasPhone = data.phone && data.phone.trim().length > 0;
            const hasEmail = data.email && data.email.trim().length > 0;
            
            if (!hasPhone && !hasEmail) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Either phone or email is required",
                    path: ["phone"]
                });
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Either phone or email is required",
                    path: ["email"]
                });
            } else {
                if (hasPhone && !isValidLocalPhone(data.phone!)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Phone number must be exactly 10 digits",
                        path: ["phone"]
                    });
                }
                
                if (hasEmail && !z.string().email().safeParse(data.email).success) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Invalid email address",
                        path: ["email"]
                    });
                }
            }
        }
    }
});

type ProposalFormValues = z.infer<typeof proposalFormSchema>;

interface ProposalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    query?: any | null;
    editingProposal?: any | null;
    onSuccess?: (savedId?: string) => void;
    mode?: 'create-pending' | 'generate-from-pending' | 'edit-generated' | 'revise-client' | 'view';
}

export function ProposalDialog({ open, onOpenChange, query, editingProposal, onSuccess, mode = 'create-pending' }: ProposalDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { constitutions } = useBusinessConstitutions();
    const { profiles } = useProfiles();

    // UI States
    const [clientSearch, setClientSearch] = useState('');
    const debouncedClientSearch = useDebounce(clientSearch, 500);
    const [querySearch, setQuerySearch] = useState('');
    const debouncedQuerySearch = useDebounce(querySearch, 500);

    // Optimized Data Hooks (Lazy & Field-Selective)
    // Optimized Data Hooks replaced by manual fetch for maximum reliability
    const [allClients, setAllClients] = useState<any[]>([]);
    const [allQueries, setAllQueries] = useState<any[]>([]);
    const [isClientFetching, setIsClientFetching] = useState(false);
    const [isQueryFetching, setIsQueryFetching] = useState(false);
    
    const [allAssociates, setAllAssociates] = useState<{ id: string; name: string }[]>([]);
    const [linkingContactSearchId, setLinkingContactSearchId] = useState('initial');
    const [isMasterLoading, setIsMasterLoading] = useState(false);
    const [departments, setDepartments] = useState<string[]>([]);
    const [masterWorkTypes, setMasterWorkTypes] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch master data when dialog opens
    useEffect(() => {
        if (!open) return;
        
        const fetchMainData = async () => {
            setIsClientFetching(true);
            setIsQueryFetching(true);
            try {
                const [cRes, qRes] = await Promise.all([
                    apiFetch(`/api/clients?limit=500&search=${encodeURIComponent(debouncedClientSearch)}`),
                    apiFetch(`/api/queries?limit=100&search=${encodeURIComponent(debouncedQuerySearch)}`)
                ]);

                if (cRes.ok) {
                    const cResult = await cRes.json();
                    const raw = Array.isArray(cResult.data) ? cResult.data : [];

                    setAllClients(raw.map((c: any) => {
                        const name = c.clientName || c.client_name || c.company_name || c.companyName || 'Unnamed Client';
                        const flat = flattenFields(c.fields || {});
                        return {
                            ...c,
                            id: c.id,
                            clientName: name,
                            constitutionId: c.constitutionId || c.constitution_id,
                            phone: c.phone || c.contact_number || flat.whatsapp || flat.phone || flat.contact_no || flat.mobile || '',
                            email: c.email || c.email_id || flat.email || flat.email_id || '',
                            flatFields: flat
                        };
                    }));
                }

                if (qRes.ok) {
                    const qResult = await qRes.json();
                    const raw = Array.isArray(qResult.data) ? qResult.data : [];

                    setAllQueries(raw.map((q: any) => ({
                        ...q,
                        id: q.id,
                        clientId: q.clientId || q.client_id,
                        companyName: q.companyName || q.company_name,
                        contactPerson: q.contactPerson || q.contact_person,
                        contactNumber: q.contactNumber || q.contact_number,
                        emailId: q.emailId || q.email_id,
                        queryDetails: q.queryDetails || q.query_details,
                        enquiryContacts: q.enquiryContacts || q.enquiry_contacts || [],
                        workItems: q.workItems || q.work_items || []
                    })));
                }
            } catch (err) {

            } finally {
                setIsClientFetching(false);
                setIsQueryFetching(false);
            }
        };

        fetchMainData();
    }, [open, debouncedClientSearch, debouncedQuerySearch]);

    // UI states
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
    const [queryPopoverOpen, setQueryPopoverOpen] = useState(false);

    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [editingContactIdx, setEditingContactIdx] = useState<number | null>(null);
    const [draftContact, setDraftContact] = useState<ProposalContact | null>(null);
    const [isLinkingExisting, setIsLinkingExisting] = useState(false);
    const [linkingClientId, setLinkingClientId] = useState('');
    const [linkingContacts, setLinkingContacts] = useState<any[]>([]);
    const [isFetchingLinkContacts, setIsFetchingLinkContacts] = useState(false);
    const [selectedLinkContact, setSelectedLinkContact] = useState<any>(null);




    const form = useForm<ProposalFormValues>({
        resolver: zodResolver(proposalFormSchema) as any,
        mode: "onSubmit",
        reValidateMode: "onSubmit",
        defaultValues: {
            flowType: 'pending',
            clientType: 'existing',
            contacts: [],
            proposalItems: [],
            profileId: '',
            phone: '',
            email: '',
            clientName: '',
            countryCode: '+91',
        },
    });

    const { fields: workFields, append: appendWork, remove: removeWork, replace, update: updateWork } = useFieldArray({
        control: form.control,
        name: "proposalItems"
    });

    const { fields: contactFields, append: appendContact, remove: removeContact, replace: replaceContacts, update: updateContact } = useFieldArray({
        control: form.control,
        name: "contacts"
    });

    const isPendingMode = mode === 'create-pending';
    const isGenerateMode = mode === 'generate-from-pending';
    const isEditMode = mode === 'edit-generated';

    const flowType = form.watch('flowType');
    const clientType = form.watch('clientType');
    const selectedQueryId = form.watch('selectedQueryId');
    const existingClientId = form.watch('existingClientId');
    const rawProposalItems = useWatch({
        control: form.control,
        name: 'proposalItems',
    });
    const proposalItems = useMemo(() => rawProposalItems || [], [rawProposalItems]);
    const contacts = form.watch('contacts') || [];
    const currentProfileId = form.watch('profileId');
    const reference = form.watch('reference');
    const clientName = form.watch('clientName');
    const phone = form.watch('phone');
    const email = form.watch('email');
    const noInvoice = form.watch('noInvoice');

    const isClientResolved = isGenerateMode || isEditMode || (flowType === 'pending'
        ? !!selectedQueryId
        : (clientType === 'existing'
            ? !!existingClientId
            : (!!clientName && clientName.length > 2 && (!!phone?.trim() || !!email?.trim()))));

    const selectedClient = useMemo(() => {
        if (flowType === 'pending') {
            const q = allQueries.find((cur: any) => cur.id === selectedQueryId);
            if (q?.clientId) {
                const client = allClients.find((c: any) => c.id === q.clientId);
                if (client) return client;
            }
            if (q) return {
                clientName: q.companyName || q.contactPerson,
                phone: q.contactNumber,
                email: q.emailId,
                address: q.address,
                isManual: true,
                constitutionId: q.constitutionId,
                fields: {}
            };
            return null;
        }
        return allClients.find((c: any) => c.id === existingClientId);
    }, [flowType, selectedQueryId, existingClientId, allQueries, allClients]);

    const selectedProfile = useMemo(() => profiles.find(p => p.id === currentProfileId), [profiles, currentProfileId]);
    const hasGST = useMemo(() => {
        if (!selectedProfile) return false;
        const fields = selectedProfile.fields || {};
        if (typeof fields.gst_applicable === 'boolean') {
            return fields.gst_applicable;
        }
        // Fallback for older profiles: if gstin_isAvailable is explicitly false, it's not applicable
        if (fields.gstin_isAvailable === false) {
            return false;
        }
        return !!(fields.gstin || fields.gstin_isAvailable);
    }, [selectedProfile]);

    const financials = useMemo(() => {
        // Enforce GST 0 if hasGST is false
        const itemsToCalculate = proposalItems.map((item: any) => ({
            ...item,
            isGstApplicable: hasGST ? (item.isGstApplicable !== false) : false
        }));
        return calculateProposalFinancials(itemsToCalculate);
    }, [proposalItems, hasGST]);

    const discountFinancials = useMemo(() => {
        return {
            totalBeforeDiscount: financials.totalBeforeDiscount,
            discountAmount: financials.totalDiscount,
            finalTotal: financials.finalTotal,
        };
    }, [financials]);

    const { totalGst: gstAmount, netTotal: totalAmount } = financials;

    const initialEmptyState: any = useMemo(() => ({
        flowType: 'pending',
        clientType: 'new',
        contacts: [],
        proposalItems: [],
        profileId: '',
        processingDays: 0,
        processingHours: 0,
        reference: 'Direct',
        phone: '',
        email: '',
        clientName: '',
        countryCode: '+91',
        noInvoice: false,
    }), []);

    // ── Synchronization Logic for Edit Mode ──────────────────────────────────
    useEffect(() => {
        if (!open) return;

        if (editingProposal) {
            // Priority 1: Edit Mode
            // Robust mapping of services/items from backend or internal representation
            const sourceItems = editingProposal.proposedWork || editingProposal.proposalItems || [];
            const mappedProposalItems = sourceItems.map((wi: any) => ({
                workTypeId: wi.workTypeId,
                workTypeName: wi.workTypeName,
                departmentName: wi.departmentName,
                categoryName: wi.categoryName,
                professionalFee: Number(wi.professionalFee || wi.professionalFees) || 0,
                governmentFee: Number(wi.governmentFee || wi.govtFees) || 0,
                governmentFeeBreakup: wi.governmentFeeBreakup || wi.governmentFees || wi.government_fees || [],
                isGstApplicable: wi.isGstApplicable !== undefined ? wi.isGstApplicable : true,
                gstPercentage: Number(wi.gstPercentage) || 18,
                gstAppliedOn: wi.gstAppliedOn || 'professional',
                discountType: wi.discountType || 'amount',
                discountValue: Number(wi.discountValue) || 0,
                discountAmount: Number(wi.discountAmount) || 0,
                warningNote: wi.warningNote || wi.warning_note || '',
            }));

            // Robust mapping of contacts
            const sourceContacts = editingProposal.contacts || editingProposal.proposalContacts || [];
            const mappedContacts = sourceContacts.map((c: any) => ({
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                countryCode: c.countryCode || '+91',
                email: c.email || '',
                description: c.description || '',
                remarks: c.remarks || ''
            }));

            form.reset({
                ...initialEmptyState,
                flowType: editingProposal.flowType || (editingProposal.queryId ? 'pending' : 'new'),
                clientType: editingProposal.clientId ? 'existing' : 'new',
                existingClientId: editingProposal.clientId || undefined,
                selectedQueryId: editingProposal.queryId || undefined,
                clientName: editingProposal.clientName || '',
                phone: (editingProposal.phone || editingProposal.contactPhone || '').slice(-10),
                countryCode: editingProposal.countryCode || '+91',
                email: editingProposal.email || editingProposal.contactEmail || '',
                queryDescription: editingProposal.description || editingProposal.queryDescription || '',
                profileId: editingProposal.profileId || '',
                contacts: mappedContacts,
                proposalItems: mappedProposalItems,
                noInvoice: !!editingProposal.noInvoice,
                discountType: editingProposal.discountType || editingProposal.discount_type || 'amount',
                discountValue: Number(editingProposal.discountValue ?? editingProposal.discount_value ?? 0),
                discountAmount: Number(editingProposal.discountAmount ?? editingProposal.discount_amount ?? 0),
            });
            
            // Sync field arrays separately to ensure UI updates
            replaceContacts(mappedContacts);
            replace(mappedProposalItems);
        } 
        else if (query) {
            // Priority 2: New from Query
            const defaultProfile = profiles.find(p => p.isDefault)?.id || (profiles.length > 0 ? profiles[0].id : '');
            
            const mappedQueryContacts = (query.enquiryContacts || []).map((c: any, idx: number) => {
                const parsed = parsePhoneNumber(c.phone || '', c.countryCode || '+91');
                return {
                    id: c.id || `query-contact-${idx}`,
                    name: c.name,
                    phone: parsed.number.slice(-10),
                    countryCode: parsed.countryCode || '+91',
                    email: c.email || '',
                    description: c.description || '',
                    remarks: c.enquiryReason || ''
                };
            });

            const mappedQueryItems = (query.workItems || []).map((wi: any) => ({
                workTypeId: wi.workTypeId,
                workTypeName: wi.workTypeName,
                departmentName: wi.departmentName,
                categoryName: wi.categoryName,
                professionalFee: Number(wi.professionalFees) || 0,
                governmentFee: Number(wi.govtFees) || 0,
                governmentFeeBreakup: wi.governmentFeeBreakup || wi.governmentFees || wi.government_fees || [],
                isGstApplicable: true,
                gstPercentage: 18,
                gstAppliedOn: 'professional',
                warningNote: wi.warningNote || wi.warning_note || '',
            }));

            form.reset({
                ...initialEmptyState,
                flowType: 'pending',
                selectedQueryId: query.id,
                clientType: 'existing',
                profileId: query.profileId || defaultProfile,
                contacts: mappedQueryContacts,
                proposalItems: mappedQueryItems,
                queryDescription: query.queryDetails || '',
            });
            
            replaceContacts(mappedQueryContacts);
            replace(mappedQueryItems);
        } else {
            // Priority 3: Clean Start
            const defaultProfile = profiles.find(p => p.isDefault)?.id || (profiles.length > 0 ? profiles[0].id : '');
            form.reset({
                ...initialEmptyState,
                flowType: 'new',
                clientType: 'existing',
                profileId: defaultProfile,
            });
            replaceContacts([]);
            replace([]);
        }
    }, [open, editingProposal, query, profiles, form, replace, replaceContacts, initialEmptyState]);

    // Reset when dialog closes to prevent stale data
    useEffect(() => {
        if (!open) {
            form.reset(initialEmptyState);
            setEditingContactId(null);
            setEditingContactIdx(null);
            setIsAddContactOpen(false);
            setClientPopoverOpen(false);
            setQueryPopoverOpen(false);
        }
    }, [open, form, initialEmptyState]);

    useEffect(() => {
        if (!open) return;
        const fetchMisc = async () => {
            try {
                const aRes = await apiFetch('/api/associates?limit=1000');
                if (aRes.ok) {
                    const aData = await aRes.json();
                    setAllAssociates(Array.isArray(aData.data) ? aData.data : []);
                }
            } catch (err) {
                // Silent fail
            }
        };
        fetchMisc();

        setIsMasterLoading(true);
        const unsubscribeDepts = listenToDepartments((depts: any[]) => {
            const flatTypes: any[] = [];
            const deptNames = new Set<string>();
            depts.forEach((dept) => {
                deptNames.add(dept.name);
                (dept.workCategories || []).forEach((cat: any) => {
                    (cat.workTypes || []).forEach((wt: any) => {
                        flatTypes.push({
                            id: wt.id,
                            name: wt.name,
                            categoryName: cat.name,
                            departmentName: dept.name,
                            description: wt.description,
                            warningNote: wt.warning_note || wt.warningNote
                        });
                    });
                });
            });
            setMasterWorkTypes(flatTypes.sort((a, b) => a.name.localeCompare(b.name)));
            setDepartments(Array.from(deptNames).sort());
            setIsMasterLoading(false);
        });

        // Fallback fetch for master data if realtime is slow or empty
        const fallbackFetch = async () => {
            try {
                const res = await apiFetch(`/api/departments?_t=${Date.now()}`);
                if (res.ok) {
                    const depts = await res.json();
                    if (Array.isArray(depts) && depts.length > 0) {
                        const flatTypes: any[] = [];
                        const deptNames = new Set<string>();
                        depts.forEach((dept: any) => {
                            deptNames.add(dept.name);
                            (dept.workCategories || []).forEach((cat: any) => {
                                (cat.workTypes || []).forEach((wt: any) => {
                                    flatTypes.push({
                                        id: wt.id,
                                        name: wt.name,
                                        categoryName: cat.name,
                                        departmentName: dept.name,
                                        description: wt.description,
                                        warningNote: wt.warning_note || wt.warningNote
                                    });
                                });
                            });
                        });
                        setMasterWorkTypes(prev => prev.length === 0 ? flatTypes.sort((a, b) => a.name.localeCompare(b.name)) : prev);
                        setDepartments(prev => prev.length === 0 ? Array.from(deptNames).sort() : prev);
                    }
                }
            } catch (err) {
                console.error("Master fallback fetch failed:", err);
            } finally {
                setIsMasterLoading(false);
            }
        };
        fallbackFetch();

        return () => unsubscribeDepts();
    }, [open]);

    useEffect(() => {
        if (masterWorkTypes.length > 0) {
            console.log("[ProposalDialog] available services:", masterWorkTypes);
            console.log(
              "[ProposalDialog] AOC service payload:",
              masterWorkTypes?.find((s: any) =>
                String(s.name || s.workTypeName || s.work_type_name || "")
                  .toLowerCase()
                  .includes("aoc")
              )
            );
        }
    }, [masterWorkTypes]);

    // LOCKED PROFILE BEHAVIOR
    useEffect(() => {
        if (flowType === 'pending' && selectedQueryId && allQueries.length > 0) {
            const q = allQueries.find((cur: any) => cur.id === selectedQueryId);
            if (q?.profileId) {
                form.setValue('profileId', q.profileId);
            }
        }
    }, [flowType, selectedQueryId, allQueries, form]);


    const handleLinkClientChange = async (id: string) => {
        setLinkingClientId(id);
        setLinkingContacts([]);
        if (!id) return;
        setIsFetchingLinkContacts(true);
        try {
            const res = await apiFetch(`/api/clients/${id}`);
            if (res.ok) {
                const clientData = await res.json();
                const mapped = (clientData.data?.contacts || []).map((c: any, idx: number) => ({
                    id: c.id || `lnk-${idx}`,
                    name: c.name || getMemberDisplayName(c, c.description || c.role || 'Contact', idx),
                    phone: c.phone || '',
                    countryCode: c.countryCode || '+91',
                    email: c.email || '',
                    description: c.description || c.role || ''
                }));
                setLinkingContacts(mapped);
            }
        } catch (err) {
            // Silent fail
        } finally {
            setIsFetchingLinkContacts(false);
        }
    };

    // Automatically sync linking contacts when client changes
    useEffect(() => {
        if (selectedClient?.id && !selectedClient.isManual) {
            handleLinkClientChange(selectedClient.id);
        } else {
            setLinkingContacts([]);
        }
    }, [selectedClient?.id, selectedClient?.isManual]);

    const handleLinkContactSelect = (contactId: string) => {
        const contact = linkingContacts.find(c => c.id === contactId);
        if (contact) {
            // Check for duplicates
            if (contacts.some(c => c.phone === contact.phone)) {
                toast({ title: "Already Added", description: "This Contact is already in the list.", variant: "destructive" });
                return;
            }

            // Populate draft form instead of directly appending
            setDraftContact({ 
                id: `lk-${Date.now()}`, 
                name: contact.name, 
                phone: contact.phone, 
                countryCode: contact.countryCode || '+91',
                email: contact.email || '', 
                description: contact.description || '', 
                remarks: '' 
            });
            setIsAddContactOpen(true);
            setEditingContactIdx(null); // New contact from existing registry

            toast({ title: "Stakeholder Selected", description: `Please confirm details for ${contact.name}.` });
            
            setLinkingContactSearchId(`clr-${Date.now()}`);
        }
    };

    const handleConfirmContact = () => {
        if (!draftContact) return;
        
        const errs: Record<string, string> = {};
        
        if (!(draftContact.name || '').trim()) errs.name = 'Name is required';
        if (!draftContact.phone || draftContact.phone.length < 10) errs.phone = 'Valid 10-digit number is required';
        
        if (Object.keys(errs).length > 0) { 
            setContactErrors(errs); 
            return; 
        }

        const parsedNew = parsePhoneNumber(draftContact.phone, draftContact.countryCode || '+91');
        const normalizedPhone = formatPhoneNumber(parsedNew.countryCode || '+91', parsedNew.number);

        // Check for duplicates (excluding itself if editing)
        const isDuplicate = contacts.some((c: any, i: number) => {
            if (i === editingContactIdx) return false;
            const parsedExisting = parsePhoneNumber(c.phone, c.countryCode || '+91');
            const normalizedExisting = formatPhoneNumber(parsedExisting.countryCode || '+91', parsedExisting.number);
            return normalizedExisting === normalizedPhone;
        });
        if (isDuplicate) {
            toast({ title: "Duplicate Stakeholder", description: "This person is already in your list.", variant: "destructive" });
            return;
        }

        const finalData = {
            ...draftContact,
            phone: normalizedPhone
        };
        
        if (editingContactIdx !== null) {
            updateContact(editingContactIdx, finalData);
        } else {
            appendContact(finalData);
        }

        setDraftContact(null);
        setEditingContactId(null);
        setEditingContactIdx(null);
        setIsAddContactOpen(false);
        setContactErrors({});
        toast({ title: "Contact Saved", description: "Stakeholder details have been confirmed." });
    };

    const handleCloseContactForm = () => {
        setDraftContact(null);
        setEditingContactId(null);
        setEditingContactIdx(null);
        setIsAddContactOpen(false);
        setContactErrors({});
    };


    const handleEditContact = (id: string, data: any, idx: number) => {
        const parsed = parsePhoneNumber(data.phone || '');
        setEditingContactId(id);
        setEditingContactIdx(idx);
        setIsAddContactOpen(true);
        
        setDraftContact({
            id: data.id || id,
            name: data.name || '',
            phone: parsed.number,
            countryCode: data.countryCode || parsed.countryCode || '+91',
            email: data.email || '',
            description: data.description || '',
            remarks: data.remarks || ''
        });

        requestAnimationFrame(() => {
            document.getElementById(`contact-form`)?.scrollIntoView({ behavior: 'smooth' });
        });
    };

    const handleAddContactStart = () => {
        setDraftContact({ 
            id: `new-${Date.now()}`, 
            name: '', 
            phone: '', 
            email: '', 
            description: '', 
            remarks: '', 
            countryCode: '+91' 
        });
        setEditingContactIdx(null);
        setIsAddContactOpen(true);
        setEditingContactId(null);
    };



    const handleClientSelect = (client: any) => {
        form.setValue('existingClientId', client.id);
        form.setValue('clientName', client.clientName || 'Unnamed Client');
        setClientPopoverOpen(false);
        // Automatically fetch contacts for linking
        handleLinkClientChange(client.id);
    };

    const handleQuerySelect = (q: any) => {
        form.setValue('selectedQueryId', q.id);
        form.setValue('queryDescription', q.queryDetails || '');

        const queryContacts = (q.enquiryContacts || []).map((c: any) => {
            const parsed = parsePhoneNumber(c.phone || '', c.countryCode || '+91');
            return {
                id: c.id,
                name: c.name,
                phone: parsed.number.slice(-10),
                countryCode: parsed.countryCode || '+91',
                email: c.email || '',
                description: c.description || '',
                remarks: c.enquiryReason || ''
            };
        });
        replaceContacts(queryContacts);

        const queryWorkItems = (q.workItems || []).map((wi: any) => ({
            workTypeId: wi.workTypeId,
            workTypeName: wi.workTypeName,
            departmentName: wi.departmentName,
            categoryName: wi.categoryName,
            professionalFee: Number(wi.professionalFees) || 0,
            governmentFee: Number(wi.govtFees) || 0,
            profGstPercentage: 18,
            govtGstPercentage: 18,
        }));
        replace(queryWorkItems);

        setQueryPopoverOpen(false);
        toast({ title: "Query Selected", description: `Imported ${queryWorkItems.length} services.` });
    };

    const proposalValidation = validateProposalForm({...form.getValues(), flowType, clientType, selectedQueryId, proposalItems, noInvoice});



    const handleCreateProposal = async (data: ProposalFormValues, overrideStage?: string) => {

        // Per-item discount validation
        for (let i = 0; i < data.proposalItems.length; i++) {
            const item = data.proposalItems[i];
            const pFee = Number(item.professionalFee) || 0;
            const gFee = Number(item.governmentFee) || 0;
            let itemGst = 0;
            if (item.isGstApplicable && !item.noInvoice) {
                const rate = (Number(item.gstPercentage) || 18) / 100;
                const on = item.gstAppliedOn || 'professional';
                if (on === 'professional') itemGst = pFee * rate;
                else if (on === 'government') itemGst = gFee * rate;
                else if (on === 'both') itemGst = (pFee + gFee) * rate;
            }
            const itemTotal = pFee + gFee + itemGst;

            if (item.discountType === 'percentage' && item.discountValue > 100) {
                toast({
                    title: "Invalid Discount",
                    description: `Percentage discount for service "${item.workTypeName}" cannot be greater than 100%.`,
                    variant: "destructive"
                });
                return;
            }

            if (item.discountType === 'amount' && item.discountValue > itemTotal) {
                toast({
                    title: "Invalid Discount",
                    description: `Discount for service "${item.workTypeName}" cannot be greater than its total (₹${itemTotal.toLocaleString()}).`,
                    variant: "destructive"
                });
                return;
            }
        }
        
        // Target Stage determination
        const targetStage = overrideStage || (mode === 'create-pending' ? 'Pending Generation' : (mode === 'generate-from-pending' ? 'Draft' : undefined));

        // Validation for revision mode
        if (mode === 'revise-client' && !data.clientRequestedChanges?.trim()) {
            toast({
                title: "Feedback Required",
                description: "Please document the client requested changes for this revision.",
                variant: "destructive"
            });
            return;
        }

        // Use normal validation if generating (Draft)
        if ((isGenerateMode || isEditMode) && !proposalValidation.isValid) {
            console.warn("[ProposalDialog] Manual validation failed for Generate/Update:", proposalValidation.errors);
            toast({
                title: "Incomplete Proposal",
                description: buildValidationToastMessage(proposalValidation.errors),
                variant: "destructive"
            });
            return;
        }

        // Custom Validation for No Invoice
        if ((isGenerateMode || isEditMode)) {
            const hasInvalidItem = data.proposalItems.some((item: any) => !item.noInvoice && Number(item.professionalFee) <= 0);
            if (hasInvalidItem) {
                toast({
                    title: "Validation Error",
                    description: "Professional fee is required unless No Invoice is selected.",
                    variant: "destructive"
                });
                return;
            }
        }

        // Basic validation for Pending save
        if (isPendingMode && !isClientResolved) {
            toast({
                title: "Incomplete Basic Details",
                description: "Please select a client or enquiry to save as pending.",
                variant: "destructive"
            });
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            let finalClientId = null;
            let finalClientName = '';
            let tempClientId = null;

            if (data.flowType === 'new') {
                if (data.clientType === 'existing') {
                    finalClientId = data.existingClientId;
                    finalClientName = data.clientName || allClients.find(c => c.id === data.existingClientId)?.clientName || '';
                } else {
                    // Create prospective client entry
                    const tRes = await apiFetch('/api/proposals/temp-clients', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clientName: data.clientName,
                            constitutionId: data.constitutionId,
                            reference: data.reference,
                            associateId: data.associateId,
                            contactPhone: data.phone ? formatPhoneNumber(data.countryCode || '+91', data.phone) : "",
                            contactCountryCode: data.countryCode || '+91',
                            contactEmail: data.email || "",
                            createdBy: user?.uid
                        })
                    });

                    if (!tRes.ok) {
                        const tErr = await tRes.json();
                        throw new Error(tErr.error || 'Failed to initialize prospective client');
                    }

                    const tData = await tRes.json();
                    tempClientId = tData.id;
                    finalClientName = data.clientName || 'New Prospective Client';
                }
            } else {
                const q = allQueries.find((cur: any) => cur.id === data.selectedQueryId) || query;
                finalClientId = q?.clientId || q?.client_id || null;
                finalClientName = q?.companyName || q?.company_name || q?.contactPerson || q?.contact_person || data.clientName || editingProposal?.clientName || 'Unknown';
            }

            // Normalize all contacts before submission to ensure E.164 format
            const normalizedContacts = data.contacts.map((c: any, idx: number) => {

                const { countryCode, number } = parsePhoneNumber(c.phone, c.countryCode || '+91');
                const finalPhone = formatPhoneNumber(countryCode, number);

                return {
                    ...c,
                    phone: finalPhone,
                    countryCode: countryCode
                };
            });

            const stage = normalizeStage(editingProposal?.currentStage || editingProposal?.current_stage || editingProposal?.status || "Draft");

            // ══ EXPLICIT FINANCIAL CALCULATION ══
            const filteredProfSubtotal = data.proposalItems.reduce((sum, item) => sum + (Number(item.professionalFee) || 0), 0);
            const filteredGovtSubtotal = data.proposalItems.reduce((sum, item) => sum + (Number(item.governmentFee) || 0), 0);
            let filteredGstTotal = 0;
            let filteredDiscountTotal = 0;

            data.proposalItems.forEach((item: any) => {
                const pFee = Number(item.professionalFee) || 0;
                const gFee = Number(item.governmentFee) || 0;
                
                // GST Calculation
                let itemGst = 0;
                if (item.isGstApplicable && !item.noInvoice) {
                    const rate = (Number(item.gstPercentage) || 18) / 100;
                    const on = item.gstAppliedOn || 'professional';
                    if (on === 'professional') itemGst = pFee * rate;
                    else if (on === 'government') itemGst = gFee * rate;
                    else if (on === 'both') itemGst = (pFee + gFee) * rate;
                }
                filteredGstTotal += itemGst;

                // Discount Calculation
                const itemTotalBeforeDiscount = pFee + gFee + itemGst;
                const discountType = item.discountType || 'amount';
                const discountValue = Number(item.discountValue) || 0;
                let itemDiscount = 0;

                if (discountType === 'percentage') {
                    itemDiscount = itemTotalBeforeDiscount * Math.min(discountValue, 100) / 100;
                } else {
                    itemDiscount = Math.min(discountValue, itemTotalBeforeDiscount);
                }
                filteredDiscountTotal += Math.max(0, itemDiscount);
                
                // Set explicit total for payload
                item.itemTotal = itemTotalBeforeDiscount - Math.max(0, itemDiscount);
            });

            // Map keys as requested for storage
            const mappedProposalItems = data.proposalItems.map((item: any) => ({
                ...item,
                work_type_id: item.workTypeId,
                work_name: item.workTypeName,
                rate_card_item_id: item.rateCardItemId,
                rate_card_name: item.rateCardName,
                professional_fee: item.professionalFee,
                government_fee: item.governmentFee,
                total: item.itemTotal,
                manual_rate: item.manualRate
            }));

            const totalBeforeDiscount = filteredProfSubtotal + filteredGovtSubtotal + filteredGstTotal;
            const finalTotal = Math.max(totalBeforeDiscount - filteredDiscountTotal, 0);

            const payload: any = {
                queryId: data.selectedQueryId || query?.id,
                clientId: finalClientId,
                clientName: finalClientName,
                proposedWork: mappedProposalItems,
                description: data.queryDescription,
                phone: data.phone ? formatPhoneNumber(data.countryCode || '+91', data.phone) : "",
                email: data.email || "",
                countryCode: data.countryCode || '+91',
                tempClientId,
                profileId: data.profileId,
                contacts: normalizedContacts,
                noInvoice: data.noInvoice,
                createdBy: user?.uid,
                updatedBy: user?.uid,

                // Financials
                professionalFee: filteredProfSubtotal,
                governmentFee: filteredGovtSubtotal,
                gstAmount: filteredGstTotal,
                totalBeforeDiscount: totalBeforeDiscount,
                discountAmount: filteredDiscountTotal,
                totalAmount: finalTotal,
                
                // Snake case fields for safety
                total_before_discount: totalBeforeDiscount,
                discount_amount: filteredDiscountTotal,
                total_amount: finalTotal,

                // Stage Flow
                status: targetStage || (mode === 'create-pending' ? 'Pending Generation' : (editingProposal ? editingProposal.status : 'Draft')),
                currentStage: targetStage || (mode === 'create-pending' ? 'Pending Generation' : (editingProposal ? editingProposal.currentStage : 'Draft')),
                approvalStatus: editingProposal ? editingProposal.approvalStatus : 'Pending Approval'
            };

            // Fix: If we are "Generating" from a Pending record, it must become Draft
            const currentRecordStage = normalizeStage(editingProposal?.currentStage || editingProposal?.current_stage || editingProposal?.status || "Draft");
            if (currentRecordStage === 'pending' && !targetStage && mode === 'generate-from-pending') {
                payload.status = 'Draft';
                payload.currentStage = 'Draft';
                payload.approvalStatus = 'Pending Approval';
            }

            console.log("PAYLOAD BEFORE API", payload.proposedWork);

            const isTerminal = stage === 'closed';

            let res;
            if (mode === 'revise-client') {

                res = await apiFetch(`/api/proposals/${editingProposal.id}/revise`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...payload,
                        clientRequestedChanges: data.clientRequestedChanges,
                        revisedBy: user?.uid
                    })
                });
            } else if (editingProposal && isTerminal) {
                // Trigger workflow re-opening logic
                res = await apiFetch(`/api/proposals/${editingProposal.id}/workflow`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'add_work',
                        payload: { proposedWork: data.proposalItems },
                        performer: { id: user?.uid, name: user?.displayName || user?.email || 'System' }
                    })
                });
            } else {
                const url = editingProposal ? `/api/proposals/${editingProposal.id}` : '/api/proposals';
                const method = editingProposal ? 'PATCH' : 'POST';

                res = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to save proposal');
            }

            toast({
                title: mode === 'revise-client' ? "Proposal Revised" : ((editingProposal && isTerminal) ? "Proposal Version Incremented" : (editingProposal ? "Proposal Updated" : "Proposal Created")),
                description: mode === 'revise-client'
                    ? `Successfully created a new revision for ${finalClientName}. Version incremented.`
                    : ((editingProposal && isTerminal) 
                        ? `Successfully added more work to ${finalClientName}. Stage reset for approval.` 
                        : `Successfully saved proposal for ${finalClientName}`),
                className: "bg-green-600 text-white border-none shadow-xl"
            });

            const resJson = await res.json();
            const savedId = resJson?.data?.id || editingProposal?.id || undefined;

            onOpenChange(false);
            if (onSuccess) {
                onSuccess(savedId);
            }
        } catch (error: any) {
            toast({ title: "Operation Failed", description: error.message, variant: "destructive", className: "shadow-2xl" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const onFormError = (errors: any) => {
        
        const errorKeys = Object.keys(errors);
        if (errorKeys.length > 0) {
            const firstErrorField = errorKeys[0];
            const message = errors[firstErrorField]?.message || "Please check this field";
            toast({
                title: "Validation Error",
                description: `${firstErrorField}: ${message}`,
                variant: "destructive"
            });
        } else {
            toast({
                title: "Form Incomplete",
                description: "Some required information is missing or incorrectly formatted.",
                variant: "destructive"
            });
        }
    };

    const hasContacts = contacts.length > 0;
    const hasServices = proposalItems.length > 0;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
                <Form {...form}>
                    {/* ── Header ── */}
                    <DialogHeader className="px-8 py-5 border-b shrink-0 bg-gradient-to-r from-primary/5 via-background to-background">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 border border-primary/15 rounded-xl">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold uppercase tracking-tight">
                                        {isGenerateMode ? 'Review Proposal Draft' : (mode === 'revise-client' ? 'Revise Proposal' : (editingProposal ? 'Editing "Proposal"' : 'Adding New Proposal'))}
                                    </DialogTitle>
                                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                                        {isGenerateMode ? 'Review proposal details before generation.' : (mode === 'revise-client' ? 'Incorporate client feedback and revise.' : (editingProposal ? 'Update the details of this item.' : 'Enter the details for Proposal.'))}
                                    </DialogDescription>
                                </div>
                            </div>
                            <div className="min-w-[260px] flex flex-col gap-1 mr-10">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-blue-600 ml-1">Processing Branch</Label>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
                                        <Building2 className="h-4 w-4 text-black" />
                                    </div>
                                    <FormField control={form.control} name="profileId" render={({ field }) => (
                                        <FormItem className="flex-1 space-y-0">
                                            <Select onValueChange={field.onChange} value={field.value} disabled={flowType === 'pending' || isGenerateMode}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 bg-white border-slate-400 hover:bg-blue-50 rounded-xl font-bold text-sm shadow-sm transition-all [&>svg]:text-black [&>svg]:opacity-100 [&>svg]:stroke-[3]">
                                                        <SelectValue placeholder="Select Branch *" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl shadow-2xl border-none p-1 z-[100]">
                                                    {profiles.map(p => (
                                                        <SelectItem key={p.id} value={p.id} className="font-bold cursor-pointer rounded-lg py-2">{p.profileName}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* ── Body ── */}
                    <div className="flex-grow overflow-y-auto px-10 py-10 bg-slate-50/50">
                        <form id="proposal-form" onSubmit={form.handleSubmit((data) => handleCreateProposal(data))} className="space-y-10 max-w-4xl mx-auto pb-20">
                            <fieldset disabled={mode === 'view'} className="min-w-0 space-y-10">
                            {/* ══ SECTION 1 — Client Selection ══ */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-1.5 px-1">
                                    <span className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">1</span>
                                    <h4 className="text-[13px] font-bold text-black uppercase tracking-[0.3em]">Client Selection</h4>
                                </div>

                                {/* Flow Selector */}
                                {!isGenerateMode && (
                                    <FormField control={form.control} name="flowType" render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:bg-blue-50 transition-all duration-300 shadow-sm">
                                                    <RadioGroup
                                                        disabled={!!editingProposal}
                                                        onValueChange={(val: any) => {
                                                            field.onChange(val);
                                                        }}
                                                        value={field.value}
                                                        className="grid grid-cols-2 gap-3"
                                                    >
                                                        {[
                                                            { value: 'pending', label: 'From Pending Enquiry', desc: 'Convert an existing enquiry' },
                                                            { value: 'new', label: 'New Proposal', desc: 'Create from scratch' }
                                                        ].map(opt => (
                                                            <label key={opt.value} htmlFor={`flow-${opt.value}`} className={cn(
                                                                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group",
                                                                field.value === opt.value ? "border-primary bg-primary/5 shadow-md" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                                            )}>
                                                                <RadioGroupItem value={opt.value} id={`flow-${opt.value}`} className="shrink-0" />
                                                                <div>
                                                                    <p className={cn("font-bold text-sm", field.value === opt.value ? "text-primary" : "text-slate-700")}>{opt.label}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </RadioGroup>
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                )}

                                {/* Pending Query Picker */}
                                {flowType === 'pending' && !isGenerateMode && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                        <Label className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Select Pending Enquiry <span className="text-destructive">*</span></Label>
                                        <Popover open={queryPopoverOpen} onOpenChange={setQueryPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className={cn("w-full h-11 justify-between rounded-xl font-bold text-sm border-slate-200 bg-white hover:bg-blue-50 transition-all shadow-sm", !selectedQueryId && "text-muted-foreground opacity-50")}>
                                                    <span className="flex items-center gap-2 truncate">
                                                        <Users className="h-4 w-4 text-blue-600 shrink-0" />
                                                        {selectedQueryId ? allQueries.find((q: any) => q.id === selectedQueryId)?.companyName || allQueries.find((q: any) => q.id === selectedQueryId)?.contactPerson || 'Selected' : 'Search enquiries...'}
                                                    </span>
                                                    <ChevronsUpDown className="h-4 w-4 opacity-40 shrink-0" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-2xl border-none z-[100]" align="start">
                                                <Command>
                                                    <CommandInput 
                                                        placeholder="Search by client or contact..." 
                                                        className="h-11 font-medium" 
                                                        value={querySearch}
                                                        onValueChange={setQuerySearch}
                                                    />
                                                    <CommandList className="max-h-[280px]">
                                                        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No enquiries found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {allQueries
                                                                .filter((q: any) => {
                                                                    const searchStr = `${q.companyName || ''} ${q.contactPerson || ''} ${q.contactNumber || ''} ${q.emailId || ''}`.toLowerCase();
                                                                    return searchStr.includes(querySearch.toLowerCase());
                                                                })
                                                                .filter((q: any) => q.status !== 'Converted')
                                                                .map((q: any) => (
                                                                <CommandItem key={q.id} value={`${q.companyName} ${q.contactPerson}`} onSelect={() => handleQuerySelect(q)} className="rounded-xl py-3 px-3 cursor-pointer">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="font-bold text-sm uppercase">{q.companyName || q.contactPerson}</span>
                                                                        <span className="text-[10px] text-muted-foreground">{q.contactNumber} · {q.queryDetails?.slice(0, 50) || 'No details'}</span>
                                                                    </div>
                                                                    {selectedQueryId === q.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}

                                {/* New Proposal — Client Type */}
                                {flowType === 'new' && !isGenerateMode && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <FormField control={form.control} name="clientType" render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-3">
                                                        {[{ value: 'existing', label: 'Existing Client' }, { value: 'new', label: 'New / Prospective Client' }].map(opt => (
                                                            <label key={opt.value} htmlFor={`ct-${opt.value}`} className={cn(
                                                                "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                                                                field.value === opt.value ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"
                                                            )}>
                                                                <RadioGroupItem value={opt.value} id={`ct-${opt.value}`} />
                                                                <span className={cn("font-bold text-sm", field.value === opt.value ? "text-primary" : "text-slate-700")}>{opt.label}</span>
                                                            </label>
                                                        ))}
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )} />

                                        {clientType === 'existing' && (
                                            <div className="space-y-2">
                                                <Label className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Search Client <span className="text-destructive">*</span></Label>
                                                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" role="combobox" className="w-full h-11 justify-between rounded-xl font-bold text-sm border-slate-200 bg-white hover:bg-blue-50 transition-all shadow-sm">
                                                            <span className="flex items-center gap-2 truncate">
                                                                <Building className="h-4 w-4 text-blue-600 shrink-0" />
                                                                {existingClientId ? allClients.find((c: any) => c.id === existingClientId)?.clientName || 'Selected' : 'Search client directory...'}
                                                            </span>
                                                            <ChevronsUpDown className="h-4 w-4 opacity-40 shrink-0" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-2xl border-none z-[100]" align="start">
                                                        <Command shouldFilter={false}>
                                                            <CommandInput 
                                                                placeholder="Search registered clients..." 
                                                                className="h-11 font-medium" 
                                                                value={clientSearch}
                                                                onValueChange={setClientSearch}
                                                            />
                                                            <CommandList className="max-h-[280px] custom-scrollbar">
                                                                {isClientFetching && (
                                                                    <div className="flex items-center justify-center p-8 gap-3">
                                                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Syncing Directory...</span>
                                                                    </div>
                                                                )}
                                                                
                                                                {!isClientFetching && allClients.length === 0 && (
                                                                    <div className="p-10 text-center space-y-2">
                                                                        <Building className="h-10 w-10 mx-auto text-slate-200" />
                                                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">No clients found in directory</p>
                                                                    </div>
                                                                )}

                                                                <CommandGroup>
                                                                    {allClients.map((c: any) => (
                                                                        <CommandItem key={c.id} value={c.clientName} onSelect={() => handleClientSelect(c)} className="rounded-xl py-3 px-3 cursor-pointer">
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="font-bold text-sm uppercase">{c.clientName}</span>
                                                                                {c.phone && <span className="text-[10px] text-muted-foreground">{c.phone}</span>}
                                                                            </div>
                                                                            {existingClientId === c.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        )}

                                        {clientType === 'new' && !isGenerateMode && (
                                            <div className="space-y-4 p-5 rounded-2xl border-2 border-dashed border-muted-foreground/10 bg-muted/5">
                                                <div className="flex items-center gap-1.5 px-0.5">
                                                    <Building className="h-4 w-4 text-blue-600/60" />
                                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-600/80">Prospective Entity Registry</h5>
                                                </div>

                                                <FormField control={form.control} name="clientName" render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Client / Entity Name</FormLabel>
                                                        <FormControl>
                                                            <div className="relative group">
                                                                <Building className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                                                                <Input placeholder="e.g. Acme Corporation" className="pl-11 h-11 rounded-xl border-slate-400 bg-white hover:bg-blue-50 focus:border-primary focus:bg-white transition-all font-bold text-sm" {...field} value={field.value ?? ''} />
                                                            </div>
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Phone Number <span className="text-destructive">*</span></FormLabel>
                                                        <div className="flex items-center overflow-hidden">
                                                            <FormField control={form.control} name="countryCode" render={({ field }) => (
                                                                <CountryCodeSelect 
                                                                    value={field.value} 
                                                                    onChange={field.onChange}
                                                                />
                                                            )} />
                                                            <FormField control={form.control} name="phone" render={({ field }) => (
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="9876543210"
                                                                        maxLength={10}
                                                                        className="h-11 rounded-r-xl rounded-l-none border-slate-400 bg-white hover:bg-blue-50 focus:border-primary focus:bg-white transition-all font-bold text-sm tracking-widest tabular-nums flex-1"
                                                                        {...field}
                                                                        value={field.value ?? ''}
                                                                        onChange={e => {
                                                                            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                                            field.onChange(digitsOnly);
                                                                            if (digitsOnly.length === 10) {
                                                                                form.clearErrors("phone");
                                                                            }
                                                                         }}
                                                                    />
                                                                </FormControl>
                                                            )} />
                                                        </div>
                                                        <FormMessage className="text-[10px] font-bold uppercase" />
                                                    </div>
                                                    <FormField control={form.control} name="email" render={({ field }) => (
                                                        <FormItem className="space-y-1.5">
                                                            <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Email ID <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl>
                                                                <div className="relative group">
                                                                    <Mail className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                                                                    <Input placeholder="name@company.com" className="pl-11 h-11 rounded-xl border-slate-400 bg-white hover:bg-blue-50 focus:border-primary focus:bg-white transition-all font-bold text-sm" {...field} value={field.value ?? ''} />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage className="text-[10px] font-bold uppercase" />
                                                        </FormItem>
                                                    )} />
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                )}

                                {/* Client Profile Summary Card */}
                                {(selectedClient || isGenerateMode) && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-px flex-1 bg-muted-foreground/8" />
                                            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest px-2">
                                                {isGenerateMode ? 'Draft Review Summary' : 'Client Profile'}
                                            </span>
                                            <div className="h-px flex-1 bg-muted-foreground/8" />
                                        </div>
                                        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-3 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                                                        <Building2 className="h-4 w-4 text-white" />
                                                    </div>
                                                    <span className="text-sm font-bold text-white uppercase tracking-tight truncate max-w-md">
                                                        {isGenerateMode 
                                                            ? (editingProposal?.clientName || clientName || 'Draft Client') 
                                                            : (selectedClient?.client_name || selectedClient?.clientName || selectedClient?.company_name || selectedClient?.companyName || 'Client')
                                                        }
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isGenerateMode && (
                                                        <Badge className="text-[9px] font-black uppercase tracking-widest bg-rose-600 text-white border-none h-6 px-2.5">
                                                            Pending Generation
                                                        </Badge>
                                                    )}
                                                    {(selectedClient?.constitutionId || editingProposal?.constitutionId) && (
                                                        <Badge className="text-[10px] font-bold bg-white/10 text-white border-none">
                                                            {(() => { 
                                                                try { 
                                                                    const id = selectedClient?.constitutionId || editingProposal?.constitutionId;
                                                                    return constitutions?.find((c: any) => c.id === id)?.name || 'Registered'; 
                                                                } catch { return 'Registered'; } 
                                                            })()}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {isGenerateMode ? (
                                                <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/50">
                                                    <div className="flex flex-col p-4 space-y-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><UserCheck2 className="h-3 w-3" /> Contact</p>
                                                        <p className="text-xs font-bold text-slate-800 truncate">{editingProposal?.contacts?.[0]?.name || contacts[0]?.name || '—'}</p>
                                                    </div>
                                                    <div className="flex flex-col p-4 space-y-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phone</p>
                                                        <p className="text-xs font-bold text-slate-800 tabular-nums">{editingProposal?.phone || phone || '—'}</p>
                                                    </div>
                                                    <div className="flex flex-col p-4 space-y-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email</p>
                                                        <p className="text-xs font-bold text-slate-800 truncate lowercase">{editingProposal?.email || email || '—'}</p>
                                                    </div>
                                                    <div className="flex flex-col p-4 space-y-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Branch</p>
                                                        <p className="text-xs font-bold text-slate-800 truncate">{selectedProfile?.profileName || '—'}</p>
                                                    </div>
                                                    <div className="flex flex-col p-4 space-y-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><FileText className="h-3 w-3" /> ID</p>
                                                        <p className="text-xs font-black text-blue-600">
                                                            {editingProposal?.id ? `#${editingProposal.id.slice(0, 8)}` : '—'} 
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                                    <div className="flex flex-col items-center justify-center p-5 space-y-1 text-center group">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-blue-600 transition-colors"><Phone className="h-3 w-3" /> Phone</p>
                                                        <p className="text-sm font-bold text-slate-800 truncate w-full px-2">{selectedClient.phone || '—'}</p>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center p-5 space-y-1 text-center group">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-blue-600 transition-colors"><Mail className="h-3 w-3" /> Email</p>
                                                        <p className="text-sm font-bold text-slate-800 truncate lowercase w-full px-2">{selectedClient.email || '—'}</p>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center p-5 space-y-1 text-center group">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-blue-600 transition-all cursor-pointer"><MapPin className="h-3 w-3" /> Address</p>
                                                        <p className="text-xs font-bold text-slate-600 w-full px-2 leading-tight tabular-nums">
                                                            {(() => { 
                                                                const f = selectedClient.flatFields || {}; 
                                                                const parts = [
                                                                    f.building__house_no, 
                                                                    f.street__area, 
                                                                    f.city__town__village, 
                                                                    f.district, 
                                                                    f.state__province, 
                                                                    f.pincode
                                                                ].filter(Boolean);
                                                                return parts.length > 0 ? parts.join(', ') : (selectedClient.address || '—');
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ══ SECTION 2 — Stakeholder Contacts ══ */}
                            {isClientResolved && (
                                <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">2</span>
                                            <h4 className="text-[13px] font-bold text-black uppercase tracking-[0.3em]">Contact Persons</h4>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {flowType === 'new' && clientType === 'new' && (
                                                <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm hover:bg-blue-50 transition-all cursor-pointer">
                                                    <Checkbox
                                                        id="link-stakeholders"
                                                        checked={isLinkingExisting}
                                                        onCheckedChange={(checked) => setIsLinkingExisting(checked === true)}
                                                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 h-3.5 w-3.5"
                                                    />
                                                    <Label htmlFor="link-stakeholders" className="text-[9px] font-bold uppercase tracking-tight text-blue-600 cursor-pointer select-none">Link Registered</Label>
                                                </div>
                                            )}
                                            <Badge variant="outline" className="text-[11px] font-bold uppercase text-primary bg-primary/5 border-primary/20 h-6 px-3 rounded-full">
                                                {contacts.length} Added
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Add contact area */}
                                        <div className="p-5 rounded-2xl border-2 border-dashed border-muted-foreground/10 bg-muted/5 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-0.5 min-w-fit">
                                                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Add Contacts</h5>
                                                    <p className="text-[9px] font-medium text-muted-foreground/60 italic">Manage contacts for this proposal</p>
                                                </div>

                                                <div className="flex flex-1 items-center gap-3 justify-end">
                                                    {(form.watch('clientType') === 'existing' || isLinkingExisting) && (
                                                        <div className="flex items-center gap-2 flex-1 max-w-[500px] animate-in slide-in-from-right-2 duration-300">
                                                            {isLinkingExisting && !form.watch('existingClientId') && (
                                                                <div className="w-full">
                                                                    <Select value={linkingClientId} onValueChange={handleLinkClientChange}>
                                                                        <SelectTrigger className="h-11 w-full text-[11px] font-bold bg-white rounded-xl border-slate-400">
                                                                            <SelectValue placeholder="1. Select Client..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl p-1 z-[110]">
                                                                            {allClients.map((c: any) => (
                                                                                <SelectItem key={c.id} value={c.id} className="text-xs font-bold py-2 uppercase truncate">{c.clientName}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                            <div className="w-full">
                                                                <Select key={linkingContactSearchId} onValueChange={handleLinkContactSelect} disabled={(!form.watch('existingClientId') && !linkingClientId) || isFetchingLinkContacts}>
                                                                    <SelectTrigger className="h-11 w-full text-[11px] font-bold bg-white rounded-xl border-slate-400 shadow-sm hover:bg-blue-50 transition-all focus:ring-blue-500/20 disabled:opacity-50">
                                                                        {isFetchingLinkContacts ? (
                                                                            <div className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching...</div>
                                                                        ) : <SelectValue placeholder={isLinkingExisting && !form.watch('existingClientId') ? "2. Choose Contact..." : "Existing Contact..."} />}
                                                                    </SelectTrigger>
                                                                    <SelectContent className="border-none shadow-2xl rounded-2xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                                                        {linkingContacts.length > 0 ? (
                                                                            linkingContacts.map((c: any, idx: number) => (
                                                                                <SelectItem key={c.id || idx} value={c.id || `contact-${idx}`} textValue={c.name} className="text-xs font-bold py-2.5">
                                                                                    <div className="flex items-center justify-between w-full gap-8">
                                                                                        <span className="uppercase">{c.name}</span>
                                                                                        <span className="text-[10px] text-blue-600/60 font-black tabular-nums">{c.countryCode || '+91'} {c.phone}</span>
                                                                                    </div>
                                                                                </SelectItem>
                                                                            ))
                                                                        ) : (
                                                                            <div className="p-4 text-center">
                                                                                <p className="text-[10px] font-black uppercase text-muted-foreground/40 italic">No contacts registered</p>
                                                                            </div>
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <Button type="button" className="h-11 px-6 font-black uppercase bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-md border-none text-[10px] whitespace-nowrap" onClick={() => { handleAddContactStart(); }}>
                                                        <PlusCircle className="h-4 w-4 mr-2 stroke-[3]" /> Add New
                                                    </Button>
                                                </div>
                                            </div>



                                            {isAddContactOpen && draftContact && (
                                                <div id="contact-form" className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-muted-foreground/10 animate-in slide-in-from-top-3 fade-in duration-300">
                                                    {[
                                                        { key: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Rahul Sharma' },
                                                        { key: 'phone', label: 'Phone Number', required: true, placeholder: 'e.g. 9876543210' },
                                                        { key: 'email', label: 'Email Address', placeholder: 'name@company.com' },
                                                        { key: 'description', label: 'Role / Position', placeholder: 'e.g. Director' },
                                                        { key: 'remarks', label: 'Remarks', placeholder: 'Optional note...' },
                                                    ].map(f => (
                                                        <div key={f.key} className={cn("space-y-1.5", f.key === 'remarks' && "md:col-span-2")}>
                                                            <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
                                                            
                                                            {f.key === 'phone' ? (
                                                                <div className="flex items-center overflow-hidden">
                                                                    <CountryCodeSelect 
                                                                        value={draftContact.countryCode || '+91'} 
                                                                        onChange={(val) => setDraftContact(prev => prev ? ({ ...prev, countryCode: val }) : null)} 
                                                                    />
                                                                    <Input
                                                                        className="h-11 rounded-r-xl rounded-l-none border-slate-400 bg-white hover:bg-blue-50 focus:border-primary transition-all font-bold text-sm tracking-widest tabular-nums"
                                                                        placeholder={f.placeholder}
                                                                        value={(draftContact as any)[f.key] || ''}
                                                                        maxLength={10}
                                                                         onChange={e => {
                                                                            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                                            setDraftContact(prev => prev ? ({ ...prev, [f.key]: digitsOnly }) : null);
                                                                            if (digitsOnly.length === 10) {
                                                                                if (contactErrors[f.key]) setContactErrors(p => { const n = { ...p }; delete n[f.key]; return n; });
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <Input
                                                                    placeholder={f.placeholder}
                                                                    className={cn("h-11 rounded-xl bg-white border-slate-400 hover:bg-blue-50 transition-all font-medium text-sm", contactErrors[f.key] && "border-destructive")}
                                                                    value={(draftContact as any)[f.key] || ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setDraftContact(prev => prev ? ({ ...prev, [f.key]: val }) : null);
                                                                        if (contactErrors[f.key]) setContactErrors(p => { const n = { ...p }; delete n[f.key]; return n; });
                                                                    }}
                                                                />
                                                            )}
                                                            {contactErrors[f.key] && <p className="text-[11px] text-destructive font-bold">{contactErrors[f.key]}</p>}
                                                        </div>
                                                    ))}
                                                    <div className="md:col-span-2 flex items-center justify-end gap-3 pt-4">
                                                        <Button type="button" variant="ghost" onClick={handleCloseContactForm} className="h-11 px-8 rounded-xl font-bold uppercase text-[10px] text-slate-500 hover:bg-slate-100">
                                                            Cancel
                                                        </Button>
                                                        <Button type="button" onClick={handleConfirmContact} className="h-11 px-10 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest hover:bg-primary/90 shadow-lg shadow-primary/20">
                                                            <Check className="h-4 w-4 mr-2 stroke-[3]" /> Save Contact
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Contact list */}
                                        <div className="grid grid-cols-1 gap-4">
                                            {contacts.length === 0 ? (
                                                <div className="py-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center border-muted-foreground/10 opacity-40">
                                                    <Users className="h-8 w-8 mb-3 text-muted-foreground" />
                                                    <p className="text-xs font-bold uppercase tracking-widest">No Contacts Added</p>
                                                    <p className="text-[10px] font-medium max-w-[200px] mt-1">Add at least one contact to continue.</p>
                                                </div>
                                            ) : contactFields.map((contact: any, idx: number) => (
                                                <ContactCard
                                                    key={contact.id}
                                                    contact={contact}
                                                    idx={idx}
                                                    form={form}
                                                    onEdit={(id, data) => handleEditContact(id, data, idx)}
                                                    onRemove={removeContact}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ══ SECTION 3 — Services ══ */}
                            <ProposalServicesPricingSection 
                                form={form}
                                fieldName="proposalItems"
                                workFields={workFields}
                                appendWork={appendWork}
                                removeWork={removeWork}
                                masterWorkTypes={masterWorkTypes}
                                departments={departments}
                                isClientResolved={hasContacts}
                                isDraftReview={isGenerateMode}
                                noInvoice={!!noInvoice}
                                showDiscount={false} // Disable global discount UI
                                clientId={form.watch('existingClientId')}
                                associateId={form.watch('associateId')}
                                profileId={form.watch('profileId')}
                                clientType={form.watch('clientType') || (form.watch('reference') === 'Associate' ? 'associate' : 'direct')}
                                hasGST={hasGST}
                            />


                            {/* ══ SECTION 3.5 — Revision Feedback (Only in Revise Mode) ══ */}
                            {mode === 'revise-client' && (
                                <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                                    <div className="flex items-center gap-1.5 px-1">
                                        <span className="h-5 w-5 rounded-md bg-rose-100 flex items-center justify-center text-[9px] font-black text-rose-600">!</span>
                                        <h4 className="text-[13px] font-bold text-rose-600 uppercase tracking-[0.3em]">Client Requested Changes</h4>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-rose-50/30 border border-rose-200 shadow-sm space-y-4">
                                        <FormField control={form.control} name="clientRequestedChanges" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-rose-600 pl-1">Document Feedback <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <textarea
                                                        className="w-full h-32 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 focus:border-rose-400 focus:bg-white transition-all font-medium text-sm p-4 resize-none outline-none focus:ring-2 focus:ring-rose-500/20"
                                                        placeholder="Specifically, what did the client ask to change? (e.g., 'Lower professional fee by 10%', 'Add more categories', etc.)"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[10px] italic text-rose-400">This feedback will be stored in the proposal history.</FormDescription>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>
                            )}

                            {/* ══ SECTION 4 — Proposal Details ══ */}
                            {hasServices && (
                                <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                                    <div className="flex items-center gap-1.5 px-1">
                                        <span className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">4</span>
                                        <h4 className="text-[13px] font-bold text-black uppercase tracking-[0.3em]">Proposal Details</h4>
                                    </div>

                                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
                                        <FormField control={form.control} name="queryDescription" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Proposal Description / Notes</FormLabel>
                                                <FormControl>
                                                    <textarea
                                                        className="w-full h-24 rounded-xl border border-slate-400 bg-white hover:bg-blue-50 focus:border-primary focus:bg-white transition-all font-medium text-sm p-3 resize-none outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                                        placeholder="Describe the scope, background, and key objectives..."
                                                        {...(field as any)}
                                                        readOnly={isGenerateMode}
                                                        disabled={isGenerateMode}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )} />

                                    </div>
                                </div>
                            )}
                            </fieldset>
                        </form>
                    </div>

                    {/* ── Footer ── */}
                    <DialogFooter className="px-8 py-5 border-t bg-muted/10 gap-4 border-muted-foreground/5 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0">
                        <div className="flex-1 flex items-center gap-4">
                            {(proposalItems?.length ?? 0) > 0 && (
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                                        <span className="text-xl font-black text-primary tabular-nums">₹{(discountFinancials?.finalTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        {(financials?.totalGst ?? 0) > 0 && <span className="text-[10px] font-bold text-muted-foreground">(incl. ₹{(financials?.totalGst ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} GST)</span>}
                                    </div>
                                    {(discountFinancials?.discountAmount ?? 0) > 0 && (
                                        <span className="text-[9px] font-bold text-green-600 uppercase tracking-tighter">
                                            Discount Applied: -₹{(discountFinancials.discountAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11 px-8 rounded-xl font-bold text-sm hover:bg-muted/50 transition-all">
                            {mode === 'view' ? 'Close' : 'Cancel'}
                        </Button>
                        <div className="flex items-center gap-3">
                            {/* Save as Pending Button - Shown in Create New or Generate mode (to save without generating) */}
                            {mode !== 'view' && (isPendingMode || isGenerateMode) && (
                                <Button 
                                    type="button" 
                                    onClick={form.handleSubmit((data) => handleCreateProposal(data, 'Pending'), onFormError)} 
                                    disabled={isSubmitting || (!isGenerateMode && !isClientResolved)} 
                                    className="h-12 px-10 rounded-xl font-black uppercase tracking-widest text-[10px] bg-slate-900 text-white shadow-xl hover:bg-black hover:scale-[1.02] transition-all active:scale-95"
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span className="animate-pulse">Saving...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span>Save Draft</span>
                                        </div>
                                    )}
                                </Button>
                            )}

                            {/* Generate Proposal Button - Only in Generate mode */}
                            {mode !== 'view' && isGenerateMode && (
                                <Button 
                                    type="button" 
                                    onClick={form.handleSubmit((data) => handleCreateProposal(data, 'Draft'), onFormError)} 
                                    disabled={isSubmitting || !proposalValidation.isReady} 
                                    className={cn(
                                        "h-12 px-10 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-xl",
                                        (!proposalValidation.isReady && !isSubmitting) ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed" : "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02]"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span className="animate-pulse">Generating...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span>Generate Proposal</span>
                                        </div>
                                    )}
                                </Button>
                            )}

                            {/* Update Button - Only in Edit mode */}
                            {mode !== 'view' && isEditMode && (
                                <Button 
                                    type="button" 
                                    onClick={form.handleSubmit((data) => handleCreateProposal(data), onFormError)} 
                                    disabled={isSubmitting || !proposalValidation.isReady} 
                                    className={cn(
                                        "h-12 px-10 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-xl",
                                        (!proposalValidation.isReady && !isSubmitting) ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed" : "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02]"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span className="animate-pulse text-[10px]">Updating...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span>Update Proposal</span>
                                        </div>
                                    )}
                                </Button>
                            )}

                            {/* Submit Revision Button - Only in Revise mode */}
                            {mode !== 'view' && mode === 'revise-client' && (
                                <Button 
                                    type="button" 
                                    onClick={form.handleSubmit((data) => handleCreateProposal(data), onFormError)} 
                                    disabled={isSubmitting || !proposalValidation.isReady} 
                                    className={cn(
                                        "h-12 px-10 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-xl bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700 hover:scale-[1.02]",
                                        (!proposalValidation.isReady && !isSubmitting) && "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span className="animate-pulse text-[10px]">Submitting...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4" />
                                            <span>Revise Proposal</span>
                                        </div>
                                    )}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// ── Memoized Sub-components ──────────────────────────────────────────────────

interface ContactCardProps {
    contact: any;
    idx: number;
    onEdit: (id: string, contact: any, idx: number) => void;
    onRemove: (idx: number) => void;
    form: any;
}

const ContactCard = React.memo(({ contact, idx, onEdit, onRemove, form }: ContactCardProps) => {
    const currentName = form.watch(`contacts.${idx}.name`) || contact.name || '';
    const rawPhone = form.watch(`contacts.${idx}.phone`) || contact.phone || '';
    const rawCode = form.watch(`contacts.${idx}.countryCode`) || contact.countryCode || '+91';
    const currentEmail = form.watch(`contacts.${idx}.email`) || contact.email || '';
    
    const parsedPhone = parsePhoneNumber(rawPhone, rawCode);

    return (
        <div className="group relative rounded-3xl bg-white border-2 border-slate-100 hover:border-blue-200 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden">
            <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-5">
                        <div className="h-14 w-14 bg-slate-900 rounded-full flex items-center justify-center font-black text-white text-xl uppercase shadow-lg">
                            {currentName?.charAt(0) || '?'}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <p className="font-black text-slate-950 text-xl tracking-tighter uppercase leading-none">{currentName || 'Unnamed Contact'}</p>
                                {idx === 0 && <Badge className="bg-blue-600 text-white border-none text-[9px] font-black uppercase h-4">Primary</Badge>}
                            </div>
                            <div className="flex items-center gap-4 text-slate-500 text-[10px] font-bold tracking-tight">
                                <span className="flex items-center gap-1.5 text-slate-500/80">
                                    <Phone className="h-3.5 w-3.5" /> 
                                    {parsedPhone.countryCode} {parsedPhone.number || 'No number'}
                                </span>
                                {currentEmail && (
                                    <span className="flex items-center gap-1.5 text-slate-500/80">
                                        <Mail className="h-3.5 w-3.5" /> {currentEmail}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(contact.id, contact, idx)}
                            className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemove(idx)}
                            className="h-9 w-9 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all duration-300"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 leading-none">Internal Remarks</Label>
                    </div>
                    <Input
                        {...form.register(`contacts.${idx}.remarks`)}
                        placeholder="e.g. Needs GST registration (internal note)"
                        className="h-10 bg-slate-50 border-slate-200 rounded-xl px-4 text-xs font-medium focus:bg-white transition-all border-dashed hover:border-solid hover:border-blue-400"
                    />
                </div>
            </div>
        </div>
    );
});

ContactCard.displayName = 'ContactCard';

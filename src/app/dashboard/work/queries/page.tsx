'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/use-auth';
import { listenToDepartments, type Department, type WorkType } from '@/lib/department-management';
import { 
    PlusCircle, Search, Loader2, User, Building, Clock,
    Trash2, ChevronsUpDown, Check, Info, MessageSquare, Plus,
    Users, Edit, FileText,
    ChevronDown, CheckCircle2,
    Briefcase, Filter, Mail, MapPin, Phone, AlertCircle
} from 'lucide-react';
import { validateQueryForm, buildValidationToastMessage } from '@/lib/validation-utils';
import { cn, flattenFields } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useClients } from '@/hooks/use-clients';
import { useProfiles, useBusinessConstitutions } from '@/hooks/use-profiles';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHero } from '@/components/dashboard/page-hero';
import dynamic from 'next/dynamic';
const GenerateProposalDialog = dynamic(() => import('./_components/GenerateProposalDialog').then(mod => mod.GenerateProposalDialog), {
    loading: () => <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>,
    ssr: false
});
const EnquiryCard = dynamic(() => import('./_components/EnquiryCard').then(mod => mod.EnquiryCard), { ssr: false });
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { useQueries } from '@/hooks/use-queries';
import { useDebounce } from '@/hooks/use-debounce';
import { supabase } from '@/lib/supabase';

interface QueryWorkItem {
    workTypeId: string;
    workTypeName: string;
    departmentName: string;
    categoryName: string;
}



interface MasterWorkType {
    id: string;
    name: string;
    categoryName: string;
    departmentName: string;
    description?: string;
    warningNote?: string | null;
}

interface Contact {
    id: string;
    tempId?: string;
    name: string;
    phone: string;
    email?: string;
    description?: string;
    remarks?: string;
}

interface EnquiryContact {
    id: string;
    tempId?: string;
    name: string;
    phone: string;
    countryCode?: string;
    email?: string;
    description?: string;
    remarks?: string;
    enquiryReason?: string;
}

interface QueryEntry {
    id: string;
    clientType?: 'existing' | 'new';
    clientId?: string;
    profileId?: string;
    companyName: string;
    contactPerson: string;
    contactNumber: string;
    contactCountryCode?: string;
    emailId: string;
    enquiryContacts: EnquiryContact[];
    queryDetails: string;
    workItems: {
        workTypeId: string;
        workTypeName: string;
        departmentName: string;
        categoryName: string;
    }[];
    status: 'Open' | 'Working' | 'Resolved' | 'Closed' | 'Dropped' | 'Proposal Generated';
    createdAt: number;
    createdBy: string;
    createdByName: string;
}

import { PhoneInput } from '@/components/ui/phone-input';
import { getMemberDisplayName } from '@/lib/member-name-utils';
import { parsePhoneFromPayload, formatPhoneForPayload, sanitizePhoneInput, isValidLocalPhone, PHONE_ERROR_MESSAGE, parsePhoneNumber, phoneValidation } from '@/lib/phone-utils';

export default function QueriesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    // UI State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500); // Optimized: Debounce search
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('open');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const debouncedClientSearch = useDebounce(clientSearch, 500);

    // Form State
    const [clientType, setClientType] = useState<'existing' | 'new' | ''>('');
    const { data: clientsData, isLoading: isClientListLoading } = useClients({
        search: debouncedClientSearch,
        fields: 'id,client_name,constitution_id,fields,contacts',
        enabled: isAddOpen,
        limit: 20
    }); // Optimized: Fetch only needed fields
    const clients = Array.isArray(clientsData?.data) ? clientsData.data : [];
    const { profiles } = useProfiles();
    const { constitutions } = useBusinessConstitutions();

    // Main Data Hook (Optimized: Server-side pagination & filtering)
    const {
        data: queriesResponse,
        isLoading: loading,
        refetch: refreshQueries
    } = useQueries({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        status: activeTab === 'all' ? '' : activeTab === 'open' ? 'Open' : activeTab === 'working' ? 'Working' : 'Closed',
        fields: '*'
    });

    const queriesResponseSafe = (queriesResponse as any) || {
        success: false,
        data: [],
        pagination: { total: 0, totalPages: 1 },
        stats: { open: 0, working: 0, closed: 0 }
    };

    const queries = Array.isArray(queriesResponseSafe.data)
        ? queriesResponseSafe.data
        : [];

    const totalPages = queriesResponseSafe.pagination?.totalPages || 1;
    const totalItems = queriesResponseSafe.pagination?.total || 0;

    // Badge counts
    const openCount = queriesResponseSafe.stats?.open || 0;
    const workingCount = queriesResponseSafe.stats?.working || 0;
    const closedCount = queriesResponseSafe.stats?.closed || 0;

    // Validation Errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [formData, setFormData] = useState({
        clientId: '',
        profileId: '',
        companyName: '',
        companyPhone: '',
        companyEmail: '',
        contactId: '',
        contactPerson: '',
        contactNumber: '', // Combined string: +919876543210
        contactCountryCode: '+91',
        emailId: '',
        address: '',
        position: '',
        queryDetails: '',
        remarks: '',
        status: 'Open' as const,
        enquiryContacts: [] as EnquiryContact[]
    });

    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
    const [selectedContactId, setSelectedContactId] = useState<string>('');
    const [isClientFetching, setIsClientFetching] = useState(false);
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

    const [addedWorkItems, setAddedWorkItems] = useState<QueryWorkItem[]>([]);
    const [masterWorkTypes, setMasterWorkTypes] = useState<MasterWorkType[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [workTypePopoverOpen, setWorkTypePopoverOpen] = useState(false);
    const [workTypeSearch, setWorkTypeSearch] = useState('');

    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', phone: '', countryCode: '+91', email: '', description: '', remarks: '' });
    const [addContactErrors, setAddContactErrors] = useState<{ name?: string, phone?: string, email?: string }>({});
    const [isSavingContact, setIsSavingContact] = useState(false);
    const [addContactToClient, setAddContactToClient] = useState(false);

    // Inline edit state for selected contacts
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [editingContactData, setEditingContactData] = useState<{ name: string; phone: string; countryCode: string; email: string; description: string }>({ name: '', phone: '', countryCode: '+91', email: '', description: '' });

    // Link with Existing Client State (for New Client mode)
    const [isLinkingExisting, setIsLinkingExisting] = useState(false);
    const [linkingClientId, setLinkingClientId] = useState('');
    const [linkingContacts, setLinkingContacts] = useState<Contact[]>([]);
    const [isFetchingLinkContacts, setIsFetchingLinkContacts] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [queryToDelete, setQueryToDelete] = useState<any | null>(null);

    const [expandedCards, setExpandedCards] = useState<string | null>(null);
    const [visiblePhones, setVisiblePhones] = useState<Set<string>>(new Set());
    const [visibleEmails, setVisibleEmails] = useState<Set<string>>(new Set());
    const [isGenerateProposalOpen, setIsGenerateProposalOpen] = useState(false);
    const [selectedQueryForProposal, setSelectedQueryForProposal] = useState<any | null>(null);

    const [isDropConfirmOpen, setIsDropConfirmOpen] = useState(false);
    const [queryToDrop, setQueryToDrop] = useState<any | null>(null);

    const toggleExpand = useCallback((id: string) => {
        setExpandedCards(prev => prev === id ? null : id);
    }, []);

    const togglePhone = useCallback(async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const isCurrentlyVisible = visiblePhones.has(id);
        setVisiblePhones(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

        if (!isCurrentlyVisible) {
            try {
                await fetch(`/api/queries/${id}/access-log`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employeeId: user?.id,
                        employeeName: user?.displayName || user?.email,
                        accessType: 'phone'
                    })
                });
            } finally {
                // Done
            }
        }
    }, [user, visiblePhones]);

    const toggleEmail = useCallback(async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const isCurrentlyVisible = visibleEmails.has(id);
        setVisibleEmails(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

        if (!isCurrentlyVisible) {
            try {
                await fetch(`/api/queries/${id}/access-log`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employeeId: user?.id,
                        employeeName: user?.displayName || user?.email,
                        accessType: 'email'
                    })
                });
            } finally {
                // Done
            }
        }
    }, [user, visibleEmails]);

    useEffect(() => {
        if (isAddOpen && !isEditing && profiles.length > 0 && !formData.profileId) {
            const defaultProfile = profiles.find(p => p.isDefault) || (profiles.length === 1 ? profiles[0] : null);
            if (defaultProfile) {
                setFormData(prev => prev.profileId ? prev : { ...prev, profileId: defaultProfile.id });
                setErrors(e => { const updated = { ...e }; delete updated.profileId; return updated; });
            }
        }
    }, [profiles, isAddOpen, isEditing, formData.profileId]);

        const handleCloseAddEnquiry = () => {
        setIsAddOpen(false);
        resetForm();
    };

    const resetForm = () => {
        const defaultProfile = profiles.find(p => p.isDefault) || (profiles.length === 1 ? profiles[0] : null);
        setFormData({
            clientId: '',
            profileId: defaultProfile ? defaultProfile.id : '',
            companyName: '',
            companyPhone: '',
            companyEmail: '',
            contactId: '',
            contactPerson: '',
            contactNumber: '',
            contactCountryCode: '+91',
            emailId: '',
            address: '',
            position: '',
            queryDetails: '',
            remarks: '',
            status: 'Open',
            enquiryContacts: [] as EnquiryContact[]
        });
        setNewContact({ name: '', phone: '', countryCode: '+91', email: '', description: '', remarks: '' });
        setIsLinkingExisting(false);
        setLinkingClientId('');
        setLinkingContacts([]);
        setIsEditing(false);
        setEditingQueryId(null);
        setSelectedClient(null);
        setAvailableContacts([]);
        setSelectedContactId('');
        setAddedWorkItems([]);
        setClientType('');
        setErrors({});
        setAddContactErrors({});
        setAddContactToClient(false);
    };

    const queryValidation = validateQueryForm({ ...formData, workItems: addedWorkItems }, clientType);

    const validateField = (name: string, value: any) => {
        switch (name) {
            case 'contactNumber': {
                if (!value) return null;
                if (!isValidLocalPhone(value)) return "Phone number must be exactly 10 digits";
                break;
            }
            case 'emailId':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email format";
                break;
            case 'queryDetails':
                if (!value || value.trim().length < 10) return "Provide at least 10 characters for enquiry context";
                break;
            case 'enquiryContacts':
                if (!value || value.length === 0) {
                    return "At least one contact person is required";
                }
                break;
            case 'workItems':
                if (!value || value.length === 0) return "At least one service/work item is required";
                break;
            case 'contactPerson':
                if (!value || value.trim().length === 0) return "Contact person is required";
                break;
            case 'companyPhone': {
                if (!value) return null;
                if (!isValidLocalPhone(value)) return "Phone number must be exactly 10 digits";
                break;
            }
            case 'companyEmail':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email format";
                break;
            default:
                return null;
        }
        return null;
    };

    function getLatestEnquiryContacts() {
        let contacts = Array.isArray(formData.enquiryContacts) ? [...formData.enquiryContacts] : [];

        // Fix: Only add draft if it has a NAME and either phone or email
        const hasDraftContact =
            (newContact.name?.trim()) &&
            (newContact.phone?.trim() || newContact.email?.trim());

        const draftAlreadyAdded = contacts.some(c =>
            c.name?.trim() === newContact.name?.trim() &&
            (c.phone === newContact.phone || c.email === newContact.email)
        );

        if (clientType === 'new' && hasDraftContact && !draftAlreadyAdded) {
            contacts.push({
                id: `new-${Date.now()}`,
                name: newContact.name.trim(),
                phone: newContact.phone,
                countryCode: newContact.countryCode || '+91',
                email: newContact.email.trim(),
                description: newContact.description || '',
                remarks: newContact.remarks || '',
                enquiryReason: newContact.remarks || ''
            });
        }

        // Final Deduplication & Cleanup
        const uniqueContacts = contacts.filter((c, index) => {
            if (!c.name?.trim()) return false;
            if (!c.phone?.trim() && !c.email?.trim()) return false;
            
            return index === contacts.findIndex(other => 
                (other.name?.trim() === c.name?.trim()) && 
                (other.phone === c.phone || other.email === c.email)
            );
        });

        return uniqueContacts;
    }

    const validateFullForm = (contactsOverride?: any[]) => {
        const result = validateQueryForm({ ...formData, enquiryContacts: contactsOverride ?? formData.enquiryContacts, workItems: addedWorkItems }, clientType);
        
        const newErrors: Record<string, string> = {};
        if (!result.isValid) {
            // Map validation-utils errors back to form field keys if possible
            result.errors.forEach(err => {
                if (err.includes('Profile')) newErrors.profileId = err;
                else if (err.includes('Client Type')) newErrors.clientType = err;
                else if (err.includes('Client') && clientType === 'existing') newErrors.clientId = err;
                else if (err.includes('Details')) newErrors.queryDetails = err;
                else if (err.includes('Work Items')) newErrors.workItems = err;
                else if (err.includes('Phone or Email')) {
                    newErrors.contactNumber = err;
                    newErrors.emailId = err;
                    newErrors.newContactPhone = err;
                    newErrors.newContactEmail = err;
                }
                else if (err.includes('digits')) {
                    newErrors.contactNumber = err;
                    newErrors.newContactPhone = err;
                }
                else if (err.includes('Email format')) {
                    newErrors.emailId = err;
                    newErrors.newContactEmail = err;
                }
                else if (err.includes('First Contact Name')) {
                    newErrors.contactPerson = err;
                    newErrors.newContactName = err;
                }
            });
        }

        setErrors(newErrors);
        return result;
    };

    // --- Client Selection Logic ---
    const handleClientSelect = async (clientMinimal: any) => {
        setIsClientFetching(true);
        setClientPopoverOpen(false);
        setErrors(prev => {
            const next = { ...prev };
            delete next.clientId;
            delete next.clientType;
            return next;
        });
        try {
            const res = await fetch(`/api/clients/${clientMinimal.id}`);
            if (!res.ok) throw new Error('Failed to fetch client details');
            const result = await res.json();
            const client = result.data || result;

            // Flatten nested fields to ensure the UI can find phone/email/address regardless of section grouping
            const processedClient = {
                ...client,
                fields: flattenFields(client.fields)
            };

            setSelectedClient(processedClient);

            // Extract contacts
            const contacts: Contact[] = [];
            if (client.contacts && Array.isArray(client.contacts)) {
                client.contacts.forEach((c: any, idx: number) => {
                    contacts.push({
                        id: c.id || `c-${idx}`,
                        name: c.name || '',
                        phone: c.phone || '',
                        email: c.email || '',
                        description: c.description || 'Contact'
                    });
                });
            }

            setAvailableContacts(contacts);

            setFormData(prev => ({
                ...prev,
                clientId: client.id,
                companyName: client.client_name || client.clientName,
                contactId: '',
                contactPerson: '',
                contactNumber: '',
                emailId: '',
                address: client.address || processedClient.fields?.address || processedClient.fields?.['Registered Address'] || ''
            }));

            toast({ title: "Client Selected", description: `${client.client_name || client.clientName} loaded.` });
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to load client data.", variant: "destructive" });
        } finally {
            setIsClientFetching(false);
        }
    };

    const handleContactSelect = (contactId: string) => {
        const contact = availableContacts.find(c => c.id === contactId);
        if (!contact) return;
        // Prevent duplicate selection
        const alreadyAdded = formData.enquiryContacts.some(c => c.id === contactId);
        if (alreadyAdded) {
            toast({ title: "Already Added", description: `${contact.name} is already in this enquiry.`, variant: "destructive" });
            return;
        }
        const newEntry: EnquiryContact = { ...contact, enquiryReason: '' };
        setFormData(prev => {
            const updated = [...prev.enquiryContacts, newEntry];
            return {
                ...prev,
                enquiryContacts: updated,
                contactId: updated.length === 1 ? contact.id : prev.contactId,
                contactPerson: updated.length === 1 ? contact.name : prev.contactPerson,
                contactNumber: updated.length === 1 ? contact.phone : prev.contactNumber,
                emailId: updated.length === 1 ? (contact.email || '') : prev.emailId,
            };
        });
        setErrors(prev => {
            const next = { ...prev };
            delete next.enquiryContacts;
            delete next.contactPerson;
            delete next.contactNumber;
            delete next.emailId;
            return next;
        });
    };

    const startEditContact = (contact: EnquiryContact) => {
        setEditingContactId(contact.id);
        setEditingContactData({
            name: contact.name,
            phone: contact.phone,
            countryCode: contact.countryCode || '+91',
            email: contact.email || '',
            description: contact.description || ''
        });
    };

    const saveEditContact = (contactId: string) => {
        setFormData(prev => {
            const updated = prev.enquiryContacts.map(c =>
                c.id === contactId ? { ...c, ...editingContactData } : c
            );
            const isFirst = updated[0]?.id === contactId;
            return {
                ...prev,
                enquiryContacts: updated,
                ...(isFirst ? {
                    contactPerson: editingContactData.name,
                    contactNumber: editingContactData.phone,
                    emailId: editingContactData.email,
                } : {})
            };
        });
        setEditingContactId(null);
    };

    const handleAddContact = async () => {
        const nameErr = !newContact.name ? "Full Name is required" : "";
        const mobileErr = validateField('contactNumber', newContact.phone);
        const emailErr = validateField('emailId', newContact.email);

        if (nameErr || mobileErr || emailErr) {
            setAddContactErrors({
                name: nameErr || undefined,
                phone: mobileErr || undefined,
                email: emailErr || undefined
            });
            return;
        }

        setIsSavingContact(true);
        try {
            const c: EnquiryContact = {
                id: `new-${Date.now()}`,
                name: newContact.name,
                phone: newContact.phone,
                email: newContact.email,
                description: newContact.description,
                remarks: newContact.remarks,
                enquiryReason: ''
            };

            let updatedContacts = [...availableContacts, c];

            if (selectedClient && selectedClient.id) {
                const dbUpdated = [...(selectedClient.contacts || []), c];
                const patchBody: any = { contacts: dbUpdated };

                // If checkbox is ticked, also flag the client for re-validation
                if (addContactToClient) {
                    patchBody.change_status = 'Pending';
                }

                const res = await fetch(`/api/clients/${selectedClient.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patchBody)
                });

                if (res.ok) {
                    setSelectedClient((prev: any) => prev ? { ...prev, contacts: dbUpdated } : prev);
                    if (addContactToClient) {
                        toast({ title: "Contact Saved to Client", description: `${c.name} added to client record. Client marked for re-validation.` });
                    }
                }
            }

            setAvailableContacts(updatedContacts);

            // Sync with enquiry immediately
            const newEnquiryEntry: EnquiryContact = { ...c, enquiryReason: c.remarks || '' };
            setFormData(prev => {
                const updatedEnquiryContacts = [...prev.enquiryContacts, newEnquiryEntry];
                return {
                    ...prev,
                    enquiryContacts: updatedEnquiryContacts,
                    contactId: updatedEnquiryContacts.length === 1 ? c.id : prev.contactId,
                    contactPerson: updatedEnquiryContacts.length === 1 ? c.name : prev.contactPerson,
                    contactNumber: updatedEnquiryContacts.length === 1 ? c.phone : prev.contactNumber,
                    emailId: updatedEnquiryContacts.length === 1 ? (c.email || '') : prev.emailId,
                };
            });

            // Clear errors for contact section
            setErrors(prev => {
                const n = { ...prev };
                delete n.enquiryContacts;
                delete n.contactPerson;
                delete n.contactNumber;
                delete n.emailId;
                return n;
            });

            setIsAddContactOpen(false);
            setNewContact({ name: '', phone: '', countryCode: '+91', email: '', description: '', remarks: '' });
            setAddContactErrors({});
            setAddContactToClient(false);
            if (!addContactToClient) {
                toast({ title: "Contact Added", description: `Successfully added ${c.name} to the enquiry record.` });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingContact(false);
        }
    };

    const removeEnquiryContact = (id: string) => {
        setFormData(prev => {
            const updated = prev.enquiryContacts.filter(c => c.id !== id);
            return {
                ...prev,
                enquiryContacts: updated,
                contactPerson: updated[0]?.name || '',
                contactNumber: updated[0]?.phone || '',
                emailId: updated[0]?.email || ''
            };
        });
    };

    const updateContactReason = (id: string, reason: string) => {
        setFormData(prev => ({
            ...prev,
            enquiryContacts: prev.enquiryContacts.map(c => c.id === id ? { ...c, enquiryReason: reason } : c)
        }));
    };

    const handleLinkClientChange = async (id: string) => {
        setLinkingClientId(id);
        setLinkingContacts([]);
        if (!id) return;
        setIsFetchingLinkContacts(true);
        try {
            const res = await fetch(`/api/clients/${id}`);
            if (res.ok) {
                const clientData = await res.json();
                const mapped = (clientData.data?.contacts || []).map((c: any, idx: number) => ({
                    ...c,
                    tempId: c.tempId || c.id || crypto.randomUUID(),
                    name: c.name || getMemberDisplayName(c, c.description || 'Contact', idx)
                }));
                setLinkingContacts(mapped);
            }
        } catch (error) {
            
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsFetchingLinkContacts(false);
        }
    };

    const handleLinkContactSelect = (contactId: string) => {
        const contact = linkingContacts.find(c => c.id === contactId);
        if (contact) {
            setNewContact({
                name: contact.name,
                phone: contact.phone,
                countryCode: '+91',
                email: contact.email || '',
                description: contact.description || '',
                remarks: ''
            });
            // Keep the link state but user has populated the fields
            toast({ title: "Contact Linked", description: `Populated details for ${contact.name}.` });
        }
    };

    const handleAddQuery = async () => {
        const latestContacts = getLatestEnquiryContacts();
        const validation = validateFullForm(latestContacts);

        if (!validation.isValid) {
            toast({
                title: "Incomplete Form",
                description: buildValidationToastMessage(validation.errors) || "Please check the highlighted fields.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalContacts = latestContacts;
            const primaryContact = finalContacts[0];

            // Sync the state so if we are editing or the page doesn't refresh, state is correct
            setFormData(prev => ({
                ...prev,
                enquiryContacts: finalContacts,
                contactPerson: primaryContact?.name || "",
                contactNumber: primaryContact?.phone || "",
                emailId: primaryContact?.email || ""
            }));
            
            // Requirement 4: Payload must be built from enquiryContacts[0]
            const { countryCode: phoneCC, number: phoneNum } = parsePhoneNumber(primaryContact?.phone || "");

            const payload = {
                clientType,
                clientId: clientType === 'existing' ? formData.clientId : null,
                profileId: formData.profileId,
                companyName: formData.companyName,
                companyPhone: formData.companyPhone ? formatPhoneForPayload('+91', formData.companyPhone) : '',
                companyEmail: formData.companyEmail,
                contactPerson: primaryContact?.name || "",
                contactNumber: phoneNum,
                contactCountryCode: phoneCC || "+91",
                emailId: primaryContact?.email || "",
                position: primaryContact?.description || "",
                remarks: formData.remarks || primaryContact?.remarks || "",
                address: formData.address,
                queryDetails: formData.queryDetails,
                status: formData.status,
                workItems: addedWorkItems,
                enquiryContacts: finalContacts
            };

            const url = isEditing ? `/api/queries/${editingQueryId}` : '/api/queries';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to save enquiry');
            }

            await refreshQueries();
            toast({
                title: isEditing ? "Enquiry Updated" : "Enquiry Created",
                description: `Successfully saved enquiry for ${formData.companyName || formData.contactPerson}`,
                className: "bg-green-600 text-white border-none shadow-xl"
            });
            handleCloseAddEnquiry();
        } catch (error: any) {
            toast({ title: "Operation Failed", description: error.message, variant: "destructive", className: "shadow-2xl" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDropEnquiry = async () => {
        if (!queryToDrop) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/queries/${queryToDrop.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status: 'Dropped',
                    remarks: (queryToDrop.remarks || '') + " - Dropped"
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to drop enquiry');
            }

            await refreshQueries();
            toast({
                title: "Enquiry Dropped",
                description: `Successfully closed enquiry for ${queryToDrop.companyName || queryToDrop.contactPerson}`,
                className: "bg-amber-600 text-white border-none shadow-xl"
            });
            setIsDropConfirmOpen(false);
            setQueryToDrop(null);
        } catch (error: any) {
            toast({ title: "Drop Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditQuery = useCallback(async (query: any) => {
        setIsEditing(true);
        setEditingQueryId(query.id);
        setClientType(query.clientId ? 'existing' : 'new');

        // Robust hydration for Contacts (Handle legacy data where enquiry_contacts might be empty)
        let editContacts = Array.isArray(query.enquiryContacts) ? query.enquiryContacts : [];
        if (editContacts.length === 0 && (query.contactPerson || query.contactNumber)) {
            editContacts = [{
                id: `legacy-${Date.now()}`,
                name: query.contactPerson || 'Primary Contact',
                phone: query.contactNumber || '',
                countryCode: query.contactCountryCode || '+91',
                email: query.emailId || '',
                description: 'Imported from Main Record',
                enquiryReason: query.remarks || ''
            }];
        } else {
            editContacts = editContacts.map((c: any) => ({
                ...c,
                enquiryReason: c.enquiryReason || c.remarks || query.remarks || ''
            }));
        }

        setFormData({
            clientId: query.clientId || '',
            profileId: query.profileId || '',
            companyName: query.companyName || '',
            companyPhone: query.companyPhone || '',
            companyEmail: query.companyEmail || '',
            contactId: query.contactId || '',
            contactPerson: query.contactPerson || '',
            contactNumber: query.contactNumber || '',
            contactCountryCode: query.contactCountryCode || '+91',
            emailId: query.emailId || '',
            address: query.address || '',
            position: query.position || '',
            remarks: query.remarks || '',
            queryDetails: query.queryDetails || '',
            status: query.status || 'Open',
            enquiryContacts: editContacts
        });

        setAddedWorkItems(Array.isArray(query.workItems) ? query.workItems : []);

        // If existing client, hydrate client details and available contacts for the dropdowns
        if (query.clientId) {
            try {
                const res = await fetch(`/api/clients/${query.clientId}`);
                if (res.ok) {
                    const result = await res.json();
                    const client = result.data || result;

                    const processedClient = {
                        ...client,
                        fields: flattenFields(client.fields)
                    };
                    setSelectedClient(processedClient);

                    const clientContacts: Contact[] = [];
                    if (client.contacts && Array.isArray(client.contacts)) {
                        client.contacts.forEach((c: any, idx: number) => {
                            clientContacts.push({
                                id: c.id || `c-${idx}`,
                                name: c.name || '',
                                phone: c.phone || '',
                                email: c.email || '',
                                description: c.description || 'Contact'
                            });
                        });
                    }
                    setAvailableContacts(clientContacts);
                }
            } catch (err) {
            console.error("Failed to hydrate client details during edit:", err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
        }

        setIsAddOpen(true);
    }, [profiles]);

    const handleDeleteQuery = useCallback(async (queryId: string) => {
        try {
            const res = await fetch(`/api/queries/${queryId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            
            await refreshQueries();
            toast({ title: "Deleted", description: "Enquiry record removed." });
            setIsDeleteConfirmOpen(false);
        } catch (error) {
            toast({ title: "Error", description: "Could not delete record.", variant: "destructive" });
        }
    }, [toast, refreshQueries]);

    const handleRaiseProposal = useCallback((query: any) => {
        // Just open the modal with the query context
        setSelectedQueryForProposal(query);
        setIsGenerateProposalOpen(true);
    }, []);

    const handleProposalSuccess = async () => {
        // Refresh the list to show updated status/items
        await refreshQueries();
        setSelectedQueryForProposal(null);
        setIsGenerateProposalOpen(false);
    };

    useEffect(() => {
        const unsubscribeDepts = listenToDepartments((depts) => {
            const flatTypes: MasterWorkType[] = [];
            const deptNames = new Set<string>();
            if (Array.isArray(depts)) {
                depts.forEach((dept) => {
                    deptNames.add(dept.name);
                    (dept.workCategories || []).forEach((cat) => {
                        (cat.workTypes || []).forEach((wt) => {
                            flatTypes.push({
                                id: wt.id,
                                name: wt.name,
                                categoryName: cat.name,
                                departmentName: dept.name,
                                description: wt.description,
                                warningNote: wt.warningNote
                            });
                        });
                    });
                });
            }
            setMasterWorkTypes(flatTypes.sort((a, b) => a.name.localeCompare(b.name)));
            setDepartments(Array.from(deptNames).sort());
        });

        return () => unsubscribeDepts();
    }, []);

    // Local tabulation for counts (only if we have all data, but here we use the pagination count from server)
    // For simplicity, we keep the counts derived from whatever is in the current view or fetch them separately.
    // However, server-side count is preferred.
    const activeTabQueries = queries;

    const paginatedQueries = activeTabQueries;



    const parentRef = React.useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: paginatedQueries.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // Card height estimate
        overscan: 5,
    });

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-700">
            {/* ── Page Header Banner ── */}
            <div className="flex flex-col gap-4">
                <PageHero
                pattern="pattern-3"
                    icon={MessageSquare}
                    badge="ENQUIRY MANAGEMENT"
                    title="Enquiry Management"
                    description="Track and manage client enquiries and follow-ups from a single dashboard."
                >
                    <Button
                        onClick={() => { resetForm(); setIsAddOpen(true); }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md transition-all active:scale-95 group"
                    >
                        <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
                        Create New Enquiry
                    </Button>
                </PageHero>
                
                <div className="flex items-center gap-3 px-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                        <span className="h-1.5 w-1.5 bg-amber-600 rounded-full animate-pulse" />
                        {openCount} Open
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                        <span className="h-1.5 w-1.5 bg-blue-600 rounded-full animate-pulse" />
                        {workingCount} Active
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full" />
                        {closedCount} Closed
                    </span>
                </div>
            </div>

            <Dialog open={isAddOpen} onOpenChange={(v) => {
                setIsAddOpen(v);
                if (!v) resetForm();
            }}>
                <DialogContent className={cn(
                            "flex flex-col p-0 overflow-hidden shadow-2xl rounded-3xl border-none transition-all duration-500",
                            (!clientType && !isEditing) ? "max-w-4xl w-full h-auto" : "max-w-[95vw] w-full max-h-[95vh] h-[95vh]"
                        )}>
                            <DialogHeader className="px-8 py-5 border-b shrink-0 bg-gradient-to-r from-primary/5 via-background to-background">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-primary/10 border border-primary/15 rounded-xl">
                                            <MessageSquare className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-xl font-black uppercase tracking-tight">{isEditing ? 'Editing "Enquiry"' : 'Adding New Enquiry'}</DialogTitle>
                                            <DialogDescription className="text-xs font-medium mt-0.5">{isEditing ? 'Update the details of this item.' : 'Enter the details for Enquiry.'}</DialogDescription>
                                        </div>
                                    </div>
                                    {profiles.length > 1 && (
                                        <div className="relative min-w-[280px] flex flex-col gap-1 mr-[40px]">
                                            <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 ml-1">Profile / Branch</Label>
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
                                                    <Building className="h-4 w-4 text-black" />
                                                </div>
                                                <Select
                                                    value={formData.profileId || ''}
                                                    onValueChange={(val) => {
                                                        setFormData((prev) => ({ ...prev, profileId: val }));
                                                        if (errors.profileId) setErrors(e => { const updated = { ...e }; delete updated.profileId; return updated; });
                                                    }}
                                                >
                                                    <SelectTrigger className={cn("h-11 flex-1 bg-white border-slate-400 hover:bg-blue-50 rounded-xl font-bold text-sm shadow-sm transition-all [&>svg]:text-black [&>svg]:opacity-100 [&>svg]:stroke-[3]", errors.profileId && "border-destructive ring-1 ring-destructive")}>
                                                        <SelectValue placeholder="Select Branch *" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl shadow-2xl border-none p-1 z-[100] animate-in fade-in zoom-in-95 duration-200">
                                                        {profiles.map(p => (
                                                            <SelectItem key={p.id} value={p.id} textValue={p.profileName} className="font-bold cursor-pointer rounded-lg py-2">
                                                                {p.profileName}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {errors.profileId && <span className="absolute -bottom-5 right-0 text-[10px] font-black uppercase text-destructive tracking-widest">{errors.profileId}</span>}
                                        </div>
                                    )}
                                </div>
                            </DialogHeader>

                            <form id="query-form" onSubmit={handleAddQuery} className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-8 space-y-10 bg-background">
                                {/* ── Enquirer Profile Choice ── */}
                                {!isEditing && (
                                    <div className="space-y-4">
                                        <div className="p-5 rounded-2xl bg-white border border-slate-400 hover:bg-blue-50 transition-all duration-300 shadow-sm">
                                            <RadioGroup
                                                defaultValue=""
                                                value={clientType}
                                                onValueChange={(val: any) => {
                                                    setClientType(val);
                                                    setFormData({
                                                        clientId: '',
                                                        profileId: formData.profileId,
                                                        companyName: '',
                                                        companyPhone: '',
                                                        companyEmail: '',
                                                        contactId: '',
                                                        contactPerson: '',
                                                        contactNumber: '',
                                                        contactCountryCode: '+91',
                                                        emailId: '',
                                                        address: '',
                                                        position: '',
                                                        queryDetails: '',
                                                        remarks: '',
                                                        status: 'Open',
                                                        enquiryContacts: [] as EnquiryContact[]
                                                    });
                                                    setSelectedClient(null);
                                                    setAvailableContacts([]);
                                                }}
                                                className="grid grid-cols-2 gap-4 px-1"
                                            >
                                                <div className="flex items-center space-x-2.5">
                                                    <RadioGroupItem value="existing" id="client-existing" className="border-slate-400 data-[state=checked]:bg-black data-[state=checked]:border-black" />
                                                    <Label htmlFor="client-existing" className="cursor-pointer font-bold text-sm">Existing Client</Label>
                                                </div>
                                                <div className="flex items-center space-x-2.5">
                                                    <RadioGroupItem value="new" id="client-new" className="border-slate-400 data-[state=checked]:bg-black data-[state=checked]:border-black" />
                                                    <Label htmlFor="client-new" className="cursor-pointer font-bold text-sm">New Client</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                    </div>
                                )}

                                {/* ── 1. Client Information ── */}
                                {(clientType !== '' || isEditing) && (
                                    <>
                                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                                            <div className="flex items-center gap-2 px-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">1</span>
                                                    <h4 className="text-[13px] font-black text-black uppercase tracking-[0.3em]">Client Information</h4>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                                {clientType === 'existing' ? (
                                                    <div className="space-y-2 md:col-span-2">
                                                        <Label className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Select Client <span className="text-destructive">*</span></Label>
                                                        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" disabled={isClientFetching} className={cn("w-full justify-between h-12 rounded-xl text-sm font-bold border-slate-400 bg-white hover:bg-blue-50 transition-all", errors.clientId && "border-destructive focus:ring-destructive", !formData.companyName && "text-muted-foreground font-medium")}>

                                                                    <div className="flex items-center gap-2">
                                                                        {isClientFetching ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Building className="h-4 w-4 opacity-50" />}

                                                                        {formData.companyName ? formData.companyName : "Search database by name..."}
                                                                    </div>
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-2xl rounded-2xl overflow-hidden border-none" align="start">
                                                                <Command shouldFilter={false}>
                                                                    <CommandInput
                                                                        placeholder="Type client name..."
                                                                        className="h-12 border-none ring-0"
                                                                        value={clientSearch}
                                                                        onValueChange={setClientSearch}
                                                                    />
                                                                    <CommandList>
                                                                        {isClientListLoading ? (
                                                                            <div className="py-10 flex flex-col items-center justify-center gap-3">
                                                                                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Searching Database...</span>
                                                                            </div>
                                                                        ) : (
                                                                            <CommandEmpty>No registered client matches your search.</CommandEmpty>
                                                                        )}
                                                                        <CommandGroup title="Active Database" className="p-2">
                                                                            {clients.map((client: any) => {
                                                                                const flatFields = flattenFields(client.fields || {});
                                                                                const fullAddress = client.address || (Object.keys(flatFields).length > 0 ? [
                                                                                    flatFields.building__house_no || flatFields['Building / House No.'] || flatFields.building_no || flatFields.house_no,
                                                                                    flatFields.street__area || flatFields['Street / Area'] || flatFields.street || flatFields.area,
                                                                                    flatFields.city__town__village || flatFields['City / Town / Village'] || flatFields.city || flatFields.town,
                                                                                    flatFields.district || flatFields['District'],
                                                                                    flatFields.state__province || flatFields['State / Province'] || flatFields.state || flatFields.province,
                                                                                    flatFields.pincode || flatFields['Pincode'] || flatFields.pin_code || flatFields.pin
                                                                                ].filter(Boolean).join(", ") : "");

                                                                                return (
                                                                                    <CommandItem
                                                                                        key={client.id}
                                                                                        value={`${client.clientName} ${client.clientIdHash || ''} ${fullAddress || ''}`}
                                                                                        onSelect={() => handleClientSelect(client)}
                                                                                        className="rounded-lg py-2.5 px-3 mb-1 cursor-pointer aria-selected:bg-primary/5 flex items-start gap-3"
                                                                                    >
                                                                                        <div className="mt-0.5 shrink-0">
                                                                                            <Check className={cn("h-4 w-4 text-primary", formData.clientId === client.id ? "opacity-100" : "opacity-0")} />
                                                                                        </div>
                                                                                        <div className="flex flex-col flex-1 min-w-0">
                                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                                <span className="font-bold text-sm text-foreground">{client.clientName}</span>
                                                                                                {client.constitutionId && constitutions.find(c => c.id === client.constitutionId) && (
                                                                                                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest px-1.5 py-0 h-4 bg-muted/40 text-muted-foreground border-muted-foreground/20 whitespace-nowrap">
                                                                                                        {constitutions.find(c => c.id === client.constitutionId)?.name}
                                                                                                    </Badge>
                                                                                                )}
                                                                                            </div>
                                                                                            {fullAddress ? (
                                                                                                <span className="text-[11px] text-muted-foreground font-medium truncate mt-0.5" title={fullAddress}>
                                                                                                    {fullAddress}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-[10px] text-muted-foreground/50 italic mt-0.5">No address provided</span>
                                                                                            )}
                                                                                            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest mt-1">
                                                                                                {client.clientIdHash || client.id.slice(0, 8)}
                                                                                            </span>
                                                                                        </div>
                                                                                    </CommandItem>
                                                                                )
                                                                            })}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                        {errors.clientId && <p className="text-[9px] text-destructive font-black uppercase tracking-widest mt-1 ml-1">{errors.clientId}</p>}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4 md:col-span-2">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-2 md:col-span-2">
                                                                <Label htmlFor="companyName" className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Add New Client (Entity Name) <span className="text-muted-foreground/50 lowercase italic ml-1 text-[9px] font-medium">(Optional)</span></Label>
                                                                <div className="relative group">
                                                                    <Building className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                                                    <Input
                                                                        id="companyName"
                                                                        placeholder="e.g. Acme Corporation"
                                                                        className="pl-11 h-11 rounded-xl border-slate-400 bg-white hover:bg-blue-50 focus:border-primary focus:bg-white transition-all font-bold text-sm"
                                                                        value={formData.companyName || ''}
                                                                        onChange={e => setFormData(p => ({ ...p, companyName: e.target.value.slice(0, 100) }))}
                                                                        maxLength={100}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label htmlFor="companyPhone" className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Company Phone Number</Label>
                                                                <PhoneInput
                                                                    value={formData.companyPhone || ''}
                                                                    onChange={(val) => {
                                                                        const digits = sanitizePhoneInput(val);
                                                                        setFormData(p => ({ ...p, companyPhone: digits }));
                                                                        if (isValidLocalPhone(digits)) setErrors(e => { const n = { ...e }; delete n.companyPhone; return n; });
                                                                    }}
                                                                    className={cn(errors.companyPhone && "border-destructive")}
                                                                />
                                                                {errors.companyPhone && <p className="text-[9px] text-destructive font-black uppercase tracking-widest mt-1 ml-1">{errors.companyPhone}</p>}
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label htmlFor="companyEmail" className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Company Email</Label>
                                                                <div className="relative group">
                                                                    <Mail className={cn("absolute left-4 top-3.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary", errors.companyEmail && "text-destructive")} />
                                                                    <Input
                                                                        id="companyEmail"
                                                                        placeholder="e.g. contact@acme.com"
                                                                        className={cn("pl-11 h-11 rounded-xl border-slate-400 bg-white hover:bg-blue-50 focus:border-primary focus:bg-white transition-all font-bold text-sm", errors.companyEmail && "border-destructive focus:ring-destructive")}
                                                                        value={formData.companyEmail || ''}
                                                                        onChange={e => {
                                                                            setFormData(p => ({ ...p, companyEmail: e.target.value.slice(0, 100) }));
                                                                            if (errors.companyEmail) setErrors(e => { const n = { ...e }; delete n.companyEmail; return n; });
                                                                        }}
                                                                        maxLength={100}
                                                                    />
                                                                </div>
                                                                {errors.companyEmail && <p className="text-[9px] text-destructive font-black uppercase tracking-widest mt-1 ml-1">{errors.companyEmail}</p>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}



                                                {/* Comprehensive Client Overview */}
                                                {clientType === 'existing' && selectedClient && (
                                                    <div className="md:col-span-2 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                                        <div className="flex items-center gap-2 px-1">
                                                            <div className="h-px flex-1 bg-muted-foreground/8" />
                                                            <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest px-2">Client Profile Summary</span>
                                                            <div className="h-px flex-1 bg-muted-foreground/8" />
                                                        </div>

                                                        <div className="flex flex-col rounded-2xl bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80 transition-all shadow-sm overflow-hidden">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/60">
                                                                <div className="flex flex-col items-center justify-center p-5 space-y-2 text-center group">
                                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-1.5 group-hover:text-blue-600 transition-colors">
                                                                            <Phone className="h-3 w-3" /> Primary Phone
                                                                        </span>
                                                                        <p className="text-[13px] font-black text-slate-800 truncate w-full px-2" title={selectedClient.phone || selectedClient.fields?.phone || selectedClient.fields?.phone_number || selectedClient.fields?.phoneNumber || selectedClient.fields?.contact_no || selectedClient.fields?.mobile || 'N/A'}>
                                                                            {selectedClient.phone || selectedClient.fields?.phone || selectedClient.fields?.phone_number || selectedClient.fields?.phoneNumber || selectedClient.fields?.contact_no || selectedClient.fields?.mobile || 'N/A'}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col items-center justify-center p-5 space-y-2 text-center group">
                                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-1.5 group-hover:text-blue-600 transition-colors">
                                                                            <Mail className="h-3 w-3" /> Email Terminal
                                                                        </span>
                                                                        <p className="text-[13px] font-black text-slate-800 truncate lowercase tracking-tight w-full px-2" title={selectedClient.email || selectedClient.fields?.email || selectedClient.fields?.email_id || selectedClient.fields?.emailId || selectedClient.fields?.email_address || selectedClient.fields?.emailAddress || 'N/A'}>
                                                                            {selectedClient.email || selectedClient.fields?.email || selectedClient.fields?.email_id || selectedClient.fields?.emailId || selectedClient.fields?.email_address || selectedClient.fields?.emailAddress || 'N/A'}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col items-center justify-center p-5 space-y-2 text-center group">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5 group-hover:text-blue-600 transition-colors">
                                                                        <Briefcase className="h-3 w-3" /> Constitution Type
                                                                    </p>
                                                                    <p className="text-[13px] font-black text-slate-800 truncate w-full px-2">
                                                                        {(() => {
                                                                            const constId = selectedClient.constitution_id || selectedClient.constitutionId;
                                                                            const c = (constitutions || []).find(c => c.id === constId);
                                                                            return c ? `${c.businessType} - ${c.businessSubType}` : 'Not Specified';
                                                                        })()}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-center justify-center p-5 space-y-2 text-center border-t border-slate-200/60 bg-white group">
                                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5 group-hover:text-blue-600 transition-colors">
                                                                    <MapPin className="h-3 w-3" /> Registered Address
                                                                </p>
                                                                <p className="text-[13px] font-black text-slate-800 truncate w-full max-w-2xl px-2" title={
                                                                    selectedClient.address || (selectedClient.fields ? Object.entries(selectedClient.fields)
                                                                        .filter(([k, v]) => v && typeof v !== 'object' && !k.toLowerCase().includes('proof') && k !== 'designation' && !['full_name', 'email', 'phone', 'pan', 'id'].includes(k.toLowerCase()))
                                                                        .map(([_, v]) => String(v))
                                                                        .join(", ") : "")
                                                                }>
                                                                    {selectedClient.address || (selectedClient.fields ? [
                                                                        selectedClient.fields.building__house_no || selectedClient.fields['Building / House No.'] || selectedClient.fields.building_no || selectedClient.fields.house_no || selectedClient.fields.building,
                                                                        selectedClient.fields.street__area || selectedClient.fields['Street / Area'] || selectedClient.fields.street || selectedClient.fields.area || selectedClient.fields.location,
                                                                        selectedClient.fields.city__town__village || selectedClient.fields['City / Town / Village'] || selectedClient.fields.city || selectedClient.fields.town || selectedClient.fields.village,
                                                                        selectedClient.fields.district,
                                                                        selectedClient.fields.state__province || selectedClient.fields.state || selectedClient.fields.province || selectedClient.fields['State / Province'],
                                                                        selectedClient.fields.pincode || selectedClient.fields.pin_code || selectedClient.fields.pin || selectedClient.fields['Pincode']
                                                                    ].filter(Boolean).join(", ") : "N/A")}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── 2. Contact Information ── */}
                                        {(clientType === 'existing' && formData.clientId) || (clientType === 'new' && (formData.companyName.trim().length > 0 || formData.contactPerson.trim().length > 0)) ? (
                                            <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">2</span>
                                                        <h4 className="text-[13px] font-bold text-black uppercase tracking-[0.3em]">Contact Person</h4>
                                                    </div>
                                                    <Badge variant="outline" className="text-[11px] font-bold uppercase text-primary bg-primary/5 border-primary/20 h-5 px-2">
                                                        {formData.enquiryContacts.length} Contact{formData.enquiryContacts.length !== 1 ? 's' : ''} Added
                                                    </Badge>
                                                </div>

                                                <div className="space-y-4">
                                                    {/* Contact Selector / Adder */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {clientType === 'existing' && formData.clientId ? (
                                                            <div className="space-y-2 md:col-span-2">
                                                                <div className="flex items-center justify-between px-1">
                                                                    <Label className="font-bold text-[10px] uppercase tracking-widest text-blue-600">Select from Client Directory <span className="text-destructive">*</span></Label>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1 min-w-0">
                                                                        <Select onValueChange={handleContactSelect}>
                                                                            <SelectTrigger className="w-full h-11 rounded-xl bg-white text-blue-600 font-bold text-sm hover:bg-blue-50 transition-all border-2 border-blue-600 [&>svg]:text-blue-600 [&>svg]:opacity-100 [&>svg]:stroke-[3]">
                                                                                <div className="flex items-center gap-2 truncate">
                                                                                    <Users className="h-4 w-4 text-blue-600 shrink-0" />
                                                                                    <span className="text-blue-600 font-black text-sm">
                                                                                        {formData.enquiryContacts.length === 0 ? 'Add contacts to this enquiry...' : `${formData.enquiryContacts.length} contact${formData.enquiryContacts.length !== 1 ? 's' : ''} added — add more`}
                                                                                    </span>
                                                                                </div>
                                                                            </SelectTrigger>
                                                                            <SelectContent className="rounded-2xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                                                                {availableContacts.length > 0 ? (
                                                                                    availableContacts.map((contact: any, idx: number) => {
                                                                                        const isSelected = formData.enquiryContacts.some(c => c.id === contact.id);
                                                                                        return (
                                                                                            <SelectItem key={contact.tempId || contact.id || `contact-${idx}`} value={contact.id || contact.tempId || `contact-${idx}`} textValue={contact.name} className={cn("rounded-lg py-2.5 mb-1 cursor-pointer", isSelected && "opacity-50")}>
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all", isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                                                                                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                                                                                    </div>
                                                                                                    <div className="flex flex-col gap-0.5">
                                                                                                        <span className="font-bold text-sm">{contact.name || getMemberDisplayName(contact, contact.description || 'Contact')} — {contact.phone}</span>
                                                                                                        <span className="text-[10px] text-muted-foreground opacity-60">{contact.description || 'Registered Contact'}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </SelectItem>
                                                                                        );
                                                                                    })
                                                                                ) : (
                                                                                    <div className="p-4 text-center">
                                                                                        <p className="text-[10px] font-black uppercase text-muted-foreground/40">No contacts available</p>
                                                                                    </div>
                                                                                )}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        className="h-11 w-auto shrink-0 px-6 font-black uppercase bg-blue-600 text-white hover:bg-blue-700 transition-all rounded-xl shadow-md border-none"
                                                                        onClick={() => setIsAddContactOpen(true)}
                                                                    >
                                                                        <PlusCircle className="h-4 w-4 mr-2 stroke-[3]" />
                                                                        Add New Contact
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="md:col-span-2 p-5 rounded-2xl border-2 border-dashed border-muted-foreground/10 bg-muted/5 space-y-4">
                                                                <div className="flex flex-col gap-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="space-y-0.5">
                                                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Add Person for New Entity</h5>
                                                                            <p className="text-[9px] font-medium text-muted-foreground/60 italic">Contacts added here are linked only to this enquiry</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-400 shadow-sm hover:bg-blue-50 transition-all">
                                                                            <Checkbox
                                                                                id="link-existing"
                                                                                checked={isLinkingExisting}
                                                                                onCheckedChange={(checked) => setIsLinkingExisting(checked === true)}
                                                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                                            />
                                                                            <Label htmlFor="link-existing" className="text-[9px] font-black uppercase tracking-widest text-blue-600 cursor-pointer select-none">Link with existing clients</Label>
                                                                        </div>
                                                                    </div>

                                                                    {isLinkingExisting && (
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-2xl border border-blue-100/50 animate-in slide-in-from-top-3 fade-in duration-500 shadow-inner">
                                                                            <div className="space-y-1.5">
                                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-blue-600 ml-1">Step 1: Select Registered Client</Label>
                                                                                <Select value={linkingClientId} onValueChange={handleLinkClientChange}>
                                                                                    <SelectTrigger className="h-11 w-full text-xs font-bold bg-white rounded-xl border-slate-400 shadow-sm hover:bg-blue-50 transition-all focus:ring-blue-500/20">
                                                                                        <SelectValue placeholder="Search Client Directory..." />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent className="max-h-[300px] border-none shadow-2xl rounded-2xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                                                                        {clients.map((c: any) => (
                                                                                            <SelectItem key={c.id} value={c.id} textValue={c.clientName || 'Unnamed Client'} className="text-xs font-bold py-3 hover:bg-blue-50 focus:bg-blue-50">
                                                                                                <span className="uppercase tracking-tight text-foreground">{c.clientName || 'Unnamed Client'}</span>
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>

                                                                            <div className="space-y-1.5">
                                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-blue-600 ml-1">Step 2: Choose Contact Person</Label>
                                                                                <Select onValueChange={handleLinkContactSelect} disabled={!linkingClientId || isFetchingLinkContacts}>
                                                                                    <SelectTrigger className="h-11 w-full text-xs font-bold bg-white rounded-xl border-slate-400 shadow-sm hover:bg-blue-50 transition-all focus:ring-blue-500/20 disabled:opacity-50">
                                                                                        {isFetchingLinkContacts ? (
                                                                                            <div className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching directory...</div>
                                                                                        ) : <SelectValue placeholder="Select Contact to Link..." />}
                                                                                    </SelectTrigger>
                                                                                    <SelectContent className="border-none shadow-2xl rounded-2xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                                                                        {linkingContacts.length > 0 ? (
                                                                                            linkingContacts.map((c: any, idx: number) => (
                                                                                                <SelectItem key={c.tempId || c.id || `contact-${idx}`} value={c.id || c.tempId || `contact-${idx}`} textValue={c.name} className="text-xs font-bold py-2.5">
                                                                                                    <div className="flex items-center justify-between w-full gap-8">
                                                                                                        <span className="uppercase">{c.name}</span>
                                                                                                        <span className="text-[10px] text-blue-600/60 font-black tabular-nums">{c.phone}</span>
                                                                                                    </div>
                                                                                                </SelectItem>
                                                                                            ))
                                                                                        ) : (
                                                                                            <div className="p-4 text-center">
                                                                                                <p className="text-[10px] font-black uppercase text-muted-foreground/40 italic">No contacts registered for this entity</p>
                                                                                            </div>
                                                                                        )}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-1">
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1 pb-1 flex">Full Name <span className="text-destructive ml-1">*</span></Label>
                                                                        <Input
                                                                            placeholder="e.g. Rahul Sharma"
                                                                            className={cn("h-11 rounded-xl bg-white border-slate-400 hover:bg-blue-50 transition-all font-medium text-sm placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium", (errors.newContactName || (errors.contactPerson && formData.enquiryContacts.length === 0)) && "border-destructive")}
                                                                            value={newContact.name || ''}
                                                                            onChange={e => {
                                                                                setNewContact({ ...newContact, name: e.target.value });
                                                                                if (errors.newContactName) setErrors(prev => { const n = { ...prev }; delete n.newContactName; return n; });
                                                                                if (errors.contactPerson) setErrors(prev => { const n = { ...prev }; delete n.contactPerson; return n; });
                                                                            }}
                                                                        />
                                                                        {errors.newContactName && <p className="text-[11px] text-destructive font-bold">{errors.newContactName}</p>}
                                                                        {errors.contactPerson && formData.enquiryContacts.length === 0 && <p className="text-[11px] text-destructive font-bold">{errors.contactPerson}</p>}
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1 pb-1 flex">Phone Number</Label>
                                                                        <PhoneInput
                                                                            value={newContact.phone || ''}
                                                                            onChange={(val) => {
                                                                                const digits = sanitizePhoneInput(val);
                                                                                setNewContact({ ...newContact, phone: digits });
                                                                                if (isValidLocalPhone(digits)) {
                                                                                    const e = { ...errors }; delete e.newContactPhone; setErrors(e);
                                                                                }
                                                                            }}
                                                                            className={cn((errors.newContactPhone || (errors.contactNumber && formData.enquiryContacts.length === 0)) && "border-destructive")}
                                                                        />
                                                                        <p className="text-[9px] text-muted-foreground/60 mt-1 ml-1 italic font-medium">Enter at least one contact method: phone or email</p>
                                                                        {errors.newContactPhone && <p className="text-[11px] text-destructive font-bold">{errors.newContactPhone}</p>}
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1 pb-1 flex">Role / Position</Label>
                                                                        <Input
                                                                            placeholder="e.g. Director"
                                                                            className="h-11 rounded-xl bg-white border-slate-400 hover:bg-blue-50 transition-all font-medium text-sm placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                                                            value={newContact.description || ''}
                                                                            onChange={e => setNewContact({ ...newContact, description: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1 pb-1 flex">Remarks / Note</Label>
                                                                        <Input
                                                                            placeholder="(Needs GST registration, follow-up next week)"
                                                                            className="h-11 rounded-xl bg-white border-slate-400 hover:bg-blue-50 transition-all font-medium text-sm placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                                                            value={newContact.remarks || ''}
                                                                            onChange={e => setNewContact({ ...newContact, remarks: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1 pb-1 flex">Email Address</Label>
                                                                        <Input
                                                                            placeholder="name@company.com"
                                                                            className={cn("h-11 rounded-xl bg-white border-slate-400 hover:bg-blue-50 transition-all font-medium text-sm placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium", errors.newContactEmail && "border-destructive")}
                                                                            value={newContact.email || ''}
                                                                            onChange={e => {
                                                                                setNewContact({ ...newContact, email: e.target.value.slice(0, 100) });
                                                                                if (errors.newContactEmail) {
                                                                                    const e = { ...errors }; delete e.newContactEmail; setErrors(e);
                                                                                }
                                                                            }}
                                                                            maxLength={100}
                                                                        />
                                                                        {errors.newContactEmail && <p className="text-[11px] text-destructive font-bold">{errors.newContactEmail}</p>}
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1 pb-1 opacity-0 select-none">Save</Label>
                                                                        <Button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const nameErr = !newContact.name ? "Full Name is required" : "";
                                                                                const mobileErr = validateField('contactNumber', newContact.phone);
                                                                                const emailErr = validateField('emailId', newContact.email);

                                                                                if (nameErr || mobileErr || emailErr) {
                                                                                    setErrors(prev => ({
                                                                                        ...prev,
                                                                                        ...(nameErr ? { newContactName: nameErr } : {}),
                                                                                        ...(mobileErr ? { newContactPhone: mobileErr } : {}),
                                                                                        ...(emailErr ? { newContactEmail: emailErr } : {}),
                                                                                    }));
                                                                                    return;
                                                                                }

                                                                                const tempId = crypto.randomUUID();
                                                                                const id = `new-${Date.now()}`;
                                                                                const c: EnquiryContact = { ...newContact, id, tempId, enquiryReason: newContact.remarks || '' };
                                                                                const updated = [...formData.enquiryContacts, c];
                                                                                setFormData({
                                                                                    ...formData,
                                                                                    enquiryContacts: updated,
                                                                                    contactPerson: updated[0]?.name || '',
                                                                                    contactNumber: updated[0]?.phone || '',
                                                                                    emailId: updated[0]?.email || ''
                                                                                });
                                                                                setNewContact({ name: '', phone: '', countryCode: '+91', email: '', description: '', remarks: '' });
                                                                                setErrors({});
                                                                            }}
                                                                            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
                                                                        >
                                                                            Add Contact
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Selected Contacts List */}
                                                    <div className="space-y-3">
                                                        {formData.enquiryContacts.length === 0 ? (
                                                            <div className={cn("py-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center transition-all", errors.enquiryContacts ? "border-destructive bg-destructive/5" : "border-muted-foreground/10 opacity-40")}>
                                                                <Users className={cn("h-8 w-8 mb-3", errors.enquiryContacts ? "text-destructive" : "text-muted-foreground")} />
                                                                <p className={cn("text-xs font-black uppercase tracking-widest", errors.enquiryContacts ? "text-destructive" : "")}>
                                                                    {errors.enquiryContacts ? errors.enquiryContacts : "No Stakeholders Appointed"}
                                                                </p>
                                                                <p className="text-[10px] font-medium max-w-[200px] mt-1">Select at least one contact to proceed with the enquiry record.</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {formData.enquiryContacts.map((contact, idx) => (
                                                                    <div key={contact.tempId || contact.id || `contact-${idx}`} className="group relative rounded-2xl bg-white border border-slate-400 hover:bg-blue-50 hover:border-primary/40 transition-all animate-in slide-in-from-left-2 duration-300 overflow-hidden shadow-sm">
                                                                        {editingContactId === contact.id ? (
                                                                            /* ── Inline Edit Mode ── */
                                                                            <div className="p-4 space-y-3 bg-primary/3 border-l-2 border-primary">
                                                                                <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Editing Contact</p>
                                                                                <div className="grid grid-cols-2 gap-2">
                                                                                    <div className="space-y-1">
                                                                                        <Label className="text-[9px] font-black uppercase tracking-wider text-blue-600">Full Name</Label>
                                                                                        <Input
                                                                                            className="h-9 rounded-lg text-xs font-bold bg-white border-slate-400 hover:bg-blue-50 transition-all"
                                                                                            value={editingContactData.name || ''}
                                                                                            onChange={e => setEditingContactData(d => ({ ...d, name: e.target.value }))}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="space-y-1">
                                                                                        <Label className="text-[9px] font-black uppercase tracking-wider text-blue-600">Phone</Label>
                                                                                        <PhoneInput
                                                                                            value={editingContactData.phone || ''}
                                                                                            onChange={(val) => {
                                                                                            const digits = sanitizePhoneInput(val);
                                                                                            setEditingContactData(d => ({ ...d, phone: digits }));
                                                                                        }}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="space-y-1">
                                                                                        <Label className="text-[9px] font-black uppercase tracking-wider text-blue-600">Email</Label>
                                                                                        <Input
                                                                                            className="h-9 rounded-lg text-xs font-bold bg-white border-slate-400 hover:bg-blue-50 transition-all"
                                                                                            value={editingContactData.email || ''}
                                                                                            onChange={e => setEditingContactData(d => ({ ...d, email: e.target.value }))}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="space-y-1">
                                                                                        <Label className="text-[9px] font-black uppercase tracking-wider text-blue-600">Position / Role</Label>
                                                                                        <Input
                                                                                            className="h-9 rounded-lg text-xs font-bold bg-white border-slate-400 hover:bg-blue-50 transition-all"
                                                                                            value={editingContactData.description || ''}
                                                                                            onChange={e => setEditingContactData(d => ({ ...d, description: e.target.value }))}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 pt-1">
                                                                                    <Button type="button" size="sm" onClick={() => saveEditContact(contact.id)} className="h-8 text-[9px] font-black uppercase tracking-widest rounded-lg px-4">
                                                                                        <Check className="h-3 w-3 mr-1" /> Save
                                                                                    </Button>
                                                                                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingContactId(null)} className="h-8 text-[9px] font-black uppercase tracking-widest rounded-lg px-4">
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            /* ── View Mode ── */
                                                                            <div className="flex items-start justify-between gap-4 p-4">
                                                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                                    <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center text-white font-black shrink-0 text-sm shadow-md group-hover:scale-105 transition-transform duration-300">
                                                                                        {contact.name.charAt(0).toUpperCase()}
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                                            <span className="font-bold text-sm truncate uppercase tracking-tight">{contact.name}</span>
                                                                                            {contact.description && (
                                                                                                <span className="text-[10px] font-bold text-muted-foreground/40 italic hidden md:inline">{contact.description}</span>
                                                                                            )}
                                                                                            {idx === 0 && <Badge className="text-[11px] font-bold uppercase h-4 px-1.5 bg-primary/10 text-primary border-none shrink-0">Primary</Badge>}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3 mt-1 text-[10px] font-medium text-black">
                                                                                            <span className="flex items-center gap-1 transition-transform group-hover:translate-x-0.5 duration-300"><Phone className="h-2.5 w-2.5 text-black/40" />{contact.phone}</span>
                                                                                            {contact.email && <span className="flex items-center gap-1 transition-transform group-hover:translate-x-0.5 duration-300"><Mail className="h-2.5 w-2.5 text-black/40" />{contact.email}</span>}
                                                                                        </div>
                                                                                        <div className="mt-3 space-y-1.5">
                                                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 pl-1">Remarks / Note</Label>
                                                                                            <Input
                                                                                                placeholder="(Needs GST registration, follow-up next week)"
                                                                                                className="h-8 bg-white border-slate-400 hover:bg-blue-50 text-xs font-medium placeholder:text-muted-foreground/30 placeholder:italic rounded-lg focus:bg-white transition-all shadow-sm"
                                                                                                value={contact.enquiryReason || ''}
                                                                                                onChange={(e) => updateContactReason(contact.id, e.target.value)}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="outline"
                                                                                        size="icon"
                                                                                        onClick={() => removeEnquiryContact(contact.id)}
                                                                                        className="h-9 w-9 rounded-full bg-red-500 text-white hover:bg-red-600 border-0 transition-all shadow-sm active:scale-90"
                                                                                        title="Remove contact"
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* ── 3. Enquiry Details ── */}
                                        {((clientType === 'existing' && formData.clientId) || (clientType === 'new' && (formData.companyName.trim().length > 0 || formData.contactPerson.trim().length > 0))) && formData.enquiryContacts.length > 0 && (
                                            <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                                                <div className="flex items-center gap-1.5 px-1">
                                                    <span className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">3</span>
                                                    <h4 className="text-[13px] font-bold text-black uppercase tracking-[0.3em]">Enquiry Details</h4>
                                                </div>
                                                <div className="space-y-6">
                                                    <div className="space-y-4">
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 pl-1 flex items-center justify-between">
                                                            Scope of Services
                                                            <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border-none">
                                                                {addedWorkItems.length} SELECTION{addedWorkItems.length !== 1 ? 'S' : ''}
                                                            </Badge>
                                                        </h4>

                                                        <div className="flex flex-col md:flex-row gap-2">
                                                            <div className="w-full md:w-52 shrink-0">
                                                                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                                                    <SelectTrigger className="h-11 rounded-xl border-slate-400 bg-white font-bold text-sm truncate hover:bg-blue-50 transition-all hover:scale-[1.01] active:scale-[0.98] focus:ring-primary/20 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group">
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <Filter className="h-4 w-4 text-muted-foreground shrink-0 opacity-50 transition-colors group-hover:text-primary" />
                                                                            <SelectValue placeholder="All Clusters" />
                                                                        </div>
                                                                    </SelectTrigger>
                                                                    <SelectContent
                                                                        side="bottom"
                                                                        align="start"
                                                                        sideOffset={4}
                                                                        className="z-[110] w-[var(--radix-select-trigger-width)] min-w-[200px] rounded-2xl shadow-2xl border border-slate-200 p-1 bg-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
                                                                    >
                                                                        <SelectItem value="all" className="rounded-xl py-2.5 cursor-pointer transition-all duration-200 hover:translate-x-1">All Departments</SelectItem>
                                                                        {departments.map((dept) => (
                                                                            <SelectItem key={dept} value={dept} className="rounded-xl py-2.5 cursor-pointer font-medium transition-all duration-200 hover:translate-x-1">{dept}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="flex-1">
                                                                <Popover open={workTypePopoverOpen} onOpenChange={setWorkTypePopoverOpen}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="outline" className="w-full justify-between h-11 rounded-xl bg-white font-bold text-black border-2 border-slate-400 hover:bg-blue-50 hover:border-primary/50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.01] active:scale-[0.98] text-sm group">
                                                                            <div className="flex items-center gap-2">
                                                                                <PlusCircle className="h-4 w-4 text-black group-hover:text-primary transition-colors duration-300" />
                                                                                {selectedDepartment !== 'all' ? `Search in ${selectedDepartment}...` : "Search and add services..."}
                                                                            </div>
                                                                            <ChevronsUpDown className={cn("ml-2 h-4 w-4 shrink-0 text-black/50 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", workTypePopoverOpen && "rotate-180")} />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent
                                                                        className="z-[110] w-[var(--radix-popover-trigger-width)] p-0 shadow-2xl border border-slate-200 rounded-2xl overflow-hidden bg-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
                                                                        align="start"
                                                                        side="bottom"
                                                                        sideOffset={4}
                                                                        collisionPadding={20}
                                                                    >
                                                                        <Command className="bg-white">
                                                                            <CommandInput
                                                                                placeholder="Type service name or protocol keyword..."
                                                                                className="h-14 border-none ring-0 text-sm font-bold bg-white"
                                                                                value={workTypeSearch}
                                                                                onValueChange={setWorkTypeSearch}
                                                                            />
                                                                            <CommandList className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                                                                <CommandEmpty>No services found matching your criteria.</CommandEmpty>
                                                                                <CommandGroup className="p-2">
                                                                                    {masterWorkTypes
                                                                                        .filter(wt => selectedDepartment === 'all' || wt.departmentName === selectedDepartment)
                                                                                        .map((wt, idx) => (
                                                                                            <CommandItem
                                                                                                key={wt.id}
                                                                                                value={`${wt.name} ${wt.description || ''}`}
                                                                                                onSelect={() => {
                                                                                                    const exists = addedWorkItems.find(item => item.workTypeId === wt.id);
                                                                                                    if (!exists) {
                                                                                                        setAddedWorkItems([...addedWorkItems, {
                                                                                                            workTypeId: wt.id,
                                                                                                            workTypeName: wt.name,
                                                                                                            departmentName: wt.departmentName,
                                                                                                            categoryName: wt.categoryName
                                                                                                        }]);
                                                                                                    }
                                                                                                    setWorkTypePopoverOpen(false);
                                                                                                }}
                                                                                                className="rounded-xl py-3 px-5 aria-selected:bg-primary/10 cursor-pointer mb-1 border-b last:border-0 border-muted/10 transition-all duration-200 hover:translate-x-1"
                                                                                            >
                                                                                                <div className="flex items-start gap-4 w-full">
                                                                                                    <div className="mt-1 shrink-0">
                                                                                                        <Check className={cn("h-4 w-4 text-primary transition-opacity duration-300", addedWorkItems.some(item => item.workTypeId === wt.id) ? "opacity-100" : "opacity-0")} />
                                                                                                    </div>
                                                                                                    <div className="flex flex-col flex-1 min-w-0">
                                                                                                        <div className="flex items-start justify-between gap-3">
                                                                                                            <span className="font-black text-sm leading-tight uppercase tracking-tight group-hover:text-primary transition-colors duration-300">
                                                                                                                {workTypeSearch ? (
                                                                                                                    wt.name.split(new RegExp(`(${workTypeSearch})`, 'gi')).map((part: string, i: number) =>
                                                                                                                        part.toLowerCase() === workTypeSearch.toLowerCase()
                                                                                                                            ? <span key={i} className="text-blue-600 bg-blue-100/50 px-0.5 rounded-sm">{part}</span>
                                                                                                                            : part
                                                                                                                    )
                                                                                                                ) : wt.name}
                                                                                                            </span>
                                                                                                            <Badge variant="outline" className="text-[8px] font-black px-2 py-0.5 h-auto uppercase border-muted-foreground/10 shrink-0 group-hover:border-primary/20 group-hover:text-primary transition-all duration-300 tracking-widest">{wt.categoryName}</Badge>
                                                                                                        </div>
                                                                                                        {wt.description && (
                                                                                                            <span className="text-[11px] text-muted-foreground mt-2 italic leading-relaxed line-clamp-2 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                                                                                                                {workTypeSearch ? (
                                                                                                                    wt.description.split(new RegExp(`(${workTypeSearch})`, 'gi')).map((part: string, i: number) =>
                                                                                                                        part.toLowerCase() === workTypeSearch.toLowerCase()
                                                                                                                            ? <span key={i} className="text-blue-600 bg-blue-100/50 px-0.5 rounded-sm font-bold not-italic">{part}</span>
                                                                                                                            : part
                                                                                                                    )
                                                                                                                ) : wt.description}
                                                                                                            </span>
                                                                                                        )}
                                                                                                        {wt.warningNote && (
                                                                                                            <div className="flex items-start gap-1 mt-2 text-orange-600 bg-orange-50 px-2 py-1.5 rounded-md border border-orange-100">
                                                                                                                <AlertCircle className="w-3.5 h-3.5 mt-[1px] shrink-0" />
                                                                                                                <span className="text-[11px] font-medium leading-tight">
                                                                                                                    {wt.warningNote}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </CommandItem>
                                                                                        ))}
                                                                                </CommandGroup>
                                                                            </CommandList>
                                                                        </Command>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>
                                                        </div>

                                                        {addedWorkItems.length > 0 && (
                                                            <div className="border border-muted-foreground/10 rounded-2xl overflow-hidden shadow-sm bg-muted/10 max-h-[250px] overflow-y-auto animate-in zoom-in-95 duration-300">
                                                                <Table>
                                                                    <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                                                        <TableRow className="h-10 border-none">
                                                                            <TableHead className="text-[9px] font-black py-2 uppercase tracking-[0.2em] pl-6 text-blue-600">Service Protocol</TableHead>
                                                                            <TableHead className="text-[9px] font-black py-2 uppercase tracking-[0.2em] text-blue-600">Context / Cluster</TableHead>
                                                                            <TableHead className="w-10 pr-6"></TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {addedWorkItems.map((wi: any, idx: number) => (
                                                                            <TableRow key={wi.tempId || wi.id || wi.workTypeId || `wi-${idx}`} className="h-14 border-b last:border-0 bg-background/50 group/row transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white animate-in fade-in slide-in-from-bottom-2">
                                                                                <TableCell className="py-3 pl-6">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-xs font-black uppercase tracking-tight text-foreground group-hover/row:text-primary transition-colors">
                                                                                            {wi.workTypeName}
                                                                                        </span>
                                                                                        {masterWorkTypes.find(t => t.id === wi.workTypeId)?.warningNote && (
                                                                                            <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                                                                                                ⚠️ Note: {masterWorkTypes.find(t => t.id === wi.workTypeId)?.warningNote}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="py-3">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50">
                                                                                            {wi.categoryName}
                                                                                        </span>
                                                                                        <span className="text-[9px] font-bold text-blue-600/40 uppercase tracking-widest mt-0.5">
                                                                                            {wi.departmentName}
                                                                                        </span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="py-3 pr-6 text-right">
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="outline"
                                                                                        size="icon"
                                                                                        className="h-9 w-9 rounded-full bg-red-500 text-white border-0 hover:bg-red-600 transition-all shadow-sm active:scale-90"
                                                                                        onClick={() => setAddedWorkItems(addedWorkItems.filter((_, i) => i !== idx))}
                                                                                        title="Remove service"
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4 transition-transform" />
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="queryDetails" className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Requirement Notes & Background <span className="text-destructive">*</span></Label>
                                                        <div className="relative group">
                                                            <MessageSquare className={cn("absolute left-4 top-4 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary", errors.queryDetails && "text-destructive")} />
                                                            <textarea
                                                                id="queryDetails"
                                                                placeholder="(Describe the scope, background, and specific requirements...)"
                                                                className={cn("flex min-h-[120px] w-full rounded-2xl border border-slate-400 bg-white hover:bg-blue-50 px-11 py-3 text-sm font-medium ring-offset-background placeholder:text-muted-foreground/30 placeholder:italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all", errors.queryDetails && "border-destructive bg-destructive/5")}
                                                                value={formData.queryDetails || ''}
                                                                onChange={e => {
                                                                    setFormData({ ...formData, queryDetails: e.target.value });
                                                                    if (errors.queryDetails) setErrors(prev => { const n = { ...prev }; delete n.queryDetails; return n; });
                                                                }}
                                                            />
                                                        </div>
                                                        {errors.queryDetails && <p className="text-[11px] text-destructive font-bold animate-in fade-in slide-in-from-top-1">{errors.queryDetails}</p>}
                                                    </div>
                                                </div>

                                                {/* ── Status Management (Edit Mode only) ── */}
                                                {isEditing && (
                                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                        <div className="flex items-center gap-2 px-1">
                                                            <div className="h-1.5 w-1.5 bg-primary rounded-full" />
                                                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em]">Lifecycle Status</h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div className="space-y-2">
                                                                <Label className="font-bold text-[10px] uppercase tracking-widest text-blue-600 pl-1">Update Current Status</Label>
                                                                <Select
                                                                    value={formData.status}
                                                                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                                                                >
                                                                    <SelectTrigger className="h-11 rounded-xl border-slate-400 bg-white hover:bg-blue-50 focus:border-primary focus:bg-white transition-all font-bold text-sm">
                                                                        <SelectValue placeholder="Select status" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="border-none shadow-2xl rounded-2xl p-1 animate-in fade-in zoom-in-95 duration-200">
                                                                        <SelectItem value="Open">Open (New Lead)</SelectItem>
                                                                        <SelectItem value="Working">Working (Active Follow-up)</SelectItem>
                                                                        <SelectItem value="Closed">Closed (Resolved)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </form>

                            <DialogFooter className="px-8 py-6 border-t bg-muted/10 gap-4 border-muted-foreground/5 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0">
                                <Button type="button" variant="ghost" onClick={handleCloseAddEnquiry} className="h-12 px-8 rounded-xl font-bold text-sm hover:bg-muted/50 transition-all">
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleAddQuery}
                                    disabled={isSubmitting || !queryValidation.isReady}
                                    className={cn(
                                        "h-12 px-10 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95",
                                        (!queryValidation.isReady && !isSubmitting) ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed" : "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02]"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Processing...</span>
                                        </div>
                                    ) : (
                                        isEditing ? "Update Enquiry" : "Save Enquiry"
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                        <DialogContent className="w-[95vw] max-w-[420px] max-h-[90vh] flex flex-col rounded-3xl p-0 border-none shadow-2xl overflow-hidden">
                            <DialogHeader className="px-8 pt-8 pb-4 shrink-0">
                                <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">Adding New Contact</DialogTitle>
                                <DialogDescription className="text-xs font-medium text-muted-foreground">Enter the details for Contact.</DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto px-8 pb-2 space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Full Name <span className="text-destructive">*</span></Label>
                                    <Input
                                        className="h-11 rounded-xl bg-white border-slate-400 font-bold focus:bg-white focus:border-primary hover:bg-blue-50 transition-all"
                                        placeholder="e.g. Rahul Sharma"
                                        value={newContact.name || ''}
                                        onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Phone Number <span className="text-destructive">*</span></Label>
                                    <PhoneInput
                                        value={newContact.phone || ''}
                                        onChange={(val) => {
                                            setNewContact({ ...newContact, phone: val });
                                            if (addContactErrors.phone) setAddContactErrors({ ...addContactErrors, phone: undefined });
                                        }}
                                        className={cn(addContactErrors.phone && "border-destructive ring-1 ring-destructive rounded-xl")}
                                    />
                                    {addContactErrors.phone && <p className="text-[9px] text-destructive font-bold">{addContactErrors.phone}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Position</Label>
                                    <Input
                                        className="h-11 rounded-xl bg-white border-slate-400 font-bold focus:bg-white focus:border-primary hover:bg-blue-50 transition-all font-medium"
                                        placeholder="e.g. Managing Director / IT Head"
                                        value={newContact.description || ''}
                                        onChange={e => setNewContact({ ...newContact, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Email Address (Optional)</Label>
                                    <Input
                                        className={cn("h-11 rounded-xl bg-white font-bold focus:bg-white focus:border-primary hover:bg-blue-50 transition-all font-medium", addContactErrors.email ? "border-destructive text-destructive focus:border-destructive" : "border-slate-400")}
                                        placeholder="name@organization.com"
                                        value={newContact.email || ''}
                                        onChange={e => {
                                            setNewContact({ ...newContact, email: e.target.value });
                                            if (addContactErrors.email) setAddContactErrors({ ...addContactErrors, email: undefined });
                                        }}
                                    />
                                    {addContactErrors.email && <p className="text-[9px] text-destructive font-bold">{addContactErrors.email}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Remarks (Optional)</Label>
                                    <Input
                                        className="h-11 rounded-xl bg-white border-slate-400 font-bold focus:bg-white focus:border-primary hover:bg-blue-50 transition-all placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium text-sm"
                                        placeholder="(Needs GST registration, follow-up next week)"
                                        value={newContact.remarks || ''}
                                        onChange={e => setNewContact({ ...newContact, remarks: e.target.value })}
                                    />
                                </div>
                                {/* Add to Client checkbox - only shown when an existing client is selected */}
                                {selectedClient && selectedClient.id && (
                                    <div className={cn(
                                        "flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                        addContactToClient
                                            ? "bg-amber-50 border-amber-400"
                                            : "bg-white border-slate-200 hover:border-slate-400"
                                    )}
                                        onClick={() => setAddContactToClient(v => !v)}
                                    >
                                        <Checkbox
                                            id="add-to-client"
                                            checked={addContactToClient}
                                            onCheckedChange={(checked) => setAddContactToClient(checked === true)}
                                            className="mt-0.5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 shrink-0"
                                        />
                                        <div className="flex flex-col gap-0.5">
                                            <label htmlFor="add-to-client" className="text-[11px] font-black uppercase tracking-widest text-amber-700 cursor-pointer select-none">
                                                Add to Client Database
                                            </label>
                                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                                Also saves this contact to <span className="font-black text-foreground">{selectedClient?.clientName || selectedClient?.client_name}</span>'s profile and flags the client for re-validation.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="px-8 py-5 border-t border-muted/20 bg-muted/5 gap-3 shrink-0">
                                <Button variant="ghost" onClick={() => setIsAddContactOpen(false)} className="rounded-xl font-bold h-11 px-6 transition-all">Cancel</Button>
                                <Button onClick={handleAddContact} disabled={isSavingContact} className="rounded-xl font-black uppercase tracking-widest text-[10px] h-11 px-8 shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95">
                                    {isSavingContact ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                    Save Contact
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

            <Card className="bg-white border-muted/20 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-muted/20 p-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="px-6 pt-6 pb-2 flex flex-col sm:flex-row gap-4 justify-between items-center w-full">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-muted/30 border border-muted/20 flex items-center justify-center shrink-0">
                                    <Filter className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col">
                                    <CardTitle className="text-lg font-extrabold text-blue-900 tracking-tight flex items-center gap-3">
                                        Enquiry Pipeline
                                        <Badge className="font-semibold px-2 py-0 text-xs bg-muted/40 text-muted-foreground border-transparent" variant="secondary">{queries.length}</Badge>
                                    </CardTitle>
                                    <CardDescription className="text-sm mt-1">Manage leads through the conversion funnel</CardDescription>
                                </div>
                            </div>
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search entries..."
                                    className="pl-10 h-10 rounded-xl bg-muted/30 border-muted/20 hover:bg-white focus:bg-white focus:border-primary/40 transition-all ring-0 text-sm"
                                    value={search}
                                    onChange={e => {
                                        setSearch(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rows:</span>
                                <Select
                                    value={String(itemsPerPage)}
                                    onValueChange={(val) => {
                                        setItemsPerPage(Number(val));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[80px] h-9 text-[10px] font-bold border-muted/20 rounded-xl bg-muted/30">
                                        <SelectValue placeholder="Items" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-muted/20 shadow-xl">
                                        <SelectItem value="5" className="text-[10px] font-bold">5</SelectItem>
                                        <SelectItem value="10" className="text-[10px] font-bold">10</SelectItem>
                                        <SelectItem value="25" className="text-[10px] font-bold">25</SelectItem>
                                        <SelectItem value="50" className="text-[10px] font-bold">50</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <TabsList className="bg-transparent h-auto p-0 px-6 gap-8 justify-start border-b border-transparent">
                            <TabsTrigger
                                value="open"
                                className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent px-1 pb-4 pt-2 font-black uppercase text-[10px] tracking-widest transition-all hover:text-primary data-[state=active]:text-primary"
                            >
                                Lead Selection
                                <Badge className="ml-2 bg-amber-100 text-amber-700 border-none px-1.5 h-4 min-w-[18px] text-[9px]">{openCount}</Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="working"
                                className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent px-1 pb-4 pt-2 font-black uppercase text-[10px] tracking-widest transition-all hover:text-primary data-[state=active]:text-primary"
                            >
                                Proposal Pipeline
                                <Badge className="ml-2 bg-blue-100 text-blue-700 border-none px-1.5 h-4 min-w-[18px] text-[9px]">{workingCount}</Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="closed"
                                className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent px-1 pb-4 pt-2 font-black uppercase text-[10px] tracking-widest transition-all hover:text-primary data-[state=active]:text-primary"
                            >
                                Resolved
                                <Badge className="ml-2 bg-slate-100 text-slate-700 border-none px-1.5 h-4 min-w-[18px] text-[9px]">{closedCount}</Badge>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                            <p className="text-sm font-medium text-muted-foreground animate-pulse">Synchronizing with enquiry database...</p>
                        </div>
                    ) : queries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-center">
                            <div className="h-20 w-20 bg-muted/40 rounded-full flex items-center justify-center mb-6">
                                <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">No enquiries recorded</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-[320px] leading-relaxed">
                                {search ? `No results found for "${search}". Try a different keyword.` : "Your lead database is empty. Add your first enquiry to get started with client tracking."}
                            </p>
                            {search && (
                                <Button variant="secondary" onClick={() => setSearch('')} className="mt-6 font-semibold">View All Enquiries</Button>
                            )}
                        </div>
                    ) : (
                        <div
                            ref={parentRef}
                            className="flex flex-col gap-4 p-4 max-h-[1000px] overflow-y-auto relative"
                        >
                            <div
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                    const q = paginatedQueries[virtualItem.index];
                                    if (!q) return null;
                                    return (
                                        <div
                                            key={q.id || virtualItem.index}
                                            data-index={virtualItem.index}
                                            ref={rowVirtualizer.measureElement}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualItem.start}px)`,
                                                paddingBottom: '16px'
                                            }}
                                        >
                                            <EnquiryCard
                                                query={q}
                                                isExpanded={expandedCards === q.id}
                                                showPhone={visiblePhones.has(q.id)}
                                                showEmail={visibleEmails.has(q.id)}
                                                onToggleExpand={toggleExpand}
                                                onTogglePhone={togglePhone}
                                                onToggleEmail={toggleEmail}
                                                onEdit={handleEditQuery}
                                                onDelete={(queryToDel) => {
                                                    setQueryToDelete(queryToDel);
                                                    setIsDeleteConfirmOpen(true);
                                                }}
                                                onDrop={(q) => {
                                                    setQueryToDrop(q);
                                                    setIsDropConfirmOpen(true);
                                                }}
                                                onRaiseProposal={handleRaiseProposal}
                                                activeTab={activeTab}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 border-t border-muted/10 pt-4 px-2">
                                <PaginationControls
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8 max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                            Are you sure you want to remove the enquiry for <span className="font-black text-foreground underline underline-offset-4 decoration-destructive/30 uppercase tracking-tighter">{queryToDelete?.companyName}</span>? This record will be permanently purged from the database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold h-11 px-6 border-muted-foreground/10 hover:bg-muted/10 transition-all ring-0">No</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => queryToDelete && handleDeleteQuery(queryToDelete.id)}
                            className="rounded-xl font-black uppercase tracking-widest text-[10px] h-11 px-8 bg-yellow-500 text-white hover:bg-yellow-600 shadow-xl shadow-yellow-500/20 transition-all active:scale-95"
                        >
                            Delete Record
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Drop Confirmation */}
            <AlertDialog open={isDropConfirmOpen} onOpenChange={setIsDropConfirmOpen}>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8 max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Confirm Drop</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                            Are you sure you want to drop the enquiry for <span className="font-black text-foreground underline underline-offset-4 decoration-amber-300 uppercase tracking-tighter">{queryToDrop?.companyName || queryToDrop?.contactPerson}</span>? 
                            This will move it to the <span className="font-bold text-amber-600">Closed</span> list and remove it from active processing.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold h-11 px-6 border-muted-foreground/10 hover:bg-muted/10 transition-all ring-0">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDropEnquiry}
                            className="rounded-xl font-black uppercase tracking-widest text-[10px] h-11 px-8 bg-amber-600 text-white hover:bg-amber-700 shadow-xl shadow-amber-500/20 transition-all active:scale-95"
                        >
                            Drop Enquiry
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Inline Generate Proposal Modal */}
            <GenerateProposalDialog
                open={isGenerateProposalOpen}
                onOpenChange={setIsGenerateProposalOpen}
                query={selectedQueryForProposal}
                onSuccess={handleProposalSuccess}
            />
        </div>
    );
}

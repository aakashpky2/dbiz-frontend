'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertTriangle, Handshake, PlusCircle, Edit, Trash2, Search, Filter, X, ChevronRight, CheckCircle, Check, FileText, Inbox, ChevronsUpDown, Users, Sparkles, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm, type SubmitHandler, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { PhoneInput } from '@/components/ui/phone-input';
import { phoneValidation, PHONE_ERROR_MESSAGE } from '@/lib/phone-utils';
import { useAssociates, useAssociate } from '@/hooks/use-associates';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';

import { NAME_REGEX, PINCODE_REGEX, BillingRule, CommissionRule, Associate, billingRuleSchema, commissionRuleSchema, documentSchema, associateFormSchema, AssociateFormValues, BusinessProfile } from './constants';
import { PageHero } from '@/components/dashboard/page-hero';

// Main Component
export default function AssociatesPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canManageAssociates = hasPermission('MANAGE_ASSOCIATES');
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [profileFilter, setProfileFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const {
    data: associatesResponse,
    isLoading,
    error: associatesError,
    refetch: refreshAssociates
  } = useAssociates({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
  });

  const associates = associatesResponse?.data || [];
  const totalPages = associatesResponse?.pagination?.totalPages || 1;
  const totalItems = associatesResponse?.pagination?.total || 0;

  const [allProfiles, setAllProfiles] = useState<BusinessProfile[]>([]);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [isBillingCommissionDialogOpen, setIsBillingCommissionDialogOpen] = useState(false);
  const [selectedBillingAssociateId, setSelectedBillingAssociateId] = useState<string | null>(null);
  const [selectedContactPersonIndex, setSelectedContactPersonIndex] = useState<number>(0);
  const [billingAgreed, setBillingAgreed] = useState(false);
  const [activeAssociateTab, setActiveAssociateTab] = useState('personal');
  const [activeBillingTab, setActiveBillingTab] = useState('overview');
  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [associateToDeleteId, setAssociateToDeleteId] = useState<string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [confirmingDeselectIndex, setConfirmingDeselectIndex] = useState<number | null>(null);
  const [showDeselectConfirm, setShowDeselectConfirm] = useState(false);
  const [isBillingRuleDialogOpen, setIsBillingRuleDialogOpen] = useState(false);
  const [isCommissionRuleDialogOpen, setIsCommissionRuleDialogOpen] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);

  const currentBillingRule = useForm<BillingRule>({
    resolver: zodResolver(billingRuleSchema)
  });

  const currentCommissionRule = useForm<CommissionRule>({
    resolver: zodResolver(commissionRuleSchema)
  });


  const form = useForm<AssociateFormValues>({
    resolver: zodResolver(associateFormSchema),
    mode: "onBlur"
  });

  const { fields: commissionFields, append: appendCommission, remove: removeCommission, update: updateCommission } = useFieldArray({
    control: form.control,
    name: "commissionRules",
  });

  const { fields: billingFields, append: appendBilling, remove: removeBilling, update: updateBilling } = useFieldArray({
    control: form.control,
    name: "billingRules",
  });

  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({
    control: form.control,
    name: "contactPersons",
  });

  const { fields: documentFields, append: appendDocument, remove: removeDocument } = useFieldArray({
    control: form.control,
    name: "documents",
  });

  // Optimized: Sync logic moved to manual triggers in fields to avoid global re-renders
  const syncContactIfEnabled = useCallback(() => {
    const contacts = form.getValues('contactPersons');
    if (!contacts) return;
    
    contacts.forEach((cp, idx) => {
      if (cp.isSameAsAssociate) {
        form.setValue(`contactPersons.${idx}.name`, form.getValues('name') || '', { shouldValidate: true });
        form.setValue(`contactPersons.${idx}.phone`, form.getValues('phone') || '', { shouldValidate: true });
        form.setValue(`contactPersons.${idx}.email`, form.getValues('email') || '', { shouldValidate: true });
      }
    });
  }, [form]);


  const fetchAssociates = refreshAssociates;

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error: pError } = await supabase.from('business_profiles').select('id, profile_name, is_default').order('profile_name');
        if (pError) throw pError;
        setAllProfiles(data || []);
      } catch (err) {
            console.error("Error fetching profiles:", err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
    };
    fetchProfiles();
  }, []);

  const handleFormSubmit: SubmitHandler<AssociateFormValues> = async (data) => {
    setIsSubmitting(true);

    const processedBillingRules = (data.billingRules || []).map(rule => {
      if (rule.invoiceSource === 'Associate') {
        const { companyBillingType, ...rest } = rule;
        return rest;
      }
      return rule;
    });

    const { profiles, ...dataToSaveRaw } = data;
    const dataToSave = {
      company_name: dataToSaveRaw.companyName,
      name: dataToSaveRaw.name,
      phone: dataToSaveRaw.phone,
      email: dataToSaveRaw.email,
      status: dataToSaveRaw.status,
      parent_id: dataToSaveRaw.parentId || null,
      contact_person_name: dataToSaveRaw.contactPersonName,
      contact_person_phone: dataToSaveRaw.contactPersonPhone,
      contact_person_email: dataToSaveRaw.contactPersonEmail,
      contact_persons: dataToSaveRaw.contactPersons,
      gst_number: dataToSaveRaw.gstNumber,
      gst_effective_date: dataToSaveRaw.gstEffectiveDate || null,
      pan_number: dataToSaveRaw.panNumber,
      street_address: dataToSaveRaw.streetAddress,
      locality: dataToSaveRaw.locality,
      city: dataToSaveRaw.city,
      district: dataToSaveRaw.district,
      state: dataToSaveRaw.state,
      country: dataToSaveRaw.country || 'India',
      pincode: dataToSaveRaw.pincode,
      address: [
        dataToSaveRaw.streetAddress,
        dataToSaveRaw.locality,
        dataToSaveRaw.city,
        dataToSaveRaw.district,
        dataToSaveRaw.state,
        dataToSaveRaw.country || 'India',
        dataToSaveRaw.pincode
      ].filter(Boolean).join(', '),
      status_effective_date: dataToSaveRaw.statusEffectiveDate || null,
      billing_rules: processedBillingRules,
      commission_rules: dataToSaveRaw.commissionRules || [],
      documents: dataToSaveRaw.documents || [],
      updated_at: new Date().toISOString(),
    };

    try {
      let associateId = editingAssociate?.id;

      if (editingAssociate) {
        const { error: updateError } = await supabase.from('associates')
          .update(dataToSave)
          .eq('id', editingAssociate.id);
        if (updateError) throw updateError;
      } else {
        const { data: newAssoc, error: insertError } = await supabase.from('associates')
          .insert([{ ...dataToSave, created_at: new Date().toISOString() }])
          .select()
          .single();
        if (insertError) throw insertError;
        associateId = newAssoc.id;
      }

      // Handle profiles junction table
      if (associateId) {
        // Clear old associations
        await supabase.from('associate_profiles').delete().eq('associate_id', associateId);

        // Add new ones
        if (profiles && profiles.length > 0) {
          const profileLinks = profiles.map(pid => ({
            associate_id: associateId,
            profile_id: pid
          }));
          const { error: profileError } = await supabase.from('associate_profiles').insert(profileLinks);
          if (profileError) throw profileError;
        }
      }

      toast({
        title: editingAssociate ? "Associate Updated" : "Associate Added",
        description: `"${data.name}" has been successfully ${editingAssociate ? 'updated' : 'added'}.`
      });

      await fetchAssociates();
      setIsFormDialogOpen(false);
      setEditingAssociate(null);
      form.reset();
    } catch (err) {
      console.error("Error saving associate:", err);
      toast({ title: "Save Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBillingCommissionSave = async () => {
    if (!selectedBillingAssociateId) return;
    setIsSubmitting(true);

    const data = form.getValues();
    const processedBillingRules = (data.billingRules || []).map(rule => {
      if (rule.invoiceSource === 'Associate') {
        const { companyBillingType, ...rest } = rule;
        return rest;
      }
      return rule;
    });

    try {
      const { error: updateError } = await supabase.from('associates')
        .update({
          contact_persons: data.contactPersons,
          billing_rules: processedBillingRules,
          commission_rules: data.commissionRules || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBillingAssociateId);

      if (updateError) throw updateError;

      toast({
        title: "Configuration Saved",
        description: "Billing and commission rules updated successfully."
      });

      // Close modal on success
      await fetchAssociates();
      setIsBillingCommissionDialogOpen(false);
      setActiveBillingTab('overview');
    } catch (err) {
      console.error("Error saving configuration:", err);
      toast({ title: "Save Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddDialog = () => {
    setEditingAssociate(null);
    form.reset({
      companyName: '',
      name: '',
      phone: '',
      email: '',
      status: 'Active',
      billingRules: [],
      commissionRules: [],
      profiles: allProfiles.length > 0
        ? [allProfiles.find(p => p.is_default)?.id || allProfiles[0].id]
        : [],
      parentId: null,
      hasGST: false,
      hasPAN: false,
      hasAddress: false,
      hasDocuments: false,
      documents: [],
      contactPersonName: '',
      contactPersonPhone: '',
      contactPersonEmail: '',
      contactPersons: [{ name: '', phone: '', email: '', designation: '', contactReason: '', date: '', isSameAsAssociate: false }],
      gstNumber: '',
      gstEffectiveDate: '',
      panNumber: '',
      streetAddress: '',
      locality: '',
      city: '',
      district: '',
      state: '',
      country: 'India',
      pincode: '',
      address: '',
      statusEffectiveDate: '',
      hasParentAssociate: false,
    });
    setFormMode('create');
    setIsFormDialogOpen(true);
  };

  const openViewDialog = (associate: Associate) => {
    setEditingAssociate(associate);
    form.reset({
      ...associate,
      companyName: associate.companyName || '',
      phone: associate.phone || '',
      email: associate.email || '',
      contactPersonName: associate.contactPersonName || '',
      contactPersonPhone: associate.contactPersonPhone || '',
      contactPersonEmail: associate.contactPersonEmail || '',
      city: associate.city || '',
      district: associate.district || '',
      state: associate.state || '',
      country: associate.country || 'India',
      contactPersons: associate.contactPersons && associate.contactPersons.length > 0 ? associate.contactPersons.map(cp => ({
        name: cp.name || '',
        phone: cp.phone || '',
        email: cp.email || '',
        designation: cp.designation || '',
        contactReason: cp.contactReason || '',
        date: cp.date || '',
        isSameAsAssociate: cp.isSameAsAssociate || false
      })) : [{ name: '', phone: '', email: '', designation: '', contactReason: '', date: '', isSameAsAssociate: false }],
      pincode: associate.pincode || '',
      hasGST: !!associate.gstNumber,
      hasPAN: !!associate.panNumber,
      hasAddress: !!associate.streetAddress,
      hasDocuments: !!associate.documents && associate.documents.length > 0,
      documents: associate.documents || [],
      address: associate.address || '',
      statusEffectiveDate: associate.statusEffectiveDate || '',
      hasParentAssociate: !!associate.parentId,
    });
    setFormMode('view');
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (associate: Associate) => {
    setEditingAssociate(associate);
    form.reset({
      ...associate,
      companyName: associate.companyName || '',
      phone: associate.phone || '',
      email: associate.email || '',
      contactPersonName: associate.contactPersonName || '',
      contactPersonPhone: associate.contactPersonPhone || '',
      contactPersonEmail: associate.contactPersonEmail || '',
      city: associate.city || '',
      district: associate.district || '',
      state: associate.state || '',
      country: associate.country || 'India',
      contactPersons: associate.contactPersons && associate.contactPersons.length > 0 ? associate.contactPersons.map(cp => ({
        name: cp.name || '',
        phone: cp.phone || '',
        email: cp.email || '',
        designation: cp.designation || '',
        contactReason: cp.contactReason || '',
        date: cp.date || '',
        isSameAsAssociate: cp.isSameAsAssociate || false
      })) : [{ name: '', phone: '', email: '', designation: '', contactReason: '', date: '', isSameAsAssociate: false }],
      pincode: associate.pincode || '',
      hasGST: !!associate.gstNumber,
      hasPAN: !!associate.panNumber,
      hasAddress: !!associate.streetAddress,
      hasDocuments: !!associate.documents && associate.documents.length > 0,
      documents: associate.documents || [],
      address: associate.address || '',
      statusEffectiveDate: associate.statusEffectiveDate || '',
      hasParentAssociate: !!associate.parentId,
    });
    setFormMode('edit');
    setIsFormDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setAssociateToDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!associateToDeleteId) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase.from('associates').delete().eq('id', associateToDeleteId);
      if (deleteError) throw deleteError;
      await fetchAssociates();
      toast({ title: "Associate Deleted", description: "The associate has been successfully deleted." });
      setAssociateToDeleteId(null);
    } catch (err) {
      console.error("Error deleting associate:", err);
      toast({ title: "Delete Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmationText('');
    }
  };

  const filteredAssociates = associates.filter((assoc: any) => {
    const matchesProfile = profileFilter === 'all' || (assoc.profiles || []).includes(profileFilter);
    const matchesStatus = statusFilter === 'all' || assoc.status === statusFilter;
    return matchesProfile && matchesStatus;
  });

  return (
    <>
      <PageHero
                pattern="pattern-6"
          icon={Handshake}
          badge="ADMINISTRATION"
          title="Associates"
          description="Manage your sales associates, their billing, and commission rules."
      >
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {canManageAssociates && (
          <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-xl h-11 px-6 font-bold tracking-wide whitespace-nowrap transition-all active:scale-95">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Associate
          </Button>
          )}
          <Button onClick={() => { setIsBillingCommissionDialogOpen(true); setActiveBillingTab('overview'); }} variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl h-11 px-6 font-bold tracking-wide whitespace-nowrap transition-all active:scale-95 shadow-sm">
            <FileText className="mr-2 h-5 w-5" /> Billing & Commission
          </Button>
        </div>
      </PageHero>

      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <div className="relative w-full md:w-[320px]">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl shadow-sm focus-visible:ring-blue-600/20 transition-all"
              />
            </div>
            
            <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
              <div className="w-full sm:w-48">
                <Select value={profileFilter} onValueChange={setProfileFilter}>
                  <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl shadow-sm text-sm font-medium focus:ring-blue-600/20">
                    <SelectValue placeholder="All Profiles" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="rounded-lg">All Business Profiles</SelectItem>
                    {allProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id} className="rounded-lg">{p.profile_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl shadow-sm text-sm font-medium focus:ring-blue-600/20">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="rounded-lg">All Status</SelectItem>
                    <SelectItem value="Active" className="rounded-lg">Active</SelectItem>
                    <SelectItem value="Inactive" className="rounded-lg">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(profileFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '') && (
                <Button variant="ghost" onClick={() => { setProfileFilter('all'); setStatusFilter('all'); setSearchQuery(''); }} className="h-11 px-4 text-slate-500 hover:text-slate-900 rounded-xl font-medium">
                  <X className="mr-2 h-4 w-4" /> Clear
                </Button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
              <p className="font-medium">Loading associates...</p>
            </div>
          )}
          {associatesError && !isLoading && (
            <div className="p-6">
              <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 rounded-xl">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-red-900 font-bold">Error Loading Data</AlertTitle>
                <AlertDescription>{associatesError.message}</AlertDescription>
              </Alert>
            </div>
          )}
          {!isLoading && !associatesError && associates.length === 0 && (
            <div className="text-center py-24 px-6 bg-slate-50/50">
              <div className="bg-white h-20 w-20 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
                <Users className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No Associates Found</h3>
              <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">You haven't added any associates yet or none match your current filters. Click "Add New Associate" to create one.</p>
              {canManageAssociates && (
              <Button onClick={openAddDialog} className="mt-6 bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6">
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Associate
              </Button>
              )}
            </div>
          )}
          {!isLoading && !associatesError && associates.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4">Company & Contact</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4">Type</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4">Contact Info</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4 text-center">Date Added</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4 text-center">Status</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssociates.map((associate: any, index: number) => (
                    <TableRow key={associate.id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors group">
                      <TableCell className="py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {associate.company_name || associate.name}
                          </span>
                          {associate.company_name && associate.name && (
                            <span className="text-xs text-slate-500 font-medium">
                              Contact: {associate.name}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            ID: {associate.associate_code || associate.code || `#${index + 1}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        {associate.parent_id ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                            <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-200/60 font-semibold shadow-sm px-2.5">
                              Sub of {associate.parent?.name || 'Parent'}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-semibold shadow-sm px-2.5 mt-1">
                            Primary
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="flex flex-col gap-1 mt-0.5">
                          <span className="text-sm font-semibold text-slate-700">{associate.phone}</span>
                          <span className="text-xs font-medium text-slate-500 truncate max-w-[180px]">{associate.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top text-center">
                        <div className="flex flex-col items-center gap-1 mt-0.5">
                          <span className="text-sm font-semibold text-slate-700">
                            {associate.created_at ? new Date(associate.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {associate.created_at ? new Date(associate.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top text-center">
                        <div className="mt-1">
                          <span className={`inline-flex items-center justify-center px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-lg shadow-sm border ${
                            associate.status === 'Active' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' 
                              : 'bg-rose-50 text-rose-700 border-rose-200/60'
                          }`}>
                            {associate.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          {!canManageAssociates && (
                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(associate)} className="h-9 w-9 rounded-xl bg-slate-50/50 text-slate-600 hover:bg-slate-100 hover:text-slate-700">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {canManageAssociates && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(associate)} className="h-9 w-9 rounded-xl bg-blue-50/50 text-blue-600 hover:bg-blue-100 hover:text-blue-700">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(associate.id)} className="h-9 w-9 rounded-xl bg-red-50/50 text-red-600 hover:bg-red-100 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/30">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Showing {filteredAssociates.length} of {totalItems} associates
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-widest bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Previous
                </Button>
                <div className="text-xs font-bold text-slate-600 px-2 bg-white border border-slate-200 h-9 flex items-center justify-center rounded-xl min-w-[5rem]">
                  {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-widest bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
        setIsFormDialogOpen(open);
        if (!open) {
          setEditingAssociate(null);
          form.reset();
        }
      }}>
        <DialogContent 
          className="sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl h-[96vh] flex flex-col p-0 overflow-hidden shadow-2xl border-primary/10"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full overflow-hidden">
              <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <DialogTitle className="text-xl font-bold text-primary">
                      {formMode === 'view' ? editingAssociate?.name : editingAssociate ? `Editing "${editingAssociate.name}"` : 'Adding New Associate'}
                    </DialogTitle>
                    <DialogDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mt-1">
                      {formMode === 'view' ? 'View the details of this item.' : editingAssociate ? 'Update the details of this item.' : 'Enter the details for Associate.'}
                    </DialogDescription>
                  </div>

                  {/* Profile Link moved to header area */}
                  <div className="flex-shrink-0">
                    <FormField control={form.control} name="profiles" render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Link to Profiles</FormLabel>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {allProfiles.length > 0 ? (
                            allProfiles.map(p => (
                              <Badge
                                key={p.id}
                                className={`relative cursor-pointer transition-all hover:scale-105 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest ${field.value.includes(p.id)
                                  ? 'bg-primary shadow-lg shadow-primary/20 border-primary scale-105'
                                  : p.is_default
                                    ? 'bg-blue-50/50 border-blue-400 text-blue-600 border-2'
                                    : 'bg-background hover:bg-muted border-2 text-slate-600'
                                  }`}
                                onClick={() => {
                                  const next = field.value.includes(p.id)
                                    ? field.value.filter((id: string) => id !== p.id)
                                    : [...field.value, p.id];
                                  field.onChange(next);
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  {field.value.includes(p.id) && <CheckCircle className="h-3 w-3" />}
                                  {p.profile_name}
                                </div>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] italic text-muted-foreground">No profiles available</span>
                          )}
                        </div>
                        <FormMessage className="text-[9px] font-bold text-right" />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </DialogHeader>
              <div className="flex-grow overflow-y-auto custom-scrollbar px-6">
                <Tabs value={activeAssociateTab} onValueChange={setActiveAssociateTab} className="w-full">
                  <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pt-4 pb-3 mb-4 -mx-6 px-6 border-b border-border shadow-sm">
                    <TabsList className={`grid w-full p-1 bg-muted rounded-xl h-auto gap-1 ${editingAssociate ? 'grid-cols-5' : 'grid-cols-3'}`}>
                      <TabsTrigger type="button" value="personal" className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase">Personal</TabsTrigger>
                      <TabsTrigger type="button" value="contact" className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase">Contact</TabsTrigger>
                      <TabsTrigger type="button" value="statutory" className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase">Statutory</TabsTrigger>
                      {editingAssociate && (
                        <>
                          <TabsTrigger type="button" value="billing" className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase">Billing</TabsTrigger>
                          <TabsTrigger type="button" value="commission" className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase">Commission</TabsTrigger>
                        </>
                      )}
                    </TabsList>
                  </div>

                  <TabsContent value="personal" className="mt-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <fieldset disabled={formMode === 'view'} className="min-w-0">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-1 uppercase tracking-tight">General Details</h3>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Main information about the associate.</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="companyName" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Associate Company Name</FormLabel>
                            <FormControl><Input placeholder="e.g., Tech Solutions Pvt Ltd" className="bg-white border-2" {...field} value={field.value || ''} /></FormControl>
                            <FormMessage className="text-[9px] font-bold" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Associate Name *</FormLabel>
                            <FormControl><Input placeholder="e.g., John Doe" className={`bg-white border-2 transition-all ${form.formState.errors.name ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length >= 3 && !form.formState.errors.name ? 'border-emerald-500' : ''}`} {...field} onChange={e => { field.onChange(e); syncContactIfEnabled(); }} /></FormControl>
                            <FormMessage className="text-[9px] font-bold" />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Phone *</FormLabel>
                            <FormControl>
                                  <PhoneInput
                                    placeholder="9876543210"
                                    className={form.formState.errors.phone ? 'border-destructive' : ''}
                                    {...field}
                                    onChange={val => { field.onChange(val); syncContactIfEnabled(); }}
                                  />
                            </FormControl>
                            <FormMessage className="text-[9px] font-bold" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Email *</FormLabel>
                            <FormControl><Input type="email" placeholder="associate@example.com" className={`bg-white border-2 transition-all ${form.formState.errors.email ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length > 0 && !form.formState.errors.email ? 'border-emerald-500' : ''}`} {...field} onChange={e => { field.onChange(e); syncContactIfEnabled(); }} /></FormControl>
                            <FormMessage className="text-[9px] font-bold" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="hasParentAssociate" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 bg-blue-50/30 rounded-xl border-2 border-slate-200 mt-6 md:col-span-1">
                            <div className="space-y-0.5">
                              <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Has Parent Associate?</FormLabel>
                              <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Do you have a parent associate?</p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(val) => {
                                  field.onChange(val);
                                  if (!val) form.setValue('parentId', null);
                                }}
                                className="data-[state=checked]:bg-primary"
                              />
                            </FormControl>
                          </FormItem>
                        )} />

                        {form.watch('hasParentAssociate') && (
                          <FormField control={form.control} name="parentId" render={({ field }) => (
                            <FormItem className="flex flex-col mt-6 md:col-span-1 animate-in fade-in slide-in-from-top-2 duration-300">
                              <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Parent Associate *</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn(
                                        "w-full justify-between bg-white border-2 font-bold text-xs h-10 px-3 hover:bg-slate-50",
                                        !field.value && "text-muted-foreground",
                                        form.formState.errors.parentId && "border-destructive"
                                      )}
                                    >
                                      {field.value && field.value !== 'none'
                                        ? (() => {
                                            const found = (associates || []).find((a: any) => a.id === field.value);
                                            return found ? (found.companyName || found.name) : "Select Parent Associate";
                                          })()
                                        : "Select Parent Associate"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search associate..." className="h-9 text-xs" />
                                    <CommandList>
                                      <CommandEmpty className="py-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">No associate found.</CommandEmpty>
                                      <CommandGroup>
                                        {associates?.map((a: any) => (
                                          <CommandItem
                                            key={a.id}
                                            value={a.name}
                                            onSelect={() => {
                                              field.onChange(a.id);
                                              setSearchQuery("");
                                            }}
                                          >
                                            <Check className={cn("mr-2 h-4 w-4", a.id === field.value ? "opacity-100" : "opacity-0")} />
                                            {a.name}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage className="text-[9px] font-bold" />
                            </FormItem>
                          )} />
                        )}
                      </div>

                      {editingAssociate && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 items-start">
                          <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem className="w-full">
                              <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Status *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="bg-white border-2"><SelectValue placeholder="Status" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="Active">Active</SelectItem>
                                  <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          {form.watch('status') === 'Inactive' && (
                            <FormField control={form.control} name="statusEffectiveDate" render={({ field }) => (
                              <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-destructive flex items-center gap-1.5">
                                  <AlertTriangle className="h-3 w-3" /> Inactive From (Effective Date) *
                                </FormLabel>
                                <FormControl><Input type="date" className="bg-white border-2 border-destructive/20 focus-visible:ring-destructive" {...field} /></FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                              </FormItem>
                            )} />
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                    </fieldset>
                  </TabsContent>


                  <TabsContent value="contact" className="mt-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <fieldset disabled={formMode === 'view'} className="min-w-0">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-1 uppercase tracking-tight">Contact Persons</h3>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Official contact persons for coordination.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-700 hover:bg-slate-50 bg-white shadow-sm"
                          onClick={() => {
                            const current = form.getValues('contactPersons') || [];
                            // Basic check for incomplete fields
                            if (current.some(c => c.name.trim() === '' || (c.phone ?? '').trim() === '')) {
                              toast({ title: "Incomplete Contact", description: "Please complete names and phones for existing contacts.", variant: "destructive" });
                              return;
                            }
                            // Append new contact
                            appendContact({ name: '', phone: '', email: '', designation: '', contactReason: '', date: '', isSameAsAssociate: false });
                          }}
                        >
                          <PlusCircle className="mr-1.5 h-4 w-4" /> Add Contact Person
                        </Button>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
                        <div className="space-y-6">
                        {contactFields.map((contactField, index) => (
                          <div key={contactField.id} className="bg-slate-50/50 p-6 rounded-xl border border-slate-200 relative transition-all hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50">
                          <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-3">
                              <span className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-md shadow-blue-600/10">Contact Person {index + 1}</span>
                            </div>

                            <div className="flex items-center gap-4">
                              <FormField
                                control={form.control}
                                name={`contactPersons.${index}.isSameAsAssociate`}
                                render={({ field }) => (
                                  <div className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${field.value ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                    onClick={() => {
                                      if (field.value) {
                                        // Confirm toggle off
                                        setConfirmingDeselectIndex(index);
                                        setShowDeselectConfirm(true);
                                      } else {
                                        // Toggle on
                                        field.onChange(true);
                                        form.setValue(`contactPersons.${index}.name`, form.getValues('name') || '');
                                        form.setValue(`contactPersons.${index}.phone`, form.getValues('phone') || '');
                                        form.setValue(`contactPersons.${index}.email`, form.getValues('email') || '');
                                        form.trigger(`contactPersons.${index}.name`);
                                        form.trigger(`contactPersons.${index}.phone`);
                                      }
                                    }}>
                                    <input type="checkbox" checked={field.value} onChange={() => {}} className="h-3.5 w-3.5 rounded border-2 border-inherit text-emerald-600 focus:ring-emerald-600 cursor-pointer" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Same as Associate</span>
                                  </div>
                                )}
                              />

                              {contactFields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                                  onClick={() => removeContact(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                            <FormField control={form.control} name={`contactPersons.${index}.name`} render={({ field }) => (
                              <FormItem>
                                <div className="flex justify-between items-center h-5">
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Full Name *</FormLabel>
                                  {form.watch(`contactPersons.${index}.isSameAsAssociate`) && <Badge variant="secondary" className="px-1.5 py-0 text-[7px] bg-emerald-100 text-emerald-700 border-emerald-200">AUTO-FILLED</Badge>}
                                </div>
                                <FormControl><Input placeholder="John Doe" readOnly={form.watch(`contactPersons.${index}.isSameAsAssociate`)} className={cn("bg-white", form.watch(`contactPersons.${index}.isSameAsAssociate`) && "bg-slate-50 border-emerald-200 text-slate-500")} {...field} /></FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                              </FormItem>
                            )} />

                            <FormField control={form.control} name={`contactPersons.${index}.phone`} render={({ field }) => (
                              <FormItem>
                                <div className="flex justify-between items-center h-5">
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Mobile Number *</FormLabel>
                                  {form.watch(`contactPersons.${index}.isSameAsAssociate`) && <Badge variant="secondary" className="px-1.5 py-0 text-[7px] bg-emerald-100 text-emerald-700 border-emerald-200">AUTO-FILLED</Badge>}
                                </div>
                                <FormControl>
                                  <div className={cn(form.watch(`contactPersons.${index}.isSameAsAssociate`) && "pointer-events-none opacity-80")}>
                                    <PhoneInput
                                      placeholder="9876543210"
                                      className={form.formState.errors.contactPersons?.[index]?.phone ? 'border-destructive' : ''}
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                              </FormItem>
                            )} />

                            <FormField control={form.control} name={`contactPersons.${index}.email`} render={({ field }) => (
                              <FormItem>
                                <div className="flex justify-between items-center h-5">
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Direct Email *</FormLabel>
                                  {form.watch(`contactPersons.${index}.isSameAsAssociate`) && <Badge variant="secondary" className="px-1.5 py-0 text-[7px] bg-emerald-100 text-emerald-700 border-emerald-200">AUTO-FILLED</Badge>}
                                </div>
                                <FormControl><Input type="email" placeholder="john@company.com" readOnly={form.watch(`contactPersons.${index}.isSameAsAssociate`)} className={cn("bg-white", form.watch(`contactPersons.${index}.isSameAsAssociate`) && "bg-slate-50 border-emerald-200 text-slate-500")} {...field} /></FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                              </FormItem>
                            )} />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={form.control} name={`contactPersons.${index}.designation`} render={({ field }) => (
                              <FormItem>
                                <div className="flex justify-between items-center h-5">
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Designation / Role</FormLabel>
                                </div>
                                <FormControl><Input placeholder="General Manager / Accountant" className="bg-white" {...field} /></FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                              </FormItem>
                            )} />

                            <FormField control={form.control} name={`contactPersons.${index}.contactReason`} render={({ field }) => (
                              <FormItem>
                                <div className="flex justify-between items-center h-5">
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Description</FormLabel>
                                </div>
                                <FormControl><Textarea placeholder="e.g., Contact for billing queries, available Mon–Fri 10am–5pm, prefers WhatsApp..." className="bg-white min-h-[40px] border-2" {...field} /></FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                              </FormItem>
                            )} />

                            <FormField control={form.control} name={`contactPersons.${index}.date`} render={({ field }) => (
                              <FormItem>
                                <div className="flex justify-between items-center h-5">
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Date</FormLabel>
                                </div>
                                <FormControl><Input type="date" className="bg-white" {...field} value={field.value || ''} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} /></FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                              </FormItem>
                            )} />
                          </div>
                        </div>
                      ))}
                         {form.formState.errors.contactPersons?.root?.message && (
                           <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 animate-in fade-in slide-in-from-top-2 duration-300">
                             <AlertTriangle className="h-4 w-4" />
                             <AlertTitle className="text-xs font-black uppercase tracking-widest text-slate-900 italic">Attention Required</AlertTitle>
                             <AlertDescription className="text-[10px] font-bold">
                               {form.formState.errors.contactPersons.root.message}
                             </AlertDescription>
                           </Alert>
                         )}
                        </div>
                      </div>
                    </div>
                    </fieldset>
                  </TabsContent>


                  <TabsContent value="statutory" className="mt-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <fieldset disabled={formMode === 'view'} className="min-w-0">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-1 uppercase tracking-tight">Statutory & Address</h3>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Business compliance and location details.</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-8">
                        {/* Address Toggle and Fields */}
                        <div className="space-y-4">
                          <FormField control={form.control} name="hasAddress" render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border-2 border-slate-200 shadow-sm transition-all hover:border-slate-300">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-bold text-slate-700">Office Address</FormLabel>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Do you want to add an address?</p>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                              </FormControl>
                            </FormItem>
                          )} />

                          {form.watch('hasAddress') && (
                            <div className="p-6 bg-slate-50/50 rounded-xl border border-slate-200 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Registered Office Address</h4>

                              <div className="space-y-6">
                                <FormField control={form.control} name="streetAddress" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Building No / Plot No / House Name *</FormLabel>
                                    <FormControl><Input placeholder="e.g., Flat 4B / Plot 12, Sunrise Towers" className={`bg-white border-2 transition-all ${form.formState.errors.streetAddress ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length > 0 ? 'border-emerald-500' : ''}`} {...field} /></FormControl>
                                    <FormMessage className="text-[9px] font-bold" />
                                  </FormItem>
                                )} />

                                <FormField control={form.control} name="locality" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Street / Area / Locality</FormLabel>
                                    <FormControl><Input placeholder="e.g., MG Road, Near City Mall, Anna Nagar" className="bg-white border-2" {...field} /></FormControl>
                                    <FormMessage className="text-[9px] font-bold" />
                                  </FormItem>
                                )} />

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                  <FormField control={form.control} name="city" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">City/Town/Village</FormLabel>
                                      <FormControl><Input placeholder="City Name" className="bg-white border-2" {...field} /></FormControl>
                                      <FormMessage className="text-[9px] font-bold" />
                                    </FormItem>
                                  )} />

                                  <FormField control={form.control} name="district" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">District *</FormLabel>
                                      <FormControl><Input placeholder="District Name" className={`bg-white border-2 transition-all ${form.formState.errors.district ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length > 0 ? 'border-emerald-500' : ''}`} {...field} /></FormControl>
                                      <FormMessage className="text-[9px] font-bold" />
                                    </FormItem>
                                  )} />
                                  <FormField control={form.control} name="state" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">State *</FormLabel>
                                      <FormControl><Input placeholder="State" className={`bg-white border-2 transition-all ${form.formState.errors.state ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length > 0 ? 'border-emerald-500' : ''}`} {...field} /></FormControl>
                                      <FormMessage className="text-[9px] font-bold" />
                                    </FormItem>
                                  )} />
                                  <FormField control={form.control} name="country" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Country</FormLabel>
                                      <FormControl><Input placeholder="Country" className={`bg-white border-2 transition-all ${(field.value || '').length > 0 ? 'border-emerald-500' : ''}`} {...field} value={field.value || 'India'} /></FormControl>
                                      <FormMessage className="text-[9px] font-bold" />
                                    </FormItem>
                                  )} />
                                  <FormField control={form.control} name="pincode" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Pin Code *</FormLabel>
                                      <FormControl><Input
                                        placeholder="6-digit ZIP"
                                        className={`bg-white border-2 transition-all ${form.formState.errors.pincode ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length === 6 ? 'border-emerald-500' : ''}`}
                                        {...field}
                                        maxLength={6}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          field.onChange(val);
                                          if (val.length === 6) form.trigger('pincode');
                                        }}
                                      /></FormControl>
                                      <FormMessage className="text-[9px] font-bold" />
                                    </FormItem>
                                  )} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* PAN Toggle and Fields */}
                        <div className="space-y-4">
                          <FormField control={form.control} name="hasPAN" render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border-2 border-slate-200 shadow-sm transition-all hover:border-slate-300">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-bold text-slate-700">PAN Details</FormLabel>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Do you have a PAN card?</p>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                              </FormControl>
                            </FormItem>
                          )} />

                          {form.watch('hasPAN') && (
                            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
                              <FormField control={form.control} name="panNumber" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">PAN Number *</FormLabel>
                                  <FormControl><Input
                                    placeholder="10-digit PAN"
                                    className={`bg-white border-2 font-mono uppercase transition-all ${form.formState.errors.panNumber ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length === 10 ? 'border-emerald-500' : ''}`}
                                    {...field}
                                    onChange={(e) => {
                                      const val = e.target.value.toUpperCase();
                                      field.onChange(val);
                                      if (val.length === 10) form.trigger('panNumber');
                                    }}
                                    maxLength={10}
                                  /></FormControl>
                                  <FormMessage className="text-[9px] font-bold" />
                                </FormItem>
                              )} />
                            </div>
                          )}
                        </div>

                        {/* GST Toggle and Fields */}
                        <div className="space-y-4">
                          <FormField control={form.control} name="hasGST" render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border-2 border-slate-200 shadow-sm transition-all hover:border-slate-300">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-bold text-slate-700">GST Registration</FormLabel>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Do you have a GST number?</p>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                              </FormControl>
                            </FormItem>
                          )} />

                          {form.watch('hasGST') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50/50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
                              <FormField control={form.control} name="gstNumber" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">GST Number (GSTIN) *</FormLabel>
                                  <FormControl><Input
                                    placeholder="15-digit number"
                                    className={`bg-white border-2 font-mono uppercase transition-all ${form.formState.errors.gstNumber ? 'border-destructive focus-visible:ring-destructive' : (field.value || '').length === 15 ? 'border-emerald-500' : ''}`}
                                    {...field}
                                    onChange={(e) => {
                                      const val = e.target.value.toUpperCase();
                                      field.onChange(val);
                                      if (val.length === 15) form.trigger('gstNumber');
                                    }}
                                    maxLength={15}
                                  /></FormControl>
                                  <FormMessage className="text-[9px] font-bold" />
                                </FormItem>
                              )} />
                              <FormField control={form.control} name="gstEffectiveDate" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Effective Date</FormLabel>
                                  <FormControl><Input type="date" className={`bg-white border-2 transition-all ${field.value ? 'border-emerald-500' : ''}`} {...field} /></FormControl>
                                  <FormMessage className="text-[9px] font-bold" />
                                </FormItem>
                              )} />
                            </div>
                          )}
                        </div>


                      {/* Documents Toggle and Fields */}
                      <div className="space-y-4">
                        <FormField control={form.control} name="hasDocuments" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border-2 border-slate-200 shadow-sm transition-all hover:border-slate-300">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-bold text-slate-700">Document Attachments</FormLabel>
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Upload certificates, IDs, or other files.</p>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                            </FormControl>
                          </FormItem>
                        )} />

                        {form.watch('hasDocuments') && (
                          <div className="p-6 bg-slate-50/50 rounded-xl border border-slate-200 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Upload List</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-200 text-slate-700 hover:bg-slate-50"
                                onClick={() => appendDocument({ type: 'GST Certificate', fileUrl: '' })}
                              >
                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Document
                              </Button>
                            </div>

                            <div className="space-y-4">
                              {documentFields.map((docField, index) => {
                                const selectedType = form.watch(`documents.${index}.type`);
                                return (
                                  <div key={docField.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="md:col-span-4 space-y-2">
                                      <FormLabel className="text-[9px] font-black uppercase tracking-widest text-slate-400">Document Type</FormLabel>
                                      <FormField control={form.control} name={`documents.${index}.type`} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl><SelectTrigger className="bg-white border-2 h-9 text-xs font-bold"><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            <SelectItem value="GST Certificate">GST Certificate</SelectItem>
                                            <SelectItem value="PAN Card">PAN Card</SelectItem>
                                            <SelectItem value="Incorporate Certificate">Incorporate Certificate</SelectItem>
                                            <SelectItem value="Address Proof">Address Proof</SelectItem>
                                            <SelectItem value="Other">Other (Custom)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      )} />
                                    </div>

                                    {selectedType === 'Other' && (
                                      <div className="md:col-span-3 space-y-2">
                                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-slate-400">Name</FormLabel>
                                        <FormField control={form.control} name={`documents.${index}.customType`} render={({ field }) => (
                                          <FormControl><Input placeholder="Doc Name" className="bg-white border-2 h-9 text-xs" {...field} /></FormControl>
                                        )} />
                                      </div>
                                    )}

                                    <div className={`${selectedType === 'Other' ? 'md:col-span-4' : 'md:col-span-7'} space-y-2`}>
                                      <FormLabel className="text-[9px] font-black uppercase tracking-widest text-slate-400">File</FormLabel>
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex-grow">
                                          <Input
                                            type="file"
                                            className="hidden"
                                            id={`doc-file-${index}`}
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                try {
                                                  // Mock upload or direct upload if bucket exists
                                                  const fileExt = file.name.split('.').pop();
                                                  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                                                  const filePath = `associate-docs/${fileName}`;

                                                  const { data, error } = await supabase.storage.from('associates').upload(filePath, file);
                                                  if (error) throw error;

                                                  const { data: { publicUrl } } = supabase.storage.from('associates').getPublicUrl(filePath);
                                                  form.setValue(`documents.${index}.fileUrl`, publicUrl);
                                                  form.setValue(`documents.${index}.fileName`, file.name);
                                                  toast({ title: "File Uploaded", description: file.name });
                                                } catch (err) {
                                                  console.error("Upload error:", err);
                                                  toast({ title: "Upload Failed", description: "Storage bucket 'associates' might be missing.", variant: "destructive" });
                                                }
                                              }
                                            }}
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full h-9 border-2 border-dashed border-violet-200 hover:border-violet-400 hover:bg-violet-50 text-xs font-bold text-violet-700 gap-2 overflow-hidden"
                                            onClick={() => document.getElementById(`doc-file-${index}`)?.click()}
                                          >
                                            {form.watch(`documents.${index}.fileName`) ? (
                                              <><CheckCircle className="h-3.5 w-3.5" /> {form.watch(`documents.${index}.fileName`)}</>
                                            ) : (
                                              <><PlusCircle className="h-3.5 w-3.5" /> Choose File</>
                                            )}
                                          </Button>
                                        </div>
                                        {form.watch(`documents.${index}.fileUrl`) && (
                                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-violet-600 hover:text-violet-700 hover:bg-violet-100" asChild>
                                            <a href={form.watch(`documents.${index}.fileUrl`)} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /></a>
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="md:col-span-1 pb-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                        onClick={() => removeDocument(index)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      </div>
                    </div>
                    </fieldset>
                  </TabsContent>

                  <TabsContent value="billing" className="mt-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <fieldset disabled={formMode === 'view'} className="min-w-0">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-1 uppercase tracking-tight">Billing Rules</h3>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Client-specific billing configurations.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-700 hover:bg-slate-50 bg-white shadow-sm"
                          onClick={() => {
                            setEditingRuleIndex(null);
                            currentBillingRule.reset({
                              description: '',
                              applicationCondition: '',
                              invoiceSource: 'Us',
                              companyBillingType: 'Us to Customer',
                              effectiveDate: new Date().toISOString().split('T')[0],
                              isSelected: true
                            });
                            setIsBillingRuleDialogOpen(true);
                          }}
                        >
                          <PlusCircle className="mr-1.5 h-4 w-4" /> Add Rule
                        </Button>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow className="border-slate-200">
                              <TableHead className="w-10 px-4">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                  checked={billingFields.length > 0 && billingFields.every((_, i) => form.getValues(`billingRules.${i}.isSelected`) !== false)}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    billingFields.forEach((_, i) => form.setValue(`billingRules.${i}.isSelected`, val));
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Source</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Effective Date</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {billingFields.length > 0 ? (
                              billingFields.map((field, index) => (
                                <TableRow key={field.id} className={cn("hover:bg-slate-50 transition-colors", form.watch(`billingRules.${index}.isSelected`) === false && "opacity-50 grayscale-[0.5]")}>
                                  <TableCell className="px-4">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                      checked={form.watch(`billingRules.${index}.isSelected`) !== false}
                                      onChange={(e) => form.setValue(`billingRules.${index}.isSelected`, e.target.checked)}
                                    />
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <Badge variant="outline" className={`text-[9px] font-bold ${field.invoiceSource === 'Us' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                                      {field.invoiceSource}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs font-bold text-slate-700">{field.description}</TableCell>
                                  <TableCell className="text-[10px] font-bold text-slate-500">{field.effectiveDate}</TableCell>
                                  <TableCell className="text-right py-3 pr-4">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => {
                                        setEditingRuleIndex(index);
                                        currentBillingRule.reset(field as BillingRule);
                                        setIsBillingRuleDialogOpen(true);
                                      }}><Edit className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => removeBilling(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow><TableCell colSpan={5} className="text-center py-10 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-slate-50/50">No rules configured.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    </fieldset>
                  </TabsContent>

                  <TabsContent value="commission" className="mt-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <fieldset disabled={formMode === 'view'} className="min-w-0">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-1 uppercase tracking-tight">Commission Rules</h3>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Internal partner profit agreements.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-700 hover:bg-slate-50 bg-white shadow-sm"
                          onClick={() => {
                            setEditingRuleIndex(null);
                            currentCommissionRule.reset({
                              description: '',
                              applicationCondition: '',
                              commissionType: 'Percentage',
                              value: 0,
                              effectiveDate: new Date().toISOString().split('T')[0],
                              isSelected: true
                            });
                            setIsCommissionRuleDialogOpen(true);
                          }}
                        >
                          <PlusCircle className="mr-1.5 h-4 w-4" /> Add Rule
                        </Button>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow className="border-slate-200">
                              <TableHead className="w-10 px-4">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                  checked={commissionFields.length > 0 && commissionFields.every((_, i) => form.getValues(`commissionRules.${i}.isSelected`) !== false)}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    commissionFields.forEach((_, i) => form.setValue(`commissionRules.${i}.isSelected`, val));
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Type</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Value</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {commissionFields.length > 0 ? (
                              commissionFields.map((field, index) => (
                                <TableRow key={field.id} className={cn("hover:bg-slate-50 transition-colors", form.watch(`commissionRules.${index}.isSelected`) === false && "opacity-50 grayscale-[0.5]")}>
                                  <TableCell className="px-4">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                      checked={form.watch(`commissionRules.${index}.isSelected`) !== false}
                                      onChange={(e) => form.setValue(`commissionRules.${index}.isSelected`, e.target.checked)}
                                    />
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <Badge variant="outline" className="text-[9px] font-bold bg-slate-100 text-slate-800">
                                      {field.commissionType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs font-black text-slate-800">{field.value}{field.commissionType === 'Percentage' ? '%' : ' ₹'}</TableCell>
                                  <TableCell className="text-xs font-bold text-slate-700">{field.description}</TableCell>
                                  <TableCell className="text-right py-3 pr-4">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => {
                                        setEditingRuleIndex(index);
                                        currentCommissionRule.reset(field as CommissionRule);
                                        setIsCommissionRuleDialogOpen(true);
                                      }}><Edit className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => removeCommission(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow><TableCell colSpan={5} className="text-center py-10 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-slate-50/50">No rules configured.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    </fieldset>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="border-t p-6 shrink-0 flex items-center justify-between bg-white z-50">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Step Progress</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {(() => {
                          const tabs = editingAssociate
                            ? ['personal', 'contact', 'statutory', 'billing', 'commission']
                            : ['personal', 'contact', 'statutory'];
                          const currentStep = tabs.indexOf(activeAssociateTab) + 1;
                          const totalSteps = tabs.length;
                          return (
                            <>
                              <span className="text-xs font-black text-primary">0{currentStep}</span>
                              <div className="flex gap-1">
                                {Array.from({ length: totalSteps }).map((_, i) => (
                                  <div key={i} className={cn("h-1 w-4 rounded-full transition-all duration-300", i < currentStep ? "bg-primary" : "bg-slate-200")} />
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">/ 0{totalSteps}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <Separator orientation="vertical" className="h-8 bg-slate-100" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px] font-black uppercase tracking-widest px-5 h-10 border-2"
                      onClick={() => {
                        const tabs = editingAssociate
                          ? ['personal', 'contact', 'statutory', 'billing', 'commission']
                          : ['personal', 'contact', 'statutory'];
                        const currentIdx = tabs.indexOf(activeAssociateTab);
                        if (currentIdx > 0) setActiveAssociateTab(tabs[currentIdx - 1]);
                      }}
                      disabled={activeAssociateTab === 'personal'}
                    >
                      <ChevronRight className="mr-1.5 h-3.5 w-3.5 rotate-180" /> Previous
                    </Button>
                    <DialogClose asChild>
                      <Button type="button" variant="ghost" className="px-5 font-black text-[10px] h-10 uppercase tracking-widest text-muted-foreground hover:text-slate-800">{formMode === 'view' ? 'Close' : 'Cancel'}</Button>
                    </DialogClose>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeAssociateTab !== (editingAssociate ? 'commission' : 'statutory') ? (
                      <Button
                        key="next-step-btn"
                        type="button"
                        size="sm"
                        disabled={form.formState.isSubmitting}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] uppercase tracking-widest px-8 h-11 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105"
                        onClick={async () => {
                          const tabs = editingAssociate
                            ? ['personal', 'contact', 'statutory', 'billing', 'commission']
                            : ['personal', 'contact', 'statutory'];
                          const currentIdx = tabs.indexOf(activeAssociateTab);
                          
                          // Validate current step
                          let fieldsToValidate: any[] = [];
                          if (activeAssociateTab === 'personal') {
                            fieldsToValidate = ['name', 'email', 'phone', 'parentId', 'companyName'];
                          } else if (activeAssociateTab === 'contact') {
                            fieldsToValidate = ['contactPersons'];
                          } else if (activeAssociateTab === 'statutory') {
                            fieldsToValidate = ['streetAddress', 'district', 'state', 'pincode', 'gstNumber', 'panNumber'];
                          }
                          
                          const isValid = await form.trigger(fieldsToValidate as any);
                          if (isValid) {
                            if (currentIdx < tabs.length - 1) {
                              // Use a small timeout to ensure the state update doesn't conflict with button unmounting
                              setTimeout(() => setActiveAssociateTab(tabs[currentIdx + 1]), 10);
                            }
                          } else {
                            const errors = form.formState.errors;
                            let errorMsg = "Please fill all required fields in the current step correctly.";
                            
                            // Check for our custom duplicate error
                            if (activeAssociateTab === 'contact' && errors.contactPersons?.message === 'DUPLICATE_CONTACTS') {
                              errorMsg = "There are duplicate contact persons. Please ensure each person has a unique name and phone/email combination.";
                            }

                            toast({
                              title: "Validation Error",
                              description: errorMsg,
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        Next Step <ChevronRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    ) : (
                      formMode !== 'view' && (
                      <Button 
                        key="submit-registration-btn"
                        type="submit" 
                        disabled={isSubmitting} 
                        className={`px-10 h-11 rounded-xl shadow-lg transition-all font-black text-[10px] uppercase tracking-widest ${isSubmitting ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-primary-foreground hover:scale-105 shadow-emerald-600/20'}`}
                      >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Handshake className="mr-2 h-4 w-4" />}
                        {editingAssociate ? 'Save Changes' : 'Complete Registration'}
                      </Button>
                      )
                    )}
                  </div>
                </DialogFooter>

              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBillingCommissionDialogOpen} onOpenChange={setIsBillingCommissionDialogOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[96vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-t-4 border-t-amber-500 shadow-2xl">
          <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Configure Billing & Commission
            </DialogTitle>
            <DialogDescription className="text-xs uppercase tracking-widest font-medium">
              Manage billing rules and commission splits globally.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="flex flex-col flex-grow overflow-hidden">
              <div className="flex-grow overflow-y-auto custom-scrollbar px-6 pb-2">
                <Tabs value={activeBillingTab} onValueChange={setActiveBillingTab} className="w-full">
                  <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pt-4 pb-3 mb-4 -mx-6 px-6 border-b border-border shadow-sm">
                    <TabsList className="grid w-full grid-cols-3 p-1 bg-muted rounded-xl h-auto gap-1">
                      <TabsTrigger type="button" value="overview" className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase">Overview</TabsTrigger>
                      <TabsTrigger type="button" value="billing" disabled={!selectedBillingAssociateId || !billingAgreed} className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase disabled:opacity-50">Billing</TabsTrigger>
                      <TabsTrigger type="button" value="commission" disabled={!selectedBillingAssociateId || !billingAgreed} className="rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold text-[10px] uppercase disabled:opacity-50">Commission</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="overview" className="mt-6 space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                    {/* Associate Selector */}
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Select Associate</p>
                      <Select
                        value={selectedBillingAssociateId || ''}
                        onValueChange={(val) => {
                          setSelectedBillingAssociateId(val);
                          setBillingAgreed(false);
                          const assoc = associates.find((a: any) => a.id === val);
                          if (assoc) {
                            form.reset({
                              companyName: assoc.companyName || '',
                              name: assoc.name,
                              phone: assoc.phone || '',
                              email: assoc.email || '',
                              status: assoc.status as any,
                              parentId: assoc.parentId,
                              profiles: assoc.profiles,
                              contactPersonName: assoc.contactPersonName || '',
                              contactPersonPhone: assoc.contactPersonPhone || '',
                              contactPersonEmail: assoc.contactPersonEmail || '',
                              contactPersons: assoc.contactPersons && assoc.contactPersons.length > 0
                                ? assoc.contactPersons
                                : [{ name: '', phone: '', email: '', designation: '', contactReason: '', date: '', isSameAsAssociate: false }],
                              gstNumber: assoc.gstNumber || '',
                              panNumber: assoc.panNumber || '',
                              streetAddress: assoc.streetAddress || '',
                              locality: assoc.locality || '',
                              city: assoc.city || '',
                              district: assoc.district || '',
                              state: assoc.state || '',
                              country: assoc.country || 'India',
                              pincode: assoc.pincode || '',
                              billingRules: assoc.billingRules || [],
                              commissionRules: assoc.commissionRules || []
                            });
                            setSelectedContactPersonIndex(0);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-white font-bold h-11 text-[11px] shadow-sm">
                          <SelectValue placeholder="Choose an associate..." />
                        </SelectTrigger>
                        <SelectContent>
                          {associates.map((a: any) => (
                            <SelectItem key={a.id} value={a.id} className="text-[12px]">
                              {a.companyName || a.name} — {a.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedBillingAssociateId && form.watch('name') && (
                      <>
                        {/* Business Info Strip */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden text-[11px]">
                          <div className="bg-slate-100 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Associate Details (Read Only)</div>
                          <div className="divide-y divide-slate-100">
                            {[
                              { label: 'Company', value: form.watch('companyName') || '—' },
                              { label: 'Name', value: form.watch('name') },
                              { label: 'Phone', value: form.watch('phone') || '—' },
                              { label: 'Email', value: form.watch('email') || '—' },
                              { label: 'PAN', value: form.watch('panNumber') || '—' },
                              { label: 'GST', value: form.watch('gstNumber') || '—' },
                              { label: 'City', value: form.watch('city') || '—' },
                              { label: 'District', value: form.watch('district') || '—' },
                              { label: 'Address', value: [form.watch('streetAddress'), form.watch('locality'), form.watch('state'), form.watch('country'), form.watch('pincode')].filter(Boolean).join(', ') || '—' },
                            ].map(row => (
                              <div key={row.label} className="flex items-center px-4 py-2.5 gap-3">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-14 shrink-0">{row.label}</span>
                                <span className="font-semibold text-slate-700 truncate">{row.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Contact Person Section */}
                        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Contact Information</p>
                              <h4 className="text-sm font-bold text-slate-700 mt-1">Associate Representative Details</h4>
                            </div>

                            {form.watch('contactPersons')?.length > 1 && (
                              <div className="w-full sm:w-64">
                                <Select
                                  value={selectedContactPersonIndex.toString()}
                                  onValueChange={(val) => setSelectedContactPersonIndex(parseInt(val))}
                                >
                                  <SelectTrigger className="bg-white border-2 h-9 text-xs font-bold">
                                    <SelectValue placeholder="Select Contact Person" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {form.watch('contactPersons').map((cp: any, idx: number) => (
                                      <SelectItem key={idx} value={idx.toString()} className="text-xs">
                                        {cp.name || `Representative ${idx + 1}`} {cp.designation ? `(${cp.designation})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                              { label: 'Full Name', value: form.watch(`contactPersons.${selectedContactPersonIndex}.name`) || '—', icon: <Users className="h-3.5 w-3.5" /> },
                              { label: 'Designation', value: form.watch(`contactPersons.${selectedContactPersonIndex}.designation`) || '—', icon: <Badge className="h-3.5 w-3.5" /> },
                              { label: 'Mobile Number', value: form.watch(`contactPersons.${selectedContactPersonIndex}.phone`) ? `+91 ${form.watch(`contactPersons.${selectedContactPersonIndex}.phone`)}` : '—', icon: <ChevronRight className="h-3.5 w-3.5" /> },
                              { label: 'Email Address', value: form.watch(`contactPersons.${selectedContactPersonIndex}.email`) || '—', icon: <FileText className="h-3.5 w-3.5" /> },
                            ].map((item, idx) => (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  {item.icon}
                                  {item.label}
                                </div>
                                <div className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 shadow-sm truncate">
                                  {item.value}
                                </div>
                              </div>
                            ))}
                          </div>

                          {form.watch(`contactPersons.${selectedContactPersonIndex}.contactReason`) && (
                            <div className="mt-6 pt-5 border-t border-slate-100">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Instructions / Context</p>
                              <div className="bg-white border border-slate-100 rounded-xl p-4 text-xs italic text-slate-600 shadow-sm leading-relaxed">
                                "{form.watch(`contactPersons.${selectedContactPersonIndex}.contactReason`)}"
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Agreement Checkbox */}
                        <label htmlFor="billing-agreement" className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer">
                          <input
                            type="checkbox"
                            id="billing-agreement"
                            checked={billingAgreed}
                            onChange={(e) => setBillingAgreed(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-2 border-amber-400 text-amber-600 focus:ring-amber-600 cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] font-semibold text-amber-900 leading-snug">
                            I verify the displayed details are correct and agree to proceed with configuring Billing & Commission rules for this associate.
                          </span>
                        </label>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="billing" className="mt-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-amber-600/5 p-6 rounded-2xl border border-amber-600/10 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-amber-700 mb-1 uppercase tracking-tight">Billing Rules</h3>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Financial configurations for this partner.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-amber-200 text-amber-700 hover:bg-amber-100 bg-white shadow-sm"
                          onClick={() => {
                            setEditingRuleIndex(null);
                            currentBillingRule.reset({
                              description: '',
                              applicationCondition: '',
                              invoiceSource: 'Us',
                              companyBillingType: 'Us to Customer',
                              effectiveDate: new Date().toISOString().split('T')[0],
                              isSelected: true
                            });
                            setIsBillingRuleDialogOpen(true);
                          }}
                        >
                          <PlusCircle className="mr-1.5 h-4 w-4" /> Add Rule
                        </Button>
                      </div>

                      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-amber-50">
                            <TableRow className="border-amber-200">
                              <TableHead className="w-10 px-4">
                                <input 
                                  type="checkbox" 
                                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer" 
                                  checked={billingFields.length > 0 && billingFields.every((_, i) => form.getValues(`billingRules.${i}.isSelected`) !== false)}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    billingFields.forEach((_, i) => form.setValue(`billingRules.${i}.isSelected`, val));
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-amber-700">Source</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-amber-700">Description</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-amber-700">Effective Date</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-amber-700">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {billingFields.length > 0 ? (
                              billingFields.map((field, index) => (
                                <TableRow key={field.id} className={cn("hover:bg-amber-50/30 transition-colors", form.watch(`billingRules.${index}.isSelected`) === false && "opacity-50 grayscale-[0.5]")}>
                                  <TableCell className="px-4">
                                    <input 
                                      type="checkbox" 
                                      className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                      checked={form.watch(`billingRules.${index}.isSelected`) !== false}
                                      onChange={(e) => form.setValue(`billingRules.${index}.isSelected`, e.target.checked)}
                                    />
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <Badge variant="outline" className={`text-[9px] font-bold ${field.invoiceSource === 'Us' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                                      {field.invoiceSource}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs font-bold text-slate-700">{field.description}</TableCell>
                                  <TableCell className="text-[10px] font-bold text-slate-500">{field.effectiveDate}</TableCell>
                                  <TableCell className="text-right py-3 pr-4">
                                    <div className="flex justify-end gap-1">
                                      {/* <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600" onClick={() => {
                                        setEditingRuleIndex(index);
                                        currentBillingRule.reset(field as BillingRule);
                                        setIsBillingRuleDialogOpen(true);
                                      }}><Edit className="h-3.5 w-3.5" /></Button> */}
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => removeBilling(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow><TableCell colSpan={5} className="text-center py-10 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-slate-50/50">No rules configured.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="commission" className="mt-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-indigo-600/5 p-6 rounded-2xl border border-indigo-600/10 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-indigo-700 mb-1 uppercase tracking-tight">Commission Rules</h3>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Profit split configurations for this partner.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-indigo-200 text-indigo-700 hover:bg-indigo-100 bg-white shadow-sm"
                          onClick={() => {
                            setEditingRuleIndex(null);
                            currentCommissionRule.reset({
                              description: '',
                              applicationCondition: '',
                              commissionType: 'Percentage',
                              value: 0,
                              effectiveDate: new Date().toISOString().split('T')[0],
                              isSelected: true
                            });
                            setIsCommissionRuleDialogOpen(true);
                          }}
                        >
                          <PlusCircle className="mr-1.5 h-4 w-4" /> Add Rule
                        </Button>
                      </div>

                      <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-indigo-50">
                            <TableRow className="border-indigo-200">
                              <TableHead className="w-10 px-4">
                                <input 
                                  type="checkbox" 
                                  className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                                  checked={commissionFields.length > 0 && commissionFields.every((_, i) => form.getValues(`commissionRules.${i}.isSelected`) !== false)}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    commissionFields.forEach((_, i) => form.setValue(`commissionRules.${i}.isSelected`, val));
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Type</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Value</TableHead>
                              <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Description</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-indigo-700">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {commissionFields.length > 0 ? (
                              commissionFields.map((field, index) => (
                                <TableRow key={field.id} className={cn("hover:bg-indigo-50/30 transition-colors", form.watch(`commissionRules.${index}.isSelected`) === false && "opacity-50 grayscale-[0.5]")}>
                                  <TableCell className="px-4">
                                    <input 
                                      type="checkbox" 
                                      className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      checked={form.watch(`commissionRules.${index}.isSelected`) !== false}
                                      onChange={(e) => form.setValue(`commissionRules.${index}.isSelected`, e.target.checked)}
                                    />
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <Badge variant="outline" className="text-[9px] font-bold bg-indigo-100 text-indigo-800">
                                      {field.commissionType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs font-black text-indigo-700">{field.value}{field.commissionType === 'Percentage' ? '%' : ' ₹'}</TableCell>
                                  <TableCell className="text-xs font-bold text-slate-700">{field.description}</TableCell>
                                  <TableCell className="text-right py-3 pr-4">
                                    <div className="flex justify-end gap-1">
                                      {/* <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => {
                                        setEditingRuleIndex(index);
                                        currentCommissionRule.reset(field as CommissionRule);
                                        setIsCommissionRuleDialogOpen(true);
                                      }}><Edit className="h-3.5 w-3.5" /></Button> */}
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => removeCommission(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow><TableCell colSpan={5} className="text-center py-10 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-slate-50/50">No rules configured.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <DialogFooter className="border-t p-6 shrink-0 flex items-center justify-between bg-background/95 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="px-6 font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:text-slate-800"
                    onClick={() => {
                        const tabs = ['overview', 'billing', 'commission'];
                        const currentIdx = tabs.indexOf(activeBillingTab);
                        if (currentIdx > 0) setActiveBillingTab(tabs[currentIdx - 1]);
                        else setIsBillingCommissionDialogOpen(false);
                    }}
                  >
                    {activeBillingTab === 'overview' ? 'Cancel' : (
                        <><ChevronRight className="mr-1.5 h-3.5 w-3.5 rotate-180" /> Previous</>
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {activeBillingTab !== 'commission' ? (
                    <Button 
                      key="billing-next-btn"
                      type="button" 
                      disabled={!selectedBillingAssociateId || (activeBillingTab === 'overview' && !billingAgreed)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] uppercase tracking-widest px-8 h-11 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 disabled:opacity-50"
                      onClick={() => {
                        const tabs = ['overview', 'billing', 'commission'];
                        const currentIdx = tabs.indexOf(activeBillingTab);
                        if (currentIdx < tabs.length - 1) {
                            setTimeout(() => setActiveBillingTab(tabs[currentIdx + 1]), 10);
                        }
                      }}
                    >
                      Next Step <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      key="billing-save-btn"
                      type="button"
                      disabled={
                        isSubmitting || 
                        !selectedBillingAssociateId || 
                        !billingAgreed || 
                        !form.watch('billingRules')?.some(r => r.isSelected) || 
                        !form.watch('commissionRules')?.some(r => r.isSelected)
                      }
                      className="px-10 h-11 rounded-xl shadow-lg transition-all font-black text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-emerald-50 hover:scale-105 shadow-emerald-600/20 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                      onClick={handleBillingCommissionSave}
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Save Configuration
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeselectConfirm} onOpenChange={setShowDeselectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Confirm Clear Form?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Unchecking "Same as Associate" will clear all details for this contact person. This action cannot be reversed. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmingDeselectIndex(null); }}>Keep Details</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmingDeselectIndex !== null) {
                  form.setValue(`contactPersons.${confirmingDeselectIndex}.isSameAsAssociate`, false);
                  form.setValue(`contactPersons.${confirmingDeselectIndex}.name`, '');
                  form.setValue(`contactPersons.${confirmingDeselectIndex}.phone`, '');
                  form.setValue(`contactPersons.${confirmingDeselectIndex}.email`, '');
                  setConfirmingDeselectIndex(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 shadow-sm"
            >
              Clear & Uncheck
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This action **cannot be undone**. This will permanently delete the associate, their history, and all association rules from the servers.</p>
                <div className="bg-red-50 p-3 rounded-md border border-red-100 text-red-900 text-xs">
                  Please type <span className="font-bold underline">DELETE</span> below to confirm.
                </div>
                <Input
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="mt-2 border-red-200 focus:ring-red-500"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAssociateToDeleteId(null); setDeleteConfirmationText(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              disabled={isSubmitting || deleteConfirmationText !== 'DELETE'}
              className="bg-destructive hover:bg-destructive/90 shadow-sm"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Final Confirmation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* NEW RULE DIALOGS */}
      <Dialog open={isBillingRuleDialogOpen} onOpenChange={setIsBillingRuleDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-t-4 border-primary shadow-2xl">
          <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
            <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              {editingRuleIndex !== null ? 'Editing "Billing Rule"' : 'Adding New Billing Rule'}
            </DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mt-1">
              {editingRuleIndex !== null ? 'Update the details of this item.' : 'Enter the details for Billing Rule.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...currentBillingRule}>
            <form onSubmit={currentBillingRule.handleSubmit((val) => {
              if (editingRuleIndex !== null) updateBilling(editingRuleIndex, val);
              else appendBilling(val);
              setIsBillingRuleDialogOpen(false);
            })} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <FormField control={currentBillingRule.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</FormLabel><FormControl><Input placeholder="e.g., Monthly retainer fee, One-time placement fee..." className="bg-white border-2" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={currentBillingRule.control} name="applicationCondition" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">When does this apply?</FormLabel><FormControl><Textarea placeholder="e.g., Applies every month after candidate joins, or on invoice raised above ₹50,000..." className="bg-white border-2" {...field} /></FormControl></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={currentBillingRule.control} name="invoiceSource" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Invoice Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white border-2"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="Us">Us</SelectItem><SelectItem value="Associate">Associate</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={currentBillingRule.control} name="effectiveDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Effective Date</FormLabel><FormControl><Input type="date" className="bg-white border-2" {...field} /></FormControl></FormItem>
                )} />
              </div>
              {currentBillingRule.watch('invoiceSource') === 'Us' && (
                <FormField control={currentBillingRule.control} name="companyBillingType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Payment Flow</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white border-2"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Us to Customer">Us to Customer</SelectItem>
                        <SelectItem value="Us to Associate">Us to Associate</SelectItem>
                        <SelectItem value="Partially to Customer and Associate">Partially</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              )}
              </div>
              <DialogFooter className="border-t p-6 shrink-0 flex justify-end">
                <Button type="button" variant="ghost" className="font-bold text-[10px] uppercase tracking-widest" onClick={() => setIsBillingRuleDialogOpen(false)}>Discard</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase tracking-widest px-8">Confirm Rule</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCommissionRuleDialogOpen} onOpenChange={setIsCommissionRuleDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-t-4 border-primary shadow-2xl">
          <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
            <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              {editingRuleIndex !== null ? 'Editing "Commission Rule"' : 'Adding New Commission Rule'}
            </DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mt-1">
              {editingRuleIndex !== null ? 'Update the details of this item.' : 'Enter the details for Commission Rule.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...currentCommissionRule}>
            <form onSubmit={currentCommissionRule.handleSubmit((val) => {
              if (editingRuleIndex !== null) updateCommission(editingRuleIndex, val);
              else appendCommission(val);
              setIsCommissionRuleDialogOpen(false);
            })} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <FormField control={currentCommissionRule.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</FormLabel><FormControl><Input placeholder="e.g., 10% sales commission on placement, Fixed ₹5000 per closure..." className="bg-white border-2" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={currentCommissionRule.control} name="applicationCondition" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Award Criteria</FormLabel><FormControl><Textarea placeholder="e.g., Awarded when associate closes more than 3 placements in a month..." className="bg-white border-2" {...field} /></FormControl></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={currentCommissionRule.control} name="commissionType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white border-2"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="Percentage">Percentage (%)</SelectItem><SelectItem value="Fixed">Fixed Amount</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={currentCommissionRule.control} name="value" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Value</FormLabel><FormControl><Input type="number" className="bg-white border-2" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                )} />
              </div>
              <FormField control={currentCommissionRule.control} name="effectiveDate" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Effective Date</FormLabel><FormControl><Input type="date" className="bg-white border-2" {...field} /></FormControl></FormItem>
              )} />
              </div>
              <DialogFooter className="border-t p-6 shrink-0 flex justify-end">
                <Button type="button" variant="ghost" className="font-bold text-[10px] uppercase tracking-widest" onClick={() => setIsCommissionRuleDialogOpen(false)}>Discard</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase tracking-widest px-8">Confirm Split</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

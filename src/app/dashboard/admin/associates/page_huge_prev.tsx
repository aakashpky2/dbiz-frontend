'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as RHFFormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertTriangle, Handshake, Inbox, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useForm, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// Data Structures
interface BillingRule {
  description: string;
  applicationCondition: string;
  invoiceSource: 'Company' | 'Associate';
  companyBillingType?: 'Company to Customer' | 'Company to Associate' | 'Partially to Customer and Associate';
}

interface CommissionRule {
  description: string;
  commissionType: 'Percentage' | 'Fixed';
  value: number;
  applicationCondition: string;
}

interface Associate {
  id: string; // Database UUID
  name: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
  billingRules: BillingRule[];
  commissionRules: CommissionRule[];
  createdAt?: object;
  updatedAt?: object;
}

// Zod Schemas
const billingRuleSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  applicationCondition: z.string().min(1, 'Condition is required.'),
  invoiceSource: z.enum(['Company', 'Associate'], { required_error: 'Invoice source is required.' }),
  companyBillingType: z.enum(['Company to Customer', 'Company to Associate', 'Partially to Customer and Associate']).optional(),
}).refine(data => {
  if (data.invoiceSource === 'Company' && !data.companyBillingType) {
    return false;
  }
  return true;
}, {
  message: "Company billing type is required when invoice source is 'Company'.",
  path: ["companyBillingType"],
});

const commissionRuleSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  commissionType: z.enum(['Percentage', 'Fixed'], { required_error: 'Type is required.' }),
  value: z.coerce.number().min(0, 'Value must be non-negative.'),
  applicationCondition: z.string().min(1, 'Condition is required.'),
});

const associateFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  phone: z.string().regex(/^\d{10,15}$/, 'Invalid phone number (must be 10-15 digits).'),
  email: z.string().email('Invalid email address.'),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  billingRules: z.array(billingRuleSchema).optional().default([]),
  commissionRules: z.array(commissionRuleSchema).optional().default([]),
});

type AssociateFormValues = z.infer<typeof associateFormSchema>;

// Main Component
export default function AssociatesPage() {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [associateToDeleteId, setAssociateToDeleteId] = useState<string | null>(null);

  const { toast } = useToast();

  const form = useForm<AssociateFormValues>({
    resolver: zodResolver(associateFormSchema),
  });

  const { fields: commissionFields, append: appendCommission, remove: removeCommission } = useFieldArray({
    control: form.control,
    name: "commissionRules",
  });

  const { fields: billingFields, append: appendBilling, remove: removeBilling } = useFieldArray({
    control: form.control,
    name: "billingRules",
  });

  const fetchAssociates = useCallback(() => {
    setIsLoading(true);
    setError(null);

    const fetchAssociatesFn = async () => {
      try {
        const { data, error: fetchError } = await supabase.from('associates').select('*').order('name');
        if (fetchError) throw fetchError;

        if (data) {
          const associatesList: Associate[] = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            phone: item.phone,
            email: item.email,
            status: item.status,
            billingRules: item.billing_rules || [],
            commissionRules: item.commission_rules || [],
          }));
          setAssociates(associatesList);
        } else {
          setAssociates([]);
        }
      } catch (err) {
        console.error("Error fetching associates:", err);
        setError("Failed to fetch associate data.");
        toast({ title: "Error Fetching Data", description: (err as Error).message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssociatesFn();

    return () => { };
  }, [toast]);

  useEffect(() => {
    const unsubscribe = fetchAssociates();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchAssociates]);

  const handleFormSubmit: SubmitHandler<AssociateFormValues> = async (data) => {
    setIsSubmitting(true);

    const processedBillingRules = data.billingRules.map(rule => {
      if (rule.invoiceSource !== 'Company') {
        const { companyBillingType, ...rest } = rule;
        return rest;
      }
      return rule;
    });

    const dataToSave = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      status: data.status,
      billing_rules: processedBillingRules,
      commission_rules: data.commissionRules,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingAssociate) {
        const { error: updateError } = await supabase.from('associates')
          .update(dataToSave)
          .eq('id', editingAssociate.id);
        if (updateError) throw updateError;
        toast({ title: "Associate Updated", description: `"${data.name}" has been successfully updated.` });
      } else {
        const { error: insertError } = await supabase.from('associates').insert([{
          ...dataToSave,
          created_at: new Date().toISOString()
        }]);
        if (insertError) throw insertError;
        toast({ title: "Associate Added", description: `"${data.name}" has been successfully added.` });
      }
      setIsFormDialogOpen(false);
      setEditingAssociate(null);
      form.reset();
      fetchAssociates();
    } catch (err) {
      console.error("Error saving associate:", err);
      toast({ title: "Save Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddDialog = () => {
    setEditingAssociate(null);
    form.reset({
      name: '', phone: '', email: '', status: 'Active', billingRules: [], commissionRules: []
    });
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (associate: Associate) => {
    setEditingAssociate(associate);
    form.reset(associate);
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
      toast({ title: "Associate Deleted", description: "The associate has been successfully deleted." });
      setAssociateToDeleteId(null);
      fetchAssociates();
    } catch (err) {
      console.error("Error deleting associate:", err);
      toast({ title: "Delete Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Handshake className="h-7 w-7 text-primary" />
            <div>
              <CardTitle className="text-2xl">Associates</CardTitle>
              <CardDescription>Manage your sales associates, their billing, and commission rules.</CardDescription>
            </div>
          </div>
          <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Associate
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading associates...</p>
            </div>
          )}
          {error && !isLoading && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && associates.length === 0 && (
            <div className="text-center text-muted-foreground py-10 border-2 border-dashed border-muted rounded-lg">
              <Inbox className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold">No Associates Found</h3>
              <p className="mt-1 text-sm">Click "Add New Associate" to create one.</p>
            </div>
          )}
          {!isLoading && !error && associates.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {associates.map((associate) => (
                    <TableRow key={associate.id}>
                      <TableCell className="font-medium">{associate.name}</TableCell>
                      <TableCell>{associate.phone}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${associate.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {associate.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(associate)} className="hover:text-primary">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(associate.id)} className="hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingAssociate ? 'Edit Associate' : 'Add New Associate'}</DialogTitle>
            <DialogDescription>
              {editingAssociate ? `Editing details for ${editingAssociate.name}` : "Fill in the details for the new associate."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
                <h3 className="text-lg font-semibold text-primary">Personal Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Associate's full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel><FormControl><Input type="tel" placeholder="10-15 digit phone number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email <span className="text-destructive">*</span></FormLabel><FormControl><Input type="email" placeholder="associate@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />

                <Separator />
                <h3 className="text-lg font-semibold text-primary">Status</h3>
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="w-[180px]"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary">Billing Rules</h3>
                  <RHFFormDescription className="mb-3">Define rules for when and how invoices are raised.</RHFFormDescription>
                  {billingFields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No billing rules defined yet.</p>}
                  <div className="space-y-4">
                    {billingFields.map((item, index) => {
                      const watchedInvoiceSource = form.watch(`billingRules.${index}.invoiceSource`);
                      return (
                        <Card key={item.id} className="p-4 bg-muted/30 border shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">Billing Rule #{index + 1}</h4>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeBilling(index)} className="text-destructive hover:bg-destructive/10"><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
                          </div>
                          <div className="space-y-4">
                            <FormField control={form.control} name={`billingRules.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Description <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="e.g., Standard Invoicing for Enterprise" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`billingRules.${index}.applicationCondition`} render={({ field }) => (<FormItem><FormLabel>When this rule applies <span className="text-destructive">*</span></FormLabel><FormControl><Textarea placeholder="Define condition, e.g., 'For Enterprise projects', 'All sales'" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                              <FormField control={form.control} name={`billingRules.${index}.invoiceSource`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Who raises invoice? <span className="text-destructive">*</span></FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="Company">Company</SelectItem>
                                      <SelectItem value="Associate">Associate</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              {watchedInvoiceSource === 'Company' && (
                                <FormField control={form.control} name={`billingRules.${index}.companyBillingType`} render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Company Billing Type <span className="text-destructive">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select company billing type" /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="Company to Customer">Company to Customer</SelectItem>
                                        <SelectItem value="Company to Associate">Company to Associate</SelectItem>
                                        <SelectItem value="Partially to Customer and Associate">Partially to Customer and Associate</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendBilling({ description: '', applicationCondition: '', invoiceSource: 'Company', companyBillingType: 'Company to Customer' })} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Billing Rule
                  </Button>
                </div>

                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary">Commission Rules</h3>
                  <RHFFormDescription className="mb-3">Define specific rules for associate commissions. Invoicing is handled by Billing Rules.</RHFFormDescription>
                  {commissionFields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No commission rules defined yet.</p>}
                  <div className="space-y-4">
                    {commissionFields.map((item, index) => (
                      <Card key={item.id} className="p-4 bg-muted/30 border shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium">Commission Rule #{index + 1}</h4>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCommission(index)} className="text-destructive hover:bg-destructive/10"><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
                        </div>
                        <div className="space-y-4">
                          <FormField control={form.control} name={`commissionRules.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Description <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="e.g., Standard 10% on all sales" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`commissionRules.${index}.applicationCondition`} render={({ field }) => (<FormItem><FormLabel>When commission applies <span className="text-destructive">*</span></FormLabel><FormControl><Textarea placeholder="Define condition, e.g., 'On sales > 50k', 'For Enterprise projects'" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`commissionRules.${index}.commissionType`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="Percentage">Percentage</SelectItem>
                                    <SelectItem value="Fixed">Fixed</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`commissionRules.${index}.value`} render={({ field }) => (<FormItem><FormLabel>Amount/Percentage <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" placeholder="e.g., 10 or 500" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendCommission({ description: '', commissionType: 'Percentage', value: 0, applicationCondition: '' })} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Commission Rule
                  </Button>
                </div>

                <DialogFooter className="sticky bottom-0 bg-background pt-4 pb-1 border-t z-10">
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingAssociate ? 'Save Changes' : 'Add Associate'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the associate and all their defined rules.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssociateToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, AlertTriangle, CalendarDays, Inbox, PlusCircle, Edit, Trash2, CalendarIcon, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

const HolidayDialog = dynamic(() => import('./_components/HolidayDialog').then(mod => mod.HolidayDialog), { ssr: false });
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { indianStates } from '@/lib/indian-states-data';
import { PageHero } from '@/components/dashboard/page-hero';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';


interface Holiday {
  id: string;
  name: string;
  date: string; // 'yyyy-MM-dd'
  type: 'General' | 'Leave with Pay';
  employee_id?: string;
  state?: string;
  district?: string;
}

interface Employee {
  id: string;
  full_name: string;
}

interface StateData {
  value: string;
  label: string;
}

const holidayFormSchema = z.object({
  name: z.string()
    .min(3, { message: "Holiday name must be at least 3 characters long." })
    .max(100, { message: "Holiday name must be at most 100 characters." })
    .regex(/^[a-zA-Z0-9\s'.\-()&]+$/, { message: "Holiday name contains invalid characters. Only letters, numbers, spaces, and '.&()- are allowed." }),
  date: z.date({
    required_error: "A holiday date is required.",
    invalid_type_error: "Please select a valid date.",
  }),
  type: z.enum(['General', 'Leave with Pay'], {
    required_error: "Holiday type is required.",
    invalid_type_error: "Invalid holiday type selected."
  }),
  employeeId: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
});

type HolidayFormValues = z.infer<typeof holidayFormSchema>;

export default function HolidayListPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [holidayToDeleteId, setHolidayToDeleteId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [states, setStates] = useState<StateData[]>([]);

  const { toast } = useToast();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManageEmployees = hasPermission('MANAGE_EMPLOYEES');

  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: {
      name: '',
      date: new Date(),
      type: 'General',
      employeeId: '',
      state: '',
      district: '',
    },
  });

  const selectedType = form.watch('type');


  // Fetch holidays from Supabase
  const fetchHolidays = useCallback(async (showFullLoader = true) => {
    if (showFullLoader) setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

      if (fetchError) throw fetchError;

      setHolidays(
        (data || []).map((h: any) => ({
          id: h.id,
          name: h.name,
          date: h.date, // already yyyy-MM-dd from DB
          type: h.type === 'Reserved' ? 'Leave with Pay' : h.type || 'General',
          employee_id: h.employee_id,
          state: h.state,
          district: h.district,
        }))
      );
    } catch (err: any) {
      console.error("Error fetching holidays:", err);
      setError("Failed to fetch holidays. Please try again later.");
      toast({ title: "Error Fetching Holidays", description: err.message, variant: "destructive" });
    } finally {
      if (showFullLoader) setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!permLoading && !canManageEmployees) {
      toast({ title: "Access Denied", description: "You do not have permission to manage holidays.", variant: "destructive" });
      router.push('/dashboard');
      return;
    }
    if (!canManageEmployees) return;

    fetchHolidays();

    // Fetch employees for dropdown
    const fetchEmployeesData = async () => {
      const { data } = await supabase.from('employees').select('id, full_name').order('full_name');
      if (data) setEmployees(data);
    };

    // Use local indianStates data
    setStates(indianStates);

    fetchEmployeesData();
  }, [fetchHolidays, permLoading, canManageEmployees, router, toast]);

  // Add or Edit holiday
  const handleFormSubmit: SubmitHandler<HolidayFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      const holidayData = {
        name: data.name.trim(),
        date: format(data.date, 'yyyy-MM-dd'),
        type: data.type,
        employee_id: data.type === 'Leave with Pay' && data.employeeId !== 'none' ? data.employeeId || null : null,
        state: data.type === 'Leave with Pay' && data.state !== 'none' ? data.state || null : null,
        district: data.type === 'Leave with Pay' ? data.district || null : null,
      };

      // Check for duplicate date (exclude current editing holiday)
      const existingOnSameDate = holidays.find(
        (h) => h.date === holidayData.date && h.id !== editingHoliday?.id
      );
      if (existingOnSameDate) {
        toast({
          title: "Duplicate Date",
          description: `A holiday "${existingOnSameDate.name}" already exists on this date.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (editingHoliday) {
        const { data: updatedData, error: updateError } = await supabase
          .from('holidays')
          .update(holidayData)
          .eq('id', editingHoliday.id)
          .select()
          .single();
        if (updateError) throw updateError;

        // Update local state without relying on re-fetch
        setHolidays(prev => prev.map(h => h.id === editingHoliday.id ? {
          id: updatedData.id,
          name: updatedData.name,
          date: updatedData.date,
          type: updatedData.type === 'Reserved' ? 'Leave with Pay' : updatedData.type || 'General',
          employee_id: updatedData.employee_id,
          state: updatedData.state,
          district: updatedData.district,
        } : h).sort((a, b) => a.date.localeCompare(b.date)));

        toast({ title: "Holiday Updated", description: `${data.name} has been successfully updated.` });
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from('holidays')
          .insert([holidayData])
          .select()
          .single();
        if (insertError) throw insertError;

        // Update local state
        setHolidays(prev => [...prev, {
          id: insertedData.id,
          name: insertedData.name,
          date: insertedData.date,
          type: insertedData.type === 'Reserved' ? 'Leave with Pay' : insertedData.type || 'General',
          employee_id: insertedData.employee_id,
          state: insertedData.state,
          district: insertedData.district,
        }].sort((a, b) => a.date.localeCompare(b.date)));

        toast({ title: "Holiday Added", description: `${data.name} has been successfully added.` });
      }

      setIsDialogOpen(false);
      setEditingHoliday(null);
      form.reset({ name: '', date: new Date(), type: 'General', employeeId: '', state: '', district: '' });
      // Background fetch to ensure sync in case of concurrent updates
      fetchHolidays(false);
    } catch (err: any) {
      console.error("Error saving holiday:", err);
      toast({ title: "Save Failed", description: err.message || "An error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddDialog = () => {
    setEditingHoliday(null);
    form.reset({ name: '', date: new Date(), type: 'General', employeeId: '', state: '', district: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    form.reset({
      name: holiday.name,
      date: parse(holiday.date, 'yyyy-MM-dd', new Date()),
      type: holiday.type,
      employeeId: holiday.employee_id || '',
      state: holiday.state || '',
      district: holiday.district || '',
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (holidayId: string) => {
    setHolidayToDeleteId(holidayId);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!holidayToDeleteId) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from('holidays')
        .delete()
        .eq('id', holidayToDeleteId);
      if (deleteError) throw deleteError;

      // Update local state immediately
      setHolidays(prev => prev.filter(h => h.id !== holidayToDeleteId));

      toast({ title: "Holiday Deleted", description: "The holiday has been successfully deleted." });
      setHolidayToDeleteId(null);
      fetchHolidays(false);
    } catch (err: any) {
      console.error("Error deleting holiday:", err);
      toast({ title: "Delete Failed", description: err.message || "An error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (permLoading || (isLoading && holidays.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Loading holidays...</p>
      </div>
    );
  }

  if (!canManageEmployees) return null;

    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-1"
                icon={CalendarDays}
                badge="EMPLOYEE MANAGEMENT"
                title="Holiday Register"
                description="View and manage official company holidays and regional observances."
            >
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchHolidays()} className="h-9 px-3 font-bold border-muted-foreground/20">
                        <RefreshCw className="h-4 w-4 mr-2" /> Reload
                    </Button>
                    <Button onClick={openAddDialog} className="h-9 px-4 font-bold">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Holiday
                    </Button>
                </div>
            </PageHero>

            <Card className="shadow-sm border">
                <CardHeader className="py-4 border-b border-border/50 bg-muted/5">
                    <CardTitle className="text-lg font-bold">Holiday List</CardTitle>
                </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!error && holidays.length === 0 && !isLoading ? (
            <div className="text-center text-muted-foreground py-10 border-2 border-dashed border-muted rounded-lg">
              <Inbox className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold">No Holidays Found</h3>
              <p className="mt-1 text-sm">Click &quot;Add New Holiday&quot; to create one.</p>
            </div>
          ) : !error && holidays.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4 w-[60px] text-center">#</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4">Date</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4">Day</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4">Holiday Name</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4">Type</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[11px] py-4 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday, index) => {
                    const holidayDate = parse(holiday.date, 'yyyy-MM-dd', new Date());
                    return (
                      <TableRow key={holiday.id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors group">
                        <TableCell className="py-4 text-center">
                          <span className="text-[11px] font-bold text-slate-400">{(index + 1).toString().padStart(2, '0')}</span>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {format(holidayDate, 'dd MMM yyyy')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-4">
                          <span className="text-sm font-medium text-slate-600">{format(holidayDate, 'EEEE')}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm font-bold text-slate-800">{holiday.name}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1.5 mt-0.5">
                            <span
                              className={`px-2.5 py-1 text-[10px] rounded-md font-bold uppercase tracking-wider w-fit shadow-sm border ${holiday.type === 'General'
                                ? 'bg-indigo-50/50 text-indigo-700 border-indigo-200/60'
                                : 'bg-fuchsia-50/50 text-fuchsia-700 border-fuchsia-200/60'
                                }`}
                            >
                              {holiday.type}
                            </span>
                            {holiday.type === 'Leave with Pay' && (
                              <span className="text-[10px] text-slate-500 font-medium italic">
                                {holiday.employee_id ? `Target: ${employees.find(e => e.id === holiday.employee_id)?.full_name || 'Specific Employee'}` :
                                  holiday.state ? `Region: ${holiday.state}${holiday.district ? `, ${holiday.district}` : ''}` :
                                    'Scope: Global'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4 pr-6 space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(holiday)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(holiday.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
                </CardContent>
            </Card>

      <HolidayDialog
        isDialogOpen={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
        editingHoliday={editingHoliday}
        setEditingHoliday={setEditingHoliday}
        form={form}
        handleFormSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
        employees={employees}
        states={states}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the holiday
              from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHolidayToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

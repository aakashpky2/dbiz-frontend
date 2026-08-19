'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Clock, Search, Loader2, Coins, CalendarDays, KeyRound, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, RefreshCw, Settings2 } from "lucide-react";
import { PageHero } from '@/components/dashboard/page-hero';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/ui/page-skeleton';

// Shift Template schema
const shiftSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    workingDays: z.array(z.string()).min(1, "Must select at least one working day."),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
});

type ShiftFormValues = z.infer<typeof shiftSchema>;

// Zod Schema for the Employment Config Form
const assignmentSchema = z.object({
    employeeRole: z.string().min(2, "Role must be at least 2 characters."),
    monthlySalary: z.coerce.number().min(0, "Salary cannot be negative."),
    casualLeavesPerMonth: z.coerce.number().min(0, "Leaves cannot be negative.").default(1),
    sickLeavesPerMonth: z.coerce.number().min(0, "Leaves cannot be negative.").default(1),
    workingDays: z.array(z.string()).min(1, "Must select at least one working day."),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

// Employee ID Config schema
const idConfigSchema = z.object({
    prefix: z.string().regex(/^[A-Za-z]+$/, "Only alphabets allowed").min(1, "Prefix is required"),
    digitCount: z.coerce.number().min(1, "Min 1 digit").max(10, "Max 10 digits"),
    suffix: z.string().regex(/^[A-Za-z]*$/, "Only alphabets allowed").optional(),
});

type IdConfigFormValues = z.infer<typeof idConfigSchema>;

const DAYS_OF_WEEK = [
    { id: 'monday', label: 'Monday' },
    { id: 'tuesday', label: 'Tuesday' },
    { id: 'wednesday', label: 'Wednesday' },
    { id: 'thursday', label: 'Thursday' },
    { id: 'friday', label: 'Friday' },
    { id: 'saturday', label: 'Saturday' },
    { id: 'sunday', label: 'Sunday' },
];

export default function EmploymentConfigurationsPage() {
    const [activeTab, setActiveTab] = useState('employees');
    const [employees, setEmployees] = useState<any[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isShiftsLoading, setIsShiftsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedShiftId, setSelectedShiftId] = useState<string>('custom');
    const [isCreatingShift, setIsCreatingShift] = useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
    const [idConfig, setIdConfig] = useState<any | null>(null);
    const [isIdConfigLoading, setIsIdConfigLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmittingShift, setIsSubmittingShift] = useState(false);
    const [isSubmittingIdConfig, setIsSubmittingIdConfig] = useState(false);

    const { toast } = useToast();
    const router = useRouter();
    const { hasPermission, loading: permLoading } = usePermissions();
    const canManageEmployees = hasPermission('MANAGE_EMPLOYEES');

    const shiftForm = useForm<ShiftFormValues>({
        resolver: zodResolver(shiftSchema),
        defaultValues: {
            name: '',
            workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            startTime: '09:00',
            endTime: '17:30',
        }
    });

    const form = useForm<AssignmentFormValues>({
        resolver: zodResolver(assignmentSchema),
        defaultValues: {
            employeeRole: '',
            monthlySalary: 0,
            casualLeavesPerMonth: 1,
            sickLeavesPerMonth: 1,
            workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            startTime: '09:30',
            endTime: '17:30',
        }
    });

    const idConfigForm = useForm<IdConfigFormValues>({
        resolver: zodResolver(idConfigSchema),
        defaultValues: {
            prefix: '',
            digitCount: 4,
            suffix: '',
        }
    });

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            // Fetch employees and outer join their employment details (if they exist)
            // Since employee_employment_details has a fk to employees
            const { data, error } = await supabase
                .from('employees')
                .select(`
          id, 
          full_name, 
          email, 
          photo_url, 
          employee_role, 
          monthly_salary,
          employee_id_hash,
          employee_employment_details (
            id,
            monthly_salary,
            casual_leaves_per_month,
            sick_leaves_per_month,
            start_time,
            end_time,
            working_days,
            employee_role
          )
        `)
                .order('full_name');

            if (error) throw error;

            // Cleanup the joined data structure for easier UI parsing
            const processedData = (data || []).map(emp => {
                const details = emp.employee_employment_details && emp.employee_employment_details.length > 0
                    ? emp.employee_employment_details[0]
                    : null;

                return {
                    ...emp,
                    hasConfig: !!details,
                    details
                };
            });

            setEmployees(processedData);
        } catch (error: any) {
            console.error("Error fetching employees:", error);
            toast({
                title: "Fetch Error",
                description: "Failed to load employees for configuration.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!permLoading && !canManageEmployees) {
            toast({ title: "Access Denied", description: "You do not have permission to manage employee configurations.", variant: "destructive" });
            router.push('/dashboard');
            return;
        }
        if (canManageEmployees) {
            fetchEmployees();
            fetchShiftTemplates();
            fetchIdConfig(); // Load existing ID config
        }
    }, [permLoading, canManageEmployees, router, toast]);

    const fetchIdConfig = async () => {
        setIsIdConfigLoading(true);
        try {
            const response = await fetch('/api/employee-configs/id-format');
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    setIdConfig(data);
                    idConfigForm.reset({
                        prefix: data.prefix,
                        digitCount: data.digit_count,
                        suffix: data.suffix || '',
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching ID config:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsIdConfigLoading(false);
        }
    };

    const onIdConfigSubmit = async (values: IdConfigFormValues) => {
        setIsSubmittingIdConfig(true);
        try {
            const response = await fetch('/api/employee-configs/id-format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prefix: values.prefix.toUpperCase(),
                    digit_count: values.digitCount,
                    suffix: values.suffix?.toUpperCase() || null,
                }),
            });

            if (!response.ok) throw new Error('Failed to save configuration');

            const data = await response.json();
            setIdConfig(data);
            toast({ title: "Configuration Saved", description: "Employee ID format has been updated." });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmittingIdConfig(false);
        }
    };

    const fetchShiftTemplates = async () => {
        setIsShiftsLoading(true);
        try {
            const { data, error } = await supabase.from('shift_templates').select('*').order('name');
            if (error) throw error;
            setShiftTemplates(data || []);
        } catch (error: any) {
            console.error("Error fetching shifts:", error);
            // Non-critical if table doesn't exist yet
        } finally {
            setIsShiftsLoading(false);
        }
    };

    const openAssignmentDialog = (employee: any) => {
        setSelectedEmployee(employee);
        const existingDetails = employee.details;

        // Pre-fill form if they already have configurations.
        // Otherwise rely on defaults from employees original profile if missing from detailed config
        form.reset({
            employeeRole: existingDetails?.employee_role || employee.employee_role || '',
            monthlySalary: existingDetails?.monthly_salary ? Number(existingDetails.monthly_salary) : (employee.monthly_salary ? Number(employee.monthly_salary) : 0),
            casualLeavesPerMonth: existingDetails?.casual_leaves_per_month !== undefined && existingDetails?.casual_leaves_per_month !== null ? Number(existingDetails.casual_leaves_per_month) : 1,
            sickLeavesPerMonth: existingDetails?.sick_leaves_per_month !== undefined && existingDetails?.sick_leaves_per_month !== null ? Number(existingDetails.sick_leaves_per_month) : 1,
            workingDays: existingDetails?.working_days && existingDetails.working_days.length > 0 ? existingDetails.working_days : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            startTime: existingDetails?.start_time ? existingDetails.start_time.substring(0, 5) : '09:30', // Ensure HH:MM format
            endTime: existingDetails?.end_time ? existingDetails.end_time.substring(0, 5) : '17:30', // Ensure HH:MM format
        });

        setSelectedShiftId('custom');
        setIsDialogOpen(true);
    };

    const handleShiftSelection = (shiftId: string) => {
        setSelectedShiftId(shiftId);
        if (shiftId === 'custom') return;

        const template = shiftTemplates.find(s => s.id === shiftId);
        if (template) {
            form.setValue('workingDays', template.working_days);
            form.setValue('startTime', template.start_time.substring(0, 5));
            form.setValue('endTime', template.end_time.substring(0, 5));
        }
    };

    const onShiftSubmit = async (values: ShiftFormValues) => {
        setIsSubmittingShift(true);
        try {
            const { error } = await supabase.from('shift_templates').insert([{
                name: values.name,
                working_days: values.workingDays,
                start_time: `${values.startTime}:00`,
                end_time: `${values.endTime}:00`
            }]);

            if (error) throw error;

            await fetchShiftTemplates();
            toast({ title: "Template Created", description: `Shift "${values.name}" has been saved.` });
            setIsCreatingShift(false);
            shiftForm.reset();
        } catch (err: any) {
            console.error("Failed to create shift:", err);
            toast({
                title: "Failed",
                description: err.message || "Ensure you have created the shift_templates table first!",
                variant: "destructive"
            });
        } finally {
            setIsSubmittingShift(false);
        }
    };

    const deleteShift = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the ${name} shift template?`)) return;
        try {
            const { error } = await supabase.from('shift_templates').delete().eq('id', id);
            if (error) throw error;
            await fetchShiftTemplates();
            toast({ title: "Deleted", description: "Shift template removed." });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };

    const onSubmit = async (values: AssignmentFormValues) => {
        if (!selectedEmployee) return;
        setIsSubmitting(true);

        try {
            // We will perform two operations here:
            // 1. Upsert the detailed config into `employee_employment_details`
            // 2. Sync `monthly_salary` and `employee_role` back into the main `employees` table just in case other modules depend on it directly.

            const detailsPayload = {
                employee_id: selectedEmployee.id,
                employee_role: values.employeeRole,
                monthly_salary: values.monthlySalary,
                casual_leaves_per_month: values.casualLeavesPerMonth,
                sick_leaves_per_month: values.sickLeavesPerMonth,
                working_days: values.workingDays,
                start_time: `${values.startTime}:00`, // Store as TIME format HH:MM:SS
                end_time: `${values.endTime}:00`
            };

            // Check if detail record exists to update vs insert.
            if (selectedEmployee.hasConfig) {
                const { error: updateDetailError } = await supabase
                    .from('employee_employment_details')
                    .update(detailsPayload)
                    .eq('employee_id', selectedEmployee.id);
                if (updateDetailError) throw updateDetailError;
            } else {
                const { error: insertDetailError } = await supabase
                    .from('employee_employment_details')
                    .insert([detailsPayload]);
                if (insertDetailError) throw insertDetailError;
            }

            // Sync role and salary to primary employee table
            const { error: syncError } = await supabase
                .from('employees')
                .update({
                    employee_role: values.employeeRole,
                    monthly_salary: values.monthlySalary
                })
                .eq('id', selectedEmployee.id);

            if (syncError) throw syncError;

            toast({
                title: "Successfully Assigned",
                description: `Employment configuration updated for ${selectedEmployee.full_name}.`,
            });

            await fetchEmployees(); // Refresh list to reflect badge changes
            setIsDialogOpen(false);
        } catch (err: any) {
            console.error("Failed to save assignment:", err);
            toast({
                title: "Save Failed",
                description: err.message || "An unexpected error occurred while saving.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employee_role?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (permLoading || (isLoading && employees.length === 0)) {
        return (
            <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-sky-600" />
                <p className="text-slate-500 animate-pulse font-medium">Loading employment configurations...</p>
            </div>
        );
    }

    if (!canManageEmployees) return null;

    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-2"
                icon={Settings2}
                badge="EMPLOYEE CONFIGURATION"
                title="Employment Configurations"
                description="Manage shift patterns, contract terms, salaries, and assign employment configurations to registered employees."
            >
                <Button variant="outline" size="sm" onClick={fetchEmployees} className="h-9 px-3 font-bold border-muted-foreground/20">
                    <RefreshCw className="h-4 w-4 mr-2" /> Reload Data
                </Button>
            </PageHero>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-[600px] grid-cols-3 rounded-xl h-12 bg-muted/60 p-1 border">
                    <TabsTrigger value="employees" className="flex items-center gap-2 rounded-lg data-[state=active]:shadow-sm">
                        <UserPlus className="w-4 h-4" /> Assignments
                    </TabsTrigger>
                    <TabsTrigger value="shifts" className="flex items-center gap-2 rounded-lg data-[state=active]:shadow-sm">
                        <Clock className="w-4 h-4" /> Shift Templates
                    </TabsTrigger>
                    <TabsTrigger value="id-config" className="flex items-center gap-2 rounded-lg data-[state=active]:shadow-sm">
                        <KeyRound className="w-4 h-4" /> ID Format
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="employees" className="mt-6 space-y-6">
                    <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl">Employee Assignments</CardTitle>
                                    <CardDescription>
                                        Select an employee to assign their specific role, salary, shift, and leave allowances.
                                    </CardDescription>
                                </div>
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Search employees..."
                                        className="pl-9 h-10 w-full"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (<div className="p-6"><PageSkeleton /></div>) : filteredEmployees.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                    <Briefcase className="w-10 h-10 text-slate-300 mb-4" />
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Employees Found</h3>
                                    <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
                                        Try adjusting your search query, or add a new employee first if the directory is empty.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredEmployees.map((emp) => (
                                        <div
                                            key={emp.id}
                                            className="group flex flex-col justify-between p-4 border rounded-xl hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-slate-900 transition-all shadow-sm bg-card hover:shadow-md h-full"
                                        >
                                            <div className="flex items-start gap-3">
                                                <Avatar className="h-12 w-12 border-2 border-slate-100">
                                                    <AvatarImage src={emp.photo_url || ''} />
                                                    <AvatarFallback className="bg-primary/5 text-primary">
                                                        {emp.full_name?.charAt(0) || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-semibold text-slate-900 dark:text-white truncate" title={emp.full_name}>
                                                        {emp.full_name}
                                                    </h4>
                                                    <p className="text-sm text-slate-500 truncate" title={emp.email}>
                                                        {emp.email} {emp.employee_id_hash && <span className="text-xs font-mono ml-1 text-slate-400">({emp.employee_id_hash})</span>}
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {emp.hasConfig ? (
                                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 font-medium">
                                                                Configured
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 font-medium">
                                                                Pending Config
                                                            </Badge>
                                                        )}
                                                        {emp.employee_role && (
                                                            <span className="inline-flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]" title={emp.employee_role}>
                                                                {emp.employee_role}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-5 w-full">
                                                <Button
                                                    onClick={() => openAssignmentDialog(emp)}
                                                    variant={emp.hasConfig ? "outline" : "default"}
                                                    size="sm"
                                                    className="w-full font-medium"
                                                >
                                                    {emp.hasConfig ? 'Edit Configuration' : 'Assign Configuration'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="shifts" className="mt-6">
                    <Card className="border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Shift Templates</CardTitle>
                                <CardDescription>
                                    Create predefined working hours and days that you can quickly assign to employees.
                                </CardDescription>
                            </div>
                            <Button onClick={() => setIsCreatingShift(!isCreatingShift)} variant={isCreatingShift ? "outline" : "default"}>
                                {isCreatingShift ? "Cancel View" : <><Plus className="w-4 h-4 mr-2" /> Add Shift</>}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isCreatingShift ? (
                                <div className="p-6 border rounded-xl bg-slate-50/50 mb-6 animate-in slide-in-from-top-2">
                                    <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Create New Shift Template</h3>
                                    <Form {...shiftForm}>
                                        <form onSubmit={shiftForm.handleSubmit(onShiftSubmit)} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <FormField control={shiftForm.control} name="name" render={({ field }) => (
                                                    <FormItem className="md:col-span-1">
                                                        <FormLabel>Shift Name</FormLabel>
                                                        <FormControl><Input placeholder="e.g. Morning Shift" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={shiftForm.control} name="startTime" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Start Time</FormLabel>
                                                        <FormControl><Input type="time" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={shiftForm.control} name="endTime" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>End Time</FormLabel>
                                                        <FormControl><Input type="time" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <FormField control={shiftForm.control} name="workingDays" render={() => (
                                                <FormItem>
                                                    <FormLabel>Active Working Days</FormLabel>
                                                    <div className="flex flex-wrap gap-3">
                                                        {DAYS_OF_WEEK.map((day) => (
                                                            <FormField key={day.id} control={shiftForm.control} name="workingDays" render={({ field }) => (
                                                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 bg-white dark:bg-slate-950 px-3 py-2 border rounded-md shadow-sm">
                                                                    <FormControl>
                                                                        <Checkbox
                                                                            checked={field.value?.includes(day.id)}
                                                                            onCheckedChange={(checked) => checked ? field.onChange([...field.value, day.id]) : field.onChange(field.value?.filter((value) => value !== day.id))}
                                                                        />
                                                                    </FormControl>
                                                                    <FormLabel className="text-sm cursor-pointer font-medium leading-none">{day.label}</FormLabel>
                                                                </FormItem>
                                                            )} />
                                                        ))}
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <Button type="submit" disabled={isSubmittingShift}>
                                                {isSubmittingShift && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Template
                                            </Button>
                                        </form>
                                    </Form>
                                </div>
                            ) : null}

                            {!isShiftsLoading && shiftTemplates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                    <CalendarDays className="w-12 h-12 text-slate-300 mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Shift Templates</h3>
                                    <p className="text-center text-sm text-slate-500 mt-2 max-w-[400px]">
                                        Create reusable templates to quickly assign to multiple employees.
                                    </p>
                                    <Alert className="max-w-[450px] mt-6 bg-blue-50/50 border-blue-200 text-blue-800">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle className="text-blue-900 font-semibold mb-1">Database Requirement</AlertTitle>
                                        <AlertDescription className="text-blue-800/80">
                                            Make sure you have created the <code>shift_templates</code> table in your Supabase SQL editor using the provided script before adding templates.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {shiftTemplates.map((shift) => (
                                        <div key={shift.id} className="p-5 border rounded-xl shadow-sm bg-card flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-lg text-primary">{shift.name}</h4>
                                                    <Badge variant="outline" className="bg-slate-50">{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-3">
                                                    {shift.working_days.map((d: string) => (
                                                        <span key={d} className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">{d.substring(0, 3)}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => deleteShift(shift.id, shift.name)} className="mt-4 text-destructive hover:bg-destructive/10 hover:text-destructive w-fit ml-auto">
                                                <Trash2 className="w-4 h-4 mr-1" /> Delete
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="id-config" className="mt-6">
                    <Card className="border shadow-sm max-w-3xl">
                        <CardHeader>
                            <CardTitle>Employee ID Configuration</CardTitle>
                            <CardDescription>
                                Define how employee IDs are generated for your company. Each company can have only one format.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...idConfigForm}>
                                <form onSubmit={idConfigForm.handleSubmit(onIdConfigSubmit)} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <FormField
                                            control={idConfigForm.control}
                                            name="prefix"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Prefix <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. EMP" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                                                    </FormControl>
                                                    <FormDescription>Letters only.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={idConfigForm.control}
                                            name="digitCount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Digit Count <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="1" max="10" {...field} />
                                                    </FormControl>
                                                    <FormDescription>1 to 10 digits.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={idConfigForm.control}
                                            name="suffix"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Suffix</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. IN" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                                                    </FormControl>
                                                    <FormDescription>Optional letters.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Live Preview */}
                                    <div className="p-6 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                                            <RefreshCw className="w-3 h-3" /> Live ID Preview
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl font-mono font-bold tracking-widest text-primary">
                                                {idConfigForm.watch('prefix') || '---'}
                                                {String(1).padStart(idConfigForm.watch('digitCount') || 4, '0')}
                                                {idConfigForm.watch('suffix') || ''}
                                            </div>
                                            <Badge variant="outline" className="bg-white">Sample ID</Badge>
                                        </div>
                                    </div>

                                    <Button type="submit" className="min-w-[200px]" disabled={isSubmittingIdConfig}>
                                        {isSubmittingIdConfig && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        {idConfig ? 'Update Configuration' : 'Save Configuration'}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Configuration Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col overflow-hidden">
                    <DialogHeader className="border-b pb-4 shrink-0">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-primary" />
                            Configure Employment Details
                        </DialogTitle>
                        <DialogDescription>
                            Assign salary, working hours, and terms for <strong>{selectedEmployee?.full_name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-1 -mx-1">
                        <Form {...form}>
                            <form id="config-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">

                            {/* Core Details Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="employeeRole"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-semibold text-slate-700">Official Role / Job Title</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <Input placeholder="e.g. Senior Accountant" className="pl-9" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="monthlySalary"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-semibold text-slate-700">Monthly Salary (₹)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                                    <Input type="number" placeholder="50000" min="0" className="pl-9 border-emerald-200 focus-visible:ring-emerald-500" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <hr className="border-slate-100" />

                            {/* Schedule Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-primary" /> Work Schedule
                                    </h4>

                                    {/* Shift Selection */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-500">Apply Template:</span>
                                        <Select value={selectedShiftId} onValueChange={handleShiftSelection}>
                                            <SelectTrigger className="w-[180px] h-8 text-xs">
                                                <SelectValue placeholder="Custom Shift" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="custom">Custom Configuration</SelectItem>
                                                {shiftTemplates.map(shift => (
                                                    <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border transition-colors ${selectedShiftId !== 'custom' ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-slate-100'}`}>
                                    <FormField
                                        control={form.control}
                                        name="startTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Shift Start Time</FormLabel>
                                                <FormControl>
                                                    <Input type="time" className="bg-white max-w-[150px]" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="endTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Shift End Time</FormLabel>
                                                <FormControl>
                                                    <Input type="time" className="bg-white max-w-[150px]" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Working Days Checkboxes */}
                                    <FormField
                                        control={form.control}
                                        name="workingDays"
                                        render={() => (
                                            <FormItem className="sm:col-span-2 pt-2">
                                                <div className="mb-3">
                                                    <FormLabel>Active Working Days</FormLabel>
                                                    <FormDescription>Select the exact days this employee works every week.</FormDescription>
                                                </div>
                                                <div className="flex flex-wrap gap-4">
                                                    {DAYS_OF_WEEK.map((day) => (
                                                        <FormField
                                                            key={day.id}
                                                            control={form.control}
                                                            name="workingDays"
                                                            render={({ field }) => {
                                                                return (
                                                                    <FormItem
                                                                        key={day.id}
                                                                        className="flex flex-row items-center space-x-2 space-y-0 bg-white dark:bg-slate-950 px-3 py-2 border rounded-md shadow-sm"
                                                                    >
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value?.includes(day.id)}
                                                                                onCheckedChange={(checked) => {
                                                                                    return checked
                                                                                        ? field.onChange([...field.value, day.id])
                                                                                        : field.onChange(
                                                                                            field.value?.filter(
                                                                                                (value) => value !== day.id
                                                                                            )
                                                                                        )
                                                                                }}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-sm cursor-pointer font-medium leading-none">
                                                                            {day.label}
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                )
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Leave Allowance */}
                            <div className="space-y-4 pt-2">
                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-500" /> Leave Allowances (Monthly)
                                </h4>
                                <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                                    <FormField
                                        control={form.control}
                                        name="casualLeavesPerMonth"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Casual Leaves</FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="0" step="0.5" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sickLeavesPerMonth"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Sick Leaves</FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="0" step="0.5" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            </form>
                        </Form>
                    </div>

                    <DialogFooter className="border-t pt-4 mt-4 shrink-0 flex gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="ghost" className="flex-1" disabled={isSubmitting}>Cancel</Button>
                        </DialogClose>
                        <Button form="config-form" type="submit" className="flex-1 font-bold" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save Assignment
                        </Button>
                    </DialogFooter>

                </DialogContent>
            </Dialog>
        </div>
    );
}

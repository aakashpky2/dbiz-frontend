"use client";
import { DynamicFieldsSection } from '@/components/dashboard/recruitment/dynamic-fields-section';


import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Edit, PlusCircle, Loader2, BriefcaseBusiness, MapPin, Users, IndianRupee, Clock, Target, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { SearchableMasterDropdown } from "@/components/dashboard/recruitment/searchable-master-dropdown";
import { DepartmentDropdown } from "@/components/dashboard/recruitment/department-dropdown";
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { fetchWithCache } from "@/lib/fetcher";

// Rich Text Editor
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

export interface JobOpening {
    id: string;
    title: string;
    department: string;
    employment_type: string;
    location: string;
    experience: string;
    salary_range: string;
    description: string;
    skills: string;
    deadline: string;
    status: "Open" | "Closed" | "Hiring In Progress" | "Hiring Goal Reached";
    dynamic_fields?: Record<string, any>;
    created_at?: string;
    applicants_count?: number;
    required_candidates?: number;
    selected_candidates_count?: number;
    // New fields from migration
    min_experience?: number;
    max_experience?: number;
    min_salary?: number;
    max_salary?: number;
    currency?: string;
    job_description_rich?: string;
}

const formSchema = z.object({
    title: z.string().min(2, "Job title is required"),
    department: z.string().min(2, "Department is required"),
    employment_type: z.string().min(1, "Employment type is required"),
    location: z.string().min(2, "Location is required"),
    required_candidates: z.coerce.number().min(1, "Please enter the number of candidates required for this position."),
    min_experience: z.coerce.number().min(0, "Minimum experience is required"),
    max_experience: z.coerce.number().min(0, "Maximum experience is required"),
    min_salary: z.coerce.number().optional().nullable(),
    max_salary: z.coerce.number().optional().nullable(),
    currency: z.string().default("INR"),
    description: z.string().min(10, "Job description must be at least 10 characters"),
    job_description_rich: z.string().optional(),
    skills: z.array(z.string()).min(1, "At least one skill is required"),
    deadline: z.string().refine((val) => {
        if (!val) return false;
        const selectedDate = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate >= today;
    }, { message: "Application Deadline cannot be earlier than today" }),
    status: z.enum(['Open', 'Closed', 'Hiring In Progress', 'Hiring Goal Reached']).default('Open'),
    dynamic_fields: z.record(z.any()).optional(),
}).refine((data) => data.max_experience >= data.min_experience, {
    message: "Max experience cannot be less than min experience",
    path: ["max_experience"],
});

type FormValues = z.infer<typeof formSchema>;

export default function JobOpeningsPage() {
    const [jobs, setJobs] = useState<JobOpening[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<JobOpening | null>(null);
    const [dialogResetKey, setDialogResetKey] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const canManageJobs = hasPermission("MANAGE_RECRUITMENT");

    const todayStr = new Date().toISOString().split('T')[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            department: "",
            employment_type: "Full-time",
            location: "",
            required_candidates: 1,
            min_experience: 0,
            max_experience: 1,
            min_salary: null,
            max_salary: null,
            currency: "INR",
            description: "",
            job_description_rich: "",
            skills: [],
            deadline: "",
            status: "Open",
            dynamic_fields: {},
        },
    });

    const fetchJobs = async () => {
        setIsLoading(true);
        try {
            const data = await fetchWithCache('/api/job-openings');
            setJobs(data || []);
        } catch (err: any) {
            toast({ title: "Failed to fetch jobs", description: err.message || "An error occurred", variant: "destructive" });
            setJobs([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    
    const onSubmitError = (errors: any) => {
        console.warn("[RECRUITMENT_VALIDATION]", errors);
        toast({ title: "Validation Error", description: "Please complete the required fields.", variant: "destructive" });

        if (errors.description) {
            toast({ title: "Validation Error", description: "Please enter a valid job description.", variant: "destructive" });
        }
    };

    const handleOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingJob(null);
            setDialogResetKey(prev => prev + 1);
        }
    };

    const onSubmit = async (data: FormValues) => {
        console.log("[RECRUITMENT_DEBUG] onSubmit entered", data);
        setIsSubmitting(true);
        try {
            // Prepare data for DB
            const dbData = {
                title: data.title,
                department: data.department,
                employment_type: data.employment_type,
                location: data.location,
                required_candidates: data.required_candidates,
                min_experience: data.min_experience,
                max_experience: data.max_experience,
                experience: `${data.min_experience}-${data.max_experience} Years`,
                min_salary: data.min_salary,
                max_salary: data.max_salary,
                currency: data.currency,
                salary_range: data.min_salary && data.max_salary ? `${data.currency} ${data.min_salary} - ${data.max_salary}` : data.min_salary ? `Min ${data.currency} ${data.min_salary}` : "",
                description: data.description,
                job_description_rich: data.job_description_rich || data.description,
                skills: data.skills.join(", "),
                deadline: data.deadline,
                status: data.status,
                dynamic_fields: data.dynamic_fields || {},
            };

            if (editingJob) {
                const { error } = await supabase.from('job_openings').update(dbData).eq('id', editingJob.id);
                if (error) throw error;
                toast({ title: "Success", description: "Job opening updated." });
            } else {
                const { error } = await supabase.from('job_openings').insert([{ ...dbData, applicants_count: 0, selected_candidates_count: 0 }]);
                if (error) throw error;
                toast({ title: "Success", description: "Job opening created." });
            }
            setIsDialogOpen(false);
            fetchJobs();
        } catch (err: any) {
            toast({ title: "Save Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openAdd = () => {
        setEditingJob(null);
        form.reset({
            title: "",
            department: "",
            employment_type: "Full-time",
            location: "",
            min_experience: 0,
            max_experience: 1,
            min_salary: null,
            max_salary: null,
            currency: "INR",
            description: "",
            job_description_rich: "",
            skills: [],
            deadline: "",
            status: "Open",
            dynamic_fields: {},
        });
        setIsDialogOpen(true);
    };

    const openEdit = (job: JobOpening) => {
        setEditingJob(job);
        // Map back from DB string fields if necessary
        const skillArray = job.skills ? job.skills.split(", ").filter(s => s) : [];

        form.reset({
            title: job.title,
            department: job.department,
            employment_type: job.employment_type,
            location: job.location,
            min_experience: job.min_experience || 0,
            max_experience: job.max_experience || 1,
            min_salary: job.min_salary || null,
            max_salary: job.max_salary || null,
            currency: job.currency || "INR",
            description: job.description || "",
            job_description_rich: job.job_description_rich || job.description || "",
            skills: skillArray,
            deadline: job.deadline,
            status: job.status as any,
            dynamic_fields: job.dynamic_fields || {},
        });
        setIsDialogOpen(true);
    };

    const handleCloseJob = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to close the job opening for ${title}?`)) return;
        try {
            const { error } = await supabase.from('job_openings').update({ status: 'Closed' }).eq('id', id);
            if (error) throw error;
            toast({ title: "Job Closed", description: `${title} status updated.` });
            fetchJobs();
        } catch (err: any) {
            toast({ title: "Action Failed", description: err.message, variant: "destructive" });
        }
    }

    const getHiringStatus = (job: JobOpening) => {
        if (job.status === 'Closed') return 'Closed';
        const required = job.required_candidates || 1;
        const selected = job.selected_candidates_count || 0;

        if (selected >= required) return 'Hiring Goal Reached';
        if (selected > 0) return 'Hiring In Progress';
        return 'Open';
    };

    const getStatusBadge = (job: JobOpening) => {
        const status = getHiringStatus(job);
        switch (status) {
            case 'Hiring Goal Reached':
                return <Badge className="bg-green-600 hover:bg-green-700 font-bold px-3">Goal Reached</Badge>;
            case 'Hiring In Progress':
                return <Badge className="bg-blue-600 hover:bg-blue-700 font-bold px-3">In Progress</Badge>;
            case 'Closed':
                return <Badge variant="secondary" className="font-bold px-3">Closed</Badge>;
            default:
                return <Badge className="bg-slate-600 hover:bg-slate-700 font-bold px-3">Open</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Job Management"
                description="Manage your company's career opportunities and hiring pipeline."
            >
                <Button onClick={openAdd} className="font-bold">
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Job Opening
                </Button>
            </DashboardPageHeader>

            {jobs.some(j => j.status !== 'Closed' && (j.selected_candidates_count || 0) >= (j.required_candidates || 1)) && (
                <Card className="bg-amber-50 border-amber-200 shadow-lg animate-pulse">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-amber-700">
                            <Target className="h-5 w-5" />
                            <CardTitle className="text-lg">Hiring Goals Reached</CardTitle>
                        </div>
                        <CardDescription className="text-amber-600">
                            The following positions have met their candidate requirements. Please review and close them if no further hiring is needed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc list-inside space-y-1">
                            {jobs.filter(j => j.status !== 'Closed' && (j.selected_candidates_count || 0) >= (j.required_candidates || 1)).map(j => (
                                <li key={j.id} className="text-sm font-bold text-amber-800">
                                    {j.title} ({j.selected_candidates_count}/{j.required_candidates} selected)
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Jobs Open</CardTitle>
                        <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{jobs.filter(j => j.status === 'Open').length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Candidates Selected</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{jobs.reduce((acc, j) => acc + (j.selected_candidates_count || 0), 0)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Goal</CardTitle>
                        <Target className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{jobs.reduce((acc, j) => acc + (j.required_candidates || 0), 0)}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="font-bold py-4">Job Details</TableHead>
                                    <TableHead className="font-bold">Required / Selected</TableHead>
                                    <TableHead className="font-bold">Hiring Progress</TableHead>
                                    <TableHead className="font-bold">Deadline</TableHead>
                                    <TableHead className="font-bold">Status</TableHead>
                                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                                            Loading jobs...
                                        </TableCell>
                                    </TableRow>
                                ) : jobs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No job openings found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    jobs.map((job) => {
                                        const required = job.required_candidates || 1;
                                        const selected = job.selected_candidates_count || 0;
                                        const progress = Math.min((selected / required) * 100, 100);
                                        const isGoalReached = selected >= required;

                                        return (
                                            <TableRow key={job.id} className="hover:bg-primary/5 transition-colors">
                                                <TableCell className="py-4">
                                                    <div className="font-bold text-lg text-foreground">{job.title}</div>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider py-0 px-2 bg-background border-primary/20">
                                                            <Clock className="w-3 h-3 mr-1" /> {job.employment_type}
                                                        </Badge>
                                                        <div className="flex items-center text-xs text-muted-foreground">
                                                            <MapPin className="w-3 h-3 mr-1 text-primary" /> {job.location}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm">
                                                            <span className="font-bold text-slate-700">{selected}</span>
                                                            <span className="text-muted-foreground mx-1">/</span>
                                                            <span className="font-medium">{required}</span>
                                                        </div>
                                                        {isGoalReached && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="w-48">
                                                    <div className="space-y-1.5">
                                                        <Progress value={progress} className={cn(
                                                            "h-1.5",
                                                            isGoalReached ? "bg-green-100" : "bg-slate-100"
                                                        )} />
                                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                            {isGoalReached ? "Goal Reached" : `${Math.round(progress)}% Progress`}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className={cn(
                                                        "text-sm font-semibold px-2 py-1 rounded inline-block",
                                                        new Date(job.deadline) < new Date() ? "bg-red-50 text-destructive border border-destructive/20" : "bg-slate-50 text-slate-700 border border-slate-200"
                                                    )}>
                                                        {job.deadline}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(job)}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(job)} title="Edit Job" className="hover:text-primary">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        {job.status !== 'Closed' && (
                                                            <Button variant="outline" size="sm" onClick={() => handleCloseJob(job.id, job.title)} className="text-amber-600 border-amber-200 hover:bg-amber-50 h-8 font-bold">
                                                                Close
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
                <DialogContent key={dialogResetKey} className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl shadow-2xl glass-effect">
                    <div className="bg-primary/5 p-8 border-b border-primary/10 rounded-t-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-bold flex items-center gap-3 text-primary">
                                <PlusCircle className="h-8 w-8" />
                                {editingJob ? `Editing "${editingJob.title || 'Job Opening'}"` : 'Adding New Job Opening'}
                            </DialogTitle>
                            <DialogDescription className="text-base text-muted-foreground mt-2">
                                {editingJob ? 'Update the details of this item.' : 'Enter the details for Job Opening.'}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="p-8 space-y-10">
                            {/* Section 1: Basic Info */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-primary border-b pb-2">
                                    <BriefcaseBusiness className="h-5 w-5" />
                                    <h3 className="font-bold text-lg uppercase tracking-wider">Role Fundamentals</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-sm uppercase tracking-tight">Job Title <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <SearchableMasterDropdown
                                                        categoryName="Job Titles"
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="Select or create title..."
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="department"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-sm uppercase tracking-tight">Department <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <DepartmentDropdown
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="employment_type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-sm uppercase tracking-tight">Employment Type <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <SearchableMasterDropdown
                                                        categoryName="Employment Type"
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="location"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-sm uppercase tracking-tight">Office Location <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <SearchableMasterDropdown
                                                        categoryName="Office Location"
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="Select or create location..."
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="required_candidates"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-sm uppercase tracking-tight flex items-center gap-2">
                                                    <Target className="h-4 w-4 text-primary" />
                                                    Number of Required Candidates <span className="text-destructive">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <Input type="number" min={1} {...field} className="h-11 shadow-sm font-bold" placeholder="e.g. 5" />
                                                </FormControl>
                                                <FormDescription className="text-[10px]">How many candidates do you need to hire for this role?</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 2: Requirements */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-primary border-b pb-2">
                                    <Badge variant="default" className="h-5 p-0 w-5 flex items-center justify-center rounded-sm">✓</Badge>
                                    <h3 className="font-bold text-lg uppercase tracking-wider">Experience & Salary</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="min_experience"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-bold text-[10px] uppercase text-muted-foreground">Min Experience (Yrs)</FormLabel>
                                                        <FormControl><Input type="number" {...field} className="h-11 shadow-sm" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="max_experience"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-bold text-[10px] uppercase text-muted-foreground">Max Experience (Yrs)</FormLabel>
                                                        <FormControl><Input type="number" {...field} className="h-11 shadow-sm" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-3 gap-3">
                                            <FormField
                                                control={form.control}
                                                name="min_salary"
                                                render={({ field }) => (
                                                    <FormItem className="col-span-1">
                                                        <FormLabel className="font-bold text-[10px] uppercase text-muted-foreground">Min Salary</FormLabel>
                                                        <FormControl><Input type="number" placeholder="50000" {...field} value={field.value || ''} className="h-11 shadow-sm" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="max_salary"
                                                render={({ field }) => (
                                                    <FormItem className="col-span-1">
                                                        <FormLabel className="font-bold text-[10px] uppercase text-muted-foreground">Max Salary</FormLabel>
                                                        <FormControl><Input type="number" placeholder="80000" {...field} value={field.value || ''} className="h-11 shadow-sm" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="currency"
                                                render={({ field }) => (
                                                    <FormItem className="col-span-1">
                                                        <FormLabel className="font-bold text-[10px] uppercase text-muted-foreground">Currency</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-11 shadow-sm"><SelectValue placeholder="INR" /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="INR">INR (₹)</SelectItem>
                                                                <SelectItem value="USD">USD ($)</SelectItem>
                                                                <SelectItem value="EUR">EUR (€)</SelectItem>
                                                                <SelectItem value="GBP">GBP (£)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="skills"
                                    render={({ field }) => (
                                        <FormItem className="bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                                            <FormLabel className="font-bold text-sm uppercase tracking-tight flex items-center gap-2 mb-3">
                                                Skill Requirements <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <SearchableMasterDropdown
                                                    categoryName="Skills"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    isMulti={true}
                                                    placeholder="Search and select required skills..."
                                                />
                                            </FormControl>
                                            <FormDescription className="text-xs pt-2 italic text-muted-foreground">Click multiple skills or search to filter the list.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Section 3: Description */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-primary border-b pb-2">
                                    <Edit className="h-5 w-5" />
                                    <h3 className="font-bold text-lg uppercase tracking-wider">Job Description</h3>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="job_description_rich"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="rounded-xl overflow-hidden border shadow-inner focus-within:ring-2 focus-within:ring-primary/10 transition-all bg-background min-h-[300px]">
                                                    <ReactQuill
                                                        theme="snow"
                                                        value={field.value}
                                                        onChange={(val) => {
                                                            field.onChange(val);
                                                            const plainText = val.replace(/<[^>]*>/g, '');
                                                            form.setValue('description', plainText);
                                                        }}
                                                        className="quill-editor"
                                                        placeholder="Write an engaging job description here... (bullet points, formatting, etc.)"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Section 4: Metadata */}
                            <div className="bg-muted/30 p-8 rounded-2xl border border-muted-foreground/10 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormField
                                    control={form.control}
                                    name="deadline"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-sm uppercase tracking-tight flex items-center gap-2">
                                                <Clock className="h-4 w-4" /> Application Deadline <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input type="date" min={todayStr} {...field} className="h-11 shadow-sm bg-background border-muted-foreground/20 font-medium" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-sm uppercase tracking-tight">Visibility Status</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 shadow-sm bg-background border-muted-foreground/20 font-medium font-bold">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Open" className="font-semibold text-green-600">Open (Publicly Visible)</SelectItem>
                                                    <SelectItem value="Closed" className="font-semibold text-slate-500">Closed (Draft/Private)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <DynamicFieldsSection
                                formName="Job Opening Form"
                                control={form.control}
                            />

                            <div className="flex justify-between items-center pt-10 border-t sticky bottom-0 bg-background/80 backdrop-blur-md pb-4 mt-6 z-10 transition-all rounded-b-2xl px-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost" className="h-12 px-8 font-medium hover:bg-slate-100">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting} className="h-12 px-12 font-extrabold text-lg shadow-2xl shadow-primary/30 active:scale-95 transition-all">
                                    {isSubmitting && <Loader2 className="h-5 w-5 mr-3 animate-spin" />}
                                    {editingJob ? 'Update Pipeline' : 'Publish Opportunity'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <style dangerouslySetInnerHTML={{
                __html: `
                .quill-editor .ql-container {
                    min-height: 250px;
                    font-size: 16px;
                    font-family: inherit;
                }
                .quill-editor .ql-toolbar {
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                    background: #f8fafc;
                }
                .quill-editor .ql-container {
                    border-bottom-left-radius: 0.75rem;
                    border-bottom-right-radius: 0.75rem;
                }
            `}} />
        </div>
    );
}

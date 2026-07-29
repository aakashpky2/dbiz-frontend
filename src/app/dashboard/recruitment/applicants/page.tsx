"use client";
import { DynamicFieldsSection } from '@/components/dashboard/recruitment/dynamic-fields-section';


import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Search, Inbox, Eye, Download, Edit, Trash2, Users, FileText, CheckCircle2, UserX, UserCheck, CalendarDays, Target, Loader2, X, Filter, RefreshCcw, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchWithCache } from "@/lib/fetcher";
import dynamic from 'next/dynamic';
const SearchableMasterDropdown = dynamic(() => import("@/components/dashboard/recruitment/searchable-master-dropdown").then(mod => mod.SearchableMasterDropdown), { ssr: false });
const ScheduleInterviewModal = dynamic(() => import("@/components/dashboard/recruitment/schedule-interview-modal").then(mod => mod.ScheduleInterviewModal), { ssr: false });
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { cn } from "@/lib/utils";

import { ApplicationStatus, Applicant, applicantFormSchema, ApplicantFormValues, STATUS_OPTIONS } from './constants';

export default function RecruitmentManagementPage() {
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // RBAC
    const { hasRole, isSuperAdmin, hasPermission } = usePermissions();
    const canManageCandidates = hasPermission("MANAGE_RECRUITMENT");
    const canEditStatus = isSuperAdmin || hasRole('HR') || hasRole('Admin') || hasRole('ADMIN') || hasRole('HR Manager') || hasRole('HR Executive');

    // UI State
    const [dialogResetKey, setDialogResetKey] = useState(0);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editingApplicant, setEditingApplicant] = useState<Applicant | null>(null);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [resumeToView, setResumeToView] = useState<Applicant | null>(null);
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [schedulingApplicant, setSchedulingApplicant] = useState<Applicant | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [sourceFilter, setSourceFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [deptFilter, setDeptFilter] = useState("All");
    const [typeFilter, setTypeFilter] = useState("All");
    const [locationFilter, setLocationFilter] = useState("All");
    const [titleFilter, setTitleFilter] = useState("All");

    // Master Data
    const [sources, setSources] = useState<{ id: string, name: string }[]>([]);
    const [positions, setPositions] = useState<{ id: string, name: string }[]>([]);
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [employmentTypes, setEmploymentTypes] = useState<{ id: string, name: string }[]>([]);
    const [locations, setLocations] = useState<{ id: string, name: string }[]>([]);
    const [jobOpenings, setJobOpenings] = useState<{ id: string, title: string }[]>([]);
    const [interviewModes, setInterviewModes] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch all master data in parallel
                const [sRes, tRes, lRes, dRes, jRes, mRes] = await Promise.all([
                    supabase.from('recruitment_sources').select('id, name').order('name'),
                    supabase.from('recruitment_master_values').select('id, name, recruitment_master_categories!inner(name)').eq('recruitment_master_categories.name', 'Employment Type').order('name'),
                    supabase.from('recruitment_master_values').select('id, name, recruitment_master_categories!inner(name)').eq('recruitment_master_categories.name', 'Office Location').order('name'),
                    supabase.from('departments').select('id, name').order('name'),
                    supabase.from('job_openings').select('id, title, department, location, employment_type').order('created_at', { ascending: false }),
                    supabase.from('interview_modes').select('id, name').order('name')
                ]);

                if (sRes.data) setSources(sRes.data);
                if (tRes.data) setEmploymentTypes(tRes.data.map(i => ({ id: i.id, name: i.name })));
                if (lRes.data) setLocations(lRes.data.map(i => ({ id: i.id, name: i.name })));
                if (dRes.data) setDepartments(dRes.data);
                if (jRes.data) setJobOpenings(jRes.data);
                if (mRes.data) setInterviewModes(mRes.data);

            } catch (e) {
            console.error("Error fetching master data:", e);
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Operation failed",
                variant: "destructive"
            });
        
        }
        };

        fetchData();
        fetchApplicants();
    }, []);

    const { toast } = useToast();

    const fetchApplicants = async () => {
        setIsLoading(true);
        try {
            const data = await fetchWithCache('/api/applicants');
            
            if (data) {
                const mapped: Applicant[] = data.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    email: d.email,
                    phone: d.phone,
                    position: d.position,
                    job_title_id: d.job_title_id,
                    department_id: d.department_id,
                    employment_type_id: d.employment_type_id,
                    location_id: d.location_id,
                    job_id: d.job_id,
                    source: d.source,
                    referringEmployee: d.referring_employee,
                    otherSource: d.other_source,
                    status: d.status as ApplicationStatus,
                    experience: d.experience,
                    location: d.location,
                    interviewDate: d.interview_date,
                    interviewTime: d.interview_time,
                    interviewMode: d.interview_mode,
                    interviewNotes: d.interview_notes,
                    assignedHR: d.assigned_hr,
                    resumeUrl: d.resume_url,
                    resumeName: d.resume_name,
                    date: d.date,
                    appliedDate: d.applied_date,
                    dynamic_fields: d.dynamic_fields || {}
                }));
                setApplicants(mapped);
            }
        } catch (error: any) {
            if (error.code === '42P01') {
                toast({ title: "Tables Missing", description: "Please run the Supabase schema script to initialize tables.", variant: "destructive" });
            } else {
                toast({ title: "Error fetching applicants", description: error.message, variant: "destructive" });
            }
            setApplicants([]);
        } finally {
            setIsLoading(false);
        }
    };

    const uploadResume = async (file: File) => {
        // Validation
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            throw new Error("Only PDF documents are allowed.");
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new Error("File size must be less than 5MB (Current: " + (file.size / 1024 / 1024).toFixed(2) + "MB)");
        }

        const fileName = `resume_${Math.random().toString(36).substring(2, 10)}_${Date.now()}.pdf`;
        const filePath = `applicants/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('resumes')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('resumes')
            .getPublicUrl(filePath);

        return { url: publicUrl, name: file.name, path: filePath };
    };

    // ADD FORM
    const addForm = useForm<ApplicantFormValues>({
        resolver: zodResolver(applicantFormSchema),
        defaultValues: {
            name: '', email: '', phone: '', position: '', job_title_id: '', source: '', referringEmployee: '', otherSource: '', status: 'Applied'
        },
    });

    const addSelectedSource = addForm.watch('source');

    // EDIT FORM
    const editForm = useForm<ApplicantFormValues>({
        resolver: zodResolver(applicantFormSchema),
    });

    const editSelectedSource = editForm.watch('source');
    const editSelectedStatus = editForm.watch('status');

    const handleAddOpenChange = (open: boolean) => {
        setIsAddDialogOpen(open);
        if (!open) {
            setDialogResetKey(prev => prev + 1);
            setResumeFile(null);
            addForm.reset();
        }
    };

    const handleEditOpenChange = (open: boolean) => {
        setIsEditDialogOpen(open);
        if (!open) {
            setDialogResetKey(prev => prev + 1);
            setEditingApplicant(null);
            setResumeFile(null);
        }
    };

    const handleAddSubmit: SubmitHandler<ApplicantFormValues> = async (data) => {
        if (!resumeFile) {
            toast({ title: "Resume Required", description: "Please upload a resume (PDF).", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const uploadedResume = await uploadResume(resumeFile);

            const dbPayload = {
                name: data.name,
                email: data.email,
                phone: data.phone,
                position: data.position,
                job_title_id: data.job_title_id || null,
                department_id: data.department_id || null,
                employment_type_id: data.employment_type_id || null,
                location_id: data.location_id || null,
                job_id: data.job_id || null,
                source: data.source,
                referring_employee: data.source === 'Employee Referral' ? data.referringEmployee : null,
                other_source: data.source === 'Other' ? data.otherSource : null,
                resume_url: uploadedResume.url,
                resume_name: uploadedResume.name,
                status: 'Applied',
                applied_date: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                dynamic_fields: data.dynamic_fields || {}
            };

            const { error } = await supabase.from('applicants').insert([dbPayload]);
            if (error) throw error;

            await fetchApplicants();
            toast({ title: "Applicant Added", description: `${data.name} has been successfully added.` });
            setIsAddDialogOpen(false);
            addForm.reset();
            setResumeFile(null);
        } catch (err: any) {
            toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleEditSubmit: SubmitHandler<ApplicantFormValues> = async (data) => {
        if (!editingApplicant) return;

        setIsSubmitting(true);
        try {
            let newResumeUrl = editingApplicant.resumeUrl;
            let newResumeName = editingApplicant.resumeName;

            if (resumeFile) {
                const uploadedResume = await uploadResume(resumeFile);
                newResumeUrl = uploadedResume.url;
                newResumeName = uploadedResume.name;
            }

            const dbPayload = {
                name: data.name,
                email: data.email,
                phone: data.phone,
                position: data.position,
                job_title_id: data.job_title_id || null,
                department_id: data.department_id || null,
                employment_type_id: data.employment_type_id || null,
                location_id: data.location_id || null,
                job_id: data.job_id || null,
                source: data.source,
                referring_employee: data.source === 'Employee Referral' ? data.referringEmployee : null,
                other_source: data.source === 'Other' ? data.otherSource : null,
                status: data.status,
                resume_url: newResumeUrl,
                resume_name: newResumeName,
                interview_date: data.status === 'Interview Scheduled' ? data.interviewDate : editingApplicant.interviewDate,
                interview_time: data.status === 'Interview Scheduled' ? data.interviewTime : editingApplicant.interviewTime,
                interview_mode: data.status === 'Interview Scheduled' ? data.interviewMode : editingApplicant.interviewMode,
                interview_notes: data.status === 'Interview Scheduled' ? data.interviewNotes : editingApplicant.interviewNotes,
                dynamic_fields: data.dynamic_fields || editingApplicant.dynamic_fields || {}
            };

            const { error } = await supabase.from('applicants').update(dbPayload).eq('id', editingApplicant.id);
            if (error) throw error;

            await fetchApplicants();
            toast({ title: "Applicant Updated", description: `${data.name} has been successfully updated.` });
            setIsEditDialogOpen(false);
            setEditingApplicant(null);
            setResumeFile(null);
        } catch (err: any) {
            toast({ title: "Update Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openAddDialog = () => {
        addForm.reset({
            name: '', email: '', phone: '', position: '', job_title_id: '',
            department_id: '', employment_type_id: '', location_id: '', job_id: '',
            source: '', referringEmployee: '', otherSource: '', status: 'Applied'
        });
        setResumeFile(null);
        setIsAddDialogOpen(true);
    };

    const openEditDialog = (app: Applicant) => {
        setEditingApplicant(app);
        editForm.reset({
            name: app.name, email: app.email, phone: app.phone, position: app.position,
            job_title_id: app.job_title_id || '',
            department_id: app.department_id || '',
            employment_type_id: app.employment_type_id || '',
            location_id: app.location_id || '',
            job_id: app.job_id || '',
            source: app.source, referringEmployee: app.referringEmployee, otherSource: app.otherSource,
            status: app.status, interviewDate: app.interviewDate, interviewTime: app.interviewTime,
            interviewMode: app.interviewMode, interviewNotes: app.interviewNotes
        });
        setResumeFile(null);
        setIsEditDialogOpen(true);
    };

    const updateApplicantStatus = async (appId: string, newStatus: ApplicationStatus) => {
        try {
            const { error } = await supabase.from('applicants').update({ status: newStatus }).eq('id', appId);
            if (error) throw error;

            toast({
                title: newStatus === 'Rejected' ? "Candidate Rejected" : "Status Updated",
                description: newStatus === 'Shortlisted' ? "Candidate successfully shortlisted." : `Status changed to ${newStatus}`
            });

            // If we are updating from the resume modal, sync the local state
            if (resumeToView && resumeToView.id === appId) {
                setResumeToView({ ...resumeToView, status: newStatus });
            }

            fetchApplicants();
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };

    const handleQuickStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
        const app = applicants.find(a => a.id === appId);
        if (!app) return;

        if (newStatus === 'Interview Scheduled') {
            setSchedulingApplicant(app);
            setIsScheduleModalOpen(true);
        } else if (newStatus === 'Rejected') {
            if (confirm("Are you sure you want to reject this candidate?")) {
                updateApplicantStatus(appId, newStatus);
            }
        } else {
            updateApplicantStatus(appId, newStatus);
        }
    };

    const openScheduleModal = (app: Applicant) => {
        setSchedulingApplicant(app);
        setIsScheduleModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this applicant?")) return;
        try {
            const { error } = await supabase.from('applicants').delete().eq('id', id);
            if (error) throw error;
            await fetchApplicants();
            toast({ title: "Applicant Deleted", description: "Applicant has been removed." });
        } catch (err: any) {
            toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
        }
    };

    const activeFilterCount = useMemo(() => {
        return [
            statusFilter !== "All",
            sourceFilter !== "All",
            deptFilter !== "All",
            typeFilter !== "All",
            locationFilter !== "All",
            titleFilter !== "All"
        ].filter(Boolean).length;
    }, [statusFilter, sourceFilter, deptFilter, typeFilter, locationFilter, titleFilter]);

    const filteredApplicants = useMemo(() => {
        let result = applicants;

        // Global Search (Name, Email, Phone, Position)
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(app =>
                app.name.toLowerCase().includes(lowerQuery) ||
                app.email.toLowerCase().includes(lowerQuery) ||
                app.phone.toLowerCase().includes(lowerQuery) ||
                app.position.toLowerCase().includes(lowerQuery)
            );
        }

        // Dropdown Filters
        if (sourceFilter !== "All") result = result.filter(app => app.source === sourceFilter);
        if (statusFilter !== "All") result = result.filter(app => app.status === statusFilter);
        if (deptFilter !== "All") result = result.filter(app => app.department_id === deptFilter);
        if (typeFilter !== "All") result = result.filter(app => app.employment_type_id === typeFilter);
        if (locationFilter !== "All") result = result.filter(app => app.location_id === locationFilter);
        if (titleFilter !== "All") result = result.filter(app => app.job_title_id === titleFilter);

        // Sort by latest applied date by default
        return result.sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
    }, [applicants, searchQuery, sourceFilter, statusFilter, deptFilter, typeFilter, locationFilter, titleFilter]);

    // Analytics Metrics
    const totalApplicants = applicants.length;
    const shortlistedCount = applicants.filter(a => a.status === 'Shortlisted').length;
    const interviewsCount = applicants.filter(a => a.status === 'Interview Scheduled').length;
    const selectedCount = applicants.filter(a => a.status === 'Selected').length;
    const rejectedCount = applicants.filter(a => a.status === 'Rejected').length;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Applied': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
            case 'Shortlisted': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
            case 'Interview Scheduled': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300';
            case 'Interview Completed': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300';
            case 'Selected': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300';
            case 'Rejected': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Recruitment Dashboard"
                description="Manage your hiring pipeline and job applicants."
            >
                {canManageCandidates && <Button onClick={openAddDialog} className="font-bold">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Applicant
                </Button>}
            </DashboardPageHeader>

            {/* Analytics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalApplicants}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Shortlisted</CardTitle>
                        <UserCheck className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{shortlistedCount}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Interviews</CardTitle>
                        <CalendarDays className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{interviewsCount}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Selected</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{selectedCount}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                        <UserX className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{rejectedCount}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                    <CardTitle className="text-lg font-bold">Applicants List</CardTitle>
                </CardHeader>

                <CardContent>
                    <div className="space-y-4 mb-6">
                        <DashboardFilterBar>
                            <div className="flex-1 w-full flex flex-col md:flex-row items-stretch md:items-center gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search applicants..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 w-full h-10 bg-background border-muted-foreground/20"
                                    />
                                </div>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-10 px-4 gap-2 relative border-muted-foreground/20">
                                            <Filter className="h-4 w-4" />
                                            <span className="font-semibold">Filters</span>
                                            {activeFilterCount > 0 && (
                                                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0">
                                                    {activeFilterCount}
                                                </Badge>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[320px] p-5 shadow-2xl border-slate-200 rounded-2xl" align="end" sideOffset={8}>
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-2">
                                                <SlidersHorizontal className="h-4 w-4 text-primary" />
                                                <h4 className="font-bold text-sm tracking-tight">Refine Results</h4>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-[10px] font-bold uppercase tracking-widest text-primary"
                                                onClick={() => {
                                                    setStatusFilter("All");
                                                    setSourceFilter("All");
                                                    setDeptFilter("All");
                                                    setTypeFilter("All");
                                                    setLocationFilter("All");
                                                    setTitleFilter("All");
                                                }}
                                            >
                                                Reset All
                                            </Button>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Application Status</label>
                                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                    <SelectTrigger className="h-10 bg-background border-muted-foreground/20 rounded-lg">
                                                        <SelectValue placeholder="All Statuses" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="All" className="text-xs">All Statuses</SelectItem>
                                                        {STATUS_OPTIONS.map(st => (
                                                            <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Position / Opening</label>
                                                <Select value={titleFilter} onValueChange={setTitleFilter}>
                                                    <SelectTrigger className="h-10 bg-background border-muted-foreground/20 rounded-lg">
                                                        <SelectValue placeholder="All Positions" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="All" className="text-xs">All Openings</SelectItem>
                                                        {jobOpenings.map(job => (
                                                            <SelectItem key={job.id} value={job.title} className="text-xs">{job.title}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Department</label>
                                                <Select value={deptFilter} onValueChange={setDeptFilter}>
                                                    <SelectTrigger className="h-10 bg-background border-muted-foreground/20 rounded-lg">
                                                        <SelectValue placeholder="All Departments" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="All" className="text-xs">All Departments</SelectItem>
                                                        {departments.map(d => (
                                                            <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Type</label>
                                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                                        <SelectTrigger className="h-10 bg-background border-muted-foreground/20 rounded-lg">
                                                            <SelectValue placeholder="All" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="All" className="text-xs">All Types</SelectItem>
                                                            {employmentTypes.map(t => (
                                                                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Location</label>
                                                    <Select value={locationFilter} onValueChange={setLocationFilter}>
                                                        <SelectTrigger className="h-10 bg-background border-muted-foreground/20 rounded-lg">
                                                            <SelectValue placeholder="All" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="All" className="text-xs">All locations</SelectItem>
                                                            {locations.map(l => (
                                                                <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Candidate Source</label>
                                                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                                    <SelectTrigger className="h-10 bg-background border-muted-foreground/20 rounded-lg">
                                                        <SelectValue placeholder="All Sources" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="All" className="text-xs">All Sources</SelectItem>
                                                        {sources.map(src => (
                                                            <SelectItem key={src.id} value={src.name} className="text-xs">{src.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </DashboardFilterBar>

                        {/* Visible Filter Summary */}
                        {(activeFilterCount > 0 || searchQuery) && (
                            <div className="flex flex-wrap gap-2 items-center min-h-[32px] p-2 px-3 rounded-2xl bg-slate-50 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-1.5 mr-2">
                                    <SlidersHorizontal className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mr-1">Active Filters:</span>
                                </div>

                                {statusFilter !== "All" && (
                                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1 h-7 text-[10px] font-bold bg-white text-primary border-primary/20 shadow-sm transition-all hover:bg-slate-50">
                                        Status: {statusFilter}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive rounded-full" onClick={() => setStatusFilter("All")} />
                                    </Badge>
                                )}
                                {titleFilter !== "All" && (
                                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1 h-7 text-[10px] font-bold bg-white text-primary border-primary/20 shadow-sm transition-all hover:bg-slate-50">
                                        Role: {positions.find(p => p.id === titleFilter)?.name}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive rounded-full" onClick={() => setTitleFilter("All")} />
                                    </Badge>
                                )}
                                {deptFilter !== "All" && (
                                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1 h-7 text-[10px] font-bold bg-white text-primary border-primary/20 shadow-sm transition-all hover:bg-slate-50">
                                        Dept: {departments.find(d => d.id === deptFilter)?.name}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive rounded-full" onClick={() => setDeptFilter("All")} />
                                    </Badge>
                                )}
                                {typeFilter !== "All" && (
                                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1 h-7 text-[10px] font-bold bg-white text-primary border-primary/20 shadow-sm transition-all hover:bg-slate-50">
                                        Type: {employmentTypes.find(t => t.id === typeFilter)?.name}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive rounded-full" onClick={() => setTypeFilter("All")} />
                                    </Badge>
                                )}
                                {locationFilter !== "All" && (
                                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1 h-7 text-[10px] font-bold bg-white text-primary border-primary/20 shadow-sm transition-all hover:bg-slate-50">
                                        Loc: {locations.find(l => l.id === locationFilter)?.name}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive rounded-full" onClick={() => setLocationFilter("All")} />
                                    </Badge>
                                )}
                                {sourceFilter !== "All" && (
                                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1 h-7 text-[10px] font-bold bg-white text-primary border-primary/20 shadow-sm transition-all hover:bg-slate-50">
                                        Src: {sourceFilter}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive rounded-full" onClick={() => setSourceFilter("All")} />
                                    </Badge>
                                )}
                                {searchQuery && (
                                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1 h-7 text-[10px] font-bold bg-white text-primary border-primary/20 shadow-sm transition-all hover:bg-slate-50">
                                        Search: {searchQuery}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive rounded-full" onClick={() => setSearchQuery("")} />
                                    </Badge>
                                )}

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 ml-1 text-[10px] font-black text-rose-500 hover:bg-rose-50 hover:text-rose-600 uppercase tracking-tighter"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setStatusFilter("All");
                                        setSourceFilter("All");
                                        setDeptFilter("All");
                                        setTypeFilter("All");
                                        setLocationFilter("All");
                                        setTitleFilter("All");
                                    }}
                                >
                                    Clear All
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    {filteredApplicants.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10 border-2 border-dashed border-muted rounded-lg">
                            <Inbox className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-semibold">No Applicants Found</h3>
                            <p className="mt-1 text-sm">Modify your filters or add a new applicant.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Applicant Name</TableHead>
                                        <TableHead>Position / Opening</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Emp. Type</TableHead>
                                        <TableHead>Date Applied</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredApplicants.map((applicant) => (
                                        <TableRow key={applicant.id}>
                                            <TableCell className="whitespace-nowrap py-3">
                                                <div className="font-bold text-foreground">{applicant.name}</div>
                                                <div className="text-[10px] text-muted-foreground flex flex-col mt-0.5">
                                                    <span>{applicant.email}</span>
                                                    <span>{applicant.phone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="font-medium text-sm">{applicant.position}</div>
                                                {applicant.job_id && (
                                                    <div className="text-[10px] text-primary font-bold uppercase tracking-tight opacity-80 mt-1">
                                                        {jobOpenings.find(j => j.id === applicant.job_id)?.title || 'Linked Job'}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <Badge variant="outline" className="text-[10px] h-5 bg-slate-50 border-slate-200">
                                                    {departments.find(d => d.id === applicant.department_id)?.name || 'General'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <Badge variant="outline" className="text-[10px] h-5 bg-blue-50/50 border-blue-100 text-blue-600">
                                                    {employmentTypes.find(t => t.id === applicant.employment_type_id)?.name || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                                                {format(new Date(applicant.appliedDate), 'dd MMM, yyyy')}
                                            </TableCell>
                                            <TableCell>
                                                <Select disabled={!canEditStatus} value={applicant.status} onValueChange={(val) => handleQuickStatusChange(applicant.id, val as ApplicationStatus)}>
                                                    <SelectTrigger className={`h-8 w-[140px] text-[10px] font-bold border-transparent shadow-none focus:ring-0 ${getStatusColor(applicant.status)} ${!canEditStatus ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {STATUS_OPTIONS.map(st => (
                                                            <SelectItem key={st} value={st} className="text-xs font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(st).split(' ')[0]}`} />
                                                                    {st}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap space-x-0.5">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => {
                                                        setResumeToView(applicant);
                                                        setIsResumeModalOpen(true);
                                                    }}
                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    title="View Resume"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => openScheduleModal(applicant)}
                                                    className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                    title="Schedule Interview"
                                                >
                                                    <CalendarDays className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(applicant)} className="h-8 w-8 hover:text-primary hover:bg-primary/5">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(applicant.id)} className="h-8 w-8 hover:text-destructive hover:bg-destructive/5">
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

            {/* ADD APPLICANT DIALOG */}
            <Dialog open={isAddDialogOpen} onOpenChange={handleAddOpenChange}>
                <DialogContent className="sm:max-w-[650px]">
                    <DialogHeader>
                        <DialogTitle>Adding New Applicant</DialogTitle>
                        <DialogDescription>Enter the details for Applicant.</DialogDescription>
                    </DialogHeader>
                    <Form {...addForm}>
                        <form onSubmit={addForm.handleSubmit(handleAddSubmit)} className="space-y-4 py-2">
                            <FormField
                                control={addForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="John Doe" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={addForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                                            <FormControl><Input type="email" placeholder="john@example.com" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                                            <FormControl><Input type="number" placeholder="1234567890" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={addForm.control}
                                name="job_title_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Target className="w-4 h-4 text-primary" />
                                            Position Applied For <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <SearchableMasterDropdown
                                                categoryName="Job Titles"
                                                value={field.value || ""}
                                                onChange={(val) => {
                                                    field.onChange(val);
                                                    const selected = positions.find(p => p.id === val);
                                                    if (selected) {
                                                        addForm.setValue('position', selected.name);
                                                    }
                                                }}
                                                optionValueType="id"
                                                placeholder="Search Job Title..."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-3 gap-3">
                                <FormField
                                    control={addForm.control}
                                    name="department_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Department</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select Dept" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {departments.map(d => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="employment_type_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Employment Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {employmentTypes.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="location_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Location</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select Loc" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {locations.map(l => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Applicant Resume (PDF only, Max 5MB) <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                    <div className="space-y-2">
                                        <Input
                                            type="file" accept=".pdf"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) setResumeFile(file);
                                            }}
                                            className="cursor-pointer file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-2"
                                        />
                                        {resumeFile && (
                                            <div className="text-[10px] text-green-600 font-bold uppercase tracking-wider bg-green-50 p-1 px-2 rounded-md border border-green-100 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Selected: {resumeFile.name} ({(resumeFile.size / 1024 / 1024).toFixed(2)}MB)
                                            </div>
                                        )}
                                    </div>
                                </FormControl>
                            </FormItem>
                            <FormField
                                control={addForm.control}
                                name="source"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Source <span className="text-destructive">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {sources.map(src => (<SelectItem key={src.id} value={src.name}>{src.name}</SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {addSelectedSource === 'Employee Referral' && (
                                <FormField control={addForm.control} name="referringEmployee" render={({ field }) => (
                                    <FormItem className="animate-in fade-in slide-in-from-top-2">
                                        <FormLabel>Referring Employee <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="Enter employee name" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                            {addSelectedSource === 'Other' && (
                                <FormField control={addForm.control} name="otherSource" render={({ field }) => (
                                    <FormItem className="animate-in fade-in slide-in-from-top-2">
                                        <FormLabel>Please specify <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="Specify source" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                            <DialogFooter className="pt-4 mt-4 border-t">
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Applicant
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* EDIT APPLICANT & STATUS DIALOG */}
            <Dialog open={isEditDialogOpen} onOpenChange={handleEditOpenChange}>
                <DialogContent key={dialogResetKey} className="sm:max-w-[600px] h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b shrink-0">
                        <DialogTitle>Editing "Applicant"</DialogTitle>
                        <DialogDescription>Update the details of this item.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted">
                        <Form {...editForm}>
                            <form id="edit-applicant-form" onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6">
                                {/* Status Update Section */}
                                <div className="bg-muted/30 p-4 rounded-xl border">
                                    <FormField
                                        control={editForm.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                                                    Application Stage
                                                </FormLabel>
                                                <Select disabled={!canEditStatus} onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className={`h-12 text-sm font-semibold ${getStatusColor(field.value)} ${!canEditStatus ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                                            <SelectValue placeholder="Select Status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {STATUS_OPTIONS.map(st => (
                                                            <SelectItem key={st} value={st} className="font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(st).split(' ')[0]}`} />
                                                                    {st}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Interview Scheduling Fields */}
                                    {editSelectedStatus === 'Interview Scheduled' && (
                                        <div className="mt-4 space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2">
                                            <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4" /> Schedule Details
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={editForm.control}
                                                    name="interviewDate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={editForm.control}
                                                    name="interviewTime"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Time <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={editForm.control}
                                                name="interviewMode"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Interview Mode <span className="text-destructive">*</span></FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Mode" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {interviewModes.map(mode => (
                                                                    <SelectItem key={mode.id} value={mode.name}>{mode.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="interviewNotes"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Notes / Meet Link</FormLabel>
                                                        <FormControl>
                                                            <Textarea placeholder="Add meeting link or notes for HR/Interviewer" className="resize-none h-20" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-semibold text-lg pb-1 border-b">Applicant Information</h4>
                                    <FormField
                                        control={editForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                                                <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={editForm.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editForm.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={editForm.control}
                                        name="job_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2">
                                                    <Target className="w-4 h-4 text-primary" />
                                                    Position Applied For / Job Opening <span className="text-destructive">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Job Opening..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {jobOpenings.map(job => (
                                                                <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <DynamicFieldsSection
                                        formName="Job Application Form"
                                        control={editForm.control}
                                    />
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" />
                                            Applicant Resume (PDF only, Max 5MB)
                                        </FormLabel>
                                        <div className="flex flex-col gap-3">
                                            <FormControl>
                                                <Input
                                                    type="file" accept=".pdf"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setResumeFile(file);
                                                    }}
                                                    className="cursor-pointer file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-2"
                                                />
                                            </FormControl>
                                            {editingApplicant?.resumeUrl && !resumeFile && (
                                                <div className="flex items-center justify-between p-3 rounded-xl border bg-blue-50/50 border-blue-100">
                                                    <div className="flex items-center gap-2 text-sm text-blue-700 font-medium overflow-hidden">
                                                        <FileText className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">Current: {editingApplicant.resumeName}</span>
                                                    </div>
                                                    <Button
                                                        type="button" variant="outline" size="sm"
                                                        onClick={() => window.open(editingApplicant.resumeUrl, "_blank")}
                                                        className="h-8 text-xs bg-white"
                                                    >
                                                        <Eye className="h-3 w-3 mr-1" /> View
                                                    </Button>
                                                </div>
                                            )}
                                            {resumeFile && (
                                                <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider bg-orange-50 p-1 px-2 rounded-md border border-orange-100 flex items-center gap-1">
                                                    <PlusCircle className="w-3 h-3" /> Replacing with: {resumeFile.name} ({(resumeFile.size / 1024 / 1024).toFixed(2)}MB)
                                                </div>
                                            )}
                                        </div>
                                    </FormItem>
                                    <FormField
                                        control={editForm.control}
                                        name="source"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Source <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {sources.map(src => (<SelectItem key={src.id} value={src.name}>{src.name}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {editSelectedSource === 'Employee Referral' && (
                                        <FormField control={editForm.control} name="referringEmployee" render={({ field }) => (
                                            <FormItem className="animate-in fade-in slide-in-from-top-2">
                                                <FormLabel>Referring Employee <span className="text-destructive">*</span></FormLabel>
                                                <FormControl><Input placeholder="Enter employee name" {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                    {editSelectedSource === 'Other' && (
                                        <FormField control={editForm.control} name="otherSource" render={({ field }) => (
                                            <FormItem className="animate-in fade-in slide-in-from-top-2">
                                                <FormLabel>Please specify <span className="text-destructive">*</span></FormLabel>
                                                <FormControl><Input placeholder="Specify source" {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                </div>
                            </form>
                        </Form>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t bg-muted/10 shrink-0">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" form="edit-applicant-form" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* RESUME PREVIEW MODAL */}
            <Dialog open={isResumeModalOpen} onOpenChange={setIsResumeModalOpen}>
                <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
                        <div className="flex flex-col gap-0.5">
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                <FileText className="h-5 w-5 text-primary" /> {resumeToView?.name || 'Applicant Resume'}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {resumeToView?.position} • Applied on {resumeToView?.appliedDate ? format(new Date(resumeToView.appliedDate), 'dd MMM yyyy') : ''}
                            </DialogDescription>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pr-6">
                            <Badge className={`${getStatusColor(resumeToView?.status || '')} border shadow-none font-semibold px-2 py-0.5`}>
                                {resumeToView?.status}
                            </Badge>
                            <div className="h-6 w-px bg-border mx-1" />
                            <Button
                                size="sm" variant="outline"
                                className="h-8 text-xs border-green-200 text-green-700 bg-green-50/50 hover:bg-green-50 shadow-none font-medium"
                                onClick={() => handleQuickStatusChange(resumeToView!.id, 'Shortlisted')}
                                disabled={resumeToView?.status === 'Shortlisted' || resumeToView?.status === 'Selected'}
                            >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {resumeToView?.status === 'Shortlisted' ? 'Shortlisted' : 'Shortlist'}
                            </Button>
                            <Button
                                size="sm" variant="outline"
                                className="h-8 text-xs border-red-200 text-red-700 bg-red-50/50 hover:bg-red-50 shadow-none font-medium"
                                onClick={() => handleQuickStatusChange(resumeToView!.id, 'Rejected')}
                                disabled={resumeToView?.status === 'Rejected'}
                            >
                                <UserX className="mr-1 h-3.5 w-3.5" /> {resumeToView?.status === 'Rejected' ? 'Rejected' : 'Reject'}
                            </Button>
                            <div className="h-6 w-px bg-border mx-1" />
                            <Button size="sm" variant="outline" className="h-8 text-xs shadow-none border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50" asChild>
                                <a href={resumeToView?.resumeUrl} download={resumeToView?.resumeName || 'resume.pdf'} className="flex items-center">
                                    <Download className="mr-1 h-3.5 w-3.5" /> Download
                                </a>
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs shadow-none" onClick={() => window.open(resumeToView?.resumeUrl, '_blank')}>
                                <Eye className="mr-1 h-3.5 w-3.5" /> Full Screen
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 w-full bg-slate-100 dark:bg-slate-900 overflow-hidden relative flex flex-col md:flex-row">
                        {resumeToView?.resumeUrl ? (
                            <>
                                <div className="flex-[3] h-full bg-white relative">
                                    {resumeToView.resumeUrl.includes('placeholder-url.com') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center gap-4 bg-orange-50/30">
                                            <div className="p-4 bg-orange-100/50 rounded-full"><UserX className="h-10 w-10 text-orange-600" /></div>
                                            <div className="max-w-md">
                                                <h3 className="text-lg font-bold text-orange-900">Old Placeholder URL Detected</h3>
                                                <p className="text-sm text-orange-800 mt-2">The candidate's record has an outdated link.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative w-full h-full group">
                                            <iframe
                                                key={resumeToView.resumeUrl}
                                                src={resumeToView.resumeUrl.startsWith('http') ? resumeToView.resumeUrl : undefined}
                                                className="w-full h-full border-0 rounded-bl-xl"
                                                title="Resume Preview"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                                            />
                                            {/* PC-Specific Resilience: Overlay help if frame is blocked */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="p-4 bg-white/90 backdrop-blur shadow-2xl rounded-2xl border border-primary/20 pointer-events-auto flex flex-col items-center gap-2">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Environment Blocked?</p>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-7 text-[10px] font-black uppercase text-primary hover:bg-primary/10"
                                                        onClick={() => window.open(resumeToView.resumeUrl, '_blank')}
                                                    >
                                                        Manual Open <ArrowRight className="ml-1 h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-[320px] bg-slate-50/80 border-l border-slate-100 p-6 overflow-y-auto no-scrollbar">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="h-1 w-8 bg-primary rounded-full" />
                                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Review Feedback</h3>
                                        </div>

                                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Progress</label>
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="outline" className={`px-3 py-1 bg-white border-2 font-black uppercase tracking-tighter text-[10px] ${getStatusColor(resumeToView.status)}`}>
                                                        {resumeToView.status}
                                                    </Badge>
                                                    <span className="text-[10px] font-bold text-slate-400">Score: --</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Form {...editForm}>
                                            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                                                <DynamicFieldsSection
                                                    formName="Applicant Review Form"
                                                    control={editForm.control}
                                                />
                                                <div className="pt-4 border-t space-y-3">
                                                    <Button
                                                        className="w-full bg-green-600 hover:bg-green-700 font-bold transition-all shadow-lg shadow-green-200"
                                                        onClick={() => resumeToView && updateApplicantStatus(resumeToView.id, 'Shortlisted')}
                                                    >
                                                        Finalize Shortlist
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full text-slate-400 hover:text-red-600 font-bold text-xs"
                                                        onClick={() => resumeToView && updateApplicantStatus(resumeToView.id, 'Rejected')}
                                                    >
                                                        Proceed with Rejection
                                                    </Button>
                                                </div>
                                            </form>
                                        </Form>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <FileText className="h-12 w-12 opacity-20" />
                                <p>No resume available for preview</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <ScheduleInterviewModal
                isOpen={isScheduleModalOpen}
                onOpenChange={setIsScheduleModalOpen}
                applicant={schedulingApplicant}
                onSuccess={fetchApplicants}
            />
        </div>
    );
}

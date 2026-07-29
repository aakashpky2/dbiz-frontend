"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, Calendar, FileText, CheckCircle2, XCircle, Clock, MapPin, Video,
    HelpCircle, UserCheck2, RefreshCw, Search, Filter, History, Trash2,
    CheckCircle, MessageSquare, AlertCircle, User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { format } from 'date-fns';
import { isPast } from 'date-fns';
import { isToday } from 'date-fns';
import { isFuture } from 'date-fns';
import { fetchWithCache } from "@/lib/fetcher";
import { PostponeInterviewModal } from "@/components/dashboard/recruitment/postpone-interview-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { cn } from "@/lib/utils";

interface Interview {
    id: string;
    applicant_id: string;
    applicants: {
        name: string;
        email: string;
        position: string;
    };
    job_title_id?: string;
    recruitment_master_values?: {
        name: string;
    };
    interview_date: string;
    interview_time: string;
    interview_mode: string;
    interviewer: string;
    status: string;
    postponed_by?: string;
    postponement_reason?: string;
    notes?: string;
    created_at: string;
    logs?: any[];
}

export default function ScheduledInterviewsPage() {
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [dateFilter, setDateFilter] = useState("All"); // All, Today, Upcoming, Past

    const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
    const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

    const [historyInterview, setHistoryInterview] = useState<Interview | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [dialogResetKey, setDialogResetKey] = useState(0);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);

    const { toast } = useToast();
    const { hasRole, isSuperAdmin, hasPermission } = usePermissions();
    const canManageCandidates = hasPermission('MANAGE_RECRUITMENT');
    const canManageInterviews = isSuperAdmin || hasRole('HR') || hasRole('Admin') || hasRole('HR Manager');

    const fetchInterviews = async () => {
        setIsLoading(true);
        try {
            const data = await fetchWithCache('/api/interviews');
            if (data) setInterviews(data);
        } catch (error: any) {
            toast({ title: "Fetch Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInterviews();
    }, []);

    const fetchLogs = async (interviewId: string) => {
        setIsLogsLoading(true);
        const { data, error } = await supabase
            .from('interview_logs')
            .select('*')
            .eq('interview_id', interviewId)
            .order('created_at', { ascending: false });

        if (data) setAuditLogs(data);
        setIsLogsLoading(false);
    };

    const handleOpenHistory = (interview: Interview) => {
        setHistoryInterview(interview);
        setAuditLogs([]);
        setIsHistoryOpen(true);
        fetchLogs(interview.id);
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        if (!confirm(`Are you sure you want to mark this interview as ${newStatus}?`)) return;

        try {
            const { error } = await supabase
                .from('interviews')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            // Log action
            await supabase.from('interview_logs').insert([{
                interview_id: id,
                action: newStatus,
                details: { timestamp: new Date().toISOString() }
            }]);

            await fetchInterviews();
            toast({ title: `Interview ${newStatus}`, description: "Status successfully updated." });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleDeleteInterview = async (id: string) => {
        if (!confirm("Delete this interview record permanently?")) return;

        try {
            const { error } = await supabase.from('interviews').delete().eq('id', id);
            if (error) throw error;
            await fetchInterviews();
            toast({ title: "Deleted", description: "Interview record removed." });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const filteredInterviews = useMemo(() => {
        return interviews.filter(item => {
            const matchesSearch = item.applicants?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.applicants?.position?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === "All" || item.status === statusFilter;

            let matchesDate = true;
            const interviewDate = new Date(item.interview_date);
            if (dateFilter === "Today") matchesDate = isToday(interviewDate);
            else if (dateFilter === "Upcoming") matchesDate = isFuture(interviewDate) || isToday(interviewDate);
            else if (dateFilter === "Past") matchesDate = isPast(interviewDate) && !isToday(interviewDate);

            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [interviews, searchQuery, statusFilter, dateFilter]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Scheduled': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Scheduled</Badge>;
            case 'Completed': return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Completed</Badge>;
            case 'Postponed': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200">Postponed</Badge>;
            case 'Cancelled': return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Interview Dashboard"
                description="Manage scheduling, tracking, and history of candidate interviews."
            >
                <Button variant="outline" onClick={fetchInterviews} disabled={isLoading} className="font-bold">
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Refresh
                </Button>
            </DashboardPageHeader>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="py-4 px-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="px-6 pb-4">
                        <div className="text-2xl font-bold">{interviews.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="py-4 px-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent className="px-6 pb-4">
                        <div className="text-2xl font-bold">{interviews.filter(i => i.status === 'Scheduled').length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="py-4 px-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="px-6 pb-4">
                        <div className="text-2xl font-bold">{interviews.filter(i => i.status === 'Completed').length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
                    <CardHeader className="py-4 px-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Postponed</CardTitle>
                        <RefreshCw className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent className="px-6 pb-4">
                        <div className="text-2xl font-bold">{interviews.filter(i => i.status === 'Postponed').length}</div>
                    </CardContent>
                </Card>
            </div>

            <DashboardFilterBar>
                <div className="flex-1 w-full flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search applicant or position..."
                            className="pl-9 h-10 bg-background border-muted-foreground/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px] h-10 bg-background text-xs border-muted-foreground/20">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Statuses</SelectItem>
                                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Postponed">Postponed</SelectItem>
                                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-[130px] h-10 bg-background text-xs border-muted-foreground/20">
                                <Calendar className="h-3.5 w-3.5 mr-2 text-primary" />
                                <SelectValue placeholder="Date Filter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Dates</SelectItem>
                                <SelectItem value="Today">Today</SelectItem>
                                <SelectItem value="Upcoming">Upcoming</SelectItem>
                                <SelectItem value="Past">Past Records</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </DashboardFilterBar>

            <Card className="shadow-sm border overflow-hidden">

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 border-b">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-700">Applicant & Role</TableHead>
                                    <TableHead className="font-bold text-slate-700">Schedule</TableHead>
                                    <TableHead className="font-bold text-slate-700">Mode & Panel</TableHead>
                                    <TableHead className="font-bold text-slate-700">Status</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700 px-6">Manage</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-40 text-center">
                                            <PageSkeleton />
                                            <p className="mt-2 text-slate-400 text-sm">Syncing Schedule...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredInterviews.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-40 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <Calendar className="h-10 w-10 mb-2 opacity-20" />
                                                <EmptyState title="No Interviews Found" description="No interviews found matching the current filters." />
                                                <Button variant="link" size="sm" onClick={() => { setSearchQuery(""); setStatusFilter("All"); setDateFilter("All"); }} className="mt-1">Clear Filters</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredInterviews.map((interview) => (
                                        <TableRow key={interview.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <TableCell className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900">{interview.applicants?.name}</span>
                                                    <span className="text-xs font-semibold text-primary/80 mt-0.5">{interview.recruitment_master_values?.name || interview.applicants?.position}</span>
                                                    <span className="text-[10px] text-slate-400">{interview.applicants?.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center text-sm font-medium text-slate-700 border-l-4 border-orange-400 pl-2">
                                                        {format(new Date(interview.interview_date), 'dd MMM, yyyy')}
                                                    </div>
                                                    <div className="flex items-center text-xs text-slate-500 font-bold ml-3">
                                                        <Clock className="h-3 w-3 mr-1 text-blue-500" />
                                                        {interview.interview_time}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center text-xs font-bold text-slate-600">
                                                        {interview.interview_mode === 'In-person' ? <MapPin className="h-3 w-3 mr-1.5 text-red-500" /> : <Video className="h-3 w-3 mr-1.5 text-blue-500" />}
                                                        {interview.interview_mode}
                                                    </div>
                                                    <div className="flex items-center text-[11px] text-slate-500 font-medium">
                                                        <User className="h-3 w-3 mr-1.5 text-slate-400" />
                                                        {interview.interviewer}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-2">
                                                    {getStatusBadge(interview.status)}
                                                    {interview.status === 'Postponed' && (
                                                        <div className="flex items-center text-[10px] text-orange-600 font-bold gap-1 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 italic">
                                                            <AlertCircle className="h-3 w-3" /> By {interview.postponed_by}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right px-6">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary"
                                                        onClick={() => handleOpenHistory(interview)}
                                                        title="Interview History"
                                                    >
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50"
                                                        onClick={() => handleUpdateStatus(interview.id, 'Completed')}
                                                        disabled={interview.status === 'Completed'}
                                                        title="Mark Completed"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-50"
                                                        onClick={() => { setSelectedInterview(interview); setIsPostponeModalOpen(true); }}
                                                        disabled={interview.status === 'Completed' || interview.status === 'Cancelled'}
                                                        title="Postpone / Reschedule"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100"
                                                        onClick={() => handleUpdateStatus(interview.id, 'Cancelled')}
                                                        disabled={interview.status === 'Completed' || interview.status === 'Cancelled'}
                                                        title="Cancel Interview"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                                        onClick={() => handleDeleteInterview(interview.id)}
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <PostponeInterviewModal
                isOpen={isPostponeModalOpen}
                onOpenChange={setIsPostponeModalOpen}
                interview={selectedInterview}
                onSuccess={fetchInterviews}
            />

            {/* Audit History Modal */}
            <Dialog open={isHistoryOpen} onOpenChange={(v) => { setIsHistoryOpen(v); if(!v) setDialogResetKey(k => k + 1); }}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Interview Timeline
                        </DialogTitle>
                        <DialogDescription>
                            Complete history and audit trail for <strong>{historyInterview?.applicants?.name}</strong>'s interview.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[400px] mt-4 pr-4">
                        {isLogsLoading ? (
                            <div className="flex flex-col items-center justify-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
                                <p className="text-xs text-muted-foreground mt-2">Loading logs...</p>
                            </div>
                        ) : auditLogs.length === 0 ? (
                            <EmptyState title="No History Found" description="There are no history logs for this candidate." />
                        ) : (
                            <div className="space-y-6 relative ml-2">
                                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-100" />
                                {auditLogs.map((log, idx) => (
                                    <div key={log.id} className="relative pl-10">
                                        <div className={`absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 bg-white ${log.action === 'Created' ? 'border-blue-500' :
                                            log.action === 'Postponed' ? 'border-orange-500' :
                                                log.action === 'Completed' ? 'border-green-500' : 'border-slate-400'
                                            }`} />
                                        <div className="flex flex-col">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-slate-900">{log.action}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{format(new Date(log.created_at), 'dd MMM, hh:mm a')}</span>
                                            </div>
                                            <div className="mt-1 p-2 rounded-lg border bg-slate-50/50 text-[11px] text-slate-600 font-medium">
                                                {log.action === 'Postponed' ? (
                                                    <div className="space-y-1">
                                                        <p><strong className="text-orange-600 font-bold uppercase tracking-tighter text-[9px] mr-1">By:</strong> {log.details?.postponed_by}</p>
                                                        <p><strong className="text-primary font-bold uppercase tracking-tighter text-[9px] mr-1">Reason:</strong> {log.details?.reason}</p>
                                                        <p className="pt-1 mt-1 border-t border-slate-200">
                                                            Rescheduled to {log.details?.new_schedule}
                                                        </p>
                                                    </div>
                                                ) : log.action === 'Created' ? (
                                                    <p>Interview scheduled at {log.details?.interview_date} {log.details?.interview_time} with {log.details?.interviewer}.</p>
                                                ) : (
                                                    <p>Status changed to {log.action}.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    <DialogFooter className="border-t pt-4">
                        <DialogClose asChild><Button variant="secondary" size="sm">Close History</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
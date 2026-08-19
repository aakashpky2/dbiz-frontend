'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Play, CheckCircle2, User, Users, Clock, AlertCircle, FileText, Search, Calendar, ChevronRight, Filter, ListTodo, Plus, PlayCircle } from 'lucide-react';
import { sanitizeErrorMessage } from '@/lib/error-utils';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { PageHero } from '@/components/dashboard/page-hero';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/page-skeleton';
import { supabase } from '@/lib/supabase';
import { WorkflowTimelineDrawer } from '@/components/workflow/WorkflowTimelineDrawer';
import { DataTableSkeleton } from '@/components/ui/data-table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useActiveWork } from '@/contexts/ActiveWorkContext';
import { useRouter } from 'next/navigation';
import { isTabDisabled, getFirstVisibleTab } from '@/lib/ui-visibility';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface Task {
    id: string;
    clientName: string;
    workTypeName: string;
    priority: string;
    dueDate: string;
    status: string;
    claimedByName: string | null;
    hasFlow: boolean;
    overallProgress: number;
    assignedTeamId: string | null;
    assignedTeamName?: string;
    [key: string]: any;
}

interface MyTasksData {
    availableTasks: Task[];
    myActiveTasks: Task[];
    teamTasksInProgress: Task[];
    completedTasks: Task[];
}

const normalizeStatus = (status?: string) => {
    if (!status) return '';
    return status.trim().toUpperCase().replace(/[\s-]+/g, '_');
};

const normalizePriority = (priority?: string) =>
    (priority || '').trim().toUpperCase();

const priorityRank: Record<string, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
};

const parseLocalDate = (dateString?: string): Date | null => {
    if (!dateString) return null;

    const datePart = dateString.split('T')[0];
    const parts = datePart.split('-').map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return null;
    }

    const [year, month, day] = parts;
    const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDueDateBadge = (dueDateStr: string | undefined, status: string) => {
    const dueDateOnly = parseLocalDate(dueDateStr);
    if (!dueDateOnly) return null;
    const normStatus = normalizeStatus(status);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = dueDateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return <Badge variant="destructive" className="mt-1 h-5 text-[10px] w-fit">Overdue</Badge>;
    } else if (diffDays === 0) {
        return <Badge variant="default" className="mt-1 h-5 text-[10px] bg-amber-500 hover:bg-amber-600 w-fit">Due Today</Badge>;
    } else if (diffDays <= 2) {
        return <Badge variant="outline" className="mt-1 h-5 text-[10px] border-amber-500 text-amber-600 w-fit">Due Soon</Badge>;
    }
    return null;
};

export default function MyTasksPage() {
    const { user } = useAuth();
    const { hasPermission, loading: permissionLoading } = usePermissions();
    const canViewAllTasks = hasPermission('VIEW_ALL_TASKS');
    const { toast } = useToast();
    const [data, setData] = useState<MyTasksData>({
        availableTasks: [],
        myActiveTasks: [],
        teamTasksInProgress: [],
        completedTasks: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const [timelineExecutionId, setTimelineExecutionId] = useState<string | null>(null);
    
    const router = useRouter();
    const { startWork, activeWork, resumeWork, localElapsed } = useActiveWork();

    // Phase 3 Inactivity Alert States
    const [showInactivityModal, setShowInactivityModal] = useState(false);
    const closeInactivityModal = useCallback(() => {
        setInactivityTask(null);
        setShowInactivityModal(false);
    }, []);

    const [inactivityTask, setInactivityTask] = useState<Task | null>(null);
    const [lastInteraction, setLastInteraction] = useState<number>(Date.now());

    // Parent Level Tabs state
    const [activeParentTab, setActiveParentTab] = useState('my-tasks');
    
    // All Tasks Tab states
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [isAllLoading, setIsAllLoading] = useState(false);
    const [allSearchQuery, setAllSearchQuery] = useState('');

    const [activeTaskTab, setActiveTaskTab] = useState('available');

    // Local Search & Filters State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('DEFAULT');

    const applyFilters = useCallback((tasks: Task[], query: string, status: string, priority: string) => {
        return tasks.filter(task => {
            if (status !== 'ALL' && normalizeStatus(task.status) !== normalizeStatus(status)) return false;
            if (priority !== 'ALL' && normalizePriority(task.priority) !== normalizePriority(priority)) return false;
            if (query) {
                const q = query.toLowerCase();
                const matches = (
                    (task.clientName || task.client_name || '').toLowerCase().includes(q) ||
                    (task.workTypeName || task.work_type_name || '').toLowerCase().includes(q) ||
                    (task.assignedTeamName || '').toLowerCase().includes(q) ||
                    (task.claimedByName || '').toLowerCase().includes(q) ||
                    (task.title || '').toLowerCase().includes(q) ||
                    ((task as any).assignedEmployeeName || (task as any).assigneeName || '').toLowerCase().includes(q)
                );
                if (!matches) return false;
            }
            return true;
        });
    }, []);

    const sortTasks = useCallback((tasks: Task[]) => {
        if (sortBy === 'DEFAULT') return [...tasks];
        return [...tasks].sort((a, b) => {
            if (sortBy === 'DUE_DATE_EARLIEST') {
                const aValid = !!parseLocalDate(a.dueDate);
                const bValid = !!parseLocalDate(b.dueDate);
                if (!aValid && !bValid) return 0;
                if (!aValid) return 1;
                if (!bValid) return -1;
                return parseLocalDate(a.dueDate)!.getTime() - parseLocalDate(b.dueDate)!.getTime();
            }
            if (sortBy === 'DUE_DATE_LATEST') {
                const aValid = !!parseLocalDate(a.dueDate);
                const bValid = !!parseLocalDate(b.dueDate);
                if (!aValid && !bValid) return 0;
                if (!aValid) return 1;
                if (!bValid) return -1;
                return parseLocalDate(b.dueDate)!.getTime() - parseLocalDate(a.dueDate)!.getTime();
            }
            if (sortBy === 'PRIORITY') {
                const aP = priorityRank[normalizePriority(a.priority)] || 0;
                const bP = priorityRank[normalizePriority(b.priority)] || 0;
                return bP - aP;
            }
            if (sortBy === 'CLIENT_NAME') {
                const aClient = (a.clientName || (a as any).client_name || '').toLowerCase();
                const bClient = (b.clientName || (b as any).client_name || '').toLowerCase();
                return aClient.localeCompare(bClient);
            }
            if (sortBy === 'WORK_TYPE') {
                const aType = (a.workTypeName || (a as any).work_type_name || '').toLowerCase();
                const bType = (b.workTypeName || (b as any).work_type_name || '').toLowerCase();
                return aType.localeCompare(bType);
            }
            if (sortBy === 'STATUS') {
                const aStatus = (a.status || '').toLowerCase();
                const bStatus = (b.status || '').toLowerCase();
                return aStatus.localeCompare(bStatus);
            }
            return 0;
        });
    }, [sortBy]);

    const filteredAvailableTasks = React.useMemo(() => sortTasks(applyFilters(data.availableTasks, searchQuery, statusFilter, priorityFilter)), [applyFilters, data.availableTasks, searchQuery, statusFilter, priorityFilter, sortTasks]);
    const filteredMyActiveTasks = React.useMemo(() => sortTasks(applyFilters(data.myActiveTasks, searchQuery, statusFilter, priorityFilter)), [applyFilters, data.myActiveTasks, searchQuery, statusFilter, priorityFilter, sortTasks]);
    const filteredTeamTasks = React.useMemo(() => sortTasks(applyFilters(data.teamTasksInProgress, searchQuery, statusFilter, priorityFilter)), [applyFilters, data.teamTasksInProgress, searchQuery, statusFilter, priorityFilter, sortTasks]);
    const filteredCompletedTasks = React.useMemo(() => sortTasks(applyFilters(data.completedTasks, searchQuery, statusFilter, priorityFilter)), [applyFilters, data.completedTasks, searchQuery, statusFilter, priorityFilter, sortTasks]);

    const summaryStats = React.useMemo(() => {
        const allLocal = [...data.availableTasks, ...data.myActiveTasks, ...data.teamTasksInProgress, ...data.completedTasks];
        const uniqueTasks = Array.from(new Map(allLocal.map(item => [item.id, item])).values());
        
        let active = 0;
        let overdue = 0;
        let dueToday = 0;
        let inReview = 0;
        let totalCompleted = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        uniqueTasks.forEach(t => {
            const normStatus = normalizeStatus(t.status);
            const isCompleted = ['COMPLETED', 'REJECTED', 'CANCELLED', 'CANCELED', 'ARCHIVED'].includes(normStatus);
            
            if (!isCompleted) {
                active++;
            }

            if (normStatus === 'COMPLETED') {
                totalCompleted++;
            }

            if (normStatus === 'SUBMITTED_FOR_REVIEW') {
                inReview++;
            }

            if (!isCompleted && t.dueDate) {
                const due = parseLocalDate(t.dueDate);
                if (due) {
                    const diffTime = due.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) overdue++;
                    else if (diffDays === 0) dueToday++;
                }
            }
        });

        return { active, overdue, dueToday, inReview, totalCompleted };
    }, [data]);

    const escapeCSV = (field: unknown) =>
        `"${String(field ?? '').replace(/"/g, '""')}"`;

    const getActiveTasks = useCallback(() => {
        if (activeTaskTab === 'available') return filteredAvailableTasks;
        if (activeTaskTab === 'mine') return filteredMyActiveTasks;
        if (activeTaskTab === 'others') return filteredTeamTasks;
        if (activeTaskTab === 'completed') return filteredCompletedTasks;
        return [];
    }, [activeTaskTab, filteredAvailableTasks, filteredMyActiveTasks, filteredTeamTasks, filteredCompletedTasks]);

    const exportToCSV = useCallback(() => {
        const tasksToExport = getActiveTasks();
        if (tasksToExport.length === 0) {
            toast({ title: "No tasks", description: "There are no tasks to export.", variant: "default" });
            return;
        }

        const headers = [
            "Task Title",
            "Client",
            "Work Type",
            "Assigned To",
            "Claimed By",
            "Completed By",
            "Assigned Team",
            "Priority",
            "Status",
            "Due Date",
            "Progress"
        ];
        
        const rows = tasksToExport.map(task => {
            const taskTitle = task.title || (task as any).display_work_name || 'Untitled Task';
            const client = task.clientName || (task as any).client_name || '—';
            const workType = task.workTypeName || (task as any).work_type_name || '—';
            const assignedTo = (task as any).assignedEmployeeName || (task as any).assigneeName || '—';
            const claimedBy = (task as any).claimedByName || '—';
            const completedBy = (task as any).completedByName || '—';
            const assignedTeam = (task as any).assignedTeamName || '—';
            
            const priority = task.priority || 'Medium';
            const status = normalizeStatus(task.status).replace(/_/g, ' ');
            const due = task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy') : 'N/A';
            const progress = (task as any).hasFlow ? `${normalizeStatus(task.status) === 'COMPLETED' ? 100 : Math.round(Math.max(0, Math.min(100, Number((task as any).progressPercentage ?? (task as any).overallProgress ?? 0))))}%` : 'No Flow';

            return [taskTitle, client, workType, assignedTo, claimedBy, completedBy, assignedTeam, priority, status, due, progress].map(escapeCSV).join(",");
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [getActiveTasks, toast]);

    useEffect(() => {
        const visibleTabs = [
            { value: 'available', count: data.availableTasks.length, mode: 'disable' as const },
            { value: 'mine', count: data.myActiveTasks.length, mode: 'disable' as const },
            { value: 'others', count: data.teamTasksInProgress.length, mode: 'disable' as const },
            { value: 'completed', count: data.completedTasks.length, mode: 'disable' as const },
        ];
        const activeTabObj = visibleTabs.find(t => t.value === activeTaskTab);
        if (activeTabObj && isTabDisabled(activeTabObj.count, activeTabObj.mode)) {
            const first = getFirstVisibleTab(visibleTabs);
            if (first) setActiveTaskTab(first);
        }
    }, [data, activeTaskTab]);

    const fetchData = useCallback(async () => {
        if (!user?.uid) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/tasks/my?employeeId=${user.uid}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.uid,
                    'x-user-email': user.email || ''
                }
            });
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) {
                const fetched = result.data;
                setData({
                    availableTasks: fetched.filter((t: any) => t.status === 'AVAILABLE' || t.status === 'Pending'),
                    myActiveTasks: fetched.filter((t: any) => ['CLAIMED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'REOPENED'].includes(t.status)),
                    teamTasksInProgress: [], // Team unassigned tasks are hidden here unless assigned
                    completedTasks: fetched.filter((t: any) => ['COMPLETED', 'Completed', 'REJECTED'].includes(t.status))
                });
            } else {
                throw new Error(result.error || result.message || 'Failed to fetch tasks');
            }
        } catch (error: any) {
            console.error("Error fetching tasks:", error);
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    const fetchAllTasks = useCallback(async () => {
        if (!user?.uid || !canViewAllTasks) return;
        setIsAllLoading(true);
        try {
            const res = await fetch(`/api/tasks/all?employeeId=${user.uid}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.uid,
                    'x-user-email': user.email || ''
                }
            });
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) {
                setAllTasks(result.data);
            } else {
                throw new Error(result.error || result.message || 'Failed to fetch tasks');
            }
        } catch (error: any) {
            console.error("Error fetching all tasks:", error);
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsAllLoading(false);
        }
    }, [user, canViewAllTasks, toast]);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get('tab');
            if (tabParam === 'all-tasks' && canViewAllTasks) {
                setActiveParentTab('all-tasks');
            } else {
                setActiveParentTab('my-tasks');
            }
        }
    }, [canViewAllTasks, fetchAllTasks, fetchData]);

    useEffect(() => {
        fetchData();

        // Phase 12: Realtime Subscriptions
        const worksChannel = supabase
            .channel('works_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'works' }, () => {
                if (activeParentTab === 'my-tasks') {
                    fetchData();
                } else {
                    fetchAllTasks();
                }
            })
            .subscribe();

        const assignmentsChannel = supabase
            .channel('assignments_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_member_assignments' }, () => {
                if (activeParentTab === 'my-tasks') {
                    fetchData();
                } else {
                    fetchAllTasks();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(worksChannel);
            supabase.removeChannel(assignmentsChannel);
        };
    }, [fetchData, fetchAllTasks, activeParentTab]);

    // Phase 3 Inactivity Detection Engine
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes default
    const REPEAT_ALERT_INTERVAL = 5 * 60 * 1000; // 5 minutes default

    const resetInteraction = useCallback(() => {
        setLastInteraction(Date.now());
    }, []);

    // Set up interaction listeners
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const events = ['mousemove', 'keydown', 'click', 'scroll'];
        
        events.forEach(event => {
            window.addEventListener(event, resetInteraction, { passive: true });
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // Background instantly sets tab status to inactive
            } else {
                setLastInteraction(Date.now());
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, resetInteraction);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [resetInteraction]);

    // Inactivity scanner loop
    useEffect(() => {
        if (data.myActiveTasks.length === 0) {
            closeInactivityModal();
            setInactivityTask(null);
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const inactiveDuration = now - lastInteraction;
            const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

            if (inactiveDuration >= INACTIVITY_TIMEOUT || isTabHidden) {
                if (!showInactivityModal) {
                    setInactivityTask(data.myActiveTasks[0]);
                    setShowInactivityModal(true);
                }
            }
        }, 10000); // Scans every 10 seconds for lightning fast accuracy

        return () => clearInterval(interval);
    }, [data.myActiveTasks, lastInteraction, showInactivityModal, closeInactivityModal]);

    // Repeat alert interval handler
    useEffect(() => {
        let repeatInterval: NodeJS.Timeout;

        if (showInactivityModal && inactivityTask) {
            repeatInterval = setInterval(() => {
                toast({
                    title: "Active task still running",
                    description: `Reminder: You have an active task in progress: ${inactivityTask.work_type_name} for ${inactivityTask.client_name}`,
                    variant: "destructive"
                });
            }, REPEAT_ALERT_INTERVAL);
        }

        return () => {
            if (repeatInterval) clearInterval(repeatInterval);
        };
    }, [showInactivityModal, inactivityTask, toast]);

    const handleClaim = async (workId: string) => {
        if (!user?.uid) return;
        setIsActionLoading(workId);
        try {
            const res = await fetch(`/api/tasks/${workId}/claim`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': user.uid,
                    'x-user-email': user.email || ''
                },
                body: JSON.stringify({ employeeId: user.uid })
            });
            const result = await res.json();
            if (result.success) {
                await fetchData();
                await fetchAllTasks();
                toast({ title: "Success", description: "Task claimed and started!" });
            } else {
                toast({ 
                    title: "Claim Failed", 
                    description: result.error || 'Failed to claim task', 
                    variant: "destructive" 
                });
                fetchData();
                fetchAllTasks();
            }
        } catch (error: any) {
            toast({ 
                title: "Error", 
                description: error.message || 'An unexpected error occurred', 
                variant: "destructive" 
            });
            fetchData();
            fetchAllTasks();
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleComplete = async (workId: string) => {
        if (!user?.uid) return;
        setIsActionLoading(workId);
        try {
            const res = await fetch(`/api/tasks/${workId}/complete`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': user.uid,
                    'x-user-email': user.email || ''
                },
                body: JSON.stringify({ employeeId: user.uid })
            });
            const result = await res.json();
            if (result.success) {
                await fetchData();
                await fetchAllTasks();
toast({ title: "Success", description: "Task marked as completed!" });
            } else {
                throw new Error(result.error || 'Failed to complete task');
            }
        } catch (error: any) {
            toast({ title: "Error", description: sanitizeErrorMessage(error, "Failed to update task."), variant: "destructive" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleStartTaskFlow = async (taskId: string, isCompleted: boolean, e: React.MouseEvent) => {
        e.preventDefault();
        if (isCompleted) return;
        
        if (activeWork && activeWork.task_id === taskId) {
            if (activeWork.status === 'paused') {
                try {
                    await resumeWork(activeWork.id);
                } catch (err) {
                    toast({ title: "Error", description: "Could not resume work.", variant: "destructive" });
                    return;
                }
            }
            router.push(`/dashboard/work-register/my-tasks/${taskId}`);
            return;
        }

        try {
            await startWork(taskId);
            router.push(`/dashboard/work-register/my-tasks/${taskId}`);
        } catch (err: any) {
            toast({ title: "Error Starting Work", description: err.message || "Another task might be running.", variant: "destructive" });
        }
    };

    const getButtonInfo = (taskId: string, status: string) => {
        const isCompleted = normalizeStatus(status) === 'COMPLETED';
        const isRejected = normalizeStatus(status) === 'REJECTED';
        if (isCompleted) {
            return { label: 'Completed', disabled: true, icon: <CheckCircle2 className="h-3 w-3 mr-1" /> };
        }
        if (isRejected) {
            return { label: 'Rejected', disabled: true, icon: <AlertCircle className="h-3 w-3 mr-1" /> };
        }
        if (activeWork && activeWork.task_id === taskId) {
            if (activeWork.status === 'in_progress') return { label: 'View Active Task', disabled: false, icon: <PlayCircle className="h-3 w-3 mr-1" /> };
            if (activeWork.status === 'paused') return { label: 'Continue Task', disabled: false, icon: <Play className="h-3 w-3 mr-1" /> };
        }
        return { label: 'Start Task', disabled: false, icon: <FileText className="h-3 w-3 mr-1" /> };
    };

    const filteredAllTasks = allTasks.filter(task => {
        if (!allSearchQuery) return true;
        const q = allSearchQuery.toLowerCase();
        return (
            (task.client_name || '').toLowerCase().includes(q) ||
            (task.work_type_name || '').toLowerCase().includes(q) ||
            (task.assigned_team?.name || '').toLowerCase().includes(q) ||
            (task.current_handler?.full_name || '').toLowerCase().includes(q) ||
            (task.priority || '').toLowerCase().includes(q) ||
            (task.workflow_status || '').toLowerCase().includes(q)
        );
    });

    const TaskTable = ({ tasks, type, isLoading }: { tasks: Task[], type: 'available' | 'mine' | 'others' | 'completed', isLoading?: boolean }) => {
        if (isLoading) {
            return (
                <Card className="shadow-sm border">
                    <CardContent className="p-0">
                        <TableSkeleton columns={7} rows={5} />
                    </CardContent>
                </Card>
            );
        }
        return (
        <Card className="shadow-sm border">
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="font-bold">Work Detail</TableHead>
                            <TableHead className="font-bold">Client & Team</TableHead>
                            <TableHead className="font-bold">Due Date</TableHead>
                            <TableHead className="font-bold">Priority</TableHead>
                            <TableHead className="font-bold">Status</TableHead>
                            <TableHead className="font-bold">Progress</TableHead>
                            <TableHead className="text-right font-bold">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <EmptyState 
                                        title="No tasks found" 
                                        description="There are no tasks available in this category right now." 
                                        icon={<AlertCircle className="h-10 w-10 text-muted-foreground" />}
                                        className="border-0 rounded-none bg-transparent"
                                    />
                                </TableCell>
                            </TableRow>
                        ) : tasks.map(task => (
                            <TableRow key={task.id} className="hover:bg-muted/5 transition-colors">
                                <TableCell>
                                    <div className="flex flex-col">
                                         <div className="flex items-center gap-2 mb-1">
                                             <span className="font-bold text-foreground">{task.title || (task as any).display_work_name || 'Untitled Task'}</span>
                                             {(task as any).hasFlow ? (
                                                 <StatusBadge status="FLOW WORK" />
                                             ) : (
                                                 <StatusBadge status="NO FLOW WORK" />
                                             )}
                                         </div>
                                        <span className="text-xs text-primary font-medium">{(task as any).workTypeName || (task as any).work_type_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <span className="font-semibold text-foreground text-sm truncate max-w-[150px]" title={task.clientName || (task as any).client_name}>{task.clientName || (task as any).client_name}</span>
                                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border w-fit" title={(task as any).assignedTeamName || 'No Team'}>
                                            <Users className="h-3 w-3 mr-1 shrink-0" /> 
                                            <span className="truncate max-w-[120px]">{(task as any).assignedTeamName || 'No Team'}</span>
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col text-xs">
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                            <Clock className="h-3 w-3" /> Due: {(task as any).dueDate && parseLocalDate((task as any).dueDate) ? format(parseLocalDate((task as any).dueDate)!, 'dd MMM') : 'N/A'}
                                        </span>
                                        {getDueDateBadge((task as any).dueDate, task.status)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={task.priority || 'Medium'} />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <StatusBadge status={normalizeStatus(task.status).replace(/_/g, ' ')} />
                                        {((task as any).assignedEmployeeName || (task as any).assigneeName) && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <User className="h-2 w-2" /> Assigned to: {(task as any).assignedEmployeeName || (task as any).assigneeName}
                                            </span>
                                        )}
                                        {(task as any).claimedByName && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <User className="h-2 w-2" /> Claimed by: {(task as any).claimedByName}
                                            </span>
                                        )}
                                        {(task as any).completedByName && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <User className="h-2 w-2" /> Completed by: {(task as any).completedByName}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {!(task as any).hasFlow ? (
                                        <span className="text-xs text-muted-foreground">No Flow</span>
                                    ) : normalizeStatus(task.status) === 'COMPLETED' ? (
                                        <span className="text-xs font-medium text-emerald-600">100%</span>
                                    ) : (
                                        <span className="text-xs font-medium text-primary">
                                            {Math.round(Math.max(0, Math.min(100, Number((task as any).progressPercentage ?? (task as any).overallProgress ?? 0))))}%
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2 items-center">
                                        <Link href={`/dashboard/work-register/my-tasks/${task.id}`} onClick={(e) => handleStartTaskFlow(task.id, ['COMPLETED', 'REJECTED'].includes(normalizeStatus(task.status)), e)}>
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                disabled={getButtonInfo(task.id, task.status).disabled}
                                                className="border-indigo-600 text-primary hover:bg-muted/50 h-8 font-bold text-xs"
                                            >
                                                {getButtonInfo(task.id, task.status).icon} {getButtonInfo(task.id, task.status).label}
                                            </Button>
                                        </Link>
                                        {type === 'available' && hasPermission('CLAIM_TASKS') && (
                                            <Button 
                                                size="sm" 
                                                onClick={() => handleClaim(task.id)}
                                                disabled={!!isActionLoading}
                                                className="bg-primary hover:bg-primary/90 h-8 px-4 font-bold"
                                            >
                                                {isActionLoading === task.id ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Play className="h-3 w-3 mr-2 fill-current" />}
                                                Claim Work
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

    if (isLoading && activeParentTab === 'my-tasks') {
        return (
            <div className="space-y-6 pb-20">
                <PageHero
                pattern="pattern-7"
                    icon={ListTodo}
                    badge="TASKS"
                    title="Tasks"
                    description="Manage your assigned tasks and monitor team-wide task progress."
                />
                <DataTableSkeleton columnCount={6} rowCount={5} title="Loading tasks..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <PageHero
                icon={ListTodo}
                badge="TASKS"
                title="Tasks"
                description="Manage your assigned tasks and monitor team-wide task progress."
            >
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={activeParentTab === 'my-tasks' ? fetchData : fetchAllTasks} 
                    className="font-bold"
                >
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync
                </Button>
            </PageHero>

            {activeWork && ['in_progress', 'paused'].includes(activeWork.status) && !['COMPLETED', 'REJECTED'].includes(normalizeStatus((activeWork as any).task_status)) && (
                <div className="bg-muted/50 border border-border dark:bg-indigo-950/20 dark:border-indigo-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full shrink-0 ${activeWork.status === 'paused' ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                        <div>
                            <h3 className="text-sm font-bold text-foreground dark:text-slate-100 uppercase tracking-wider">
                                Current Task: {activeWork.status === 'paused' ? 'Paused' : 'In Progress'}
                            </h3>
                            <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                                {activeWork.title || (activeWork as any).display_work_name || 'Working...'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">Elapsed Time</span>
                            <span className="text-xl font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                {Math.floor(localElapsed / 3600).toString().padStart(2, '0')}:
                                {Math.floor((localElapsed % 3600) / 60).toString().padStart(2, '0')}:
                                {(localElapsed % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                        <Button 
                            variant="default" 
                            className="bg-primary hover:bg-primary/90 font-bold shadow-md"
                            onClick={() => {
                                if (activeWork.task_id) router.push(`/dashboard/work-register/my-tasks/${activeWork.task_id}`);
                            }}
                        >
                            View Task
                        </Button>
                    </div>
                </div>
            )}

            <Tabs 
                value={activeParentTab} 
                onValueChange={(val) => {
                    setActiveParentTab(val);
                    if (val === 'my-tasks') {
                    } else {
                        fetchAllTasks();
                    }
                }} 
                className="w-full"
            >
                <TabsList className="bg-muted p-1 mb-6 flex w-fit gap-2 h-11">
                    <TabsTrigger 
                        value="my-tasks" 
                        className="font-bold px-6 py-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
                    >
                        My Tasks
                    </TabsTrigger>
                    {canViewAllTasks && (
                        <TabsTrigger 
                            value="all-tasks" 
                            className="font-bold px-6 py-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
                        >
                            All Tasks
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="my-tasks">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <Card className="shadow-sm border-l-4 border-l-blue-500">
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Tasks</p>
                                <h3 className="text-2xl font-black text-foreground mt-1">{summaryStats.active}</h3>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-l-4 border-l-red-500">
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overdue</p>
                                <h3 className="text-2xl font-black text-foreground mt-1">{summaryStats.overdue}</h3>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-l-4 border-l-amber-500">
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Today</p>
                                <h3 className="text-2xl font-black text-foreground mt-1">{summaryStats.dueToday}</h3>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-l-4 border-l-indigo-500">
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Review</p>
                                <h3 className="text-2xl font-black text-foreground mt-1">{summaryStats.inReview}</h3>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-l-4 border-l-emerald-500">
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Completed</p>
                                <h3 className="text-2xl font-black text-foreground mt-1">{summaryStats.totalCompleted}</h3>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm border mb-4">
                        <CardHeader className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/50/50">
                            <CardTitle className="text-base font-bold flex items-center gap-2 shrink-0">
                                Filter & Sort Tasks
                            </CardTitle>
                            <div className="flex flex-col md:flex-row gap-2 flex-1 md:justify-end md:items-center w-full">
                                <div className="relative w-full md:max-w-[200px]">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search my tasks..."
                                        className="pl-9 h-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <select 
                                    className="flex h-9 w-full md:max-w-[130px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={statusFilter} 
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="AVAILABLE">Available</option>
                                    <option value="CLAIMED">Claimed</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="SUBMITTED_FOR_REVIEW">Review</option>
                                    <option value="COMPLETED">Completed</option>
                                </select>
                                <select 
                                    className="flex h-9 w-full md:max-w-[130px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={priorityFilter} 
                                    onChange={(e) => setPriorityFilter(e.target.value)}
                                >
                                    <option value="ALL">All Priorities</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                                <select 
                                    className="flex h-9 w-full md:max-w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={sortBy} 
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="DEFAULT">Existing Order</option>
                                    <option value="DUE_DATE_EARLIEST">Due Date: Earliest</option>
                                    <option value="DUE_DATE_LATEST">Due Date: Latest</option>
                                    <option value="PRIORITY">Priority</option>
                                    <option value="CLIENT_NAME">Client Name</option>
                                    <option value="WORK_TYPE">Work Type</option>
                                    <option value="STATUS">Status</option>
                                </select>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    disabled={getActiveTasks().length === 0}
                                    className="h-9 whitespace-nowrap bg-card font-semibold disabled:opacity-50"
                                    onClick={exportToCSV}
                                >
                                    Export CSV
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>

                    <Tabs value={activeTaskTab} onValueChange={setActiveTaskTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-4 h-12 bg-muted p-1">
                            <TabsTrigger value="available" disabled={isTabDisabled(data?.availableTasks?.length || 0, 'disable')} className="font-bold data-[state=active]:bg-card data-[state=active]:text-primary">
                                Available Team Tasks ({data?.availableTasks?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="mine" disabled={isTabDisabled(data?.myActiveTasks?.length || 0, 'disable')} className="font-bold data-[state=active]:bg-card data-[state=active]:text-primary">
                                My Active Tasks ({data?.myActiveTasks?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="others" disabled={isTabDisabled(data?.teamTasksInProgress?.length || 0, 'disable')} className="font-bold data-[state=active]:bg-card data-[state=active]:text-primary">
                                Team Tasks In Progress ({data?.teamTasksInProgress?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="completed" disabled={isTabDisabled(data?.completedTasks?.length || 0, 'disable')} className="font-bold data-[state=active]:bg-card data-[state=active]:text-primary">
                                Completed Tasks ({data?.completedTasks?.length || 0})
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-6">
                            <TabsContent value="available">
                                <TaskTable tasks={filteredAvailableTasks} type="available" isLoading={isLoading} />
                            </TabsContent>
                            <TabsContent value="mine">
                                <TaskTable tasks={filteredMyActiveTasks} type="mine" isLoading={isLoading} />
                            </TabsContent>
                            <TabsContent value="others">
                                <TaskTable tasks={filteredTeamTasks} type="others" isLoading={isLoading} />
                            </TabsContent>
                            <TabsContent value="completed">
                                <TaskTable tasks={filteredCompletedTasks} type="completed" isLoading={isLoading} />
                            </TabsContent>
                        </div>
                    </Tabs>
                </TabsContent>

                {canViewAllTasks && (
                    <TabsContent value="all-tasks">
                        <Card className="shadow-sm border">
                            <CardHeader className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/50/50">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    All System & Team Tasks
                                </CardTitle>
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search all tasks..."
                                        className="pl-9 h-9"
                                        value={allSearchQuery}
                                        onChange={(e) => setAllSearchQuery(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold">Work Detail</TableHead>
                                            <TableHead className="font-bold">Team</TableHead>
                                            <TableHead className="font-bold">Assigned To / Claimant</TableHead>
                                            <TableHead className="font-bold">Overall Progress</TableHead>
                                            <TableHead className="font-bold">Priority</TableHead>
                                            <TableHead className="font-bold">Status</TableHead>
                                            <TableHead className="text-right font-bold">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isAllLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="p-0">
                                                    <DataTableSkeleton columnCount={7} rowCount={5} />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredAllTasks.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="p-0">
                                                    <EmptyState 
                                                        title="No tasks found" 
                                                        description="No tasks match your search or exist in the system database." 
                                                        icon={<AlertCircle className="h-10 w-10 text-muted-foreground" />}
                                                        className="border-0 rounded-none bg-transparent"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredAllTasks.map(task => (
                                            <TableRow key={task.id} className="hover:bg-muted/5 transition-colors">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                         <div className="flex items-center gap-2">
                                                             <span className="font-bold text-foreground">{(task as any).clientName}</span>
                                                             {(task as any).hasFlow ? (
                                                                 <StatusBadge status="FLOW WORK" />
                                                             ) : (
                                                                 <StatusBadge status="NO FLOW WORK" />
                                                             )}
                                                         </div>
                                                        <span className="text-xs text-primary font-medium">{(task as any).workTypeName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border" title={(task as any).assignedTeamName || 'No Team'}>
                                                        <Users className="h-3 w-3 mr-1 shrink-0" /> 
                                                        <span className="truncate max-w-[120px]">{(task as any).assignedTeamName || 'No Team'}</span>
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {normalizeStatus(task.status) === 'COMPLETED' && (task as any).completedByName ? (
                                                        <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                                                            <User className="h-3 w-3 text-muted-foreground" /> Completed by: {(task as any).completedByName}
                                                        </span>
                                                    ) : (task as any).claimedByName ? (
                                                        <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                                                            <User className="h-3 w-3 text-muted-foreground" /> Claimed by: {(task as any).claimedByName}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">Unclaimed</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {(task as any).hasFlow ? (
                                                        <div className="flex items-center gap-2 w-28">
                                                            <div className="w-full bg-muted rounded-full h-1.5 dark:bg-primary/90">
                                                                <div 
                                                                    className="bg-primary h-1.5 rounded-full" 
                                                                    style={{ width: `${normalizeStatus(task.status) === 'COMPLETED' ? 100 : Math.max(0, Math.min(100, Number((task as any).progressPercentage ?? (task as any).overallProgress ?? 0)))}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-[10px] font-black text-foreground">{normalizeStatus(task.status) === 'COMPLETED' ? 100 : Math.round(Math.max(0, Math.min(100, Number((task as any).progressPercentage ?? (task as any).overallProgress ?? 0))))}%</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No Flow</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={task.priority || 'Medium'} />
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={normalizeStatus(task.status).replace(/_/g, ' ')} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/dashboard/work-register/my-tasks/${task.id}`} onClick={(e) => handleStartTaskFlow(task.id, ['COMPLETED', 'REJECTED'].includes(normalizeStatus(task.status)), e)}>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            disabled={getButtonInfo(task.id, task.status).disabled}
                                                            className="border-indigo-600 text-primary hover:bg-muted/50 h-8 font-bold text-xs"
                                                        >
                                                            {getButtonInfo(task.id, task.status).icon} {getButtonInfo(task.id, task.status).label}
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>

            {/* Phase 3 Inactivity Red Alert Modal Overlay */}
            {showInactivityModal && inactivityTask && (
                <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl border-red-200 border-2 overflow-hidden bg-card">
                        <div className="bg-red-600 p-6 text-white relative">
                            <div className="absolute right-4 top-4 bg-red-700/50 text-white rounded-full p-1.5 animate-ping duration-1000">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-8 w-8 text-white shrink-0" />
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Active task still running</h3>
                                    <p className="text-[11px] text-red-100 uppercase font-black tracking-wider mt-0.5">Inactivity Detected</p>
                                </div>
                            </div>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div className="text-muted-foreground text-sm font-medium leading-relaxed">
                                You have an active task in progress: <strong className="text-foreground block mt-1 font-extrabold text-base bg-muted/50 p-3 rounded-lg border">{inactivityTask.work_type_name} <span className="text-xs text-primary font-bold block mt-1">for {inactivityTask.client_name}</span></strong>
                            </div>
                            <p className="text-xs text-muted-foreground font-semibold italic">
                                Are you still working on this task?
                            </p>
                            
                            <div className="flex flex-col gap-2 mt-4">
                                <Button 
                                    onClick={() => {
                                        resetInteraction();
                                        closeInactivityModal();
                                        toast({ title: "Inactivity Reset", description: "Activity confirmed. Timer has been reset." });
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold w-full py-5 text-sm"
                                >
                                    I am working
                                </Button>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                        variant="outline"
                                        onClick={() => {
                                            closeInactivityModal();
                                            if (inactivityTask.is_v2 && inactivityTask.execution_instance_id) {
                                                setTimelineExecutionId(inactivityTask.execution_instance_id);
                                            } else {
                                                toast({ title: "Focused Task", description: "Task focused in your Active tasks tab." });
                                            }
                                        }}
                                        className="border-border text-foreground font-bold"
                                    >
                                        View Task
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        onClick={() => {
                                            closeInactivityModal();
                                            handleComplete(inactivityTask.id);
                                        }}
                                        className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold"
                                    >
                                        Complete Task
                                    </Button>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setShowInactivityModal(false)}
                                    className="text-muted-foreground hover:text-muted-foreground text-xs font-semibold mt-1"
                                >
                                    Close
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <WorkflowTimelineDrawer
                isOpen={!!timelineExecutionId}
                onClose={() => setTimelineExecutionId(null)}
                executionInstanceId={timelineExecutionId}
                currentUserId={user?.uid || null}
                onActionCompleted={activeParentTab === 'my-tasks' ? fetchData : fetchAllTasks}
            />

        </div>
    );
}

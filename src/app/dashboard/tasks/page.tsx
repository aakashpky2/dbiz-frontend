
'use client';
import { PageSkeleton } from '@/components/ui/page-skeleton';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ListTodo, Eye, PlusCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTaskDialog } from '@/components/tasks/add-task-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { fetchWithCache, clearCache } from '@/lib/fetcher';

export interface AssignedWork {
    id: string;
    clientId: string;
    clientName: string; // or context
    title: string;
    description?: string;
    dueDate: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    priority?: 'Low' | 'Medium' | 'High';
    assignedTo: string[]; // Array of user IDs
    assignedToNames: string[]; // Array of user Names for display
}

export default function MyTasksPage() {
    const { user } = useAuth();
    const { hasPermission, loading: permLoading } = usePermissions();
    const router = useRouter();
    const { toast } = useToast();
    const [tasks, setTasks] = useState<AssignedWork[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const canViewTasks = hasPermission('VIEW_TASKS');

    useEffect(() => {
        if (!permLoading && !canViewTasks) {
            toast({ title: "Access Denied", description: "You do not have permission to view tasks.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canViewTasks, router, toast]);

    const refreshPageData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // Fetch Users to map IDs to Names (Cached)
            const empData = await fetchWithCache('/api/employees?limit=1000&fields=id,full_name');
            const userMap: Record<string, string> = {};
            const employeesList = empData.data || (Array.isArray(empData) ? empData : (empData.employees || []));
            employeesList.forEach((emp: any) => {
                userMap[emp.id] = (emp.personalDetails?.fullName || emp.full_name || 'Unknown');
            });

            // Fetch Real Tasks (Cached)
            const taskResponse = await fetchWithCache('/api/tasks');
            console.log("[Tasks] response", taskResponse);
            
            const loadedTasks = Array.isArray(taskResponse) ? taskResponse : (taskResponse?.data || []);

            if (loadedTasks && Array.isArray(loadedTasks)) {
                const tasksWithNames = (loadedTasks as AssignedWork[]).map(task => {
                    const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : [];
                    const assignedNames = assignedIds.map((id: string) => userMap[id] || 'Unknown');

                    return {
                        ...task,
                        assignedToNames: assignedNames,
                    };
                });

                // Filter tasks visible to the user:
                // 1. Assigned to user
                const myTasks = tasksWithNames.filter(t =>
                    t.assignedTo.includes(user.uid)
                    // || t.createdBy === user.uid // Optional: show tasks I created even if not assigned
                );

                // Sort by due date
                myTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                setTasks(myTasks);
            } else {
                setTasks([]);
            }
        } catch (error) {
            console.error("Error fetching tasks:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        refreshPageData();
    }, [refreshPageData]);


    if (isLoading) {
        return <div className="p-6"><PageSkeleton /></div>;
    }

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="My Tasks"
                description="Work items assigned to you and your team."
            >
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={async () => { clearCache(); await refreshPageData(); }} className="h-9 px-3 font-bold border-muted-foreground/20">
                        <RefreshCw className="h-4 w-4 mr-2" /> Reload
                    </Button>
                    {hasPermission('MANAGE_WORK') && <AddTaskDialog />}
                </div>
            </DashboardPageHeader>

            <DashboardFilterBar>
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search tasks..."
                        className="pl-9 h-10 bg-background border-muted-foreground/20"
                    />
                </div>
            </DashboardFilterBar>

            <Card className="shadow-sm border">
                <CardHeader className="py-4 border-b border-border/50 bg-muted/5">
                    <CardTitle className="text-lg font-bold">Tasks List</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Assignees</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.length > 0 ? tasks.map(task => (
                            <TableRow key={task.id}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{task.title}</span>
                                        {(() => {
                                            const cleanDesc = task.description?.replace(/legacy_work_id:[\w-]+\s*/g, '').trim();
                                            if (!cleanDesc) return null;
                                            return <span className="text-xs text-muted-foreground truncate max-w-[200px]">{cleanDesc}</span>;
                                        })()}
                                    </div>
                                </TableCell>
                                <TableCell>{task.clientName}</TableCell>
                                <TableCell>
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {task.assignedToNames.slice(0, 3).map((name, i) => (
                                            <TooltipProvider key={i}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-xs font-medium text-primary ring-offset-background">
                                                            {name.charAt(0)}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{name}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ))}
                                        {task.assignedToNames.length > 3 && (
                                            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
                                                +{task.assignedToNames.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>{task.dueDate}</TableCell>
                                <TableCell>
                                    {task.priority && (
                                        <Badge variant={task.priority === 'High' ? 'destructive' : task.priority === 'Medium' ? 'default' : 'secondary'}>
                                            {task.priority}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell><Badge variant="outline">{task.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/dashboard/work-register/my-tasks/${task.id}`}>
                                        <Button variant="ghost" size="icon" title="View Task" className="h-8 w-8 text-slate-500 hover:text-indigo-600">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    No tasks assigned to you.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </div>
    );
}

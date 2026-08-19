'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { 
    Users, 
    Briefcase, 
    Search, 
    Loader2, 
    AlertCircle, 
    CheckCircle2, 
    UserPlus, 
    ArrowRightLeft,
    Clock,
    UserCheck,
    ShieldAlert,
    History as HistoryIcon,
    AlertTriangle,
    Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/page-skeleton';
import { PageHero } from '@/components/dashboard/page-hero';
import { format } from 'date-fns';
import { 
    getAssignableMembersForTeam, 
    assignWorkToTeam, 
    reassignWorkToTeam,
    assignWorkItemToMember,
    getUnassignedWorks,
    getTeamAssignedWorks,
    findEligibleTeamsForWork
} from '@/lib/work-assignment';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// --- Types ---
interface WorkRecord {
    id: string;
    client_name: string;
    work_type_name: string;
    department_name: string;
    priority: string;
    due_date: string;
    assignment_status: string;
    assigned_team_id: string | null;
    auto_assigned: boolean;
    client_id: string;
    claimed_at?: string | null;
    department_id: string;
    teams?: { 
        name: string;
        id: string;
    };
    current_handler_id: string | null;
    workflow_status: string;
    current_handler?: {
        full_name: string;
    };
}

export default function AssignWorksPage() {
    const [works, setWorks] = useState<WorkRecord[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('unassigned');
    const [search, setSearch] = useState('');
    const { user } = useAuth();
    const { toast } = useToast();

    // Dialog States
    const [isAssignTeamOpen, setIsAssignTeamOpen] = useState(false);
    const resetAssignTeam = () => {
        setSelectedTeamId('');
        setIsAssignTeamOpen(false);
    };

    const [isAssignMemberOpen, setIsAssignMemberOpen] = useState(false);
    const [selectedWork, setSelectedWork] = useState<WorkRecord | null>(null);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [eligibleTeams, setEligibleTeams] = useState<any[]>([]);
    const [reassignReason, setReassignReason] = useState('');
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const { hasPermission, loading: permLoading } = usePermissions();
    const router = useRouter();
    const canAssignWorks = hasPermission('ASSIGN_WORKS') || hasPermission('ASSIGN_WORK'); // Adjust based on your perm set

    useEffect(() => {
        if (!permLoading && !canAssignWorks) {
            toast({ title: "Access Denied", description: "You do not have permission to access work assignments.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canAssignWorks, router, toast]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Works based on tab (or all for filtering)
            const { data: allWorks, error: worksError } = await supabase
                .from('works')
                .select('*, teams:assigned_team_id(id, name), current_handler:employees!current_handler_id(id, full_name)')
                .order('created_at', { ascending: false });

            if (worksError) {
                console.error('[AssignWorks] Works Fetch Error:', worksError);
                throw worksError;
            }

            // Fetch Teams
            let teamsData = [];
            try {
                const teamsRes = await apiFetch('/api/teams?active=true');
                if (teamsRes.ok) {
                    const resJson = await teamsRes.json();
                    teamsData = resJson.data || [];
                }
            } catch (e) {
                console.error('[AssignWorks] Teams API Fetch Error:', e);
            }

            // Fetch History
            const { data: historyData } = await supabase
                .from('work_assignment_history')
                .select('*, works(client_name, work_type_name), old_team:old_team_id(name), new_team:new_team_id(name), performer:performed_by(full_name)')
                .order('created_at', { ascending: false })
                .limit(50);

            setWorks(allWorks || []);
            setTeams(teamsData || []);
            setHistory(historyData || []);
        } catch (err: any) {
            console.error('[AssignWorks] Error in fetchData:', err);
            const errorMessage = err?.message || (typeof err === 'string' ? err : 'Unknown fetch error');
            toast({ title: "Fetch Error", description: errorMessage, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredWorks = useMemo(() => {
        return works.filter(w => {
            const matchesSearch = 
                w.client_name?.toLowerCase().includes(search.toLowerCase()) ||
                w.work_type_name?.toLowerCase().includes(search.toLowerCase());
            
            if (!matchesSearch) return false;

            if (activeTab === 'unassigned') return w.assignment_status === 'UNASSIGNED' || !w.assigned_team_id;
            if (activeTab === 'assigned_teams') return w.assigned_team_id !== null;
            if (activeTab === 'needs_reassignment') return w.assignment_status === 'NEEDS_REASSIGNMENT';
            
            return true;
        });
    }, [works, activeTab, search]);

    const unassignedCount = useMemo(() => works.filter(w => w.assignment_status === 'UNASSIGNED' || !w.assigned_team_id).length, [works]);
    const assignedCount = useMemo(() => works.filter(w => w.assigned_team_id !== null).length, [works]);
    const reassignmentCount = useMemo(() => works.filter(w => w.assignment_status === 'NEEDS_REASSIGNMENT').length, [works]);
    const historyCount = history.length;

    const visibleTabs = useMemo(() => {
        return [
            unassignedCount > 0 && { value: 'unassigned', label: 'Unassigned', count: unassignedCount, badgeClass: 'bg-slate-100 text-slate-500' },
            assignedCount > 0 && { value: 'assigned_teams', label: 'Assigned to Teams', count: assignedCount, badgeClass: 'bg-blue-100 text-blue-500' },
            reassignmentCount > 0 && { value: 'needs_reassignment', label: 'Needs Reassignment', count: reassignmentCount, badgeClass: 'bg-red-100 text-red-700' },
            historyCount > 0 && { value: 'history', label: 'Assignment History', count: null, badgeClass: '' }
        ].filter(Boolean) as { value: string, label: string, count: number | null, badgeClass: string }[];
    }, [unassignedCount, assignedCount, reassignmentCount, historyCount]);

    useEffect(() => {
        if (!loading && visibleTabs.length > 0 && !visibleTabs.find(t => t.value === activeTab)) {
            setActiveTab(visibleTabs[0]?.value);
        }
    }, [visibleTabs, activeTab, loading]);

    const handleOpenAssignTeam = async (work: WorkRecord) => {
        setSelectedWork(work);
        setSelectedTeamId(work.assigned_team_id || '');
        setReassignReason('');
        setIsAssignTeamOpen(true);
        
        // Find eligible teams
        const eligible = await findEligibleTeamsForWork(work);
        setEligibleTeams(eligible);
    };

    const handleAssignTeam = async () => {
        if (!selectedWork || !selectedTeamId) return;
        setSubmitting(true);
        try {
            let res;
            if (selectedWork.assigned_team_id) {
                res = await reassignWorkToTeam(selectedWork.id, selectedTeamId, user?.uid || '', reassignReason);
            } else {
                res = await assignWorkToTeam(selectedWork.id, selectedTeamId, user?.uid || '');
            }
            
            if (res.success) {
                await fetchData();
                toast({ title: "Success", description: "Assignment updated successfully." });
                resetAssignTeam();
            } else {
                throw res.error || new Error('Unknown error during assignment');
            }
        } catch (err: any) {
            console.error('[AssignWorks] Update Error:', err);
            toast({ title: "Update Failed", description: err.message || 'An error occurred', variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'UNASSIGNED': return <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 uppercase text-[10px] font-black">Unassigned</Badge>;
            case 'TEAM_ASSIGNED': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 uppercase text-[10px] font-black">Team Assigned</Badge>;
            case 'MEMBER_ASSIGNED': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 uppercase text-[10px] font-black">Member Assigned</Badge>;
            case 'NEEDS_REASSIGNMENT': return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200 uppercase text-[10px] font-black">Needs Reassignment</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-2"
                icon={ArrowRightLeft}
                badge="WORK MANAGEMENT"
                title="Work Distribution"
                description="Master control for team and member assignments."
            >
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search client or work..." 
                        className="pl-9 h-11 w-64 rounded-xl border-slate-200 shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </PageHero>

            {!loading && visibleTabs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 mt-6">
                    <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                        <CheckCircle2 className="h-8 w-8 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No work assignments available.</h3>
                    <p className="text-sm text-slate-500 mt-1">All queues and history are completely empty.</p>
                </div>
            ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex items-center justify-between border-b pb-1 overflow-x-auto scrollbar-hide">
                    <TabsList className="bg-transparent h-auto p-0 gap-8 min-w-max">
                        {visibleTabs.map(tab => (
                            <TabsTrigger 
                                key={tab.value}
                                value={tab.value} 
                                className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-3 font-bold uppercase text-[11px] tracking-widest text-slate-400"
                            >
                                {tab.label} {tab.count !== null && <Badge className={cn("ml-2 border-none h-5", tab.badgeClass)}>{tab.count}</Badge>}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="history" className="mt-0">
                    <Card className="border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <HistoryIcon className="h-4 w-4 text-primary" /> System Audit Log
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/30 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                                            <th className="px-6 py-4">Timestamp</th>
                                            <th className="px-6 py-4">Work / Client</th>
                                            <th className="px-6 py-4">Action</th>
                                            <th className="px-6 py-4">Changes</th>
                                            <th className="px-6 py-4">Performed By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {history.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700">{format(new Date(log.created_at), 'dd MMM yyyy')}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-slate-900 uppercase tracking-tight truncate max-w-[200px]">{log.works?.client_name}</span>
                                                        <span className="text-[10px] text-indigo-600 font-bold uppercase">{log.works?.work_type_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white">
                                                        {log.action.replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        {log.old_team?.name && (
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                <span className="text-slate-400">From:</span>
                                                                <span className="font-bold text-slate-600">{log.old_team.name}</span>
                                                            </div>
                                                        )}
                                                        {log.new_team?.name && (
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                <span className="text-slate-400">To:</span>
                                                                <span className="font-bold text-emerald-600">{log.new_team.name}</span>
                                                            </div>
                                                        )}
                                                        {log.reason && <span className="text-[10px] italic text-slate-400 line-clamp-1">"{log.reason}"</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                                                            {log.performer?.full_name?.charAt(0) || 'S'}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-700">{log.performer?.full_name || 'System Auto'}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {history.length === 0 && (
                                    <div className="py-12 text-center">
                                        <p className="text-sm text-slate-400 italic">No assignment history records found.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value={activeTab} className="mt-0">
                    {activeTab !== 'history' && (
                        loading ? (
                            <div className="p-6">
                                <TableSkeleton rows={5} columns={5} />
                            </div>
                        ) : filteredWorks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                                    <CheckCircle2 className="h-8 w-8 text-slate-200" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Queue is empty</h3>
                                <p className="text-sm text-slate-500 mt-1">All works in this category are processed.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredWorks.map(work => (
                                    <Card key={work.id} className="group border-slate-200/60 hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden rounded-3xl">
                                        <div className="flex flex-col md:flex-row md:items-center">
                                            <div className="p-6 flex-grow">
                                                <div className="flex items-start justify-between mb-6">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate max-w-[400px]">{work.client_name}</h3>
                                                            {getStatusBadge(work.assignment_status)}
                                                            {work.auto_assigned && (
                                                                <Badge className="bg-indigo-50 text-indigo-600 border-indigo-200 uppercase font-black text-[9px] tracking-widest px-2">Auto-Assigned</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                                                            <span className="flex items-center gap-1.5 text-indigo-600 font-bold uppercase text-[10px] tracking-wider">
                                                                <Briefcase className="h-3.5 w-3.5" /> {work.work_type_name}
                                                            </span>
                                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                            <span className="text-[11px] font-bold uppercase tracking-tight">{work.department_name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex items-center gap-1.5 text-slate-400 mb-1 justify-end">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Target Due Date</span>
                                                        </div>
                                                        <p className="text-sm font-black text-slate-700">{work.due_date ? format(new Date(work.due_date), 'dd MMM yyyy') : '—'}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsible Team</p>
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "h-10 w-10 rounded-xl flex items-center justify-center shadow-inner",
                                                                work.assigned_team_id ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                                                            )}>
                                                                <Users className="h-5 w-5" />
                                                            </div>
                                                            <span className={cn(
                                                                "text-sm font-bold uppercase tracking-tight",
                                                                work.assigned_team_id ? "text-slate-900" : "text-slate-400 italic"
                                                            )}>
                                                                {work.teams?.name || 'Unassigned'}
                                                            </span>
                                                            {work.assigned_team_id && (
                                                                <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
                                                                    {teams.find(t => t.id === work.assigned_team_id)?.team_members?.[0]?.count || 0} Members
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Workflow & Handler</p>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <Badge className={cn(
                                                                    "text-[9px] font-black uppercase tracking-tight",
                                                                    work.workflow_status === 'AVAILABLE' ? "bg-blue-500" :
                                                                    work.workflow_status === 'CLAIMED' ? "bg-indigo-500" :
                                                                    work.workflow_status === 'IN_PROGRESS' ? "bg-amber-500" :
                                                                    work.workflow_status === 'COMPLETED' ? "bg-emerald-500" : "bg-slate-500"
                                                                )}>
                                                                    {work.workflow_status || 'AVAILABLE'}
                                                                </Badge>
                                                                {work.current_handler ? (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                                                                            <UserCheck className="h-3 w-3 text-emerald-500" /> {work.current_handler.full_name}
                                                                        </span>
                                                                        {work.claimed_at && (
                                                                            <span className="text-[9px] text-slate-400 font-medium">Claimed: {format(new Date(work.claimed_at), 'dd MMM, HH:mm')}</span>
                                                                        )}
                                                                    </div>
                                                                ) : work.assigned_team_id ? (
                                                                    <span className="text-[10px] font-bold text-amber-600 animate-pulse italic">Waiting for team member</span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</p>
                                                        <div className="flex items-center gap-2 h-10">
                                                            <Button 
                                                                size="sm" variant="outline" 
                                                                className="h-9 px-4 rounded-xl font-bold uppercase text-[9px] tracking-widest border-slate-200 hover:bg-slate-50"
                                                                onClick={() => window.open(`/dashboard/work/works?id=${work.id}`, '_blank')}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 mr-1.5" /> View Work
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50/80 border-t md:border-t-0 md:border-l border-slate-100 p-8 flex flex-row md:flex-col gap-3 justify-center min-w-[240px]">
                                                <Button 
                                                    className="w-full h-12 rounded-2xl font-bold uppercase text-[10px] tracking-widest bg-slate-900 hover:bg-primary transition-all shadow-xl shadow-slate-900/10 active:scale-95 group/btn"
                                                    onClick={() => handleOpenAssignTeam(work)}
                                                >
                                                    <UserPlus className="mr-2 h-4 w-4 transition-transform group-hover/btn:scale-110" />
                                                    {work.assigned_team_id ? 'Reassign Team' : 'Assign Team'}
                                                </Button>
                                                
                                                {work.assigned_team_id && (
                                                    <Button 
                                                        variant="outline"
                                                        className="w-full h-12 rounded-2xl font-bold uppercase text-[10px] tracking-widest border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-95 group/btn"
                                                        onClick={() => window.location.href = `/dashboard/employee-management/team-management?team=${work.assigned_team_id}&work=${work.id}`}
                                                    >
                                                        <ArrowRightLeft className="mr-2 h-4 w-4 transition-transform group-hover/btn:rotate-180 duration-500" />
                                                        Member Allocation
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )
                    )}
                </TabsContent>
            </Tabs>
            )}

            {/* --- Dialogs --- */}

            {/* Assign Team Dialog */}
            <Dialog open={isAssignTeamOpen} onOpenChange={(v) => { if (!v) resetAssignTeam(); else setIsAssignTeamOpen(v); }}>
                <DialogContent className="max-w-xl w-[95vw] sm:w-[90vw] max-h-[90vh] flex flex-col rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="shrink-0 bg-primary/5 p-10 border-b border-primary/10 relative overflow-hidden">
                        <div className="absolute -right-12 -top-12 h-48 w-48 bg-primary/5 rounded-full blur-3xl" />
                        <div className="relative z-10 flex items-center gap-5 mb-3">
                            <div className="p-4 bg-white rounded-3xl shadow-xl shadow-primary/10 border border-primary/10">
                                <Users className="h-10 w-10 text-primary" />
                            </div>
                            <div>
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-black tracking-widest mb-2 px-3 py-1">Assignment Engine</Badge>
                                <DialogTitle className="text-3xl font-black text-slate-900 uppercase tracking-tight">Team Distribution</DialogTitle>
                            </div>
                        </div>
                        <DialogDescription className="text-slate-600 font-bold text-base leading-relaxed mt-4">
                            Deploying "{selectedWork?.work_type_name}" for client <span className="text-slate-900 font-black">"{selectedWork?.client_name}"</span>.
                        </DialogDescription>
                    </div>

                    <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-white">
                        <div className="space-y-4">
                            <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Target Specialist Team</Label>
                            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                                <SelectTrigger className="h-16 border-slate-200 rounded-3xl bg-slate-50/50 hover:bg-white transition-all shadow-inner focus:ring-primary/20 font-bold text-slate-700 px-6">
                                    <SelectValue placeholder="Identify target team..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-3xl p-2 border-none shadow-2xl">
                                    <div className="p-2 mb-2 border-b border-slate-100">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Recommended Teams</p>
                                    </div>
                                    {eligibleTeams.map(team => (
                                        <SelectItem key={team.id} value={team.id} className="rounded-2xl h-14 mb-1 hover:bg-indigo-50 focus:bg-indigo-50 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900">{team.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[8px] h-4 uppercase font-black border-indigo-200 bg-indigo-50 text-indigo-600">{team.type}</Badge>
                                                    <span className="text-[10px] text-slate-400 font-bold">Matching specialist profile</span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    <SelectSeparator className="my-2" />
                                    <div className="p-2 mb-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Active Teams</p>
                                    </div>
                                    {teams.filter(t => !eligibleTeams.some(e => e.id === t.id)).map(team => (
                                        <SelectItem key={team.id} value={team.id} className="rounded-2xl h-14 mb-1">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{team.name}</span>
                                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{team.type}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedWork?.assigned_team_id && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Reassignment Rationale</Label>
                                <Textarea 
                                    placeholder="Provide reason for reassigning to a different team..."
                                    className="rounded-3xl border-slate-200 bg-slate-50/50 min-h-[100px] p-6 focus:bg-white transition-all shadow-inner"
                                    value={reassignReason}
                                    onChange={(e) => setReassignReason(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="bg-amber-50/80 p-6 rounded-[2rem] border border-amber-200/50 flex gap-4">
                            <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-amber-100">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Deployment Warning</p>
                                <p className="text-xs text-amber-800/80 font-medium leading-relaxed italic">
                                    Reassigning work will immediately halt current member workflows and notify the new Team Lead for review.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 bg-slate-50 p-8 border-t border-slate-100 flex items-center gap-4">
                        <DialogClose asChild>
                            <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold uppercase text-[11px] tracking-widest border-slate-200 hover:bg-white">Cancel Operation</Button>
                        </DialogClose>
                        <Button 
                            className="flex-[1.5] h-14 rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all"
                            onClick={handleAssignTeam}
                            disabled={submitting || !selectedTeamId || !!(selectedWork?.assigned_team_id && !reassignReason.trim())}
                        >
                            {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <UserCheck className="mr-2 h-5 w-5" />}
                            Execute Distribution
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

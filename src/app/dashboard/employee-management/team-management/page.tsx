'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  listenToDepartments,
  type Department,
} from '@/lib/department-management';
import {
  listenToTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  updateMemberAvailability,
  fetchTeamTransferRules,
  updateTeamTransferRules,
  fetchTeamHistory,
  logTeamActivity,
  type Team,
  type TeamMember,
  type TeamType,
  type TeamTransferRules,
  type TeamActivityLog,
} from '@/lib/team-management';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/use-auth';
import { 
  Users, Building2, Building, Shield, Plus, MoreVertical, 
  Trash2, Calendar, Clock, ArrowRightLeft,
  Settings2, UserPlus, Info, CheckCircle2,
  AlertCircle, Edit, Activity, Loader2, Search, Filter, ChevronRight, LayoutDashboard,
  Briefcase, Split, UserCheck, Eye, Check, ChevronsUpDown, UsersRound
} from 'lucide-react';
import { 
  assignWorkItemToMember, 
  getAssignableMembersForTeam,
  handleMemberLeaveReassignment 
} from '@/lib/work-assignment';
import { format } from 'date-fns/format';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHero } from '@/components/dashboard/page-hero';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';

interface Employee {
  id: string;
  name: string;
  full_name: string;
  photo: string;
  photo_url: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
}

interface MasterValue {
  id: string;
  name: string;
  category_id: string;
  order: number;
}

const TeamManagementPage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [teamResetKey, setTeamResetKey] = useState(0);
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [newTeam, setNewTeam] = useState<Partial<Team>>({
    name: '',
    description: '',
    type: 'client',
    status: 'ACTIVE',
    leadId: undefined
  });
  const [masterData, setMasterData] = useState<{
    roles: MasterValue[],
    availability: MasterValue[],
    assignmentTypes: MasterValue[],
    backupPriorities: MasterValue[]
  }>({ roles: [], availability: [], assignmentTypes: [], backupPriorities: [] });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManageTeams = hasPermission('MANAGE_TEAMS');
  const canViewTeams = hasPermission('VIEW_TEAMS') || canManageTeams;

  const fetchMasterData = async () => {
    try {
      const { data: cats, error: catError } = await supabase
        .from('app_master_categories')
        .select('id, name')
        .in('name', ['Team Roles', 'Team Availability Status', 'Team Assignment Type', 'Team Backup Priority']);

      if (catError) throw catError;

      const { data: vals, error: valError } = await supabase
        .from('app_master_values')
        .select('*')
        .in('category_id', cats.map(c => c.id))
        .order('order', { ascending: true });

      if (valError) throw valError;

      const getVals = (name: string) => {
        const cat = cats.find(c => c.name === name);
        return vals.filter(v => v.category_id === cat?.id);
      };

      setMasterData({
        roles: getVals('Team Roles'),
        availability: getVals('Team Availability Status'),
        assignmentTypes: getVals('Team Assignment Type'),
        backupPriorities: getVals('Team Backup Priority')
      });
    } catch (err) {
            console.error('Error fetching master data:', err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
  };

  const refreshTeamManagementData = async (options?: { preserveSelectedTeamId?: string }) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/teams', { credentials: 'include' });
      const result = await response.json();
      const freshTeams = result.success && Array.isArray(result.data) ? result.data : [];
      setTeams(freshTeams);

      const selectedId = options?.preserveSelectedTeamId || selectedTeam?.id;
      const nextSelected =
        freshTeams.find((t: Team) => t.id === selectedId) ||
        freshTeams.find((t: Team) => t.status === "ACTIVE") ||
        freshTeams[0] ||
        null;

      setSelectedTeam(nextSelected);
    } catch (err) {
            console.error(err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!permLoading && !canViewTeams) {
      toast({ title: "Access Denied", description: "You do not have permission to view teams.", variant: "destructive" });
      router.push('/dashboard');
      return;
    }
    
    if (!canViewTeams) return;

    fetchMasterData();
    const unsubTeams = listenToTeams((loadedTeams) => {
      setTeams(loadedTeams);
      if (loadedTeams.length > 0 && !selectedTeam) {
        setSelectedTeam(loadedTeams[0]);
      } else if (selectedTeam) {
        const updated = loadedTeams.find(t => t.id === selectedTeam.id);
        if (updated) setSelectedTeam(updated);
      }
      setIsLoading(false);
    });

    const unsubDepts = listenToDepartments(setDepartments);

    const fetchData = async () => {
        try {
            const clientRes = await apiFetch('/api/clients?active=true');
            if (clientRes.ok) {
                const cData = await clientRes.json();
                setClients((cData.data || []).map((c: any) => ({ id: c.id, name: c.client_name })));
            }
            
            const empRes = await apiFetch('/api/employees?active=true');
            if (empRes.ok) {
                const eData = await empRes.json();
                setEmployees((eData.data || []).map((p: any) => ({
                    id: p.id,
                    name: p.full_name || 'Unknown',
                    full_name: p.full_name || 'Unknown',
                    photo: p.photo_url || "https://placehold.co/100x100.png",
                    photo_url: p.photo_url,
                    email: p.email || ''
                })));
            }
        } catch (e) {
            console.error('[TeamManagement] Error fetching dropdowns:', e);
        }
    };
    fetchData();

    return () => {
      unsubTeams();
      unsubDepts();
    };
  }, [selectedTeam?.id]);

  const handleCreateTeam = async () => {
    if (!newTeam.name?.trim()) {
      toast({
        title: "Please enter a team name",
        variant: "destructive"
      });
      return;
    }

    // Validation based on type
    if (newTeam.type === 'client' && !newTeam.clientId) {
      toast({ title: "Please select a Linked Client", variant: "destructive" });
      return;
    }
    if (newTeam.type === 'department' && !newTeam.departmentId) {
      toast({ title: "Please select a valid department", variant: "destructive" });
      return;
    }
    if (newTeam.type === 'client-work' && (!newTeam.clientId || !newTeam.departmentId)) {
      toast({ title: "Please select both Client and Department", variant: "destructive" });
      return;
    }

    if (!newTeam.leadId) {
      toast({ title: "Team lead is mandatory", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (newTeam.departmentId && !uuidRegex.test(newTeam.departmentId)) {
        throw new Error("Invalid department selection. Please select from the dropdown.");
      }
      if (newTeam.leadId && !uuidRegex.test(newTeam.leadId)) {
        throw new Error("Invalid team lead selection. Please select from the dropdown.");
      }

      const newTeamId = await createTeam(newTeam);
      
      await refreshTeamManagementData({ preserveSelectedTeamId: newTeamId });
      
      toast({
        title: "Team created successfully",
        description: "Team created and Lead assigned automatically."
      });
      setIsAddingTeam(false); setTeamResetKey(prev => prev + 1);
      setNewTeam({ name: '', description: '', type: 'client', status: 'ACTIVE' });
    } catch (err: any) {
      console.error("Create Team Error:", err);
      toast({
        title: err.message || "Failed to create team",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };


  const handleUpdateTeam = async () => {
    if (!selectedTeam || !newTeam.name?.trim()) return;

    // Validation based on type
    if (newTeam.type === 'client' && !newTeam.clientId) {
      toast({ title: "Please select a Linked Client", variant: "destructive" });
      return;
    }
    if (newTeam.type === 'department' && !newTeam.departmentId) {
      toast({ title: "Please select a valid department", variant: "destructive" });
      return;
    }
    if (newTeam.type === 'client-work' && (!newTeam.clientId || !newTeam.departmentId)) {
      toast({ title: "Please select both Client and Department", variant: "destructive" });
      return;
    }

    if (!newTeam.leadId) {
      toast({ title: "Team lead is mandatory", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (newTeam.departmentId && !uuidRegex.test(newTeam.departmentId)) {
        throw new Error("Invalid department selection.");
      }
      if (newTeam.leadId && !uuidRegex.test(newTeam.leadId)) {
        throw new Error("Invalid team lead selection.");
      }

      await updateTeam(selectedTeam.id, newTeam);
      
      await refreshTeamManagementData({ preserveSelectedTeamId: selectedTeam.id });
      
      toast({
        title: "Team updated successfully",
        description: "Team details and lead updated."
      });
      setIsEditingTeam(false);
    } catch (err: any) {
      toast({
        title: err.message || "Failed to update team",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to deactivate this team?")) return;
    try {
      await deleteTeam(teamId);
      
      await refreshTeamManagementData();
      
      toast({
        title: "Team deactivated"
      });
    } catch (err: any) {
      toast({
        title: err.message || "Failed to deactivate team",
        variant: "destructive"
      });
    }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
    (typeFilter === 'all' || t.type === typeFilter) &&
    (deptFilter === 'all' || t.departmentId === deptFilter)
  );

  if (permLoading || isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  if (!canViewTeams) return null;

  return (
    <>
    <div className="space-y-8 w-full pb-12">
      <PageHero
                pattern="pattern-4" 
        icon={UsersRound}
        badge="TEAM MANAGEMENT"
        title="Team Management" 
        description="Manage your teams, members, and their assignments to start collaborating."
      >
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
            <Users className="h-4 w-4" />
            <span className="text-sm font-bold">{teams.length} Total Teams</span>
          </div>
          {canManageTeams && (<Button onClick={() => setIsAddingTeam(true)} className="font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 px-6">
            <Plus className="mr-2 h-4 w-4" /> New Team
          </Button>)}
        </div>
      </PageHero>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {filteredTeams.map((team) => (
          <button
            key={team.id}
            onClick={() => setSelectedTeam(team)}
            className={cn(
              "text-left p-5 rounded-2xl transition-all border-2 relative group flex flex-col gap-4",
              selectedTeam?.id === team.id 
                ? "bg-blue-50/30 border-blue-500 shadow-sm" 
                : "bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm"
            )}
          >
            <div className="flex items-start justify-between">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
                team.type === 'client' ? "bg-blue-500 text-white" : 
                team.type === 'department' ? "bg-purple-500 text-white" : "bg-orange-500 text-white"
              )}>
                <Building className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tight",
                team.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500"
              )}>
                {team.status}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{team.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                  {team.type === 'client' ? "Client Focused" : team.type === 'department' ? "Specialist Unit" : "Hybrid Team"}
                </span>
              </div>
            </div>

            <div className="pt-2 mt-auto border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">{Object.keys(team.members || {}).length} Members</span>
              </div>
              <div className="h-2 w-2 rounded-full bg-slate-200" />
            </div>
          </button>
        ))}
        {filteredTeams.length === 0 && (
          <div className="col-span-full"><EmptyState icon={<Search className="h-10 w-10 text-slate-400" />} title="No Teams Found" description="No teams match your current search or filter criteria." /></div>
        )}
      </div>

      {/* Selected Team Detail */}
      {selectedTeam ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden bg-white rounded-3xl">
            <CardHeader className="bg-slate-50/50 border-b p-8">
               <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg",
                      selectedTeam.type === 'client' ? "bg-blue-600 text-white shadow-blue-200" : 
                      selectedTeam.type === 'department' ? "bg-purple-600 text-white shadow-purple-200" : "bg-orange-600 text-white shadow-orange-200"
                    )}>
                      <Building className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">{selectedTeam.name}</h1>
                        <Badge className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                          selectedTeam.status === 'ACTIVE' ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"
                        )}>
                          {selectedTeam.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-500 text-xs font-bold uppercase tracking-tight">
                        <TeamContextLabel team={selectedTeam} clients={clients} departments={departments} />
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          {Object.keys(selectedTeam.members || {}).length} Professionals
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-orange-500" />
                          Established {format(selectedTeam.createdAt || Date.now(), 'MMM yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-11 px-6 gap-2 font-bold border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                      onClick={() => {
                        setNewTeam({ ...selectedTeam });
                        setIsEditingTeam(true);
                      }}
                    >
                      <Edit className="h-4 w-4" /> Edit Details
                    </Button>
                    {canManageTeams && (<DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-11 w-11 p-0 rounded-xl border-slate-200">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl p-1 border-slate-200">
                        <DropdownMenuItem className="text-red-600 font-bold cursor-pointer rounded-lg hover:bg-red-50 focus:bg-red-50" onClick={() => handleDeleteTeam(selectedTeam.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Deactivate Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>)}
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="members" className="w-full">
                <div className="bg-white border-b px-8">
                  <TabsList className="bg-transparent h-16 w-full justify-start gap-8 px-0 overflow-x-auto no-scrollbar">
                    {[
                      { value: 'members', label: 'Members', icon: Users },
                      { value: 'assigned-works', label: 'Assigned Works', icon: Briefcase },
                      { value: 'availability', label: 'Availability', icon: Clock },
                      { value: 'transfer', label: 'Transfer Rules', icon: ArrowRightLeft },
                      { value: 'history', label: 'History', icon: Activity },
                    ].map(tab => (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value} 
                        className="data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-4 data-[state=active]:border-blue-600 border-b-4 border-transparent rounded-none h-full px-0 font-black text-[11px] uppercase tracking-widest text-slate-400 transition-all gap-2"
                      >
                        <tab.icon className="h-4 w-4" /> {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <TabsContent value="members" className="p-8 m-0 space-y-8 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Active Roster</h3>
                        <p className="text-sm text-slate-500 font-medium">Manage professional roles and seniority levels.</p>
                     </div>
                     <Button onClick={() => setIsAddingMember(true)} className="font-bold bg-blue-600 text-white rounded-xl h-11 px-6 shadow-lg shadow-blue-600/20" size="sm">
                        <UserPlus className="mr-2 h-4 w-4" /> Add Specialist
                     </Button>
                  </div>
                  <TeamMemberTable 
                    team={selectedTeam} 
                    employees={employees} 
                    roles={masterData.roles}
                    onRefresh={() => refreshTeamManagementData({ preserveSelectedTeamId: selectedTeam?.id })}
                  />
                </TabsContent>

                <TabsContent value="assigned-works" className="p-8 m-0 animate-in fade-in duration-500">
                  <AssignedWorksTab 
                    team={selectedTeam} 
                    employees={employees}
                    currentUser={user}
                    canManageTeams={canManageTeams}
                    onRefresh={() => refreshTeamManagementData({ preserveSelectedTeamId: selectedTeam?.id })}
                  />
                </TabsContent>

                <TabsContent value="availability" className="p-8 m-0 animate-in fade-in duration-500">
                  <AvailabilityTab 
                    teamId={selectedTeam.id} 
                    members={Object.entries(selectedTeam.members || {}).map(([id, m]) => ({
                      employeeId: id,
                      ...m,
                      name: employees.find(e => e.id === id)?.name || 'Unknown',
                      photoUrl: employees.find(e => e.id === id)?.photo_url
                    }))} 
                    statuses={masterData.availability}
                    onRefresh={() => refreshTeamManagementData({ preserveSelectedTeamId: selectedTeam?.id })}
                  />
                </TabsContent>


                <TabsContent value="transfer" className="p-8 m-0 animate-in fade-in duration-500">
                  <TransferRulesTab 
                    teamId={selectedTeam.id} 
                    priorities={masterData.backupPriorities}
                    onRefresh={() => refreshTeamManagementData({ preserveSelectedTeamId: selectedTeam?.id })}
                  />
                </TabsContent>

                <TabsContent value="history" className="p-8 m-0 animate-in fade-in duration-500">
                  <HistoryTab teamId={selectedTeam.id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 text-slate-400 p-12 text-center space-y-4">
          <LayoutDashboard className="h-16 w-16 opacity-10" />
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 uppercase">Initialization Required</h3>
            <p className="text-sm font-medium text-slate-500 max-w-xs">Select a team from the grid above to begin managing resources, allocations, and rules.</p>
          </div>
        </div>
      )}
    </div>

      <AddTeamDialog 
        open={isAddingTeam} 
        onOpenChange={setIsAddingTeam} 
        newTeam={newTeam} 
        setNewTeam={setNewTeam} 
        handleCreateTeam={handleCreateTeam}
        clients={clients}
        departments={departments}
        employees={employees}
        isEdit={false}
        handleUpdateTeam={handleUpdateTeam}
        isSaving={isSaving}
      />

      <AddTeamDialog 
        open={isEditingTeam} 
        onOpenChange={setIsEditingTeam} 
        newTeam={newTeam} 
        setNewTeam={setNewTeam} 
        handleCreateTeam={handleCreateTeam}
        clients={clients}
        departments={departments}
        employees={employees}
        isEdit={true}
        handleUpdateTeam={handleUpdateTeam}
        isSaving={isSaving}
      />

      <AddMemberDialog 
        open={isAddingMember} 
        onOpenChange={setIsAddingMember} 
        teamId={selectedTeam?.id || ''} 
        teamName={selectedTeam?.name || ''} 
        employees={employees}
        existingMemberIds={selectedTeam ? Object.keys(selectedTeam.members || {}) : []}
        roles={masterData.roles}
        onRefresh={() => refreshTeamManagementData({ preserveSelectedTeamId: selectedTeam?.id })}
      />
    </>
  );
};

function AssignedWorksTab({ team, employees, currentUser, onRefresh, canManageTeams }: { team: Team, employees: Employee[], currentUser: any, onRefresh?: () => Promise<void>, canManageTeams: boolean }) {
  const [works, setWorks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignResetKey, setAssignResetKey] = useState(0);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<any>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('works')
        .select(`
          *,
          current_handler:employees!current_handler_id (
            id,
            full_name,
            photo_url
          ),
          work_member_assignments(*)
        `)
        .eq('assigned_team_id', team.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AssignedWorksTab] Supabase Error:', error);
        throw error;
      }
      console.log('[AssignedWorksTab] Raw Works:', data);
      setWorks(data || []);
    } catch (err: any) {
      console.error('Error fetching team works:', err);
      const errorMessage = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      toast({ 
        title: "Fetch Error", 
        description: `Could not load works: ${errorMessage}. Ensure database migrations are applied.`, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (team?.id) {
      fetchData();
    }
  }, [team?.id]);

  const canAssign = useMemo(() => {
    if (!currentUser) return false;
    
    const currentUserId = currentUser?.id || currentUser?.uid || currentUser?.user?.id;
    const isAdmin = currentUser.user_metadata?.role === 'ADMIN' || currentUser.role === 'ADMIN' || currentUser.email?.includes('admin');
    if (isAdmin) return true;

    if (!team?.members) return false;
    const myMember = team.members[currentUserId];
    if (!myMember) return false;

    if (myMember.role === 'Team Lead') return true;

    if (myMember.role === 'Senior Member') {
      const teamLeadEntry = Object.entries(team.members).find(([_, m]) => m.role === 'Team Lead');
      if (!teamLeadEntry) return true; // No Team Lead exists
      
      const leadMember = teamLeadEntry[1];
      if (leadMember.availabilityStatus === 'On Leave' || leadMember.availabilityStatus === 'Inactive') {
        return true;
      }
    }

    return false;
  }, [team?.members, currentUser]);

  const handleOpenAssign = (work: any) => {
    console.log("[AssignedWorks] Assign clicked", work);
    setSelectedWork(work);
    const existingAssignment = work.work_member_assignments?.[0];
    setSelectedMemberId(existingAssignment?.assigned_member_id || '');
    setIsAssignDialogOpen(true);
  };

  const handleViewWork = (work: any) => {
    console.log("[AssignedWorks] View work clicked", work);
    setSelectedWork(work);
    setIsViewDialogOpen(true);
  };

  const handleSplitWork = (work: any) => {
    console.log("[AssignedWorks] Split work clicked", work);
    toast({
      title: "Split Work",
      description: "Split work feature will be connected next"
    });
  };

  const handleAssignMember = async () => {
    if (!selectedWork || !selectedMemberId || !currentUser) return;
    setSubmitting(true);
    try {
      const currentUserId = currentUser?.id || currentUser?.uid || currentUser?.user?.id;
      const res = await assignWorkItemToMember({
        workId: selectedWork.id,
        teamId: team.id,
        memberId: selectedMemberId,
        assignedBy: currentUserId
      });

      if (res.success) {
        await onRefresh?.();
        await fetchData();
        toast({ title: "Success", description: "Member assigned successfully." });
        setIsAssignDialogOpen(false); setAssignResetKey(prev => prev + 1);
      } else {
        throw res.error;
      }
    } catch (err: any) {
      toast({ title: "Assignment Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'UNASSIGNED': return <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 uppercase text-[9px] font-black">Unassigned</Badge>;
        case 'TEAM_ASSIGNED': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 uppercase text-[9px] font-black">Team Assigned</Badge>;
        case 'MEMBER_ASSIGNED': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 uppercase text-[9px] font-black">Member Assigned</Badge>;
        case 'NEEDS_REASSIGNMENT': return <Badge className="bg-red-100 text-red-700 border-red-200 uppercase text-[9px] font-black">Needs Reassignment</Badge>;
        default: return <Badge variant="outline" className="text-[9px] uppercase font-black">{status}</Badge>;
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Workload Distribution</h3>
          <p className="text-sm text-slate-500 font-medium">Monitor and manage service allocations for this team.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search works..." 
              className="pl-9 h-10 w-64 rounded-xl border-slate-200 text-sm focus:ring-blue-500/10"
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200">
            <Filter className="h-4 w-4 text-slate-50" />
          </Button>
        </div>
      </div>

      {works.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50">
          <div className="h-20 w-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6">
            <Briefcase className="h-10 w-10 text-slate-200" />
          </div>
          <h4 className="text-lg font-black text-slate-900 uppercase">No Active Works</h4>
          <p className="text-slate-400 font-medium max-w-xs mx-auto mt-2">This team has no service items assigned for current cycle.</p>
        </div>
      ) : (
        <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-none hover:bg-slate-50/80">
                <TableHead className="text-[10px] uppercase font-black text-slate-400 py-5 pl-8">Work / Service</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-400">Client</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-400">Dept / Type</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-400">Priority</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-400">Due Date</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-400 text-center">Status</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-400">Assignee</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black text-slate-400 pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {works.map((work) => (
                <TableRow key={work.id} className="border-slate-50 hover:bg-slate-50/30 transition-colors group">
                  <TableCell className="py-5 pl-8">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">{work.title || work.work_type_name || 'N/A'}</span>
                      <div className="flex items-center gap-2">
                        {work.auto_assigned && (
                          <Badge variant="outline" className="text-[8px] h-4 bg-blue-50 text-blue-600 border-blue-100 font-black uppercase tracking-widest px-1.5">
                            Auto
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[8px] h-4 bg-slate-50 text-slate-500 border-slate-100 font-black uppercase tracking-widest px-1.5">
                          Assigned
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-slate-700 text-sm">{work.client_name || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight">{work.department_name || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <div className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-lg w-fit",
                      work.priority?.toLowerCase() === 'critical' ? "bg-red-50" :
                      work.priority?.toLowerCase() === 'high' ? "bg-orange-50" :
                      work.priority?.toLowerCase() === 'medium' ? "bg-amber-50" : "bg-slate-50"
                    )}>
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full animate-pulse",
                        work.priority?.toLowerCase() === 'critical' ? "bg-red-500" :
                        work.priority?.toLowerCase() === 'high' ? "bg-orange-500" :
                        work.priority?.toLowerCase() === 'medium' ? "bg-amber-500" : "bg-slate-500"
                      )} />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        work.priority?.toLowerCase() === 'critical' ? "text-red-700" :
                        work.priority?.toLowerCase() === 'high' ? "text-orange-700" :
                        work.priority?.toLowerCase() === 'medium' ? "text-amber-700" : "text-slate-700"
                      )}>
                        {work.priority || 'Medium'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                       <span className="font-bold text-slate-700 text-sm whitespace-nowrap">
                         {work.due_date ? format(new Date(work.due_date), 'dd MMM yyyy') : '—'}
                       </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {work.status === 'COMPLETED' ? (
                      <Badge variant="outline" className="h-6 text-[10px] bg-emerald-50 text-emerald-600 border-emerald-100 font-black uppercase tracking-widest px-3">
                        Completed
                      </Badge>
                    ) : work.status === 'CLAIMED' || work.status === 'IN_PROGRESS' ? (
                      <Badge variant="outline" className="h-6 text-[10px] bg-blue-50 text-blue-600 border-blue-100 font-black uppercase tracking-widest px-3">
                        In Progress
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-6 text-[10px] bg-slate-50 text-slate-500 border-slate-100 font-black uppercase tracking-widest px-3">
                        {work.status || 'AVAILABLE'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {work.current_handler ? (
                        <div className="flex -space-x-2">
                          <Avatar className="h-8 w-8 border-2 border-white shadow-sm ring-1 ring-slate-100" title={work.current_handler.full_name || 'Assigned Member'}>
                            <AvatarImage src={work.current_handler.photo_url} />
                            <AvatarFallback className="text-[10px] font-black bg-blue-50 text-blue-600">
                              {(work.current_handler.full_name)?.split(' ').map((n: any) => n[0]).join('').slice(0, 2) || '??'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic opacity-50">Unallocated</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="View Work"
                        onClick={(e) => { e.stopPropagation(); handleViewWork(work); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Split Work Items"
                        onClick={(e) => { e.stopPropagation(); handleSplitWork(work); }}
                      >
                        <Split className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        disabled={!canAssign || !canManageTeams}
                        onClick={(e) => { e.stopPropagation(); handleOpenAssign(work); }}
                        title={work.work_member_assignments?.length > 0 ? "Reassign Member" : "Assign Member"}
                      >
                        {work.work_member_assignments?.length > 0 ? <ArrowRightLeft className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Assign Member Dialog */}
      <Dialog key={assignResetKey} open={isAssignDialogOpen} onOpenChange={(open) => {
        setIsAssignDialogOpen(open);
        if (!open) setAssignResetKey(prev => prev + 1);
      }}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary/5 p-8 border-b border-primary/10">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-primary/10">
                <UserCheck className="h-8 w-8 text-primary" />
              </div>
              <div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-black tracking-widest mb-1">Resource Allocation</Badge>
                <DialogTitle className="text-2xl font-black text-slate-900 uppercase">Assign Team Member</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-slate-600 font-medium mt-2">
              Assign a team member to this work: "{selectedWork?.work_type_name}".
            </DialogDescription>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-bold text-slate-900 uppercase tracking-tight">Select Team Member</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger className="h-14 border-slate-200 rounded-2xl bg-white shadow-sm font-bold text-slate-700">
                  <SelectValue placeholder="Choose a member..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl p-1">
                  {Object.entries(team?.members || {})
                    .filter(([_, m]) => m.availabilityStatus !== 'Inactive')
                    .map(([id, m]) => (
                    <SelectItem key={id} value={id} className="rounded-xl h-11">
                      <div className="flex items-center justify-between w-full min-w-[280px]">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[8px] font-black">{employees.find(e => e.id === id)?.name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <span className="font-bold">{employees.find(e => e.id === id)?.name || 'Unknown Specialist'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[8px] h-4 uppercase font-black">{m.role || 'Member'}</Badge>
                          {m.availabilityStatus === 'On Leave' && <Badge variant="destructive" className="text-[8px] h-4 uppercase font-black">On Leave</Badge>}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-100">
            <DialogClose asChild>
              <Button variant="outline" className="h-12 px-8 rounded-2xl font-bold uppercase text-[10px] tracking-widest border-slate-200">Cancel</Button>
            </DialogClose>
            <Button 
              className="h-12 px-8 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"
              onClick={handleAssignMember}
              disabled={submitting || !selectedMemberId}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Work Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-50 p-8 border-b border-slate-100">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-blue-600">
                <Briefcase className="h-8 w-8" />
              </div>
              <div>
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] uppercase font-black tracking-widest mb-1">Service Detail</Badge>
                <DialogTitle className="text-2xl font-black text-slate-900 uppercase">{selectedWork?.work_type_name}</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-slate-500 font-medium">Read-only view of the selected work item and its current status.</DialogDescription>
          </div>

          <div className="p-8 grid grid-cols-2 gap-8 bg-white">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Client</Label>
              <p className="text-sm font-bold text-slate-900">{selectedWork?.client_name || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Department</Label>
              <p className="text-sm font-bold text-slate-900">{selectedWork?.department_name || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Priority</Label>
              <div className="flex items-center gap-2 mt-1">
                 <div className={cn(
                    "h-2 w-2 rounded-full",
                    selectedWork?.priority?.toLowerCase() === 'critical' ? "bg-red-500" : "bg-blue-500"
                 )} />
                 <p className="text-sm font-bold text-slate-900">{selectedWork?.priority || 'Medium'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Due Date</Label>
              <p className="text-sm font-bold text-slate-900">{selectedWork?.due_date ? format(new Date(selectedWork.due_date), 'PPP') : 'Not Set'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Status</Label>
              <div className="mt-1">{getStatusBadge(selectedWork?.assignment_status || 'UNASSIGNED')}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Remarks</Label>
              <p className="text-sm font-medium text-slate-600 italic">"{selectedWork?.remarks || 'No remarks provided'}"</p>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-100">
            <Button variant="outline" className="h-12 px-8 rounded-2xl font-bold uppercase text-[10px] tracking-widest border-slate-200" onClick={() => setIsViewDialogOpen(false)}>Close Detail</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamContextLabel({ team, clients, departments }: { team: Team, clients: Client[], departments: Department[] }) {
  const client = clients.find(c => c.id === team.clientId);
  const dept = departments.find(d => d.id === team.departmentId);

  return (
    <div className="flex items-center gap-3">
       {team.type.includes('client') && client && (
         <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Client: <span className="font-bold">{client.name}</span>
         </div>
       )}
       {team.type.includes('department') && dept && (
         <div className="flex items-center gap-2">
            <Building className="h-4 w-4" /> Dept: <span className="font-bold">{dept.name}</span>
         </div>
       )}
    </div>
  );
}

function TeamMemberTable({ team, employees, roles, onRefresh }: { team: Team, employees: Employee[], roles: MasterValue[], onRefresh?: () => Promise<void> }) {
  const { toast } = useToast();
  const members = useMemo(() => {
    return Object.entries(team.members || {}).map(([id, m]) => ({
      id,
      ...m,
      name: employees.find(e => e.id === id)?.full_name || 'Unknown',
      photoUrl: employees.find(e => e.id === id)?.photo_url
    })).sort((a, b) => {
        const order: Record<string, number> = {};
        roles.forEach(r => { order[r.name] = r.order; });
        return (order[a.role] ?? 99) - (order[b.role] ?? 99);
    });
  }, [team.members, employees, roles]);

  const handleRoleChange = async (employeeId: string, role: string) => {
    try {
      await updateTeamMemberRole(team.id, employeeId, role);
      await onRefresh?.();
      toast({
        title: "Role updated"
      });
    } catch (err: any) {
      toast({
        title: err.message,
        variant: "destructive"
      });
    }
  };

  const handleRemove = async (employeeId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await removeTeamMember(team.id, employeeId);
      await onRefresh?.();
      toast({
        title: "Member removed"
      });
    } catch (err: any) {
      toast({
        title: err.message,
        variant: "destructive"
      });
    }
  };

  if (members.length === 0) return <EmptyState icon={<Users className="h-10 w-10 text-slate-400" />} title="No Members" description="No members have been assigned to this team yet." />

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50 border-none">
          <TableHead className="text-[10px] uppercase font-bold text-slate-500">Professional</TableHead>
          <TableHead className="text-[10px] uppercase font-bold text-slate-500">Role</TableHead>
          <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500">Workload</TableHead>
          <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id} className="border-slate-100 group">
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-slate-100">
                  <AvatarImage src={m.photoUrl} />
                  <AvatarFallback className="text-[10px] font-bold">{m.name[0]}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-bold text-slate-900">{m.name}</p>
              </div>
            </TableCell>
            <TableCell>
              <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v)}>
                <SelectTrigger className="h-8 w-fit min-w-[140px] text-xs font-semibold border-slate-200 px-3 whitespace-nowrap gap-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.length > 0 ? (
                    roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)
                  ) : (
                    <>
                      <SelectItem value="Team Lead">Team Lead</SelectItem>
                      <SelectItem value="Senior Member">Senior Member</SelectItem>
                      <SelectItem value="Member">Member</SelectItem>
                      <SelectItem value="Reviewer">Reviewer</SelectItem>
                      <SelectItem value="Backup Member">Backup Member</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="text-center font-bold text-slate-600 text-xs">{m.activeWorkCount || 0}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)} className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AvailabilityTab({ teamId, members, statuses, onRefresh }: { teamId: string, members: any[], statuses: MasterValue[], onRefresh?: () => Promise<void> }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [memberStatus, setMemberStatus] = useState<Record<string, any>>({});

  useEffect(() => {
    const initial: any = {};
    members.forEach(m => {
      initial[m.employeeId] = { status: m.availabilityStatus, from: m.leaveFrom, to: m.leaveTo };
    });
    setMemberStatus(initial);
  }, [members]);

  const handleStatusUpdate = async (id: string, status: string) => {
    const data = memberStatus[id];
    if (status === 'On Leave' && (!data.from || !data.to)) {
      toast({
        title: "Please select leave dates",
        variant: "destructive"
      });
      return;
    }
    setIsSaving(true);
    try {
      await updateMemberAvailability(teamId, id, status, { from: data.from, to: data.to });
      
      // TRIGGER REASSIGNMENT IF LEAVE
      if (status === 'On Leave' || status === 'Inactive') {
        toast({ title: "Transferring Workload...", description: "Checking team rules for active work transfer." });
        const res = await handleMemberLeaveReassignment(teamId, id);
        if (res.success) {
          if (res.transferred && res.transferred > 0) {
            toast({ title: "Success", description: `Automatically transferred ${res.transferred} work items.` });
          } else if (res.marked && res.marked > 0) {
            toast({ title: "Action Required", description: `${res.marked} items marked for manual reassignment.`, variant: "destructive" });
          }
        }
      }

      await onRefresh?.();

      toast({
        title: "Status updated"
      });
    } catch (err: any) {
      toast({
        title: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 border-none">
            <TableHead className="text-[10px] uppercase font-bold">Professional</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">Leave Dates</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map(m => (
            <TableRow key={m.employeeId}>
              <TableCell className="font-bold text-slate-900">{m.name}</TableCell>
              <TableCell>
                <Select 
                  value={memberStatus[m.employeeId]?.status} 
                  onValueChange={(v) => handleStatusUpdate(m.employeeId, v)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-fit min-w-[120px] h-9 border-slate-200 text-xs font-semibold px-3 whitespace-nowrap gap-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.length > 0 ? (
                      statuses.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)
                    ) : (
                      <>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="Busy">Busy</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Input 
                    type="date" 
                    className="h-8 w-32 text-[10px]" 
                    value={memberStatus[m.employeeId]?.from || ''} 
                    onChange={e => setMemberStatus(prev => ({ ...prev, [m.employeeId]: { ...prev[m.employeeId], from: e.target.value } }))}
                  />
                  <Input 
                    type="date" 
                    className="h-8 w-32 text-[10px]" 
                    value={memberStatus[m.employeeId]?.to || ''} 
                    onChange={e => setMemberStatus(prev => ({ ...prev, [m.employeeId]: { ...prev[m.employeeId], to: e.target.value } }))}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TransferRulesTab({ teamId, priorities, onRefresh }: { teamId: string, priorities: MasterValue[], onRefresh?: () => Promise<void> }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<TeamTransferRules>({
    autoTransferEnabled: false,
    backupPriority: 'Backup Member',
    maxWorkloadThreshold: 5,
    fallbackToLead: true
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTeamTransferRules(teamId).then(r => r && setRules(r));
  }, [teamId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateTeamTransferRules(teamId, rules);
      await onRefresh?.();
      toast({
        title: "Rules saved"
      });
    } catch (err: any) {
      toast({
        title: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
        <div className="space-y-0.5">
          <Label className="font-bold">Auto Work Transfer</Label>
          <p className="text-[10px] text-slate-500">Reroute work when members are on leave.</p>
        </div>
        <Switch checked={rules.autoTransferEnabled} onCheckedChange={v => setRules({ ...rules, autoTransferEnabled: v })} />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-slate-500">Backup Priority</Label>
          <Select value={rules.backupPriority} onValueChange={(v: any) => setRules({ ...rules, backupPriority: v })}>
            <SelectTrigger className="rounded-xl border-slate-200 h-10 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.length > 0 ? (
                priorities.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)
              ) : (
                <>
                  <SelectItem value="Backup Member">Dedicated Backup</SelectItem>
                  <SelectItem value="Least-loaded">Least Loaded</SelectItem>
                  <SelectItem value="Team Lead">Team Lead Fallback</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-slate-500">Max Workload Threshold</Label>
          <Input type="number" className="rounded-xl h-10 font-semibold" value={rules.maxWorkloadThreshold} onChange={e => setRules({ ...rules, maxWorkloadThreshold: parseInt(e.target.value) })} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold">
        {isSaving ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}

function HistoryTab({ teamId }: { teamId: string }) {
  const [history, setHistory] = useState<TeamActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTeamHistory(teamId).then(data => { setHistory(data); setLoading(false); });
  }, [teamId]);

  if (loading) return <div className="py-12 text-center text-slate-400">Loading history...</div>;

  return (
    <div className="space-y-6 relative before:absolute before:left-3 before:top-0 before:bottom-0 before:w-px before:bg-slate-100">
      {history.map(log => (
        <div key={log.id} className="relative pl-8 space-y-1">
          <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white border-4 border-slate-50 flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">{log.action}</p>
            <span className="text-[10px] text-slate-400 font-bold uppercase">{format(log.createdAt, 'MMM d, HH:mm')}</span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Performed by {log.performedByName}</p>
        </div>
      ))}
      {history.length === 0 && <div className="py-8 text-center text-slate-400 italic">No activity logs found.</div>}
    </div>
  );
}

function AddTeamDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newTeam: Partial<Team>;
  setNewTeam: (t: Partial<Team>) => void;
  handleCreateTeam: () => Promise<void>;
  handleUpdateTeam: () => Promise<void>;
  clients: Client[];
  departments: Department[];
  employees: Employee[];
  isEdit: boolean;
  isSaving?: boolean;
}) {
  const { open, onOpenChange, newTeam, setNewTeam, handleCreateTeam, handleUpdateTeam, clients, departments, employees, isEdit, isSaving } = props;
  const [openClient, setOpenClient] = useState(false);
  const [openLead, setOpenLead] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[920px] w-[calc(100vw-3rem)] max-h-[88vh] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white flex flex-col">
        {/* Header - Fixed */}
        <div className="px-8 py-6 border-b border-slate-100 bg-white shrink-0">
          <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">
            {isEdit ? "Update Team" : "Create New Team"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {isEdit ? "Modify team settings and member assignments" : "Create a team and assign members to start collaborating"}
          </DialogDescription>
        </div>

        {/* Body - Scrollable */}
        <div className="px-8 py-6 space-y-6 flex-1 overflow-y-auto pr-9 custom-scrollbar min-h-0">
          {/* Team Type Selection */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-bold text-slate-900">Team Type</Label>
              <p className="text-[11px] text-slate-500 font-medium leading-tight">Choose how this team will be organized</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { 
                  id: 'client', 
                  label: 'Client Based', 
                  description: 'Team works for a client', 
                  icon: Users, 
                  color: 'bg-blue-50 text-blue-600' 
                },
                { 
                  id: 'department', 
                  label: 'Department Based', 
                  description: 'Team works within a department', 
                  icon: Building, 
                  color: 'bg-purple-50 text-purple-600' 
                },
                { 
                  id: 'client-work', 
                  label: 'Client + Department', 
                  description: 'Team works for client & dept.', 
                  icon: Building2, 
                  color: 'bg-orange-50 text-orange-600' 
                },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setNewTeam({ ...newTeam, type: type.id as any, clientId: undefined, departmentId: undefined })}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left group h-full",
                    newTeam.type === type.id 
                      ? "border-blue-500 bg-blue-50/30" 
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  )}
                >
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3 shrink-0", type.color)}>
                    <type.icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <p className={cn("text-sm font-bold", newTeam.type === type.id ? "text-blue-900" : "text-slate-900")}>
                      {type.label}
                    </p>
                    <p className="text-xs text-slate-500 font-medium leading-tight">
                      {type.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Team Name */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-900">Team Name *</Label>
            <Input 
              placeholder="e.g. Architecture Team" 
              className="h-11 border-slate-200 rounded-xl focus:ring-blue-500/20 transition-all font-medium text-sm"
              value={newTeam.name}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-900">Team Description (Optional)</Label>
            <div className="relative">
              <textarea 
                placeholder="Briefly describe the team's purpose and responsibilities" 
                className="w-full min-h-[90px] p-4 text-sm border border-slate-200 rounded-xl focus:ring-blue-500/20 transition-all font-medium text-slate-700 outline-none resize-none"
                maxLength={200}
                value={newTeam.description || ''}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
              />
              <div className="absolute bottom-3 right-3 text-[10px] font-bold text-slate-400">
                {(newTeam.description || '').length}/200
              </div>
            </div>
          </div>

          {/* Selection Fields & Team Lead */}
          <div className="space-y-6">
            {newTeam.type === 'client-work' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-900">Linked Client</Label>
                    <Popover open={openClient} onOpenChange={setOpenClient}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openClient}
                          className="w-full h-11 justify-between border-slate-200 rounded-xl font-medium text-sm bg-white hover:bg-slate-50 transition-all px-3"
                        >
                          <span className="truncate">
                            {newTeam.clientId
                              ? clients.find((c) => c.id === newTeam.clientId)?.name
                              : "Search and select client"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0 rounded-xl shadow-2xl border-slate-100" align="start">
                        <Command className="rounded-xl">
                          <CommandInput placeholder="Search client..." className="h-11" />
                          <CommandList>
                            <CommandEmpty className="py-6 text-center text-sm text-slate-500">No client found.</CommandEmpty>
                            <CommandGroup>
                              {clients.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.name}
                                  onSelect={() => {
                                    setNewTeam({ ...newTeam, clientId: client.id });
                                    setOpenClient(false);
                                  }}
                                  className="h-11 cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newTeam.clientId === client.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="font-medium text-slate-700">{client.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-900">Department</Label>
                    <Select value={newTeam.departmentId} onValueChange={(v) => setNewTeam({ ...newTeam, departmentId: v })}>
                      <SelectTrigger className="h-11 border-slate-200 rounded-xl font-medium text-sm">
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-900">Team Lead</Label>
                  <Popover open={openLead} onOpenChange={setOpenLead}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openLead}
                        className="w-full h-11 justify-between border-slate-200 rounded-xl font-medium text-sm bg-white hover:bg-slate-50 transition-all px-3"
                      >
                        <span className="truncate">
                          {newTeam.leadId
                            ? employees.find((e) => e.id === newTeam.leadId)?.full_name || employees.find((e) => e.id === newTeam.leadId)?.name
                            : "Search and select team lead"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 rounded-xl shadow-2xl border-slate-100" align="start">
                      <Command className="rounded-xl">
                        <CommandInput placeholder="Search team lead..." className="h-11" />
                        <CommandList>
                          <CommandEmpty className="py-6 text-center text-sm text-slate-500">No employee found.</CommandEmpty>
                          <CommandGroup>
                            {employees.map((employee) => (
                              <CommandItem
                                key={employee.id}
                                value={employee.full_name || employee.name}
                                onSelect={() => {
                                  setNewTeam({ ...newTeam, leadId: employee.id });
                                  setOpenLead(false);
                                }}
                                className="h-11 cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newTeam.leadId === employee.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-slate-900 leading-none">{employee.full_name || employee.name}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">{employee.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newTeam.type === 'client' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-900">Linked Client</Label>
                    <Popover open={openClient} onOpenChange={setOpenClient}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openClient}
                          className="w-full h-11 justify-between border-slate-200 rounded-xl font-medium text-sm bg-white hover:bg-slate-50 transition-all px-3"
                        >
                          <span className="truncate">
                            {newTeam.clientId
                              ? clients.find((c) => c.id === newTeam.clientId)?.name
                              : "Search and select client"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0 rounded-xl shadow-2xl border-slate-100" align="start">
                        <Command className="rounded-xl">
                          <CommandInput placeholder="Search client..." className="h-11" />
                          <CommandList>
                            <CommandEmpty className="py-6 text-center text-sm text-slate-500">No client found.</CommandEmpty>
                            <CommandGroup>
                              {clients.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.name}
                                  onSelect={() => {
                                    setNewTeam({ ...newTeam, clientId: client.id });
                                    setOpenClient(false);
                                  }}
                                  className="h-11 cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newTeam.clientId === client.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="font-medium text-slate-700">{client.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                {newTeam.type === 'department' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-900">Department</Label>
                    <Select value={newTeam.departmentId} onValueChange={(v) => setNewTeam({ ...newTeam, departmentId: v })}>
                      <SelectTrigger className="h-11 border-slate-200 rounded-xl font-medium text-sm">
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-900">Team Lead</Label>
                  <Popover open={openLead} onOpenChange={setOpenLead}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openLead}
                        className="w-full h-11 justify-between border-slate-200 rounded-xl font-medium text-sm bg-white hover:bg-slate-50 transition-all px-3"
                      >
                        <span className="truncate">
                          {newTeam.leadId
                            ? employees.find((e) => e.id === newTeam.leadId)?.full_name || employees.find((e) => e.id === newTeam.leadId)?.name
                            : "Search and select team lead"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 rounded-xl shadow-2xl border-slate-100" align="start">
                      <Command className="rounded-xl">
                        <CommandInput placeholder="Search team lead..." className="h-11" />
                        <CommandList>
                          <CommandEmpty className="py-6 text-center text-sm text-slate-500">No employee found.</CommandEmpty>
                          <CommandGroup>
                            {employees.map((employee) => (
                              <CommandItem
                                key={employee.id}
                                value={employee.full_name || employee.name}
                                onSelect={() => {
                                  setNewTeam({ ...newTeam, leadId: employee.id });
                                  setOpenLead(false);
                                }}
                                className="h-11 cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newTeam.leadId === employee.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-slate-900 leading-none">{employee.full_name || employee.name}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">{employee.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Status Switch */}
          <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold text-slate-900">Set team as active</Label>
              <p className="text-[11px] text-slate-500 font-medium">Active teams can be assigned to projects and tasks</p>
            </div>
            <Switch 
              checked={newTeam.status === 'ACTIVE'} 
              onCheckedChange={(v) => setNewTeam({ ...newTeam, status: v ? 'ACTIVE' : 'INACTIVE' })} 
            />
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="rounded-xl font-bold h-11 border-slate-200 px-8 text-slate-600 bg-white hover:bg-slate-50 transition-colors text-sm"
          >
            Cancel
          </Button>
          <Button 
            onClick={isEdit ? handleUpdateTeam : handleCreateTeam} 
            disabled={isSaving}
            className="rounded-xl font-bold h-11 bg-blue-600 hover:bg-blue-700 text-white px-10 shadow-lg shadow-blue-600/20 transition-all text-sm"
          >
            {isSaving ? "Saving..." : (isEdit ? "Update Team" : "Create Team")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({ open, onOpenChange, teamId, teamName, employees, existingMemberIds, roles, onRefresh }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  employees: Employee[];
  existingMemberIds: string[];
  roles: MasterValue[];
  onRefresh?: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [role, setRole] = useState<TeamMember['role']>('Member');

  const onAdd = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: "Please select a professional",
        variant: "destructive"
      });
      return;
    }

    if (existingMemberIds.includes(selectedEmployeeId)) {
      toast({
        title: "Professional already in team",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      await addTeamMember(teamId, selectedEmployeeId, {
        role,
        assignmentType: 'Permanent',
        startDate: Date.now(),
        availabilityStatus: 'Available',
        joinedDate: format(new Date(), 'yyyy-MM-dd')
      });
      
      await logTeamActivity({
        teamId,
        action: 'Member Added',
        performedByName: 'Admin',
        details: { 
          employeeId: selectedEmployeeId, 
          employeeName: employees.find(e => e.id === selectedEmployeeId)?.name,
          role 
        }
      });

      await onRefresh?.();

      onOpenChange(false);
      setSelectedEmployeeId(null);
      
      toast({
        title: "Member added successfully"
      });
    } catch (err: any) {
      toast({
        title: err.message || "Failed to add member",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const available = employees.filter(e => !existingMemberIds.includes(e.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-5rem)] p-0 overflow-hidden border- shadow-2xl rounded-2xl">
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-3 text-slate-900">
            <UserPlus className="h-5 w-5 text-primary" /> Assign Professional
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500">Add a new member to <span className="font-bold text-slate-900">{teamName}</span>.</DialogDescription>
        </div>
        <div className="p-6 space-y-6 bg-white">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-400">Select Employee</Label>
            <Select onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="h-12 border-slate-200 rounded-xl font-semibold">
                <SelectValue placeholder="Choose a professional..." />
              </SelectTrigger>
              <SelectContent>
                {available.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6"><AvatarImage src={e.photo_url} /><AvatarFallback>{e.name[0]}</AvatarFallback></Avatar>
                      {e.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-400">Role</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger className="h-12 border-slate-200 rounded-xl font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.length > 0 ? (
                  roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)
                ) : (
                  <>
                    <SelectItem value="Team Lead">Team Lead</SelectItem>
                    <SelectItem value="Senior Member">Senior Member</SelectItem>
                    <SelectItem value="Member">Member</SelectItem>
                    <SelectItem value="Reviewer">Reviewer</SelectItem>
                    <SelectItem value="Backup Member">Backup Member</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-11 border-slate-200 px-6">Cancel</Button>
          <Button onClick={onAdd} disabled={isSaving || !selectedEmployeeId} className="rounded-xl font-bold h-11 bg-primary text-white hover:bg-primary/90 px-8 shadow-lg shadow-primary/20">
            {isSaving ? "Saving..." : "Add Member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TeamManagementPage;

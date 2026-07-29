import { supabase } from './supabase';

export type TeamType = 'department' | 'client' | 'work' | 'client-work';

export interface TeamMember {
    id?: string;
    employee_id?: string;
    role: 'Team Lead' | 'Senior Member' | 'Member' | 'Reviewer' | 'Backup Member';
    availabilityStatus: 'Available' | 'Busy' | 'On Leave' | 'Inactive';
    backupMemberId?: string;
    leaveFrom?: string;
    leaveTo?: string;
    joinedDate: string;
    assignmentType: 'Permanent' | 'Temporary';
    startDate: number | null;
    endDate?: number;
    activeWorkCount?: number;
}

export interface TeamTransferRules {
    autoTransferEnabled: boolean;
    backupPriority: 'Backup Member' | 'Least-loaded' | 'Team Lead';
    maxWorkloadThreshold: number;
    fallbackToLead: boolean;
}

export interface TeamActivityLog {
    id: string;
    teamId: string;
    performedByEmployeeId?: string;
    performedByAuthId?: string;
    performedByName?: string;
    action: string;
    details: any;
    remarks?: string;
    createdAt: number;
}

export interface Task {
    id: string;
    teamId: string;
    title: string;
    description?: string;
    assignedTo: string; // Employee ID
    assignedBy: string; // Employee ID
    status: 'Pending' | 'In Progress' | 'Completed';
    dueDate: number;
    createdAt: number;
    updatedAt: number;
}

export interface Team {
    id: string;
    name: string;
    description?: string;
    type: TeamType;
    departmentId?: string;
    clientId?: string;
    leadId?: string;
    status: 'ACTIVE' | 'INACTIVE';
    members: Record<string, TeamMember>;
    createdAt: number;
    updatedAt?: number | null;
}

const API_BASE = '/api/teams';

// --- Realtime Singletons & Pools ---
let globalTeamsChannel: any = null;
let teamsCallbacks: ((teams: Team[]) => void)[] = [];

export const refetchTeams = async () => {
    try {
        console.log("[listenToTeams] Fetching teams from " + API_BASE);
        const response = await fetch(API_BASE, { credentials: 'include' });
        console.log("[listenToTeams] Status:", response.status, response.statusText);
        
        const rawText = await response.text();
        console.log("[listenToTeams] Raw Response:", rawText);
        
        let result: any = {};
        try {
            result = rawText ? JSON.parse(rawText) : {};
        } catch (parseError) {
            console.error("[listenToTeams] JSON Parse Error:", parseError);
            console.error("[listenToTeams] Non-JSON Response:", rawText);
        }

        if (!response.ok) {
            console.error("[listenToTeams] API Failed:", {
                url: API_BASE,
                status: response.status,
                statusText: response.statusText,
                rawText: rawText ? rawText.substring(0, 500) : null,
                parsedResult: result
            });
            throw new Error(
                result?.error || result?.message || (rawText ? rawText.substring(0, 100) : `API failed with ${response.status}`)
            );
        }

        if (result.success && Array.isArray(result.data)) {
            console.log("[listenToTeams] Received " + result.data.length + " teams");
            teamsCallbacks.forEach(cb => cb(result.data));
        } else {
            console.error("[listenToTeams] Invalid API Shape:", result);
            teamsCallbacks.forEach(cb => cb([]));
        }
    } catch (error) {
        console.error("[listenToTeams] Fetch Error:", error);
    }
};

export const listenToTeams = (callback: (teams: Team[]) => void) => {
    teamsCallbacks.push(callback);
    refetchTeams();

    if (!globalTeamsChannel) {
        globalTeamsChannel = supabase
            .channel('realtime:teams-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, refetchTeams)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, refetchTeams)
            .subscribe();
    }

    return () => {
        teamsCallbacks = teamsCallbacks.filter(cb => cb !== callback);
        if (teamsCallbacks.length === 0 && globalTeamsChannel) {
            supabase.removeChannel(globalTeamsChannel);
            globalTeamsChannel = null;
        }
    };
};

// --- Mutations ---

export const createTeam = async (teamData: Partial<Team>) => {
    const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(teamData)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to create team');
    return result.id;
};

export const updateTeam = async (teamId: string, updates: Partial<Team>) => {
    const response = await fetch(`${API_BASE}/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update team');
    return result;
};

export const deleteTeam = async (teamId: string) => {
    const response = await fetch(`${API_BASE}/${teamId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to delete team');
    return result;
};

export const addTeamMember = async (teamId: string, employeeId: string, memberInfo: Partial<TeamMember>) => {
    const response = await fetch(`${API_BASE}/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeId, ...memberInfo })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to add member');
    return result;
};

export const removeTeamMember = async (teamId: string, employeeId: string) => {
    const response = await fetch(`${API_BASE}/${teamId}/members/${employeeId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to remove member');
    return result;
};

export const updateTeamMemberRole = async (teamId: string, employeeId: string, role: string) => {
    const response = await fetch(`${API_BASE}/${teamId}/members/${employeeId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update role');
    return result;
};

export const updateMemberAvailability = async (teamId: string, employeeId: string, status: string, leaveDates?: { from?: string, to?: string }) => {
    const response = await fetch(`${API_BASE}/${teamId}/members/${employeeId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, leaveFrom: leaveDates?.from, leaveTo: leaveDates?.to })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update availability');
    return result;
};

// --- Transfer Rules ---

export const fetchTeamTransferRules = async (teamId: string): Promise<TeamTransferRules | null> => {
    const response = await fetch(`${API_BASE}/${teamId}/transfer-rules`, { credentials: 'include' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to fetch transfer rules');
    if (!result.data) return null;
    return {
        autoTransferEnabled: result.data.auto_transfer_enabled,
        backupPriority: result.data.backup_priority,
        maxWorkloadThreshold: result.data.max_workload_threshold,
        fallbackToLead: result.data.fallback_to_lead
    };
};

export const updateTeamTransferRules = async (teamId: string, rules: TeamTransferRules) => {
    const response = await fetch(`${API_BASE}/${teamId}/transfer-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rules)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update transfer rules');
    return result;
};

// --- History ---

export const fetchTeamHistory = async (teamId: string): Promise<TeamActivityLog[]> => {
    const response = await fetch(`${API_BASE}/${teamId}/history`, { credentials: 'include' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to fetch history');
    return (result.data || []).map((row: any) => ({
        id: row.id,
        teamId: row.team_id,
        performedByEmployeeId: row.performed_by_employee_id,
        performedByAuthId: row.performed_by_auth_id,
        performedByName: row.performed_by_name,
        action: row.action,
        details: row.details,
        remarks: row.remarks,
        createdAt: new Date(row.created_at).getTime()
    }));
};

export const logTeamActivity = async (params: any) => {
    const response = await fetch(`${API_BASE}/${params.teamId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params)
    });
    const result = await response.json();
    return result;
};

// --- Tasks (Realtime) ---
const tasksChannelPool = new Map<string, any>();
const tasksCallbackPool = new Map<string, ((tasks: Task[]) => void)[]>();

const fetchTasksForTeamGlobal = async (teamId: string) => {
    const response = await fetch(`${API_BASE}/${teamId}/tasks`, { credentials: 'include' });
    const result = await response.json();
    if (result.success) {
        const mapped = (result.data || []).map((row: any) => ({
            id: row.id,
            teamId: row.team_id,
            title: row.title,
            description: row.description,
            assignedTo: row.assigned_to,
            assignedBy: row.assigned_by,
            status: row.status,
            dueDate: row.due_date ? new Date(row.due_date).getTime() : 0,
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: new Date(row.updated_at).getTime()
        }));
        const cbs = tasksCallbackPool.get(teamId) || [];
        cbs.forEach(cb => cb(mapped));
    }
};

export const listenToTeamTasks = (teamId: string, callback: (tasks: Task[]) => void) => {
    if (!tasksCallbackPool.has(teamId)) tasksCallbackPool.set(teamId, []);
    tasksCallbackPool.get(teamId)!.push(callback);
    fetchTasksForTeamGlobal(teamId);

    if (!tasksChannelPool.has(teamId)) {
        const channel = supabase
            .channel(`realtime:tasks-${teamId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_tasks', filter: `team_id=eq.${teamId}` }, () => fetchTasksForTeamGlobal(teamId))
            .subscribe();
        tasksChannelPool.set(teamId, channel);
    }

    return () => {
        const filtered = (tasksCallbackPool.get(teamId) || []).filter(cb => cb !== callback);
        if (filtered.length === 0) {
            tasksCallbackPool.delete(teamId);
            const chan = tasksChannelPool.get(teamId);
            if (chan) {
                supabase.removeChannel(chan);
                tasksChannelPool.delete(teamId);
            }
        } else {
            tasksCallbackPool.set(teamId, filtered);
        }
    };
};

import { supabase } from './supabase';

export interface WorkAssignmentHistory {
    id: string;
    work_id: string;
    old_team_id?: string;
    new_team_id?: string;
    old_member_id?: string;
    new_member_id?: string;
    action: string;
    reason?: string;
    performed_by?: string;
    created_at: string;
}

/**
 * PHASE 2: WORK ASSIGNMENT SERVICE
 */

// 1. Get Auto Assignment Setting
export async function getWorkAutoAssignmentSetting(): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'work_auto_assignment_enabled')
            .maybeSingle();
        
        if (error || !data) return false;
        
        // Handle value being boolean or string "true"/"false"
        if (typeof data.value === 'boolean') return data.value;
        if (typeof data.value === 'string') return data.value === 'true';
        if (typeof data.value === 'object' && data.value !== null) {
            // If it's a JSONB object, maybe it's { enabled: true }
            return (data.value as any).enabled === true;
        }
        return false;
    } catch (err) {
        console.error("Error fetching assignment setting:", err);
        return false;
    }
}

// 2. Find Eligible Teams for Work (Used strictly for reading available matches)
export async function findEligibleTeamsForWork(work: any) {
    const { data: teams, error } = await supabase
        .from('teams')
        .select('*')
        .eq('status', 'ACTIVE')
        .eq('is_deleted', false);
    
    if (error || !teams) return [];

    const clientId = work.client_id || work.clientId;
    const departmentId = work.department_id || work.departmentId;

    // Filter logic based on priority rules
    // Rule 1: Client + Department match
    if (clientId && departmentId) {
        const matches = teams.filter(t => t.type === 'client-work' && t.client_id === clientId && t.department_id === departmentId);
        if (matches.length > 0) return matches;
    }

    // Rule 2: Client match
    if (clientId) {
        const matches = teams.filter(t => t.type === 'client' && t.client_id === clientId);
        if (matches.length > 0) return matches;
    }

    // Rule 3: Department match
    if (departmentId) {
        const matches = teams.filter(t => t.type === 'department' && t.department_id === departmentId);
        if (matches.length > 0) return matches;
    }

    return [];
}

// 3. Auto Assign Work to Team
export async function autoAssignWorkToTeam(workId: string) {
    try {
        const res = await fetch('/api/assignments/auto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ workId })
        });
        const result = await res.json();
        return result;
    } catch (err) {
        console.error("Error auto-assigning work:", err);
        return { success: false, reason: 'Failed to connect to backend' };
    }
}

// 4. Assign Work to Team (Manual)
export async function assignWorkToTeam(workId: string, teamId: string, assignedBy: string) {
    try {
        const res = await fetch('/api/assignments/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ workId, teamId, assignedByOverride: assignedBy })
        });
        const result = await res.json();
        return result;
    } catch (err) {
        console.error("Error assigning work:", err);
        return { success: false, error: err };
    }
}

// 5. Reassign Work to Team
export async function reassignWorkToTeam(workId: string, newTeamId: string, assignedBy: string, reason: string) {
    try {
        const res = await fetch('/api/assignments/team/reassign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ workId, newTeamId, reason, assignedByOverride: assignedBy })
        });
        const result = await res.json();
        return result;
    } catch (err) {
        console.error("Error reassigning work:", err);
        return { success: false, error: err };
    }
}

// 6 & 7. Get Works for Assign Works Page
export async function getUnassignedWorks() {
    return await supabase
        .from('works')
        .select('*')
        .or('assignment_status.eq.UNASSIGNED,assigned_team_id.is.null')
        .order('created_at', { ascending: false });
}

export async function getTeamAssignedWorks() {
    return await supabase
        .from('works')
        .select('*, teams:assigned_team_id(name), current_handler:employees!current_handler_id(id, full_name)')
        .not('assigned_team_id', 'is', null)
        .order('created_at', { ascending: false });
}

// 8. Get Works by Team ID
export async function getWorksByAssignedTeam(teamId: string) {
    return await supabase
        .from('works')
        .select(`
            *,
            work_member_assignments (
                *,
                employees!fk_member_assignment_employee (
                    id,
                    full_name,
                    photo_url
                )
            )
        `)
        .eq('assigned_team_id', teamId)
        .order('created_at', { ascending: false });
}

// 9. Assign Work Item to Member
export async function assignWorkItemToMember(params: {
    workId: string;
    workItemId?: string;
    teamId: string;
    memberId: string;
    assignedBy: string;
}) {
    try {
        const res = await fetch('/api/assignments/member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                workId: params.workId, 
                workItemId: params.workItemId, 
                teamId: params.teamId, 
                memberId: params.memberId, 
                assignedByOverride: params.assignedBy 
            })
        });
        const result = await res.json();
        return result;
    } catch (err) {
        console.error("Error assigning member:", err);
        return { success: false, error: err };
    }
}

// 10. Get Assignable Members
export async function getAssignableMembersForTeam(teamId: string) {
    const { data: members, error } = await supabase
        .from('team_members')
        .select(`
            *,
            employees!team_members_employee_id_fkey (
                id,
                full_name,
                photo_url
            )
        `)
        .eq('team_id', teamId)
        .not('availability_status', 'in', '("On Leave", "Inactive")');
    
    if (error || !members) return [];

    // Map and sort
    const order = { 'Team Lead': 0, 'Senior Member': 1, 'Member': 2, 'Reviewer': 3, 'Backup Member': 4 };
    
    // In a real app, we would fetch workload count here
    // For now we assume activeWorkCount is managed elsewhere or added to member metadata

    return members.map(m => ({
        id: m.employee_id,
        name: m.employees?.full_name || 'Unknown',
        role: m.role,
        photoUrl: m.employees?.photo_url,
        availability: m.availability_status
    })).sort((a, b) => (order[a.role as keyof typeof order] || 99) - (order[b.role as keyof typeof order] || 99));
}

// 11. Handle Member Leave Reassignment
export async function handleMemberLeaveReassignment(teamId: string, memberId: string) {
    // 1. Find all active assignments for this member in this team
    const { data: activeAssignments, error: fetchError } = await supabase
        .from('work_member_assignments')
        .select('*, works(assignment_status)')
        .eq('team_id', teamId)
        .eq('assigned_member_id', memberId)
        .eq('status', 'ASSIGNED');

    if (fetchError || !activeAssignments || activeAssignments.length === 0) return { success: true, count: 0 };

    // 2. Fetch team transfer rules
    const { data: rules } = await supabase
        .from('team_transfer_rules')
        .select('*')
        .eq('team_id', teamId)
        .single();

    if (!rules?.auto_transfer_enabled) {
        for (const ass of activeAssignments) {
            await fetch('/api/assignments/needs-reassignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    workId: ass.work_id, 
                    oldMemberId: memberId,
                    reason: 'Assignee went on leave'
                })
            });
        }
        return { success: true, transferred: 0, marked: activeAssignments.length };
    }

    // 3. Find backup
    const availableMembers = await getAssignableMembersForTeam(teamId);
    const backups = availableMembers.filter(m => m.id !== memberId);

    if (backups.length === 0) {
        for (const ass of activeAssignments) {
            await fetch('/api/assignments/needs-reassignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    workId: ass.work_id, 
                    oldMemberId: memberId,
                    reason: 'Assignee went on leave (No backup available)'
                })
            });
        }
        return { success: true, transferred: 0, marked: activeAssignments.length };
    }

    // Logic for backupPriority
    let targetBackup = backups[0];
    if (rules.backup_priority === 'Backup Member') {
        const dedicated = backups.find(m => m.role === 'Backup Member');
        if (dedicated) targetBackup = dedicated;
    } else if (rules.backup_priority === 'Team Lead') {
        const lead = backups.find(m => m.role === 'Team Lead');
        if (lead) targetBackup = lead;
    }

    // 4. Perform Transfer
    for (const ass of activeAssignments) {
        await assignWorkItemToMember({
            workId: ass.work_id,
            workItemId: ass.work_item_id,
            teamId: teamId,
            memberId: targetBackup.id,
            assignedBy: 'SYSTEM'
        });
    }

    return { success: true, transferred: activeAssignments.length };
}

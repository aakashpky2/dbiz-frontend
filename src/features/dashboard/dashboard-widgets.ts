import { Role } from '@/types/rbac';

export type DashboardProfile = 'super_admin' | 'admin' | 'hr' | 'staff' | 'intern';

export interface DashboardWidget {
    key: string;
    title: string;
    dashboardProfiles: DashboardProfile[];
    requiredPermissions?: string[];
    type: 'kpi' | 'chart' | 'table' | 'alert' | 'progress';
    component: React.ComponentType<any> | string; // We'll map strings to actual imports in the page
    sortOrder: number;
}

export function getDashboardProfile(roles: Role[] = [], isOwnerSuperAdmin = false): DashboardProfile {
    if (isOwnerSuperAdmin) return 'super_admin';

    if (roles && roles.length > 0) {
        const sortedRoles = [...roles].sort((a, b) => (a.priority || 10) - (b.priority || 10));
        for (const role of sortedRoles) {
            const name = (role.name || '').toLowerCase();
            if (name.includes('super admin')) return 'super_admin';
            if (name.includes('admin')) return 'admin';
            if (name.includes('hr')) return 'hr';
            if (name.includes('staff')) return 'staff';
            if (name.includes('intern')) return 'intern';
        }
    }
    
    return 'staff'; // Default
}

// Widget Registry
export const dashboardWidgets: DashboardWidget[] = [
    // SUPER ADMIN / ADMIN CHARTS
    {
        key: "proposal_status_chart",
        title: "Proposal Status",
        dashboardProfiles: ["super_admin", "admin"],
        type: "chart",
        component: "ProposalStatusChart",
        sortOrder: 10
    },
    {
        key: "work_status_chart",
        title: "Work Status",
        dashboardProfiles: ["super_admin", "admin"],
        type: "chart",
        component: "WorkStatusChart",
        sortOrder: 20
    },
    {
        key: "revenue_trend_chart",
        title: "Proposal Value Trend",
        dashboardProfiles: ["super_admin", "admin"],
        type: "chart",
        component: "RevenueTrendChart",
        sortOrder: 30
    },
    {
        key: "attendance_summary_chart",
        title: "Attendance Summary",
        dashboardProfiles: ["super_admin", "admin", "hr"],
        type: "chart",
        component: "AttendanceSummaryChart",
        sortOrder: 40
    },
    {
        key: "dsc_expiry_chart",
        title: "DSC Expiry",
        dashboardProfiles: ["super_admin", "admin"],
        type: "chart",
        component: "DSCExpiryChart",
        sortOrder: 50
    },
    
    // HR CHARTS
    {
        key: "late_arrival_trend_chart",
        title: "Late Arrival Trend",
        dashboardProfiles: ["hr"],
        type: "chart",
        component: "LateArrivalTrendChart",
        sortOrder: 60
    },
    {
        key: "recruitment_pipeline_chart",
        title: "Recruitment Pipeline",
        dashboardProfiles: ["hr"],
        type: "chart",
        component: "RecruitmentPipelineChart",
        sortOrder: 70
    },

    // STAFF CHARTS
    {
        key: "task_status_chart",
        title: "My Task Status",
        dashboardProfiles: ["staff"],
        type: "chart",
        component: "TaskStatusChart",
        sortOrder: 80
    },
    {
        key: "work_progress_chart",
        title: "My Work Progress",
        dashboardProfiles: ["staff"],
        type: "chart",
        component: "WorkProgressChart",
        sortOrder: 90
    },

    // INTERN CHARTS
    {
        key: "intern_task_status_chart",
        title: "Assigned Task Status",
        dashboardProfiles: ["intern"],
        type: "chart",
        component: "TaskStatusChart",
        sortOrder: 100
    },
    {
        key: "intern_completion_progress_chart",
        title: "Completion Progress",
        dashboardProfiles: ["intern"],
        type: "chart",
        component: "WorkProgressChart",
        sortOrder: 110
    }
];

export interface PermissionDef {
    id: string;
    label: string;
    description: string;
    category: string;
}

export const PERMISSIONS: PermissionDef[] = [
    // Dashboard & General
    { id: 'VIEW_DASHBOARD', label: 'View Dashboard', description: 'Access to the main dashboard', category: 'Dashboard' },

    // Tasks
    { id: 'VIEW_TASKS', label: 'View Tasks', description: 'Access tasks section', category: 'Tasks' },
    { id: 'VIEW_MY_TASKS', label: 'View My Tasks', description: 'View assigned tasks', category: 'Tasks' },
    { id: 'VIEW_ALL_TASKS', label: 'View All Tasks', description: 'View all tasks in the system', category: 'Tasks' },
    { id: 'CLAIM_TASKS', label: 'Claim Tasks', description: 'Claim tasks from the pool', category: 'Tasks' },
    { id: 'COMPLETE_TASKS', label: 'Complete Tasks', description: 'Mark tasks as completed', category: 'Tasks' },
    { id: 'PAUSE_TASKS', label: 'Pause Tasks', description: 'Pause ongoing tasks', category: 'Tasks' },

    // Work
    { id: 'VIEW_WORK', label: 'View Work', description: 'Access work register', category: 'Work' },
    { id: 'MANAGE_WORK', label: 'Manage Work', description: 'Create and edit works', category: 'Work' },
    { id: 'ASSIGN_WORK', label: 'Assign Work', description: 'Assign work to employees', category: 'Work' },

    // Clients
    { id: 'VIEW_CLIENTS', label: 'View Clients', description: 'View client list', category: 'Clients' },
    { id: 'MANAGE_CLIENTS', label: 'Manage Clients', description: 'Add and edit client details', category: 'Clients' },

    // Proposals
    { id: 'VIEW_PROPOSALS', label: 'View Proposals', description: 'View proposals', category: 'Proposals' },
    { id: 'MANAGE_PROPOSALS', label: 'Manage Proposals', description: 'Create and manage proposals', category: 'Proposals' },

    // Workflow
    { id: 'VIEW_WORKFLOWS', label: 'View Workflows', description: 'View system workflows', category: 'Workflow' },
    { id: 'MANAGE_WORKFLOWS', label: 'Manage Workflows', description: 'Create and manage workflows', category: 'Workflow' },
    { id: 'MANAGE_WORK_BASED_FLOW', label: 'Manage Work Based Flow', description: 'Manage work-based flows', category: 'Workflow' },
    { id: 'MANAGE_CLIENT_BASED_FLOW', label: 'Manage Client Based Flow', description: 'Manage client-based flows', category: 'Workflow' },

    // Employee & HR
    { id: 'VIEW_EMPLOYEE_DIRECTORY', label: 'View Employee Directory', description: 'View list of employees', category: 'Employee' },
    { id: 'MANAGE_EMPLOYEES', label: 'Manage Employees', description: 'Add, edit, and delete employees', category: 'Employee' },
    { id: 'VIEW_TEAMS', label: 'View Teams', description: 'View teams', category: 'Employee' },
    { id: 'MANAGE_TEAMS', label: 'Manage Teams', description: 'Create and manage teams', category: 'Employee' },
    { id: 'VIEW_ALL_ATTENDANCE', label: 'View All Attendance', description: 'View attendance of all employees', category: 'Employee' },
    { id: 'MANAGE_LEAVES', label: 'Manage Leaves', description: 'Approve or reject leave requests', category: 'Employee' },
    { id: 'MANAGE_PROMOTIONS', label: 'Manage Promotions', description: 'Manage employee promotions', category: 'Employee' },

    // Admin & System
    { id: 'VIEW_ADMIN_PANEL', label: 'View Admin Panel', description: 'Access to the admin section', category: 'Admin' },
    { id: 'MANAGE_USERS', label: 'Manage Users', description: 'Assign roles and manage user accounts', category: 'Admin' },
    { id: 'MANAGE_SYSTEM_ROLES', label: 'Manage System Roles', description: 'Create and edit system roles', category: 'Admin' },
    { id: 'MANAGE_PERMISSIONS', label: 'Manage Permissions', description: 'Manage permission assignments', category: 'Admin' },
    { id: 'MANAGE_DEPARTMENTS', label: 'Manage Departments', description: 'Create and edit departments', category: 'Admin' },
    { id: 'MANAGE_SETTINGS', label: 'Manage Settings', description: 'Access system settings', category: 'Admin' },

    // Reports
    { id: 'VIEW_REPORTS', label: 'View Reports', description: 'View system reports', category: 'Reports' },
    { id: 'EXPORT_REPORTS', label: 'Export Reports', description: 'Export reports to CSV/PDF', category: 'Reports' },

    // Government Fees
    { id: 'government_fee.view', label: 'View Government Fees', description: 'View government fee configurations', category: 'Government Fees' },
    { id: 'government_fee.create', label: 'Create Government Fees', description: 'Create new government fee configurations', category: 'Government Fees' },
    { id: 'government_fee.edit', label: 'Edit Government Fees', description: 'Edit existing government fee configurations', category: 'Government Fees' },
    { id: 'government_fee.delete', label: 'Delete Government Fees', description: 'Delete government fee configurations', category: 'Government Fees' },
    { id: 'government_fee.calculate', label: 'Calculate Government Fees', description: 'Test and calculate government fees', category: 'Government Fees' },

    // Rate Card
    { id: 'rate_card.view', label: 'View Rate Cards', description: 'Access rate card listings and details', category: 'Rate Card' },
    { id: 'rate_card.create', label: 'Create Rate Cards', description: 'Create new rate cards', category: 'Rate Card' },
    { id: 'rate_card.edit', label: 'Edit Rate Cards', description: 'Edit existing rate cards and service items', category: 'Rate Card' },
    { id: 'rate_card.delete', label: 'Delete Rate Cards', description: 'Delete rate cards and service items', category: 'Rate Card' },
    { id: 'rate_card.submit_approval', label: 'Submit for Approval', description: 'Submit rate cards for approval workflow', category: 'Rate Card' },
    { id: 'rate_card.approve', label: 'Approve Rate Cards', description: 'Approve rate card submissions and change requests', category: 'Rate Card' },
    { id: 'rate_card.reject', label: 'Reject Rate Cards', description: 'Reject rate card submissions and change requests', category: 'Rate Card' },

    // Accounts
    { id: 'VIEW_ACCOUNTS', label: 'View Accounts', description: 'Access to the accounts module', category: 'Accounts' },
    { id: 'BILLING_VIEW', label: 'Billing View', description: 'View billing records', category: 'Accounts' },
    { id: 'BILLING_CREATE', label: 'Billing Create', description: 'Create new bills', category: 'Accounts' },
    { id: 'BILLING_EDIT', label: 'Billing Edit', description: 'Edit existing bills', category: 'Accounts' },
    { id: 'BILLING_APPROVE', label: 'Billing Approve', description: 'Approve bills for tax invoice generation', category: 'Accounts' },
    { id: 'BILLING_CANCEL', label: 'Billing Cancel', description: 'Cancel bills or invoices', category: 'Accounts' },
    { id: 'BILLING_PAYMENTS', label: 'Billing Payments', description: 'Manage and record bill payments', category: 'Accounts' },

    // Owner Specific
    { id: 'OWNER_SUPER_ADMIN_CONTROLS', label: 'Owner Super Admin Controls', description: 'Ultimate control over core system constraints', category: 'Owner' },
];

export const CATEGORIZED_PERMISSIONS = PERMISSIONS.reduce((acc, permission) => {
    if (!acc[permission.category]) {
        acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
}, {} as Record<string, PermissionDef[]>);

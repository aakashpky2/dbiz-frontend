import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users2, List, CalendarCheck2, CalendarDays, Plane, TrendingUp, FileText, Settings, Briefcase, CheckSquare, Building, LibraryBig, Map, Globe, Handshake, Network, Users, ShieldCheck, Clock, Link as LinkIcon, Workflow, ListTodo, FileSpreadsheet, Scale, KeyRound, UserPlus, Database, IndianRupee, Landmark, Target } from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  subLinks?: NavLink[];
  requiredPermission?: string;
  requiredPermissionAny?: string[];
}

export const mainNavLinks: NavLink[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    requiredPermission: 'VIEW_DASHBOARD',
  },
  {
    href: '/dashboard/attendance',
    label: 'My Attendance',
    icon: CalendarCheck2,
  },
  {
    href: '/dashboard/work-register/my-tasks',
    label: 'Tasks',
    icon: ListTodo,
    requiredPermissionAny: ['VIEW_TASKS', 'VIEW_MY_TASKS', 'VIEW_ALL_TASKS'],
  },
  {
    href: '/dashboard/work',
    label: 'Work',
    icon: Briefcase,
    requiredPermission: 'VIEW_WORK',
    subLinks: [
      {
        href: '/dashboard/work/clients',
        label: 'Clients',
        icon: Users2,
        requiredPermission: 'VIEW_CLIENTS',
      },
      {
        href: '/dashboard/work/queries',
        label: 'New Enquiries',
        icon: List,
        requiredPermission: 'VIEW_WORK',
      },
      {
        href: '/dashboard/work/proposals',
        label: 'Proposals',
        icon: FileText,
        requiredPermission: 'VIEW_PROPOSALS',
      },
      {
        href: '/dashboard/work/works',
        label: 'Work Register',
        icon: FileSpreadsheet,
        requiredPermission: 'VIEW_WORK',
      },
      {
        href: '/dashboard/work/works/assign',
        label: 'Assign Works',
        icon: Users,
        requiredPermission: 'ASSIGN_WORK',
      },
    ]
  },
  {
    href: '/dashboard/dsc-management',
    label: 'DSC Management',
    icon: KeyRound,
    subLinks: [
      {
        href: '/dashboard/dsc-management',
        label: 'Operations & Tracking',
        icon: LayoutDashboard,
      },
      {
        href: '/dashboard/dsc-management/masters',
        label: 'Masters Config',
        icon: Settings,
      },
      {
        href: '/dashboard/dsc-management/tokens',
        label: 'Token Inventory',
        icon: KeyRound,
      }
    ]
  },
  {
    href: '/dashboard/workflow',
    label: 'Workflow Management',
    icon: Workflow,
    requiredPermission: 'VIEW_WORKFLOWS',
    subLinks: [
      {
        href: '/dashboard/admin/work-schedules',
        label: 'Work Based Flow',
        icon: Clock,
        requiredPermission: 'MANAGE_WORK_BASED_FLOW',
      },
      {
        href: '/dashboard/work/schedules',
        label: 'Client Based Flow',
        icon: LinkIcon,
        requiredPermission: 'MANAGE_CLIENT_BASED_FLOW',
      },
    ]
  },
  {
    href: '/dashboard/employee-management',
    label: 'Employee Management',
    icon: Users2,
    requiredPermission: 'VIEW_EMPLOYEE_DIRECTORY',
    subLinks: [
      {
        href: '/dashboard/employee-directory',
        label: 'Employees',
        icon: List,
        requiredPermission: 'VIEW_EMPLOYEE_DIRECTORY',
      },
      {
        href: '/dashboard/employee-directory/employment',
        label: 'Employment Details',
        icon: Briefcase,
        requiredPermission: 'VIEW_EMPLOYEE_DIRECTORY',
      },
      {
        href: '/dashboard/employee-management/promotions',
        label: 'Promotion Details',
        icon: TrendingUp,
        requiredPermission: 'MANAGE_PROMOTIONS',
      },
      {
        href: '/dashboard/employee-management/offer-letter',
        label: 'Offer Letter',
        icon: FileText,
        requiredPermission: 'MANAGE_EMPLOYEES',
      },
      {
        href: '/dashboard/employee-management/attendance',
        label: 'Attendance Records',
        icon: CheckSquare,
        requiredPermission: 'VIEW_ALL_ATTENDANCE',
      },
      {
        href: '/dashboard/employee-management/holidays',
        label: 'Holiday List',
        icon: CalendarDays,
      },
      {
        href: '/dashboard/employee-management/leaves',
        label: 'Leave Management',
        icon: Plane,
        requiredPermission: 'MANAGE_LEAVES',
      },
      {
        href: '/dashboard/employee-management/team-management',
        label: 'Team Management',
        icon: Users,
        requiredPermission: 'VIEW_TEAMS',
      },
      {
        href: '/dashboard/employee-management/configurations',
        label: 'Configurations',
        icon: Settings,
        requiredPermission: 'MANAGE_SETTINGS',
      }
    ],
  },
  {
    href: '/dashboard/recruitment',
    label: 'Recruitment',
    icon: UserPlus,
    subLinks: [
      {
        href: '/dashboard/recruitment/jobs',
        label: 'Job Openings',
        icon: Briefcase,
      },
      {
        href: '/dashboard/recruitment/applicants',
        label: 'Applicants',
        icon: Users,
      },
      {
        href: '/dashboard/recruitment/shortlisted',
        label: 'Shortlisted',
        icon: CheckSquare,
      },
      {
        href: '/dashboard/recruitment/scheduled',
        label: 'Scheduled Interviews',
        icon: CalendarDays,
      },
      {
        href: '/dashboard/recruitment/pipeline',
        label: 'Recruitment Pipeline',
        icon: Workflow,
      },
      {
        href: '/dashboard/recruitment/master',
        label: 'Recruitment Master',
        icon: Settings,
      }
    ]
  },
  {
    href: '/dashboard/accounts',
    label: 'Accounts',
    icon: Landmark,
    requiredPermission: 'VIEW_ACCOUNTS',
    subLinks: [
      {
        href: '/dashboard/accounts/billing',
        label: 'Billing',
        icon: Landmark,
        requiredPermission: 'BILLING_VIEW',
      }
    ]
  },
  {
    href: '/dashboard/admin',
    label: 'Admin Panel',
    icon: Settings,
    requiredPermission: 'VIEW_ADMIN_PANEL',
    subLinks: [
      {
        href: '/dashboard/settings',
        label: 'Profile Details',
        icon: Building,
      },
      {
        href: '/dashboard/admin/department-management',
        label: 'Department Management',
        icon: Network,
        requiredPermission: 'MANAGE_DEPARTMENTS',
      },
      {
        href: '/dashboard/admin/forms-and-fees',
        label: 'Forms & Fees',
        icon: FileSpreadsheet,
      },

      {
        href: '/dashboard/admin/system-roles',
        label: 'System Roles',
        icon: ShieldCheck,
        requiredPermission: 'MANAGE_SYSTEM_ROLES',
      },
      {
        href: '/dashboard/admin/templates',
        label: 'Templates',
        icon: FileText,
      },
      {
        href: '/dashboard/admin/templates/configurations',
        label: 'Template Configurations',
        icon: Settings,
      },
      {
        href: '/dashboard/admin/business-constitutions',
        label: 'Constitution',
        icon: LibraryBig,
      },
      {
        href: '/dashboard/admin/associates',
        label: 'Associates',
        icon: Handshake,
      },
      {
        href: '/dashboard/admin/compliance-rules',
        label: 'Compliance Rules',
        icon: Scale,
      },
      {
        href: '/dashboard/admin/permissions',
        label: 'Permissions',
        icon: ShieldCheck,
        requiredPermission: 'MANAGE_PERMISSIONS',
      },
      {
        href: '/dashboard/admin/user-management',
        label: 'User Management',
        icon: Users2,
        requiredPermission: 'MANAGE_USERS',
      },
      {
        href: '/dashboard/admin/master-data',
        label: 'Master Configurations',
        icon: Database,
      },
      {
        href: '/dashboard/admin/rate-card',
        label: 'Rate Card',
        icon: IndianRupee,
      },
      {
        href: '/dashboard/admin/performance',
        label: 'Performance',
        icon: Target,
        requiredPermission: 'VIEW_PERFORMANCE',
      }
    ]
  }
];

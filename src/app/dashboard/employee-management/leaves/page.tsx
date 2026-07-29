'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from 'next/dynamic';

const LeaveRequestDialog = dynamic(() => import('./_components/LeaveRequestDialog').then(mod => mod.LeaveRequestDialog), { ssr: false });

import {
  Loader2, AlertTriangle, CalendarDays, Inbox, PlusCircle,
  CalendarIcon, Edit, Trash2, CheckCircle, XCircle,
  Clock, Check, X, Filter, Users, Activity, Layers, Search, RefreshCw, ChevronDown, ChevronUp, FileText,
  CalendarCheck2, ClipboardList
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/use-permissions';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageSkeleton } from '@/components/ui/page-skeleton';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  duration: 'single' | 'multiple' | 'half';
  halfDayType?: 'first-half' | 'second-half';
  leaveDate?: string;
  startDate?: string;
  endDate?: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedDate: number;
}

interface Employee {
  id: string;
  name: string;
  fullName: string;
  employeeId: string;
  profilePictureUrl?: string;
}

const leaveTypes = [
  { value: "Casual Leave", label: "Casual Leave" },
  { value: "Sick Leave", label: "Sick Leave" },
  { value: "Earned Leave", label: "Earned Leave" },
  { value: "Work From Home", label: "Work From Home" },
  { value: "Other", label: "Other" },
];

const leaveFormSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required.'),
  leaveType: z.string().min(1, 'Leave type is required.'),
  duration: z.enum(['single', 'multiple', 'half'], { required_error: 'Duration is required.' }),
  halfDayType: z.enum(['first-half', 'second-half']).optional(),
  date: z.date().optional(),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
  reason: z.string().min(10, { message: 'Reason must be at least 10 characters long.' }),
  status: z.enum(['Pending', 'Approved', 'Rejected']).default('Pending'),
}).superRefine((data, ctx) => {
  if (data.duration === 'single' && !data.date) {
    ctx.addIssue({ code: 'custom', message: 'A date is required for a single day leave.', path: ['date'] });
  }
  if (data.duration === 'half' && !data.date) {
    ctx.addIssue({ code: 'custom', message: 'A date is required for a half day leave.', path: ['date'] });
  }
  if (data.duration === 'half' && !data.halfDayType) {
    ctx.addIssue({ code: 'custom', message: 'Please select which half of the day.', path: ['halfDayType'] });
  }
  if (data.duration === 'multiple') {
    if (!data.dateRange?.from || !data.dateRange?.to) {
      ctx.addIssue({ code: 'custom', message: 'Start and end dates are required for multiple days.', path: ['dateRange'] });
    } else if (data.dateRange.from > data.dateRange.to) {
      ctx.addIssue({ code: 'custom', message: 'End date cannot be before the start date.', path: ['dateRange'] });
    }
  }
});

type LeaveFormValues = z.infer<typeof leaveFormSchema>;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const getStatusColor = (status: LeaveRequest['status']) => {
  switch (status) {
    case 'Pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'Approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'Rejected': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
  }
};

const getLeaveTypeIcon = (type: string) => {
  switch (type) {
    case 'Sick Leave': return <Activity className="h-3.5 w-3.5" />;
    case 'Casual Leave': return <Users className="h-3.5 w-3.5" />;
    case 'Work From Home': return <Layers className="h-3.5 w-3.5" />;
    default: return <CalendarDays className="h-3.5 w-3.5" />;
  }
};

const displayDate = (leave: LeaveRequest) => {
  if (leave.duration === 'multiple') {
    const start = leave.startDate ? format(parse(leave.startDate, 'yyyy-MM-dd', new Date()), 'dd MMM') : 'N/A';
    const end = leave.endDate ? format(parse(leave.endDate, 'yyyy-MM-dd', new Date()), 'dd MMM') : 'N/A';
    const year = leave.startDate ? format(parse(leave.startDate, 'yyyy-MM-dd', new Date()), 'yyyy') : '';
    return (
      <div className="flex flex-col">
        <span className="font-medium text-slate-900">{start} – {end}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{year}</span>
      </div>
    );
  }
  if (leave.duration === 'half') {
    const half = leave.halfDayType === 'first-half' ? 'First Half' : 'Second Half';
    return (
      <div className="flex flex-col">
        <span className="font-medium text-slate-900">{leave.leaveDate ? format(parse(leave.leaveDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy') : 'N/A'}</span>
        <span className="text-[10px] text-amber-600 uppercase tracking-wider font-bold">{half}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="font-medium text-slate-900">{leave.leaveDate ? format(parse(leave.leaveDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy') : 'N/A'}</span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Single Day</span>
    </div>
  );
};

// ─────────────────────────────────────────────
// Shared LeaveCard — renders for both views
// Hides employee identity section when isEmployeeView
// Hides approve/reject when !canManageLeaves
// ─────────────────────────────────────────────
const LeaveCard = ({
  leave,
  employee,
  canManageLeaves,
  isEmployeeView,
  isUpdatingStatus,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: {
  leave: LeaveRequest;
  employee: Employee | undefined;
  canManageLeaves: boolean;
  isEmployeeView: boolean;
  isUpdatingStatus: string | null;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border shadow-sm rounded-xl overflow-hidden bg-white transition-all hover:shadow-md">
      <div
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Employee identity — only in admin view */}
        {!isEmployeeView && (
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="h-10 w-10 border-2 border-slate-100 shadow-sm">
              {employee?.profilePictureUrl && (
                <AvatarImage src={employee.profilePictureUrl} alt={employee.fullName || leave.employeeName} />
              )}
              <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-sm uppercase">
                {(employee?.fullName || leave.employeeName)?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 leading-tight text-base">{employee?.fullName || leave.employeeName}</span>
              <span className="text-xs text-slate-500 mt-0.5">Emp ID: {employee?.employeeId || 'USR'}</span>
            </div>
          </div>
        )}

        {/* Leave type & date */}
        <div className={cn("flex flex-col md:items-center flex-1", isEmployeeView && "md:items-start")}>
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-sm">
            <span className="p-1 rounded bg-slate-100 text-slate-600">{getLeaveTypeIcon(leave.leaveType)}</span>
            {leave.leaveType}
          </div>
          <span className="text-sm text-slate-600 mt-1">{displayDate(leave)}</span>
        </div>

        {/* Status + toggle */}
        <div className="flex items-center justify-between md:justify-end gap-6 flex-1">
          <div className="flex flex-col items-start md:items-end gap-2">
            <Badge variant="outline" className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm",
              getStatusColor(leave.status)
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5",
                leave.status === 'Pending' ? 'bg-amber-500 animate-pulse' :
                  leave.status === 'Approved' ? 'bg-emerald-500' : 'bg-rose-500'
              )} />
              {leave.status}
            </Badge>
            {!expanded && (
              <p className="text-xs text-slate-500 max-w-[150px] truncate italic">
                &ldquo;{leave.reason}&rdquo;
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 rounded-full">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reason</h4>
                <div className="bg-white p-3 rounded-lg border shadow-sm text-sm text-slate-700 flex items-start gap-2">
                  <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <p>{leave.reason}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Duration</h4>
                  <p className="text-sm font-medium text-slate-800 capitalize">
                    {leave.duration} Day
                    {leave.duration === 'half' && leave.halfDayType && (
                      <span className="text-slate-500 font-normal ml-1">({leave.halfDayType.replace('-', ' ')})</span>
                    )}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Applied On</h4>
                  <div className="flex flex-col text-sm font-medium text-slate-800">
                    <span>{format(new Date(leave.appliedDate), 'dd MMM, yyyy')}</span>
                    <span className="text-xs text-slate-500 font-normal">{format(new Date(leave.appliedDate), 'hh:mm a')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
            {isUpdatingStatus === leave.id ? (
              <div className="flex items-center text-sm text-primary font-medium mr-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...
              </div>
            ) : (
              <>
                {/* Admin-only: Approve / Reject */}
                {leave.status === 'Pending' && canManageLeaves && (
                  <>
                    <Button
                      variant="outline" size="sm"
                      onClick={(e) => { e.stopPropagation(); onReject(); }}
                      className="bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-rose-600 border-rose-200 transition-all font-semibold"
                    >
                      <X className="h-4 w-4 mr-1.5" /> Reject
                    </Button>
                    <Button
                      variant="default" size="sm"
                      onClick={(e) => { e.stopPropagation(); onApprove(); }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white transition-all font-semibold shadow-sm"
                    >
                      <Check className="h-4 w-4 mr-1.5" /> Approve
                    </Button>
                    <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />
                  </>
                )}

                {/* Edit / Delete — only for Pending requests (available to employee for their own) */}
                {leave.status === 'Pending' && (
                  <>
                    <Button
                      variant="outline" size="sm"
                      onClick={(e) => { e.stopPropagation(); onEdit(); }}
                      className="bg-white hover:bg-primary/10 hover:text-primary transition-all text-slate-600"
                    >
                      <Edit className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="bg-white hover:bg-rose-50 hover:text-rose-600 transition-all text-slate-600"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

// ─────────────────────────────────────────────
// Employee View — clean self-service dashboard
// ─────────────────────────────────────────────
function EmployeeLeaveView({
  leaveRequests,
  employees,
  isLoading,
  error,
  isUpdatingStatus,
  isSubmitting,
  showDeleteConfirm,
  isFormDialogOpen,
  editingLeave,
  form,
  leaveToDeleteId,
  onApplyLeave,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onFormSubmit,
  setIsFormDialogOpen,
  setEditingLeave,
}: {
  leaveRequests: LeaveRequest[];
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
  isUpdatingStatus: string | null;
  isSubmitting: boolean;
  showDeleteConfirm: boolean;
  isFormDialogOpen: boolean;
  editingLeave: LeaveRequest | null;
  form: any;
  leaveToDeleteId: string | null;
  onApplyLeave: () => void;
  onEdit: (leave: LeaveRequest) => void;
  onDelete: (id: string) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onFormSubmit: SubmitHandler<LeaveFormValues>;
  setIsFormDialogOpen: (v: boolean) => void;
  setEditingLeave: (v: any) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const myRequests = React.useMemo(() => {
    return leaveRequests.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesSearch = !searchQuery || r.leaveType.toLowerCase().includes(searchQuery.toLowerCase()) || r.reason.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [leaveRequests, statusFilter, searchQuery]);

  const myStats = React.useMemo(() => ({
    pending: leaveRequests.filter(r => r.status === 'Pending').length,
    approved: leaveRequests.filter(r => r.status === 'Approved').length,
    rejected: leaveRequests.filter(r => r.status === 'Rejected').length,
  }), [leaveRequests]);

  const currentRequests = myRequests.filter(r => r.status === 'Pending');
  const history = myRequests.filter(r => r.status !== 'Pending');

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="My Leave"
        description="Apply for leave and track your requests."
      >
        <Button onClick={onApplyLeave} className="font-bold">
          <PlusCircle className="mr-2 h-4 w-4" /> Apply Leave
        </Button>
      </DashboardPageHeader>

      {/* Leave Balance Row (placeholder — extend with real data when available) */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: myStats.pending, color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
          { label: 'Approved', value: myStats.approved, color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle },
          { label: 'Rejected', value: myStats.rejected, color: 'text-rose-600', bg: 'bg-rose-500/10', icon: XCircle },
        ].map((s, i) => (
          <Card key={i} className="bg-card/50 backdrop-blur-sm shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Filter bar */}
      <DashboardFilterBar>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            className="pl-10 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search by type or reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-background">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </DashboardFilterBar>

      {error && (
        <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-800">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <AlertTitle className="font-bold">Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Pending Requests */}
      {currentRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Pending Requests</h3>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">{currentRequests.length}</Badge>
          </div>
          <div className="flex flex-col gap-3">
            {currentRequests.map(leave => (
              <LeaveCard
                key={leave.id}
                leave={leave}
                employee={undefined}
                canManageLeaves={false}
                isEmployeeView={true}
                isUpdatingStatus={isUpdatingStatus}
                onApprove={() => {}}
                onReject={() => {}}
                onEdit={() => onEdit(leave)}
                onDelete={() => onDelete(leave.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarCheck2 className="h-4 w-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Leave History</h3>
          {history.length > 0 && <Badge variant="secondary">{history.length}</Badge>}
        </div>

        {isLoading ? (<div className="p-6"><PageSkeleton /></div>) : history.length === 0 && currentRequests.length === 0 ? (
          <Card className="border border-dashed shadow-none">
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">No leave requests yet</h3>
              <p className="text-slate-500 max-w-sm mt-2 text-sm">You haven&apos;t applied for any leave. Click <strong>Apply Leave</strong> to get started.</p>
              <Button onClick={onApplyLeave} variant="outline" className="mt-5">
                <PlusCircle className="mr-2 h-4 w-4" /> Apply Leave
              </Button>
            </div>
          </Card>
        ) : history.length === 0 ? (
          <Card className="border border-dashed shadow-none">
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <p className="text-slate-500 text-sm">No history matching your filter.</p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map(leave => (
              <LeaveCard
                key={leave.id}
                leave={leave}
                employee={undefined}
                canManageLeaves={false}
                isEmployeeView={true}
                isUpdatingStatus={isUpdatingStatus}
                onApprove={() => {}}
                onReject={() => {}}
                onEdit={() => onEdit(leave)}
                onDelete={() => onDelete(leave.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <LeaveRequestDialog
        isFormDialogOpen={isFormDialogOpen}
        setIsFormDialogOpen={setIsFormDialogOpen}
        editingLeave={editingLeave}
        setEditingLeave={setEditingLeave}
        form={form}
        handleFormSubmit={onFormSubmit}
        employees={employees}
        canManageLeaves={false}
        leaveTypes={leaveTypes}
        isSubmitting={isSubmitting}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={v => !v && onDeleteCancel()}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This will permanently delete your leave request. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={onDeleteCancel} className="rounded-xl border-slate-200">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} disabled={isSubmitting} className="bg-rose-500 hover:bg-rose-600 rounded-xl px-6">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Admin / HR View — full management dashboard
// ─────────────────────────────────────────────
function AdminLeaveView({
  leaveRequests,
  employees,
  isLoading,
  error,
  isUpdatingStatus,
  isSubmitting,
  showDeleteConfirm,
  isFormDialogOpen,
  editingLeave,
  form,
  selectedEmployeeFilter,
  activeTab,
  stats,
  filteredLeaves,
  onAddRequest,
  onReload,
  onEmployeeFilterChange,
  onTabChange,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onFormSubmit,
  setIsFormDialogOpen,
  setEditingLeave,
}: {
  leaveRequests: LeaveRequest[];
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
  isUpdatingStatus: string | null;
  isSubmitting: boolean;
  showDeleteConfirm: boolean;
  isFormDialogOpen: boolean;
  editingLeave: LeaveRequest | null;
  form: any;
  selectedEmployeeFilter: string;
  activeTab: string;
  stats: { total: number; pending: number; approved: number; rejected: number; processed: number };
  filteredLeaves: LeaveRequest[];
  onAddRequest: () => void;
  onReload: () => void;
  onEmployeeFilterChange: (v: string) => void;
  onTabChange: (v: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (leave: LeaveRequest) => void;
  onDelete: (id: string) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onFormSubmit: SubmitHandler<LeaveFormValues>;
  setIsFormDialogOpen: (v: boolean) => void;
  setEditingLeave: (v: any) => void;
}) {
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Leave Management"
        description="Monitor, approve, and track employee absences in real-time."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReload} className="h-9 px-3 font-bold border-muted-foreground/20">
            <RefreshCw className="h-4 w-4 mr-2" /> Reload
          </Button>
          <Button onClick={onAddRequest} className="font-bold">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Request
          </Button>
        </div>
      </DashboardPageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: stats.total, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
          { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10' },
          { label: 'Approved Leaves', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
          { label: 'Declined / Rejected', value: stats.rejected, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-500/10' },
        ].map((stat, i) => (
          <Card key={i} className="bg-card/50 backdrop-blur-sm shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <DashboardFilterBar>
        <div className="flex-1 relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Select value={selectedEmployeeFilter} onValueChange={onEmployeeFilterChange}>
            <SelectTrigger className="pl-10 bg-background">
              <SelectValue placeholder="Filter by employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={onReload} title="Reload data" className="h-10 w-10">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </DashboardFilterBar>

      <Card className="border shadow-sm mt-4">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>View and manage all employee leave applications.</CardDescription>
          </div>
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full md:w-auto">
            <TabsList className="grid w-full md:w-[400px] grid-cols-2">
              <TabsTrigger value="all">
                All Leaves {stats.processed > 0 && <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700 hover:bg-slate-300">{stats.processed}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending {stats.pending > 0 && <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-200">{stats.pending}</Badge>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-6">
              <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <AlertTitle className="font-bold">System Conflict</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {!error && filteredLeaves.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Inbox className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800">Clear Horizon</h3>
              <p className="text-slate-500 max-w-sm mt-2">No leave requests found for the selected criteria.</p>
              <Button onClick={onAddRequest} variant="outline" className="mt-6">Record First Entry</Button>
            </div>
          ) : !error && filteredLeaves.length > 0 ? (
            <div className="flex flex-col gap-4 p-4 md:p-6 bg-slate-50/50">
              {filteredLeaves.map((leave) => {
                const emp = employees.find(e => e.id === leave.employeeId);
                return (
                  <LeaveCard
                    key={leave.id}
                    leave={leave}
                    employee={emp}
                    canManageLeaves={true}
                    isEmployeeView={false}
                    isUpdatingStatus={isUpdatingStatus}
                    onApprove={() => onApprove(leave.id)}
                    onReject={() => onReject(leave.id)}
                    onEdit={() => onEdit(leave)}
                    onDelete={() => onDelete(leave.id)}
                  />
                );
              })}
            </div>
          ) : null}
        </CardContent>
        <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-4 flex items-center justify-between text-xs text-slate-500 font-medium">
          <p>Showing {leaveRequests.length} active entries</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Rejected</span>
          </div>
        </div>
      </Card>

      <LeaveRequestDialog
        isFormDialogOpen={isFormDialogOpen}
        setIsFormDialogOpen={setIsFormDialogOpen}
        editingLeave={editingLeave}
        setEditingLeave={setEditingLeave}
        form={form}
        handleFormSubmit={onFormSubmit}
        employees={employees}
        canManageLeaves={true}
        leaveTypes={leaveTypes}
        isSubmitting={isSubmitting}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={v => !v && onDeleteCancel()}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This will permanently purge this leave record from the central database. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={onDeleteCancel} className="rounded-xl border-slate-200">Abort</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} disabled={isSubmitting} className="bg-rose-500 hover:bg-rose-600 rounded-xl px-6">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Purge Record'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Root Page — owns state, routes to view
// ─────────────────────────────────────────────
export default function LeaveManagementPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leaveToDeleteId, setLeaveToDeleteId] = useState<string | null>(null);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

  const { user, isSuperAdmin, hasPermission, loading: permissionsLoading } = usePermissions();
  const canManageLeaves = isSuperAdmin || hasPermission('MANAGE_LEAVES');

  const { toast } = useToast();

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
  });

  // ── Data fetching ──────────────────────────
  const fetchEmployees = useCallback(async () => {
    if (!canManageLeaves) return; // employees don't need the full list
    try {
      const { data, error: fetchErr } = await supabase
        .from('employees')
        .select('id, full_name, employee_id_hash, photo_url')
        .eq('is_resigned', false)
        .order('full_name');
      if (fetchErr) throw fetchErr;
      const loadedEmployees: Employee[] = (data || []).map((e: any) => ({
        id: e.id,
        employeeId: e.employee_id_hash || e.id,
        fullName: e.full_name,
        name: `${e.full_name} (${e.employee_id_hash || ''})`,
        profilePictureUrl: e.photo_url,
      }));
      setEmployees(loadedEmployees);
    } catch (err) {
            console.error("Error fetching employees:", err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
  }, [canManageLeaves]);

  const fetchLeaveRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('leaves')
        .select('*')
        .order('applied_date', { ascending: false });

      if (!canManageLeaves) {
        query = query.eq('employee_id', user?.uid);
      } else if (selectedEmployeeFilter !== 'all') {
        query = query.eq('employee_id', selectedEmployeeFilter);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const leavesData: LeaveRequest[] = (data || []).map((l: any) => ({
        id: l.id,
        employeeId: l.employee_id,
        employeeName: l.employee_name,
        leaveType: l.leave_type,
        duration: l.duration_type || l.duration,
        halfDayType: l.half_day_type,
        leaveDate: l.leave_date,
        startDate: l.start_date,
        endDate: l.end_date,
        reason: l.reason,
        status: l.status,
        appliedDate: l.applied_date ? new Date(l.applied_date).getTime() : Date.now(),
      }));
      setLeaveRequests(leavesData);
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setError("Failed to fetch leave requests. Please try again later.");
      toast({ title: "Error Fetching Leaves", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedEmployeeFilter, canManageLeaves, user?.uid]);

  useEffect(() => {
    if (!permissionsLoading) {
      fetchEmployees();
      fetchLeaveRequests();
    }
  }, [fetchEmployees, fetchLeaveRequests, permissionsLoading]);

  // ── Handlers ──────────────────────────────
  const handleFormSubmit: SubmitHandler<LeaveFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      // For employee view, use their own ID; for admin, use selected
      const resolvedEmployeeId = canManageLeaves ? data.employeeId : user?.uid;
      const selectedEmployee = canManageLeaves
        ? employees.find(e => e.id === data.employeeId)
        : { name: user?.email || 'You', id: user?.uid };

      if (!selectedEmployee) {
        toast({ title: "Error", description: "Employee not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        employeeId: resolvedEmployeeId,
        leaveType: data.leaveType,
        durationType: data.duration,
        reason: data.reason,
        status: 'Pending',
      };

      if (data.duration === 'single') payload.leaveDate = format(data.date!, 'yyyy-MM-dd');
      else if (data.duration === 'half') { payload.leaveDate = format(data.date!, 'yyyy-MM-dd'); payload.halfDayType = data.halfDayType; }
      else if (data.duration === 'multiple') { payload.startDate = format(data.dateRange!.from!, 'yyyy-MM-dd'); payload.endDate = format(data.dateRange!.to!, 'yyyy-MM-dd'); }

      if (editingLeave) {
        const res = await fetch(`/api/attendance/leaves/${editingLeave.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update leave'); }
        toast({ title: "Leave Updated" });
      } else {
        const res = await fetch(`/api/attendance/leaves`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to submit leave'); }
        toast({ title: "Leave Request Submitted" });
      }

      setIsFormDialogOpen(false);
      setEditingLeave(null);
      form.reset();
      await fetchLeaveRequests();
    } catch (err) {
      console.error("Error saving leave request:", err);
      toast({ title: "Save Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (leave: LeaveRequest) => {
    setEditingLeave(leave);
    let formDate: Date | undefined;
    let formDateRange: { from?: Date; to?: Date } | undefined;

    if (leave.duration === 'single' || leave.duration === 'half') {
      formDate = leave.leaveDate ? parse(leave.leaveDate, 'yyyy-MM-dd', new Date()) : undefined;
    } else if (leave.duration === 'multiple') {
      formDateRange = {
        from: leave.startDate ? parse(leave.startDate, 'yyyy-MM-dd', new Date()) : undefined,
        to: leave.endDate ? parse(leave.endDate, 'yyyy-MM-dd', new Date()) : undefined,
      };
    }

    form.reset({ ...leave, date: formDate, dateRange: formDateRange });
    setIsFormDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingLeave(null);
    const myEmployeeRecord = employees.find(e => e.employeeId === user?.uid || e.id === user?.uid);
    const defaultEmployeeId = canManageLeaves ? '' : (myEmployeeRecord?.id || user?.uid || '');

    form.reset({
      employeeId: defaultEmployeeId,
      leaveType: '',
      duration: 'single',
      halfDayType: 'first-half',
      reason: '',
      status: 'Pending',
    });
    setIsFormDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => { setLeaveToDeleteId(id); setShowDeleteConfirm(true); };

  const executeDelete = async () => {
    if (!leaveToDeleteId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/attendance/leaves/${leaveToDeleteId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete leave'); }
      toast({ title: "Leave Request Deleted" });
      setShowDeleteConfirm(false);
      setLeaveToDeleteId(null);
      await fetchLeaveRequests();
    } catch (err) {
      console.error("Error deleting leave request:", err);
      toast({ title: "Delete Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (leaveId: string, newStatus: 'Approved' | 'Rejected') => {
    setIsUpdatingStatus(leaveId);
    try {
      const res = await fetch(`/api/attendance/leaves/${leaveId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update status'); }
      await fetchLeaveRequests();
      toast({ title: "Status Updated", description: `Leave request has been ${newStatus.toLowerCase()}.` });
    } catch (err) {
      console.error("Error updating leave status:", err);
      toast({ title: "Update Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // ── Admin stats ───────────────────────────
  const stats = React.useMemo(() => {
    const total = leaveRequests.length;
    const pending = leaveRequests.filter(r => r.status === 'Pending').length;
    const approved = leaveRequests.filter(r => r.status === 'Approved').length;
    const rejected = leaveRequests.filter(r => r.status === 'Rejected').length;
    return { total, pending, approved, rejected, processed: approved + rejected };
  }, [leaveRequests]);

  const filteredLeaves = React.useMemo(() => {
    if (activeTab === 'pending') return leaveRequests.filter(r => r.status === 'Pending');
    return leaveRequests.filter(r => r.status === 'Approved' || r.status === 'Rejected');
  }, [leaveRequests, activeTab]);

  // ── Loading state ─────────────────────────
  if ((isLoading && !error) || permissionsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 animate-pulse" />
          <Loader2 className="h-16 w-16 animate-spin text-primary absolute inset-0" />
        </div>
        <p className="text-muted-foreground font-medium animate-pulse">Loading...</p>
      </div>
    );
  }

  // ── Route to view based on role ───────────
  if (canManageLeaves) {
    return (
      <AdminLeaveView
        leaveRequests={leaveRequests}
        employees={employees}
        isLoading={isLoading}
        error={error}
        isUpdatingStatus={isUpdatingStatus}
        isSubmitting={isSubmitting}
        showDeleteConfirm={showDeleteConfirm}
        isFormDialogOpen={isFormDialogOpen}
        editingLeave={editingLeave}
        form={form}
        selectedEmployeeFilter={selectedEmployeeFilter}
        activeTab={activeTab}
        stats={stats}
        filteredLeaves={filteredLeaves}
        onAddRequest={openAddDialog}
        onReload={fetchLeaveRequests}
        onEmployeeFilterChange={setSelectedEmployeeFilter}
        onTabChange={setActiveTab}
        onApprove={(id) => handleUpdateStatus(id, 'Approved')}
        onReject={(id) => handleUpdateStatus(id, 'Rejected')}
        onEdit={openEditDialog}
        onDelete={handleDeleteClick}
        onDeleteConfirm={executeDelete}
        onDeleteCancel={() => { setShowDeleteConfirm(false); setLeaveToDeleteId(null); }}
        onFormSubmit={handleFormSubmit}
        setIsFormDialogOpen={setIsFormDialogOpen}
        setEditingLeave={setEditingLeave}
      />
    );
  }

  return (
    <EmployeeLeaveView
      leaveRequests={leaveRequests}
      employees={employees}
      isLoading={isLoading}
      error={error}
      isUpdatingStatus={isUpdatingStatus}
      isSubmitting={isSubmitting}
      showDeleteConfirm={showDeleteConfirm}
      isFormDialogOpen={isFormDialogOpen}
      editingLeave={editingLeave}
      form={form}
      leaveToDeleteId={leaveToDeleteId}
      onApplyLeave={openAddDialog}
      onEdit={openEditDialog}
      onDelete={handleDeleteClick}
      onDeleteConfirm={executeDelete}
      onDeleteCancel={() => { setShowDeleteConfirm(false); setLeaveToDeleteId(null); }}
      onFormSubmit={handleFormSubmit}
      setIsFormDialogOpen={setIsFormDialogOpen}
      setEditingLeave={setEditingLeave}
    />
  );
}

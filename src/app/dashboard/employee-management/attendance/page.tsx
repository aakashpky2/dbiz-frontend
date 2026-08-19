'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel as RHFFormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar as CalendarIcon, MoreHorizontal, Plus, Download, Search, Users, Clock, UserCheck, UserX, Timer, Settings, XCircle, ChevronLeft, ChevronRight, ArrowLeft, LogIn, LogOut, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { setHours } from 'date-fns';
import { setMinutes } from 'date-fns';
import { setSeconds } from 'date-fns';
import { startOfDay } from 'date-fns';
import { endOfDay } from 'date-fns';
import { startOfMonth } from 'date-fns';
import { endOfMonth } from 'date-fns';
import { isSameDay } from 'date-fns';
import { isSameMonth } from 'date-fns';
import { isToday } from 'date-fns';
import { isSunday } from 'date-fns';
import { addMonths } from 'date-fns';
import { subMonths } from 'date-fns';
import { getDay } from 'date-fns';
import { getDaysInMonth } from 'date-fns';
import { startOfWeek } from 'date-fns';
import { addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHero } from '@/components/dashboard/page-hero';
import { fetchWithCache, clearCache } from '@/lib/fetcher';
import { normalizeAttendanceSessions, ActivityLog } from '@/lib/attendance-utils';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';

import { INDIAN_TIME_ZONE, Employee, AttendanceRecord, HolidayRecord, AttendanceConfig, DEFAULT_CONFIG, EmployeeDaySummary, attendanceFormSchema, AttendanceFormValues } from './constants';

export default function AttendanceManagementPage() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [monthActivityLogs, setMonthActivityLogs] = useState<ActivityLog[]>([]);
  const [monthHolidays, setMonthHolidays] = useState<HolidayRecord[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<AttendanceConfig>(DEFAULT_CONFIG);
  const [tempConfig, setTempConfig] = useState<AttendanceConfig>(DEFAULT_CONFIG);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Dialog States
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState<string | null>(null);

  // Table expansion state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRowExpansion = (employeeId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) newSet.delete(employeeId);
      else newSet.add(employeeId);
      return newSet;
    });
  };

  const { toast } = useToast();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canViewAttendance = hasPermission('VIEW_ALL_ATTENDANCE') || hasPermission('MANAGE_EMPLOYEES');

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
  });

  // Fetch Settings from business_details
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('business_details').select('details').eq('id', 'attendance_settings').maybeSingle();
        if (data && data.details) {
          const settings = data.details as AttendanceConfig;
          setConfig({
            shift: { ...DEFAULT_CONFIG.shift, ...settings.shift },
            rules: { ...DEFAULT_CONFIG.rules, ...settings.rules },
            credits: { ...DEFAULT_CONFIG.credits, ...settings.credits }
          });
          setTempConfig({
            shift: { ...DEFAULT_CONFIG.shift, ...settings.shift },
            rules: { ...DEFAULT_CONFIG.rules, ...settings.rules },
            credits: { ...DEFAULT_CONFIG.credits, ...settings.credits }
          });
        }
      } catch {
        // Table may not exist yet, use defaults silently
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const { error } = await supabase.from('business_details').upsert({ id: 'attendance_settings', details: tempConfig });
      if (error) throw error;
      setConfig(tempConfig);
      toast({ title: "Configuration Saved", description: "Attendance rules updated successfully." });
      setIsSettingsOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save settings.", variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Fetch Employees (Cached)
  const fetchEmployees = useCallback(async () => {
    try {
      const responseData = await fetchWithCache('/api/employees?limit=1000');
      const employeesList = Array.isArray(responseData) ? responseData : (responseData?.data || []);
      const loadedEmployees: Employee[] = employeesList.map((emp: any) => ({
        id: emp.id,
        userId: emp.employee_id_hash || emp.id,
        fullName: emp.personalDetails?.fullName || emp.full_name,
        department: emp.employmentDetails?.employeeRole || emp.employee_role,
        email: emp.personalDetails?.email || emp.email
      }));
      setEmployees(loadedEmployees);
    } catch (err) {
            console.error("Error fetching employees:", err);
      setError("Failed to load employee list.");
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
  }, []);

  // Fetch Attendance for full month
  const fetchMonthRecords = useCallback(async (month: Date) => {
    if (employees.length === 0) return;
    setIsLoadingMonth(true);
    try {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const startStr = startOfDay(monthStart).toISOString();
      const endStr = endOfDay(monthEnd).toISOString();

      const [attendanceRes, holidaysRes, logsRes] = await Promise.all([
        fetch(`/api/attendance/month?startDate=${startStr}&endDate=${endStr}&employeeId=all`, { credentials: 'include' }),
        fetch(`/api/attendance/holidays/month?startDate=${startStr}&endDate=${endStr}`, { credentials: 'include' }),
        fetch(`/api/attendance/activity-logs?startDate=${startStr}&endDate=${endStr}&employeeId=all`, { credentials: 'include' })
      ]);

      if (!attendanceRes.ok) throw new Error("Failed to fetch attendance");
      if (!holidaysRes.ok) throw new Error("Failed to fetch holidays");

      const attendanceData = await attendanceRes.json();
      const holidaysData = await holidaysRes.json();
      const logsData = logsRes.ok ? await logsRes.json() : [];

      const recordsData: AttendanceRecord[] = (attendanceData || []).map((record: any) => {
        const employeeIdToMatch = record.employee_id || record.user_id;
        const emailToMatch = record.user_email;
        const employee = employees.find(emp => 
           emp.id === employeeIdToMatch || 
           emp.userId === employeeIdToMatch ||
           (emailToMatch && emp.email && emp.email === emailToMatch)
        );
        return {
          id: record.id,
          userId: employee?.id || record.user_id, // We standardize on Employee UUID for grouping
          type: record.type,
          timestamp: new Date(record.timestamp || record.created_at).getTime(),
          date: record.date || format(new Date(record.timestamp || record.created_at), 'yyyy-MM-dd'),
          employeeName: employee?.fullName || "Unknown",
          employeeDepartment: employee?.department || "N/A",
        };
      });

      const holidayRecords: HolidayRecord[] = (holidaysData || []).map((h: any) => ({
        id: h.id,
        name: h.name,
        type: h.type,
        date: format(new Date(h.date), 'yyyy-MM-dd'),
      }));

      setMonthRecords(recordsData);
      setMonthHolidays(holidayRecords);
      setMonthActivityLogs(logsData);
    } catch (err) {
      console.error("Error fetching month records:", err);
      toast({ title: "Error", description: "Failed to fetch attendance data.", variant: "destructive" });
    } finally {
      setIsLoadingMonth(false);
      setIsLoading(false);
    }
  }, [employees, toast]);

  useEffect(() => {
    if (!permLoading && !canViewAttendance) {
      toast({ title: "Access Denied", description: "You do not have permission to view attendance records.", variant: "destructive" });
      router.push('/dashboard');
      return;
    }
    if (canViewAttendance) {
      fetchEmployees();
    }
  }, [permLoading, canViewAttendance, fetchEmployees, router, toast]);

  const [hasInitialMounted, setHasInitialMounted] = useState(false);

  useEffect(() => {
    if (employees.length > 0) {
      if (!hasInitialMounted) {
        const timer = setTimeout(() => {
          fetchMonthRecords(currentMonth);
          setHasInitialMounted(true);
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        fetchMonthRecords(currentMonth);
      }
    }
  }, [fetchMonthRecords, currentMonth, employees, hasInitialMounted]);

  // Get daily attendance count per date (for calendar dots)
  const dailyAttendanceSummary = useMemo(() => {
    const summary: Record<string, { present: number; total: number }> = {};
    const dateMap = new Map<string, Set<string>>();

    monthRecords.forEach(record => {
      const dateKey = format(toZonedTime(new Date(record.timestamp), INDIAN_TIME_ZONE), 'yyyy-MM-dd');
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Set());
      dateMap.get(dateKey)!.add(record.userId);
    });

    dateMap.forEach((userIds, dateKey) => {
      summary[dateKey] = { present: userIds.size, total: employees.length };
    });

    return summary;
  }, [monthRecords, employees.length]);

  // Build employee day summaries for selected date
  const selectedDateSummaries: EmployeeDaySummary[] = useMemo(() => {
    if (!selectedDate) return [];

    const dateKey = format(toZonedTime(selectedDate, INDIAN_TIME_ZONE), 'yyyy-MM-dd');
    const dayRecords = monthRecords.filter(record => {
      const recordDate = format(toZonedTime(new Date(record.timestamp), INDIAN_TIME_ZONE), 'yyyy-MM-dd');
      return recordDate === dateKey;
    });

    const dayLogs = monthActivityLogs.filter(log => log.attendance_date === dateKey);

    // Group records by employee
    const employeeRecordsMap = new Map<string, AttendanceRecord[]>();
    dayRecords.forEach(record => {
      if (!employeeRecordsMap.has(record.userId)) {
        employeeRecordsMap.set(record.userId, []);
      }
      employeeRecordsMap.get(record.userId)!.push(record);
    });

    // Group logs by employee
    const employeeLogsMap = new Map<string, ActivityLog[]>();
    dayLogs.forEach(log => {
      const empId = log.employee_id;
      const emp = employees.find(e => e.id === empId || e.userId === empId);
      if (emp) {
         if (!employeeLogsMap.has(emp.id)) employeeLogsMap.set(emp.id, []);
         employeeLogsMap.get(emp.id)!.push(log as ActivityLog);
      }
    });

    return employees.map(emp => {
      const empRecords = (employeeRecordsMap.get(emp.id) || []).sort((a, b) => a.timestamp - b.timestamp);
      const empLogs = employeeLogsMap.get(emp.id) || [];
      
      const normalized = normalizeAttendanceSessions(empRecords as any, empLogs, selectedDate, new Date());
      
      let totalDuration = '--:--';
      let status: EmployeeDaySummary['status'] = 'Absent';

      if (normalized.sessions.length > 0) {
        if (normalized.status === 'In Progress') {
          status = 'Incomplete';
          totalDuration = 'In Progress';
        } else {
          const hours = Math.floor(normalized.netActiveMinutes / 60);
          const mins = normalized.netActiveMinutes % 60;
          totalDuration = `${hours}h ${mins}m`;
          
          const totalHours = normalized.grossTotalMinutes / 60;
          if (totalHours >= config.shift.minFullDayHours) {
            status = 'Present';
          } else if (totalHours >= config.shift.minHalfDayHours) {
            status = 'Half Day';
          } else {
            status = 'Present';
          }
        }
      } else {
        const holiday = monthHolidays.find(h => h.date === dateKey);
        if (holiday) status = 'Holiday';
      }

      return {
        employeeId: emp.userId,
        employeeName: emp.fullName,
        department: emp.department || 'N/A',
        punchIn: normalized.firstPunchIn,
        punchOut: normalized.lastPunchOut,
        totalDuration,
        totalMinutes: normalized.grossTotalMinutes,
        status,
        records: empRecords,
        sessions: normalized.sessions,
        totalBreakMinutes: normalized.totalBreakMinutes,
        netActiveMinutes: normalized.netActiveMinutes,
        idleMinutes: normalized.idleOfflineMinutes,
      };
    }).sort((a, b) => {
      const order = { 'Present': 0, 'Half Day': 1, 'Incomplete': 2, 'Holiday': 3, 'Absent': 4 };
      return order[a.status] - order[b.status];
    });
  }, [selectedDate, monthRecords, monthHolidays, monthActivityLogs, employees, config.shift.minFullDayHours, config.shift.minHalfDayHours]);

  // Stats for selected date
  const selectedDateStats = useMemo(() => {
    if (!selectedDate) return { present: 0, absent: 0, halfDay: 0, incomplete: 0, holiday: 0 };
    return {
      present: selectedDateSummaries.filter(s => s.status === 'Present').length,
      halfDay: selectedDateSummaries.filter(s => s.status === 'Half Day').length,
      incomplete: selectedDateSummaries.filter(s => s.status === 'Incomplete').length,
      holiday: selectedDateSummaries.filter(s => s.status === 'Holiday').length,
      absent: selectedDateSummaries.filter(s => s.status === 'Absent').length,
    };
  }, [selectedDate, selectedDateSummaries]);

  // Handle Form Submit
  const handleFormSubmit: SubmitHandler<AttendanceFormValues> = async (data) => {
    setIsSubmitting(true);

    const [hours, minutes] = data.eventTime.split(':').map(Number);
    let combinedDateTime = setHours(data.eventDate, hours);
    combinedDateTime = setMinutes(combinedDateTime, minutes);
    combinedDateTime = setSeconds(combinedDateTime, 0);

    const zonedEventDateForStorage = fromZonedTime(combinedDateTime, INDIAN_TIME_ZONE);

    try {
      const recordData = {
        user_id: data.userId,
        type: data.type,
        timestamp: zonedEventDateForStorage.toISOString(),
      };

      if (editingRecord) {
        const res = await fetch(`/api/attendance/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(recordData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to update record");
        }
        toast({ title: "Success", description: "Record updated successfully." });
      } else {
        const res = await fetch(`/api/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(recordData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to add record");
        }
        toast({ title: "Success", description: "Record added successfully." });
      }
      setIsFormDialogOpen(false);
      setEditingRecord(null);
      form.reset();
      await fetchMonthRecords(currentMonth);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddDialog = () => {
    setEditingRecord(null);
    form.reset({
      userId: '',
      eventDate: selectedDate || new Date(),
      eventTime: format(new Date(), 'HH:mm'),
      type: 'punchIn'
    });
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (record: AttendanceRecord) => {
    setEditingRecord(record);
    const localTime = toZonedTime(new Date(record.timestamp), INDIAN_TIME_ZONE);
    form.reset({
      userId: record.userId,
      eventDate: localTime,
      eventTime: format(localTime, 'HH:mm'),
      type: record.type,
    });
    setIsFormDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!recordToDeleteId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/attendance/${recordToDeleteId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete record");
      }
      toast({ title: "Deleted", description: "Record deleted successfully." });
      setRecordToDeleteId(null);
      await fetchMonthRecords(currentMonth);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'NA';
  };

  const getStatusBadge = (status: EmployeeDaySummary['status']) => {
    switch (status) {
      case 'Present':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Present</Badge>;
      case 'Half Day':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0">Half Day</Badge>;
      case 'Incomplete':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Incomplete</Badge>;
      case 'Holiday':
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0">Holiday</Badge>;
      case 'Absent':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Absent</Badge>;
    }
  };

  // Calendar rendering
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const days: Date[] = [];
    let day = startDate;
    // Always render 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  if (permLoading || (isLoading && employees.length === 0)) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 animate-pulse font-medium">Loading attendance records...</p>
      </div>
    );
  }

  if (!canViewAttendance) return null;

  return (
    <div className="space-y-6">
      <PageHero
                pattern="pattern-5"
        icon={UserCheck}
        badge="EMPLOYEE MANAGEMENT"
        title="Attendance Records"
        description="Click on a date to view employee attendance details"
      >
        <Button variant="outline" size="sm" onClick={async () => { clearCache(); await fetchEmployees(); await fetchMonthRecords(currentMonth); }} className="h-9 px-3 font-bold border-muted-foreground/20">
          <RefreshCw className="h-4 w-4 mr-2" /> Reload
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)} title="Attendance Settings" className="h-9 w-9">
          <Settings className="h-4 w-4" />
        </Button>
        <Button onClick={openAddDialog} className="font-bold">
          <Plus className="mr-2 h-4 w-4" /> Add Record
        </Button>
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Side: Calendar + Date Detail */}
        <div className="space-y-6">
          {/* Calendar Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-xl font-semibold min-w-[200px] text-center">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleNextMonth}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <Button variant="ghost" className="text-white hover:bg-white/20 text-sm" onClick={handleToday}>
                Today
              </Button>
            </div>

            <CardContent className="p-0">
              {isLoadingMonth ? (
                <div className="flex justify-center items-center py-32">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, idx) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const daySummary = dailyAttendanceSummary[dateKey];
                      const holiday = monthHolidays.find(h => h.date === dateKey);
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                      const isTodayDate = isToday(day);
                      const isSundayDay = isSunday(day);
                      const presentCount = daySummary?.present || 0;

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "relative flex flex-col items-center justify-start p-2 min-h-[80px] border-b border-r border-slate-100 dark:border-slate-800 transition-all duration-150 hover:bg-blue-50 dark:hover:bg-blue-950/20",
                            !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/30",
                            isSelected && "bg-blue-50 dark:bg-blue-950/30 ring-2 ring-inset ring-blue-500",
                            isTodayDate && !isSelected && "bg-blue-50/60 dark:bg-blue-950/10",
                            holiday && isCurrentMonth && "bg-purple-50/50 dark:bg-purple-950/20"
                          )}
                        >
                          <span
                            className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors z-10",
                              !isCurrentMonth && "text-slate-300 dark:text-slate-600",
                              isCurrentMonth && "text-slate-700 dark:text-slate-200",
                              isSundayDay && isCurrentMonth && !holiday && "text-red-500",
                              holiday && isCurrentMonth && "text-purple-700 dark:text-purple-400 font-bold",
                              isTodayDate && "bg-blue-600 text-white font-bold",
                              isSelected && !isTodayDate && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                            )}
                          >
                            {format(day, 'd')}
                          </span>

                          {/* Holiday indicator */}
                          {holiday && isCurrentMonth && (
                            <div className="mt-1 w-full px-1">
                              <div className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded px-1 py-0.5 truncate text-center" title={holiday.name}>
                                {holiday.name}
                              </div>
                            </div>
                          )}

                          {/* Attendance indicator */}
                          {isCurrentMonth && presentCount > 0 && !holiday && (
                            <div className="mt-1 flex items-center gap-1">
                              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                <Users className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">{presentCount}</span>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Date Detail */}
          {selectedDate && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <CalendarIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</CardTitle>
                      <CardDescription>
                        {selectedDateSummaries.filter(s => s.status !== 'Absent').length} of {employees.length} employees recorded
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDate(null)}>
                    <XCircle className="h-5 w-5 text-slate-400" />
                  </Button>
                </div>

                {/* Quick Stats for this date */}
                <div className="grid grid-cols-5 gap-3 mt-4">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{selectedDateStats.present}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase font-medium">Present</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                    <Timer className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-lg font-bold text-orange-700 dark:text-orange-400">{selectedDateStats.halfDay}</p>
                      <p className="text-[10px] text-orange-600 dark:text-orange-500 uppercase font-medium">Half Day</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{selectedDateStats.incomplete}</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase font-medium">Active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                    <CalendarIcon className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{selectedDateStats.holiday}</p>
                      <p className="text-[10px] text-purple-600 dark:text-purple-500 uppercase font-medium">Holiday</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <UserX className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-lg font-bold text-red-700 dark:text-red-400">{selectedDateStats.absent}</p>
                      <p className="text-[10px] text-red-600 dark:text-red-500 uppercase font-medium">Absent</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50">
                      <TableHead className="font-semibold">Employee</TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1"><LogIn className="h-3.5 w-3.5 text-emerald-500" /> Punch In</div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1"><LogOut className="h-3.5 w-3.5 text-red-500" /> Punch Out</div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-blue-500" /> Gross</div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 text-orange-500" /> Idle</div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1"><Timer className="h-3.5 w-3.5 text-indigo-500" /> Net Active</div>
                      </TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDateSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No employees found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedDateSummaries.map((summary) => (
                        <React.Fragment key={summary.employeeId}>
                          <TableRow className="group hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border-2 border-slate-200 dark:border-slate-700">
                                  <AvatarFallback className={cn(
                                    "text-xs font-semibold",
                                    summary.status === 'Absent' ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-700"
                                  )}>
                                    {getInitials(summary.employeeName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{summary.employeeName}</p>
                                  <p className="text-xs text-slate-500">{summary.department}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {summary.punchIn ? (
                                <span className="text-sm font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded">
                                  {format(summary.punchIn, 'hh:mm a')}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">--:--</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {summary.punchOut ? (
                                <span className="text-sm font-mono text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded">
                                  {format(summary.punchOut, 'hh:mm a')}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">{summary.status === 'Incomplete' ? 'In Progress' : '--:--'}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {summary.totalMinutes > 0 ? (
                                <span className="text-sm font-semibold text-slate-600">
                                  {Math.floor(summary.totalMinutes/60)}h {summary.totalMinutes%60}m
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">--:--</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {summary.idleMinutes > 0 ? (
                                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                                  {Math.floor(summary.idleMinutes/60)}h {summary.idleMinutes%60}m
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">0h 0m</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {summary.netActiveMinutes > 0 ? (
                                <span className={cn(
                                  "text-sm font-bold",
                                  summary.netActiveMinutes >= config.shift.minFullDayHours * 60 ? "text-emerald-600" :
                                    summary.netActiveMinutes >= config.shift.minHalfDayHours * 60 ? "text-indigo-600" : "text-slate-600"
                                )}>
                                  {Math.floor(summary.netActiveMinutes/60)}h {summary.netActiveMinutes%60}m
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">--:--</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(summary.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {summary.records.length > 0 && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {summary.records.map((record, idx) => (
                                        <React.Fragment key={record.id}>
                                          <DropdownMenuItem onClick={() => openEditDialog(record)}>
                                            Edit {record.type === 'punchIn' ? 'Punch In' : 'Punch Out'} ({format(toZonedTime(new Date(record.timestamp), INDIAN_TIME_ZONE), 'hh:mm a')})
                                          </DropdownMenuItem>
                                        </React.Fragment>
                                      ))}
                                      <DropdownMenuSeparator />
                                      {summary.records.map(record => (
                                        <DropdownMenuItem key={`del-${record.id}`} className="text-red-600" onClick={() => { setRecordToDeleteId(record.id); setShowDeleteConfirm(true); }}>
                                          Delete {record.type === 'punchIn' ? 'Punch In' : 'Punch Out'}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                                {summary.sessions && summary.sessions.length > 0 && (
                                  <Button variant="ghost" size="icon" onClick={() => toggleRowExpansion(summary.employeeId)}>
                                    {expandedRows.has(summary.employeeId) ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {expandedRows.has(summary.employeeId) && summary.sessions && summary.sessions.length > 0 && (
                            <TableRow className="bg-slate-50/50 dark:bg-slate-800/10">
                              <TableCell colSpan={6} className="p-0 border-b-0">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 shadow-inner">
                                  <div className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Session Details</div>
                                  <div className="space-y-3">
                                    {summary.sessions.map((session, idx) => (
                                      <React.Fragment key={session.id}>
                                        <div className="flex items-center gap-4 text-sm">
                                          <div className="w-20 text-slate-500 font-medium">Session {idx + 1}</div>
                                          <div className="flex-1 flex items-center gap-3">
                                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-mono">
                                              {format(session.punchIn, 'hh:mm a')}
                                            </Badge>
                                            <span className="text-slate-400">-</span>
                                            {session.punchOut ? (
                                              <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-mono">
                                                {format(session.punchOut, 'hh:mm a')}
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                                In Progress
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="w-24 text-right font-medium text-slate-700 dark:text-slate-300">
                                            {session.durationMinutes > 0 ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m` : '--'}
                                          </div>
                                        </div>
                                        
                                        {idx < summary.sessions.length - 1 && summary.sessions[idx].punchOut && summary.sessions[idx + 1].punchIn && (
                                          <div className="flex items-center gap-4 text-sm my-1 relative">
                                            <div className="w-20 text-orange-600 dark:text-orange-500 font-medium text-xs uppercase tracking-wide">Break</div>
                                            <div className="flex-1 flex items-center gap-3 pl-2 border-l border-dashed border-orange-300 dark:border-orange-800 ml-[-5px]">
                                              <span className="text-slate-500 text-xs">{format(summary.sessions[idx].punchOut!, 'hh:mm a')} - {format(summary.sessions[idx + 1].punchIn, 'hh:mm a')}</span>
                                            </div>
                                            <div className="w-24 text-right font-medium text-orange-600 dark:text-orange-500 text-xs">
                                              {(() => {
                                                const breakMins = Math.round((summary.sessions[idx + 1].punchIn.getTime() - summary.sessions[idx].punchOut!.getTime()) / 60000);
                                                return `${Math.floor(breakMins / 60)}h ${breakMins % 60}m`;
                                              })()}
                                            </div>
                                          </div>
                                        )}
                                      </React.Fragment>
                                    ))}
                                    
                                    {summary.totalBreakMinutes > 0 && (
                                      <div className="flex items-center gap-4 text-sm pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                        <div className="w-20"></div>
                                        <div className="flex-1 text-right text-slate-500">Total Break Time</div>
                                        <div className="w-24 text-right font-bold text-orange-600 dark:text-orange-500">
                                          {Math.floor(summary.totalBreakMinutes / 60)}h {summary.totalBreakMinutes % 60}m
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar: Monthly Stats */}
        <div className="space-y-4">
          {/* Monthly Overview Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Monthly Overview
              </CardTitle>
              <CardDescription>{format(currentMonth, 'MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Total Employees</span>
                </div>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{employees.length}</span>
              </div>

              {/* Legend */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Legend</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Present / Full Day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Half Day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Incomplete / Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Absent</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Actions</p>
                <Button variant="outline" className="w-full justify-start text-sm" onClick={() => { setSelectedDate(new Date()); setCurrentMonth(new Date()); }}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                  View Today
                </Button>
                <Button variant="outline" className="w-full justify-start text-sm" onClick={openAddDialog}>
                  <Plus className="mr-2 h-4 w-4 text-emerald-500" />
                  Add Punch Record
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tip Card */}
          {!selectedDate && (
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <CalendarIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Select a Date</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Click on any date in the calendar to view detailed attendance records with punch-in/out times and work duration for all employees.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Editing "Attendance Record"' : 'Adding New Attendance Record'}</DialogTitle>
            <DialogDescription>{editingRecord ? 'Update the details of this item.' : 'Enter the details for Attendance Record.'}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <Label>Employee</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem><Label>Date</Label>
                      <Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(new Date(e.target.value))} /></FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eventTime"
                  render={({ field }) => (
                    <FormItem><Label>Time</Label><Input type="time" {...field} /></FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem><Label>Type</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="punchIn">Punch In</SelectItem><SelectItem value="punchOut">Punch Out</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle><AlertDialogDescription>Delete this record permanently?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Configure attendance shift timings, rules, and credits.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="shift">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="shift">Shift</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
            </TabsList>
            <TabsContent value="shift" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Start</Label><Input type="time" value={tempConfig.shift.startTime} onChange={e => setTempConfig({ ...tempConfig, shift: { ...tempConfig.shift, startTime: e.target.value } })} /></div>
                <div className="space-y-1"><Label>End</Label><Input type="time" value={tempConfig.shift.endTime} onChange={e => setTempConfig({ ...tempConfig, shift: { ...tempConfig.shift, endTime: e.target.value } })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="rules" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Late Grace (Mins)</Label>
                <Input type="number" value={tempConfig.rules.lateEntryGraceMinutes} onChange={e => setTempConfig({ ...tempConfig, rules: { ...tempConfig.rules, lateEntryGraceMinutes: Number(e.target.value) } })} />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

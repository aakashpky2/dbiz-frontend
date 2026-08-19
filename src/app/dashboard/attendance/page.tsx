'use client';
import { apiFetch } from '@/lib/apiFetch';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAttendance } from '@/contexts/AttendanceContext';
import { normalizeAttendanceSessions, ActivityLog, AttendanceRecord } from '@/lib/attendance-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { z } from 'zod';
import { INDIAN_TIME_ZONE, leaveTypes, leaveRequestSchema, LeaveRequestFormValues } from './constants';
import { format, startOfDay, addDays, subDays, isSameDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { CalendarCheck2, LogIn, LogOut, Loader2, Send, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Coffee, AlertCircle, Timer, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import dynamic from 'next/dynamic';
const LeaveDialog = dynamic(() => import('./_components/LeaveDialog').then(mod => mod.LeaveDialog), { ssr: false });
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { PageHero } from '@/components/dashboard/page-hero';
import { LiveClock } from '@/components/dashboard/attendance/live-clock';
import { Badge } from '@/components/ui/badge';



export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isPunchedIn, todaysEvents, punchIn, punchOut } = useAttendance();

  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0);
  const [isTimeSynced, setIsTimeSynced] = useState(false);
  
  // Date selection & fetching
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRecords, setSelectedRecords] = useState<AttendanceRecord[]>([]);
  const [selectedActivityLogs, setSelectedActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Sync server time
  useEffect(() => {
    const fetchTime = async () => {
      try {
        const response = await apiFetch('/api/time');
        const data = await response.json();
        if (data.serverTime) {
          const localNow = Date.now();
          const serverNow = new Date(data.serverTime).getTime();
          setTimeOffset(serverNow - localNow);
        }
      } catch (err) {
            console.error('Time sync error:', err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
        setIsTimeSynced(true);
      }
    };
    fetchTime();
    const syncInterval = setInterval(fetchTime, 5 * 60 * 1000);
    return () => clearInterval(syncInterval);
  }, []);

  // Fetch records for selected date
  const fetchRecordsForDate = useCallback(async (date: Date) => {
    if (!user) return;
    setIsLoadingRecords(true);
    
    // We use /api/attendance/month to fetch for a specific range securely
    // But wait, the manager endpoint requires manager privileges.
    // Wait, the month API in routes/attendance.js says:
    // "Apply RBAC: Normal users only see their own. Managers can filter by employeeId."
    // So it works perfectly for normal users too!
    const dateStr = format(toZonedTime(date, INDIAN_TIME_ZONE), 'yyyy-MM-dd');
    const start = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateStr}T23:59:59.999Z`).toISOString();
    
    try {
      const res = await apiFetch(`/api/attendance/month?startDate=${start}&endDate=${end}`);
      const logsRes = await apiFetch(`/api/attendance/activity-logs?date=${dateStr}`);

      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      const logsData = logsRes.ok ? await logsRes.json() : [];
      
      const parsedRecords = (data || []).map((r: any) => ({
        id: r.id,
        type: r.type,
        timestamp: new Date(r.timestamp).getTime()
      })).sort((a: any, b: any) => a.timestamp - b.timestamp);
      
      setSelectedRecords(parsedRecords);
      setSelectedActivityLogs(logsData);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load attendance records.', variant: 'destructive' });
    } finally {
      setIsLoadingRecords(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchRecordsForDate(selectedDate);
  }, [selectedDate, fetchRecordsForDate, todaysEvents]); // Re-fetch if todaysEvents change (i.e. user punched in/out)

  // Calculate session summary
  const summary = useMemo(() => {
    return normalizeAttendanceSessions(selectedRecords, selectedActivityLogs, selectedDate, new Date());
  }, [selectedRecords, selectedActivityLogs, selectedDate]);


  return (
    <div className="space-y-6">
      <PageHero
                pattern="pattern-6"
        icon={CalendarCheck2}
        badge="ATTENDANCE"
        title="My Attendance"
        description={`View and manage your attendance records`}
      >
        <Button variant="outline" onClick={() => setIsLeaveDialogOpen(true)} className="font-bold">
          <Send className="mr-2 h-4 w-4" /> Apply for Leave
        </Button>
      </PageHero>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        {/* Left Side: Clock & Date Picker */}
        <div className="space-y-6 flex flex-col h-full">
          {/* Live Clock Card */}
          <LiveClock timeOffset={timeOffset} isTimeSynced={isTimeSynced} className="w-full" />
          
          {/* Date Selector Card */}
          <Card className="shadow-sm border border-slate-200 dark:border-slate-800">
            <CardHeader className="py-4 border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CalendarIcon className="h-4 w-4 text-indigo-500" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 w-full justify-between">
                  <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-center text-center font-medium border-slate-200 dark:border-slate-800",
                          isSameDay(selectedDate, new Date()) && "border-indigo-200 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                        )}
                      >
                        {format(selectedDate, 'dd MMM yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={isSameDay(selectedDate, new Date())}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  variant="secondary" 
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold"
                  onClick={() => setSelectedDate(new Date())}
                  disabled={isSameDay(selectedDate, new Date())}
                >
                  Jump to Today
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Records & Summary */}
        <div className="space-y-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><LogIn className="h-3 w-3 text-emerald-500"/> First In</p>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{summary.firstPunchIn ? format(summary.firstPunchIn, 'hh:mm a') : 'Not punched in'}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><LogOut className="h-3 w-3 text-red-500"/> Last Out</p>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{summary.status === 'In Progress' ? 'In Progress' : summary.lastPunchOut ? format(summary.lastPunchOut, 'hh:mm a') : '--'}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-500"/> Gross</p>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{summary.grossTotalMinutes > 0 ? `${Math.floor(summary.grossTotalMinutes/60)}h ${summary.grossTotalMinutes%60}m` : '0h 0m'}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><AlertCircle className="h-3 w-3 text-orange-500"/> Idle</p>
                <p className="text-xl font-bold font-mono text-orange-600 dark:text-orange-400">{summary.idleOfflineMinutes > 0 ? `${Math.floor(summary.idleOfflineMinutes/60)}h ${summary.idleOfflineMinutes%60}m` : '0h 0m'}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center relative overflow-hidden bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900">
                <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none transform translate-x-2 translate-y-2">
                  <Clock className="h-16 w-16 text-indigo-500" />
                </div>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="h-3 w-3"/> Net Active</p>
                <p className="text-xl font-bold font-mono text-indigo-700 dark:text-indigo-300">{summary.netActiveMinutes > 0 ? `${Math.floor(summary.netActiveMinutes/60)}h ${summary.netActiveMinutes%60}m` : '0h 0m'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline Card */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="py-4 border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                Punch Sessions Timeline
              </CardTitle>
              {summary.status !== 'Absent' && (
                <Badge variant="outline" className={cn(
                  "font-semibold px-2 py-0.5",
                  summary.status === 'Present' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" :
                  summary.status === 'In Progress' ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" :
                  "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800"
                )}>
                  {summary.status}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingRecords ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
              ) : summary.sessions.length > 0 ? (
                <div className="p-4 sm:p-6 space-y-4">

                  {summary.sessions.map((session, idx) => {
                    const sessionIdleBlocks = summary.idleBlocks.filter(block => {
                      const blockStart = new Date(block.started_at).getTime();
                      const sessionStart = session.punchIn.getTime();
                      const sessionEnd = session.punchOut ? session.punchOut.getTime() : new Date().getTime();
                      return blockStart >= sessionStart && blockStart <= sessionEnd;
                    }).sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

                    return (
                      <React.Fragment key={idx}>
                        <div className="relative pl-4 sm:pl-8">
                          <div className="absolute left-[1.5rem] sm:left-[2.5rem] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:bg-slate-700 p-3 sm:p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Session {idx + 1}</span>
                              <span className="text-xs font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                {session.durationMinutes > 0 ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m` : '--'}
                              </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                              <div className="flex items-center gap-2">
                                <LogIn className="h-4 w-4 text-emerald-500" />
                                <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{format(session.punchIn, 'hh:mm a')}</span>
                              </div>
                              <ArrowRight className="h-4 w-4 text-slate-300 hidden sm:block" />
                              <div className="flex items-center gap-2">
                                <LogOut className="h-4 w-4 text-red-500" />
                                {session.punchOut ? (
                                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{format(session.punchOut, 'hh:mm a')}</span>
                                ) : (
                                  <span className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded font-medium animate-pulse">In Progress</span>
                                )}
                              </div>
                            </div>

                            {sessionIdleBlocks.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Idle Activity</p>
                                {sessionIdleBlocks.map((block, bIdx) => (
                                  <div key={bIdx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs bg-orange-50 dark:bg-orange-900/10 p-2 sm:px-3 sm:py-2 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                                      <span className="font-mono text-orange-700 dark:text-orange-400">
                                        {format(new Date(block.started_at), 'hh:mm a')} - {format(new Date(block.ended_at), 'hh:mm a')}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-orange-600 dark:text-orange-500 sm:ml-auto">
                                      {Math.floor(block.duration_minutes / 60)}h {block.duration_minutes % 60}m
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {idx < summary.sessions.length - 1 && summary.sessions[idx].punchOut && summary.sessions[idx + 1].punchIn && (
                          <div className="flex items-center gap-4 text-sm my-2 relative px-4">
                            <div className="absolute left-[1.5rem] sm:left-[2.5rem] top-0 bottom-0 w-px bg-dashed border-l-2 border-dashed border-orange-200 dark:border-orange-900" />
                            <div className="w-16 sm:w-20 text-orange-600 dark:text-orange-500 font-bold text-xs uppercase tracking-wider">Break</div>
                            <div className="flex-1 flex items-center gap-3 pl-2 sm:pl-4">
                              <span className="text-slate-500 text-xs font-mono">{format(summary.sessions[idx].punchOut!, 'hh:mm a')} - {format(summary.sessions[idx + 1].punchIn, 'hh:mm a')}</span>
                            </div>
                            <div className="text-right font-bold text-orange-600 dark:text-orange-500 text-xs sm:text-sm font-mono">
                              {(() => {
                                const breakMins = Math.round((summary.sessions[idx + 1].punchIn.getTime() - summary.sessions[idx].punchOut!.getTime()) / 60000);
                                return `${Math.floor(breakMins / 60)}h ${breakMins % 60}m`;
                              })()}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-slate-50/50 dark:bg-slate-900/20 m-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <AlertCircle className="h-8 w-8 mb-3 opacity-20" />
                  <p className="font-medium text-slate-500">No punches recorded for {isSameDay(selectedDate, new Date()) ? 'today' : format(selectedDate, 'MMM dd, yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <LeaveDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen} />
    </div>
  );
}


'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiFetch';

interface AttendanceEvent {
  id: string;
  type: 'punchIn' | 'punchOut';
  timestamp: Date;
}

export interface EmployeeDetails {
  user: any;
  employee: any;
  department: any;
  profile: any;
  roles: string[];
  permissions: string[];
  userProfile: any;
}

interface AttendanceContextState {
  isPunchedIn: boolean;
  lastPunchInTime: Date | null;
  todaysEvents: AttendanceEvent[];
  isLoading: boolean;
  isSubmitting: boolean;
  employeeDetails: EmployeeDetails | null;
  punchIn: () => Promise<void>;
  punchOut: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextState | undefined>(undefined);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [lastPunchInTime, setLastPunchInTime] = useState<Date | null>(null);
  const [todaysEvents, setTodaysEvents] = useState<AttendanceEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null);

  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef<{ userId: string; time: number } | null>(null);

  const fetchAttendance = useCallback(async (force = false) => {
    if (!user?.uid) return;
    
    if (!force) {
        if (
            lastFetchRef.current?.userId === user.uid &&
            Date.now() - lastFetchRef.current.time < 30000
        ) {
            if (process.env.NODE_ENV === 'development') console.log('[Attendance] Skipped fetch due to cache');
            setIsLoading(false);
            return;
        }

        if (isFetchingRef.current) return;
    }
    
    isFetchingRef.current = true;
    if (process.env.NODE_ENV === 'development') console.log('[Attendance] Fetching from backend');

    try {
      const [attRes, empRes] = await Promise.all([
          apiFetch(`/api/attendance?userId=${user.uid}`),
          apiFetch(`/api/employee/me`, { authMode: 'bearer' })
      ]);
      
      const response = attRes;

      if (empRes.ok) {
          const empJson = await empRes.json();
          if (empJson.success) {
              setEmployeeDetails(empJson.data);
          }
      }
      if (response.status === 429) {
          if (process.env.NODE_ENV === 'development') console.warn(`[Attendance] 429 Too Many Requests`);
          // Stop here, keep existing state
          return;
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("[Attendance] Non-JSON response received:", response.status);
        setTodaysEvents([]);
        setIsPunchedIn(false);
        setLastPunchInTime(null);
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch attendance');
      }
      if (!Array.isArray(data)) {
        console.warn("Invalid attendance data format or error:", data);
        setTodaysEvents([]);
        setIsPunchedIn(false);
        setLastPunchInTime(null);
        return;
      }

      const events: AttendanceEvent[] = data.map((d: any) => ({
        id: d.id,
        type: d.type,
        timestamp: new Date(d.timestamp)
      }));

      setTodaysEvents(events);

      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        const isCurrentlyPunchedIn = lastEvent.type === 'punchIn';
        setIsPunchedIn(isCurrentlyPunchedIn);
        setLastPunchInTime(isCurrentlyPunchedIn ? lastEvent.timestamp : null);
      } else {
        setIsPunchedIn(false);
        setLastPunchInTime(null);
      }
      
      // Update cache timestamp on success
      lastFetchRef.current = { userId: user.uid, time: Date.now() };
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [user?.uid]);

  // Fetch attendance as soon as auth is ready — no time sync wait
  useEffect(() => {
    if (!authLoading && user?.uid) {
      fetchAttendance();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, user?.uid, authLoading, fetchAttendance]);

  const handlePunchAction = useCallback(async (type: 'punchIn' | 'punchOut') => {
    setIsSubmitting(true);
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiFetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) throw new Error('Failed to record attendance');

      toast({
        title: `Successfully Punched ${type === 'punchIn' ? 'In' : 'Out'}`,
        description: `Your action has been recorded.`,
      });
      await fetchAttendance();
    } catch (error) {
      console.error(`Error punching ${type}:`, error);
      toast({ title: 'Error', description: 'Failed to record your attendance.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, toast, fetchAttendance]);

  const punchIn = useCallback(() => handlePunchAction('punchIn'), [handlePunchAction]);
  const punchOut = useCallback(() => handlePunchAction('punchOut'), [handlePunchAction]);

  const value = React.useMemo(() => ({
    isPunchedIn,
    lastPunchInTime,
    todaysEvents,
    isLoading: authLoading || isLoading,
    isSubmitting,
    employeeDetails,
    punchIn,
    punchOut,
  }), [isPunchedIn, lastPunchInTime, todaysEvents, authLoading, isLoading, isSubmitting, employeeDetails, punchIn, punchOut]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}

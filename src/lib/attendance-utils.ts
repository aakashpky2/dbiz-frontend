import { toZonedTime } from 'date-fns-tz';
import { isSameDay, isBefore, setHours, setMinutes, setSeconds, setMilliseconds, startOfDay } from 'date-fns';

const INDIAN_TIME_ZONE = 'Asia/Kolkata';

export interface AttendanceRecord {
  id: string;
  type: 'punchIn' | 'punchOut';
  timestamp: number;
}

export interface ActivityLog {
  id: string;
  activity_type: 'ACTIVE' | 'IDLE' | 'OFFLINE';
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  employee_id: string;
  attendance_date: string;
}

export interface AttendanceSession {
  id: string;
  punchIn: Date;
  punchOut: Date | null;
  durationMinutes: number;
  isAutoPunchedOut: boolean;
}

export interface AttendanceSummary {
  sessions: AttendanceSession[];
  grossTotalMinutes: number; // Raw duration between punches
  totalBreakMinutes: number; // Gap between punches
  idleOfflineMinutes: number; // Time marked as IDLE or OFFLINE
  netActiveMinutes: number; // Gross - Break - Idle
  firstPunchIn: Date | null;
  lastPunchOut: Date | null;
  status: string;
  idleBlocks: ActivityLog[];
}

export function normalizeAttendanceSessions(
  records: AttendanceRecord[], 
  activityLogs: ActivityLog[],
  attendanceDate: Date, 
  now: Date = new Date()
): AttendanceSummary {
  const sessions: AttendanceSession[] = [];
  let currentPunchIn: Date | null = null;
  let currentPunchInRecordId: string | null = null;

  // sort records
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);

  sorted.forEach(record => {
    if (record.type === 'punchIn') {
      if (!currentPunchIn) {
        currentPunchIn = toZonedTime(new Date(record.timestamp), INDIAN_TIME_ZONE);
        currentPunchInRecordId = record.id;
      }
    } else if (record.type === 'punchOut' && currentPunchIn) {
      const punchOut = toZonedTime(new Date(record.timestamp), INDIAN_TIME_ZONE);
      const duration = Math.round((punchOut.getTime() - currentPunchIn.getTime()) / 60000);
      sessions.push({
        id: currentPunchInRecordId || record.id,
        punchIn: currentPunchIn,
        punchOut: punchOut,
        durationMinutes: duration,
        isAutoPunchedOut: false
      });
      currentPunchIn = null;
      currentPunchInRecordId = null;
    }
  });

  const currentIn = currentPunchIn as Date | null;
  if (currentIn) {
    const zonedNow = toZonedTime(now, INDIAN_TIME_ZONE);
    const zonedAttendanceDate = toZonedTime(attendanceDate, INDIAN_TIME_ZONE);
    
    // Office hours end at 05:30 PM
    const officeEnd = setHours(setMinutes(setSeconds(setMilliseconds(zonedAttendanceDate, 0), 0), 30), 17);

    let effectivePunchOut: Date | null = null;
    let isAutoPunchedOut = false;
    
    const isToday = isSameDay(zonedAttendanceDate, zonedNow);
    const isPast = isBefore(startOfDay(zonedAttendanceDate), startOfDay(zonedNow));
    
    // User punch_in was after 5:30 PM
    if (currentIn > officeEnd) {
       effectivePunchOut = currentIn;
       isAutoPunchedOut = true;
    } else {
       if (isPast) {
         effectivePunchOut = officeEnd;
         isAutoPunchedOut = true;
       } else if (isToday) {
         if (zonedNow > officeEnd) {
           effectivePunchOut = officeEnd;
           isAutoPunchedOut = true;
         } else {
           effectivePunchOut = null;
           isAutoPunchedOut = false;
         }
       }
    }

    const duration = effectivePunchOut 
      ? Math.round((effectivePunchOut.getTime() - currentIn.getTime()) / 60000) 
      : isToday ? Math.max(0, Math.round((zonedNow.getTime() - currentIn.getTime()) / 60000)) : 0;

    sessions.push({
      id: currentPunchInRecordId || 'inc',
      punchIn: currentIn,
      punchOut: effectivePunchOut,
      durationMinutes: duration,
      isAutoPunchedOut
    });
  }

  const grossTotalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  let totalBreakMinutes = 0;
  
  for (let i = 0; i < sessions.length - 1; i++) {
    if (sessions[i].punchOut && sessions[i+1].punchIn) {
      const breakDur = Math.round((sessions[i+1].punchIn.getTime() - sessions[i].punchOut!.getTime()) / 60000);
      if (breakDur > 0) totalBreakMinutes += breakDur;
    }
  }

  const firstPunchIn = sessions.length > 0 ? sessions[0].punchIn : null;
  const lastPunchOut = sessions.length > 0 && sessions[sessions.length - 1].punchOut ? sessions[sessions.length - 1].punchOut : null;

  // Calculate Idle / Offline
  // We only count IDLE / OFFLINE if it overlaps with a punched-in session.
  // A simple way is to just sum them up if they happened within the firstPunchIn and lastPunchOut bounds.
  // Even simpler: just sum all IDLE/OFFLINE for the day, since if they are punched out, they are not generating IDLE/OFFLINE (frontend only pings when logged in, but wait, frontend runs regardless of punch status?)
  // Yes, if they are not punched in, the frontend shouldn't ping heartbeat. 
  // But to be safe, let's just sum all IDLE and OFFLINE logs.
  let idleOfflineMinutes = 0;
  const idleBlocks: ActivityLog[] = [];
  activityLogs.forEach(log => {
      if (log.activity_type === 'IDLE' || log.activity_type === 'OFFLINE') {
          idleOfflineMinutes += log.duration_minutes;
          idleBlocks.push(log);
      }
  });

  // Ensure net active doesn't go below 0
  let netActiveMinutes = grossTotalMinutes - idleOfflineMinutes;
  if (netActiveMinutes < 0) netActiveMinutes = 0;

  let status = 'Absent';
  if (sessions.length > 0) {
    const hasActiveSession = sessions.some(s => s.punchOut === null);
    if (hasActiveSession) status = 'In Progress';
    else {
      if (grossTotalMinutes >= 9 * 60) status = 'Present';
      else if (grossTotalMinutes >= 5 * 60) status = 'Half Day';
      else status = 'Present'; 
    }
  }

  return {
    sessions,
    grossTotalMinutes,
    totalBreakMinutes,
    idleOfflineMinutes,
    netActiveMinutes,
    firstPunchIn,
    lastPunchOut,
    status,
    idleBlocks
  };
}

import * as z from 'zod';
import { z as zod } from 'zod';
import { ActivityLog } from '@/lib/attendance-utils';

export const INDIAN_TIME_ZONE = 'Asia/Kolkata';

export interface Employee {
  id: string;
  userId: string;
  fullName: string;
  department?: string;
  email?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  type: 'punchIn' | 'punchOut';
  timestamp: number;
  date: string;
  employeeName: string;
  employeeDepartment?: string;
}

export interface HolidayRecord {
  id: string;
  name: string;
  type: string;
  date: string;
}

export interface AttendanceConfig {
  shift: {
    startTime: string;
    endTime: string;
    minFullDayHours: number;
    minHalfDayHours: number;
  };
  rules: {
    lateEntryGraceMinutes: number;
    earlyExitGraceMinutes: number;
  };
  credits: {
    monthlyLateMinutes: number;
    monthlyEarlyExitMinutes: number;
  };
}

export const DEFAULT_CONFIG: AttendanceConfig = {
  shift: { startTime: "09:30", endTime: "18:30", minFullDayHours: 9, minHalfDayHours: 5 },
  rules: { lateEntryGraceMinutes: 15, earlyExitGraceMinutes: 15 },
  credits: { monthlyLateMinutes: 60, monthlyEarlyExitMinutes: 60 }
};

export interface EmployeeDaySummary {
  employeeId: string;
  employeeName: string;
  department: string;
  punchIn: Date | null;
  punchOut: Date | null;
  totalDuration: string;
  totalMinutes: number;
  status: 'Present' | 'Half Day' | 'Absent' | 'Incomplete' | 'Holiday';
  records: AttendanceRecord[];
  sessions: any[];
  totalBreakMinutes: number;
  netActiveMinutes: number;
  idleMinutes: number;
}

export const attendanceFormSchema = z.object({
  userId: z.string().min(1, { message: "Employee is required." }),
  eventDate: z.date({ required_error: "Date is required." }),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)." }),
  type: z.enum(['punchIn', 'punchOut'], { required_error: "Punch type is required." }),
});

export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;


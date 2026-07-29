import { z } from 'zod';

export const INDIAN_TIME_ZONE = 'Asia/Kolkata';

export const leaveTypes = [
  { value: "Casual Leave", label: "Casual Leave" },
  { value: "Sick Leave", label: "Sick Leave" },
  { value: "Earned Leave", label: "Earned Leave" },
  { value: "Work From Home", label: "Work From Home" },
  { value: "Other", label: "Other" },
];

export const leaveRequestSchema = z.object({
  leaveType: z.string().min(1, 'Leave type is required.'),
  duration: z.enum(['single', 'multiple', 'half'], { required_error: 'Duration is required.' }),
  halfDayType: z.enum(['first-half', 'second-half']).optional(),
  date: z.date().optional(),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
  reason: z.string().min(10, { message: 'Reason must be at least 10 characters long.' }),
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

export type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

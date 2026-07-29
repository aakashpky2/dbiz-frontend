import * as z from 'zod';
import { z as zod } from 'zod';

export type ApplicationStatus = 'Applied' | 'Shortlisted' | 'Interview Scheduled' | 'Interview Completed' | 'Selected' | 'Rejected';

export interface Applicant {
    id: string;
    name: string;
    email: string;
    phone: string;
    position: string;
    job_title_id?: string;
    department_id?: string;
    employment_type_id?: string;
    location_id?: string;
    job_id?: string;
    resumeUrl: string;
    resumeName: string;
    source: string;
    referringEmployee?: string;
    otherSource?: string;
    appliedDate: string; // ISO string
    status: ApplicationStatus;
    interviewDate?: string;
    interviewTime?: string;
    interviewMode?: string;
    interviewNotes?: string;
    dynamic_fields?: Record<string, any>;
}

export const applicantFormSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Invalid email address."),
    phone: z.string().min(10, "Phone number must be at least 10 digits."),
    position: z.string().min(2, "Position is required."),
    job_title_id: z.string().optional(),
    department_id: z.string().optional(),
    employment_type_id: z.string().optional(),
    location_id: z.string().optional(),
    job_id: z.string().optional(),
    source: z.string().min(1, "Please select a source."),
    referringEmployee: z.string().optional(),
    otherSource: z.string().optional(),
    status: z.string().optional().default("Applied"),
    interviewDate: z.string().optional(),
    interviewTime: z.string().optional(),
    interviewMode: z.string().optional(),
    interviewNotes: z.string().optional(),
    dynamic_fields: z.record(z.any()).optional(),
}).refine(data => {
    if (data.source === 'Employee Referral' && !data.referringEmployee) {
        return false;
    }
    return true;
}, {
    message: "Referring Employee Name is required.",
    path: ["referringEmployee"]
}).refine(data => {
    if (data.source === 'Other' && !data.otherSource) {
        return false;
    }
    return true;
}, {
    message: "Please specify the source.",
    path: ["otherSource"]
}).refine(data => {
    if (data.status === 'Interview Scheduled') {
        return !!data.interviewDate && !!data.interviewTime && !!data.interviewMode;
    }
    return true;
}, {
    message: "Date, Time, and Mode are required for Interview Scheduling.",
    path: ["interviewDate"]
});

export type ApplicantFormValues = z.infer<typeof applicantFormSchema>;

export const STATUS_OPTIONS: ApplicationStatus[] = [
    'Applied', 'Shortlisted', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Rejected'
];


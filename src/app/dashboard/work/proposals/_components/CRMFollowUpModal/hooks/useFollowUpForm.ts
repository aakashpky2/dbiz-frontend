'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

/**
 * SIMPLIFIED CRM FORM SCHEMA
 * Aligned with Interaction -> Lifecycle transition.
 */

// Helper to get YYYY-MM-DD in local time
export const getLocalYYYYMMDD = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getTomorrowYYYYMMDD = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalYYYYMMDD(d);
};

export const PURPOSES = ['intro_pitch', 'follow_up', 'negotiation', 'closing', 'administrative'];

export const NEXT_ACTIONS = [
    'follow_up',
    'resend_proposal',
    'schedule_meeting',
    'restructure_proposal',
    'initiate_project',
    'mark_lost',
];

const followUpSchema = z.object({
    currentStage: z.string(),
    interactionType: z.string().min(1, 'Required'),
    interactionDate: z.string().min(1, 'Required').refine((val) => {
        const today = getLocalYYYYMMDD();
        return val <= today;
    }, { message: "Interaction date cannot be in the future." }),
    contactPerson: z.string().min(1, 'Required'),
    contactRole: z.string().optional(),
    clientRole: z.string().optional(),
    followUpPurpose: z.string().optional(),
    followUpOutcome: z.string().min(1, 'Outcome is required to determine next state'),
    clientSentiment: z.string().optional(),
    notesSummary: z.string().min(5, 'Engagement notes must be detailed'),
    
    // Stage-specific fields
    clientResponseStatus: z.string().optional(),
    concernType: z.string().optional(),
    concernSummary: z.string().optional(),
    
    // Acceptance details
    acceptedBy: z.string().optional(),
    acceptanceDate: z.string().optional(),
    finalRemarks: z.string().optional(),
    
    // Loss details
    lossReason: z.string().optional(),
    competitorMentioned: z.boolean().default(false),
    competitorName: z.string().optional(),
    closingNotes: z.string().optional(),

    // Future Planning
    nextAction: z.string().optional(),
    nextFollowUpDate: z.string().optional().refine((val) => {
        if (!val) return true;
        const today = getLocalYYYYMMDD();
        return val > today;
    }, { message: "Next follow-up date must be after today." }),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
}).refine((data) => {
    if (data.interactionDate && data.nextFollowUpDate) {
        return data.nextFollowUpDate >= data.interactionDate;
    }
    return true;
}, {
    message: "Next follow-up date cannot be before the interaction date.",
    path: ["nextFollowUpDate"],
});

export type FollowUpFormValues = z.infer<typeof followUpSchema>;

interface UseFollowUpFormProps {
    currentStage: string;
    contactPerson?: string;
}

export const useFollowUpForm = ({ currentStage, contactPerson }: UseFollowUpFormProps) => {
    return useForm<FollowUpFormValues>({
        resolver: zodResolver(followUpSchema),
        defaultValues: {
            currentStage: currentStage,
            interactionDate: getLocalYYYYMMDD(),
            contactPerson: contactPerson || '',
            followUpOutcome: 'No Response',
            clientRole: '',
            clientSentiment: 'neutral',
            notesSummary: '',
            priority: 'medium',
            competitorMentioned: false,
        },
    });
};

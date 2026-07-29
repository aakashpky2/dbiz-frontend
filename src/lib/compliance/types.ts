import { z } from 'zod';

// ==========================================
// 1. MASTER IDENTITIES (STATIC)
// ==========================================

export enum Authority {
    CBDT = 'CBDT',
    GST = 'GST',
    MCA = 'MCA',
    DGFT = 'DGFT',
    RBI = 'RBI'
}

// Changed to string for dynamic support
export type WorkType = string;
export type Constitution = string;

// ==========================================
// 2. CLIENT PROFILE
// ==========================================

export interface ClientProfile {
    id: string;
    name: string;
    constitution: Constitution;
    // Specific preferences that might affect rules
    tags: string[]; // e.g. ["TAX_AUDIT_APPLICABLE", "GST_QRMP"]
    state?: string;
}

// ==========================================
// 3. DUE DATE RULE ENGINE (VERSIONED)
// ==========================================

export enum RuleType {
    FY_END_BASED = 'FY_END_BASED',         // e.g. ITR (31st July after FY End)
    PERIOD_END_BASED = 'PERIOD_END_BASED', // e.g. GSTR (11th of next month)
    EVENT_BASED = 'EVENT_BASED'            // e.g. ADT-1 (15 days from AGM)
}

export interface RuleCondition {
    field: string; // e.g. "client.tags", "client.constitution"
    operator: 'IN' | 'NOT_IN' | 'EQUALS';
    value: any;
}

// Immutable Rule Version
export interface DueDateRuleVersion {
    versionId: string;
    effectiveFrom: string; // ISO Date
    effectiveTo?: string;  // ISO Date (Optional/Open-ended)

    ruleType: RuleType;

    // Offset Logic
    offsetMonths: number; // e.g. 4 months after FY end
    offsetDays: number;   // e.g. 15 days
    fixedDay?: number;    // e.g. 11th day of the month

    // Scoping
    conditions?: RuleCondition[]; // e.g. Only for Audit Cases

    description: string;  // e.g. "Standard Due Date"
    notificationRef?: string; // e.g. "Notification 12/2024"
}

// The Logical Rule Container
export interface DueDateRule {
    id: string; // e.g. "RULE_ITR_INDIVIDUAL"
    workType: WorkType;
    authority: Authority;
    constitution?: Constitution; // Optional specificity
    department?: string;         // Track source department
    workCategory?: string;       // Track source category
    versions: DueDateRuleVersion[]; // Historical versions
}

// ==========================================
// 4. ONE-TIME RULE EXCEPTIONS (GOV NOTIFICATIONS)
// ==========================================

export interface RuleException {
    id: string;
    workType: WorkType;

    // Scope
    applicableFy?: string;     // e.g. "2024-25"
    applicablePeriod?: string; // e.g. "2024-04"

    // Override
    newDueDate: string; // The absolute new date

    // Metadata
    reason: string;     // e.g. "Flood Relief Extension"
    notificationRef: string;
    priority: number;   // Higher overrides standard rules
}

// ==========================================
// 5. FEE RULE ENGINE
// ==========================================

export interface FeeRuleVersion {
    versionId: string;
    effectiveFrom: string;
    effectiveTo?: string;

    baseFee: number;

    // Late Fee Logic
    lateFeePerDay: number;
    maxLateFee?: number; // Cap

    currency: string;    // "INR"
}

export interface FeeRule {
    id: string;
    workType: WorkType;
    versions: FeeRuleVersion[];
}

// ==========================================
// 6. FEE WAIVER / RELAXATION LOG
// ==========================================

export enum WaiverType {
    FULL_WAIVER = 'FULL_WAIVER',
    LATE_FEE_WAIVER = 'LATE_FEE_WAIVER',
    FIXED_FEE_OVERRIDE = 'FIXED_FEE_OVERRIDE',
    CAP_OVERRIDE = 'CAP_OVERRIDE'
}

export interface FeeWaiver {
    id: string;
    workType?: WorkType; // If null, applies to ALL (rare)

    effectiveFrom: string; // Waiver Start Date
    effectiveTo: string;   // Waiver End Date

    type: WaiverType;
    value?: number; // e.g. if FIXED_FEE_OVERRIDE, utilize this

    description: string;
    notificationRef: string;
}

// ==========================================
// 7. WORK INSTANCE (SNAPSHOT)
// ==========================================

export interface DueDateSnapshot {
    date: string;
    isExtended: boolean;
    appliedRuleId: string;
    appliedVersionId: string;
    appliedExceptionId?: string;
    calculatedAt: string;
}

export interface FeeSnapshot {
    baseFee: number;
    lateFee: number;
    totalFee: number;
    isWaived: boolean;
    appliedWaiverId?: string;
    appliedRuleVersionId: string;
    calculatedAt: string;
}

export interface WorkInstance {
    id: string;
    clientId: string;
    workType: WorkType;

    // Context
    financialYear?: string; // "2024-25"
    period?: string;        // "2024-09" (September)
    eventDate?: string;     // e.g. AGM Date

    // The Frozen Truth
    dueDateInternal: DueDateSnapshot;

    // Status
    filingDate?: string; // When it was actually filed
    feeInternal?: FeeSnapshot; // Populated once filed/calculated

    status: 'PENDING' | 'FILED' | 'LATE';
}

// Zod Schemas for Runtime Validation (Optional subset if needed later)
export const ruleConditionSchema = z.object({
    field: z.string(),
    operator: z.enum(['IN', 'NOT_IN', 'EQUALS']),
    value: z.any(),
});

export const dueDateRuleVersionSchema = z.object({
    versionId: z.string(),
    effectiveFrom: z.string(), // ISO Date
    effectiveTo: z.string().optional(),  // ISO Date (Optional/Open-ended)

    ruleType: z.nativeEnum(RuleType),

    // Offset Logic
    offsetMonths: z.number(), // e.g. 4 months after FY end
    offsetDays: z.number(),   // e.g. 15 days
    fixedDay: z.number().optional(),    // e.g. 11th day of the month

    // Scoping
    conditions: z.array(ruleConditionSchema).optional(), // e.g. Only for Audit Cases

    description: z.string(),  // e.g. "Standard Due Date"
    notificationRef: z.string().optional(), // e.g. "Notification 12/2024"
});

export const dueDateRuleSchema = z.object({
    id: z.string(),
    workType: z.string(),
    authority: z.nativeEnum(Authority),
    constitution: z.string().optional(),
    department: z.string().optional(),
    workCategory: z.string().optional(),
    versions: z.array(dueDateRuleVersionSchema)
});

export const WorkInstanceSchema = z.object({
    id: z.string(),
    clientId: z.string(),
    workType: z.string(),
    // ... rest of schema mapping
});

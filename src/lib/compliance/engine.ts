import {
    WorkType,
    ClientProfile,
    DueDateRule,
    RuleException,
    WorkInstance,
    DueDateSnapshot,
    FeeRule,
    FeeWaiver,
    FeeSnapshot,
    DueDateRuleVersion,
    RuleType,
    WaiverType
} from './types';

import { addMonths } from 'date-fns';
import { addDays } from 'date-fns';
import { setDate } from 'date-fns';
import { isAfter } from 'date-fns';
import { isBefore } from 'date-fns';
import { parseISO } from 'date-fns';
import { format } from 'date-fns';

// ==========================================
// HELPER: Date Logic
// ==========================================

function getEffectiveVersion<T extends { effectiveFrom: string; effectiveTo?: string }>(
    versions: T[],
    checkDate: string
): T | null {
    // Sort versions descending by effectiveFrom to get latest applicable match
    const sorted = [...versions].sort((a, b) =>
        new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    );

    return sorted.find(v => {
        const from = new Date(v.effectiveFrom);
        const to = v.effectiveTo ? new Date(v.effectiveTo) : new Date('9999-12-31');
        const check = new Date(checkDate);
        return check >= from && check <= to;
    }) || null;
}

// ==========================================
// 1. DUE DATE CALCULATION
// ==========================================

export function calculateDueDate(
    workType: WorkType,
    client: ClientProfile,
    rules: DueDateRule[],
    exceptions: RuleException[],
    context: { fy?: string; periodEnd?: string; eventDate?: string }
): DueDateSnapshot {

    const calculatedAt = new Date().toISOString();

    // 1. CHECK EXCEPTIONS (Highest Priority)
    // Find applicable exception for this WorkType + Period/FY
    const applicableException = exceptions.find(ex =>
        ex.workType === workType &&
        (!ex.applicableFy || ex.applicableFy === context.fy) &&
        (!ex.applicablePeriod || ex.applicablePeriod === context.periodEnd)
    );

    if (applicableException) {
        return {
            date: applicableException.newDueDate,
            isExtended: true,
            appliedRuleId: 'EXCEPTION',
            appliedVersionId: 'EXCEPTION',
            appliedExceptionId: applicableException.id,
            calculatedAt
        };
    }

    // 2. FIND MATCHING RULE
    // Filter rules by WorkType and Client Condition (e.g. Constitution)
    // Simplified logic: Assuming rules passed in are pre-filtered or we search here
    const rule = rules.find(r => r.workType === workType);
    // In real app, we might check r.condition against client.constitution here

    if (!rule) {
        throw new Error(`No Due Date Rule found for ${workType}`);
    }

    // 3. SELECT VERSION
    // Effective date relies on the Context Date (FY End or Period End), NOT Today
    // Because the law applicable is the one active at the time of the period end
    const referenceDateStr = context.periodEnd || context.eventDate || (context.fy ? `${context.fy.split('-')[1]}-03-31` : null);

    if (!referenceDateStr) throw new Error("Missing context date (FY, Period, or Event) for Due Date Calc");

    const version = getEffectiveVersion(rule.versions, referenceDateStr);

    if (!version) {
        throw new Error(`No active rule version for ${workType} on ${referenceDateStr}`);
    }

    // 4. CALCULATE DATE
    let dueDate = new Date(referenceDateStr);

    // Apply Offsets
    if (version.offsetMonths) dueDate = addMonths(dueDate, version.offsetMonths);
    if (version.offsetDays) dueDate = addDays(dueDate, version.offsetDays);

    // Apply Fixed Day (e.g. 11th of month)
    if (version.fixedDay) {
        dueDate = setDate(dueDate, version.fixedDay);
    }

    return {
        date: format(dueDate, 'yyyy-MM-dd'),
        isExtended: false,
        appliedRuleId: rule.id,
        appliedVersionId: version.versionId,
        calculatedAt
    };
}

// ==========================================
// 2. FEE CALCULATION
// ==========================================

export function calculateFee(
    workInstance: WorkInstance,
    filingDate: string,
    feeRule: FeeRule,
    waivers: FeeWaiver[]
): FeeSnapshot {

    const calculatedAt = new Date().toISOString();

    // 1. SELECT FEE RULE VERSION
    // Fee rules usually apply based on the Due Date or Filing Date? 
    // Usually the fee structure Active at the time of Due Date applies.
    const version = getEffectiveVersion(feeRule.versions, workInstance.dueDateInternal.date);

    if (!version) {
        // Fallback or Free
        return { baseFee: 0, lateFee: 0, totalFee: 0, isWaived: false, appliedRuleVersionId: 'NONE', calculatedAt };
    }

    // 2. CHECK LATENESS
    const dueDate = new Date(workInstance.dueDateInternal.date);
    const filedAt = new Date(filingDate);

    let daysLate = 0;
    if (isAfter(filedAt, dueDate)) {
        const diffTime = Math.abs(filedAt.getTime() - dueDate.getTime());
        daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 3. CALCULATE RAW FEE
    let baseFee = version.baseFee;
    let lateFee = daysLate * version.lateFeePerDay;
    if (version.maxLateFee && lateFee > version.maxLateFee) {
        lateFee = version.maxLateFee;
    }

    // 4. CHECK WAIVERS (Relaxation Notifications)
    // Waiver must be active on the FILING DATE (usually relaxations apply if you file within X date)
    const activeWaiver = waivers.find(w => {
        if (w.workType && w.workType !== workInstance.workType) return false;
        const from = new Date(w.effectiveFrom);
        const to = new Date(w.effectiveTo);
        return filedAt >= from && filedAt <= to;
    });

    let appliedWaiverId = undefined;
    let isWaived = false;

    if (activeWaiver) {
        appliedWaiverId = activeWaiver.id;
        isWaived = true;

        if (activeWaiver.type === WaiverType.FULL_WAIVER) {
            baseFee = 0;
            lateFee = 0;
        } else if (activeWaiver.type === WaiverType.LATE_FEE_WAIVER) {
            lateFee = 0;
        } else if (activeWaiver.type === WaiverType.FIXED_FEE_OVERRIDE && activeWaiver.value !== undefined) {
            // Complex logic, assumes replacing total or base? 
            // Simplified: replace total
            baseFee = activeWaiver.value;
            lateFee = 0;
        } else if (activeWaiver.type === WaiverType.CAP_OVERRIDE && activeWaiver.value !== undefined) {
            if (lateFee > activeWaiver.value) lateFee = activeWaiver.value;
        }
    }

    return {
        baseFee,
        lateFee,
        totalFee: baseFee + lateFee,
        isWaived,
        appliedWaiverId,
        appliedRuleVersionId: version.versionId,
        calculatedAt
    };
}

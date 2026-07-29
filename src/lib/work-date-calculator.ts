import { parseISO } from 'date-fns';
import { format } from 'date-fns';
import { startOfDay } from 'date-fns';
import { addDays } from 'date-fns';
import { addMonths } from 'date-fns';
import { subDays } from 'date-fns';
import { isBefore } from 'date-fns';
import { isAfter } from 'date-fns';
import { isValid } from 'date-fns';
import { endOfMonth } from 'date-fns';
import { startOfMonth } from 'date-fns';

export type PriorityType = 'Low' | 'Medium' | 'High' | 'Critical';
export type OccurrenceType = 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly' | 'Often' | 'One-time';

export const MONTHS = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
];
export const QUARTERS = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
export const HALVES = ['H1 (Apr-Sep)', 'H2 (Oct-Mar)'];

export interface DateInput {
    workStartDate: string;
    workTypeName: string;
    occurrence: string;
    financialYear: string;
    period: string;
    priority: string;
    durationDays?: number;
    durationHours?: number;
    config?: any;
}

export interface DateOutput {
    workStartDate: string;
    targetDueDate: string;
    finishByGoal: string;
    warnings: string[];
    debug: any;
}

const safeParseDate = (dateStr: string): Date => {
    if (!dateStr) return startOfDay(new Date());
    const parsed = startOfDay(parseISO(dateStr));
    return isValid(parsed) ? parsed : startOfDay(new Date());
};

const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');

export const getPeriodDates = (financialYear: string, occurrence: string, period: string) => {
    if (!financialYear) return null;
    
    const parts = financialYear.split('-');
    if (parts.length !== 2) return null;
    
    const startYear = parseInt(parts[0], 10);
    if (isNaN(startYear)) return null;

    let startDate: Date;
    let endDate: Date;

    if (occurrence === 'Monthly') {
        const monthIdx = MONTHS.indexOf(period);
        if (monthIdx === -1) return null;
        
        const actualMonth = (monthIdx + 3) % 12; 
        const actualYear = monthIdx < 9 ? startYear : startYear + 1;
        
        startDate = parseISO(`${actualYear}-${String(actualMonth + 1).padStart(2, '0')}-01`);
        endDate = endOfMonth(startDate);
    } else if (occurrence === 'Quarterly') {
        const qIdx = QUARTERS.indexOf(period);
        if (qIdx === -1) return null;
        
        const actualMonth = (qIdx * 3) + 3; // 3, 6, 9, 12
        const actualYear = qIdx === 3 ? startYear + 1 : startYear;
        const adjustedMonth = actualMonth % 12 === 0 ? 12 : actualMonth % 12;

        startDate = parseISO(`${actualYear}-${String(adjustedMonth).padStart(2, '0')}-01`);
        endDate = endOfMonth(addMonths(startDate, 2));
    } else if (occurrence === 'Half-yearly') {
        const hIdx = HALVES.indexOf(period);
        if (hIdx === -1) return null;
        
        const actualMonth = (hIdx * 6) + 3; // 3, 9
        startDate = parseISO(`${startYear}-${String(actualMonth).padStart(2, '0')}-01`);
        endDate = endOfMonth(addMonths(startDate, 5));
    } else if (occurrence === 'Yearly' || occurrence === 'annually') {
        startDate = parseISO(`${startYear}-04-01`);
        endDate = parseISO(`${startYear + 1}-03-31`);
    } else {
        return null;
    }

    return { startDate, endDate };
};

export const calculateTargetDueDate = (input: DateInput): string | null => {
    const { occurrence, financialYear, period, config } = input;
    
    if (!config) return null;

    const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
    const configs = parsedConfig.dueTimeConfigurations || parsedConfig.configs || [];

    const freqToMatch = 
        occurrence === 'Monthly' ? 'monthly' :
        occurrence === 'Quarterly' ? 'quarterly' :
        occurrence === 'Half-yearly' ? 'half-yearly' :
        (occurrence === 'Yearly' || occurrence === 'annually') ? 'annually' : 'event_based';

    const rule = configs.find((c: any) => c.frequency === freqToMatch);
    if (!rule) return null;

    const periodDates = getPeriodDates(financialYear, occurrence, period);
    if (!periodDates) return null;

    const baseDate = rule.periodPosition === 'start' ? periodDates.startDate : periodDates.endDate;
    let resultDate = baseDate;

    if (rule.mode === 'days') {
        resultDate = addDays(resultDate, Number(rule.daysAfter || rule.value || 0));
    } else if (rule.mode === 'month') {
        resultDate = addMonths(resultDate, Number(rule.monthOffset || 0));
        if (rule.periodPosition === 'end') {
            resultDate = endOfMonth(resultDate);
        } else {
            resultDate = startOfMonth(resultDate);
        }
    } else if (rule.mode === 'fixed') {
        const startYear = parseInt(financialYear.split('-')[0], 10);
        const fixedMonthIdx = MONTHS.indexOf(rule.fixedMonth);
        if (fixedMonthIdx !== -1) {
            const actualYear = fixedMonthIdx < 9 ? startYear : startYear + 1;
            const actualMonth = ((fixedMonthIdx + 3) % 12) + 1;
            resultDate = parseISO(`${actualYear}-${String(actualMonth).padStart(2, '0')}-${String(rule.fixedDay || 1).padStart(2, '0')}`);
        }
    }

    return formatDate(resultDate);
};

export const applyPriorityAdjustment = (baseDays: number, priority: string, config: any): number => {
    if (!config || !config.priorityAdjustments) return baseDays;

    let adjustments = config.priorityAdjustments;
    if (typeof adjustments === 'string') {
        try { adjustments = JSON.parse(adjustments); } catch (e) {}
    }

    if (!Array.isArray(adjustments)) return baseDays;

    const priConfig = adjustments.find((p: any) => p.priority === priority);
    if (priConfig && priConfig.daysAdjustment) {
        const adjusted = baseDays + Number(priConfig.daysAdjustment);
        return Math.max(0, adjusted); // Never go below 0 days
    }

    return baseDays;
};

export const calculateFinishByGoal = (
    workStartDate: string, 
    targetDueDate: string | null, 
    input: DateInput
): string | null => {
    const { config, durationDays, priority } = input;
    const start = safeParseDate(workStartDate);

    if (!config?.finishByEnabled) {
        return formatDate(addDays(start, Number(durationDays || 0)));
    }

    let finishDate = start;

    if (config.finishByMode === 'days_based') {
        let finishByDays = Number(config.finishByDays || 0);
        finishByDays = applyPriorityAdjustment(finishByDays, priority, config);
        finishDate = addDays(start, finishByDays);
    } else if (config.finishByMode === 'event_based') {
        let baseAnchor = start;
        if (config.finishByEvent === 'due_date' && targetDueDate) {
            baseAnchor = safeParseDate(targetDueDate);
        }
        
        let days = Number(config.finishByDays || 0);
        days = applyPriorityAdjustment(days, priority, config);

        if (config.finishByDirection === 'before') {
            finishDate = subDays(baseAnchor, days);
        } else {
            finishDate = addDays(baseAnchor, days);
        }
    }

    return formatDate(finishDate);
};

export const calculateRepeatCycle = (input: DateInput) => {
    // Currently deterministic based on the period logic which is handled naturally 
    // by the application state when the user selects a period.
    // This hook is available for future expansion if repeat_cycle needs to actively modify 
    // the period options.
    return { enabled: true, mode: 'deterministic' };
};

export const validateDateHierarchy = (
    workStartDate: string,
    targetDueDate: string,
    finishByGoal: string
) => {
    const start = safeParseDate(workStartDate);
    const target = safeParseDate(targetDueDate);
    const finish = safeParseDate(finishByGoal);

    return {
        isValid: !isBefore(target, start) && !isBefore(finish, start) && !isAfter(finish, target),
        isTargetBeforeStart: isBefore(target, start),
        isFinishBeforeStart: isBefore(finish, start),
        isFinishAfterTarget: isAfter(finish, target)
    };
};

export const calculateWorkDates = (input: DateInput): DateOutput => {
    const warnings: string[] = [];
    const debug: any = { input };

    // 1. Base anchor
    let workStartDate = input.workStartDate;
    if (!workStartDate) {
        workStartDate = formatDate(new Date());
        warnings.push("Work Start Date was missing, defaulted to today.");
    }
    const startObj = safeParseDate(workStartDate);
    workStartDate = formatDate(startObj); // Standardize format

    // 2. Target Due Date
    let targetDueDate = calculateTargetDueDate(input);
    let targetObj = targetDueDate ? safeParseDate(targetDueDate) : null;

    // 3. Finish By Goal
    let finishByGoal = calculateFinishByGoal(workStartDate, targetDueDate, input);
    let finishObj = finishByGoal ? safeParseDate(finishByGoal) : null;

    // --- Safety Corrections ---

    // A: Target Due Date must not be before Work Start Date
    if (targetObj && isBefore(targetObj, startObj)) {
        warnings.push(`Target Due Date (${targetDueDate}) was before Work Start Date (${workStartDate}). Corrected to Work Start Date.`);
        targetObj = startObj;
        targetDueDate = formatDate(targetObj);
    }

    // B: Finish By Goal must not be before Work Start Date
    if (finishObj && isBefore(finishObj, startObj)) {
        warnings.push(`Finish By Goal (${finishByGoal}) was before Work Start Date (${workStartDate}). Corrected to Work Start Date.`);
        finishObj = startObj;
        finishByGoal = formatDate(finishObj);
    }

    // C: Finish By Goal must not be after Target Due Date
    if (finishObj && targetObj && isAfter(finishObj, targetObj)) {
        warnings.push(`Finish By Goal (${finishByGoal}) exceeded Target Due Date (${targetDueDate}). Capped at Target Due Date.`);
        finishObj = targetObj;
        finishByGoal = formatDate(finishObj);
    }

    debug.calculated = { workStartDate, targetDueDate, finishByGoal };
    
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
        console.log('[WorkDateCalculator]', {
            workStartDate,
            targetDueDate,
            finishByGoal,
            config: input.config,
            priority: input.priority,
            warnings
        });
    }

    return {
        workStartDate,
        targetDueDate: targetDueDate || workStartDate,
        finishByGoal: finishByGoal || workStartDate,
        warnings,
        debug
    };
};


'use client';

import React, { useMemo } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { addDays } from 'date-fns';
import { addMonths } from 'date-fns';
import { subDays } from 'date-fns';
import { startOfMonth } from 'date-fns';
import { endOfMonth } from 'date-fns';
import { startOfQuarter } from 'date-fns';
import { endOfQuarter } from 'date-fns';
import { startOfYear } from 'date-fns';
import { getYear } from 'date-fns';
import { getMonth } from 'date-fns';
import { subMonths } from 'date-fns';
import { subQuarters } from 'date-fns';
import { subYears } from 'date-fns';
import { endOfYear } from 'date-fns';
import { sub } from 'date-fns';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Loader2, CalendarIcon } from 'lucide-react';

import { useBusinessConstitutions, type BusinessTypeSetup } from '@/hooks/use-profiles';
import { type WorkType as DeptWorkType } from '@/lib/department-management';
import { type Schedule } from '@/app/dashboard/admin/work-schedules/page';

const scheduleFormSchema = z.object({
    workTypeId: z.string(), // Hidden field, but needed for context
    frequency: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time', 'valid_till_expiry']),
    anchor: z.enum(['period_end', 'period_start', 'event_date']),
    offsetMonths: z.coerce.number().int().default(0),
    offsetDays: z.coerce.number().int().default(0),
    fyModel: z.literal('india_apr_mar'),
    holidayStrategy: z.enum(['no_shift', 'roll_forward', 'roll_back']),
    graceDays: z.coerce.number().int().optional().default(0),
    validityWindowDays: z.coerce.number().int().optional().default(0),
    effectiveFrom: z.date().optional(),
    notifyDaysBeforeInput: z.string().max(100, "Cannot exceed 100 characters.").regex(/^[0-9,\s]*$/, "Only digits and commas are allowed.").optional(),
    escalation: z.object({
        level1Days: z.coerce.number().int().optional().default(0),
        level2Days: z.coerce.number().int().optional().default(0),
    }).optional(),
    applicability: z.object({
        applyToAll: z.boolean().default(false),
        constitutionIds: z.array(z.string()).optional(),
    }),
});

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

interface ScheduleFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ScheduleFormValues) => void;
    workType: DeptWorkType;
    existingSchedule?: Schedule | null;
    isSubmitting: boolean;
}

export function ScheduleFormDialog({ isOpen, onOpenChange, onSubmit, workType, existingSchedule, isSubmitting }: ScheduleFormDialogProps) {
    const { constitutions, loading: constitutionsLoading } = useBusinessConstitutions();

    const scheduleForm = useForm<ScheduleFormValues>({
        resolver: zodResolver(scheduleFormSchema),
        defaultValues: {
            workTypeId: workType.id,
            frequency: ((existingSchedule as any)?.frequency as any) || 'monthly',
            anchor: (existingSchedule as any)?.anchor || 'period_end',
            offsetMonths: (existingSchedule as any)?.offsetMonths || 0,
            offsetDays: (existingSchedule as any)?.offsetDays || 0,
            fyModel: 'india_apr_mar',
            holidayStrategy: (existingSchedule as any)?.holidayStrategy || 'no_shift',
            graceDays: (existingSchedule as any)?.graceDays || 0,
            validityWindowDays: (existingSchedule as any)?.validityWindowDays || 0,
            effectiveFrom: (existingSchedule as any)?.effectiveFrom ? parse((existingSchedule as any).effectiveFrom, 'yyyy-MM-dd', new Date()) : undefined,
            notifyDaysBeforeInput: (existingSchedule as any)?.notifyDaysBefore?.join(', ') || '14, 7, 3, 1',
            escalation: {
                level1Days: (existingSchedule as any)?.escalation?.level1Days || 0,
                level2Days: (existingSchedule as any)?.escalation?.level2Days || 0,
            },
            applicability: {
                applyToAll: (existingSchedule as any)?.applicability?.applyToAll || false,
                constitutionIds: (existingSchedule as any)?.applicability?.constitutionIds || [],
            }
        }
    });

    const { control, handleSubmit } = scheduleForm;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
                    <DialogTitle className="text-xl">Set Schedule for: <span className="text-primary">{workType.name}</span></DialogTitle>
                    <DialogDescription>Define when and how tasks for this work type should be generated.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <FormProvider {...scheduleForm}>
                        <Form {...scheduleForm}>
                            <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField control={control as any} name="frequency" render={({ field }) => (<FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="half_yearly">Half-Yearly</SelectItem><SelectItem value="yearly">Yearly</SelectItem><SelectItem value="one_time">One-Time</SelectItem><SelectItem value="valid_till_expiry">Validity-based</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={control as any} name="anchor" render={({ field }) => (<FormItem><FormLabel>Anchor</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="period_end">Period End</SelectItem><SelectItem value="period_start">Period Start</SelectItem><SelectItem value="event_date">Event Date</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={control as any} name="holidayStrategy" render={({ field }) => (<FormItem><FormLabel>Holiday Strategy</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="no_shift">No Shift</SelectItem><SelectItem value="roll_forward">Roll Forward</SelectItem><SelectItem value="roll_back">Roll Back</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={control as any} name="offsetMonths" render={({ field }) => (<FormItem><FormLabel>Offset (Months)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control as any} name="offsetDays" render={({ field }) => (<FormItem><FormLabel>Offset (Days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control as any} name="effectiveFrom" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Effective From</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick a date"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                </div>

                                <Separator />
                                <DueDatePreview />
                                <Separator />

                                <Card><CardHeader><CardTitle className="text-base">Applicability</CardTitle><CardDescription>Define which clients or business types this schedule applies to.</CardDescription></CardHeader>
                                    <CardContent>
                                        <ApplicabilityFormSection constitutions={constitutions} />
                                    </CardContent>
                                </Card>

                                <Card><CardHeader><CardTitle className="text-base">Notifications & Escalations</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FormField control={control as any} name="notifyDaysBeforeInput" render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Notify Days Before Due</FormLabel>
                                            <FormControl>
                                              <Input 
                                                placeholder="e.g. 14, 7, 3, 1" 
                                                {...field} 
                                                maxLength={100}
                                                onChange={(e) => {
                                                  const val = e.target.value.replace(/[^0-9,\s]/g, '');
                                                  field.onChange(val);
                                                }}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )} />
                                        <FormField control={control as any} name="escalation.level1Days" render={({ field }) => (<FormItem><FormLabel>Escalate L1 After (Days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={control as any} name="escalation.level2Days" render={({ field }) => (<FormItem><FormLabel>Escalate L2 After (Days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={control as any} name="graceDays" render={({ field }) => (<FormItem><FormLabel>Grace Days</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={control as any} name="validityWindowDays" render={({ field }) => (<FormItem><FormLabel>Validity Window (Days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </CardContent>
                                </Card>
                                

                                <DialogFooter className="border-t pt-4 mt-6 shrink-0 flex gap-2">
                                    <DialogClose asChild><Button type="button" variant="ghost" className="flex-1">Cancel</Button></DialogClose>
                                    <Button type="submit" disabled={isSubmitting} className="flex-1 font-bold">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Schedule</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </FormProvider>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ApplicabilityFormSection({ constitutions }: { constitutions: BusinessTypeSetup[] }) {
    const { control } = useFormContext<ScheduleFormValues>();
    const watchedApplicability = useWatch({ control, name: "applicability" });
    const { constitutions: allConstitutions } = useBusinessConstitutions();

    return (
        <div className="space-y-4">
            <FormField control={control} name="applicability.applyToAll" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <FormLabel className="font-normal">Apply to All Constitutions</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
            )} />

            {!watchedApplicability.applyToAll && (
                <FormField control={control} name="applicability.constitutionIds" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Select Constitutions</FormLabel>
                        {allConstitutions.length === 0 ? <Loader2 className="h-5 w-5 animate-spin" /> :
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {allConstitutions.map(c => (
                                    <FormItem key={c.id} className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <input type="checkbox"
                                                checked={field.value?.includes(c.id)}
                                                onChange={(e) => {
                                                    const selectedIds = field.value || [];
                                                    if (e.target.checked) field.onChange([...selectedIds, c.id]);
                                                    else field.onChange(selectedIds.filter(id => id !== c.id));
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal text-sm">{c.businessType} - {c.businessSubType}</FormLabel>
                                    </FormItem>
                                ))}
                            </div>
                        }
                        <FormMessage />
                    </FormItem>
                )} />
            )}
        </div>
    );
}

const DueDatePreview = () => {
    const formValues = useWatch<ScheduleFormValues>();

    const preview = useMemo(() => {
        const { frequency, anchor, offsetMonths, offsetDays, notifyDaysBeforeInput, escalation, graceDays } = formValues;

        const sampleDate = new Date('2025-08-22T00:00:00'); // Our fixed point in time for previews
        let periodStart: Date, periodEnd: Date;
        let periodDescription: string;

        const getFinancialYearStart = (date: Date) => {
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-11
            // FY starts in April (month 3). If current month is before April, FY started last year.
            return month < 3 ? new Date(year - 1, 3, 1) : new Date(year, 3, 1);
        }

        switch (frequency) {
            case 'yearly': {
                const currentFYStart = getFinancialYearStart(sampleDate);
                periodStart = sub(currentFYStart, { years: 1 });
                periodEnd = sub(currentFYStart, { days: 1 });
                periodDescription = `FY ${format(periodStart, 'yy')}-${format(periodEnd, 'yy')}`;
                break;
            }
            case 'half_yearly': {
                const currentFYStart = getFinancialYearStart(sampleDate);
                // If sample date is in H1 (Apr-Sep), the last completed period was H2 of previous FY
                if (sampleDate.getMonth() >= 3 && sampleDate.getMonth() <= 8) {
                    periodStart = sub(currentFYStart, { months: 6 });
                    periodEnd = sub(currentFYStart, { days: 1 });
                } else { // Sample date is in H2 (Oct-Mar), so last completed period is H1 of current FY
                    periodStart = currentFYStart; // Starts April 1st
                    periodEnd = addMonths(periodStart, 6);
                    periodEnd = sub(periodEnd, { days: 1 });
                }
                periodDescription = `${format(periodStart, 'MMM yyyy')} - ${format(periodEnd, 'MMM yyyy')}`;
                break;
            }
            case 'quarterly': {
                const sampleDateMonth = getMonth(sampleDate);
                const sampleDateYear = getYear(sampleDate);

                let lastCompletedQuarterStartMonth;
                let lastCompletedQuarterStartYear = sampleDateYear;

                if (sampleDateMonth >= 1 && sampleDateMonth <= 3) { // In Q4 (Jan-Mar)
                    lastCompletedQuarterStartMonth = 10 - 1; // October
                    lastCompletedQuarterStartYear = sampleDateYear - 1;
                } else if (sampleDateMonth >= 4 && sampleDateMonth <= 6) { // In Q1 (Apr-Jun)
                    lastCompletedQuarterStartMonth = 1 - 1; // January
                } else if (sampleDateMonth >= 7 && sampleDateMonth <= 9) { // In Q2 (Jul-Sep)
                    lastCompletedQuarterStartMonth = 4 - 1; // April
                } else { // In Q3 (Oct-Dec)
                    lastCompletedQuarterStartMonth = 7 - 1; // July
                }

                periodStart = new Date(lastCompletedQuarterStartYear, lastCompletedQuarterStartMonth, 1);
                periodEnd = endOfQuarter(periodStart);

                let financialQuarter: number;
                const month = periodStart.getMonth();
                if (month >= 3 && month <= 5) financialQuarter = 1;
                else if (month >= 6 && month <= 8) financialQuarter = 2;
                else if (month >= 9 && month <= 11) financialQuarter = 3;
                else financialQuarter = 4;
                const financialYear = financialQuarter === 4 ? getYear(periodStart) : getYear(periodStart) + 1;
                periodDescription = `Q${financialQuarter} FY${String(financialYear - 1).slice(-2)}-${String(financialYear).slice(-2)}`;
                break;
            }
            case 'one_time':
            case 'valid_till_expiry': {
                const year = getYear(sampleDate);
                periodEnd = new Date(year, 2, 31); // March 31st
                periodStart = periodEnd;
                periodDescription = `Based on event date (e.g., Mar 31, ${year})`;
                break;
            }
            default: // monthly
                periodStart = startOfMonth(subMonths(sampleDate, 1));
                periodEnd = endOfMonth(periodStart);
                periodDescription = format(periodStart, 'MMMM yyyy');
        }

        let anchorDate = anchor === 'period_start' ? periodStart : periodEnd;

        const monthsToAdd = Number(offsetMonths) || 0;
        const daysToAdd = Number(offsetDays) || 0;

        let dueDateWithMonthOffset = addMonths(anchorDate, monthsToAdd);
        let dueDate = addDays(dueDateWithMonthOffset, daysToAdd);

        const notificationDays = (notifyDaysBeforeInput || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const notificationDates = notificationDays.map(d => subDays(dueDate, d));
        const graceDaysNum = Number(graceDays) || 0;
        const l1Days = Number(escalation?.level1Days) || 0;
        const l2Days = Number(escalation?.level2Days) || 0;

        const l1Date = addDays(dueDate, graceDaysNum + l1Days);
        const l2Date = addDays(l1Date, l2Days);

        return {
            period: periodDescription,
            dueDate: format(dueDate, 'dd-MMM-yyyy'),
            notificationDates: notificationDates.map(d => format(d, 'dd-MMM')).join(', '),
            l1Date: format(l1Date, 'dd-MMM-yyyy'),
            l2Date: format(l2Date, 'dd-MMM-yyyy'),
        };
    }, [formValues]);

    if (!preview) {
        return null;
    }

    return (
        <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-4">
                <CardTitle className="text-base text-blue-800">Draft Date Preview</CardTitle>
                <CardDescription className="text-blue-600">
                    For the last completed period of {preview.period}:
                </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-blue-700 space-y-1">
                <p><strong className="font-semibold">Calculated Due Date:</strong> {preview.dueDate}</p>
                <p><strong className="font-semibold">Notification Dates:</strong> {preview.notificationDates || 'None'}</p>
                <p><strong className="font-semibold">Escalation L1:</strong> {preview.l1Date}</p>
                <p><strong className="font-semibold">Escalation L2:</strong> {preview.l2Date}</p>
                <p className="text-xs text-blue-500 pt-2">* This is a sample calculation assuming today is 22-Aug-2025 and does not account for holidays.</p>
            </CardContent>
        </Card>
    );
};

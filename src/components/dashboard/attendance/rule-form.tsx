'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Types ---
interface AttendanceConfig {
    shift: {
        startTime: string;
        endTime: string;
        minFullDayHours: number;
        minHalfDayHours: number;
        breakDurationMins?: number;
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

export interface AttendanceRule {
    id?: string;
    name: string;
    priority: number;
    effectiveFrom: number;
    effectiveTo: number | null;
    scope: {
        type: 'global' | 'department' | 'employee';
        entityIds: string[];
    };
    config: AttendanceConfig;
    isActive: boolean;
}

interface Employee {
    id: string; // Supabase/System ID
    userId: string; // EMPID
    fullName: string;
    department?: string;
}

// --- Schema ---
const ruleSchema = z.object({
    name: z.string().min(1, "Rule name is required"),
    priority: z.number().min(0),
    effectiveFrom: z.date(),
    effectiveTo: z.date().optional().nullable(),
    scopeType: z.enum(['global', 'department', 'employee']),
    entityIds: z.array(z.string()),
    isActive: z.boolean().default(true),
    // Config
    shiftStartTime: z.string(),
    shiftEndTime: z.string(),
    minFullDayHours: z.number().min(0),
    minHalfDayHours: z.number().min(0),
    breakDurationMins: z.number().min(0).optional(),
    lateEntryGraceMinutes: z.number().min(0),
    earlyExitGraceMinutes: z.number().min(0),
    monthlyLateMinutes: z.number().min(0),
    monthlyEarlyExitMinutes: z.number().min(0),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

interface RuleFormProps {
    initialData?: AttendanceRule | null;
    employees: Employee[];
    departments: string[];
    onSubmit: (data: AttendanceRule) => Promise<void>;
    onCancel: () => void;
}

export function RuleForm({ initialData, employees, departments, onSubmit, onCancel }: RuleFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [filteredEmployees, setFilteredEmployees] = React.useState<Employee[]>(employees);

    const form = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema),
        defaultValues: initialData ? {
            name: initialData.name,
            priority: initialData.priority,
            effectiveFrom: new Date(initialData.effectiveFrom),
            effectiveTo: initialData.effectiveTo ? new Date(initialData.effectiveTo) : null,
            scopeType: initialData.scope.type,
            entityIds: initialData.scope.entityIds || [],
            isActive: initialData.isActive ?? true,
            shiftStartTime: initialData.config.shift.startTime,
            shiftEndTime: initialData.config.shift.endTime,
            minFullDayHours: initialData.config.shift.minFullDayHours,
            minHalfDayHours: initialData.config.shift.minHalfDayHours,
            breakDurationMins: initialData.config.shift.breakDurationMins || 60,
            lateEntryGraceMinutes: initialData.config.rules.lateEntryGraceMinutes,
            earlyExitGraceMinutes: initialData.config.rules.earlyExitGraceMinutes,
            monthlyLateMinutes: initialData.config.credits.monthlyLateMinutes,
            monthlyEarlyExitMinutes: initialData.config.credits.monthlyEarlyExitMinutes,
        } : {
            name: '',
            priority: 10,
            effectiveFrom: new Date(),
            effectiveTo: null,
            scopeType: 'global',
            entityIds: [],
            isActive: true, // Default to true for new rules
            shiftStartTime: "09:30",
            shiftEndTime: "18:30",
            minFullDayHours: 9,
            minHalfDayHours: 5,
            breakDurationMins: 60,
            lateEntryGraceMinutes: 15,
            earlyExitGraceMinutes: 15,
            monthlyLateMinutes: 60,
            monthlyEarlyExitMinutes: 60,
        }
    });

    const scopeType = form.watch("scopeType");
    const entityIds = form.watch("entityIds");

    // Filter employees for search/select if needed (simple implementation for now)
    useEffect(() => {
        setFilteredEmployees(employees);
    }, [employees]);

    useEffect(() => {
        // Auto-adjust priority based on scope
        if (!initialData) { // Only for new rules
            if (scopeType === 'employee') form.setValue('priority', 50);
            else if (scopeType === 'department') form.setValue('priority', 30);
            else form.setValue('priority', 10);
        }
    }, [scopeType, initialData, form]);

    const handleSubmit = async (values: RuleFormValues) => {
        setIsSubmitting(true);
        try {
            const ruleData: AttendanceRule = {
                id: initialData?.id,
                name: values.name,
                priority: values.priority,
                effectiveFrom: values.effectiveFrom.getTime(),
                effectiveTo: values.effectiveTo ? values.effectiveTo.getTime() : null,
                isActive: values.isActive,
                scope: {
                    type: values.scopeType,
                    entityIds: values.scopeType === 'global' ? [] : values.entityIds,
                },
                config: {
                    shift: {
                        startTime: values.shiftStartTime,
                        endTime: values.shiftEndTime,
                        minFullDayHours: values.minFullDayHours,
                        minHalfDayHours: values.minHalfDayHours,
                        breakDurationMins: values.breakDurationMins
                    },
                    rules: {
                        lateEntryGraceMinutes: values.lateEntryGraceMinutes,
                        earlyExitGraceMinutes: values.earlyExitGraceMinutes,
                    },
                    credits: {
                        monthlyLateMinutes: values.monthlyLateMinutes,
                        monthlyEarlyExitMinutes: values.monthlyEarlyExitMinutes,
                    }
                }
            };
            await onSubmit(ruleData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleEntity = (id: string) => {
        const current = form.getValues('entityIds');
        const updated = current.includes(id)
            ? current.filter(item => item !== id)
            : [...current, id];
        form.setValue('entityIds', updated, { shouldValidate: true });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: Rule Meta & Scope */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Rule Details</h3>

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rule Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Sales Shift, Ramadan Timing" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="effectiveFrom"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Effective From</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date("1900-01-01")} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="effectiveTo"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Effective Until (Optional)</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>No Expiry</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} disabled={(date) => date < new Date("1900-01-01")} initialFocus />
                                                <div className="p-2 border-t text-center">
                                                    <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => field.onChange(null)}>Clear Date</Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <Separator />
                            <h4 className="text-sm font-medium">Scope & Assignment</h4>
                            <FormField
                                control={form.control}
                                name="scopeType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Apply To</FormLabel>
                                        <Select onValueChange={(val) => {
                                            field.onChange(val);
                                            form.setValue('entityIds', []); // Reset selection on type change
                                        }} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select scope" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="global">All Employees (Global)</SelectItem>
                                                <SelectItem value="department">Specific Departments</SelectItem>
                                                <SelectItem value="employee">Specific Employees</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>Global rules apply to everyone unless overridden by a more specific rule.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {scopeType === 'department' && (
                                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                                    <Label>Select Departments</Label>
                                    {departments.length === 0 && <p className="text-sm text-muted-foreground">No departments found.</p>}
                                    {departments.map(dept => (
                                        <div key={dept} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`dept-${dept}`}
                                                checked={entityIds.includes(dept)}
                                                onCheckedChange={() => toggleEntity(dept)}
                                            />
                                            <label htmlFor={`dept-${dept}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                {dept}
                                            </label>
                                        </div>
                                    ))}
                                    {entityIds.length === 0 && <p className="text-xs text-red-500">Please select at least one.</p>}
                                </div>
                            )}

                            {scopeType === 'employee' && (
                                <div className="border rounded-md max-h-60 overflow-hidden flex flex-col">
                                    <div className="p-2 border-b bg-slate-50 dark:bg-slate-900">
                                        <Label>Select Employees</Label>
                                    </div>
                                    <ScrollArea className="flex-1 p-2">
                                        <div className="space-y-2">
                                            {employees.length === 0 && <p className="text-sm text-muted-foreground">No employees found.</p>}
                                            {employees.map(emp => (
                                                <div key={emp.userId} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`emp-${emp.userId}`}
                                                        checked={entityIds.includes(emp.userId)}
                                                        onCheckedChange={() => toggleEntity(emp.userId)}
                                                    />
                                                    <label htmlFor={`emp-${emp.userId}`} className="text-sm leading-none cursor-pointer flex flex-col">
                                                        <span className="font-medium">{emp.fullName}</span>
                                                        <span className="text-xs text-muted-foreground">{emp.userId} • {emp.department || 'No Dept'}</span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <div className="p-2 border-t bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground flex justify-between">
                                        <span>{entityIds.length} selected</span>
                                        {entityIds.length === 0 && <span className="text-red-500">Required</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Priority Score</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                                    </FormControl>
                                    <FormDescription>Higher number = Higher priority. Used when multiple rules match.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Active Status</FormLabel>
                                        <FormDescription>Disable to temporarily turn off this rule.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                    </div>

                    {/* RIGHT COLUMN: Configuration Tabs */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Configuration</h3>
                        <Tabs defaultValue="shift" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="shift">Shift</TabsTrigger>
                                <TabsTrigger value="grace">Grace</TabsTrigger>
                                <TabsTrigger value="credits">Credits</TabsTrigger>
                            </TabsList>

                            {/* SHIFT */}
                            <TabsContent value="shift" className="space-y-4 border rounded-md p-4 mt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="shiftStartTime" render={({ field }) => (
                                        <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="shiftEndTime" render={({ field }) => (
                                        <FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="minFullDayHours" render={({ field }) => (
                                        <FormItem><FormLabel>Min Full Day (Hrs)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="minHalfDayHours" render={({ field }) => (
                                        <FormItem><FormLabel>Min Half Day (Hrs)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </TabsContent>

                            {/* GRACE */}
                            <TabsContent value="grace" className="space-y-4 border rounded-md p-4 mt-2">
                                <FormField control={form.control} name="lateEntryGraceMinutes" render={({ field }) => (
                                    <FormItem><FormLabel>Late Entry Grace (Mins)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormDescription>Mins after start time allowed before marked Late.</FormDescription><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="earlyExitGraceMinutes" render={({ field }) => (
                                    <FormItem><FormLabel>Early Exit Grace (Mins)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormDescription>Mins before end time allowed before marked Early Exit.</FormDescription><FormMessage /></FormItem>
                                )} />
                            </TabsContent>

                            {/* CREDITS */}
                            <TabsContent value="credits" className="space-y-4 border rounded-md p-4 mt-2">
                                <FormField control={form.control} name="monthlyLateMinutes" render={({ field }) => (
                                    <FormItem><FormLabel>Monthly Late Credit (Mins)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormDescription>Total allowed late minutes per month before penalty.</FormDescription><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="monthlyEarlyExitMinutes" render={({ field }) => (
                                    <FormItem><FormLabel>Monthly Early Exit Credit (Mins)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormDescription>Total allowed early exit minutes per month.</FormDescription><FormMessage /></FormItem>
                                )} />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <Separator />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? 'Update Rule' : 'Create Rule'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

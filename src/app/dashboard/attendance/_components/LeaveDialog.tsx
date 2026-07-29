'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Combobox } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, startOfDay, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { leaveTypes, leaveRequestSchema, LeaveRequestFormValues } from '../constants';

interface LeaveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LeaveDialog({ open, onOpenChange }: LeaveDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

    const leaveForm = useForm<LeaveRequestFormValues>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: {
            leaveType: '',
            duration: 'single',
            date: new Date(),
            reason: '',
        },
    });

    const durationWatcher = leaveForm.watch('duration');

    const handleOpenChange = (newOpen: boolean) => {
        onOpenChange(newOpen);
        if (!newOpen) {
            leaveForm.reset();
        }
    };

    const onLeaveSubmit: SubmitHandler<LeaveRequestFormValues> = async (data) => {
        if (!user) return;
        setIsSubmittingLeave(true);
        try {
            const leaveData: any = {
                employeeId: user.uid,
                leaveType: data.leaveType,
                duration: data.duration,
                reason: data.reason,
            };

            if (data.duration === 'single' || data.duration === 'half') {
                leaveData.leaveDate = format(data.date!, 'yyyy-MM-dd');
                if (data.duration === 'half') leaveData.halfDayType = data.halfDayType;
            } else if (data.duration === 'multiple') {
                leaveData.startDate = format(data.dateRange!.from!, 'yyyy-MM-dd');
                leaveData.endDate = format(data.dateRange!.to!, 'yyyy-MM-dd');
            }

            const response = await apiFetch('/api/attendance/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leaveData),
            });

            if (!response.ok) throw new Error('Failed to submit leave request');

            toast({ title: 'Leave Request Submitted', description: 'Your leave request has been sent for approval.' });
            handleOpenChange(false);
        } catch (err) {
            console.error(err);
            toast({ title: "Submission Failed", description: (err as Error).message, variant: "destructive" });
        } finally {
            setIsSubmittingLeave(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Apply Leave</DialogTitle>
                    <DialogDescription>Enter your leave details.</DialogDescription>
                </DialogHeader>
                <Form {...leaveForm}>
                    <form onSubmit={leaveForm.handleSubmit(onLeaveSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={leaveForm.control}
                            name="leaveType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Leave Type <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Combobox
                                            options={leaveTypes}
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select Type"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={leaveForm.control}
                            name="duration"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Duration <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex items-center space-x-4"
                                        >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="single" /></FormControl>
                                                <FormLabel className="font-normal">Single Day</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="multiple" /></FormControl>
                                                <FormLabel className="font-normal">Multiple Days</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="half" /></FormControl>
                                                <FormLabel className="font-normal">Half Day</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {durationWatcher === 'half' && (
                            <FormField
                                control={leaveForm.control}
                                name="halfDayType"
                                render={({ field }) => (
                                    <FormItem className="space-y-2 rounded-md border p-3">
                                        <FormLabel className="text-sm">Which Half? <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex items-center space-x-4"
                                            >
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="first-half" /></FormControl>
                                                    <FormLabel className="font-normal text-sm">First Half</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="second-half" /></FormControl>
                                                    <FormLabel className="font-normal text-sm">Second Half</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {(durationWatcher === 'single' || durationWatcher === 'half') && (
                            <FormField
                                control={leaveForm.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-medium h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all",
                                                            !field.value && "text-muted-foreground",
                                                            field.value && 'border-indigo-300 ring-1 ring-indigo-100'
                                                        )}
                                                    >
                                                        {field.value ? format(field.value, "dd MMMM yyyy") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 text-indigo-500 opacity-80" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[320px] p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date < startOfDay(new Date())}
                                                    initialFocus
                                                    className="p-4"
                                                    footer={
                                                        <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                type="button"
                                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 px-3"
                                                                onClick={() => field.onChange(new Date())}
                                                            >
                                                                Today
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                type="button"
                                                                className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 px-3"
                                                                onClick={() => field.onChange(undefined)}
                                                            >
                                                                Clear
                                                            </Button>
                                                        </div>
                                                    }
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {durationWatcher === 'multiple' && (
                            <FormField
                                control={leaveForm.control}
                                name="dateRange"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date Range <span className="text-destructive">*</span></FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        id="date"
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-medium h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all",
                                                            !field.value?.from && "text-muted-foreground",
                                                            field.value?.from && 'border-indigo-300 ring-1 ring-indigo-100'
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500 opacity-80" />
                                                        {field.value?.from ? (
                                                            field.value.to ? (
                                                                <>
                                                                    {format(field.value.from, "LLL dd, y")} -{" "}
                                                                    {format(field.value.to, "LLL dd, y")}
                                                                </>
                                                            ) : (
                                                                format(field.value.from, "LLL dd, y")
                                                            )
                                                        ) : (
                                                            <span>Pick a date range</span>
                                                        )}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[580px] p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={field.value?.from}
                                                    selected={field.value as DateRange}
                                                    onSelect={field.onChange}
                                                    numberOfMonths={2}
                                                    disabled={(date) => date < startOfDay(new Date())}
                                                    className="p-4"
                                                    footer={
                                                        <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                type="button"
                                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 px-3"
                                                                onClick={() => field.onChange({ from: new Date(), to: addDays(new Date(), 1) })}
                                                            >
                                                                Today
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                type="button"
                                                                className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 px-3"
                                                                onClick={() => field.onChange(undefined)}
                                                            >
                                                                Clear
                                                            </Button>
                                                        </div>
                                                    }
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={leaveForm.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Briefly explain the reason for your leave..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" className="min-w-[100px] rounded-xl">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmittingLeave} className="min-w-[140px] rounded-xl">
                                {isSubmittingLeave && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit Request
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

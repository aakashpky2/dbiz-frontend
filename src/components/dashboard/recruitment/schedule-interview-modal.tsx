"use client";

import React, { useState, useEffect } from "react";
import { DynamicFieldsSection } from "./dynamic-fields-section";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Video, MapPin, User, FileText } from "lucide-react";

const scheduleSchema = z.object({
    interview_date: z.string().min(1, "Date is required"),
    interview_time: z.string().min(1, "Time is required"),
    interview_mode: z.string().min(1, "Mode is required"),
    interviewer: z.string().min(1, "Interviewer name is required"),
    notes: z.string().optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

interface ScheduleInterviewModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    applicant: {
        id: string;
        name: string;
        position: string;
        job_title_id?: string;
    } | null;
    onSuccess: () => void;
}

export function ScheduleInterviewModal({ isOpen, onOpenChange, applicant, onSuccess }: ScheduleInterviewModalProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modes, setModes] = useState<{ id: string, name: string }[]>([]);

    const form = useForm<ScheduleFormValues>({
        resolver: zodResolver(scheduleSchema),
        defaultValues: {
            interview_date: "",
            interview_time: "",
            interview_mode: "",
            interviewer: "",
            notes: "",
        },
    });

    useEffect(() => {
        const fetchModes = async () => {
            const { data } = await supabase.from('interview_modes').select('id, name');
            if (data) setModes(data);
        };
        if (isOpen) {
            fetchModes();
            form.reset({
                interview_date: "",
                interview_time: "",
                interview_mode: "",
                interviewer: "",
                notes: "",
            });
        }
    }, [isOpen, form]);

    const onSubmit = async (data: ScheduleFormValues) => {
        if (!applicant) return;

        setIsSubmitting(true);
        try {
            // 1. Create Interview Record
            const { data: interview, error: interviewError } = await supabase
                .from('interviews')
                .insert([{
                    applicant_id: applicant.id,
                    job_title_id: applicant.job_title_id || null,
                    interview_date: data.interview_date,
                    interview_time: data.interview_time,
                    interview_mode: data.interview_mode,
                    interviewer: data.interviewer,
                    notes: data.notes,
                    status: 'Scheduled'
                }])
                .select()
                .single();

            if (interviewError) throw interviewError;

            // 2. Create Audit Log
            await supabase.from('interview_logs').insert([{
                interview_id: interview.id,
                action: 'Created',
                details: { ...data, applicant_name: applicant.name }
            }]);

            // 3. Update Applicant Status
            await supabase.from('applicants')
                .update({ status: 'Interview Scheduled' })
                .eq('id', applicant.id);

            toast({ title: "Interview Scheduled", description: `Interview with ${applicant.name} set for ${data.interview_date}.` });
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!applicant) return null;

    const today = new Date().toISOString().split('T')[0];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Schedule Interview
                    </DialogTitle>
                    <DialogDescription>
                        Set up an interview for <strong>{applicant.name}</strong> for the <strong>{applicant.position}</strong> position.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="interview_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" min={today} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="interview_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Time</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="interview_mode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mode</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select mode" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {modes.map(m => (
                                                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="interviewer"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Interviewer</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input className="pl-9" placeholder="Panelist Name" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Additional instructions or meeting link..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DynamicFieldsSection
                            formName="Interview Scheduling Form"
                            control={form.control}
                        />

                        <DialogFooter className="pt-4">
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Scheduling..." : "Schedule Interview"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

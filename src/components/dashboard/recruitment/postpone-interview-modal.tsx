"use client";

import React, { useState, useEffect } from "react";
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
import { Clock, AlertCircle } from "lucide-react";

const postponeSchema = z.object({
    postponed_by: z.string().min(1, "Selection is required"),
    postponement_reason: z.string().min(5, "A reason of at least 5 characters is required"),
    new_date: z.string().min(1, "New date is required"),
    new_time: z.string().min(1, "New time is required"),
});

type PostponeFormValues = z.infer<typeof postponeSchema>;

interface PostponeInterviewModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    interview: any | null;
    onSuccess: () => void;
}

export function PostponeInterviewModal({ isOpen, onOpenChange, interview, onSuccess }: PostponeInterviewModalProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PostponeFormValues>({
        resolver: zodResolver(postponeSchema),
        defaultValues: {
            postponed_by: "",
            postponement_reason: "",
            new_date: "",
            new_time: "",
        },
    });

    useEffect(() => {
        if (isOpen && interview) {
            form.reset({
                postponed_by: "",
                postponement_reason: "",
                new_date: interview.interview_date || "",
                new_time: interview.interview_time || "",
            });
        }
    }, [isOpen, interview, form]);

    const onSubmit = async (data: PostponeFormValues) => {
        if (!interview) return;

        setIsSubmitting(true);
        try {
            const oldDate = interview.interview_date;
            const oldTime = interview.interview_time;

            // 1. Update Interview Record
            const { error: interviewError } = await supabase
                .from('interviews')
                .update({
                    status: 'Postponed',
                    postponed_by: data.postponed_by,
                    postponement_reason: data.postponement_reason,
                    interview_date: data.new_date,
                    interview_time: data.new_time,
                })
                .eq('id', interview.id);

            if (interviewError) throw interviewError;

            // 2. Create Audit Log
            await supabase.from('interview_logs').insert([{
                interview_id: interview.id,
                action: 'Postponed',
                details: {
                    postponed_by: data.postponed_by,
                    reason: data.postponement_reason,
                    old_schedule: `${oldDate} ${oldTime}`,
                    new_schedule: `${data.new_date} ${data.new_time}`
                }
            }]);

            toast({ title: "Interview Postponed", description: `Updated for ${data.new_date}.` });
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!interview) return null;

    const today = new Date().toISOString().split('T')[0];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-600">
                        <Clock className="h-5 w-5" />
                        Postpone Interview
                    </DialogTitle>
                    <DialogDescription>
                        Mark interview for <strong>{interview.applicants?.name}</strong> as postponed and set a new schedule.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="postponed_by"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Postponed By</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Who requested this?" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Client">Client</SelectItem>
                                            <SelectItem value="Candidate">Candidate</SelectItem>
                                            <SelectItem value="Internal Team">Internal Team</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="postponement_reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason for Postponement</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Candidate requested new date due to travel commitments." className="h-20" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="bg-muted/30 p-3 rounded-lg border border-muted space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> New Schedule (Rescheduling)
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="new_date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">New Date</FormLabel>
                                            <FormControl>
                                                <Input type="date" min={today} className="h-8 text-xs" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="new_time"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">New Time</FormLabel>
                                            <FormControl>
                                                <Input type="time" className="h-8 text-xs" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" size="sm">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting} size="sm" className="bg-orange-600 hover:bg-orange-700">
                                {isSubmitting ? "Processing..." : "Confirm Postponement"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

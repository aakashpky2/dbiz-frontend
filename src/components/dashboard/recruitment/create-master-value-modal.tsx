"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
});

interface CreateMasterValueModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    categoryName: string;
    onSuccess: (newValue: string) => void;
    title?: string;
}

export function CreateMasterValueModal({
    isOpen,
    onOpenChange,
    categoryName,
    onSuccess,
    title,
}: CreateMasterValueModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "" },
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setIsSubmitting(true);
        try {
            // 1. Get Category ID
            const { data: catData, error: catError } = await supabase
                .from('recruitment_master_categories')
                .select('id')
                .eq('name', categoryName)
                .single();

            if (catError) throw catError;

            // 2. Insert New Value
            const { data: newVal, error: valError } = await supabase
                .from('recruitment_master_values')
                .insert([{ name: data.name, category_id: catData.id }])
                .select()
                .single();

            if (valError) throw valError;

            toast({ title: "Success", description: `"${data.name}" added to ${categoryName}.` });
            form.reset();
            onOpenChange(false);
            onSuccess(data.name); // Return name as it's used in current job openings schema
        } catch (err: any) {
            toast({
                title: "Save Failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Adding New {categoryName}
                    </DialogTitle>
                    <DialogDescription>
                        Enter the details for {categoryName}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder={`Enter ${categoryName.toLowerCase()} name...`} {...field} autoFocus />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="pt-4">
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Add Value
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDepartment } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
    name: z.string()
        .min(2, { message: "Department name must be at least 2 characters." })
        .max(50, "Department name cannot exceed 50 characters."),
    description: z.string().max(255, "Description cannot exceed 255 characters.").optional(),
});

interface AddDepartmentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddDepartmentDialog({ isOpen, onOpenChange }: AddDepartmentDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            description: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user) {
            toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDepartment(values.name, values.description || '', user.uid, user.displayName || 'Unknown User');
            toast({
                title: "Request Submitted",
                description: `Request to create department "${values.name}" has been sent for validation.`,
            });
            form.reset();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error creating department:", JSON.stringify(error, null, 2), error);
            if (error && error.message && error.message.includes("already exists")) {
                toast({ title: "Validation Error", description: error.message, variant: "destructive" });
            } else {
                toast({ title: "Error", description: error?.message || "Failed to submit request.", variant: "destructive" });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader className="border-b pb-4 shrink-0">
                    <DialogTitle className="text-xl">
                        Adding New Department
                    </DialogTitle>
                    <DialogDescription>
                        Enter the details for Department.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form id="add-dept-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-1 -mx-1 py-2 space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold text-sm">Department Name</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="e.g. Indirect Tax" 
                                            className="h-11 shadow-sm" 
                                            {...field} 
                                            maxLength={50}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold text-sm">Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Briefly describe the department's function..."
                                            className="min-h-[100px] shadow-sm resize-none"
                                            {...field}
                                            maxLength={255}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>

                <DialogFooter className="border-t pt-4 mt-4 shrink-0 flex gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="ghost" className="flex-1">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" form="add-dept-form" disabled={isSubmitting} className="flex-1 font-bold">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Department
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

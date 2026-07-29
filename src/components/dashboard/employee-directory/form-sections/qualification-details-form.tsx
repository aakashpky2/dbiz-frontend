'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GraduationCap, School, BookOpen, Plus, Trash2 } from 'lucide-react';

export const qualificationDetailsSchema = z.object({
    highestQualification: z.string().min(1, 'Qualification is required.'),
    institutionName: z.string()
        .min(1, 'Institution name is required.')
        .max(100, "Cannot exceed 100 characters."),
    specialization: z.string()
        .max(100, "Cannot exceed 100 characters.")
        .optional(),
});

export type QualificationDetailsFormValues = z.infer<typeof qualificationDetailsSchema>;

const qualifications = [
    { value: 'High School', label: 'High School / Secondary' },
    { value: 'Diploma', label: 'Diploma / Associate Degree' },
    { value: 'Bachelors', label: "Bachelor's Degree" },
    { value: 'Masters', label: "Master's Degree" },
    { value: 'PhD', label: 'PhD / Doctorate' },
    { value: 'Other', label: 'Other' },
];

export function QualificationDetailsForm() {
    const { control, formState: { errors } } = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control,
        name: "qualificationDetails"
    });

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-primary" /> Qualification Details
                    </CardTitle>
                    <CardDescription>Enter the employee's educational background.</CardDescription>
                </div>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ highestQualification: '', institutionName: '', specialization: '' })}
                    className="flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Add More
                </Button>
            </CardHeader>
            <CardContent className="space-y-8 px-0">
                {fields.map((field, index) => (
                    <div key={field.id} className="p-6 border rounded-xl bg-slate-50/50 relative group">
                        {fields.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={control}
                                name={`qualificationDetails.${index}.highestQualification`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Highest Qualification <span className="text-destructive">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className={cn(field.value && 'border-green-300')}>
                                                    <SelectValue placeholder="Select qualification" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {qualifications.map((q) => (
                                                    <SelectItem key={q.value} value={q.value}>
                                                        {q.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`qualificationDetails.${index}.institutionName`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name of Institution <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <School className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder="University / College / School" {...field} maxLength={100} className={cn("pl-9", field.value && 'border-green-300')} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <FormField
                                control={control}
                                name={`qualificationDetails.${index}.specialization`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Specialization / Major</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <BookOpen className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder="e.g., Computer Science, Business" {...field} value={field.value ?? ''} maxLength={100} className={cn("pl-9", field.value && 'border-green-300')} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

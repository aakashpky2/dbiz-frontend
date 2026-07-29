
'use client';

import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bloodGroups } from '@/lib/form-data';
import { PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const healthIssueSchema = z.object({
  name: z.string().min(1, 'Health issue name is required.').max(100, "Cannot exceed 100 characters."),
  details: z.string().max(255, "Cannot exceed 255 characters.").optional(),
});

export const medicalInfoSchema = z.object({
  bloodGroup: z.string().optional().or(z.literal('')),
  healthIssues: z.array(healthIssueSchema).optional(),
});

export type MedicalInfoFormValues = z.infer<typeof medicalInfoSchema>;

export function MedicalInfoForm() {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "medicalInfo.healthIssues",
  });

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Medical Information</CardTitle>
        <CardDescription>Provide health-related details for the employee.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        <FormField
          control={control}
          name="medicalInfo.bloodGroup"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Blood Group</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className={cn(field.value && 'border-green-300')}>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bloodGroups.map(group => (
                    <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Health Issues (if any)</FormLabel>
          <FormDescription className="mb-2">List any known health conditions or allergies.</FormDescription>
          {fields.map((item, index) => (
            <Card key={item.id} className="mb-4 p-4 border shadow-sm">
              <div className="space-y-4">
                <FormField
                  control={control}
                  name={`medicalInfo.healthIssues.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Health Issue Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Asthma, Allergy to Penicillin" {...field} maxLength={100} className={cn(field.value && 'border-green-300')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`medicalInfo.healthIssues.${index}.details`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Severity, medication, notes" {...field} maxLength={255} className={cn(field.value && 'border-green-300')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => remove(index)}
                className="mt-3"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove Issue
              </Button>
            </Card>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: '', details: '' })}
            className="mt-4"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Health Issue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


'use client';

import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const bankDetailsSchema = z.object({
    accountHolderName: z.string()
        .max(100, "Cannot exceed 100 characters.")
        .regex(/^[a-zA-Z\s.\-']*$/, "Name contains invalid characters.")
        .optional(),
    accountNumber: z.string()
        .max(20, "Cannot exceed 20 digits.")
        .regex(/^\d*$/, "Account number should only contain digits.")
        .optional(),
    ifscCode: z.string()
        .max(11, "IFSC code must be 11 characters.")
        .regex(/^[A-Z0-9]*$/, "IFSC code should be alphanumeric.")
        .optional(),
    bankBranch: z.string()
        .max(100, "Cannot exceed 100 characters.")
        .optional(),
});

export type BankDetailsFormValues = z.infer<typeof bankDetailsSchema>;

export function BankDetailsForm() {
  const { control } = useFormContext();

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Bank Account Details</CardTitle>
        <CardDescription>Provide the employee's bank information for salary processing. All fields are optional.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
            control={control}
            name="bankDetails.accountHolderName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Account Holder Name</FormLabel>
                <FormControl>
                    <Input 
                      placeholder="As per bank records" 
                      {...field} 
                      maxLength={100}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^a-zA-Z\s.\-']/g, '');
                        field.onChange(value);
                      }}
                      className={cn(field.value && 'border-green-300')} 
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={control}
            name="bankDetails.accountNumber"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Bank Account Number</FormLabel>
                <FormControl>
                    <Input 
                      placeholder="Enter account number" 
                      {...field} 
                      maxLength={20}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value);
                      }}
                      className={cn(field.value && 'border-green-300')} 
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
            control={control}
            name="bankDetails.ifscCode"
            render={({ field }) => (
                <FormItem>
                <FormLabel>IFSC Code</FormLabel>
                <FormControl>
                    <Input 
                      placeholder="Enter IFSC code" 
                      {...field} 
                      maxLength={11}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        field.onChange(value);
                      }}
                      className={cn(field.value && 'border-green-300')} 
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={control}
            name="bankDetails.bankBranch"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Bank Branch</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Main Branch, Cityville" {...field} maxLength={100} className={cn(field.value && 'border-green-300')} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
      </CardContent>
    </Card>
  );
}

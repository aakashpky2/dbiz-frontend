'use client';

import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { HeartPulse, User, Users } from 'lucide-react';
import { PhoneInput } from '@/components/ui/phone-input';
import { sanitizePhoneInput, isValidLocalPhone } from '@/lib/phone-utils';

export const emergencyContactSchema = z.object({
  primaryContact: z.object({
    name: z.string().min(1, 'Name is required.').max(50, "Name cannot exceed 50 characters."),
    relation: z.string().min(1, 'Relation is required.').max(30, "Relation cannot exceed 30 characters."),
    phoneNumber: z.string()
      .min(1, "Phone number is required.")
      .refine(val => isValidLocalPhone(val), { message: "Phone number must be exactly 10 digits" }),
    countryCode: z.string().min(1, "Country code is required."),
  }),
  secondaryContact: z.object({
    name: z.string().max(50, "Name cannot exceed 50 characters.").optional(),
    relation: z.string().max(30, "Relation cannot exceed 30 characters.").optional(),
    phoneNumber: z.string()
      .refine(val => !val || isValidLocalPhone(val), { message: "Phone number must be exactly 10 digits" })
      .optional(),
    countryCode: z.string().optional(),
  }).optional(),
});

export type EmergencyContactFormValues = z.infer<typeof emergencyContactSchema>;

export function EmergencyContactForm() {
  const { control, watch, setValue, clearErrors } = useFormContext();

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" /> Emergency Contact Details
        </CardTitle>
        <CardDescription>Enter contact information for emergency situations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 px-0">
        {/* Primary Contact */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <User className="h-4 w-4" /> Primary Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="emergencyContact.primaryContact.name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} maxLength={50} className={cn(field.value && 'border-green-300')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="emergencyContact.primaryContact.relation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relation <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Father, Spouse" {...field} maxLength={30} className={cn(field.value && 'border-green-300')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="emergencyContact.primaryContact.phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <PhoneInput 
                      value={field.value} 
                      countryCode={watch('emergencyContact.primaryContact.countryCode')}
                      onCountryCodeChange={(code) => setValue('emergencyContact.primaryContact.countryCode', code, { shouldValidate: true })}
                      onChange={(val) => {
                        const digits = sanitizePhoneInput(val);
                        field.onChange(digits);
                        if (isValidLocalPhone(digits)) {
                          clearErrors('emergencyContact.primaryContact.phoneNumber');
                        }
                      }}
                      className={cn(field.value && 'border-green-300')} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Secondary Contact */}
        <div className="space-y-6 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4" /> Secondary Contact (Optional)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="emergencyContact.secondaryContact.name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Mary Doe" {...field} value={field.value ?? ''} maxLength={50} className={cn(field.value && 'border-green-300')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="emergencyContact.secondaryContact.relation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relation</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sister, Friend" {...field} value={field.value ?? ''} maxLength={30} className={cn(field.value && 'border-green-300')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="emergencyContact.secondaryContact.phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <PhoneInput 
                      value={field.value} 
                      countryCode={watch('emergencyContact.secondaryContact.countryCode')}
                      onCountryCodeChange={(code) => setValue('emergencyContact.secondaryContact.countryCode', code, { shouldValidate: true })}
                      onChange={(val) => {
                        const digits = sanitizePhoneInput(val);
                        field.onChange(digits);
                        if (!digits || isValidLocalPhone(digits)) {
                          clearErrors('emergencyContact.secondaryContact.phoneNumber');
                        }
                      }}
                      className={cn(field.value && 'border-green-300')} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

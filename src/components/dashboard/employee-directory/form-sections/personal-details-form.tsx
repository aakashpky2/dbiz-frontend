'use client';

import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


import { CalendarDays, Camera, UserCircle } from 'lucide-react';

import { genders, maritalStatuses } from '@/lib/form-data';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PhoneInput } from '@/components/ui/phone-input';
import { sanitizePhoneInput, isValidLocalPhone } from '@/lib/phone-utils';
import { useToast } from '@/hooks/use-toast';


export const personalDetailsSchema = z.object({
  fullName: z.string()
    .min(1, { message: 'Full name is required.' })
    .max(50, { message: 'Full name cannot exceed 50 characters.' })
    .regex(/^[a-zA-Z\s.\-']+$/, { message: 'Full name contains invalid characters.' }),
  email: z.string()
    .email({ message: 'Invalid email address.' })
    .max(100, { message: 'Email cannot exceed 100 characters.' }),
  phone: z.string()
    .min(1, "Phone number is required.")
    .refine(val => isValidLocalPhone(val), { message: "Phone number must be exactly 10 digits" }),
  phoneCountryCode: z.string().min(1, "Country code is required."),
  photo: z.string().nullable().optional(),
  dateOfBirth: z.date().optional().refine(date => !date || date <= new Date(), {
    message: "Date of birth cannot be in the future."
  }).refine(date => !date || date.getFullYear() >= 1900, {
    message: "Year of birth must be 1900 or later."
  }),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  joiningDate: z.date({
    required_error: "Joining date is required.",
    invalid_type_error: "Please select a valid joining date."
  }),
});

export type PersonalDetailsFormValues = z.infer<typeof personalDetailsSchema>;

interface PersonalDetailsFormProps {
  onPhotoChange: (previewUrl: string | null) => void;
  onNameChange: (name: string) => void;
  existingPhoto?: string | null;
}

// --- Date Input Component (Local to match AddWorkDialog style) ---
const DateInput = ({
  value,
  onChange,
  className,
  max,
  min
}: {
  value: Date | undefined | null,
  onChange: (val: Date | undefined) => void,
  className?: string,
  max?: Date,
  min?: Date
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    inputRef.current?.focus();
    // @ts-ignore - showPicker is a newer API
    inputRef.current?.showPicker?.();
  };

  // Convert Date to YYYY-MM-DD string for input type="date"
  const dateValue = value instanceof Date && !isNaN(value.getTime())
    ? value.toISOString().split('T')[0]
    : "";

  const minStr = min instanceof Date ? min.toISOString().split('T')[0] : undefined;
  const maxStr = max instanceof Date ? max.toISOString().split('T')[0] : undefined;

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="date"
        value={dateValue}
        max={maxStr}
        min={minStr}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? new Date(val) : undefined);
        }}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
        tabIndex={-1}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
    </div>
  );
};

export function PersonalDetailsForm({ onPhotoChange, onNameChange, existingPhoto }: PersonalDetailsFormProps) {
  const { control, watch, setValue, clearErrors, formState: { errors } } = useFormContext();
  const { toast } = useToast();
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null);

  const fullName = watch('personalDetails.fullName');

  useEffect(() => {
    onNameChange(fullName || '');
  }, [fullName, onNameChange]);

  useEffect(() => {
    if (existingPhoto) {
      setLocalPhotoPreview(existingPhoto);
      onPhotoChange(existingPhoto);
    }
  }, [existingPhoto, onPhotoChange]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultUrl = reader.result as string;
        setValue('personalDetails.photo', resultUrl, { shouldValidate: true });
        setLocalPhotoPreview(resultUrl);
        onPhotoChange(resultUrl);
      };
      reader.readAsDataURL(file);
    } else {
      setValue('personalDetails.photo', null, { shouldValidate: true });
      setLocalPhotoPreview(null);
      onPhotoChange(null);
    }
  };

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Personal Details</CardTitle>
        <CardDescription>Enter the basic information for the employee. Fields marked with <span className="text-destructive">*</span> are required.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <FormField
              control={control}
              name="personalDetails.fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Jane Doe"
                      {...field}
                      value={field.value ?? ''}
                      maxLength={50}
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
              name="personalDetails.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="employee@example.com" {...field} value={field.value ?? ''} maxLength={100} className={cn(field.value && 'border-green-300')} />
                  </FormControl>
                  <FormDescription>Must be unique.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="personalDetails.photo"
            render={({ fieldState }) => (
              <FormItem className="flex flex-col items-center">
                <FormLabel className="w-full text-left md:text-center mb-2">Profile Picture</FormLabel>
                <FormControl>
                  <div className="relative group cursor-pointer">
                    <Avatar className="w-32 h-32 border-4 border-background shadow-lg group-hover:shadow-xl transition-all duration-300">
                      <AvatarImage src={localPhotoPreview || ''} className="object-cover" />
                      <AvatarFallback className="bg-muted text-muted-foreground text-4xl">
                        {fullName ? fullName.charAt(0).toUpperCase() : <UserCircle className="w-16 h-16" />}
                      </AvatarFallback>
                    </Avatar>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Camera className="w-8 h-8 text-white" />
                    </div>

                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </FormControl>
                <FormDescription className="mt-2">Click to upload</FormDescription>
                {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <FormField
            control={control}
            name="personalDetails.phone"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value}
                    countryCode={watch('personalDetails.phoneCountryCode')}
                    onCountryCodeChange={(code) => setValue('personalDetails.phoneCountryCode', code, { shouldValidate: true })}
                    onChange={(val) => {
                      const digits = sanitizePhoneInput(val);
                      field.onChange(digits);
                      if (isValidLocalPhone(digits)) {
                        clearErrors('personalDetails.phone');
                      }
                    }}
                    className={cn(field.value && 'border-green-300')}
                  />
                </FormControl>
                <FormMessage />
                <FormDescription>Must be unique.</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="personalDetails.dateOfBirth"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                  Date of Birth
                </FormLabel>

                <FormControl>
                  <DateInput
                    value={field.value}
                    onChange={(val: Date | undefined) => {
                      if (val && val > new Date()) {
                        toast({
                          title: "Invalid Date",
                          description: "Future dates are not allowed.",
                          variant: "destructive",
                        });
                        return;
                      }

                      if (val && val.getFullYear() < 1900) {
                        toast({
                          title: "Invalid Date",
                          description: "Year must be after 1900.",
                          variant: "destructive",
                        });
                        return;
                      }

                      field.onChange(val);
                    }}
                    max={new Date()}
                    className={cn(
                      "h-11 text-sm font-bold border-gray-200 bg-white shadow-none rounded-xl focus:border-indigo-300 transition-all",
                      field.value && "border-indigo-300"
                    )}
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
            name="personalDetails.gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Gender</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className={cn("h-11 rounded-xl", field.value && 'border-green-300')}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {genders.map(gender => (
                      <SelectItem key={gender.value} value={gender.value}>{gender.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="personalDetails.maritalStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Marital Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className={cn("h-11 rounded-xl", field.value && 'border-green-300')}>
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {maritalStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={control}
            name="personalDetails.joiningDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Joining Date <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <DateInput
                    value={field.value}
                    onChange={(val: Date | undefined) => {
                      field.onChange(val);
                    }}
                    className={cn(
                      "h-11 text-sm font-bold border-gray-200 bg-white shadow-none rounded-xl focus:border-indigo-300 transition-all",
                      field.value && "border-indigo-300"
                    )}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="hidden md:block" />
        </div>

      </CardContent>
    </Card>
  );
}

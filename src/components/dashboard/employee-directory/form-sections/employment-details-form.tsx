
'use client';

import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { addYears } from 'date-fns';
import { addMonths } from 'date-fns';
import { weekDays } from '@/lib/form-data';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

// Helper to compare HH:MM time strings
const isTimeAfter = (start: string, end: string) => {
  if (!start || !end) return true;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  if (isNaN(startH) || isNaN(endH)) return true;
  return endH > startH || (endH === startH && endM > startM);
};

export const employmentDetailsSchema = z.object({
  employeeId: z.string().optional(),
  employeeRole: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentTermYears: z.coerce.number().min(0, 'Years must be 0 or more.').default(0),
  employmentTermMonths: z.coerce.number().min(0, 'Months must be 0-11.').max(11, 'Months must be 0-11.').default(0),
  monthlySalary: z.coerce.number().min(0, 'Salary cannot be negative.').default(0),
  casualLeavesPerMonth: z.coerce.number().min(0, 'Cannot be negative.').default(1),
  sickLeavesPerMonth: z.coerce.number().min(0, 'Cannot be negative.').default(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid format (HH:MM).').default('09:30'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid format (HH:MM).').default('17:30'),
  workingDays: z.array(z.string()).default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  relievingDate: z.date().optional(),
})
.superRefine((data, ctx) => {
  if (data.startTime && data.endTime && !isTimeAfter(data.startTime, data.endTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End time must be after start time",
      path: ["endTime"],
    });
  }
});

export type EmploymentDetailsFormValues = z.infer<typeof employmentDetailsSchema>;

export function EmploymentDetailsForm({ isEditing, prefix = "" }: { isEditing: boolean, prefix?: string }) {
  const { control, watch, setValue, formState: { errors } } = useFormContext();
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [systemRoles, setSystemRoles] = useState<{ id: string, name: string }[]>([]);

  const fieldName = useCallback((name: string) => prefix ? `${prefix}.${name}` : name, [prefix]);

  const joiningDate = watch(fieldName('joiningDate'));
  const termYears = watch(fieldName('employmentTermYears'));
  const termMonths = watch(fieldName('employmentTermMonths'));
  const correctError = watch(fieldName('correctError'));

  useEffect(() => {
    setLoadingRoles(true);
    setRoleError(null);
    supabase.from('system_roles')
      .select('id, name')
      .then(({ data, error }) => {
        if (error) {
          console.error("Supabase Role Fetch Error:", error);
          setRoleError("Failed to fetch system roles.");
        } else {
          setSystemRoles((data || []).map((r: any) => ({ id: r.id, name: r.name })));
        }
        setLoadingRoles(false);
      });
  }, []);

  useEffect(() => {
    const years = Number(termYears) || 0;
    const months = Number(termMonths) || 0;

    if (joiningDate && (years > 0 || months > 0)) {
      let RDate = new Date(joiningDate);
      if (years > 0) RDate = addYears(RDate, years);
      if (months > 0) RDate = addMonths(RDate, months);
      setValue(fieldName('relievingDate'), RDate, { shouldValidate: true });
    } else {
      setValue(fieldName('relievingDate'), undefined, { shouldValidate: true });
    }
  }, [joiningDate, termYears, termMonths, setValue, prefix, fieldName]);

  const relievingDate = watch(fieldName('relievingDate'));
  const selectedWorkingDays = watch(fieldName('workingDays'), []);

  const toggleWorkingDay = (day: string) => {
    const currentDays = Array.isArray(selectedWorkingDays) ? selectedWorkingDays : [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d: string) => d !== day)
      : [...currentDays, day];
    setValue(fieldName('workingDays'), newDays, { shouldValidate: true });
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="space-y-10 px-0 pb-0">
        {isEditing && (
          <FormField
            control={control}
            name={fieldName('correctError')}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-[20px] border p-4 bg-amber-50/50 border-amber-200/50 transition-all hover:bg-amber-50">
                <FormControl>
                  <Checkbox
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-bold text-amber-900 cursor-pointer flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Correct Data Entry Error
                  </FormLabel>
                  <FormDescription className="text-amber-700/70 text-[10px] font-medium">
                    Enable this to modify Salary and Role fields for existing records.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        )}

        {/* Section 1: Position & Identity */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">1. Position & Identity</Badge>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name={fieldName('employeeId')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
                    Employee ID
                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-slate-200 text-slate-400 font-medium">Locked</Badge>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Generating..." 
                      {...field} 
                      value={field.value ?? ''}
                      readOnly
                      className={cn(
                        "h-11 rounded-xl bg-slate-50 border-slate-200 cursor-not-allowed font-bold text-slate-700 transition-all focus:ring-0",
                        field.value && 'border-blue-200 bg-blue-50/20'
                      )} 
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={fieldName('employeeRole')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">System Role <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""} disabled={(isEditing && !correctError) || loadingRoles}>
                    <FormControl>
                      <SelectTrigger className={cn("h-11 rounded-xl bg-white transition-all", field.value && 'border-green-300 bg-green-50/10')}>
                        {loadingRoles ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Loading roles...</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Select system role" />
                        )}
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl border-slate-200">
                      {systemRoles.length > 0 ? (
                        systemRoles.map(role => (
                          <SelectItem key={role.id} value={role.name} className="text-sm focus:bg-slate-50">{role.name}</SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground italic">
                          {roleError || "No roles available"}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name={fieldName('jobTitle')}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Designation / Job Role <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Senior Software Engineer" 
                    {...field} 
                    value={field.value ?? ''}
                    maxLength={100} 
                    className={cn("h-11 rounded-xl bg-white transition-all", field.value && 'border-green-300 bg-green-50/10')} 
                  />
                </FormControl>
                <FormMessage className="text-[10px] font-bold" />
              </FormItem>
            )}
          />
        </div>

        {/* Section 2: Compensation & Policy */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">2. Compensation & Policy</Badge>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={control}
              name={fieldName('monthlySalary')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Monthly Salary (INR)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} 
                        className={cn("h-11 rounded-xl bg-white pl-7 transition-all", (field.value !== '' && field.value !== undefined) && 'border-green-300 bg-green-50/10')} 
                        disabled={isEditing && !correctError} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={fieldName('casualLeavesPerMonth')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Casual Leaves/mo</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 1" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} 
                      className={cn("h-11 rounded-xl bg-white transition-all", (field.value !== '' && field.value !== undefined) && 'border-green-300 bg-green-50/10')} 
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={fieldName('sickLeavesPerMonth')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Sick Leaves/mo</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 1" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} 
                      className={cn("h-11 rounded-xl bg-white transition-all", (field.value !== '' && field.value !== undefined) && 'border-green-300 bg-green-50/10')} 
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Section 3: Contract Terms */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">3. Contract Terms</Badge>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <FormField
              control={control}
              name={fieldName('employmentTermYears')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Term (Years)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} 
                      className={cn("h-11 rounded-xl bg-white transition-all", (field.value !== '' && field.value !== undefined) && 'border-green-300 bg-green-50/10')} 
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={fieldName('employmentTermMonths')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Term (Months)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0-11" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} 
                      className={cn("h-11 rounded-xl bg-white transition-all", (field.value !== '' && field.value !== undefined) && 'border-green-300 bg-green-50/10')} 
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
            <div className="flex flex-col space-y-2">
              <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                Relieving Date
                <Info className="w-3 h-3 text-slate-300" />
              </FormLabel>
              <div className={cn(
                "h-11 rounded-xl px-4 flex items-center font-bold text-xs border border-slate-100 bg-slate-50 text-slate-500 transition-all",
                relievingDate && "bg-blue-50/30 border-blue-100 text-blue-700 shadow-inner"
              )}>
                {relievingDate ? format(relievingDate, "dd MMM, yyyy") : 'Permanent / No fixed term'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Working Hours & Days */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">4. Working Hours & Days</Badge>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name={fieldName('startTime')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Work Start Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} value={field.value ?? ''} className={cn("h-11 rounded-xl bg-white transition-all", field.value && 'border-green-300 bg-green-50/10')} />
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={fieldName('endTime')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Work End Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} value={field.value ?? ''} className={cn("h-11 rounded-xl bg-white transition-all", field.value && 'border-green-300 bg-green-50/10')} />
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name={fieldName('workingDays')}
            render={() => (
              <FormItem className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Working Days <span className="text-destructive">*</span></FormLabel>
                    <FormDescription className="text-[10px] font-medium mt-0.5">Select regular working days.</FormDescription>
                  </div>
                  <Badge variant="secondary" className="bg-white text-primary border-slate-200 font-bold text-[10px]">
                    {selectedWorkingDays.length} Selected
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {weekDays.map(day => (
                    <Badge
                      key={day.value}
                      variant={selectedWorkingDays.includes(day.value) ? 'default' : 'outline'}
                      onClick={() => toggleWorkingDay(day.value)}
                      className={cn(
                        "cursor-pointer px-4 py-2 text-xs transition-all active:scale-95 select-none rounded-xl font-bold",
                        selectedWorkingDays.includes(day.value) 
                          ? "bg-primary shadow-md shadow-primary/20 border-primary" 
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {day.label}
                    </Badge>
                  ))}
                </div>
                <FormMessage className="text-[10px] font-bold mt-4" />
              </FormItem>
            )}
          />
        </div>

        {/* Global Errors */}
        {(errors as any)?.[prefix ? `${prefix}.workingDays` : 'workingDays'] && (
          <div className="flex items-center gap-3 p-4 bg-destructive/5 border border-destructive/10 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-xs font-bold text-destructive">Please select at least one working day.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

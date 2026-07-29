import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel as RHFFormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Edit, PlusCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LeaveRequestDialogProps {
  isFormDialogOpen: boolean;
  setIsFormDialogOpen: (v: boolean) => void;
  editingLeave: any;
  setEditingLeave: (v: any) => void;
  form: any;
  handleFormSubmit: (data: any) => void;
  employees: any[];
  canManageLeaves: boolean;
  leaveTypes: any[];
  isSubmitting: boolean;
}

export function LeaveRequestDialog({
  isFormDialogOpen,
  setIsFormDialogOpen,
  editingLeave,
  setEditingLeave,
  form,
  handleFormSubmit,
  employees,
  canManageLeaves,
  leaveTypes,
  isSubmitting,
}: LeaveRequestDialogProps) {
  const durationWatcher = form.watch('duration');

  return (
    <Dialog open={isFormDialogOpen} onOpenChange={(v) => { setIsFormDialogOpen(v); if (!v) setEditingLeave(null); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b pb-4 shrink-0">
          <DialogTitle className="text-xl">
            {editingLeave ? 'Editing Leave Request' : 'Adding New Leave Request'}
          </DialogTitle>
          <DialogDescription>
            {editingLeave ? 'Update the details of this item.' : 'Enter the details for Leave Request.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1 -mx-1">
          <Form {...form}>
            <form id="leave-request-form" onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem>
                    <RHFFormLabel className="font-bold text-slate-700">Identity <span className="text-rose-500">*</span></RHFFormLabel>
                    <Combobox
                      options={employees.map(e => ({ value: e.id, label: e.name }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select an employee..."
                      searchPlaceholder="Search employees..."
                      disabled={!canManageLeaves}
                    />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leaveType" render={({ field }) => (
                  <FormItem>
                    <RHFFormLabel className="font-bold text-slate-700">Classification <span className="text-rose-500">*</span></RHFFormLabel>
                    <Combobox options={leaveTypes} value={field.value} onChange={field.onChange} placeholder="Select Intent" />
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Separator className="bg-slate-100" />

              <FormField control={form.control} name="duration" render={({ field }) => (
                <FormItem className="space-y-4">
                  <RHFFormLabel className="font-bold text-slate-700">Duration Schema <span className="text-rose-500">*</span></RHFFormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'single', label: 'Single Day', desc: 'Full 24h work cycle' },
                        { value: 'multiple', label: 'Date Range', desc: 'Extended period' },
                        { value: 'half', label: 'Half Day', desc: 'AM or PM shift' }
                      ].map((item) => (
                        <FormItem key={item.value}>
                          <RHFFormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                            <FormControl>
                              <RadioGroupItem value={item.value} className="sr-only" />
                            </FormControl>
                            <div className="border-2 border-slate-100 rounded-xl p-3 text-center transition-all hover:border-primary/50">
                              <p className="font-bold text-sm text-slate-800">{item.label}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{item.desc}</p>
                            </div>
                          </RHFFormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/60">
                {durationWatcher === 'half' && (
                  <FormField control={form.control} name="halfDayType" render={({ field }) => (
                    <FormItem className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100 animate-in slide-in-from-top-2 mb-4">
                      <RHFFormLabel className="text-sm font-bold text-amber-900">Selection of Half <span className="text-rose-500">*</span></RHFFormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                          <FormItem className="flex items-center space-x-2 space-y-0 text-amber-800">
                            <FormControl><RadioGroupItem value="first-half" className="border-amber-400" /></FormControl>
                            <RHFFormLabel className="font-semibold text-sm">Morning (09:00 - 13:30)</RHFFormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0 text-amber-800">
                            <FormControl><RadioGroupItem value="second-half" className="border-amber-400" /></FormControl>
                            <RHFFormLabel className="font-semibold text-sm">Afternoon (14:30 - 18:30)</RHFFormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {(durationWatcher === 'single' || durationWatcher === 'half') && (
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <RHFFormLabel className="font-bold text-slate-700">Effective Date <span className="text-rose-500">*</span></RHFFormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal h-11 border-slate-200", !field.value && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                              {field.value ? format(field.value, "EEEE, dd MMMM yyyy") : <span>Pick a point in time</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="rounded-xl" />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {durationWatcher === 'multiple' && (
                  <FormField control={form.control} name="dateRange" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <RHFFormLabel className="font-bold text-slate-700">Interval Span <span className="text-rose-500">*</span></RHFFormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-11 border-slate-200", !field.value?.from && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                              {field.value?.from ? (
                                field.value.to ? (
                                  <span className="font-semibold">{format(field.value.from, "MMM dd, y")} - {format(field.value.to, "MMM dd, y")}</span>
                                ) : (
                                  format(field.value.from, "MMM dd, y")
                                )
                              ) : (
                                <span>Designate range span</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                          <Calendar initialFocus mode="range" defaultMonth={field.value?.from} selected={field.value as DateRange} onSelect={field.onChange} numberOfMonths={2} className="rounded-xl" />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <RHFFormLabel className="font-bold text-slate-700">Justification & Remarks <span className="text-rose-500">*</span></RHFFormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Clarify the professional or personal necessity for this absence..."
                      className="min-h-[120px] border-slate-200 focus:ring-primary/20 resize-none px-4 py-3"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {editingLeave && canManageLeaves && (
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <RHFFormLabel className="font-bold text-slate-700">Review Status</RHFFormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 border-slate-200 font-semibold">
                          <SelectValue placeholder="Update status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Pending" className="text-amber-600 font-bold">● Pending Review</SelectItem>
                        <SelectItem value="Approved" className="text-emerald-600 font-bold">● Approve Departure</SelectItem>
                        <SelectItem value="Rejected" className="text-rose-600 font-bold">● Decline Request</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </form>
          </Form>
        </div>
        <DialogFooter className="border-t pt-4 mt-4 shrink-0 flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="flex-1">Cancel</Button>
          </DialogClose>
          <Button form="leave-request-form" type="submit" disabled={isSubmitting} className="flex-1 font-bold">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingLeave ? 'Save Changes' : 'Add Leave Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

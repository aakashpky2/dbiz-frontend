import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface HolidayDialogProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (v: boolean) => void;
  editingHoliday: any;
  setEditingHoliday: (v: any) => void;
  form: any;
  handleFormSubmit: (data: any) => void;
  isSubmitting: boolean;
  employees: any[];
  states: any[];
}

export function HolidayDialog({
  isDialogOpen,
  setIsDialogOpen,
  editingHoliday,
  setEditingHoliday,
  form,
  handleFormSubmit,
  isSubmitting,
  employees,
  states,
}: HolidayDialogProps) {
  const selectedType = form.watch('type');

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => {
      if (!open) {
        setIsDialogOpen(false);
        setEditingHoliday(null);
        form.reset({ name: '', date: new Date(), type: 'General', employeeId: '', state: '', district: '' });
      } else {
        setIsDialogOpen(true);
      }
    }}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b pb-4 shrink-0">
          <DialogTitle className="text-xl">{editingHoliday ? `Editing "${editingHoliday.name || 'Holiday'}"` : 'Adding New Holiday'}</DialogTitle>
          <DialogDescription>
            {editingHoliday ? 'Update the details for this holiday.' : 'Fill in the details for the new holiday.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1 -mx-1">
          <Form {...form}>
            <form id="holiday-form" onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Holiday Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., New Year's Day" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="Select a date"
                              value={field.value ? format(field.value, 'PPP') : ''}
                              readOnly
                              className="w-full pl-3 pr-10 text-left font-normal cursor-pointer"
                            />
                            <CalendarIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                          </div>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        side="bottom"
                        sideOffset={5}
                        collisionPadding={10}
                        sticky="partial"
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select holiday type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Leave with Pay">Leave with Pay</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedType === 'Leave with Pay' && (
                <div className="space-y-4 border-l-2 border-primary/30 pl-4 py-2 animate-in slide-in-from-left-2 duration-300">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leave Allocation Scope</p>

                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Specific Employee (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="All Employees" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">All Employees</SelectItem>
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">State (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="All States" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">All States</SelectItem>
                              {states.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">District (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Chennai" className="h-9" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Leave will be applied based on the employee's residential region or specific profile match.
                  </p>
                </div>
              )}
            </form>
          </Form>
        </div>
        <DialogFooter className="border-t pt-4 mt-4 shrink-0 flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="flex-1" onClick={() => {
              setIsDialogOpen(false);
              setEditingHoliday(null);
              form.reset({ name: '', date: new Date(), type: 'General', employeeId: '', state: '', district: '' });
            }}>Cancel</Button>
          </DialogClose>
          <Button form="holiday-form" type="submit" disabled={isSubmitting} className="flex-1 font-bold">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingHoliday ? 'Save Changes' : 'Add Holiday'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

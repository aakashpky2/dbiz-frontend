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

interface PromotionsDialogProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (val: boolean) => void;
  selectedEmployee: any;
  form: any;
  handleFormSubmit: (data: any) => void;
  isSubmitting: boolean;
  systemRoles: { id: string; name: string }[];
}

export function PromotionsDialog({
  isDialogOpen,
  setIsDialogOpen,
  selectedEmployee,
  form,
  handleFormSubmit,
  isSubmitting,
  systemRoles,
}: PromotionsDialogProps) {
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b pb-4 shrink-0">
          <DialogTitle className="text-xl">Editing "Employee Promotion"</DialogTitle>
          <DialogDescription>
            Current Role: {selectedEmployee?.currentRole} | Current Salary: ₹{selectedEmployee?.currentSalary?.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1 -mx-1">
          <Form {...form}>
            <form id="promotions-form" onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="newSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Monthly Salary (INR)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select new role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {systemRoles.map(role => (
                          <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Effective From</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={`w-full justify-start text-left font-normal`}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter className="border-t pt-4 mt-4 shrink-0 flex gap-2">
          <DialogClose asChild><Button type="button" variant="ghost" className="flex-1">Cancel</Button></DialogClose>
          <Button form="promotions-form" type="submit" disabled={isSubmitting} className="flex-1 font-bold">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

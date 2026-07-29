import React from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Department } from "../../constants";

interface BasicDetailsTabProps {
  editForm: any;
  departments: Department[];
  onBasicDetailsSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  setIsOpen: (val: boolean) => void;
}

export function BasicDetailsTab({
  editForm,
  departments,
  onBasicDetailsSubmit,
  isSubmitting,
  setIsOpen
}: BasicDetailsTabProps) {
  return (
    <div className="bg-card rounded-md border p-6">
      <h3 className="text-lg font-medium mb-4">Departmental Access</h3>
      <Form {...editForm}>
        <form onSubmit={editForm.handleSubmit(onBasicDetailsSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={editForm.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value || "unassigned"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">None / Unassigned</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>The user's primary department.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
              name="isDepartmentHead"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-background">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Department Head</FormLabel>
                    <FormDescription>
                      Designate as a manager for the selected department.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Details
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

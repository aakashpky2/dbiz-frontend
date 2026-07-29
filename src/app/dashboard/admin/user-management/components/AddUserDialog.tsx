import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasValidEmployeePhone } from "@/lib/phone";
import { UseFormReturn } from "react-hook-form";

interface Employee {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  phone?: string | null;
}

interface Role {
  id: string;
  name: string;
  priority?: number;
}

interface AddUserDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
  reactivatingUser: any | null;
  availableEmployees: Employee[];
  allowedRoles: Role[];
  isSuperAdminByPermissions: boolean;
  isSuperAdminRole: (role: Role) => boolean;
  isCreatingUser: boolean;
  selectedEmpId: string;
}

export function AddUserDialog({
  isOpen,
  setIsOpen,
  form,
  onSubmit,
  reactivatingUser,
  availableEmployees,
  allowedRoles,
  isSuperAdminByPermissions,
  isSuperAdminRole,
  isCreatingUser,
  selectedEmpId,
}: AddUserDialogProps) {
  const selectedEmployeeForPreview = availableEmployees.find(
    (e) => e.id === selectedEmpId
  );

  const hasEmail = !!selectedEmployeeForPreview?.email?.trim();
  const hasPhone = hasValidEmployeePhone(selectedEmployeeForPreview?.phone);
  const canCreateCredentials = hasEmail && hasPhone;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {reactivatingUser ? `Editing "${reactivatingUser?.employee?.name || reactivatingUser?.email || 'User'}"` : "Adding New User"}
          </DialogTitle>
          <DialogDescription>
            {reactivatingUser
              ? "Update the details of this item."
              : "Enter the details for User."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Employee Name</FormLabel>
                  <FormControl>
                    <Combobox
                      options={availableEmployees.map((emp) => ({
                        value: emp.id,
                        label: `${emp.name} (${emp.email}) - ${emp.employeeId}`,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select employee name..."
                      searchPlaceholder="Search by name or ID..."
                      emptyText="No eligible employees found."
                      showCheckbox={!reactivatingUser}
                      disabled={!!reactivatingUser}
                    />
                  </FormControl>
                  <FormDescription>
                    All employees from the database are listed for selection.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roleIds"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">
                      Assign Initial Roles
                    </FormLabel>
                    <FormDescription>
                      Select roles to grant permissions immediately.
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-2 border rounded-md">
                    {allowedRoles.map((role) => (
                      <FormField
                        key={role.id}
                        control={form.control}
                        name="roleIds"
                        render={({ field }) => {
                          const isLockedSuperAdminRole =
                            !isSuperAdminByPermissions && isSuperAdminRole(role);
                          return (
                            <FormItem
                              key={role.id}
                              className="flex flex-row items-start space-x-3 space-y-0 p-2 hover:bg-muted/10 rounded-md transition-colors"
                            >
                              <FormControl>
                                <Checkbox
                                  disabled={isLockedSuperAdminRole}
                                  checked={field.value?.includes(role.id)}
                                  onCheckedChange={(checked) => {
                                    if (isLockedSuperAdminRole) return;
                                    return checked
                                      ? field.onChange([
                                          ...field.value,
                                          role.id,
                                        ])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value: string) => value !== role.id
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-normal cursor-pointer text-sm font-semibold">
                                  {role.name}
                                </FormLabel>
                                {isLockedSuperAdminRole && (
                                  <div className="text-[10px] text-red-600 font-semibold">
                                    Super Admin role can only be assigned by Super Admin.
                                  </div>
                                )}
                              </div>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedEmployeeForPreview && (
              <div
                className={cn(
                  "rounded-md p-4 border flex gap-4 items-start",
                  canCreateCredentials
                    ? "bg-slate-50 border-slate-200"
                    : "bg-red-50 border-red-100"
                )}
              >
                <Shield
                  className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    canCreateCredentials ? "text-primary" : "text-red-600"
                  )}
                />
                <div
                  className={cn(
                    "space-y-1 text-sm",
                    canCreateCredentials ? "text-slate-700" : "text-red-800"
                  )}
                >
                  <p className="font-semibold">
                    Credentials will be generated automatically:
                  </p>

                  <ul className="list-disc list-inside text-xs space-y-1 mt-2">
                    <li>
                      <span className="font-medium">Username:</span>{" "}
                      {selectedEmployeeForPreview.email || "Missing email"}
                    </li>
                    <li>
                      <span className="font-medium">Temporary Password:</span>{" "}
                      Employee mobile number
                    </li>
                    <li>
                      <span className="font-medium">Force Password Change:</span> Yes
                    </li>
                  </ul>

                  {!hasEmail && (
                    <p className="text-xs font-semibold mt-2 text-red-700">
                      This employee does not have a work email. Add an email before creating a user.
                    </p>
                  )}
                  {hasEmail && !hasPhone && (
                    <p className="text-xs font-semibold mt-2 text-red-700">
                      This employee does not have a valid 10-digit mobile number. User cannot be created until one is added.
                    </p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isCreatingUser ||
                  !selectedEmpId ||
                  (!reactivatingUser && !canCreateCredentials)
                }
              >
                {isCreatingUser && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {reactivatingUser ? "Reactivate User" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

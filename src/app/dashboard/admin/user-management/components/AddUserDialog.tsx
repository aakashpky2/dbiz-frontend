import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Shield, Loader2, UserPlus, Check, KeyRound, AlertTriangle } from "lucide-react";
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
      <DialogContent className="sm:max-w-[760px] max-h-[85vh] p-0 flex flex-col overflow-hidden bg-background border-none shadow-2xl [&>button]:hidden">
        
        {/* Header - Non scrolling */}
        <div className="relative shrink-0 border-b bg-gradient-to-br from-primary/[0.04] to-background px-6 py-5 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 text-primary">
              <UserPlus className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="mb-1 inline-flex w-fit items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                NEW USER
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {reactivatingUser ? `Editing "${reactivatingUser?.employee?.name || reactivatingUser?.email || 'User'}"` : "Add User"}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {reactivatingUser
                  ? "Update the details of this item."
                  : "Create system access and assign initial roles for an employee."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:border-primary/20 hover:bg-muted hover:text-foreground"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
            >
              <path
                d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
            <span className="sr-only">Close</span>
          </button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            
            {/* Scrollable Main Content */}
            <div className="flex-1 overflow-y-auto bg-muted/10 px-6 py-6 space-y-6">
              
              {/* Step 1 */}
              <div className="space-y-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-[26px] items-center rounded-lg bg-primary/15 px-2 text-xs font-bold text-primary">
                      01
                    </span>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">EMPLOYEE</h3>
                  </div>
                  <p className="text-xs text-muted-foreground ml-9">
                    Select an active employee who needs system access.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm ml-9 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Employee Name *</FormLabel>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedEmployeeForPreview && (
                    <div className="mt-4 flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {selectedEmployeeForPreview.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {selectedEmployeeForPreview.name}
                        </span>
                        <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                          <span className="truncate">{selectedEmployeeForPreview.email || "No email"}</span>
                          <span>&middot;</span>
                          <span>{selectedEmployeeForPreview.employeeId}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-[26px] items-center rounded-lg bg-primary/15 px-2 text-xs font-bold text-primary">
                      02
                    </span>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">INITIAL ROLES</h3>
                  </div>
                  <p className="text-xs text-muted-foreground ml-9">
                    Choose the permissions assigned at creation.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm ml-9 animate-in fade-in slide-in-from-bottom-1 duration-300 delay-75 fill-mode-both">
                  <FormField
                    control={form.control}
                    name="roleIds"
                    render={() => (
                      <FormItem>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {allowedRoles.map((role) => (
                            <FormField
                              key={role.id}
                              control={form.control}
                              name="roleIds"
                              render={({ field }) => {
                                const isLockedSuperAdminRole =
                                  !isSuperAdminByPermissions && isSuperAdminRole(role);
                                const isSelected = field.value?.includes(role.id);
                                
                                return (
                                  <FormItem
                                    key={role.id}
                                    className={cn(
                                      "flex flex-row items-start space-x-3 space-y-0 p-3 rounded-lg border transition-all duration-150",
                                      isSelected
                                        ? "bg-primary/[0.05] border-primary/30"
                                        : "bg-background border-border/60 hover:bg-muted/30 hover:border-primary/15"
                                    )}
                                  >
                                    <FormControl>
                                      <Checkbox
                                        disabled={isLockedSuperAdminRole}
                                        checked={isSelected}
                                        className="mt-0.5"
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
                                    <div className="flex flex-col space-y-1 leading-none w-full overflow-hidden">
                                      <div className="flex items-center justify-between gap-2">
                                        <FormLabel className="font-semibold cursor-pointer text-sm capitalize truncate">
                                          {role.name}
                                        </FormLabel>
                                        {isSuperAdminRole(role) && (
                                          <div className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 gap-1 shrink-0">
                                            <Shield className="h-3 w-3" />
                                            HIGH ACCESS
                                          </div>
                                        )}
                                      </div>
                                      {isLockedSuperAdminRole && (
                                        <div className="text-[10px] text-red-600 font-semibold pt-1">
                                          Requires Super Admin privilege to assign.
                                        </div>
                                      )}
                                    </div>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage className="mt-3" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-4 pb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-[26px] items-center rounded-lg bg-primary/15 px-2 text-xs font-bold text-primary">
                      03
                    </span>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">LOGIN CREDENTIALS</h3>
                  </div>
                  <p className="text-xs text-muted-foreground ml-9">
                    Credentials will be generated automatically.
                  </p>
                </div>

                <div className="ml-9 animate-in fade-in slide-in-from-bottom-1 duration-300 delay-150 fill-mode-both">
                  {!selectedEmployeeForPreview ? (
                     <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm flex items-center justify-center text-sm text-muted-foreground min-h-[120px]">
                        Select an employee to view credential preview.
                     </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-xl p-5 border flex flex-col gap-4 shadow-sm",
                        canCreateCredentials
                          ? "bg-gradient-to-br from-primary/[0.04] to-background border-primary/15"
                          : "bg-red-50/50 border-red-200"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {canCreateCredentials ? (
                          <KeyRound className="h-5 w-5 text-primary" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        )}
                        <h4 className={cn(
                          "font-semibold text-sm",
                          canCreateCredentials ? "text-foreground" : "text-red-800"
                        )}>
                          Generated Credentials Preview
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                        <div className="flex flex-col space-y-1 overflow-hidden">
                           <span className="text-xs text-muted-foreground">Username</span>
                           <span className="text-sm font-medium text-foreground truncate">
                             {selectedEmployeeForPreview.email || <span className="text-red-600 italic">Missing email</span>}
                           </span>
                        </div>
                        <div className="flex flex-col space-y-1">
                           <span className="text-xs text-muted-foreground">Temporary Password</span>
                           <span className="text-sm font-medium text-foreground">
                             Employee mobile number
                           </span>
                        </div>
                        <div className="flex flex-col space-y-1">
                           <span className="text-xs text-muted-foreground">Force Password Change</span>
                           <span className="text-sm font-medium text-foreground">
                             Yes
                           </span>
                        </div>
                      </div>

                      {(!hasEmail || !hasPhone) && (
                        <div className="mt-2 rounded-lg bg-red-100/50 border border-red-200 p-3 text-xs font-semibold text-red-800 space-y-1">
                          {!hasEmail && <p>• This employee does not have a work email.</p>}
                          {!hasPhone && <p>• This employee does not have a valid 10-digit mobile number.</p>}
                          <p className="mt-1">User cannot be created until missing details are added.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer - Sticky/Non-scrolling */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border/70 bg-background/95 backdrop-blur-sm px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="h-[42px] rounded-[10px] min-w-[135px] font-semibold"
                onClick={() => {
                  setIsOpen(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-[42px] rounded-[10px] min-w-[140px] font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-md active:translate-y-0"
                disabled={
                  isCreatingUser ||
                  !selectedEmpId ||
                  (!reactivatingUser && !canCreateCredentials)
                }
              >
                {isCreatingUser ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : reactivatingUser ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {isCreatingUser ? "Creating..." : reactivatingUser ? "Reactivate User" : "Create User"}
              </Button>
            </div>
            
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

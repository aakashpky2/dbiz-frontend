import React, { useState, useMemo } from "react";
import { User, Role } from "../../constants";
import { useRbacAdmin } from "@/contexts/RbacAdminContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { rbacService } from "@/services/rbacService";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function RolesTab({ user }: { user: User }) {
  const { roles } = useRbacAdmin();
  const { toast } = useToast();
  
  const initialRoleIds = useMemo(() => new Set(user.roleIds || []), [user.roleIds]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialRoleIds);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const rolesAdded = useMemo(() => {
    return Array.from(selectedIds).filter(id => !initialRoleIds.has(id)).map(id => roles.find(r => r.id === id));
  }, [selectedIds, initialRoleIds, roles]);

  const rolesRemoved = useMemo(() => {
    return Array.from(initialRoleIds).filter(id => !selectedIds.has(id)).map(id => roles.find(r => r.id === id));
  }, [selectedIds, initialRoleIds, roles]);

  const hasChanges = rolesAdded.length > 0 || rolesRemoved.length > 0;

  const handleToggle = (roleId: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(roleId);
    else next.delete(roleId);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await rbacService.updateUserRoles(user.uid, Array.from(selectedIds));
      toast({ title: "Success", description: "User roles updated successfully" });
      setShowConfirm(false);
      // Ideally we refresh the user object or wait for parent refresh
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-md border p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium">Assigned Roles</h3>
          <p className="text-sm text-muted-foreground">Manage broad access levels for this user.</p>
        </div>
        <Button onClick={() => setShowConfirm(true)} disabled={!hasChanges || isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Review & Save Changes
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto border rounded-md divide-y bg-background">
        {roles.map(role => {
          const isSelected = selectedIds.has(role.id);
          const isInitial = initialRoleIds.has(role.id);
          const statusChanged = isSelected !== isInitial;
          
          return (
            <div key={role.id} className={`p-4 flex items-start gap-4 transition-colors ${statusChanged ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
              <Checkbox 
                checked={isSelected}
                onCheckedChange={(checked) => handleToggle(role.id, !!checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{role.name}</span>
                  {statusChanged && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      Modified
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                
                {/* Additional metadata per requirement */}
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Priority: {role.priority ?? 'Standard'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Please review the estimated access impact before applying these changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4 space-y-4">
            {rolesAdded.length > 0 && (
              <div className="border rounded-md p-3 bg-green-50/50 border-green-200">
                <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2">
                  <Plus className="h-4 w-4" /> Roles Added
                </h4>
                <ul className="text-sm space-y-1 text-green-900 list-disc list-inside">
                  {rolesAdded.map(r => <li key={r?.id}>{r?.name}</li>)}
                </ul>
              </div>
            )}

            {rolesRemoved.length > 0 && (
              <div className="border rounded-md p-3 bg-red-50/50 border-red-200">
                <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" /> Roles Removed
                </h4>
                <ul className="text-sm space-y-1 text-red-900 list-disc list-inside">
                  {rolesRemoved.map(r => <li key={r?.id}>{r?.name}</li>)}
                </ul>
              </div>
            )}
            
            <div className="text-sm bg-muted p-3 rounded-md">
              <strong>Estimated Access Change:</strong> The user's underlying permissions will be recalculated by the resolver on their next action.
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} className="bg-primary text-primary-foreground">
              Confirm & Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

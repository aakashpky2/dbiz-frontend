import React, { useState, useEffect } from "react";
import { User } from "../../constants";
import { useRbacAdmin } from "@/contexts/RbacAdminContext";
import { rbacService } from "@/services/rbacService";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "../../constants";

export function ResponsibilitiesTab({ user }: { user: User }) {
  const { templates } = useRbacAdmin();
  const { toast } = useToast();
  
  const [responsibilities, setResponsibilities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResponsibilities = async () => {
    try {
      setIsLoading(true);
      const res = await rbacService.getUserResponsibilities(user.uid);
      setResponsibilities(res.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResponsibilities();
  }, [user.uid]);

  const handleRemove = async (templateId: string) => {
    try {
      await rbacService.removeResponsibility([user.uid], templateId, "Removed by Admin");
      toast({ title: "Success", description: "Responsibility removed successfully" });
      fetchResponsibilities();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  return (
    <div className="bg-card rounded-md border h-full flex flex-col">
      <div className="p-6 border-b flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Delegated Responsibilities</h3>
          <p className="text-sm text-muted-foreground">Manage granular templates assigned to this user.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Assign Responsibility
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-0">
        {responsibilities.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No responsibilities assigned.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valid Until</th>
                <th className="px-4 py-3 font-medium">Assigned By</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {responsibilities.map((r) => {
                const template = templates.find(t => t.id === r.responsibility_template_id);
                const isExpired = r.valid_until && new Date(r.valid_until).getTime() < Date.now();
                const isActive = r.is_active && !isExpired;

                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {template?.name || "Unknown Template"}
                      <div className="text-xs font-normal text-muted-foreground">
                        Perms: {template?.permissions?.length || 0} | Deps: {template?.child_templates?.length || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3">{template?.category || "-"}</td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
                      ) : isExpired ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><Clock className="mr-1 h-3 w-3" /> Expired</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="mr-1 h-3 w-3" /> Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.valid_until ? formatDate(r.valid_until) : "Permanent"}
                    </td>
                    <td className="px-4 py-3">
                      {r.assigned_by || "System"}
                      <div className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={r.reason}>{r.reason}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.is_active && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(r.responsibility_template_id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

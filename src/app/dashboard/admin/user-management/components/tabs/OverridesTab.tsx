import React, { useState, useEffect } from "react";
import { User } from "../../constants";
import { rbacService } from "@/services/rbacService";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Clock, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "../../constants";

export function OverridesTab({ user }: { user: User }) {
  const { toast } = useToast();
  
  const [overrides, setOverrides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverrides = async () => {
    try {
      setIsLoading(true);
      const res = await rbacService.getUserOverrides(user.uid);
      setOverrides(res.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, [user.uid]);

  const handleRemove = async (permissionKey: string) => {
    try {
      await rbacService.removeOverride([user.uid], permissionKey, "Removed by Admin");
      toast({ title: "Success", description: "Override removed successfully" });
      fetchOverrides();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  const allowOverrides = overrides.filter(o => o.effect === 'ALLOW');
  const denyOverrides = overrides.filter(o => o.effect === 'DENY');

  const renderTable = (data: any[], effect: 'ALLOW' | 'DENY') => (
    <div className="border rounded-md mb-6 overflow-hidden bg-background">
      <div className={`p-3 font-semibold text-sm flex items-center justify-between ${effect === 'ALLOW' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
        <div className="flex items-center gap-2">
          {effect === 'ALLOW' ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {effect} Overrides ({data.length})
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs bg-white">
          <Plus className="mr-1 h-3 w-3" /> Add {effect} Override
        </Button>
      </div>
      {data.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No {effect} overrides found.</div>
      ) : (
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/30 border-b text-xs">
            <tr>
              <th className="px-4 py-2 font-medium">Permission</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Valid Until</th>
              <th className="px-4 py-2 font-medium">Assigned By</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((o) => {
              const isExpired = o.valid_until && new Date(o.valid_until).getTime() < Date.now();
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium font-mono text-xs">{o.permission_key}</td>
                  <td className="px-4 py-2">
                    {isExpired ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><Clock className="mr-1 h-3 w-3" /> Expired</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {o.valid_until ? formatDate(o.valid_until) : "Permanent"}
                  </td>
                  <td className="px-4 py-2 text-xs">{o.granted_by || "System"}</td>
                  <td className="px-4 py-2 text-xs max-w-[200px] truncate" title={o.reason}>{o.reason || "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(o.permission_key)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="bg-card rounded-md border h-full flex flex-col p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium">Permission Overrides</h3>
        <p className="text-sm text-muted-foreground">Force allow or deny specific granular permissions for this user.</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {renderTable(allowOverrides, 'ALLOW')}
        {renderTable(denyOverrides, 'DENY')}
      </div>
    </div>
  );
}

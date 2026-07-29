import React, { useState, useEffect, useMemo } from "react";
import { User } from "../../constants";
import { rbacService } from "@/services/rbacService";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function EffectivePermissionsTab({ user }: { user: User }) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEffectiveAccess = async () => {
      try {
        setIsLoading(true);
        const res = await rbacService.getUserEffectiveAccess(user.uid);
        setData(res.data);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchEffectiveAccess();
  }, [user.uid]);

  const groupedPermissions = useMemo(() => {
    if (!data?.permissions) return {};
    const groups: Record<string, string[]> = {};
    data.permissions.forEach((p: string) => {
      // Simple heuristic: group by the last word if it has multiple words (e.g. MANAGE_USERS -> USERS)
      // Or just group by first word (e.g. MANAGE, VIEW). Let's group by the part after the first underscore for modules.
      const parts = p.split('_');
      let category = parts.length > 1 ? parts.slice(1).join('_') : 'GENERAL';
      
      // Polish up category names
      if (category.includes('TEMPLATES') || category.includes('ROLES') || category.includes('OVERRIDES')) {
        category = 'RBAC_MANAGEMENT';
      }
      
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    return groups;
  }, [data]);

  const renderSourceBadge = (source: string, idx: number) => {
    let colorClass = "bg-slate-100 text-slate-800 border-slate-200";
    if (source === 'OWNER') colorClass = "bg-purple-100 text-purple-800 border-purple-200";
    if (source === 'ROLE') colorClass = "bg-blue-100 text-blue-800 border-blue-200";
    if (source === 'RESPONSIBILITY') colorClass = "bg-indigo-100 text-indigo-800 border-indigo-200";
    if (source === 'USER_ALLOW') colorClass = "bg-green-100 text-green-800 border-green-200";
    if (source === 'DEPENDENCY') colorClass = "bg-amber-100 text-amber-800 border-amber-200";
    
    return (
      <Badge key={idx} variant="outline" className={`text-[10px] font-mono px-1.5 py-0 ${colorClass}`}>
        {source}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  return (
    <div className="bg-card rounded-md border h-full flex flex-col p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Effective Access
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            The canonical list of permissions currently granted to this user, fully resolved by the RBAC engine.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{data?.permissions?.length || 0}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Permissions</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {data?.deniedPermissions?.length > 0 && (
          <div className="border border-red-200 rounded-md p-4 bg-red-50/50">
            <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4" /> Explicitly Denied
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.deniedPermissions.map((p: string) => (
                <div key={p} className="flex items-center gap-2 text-sm bg-white border border-red-100 p-2 rounded">
                  <span className="font-mono text-xs text-red-900 line-through opacity-70">{p}</span>
                  <Badge variant="outline" className="text-[10px] bg-red-100 text-red-800 border-red-200 px-1.5 py-0">DENY_OVERRIDE</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.entries(groupedPermissions).sort(([a], [b]) => a.localeCompare(b)).map(([category, perms]) => (
          <div key={category} className="border rounded-md overflow-hidden bg-background">
            <div className="bg-muted/30 px-4 py-2 border-b">
              <h4 className="text-xs font-bold text-slate-700 tracking-wider">
                {category.replace(/_/g, ' ')} ({perms.length})
              </h4>
            </div>
            <div className="p-0 divide-y">
              {perms.sort().map(p => {
                const sources = data?.permissionSources?.[p] || ['UNKNOWN'];
                return (
                  <div key={p} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Key className="h-3 w-3 text-slate-400" />
                      <span className="font-mono text-xs font-medium text-slate-800">{p}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {sources.map((src: string, idx: number) => renderSourceBadge(src, idx))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {(!data?.permissions || data.permissions.length === 0) && (
          <div className="text-center p-8 text-muted-foreground border rounded-md border-dashed">
            User has no effective permissions.
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { User } from "../../constants";
import { rbacService } from "@/services/rbacService";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AuditTab({ user }: { user: User }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAuditLog = async () => {
      try {
        setIsLoading(true);
        const res = await rbacService.getUserAudit(user.uid);
        setLogs(res.data || []);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAuditLog();
  }, [user.uid]);

  const renderActionBadge = (action: string) => {
    const act = action.toUpperCase();
    let color = "bg-slate-100 text-slate-800 border-slate-200";
    
    if (act.includes('ASSIGN') || act.includes('ALLOW') || act.includes('GRANT')) {
      color = "bg-green-100 text-green-800 border-green-200";
    } else if (act.includes('REMOVE') || act.includes('DENY') || act.includes('REVOKE')) {
      color = "bg-red-100 text-red-800 border-red-200";
    } else if (act.includes('UPDATE') || act.includes('MODIFY')) {
      color = "bg-blue-100 text-blue-800 border-blue-200";
    }

    return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>{act}</Badge>;
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  return (
    <div className="bg-card rounded-md border h-full flex flex-col p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <History className="h-5 w-5 text-slate-600" />
            Audit History
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological log of changes to this user's access profile.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground border rounded-md border-dashed">
            No audit logs found for this user.
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {logs.map((log, index) => (
              <div key={log.id || index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-primary text-primary-foreground group-[.is-active]:text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-md border bg-background shadow-sm">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-slate-900 text-sm">{log.performed_by_name || "System"}</div>
                    <time className="font-mono text-xs text-muted-foreground">
                      {new Date(log.performed_at).toLocaleString()}
                    </time>
                  </div>
                  <div className="mb-2">
                    {renderActionBadge(log.action)}
                  </div>
                  <div className="text-sm text-slate-700">
                    Target: <span className="font-mono text-xs font-semibold">{log.target_name || log.target_id || "User"}</span>
                  </div>
                  {log.reason && (
                    <div className="text-xs text-muted-foreground mt-2 italic border-t pt-2">
                      "{log.reason}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

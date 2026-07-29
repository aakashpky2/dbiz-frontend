import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchEntityHistory, fetchAllHistory, MasterLog } from '@/lib/department-management';
import { format } from 'date-fns';
import { History, Clock, User, CheckCircle2, XCircle, AlertCircle, Edit3, PlusCircle, Trash2 } from 'lucide-react';

interface ViewHistoryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    entityType?: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE';
    entityId?: string;
    entityName?: string;
}

export function ViewHistoryDialog({ isOpen, onClose, entityType, entityId, entityName }: ViewHistoryDialogProps) {
    const [logs, setLogs] = useState<MasterLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            if (entityId && entityType) {
                fetchEntityHistory(entityType, entityId).then(data => {
                    setLogs(data);
                    setIsLoading(false);
                });
            } else {
                fetchAllHistory().then(data => {
                    setLogs(data);
                    setIsLoading(false);
                });
            }
        } else {
            setLogs([]);
        }
    }, [isOpen, entityId, entityType]);

    const getHumanDescription = (log: MasterLog) => {
        const type = log.entity_type.replace('WORKTYPE', 'Work Type').replace('CATEGORY', 'Category');
        const name = log.new_value_snapshot?.department_name || log.new_value_snapshot?.category_name || log.new_value_snapshot?.work_type_name || log.old_value_snapshot?.department_name || log.old_value_snapshot?.category_name || log.old_value_snapshot?.work_type_name || "item";

        switch (log.action_type) {
            case 'ADD': return `Added new ${type}: "${name}"`;
            case 'EDIT': return `Modified ${type}: "${name}"`;
            case 'DELETE_SOFT': return `Requested deletion for ${type}: "${name}"`;
            case 'DELETE_PERMANENT': return `Permanently deleted ${type}: "${name}"`;
            case 'VALIDATE_APPROVE': return `Approved ${type}: "${name}"`;
            case 'VALIDATE_REJECT': return `Rejected and dismissed ${type}: "${name}"`;
            case 'VALIDATE_EDIT_APPROVE': return `Edited and Approved ${type}: "${name}"`;
            default: return `${log.action_type} action on ${type}`;
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'ADD': return <PlusCircle className="h-4 w-4 text-emerald-500" />;
            case 'EDIT': return <Edit3 className="h-4 w-4 text-blue-500" />;
            case 'DELETE_SOFT': return <Trash2 className="h-4 w-4 text-orange-500" />;
            case 'DELETE_PERMANENT': return <Trash2 className="h-4 w-4 text-red-600" />;
            case 'VALIDATE_APPROVE': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
            case 'VALIDATE_REJECT': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'VALIDATE_EDIT_APPROVE': return <CheckCircle2 className="h-4 w-4 text-purple-600" />;
            default: return <AlertCircle className="h-4 w-4 text-slate-400" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                <div className="p-6 pb-4 border-b bg-primary/5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-primary">
                            <div className="bg-primary/10 p-2 rounded-xl">
                                <History className="h-6 w-6" />
                            </div>
                            History Details
                        </DialogTitle>
                        <DialogDescription className="text-base">
                            View history information.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
                            Parsing history records...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-dashed rounded-2xl">
                            <History className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-muted-foreground text-lg">No activity recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log, index) => {
                                const date = log.performed_datetime ? new Date(log.performed_datetime) : new Date();
                                return (
                                    <div key={log.log_id || index} className="group bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 bg-slate-100 p-2 rounded-lg group-hover:bg-primary/5 transition-colors">
                                                    {getActionIcon(log.action_type)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 leading-tight mb-1">
                                                        {getHumanDescription(log)}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3 w-3" />
                                                            {log.performed_by_user_name || 'System'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {format(date, 'MMM dd, h:mm a')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {log.remarks && log.remarks !== 'Rejected from UI' && (
                                                <Badge variant="outline" className="hidden sm:inline-flex bg-slate-50 border-slate-200 text-slate-600 font-normal">
                                                    "{log.remarks}"
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-white flex justify-end">
                    <Button onClick={onClose} className="px-8 font-bold">Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

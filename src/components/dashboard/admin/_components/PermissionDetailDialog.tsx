'use client';

import React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogTitle, 
    DialogFooter,
    DialogClose,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Workflow, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedPermission: string | null;
    permissionList: any[];
    autoAssignment: boolean;
    toggling: boolean;
    onToggleAutoAssignment: (val: boolean) => void;
}

export function PermissionDetailDialog({
    open,
    onOpenChange,
    selectedPermission,
    permissionList,
    autoAssignment,
    toggling,
    onToggleAutoAssignment
}: PermissionDetailDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-primary/5 p-8 border-b border-primary/10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-primary/10">
                            {selectedPermission === 'work_auto_assignment' && <Workflow className="h-8 w-8 text-primary" />}
                            {selectedPermission !== 'work_auto_assignment' && <Settings2 className="h-8 w-8 text-primary" />}
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-slate-900 uppercase">
                                Permission Details
                            </DialogTitle>
                            <DialogDescription>
                                View permission information for {permissionList.find(p => p.id === selectedPermission)?.title}.
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" /> Configuration Overview
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            {permissionList.find(p => p.id === selectedPermission)?.description}
                        </p>
                    </div>

                    {selectedPermission === 'work_auto_assignment' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-1">Current State</p>
                                    <p className="text-lg font-black text-emerald-900">{autoAssignment ? "ENABLED" : "DISABLED"}</p>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">Impact Level</p>
                                    <p className="text-lg font-black text-blue-900">SYSTEM-WIDE</p>
                                </div>
                            </div>
                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
                                <p className="text-xs text-amber-800 leading-relaxed italic">
                                    Note: Auto-assignment logic uses team workload metrics and specialist category matching to ensure optimal work distribution.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="bg-slate-50 p-6 border-t border-slate-100">
                    <DialogClose asChild>
                        <Button variant="outline" className="h-11 px-8 rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200">Close Panel</Button>
                    </DialogClose>
                    {selectedPermission === 'work_auto_assignment' && (
                        <Button 
                            className={cn(
                                "h-11 px-8 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95",
                                autoAssignment ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                            )}
                            onClick={() => onToggleAutoAssignment(!autoAssignment)}
                            disabled={toggling}
                        >
                            {toggling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {autoAssignment ? "Deactivate Workflow" : "Activate Workflow"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

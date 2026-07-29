import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Check, X, ArrowRight, Clock, FileText, User, AlertCircle, Loader2, Edit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';

import {
    listenToChangeRequests,
    dbApproveChangeRequest,
    dbRejectChangeRequest,
    dbUpdateAndApproveChangeRequest
} from '@/lib/department-management';

export interface ChangeRequest {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    entityType: 'DEPARTMENT' | 'WORK_CATEGORY' | 'WORK_TYPE' | string;
    changeType: 'CREATE' | 'UPDATE' | 'DELETE_REQUEST' | string;
    newData: any;
    oldData: any;
    metadata?: any;
    requesterName?: string;
    requestedBy?: string;
    requestedAt: string;
}

export function ValidationQueue() {
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [editingRequest, setEditingRequest] = useState<ChangeRequest | null>(null);
    const [editForm, setEditForm] = useState<any>({});

    // New state for approve delete confirmation
    const [approvingReq, setApprovingReq] = useState<ChangeRequest | null>(null);
    const [approveConfirm, setApproveConfirm] = useState('');

    const [constitutions, setConstitutions] = useState<{ id: string, name: string }[]>([]);

    const { toast } = useToast();
    const { user } = useAuth();

    useEffect(() => {
        const unsubscribe = listenToChangeRequests((data: any[]) => {
            // Filter only PENDING requests
            setRequests(data.filter((r: any) => r.status === 'PENDING'));
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchConstitutions = async () => {
            const { data, error } = await supabase.from('business_constitutions').select('*');
            if (data && !error) {
                const list = data.map(c => ({
                    id: c.id,
                    name: `${c.business_type} - ${c.business_sub_type}`
                }));
                setConstitutions(list);
            } else {
                setConstitutions([]);
            }
        };
        fetchConstitutions();
    }, []);

    const handleApprove = async (req: ChangeRequest) => {
        if (!user) return;

        // If it's a delete request, require strict confirmation
        if (req.changeType === 'DELETE_REQUEST') {
            setApprovingReq(req);
            return;
        }

        // Standard approval for other types
        try {
            await dbApproveChangeRequest(req.id, user.uid, user.displayName || 'Unknown User');
            toast({ title: "Approved", description: "Change request approved and applied." });
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to approve request.", variant: "destructive" });
        }
    };

    const submitApproveDelete = async () => {
        if (!user || !approvingReq) return;
        if (approveConfirm !== 'APPROVE DELETE') return;

        try {
            await dbApproveChangeRequest(approvingReq.id, user.uid, user.displayName || 'Unknown User');
            toast({ title: "Approved", description: "Deletion confirmed and executed." });
            setApprovingReq(null);
            setApproveConfirm('');
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to approve deletion.", variant: "destructive" });
        }
    }

    const handleReject = async () => {
        if (!user || !rejectingId) return;
        try {
            await dbRejectChangeRequest(rejectingId, user.uid, user.displayName || 'Unknown User', rejectionReason);
            toast({ title: "Rejected", description: "Change request has been rejected." });
            setRejectingId(null);
            setRejectionReason('');
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to reject request.", variant: "destructive" });
        }
    };

    const handleEditOpen = (req: ChangeRequest) => {
        setEditingRequest(req);
        // Pre-fill form with newData or a flattened version of it
        setEditForm(JSON.parse(JSON.stringify(req.newData || {})));
    };

    const handleEditSaveAndApprove = async () => {
        if (!user || !editingRequest) return;
        try {
            // Merge editForm into editingRequest.newData
            await dbUpdateAndApproveChangeRequest(editingRequest.id, editForm, user.uid, user.displayName || 'Unknown User');
            toast({ title: "Approved with Changes", description: "Request updated and approved." });
            setEditingRequest(null);
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to update and approve.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
                <p className="text-sm font-medium">Loading requests...</p>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                <Clock className="h-10 w-10 mb-2 opacity-50" />
                <p>No pending approvals</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {requests.map((req) => (
                <Card key={req.id} className="border-l-4 border-l-yellow-500 shadow-sm">
                    <CardHeader className="pb-3 bg-muted/5">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="font-semibold">{req.entityType.replace('_', ' ')}</Badge>
                                    <Badge className={`${req.changeType === 'CREATE' ? 'bg-green-600 hover:bg-green-700' : req.changeType === 'UPDATE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                        {req.changeType.replace('_REQUEST', '')}
                                    </Badge>
                                </div>
                                <CardTitle className="text-lg font-medium flex items-center gap-2">
                                    {req.metadata?.name || req.metadata?.newName || "Unknown Entity"}
                                </CardTitle>
                                <CardDescription className="text-xs flex items-center gap-4 mt-2 text-muted-foreground/80">
                                    <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Request by: {req.requesterName || req.requestedBy?.substring(0, 8)}</span>
                                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {format(new Date(req.requestedAt), 'dd MMM yyyy hh:mm aaa')}</span>
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {req.changeType !== 'DELETE_REQUEST' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleEditOpen(req)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive" onClick={() => setRejectingId(req.id)}>
                                    <X className="h-4 w-4 mr-1.5" /> Reject
                                </Button>
                                <Button size="sm" onClick={() => handleApprove(req)} className="bg-green-600 hover:bg-green-700 shadow-sm">
                                    <Check className="h-4 w-4 mr-1.5" /> Approve
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <DiffView oldData={req.oldData} newData={req.newData} changeType={req.changeType} constitutions={constitutions} />
                    </CardContent>
                </Card>
            ))}

            {/* Edit & Approve Dialog */}
            <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Edit & Approve Request</DialogTitle>
                        <DialogDescription>Modify the values before approving. This will update the request and apply changes immediately.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        {editingRequest && (editingRequest.entityType === 'DEPARTMENT' || editingRequest.entityType === 'WORK_CATEGORY' || editingRequest.entityType === 'WORK_TYPE') && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={editForm.name || ''}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value, status: 'PENDING' })}
                                    />
                                </div>
                                {editingRequest.entityType === 'DEPARTMENT' && (
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={editForm.description || ''}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        />
                                    </div>
                                )}
                                {editingRequest.entityType === 'WORK_CATEGORY' && (
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={editForm.description || ''}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        />
                                    </div>
                                )}
                                {editingRequest.entityType === 'WORK_TYPE' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                value={editForm.description || ''}
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-3 pt-2">
                                            <Label>Applicable Business Constitutions</Label>
                                            <RadioGroup
                                                value={editForm.constitutionRule?.mode || 'ALL'}
                                                onValueChange={(val: any) => setEditForm({ ...editForm, constitutionRule: { ...editForm.constitutionRule, mode: val, ids: editForm.constitutionRule?.ids || [] } })}
                                                className="flex flex-col space-y-1"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="ALL" id="v-all" />
                                                    <Label htmlFor="v-all" className="font-normal">Applicable to <b>ALL</b> constitutions</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="SELECT" id="v-select" />
                                                    <Label htmlFor="v-select" className="font-normal">Applicable to <b>SELECTED</b> only</Label>
                                                </div>
                                                    </RadioGroup>

                                            {editForm.constitutionRule?.mode !== 'ALL' && (
                                                <div className="border rounded-md p-3 mt-2 h-40 overflow-y-auto space-y-2 bg-muted/10">
                                                    {constitutions.map(c => (
                                                        <div key={c.id} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`vc-${c.id}`}
                                                                checked={editForm.constitutionRule?.ids?.includes(c.id)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentIds = editForm.constitutionRule?.ids || [];
                                                                    const newIds = checked
                                                                        ? [...currentIds, c.id]
                                                                        : currentIds.filter((id: string) => id !== c.id);
                                                                    setEditForm({ ...editForm, constitutionRule: { ...editForm.constitutionRule, ids: newIds } });
                                                                }}
                                                            />
                                                            <Label htmlFor={`vc-${c.id}`} className="text-sm font-normal cursor-pointer">{c.name}</Label>
                                                        </div>
                                                    ))}
                                                    {constitutions.length === 0 && <div className="text-xs text-muted-foreground">No constitutions found.</div>}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {editingRequest && !['DEPARTMENT', 'WORK_CATEGORY', 'WORK_TYPE'].includes(editingRequest.entityType) && (
                            <div className="text-sm text-yellow-600">Editing for {editingRequest.entityType} is not fully supported locally.</div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingRequest(null)}>Cancel</Button>
                        <Button onClick={handleEditSaveAndApprove} className="bg-green-600 hover:bg-green-700">Approve with Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve Delete Dialog */}
            <Dialog open={!!approvingReq} onOpenChange={(open) => { if (!open) { setApprovingReq(null); setApproveConfirm(''); } }}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" /> Confirm Deletion Approval
                        </DialogTitle>
                        <DialogDescription>
                            You are about to approve the deletion of <b>{approvingReq?.metadata?.name || approvingReq?.oldData?.name}</b>.<br />
                            This action is irreversible. The entity will be permanently removed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label className="text-sm font-medium">Type <span className="font-bold text-destructive">APPROVE DELETE</span> to confirm:</Label>
                        <Input
                            value={approveConfirm}
                            onChange={(e) => setApproveConfirm(e.target.value)}
                            placeholder="APPROVE DELETE"
                            className="border-red-200 focus-visible:ring-red-500"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setApprovingReq(null); setApproveConfirm(''); }}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={submitApproveDelete}
                            disabled={approveConfirm !== 'APPROVE DELETE'}
                        >
                            Confirm Deletion
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Reject Change Request</DialogTitle>
                        <DialogDescription>Please provide a reason for rejecting this request.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="Reason for rejection..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Reject Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DiffView({ oldData, newData, changeType, constitutions }: { oldData: any, newData: any, changeType: string, constitutions?: { id: string, name: string }[] }) {
    if (changeType === 'CREATE') {
        const relevantFields = getRelevantFields(newData);
        return (
            <div className="rounded-md border bg-green-50/50 p-4">
                <h4 className="text-sm font-medium text-green-800 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> New Entry Details
                </h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {Object.entries(relevantFields).map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{formatLabel(key)}</dt>
                            <dd className="col-span-2 font-medium text-gray-900">{formatValue(value, constitutions)}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        );
    }

    if (changeType === 'DELETE_REQUEST') {
        return (
            <div className="rounded-md border border-red-100 bg-red-50/50 p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Deletion Request
                </h4>
                <p className="text-sm text-red-700">
                    This action will remove <strong>{oldData?.name}</strong> and all associated data.
                </p>
            </div>
        );
    }

    // UPDATE
    const changes = getChanges(oldData, newData);

    if (changes.length === 0) {
        return <div className="text-sm text-muted-foreground italic p-4 text-center">No distinct changes detected (internal updates only).</div>
    }

    return (
        <div className="rounded-md border overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 border-b grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Field</span>
                <span className="md:border-r border-transparent">Original</span>
                <span>New Value</span>
            </div>
            <div className="divide-y">
                {changes.map((change, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 text-sm hover:bg-muted/5 transition-colors">
                        <div className="font-medium text-gray-700 items-center flex">
                            {formatLabel(change.key)}
                        </div>
                        <div className="text-muted-foreground md:border-r font-mono text-xs md:text-sm flex items-center overflow-hidden text-ellipsis">
                            {formatValue(change.oldVal, constitutions)}
                        </div>
                        <div className="font-medium font-mono text-xs md:text-sm flex items-center overflow-hidden text-ellipsis text-blue-700">
                            {formatValue(change.newVal, constitutions)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ------------------------------------------------------------
// Helpers for visual niceness
// ------------------------------------------------------------

function getRelevantFields(data: any) {
    if (!data) return {};
    const { id, status, isDeleted, companyId, updatedBy, createdAt, updatedAt, createdBy, validatedBy, validatedAt, ...rest } = data;
    return rest;
}

function getChanges(oldData: any, newData: any) {
    const changes: { key: string, oldVal: any, newVal: any }[] = [];
    if (!oldData || !newData) return changes;

    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    const ignoredKeys = ['id', 'status', 'isDeleted', 'createdAt', 'updatedAt', 'updatedBy', 'companyId', 'validatedAt', 'validatedBy'];

    allKeys.forEach(key => {
        if (ignoredKeys.includes(key)) return;
        const oldVal = oldData[key];
        const newVal = newData[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes.push({ key, oldVal, newVal });
        }
    });

    return changes;
}

function formatLabel(key: string) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function formatValue(val: any, constitutions?: { id: string, name: string }[]) {
    if (val === null || val === undefined) return '-';

    // Handle ConstitutionRule object
    if (typeof val === 'object' && val.mode) {
        if (val.mode === 'ALL') return 'All Constitutions';

        let details = '';
        if (constitutions && val.ids && val.ids.length > 0) {
            const names = val.ids.map((id: string) => constitutions.find(c => c.id === id)?.name || id).join(', ');
            details = ` (${names})`;
        } else {
            details = ` (${val.ids?.length || 0})`;
        }

        if (val.mode === 'SELECT') {
            return `Selected: ${details}`;
        }
    }

    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

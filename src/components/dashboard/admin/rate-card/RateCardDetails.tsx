import React, { useState } from 'react';
import { ArrowLeft, Check, X, FileText, Calendar, Building, User, Edit, ShieldAlert, Briefcase, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { rateCardService } from '@/services/rateCardService';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const RateCardForm = dynamic(() => import('./RateCardForm'), { ssr: false });
const RateCardItemsSection = dynamic(() => import('./RateCardItemsSection'), { 
    ssr: false,
    loading: () => <div className="p-4 space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-[200px] w-full" /></div>
});

import { listenToDepartments, Department } from '@/lib/department-management';
import { sortDepartmentHierarchy } from '@/lib/sorting';
import { getRateCardItemCount } from '@/lib/rate-card-utils';
import { usePermissions } from '@/hooks/use-permissions';

interface RateCardDetailsProps {
    rateCardId: string;
    onBack: () => void;
    onEditDetails: () => void;
    isEditing: boolean;
    onCancelEdit: () => void;
    onSuccess: (id?: string) => void;
}

export default function RateCardDetails({ rateCardId, onBack, onEditDetails, isEditing, onCancelEdit, onSuccess }: RateCardDetailsProps) {
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    
    // We fetch rate card manually here or receive it from props? Let's just use useRateCards hook or similar
    // Actually since we only pass ID, we can fetch it. Let's use a simple state.
    const [rateCard, setRateCard] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    
    // Delete dialog state
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
    const [deleteInput, setDeleteInput] = React.useState('');
    const [isDeleting, setIsDeleting] = React.useState(false);

    React.useEffect(() => {
        const unsubscribe = listenToDepartments((data) => {
            setDepartments(sortDepartmentHierarchy(data));
        });
        return () => unsubscribe();
    }, []);
    
    const fetchDetails = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await rateCardService.getById(rateCardId);
            console.log("Reloaded rate card:", res.data);
            setRateCard(res.data);
            onSuccess(rateCardId); // Trigger list refresh in parent
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [rateCardId, onSuccess, toast]);

    React.useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const handleApprove = async () => {
        try {
            await rateCardService.approve(rateCardId);
            toast({ title: 'Success', description: 'Rate Card approved successfully' });
            fetchDetails();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleDelete = async () => {
        if (deleteInput !== 'delete') {
            toast({ title: 'Error', description: 'Please type "delete" to confirm', variant: 'destructive' });
            return;
        }

        setIsDeleting(true);
        try {
            await rateCardService.delete(rateCardId);
            toast({ title: 'Success', description: 'Rate Card deleted successfully' });
            setShowDeleteDialog(false);
            onBack();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSubmitForApproval = async () => {
        try {
            await rateCardService.submit(rateCardId);
            toast({ title: 'Success', description: 'Submitted for approval' });
            fetchDetails();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleReject = async () => {
        const reason = prompt('Reason for rejection:');
        if (reason === null) return;
        try {
            await rateCardService.reject(rateCardId, reason);
            toast({ title: 'Success', description: 'Rate Card rejected' });
            fetchDetails();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleApproveRequest = async (requestId: string) => {
        try {
            await rateCardService.approveRequest(requestId);
            toast({ title: 'Success', description: 'Request approved successfully' });
            fetchDetails();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        const reason = prompt('Reason for rejection:');
        if (reason === null) return;
        try {
            await rateCardService.rejectRequest(requestId, reason);
            toast({ title: 'Success', description: 'Request rejected' });
            fetchDetails();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center">Loading details...</div>;
    }

    if (!rateCard) {
        return <div className="flex h-full items-center justify-center">Rate card not found.</div>;
    }

    if (isEditing) {
        return (
            <div className="h-full flex flex-col bg-background">
                <div className="flex items-center gap-4 border-b p-4">
                    <Button variant="ghost" size="icon" onClick={onCancelEdit}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold">Edit Rate Card Details</h2>
                </div>
                <div className="flex-1 overflow-auto p-4">
                    <RateCardForm rateCardId={rateCardId} onSuccess={async () => {
                        await fetchDetails();
                        onSuccess(rateCardId);
                    }} onCancel={onCancelEdit} />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold">{rateCard.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={rateCard.status === 'active' ? 'default' : 'outline'}>{rateCard.status}</Badge>
                            {rateCard.approval_status === 'pending_approval' && (
                                <Badge variant="secondary" className="bg-amber-500 text-white">Pending Approval</Badge>
                            )}
                            {rateCard.approval_status === 'draft' && (
                                <Badge variant="outline">Draft</Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {rateCard.approval_status === 'draft' && hasPermission('rate_card.submit_approval') && (
                        <Button onClick={handleSubmitForApproval}>Submit for Approval</Button>
                    )}
                    {rateCard.approval_status === 'pending_approval' && hasPermission('rate_card.approve') && (
                        <>
                            <Button variant="outline" className="border-red-500 text-red-500" onClick={handleReject}>Reject</Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove}>Approve</Button>
                        </>
                    )}
                    {hasPermission('rate_card.edit') && (
                        <Button variant="outline" onClick={onEditDetails}>
                            <Edit className="h-4 w-4 mr-2" /> Edit Details
                        </Button>
                    )}
                    {hasPermission('rate_card.delete') && (
                        <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-50" onClick={() => setShowDeleteDialog(true)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Client Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-primary" />
                                <div className="font-medium flex items-center gap-2">
                                    {rateCard.client_type === 'direct' 
                                        ? (Array.isArray(rateCard.clients) && rateCard.clients.length > 0
                                            ? (rateCard.clients.length <= 2
                                                ? `Direct - ${rateCard.clients.map((c: any) => c.client_name || c.name || c.clientName).join(', ')}`
                                                : (
                                                    <div className="flex items-center gap-2">
                                                        <span>Direct - {(rateCard.clients[0]?.client_name || rateCard.clients[0]?.name || rateCard.clients[0]?.clientName)} + {rateCard.clients.length - 1} more</span>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="link" className="h-auto p-0 text-sm">
                                                                    View All
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-64 p-3 z-[60]">
                                                                <p className="font-semibold text-sm mb-2">Selected Clients</p>
                                                                <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                                                                    {rateCard.clients.map((c: any, idx: number) => (
                                                                        <span key={idx} className="text-sm font-normal">
                                                                            {c.client_name || c.name || c.clientName}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                ))
                                            : `Direct - ${rateCard.client?.client_name || 'All Clients'}`) 
                                        : `Associate - ${rateCard.associate?.company_name || rateCard.associate?.name || 'All Associates'}`}
                                </div>
                            </div>
                            {rateCard.business_profile && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Building className="h-4 w-4" />
                                    <span>Profile: {rateCard.business_profile.profile_name}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Constitution Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-primary" />
                                <div className="font-medium text-sm">
                                    {(!rateCard.constitution_ids || rateCard.constitution_ids.length === 0) 
                                        ? "All Constitutions" 
                                        : rateCard.constitution_ids.join(', ')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Building className="h-4 w-4" />
                                <span>
                                    {(!rateCard.sub_constitution_ids || rateCard.sub_constitution_ids.length === 0) 
                                        ? "All Sub Constitutions" 
                                        : rateCard.sub_constitution_ids.join(', ')}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Validity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span className="font-medium">
                                    {format(new Date(rateCard.applicable_from), 'dd MMM yyyy')}
                                </span>
                            </div>
                            {rateCard.applicable_until && (
                                <div className="text-sm text-muted-foreground ml-6 mt-1">
                                    Until {format(new Date(rateCard.applicable_until), 'dd MMM yyyy')}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Work Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-black">
                                {/* ₹{rateCard.grand_total?.toLocaleString() || '0'} */}
                                {getRateCardItemCount(rateCard)} Items
                            </div>
                           
                        </CardContent>
                    </Card>
                </div>

                {/* Service Items management */}
                <div className="mt-8 border-t pt-8">
                    <h3 className="text-lg font-semibold mb-4">Service Items</h3>
                    <RateCardItemsSection 
                        rateCardId={rateCardId}
                        departments={departments}
                        onItemsChanged={fetchDetails}
                    />
                </div>
                
                {rateCard.change_requests?.length > 0 && (
                    <div className="mt-8 border-t pt-8 border-amber-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-amber-700">
                            <ShieldAlert className="h-5 w-5 mr-2" /> Pending Change Requests
                        </h3>
                        <div className="space-y-4">
                            {rateCard.change_requests.filter((r: any) => r.approval_status === 'pending_approval').map((req: any) => (
                                <Card key={req.id} className="border-amber-200 bg-amber-50">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 mb-2">
                                                {req.change_type.toUpperCase()}
                                            </Badge>
                                            <p className="text-sm font-medium text-amber-900">
                                                {(req.change_type === 'edit' && !req.rate_card_item_id) || req.change_type === 'edit_rate_card' ? 'Rate Card Details Update' : `Service Item Update (${req.new_data?.work_item_name || 'Item'})`}
                                            </p>
                                        </div>
                                        {hasPermission('rate_card.approve') && (
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleRejectRequest(req.id)}>Reject</Button>
                                                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => handleApproveRequest(req.id)}>Approve</Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Rate Card</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this rate card? This action cannot be undone.
                            Please type <strong>delete</strong> to confirm.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input 
                            value={deleteInput} 
                            onChange={(e) => setDeleteInput(e.target.value)} 
                            placeholder="Type delete to confirm" 
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteInput !== 'delete' || isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

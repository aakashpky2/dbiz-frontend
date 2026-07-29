'use client';

import React, { useState } from 'react';
import { usePendingRequests } from '@/hooks/usePendingRequests';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Check, X, AlertCircle } from 'lucide-react';
import { ApprovalComparisonModal } from './ApprovalComparisonModal';
import { rateCardService } from '@/services/rateCardService';
import { useToast } from '@/hooks/use-toast';

export function PendingApprovalsTab() {
    const { requests, loading, error, refetch } = usePendingRequests({ approval_status: 'pending_approval' });
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const { toast } = useToast();

    const handleApprove = async (requestId: string) => {
        try {
            await rateCardService.approveRequest(requestId);
            toast({ title: 'Approved', description: 'Change request approved successfully.' });
            setSelectedRequest(null);
            refetch();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleReject = async (requestId: string) => {
        const reason = prompt('Please enter a reason for rejection:');
        if (reason === null) return; // cancelled

        try {
            await rateCardService.rejectRequest(requestId, reason);
            toast({ title: 'Rejected', description: 'Change request rejected successfully.' });
            setSelectedRequest(null);
            refetch();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading pending requests...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!requests || requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold">No Pending Approvals</h3>
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {requests.map((request: any) => (
                <Card key={request.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mr-4">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Request Type</p>
                                <p className="font-medium capitalize">
                                    {request.change_type === 'add' ? 'Service Item Add' :
                                     (request.change_type === 'edit' && request.rate_card_item_id) ? 'Service Item Edit' :
                                     request.change_type === 'delete' ? 'Service Item Delete' : 'Rate Card'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rate Card</p>
                                <p className="font-medium">{request.rate_card?.name || 'Unknown'}</p>
                            </div>
                            <div className="hidden md:block">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Submitted By</p>
                                <p className="font-medium">{request.submitted_by || 'System'}</p>
                            </div>
                            <div className="hidden md:block">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                                <p className="font-medium">{new Date(request.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button variant="outline" size="sm" onClick={() => setSelectedRequest(request)}>
                                <Eye className="w-4 h-4 mr-1" /> View
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(request.id)}>
                                <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleReject(request.id)}>
                                <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}

            <ApprovalComparisonModal 
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                request={selectedRequest}
                onApprove={handleApprove}
                onReject={handleReject}
            />
        </div>
    );
}

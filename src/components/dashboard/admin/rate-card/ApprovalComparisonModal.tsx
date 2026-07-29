'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface ApprovalComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}

export function ApprovalComparisonModal({
    isOpen,
    onClose,
    request,
    onApprove,
    onReject
}: ApprovalComparisonModalProps) {
    if (!request) return null;

    const { change_type, old_data, new_data } = request;
    
    // We only want to show fields that are actually relevant for the comparison
    const getFieldsToCompare = () => {
        const fields = new Set<string>();
        if (old_data) Object.keys(old_data).forEach(k => fields.add(k));
        if (new_data) Object.keys(new_data).forEach(k => fields.add(k));
        
        // Exclude system fields
        ['id', 'created_at', 'updated_at', 'rate_card_id', 'is_active', 'status', 'approval_status'].forEach(k => fields.delete(k));
        
        return Array.from(fields);
    };

    const formatValue = (key: string, val: any) => {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'object') return JSON.stringify(val);
        // Add currency formatting if it looks like a fee
        if (key.includes('fee') || key.includes('total') || key.includes('amount')) {
            return `₹${Number(val).toLocaleString('en-IN')}`;
        }
        return String(val);
    };

    const renderComparisonRow = (field: string) => {
        const oldVal = old_data ? old_data[field] : undefined;
        const newVal = new_data ? new_data[field] : undefined;
        
        // Skip rendering if both are empty and we are not deleting
        if (oldVal === undefined && newVal === undefined) return null;

        const isChanged = change_type === 'edit' && JSON.stringify(oldVal) !== JSON.stringify(newVal);

        return (
            <div key={field} className="grid grid-cols-3 gap-4 py-2 border-b last:border-0 text-sm">
                <div className="font-medium text-muted-foreground capitalize">
                    {field.replace(/_/g, ' ')}
                </div>
                {change_type !== 'add' && (
                    <div className={`${isChanged ? 'text-red-500 line-through opacity-70' : ''}`}>
                        {formatValue(field, oldVal)}
                    </div>
                )}
                {change_type === 'add' && <div className="text-muted-foreground italic">N/A</div>}
                
                {change_type !== 'delete' && (
                    <div className={`${isChanged ? 'text-green-600 font-semibold' : ''}`}>
                        {formatValue(field, newVal)}
                    </div>
                )}
                {change_type === 'delete' && <div className="text-muted-foreground italic">Deleted</div>}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Review {change_type.charAt(0).toUpperCase() + change_type.slice(1)} Request
                    </DialogTitle>
                    <DialogDescription>
                        Review the changes before approving or rejecting.
                    </DialogDescription>
                </DialogHeader>

                <div className="my-4 border rounded-md">
                    <div className="grid grid-cols-3 gap-4 p-3 bg-muted font-semibold text-sm border-b">
                        <div>Field</div>
                        <div>Old Value</div>
                        <div>New Value</div>
                    </div>
                    <div className="p-4 max-h-[60vh] overflow-y-auto">
                        {getFieldsToCompare().map(renderComparisonRow)}
                    </div>
                </div>

                <DialogFooter className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => onReject(request.id)}>
                        <X className="w-4 h-4 mr-2" />
                        Reject
                    </Button>
                    <Button onClick={() => onApprove(request.id)}>
                        <Check className="w-4 h-4 mr-2" />
                        Approve Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

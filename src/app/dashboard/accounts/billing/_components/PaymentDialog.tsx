"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/apiFetch';

interface PaymentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
    onSuccess: () => void;
}

export default function PaymentDialog({ isOpen, onClose, invoice, onSuccess }: PaymentDialogProps) {
    const [amount, setAmount] = useState(invoice?.balance_amount?.toString() || '');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMode, setPaymentMode] = useState('Bank Transfer');
    const [referenceNo, setReferenceNo] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const payAmount = parseFloat(amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            alert("Please enter a valid amount greater than 0");
            return;
        }
        
        if (payAmount > parseFloat(invoice.balance_amount)) {
            alert(`Amount cannot exceed the balance amount of ₹${invoice.balance_amount}`);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await apiFetch(`/api/billing/${invoice.id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: payAmount,
                    payment_date: paymentDate,
                    payment_mode: paymentMode,
                    reference_no: referenceNo,
                    notes
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Payment added successfully.");
                onSuccess();
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to add payment. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Payment to Invoice {invoice?.invoice_no}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-slate-500">Invoice Total</p>
                            <p className="font-semibold">₹{invoice?.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-amber-600 font-medium">Pending Balance</p>
                            <p className="font-bold text-amber-600">₹{invoice?.balance_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Payment Amount (₹)</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                required 
                                max={invoice?.balance_amount}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input 
                                type="date" 
                                value={paymentDate} 
                                onChange={e => setPaymentDate(e.target.value)} 
                                required 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Payment Mode</Label>
                            <Select value={paymentMode} onValueChange={setPaymentMode}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                                    <SelectItem value="UPI">UPI</SelectItem>
                                    <SelectItem value="Cheque">Cheque</SelectItem>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Reference No (Optional)</Label>
                            <Input 
                                placeholder="UTR / Txn ID / Chq No" 
                                value={referenceNo} 
                                onChange={e => setReferenceNo(e.target.value)} 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea 
                            placeholder="Add any remarks..." 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            rows={2}
                        />
                    </div>
                    
                    <DialogFooter className="pt-4 border-t mt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Processing..." : "Record Payment"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

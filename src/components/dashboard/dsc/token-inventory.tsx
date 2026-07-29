'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDSCMasters } from '@/hooks/use-dsc-masters';
import { useDSCRecords } from '@/hooks/use-dsc-records';
import { supabase } from '@/lib/supabase';
import { Plus, Loader2 } from 'lucide-react';
import { fmtDate } from './dsc-utils';
import { useToast } from '@/hooks/use-toast';

export function TokenInventory() {
    const { items } = useDSCMasters();
    const { purchases, sales, refetch } = useDSCRecords();
    const [isOpen, setIsOpen] = useState(false);

    const [formData, setFormData] = useState({
        itemId: '',
        quantity: 1,
        purchaseRate: 0,
        supplierName: '',
        batchNo: '',
    });

    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const dataToInsert = {
                invoice_date: new Date().toISOString().split('T')[0],
                token_id: formData.itemId,
                quantity: Number(formData.quantity),
                rate_per_token: Number(formData.purchaseRate),
                supplier_name: formData.supplierName,
                batch_no: formData.batchNo,
            };

            const { error } = await supabase.from('token_purchases').insert([dataToInsert]);
            if (error) throw error;

            await refetch();
            toast({ title: 'Success', description: 'Purchase entry saved successfully.' });
            setIsOpen(false);
            setFormData({ itemId: '', quantity: 1, purchaseRate: 0, supplierName: '', batchNo: '' });
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to save data. ", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const inventorySummary = useMemo(() => {
        const summary: Record<string, { in: number; out: number; bal: number }> = {};

        // Initialize with all items
        items.forEach(i => {
            summary[i.id] = { in: 0, out: 0, bal: 0 };
        });

        purchases.forEach(p => {
            if (!summary[p.itemId]) summary[p.itemId] = { in: 0, out: 0, bal: 0 };
            summary[p.itemId].in += Number(p.quantity);
            summary[p.itemId].bal += Number(p.quantity);
        });

        sales.forEach(s => {
            if (!summary[s.itemId]) summary[s.itemId] = { in: 0, out: 0, bal: 0 };
            summary[s.itemId].out += Number(s.quantity);
            summary[s.itemId].bal -= Number(s.quantity);
        });

        return summary;
    }, [items, purchases, sales]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Token Stock Summary</CardTitle>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="w-4 h-4 mr-2" /> Purchase Entry</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">New Purchase Entry</DialogTitle></DialogHeader>
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>Item</Label>
                                    <Select value={formData.itemId} onValueChange={v => setFormData({ ...formData, itemId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select Item" /></SelectTrigger>
                                        <SelectContent>
                                            {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Quantity</Label>
                                    <Input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Purchase Rate</Label>
                                    <Input type="number" value={formData.purchaseRate} onChange={e => setFormData({ ...formData, purchaseRate: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Supplier Name</Label>
                                    <Input value={formData.supplierName} onChange={e => setFormData({ ...formData, supplierName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Batch No</Label>
                                    <Input value={formData.batchNo} onChange={e => setFormData({ ...formData, batchNo: e.target.value })} />
                                </div>
                            </div>
                            <div className="border-t p-6 pt-4 shrink-0 flex">
                                <Button onClick={handleSave} className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Save Purchase
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item Name</TableHead>
                                <TableHead>Total In</TableHead>
                                <TableHead>Total Out</TableHead>
                                <TableHead className="font-bold">Balance On Hand</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map(item => {
                                const s = inventorySummary[item.id] || { in: 0, out: 0, bal: 0 };
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{s.in}</TableCell>
                                        <TableCell>{s.out}</TableCell>
                                        <TableCell className="font-bold">{s.bal}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Recent Purchases</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>Batch</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {purchases.slice().reverse().slice(0, 10).map(p => {
                                const itemName = items.find(i => i.id === p.itemId)?.name || 'Unknown';
                                return (
                                    <TableRow key={p.id}>
                                        <TableCell>{fmtDate(p.purchaseDate)}</TableCell>
                                        <TableCell>{itemName}</TableCell>
                                        <TableCell>{p.supplierName}</TableCell>
                                        <TableCell>{p.quantity}</TableCell>
                                        <TableCell>{p.purchaseRate}</TableCell>
                                        <TableCell>{p.batchNo}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

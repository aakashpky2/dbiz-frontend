'use client';

import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDSCRecords } from '@/hooks/use-dsc-records';
import { useDSCMasters } from '@/hooks/use-dsc-masters';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowRightLeft, History } from 'lucide-react';
import { fmtDate } from './dsc-utils';

export function ClientOwnedDSC() {
    const { clientOwned, movementByDscKey, refetch } = useDSCRecords();
    const { usageTypes, purposeTypes, validities } = useDSCMasters();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { toast } = useToast();

    // Form State
    const [formData, setFormData] = useState({
        clientNameSnapshot: '',
        personName: '',
        usageTypeId: '',
        purposeTypeId: '',
        validityId: '',
        issueDate: '',
        expiryDate: '',
        providerName: '',
        certificateSerialNo: '',
        remarks: '',
        status: 'Received'
    });

    const handleSave = async () => {
        try {
            const payload = {
                company_name: formData.clientNameSnapshot,
                member_id: formData.personName,
                type_id: formData.usageTypeId,
                authority_id: formData.purposeTypeId,
                validity_id: formData.validityId,
                issue_date: formData.issueDate,
                expiry_date: formData.expiryDate,
                provider_name: formData.providerName,
                certificate_serial_no: formData.certificateSerialNo,
                remarks: formData.remarks,
                status: formData.status,
                type: 'CLIENT_OWNED'
            };

            if (editingId) {
                const { error } = await supabase.from('dscs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('dscs').insert([payload]);
                if (error) throw error;
            }

            await refetch();
            toast({ title: 'Success', description: editingId ? 'Updated successfully.' : 'Added successfully.' });
            setIsOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setFormData({
            clientNameSnapshot: item.clientNameSnapshot || '',
            personName: item.personName || '',
            usageTypeId: item.usageTypeId || '',
            purposeTypeId: item.purposeTypeId || '',
            validityId: item.validityId || '',
            issueDate: item.issueDate || '',
            expiryDate: item.expiryDate || '',
            providerName: item.providerName || '',
            certificateSerialNo: item.certificateSerialNo || '',
            remarks: item.remarks || '',
            status: item.status || 'Received'
        });
        setIsOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            clientNameSnapshot: '',
            personName: '',
            usageTypeId: '',
            purposeTypeId: '',
            validityId: '',
            issueDate: '',
            expiryDate: '',
            providerName: '',
            certificateSerialNo: '',
            remarks: '',
            status: 'Received'
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Client Owned DSCs</CardTitle>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={resetForm}><Plus className="w-4 h-4 mr-2" /> Register New DSC</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">{editingId ? 'Edit' : 'Register'} Client DSC</DialogTitle></DialogHeader>
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Client Name</Label>
                                    <Input value={formData.clientNameSnapshot} onChange={e => setFormData({ ...formData, clientNameSnapshot: e.target.value })} placeholder="Company Name" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Person Name</Label>
                                    <Input value={formData.personName} onChange={e => setFormData({ ...formData, personName: e.target.value })} placeholder="John Doe" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Usage Type</Label>
                                    <Select value={formData.usageTypeId} onValueChange={v => setFormData({ ...formData, usageTypeId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select Usage" /></SelectTrigger>
                                        <SelectContent>
                                            {usageTypes.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Purpose Type</Label>
                                    <Select value={formData.purposeTypeId} onValueChange={v => setFormData({ ...formData, purposeTypeId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select Purpose" /></SelectTrigger>
                                        <SelectContent>
                                            {purposeTypes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Validity</Label>
                                    <Select value={formData.validityId} onValueChange={v => setFormData({ ...formData, validityId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select Validity" /></SelectTrigger>
                                        <SelectContent>
                                            {validities.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Current Status</Label>
                                    <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Received">Received</SelectItem>
                                            <SelectItem value="InCustody">In Custody</SelectItem>
                                            <SelectItem value="Out">Out</SelectItem>
                                            <SelectItem value="Returned">Returned</SelectItem>
                                            <SelectItem value="Expired">Expired</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Issue Date</Label>
                                    <Input type="date" value={formData.issueDate} onChange={e => setFormData({ ...formData, issueDate: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Expiry Date</Label>
                                    <Input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Provider / CA</Label>
                                    <Input value={formData.providerName} onChange={e => setFormData({ ...formData, providerName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Certificate Serial No</Label>
                                    <Input value={formData.certificateSerialNo} onChange={e => setFormData({ ...formData, certificateSerialNo: e.target.value })} />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <Label>Remarks</Label>
                                    <Textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
                                </div>
                                </div>
                            </div>
                            <div className="border-t p-6 pt-4 shrink-0 flex justify-end">
                                <Button onClick={handleSave} className="min-w-[120px] h-11 rounded-xl font-bold shadow-lg shadow-primary/20">Save Record</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client / Person</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clientOwned.map((item) => {
                                const u = usageTypes.find(x => x.id === item.usageTypeId)?.name || '';
                                const p = purposeTypes.find(x => x.id === item.purposeTypeId)?.name || '';
                                const moves = movementByDscKey[`CLIENT_OWNED:${item.id}`] || [];

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium">{item.clientNameSnapshot || 'Unknown'}</div>
                                            <div className="text-xs text-muted-foreground">{item.personName}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{u} {p}</div>
                                            <div className="text-xs text-muted-foreground">{item.providerName}</div>
                                        </TableCell>
                                        <TableCell>{fmtDate(item.expiryDate)}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === 'InCustody' ? 'default' : 'secondary'}>{item.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" className="mr-2" onClick={() => handleEdit(item)}>Edit</Button>
                                            <MovementDialog dsc={item} dscType="CLIENT_OWNED" movements={moves} />
                                        </TableCell>
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

function MovementDialog({ dsc, dscType, movements }: { dsc: any, dscType: 'ISSUED' | 'CLIENT_OWNED', movements: any[] }) {
    const { refetch } = useDSCRecords();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        movementType: 'OUT',
        toName: '',
        purpose: '',
        how: 'InPerson',
        courierName: '',
        trackingNo: '',
        remarks: ''
    });

    const { toast } = useToast();
    const handleSave = async () => {
        try {
            const movementData = {
                dsc_id: dsc.id,
                movement_type: form.movementType,
                movement_date: new Date().toISOString().split('T')[0],
                member_id: form.toName,
                remarks: `Purpose: ${form.purpose} | How: ${form.how} ` + (form.courierName ? `| Courier: ${form.courierName} (${form.trackingNo})` : '')
            };

            const { error: moveError } = await supabase.from('dsc_movements').insert([movementData]);
            if (moveError) throw moveError;

            const newStatus = form.movementType === 'OUT' ? 'Out' : 'InCustody';
            const { error: updateError } = await supabase.from('dscs').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', dsc.id);
            if (updateError) throw updateError;

            await refetch();
            toast({ title: 'Movement Recorded', description: `DSC moved ${form.movementType}` });
            setOpen(false);
            setForm({ movementType: 'OUT', toName: '', purpose: '', how: 'InPerson', courierName: '', trackingNo: '', remarks: '' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon"><History className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">Movement Log</DialogTitle></DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <h4 className="font-semibold text-sm">Add New Movement</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={form.movementType} onValueChange={v => setForm({ ...form, movementType: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="IN">IN (Receive)</SelectItem>
                                    <SelectItem value="OUT">OUT (Dispatch)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{form.movementType === 'IN' ? 'Received From' : 'Given To'}</Label>
                            <Input value={form.toName} onChange={e => setForm({ ...form, toName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Purpose</Label>
                            <Input value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>How?</Label>
                            <Select value={form.how} onValueChange={v => setForm({ ...form, how: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="InPerson">In Person</SelectItem>
                                    <SelectItem value="Courier">Courier</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {form.how === 'Courier' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Courier Name</Label>
                                    <Input value={form.courierName} onChange={e => setForm({ ...form, courierName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tracking No</Label>
                                    <Input value={form.trackingNo} onChange={e => setForm({ ...form, trackingNo: e.target.value })} />
                                </div>
                            </>
                        )}
                        <div className="col-span-2">
                            <Button onClick={handleSave} className="w-full">Record Movement</Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="font-semibold text-sm">History</h4>
                    {movements.length === 0 ? <p className="text-xs text-muted-foreground">No movements recorded</p> : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {movements.map(m => (
                                <div key={m.id} className="text-sm border p-2 rounded">
                                    <div className="flex justify-between font-medium">
                                        <span className={m.movementType === 'IN' ? 'text-green-600' : 'text-orange-600'}>{m.movementType}</span>
                                        <span className="text-xs text-muted-foreground">{new Date(m.movementAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-xs">{m.movementType === 'IN' ? 'From' : 'To'}: {m.toName}</div>
                                    <div className="text-xs">Via: {m.how} {m.courier?.trackingNo ? `(${m.courier.trackingNo})` : ''}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

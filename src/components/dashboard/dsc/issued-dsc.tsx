'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useDSCRecords } from '@/hooks/use-dsc-records';
import { useDSCMasters } from '@/hooks/use-dsc-masters';
import { useClients } from '@/hooks/use-clients';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Truck, RefreshCw, AlertCircle, History } from 'lucide-react';
import { fmtDate, addYearsISO, todayISO } from './dsc-utils';
import { pickActivePricing, computeTotalPrice } from '@/lib/dsc';

export function IssuedDSC() {
    const { issued, refetch } = useDSCRecords();
    const { data: clientsData } = useClients();
    const clients = clientsData?.data || [];
    const { usageTypes, purposeTypes, validities, pricings, templates, fields } = useDSCMasters();
    const { toast } = useToast();

    const [isOrderOpen, setIsOrderOpen] = useState(false);

    // Order Form State
    const [orderForm, setOrderForm] = useState({
        clientId: '',
        personName: '',
        personRole: '',
        usageTypeId: '',
        purposeTypeId: '',
        validityId: '',
        tokenIncluded: false,
        priceSnapshot: null as any,
        formData: {} as Record<string, any> // Dynamic fields
    });

    // Derived State
    const activePricing = useMemo(() => {
        return pickActivePricing(
            pricings,
            orderForm.usageTypeId,
            orderForm.purposeTypeId,
            orderForm.validityId,
            orderForm.tokenIncluded,
            todayISO()
        );
    }, [pricings, orderForm.usageTypeId, orderForm.purposeTypeId, orderForm.validityId, orderForm.tokenIncluded]);

    const activeTemplate = useMemo(() => {
        // Find active template for usage type (simplified: take first match)
        return templates.find(t => t.usageTypeId === orderForm.usageTypeId && t.isActive !== false);
    }, [templates, orderForm.usageTypeId]);

    const templateFields = useMemo(() => {
        if (!activeTemplate || !activeTemplate.fields) return [];
        return activeTemplate.fields
            .map(tf => {
                const f = fields.find(field => field.id === tf.fieldId);
                return f ? { ...f, ...tf } : null;
            })
            .filter(f => f !== null)
            .sort((a, b) => (a!.order || 0) - (b!.order || 0));
    }, [activeTemplate, fields]);

    const handleCreateOrder = async () => {
        try {
            const client = clients.find((c: any) => c.id === orderForm.clientId);
            const clientName = client ? client.clientName : '';

            // 1. Create DSC Record (Pending Issue)
            const { data: dscData, error: dscError } = await supabase.from('dscs').insert([{
                company_name: clientName,
                type_id: orderForm.usageTypeId,
                authority_id: orderForm.purposeTypeId,
                validity_id: orderForm.validityId,
                status: 'Ordered',
                remarks: `Order details: Person: ${orderForm.personName} (${orderForm.personRole}) | Included Token: ${orderForm.tokenIncluded}`,
            }]).select();

            if (dscError) throw dscError;

            const newDscId = dscData[0].id;

            // 2. Map the Client Link
            const { error: linkError } = await supabase.from('dsc_links').insert([{
                dsc_id: newDscId,
                client_id: orderForm.clientId,
                role_key: orderForm.personRole,
                member_id: orderForm.personName,
                remarks: 'Initial link from order creation'
            }]);

            if (linkError) throw linkError;

            // 3. Option to create a token sale automatically (Ignored for now to reduce scope length)

            toast({ title: 'Success', description: 'DSC Order created.' });
            setIsOrderOpen(false);
            setOrderForm({
                clientId: '',
                personName: '',
                personRole: '',
                usageTypeId: '',
                purposeTypeId: '',
                validityId: '',
                tokenIncluded: false,
                priceSnapshot: null,
                formData: {}
            });
            await refetch();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Issued DSC Management</CardTitle>
                    <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
                        <DialogTrigger asChild>
                            <Button className="min-w-[160px] rounded-xl shadow-lg ring-1 ring-primary/20 transition-all active:scale-95">
                                <Plus className="w-4 h-4 mr-2" /> New DSC Order
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
                            <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">Create New DSC Order</DialogTitle></DialogHeader>
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 1. Client & Person */}
                                <div className="space-y-2">
                                    <Label>Client</Label>
                                    <Select value={orderForm.clientId} onValueChange={v => setOrderForm({ ...orderForm, clientId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                                        <SelectContent>
                                            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.clientName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Applicant Name</Label>
                                    <Input value={orderForm.personName} onChange={e => setOrderForm({ ...orderForm, personName: e.target.value })} placeholder="Person Name" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role / Designation</Label>
                                    <Input value={orderForm.personRole} onChange={e => setOrderForm({ ...orderForm, personRole: e.target.value })} placeholder="Director, Partner, etc." />
                                </div>

                                {/* 2. DSC Type Config */}
                                <div className="space-y-2">
                                    <Label>Usage Type</Label>
                                    <Select value={orderForm.usageTypeId} onValueChange={v => setOrderForm({ ...orderForm, usageTypeId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Usage" /></SelectTrigger>
                                        <SelectContent>{usageTypes.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Purpose Type</Label>
                                    <Select value={orderForm.purposeTypeId} onValueChange={v => setOrderForm({ ...orderForm, purposeTypeId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Purpose" /></SelectTrigger>
                                        <SelectContent>{purposeTypes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Validity</Label>
                                    <Select value={orderForm.validityId} onValueChange={v => setOrderForm({ ...orderForm, validityId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Validity" /></SelectTrigger>
                                        <SelectContent>{validities.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2 pt-8">
                                    <Checkbox checked={orderForm.tokenIncluded} onCheckedChange={(c: any) => setOrderForm({ ...orderForm, tokenIncluded: !!c })} />
                                    <Label>Include Token?</Label>
                                </div>

                                {/* 3. Pricing Display */}
                                <div className="col-span-1 md:col-span-2 bg-muted p-4 rounded-md">
                                    <Label className="font-semibold mb-2 block">Pricing Details</Label>
                                    {activePricing ? (
                                        <div className="flex justify-between text-sm">
                                            <span>Base: ₹{activePricing.basePrice}</span>
                                            <span>GST ({activePricing.gstRate}%): ₹{Math.round(activePricing.basePrice * (activePricing.gstRate || 0) / 100)}</span>
                                            <span className="font-bold text-lg">Total: ₹{computeTotalPrice(activePricing.basePrice, activePricing.gstRate)}</span>
                                        </div>
                                    ) : (
                                        <div className="text-red-500 text-sm">No pricing configured for this combination.</div>
                                    )}
                                </div>

                                {/* 4. Dynamic Fields */}
                                {templateFields.length > 0 && (
                                    <div className="col-span-1 md:col-span-2 space-y-4 border-t pt-4">
                                        <Label className="font-semibold">Required Details</Label>
                                        {templateFields.map((field: any) => (
                                            <div key={field.id} className="space-y-1">
                                                <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                                                {field.fieldType === 'dropdown' ? (
                                                    <Select
                                                        value={orderForm.formData[field.fieldKey] || ''}
                                                        onValueChange={v => setOrderForm({ ...orderForm, formData: { ...orderForm.formData, [field.fieldKey]: v } })}
                                                    >
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {(field.dropdownOptions || []).map((opt: string) => (
                                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input
                                                        type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
                                                        value={orderForm.formData[field.fieldKey] || ''}
                                                        onChange={e => setOrderForm({ ...orderForm, formData: { ...orderForm.formData, [field.fieldKey]: e.target.value } })}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                </div>
                            </div>
                            <div className="border-t p-6 pt-4 shrink-0 flex justify-end">
                                <Button onClick={handleCreateOrder} disabled={!activePricing} className="min-w-[120px] h-11 rounded-xl font-bold shadow-lg shadow-primary/20">
                                    Create Order
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client / Applicant</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Issued / Expiring</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {issued.map((item) => {
                                const u = usageTypes.find(x => x.id === item.usageTypeId)?.name || '';
                                const p = purposeTypes.find(x => x.id === item.purposeTypeId)?.name || '';
                                const v = validities.find(x => x.id === item.validityId)?.years || 2;

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium">{item.clientNameSnapshot}</div>
                                            <div className="text-xs text-muted-foreground">{item.personName} ({item.personRole})</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{u} {p}</div>
                                            <div className="text-xs text-muted-foreground">{v} Years</div>
                                        </TableCell>
                                        <TableCell>
                                            {item.issueDate ? (
                                                <>
                                                    <div className="text-xs">Iss: {fmtDate(item.issueDate)}</div>
                                                    <div className="text-xs text-red-500">Exp: {fmtDate(item.expiryDate)}</div>
                                                </>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === 'Issued' ? 'default' : item.status === 'Ordered' ? 'outline' : 'secondary'}>{item.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right flex justify-end gap-1">
                                            <IssueAction dsc={item} years={v} />
                                            <MovementDialog dsc={item} dscType="ISSUED" />
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

function IssueAction({ dsc, years }: { dsc: any, years: number }) {
    const { refetch } = useDSCRecords();
    const [open, setOpen] = useState(false);
    const [issueData, setIssueData] = useState({
        issueDate: todayISO(),
        certificateSerialNo: '',
        providerName: ''
    });

    const { toast } = useToast();
    const handleIssue = async () => {
        try {
            const expiryDate = addYearsISO(issueData.issueDate, years);

            const { error } = await supabase.from('dscs').update({
                status: 'Issued',
                issue_date: issueData.issueDate,
                expiry_date: expiryDate,
                remarks: `Cert Serial: ${issueData.certificateSerialNo} | Provider: ${issueData.providerName}`,
                updated_at: new Date().toISOString()
            }).eq('id', dsc.id);

            if (error) throw error;
            await refetch();
            toast({ title: 'Success', description: 'DSC Issued.' });
            setOpen(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    if (dsc.status !== 'Ordered') return null; // Only allow issuing for Ordered status

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="min-w-[110px] rounded-lg border-slate-200">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Mark Issued
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">Mark DSC as Issued</DialogTitle></DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Issue Date</Label>
                        <Input type="date" value={issueData.issueDate} onChange={e => setIssueData({ ...issueData, issueDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Provider / CA</Label>
                        <Input value={issueData.providerName} onChange={e => setIssueData({ ...issueData, providerName: e.target.value })} placeholder="e.g. eMudhra, Capricorn" />
                    </div>
                    <div className="space-y-2">
                        <Label>Certificate Serial No</Label>
                        <Input value={issueData.certificateSerialNo} onChange={e => setIssueData({ ...issueData, certificateSerialNo: e.target.value })} />
                    </div>
                    </div>
                <div className="border-t p-6 pt-4 shrink-0 flex">
                    <Button onClick={handleIssue} className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20">
                        Confirm Issuance
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MovementDialog({ dsc, dscType }: { dsc: any, dscType: 'ISSUED' | 'CLIENT_OWNED' }) {
    const { movementByDscKey, refetch } = useDSCRecords();
    const movements = movementByDscKey[`${dscType}:${dsc.id}`] || [];
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
            const data = {
                dsc_id: dsc.id,
                movement_type: form.movementType,
                movement_date: new Date().toISOString().split('T')[0],
                member_id: form.toName,
                remarks: `Purpose: ${form.purpose} | How: ${form.how} ` + (form.courierName ? `| Courier: ${form.courierName} (${form.trackingNo})` : '')
            };

            const { error: moveError } = await supabase.from('dsc_movements').insert([data]);
            if (moveError) throw moveError;

            // Logic: If Issued DSC is OUT, status is 'Out'. If IN, status returns to 'Issued' (Active).
            const statusToSet = dscType === 'ISSUED' ? (form.movementType === 'OUT' ? 'Out' : 'Issued') : (form.movementType === 'OUT' ? 'Out' : 'InCustody');

            const { error: updateError } = await supabase.from('dscs').update({ status: statusToSet, updated_at: new Date().toISOString() }).eq('id', dsc.id);
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
                <Button variant="ghost" size="icon"><Truck className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
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
                            <Button onClick={handleSave} className="w-full h-10 rounded-xl font-bold shadow-md shadow-primary/10">
                                Record Movement
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="font-semibold text-sm">History</h4>
                    {movements.length === 0 ? <p className="text-xs text-muted-foreground">No movements recorded</p> : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {movements.map((m: any) => (
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

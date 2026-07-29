'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
    Check,
    ChevronsUpDown,
    PlusCircle,
    ShieldCheck,
    CheckCircle2,
    Circle,
    CreditCard,
    Truck,
    Info,
    Key,
    History,
    FileText,
    UserCheck,
    Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Client, DSC, DSCWorkflowStage } from './types';
import { DSCWorkflowTimeline } from './dsc-workflow-timeline';

interface DSCFormTabsProps {
    form: any;
    setForm: (form: any) => void;
    clients: Client[];
    workflowStages: DSCWorkflowStage[];
    isIssuedStage: boolean;
    editingDsc: DSC | null;
    newFollowup: string;
    setNewFollowup: (val: string) => void;
    clientSearch: string;
    setClientSearch: (val: string) => void;
    isClientPopoverOpen: boolean;
    setIsClientPopoverOpen: (val: boolean) => void;
    getMembers: (clientId: string, roleKey: string) => any[];
}

export function DSCFormTabs({
    form,
    setForm,
    clients,
    workflowStages,
    isIssuedStage,
    editingDsc,
    newFollowup,
    setNewFollowup,
    clientSearch,
    setClientSearch,
    isClientPopoverOpen,
    setIsClientPopoverOpen,
    getMembers
}: DSCFormTabsProps) {

    const [masters, setMasters] = useState<{ cls: any[], typ: any[], val: any[], auth: any[], rates: any[] }>({ cls: [], typ: [], val: [], auth: [], rates: [] });
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const res = await fetch('/api/dsc/masters');
                if (res.ok) {
                    const data = await res.json();
                    setMasters(data);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchMasters();
    }, []);

    useEffect(() => {
        if (form.classId && form.typeId && form.validityId && form.authorityId) {
            const eligible = masters.rates.filter(r =>
                r.classId === form.classId && r.typeId === form.typeId &&
                r.validityId === form.validityId && r.authorityId === form.authorityId
            ).sort((a, b) => new Date(b.applicableFrom).getTime() - new Date(a.applicableFrom).getTime());

            const curDate = form.issueDate || new Date().toISOString().split('T')[0];
            const matching = eligible.find(r => new Date(r.applicableFrom) <= new Date(curDate));
            if (matching && matching.totalAmount !== form.paymentAmount) {
                setForm({ ...form, paymentAmount: matching.totalAmount });
            }
        }
    }, [form.classId, form.typeId, form.validityId, form.authorityId, form.issueDate, masters.rates]);

    const toggleVerification = (field: 'mobile' | 'email' | 'video') => {
        const current = form.verificationStatus?.[field] || 'PENDING';
        setForm({
            ...form,
            verificationStatus: {
                ...form.verificationStatus,
                [field]: current === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
            }
        });
    };

    const toggleKYC = (field: 'pan' | 'aadhar' | 'photo') => {
        const current = form.kycStatus?.[field] || 'PENDING';
        setForm({
            ...form,
            kycStatus: {
                ...form.kycStatus,
                [field]: current === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
            }
        });
    };

    return (
        <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 mb-4 bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="basic" className="py-2 text-xs flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Basic Info
                </TabsTrigger>
                <TabsTrigger value="verification" className="py-2 text-xs flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" /> Verification
                </TabsTrigger>
                <TabsTrigger value="financial" className="py-2 text-xs flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> Financial & Delivery
                </TabsTrigger>
                <TabsTrigger value="tech" className="py-2 text-xs flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" /> Passwords
                </TabsTrigger>
                <TabsTrigger value="timeline" className="py-2 text-xs flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" /> Timeline
                </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Client Selection</Label>
                        <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between h-10 border-slate-200">
                                    {form.companyName || "Select Client..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0 shadow-xl border-slate-200">
                                <Command>
                                    <CommandInput placeholder="Search client..." onValueChange={(val: any) => setClientSearch(typeof val === 'string' ? val : (val?.target?.value || ''))} />
                                    <CommandList>
                                        <CommandEmpty>
                                            <Button variant="ghost" className="w-full text-left justify-start" onClick={() => {
                                                setForm({ ...form, companyName: clientSearch, clientId: '' });
                                                setIsClientPopoverOpen(false);
                                            }}>
                                                <PlusCircle className="mr-2 h-4 w-4 text-blue-500" /> Add "{clientSearch}" manually
                                            </Button>
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {clients.map((c) => (
                                                <CommandItem key={c.id} value={c.clientName} onSelect={() => {
                                                    setForm({ ...form, companyName: c.clientName, clientId: c.id, roleKey: '', memberId: '' });
                                                    setIsClientPopoverOpen(false);
                                                }}>
                                                    <Check className={cn("mr-2 h-4 w-4", form.clientId === c.id ? "opacity-100" : "opacity-0")} />
                                                    {c.clientName}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Select Member</Label>
                        <Select value={form.memberId} onValueChange={(mid: any) => {
                            if (typeof mid !== 'string') return;
                            const client = clients.find(c => c.id === form.clientId);
                            if (client?.roles) {
                                for (const [rKey, rVal] of Object.entries(client.roles)) {
                                    if (rVal.members?.[mid]) {
                                        const m = rVal.members[mid].details;
                                        setForm({
                                            ...form,
                                            memberId: mid,
                                            roleKey: rKey,
                                            email: m?.email || '',
                                            phone: (m as any)?.phone || '',
                                            mobile: (m as any)?.mobile || (m as any)?.phone || ''
                                        });
                                        break;
                                    }
                                }
                            }
                        }} disabled={!form.clientId}>
                            <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Select Member" /></SelectTrigger>
                            <SelectContent>
                                {form.clientId && clients.find(c => c.id === form.clientId)?.roles && Object.entries(clients.find(c => c.id === form.clientId)!.roles!).map(([rKey, rVal]) => (
                                    rVal.members && Object.entries(rVal.members).map(([mId, mVal]) => (
                                        <SelectItem key={mId} value={mId}>
                                            {mVal.details?.name || mVal.details?.fullName || mId} ({rKey})
                                        </SelectItem>
                                    ))
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Application Date</Label>
                        <Input type="date" value={form.applicationDate} onChange={e => setForm({ ...form, applicationDate: e.target.value })} className="h-10 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Expected Delivery</Label>
                        <Input type="number" value={form.expectedDeliveryDays} onChange={e => setForm({ ...form, expectedDeliveryDays: parseInt(e.target.value) })} className="h-10 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Issue Date</Label>
                        <Input type="date" value={form.issueDate || ''} onChange={e => setForm({ ...form, issueDate: e.target.value })} className="h-10 border-slate-200" />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">DSC Class</Label>
                        <Select value={form.classId || ''} onValueChange={v => setForm({ ...form, classId: v })}>
                            <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Class" /></SelectTrigger>
                            <SelectContent>{masters.cls.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Type of DSC</Label>
                        <Select value={form.typeId || ''} onValueChange={v => setForm({ ...form, typeId: v })}>
                            <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Type" /></SelectTrigger>
                            <SelectContent>{masters.typ.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Validity (Years)</Label>
                        <Select value={form.validityId || ''} onValueChange={v => setForm({ ...form, validityId: v })}>
                            <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Validity" /></SelectTrigger>
                            <SelectContent>{masters.val.map(val => <SelectItem key={val.id} value={val.id}>{val.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Certifying Authority</Label>
                        <Select value={form.authorityId || ''} onValueChange={v => setForm({ ...form, authorityId: v })}>
                            <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Authority" /></SelectTrigger>
                            <SelectContent>{masters.auth.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Mobile Number</Label>
                        <Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="Mobile" className="h-10 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Email ID</Label>
                        <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="h-10 border-slate-200" />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="verification" className="space-y-6 pt-2">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-sky-600" /> Contact Verification
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        {(['mobile', 'email', 'video'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => toggleVerification(v)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 gap-2",
                                    form.verificationStatus?.[v] === 'COMPLETED'
                                        ? "bg-green-50 border-green-500 text-green-700 shadow-sm"
                                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                )}
                            >
                                {form.verificationStatus?.[v] === 'COMPLETED' ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                                <span className="text-xs font-bold capitalize">{v}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="h-4 w-4 text-sky-600" /> KYC Documents
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        {(['pan', 'aadhar', 'photo'] as const).map((k) => (
                            <button
                                key={k}
                                onClick={() => toggleKYC(k)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 gap-2",
                                    form.kycStatus?.[k] === 'COMPLETED'
                                        ? "bg-sky-50 border-sky-500 text-sky-700 shadow-sm"
                                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                )}
                            >
                                {form.kycStatus?.[k] === 'COMPLETED' ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                                <span className="text-xs font-bold uppercase">{k}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">PAN Number</Label>
                        <Input value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value })} placeholder="ABCDE1234F" className="h-10 border-slate-200 uppercase" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Aadhar Number</Label>
                        <Input value={form.aadhar} onChange={e => setForm({ ...form, aadhar: e.target.value })} placeholder="1234 5678 9012" className="h-10 border-slate-200" />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
                <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 border-dashed">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-sky-600" /> Payment Tracking
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Total Fee (₹)</Label>
                            <Input type="number" value={form.paymentAmount || 0} onChange={e => setForm({ ...form, paymentAmount: parseFloat(e.target.value) })} className="h-10 border-slate-200" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Payment Status</Label>
                            <Select value={form.paymentStatus} onValueChange={v => setForm({ ...form, paymentStatus: v })}>
                                <SelectTrigger className="h-10 border-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                                    <SelectItem value="PARTIAL">Partial</SelectItem>
                                    <SelectItem value="PAID">Fully Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 border-dashed">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Truck className="h-4 w-4 text-sky-600" /> Courier & Shipping
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Courier Partner</Label>
                            <Input value={form.courierPartner || ''} onChange={e => setForm({ ...form, courierPartner: e.target.value })} placeholder="e.g. BlueDart" className="h-10 border-slate-200" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Tracking ID</Label>
                            <Input value={form.trackingId || ''} onChange={e => setForm({ ...form, trackingId: e.target.value })} placeholder="TRK12345678" className="h-10 border-slate-200" />
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="tech" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            Processing Stage
                            <Badge variant="outline" className="text-[10px] scale-90 bg-sky-50 text-sky-600">Standard</Badge>
                        </Label>
                        <Select value={form.currentStageId} onValueChange={v => setForm({ ...form, currentStageId: v })}>
                            <SelectTrigger className="h-10 border-slate-200"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {workflowStages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">DSC Password</Label>
                        <Input value={form.dscPassword} onChange={e => setForm({ ...form, dscPassword: e.target.value })} placeholder="Secure Password" className="h-10 border-slate-200" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Token DEFAULT Pass</Label>
                        <Input value={form.tokenDefaultPassword} onChange={e => setForm({ ...form, tokenDefaultPassword: e.target.value })} className="h-10 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Token CHANGED Pass</Label>
                        <Input value={form.tokenChangedPassword} onChange={e => setForm({ ...form, tokenChangedPassword: e.target.value })} className="h-10 border-slate-200" />
                    </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                    <Label className="text-sm font-bold flex items-center gap-2">
                        Follow-up Quick Note
                    </Label>
                    <div className="flex gap-2">
                        <Input value={newFollowup} onChange={e => setNewFollowup(e.target.value)} placeholder="Add a progress update..." className="h-10 border-slate-200" />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
                {editingDsc ? (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                                <History className="h-4 w-4 text-sky-600" /> Workflow Stage Progression
                            </h3>
                            <DSCWorkflowTimeline dsc={editingDsc} stages={workflowStages} />
                        </div>

                        {editingDsc.followups && (
                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-sky-600" /> Historical Follow-ups
                                </Label>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                                    {editingDsc.followups.slice().reverse().map((f, i) => (
                                        <div key={i} className="text-xs bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between gap-4">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{f.note}</span>
                                            <span className="text-slate-400 shrink-0 font-mono">{f.date}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                        <History className="h-10 w-10 text-slate-200" />
                        <p className="text-sm text-slate-500 italic">Timeline will be available after the order is created.</p>
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
}

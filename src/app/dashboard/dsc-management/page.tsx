'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, KeyRound, PlusCircle, Link as LinkIcon, ArrowRightLeft, Eye, Edit, Check, ChevronsUpDown, History, Search, LayoutDashboard, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { addYears } from 'date-fns';
import { parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import { DSC, DSCLink, DSCMovement, Client, DSCWorkflowStage } from './_components/types';
import { DSCStats } from './_components/dsc-stats';
import { IssuedDSCTable } from './_components/issued-dsc-table';
import { MovementHistory } from './_components/movement-history';
import { DSCFormTabs } from './_components/dsc-form-tabs';
import { DSCStatusBoard } from './_components/dsc-status-board';
import { PageSkeleton } from '@/components/ui/page-skeleton';

// --- Helper Functions ---

function addYearsISO(issueDateISO: string, years: number) {
    if (!issueDateISO) return '';
    const [y, m, d] = issueDateISO.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCFullYear(dt.getUTCFullYear() + years);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/** Map a raw Supabase DSC row (snake_case) to frontend camelCase shape */
function mapDscFromDb(d: any): DSC {
    return {
        id: d.id,
        companyName: d.company_name ?? d.companyName,
        issueDate: d.issue_date ?? d.issueDate,
        validityYears: d.validity_years ?? d.validityYears,
        expiryDate: d.expiry_date ?? d.expiryDate,
        status: d.status,
        remarks: d.remarks,
        currentStatus: d.current_status ?? d.currentStatus,
        currentHolder: d.current_holder ?? d.currentHolder,
        type: d.type,
        mobile: d.mobile,
        email: d.email,
        pan: d.pan,
        aadhar: d.aadhar,
        applicationDate: d.application_date ?? d.applicationDate,
        expectedDeliveryDays: d.expected_delivery_days ?? d.expectedDeliveryDays,
        currentStageId: d.current_stage_id ?? d.currentStageId,
        stageHistory: d.stage_history ?? d.stageHistory,
        dscPassword: d.dsc_password ?? d.dscPassword,
        tokenDefaultPassword: d.token_default_password ?? d.tokenDefaultPassword,
        tokenChangedPassword: d.token_changed_password ?? d.tokenChangedPassword,
        tokenPasswordChangeDate: d.token_password_change_date ?? d.tokenPasswordChangeDate,
        phone: d.phone,
        designation: d.designation,
        verificationStatus: d.verification_status ?? d.verificationStatus,
        kycStatus: d.kyc_status ?? d.kycStatus,
        paymentStatus: d.payment_status ?? d.paymentStatus,
        paymentAmount: d.payment_amount ?? d.paymentAmount,
        paidAmount: d.paid_amount ?? d.paidAmount,
        courierPartner: d.courier_partner ?? d.courierPartner,
        trackingId: d.tracking_id ?? d.trackingId,
        followups: d.followups,
        updatedAt: d.updated_at ?? d.updatedAt,
    };
}

export default function DSCManagementPage() {
    const [dscs, setDscs] = useState<DSC[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const { hasPermission, loading: permLoading } = usePermissions();
    const router = useRouter();
    const { toast } = useToast();
    const canViewDSC = hasPermission('VIEW_DSC');

    useEffect(() => {
        if (!permLoading && !canViewDSC) {
            toast({ title: "Access Denied", description: "You do not have permission to view DSC.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canViewDSC, router, toast]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isLinkOpen, setIsLinkOpen] = useState(false);
    const [isMoveOpen, setIsMoveOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [editingDsc, setEditingDsc] = useState<DSC | null>(null);
    const [newFollowup, setNewFollowup] = useState('');
    const [dscWorkflowStages, setDscWorkflowStages] = useState<DSCWorkflowStage[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);

    const [dscForm, setDscForm] = useState({
        companyName: '', type: 'Class 3', issueDate: '', validityYears: '2', remarks: '',
        mobile: '', email: '', pan: '', aadhar: '',
        applicationDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDays: 7,
        clientId: '', roleKey: '', memberId: '', phone: '', designation: '',
        dscPassword: '', tokenDefaultPassword: '', tokenChangedPassword: '',
        currentStageId: '',
        verificationStatus: {
            mobile: 'PENDING' as 'PENDING' | 'COMPLETED',
            email: 'PENDING' as 'PENDING' | 'COMPLETED',
            video: 'PENDING' as 'PENDING' | 'COMPLETED'
        },
        kycStatus: {
            pan: 'PENDING' as 'PENDING' | 'COMPLETED',
            aadhar: 'PENDING' as 'PENDING' | 'COMPLETED',
            photo: 'PENDING' as 'PENDING' | 'COMPLETED'
        },
        paymentStatus: 'UNPAID', paymentAmount: 0, paidAmount: 0,
        courierPartner: '', trackingId: ''
    });

    const [linkForm, setLinkForm] = useState({ dscId: '', clientId: '', roleKey: '', memberId: '' });
    const [moveForm, setMoveForm] = useState({
        dscId: '', type: 'OUT', clientId: '', roleKey: '', memberId: '', remarks: '',
        date: new Date().toISOString().split('T')[0]
    });

    const refreshPageData = useCallback(async () => {
        try {
            const [dscRes, clientsRes, stagesRes] = await Promise.all([
                fetch('/api/dsc'), fetch('/api/clients'), fetch('/api/dsc/stages')
            ]);
            if (dscRes.ok) setDscs(await dscRes.json());
            if (clientsRes.ok) {
                const response = await clientsRes.json();
                const clientsArray = Array.isArray(response) ? response : response?.data || [];
                setClients(
                    clientsArray.map((c: any) => ({
                        ...c,
                        id: c.id,
                        clientName: c.client_name,
                        roles: c.roles
                    }))
                );
            }
            if (stagesRes.ok) setDscWorkflowStages(await stagesRes.json());
        } catch (err) {
            console.error("Failed to fetch DSC dependencies", err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPageData();
    }, [refreshPageData]);

    const handleSaveDSC = async () => {
        let expiryDate = '';
        if (dscForm.issueDate) expiryDate = addYearsISO(dscForm.issueDate, parseInt(dscForm.validityYears));
        let status: 'Not Started' | 'ACTIVE' | 'EXPIRED' = 'Not Started';
        if (dscForm.issueDate) status = (expiryDate && new Date(expiryDate) < new Date()) ? 'EXPIRED' : 'ACTIVE';

        const payload: Partial<DSC> = {
            companyName: dscForm.companyName, type: dscForm.type, issueDate: dscForm.issueDate,
            validityYears: parseInt(dscForm.validityYears), expiryDate, status, remarks: dscForm.remarks,
            mobile: dscForm.mobile || '', email: dscForm.email || '', pan: dscForm.pan || '',
            aadhar: dscForm.aadhar || '', applicationDate: dscForm.applicationDate,
            expectedDeliveryDays: dscForm.expectedDeliveryDays,
            currentStageId: dscForm.currentStageId || (dscWorkflowStages.length > 0 ? dscWorkflowStages[0].id : ''),
            dscPassword: dscForm.dscPassword, tokenDefaultPassword: dscForm.tokenDefaultPassword,
            tokenChangedPassword: dscForm.tokenChangedPassword, phone: dscForm.phone,
            designation: dscForm.designation, verificationStatus: dscForm.verificationStatus,
            kycStatus: dscForm.kycStatus, paymentStatus: dscForm.paymentStatus as any,
            paymentAmount: dscForm.paymentAmount, paidAmount: dscForm.paidAmount,
            courierPartner: dscForm.courierPartner, trackingId: dscForm.trackingId,
            updatedAt: new Date().toISOString(),
        };

        if (newFollowup) {
            const followups = editingDsc?.followups || [];
            payload.followups = [...followups, { date: new Date().toISOString().split('T')[0], note: newFollowup }];
        }
        if (editingDsc && dscForm.tokenChangedPassword !== editingDsc.tokenChangedPassword) {
            payload.tokenPasswordChangeDate = new Date().toISOString().split('T')[0];
        }

        try {
            if (editingDsc) {
                const res = await fetch(`/api/dsc/${editingDsc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const json = await res.json().catch(() => null);
                if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to update DSC');
            } else {
                const res = await fetch('/api/dsc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, currentStatus: 'IN' }) });
                const json = await res.json().catch(() => null);
                if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to create DSC');
            }
            await refreshPageData();
            toast({ title: 'Success', description: editingDsc ? 'DSC updated successfully' : 'DSC added successfully' });
            setIsAddOpen(false); setEditingDsc(null); setNewFollowup(''); resetForm();
        } catch (e: any) { 
            console.error("Error saving DSC", e); 
            toast({ title: 'Error', description: e.message || 'Failed to save DSC', variant: 'destructive' });
        }
    };

    const resetForm = () => {
        setDscForm({
            companyName: '', type: 'Class 3', issueDate: '', validityYears: '2', remarks: '',
            mobile: '', email: '', pan: '', aadhar: '',
            applicationDate: new Date().toISOString().split('T')[0], expectedDeliveryDays: 7,
            clientId: '', roleKey: '', memberId: '', phone: '', designation: '',
            dscPassword: '', tokenDefaultPassword: '', tokenChangedPassword: '',
            currentStageId: dscWorkflowStages.length > 0 ? dscWorkflowStages[0].id : '',
            verificationStatus: { mobile: 'PENDING' as 'PENDING' | 'COMPLETED', email: 'PENDING' as 'PENDING' | 'COMPLETED', video: 'PENDING' as 'PENDING' | 'COMPLETED' },
            kycStatus: { pan: 'PENDING' as 'PENDING' | 'COMPLETED', aadhar: 'PENDING' as 'PENDING' | 'COMPLETED', photo: 'PENDING' as 'PENDING' | 'COMPLETED' },
            paymentStatus: 'UNPAID', paymentAmount: 0, paidAmount: 0, courierPartner: '', trackingId: ''
        });
        setClientSearch('');
    };

    const openEdit = (dsc: DSC) => {
        setEditingDsc(dsc);
        setDscForm({
            companyName: dsc.companyName, type: dsc.type || 'Class 3', issueDate: dsc.issueDate || '',
            validityYears: (dsc.validityYears || 2).toString(), remarks: dsc.remarks || '',
            mobile: dsc.mobile || '', email: dsc.email || '', pan: dsc.pan || '', aadhar: dsc.aadhar || '',
            applicationDate: dsc.applicationDate || new Date().toISOString().split('T')[0],
            expectedDeliveryDays: dsc.expectedDeliveryDays || 7,
            clientId: dsc.currentHolder?.clientId || '', roleKey: dsc.currentHolder?.roleKey || '',
            memberId: dsc.currentHolder?.memberId || '', phone: dsc.phone || '', designation: dsc.designation || '',
            dscPassword: dsc.dscPassword || '', tokenDefaultPassword: dsc.tokenDefaultPassword || '',
            tokenChangedPassword: dsc.tokenChangedPassword || '', currentStageId: dsc.currentStageId || '',
            verificationStatus: { mobile: dsc.verificationStatus?.mobile || 'PENDING', email: dsc.verificationStatus?.email || 'PENDING', video: dsc.verificationStatus?.video || 'PENDING' } as any,
            kycStatus: { pan: dsc.kycStatus?.pan || 'PENDING', aadhar: dsc.kycStatus?.aadhar || 'PENDING', photo: dsc.kycStatus?.photo || 'PENDING' } as any,
            paymentStatus: dsc.paymentStatus || 'UNPAID', paymentAmount: dsc.paymentAmount || 0,
            paidAmount: dsc.paidAmount || 0, courierPartner: dsc.courierPartner || '', trackingId: dsc.trackingId || ''
        });
        setIsAddOpen(true);
    };

    const handleLinkDSC = async () => {
        if (!linkForm.dscId || !linkForm.clientId || !linkForm.roleKey || !linkForm.memberId) return;
        try {
            const res = await fetch('/api/dsc/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dscId: linkForm.dscId, clientId: linkForm.clientId, roleKey: linkForm.roleKey, memberId: linkForm.memberId, isActive: true }) });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.error || json?.message || (res.status === 409 ? 'An active link already exists for this DSC and member.' : 'Failed to link DSC'));
            await refreshPageData();
            toast({ title: 'Success', description: 'DSC linked successfully' });
            setIsLinkOpen(false);
            setLinkForm({ dscId: '', clientId: '', roleKey: '', memberId: '' });
        } catch (e: any) { 
            console.error("Error linking DSC", e); 
            toast({ title: 'Error', description: e.message || 'Failed to link DSC', variant: 'destructive' });
        }
    };

    const handleMoveDSC = async () => {
        if (!moveForm.dscId) return;
        try {
            const moveRes = await fetch('/api/dsc/movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dscId: moveForm.dscId, movementType: moveForm.type, movementDate: moveForm.date, clientId: moveForm.clientId || null, roleKey: moveForm.roleKey || null, memberId: moveForm.memberId || null, remarks: moveForm.remarks }) });
            const moveJson = await moveRes.json().catch(() => null);
            if (!moveRes.ok) throw new Error(moveJson?.error || moveJson?.message || 'Failed to record movement');
            let currentHolder = null;
            if (moveForm.type === 'OUT') {
                let memberName = 'Unknown';
                const client = clients.find(c => c.id === moveForm.clientId);
                if (client && client.roles && client.roles[moveForm.roleKey]?.members && client.roles[moveForm.roleKey].members![moveForm.memberId]) {
                    const mDetails = client.roles[moveForm.roleKey].members![moveForm.memberId].details;
                    memberName = mDetails?.name || mDetails?.fullName || mDetails?.email || 'Unknown';
                }
                currentHolder = { clientId: moveForm.clientId, roleKey: moveForm.roleKey, memberId: moveForm.memberId, memberName };
            }
            const holderRes = await fetch(`/api/dsc/${moveForm.dscId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentStatus: moveForm.type, currentHolder }) });
            const holderJson = await holderRes.json().catch(() => null);
            if (!holderRes.ok) throw new Error(holderJson?.error || holderJson?.message || 'Failed to update DSC holder status');
            await refreshPageData();
            toast({ title: 'Success', description: 'DSC custody updated successfully' });
            setIsMoveOpen(false);
            setMoveForm({ dscId: '', type: 'OUT', clientId: '', roleKey: '', memberId: '', remarks: '', date: new Date().toISOString().split('T')[0] });
        } catch (e: any) { 
            console.error("Error moving DSC", e); 
            toast({ title: 'Error', description: e.message || 'Failed to move DSC', variant: 'destructive' });
        }
    };

    const getRoles = (clientId: string) => {
        const c = clients.find(cl => cl.id === clientId);
        return c?.roles ? Object.keys(c.roles) : [];
    };

    const getMembers = (clientId: string, roleKeyFilter?: string) => {
        const c = clients.find(cl => cl.id === clientId);
        if (!c?.roles) return [];
        if (roleKeyFilter) {
            if (!c.roles[roleKeyFilter]?.members) return [];
            return Object.entries(c.roles[roleKeyFilter].members!).map(([mid, mData]) => ({ id: mid, roleKey: roleKeyFilter, name: mData.details?.name || mData.details?.fullName || mData.details?.email || mid, ...mData }));
        }
        const allMembers: any[] = [];
        Object.entries(c.roles).forEach(([rKey, rVal]) => {
            if (rVal.members) Object.entries(rVal.members).forEach(([mId, mVal]) => {
                allMembers.push({ id: mId, roleKey: rKey, name: mVal.details?.name || mVal.details?.fullName || mVal.details?.email || mId, ...mVal });
            });
        });
        return allMembers;
    };

    const openNewOrder = () => { setEditingDsc(null); resetForm(); setIsAddOpen(true); };

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const activeIssued = dscs.filter(d => d.status === 'ACTIVE').length;
    const currentStage = dscWorkflowStages.find(s => s.id === dscForm.currentStageId);
    const isIssuedStage = Boolean(currentStage?.name.toLowerCase().includes('issued') || currentStage?.name.toLowerCase().includes('final'));
    const totalIssued = dscs.length;
    const clientDSCs = dscs.filter(d => d.currentStatus === 'OUT');
    const activeClient = clientDSCs.filter(d => d.status === 'ACTIVE').length;
    const totalClient = clientDSCs.length;
    const expiringCount = dscs.filter(d => { if (d.status !== 'ACTIVE') return false; const exp = new Date(d.expiryDate); return exp > now && exp <= thirtyDaysFromNow; }).length;

    if (isLoading) return <div className="p-6"><PageSkeleton /></div>;

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="DSC Management Center"
                description="Manage issuance, client-owned custody, pricing, and token inventory."
            >
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshPageData()} className="h-9 px-3 font-bold border-muted-foreground/20">
                        <RefreshCw className="h-4 w-4 mr-2" /> Reload
                    </Button>
                    <Button onClick={openNewOrder} className="h-9 px-4 font-bold">
                        <PlusCircle className="mr-2 h-4 w-4" /> New Order
                    </Button>
                </div>
            </DashboardPageHeader>

            <DSCStats dscs={dscs} stages={dscWorkflowStages} totalIssued={totalIssued} activeIssued={activeIssued} totalClient={totalClient} activeClient={activeClient} expiringCount={expiringCount} />

            <Tabs defaultValue="list" className="w-full">
                <div className="flex justify-center mb-5">
                    <div className="inline-flex bg-slate-100/80 p-1.5 rounded-full border border-slate-200/60 shadow-inner overflow-x-auto max-w-full">
                        <TabsList className="flex w-max justify-center h-auto p-0 bg-transparent gap-1.5">
                            <TabsTrigger value="list" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary data-[state=active]:scale-y-105 px-4 py-2 text-sm font-bold transition-all duration-300 hover:bg-slate-200/80">
                                <LayoutDashboard className="w-4 h-4 mr-2" />DSC List
                            </TabsTrigger>
                            <TabsTrigger value="status-board" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary data-[state=active]:scale-y-105 px-4 py-2 text-sm font-bold transition-all duration-300 hover:bg-slate-200/80">
                                <LayoutDashboard className="w-4 h-4 mr-2" />Tracking Board
                            </TabsTrigger>
                            <TabsTrigger value="movements" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary data-[state=active]:scale-y-105 px-4 py-2 text-sm font-bold transition-all duration-300 hover:bg-slate-200/80">
                                <ArrowRightLeft className="w-4 h-4 mr-2" />Custody Move
                            </TabsTrigger>
                            <TabsTrigger value="link" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary data-[state=active]:scale-y-105 px-4 py-2 text-sm font-bold transition-all duration-300 hover:bg-slate-200/80">
                                <LinkIcon className="w-4 h-4 mr-2" />Link DSC
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="list" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <IssuedDSCTable data={dscs} stages={dscWorkflowStages} onEdit={openEdit} onNewOrder={openNewOrder} />
                </TabsContent>

                <TabsContent value="status-board">
                    <DSCStatusBoard dscs={dscs} stages={dscWorkflowStages} clients={clients} onStageChange={() => { }} />
                </TabsContent>

                <TabsContent value="movements">
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm">Register Movement</CardTitle>
                            <CardDescription className="text-xs">Log when a DSC is taken out or returned.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 max-w-2xl text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>DSC</Label>
                                    <Select value={moveForm.dscId} onValueChange={(v) => setMoveForm({ ...moveForm, dscId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select DSC" /></SelectTrigger>
                                        <SelectContent>{dscs.filter(d => d.status === 'ACTIVE').map(d => <SelectItem key={d.id} value={d.id}>{d.companyName}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Movement Type</Label>
                                    <Select value={moveForm.type} onValueChange={(v) => setMoveForm({ ...moveForm, type: v as 'IN' | 'OUT' })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OUT">Check Out (Give to Client)</SelectItem>
                                            <SelectItem value="IN">Check In (Return to Office)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {moveForm.type === 'OUT' && (
                                <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                    <div className="space-y-2">
                                        <Label>Client</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                                    {moveForm.clientId ? clients.find(c => c.id === moveForm.clientId)?.clientName : "Select Client"}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search client..." />
                                                    <CommandList>
                                                        <CommandEmpty>No client found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {clients.map(c => (
                                                                <CommandItem key={c.id} value={c.clientName} onSelect={() => setMoveForm({ ...moveForm, clientId: c.id, roleKey: '', memberId: '' })}>
                                                                    <Check className={cn("mr-2 h-4 w-4", moveForm.clientId === c.id ? "opacity-100" : "opacity-0")} />
                                                                    {c.clientName}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    {moveForm.clientId && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Role</Label>
                                                <Select value={moveForm.roleKey} onValueChange={(v) => setMoveForm({ ...moveForm, roleKey: v, memberId: '' })}>
                                                    <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                                                    <SelectContent>{getRoles(moveForm.clientId).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Member</Label>
                                                <Select value={moveForm.memberId} onValueChange={(v) => setMoveForm({ ...moveForm, memberId: v })}>
                                                    <SelectTrigger><SelectValue placeholder="Select Person" /></SelectTrigger>
                                                    <SelectContent>{getMembers(moveForm.clientId, moveForm.roleKey).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Remarks</Label>
                                <Textarea value={moveForm.remarks} onChange={e => setMoveForm({ ...moveForm, remarks: e.target.value })} placeholder="Reason for movement..." />
                            </div>
                            <Button onClick={handleMoveDSC} disabled={!moveForm.dscId}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />Confirm {moveForm.type}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="link">
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm">Link DSC to Person</CardTitle>
                            <CardDescription className="text-xs">Associate a DSC with a specific client role and member.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 max-w-2xl text-sm">
                            <div className="space-y-2">
                                <Label>DSC</Label>
                                <Select value={linkForm.dscId} onValueChange={(v) => setLinkForm({ ...linkForm, dscId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select DSC" /></SelectTrigger>
                                    <SelectContent>{dscs.filter(d => d.status === 'ACTIVE').map(d => <SelectItem key={d.id} value={d.id}>{d.companyName}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Client</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {linkForm.clientId ? clients.find(c => c.id === linkForm.clientId)?.clientName : "Select Client"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search client..." />
                                            <CommandList>
                                                <CommandEmpty>No client found.</CommandEmpty>
                                                <CommandGroup>
                                                    {clients.map(c => (
                                                        <CommandItem key={c.id} value={c.clientName} onSelect={() => setLinkForm({ ...linkForm, clientId: c.id, roleKey: '', memberId: '' })}>
                                                            <Check className={cn("mr-2 h-4 w-4", linkForm.clientId === c.id ? "opacity-100" : "opacity-0")} />
                                                            {c.clientName}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {linkForm.clientId && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        <Select value={linkForm.roleKey} onValueChange={(v) => setLinkForm({ ...linkForm, roleKey: v, memberId: '' })}>
                                            <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                                            <SelectContent>{getRoles(linkForm.clientId).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Member</Label>
                                        <Select value={linkForm.memberId} onValueChange={(v) => setLinkForm({ ...linkForm, memberId: v })}>
                                            <SelectTrigger><SelectValue placeholder="Select Person" /></SelectTrigger>
                                            <SelectContent>{getMembers(linkForm.clientId, linkForm.roleKey).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                            <Button onClick={handleLinkDSC} disabled={!linkForm.dscId || !linkForm.clientId || !linkForm.memberId}>
                                <LinkIcon className="mr-2 h-4 w-4" />Link DSC
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ADD/EDIT DIALOG */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>{editingDsc ? `Editing "DSC"` : 'Adding New DSC'}</DialogTitle>
                        <DialogDescription>{editingDsc ? 'Update the details of this item.' : 'Enter the details for DSC.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                        <DSCFormTabs
                            form={dscForm}
                            setForm={setDscForm}
                            clients={clients}
                            workflowStages={dscWorkflowStages}
                            isIssuedStage={isIssuedStage}
                            editingDsc={editingDsc}
                            newFollowup={newFollowup}
                            setNewFollowup={setNewFollowup}
                            clientSearch={clientSearch}
                            setClientSearch={setClientSearch}
                            isClientPopoverOpen={isClientPopoverOpen}
                            setIsClientPopoverOpen={setIsClientPopoverOpen}
                            getMembers={getMembers}
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveDSC}>{editingDsc ? 'Update DSC' : 'Create Order'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

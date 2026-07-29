'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, PlusCircle, Check, Info, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { addDays } from 'date-fns';
import { isValid } from 'date-fns';
import { parseISO } from 'date-fns';
import { useClients } from '@/hooks/use-clients';
import { useWorks } from '@/hooks/use-works';
import { useDebounce } from '@/hooks/use-debounce';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/ui/page-skeleton';

// --- Types ---

interface ClientWork {
    id: string;
    clientId: string;
    clientName: string;
    workCategory: string;
    workTypeId?: string;
    workType: string;
    frequency: 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly' | 'One-time';
    financialYear: string;
    period: string;
    priority: 'Normal' | 'High' | 'Urgent';
    assignedTeamId?: string | null;
    assignedTeamName?: string;
    assignedTo: string;
    assignedToName: string;
    enteredBy: string;
    enteredByName: string;
    enteredOn: number;
    dueDate: string;
    finishBy?: string;
    startDate?: string;
    expectedCompletionDate?: string;
    referenceType?: string;
    referenceName?: string;
    referenceNotes?: string;
    isBillable: boolean;
    serviceAmount?: number;
    gstPercent?: number;
    gstAmount?: number;
    totalAmount?: number;
    billingMode?: 'Invoice' | 'Receipt' | 'Proforma';
    creditPeriod?: number;
    expectedPayDate?: string;
    status: 'New' | 'Assigned' | 'In Progress' | 'Query' | 'Completed' | 'On Hold';
    description?: string;
}

interface UserProfile {
    uid: string;
    displayName: string;
    teamId?: string | null;
}

interface Team {
    id: string;
    name: string;
}

interface MasterWorkType {
    id: string;
    name: string;
    categoryName: string;
    departmentName: string;
    warningNote?: string | null;
}

// --- Initialization & Constants ---

const INITIAL_FORM_STATE: Partial<ClientWork> = {
    clientId: '',
    clientName: '',
    workCategory: '',
    workType: '',
    workTypeId: '',
    frequency: 'Monthly',
    financialYear: '2025-26',
    period: '',
    priority: 'Normal',
    status: 'New',
    isBillable: false,
    serviceAmount: 0,
    gstPercent: 18,
    gstAmount: 0,
    totalAmount: 0,
    creditPeriod: 0,
    assignedTeamId: null,
    assignedTo: '',
    assignedToName: '',
    dueDate: '',
    finishBy: '',
    description: '',
};

const FREQUENCIES = [
    { label: 'Monthly', value: 'Monthly' },
    { label: 'Quarterly', value: 'Quarterly' },
    { label: 'Yearly', value: 'Yearly' },
    { label: 'One-time', value: 'One-time' },
];

const PERIOD_MAP: Record<string, string[]> = {
    Monthly: ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'],
    Quarterly: ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'],
    'Half-yearly': ['H1 (Apr-Sep)', 'H2 (Oct-Mar)'],
    Yearly: ['FY 2025-26'],
    'One-time': ['One-time'],
};

// --- Helpers ---

const parseSafeInt = (val: string) => {
    const parsed = parseInt(val);
    return isNaN(parsed) ? 0 : parsed;
};

const parseSafeFloat = (val: string) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

const safeFormatDate = (dateStr: string | undefined, pattern: string = 'dd MMM yyyy') => {
    if (!dateStr) return '—';
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, pattern) : '—';
};

const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
};

export default function ClientWorkPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // -- Table & List State --
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 500);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(5);

    const { 
        data: worksResponse, 
        isLoading: worksLoading 
    } = useWorks({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch
    });

    const works = worksResponse?.data || [];
    const totalItems = worksResponse?.pagination?.total || 0;

    // -- Dependency Data --
    const { data: clientsRes, isLoading: clientsLoading } = useClients({ limit: 1000 });
    const clients = clientsRes?.data || [];

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workCategories, setWorkCategories] = useState<string[]>([]);
    const [masterWorkTypes, setMasterWorkTypes] = useState<MasterWorkType[]>([]);
    const [isMetaLoading, setIsMetaLoading] = useState(true);

    // -- Form & Modal State --
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<ClientWork>>(INITIAL_FORM_STATE);
    const [currentStep, setCurrentStep] = useState('basic');

    // --- Data Fetching ---
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const [empRes, teamRes, deptRes] = await Promise.all([
                    fetch('/api/employees?limit=1000&fields=id,full_name,employment_details'),
                    fetch('/api/teams'),
                    fetch('/api/departments')
                ]);

                if (empRes.ok) {
                    const res = await empRes.json();
                    const list = res.data || [];
                    setUsers(list.map((u: any) => ({
                        uid: u.id,
                        displayName: u.full_name || 'Unknown',
                        teamId: u.employment_details?.teamId || u.teamId || null
                    })));
                }

                if (teamRes.ok) {
                    const res = await teamRes.json();
                    setTeams(res.data || []);
                }

                if (deptRes.ok) {
                    const res = await deptRes.json();
                    const depts = res.data || [];
                    const cats: string[] = [];
                    const types: MasterWorkType[] = [];

                    depts.forEach((d: any) => {
                        (d.workCategories || d.work_categories || []).forEach((c: any) => {
                            if (!cats.includes(c.name)) cats.push(c.name);
                            (c.workTypes || c.work_types || []).forEach((t: any) => {
                                types.push({ 
                                    id: t.id, 
                                    name: t.name, 
                                    categoryName: c.name, 
                                    departmentName: d.name,
                                    warningNote: t.warning_note || t.warningNote
                                });
                            });
                        });
                    });
                    setWorkCategories(cats.sort());
                    setMasterWorkTypes(types.sort((a, b) => a.name.localeCompare(b.name)));
                }
            } catch (err) {
            console.error("Meta fetch error:", err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
                setIsMetaLoading(false);
            }
        };
        fetchMeta();
    }, []);

    // --- Derived Calculations ---
    useEffect(() => {
        if (!formData.isBillable) return;
        const subtotal = formData.serviceAmount || 0;
        const gstRate = formData.gstPercent || 0;
        const gst = subtotal * (gstRate / 100);
        const total = subtotal + gst;
        
        if (gst !== formData.gstAmount || total !== formData.totalAmount) {
            setFormData(prev => ({ ...prev, gstAmount: gst, totalAmount: total }));
        }
    }, [formData.serviceAmount, formData.gstPercent, formData.isBillable]);

    useEffect(() => {
        if (!formData.isBillable || !formData.dueDate) return;
        const base = parseISO(formData.dueDate);
        if (!isValid(base)) return;
        
        const credit = formData.creditPeriod || 0;
        const payDate = format(addDays(base, credit), 'yyyy-MM-dd');
        
        if (payDate !== formData.expectedPayDate) {
            setFormData(prev => ({ ...prev, expectedPayDate: payDate }));
        }
    }, [formData.dueDate, formData.creditPeriod, formData.isBillable]);

    // --- Handlers ---
    const handleSave = async () => {
        if (!user || isSaving) return;

        // Final Validation
        if (!formData.clientId || !formData.workCategory || !formData.workTypeId || !formData.period || !formData.dueDate) {
            toast({ title: "Validation Error", description: "Please ensure all required fields are filled correctly.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                enteredBy: user.uid,
                enteredByName: user.displayName || 'System User',
                enteredOn: Date.now(),
            };

            const res = await fetch('/api/works', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to create work');
            }

            toast({ title: "Success", description: "Work record created successfully." });
            queryClient.invalidateQueries({ queryKey: ['works'] });
            setIsAddOpen(false);
            setFormData(INITIAL_FORM_STATE);
            setCurrentStep('basic');
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const nextStep = (next: string) => {
        if (currentStep === 'basic') {
            if (!formData.clientId || !formData.workCategory || !formData.workTypeId || !formData.period) {
                toast({ title: "Required Fields", description: "Client, Category, Work Type and Period are mandatory.", variant: "destructive" });
                return;
            }
        }
        if (currentStep === 'planning') {
            if (!formData.dueDate) {
                toast({ title: "Missing Date", description: "Statutory Due Date is required to proceed.", variant: "destructive" });
                return;
            }
        }
        setCurrentStep(next);
    };

    const getStatusVariant = (s: string | undefined): "default" | "secondary" | "destructive" | "outline" => {
        switch (s) {
            case 'Completed': return 'default';
            case 'In Progress': return 'secondary';
            case 'Query': return 'destructive';
            case 'On Hold': return 'outline';
            default: return 'outline';
        }
    };

    const filteredUsers = useMemo(() => {
        if (!formData.assignedTeamId || formData.assignedTeamId === 'none') return users;
        return users.filter(u => u.teamId === formData.assignedTeamId);
    }, [users, formData.assignedTeamId]);

    if (isMetaLoading) return <div className="p-6"><PageSkeleton /></div>;

    return (
        <div className="space-y-6 p-6 pb-20">
            {/* -- Header -- */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Client Work Register</h2>
                    <p className="text-muted-foreground">Comprehensive tracking of all client deliverables.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} size="lg" className="rounded-xl h-11 px-6 shadow-md shadow-primary/20">
                    <PlusCircle className="mr-2 h-5 w-5" /> Add New Work
                </Button>
            </div>

            {/* -- List Card -- */}
            <Card className="shadow-sm border-muted overflow-hidden">
                <CardHeader className="bg-muted/10 pb-4 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-xl">Work Items</CardTitle>
                        <Badge variant="outline" className="bg-background text-primary border-primary/20">{totalItems} Records</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="w-[120px]">Due Date</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Work</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {worksLoading ? (
                                <TableRow><TableCell colSpan={7} className="h-40 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                            ) : works.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-40 text-center text-muted-foreground">No work records found.</TableCell></TableRow>
                            ) : (
                                (works as any[]).map((work: any) => (
                                    <TableRow key={work.id} className="hover:bg-muted/5 transition-colors">
                                        <TableCell className="font-medium">{safeFormatDate(work.dueDate, 'dd MMM')}</TableCell>
                                        <TableCell>
                                            <div className="font-semibold text-sm line-clamp-1">{work.clientName}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{work.financialYear}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold text-sm line-clamp-1">{work.categoryName || work.workCategory}</div>
                                            <div className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{work.workTypeName || work.workType}</div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline" className="font-normal">{work.period}</Badge></TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{work.assignedToName || 'Unassigned'}</TableCell>
                                        <TableCell><Badge variant={getStatusVariant(work.status)}>{work.status}</Badge></TableCell>
                                        <TableCell className="text-right font-semibold">{work.isBillable ? formatCurrency(work.totalAmount) : '—'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* -- Add Modal -- */}
            <Dialog open={isAddOpen} onOpenChange={(val) => { if (!isSaving) setIsAddOpen(val); }}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="px-8 py-6 border-b bg-muted/10">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                           <PlusCircle className="h-6 w-6 text-primary" /> Adding New Client Work
                        </DialogTitle>
                        <DialogDescription>
                            Enter the details for Client Work.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs value={currentStep} onValueChange={nextStep} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-8 py-4 border-b bg-muted/5">
                            <TabsList className="grid grid-cols-4 w-full h-14 bg-slate-100 p-1 rounded-xl">
                                <TabsTrigger value="basic" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">1. Basic Info</TabsTrigger>
                                <TabsTrigger value="planning" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">2. Planning</TabsTrigger>
                                <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">3. Commercials</TabsTrigger>
                                <TabsTrigger value="review" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">4. Review</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {/* STEP 1: BASIC */}
                            <TabsContent value="basic" className="mt-0 space-y-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Client Selection <span className="text-destructive">*</span></Label>
                                        <Select 
                                            value={formData.clientId} 
                                            onValueChange={(v) => {
                                                const c = clients.find((client: any) => client.id === v);
                                                setFormData({ ...formData, clientId: v, clientName: c?.clientName || '' });
                                            }}
                                        >
                                            <SelectTrigger className="h-11 bg-white border-muted-foreground/20"><SelectValue placeholder="Which client is this for?" /></SelectTrigger>
                                            <SelectContent>
                                                {clientsLoading ? (
                                                    <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                                                ) : clients.length === 0 ? (
                                                    <div className="py-6 px-4 text-center text-sm text-muted-foreground">No clients found.</div>
                                                ) : clients.map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.clientName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Service Category <span className="text-destructive">*</span></Label>
                                        <Select 
                                            value={formData.workCategory} 
                                            onValueChange={(v) => setFormData({ ...formData, workCategory: v, workType: '', workTypeId: '' })}
                                        >
                                            <SelectTrigger className="h-11 bg-white border-muted-foreground/20"><SelectValue placeholder="e.g. GST, Income Tax" /></SelectTrigger>
                                            <SelectContent>
                                                {workCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Work Type / Service <span className="text-destructive">*</span></Label>
                                        <Select 
                                            value={formData.workTypeId} 
                                            onValueChange={(id) => {
                                                const wt = masterWorkTypes.find(t => t.id === id);
                                                setFormData({ ...formData, workTypeId: id, workType: wt?.name || '' });
                                            }}
                                            disabled={!formData.workCategory}
                                        >
                                            <SelectTrigger className="h-11 bg-white border-muted-foreground/20"><SelectValue placeholder="Select specific service" /></SelectTrigger>
                                            <SelectContent>
                                                {masterWorkTypes
                                                    .filter(t => t.categoryName === formData.workCategory)
                                                    .map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                                                }
                                            </SelectContent>
                                        </Select>
                                        {formData.workTypeId && masterWorkTypes.find(t => t.id === formData.workTypeId)?.warningNote && (
                                            <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                                                ⚠️ Note: {masterWorkTypes.find(t => t.id === formData.workTypeId)?.warningNote}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Filing Frequency</Label>
                                        <Select value={formData.frequency} onValueChange={(v: any) => setFormData({ ...formData, frequency: v, period: '' })}>
                                            <SelectTrigger className="h-11 bg-white border-muted-foreground/20"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Financial Year</Label>
                                        <Select value={formData.financialYear} onValueChange={(v) => setFormData({ ...formData, financialYear: v })}>
                                            <SelectTrigger className="h-11 bg-white border-muted-foreground/20"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="2024-25">2024-25</SelectItem>
                                                <SelectItem value="2025-26">2025-26</SelectItem>
                                                <SelectItem value="2026-27">2026-27</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Applicable Period <span className="text-destructive">*</span></Label>
                                        <Select value={formData.period} onValueChange={(v) => setFormData({ ...formData, period: v })} disabled={!formData.frequency}>
                                            <SelectTrigger className="h-11 bg-white border-muted-foreground/20"><SelectValue placeholder="Select month/quarter" /></SelectTrigger>
                                            <SelectContent>
                                                {PERIOD_MAP[formData.frequency || 'Monthly']?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-8 border-t">
                                    <Button onClick={() => nextStep('planning')} className="h-11 px-8 rounded-xl font-semibold">Continue to Planning</Button>
                                </div>
                            </TabsContent>

                            {/* STEP 2: PLANNING */}
                            <TabsContent value="planning" className="mt-0 space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Assign Team</Label>
                                        <Select 
                                            value={formData.assignedTeamId || 'none'} 
                                            onValueChange={(v) => {
                                                const id = v === 'none' ? null : v;
                                                const t = teams.find(team => team.id === id);
                                                setFormData({ ...formData, assignedTeamId: id, assignedTeamName: t?.name || '', assignedTo: '', assignedToName: '' });
                                            }}
                                        >
                                            <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Select Team" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">None (Individual Assignment)</SelectItem>
                                                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Assign To Expert</Label>
                                        <Select value={formData.assignedTo} onValueChange={(v) => {
                                            const u = users.find(usr => usr.uid === v);
                                            setFormData({ ...formData, assignedTo: v, assignedToName: u?.displayName || '' });
                                        }}>
                                            <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Select Specialist" /></SelectTrigger>
                                            <SelectContent>
                                                {filteredUsers.length === 0 ? (
                                                    <div className="py-4 px-2 text-center text-xs text-muted-foreground italic">No users available for this team.</div>
                                                ) : filteredUsers.map((u) => (
                                                    <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="col-span-full pt-4">
                                        <div className="flex items-center gap-2 mb-6 text-primary">
                                            <div className="h-1 w-8 rounded-full bg-primary" />
                                            <span className="font-bold uppercase tracking-wider text-xs">Deadlines & Priority</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-3">
                                                <Label className="text-sm font-semibold text-destructive">Statutory Due Date <span className="text-destructive">*</span></Label>
                                                <Input 
                                                    type="date" 
                                                    value={formData.dueDate || ''} 
                                                    onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        setFormData(prev => {
                                                            // Auto-set finishBy if it was empty or matches old dueDate
                                                            const shouldUpdateFinish = !prev.finishBy || prev.finishBy === prev.dueDate;
                                                            return { ...prev, dueDate: newVal, finishBy: shouldUpdateFinish ? newVal : prev.finishBy };
                                                        });
                                                    }} 
                                                    className="h-11 border-destructive/20 focus:border-destructive/50" 
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-sm font-semibold">Internal Finish By</Label>
                                                <Input type="date" value={formData.finishBy || ''} onChange={(e) => setFormData({ ...formData, finishBy: e.target.value })} className="h-11" />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-sm font-semibold">Priority Level</Label>
                                                <Select value={formData.priority} onValueChange={(v: any) => setFormData({ ...formData, priority: v })}>
                                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Normal">Normal</SelectItem>
                                                        <SelectItem value="High text-amber-600">High</SelectItem>
                                                        <SelectItem value="Urgent text-destructive">Urgent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between pt-8 border-t">
                                    <Button variant="outline" onClick={() => setCurrentStep('basic')} className="h-11 px-8 rounded-xl">Back</Button>
                                    <Button onClick={() => nextStep('billing')} className="h-11 px-8 rounded-xl font-semibold">Setup Billing</Button>
                                </div>
                            </TabsContent>

                            {/* STEP 3: BILLING */}
                            <TabsContent value="billing" className="mt-0 space-y-8 animate-in fade-in duration-300">
                                <div className="space-y-8">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center space-x-3">
                                                <Switch id="bill" checked={formData.isBillable} onCheckedChange={(val) => {
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        isBillable: val,
                                                        serviceAmount: val ? prev.serviceAmount : 0,
                                                        gstAmount: val ? prev.gstAmount : 0,
                                                        totalAmount: val ? prev.totalAmount : 0
                                                    }));
                                                }} />
                                                <Label htmlFor="bill" className="text-lg font-bold text-slate-800">Is this a billable service?</Label>
                                            </div>
                                            {formData.isBillable ? <Badge className="bg-emerald-500 hover:bg-emerald-600">Commercial Work</Badge> : <Badge variant="outline" className="text-slate-400">Non-Billable</Badge>}
                                        </div>

                                        {formData.isBillable && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in zoom-in-95 duration-300">
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold">Service Fee (Taxable)</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-3.5 text-muted-foreground">₹</span>
                                                        <Input type="number" className="pl-7 h-12 text-lg font-medium" value={formData.serviceAmount || ''} onChange={(e) => setFormData({ ...formData, serviceAmount: parseSafeFloat(e.target.value) })} />
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold">GST Rate (%)</Label>
                                                    <Input type="number" className="h-12 text-lg" value={formData.gstPercent || ''} onChange={(e) => setFormData({ ...formData, gstPercent: parseSafeFloat(e.target.value) })} />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold">Grand Total</Label>
                                                    <div className="h-12 flex items-center px-4 bg-muted/50 rounded-lg border-2 border-dashed font-bold text-xl text-primary">
                                                        {formatCurrency(formData.totalAmount)}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold">Credit Period (Days)</Label>
                                                    <Input type="number" className="h-12" value={formData.creditPeriod || ''} onChange={(e) => setFormData({ ...formData, creditPeriod: parseSafeInt(e.target.value) })} />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold text-muted-foreground">Expected Settlement</Label>
                                                    <div className="h-12 flex items-center px-4 bg-slate-100 rounded-lg text-slate-600 border border-slate-200">
                                                        {safeFormatDate(formData.expectedPayDate)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 rounded-2xl border border-slate-200 space-y-6">
                                        <div className="flex items-center gap-2 text-primary">
                                             <Info className="h-5 w-5" />
                                             <span className="font-bold text-sm uppercase tracking-wider">Source & Referral</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <Label className="text-sm font-semibold">Reference Source</Label>
                                                <Select value={formData.referenceType} onValueChange={(v) => setFormData({ ...formData, referenceType: v })}>
                                                    <SelectTrigger className="h-11 bg-white text-base"><SelectValue placeholder="How did this work come to us?" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Direct">Direct Client</SelectItem>
                                                        <SelectItem value="Agent">Agent / Consultant</SelectItem>
                                                        <SelectItem value="Referral">Client Referral</SelectItem>
                                                        <SelectItem value="Partner">Business Partner</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-sm font-semibold">Reference Details</Label>
                                                <Input value={formData.referenceName || ''} onChange={(e) => setFormData({ ...formData, referenceName: e.target.value })} className="h-11" placeholder="Search / Agency / Person name" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between pt-8 border-t">
                                    <Button variant="outline" onClick={() => setCurrentStep('planning')} className="h-11 px-8 rounded-xl">Back</Button>
                                    <Button onClick={() => nextStep('review')} className="h-11 px-8 rounded-xl font-semibold">Final Review</Button>
                                </div>
                            </TabsContent>

                            {/* STEP 4: REVIEW */}
                            <TabsContent value="review" className="mt-0 space-y-8 animate-in fade-in duration-300">
                                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800">
                                            Summary Review
                                        </h3>
                                        <Badge className="px-4 py-1 h-auto text-xs uppercase font-black bg-primary">Final Step</Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-12 text-sm">
                                        <div className="flex flex-col border-l-2 border-primary/20 pl-4 py-1">
                                            <span className="text-muted-foreground text-[10px] uppercase font-bold">Client</span>
                                            <span className="font-semibold text-slate-700">{formData.clientName}</span>
                                        </div>
                                        <div className="flex flex-col border-l-2 border-primary/20 pl-4 py-1">
                                            <span className="text-muted-foreground text-[10px] uppercase font-bold">Work Type</span>
                                            <span className="font-semibold text-slate-700">{formData.workCategory} — {formData.workType}</span>
                                        </div>
                                        <div className="flex flex-col border-l-2 border-primary/20 pl-4 py-1">
                                            <span className="text-muted-foreground text-[10px] uppercase font-bold">Statutory Due Date</span>
                                            <span className="font-bold text-destructive">{safeFormatDate(formData.dueDate)}</span>
                                        </div>
                                        <div className="flex flex-col border-l-2 border-primary/20 pl-4 py-1">
                                            <span className="text-muted-foreground text-[10px] uppercase font-bold">Responsible Expert</span>
                                            <span className="font-semibold text-slate-700">{formData.assignedToName || 'Not Assigned Yet'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-sm font-semibold">Internal Remarks / Instructions</Label>
                                    <Textarea
                                        placeholder="Any specific checklists, document notes, or urgency instructions for the team..."
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="min-h-[120px] rounded-2xl border-slate-200 shadow-inner p-4 bg-slate-50/50"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Initial Workflow Status</Label>
                                        <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                                            <SelectTrigger className="h-12 rounded-xl text-lg"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="New">Register as "New"</SelectItem>
                                                <SelectItem value="Assigned">Direct to "Assigned"</SelectItem>
                                                <SelectItem value="In Progress">Immediate "In Progress"</SelectItem>
                                                <SelectItem value="On Hold">Place "On Hold"</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-4">
                                        <Button variant="outline" onClick={() => setCurrentStep('billing')} className="h-12 w-1/3 rounded-xl border-slate-300">Back</Button>
                                        <Button 
                                            disabled={isSaving} 
                                            onClick={handleSave} 
                                            className="h-12 flex-1 rounded-xl font-bold text-lg shadow-lg shadow-primary/25"
                                        >
                                            {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing...</> : <><Check className="mr-2 h-5 w-5" /> Generate Work Order</>}
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}

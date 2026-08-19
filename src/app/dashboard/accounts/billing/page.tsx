'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Landmark, Plus, FileText, IndianRupee, Search, MoreHorizontal, 
    Eye, Ban, CheckCircle, FileCheck, FilterX, AlertCircle, RefreshCw, LayoutDashboard
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PaymentDialog from '@/app/dashboard/accounts/billing/_components/PaymentDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/apiFetch';
import { PageHero } from '@/components/dashboard/page-hero';

export default function BillingPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [billableWorks, setBillableWorks] = useState<any[]>([]);
    const [billableFilter, setBillableFilter] = useState('ready_to_bill');
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
    
    const [cancelInvoiceId, setCancelInvoiceId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, invRes, worksRes] = await Promise.all([
                apiFetch(`/api/billing/stats`),
                apiFetch(`/api/billing`),
                apiFetch(`/api/billing/billable-works`)
            ]);
            const statsData = await statsRes.json();
            const invData = await invRes.json();
            const worksData = await worksRes.json();

            if (statsData.success) {
                setStats(statsData.data);
            } else {
                console.error('Stats API error:', statsData.message);
                alert(`Failed to load stats: ${statsData.message}`);
            }
            if (invData.success) {
                setInvoices(invData.data);
            } else {
                console.error('Invoices API error:', invData.message);
                alert(`Failed to load invoices: ${invData.message}`);
            }
            if (worksData.success) {
                setBillableWorks(worksData.data);
            } else {
                console.error('Billable works API error:', worksData.message);
            }
        } catch (error: any) {
            console.error('Error fetching billing data:', error);
            alert(`Error fetching billing data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAction = async (id: string, actionType: 'approve' | 'generate') => {
        const endpoint = actionType === 'approve' ? 'approve' : 'generate-invoice';
        const confirmMsg = actionType === 'approve' 
            ? 'Are you sure you want to approve this bill? After approval, it can be converted to a Tax Invoice.'
            : 'Are you sure you want to generate a Tax Invoice? This will lock edits and assign an official invoice number.';
            
        if (!confirm(confirmMsg)) return;

        try {
            const res = await apiFetch(`/api/billing/${id}/${endpoint}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                alert(`Action successful: ${data.message}`);
                fetchData();
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred.');
        }
    };

    const handleCancelInvoice = async () => {
        if (!cancelReason.trim()) {
            alert('Please provide a reason for cancellation.');
            return;
        }
        
        try {
            const res = await apiFetch(`/api/billing/${cancelInvoiceId}/cancel`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancellation_reason: cancelReason })
            });
            const data = await res.json();
            if (data.success) {
                alert('Invoice cancelled successfully.');
                setCancelInvoiceId(null);
                setCancelReason('');
                fetchData();
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred while cancelling.');
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: any = {
            draft: 'bg-slate-100 text-slate-700 border-slate-200',
            pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
            approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            invoice_generated: 'bg-blue-50 text-blue-700 border-blue-200',
            sent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            partially_paid: 'bg-orange-50 text-orange-700 border-orange-200',
            paid: 'bg-green-50 text-green-700 border-green-200',
            cancelled: 'bg-red-50 text-red-700 border-red-200'
        };
        return <Badge variant="outline" className={`${colors[status] || 'bg-slate-100 text-slate-700'} px-2.5 py-0.5 rounded-full font-medium text-[11px] tracking-wide`}>{status.replace('_', ' ').toUpperCase()}</Badge>;
    };

    const searchFilter = (inv: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (inv.internal_bill_no?.toLowerCase().includes(q) || 
                inv.tax_invoice_no?.toLowerCase().includes(q) || 
                inv.snapshot_client_name?.toLowerCase().includes(q) ||
                inv.clients?.client_name?.toLowerCase().includes(q));
    };

    const internalBills = invoices.filter(i => !i.is_tax_invoice).filter(searchFilter);
    const taxInvoices = invoices.filter(i => i.is_tax_invoice).filter(searchFilter);

    const renderTable = (list: any[], isTaxView: boolean) => (
        <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
            <Table>
                <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider whitespace-nowrap">Date</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider whitespace-nowrap">{isTaxView ? 'Tax Inv #' : 'Int Bill #'}</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider w-full">Client & Work</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-right whitespace-nowrap">Total Amount</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-right whitespace-nowrap">Balance</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-center whitespace-nowrap">Status</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-right whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-48 text-center">
                                <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
                                    <span className="text-sm font-medium">Loading records...</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : list.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-48 text-center">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-sm font-medium text-slate-900">No records found</h3>
                                    <p className="text-sm text-slate-500">Create your first bill to get started.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        list.map((inv) => (
                            <TableRow key={inv.id} className="hover:bg-slate-50/60 transition-colors group border-b border-slate-100">
                                <TableCell className="text-slate-600 whitespace-nowrap text-sm">{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                                <TableCell className="font-medium text-slate-900 whitespace-nowrap text-sm">{isTaxView ? (inv.tax_invoice_no || inv.invoice_no || '-') : (inv.internal_bill_no || inv.invoice_no || '-')}</TableCell>
                                <TableCell>
                                    <div className="font-medium text-slate-900 line-clamp-1 text-sm">{inv.snapshot_client_name || inv.clients?.client_name || 'Unknown Client'}</div>
                                    <div className="text-xs text-slate-500 line-clamp-1 max-w-[300px] mt-0.5">{inv.snapshot_work_name || inv.tasks?.title || 'Unknown Work'}</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-slate-900 whitespace-nowrap text-sm">₹{inv.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right whitespace-nowrap text-sm">
                                    {inv.status === 'cancelled' ? (
                                        <span className="text-slate-400">-</span>
                                    ) : (
                                        <span className={`font-medium ${inv.balance_amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            ₹{inv.balance_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-center">{getStatusBadge(inv.status)}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4 text-slate-500" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuLabel className="text-xs text-slate-500 uppercase tracking-wider">Actions</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/accounts/billing/${inv.id}`} className="flex items-center cursor-pointer text-sm">
                                                    <Eye className="mr-2 h-4 w-4 text-slate-400" /> View Details
                                                </Link>
                                            </DropdownMenuItem>
                                            
                                            {!isTaxView && (inv.status === 'draft' || inv.status === 'pending_approval') && (
                                                <DropdownMenuItem className="text-emerald-600 focus:text-emerald-700 cursor-pointer text-sm" onClick={() => handleAction(inv.id, 'approve')}>
                                                    <CheckCircle className="mr-2 h-4 w-4" /> Approve Bill
                                                </DropdownMenuItem>
                                            )}
                                            
                                            {!isTaxView && inv.status === 'approved' && (
                                                <DropdownMenuItem className="text-blue-600 focus:text-blue-700 cursor-pointer text-sm" onClick={() => handleAction(inv.id, 'generate')}>
                                                    <FileCheck className="mr-2 h-4 w-4" /> Generate Tax Invoice
                                                </DropdownMenuItem>
                                            )}
                                            
                                            {isTaxView && inv.status !== 'cancelled' && inv.balance_amount > 0 && (
                                                <DropdownMenuItem className="cursor-pointer text-sm" onClick={() => setPaymentInvoice(inv)}>
                                                    <IndianRupee className="mr-2 h-4 w-4 text-slate-400" /> Add Payment
                                                </DropdownMenuItem>
                                            )}
                                            
                                            {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                                                <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer text-sm" onClick={() => setCancelInvoiceId(inv.id)}>
                                                    <Ban className="mr-2 h-4 w-4" /> Cancel Invoice
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );

    const renderBillableWorksTable = () => {
        let list = billableWorks.filter(w => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (w.client_name?.toLowerCase().includes(q) || w.title?.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q));
        });

        if (billableFilter === 'ready_to_bill') {
            list = list.filter(w => w.status === 'READY_TO_BILL');
        } else if (billableFilter === 'already_billed') {
            list = list.filter(w => w.status === 'BILLED');
        }

        return (
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white mt-6">
                <Table>
                    <TableHeader className="bg-slate-50/80">
                        <TableRow className="hover:bg-transparent border-b border-slate-200">
                            <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider whitespace-nowrap">Client</TableHead>
                            <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider w-full">Work Title & Scope</TableHead>
                            <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider whitespace-nowrap">Type</TableHead>
                            <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-right whitespace-nowrap">Prof. Fee</TableHead>
                            <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-right whitespace-nowrap">Govt. Fee</TableHead>
                            <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-center whitespace-nowrap">Status</TableHead>
                            <TableHead className="h-10 font-semibold text-slate-600 uppercase text-[11px] tracking-wider text-right whitespace-nowrap">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
                                        <span className="text-sm font-medium">Loading works...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : list.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                                            <LayoutDashboard className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-sm font-medium text-slate-900">No billable works found</h3>
                                        <p className="text-sm text-slate-500">Works will appear here when ready for billing.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            list.map(w => (
                                <TableRow key={w.id} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                                    <TableCell className="font-medium text-slate-900 text-sm whitespace-nowrap">{w.client_name}</TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium text-slate-900 line-clamp-1">{w.title}</div>
                                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{w.description || w.work_name}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-50 border-slate-200">{w.billable_type}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap text-sm font-medium text-slate-700">₹{w.professional_fee?.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap text-sm font-medium text-slate-700">₹{w.government_fee?.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="text-center">
                                        {w.status === 'BILLED' ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide whitespace-nowrap">BILLED</Badge>
                                        ) : w.status === 'READY_TO_BILL' ? (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide whitespace-nowrap">READY TO BILL</Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide whitespace-nowrap">NOT READY</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {w.status === 'READY_TO_BILL' ? (
                                            <Link href={`/dashboard/accounts/billing/create?client_id=${w.client_id}&work_id=${w.work_id}&billable_type=${w.billable_type}&source_id=${w.source_id}&source_ref=${w.source_ref}`}>
                                                <Button size="sm" variant="default" className="h-8 shadow-sm">
                                                    Create Bill
                                                </Button>
                                            </Link>
                                        ) : (
                                            <Button size="sm" variant="outline" disabled className="h-8 bg-slate-50 text-slate-400">
                                                Create Bill
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6 pb-24">
            {/* Header Section */}
            <PageHero
                pattern="pattern-1" 
                icon={Landmark}
                badge="FINANCIAL OPS"
                title="Billing & Invoicing"
                description="Manage internal bills, approvals, and tax invoices."
            >
                <Button className="shadow-sm font-medium h-10 px-4" asChild>
                    <Link href="/dashboard/accounts/billing/create">
                        <Plus className="mr-2 h-4 w-4" /> Create Bill
                    </Link>
                </Button>
            </PageHero>

            {/* Top KPI Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-600">Total Billed</CardTitle>
                            <div className="h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center">
                                <IndianRupee className="h-4 w-4 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">₹{stats.totalBilledAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{stats.totalBills} total records generated</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-600">Pending Dues</CardTitle>
                            <div className="h-8 w-8 rounded-md bg-amber-50 flex items-center justify-center">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600">₹{stats.totalPendingAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Awaiting payment collection</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-600">Paid Invoices</CardTitle>
                            <div className="h-8 w-8 rounded-md bg-emerald-50 flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.paidBills}</div>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Fully settled and closed</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-600">Cancelled</CardTitle>
                            <div className="h-8 w-8 rounded-md bg-red-50 flex items-center justify-center">
                                <Ban className="h-4 w-4 text-red-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.cancelledBills}</div>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Voided or deleted records</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Main Tabs Container */}
            <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                <Tabs defaultValue="tax_invoices" className="w-full">
                    
                    {/* Tab List */}
                    <div className="border-b border-slate-200 bg-slate-50/50 px-4 pt-2">
                        <TabsList className="h-10 w-full justify-start bg-transparent p-0 gap-6 overflow-x-auto hide-scrollbar">
                            <TabsTrigger 
                                value="tax_invoices" 
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-1 pb-2.5 pt-2 font-semibold text-sm text-slate-500 hover:text-slate-700 transition-colors whitespace-nowrap"
                            >
                                Official Tax Invoices
                            </TabsTrigger>
                            <TabsTrigger 
                                value="internal_bills" 
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-1 pb-2.5 pt-2 font-semibold text-sm text-slate-500 hover:text-slate-700 transition-colors whitespace-nowrap"
                            >
                                Internal Draft Bills & Approvals
                            </TabsTrigger>
                            <TabsTrigger 
                                value="billable_works" 
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-1 pb-2.5 pt-2 font-semibold text-sm text-slate-500 hover:text-slate-700 transition-colors whitespace-nowrap"
                            >
                                Billable Works
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Filter Toolbar */}
                    <div className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between border-b border-slate-100 bg-white">
                        <div className="relative w-full md:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search records..."
                                className="pl-9 h-9 w-full text-sm shadow-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <select 
                                className="h-9 border border-slate-200 rounded-md px-3 text-sm text-slate-600 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]"
                                value={billableFilter}
                                onChange={(e) => setBillableFilter(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="ready_to_bill">Ready to Bill</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="already_billed">Already Billed</option>
                            </select>
                            <Button variant="outline" size="sm" className="h-9 text-slate-600 shadow-sm hidden sm:flex">
                                Billing Type
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 text-slate-600 shadow-sm hidden sm:flex">
                                Date Range
                            </Button>
                            <Button variant="ghost" size="sm" className="h-9 text-slate-500 hover:text-slate-700" onClick={() => { setSearch(''); setBillableFilter('ready_to_bill'); }}>
                                <FilterX className="mr-2 h-4 w-4" /> Reset
                            </Button>
                        </div>
                    </div>

                    {/* Tab Contents */}
                    <div className="p-4 sm:p-6 bg-slate-50/30">
                        <TabsContent value="tax_invoices" className="m-0 border-none p-0 outline-none">
                            {renderTable(taxInvoices, true)}
                        </TabsContent>
                        
                        <TabsContent value="internal_bills" className="m-0 border-none p-0 outline-none">
                            {renderTable(internalBills, false)}
                        </TabsContent>

                        <TabsContent value="billable_works" className="m-0 border-none p-0 outline-none">
                            {/* Billable Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                                <Card className="shadow-sm border-slate-200 bg-white rounded-xl overflow-hidden">
                                    <CardContent className="p-5 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500 mb-1">Pending Workflow Bills</p>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className="text-2xl font-bold text-slate-900">
                                                    {billableWorks.filter(w => w.billable_type === 'WORKFLOW' && w.status === 'READY_TO_BILL').length}
                                                </h4>
                                                <span className="text-xs font-medium text-slate-500">Ready</span>
                                            </div>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                            <LayoutDashboard className="h-5 w-5 text-indigo-500" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm border-slate-200 bg-white rounded-xl overflow-hidden">
                                    <CardContent className="p-5 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500 mb-1">Pending Step Bills</p>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className="text-2xl font-bold text-slate-900">
                                                    {billableWorks.filter(w => w.billable_type === 'STEP' && w.status === 'READY_TO_BILL').length}
                                                </h4>
                                                <span className="text-xs font-medium text-slate-500">Ready</span>
                                            </div>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-blue-500" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm border-slate-200 bg-white rounded-xl overflow-hidden">
                                    <CardContent className="p-5 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500 mb-1">Draft Bills</p>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className="text-2xl font-bold text-slate-900">
                                                    {invoices.filter(i => i.status === 'draft').length}
                                                </h4>
                                                <span className="text-xs font-medium text-slate-500">Awaiting approval</span>
                                            </div>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-amber-500" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm border-slate-200 bg-white rounded-xl overflow-hidden">
                                    <CardContent className="p-5 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500 mb-1">Overdue Bills</p>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className="text-2xl font-bold text-red-600">
                                                    {invoices.filter(i => ['invoice_generated', 'sent', 'partially_paid'].includes(i.status) && new Date(i.due_date || new Date()) < new Date()).length}
                                                </h4>
                                                <span className="text-xs font-medium text-red-500">Past due date</span>
                                            </div>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            
                            {renderBillableWorksTable()}
                        </TabsContent>
                    </div>
                </Tabs>
                
                {/* Pagination / Footer */}
                <div className="border-t border-slate-200 bg-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
                    <div className="font-medium">
                        Showing data across filtered results
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Rows per page</span>
                            <select className="border-slate-200 border rounded-md px-2 py-1.5 shadow-sm bg-white outline-none focus:ring-1 focus:ring-primary/20">
                                <option>10</option>
                                <option>20</option>
                                <option>50</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled className="shadow-sm h-8 font-medium">Previous</Button>
                            <Button variant="outline" size="sm" disabled className="shadow-sm h-8 font-medium">Next</Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Modals */}
            {paymentInvoice && (
                <PaymentDialog 
                    isOpen={!!paymentInvoice} 
                    onClose={() => setPaymentInvoice(null)} 
                    invoice={paymentInvoice} 
                    onSuccess={() => {
                        setPaymentInvoice(null);
                        fetchData();
                    }} 
                />
            )}

            <Dialog open={!!cancelInvoiceId} onOpenChange={(open) => !open && setCancelInvoiceId(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Ban className="h-5 w-5" /> Cancel Record
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-slate-600">Are you sure you want to cancel this? This action cannot be undone.</p>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900">Cancellation Reason</label>
                            <Input 
                                placeholder="E.g., Billed incorrectly" 
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                className="shadow-sm mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" className="shadow-sm">Back</Button></DialogClose>
                        <Button variant="destructive" onClick={handleCancelInvoice} className="shadow-sm">Confirm Cancellation</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { Loader2, PlusCircle, Trash2, DownloadCloud } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/page-skeleton';

export function TokenInventory() {
    const [activeTab, setActiveTab] = useState('inventory');
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);

    const [masters, setMasters] = useState<any[]>([]);
    const [purchases, setPurchases] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [ledgerFilter, setLedgerFilter] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        const [mSnap, pSnap, sSnap, cSnap] = await Promise.all([
            supabase.from('token_masters').select('*'),
            supabase.from('token_purchases').select('*'),
            supabase.from('token_sales').select('*'),
            supabase.from('clients').select('id, company_name')
        ]);

        setMasters(mSnap.data || []);

        setPurchases((pSnap.data || []).map(p => ({
            ...p, tokenId: p.token_id, supplierId: p.supplier_id, gstin: p.gstin,
            invoiceNumber: p.invoice_number, invoiceDate: p.invoice_date, address: p.address,
            ratePerToken: p.rate_per_token, quantity: p.quantity, gstPercentage: p.gst_percentage,
            gstAmount: p.gst_amount, totalBeforeGst: p.total_before_gst,
            totalInvoiceValue: p.total_invoice_value, inwardFreight: p.inward_freight,
            finalCostPerToken: p.final_cost_per_token, createdAt: new Date(p.created_at).getTime()
        })));

        setSales((sSnap.data || []).map(s => ({
            ...s, tokenId: s.token_id, clientId: s.client_id, quantity: s.quantity,
            date: s.date, invoiceDetails: s.invoice_details, salesDetails: s.sales_details,
            valuationMethod: s.valuation_method, costPerToken: s.cost_per_token,
            createdAt: new Date(s.created_at).getTime()
        })));

        setClients((cSnap.data || []).map(c => ({ id: c.id, clientName: c.company_name })));
        setIsLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    // Filters for masters
    const tokenNames = masters.filter(m => m.type === 'TOKEN_NAME');
    const suppliers = masters.filter(m => m.type === 'SUPPLIER');
    const customers = masters.filter(m => m.type === 'CUSTOMER');

    // --- Master Logic ---
    const [masterForm, setMasterForm] = useState({ name: '', type: 'TOKEN_NAME' });

    const handleSaveMaster = async () => {
        if (!masterForm.name) return;
        await supabase.from('token_masters').insert(masterForm);
        setMasterForm({ name: '', type: 'TOKEN_NAME' });
        loadData();
    };

    const handleDeleteMaster = async (id: string) => {
        if (confirm('Delete master?')) { await supabase.from('token_masters').delete().eq('id', id); loadData(); }
    };

    // --- Purchase Logic ---
    const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
    const [purchaseForm, setPurchaseForm] = useState({
        tokenId: '', supplierId: '', gstin: '', invoiceNumber: '', invoiceDate: '', address: '',
        ratePerToken: 0, quantity: 1, gstPercentage: 18, inwardFreight: 0
    });

    const totalBeforeGst = purchaseForm.ratePerToken * purchaseForm.quantity;
    const computedGstAmount = totalBeforeGst * (purchaseForm.gstPercentage / 100);
    const totalInvoiceValue = totalBeforeGst + computedGstAmount;
    const finalCostPerToken = purchaseForm.quantity > 0 ? (totalInvoiceValue + purchaseForm.inwardFreight) / purchaseForm.quantity : 0;

    const handleSavePurchase = async () => {
        const payload = {
            token_id: purchaseForm.tokenId, supplier_id: purchaseForm.supplierId, gstin: purchaseForm.gstin,
            invoice_number: purchaseForm.invoiceNumber, invoice_date: purchaseForm.invoiceDate || null, address: purchaseForm.address,
            rate_per_token: purchaseForm.ratePerToken, quantity: purchaseForm.quantity, gst_percentage: purchaseForm.gstPercentage,
            inward_freight: purchaseForm.inwardFreight, total_before_gst: totalBeforeGst,
            total_invoice_value: totalInvoiceValue, final_cost_per_token: finalCostPerToken, gst_amount: computedGstAmount
        };
        await supabase.from('token_purchases').insert(payload);
        setIsPurchaseOpen(false);
        setPurchaseForm({ tokenId: '', supplierId: '', gstin: '', invoiceNumber: '', invoiceDate: '', address: '', ratePerToken: 0, quantity: 1, gstPercentage: 18, inwardFreight: 0 });
        loadData();
    };

    // --- Sales Logic ---
    const [isSaleOpen, setIsSaleOpen] = useState(false);
    const [saleForm, setSaleForm] = useState({
        tokenId: '', clientId: '', quantity: 1, date: new Date().toISOString().split('T')[0],
        invoiceDetails: '', salesDetails: '', valuationMethod: 'FIFO'
    });

    const calculateSaleCost = () => {
        if (!saleForm.tokenId || saleForm.quantity <= 0) return 0;
        const relevantPurchases = purchases.filter(p => p.tokenId === saleForm.tokenId).sort((a, b) => a.createdAt - b.createdAt);
        if (relevantPurchases.length === 0) return 0;

        if (saleForm.valuationMethod === 'W-AVG') {
            const totalQty = relevantPurchases.reduce((acc, p) => acc + p.quantity, 0);
            const totalCost = relevantPurchases.reduce((acc, p) => acc + (p.finalCostPerToken * p.quantity), 0);
            return totalQty > 0 ? (totalCost / totalQty) * saleForm.quantity : 0;
        } else {
            let remain = saleForm.quantity;
            let cost = 0;
            for (const p of relevantPurchases) {
                if (remain <= 0) break;
                const take = Math.min(remain, p.quantity);
                cost += (take * p.finalCostPerToken);
                remain -= take;
            }
            return cost;
        }
    };

    const handleSaveSale = async () => {
        const payload = {
            token_id: saleForm.tokenId, client_id: saleForm.clientId, quantity: saleForm.quantity, date: saleForm.date || null,
            invoice_details: saleForm.invoiceDetails, sales_details: saleForm.salesDetails,
            valuation_method: saleForm.valuationMethod, cost_per_token: calculateSaleCost() / saleForm.quantity
        };
        await supabase.from('token_sales').insert(payload);
        setIsSaleOpen(false);
        setSaleForm({ tokenId: '', clientId: '', quantity: 1, date: new Date().toISOString().split('T')[0], invoiceDetails: '', salesDetails: '', valuationMethod: 'FIFO' });
        loadData();
    };

    const handleGenerateInvoice = async (sale: any) => {
        setIsGeneratingPdf(sale.id);
        try {
            const { jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas')).default;

            const el = document.getElementById(`invoice-elem-${sale.id}`);
            if (el) {
                el.style.display = 'block';
                const canvas = await html2canvas(el, { scale: 2 });
                el.style.display = 'none';
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`Invoice_${sale.id}.pdf`);
            }
        } catch (e) {
            console.error("PDF Generate Error", e);
            alert("Failed to generate PDF. Check console for details.");
        } finally {
            setIsGeneratingPdf(null);
        }
    }

    if (isLoading) return <div className="p-6"><PageSkeleton /></div>;

    const getStock = (tId: string) => {
        const inQty = purchases.filter(p => p.tokenId === tId).reduce((a, b) => a + b.quantity, 0);
        const outQty = sales.filter(s => s.tokenId === tId).reduce((a, b) => a + b.quantity, 0);
        return inQty - outQty;
    };

    const getLedgerRows = (tokenId: string) => {
        const records: any[] = [];
        purchases.filter(p => p.tokenId === tokenId).forEach(p => records.push({
            date: p.invoiceDate || new Date(p.createdAt || Date.now()).toISOString().split('T')[0],
            type: 'IN',
            reference: `Purchase from ${suppliers.find(x => x.id === p.supplierId)?.name || 'Supplier'} (${p.invoiceNumber})`,
            qtyIn: p.quantity,
            qtyOut: 0,
            ts: p.createdAt || 0
        }));
        sales.filter(s => s.tokenId === tokenId).forEach(s => records.push({
            date: s.date || new Date(s.createdAt || Date.now()).toISOString().split('T')[0],
            type: 'OUT',
            reference: `Sale to ${clients.find(c => c.id === s.clientId)?.clientName || 'Unknown'}`,
            qtyIn: 0,
            qtyOut: s.quantity,
            ts: s.createdAt || 0
        }));

        records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.ts - b.ts);

        let balance = 0;
        return records.map((r, i) => {
            balance += r.qtyIn - r.qtyOut;
            return <TableRow key={i}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.type === 'IN' ? <span className="text-green-600 font-bold">IN</span> : <span className="text-red-500 font-bold">OUT</span>}</TableCell>
                <TableCell>{r.reference}</TableCell>
                <TableCell className="text-green-600 font-bold">{r.qtyIn > 0 ? `+${r.qtyIn}` : '-'}</TableCell>
                <TableCell className="text-red-500 font-bold">{r.qtyOut > 0 ? `-${r.qtyOut}` : '-'}</TableCell>
                <TableCell className="font-bold border-l">{balance}</TableCell>
            </TableRow>;
        });
    };

    return (
        <Card className="min-h-[70vh]">
            <CardHeader><CardTitle>Token Management</CardTitle></CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4 flex flex-wrap gap-2 h-auto">
                        <TabsTrigger value="inventory">Inventory Summary</TabsTrigger>
                        <TabsTrigger value="purchases">Purchases</TabsTrigger>
                        <TabsTrigger value="sales">Sales & Invoicing</TabsTrigger>
                        <TabsTrigger value="ledger">Stock Ledger Report</TabsTrigger>
                        <TabsTrigger value="masters">Masters</TabsTrigger>
                    </TabsList>

                    <TabsContent value="inventory">
                        <Table>
                            <TableHeader><TableRow><TableHead>Token Name</TableHead><TableHead>Purchased</TableHead><TableHead>Sold</TableHead><TableHead className="font-bold">In Stock</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {tokenNames.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{t.name}</TableCell>
                                        <TableCell>{purchases.filter(p => p.tokenId === t.id).reduce((a, b) => a + b.quantity, 0)}</TableCell>
                                        <TableCell>{sales.filter(s => s.tokenId === t.id).reduce((a, b) => a + b.quantity, 0)}</TableCell>
                                        <TableCell className="font-bold text-sky-700 bg-sky-50">{getStock(t.id)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent value="purchases">
                        <Button className="mb-4" onClick={() => setIsPurchaseOpen(true)}><PlusCircle className="mr-2 w-4 h-4" /> Add Purchase</Button>
                        <Table>
                            <TableHeader><TableRow><TableHead>Token</TableHead><TableHead>Supplier</TableHead><TableHead>Invoice</TableHead><TableHead>Qty</TableHead><TableHead>Final Cost/Token</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {purchases.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{tokenNames.find(x => x.id === p.tokenId)?.name}</TableCell>
                                        <TableCell>{suppliers.find(x => x.id === p.supplierId)?.name}</TableCell>
                                        <TableCell>{p.invoiceNumber} <span className="text-xs text-muted-foreground ml-1">({p.invoiceDate})</span></TableCell>
                                        <TableCell>{p.quantity}</TableCell>
                                        <TableCell className="font-bold text-sky-700">₹{p.finalCostPerToken.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent value="sales">
                        <Button className="mb-4" onClick={() => setIsSaleOpen(true)}><PlusCircle className="mr-2 w-4 h-4" /> Record Sale</Button>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Token</TableHead><TableHead>Client</TableHead><TableHead>Qty</TableHead><TableHead>Cost</TableHead><TableHead className="text-right">Invoice</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {sales.map(s => {
                                    const tName = tokenNames.find(x => x.id === s.tokenId)?.name || 'Unknown Token';
                                    const cName = clients.find(x => x.id === s.clientId)?.clientName || 'Unknown Client';
                                    return (
                                        <TableRow key={s.id}>
                                            <TableCell>{s.date}</TableCell>
                                            <TableCell>{tName}</TableCell>
                                            <TableCell>{cName}</TableCell>
                                            <TableCell>{s.quantity}</TableCell>
                                            <TableCell className="font-medium text-amber-700">₹{(s.costPerToken * s.quantity).toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => handleGenerateInvoice(s)} disabled={isGeneratingPdf === s.id}>
                                                    {isGeneratingPdf === s.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DownloadCloud className="w-4 h-4 mr-2" />}
                                                    Generate PDF
                                                </Button>
                                                {/* Hidden Template for PDF Engine */}
                                                <div id={`invoice-elem-${s.id}`} style={{ display: 'none', position: 'absolute', top: '-9999px', padding: '40px', background: 'white', width: '800px', color: 'black', fontFamily: 'sans-serif' }}>
                                                    <h1 style={{ fontSize: '32px', borderBottom: '2px solid black', paddingBottom: '10px', margin: 0 }}>TAX INVOICE</h1>
                                                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                                        <div><strong>Billed To:</strong><br />{cName}</div>
                                                        <div style={{ textAlign: 'right' }}><strong>Date:</strong> {s.date}<br /><strong>Invoice #:</strong> INV-{s.id.slice(-6).toUpperCase()}</div>
                                                    </div>
                                                    <table style={{ width: '100%', marginTop: '40px', borderCollapse: 'collapse', fontSize: '14px' }}>
                                                        <thead><tr style={{ borderBottom: '1px solid black', background: '#f8f9fa' }}><th style={{ textAlign: 'left', padding: '10px' }}>Item Description</th><th style={{ textAlign: 'center', padding: '10px' }}>Qty</th><th style={{ textAlign: 'right', padding: '10px' }}>Total Amount</th></tr></thead>
                                                        <tbody>
                                                            <tr><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{tName} Digital Signature Token</td><td style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>{s.quantity}</td><td style={{ textAlign: 'right', padding: '10px', borderBottom: '1px solid #eee' }}>₹{(s.costPerToken * s.quantity).toFixed(2)}</td></tr>
                                                        </tbody>
                                                    </table>
                                                    <div style={{ marginTop: '20px', textAlign: 'right', fontSize: '18px', fontWeight: 'bold' }}>Grand Total: ₹{(s.costPerToken * s.quantity).toFixed(2)}</div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent value="ledger">
                        <div className="flex gap-4 mb-4 items-end max-w-sm">
                            <div className="space-y-2 flex-1"><Label>Select Token</Label><Select value={ledgerFilter} onValueChange={setLedgerFilter}><SelectTrigger><SelectValue placeholder="Token Filter" /></SelectTrigger><SelectContent>{tokenNames.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        {ledgerFilter ? (
                            <Table>
                                <TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead>In Qty</TableHead><TableHead>Out Qty</TableHead><TableHead className="border-l font-bold text-slate-800">Running Balance</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {getLedgerRows(ledgerFilter)}
                                </TableBody>
                            </Table>
                        ) : <div className="p-8 text-center text-slate-500 border border-dashed rounded-md mt-4">Select a token to view its complete inward and outward ledger.</div>}
                    </TabsContent>

                    <TabsContent value="masters">
                        <div className="flex gap-4 mb-4 items-end">
                            <div className="space-y-2"><Label>Master Type</Label><Select value={masterForm.type} onValueChange={v => setMasterForm({ ...masterForm, type: v })}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TOKEN_NAME">Token Name</SelectItem><SelectItem value="SUPPLIER">Supplier</SelectItem><SelectItem value="CUSTOMER">Customer (Deprecated, use Client Repo)</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2 flex-1"><Label>Name</Label><Input value={masterForm.name} onChange={e => setMasterForm({ ...masterForm, name: e.target.value })} /></div>
                            <Button onClick={handleSaveMaster}>Add Master</Button>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            {(['TOKEN_NAME', 'SUPPLIER', 'CUSTOMER'] as const).map(type => (
                                <Card key={type}><CardHeader className="py-3 bg-slate-50"><CardTitle className="text-sm">{type.replace('_', ' ')}</CardTitle></CardHeader><CardContent className="p-0"><Table><TableBody>{masters.filter(m => m.type === type).map(m => (<TableRow key={m.id}><TableCell>{m.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDeleteMaster(m.id)}><Trash2 className="w-4 h-4" /></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>

            <Dialog open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Adding New Token Purchase Entry</DialogTitle>
                        <DialogDescription>Enter the details for Token Purchase Entry.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Token Name</Label>
                            <div className="flex gap-2">
                                <Select value={purchaseForm.tokenId} onValueChange={v => setPurchaseForm({ ...purchaseForm, tokenId: v })}>
                                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>{tokenNames.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        setIsPurchaseOpen(false);
                                        setActiveTab('masters');
                                        setMasterForm({ name: '', type: 'TOKEN_NAME' });
                                    }}
                                    title="Add New Token"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Supplier</Label>
                            <div className="flex gap-2">
                                <Select value={purchaseForm.supplierId} onValueChange={v => setPurchaseForm({ ...purchaseForm, supplierId: v })}>
                                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>{suppliers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        setIsPurchaseOpen(false);
                                        setActiveTab('masters');
                                        setMasterForm({ name: '', type: 'SUPPLIER' });
                                    }}
                                    title="Add New Supplier"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2"><Label>Invoice No</Label><Input value={purchaseForm.invoiceNumber} onChange={e => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={purchaseForm.invoiceDate} onChange={e => setPurchaseForm({ ...purchaseForm, invoiceDate: e.target.value })} /></div>
                        <div className="space-y-2"><Label>GSTIN</Label><Input value={purchaseForm.gstin} onChange={e => setPurchaseForm({ ...purchaseForm, gstin: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Qty</Label><Input type="number" value={purchaseForm.quantity || ''} onChange={e => setPurchaseForm({ ...purchaseForm, quantity: parseFloat(e.target.value) || 0 })} /></div>
                        <div className="space-y-2"><Label>Rate Per Token (₹) [Excl. GST]</Label><Input type="number" value={purchaseForm.ratePerToken || ''} onChange={e => setPurchaseForm({ ...purchaseForm, ratePerToken: parseFloat(e.target.value) || 0 })} /></div>
                        <div className="space-y-2"><Label>Total Basic (Auto)</Label><Input disabled value={totalBeforeGst.toFixed(2)} className="bg-slate-50" /></div>
                        <div className="space-y-2"><Label>GST (%)</Label><Input type="number" value={purchaseForm.gstPercentage || ''} onChange={e => setPurchaseForm({ ...purchaseForm, gstPercentage: parseFloat(e.target.value) || 0 })} /></div>
                        <div className="space-y-2"><Label>GST Amount (Auto)</Label><Input disabled value={computedGstAmount.toFixed(2)} className="bg-slate-50" /></div>
                        <div className="space-y-2"><Label>Total Invoice Value</Label><Input disabled value={totalInvoiceValue.toFixed(2)} className="bg-slate-50" /></div>
                        <div className="space-y-2"><Label>Inward Freight (₹) [Excl. GST]</Label><Input type="number" value={purchaseForm.inwardFreight || ''} onChange={e => setPurchaseForm({ ...purchaseForm, inwardFreight: parseFloat(e.target.value) || 0 })} /></div>
                        <div className="col-span-2 bg-green-50 rounded-md p-2 border border-green-200"><Label className="text-green-800">Final True Cost / Token</Label><div className="text-xl font-bold text-green-700">₹{finalCostPerToken.toFixed(2)}</div></div>
                    </div>
                    <DialogFooter><Button onClick={handleSavePurchase}>Confirm Purchase Record</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isSaleOpen} onOpenChange={setIsSaleOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adding New Token Sale / Issuance</DialogTitle>
                        <DialogDescription>Enter the details for Token Sale / Issuance.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2"><Label>Client</Label><Select value={saleForm.clientId} onValueChange={v => setSaleForm({ ...saleForm, clientId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName}</SelectItem>)}</SelectContent></Select></div>
                        <div className="col-span-2 space-y-2"><Label>Token Selected</Label><Select value={saleForm.tokenId} onValueChange={v => setSaleForm({ ...saleForm, tokenId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{tokenNames.map(t => <SelectItem key={t.id} value={t.id}>{t.name} (Stock: {getStock(t.id)})</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Qty Sold</Label><Input type="number" value={saleForm.quantity || ''} onChange={e => setSaleForm({ ...saleForm, quantity: parseFloat(e.target.value) || 0 })} /></div>
                        <div className="space-y-2"><Label>Date</Label><Input type="date" value={saleForm.date} onChange={e => setSaleForm({ ...saleForm, date: e.target.value })} /></div>
                        <div className="col-span-2 space-y-2"><Label>Valuation Method</Label><Select value={saleForm.valuationMethod} onValueChange={v => setSaleForm({ ...saleForm, valuationMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIFO">FIFO (First In First Out)</SelectItem><SelectItem value="W-AVG">Weighted Average</SelectItem></SelectContent></Select></div>
                        <div className="col-span-2 p-3 bg-slate-50 rounded text-sm text-slate-500">Calculated COGS for this sale: <span className="font-bold text-slate-900">₹{calculateSaleCost().toFixed(2)}</span></div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveSale}>Log Sales</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

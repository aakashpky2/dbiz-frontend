'use client';

import React, { useEffect, useState, use, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download, Edit } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useProfiles } from '@/hooks/use-profiles';

type PageProps = {
    params: Promise<{ id: string }>;
};

interface InvoiceItem {
    id: string;
    fee_type: string;
    particulars: string;
    amount: number;
    gst_applicable: boolean;
    gst_rate: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_amount: number;
}

interface Invoice {
    id: string;
    internal_bill_no: string;
    tax_invoice_no: string | null;
    is_tax_invoice: boolean;
    invoice_date: string;
    due_date: string | null;
    status: string;
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    grand_total: number;
    notes: string;
    snapshot_client_name: string;
    snapshot_client_gstin: string;
    snapshot_client_address: string;
    snapshot_work_name: string;
    snapshot_step_name: string;
    snapshot_profile_name: string;
    snapshot_profile_gstin: string;
    snapshot_profile_address: string;
    clients?: { client_name: string };
    tasks?: { title: string };
    items: InvoiceItem[];
}

export default function InvoicePreviewPage({ params }: PageProps) {
    const { id } = use(params);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loadingInvoice, setLoadingInvoice] = useState(true);
    const [logoLoaded, setLogoLoaded] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const { toast } = useToast();
    const invoiceRef = useRef<HTMLDivElement>(null);
    
    // Fetch profiles using the same API as Company Settings
    const { profiles, loading: loadingProfile } = useProfiles();

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const res = await apiFetch('/api/billing/' + id);
                const data = await res.json();
                if (data.success) {
                    setInvoice(data.data);
                } else {
                    toast({ title: 'Error', description: data.message, variant: 'destructive' });
                }
            } catch (err) {
                console.error(err);
                toast({ title: 'Error', description: 'Failed to load invoice.', variant: 'destructive' });
            } finally {
                setLoadingInvoice(false);
            }
        };

        fetchInvoice();
    }, [id, toast]);

    const companyProfile = useMemo(() => {
        if (loadingProfile || !profiles || profiles.length === 0) return null;
        
        let selectedProfile = profiles.find(p => p.isDefault === true || (p as any).default_profile === true);
        if (!selectedProfile) {
            selectedProfile = profiles[0]; // fallback to first active
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('Profiles API Response:', profiles);
            console.log('Selected Default Profile:', selectedProfile);
        }

        const fields = selectedProfile.fields || {};
        let logoUrl = fields.logo_url || fields.logo || fields.company_logo || '';
        
        // Convert relative path to public URL
        if (logoUrl && !logoUrl.startsWith('http')) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://heuzevibdxoraagyxefa.supabase.co';
            // Default to company-assets bucket since that's what upload-company-asset uses
            logoUrl = `${supabaseUrl}/storage/v1/object/public/company-assets/${logoUrl}`;
        }

        return {
            company_name: selectedProfile.profileName || fields.company_name || fields.name || '',
            address: fields.registered_office_address || fields.address || fields.full_address || '',
            gstin: fields.gstin || fields.gst_number || '',
            phone: fields.phone || fields.contact_number || fields.mobile || '',
            email: fields.email || fields.email_address || '',
            website: fields.website || '',
            logo_url: logoUrl
        };
    }, [profiles, loadingProfile]);

    const isReady = !loadingProfile && (!companyProfile?.logo_url || logoLoaded);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        if (!invoiceRef.current) return;
        setDownloading(true);
        try {
            // Temporarily add a class to ensure it renders perfectly for A4
            invoiceRef.current.classList.add('pdf-render-mode');
            
            const canvas = await html2canvas(invoiceRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: 794 // A4 width in pixels
            });
            
            invoiceRef.current.classList.remove('pdf-render-mode');
            
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = 210;
            const pdfHeight = 297;
            const margin = 10;
            const imgWidth = pdfWidth - 2 * margin; // 190mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = margin;

            pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
            heightLeft -= (pdfHeight - 2 * margin);

            while (heightLeft > 0) {
                position = position - (pdfHeight - 2 * margin);
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
                heightLeft -= (pdfHeight - 2 * margin);
            }
            
            const filename = (invoice?.is_tax_invoice ? invoice.tax_invoice_no || 'Tax-Invoice' : invoice?.internal_bill_no || 'Internal-Bill') + '.pdf';
            pdf.save(filename.replace(/\//g, '-')); // Sanitize filename
            toast({ title: 'Success', description: 'PDF downloaded successfully.' });
        } catch (error) {
            console.error('PDF generation error:', error);
            toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
        } finally {
            setDownloading(false);
        }
    };

    if (loadingInvoice) return <div className="p-12 text-center text-slate-500">Loading invoice...</div>;
    if (!invoice) return <div className="p-12 text-center text-red-500 font-semibold">Invoice not found.</div>;

    const isTaxInvoice = invoice.is_tax_invoice;
    const isEditable = !isTaxInvoice && ['draft', 'pending_approval'].includes(invoice.status);

    return (
        <div className="p-4 sm:p-6 w-full mx-auto space-y-6 pb-24">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between no-print mb-6 gap-4 border-b pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/accounts/billing">
                        <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {isTaxInvoice ? 'Tax Invoice' : 'Internal Bill'} Preview
                    </h1>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {isEditable && (
                        <Link href={'/dashboard/accounts/billing/' + id + '/edit'}>
                            <Button variant="default" className="bg-slate-900 text-white hover:bg-slate-800">
                                <Edit className="h-4 w-4 mr-2" /> Edit Bill
                            </Button>
                        </Link>
                    )}
                    <Button variant="outline" onClick={handlePrint} disabled={!isReady}>
                        <Printer className="h-4 w-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" onClick={handleDownloadPDF} disabled={downloading || !isReady}>
                        <Download className="h-4 w-4 mr-2" /> 
                        {downloading ? 'Generating...' : 'Download PDF'}
                    </Button>
                </div>
            </div>

            {/* Print Container */}
            <div className="w-full overflow-x-auto pb-6">
                <div 
                    id="invoice-print-area"
                    ref={invoiceRef}
                    className="bg-white p-8 md:p-10 border rounded-xl shadow-sm mx-auto w-[794px] min-w-[794px] box-border invoice-document"
                >
                    <div className="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-6">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                                {isTaxInvoice ? 'TAX INVOICE' : 'INTERNAL BILL'}
                            </h2>
                            <div className="mt-3 text-sm text-slate-600 space-y-1">
                                <p><strong className="text-slate-800">No:</strong> {isTaxInvoice ? invoice.tax_invoice_no : invoice.internal_bill_no}</p>
                                <p><strong className="text-slate-800">Date:</strong> {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</p>
                                {invoice.due_date && <p><strong className="text-slate-800">Due Date:</strong> {format(new Date(invoice.due_date), 'dd MMM yyyy')}</p>}
                            </div>
                        </div>
                        <div className="text-right max-w-[350px] text-sm flex flex-col items-end">
                            {loadingProfile ? (
                                <div className="space-y-2 w-[200px] flex flex-col items-end">
                                    <div className="h-12 w-24 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                                </div>
                            ) : companyProfile ? (
                                <>
                                    {companyProfile.logo_url && (
                                        <img 
                                            src={companyProfile.logo_url} 
                                            alt="Company Logo" 
                                            crossOrigin="anonymous"
                                            className="max-h-[60px] object-contain mb-3"
                                            onLoad={() => setLogoLoaded(true)}
                                            onError={() => setLogoLoaded(true)}
                                        />
                                    )}
                                    <h3 className="font-bold text-lg text-slate-900 break-words">{companyProfile.company_name}</h3>
                                    {companyProfile.address && <p className="text-slate-600 whitespace-pre-line mt-1 leading-relaxed break-words">{companyProfile.address}</p>}
                                    {companyProfile.gstin && <p className="text-slate-700 mt-1 font-medium">GSTIN: {companyProfile.gstin}</p>}
                                    {companyProfile.phone && <p className="text-slate-600 mt-1">Phone: {companyProfile.phone}</p>}
                                    {companyProfile.email && <p className="text-slate-600 mt-0.5">Email: {companyProfile.email}</p>}
                                    {companyProfile.website && <p className="text-slate-600 mt-0.5">Website: {companyProfile.website}</p>}
                                </>
                            ) : (
                                <div className="text-slate-500 italic">No company profile configured.</div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="pr-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Billed To</h3>
                            <h4 className="text-base font-bold text-slate-900 break-words">{invoice.snapshot_client_name || invoice.clients?.client_name || 'Client Name'}</h4>
                            <p className="text-sm text-slate-600 whitespace-pre-line mt-1 leading-relaxed break-words">{invoice.snapshot_client_address || 'Client Address'}</p>
                            {invoice.snapshot_client_gstin && <p className="text-sm font-medium text-slate-700 mt-1">GSTIN: {invoice.snapshot_client_gstin}</p>}
                        </div>
                        
                        <div className="pl-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Work Details</h3>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <p className="text-sm font-bold text-slate-900 break-words">{invoice.snapshot_work_name || invoice.tasks?.title || 'Work'}</p>
                                {invoice.snapshot_step_name && <p className="text-sm text-slate-600 mt-1">Step: {invoice.snapshot_step_name}</p>}
                            </div>
                        </div>
                    </div>

                    <table className="w-full text-sm text-left mb-6 rounded-lg overflow-hidden border border-slate-200 table-fixed">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="py-3 px-4 font-semibold w-[25%]">Type</th>
                                <th className="py-3 px-4 font-semibold w-[50%]">Particulars</th>
                                <th className="py-3 px-4 font-semibold text-right w-[25%]">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {invoice.items?.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 text-slate-600 truncate">{item.fee_type}</td>
                                    <td className="py-3 px-4 text-slate-900 font-medium break-words">{item.particulars}</td>
                                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                                        {Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex flex-row justify-between items-start mb-8 gap-6">
                        <div className="w-[50%]">
                            {invoice.notes && (
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Terms & Notes</h3>
                                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed break-words">{invoice.notes}</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="w-[45%] space-y-2 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100 shrink-0">
                            <div className="flex justify-between text-slate-600 font-medium">
                                <span>Subtotal</span>
                                <span>₹{Number(invoice.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {Number(invoice.cgst_amount) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>CGST</span>
                                    <span>₹{Number(invoice.cgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            {Number(invoice.sgst_amount) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>SGST</span>
                                    <span>₹{Number(invoice.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            {Number(invoice.igst_amount) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>IGST</span>
                                    <span>₹{Number(invoice.igst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-black text-slate-900 border-t-2 border-slate-200 pt-3 mt-1">
                                <span>Grand Total</span>
                                <span>₹{Number(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t-2 border-slate-100 text-center text-slate-400 text-xs">
                        This is a computer generated document. No signature is required.
                    </div>
                </div>
            </div>

            <style jsx global>{`
                /* PDF Render mode forces dimensions explicitly for html2canvas */
                .pdf-render-mode {
                    width: 794px !important;
                    max-width: 794px !important;
                    min-width: 794px !important;
                    height: auto !important;
                    max-height: none !important;
                    overflow: visible !important;
                    transform: none !important;
                    margin: 0 !important;
                }

                @media print {
                    /* Reset everything that might hide or clip the print layout */
                    html, body, #__next, .h-screen, .overflow-hidden, .overflow-y-auto {
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        position: static !important;
                    }

                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Hide specific layout elements and classes */
                    .no-print, aside, header, nav, footer, .global-command-palette {
                        display: none !important;
                    }

                    /* Force the invoice to render correctly in A4 */
                    #invoice-print-area {
                        position: static !important;
                        width: 190mm !important;
                        max-width: 190mm !important;
                        min-width: 190mm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        transform: none !important;
                        box-sizing: border-box !important;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        min-height: auto !important;
                        height: auto !important;
                        overflow: visible !important;
                        page-break-inside: avoid;
                    }

                    #invoice-print-area * {
                        overflow: visible !important;
                    }

                    .invoice-table-wrapper {
                        max-height: none !important;
                        height: auto !important;
                        overflow: visible !important;
                    }

                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                }
            `}</style>
        </div>
    );
}

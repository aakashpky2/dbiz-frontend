'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
    Edit, 
    Trash2, 
    ArrowRight, 
    CheckCircle2, 
    TrendingUp, 
    AlertCircle, 
    Loader2, 
    Send, 
    CheckCircle, 
    Plus,
    XCircle,
    Info,
    RefreshCw,
    PlusCircle,
    CalendarDays,
    User,
    Check,
    ChevronsUpDown,
    Search,
    Building2,
    Download,
    Eye
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useProfiles } from '@/hooks/use-profiles';
import { supabase } from '@/lib/supabase';
import { 
    normalizeStage, 
    EDITABLE_STAGES, 
    INTERNAL_APPROVAL_STAGES,
    TERMINAL_STAGES, 
    isSentToClientStage, 
    isRevisionRequiredClientStage,
    type ProposalStage 
} from './CRMFollowUpModal/lib/workflowEngine';
import dynamic from 'next/dynamic';
const ProposalReviewModal = dynamic(() => import('./ProposalReviewModal').then(mod => mod.ProposalReviewModal), { ssr: false });
import { TemplateSelectionModal } from './TemplateSelectionModal';
import { API_ENDPOINTS } from '@/lib/api-config';
import { apiFetch } from '@/lib/apiFetch';

interface ProposalActionsProps {
    proposal: any;
    isExpanded?: boolean;
    onEdit: (p: any) => void;
    onGenerate: (p: any) => void;
    onDelete: (id: string, name: string) => void;
    onFollowUp: (p: any, tab?: 'add' | 'history') => void;
    onApprove: (id: string) => void;
    onReject?: (id: string) => void;
    onSend: (id: string, payload: any) => void;
    onAccept: (id: string) => void;
    onConvert: (p: any) => void;
    onAddMoreWork: (p: any) => void;
    isSubmitting?: boolean;
    activeTab?: 'pending' | 'generated';
    onView?: (p: any) => void;
    canManageProposals?: boolean;
}

export const ProposalActions: React.FC<ProposalActionsProps> = ({
    proposal,
    isExpanded = false,
    onEdit,
    onGenerate,
    onDelete,
    onFollowUp,
    onApprove,
    onReject,
    onSend,
    onAccept,
    onConvert,
    onAddMoreWork,
    isSubmitting,
    activeTab,
    onView,
    canManageProposals,
}) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { profiles } = useProfiles();
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [interactionMethods, setInteractionMethods] = useState<string[]>([]);
    
    const [sendPayload, setSendPayload] = useState({
        profileId: '',
        interactionType: '',
        contactDetail: '',
        clientName: '',
        sentDate: new Date().toISOString().split('T')[0]
    });

    const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);
    const [profileSearch, setProfileSearch] = useState('');

    const [isConfirmAcceptOpen, setIsConfirmAcceptOpen] = useState(false);
    const [isConfirmApproveOpen, setIsConfirmApproveOpen] = useState(false);
    const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
    
    // Template Selection states
    const [isTemplateSelectionOpen, setIsTemplateSelectionOpen] = useState(false);
    const [templateOptions, setTemplateOptions] = useState<any[]>([]);

    const proceedWithPDFGeneration = async (templateHtml: string, context: any) => {
        try {
            const { default: Handlebars } = await import('handlebars');
            
            // Register Currency Helper
            Handlebars.registerHelper('formatCurrency', function(value) {
                const num = Number(value);
                if (isNaN(num)) return '₹0.00';
                return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            });

            Handlebars.registerHelper('formatDate', function(dateString) {
                if (!dateString) return '';
                const date = new Date(dateString);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            });

            Handlebars.registerHelper('eq', function(a, b) {
                return a === b;
            });

            Handlebars.registerHelper('add', function(a, b) {
                return Number(a) + Number(b);
            });

            const compiledTemplate = Handlebars.compile(templateHtml);
            const finalHtml = compiledTemplate(context);

            console.log("[PDF compiled html]", finalHtml);

            if (!finalHtml.includes('<img')) {
                toast({ title: 'Error', description: 'Logo image tag missing from template. Please insert logo header.', variant: 'destructive' });
                setIsDownloadingPDF(false);
                return;
            }

            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');

            const container = document.createElement('div');
            container.innerHTML = finalHtml;
            container.style.width = '794px';
            container.style.padding = '40px';
            container.style.backgroundColor = '#ffffff';
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '-9999px';
            document.body.appendChild(container);

            const images = Array.from(container.querySelectorAll('img'));

            await Promise.all(
                images.map((img) => {
                    return new Promise((resolve) => {
                        if (img.complete && img.naturalWidth > 0) {
                            resolve(true);
                            return;
                        }

                        img.onload = () => resolve(true);
                        img.onerror = () => {
                            console.warn('[PDF image failed]', img.src);
                            resolve(false);
                        };

                        // Force reload if needed
                        img.src = img.src;
                    });
                })
            );

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                logging: true,
                scrollY: 0,
                windowWidth: container.scrollWidth,
                windowHeight: container.scrollHeight
            });

            document.body.removeChild(container);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
            }

            pdf.save(`Proposal_${proposal.id || 'Draft'}.pdf`);

            toast({ title: 'Success', description: 'Proposal PDF generated successfully.', variant: 'default' });
        } catch (error) {
            console.error('PDF Generation Error:', error);
            toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
        } finally {
            setIsDownloadingPDF(false);
        }
    };

    const handleTemplateSelected = async (option: any) => {
        setIsTemplateSelectionOpen(false);
        setIsDownloadingPDF(true);
        try {
            const response = await apiFetch(`/api/templates/resolve/configuration/${option.configuration_id}?module=proposal&context_id=${proposal.id}`);
            const data: any = await response.json();
            if (data?.success && data?.data) {
                await proceedWithPDFGeneration(data.data.template_content, data.data.context);
            } else {
                throw new Error("Failed to fetch selected template content");
            }
        } catch (err) {
            console.error("Manual template selection error:", err);
            toast({ title: 'Error', description: 'Failed to generate PDF with selected template.', variant: 'destructive' });
            setIsDownloadingPDF(false);
        }
    };

    const handleDownloadPDF = async () => {
        setIsDownloadingPDF(true);
        try {
            const resolverUrl = `/api/templates/resolve?module=proposal&action_key=download_pdf&context_id=${proposal.id}`;
            
            let resolverResponse: any = { success: false };
            try {
                const response = await apiFetch(resolverUrl);
                resolverResponse = await response.json();
                
                if (response.status >= 500) {
                    toast({ title: 'Template Resolver Failed', description: resolverResponse.message || resolverResponse.error || 'Server error occurred', variant: 'destructive' });
                    throw new Error(resolverResponse.message || "Template resolver failed with 500");
                }
            } catch (err: any) {
                console.error('Failed to resolve template:', err);
                toast({ title: 'Template Resolver Failed', description: err.message, variant: 'destructive' });
                setIsDownloadingPDF(false);
                return;
            }

            if (resolverResponse?.success && resolverResponse?.requiresSelection) {
                setTemplateOptions(resolverResponse.options);
                setIsTemplateSelectionOpen(true);
                setIsDownloadingPDF(false);
                return; // Stop here, modal will continue
            }
            if (resolverResponse?.success && resolverResponse?.data?.template_content) {
                const templateHtml = resolverResponse.data.template_content;
                const context = resolverResponse.data.renderContext || resolverResponse.data.context || {};
                await proceedWithPDFGeneration(templateHtml, context);
                return;
            }

            toast({ title: 'No Template Found', description: 'Please configure a proposal template in the Template Hub.', variant: 'destructive' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
        } finally {
            setIsDownloadingPDF(false);
        }
    };

    // Fetch master data for interaction methods
    React.useEffect(() => {
        const fetchMethods = async () => {
            const { data: category } = await supabase
                .from('app_master_categories')
                .select('id')
                .eq('name', 'Proposal / Method')
                .single();
            
            if (category) {
                const { data: values } = await supabase
                    .from('app_master_values')
                    .select('name')
                    .eq('category_id', category.id)
                    .order('order', { ascending: true });
                
                if (values) setInteractionMethods(values.map(v => v.name));
            }
        };
        if (isSendModalOpen) fetchMethods();
    }, [isSendModalOpen]);

    // Sync profile and client selection
    React.useEffect(() => {
        if (isSendModalOpen) {
            const initialClientName = proposal.client_name || proposal.clientName || proposal.client?.client_name || proposal.client?.name || proposal.company_name || '';
            
            setSendPayload(prev => ({ 
                ...prev, 
                clientName: initialClientName,
                // Reset contact detail when modal opens or interaction type changes
                contactDetail: '' 
            }));

            if (profiles.length > 0) {
                // Pre-select if proposal has profileId
                if (proposal.profileId) {
                    setSendPayload(prev => ({ ...prev, profileId: proposal.profileId }));
                } else if (profiles.length === 1) {
                    setSendPayload(prev => ({ ...prev, profileId: profiles[0].id }));
                }
            }
        }
    }, [isSendModalOpen, profiles, proposal]);

    const getContactDetailLabel = (method: string) => {
        const m = method.toLowerCase().trim();
        if (m === 'call' || m === 'phone call') return 'Phone Number';
        if (m === 'email') return 'Email ID';
        if (m === 'whatsapp' || m === 'whatsapp message') return 'WhatsApp Number';
        if (m === 'meeting') return 'Meeting Place';
        if (m === 'visit') return 'Visit Place';
        if (m === 'other') return 'Contact Details / Remarks';
        return 'Contact Details';
    };

    const validateContactDetail = (method: string, value: string) => {
        const m = method.toLowerCase().trim();
        if (!value.trim()) return "This field is required";

        if (m === 'call' || m === 'phone call' || m === 'whatsapp' || m === 'whatsapp message') {
            // Exactly 10 digits, not starting with 0
            const phoneRegex = /^[1-9]\d{9}$/;
            if (!phoneRegex.test(value)) return "Enter a valid 10-digit number (not starting with 0)";
        }

        if (m === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) return "Invalid email address";
        }

        return null;
    };

    const handleContactDetailChange = (val: string, method: string) => {
        const m = method.toLowerCase().trim();
        if (m === 'call' || m === 'phone call' || m === 'whatsapp' || m === 'whatsapp message') {
            // Only allow digits and max 10 characters
            const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
            
            // Additionally, if the first digit is 0, we can either strip it or just let validation handle it.
            // Requirement says "user can only enter 10 digits that also not starting with 0".
            // To be strict, if they try to type 0 as the first char, we can block it.
            if (digitsOnly.length === 1 && digitsOnly === '0') {
                return; // Don't update
            }

            setSendPayload(prev => ({ ...prev, contactDetail: digitsOnly }));
        } else {
            setSendPayload(prev => ({ ...prev, contactDetail: val }));
        }
    };

    const stage = normalizeStage(proposal?.currentStage || proposal?.current_stage || proposal?.status || "Draft");
    
    // Check if it's pending generation
    const isPending = activeTab === 'pending' || stage === 'pending';
    
    // Strict UI visibility rules
    const showGenerateButton = isPending && stage === 'pending';

    // ── Action Permissions ────────────────────────────────────────────────
    const canApprove = canManageProposals !== false && !isPending && ((INTERNAL_APPROVAL_STAGES || []).includes(stage) || stage === 'revision_required' || stage === 'revision_pending_approval');
    const canSend = canManageProposals !== false && !isPending && stage === 'approved';
    const canAccept = canManageProposals !== false && !isPending && (stage === 'sent' || stage === 'client_reviewing');
    const canConvert = canManageProposals !== false && !isPending && (stage === 'accepted' && !proposal?.convertedToWork);
    const canAddMoreWork = canManageProposals !== false && (stage === 'closed' || stage === 'accepted' || proposal?.convertedToWork);
    const canEdit = canManageProposals !== false && ((EDITABLE_STAGES || []).includes(stage) || isPending);
    const canFollowUp = canManageProposals !== false && !isPending && !(TERMINAL_STAGES || []).includes(stage) && stage !== 'draft' && stage !== 'approved';

    // Collapsed toolbar - just edit/view & delete icons
    if (!isExpanded) {
        return (
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {canManageProposals !== false && showGenerateButton && (
                    <Button
                        size="sm"
                        className="h-8 px-3 mr-1 font-black uppercase text-[9px] tracking-widest bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all active:scale-95"
                        onClick={() => onGenerate(proposal)}
                        disabled={isSubmitting}
                    >
                        Generate Proposal
                    </Button>
                )}
                
                {canManageProposals !== false ? (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-blue-600 hover:bg-blue-50 transition-colors"
                        onClick={() => onEdit(proposal)}
                        title={
                            isPending ? "Generate Proposal" : 
                            isSentToClientStage(proposal) ? "Use Revise Proposal to edit proposals sent to client" :
                            "Edit Proposal"
                        }
                        disabled={!canEdit || isSubmitting || isSentToClientStage(proposal)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                ) : (
                    onView && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50 transition-colors"
                            onClick={() => onView(proposal)}
                            title="View Proposal"
                            disabled={isSubmitting}
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                    )
                )}

                {canManageProposals !== false && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        onClick={() => onDelete(proposal.id, proposal.clientName)}
                        title="Delete Proposal"
                        disabled={isSubmitting}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        );
    }

    // ── Expanded Row Actions ──────────────────────────────────────────────
    return (
        <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-slate-100 w-full" onClick={(e) => e.stopPropagation()}>


            {/* Follow Up */}
            {canFollowUp && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all shadow-sm"
                    onClick={() => onFollowUp(proposal)}
                >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Follow Up
                </Button>
            )}

            {/* Download PDF Flow */}
            {!isPending && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                    onClick={handleDownloadPDF}
                    disabled={isSubmitting || isDownloadingPDF}
                >
                    {isDownloadingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download PDF
                </Button>
            )}

            {/* Internal Approval Loop */}
            {canApprove && (
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="h-10 px-6 font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all active:scale-95"
                        onClick={() => setIsConfirmApproveOpen(true)}
                        disabled={isSubmitting}
                    >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {isRevisionRequiredClientStage(proposal) 
                            ? 'Approve Revision' 
                            : stage === 'draft' 
                                ? 'Submit for Approval' 
                                : 'Approve Proposal'}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 px-4 font-black uppercase text-[10px] tracking-widest text-red-500 hover:bg-red-50"
                        onClick={() => onReject?.(proposal.id)}
                        disabled={isSubmitting}
                    >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                    </Button>
                </div>
            )}

            {/* Send to Client Flow */}
            {canSend && (
                <Button
                    size="sm"
                    className="h-10 px-6 font-black uppercase text-[10px] tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-all active:scale-95"
                    onClick={() => setIsSendModalOpen(true)}
                    disabled={isSubmitting}
                >
                    <Send className="mr-2 h-4 w-4" />
                    Send to Client
                </Button>
            )}

            {/* Acceptance Flow */}
            {canAccept && (
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="h-10 px-6 font-black uppercase text-[10px] tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200 transition-all active:scale-95"
                        onClick={() => setIsConfirmAcceptOpen(true)}
                        disabled={isSubmitting}
                    >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark as Accepted
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all shadow-sm"
                        onClick={() => onEdit(proposal)} // handleEditProposal will determine mode based on stage
                        disabled={isSubmitting}
                    >
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Revise Proposal
                    </Button>
                </div>
            )}

            {/* Conversion Flow */}
            {canConvert && (
                <Button
                    size="sm"
                    className="h-10 px-8 font-black uppercase text-[10px] tracking-widest bg-slate-900 hover:bg-black text-white shadow-lg transition-all active:scale-95"
                    onClick={() => onConvert(proposal)}
                    disabled={isSubmitting}
                >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Convert to Work
                </Button>
            )}

            {/* Re-opening / Add More Work Flow */}
            {canAddMoreWork && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                    onClick={() => onAddMoreWork(proposal)}
                    disabled={isSubmitting}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add More Work
                </Button>
            )}

            {/* ── MODALS ── */}

            {/* 1. Send Modal */}
            <TemplateSelectionModal 
                open={isTemplateSelectionOpen} 
                onOpenChange={setIsTemplateSelectionOpen} 
                options={templateOptions} 
                onSelect={handleTemplateSelected} 
            />

            <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
                <DialogContent className="max-w-[650px] rounded-3xl p-8 border-none shadow-2xl">
                    <DialogHeader>
                        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                            <Send className="h-6 w-6 text-blue-600" />
                        </div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800">Confirm Sending</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            Verify the sender and client details before marking this proposal as sent.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Client Name Row */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Name <span className="text-red-500">*</span></Label>
                            <Input 
                                placeholder="Enter client name"
                                value={sendPayload.clientName}
                                onChange={e => setSendPayload(prev => ({ ...prev, clientName: e.target.value }))}
                                readOnly={!!(proposal.client_name || proposal.clientName || proposal.client?.client_name || proposal.client?.name || proposal.company_name)}
                                className={cn(
                                    "h-11 rounded-xl bg-slate-50 border-slate-200 font-bold",
                                    (proposal.client_name || proposal.clientName || proposal.client?.client_name || proposal.client?.name || proposal.company_name) && "opacity-70 cursor-not-allowed"
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Professional Profile <span className="text-red-500">*</span></Label>
                                <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full h-11 justify-between rounded-xl font-bold text-sm border-slate-200 bg-slate-50 hover:bg-blue-50 transition-all",
                                                !sendPayload.profileId && "text-muted-foreground"
                                            )}
                                        >
                                            <span className="flex items-center gap-2 truncate">
                                                <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                                                {sendPayload.profileId 
                                                    ? profiles.find(p => p.id === sendPayload.profileId)?.profileName || "Selected Profile"
                                                    : "Search Profile..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-2xl border-none z-[120]" align="start">
                                        <Command>
                                            <CommandInput 
                                                placeholder="Search by profile name..." 
                                                className="h-11 font-medium"
                                                value={profileSearch}
                                                onValueChange={setProfileSearch}
                                            />
                                            <CommandList className="max-h-[250px]">
                                                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No profiles found.</CommandEmpty>
                                                <CommandGroup>
                                                    {profiles
                                                        .filter(p => p.profileName.toLowerCase().includes(profileSearch.toLowerCase()))
                                                        .map(p => (
                                                            <CommandItem
                                                                key={p.id}
                                                                value={p.profileName}
                                                                onSelect={() => {
                                                                    setSendPayload(prev => ({ ...prev, profileId: p.id }));
                                                                    setProfilePopoverOpen(false);
                                                                    setProfileSearch('');
                                                                }}
                                                                className="rounded-xl py-3 px-3 cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-3 w-full">
                                                                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                                        <Building2 className="h-4 w-4 text-slate-600" />
                                                                    </div>
                                                                    <span className="font-bold text-sm uppercase">{p.profileName}</span>
                                                                    {sendPayload.profileId === p.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mode of Contact <span className="text-red-500">*</span></Label>
                                <Select 
                                    value={sendPayload.interactionType} 
                                    onValueChange={val => setSendPayload(prev => ({ ...prev, interactionType: val }))}
                                >
                                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs">
                                        <SelectValue placeholder="Select Mode" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[110]">
                                        {interactionMethods
                                            .filter(m => m.toLowerCase() !== 'call1')
                                            .map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {sendPayload.interactionType && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {getContactDetailLabel(sendPayload.interactionType)} <span className="text-red-500">*</span>
                                    </Label>
                                    <Input 
                                        placeholder={`Enter ${getContactDetailLabel(sendPayload.interactionType).toLowerCase()}`}
                                        value={sendPayload.contactDetail}
                                        onChange={e => handleContactDetailChange(e.target.value, sendPayload.interactionType)}
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    />
                                </div>
                            )}
                            <div className={cn("space-y-2", !sendPayload.interactionType && "col-span-2")}>
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Send Date <span className="text-red-500">*</span></Label>
                                <Input 
                                    type="date"
                                    max={new Date().toISOString().split('T')[0]}
                                    value={sendPayload.sentDate} 
                                    onChange={e => setSendPayload(prev => ({ ...prev, sentDate: e.target.value }))}
                                    className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-3 sm:justify-end mt-4">
                        <Button variant="ghost" onClick={() => setIsSendModalOpen(false)} className="rounded-xl font-bold h-11">Cancel</Button>
                        <Button 
                            className="h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200"
                            onClick={() => {
                                if (!sendPayload.clientName.trim()) return toast({ title: "Validation Error", description: "Client Name is required", variant: "destructive" });
                                if (!sendPayload.profileId) return toast({ title: "Validation Error", description: "Please select a professional profile", variant: "destructive" });
                                if (!sendPayload.interactionType) return toast({ title: "Validation Error", description: "Please select a mode of contact", variant: "destructive" });
                                
                                const contactError = validateContactDetail(sendPayload.interactionType, sendPayload.contactDetail);
                                if (contactError) return toast({ title: "Validation Error", description: contactError, variant: "destructive" });
                                
                                if (!sendPayload.sentDate) return toast({ title: "Validation Error", description: "Please select a send date", variant: "destructive" });
                                
                                const today = new Date().toISOString().split('T')[0];
                                if (sendPayload.sentDate > today) {
                                    return toast({ 
                                        title: "Validation Error", 
                                        description: "Send date cannot be in the future", 
                                        variant: "destructive" 
                                    });
                                }
                                
                                onSend(proposal.id, sendPayload);
                                setIsSendModalOpen(false);
                            }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirm & Mark Sent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. Approve Review Modal */}
            <ProposalReviewModal 
                proposal={proposal}
                open={isConfirmApproveOpen}
                onOpenChange={setIsConfirmApproveOpen}
                onConfirm={onApprove}
                onReject={onReject}
                onEdit={onEdit}
                isSubmitting={isSubmitting}
                title="Review & Approve"
                confirmLabel="Approve Now"
                showReject={true}
            />

            {/* 3. Accept Review Modal */}
            <ProposalReviewModal 
                proposal={proposal}
                open={isConfirmAcceptOpen}
                onOpenChange={setIsConfirmAcceptOpen}
                onConfirm={onAccept}
                onReject={onReject}
                onEdit={onEdit}
                isSubmitting={isSubmitting}
                title="Review & Accept"
                confirmLabel="Accept Now"
                confirmIcon={<CheckCircle className="h-4 w-4 stroke-[3]" />}
                showReject={true}
            />

        </div>
    );
};

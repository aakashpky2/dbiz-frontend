'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, CheckCircle, Copy, Loader2, Users, Phone, Mail, User, ShieldCheck, UserPlus } from 'lucide-react';
import { type Client } from '../_components/ClientRow';
import { flattenFields } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface MergeClientPayload {
    keepClientId: string;
    removeClientId: string;
    mergedClient: Partial<Client>;
}

interface MergeClientsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientA: Client;
    clientB: Client;
    onMerge: (payload: MergeClientPayload) => Promise<void>;
    isMerging: boolean;
}

export const MergeClientsDialog: React.FC<MergeClientsDialogProps> = ({
    open,
    onOpenChange,
    clientA,
    clientB,
    onMerge,
    isMerging
}) => {
    const [keepClientId, setKeepClientId] = useState<string>(clientA.id);

    // Field selection state: { fieldKey: 'A' | 'B' }
    const [selectedFields, setSelectedFields] = useState<Record<string, 'A' | 'B'>>({});
    
    // Dynamic fields from both clients
    const flatA = useMemo(() => flattenFields(clientA.fields || {}), [clientA.fields]);
    const flatB = useMemo(() => flattenFields(clientB.fields || {}), [clientB.fields]);
    const allFieldKeys = useMemo(() => {
        const keys = new Set([...Object.keys(flatA), ...Object.keys(flatB)]);
        return Array.from(keys);
    }, [flatA, flatB]);

    // Contacts selection: { contactId: boolean }
    const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
    
    // Members selection: { roleKey: { memberId: boolean } }
    const [selectedMembers, setSelectedMembers] = useState<Record<string, Record<string, boolean>>>({});

    // Initialize state
    useEffect(() => {
        if (!open) return;

        // Reset state
        setKeepClientId(clientA.id);
        
        // Fields initialization
        const initialFields: Record<string, 'A' | 'B'> = {};
        
        // Top-level fields
        const topLevelKeys = ['clientName', 'constitutionId', 'reference', 'sourceType', 'associateId', 'remarks', 'profileId', 'completionStatus', 'changeStatus'];
        topLevelKeys.forEach(key => {
            const valA = clientA[key];
            const valB = clientB[key];
            if (!valA && valB) initialFields[key] = 'B';
            else initialFields[key] = 'A';
        });

        // Dynamic fields
        allFieldKeys.forEach(key => {
            const valA = flatA[key];
            const valB = flatB[key];
            if (!valA && valB) initialFields[key] = 'B';
            else initialFields[key] = 'A';
        });
        setSelectedFields(initialFields);

        // Contacts initialization
        const initialContacts: Record<string, boolean> = {};
        const allContacts = [...(clientA.contacts || []), ...(clientB.contacts || [])];
        
        // Normalized set to detect duplicates
        const seen = new Set<string>();
        allContacts.forEach(c => {
            const email = (c.email || '').trim().toLowerCase();
            const phone = (c.phone || '').trim().replace(/\D/g, '');
            const key = email || phone || c._id || c.id;
            
            if (key && !seen.has(key)) {
                initialContacts[c._id || c.id] = true;
                seen.add(key);
            } else {
                initialContacts[c._id || c.id] = false;
            }
        });
        setSelectedContacts(initialContacts);

        // Members initialization
        const initialMembers: Record<string, Record<string, boolean>> = {};
        const roleKeys = new Set([...Object.keys(clientA.roles || {}), ...Object.keys(clientB.roles || {})]);
        
        roleKeys.forEach(roleKey => {
            initialMembers[roleKey] = {};
            const membersA = clientA.roles?.[roleKey]?.members || [];
            const membersB = clientB.roles?.[roleKey]?.members || [];
            
            const seenMembers = new Set<string>();
            [...membersA, ...membersB].forEach(m => {
                const name = (m.details?.full_name || m.details?.name || '').trim().toLowerCase();
                const phone = (m.details?.phone || m.details?.mobile || '').trim().replace(/\D/g, '');
                const key = name + phone || m._id || m.id;
                
                if (key && !seenMembers.has(key)) {
                    initialMembers[roleKey][m._id || m.id] = true;
                    seenMembers.add(key);
                } else {
                    initialMembers[roleKey][m._id || m.id] = false;
                }
            });
        });
        setSelectedMembers(initialMembers);

    }, [open, clientA, clientB, allFieldKeys, flatA, flatB]);

    const handleMerge = async () => {
        const removeClientId = keepClientId === clientA.id ? clientB.id : clientA.id;
        
        const mergedClient: Partial<Client> = {};
        
        // Construct top-level fields
        const topLevelKeys = ['clientName', 'constitutionId', 'reference', 'sourceType', 'associateId', 'remarks', 'profileId', 'completionStatus', 'changeStatus'];
        topLevelKeys.forEach(key => {
            const side = selectedFields[key];
            mergedClient[key as keyof Client] = side === 'A' ? clientA[key] : clientB[key];
        });

        // Construct dynamic fields
        const mergedFields: Record<string, any> = {};
        allFieldKeys.forEach(key => {
            const side = selectedFields[key];
            mergedFields[key] = side === 'A' ? flatA[key] : flatB[key];
        });
        mergedClient.fields = mergedFields;

        // Construct contacts
        const allContacts = [...(clientA.contacts || []), ...(clientB.contacts || [])];
        mergedClient.contacts = allContacts.filter(c => selectedContacts[c._id || c.id]);

        // Construct roles
        const mergedRoles: Record<string, any> = {};
        const roleKeys = Object.keys(selectedMembers);
        roleKeys.forEach(roleKey => {
            const membersA = clientA.roles?.[roleKey]?.members || [];
            const membersB = clientB.roles?.[roleKey]?.members || [];
            const allMembers = [...membersA, ...membersB];
            
            mergedRoles[roleKey] = {
                members: allMembers.filter(m => selectedMembers[roleKey][m._id || m.id])
            };
        });
        mergedClient.roles = mergedRoles;

        // Rebuild signatories and primarySignatories
        const allSignatories = [...(clientA.signatories || []), ...(clientB.signatories || [])];
        const keptMemberIds = new Set(Object.values(selectedMembers).flatMap(m => Object.entries(m).filter(([_, kept]) => kept).map(([id]) => id)));
        
        mergedClient.signatories = allSignatories.filter(s => keptMemberIds.has(s.memberId));
        
        const mergedPrimarySignatories: Record<string, string> = {};
        const primaryA = clientA.primarySignatories || {};
        const primaryB = clientB.primarySignatories || {};
        
        roleKeys.forEach(roleKey => {
            const idA = primaryA[roleKey];
            const idB = primaryB[roleKey];
            if (idA && keptMemberIds.has(idA)) mergedPrimarySignatories[roleKey] = idA;
            else if (idB && keptMemberIds.has(idB)) mergedPrimarySignatories[roleKey] = idB;
        });
        mergedClient.primarySignatories = mergedPrimarySignatories;

        await onMerge({
            keepClientId,
            removeClientId,
            mergedClient
        });
    };

    const renderFieldRow = (label: string, fieldKey: string) => {
        const valA = clientA[fieldKey as keyof Client] || '—';
        const valB = clientB[fieldKey as keyof Client] || '—';
        const selection = selectedFields[fieldKey];

        return (
            <div key={fieldKey} className="grid grid-cols-12 gap-4 py-3 items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded-md">
                <div className="col-span-4 text-xs font-bold text-slate-500 uppercase tracking-tight">{label}</div>
                <div className="col-span-4 flex items-center gap-2">
                    <RadioGroup value={selection} onValueChange={(val) => setSelectedFields(prev => ({ ...prev, [fieldKey]: val as 'A' | 'B' }))}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="A" id={`field-${fieldKey}-A`} />
                            <Label htmlFor={`field-${fieldKey}-A`} className="text-sm font-medium truncate max-w-[120px]" title={String(valA)}>{String(valA)}</Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="col-span-4 flex items-center gap-2">
                    <RadioGroup value={selection} onValueChange={(val) => setSelectedFields(prev => ({ ...prev, [fieldKey]: val as 'A' | 'B' }))}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="B" id={`field-${fieldKey}-B`} />
                            <Label htmlFor={`field-${fieldKey}-B`} className="text-sm font-medium truncate max-w-[120px]" title={String(valB)}>{String(valB)}</Label>
                        </div>
                    </RadioGroup>
                </div>
            </div>
        );
    };

    const renderDynamicFieldRow = (fieldKey: string) => {
        const valA = flatA[fieldKey] || '—';
        const valB = flatB[fieldKey] || '—';
        const selection = selectedFields[fieldKey];

        return (
            <div key={fieldKey} className="grid grid-cols-12 gap-4 py-3 items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded-md">
                <div className="col-span-4 text-xs font-bold text-slate-500 uppercase tracking-tight truncate pr-2" title={fieldKey}>{fieldKey.replace(/_/g, ' ')}</div>
                <div className="col-span-4 flex items-center gap-2">
                    <RadioGroup value={selection} onValueChange={(val) => setSelectedFields(prev => ({ ...prev, [fieldKey]: val as 'A' | 'B' }))}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="A" id={`dyn-${fieldKey}-A`} />
                            <Label htmlFor={`dyn-${fieldKey}-A`} className="text-sm font-medium truncate max-w-[120px]" title={String(valA)}>{String(valA)}</Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="col-span-4 flex items-center gap-2">
                    <RadioGroup value={selection} onValueChange={(val) => setSelectedFields(prev => ({ ...prev, [fieldKey]: val as 'A' | 'B' }))}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="B" id={`dyn-${fieldKey}-B`} />
                            <Label htmlFor={`dyn-${fieldKey}-B`} className="text-sm font-medium truncate max-w-[120px]" title={String(valB)}>{String(valB)}</Label>
                        </div>
                    </RadioGroup>
                </div>
            </div>
        );
    };

    const diffConstitutions = clientA.constitutionId !== clientB.constitutionId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-slate-900 text-white p-6 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Users className="h-24 w-24" />
                    </div>
                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                            Merge Clients
                        </DialogTitle>
                        <DialogDescription className="text-slate-300 font-medium">
                            Synthesize two client records into one master identity. Choose which details should be preserved.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-8">
                            {/* Warning Section */}
                            {diffConstitutions && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 items-start shadow-sm animate-pulse">
                                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight">Different Constitutions Detected</h4>
                                        <p className="text-xs text-amber-700 font-medium leading-relaxed mt-1">
                                            These clients belong to different business structures. Merging them might lead to mismatched dynamic fields or role requirements. Please review carefully.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-12 gap-6 items-start">
                                {/* Side by Side Header */}
                                <div className="col-span-4" />
                                <div className={cn(
                                    "col-span-4 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                                    keepClientId === clientA.id ? "bg-primary/5 border-primary shadow-md" : "bg-white border-slate-200"
                                )}>
                                    <Badge variant={keepClientId === clientA.id ? "default" : "outline"} className="uppercase font-black text-[10px] px-3">Client A</Badge>
                                    <span className="text-sm font-bold text-slate-800 text-center line-clamp-2 min-h-[40px] flex items-center justify-center">{clientA.clientName}</span>
                                    <Button 
                                        variant={keepClientId === clientA.id ? "default" : "outline"} 
                                        size="sm" 
                                        className="w-full mt-2 font-black text-[10px] h-8 rounded-lg"
                                        onClick={() => setKeepClientId(clientA.id)}
                                    >
                                        {keepClientId === clientA.id ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                                        Keep as Main
                                    </Button>
                                </div>
                                <div className={cn(
                                    "col-span-4 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                                    keepClientId === clientB.id ? "bg-primary/5 border-primary shadow-md" : "bg-white border-slate-200"
                                )}>
                                    <Badge variant={keepClientId === clientB.id ? "default" : "outline"} className="uppercase font-black text-[10px] px-3">Client B</Badge>
                                    <span className="text-sm font-bold text-slate-800 text-center line-clamp-2 min-h-[40px] flex items-center justify-center">{clientB.clientName}</span>
                                    <Button 
                                        variant={keepClientId === clientB.id ? "default" : "outline"} 
                                        size="sm" 
                                        className="w-full mt-2 font-black text-[10px] h-8 rounded-lg"
                                        onClick={() => setKeepClientId(clientB.id)}
                                    >
                                        {keepClientId === clientB.id ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                                        Keep as Main
                                    </Button>
                                </div>
                            </div>

                            <Separator />

                            {/* Section: Core Fields */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Copy className="h-4 w-4 text-primary" /> Core Information
                                </h3>
                                <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
                                    {renderFieldRow('Client Name', 'clientName')}
                                    {renderFieldRow('Reference', 'reference')}
                                    {renderFieldRow('Remarks', 'remarks')}
                                    {renderFieldRow('Completion', 'completionStatus')}
                                    {renderFieldRow('Change Status', 'changeStatus')}
                                </div>
                            </div>

                            {/* Section: Dynamic Fields */}
                            {allFieldKeys.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" /> Constitutional Fields
                                    </h3>
                                    <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
                                        {allFieldKeys.map(key => renderDynamicFieldRow(key))}
                                    </div>
                                </div>
                            )}

                            {/* Section: Contacts */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <UserPlus className="h-4 w-4 text-blue-600" /> Contact Persons
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase ml-1">Contacts from Client A</p>
                                        {(clientA.contacts || []).map(c => (
                                            <div key={c._id || c.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm hover:border-primary/30 transition-all group">
                                                <Checkbox 
                                                    id={`contact-${c._id || c.id}`} 
                                                    checked={selectedContacts[c._id || c.id]}
                                                    onCheckedChange={(checked) => setSelectedContacts(prev => ({ ...prev, [c._id || c.id]: !!checked }))}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{c.name || 'Unnamed Contact'}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {c.email && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {c.email}</span>}
                                                        {c.phone && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {c.phone}</span>}
                                                    </div>
                                                </div>
                                                {!(selectedContacts[c._id || c.id]) && (
                                                    <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-400">Discard</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase ml-1">Contacts from Client B</p>
                                        {(clientB.contacts || []).map(c => (
                                            <div key={c._id || c.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm hover:border-primary/30 transition-all group">
                                                <Checkbox 
                                                    id={`contact-${c._id || c.id}`} 
                                                    checked={selectedContacts[c._id || c.id]}
                                                    onCheckedChange={(checked) => setSelectedContacts(prev => ({ ...prev, [c._id || c.id]: !!checked }))}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{c.name || 'Unnamed Contact'}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {c.email && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {c.email}</span>}
                                                        {c.phone && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {c.phone}</span>}
                                                    </div>
                                                </div>
                                                {!(selectedContacts[c._id || c.id]) && (
                                                    <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-400">Discard</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Section: Roles / Members */}
                            <div className="space-y-4 pb-10">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Users className="h-4 w-4 text-indigo-600" /> Roles & Members
                                </h3>
                                <Accordion type="multiple" className="w-full">
                                    {Object.keys(selectedMembers).map(roleKey => {
                                        const membersA = clientA.roles?.[roleKey]?.members || [];
                                        const membersB = clientB.roles?.[roleKey]?.members || [];
                                        
                                        return (
                                            <AccordionItem value={roleKey} key={roleKey} className="border border-slate-200 bg-white rounded-xl px-4 mb-3 shadow-sm overflow-hidden">
                                                <AccordionTrigger className="hover:no-underline py-4">
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold uppercase text-[9px]">{roleKey.replace(/_/g, ' ')}</Badge>
                                                        <span className="text-xs font-bold text-slate-500">{membersA.length + membersB.length} Members total</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pb-4">
                                                    <div className="grid grid-cols-2 gap-6 border-t border-slate-50 pt-4">
                                                        <div className="space-y-2">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">From A</p>
                                                            {membersA.map((m: any) => (
                                                                <div key={m._id || m.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                    <Checkbox 
                                                                        checked={selectedMembers[roleKey][m._id || m.id]}
                                                                        onCheckedChange={(checked) => setSelectedMembers(prev => ({
                                                                            ...prev,
                                                                            [roleKey]: { ...prev[roleKey], [m._id || m.id]: !!checked }
                                                                        }))}
                                                                    />
                                                                    <span className="text-xs font-bold text-slate-700 truncate">{m.details?.full_name || m.details?.name || 'Unnamed Member'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">From B</p>
                                                            {membersB.map((m: any) => (
                                                                <div key={m._id || m.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                    <Checkbox 
                                                                        checked={selectedMembers[roleKey][m._id || m.id]}
                                                                        onCheckedChange={(checked) => setSelectedMembers(prev => ({
                                                                            ...prev,
                                                                            [roleKey]: { ...prev[roleKey], [m._id || m.id]: !!checked }
                                                                        }))}
                                                                    />
                                                                    <span className="text-xs font-bold text-slate-700 truncate">{m.details?.full_name || m.details?.name || 'Unnamed Member'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="bg-white border-t border-slate-200 p-6 shrink-0 flex items-center justify-between">
                    <div className="flex-1 flex items-center gap-4 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full">
                            <span className="font-black text-slate-900">{Object.values(selectedContacts).filter(Boolean).length}</span> Contacts Kept
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full">
                            <span className="font-black text-slate-900">{Object.values(selectedMembers).reduce((acc, curr) => acc + Object.values(curr).filter(Boolean).length, 0)}</span> Members Kept
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isMerging} className="font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-900">
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleMerge} 
                            disabled={isMerging}
                            className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-95"
                        >
                            {isMerging ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Merging Identities...</>
                            ) : (
                                "Execute Merge"
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

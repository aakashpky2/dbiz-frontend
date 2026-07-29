"use client";

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, GitMerge } from 'lucide-react';

interface ClientData {
    id: string;
    client_name: string;
}

interface WorkflowCloneDialogProps {
    isOpen: boolean;
    onClose: () => void;
    templateId: string;
    templateName: string;
    currentScope: 'GLOBAL' | 'CLIENT';
    clients: ClientData[];
    onSuccess: (newTemplate: any) => void;
}

export function WorkflowCloneDialog({ 
    isOpen, 
    onClose, 
    templateId, 
    templateName, 
    currentScope,
    clients,
    onSuccess 
}: WorkflowCloneDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    // Core settings
    const [mode, setMode] = useState<'COPY' | 'VERSION'>('COPY');
    const [targetScope, setTargetScope] = useState<'GLOBAL' | 'CLIENT'>(currentScope);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [newWorkflowName, setNewWorkflowName] = useState<string>(`${templateName} (Copy)`);
    const [inheritanceMode, setInheritanceMode] = useState<'INHERIT' | 'FREEZE'>('INHERIT');

    // Granular toggles
    const [copyAsDraft, setCopyAsDraft] = useState(true);
    const [copyEffectiveDates, setCopyEffectiveDates] = useState(false);
    const [copyMedia, setCopyMedia] = useState(true);
    const [copyCommonRules, setCopyCommonRules] = useState(true);
    const [copyStepRules, setCopyStepRules] = useState(true);
    const [copyDocumentFields, setCopyDocumentFields] = useState(true);
    const [copyCustomFields, setCopyCustomFields] = useState(true);

    const handleClone = async () => {
        if (targetScope === 'CLIENT' && !selectedClientId) {
            toast({ title: 'Validation Error', description: 'Please select a client for the override.', variant: 'destructive' });
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch(`/api/workflow-templates/${templateId}/clone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    destinationScope: targetScope,
                    destinationClientId: targetScope === 'CLIENT' ? selectedClientId : null,
                    newWorkflowName,
                    inheritanceMode,
                    copyAsDraft,
                    copyEffectiveDates,
                    copyMedia,
                    copyCommonRules,
                    copyStepRules,
                    copyDocumentFields,
                    copyCustomFields
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to copy flow');
            }

            toast({
                title: 'Success',
                description: `Workflow ${mode === 'VERSION' ? 'version created' : 'cloned'} successfully.`,
            });
            
            onSuccess(data.data);
            onClose();
        } catch (error: any) {
            toast({ title: 'Operation Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
                    <DialogTitle className="flex items-center gap-2">
                        {mode === 'VERSION' ? <GitMerge className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                        {mode === 'VERSION' ? 'Create New Version' : 'Copy Flow'}
                    </DialogTitle>
                    <DialogDescription>
                        Source: <strong className="text-foreground">{templateName}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    {/* Operation Mode */}
                    <div className="space-y-3">
                        <Label>Operation Mode</Label>
                        <RadioGroup value={mode} onValueChange={(v: 'COPY'|'VERSION') => {
                            setMode(v);
                            if (v === 'VERSION') {
                                setTargetScope(currentScope);
                                setNewWorkflowName(templateName);
                            }
                        }} className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-2 border p-3 rounded-md">
                                <RadioGroupItem value="COPY" id="mode-copy" />
                                <Label htmlFor="mode-copy" className="flex flex-col cursor-pointer">
                                    <span>Independent Copy</span>
                                    <span className="font-normal text-muted-foreground text-xs mt-1">Creates a brand new flow lineage. Ideal for cross-client copying.</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 border p-3 rounded-md">
                                <RadioGroupItem value="VERSION" id="mode-version" />
                                <Label htmlFor="mode-version" className="flex flex-col cursor-pointer">
                                    <span>New Version (V2)</span>
                                    <span className="font-normal text-muted-foreground text-xs mt-1">Extends current lineage history. Ideal for structural updates.</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {mode === 'COPY' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>New Flow Name</Label>
                                    <Input value={newWorkflowName} onChange={e => setNewWorkflowName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Target Scope</Label>
                                    <Select value={targetScope} onValueChange={(val: 'GLOBAL' | 'CLIENT') => {
                                        setTargetScope(val);
                                        if (val === 'GLOBAL') setSelectedClientId('');
                                    }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GLOBAL">Global Flow</SelectItem>
                                            <SelectItem value="CLIENT">Client Override</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {targetScope === 'CLIENT' && (
                                <div className="space-y-2 bg-muted/20 p-3 rounded-md border-l-2 border-primary">
                                    <Label>Select Target Client</Label>
                                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger><SelectValue placeholder="Search or select a client" /></SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                            {clients.map(client => (
                                                <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {currentScope === 'GLOBAL' && (
                                        <div className="mt-4 pt-4 border-t border-dashed">
                                            <Label className="mb-2 block">Inheritance Strategy</Label>
                                            <RadioGroup value={inheritanceMode} onValueChange={(v: 'INHERIT'|'FREEZE') => setInheritanceMode(v)} className="space-y-2">
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="INHERIT" id="inherit" />
                                                    <Label htmlFor="inherit" className="font-normal text-sm">Linked (Receive future Global updates)</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="FREEZE" id="freeze" />
                                                    <Label htmlFor="freeze" className="font-normal text-sm">Frozen Snapshot (Total isolation)</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Granular Toggles */}
                    <div className="space-y-3 pt-2">
                        <Label>Granular Clone Options</Label>
                        <div className="grid grid-cols-2 gap-3 bg-muted/10 p-4 rounded-md border">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="draft" checked={copyAsDraft} onCheckedChange={(c: boolean) => setCopyAsDraft(c)} />
                                <Label htmlFor="draft" className="font-normal text-sm">Force Draft Status</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="dates" checked={copyEffectiveDates} onCheckedChange={(c: boolean) => setCopyEffectiveDates(c)} />
                                <Label htmlFor="dates" className="font-normal text-sm">Keep Effective Dates</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="media" checked={copyMedia} onCheckedChange={(c: boolean) => setCopyMedia(c)} />
                                <Label htmlFor="media" className="font-normal text-sm">Copy Media (Video/Audio)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="common" checked={copyCommonRules} onCheckedChange={(c: boolean) => setCopyCommonRules(c)} />
                                <Label htmlFor="common" className="font-normal text-sm">Copy Common Rules</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="step" checked={copyStepRules} onCheckedChange={(c: boolean) => setCopyStepRules(c)} />
                                <Label htmlFor="step" className="font-normal text-sm">Copy Step Overrides</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="docs" checked={copyDocumentFields} onCheckedChange={(c: boolean) => setCopyDocumentFields(c)} />
                                <Label htmlFor="docs" className="font-normal text-sm">Copy Document Fields</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="custom" checked={copyCustomFields} onCheckedChange={(c: boolean) => setCopyCustomFields(c)} />
                                <Label htmlFor="custom" className="font-normal text-sm">Copy Custom Fields</Label>
                            </div>
                        </div>
                    </div>

                </div>

                <DialogFooter className="border-t p-6 shrink-0 flex items-center justify-end">
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleClone} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {mode === 'VERSION' ? 'Create Version' : 'Execute Copy'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

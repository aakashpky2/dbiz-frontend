'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { useGovernmentFees } from '@/hooks/useGovernmentFees';
import { governmentFeeService } from '@/services/governmentFeeService';
import { useToast } from '@/hooks/use-toast';

export default function GovernmentFeePage() {
    const { toast } = useToast();
    const { 
        templates, 
        isLoading, 
        fetchTemplates,
        components,
        fetchComponents,
        rules,
        fetchRules
    } = useGovernmentFees() as any;

    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [selectedComponent, setSelectedComponent] = useState<any>(null);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    useEffect(() => {
        if (selectedTemplate) {
            fetchComponents(selectedTemplate.id);
            setSelectedComponent(null);
        }
    }, [selectedTemplate, fetchComponents]);

    useEffect(() => {
        if (selectedComponent) {
            fetchRules(selectedComponent.id);
        }
    }, [selectedComponent, fetchRules]);

    const handleCreateTemplate = async () => {
        const name = prompt('Enter Template Name');
        if (!name) return;
        const code = name.toUpperCase().replace(/\s+/g, '_');
        
        try {
            await (governmentFeeService as any).createTemplate({ name, code });
            toast({ title: 'Template created' });
            fetchTemplates();
        } catch (e: any) {
            toast({ title: e.message || 'Error creating template', variant: 'destructive' });
        }
    };

    const handleCreateComponent = async () => {
        if (!selectedTemplate) return;
        const feeName = prompt('Enter Component Fee Name');
        if (!feeName) return;

        try {
            await (governmentFeeService as any).createComponent({
                template_id: selectedTemplate.id,
                fee_name: feeName,
                calculation_method: 'FIXED',
                is_required: true,
                is_editable: false
            });
            toast({ title: 'Component created' });
            fetchComponents(selectedTemplate.id);
        } catch (e: any) {
            toast({ title: e.message || 'Error creating component', variant: 'destructive' });
        }
    };

    const handleCreateRule = async () => {
        if (!selectedComponent) return;
        const amountStr = prompt('Enter Fixed Fee Amount');
        if (!amountStr) return;

        try {
            await (governmentFeeService as any).createRule({
                component_id: selectedComponent.id,
                fee_amount: Number(amountStr) || 0
            });
            toast({ title: 'Rule created' });
            fetchRules(selectedComponent.id);
        } catch (e: any) {
            toast({ title: e.message || 'Error creating rule', variant: 'destructive' });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Government Fee Master</h1>
                <p className="text-muted-foreground">Manage government fee templates, components, and calculation rules.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* TEMPLATES */}
                <Card className="h-[600px] flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-medium">Templates</CardTitle>
                        <Button size="sm" onClick={handleCreateTemplate}><Plus className="w-4 h-4 mr-2"/> Add</Button>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {isLoading && !templates.length && <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" />}
                        <div className="space-y-2 mt-4">
                            {templates.map((t: any) => (
                                <div 
                                    key={t.id} 
                                    className={`p-3 rounded-md cursor-pointer border ${selectedTemplate?.id === t.id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                                    onClick={() => setSelectedTemplate(t)}
                                >
                                    <div className="font-semibold">{t.name}</div>
                                    <div className="text-xs text-muted-foreground">Code: {t.code}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* COMPONENTS */}
                <Card className="h-[600px] flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-medium">Components</CardTitle>
                        {selectedTemplate && <Button size="sm" onClick={handleCreateComponent}><Plus className="w-4 h-4 mr-2"/> Add</Button>}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {!selectedTemplate && <div className="text-muted-foreground text-center mt-10">Select a template</div>}
                        {selectedTemplate && (
                            <div className="space-y-2 mt-4">
                                {components.map((c: any) => (
                                    <div 
                                        key={c.id} 
                                        className={`p-3 rounded-md cursor-pointer border ${selectedComponent?.id === c.id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                                        onClick={() => setSelectedComponent(c)}
                                    >
                                        <div className="font-semibold">{c.fee_name}</div>
                                        <div className="text-xs text-muted-foreground">Method: {c.calculation_method}</div>
                                    </div>
                                ))}
                                {components.length === 0 && <div className="text-center text-sm text-muted-foreground">No components found</div>}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* RULES */}
                <Card className="h-[600px] flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-medium">Rules</CardTitle>
                        {selectedComponent && <Button size="sm" onClick={handleCreateRule}><Plus className="w-4 h-4 mr-2"/> Add</Button>}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {!selectedComponent && <div className="text-muted-foreground text-center mt-10">Select a component</div>}
                        {selectedComponent && (
                            <div className="space-y-2 mt-4">
                                {rules.map((r: any) => (
                                    <div key={r.id} className="p-3 rounded-md border text-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-semibold">Fee: ₹{r.fee_amount}</span>
                                            <span className="text-xs bg-muted px-2 py-1 rounded">Priority: {r.priority}</span>
                                        </div>
                                        {r.min_authorized_capital && <div className="text-xs text-muted-foreground">Min Auth Capital: {r.min_authorized_capital}</div>}
                                        {r.max_authorized_capital && <div className="text-xs text-muted-foreground">Max Auth Capital: {r.max_authorized_capital}</div>}
                                        {/* Simplified view for rules */}
                                    </div>
                                ))}
                                {rules.length === 0 && <div className="text-center text-sm text-muted-foreground">No rules found</div>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

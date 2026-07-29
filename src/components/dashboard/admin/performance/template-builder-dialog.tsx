import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { VisualRuleBuilder } from './visual-rule-builder';
import { Badge } from '@/components/ui/badge';

interface TemplateBuilderDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    templateId?: string;
    onSaved: () => void;
}

export function TemplateBuilderDialog({ isOpen, onOpenChange, templateId, onSaved }: TemplateBuilderDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    const [formData, setFormData] = useState<any>({
        template_name: '',
        description: '',
        department_id: '',
        evaluation_period: 'MONTHLY',
        status: 'draft',
        applicability: { department_ids: [], team_ids: [], designation_ids: [], profile_ids: [], employee_ids: [] },
        criteria: [],
    });

    useEffect(() => {
        if (isOpen) {
            if (templateId) {
                fetchTemplate(templateId);
            } else {
                setFormData({
                    template_name: '',
                    description: '',
                    department_id: '',
                    evaluation_period: 'MONTHLY',
                    status: 'draft',
                    applicability: { department_ids: [], team_ids: [], designation_ids: [], profile_ids: [], employee_ids: [] },
                    criteria: [{
                        criterion_name: 'New Criterion',
                        weight_percentage: 100,
                        scoring_type: 'MANUAL',
                        source_module: 'MANUAL',
                        calculation_method: 'MANUAL_RATING',
                        rules: []
                    }],
                });
            }
        }
    }, [isOpen, templateId]);

    const fetchTemplate = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/performance/templates/${id}`);
            const data = await res.json();
            if (data.success) {
                setFormData({
                    ...data.data,
                    applicability: data.data.applicability || { department_ids: [], team_ids: [], designation_ids: [], profile_ids: [], employee_ids: [] },
                    criteria: data.data.performance_template_criteria || [],
                });
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({ title: 'Error loading template', description: error.message, variant: 'destructive' });
            onOpenChange(false);
        } finally {
            setIsLoading(false);
        }
    };

    const addCriterion = () => {
        setFormData((prev: any) => ({
            ...prev,
            criteria: [
                ...prev.criteria,
                {
                    criterion_name: 'New Criterion',
                    weight_percentage: 0,
                    scoring_type: 'MANUAL',
                    source_module: 'MANUAL',
                    calculation_method: 'MANUAL_RATING',
                    rules: []
                }
            ]
        }));
    };

    const updateCriterion = (index: number, field: string, value: any) => {
        const newCriteria = [...formData.criteria];
        newCriteria[index] = { ...newCriteria[index], [field]: value };

        if (field === 'scoring_type') {
            if (value === 'MANUAL') {
                newCriteria[index].calculation_method = 'MANUAL_RATING';
                newCriteria[index].source_module = 'MANUAL';
            } else if (value === 'AUTO') {
                if (newCriteria[index].calculation_method === 'MANUAL_RATING') {
                    newCriteria[index].calculation_method = 'PERCENTAGE_TO_10';
                }
            }
        }

        setFormData({ ...formData, criteria: newCriteria });
    };

    const removeCriterion = (index: number) => {
        const newCriteria = formData.criteria.filter((_: any, i: number) => i !== index);
        setFormData({ ...formData, criteria: newCriteria });
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const url = templateId 
                ? `/api/performance/templates/${templateId}` 
                : '/api/performance/templates';
            const method = templateId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (data.success) {
                toast({ title: 'Success', description: `Template ${templateId ? 'updated' : 'created'} successfully` });
                onSaved();
                onOpenChange(false);
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({ title: 'Error saving template', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const totalWeight = formData.criteria?.reduce((sum: number, c: any) => sum + (Number(c.weight_percentage) || 0), 0) || 0;
    const canActivate = totalWeight === 100 && formData.criteria.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1100px] max-h-[85vh] flex flex-col p-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle>{templateId ? 'Editing "Review Template"' : 'Adding New Review Template'}</DialogTitle>
                    <DialogDescription>
                        {templateId ? 'Update the details of this item.' : 'Enter the details for Review Template.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6 bg-white">
                    {/* Main Content Area */}
                    <div className="flex-1 space-y-8 min-w-0">
                        {/* Basic Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Template Name</Label>
                                <Input 
                                    value={formData.template_name} 
                                    onChange={(e) => setFormData({...formData, template_name: e.target.value})} 
                                    placeholder="e.g. Developer Annual Review"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Evaluation Period</Label>
                                <Select 
                                    value={formData.evaluation_period} 
                                    onValueChange={(val) => setFormData({...formData, evaluation_period: val})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                                        <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
                                        <SelectItem value="YEARLY">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Department (Applicable)</Label>
                                <Input 
                                    value={formData.department_id || ''} 
                                    onChange={(e) => setFormData({...formData, department_id: e.target.value})} 
                                    placeholder="Enter Dept ID (Optional)"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => setFormData({...formData, status: val})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="active" disabled={!canActivate}>Active</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-sm font-medium">Description</Label>
                                <Input 
                                    value={formData.description} 
                                    onChange={(e) => setFormData({...formData, description: e.target.value})} 
                                    placeholder="Brief description of this template"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Criteria Builder */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Criteria Builder</h3>
                                <Button size="sm" variant="outline" onClick={addCriterion} className="shadow-sm">
                                    <Plus className="mr-2 h-4 w-4" /> Add Criterion
                                </Button>
                            </div>

                            <Accordion type="single" collapsible className="w-full space-y-3">
                                {formData.criteria.map((criterion: any, index: number) => (
                                    <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg bg-slate-50/50 overflow-hidden shadow-sm">
                                        <AccordionTrigger className="hover:no-underline px-4 py-3">
                                            <div className="flex items-center gap-4 w-full text-left">
                                                <div className="flex-1 font-semibold text-base truncate pr-4">{criterion.criterion_name || 'Unnamed Criterion'}</div>
                                                <Badge variant="outline" className="shrink-0 bg-white">{criterion.weight_percentage}%</Badge>
                                                <Badge className={`shrink-0 ${
                                                    criterion.scoring_type === 'AUTO' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                                    criterion.scoring_type === 'HYBRID' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' :
                                                    'bg-orange-100 text-orange-700 hover:bg-orange-100'
                                                }`}>{criterion.scoring_type}</Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-5 border-t bg-white space-y-5">
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                                                <div className="md:col-span-6 space-y-2">
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Criterion Name</Label>
                                                    <Input 
                                                        value={criterion.criterion_name} 
                                                        onChange={(e) => updateCriterion(index, 'criterion_name', e.target.value)} 
                                                    />
                                                </div>
                                                <div className="md:col-span-3 space-y-2">
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Weight (%)</Label>
                                                    <Input 
                                                        type="number"
                                                        value={criterion.weight_percentage} 
                                                        onChange={(e) => updateCriterion(index, 'weight_percentage', Number(e.target.value))} 
                                                    />
                                                </div>
                                                <div className="md:col-span-3 space-y-2">
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating Scale</Label>
                                                    <div className="h-9 flex items-center px-3 border rounded-md bg-slate-50/50 text-sm font-medium text-muted-foreground">
                                                        0 to 10
                                                    </div>
                                                </div>
                                                <div className="md:col-span-4 space-y-2">
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scoring Type</Label>
                                                    <Select value={criterion.scoring_type} onValueChange={(val) => updateCriterion(index, 'scoring_type', val)}>
                                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="AUTO">Auto</SelectItem>
                                                            <SelectItem value="MANUAL">Manual</SelectItem>
                                                            <SelectItem value="HYBRID">Hybrid</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="md:col-span-4 space-y-2">
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source Module</Label>
                                                    <Select value={criterion.source_module} onValueChange={(val) => updateCriterion(index, 'source_module', val)}>
                                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="MANUAL">Manual</SelectItem>
                                                            <SelectItem value="ATTENDANCE">Attendance</SelectItem>
                                                            <SelectItem value="PUNCTUALITY">Punctuality</SelectItem>
                                                            <SelectItem value="WORK_REGISTER">Work Register</SelectItem>
                                                            <SelectItem value="TASKS">Tasks</SelectItem>
                                                            <SelectItem value="ACTIVITY_TRACKER">Activity Tracker</SelectItem>
                                                            <SelectItem value="CLIENT_FEEDBACK">Client Feedback</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="md:col-span-4 space-y-2">
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calculation Method</Label>
                                                    <Select value={criterion.calculation_method} onValueChange={(val) => updateCriterion(index, 'calculation_method', val)}>
                                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {(criterion.scoring_type === 'MANUAL' || criterion.scoring_type === 'HYBRID') && (
                                                                <SelectItem value="MANUAL_RATING">Manual Rating</SelectItem>
                                                            )}
                                                            {(criterion.scoring_type === 'AUTO' || criterion.scoring_type === 'HYBRID') && (
                                                                <>
                                                                    <SelectItem value="PERCENTAGE_TO_10">Percentage to 10</SelectItem>
                                                                    <SelectItem value="DEDUCTION_FROM_10">Deduction from 10</SelectItem>
                                                                    <SelectItem value="FIXED_SLAB_TO_10">Fixed Slab to 10</SelectItem>
                                                                    <SelectItem value="WORK_RATING">Work Rating Average</SelectItem>
                                                                </>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {(criterion.scoring_type === 'AUTO' || criterion.scoring_type === 'HYBRID') && (
                                                <div className="pt-2">
                                                    <VisualRuleBuilder 
                                                        rules={criterion.rules || []} 
                                                        onChange={(rules) => updateCriterion(index, 'rules', rules)}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex justify-end pt-4 border-t mt-4">
                                                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeCriterion(index)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Remove Criterion
                                                </Button>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    </div>

                    {/* Live Summary Sidebar */}
                    <div className="w-full md:w-[280px] shrink-0">
                        <div className="sticky top-0 border rounded-xl bg-slate-50/50 p-6 flex flex-col gap-6 shadow-sm">
                            <div>
                                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-5">Live Summary</h4>
                                <div className="space-y-5">
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">Total Criteria</div>
                                        <div className="text-2xl font-bold">{formData.criteria.length}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">Weight Total</div>
                                        <div className={`text-2xl font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-red-500'}`}>
                                            {totalWeight}%
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1.5 font-medium">
                                            Remaining: {Math.max(0, 100 - totalWeight)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">Rating Scale</div>
                                        <div className="text-sm font-semibold">0 to 10</div>
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-slate-200" />

                            <div>
                                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-3">Validation</h4>
                                {canActivate ? (
                                    <div className="flex items-center text-green-600 text-sm mt-2 font-medium bg-green-50 p-2.5 rounded-lg border border-green-100">
                                        <CheckCircle2 className="h-4 w-4 mr-2" /> Can Activate
                                    </div>
                                ) : (
                                    <div className="flex items-start text-red-600 text-sm mt-2 bg-red-50 p-2.5 rounded-lg border border-red-100">
                                        <AlertCircle className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                                        <span className="font-medium">Cannot activate. Ensure total weight is exactly 100%.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t bg-slate-50/50 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-white">Cancel</Button>
                    <Button onClick={handleSave} disabled={isLoading || (formData.status === 'active' && !canActivate)} className="min-w-[120px] shadow-sm">
                        {isLoading ? 'Saving...' : 'Save Template'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

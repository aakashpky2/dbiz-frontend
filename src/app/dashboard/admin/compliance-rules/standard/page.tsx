'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Save, Trash2, Clock, Calendar, CheckSquare, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { WorkType, Authority, RuleType, DueDateRule, DueDateRuleVersion, Constitution } from '@/lib/compliance/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Department, WorkCategory, WorkType as DeptWorkType } from '@/lib/department-management'; // Import types
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

// Helper types for local state
interface FetchedConstitution {
    id: string;
    businessType: string;
    businessSubType: string;
}

export default function StandardRulesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [rules, setRules] = useState<DueDateRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Fetch Lists
    const [departments, setDepartments] = useState<Department[]>([]);
    const [constitutions, setConstitutions] = useState<FetchedConstitution[]>([]);

    // Selection State
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');
    const [selectedConstitutionId, setSelectedConstitutionId] = useState<string>('');

    // Derived State for UI
    const [categories, setCategories] = useState<WorkCategory[]>([]);
    const [workTypes, setWorkTypes] = useState<DeptWorkType[]>([]);

    // Form State
    const [selectedAuthority, setSelectedAuthority] = useState<Authority | ''>('');
    const [offsetMonths, setOffsetMonths] = useState<number>(0);
    const [fixedDay, setFixedDay] = useState<number | ''>('');
    const [effectiveDate, setEffectiveDate] = useState<string>('');
    const [ruleDescription, setRuleDescription] = useState<string>('');
    const [selectedPrimaryType, setSelectedPrimaryType] = useState<string>('');


    // Fetch Data on Load
    const fetchRules = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('compliance_due_date_rules').select('*');
            if (error) throw error;
            if (data) {
                const rulesArray = data.map(row => ({
                    id: row.id,
                    workType: row.work_type,
                    authority: row.authority,
                    constitution: row.constitution,
                    department: row.department,
                    workCategory: row.work_category,
                    versions: row.versions || []
                }));
                setRules(rulesArray);
            }
        } catch (e) {
            console.error("Error fetching rules:", e);
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Operation failed",
                variant: "destructive"
            });
        
        }
        finally { setIsLoading(false); }
    }, []);

    const fetchScopeData = useCallback(async () => {
        const [depts, cats, wts, consts] = await Promise.all([
            supabase.from('departments').select('*'),
            supabase.from('work_categories').select('*'),
            supabase.from('work_types').select('*'),
            supabase.from('business_constitutions').select('*').order('display_order', { ascending: true }).order('sub_display_order', { ascending: true })
        ]);

        if (depts.data) {
            const formattedDepts = depts.data.map(d => {
                const deptCats = (cats.data || []).filter(c => c.department_id === d.id).map(c => ({
                    id: c.id,
                    name: c.name,
                    departmentId: c.department_id,
                    departmentName: d.name,
                    status: c.status || 'Active',
                    isDeleted: c.is_deleted || false,
                    description: c.description || '',
                    workTypes: (wts.data || []).filter(wt => wt.category_id === c.id).map(wt => ({
                        id: wt.id,
                        name: wt.name,
                        categoryId: wt.category_id,
                        departmentId: d.id,
                        departmentName: d.name,
                        categoryName: c.name,
                        status: wt.status || 'Active',
                        isDeleted: wt.is_deleted || false,
                        description: wt.description || ''
                    }))
                }));
                return { id: d.id, name: d.name, status: d.status || 'Active', isDeleted: d.is_deleted || false, description: d.description || '', workCategories: deptCats };
            });
            setDepartments(formattedDepts);
        }

        if (consts.data) {
            setConstitutions(consts.data.map(c => ({
                id: c.id,
                businessType: c.business_type,
                businessSubType: c.business_sub_type
            })));
        }
    }, []);

    useEffect(() => {
        fetchRules();
        fetchScopeData();
    }, [fetchRules, fetchScopeData]);

    // Cascade Logic
    useEffect(() => {
        if (selectedDepartmentId) {
            const dept = departments.find(d => d.id === selectedDepartmentId);
            setCategories(dept?.workCategories || []);
            setSelectedCategoryId(''); // Reset children
            setWorkTypes([]);
            setSelectedWorkTypeId('');
        }
    }, [selectedDepartmentId, departments]);

    useEffect(() => {
        if (selectedCategoryId) {
            const cat = categories.find(c => c.id === selectedCategoryId);
            setWorkTypes(cat?.workTypes || []);
            setSelectedWorkTypeId('');
        }
    }, [selectedCategoryId, categories]);

    const handleCreateRule = useCallback(async () => {
        if (!selectedWorkTypeId || !selectedConstitutionId || !effectiveDate) {
            toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }

        try {
            // Find names for storage
            const dept = departments.find(d => d.id === selectedDepartmentId);
            const cat = categories.find(c => c.id === selectedCategoryId);
            const wt = workTypes.find(w => w.id === selectedWorkTypeId);
            const cons = constitutions.find(c => c.id === selectedConstitutionId);

            if (!wt || !cons) throw new Error("Invalid Selection");

            const workTypeName = wt.name;
            const constitutionName = `${cons.businessType} - ${cons.businessSubType}`;

            // Unique Rule ID: WORKTYPE_CONSTITUTION (Sanitized)
            const ruleId = `RULE_${workTypeName.replace(/\s+/g, '_').toUpperCase()}_${cons.businessSubType.replace(/\s+/g, '_').toUpperCase()}`;

            const newVersion: DueDateRuleVersion = {
                versionId: `v_${Date.now()}`,
                effectiveFrom: effectiveDate,
                ruleType: RuleType.FY_END_BASED,
                offsetMonths: offsetMonths,
                offsetDays: 0,
                fixedDay: fixedDay ? Number(fixedDay) : undefined,
                description: ruleDescription || `Standard Filing for ${workTypeName}`,
            };

            const ruleData = {
                id: ruleId,
                work_type: workTypeName,
                authority: selectedAuthority as Authority,
                constitution: constitutionName,
                department: dept?.name,
                work_category: cat?.name,
                versions: [newVersion]
            };

            // Using upsert or insert
            const { error } = await supabase.from('compliance_due_date_rules').upsert(ruleData);
            if (error) throw error;

            toast({ title: "Success", description: "Standard Rule Created Successfully." });
            setIsDialogOpen(false);
            resetForm();
            fetchRules();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to create rule.", variant: "destructive" });
        }
    }, [selectedWorkTypeId, selectedConstitutionId, effectiveDate, departments, selectedDepartmentId, categories, selectedCategoryId, workTypes, constitutions, selectedAuthority, ruleDescription, offsetMonths, fixedDay, toast, fetchRules]);

    const resetForm = useCallback(() => {
        setSelectedDepartmentId('');
        setSelectedCategoryId('');
        setSelectedWorkTypeId('');
        setSelectedConstitutionId('');
        setSelectedAuthority('');
        setOffsetMonths(0);
        setFixedDay('');
        setEffectiveDate('');
        setRuleDescription('');
    }, []);

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-500">
            <DashboardPageHeader
                title="Standard Rules"
                description="Manage recurring due dates for different Work Types."
            >
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="font-bold">
                            <Plus className="mr-2 h-4 w-4" /> Add Rule
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px]">
                            <DialogHeader>
                                <DialogTitle>Adding New Compliance Rule</DialogTitle>
                                <DialogDescription>
                                    Enter the details for Compliance Rule.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-6 py-4">
                                {/* Cascading Selectors */}
                                <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <CheckSquare className="h-4 w-4" /> Scope Selection
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Department</Label>
                                            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                                <SelectContent>
                                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Work Category</Label>
                                            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} disabled={!selectedDepartmentId}>
                                                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Work Type</Label>
                                            <Select value={selectedWorkTypeId} onValueChange={setSelectedWorkTypeId} disabled={!selectedCategoryId}>
                                                <SelectTrigger><SelectValue placeholder="Select Work Type" /></SelectTrigger>
                                                <SelectContent>
                                                    {workTypes.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Primary Constitution</Label>
                                            <Select 
                                                value={selectedPrimaryType} 
                                                onValueChange={(val) => {
                                                    setSelectedPrimaryType(val);
                                                    setSelectedConstitutionId('');
                                                }}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                                                <SelectContent>
                                                    {Array.from(new Set(constitutions.map(c => c.businessType))).map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Subcategory</Label>
                                            <Select 
                                                value={selectedConstitutionId} 
                                                onValueChange={setSelectedConstitutionId}
                                                disabled={!selectedPrimaryType}
                                            >
                                                <SelectTrigger><SelectValue placeholder={selectedPrimaryType ? "Select Subtype" : "Choose Primary First"} /></SelectTrigger>
                                                <SelectContent>
                                                    {constitutions
                                                        .filter(c => c.businessType === selectedPrimaryType)
                                                        .map(c => <SelectItem key={c.id} value={c.id}>{c.businessSubType}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Basic Details */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Authority</Label>
                                        <Select value={selectedAuthority} onValueChange={(v) => setSelectedAuthority(v as Authority)}>
                                            <SelectTrigger><SelectValue placeholder="Select Authority" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.values(Authority).map(a => (
                                                    <SelectItem key={a} value={a}>{a}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Input placeholder="e.g. Standard ITR Filing" value={ruleDescription} onChange={e => setRuleDescription(e.target.value)} />
                                    </div>
                                </div>

                                {/* Logic Configuration */}
                                <div className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900 space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        <span className="font-semibold text-sm">Logic Configuration</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Months after Period End</Label>
                                            <Input type="number" min="0" value={offsetMonths} onChange={e => setOffsetMonths(Number(e.target.value))} />
                                            <p className="text-[10px] text-muted-foreground">Add X months to FY/Period End</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Fixed Day of Month</Label>
                                            <Input type="number" min="1" max="31" placeholder="e.g. 31" value={fixedDay} onChange={e => setFixedDay(e.target.value ? Number(e.target.value) : '')} />
                                            <p className="text-[10px] text-muted-foreground">e.g. 31st of the resulting month</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Effective From Date</Label>
                                        <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
                                        <p className="text-[10px] text-muted-foreground text-amber-600">
                                            New versions will be created for dates after this.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateRule}>Save Rule</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </DashboardPageHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <p className="text-muted-foreground col-span-full">Loading rules...</p>
                ) : rules.length === 0 ? (
                    <Card className="col-span-full border-dashed bg-slate-50 dark:bg-slate-900/50">
                        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                            <Clock className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No Rules Defined</h3>
                            <p className="text-muted-foreground max-w-sm mt-2">
                                Start by adding a Standard Rule.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    rules.map(rule => (
                        <Card key={rule.id} className="group hover:border-primary/50 transition-all">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex justify-between items-start text-base">
                                    <span className="truncate max-w-[180px]" title={rule.workType}>{rule.workType}</span>
                                    <span className="text-[10px] font-normal px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                                        {rule.authority}
                                    </span>
                                </CardTitle>
                                <CardDescription className="line-clamp-2 text-xs mt-1">
                                    <Building className="h-3 w-3 inline mr-1" />
                                    {rule.constitution}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Logic:</span>
                                        <span className="font-medium">
                                            +{rule.versions[0]?.offsetMonths}m
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Day:</span>
                                        <span className="font-medium">
                                            {rule.versions[0]?.fixedDay ? `${rule.versions[0].fixedDay}th` : 'N/A'}
                                        </span>
                                    </div>
                                    {rule.department && <div className="text-[10px] text-muted-foreground pt-1">Dept: {rule.department}</div>}
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 text-xs text-muted-foreground border-t bg-slate-50/50 dark:bg-slate-900/50 p-4">
                                Effective: {rule.versions[0]?.effectiveFrom}
                            </CardFooter>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Department, WorkCategory, WorkType, addDepartment, updateDepartment, deleteDepartment, addWorkCategory, updateWorkCategory, deleteWorkCategory, addWorkType, updateWorkType, deleteWorkType, validateApprove, validateEditAndApprove, validateReject, permanentlyDeleteEntity, fetchDeptsGlobal } from '@/lib/department-management';
import { Edit, Trash2, Building2, AlertCircle, Plus, Folder, CheckCircle2, XCircle, History, Search, Briefcase, ShieldCheck, ListFilter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DepartmentListProps {
    departments: Department[];
    canEdit: boolean;
    canDelete: boolean;
    canCreate: boolean;
    onAddClick: () => void;
    filterMode?: 'active' | 'incomplete' | 'validation' | 'deleted';
}

export function DepartmentList({ departments, canEdit, canDelete, canCreate, onAddClick, filterMode = 'active' }: DepartmentListProps) {
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [deletingDept, setDeletingDept] = useState<Department | null>(null);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState(''); // Tracking description for edits now
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [addingCategoryTo, setAddingCategoryTo] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDesc, setNewCategoryDesc] = useState('');
    const [editingCategory, setEditingCategory] = useState<{ deptId: string, cat: WorkCategory } | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<{ deptId: string, cat: WorkCategory } | null>(null);
    const [categoryDeleteConfirm, setCategoryDeleteConfirm] = useState('');

    const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
    const [constitutions, setConstitutions] = useState<{ id: string, name: string }[]>([]);

    const [addingWorkTypeTo, setAddingWorkTypeTo] = useState<{ deptId: string, catId: string } | null>(null);
    const [newWorkTypeName, setNewWorkTypeName] = useState('');
    const [newWorkTypeDesc, setNewWorkTypeDesc] = useState('');
    const [newWorkTypeWarningNote, setNewWorkTypeWarningNote] = useState('');
    const [newWorkTypeRule, setNewWorkTypeRule] = useState<{ mode: 'ALL' | 'SELECT' | 'EXCEPT', ids: string[] }>({ mode: 'ALL', ids: [] });
    const [searchCategoryText, setSearchCategoryText] = useState('');

    const [editingWorkType, setEditingWorkType] = useState<{ deptId: string, catId: string, wt: WorkType } | null>(null);






    const [deletingWorkType, setDeletingWorkType] = useState<{ deptId: string, catId: string, wt: WorkType } | null>(null);
    const [workTypeDeleteConfirm, setWorkTypeDeleteConfirm] = useState('');

    const { toast } = useToast();
    const { user } = useAuth();

    const [rawConstitutions, setRawConstitutions] = useState<any[]>([]);
    const [primaryTypes, setPrimaryTypes] = useState<string[]>([]);
    const [selectedPrimaryType, setSelectedPrimaryType] = useState<string | null>(null);

    useEffect(() => {
        const fetchConstitutions = async () => {
            const { data, error } = await supabase
                .from('business_constitutions')
                .select('*')
                .order('display_order', { ascending: true })
                .order('sub_display_order', { ascending: true });

            if (data && !error) {
                setRawConstitutions(data);
                
                // Extract unique primary types while maintaining the display_order
                const types: string[] = [];
                data.forEach(c => {
                    if (c.business_type && !types.includes(c.business_type)) {
                        types.push(c.business_type);
                    }
                });
                setPrimaryTypes(types);
                
                const list = data.map(c => ({ id: c.id, name: `${c.business_type} - ${c.business_sub_type}` }));
                setConstitutions(list);
            } else {
                setRawConstitutions([]);
                setPrimaryTypes([]);
                setConstitutions([]);
            }
        };
        fetchConstitutions();
    }, []);

    const activeDepartments = React.useMemo(() => {
        return departments.map(d => {
            const fCats = (d.workCategories || []).map(c => {
                const fWts = (c.workTypes || []).filter(wt => {
                    if (filterMode === 'active') return !wt.isDeleted;
                    if (filterMode === 'incomplete') return wt.isIncomplete && !wt.isDeleted;
                    if (filterMode === 'validation') return !wt.isValidated;
                    if (filterMode === 'deleted') return wt.isDeleted && wt.isValidated;
                    return true;
                });
                return { ...c, workTypes: fWts };
            }).filter(c => {
                if (filterMode === 'active') return !c.isDeleted || c.workTypes.length > 0;
                if (filterMode === 'incomplete') return (c.isIncomplete && !c.isDeleted) || c.workTypes.length > 0;
                if (filterMode === 'validation') return !c.isValidated || c.workTypes.length > 0;
                if (filterMode === 'deleted') return (c.isDeleted && c.isValidated) || c.workTypes.length > 0;
                return true;
            });

            const keepDept = () => {
                if (filterMode === 'active') return !d.isDeleted || fCats.length > 0;
                if (filterMode === 'incomplete') return (d.isIncomplete && !d.isDeleted) || fCats.length > 0;
                if (filterMode === 'validation') return !d.isValidated || fCats.length > 0;
                if (filterMode === 'deleted') return (d.isDeleted && d.isValidated) || fCats.length > 0;
                return true;
            };

            if (keepDept()) return { ...d, workCategories: fCats };
            return null;
        }).filter(Boolean) as Department[];
    }, [departments, filterMode]);

    useEffect(() => {
        if (activeDepartments.length > 0 && !selectedDeptId) {
            setSelectedDeptId(activeDepartments[0].id);
        } else if (activeDepartments.length > 0 && selectedDeptId && !activeDepartments.find(d => d.id === selectedDeptId)) {
            setSelectedDeptId(activeDepartments[0].id);
        }
    }, [activeDepartments, selectedDeptId]);

    // UI Helper for status display
    const renderBanner = (item: any) => {
        if (item.isDeleted) return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">Deleted</Badge>;
        if (!item.isValidated) return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Validation Pending</Badge>;
        if (item.isIncomplete) return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Incomplete</Badge>;
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
    };

    // Validation Action Builders
    const handleApprove = async (type: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE', id: string) => {
        if (!user) return;
        try {
            await validateApprove(type, id, user.uid, user.displayName || 'Unknown');
            toast({ title: "Approved" });
        } catch (e: any) { toast({ title: "Error", description: e.message, variant: 'destructive' }); }
    };

    const handleReject = async (type: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE', id: string) => {
        if (!user) return;
        try {
            await validateReject(type, id, user.uid, user.displayName || 'Unknown', 'Rejected from UI');
            toast({ title: "Rejected" });
        } catch (e: any) { toast({ title: "Error", description: e.message, variant: 'destructive' }); }
    };

    const handlePermanentDelete = async (type: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE', id: string) => {
        if (!user) return;
        try {
            await permanentlyDeleteEntity(type, id, user.uid, user.displayName || 'Unknown');
            toast({ title: "Permanently Deleted" });
        } catch (e: any) { toast({ title: "Error", description: e.message, variant: 'destructive' }); }
    };

    // Standard Saves
    const submitEdit = async () => {
        if (!editingDept || !user) return;
        try {
            if (filterMode === 'validation') {
                await validateEditAndApprove('DEPARTMENT', editingDept.id, { name: newName, description: newDesc }, user.uid, user.displayName || 'Unknown');
                toast({ title: "Edited & Approved" });
            } else {
                await updateDepartment(editingDept.id, newName, newDesc, user.uid, user.displayName || 'Unknown');
                toast({ title: "Edit Saved", description: "Pending validation." });
            }
            setEditingDept(null);
        } catch (error: any) { toast({ title: "Error", description: error.message, variant: 'destructive' }); }
    };

    const submitDelete = async () => {
        if (!deletingDept || !user || deleteConfirm !== 'DELETE') return;
        try {
            await deleteDepartment(deletingDept.id, user.uid, user.displayName || 'Unknown');
            toast({ title: "Deleted", description: "Deletion pending validation." });
            setDeletingDept(null); setDeleteConfirm('');
        } catch (error: any) { toast({ title: "Error", description: error.message, variant: 'destructive' }); }
    };

    const submitAddCategory = async () => {
        if (!addingCategoryTo || !user || !newCategoryName.trim()) return;
        try {
            await addWorkCategory(addingCategoryTo, newCategoryName, newCategoryDesc, user.uid, user.displayName || 'Unknown');
            toast({ title: "Category Created" });
            setAddingCategoryTo(null); setNewCategoryName(''); setNewCategoryDesc('');
        } catch (error: any) { toast({ title: "Error", description: error.message, variant: 'destructive' }); }
    };

    const submitEditCategory = async () => {
        if (!editingCategory || !user) return;
        try {
            if (filterMode === 'validation') {
                await validateEditAndApprove('CATEGORY', editingCategory.cat.id, { name: newName, description: newDesc }, user.uid, user.displayName || 'Unknown');
                toast({ title: "Edited & Approved" });
            } else {
                await updateWorkCategory(editingCategory.deptId, editingCategory.cat.id, newName, newDesc, user.uid, user.displayName || 'Unknown');
                toast({ title: "Edit Saved" });
            }
            setEditingCategory(null); setNewName(''); setNewDesc('');
        } catch (error: any) { toast({ title: "Error", description: error.message, variant: 'destructive' }); }
    };

    const submitDeleteCategory = async () => {
        if (!deletingCategory || !user || categoryDeleteConfirm !== 'DELETE') return;
        try {
            await deleteWorkCategory(deletingCategory.deptId, deletingCategory.cat.id, user.uid, user.displayName || 'Unknown');
            toast({ title: "Deleted" });
            setDeletingCategory(null); setCategoryDeleteConfirm('');
        } catch (error: any) { toast({ title: "Error", description: error.message, variant: 'destructive' }); }
    };

    const getPreparedRule = (): { mode: 'ALL' | 'SELECT' | 'EXCEPT', ids: string[] } => {
        // If mode is ALL but a specific primary type is selected, we must expand to SELECTED + all IDs of that type
        if (selectedPrimaryType && newWorkTypeRule.mode === 'ALL') {
            const allIdsOfType = rawConstitutions
                .filter(c => c.business_type === selectedPrimaryType)
                .map(c => c.id);
            return { mode: 'SELECT', ids: allIdsOfType };
        }
        return newWorkTypeRule;
    };

    const submitAddWorkType = async () => {
        if (!addingWorkTypeTo || !user || !newWorkTypeName.trim()) return;
        const finalRule = getPreparedRule();
        try {
            await addWorkType(addingWorkTypeTo.deptId, addingWorkTypeTo.catId, { name: newWorkTypeName, description: newWorkTypeDesc, warningNote: newWorkTypeWarningNote, constitutionRule: finalRule }, user.uid, user.displayName || 'Unknown');
            toast({ title: "Work Type Created" });
            setAddingWorkTypeTo(null); setNewWorkTypeName(''); setNewWorkTypeDesc(''); setNewWorkTypeWarningNote(''); setNewWorkTypeRule({ mode: 'ALL', ids: [] }); setSelectedPrimaryType(null);
        } catch (error: any) { toast({ title: "Error", description: error.message, variant: 'destructive' }); }
    };

    const submitEditWorkType = async () => {
        if (isSubmitting) return;
        console.log("submitEditWorkType clicked!", { editingWorkType, user });
        if (!editingWorkType) {
            toast({ title: "Error", description: "No editingWorkType selected" });
            return;
        }
        if (!user) {
            toast({ title: "Error", description: "User is not logged in or loading" });
            return;
        }
        console.log("Validation passed, proceeding...");
        const finalRule = getPreparedRule();
        setIsSubmitting(true);
        try {
            const updatePayload = { 
                name: newName, 
                description: newWorkTypeDesc, 
                warningNote: newWorkTypeWarningNote,
                constitutionRule: finalRule,
                deptId: editingWorkType.deptId,
                catId: editingWorkType.catId
            };

            if (filterMode === 'validation') {
                console.log("Calling validateEditAndApprove");
                await validateEditAndApprove('WORKTYPE', editingWorkType.wt.id, updatePayload, user.uid, user.displayName || 'Unknown');
                console.log("validateEditAndApprove returned");
                toast({ title: "Edited & Approved" });
            } else {
                console.log("Calling updateWorkType");
                await updateWorkType(editingWorkType.deptId, editingWorkType.catId, editingWorkType.wt.id, updatePayload, user.uid, user.displayName || 'Unknown');
                console.log("updateWorkType returned");
                toast({ title: "Edit Saved" });
            }
            console.log("Refreshing data before closing modal...");
            await fetchDeptsGlobal();
            console.log("Closing modal (setEditingWorkType(null))");
            setEditingWorkType(null); setNewName(''); setNewWorkTypeDesc(''); setNewWorkTypeWarningNote('');
        } catch (error: any) { 
            console.error("submitEditWorkType error:", error);
            toast({ title: "Error", description: error?.message || "Unknown error occurred", variant: 'destructive' }); 
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitDeleteWorkType = async () => {
        if (!deletingWorkType || !user || workTypeDeleteConfirm !== 'DELETE') return;
        try {
            await deleteWorkType(deletingWorkType.deptId, deletingWorkType.catId, deletingWorkType.wt.id, user.uid, user.displayName || 'Unknown');
            toast({ title: "Deleted" });
            setDeletingWorkType(null); setWorkTypeDeleteConfirm('');
        } catch (error: any) { toast({ title: "Error", description: error.message, variant: 'destructive' }); }
    };

    const selectedDept = activeDepartments.find(d => d.id === selectedDeptId);

    // Determines if action buttons should be shown.
    const canUseAction = (item: any) => {
        if (filterMode === 'validation') return true;
        if (filterMode === 'incomplete') return true;
        if (!item.isValidated) return false;
        return true;
    };

    return (
        <div>
            <div className="flex h-[calc(100vh-140px)] gap-6 bg-background rounded-lg border p-1 border-muted overflow-hidden">
                {/* Sidebar: Department List */}
                <div className="w-80 flex flex-col gap-4 border-r pr-4 pt-2 shrink-0">
                    <div className="px-2 space-y-4">
                        <h2 className="text-xl font-bold tracking-tight">Departments</h2>
                        {canCreate && filterMode === 'active' && (
                            <Button className="w-full justify-start gap-2 h-10 font-bold shadow-sm" onClick={onAddClick}>
                                <Plus className="h-4 w-4" /> Add New Department
                            </Button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 px-2 pb-4 pt-1 custom-scrollbar">
                        {activeDepartments.map(dept => {
                            const isSelected = selectedDeptId === dept.id;
                            return (
                                    <div 
                                        key={dept.id} 
                                        onClick={() => {
                                            setSelectedDeptId(dept.id);
                                            if (filterMode === 'validation' && !dept.isValidated) {
                                                setEditingDept(dept); 
                                                setNewName(dept.name); 
                                                setNewDesc(dept.description || '');
                                            }
                                        }} 
                                        className={`group flex flex-col gap-1 p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-primary/5 border-primary/20 shadow-sm' : 'hover:bg-muted/50 border-transparent'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`font-medium text-sm truncate ${isSelected ? 'text-primary font-bold' : 'text-foreground'}`}>{dept.name}</span>
                                            {isSelected && canEdit && !dept.isDeleted && canUseAction(dept) && (filterMode === 'active' || filterMode === 'incomplete') && (
                                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingDept(dept); setNewName(dept.name); setNewDesc(dept.description || ''); }}><Edit className="h-3 w-3" /></Button>
                                                    {canDelete && <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingDept(dept); }} disabled={dept.workCategories?.some(c => !c.isDeleted)} title={dept.workCategories?.some(c => !c.isDeleted) ? "Cannot delete department with active categories" : "Delete Department"}><Trash2 className="h-3 w-3" /></Button>}
                                                </div>
                                            )}
                                            {filterMode === 'deleted' && isSelected && dept.isDeleted && (
                                                <Button variant="ghost" size="sm" className="h-6 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold px-2" onClick={(e) => { e.stopPropagation(); handlePermanentDelete('DEPARTMENT', dept.id); }}>Delete Permanently</Button>
                                            )}
                                            {filterMode === 'validation' && !dept.isValidated && (
                                                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-wider border-orange-200 text-orange-700 hover:bg-orange-50" onClick={(e) => { e.stopPropagation(); setEditingDept(dept); setNewName(dept.name); setNewDesc(dept.description || ''); }}>Validate</Button>
                                            )}
                                        </div>
                                        <div className="mt-1">{renderBanner(dept)}</div>
                                    </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content: Work Categories */}
                <div className="flex-1 overflow-y-auto pt-2 pl-2 pr-4 pb-12 custom-scrollbar">
                    {selectedDept ? (
                        <div className="space-y-6 max-w-5xl mx-auto">
                            <div className="flex flex-col border-b pb-4 pt-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-3xl font-bold tracking-tight mb-2">{selectedDept.name}</h2>
                                        {selectedDept.description && <p className="text-muted-foreground max-w-3xl leading-relaxed text-sm mb-3">{selectedDept.description}</p>}
                                        <div className="mb-4">{renderBanner(selectedDept)}</div>
                                    </div>
                                    {canEdit && !selectedDept.isDeleted && (filterMode === 'active' || filterMode === 'incomplete') && canUseAction(selectedDept) && (
                                        <div className="flex items-center gap-2">
                                            <Button onClick={() => setAddingCategoryTo(selectedDept.id)} className="font-bold shadow-sm" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
                                            <Button onClick={() => setAddingWorkTypeTo({ deptId: selectedDept.id, catId: '' })} variant="outline" className="font-bold shadow-sm" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Work Type</Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mb-4 relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search categories..."
                                    className="pl-9 h-10 bg-background shadow-sm"
                                    value={searchCategoryText}
                                    onChange={e => setSearchCategoryText(e.target.value)}
                                />
                            </div>

                            <div className="space-y-6">
                                {selectedDept.workCategories?.filter(cat => {
                                    if (!searchCategoryText) return true;
                                    const query = searchCategoryText.toLowerCase();
                                    return cat.name.toLowerCase().includes(query) || selectedDept.name.toLowerCase().includes(query) || cat.description?.toLowerCase().includes(query);
                                }).map(cat => {
                                    return (
                                        <Card 
                                            key={cat.id} 
                                            onClick={() => {
                                                if (filterMode === 'validation' && !cat.isValidated) {
                                                    setEditingCategory({ deptId: selectedDept.id, cat }); 
                                                    setNewName(cat.name); 
                                                    setNewDesc(cat.description || '');
                                                }
                                            }}
                                            className={`overflow-hidden border-muted shadow-sm transition-all ${filterMode === 'validation' && !cat.isValidated ? 'border-orange-200 cursor-pointer hover:border-orange-300' : ''}`}
                                        >
                                            <div className={`border-b p-4 flex items-center justify-between ${filterMode === 'validation' && !cat.isValidated ? 'bg-orange-50/30' : 'bg-muted/10 border-border/50'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="font-semibold text-lg flex items-center gap-3">
                                                        {cat.name}
                                                        {renderBanner(cat)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {canEdit && !cat.isDeleted && (filterMode === 'active' || filterMode === 'incomplete') && canUseAction(cat) && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => { setEditingCategory({ deptId: selectedDept.id, cat }); setNewName(cat.name); setNewDesc(cat.description || ''); }}><Edit className="h-4 w-4" /></Button>
                                                            {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeletingCategory({ deptId: selectedDept.id, cat })} disabled={cat.workTypes?.some(wt => !wt.isDeleted)} title={cat.workTypes?.some(wt => !wt.isDeleted) ? "Cannot delete category with active work types" : "Delete Category"}><Trash2 className="h-4 w-4" /></Button>}
                                                        </>
                                                    )}
                                                    {filterMode === 'deleted' && cat.isDeleted && (
                                                        <Button variant="default" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none font-semibold" onClick={() => handlePermanentDelete('CATEGORY', cat.id)}>Delete Permanently</Button>
                                                    )}
                                                    {filterMode === 'validation' && !cat.isValidated && (
                                                        <Button variant="outline" size="sm" className="h-7 text-xs font-bold border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => { setEditingCategory({ deptId: selectedDept.id, cat }); setNewName(cat.name); setNewDesc(cat.description || ''); }}>Validate</Button>
                                                    )}
                                                </div>
                                            </div>

                                            <CardContent className="p-0">
                                                <div className="p-4 bg-white/50 dark:bg-black/20">
                                                    {cat.workTypes?.length === 0 ? (
                                                        <div className="text-sm text-muted-foreground/60 italic py-4 text-center border border-dashed rounded-md bg-muted/5">No work types matched filter</div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {cat.workTypes?.map(wt => (
                                                                        <div 
                                                                            key={wt.id} 
                                                                            onClick={() => {
                                                                                if (filterMode === 'validation' && !wt.isValidated) {
                                                                                    setEditingWorkType({ deptId: selectedDept.id, catId: cat.id, wt }); 
                                                                                    setNewName(wt.name); 
                                                                                    setNewWorkTypeDesc(wt.description || ''); 
                                                                                    setNewWorkTypeWarningNote(wt.warningNote || ''); 
                                                                                    const rule = wt.constitutionRule || { mode: 'ALL', ids: [] };
                                                                                    setNewWorkTypeRule(rule);
                                                                                    
                                                                                    // Infer primary type if possible
                                                                                    if (rule.ids.length > 0) {
                                                                                        const firstId = rule.ids[0];
                                                                                        const matched = rawConstitutions.find(rc => rc.id === firstId);
                                                                                        if (matched) setSelectedPrimaryType(matched.business_type);
                                                                                    } else if (rule.mode === 'ALL') {
                                                                                        setSelectedPrimaryType(''); // Global ALL
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className={`group flex flex-col p-4 rounded-xl bg-background border transition-all shadow-sm ${filterMode === 'validation' && !wt.isValidated ? 'border-orange-100 cursor-pointer hover:border-orange-300 hover:shadow-md' : 'border-border/40 hover:border-primary/20'}`}
                                                                        >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="font-semibold text-base">{wt.name}</div>
                                                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                                            {filterMode === 'validation' && !wt.isValidated && (
                                                                                <Button variant="outline" size="sm" className="h-6 text-[10px] font-bold border-orange-200 text-orange-700 hover:bg-orange-50 px-2" onClick={() => { setEditingWorkType({ deptId: selectedDept.id, catId: cat.id, wt }); setNewName(wt.name); setNewWorkTypeDesc(wt.description || ''); setNewWorkTypeWarningNote(wt.warningNote || ''); setNewWorkTypeRule(wt.constitutionRule || { mode: 'ALL', ids: [] }); }}>Validate</Button>
                                                                            )}
                                                                            {filterMode === 'deleted' && wt.isDeleted && (
                                                                                <Button variant="ghost" size="sm" className="h-6 text-red-600 hover:bg-red-50 hover:text-red-700 px-2" onClick={() => handlePermanentDelete('WORKTYPE', wt.id)}>Perm. Delete</Button>
                                                                            )}
                                                                            {(filterMode === 'active' || filterMode === 'incomplete') && canEdit && !wt.isDeleted && canUseAction(wt) && (
                                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { 
                                                                                    setEditingWorkType({ deptId: selectedDept.id, catId: cat.id, wt }); 
                                                                                    setNewName(wt.name); 
                                                                                    setNewWorkTypeDesc(wt.description || ''); 
                                                                                    setNewWorkTypeWarningNote(wt.warningNote || ''); 
                                                                                    setNewWorkTypeRule(wt.constitutionRule || { mode: 'ALL', ids: [] }); 
                                                                                }}>
                                                                                    <Edit className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                                                                                </Button>
                                                                            )}
                                                                            {canDelete && !wt.isDeleted && filterMode === 'active' && canUseAction(wt) && (
                                                                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => setDeletingWorkType({ deptId: selectedDept.id, catId: cat.id, wt })}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                                                            )}
                                                                            {/* Removed individual history button */}
                                                                        </div>
                                                                    </div>
                                                                    {wt.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{wt.description}</p>}
                                                                    <div className="mt-auto flex flex-wrap gap-2">
                                                                        {renderBanner(wt)}
                                                                        {wt.constitutionRule?.mode !== 'ALL' && (
                                                                            <Badge variant="secondary" className="text-[10px] h-5 bg-blue-50 text-blue-700">{wt.constitutionRule?.mode === 'SELECT' ? 'Specific Const.' : 'Except Const.'}</Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {canEdit && !cat.isDeleted && (filterMode === 'active' || filterMode === 'incomplete') && canUseAction(cat) && (
                                                        <Button variant="outline" size="sm" className="mt-4 w-full border-dashed" onClick={() => setAddingWorkTypeTo({ deptId: selectedDept.id, catId: cat.id })}><Plus className="mr-1 h-3 w-3" /> Add Work Type</Button>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full items-center justify-center text-muted-foreground"><Folder className="h-12 w-12 opacity-20 mb-4" /><p>Select an item to manage structure</p></div>
                    )}
                </div>
            </div>

            {/* Department Edit Dialog */}
            <Dialog open={!!editingDept} onOpenChange={(open) => !open && setEditingDept(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editing "{editingDept?.name || 'Department'}"</DialogTitle>
                        <DialogDescription>Update the details of this item.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Description</Label><Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        {filterMode === 'validation' ? (
                            <>
                                <Button variant="outline" onClick={() => { if (editingDept) handleReject('DEPARTMENT', editingDept.id); setEditingDept(null); }} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">Reject</Button>
                                <Button onClick={submitEdit} className="bg-green-600 hover:bg-green-700 text-white">Approve & Save</Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setEditingDept(null)}>Cancel</Button>
                                <Button onClick={submitEdit}>Submit Request</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deletingDept} onOpenChange={(o) => { if (!o) { setDeletingDept(null); setDeleteConfirm(''); } }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Department?</DialogTitle><DialogDescription>Type DELETE to confirm.</DialogDescription></DialogHeader>
                    <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
                    <DialogFooter><Button onClick={submitDelete} variant="destructive" disabled={deleteConfirm !== 'DELETE'}>Delete</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Category Add/Edit/Delete */}
            <Dialog open={!!addingCategoryTo} onOpenChange={(o) => (!o && setAddingCategoryTo(null))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adding New Work Category</DialogTitle>
                        <DialogDescription>Enter the details for Work Category.</DialogDescription>
                    </DialogHeader>
                    {(() => {
                        const targetDept = activeDepartments.find(d => d.id === addingCategoryTo);
                        return (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Department</Label>
                                    <Input value={targetDept?.name || ''} disabled className="bg-muted cursor-not-allowed font-medium" />
                                </div>
                                <div className="space-y-2"><Label className="text-sm font-semibold">Category Name</Label><Input value={newCategoryName} placeholder="e.g. Compliance" onChange={(e) => setNewCategoryName(e.target.value)} /></div>
                                <div className="space-y-2"><Label className="text-sm font-semibold">Description</Label><Textarea placeholder="Describe the category..." value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} /></div>
                            </div>
                        );
                    })()}
                    <DialogFooter><Button onClick={submitAddCategory} disabled={!newCategoryName.trim()}>Create Category</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editing "{editingCategory?.cat?.name || 'Work Category'}"</DialogTitle>
                        <DialogDescription>Update the details of this item.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Description</Label><Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        {filterMode === 'validation' ? (
                            <>
                                <Button variant="outline" onClick={() => { if (editingCategory) handleReject('CATEGORY', editingCategory.cat.id); setEditingCategory(null); }} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">Reject</Button>
                                <Button onClick={submitEditCategory} className="bg-green-600 hover:bg-green-700 text-white">Approve & Save</Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
                                <Button onClick={submitEditCategory}>Submit Request</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deletingCategory} onOpenChange={(o) => { if (!o) { setDeletingCategory(null); setCategoryDeleteConfirm(''); } }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Category?</DialogTitle><DialogDescription>Type DELETE to confirm.</DialogDescription></DialogHeader>
                    <Input value={categoryDeleteConfirm} onChange={(e) => setCategoryDeleteConfirm(e.target.value)} placeholder="DELETE" />
                    <DialogFooter><Button onClick={submitDeleteCategory} variant="destructive" disabled={categoryDeleteConfirm !== 'DELETE'}>Delete</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Work Type Add/Edit/Delete */}
            <Dialog open={!!addingWorkTypeTo} onOpenChange={(o) => (!o && setAddingWorkTypeTo(null))}>
                <DialogContent className="max-h-[90vh] overflow-y-auto max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Adding New Work Type</DialogTitle>
                        <DialogDescription>Enter the details for Work Type.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Department</Label>
                                <Select
                                    value={addingWorkTypeTo?.deptId || undefined}
                                    onValueChange={(val) => setAddingWorkTypeTo({ deptId: val, catId: '' })}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {activeDepartments.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Category</Label>
                                {(() => {
                                    const dept = activeDepartments.find(d => d.id === addingWorkTypeTo?.deptId);
                                    const cats = dept?.workCategories?.filter(c => !c.isDeleted) || [];
                                    if (addingWorkTypeTo?.deptId && cats.length === 0) {
                                        return (
                                            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 p-2 rounded-md">
                                                No categories configured for this department. Please add a category first.
                                            </div>
                                        );
                                    }
                                    return (
                                        <Select
                                            value={addingWorkTypeTo?.catId || undefined}
                                            onValueChange={(val) => setAddingWorkTypeTo({ deptId: addingWorkTypeTo!.deptId, catId: val })}
                                            disabled={!addingWorkTypeTo?.deptId}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={addingWorkTypeTo?.deptId ? "Select Category" : "Select Department First"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cats.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="space-y-4 border-t pt-4">
                            <div className="space-y-2"><Label className="text-sm font-semibold">Work Type Name</Label><Input value={newWorkTypeName} placeholder="e.g. GST Registration" onChange={e => setNewWorkTypeName(e.target.value)} /></div>
                            <div className="space-y-2"><Label className="text-sm font-semibold">Description</Label><Textarea value={newWorkTypeDesc} placeholder="Optional details..." onChange={e => setNewWorkTypeDesc(e.target.value)} /></div>
                            <div className="space-y-2"><Label className="text-sm font-semibold">Warning / Flow Note</Label><Input value={newWorkTypeWarningNote} placeholder="Example: After completing GSTR-1, proceed with GSTR-3B." onChange={e => setNewWorkTypeWarningNote(e.target.value)} /></div>
                            <div className="space-y-4">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    Choose Primary Constitution
                                </Label>
                                <RadioGroup 
                                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-muted/5 p-4 rounded-xl border border-muted/50"
                                    value={selectedPrimaryType || ''} 
                                    onValueChange={(val) => {
                                        setSelectedPrimaryType(val);
                                        setNewWorkTypeRule({ mode: 'ALL', ids: [] }); // Reset rule when primary changes
                                    }}
                                >
                                    <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-muted/5 transition-colors min-w-0">
                                        <RadioGroupItem value="" id="p-all" className="shrink-0" />
                                        <Label htmlFor="p-all" className="text-[11px] sm:text-xs font-bold cursor-pointer flex-1">ALL</Label>
                                    </div>
                                    {primaryTypes.map(type => (
                                        <div key={type} className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-muted/5 transition-colors min-w-0">
                                            <RadioGroupItem value={type} id={`p-${type}`} className="shrink-0" />
                                            <Label htmlFor={`p-${type}`} className="text-[10px] sm:text-xs font-bold cursor-pointer uppercase whitespace-normal break-words leading-tight flex-1">{type}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>

                                {selectedPrimaryType !== null && (
                                    <div className="space-y-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-blue-700/70">Selection Rule for {selectedPrimaryType || 'All'}</Label>
                                            <Badge variant="outline" className="bg-white text-blue-600 border-blue-200 text-[9px] font-bold">MODE: {newWorkTypeRule.mode}</Badge>
                                        </div>
                                        
                                        <RadioGroup 
                                            value={newWorkTypeRule.mode} 
                                            onValueChange={(val: any) => {
                                                setNewWorkTypeRule(p => ({ ...p, mode: val, ids: val === 'ALL' ? [] : p.ids }));
                                            }} 
                                            className="flex gap-6"
                                        >
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="ALL" id="r-all" /><Label htmlFor="r-all" className="text-xs font-bold tracking-tight">ALL</Label></div>
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="SELECT" id="r-select" /><Label htmlFor="r-select" className="text-xs font-bold tracking-tight">SELECTED</Label></div>
                                        </RadioGroup>

                                        {(newWorkTypeRule.mode === 'SELECT') && (
                                            <div className="space-y-2 mt-4 animate-in zoom-in-95 duration-200">
                                                <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                    <ListFilter className="h-3 w-3" />
                                                    Select sub categories
                                                </Label>
                                                <div className="h-48 overflow-y-auto border-2 border-slate-100 rounded-xl bg-white p-2">
                                                    <div className="grid grid-cols-1 gap-1">
                                                        {rawConstitutions.filter(c => !selectedPrimaryType || c.business_type === selectedPrimaryType).map(c => (
                                                            <div 
                                                                key={c.id} 
                                                                className={`flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer ${newWorkTypeRule.ids.includes(c.id) ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                                                                onClick={() => {
                                                                    const ids = newWorkTypeRule.ids.includes(c.id) 
                                                                        ? newWorkTypeRule.ids.filter(i => i !== c.id) 
                                                                        : [...newWorkTypeRule.ids, c.id];
                                                                    setNewWorkTypeRule(p => ({ ...p, ids }));
                                                                }}
                                                            >
                                                                <Checkbox 
                                                                    checked={newWorkTypeRule.ids.includes(c.id)} 
                                                                    onCheckedChange={(chk) => {
                                                                        setNewWorkTypeRule(p => ({ ...p, ids: chk ? [...p.ids, c.id] : p.ids.filter(i => i !== c.id) }));
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-700 leading-none">{c.business_sub_type}</span>
                                                                    <span className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">{c.business_type}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={submitAddWorkType}
                            disabled={!newWorkTypeName.trim() || !addingWorkTypeTo?.deptId || !addingWorkTypeTo?.catId}
                        >
                            Create Work Type
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingWorkType} onOpenChange={(o) => !o && setEditingWorkType(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Editing "{editingWorkType?.wt?.name || 'Work Type'}"</DialogTitle>
                        <DialogDescription>Update the details of this item.</DialogDescription>
                        <DialogDescription className="hidden">Edit Work Type details</DialogDescription>
                    </DialogHeader>
                    {editingWorkType && (
                        <>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Department</Label>
                                        <Select
                                            value={editingWorkType.deptId}
                                            onValueChange={(val) => setEditingWorkType(p => p ? { ...p, deptId: val, catId: '' } : p)}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select Department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {activeDepartments.map(d => (
                                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Category</Label>
                                        <Select
                                            value={editingWorkType.catId}
                                            onValueChange={(val) => setEditingWorkType(p => p ? { ...p, catId: val } : p)}
                                            disabled={!editingWorkType.deptId}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={editingWorkType.deptId ? "Select Category" : "Select Department First"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {activeDepartments.find(d => d.id === editingWorkType.deptId)?.workCategories?.filter(c => !c.isDeleted).map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t pt-4">
                                    <div className="space-y-2"><Label className="text-sm font-semibold">Work Type Name</Label><Input value={newName} placeholder="e.g. GST Registration" onChange={e => setNewName(e.target.value)} /></div>
                                    <div className="space-y-2"><Label className="text-sm font-semibold">Description</Label><Textarea value={newWorkTypeDesc} placeholder="Optional details..." onChange={e => setNewWorkTypeDesc(e.target.value)} /></div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Warning / Flow Note</Label>
                                        <Input value={newWorkTypeWarningNote} placeholder="Example: After completing AOC-4, proceed with MGT-7." onChange={e => setNewWorkTypeWarningNote(e.target.value)} />
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-primary" />
                                            Choose Primary Constitution
                                        </Label>
                                        <RadioGroup 
                                            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-muted/5 p-4 rounded-xl border border-muted/50"
                                            value={selectedPrimaryType || ''} 
                                            onValueChange={(val) => {
                                                setSelectedPrimaryType(val);
                                                setNewWorkTypeRule({ mode: 'ALL', ids: [] });
                                            }}
                                        >
                                            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-muted/5 transition-colors min-w-0">
                                                <RadioGroupItem value="" id="ep-all" className="shrink-0" />
                                                <Label htmlFor="ep-all" className="text-[11px] sm:text-xs font-bold cursor-pointer flex-1">ALL</Label>
                                            </div>
                                            {primaryTypes.map(type => (
                                                <div key={type} className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-muted/5 transition-colors min-w-0">
                                                    <RadioGroupItem value={type} id={`ep-${type}`} className="shrink-0" />
                                                    <Label htmlFor={`ep-${type}`} className="text-[10px] sm:text-xs font-bold cursor-pointer uppercase whitespace-normal break-words leading-tight flex-1">{type}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>

                                        {selectedPrimaryType !== null && selectedPrimaryType !== '' && (
                                            <div className="space-y-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-700/70">Selection Rule for {selectedPrimaryType}</Label>
                                                    <Badge variant="outline" className="bg-white text-blue-600 border-blue-200 text-[9px] font-bold">MODE: {newWorkTypeRule.mode}</Badge>
                                                </div>
                                                
                                                <RadioGroup 
                                                    value={newWorkTypeRule.mode} 
                                                    onValueChange={(val: any) => {
                                                        setNewWorkTypeRule(p => ({ ...p, mode: val, ids: val === 'ALL' ? [] : p.ids }));
                                                    }} 
                                                    className="flex gap-6"
                                                >
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="ALL" id="er-all" /><Label htmlFor="er-all" className="text-xs font-bold tracking-tight">ALL</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="SELECT" id="er-select" /><Label htmlFor="er-select" className="text-xs font-bold tracking-tight">SELECTED</Label></div>
                                                </RadioGroup>

                                                {(newWorkTypeRule.mode === 'SELECT') && (
                                                    <div className="space-y-2 mt-4 animate-in zoom-in-95 duration-200">
                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                            <ListFilter className="h-3 w-3" />
                                                            Select Specific Sub-types
                                                        </Label>
                                                        <div className="h-48 overflow-y-auto border-2 border-slate-100 rounded-xl bg-white p-2">
                                                            <div className="grid grid-cols-1 gap-1">
                                                                {rawConstitutions.filter(c => !selectedPrimaryType || c.business_type === selectedPrimaryType).map(c => (
                                                                    <div 
                                                                        key={c.id} 
                                                                        className={`flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer ${newWorkTypeRule.ids.includes(c.id) ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                                                                        onClick={() => {
                                                                            const ids = newWorkTypeRule.ids.includes(c.id) 
                                                                                ? newWorkTypeRule.ids.filter(i => i !== c.id) 
                                                                                : [...newWorkTypeRule.ids, c.id];
                                                                            setNewWorkTypeRule(p => ({ ...p, ids }));
                                                                        }}
                                                                    >
                                                                        <Checkbox 
                                                                            checked={newWorkTypeRule.ids.includes(c.id)} 
                                                                            onCheckedChange={(chk) => {
                                                                                setNewWorkTypeRule(p => ({ ...p, ids: chk ? [...p.ids, c.id] : p.ids.filter(i => i !== c.id) }));
                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-bold text-slate-700 leading-none">{c.business_sub_type}</span>
                                                                            <span className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">{c.business_type}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0 mt-6">
                                {filterMode === 'validation' ? (
                                    <>
                                        <Button variant="outline" onClick={() => { handleReject('WORKTYPE', editingWorkType.wt.id); setEditingWorkType(null); }} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50" disabled={isSubmitting}>Reject</Button>
                                        <Button onClick={submitEditWorkType} className="bg-green-600 hover:bg-green-700 text-white" disabled={isSubmitting}>Approve & Save</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="outline" onClick={() => setEditingWorkType(null)} disabled={isSubmitting}>Cancel</Button>
                                        <Button onClick={submitEditWorkType} disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Submit Request"}</Button>
                                    </>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!deletingWorkType} onOpenChange={(o) => { if (!o) { setDeletingWorkType(null); setWorkTypeDeleteConfirm(''); } }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Work Type?</DialogTitle><DialogDescription>Type DELETE to confirm.</DialogDescription></DialogHeader>
                    <Input value={workTypeDeleteConfirm} onChange={(e) => setWorkTypeDeleteConfirm(e.target.value)} placeholder="DELETE" />
                    <DialogFooter><Button onClick={submitDeleteWorkType} variant="destructive" disabled={workTypeDeleteConfirm !== 'DELETE'}>Delete</Button></DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

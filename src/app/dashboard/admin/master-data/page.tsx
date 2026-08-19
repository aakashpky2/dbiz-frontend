'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Edit, Trash2, LibraryBig, ArrowLeft, Check, X, Database, Layers, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { MasterValueDialog } from '@/components/dashboard/master-data/MasterValueDialog';
import { globalCache } from '@/lib/cache-utils';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { PageHero } from '@/components/dashboard/page-hero';

export interface MasterCategory {
    id: string;
    name: string;
    description: string;
}

export interface MasterValue {
    id: string;
    category_id: string;
    name: string;
    description: string;
    order: number;
    is_active: boolean;
}

const APP_CORE_SCHEMA: Record<string, string[]> = {
    'employees': ['id', 'full_name', 'email', 'employee_role', 'monthly_salary', 'department_id', 'status'],
    'employee_addresses': ['id', 'employee_id', 'address_type', 'city', 'country'],
    'employee_bank_details': ['id', 'employee_id', 'account_number', 'bank_name'],
    'employee_configs': ['id', 'employee_id', 'key', 'value'],
    'departments': ['id', 'name', 'code', 'status'],
    'teams': ['id', 'name', 'department_id', 'manager_id'],
    'attendance': ['id', 'employee_id', 'date', 'check_in', 'check_out'],
    'work_categories': ['id', 'name', 'description'],
    'work_types': ['id', 'name', 'description'],
    'job_openings': ['id', 'title', 'department_id', 'status'],
    'applicants': ['id', 'full_name', 'email', 'job_id', 'status'],
    'interviews': ['id', 'applicant_id', 'interview_date', 'status'],
    'clients': ['id', 'name', 'email', 'phone_number', 'industry', 'status', 'created_at'],
    'temporary_clients': ['id', 'name', 'email', 'phone_number'],
    'works': ['id', 'client_id', 'title', 'status'],
    'tasks': ['id', 'work_id', 'title', 'assigned_to', 'status'],
    'queries': ['id', 'subject', 'status', 'created_at'],
    'associates': ['id', 'name', 'type', 'status'],
    'proposals': ['id', 'name', 'total_amount', 'status', 'created_at'],
    'dsc': ['id', 'applicant_name', 'status', 'expiry_date']
};

const safeParse = (str: string | null | undefined, fallback: any = {}) => {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
};

const normalizeString = (val?: string | null) => (val || "").trim();
const normalizeCode = (val?: string | null) => (val || "").replace(/\+/g, "").trim();

export default function MasterDataPage() {
    const [categories, setCategories] = useState<MasterCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [values, setValues] = useState<MasterValue[]>([]);
    const [loading, setLoading] = useState(true);
    const [valuesLoading, setValuesLoading] = useState(false);
    const [isValueDialogOpen, setIsValueDialogOpen] = useState(false);
    const [editingValue, setEditingValue] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);

    // Delete confirmation state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [valueToDeleteId, setValueToDeleteId] = useState<string | null>(null);

    const router = useRouter();
    const { hasPermission, loading: permLoading } = usePermissions();
    const canManageSettings = hasPermission('MANAGE_SETTINGS');

    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const currentCategory = categories.find(c => c.id === selectedCategoryId);
    const isConstitutionCategory = currentCategory?.name?.toLowerCase() === 'constitution';
    const isPermissionCategory = currentCategory?.name?.toLowerCase() === 'permissions';
    const isCountryCodesCategory = currentCategory?.name?.toLowerCase() === 'country codes';
    const isTableDiscoveryTab = selectedCategoryId === 'system_discovery' || currentCategory?.name?.toLowerCase() === 'template tables';

    const hasChanges = React.useMemo(() => {
        if (!isTableDiscoveryTab) return false;
        const currentTableNames = (values || []).map(v => v.name).sort();
        const selectedTableNames = [...selectedTables].sort();
        return JSON.stringify(currentTableNames) !== JSON.stringify(selectedTableNames);
    }, [isTableDiscoveryTab, values, selectedTables]);

    const { toast } = useToast();

    useEffect(() => {
        if (!permLoading && !canManageSettings) {
            toast({ title: "Access Denied", description: "You do not have permission to manage master data.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canManageSettings, router, toast]);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            const CACHE_KEY = 'master_data_categories';
            let cached = globalCache.get<any>(CACHE_KEY);
            let data = cached;

            if (!data) {
                const res = await supabase.from('app_master_categories').select('*').order('name');
                if (res.error) throw res.error;
                data = res.data;
                globalCache.set(CACHE_KEY, data, 10 * 60 * 1000);
            }

            setCategories(data || []);

            // Check if Template Tables exists, if not, we can show it as a system category
            const hasTemplateTables = data?.find((c: any) => c.name.toLowerCase() === 'template tables');
            if (!hasTemplateTables) {
                // If it doesn't exist, we'll give it a temporary ID so the UI can navigate to it
                // and the first toggle will create the category if needed.
                // But better: let's just make it a first-class citizen in the UI
            }

            if (data && data.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(data[0].id);
            }

            // Seed missing Proposal categories
            const requiredProposalCats = [
                'Proposal / Method',
                'Proposal / Interaction Outcome',
                'Proposal / Contact Role',
                'Proposal / Client Role',
                'Proposal / Purpose',
                'Proposal / Client Sentiment'
            ];
            
            const missing = requiredProposalCats.filter(req => !data?.some((c: any) => c.name === req));
            if (missing.length > 0) {
                for (const catName of missing) {
                    await supabase.from('app_master_categories').insert([{
                        name: catName,
                        description: `Master configuration for ${catName.split(' / ')[1]}.`
                    }]);
                }
            }

            // Seed missing Team Management categories
            const requiredTeamCats = [
                'Team Roles',
                'Team Availability Status',
                'Team Assignment Type',
                'Team Backup Priority'
            ];
            const missingTeam = requiredTeamCats.filter(req => !data?.some((c: any) => c.name === req));
            if (missingTeam.length > 0) {
                for (const catName of missingTeam) {
                    await supabase.from('app_master_categories').insert([{
                        name: catName,
                        description: `Resource management constants for ${catName.toLowerCase()}.`
                    }]);
                }
            }

            if (missing.length > 0 || missingTeam.length > 0) {
                // Re-fetch to get new IDs and values
                const { data: updatedData } = await supabase.from('app_master_categories').select('*').order('name');
                setCategories(updatedData || []);
                globalCache.set('master_data_categories', updatedData, 10 * 60 * 1000);
                
                // Seed initial values for newly created team categories
                if (missingTeam.length > 0 && updatedData) {
                    for (const cat of updatedData) {
                        if (!missingTeam.includes(cat.name)) continue;
                        
                        let vals: string[] = [];
                        if (cat.name === 'Team Roles') vals = ['Team Lead', 'Senior Member', 'Member', 'Reviewer', 'Backup Member'];
                        else if (cat.name === 'Team Availability Status') vals = ['Available', 'Busy', 'On Leave', 'Inactive'];
                        else if (cat.name === 'Team Assignment Type') vals = ['Permanent', 'Temporary'];
                        else if (cat.name === 'Team Backup Priority') vals = ['Backup Member', 'Least-loaded', 'Team Lead'];
                        
                        if (vals.length > 0) {
                            await supabase.from('app_master_values').insert(
                                vals.map((v, i) => ({
                                    category_id: cat.id,
                                    name: v,
                                    order: i
                                }))
                            );
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error("Error fetching categories:", error);
            toast({ title: "Fetch Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [selectedCategoryId, toast]);

    const currentFetchPromise = React.useRef<Promise<any> | null>(null);

    const fetchValues = useCallback(async (catId: string) => {
        setValues([]); // Clear old state instantly
        setValuesLoading(true);

        if (catId === 'system_discovery') {
            setValuesLoading(false);
            return;
        }

        const CACHE_KEY = `master_data_values_${catId}`;
        const cached = globalCache.get<any>(CACHE_KEY);
        if (cached) {
            setValues(cached);
            setValuesLoading(false);
            return;
        }

        const promise = supabase.from('app_master_values').select('*').eq('category_id', catId).order('order', { ascending: true });
        currentFetchPromise.current = promise as any;

        try {
            const { data, error } = await promise;
            if (currentFetchPromise.current !== (promise as any)) return; // Ignore outdated responses

            if (error) throw error;
            setValues(data || []);
            globalCache.set(CACHE_KEY, data, 10 * 60 * 1000);
        } catch (error: any) {
            if (currentFetchPromise.current === (promise as any)) {
                toast({ title: "Fetch Failed", description: error.message, variant: "destructive" });
            }
        } finally {
            if (currentFetchPromise.current === (promise as any)) {
                setValuesLoading(false);
            }
        }
    }, [toast]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        if (selectedCategoryId) {
            fetchValues(selectedCategoryId);
        }
    }, [selectedCategoryId, fetchValues]);

    useEffect(() => {
        if (isTableDiscoveryTab) {
            setSelectedTables(values.map(v => v.name));
        }
    }, [isTableDiscoveryTab, values]);

    const handleEditValue = useCallback((val: any) => {
        setEditingValue(val);
        setIsValueDialogOpen(true);
    }, []);

    const handleAddValue = useCallback(() => {
        setEditingValue(null);
        setIsValueDialogOpen(true);
    }, []);

    const toggleTable = useCallback((table: string) => {
        setSelectedTables(prev =>
            prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
        );
    }, []);

    const handleSaveTables = useCallback(async () => {
        let currentTargetId = selectedCategoryId;
        setSaving(true);

        try {
            // 1. Handle category creation if virtual
            if (selectedCategoryId === 'system_discovery') {
                const { data, error } = await supabase.from('app_master_categories').insert([{
                    name: 'Template Tables',
                    description: 'Authorize system tables to be linked with dynamic template configurations.'
                }]).select('id').single();

                if (error) throw error;
                currentTargetId = data.id;
                setSelectedCategoryId(data.id);
                globalCache.invalidate('master_data_categories');
                await fetchCategories();
            }

            if (!currentTargetId) return;

            // 2. Identify changes
            const currentTableNames = values.map(v => v.name);
            const tablesToAdd = selectedTables.filter(t => !currentTableNames.includes(t));
            const tablesToRemove = values.filter(v => !selectedTables.includes(v.name));

            // 3. Apply deletions
            if (tablesToRemove.length > 0) {
                const { error } = await supabase
                    .from('app_master_values')
                    .delete()
                    .in('id', tablesToRemove.map(t => t.id));
                if (error) throw error;
            }

            // 4. Apply additions
            if (tablesToAdd.length > 0) {
                const { error } = await supabase
                    .from('app_master_values')
                    .insert(tablesToAdd.map(t => ({
                        category_id: currentTargetId,
                        name: t,
                        description: `Automated Link: ${t}`,
                        order: 0
                    })));
                if (error) throw error;
            }

            toast({ title: "Configuration Saved", description: `${selectedTables.length} tables are now authorized.` });
            globalCache.invalidate(`master_data_values_${currentTargetId}`);
            await fetchValues(currentTargetId!);
        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    }, [selectedCategoryId, values, selectedTables, fetchCategories, fetchValues, toast]);


    const handleDeleteClick = useCallback((id: string) => {
        setValueToDeleteId(id);
        setShowDeleteConfirm(true);
    }, []);

    const executeDelete = useCallback(async () => {
        if (!valueToDeleteId) return;
        try {
            const { error } = await supabase.from('app_master_values').delete().eq('id', valueToDeleteId);
            if (error) throw error;
            toast({ title: "Value Deleted" });
            if (selectedCategoryId) {
                globalCache.invalidate(`master_data_values_${selectedCategoryId}`);
                fetchValues(selectedCategoryId);
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setShowDeleteConfirm(false);
            setValueToDeleteId(null);
        }
    }, [valueToDeleteId, selectedCategoryId, fetchValues, toast]);

    if (permLoading || !canManageSettings) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Verifying permissions...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:translate-y-1 duration-300">
            <PageHero
                pattern="pattern-6" 
                icon={Database}
                badge="MASTER CONFIGURATION"
                title={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6 -ml-2 text-muted-foreground hover:text-foreground" asChild>
                            <Link href="/dashboard/admin"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        Master Data Management
                    </div>
                }
                description="Manage system-wide configuration and reference data."
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="md:col-span-1 border border-border/70 rounded-xl bg-card shadow-sm">
                    <CardHeader className="p-5 pb-4 border-b border-border/50">
                        <CardTitle className="text-sm uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-2">
                            <LibraryBig className="h-4 w-4" /> Categories
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        {loading ? (<div className="p-6"><PageSkeleton /></div>) : (
                            <div className="space-y-4">
                                {/* GENERAL GROUP */}
                                {categories.filter(c => !c.name.startsWith('Proposal / ') && !['Team Roles', 'Team Availability Status', 'Team Assignment Type', 'Team Backup Priority'].includes(c.name)).length > 0 && (
                                    <div className="space-y-1.5 pt-4">
                                        <div className="px-4 flex items-center gap-2 mb-1">
                                            <div className="h-px bg-slate-100 flex-1" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">General</p>
                                            <div className="h-px bg-slate-100 flex-1" />
                                        </div>
                                        <div className="space-y-1">
                                            {categories.filter(c => 
                                                !c.name.startsWith('Proposal / ') && 
                                                !['Team Roles', 'Team Availability Status', 'Team Assignment Type', 'Team Backup Priority'].includes(c.name)
                                            ).map(cat => (
                                                <Button
                                                    key={cat.id}
                                                    variant="ghost"
                                                    className={cn(
                                                        "w-full justify-start h-10 px-4 text-[13px] transition-all duration-150 ease-out",
                                                        selectedCategoryId === cat.id 
                                                            ? "bg-primary/[0.08] text-primary font-semibold border-l-[3px] border-primary rounded-none rounded-r-lg" 
                                                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:translate-x-[2px] rounded-lg"
                                                    )}
                                                    onClick={() => {
                                                        if (selectedCategoryId !== cat.id) setSelectedCategoryId(cat.id);
                                                    }}
                                                >
                                                    {cat.name}
                                                    {selectedCategoryId === cat.id && <Check className="ml-auto h-3 w-3 text-primary" />}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* TEAM MANAGEMENT GROUP */}
                                {categories.some(c => ['Team Roles', 'Team Availability Status', 'Team Assignment Type', 'Team Backup Priority'].includes(c.name)) && (
                                    <div className="space-y-1.5 pt-4">
                                        <div className="px-4 flex items-center gap-2 mb-1">
                                            <div className="h-px bg-slate-100 flex-1" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Team Management</p>
                                            <div className="h-px bg-slate-100 flex-1" />
                                        </div>
                                        <div className="space-y-1">
                                            {categories.filter(c => ['Team Roles', 'Team Availability Status', 'Team Assignment Type', 'Team Backup Priority'].includes(c.name)).map(cat => (
                                                <Button
                                                    key={cat.id}
                                                    variant="ghost"
                                                    className={cn(
                                                        "w-full justify-start h-10 px-4 text-[13px] transition-all duration-150 ease-out",
                                                        selectedCategoryId === cat.id 
                                                            ? "bg-primary/[0.08] text-primary font-semibold border-l-[3px] border-primary rounded-none rounded-r-lg" 
                                                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:translate-x-[2px] rounded-lg"
                                                    )}
                                                    onClick={() => {
                                                        if (selectedCategoryId !== cat.id) setSelectedCategoryId(cat.id);
                                                    }}
                                                >
                                                    {cat.name.replace('Team ', '')}
                                                    {selectedCategoryId === cat.id && <Check className="ml-auto h-3 w-3 text-primary" />}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* PROPOSAL GROUP */}
                                {categories.some(c => c.name.startsWith('Proposal / ')) && (
                                    <div className="space-y-1.5 pt-4">
                                        <div className="px-4 flex items-center gap-2 mb-1">
                                            <div className="h-px bg-slate-100 flex-1" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Proposal</p>
                                            <div className="h-px bg-slate-100 flex-1" />
                                        </div>
                                        <div className="space-y-1">
                                            {categories.filter(c => c.name.startsWith('Proposal / ')).map(cat => (
                                                <Button
                                                    key={cat.id}
                                                    variant="ghost"
                                                    className={cn(
                                                        "w-full justify-start h-10 px-4 text-[13px] transition-all duration-150 ease-out",
                                                        selectedCategoryId === cat.id 
                                                            ? "bg-primary/[0.08] text-primary font-semibold border-l-[3px] border-primary rounded-none rounded-r-lg" 
                                                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:translate-x-[2px] rounded-lg"
                                                    )}
                                                    onClick={() => {
                                                        if (selectedCategoryId !== cat.id) setSelectedCategoryId(cat.id);
                                                    }}
                                                >
                                                    {cat.name.split(' / ')[1]}
                                                    {selectedCategoryId === cat.id && <Check className="ml-auto h-3 w-3 text-primary" />}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!categories.find(c => c.name.toLowerCase() === 'template tables') && (
                                    <div className="pt-4">
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start h-10 px-4 text-[13px] transition-all duration-150 ease-out",
                                                selectedCategoryId === 'system_discovery'
                                                    ? "bg-primary/[0.08] text-primary font-semibold border-l-[3px] border-primary rounded-none rounded-r-lg" 
                                                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:translate-x-[2px] rounded-lg"
                                            )}
                                            onClick={() => {
                                                if (selectedCategoryId !== 'system_discovery') setSelectedCategoryId('system_discovery');
                                            }}
                                        >
                                            <Database className="h-4 w-4 mr-2" /> Template Tables
                                            {selectedCategoryId === 'system_discovery' && <Check className="ml-auto h-4 w-4 text-primary" />}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card key={selectedCategoryId} className="md:col-span-3 border border-border/70 rounded-xl bg-card shadow-sm overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-200">
                    <CardHeader className="bg-card border-b border-border/70 p-5 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-semibold text-foreground">
                                {currentCategory?.name || 'Select Category'}
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">
                                {isTableDiscoveryTab
                                    ? 'Authorize system tables to be linked with dynamic template configurations.'
                                    : (currentCategory?.description || 'Manage values for the selected category.')}
                            </CardDescription>
                        </div>
                        {isTableDiscoveryTab ? (
                            <Button
                                onClick={handleSaveTables}
                                disabled={!selectedCategoryId || !hasChanges || saving}
                                className={cn(
                                    "h-10 px-4 rounded-lg shadow-sm transition-colors duration-150",
                                    hasChanges ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-600/80 text-white"
                                )}
                            >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Save Table Configuration
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleAddValue} 
                                disabled={!selectedCategoryId} 
                                className="h-10 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors duration-150"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Value
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-0">
                        {isTableDiscoveryTab ? (
                            <div className="p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <Label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                            <Database className="h-4 w-4 text-blue-600" /> System Discovery Grid
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <div className={cn("h-1.5 w-1.5 rounded-full", hasChanges ? "bg-amber-500 animate-bounce" : "bg-emerald-500 animate-pulse")} />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                Selected: {selectedTables.length} | Current: {values.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hasChanges && (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[8px] animate-pulse">
                                                Pending Changes
                                            </Badge>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => fetchValues(selectedCategoryId!)} className="text-slate-400 hover:text-blue-600">
                                            <RefreshCw className="h-3 w-3 mr-2" /> Sync
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 bg-muted/10 rounded-2xl border-2 border-dashed border-muted/50">
                                    {Object.keys(APP_CORE_SCHEMA).sort().map(table => {
                                        const isSelected = selectedTables.includes(table);
                                        const isSaved = values.some(v => v.name === table);
                                        return (
                                            <button
                                                key={table}
                                                onClick={() => toggleTable(table)}
                                                className={cn(
                                                    "px-4 py-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group",
                                                    isSelected
                                                        ? "bg-white border-blue-600 text-blue-700 shadow-xl ring-1 ring-blue-600/10"
                                                        : "bg-white/50 border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-900 shadow-sm"
                                                )}
                                            >
                                                <Layers className={cn("h-6 w-6", isSelected ? "text-blue-600" : "text-slate-200 group-hover:text-slate-400")} />
                                                <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-tight">{table.replace(/_/g, ' ')}</span>
                                                {isSelected && (
                                                    <div className="absolute top-0 right-0 p-1.5 bg-blue-600 text-white rounded-bl-xl shadow-lg">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 border-b border-border/50 hover:bg-transparent">
                                        <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Order</TableHead>
                                        <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isCountryCodesCategory ? "Country Name" : "Field Name"}</TableHead>
                                        {isCountryCodesCategory && <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dial Code</TableHead>}
                                        {isConstitutionCategory ? (
                                            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Level</TableHead>
                                        ) : (isCountryCodesCategory || currentCategory?.name?.toLowerCase() === 'countries') ? null : (
                                            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</TableHead>
                                        )}
                                        <TableHead className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {values.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-40">
                                                <div className="flex flex-col items-center justify-center gap-3 motion-safe:animate-in motion-safe:fade-in duration-200">
                                                    <p className="text-muted-foreground font-medium">No values configured</p>
                                                    <p className="text-xs text-muted-foreground">Add the first value to begin configuring this category.</p>
                                                    <Button onClick={handleAddValue} variant="outline" size="sm" className="mt-2 transition-all hover:bg-primary/5 hover:text-primary"><Plus className="h-4 w-4 mr-2" /> Add Value</Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        [...values]
                                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                            .map((val, index) => {
                                                let fieldTargetLabel = '—';
                                                let fieldTargetVariant: 'default' | 'secondary' | 'outline' = 'outline';
                                                let tableOrder = val.order;
                                                if (isConstitutionCategory) {
                                                    try {
                                                        const parsed = JSON.parse(val.description || '{}');
                                                        if (parsed.type === 'group') {
                                                            fieldTargetLabel = `Field Group (${Array.isArray(parsed.fields) ? parsed.fields.length : 0})`;
                                                            fieldTargetVariant = 'secondary';
                                                            tableOrder = parsed.buttonOrder !== undefined ? parsed.buttonOrder : val.order;
                                                        } else {
                                                            const ft = parsed.fieldTarget;
                                                            if (ft === 'Constitution') { fieldTargetLabel = 'Constitution Level'; fieldTargetVariant = 'default'; }
                                                            else if (ft === 'Role') { fieldTargetLabel = 'Role Level'; fieldTargetVariant = 'outline'; }
                                                            else if (ft === 'Both') { fieldTargetLabel = 'All Levels'; fieldTargetVariant = 'outline'; }
                                                            else { fieldTargetLabel = 'Single Field'; }
                                                            tableOrder = parsed.fieldOrder !== undefined ? parsed.fieldOrder : val.order;
                                                        }
                                                    } catch { /* malformed JSON — show dash */ }
                                                }
                                                return (
                                                    <TableRow 
                                                        key={val.id} 
                                                        className="hover:bg-muted/40 transition-colors duration-150 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 fill-mode-both border-border/50"
                                                        style={{ animationDuration: '200ms', animationDelay: `${Math.min(index * 25, 200)}ms` }}
                                                    >
                                                        <TableCell className="font-mono text-xs text-muted-foreground">{tableOrder}</TableCell>
                                                        <TableCell className="font-semibold text-foreground">
                                                            <div className="flex items-center gap-2">
                                                                {val.name}
                                                                {safeParse(val.description, {}).isDefault === true && (
                                                                    <Badge className="text-[9px] bg-green-100 text-green-700 font-bold border-green-200">
                                                                        Default
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        {isCountryCodesCategory && (
                                                            <TableCell className="font-mono text-xs text-blue-600 font-bold">
                                                                +{safeParse(val.description, {}).code || '—'}
                                                            </TableCell>
                                                        )}
                                                        {isConstitutionCategory ? (
                                                            <TableCell>
                                                                <Badge variant={fieldTargetVariant} className="text-[10px] font-black uppercase tracking-widest">
                                                                    {fieldTargetLabel}
                                                                </Badge>
                                                            </TableCell>
                                                        ) : (isCountryCodesCategory || currentCategory?.name?.toLowerCase() === 'countries') ? null : (
                                                        <TableCell className="text-sm text-muted-foreground">
                                                                {val.description}
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="text-right space-x-1">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEditValue(val)} className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150" title="Edit value">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(val.id)} className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150" title="Delete value">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <MasterValueDialog 
                open={isValueDialogOpen}
                onOpenChange={setIsValueDialogOpen}
                categoryId={selectedCategoryId}
                categoryName={currentCategory?.name || null}
                editingValue={editingValue}
                initialOrder={editingValue ? editingValue.order : values.length + 1}
                existingValues={values}
                onSuccess={() => {
                    if (selectedCategoryId) {
                        globalCache.invalidate(`master_data_values_${selectedCategoryId}`);
                        fetchValues(selectedCategoryId);
                    }
                }}
            />

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the master value.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setValueToDeleteId(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

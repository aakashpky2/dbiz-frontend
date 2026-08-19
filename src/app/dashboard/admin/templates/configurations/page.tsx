'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHero } from '@/components/dashboard/page-hero';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
    Plus, Trash2, Database, Settings2, ShieldCheck, 
    Filter, RefreshCw, Layers, Search, 
    Eye, Loader2, Save, X, ChevronRight,
    Tag, MessageSquare, Lock, Activity, Layout, 
    Zap, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_ENDPOINTS } from '@/lib/api-config';

// Default data list
const DEFAULT_DATA_LIST: Record<string, string[]> = {
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

interface Condition {
    table?: string;
    field?: string;
    operator: string;
    value: string | any;
    
    // For Module specific filtering (like Proposal)
    field_key?: string;
    display_name?: string;
    group?: 'AND' | 'OR';
    value_label?: string;
}

interface FieldMapping {
    placeholder: string;
    table: string;
    field: string;
}

interface TemplateSetup {
    id?: string;
    name: string;
    tag?: string;
    description?: string;
    selected_tables: string[];
    selected_fields: string[];
    conditions: Condition[];
    template_id?: string;
    mappings?: FieldMapping[];
    module?: string;
    action_key?: string;
    status?: string;
    is_default?: boolean;
    condition_mode?: string;
    priority?: number;
    created_at?: string;
}

const OPERATORS = [
    { label: 'is exactly', value: '==' },
    { label: 'is not', value: '!=' },
    { label: 'is more than', value: '>' },
    { label: 'is less than', value: '<' },
    { label: 'contains', value: 'contains' },
    { label: 'starts with', value: 'starts_with' },
    { label: 'is empty', value: 'is_null' },
    { label: 'is not empty', value: 'is_not_null' }
];

export default function TemplateBuilder() {
    const { toast } = useToast();
    const [setups, setSetups] = useState<TemplateSetup[]>([]);
    const [dataList, setDataList] = useState<Record<string, string[]>>(DEFAULT_DATA_LIST);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [restricted, setRestricted] = useState(false);
    
    const { hasPermission, loading: permLoading } = usePermissions();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const canManageTemplateConfigs = hasPermission('MANAGE_TEMPLATE_CONFIGURATIONS');

    useEffect(() => {
        if (!permLoading && !authLoading && !canManageTemplateConfigs) {
            toast({ title: "Access Denied", description: "You do not have permission to access template configurations.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, authLoading, canManageTemplateConfigs, router, toast]);

    // Form Details
    const [setupName, setSetupName] = useState('');
    const [setupModule, setSetupModule] = useState('other');
    const [setupAction, setSetupAction] = useState('');
    const [setupStatus, setSetupStatus] = useState('active');
    const [isDefault, setIsDefault] = useState(false);
    const [conditionMode, setConditionMode] = useState('always');
    const [priority, setPriority] = useState<number>(100);
    const [category, setCategory] = useState('');
    const [about, setAbout] = useState('');
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [conditions, setConditions] = useState<Condition[]>([]);

    // Connection Details
    const [templates, setTemplates] = useState<{id: string, name: string, content: string}[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [mappings, setMappings] = useState<Record<string, { table: string, field: string }>>({});

    // Delete confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const [authorizedTables, setAuthorizedTables] = useState<string[]>([]);

    const fetchData = useCallback(async () => {
        if (authLoading) return;
        setLoading(true);
        try {
            if (!user) {
                setRestricted(true);
                return;
            }

            // Get live data if available
            try {
                const res = await fetch(API_ENDPOINTS.ADMIN_SCHEMA);
                const json = await res.json();
                if (json.success && json.data && Object.keys(json.data).length > 0) {
                    setDataList(json.data);
                } else {
                    setDataList(DEFAULT_DATA_LIST);
                }
            } catch (err) {
            setDataList(DEFAULT_DATA_LIST);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }

            const { data, error } = await supabase.from('template_configurations').select('*').order('created_at', { ascending: false });
            if (!error) setSetups(data || []);

            // Get all templates
            const { data: templateData } = await supabase.from('templates').select('id, name, content');
            if (templateData) setTemplates(templateData);

            // Get allowed tables
            const { data: catData } = await supabase.from('app_master_categories').select('id').eq('name', 'Template Tables').single();
            if (catData) {
                const { data: valData } = await supabase.from('app_master_values').select('name').eq('category_id', catData.id);
                if (valData) setAuthorizedTables(valData.map(v => v.name));
            }
        } catch (err: any) {
            toast({ title: "Refresh Failed", description: "Could not load settings.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast, authLoading, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = useCallback(async () => {
        if (!setupName.trim()) {
            toast({ title: "Missing Name", description: "Please give this setup a name." });
            return;
        }

        if (!selectedTemplateId) {
            toast({ title: "Template Missing", description: "Please choose a template." });
            return;
        }

        if (setupModule === 'proposal') {
            // No mappings required for proposal
        } else {
            const templateFields = Object.keys(mappings);
            const missingMappings = templateFields.filter(p => !mappings[p]?.table || !mappings[p]?.field);
            if (missingMappings.length > 0) {
                toast({ title: "Finish Connections", description: `Please connect all ${missingMappings.length} fields.` });
                return;
            }
        }

        setSaving(true);
        try {
            const mappingList: FieldMapping[] = Object.entries(mappings).map(([p, m]) => ({
                placeholder: p,
                table: m.table,
                field: m.field
            }));

            const payload: TemplateSetup = {
                name: setupName.trim(),
                module: setupModule,
                action_key: setupAction,
                status: setupStatus,
                is_default: isDefault,
                condition_mode: conditionMode,
                priority: priority,
                tag: category.trim(),
                description: about.trim(),
                selected_tables: setupModule === 'proposal' ? [] : selectedTables,
                selected_fields: [], 
                template_id: selectedTemplateId,
                mappings: setupModule === 'proposal' ? [] : mappingList,
                conditions: conditions,
            };

            if (isDefault) {
                // Unset default for other templates with same module and action
                let query = supabase.from('template_configurations').update({ is_default: false }).eq('module', setupModule);
                if (setupAction) query = query.eq('action_key', setupAction);
                if (editingId) query = query.neq('id', editingId);
                await query;
            }

            const { error } = editingId 
                ? await supabase.from('template_configurations').update(payload).eq('id', editingId)
                : await supabase.from('template_configurations').insert([payload]);

            if (error) throw error;

            await fetchData();
            toast({ title: "Saved!", description: "Everything is set up correctly." });
            setIsFormOpen(false);
            resetForm();
        } catch (err: any) {
            toast({ title: "Save Failed", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    }, [setupName, setupModule, setupAction, setupStatus, isDefault, conditionMode, priority, category, about, selectedTables, conditions, editingId, fetchData, toast, selectedTemplateId, mappings]);

    const templateFields = useMemo(() => {
        const template = templates.find(t => t.id === selectedTemplateId);
        if (!template?.content) return [];
        const regex = /{{(.*?)}}/g;
        const matches = Array.from(template.content.matchAll(regex));
        const extracted = matches.map(m => m[1].trim().toLowerCase());
        return Array.from(new Set(extracted)).sort();
    }, [selectedTemplateId, templates]);

    const handleEdit = (setup: TemplateSetup) => {
        setEditingId(setup.id || null);
        setSetupName(setup.name);
        setSetupModule(setup.module || 'other');
        setSetupAction(setup.action_key || '');
        setSetupStatus(setup.status || 'active');
        setIsDefault(setup.is_default || false);
        setConditionMode(setup.condition_mode || 'always');
        setPriority(setup.priority ?? 100);
        setCategory(setup.tag || '');
        setAbout(setup.description || '');
        setSelectedTables(setup.selected_tables || []);
        setConditions(setup.conditions || []);
        setSelectedTemplateId(setup.template_id || '');
        
        const mapObj: Record<string, { table: string, field: string }> = {};
        if (setup.mappings) {
            setup.mappings.forEach(m => {
                mapObj[m.placeholder] = { table: m.table, field: m.field };
            });
        }
        setMappings(mapObj);
        setIsFormOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setSetupName('');
        setSetupModule('other');
        setSetupAction('');
        setSetupStatus('active');
        setIsDefault(false);
        setConditionMode('always');
        setPriority(100);
        setCategory('');
        setAbout('');
        setSelectedTables([]);
        setConditions([]);
        setSelectedTemplateId('');
        setMappings({});
    };

    const updateMapping = (field: string, table: string, col: string) => {
        setMappings(prev => ({
            ...prev,
            [field]: { table, field: col }
        }));
    };

    const addCondition = useCallback(() => {
        if (selectedTables.length === 0) {
            toast({ title: "Select Table First", description: "Pick at least one data source." });
            return;
        }
        setConditions(prev => [...prev, { table: selectedTables[0], field: (dataList[selectedTables[0]]?.[0] || ''), operator: '==', value: '' }]);
    }, [selectedTables, dataList, toast]);

    const removeCondition = useCallback((idx: number) => {
        setConditions(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const executeDelete = useCallback(async () => {
        if (!idToDelete) return;
        try {
            const { error } = await supabase.from('template_configurations').delete().eq('id', idToDelete);
            if (error) throw error;
            await fetchData();
            toast({ title: "Deleted" });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setShowDeleteConfirm(false);
            setIdToDelete(null);
        }
    }, [idToDelete, fetchData, toast]);

    const filteredSetups = setups.filter(s => 
        s.name.toLowerCase().includes(searchText.toLowerCase()) || 
        s.tag?.toLowerCase().includes(searchText.toLowerCase())
    );

    if (restricted) return <div className="p-20 text-center font-bold text-slate-400 uppercase tracking-widest">Access Restricted</div>;

    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-5" 
                icon={Layout}
                badge="TEMPLATES"
                title="Template Setup" 
                description="Easily connect your templates to system data."
            />

            {!isFormOpen ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={Database} label="System Data" value={Object.keys(dataList).length} />
                        <StatCard icon={Settings2} label="Your Setups" value={setups.length} />
                        <StatCard icon={ShieldCheck} label="Status" value="Secure" />
                        <StatCard icon={RefreshCw} label="State" value="Live" />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Search setups..." 
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                className="pl-10 h-10 border-slate-200 bg-slate-50/50"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" onClick={fetchData} size="sm" className="text-slate-500">
                                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                            </Button>
                            <Button onClick={() => { resetForm(); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                                <Plus className="h-4 w-4 mr-2" /> Add New Setup
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSetups.map((setup) => (
                            <Card key={setup.id} className="group hover:border-blue-300 transition-all shadow-sm rounded-xl overflow-hidden border-slate-200 bg-white">
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 border-blue-100">{setup.tag || 'GENERAL'}</Badge>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(setup)} className="h-8 w-8 text-slate-400 hover:text-blue-600"><Eye className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => { setIdToDelete(setup.id!); setShowDeleteConfirm(true); }} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors uppercase truncate">{setup.name}</CardTitle>
                                    <CardDescription className="text-xs line-clamp-2 min-h-[32px] italic">{setup.description || 'Easy template connector'}</CardDescription>
                                </CardHeader>
                                <CardFooter className="bg-slate-50/50 py-3 px-6 flex items-center justify-between border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{setup.selected_tables.length} Sources Linked</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1" />
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6 items-start">
                        <div className="space-y-6">
                            <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
                                <CardHeader className="bg-slate-50/50 p-6 border-b border-slate-100 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                                            <Settings2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-slate-900">Setup Builder</CardTitle>
                                            <CardDescription className="text-xs font-semibold text-slate-500 uppercase">Connect Your Data</CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" onClick={() => { setIsFormOpen(false); resetForm(); }} className="h-10 px-4 text-slate-400 hover:text-slate-900">
                                        <X className="h-4 w-4 mr-2" /> Cancel
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-8 space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Zap className="h-3 w-3 text-amber-500" /> Name
                                            </Label>
                                            <Input 
                                                placeholder="e.g. My Document Setup" 
                                                value={setupName}
                                                onChange={e => setSetupName(e.target.value)}
                                                className="h-11 font-medium bg-slate-50/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Module</Label>
                                            <select 
                                                value={setupModule}
                                                onChange={(e) => {
                                                    setSetupModule(e.target.value);
                                                    setSetupAction('');
                                                }}
                                                className="w-full h-11 px-3 rounded-md border border-input bg-slate-50/50 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="proposal">Proposal</option>
                                                <option value="offer_letter">Offer Letter</option>
                                                <option value="appointment_letter">Appointment Letter</option>
                                                <option value="experience_certificate">Experience Certificate</option>
                                                <option value="invoice">Invoice</option>
                                                <option value="quotation">Quotation</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Action / Button</Label>
                                            <select 
                                                value={setupAction}
                                                onChange={(e) => setSetupAction(e.target.value)}
                                                className="w-full h-11 px-3 rounded-md border border-input bg-slate-50/50 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="">Select Action</option>
                                                {setupModule === 'proposal' && (
                                                    <>
                                                        <option value="download_pdf">Download PDF</option>
                                                        <option value="send_proposal_pdf">Send Proposal PDF</option>
                                                        <option value="preview_proposal">Preview Proposal</option>
                                                    </>
                                                )}
                                                {setupModule === 'offer_letter' && (
                                                    <>
                                                        <option value="download">Download Offer Letter</option>
                                                        <option value="send">Send Offer Letter</option>
                                                    </>
                                                )}
                                                {setupModule === 'invoice' && (
                                                    <>
                                                        <option value="download">Download Invoice</option>
                                                        <option value="send">Send Invoice</option>
                                                    </>
                                                )}
                                                {/* Add general fallback options for others if needed, but for now we keep it empty or generic */}
                                                {!['proposal', 'offer_letter', 'invoice'].includes(setupModule) && (
                                                    <option value="default_action">Default Action</option>
                                                )}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Layout className="h-3 w-3 text-blue-500" /> Choose Template
                                            </Label>
                                            <select 
                                                value={selectedTemplateId}
                                                onChange={(e) => {
                                                    setSelectedTemplateId(e.target.value);
                                                    setMappings({}); 
                                                }}
                                                className="w-full h-11 px-3 rounded-md border border-input bg-slate-50/50 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="">Choose...</option>
                                                {templates.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">About this setup</Label>
                                        <Textarea 
                                            placeholder="What does this setup do?" 
                                            value={about}
                                            onChange={e => setAbout(e.target.value)}
                                            className="min-h-[80px] bg-slate-50/50"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">Status</p>
                                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Is this configuration active?</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button type="button" variant={setupStatus === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setSetupStatus('active')} className={cn("text-xs h-8", setupStatus === 'active' && "bg-emerald-600 hover:bg-emerald-700")}>Active</Button>
                                                <Button type="button" variant={setupStatus === 'inactive' ? 'default' : 'outline'} size="sm" onClick={() => setSetupStatus('inactive')} className={cn("text-xs h-8", setupStatus === 'inactive' && "bg-slate-600 hover:bg-slate-700")}>Inactive</Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">Default Template</p>
                                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Use automatically for this module?</p>
                                            </div>
                                            <Button type="button" variant={isDefault ? 'default' : 'outline'} size="sm" onClick={() => setIsDefault(!isDefault)} className={cn("text-xs h-8", isDefault && "bg-blue-600 hover:bg-blue-700")}>
                                                {isDefault ? 'Yes, Default' : 'No'}
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100 max-w-sm">
                                        <Label className="text-sm font-bold text-slate-900">Priority (Tie-Breaker)</Label>
                                        <p className="text-[10px] text-slate-500 font-medium">Lower number wins if multiple templates match.</p>
                                        <Input 
                                            type="number"
                                            value={priority}
                                            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                                            className="h-10 font-medium bg-white max-w-[100px]"
                                        />
                                    </div>

                                    <Separator className="my-6" />

                                    <div className="space-y-6">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-lg font-bold text-slate-900">When should this template be used?</h3>
                                        </div>
                                        
                                        <div className="flex gap-4">
                                            <button 
                                                type="button"
                                                onClick={() => setConditionMode('always')}
                                                className={cn("px-4 py-3 rounded-xl border-2 flex-1 text-sm font-bold transition-all text-left", conditionMode === 'always' ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-100 bg-white text-slate-500 hover:border-slate-200")}
                                            >
                                                Always use this template
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setConditionMode('conditional')}
                                                className={cn("px-4 py-3 rounded-xl border-2 flex-1 text-sm font-bold transition-all text-left", conditionMode === 'conditional' ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-slate-100 bg-white text-slate-500 hover:border-slate-200")}
                                            >
                                                Use only when conditions match
                                            </button>
                                        </div>

                                        {conditionMode === 'conditional' && (
                                            <div className="p-6 bg-slate-50/80 rounded-xl border border-slate-100 space-y-4">
                                                {conditions.map((cond, index) => (
                                                    <div key={index} className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                                                        <select
                                                            value={cond.group || 'AND'}
                                                            onChange={(e) => {
                                                                const newConds = [...conditions];
                                                                newConds[index].group = e.target.value as 'AND' | 'OR';
                                                                setConditions(newConds);
                                                            }}
                                                            className="h-9 px-2 text-xs font-bold rounded bg-slate-100 border-none outline-none"
                                                        >
                                                            <option value="AND">AND</option>
                                                            <option value="OR">OR</option>
                                                        </select>

                                                        {setupModule === 'proposal' ? (
                                                            <select
                                                                value={cond.field_key || ''}
                                                                onChange={(e) => {
                                                                    const newConds = [...conditions];
                                                                    newConds[index].field_key = e.target.value;
                                                                    newConds[index].display_name = e.target.options[e.target.selectedIndex].text;
                                                                    setConditions(newConds);
                                                                }}
                                                                className="h-9 px-3 text-sm rounded border border-slate-200 outline-none flex-1 min-w-[150px]"
                                                            >
                                                                <option value="">Select Field...</option>
                                                                <option value="branch">Branch</option>
                                                                <option value="business_profile">Business Profile</option>
                                                                <option value="client">Client</option>
                                                                <option value="client_type">Client Type</option>
                                                                <option value="constitution">Constitution</option>
                                                                <option value="sub_constitution">Sub Constitution</option>
                                                                <option value="work_type">Work Type</option>
                                                                <option value="department">Department</option>
                                                                <option value="category">Category</option>
                                                                <option value="total_amount">Total Amount</option>
                                                                <option value="professional_fee">Professional Fee</option>
                                                                <option value="government_fee">Government Fee</option>
                                                                <option value="state">State</option>
                                                                <option value="district">District</option>
                                                            </select>
                                                        ) : (
                                                            <Input 
                                                                placeholder="Field / Column"
                                                                value={cond.field || ''}
                                                                onChange={(e) => {
                                                                    const newConds = [...conditions];
                                                                    newConds[index].field = e.target.value;
                                                                    setConditions(newConds);
                                                                }}
                                                                className="h-9 text-sm w-32"
                                                            />
                                                        )}

                                                        <select
                                                            value={cond.operator}
                                                            onChange={(e) => {
                                                                const newConds = [...conditions];
                                                                newConds[index].operator = e.target.value;
                                                                setConditions(newConds);
                                                            }}
                                                            className="h-9 px-3 text-sm rounded border border-slate-200 outline-none min-w-[120px]"
                                                        >
                                                            <option value="equals">Equals</option>
                                                            <option value="not equals">Not Equals</option>
                                                            <option value="contains">Contains</option>
                                                            <option value="greater than">Greater Than</option>
                                                            <option value="less than">Less Than</option>
                                                            <option value="in">In</option>
                                                            <option value="between">Between</option>
                                                        </select>

                                                        <Input
                                                            placeholder="Value"
                                                            value={cond.value}
                                                            onChange={(e) => {
                                                                const newConds = [...conditions];
                                                                newConds[index].value = e.target.value;
                                                                setConditions(newConds);
                                                            }}
                                                            className="h-9 text-sm flex-1 min-w-[150px]"
                                                        />

                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            className="h-9 w-9 text-red-500 hover:bg-red-50 hover:text-red-600 ml-auto"
                                                            onClick={() => setConditions(conditions.filter((_, i) => i !== index))}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}

                                                <Button 
                                                    type="button"
                                                    variant="outline" 
                                                    onClick={() => setConditions([...conditions, { 
                                                        operator: 'equals', 
                                                        value: '', 
                                                        group: 'AND',
                                                        ...(setupModule === 'proposal' ? { field_key: '', display_name: '' } : { field: '', table: '' })
                                                    }])}
                                                    className="w-full h-11 border-dashed text-blue-600 hover:bg-blue-50 hover:text-blue-700 bg-white"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" /> Add Condition
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <Separator className="my-6" />

                                    {setupModule === 'proposal' ? (
                                        <div className="text-center space-y-6 max-w-2xl mx-auto py-10">
                                            <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Sparkles className="w-8 h-8" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">System-Generated Context</h3>
                                            <p className="text-slate-500 font-medium text-sm leading-relaxed">
                                                Proposal templates use system-generated proposal context. Field mapping is not required.
                                            </p>
                                            <div className="mt-8 text-left bg-slate-50 p-6 rounded-xl border border-slate-100">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4">Available Placeholders</h4>
                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-[11px] text-slate-600 font-mono">
                                                    <span>{`{{company_name}}`}</span>
                                                    <span>{`{{company_logo}}`}</span>
                                                    <span>{`{{company_seal}}`}</span>
                                                    <span>{`{{company_signature}}`}</span>
                                                    <span>{`{{company_address}}`}</span>
                                                    <span>{`{{company_email}}`}</span>
                                                    <span>{`{{company_phone}}`}</span>
                                                    <span>{`{{company_gstin}}`}</span>
                                                    <span>{`{{proposal_no}}`}</span>
                                                    <span>{`{{proposal_date}}`}</span>
                                                    <span>{`{{valid_until}}`}</span>
                                                    <span>{`{{branch_name}}`}</span>
                                                    <span>{`{{client_name}}`}</span>
                                                    <span>{`{{client_email}}`}</span>
                                                    <span>{`{{client_phone}}`}</span>
                                                    <span>{`{{client_gstin}}`}</span>
                                                    <span>{`{{client_address}}`}</span>
                                                    <span>{`{{professional_fee}}`}</span>
                                                    <span>{`{{government_fee}}`}</span>
                                                    <span>{`{{gst_percentage}}`}</span>
                                                    <span>{`{{gst_amount}}`}</span>
                                                    <span>{`{{total_amount}}`}</span>
                                                    <span className="font-bold text-blue-600">{`{{{work_table}}}`}</span>
                                                    <span className="font-bold text-blue-600 col-span-2">{`{{#each services}} ... {{/each}}`}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col gap-1">
                                                        <Label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                                            <Database className="h-4 w-4 text-blue-600" /> Choose Data Sources
                                                        </Label>
                                                        <p className="text-[10px] text-slate-400 font-medium">Pick the information you need for this template.</p>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-widest">{selectedTables.length} Picked</Badge>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                    {authorizedTables.length === 0 ? (
                                                        <div className="col-span-full py-12 text-center bg-white rounded-lg border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-4">
                                                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                                                                <Activity className="h-6 w-6 text-slate-200" />
                                                            </div>
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nothing to pick</p>
                                                        </div>
                                                    ) : (
                                                        authorizedTables.sort().map(table => (
                                                            <button 
                                                                key={table}
                                                        onClick={() => {
                                                            setSelectedTables(prev => 
                                                                prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
                                                            );
                                                        }}
                                                        className={cn(
                                                            "px-4 py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group",
                                                            selectedTables.includes(table) 
                                                                ? "bg-white border-blue-600 text-blue-700 shadow-md" 
                                                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-900"
                                                        )}
                                                    >
                                                        <Layers className={cn("h-5 w-5", selectedTables.includes(table) ? "text-blue-600" : "text-slate-200 group-hover:text-slate-400")} />
                                                        <span className="text-[10px] font-bold uppercase text-center leading-tight tracking-tighter">{table.replace(/_/g, ' ')}</span>
                                                        {selectedTables.includes(table) && (
                                                            <div className="absolute top-0 right-0 p-1 bg-blue-600 text-white rounded-bl-lg">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <Separator className="my-10" />

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <Label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                                    <Settings2 className="h-4 w-4 text-blue-600" /> Connect Fields
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[9px] font-black uppercase text-slate-400">
                                                        Connected: {Object.keys(mappings).length} / {templateFields.length}
                                                    </span>
                                                </div>
                                            </div>
                                            {templateFields.length > 0 && Object.keys(mappings).length === templateFields.length && (
                                                <Badge className="bg-emerald-500 text-white border-0 text-[10px] uppercase font-black px-3">Ready</Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {templateFields.length === 0 ? (
                                                <div className="py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 bg-slate-50/30">
                                                    <Search className="h-7 w-7 text-slate-300" />
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {!selectedTemplateId ? "Choose a template first" : "No fields found in this template"}
                                                    </p>
                                                </div>
                                            ) : (
                                                templateFields.map(field => {
                                                    const curMapping = mappings[field] || { table: '', field: '' };
                                                    const fieldsInTable = curMapping.table ? (dataList[curMapping.table] || []) : [];
                                                    const ready = curMapping.table && curMapping.field;

                                                    return (
                                                        <div key={field} className={cn(
                                                            "p-4 rounded-2xl border-2 transition-all grid grid-cols-1 md:grid-cols-4 items-center gap-4 group",
                                                            ready ? "bg-white border-slate-100" : "bg-white border-amber-100"
                                                        )}>
                                                            <div className="flex items-center gap-3 md:col-span-1">
                                                                <div className={cn(
                                                                    "h-6 w-6 flex items-center justify-center rounded-lg text-[10px] font-black",
                                                                    ready ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                                                )}>
                                                                    {ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                                </div>
                                                                <div className="truncate">
                                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">In Template</p>
                                                                    <p className="font-mono text-xs font-bold text-slate-700 truncate">{'{{' + field + '}}'}</p>
                                                                </div>
                                                            </div>

                                                            <div className="md:col-span-1">
                                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Look in table</p>
                                                                <select 
                                                                    value={curMapping.table}
                                                                    onChange={(e) => updateMapping(field, e.target.value, '')}
                                                                    className="w-full h-9 px-2 rounded-lg border bg-slate-50/50 text-[10px] font-bold uppercase transition-all outline-none"
                                                                >
                                                                    <option value="">Select Table...</option>
                                                                    {selectedTables.length === 0 ? (
                                                                        <option disabled>Pick data first ▲</option>
                                                                    ) : (
                                                                        selectedTables.sort().map(t => (
                                                                            <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>
                                                                        ))
                                                                    )}
                                                                </select>
                                                            </div>

                                                            <div className="md:col-span-1">
                                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Pick field</p>
                                                                <select 
                                                                    value={curMapping.field}
                                                                    disabled={!curMapping.table}
                                                                    onChange={(e) => updateMapping(field, curMapping.table, e.target.value)}
                                                                    className="w-full h-9 px-2 rounded-lg border bg-slate-50/50 text-[10px] font-bold uppercase transition-all outline-none disabled:opacity-50"
                                                                >
                                                                    <option value="">Select Field...</option>
                                                                    {fieldsInTable.sort().map(f => (
                                                                        <option key={f} value={f}>{f.replace(/_/g, ' ').toUpperCase()}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="md:col-span-1 flex justify-end">
                                                                {ready && (
                                                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-emerald-100 text-emerald-500 bg-emerald-50/50">Linked</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                            
                                            <Separator className="my-10" />
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="rounded-xl border-slate-200 shadow-sm bg-slate-900 text-white overflow-hidden">
                                <CardHeader className="bg-white/5 border-b border-white/5 p-6 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                                            <Filter className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-white">Add Conditions</CardTitle>
                                            <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-widest">When to use this setup</CardDescription>
                                        </div>
                                    </div>
                                    <Button onClick={addCondition} variant="outline" className="h-10 px-4 border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold tracking-widest uppercase text-[10px]">
                                        <Plus className="h-4 w-4 mr-2" /> New Condition
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6 min-h-[150px]">
                                    {conditions.map((condition, idx) => (
                                        <div key={idx} className="grid grid-cols-1 md:flex md:items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                            <div className="h-8 w-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-xs shrink-0">
                                                {idx + 1}
                                            </div>
                                            
                                            <select 
                                                value={condition.table} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const next = [...conditions];
                                                    next[idx].table = val;
                                                    next[idx].field = (dataList[val]?.[0] || '');
                                                    setConditions(next);
                                                }}
                                                className="h-10 bg-slate-800 border-white/10 rounded-md text-[10px] font-bold uppercase px-3 text-white outline-none"
                                            >
                                                {selectedTables.sort().map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                                            </select>
                                            
                                            <select 
                                                value={condition.field} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const next = [...conditions];
                                                    next[idx].field = val;
                                                    setConditions(next);
                                                }}
                                                className="h-10 bg-slate-800 border-white/10 rounded-md text-[10px] font-bold uppercase px-3 text-white outline-none"
                                            >
                                                {(condition.table ? dataList[condition.table] : undefined)?.sort().map((f: string) => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
                                            </select>

                                            <select 
                                                value={condition.operator} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const next = [...conditions];
                                                    next[idx].operator = val;
                                                    setConditions(next);
                                                }}
                                                className="h-10 bg-slate-800 border-white/10 rounded-md text-[10px] font-bold uppercase px-3 text-white outline-none"
                                            >
                                                {OPERATORS.map(op => <option key={op.value} value={op.value} className="bg-slate-900">{op.label}</option>)}
                                            </select>

                                            <Input 
                                                value={condition.value} 
                                                onChange={e => {
                                                    const next = [...conditions];
                                                    next[idx].value = e.target.value;
                                                    setConditions(next);
                                                }}
                                                placeholder="VALUE..." 
                                                className="h-10 bg-slate-800 border-white/10 rounded-md text-[11px] font-bold px-3 text-white placeholder:text-slate-600"
                                            />

                                            <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} className="h-10 w-10 text-red-400 hover:text-red-500 hover:bg-red-500/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {conditions.length === 0 && (
                                        <div className="py-12 flex flex-col items-center justify-center opacity-30 border border-dashed border-white/5 rounded-xl">
                                            <p className="text-[10px] font-black uppercase tracking-widest">No conditions added yet</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6 lg:sticky lg:top-24">
                            <Card className="rounded-xl border-slate-200 shadow-xl bg-white p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-1.5 w-8 bg-blue-600 rounded-full" />
                                        <h4 className="text-[10px] font-bold uppercase text-slate-900 tracking-widest">Summary</h4>
                                    </div>
                                    <div className="space-y-3">
                                        <Metric label="Data Sources" value={selectedTables.length} />
                                        <Metric label="Connected" value={Object.keys(mappings).length} />
                                        <Metric label="Conditions" value={conditions.length} />
                                    </div>
                                </div>
                                
                                <Separator className="bg-slate-50" />
                                
                                <div className="space-y-3 pt-6">
                                    <Button onClick={handleSave} disabled={saving} className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-blue-600/10 transition-all active:scale-95">
                                        {saving ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save'}
                                    </Button>
                                    <Button onClick={() => { setIsFormOpen(false); resetForm(); }} variant="ghost" className="w-full h-12 rounded-xl text-slate-400 hover:text-slate-900 font-bold uppercase tracking-widest text-[10px]">
                                        Wait, Go Back
                                    </Button>
                                </div>
                                
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden group">
                                    <ShieldCheck className="absolute -right-6 -bottom-6 h-24 w-24 text-slate-200/50 -rotate-12 transition-transform duration-700 group-hover:rotate-0" />
                                    <div className="relative z-10 flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20">
                                            <Lock className="h-4 w-4 text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <h5 className="text-[10px] font-bold text-slate-900 uppercase">Secure</h5>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                                                Your settings are safe and private.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="rounded-xl border-slate-200 bg-white p-6 shadow-sm border-dashed text-center space-y-4 hover:border-blue-300 transition-colors cursor-pointer group" onClick={fetchData}>
                                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto group-hover:bg-blue-50 transition-colors">
                                    <RefreshCw className="h-5 w-5 text-slate-300 group-hover:text-blue-500 group-hover:rotate-180 transition-all duration-700" />
                                </div>
                                <div className="space-y-1">
                                    <h6 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Update Data</h6>
                                    <p className="text-[10px] text-slate-400 font-medium italic italic">Get the latest choices</p>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete your setup. You cannot undo this.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIdToDelete(null)}>No, Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Yes, Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
    return (
        <Card className="rounded-xl border-slate-200 shadow-sm p-5 flex items-center gap-4 bg-white hover:bg-slate-50/50 transition-colors group">
            <div className="h-10 w-10 rounded-lg bg-slate-50 group-hover:bg-white text-slate-400 group-hover:text-blue-600 flex items-center justify-center shrink-0 border border-slate-100 transition-colors shadow-sm">
                <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
                <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest leading-none">{label}</p>
                <h4 className="text-xl font-bold text-slate-950 leading-none">{value}</h4>
            </div>
        </Card>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between py-3 px-4 bg-slate-50/50 rounded-xl border border-slate-100 transition-colors hover:bg-slate-50 group">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-900">{label}</span>
            <span className="text-xl font-black text-slate-950 tracking-tighter transition-all group-hover:scale-110 group-hover:text-blue-600">{value}</span>
        </div>
    );
}

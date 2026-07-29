'use client';

import React, { useState, useEffect } from 'react';
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { Loader2, PlusCircle, Trash2, Edit, Check, Star, History, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';

// --- Generic CRUD Component for Basic Masters ---
function GenericMasterTab({
    title, dbPath, data, onSave, onDelete, onSetDefault, canEdit
}: {
    title: string; dbPath: string; data: any[];
    onSave: (id: string | null, payload: any) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onSetDefault: (id: string) => Promise<void>;
    canEdit: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [extraNum, setExtraNum] = useState('');

    const isValidity = dbPath === 'dscValidities';

    const handleSave = async () => {
        if (!name) return;
        const payload: any = { name, isDefault: data.length === 0 };
        if (isValidity) payload.years = parseInt(extraNum) || 1;

        await onSave(editingId, payload);
        setIsOpen(false);
        setEditingId(null);
        setName('');
        setExtraNum('');
    };

    const openEdit = (item: any) => {
        setEditingId(item.id);
        setName(item.name);
        if (isValidity) setExtraNum(item.years?.toString() || '1');
        setIsOpen(true);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>{title}</CardTitle><CardDescription>Manage {title.toLowerCase()}</CardDescription></div>
                {canEdit && <Button onClick={() => { setEditingId(null); setName(''); setExtraNum(''); setIsOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New
                </Button>}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            {isValidity && <TableHead>Years</TableHead>}
                            <TableHead>Status</TableHead>
                            {canEdit && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                {isValidity && <TableCell>{item.years}</TableCell>}
                                <TableCell>
                                    {item.isDefault ? (
                                        <span className="flex items-center text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md w-fit"><Star className="w-3 h-3 mr-1 fill-amber-500" /> Default</span>
                                    ) : canEdit && (
                                        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => onSetDefault(item.id)}>Make Default</Button>
                                    )}
                                </TableCell>
                                {canEdit && <TableCell className="text-right space-x-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                        {data.length === 0 && <TableRow><TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground">No records found.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? `Editing "${title}"` : `Adding New ${title}`}</DialogTitle>
                        <DialogDescription>{editingId ? 'Update the details of this item.' : `Enter the details for ${title}.`}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={`e.g. ${title === 'Classes' ? 'Class 3' : 'Individual'}`} /></div>
                        {isValidity && <div className="space-y-2"><Label>Validity (Years)</Label><Input type="number" value={extraNum} onChange={e => setExtraNum(e.target.value)} /></div>}
                    </div>
                    <DialogFooter><Button onClick={handleSave}>Save Config</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

export function DSCMasters() {
    const { isSuperAdmin, hasRole, userProfile } = usePermissions();
    // Assuming 'Admin' or 'DSC_Admin' roles can modify
    const canEdit = !!(isSuperAdmin || hasRole('Admin') || hasRole('ADMIN') || hasRole('DSC_Admin'));

    const [classes, setClasses] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [validities, setValidities] = useState<any[]>([]);
    const [authorities, setAuthorities] = useState<any[]>([]);
    const [rates, setRates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const logAudit = async (action: string, entity: string, details: any) => {
        if (!userProfile) return;
        try {
            await supabase.from('dsc_audit_logs').insert({
                action, entity, details, user_email: userProfile.email
            });
        } catch (e) {
            console.error("Audit fail", e);
        }
    };

    const loadMasters = async () => {
        setIsLoading(true);
        const mapData = (res: any) => res.data?.map((i: any) => ({ ...i, isDefault: i.is_default, isDeleted: i.is_deleted })) || [];
        const [cls, typ, val, auth, rateData] = await Promise.all([
            supabase.from('dsc_classes').select('*'),
            supabase.from('dsc_types').select('*'),
            supabase.from('dsc_validities').select('*'),
            supabase.from('dsc_authorities').select('*'),
            supabase.from('dsc_rates').select('*')
        ]);

        setClasses(mapData(cls).filter((x: any) => !x.isDeleted));
        setTypes(mapData(typ).filter((x: any) => !x.isDeleted));
        setValidities(mapData(val).filter((x: any) => !x.isDeleted));
        setAuthorities(mapData(auth).filter((x: any) => !x.isDeleted));

        const mappedRates = (rateData.data || []).map(r => ({
            id: r.id, classId: r.class_id, typeId: r.type_id, validityId: r.validity_id, authorityId: r.authority_id,
            baseAmount: r.base_amount, gstPercentage: r.gst_percentage, totalAmount: r.total_amount,
            applicableFrom: r.applicable_from, isDeleted: r.is_deleted, updatedAt: r.updated_at
        }));
        setRates(mappedRates);
        setIsLoading(false);
    };

    useEffect(() => { loadMasters(); }, []);

    const getTableName = (path: string) => {
        const maps: any = { dscClasses: 'dsc_classes', dscTypes: 'dsc_types', dscValidities: 'dsc_validities', dscAuthorities: 'dsc_authorities' };
        return maps[path];
    };

    const handleSaveBasic = async (path: string, id: string | null, payload: any) => {
        if (!canEdit) return;
        const tableName = getTableName(path);
        const transformed: any = { name: payload.name, is_default: payload.isDefault };
        if (payload.years) transformed.years = payload.years;

        if (id) {
            await supabase.from(tableName).update(transformed).eq('id', id);
            await logAudit('EDIT', path, { id, payload });
        } else {
            const { data } = await supabase.from(tableName).insert(transformed).select('id').single();
            await logAudit('CREATE', path, { id: data?.id, payload });
        }
        loadMasters();
    };

    const handleDeleteBasic = async (path: string, id: string) => {
        if (!canEdit) return;
        if (confirm("Are you sure? This will soft delete the configuration.")) {
            await supabase.from(getTableName(path)).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
            await logAudit('SOFT_DELETE', path, { id });
            loadMasters();
        }
    };

    const handleSetDefault = async (path: string, data: any[], idToSet: string) => {
        if (!canEdit) return;
        const tableName = getTableName(path);
        // Turn off all defaults
        await supabase.from(tableName).update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        // Set the new default
        await supabase.from(tableName).update({ is_default: true }).eq('id', idToSet);

        await logAudit('SET_DEFAULT', path, { id: idToSet });
        loadMasters();
    };

    // --- Rates Logic ---
    const [isRateOpen, setIsRateOpen] = useState(false);
    const [rateHistoryOpen, setRateHistoryOpen] = useState(false);
    const [historyFilter, setHistoryFilter] = useState({ classId: '', typeId: '', validityId: '', authorityId: '' });
    const [rateForm, setRateForm] = useState({ classId: '', typeId: '', validityId: '', authorityId: '', baseAmount: 0, gstPercentage: 18, applicableFrom: new Date().toISOString().split('T')[0], id: null as string | null });

    // Active rates are rates not marked as deleted, but since rates can have multiple effective dates for same combo,
    // we should group them or just list them all out. For simplicity, we just show all active rate definitions.
    const activeRates = rates.filter(r => !r.isDeleted);

    const handleSaveRate = async () => {
        if (!canEdit) return;
        if (!rateForm.classId || !rateForm.typeId || !rateForm.validityId || !rateForm.authorityId) return alert("Select all dropdowns");
        const total = rateForm.baseAmount + (rateForm.baseAmount * rateForm.gstPercentage / 100);

        const payload: any = {
            class_id: rateForm.classId, type_id: rateForm.typeId, validity_id: rateForm.validityId, authority_id: rateForm.authorityId,
            base_amount: rateForm.baseAmount, gst_percentage: rateForm.gstPercentage, applicable_from: rateForm.applicableFrom,
            total_amount: total, updated_at: new Date().toISOString()
        };

        if (rateForm.id) {
            await supabase.from('dsc_rates').update(payload).eq('id', rateForm.id);
            await logAudit('EDIT_RATE', 'dsc_rates', { id: rateForm.id, payload });
        } else {
            const { data } = await supabase.from('dsc_rates').insert(payload).select('id').single();
            await logAudit('CREATE_RATE', 'dsc_rates', { id: data?.id, payload });
        }
        setIsRateOpen(false);
        setRateForm({ classId: '', typeId: '', validityId: '', authorityId: '', baseAmount: 0, gstPercentage: 18, applicableFrom: new Date().toISOString().split('T')[0], id: null });
        loadMasters();
    };

    const handleDeleteRate = async (id: string) => {
        if (!canEdit) return;
        if (confirm("Soft delete this rate entry?")) {
            await supabase.from('dsc_rates').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
            await logAudit('DELETE_RATE', 'dsc_rates', { id });
            loadMasters();
        }
    };

    const openRateHistory = (r: any) => {
        setHistoryFilter({ classId: r.classId, typeId: r.typeId, validityId: r.validityId, authorityId: r.authorityId });
        setRateHistoryOpen(true);
    };

    return (
        <div className="space-y-6">
            {!canEdit && (
                <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-amber-800 flex items-center text-sm">
                    <ShieldAlert className="w-4 h-4 mr-2" /> You are in view-only mode. Administrator privileges are required to modify these configurations.
                </div>
            )}
            <Tabs defaultValue="classes" className="w-full">
                <TabsList className="mb-4 flex flex-wrap gap-2 h-auto">
                    <TabsTrigger value="classes">Classes</TabsTrigger>
                    <TabsTrigger value="types">Types</TabsTrigger>
                    <TabsTrigger value="validities">Validities</TabsTrigger>
                    <TabsTrigger value="authorities">Certifying Auth</TabsTrigger>
                    <TabsTrigger value="rates">Rates Config</TabsTrigger>
                    <TabsTrigger value="stages">Stages / Checklists</TabsTrigger>
                </TabsList>

                <TabsContent value="classes"><GenericMasterTab canEdit={canEdit} title="Classes" dbPath="dscClasses" data={classes} onSave={(i, p) => handleSaveBasic('dscClasses', i, p)} onDelete={i => handleDeleteBasic('dscClasses', i)} onSetDefault={i => handleSetDefault('dscClasses', classes, i)} /></TabsContent>
                <TabsContent value="types"><GenericMasterTab canEdit={canEdit} title="Types of DSC" dbPath="dscTypes" data={types} onSave={(i, p) => handleSaveBasic('dscTypes', i, p)} onDelete={i => handleDeleteBasic('dscTypes', i)} onSetDefault={i => handleSetDefault('dscTypes', types, i)} /></TabsContent>
                <TabsContent value="validities"><GenericMasterTab canEdit={canEdit} title="Validities" dbPath="dscValidities" data={validities} onSave={(i, p) => handleSaveBasic('dscValidities', i, p)} onDelete={i => handleDeleteBasic('dscValidities', i)} onSetDefault={i => handleSetDefault('dscValidities', validities, i)} /></TabsContent>
                <TabsContent value="authorities"><GenericMasterTab canEdit={canEdit} title="Certifying Authorities" dbPath="dscAuthorities" data={authorities} onSave={(i, p) => handleSaveBasic('dscAuthorities', i, p)} onDelete={i => handleDeleteBasic('dscAuthorities', i)} onSetDefault={i => handleSetDefault('dscAuthorities', authorities, i)} /></TabsContent>

                <TabsContent value="rates">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div><CardTitle>Rates Configuration</CardTitle><CardDescription>Define pricing for combinations</CardDescription></div>
                            {canEdit && <Button onClick={() => { setRateForm({ classId: '', typeId: '', validityId: '', authorityId: '', baseAmount: 0, gstPercentage: 18, applicableFrom: new Date().toISOString().split('T')[0], id: null }); setIsRateOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Rate</Button>}
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Combination</TableHead>
                                        <TableHead>Effective From</TableHead>
                                        <TableHead>Base (₹)</TableHead>
                                        <TableHead>GST</TableHead>
                                        <TableHead>Total (₹)</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeRates.sort((a, b) => new Date(b.applicableFrom).getTime() - new Date(a.applicableFrom).getTime()).map(r => (
                                        <TableRow key={r.id}>
                                            <TableCell>
                                                <div className="text-xs font-medium space-y-1">
                                                    <div><span className="text-slate-500">Class:</span> {classes.find(x => x.id === r.classId)?.name}</div>
                                                    <div><span className="text-slate-500">Type:</span> {types.find(x => x.id === r.typeId)?.name}</div>
                                                    <div><span className="text-slate-500">Validity:</span> {validities.find(x => x.id === r.validityId)?.name}</div>
                                                    <div><span className="text-slate-500">Auth:</span> {authorities.find(x => x.id === r.authorityId)?.name}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{r.applicableFrom}</TableCell>
                                            <TableCell>{r.baseAmount}</TableCell>
                                            <TableCell>{r.gstPercentage}% ({(r.totalAmount - r.baseAmount).toFixed(2)})</TableCell>
                                            <TableCell className="font-bold text-sky-700">{r.totalAmount}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="outline" size="sm" onClick={() => openRateHistory(r)}><History className="h-3 w-3 mr-1" /> History</Button>
                                                {canEdit && <Button variant="ghost" size="icon" onClick={() => { setRateForm(r as any); setIsRateOpen(true); }}><Edit className="h-4 w-4" /></Button>}
                                                {canEdit && <Button variant="ghost" size="icon" onClick={() => handleDeleteRate(r.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {activeRates.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No rate configs found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>

                        <Dialog open={isRateOpen} onOpenChange={setIsRateOpen}>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>{rateForm.id ? `Editing "Rate Configuration"` : 'Adding New Rate Configuration'}</DialogTitle>
                                    <DialogDescription>{rateForm.id ? 'Update the details of this item.' : 'Enter the details for Rate Configuration.'}</DialogDescription>
                                </DialogHeader>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Class</Label><Select value={rateForm.classId} onValueChange={v => setRateForm({ ...rateForm, classId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Type</Label><Select value={rateForm.typeId} onValueChange={v => setRateForm({ ...rateForm, typeId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{types.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Validity</Label><Select value={rateForm.validityId} onValueChange={v => setRateForm({ ...rateForm, validityId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{validities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Authority</Label><Select value={rateForm.authorityId} onValueChange={v => setRateForm({ ...rateForm, authorityId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{authorities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Base Amount (₹)</Label><Input type="number" value={rateForm.baseAmount || ''} onChange={e => setRateForm({ ...rateForm, baseAmount: parseFloat(e.target.value) || 0 })} /></div>
                                    <div className="space-y-2"><Label>GST (%)</Label><Input type="number" value={rateForm.gstPercentage || ''} onChange={e => setRateForm({ ...rateForm, gstPercentage: parseFloat(e.target.value) || 0 })} /></div>
                                    <div className="space-y-2"><Label>Effective From Date</Label><Input type="date" value={rateForm.applicableFrom} onChange={e => setRateForm({ ...rateForm, applicableFrom: e.target.value })} /></div>
                                    <div className="space-y-2"><Label>Total Amount (Auto-calc)</Label><Input readOnly value={rateForm.baseAmount + (rateForm.baseAmount * rateForm.gstPercentage / 100)} className="bg-slate-50 font-bold" /></div>
                                </div>
                                <DialogFooter><Button onClick={handleSaveRate}>Save Rate</Button></DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={rateHistoryOpen} onOpenChange={setRateHistoryOpen}>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>Rate Change History</DialogTitle><DialogDescription>View the details of this item.</DialogDescription></DialogHeader>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Effective Date</TableHead><TableHead>Base</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {rates.filter(x => x.classId === historyFilter.classId && x.typeId === historyFilter.typeId && x.validityId === historyFilter.validityId && x.authorityId === historyFilter.authorityId)
                                            .sort((a, b) => new Date(b.applicableFrom).getTime() - new Date(a.applicableFrom).getTime())
                                            .map(r => (
                                                <TableRow key={r.id} className={r.isDeleted ? 'opacity-50' : ''}>
                                                    <TableCell className="font-medium">{r.applicableFrom}</TableCell>
                                                    <TableCell>₹{r.baseAmount}</TableCell>
                                                    <TableCell>₹{r.totalAmount}</TableCell>
                                                    <TableCell>{r.isDeleted ? <span className="text-red-500">Deleted</span> : <span className="text-green-600">Active</span>}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </DialogContent>
                        </Dialog>
                    </Card>
                </TabsContent>

                <TabsContent value="stages">
                    <DSCStagesConfig canEdit={canEdit} logAudit={logAudit} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// --- Stages Config Component ---
function DSCStagesConfig({ canEdit, logAudit }: { canEdit: boolean; logAudit: any }) {
    const [stages, setStages] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<any | null>(null);

    const loadStages = async () => {
        const { data } = await supabase.from('dsc_workflow_stages').select('*').eq('is_deleted', false).order('order', { ascending: true });
        if (data) {
            setStages(data.map(s => ({
                id: s.id, name: s.name, order: s.order, description: s.description,
                completionPercentage: s.completion_percentage, checklistItems: s.checklist_items || [],
                requiredFields: s.required_fields || [], documents: s.documents || []
            })));
        } else {
            setStages([]);
        }
    };

    useEffect(() => { loadStages(); }, []);

    const handleSaveStage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;
        const payload: any = {
            name: editingStage.name, order: editingStage.order,
            completion_percentage: editingStage.completionPercentage,
            checklist_items: editingStage.checklistItems,
            required_fields: editingStage.requiredFields, documents: editingStage.documents
        };

        if (editingStage.id) {
            await supabase.from('dsc_workflow_stages').update(payload).eq('id', editingStage.id);
            await logAudit('EDIT_STAGE_CONFIG', 'dsc_workflow_stages', { id: editingStage.id, payload });
        } else {
            const { data } = await supabase.from('dsc_workflow_stages').insert(payload).select('id').single();
            await logAudit('ADD_STAGE_CONFIG', 'dsc_workflow_stages', { id: data?.id, payload });
        }
        setIsOpen(false);
        setEditingStage(null);
        loadStages();
    };

    const deleteStage = async (id: string) => {
        if (!canEdit) return;
        if (confirm("Delete this stage?")) {
            await supabase.from('dsc_workflow_stages').update({ is_deleted: true }).eq('id', id);
            await logAudit('DELETE_STAGE_CONFIG', 'dsc_workflow_stages', { id });
            loadStages();
        }
    };

    const openNew = () => {
        setEditingStage({
            name: '', completionPercentage: 0, order: stages.length + 1,
            checklistItems: [], requiredFields: [], documents: [], id: null
        });
        setIsOpen(true);
    };

    const updateChecklist = (list: any[]) => setEditingStage({ ...editingStage, checklistItems: list });
    const updateFields = (list: any[]) => setEditingStage({ ...editingStage, requiredFields: list });
    const updateDocs = (list: any[]) => setEditingStage({ ...editingStage, documents: list });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Process Stages Config</CardTitle><CardDescription>Manage execution steps, fields, and doc requirements</CardDescription></div>
                {canEdit && <Button onClick={openNew}><PlusCircle className="mr-2 h-4 w-4" /> Add Stage</Button>}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Name</TableHead><TableHead>%</TableHead><TableHead>Requirements</TableHead>{canEdit && <TableHead className="text-right">Action</TableHead>}</TableRow></TableHeader>
                    <TableBody>
                        {stages.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="font-bold">{s.order}</TableCell>
                                <TableCell>{s.name}</TableCell>
                                <TableCell>{s.completionPercentage}%</TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-pre-wrap">
                                    {s.checklistItems?.length || 0} Checks, {s.requiredFields?.length || 0} Fields, {s.documents?.length || 0} Docs
                                </TableCell>
                                {canEdit && <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingStage(s); setIsOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteStage(s.id)}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingStage?.id ? `Editing "${editingStage.name || 'Stage'}"` : 'Adding New Stage'}</DialogTitle>
                        <DialogDescription>{editingStage?.id ? 'Update the details of this item.' : 'Enter the details for Stage.'}</DialogDescription>
                    </DialogHeader>
                    {editingStage && (
                        <form onSubmit={handleSaveStage} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Stage Name</Label><Input required value={editingStage.name} onChange={e => setEditingStage({ ...editingStage, name: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Completion %</Label><Input type="number" required value={editingStage.completionPercentage} onChange={e => setEditingStage({ ...editingStage, completionPercentage: parseInt(e.target.value) || 0 })} /></div>
                                <div className="space-y-2"><Label>Order</Label><Input type="number" required value={editingStage.order} onChange={e => setEditingStage({ ...editingStage, order: parseInt(e.target.value) || 0 })} /></div>
                            </div>

                            <Card className="p-4 bg-slate-50"><div className="space-y-4">
                                <h4 className="font-semibold text-sm">Checklist Items</h4>
                                <div className="space-y-2">
                                    {(editingStage.checklistItems || []).map((chk: any, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <Input value={chk.text} onChange={e => { const l = [...editingStage.checklistItems]; l[i].text = e.target.value; updateChecklist(l); }} />
                                            <Button type="button" variant="ghost" className="text-red-500" onClick={() => updateChecklist(editingStage.checklistItems.filter((_: any, x: number) => x !== i))}><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={() => updateChecklist([...(editingStage.checklistItems || []), { id: Date.now().toString(), text: '' }])}>+ Add Checklist</Button>
                            </div></Card>

                            <Card className="p-4 bg-slate-50"><div className="space-y-4">
                                <h4 className="font-semibold text-sm">Required Fields</h4>
                                <div className="space-y-2">
                                    {(editingStage.requiredFields || []).map((fld: any, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <Input value={fld.label} placeholder="Field Label" onChange={e => { const l = [...editingStage.requiredFields]; l[i].label = e.target.value; updateFields(l); }} />
                                            <Select value={fld.type} onValueChange={v => { const l = [...editingStage.requiredFields]; l[i].type = v; updateFields(l); }}>
                                                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="date">Date</SelectItem><SelectItem value="number">Number</SelectItem></SelectContent>
                                            </Select>
                                            <Button type="button" variant="ghost" className="text-red-500" onClick={() => updateFields(editingStage.requiredFields.filter((_: any, x: number) => x !== i))}><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={() => updateFields([...(editingStage.requiredFields || []), { id: Date.now().toString(), label: '', type: 'text' }])}>+ Add Field</Button>
                            </div></Card>

                            <Card className="p-4 bg-slate-50"><div className="space-y-4">
                                <h4 className="font-semibold text-sm">Document Uploads</h4>
                                <div className="space-y-2">
                                    {(editingStage.documents || []).map((doc: any, i: number) => (
                                        <div key={i} className="border p-4 bg-white rounded-md grid grid-cols-2 gap-4 relative">
                                            <Button type="button" variant="ghost" className="text-red-500 absolute top-2 right-2" onClick={() => updateDocs(editingStage.documents.filter((_: any, x: number) => x !== i))}><Trash2 className="w-4 h-4" /></Button>
                                            <div className="space-y-2"><Label>Doc Name</Label><Input value={doc.name} onChange={e => { const l = [...editingStage.documents]; l[i].name = e.target.value; updateDocs(l); }} /></div>
                                            <div className="space-y-2"><Label>Allowed Formats</Label><Input value={doc.allowedFormats} placeholder=".pdf,.jpg" onChange={e => { const l = [...editingStage.documents]; l[i].allowedFormats = e.target.value; updateDocs(l); }} /></div>
                                            <div className="space-y-2"><Label>Mandatory</Label><Select value={doc.isMandatory.toString()} onValueChange={v => { const l = [...editingStage.documents]; l[i].isMandatory = v === 'true'; updateDocs(l); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select></div>
                                            <div className="space-y-2"><Label>Allow Multiple</Label><Select value={doc.allowMultiple.toString()} onValueChange={v => { const l = [...editingStage.documents]; l[i].allowMultiple = v === 'true'; updateDocs(l); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select></div>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={() => updateDocs([...(editingStage.documents || []), { id: Date.now().toString(), name: '', isMandatory: true, allowedFormats: '.pdf,.jpeg,.png', allowMultiple: false }])}>+ Add Document</Button>
                            </div></Card>

                            <DialogFooter><Button type="submit">Save Stage</Button></DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}

'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDSCMasters } from '@/hooks/use-dsc-masters';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Edit, Plus, FileText, CheckSquare, Clock, List, IndianRupee } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function DSCMasters() {
    return (
        <Tabs defaultValue="usage" className="w-full space-y-6">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-2">
                <TabsTrigger
                    value="usage"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 h-auto gap-2"
                >
                    <FileText className="w-4 h-4" />
                    Usage Types
                </TabsTrigger>
                <TabsTrigger
                    value="purpose"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 h-auto gap-2"
                >
                    <CheckSquare className="w-4 h-4" />
                    Purpose Types
                </TabsTrigger>
                <TabsTrigger
                    value="validity"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 h-auto gap-2"
                >
                    <Clock className="w-4 h-4" />
                    Validity
                </TabsTrigger>
                <TabsTrigger
                    value="fields"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 h-auto gap-2"
                >
                    <List className="w-4 h-4" />
                    Form Fields
                </TabsTrigger>
                <TabsTrigger
                    value="pricing"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 h-auto gap-2 ml-auto"
                >
                    <IndianRupee className="w-4 h-4" />
                    Pricing Matrix
                </TabsTrigger>
            </TabsList>

            <TabsContent value="usage" className="mt-0">
                <UsageTypeMaster />
            </TabsContent>

            <TabsContent value="purpose" className="mt-0">
                <PurposeTypeMaster />
            </TabsContent>

            <TabsContent value="validity" className="mt-0">
                <ValidityMaster />
            </TabsContent>

            <TabsContent value="fields" className="mt-0">
                <FieldsMaster />
            </TabsContent>

            <TabsContent value="pricing" className="mt-0">
                <PricingMaster />
            </TabsContent>
        </Tabs>
    );
}

// --- Sub-components for each master ---

function UsageTypeMaster() {
    const { usageTypes, refetch } = useDSCMasters();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', sortOrder: 0, isActive: true });
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            const data = {
                name: formData.name,
                sort_order: Number(formData.sortOrder),
                is_active: formData.isActive,
            };

            if (editingId) {
                const { error } = await supabase.from('dsc_types').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('dsc_types').insert([data]);
                if (error) throw error;
            }
            await refetch();
            toast({ title: 'Success', description: editingId ? 'Updated usage type.' : 'Added usage type.' });
            setIsOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setFormData({ name: item.name, sortOrder: item.sortOrder || 0, isActive: item.isActive !== false });
        setIsOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ name: '', sortOrder: 0, isActive: true });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Usage Types</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}><Plus className="w-4 h-4 mr-2" /> Add New</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">{editingId ? 'Edit' : 'Add'} Usage Type</DialogTitle></DialogHeader>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Sort Order</Label>
                                <Input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch checked={formData.isActive} onCheckedChange={c => setFormData({ ...formData, isActive: c })} />
                                <Label>Active</Label>
                            </div>
                        </div>
                        <div className="border-t p-6 pt-4 shrink-0 flex">
                            <Button onClick={handleSave} className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20">Save</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Sort Order</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {usageTypes.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.sortOrder}</TableCell>
                                <TableCell>{item.isActive !== false ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function PurposeTypeMaster() {
    const { purposeTypes, refetch } = useDSCMasters();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', sortOrder: 0, isActive: true });
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            const data = {
                name: formData.name,
                sort_order: Number(formData.sortOrder),
                is_active: formData.isActive,
            };

            if (editingId) {
                const { error } = await supabase.from('dsc_authorities').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('dsc_authorities').insert([data]);
                if (error) throw error;
            }
            await refetch();
            toast({ title: 'Success', description: editingId ? 'Updated purpose type.' : 'Added purpose type.' });
            setIsOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setFormData({ name: item.name, sortOrder: item.sortOrder || 0, isActive: item.isActive !== false });
        setIsOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ name: '', sortOrder: 0, isActive: true });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Purpose Types</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}><Plus className="w-4 h-4 mr-2" /> Add New</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">{editingId ? 'Edit' : 'Add'} Purpose Type</DialogTitle></DialogHeader>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Sort Order</Label>
                                <Input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch checked={formData.isActive} onCheckedChange={c => setFormData({ ...formData, isActive: c })} />
                                <Label>Active</Label>
                            </div>
                        </div>
                        <div className="border-t p-6 pt-4 shrink-0 flex">
                            <Button onClick={handleSave} className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20">Save</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Sort Order</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purposeTypes.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.sortOrder}</TableCell>
                                <TableCell>{item.isActive !== false ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function ValidityMaster() {
    const { validities, refetch } = useDSCMasters();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ label: '', years: 1, sortOrder: 0, isActive: true });
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            const data = {
                name: formData.label,
                years: Number(formData.years),
                sort_order: Number(formData.sortOrder),
                is_active: formData.isActive,
            };

            if (editingId) {
                const { error } = await supabase.from('dsc_validities').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('dsc_validities').insert([data]);
                if (error) throw error;
            }
            await refetch();
            toast({ title: 'Success', description: editingId ? 'Updated validity.' : 'Added validity.' });
            setIsOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setFormData({ label: item.label, years: item.years, sortOrder: item.sortOrder || 0, isActive: item.isActive !== false });
        setIsOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ label: '', years: 1, sortOrder: 0, isActive: true });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Validity Options</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}><Plus className="w-4 h-4 mr-2" /> Add New</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">{editingId ? 'Edit' : 'Add'} Validity</DialogTitle></DialogHeader>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Label (e.g. "1 Year")</Label>
                                <Input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Years</Label>
                                <Input type="number" value={formData.years} onChange={e => setFormData({ ...formData, years: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Sort Order</Label>
                                <Input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch checked={formData.isActive} onCheckedChange={c => setFormData({ ...formData, isActive: c })} />
                                <Label>Active</Label>
                            </div>
                        </div>
                        <div className="border-t p-6 pt-4 shrink-0 flex">
                            <Button onClick={handleSave} className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20">Save</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead>Years</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {validities.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.label}</TableCell>
                                <TableCell>{item.years}</TableCell>
                                <TableCell>{item.isActive !== false ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function FieldsMaster() {
    const { fields, refetch } = useDSCMasters();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ fieldKey: '', label: '', fieldType: 'text', requiredDefault: false, isActive: true });
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            const data = {
                field_key: formData.fieldKey,
                label: formData.label,
                field_type: formData.fieldType,
                required_default: formData.requiredDefault,
                is_active: formData.isActive,
            };

            if (editingId) {
                const { error } = await supabase.from('dsc_form_fields').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('dsc_form_fields').insert([data]);
                if (error) throw error;
            }
            await refetch();
            toast({ title: 'Success', description: editingId ? 'Updated field.' : 'Added field.' });
            setIsOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setFormData({
            fieldKey: item.fieldKey,
            label: item.label,
            fieldType: item.fieldType,
            requiredDefault: item.requiredDefault || false,
            isActive: item.isActive !== false
        });
        setIsOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ fieldKey: '', label: '', fieldType: 'text', requiredDefault: false, isActive: true });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Form Fields Library</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}><Plus className="w-4 h-4 mr-2" /> Add New Field</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">{editingId ? 'Edit' : 'Add'} Field</DialogTitle></DialogHeader>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Field Key (unique, camelCase)</Label>
                                <Input value={formData.fieldKey} onChange={e => setFormData({ ...formData, fieldKey: e.target.value })} placeholder="e.g. panNumber" />
                            </div>
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. PAN Number" />
                            </div>
                            <div className="space-y-2">
                                <Label>Field Type</Label>
                                <Select value={formData.fieldType} onValueChange={v => setFormData({ ...formData, fieldType: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                        <SelectItem value="dropdown">Dropdown</SelectItem>
                                        <SelectItem value="checkbox">Checkbox</SelectItem>
                                        <SelectItem value="file">File Upload</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch checked={formData.requiredDefault} onCheckedChange={c => setFormData({ ...formData, requiredDefault: c })} />
                                <Label>Required by default?</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch checked={formData.isActive} onCheckedChange={c => setFormData({ ...formData, isActive: c })} />
                                <Label>Active</Label>
                            </div>
                        </div>
                        <div className="border-t p-6 pt-4 shrink-0 flex">
                            <Button onClick={handleSave} className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20">Save</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.label}</TableCell>
                                <TableCell className="font-mono text-xs">{item.fieldKey}</TableCell>
                                <TableCell>{item.fieldType}</TableCell>
                                <TableCell>{item.isActive !== false ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function PricingMaster() {
    const { usageTypes, purposeTypes, validities, pricings, refetch } = useDSCMasters();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        usageTypeId: '',
        purposeTypeId: '',
        validityId: '',
        tokenIncluded: false,
        basePrice: 0,
        gstRate: 18,
        isActive: true
    });
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            const data = {
                type_id: formData.usageTypeId,
                authority_id: formData.purposeTypeId,
                validity_id: formData.validityId,
                token_included: formData.tokenIncluded,
                base_price: Number(formData.basePrice),
                gst_rate: Number(formData.gstRate),
                is_active: formData.isActive,
            };

            if (editingId) {
                const { error } = await supabase.from('dsc_rates').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('dsc_rates').insert([data]);
                if (error) throw error;
            }
            await refetch();
            toast({ title: 'Success', description: editingId ? 'Updated pricing.' : 'Added pricing.' });
            setIsOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setFormData({
            usageTypeId: item.usageTypeId,
            purposeTypeId: item.purposeTypeId,
            validityId: item.validityId,
            tokenIncluded: item.tokenIncluded || false,
            basePrice: item.basePrice || 0,
            gstRate: item.gstRate || 18,
            isActive: item.isActive !== false
        });
        setIsOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            usageTypeId: '',
            purposeTypeId: '',
            validityId: '',
            tokenIncluded: false,
            basePrice: 0,
            gstRate: 18,
            isActive: true
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pricing Matrix</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}><Plus className="w-4 h-4 mr-2" /> Add Pricing Rule</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50"><DialogTitle className="text-xl">{editingId ? 'Edit' : 'Add'} Pricing</DialogTitle></DialogHeader>
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Usage Type</Label>
                                <Select value={formData.usageTypeId} onValueChange={v => setFormData({ ...formData, usageTypeId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select Usage" /></SelectTrigger>
                                    <SelectContent>
                                        {usageTypes.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Purpose Type</Label>
                                <Select value={formData.purposeTypeId} onValueChange={v => setFormData({ ...formData, purposeTypeId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select Purpose" /></SelectTrigger>
                                    <SelectContent>
                                        {purposeTypes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Validity</Label>
                                <Select value={formData.validityId} onValueChange={v => setFormData({ ...formData, validityId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select Validity" /></SelectTrigger>
                                    <SelectContent>
                                        {validities.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                                <Switch checked={formData.tokenIncluded} onCheckedChange={c => setFormData({ ...formData, tokenIncluded: c })} />
                                <Label>Includes Token?</Label>
                            </div>
                            <div className="space-y-2">
                                <Label>Base Price (₹)</Label>
                                <Input type="number" value={formData.basePrice} onChange={e => setFormData({ ...formData, basePrice: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>GST Rate (%)</Label>
                                <Input type="number" value={formData.gstRate} onChange={e => setFormData({ ...formData, gstRate: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center space-x-2 pt-4 col-span-2">
                                <Switch checked={formData.isActive} onCheckedChange={c => setFormData({ ...formData, isActive: c })} />
                                <Label>Active</Label>
                            </div>
                            </div>
                        </div>
                        <div className="border-t p-6 pt-4 shrink-0 flex justify-end">
                            <Button onClick={handleSave} className="min-w-[120px] h-11 rounded-xl font-bold shadow-lg shadow-primary/20">Save Pricing</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usage</TableHead>
                            <TableHead>Purpose</TableHead>
                            <TableHead>Validity</TableHead>
                            <TableHead>Token?</TableHead>
                            <TableHead>Base</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pricings.map((item) => {
                            const u = usageTypes.find(x => x.id === item.usageTypeId)?.name || '???';
                            const p = purposeTypes.find(x => x.id === item.purposeTypeId)?.name || '???';
                            const v = validities.find(x => x.id === item.validityId)?.label || '???';
                            const total = Math.round((item.basePrice + (item.basePrice * (item.gstRate || 0) / 100)));

                            return (
                                <TableRow key={item.id}>
                                    <TableCell>{u}</TableCell>
                                    <TableCell>{p}</TableCell>
                                    <TableCell>{v}</TableCell>
                                    <TableCell>{item.tokenIncluded ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>₹{item.basePrice}</TableCell>
                                    <TableCell>₹{total}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

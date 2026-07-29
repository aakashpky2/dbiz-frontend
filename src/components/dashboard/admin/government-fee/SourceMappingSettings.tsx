'use client';
import { apiFetch } from '@/lib/apiFetch';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { governmentFeeService } from '@/services/governmentFeeService';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMappings } from '@/hooks/use-mappings';

export default function SourceMappingSettings() {
    const { mappings: savedMappings, loading: isLoadingMappings, refresh } = useMappings();
    const [discoveredTables, setDiscoveredTables] = useState<any[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [activeEdits, setActiveEdits] = useState<Record<string, any>>({});
    
    const [isLoading, setIsLoading] = useState(false);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [showTechnical, setShowTechnical] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchDiscover = async () => {
            setIsDiscovering(true);
            try {
                const discoverData = await governmentFeeService.discoverSourceMappings();
                setDiscoveredTables(discoverData);
                if (discoverData.length > 0) {
                    setSelectedTable(prev => prev || discoverData[0].table_name);
                }
            } catch (e: any) {
                toast({ title: 'Error discovering schema', description: e.message, variant: 'destructive' });
            } finally {
                setIsDiscovering(false);
            }
        };
        fetchDiscover();
    }, [toast]);

    useEffect(() => {
        if (!savedMappings) return;
        
        // Pre-populate activeEdits with saved mappings
        const edits: Record<string, any> = {};
        savedMappings.forEach((m: any) => {
            const key = `${m.source_table}::${m.source_column}::${m.source_json_path || ''}`;
            edits[key] = {
                ...m,
                enabled: true
            };
        });
        setActiveEdits(edits);
    }, [savedMappings]);

    const handleColumnEdit = (tableName: string, colName: string, jsonPath: string, field: string, value: any, dataType: string) => {
        const key = `${tableName}::${colName}::${jsonPath}`;
        
        setActiveEdits(prev => {
            const current = prev[key] || {
                source_table: tableName,
                source_column: colName,
                source_json_path: jsonPath,
                data_type: dataType,
                display_name: colName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                category: tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                is_visible: true,
                is_active: true,
                enabled: false,
                description: ''
            };

            return {
                ...prev,
                [key]: { ...current, [field]: value }
            };
        });
    };

    const handleSaveColumn = async (tableName: string, colName: string, jsonPath: string) => {
        const key = `${tableName}::${colName}::${jsonPath}`;
        const editData = activeEdits[key];
        
        if (!editData || !editData.enabled) return;

        setIsLoading(true);
        try {
            const payload = {
                source_table: editData.source_table,
                source_column: editData.source_column,
                source_json_path: editData.source_json_path || '',
                display_name: editData.display_name,
                category: editData.category,
                data_type: editData.data_type,
                is_visible: editData.is_visible,
                is_active: editData.is_active,
                description: editData.description
            };

            await governmentFeeService.createSourceMapping(payload);
            toast({ title: 'Mapping saved successfully', description: `${editData.display_name} saved.` });
            refresh();
        } catch (e: any) {
            toast({ title: 'Error saving mapping', description: e.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    if (isDiscovering) {
        return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" /> Discovering Database Schema...</div>;
    }

    const currentTableDef = discoveredTables.find(t => t.table_name === selectedTable);

    return (
        <div className="flex h-[calc(100vh-180px)] border rounded-xl overflow-hidden bg-white">
            {/* Left Sidebar - Tables */}
            <div className="w-64 border-r bg-slate-50 flex flex-col">
                <div className="p-4 border-b font-bold text-sm bg-slate-100">
                    Database Tables
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {discoveredTables.map(t => (
                            <button
                                key={t.table_name}
                                onClick={() => setSelectedTable(t.table_name)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    selectedTable === t.table_name 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                {t.display_name}
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Side - Columns */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 border-b flex justify-between items-center bg-white">
                    <div>
                        <h2 className="font-bold text-lg">{currentTableDef?.display_name}</h2>
                        <p className="text-xs text-muted-foreground">Select and configure which columns can be used for Government Fees.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="show-technical" checked={showTechnical} onCheckedChange={setShowTechnical} />
                        <Label htmlFor="show-technical" className="text-sm cursor-pointer">Show System Fields</Label>
                    </div>
                </div>
                
                <ScrollArea className="flex-1 p-6 bg-slate-50/50">
                    <div className="space-y-4 max-w-4xl mx-auto">
                        {currentTableDef?.columns.filter((c: any) => showTechnical || !c.is_technical).map((col: any) => {
                            const key = `${currentTableDef.table_name}::${col.column_name}::`;
                            const editData = activeEdits[key] || {
                                display_name: col.column_name.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                                category: currentTableDef.display_name,
                                data_type: col.data_type,
                                is_visible: true,
                                is_active: true,
                                description: '',
                                enabled: false
                            };

                            return (
                                <Card key={key} className={`border-l-4 transition-all ${editData.enabled ? 'border-l-primary shadow-sm' : 'border-l-transparent bg-slate-50/80 opacity-70 hover:opacity-100'}`}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <Checkbox 
                                                checked={editData.enabled}
                                                onCheckedChange={(c) => handleColumnEdit(currentTableDef.table_name, col.column_name, '', 'enabled', !!c, col.data_type)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <div className="font-mono text-sm font-bold text-slate-700">
                                                        {col.column_name} <span className="text-slate-400 font-normal text-xs ml-2">({col.data_type})</span>
                                                    </div>
                                                    {editData.enabled && (
                                                        <Button size="sm" onClick={() => handleColumnEdit(currentTableDef.table_name, col.column_name, '', 'enabled', false, col.data_type)} variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
                                                            Disable
                                                        </Button>
                                                    )}
                                                </div>

                                                {editData.enabled && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Display Name</Label>
                                                            <Input 
                                                                className="h-8 text-sm" 
                                                                value={editData.display_name} 
                                                                onChange={(e) => handleColumnEdit(currentTableDef.table_name, col.column_name, '', 'display_name', e.target.value, col.data_type)} 
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Category</Label>
                                                            <Input 
                                                                className="h-8 text-sm" 
                                                                value={editData.category} 
                                                                onChange={(e) => handleColumnEdit(currentTableDef.table_name, col.column_name, '', 'category', e.target.value, col.data_type)} 
                                                            />
                                                        </div>
                                                        <div className="space-y-1 col-span-2">
                                                            <Label className="text-xs">Description (Optional)</Label>
                                                            <Input 
                                                                className="h-8 text-sm" 
                                                                value={editData.description || ''} 
                                                                onChange={(e) => handleColumnEdit(currentTableDef.table_name, col.column_name, '', 'description', e.target.value, col.data_type)} 
                                                            />
                                                        </div>
                                                        <div className="flex gap-6 mt-2 col-span-2 items-center bg-slate-50 p-2 rounded-md border">
                                                            <div className="flex items-center space-x-2">
                                                                <Switch 
                                                                    checked={editData.is_visible} 
                                                                    onCheckedChange={(c) => handleColumnEdit(currentTableDef.table_name, col.column_name, '', 'is_visible', !!c, col.data_type)} 
                                                                />
                                                                <Label className="text-xs font-normal">Visible to Staff</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <Switch 
                                                                    checked={editData.is_active} 
                                                                    onCheckedChange={(c) => handleColumnEdit(currentTableDef.table_name, col.column_name, '', 'is_active', !!c, col.data_type)} 
                                                                />
                                                                <Label className="text-xs font-normal">Active</Label>
                                                            </div>
                                                            <div className="flex-1 text-right">
                                                                <Button size="sm" onClick={() => handleColumnSaveSafe(currentTableDef.table_name, col.column_name, '')} disabled={isLoading}>
                                                                    <Save className="w-3.5 h-3.5 mr-2" /> Save Mapping
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        
                        {/* Custom JSON Path for 'fields' column support */}
                        {currentTableDef?.columns.some((c: any) => c.column_name === 'fields') && (
                            <Card className="border-dashed border-2 mt-8">
                                <CardContent className="p-6 text-center">
                                    <h3 className="font-bold text-sm mb-2">Need a custom JSON Path mapping?</h3>
                                    <p className="text-xs text-muted-foreground mb-4">Because this table contains a JSON `fields` column, you can map nested data points.</p>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const path = prompt("Enter the exact JSON dot-path (e.g. authorized_capital):");
                                        if (path && path.trim()) {
                                            handleColumnEdit(currentTableDef.table_name, 'fields', path.trim(), 'enabled', true, 'numeric/text');
                                            handleColumnEdit(currentTableDef.table_name, 'fields', path.trim(), 'display_name', path.trim(), 'numeric/text');
                                        }
                                    }}>
                                        + Add JSON Path Mapping
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                        
                        {/* Show any manual JSON paths that exist for this table */}
                        {Object.entries(activeEdits).filter(([k, v]) => v.source_table === currentTableDef?.table_name && v.source_json_path && v.enabled).map(([k, editData]: any) => (
                            <Card key={k} className="border-l-4 border-l-purple-500 shadow-sm mt-4">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <div className="font-mono text-sm font-bold text-purple-700">
                                                    {editData.source_column} <span className="text-purple-400 font-normal text-xs mx-1">-&gt;</span> {editData.source_json_path}
                                                </div>
                                                <Button size="sm" onClick={() => handleColumnEdit(editData.source_table, editData.source_column, editData.source_json_path, 'enabled', false, editData.data_type)} variant="ghost" className="h-7 text-xs text-red-500">
                                                    Remove
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Display Name</Label>
                                                    <Input className="h-8 text-sm" value={editData.display_name} onChange={(e) => handleColumnEdit(editData.source_table, editData.source_column, editData.source_json_path, 'display_name', e.target.value, editData.data_type)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Category</Label>
                                                    <Input className="h-8 text-sm" value={editData.category} onChange={(e) => handleColumnEdit(editData.source_table, editData.source_column, editData.source_json_path, 'category', e.target.value, editData.data_type)} />
                                                </div>
                                                <div className="flex gap-6 mt-2 col-span-2 items-center bg-purple-50 p-2 rounded-md border border-purple-100">
                                                    <div className="flex-1 text-right">
                                                        <Button size="sm" onClick={() => handleColumnSaveSafe(editData.source_table, editData.source_column, editData.source_json_path)} disabled={isLoading}>
                                                            <Save className="w-3.5 h-3.5 mr-2" /> Save JSON Mapping
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );

    function handleColumnSaveSafe(t: string, c: string, j: string) {
        handleSaveColumn(t, c, j);
    }
}

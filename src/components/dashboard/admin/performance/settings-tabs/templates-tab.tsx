'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, CheckCircle2, AlertCircle, Trash2, Eye, MoreHorizontal, Copy, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TemplateBuilderDialog } from '@/components/dashboard/admin/performance/template-builder-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TemplatesTab() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canView = hasPermission('VIEW_PERFORMANCE');
    const canEdit = hasPermission('EDIT_PERFORMANCE') || hasPermission('MANAGE_PERFORMANCE');
    const canDelete = hasPermission('DELETE_PERFORMANCE') || hasPermission('MANAGE_PERFORMANCE');

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/performance/templates');
            const data = await res.json();
            if (data.success) {
                setTemplates(data.data);
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({
                title: 'Error fetching templates',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleCreate = () => {
        setSelectedTemplateId(undefined);
        setIsBuilderOpen(true);
    };

    const handleEdit = (id: string) => {
        setSelectedTemplateId(id);
        setIsBuilderOpen(true);
    };

    const handleDelete = async () => {
        if (!templateToDelete) return;
        try {
            const res = await fetch(`/api/performance/templates/${templateToDelete}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
            }
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Success', description: 'Template deleted successfully' });
                fetchTemplates();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({ title: 'Error deleting template', description: error.message, variant: 'destructive' });
        } finally {
            setTemplateToDelete(null);
        }
    };

    const handleDuplicate = async (t: any) => {
        try {
            const res = await fetch(`/api/performance/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...t,
                    id: undefined,
                    template_name: `${t.template_name} (Copy)`,
                    status: 'draft',
                    created_at: undefined,
                    updated_at: undefined
                })
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
            }
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Success', description: 'Template duplicated successfully' });
                fetchTemplates();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({ title: 'Error duplicating template', description: error.message, variant: 'destructive' });
        }
    };

    const handleToggleStatus = async (t: any) => {
        try {
            const newStatus = t.status === 'active' ? 'draft' : 'active';
            const res = await fetch(`/api/performance/templates/${t.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...t, status: newStatus })
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
            }
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Success', description: `Template status changed to ${newStatus}` });
                fetchTemplates();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({ title: 'Error changing status', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Performance Templates</h3>
                {canEdit && (
                    <Button onClick={handleCreate} className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Template
                    </Button>
                )}
            </div>

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="py-12 text-center text-muted-foreground">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground border-dashed border-2 m-4 rounded-xl">
                            No templates found. Click "Create Template" to begin.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-slate-50/50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Template Name</th>
                                        <th className="px-4 py-3 font-medium">Cycle</th>
                                        <th className="px-4 py-3 font-medium">Total Weight</th>
                                        <th className="px-4 py-3 font-medium">Criteria Count</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">Created Date</th>
                                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {templates.map(t => {
                                        return (
                                            <tr key={t.id} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3 font-medium">
                                                    <div>{t.template_name}</div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                                                </td>
                                                <td className="px-4 py-3">{t.evaluation_period}</td>
                                                <td className="px-4 py-3">
                                                    <span className={t.total_weight === 100 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                                        {t.total_weight || 0}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                                        {t.criteria_count || 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {t.status === 'active' ? (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-0">
                                                            Draft
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(t.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => handleEdit(t.id)}>
                                                                <Eye className="mr-2 h-4 w-4" /> View
                                                            </DropdownMenuItem>
                                                            {canEdit && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleEdit(t.id)}>
                                                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                                                                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleToggleStatus(t)}>
                                                                        <Power className="mr-2 h-4 w-4" /> 
                                                                        {t.status === 'active' ? 'Deactivate' : 'Activate'}
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                            {canDelete && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-red-600 focus:bg-red-50" onClick={() => setTemplateToDelete(t.id)}>
                                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <TemplateBuilderDialog 
                isOpen={isBuilderOpen}
                onOpenChange={setIsBuilderOpen}
                templateId={selectedTemplateId}
                onSaved={fetchTemplates}
            />

            <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the performance template and remove the data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Settings2, Info, LayoutTemplate, ShieldCheck, Database, Layers } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { MasterTable } from '@/components/dashboard/recruitment/master-table';
import { PageHero } from '@/components/dashboard/page-hero';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";

const FIELD_TYPES = [
    "Dropdown",
    "Multi Select",
    "Text Input",
    "Textarea",
    "Number",
    "Date",
    "Checkbox",
    "Radio Button",
    "File Upload",
    "Email",
    "Phone"
];

const USAGE_LOCATIONS = [
    "Job Application Form",
    "Applicant Review Form",
    "Interview Scheduling Form",
    "Candidate Profile Form",
    "Job Opening Form"
];

const categorySchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    description: z.string().optional(),
    field_type: z.string().min(1, "Field type is required"),
    is_required: z.boolean().default(false),
    usage_locations: z.array(z.string()).min(1, "Select at least one location"),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface MasterCategory {
    id: string;
    name: string;
    description: string;
    is_default: boolean;
    field_type: string;
    is_required: boolean;
    usage_locations?: string[];
}

export default function RecruitmentMasterPage() {
    const { toast } = useToast();
    const [categories, setCategories] = useState<MasterCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [dialogResetKey, setDialogResetKey] = useState(0);
    const [editingCategory, setEditingCategory] = useState<MasterCategory | null>(null);

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: "",
            description: "",
            field_type: "Dropdown",
            is_required: false,
            usage_locations: ["Job Application Form"],
        },
    });

    const editForm = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
    });

    useEffect(() => {
        if (editingCategory) {
            editForm.reset({
                name: editingCategory.name,
                description: editingCategory.description || "",
                field_type: editingCategory.field_type,
                is_required: editingCategory.is_required,
                usage_locations: editingCategory.usage_locations || [],
            });
        }
    }, [editingCategory, editForm]);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const { data: catData, error: catError } = await supabase
                .from('recruitment_master_categories')
                .select('*')
                .order('name');

            if (catError) throw catError;

            // Fetch mappings for each category
            const categoriesWithMappings = await Promise.all((catData || []).map(async (cat) => {
                const { data: mappings } = await supabase
                    .from('recruitment_form_mappings')
                    .select('form_name')
                    .eq('category_id', cat.id);

                return {
                    ...cat,
                    usage_locations: mappings?.map(m => m.form_name) || []
                };
            }));

            setCategories(categoriesWithMappings);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const onAddCategory = async (data: CategoryFormValues) => {
        try {
            // 1. Insert Category
            const { data: newCat, error: catError } = await supabase
                .from('recruitment_master_categories')
                .insert([{
                    name: data.name,
                    description: data.description,
                    field_type: data.field_type,
                    is_required: data.is_required,
                    is_default: false
                }])
                .select()
                .single();

            if (catError) throw catError;

            // 2. Insert Mappings
            if (data.usage_locations.length > 0) {
                const mappingData = data.usage_locations.map(formName => ({
                    category_id: newCat.id,
                    form_name: formName
                }));

                const { error: mapError } = await supabase
                    .from('recruitment_form_mappings')
                    .insert(mappingData);

                if (mapError) throw mapError;
            }

            await fetchCategories();
            toast({ title: "Category Created", description: `${data.name} has been added to recruitment master.` });
            setIsAddModalOpen(false);
            form.reset();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const onDeleteCategory = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;

        try {
            const { error } = await supabase.from('recruitment_master_categories').delete().eq('id', id);
            if (error) throw error;
            await fetchCategories();
            toast({ title: "Deleted", description: "Category removed successfully." });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const onUpdateCategory = async (data: CategoryFormValues) => {
        if (!editingCategory) return;
        try {
            // 1. Update Category
            const { error: catError } = await supabase
                .from('recruitment_master_categories')
                .update({
                    name: data.name,
                    description: data.description,
                    field_type: data.field_type,
                    is_required: data.is_required,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingCategory.id);

            if (catError) throw catError;

            // 2. Sync Mappings
            // Delete old
            const { error: delError } = await supabase
                .from('recruitment_form_mappings')
                .delete()
                .eq('category_id', editingCategory.id);
            if (delError) throw delError;

            // Insert new
            if (data.usage_locations.length > 0) {
                const mappingData = data.usage_locations.map(formName => ({
                    category_id: editingCategory.id,
                    form_name: formName
                }));

                const { error: mapError } = await supabase
                    .from('recruitment_form_mappings')
                    .insert(mappingData);

                if (mapError) throw mapError;
            }

            await fetchCategories();
            toast({ title: "Category Updated", description: `${data.name} has been updated successfully.` });
            setEditingCategory(null);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50/30">
            {/* Header Section */}
            <div className="mb-10 space-y-4">
                <PageHero
                pattern="pattern-5"
                    icon={Database}
                    badge="RECRUITMENT"
                    title="Recruitment Master"
                    description="Control dynamic fields, dropdowns, and configurations across the hiring pipeline."
                >
                    <Button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-white font-black h-11 px-6 rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95 flex gap-2 uppercase tracking-widest text-xs"
                    >
                        <PlusCircle className="h-5 w-5" />
                        Create Master Category
                    </Button>
                </PageHero>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4 pt-2">
                    <div className="bg-white px-5 py-3 rounded-2xl border-2 border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <Layers className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Total Categories</div>
                            <div className="text-xl font-black text-slate-900">{categories.length}</div>
                        </div>
                    </div>
                    <div className="bg-white px-5 py-3 rounded-2xl border-2 border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <Settings2 className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Active Mappings</div>
                            <div className="text-xl font-black text-slate-900">{USAGE_LOCATIONS.length} Forms</div>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-slate-500 font-bold animate-pulse">Initializing Master Centers...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {categories.map((cat) => (
                        <div key={cat.id} className="transition-all hover:translate-y-[-4px]">
                            <MasterTable
                                categoryId={cat.id}
                                title={cat.name}
                                description={cat.description}
                                itemNameLabel={`${cat.name} Value`}
                                isDefault={cat.is_default}
                                onEditCategory={() => setEditingCategory(cat)}
                                onDeleteCategory={() => onDeleteCategory(cat.id, cat.name)}
                                showValues={['Dropdown', 'Multi Select', 'Checkbox', 'Radio Button'].includes(cat.field_type)}
                            />
                            {/* Tags showing usage \u0026 type */}
                            <div className="mt-4 flex flex-col gap-2 px-1">
                                <div className="flex flex-wrap gap-1.5">
                                    {cat.usage_locations?.map(loc => (
                                        <Badge key={loc} variant="outline" className="bg-slate-50 text-[10px] py-0.5 border-slate-200 text-slate-500 font-bold uppercase tracking-tighter">
                                            {loc}
                                        </Badge>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest pl-1 mt-1">
                                    <LayoutTemplate className="h-3 w-3" /> {cat.field_type}
                                    {cat.is_required && <span className="flex items-center gap-1 text-orange-500 ml-auto"><ShieldCheck className="h-3.5 w-3.5" /> Required</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CREATE CATEGORY MODAL */}
            <Dialog open={isAddModalOpen} onOpenChange={(v) => { setIsAddModalOpen(v); if(!v) setDialogResetKey(k => k + 1); }}>
                <DialogContent key={dialogResetKey} className="sm:max-w-[650px] border-t-8 border-t-primary rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            Adding New Master Category
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">
                            Enter the details for Master Category.
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onAddCategory)} className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Category Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g., Education Level"
                                                    className="h-12 rounded-xl border-2 border-slate-100 focus:border-primary transition-all font-semibold"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="field_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Field Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl border-2 border-slate-100 font-semibold">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                    {FIELD_TYPES.map(type => (
                                                        <SelectItem key={type} value={type} className="font-medium">{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Description (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="What is this category for?"
                                                className="rounded-xl border-2 border-slate-100 focus:border-primary transition-all font-medium min-h-[80px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="is_required"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 border-slate-50 p-4 bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-sm font-bold text-slate-800">Required Field</FormLabel>
                                            <FormDescription className="text-xs">
                                                Must be filled during form submission.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="usage_locations"
                                render={() => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Form Assignment</FormLabel>
                                            <FormDescription className="text-xs font-medium">
                                                Select which forms should automatically include this field.
                                            </FormDescription>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {USAGE_LOCATIONS.map((item) => (
                                                <FormField
                                                    key={item}
                                                    control={form.control}
                                                    name="usage_locations"
                                                    render={({ field }) => {
                                                        const isChecked = field.value?.includes(item);
                                                        return (
                                                            <FormItem
                                                                key={item}
                                                                className={`flex flex-row items-start space-x-3 space-y-0 p-4 rounded-xl border-2 transition-all cursor-pointer ${isChecked ? 'bg-primary/5 border-primary/20' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                                            >
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={isChecked}
                                                                        onCheckedChange={(checked) => {
                                                                            return checked
                                                                                ? field.onChange([...field.value, item])
                                                                                : field.onChange(
                                                                                    field.value?.filter(
                                                                                        (value) => value !== item
                                                                                    )
                                                                                );
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className={`text-xs font-bold cursor-pointer ${isChecked ? 'text-primary' : 'text-slate-600'}`}>
                                                                    {item}
                                                                </FormLabel>
                                                            </FormItem>
                                                        );
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="h-12 w-32 font-bold rounded-xl">Cancel</Button>
                                <Button type="submit" className="h-12 w-48 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all uppercase tracking-widest text-xs">
                                    Build Category
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* EDIT CATEGORY MODAL */}
            <Dialog open={!!editingCategory} onOpenChange={(open) => { if(!open) { setEditingCategory(null); setDialogResetKey(k => k + 1); } }}>
                <DialogContent key={dialogResetKey} className="sm:max-w-[650px] border-t-8 border-t-primary rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            Editing "{editingCategory?.name || 'Master Category'}"
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">
                            Update the details of this item.
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onUpdateCategory)} className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={editForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Category Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g., Education Level"
                                                    className="h-12 rounded-xl border-2 border-slate-100 focus:border-primary transition-all font-semibold"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={editForm.control}
                                    name="field_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Field Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl border-2 border-slate-100 font-semibold">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                    {FIELD_TYPES.map(type => (
                                                        <SelectItem key={type} value={type} className="font-medium">{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={editForm.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Description (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="What is this category for?"
                                                className="rounded-xl border-2 border-slate-100 focus:border-primary transition-all font-medium min-h-[80px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={editForm.control}
                                name="is_required"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 border-slate-50 p-4 bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-sm font-bold text-slate-800">Required Field</FormLabel>
                                            <FormDescription className="text-xs">
                                                Must be filled during form submission.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={editForm.control}
                                name="usage_locations"
                                render={() => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Form Assignment</FormLabel>
                                            <FormDescription className="text-xs font-medium">
                                                Select which forms should automatically include this field.
                                            </FormDescription>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {USAGE_LOCATIONS.map((item) => (
                                                <FormField
                                                    key={item}
                                                    control={editForm.control}
                                                    name="usage_locations"
                                                    render={({ field }) => {
                                                        const isChecked = field.value?.includes(item);
                                                        return (
                                                            <FormItem
                                                                key={item}
                                                                className={`flex flex-row items-start space-x-3 space-y-0 p-4 rounded-xl border-2 transition-all cursor-pointer ${isChecked ? 'bg-primary/5 border-primary/20' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                                            >
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={isChecked}
                                                                        onCheckedChange={(checked) => {
                                                                            return checked
                                                                                ? field.onChange([...field.value, item])
                                                                                : field.onChange(
                                                                                    field.value?.filter(
                                                                                        (value) => value !== item
                                                                                    )
                                                                                );
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className={`text-xs font-bold cursor-pointer ${isChecked ? 'text-primary' : 'text-slate-600'}`}>
                                                                    {item}
                                                                </FormLabel>
                                                            </FormItem>
                                                        );
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)} className="h-12 w-32 font-bold rounded-xl">Cancel</Button>
                                <Button type="submit" className="h-12 w-48 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all uppercase tracking-widest text-xs">
                                    Update Category
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
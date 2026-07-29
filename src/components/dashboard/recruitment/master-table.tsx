"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Edit, Trash2, PlusCircle, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MasterItem {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
}

interface MasterTableProps {
  categoryId: string;
  title: string;
  description?: string;
  itemNameLabel: string;
  onEditCategory?: () => void;
  onDeleteCategory?: () => void;
  isDefault?: boolean;
  showValues?: boolean;
}

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
});

type FormValues = z.infer<typeof formSchema>;

export function MasterTable({
  categoryId,
  title,
  description,
  itemNameLabel,
  onEditCategory,
  onDeleteCategory,
  isDefault = false,
  showValues = true,
}: MasterTableProps) {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_master_values')
        .select("id, name, sort_order, status")
        .eq('category_id', categoryId)
        .order("sort_order", { ascending: true })
        .order("name");

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error(`Error fetching values for ${title}:`, err);
      toast({
        title: "Load Failed",
        description: err.message || `Failed to load ${title}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, title, toast]);

  useEffect(() => {
    if (categoryId) fetchItems();
  }, [categoryId, fetchItems]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Check for duplicates (case-insensitive)
      const isDuplicate = items.some(item =>
        item.name.toLowerCase() === data.name.trim().toLowerCase() &&
        (!editingItem || item.id !== editingItem.id)
      );

      if (isDuplicate) {
        throw new Error(`The ${itemNameLabel.toLowerCase()} "${data.name}" already exists in this category.`);
      }

      if (editingItem) {
        const { error } = await supabase
          .from('recruitment_master_values')
          .update({ name: data.name.trim() })
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recruitment_master_values')
          .insert([{ name: data.name.trim(), category_id: categoryId, status: 'Active' }]);
        if (error) throw error;
      }
      toast({ title: "Success", description: `${itemNameLabel} saved successfully.` });
      setIsDialogOpen(false);
      fetchItems();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (item: MasterItem & { status?: string }) => {
    const newStatus = item.status === 'Inactive' ? 'Active' : 'Inactive';
    try {
      const { error } = await supabase
        .from('recruitment_master_values')
        .update({ status: newStatus })
        .eq("id", item.id);

      if (error) throw error;

      toast({ title: "Status Updated", description: `${item.name} is now ${newStatus}.` });
      fetchItems();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    form.reset({ name: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (item: MasterItem) => {
    setEditingItem(item);
    form.reset({ name: item.name });
    setIsDialogOpen(true);
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap items locally
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

    // Optimistic UI update
    setItems(newItems);

    try {
      // Update sort order in Supabase
      const updates = newItems.map((item, idx) => ({
        id: item.id,
        sort_order: idx,
        category_id: categoryId,
        name: item.name
      }));

      const { error } = await supabase
        .from('recruitment_master_values')
        .upsert(updates);

      if (error) throw error;
    } catch (err: any) {
      console.error("Reorder failed:", err);
      fetchItems(); // Rollback if error
      toast({ title: "Reorder Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const { error } = await supabase.from('recruitment_master_values').delete().eq("id", id);
      if (error) throw error;
      toast({
        title: "Item Deleted",
        description: `${name} has been deleted.`,
      });
      fetchItems();
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  if (!showValues) return (
    <Card className="shadow-lg h-full border-t-4 border-t-slate-200 bg-slate-50/50">
      <CardHeader className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-slate-400">{title}</CardTitle>
          <div className="flex gap-1">
            {onEditCategory && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEditCategory}
                className="text-slate-400 hover:text-primary h-8 w-8"
                title="Edit Category"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {!isDefault && onDeleteCategory && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDeleteCategory}
                className="text-destructive hover:bg-destructive/10 h-8 w-8"
                title="Delete Category"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="py-6 text-center italic text-xs text-slate-400">
        Values are not required for this field type.
      </CardContent>
    </Card>
  );

  return (
    <Card className="shadow-lg h-full border-t-4 border-t-primary/20">
      <CardHeader className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {onEditCategory && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEditCategory}
                  className="text-slate-400 hover:text-primary h-8 w-8"
                  title="Edit Category"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {!isDefault && onDeleteCategory && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDeleteCategory}
                  className="text-destructive hover:bg-destructive/10 h-8 w-8"
                  title="Delete Category"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              onClick={openAdd}
              size="sm"
              className="bg-primary hover:bg-primary/90 h-8 font-medium"
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add New
            </Button>
          </div>
        </div>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 flex justify-center text-muted-foreground">
            <Loader2 className="animate-spin h-6 w-6 mr-2" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-gray-50/50">
            <p className="text-sm">No items yet</p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="py-2.5 font-semibold text-xs uppercase tracking-wider">{itemNameLabel}</TableHead>
                  <TableHead className="py-2.5 font-semibold text-xs uppercase tracking-wider w-[100px]">Status</TableHead>
                  <TableHead className="text-right py-2.5 font-semibold text-xs uppercase tracking-wider w-[120px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id} className="group hover:bg-primary/5 transition-colors">
                    <TableCell className="font-medium text-sm py-3 flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-slate-200"
                          onClick={() => handleReorder(index, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-slate-200"
                          onClick={() => handleReorder(index, 'down')}
                          disabled={index === items.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className={cn(item.status === 'Inactive' && "text-muted-foreground line-through opacity-50")}>
                        {item.name}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        onClick={() => toggleStatus(item)}
                        className={cn(
                          "cursor-pointer transition-all hover:scale-105 active:scale-95 text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5",
                          item.status === 'Inactive'
                            ? "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        )}
                      >
                        {item.status || 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-3 space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(item)}
                        className="hover:text-primary h-8 w-8 text-slate-400 group-hover:text-primary transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="hover:text-destructive h-8 w-8 text-slate-400 group-hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border-t-4 border-t-primary">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit" : "Add"} {itemNameLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingItem
                ? "Update the details for this item."
                : "Enter the details for the new item."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-2"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-tight">
                      {itemNameLabel}{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`Enter ${itemNameLabel.toLowerCase()}...`}
                        className="rounded-lg border-primary/20 focus:ring-primary/20"
                        {...field}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4 gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="rounded-lg h-9 px-6 font-medium">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="rounded-lg h-9 px-6 font-medium">
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingItem ? "Save" : "Add"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card >
  );
}

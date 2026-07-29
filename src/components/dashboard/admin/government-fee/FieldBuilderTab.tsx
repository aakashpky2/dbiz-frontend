"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, GripVertical, FileText, Layers, ListFilter, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { governmentFeeService } from '@/services/governmentFeeService';

interface FieldBuilderTabProps {
  workTypeId: string;
}

export function FieldBuilderTab({ workTypeId }: FieldBuilderTabProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  // Form state
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [options, setOptions] = useState<string[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [status, setStatus] = useState('active');

  const fetchFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await governmentFeeService.getFields(workTypeId);
      setFields(res.data || []);
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error fetching fields",
        description: e.message || "Something went wrong."
      });
    } finally {
      setLoading(false);
    }
  }, [workTypeId, toast]);

  useEffect(() => {
    if (workTypeId) {
      fetchFields();
    }
  }, [workTypeId, fetchFields]);

  const handleAdd = () => {
    setEditingField(null);
    setFieldLabel('');
    setFieldKey('');
    setFieldType('text');
    setOptions([]);
    setIsRequired(false);
    setDisplayOrder(fields.length);
    setStatus('active');
    setDialogOpen(true);
  };

  const handleEdit = (field: any) => {
    setEditingField(field);
    setFieldLabel(field.field_label);
    setFieldKey(field.field_key);
    setFieldType(field.field_type);
    setOptions(field.options || []);
    setIsRequired(field.is_required);
    setDisplayOrder(field.display_order);
    setStatus(field.status);
    setDialogOpen(true);
  };

  const confirmDelete = (id: string) => {
    setFieldToDelete(id);
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!fieldToDelete) return;
    setIsSubmitting(true);
    try {
      await governmentFeeService.deleteField(fieldToDelete);
      toast({
        title: "Field Deactivated",
        description: "The field has been marked as inactive successfully."
      });
      fetchFields();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Failed to delete field"
      });
    } finally {
      setIsSubmitting(false);
      setDeleteDialogOpen(false);
      setFieldToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!fieldLabel || !fieldKey || !fieldType) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill all required fields."
      });
      return;
    }
    
    setIsSubmitting(true);
    const payload = {
      work_type_id: workTypeId,
      field_label: fieldLabel,
      field_key: fieldKey,
      field_type: fieldType,
      options: fieldType === 'dropdown' ? options : [],
      is_required: isRequired,
      display_order: displayOrder,
      status
    };

    try {
      if (editingField) {
        await governmentFeeService.updateField(editingField.id, payload);
        toast({ title: "Success", description: "Field updated successfully." });
      } else {
        await governmentFeeService.createField(payload);
        toast({ title: "Success", description: "Field created successfully." });
      }
      setDialogOpen(false);
      fetchFields();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: e.message || "Failed to save field"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLabelChange = (val: string) => {
    setFieldLabel(val);
    if (!editingField) {
      setFieldKey(val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, ''));
    }
  };

  const addOption = () => setOptions([...options, '']);
  const updateOption = (index: number, val: string) => {
    const newOptions = [...options];
    newOptions[index] = val;
    setOptions(newOptions);
  };
  const removeOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  // Summary Metrics
  const totalFields = fields.length;
  const activeFields = fields.filter(f => f.status === 'active').length;
  const requiredFields = fields.filter(f => f.is_required).length;
  const dropdownFields = fields.filter(f => f.field_type === 'dropdown').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Fields</p>
              <h3 className="text-2xl font-bold">{totalFields}</h3>
            </div>
            <div className="h-10 w-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Fields</p>
              <h3 className="text-2xl font-bold">{activeFields}</h3>
            </div>
            <div className="h-10 w-10 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Required Fields</p>
              <h3 className="text-2xl font-bold">{requiredFields}</h3>
            </div>
            <div className="h-10 w-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Dropdowns</p>
              <h3 className="text-2xl font-bold">{dropdownFields}</h3>
            </div>
            <div className="h-10 w-10 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center">
              <ListFilter className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border">
        <h3 className="text-lg font-medium px-2">Dynamic Fields Configuration</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFields} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Field
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center border rounded-lg bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-muted-foreground">Loading fields...</p>
        </div>
      ) : fields.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg bg-slate-50">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h4 className="text-lg font-medium">No Fields Configured</h4>
          <p className="text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
            You haven't defined any dynamic fields for this work type yet. Click below to start building your custom form.
          </p>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Field
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {fields.map((field) => (
            <Card key={field.id} className={`transition-all hover:shadow-sm ${field.status === 'inactive' ? 'opacity-70 bg-slate-50' : ''}`}>
              <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-base">{field.field_label}</h4>
                      <Badge variant="outline" className="text-xs capitalize font-normal bg-white">
                        {field.field_type}
                      </Badge>
                      {field.is_required && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Required
                        </Badge>
                      )}
                      {field.status === 'inactive' && (
                        <Badge variant="destructive" className="text-xs font-normal">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground gap-4">
                      <span><span className="font-medium text-foreground/70">Key:</span> {field.field_key}</span>
                      <span><span className="font-medium text-foreground/70">Order:</span> {field.display_order}</span>
                      {field.field_type === 'dropdown' && (
                        <span><span className="font-medium text-foreground/70">Options:</span> {field.options?.length || 0}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(field)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50" 
                    onClick={() => confirmDelete(field.id)}
                    disabled={field.status === 'inactive'}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {field.status === 'inactive' ? 'Deactivated' : 'Deactivate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ADD / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !isSubmitting && setDialogOpen(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add New Field'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Label <span className="text-red-500">*</span></Label>
                <Input value={fieldLabel} onChange={(e) => handleLabelChange(e.target.value)} placeholder="e.g. Capital Contribution" disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label>Field Key <span className="text-red-500">*</span></Label>
                <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="e.g. capital_contribution" disabled={!!editingField || isSubmitting} />
                <p className="text-xs text-muted-foreground">Unique identifier used in matching conditions.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Type <span className="text-red-500">*</span></Label>
                <Select value={fieldType} onValueChange={setFieldType} disabled={!!editingField || isSubmitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text (String)</SelectItem>
                    <SelectItem value="number">Number (Numeric)</SelectItem>
                    <SelectItem value="dropdown">Dropdown (Select)</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean (Yes/No)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)} disabled={isSubmitting} />
              </div>
            </div>

            {fieldType === 'dropdown' && (
              <div className="space-y-3 border p-4 rounded-md bg-slate-50/50">
                <div className="flex justify-between items-center">
                  <Label className="text-base">Dropdown Options</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={isSubmitting}>
                    <Plus className="w-3 h-3 mr-1" /> Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input value={opt} onChange={(e) => updateOption(idx, e.target.value)} placeholder={`Option ${idx + 1} value`} disabled={isSubmitting} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(idx)} disabled={isSubmitting}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {options.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded bg-white">No options added yet.</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border">
              <div className="flex items-center space-x-3">
                <Switch checked={isRequired} onCheckedChange={setIsRequired} id="is_required" disabled={isSubmitting} />
                <Label htmlFor="is_required" className="cursor-pointer">Is Required Field</Label>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingField ? 'Update Field' : 'Create Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !isSubmitting && setDeleteDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Deactivate Field</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to deactivate this field? It will no longer be available for new government fee rules, but existing rules may still reference it.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Yes, Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

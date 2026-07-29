import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ParameterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
  workTypes: any[];
}

export function ParameterDialog({ open, onOpenChange, onSave, workTypes }: ParameterDialogProps) {
  const [formData, setFormData] = useState({
    work_type_id: '',
    parameter_name: '',
    parameter_code: '',
    parameter_type: 'text',
    display_order: 0,
    is_required: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: name === 'display_order' ? Number(value) : value }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      setFormData({ work_type_id: '', parameter_name: '', parameter_code: '', parameter_type: 'text', display_order: 0, is_required: false });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Parameter</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="work_type_id">Work Type</Label>
            <select
              id="work_type_id"
              name="work_type_id"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.work_type_id}
              onChange={handleChange}
            >
              <option value="">Select a work type...</option>
              {workTypes.map(wt => (
                <option key={wt.id} value={wt.id}>{wt.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parameter_name">Parameter Name</Label>
            <Input id="parameter_name" name="parameter_name" value={formData.parameter_name} onChange={handleChange} placeholder="e.g. Authorized Capital" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parameter_code">Parameter Code</Label>
            <Input id="parameter_code" name="parameter_code" value={formData.parameter_code} onChange={handleChange} placeholder="e.g. auth_capital" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parameter_type">Parameter Type</Label>
              <select
                id="parameter_type"
                name="parameter_type"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.parameter_type}
                onChange={handleChange}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="currency">Currency</option>
                <option value="select">Select</option>
                <option value="multi_select">Multi Select</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input type="number" id="display_order" name="display_order" value={formData.display_order} onChange={handleChange} />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-medium leading-none">
              <input type="checkbox" name="is_required" checked={formData.is_required} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
              Required
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.parameter_name || !formData.parameter_code || !formData.work_type_id}>
            {isSaving ? 'Saving...' : 'Save Parameter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

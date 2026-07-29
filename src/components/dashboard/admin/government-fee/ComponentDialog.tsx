import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
  templates: any[]; // to select which template this component belongs to
}

export function ComponentDialog({ open, onOpenChange, onSave, templates }: ComponentDialogProps) {
  const [formData, setFormData] = useState({
    template_id: '',
    fee_name: '',
    authority_name: '',
    description: '',
    display_order: 0,
    is_required: true,
    is_editable: false,
    calculation_method: 'FIXED',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: name === 'display_order' ? parseInt(value) || 0 : value }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      setFormData({
        template_id: '',
        fee_name: '',
        authority_name: '',
        description: '',
        display_order: 0,
        is_required: true,
        is_editable: false,
        calculation_method: 'FIXED',
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Component</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template_id">Template</Label>
            <select
              id="template_id"
              name="template_id"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.template_id}
              onChange={handleChange}
            >
              <option value="">Select a template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee_name">Fee Name</Label>
            <Input id="fee_name" name="fee_name" value={formData.fee_name} onChange={handleChange} placeholder="e.g. Registration Fee" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="authority_name">Authority Name</Label>
            <Input id="authority_name" name="authority_name" value={formData.authority_name} onChange={handleChange} placeholder="e.g. MCA" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Optional details..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calculation_method">Calculation Method</Label>
              <select
                id="calculation_method"
                name="calculation_method"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={formData.calculation_method}
                onChange={handleChange}
              >
                <option value="FIXED">FIXED</option>
                <option value="PERCENTAGE">PERCENTAGE</option>
                <option value="SLAB">SLAB</option>
                <option value="MANUAL">MANUAL</option>
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
            <label className="flex items-center gap-2 text-sm font-medium leading-none">
              <input type="checkbox" name="is_editable" checked={formData.is_editable} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
              Editable
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.fee_name || !formData.template_id}>
            {isSaving ? 'Saving...' : 'Save Component'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

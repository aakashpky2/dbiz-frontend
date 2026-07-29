import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
  components: any[];
}

export function RuleDialog({ open, onOpenChange, onSave, components }: RuleDialogProps) {
  const [formData, setFormData] = useState({
    component_id: '',
    fee_amount: 0,
    percentage_rate: '',
    priority: 1,
    status: 'active',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
        ...prev, 
        [name]: name === 'fee_amount' || name === 'priority' ? Number(value) : value 
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
          ...formData,
          percentage_rate: formData.percentage_rate ? Number(formData.percentage_rate) : null
      });
      setFormData({ component_id: '', fee_amount: 0, percentage_rate: '', priority: 1, status: 'active' });
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
          <DialogTitle>Add Rule</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="component_id">Component</Label>
            <select
              id="component_id"
              name="component_id"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={formData.component_id}
              onChange={handleChange}
            >
              <option value="">Select a component...</option>
              {components.map(c => (
                <option key={c.id} value={c.id}>{c.fee_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee_amount">Fee Amount (₹)</Label>
              <Input type="number" id="fee_amount" name="fee_amount" value={formData.fee_amount} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="percentage_rate">Percentage (%)</Label>
              <Input type="number" step="0.01" id="percentage_rate" name="percentage_rate" value={formData.percentage_rate} onChange={handleChange} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input type="number" id="priority" name="priority" value={formData.priority} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.component_id}>
            {isSaving ? 'Saving...' : 'Save Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

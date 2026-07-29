import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
}

export function TemplateDialog({ open, onOpenChange, onSave }: TemplateDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    status: 'active',
    effective_from: '',
    effective_to: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        effective_from: formData.effective_from || null,
        effective_to: formData.effective_to || null,
      });
      setFormData({ name: '', code: '', description: '', status: 'active', effective_from: '', effective_to: '' });
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
          <DialogTitle>Add Template</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Template Code</Label>
            <Input id="code" name="code" value={formData.code} onChange={handleChange} placeholder="e.g. GST_REG" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. GST Registration" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Optional details..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {/* Work Type omitted for simplicity as per instructions, can add a lookup later if requested */}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effective_from">Effective From</Label>
              <Input type="date" id="effective_from" name="effective_from" value={formData.effective_from} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective_to">Effective To</Label>
              <Input type="date" id="effective_to" name="effective_to" value={formData.effective_to} onChange={handleChange} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.code || !formData.name}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

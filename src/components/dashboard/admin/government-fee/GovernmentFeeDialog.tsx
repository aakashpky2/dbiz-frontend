import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';

interface GovernmentFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function GovernmentFeeDialog({ open, onOpenChange, onSave, initialData }: GovernmentFeeDialogProps) {
  const [formData, setFormData] = useState({
    work_type_id: '',
    constitution_id: '',
    sub_constitution_id: '',
    state: '',
    client_type: '',
    fee_name: '',
    authority_name: '',
    amount: 0,
    calculation_type: 'FIXED',
    is_required: true,
    is_editable: true,
    status: 'active',
    effective_from: '',
    effective_to: '',
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [constitutions, setConstitutions] = useState<any[]>([]);
  const [subConstitutions, setSubConstitutions] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          ...initialData,
          constitution_id: initialData.constitution_id || '',
          sub_constitution_id: initialData.sub_constitution_id || '',
          state: initialData.state || '',
          client_type: initialData.client_type || '',
          effective_from: initialData.effective_from || '',
          effective_to: initialData.effective_to || '',
          authority_name: initialData.authority_name || '',
          notes: initialData.notes || '',
        });
      } else {
        setFormData({
          work_type_id: '',
          constitution_id: '',
          sub_constitution_id: '',
          state: '',
          client_type: '',
          fee_name: '',
          authority_name: '',
          amount: 0,
          calculation_type: 'FIXED',
          is_required: true,
          is_editable: true,
          status: 'active',
          effective_from: new Date().toISOString().split('T')[0],
          effective_to: '',
          notes: ''
        });
      }
      fetchMasters();
    }
  }, [open, initialData]);

  const fetchMasters = async () => {
    try {
      const wtRes = await supabase.from('work_types').select('id, name').eq('status', 'active');
      if (wtRes.data) setWorkTypes(wtRes.data);
    } catch (e) {
      console.error('Failed to fetch work_types', e);
    }

    try {
      const cRes = await supabase.from('constitutions').select('id, name');
      if (cRes.data) setConstitutions(cRes.data);
    } catch (e) {
      console.error('Failed to fetch constitutions', e);
    }

    try {
      const scRes = await supabase.from('sub_constitutions').select('id, name');
      if (scRes.data) setSubConstitutions(scRes.data);
    } catch (e) {
      console.error('Failed to fetch sub_constitutions', e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Government Fee' : 'Add Government Fee'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="work_type_id">Work Type <span className="text-red-500">*</span></Label>
            <select
              id="work_type_id"
              name="work_type_id"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={formData.work_type_id}
              onChange={handleChange}
              required
            >
              <option value="">Select a work type...</option>
              {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fee_name">Fee Name <span className="text-red-500">*</span></Label>
            <Input id="fee_name" name="fee_name" value={formData.fee_name} onChange={handleChange} placeholder="e.g. Name Reservation" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Fee Amount (₹) <span className="text-red-500">*</span></Label>
            <Input type="number" id="amount" name="amount" value={formData.amount} onChange={handleChange} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="calculation_type">Calculation Type</Label>
            <select
              id="calculation_type"
              name="calculation_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.calculation_type}
              onChange={handleChange}
            >
              <option value="FIXED">Fixed</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="constitution_id">Constitution</Label>
            <select
              id="constitution_id"
              name="constitution_id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.constitution_id}
              onChange={handleChange}
            >
              <option value="">All Constitutions</option>
              {constitutions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub_constitution_id">Sub Constitution</Label>
            <select
              id="sub_constitution_id"
              name="sub_constitution_id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.sub_constitution_id}
              onChange={handleChange}
            >
              <option value="">All Sub Constitutions</option>
              {subConstitutions.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <select
              id="state"
              name="state"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.state}
              onChange={handleChange}
            >
              <option value="">All States</option>
              <option value="Kerala">Kerala</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi">Delhi</option>
              {/* Add more states as needed or fetch from DB */}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_type">Client Type</Label>
            <select
              id="client_type"
              name="client_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.client_type}
              onChange={handleChange}
            >
              <option value="">All Client Types</option>
              <option value="Individual">Individual</option>
              <option value="Proprietorship">Proprietorship</option>
              <option value="Partnership">Partnership</option>
              <option value="LLP">LLP</option>
              <option value="Company">Company</option>
              <option value="Trust/Society">Trust/Society</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="authority_name">Authority Name</Label>
            <Input id="authority_name" name="authority_name" value={formData.authority_name} onChange={handleChange} placeholder="e.g. MCA" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective_from">Effective From</Label>
            <Input type="date" id="effective_from" name="effective_from" value={formData.effective_from} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective_to">Effective To</Label>
            <Input type="date" id="effective_to" name="effective_to" value={formData.effective_to} onChange={handleChange} />
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Optional notes..." />
          </div>

          <div className="col-span-2 flex gap-6">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="is_required" checked={formData.is_required} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="is_editable" checked={formData.is_editable} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
              Editable in Proposal
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.work_type_id || !formData.fee_name}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

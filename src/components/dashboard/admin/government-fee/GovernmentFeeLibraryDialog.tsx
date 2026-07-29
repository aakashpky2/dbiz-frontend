"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useMappings } from '@/hooks/use-mappings';

export default function GovernmentFeeLibraryDialog({ fee, isOpen, onClose, onSuccess, formMode = 'edit' }: any) {
  const [formData, setFormData] = useState<any>({
    fee_name: '',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    status: 'active',
    notes: ''
  });
  
  const [conditions, setConditions] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const { mappings } = useMappings();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (fee) {
      setFormData({
        fee_name: fee.fee_name || '',
        effective_from: fee.effective_from ? fee.effective_from.split('T')[0] : '',
        effective_to: fee.effective_to ? fee.effective_to.split('T')[0] : '',
        status: fee.status || 'active',
        notes: fee.notes || ''
      });
      fetchConditions(fee.id);
    }
  }, [fee]);

  const fetchConditions = async (id: string) => {
    const res = await fetch(`/api/government-fees/library/${id}/conditions?_t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      setConditions(data.data.conditions || []);
      setRules(data.data.calculation_rules || []);
    }
  };

  const handleSave = async () => {
    if (!formData.fee_name) {
      toast({ title: 'Fee Name is required', variant: 'destructive' });
      return;
    }

    for (let i = 0; i < conditions.length; i++) {
        const c = conditions[i];
        if (!c.mapping_id) { toast({ title: 'Validation Error', description: `Condition ${i+1}: Source Field required.`, variant: 'destructive' }); return; }
        if (!c.operator) { toast({ title: 'Validation Error', description: `Condition ${i+1}: Operator required.`, variant: 'destructive' }); return; }
    }

    setIsLoading(true);
    try {
      const url = fee ? `/api/government-fees/library/${fee.id}` : '/api/government-fees/library';
      const method = fee ? 'PUT' : 'POST';

      const cleanDate = (val: any) => val && String(val).trim() !== '' ? val : null;
      
      const payload = { 
        ...formData,
        effective_from: cleanDate(formData.effective_from),
        effective_to: cleanDate(formData.effective_to),
        conditions: conditions.map(c => ({
            ...c, min_date: cleanDate(c.min_date), max_date: cleanDate(c.max_date)
        })),
        calculation_rules: rules
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: fee ? 'Fee updated' : 'Fee created' });
        onSuccess();
      } else {
        toast({ title: 'Error saving fee', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { condition_group: 'AND', condition_label: '', mapping_id: mappings[0]?.id || '', operator: 'equals', compare_value: '', is_required: true }]);
  };

  const updateCondition = (index: number, key: string, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [key]: value };
    setConditions(updated);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addRule = () => {
    setRules([...rules, { calculation_type: 'fixed', fee_amount: 0, slabs: [], delay_slabs: [] }]);
  };

  const updateRule = (index: number, key: string, value: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [key]: value };
    setRules(updated);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formMode === 'view' ? 'View Government Fee' : (fee ? 'Edit Government Fee' : 'Add Government Fee')}</DialogTitle>
          <DialogDescription>Configure the fee details and its calculation rules.</DialogDescription>
        </DialogHeader>

        <fieldset disabled={formMode === 'view'} className="contents">
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Fee Name *</Label>
            <Input value={formData.fee_name} onChange={e => setFormData({ ...formData, fee_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Valid From</Label>
            <Input type="date" value={formData.effective_from} onChange={e => setFormData({ ...formData, effective_from: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Valid To</Label>
            <Input type="date" value={formData.effective_to || ''} onChange={e => setFormData({ ...formData, effective_to: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-8 border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">1. Applicability Conditions</h3>
            {formMode !== 'view' && <Button size="sm" variant="outline" onClick={addCondition}><Plus className="w-4 h-4 mr-2" /> Add Condition</Button>}
          </div>
          
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No conditions = fee applies to everything.</p>
          ) : (
            <div className="space-y-4">
              {conditions.map((c, idx) => (
                <div key={idx} className="p-4 border rounded-md bg-slate-50 space-y-4 relative">
                  {formMode !== 'view' && (
                    <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-red-500" onClick={() => removeCondition(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Group</Label>
                      <Select value={c.condition_group || 'AND'} onValueChange={v => updateCondition(idx, 'condition_group', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND (Must Pass)</SelectItem>
                          <SelectItem value="OR">OR (One Must Pass)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-3">
                      <Label>Condition Label</Label>
                      <Input placeholder="e.g. State equals Kerala" value={c.condition_label} onChange={e => updateCondition(idx, 'condition_label', e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Source Field</Label>
                      <Select value={c.mapping_id} onValueChange={v => updateCondition(idx, 'mapping_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Select Field" /></SelectTrigger>
                        <SelectContent>{mappings.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Operator</Label>
                      <Select value={c.operator} onValueChange={v => updateCondition(idx, 'operator', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="not_equals">Not Equals</SelectItem>
                          <SelectItem value="greater_than">Greater Than</SelectItem>
                          <SelectItem value="less_than">Less Than</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Value</Label>
                      <Input value={c.compare_value || ''} onChange={e => updateCondition(idx, 'compare_value', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">2. Calculation Rules</h3>
            {formMode !== 'view' && <Button size="sm" variant="outline" onClick={addRule}><Plus className="w-4 h-4 mr-2" /> Add Rule</Button>}
          </div>
          
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No rules = 0 fee calculated.</p>
          ) : (
            <div className="space-y-4">
              {rules.map((r, idx) => (
                <div key={idx} className="p-4 border rounded-md bg-white space-y-4 relative shadow-sm">
                  {formMode !== 'view' && (
                    <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-red-500" onClick={() => removeRule(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Calculation Type</Label>
                      <Select value={r.calculation_type || 'fixed'} onValueChange={v => updateRule(idx, 'calculation_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="slab_based">Slab Based</SelectItem>
                          <SelectItem value="late_fee">Late Fee</SelectItem>
                          <SelectItem value="formula">Formula</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {r.calculation_type === 'fixed' && (
                      <div className="space-y-2 col-span-2">
                        <Label>Fee Amount</Label>
                        <Input type="number" value={r.fee_amount || 0} onChange={e => updateRule(idx, 'fee_amount', parseFloat(e.target.value))} />
                      </div>
                    )}

                    {r.calculation_type === 'formula' && (
                      <div className="space-y-2 col-span-2">
                        <Label>Formula Expression</Label>
                        <Input placeholder="e.g. [Capital] * 0.05 + 1000" value={r.formula_expression || ''} onChange={e => updateRule(idx, 'formula_expression', e.target.value)} />
                      </div>
                    )}

                    {r.calculation_type === 'percentage' && (
                      <>
                        <div className="space-y-2">
                          <Label>Base Field</Label>
                          <Select value={r.calculation_base_mapping_id} onValueChange={v => updateRule(idx, 'calculation_base_mapping_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Select Base" /></SelectTrigger>
                            <SelectContent>{mappings.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Rate (%)</Label>
                          <Input type="number" value={r.percentage_rate || 0} onChange={e => updateRule(idx, 'percentage_rate', parseFloat(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Min Fee (Optional)</Label>
                          <Input type="number" value={r.minimum_fee || ''} onChange={e => updateRule(idx, 'minimum_fee', e.target.value ? parseFloat(e.target.value) : null)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Fee (Optional)</Label>
                          <Input type="number" value={r.maximum_fee || ''} onChange={e => updateRule(idx, 'maximum_fee', e.target.value ? parseFloat(e.target.value) : null)} />
                        </div>
                      </>
                    )}
                    
                    {r.calculation_type === 'slab_based' && (
                      <div className="col-span-3 space-y-4">
                        <div className="space-y-2 max-w-sm">
                          <Label>Slab Base Field</Label>
                          <Select value={r.calculation_base_mapping_id} onValueChange={v => updateRule(idx, 'calculation_base_mapping_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Select Base Field" /></SelectTrigger>
                            <SelectContent>
                              {mappings
                                .filter((m: any) => ['number', 'numeric', 'integer', 'decimal', 'float', 'double', 'date'].includes((m.data_type || '').toLowerCase()))
                                .map((m: any) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="border rounded-md p-4 bg-slate-50 space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm font-semibold">Slabs</Label>
                            {formMode !== 'view' && (
                              <Button size="sm" variant="outline" onClick={() => {
                                const newSlabs = [...(r.slabs || []), { from_value: 0, to_value: null, fee_amount: 0 }];
                                updateRule(idx, 'slabs', newSlabs);
                              }}><Plus className="w-3 h-3 mr-1" /> Add Slab</Button>
                            )}
                          </div>
                          {(r.slabs || []).map((slab: any, sIdx: number) => (
                            <div key={sIdx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                              <div className="space-y-1">
                                <Label className="text-xs">From Value</Label>
                                <Input type="number" value={slab.from_value ?? ''} onChange={e => {
                                  const newSlabs = [...r.slabs];
                                  newSlabs[sIdx] = { ...slab, from_value: e.target.value === '' ? '' : parseFloat(e.target.value) };
                                  updateRule(idx, 'slabs', newSlabs);
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">To Value (Optional)</Label>
                                <Input type="number" placeholder="∞" value={slab.to_value ?? ''} onChange={e => {
                                  const newSlabs = [...r.slabs];
                                  newSlabs[sIdx] = { ...slab, to_value: e.target.value === '' ? null : parseFloat(e.target.value) };
                                  updateRule(idx, 'slabs', newSlabs);
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Fee Amount (₹)</Label>
                                <Input type="number" value={slab.fee_amount ?? ''} onChange={e => {
                                  const newSlabs = [...r.slabs];
                                  newSlabs[sIdx] = { ...slab, fee_amount: e.target.value === '' ? '' : parseFloat(e.target.value) };
                                  updateRule(idx, 'slabs', newSlabs);
                                }} />
                              </div>
                              {formMode !== 'view' && (
                                <Button variant="ghost" size="icon" className="text-red-500 mb-0.5" onClick={() => {
                                  const newSlabs = [...r.slabs];
                                  newSlabs.splice(sIdx, 1);
                                  updateRule(idx, 'slabs', newSlabs);
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.calculation_type === 'late_fee' && (
                      <>
                        <div className="space-y-2">
                          <Label>Due Date Field</Label>
                          <Select value={r.due_date_mapping_id} onValueChange={v => updateRule(idx, 'due_date_mapping_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Select Field" /></SelectTrigger>
                            <SelectContent>{mappings.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Actual Date Field</Label>
                          <Select value={r.actual_date_mapping_id} onValueChange={v => updateRule(idx, 'actual_date_mapping_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Select Field" /></SelectTrigger>
                            <SelectContent>{mappings.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Grace Period (Days)</Label>
                          <Input type="number" value={r.grace_period_days || 0} onChange={e => updateRule(idx, 'grace_period_days', parseInt(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Late Fee Method</Label>
                          <Select value={r.late_fee_method} onValueChange={v => updateRule(idx, 'late_fee_method', v)}>
                            <SelectTrigger><SelectValue placeholder="Select Method" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed_once">Fixed Once</SelectItem>
                              <SelectItem value="per_day">Per Day</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input type="number" value={r.fixed_amount || r.per_day_amount || 0} onChange={e => {
                              const v = parseFloat(e.target.value);
                              updateRule(idx, r.late_fee_method === 'fixed_once' ? 'fixed_amount' : 'per_day_amount', v);
                          }} />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Late Fee</Label>
                          <Input type="number" value={r.maximum_late_fee || ''} onChange={e => updateRule(idx, 'maximum_late_fee', e.target.value ? parseFloat(e.target.value) : null)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </fieldset>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>{formMode === 'view' ? 'Close' : 'Cancel'}</Button>
          {formMode !== 'view' && <Button onClick={handleSave} disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Fee'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

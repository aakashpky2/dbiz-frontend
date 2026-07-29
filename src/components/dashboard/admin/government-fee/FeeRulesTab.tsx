"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, FileText, Layers, Tag, Filter, AlertCircle, RefreshCw, Loader2, IndianRupee, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { governmentFeeService } from '@/services/governmentFeeService';

interface FeeRulesTabProps {
  workTypeId: string;
}

export function FeeRulesTab({ workTypeId }: FeeRulesTabProps) {
  const { toast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Form state
  const [feeName, setFeeName] = useState('');
  const [authorityName, setAuthorityName] = useState('');
  const [amount, setAmount] = useState(0);
  const [calculationType, setCalculationType] = useState('fixed');
  const [formula, setFormula] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [isEditable, setIsEditable] = useState(true);
  const [status, setStatus] = useState('active');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [notes, setNotes] = useState('');
  
  // Conditions array: [{ fieldKey, operator, value, min, max }]
  const [conditions, setConditions] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, fieldsRes] = await Promise.all([
        governmentFeeService.getRules(workTypeId),
        governmentFeeService.getFields(workTypeId)
      ]);
      setRules(rulesRes.data || []);
      setFields(fieldsRes.data || []);
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: e.message || "Failed to load fee rules."
      });
    } finally {
      setLoading(false);
    }
  }, [workTypeId, toast]);

  useEffect(() => {
    if (workTypeId) {
      fetchData();
    }
  }, [workTypeId, fetchData]);

  const handleAdd = () => {
    setEditingRule(null);
    setFeeName('');
    setAuthorityName('');
    setAmount(0);
    setCalculationType('fixed');
    setFormula('');
    setIsRequired(true);
    setIsEditable(true);
    setStatus('active');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
    setNotes('');
    setConditions([]);
    setDialogOpen(true);
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setFeeName(rule.fee_name);
    setAuthorityName(rule.authority_name || '');
    setAmount(Number(rule.amount) || 0);
    setCalculationType(rule.calculation_type);
    setFormula(rule.formula || '');
    setIsRequired(rule.is_required);
    setIsEditable(rule.is_editable);
    setStatus(rule.status);
    setEffectiveFrom(rule.effective_from ? rule.effective_from.split('T')[0] : '');
    setEffectiveTo(rule.effective_to ? rule.effective_to.split('T')[0] : '');
    setNotes(rule.notes || '');
    
    // Parse condition_rules object to array
    const condArr = [];
    if (rule.condition_rules) {
      for (const [key, val] of Object.entries(rule.condition_rules)) {
        condArr.push({
          fieldKey: key,
          ...(val as any)
        });
      }
    }
    setConditions(condArr);
    setDialogOpen(true);
  };

  const confirmDelete = (id: string) => {
    setRuleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!ruleToDelete) return;
    setIsSubmitting(true);
    try {
      await governmentFeeService.deleteRule(ruleToDelete);
      toast({
        title: "Rule Deactivated",
        description: "The fee rule has been marked as inactive successfully."
      });
      fetchData();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Failed to deactivate rule"
      });
    } finally {
      setIsSubmitting(false);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!feeName) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Fee Name is required."
      });
      return;
    }

    // Convert conditions array back to object
    const conditionRules: Record<string, any> = {};
    for (const c of conditions) {
      if (!c.fieldKey || !c.operator) continue;
      
      const payload: any = { operator: c.operator };
      if (c.operator === 'between') {
        payload.min = Number(c.min);
        payload.max = Number(c.max);
      } else if (c.operator === 'in' || c.operator === 'not_in') {
        payload.value = Array.isArray(c.value) ? c.value : c.value.split(',').map((s: string) => s.trim());
      } else {
        payload.value = c.value;
      }
      conditionRules[c.fieldKey] = payload;
    }

    setIsSubmitting(true);
    const payload = {
      work_type_id: workTypeId,
      fee_name: feeName,
      authority_name: authorityName || null,
      amount: amount || 0,
      calculation_type: calculationType,
      formula: calculationType === 'formula' ? formula : null,
      is_required: isRequired,
      is_editable: isEditable,
      status,
      effective_from: effectiveFrom || null,
      effective_to: effectiveTo || null,
      notes: notes || null,
      condition_rules: conditionRules
    };

    try {
      if (editingRule) {
        await governmentFeeService.updateRule(editingRule.id, payload);
        toast({ title: "Success", description: "Fee rule updated successfully." });
      } else {
        await governmentFeeService.createRule(payload);
        toast({ title: "Success", description: "Fee rule created successfully." });
      }
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: e.message || "Failed to save rule."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { fieldKey: '', operator: 'equals', value: '' }]);
  };

  const updateCondition = (index: number, key: string, val: any) => {
    const newCond = [...conditions];
    newCond[index][key] = val;
    setConditions(newCond);
  };

  const removeCondition = (index: number) => {
    const newCond = [...conditions];
    newCond.splice(index, 1);
    setConditions(newCond);
  };

  const renderConditionSummary = (rule: any) => {
    if (!rule.condition_rules || Object.keys(rule.condition_rules).length === 0) {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-dashed">
          Applies to all (Base Rule)
        </Badge>
      );
    }
    const parts = [];
    for (const [key, val] of Object.entries(rule.condition_rules)) {
      const field = fields.find(f => f.field_key === key);
      const label = field ? field.field_label : key;
      const v = val as any;
      if (v.operator === 'between') {
        parts.push(`${label} between ${v.min} & ${v.max}`);
      } else {
        parts.push(`${label} ${v.operator.replace('_', ' ')} ${Array.isArray(v.value) ? v.value.join(', ') : v.value}`);
      }
    }
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {parts.map((p, i) => (
          <Badge key={i} variant="secondary" className="font-normal border bg-blue-50/50 text-blue-700 hover:bg-blue-100">
            {p}
          </Badge>
        ))}
      </div>
    );
  };

  // Metrics
  const totalRules = rules.length;
  const activeRules = rules.filter(r => r.status === 'active').length;
  const baseRules = rules.filter(r => !r.condition_rules || Object.keys(r.condition_rules).length === 0).length;
  const conditionalRules = totalRules - baseRules;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Rules</p>
              <h3 className="text-2xl font-bold">{totalRules}</h3>
            </div>
            <div className="h-10 w-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
              <h3 className="text-2xl font-bold">{activeRules}</h3>
            </div>
            <div className="h-10 w-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Base / Default</p>
              <h3 className="text-2xl font-bold">{baseRules}</h3>
            </div>
            <div className="h-10 w-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center">
              <Tag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Conditional</p>
              <h3 className="text-2xl font-bold">{conditionalRules}</h3>
            </div>
            <div className="h-10 w-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
              <Filter className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border">
        <h3 className="text-lg font-medium px-2">Government Fee Rules</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Fee Rule
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center border rounded-lg bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-muted-foreground">Loading fee rules...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg bg-slate-50">
          <IndianRupee className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h4 className="text-lg font-medium">No Fee Rules Set</h4>
          <p className="text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
            Create calculation rules based on your dynamic fields to auto-calculate government fees.
          </p>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Rule
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={`transition-all flex flex-col hover:shadow-md ${rule.status === 'inactive' ? 'opacity-70 bg-slate-50/50 grayscale-[0.2]' : ''}`}>
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-lg leading-tight flex items-center gap-2">
                      {rule.fee_name}
                      {rule.status === 'inactive' && <Badge variant="destructive" className="h-5 text-[10px] uppercase tracking-wider">Inactive</Badge>}
                    </h4>
                    {rule.authority_name && (
                      <p className="text-sm text-muted-foreground mt-0.5">{rule.authority_name}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold tracking-tight">₹{Number(rule.amount).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{rule.calculation_type}</div>
                  </div>
                </div>
                
                <div className="mb-4 flex-1">
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Conditions</div>
                  {renderConditionSummary(rule)}
                </div>

                <div className="flex flex-wrap gap-2 mb-4 text-xs">
                  {rule.is_required ? (
                    <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Mandatory</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-500">Optional</Badge>
                  )}
                  {rule.is_editable && (
                    <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">Editable in Proposal</Badge>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 pt-3 border-t mt-auto">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => handleEdit(rule)}>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50" 
                    onClick={() => confirmDelete(rule.id)}
                    disabled={rule.status === 'inactive'}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ADD / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !isSubmitting && setDialogOpen(open)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b shrink-0 bg-slate-50/50">
            <DialogTitle className="text-xl">{editingRule ? 'Edit Fee Rule' : 'Add Fee Rule'}</DialogTitle>
            <DialogDescription>
              Define how this government fee should be calculated and when it applies.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* 1. Basic Fee Details */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                <h4 className="text-base font-semibold">Fee Details</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Fee Name <span className="text-red-500">*</span></Label>
                  <Input value={feeName} onChange={(e) => setFeeName(e.target.value)} placeholder="e.g. Form Filing Fee" disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>Authority Name</Label>
                  <Input value={authorityName} onChange={(e) => setAuthorityName(e.target.value)} placeholder="e.g. MCA, State Govt" disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹) <span className="text-red-500">*</span></Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>Calculation Type</Label>
                  <Select value={calculationType} onValueChange={setCalculationType} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="formula">Custom Formula</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {calculationType === 'formula' && (
                  <div className="space-y-2 md:col-span-2 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <Label className="text-blue-900 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Custom Formula
                    </Label>
                    <Input className="font-mono bg-white" value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="e.g. capital * 0.01 + 500" disabled={isSubmitting} />
                    <p className="text-xs text-blue-700">Use field keys as variables (e.g., if you have a field with key 'capital', you can use it in the math formula).</p>
                  </div>
                )}
                
                <div className="flex items-center space-x-8 md:col-span-2 bg-muted/30 p-4 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    <Switch checked={isRequired} onCheckedChange={setIsRequired} id="rule_is_required" disabled={isSubmitting} />
                    <Label htmlFor="rule_is_required" className="cursor-pointer">Mandatory Fee</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={isEditable} onCheckedChange={setIsEditable} id="rule_is_editable" disabled={isSubmitting} />
                    <Label htmlFor="rule_is_editable" className="cursor-pointer">Editable in Proposal</Label>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Condition Builder */}
            <section className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <div className="flex items-center gap-2">
                  <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <h4 className="text-base font-semibold">Conditions</h4>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCondition} disabled={isSubmitting || fields.length === 0}>
                  <Filter className="w-4 h-4 mr-2" /> Add Condition
                </Button>
              </div>
              
              {conditions.length === 0 ? (
                <div className="bg-slate-50 border border-dashed rounded-lg p-6 text-center">
                  <p className="text-muted-foreground mb-2">No conditions applied. This rule will act as a baseline fee for all proposals.</p>
                  <Button type="button" variant="link" onClick={addCondition} disabled={isSubmitting || fields.length === 0}>
                    Add a condition based on dynamic fields
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                  {conditions.map((c, idx) => (
                    <div key={idx} className="flex flex-wrap items-end gap-3 p-4 border rounded-md bg-white shadow-sm relative group">
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-slate-200 text-slate-500 text-[10px] font-bold px-1 py-0.5 rounded uppercase rotate-180" style={{ writingMode: 'vertical-rl' }}>
                        AND
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-[200px] ml-2">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Field</Label>
                        <Select value={c.fieldKey} onValueChange={(v) => updateCondition(idx, 'fieldKey', v)} disabled={isSubmitting}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select dynamic field" />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map(f => (
                              <SelectItem key={f.field_key} value={f.field_key}>{f.field_label} <span className="text-muted-foreground text-xs ml-1">({f.field_type})</span></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 w-[160px]">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operator</Label>
                        <Select value={c.operator} onValueChange={(v) => updateCondition(idx, 'operator', v)} disabled={isSubmitting}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="not_equals">Not Equals</SelectItem>
                            <SelectItem value="greater_than">&gt; Greater Than</SelectItem>
                            <SelectItem value="greater_than_or_equal">&gt;= Greater/Equal</SelectItem>
                            <SelectItem value="less_than">&lt; Less Than</SelectItem>
                            <SelectItem value="less_than_or_equal">&lt;= Less/Equal</SelectItem>
                            <SelectItem value="between">Between</SelectItem>
                            <SelectItem value="in">In List</SelectItem>
                            <SelectItem value="not_in">Not In List</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {c.operator === 'between' ? (
                        <>
                          <div className="space-y-1.5 w-[120px]">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Min Value</Label>
                            <Input type="number" value={c.min || ''} onChange={(e) => updateCondition(idx, 'min', e.target.value)} disabled={isSubmitting} />
                          </div>
                          <div className="space-y-1.5 w-[120px]">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Max Value</Label>
                            <Input type="number" value={c.max || ''} onChange={(e) => updateCondition(idx, 'max', e.target.value)} disabled={isSubmitting} />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                          <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Value</Label>
                          {/* If field type is dropdown, ideally show select here in future */}
                          <Input value={c.value || ''} onChange={(e) => updateCondition(idx, 'value', e.target.value)} placeholder={c.operator === 'in' ? "Values separated by comma" : "Target value to match"} disabled={isSubmitting} />
                        </div>
                      )}

                      <Button type="button" variant="ghost" size="icon" className="mb-0.5 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeCondition(idx)} disabled={isSubmitting}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Validity & Notes */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <h4 className="text-base font-semibold">Validity & Notes</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Effective From</Label>
                  <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>Effective To</Label>
                  <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} disabled={isSubmitting} />
                  <p className="text-[10px] text-muted-foreground">Leave empty for no expiry.</p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label>Internal Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="E.g. Revised as per MCA notification 2026..." rows={2} disabled={isSubmitting} />
                </div>
              </div>
            </section>
          </div>
          
          <DialogFooter className="p-6 border-t shrink-0 bg-slate-50/50">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRule ? 'Update Rule' : 'Save New Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !isSubmitting && setDeleteDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Deactivate Fee Rule</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to deactivate this fee rule? It will no longer be applied to new proposals automatically.</p>
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

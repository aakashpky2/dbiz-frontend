import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

interface Rule {
    id: string;
    condition_field: string;
    operator: string;
    condition_value: string;
    result_action: string;
    result_value: string;
}

interface VisualRuleBuilderProps {
    rules: Rule[];
    onChange: (rules: Rule[]) => void;
}

export function VisualRuleBuilder({ rules, onChange }: VisualRuleBuilderProps) {
    const addRule = () => {
        const newRule: Rule = {
            id: Math.random().toString(36).substring(7),
            condition_field: 'attendance_percentage',
            operator: '>=',
            condition_value: '95',
            result_action: 'set_rating',
            result_value: '10'
        };
        onChange([...(rules || []), newRule]);
    };

    const updateRule = (id: string, field: keyof Rule, value: string) => {
        const updated = rules.map(r => r.id === id ? { ...r, [field]: value } : r);
        onChange(updated);
    };

    const removeRule = (id: string) => {
        onChange(rules.filter(r => r.id !== id));
    };

    return (
        <div className="space-y-4 bg-slate-50 p-4 rounded-lg border">
            <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Calculation Rules</Label>
                <Button variant="outline" size="sm" onClick={addRule}>
                    <Plus className="mr-2 h-3 w-3" /> Add Rule
                </Button>
            </div>

            {(!rules || rules.length === 0) ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                    No rules defined. Add a rule to configure auto-calculations.
                </div>
            ) : (
                <div className="space-y-3">
                    {rules.map((rule, idx) => (
                        <div key={rule.id} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded border shadow-sm text-sm">
                            <span className="font-semibold text-slate-500 text-xs w-6">IF</span>
                            <Input 
                                className="w-32 h-8 text-xs" 
                                placeholder="Field"
                                value={rule.condition_field}
                                onChange={(e) => updateRule(rule.id, 'condition_field', e.target.value)}
                            />
                            <Select 
                                value={rule.operator}
                                onValueChange={(v) => updateRule(rule.id, 'operator', v)}
                            >
                                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value=">">{'>'}</SelectItem>
                                    <SelectItem value="<">{'<'}</SelectItem>
                                    <SelectItem value=">=">{'>='}</SelectItem>
                                    <SelectItem value="<=">{'<='}</SelectItem>
                                    <SelectItem value="=">{'='}</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input 
                                className="w-24 h-8 text-xs" 
                                placeholder="Value"
                                value={rule.condition_value}
                                onChange={(e) => updateRule(rule.id, 'condition_value', e.target.value)}
                            />
                            
                            <span className="font-semibold text-slate-500 text-xs mx-2">THEN</span>
                            
                            <Select 
                                value={rule.result_action}
                                onValueChange={(v) => updateRule(rule.id, 'result_action', v)}
                            >
                                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="set_rating">Rating =</SelectItem>
                                    <SelectItem value="deduct_rating">Deduct Rating</SelectItem>
                                    <SelectItem value="add_rating">Add Rating</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input 
                                className="w-20 h-8 text-xs" 
                                placeholder="Value"
                                value={rule.result_value}
                                onChange={(e) => updateRule(rule.id, 'result_value', e.target.value)}
                            />

                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-red-500" onClick={() => removeRule(rule.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

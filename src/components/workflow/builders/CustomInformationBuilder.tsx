"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CustomField {
    id: string;
    fieldName: string;
    fieldKey: string;
    fieldType: string;
    required: boolean;
    placeholder?: string;
    helpText?: string;
    defaultValue?: string;
    options?: string; // Comma separated for simplicity in builder
}

interface CustomInformationBuilderProps {
    fields: CustomField[];
    onChange: (fields: CustomField[]) => void;
}

const CUSTOM_FIELD_TYPES = [
    'Text', 'Textarea', 'Number', 'Date', 'Time', 'Select', 'MultiSelect', 'Checkbox', 'Radio', 'Email', 'Phone', 'URL', 'Password'
];

export function CustomInformationBuilder({ fields, onChange }: CustomInformationBuilderProps) {

    const addField = () => {
        const newField: CustomField = {
            id: Math.random().toString(36).substring(7),
            fieldName: '',
            fieldKey: '',
            fieldType: 'Text',
            required: false
        };
        onChange([...fields, newField]);
    };

    const removeField = (id: string) => {
        onChange(fields.filter(f => f.id !== id));
    };

    const updateField = (id: string, key: keyof CustomField, value: any) => {
        onChange(fields.map(f => {
            if (f.id === id) {
                const updated = { ...f, [key]: value };
                if (key === 'fieldName') {
                    updated.fieldKey = (value as string).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
                }
                return updated;
            }
            return f;
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Custom Information Fields</h3>
                    <p className="text-sm text-muted-foreground">Define workflow-specific information to be filled by staff/admin.</p>
                </div>
                <Button type="button" onClick={addField} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Field
                </Button>
            </div>

            {fields.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                    No custom fields defined. Click "Add Field" to start.
                </div>
            )}

            <div className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="relative group">
                        <CardContent className="p-4 flex gap-4 items-start">
                            <div className="mt-2 cursor-grab text-muted-foreground hover:text-foreground">
                                <GripVertical className="h-5 w-5" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                                <div className="space-y-2">
                                    <Label>Field Name</Label>
                                    <Input 
                                        value={field.fieldName} 
                                        onChange={(e) => updateField(field.id, 'fieldName', e.target.value)} 
                                        placeholder="e.g. GST Username" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Field Key (Internal)</Label>
                                    <Input 
                                        value={field.fieldKey} 
                                        onChange={(e) => updateField(field.id, 'fieldKey', e.target.value)} 
                                        placeholder="gst_username" 
                                        readOnly
                                        className="bg-muted"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Field Type</Label>
                                    <Select value={field.fieldType} onValueChange={(val) => updateField(field.id, 'fieldType', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CUSTOM_FIELD_TYPES.map(type => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-2 flex flex-col justify-end">
                                    <div className="flex items-center space-x-2 h-10">
                                        <Checkbox 
                                            id={`req-${field.id}`}
                                            checked={field.required} 
                                            onCheckedChange={(val) => updateField(field.id, 'required', !!val)}
                                        />
                                        <Label htmlFor={`req-${field.id}`}>Required</Label>
                                    </div>
                                </div>

                                {['Select', 'MultiSelect', 'Radio'].includes(field.fieldType) && (
                                    <div className="space-y-2 lg:col-span-2">
                                        <Label>Options (Comma Separated)</Label>
                                        <Input 
                                            value={field.options || ''} 
                                            onChange={(e) => updateField(field.id, 'options', e.target.value)} 
                                            placeholder="Option A, Option B, Option C" 
                                        />
                                    </div>
                                )}

                                <div className="space-y-2 lg:col-span-2">
                                    <Label>Help Text (Optional)</Label>
                                    <Input 
                                        value={field.helpText || ''} 
                                        onChange={(e) => updateField(field.id, 'helpText', e.target.value)} 
                                        placeholder="Instructions for the staff..." 
                                    />
                                </div>
                            </div>

                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeField(field.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

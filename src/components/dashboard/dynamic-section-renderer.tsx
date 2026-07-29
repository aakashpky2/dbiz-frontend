'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileText, Info } from 'lucide-react';

interface FieldDefinitionData {
    fieldName: string;
    fieldKey: string;
    fieldType: string;
    inputType: string;
    requirement: string;
    availableQuestion?: string;
    maxLength?: number;
    options?: string[];
}

interface SectionData {
    sectionName: string;
    sectionKey: string;
    fields: FieldDefinitionData[];
}

interface DynamicSectionRendererProps {
    sections: SectionData[];
    data: any;
    onDataChange?: (sectionKey: string, fieldKey: string, value: any) => void;
    readOnly?: boolean;
}

export function DynamicSectionRenderer({ sections, data, onDataChange, readOnly = false }: DynamicSectionRendererProps) {
    if (!sections || sections.length === 0) return null;

    return (
        <div className="space-y-10">
            {sections.map((section) => (
                <Card key={section.sectionKey} className="border-none shadow-xl bg-background/50 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
                    <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 opacity-20" />
                    <CardHeader className="p-8 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl shadow-inner">
                                <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black tracking-tight uppercase">{section.sectionName}</CardTitle>
                                <CardDescription className="font-medium text-sm">Custom specification fields.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-8 pb-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {section.fields.map((field) => {
                                const value = data?.[section.sectionKey]?.[field.fieldKey] || '';
                                
                                return (
                                    <div key={field.fieldKey} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                                                {field.fieldName}
                                                {field.requirement === 'Mandatory' && <span className="text-destructive ml-1">*</span>}
                                            </Label>
                                            {field.requirement === 'If Available' && (
                                                <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                                    Conditional
                                                </Badge>
                                            )}
                                        </div>

                                        {readOnly ? (
                                            <p className="font-bold text-lg p-2 bg-muted/20 rounded-xl border border-dashed min-h-[3rem] flex items-center">
                                                {value || <span className="text-muted-foreground/40 font-medium italic">Empty Protocol</span>}
                                            </p>
                                        ) : (
                                            <div className="relative group">
                                                <Input
                                                    type={field.fieldType === 'Number' ? 'number' : 'text'}
                                                    value={value}
                                                    onChange={(e) => onDataChange?.(section.sectionKey, field.fieldKey, e.target.value)}
                                                    className="h-12 border-2 focus-visible:ring-blue-500 rounded-xl font-medium px-4 transition-all hover:border-blue-400/50"
                                                    placeholder={`Enter ${field.fieldName.toLowerCase()}...`}
                                                    maxLength={field.maxLength || undefined}
                                                />
                                            </div>
                                        )}
                                        
                                        {field.requirement === 'If Available' && field.availableQuestion && !value && (
                                            <div className="flex items-center gap-2 px-2 py-1 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                                <Info className="h-3 w-3 text-amber-600" />
                                                <p className="text-[10px] text-amber-700 font-mediumitalic italic">{field.availableQuestion}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

"use client";

import React, { useEffect, useState } from "react";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/lib/supabase";
import { Control } from "react-hook-form";
import { Loader2 } from "lucide-react";

interface MasterCategory {
    id: string;
    name: string;
    description: string;
    field_type: string;
    is_required: boolean;
    values?: { id: string; name: string }[];
}

interface DynamicFieldsSectionProps {
    formName: string;
    control: Control<any>;
    parentFieldName?: string; // usually "dynamic_fields"
}

export function DynamicFieldsSection({
    formName,
    control,
    parentFieldName = "dynamic_fields",
}: DynamicFieldsSectionProps) {
    const [fields, setFields] = useState<MasterCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDynamicFields = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch category IDs assigned to this form from the mapping table
                const { data: mappings, error: mapError } = await supabase
                    .from("recruitment_form_mappings")
                    .select("category_id")
                    .eq("form_name", formName);

                if (mapError) throw mapError;

                if (mappings && mappings.length > 0) {
                    const categoryIds = mappings.map(m => m.category_id);

                    // 2. Fetch the actual categories
                    const { data: categories, error: catError } = await supabase
                        .from("recruitment_master_categories")
                        .select("*")
                        .in("id", categoryIds)
                        .eq("is_default", false); // Only dynamic ones

                    if (catError) throw catError;

                    if (categories && categories.length > 0) {
                        // 3. Fetch values for dropdowns
                        const fieldsWithValues = await Promise.all(
                            categories.map(async (cat) => {
                                if (cat.field_type === "Dropdown" || cat.field_type === "Multi Select") {
                                    const { data: values } = await supabase
                                        .from("recruitment_master_values")
                                        .select("id, name")
                                        .eq("category_id", cat.id)
                                        .order("name");
                                    return { ...cat, values: values || [] };
                                }
                                return cat;
                            })
                        );
                        setFields(fieldsWithValues);
                    }
                } else {
                    setFields([]);
                }
            } catch (err) {
                console.error("Error fetching dynamic fields:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDynamicFields();
    }, [formName]);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading custom fields...
            </div>
        );
    }

    if (fields.length === 0) return null;

    return (
        <div className="space-y-6 mt-8 p-6 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
            <div className="flex items-center gap-2">
                <div className="h-1 w-8 bg-primary rounded-full" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Additional Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {fields.map((field) => (
                    <FormField
                        key={field.id}
                        control={control}
                        name={`${parentFieldName}.${field.name}`}
                        render={({ field: formField }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-tight">
                                    {field.name}
                                    {field.is_required && <span className="text-destructive font-black">*</span>}
                                </FormLabel>

                                <FormControl>
                                    {renderInput(field, formField)}
                                </FormControl>

                                {field.description && (
                                    <FormDescription className="text-[10px] leading-tight mt-1">
                                        {field.description}
                                    </FormDescription>
                                )}
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                    />
                ))}
            </div>
        </div>
    );
}

function renderInput(config: MasterCategory, formField: any) {
    const { field_type, values, name, is_required } = config;

    switch (field_type) {
        case "Dropdown":
            return (
                <Select
                    onValueChange={formField.onChange}
                    value={formField.value || ""}
                    defaultValue={formField.value}
                >
                    <FormControl>
                        <SelectTrigger className="bg-white border-2 border-slate-100 rounded-xl focus:ring-primary/20 transition-all font-medium">
                            <SelectValue placeholder={`Select ${name}...`} />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl shadow-xl border-slate-100">
                        {values?.map((v) => (
                            <SelectItem key={v.id} value={v.name} className="focus:bg-primary/5 rounded-lg mx-1">
                                {v.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );

        case "Text Input":
        case "Email":
        case "Phone":
            return <Input
                type={field_type === "Email" ? "email" : field_type === "Phone" ? "tel" : "text"}
                placeholder={`Enter ${name.toLowerCase()}...`}
                className="bg-white border-2 border-slate-100 rounded-xl h-11 focus:border-primary/30 transition-all font-medium"
                {...formField}
                value={formField.value || ''}
            />;

        case "Textarea":
            return <Textarea
                placeholder={`Enter ${name.toLowerCase()}...`}
                className="bg-white border-2 border-slate-100 rounded-xl focus:border-primary/30 transition-all font-medium min-h-[100px]"
                {...formField}
                value={formField.value || ''}
            />;

        case "Number":
            return <Input
                type="number"
                placeholder="0"
                className="bg-white border-2 border-slate-100 rounded-xl h-11 focus:border-primary/30 transition-all font-medium"
                {...formField}
                value={formField.value || ''}
                onChange={(e) => formField.onChange(e.target.valueAsNumber)}
            />;

        case "Date":
            return <Input
                type="date"
                className="bg-white border-2 border-slate-100 rounded-xl h-11 focus:border-primary/30 transition-all font-medium"
                {...formField}
                value={formField.value || ''}
            />;

        case "Checkbox":
            return (
                <div className="flex items-center space-x-2 bg-white border-2 border-slate-100 p-3 rounded-xl">
                    <Checkbox
                        id={config.id}
                        checked={!!formField.value}
                        onCheckedChange={formField.onChange}
                    />
                    <label htmlFor={config.id} className="text-sm font-medium text-slate-600 cursor-pointer">
                        {name} {is_required && <span className="text-destructive">*</span>}
                    </label>
                </div>
            );

        case "Radio Button":
            return (
                <RadioGroup onValueChange={formField.onChange} value={formField.value} className="flex flex-wrap gap-4 p-2">
                    {values?.map((v) => (
                        <div key={v.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={v.name} id={`${config.id}-${v.id}`} />
                            <label htmlFor={`${config.id}-${v.id}`} className="text-sm font-medium text-slate-600 cursor-pointer">{v.name}</label>
                        </div>
                    ))}
                </RadioGroup>
            );

        case "File Upload":
            return (
                <Input
                    type="file"
                    className="bg-white border-2 border-slate-100 rounded-xl h-11 focus:border-primary/30 transition-all font-medium cursor-pointer"
                    onChange={(e) => {
                        // In a real app, you'd upload to Supabase storage here and store the URL
                        const file = e.target.files?.[0];
                        if (file) formField.onChange(file.name); // Mocking for now
                    }}
                />
            );

        case "Multi Select":
            return (
                <div className="flex flex-wrap gap-2 p-3 bg-white border-2 border-slate-100 rounded-xl min-h-[44px]">
                    {values?.map((v) => (
                        <div key={v.id} className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                            <Checkbox
                                id={`${name}-${v.id}`}
                                checked={Array.isArray(formField.value) ? formField.value.includes(v.name) : false}
                                onCheckedChange={(checked) => {
                                    const current = Array.isArray(formField.value) ? formField.value : [];
                                    if (checked) {
                                        formField.onChange([...current, v.name]);
                                    } else {
                                        formField.onChange(current.filter((val: string) => val !== v.name));
                                    }
                                }}
                            />
                            <label htmlFor={`${name}-${v.id}`} className="text-xs font-bold text-slate-600 cursor-pointer">{v.name}</label>
                        </div>
                    ))}
                </div>
            )

        default:
            return <Input {...formField} value={formField.value || ''} />;
    }
}


'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as RHFFormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, AlertTriangle, LibraryBig, Inbox, PlusCircle, Edit, Trash2,
  Copy, ArrowUp, ArrowDown, FileText, Users, Settings, Plus, X, ListPlus,
  Search, LayoutGrid, List, FileCheck, ArrowRight, ShieldCheck
} from 'lucide-react';
import { useForm, type SubmitHandler, useFieldArray, useFormContext, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';

import { FieldDefinitionData, SectionData, RoleData, BusinessTypeSetup, fieldDefinitionSchema, sectionSchema, roleFormSchema, businessTypeFormSchema, BusinessTypeFormValues, FIELD_TYPES, INPUT_TYPES, FieldDefinitionValues, RoleFormValues, slugify } from './constants';
import { PageSkeleton } from '@/components/ui/page-skeleton';



function OptionsFieldArray({ nestIndex, fieldArrayName }: { nestIndex: number, fieldArrayName: string }) {
  const { control } = useFormContext<BusinessTypeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${fieldArrayName}.${nestIndex}.options` as any
  });

  return (
    <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-muted ring-1 ring-black/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListPlus className="h-4 w-4 text-primary" />
          <h5 className="text-sm font-semibold">Field Options</h5>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append("")}
          className="h-8 rounded-lg"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Option
        </Button>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <FormField
              control={control}
              name={`${fieldArrayName}.${nestIndex}.options.${index}` as any}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={`Option ${index + 1}`}
                      className="h-9 bg-background focus:bg-background transition-all"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              className="h-9 w-9 text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionFieldArray({
  name,
  countryCodes = [],
  isLoadingCodes = false,
  dynamicTemplates = [],
  target = 'Constitution'
}: {
  name: string;
  countryCodes?: string[];
  isLoadingCodes?: boolean;
  dynamicTemplates?: any[];
  target?: 'Constitution' | 'Role';
}) {
  const { control, register } = useFormContext<BusinessTypeFormValues>();

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: name as any
  });

  return (
    <div className="space-y-8">
      {fields.map((section, index) => (
        <Card key={section.id} className="relative overflow-hidden border-2 border-muted bg-white shadow-sm rounded-2xl transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-muted/5">
            <div className="flex-1 max-w-md">
              <FormField
                control={control}
                name={`${name}.${index}.sectionName` as any}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Section Name (e.g. Business Info)"
                        {...field}
                        value={field.value ?? ''}
                        className="font-bold text-xl border-none p-0 focus-visible:ring-0 bg-transparent h-auto"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1 opacity-50">Data Group {index + 1}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col bg-muted/20 rounded-lg p-0.5 border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, index + 1)}
                  disabled={index === fields.length - 1}
                  className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <Separator orientation="vertical" className="h-8 mx-1" />
              <Button
                type="button"
                onClick={() => remove(index)}
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <FieldListForm
              fieldArrayName={`${name}.${index}.fields`}
              title=""
              icon={List}
              description=""
              countryCodes={countryCodes}
              isLoadingCodes={isLoadingCodes}
              dynamicTemplates={dynamicTemplates}
              target={target}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 mb-2 p-4 bg-muted/10 border-2 border-dashed border-muted-foreground/20 rounded-2xl">
          <p className="w-full text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Quick Section Templates</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ sectionName: 'Business Information', fields: [] })}
            className="h-8 rounded-lg bg-white font-bold text-xs"
          >
            + Business Info
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ sectionName: 'Address Details', fields: [] })}
            className="h-8 rounded-lg bg-white font-bold text-xs"
          >
            + Address Info
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ sectionName: 'Contact Details', fields: [] })}
            className="h-8 rounded-lg bg-white font-bold text-xs"
          >
            + Contact Info
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ sectionName: 'Documents', fields: [] })}
            className="h-8 rounded-lg bg-white font-bold text-xs"
          >
            + Documents
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => append({ sectionName: '', fields: [] })}
          className="w-full h-14 border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl transition-all"
        >
          <PlusCircle className="mr-2 h-5 w-5" /> Initialize New Data Section
        </Button>
      </div>
    </div>
  );
}

function FieldListForm({
  fieldArrayName, title, icon: Icon, description,
  countryCodes = [], isLoadingCodes = false,
  dynamicTemplates = [],
  target = 'Constitution'
}: {
  fieldArrayName: string;
  title: string;
  icon: any;
  description: string;
  countryCodes?: string[];
  isLoadingCodes?: boolean;
  dynamicTemplates?: any[];
  target?: 'Constitution' | 'Role';
}) {
  const { control, watch, setValue, register, formState: { errors }, getValues } = useFormContext<BusinessTypeFormValues>();
  const { fields, append, remove, move } = useFieldArray({ control, name: fieldArrayName as any });
  const watchedFields = watch(fieldArrayName as any);

  const addTemplateField = (fieldName: string, fieldType: any, inputType: any, requirementOverride?: string, maxLengthOverride?: number, availableQuestionOverride?: string) => {
    let requirement = requirementOverride || 'Mandatory';
    let maxLength = maxLengthOverride || 0;

    if (!requirementOverride && !maxLengthOverride) {
      if (fieldType === 'PAN') {
        requirement = 'Optional';
        maxLength = 10;
      } else if (fieldType === 'GSTIN') {
        requirement = 'Optional';
        maxLength = 15;
      } else if (fieldType === 'Phone') {
        requirement = 'Mandatory';
        maxLength = 10;
      }
    }

    append({
      fieldName,
      fieldType,
      inputType,
      requirement,
      availableQuestion: availableQuestionOverride || '',
      maxLength,
      options: [],
      countryCode: fieldType === 'Phone' ? '+91' : undefined,
      isCountryCodeEnabled: fieldType === 'Phone'
    });
  };

  // Standard fixed templates - only Address is kept as a specialized UI component
  // All other fields derived from Master Config

  const filteredTemplates = React.useMemo(() => {
    return dynamicTemplates.filter(t => {
      // Groups implicitly support both targets unless specifically restricted
      if (t.type === 'group') return true;
      if (t.fieldTarget === 'Both') return true;
      return t.fieldTarget === target;
    });
  }, [dynamicTemplates, target]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon className="h-5 w-5 text-primary" />
            <h4 className="text-lg font-semibold">{title}</h4>
          </div>
          <RHFFormDescription>{description}</RHFFormDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Dynamic templates from Master Config - Supports single fields and nested groups */}
          {filteredTemplates.map(t => (
            <Button
              key={t.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (t.type === 'group' && Array.isArray(t.fields)) {
                  // For grouped templates (like Address from Master Config), sort chronologically by specified order
                  const sortedFields = [...t.fields].sort((a: any, b: any) => (a.fieldOrder || 0) - (b.fieldOrder || 0));
                  sortedFields.forEach((f: any) => {
                    append({
                      fieldName: String(f.fieldName || '').trim(),
                      fieldType: f.fieldType || 'Text',
                      inputType: f.inputType || 'TextInput',
                      requirement: f.requirement || 'Optional',
                      availableQuestion: f.availableQuestion || '',
                      maxLength: Math.max(0, parseInt(f.maxLength) || 0),
                      options: f.inputType === 'Dropdown' && f.fieldName === 'Country' ? ['India'] : [],
                      countryCode: f.fieldType === 'Phone' ? '+91' : undefined,
                      isCountryCodeEnabled: f.isCountryCodeEnabled || f.fieldType === 'Phone'
                    });
                  });
                } else {
                  // Traditional single field template
                  addTemplateField(t.name, t.fieldType || 'Text', t.inputType || 'TextInput', t.requirement, t.maxLength, t.availableQuestion);
                }
              }}
              className={cn(
                "h-7 text-[10px] px-2 font-black uppercase tracking-widest border-2 transition-all rounded-lg",
                t.type === 'group'
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary text-primary"
                  : "border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-500 text-emerald-700"
              )}
            >
              + {t.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {fields.length === 0 && (
          <div className="text-center py-8 bg-muted/10 rounded-xl border-2 border-dashed border-muted-foreground/20">
            <p className="text-sm text-muted-foreground">No fields defined yet.</p>
          </div>
        )}

        {fields.map((item, index) => {
          const fieldType = watchedFields?.[index]?.fieldType;
          const inputType = watchedFields?.[index]?.inputType;
          const requirement = watchedFields?.[index]?.requirement;
          const fieldName = watchedFields?.[index]?.fieldName;
          const showOptions = ['Dropdown', 'Checkbox', 'Radio'].includes(inputType);

          // Automation and Smart Validation Logic
          const getStatus = () => {
            if (!fieldName) return 'Pending';
            if (requirement === 'Optional' && !fieldName) return 'Incomplete';
            if (fieldType === 'PAN' && watchedFields?.[index]?.maxLength !== 10) return 'Incomplete';
            if (fieldType === 'GSTIN' && watchedFields?.[index]?.maxLength !== 15) return 'Incomplete';
            if (fieldName && fieldType) return 'Complete';
            return 'Incomplete';
          };

          const status = getStatus();

          return (
            <Card key={item.id} className="relative overflow-hidden rounded-xl border-muted bg-muted/20 shadow-sm transition-all hover:shadow-md">
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300",
                status === 'Complete' ? "bg-emerald-500" : status === 'Incomplete' ? "bg-amber-500" : "bg-primary/40"
              )} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0",
                        status === 'Complete' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          status === 'Incomplete' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-primary/5 text-primary border-primary/20"
                      )}>
                        {status}
                      </Badge>
                    </div>
                    <FormField control={control} name={`${fieldArrayName}.${index}.fieldName` as any} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Field Name (e.g. GST Number)"
                            className="text-lg font-bold bg-transparent border-none p-0 focus-visible:ring-0 placeholder:text-muted-foreground/50 h-auto"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index - 1)} disabled={index === 0} className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-6 mx-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FormField control={control} name={`${fieldArrayName}.${index}.fieldType` as any} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Field Type</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          if (val === 'GSTIN') {
                            setValue(`${fieldArrayName}.${index}.maxLength` as any, 15);
                            setValue(`${fieldArrayName}.${index}.requirement` as any, 'Optional');
                          } else if (val === 'PAN') {
                            setValue(`${fieldArrayName}.${index}.maxLength` as any, 10);
                            setValue(`${fieldArrayName}.${index}.requirement` as any, 'Optional');
                          } else if (val === 'Phone') {
                            setValue(`${fieldArrayName}.${index}.requirement` as any, 'Mandatory');
                            setValue(`${fieldArrayName}.${index}.maxLength` as any, 10);
                          } else if (val === 'File Upload') {
                            setValue(`${fieldArrayName}.${index}.inputType` as any, 'FileUpload');
                          }
                        }}
                        value={field.value as string}
                      >
                        <FormControl><SelectTrigger className="bg-background h-9 text-sm"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={control} name={`${fieldArrayName}.${index}.inputType` as any} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Input Control Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value as string}>
                        <FormControl><SelectTrigger className="bg-background h-9 text-sm"><SelectValue placeholder="Select UI" /></SelectTrigger></FormControl>
                        <SelectContent>{INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={control} name={`${fieldArrayName}.${index}.requirement` as any} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Requirement</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value as string}>
                        <FormControl><SelectTrigger className="bg-background h-9 text-sm"><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Mandatory">Mandatory</SelectItem>
                          <SelectItem value="Optional">Optional</SelectItem>
                          <SelectItem value="If Available">If Available</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {fieldType === 'Phone' ? (
                    <div className="flex gap-2">
                      <FormField control={control} name={`${fieldArrayName}.${index}.countryCode` as any} render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Code</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value as string || '+91'} disabled={isLoadingCodes}>
                            <FormControl>
                              <SelectTrigger className="bg-background h-9 text-[11px] font-bold">
                                {isLoadingCodes ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : <SelectValue placeholder="+91" />}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countryCodes.length > 0 ? (
                                countryCodes.map(c => <SelectItem key={c} value={c} className="text-xs font-bold">{c}</SelectItem>)
                              ) : (
                                <SelectItem value="+91" className="text-xs font-bold">+91</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name={`${fieldArrayName}.${index}.maxLength` as any} render={({ field }) => (
                        <FormItem className="w-20">
                          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Length</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="bg-background h-9 text-[11px] font-bold"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  ) : fieldType === 'File Upload' ? (
                    <FormField control={control} name={`${fieldArrayName}.${index}.isMultipleUpload` as any} render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 bg-background h-9 mt-6">
                        <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Multiple?</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="scale-75" /></FormControl>
                      </FormItem>
                    )} />
                  ) : (
                    <FormField control={control} name={`${fieldArrayName}.${index}.maxLength` as any} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Max Length</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0 for no limit"
                            className="bg-background h-9 text-sm font-mono"
                            {...field}
                            value={field.value ?? ''}
                            onKeyDown={(e) => ["-", "e", "E", "+"].includes(e.key) && e.preventDefault()}
                            onChange={e => {
                              const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0);
                              field.onChange(val);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>

                {fieldType === 'File Upload' && (
                  <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCheck className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-900 uppercase tracking-tight">Upload Supporting Documents</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">Allows PDF, JPG, PNG formats for secure storage.</p>
                  </div>
                )}

                {requirement === 'If Available' && (
                  <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <FormField control={control} name={`${fieldArrayName}.${index}.availableQuestion` as any} render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2 mb-2">
                          <Settings className="h-4 w-4 text-primary" />
                          <FormLabel className="text-sm font-semibold text-primary">Conditional Question</FormLabel>
                        </div>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="e.g., Do you have a PAN Card?"
                            className="bg-background h-10 border-primary/20 focus-visible:ring-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {showOptions && (
                  <OptionsFieldArray nestIndex={index} fieldArrayName={fieldArrayName} />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({
          fieldName: '',
          fieldType: 'Text',
          inputType: 'TextInput',
          requirement: 'Optional',
          availableQuestion: '',
          maxLength: 0,
          options: []
        })}
        className="w-full h-10 border-dashed hover:bg-muted/50 transition-colors"
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Field
      </Button>
    </div>
  );
}

function RoleItemForm({
  roleIndex, removeRole, handleCopyDetailsFromRole,
  countryCodes, isLoadingCodes, savedRoles, setSavedRoles, dynamicTemplates = []
}: {
  roleIndex: number;
  removeRole: (index: number) => void;
  handleCopyDetailsFromRole: (targetIndex: number, sourceIndex: number) => void;
  countryCodes?: string[];
  isLoadingCodes?: boolean;
  savedRoles: Record<number, boolean>;
  setSavedRoles: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  dynamicTemplates?: any[];
}) {
  const form = useFormContext<BusinessTypeFormValues>();
  const { control } = form;

  return (
    <Card className="p-4 bg-muted/30 border shadow-sm rounded-xl">
      <CardHeader className="p-0 pb-3 flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h4 className="text-md font-bold">Functional Role Definition {roleIndex + 1}</h4>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 ml-2">
            Level {form.watch(`roles.${roleIndex}.hierarchyLevel`)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const roleValues = form.getValues(`roles.${roleIndex}`);
              // Basic validation check (DO NOT trigger full form validation)
              if (!roleValues?.roleName) return;
              setSavedRoles(prev => ({ ...prev, [roleIndex]: true }));
            }}
            className="h-8 text-xs font-bold bg-white text-green-700 border-green-200 hover:bg-green-50 mr-2"
          >
            Save Role
          </Button>
          {form.watch('roles')?.filter((_, i) => i !== roleIndex).length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-bold bg-white text-blue-700 border-blue-200 hover:bg-blue-50">
                  <Copy className="mr-1 h-3.5 w-3.5" /> Clone Config
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {form.watch('roles')?.map((r, idx) => {
                  if (idx === roleIndex) return null;

                  // Skip displaying the actual current user role in any cloning dropdown
                  // for better UX and preventing self-cloning loops
                  const currentUserName = "Super Admin"; // Example: in real app, get from session
                  if (r.roleName === currentUserName) return null;

                  return (
                    <DropdownMenuItem
                      key={idx}
                      onClick={() => handleCopyDetailsFromRole(roleIndex, idx)}
                      className="cursor-pointer font-medium text-sm"
                    >
                      From {r.roleName || `Role ${idx + 1}`}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => removeRole(roleIndex)} className="h-8 text-xs text-destructive hover:bg-destructive/10">
            <Trash2 className="mr-1 h-4 w-4" /> Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control} name={`roles.${roleIndex}.roleName`} render={({ field }) => (
            <FormItem><FormLabel className="font-semibold text-xs uppercase text-muted-foreground">Role Name <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="e.g., Partner, Director" {...field} value={field.value ?? ''} className="h-10 rounded-xl" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField
            control={control}
            name={`roles.${roleIndex}.hierarchyLevel`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Hierarchy Level</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1 = Highest"
                    value={field.value ?? ''}
                    onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                    onChange={(e) => field.onChange(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 rounded-xl font-bold"
                  />
                </FormControl>
                <p className="text-[10px] text-muted-foreground">Lower number = higher authority</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <FormField control={control} name={`roles.${roleIndex}.isManagementRole`} render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border p-3 bg-background shadow-sm">
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-semibold">Management Authority</FormLabel>
                <RHFFormDescription className="text-[10px]">Does this role have signing/approval rights?</RHFFormDescription>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control} name={`roles.${roleIndex}.minMembers`} render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-xs uppercase text-muted-foreground">Min Members <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g., 1"
                  value={field.value ?? ''}
                  onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0);
                    field.onChange(val);
                    // Proactive Sync: If 0 is first keep both at 0
                    if (val === 0) {
                      form.setValue(`roles.${roleIndex}.maxMembers`, 0, { shouldValidate: true });
                    } else if (typeof val === 'number' && val > 0) {
                      const { maxMembers } = form.getValues(`roles.${roleIndex}`);
                      if (maxMembers === 0 || maxMembers < val) {
                        form.setValue(`roles.${roleIndex}.maxMembers`, val, { shouldValidate: true });
                      }
                    }
                  }}
                  className="h-10 rounded-xl border-2 shadow-sm focus-visible:ring-primary font-bold"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={control} name={`roles.${roleIndex}.maxMembers`} render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="font-semibold text-xs uppercase text-muted-foreground">Max Members <span className="text-destructive">*</span></FormLabel>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => form.setValue(`roles.${roleIndex}.maxMembers`, -1)}
                  className="h-6 text-[10px] font-bold text-primary hover:bg-primary/10"
                >
                  Unlimited
                </Button>
              </div>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g., 50 (0 for no limit)"
                  {...field}
                  value={field.value === -1 ? '' : (field.value ?? '')}
                  onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      field.onChange(-1); // treat empty as unlimited
                    } else {
                      field.onChange(Number(val));
                    }
                  }}
                  className="h-10 rounded-xl border-2 shadow-sm focus-visible:ring-primary font-bold"
                />
              </FormControl>
              <RHFFormDescription className="text-[10px] font-medium opacity-60">Set 0 for both if no limits are required. Use Unlimited for no maximum cap.</RHFFormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="space-y-4">
          <FormLabel className="font-semibold text-xs uppercase text-muted-foreground flex items-center justify-between">
            Official Designations
          </FormLabel>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border-2 border-muted/40 bg-muted/5">
            <FormField control={control} name={`roles.${roleIndex}.designations`} render={({ field }) => (
              <>
                {(field.value || []).map((desc: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="pl-3 pr-1 py-1 h-8 rounded-lg font-black text-xs uppercase tracking-wider border-2 shadow-sm group">
                    {desc}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = [...(field.value || [])];
                        next.splice(idx, 1);
                        field.onChange(next);
                      }}
                      className="h-6 w-6 ml-1 hover:bg-destructive/10 hover:text-destructive rounded-md opacity-50 group-hover:opacity-100 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
                <div className="flex-1 min-w-[150px]">
                  <Input
                    placeholder="e.g. Director"
                    className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 font-medium text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !(field.value || []).includes(val)) {
                          field.onChange([...(field.value || []), val]);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </>
            )} />
          </div>
          <RHFFormDescription className="text-[10px] font-medium opacity-60">Add designations and press enter or click the add button.</RHFFormDescription>
        </div>
        <Separator className="my-2" />

        <div className="space-y-4">
          <SectionFieldArray
            name={`roles.${roleIndex}.requiredDetails`}
            countryCodes={countryCodes}
            isLoadingCodes={isLoadingCodes}
            dynamicTemplates={dynamicTemplates}
            target="Role"
          />
        </div>
      </CardContent>
      <RoleUpdateEffect index={roleIndex} setSavedRoles={setSavedRoles} />
    </Card>
  );
}

function RoleUpdateEffect({ index, setSavedRoles }: { index: number, setSavedRoles: React.Dispatch<React.SetStateAction<Record<number, boolean>>> }) {
  const { watch } = useFormContext<BusinessTypeFormValues>();
  const roleValue = watch(`roles.${index}`);

  useEffect(() => {
    setSavedRoles(prev => ({ ...prev, [index]: false }));
  }, [roleValue, index, setSavedRoles]);

  return null;
}

export default function BusinessTypesPage() {
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeSetup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBusinessType, setEditingBusinessType] = useState<BusinessTypeSetup | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [typeToDeleteId, setTypeToDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [dynamicTemplates, setDynamicTemplates] = useState<any[]>([]);
  const [savedRoles, setSavedRoles] = useState<Record<number, boolean>>({});
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { toast } = useToast();

  const form = useForm<BusinessTypeFormValues>({
    resolver: zodResolver(businessTypeFormSchema),
    defaultValues: { businessType: '', businessSubType: '', requiredSections: [], roles: [] },
    mode: 'onChange'
  });


  const { control, formState: { errors } } = form;
  const { fields: roleFields, append: appendRole, remove: removeRole } = useFieldArray({ control, name: "roles" });

  const fetchBusinessTypes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('business_constitutions')
        .select('*')
        .order('display_order', { ascending: true })
        .order('sub_display_order', { ascending: true });

      if (supabaseError) throw supabaseError;

      const typesData: BusinessTypeSetup[] = (data || []).map(item => ({
        id: item.id,
        businessType: item.business_type || '',
        businessSubType: item.business_sub_type || '',
        type_subtype_key: item.type_subtype_key || '',
        display_order: item.display_order || 0,
        sub_display_order: item.sub_display_order || 0,
        required_fields: item.required_fields || [],
        roles: item.roles || [],
      }));
      setBusinessTypes(typesData);
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchCountryCodes = useCallback(async () => {
    setIsLoadingCodes(true);
    try {
      const { data: catData } = await supabase
        .from('app_master_categories')
        .select('id')
        .eq('name', 'Country Codes')
        .maybeSingle();

      if (catData?.id) {
        const { data: valData } = await supabase
          .from('app_master_values')
          .select('name')
          .eq('category_id', catData.id)
          .order('order', { ascending: true });

        if (valData) {
          setCountryCodes(valData.map(v => v.name));
        }
      }
    } catch (error) {
            console.error("Error fetching country codes:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
      setIsLoadingCodes(false);
    }
  }, []);

  const fetchDynamicTemplates = useCallback(async () => {
    try {
      const { data: allCats } = await supabase.from('app_master_categories').select('id, name');
      const constitutionCat = allCats?.find(c => c.name.toLowerCase() === 'constitution');
      if (!constitutionCat) return;
      const { data: valData } = await supabase.from('app_master_values').select('name, description').eq('category_id', constitutionCat.id).order('order', { ascending: true });
      if (valData) {
        setDynamicTemplates(valData.map(v => {
          let parsed = {};
          try {
            parsed = JSON.parse(v.description || '{}');
          } catch { }
          return {
            name: v.name,
            ...parsed,
            fieldTarget: (parsed as any).fieldTarget || 'Both'
          };
        }));
      }
    } catch (error) {
            console.error('Error fetching templates:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        }
  }, []);

  useEffect(() => {
    fetchBusinessTypes();
    fetchCountryCodes();
    fetchDynamicTemplates();
  }, [fetchBusinessTypes, fetchCountryCodes, fetchDynamicTemplates]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log("RHF VALIDATION ERRORS:", errors);
    }
  }, [errors]);

  const handleFormSubmit: SubmitHandler<BusinessTypeFormValues> = useCallback(async (data) => {
    console.log("SUBMITTING DATA:", data);
    setIsSubmitting(true);
    try {
      const trimmedType = data.businessType.trim();
      const trimmedSubType = data.businessSubType.trim();
      const typeSubtypeKey = `${trimmedType.toLowerCase()}_${trimmedSubType.toLowerCase()}`;

      const { data: duplicateData, error: duplicateError } = await supabase
        .from('business_constitutions')
        .select('id')
        .eq('type_subtype_key', typeSubtypeKey);

      if (duplicateError) throw duplicateError;

      const isDuplicate = duplicateData?.some(item => !editingBusinessType || item.id !== editingBusinessType.id);
      if (isDuplicate) {
        toast({ title: "Configuration Exists", description: `"${trimmedType} / ${trimmedSubType}" is already defined.`, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const processFields = (fields: FieldDefinitionValues[] = []) => {
        const seenKeys = new Set();
        return fields.map(({ fieldName, fieldType, inputType, requirement, availableQuestion, maxLength, options, countryCode, isMultipleUpload }) => {
          let baseKey = slugify(fieldName);
          let uniqueKey = baseKey;
          let counter = 1;
          while (seenKeys.has(uniqueKey)) {
            uniqueKey = `${baseKey}_${counter++}`;
          }
          seenKeys.add(uniqueKey);

          return {
            fieldName,
            fieldType,
            inputType,
            requirement,
            availableQuestion: requirement === 'If Available' ? availableQuestion : '',
            fieldKey: uniqueKey,
            maxLength: maxLength || 0,
            options: options || [],
            countryCode: fieldType === 'Phone' ? countryCode : null,
            isMultipleUpload: fieldType === 'File Upload' ? isMultipleUpload : null,
          };
        });
      };

      const processSections = (sections: any[] = []) => {
        return sections.map(section => ({
          sectionName: section.sectionName,
          sectionKey: slugify(section.sectionName),
          fields: processFields(section.fields)
        }));
      };

      const processedRoles = [...(data.roles || [])]
        .sort((a, b) => a.hierarchyLevel - b.hierarchyLevel)
        .map(role => ({
          roleKey: slugify(role.roleName),
          roleName: role.roleName,
          isManagementRole: role.isManagementRole,
          minMembers: role.minMembers,
          maxMembers: role.maxMembers,
          hierarchyLevel: role.hierarchyLevel,
          designations: role.designations || [],
          requiredDetails: processSections(role.requiredDetails),
        }));

      let resolvedDisplayOrder = Math.max(0, parseInt(String(data.display_order)) || 0);

      // INSERT CASE: Ensure a new subtype inherits the existing display_order for its business_type
      if (!editingBusinessType) {
        const { data: existing } = await supabase
          .from('business_constitutions')
          .select('display_order')
          .eq('business_type', trimmedType)
          .limit(1)
          .maybeSingle();

        if (existing) {
          resolvedDisplayOrder = existing.display_order;
        }
      }

      const businessTypeData = {
        name: `${trimmedType} - ${trimmedSubType}`,
        business_type: trimmedType,
        business_sub_type: trimmedSubType,
        type_subtype_key: typeSubtypeKey,
        display_order: resolvedDisplayOrder,
        sub_display_order: Math.max(0, parseInt(String(data.sub_display_order)) || 0),
        required_fields: processSections(data.requiredSections),
        roles: processedRoles,
      };

      // GLOBAL RE-INDEXING LOGIC (NO COLLISION, GLOBAL CONSISTENCY)
      // STEP 1: Fetch ALL unique business_types with their display_order
      const { data: allTypes, error: fetchError } = await supabase
        .from('business_constitutions')
        .select('business_type, display_order');

      if (fetchError) throw fetchError;
      if (!allTypes) throw new Error("Failed to fetch types");

      // STEP 2: Create unique list (group by business_type)
      const uniqueTypesMap = new Map<string, number>();
      allTypes.forEach(item => {
        if (!uniqueTypesMap.has(item.business_type)) {
          uniqueTypesMap.set(item.business_type, item.display_order ?? 0);
        }
      });

      let uniqueSortableTypes = Array.from(uniqueTypesMap.entries())
        .map(([type, order]) => ({ business_type: type, display_order: order }))
        .sort((a, b) => a.display_order - b.display_order);

      // STEP 3: Remove current type (we'll reinsert)
      uniqueSortableTypes = uniqueSortableTypes.filter(t => t.business_type !== trimmedType);

      // STEP 4: Insert at new position
      const targetPos = Math.min(businessTypeData.display_order, uniqueSortableTypes.length);
      uniqueSortableTypes.splice(targetPos, 0, {
        business_type: trimmedType,
        display_order: businessTypeData.display_order
      });

      // STEP 5: Normalize order (0,1,2,3...)
      const normalizedTypes = uniqueSortableTypes.map((item, index) => ({
        ...item,
        display_order: index
      }));

      // STEP 6: Update ALL rows safely
      for (const item of normalizedTypes) {
        // Skip the current item if we are about to update it anyway in the single row update/insert below
        // Actually, we should update ALL rows of that type to ensure they all share the same display_order
        const { error: syncError } = await supabase
          .from('business_constitutions')
          .update({ display_order: item.display_order })
          .eq('business_type', item.business_type);
        if (syncError) throw syncError;
      }

      // Finally, handle the specific row update/insert
      if (editingBusinessType) {
        const { error: updateError } = await supabase
          .from('business_constitutions')
          .update(businessTypeData)
          .eq('id', editingBusinessType.id);
        if (updateError) throw updateError;
        toast({ title: "Constitution Updated" });
      } else {
        const { error: insertError } = await supabase
          .from('business_constitutions')
          .insert(businessTypeData);
        if (insertError) throw insertError;
        toast({ title: "Constitution Saved" });
      }

      setIsFormDialogOpen(false);
      await fetchBusinessTypes();
    } catch (err: any) {
      console.error("CONSTITUTION SAVE FAILED:", err);
      toast({ title: "Failed to Save", description: err.message || "An unknown error occurred", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [editingBusinessType, fetchBusinessTypes, toast]);

  const openAddDialog = useCallback(() => {
    setEditingBusinessType(null);
    form.reset({
      businessType: '',
      businessSubType: '',
      display_order: 0,
      sub_display_order: 0,
      requiredSections: [],
      roles: [{
        roleName: 'Role 1',
        isManagementRole: true,
        minMembers: 0,
        maxMembers: 0,
        hierarchyLevel: 1,
        designations: [],
        requiredDetails: []
      }]
    });
    setIsFormDialogOpen(true);
  }, [form]);

  const openEditDialog = useCallback((businessType: BusinessTypeSetup) => {
    setEditingBusinessType(businessType);
    setIsFormDialogOpen(true);
  }, []);

  useEffect(() => {
    if (editingBusinessType && isFormDialogOpen) {
      const rolesForForm = (editingBusinessType.roles || []).map(role => ({
        ...role,
        hierarchyLevel: role.hierarchyLevel || 1,
        designations: role.designations || [],
        requiredDetails: role.requiredDetails || [],
      }));
      form.reset({
        ...editingBusinessType,
        display_order: editingBusinessType.display_order || 0,
        sub_display_order: editingBusinessType.sub_display_order || 0,
        requiredSections: editingBusinessType.required_fields || [],
        roles: rolesForForm as any,
      });
    }
  }, [editingBusinessType, isFormDialogOpen, form]);

  const handleDeleteClick = useCallback((id: string) => {
    setTypeToDeleteId(id);
    setShowDeleteConfirm(true);
  }, []);

  const executeDelete = useCallback(async () => {
    if (!typeToDeleteId) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase.from('business_constitutions').delete().eq('id', typeToDeleteId);
      if (deleteError) throw deleteError;
      toast({ title: "Configuration Deleted" });
      await fetchBusinessTypes();
    } catch (err: any) {
      toast({ title: "Deletion Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
      setTypeToDeleteId(null);
      setEditingBusinessType(null);
    }
  }, [typeToDeleteId, fetchBusinessTypes, toast]);

  const handleCopyDetailsFromRole = useCallback((targetIndex: number, sourceIndex: number) => {
    if (sourceIndex >= 0) {
      const sourceRole = form.getValues(`roles.${sourceIndex}`);

      // We must strip the internal 'id' from react-hook-form useFieldArray, otherwise it causes collisions.
      const clonedDetails = (sourceRole.requiredDetails || []).map((item: any) => {
        const { id, ...rest } = item;
        return rest;
      });

      // Clone everything except the roleName itself
      form.setValue(`roles.${targetIndex}.isManagementRole`, sourceRole.isManagementRole, { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.minMembers`, sourceRole.minMembers, { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.maxMembers`, sourceRole.maxMembers, { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.designations`, [...(sourceRole.designations || [])], { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.requiredDetails`, clonedDetails, { shouldValidate: true, shouldDirty: true });

      toast({ title: "Configuration Cloned", description: `Role logic successfully copied.` });
    }
  }, [form, toast]);

  const handleCloneConstitution = useCallback((typeId: string) => {
    const type = businessTypes.find(t => t.id === typeId);
    if (!type) return;

    const clonedSections = (type.required_fields || []).map((section: any) => ({
      sectionName: section.sectionName,
      fields: (section.fields || []).map((item: any) => {
        const { id, ...rest } = item;
        return rest;
      })
    }));

    const clonedRoles = (type.roles || []).map((role: any) => {
      return {
        roleName: role.roleName,
        isManagementRole: role.isManagementRole,
        minMembers: role.minMembers,
        maxMembers: role.maxMembers,
        hierarchyLevel: role.hierarchyLevel || 1,
        designations: [...(role.designations || [])],
        requiredDetails: (role.requiredDetails || []).map((section: any) => ({
          sectionName: section.sectionName,
          fields: (section.fields || []).map((rd: any) => {
            const { id, ...rest } = rd;
            return rest;
          })
        }))
      };
    });

    form.setValue('requiredSections', clonedSections, { shouldValidate: true, shouldDirty: true });
    form.setValue('roles', clonedRoles, { shouldValidate: true, shouldDirty: true });

    toast({ title: "Setup Cloned", description: `Imported fields and roles from ${type.businessType} - ${type.businessSubType}.` });
  }, [businessTypes, form, toast]);

  const filteredTypes = React.useMemo(() =>
    businessTypes.filter(type =>
      type.businessType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      type.businessSubType.toLowerCase().includes(searchQuery.toLowerCase())
    ), [businessTypes, searchQuery]);

  const stats = React.useMemo(() => [
    { label: 'Constitution', value: businessTypes.length, icon: LibraryBig, color: 'text-blue-600', bg: 'bg-blue-600/10' },
  ], [businessTypes.length]);

  const primaryTypes = useMemo(() => {
    const map = new Map();
    businessTypes.forEach(item => {
      if (!map.has(item.businessType)) {
        map.set(item.businessType, item.display_order);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([type]) => type);
  }, [businessTypes]);

  const filteredSubTypes = useMemo(() => {
    if (!selectedType) return [];
    return businessTypes
      .filter(item => item.businessType === selectedType)
      .sort((a, b) => a.sub_display_order - b.sub_display_order);
  }, [businessTypes, selectedType]);

  useEffect(() => {
    if (primaryTypes.length > 0) {
      if (!selectedType || !primaryTypes.includes(selectedType)) {
        setSelectedType(primaryTypes[0]);
      }
    } else {
      setSelectedType(null);
    }
  }, [primaryTypes, selectedType]);

  return (
    <div className="space-y-8 pb-8">
      <DashboardPageHeader
        title={
          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold tracking-tight">Business Constitutions</span>
            <Badge variant="secondary" className="h-5 rounded-full px-2 font-medium text-xs bg-muted text-muted-foreground border-border">
              {businessTypes.length}
            </Badge>
          </div>
        }
        description="Define the blueprint for different legal entity structures."
      >
        <Button onClick={openAddDialog} className="h-10 rounded-lg font-medium px-4">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Constitution
        </Button>
      </DashboardPageHeader>

      <DashboardFilterBar>
        <div className="flex-1 relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            placeholder="Search constitutions..."
            className="h-10 pl-9 rounded-lg bg-background border-border shadow-sm text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </DashboardFilterBar>

      {/* Main Content */}
      <div className="min-h-[500px]">
        {isLoading ? (<div className="p-6"><PageSkeleton /></div>) : error ? (
          <Alert variant="destructive" className="rounded-[2.5rem] border-4 p-8 bg-destructive/5 backdrop-blur-xl shadow-2xl shadow-destructive/10">
            <div className="flex items-start gap-6">
              <div className="p-3 bg-destructive/10 rounded-2xl"><AlertTriangle className="h-12 w-12" /></div>
              <div>
                <AlertTitle className="text-3xl font-black mb-3">System Interrupt</AlertTitle>
                <AlertDescription className="text-xl font-medium opacity-80 leading-relaxed">{error}</AlertDescription>
                <Button variant="outline" className="mt-6 rounded-xl border-destructive/20 hover:bg-destructive hover:text-white transition-all font-bold" onClick={() => fetchBusinessTypes()}>
                  Retry Connection
                </Button>
              </div>
            </div>
          </Alert>
        ) : filteredTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-muted/5 rounded-[4rem] border-4 border-dashed border-muted/50 transition-all duration-700 hover:bg-muted/10">
            <div className="p-10 bg-background rounded-full mb-10 shadow-2xl ring-1 ring-black/5 ring-offset-4 ring-offset-background group">
              <Inbox className="h-24 w-24 text-muted-foreground/20 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-4xl font-black tracking-tighter mb-4">No match found</h3>
            <p className="text-muted-foreground max-w-md text-center text-lg font-medium leading-relaxed opacity-70">
              The query did not return any existing business configurations. Please verify the keyword or constitution parameters.
            </p>
            <Button variant="outline" className="mt-12 rounded-[1.5rem] h-14 px-12 font-black text-xs uppercase tracking-[0.2em] border-2 shadow-xl hover:bg-background transition-all" onClick={() => setSearchQuery('')}>
              Reset Filters
            </Button>
          </div>
                ) : (
          <div className="flex flex-col md:flex-row items-start gap-8 min-h-[calc(100vh-280px)]">
            {/* LEFT SIDEBAR - Primary Constitutions */}
            <div className="w-full md:w-[260px] shrink-0 border border-border rounded-xl bg-card shadow-sm p-3 flex flex-col gap-1">
              <div className="px-3 py-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Primary Categories
                </h3>
              </div>
              {primaryTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "w-full text-left px-3 h-11 rounded-lg text-sm font-medium transition-colors relative flex items-center group",
                    selectedType === type
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {selectedType === type && <div className="w-1 h-4 rounded-full bg-primary" />}
                    {type}
                  </div>
                </button>
              ))}
            </div>

            {/* RIGHT CONTENT - Sub Types */}
            <div className="flex-1 w-full">
              {filteredSubTypes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
                  <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No constitutions defined in this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSubTypes.map((type) => (
                    <Card key={type.id} className="relative group overflow-hidden border border-border hover:border-primary/20 hover:shadow-md transition-all duration-200 rounded-xl bg-card flex flex-col h-full shadow-sm">
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(type.id)} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <CardHeader className="pb-4 pt-5 px-5 flex-grow">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary" className="px-2.5 py-0.5 rounded-full text-xs font-normal bg-muted text-muted-foreground border-transparent">
                            {type.businessType}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl font-semibold tracking-tight text-foreground pr-16">
                          {type.businessSubType}
                        </CardTitle>
                      </CardHeader>

                      <CardFooter className="pt-0 pb-5 px-5 mt-auto">
                        <Button variant="secondary" className="w-full h-9 justify-between text-sm font-medium hover:bg-primary/5 hover:text-primary transition-colors" onClick={() => openEditDialog(type)}>
                          Manage Constitution
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- Designer Modal --- */}
      <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
        if (!open) { setIsFormDialogOpen(false); setEditingBusinessType(null); form.reset(); }
        else { setIsFormDialogOpen(true); }
      }}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] bg-background">
          <DialogHeader className="flex flex-row items-center justify-between gap-4 px-6 py-4 border-b border-border bg-background shrink-0 space-y-0 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Settings className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-tight text-foreground leading-tight">
                  {editingBusinessType ? 'Edit Business Constitution' : 'Add Business Constitution'}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-muted-foreground leading-5">
                  {editingBusinessType ? 'Update constitution details and field configuration.' : 'Configure constitution details and applicable fields.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto px-6 py-5 custom-scrollbar bg-background/30 backdrop-blur-2xl">
            <FormProvider {...form}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-16">
                  {/* Entity Core */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-muted/50 pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted"><FileText className="h-4 w-4 text-foreground" /></div>
                        <h3 className="text-base font-semibold">Constitution Details</h3>
                      </div>
                      {businessTypes.length > 0 && !editingBusinessType && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-lg font-bold text-xs bg-white text-blue-700 border-blue-200 hover:bg-blue-50 shadow-sm transition-all hover:scale-105">
                              <Copy className="mr-2 h-4 w-4" /> Clone Existing Setup
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[300px] max-h-[350px] overflow-y-auto rounded-xl p-1 shadow-2xl">
                            {businessTypes.map((type: any) => (
                              <DropdownMenuItem
                                key={type.id}
                                onClick={() => handleCloneConstitution(type.id)}
                                className="cursor-pointer font-semibold text-xs py-3 px-4 rounded-lg hover:bg-blue-50 transition-colors border-b last:border-0 border-muted/30"
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="text-primary font-black uppercase tracking-wider">{type.businessType}</span>
                                  <span className="opacity-70">{type.businessSubType}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField control={control} name="businessType" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Primary Constitution</FormLabel>
                          <FormControl><Input placeholder="e.g., Company" {...field} value={field.value ?? ''} className="h-11 bg-background border-2 focus-visible:ring-primary rounded-xl shadow-sm text-base font-bold px-4 border-muted/40" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="businessSubType" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Sub Category</FormLabel>
                          <FormControl><Input placeholder="e.g., Private Limited" {...field} value={field.value ?? ''} className="h-11 bg-background border-2 focus-visible:ring-primary rounded-xl shadow-sm text-base font-bold px-4 border-muted/40" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="display_order" render={({ field }) => (
                        <FormItem>
                          <div className="flex flex-col mb-1.5">
                            <FormLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground block">Display Order (Global)</FormLabel>
                            <p className="text-[9px] text-muted-foreground italic font-medium mt-1 leading-tight">Display order is shared across all subcategories of this constitution.</p>
                          </div>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field} 
                              onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                              className="h-11 bg-background border-2 focus-visible:ring-primary rounded-xl shadow-sm text-base font-bold px-4 border-muted/40" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="sub_display_order" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Sub Display Order</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field} 
                              onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                              className="h-11 bg-background border-2 focus-visible:ring-primary rounded-xl shadow-sm text-base font-bold px-4 border-muted/40" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <Separator className="opacity-30 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full" />

                  {/* Entity Fields */}
                  <div className="p-1">
                    <SectionFieldArray
                      name="requiredSections"
                      countryCodes={countryCodes}
                      isLoadingCodes={isLoadingCodes}
                      dynamicTemplates={dynamicTemplates}
                      target="Constitution"
                    />
                  </div>

                  <Separator className="opacity-30 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full" />

                  {/* Role Definitions */}
                  <div className="space-y-8">
                    <div className="flex items-center justify-between border-b border-muted/50 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-xl shadow-inner"><Users className="h-4 w-4 text-purple-600" /></div>
                        <h3 className="text-lg font-black tracking-tight">Add Roles</h3>
                      </div>
                    </div>
                    <RHFFormDescription className="-mt-6 text-sm font-medium opacity-60 max-w-xl">
                      Define roles and requirements.
                    </RHFFormDescription>

                    {roleFields.length === 0 && (
                      <div className="text-center py-16 bg-muted/5 rounded-2xl border-2 border-dashed border-muted transition-all flex flex-col items-center">
                        <Users className="h-12 w-12 text-muted-foreground/10 mb-4" />
                        <p className="text-sm font-black text-muted-foreground/30 uppercase tracking-[0.3em]">No roles defined</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-8">
                      {roleFields.map((roleItem: any, roleIndex: number) => {
                        return (
                          <RoleItemForm
                            key={roleItem.id}
                            roleIndex={roleIndex}
                            removeRole={(index) => {
                              removeRole(index);
                              setSavedRoles(prev => {
                                const updated = { ...prev };
                                delete updated[index];
                                return updated;
                              });
                            }}
                            handleCopyDetailsFromRole={handleCopyDetailsFromRole}
                            countryCodes={countryCodes}
                            isLoadingCodes={isLoadingCodes}
                            savedRoles={savedRoles}
                            setSavedRoles={setSavedRoles}
                            dynamicTemplates={dynamicTemplates}
                          />
                        );
                      })}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => appendRole({ roleName: '', isManagementRole: false, minMembers: 0, maxMembers: 0, hierarchyLevel: 1, designations: [], requiredDetails: [] })}
                      disabled={!(roleFields.length === 0 || savedRoles[roleFields.length - 1] === true)}
                      className="w-full border-2 border-dashed py-10 rounded-2xl group hover:bg-primary/5 hover:border-primary/40 transition-all duration-500 shadow-sm relative disabled:opacity-50"
                    >
                      <div className="flex flex-col items-center gap-3 relative z-10">
                        <div className="p-3 bg-background rounded-full group-hover:scale-110 transition-all duration-500 shadow-md border">
                          <PlusCircle className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Add Roles</span>
                      </div>
                    </Button>

                    {(errors.roles || Object.keys(errors).length > 0) && (
                      <div className="flex flex-col gap-4 p-8 bg-destructive/10 text-destructive rounded-[2.5rem] border-4 border-destructive/20 mt-10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-6">
                          <AlertTriangle className="h-10 w-10 shrink-0" />
                          <p className="text-lg font-black uppercase tracking-widest leading-none">
                            {(errors.roles as any)?.message || (errors.roles as any)?.root?.message || "Configuration error detected. Check all fields."}
                          </p>
                        </div>
                        {Object.keys(errors).length > 0 && (
                          <div className="ml-16 space-y-1">
                            {Object.entries(errors).map(([key, val]) => (
                              <p key={key} className="text-[10px] font-bold uppercase tracking-tight opacity-60">
                                {key.replace(/([A-Z])/g, ' $1')}: {(val as any).message || "Configuration required"}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </form>
              </Form>
            </FormProvider>
          </div>

          <DialogFooter className="px-8 py-5 bg-muted/20 border-t backdrop-blur-3xl flex flex-col sm:flex-row sm:justify-between items-center gap-6 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <div className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground bg-background px-4 py-2 rounded-full border shadow-inner hidden sm:flex items-center gap-2">
              <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />

            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <DialogClose asChild><Button type="button" variant="outline" className="px-8 h-11 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 hover:bg-background">Cancel</Button></DialogClose>
              <Button
                type="submit"
                onClick={() => {
                  console.log("Attempting form submission. Current values:", form.getValues());
                  form.handleSubmit(handleFormSubmit, (err) => {
                    console.error("CLIENT-SIDE VALIDATION ERROR:", JSON.stringify(err, null, 2));
                    toast({
                      title: "Configuration Incomplete",
                      description: "Please review the highlighted fields in the designer.",
                      variant: "destructive"
                    });
                  })();
                }}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 h-11 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 min-w-[200px]"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}
                {editingBusinessType ? 'Update Constitution' : 'Add Constitution'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-3xl p-8 gap-6 shadow-2xl border bg-background max-w-lg">
          <AlertDialogHeader>
            <div className="p-4 bg-destructive/10 rounded-2xl w-fit mb-4">
              <Trash2 className="h-8 w-8 text-destructive" />
            </div>
            <AlertDialogTitle className="text-2xl font-black tracking-tight">Delete Constitution?</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium opacity-70 leading-relaxed">
              This will permanently remove the configuration for this business structure and all its associated role requirements.
              <br /><br />
              <span className="font-bold text-destructive">This action is irreversible and cannot be recovered.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel onClick={() => setTypeToDeleteId(null)} className="h-11 rounded-xl px-6 font-bold border-2 hover:bg-background transition-all">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90 h-11 rounded-xl px-8 font-bold shadow-lg shadow-destructive/20 transition-all hover:scale-105 active:scale-95">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Constitution
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

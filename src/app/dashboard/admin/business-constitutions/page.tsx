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
  Search, LayoutGrid, List, FileCheck, ArrowRight, ShieldCheck, Building2,
  Filter, ChevronDown, Briefcase, Handshake, Shield, ArrowLeft
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
        <Card key={section.id} className="relative overflow-hidden border-2 border-muted bg-white shadow-sm rounded-md transition-all hover:shadow-md">

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
                        className="font-semibold text-[16px] border-none p-0 focus-visible:ring-0 bg-transparent h-auto"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-[13px] text-muted-foreground mt-1">Data Group {index + 1}</p>
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
          <p className="w-full text-[13px] font-medium text-muted-foreground mb-1">Quick Section Templates</p>
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
          variant="outline"
          onClick={() => append({ sectionName: '', fields: [] })}
          className="w-full h-12 border-dashed text-[14px] font-medium"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Initialize New Data Section
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
      <style>{`
        .uiverse-card {
          position: relative;
          overflow: hidden;
          transition: all 0.48s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .uiverse-content {
          position: relative;
          z-index: 1;
          background: #ffffff;
          transition: all 0.48s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .uiverse-card::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          height: 3000px;
          width: 3000px;
          background: linear-gradient(to right, #60a5fa, #0a3cff);
          transform-origin: center;
          transform: translate(-50%, -50%) rotate(0);
          animation: uiverse-moving 4.8s linear infinite paused;
          transition: width 0.88s cubic-bezier(0.23, 1, 0.32, 1);
          z-index: 0;
        }
        .uiverse-card:hover::before {
          animation-play-state: running;
          width: 20%;
        }
        .uiverse-card:hover {
          box-shadow: 0rem 6px 13px rgba(10, 60, 255, 0.1),
            0rem 24px 24px rgba(10, 60, 255, 0.09),
            0rem 55px 33px rgba(10, 60, 255, 0.05),
            0rem 97px 39px rgba(10, 60, 255, 0.01), 0rem 152px 43px rgba(10, 60, 255, 0);
          scale: 1.02;
        }
        @keyframes uiverse-moving {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
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
            <Card key={item.id} className="uiverse-card p-[2px] rounded-xl border-none shadow-sm mb-4 bg-transparent">
              <div className="uiverse-content rounded-[10px] w-full h-full bg-white relative">
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300 rounded-l-[10px]",
                  status === 'Complete' ? "bg-emerald-500" : status === 'Incomplete' ? "bg-amber-500" : "bg-primary/40"
                )} />
                <div className="p-5 pl-7">
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
                      <FormLabel className="text-[14px] font-medium text-muted-foreground">Field Type</FormLabel>
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
                      <FormLabel className="text-[14px] font-medium text-muted-foreground">Input Control Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value as string}>
                        <FormControl><SelectTrigger className="bg-background h-9 text-sm"><SelectValue placeholder="Select UI" /></SelectTrigger></FormControl>
                        <SelectContent>{INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={control} name={`${fieldArrayName}.${index}.requirement` as any} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[14px] font-medium text-muted-foreground">Requirement</FormLabel>
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
                          <FormLabel className="text-[14px] font-medium text-muted-foreground whitespace-nowrap">Code</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value as string || '+91'} disabled={isLoadingCodes}>
                            <FormControl>
                              <SelectTrigger className="bg-background h-9 text-[14px]">
                                {isLoadingCodes ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : <SelectValue placeholder="+91" />}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countryCodes.length > 0 ? (
                                countryCodes.map(c => <SelectItem key={c} value={c} className="text-[14px]">{c}</SelectItem>)
                              ) : (
                                <SelectItem value="+91" className="text-[14px]">+91</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name={`${fieldArrayName}.${index}.maxLength` as any} render={({ field }) => (
                        <FormItem className="w-20">
                          <FormLabel className="text-[14px] font-medium text-muted-foreground whitespace-nowrap">Length</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="bg-background h-9 text-[14px]"
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
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-2 bg-background h-9 mt-6">
                        <FormLabel className="text-[14px] font-medium text-muted-foreground">Multiple?</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="scale-75" /></FormControl>
                      </FormItem>
                    )} />
                  ) : (
                    <FormField control={control} name={`${fieldArrayName}.${index}.maxLength` as any} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[14px] font-medium text-muted-foreground">Max Length</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0 for no limit"
                            className="bg-background h-9 text-[14px]"
                            {...field}
                            value={field.value ?? ''}
                            disabled={fieldType === 'PAN' || fieldType === 'GSTIN'}
                            onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
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
          <h4 className="text-[16px] font-semibold text-foreground">Functional Role Definition {roleIndex + 1}</h4>
          <Badge variant="outline" className="ml-2 font-medium">
            Level {form.watch(`roles.${roleIndex}.hierarchyLevel`)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              const isValid = await form.trigger(`roles.${roleIndex}`);
              if (isValid) {
                setSavedRoles(prev => ({ ...prev, [roleIndex]: true }));
              }
            }}
            className="h-8 text-[14px] font-medium"
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
            <FormItem><FormLabel className="text-[14px] font-medium">Role Name <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="e.g., Partner, Director" {...field} value={field.value ?? ''} className="h-10 text-[14px] rounded-md" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField
            control={control}
            name={`roles.${roleIndex}.hierarchyLevel`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[14px] font-medium">Hierarchy Level</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1 = Highest"
                    value={field.value ?? ''}
                    onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                    onChange={(e) => field.onChange(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 text-[14px] rounded-md"
                  />
                </FormControl>
                <p className="text-[12px] text-muted-foreground">Lower number = higher authority</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <FormField control={control} name={`roles.${roleIndex}.isManagementRole`} render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-md border p-3 bg-background shadow-sm">
              <div className="space-y-0.5">
                <FormLabel className="text-[14px] font-medium">Management Authority</FormLabel>
                <RHFFormDescription className="text-[12px]">Does this role have signing/approval rights?</RHFFormDescription>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control} name={`roles.${roleIndex}.minMembers`} render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[14px] font-medium">Min Members <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g., 1"
                  value={field.value ?? ''}
                  onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0);
                    field.onChange(val);
                  }}
                  className="h-10 text-[14px] rounded-md"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={control} name={`roles.${roleIndex}.maxMembers`} render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-[14px] font-medium">Max Members <span className="text-destructive">*</span></FormLabel>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id={`unlimited-${roleIndex}`}
                    checked={field.value === -1} 
                    onCheckedChange={(checked) => {
                      field.onChange(checked ? -1 : 0);
                    }} 
                  />
                  <label htmlFor={`unlimited-${roleIndex}`} className="text-[14px] font-medium cursor-pointer">Unlimited</label>
                </div>
              </div>
              <FormControl>
                {field.value === -1 ? (
                  <Input
                    type="text"
                    disabled
                    value="Unlimited"
                    className="h-10 text-[14px] rounded-md text-muted-foreground bg-muted/50"
                  />
                ) : (
                  <Input
                    type="number"
                    placeholder="e.g., 50"
                    {...field}
                    value={field.value ?? ''}
                    onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        field.onChange('');
                      } else {
                        field.onChange(Number(val));
                      }
                    }}
                    className="h-10 text-[14px] rounded-md"
                  />
                )}
              </FormControl>
              <RHFFormDescription className="text-[12px] opacity-80">Use Unlimited for no maximum cap.</RHFFormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="space-y-4">
          <FormLabel className="text-[14px] font-medium flex items-center justify-between">
            Official Designations
          </FormLabel>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-md border bg-muted/5">
            <FormField control={control} name={`roles.${roleIndex}.designations`} render={({ field }) => (
              <>
                {(field.value || []).map((desc: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="pl-3 pr-1 py-1 h-8 rounded-md font-medium text-[13px] group">
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
                    className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-[14px]"
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
          <RHFFormDescription className="text-[12px] opacity-80">Add designations and press enter or click the add button.</RHFFormDescription>
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
  }, [toast]);

  useEffect(() => {
    fetchBusinessTypes();
    fetchCountryCodes();
    fetchDynamicTemplates();
  }, [fetchBusinessTypes, fetchCountryCodes, fetchDynamicTemplates]);

  const handleFormSubmit: SubmitHandler<BusinessTypeFormValues> = async (values) => {
    setIsSubmitting(true);
    try {
      const type_subtype_key = slugify(`${values.businessType}_${values.businessSubType}`);

      // Duplicate Check
      const normalizedType = values.businessType.trim().toLowerCase();
      const normalizedSubType = values.businessSubType.trim().toLowerCase();
      const isDuplicate = businessTypes.some(bt => 
        bt.businessType.trim().toLowerCase() === normalizedType && 
        bt.businessSubType.trim().toLowerCase() === normalizedSubType && 
        bt.id !== editingBusinessType?.id
      );

      if (isDuplicate) {
        toast({ title: "Validation Error", description: "This Business Constitution (Type + Sub Type) already exists.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        business_type: values.businessType,
        business_sub_type: values.businessSubType,
        type_subtype_key,
        display_order: values.display_order || 0,
        sub_display_order: values.sub_display_order || 0,
        required_fields: values.requiredSections,
        roles: values.roles,
        updated_at: new Date().toISOString()
      };

      if (editingBusinessType) {
        const { error } = await supabase
          .from('business_constitutions')
          .update(payload)
          .eq('id', editingBusinessType.id);
        if (error) throw error;
        toast({ title: "Constitution Updated", description: "Business constitution details updated successfully." });
      } else {
        const { error } = await supabase
          .from('business_constitutions')
          .insert([payload]);
        if (error) throw error;
        toast({ title: "Constitution Created", description: "New business constitution added successfully." });
      }

      setIsFormDialogOpen(false);
      setEditingBusinessType(null);
      form.reset();
      fetchBusinessTypes();
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddDialog = () => {
    setEditingBusinessType(null);
    form.reset({
      businessType: '',
      businessSubType: '',
      display_order: 0,
      sub_display_order: 0,
      requiredSections: [],
      roles: []
    });
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (type: BusinessTypeSetup) => {
    setEditingBusinessType(type);
    form.reset({
      businessType: type.businessType,
      businessSubType: type.businessSubType,
      display_order: type.display_order,
      sub_display_order: type.sub_display_order,
      requiredSections: type.required_fields || [],
      roles: type.roles || []
    });
    setIsFormDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setTypeToDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!typeToDeleteId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('business_constitutions')
        .delete()
        .eq('id', typeToDeleteId);
      if (error) throw error;
      toast({ title: "Deleted", description: "Constitution deleted successfully." });
      setShowDeleteConfirm(false);
      setTypeToDeleteId(null);
      fetchBusinessTypes();
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyDetailsFromRole = useCallback((targetIndex: number, sourceIndex: number) => {
    const roles = form.getValues('roles');
    if (sourceIndex >= 0 && sourceIndex < roles.length) {
      const sourceRole = roles[sourceIndex];
      const clonedDetails = (sourceRole.requiredDetails || []).map((item: any) => {
        const { id, ...rest } = item;
        return rest;
      });
      form.setValue(`roles.${targetIndex}.isManagementRole`, sourceRole.isManagementRole, { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.minMembers`, sourceRole.minMembers, { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.maxMembers`, sourceRole.maxMembers, { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.designations`, [...(sourceRole.designations || [])], { shouldValidate: true, shouldDirty: true });
      form.setValue(`roles.${targetIndex}.requiredDetails`, clonedDetails, { shouldValidate: true, shouldDirty: true });
      toast({ title: "Configuration Cloned", description: "Role logic successfully copied." });
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
    const clonedRoles = (type.roles || []).map((role: any) => ({
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
    }));
    form.setValue('requiredSections', clonedSections, { shouldValidate: true, shouldDirty: true });
    form.setValue('roles', clonedRoles, { shouldValidate: true, shouldDirty: true });
    toast({ title: "Setup Cloned", description: `Imported fields and roles from ${type.businessType} - ${type.businessSubType}.` });
  }, [businessTypes, form, toast]);

  const formatCategoryName = (name: string) => {
    if (!name) return '';
    const clean = name.replace(/LIBILITY/gi, 'LIABILITY').replace(/COMANY/gi, 'COMPANY');
    return clean
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const formatConstitutionTitle = (title: string) => {
    if (!title) return '';
    const clean = title.replace(/LIBILITY/gi, 'LIABILITY').replace(/COMANY/gi, 'COMPANY');
    return clean
      .split(' ')
      .map(word => {
        const upper = word.toUpperCase();
        if (['OPC', 'LLP', 'PVT', 'LTD', 'GST', 'PAN'].includes(upper)) return upper;
        if (word.includes('-')) {
          return word
            .split('-')
            .map(w => {
              const u = w.trim().toUpperCase();
              if (['OPC', 'LLP', 'PVT', 'LTD'].includes(u)) return u;
              const trimmed = w.trim();
              return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
            })
            .join(' - ');
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const filteredTypes = useMemo(() =>
    businessTypes.filter(type =>
      type.businessType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      type.businessSubType.toLowerCase().includes(searchQuery.toLowerCase())
    ), [businessTypes, searchQuery]);

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
      .filter(item =>
        !searchQuery ||
        item.businessType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.businessSubType.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => a.sub_display_order - b.sub_display_order);
  }, [businessTypes, selectedType, searchQuery]);

  useEffect(() => {
    if (primaryTypes.length === 0 || (selectedType && !primaryTypes.includes(selectedType))) {
      setSelectedType(null);
    }
  }, [primaryTypes, selectedType]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#F7F9FD] -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      
      <div className="relative z-10 max-w-[1500px] mx-auto space-y-6">
        
        {/* TOP HEADER CONTAINER */}
        <div className="relative h-[160px] bg-gradient-to-r from-white via-[#F7FAFF] to-[#EFF5FF] border border-[#E5EAF2] rounded-2xl shadow-sm px-8 flex items-center justify-between overflow-hidden">
          
          {/* Skyline decorative background */}
          <div
            className="absolute inset-y-0 right-0 w-[48%] max-w-[750px] pointer-events-none bg-no-repeat z-0"
            style={{
              backgroundImage: "url('/skyline_clean.png')",
              backgroundSize: "100% auto",
              backgroundPosition: "right 60%",
              opacity: 0.2,
            }}
          />

          {/* Left side: Icon and title info */}
          <div className="flex items-center gap-4 relative z-[1]">
            <div className="w-[56px] h-[56px] bg-white border border-[#E5EAF2] rounded-xl shadow-[0_4px_16px_rgba(30,64,120,0.04)] flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-[#2563EB]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[30px] font-bold tracking-tight text-[#10234A] leading-none">Business Constitutions</span>
                <Badge variant="secondary" className="h-6 rounded-full px-2.5 font-semibold text-xs bg-[#EEF4FF] text-[#2563EB] border-transparent shadow-sm">
                  {businessTypes.length}
                </Badge>
              </div>
              <p className="text-[#64748B] text-[15px] mt-1.5">Define the blueprint for different legal entity structures.</p>
            </div>
          </div>

          {/* Right side: Add Constitution button */}
          <div className="relative z-[1] shrink-0">
            <Button onClick={openAddDialog} className="h-[46px] w-[185px] rounded-xl font-semibold px-5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all hover:-translate-y-[1px] flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> Add Constitution
            </Button>
          </div>
        </div>

        {/* SEARCH AND FILTER CONTAINER */}
        <div className="w-full h-[70px] bg-white border border-[#E5EAF2] rounded-2xl shadow-[0_4px_16px_rgba(30,64,120,0.03)] px-4 py-3 flex items-center justify-between mb-8">
          {/* Search Input */}
          <div className="relative w-full max-w-[500px] flex items-center h-[44px] bg-white border border-[#E5EAF2] rounded-xl px-4">
            <Search className="h-5 w-5 text-[#64748B]" />
            <Input
              placeholder="Search constitutions..."
              className="h-full w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none text-[15px] placeholder:text-[#64748B] pl-3 text-[#10234A]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Company Filter */}
          <div className="flex items-center justify-between px-4 h-[44px] w-[180px] bg-white border border-[#E5EAF2] rounded-xl cursor-pointer hover:bg-gray-50 transition-colors shrink-0">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#64748B]" />
              <span className="text-[14px] font-medium text-[#10234A] whitespace-nowrap">All Companies</span>
            </div>
            <ChevronDown className="h-4 w-4 text-[#64748B]" />
          </div>
        </div>

        {/* Main Content */}
        <div>
          {isLoading ? (<div className="p-6"><PageSkeleton /></div>) : error ? (
            <Alert variant="destructive" className="rounded-xl border p-6 bg-destructive/5">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                <div>
                  <AlertTitle className="text-lg font-semibold mb-1">System Error</AlertTitle>
                  <AlertDescription className="text-sm opacity-90">{error}</AlertDescription>
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => fetchBusinessTypes()}>
                    Retry Connection
                  </Button>
                </div>
              </div>
            </Alert>
          ) : filteredTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-[#E5EAF2]">
              <Inbox className="h-12 w-12 text-[#64748B]/30 mb-3" />
              <h3 className="text-lg font-semibold mb-1 text-[#0F1F3D]">No constitutions found</h3>
              <p className="text-[#64748B] max-w-md text-center text-sm mb-4">
                No matching business configurations found. Please verify your search term.
              </p>
              <Button variant="outline" size="sm" className="rounded-lg border-[#E5EAF2] text-[#64748B]" onClick={() => setSearchQuery('')}>
                Reset Search
              </Button>
            </div>
          ) : !selectedType ? (
            <div className="flex flex-col items-center py-8">
              
              <div className="flex flex-wrap justify-center gap-6 w-full max-w-[1200px]">
                {primaryTypes.map((type) => {
                  const count = businessTypes.filter(b => b.businessType === type).length;
                  let Icon = Building2;
                  let desc = "Manage configurations and structures.";
                  
                  if (type.toLowerCase().includes("proprietor")) {
                    Icon = Briefcase;
                    desc = "Individual business structure configuration.";
                  } else if (type.toLowerCase().includes("partnership") && !type.toLowerCase().includes("limited")) {
                    Icon = Handshake;
                    desc = "Configure partnership structures and requirements.";
                  } else if (type.toLowerCase().includes("llp") || type.toLowerCase().includes("limited liability")) {
                    Icon = Shield;
                    desc = "Manage limited liability partnership configurations.";
                  } else if (type.toLowerCase().includes("company")) {
                    Icon = Building2;
                    desc = "Manage company structures and subcategories.";
                  }

                  return (
                    <div 
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className="group cursor-pointer w-full sm:w-[260px] min-h-[280px] bg-card rounded-[18px] border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col p-6 relative overflow-hidden"
                    >
                      <div className="mb-6 w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100/60 transition-colors">
                        <Icon className="h-7 w-7 text-[#2563EB]" />
                      </div>
                      
                      <div className="flex-grow">
                        <h3 className="text-[18px] font-semibold text-foreground leading-[1.3] mb-1.5">{formatCategoryName(type)}</h3>
                        <p className="text-[14px] text-muted-foreground line-clamp-2 leading-relaxed mb-4">{desc}</p>
                      </div>

                      <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
                        <span className="text-[13px] font-medium text-muted-foreground">
                          {count} {count === 1 ? 'Constitution' : 'Constitutions'}
                        </span>
                        <div className="flex items-center gap-1 text-[14px] font-medium text-primary">
                          Open <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col w-full animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6">
                <button 
                  onClick={() => setSelectedType(null)} 
                  className="flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-primary transition-colors h-8 px-2 -ml-2 rounded-lg hover:bg-muted/50"
                >
                  <ArrowLeft className="h-4 w-4" /> All Categories
                </button>
              </div>
              <div className="mb-8">
                <h2 className="text-[24px] font-semibold text-foreground tracking-tight flex items-center gap-3">
                  {formatCategoryName(selectedType)}
                  <Badge variant="secondary" className="h-5 rounded-full px-2 font-medium text-[11px] bg-muted text-muted-foreground border-transparent">
                    {filteredSubTypes.length} {filteredSubTypes.length === 1 ? 'configuration' : 'configurations'}
                  </Badge>
                </h2>
              </div>
              
              <div className="w-full">
                {filteredSubTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-[#E5EAF2] shadow-[0_4px_16px_rgba(30,64,120,0.04)]">
                    <Inbox className="h-10 w-10 text-[#64748B]/40 mb-3" />
                    <p className="text-sm text-[#64748B]">No constitutions defined in this category.</p>
                  </div>
                ) : filteredSubTypes.length === 1 ? (
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-stretch">
                    {filteredSubTypes.map((type) => {
                      const allFields = (type.required_fields || []).flatMap((section: any) => section.fields || []);
                      const reqCount = allFields.filter((f: any) => f.requirement === 'Mandatory').length;
                      const optCount = allFields.filter((f: any) => f.requirement === 'Optional').length;
                      const condCount = allFields.filter((f: any) => f.requirement === 'If Available').length;
                      
                      return (
                        <React.Fragment key={type.id}>
                          <div className="w-full h-full relative flex flex-col bg-card rounded-2xl border border-border/60 shadow-sm p-6 transition-all hover:shadow-[0_4px_16px_rgba(30,64,120,0.08)]">
                            <div className="flex justify-between items-start mb-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF4FF] text-[#2563EB] tracking-wide uppercase">
                                {type.businessType}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={(e) => { e.stopPropagation(); openEditDialog(type); }} className="h-8 w-8 rounded-lg bg-white border border-border/60 text-muted-foreground hover:text-primary flex items-center justify-center shadow-sm transition-colors">
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(type.id); }} className="h-8 w-8 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 flex items-center justify-center shadow-sm transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <h4 className="text-[18px] font-bold text-foreground leading-[1.3] mb-2 pr-4">
                              {formatConstitutionTitle(type.businessSubType)}
                            </h4>
                            
                            <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
                              Configure roles, required information and business structure settings.
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Roles</p>
                                <p className="text-[14px] font-semibold text-foreground">{type.roles?.length || 0}</p>
                              </div>
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Data Groups</p>
                                <p className="text-[14px] font-semibold text-foreground">{type.required_fields?.length || 0}</p>
                              </div>
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Display Order</p>
                                <p className="text-[14px] font-semibold text-foreground">{type.display_order ?? 0}</p>
                              </div>
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Sub Order</p>
                                <p className="text-[14px] font-semibold text-foreground">{type.sub_display_order ?? 0}</p>
                              </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-border/40">
                              <button onClick={() => openEditDialog(type)} className="w-full flex items-center justify-between group">
                                <span className="text-[14px] font-semibold text-primary">Manage Constitution</span>
                                <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform" />
                              </button>
                            </div>
                          </div>

                          <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-6 flex flex-col h-full">
                            <div className="mb-6">
                              <h4 className="text-[17px] font-semibold text-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Constitution Overview
                              </h4>
                              <p className="text-[13px] text-muted-foreground mt-1">
                                Configuration summary for this business structure.
                              </p>
                            </div>
                            
                            <div className="flex-1 flex flex-col">
                              <div className="flex items-center justify-between py-3 border-b border-border/40">
                                <span className="text-[13px] font-medium text-muted-foreground">Roles</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">{type.roles?.length || 0}</span>
                              </div>
                              <div className="flex items-center justify-between py-3 border-b border-border/40">
                                <span className="text-[13px] font-medium text-muted-foreground">Data Groups</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">{type.required_fields?.length || 0}</span>
                              </div>
                              <div className="flex items-center justify-between py-3 border-b border-border/40">
                                <span className="text-[13px] font-medium text-muted-foreground">Required Fields</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">{reqCount}</span>
                              </div>
                              <div className="flex items-center justify-between py-3 border-b border-border/40">
                                <span className="text-[13px] font-medium text-muted-foreground">Optional Fields</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">{optCount}</span>
                              </div>
                              <div className="flex items-center justify-between py-3 border-b border-border/40">
                                <span className="text-[13px] font-medium text-muted-foreground">Conditional Fields</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">{condCount}</span>
                              </div>
                              <div className="flex items-center justify-between py-3 border-b border-border/40">
                                <span className="text-[13px] font-medium text-muted-foreground">Display Order</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">{type.display_order ?? 0}</span>
                              </div>
                              <div className="flex items-center justify-between py-3">
                                <span className="text-[13px] font-medium text-muted-foreground">Sub Order</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">{type.sub_display_order ?? 0}</span>
                              </div>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-border/40">
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {type.roles?.length || 0} {(type.roles?.length || 0) === 1 ? 'role' : 'roles'} and {type.required_fields?.length || 0} data {(type.required_fields?.length || 0) === 1 ? 'group' : 'groups'} are currently configured for this constitution.
                              </p>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : filteredSubTypes.length === 2 ? (
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                    {filteredSubTypes.map((type) => (
                      <div key={type.id} className="relative flex flex-col bg-white rounded-[16px] border border-[#E5EAF2] shadow-[0_2px_8px_rgba(30,64,120,0.04)] p-6 transition-all hover:shadow-[0_4px_16px_rgba(30,64,120,0.08)]">
                        <div className="flex justify-between items-start mb-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF4FF] text-[#2563EB] tracking-wide uppercase">
                            {type.businessType}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={(e) => { e.stopPropagation(); openEditDialog(type); }} className="h-8 w-8 rounded-lg bg-white border border-[#E5EAF2] text-[#64748B] hover:text-[#2563EB] flex items-center justify-center shadow-sm transition-colors">
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(type.id); }} className="h-8 w-8 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#ef4444] hover:bg-[#fee2e2] flex items-center justify-center shadow-sm transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-[18px] font-bold text-foreground leading-[1.3] mb-2 pr-4">
                          {formatConstitutionTitle(type.businessSubType)}
                        </h4>
                        
                        <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
                          Configure roles, required information and business structure settings.
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                            <p className="text-[12px] text-muted-foreground mb-0.5">Roles</p>
                            <p className="text-[14px] font-semibold text-foreground">{type.roles?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-muted-foreground mb-0.5">Data Groups</p>
                            <p className="text-[14px] font-semibold text-foreground">{type.required_fields?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-muted-foreground mb-0.5">Display Order</p>
                            <p className="text-[14px] font-semibold text-foreground">{type.display_order ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-muted-foreground mb-0.5">Sub Order</p>
                            <p className="text-[14px] font-semibold text-foreground">{type.sub_display_order ?? 0}</p>
                          </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-border/40">
                          <button onClick={() => openEditDialog(type)} className="w-full flex items-center justify-between group">
                            <span className="text-[14px] font-semibold text-primary">Manage Constitution</span>
                            <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSubTypes.map((type) => (
                      <div key={type.id} className="group relative flex flex-col h-[185px] bg-white rounded-[14px] border border-[#E5EAF2] shadow-sm transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-[1px] overflow-hidden items-stretch">
                        
                        <div className="p-4 pb-1 flex-none">
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF4FF] text-[#2563EB] tracking-wider uppercase">
                              {type.businessType}
                            </span>
                            
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button onClick={(e) => { e.stopPropagation(); openEditDialog(type); }} className="h-6 w-6 rounded-md bg-white border border-[#E5EAF2] text-[#64748B] hover:text-[#2563EB] flex items-center justify-center shadow-sm transition-colors">
                                <Edit className="h-3 w-3" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(type.id); }} className="h-6 w-6 rounded-md bg-[#fef2f2] border border-[#fecaca] text-[#ef4444] hover:bg-[#fee2e2] flex items-center justify-center shadow-sm transition-colors">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          <h4 className="text-[16px] font-semibold text-[#16213A] leading-snug line-clamp-2 min-h-[44px]">
                            {formatConstitutionTitle(type.businessSubType)}
                          </h4>
                        </div>

                        <div className="relative h-[48px] px-4 w-full">
                          <div className="absolute inset-0 px-4 flex justify-between items-center text-[12px] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:translate-y-1 lg:group-hover:translate-y-0 transition-all duration-200">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground text-[11px] mb-0.5">Roles</span>
                              <span className="font-semibold text-foreground">{type.roles?.length || 0}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground text-[11px] mb-0.5">Data Groups</span>
                              <span className="font-semibold text-foreground">{type.required_fields?.length || 0}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground text-[11px] mb-0.5">Display</span>
                              <span className="font-semibold text-foreground">{type.display_order ?? 0}</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 pt-3 mt-auto bg-white border-t border-border/30">
                          <button onClick={() => openEditDialog(type)} className="w-full flex items-center justify-between text-[#2563EB] group/btn">
                            <span className="text-[14px] font-medium">Manage Constitution</span>
                            <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>{/* --- Designer Modal --- */}
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
                <DialogTitle className="text-xl font-semibold text-foreground">
                  {editingBusinessType ? 'Edit Business Constitution' : 'Add Business Constitution'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm font-normal text-muted-foreground">
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
                        <h3 className="text-base font-semibold text-foreground">Constitution Details</h3>
                      </div>
                      {businessTypes.length > 0 && !editingBusinessType && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-lg text-sm font-medium bg-background text-foreground border-border hover:bg-muted shadow-sm transition-all">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <FormField control={control} name="businessType" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-medium text-foreground">Primary Constitution</FormLabel>
                          <FormControl><Input placeholder="e.g., Company" {...field} value={field.value ?? ''} className="h-10 bg-background border border-border focus-visible:ring-primary rounded-lg shadow-sm text-sm font-normal px-3" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="businessSubType" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-medium text-foreground">Sub Category</FormLabel>
                          <FormControl><Input placeholder="e.g., Private Limited" {...field} value={field.value ?? ''} className="h-10 bg-background border border-border focus-visible:ring-primary rounded-lg shadow-sm text-sm font-normal px-3" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="display_order" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-medium text-foreground">Display Order (Global)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field} 
                              onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                              className="h-10 bg-background border border-border focus-visible:ring-primary rounded-lg shadow-sm text-sm font-normal px-3" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground font-normal leading-5 mt-1.5">Display order is shared across all subcategories of this constitution.</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="sub_display_order" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-medium text-foreground">Sub Display Order</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field} 
                              onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                              className="h-10 bg-background border border-border focus-visible:ring-primary rounded-lg shadow-sm text-sm font-normal px-3" 
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
                        <h3 className="text-base font-semibold text-foreground">Add Roles</h3>
                      </div>
                    </div>
                    <RHFFormDescription className="-mt-6 text-sm font-medium opacity-60 max-w-xl">
                      Define roles and requirements.
                    </RHFFormDescription>

                    {roleFields.length === 0 && (
                      <div className="text-center py-12 bg-muted/5 rounded-md border-2 border-dashed border-muted transition-all flex flex-col items-center">
                        <Users className="h-10 w-10 text-muted-foreground/20 mb-3" />
                        <p className="text-[14px] font-medium text-muted-foreground/60">No roles defined</p>
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
                      className="w-full h-12 border-dashed text-[14px] font-medium"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Role
                    </Button>

                    {(errors.roles || Object.keys(errors).length > 0) && (
                      <div className="flex items-center gap-3 p-4 bg-destructive/5 text-destructive border border-destructive/20 rounded-md mt-6">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p className="text-[14px] font-medium">
                          Some configuration details need attention. Review the highlighted fields.
                        </p>
                      </div>
                    )}
                  </div>
                </form>
              </Form>
            </FormProvider>
          </div>

          <DialogFooter className="px-8 py-5 bg-muted/20 border-t backdrop-blur-3xl flex flex-col sm:flex-row sm:justify-end items-center gap-6 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <DialogClose asChild><Button type="button" variant="outline" className="px-6 h-10 rounded-lg text-sm font-medium hover:bg-muted">Cancel</Button></DialogClose>
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-10 rounded-lg text-sm font-medium shadow-sm min-w-[160px]"
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

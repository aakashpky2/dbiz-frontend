
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, FormProvider, useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, X, AlertTriangle, RefreshCw, Database, Edit, CheckCircle, XCircle, Code, Type } from 'lucide-react';
import type { Template, Mapping } from './template-manager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enumerateSchemaPaths, toSchemaShape } from "@/lib/templatePaths";
import { Combobox } from '@/components/ui/combobox';
import { getSourceRootObject } from "./helpers";

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false, loading: () => <p>Loading Editor...</p> });

// --- Zod Schema ---
const mappingSchema = z.object({
  placeholder: z.string().min(1, 'Placeholder is required.').max(50, "Placeholder cannot exceed 50 characters."),
  source: z.string().optional(), // e.g., 'employees'
  dataKey: z.string().optional(), // e.g., 'personalDetails.fullName'
  type: z.enum(['database', 'userInput']).optional(),
  userInputLabel: z.string().optional(),
});


const templateFormSchema = z.object({
  name: z.string().min(3, 'Template name must be at least 3 characters.').max(100, "Template name cannot exceed 100 characters."),
  description: z.string().max(255, "Description cannot exceed 255 characters.").optional(),
  htmlContent: z.string().min(10, 'HTML content must be at least 10 characters.'),
  mappings: z.array(mappingSchema).optional(),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;

interface TemplateFormProps {
  initialData?: Template | null;
  onSave: (data: TemplateFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function TemplateForm({ initialData, onSave, onCancel, isSubmitting }: TemplateFormProps) {
  const { toast } = useToast();
  const [samples, setSamples] = useState<any>({});
  const [loadingSamples, setLoadingSamples] = useState(true);
  
  const hasComplexHandlebars = initialData?.htmlContent?.includes('{{#if') || initialData?.htmlContent?.includes('{{{');
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>(hasComplexHandlebars ? 'html' : 'visual');
  const quillRef = useRef<any>(null);

  // Fetch sample data for path enumeration
  useEffect(() => {
    const fetchSamples = async () => {
      try {
        const [
          { data: profileSnap },
          { data: employeeSnap },
          { data: constitutionSnap }
        ] = await Promise.all([
          supabase.from('user_profiles').select('*').limit(1),
          supabase.from('employees').select('*').limit(1),
          supabase.from('business_constitutions').select('*').limit(1)
        ]);

        const fetchedSamples: any = {};
        if (profileSnap && profileSnap.length > 0) fetchedSamples.profile = profileSnap[0];
        if (employeeSnap && employeeSnap.length > 0) fetchedSamples.employee = employeeSnap[0];
        if (constitutionSnap && constitutionSnap.length > 0) fetchedSamples.constitution = constitutionSnap[0];

        setSamples(fetchedSamples);
      } catch (error) {
        console.error("Failed to fetch sample data:", error);
        toast({ title: "Sample Data Error", description: "Could not load sample data for field suggestions.", variant: "destructive" });
      } finally {
        setLoadingSamples(false);
      }
    };
    fetchSamples();
  }, [toast]);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: initialData || {
      name: '',
      description: '',
      htmlContent: '<h1>{{title}}</h1>\n<p>{{content}}</p>',
      mappings: [],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'mappings',
  });

  const handleSyncPlaceholders = () => {
    const currentHtmlContent = form.getValues('htmlContent');
    if (!currentHtmlContent) return;
    const placeholdersInHtml = new Set((currentHtmlContent.match(/{{\s*([\w.-]+)\s*}}/g) || []).map(p => p.replace(/{{\s*|\s*}}/g, '').trim()));
    const currentMappings = form.getValues('mappings') || [];
    const placeholdersInMappings = new Set(currentMappings.map(m => m.placeholder));
    const newPlaceholders = [...placeholdersInHtml].filter(p => !placeholdersInMappings.has(p));

    if (newPlaceholders.length > 0) {
      append(newPlaceholders.map(p => ({
        placeholder: p,
        source: '',
        dataKey: '',
        type: 'database'
      })), { shouldFocus: false });
      toast({ title: "Placeholders Synced", description: `${newPlaceholders.length} new placeholder(s) added. Please map them to a data source.` });
    } else {
      toast({ title: "No New Placeholders", description: "All placeholders from HTML are already in the mapping list." });
    }
  };

  const onSubmit = async (data: TemplateFormValues) => {
    onSave(data);
  };

  const insertPlaceholder = (placeholder: string, isFullBlock: boolean = false) => {
    const textToInsert = isFullBlock ? placeholder : `{{${placeholder}}}`;

    if (editorMode === 'visual' && quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection();
      if (range) {
        editor.insertText(range.index, textToInsert);
      } else {
        const length = editor.getLength();
        editor.insertText(length - 1, textToInsert);
      }
    } else {
      const current = form.getValues('htmlContent');
      form.setValue('htmlContent', current + textToInsert);
      toast({ title: "Inserted", description: "Content added to the end." });
    }
  };

  const brandingBlocks = {
    logo: `{{#if company_logo}}\n<img src="{{company_logo}}" crossorigin="anonymous" style="height:70px; max-width:180px; object-fit:contain;" />\n{{/if}}`,
    seal: `{{#if company_seal}}\n<img src="{{company_seal}}" crossorigin="anonymous" style="height:80px; max-width:130px; object-fit:contain;" />\n{{/if}}`,
    signature: `{{#if company_signature}}\n<img src="{{company_signature}}" crossorigin="anonymous" style="height:60px; max-width:160px; object-fit:contain;" />\n{{/if}}`
  };

  return (
    <Card className="shadow-lg border-primary/20">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl">{initialData ? 'Edit Template' : 'Create New Template'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close form"><X className="h-5 w-5" /></Button>
            </div>
            <CardDescription>{initialData ? 'Modify the details of this template.' : 'Define a new template for generating documents.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Template Name</FormLabel><FormControl><Input placeholder="e.g., Invoice Template, Monthly Report" {...field} maxLength={100} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Input placeholder="A brief description of this template" {...field} maxLength={255} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FormLabel>Content</FormLabel>
                {editorMode === 'visual' && (
                  <span className="text-xs text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    Visual mode may remove complex Handlebars blocks (e.g. {'{{#if}}'}). Use HTML mode for raw blocks.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={editorMode === 'visual' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('visual')}
                >
                  <Type className="mr-2 h-4 w-4" /> Visual
                </Button>
                <Button
                  type="button"
                  variant={editorMode === 'html' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('html')}
                >
                  <Code className="mr-2 h-4 w-4" /> HTML
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="htmlContent"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    {editorMode === 'visual' ? (
                      <div className="h-[400px] mb-12">
                        <ReactQuill
                          theme="snow"
                          value={field.value}
                          onChange={field.onChange}
                          className="h-full"
                          // @ts-expect-error - ReactQuill ref type mismatch
                          ref={quillRef}
                          modules={{
                            toolbar: [
                              [{ 'header': [1, 2, 3, false] }],
                              ['bold', 'italic', 'underline', 'strike'],
                              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                              ['link', 'clean']
                            ],
                          }}
                        />
                      </div>
                    ) : (
                      <Textarea
                        placeholder="Enter the HTML structure. Use {{placeholder}} for dynamic data."
                        className="min-h-[400px] font-mono text-sm"
                        {...field}
                      />
                    )}
                  </FormControl>
                  <FormDescription>
                    Use double curly braces for placeholders.
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Button type="button" variant="outline" size="sm" onClick={() => insertPlaceholder(brandingBlocks.logo, true)}>Insert Logo</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => insertPlaceholder(brandingBlocks.seal, true)}>Insert Seal</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => insertPlaceholder(brandingBlocks.signature, true)}>Insert Signature</Button>
                    </div>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Placeholder Mappings</FormLabel>
              <FormDescription className="mb-2">Link placeholders to data sources or user input.</FormDescription>
              {loadingSamples ? <Loader2 className="animate-spin h-5 w-5" /> : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <MappingRow
                      key={field.id}
                      index={index}
                      remove={remove}
                      samples={samples}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-4">
                <Button type="button" variant="secondary" size="sm" onClick={handleSyncPlaceholders}><RefreshCw className="mr-2 h-4 w-4" /> Sync from HTML</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ placeholder: '', source: '', dataKey: '', type: 'database' })}><PlusCircle className="mr-2 h-4 w-4" /> Add Mapping Manually</Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : (initialData ? 'Save Changes' : 'Create Template')}
            </Button>
          </CardFooter>
        </form>
      </FormProvider>
    </Card>
  );
}

// --- Sub-component for each mapping card ---
function MappingRow({ index, remove, samples }: { index: number; remove: (index: number) => void; samples: any }) {
  const { control, setValue, watch, getValues } = useFormContext<TemplateFormValues>();
  const { toast } = useToast();
  const mapping = watch(`mappings.${index}`);
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);

  const handleFetch = () => {
    const sourceRootRaw = getSourceRootObject(mapping?.source || "", samples);
    const sourceRoot = toSchemaShape(sourceRootRaw);
    const options = enumerateSchemaPaths(sourceRoot, "", {
      dictionaryKeys: "wildcard",
      includeContainers: true,
      suppressStarTerminals: true,
      maxDepth: 8
    })
      .filter(o => o.kind === "leaf" || o.kind === "array")
      .map(o => o.path);


    setFieldOptions(options);
    if (options.length && !options.includes(mapping?.dataKey || '')) {
      setValue(`mappings.${index}.dataKey`, options[0]);
    }
  };

  return (
    <Card className="p-4 bg-muted/50 border shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <FormField control={control} name={`mappings.${index}.placeholder`} render={({ field }) => (
          <FormItem className="w-1/3">
            <FormLabel className="text-xs">Placeholder</FormLabel>
            <FormControl><Input {...field} placeholder="e.g. signing_authority_name" maxLength={50} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="mt-6 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /> Remove</Button>
        <Button type="button" variant="secondary" size="sm" className="mt-6 ml-2" onClick={() => {
          const ph = getValues(`mappings.${index}.placeholder`);
          if (ph) {
            // We need to pass this up to the parent component to handle insertion
            // But MappingRow is a separate component. 
            // Let's use a custom event or context, or simpler: just copy to clipboard for now as a fallback
            // OR better: pass insertPlaceholder down.
            navigator.clipboard.writeText(`{{${ph}}}`);
            toast({ title: "Copied!", description: `{{${ph}}} copied to clipboard.` });
          }
        }}>Copy Tag</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="flex gap-2 items-end">
          <FormField control={control} name={`mappings.${index}.source`} render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-xs">Source</FormLabel>
              <FormControl><Input {...field} placeholder="e.g. profile | employee" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="button" variant="outline" onClick={handleFetch} className="h-10">Fetch Fields</Button>
        </div>
        <FormField control={control} name={`mappings.${index}.dataKey`} render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel className="text-xs">Field</FormLabel>
            <Combobox
              options={fieldOptions.map(opt => ({ value: opt, label: opt }))}
              value={field.value || ''}
              onChange={field.onChange}
              placeholder="Select a field..."
              disabled={fieldOptions.length === 0}
            />
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </Card>
  );
}

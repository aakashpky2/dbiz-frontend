
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, X } from 'lucide-react';
import type { Template, Mapping } from './pdf-template-manager';

const templateMappingSchema = z.object({
  placeholder: z.string().min(1, 'Placeholder is required.'),
  dataKey: z.string().min(1, 'Data key is required.'),
});

const pdfTemplateFormSchema = z.object({
  name: z.string().min(3, 'Template name must be at least 3 characters.'),
  description: z.string().optional(),
  htmlContent: z.string().min(10, 'HTML content must be at least 10 characters.'),
  mappings: z.array(templateMappingSchema).optional(),
});

export type PdfTemplateFormValues = z.infer<typeof pdfTemplateFormSchema>;

interface PdfTemplateFormProps {
  initialData?: Template | null;
  onSave: (data: PdfTemplateFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function PdfTemplateForm({ initialData, onSave, onCancel, isSubmitting }: PdfTemplateFormProps) {
  const { toast } = useToast();

  const form = useForm<PdfTemplateFormValues>({
    resolver: zodResolver(pdfTemplateFormSchema),
    defaultValues: initialData || {
      name: '',
      description: '',
      htmlContent: '<h1>{{title}}</h1>\n<p>{{content}}</p>',
      mappings: [{ placeholder: 'title', dataKey: 'document.title' }, { placeholder: 'content', dataKey: 'document.body' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'mappings',
  });

  const onSubmit = async (data: PdfTemplateFormValues) => {
    onSave(data);
  };

  return (
    <Card className="shadow-lg border-primary/20">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl">{initialData ? 'Edit PDF Template' : 'Create New PDF Template'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close form">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <CardDescription>
              {initialData ? 'Modify the details of this PDF template.' : 'Define a new template for generating PDF documents.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Invoice Template, Monthly Report" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="A brief description of this template" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="htmlContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HTML Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the HTML structure for your PDF. Use {{placeholder}} for dynamic data."
                      className="min-h-[200px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use double curly braces for placeholders, e.g., <code>{'{{customer_name}}'}</code> or <code>{'{{invoice.date}}'}</code>.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <FormLabel>Placeholder Mappings</FormLabel>
              <FormDescription className="mb-2">
                Link placeholders in your HTML to specific data keys from your application.
              </FormDescription>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <Card key={field.id} className="p-3 bg-muted/50 border shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                      <FormField
                        control={form.control}
                        name={`mappings.${index}.placeholder`}
                        render={({ field: placeholderField }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">HTML Placeholder</FormLabel>
                            <FormControl>
                              <Input placeholder="{{example_placeholder}}" {...placeholderField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`mappings.${index}.dataKey`}
                        render={({ field: dataKeyField }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Data Key</FormLabel>
                            <FormControl>
                              <Input placeholder="object.property.value" {...dataKeyField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="mt-0 sm:mt-6 text-destructive hover:bg-destructive/10"
                        aria-label="Remove mapping"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ placeholder: '', dataKey: '' })}
                className="mt-4"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Mapping
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                initialData ? 'Save Changes' : 'Create Template'
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

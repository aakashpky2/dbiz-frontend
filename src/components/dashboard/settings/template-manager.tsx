
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription as UiAlertDescription } from "@/components/ui/alert";
import { PlusCircle, Edit, Trash2, Eye, X, Loader2, AlertTriangle, FileText as FileTextIcon, Download, MoreVertical, CheckCircle } from 'lucide-react';
import { TemplateForm, type TemplateFormValues } from './template-form';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import Handlebars from 'handlebars';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';


export type Mapping = {
  placeholder: string;
  type: 'database' | 'userInput';
  source?: string;
  dataKey?: string;
  userInputLabel?: string;
};

export type Template = {
  id: string; // Database UUID
  name: string;
  description?: string;
  htmlContent: string;
  mappings: Mapping[];
  createdAt?: number; // Unix Timestamp
  isOfferLetterTemplate?: boolean;
};

const fillHtmlWithData = (htmlContent: string, data: Record<string, any>): string => {
  try {
    const template = Handlebars.compile(htmlContent);
    return template(data);
  } catch (e) {
    console.error("Error compiling Handlebars template:", e);
    return `<p style="color:red;">Error processing template: ${(e as Error).message}</p>`;
  }
};


export function TemplateManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateToPreview, setTemplateToPreview] = useState<Template | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDeleteId, setTemplateToDeleteId] = useState<string | null>(null);
  const [downloadingState, setDownloadingState] = useState<{ templateId: string | null; type: 'pdf' | 'docx' | null }>({ templateId: null, type: null });

  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('pdf_templates').select('*').order('name');
      if (error) throw error;
      if (data) {
        const loadedTemplates: Template[] = data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          htmlContent: item.html_content,
          mappings: item.mappings || [],
          createdAt: new Date(item.created_at).getTime(),
          isOfferLetterTemplate: item.is_offer_letter_template,
        }));
        setTemplates(loadedTemplates);
        if (loadedTemplates.length === 0) {
          handleAddNew();
        }
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to fetch templates.");
      toast({ title: "Error Loading Templates", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddNew = () => {
    setEditingTemplate(null);
    setShowForm(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleDeleteClick = (templateId: string) => {
    setTemplateToDeleteId(templateId);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!templateToDeleteId) {
      toast({ title: "Error", description: "Deletion failed. ID missing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('pdf_templates').delete().eq('id', templateToDeleteId);
      if (error) throw error;

      toast({ title: "Template Deleted", description: "The PDF template has been successfully deleted." });
      setTemplateToDeleteId(null);
      fetchTemplates();
    } catch (err) {
      console.error("Error deleting template:", err);
      toast({ title: "Delete Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleFormSave = async (data: TemplateFormValues) => {
    setIsSubmitting(true);

    // Clean mappings to remove undefined values before saving
    const cleanedMappings = (data.mappings || []).map(mapping => {
      const cleanedMapping: Partial<Mapping> = {};
      if (mapping.placeholder) cleanedMapping.placeholder = mapping.placeholder;
      if (mapping.type) cleanedMapping.type = mapping.type;

      if (mapping.type === 'database') {
        if (mapping.source) cleanedMapping.source = mapping.source;
        if (mapping.dataKey) cleanedMapping.dataKey = mapping.dataKey;
      } else if (mapping.type === 'userInput') {
        // @ts-ignore - userInputLabel might not be in the type definition yet but is in the data
        if (mapping.userInputLabel) cleanedMapping.userInputLabel = mapping.userInputLabel;
      }
      return cleanedMapping;
    });

    const templateDataToSave = {
      name: data.name,
      description: data.description,
      html_content: data.htmlContent,
      mappings: cleanedMappings,
    };

    try {
      if (editingTemplate) {
        const { error } = await supabase.from('pdf_templates')
          .update(templateDataToSave)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast({ title: "Template Updated", description: `"${data.name}" has been successfully updated.` });
      } else {
        const { error } = await supabase.from('pdf_templates')
          .insert([templateDataToSave]);
        if (error) throw error;
        toast({ title: "Template Created", description: `"${data.name}" has been successfully created.` });
      }
      setShowForm(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      console.error("Error saving template:", err);
      toast({ title: "Save Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetAsOfferLetter = async (newOfferLetterId: string) => {
    setIsSubmitting(true);
    try {
      // Unset all existing
      const { error: unsetError } = await supabase.from('pdf_templates')
        .update({ is_offer_letter_template: false })
        .eq('is_offer_letter_template', true);
      if (unsetError) throw unsetError;

      // Set new one
      const { error: setError } = await supabase.from('pdf_templates')
        .update({ is_offer_letter_template: true })
        .eq('id', newOfferLetterId);
      if (setError) throw setError;

      toast({ title: "Success", description: "Offer letter template has been set." });
      fetchTemplates();
    } catch (error) {
      toast({ title: "Error", description: "Could not set offer letter template.", variant: "destructive" });
      console.error("Error setting offer letter template:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async (template: Template) => {
    setDownloadingState({ templateId: template.id, type: 'pdf' });
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const filledHtml = fillHtmlWithData(template.htmlContent, {});

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '794px'; // A4 width at 96dpi
      container.innerHTML = `<div class="prose p-4">${filledHtml}</div>`;
      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${template.name}.pdf`);

    } catch (error) {
      console.error(`Error downloading as PDF:`, error);
      toast({ title: 'Download Error', description: `Could not download as PDF.`, variant: 'destructive' });
    } finally {
      setDownloadingState({ templateId: null, type: null });
    }
  };

  const handleDownloadDocx = async (template: Template) => {
    setDownloadingState({ templateId: template.id, type: 'docx' });
    try {
      // @ts-ignore - html-to-docx missing types
      const { default: HTMLtoDOCX } = await import('html-to-docx');
      const { saveAs } = await import('file-saver');

      const filledHtml = fillHtmlWithData(template.htmlContent, {});

      const fileBuffer = await HTMLtoDOCX(filledHtml, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });

      saveAs(fileBuffer as Blob, `${template.name}.docx`);

    } catch (error) {
      console.error(`Error downloading as DOCX:`, error);
      toast({ title: 'Download Error', description: `Could not download as Word file.`, variant: 'destructive' });
    } finally {
      setDownloadingState({ templateId: null, type: null });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Document Templates</CardTitle>
            <CardDescription>Manage your document templates for PDF and Word.</CardDescription>
          </div>
          <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Template
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{template.name}</h3>
                    {template.isOfferLetterTemplate && (
                      <Badge variant="secondary">Offer Letter Template</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{template.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setTemplateToPreview(template)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(template)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSetAsOfferLetter(template.id)}
                        disabled={template.isOfferLetterTemplate}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Set as Offer Letter
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPdf(template)} disabled={!!downloadingState.templateId}>
                        {downloadingState.templateId === template.id && downloadingState.type === 'pdf' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Download as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadDocx(template)} disabled={!!downloadingState.templateId}>
                        {downloadingState.templateId === template.id && downloadingState.type === 'docx' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Download as Word
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(template.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {showForm && (
        <TemplateForm
          initialData={editingTemplate}
          onSave={handleFormSave}
          onCancel={() => setShowForm(false)}
          isSubmitting={isSubmitting}
        />
      )}

      {templateToPreview && (
        <Dialog open={!!templateToPreview} onOpenChange={() => setTemplateToPreview(null)}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{templateToPreview.name}</DialogTitle>
              <DialogDescription>
                This is a preview of your rendered template.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow border bg-gray-100 p-4 overflow-auto">
              <div
                className="prose"
                dangerouslySetInnerHTML={{
                  __html: fillHtmlWithData(templateToPreview.htmlContent, {}),
                }}
              />
            </div>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


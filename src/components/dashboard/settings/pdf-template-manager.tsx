
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription as UiAlertDescription } from "@/components/ui/alert";
import { PlusCircle, Edit, Trash2, Eye, X, Loader2, AlertTriangle, FileText as FileTextIcon, Download, MoreVertical } from 'lucide-react';
import { TemplateForm, type TemplateFormValues } from './template-form';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import Handlebars from 'handlebars';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import HTMLtoDOCX from 'html-to-docx';
import { saveAs } from 'file-saver';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export type Mapping = {
  placeholder: string;
  dataKey: string;
  type: 'database' | 'userInput';
};

export type Template = {
  id: string; // Realtime Database key
  name: string;
  description?: string;
  htmlContent: string;
  mappings: Mapping[];
  createdAt?: number; // Unix Timestamp
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

  const refreshPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error: err } = await supabase.from('pdf_templates').select('*').order('name');
      if (err) throw err;

      const loadedTemplates: Template[] = (data || []).map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        htmlContent: d.html_content,
        mappings: d.mappings,
        createdAt: new Date(d.created_at).getTime()
      }));

      setTemplates(loadedTemplates);
    } catch (err: any) {
      console.error("Error fetching templates:", err);
      setError("Failed to fetch templates.");
      toast({ title: "Error Loading Templates", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshPageData();
  }, [refreshPageData]);


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
    if (!templateToDeleteId) return;
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase.from('pdf_templates').delete().eq('id', templateToDeleteId);
      if (err) throw err;
      await refreshPageData();
      setTemplateToDeleteId(null);
      toast({ title: "Template Deleted", description: "The PDF template has been successfully deleted." });
    } catch (err: any) {
      console.error("Error deleting template:", err);
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleFormSave = async (data: TemplateFormValues) => {
    setIsSubmitting(true);

    const templateDataToSave = {
      name: data.name,
      description: data.description,
      html_content: data.htmlContent,
      mappings: data.mappings || [],
    };

    try {
      if (editingTemplate) {
        const { error: err } = await supabase.from('pdf_templates').update(templateDataToSave).eq('id', editingTemplate.id);
        if (err) throw err;
        toast({ title: "Template Updated", description: `"${data.name}" has been successfully updated.` });
      } else {
        const { error: err } = await supabase.from('pdf_templates').insert([templateDataToSave]);
        if (err) throw err;
        toast({ title: "Template Created", description: `"${data.name}" has been successfully created.` });
      }
      setShowForm(false);
      setEditingTemplate(null);
      await refreshPageData();
    } catch (err: any) {
      console.error("Error saving template:", err);
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async (template: Template) => {
    setDownloadingState({ templateId: template.id, type: 'pdf' });
    try {
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
                  <h3 className="font-semibold">{template.name}</h3>
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

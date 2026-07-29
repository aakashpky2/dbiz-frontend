'use client';

import React, { useState } from 'react';
import { 
  FileText, Check, ChevronRight, Loader2, 
  Download, Printer, X, Sparkles, Send, ArrowLeft
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UseTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityData: any;
  entityType: 'employee' | 'company' | 'associate';
}

const MOCK_TEMPLATES = [
  { id: '1', name: 'Standard Appointment Letter', category: 'HR' },
  { id: '2', name: 'Confidentiality Agreement', category: 'Legal' },
  { id: '3', name: 'Performance Review', category: 'HR' },
];

export default function UseTemplateModal({ isOpen, onClose, entityData, entityType }: UseTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!selectedTemplateId) return;
    
    setIsGenerating(true);
    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate a template with placeholders
    const template = "<h1>Appointment Letter</h1><p>Dear {{full_name}},</p><p>We are pleased to offer you the position of {{job_title}} at D-BIZ. Your joining date is {{joining_date}}.</p>";
    
    // Simple replacement based on entityData
    let final = template;
    const mappings: Record<string, string> = {
      'full_name': entityData.personalDetails?.fullName || 'N/A',
      'job_title': entityData.employmentDetails?.jobTitle || 'N/A',
      'joining_date': entityData.employmentDetails?.joiningDate || 'N/A',
    };

    Object.entries(mappings).forEach(([key, val]) => {
      final = final.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    });

    setGeneratedContent(final);
    setIsGenerating(false);
    toast({ title: "Document Generated", description: "Template processed with employee data." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className={cn(
        "transition-all duration-500",
        generatedContent ? "sm:max-w-4xl h-[90vh]" : "sm:max-w-xl"
      )}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            {generatedContent ? 'Review Generated Document' : 'Generate From Template'}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {generatedContent ? 'Final output with dynamic data replaced' : 'Select a template to generate for this entity'}
          </DialogDescription>
        </DialogHeader>

        {!generatedContent ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-3">
              {MOCK_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left group",
                    selectedTemplateId === t.id 
                      ? "border-blue-500 bg-blue-50/50 shadow-md" 
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                      selectedTemplateId === t.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                    )}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-tight text-slate-800">
                        {t.name}
                      </div>
                      <Badge variant="outline" className="mt-1 text-[8px] font-black h-4 px-1.5 border-slate-200 text-slate-400 uppercase tracking-[0.2em]">
                        {t.category}
                      </Badge>
                    </div>
                  </div>
                  {selectedTemplateId === t.id && (
                    <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center animate-in zoom-in group-hover:scale-110 transition-transform">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto p-8 bg-slate-50 rounded-2xl border-2 border-slate-200/50 my-4 shadow-inner">
             <div className="bg-white min-h-full p-12 shadow-sm border prose prose-sm max-w-none rounded-lg" dangerouslySetInnerHTML={{ __html: generatedContent }} />
          </div>
        )}

        <DialogFooter className="gap-2">
          {generatedContent ? (
            <>
              <Button variant="ghost" onClick={() => setGeneratedContent(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <div className="flex-grow" />
              <Button variant="outline" className="text-[10px] font-black uppercase tracking-widest"><Download className="h-4 w-4 mr-2" /> Download PDF</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest"><Send className="h-4 w-4 mr-2" /> Send via Email</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</Button>
              <Button 
                disabled={!selectedTemplateId || isGenerating} 
                onClick={handleGenerate}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 px-8 rounded-xl font-black uppercase tracking-widest text-[10px]"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Document
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


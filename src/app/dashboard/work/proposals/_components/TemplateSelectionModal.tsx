import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateOption {
    configuration_id: string;
    template_id: string;
    template_name: string;
    description?: string;
    priority?: number;
    matchType?: string;
}

interface TemplateSelectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    options: TemplateOption[];
    onSelect: (option: TemplateOption) => void;
}

export function TemplateSelectionModal({ open, onOpenChange, options, onSelect }: TemplateSelectionModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white border-0 shadow-2xl p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            Select Template Format
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            Multiple eligible templates were found for this action. Please select the format you want to use.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3">
                    {options.map((option) => (
                        <div 
                            key={option.configuration_id}
                            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => onSelect(option)}
                        >
                            <div className="flex items-start gap-4 flex-1">
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm font-bold text-slate-900">{option.template_name}</h4>
                                    {option.description && (
                                        <p className="text-xs font-medium text-slate-500 mt-0.5 line-clamp-2">{option.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                            Priority: {option.priority ?? 100}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                            option.matchType === 'conditional' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                                        )}>
                                            {option.matchType === 'conditional' ? 'Matched Condition' : 'Default/Always'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <Button 
                                variant="default" 
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 flex-shrink-0 shadow-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(option);
                                }}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Use This
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200">
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

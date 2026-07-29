'use client';

import React from 'react';
import { 
  Database, Link, List, Trash2, 
  Settings, Save, Search, Settings2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Placeholder } from '../hooks/useTemplateDetection';

interface PlaceholderPanelProps {
  placeholders: Placeholder[];
  onUpdate: (placeholder: Placeholder) => void;
  dataFields?: { value: string; label: string }[];
}

const PlaceholderPanel: React.FC<PlaceholderPanelProps> = ({ 
  placeholders, 
  onUpdate,
  dataFields = [
    { value: 'employee.full_name', label: 'Employee Name' },
    { value: 'employee.mobile', label: 'Employee Phone' },
    { value: 'employee.email', label: 'Employee Email' },
    { value: 'company.name', label: 'Company Name' },
    { value: 'company.address', label: 'Company Address' },
  ]
}) => {
  const { toast } = useToast();

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full overflow-hidden shadow-sm">
      <div className="px-4 py-4 border-b bg-slate-50/50">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-600" />
          Data Mapping
        </h3>
        <p className="text-[10px] text-muted-foreground font-medium uppercase mt-1">
          Map template placeholders to fields.
        </p>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {placeholders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl border border-dashed">
            <Info className="h-8 w-8 text-slate-300 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              No placeholders detected. Try adding {"{{key}}"} to your template.
            </span>
          </div>
        ) : (
          placeholders.map((p) => (
            <div key={p.key} className="p-3 bg-white border-2 border-slate-100 rounded-xl space-y-3 transition-all hover:border-blue-200 hover:shadow-sm group">
              <div className="flex justify-between items-center">
                <Badge variant="secondary" className="px-2 py-0.5 text-[9px] font-black tracking-widest bg-blue-50 text-blue-600 border-blue-200">
                  {p.key}
                </Badge>
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Detected
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 px-0.5">
                  <Settings2 className="h-3 w-3" /> Field Type
                </label>
                <Select
                  value={p.type || 'Text'}
                  onValueChange={(val: any) => onUpdate({ ...p, type: val })}
                >
                  <SelectTrigger className="h-8 text-[10px] font-bold border-slate-200 bg-slate-50/30">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Text" className="text-[10px] font-bold uppercase tracking-widest">Text</SelectItem>
                    <SelectItem value="Date" className="text-[10px] font-bold uppercase tracking-widest">Date</SelectItem>
                    <SelectItem value="Amount" className="text-[10px] font-bold uppercase tracking-widest">Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 px-0.5">
                  <Link className="h-3 w-3" /> Link to Field
                </label>
                <Select
                  value={p.mappedField || 'none'}
                  onValueChange={(val) => onUpdate({ ...p, mappedField: val === 'none' ? undefined : val })}
                >
                  <SelectTrigger className="h-8 text-[10px] font-bold border-slate-200 bg-slate-50/30">
                    <SelectValue placeholder="No mapping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-[10px] font-bold uppercase tracking-widest">Manual Entry</SelectItem>
                    {dataFields.map(field => (
                      <SelectItem key={field.value} value={field.value} className="text-[10px] font-bold uppercase tracking-widest">
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 px-0.5">
                  <Settings2 className="h-3 w-3" /> Default Value
                </label>
                <Input
                  className="h-8 text-[10px] font-bold border-slate-200 bg-slate-50/30 focus-visible:ring-blue-500"
                  value={p.defaultValue}
                  placeholder="Fallback data"
                  onChange={(e) => onUpdate({ ...p, defaultValue: e.target.value })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t bg-slate-50/50">
        <Button className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 group font-black uppercase tracking-widest text-[10px]">
          <Save className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
          Apply Configuration
        </Button>
      </div>
    </div>
  );
};

export default PlaceholderPanel;

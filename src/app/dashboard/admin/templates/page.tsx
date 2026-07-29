'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { EmptyState } from "@/components/ui/empty-state";
import { 
  PlusCircle, FileText, Search, Filter, 
  Eye, 
  Plus, Trash2, Download, Save, 
  ChevronRight, ArrowLeft, Loader2, Database,
  ChevronDown, Folder, FolderOpen, Edit2,
  Link, Zap, Globe, Layers, MoreHorizontal, ChevronLeft, SlidersHorizontal,
  Box, Sparkles, FolderGit2, Settings2, Clock, CheckCircle2, LayoutTemplate, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import TemplateEditor from '@/features/templates/components/TemplateEditor';
import TemplateDataMapping from '@/features/templates/components/TemplateDataMapping';
import { useTemplateDetection, Placeholder, detectPlaceholdersFromContent } from '@/features/templates/hooks/useTemplateDetection';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { API_ENDPOINTS } from '@/lib/api-config';
import Handlebars from 'handlebars';
import { Department, listenToDepartments } from '@/lib/department-management';

const sanitizeHTML = (html: string) => {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/on\w+="[^"]*"/gi, ''); // Remove event handlers
};

const getDummyProposalContext = () => ({
    company_name: 'Acme Corporation',
    company_logo: '<img src="https://via.placeholder.com/150" alt="Logo" style="max-height: 50px;" />',
    company_seal: '<img src="https://via.placeholder.com/150" alt="Seal" style="max-height: 50px;" />',
    company_signature: '<img src="https://via.placeholder.com/150" alt="Signature" style="max-height: 50px;" />',
    company_address: '123 Business Rd, Suite 100, Tech City, TX 75001',
    company_email: 'hello@acmecorp.com',
    company_phone: '+1 (555) 123-4567',
    company_gstin: '22AAAAA0000A1Z5',
    client_name: 'Stark Industries',
    client_email: 'tony@stark.com',
    client_phone: '+1 (555) 987-6543',
    client_gstin: '27BBBBB0000B2Z6',
    client_address: '10880 Malibu Point, Malibu, CA 90265',
    proposal_no: 'PRP-2026-0001',
    proposal_date: '16 Jun 2026',
    valid_until: '16 Jul 2026',
    branch_name: 'Headquarters',
    professional_fee: '15,000.00',
    government_fee: '2,500.00',
    gst_percentage: '18',
    gst_amount: '2,700.00',
    total_amount: '20,200.00',
    work_table: `<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: sans-serif; font-size: 14px;">
        <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #334155;">Service Category</th>
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #334155;">Details</th>
                <th style="padding: 12px; text-align: right; font-weight: bold; color: #334155;">Prof. Fee</th>
                <th style="padding: 12px; text-align: right; font-weight: bold; color: #334155;">Govt. Fee</th>
            </tr>
        </thead>
        <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; color: #475569;">Company Registration</td>
                <td style="padding: 12px; color: #475569;">Private Limited Incorporation</td>
                <td style="padding: 12px; text-align: right; color: #475569;">10,000.00</td>
                <td style="padding: 12px; text-align: right; color: #475569;">1,500.00</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; color: #475569;">Tax Consulting</td>
                <td style="padding: 12px; color: #475569;">Annual Retainer</td>
                <td style="padding: 12px; text-align: right; color: #475569;">5,000.00</td>
                <td style="padding: 12px; text-align: right; color: #475569;">1,000.00</td>
            </tr>
        </tbody>
    </table>`,
    services: [
        { category: 'Company Registration', sub_category: 'Private Limited Incorporation', prof_fee: '10,000.00', govt_fee: '1,500.00' },
        { category: 'Tax Consulting', sub_category: 'Annual Retainer', prof_fee: '5,000.00', govt_fee: '1,000.00' }
    ]
});

interface DbTemplate {
  id: string;
  name: string;
  content: string;
  placeholders: any[];
  group_id: string | null;
  sub_group_id: string | null;
  category_id: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface StructureConfig {
  id: string;
  name: string;
  tag?: string;
  description?: string;
  selected_tables: string[];
  selected_fields: string[];
  conditions: any[];
  template_id?: string;
}

const mockLegacyTemplates: DbTemplate[] = [];

export default function TemplatesPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('New Template');
  const [templateContent, setTemplateContent] = useState('');
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [debouncedContent, setDebouncedContent] = useState('');
  const [viewMode, setViewMode] = useState<'design' | 'preview'>('design');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setTemplateName('New Template');
    setNewTemplateDescription('');
    setNewTemplateGroupId('all');
    setNewTemplateSubGroupId('all');
  };
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [activeTab, setActiveTab] = useState('templates');
  const [mappingTemplateId, setMappingTemplateId] = useState<string | null>(null);
  const [mappingPlaceholders, setMappingPlaceholders] = useState<Placeholder[]>([]);
  const [structures, setStructures] = useState<StructureConfig[]>([]);
  const [newTemplateGroupId, setNewTemplateGroupId] = useState<string>('all');
  const [newTemplateSubGroupId, setNewTemplateSubGroupId] = useState<string>('all');
  
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const unsubscribe = listenToDepartments((fetchedDepts) => {
        setDepartments(fetchedDepts || []);
    });
    return () => unsubscribe();
  }, []);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeSubGroupId, setActiveSubGroupId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const { toast } = useToast();
  const { hasPermission, loading: permLoading } = usePermissions();
  const router = useRouter();
  const canManageTemplates = hasPermission('MANAGE_TEMPLATES');
  const canViewTemplates = hasPermission('VIEW_TEMPLATES') || hasPermission('MANAGE_TEMPLATES');

  useEffect(() => {
    if (!permLoading && !canViewTemplates) {
      toast({ title: "Access Denied", description: "You do not have permission to access templates.", variant: "destructive" });
      router.push('/dashboard');
    }
  }, [permLoading, canManageTemplates, router, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(templateContent);
    }, 300);
    return () => clearTimeout(timer);
  }, [templateContent]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.TEMPLATES);
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data);
      } else {
        setTemplates(mockLegacyTemplates);
      }
    } catch (e) {
            console.error(e);
      setTemplates(mockLegacyTemplates);
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
      setIsLoading(false);
    }
  };

  const fetchStructures = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEMPLATE_CONFIGS);
      const json = await res.json();
      if (json.success) setStructures(json.data || []);
    } catch (e) {
            console.error("Fetch Structures Failed:", e);
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Operation failed",
                variant: "destructive"
            });
        
        }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchStructures();
  }, [fetchStructures]);

  const { placeholders, setPlaceholders } = useTemplateDetection(debouncedContent);

  const handleUpdatePlaceholder = useCallback((updated: Placeholder) => {
    setPlaceholders(current => 
      current.map(p => p.key === updated.key ? updated : p)
    );
  }, [setPlaceholders]);

  const handleSave = useCallback(async (explicitContent?: any, shouldExit = false) => {
    const finalContent = typeof explicitContent === 'string' ? explicitContent : templateContent;
    if (!finalContent.trim() || finalContent === '<p></p>') {
      toast({ title: "Cannot Save", description: "Template content is empty.", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        name: templateName,
        content: finalContent,
        placeholders: placeholders,
        groupId: activeGroupId || null,
        subGroupId: activeSubGroupId || null,
        isPublished: true
      };

      const url = editingTemplateId ? `${API_ENDPOINTS.TEMPLATES}/${editingTemplateId}` : API_ENDPOINTS.TEMPLATES;
      const res = await fetch(url, {
        method: editingTemplateId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const json = await res.json();
      if (json.success) {
        await fetchTemplates();
        toast({ title: "Saved Successfully", description: "Design updated successfully." });
        setTemplateContent(finalContent);
        if (shouldExit) {
          setIsEditing(false);
        }
      } else {
        throw new Error(json.error || 'Failed to save');
      }
    } catch (err: any) {
      toast({ title: "Save Error", description: err.message, variant: "destructive" });
    }
  }, [templateContent, toast, templateName, editingTemplateId, activeGroupId, activeSubGroupId, placeholders]);

  const handleSaveMapping = async () => {
    if (!mappingTemplateId) return;
    const template = templates.find(t => t.id === mappingTemplateId);
    if (!template) return;
    try {
      const payload = { ...template, placeholders: mappingPlaceholders };
      const res = await fetch(`${API_ENDPOINTS.TEMPLATES}/${mappingTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        await fetchTemplates();
        toast({ title: "Data Linked", description: "Fields updated successfully." });
        setMappingTemplateId(null);
      }
    } catch (err) {
      toast({ title: "Sync Error", variant: "destructive", description: "Protocol failed to synchronize with backend." });
    }
  };

  const handleStartMapping = (template: DbTemplate) => {
    setMappingTemplateId(template.id);
    
    // Fallback to manual placeholder detection from content
    const detectedKeys = detectPlaceholdersFromContent(template.content);
    const mergedPlaceholders: Placeholder[] = detectedKeys.map(key => {
      const existing = template.placeholders?.find(p => p.key === key);
      if (existing) return existing;
      const lowerKey = key.toLowerCase();
      let type: Placeholder['type'] = 'Text';
      if (lowerKey.includes('date')) type = 'Date';
      if (lowerKey.includes('amount') || lowerKey.includes('salary')) type = 'Amount';
      return { key, name: key.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), type, defaultValue: '' };
    });
    setMappingPlaceholders(mergedPlaceholders);
  };

  const initiateNewTemplate = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateContent('');
    setNewTemplateDescription('');
    setNewTemplateGroupId(activeGroupId || 'all');
    setNewTemplateSubGroupId(activeSubGroupId || 'all');
    setIsCreateModalOpen(true);
  };

  const startDesigning = () => {
    setIsCreateModalOpen(false);
    setIsEditing(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Active';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Active' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getBreadcrumbs = () => {
    if (!activeGroupId) return "All Templates";
    const group = departments.find(g => g.id === activeGroupId);
    if (!activeSubGroupId) return group?.name || "All Templates";
    const subGroup = group?.workCategories?.find(sg => sg.id === activeSubGroupId);
    return `${group?.name} / ${subGroup?.name}`;
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((t: any) => {
      const matchSearch = String(t.name).toLowerCase().includes(searchQuery.toLowerCase());
      const matchGroup = !activeGroupId || t.group_id === activeGroupId;
      const matchSub = !activeSubGroupId || t.sub_group_id === activeSubGroupId;
      const matchStatus = statusFilter === 'all' ? true : (statusFilter === 'active' ? t.is_published : !t.is_published);
      return matchSearch && matchGroup && matchSub && matchStatus;
   });
  }, [searchQuery, activeGroupId, activeSubGroupId, statusFilter, templates]);

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Are you certain you want to permanently decommission "${name}"? This action is irreversible.`)) return;
    try {
      const res = await fetch(`${API_ENDPOINTS.TEMPLATES}/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await fetchTemplates();
        toast({ title: "Asset Removed", description: "Template has been deleted from the registry." });
      }
    } catch (err: any) {
      toast({ title: "Deconfig Error", description: err.message, variant: "destructive" });
    }
  };

  const totalCategories = useMemo(() => {
    return departments.reduce((acc, dept) => acc + (dept.workCategories?.length || 0), 0);
  }, [departments]);

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden animate-in fade-in duration-700">
        <div className="print-hide flex items-center justify-between px-8 py-5 border-b bg-white/80 backdrop-blur-3xl z-40 sticky top-0">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="rounded-2xl hover:bg-slate-50 transition-colors h-14 w-14 border border-slate-100 shadow-sm">
              <ArrowLeft className="h-6 w-6 text-slate-800" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} className="text-2xl font-black tracking-tighter text-slate-900 border-none bg-transparent hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-indigo-100 p-1 px-4 h-auto max-w-[500px] rounded-2xl transition-all" />
              </div>
              <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.3em] mt-2 ml-4">{getBreadcrumbs()}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="bg-slate-100/50 p-2 rounded-[2rem] flex items-center shadow-inner border border-slate-200/40">
                <button onClick={() => setViewMode('design')} className={cn("px-10 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'design' ? "bg-white text-indigo-700 shadow-2xl shadow-indigo-500/10 border border-indigo-100" : "text-slate-400 hover:text-slate-600")}>Design</button>
                <button onClick={() => setViewMode('preview')} className={cn("px-10 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'preview' ? "bg-white text-emerald-700 shadow-2xl shadow-emerald-500/10 border border-emerald-100" : "text-slate-400 hover:text-slate-600")}>Preview</button>
             </div>
             
             <Button onClick={handleSave} className="h-14 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 hover:to-slate-900 text-white px-12 rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_20px_50px_-10px_rgba(79,70,229,0.3)] active:scale-95 transition-all group">
                <Zap className="w-4 h-4 mr-3 group-hover:rotate-12 transition-transform" /> Save Design
             </Button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto flex flex-col items-center pt-12 bg-slate-50/40">
          <div className="max-w-[1500px] w-full flex flex-col animate-in slide-in-from-bottom-8 duration-700 pb-32 px-6 md:px-12">
            {viewMode === 'preview' ? (
              <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-500 pt-10">
                <div className="bg-white shadow-[0_60px_120px_-20px_rgba(0,0,0,0.12)] border border-slate-100 flex flex-col overflow-hidden relative rounded-sm" style={{ width: '210mm', minHeight: '297mm' }}>
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-50 via-violet-500 to-emerald-500" />
                  <div className="p-[20mm] prose prose-slate max-w-none text-slate-900 leading-relaxed" 
                       dangerouslySetInnerHTML={{ 
                           __html: (() => {
                               let content = sanitizeHTML(templateContent);
                               if (content.includes('{{')) {
                                   try {
                                       const template = Handlebars.compile(content);
                                       content = template(getDummyProposalContext());
                                   } catch (e) {
            console.error('Handlebars compile error in preview:', e);
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Operation failed",
                variant: "destructive"
            });
        
        }
                               }
                               return content;
                           })()
                       }} 
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] border border-slate-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] overflow-hidden">
                 <TemplateEditor key={editingTemplateId || 'new'} initialContent={templateContent} onSave={(c, exit) => handleSave(c, exit)} onChange={setTemplateContent} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative overflow-y-auto animate-in fade-in duration-1000 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* SaaS Header Area */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-6 pb-0">
        <div className="max-w-none w-full mx-auto">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mb-1">Template Hub</h1>
                    <p className="text-sm font-medium text-[#64748B]">Manage proposal, offer letter, quotation, agreement and document templates.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-[#F8FAFC] h-10 px-4 rounded-xl font-semibold shadow-sm transition-all">
                        <Download className="w-4 h-4 mr-2" /> Import Template
                    </Button>
                    <Button variant="outline" className="bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-[#F8FAFC] h-10 px-4 rounded-xl font-semibold shadow-sm transition-all">
                        <Folder className="w-4 h-4 mr-2" /> Create Folder
                    </Button>
                    <Button onClick={initiateNewTemplate} className="h-10 bg-[#4F46E5] hover:bg-indigo-600 text-white px-5 rounded-xl font-semibold shadow-sm transition-all">
                        <Plus className="w-4 h-4 mr-2" /> New Template
                    </Button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Templates</div>
                        <Layers className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-3xl font-black text-[#0F172A]">{templates.length}</div>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Active Templates</div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-3xl font-black text-[#0F172A]">{templates.filter(t => t.is_published).length}</div>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Departments</div>
                        <FolderGit2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-3xl font-black text-[#0F172A]">{departments.length}</div>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Categories</div>
                        <FolderOpen className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="text-3xl font-black text-[#0F172A]">{totalCategories}</div>
                </div>
            </div>

            {/* Tabs Row */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-transparent border-b border-[#E2E8F0] rounded-none p-0 h-auto w-full justify-start gap-8">
                    <TabsTrigger value="templates" className="px-0 py-4 h-auto rounded-none text-sm font-semibold text-[#64748B] data-[state=active]:bg-transparent data-[state=active]:text-[#4F46E5] data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#4F46E5] transition-all">
                        Templates
                    </TabsTrigger>
                    <TabsTrigger value="configurations" className="px-0 py-4 h-auto rounded-none text-sm font-semibold text-[#64748B] data-[state=active]:bg-transparent data-[state=active]:text-[#4F46E5] data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#4F46E5] transition-all">
                        Configurations
                    </TabsTrigger>
                    <TabsTrigger value="mapping" className="px-0 py-4 h-auto rounded-none text-sm font-semibold text-[#64748B] data-[state=active]:bg-transparent data-[state=active]:text-[#4F46E5] data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#4F46E5] transition-all">
                        Field Mapping
                    </TabsTrigger>
                </TabsList>
            
            <div className="py-6">
            <TabsContent value="templates" className="mt-0 outline-none">
                {/* Horizontal Filter Bar */}
        <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm mb-6 grid grid-cols-1 lg:grid-cols-[1fr_180px_180px_150px_150px_auto] gap-3 items-center">
            <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
                        <Input 
                            placeholder="Search templates..." 
                            className="h-10 pl-9 border-none bg-transparent focus-visible:ring-0 text-sm font-medium shadow-none" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                        />
                    </div>
            <div className="hidden"></div>
            <Select value={activeGroupId || 'all'} onValueChange={(val) => { setActiveGroupId(val === 'all' ? null : val); setActiveSubGroupId(null); }}>
                <SelectTrigger className="h-10 w-full border-none bg-transparent hover:bg-[#F8FAFC] font-semibold text-sm text-[#0F172A] focus:ring-0 shadow-none">
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.filter(d => templates.some(t => t.group_id === d.id)).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
            {activeGroupId && departments.find((d) => d.id === activeGroupId)?.workCategories?.length === 0 ? (
                <div className="h-10 px-3 flex items-center text-[10px] font-semibold text-slate-500 bg-slate-50 rounded-md truncate">
                    No categories available for selected department
                </div>
            ) : (
                <Select value={activeSubGroupId || 'all'} onValueChange={(val) => setActiveSubGroupId(val === 'all' ? null : val)} disabled={!activeGroupId}>
                    <SelectTrigger className="h-10 w-full border-none bg-transparent hover:bg-[#F8FAFC] font-semibold text-sm text-[#0F172A] focus:ring-0 shadow-none disabled:opacity-50">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {departments.find((d) => d.id === activeGroupId)?.workCategories?.filter(c => templates.some(t => t.sub_group_id === c.id)).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full border-none bg-transparent hover:bg-[#F8FAFC] font-semibold text-sm text-[#0F172A] focus:ring-0 shadow-none">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                    </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-10 w-full border-none bg-transparent hover:bg-[#F8FAFC] font-semibold text-sm text-[#0F172A] focus:ring-0 shadow-none">
                            <SelectValue placeholder="Template Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="proposal">Proposal</SelectItem>
                            <SelectItem value="document">Document</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                    </Select>
            <div className="hidden"></div>
            <Button variant="ghost" onClick={() => { setSearchQuery(''); setActiveGroupId(null); setActiveSubGroupId(null); setStatusFilter('all'); setTypeFilter('all'); }} className="h-10 text-[#64748B] hover:text-[#0F172A] font-semibold text-sm w-full md:w-auto">
                Reset
            </Button>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
            {/* Sidebar */}
            <aside className="space-y-4 sticky top-6 hidden 2xl:block w-full 2xl:w-[280px]">
                        <div className="bg-transparent space-y-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4 px-2">Departments</h3>
                <button onClick={() => { setActiveGroupId(null); setActiveSubGroupId(null); }} className={cn("w-full flex items-center justify-between h-11 px-3 rounded-xl text-sm font-semibold transition-all", !activeGroupId ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "text-slate-700 hover:bg-slate-100")}>
                    <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4" /> All Templates
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-bold">{templates.length}</Badge>
                </button>

                            {departments.map(dept => {
                                const deptTemplates = templates.filter(t => t.group_id === dept.id);
                                if (deptTemplates.length === 0) return null;
                                const isDeptActive = activeGroupId === dept.id;
                                return (
                                    <div key={dept.id} className="space-y-1 mt-2">
                        <button onClick={() => { setActiveGroupId(dept.id); setActiveSubGroupId(null); }} className={cn("w-full flex items-center justify-between h-11 px-3 rounded-xl text-sm font-semibold transition-all", isDeptActive ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "text-slate-700 hover:bg-slate-100")}>
                            <div className="flex items-center gap-3 truncate">
                                <FolderGit2 className={cn("w-4 h-4", isDeptActive ? "text-indigo-700" : "text-slate-500")} /> 
                                <span className="truncate">{dept.name}</span>
                            </div>
                            <Badge variant="secondary" className={cn("font-bold ml-2 shrink-0", isDeptActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500")}>{deptTemplates.length}</Badge>
                        </button>

                                        {isDeptActive && dept.workCategories?.length > 0 && (
                                            <div className="pl-6 space-y-1 mt-1 border-l-2 border-[#E2E8F0] ml-5">
                                                {dept.workCategories.map(cat => {
                                                    const catTemplates = templates.filter(t => t.sub_group_id === cat.id);
                                                    if (catTemplates.length === 0) return null;
                                                    const isCatActive = activeSubGroupId === cat.id;
                                                    return (
                                                        <button key={cat.id} onClick={() => setActiveSubGroupId(cat.id)} className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all", isCatActive ? "text-[#4F46E5] bg-indigo-50/50" : "text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100/50")}>
                                                            <span className="truncate">{cat.name}</span>
                                                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-md font-bold">{catTemplates.length}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
            </aside>

            {/* Main Grid */}
            <section className="min-w-0 w-full overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                    {filteredTemplates.length === 0 ? (
                                <div className="col-span-full py-32 text-center bg-white rounded-3xl border border-[#E2E8F0] flex flex-col items-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                                        <Box className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-[#0F172A] mb-2">No templates found</h3>
                                    <p className="text-sm font-medium text-[#64748B] mb-8 max-w-sm">We couldn't find any templates matching your current filters. Try adjusting your search or create a new one.</p>
                                    <Button onClick={initiateNewTemplate} className="h-10 px-6 rounded-xl bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold transition-all">
                                        Create New Template
                                    </Button>
                                </div>
                            ) : (
                                filteredTemplates.map((template: any) => {
                                    const dept = departments.find(d => d.id === template.group_id);
                                    const cat = dept?.workCategories?.find(c => c.id === template.sub_group_id);
                                    const configsUsingThis = structures.filter(s => s.template_id === template.id).length || 0;

                                    return (
                        <div key={template.id} className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col min-h-[260px]">
                            <div className="flex items-start justify-between mb-3">
                                <div className="h-10 w-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all">
                                    <LayoutTemplate className="w-5 h-5 text-[#64748B] group-hover:text-indigo-600 transition-colors" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn("px-2.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", template.is_published ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                                        {template.is_published ? 'Active' : 'Draft'}
                                    </Badge>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id, template.name); }} className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-300 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            
                            <h3 className="text-base font-semibold text-slate-900 mb-4 line-clamp-2 leading-snug min-h-[44px]">{template.name}</h3>
                            
                            <div className="space-y-2 mb-5 flex-1 min-w-0">
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-xs text-slate-500">Used In</span>
                                    <span className="text-xs font-medium text-slate-900 text-right truncate">Proposal PDF</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-xs text-slate-500">Department</span>
                                    <span className="text-xs font-medium text-slate-900 text-right truncate">{dept?.name || 'Unassigned'}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-xs text-slate-500">Category</span>
                                    <span className="text-xs font-medium text-slate-900 text-right truncate">{cat?.name || 'Unassigned'}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-xs text-slate-500">Configs</span>
                                    <span className="text-xs font-medium text-slate-900 text-right truncate">{configsUsingThis > 0 ? `${configsUsingThis} Rules` : 'None'}</span>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 text-[#64748B] mb-0.5">
                                        <Clock className="w-3 h-3" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Updated</span>
                                    </div>
                                    <span className="text-xs font-semibold text-[#0F172A]">{formatDate(template.updated_at)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => { setEditingTemplateId(template.id); setTemplateName(template.name); setTemplateContent(template.content); setIsEditing(true); }} className="h-9 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-xs font-bold transition-all shadow-sm">
                                        Edit
                                    </Button>
                                </div>
                            </div>
                        </div>
                                    );
                                })
                            )}
                </div>
            </section>
        </div>
            </TabsContent>

            <TabsContent value="configurations" className="mt-0">
                <div className="bg-white rounded-3xl p-12 border border-[#E2E8F0] min-h-[500px] flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                        <Link className="h-8 w-8 text-[#4F46E5]" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#0F172A] mb-3">Template Configurations</h2>
                    <p className="max-w-md text-[#64748B] font-medium leading-relaxed mb-8">
                        Link your templates to dynamic business processes, workflows, or automated triggers based on departmental conditions.
                    </p>
                    <Button variant="outline" className="border-[#E2E8F0] text-[#0F172A] font-semibold h-10 px-6 rounded-xl hover:bg-[#F8FAFC]">
                        Manage Configurations
                    </Button>
                </div>
            </TabsContent>

            <TabsContent value="mapping" className="mt-0 space-y-4">
             {!mappingTemplateId ? (
                 <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                       {templates.map((template: any) => (
                         <div key={template.id} onClick={() => handleStartMapping(template)} className="group bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col items-center text-center">
                            <div className="h-12 w-12 rounded-xl bg-[#F8FAFC] flex items-center justify-center mb-4 group-hover:bg-indigo-50 transition-all"><Database className="w-6 h-6 text-[#64748B] group-hover:text-indigo-600" /></div>
                            <h3 className="text-[15px] font-bold text-[#0F172A] mb-2 truncate w-full group-hover:text-indigo-600">{template.name}</h3>
                            <Badge variant="outline" className="bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] mb-5">{template.placeholders?.length || 0} Fields</Badge>
                            <Button variant="ghost" className="h-9 w-full rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] font-semibold text-xs">Link Data</Button>
                         </div>
                       ))}
                    </div>
                 </div>
              ) : (
                 <div className="space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm">
                       <div className="flex items-center gap-6">
                          <Button variant="ghost" size="icon" onClick={() => setMappingTemplateId(null)} className="rounded-xl h-12 w-12 border border-[#E2E8F0] hover:bg-[#F8FAFC]"><ArrowLeft className="h-5 w-5 text-[#0F172A]" /></Button>
                          <div>
                             <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-1">Mapping Setup</p>
                             <h2 className="text-xl font-bold text-[#0F172A]">{templates.find(t => t.id === mappingTemplateId)?.name}</h2>
                          </div>
                       </div>
                       <Button onClick={handleSaveMapping} className="h-10 px-8 rounded-xl bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold shadow-sm transition-all">Save Mapping</Button>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-sm">
                       {templates.find(t => t.id === mappingTemplateId)?.name?.toLowerCase().includes('proposal') ? (
                          <div className="text-center space-y-6 max-w-2xl mx-auto py-12">
                             <div className="h-16 w-16 bg-indigo-50 text-[#4F46E5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8" />
                             </div>
                             <h3 className="text-xl font-bold text-[#0F172A]">System-Generated Context</h3>
                             <p className="text-[#64748B] font-medium leading-relaxed">
                                Proposal templates use system-generated proposal context fields. No database field mapping is required.
                             </p>
                             <div className="mt-8 text-left bg-[#F8FAFC] p-6 rounded-2xl border border-[#E2E8F0]">
                                <h4 className="text-sm font-bold text-[#0F172A] mb-4">Available Placeholders</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm text-[#64748B] font-mono">
                                   <span>{`{{client_name}}`}</span>
                                   <span>{`{{proposal_no}}`}</span>
                                   <span>{`{{proposal_date}}`}</span>
                                   <span>{`{{professional_fee}}`}</span>
                                   <span>{`{{government_fee}}`}</span>
                                   <span>{`{{gst_amount}}`}</span>
                                   <span>{`{{total_amount}}`}</span>
                                   <span className="font-bold text-[#4F46E5]">{`{{{work_table}}}`}</span>
                                </div>
                             </div>
                          </div>
                       ) : (
                          <TemplateDataMapping placeholders={mappingPlaceholders} exposedTables={[]} onUpdate={(updated) => setMappingPlaceholders(current => current.map(p => p.key === updated.key ? updated : p))} />
                       )}
                    </div>
                 </div>
              )}
            </TabsContent>
            </div>
            </Tabs>
        </div>
      </div>

       {isCreateModalOpen && (
         <div className="fixed inset-0 z-[200] bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl border border-[#E2E8F0] animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-[#0F172A] mb-1">Create New Template</h2>
                        <p className="text-sm text-[#64748B] font-medium">Configure basic details for your asset</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleCloseCreateModal} className="h-8 w-8 rounded-full hover:bg-[#F8FAFC] text-[#64748B]">
                        <X className="w-5 h-5" />
                    </Button>
                </div>
                
                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#0F172A]">Template Name</label>
                        <Input placeholder="e.g. Standard Offer Letter v2" className="h-11 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] font-medium text-[#0F172A] focus:ring-2 focus:ring-indigo-100 transition-all shadow-none" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#0F172A]">Department</label>
                        <Select value={newTemplateGroupId} onValueChange={(val: string) => { setNewTemplateGroupId(val); setNewTemplateSubGroupId('all'); }}>
                            <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] font-medium text-[#0F172A] shadow-none"><SelectValue placeholder="Choose Department" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Unassigned</SelectItem>
                                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#0F172A]">Category</label>
                        <Select value={newTemplateSubGroupId} onValueChange={setNewTemplateSubGroupId} disabled={newTemplateGroupId === 'all'}>
                            <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] font-medium text-[#0F172A] shadow-none disabled:opacity-50"><SelectValue placeholder="Choose Category" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Unassigned</SelectItem>
                                {departments.find(d => d.id === newTemplateGroupId)?.workCategories?.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={handleCloseCreateModal} className="h-10 rounded-xl font-semibold text-[#64748B] hover:text-[#0F172A]">Cancel</Button>
                    <Button onClick={() => { setActiveGroupId(newTemplateGroupId === 'all' ? null : newTemplateGroupId); setActiveSubGroupId(newTemplateSubGroupId === 'all' ? null : newTemplateSubGroupId); startDesigning(); }} className="h-10 px-6 rounded-xl bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold transition-all">Start Designing</Button>
                </div>
            </div>
         </div>
       )}
    </div>
  );
}

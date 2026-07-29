'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, FileText, AlertTriangle, Download, Search, Eye, ChevronDown, ChevronRight, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
// Locally define Template to match the backend schema for Offer Letter generation
export type Template = {
  id: string;
  name: string;
  content: string;
  placeholders: any[];
  group_id?: string | null;
  sub_group_id?: string | null;
  category_id?: string | null;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
};
import { useProfiles, useBusinessConstitutions, type Profile, type BusinessTypeSetup } from '@/hooks/use-profiles';
import { format } from 'date-fns';
import { globalCache } from '@/lib/cache-utils';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getByAdvancedPath } from '@/lib/templatePaths';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { API_ENDPOINTS } from '@/lib/api-config';

type SavedOfferLetter = {
  employeeId: string;
  profileId: string;
  templateId: string;
  html: string;
  createdAt: number;
  updatedAt: number;
};

export type Employee = {
  id: string;
  personalDetails: {
    fullName: string;
    email: string;
    photo?: string;
    dateOfBirth?: string;
  };
  employmentDetails: {
    employeeId: string;
    jobTitle?: string;
    employeeRole: string;
    joiningDate?: string;
    monthlySalary?: number;
  };
  addressDetails?: any;
};

const PREVIEW_STYLES = `
  .prose-container {
    position: relative !important;
    min-height: 1000px;
    background: white;
  }
  .prose-container [data-type="custom-image"],
  .prose-container [data-type="custom-text-box"],
  .prose-container [data-type="custom-symbol"],
  .prose-container [data-type="custom-horizontal-rule"] {
    position: absolute !important;
    z-index: 10;
  }
  .prose-container img {
    display: block;
    max-width: none;
  }
`;

const fillHtmlTemplate = async (
  template: Template,
  employeeData: Employee,
  profileData: Profile | null,
  constitutionData: BusinessTypeSetup | null,
  roleSelections: Record<string, string>
): Promise<{ filledHtml: string; templateData: Record<string, any> }> => {

  if (!profileData || !constitutionData) return { filledHtml: '', templateData: {} };

  const combinedData = {
    employee: employeeData,
    profile: profileData,
    signingAuthority: {} as any,
  };

  const templateData: Record<string, any> = {};

  const primaryManagementRole = constitutionData.roles?.find(r => r.isManagementRole);
  if (primaryManagementRole && profileData.roles?.[primaryManagementRole.roleKey]) {
    const roleKey = primaryManagementRole.roleKey;
    const members = profileData.roles[roleKey].members;

    if (members && members.length > 0) {
      let memberToUse: any;
      const selectedMemberId = roleSelections[roleKey];

      if (selectedMemberId) {
        memberToUse = members.find((m: any) => m._id === selectedMemberId);
      } else {
        const primaryMemberId = profileData.primarySignatories?.[roleKey];
        if (primaryMemberId) {
          memberToUse = members.find((m: any) => m._id === primaryMemberId);
        }
      }
      if (!memberToUse) memberToUse = members[0];

      if (memberToUse?.details) {
        combinedData.signingAuthority = {
          name: memberToUse.details.name || memberToUse.details.full_name || 'N/A',
          designation: memberToUse.details.designation || primaryManagementRole.roleName,
          ...memberToUse.details,
        };
      }
    }
  }

  // NEW: Requested standard placeholders logic
  const requestedPlaceholders: Record<string, any> = {
    employee_name: employeeData.personalDetails?.fullName || '',
    candidate_name: employeeData.personalDetails?.fullName || '',
    role: employeeData.employmentDetails?.employeeRole || employeeData.employmentDetails?.jobTitle || '',
    designation: employeeData.employmentDetails?.employeeRole || employeeData.employmentDetails?.jobTitle || '',
    monthly_salary: employeeData.employmentDetails?.monthlySalary || '',
    salary: employeeData.employmentDetails?.monthlySalary || '',
    employee_city: (employeeData.addressDetails as any)?.city || (employeeData.addressDetails as any)?.cityTownVillage || '',
    date_of_birth: employeeData.personalDetails?.dateOfBirth ? format(new Date(employeeData.personalDetails.dateOfBirth), 'do MMMM yyyy') : '',
  };

  if (employeeData.employmentDetails?.joiningDate) {
    try {
      requestedPlaceholders.joining_date = format(new Date(employeeData.employmentDetails.joiningDate), 'do MMMM yyyy');
    } catch (e) { console.error(e); }
  }

  // Pre-fill smart commonly used placeholders using flat key-values (legacy support)
  const smartAutoFill: Record<string, any> = {
    ...requestedPlaceholders,
    employeeName: employeeData.personalDetails?.fullName || '',
    candidateName: employeeData.personalDetails?.fullName || '',
    name: employeeData.personalDetails?.fullName || '',
    email: employeeData.personalDetails?.email || '',
    jobTitle: employeeData.employmentDetails?.jobTitle || employeeData.employmentDetails?.employeeRole || '',
    employeeRole: employeeData.employmentDetails?.employeeRole || '',
    salary: employeeData.employmentDetails?.monthlySalary || '',
    monthlySalary: employeeData.employmentDetails?.monthlySalary || '',
    companyName: profileData.profileName || profileData.fields?.legal_name || '',
    businessName: profileData.profileName || profileData.fields?.legal_name || '',
  };

  if (employeeData.employmentDetails?.joiningDate) {
    try {
      const formattedDate = format(new Date(employeeData.employmentDetails.joiningDate), 'do MMMM yyyy');
      smartAutoFill.joiningDate = formattedDate;
    } catch (e) { console.error(e); }
  }

  // Combine data
  const finalData = { ...smartAutoFill, ...templateData, ...combinedData };

  // Advanced simple replacement for new direct {{key}} / =key / >key template formats from our new engine
  let processedHtml = template.content || (template as any).htmlContent || '';
  Object.keys(finalData).forEach(key => {
     const value = (finalData as any)[key] ? String((finalData as any)[key]) : '';
     const escapedVal = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
     const regex = new RegExp(`(\\{\\{${key}\\}\\}|>${key}|=${key})`, 'gi');
     processedHtml = processedHtml.replace(regex, escapedVal);
  });

  const { default: Handlebars } = await import('handlebars');
  const handlebarsTemplate = Handlebars.compile(processedHtml);
  const finalHtml = handlebarsTemplate(finalData);

  return { filledHtml: finalHtml, templateData: finalData };
};


export default function OfferLetterPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [offerLetterTemplate, setOfferLetterTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const editableContentRef = useRef<HTMLDivElement>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [roleSelections, setRoleSelections] = useState<Record<string, Record<string, string>>>({});
  const [savedLetters, setSavedLetters] = useState<Record<string, SavedOfferLetter>>({});
  const [currentTab, setCurrentTab] = useState<'to-generate' | 'generated'>('to-generate');
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);


  const { profiles, loading: profilesLoading } = useProfiles();
  const { constitutions, loading: constitutionsLoading } = useBusinessConstitutions();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (!profilesLoading && profiles.length > 0) {
      const defaultProfile = profiles.find(p => p.isDefault) || profiles[0];
      setSelectedProfileId(defaultProfile.id);
    }
  }, [profiles, profilesLoading]);


  const refreshPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Employees
      const CACHE_KEY = 'full_employees_list_offer_letter';
      let empData = globalCache.get<any>(CACHE_KEY);

      if (!empData) {
        const res = await supabase.from('employees').select('*, employee_addresses(*)');
        if (res.error) throw new Error(res.error.message || res.error.details || JSON.stringify(res.error));
        empData = res.data;
        globalCache.set(CACHE_KEY, empData, 5 * 60 * 1000);
      }

      if (empData) {
        const loadedEmployees: Employee[] = empData.map((emp: any) => {
          const primaryAddr = emp.employee_addresses?.find((a: any) => a.address_type === 'PERMANENT') || emp.employee_addresses?.[0] || {};
          return {
            id: emp.id,
            personalDetails: {
              fullName: emp.full_name,
              email: emp.email,
              photo: emp.photo_url,
              dateOfBirth: emp.date_of_birth
            },
            employmentDetails: {
              employeeId: emp.employee_id_hash || emp.id,
              jobTitle: emp.employee_role,
              employeeRole: emp.employee_role,
              joiningDate: emp.joining_date,
              monthlySalary: emp.monthly_salary
            },
            addressDetails: primaryAddr
          };
        });
        setEmployees(loadedEmployees);
      }

      // 2. Fetch Templates (Using the unified 'templates' table via API to match the new engine)
      const res = await fetch(API_ENDPOINTS.TEMPLATES);
      const json = await res.json();
      
      if (json.success && json.data) {
        const allTemplates = json.data as Template[];
        // Filter for Offer letters category (c1) or similar identification
        const offerTemplates = allTemplates.filter(t => 
          t.category_id === 'c1' || 
          t.name?.toLowerCase().includes('offer letter')
        );
        
        setAvailableTemplates(offerTemplates);
        
        if (offerTemplates.length > 0) {
          setOfferLetterTemplate(offerTemplates[0]);
        } else if (allTemplates.length > 0) {
          setAvailableTemplates(allTemplates);
          setOfferLetterTemplate(allTemplates[0]);
        } else {
           setError("No templates found in the system. Please create a template in Admin Panel → Templates.");
        }
      } else {
         // Fallback to supabase direct query if API fails
         const { data: directTemplates } = await supabase.from('templates').select('*');
         if (directTemplates && directTemplates.length > 0) {
           setAvailableTemplates(directTemplates as any);
           setOfferLetterTemplate(directTemplates[0] as any);
         } else {
           setError("Could not load templates. Please ensure you have created templates in the Admin section.");
         }
      }

      // 3. Fetch saved letters
      const lettersRes = await supabase.from('offer_letters').select('*');
      if (lettersRes.error) {
        console.error("Error fetching offer letters", lettersRes.error);
      } else if (lettersRes.data) {
        const mapped: Record<string, SavedOfferLetter> = {};
        lettersRes.data.forEach(l => {
          mapped[l.employee_id] = {
            employeeId: l.employee_id,
            profileId: l.profile_id,
            templateId: l.template_id,
            html: l.html,
            createdAt: new Date(l.created_at).getTime(),
            updatedAt: new Date(l.updated_at).getTime()
          };
        });
        setSavedLetters(mapped);
      }

    } catch (err: any) {
      const msg = err?.message || err?.details || 'An unknown error occurred.';
      console.error("Error fetching data:", msg);
      setError(msg);
      toast({ title: "Error", description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshPageData();
  }, [refreshPageData]);


  const handleToggleRow = (employeeId: string) => {
    setExpandedRows(prev => ({ ...prev, [employeeId]: !prev[employeeId] }));
  };

  const handleRoleSelectionChange = (employeeId: string, roleKey: string, memberId: string) => {
    setRoleSelections(prev => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        [roleKey]: memberId,
      }
    }));
  };

  const selectedProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId), [profiles, selectedProfileId]);
  const selectedConstitution = useMemo(() => constitutions.find(c => c.id === selectedProfile?.constitutionId), [constitutions, selectedProfile]);


  useEffect(() => {
    if (selectedEmployee && offerLetterTemplate && selectedProfile && selectedConstitution) {
      fillHtmlTemplate(offerLetterTemplate, selectedEmployee, selectedProfile, selectedConstitution, roleSelections[selectedEmployee.id] || {}).then(({ filledHtml }) => {
        setPreviewHtml(filledHtml);
      });
    }
  }, [roleSelections, selectedEmployee, offerLetterTemplate, selectedProfile, selectedConstitution]);

  const handlePreview = async (employee: Employee) => {
    if (!offerLetterTemplate) {
      toast({ title: "Error", description: "Offer letter template is not available.", variant: "destructive" });
      return;
    }
    if (!selectedProfile || !selectedConstitution) {
      toast({ title: "Error", description: "Please select a business profile first.", variant: "destructive" });
      return;
    }
    const saved = savedLetters[employee.id];
    if (saved?.html) {
      setPreviewHtml(saved.html);
    } else {
      const { filledHtml } = await fillHtmlTemplate(offerLetterTemplate, employee, selectedProfile, selectedConstitution, roleSelections[employee.id] || {});
      setPreviewHtml(filledHtml);
    }
    setSelectedEmployee(employee);
    setIsDirty(false);
  };

  const handleDownloadFromPreview = async () => {
    if (!selectedEmployee) return;
    const saved = savedLetters[selectedEmployee.id];
    if (!saved || isDirty) {
      toast({ title: "Save required", description: "Please save the offer letter before downloading.", variant: "destructive" });
      return;
    }
    const editedHtml = saved.html;
    setGeneratingFor(selectedEmployee.id);

    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    const contentDiv = document.createElement('div');
    contentDiv.id = 'pdf-content-for-download';
    contentDiv.style.position = 'absolute';
    contentDiv.style.left = '-9999px';
    contentDiv.style.width = '794px';
    contentDiv.innerHTML = `<div class="prose p-8">${editedHtml}</div>`;
    document.body.appendChild(contentDiv);

    try {
      const canvas = await html2canvas(contentDiv, { scale: 2, useCORS: true, logging: false });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Offer_Letter_${selectedEmployee.personalDetails.fullName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast({ title: "PDF Generation Failed", description: "Could not generate the offer letter.", variant: "destructive" });
    } finally {
      document.body.removeChild(contentDiv);
      setGeneratingFor(null);
    }
  };

  const handleSaveOfferLetter = async () => {
    if (!selectedEmployee || !offerLetterTemplate || !selectedProfileId) {
      toast({ title: "Error", description: "Missing context to save.", variant: "destructive" });
      return;
    }
    const editedHtml = editableContentRef.current?.innerHTML || '';
    if (!editedHtml.trim()) {
      toast({ title: "Error", description: "No content to save.", variant: "destructive" });
      return;
    }
    try {
      setSavingFor(selectedEmployee.id);
      const payload = {
        employee_id: selectedEmployee.id,
        profile_id: selectedProfileId,
        template_id: offerLetterTemplate.id,
        html: editedHtml,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('offer_letters')
        .upsert(payload, { onConflict: 'employee_id' });

      if (error) throw error;

      setIsDirty(false);
      setSavedLetters(prev => ({
        ...prev,
        [selectedEmployee.id]: {
          employeeId: selectedEmployee.id,
          profileId: selectedProfileId,
          templateId: offerLetterTemplate.id,
          html: editedHtml,
          createdAt: prev[selectedEmployee.id]?.createdAt || Date.now(),
          updatedAt: Date.now()
        }
      }));

      setCurrentTab('generated');
      toast({ title: "Saved", description: "Offer letter saved successfully." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingFor(null);
    }
  };

  const handleDownloadWord = async () => {
    if (!selectedEmployee) return;
    const saved = savedLetters[selectedEmployee.id];
    if (!saved || isDirty) {
      toast({ title: "Save required", description: "Please save the offer letter before downloading.", variant: "destructive" });
      return;
    }
    const [{ default: HtmlDocx }, { default: FileSaver }] = await Promise.all([
      import('html-docx-js/dist/html-docx.js'),
      import('file-saver'),
    ]);
    const content = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${saved.html}</body></html>`;
    const blob = HtmlDocx.asBlob(content);
    FileSaver.saveAs(blob, `Offer_Letter_${selectedEmployee.personalDetails.fullName.replace(/\s+/g, '_')}.docx`);
  };

  const handleResetLetter = async (employee: Employee) => {
    const typed = window.prompt('Type "reset" to confirm resetting this offer letter:');
    if (!typed || typed.toLowerCase().trim() !== 'reset') {
      toast({ title: "Cancelled", description: "Reset aborted." });
      return;
    }
    try {
      const { error } = await supabase
        .from('offer_letters')
        .delete()
        .eq('employee_id', employee.id);

      if (error) throw error;

      setSavedLetters(prev => {
        const next = { ...prev };
        delete next[employee.id];
        return next;
      });

      if (selectedEmployee?.id === employee.id) {
        setPreviewHtml(null);
        setSelectedEmployee(null);
      }
      setCurrentTab('to-generate');
      toast({ title: "Offer letter reset", description: "You can generate it again from the first tab." });
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
    }
  };

  const filteredEmployeesRaw = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return employees;

    return employees
      .filter(emp =>
        (emp.personalDetails.fullName || '').toLowerCase().includes(term) ||
        (emp.employmentDetails?.employeeId || '').toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const nameA = (a.personalDetails.fullName || '').toLowerCase();
        const nameB = (b.personalDetails.fullName || '').toLowerCase();
        const aStarts = nameA.startsWith(term);
        const bStarts = nameB.startsWith(term);

        // Prioritize exact start match (First name match assumption)
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return 0;
      });
  }, [employees, searchTerm]);

  const employeesToGenerate = useMemo(
    () => filteredEmployeesRaw.filter(e => !savedLetters[e.id]),
    [filteredEmployeesRaw, savedLetters]
  );
  const employeesGenerated = useMemo(
    () => filteredEmployeesRaw.filter(e => !!savedLetters[e.id]),
    [filteredEmployeesRaw, savedLetters]
  );
  const filteredEmployees = currentTab === 'to-generate' ? employeesToGenerate : employeesGenerated;

  const EmployeeDataView = ({ employee, template, profile, selections, onRoleSelectionChange, constitutions }: {
    employee: Employee,
    template: Template,
    profile: Profile | null,
    selections: Record<string, string>,
    onRoleSelectionChange: (roleKey: string, memberId: string) => void,
    constitutions: BusinessTypeSetup[]
  }) => {
    const constitution = useMemo(() => constitutions.find(c => c.id === profile?.constitutionId), [constitutions, profile]);

    if (!profile || !constitution) return null;

    const rolesWithManagementMembers = (profile.roles ? Object.entries(profile.roles) : [])
      .filter(([roleKey, roleData]) => {
        const constitutionRole = constitution?.roles?.find(r => r.roleKey === roleKey);
        // Show dropdown if it's a management role AND has >= 1 member
        return (constitutionRole?.isManagementRole ?? false) && (roleData?.members?.length || 0) >= 1;
      })
      .map(([roleKey, roleData]) => ({
        roleKey,
        roleName: constitution?.roles?.find(r => r.roleKey === roleKey)?.roleName || roleKey,
        members: roleData.members || [],
      }));

    return (
      <div className="p-4 bg-muted/50">
        <h4 className="font-semibold text-sm mb-2">Signatory Selection:</h4>
        {rolesWithManagementMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            {rolesWithManagementMembers.map(({ roleKey, roleName, members }) => {
              if (!roleKey) return null;
              const primaryMemberId = profile.primarySignatories?.[roleKey];
              return (
                <div key={roleKey}>
                  <Label className="text-xs font-semibold capitalize">{roleName}</Label>
                  <Select
                    value={selections[roleKey] || primaryMemberId || (members[0] as any)?._id}
                    onValueChange={(memberId) => onRoleSelectionChange(roleKey, memberId)}
                    disabled={members.length <= 1}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => (
                        <SelectItem key={m._id} value={m._id}>
                          {m.details?.name ?? m.details?.full_name ?? 'Unnamed Member'}
                          {m._id === primaryMemberId && ' (Primary)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        ) : <p className="text-xs text-muted-foreground">No configurable management roles for this profile.</p>}
      </div>
    );
  };

  const EditorToolbar = () => {
    const applyStyle = (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editableContentRef.current?.focus();
    };

    const fontSizes = ['1', '2', '3', '4', '5', '6', '7']; // Corresponds to <font size="...">
    const fontFamilies = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS'];

    return (
      <div className="p-2 border-b bg-muted/50 rounded-t-md flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => applyStyle('bold')} className="h-8 w-8 p-0"><Bold /></Button>
        <Button variant="outline" size="sm" onClick={() => applyStyle('italic')} className="h-8 w-8 p-0"><Italic /></Button>
        <Button variant="outline" size="sm" onClick={() => applyStyle('underline')} className="h-8 w-8 p-0"><Underline /></Button>
        <Select onValueChange={(value) => applyStyle('fontSize', value)}>
          <SelectTrigger className="w-20 h-8 text-xs"><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent>{fontSizes.map(s => <SelectItem key={s} value={s}>{`Size ${s}`}</SelectItem>)}</SelectContent>
        </Select>
        <Select onValueChange={(value) => applyStyle('fontName', value)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Font" /></SelectTrigger>
          <SelectContent>{fontFamilies.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => applyStyle('justifyLeft')} className="h-8 w-8 p-0"><AlignLeft /></Button>
        <Button variant="outline" size="sm" onClick={() => applyStyle('justifyCenter')} className="h-8 w-8 p-0"><AlignCenter /></Button>
        <Button variant="outline" size="sm" onClick={() => applyStyle('justifyRight')} className="h-8 w-8 p-0"><AlignRight /></Button>
        <Button variant="outline" size="sm" onClick={() => applyStyle('justifyFull')} className="h-8 w-8 p-0"><AlignJustify /></Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Offer Letters"
        description="Select a business profile and employee to generate personalized employment documents."
      >
        <Button variant="outline" size="sm" onClick={async () => { globalCache.invalidate('full_employees_list_offer_letter'); await refreshPageData(); }} className="h-9 px-3 font-bold border-muted-foreground/20">
            <RefreshCw className="h-4 w-4 mr-2" /> Reload Data
        </Button>
      </DashboardPageHeader>

      <DashboardFilterBar>
        <div className="flex-1 w-full flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex-grow max-w-sm">
            <Select value={selectedProfileId || ''} onValueChange={setSelectedProfileId} disabled={profilesLoading}>
              <SelectTrigger id="profile-select" className="w-full bg-background">
                <SelectValue placeholder={profilesLoading ? "Loading..." : "Select Profile"} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.profileName}{p.isDefault && ' (Default)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-grow max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input id="search-employee" placeholder="Search employee..." className="pl-10 bg-background border-muted-foreground/20" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="flex-grow max-w-sm ml-auto">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap font-bold text-xs uppercase tracking-widest text-slate-500">Pick Template:</Label>
              <Select value={offerLetterTemplate?.id || ''} onValueChange={(id) => setOfferLetterTemplate(availableTemplates.find(t => t.id === id) || null)}>
                <SelectTrigger className="w-full bg-background border-indigo-200">
                  <SelectValue placeholder="Select Template" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </DashboardFilterBar>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
          <div className="flex justify-between items-center">
            <div className="inline-flex p-1 bg-muted/50 rounded-lg">
              <Button
                size="sm"
                variant={currentTab === 'to-generate' ? 'default' : 'ghost'}
                onClick={() => setCurrentTab('to-generate')}
                className="rounded-md"
              >
                To Generate
              </Button>
              <Button
                size="sm"
                variant={currentTab === 'generated' ? 'default' : 'ghost'}
                onClick={() => setCurrentTab('generated')}
                className="rounded-md"
              >
                Generated Offer Letters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || constitutionsLoading ? (
            <div className="text-center py-10"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>
          ) : error ? (
            <div className="p-8">
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Template Configuration Required</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-4">
                  <p>{error}</p>
                  <Button 
                    variant="outline" 
                    className="w-fit bg-red-50 hover:bg-red-100 text-red-900 border-red-200"
                    onClick={() => window.location.href = '/dashboard/admin/templates'}
                  >
                    Go to Template Management <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">No employees found.</TableCell>
                    </TableRow>
                  ) : filteredEmployees.map(emp => (
                    <React.Fragment key={emp.id}>
                      <TableRow>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleRow(emp.id)} className="h-8 w-8">
                            {expandedRows[emp.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{emp.personalDetails.fullName}</TableCell>
                        <TableCell>{emp.employmentDetails.employeeId}</TableCell>
                        <TableCell>{emp.employmentDetails.employeeRole}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => handlePreview(emp)} disabled={generatingFor === emp.id || !offerLetterTemplate || !selectedProfileId}>
                              {generatingFor === emp.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4 mr-2" />
                              )}
                              {currentTab === 'generated' ? 'View' : 'Preview & Generate'}
                            </Button>
                            {currentTab === 'generated' && (
                              <Button size="sm" variant="destructive" onClick={() => handleResetLetter(emp)}>
                                Reset Offer Letter
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRows[emp.id] && offerLetterTemplate && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <EmployeeDataView
                              employee={emp}
                              template={offerLetterTemplate}
                              profile={selectedProfile || null}
                              selections={roleSelections[emp.id] || {}}
                              onRoleSelectionChange={(roleKey, memberId) => handleRoleSelectionChange(emp.id, roleKey, memberId)}
                              constitutions={constitutions}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewHtml} onOpenChange={(open) => { if (!open) setPreviewHtml(null); }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Offer Letter Preview for {selectedEmployee?.personalDetails.fullName}</DialogTitle>
            <DialogDescription>Review and edit the document below. Click download when you are ready.</DialogDescription>
          </DialogHeader>
          <EditorToolbar />
          <style>{PREVIEW_STYLES}</style>
          <div className="flex-grow border rounded-md bg-white p-4 overflow-auto">
            <div
              ref={editableContentRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              className="prose-container prose focus:outline-none focus:ring-2 focus:ring-primary p-12 rounded mx-auto shadow-sm"
              onInput={() => setIsDirty(true)}
              dangerouslySetInnerHTML={{ __html: previewHtml || '' }}
            />
          </div>
          <DialogFooter>
            <div className="mr-auto text-sm text-muted-foreground">
              {isDirty ? 'Unsaved changes' : savedLetters[selectedEmployee?.id || ''] ? 'Saved' : 'Not saved yet'}
            </div>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
            <Button onClick={handleSaveOfferLetter} disabled={!selectedEmployee || savingFor === selectedEmployee?.id}>
              {savingFor === selectedEmployee?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button onClick={handleDownloadWord} disabled={!selectedEmployee || isDirty || !savedLetters[selectedEmployee?.id || '']}>
              <Download className="mr-2 h-4" /> Download Word
            </Button>
            <Button onClick={handleDownloadFromPreview} disabled={!selectedEmployee || isDirty || !savedLetters[selectedEmployee?.id || '']}>
              {generatingFor === selectedEmployee?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4" />}
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

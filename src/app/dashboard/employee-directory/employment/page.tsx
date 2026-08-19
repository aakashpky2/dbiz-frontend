'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Briefcase, ChevronRight, UserCircle, CheckCircle2, AlertCircle } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { fetchWithCache } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/dashboard/page-hero";
import { DashboardFilterBar } from "@/components/dashboard/dashboard-filter-bar";
import { EmploymentDetailsForm } from "@/components/dashboard/employee-directory/form-sections/employment-details-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { employmentDetailsSchema } from "@/components/dashboard/employee-directory/form-sections/employment-details-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageSkeleton } from '@/components/ui/page-skeleton';

type EmployeeSummary = {
  id: string;
  personalDetails: {
    fullName: string;
    email: string;
    photo: string;
  };
  employmentDetails?: {
    employeeId: string;
    employeeRole: string;
    jobTitle?: string;
  };
};

export default function EmploymentManagementPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const methods = useForm({
    resolver: zodResolver(employmentDetailsSchema),
    defaultValues: {
      employeeId: '',

      employeeRole: '',
      jobTitle: '',
      employmentTermYears: 0,
      employmentTermMonths: 0,
      monthlySalary: 0,
      casualLeavesPerMonth: 1,
      sickLeavesPerMonth: 1,
      startTime: '09:30',
      endTime: '17:30',
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      relievingDate: undefined
    }
  });

  const { reset } = methods;

  const fetchEmployees = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchWithCache(`/api/employees?limit=1000`);
      setEmployees(result.data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employees.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.personalDetails.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employmentDetails?.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  const handleSelectEmployee = async (employee: EmployeeSummary) => {
    setSelectedEmployee(employee);
    // Fetch latest employment details for this specific employee
    try {
        const response = await fetch(`/api/employees/${employee.id}/employment`);
        const result = await response.json();
        if (result.success) {
            const data = result.data || {};
            reset({
                ...data,
                employeeId: data.employeeId || employee.employmentDetails?.employeeId || '',

                relievingDate: data.relievingDate ? new Date(data.relievingDate) : undefined,
            });
        }
    } catch (error) {
        toast({ title: "Fetch failed", description: "Could not load employment details.", variant: "destructive" });
    }
    setIsSheetOpen(true);
  };

  const onSaveEmployment = async (data: any) => {
    if (!selectedEmployee || isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/employees/${selectedEmployee.id}/employment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) {
        await fetchEmployees(); // Refresh list to show updated ID/role
        toast({ title: "Success", description: "Employment details updated successfully." });
        setIsSheetOpen(false);
      } else {
        throw new Error(result.error || "Save failed");
      }
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
                pattern="pattern-7"
        icon={Briefcase}
        badge="MANAGEMENT"
        title="Employment Management"
        description="Manage employment terms, salaries, and roles independently."
      >
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 py-1 px-3">
                <Briefcase className="w-3 h-3 mr-1.5" /> Standalone Module
            </Badge>
        </div>
      </PageHero>

      <DashboardFilterBar>
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or Employee ID..."
            className="pl-10 bg-background"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </DashboardFilterBar>

      {loading ? (<div className="p-6"><PageSkeleton /></div>) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee) => (
            <Card
              key={employee.id}
              className="group cursor-pointer hover:shadow-md transition-all duration-300 border-slate-200/60 overflow-hidden"
              onClick={() => handleSelectEmployee(employee)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                  <AvatarImage src={employee.personalDetails.photo} />
                  <AvatarFallback className="bg-sky-50 text-sky-600 font-bold">
                    {employee.personalDetails.fullName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {employee.personalDetails.fullName}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {employee.employmentDetails?.jobTitle || 'No Title Set'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px] uppercase tracking-wider h-4 px-1">
                      {employee.employmentDetails?.employeeRole || 'NO ROLE'}
                    </Badge>
                    {employee.employmentDetails?.employeeId && (
                        <span className="text-[10px] font-bold text-slate-400">#{employee.employmentDetails.employeeId}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredEmployees.length === 0 && !loading && (
        <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200/60 mt-6">
            <UserCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">No employees found.</p>
        </div>
      )}

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[95vh] h-full flex flex-col bg-slate-50 border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] rounded-[40px] p-0 overflow-hidden transition-all duration-500">
          {/* Header Section - Fixed */}
          <div className="p-8 pb-6 bg-white/80 backdrop-blur-md border-b border-slate-100/80 z-10 shrink-0">
            <DialogHeader className="mb-0">
              <DialogTitle className="flex items-center gap-4 text-2xl font-black text-slate-900 uppercase tracking-tight">
                  <div className="p-3 bg-primary/10 rounded-2xl shadow-inner shadow-primary/5">
                      <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  Update Employment
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-[10px] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Update the employment details for <span className="text-slate-900">{selectedEmployee?.personalDetails.fullName}</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Form Section - Scrollable */}
          <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
            <FormProvider {...methods}>
              <form id="employment-form" onSubmit={methods.handleSubmit(onSaveEmployment)} className="space-y-6">
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200/50 hover:border-slate-300/50 transition-colors">
                  <EmploymentDetailsForm isEditing={!!selectedEmployee?.employmentDetails?.employeeId} />
                </div>
              </form>
            </FormProvider>
          </div>

          {/* Action Footer - Fixed or Bottom-anchored */}
          <div className="p-8 bg-white/80 backdrop-blur-md border-t border-slate-100/80 shrink-0">
            <div className="flex gap-4 max-w-[600px] mx-auto">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px] border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                onClick={() => setIsSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                form="employment-form"
                className="flex-[2] rounded-2xl h-14 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-primary/30 transition-all active:scale-95 bg-primary text-white hover:brightness-110"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing Records...
                  </>
                ) : (
                  <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Commit Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

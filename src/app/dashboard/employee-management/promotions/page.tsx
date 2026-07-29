'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, TrendingUp, User, Search, Edit, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';

const PromotionsDialog = dynamic(() => import('./_components/PromotionsDialog').then(mod => mod.PromotionsDialog), { ssr: false });
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { startOfDay } from 'date-fns';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { globalCache } from '@/lib/cache-utils';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/ui/page-skeleton';

type Employee = {
  id: string;
  employeeId: string;
  fullName: string;
  currentRole: string;
  currentSalary: number;
};

const promotionFormSchema = z.object({
  newRole: z.string().min(1, "New role is required."),
  newSalary: z.coerce.number().min(0, "Salary must be a positive number."),
  effectiveDate: z.date({ required_error: "Effective date is required." }),
});

type PromotionFormValues = z.infer<typeof promotionFormSchema>;

export default function PromotionDetailsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [systemRoles, setSystemRoles] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30; // Increased for better view

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManageEmployees = hasPermission('MANAGE_EMPLOYEES');

  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
  });

  const refreshPageData = useCallback(async () => {
    try {
      setIsLoading(true);
      const CACHE_KEY = 'full_employees_list_promotions';
      let empSnapData = globalCache.get<any>(CACHE_KEY);
      let roleSnapData = globalCache.get<any>('system_roles_promotions');

      if (!empSnapData || !roleSnapData) {
        const [empSnap, roleSnap] = await Promise.all([
          supabase.from('employees').select('*, employee_employment_details(*)'),
          supabase.from('system_roles').select('*')
        ]);

        if (empSnap.error) throw empSnap.error;
        if (roleSnap.error) throw roleSnap.error;

        empSnapData = empSnap.data;
        roleSnapData = roleSnap.data;
        globalCache.set(CACHE_KEY, empSnapData, 5 * 60 * 1000);
        globalCache.set('system_roles_promotions', roleSnapData, 5 * 60 * 1000);
      }

      if (empSnapData) {
        const loadedEmployees: Employee[] = empSnapData.map((emp: any) => {
          const employment = Array.isArray(emp.employee_employment_details) ? emp.employee_employment_details[0] : emp.employee_employment_details;
          return {
            id: emp.id,
            employeeId: emp.employee_id_hash || 'N/A',
            fullName: emp.full_name,
            currentRole: employment?.employee_role || emp.employee_role || 'No Role',
            currentSalary: employment?.monthly_salary || emp.monthly_salary || 0,
          };
        });
        setEmployees(loadedEmployees);
      }

      if (roleSnapData) {
        setSystemRoles(roleSnapData.map((r: any) => ({ id: r.id, name: r.name })));
      }
    } catch (e) {
      console.error("Error fetching data:", e);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!permLoading && !canManageEmployees) {
      toast({ title: "Access Denied", description: "You do not have permission to manage promotions.", variant: "destructive" });
      router.push('/dashboard');
      return;
    }
    if (!canManageEmployees) return;

    refreshPageData();
  }, [permLoading, canManageEmployees, router, toast, refreshPageData]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp =>
      emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  // Reset to page 1 when searching
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleOpenDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    form.reset({
      newRole: employee.currentRole,
      newSalary: employee.currentSalary,
      effectiveDate: startOfDay(new Date()),
    });
    setIsDialogOpen(true);
  };

  const handleFormSubmit: SubmitHandler<PromotionFormValues> = async (data) => {
    if (!selectedEmployee) return;
    setIsSubmitting(true);

    try {
      // 1. Add to history
      const { error: histErr } = await supabase.from('employee_history').insert([{
        employee_db_id: selectedEmployee.id,
        employee_id: selectedEmployee.employeeId,
        employee_name: selectedEmployee.fullName,
        salary: data.newSalary,
        role: data.newRole,
        effective_date: format(data.effectiveDate, 'yyyy-MM-dd'),
      }]);

      if (histErr) throw histErr;

      // 2. Update employee and their employment details
      const { error: empErr } = await supabase
        .from('employees')
        .update({
          employee_role: data.newRole,
          monthly_salary: data.newSalary,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEmployee.id);

      if (empErr) throw empErr;

      await supabase
        .from('employee_employment_details')
        .update({
          employee_role: data.newRole,
          monthly_salary: data.newSalary
        })
        .eq('employee_id', selectedEmployee.id);

      toast({
        title: "Promotion Applied",
        description: `${selectedEmployee.fullName} has been updated.`,
      });

      setIsDialogOpen(false);
      setSelectedEmployee(null);
      globalCache.invalidate('full_employees_list_promotions');
      await refreshPageData();

    } catch (error: any) {
      console.error("Error applying promotion:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (permLoading) return <div className="p-6"><PageSkeleton /></div>;
  if (!canManageEmployees) return null;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Promotions & Salary"
        description="Update an employee's role and salary with an effective date."
      >
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={async () => { globalCache.invalidate('full_employees_list_promotions'); await refreshPageData(); }} className="h-9 px-3 font-bold border-muted-foreground/20">
                <RefreshCw className="h-4 w-4 mr-2" /> Reload List
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search system..." className="pl-9 h-9 w-[250px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
      </DashboardPageHeader>

      <Card className="shadow-sm border">
        <CardHeader className="py-4 border-b border-border/50 bg-muted/5">
            <CardTitle className="text-lg font-bold">Revision Register</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="p-6"><PageSkeleton /></div> : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">S.No</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Current Salary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((emp, index) => (
                    <TableRow key={emp.id}>
                      <TableCell className="text-muted-foreground font-medium">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{emp.fullName}</TableCell>
                      <TableCell>{emp.employeeId}</TableCell>
                      <TableCell>{emp.currentRole}</TableCell>
                      <TableCell>₹{emp.currentSalary?.toLocaleString() || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleOpenDialog(emp)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Update Role/Salary
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredEmployees.length)}</span> of <span className="font-medium">{filteredEmployees.length}</span> employees
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="w-9"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isDialogOpen && (
        <PromotionsDialog
          isDialogOpen={isDialogOpen}
          setIsDialogOpen={setIsDialogOpen}
          selectedEmployee={selectedEmployee}
          form={form}
          handleFormSubmit={handleFormSubmit}
          isSubmitting={isSubmitting}
          systemRoles={systemRoles}
        />
      )}
    </div>
  );
}

'use client';

import { PageHero } from '@/components/dashboard/page-hero';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AddEmployeeForm } from "@/components/dashboard/employee-directory/add-employee-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export default function AddEmployeePage() {
  const router = useRouter();
  const [headerPhotoPreview, setHeaderPhotoPreview] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState('');

  const handlePhotoChangeForHeader = useCallback((previewUrl: string | null) => {
    setHeaderPhotoPreview(previewUrl);
  }, []);
  
  const handleNameChange = useCallback((name: string) => {
    setEmployeeName(name);
  }, []);

  const { toast } = useToast();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManageEmployees = hasPermission('MANAGE_EMPLOYEES');

  useEffect(() => {
    if (!permLoading && !canManageEmployees) {
      toast({ title: "Access Denied", description: "You do not have permission to add employees.", variant: "destructive" });
      router.push('/dashboard');
    }
  }, [permLoading, canManageEmployees, router, toast]);

  if (permLoading || !canManageEmployees) return null;

  return (
    <div className="space-y-6 p-2">
      <PageHero
                pattern="pattern-1"
        compact
        icon={UserPlus}
        badge="DIRECTORY"
        title={employeeName || 'Add New Employee'}
        description="Fill in the details below to add a new employee to the system. Complete all sections to ensure data integrity."
      >
        <Button 
          variant="outline" size="sm" onClick={() => router.back()}
          className="rounded-xl shadow-sm hover:bg-slate-50 transition-all duration-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span>Back to Directory</span>
        </Button>
      </PageHero>

      <Card className="shadow-lg border">
        <CardContent className="pt-6">
          <AddEmployeeForm onPhotoChange={handlePhotoChangeForHeader} onNameChange={handleNameChange} />
        </CardContent>
      </Card>
    </div>
  );
}

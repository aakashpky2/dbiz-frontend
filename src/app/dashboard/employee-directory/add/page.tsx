'use client';

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
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="group flex items-center gap-3 px-0 hover:bg-transparent text-muted-foreground hover:text-primary transition-all duration-300"
        >
          <div className="p-2 rounded-xl bg-background border shadow-sm group-hover:shadow-md transition-all">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span className="font-bold text-xs uppercase tracking-[0.2em]">Back to Directory</span>
        </Button>
      </div>

      <Card className="shadow-lg border">
        <CardHeader>
          <div className="flex items-center gap-4 mb-2">
            {headerPhotoPreview ? (
              <Avatar className="h-16 w-16">
                <AvatarImage src={headerPhotoPreview} alt="Employee Photo" />
                <AvatarFallback>{employeeName ? employeeName.split(' ').map(n => n[0]).join('') : <UserPlus className="h-8 w-8" />}</AvatarFallback>
              </Avatar>
            ) : (
              <UserPlus className="h-8 w-8 text-primary" />
            )}
            <div>
              <CardTitle className="text-2xl flex items-center">
                {employeeName || 'Add New Employee'}
              </CardTitle>
              <CardDescription>
                Fill in the details below to add a new employee to the system.
                Complete all sections to ensure data integrity.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AddEmployeeForm onPhotoChange={handlePhotoChangeForHeader} onNameChange={handleNameChange} />
        </CardContent>
      </Card>
    </div>
  );
}

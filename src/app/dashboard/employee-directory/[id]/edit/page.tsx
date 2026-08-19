
'use client';
import { PageHero } from '@/components/dashboard/page-hero';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AddEmployeeForm } from "@/components/dashboard/employee-directory/add-employee-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Loader2, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PageSkeleton } from '@/components/ui/page-skeleton';

export default function EditEmployeePage() {
  const [headerPhotoPreview, setHeaderPhotoPreview] = useState<string | null>(null);
  const [employee, setEmployee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeName, setEmployeeName] = useState('');
  const params = useParams();
  const employeeId = params.id as string;

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    };
    fetch(`/api/employees/${employeeId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch employee');
        return res.json();
      })
      .then(response => {
        if (!response.success || !response.data) throw new Error('Failed to fetch employee');
        const employeeData = response.data;
        setEmployee(employeeData);
        setHeaderPhotoPreview(employeeData.personalDetails?.photo || null);
        setEmployeeName(employeeData.personalDetails?.fullName || '');
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch employee:", err);
        setLoading(false);
      });
  }, [employeeId]);


  const handlePhotoChangeForHeader = useCallback((previewUrl: string | null) => {
    setHeaderPhotoPreview(previewUrl);
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setEmployeeName(name);
  }, []);

  return (
    <div className="space-y-6">
      <PageHero
                pattern="pattern-6"
        compact
        icon={UserPlus}
        badge="DIRECTORY"
        title={`Edit ${employeeName}`}
        description="Update the details for the employee below."
      >
        <Button variant="outline" size="sm" asChild className="rounded-xl shadow-sm hover:bg-slate-50 transition-all duration-300">
          <Link href={`/dashboard/employee-directory/${employeeId}`} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to View</span>
          </Link>
        </Button>
      </PageHero>
      <Card className="shadow-lg">
        <CardContent className="pt-6">
          {loading ? (<div className="p-6"><PageSkeleton /></div>) : employee ? (
            <AddEmployeeForm onPhotoChange={handlePhotoChangeForHeader} existingEmployee={employee} onNameChange={handleNameChange} />
          ) : (
            <div>Employee not found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

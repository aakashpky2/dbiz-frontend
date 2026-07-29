'use client';

import React from 'react';
import { Button } from "@/components/ui/button";

import { PermissionsTab } from '@/components/dashboard/admin/PermissionsTab';
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function PermissionsPage() {
    const { hasPermission, loading } = usePermissions();
    const router = useRouter();
    const { toast } = useToast();
    const canManagePermissions = hasPermission('MANAGE_PERMISSIONS');

    React.useEffect(() => {
        if (!loading && !canManagePermissions) {
            toast({ title: "Access Denied", description: "You do not have permission to manage system permissions.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [loading, canManagePermissions, router, toast]);

    if (loading || !canManagePermissions) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Verifying permissions...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/admin"><ArrowLeft className="h-5 w-5" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Permissions</h1>
                    <p className="text-muted-foreground text-sm">Configure system-wide module permissions and automated workflows.</p>
                </div>
            </div>

            <div className="bg-white border rounded-2xl p-8 shadow-sm">
                <PermissionsTab />
            </div>
        </div>
    );
}

'use client';

import React from 'react';
import { Button } from "@/components/ui/button";

import { PermissionsTab } from '@/components/dashboard/admin/PermissionsTab';
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield } from 'lucide-react';
import { PageHero } from '@/components/dashboard/page-hero';

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
            <PageHero
                pattern="pattern-3"
                icon={Shield}
                badge="SECURITY"
                title={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6 -ml-2 text-muted-foreground hover:text-foreground" asChild>
                            <Link href="/dashboard/admin"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        System Permissions
                    </div>
                }
                description="Configure system-wide module permissions and automated workflows."
            />

            <div className="bg-white border rounded-2xl p-8 shadow-sm">
                <PermissionsTab />
            </div>
        </div>
    );
}

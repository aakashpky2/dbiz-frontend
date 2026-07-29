'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PermissionGuardProps {
    children: React.ReactNode;
    requiredPermission?: string; // ID of the permission
    requiredRole?: string; // Name of the role
}

export default function PermissionGuard({
    children,
    requiredPermission,
    requiredRole,
}: PermissionGuardProps) {
    const { loading, hasPermission, hasRole, isSuperAdmin } = usePermissions();

    if (loading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
        );
    }

    // Super Admin bypass
    if (isSuperAdmin) {
        return <>{children}</>;
    }

    let hasAccess = true;

    if (requiredPermission && !hasPermission(requiredPermission)) {
        hasAccess = false;
    }

    if (requiredRole && !hasRole(requiredRole)) {
        hasAccess = false;
    }

    if (!hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 bg-muted/20 rounded-lg border-2 border-dashed border-muted">
                <div className="bg-red-50 p-4 rounded-full mb-4 dark:bg-red-900/20">
                    <ShieldAlert className="h-12 w-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                    You do not have the necessary permissions ({requiredPermission || requiredRole}) to view this page.
                    Please contact your administrator if you believe this is an error.
                </p>
                <Button asChild variant="default">
                    <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
            </div>
        );
    }

    return <>{children}</>;
}

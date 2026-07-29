'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Scale, FileText, AlertTriangle } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function ComplianceRulesPage() {
    const { hasPermission, loading: permLoading } = usePermissions();
    const router = useRouter();
    const { toast } = useToast();

    React.useEffect(() => {
        if (!permLoading && !hasPermission('MANAGE_COMPLIANCE_RULES')) {
            toast({ title: 'Access Denied', description: 'You do not have permission to access this page.', variant: 'destructive' });
            router.push('/dashboard');
        }
    }, [permLoading, hasPermission, router, toast]);

    if (permLoading || !hasPermission('MANAGE_COMPLIANCE_RULES')) return null;

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                    <Scale className="h-8 w-8" /> Compliance Rule Engine
                </h1>
                <p className="text-muted-foreground">
                    Manage due dates, fees, and government circulars.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link href="/dashboard/admin/compliance-rules/standard" className="block h-full">
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer border-l-4 border-l-blue-500 h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-500" />
                                Standard Rules
                            </CardTitle>
                            <CardDescription>
                                Configure effective fees and due dates for ITR, GST, MCA.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground">
                                Manage <strong>DueDateRules</strong> and <strong>FeeRules</strong>.
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Card className="hover:border-primary/50 transition-colors cursor-pointer border-l-4 border-l-amber-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Exceptions & Circulars
                        </CardTitle>
                        <CardDescription>
                            Add one-time extensions or flood relief notifications.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            Manage <strong>RuleExceptions</strong>.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

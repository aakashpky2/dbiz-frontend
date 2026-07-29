'use client';

import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Clock, Link as LinkIcon } from "lucide-react";
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function WorkflowPage() {
    const { hasPermission, loading: permLoading } = usePermissions();
    const router = useRouter();
    const { toast } = useToast();
    const canManageWorkflow = hasPermission('MANAGE_WORKFLOW');

    useEffect(() => {
        if (!permLoading && !canManageWorkflow) {
            toast({ title: "Access Denied", description: "You do not have permission to manage workflows.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canManageWorkflow, router, toast]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Workflow Management</h2>
                <p className="text-muted-foreground">
                    Manage work schedules and client-specific workflows.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Clock className="h-8 w-8 text-blue-600"/>
                            </div>
                            <div>
                                <CardTitle className="text-xl text-blue-900">Work Based Flow</CardTitle>
                                <CardDescription>Define reusable schedules and checklists for different work types.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Configure standard timelines, frequencies, and step-by-step checklists for various types of work (e.g., Monthly GST Filing, Annual Compliance). Changes here affect global templates.
                        </p>
                        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                            <Link href="/dashboard/admin/work-schedules">
                                Manage Work Schedules <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 rounded-lg">
                                <LinkIcon className="h-8 w-8 text-indigo-600" />
                            </div>
                            <div>
                                <CardTitle className="text-xl text-indigo-900">Client Based Flow</CardTitle>
                                <CardDescription>Create and manage custom workflows for specific clients.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Assign specific work types to individual clients and customize their schedules. This allows for client-specific overrides and tracking unique requirements.
                        </p>
                        <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700">
                            <Link href="/dashboard/work/schedules">
                                Manage Client Workflows <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

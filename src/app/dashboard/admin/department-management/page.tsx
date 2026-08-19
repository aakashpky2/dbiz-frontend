'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, Plus, ShieldCheck, ListFilter, AlertCircle, TrendingUp, Trash2 } from 'lucide-react';
import { DepartmentList } from '@/components/dashboard/admin/department-management/department-list';
import { AddDepartmentDialog } from '@/components/dashboard/admin/department-management/add-department-dialog';
import { Department, listenToDepartments } from '@/lib/department-management';
import { TimeLimitConfig } from '@/components/dashboard/admin/department-management/time-limit-config';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { ViewHistoryDialog } from '@/components/dashboard/admin/department-management/view-history-dialog';
import { PageHero } from '@/components/dashboard/page-hero';
import { sortDepartmentHierarchy } from '@/lib/sorting';

export default function DepartmentManagementPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [activeTab, setActiveTab] = useState('active');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const permissions = {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canValidate: true
    };

    useEffect(() => {
        const unsubscribe = listenToDepartments((data) => {
            const fullySorted = sortDepartmentHierarchy(data);


            setDepartments(fullySorted);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Helper: Compute tree stats based on explicit flags
    let activeDeptCount = 0;
    let totalCategories = 0;
    let pendingCount = 0;
    let incompleteCount = 0;
    let deletedCount = 0;

    departments.forEach(d => {
        if (!d.isDeleted) activeDeptCount++;
        if (!d.isValidated) pendingCount++;
        if (d.isIncomplete && !d.isDeleted) incompleteCount++;
        if (d.isDeleted && d.isValidated) deletedCount++;

        d.workCategories?.forEach(c => {
            if (!c.isDeleted) totalCategories++;
            if (!c.isValidated) pendingCount++;
            if (c.isIncomplete && !c.isDeleted) incompleteCount++;
            if (c.isDeleted && c.isValidated) deletedCount++;

            c.workTypes?.forEach(wt => {
                if (!wt.isValidated) pendingCount++;
                if (wt.isIncomplete && !wt.isDeleted) incompleteCount++;
                if (wt.isDeleted && wt.isValidated) deletedCount++;
            });
        });
    });

    const showIncompleteTab = incompleteCount > 0;
    const showValidationTab = pendingCount > 0;
    const showDeletedTab = deletedCount > 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-700 p-4">
            {/* Header Section */}
            {activeTab !== 'timelimits' && (
                <PageHero
                    pattern="pattern-2"
                    icon={Building2}
                    badge="DEPARTMENT CONFIGURATION"
                    title="Department Setup"
                    description="Manage departments, work categories, work types, and approvals."
                >
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            className="h-11 rounded-xl px-5 font-semibold border-border/70 shadow-sm hover:-translate-y-px transition-transform duration-200" 
                            onClick={() => setIsHistoryOpen(true)}
                        >
                            <History className="mr-2 h-4 w-4" />
                            History
                        </Button>
                        <Button 
                            className="h-11 rounded-xl px-5 font-semibold shadow-sm hover:-translate-y-px transition-transform duration-200"
                            onClick={() => setIsAddDialogOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Department
                        </Button>
                    </div>
                </PageHero>
            )}

            {/* Quick Stats Overview */}
            {activeTab !== 'timelimits' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="rounded-xl border border-border/70 bg-card shadow-sm hover:-translate-y-[1px] hover:shadow-md transition-all duration-200 ease-out group animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">Active Departments</span>
                        </div>
                        <div className="text-lg font-bold tracking-tight px-1">{activeDeptCount}</div>
                    </Card>
                    <Card className="rounded-xl border border-border/70 bg-card shadow-sm hover:-translate-y-[1px] hover:shadow-md transition-all duration-200 ease-out group animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both delay-75 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                                <ListFilter className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">Active Categories</span>
                        </div>
                        <div className="text-lg font-bold tracking-tight px-1">{totalCategories}</div>
                    </Card>
                    <Card className={`rounded-xl border border-border/70 bg-card shadow-sm hover:-translate-y-[1px] hover:shadow-md transition-all duration-200 ease-out group animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both delay-150 p-3 flex items-center justify-between ${pendingCount > 0 ? 'border-amber-200/60 dark:border-amber-900/50' : ''}`}>
                        <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200 ${pendingCount > 0 ? 'bg-amber-500/10 dark:bg-amber-500/20' : 'bg-muted/50'}`}>
                                <ShieldCheck className={`h-3.5 w-3.5 ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">Pending Validations</span>
                        </div>
                        <div className={`text-lg font-bold tracking-tight px-1 ${pendingCount > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{pendingCount}</div>
                    </Card>
                    <Card className={`rounded-xl border border-border/70 bg-card shadow-sm hover:-translate-y-[1px] hover:shadow-md transition-all duration-200 ease-out group animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both delay-200 p-3 flex items-center justify-between ${incompleteCount > 0 ? 'border-red-200/60 dark:border-red-900/50' : ''}`}>
                        <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200 ${incompleteCount > 0 ? 'bg-red-500/10 dark:bg-red-500/20' : 'bg-muted/50'}`}>
                                <AlertCircle className={`h-3.5 w-3.5 ${incompleteCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">Incomplete Items</span>
                        </div>
                        <div className={`text-lg font-bold tracking-tight px-1 ${incompleteCount > 0 ? 'text-red-700 dark:text-red-400' : ''}`}>{incompleteCount}</div>
                    </Card>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/20 border border-border/60 p-1 rounded-xl w-full sm:w-auto inline-flex h-auto overflow-x-auto">
                    <TabsTrigger value="active" className="flex items-center gap-2 px-5 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:bg-muted/30 transition-all">
                        <ListFilter className="h-4 w-4" />
                        <span className="font-semibold">Active Overview</span>
                    </TabsTrigger>

                    {showIncompleteTab && (
                        <TabsTrigger value="incomplete" className="flex items-center gap-2 px-5 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:bg-muted/30 transition-all">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="font-semibold">Incomplete Items</span>
                            <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                {incompleteCount}
                            </Badge>
                        </TabsTrigger>
                    )}

                    {showValidationTab && (
                        <TabsTrigger value="validation" className="flex items-center gap-2 px-5 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:bg-muted/30 transition-all">
                            <ShieldCheck className="h-4 w-4 text-amber-500" />
                            <span className="font-semibold">Pending Validations</span>
                            <Badge variant="destructive" className="ml-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full text-[10px]">
                                {pendingCount}
                            </Badge>
                        </TabsTrigger>
                    )}

                    {showDeletedTab && (
                        <TabsTrigger value="deleted" className="flex items-center gap-2 px-5 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:bg-muted/30 transition-all">
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="font-semibold">Deleted</span>
                            <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                {deletedCount}
                            </Badge>
                        </TabsTrigger>
                    )}

                    <TabsTrigger value="timelimits" className="flex items-center gap-2 px-5 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:bg-muted/30 transition-all">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Time Limits</span>
                    </TabsTrigger>
                </TabsList>

                {isLoading ? (
                    <div className="py-24 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground text-lg">Loading structure...</p>
                    </div>
                ) : (
                    <>
                        <TabsContent value="active" className="space-y-6 focus-visible:outline-none">
                            <DepartmentList
                                departments={departments}
                                canEdit={permissions.canEdit}
                                canDelete={permissions.canDelete}
                                canCreate={permissions.canCreate}
                                onAddClick={() => setIsAddDialogOpen(true)}
                                filterMode="active"
                            />
                        </TabsContent>

                        {showIncompleteTab && (
                        <TabsContent value="incomplete" className="space-y-6 focus-visible:outline-none">
                            <div className="bg-yellow-50/50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-xl flex items-start gap-4 mb-2 shadow-sm">
                                <AlertCircle className="h-5 w-5 mt-0.5 text-yellow-600 shrink-0" />
                                <p className="text-sm leading-relaxed">
                                    The following items are missing critical information such as descriptions or constitution rules.
                                </p>
                            </div>
                            <DepartmentList
                                departments={departments}
                                canEdit={permissions.canEdit}
                                canDelete={permissions.canDelete}
                                canCreate={permissions.canCreate}
                                onAddClick={() => setIsAddDialogOpen(true)}
                                filterMode="incomplete"
                            />
                        </TabsContent>
                        )}

                        {showValidationTab && (
                        <TabsContent value="validation" className="space-y-6 focus-visible:outline-none">
                            <div className="bg-amber-50/50 border border-amber-200 text-amber-800 px-6 py-4 rounded-xl flex items-start gap-4 mb-2 shadow-sm">
                                <ShieldCheck className="h-5 w-5 mt-0.5 text-amber-600 shrink-0" />
                                <p className="text-sm leading-relaxed">
                                    These items need to be checked and approved by a manager. You can review and approve them here.
                                </p>
                            </div>
                            <DepartmentList
                                departments={departments}
                                canEdit={permissions.canEdit}
                                canDelete={permissions.canDelete}
                                canCreate={permissions.canCreate}
                                onAddClick={() => setIsAddDialogOpen(true)}
                                filterMode="validation"
                            />
                        </TabsContent>
                        )}

                        {showDeletedTab && (
                        <TabsContent value="deleted" className="space-y-6 focus-visible:outline-none">
                            <div className="bg-red-50/50 border border-red-200 text-red-800 px-6 py-4 rounded-xl flex items-start gap-4 mb-2 shadow-sm">
                                <Trash2 className="h-5 w-5 mt-0.5 text-red-600 shrink-0" />
                                <p className="text-sm leading-relaxed">
                                    These items have been soft-deleted and validated. You can permanently delete them from here.
                                </p>
                            </div>
                            <DepartmentList
                                departments={departments}
                                canEdit={permissions.canEdit}
                                canDelete={permissions.canDelete}
                                canCreate={permissions.canCreate}
                                onAddClick={() => setIsAddDialogOpen(true)}
                                filterMode="deleted"
                            />
                        </TabsContent>
                        )}

                        <TabsContent value="timelimits" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2">
                            <TimeLimitConfig departments={departments} />
                        </TabsContent>
                    </>
                )}
            </Tabs>

            <AddDepartmentDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
            />

            <ViewHistoryDialog
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
            />
        </div>
    );
}

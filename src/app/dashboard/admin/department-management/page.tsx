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
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
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
                <DashboardPageHeader 
                    title="Department Setup"
                    description="Manage your departments, work categories, and approve changes."
                >
                    <Button 
                        variant="outline" 
                        className="font-bold border-slate-200 shadow-sm" 
                        onClick={() => setIsHistoryOpen(true)}
                    >
                        <History className="mr-2 h-4 w-4" />
                        History
                    </Button>
                    <Button 
                        onClick={() => setIsAddDialogOpen(true)}
                        className="font-bold shadow-sm"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Department
                    </Button>
                </DashboardPageHeader>
            )}

            {/* Quick Stats Overview */}
            {activeTab !== 'timelimits' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-card/50 backdrop-blur-sm border-muted/50 shadow-sm transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Departments</CardTitle>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{activeDeptCount}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-sm border-muted/50 shadow-sm transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Work Categories</CardTitle>
                            <ListFilter className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalCategories}</div>
                        </CardContent>
                    </Card>
                    <Card className={`bg-card/50 backdrop-blur-sm border-muted/50 shadow-sm transition-all ${pendingCount > 0 ? 'border-amber-200 bg-amber-50/30' : ''}`}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Validations</CardTitle>
                            <ShieldCheck className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-700' : ''}`}>{pendingCount}</div>
                        </CardContent>
                    </Card>
                    <Card className={`bg-card/50 backdrop-blur-sm border-muted/50 shadow-sm transition-all ${incompleteCount > 0 ? 'border-yellow-200 bg-yellow-50/30' : ''}`}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Incomplete Items</CardTitle>
                            <AlertCircle className={`h-4 w-4 ${incompleteCount > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${incompleteCount > 0 ? 'text-yellow-700' : ''}`}>{incompleteCount}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/30 p-1 rounded-xl w-full md:w-auto inline-flex h-auto">
                    <TabsTrigger value="active" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
                        <ListFilter className="h-4 w-4" />
                        <span className="font-medium">Active (Overview)</span>
                    </TabsTrigger>

                    {showIncompleteTab && (
                        <TabsTrigger value="incomplete" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium">Incomplete Items</span>
                            <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full text-[10px] bg-yellow-100 text-yellow-700">
                                {incompleteCount}
                            </Badge>
                        </TabsTrigger>
                    )}

                    {showValidationTab && (
                        <TabsTrigger value="validation" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
                            <ShieldCheck className="h-4 w-4 text-brand-blue" />
                            <span className="font-medium">Waiting for Approval</span>
                            <Badge variant="destructive" className="ml-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full text-[10px]">
                                {pendingCount}
                            </Badge>
                        </TabsTrigger>
                    )}

                    {showDeletedTab && (
                        <TabsTrigger value="deleted" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="font-medium">Deleted</span>
                            <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full text-[10px] bg-red-100 text-red-700">
                                {deletedCount}
                            </Badge>
                        </TabsTrigger>
                    )}

                    <TabsTrigger value="timelimits" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="font-medium">Time Limits</span>
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

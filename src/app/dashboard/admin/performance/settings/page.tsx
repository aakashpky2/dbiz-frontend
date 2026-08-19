'use client';

import React from 'react';
import { PageHero } from '@/components/dashboard/page-hero';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TemplatesTab } from '@/components/dashboard/admin/performance/settings-tabs/templates-tab';
import { GradeRulesTab } from '@/components/dashboard/admin/performance/settings-tabs/grade-rules-tab';
import { AutoCalcTab } from '@/components/dashboard/admin/performance/settings-tabs/auto-calc-tab';
import { GeneralSettingsTab } from '@/components/dashboard/admin/performance/settings-tabs/general-settings-tab';
import { PerformanceNav } from '@/components/dashboard/admin/performance/performance-nav';

export default function PerformanceSettingsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-700 p-4">
            <PageHero
                pattern="pattern-5" 
                icon={Settings}
                badge="PERFORMANCE"
                title="Performance Settings"
                description="Master configuration module for the Performance Management System."
            />

            <PerformanceNav />

            <Tabs defaultValue="templates" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-6">
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="grade_rules">Grade Rules</TabsTrigger>
                    <TabsTrigger value="auto_calc">Auto Calculation</TabsTrigger>
                    <TabsTrigger value="general">General Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="templates">
                    <TemplatesTab />
                </TabsContent>
                <TabsContent value="grade_rules">
                    <GradeRulesTab />
                </TabsContent>
                <TabsContent value="auto_calc">
                    <AutoCalcTab />
                </TabsContent>
                <TabsContent value="general">
                    <GeneralSettingsTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}

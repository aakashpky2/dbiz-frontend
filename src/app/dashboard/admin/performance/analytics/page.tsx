'use client';

import React from 'react';
import { PageHero } from '@/components/dashboard/page-hero';
import { BarChart } from 'lucide-react';
import { PerformanceNav } from '@/components/dashboard/admin/performance/performance-nav';
import { Card, CardContent } from '@/components/ui/card';

export default function PerformanceAnalyticsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-700 p-4">
            <PageHero
                pattern="pattern-7" 
                icon={BarChart}
                badge="ANALYTICS"
                title="Performance Analytics"
                description="View insights, trends, and reports on company-wide performance."
            />

            <PerformanceNav />

            <Card className="shadow-sm">
                <CardContent className="py-12 text-center text-muted-foreground">
                    <p className="mb-2 text-lg">Analytics Dashboard</p>
                    <p className="text-sm">Charts and performance trends will be displayed here.</p>
                </CardContent>
            </Card>
        </div>
    );
}

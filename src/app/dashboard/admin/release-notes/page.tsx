'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket, ShieldCheck, Zap, LayoutTemplate } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ReleaseNotesPage() {
    return (
        <div className="max-w-4xl mx-auto py-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Release Notes</h1>
                <p className="text-slate-500 mt-2">Latest updates, improvements, and fixes to the platform.</p>
            </div>

            <Card className="border-indigo-100 shadow-lg shadow-indigo-100/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <Rocket className="h-6 w-6 text-indigo-600" />
                                Version 1.0 (Enterprise Release)
                            </CardTitle>
                            <CardDescription className="mt-1">May 2026</CardDescription>
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-sm py-1">Current Version</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <LayoutTemplate className="h-4 w-4 text-emerald-600" />
                            Completed Modules
                        </h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-6">
                            <li>Comprehensive Employee Directory & Profiles</li>
                            <li>Client Management System</li>
                            <li>Task Management & Workflow Execution</li>
                            <li>Rate Card Administration</li>
                            <li>Proposals & Quoting Engine</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-blue-600" />
                            Security Improvements
                        </h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-6">
                            <li>Removal of raw UUID exposures across frontend views</li>
                            <li>Sanitized error messages (no technical stack traces in UI)</li>
                            <li>Enhanced Role-Based Access Control and Permission Guards</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-600" />
                            UI/UX Enhancements
                        </h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-6">
                            <li>Implemented Global Command Search (Ctrl+K)</li>
                            <li>Added Smart Dashboard Insights and Recent Activity Feed</li>
                            <li>Unified Status Badge designs and Empty States</li>
                            <li>Added Skeleton Loaders for smoother transitions</li>
                            <li>Print-friendly layouts for profiles and reports</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from 'recharts';

import React from 'react';

class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-[260px] w-full flex items-center justify-center border border-destructive/20 rounded-xl bg-destructive/5 text-destructive text-sm font-medium">
                    Failed to render chart
                </div>
            );
        }
        return this.props.children;
    }
}

function EmptyState() {
    return (
        <div className="h-[260px] w-full flex items-center justify-center border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-muted-foreground font-medium">No data available yet</p>
        </div>
    );
}

export function ProposalStatusChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function WorkStatusChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function RevenueTrendChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function AttendanceSummaryChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function DSCExpiryChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function TaskStatusChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color || '#ec4899'} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function RecruitmentPipelineChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical">
                        <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={100} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function LateArrivalTrendChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <ChartErrorBoundary>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </ChartErrorBoundary>
    );
}

export function WorkProgressChart({ data }: { data?: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;
    return (
        <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                    <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

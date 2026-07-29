"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart as any), { ssr: false }) as any;
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar as any), { ssr: false }) as any;
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer as any), { ssr: false }) as any;
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis as any), { ssr: false }) as any;
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis as any), { ssr: false }) as any;
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip as any), { ssr: false }) as any;
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell as any), { ssr: false }) as any;
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart as any), { ssr: false }) as any;
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie as any), { ssr: false }) as any;
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend as any), { ssr: false }) as any;

interface DashboardChartsProps {
    charts: {
        weeklyOutput: { day: string; value: number }[];
        attendanceBreakdown: { name: string; value: number; color?: string }[];
    };
}

export function DashboardCharts({ charts }: DashboardChartsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 shadow-sm border-none bg-card/60 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Weekly Output</CardTitle>
                    <CardDescription>Task completion overview for the current week.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    {charts.weeklyOutput?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={charts.weeklyOutput}>
                                <XAxis
                                    dataKey="day"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value: any) => `${value}`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary/80" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[350px] flex items-center justify-center border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                            <p className="text-muted-foreground font-medium">No data available for this period</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card className="col-span-3 shadow-sm border-none bg-card/60 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Attendance Breakdown</CardTitle>
                    <CardDescription>Daily attendance status distribution.</CardDescription>
                </CardHeader>
                <CardContent>
                    {charts.attendanceBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                                <Pie
                                    data={charts.attendanceBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {charts.attendanceBreakdown.map((entry, index) => {
                                        // Dynamic colors based on name if color is missing
                                        const getColor = (name: string) => {
                                            if (name === 'Present') return '#22c55e';
                                            if (name === 'Absent') return '#ef4444';
                                            if (name === 'Half Day') return '#eab308';
                                            if (name === 'Incomplete' || name === 'Active') return '#3b82f6';
                                            return '#cbd5e1';
                                        };
                                        return <Cell key={`cell-${index}`} fill={entry.color || getColor(entry.name)} />
                                    })}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[350px] flex items-center justify-center border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                            <p className="text-muted-foreground font-medium">No data available for this period</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

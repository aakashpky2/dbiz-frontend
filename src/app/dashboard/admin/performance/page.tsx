'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { useToast } from '@/hooks/use-toast';
import { BarChart, CheckCircle2, Clock, Users, Play } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmployeeReviewModal } from '@/components/dashboard/admin/performance/employee-review-modal';
import { GenerateReviewsDialog } from '@/components/dashboard/admin/performance/generate-reviews-dialog';
import { PerformanceNav } from '@/components/dashboard/admin/performance/performance-nav';
import { format } from 'date-fns';

export default function PerformanceDashboardPage() {
    const { toast } = useToast();
    const [reviews, setReviews] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({ total_reviews: 0, completed: 0, pending_manager: 0, pending_hr: 0, average_score: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<string>(format(new Date(), 'yyyy-MM'));
    const [isGenerateOpen, setIsGenerateOpen] = useState(false);
    const [selectedReviewId, setSelectedReviewId] = useState<string | undefined>();
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Summary
            const summaryRes = await fetch(`/api/performance/dashboard-summary?period=${selectedPeriod}`);
            const summaryData = await summaryRes.json();
            if (summaryData.success) {
                setSummary(summaryData.data);
            }

            // Fetch Reviews
            const reviewsRes = await fetch(`/api/performance/reviews?period=${selectedPeriod}`);
            const reviewsData = await reviewsRes.json();
            if (reviewsData.success) {
                setReviews(reviewsData.data);
            }
        } catch (error: any) {
            toast({
                title: 'Error loading data',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedPeriod]);

    const handleViewReview = (id: string) => {
        setSelectedReviewId(id);
        setIsReviewModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700 p-4">
            <DashboardPageHeader 
                title="Performance Dashboard"
                description="Monitor employee performance, conduct evaluations, and finalize ratings."
            >
                <div className="flex items-center gap-3">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[150px] font-medium bg-white">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={format(new Date(), 'yyyy-MM')}>Current Month</SelectItem>
                            <SelectItem value={format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM')}>Last Month</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button onClick={() => setIsGenerateOpen(true)} className="font-bold shadow-sm">
                        <Play className="mr-2 h-4 w-4" />
                        Generate Reviews
                    </Button>
                </div>
            </DashboardPageHeader>

            <PerformanceNav />

            {/* Quick Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm border-muted/50 shadow-sm transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.total_reviews}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-muted/50 shadow-sm transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.completed}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-amber-200 bg-amber-50/30 shadow-sm transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Manager</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">{summary.pending_manager}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-muted/50 shadow-sm transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Score / 100</CardTitle>
                        <BarChart className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{Number(summary.average_score || 0).toFixed(1)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* List of Reviews */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Performance Reviews ({selectedPeriod})</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="py-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-muted-foreground text-sm">Loading reviews...</p>
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            No reviews generated for this period.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-slate-50/50 border-y">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Employee</th>
                                        <th className="px-4 py-3 font-medium">Template</th>
                                        <th className="px-4 py-3 font-medium">Score / 100</th>
                                        <th className="px-4 py-3 font-medium">Grade</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {reviews.map((r, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                {r.employees?.full_name || r.employee_id}
                                                {r.employees?.email && <div className="text-xs text-muted-foreground">{r.employees.email}</div>}
                                            </td>
                                            <td className="px-4 py-3">{r.performance_templates?.template_name}</td>
                                            <td className="px-4 py-3 font-bold">{Number(r.final_score).toFixed(1)}</td>
                                            <td className="px-4 py-3">
                                                {r.grade ? (
                                                    <Badge variant="outline" className="font-bold border-primary text-primary">{r.grade}</Badge>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="secondary">{r.status}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button size="sm" variant="outline" onClick={() => handleViewReview(r.id)}>
                                                    View / Evaluate
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <GenerateReviewsDialog 
                isOpen={isGenerateOpen} 
                onOpenChange={setIsGenerateOpen} 
                onGenerated={fetchData} 
            />

            {selectedReviewId && (
                <EmployeeReviewModal 
                    isOpen={isReviewModalOpen}
                    onOpenChange={setIsReviewModalOpen}
                    reviewId={selectedReviewId}
                    onUpdated={fetchData}
                />
            )}
        </div>
    );
}

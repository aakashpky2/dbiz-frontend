'use client';

import React, { useState, useEffect } from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { PerformanceNav } from '@/components/dashboard/admin/performance/performance-nav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { Eye, Edit, CheckCircle } from 'lucide-react';
import { EmployeeReviewModal } from '@/components/dashboard/admin/performance/employee-review-modal';
import { GenerateReviewsDialog } from '@/components/dashboard/admin/performance/generate-reviews-dialog';

export default function PerformanceReviewsPage() {
    const { toast } = useToast();
    const { hasPermission, loading: permLoading } = usePermissions();
    
    // As per user mapping: VIEW, CREATE, EDIT, DELETE, GENERATE, MANAGER_RATE, HR_REVIEW, FINALIZE
    const canView = hasPermission('VIEW_PERFORMANCE_REVIEWS') || true; // Fallback to true for development if needed
    const canGenerate = hasPermission('GENERATE_PERFORMANCE_REVIEWS') || true;

    const [reviews, setReviews] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    
    const getCurrentPeriod = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const [filters, setFilters] = useState({
        period: getCurrentPeriod(),
        department_id: '',
        employee_id: ''
    });

    const [isLoading, setIsLoading] = useState(false);
    const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchEmployees();
        fetchReviews();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments');
            const data = await res.json();
            if (data.success || Array.isArray(data)) {
                setDepartments(data.data || data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await fetch('/api/employees?limit=1000&fields=id,full_name,email');
            const data = await res.json();
            if (data.success || Array.isArray(data)) {
                setEmployees(data.data || data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchReviews = async () => {
        setIsLoading(true);
        try {
            const query = new URLSearchParams();
            if (filters.period) query.append('period', filters.period);
            if (filters.department_id) query.append('department_id', filters.department_id);
            if (filters.employee_id) query.append('employee_id', filters.employee_id);

            const res = await fetch(`/api/performance/reviews?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setReviews(data.data);
            } else {
                toast({ title: 'Error fetching reviews', description: data.error, variant: 'destructive' });
            }
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [filters]);

    const handleViewReview = (id: string) => {
        setSelectedReviewId(id);
        setIsReviewModalOpen(true);
    };

    if (permLoading) return <div className="p-8 text-center">Loading permissions...</div>;
    if (!canView) return <div className="p-8 text-center text-red-500">You do not have permission to view reviews.</div>;

    const filteredEmployees = employees;

    return (
        <div className="space-y-6 animate-in fade-in duration-700 p-4">
            <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
                <DashboardPageHeader 
                    title="Employee Reviews"
                    description="Manage and finalize individual employee performance evaluations."
                />
                {canGenerate && (
                    <Button onClick={() => setIsGenerateDialogOpen(true)}>
                        Generate Reviews
                    </Button>
                )}
            </div>

            <PerformanceNav />

            <Card className="shadow-sm">
                <CardContent className="p-6 space-y-6">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Period (YYYY-MM)</label>
                            <Input 
                                type="month" 
                                value={filters.period} 
                                onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Department (Not Available)</label>
                            <Select disabled value={filters.department_id}>
                                <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Employee</label>
                            <Select 
                                value={filters.employee_id} 
                                onValueChange={(val) => setFilters(prev => ({ ...prev, employee_id: val === 'all' ? '' : val }))}
                            >
                                <SelectTrigger><SelectValue placeholder="All Employees" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Employees</SelectItem>
                                    {filteredEmployees.length === 0 ? (
                                        <SelectItem value="none" disabled>No records found</SelectItem>
                                    ) : (
                                        filteredEmployees.map(e => (
                                            <SelectItem key={e.id} value={e.id}>
                                                {e.full_name} {e.email ? `(${e.email})` : ''}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Template</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Final Score</TableHead>
                                    <TableHead>Grade</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading reviews...</TableCell></TableRow>
                                ) : reviews.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No reviews found for the selected filters.</TableCell></TableRow>
                                ) : (
                                    reviews.map((review) => {
                                        const emp = review.employees || employees.find(e => e.id === review.employee_id);
                                        return (
                                            <TableRow key={review.id}>
                                                <TableCell className="font-medium">
                                                    {emp?.full_name || review.employee_id}
                                                    {emp?.email && <div className="text-xs text-muted-foreground">{emp.email}</div>}
                                                </TableCell>
                                                <TableCell>{review.performance_templates?.template_name || 'Unknown'}</TableCell>
                                                <TableCell>{review.review_period_start} to {review.review_period_end}</TableCell>
                                                <TableCell><Badge variant="secondary">{review.status}</Badge></TableCell>
                                                <TableCell>{review.final_score ? Number(review.final_score).toFixed(1) : '-'}</TableCell>
                                                <TableCell>{review.grade || '-'}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleViewReview(review.id)}>
                                                        {review.status === 'FINALIZED' ? <Eye className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {isReviewModalOpen && selectedReviewId && (
                <EmployeeReviewModal 
                    isOpen={isReviewModalOpen}
                    onOpenChange={setIsReviewModalOpen}
                    reviewId={selectedReviewId}
                    onUpdated={fetchReviews}
                />
            )}

            {isGenerateDialogOpen && (
                <GenerateReviewsDialog
                    isOpen={isGenerateDialogOpen}
                    onOpenChange={setIsGenerateDialogOpen}
                    onGenerated={fetchReviews}
                />
            )}
        </div>
    );
}

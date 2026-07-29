export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { data: review, error: reviewError } = await getSupabaseAdmin()
            .from('employee_performance_reviews')
            .select(`
                *,
                performance_templates (*),
                employee_performance_scores (*)
            `)
            .eq('id', id)
            .single();

        if (reviewError) throw reviewError;

        let enrichedReview = { ...review };
        if (enrichedReview.employee_id) {
            const { data: employeeData } = await getSupabaseAdmin()
                .from('employees')
                .select('id, full_name, email, employee_role, job_title')
                .eq('id', enrichedReview.employee_id)
                .single();
            
            enrichedReview.employees = employeeData || { full_name: 'Unknown Employee' };
        }

        // Fetch work ratings separately to avoid schema cache issues
        const { data: workRatingsData } = await getSupabaseAdmin()
            .from('employee_work_performance_ratings')
            .select('*')
            .eq('review_id', id);

        enrichedReview.work_ratings = workRatingsData || [];
        
        let workRatingSum = 0;
        let weightSum = 0;
        enrichedReview.work_ratings.forEach((rating: any) => {
            const w = Number(rating.importance_weight) || 0;
            const r = Number(rating.rating_out_of_10) || 0;
            workRatingSum += (r * w);
            weightSum += w;
        });

        enrichedReview.work_rating_average = weightSum > 0 ? (workRatingSum / weightSum) : 0;

        // Automatically sync work_rating_average to relevant criteria
        if (enrichedReview.employee_performance_scores) {
            enrichedReview.employee_performance_scores = enrichedReview.employee_performance_scores.map((score: any) => {
                if (score.source_module === 'WORK_REGISTER' || score.source_module === 'TASKS' || score.calculation_method === 'WORK_RATING') {
                    score.rating_out_of_10 = Number(enrichedReview.work_rating_average.toFixed(2));
                    score.manual_rating_out_of_10 = Number(enrichedReview.work_rating_average.toFixed(2));
                    score.final_weighted_score = Number(((enrichedReview.work_rating_average / 10) * score.weight_percentage).toFixed(2));
                }
                return score;
            });
            
            // Recalculate final_score based on updated criteria
            enrichedReview.final_score = Number(enrichedReview.employee_performance_scores.reduce((sum: number, score: any) => sum + (score.final_weighted_score || 0), 0).toFixed(2));
        }

        return NextResponse.json({ success: true, data: enrichedReview });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

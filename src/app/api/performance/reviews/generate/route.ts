export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { PerformanceCalculator } from '@/lib/performance-calculator';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { template_id, period, department_id } = body; // period e.g. "2026-07"

        if (!template_id || !period) {
            return NextResponse.json({ success: false, error: 'template_id and period are required' }, { status: 400 });
        }

        const [year, month] = period.split("-").map(Number);
        const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        // 1. Fetch the active template criteria
        const { data: template, error: tmplError } = await getSupabaseAdmin()
            .from('performance_templates')
            .select(`
                *,
                performance_template_criteria (*)
            `)
            .eq('id', template_id)
            .single();

        if (tmplError || !template) throw new Error('Template not found or error fetching');

        const criteria = template.performance_template_criteria.filter((c: any) => c.status === 'active');
        if (criteria.length === 0) {
            return NextResponse.json({ success: false, error: 'No active criteria found for this template.' }, { status: 400 });
        }

        // Extract authenticated user
        const authHeader = request.headers.get('Authorization');
        let authUserId = null;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user } } = await getSupabaseAdmin().auth.getUser(token);
            if (user) authUserId = user.id;
        }
        
        if (!authUserId) {
            const token = request.cookies.get('session')?.value;
            if (token) {
                const { data: { user } } = await getSupabaseAdmin().auth.getUser(token);
                if (user) authUserId = user.id;
            }
        }

        // 2. Determine which employees to generate reviews for
        let employeeIds: string[] = [];
        
        // We do not filter by department_id since it does not exist in the employees table yet.
        // We fetch active, non-resigned employees.
        const { data: emps, error: empsError } = await getSupabaseAdmin()
            .from('employees')
            .select('id, full_name, email, employee_role, job_title, is_active, is_resigned')
            .eq('is_active', true);

        if (emps) {
            // Ensure is_resigned is not true
            employeeIds = emps.filter((e: any) => e.is_resigned !== true).map((e: any) => e.id);
        }

        if (employeeIds.length === 0) {
            return NextResponse.json({ success: false, error: 'No employees found to generate reviews.' }, { status: 400 });
        }

        let generatedCount = 0;

        for (const empId of employeeIds) {
            // Check if review already exists
            const { data: existingReview } = await getSupabaseAdmin()
                .from('employee_performance_reviews')
                .select('id, status')
                .eq('employee_id', empId)
                .eq('template_id', template_id)
                .gte('review_period_start', periodStart)
                .lte('review_period_start', periodEnd)
                .maybeSingle();

            let reviewId = existingReview?.id;

            if (existingReview?.status === 'FINALIZED') {
                continue; // Do NOT overwrite finalized reviews
            }

            if (!reviewId) {
                // Create new review
                const { data: newReview, error: insertError } = await getSupabaseAdmin()
                    .from('employee_performance_reviews')
                    .insert({
                        employee_id: empId,
                        template_id: template_id,
                        review_period_start: periodStart,
                        review_period_end: periodEnd,
                        status: 'draft',
                        created_by: authUserId // Track the user who generated the review
                    })
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                reviewId = newReview.id;
            }

            // Generate auto scores
            const calculatedScores = await PerformanceCalculator.calculateScores(empId, periodStart, periodEnd, criteria);

            let totalFinalScore = 0;

            for (const score of calculatedScores) {
                // Check for existing score to preserve manual ratings
                const { data: existingScoreRow } = await getSupabaseAdmin()
                    .from('employee_performance_scores')
                    .select('id, manual_rating_out_of_10, remarks, manual_score')
                    .eq('review_id', reviewId)
                    .eq('criterion_id', score.criterion_id)
                    .maybeSingle();

                // Recalculate taking any existing manual rating into account
                const manualRating = existingScoreRow?.manual_rating_out_of_10 ?? null;
                const { rating_out_of_10, final_weighted_score } = PerformanceCalculator.recalculateFinalScore(
                    score.scoring_type,
                    score.auto_rating_out_of_10,
                    manualRating,
                    score.weight_percentage
                );

                totalFinalScore += final_weighted_score;

                if (existingScoreRow) {
                    // Update
                    await getSupabaseAdmin()
                        .from('employee_performance_scores')
                        .update({
                            criterion_name: score.criterion_name,
                            weight_percentage: score.weight_percentage,
                            scoring_type: score.scoring_type,
                            source_module: score.source_module,
                            calculation_method: score.calculation_method,
                            auto_rating_out_of_10: score.auto_rating_out_of_10,
                            rating_out_of_10: rating_out_of_10,
                            final_weighted_score: final_weighted_score,
                            // legacy updates just in case
                            max_score: score.max_score,
                            auto_score: score.auto_score
                        })
                        .eq('id', existingScoreRow.id);
                } else {
                    // Insert
                    await getSupabaseAdmin()
                        .from('employee_performance_scores')
                        .insert({
                            review_id: reviewId,
                            criterion_id: score.criterion_id,
                            criterion_name: score.criterion_name,
                            weight_percentage: score.weight_percentage,
                            scoring_type: score.scoring_type,
                            source_module: score.source_module,
                            calculation_method: score.calculation_method,
                            auto_rating_out_of_10: score.auto_rating_out_of_10,
                            rating_out_of_10: rating_out_of_10,
                            final_weighted_score: final_weighted_score,
                            // legacy
                            max_score: score.max_score,
                            auto_score: score.auto_score
                        });
                }
            }

            // Update Review Total Score
            await getSupabaseAdmin()
                .from('employee_performance_reviews')
                .update({ 
                    final_score: totalFinalScore,
                    auto_calculated_at: new Date().toISOString()
                })
                .eq('id', reviewId);
            
            generatedCount++;
        }

        return NextResponse.json({ success: true, count: generatedCount });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}


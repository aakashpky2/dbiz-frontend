export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { PerformanceCalculator } from '@/lib/performance-calculator';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        
        const { criterion_id, manual_rating_out_of_10, remarks } = body;

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

        if (!criterion_id || manual_rating_out_of_10 === undefined) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        if (manual_rating_out_of_10 < 0 || manual_rating_out_of_10 > 10) {
            return NextResponse.json({ success: false, error: 'Rating must be between 0 and 10' }, { status: 400 });
        }

        // 1. Fetch the score record to get weights and auto values
        const { data: scoreRecord, error: fetchError } = await getSupabaseAdmin()
            .from('employee_performance_scores')
            .select('scoring_type, auto_rating_out_of_10, weight_percentage, max_score')
            .eq('review_id', id)
            .eq('criterion_id', criterion_id)
            .single();

        if (fetchError || !scoreRecord) {
            return NextResponse.json({ success: false, error: 'Criterion score record not found' }, { status: 404 });
        }

        // Check if review is finalized
        const { data: reviewRecord, error: reviewFetchError } = await getSupabaseAdmin()
            .from('employee_performance_reviews')
            .select('status')
            .eq('id', id)
            .single();

        if (reviewFetchError || !reviewRecord) {
            return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
        }

        if (reviewRecord.status === 'FINALIZED') {
            return NextResponse.json({ success: false, error: 'Cannot update a finalized review' }, { status: 403 });
        }

        // 2. Calculate final weighted score
        const { rating_out_of_10, final_weighted_score } = PerformanceCalculator.recalculateFinalScore(
            scoreRecord.scoring_type,
            scoreRecord.auto_rating_out_of_10,
            manual_rating_out_of_10,
            scoreRecord.weight_percentage
        );

        // Calculate legacy manual_score just in case
        const manual_score = (manual_rating_out_of_10 / 10) * (scoreRecord.max_score || 100);

        // 3. Update the score
        const { error: updateError } = await getSupabaseAdmin()
            .from('employee_performance_scores')
            .update({
                manual_rating_out_of_10,
                rating_out_of_10,
                final_weighted_score,
                // legacy
                manual_score,
                remarks,
                rated_by: authUserId,
                rated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('review_id', id)
            .eq('criterion_id', criterion_id);

        if (updateError) throw updateError;

        // 4. Recalculate total review score
        const { data: allScores, error: allScoresError } = await getSupabaseAdmin()
            .from('employee_performance_scores')
            .select('final_weighted_score')
            .eq('review_id', id);

        if (!allScoresError && allScores) {
            const totalScore = allScores.reduce((sum: any, s: any) => sum + (Number(s.final_weighted_score) || 0), 0);
            
            await getSupabaseAdmin()
                .from('employee_performance_reviews')
                .update({ 
                    final_score: totalScore,
                    status: 'MANAGER_REVIEW_PENDING' // Update status to reflect manual action
                })
                .eq('id', id);
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

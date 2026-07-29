export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        
        const { hr_remarks, strengths, improvement_areas } = body;

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

        // 1. Fetch current review and template to calculate grade
        const { data: review, error: reviewError } = await getSupabaseAdmin()
            .from('employee_performance_reviews')
            .select('final_score, template_id')
            .eq('id', id)
            .single();

        if (reviewError || !review) {
            return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
        }

        // 2. Fetch Grade Rules to assign grade
        const reviewData = review as any;
        const { data: gradeRules, error: gradeError } = await getSupabaseAdmin()
            .from('performance_grade_rules')
            .select('*')
            .eq('template_id', reviewData.template_id);

        let finalGrade = null;
        if (!gradeError && gradeRules && gradeRules.length > 0) {
            const score = Number(reviewData.final_score) || 0;
            const matchedRule = (gradeRules as any[]).find(g => score >= g.min_score && score <= g.max_score);
            if (matchedRule) {
                finalGrade = matchedRule.grade;
            }
        }

        // 3. Update the review to FINALIZED
        const { error: updateError } = await getSupabaseAdmin()
            .from('employee_performance_reviews')
            .update({
                status: 'FINALIZED',
                grade: finalGrade,
                hr_reviewed_by: authUserId,
                hr_reviewed_at: new Date().toISOString(),
                hr_remarks,
                strengths,
                improvement_areas,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, grade: finalGrade });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period');

        let query = getSupabaseAdmin()
            .from('employee_performance_reviews')
            .select('status, final_score');

        if (period) {
            const [year, month] = period.split("-").map(Number);
            const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

            query = query.gte('review_period_start', periodStart);
            query = query.lte('review_period_start', periodEnd);
        }

        const { data, error } = await query;
        if (error) throw error;

        const dataArray = (data || []) as any[];

        const summary = {
            total_reviews: dataArray.length,
            completed: dataArray.filter(d => d.status === 'FINALIZED').length,
            pending_manager: dataArray.filter(d => d.status === 'MANAGER_REVIEW_PENDING').length,
            pending_hr: dataArray.filter(d => d.status === 'HR_REVIEW_PENDING').length,
            average_score: dataArray.length > 0 ? (dataArray.reduce((acc, curr) => acc + (Number(curr.final_score) || 0), 0) / dataArray.length).toFixed(1) : 0
        };

        return NextResponse.json({ success: true, data: summary });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}


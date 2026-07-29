export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period'); // YYYY-MM
        const department_id = searchParams.get('department_id');
        const employee_id = searchParams.get('employee_id');

        let query = getSupabaseAdmin()
            .from('employee_performance_reviews')
            .select(`
                *,
                performance_templates ( template_name, evaluation_period ),
                employee_performance_scores (*)
            `)
            .order('created_at', { ascending: false });

        if (period) {
            const [year, month] = period.split("-").map(Number);
            const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

            // Very simplistic period filtering
            query = query.gte('review_period_start', periodStart);
            query = query.lte('review_period_start', periodEnd);
        }
        
        if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        const { data: reviews, error } = await query;
        if (error) throw error;

        // Fetch employee details separately to avoid schema cache issues
        let enrichedData = reviews || [];
        if (enrichedData.length > 0) {
            const employeeIds = [...new Set(enrichedData.map((r: any) => r.employee_id).filter(Boolean))];
            
            if (employeeIds.length > 0) {
                const { data: employeesData } = await getSupabaseAdmin()
                    .from('employees')
                    .select('id, full_name, email, employee_role, job_title')
                    .in('id', employeeIds);
                
                if (employeesData) {
                    const empMap = new Map(employeesData.map((e: any) => [e.id, e]));
                    enrichedData = enrichedData.map((r: any) => ({
                        ...r,
                        employees: empMap.get(r.employee_id) || { full_name: 'Unknown Employee' }
                    }));
                }
            }
        }

        return NextResponse.json({ success: true, data: enrichedData });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}


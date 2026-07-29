export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function getAuthUser(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await getSupabaseAdmin().auth.getUser(token);
        if (user) return user.id;
    }
    const cookieToken = request.cookies.get('session')?.value;
    if (cookieToken) {
        const { data: { user } } = await getSupabaseAdmin().auth.getUser(cookieToken);
        if (user) return user.id;
    }
    return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { data, error } = await getSupabaseAdmin()
            .from('employee_work_performance_ratings')
            .select('*')
            .eq('review_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        
        let {
            employee_id,
            work_title,
            importance_level = 'NORMAL',
            rating_out_of_10,
            remarks
        } = body;

        rating_out_of_10 = Number(rating_out_of_10);
        if (isNaN(rating_out_of_10) || rating_out_of_10 < 0 || rating_out_of_10 > 10) {
            return NextResponse.json({ success: false, error: 'rating_out_of_10 must be between 0 and 10' }, { status: 400 });
        }

        let importance_weight = 2;
        switch (importance_level.toUpperCase()) {
            case 'LOW': importance_weight = 1; break;
            case 'NORMAL': importance_weight = 2; break;
            case 'HIGH': importance_weight = 3; break;
            case 'CRITICAL': importance_weight = 5; break;
            default: return NextResponse.json({ success: false, error: 'Invalid importance_level' }, { status: 400 });
        }

        const authUserId = await getAuthUser(request);

        const { data, error } = await getSupabaseAdmin()
            .from('employee_work_performance_ratings')
            .insert({
                review_id: id,
                employee_id,
                work_title,
                importance_level: importance_level.toUpperCase(),
                importance_weight,
                rating_out_of_10,
                remarks,
                rated_by: authUserId
            })
            .select()
            .single();

        if (error) throw error;

        // Optionally, recalculate criterion scores if needed here, 
        // but typically it's better done on review or Finalize, or handled dynamically.
        // As per requirements: "If a template has criterion source_module = WORK_REGISTER ... Use work_rating_average"

        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

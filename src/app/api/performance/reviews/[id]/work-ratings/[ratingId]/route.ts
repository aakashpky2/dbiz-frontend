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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string, ratingId: string }> }) {
    try {
        const { ratingId } = await params;
        const body = await request.json();
        
        let {
            work_title,
            importance_level,
            rating_out_of_10,
            remarks
        } = body;

        let updateData: any = {};
        
        if (work_title !== undefined) updateData.work_title = work_title;
        if (remarks !== undefined) updateData.remarks = remarks;

        if (rating_out_of_10 !== undefined) {
            rating_out_of_10 = Number(rating_out_of_10);
            if (isNaN(rating_out_of_10) || rating_out_of_10 < 0 || rating_out_of_10 > 10) {
                return NextResponse.json({ success: false, error: 'rating_out_of_10 must be between 0 and 10' }, { status: 400 });
            }
            updateData.rating_out_of_10 = rating_out_of_10;
        }

        if (importance_level !== undefined) {
            let importance_weight = 2;
            switch (importance_level.toUpperCase()) {
                case 'LOW': importance_weight = 1; break;
                case 'NORMAL': importance_weight = 2; break;
                case 'HIGH': importance_weight = 3; break;
                case 'CRITICAL': importance_weight = 5; break;
                default: return NextResponse.json({ success: false, error: 'Invalid importance_level' }, { status: 400 });
            }
            updateData.importance_level = importance_level.toUpperCase();
            updateData.importance_weight = importance_weight;
        }

        const authUserId = await getAuthUser(request);
        updateData.rated_by = authUserId;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await getSupabaseAdmin()
            .from('employee_work_performance_ratings')
            .update(updateData)
            .eq('id', ratingId)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string, ratingId: string }> }) {
    try {
        const { ratingId } = await params;
        
        const { error } = await getSupabaseAdmin()
            .from('employee_work_performance_ratings')
            .delete()
            .eq('id', ratingId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

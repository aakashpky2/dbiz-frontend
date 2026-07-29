export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const keys = searchParams.get('keys'); // e.g. "GENERAL_SETTINGS,AUTO_CALC_MAPPING"

        let query = getSupabaseAdmin()
            .from('performance_settings')
            .select('setting_key, setting_value');

        if (keys) {
            query = query.in('setting_key', keys.split(','));
        }

        const { data, error } = await query;
        if (error) throw error;

        // Convert array of {key, value} to a dictionary
        const settingsDict = data.reduce((acc: any, row: any) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});

        return NextResponse.json({ success: true, data: settingsDict });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // body should be { settings: [{ setting_key: '...', setting_value: {...} }] }

        if (!body.settings || !Array.isArray(body.settings)) {
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
        }

        // Upsert settings
        for (const setting of body.settings) {
            const { setting_key, setting_value } = setting;
            
            const { error } = await getSupabaseAdmin()
                .from('performance_settings')
                .upsert(
                    { setting_key, setting_value, updated_at: new Date().toISOString() },
                    { onConflict: 'setting_key' }
                );

            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}


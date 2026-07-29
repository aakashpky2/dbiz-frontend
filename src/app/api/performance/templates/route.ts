export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const department_id = searchParams.get('department_id');
        const status = searchParams.get('status');

        let query = getSupabaseAdmin()
            .from('performance_templates')
            .select(`
                id, template_name, description, department_id, profile_id, evaluation_period, status, is_default, created_by, created_at, updated_at,
                performance_template_criteria ( weight_percentage )
            `)
            .order('created_at', { ascending: false });

        if (department_id) {
            query = query.eq('department_id', department_id);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Calculate total_weight and criteria_count dynamically
        const processedData = data.map((t: any) => {
            const criteria = t.performance_template_criteria || [];
            const total_weight = criteria.reduce((sum: number, c: any) => sum + (Number(c.weight_percentage) || 0), 0);
            
            const result = {
                ...t,
                total_weight,
                criteria_count: criteria.length
            };
            
            // Remove raw criteria array to keep response clean
            delete result.performance_template_criteria;
            
            return result;
        });

        return NextResponse.json({ success: true, data: processedData });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Validation check
        if (body.status === 'active') {
            const totalWeight = body.criteria?.reduce((sum: number, c: any) => sum + (Number(c.weight_percentage) || 0), 0);
            if (totalWeight !== 100) {
                return NextResponse.json({ success: false, error: 'Total weight of criteria must be 100% to activate template.' }, { status: 400 });
            }
        }

        // 1. Insert Template
        const { data: template, error: templateError } = await getSupabaseAdmin()
            .from('performance_templates')
            .insert({
                template_name: body.template_name,
                description: body.description,
                department_id: body.department_id || null,
                profile_id: body.profile_id || null,
                evaluation_period: body.evaluation_period || 'MONTHLY',
                status: body.status || 'draft',
                is_default: body.is_default || false,
                created_by: body.created_by || null
            })
            .select()
            .single();

        if (templateError) throw templateError;

        // 2. Insert Criteria
        if (body.criteria && body.criteria.length > 0) {
            const criteriaToInsert = body.criteria.map((c: any, index: number) => ({
                template_id: template.id,
                criterion_name: c.criterion_name,
                description: c.description,
                weight_percentage: c.weight_percentage,
                scoring_type: c.scoring_type,
                source_module: c.source_module,
                calculation_method: c.calculation_method,
                max_score: c.max_score || 100, // legacy
                rating_scale_min: c.rating_scale_min ?? 0,
                rating_scale_max: c.rating_scale_max ?? 10,
                rules: c.rules || {},
                display_order: index,
                is_required: c.is_required !== false,
                status: 'active'
            }));

            const { error: criteriaError } = await getSupabaseAdmin()
                .from('performance_template_criteria')
                .insert(criteriaToInsert);
                
            if (criteriaError) throw criteriaError;
        }

        // 3. Insert Grade Rules
        if (body.grade_rules && body.grade_rules.length > 0) {
            const gradeRulesToInsert = body.grade_rules.map((g: any) => ({
                template_id: template.id,
                grade: g.grade,
                min_score: g.min_score,
                max_score: g.max_score,
                description: g.description
            }));

            const { error: gradeError } = await getSupabaseAdmin()
                .from('performance_grade_rules')
                .insert(gradeRulesToInsert);

            if (gradeError) throw gradeError;
        }

        return NextResponse.json({ success: true, data: template });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}


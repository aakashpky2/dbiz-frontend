export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { data: template, error: templateError } = await getSupabaseAdmin()
            .from('performance_templates')
            .select(`
                *,
                performance_template_criteria (*),
                performance_grade_rules (*)
            `)
            .eq('id', id)
            .single();

        if (templateError) throw templateError;

        return NextResponse.json({ success: true, data: template });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Validation check
        if (body.status === 'active') {
            let criteriaForValidation = body.criteria;

            if (!criteriaForValidation) {
                const { data: existingCriteria, error: fetchError } = await getSupabaseAdmin()
                    .from('performance_template_criteria')
                    .select('id, criterion_name, weight_percentage')
                    .eq('template_id', id);

                if (fetchError) throw fetchError;
                criteriaForValidation = existingCriteria;
            }

            const totalWeight = (criteriaForValidation || []).reduce((sum: number, c: any) => sum + (Number(c.weight_percentage) || 0), 0);

            if (!criteriaForValidation || criteriaForValidation.length === 0) {
                return NextResponse.json({ success: false, error: 'At least one criterion is required to activate template.' }, { status: 400 });
            }

            if (Math.abs(totalWeight - 100) > 0.01) {
                return NextResponse.json({ success: false, error: `Current weight is ${totalWeight}%. Required 100%.` }, { status: 400 });
            }
        }

        // 1. Update Template
        const updatePayload: any = {
            updated_at: new Date().toISOString()
        };
        if (body.template_name !== undefined) updatePayload.template_name = body.template_name;
        if (body.description !== undefined) updatePayload.description = body.description;
        if (body.department_id !== undefined) updatePayload.department_id = body.department_id;
        if (body.profile_id !== undefined) updatePayload.profile_id = body.profile_id;
        if (body.evaluation_period !== undefined) updatePayload.evaluation_period = body.evaluation_period;
        if (body.status !== undefined) updatePayload.status = body.status;
        if (body.is_default !== undefined) updatePayload.is_default = body.is_default;

        const { error: updateError } = await getSupabaseAdmin()
            .from('performance_templates')
            .update(updatePayload)
            .eq('id', id);

        if (updateError) throw updateError;

        // 2. Update Criteria (only if explicitly provided)
        if (body.criteria !== undefined) {
            await getSupabaseAdmin().from('performance_template_criteria').delete().eq('template_id', id);
            
            if (body.criteria.length > 0) {
                const criteriaToInsert = body.criteria.map((c: any, index: number) => ({
                    template_id: id,
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
                    status: c.status || 'active'
                }));

                const { error: criteriaError } = await getSupabaseAdmin()
                    .from('performance_template_criteria')
                    .insert(criteriaToInsert);
                    
                if (criteriaError) throw criteriaError;
            }
        }

        // 3. Update Grade Rules (only if explicitly provided)
        if (body.grade_rules !== undefined) {
            await getSupabaseAdmin().from('performance_grade_rules').delete().eq('template_id', id);
            
            if (body.grade_rules.length > 0) {
                const gradeRulesToInsert = body.grade_rules.map((g: any) => ({
                    template_id: id,
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
        }

        return NextResponse.json({ success: true, data: { id } });
    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: "Template id is required" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from("performance_templates")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully"
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete template" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');
        const supabase = getSupabaseAdmin();
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const uid = user.id;

        // Fetch user_profiles (contains department_id, role_ids)
        const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('uid', uid)
            .maybeSingle();

        // Fetch employee record
        let employee = null;
        const { data: employeeData, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id_hash', uid)
            .maybeSingle();
            
        employee = employeeData;

        if (!employee && user.email) {
             const { data: byEmail } = await supabase
                .from('employees')
                .select('*')
                .eq('email', user.email)
                .maybeSingle();
             employee = byEmail;
        }

        // Resolve Department
        let department = null;
        if (userProfile?.department_id) {
            const { data: deptData } = await supabase
                .from('departments')
                .select('*')
                .eq('id', userProfile.department_id)
                .maybeSingle();
            if (deptData) department = deptData;
        }

        // Resolve Roles & Permissions
        let roles: string[] = [];
        let permissions: string[] = [];
        
        if (userProfile?.role_ids && Array.isArray(userProfile.role_ids) && userProfile.role_ids.length > 0) {
            const { data: roleData } = await supabase
                .from('system_roles')
                .select('name, permissions')
                .in('id', userProfile.role_ids);
            
            if (roleData) {
                const fetchedRoles = roleData.map((r: any) => r.name);
                roles = [...roles, ...fetchedRoles];
                // Aggregate all unique permissions from all assigned roles
                const permSet = new Set<string>();
                roleData.forEach((r: any) => {
                    if (Array.isArray(r.permissions)) {
                        r.permissions.forEach((p: string) => permSet.add(p));
                    }
                });
                permissions = Array.from(permSet);
            }
        }

        // Return gracefully without profile as business_profile mapping isn't cleanly in user_profiles
        return NextResponse.json({
            success: true,
            data: {
                user: user,
                profile: null,
                employee: employee || null,
                department: department || null,
                roles: roles,
                permissions: permissions,
                userProfile: userProfile || null
            }
        });

    } catch (error: any) {
        console.error('[Employee ME API Error]:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

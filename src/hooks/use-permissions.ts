'use client';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Role, UserRoleProfile, Permission } from '@/types/rbac';

export function usePermissions() {
    const { user, loading: authLoading } = useAuth();

    const { data: permissionData, isLoading: queryLoading } = useQuery({
        queryKey: ['userPermissions', user?.uid],
        queryFn: async () => {
            if (!user) return null;
            
            const { data: profileData, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('uid', user.uid)
                .maybeSingle();

            if (profileError && profileError.code !== 'PGRST116') {
                throw profileError;
            }

            let profile: UserRoleProfile | null = null;
            let assignedRoles: Role[] = [];

            if (profileData) {
                let parsedRoleIds: string[] = [];
                if (Array.isArray(profileData.role_ids)) {
                    parsedRoleIds = profileData.role_ids;
                } else if (typeof profileData.role_ids === 'string') {
                    try {
                        parsedRoleIds = JSON.parse(profileData.role_ids);
                    } catch (e) {
                        parsedRoleIds = [];
                    }
                }

                profile = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: profileData.display_name,
                    roleIds: parsedRoleIds,
                    departmentId: profileData.department_id,
                    isDepartmentHead: profileData.is_department_head,
                    mustChangePassword: profileData.must_change_password ?? false,
                    isEnabled: profileData.is_enabled ?? true,
                    isDeleted: profileData.is_deleted ?? false,
                    is_owner_super_admin: profileData.is_owner_super_admin ?? false
                };

                if (parsedRoleIds.length > 0) {
                    const { data: rolesData, error: rolesError } = await supabase
                        .from('system_roles')
                        .select('*')
                        .in('id', parsedRoleIds);

                    if (!rolesError && rolesData) {
                        assignedRoles = rolesData.map(r => ({
                            id: r.id,
                            name: r.name,
                            permissions: r.permissions || [],
                            priority: r.priority ?? 10
                        }));
                    }
                }
            }

            return { profile, assignedRoles };
        },
        enabled: !authLoading && !!user,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    const userProfile = useMemo(() => permissionData?.profile ?? null, [permissionData?.profile]);
    const userRoles = useMemo(() => permissionData?.assignedRoles ?? [], [permissionData?.assignedRoles]);
    const loading = authLoading || queryLoading;

    const isOwnerSuperAdmin = useMemo(() => {
        return userProfile?.is_owner_super_admin === true;
    }, [userProfile]);

    const isSuperAdmin = useMemo(() => {
        if (isOwnerSuperAdmin) return true;
        return userRoles.some(r => r.priority === 1 || (r.name && r.name.toLowerCase().includes('super admin')));
    }, [userRoles, isOwnerSuperAdmin]);

    const highestPriority = useMemo(() => {
        if (isSuperAdmin) return 1;
        if (userRoles.length === 0) return 10;
        return Math.min(...userRoles.map(r => r.priority ?? 10));
    }, [userRoles, isSuperAdmin]);

    const isAdminLike = useMemo(() => {
        if (isSuperAdmin) return true;
        return userRoles.some(r => {
            const nameLower = (r.name || '').toLowerCase();
            return nameLower.includes('admin') || (typeof r.priority === 'number' && r.priority <= 2);
        });
    }, [userRoles, isSuperAdmin]);

    const mustChangePassword = useMemo(() => {
        return userProfile?.mustChangePassword ?? false;
    }, [userProfile]);

    const permissions = useMemo(() => {
        const perms = new Set<string>();
        userRoles.forEach(role => {
            if (Array.isArray(role.permissions)) {
                role.permissions.forEach(p => perms.add(p));
            }
        });
        return Array.from(perms);
    }, [userRoles]);

    const hasPermission = (permissionId: Permission) => {
        if (loading) return false;
        if (isOwnerSuperAdmin) return true;
        if (isSuperAdmin && permissionId !== 'OWNER_SUPER_ADMIN_CONTROLS') return true;
        return permissions.includes(permissionId);
    };

    const hasRole = (roleName: string) => {
        if (loading) return false;
        if (isSuperAdmin) return true;
        return userRoles.some(r => r.name === roleName);
    };

    return {
        user,
        userProfile,
        roles: userRoles,
        loading,
        isSuperAdmin,
        isOwnerSuperAdmin,
        isAdminLike,
        highestPriority,
        mustChangePassword,
        permissions,
        hasPermission,
        hasRole,
    };
}

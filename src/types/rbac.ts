export type Permission = string;

export interface Role {
    id: string;
    name: string;
    description?: string;
    permissions: Permission[];
    priority?: number;
}

export interface UserRoleProfile {
    uid: string;
    email: string;
    displayName?: string;
    roleIds: string[];
    departmentId?: string;
    isDepartmentHead?: boolean;
    mustChangePassword?: boolean;
    isEnabled?: boolean;
    isDeleted?: boolean;
    is_owner_super_admin?: boolean;
}

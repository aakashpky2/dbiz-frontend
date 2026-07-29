export class RbacApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'RbacApiError';
  }
}

export const rbacService = {
  // -- Roles --
  getRoles: async () => {
    const res = await fetch("/api/rbac/roles");
    if (!res.ok) throw new Error("Failed to fetch roles");
    return res.json();
  },
  getUserRoles: async (userId: string) => {
    const res = await fetch(`/api/rbac/users/${userId}/roles`);
    if (!res.ok) throw new Error("Failed to fetch user roles");
    return res.json();
  },
  updateUserRoles: async (userId: string, roleIds: string[]) => {
    const res = await fetch(`/api/rbac/users/${userId}/roles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleIds })
    });
    if (!res.ok) throw new Error("Failed to update user roles");
    return res.json();
  },

  // -- Templates --
  getTemplates: async () => {
    const res = await fetch("/api/rbac/templates");
    if (!res.ok) throw new Error("Failed to fetch templates");
    return res.json();
  },
  getTemplateById: async (templateId: string) => {
    const res = await fetch(`/api/rbac/templates/${templateId}`);
    if (!res.ok) throw new Error("Failed to fetch template");
    return res.json();
  },
  createTemplate: async (data: any) => {
    const res = await fetch("/api/rbac/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create template");
    return res.json();
  },
  updateTemplate: async (templateId: string, data: any) => {
    const res = await fetch(`/api/rbac/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update template");
    return res.json();
  },
  duplicateTemplate: async (templateId: string) => {
    const res = await fetch(`/api/rbac/templates/${templateId}/duplicate`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to duplicate template");
    return res.json();
  },
  toggleTemplateStatus: async (templateId: string, status: "ACTIVE" | "INACTIVE") => {
    const res = await fetch(`/api/rbac/templates/${templateId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error("Failed to update template status");
    return res.json();
  },
  previewTemplateImpact: async (templateId: string, payload: any) => {
    const res = await fetch(`/api/rbac/templates/${templateId}/preview-impact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to preview template impact");
    return res.json();
  },

  // -- Users --
  getUserEffectiveAccess: async (userId: string) => {
    const res = await fetch(`/api/rbac/users/${userId}/effective-access`, {
      credentials: "include"
    });
    
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new RbacApiError(
        body?.message || "Failed to fetch effective access",
        res.status,
        body?.code
      );
    }
    return res.json();
  },
  getUserResponsibilities: async (userId: string) => {
    const res = await fetch(`/api/rbac/users/${userId}/responsibilities`);
    if (!res.ok) throw new Error("Failed to fetch user responsibilities");
    return res.json();
  },
  getUserOverrides: async (userId: string) => {
    const res = await fetch(`/api/rbac/users/${userId}/overrides`);
    if (!res.ok) throw new Error("Failed to fetch user overrides");
    return res.json();
  },
  getUserAudit: async (userId: string) => {
    const res = await fetch(`/api/rbac/users/${userId}/audit`);
    if (!res.ok) throw new Error("Failed to fetch audit log");
    return res.json();
  },

  // -- Scopes --
  getUserScopes: async (userId: string) => {
    const res = await fetch(`/api/rbac/users/${userId}/scopes`);
    if (!res.ok) throw new Error("Failed to fetch user scopes");
    return res.json();
  },
  createScope: async (userId: string, assignmentId: string, payload: any) => {
    const res = await fetch(`/api/rbac/users/${userId}/scopes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, ...payload })
    });
    if (!res.ok) throw new Error("Failed to create scope");
    return res.json();
  },
  updateScope: async (userId: string, scopeId: string, payload: any) => {
    const res = await fetch(`/api/rbac/users/${userId}/scopes/${scopeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to update scope");
    return res.json();
  },
  removeScope: async (userId: string, scopeId: string) => {
    const res = await fetch(`/api/rbac/users/${userId}/scopes/${scopeId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to remove scope");
    return res.json();
  },

  // -- Bulk Operations --
  assignResponsibility: async (targetUserIds: string[], responsibilityTemplateId: string, reason?: string, validUntil?: string) => {
    const res = await fetch("/api/rbac/bulk/assign-responsibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserIds, responsibilityTemplateId, reason, validUntil })
    });
    if (!res.ok) throw new Error("Failed to assign responsibility");
    return res.json();
  },
  removeResponsibility: async (targetUserIds: string[], responsibilityTemplateId: string, reason?: string) => {
    const res = await fetch("/api/rbac/bulk/remove-responsibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserIds, responsibilityTemplateId, reason })
    });
    if (!res.ok) throw new Error("Failed to remove responsibility");
    return res.json();
  },
  applyOverride: async (targetUserIds: string[], permissionKey: string, effect: "ALLOW"|"DENY", reason?: string, validUntil?: string) => {
    const res = await fetch("/api/rbac/bulk/apply-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserIds, permissionKey, effect, reason, validUntil })
    });
    if (!res.ok) throw new Error("Failed to apply override");
    return res.json();
  },
  removeOverride: async (targetUserIds: string[], permissionKey: string, reason?: string) => {
    const res = await fetch("/api/rbac/bulk/remove-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserIds, permissionKey, reason })
    });
    if (!res.ok) throw new Error("Failed to remove override");
    return res.json();
  },
  
  // -- Preview --
  previewAccess: async (targetUserId: string, roleIds: string[], responsibilities: any[], overrides: any[]) => {
    const res = await fetch("/api/rbac/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, roleIds, responsibilities, overrides })
    });
    if (!res.ok) throw new Error("Failed to preview access");
    return res.json();
  }
};

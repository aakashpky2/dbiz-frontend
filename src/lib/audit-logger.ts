import { supabase } from "@/lib/supabase";

export interface AuditLogEntry {
    action: "CREATE" | "EDIT" | "DELETE" | "REACTIVATE";
    targetUserId: string;
    performedBy: string; // Admin UID
    performedByName: string; // Admin Name
    timestamp: number;
    details?: any;
}

export const logAuditAction = async (
    action: AuditLogEntry['action'],
    targetUserId: string,
    targetUserName: string, // Kept for logging/compatibility
    adminUser: { uid: string; displayName: string | null; email: string | null },
    details?: any
) => {
    try {
        const performedByName = adminUser.displayName || adminUser.email || "Unknown Admin";

        const { error } = await supabase.from("audit_logs").insert([{
            action,
            target_user_id: targetUserId,
            performed_by: adminUser.uid,
            performed_by_name: performedByName,
            details: details || null,
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;

    } catch (error) {

    }
};

import * as z from 'zod';

// --- Types ---

export interface Role {
  id: string;
  name: string;
  description?: string;
  priority?: number;
}

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string; // The "EMP-001" style ID
  isResigned?: boolean;
  resignationDate?: string;
}

export interface User {
  uid: string;
  id: string; // Same as uid
  email: string;
  displayName: string;
  roleIds: string[]; // Array of role IDs
  departmentId?: string;
  isDepartmentHead?: boolean;
  isEnabled: boolean;
  createdAt: number;
  lastLoginAt?: number;
  photoURL?: string;
  employeeId?: string; // Link to employee
  isResigned?: boolean;
  resignationDate?: string;
  isDeleted?: boolean;
}

export interface AuditLog {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "RESET_PASSWORD";
  performedBy: string;
  performedByName: string;
  targetUserId: string;
  details: any;
  timestamp: number;
}

// --- Schemas ---

export const editUserSchema = z.object({
  roleIds: z.array(z.string()).min(1, "At least one role must be selected"),
  departmentId: z.string().optional(),
  isDepartmentHead: z.boolean().default(false),
});

export const addUserSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  roleIds: z.array(z.string()).min(1, "At least one role must be selected"),
});

// --- Helper Functions ---

export const formatDate = (
  timestamp?: number | string,
  includeTime: boolean = true,
) => {
  if (!timestamp) return "-";
  // Ensure we handle numeric timestamp correctly
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "-";

  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (!includeTime) return datePart;

  const timePart = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart}, ${timePart}`;
};

export const formatLogDetails = (details: any) => {
  if (!details) return {};
  const formatted: Record<string, any> = {};

  // Parse if string
  let data: any = details;
  if (typeof details === "string") {
    try {
      data = JSON.parse(details);
    } catch (e) {
      console.error("Failed to parse log details:", e);
      data = { "Raw Data": details };
    }
  }

  Object.keys(data).forEach((key) => {
    const value = data[key];

    if (key === "roleIds" && Array.isArray(value)) {
      // We need 'roles' in scope for this to work perfectly, but basic join is fine for now
      formatted["Assigned Roles"] = value.join(", ");
    } else if (key === "departmentId") {
      formatted["Department"] = value;
    } else if (key === "employeeId") {
      formatted["Employee ID"] = value;
    } else if (key === "isDepartmentHead") {
      formatted["Department Head?"] = value ? "Yes" : "No";
    } else if (key === "isEnabled") {
      formatted["Account Status"] = value ? "Active" : "Inactive";
    } else if (key === "isDeleted") {
      formatted["Deleted?"] = value ? "Yes" : "No";
    } else if (key === "displayName") {
      formatted["Name"] = value;
    } else if (key === "email") {
      formatted["Email"] = value;
    } else if (key === "authChanged") {
      formatted["Authentication Changed?"] = value ? "Yes" : "No";
    } else if (key === "resetMethod") {
      formatted["Reset Method"] = value;
    } else {
      // Fallback for other keys, try to make key readable
      const readableKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      formatted[readableKey] = value;
    }
  });
  return formatted;
};


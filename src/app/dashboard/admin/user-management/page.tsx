"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  KeyRound,
  Edit2,
  RefreshCw,
  Trash2,
  Shield,
  History as HistoryIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Combobox } from "@/components/ui/combobox";
import { AddUserDialog } from "./components/AddUserDialog";
import { UserAccessDialog } from "./components/UserAccessDialog";
import { cn } from "@/lib/utils";
import { hasValidEmployeePhone } from "@/lib/phone";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHero } from "@/components/dashboard/page-hero";

import { Role, Department, Employee, User, AuditLog, editUserSchema, addUserSchema, formatDate, formatLogDetails } from './constants';

// --- Component ---

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const {
    loading: permissionsLoading,
    isSuperAdmin: isSuperAdminByPermissions,
    highestPriority,
    hasPermission,
  } = usePermissions();

  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // State for filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalUsers, setTotalUsers] = useState(0);
  const [summaryCounts, setSummaryCounts] = useState({ totalUsers: 0, activeUsers: 0, superAdmins: 0, disabledOrDeleted: 0 });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");
  const [showDeleted, setShowDeleted] = useState(false); // If implemented

  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Dialog States
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Form Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Selected items
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [reactivatingUser, setReactivatingUser] = useState<User | null>(null);
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<User | null>(
    null,
  );
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  // Inputs
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");

  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      roleIds: [],
      departmentId: undefined,
      isDepartmentHead: false,
    },
  });

  const addUserForm = useForm<z.infer<typeof addUserSchema>>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      roleIds: [],
      employeeId: "",
    },
  });

  // --- Effects ---
  const fetchData = useCallback(async () => {
    try {
      // 1. Static Metadata (Roles & Departments)
      let currentRoles = roles;
      if (roles.length === 0) {
        const { data: rolesData, error: rolesErr } = await supabase.from("system_roles").select("*");
        if (rolesErr) throw rolesErr;
        currentRoles = rolesData?.map((d: any) => ({
          id: d.id, name: d.name, description: d.description, priority: d.priority,
        })) || [];
        setRoles(currentRoles);
      }
      if (departments.length === 0) {
        const { data: deptsData, error: deptsErr } = await supabase.from("departments").select("*");
        if (deptsErr) throw deptsErr;
        setDepartments(deptsData?.map((d: any) => ({ id: d.id, name: d.name })) || []);
      }

      // 2. Paginated Users
      const isDeletedTab = activeTab === "deleted";
      
      console.log("Supabase Filter State:", {
        activeTab,
        isDeletedTab,
      });

      let query = supabase.from("user_profiles").select("*", { count: "exact" });
      
      if (isDeletedTab) {
        query = query.or("is_deleted.eq.true,is_enabled.eq.false");
      } else {
        query = query.eq("is_deleted", false).eq("is_enabled", true);
      }

      if (debouncedSearchQuery) {
        query = query.or(`display_name.ilike.%${debouncedSearchQuery}%,email.ilike.%${debouncedSearchQuery}%`);
      }

      // Pagination
      const startIdx = (page - 1) * pageSize;
      query = query.range(startIdx, startIdx + pageSize - 1).order("created_at", { ascending: false });

      const [
        { data: usersData, count, error: usersErr },
        { data: allUserStatus }
      ] = await Promise.all([
        query,
        supabase.from("user_profiles").select("role_ids, is_deleted, is_enabled, is_owner_super_admin")
      ]);

      if (usersErr) throw usersErr;
      setTotalUsers(count || 0);

      // Compute global summary stats
      if (allUserStatus) {
        setSummaryCounts({
          totalUsers: allUserStatus.length,
          activeUsers: allUserStatus.filter(u => !u.is_deleted && u.is_enabled).length,
          disabledOrDeleted: allUserStatus.filter(u => u.is_deleted || !u.is_enabled).length,
          superAdmins: allUserStatus.filter(u => {
            if (u.is_owner_super_admin) return true;
            return (u.role_ids || []).some((rid: string) => {
              const role = currentRoles?.find((r: any) => r.id === rid);
              return role ? role.priority === 1 || role.name?.toLowerCase().includes("super admin") : false;
            });
          }).length
        });
      }

      // 3. Employees (fetch only for the current users, plus a fallback for form selection)
      // Since AddUserDialog needs all employees, we fetch all employees once like roles
      if (employees.length === 0) {
        const { data: empsData, error: empsErr } = await supabase.from("employees").select("*");
        if (empsErr) throw empsErr;
        setEmployees(empsData?.map((empRaw: any) => ({
          id: empRaw.id,
          name: empRaw.full_name || "No Name",
          email: empRaw.email || "",
          phone: empRaw.phone_number || "",
          employeeId: empRaw.employee_id_hash || empRaw.employee_code || empRaw.employee_id || "",
          isResigned: empRaw.is_resigned === true,
          resignationDate: empRaw.resignation_date || null,
          ...empRaw,
        })) || []);
      }

      if (usersData) {
        const loadedUsers = usersData.map((d: any) => ({
          uid: d.uid,
          id: d.uid,
          email: d.email || "",
          displayName: d.display_name || "Unknown",
          role_ids: d.role_ids || [], // Keep consistent with database
          roleIds: d.role_ids || [], // Legacy support
          departmentId: d.department_id,
          isDepartmentHead: d.is_department_head,
          isEnabled: d.is_enabled !== false,
          createdAt: d.created_at
            ? new Date(d.created_at).getTime()
            : Date.now(),
          lastLoginAt: d.last_login_at
            ? new Date(d.last_login_at).getTime()
            : undefined,
          employeeId: d.employee_id,
          isResigned: d.is_resigned,
          resignationDate: d.resignation_date,
          isDeleted: d.is_deleted,
        }));
        setUsers(loadedUsers);
      } else setUsers([]);
    } catch (err: any) {
      console.error("Error fetching initial data:", err);
      toast({
        title: "Fetch Error",
        description: err?.message || "Check console for details",
        variant: "destructive",
      });
    }
  }, [toast, activeTab, debouncedSearchQuery, page, pageSize, roles.length, departments.length, employees.length]);

  const refreshPageData = fetchData;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const canManageUsers = hasPermission('MANAGE_USERS');

  useEffect(() => {
    // Employee (and lower) must not access User Management
    if (permissionsLoading) return;
    if (!currentUser) return;
    if (!canManageUsers) router.replace("/dashboard");
  }, [permissionsLoading, currentUser, canManageUsers, router]);

  // Early access-control returns moved below all hook declarations to respect React's Rules of Hooks


  // --- Actions ---

  const toggleExpandUser = useCallback(
    async (user: User) => {
      if (expandedUserId === user.uid) {
        setExpandedUserId(null);
        return;
      }

      setExpandedUserId(user.uid);
      setHistoryLoading(true);

      try {
        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("entity_id", user.uid)
          .order("performed_at", { ascending: false });

        if (error) throw error;

        if (data) {
          const userLogs = data.map((l: any) => ({
            id: l.id,
            action: l.action,
            performedBy: l.performed_by,
            performedByName: l.details?.performed_by_name || l.performed_by_name || "System",
            targetUserId: l.entity_id || l.target_user_id || user.uid,
            details: l.details,
            timestamp: new Date(l.performed_at || l.created_at || Date.now()).getTime(),
          }));
          setAuditLogs(userLogs);
        } else {
          setAuditLogs([]);
        }
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "Failed to load history",
          variant: "destructive",
        });
      } finally {
        setHistoryLoading(false);
      }
    },
    [expandedUserId, toast],
  );

  const toggleSelectUser = (uid: string) => {
    const target = users.find((u) => u.uid === uid);
    if (target && !canModifyTargetUser(target)) {
      toast({
        title: "Not allowed",
        description: "Admin cannot modify a Super Admin account.",
        variant: "destructive",
      });
      return;
    }
    const newSet = new Set(selectedUserIds);
    if (newSet.has(uid)) {
      newSet.delete(uid);
    } else {
      newSet.add(uid);
    }
    setSelectedUserIds(newSet);
  };

  const handleEditSubmit = async (data: z.infer<typeof editUserSchema>) => {
    if (!userToEdit) return;
    if (!canModifyTargetUser(userToEdit)) {
      toast({
        title: "Not allowed",
        description: "Admin cannot edit a Super Admin account.",
        variant: "destructive",
      });
      return;
    }
    if (
      !isSuperAdminByPermissions &&
      data.roleIds.some((rid) => {
        const role = roles.find((r) => r.id === rid);
        return role ? isSuperAdminRole(role) : false;
      })
    ) {
      toast({
        title: "Not allowed",
        description: "Only Super Admin can assign the Super Admin role.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          role_ids: data.roleIds,
          department_id:
            data.departmentId === "unassigned" ? null : data.departmentId,
          is_department_head: data.isDepartmentHead,
          updated_at: new Date().toISOString(),
        })
        .eq("uid", userToEdit.uid);

      if (error) throw error;

      await refreshPageData();
      setIsEditDialogOpen(false);
      setUserToEdit(null);
      toast({ title: "Success", description: "User updated successfully" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddUserSubmit = async (data: z.infer<typeof addUserSchema>) => {
    setIsCreatingUser(true);
    try {
      if (
        !isSuperAdminByPermissions &&
        data.roleIds.some((rid) => {
          const role = roles.find((r) => r.id === rid);
          return role ? isSuperAdminRole(role) : false;
        })
      ) {
        throw new Error("Only Super Admin can assign the Super Admin role.");
      }
      if (reactivatingUser) {
        const response = await fetch("/api/admin/reactivate-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: reactivatingUser.uid,
            roleIds: data.roleIds,
            adminId: currentUser?.uid,
          }),
        });

        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Failed to reactivate user account");

        toast({
          title: "Success",
          description: "User reactivated successfully",
        });
      } else {
        const employee = employees.find((e) => e.id === data.employeeId);
        if (!employee) throw new Error("Employee not found");
        if (!employee.email?.trim()) {
          throw new Error("Employee email is required to create login credentials.");
        }
        if (!hasValidEmployeePhone(employee.phone)) {
          throw new Error("Employee mobile number is required to create login credentials.");
        }

        const response = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: data.employeeId,
            roleIds: data.roleIds,
            adminId: currentUser?.uid,
          }),
        });

        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Failed to create user account");
      }

      await refreshPageData();
      setIsAddUserOpen(false);
      setReactivatingUser(null);
      addUserForm.reset();
      
      toast({ title: "Success", description: reactivatingUser ? "User reactivated successfully" : "User added successfully" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userToDelete.uid,
          adminId: currentUser?.uid,
          adminName: currentUser?.displayName || "Admin",
        }),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to delete user account");

      await refreshPageData();
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeleteConfirmationInput("");

      toast({ title: "Success", description: "User marked as deleted" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivateUser = (user: User) => {
    setReactivatingUser(user);
    addUserForm.reset({
      employeeId: user.employeeId || "",
      roleIds: user.roleIds || [],
    });
    setIsAddUserOpen(true);
  };

  const handleBatchReset = async () => {
    setIsResetting(true);
    try {
      const adminId = currentUser?.uid;
      if (!adminId) throw new Error("Requester admin ID is missing");

      const selectedIds = Array.from(selectedUserIds);
      let successCount = 0;
      let failErrors: string[] = [];

      for (const userId of selectedIds) {
        try {
          const response = await fetch("/api/admin/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, adminId }),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || `Reset failed for ${userId}`);
          successCount++;
        } catch (err: any) {
          console.error(`Error resetting credentials for user ${userId}:`, err.message);
          failErrors.push(err.message);
        }
      }

      if (failErrors.length > 0) {
        toast({
          title: "Password Reset Incomplete",
          description: `Successfully reset ${successCount} user(s). Failed for ${failErrors.length} user(s).`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Password reset successfully for ${successCount} user(s). Users must change password on next login.`,
        });
      }

      await refreshPageData();
      setIsResetDialogOpen(false);
      setSelectedUserIds(new Set());
      setResetConfirmation("");
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const getSelectedUsersPasswordResetInfo = () => {
    return Array.from(selectedUserIds)
      .map((uid) => {
        const u = users.find((user) => user.uid === uid);
        if (!u) return null;
        const e = employees.find((emp) => emp.id === u.employeeId);
        return {
          uid,
          name: u.displayName || "Unknown",
          email: u.email || "",
          hasEmail: !!u.email?.trim(),
          hasPhone: hasValidEmployeePhone(e?.phone),
        };
      })
      .filter(Boolean) as Array<{
      uid: string;
      name: string;
      email: string;
      hasEmail: boolean;
      hasPhone: boolean;
    }>;
  };

  // --- Computed ---

  // With Server-Side pagination, users array is already filtered!
  const filteredUsers = users;

  const selectedEmpId = addUserForm.watch("employeeId");
  const selectedEmployeeForPreview = employees.find(
    (e) => e.id === selectedEmpId,
  );

  const usersByEmployeeId = new Map<string, User>();
  users.forEach((u) => {
    if (u.employeeId) usersByEmployeeId.set(u.employeeId, u);
  });

  const availableEmployees = employees
    .filter((e) => {
      if (!e.name) return false;

      // Show only active employees
      if (e.isResigned === true) return false;

      // SPECIAL CASE: If reactivating, we MUST show the employee associated with the user
      if (reactivatingUser && reactivatingUser.employeeId === e.id) {
        return true;
      }

      // If user exists (Active or Deleted) => don't show
      const existingUser = usersByEmployeeId.get(e.id);
      if (existingUser) return false;

      // else show (no user OR deleted user)
      return true;
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Calculate Role Access
  const dbCurrentUser = users.find((u) => u.uid === currentUser?.uid);
  const currentUserRoles = roles.filter(
    (r) =>
      dbCurrentUser &&
      dbCurrentUser.roleIds &&
      dbCurrentUser.roleIds.includes(r.id),
  );
  const currentUserHighestRank =
    currentUserRoles.length > 0
      ? Math.min(...currentUserRoles.map((r) => r.priority ?? 99))
      : 99;



  const isSuperAdminRole = useCallback((role: Role) => {
    const name = (role.name || "").toLowerCase();
    if (name.includes("super admin") || name.includes("owner")) return true;
    // Lower priority number => higher power. Treat priority 1 as Super Admin.
    if (role.priority !== undefined && role.priority <= 1) return true;
    return false;
  }, []);

  const isAdminRole = useCallback((role: Role) => {
    const name = (role.name || "").toLowerCase();
    if (isSuperAdminRole(role)) return false;
    if (role.priority !== undefined && role.priority === 2) return true;
    // Common naming variants
    if (name === "admin" || name.includes(" admin")) return true;
    return false;
  }, [isSuperAdminRole]);

  const isEmployeeRole = useCallback((role: Role) => {
    const name = (role.name || "").toLowerCase();
    if (isSuperAdminRole(role) || isAdminRole(role)) return false;
    if (role.priority !== undefined && role.priority >= 10) return true;
    if (name.includes("employee") || name.includes("staff")) return true;
    return false;
  }, [isAdminRole, isSuperAdminRole]);

  // Hardened role assignment rules:
  // - Super Admin can assign all roles
  // - Non–Super Admin cannot assign Super Admin role (by name/priority)
  // - Admin can only assign roles with lower power (higher priority number)
  const allowedRoles = useMemo(() => {
    if (isSuperAdminByPermissions) return roles;
    return roles.filter((role) => {
      if (isSuperAdminRole(role)) return false;
      const p = role.priority ?? 999;
      return p > currentUserHighestRank;
    });
  }, [isSuperAdminByPermissions, roles, currentUserHighestRank, isSuperAdminRole]);

  const selectedAddRoleIds = addUserForm.watch("roleIds");
  const selectedEditRoleIds = editForm.watch("roleIds");

  const addSelectionIncludesSuperAdmin = useMemo(() => {
    if (isSuperAdminByPermissions) return false;
    return (selectedAddRoleIds || []).some((rid) => {
      const role = roles.find((r) => r.id === rid);
      return role ? isSuperAdminRole(role) : false;
    });
  }, [isSuperAdminByPermissions, selectedAddRoleIds, roles, isSuperAdminRole]);

  const editSelectionIncludesSuperAdmin = useMemo(() => {
    if (isSuperAdminByPermissions) return false;
    return (selectedEditRoleIds || []).some((rid) => {
      const role = roles.find((r) => r.id === rid);
      return role ? isSuperAdminRole(role) : false;
    });
  }, [isSuperAdminByPermissions, selectedEditRoleIds, roles, isSuperAdminRole]);

  useEffect(() => {
    if (addSelectionIncludesSuperAdmin) {
      addUserForm.setError("roleIds", {
        type: "manual",
        message: "Only Super Admin can assign the Super Admin role.",
      });
    } else {
      addUserForm.clearErrors("roleIds");
    }
  }, [addSelectionIncludesSuperAdmin, addUserForm]);

  useEffect(() => {
    if (editSelectionIncludesSuperAdmin) {
      editForm.setError("roleIds", {
        type: "manual",
        message: "Only Super Admin can assign the Super Admin role.",
      });
    } else {
      editForm.clearErrors("roleIds");
    }
  }, [editSelectionIncludesSuperAdmin, editForm]);

  const userHasRoleCategory = useCallback(
    (user: User, predicate: (r: Role) => boolean) => {
      return (user.roleIds || []).some((rid) => {
        const role = roles.find((r) => r.id === rid);
        return role ? predicate(role) : false;
      });
    },
    [roles],
  );

  // Use the global summary counts computed in fetchData
  const summary = summaryCounts;

  const isSuperAdminUser = useCallback(
    (user: User) => userHasRoleCategory(user, isSuperAdminRole),
    [userHasRoleCategory, isSuperAdminRole],
  );

  const canModifyTargetUser = useCallback(
    (target: User) => {
      if (isSuperAdminByPermissions) return true;
      // Admin cannot edit/delete/reset a Super Admin
      if (isSuperAdminUser(target)) return false;
      return true;
    },
    [isSuperAdminByPermissions, isSuperAdminUser],
  );

  if (permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Verifying access...
      </div>
    );
  }

  if (currentUser && !canManageUsers) {
    // Redirect happens in effect; keep UI blank to avoid flash.
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-background p-6">
      <div className="mx-auto w-full max-w-full flex flex-col space-y-6">
        {/* HERO SECTION */}
        <PageHero
          pattern="pattern-7"
          icon={Users}
          badge="ACCESS CONTROL"
          title="User Management"
          description="Manage system access, roles, and permissions."
        >
          <div className="flex items-center gap-2">
            {selectedUserIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setIsResetDialogOpen(true)}
                className="font-semibold h-11 px-6 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md shadow-sm"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Reset ({selectedUserIds.size})
              </Button>
            )}
            <Button 
              onClick={() => setIsAddUserOpen(true)} 
              className="font-semibold h-11 px-6 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md shadow-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </PageHero>

        <Tabs
          defaultValue="active"
          value={activeTab}
          className="w-full"
          onValueChange={(v) => {
            setActiveTab(v as any);
            setPage(1); // Reset pagination on tab change
          }}
        >
          {/* Resigned Users Alert */}
          {users.some((u) => {
            const emp = employees.find((e) => e.id === u.employeeId);
            return (u.isResigned || emp?.isResigned === true) && !u.isDeleted;
          }) && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-md flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800">
                  Action Required: Resigned Users Pending Deletion
                </h3>
                <p className="text-xs text-red-700 mt-1">
                  The following users have resigned but are still in the active
                  list. Please review and delete or disable their accounts if
                  necessary:
                </p>
                <ul className="list-disc list-inside mt-2 text-xs text-red-800 font-medium">
                  {users
                    .filter((u) => {
                      const emp = employees.find((e) => e.id === u.employeeId);
                      return (
                        (u.isResigned || emp?.isResigned === true) &&
                        !u.isDeleted
                      );
                    })
                    .map((u) => (
                      <li key={u.uid}>
                        {u.displayName} ({u.email})
                        {u.isEnabled ? (
                          <span className="font-bold ml-2">
                            [ACCOUNT ENABLED]
                          </span>
                        ) : (
                          <span className="opacity-70 ml-2">[Disabled]</span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="group bg-card border rounded-xl p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-[2px] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground font-semibold">
                  Total Users
                </div>
                <Users className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-[1px]" />
              </div>
              <div className="mt-3 text-3xl font-bold tracking-tight">{summary.totalUsers}</div>
            </div>
            <div className="group bg-card border rounded-xl p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-[2px] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground font-semibold">
                  Active Users
                </div>
                <Badge className="h-5 px-2 text-[10px] uppercase font-bold tracking-wider bg-blue-600 hover:bg-blue-600 text-white border-transparent transition-transform duration-200 group-hover:-translate-y-[1px]">
                  Active
                </Badge>
              </div>
              <div className="mt-3 text-3xl font-bold tracking-tight">{summary.activeUsers}</div>
            </div>
            <div className="group bg-card border rounded-xl p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-[2px] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground font-semibold">
                  Super Admins
                </div>
                <Shield className="h-4 w-4 text-amber-600 transition-transform duration-200 group-hover:-translate-y-[1px]" />
              </div>
              <div className="mt-3 text-3xl font-bold tracking-tight">{summary.superAdmins}</div>
            </div>
            <div className="group bg-card border rounded-xl p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-[2px] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground font-semibold">
                  Disabled / Deleted
                </div>
                <Trash2 className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-[1px]" />
              </div>
              <div className="mt-3 text-3xl font-bold tracking-tight">
                {summary.disabledOrDeleted}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/10">
              <TabsList className="grid w-full md:w-fit grid-cols-2 h-10">
                <TabsTrigger value="active" className="text-sm">Active Users</TabsTrigger>
                <TabsTrigger value="deleted" className="text-sm">Deleted / Inactive</TabsTrigger>
              </TabsList>
              <div className="relative flex-1 md:max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-9 h-10 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedUserIds.size === filteredUsers.length &&
                        filteredUsers.length > 0
                      }
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const selectable = filteredUsers
                            .filter((u) => canModifyTargetUser(u))
                            .map((u) => u.uid);
                          setSelectedUserIds(new Set(selectable));
                        } else {
                          setSelectedUserIds(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center h-24 text-muted-foreground"
                    >
                      No {activeTab} users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const userEmp = employees.find(
                      (e) => e.id === user.employeeId,
                    );
                    const isResigned =
                      userEmp?.isResigned === true || user.isResigned === true;
                    const resignationDateDisplay =
                      userEmp?.resignationDate || user.resignationDate
                        ? formatDate(
                            userEmp?.resignationDate || user.resignationDate,
                            false,
                          )
                        : null;

                    const isSelected = selectedUserIds.has(user.uid);
                    const isExpanded = expandedUserId === user.uid;
                    const cellBgClass = isSelected
                      ? "bg-slate-200/80 dark:bg-slate-700/60"
                      : isExpanded
                        ? "bg-slate-200/50 dark:bg-slate-800/70"
                        : "bg-slate-100 dark:bg-slate-800/40";

                    return (
                      <React.Fragment key={user.uid}>
                        <TableRow
                          key={user.uid}
                          data-uid={user.uid}
                          className={cn(
                            "group cursor-pointer transition-all duration-150 relative drop-shadow-[0_4px_8px_rgba(0,0,0,0.04)] hover:drop-shadow-[0_6px_12px_rgba(0,0,0,0.06)]",
                            !user.isEnabled && !isResigned && "opacity-80", 
                          )}
                          onClick={(e) => {
                            if (
                              (e.target as HTMLElement).closest("button") ||
                              (e.target as HTMLElement).closest("input")
                            )
                              return;
                            toggleExpandUser(user);
                          }}
                        >
                          <TableCell className={cn("relative border-none rounded-l-[18px] py-4", cellBgClass, isResigned && "border-l-4 border-l-red-500")}
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(128,128,128,0.04) 10px, rgba(128,128,128,0.04) 20px)`,
                            }}
                          >
                            <Checkbox
                              checked={selectedUserIds.has(user.uid)}
                              disabled={!canModifyTargetUser(user)}
                              onCheckedChange={() => toggleSelectUser(user.uid)}
                            />
                            <div className="mt-2 text-muted-foreground">
                              {expandedUserId === user.uid ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={cn("relative border-none py-4", cellBgClass)}
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(128,128,128,0.04) 10px, rgba(128,128,128,0.04) 20px)`,
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {user.displayName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {user.email}
                              </span>
                              {!isSuperAdminByPermissions && isSuperAdminUser(user) && (
                                <span className="inline-flex mt-1 items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 tracking-wide uppercase w-fit border border-amber-200">
                                  PROTECTED (SUPER ADMIN)
                                </span>
                              )}
                              {userEmp?.employeeId && (
                                <span className="text-[10px] font-mono text-muted-foreground mt-0.5 bg-muted/30 px-1 rounded w-fit">
                                  {userEmp.employeeId}
                                </span>
                              )}
                              {isResigned && (
                                <span className="inline-flex mt-1 items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 tracking-wide uppercase">
                                  RESIGNED
                                  {resignationDateDisplay
                                    ? ` ON ${resignationDateDisplay}`
                                    : ""}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={cn("relative border-none py-4", cellBgClass)}
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(128,128,128,0.04) 10px, rgba(128,128,128,0.04) 20px)`,
                            }}
                          >
                            <div className="flex flex-wrap gap-1">
                              {user.roleIds?.map((rid: string) => {
                                const r = roles.find((ro) => ro.id === rid);
                                const isSA = r ? isSuperAdminRole(r) : false;
                                const isAdm = r ? isAdminRole(r) : false;
                                return (
                                  <Badge
                                    key={rid}
                                    variant="secondary"
                                    className={cn(
                                      "text-[10px] shadow-sm backdrop-blur-sm transition-all hover:scale-105",
                                      isSA &&
                                        "bg-amber-100/80 text-amber-900 border border-amber-300 font-semibold",
                                      isAdm &&
                                        "bg-blue-100/80 text-blue-900 border border-blue-300 font-semibold",
                                      !isSA && !isAdm &&
                                        "bg-white/80 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300"
                                    )}
                                  >
                                    {r?.name || rid}
                                  </Badge>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className={cn("relative border-none py-4", cellBgClass)}
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(128,128,128,0.04) 10px, rgba(128,128,128,0.04) 20px)`,
                            }}
                          >
                            {user.departmentId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-foreground">
                                  {departments.find(
                                    (d) => d.id === user.departmentId,
                                  )?.name || "Unknown"}
                                </span>
                                {user.isDepartmentHead && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-blue-200 text-blue-700 bg-blue-50"
                                  >
                                    Head
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">
                                Unassigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell className={cn("relative border-none py-4", cellBgClass)}
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(128,128,128,0.04) 10px, rgba(128,128,128,0.04) 20px)`,
                            }}
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] font-semibold border px-2 py-0.5 shadow-sm bg-white/60 dark:bg-background/60 backdrop-blur-sm",
                                user.isDeleted
                                  ? "text-red-700 border-red-200"
                                  : !user.isEnabled
                                    ? "text-stone-600 border-stone-200"
                                    : isResigned
                                      ? "text-amber-700 border-amber-200"
                                      : "text-emerald-700 border-emerald-200"
                              )}
                            >
                              <div className={cn(
                                "mr-1.5 h-1.5 w-1.5 rounded-full",
                                user.isDeleted 
                                  ? "bg-red-500"
                                  : !user.isEnabled
                                    ? "bg-stone-400"
                                    : isResigned
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                              )} />
                              {user.isDeleted ? "Deleted" : !user.isEnabled ? "Inactive" : isResigned ? "Resigned" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("text-right relative border-none rounded-r-[18px] py-4 pr-4", cellBgClass)}
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(128,128,128,0.04) 10px, rgba(128,128,128,0.04) 20px)`,
                            }}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-white/50 dark:hover:bg-background/50"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (!canModifyTargetUser(user)) {
                                      toast({
                                        title: "Not allowed",
                                        description:
                                          "Admin cannot edit a Super Admin account.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    setUserToEdit(user);
                                    editForm.reset({
                                      roleIds: user.roleIds || [],
                                      departmentId:
                                        user.departmentId || "unassigned",
                                      isDepartmentHead:
                                        user.isDepartmentHead || false,
                                    });
                                    setIsEditDialogOpen(true);
                                  }}
                                  disabled={!canModifyTargetUser(user)}
                                >
                                  <Edit2 className="mr-2 h-4 w-4" /> Edit
                                  Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedHistoryUser(user);
                                    setIsHistoryDialogOpen(true);
                                    toggleExpandUser(user);
                                  }}
                                >
                                  <HistoryIcon className="mr-2 h-4 w-4" /> View
                                  History
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.isDeleted ? (
                                  <DropdownMenuItem
                                    className="text-green-600"
                                    onClick={() => handleReactivateUser(user)}
                                    disabled={!canModifyTargetUser(user)}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />{" "}
                                    Reactivate User
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => {
                                      if (!canModifyTargetUser(user)) {
                                        toast({
                                          title: "Not allowed",
                                          description:
                                            "Admin cannot delete a Super Admin account.",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      setUserToDelete(user);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    disabled={!canModifyTargetUser(user)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    User
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row */}
                        {expandedUserId === user.uid && (
                          <TableRow className="bg-muted/5">
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Details */}
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center text-sm">
                                    <Shield className="mr-2 h-4 w-4" /> Account
                                    Details
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2">
                                      <span className="text-muted-foreground">
                                        Employee ID:
                                      </span>
                                      <span className="font-semibold">
                                        {userEmp?.employeeId || "N/A"}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2">
                                      <span className="text-muted-foreground">
                                        Created At:
                                      </span>
                                      <span>{formatDate(user.createdAt)}</span>
                                    </div>
                                    <div className="grid grid-cols-2">
                                      <span className="text-muted-foreground">
                                        Last Login:
                                      </span>
                                      <span>
                                        {formatDate(user.lastLoginAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Audit Log Preview */}
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center text-sm">
                                    <HistoryIcon className="mr-2 h-4 w-4" />{" "}
                                    Recent Activity
                                  </h4>
                                  {historyLoading ? (
                                    <div className="text-xs text-muted-foreground">
                                      Loading...
                                    </div>
                                  ) : (
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                                      {auditLogs
                                        .slice(0, 3)
                                        .map((log, index) => (
                                          <div
                                            key={`${log.id || "log"}-${index}`}
                                            className="text-xs border-l-2 border-muted pl-2 py-0.5"
                                          >
                                            <span className="font-semibold">
                                              {log.action}
                                            </span>
                                            <span className="text-muted-foreground mx-1">
                                              by
                                            </span>
                                            <span>{log.performedByName}</span>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                              {formatDate(log.timestamp)}
                                            </div>
                                          </div>
                                        ))}
                                      {auditLogs.length === 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          No recent activity.
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <Button
                                    variant="link"
                                    className="px-0 h-auto text-xs mt-2"
                                    onClick={() => {
                                      setSelectedHistoryUser(user);
                                      setIsHistoryDialogOpen(true);
                                    }}
                                  >
                                    View Full History
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        <tr className="h-3"><td colSpan={6} className="bg-transparent border-none"></td></tr>
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between px-5 py-4 border-t border-border/60 bg-muted/10">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-slate-900">{totalUsers === 0 ? 0 : Math.min((page - 1) * pageSize + 1, totalUsers)}</span> to <span className="font-medium text-slate-900">{Math.min(page * pageSize, totalUsers)}</span> of <span className="font-medium text-slate-900">{totalUsers}</span> users
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm font-medium px-2">
                  Page {page} of {Math.max(1, Math.ceil(totalUsers / pageSize))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(totalUsers / pageSize) || totalUsers === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </Tabs>
        {/* Placeholder for Chunk 3 */}
        <UserAccessDialog
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          user={userToEdit}
          roles={roles}
          departments={departments}
          allowedRoles={allowedRoles}
          isSuperAdminByPermissions={isSuperAdminByPermissions}
          isSuperAdminRole={isSuperAdminRole}
          onBasicDetailsSubmit={handleEditSubmit}
          editForm={editForm}
          isSubmitting={isSubmitting}
        />

        <AddUserDialog
          isOpen={isAddUserOpen}
          setIsOpen={setIsAddUserOpen}
          form={addUserForm}
          onSubmit={handleAddUserSubmit}
          reactivatingUser={reactivatingUser}
          availableEmployees={availableEmployees}
          allowedRoles={allowedRoles}
          isSuperAdminByPermissions={isSuperAdminByPermissions}
          isSuperAdminRole={isSuperAdminRole}
          isCreatingUser={isCreatingUser}
          selectedEmpId={selectedEmpId}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                user account Running this action will remove all role
                assignments and permissions.
                <br />
                <br />
                Please type{" "}
                <span className="font-bold text-foreground">
                  delete {userToDelete?.displayName}
                </span>{" "}
                to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Input
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder={`delete ${userToDelete?.displayName}`}
                className="font-mono"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteUser();
                }}
                disabled={
                  isDeleting ||
                  deleteConfirmationInput !==
                    `delete ${userToDelete?.displayName}`
                }
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Reset Confirmation Dialog */}
        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Passwords</DialogTitle>
              <DialogDescription>
                This will reset credentials for {selectedUserIds.size} selected user(s) to a
                temporary value based on each employee&apos;s mobile number. Users must change
                their password on next login.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="p-3 bg-yellow-50 border-yellow-200 border rounded-md text-sm text-yellow-800 flex gap-2">
                <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Target Users:</p>
                  <ul className="mt-2 max-h-[140px] overflow-y-auto space-y-2">
                    {getSelectedUsersPasswordResetInfo().map((u) => (
                      <li
                        key={u.uid}
                        className="rounded-md border border-yellow-200 bg-yellow-50/60 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">{u.name}</div>
                          <div className="flex gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                u.hasEmail
                                  ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                  : "border-red-200 text-red-700 bg-red-50",
                              )}
                            >
                              Email {u.hasEmail ? "OK" : "Missing"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                u.hasPhone
                                  ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                  : "border-red-200 text-red-700 bg-red-50",
                              )}
                            >
                              Mobile {u.hasPhone ? "OK" : "Missing"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {u.email || "No Email"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type "CONFIRM RESET" to proceed:</Label>
                <Input
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="CONFIRM RESET"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsResetDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBatchReset}
                disabled={
                  isResetting ||
                  resetConfirmation !== "CONFIRM RESET" ||
                  !getSelectedUsersPasswordResetInfo().every((u) => u.hasEmail && u.hasPhone)
                }
              >
                {isResetting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Reset Passwords
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* HISTORY DIALOG */}
        <Dialog
          open={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {selectedHistoryUser?.displayName || 'Audit History'}
              </DialogTitle>
              <DialogDescription>
                View the details of this item.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length > 0 ? (
                <div className="space-y-4">
                  {auditLogs.map((log, index) => {
                    const detailsData =
                      typeof log.details === "string"
                        ? JSON.parse(log.details)
                        : log.details;

                    return (
                      <div
                        key={log.id || `audit-log-${index}`}
                        className="flex flex-col gap-2 p-4 border rounded-md bg-muted/20 text-sm"
                      >
                        <div className="flex justify-between items-start border-b pb-2 mb-2 border-muted-foreground/10">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide",
                                  log.action === "CREATE"
                                    ? "bg-green-100 text-green-700 border-green-200 border"
                                    : log.action === "DELETE"
                                      ? "bg-red-100 text-red-700 border-red-200 border"
                                      : "bg-blue-100 text-blue-700 border-blue-200 border",
                                )}
                              >
                                {log.action}
                              </span>
                              <span className="font-semibold">
                                {log.performedByName}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDate(log.timestamp)}
                          </span>
                        </div>

                        {/* Details Table */}
                        {/* Details Table */}
                        {detailsData && Object.keys(detailsData).length > 0 && (
                          <div className="bg-background rounded-md border text-xs overflow-hidden">
                            <table className="w-full text-left">
                              <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-1.5 font-medium border-b w-1/3">
                                    Field
                                  </th>
                                  <th className="px-3 py-1.5 font-medium border-b">
                                    Value
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {Object.entries(detailsData).map(
                                  ([key, value]) => {
                                    // Helper to format values
                                    let displayValue: React.ReactNode =
                                      String(value);

                                    if (
                                      key === "roleIds" &&
                                      Array.isArray(value)
                                    ) {
                                      displayValue = value
                                        .map((roleId) => {
                                          const role = roles.find(
                                            (r) => r.id === roleId,
                                          );
                                          return role ? role.name : roleId;
                                        })
                                        .join(", ");
                                    } else if (
                                      key === "employeeId" &&
                                      typeof value === "string"
                                    ) {
                                      const emp = employees.find(
                                        (e) => e.id === value,
                                      );
                                      displayValue = emp
                                        ? `${emp.name} (${emp.email})`
                                        : value;
                                    } else if (
                                      key === "departmentId" &&
                                      typeof value === "string"
                                    ) {
                                      const dept = departments.find(
                                        (d) => d.id === value,
                                      );
                                      displayValue = dept ? dept.name : value;
                                    } else if (Array.isArray(value)) {
                                      displayValue =
                                        value.join(", ") || "(Empty List)";
                                    } else if (value === null) {
                                      displayValue = "null";
                                    } else if (typeof value === "boolean") {
                                      displayValue = value ? "Yes" : "No";
                                    } else if (typeof value === "object") {
                                      displayValue = JSON.stringify(value);
                                    }

                                    // Helper to format keys
                                    const displayKey = key
                                      .replace(/([A-Z])/g, " $1")
                                      .replace(/^./, (str) => str.toUpperCase())
                                      .replace("Ids", "s") // roleIds -> Roles
                                      .replace("Id", ""); // employeeId -> Employee

                                    return (
                                      <tr key={key}>
                                        <td className="px-3 py-1.5 font-medium text-muted-foreground border-r bg-muted/20">
                                          {displayKey}
                                        </td>
                                        <td className="px-3 py-1.5 break-all">
                                          {displayValue}
                                        </td>
                                      </tr>
                                    );
                                  },
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No history found for this user.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
